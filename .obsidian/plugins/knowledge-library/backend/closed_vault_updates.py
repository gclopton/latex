"""Replay indexed changes into explicitly allowed closed vaults, with durable Undo receipts.

Open vaults retain their editor ownership. Only the existing occurrence index is
used: no note-tree scan, and no writes to unavailable roots or nonautomatic vaults.
"""
import fcntl,json,os,uuid
from pathlib import Path
from library_store import atomic_json,Conflict
from component_entry_edit import online
from component_membership import replay,propagation_plan,propagation_resume


def allowed_roots(live):
    if not live.production:
        path=live.store.root/'lab-roots.json'
        return json.loads(path.read_text()) if path.exists() else {}
    path=live.store.root/'closed-write-allowlist.json'
    if not path.exists():return {}
    value=json.loads(path.read_text())
    if value.get('schema')!=1 or value.get('profile')!=live.store.config['id'] or value.get('epoch')!=live.store.config['epoch']:
        raise Conflict('Closed-write allowlist does not match this library generation.')
    roots=value.get('vaults',{})
    if not isinstance(roots,dict) or any(not isinstance(k,str) or not isinstance(v,str) or not Path(v).is_absolute() for k,v in roots.items()):
        raise Conflict('Closed-write allowlist must contain explicit vault IDs and absolute roots.')
    return roots


def allowed(live,identity,root):
    root=Path(root).resolve();registered=allowed_roots(live).get(identity)
    if not registered or Path(registered).resolve()!=root:return False
    if live.production:
        from vault_registry import identity as enrolled_identity
        return enrolled_identity(live.store,root)==identity
    return True


def directory(live):
    folder=live.store.root/'closed-vault-updates';folder.mkdir(exist_ok=True);return folder


def read_state(live):
    path=directory(live)/(live.vault_id+'.json')
    state=json.loads(path.read_text()) if path.exists() else {'cursor':None,'pending':None,'notices':[]}
    # Adopt already acknowledged editor progress, including upgrades from the
    # open-only replayer, rather than repeating historical removal notices.
    config=live.vault/'.obsidian/plugins'/('knowledge-library' if live.production else 'knowledge-library-lab')/'data.json'
    cursor=json.loads(config.read_text()).get('membershipCursor') if config.exists() else None
    old=state['cursor']
    if cursor and not state.get('pending') and (old is None or
       all(cursor.get(k)==old.get(k) for k in ('profile','epoch')) and
       all(cursor.get(k,0)>=old.get(k,0) for k in ('sequence','components'))):state['cursor']=cursor
    return state


def write_state(live,state):atomic_json(directory(live)/(live.vault_id+'.json'),state)


def mode(root):
    for name in ('knowledge-library-lab','knowledge-library'):
        path=root/'.obsidian/plugins'/name/'data.json'
        if path.exists():return json.loads(path.read_text()).get('copyUpdates','automatic')
    return 'automatic'


def guarded_write(owner,path,before,after):
    from host_role import require_writer
    require_writer(owner,'Writing a closed note')
    from component_scope import guard
    guard(owner.vault,path)
    if not allowed(owner,owner.vault_id,owner.vault):raise Conflict('Closed writes are not enabled for this vault.')
    if online(owner,owner.vault_id):raise Conflict('The vault opened; its editor will apply this update.')
    file=owner.path(path)
    if file.read_bytes().decode()!=before:raise Conflict('The closed note changed before its update.')
    if before==after:return
    temporary=file.with_name('.kl-tmp-'+file.name+'-'+str(uuid.uuid4()))
    try:
        with temporary.open('x',encoding='utf-8',newline='') as out:
            out.write(after);out.flush();os.fsync(out.fileno())
        os.chmod(temporary,file.stat().st_mode)
        if online(owner,owner.vault_id) or file.read_bytes().decode()!=before:
            raise Conflict('The closed note changed or its vault opened before saving.')
        os.replace(temporary,file)
        descriptor=os.open(file.parent,os.O_RDONLY)
        try:os.fsync(descriptor)
        finally:os.close(descriptor)
    finally:temporary.unlink(missing_ok=True)


def drain_owner(owner,budget=20):
    if not allowed(owner,owner.vault_id,owner.vault):return {'state':'not-allowed','written':0}
    folder=directory(owner)
    with (folder/(owner.vault_id+'.lock')).open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return {'state':'busy','written':0}
        if online(owner,owner.vault_id) or mode(owner.vault)!='automatic':return {'state':'editor-or-choice','written':0}
        state=read_state(owner);written=0;pages=0
        while written<budget and pages<5:
            pages+=1
            page=state.get('pending')
            if not page:
                page=replay(owner,state['cursor'])
                page.update(index=0,tokens={},receipts=[])
                state['pending']=page;write_state(owner,state)
            while page['index']<len(page['paths']) and written<budget:
                if online(owner,owner.vault_id):return {'state':'editor','written':written}
                path=page['paths'][page['index']];file=owner.path(path)
                try:
                    if not file.exists():
                        # Deletion is reconciled by the normal occurrence plan.
                        plan=owner.component_plan(path,'','observe');owner.component_finish(plan['token'],'')
                    else:
                        text=file.read_bytes().decode();ids=page['updatePaths'].get(path,[]);token=page['tokens'].get(path);plan=None;done=None
                        if token:
                            resumed=propagation_resume(owner,token,text,ids)
                            if resumed['state']=='complete':done=resumed
                            elif resumed['state']=='rebase':plan=resumed['plan']
                        if done is None:
                            plan=plan or propagation_plan(owner,path,text,ids)
                            page['tokens'][path]=plan['token'];write_state(owner,state)
                            guarded_write(owner,path,text,plan['text'])
                            if owner.read(path)!=plan['text']:raise Conflict('The closed note changed before acknowledgement.')
                            owner.component_finish(plan['token'],plan['text'])
                            done={'updates':plan['updates']};token=plan['token']
                        if done['updates']:page['receipts'].append({'path':path,'token':token,'count':len(done['updates'])})
                except (OSError,ValueError) as error:
                    state.setdefault('deferred',{})[path]={'ids':page['updatePaths'].get(path,[]),'token':page['tokens'].get(path),'reason':str(error)}
                page['index']+=1;written+=1;write_state(owner,state)
            if page['index']<len(page['paths']):return {'state':'pending','written':written}
            if page['removals'] or page['receipts']:
                state['notices'].append({'key':str(uuid.uuid4()),'removals':page['removals'],'receipts':page['receipts']})
            state['cursor']=page['cursor'];state['pending']=None;write_state(owner,state)
            if not page['more']:return {'state':'complete','written':written}
        return {'state':'pending','written':written}


def drain(live,budget=20):
    roots=allowed_roots(live)
    from live_library import LiveLibrary
    results=[]
    for identity,root in roots.items():
        if identity==live.vault_id or online(live,identity):continue
        root=Path(root)
        if not root.is_dir():
            results.append({'vaultId':identity,'state':'pending','reason':'Vault root is unavailable'});continue
        try:
            if not allowed(live,identity,root):raise Conflict('Closed vault is not authorized at this root.')
            if mode(root)!='automatic':continue
            owner=LiveLibrary(live.store.root,root,production=live.production,role=live.role)
            if owner.vault_id!=identity:raise Conflict('Closed vault identity no longer matches its registered root.')
            results.append({'vaultId':identity,**drain_owner(owner,budget)})
        except (OSError,ValueError) as error:
            results.append({'vaultId':identity,'state':'pending','reason':str(error)})
    return results


def notices(live,ack=None):
    folder=directory(live)
    with (folder/(live.vault_id+'.lock')).open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX);state=read_state(live)
        if ack:
            state['notices']=[r for r in state['notices'] if r['key'] not in ack];write_state(live,state)
        return state['notices']


def deferred(live,resolved=None):
    folder=directory(live)
    with (folder/(live.vault_id+'.lock')).open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX);state=read_state(live)
        if resolved:
            for path in resolved:state.setdefault('deferred',{}).pop(path,None)
            write_state(live,state)
        return state.get('deferred',{})


class Worker:
    """Event-driven closed-vault drain, isolated from the editor request thread."""
    def __init__(self,root,vault,production=False,role=None):
        import threading
        self.root=root;self.vault=vault;self.production=production;self.role=role;self.wake=threading.Event();self.stop=threading.Event()
        self.thread=threading.Thread(target=self.run,name='closed-vault-updates',daemon=True)
        self.thread.start()
    def notify(self):self.wake.set()
    def close(self):self.stop.set();self.wake.set()
    def run(self):
        from live_library import LiveLibrary
        retry=5
        while not self.stop.is_set():
            self.wake.wait();self.wake.clear()
            if self.stop.is_set():return
            try:
                live=LiveLibrary(self.root,self.vault,production=getattr(self,'production',False),role=getattr(self,'role',None))
                while not self.stop.is_set():
                    results=drain(live)
                    atomic_json(directory(live)/'worker-status.json',{'results':results})
                    pending=[r for r in results if r['state'] in ('pending','busy')]
                    if not pending:
                        retry=5;break
                    # Full batches continue without another edit; inaccessible roots
                    # retry with backoff rather than spin. No idle timer when clear.
                    progress=any(r.get('written',0) for r in pending)
                    delay=.02 if progress else retry
                    retry=5 if progress else min(300,retry*2)
                    # A new change wakes retries immediately; an absent drive
                    # settles at one retry per five minutes instead of polling.
                    if self.wake.wait(delay):retry=5
                    self.wake.clear()
                    if self.stop.is_set():return
            except Exception as error:
                try:atomic_json(Path(self.root)/'closed-vault-updates/worker-status.json',{'error':str(error)})
                except OSError:pass
                if self.wake.wait(retry):retry=5
                else:retry=min(300,retry*2)
                if not self.stop.is_set():self.wake.set()
