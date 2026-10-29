"""Bounded agent operations using the same query, identity and numbering engines."""
import difflib,hashlib,json,re,uuid,time,os
from pathlib import Path
from library_store import Conflict,atomic_json
H=lambda text:hashlib.sha256(text.encode()).hexdigest()
def entry_hash(entry):return H(json.dumps([entry['body'],entry.get('images',[])],sort_keys=True))

def read_json(path,timeout=1.0):
    """VM mounts can briefly expose a truncated JSON file despite atomic replace."""
    deadline=time.monotonic()+timeout;delay=.025
    while True:
        try:return json.loads(path.read_text())
        except (json.JSONDecodeError,UnicodeDecodeError) as error:
            remaining=deadline-time.monotonic()
            if remaining<=0:
                raise Conflict('Status is temporarily unreadable; the write may have succeeded. '
                               'Retry with the same token; do not prepare a duplicate operation.') from error
            time.sleep(min(delay,remaining));delay=min(delay*2,.2)

def terminal_job(path):
    for state in ('complete','conflict'):
        receipt=path.parent/'receipts'/(path.stem+'.'+state+'.json')
        try:job=read_json(receipt)
        except FileNotFoundError:continue
        if job.get('token')!=path.stem or job.get('state')!=state:
            raise Conflict('Invalid agent completion receipt')
        return job

def read_job(path):
    # Completion snapshots are never rewritten, even when Undo is requested.
    terminal=terminal_job(path)
    if terminal is not None:return terminal
    try:job=read_json(path)
    except Conflict:
        terminal=terminal_job(path)
        if terminal is not None:return terminal
        raise
    # Publication may have completed while the mutable job was being read.
    return terminal_job(path) or job

def publish_terminal(path,job):
    """Publish a fully saved, fsynced snapshot once; never expose partial bytes."""
    existing=terminal_job(path)
    if existing:
        if existing['state']!=job['state'] or existing.get('vaultId')!=job.get('vaultId'):
            raise Conflict('Agent operation already has a different terminal receipt')
        return
    folder=path.parent/'receipts';folder.mkdir(exist_ok=True)
    receipt=folder/(path.stem+'.'+job['state']+'.json')
    temporary=folder/(path.stem+'.tmp-'+str(uuid.uuid4()))
    try:
        atomic_json(temporary,job)
        try:os.link(temporary,receipt)
        except FileExistsError:
            if read_json(receipt)!=job:raise Conflict('Agent receipt already exists with different contents')
        descriptor=os.open(folder,os.O_RDONLY)
        try:os.fsync(descriptor)
        finally:os.close(descriptor)
    finally:temporary.unlink(missing_ok=True)

class AgentAPI:
    def __init__(self,service):self.service=service;self.live=service.live
    def call(self,op,**kw):return self.service.handle({**self.live.metadata(),'op':op,**kw})['data']
    def search(self,query='',limit=10,offset=0,book=None,chapter=None,vaults=None):
        if not 1<=limit<=100 or not 0<=offset<=10000:raise ValueError('Use limit 1–100 and offset 0–10000')
        catalog=self.call('catalog');scope=None
        if vaults:scope=[v['id'] for v in catalog['vaults'] if v['name'] in vaults or v['id'] in vaults]
        data=self.call('search',query=query.strip(),limit=limit,offset=offset,vaultIds=scope,book=book,chapter=chapter)
        registry=self.live.component_registry();registry.load()
        for group in data['groups']:
            compact=[]
            for row in group['rows']:
                e=self.live.store.entries.get(row['id']) or {};body=e.get('body','')
                statement=next((l.lstrip('> ').strip() for l in body.splitlines()[1:] if l.lstrip('> ').strip()),'')
                from callout_labels import parse_label
                title=parse_label(row['kind'],row['title'])['nameText']
                compact.append({'id':row['id'],'type':row['kind'],'label':row['kind'].capitalize()+(': '+title if title and title.casefold()!=row['kind'].casefold() else ''),'title':title,'statement':statement[:180], 'source':{'vault':row['vault'],'note':row['path'],'line':row['line_start']},'tags':registry.entities.get(row['id'],{}).get('tags',[])})
            group['rows']=compact
        data['scope']='reviewed-library'
        data['localLookup']='For unadmitted callouts use outline --note NOTE or resolve LABEL --note NOTE/--book FOLDER; these do not require admission.'
        return data
    def projected(self,note,text):
        from reference_format import references,refresh_plan,apply_plan
        targets=list(dict.fromkeys(r.target for r in references(text)));resolved={}
        for i in range(0,len(targets),256):resolved.update(self.live.resolve_reference_targets(note,targets[i:i+256])['targets'])
        return apply_plan(text,refresh_plan(text,lambda ref:resolved.get(ref.target)))
    def get(self,identity):
        result=self.call('detail',id=identity);result['body']=self.projected(result.get('sourcePath') or result.get('home',{}).get('path') or 'Untitled.md',result['body']);return result
    def outline(self,note,body=False,_ranges=False):
        from component_references import cached_catalog
        text=self.live.read(note);data=cached_catalog(self.live,self.live.vault,note,text,self.live.numbering_policy(note))
        rows=[]
        for r in data['occurrences']:
            d=r['display'];row={'id':r['entityId'],'occurrence':r['occurrenceKey'],'note':note,'line':r['line'],'type':r['kind'],'title':d.get('title') or '', 'label':d.get('numberLabel') or d.get('title') or r['kind'].capitalize()}
            row['status']='component' if row['id'] else 'unconverted'
            if _ranges:row['_range']=(r['from'],r['to'])
            if body:row['body']=self.projected(note,text[r['from']:r['to']])
            rows.append(row)
        return {'note':note,'sourceHash':H(text),'rows':rows}
    def resolve(self,label,note=None,book=None):
        if not note and not book:raise ValueError('Resolve requires --note or --book scope')
        def norm(s):
            s=s.casefold().strip();s=re.sub(r'^(thm|def|eq|fig|prop|lem|cor|ex|rem)\.?\s+',lambda m:{'thm':'theorem','def':'definition','eq':'equation','fig':'figure','prop':'proposition','lem':'lemma','cor':'corollary','ex':'exercise','rem':'remark'}[m[1]]+' ',s)
            return re.sub(r'\s+',' ',s)
        if note:paths=[note]
        else:
            folder=(self.live.vault/book).resolve()
            if not folder.is_relative_to(self.live.vault.resolve()) or not folder.is_dir():
                raise ValueError('Book scope must be a folder inside the enrolled vault')
            paths=[str(p.relative_to(self.live.vault)) for p in sorted(folder.rglob('*.md'))]
        wanted=norm(label);rows=[]
        for path in paths:
            data=self.outline(path,_ranges=True);text=None
            for row in data['rows']:
                actual=norm(row['label']);number=re.sub(r'^\w+\s+','',actual)
                if wanted in (actual,number):
                    text=self.live.read(path) if text is None else text
                    if H(text)!=data['sourceHash']:raise Conflict('Note changed while resolving its label; retry')
                    start,end=row.pop('_range');row['body']=self.projected(path,text[start:end]);rows.append(row)
        rows.sort(key=lambda row:not bool(row['id']))
        return {'matches':rows,'ambiguous':len(rows)>1}
    def plan(self,op,note,identity,line,column=0,end_column=None,mode='n'):
        from component_scope import guard
        guard(self.live.vault,note)
        from reference_insert import editor_changes
        from reference_format import apply_plan,math_reference
        from component_references import insertion,copy_body,resolve
        from math_label import math_label
        from markdown_scan import structure
        text=self.live.read(note);parts=text.splitlines(keepends=True)
        if not 1<=line<=len(parts)+1:raise ValueError('Line is one-based and must be in the note')
        raw=parts[line-1].rstrip('\r\n') if line<=len(parts) else ''
        end_column=column if end_column is None else end_column
        if not 0<=column<=end_column<=len(raw):raise ValueError('Column is zero-based Unicode, outside line')
        start=sum(map(len,parts[:line-1]))+column;end=start+end_column-column
        target=resolve(self.live,note,identity,text)
        if not target or target.get('issue'):raise Conflict((target or {}).get('issue','Target unavailable'))
        if op in ('insert-link','insert-linked-title'):
            positions=editor_changes(text,[{'start':start,'end':end,'after':''}])[0]
            plan=insertion(self.live,note,text,H(text),[positions['from'],positions['to']],identity,'c' if op=='insert-link' and end>start else 't' if op=='insert-linked-title' else mode)
        else:
            parsed=structure(text)
            if op=='insert-copy':
                if any(a<=start<b for a,b in parsed['protected']+parsed['math']+parsed['links']):raise ValueError('Insert a callout outside code, math and links')
                if raw.strip():raise ValueError('Insert a copy on an empty line')
                entry=self.live.reference_entry(identity);copy=copy_body(self.live,identity,entry['revision'],materialize_assets=False)['body']
                prefix=re.match(r'^\s*(?:>\s*)*',raw)[0];after='\n'.join(prefix+l for l in copy.splitlines())+'\n'
            elif op=='justify':
                equation=next(((a,b) for a,b in parsed['math'] if a<=start<=end<b),None)
                if not equation or any(a<=start<b for a,b in parsed['protected']):raise ValueError('Justify requires a position inside an existing equation')
                from reference_format import references
                if any(start<r.end and end>r.start or start==end and r.start<start<r.end for r in references(text)):raise ValueError('Do not nest references')
                label={'n':target.get('numberLabel'),'t':target.get('title'),'b':target.get('bothLabel')}[mode]
                if not label:raise ValueError('Requested label unavailable')
                wrapper=math_reference(math_label(label),mode,'lib.'+identity)
                after=(' ' if '&&' in raw[:column] else ' && ' if '\\begin{align' in text[equation[0]:start] else r'\quad ')+wrapper
            else:raise ValueError('Unknown write operation')
            plan={'sourceHash':H(text),'edits':[{'start':start,'end':end,'before':text[start:end],'after':after}]}
        after=apply_plan(text,plan)
        token=str(uuid.uuid4());folder=self.live.store.root/'agent-writes';folder.mkdir(exist_ok=True)
        job={'token':token,'state':'planned','vaultId':self.live.vault_id,'vaultPathHint':str(self.live.vault),'note':note,'before':text,'after':after,'target':identity,'targetDisplay':target,'targetHash':entry_hash(self.live.reference_entry(identity)),'sourceHash':H(text),'operation':op}
        atomic_json(folder/(token+'.json'),job)
        return {'token':token,'sourceHash':H(text),'diff':''.join(difflib.unified_diff(text.splitlines(True),after.splitlines(True),fromfile=note,tofile=note))}
    def prepare_online(self,token,text):
        self.live.store.load()
        from component_references import resolve
        uuid.UUID(token);path=self.live.store.root/'agent-writes'/(token+'.json');job=read_job(path)
        if job.get('vaultId')!=self.live.vault_id or job['state'] not in ('pending','writing'):raise Conflict('Agent plan is not pending in this vault')
        if job['state']=='writing' and text==job['after']:return {'text':text,'token':job['componentToken'],'path':job['note']}
        if text!=job['before']:raise Conflict('Note changed since dry-run; prepare a new plan')
        if resolve(self.live,job['note'],job['target'],text)!=job['targetDisplay'] or entry_hash(self.live.reference_entry(job['target']))!=job['targetHash']:raise Conflict('Target changed since dry-run')
        if job['operation']=='insert-copy':
            from image_assets import materialize
            materialize(self.live,self.live.reference_entry(job['target']).get('images',[]))
        plan=self.live.component_plan(job['note'],job['after'],'paste' if job['operation']=='insert-copy' else 'edit',intent_kind='agent',intent_data={'agent':token})
        job.update(state='writing',after=plan['text'],componentToken=plan['token']);atomic_json(path,job)
        return {**plan,'path':job['note']}
    def finish_online(self,token,text):
        uuid.UUID(token);folder=self.live.store.root/'agent-writes';path=folder/(token+'.json');job=read_job(path)
        if job.get('vaultId')!=self.live.vault_id or job['state']!='writing' or text!=job['after'] or self.live.read(job['note'])!=text:raise Conflict('Agent write has not reached disk unchanged')
        self.live.component_finish(job['componentToken'],text,kind='agent',data={'agent':token});self.live.refresh_reference_note(job['note']);job['state']='complete';publish_terminal(path,job);atomic_json(path,job);(folder/'pending'/path.name).unlink(missing_ok=True)
        return {'token':token,'state':'complete','note':job['note']}
    def fail_online(self,token,error):
        uuid.UUID(token);folder=self.live.store.root/'agent-writes';path=folder/(token+'.json');job=read_job(path)
        if job.get('vaultId')!=self.live.vault_id:raise Conflict('Agent plan belongs to another vault')
        if job['state']=='complete':return {'state':'complete','replayed':True}
        job.update(state='conflict',error=error);publish_terminal(path,job);atomic_json(path,job);(folder/'pending'/path.name).unlink(missing_ok=True);return {'state':'conflict','error':error}
    def wait_online(self,result,timeout=10):
        import time
        if result.get('state')!='pending':return result
        deadline=time.monotonic()+timeout;path=self.live.store.root/'agent-writes'/(result['token']+'.json')
        while time.monotonic()<deadline:
            job=read_job(path)
            if job.get('vaultId')!=self.live.vault_id:raise Conflict('Agent plan belongs to another vault')
            if job['state']=='complete':return {**result,'state':'complete'}
            if job['state'] in ('conflict','cancelled'):raise Conflict(job.get('error','Plan cancelled'))
            time.sleep(.15)
        job=read_job(path)
        if job.get('vaultId')!=self.live.vault_id:raise Conflict('Agent plan belongs to another vault')
        if job['state']=='complete':return {**result,'state':'complete'}
        if job['state'] in ('conflict','cancelled'):raise Conflict(job.get('error','Plan cancelled'))
        reason='The editor has not picked up this plan yet' if job['state']=='pending' else 'The editor picked up the plan but has not acknowledged the saved file yet'
        return {**result,'reason':reason,'retry':'Retry apply with the same token; do not prepare a duplicate operation','vaultId':job.get('vaultId')}
    def undo(self,token):
        from component_references import resolve
        uuid.UUID(token);folder=self.live.store.root/'agent-writes';path=folder/(token+'.json');job=read_job(path)
        if job['state']!='complete' or job.get('vaultId')!=self.live.vault_id:raise Conflict('Only an applied plan in this vault can be undone')
        reverse=job.get('undoToken') or str(uuid.uuid5(uuid.UUID(token),'undo'))
        reverse_path=folder/(reverse+'.json')
        if not reverse_path.exists():
            text=self.live.read(job['note'])
            if text!=job['after']:raise Conflict('The note changed after this operation; refusing to overwrite it')
            target=resolve(self.live,job['note'],job['target'],text)
            atomic_json(reverse_path,{**job,'token':reverse,'state':'planned','before':text,'after':job['before'],'operation':'undo','sourceHash':H(text),'targetDisplay':target,'targetHash':entry_hash(self.live.reference_entry(job['target']))})
        result=self.apply(reverse);job['undoToken']=reverse;atomic_json(path,job);return result
    def apply(self,token):
        from host_role import require_writer
        require_writer(self.live,'Applying an agent edit')
        self.live.store.load()
        import os,fcntl
        from component_entry_edit import online
        from component_references import resolve
        uuid.UUID(token);folder=self.live.store.root/'agent-writes';path=folder/(token+'.json')
        with (folder/(token+'.lock')).open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX);job=read_job(path)
            if job.get('vaultId')!=self.live.vault_id:raise Conflict('Plan belongs to another vault')
            if job['state']=='complete':return {'token':token,'state':'complete','replayed':True}
            if job['state'] not in ('planned','pending','writing'):raise Conflict(job.get('error','This plan cannot be applied'))
            if online(self.live,self.live.vault_id):
                if job['state'] not in ('planned','pending','writing'):raise Conflict(job.get('error','This plan cannot be applied'))
                job['state']='pending' if job['state']!='writing' else 'writing';atomic_json(path,job)
                pending=folder/'pending';pending.mkdir(exist_ok=True);atomic_json(pending/path.name,{'token':token})
                return {'token':token,'state':'pending','note':job['note']}
            file=self.live.path(job['note']);text=file.read_bytes().decode()
            if job['state']=='writing' and text==job['after']:
                result=self.live.component_finish(job['componentToken'],text,kind='agent',data={'agent':token})
            else:
                if text!=job['before']:raise Conflict('Note changed since dry-run; prepare a new plan')
                if resolve(self.live,job['note'],job['target'],text)!=job['targetDisplay'] or entry_hash(self.live.reference_entry(job['target']))!=job['targetHash']:raise Conflict('Target changed since dry-run')
                if job['operation']=='insert-copy':
                    from image_assets import materialize
                    materialize(self.live,self.live.reference_entry(job['target']).get('images',[]))
                # Durable intent (kind agent) before the note write.
                p=self.live.component_plan(job['note'],job['after'],'paste' if job['operation']=='insert-copy' else 'edit',intent_kind='agent',intent_data={'agent':token})
                job.update(state='writing',after=p['text'],componentToken=p['token']);atomic_json(path,job)
                temporary=file.with_name('.kl-tmp-'+file.name+'-'+token)
                try:
                    with temporary.open('x',encoding='utf-8',newline='') as out:out.write(job['after']);out.flush();os.fsync(out.fileno())
                    os.chmod(temporary,file.stat().st_mode)
                    if file.read_bytes().decode()!=text:raise Conflict('Note changed before write')
                    os.replace(temporary,file)
                finally:temporary.unlink(missing_ok=True)
                result=self.live.component_finish(p['token'],job['after'],kind='agent',data={'agent':token})
            self.live.refresh_reference_note(job['note']);job['state']='complete';publish_terminal(path,job);atomic_json(path,job)
            return {'token':token,'state':'complete','note':job['note'],'sourceHash':H(job['after'])}

def pending(live):
    folder=live.store.root/'agent-writes';rows=[]
    for path in (folder/'pending').glob('*.json'):
        job=read_job(folder/path.name)
        if job.get('vaultId')==live.vault_id and job['state'] in ('pending','writing'):rows.append({'agent':True,'key':job['token'],'path':job['note']})
        if len(rows)>=20:break
    return rows
