"""Portable TEST library journal. SQLite is a disposable search projection.

This module never writes source notes. The live Obsidian adapter owns text edits.
Every mutation is profile/epoch guarded, revision checked and journaled.
"""
import fcntl
import hashlib
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from crawl import math_search
import search_projection


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def atomic_json(path, value):
    path=Path(path);temporary=path.with_name(path.name+'.tmp-'+str(uuid.uuid4()))
    try:
        with temporary.open('xb') as stream:
            stream.write(encoded(value));stream.flush();os.fsync(stream.fileno())
        os.replace(temporary,path)
        descriptor=os.open(path.parent,os.O_RDONLY)
        try:os.fsync(descriptor)
        finally:os.close(descriptor)
    finally:
        if temporary.exists():temporary.unlink()


class Conflict(ValueError):pass

PROJECTION_FILENAME=f'search-v5-p{search_projection.SCHEMA}.sqlite'


def projection_busy(error):
    return isinstance(error,sqlite3.OperationalError) and any(word in str(error).lower() for word in ('locked','busy'))


class PortableLibrary:
    def __init__(self, root, allow_readonly=False, mode='TEST'):
        self.root=Path(root).resolve();self.root.mkdir(parents=True,exist_ok=True)
        self.transactions=self.root/'transactions';self.transactions.mkdir(exist_ok=True)
        self.config_path=self.root/'library.json'
        with self.lock():
            if not self.config_path.exists():
                atomic_json(self.config_path,{'mode':mode,'id':str(uuid.uuid4()),'epoch':str(uuid.uuid4()),'version':1})
            self.config=json.loads(self.config_path.read_text())
            if self.config.get('mode')!=mode or mode not in ('TEST','PRODUCTION'):raise ValueError('Library mode does not match the requested collection.')
            self.fault=None
            try:self.load()
            except (Conflict,json.JSONDecodeError) as exc:
                if not allow_readonly:raise
                self.fault=str(exc)
            self.project_or_defer()
            if not self.fault:self.try_backup()

    @contextmanager
    def lock(self):
        if getattr(self,'_lock_depth',0):
            self._lock_depth+=1
            try:yield
            finally:self._lock_depth-=1
            return
        with (self.root/'writer.lock').open('a') as handle:
            fcntl.flock(handle.fileno(),fcntl.LOCK_EX)
            self._lock_depth=1
            try:yield
            finally:self._lock_depth=0;fcntl.flock(handle.fileno(),fcntl.LOCK_UN)

    def guard(self, profile, epoch):
        if self.fault:raise Conflict('Library is read-only: '+self.fault)
        if profile!=self.config['id'] or epoch!=self.config['epoch']:
            raise Conflict('Library profile or epoch changed. Refresh before writing.')

    def load(self):
        if getattr(self,'fault',None):return
        if not hasattr(self,'entries'):
            self.entries={};self.receipts={};self.sequence=0;self.head=None;self.history={};self.clocks={};self.owners={}
            self.restore_checkpoint()
        if not hasattr(self,'records'):
            self.records={r['sequence']:r for r in self.receipts.values()}
            self.paths_by_vault={};self.documents_by_path={}
            for entry in self.entries.values():self._count_home(entry,1)
        stat=self.transactions.stat();stamp=(stat.st_dev,stat.st_ino,stat.st_mtime_ns,stat.st_ctime_ns)
        if stamp==getattr(self,'_journal_stamp',None):return
        paths=sorted(self.transactions.glob('*.json'))
        if len(paths)<self.sequence:raise Conflict('Portable journal was truncated.')
        for path in paths:
            if int(path.stem)<=self.sequence:continue
            record=json.loads(path.read_text());signature=record.pop('checksum',None)
            if signature!=digest(record) or record['previous']!=self.head or record['sequence']!=self.sequence+1:
                raise Conflict('Portable journal integrity failed at '+path.name+'. No further writes are allowed.')
            record_ids=set()
            for change in record['changes']:
                before=change['before'];after=change['after'];entry_id=(after or before)['id']
                if entry_id in record_ids or self.entries.get(entry_id)!=before:raise Conflict('Journal revision chain is inconsistent.')
                record_ids.add(entry_id)
            self.validate_ownership(record['changes'])
            for change in record['changes']:
                if change['before']:self.owners.pop(change['before']['home']['occurrenceId'],None)
            for change in record['changes']:
                before=change['before'];after=change['after'];entry_id=(after or before)['id']
                if before:self._count_home(before,-1)
                if after:self._count_home(after,1)
                if after is None:self.entries.pop(entry_id,None)
                else:
                    self.entries[entry_id]=after;self.owners[after['home']['occurrenceId']]=entry_id
                self.clocks[entry_id]=(after['revision'] if after else self.clocks.get(entry_id,0)+1)
                self.history.setdefault(entry_id,[]).append({'sequence':record['sequence'],'revision':after,'actor':record['actor'],'at':record['at']})
            self.sequence=record['sequence'];self.head=signature;self.receipts[record['key']]=record;self.records[self.sequence]=record
        self._journal_stamp=stamp

    def _count_home(self,entry,delta):
        home=entry['home'];vault=home.get('vaultId',home['vault']);path=home['path']
        counts=self.paths_by_vault.setdefault(vault,{})
        count=counts.get(path,0)+delta
        if count:counts[path]=count
        else:counts.pop(path,None)
        key=(vault,path);documents=self.documents_by_path.setdefault(key,{})
        document=home['documentId'];total=documents.get(document,0)+delta
        if total:documents[document]=total
        else:documents.pop(document,None)
        if not documents:self.documents_by_path.pop(key,None)

    def changes_since(self,sequence,limit=2000):
        if not isinstance(sequence,int) or isinstance(sequence,bool) or sequence<0 or sequence>self.sequence or self.sequence-sequence>limit:
            return {'reset':True,'catalogChanged':True,'changedIds':[]}
        changed=set();catalog_changed=False
        def catalog_key(entry):
            if entry is None:return None
            home=entry['home']
            return (home.get('vaultId',home['vault']),home['path'],entry['kind'],entry.get('status')=='deleted',entry.get('admission')=='pending-variant')
        for n in range(sequence+1,self.sequence+1):
            for change in self.records[n]['changes']:
                before,after=change['before'],change['after']
                changed.add((after or before)['id'])
                catalog_changed|=catalog_key(before)!=catalog_key(after)
                if len(changed)>limit:return {'reset':True,'catalogChanged':True,'changedIds':[]}
        return {'reset':False,'catalogChanged':catalog_changed,'changedIds':sorted(changed)}

    def restore_checkpoint(self):
        """A disposable replay cache. Any changed journal file forces full replay."""
        try:
            checkpoint=json.loads((self.root/'checkpoint.json').read_text())
            checksum=checkpoint.pop('checksum')
            if digest(checkpoint)!=checksum or checkpoint['profile']!=self.config['id'] or checkpoint['epoch']!=self.config['epoch']:return
            state=checkpoint['state'];sequence=state['sequence']
            if sequence!=len(checkpoint['files']):return
            for name,expected in checkpoint['files'].items():
                info=(self.transactions/name).stat()
                if [info.st_size,info.st_mtime_ns,info.st_ctime_ns]!=expected:return
            anchor=json.loads((self.transactions/f'{sequence:010d}.json').read_text())
            signature=anchor.pop('checksum')
            if digest(anchor)!=signature or signature!=state['head']:return
            keys=('entries','receipts','sequence','head','history','clocks','owners')
            values={key:state[key] for key in keys}
            for key,value in values.items():setattr(self,key,value)
            self.checkpoint_sequence=sequence
        except (OSError,ValueError,KeyError,TypeError):return

    def checkpoint(self):
        """Retain every journal record; accelerate startup with a verified state cache."""
        if self.fault or self.sequence-getattr(self,'checkpoint_sequence',0)<200:return
        files={}
        for path in sorted(self.transactions.glob('*.json')):
            if int(path.stem)>self.sequence:continue
            info=path.stat();files[path.name]=[info.st_size,info.st_mtime_ns,info.st_ctime_ns]
        record={'profile':self.config['id'],'epoch':self.config['epoch'],'files':files,
                'state':{key:getattr(self,key) for key in ('entries','receipts','sequence','head','history','clocks','owners')}}
        atomic_json(self.root/'checkpoint.json',{**record,'checksum':digest(record)})
        self.checkpoint_sequence=self.sequence

    def validate_ownership(self, changes):
        touched={(c['after'] or c['before'])['id'] for c in changes};pending={}
        for change in changes:
            entry=change['after']
            if entry is None:continue
            occurrence=entry['home']['occurrenceId'];owner=self.owners.get(occurrence)
            if (owner is not None and owner!=entry['id'] and owner not in touched) or (occurrence in pending and pending[occurrence]!=entry['id']):
                raise Conflict('Duplicate owning occurrence; restore a verified journal backup if this occurs during replay: '+occurrence)
            pending[occurrence]=entry['id']

    def project(self, rebuild=False):
        with self.lock():
            self.load()
            return self._project(rebuild)

    def project_or_defer(self):
        try:self.project()
        except sqlite3.OperationalError as exc:
            if not projection_busy(exc) or not self.database.exists():raise
            self.projection_warning='Saved to the journal; search update is pending while another reader finishes.'

    @property
    def database(self):
        # Older vault processes may still own schema 4. Never replace their file.
        return self.root/PROJECTION_FILENAME

    def _project(self, rebuild=False):
        database=self.database
        if database.exists() and not rebuild:
            db=sqlite3.connect(database,timeout=0.2)
            try:
                meta=dict(db.execute("SELECT key,value FROM meta"))
                sequence=int(meta.get('sequence',-1))
                projected_head=(self.head if sequence==self.sequence else digest(self.records[sequence]) if sequence in self.records else '') if sequence else ''
                if (0<=sequence<=self.sequence and meta.get('profile')==self.config['id']
                    and meta.get('epoch')==self.config['epoch'] and meta.get('head')==projected_head and meta.get('schema')=='5'
                    and meta.get('search_projection')==str(search_projection.SCHEMA)):
                    with db:
                        changed_entries=set();changed_documents=set()
                        for n in range(sequence+1,self.sequence+1):
                            record=self.records[n]
                            for change in record['changes']:
                                e=change['after'];entry_id=(e or change['before'])['id']
                                changed_entries.add(entry_id)
                                for version in (change['before'],e):
                                    if version:changed_documents.add(version['home']['documentId'])
                                db.execute('DELETE FROM search WHERE rowid=(SELECT rowid FROM entries WHERE id=?)',(entry_id,))
                                db.execute('DELETE FROM entries WHERE id=?',(entry_id,));db.execute('DELETE FROM cleanup WHERE entry_id=?',(entry_id,))
                                if e:self.index_entry(db,e)
                        if changed_entries:
                            for document_id in changed_documents:
                                db.execute('DELETE FROM documents WHERE id=? AND NOT EXISTS (SELECT 1 FROM entries WHERE document_id=?)',(document_id,document_id))
                            self.projection_work=search_projection.refresh(db,changed_entries,changed_documents)
                        db.execute("UPDATE meta SET value=? WHERE key='sequence'",(str(self.sequence),))
                        db.execute("UPDATE meta SET value=? WHERE key='head'",(self.head or '',))
                    self.projection_warning=None
                    return
            except sqlite3.DatabaseError as exc:
                if projection_busy(exc):raise
                pass  # Projection is disposable; rebuild it from the verified journal.
            finally:db.close()
        # Replace the derived database only after a successful transaction.
        temp=self.root/('search-'+str(uuid.uuid4())+'.tmp')
        db=sqlite3.connect(temp)
        try:
            db.executescript('''CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);
                CREATE TABLE documents(id TEXT PRIMARY KEY,vault TEXT,path TEXT,role TEXT);
                CREATE TABLE entries(id TEXT PRIMARY KEY,document_id TEXT,revision INTEGER,kind TEXT,title TEXT,body TEXT,status TEXT,parent TEXT,line_start INTEGER,body_sha256 TEXT,context_before TEXT,context_after TEXT,copy_body_hash TEXT,parent_body_hash TEXT);
                CREATE TABLE cleanup(entry_id TEXT PRIMARY KEY,disposition TEXT,reasons TEXT);
                CREATE VIRTUAL TABLE search USING fts5(entry_id UNINDEXED,title,body,context,math);
            ''')
            db.executemany('INSERT INTO meta VALUES(?,?)',[('sequence',str(self.sequence)),('head',self.head or ''),('schema','5'),('search_projection',str(search_projection.SCHEMA)),('mode','TEST_REVIEWED' if self.config['mode']=='TEST' else 'REVIEWED'),('production_approvals','0'),('profile',self.config['id']),('epoch',self.config['epoch'])])
            for e in self.entries.values():self.index_entry(db,e)
            self.projection_work=search_projection.rebuild(db)
            db.commit()
        finally:db.close()
        os.replace(temp,database)
        self.projection_warning=None

    def index_entry(self, db, e):
        home=e['home'];context=e.get('context',{})
        vault=home.get('vaultId',home['vault']) if self.config['mode']=='PRODUCTION' else home['vault']
        db.execute('INSERT OR REPLACE INTO documents VALUES(?,?,?,?)',(home['documentId'],vault,home['path'],'working'))
        db.execute('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(e['id'],home['documentId'],e['revision'],e['kind'],e['title'],e['body'],e.get('status','current'),e.get('parent'),home.get('line',1),hashlib.sha256(e['body'].encode()).hexdigest(),context.get('before',''),context.get('after',''),e.get('copyBodyHash'),e.get('parentBodyHash')))
        db.execute('INSERT INTO cleanup VALUES(?,?,?)',(e['id'],'deleted' if e.get('status')=='deleted' else 'unadmitted' if e.get('admission')=='pending-variant' else 'candidate','[]'))
        rowid=db.execute('SELECT rowid FROM entries WHERE id=?',(e['id'],)).fetchone()[0]
        db.execute('INSERT INTO search(rowid,entry_id,title,body,context,math) VALUES(?,?,?,?,?,?)',(rowid,e['id'],e['title'],e['body'],context.get('before','')+context.get('after',''),math_search(e['body'])))

    def commit(self, *, profile, epoch, key, actor, changes, operation='update', undo_target=None):
        self.guard(profile,epoch)
        if not isinstance(key,str) or not key or len(key)>200:raise ValueError('An idempotency key is required.')
        if not actor or not changes:raise ValueError('Actor and at least one change are required.')
        intent=digest({'actor':actor,'changes':changes,'operation':operation,'undoTarget':undo_target})
        with self.lock():
            self.load()
            if key in self.receipts:
                receipt=self.receipts[key]
                if receipt['intent']!=intent:raise Conflict('Idempotency key was already used for different changes.')
                self.project_or_defer();return self.receipt(receipt)
            seen=set();applied=[]
            for change in changes:
                entry_id=change['id']
                if entry_id in seen:raise Conflict('An entry occurs twice in this batch.')
                seen.add(entry_id);before=self.entries.get(entry_id)
                expected=change['expectedRevision']
                if self.clocks.get(entry_id,0)!=expected:raise Conflict('Entry revision changed: '+entry_id)
                after=change.get('entry')
                if after is not None:
                    after=json.loads(json.dumps(after));after['id']=entry_id;after['revision']=expected+1
                    if not after.get('body') or not after.get('kind') or not after.get('title'):raise ValueError('Entry text, kind and title are required.')
                    home=after.get('home',{})
                    if not all(home.get(k) for k in ('vault','path','documentId','occurrenceId')):raise ValueError('An entry requires a complete owning occurrence.')
                    if before and before['home']['occurrenceId']!=home['occurrenceId'] and operation not in ('replace-source','undo'):
                        raise Conflict('Moving an owning occurrence requires replace-source.')
                    if after.get('parent')==entry_id:raise Conflict('An entry cannot be its own parent.')
                    if after.get('parent') and after['parent'] not in self.entries:raise Conflict('Parent entry is unavailable.')
                applied.append({'before':before,'after':after})
            self.validate_ownership(applied)
            # Commit unit is the portable library transaction. This never claims source-file atomicity.
            record={'sequence':self.sequence+1,'previous':self.head,'key':key,'intent':intent,'actor':actor,'operation':operation,'undoTarget':undo_target,
                    'at':datetime.now(timezone.utc).isoformat(),'changes':applied}
            signature=digest(record)
            atomic_json(self.transactions/f'{record["sequence"]:010d}.json',{**record,'checksum':signature})
            self.load()
            self.try_backup()
            # A projection failure leaves a durable receipt and is recovered on restart/retry.
            self.project_or_defer()
            try:self.checkpoint()
            except OSError:pass  # Disposable acceleration must not fail a durable commit.
            return self.receipt(record)

    def backup(self):
        """Verified separate file copies; an optional backupRoot may be outside the library."""
        with self.lock():
            if self.fault:return
            destination=Path(self.config.get('backupRoot',self.root/'backups'/'verified'));(destination/'transactions').mkdir(parents=True,exist_ok=True)
            if not (destination/'library.json').exists():atomic_json(destination/'library.json',self.config)
            if not hasattr(self,'backed_up_sequence'):
                receipt=json.loads((destination/'receipt.json').read_text()) if (destination/'receipt.json').exists() else {}
                self.backed_up_sequence=receipt.get('sequence',0) if receipt.get('profile')==self.config['id'] else 0
            for n in range(self.backed_up_sequence+1,self.sequence+1):
                record=self.records[n]
                target=destination/'transactions'/f'{record["sequence"]:010d}.json'
                signature=digest(record)
                if not target.exists():atomic_json(target,{**record,'checksum':signature})
                copied=json.loads(target.read_text());actual=copied.pop('checksum')
                if actual!=digest(copied) or actual!=signature:raise Conflict('Backup verification failed.')
            registry=self.root/'vaults.json'
            metadata={'vaults':json.loads(registry.read_text()) if registry.exists() else {},
                      'plans':{str(p.relative_to(self.root)):json.loads(p.read_text()) for p in (self.root/'plans').rglob('*.json') if 'archive' not in p.parts}}
            stamp=digest(metadata);folder=destination/'metadata';folder.mkdir(exist_ok=True)
            if not (folder/(stamp+'.json')).exists():atomic_json(folder/(stamp+'.json'),metadata)
            atomic_json(destination/'receipt.json',{'sequence':self.sequence,'head':self.head,'profile':self.config['id'],'metadata':stamp})
            self.backed_up_sequence=self.sequence

    def try_backup(self):
        try:self.backup();self.backup_warning=None
        except (OSError,Conflict,ValueError) as exc:self.backup_warning='Backup needs attention: '+str(exc)

    def receipt(self, record):
        result={'key':record['key'],'sequence':record['sequence'],'operation':record['operation'],
                'entries':[{'id':(c['after'] or c['before'])['id'],'revision':c['after']['revision'] if c['after'] else None} for c in record['changes']],
                'atomicity':'library transaction; source writes are separate guarded adapter operations'}
        if getattr(self,'projection_warning',None):result['warning']=self.projection_warning
        return result

    def undo(self, *, profile, epoch, key, target, actor):
        # Read the latest durable state; commit performs another guarded revision check.
        with self.lock():self.load()
        self.guard(profile,epoch)
        if key in self.receipts:
            receipt=self.receipts[key]
            if receipt.get('undoTarget')!=target or receipt['actor']!=actor:raise Conflict('Undo key was already used.')
            return self.receipt(receipt)
        if target not in self.receipts:raise ValueError('Unknown receipt.')
        receipt=self.receipts[target];changes=[]
        for c in receipt['changes']:
            current=c['after'];entry_id=(current or c['before'])['id']
            if self.entries.get(entry_id)!=current:raise Conflict('Undo would overwrite a later edit: '+entry_id)
            changes.append({'id':entry_id,'expectedRevision':self.clocks.get(entry_id,0),'entry':c['before']})
        return self.commit(profile=profile,epoch=epoch,key=key,actor=actor,changes=changes,operation='undo',undo_target=target)

    def search(self, expression, limit=30):
        self.project_or_defer()
        db=sqlite3.connect(f'file:{self.database}?mode=ro',uri=True);db.row_factory=sqlite3.Row
        try:
            if expression:
                return [dict(r) for r in db.execute('SELECT e.*,d.vault,d.path FROM entries e JOIN documents d ON e.document_id=d.id JOIN search s ON e.rowid=s.rowid WHERE search MATCH ? ORDER BY bm25(search) LIMIT ?', (expression,limit))]
            return [dict(r) for r in db.execute('SELECT e.*,d.vault,d.path FROM entries e JOIN documents d ON e.document_id=d.id ORDER BY e.title LIMIT ?', (limit,))]
        finally:db.close()
