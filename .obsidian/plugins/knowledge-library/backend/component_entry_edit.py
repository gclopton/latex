"""Journaled index edits. Open homes are applied by their owning editor.

Only closed homes use the guarded filesystem path; pending jobs survive restart.
"""
import json
import os
import socket
import uuid
import time
from pathlib import Path
from contextlib import contextmanager
import fcntl
from library_store import Conflict, atomic_json, digest
from markdown_scan import components
from component_membership import replacement


def directory(live):
    path=live.store.root/'component-entry-edits';path.mkdir(exist_ok=True);return path


def session(live, enabled=True):
    path=directory(live)/('session-'+live.vault_id+'.json')
    if enabled:atomic_json(path,{'host':socket.gethostname(),'pid':os.getpid(),'heartbeat':time.time(),'vaultLabel':live.vault.parent.name+' / '+live.vault.name})
    elif path.exists():
        current=json.loads(path.read_text())
        if current.get('pid')==os.getpid():path.unlink()


def online(live,vault):
    path=directory(live)/('session-'+vault+'.json')
    if not path.exists():return False
    value=json.loads(path.read_text())
    # Expire crashed/sleeping sessions, including reused local PIDs.
    if not 0<=time.time()-value.get('heartbeat',0)<=90:return False
    # Never write through a potentially active remote editor.
    if value['host']!=socket.gethostname():return True
    try:os.kill(value['pid'],0);return True
    except ProcessLookupError:return False


def job_path(live,key):return directory(live)/(str(uuid.UUID(key))+'.json')


def context(live,identity):
    live.store.load();registry=live.component_registry();registry.load()
    entry=live.store.entries.get(identity);entity=registry.entities.get(identity)
    if not entry or not entity:raise Conflict('This entry is not an editable indexed component.')
    root=live.source_root(entry);relative=entry['home']['path'];file=(root/relative).resolve()
    if not file.is_relative_to(root) or file.suffix!='.md':raise Conflict('The home note is outside its vault.')
    text=file.read_bytes().decode('utf-8');rows=[r for r in components(text) if r.get('at')==entity['home']]
    if len(rows)!=1 or rows[0]['id'].split('.')[0]!=identity:raise Conflict('The original callout is no longer at its recorded home.')
    row=rows[0]
    if row['contentHash']!=entity['contentHash']:raise Conflict('The original is being edited. Wait for that edit to finish.')
    from callout_labels import parse_label
    raw=row['raw'];body=raw.split('\n',1)[1] if '\n' in raw else ''
    body='\n'.join(line[2:] if line.startswith('> ') else line[1:] if line.startswith('>') else line for line in body.split('\n'))
    return {'id':identity,'revision':entry['revision'],'sourceHash':digest(text),'title':parse_label(row['type'],row['title'])['nameText'],
            'body':body,'kind':row['type'],'path':relative,'vault':entry['home'].get('vaultId',entry['home']['vault']),
            'root':str(root),'at':entity['home'],'text':text,'row':row}


def enqueue(live,identity,revision,source_hash,title,body,key):
    if not isinstance(title,str) or '\n' in title or '\r' in title or not isinstance(body,str):raise ValueError('Use a one-line title and Markdown body.')
    path=job_path(live,key);signature=digest([identity,revision,source_hash,title,body])
    if path.exists() or (directory(live)/'receipts'/path.name).exists():
        job=read_job(live,key)
        if job['signature']!=signature:raise Conflict('This edit key was already used for another edit.')
        return status(live,key)
    value=context(live,identity)
    if value['revision']!=revision or value['sourceHash']!=source_hash:raise Conflict('The original changed while this index editor was open. Your draft has been kept.')
    source='> [!'+value['kind']+']'+(' '+title if title else '')+('\n'+'\n'.join('> '+line for line in body.split('\n')) if body else '')
    row=value['row'];after=value['text'][:row['from']]+replacement(row,source,value['text'])+value['text'][row['to']:]
    job={'key':key,'signature':signature,'id':identity,'revision':revision,'vault':value['vault'],'root':value['root'],'path':value['path'],
         'before':value['text'],'after':after,'state':'pending'}
    atomic_json(path,job)
    if not online(live,value['vault']):apply_closed(live,key)
    return status(live,key)


def pending(live):
    # Dedicated queue contains only active jobs; completed receipts are separate.
    rows=[]
    for path in directory(live).glob('*.json'):
        if path.name.startswith('session-'):continue
        value=json.loads(path.read_text())
        if value['vault']==live.vault_id and value['state']=='pending':rows.append({'key':value['key'],'path':value['path']})
    return rows[:20]


def read_job(live,key):
    path=job_path(live,key)
    if not path.exists():path=directory(live)/'receipts'/path.name
    return json.loads(path.read_text())


def prepare(live,key,text):
    job=read_job(live,key)
    if job['vault']!=live.vault_id:raise Conflict('Only the home vault may apply this edit.')
    if text not in (job['before'],job['after']):raise Conflict('The original changed before its index edit could be applied. The draft is retained.')
    live.store.load();entry=live.store.entries.get(job['id'])
    if not entry:raise Conflict('This entry was removed before its edit could be applied.')
    if text==job['before'] and entry['revision']!=job['revision']:raise Conflict('The index changed before this edit was applied.')
    # Durable intent (kind entry-edit) before the home note is written.
    plan=live.component_plan(job['path'],job['after'],'edit',intent_kind='entry-edit',intent_data={'job':key})
    if plan['text']!=job['after']:
        job['after']=plan['text'];atomic_json(job_path(live,key),job)
    return {**plan,'path':job['path'],'before':text}


def finish(live,key,token,text):
    job=read_job(live,key)
    if job['vault']!=live.vault_id:raise Conflict('Only the home vault may finish this edit.')
    if job['state']=='complete':return status(live,key)
    if text!=job['after']:raise Conflict('The index edit differs from its guarded plan.')
    if live.read(job['path'])!=text:raise Conflict('Waiting for the home editor to finish saving this index edit.')
    # One event group: component ownership, then the entry (home and its new
    # body/title/kind together). A capture between them publishes nothing.
    live.component_finish(token,text,kind='entry-edit',data={'job':key})
    return complete(live,key,text)


def complete(live,key,text):
    job=read_job(live,key)
    if job['state']=='complete':return status(live,key)
    live.store.load();job.update(state='complete',resultRevision=live.store.entries[job['id']]['revision'],resultHash=digest(text))
    receipts=directory(live)/'receipts';receipts.mkdir(exist_ok=True)
    atomic_json(receipts/(key+'.json'),job);job_path(live,key).unlink(missing_ok=True)
    return status(live,key)


def status(live,key):
    job=read_job(live,key)
    if job['state']=='pending' and not online(live,job['vault']):
        apply_closed(live,key);job=read_job(live,key)
    result={k:job[k] for k in ('key','id','state','path','resultRevision','resultHash','error') if k in job}
    if job['state']=='pending':
        path=directory(live)/('session-'+job['vault']+'.json')
        owner=json.loads(path.read_text()) if path.exists() else {}
        from closed_vault_updates import allowed
        result['waiting']=f"Waiting for {owner.get('vaultLabel',job['vault'])} on {owner.get('host','its computer')} to apply this edit." if online(live,job['vault']) else ('Closed writes are not enabled for this vault. Open its index plugin to apply this edit.' if not allowed(live,job['vault'],job['root']) else 'Waiting for the closed-vault edit to finish.')
    return result


def fail(live,key,message):
    job=read_job(live,key)
    if job['vault']!=live.vault_id:raise Conflict('Only the home vault can reject its edit.')
    if job['state']=='pending':
        job.update(state='conflict',error=message);receipts=directory(live)/'receipts';receipts.mkdir(exist_ok=True)
        atomic_json(receipts/(key+'.json'),job);job_path(live,key).unlink(missing_ok=True)
    return {'state':job['state']}


def apply_closed(live,key):
    from host_role import require_writer
    require_writer(live,'Writing a closed home note')
    job=read_job(live,key)
    if online(live,job['vault']):return {'state':'pending','key':key}
    from live_library import LiveLibrary
    from closed_vault_updates import allowed
    if not allowed(live,job['vault'],job['root']):return {'state':'pending','key':key,'reason':'Closed writes are not enabled for this vault.'}
    owner=LiveLibrary(live.store.root,job['root'],production=live.production,role=live.role)
    file=owner.path(job['path'])
    # A job-local lock prevents competing retries. The plan and before/after
    # are durable before a write; replay recognizes a write before finish.
    with (directory(live)/(key+'.lock')).open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        if read_job(live,key)['state']=='complete':return status(live,key)
        if online(live,job['vault']):return {'state':'pending','key':key}
        text=file.read_bytes().decode('utf-8');plan=prepare(owner,key,text)
        if file.read_bytes().decode('utf-8')!=text:raise Conflict('The closed home note changed during its edit.')
        if plan['text']!=text:
            temporary=file.with_name('.kl-tmp-'+file.name+'-'+key)
            try:
                with temporary.open('x',encoding='utf-8',newline='') as out:
                    out.write(plan['text']);out.flush();os.fsync(out.fileno())
                os.chmod(temporary,file.stat().st_mode)
                if file.read_bytes().decode('utf-8')!=text:raise Conflict('The closed home note changed before saving.')
                os.replace(temporary,file)
            finally:temporary.unlink(missing_ok=True)
        return finish(owner,key,plan['token'],plan['text'])
