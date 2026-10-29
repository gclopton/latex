"""Portable library: the entries journal plus a disposable SQLite search projection.

B4 format: every Mac appends immutable events to its own chain under
journals/entries/ (see journal.py). Entries and occurrence ownership claims are
objects with explicit parent revisions; concurrent changes leave competing
heads that are flagged, never silently resolved. This module never writes
source notes. The live Obsidian adapter owns text edits. Every mutation is
profile/epoch/format guarded, revision checked and journaled.
"""
import fcntl
import hashlib
import json
import os
import shutil
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
# The on-disk mode is a discriminator: the retired single-writer constructor
# accepts only 'TEST' or 'PRODUCTION' and therefore refuses these stores.
FORMAT='kl-b4/1'
STORE_MODES={'TEST':'B4-TEST','PRODUCTION':'B4-PRODUCTION'}
RETIRED_MODE='RETIRED-SINGLE-WRITER'
ENTRY='entry:'
CLAIM='claim:'
CHECKPOINT_INTERVAL=128


def projection_busy(error):
    return isinstance(error,sqlite3.OperationalError) and any(word in str(error).lower() for word in ('locked','busy'))


def retire_root(root,successor=None):
    """Fence a retired single-writer root: both the old and the new constructor refuse it."""
    root=Path(root)
    current=json.loads((root/'library.json').read_text())
    atomic_json(root/'library.json',{'mode':RETIRED_MODE,'retired':current,'successor':str(successor) if successor else None,
                                     'at':datetime.now(timezone.utc).isoformat()})


class PortableLibrary:
    def __init__(self, root, allow_readonly=False, mode='TEST', reader=False, writer=None, create=True):
        # A reader host only reads a store published by the writers. It never
        # creates, repairs, backs up or appends to the shared journals; the
        # SQLite projection, writer.lock and local/ are host-local files.
        if mode not in STORE_MODES:raise ValueError('Library mode does not match the requested collection.')
        self.reader=bool(reader);self.collection=mode;self.writer_override=writer
        self.root=Path(root).resolve()
        self.config_path=self.root/'library.json'
        if self.reader:
            if not self.config_path.is_file():
                raise Conflict('Reader host: the library store from the writer Mac is not available yet.')
        elif not create and not self.config_path.is_file():
            # A production writer never mints a new library at a missing or
            # mistyped root: a new id would end up in synced vault markers.
            raise Conflict('No library store at '+str(self.root)+'; create it with migrate_b4.py or an explicit initialisation.')
        else:
            self.root.mkdir(parents=True,exist_ok=True)
        with self.lock():
            if not self.config_path.exists():
                atomic_json(self.config_path,{'mode':STORE_MODES[mode],'format':FORMAT,'id':str(uuid.uuid4()),'epoch':str(uuid.uuid4()),'version':2})
            self.config=self.read_config()
            self.local_config=self.read_local_config()
            self.fault=None
            self._reset_state()
            try:self.load()
            except Conflict as exc:
                if not allow_readonly:raise
                self.fault=str(exc)
            self.project_or_defer()
            if not self.fault and not self.reader:self.try_backup()

    def read_config(self):
        config=json.loads(self.config_path.read_text())
        if config.get('mode')==RETIRED_MODE:raise Conflict('This library root is retired. Use its successor store.')
        if config.get('mode') in STORE_MODES and config.get('format') is None:
            raise Conflict('This library uses the retired single-writer format; import it with migrate_b4.py first.')
        if config.get('mode')!=STORE_MODES[self.collection] or config.get('format')!=FORMAT:
            raise ValueError('Library mode does not match the requested collection.')
        return config

    def revalidate(self):
        """Every mutation re-reads the shared config: a changed id, epoch or format stops it."""
        current=self.read_config()
        if any(current.get(k)!=self.config.get(k) for k in ('id','epoch','mode','format')):
            raise Conflict('Library profile, epoch or format changed. Refresh before writing.')

    def read_local_config(self):
        """Host-local overrides (for example backupRoot); never shared between Macs."""
        path=self.root/'library.local.json'
        try:value=json.loads(path.read_text())
        except FileNotFoundError:return {}
        if not isinstance(value,dict):raise ValueError('library.local.json must contain an object.')
        return value

    def require_writer(self,action):
        if self.reader:
            from host_role import ReaderHost
            raise ReaderHost(action)

    @property
    def transactions(self):return self.root/'journals'/'entries'

    def _reset_state(self,use_checkpoint=True):
        from journal import JournalSet
        self.entries={};self.receipts={};self.sequence=0;self.head=None;self.history={};self.clocks={};self.owners={}
        self.records={};self.receipt_records={};self.paths_by_vault={};self.documents_by_path={};self.incomplete=None
        self.journals=JournalSet(self.root,self.config['id'],self.config['epoch'],writer=self.writer_override,reader=self.reader,local=self.root/'local')
        self.journal=self.journals.journals['entries'];self.component_journal=self.journals.journals['components']
        self.journals.ready=self.assets_ready;self._verified_assets=set()
        self.journal.listeners.append(self._on_event)
        if not use_checkpoint:return
        restored=self.journals.restore_checkpoint()
        if restored:self.checkpoint_sequence=len(self.journals.order)
        elif restored is None:self._reset_state(False) # a damaged cache never leaves half-built state

    def assets_ready(self,event):
        """Content-addressed image assets travel separately; an event waits until they arrive intact."""
        for spec in event['objects'].values():
            value=spec.get('value')
            for image in (value.get('images') or []) if isinstance(value,dict) else []:
                sha=image.get('sha256') if isinstance(image,dict) else None;ext=image.get('extension','') if isinstance(image,dict) else ''
                if not isinstance(sha,str) or len(sha)!=64:continue
                name=sha+ext
                if name in self._verified_assets:continue
                try:data=(self.root/'assets'/name).read_bytes()
                except OSError:return False
                if hashlib.sha256(data).hexdigest()!=sha:return False # still arriving (or damaged)
                self._verified_assets.add(name)
        return True

    @property
    def writer(self):return self.journals.writer

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
        """Fold newly arrived events of both journals (they may depend on each other)."""
        if getattr(self,'fault',None):return
        from journal import JournalFault
        try:self.journals.refresh()
        except JournalFault as error:
            raise Conflict('Index journal integrity failed: '+str(error)+' No further writes are allowed.') from error
        pending=len(self.journals.pending)
        self.incomplete=('Waiting for '+str(pending)+' index journal events still arriving or missing a dependency') if pending else None

    # ----- folding events into the legacy-compatible view ------------------
    def display(self,entry_id):
        """Current entry, flagged when versions or ownership claims compete."""
        value,heads=self.journal.state(ENTRY+entry_id)
        if not heads:return None
        if len(heads)==1:
            return None if value.get('deleted') else value
        versions=[self.journal.revisions[h]['value'] for h in heads]
        live=[v for v in versions if not v.get('deleted')]
        if not live:return None
        primary=json.loads(json.dumps(live[-1]))
        primary['competing']=[{'revisionId':h,'writer':self.journal.revisions[h]['writer'],'deleted':bool(v.get('deleted')),'revision':v.get('revision'),'title':v.get('title')} for h,v in zip(heads,versions)]
        return primary

    def claim(self,occurrence):
        value,heads=self.journal.state(CLAIM+occurrence)
        return value,heads

    def _with_claim_flag(self,entry):
        if entry is None:return None
        value,heads=self.claim(entry['home']['occurrenceId'])
        if len(heads)>1:
            entry=json.loads(json.dumps(entry))
            entry['ownershipConflict']=sorted({self.journal.revisions[h]['value'] for h in heads if self.journal.revisions[h]['value']})
        return entry

    def _on_event(self,event,changed):
        touched=set()
        for obj in changed:
            if obj.startswith(ENTRY):touched.add(obj[len(ENTRY):])
            elif obj.startswith(CLAIM):
                value,heads=self.claim(obj[len(CLAIM):])
                touched.update(self.journal.revisions[h]['value'] for h in heads if self.journal.revisions[h]['value'])
                for revision in event['objects'][obj]['parents']:
                    if self.journal.revisions[revision]['value']:touched.add(self.journal.revisions[revision]['value'])
        changes=[]
        for entry_id in sorted(touched):
            before=self.entries.get(entry_id);after=self._with_claim_flag(self.display(entry_id))
            if before==after:continue
            if before:
                self._count_home(before,-1)
                if self.owners.get(before['home']['occurrenceId'])==entry_id:self.owners.pop(before['home']['occurrenceId'],None)
            if after is None:self.entries.pop(entry_id,None)
            else:
                self._count_home(after,1);self.entries[entry_id]=after
                owner,heads=self.claim(after['home']['occurrenceId'])
                self.owners[after['home']['occurrenceId']]=owner if owner else entry_id
            value,heads=self.journal.state(ENTRY+entry_id)
            self.clocks[entry_id]=max(self.journal.revisions[h]['value'].get('revision',0) for h in heads) if heads else 0
            changes.append({'before':before,'after':after})
        payload=event.get('payload') or {}
        record={'sequence':self.sequence+1,'previous':self.head,'key':event['key'],'intent':event['intent'],'actor':payload.get('actor'),
                'operation':payload.get('operation','update'),'undoTarget':payload.get('undoTarget'),'at':event['at'],'changes':changes,
                'event':event['hash'],'writer':event['writer']}
        for change in changes:
            entry_id=(change['after'] or change['before'])['id']
            self.history.setdefault(entry_id,[]).append({'sequence':record['sequence'],'revision':change['after'],'actor':record['actor'],'at':record['at'],'writer':event['writer']})
        self.sequence=record['sequence'];self.head=digest(record);self.records[self.sequence]=record
        if event['hash'] not in self.journal.voided:
            self.receipts.setdefault(event['key'],record);self.receipt_records[event['hash']]=record

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

    def conflicts(self):
        """Objects with competing heads, and idempotency keys reused for different intents."""
        objects=sorted(obj for obj,heads in self.journal.heads.items() if len(heads)>1)
        return {'objects':objects,'keys':sorted(self.journal.key_conflicts|self.component_journal.key_conflicts),
                'components':sorted(obj for obj,heads in self.component_journal.heads.items() if len(heads)>1)}

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

    def checkpoint(self):
        """Host-local, validated replay cache; any change of the event inventory invalidates it."""
        total=len(self.journals.order)
        if self.reader or self.fault or total-getattr(self,'checkpoint_sequence',0)<CHECKPOINT_INTERVAL:return
        if self.journals.save_checkpoint():self.checkpoint_sequence=total

    def validate_ownership(self, objects, touched):
        """A batch may not claim an occurrence owned by another, untouched entry."""
        for obj,spec in objects.items():
            if not obj.startswith(CLAIM) or spec['value'] is None:continue
            value,heads=self.claim(obj[len(CLAIM):])
            if len(heads)>1:raise Conflict('Competing ownership claims for this occurrence; resolve them first: '+obj[len(CLAIM):])
            if value and value!=spec['value'] and value not in touched:
                raise Conflict('Duplicate owning occurrence; restore a verified journal backup if this occurs during replay: '+obj[len(CLAIM):])

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
            db.executemany('INSERT INTO meta VALUES(?,?)',[('sequence',str(self.sequence)),('head',self.head or ''),('schema','5'),('search_projection',str(search_projection.SCHEMA)),('mode','TEST_REVIEWED' if self.collection=='TEST' else 'REVIEWED'),('production_approvals','0'),('profile',self.config['id']),('epoch',self.config['epoch'])])
            for e in self.entries.values():self.index_entry(db,e)
            self.projection_work=search_projection.rebuild(db)
            db.commit()
        finally:db.close()
        os.replace(temp,database)
        self.projection_warning=None

    def index_entry(self, db, e):
        home=e['home'];context=e.get('context',{})
        vault=home.get('vaultId',home['vault']) if self.collection=='PRODUCTION' else home['vault']
        db.execute('INSERT OR REPLACE INTO documents VALUES(?,?,?,?)',(home['documentId'],vault,home['path'],'working'))
        db.execute('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(e['id'],home['documentId'],e['revision'],e['kind'],e['title'],e['body'],e.get('status','current'),e.get('parent'),home.get('line',1),hashlib.sha256(e['body'].encode()).hexdigest(),context.get('before',''),context.get('after',''),e.get('copyBodyHash'),e.get('parentBodyHash')))
        db.execute('INSERT INTO cleanup VALUES(?,?,?)',(e['id'],'deleted' if e.get('status')=='deleted' else 'unadmitted' if e.get('admission')=='pending-variant' else 'candidate','[]'))
        rowid=db.execute('SELECT rowid FROM entries WHERE id=?',(e['id'],)).fetchone()[0]
        db.execute('INSERT INTO search(rowid,entry_id,title,body,context,math) VALUES(?,?,?,?,?,?)',(rowid,e['id'],e['title'],e['body'],context.get('before','')+context.get('after',''),math_search(e['body'])))

    def commit(self, *, profile, epoch, key, actor, changes, operation='update', undo_target=None, provenance=None, group=None, dependencies=()):
        self.require_writer('Saving an index change')
        self.guard(profile,epoch)
        if not isinstance(key,str) or not key or len(key)>200:raise ValueError('An idempotency key is required.')
        if not actor or not changes:raise ValueError('Actor and at least one change are required.')
        intent=digest({'actor':actor,'changes':changes,'operation':operation,'undoTarget':undo_target})
        with self.lock():
            self.revalidate();self.load()
            if self.fault:raise Conflict('Library is read-only: '+self.fault)
            # Replay: an applied event (any writer), or a parked part of this same
            # group instance. A parked part of another Mac's instance is not ours.
            known=self.journal.keys.get(key);parked=[e for e in self.journals.parked_events(key=key,instance=(group or {}).get('instance','')) if e['kind']=='entries']
            if known or parked:
                same=self.journal.event_for_key(key,intent)
                if same is None and not any(e['intent']==intent for e in parked):raise Conflict('Idempotency key was already used for different changes.')
                if same is None:return {'key':key,'sequence':self.sequence,'operation':operation,'entries':[],'pending':True,'event':next(e['hash'] for e in parked if e['intent']==intent)}
                self.project_or_defer();return self.receipt(self.receipt_records.get(same) or self.receipts[key])
            seen=set();objects={};claimed={}
            for change in changes:
                entry_id=change['id']
                if entry_id in seen:raise Conflict('An entry occurs twice in this batch.')
                seen.add(entry_id)
            for change in changes:
                entry_id=change['id'];before=self.entries.get(entry_id)
                value,heads=self.journal.state(ENTRY+entry_id)
                # A merge an observation makes from integrated text names exactly the heads it saw.
                if len(heads)>1 and operation!='resolve' and sorted(change.get('mergeHeads') or [])!=sorted(heads):raise Conflict('This entry has competing versions from both Macs; resolve them first: '+entry_id)
                expected=change['expectedRevision']
                if self.clocks.get(entry_id,0)!=expected:raise Conflict('Entry revision changed: '+entry_id)
                after=change.get('entry')
                if after is not None:
                    after=json.loads(json.dumps(after));after['id']=entry_id;after['revision']=expected+1
                    for transient in ('competing','ownershipConflict'):after.pop(transient,None)
                    if not after.get('body') or not after.get('kind') or not after.get('title'):raise ValueError('Entry text, kind and title are required.')
                    home=after.get('home',{})
                    if not all(home.get(k) for k in ('vault','path','documentId','occurrenceId')):raise ValueError('An entry requires a complete owning occurrence.')
                    if before and before['home']['occurrenceId']!=home['occurrenceId'] and operation not in ('replace-source','undo','resolve'):
                        raise Conflict('Moving an owning occurrence requires replace-source.')
                    if after.get('parent')==entry_id:raise Conflict('An entry cannot be its own parent.')
                    if after.get('parent') and after['parent'] not in self.entries:raise Conflict('Parent entry is unavailable.')
                objects[ENTRY+entry_id]={'parents':list(heads),'value':after if after is not None else {'id':entry_id,'deleted':True,'revision':expected+1}}
                old=before['home']['occurrenceId'] if before else None;new=after['home']['occurrenceId'] if after else None
                if old and old!=new:claimed.setdefault(old,None)
                if new:claimed[new]=entry_id
            for occurrence,owner in claimed.items():
                value,heads=self.claim(occurrence)
                if value==owner and len(heads)<=1:continue
                if owner is None and value not in seen:continue # never release another entry's claim
                objects[CLAIM+occurrence]={'parents':list(heads),'value':owner}
            self.validate_ownership(objects,seen)
            from journal import JournalFault
            try:
                written,_=self.journals.append('entries',operation=(group or {}).get('operation') or digest({'key':key,'intent':intent}),key=key,intent=intent,objects=objects,
                                    provenance=provenance,payload={'actor':actor,'operation':operation,'undoTarget':undo_target},group=group,dependencies=dependencies)
                self.load()
            except JournalFault as error:
                self.fault=str(error);raise Conflict('Index journal integrity failed: '+str(error)) from error
            self.try_backup()
            if key not in self.receipts:
                # A part of an operation group: durable, applied when every part is present.
                return {'key':key,'sequence':self.sequence,'operation':operation,'entries':[],'pending':True,'event':written['hash']}
            # A projection failure leaves a durable event and is recovered on restart/retry.
            self.project_or_defer()
            try:self.checkpoint()
            except OSError:pass  # Disposable acceleration must not fail a durable commit.
            return self.receipt(self.receipts[key])

    def resolve(self, *, profile, epoch, key, actor, entry_id, entry, expected_heads):
        """Replace exactly the competing heads the person saw with a chosen version (None deletes).

        If any other version arrived after that choice, nothing is written: a
        later unseen branch is never superseded silently.
        """
        with self.lock():
            self.load()
            value,heads=self.journal.state(ENTRY+entry_id)
            if len(heads)<2:raise Conflict('This entry has no competing versions.')
            if sorted(heads)!=sorted(expected_heads or []):raise Conflict('Another version arrived after this choice; review the current versions again.')
            revision=max(self.journal.revisions[h]['value'].get('revision',0) for h in heads)
            return self.commit(profile=profile,epoch=epoch,key=key,actor=actor,operation='resolve',
                               changes=[{'id':entry_id,'expectedRevision':revision,'entry':entry}])

    def backup(self):
        """Verified copies of the immutable journal events; backupRoot is host-local config."""
        if self.reader:return
        with self.lock():
            if self.fault:return
            local=getattr(self,'local_config',{})
            destination=Path(local.get('backupRoot') or self.config.get('backupRoot') or self.root/'backups'/'verified')
            destination.mkdir(parents=True,exist_ok=True)
            if not (destination/'library.json').exists():atomic_json(destination/'library.json',self.config)
            copied={}
            for journal in self.journals.journals.values():
                for relative in sorted(journal.inventory):
                    if journal.inventory[relative] not in journal.events:continue
                    source=self.root/relative;target=destination/relative
                    if not target.exists():
                        target.parent.mkdir(parents=True,exist_ok=True)
                        temporary=target.with_name('.tmp-'+target.name);shutil.copyfile(source,temporary);os.replace(temporary,target)
                    if target.read_bytes()!=source.read_bytes():raise Conflict('Backup verification failed.')
                    copied[relative]=hashlib.sha256(target.read_bytes()).hexdigest()
            registry=self.root/'vaults.json'
            metadata={'vaults':json.loads(registry.read_text()) if registry.exists() else {},
                      'plans':{str(p.relative_to(self.root)):json.loads(p.read_text()) for p in (self.root/'plans').rglob('*.json') if 'archive' not in p.parts}}
            stamp=digest(metadata);folder=destination/'metadata';folder.mkdir(exist_ok=True)
            if not (folder/(stamp+'.json')).exists():atomic_json(folder/(stamp+'.json'),metadata)
            atomic_json(destination/'receipt.json',{'sequence':self.sequence,'head':self.head,'profile':self.config['id'],'metadata':stamp,'events':copied})

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
        self.require_writer('Undoing an index change')
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
