"""Machine-local document ownership, independent of knowledge-library admission.

Claims come from one complete metadata-cache snapshot, then changed paths only.
No note content is read or written here. Conflicting claims never pick a winner.
"""
import sqlite3
import hashlib
import json
from pathlib import PurePosixPath
from document_numbers import BLOCK_ID

MISSING=object()


class DocumentRegistry:
    def __init__(self, database):
        self.ready=False
        self.db=sqlite3.connect(str(database))
        self.db.row_factory=sqlite3.Row
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS claims(path TEXT PRIMARY KEY, id TEXT, excluded INTEGER NOT NULL);
          CREATE INDEX IF NOT EXISTS claims_id ON claims(id);
          CREATE TABLE IF NOT EXISTS owners(id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE);
          CREATE TABLE IF NOT EXISTS template_ids(id TEXT PRIMARY KEY);
          CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
          INSERT OR IGNORE INTO meta VALUES('generation',0);
          INSERT OR IGNORE INTO meta VALUES('ready',0);
        ''')
        for table,column,definition in [('claims','first_seen','INTEGER NOT NULL DEFAULT 0'),('claims','known','INTEGER NOT NULL DEFAULT 1'),('owners','removed','INTEGER')]:
            if column not in {r[1] for r in self.db.execute('PRAGMA table_info('+table+')')}:
                self.db.execute('ALTER TABLE '+table+' ADD COLUMN '+column+' '+definition)
        self.db.commit()

    def close(self):self.db.close()

    @staticmethod
    def record(record):
        path=record['path'];identity=record.get('documentId');excluded=bool(record.get('excluded'))
        if not isinstance(path,str) or '\\' in path or PurePosixPath(path).is_absolute() or '..' in PurePosixPath(path).parts or not path.endswith('.md'):
            raise ValueError('Expected a vault-relative Markdown path')
        if identity is not None and (not isinstance(identity,str) or identity=='lib' or not BLOCK_ID.fullmatch(identity)):
            raise ValueError('Invalid document identity')
        return path,identity,int(excluded)

    @property
    def generation(self):return self.db.execute("SELECT value FROM meta WHERE key='generation'").fetchone()[0]

    def _tick(self):self.db.execute("UPDATE meta SET value=value+1 WHERE key='generation'")

    def guard(self,expected):
        if expected is not None and expected!=self.generation:raise ValueError('Document registry changed; refresh the reference plan')

    def _reconcile(self,identities):
        for identity in identities:
            if not identity:continue
            if self.db.execute('SELECT 1 FROM claims WHERE id=? AND excluded=1',(identity,)).fetchone():
                self.db.execute('INSERT OR IGNORE INTO template_ids VALUES(?)',(identity,))
            if self.db.execute('SELECT 1 FROM template_ids WHERE id=?',(identity,)).fetchone():
                self.db.execute('DELETE FROM owners WHERE id=?',(identity,));continue
            owner=self.db.execute('SELECT path,removed FROM owners WHERE id=?',(identity,)).fetchone()
            owner_claim=self.db.execute('SELECT excluded FROM claims WHERE path=?',(owner['path'],)).fetchone() if owner else None
            if owner and not owner_claim and owner['removed'] is None:
                self.db.execute('UPDATE owners SET removed=? WHERE id=?',(self.generation+1,identity))
                owner={**dict(owner),'removed':self.generation+1}
            if owner_claim and not owner_claim['excluded']:
                self.db.execute('UPDATE owners SET removed=NULL WHERE id=?',(identity,));continue
            if owner_claim and owner_claim['excluded']:self.db.execute('DELETE FROM owners WHERE id=?',(identity,))
            claims=self.db.execute('SELECT path,first_seen FROM claims WHERE id=? AND excluded=0 AND known=1 LIMIT 2',(identity,)).fetchall()
            if len(claims)!=1:continue
            path=claims[0]['path']
            # An already-known copy must not inherit an identity after deletion.
            # A later cache event from a Git move may arrive after its deletion.
            if owner and (owner['removed'] is None or claims[0]['first_seen']<owner['removed']):continue
            # A manually changed ID must not steal a path reserved to another ID.
            reserved=self.db.execute('SELECT id FROM owners WHERE path=?',(path,)).fetchone()
            if reserved and reserved['id']!=identity:continue
            self.db.execute('INSERT INTO owners(id,path,removed) VALUES(?,?,NULL) ON CONFLICT(id) DO UPDATE SET path=excluded.path,removed=NULL',(identity,path))

    def snapshot(self,records,expected=None,unknown=()):
        normalized=[self.record(r) for r in records]
        unknown=[self.record({'path':p})[0] for p in unknown]
        paths=[r[0] for r in normalized]+unknown
        if len(set(paths))!=len(paths):raise ValueError('Duplicate paths in metadata snapshot')
        with self.db:
            self.db.execute('BEGIN IMMEDIATE');self.guard(expected)
            previous={r['path']:dict(r) for r in self.db.execute('SELECT * FROM claims')}
            rows=[]
            for path,identity,excluded in normalized:
                old=previous.get(path)
                first=old['first_seen'] if old else self.generation+1
                rows.append((path,identity,excluded,first,1))
            for path in unknown:
                old=previous.get(path,{})
                rows.append((path,old.get('id'),old.get('excluded',0),old.get('first_seen',self.generation+1),0))
            changed={tuple(r[k] for k in ('path','id','excluded','first_seen','known')) for r in previous.values()}!=set(rows)
            self.db.execute('DELETE FROM claims')
            self.db.executemany('INSERT INTO claims(path,id,excluded,first_seen,known) VALUES(?,?,?,?,?)',rows)
            self._reconcile({r[1] for r in rows}|{r[0] for r in self.db.execute('SELECT id FROM owners')})
            if changed:self._tick()
            self.db.execute("UPDATE meta SET value=1 WHERE key='ready'")
        self.ready=True
        return {'generation':self.generation,'count':len(rows),'unknown':len(unknown)}

    def update(self,records=(),deleted=(),expected=None):
        if not self.ready:raise ValueError('Metadata snapshot must finish before updating identities')
        normalized=[self.record(r) for r in records]
        paths={r[0] for r in normalized}|set(deleted);affected=set();changed=False
        with self.db:
            self.db.execute('BEGIN IMMEDIATE');self.guard(expected)
            for path in paths:
                row=self.db.execute('SELECT id FROM claims WHERE path=?',(path,)).fetchone()
                if row:affected.add(row['id'])
                owner=self.db.execute('SELECT id FROM owners WHERE path=?',(path,)).fetchone()
                if owner:affected.add(owner['id'])
            for path in deleted:
                changed=bool(self.db.execute('DELETE FROM claims WHERE path=?',(path,)).rowcount) or changed
            for row in normalized:
                old=self.db.execute('SELECT * FROM claims WHERE path=?',(row[0],)).fetchone()
                if old is None or tuple(old[k] for k in ('path','id','excluded'))!=row or not old['known']:
                    first=old['first_seen'] if old else self.generation+1
                    self.db.execute('INSERT OR REPLACE INTO claims(path,id,excluded,first_seen,known) VALUES(?,?,?,?,1)',(*row,first));changed=True
                affected.add(row[1])
            self._reconcile(affected)
            if changed:self._tick()
        return {'generation':self.generation}

    def rename(self,old,new,expected=None):
        """Apply an observed file/folder rename atomically, including descendants."""
        if not self.ready:raise ValueError('Metadata snapshot must finish before renaming identities')
        self.guard(expected)
        if old==new:return {'generation':self.generation}
        if old.endswith('.md') and not new.endswith('.md'):return self.update(deleted=[old],expected=expected)
        def moved(path):return new+path[len(old):] if path==old or path.startswith(old+'/') else None
        with self.db:
            self.db.execute('BEGIN IMMEDIATE');self.guard(expected)
            # Primary-key ranges cover only the renamed file or folder descendants.
            args=(old,old+'/',old+'0')
            claims=[(dict(row),moved(row['path'])) for row in self.db.execute('SELECT * FROM claims WHERE path=? OR (path>=? AND path<?)',args)]
            owners=[(dict(row),moved(row['path'])) for row in self.db.execute('SELECT * FROM owners WHERE path=? OR (path>=? AND path<?)',args)]
            claims=[(r,p) for r,p in claims if p is not None];owners=[(r,p) for r,p in owners if p is not None]
            if not claims and not owners:return {'generation':self.generation}
            oldpaths={r['path'] for r,_ in claims}
            for row,path in claims:
                self.record({'path':path})
                other=self.db.execute('SELECT id,excluded FROM claims WHERE path=?',(path,)).fetchone()
                if path not in oldpaths and other and (other['id'],other['excluded'])!=(row['id'],row['excluded']):raise ValueError('Rename destination already belongs to another note')
                other_owner=self.db.execute('SELECT id FROM owners WHERE path=?',(path,)).fetchone()
                if other_owner and other_owner['id']!=row['id']:raise ValueError('Rename destination has a different reserved identity')
            for row,_ in claims:self.db.execute('DELETE FROM claims WHERE path=?',(row['path'],))
            for row,_ in owners:self.db.execute('DELETE FROM owners WHERE id=?',(row['id'],))
            for row,path in claims:self.db.execute('INSERT OR REPLACE INTO claims(path,id,excluded,first_seen,known) VALUES(?,?,?,?,?)',(path,row['id'],row['excluded'],row['first_seen'],row['known']))
            for row,path in owners:self.db.execute('INSERT INTO owners(id,path,removed) VALUES(?,?,NULL)',(row['id'],path))
            self._tick()
        return {'generation':self.generation}

    def _inspect(self,path,claim_override=MISSING):
        result={'path':path,'generation':self.generation}
        if not self.ready:return {**result,'status':'uninitialized'}
        claim=self.db.execute('SELECT id,excluded,known FROM claims WHERE path=?',(path,)).fetchone()
        if not claim:return {**result,'status':'missing'}
        if claim_override is not MISSING:
            self.record({'path':path,'documentId':claim_override})
            claim={**dict(claim),'id':claim_override,'known':1}
            result['claimOverride']=claim_override
        if not claim['known']:return {**result,'status':'unknown','documentId':claim['id']}
        identity=claim['id'];reserved=self.db.execute('SELECT id FROM owners WHERE path=?',(path,)).fetchone()
        if claim['excluded']:return {**result,'status':'template','documentId':identity}
        if identity and self.db.execute('SELECT 1 FROM template_ids WHERE id=?',(identity,)).fetchone():return {**result,'status':'template-copy','documentId':identity}
        if reserved and identity!=reserved['id']:
            return {**result,'status':'restore' if identity is None else 'conflict','documentId':reserved['id'],'claimedId':identity}
        if not identity:return {**result,'status':'new','documentId':None}
        owner=self.db.execute('SELECT path FROM owners WHERE id=?',(identity,)).fetchone()
        if owner and owner['path']==path:return {**result,'status':'owned','documentId':identity,'ownerPath':path}
        if owner and self.db.execute('SELECT 1 FROM claims WHERE path=?',(owner['path'],)).fetchone():
            return {**result,'status':'copy','documentId':identity,'ownerPath':owner['path']}
        claimants=[r[0] for r in self.db.execute('SELECT path FROM claims WHERE id=? AND excluded=0 AND path!=? ORDER BY path LIMIT 100',(identity,path))]
        status='orphaned' if owner else ('pending' if claim_override is not MISSING and not claimants else 'ambiguous')
        return {**result,'status':status,'documentId':identity,'claimants':claimants}

    def inspect(self,path,claim_override=MISSING):
        result=self._inspect(path,claim_override)
        dependencies={k:v for k,v in result.items() if k!='generation'}
        if result.get('ownerPath'):
            row=self.db.execute('SELECT id,excluded FROM claims WHERE path=?',(result['ownerPath'],)).fetchone()
            dependencies['ownerClaim']=dict(row) if row else None
        result['dependencyToken']=hashlib.sha256(json.dumps(dependencies,sort_keys=True).encode()).hexdigest()
        return result

    def owner(self,identity):
        """Return only the currently verified owner; never promote a copy."""
        row=self.db.execute('SELECT path FROM owners WHERE id=?',(identity,)).fetchone()
        if not row:return None
        state=self.inspect(row['path'])
        return row['path'] if state['status']=='owned' and state.get('documentId')==identity else None

    def guard_context(self,context):
        if self.inspect(context['path'],context.get('claimOverride',MISSING))['dependencyToken']!=context.get('dependencyToken'):
            raise ValueError('Reference identity changed; refresh the reference plan')
