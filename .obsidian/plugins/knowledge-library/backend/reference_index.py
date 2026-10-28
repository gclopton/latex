"""Rebuildable, machine-local callout/reference dependency projection.

The document registry owns identity resolution. This index never chooses an
owner, modifies Markdown, admits knowledge, or synchronizes its SQLite file.
A changed target queues only documents that reference that target.
"""
import json
import sqlite3
from dataclasses import asdict
from document_registry import DocumentRegistry
from reference_document import catalog
from reference_format import references
from markdown_scan import structure

# Bump when parser, numbering or reference interpretation changes.
FORMAT_VERSION=8


def key(namespace, identity, block=''):
    return json.dumps([namespace,identity,block],separators=(',',':'))


def dependency(path,target):
    if '.' not in target:return key('local',path,target)
    document,block=target.split('.',1)
    if document=='lib':
        from figure_panels import split
        block=split(block)[0]
    return key('library' if document=='lib' else 'document',block if document=='lib' else document,'' if document=='lib' else block)


class ReferenceIndex:
    def __init__(self,database):
        self.db=sqlite3.connect(str(database),timeout=5);self.db.row_factory=sqlite3.Row
        self.db.execute('PRAGMA busy_timeout=5000')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS documents(path TEXT PRIMARY KEY,document_id TEXT,source_hash TEXT NOT NULL,config TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS documents_id ON documents(document_id);
          CREATE TABLE IF NOT EXISTS targets(path TEXT NOT NULL,block TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(path,block));
          CREATE TABLE IF NOT EXISTS occurrences(path TEXT NOT NULL,position INTEGER NOT NULL,line INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(path,position));
          CREATE INDEX IF NOT EXISTS occurrences_line ON occurrences(path,line);
          CREATE TABLE IF NOT EXISTS dependencies(path TEXT NOT NULL,position INTEGER NOT NULL,target_key TEXT NOT NULL,document_id TEXT,data TEXT NOT NULL,PRIMARY KEY(path,position));
          CREATE INDEX IF NOT EXISTS dependencies_target ON dependencies(target_key,path);
          CREATE INDEX IF NOT EXISTS dependencies_document ON dependencies(document_id,path);
          CREATE TABLE IF NOT EXISTS pending(path TEXT PRIMARY KEY,revision INTEGER NOT NULL);
          CREATE INDEX IF NOT EXISTS pending_order ON pending(revision,path);
          CREATE TABLE IF NOT EXISTS diagnostics(path TEXT PRIMARY KEY,source_hash TEXT NOT NULL,data TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS source_state(path TEXT PRIMARY KEY,signature TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS policy_state(path TEXT PRIMARY KEY,book_key TEXT NOT NULL,digest TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS policy_scope ON policy_state(book_key,digest,path);
          CREATE TABLE IF NOT EXISTS index_meta(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
          INSERT OR IGNORE INTO index_meta VALUES('revision',0);
        ''')
        if 'format_version' not in {r[1] for r in self.db.execute('PRAGMA table_info(documents)')}:
            self.db.execute('ALTER TABLE documents ADD COLUMN format_version INTEGER NOT NULL DEFAULT 0')
        self.db.execute('CREATE INDEX IF NOT EXISTS documents_version ON documents(format_version,path)')
        self.db.commit()

    def close(self):self.db.close()

    def component_dependents(self,path,identities):
        """Bounded reverse lookup for a damaged component, not a vault scan."""
        keys=set();document=self.db.execute('SELECT document_id FROM documents WHERE path=?',(path,)).fetchone()
        for identity in identities:
            identity=identity.rsplit('.',1)[0] if identity.endswith(('.local','.library')) else identity
            keys.update((key('library',identity),key('local',path,identity)))
            if document and document['document_id']:keys.add(key('document',document['document_id'],identity))
        result=[]
        for target in keys:
            for row in self.db.execute('SELECT d.path,d.position,d.data,o.line FROM dependencies d LEFT JOIN occurrences o ON o.path=d.path AND o.position=d.position WHERE d.target_key=?',(target,)):
                reference=json.loads(row['data']);result.append({'path':row['path'],'position':row['position'],'line':row['line'],'label':reference['label']})
        return sorted(result,key=lambda r:(r['path'],r['position']))

    def record_signature(self,path,signature,policy=None):
        with self.db:
            self.db.execute('INSERT OR REPLACE INTO source_state VALUES(?,?)',(path,json.dumps(signature)))
            if policy:self.db.execute('INSERT OR REPLACE INTO policy_state VALUES(?,?,?)',(path,policy['bookKey'],policy['policyDigest']))

    def current(self,path,signature,config=None,policy=None):
        row=self.db.execute('SELECT s.signature,d.format_version,d.config FROM source_state s JOIN documents d ON d.path=s.path WHERE s.path=?',(path,)).fetchone()
        if policy:
            saved=self.db.execute('SELECT book_key,digest FROM policy_state WHERE path=?',(path,)).fetchone()
            if not saved or (saved['book_key'],saved['digest'])!=(policy['bookKey'],policy['policyDigest']):return False
        return bool(row and row['format_version']==FORMAT_VERSION and json.loads(row['signature'])==signature and
                    (config is None or row['config']==json.dumps(config,sort_keys=True,separators=(',',':'))))

    @property
    def revision(self):return self.db.execute("SELECT value FROM index_meta WHERE key='revision'").fetchone()[0]

    def _tick(self):
        self.db.execute("UPDATE index_meta SET value=value+1 WHERE key='revision'")
        return self.revision

    def _target_map(self,path):
        doc=self.db.execute('SELECT document_id FROM documents WHERE path=?',(path,)).fetchone()
        return (doc['document_id'] if doc else None),{r['block']:r['data'] for r in self.db.execute('SELECT block,data FROM targets WHERE path=?',(path,))}

    def _wake(self,keys,revision):
        for target in keys:
            self.db.execute('''INSERT INTO pending(path,revision) SELECT DISTINCT path,? FROM dependencies WHERE target_key=?
                ON CONFLICT(path) DO UPDATE SET revision=excluded.revision''',(revision,target))

    @staticmethod
    def _keys(path,document,blocks):
        return {key('local',path,b) for b in blocks}|({key('document',document,b) for b in blocks} if document else set())

    def update(self,path,text,config=None):
        import hashlib
        DocumentRegistry.record({'path':path})
        digest=hashlib.sha256(text.encode()).hexdigest();config_json=json.dumps(config or {},sort_keys=True,separators=(',',':'))
        previous=self.db.execute('SELECT * FROM documents WHERE path=?',(path,)).fetchone()
        if previous and previous['source_hash']==digest and previous['config']==config_json and previous['format_version']==FORMAT_VERSION:
            return {'changed':False,'revision':self.revision,'sourceHash':digest}
        parsed=structure(text);data=catalog(text,path,config=config,parsed=parsed)
        refs=list(references(text,parsed['protected']))
        current={b:json.dumps(row,sort_keys=True,separators=(',',':')) for b,row in data['targets'].items()}
        for issue in data['diagnostics']:
            block=issue.get('blockId')
            if block and block not in data['targets']:
                current[block]=json.dumps({'issue':issue['reason'],'issueCode':issue['code']},sort_keys=True,separators=(',',':'))
        old_id,old=self._target_map(path);new_id=data['documentId']
        changed=set(old)|set(current) if old_id!=new_id else {b for b in old.keys()|current.keys() if old.get(b)!=current.get(b)}
        with self.db:
            revision=self._tick()
            self.db.execute('INSERT OR REPLACE INTO documents VALUES(?,?,?,?,?)',(path,new_id,digest,config_json,FORMAT_VERSION))
            self.db.execute('DELETE FROM targets WHERE path=?',(path,))
            self.db.executemany('INSERT INTO targets VALUES(?,?,?)',[(path,b,row) for b,row in current.items()])
            self.db.execute('DELETE FROM occurrences WHERE path=?',(path,))
            self.db.executemany('INSERT INTO occurrences VALUES(?,?,?,?)',[(path,o['from'],o['line'],json.dumps(o,separators=(',',':'))) for o in data['occurrences']])
            self.db.execute('DELETE FROM dependencies WHERE path=?',(path,))
            self.db.executemany('INSERT INTO dependencies VALUES(?,?,?,?,?)',[(path,r.start,dependency(path,r.target),r.target.split('.',1)[0] if '.' in r.target and not r.target.startswith('lib.') else None,json.dumps(asdict(r))) for r in refs])
            self._wake(self._keys(path,old_id,changed)|self._keys(path,new_id,changed)|{key('library',identity) for raw in [*old.values(),*current.values()] if (identity:=json.loads(raw).get('entityId'))},revision)
            # Revalidate only the changed source, including removal of all links.
            self.db.execute('INSERT OR REPLACE INTO pending VALUES(?,?)',(path,revision))
            self.db.execute('DELETE FROM diagnostics WHERE path=?',(path,))
            self.db.execute('DELETE FROM source_state WHERE path=?',(path,))
            self.db.execute('DELETE FROM policy_state WHERE path=?',(path,))
        return {'changed':True,'revision':revision,'sourceHash':digest,'targetsChanged':len(changed),'diagnostics':data['diagnostics']}

    def remove(self,path):
        DocumentRegistry.record({'path':path});document,targets=self._target_map(path)
        if not self.db.execute('SELECT 1 FROM documents WHERE path=?',(path,)).fetchone():return False
        with self.db:
            revision=self._tick();self._wake(self._keys(path,document,targets)|{key('library',identity) for raw in targets.values() if (identity:=json.loads(raw).get('entityId'))},revision)
            for table in ('documents','targets','occurrences','dependencies','pending','diagnostics','source_state','policy_state'):self.db.execute('DELETE FROM '+table+' WHERE path=?',(path,))
        return True

    def callout_page(self,path,after=-1,limit=256):
        """Bounded saved projection for headings/outline; no source read or parse."""
        DocumentRegistry.record({'path':path})
        if type(after) is not int or after < -1 or type(limit) is not int or not 1<=limit<=256:raise ValueError('Expected source-position cursor and limit 1 through 256')
        doc=self.db.execute('SELECT source_hash,format_version FROM documents WHERE path=?',(path,)).fetchone()
        if not doc or doc['format_version']!=FORMAT_VERSION:return {'path':path,'issueCode':'not-indexed','callouts':[]}
        rows=self.db.execute('SELECT position,data FROM occurrences WHERE path=? AND position>? ORDER BY position LIMIT ?',(path,after,limit+1)).fetchall()
        return {'path':path,'sourceHash':doc['source_hash'],'revision':self.revision,'callouts':[json.loads(r['data']) for r in rows[:limit]],
                'next':rows[limit-1]['position'] if len(rows)>limit else None}

    def callout_lines(self,path,lines):
        DocumentRegistry.record({'path':path})
        if not isinstance(lines,list) or len(lines)>256 or any(type(n) is not int or n<1 for n in lines):raise ValueError('Provide at most 256 positive line numbers')
        doc=self.db.execute('SELECT source_hash,format_version FROM documents WHERE path=?',(path,)).fetchone()
        if not doc or doc['format_version']!=FORMAT_VERSION:return {'path':path,'issueCode':'not-indexed','callouts':{}}
        rows=self.db.execute('SELECT line,data FROM occurrences WHERE path=? AND line IN ('+','.join('?' for _ in lines)+')',(path,*lines)).fetchall() if lines else []
        return {'path':path,'sourceHash':doc['source_hash'],'revision':self.revision,'callouts':{str(r['line']):json.loads(r['data']) for r in rows}}

    def invalidate_library(self,entry_ids):
        with self.db:
            revision=self._tick();self._wake({key('library',entry) for entry in entry_ids},revision)
        return revision

    def invalidate_document(self,document_id):
        # Registry ownership/copy changes can affect references without a body edit.
        with self.db:
            revision=self._tick()
            self.db.execute('INSERT INTO pending(path,revision) SELECT DISTINCT path,? FROM dependencies WHERE document_id=? ON CONFLICT(path) DO UPDATE SET revision=excluded.revision',(revision,document_id))
        return revision

    def resolve(self,path,target,owner_path,library_entry=lambda _id:None):
        """owner_path(document_id) must consult the current document registry."""
        if target.startswith('lib.'):
            entry=library_entry(target[4:])
            if not entry:return {'issueCode':'missing','issue':'Library entry unavailable'}
            if entry.get('status')=='deleted':return {'issueCode':'retired','issue':'Library entry retired'}
            if entry.get('admission')=='pending-variant':return {'issueCode':'unreviewed','issue':'Library entry awaits review'}
            from callout_labels import parse_label
            return {'title':parse_label(entry.get('kind','result'),entry.get('title',''))['nameText']}
        if '.' in target:
            document,block=target.split('.',1);resolved=owner_path(document)
            if not resolved:return {'issueCode':'ambiguous','issue':'Document identity unavailable or ambiguous'}
        else:document=None;block=target;resolved=path
        doc=self.db.execute('SELECT document_id,format_version FROM documents WHERE path=?',(resolved,)).fetchone()
        if not doc or doc['format_version']!=FORMAT_VERSION:return {'issueCode':'not-indexed','issue':'Target is awaiting reference indexing'}
        if document and doc['document_id']!=document:return {'issueCode':'stale','issue':'Document identity projection is stale'}
        row=self.db.execute('SELECT t.data,d.document_id,d.source_hash FROM targets t JOIN documents d ON d.path=t.path WHERE t.path=? AND t.block=?',(resolved,block)).fetchone()
        if not row:return {'issueCode':'missing','issue':'Referenced block is missing'}
        result=json.loads(row['data']);result['path']=resolved;result['sourceHash']=row['source_hash'];result['link']=('' if resolved==path else resolved)+'#^'+block
        return result

    def outdated(self,limit=100):
        if not isinstance(limit,int) or isinstance(limit,bool) or not 1<=limit<=1000:raise ValueError('Batch limit must be 1 through 1000')
        return [r['path'] for r in self.db.execute('SELECT path FROM documents WHERE format_version<? ORDER BY format_version,path LIMIT ?',(FORMAT_VERSION,limit))]

    def policy_page(self,after='',limit=500):
        if type(limit) is not int or not 1<=limit<=500 or not isinstance(after,str):raise ValueError('Expected a path cursor and batch limit 1 through 500')
        return [dict(r) for r in self.db.execute('SELECT d.path,p.book_key,p.digest FROM documents d LEFT JOIN policy_state p ON p.path=d.path WHERE d.path>? ORDER BY d.path LIMIT ?',(after,limit))]

    def pending(self,limit=100,labels_first=False):
        if not isinstance(limit,int) or not 1<=limit<=1000:raise ValueError('Batch limit must be 1 through 1000')
        # A current edit's dependents must not wait behind a startup corpus
        # rebuild. Notes without references still drain after actual labels.
        order='EXISTS(SELECT 1 FROM dependencies r WHERE r.path=p.path) DESC,p.revision DESC,p.path' if labels_first else 'p.revision,p.path'
        return [dict(r) for r in self.db.execute('SELECT p.path,p.revision,d.source_hash AS sourceHash FROM pending p JOIN documents d ON d.path=p.path ORDER BY '+order+' LIMIT ?',(limit,))]

    def finish(self,path,revision,source_hash,diagnostics):
        """A stale worker must never acknowledge newer invalidations."""
        with self.db:
            row=self.db.execute('SELECT p.revision,d.source_hash FROM pending p JOIN documents d ON d.path=p.path WHERE p.path=?',(path,)).fetchone()
            if not row or row['revision']!=revision or row['source_hash']!=source_hash:return False
            self.db.execute('INSERT OR REPLACE INTO diagnostics VALUES(?,?,?)',(path,source_hash,json.dumps(diagnostics)))
            self.db.execute('DELETE FROM pending WHERE path=? AND revision=?',(path,revision));return True
