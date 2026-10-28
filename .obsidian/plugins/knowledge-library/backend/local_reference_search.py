"""Derived FTS for this vault's registered, unadmitted reference targets.

Only the reference picker uses this supplement. It never admits content or
walks the vault: the identity journal supplies the finite occurrence paths.
"""
import sqlite3
from query_service import split_queries,search_expression
from formula_search import projection,expression
from component_references import cached_catalog

class LocalReferenceSearch:
    def __init__(self):
        self.db=sqlite3.connect(':memory:');self.rows={};self.signature=None
        self.db.execute('CREATE VIRTUAL TABLE local_refs USING fts5(at UNINDEXED,title,label,body,tags,formula)')
    def __del__(self):
        if hasattr(self,'db'):self.db.close()
    def sync(self,live):
        registry=live.component_registry();registry.load()
        paths=sorted({o['path'] for o in registry.occurrences.values() if o.get('alive') and o['vault']==live.vault_id})
        stamps=[]
        for path in paths:
            try:stat=(live.vault/path).stat();stamps.append((path,stat.st_mtime_ns,stat.st_size))
            except OSError:stamps.append((path,None,None))
        signature=(registry.sequence,live.store.sequence,live.numbering_policy('Untitled.md')['policyStamp'],tuple(stamps))
        if signature==self.signature:return
        current={}
        for path in paths:
            try:
                text=live.read(path);data=cached_catalog(live,live.vault,path,text,live.numbering_policy(path))
            except (OSError,ValueError):continue
            for r in data['occurrences']:
                identity=r.get('entityId');at=r.get('occurrenceKey')
                if not identity or not at or identity in live.store.entries:continue
                d=r['display'];title=d.get('title') or r['kind'].capitalize();body=text[r['from']:r['to']]
                current[at]={'id':identity,'at':at,'kind':r['kind'],'title':title,'label':d.get('numberLabel') or title,'display':d,
                             'body':body,'path':path,'sourcePath':path,'line_start':r['line'],'vault':live.vault_id,
                             'tags':registry.entities.get(identity,{}).get('tags',[]),'copies':1,'status':'local','admitted':False}
        for at in self.rows.keys()|current.keys():
            if self.rows.get(at)==current.get(at):continue
            self.db.execute('DELETE FROM local_refs WHERE at=?',(at,))
            if at in current:
                r=current[at];self.db.execute('INSERT INTO local_refs VALUES(?,?,?,?,?,?)',(at,r['title'],r['label'],r['body'],' '.join(r['tags']),projection(r['body'])))
        self.db.commit();self.rows=current;self.signature=signature
    def groups(self,live,request,sources):
        self.sync(live)
        source_map={s['id']:s for s in sources};types=request.get('types');vaults=request.get('vaultIds');selected=request.get('sourceIds')
        # Catalog selector IDs are not enrolled vault IDs. Resolve through the catalog.
        catalog_vaults={s['vaultId'] for s in sources if s.get('vault')==live.vault_id}
        if vaults is not None and not catalog_vaults.intersection(vaults):return []
        allowed=[]
        for at,r in self.rows.items():
            if request.get('entryIds') is not None and r['id'] not in request['entryIds']:continue
            if request.get('books') and not all(book.casefold() in r['path'].casefold() for book in request['books']):continue
            if r['path']==request['referencePath'] or types is not None and r['kind'] not in types:continue
            if selected is not None and not any((s:=source_map.get(id)) and s['vaultId'] in catalog_vaults and (r['path'].startswith(s['path']+'/') if s['folder'] else r['path']==s['path']) for id in selected):continue
            allowed.append(at)
        self.db.execute('CREATE TEMP TABLE IF NOT EXISTS allowed(at TEXT PRIMARY KEY)');self.db.execute('DELETE FROM allowed');self.db.executemany('INSERT INTO allowed VALUES(?)',((at,) for at in allowed))
        result=[];size=max(1,min(100,int(request.get('limit',16))))
        for index,term in enumerate(split_queries(request.get('query','')) or ['']):
            offset=max(0,min(10000,int(request.get('offsets',{}).get('local-'+str(index),0))))
            expr='formula:'+expression(term) if term.startswith('$') and term.endswith('$') and expression(term) else search_expression(term)
            sql='SELECT local_refs.at FROM local_refs JOIN allowed ON allowed.at=local_refs.at'
            args=[]
            if expr:sql+=' WHERE local_refs MATCH ? ORDER BY local_refs.rank';args.append(expr)
            else:sql+=' ORDER BY title'
            sql+=' LIMIT ? OFFSET ?';args.extend([size+1,offset]);found=[self.rows[at] for at, in self.db.execute(sql,args)]
            if found:result.append({'term':'Local callouts'+(' · '+term if term else ''),'rows':[{k:v for k,v in row.items() if k!='body'} for row in found[:size]],'more':len(found)>size,'offset':offset,'match':'local','queryKey':'local-'+str(index)})
        return result
