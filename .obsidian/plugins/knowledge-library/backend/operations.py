"""Durable local intents for operations that change a note and the journals.

An intent is written (under the store lock) before the first journal event of
an operation and records everything needed to finish or cancel it after a
crash: operation id, source vault/path, exact preimage and postimage bytes,
their hashes, expected heads of the affected objects and the intended event
keys. Intents are host-local (store/local/intents) and never sync.

While an intent is unresolved, vault-sync must not capture the store
(capture takes the same store lock and checks local/intents first); notes sync
is unaffected. Recovery after a restart:
  * the note holds the exact postimage -> finish the missing events with the
    original keys and operation id;
  * the note holds the exact preimage and nothing was written -> explicit,
    audited cancellation;
  * anything else -> the operation is never replayed over the newer text: an
    incomplete event group is closed by an audited abort part, both images are
    preserved under local/intents/review and the note is flagged.

Every source-plus-journal operation uses this path (spec item 7): component
edits, admission, index entry edits, agent apply/undo, closed-vault writes,
copy propagation and its undo, rename/move, and the journal-only operations
(tags, membership undo/removal). Phases:
  prepared      local/intents/prepared/<token>.json, written under the store
                lock BEFORE KL writes (or asks the editor to write) the note.
                It does not hold store publication: nothing is in the journal.
  source-saved  local/intents/<token>.json, written under the store lock once
                the exact postimage is verified on disk; holds publication.
  completed / cancelled / needs-review / superseded: archived and audited.
Multi-event operations are one event group, so a capture or a crash between
their events never publishes half of one: the fold applies a group only when
every part is present, and recovery voids an interrupted group as a whole.
"""
import json
import os
import re
from datetime import datetime,timezone
from pathlib import Path
from library_store import atomic_json,digest,Conflict

SCHEMA='kl-intent/1'


def now():return datetime.now(timezone.utc).isoformat()


def folder(store):
    path=store.root/'local'/'intents';path.mkdir(parents=True,exist_ok=True);return path


def audit(store,record):
    with (folder(store)/'audit.jsonl').open('a') as out:
        out.write(json.dumps({**record,'at':now()},sort_keys=True)+'\n');out.flush();os.fsync(out.fileno())


def unresolved(store_root):
    """Intents that must hold store publication (used by vault-sync under the store lock)."""
    path=Path(store_root)/'local'/'intents'
    return sorted(p for p in path.glob('*.json')) if path.is_dir() else []


def prepared_folder(store):
    path=folder(store)/'prepared';path.mkdir(exist_ok=True);return path


def pending_prepared(store_root):
    path=Path(store_root)/'local'/'intents'/'prepared'
    return sorted(p for p in path.glob('*.json')) if path.is_dir() else []


_STARTED={}


def process_started(pid):
    """The process's start time as the OS reports it, or None. A reused PID after a
    reboot has a different start time, so it never looks like the old owner."""
    pid=int(pid)
    if pid in _STARTED:return _STARTED[pid]
    import subprocess
    try:value=subprocess.run(['ps','-o','lstart=','-p',str(pid)],capture_output=True,text=True,timeout=5).stdout.strip() or None
    except (OSError,subprocess.SubprocessError):value=None
    if pid==os.getpid():_STARTED[pid]=value
    return value


def owner_record(store):
    from journal import host_label
    return {'host':host_label(store.root/'local'),'pid':os.getpid(),'started':process_started(os.getpid()),'writer':store.writer}


def prepare(live,kind,token,*,operation,path,before,after,intended=(),data=None,affected=(),expected=None,assets=()):
    """Durable 'prepared' intent, written before any source write of the operation.

    Records the exact preimage and postimage bytes (and their Git blob ids, the
    form vault-sync sees), the intended events, the affected identities and
    the owning process. Creation shares the store lock with journal appends and
    store capture. Writer hosts only.
    """
    if live.reader:return None
    record={'schema':SCHEMA,'kind':kind,'phase':'prepared','started':now(),'operation':operation,'vaultId':live.vault_id,'path':path,
            'token':token,'before':before,'after':after,'inputHash':text_hash(before),'resultHash':text_hash(after),
            'beforeBlob':git_blob(before) if before is not None else None,'afterBlob':git_blob(after) if after is not None else None,
            'intended':list(intended),'data':data or {},'affected':sorted(set(affected)),'expectedHeads':expected,'assets':sorted(set(assets)),
            'materialized':live.__dict__.pop('_materialized',[]),
            'owner':owner_record(live.store)}
    with live.store.lock():atomic_json(prepared_folder(live.store)/(token+'.json'),record)
    return record


def begin(store,token,record):
    """The source is saved and verified: the operation now holds store publication.

    Carries over a prepared intent's kind, preimage and data, and retires every
    prepared intent of the same note whose postimage is exactly these bytes
    (that write is what this operation records).
    """
    prepared=prepared_folder(store)/(token+'.json');carried={}
    for source in (prepared,folder(store)/(token+'.json')): # a prepared intent, or this one begun earlier
        if not source.exists():continue
        try:carried=json.loads(source.read_text());break
        except (OSError,ValueError):carried={}
    intent={'schema':SCHEMA,**{k:carried[k] for k in ('kind','data','before','inputHash','beforeBlob','affected','expectedHeads','assets','owner') if k in carried and carried[k] is not None},
            **record,'phase':'source-saved','started':now()}
    for key in ('kind','before','inputHash'):
        if carried.get(key) is not None:intent[key]=carried[key]
    if isinstance(carried.get('data'),dict) or isinstance(record.get('data'),dict):
        intent['data']={**(carried.get('data') or {}),**(record.get('data') or {})}
    if not intent.get('kind'):intent['kind']='component'
    # This host's instance of the operation's event group; a recovery of the same
    # intent continues it, a retry after an aborted instance starts a new one.
    intent['instance']=(carried.get('instance') if source_is_active(store,token) else None) or record.get('instance') or fresh_instance(store,intent.get('operation'),token)
    atomic_json(folder(store)/(token+'.json'),intent)
    prepared.unlink(missing_ok=True)
    if record.get('path') is not None and record.get('resultHash'):
        for other in pending_prepared(store.root):
            try:value=json.loads(other.read_text())
            except (OSError,ValueError):continue
            if value.get('vaultId')==record.get('vaultId') and value.get('path')==record['path'] and value.get('resultHash')==record['resultHash'] and value.get('kind','component')=='component':
                retire(store,other,value,'superseded','recorded by operation '+str(record.get('operation')))
    return intent


def source_is_active(store,token):return (folder(store)/(token+'.json')).exists()


def fresh_instance(store,operation,token):
    # The writer id (host label + process incarnation) keeps two Macs' instances
    # apart even if their host labels were ever equal.
    base=store.writer+':'+token;instance=base;n=1
    journals=store.journals
    while operation and (journals.aborted((operation,instance)) or journals.group_parts((operation,instance))):
        n+=1;instance=base+':'+str(n)
    return instance


def interrupted(live,token,intent,error):
    """A non-Conflict error inside an operation (a full disk, a programming error).

    Never leaves a parked part behind (this host's instance is voided, so the
    writer's chain keeps applying). If the note still holds the operation's
    exact old bytes, nothing of it happened: cancel. Otherwise the note holds
    (or moved past) its bytes: the intent stays source-saved with a fresh group
    instance, and recovery (the next observation of the note, the timed
    RecoveryWorker, or the next start) finishes it from the verified postimage.
    """
    store=live.store
    try:
        close_group(store,intent)
        current=current_text(live,intent) if intent.get('path') is not None else None
        if intent.get('path') is not None and intent.get('inputHash') is not None and text_hash(current)==intent['inputHash'] and text_hash(current)!=intent.get('resultHash'):
            end(store,token,'cancelled','interrupted by an error before the note changed: '+str(error))
        elif (folder(store)/(token+'.json')).exists():
            update(store,token,instance=fresh_instance(store,intent.get('operation'),token),interruptedBy=str(error),at=now())
    except Exception:pass # the timed recovery resolves what is left


def retire(store,path,intent,phase,reason):
    target=folder(store)/('review' if phase=='needs-review' else 'done');target.mkdir(exist_ok=True)
    atomic_json(target/path.name,{**intent,'phase':phase,'ended':now(),'reason':reason});path.unlink(missing_ok=True)
    audit(store,{'intent':path.stem,'operation':intent.get('operation'),'kind':intent.get('kind'),'phase':phase,'reason':reason,'path':intent.get('path')})


def update(store,token,**fields):
    path=folder(store)/(token+'.json');intent=json.loads(path.read_text());intent.update(fields)
    atomic_json(path,intent);return intent


def end(store,token,phase,reason=None):
    """Archive a finished, cancelled or review intent; it no longer holds publication."""
    for path in (folder(store)/(token+'.json'),prepared_folder(store)/(token+'.json')):
        if not path.exists():continue
        intent=json.loads(path.read_text());intent.update(phase=phase,ended=now(),**({'reason':reason} if reason else {}))
        target=folder(store)/('review' if phase=='needs-review' else 'done');target.mkdir(exist_ok=True)
        atomic_json(target/path.name,intent);path.unlink()
        audit(store,{'intent':path.stem,'operation':intent.get('operation'),'kind':intent.get('kind'),'phase':phase,'reason':reason,'path':intent.get('path')})


def journal_operation(live,kind,key,journal,write,affected=()):
    """A journal-only operation (one event, no source write) under the same intent path.

    The intent is created, the event appended and the intent finalized inside
    one store lock; a crash in between leaves an intent that recovery
    completes (the event is durable) or cancels with an audit record (it is
    not; the client retries with the same idempotency key).
    """
    if live.reader:return write()
    token='j'+digest({'kind':kind,'key':key,'vault':live.vault_id})[:40]
    with live.store.lock():
        begin(live.store,token,{'kind':kind,'operation':key,'vaultId':live.vault_id,'path':None,'token':token,'inputHash':None,'resultHash':None,
                                'intended':[{'journal':journal,'key':key}],'affected':sorted(set(affected))})
        try:result=write()
        except Exception as error:
            end(live.store,token,'cancelled','not written: '+str(error));raise
        end(live.store,token,'completed')
    return result


def text_hash(text):return digest(text) if text is not None else None


def alive(owner,writer=None):
    """Is the operation that prepared an intent still running on this host?

    Another live process owns its prepared intents; in this process, a library
    instance with the same writer incarnation does (its editor may be saving).
    """
    if not isinstance(owner,dict):return False
    if owner.get('pid')==os.getpid() and (not owner.get('started') or owner.get('started')==process_started(os.getpid())):
        return owner.get('writer')==writer
    try:os.kill(int(owner['pid']),0)
    except (ProcessLookupError,ValueError,TypeError,KeyError):return False
    except PermissionError:pass
    if owner.get('started') and process_started(owner['pid'])!=owner['started']:return False # the PID was reused
    return True


def recover(live,other_vaults=True):
    """Resolve intents a crashed process of this host left unfinished. Writer only.

    Every vault's intents are resolved (an unresolved intent holds store
    publication for the whole host), each one independently: a failure is
    reported and that intent stays unresolved, it never stops the backend.
    Prepared intents of a process that is still running are left to it.
    """
    if live.reader:return []
    results=[];others=set()
    with live.store.lock():
        paths=[(p,False) for p in unresolved(live.store.root)]+[(p,True) for p in pending_prepared(live.store.root)]
        for path,prepared in paths:
            try:intent=json.loads(path.read_text())
            except (OSError,ValueError) as error:results.append({'token':path.stem,'state':'error','reason':str(error)});continue
            if prepared and alive(intent.get('owner'),live.store.writer):continue
            if intent.get('vaultId')!=live.vault_id and intent.get('path') is not None:others.add(intent.get('vaultId'));continue
            try:
                outcome=resolve(live,path.stem,intent,prepared=prepared)
                if outcome:results.append(outcome)
            except Exception as error: # one intent never blocks the others or the backend start
                audit(live.store,{'intent':path.stem,'phase':'recovery-failed','reason':str(error)})
                results.append({'token':path.stem,'kind':intent.get('kind'),'state':'error','reason':str(error)})
    # Other vaults' intents: resolved by that vault's own library instance, after
    # this lock is released (two instances never wait on each other's lock).
    for vault_id in (sorted(v for v in others if v) if other_vaults else ()):
        try:owner=open_owner(live,vault_id)
        except (OSError,ValueError,KeyError) as error:
            results.append({'vaultId':vault_id,'state':'waiting','reason':'its vault is not available on this Mac: '+str(error)});continue
        results.extend(recover(owner,other_vaults=False))
    return results


def open_owner(live,vault_id):
    from live_library import LiveLibrary
    if not live.production:raise ValueError('lab intents belong to their own lab vault')
    registry=json.loads((live.store.root/'vaults.json').read_text())
    root=registry[vault_id]['path']
    return LiveLibrary(live.store.root,root,production=True,role=live.role,writer=live.store.writer_override,recover=False)


def written(journals,key_record,instance=''):
    journal=journals.journals[key_record['journal']]
    return key_record['key'] in journal.keys or bool(journals.parked_events(key=key_record['key'],instance=instance or ''))


def open_group(journals,operation,instance=None):
    """Parked parts of this host's instance of the operation (all instances if None)."""
    return [e for e in journals.parked_events(operation=operation,instance=instance) if e.get('group')]


# Kinds whose KL-produced bytes are only identity markers on the person's own
# text (the editor's observation plans). A prepared one that never reached disk
# exactly is superseded by the next observation, not a review item.
OBSERVATION_KINDS=('component',)


def current_text(live,intent):
    try:return live.read(intent['path'])
    except FileNotFoundError:return '' if intent.get('after')=='' else None
    except (OSError,ValueError):return None


def resolve(live,token,intent,prepared=False):
    """Restart rule (spec 7): finish only a verified postimage, retry only an exact
    preimage, otherwise preserve both versions and flag; every outcome is audited."""
    import operation_kinds
    store=live.store;journals=store.journals;journals.refresh(force=True)
    kind=intent.get('kind') or 'component';handler=operation_kinds.handler(kind)
    intended=intent.get('intended') or []
    instance=intent.get('instance') or ''
    done={k['key']:written(journals,k,instance) for k in intended}
    state=lambda value,**extra:{'token':token,'kind':kind,'state':value,**extra}
    if intended and all(done.values()) and not open_group(journals,intent['operation'],instance):
        handler.completed(live,token,intent)
        finish_record(store,token,prepared,intent,'completed','recovered: every event was already durable');return state('completed')
    if intent.get('path') is None:
        # Journal-only: nothing to verify in a note. A missing event was never written.
        finish_record(store,token,prepared,intent,'cancelled','not written; the client retries with the same idempotency key');return state('cancelled')
    current=current_text(live,intent)
    if intent.get('resultHash') is not None and text_hash(current)==intent['resultHash']:
        # Exact postimage: finish the missing events with the original identities.
        if prepared:begin(store,token,{**intent,'phase':'source-saved'})
        try:handler.finish(live,token,intent,current)
        except Conflict as error:
            if kind in OBSERVATION_KINDS and prepared and not any(done.values()):
                # The journal moved on since this observation plan: the next
                # observation of the note records the current bytes.
                finish_record(store,token,False,intent,'superseded','the index changed since this plan: '+str(error));return state('superseded')
            close_group(store,intent);update_if(store,token,currentHash=text_hash(current))
            end(store,token,'needs-review',str(error));return state('needs-review',reason=str(error))
        end(store,token,'completed','recovered: verified postimage')
        return state('completed',recovered=True)
    if intent.get('inputHash') is not None and text_hash(current)==intent['inputHash'] and not any(done.values()):
        reason=handler.retry(live,token,intent);remove_orphans(live,intent,current)
        finish_record(store,token,prepared,intent,'cancelled','not started: the note still holds the exact preimage; '+reason);return state('cancelled',retry=reason)
    if prepared and not any(done.values()) and kind in OBSERVATION_KINDS:
        finish_record(store,token,True,intent,'superseded','the note moved on before this observation plan was saved');return state('superseded')
    # Divergent text: never replay the old plan over newer bytes. Some kinds can
    # still verify their own result exactly (admission checks every reviewed
    # entry against the current note); otherwise close an open group so the
    # fold voids it as a whole, keep both images and flag for review.
    verified=handler.divergent(live,token,intent,current)
    if verified:
        finish_record(store,token,prepared,intent,'completed','recovered: '+verified);return state('completed',recovered=True)
    close_group(store,intent)
    path=(prepared_folder(store) if prepared else folder(store))/(token+'.json')
    if path.exists():
        value=json.loads(path.read_text());value.update(currentHash=text_hash(current),current=current);atomic_json(path,value)
    handler.review(live,token,intent,current)
    finish_record(store,token,prepared,intent,'needs-review','the note changed after this operation; both versions are preserved')
    return state('needs-review')


def remove_orphans(live,intent,current):
    """Image copies this cancelled operation created and nothing references (Low 4)."""
    import hashlib
    items=intent.get('materialized') or []
    if not items:return
    others=[]
    for path in unresolved(live.store.root)+pending_prepared(live.store.root):
        try:value=json.loads(path.read_text())
        except (OSError,ValueError):continue
        if value.get('token')!=intent.get('token'):others.extend(i.get('sha256') for i in value.get('materialized') or [])
    registry=live.component_registry();registry.load()
    referenced=json.dumps([o for o in registry.occurrences.values() if o.get('alive') and o.get('vault')==live.vault_id])
    for item in items:
        relative=item.get('path','');sha=item.get('sha256','')
        if not relative.startswith('_Knowledge Library assets/') or not re.fullmatch('[0-9a-f]{64}',sha):continue
        target=(live.vault/relative).resolve()
        if not target.is_relative_to(live.vault) or not target.is_file():continue
        name=target.name
        if sha in others or sha in referenced or (current and name in current):continue
        if any(name in note.read_text(errors='replace') for note in live.vault.rglob('*.md')
               if not any(part.startswith('.') for part in note.relative_to(live.vault).parts)):continue # any note (an integrated one too) still embeds it
        if hashlib.sha256(target.read_bytes()).hexdigest()!=sha:continue # replaced since: not ours
        target.unlink();audit(live.store,{'operation':intent.get('operation'),'phase':'orphan-removed','path':relative})


def finish_record(store,token,prepared,intent,phase,reason):
    if prepared:
        path=prepared_folder(store)/(token+'.json')
        if path.exists():retire(store,path,json.loads(path.read_text()),phase,reason);return
    end(store,token,phase,reason)


def update_if(store,token,**fields):
    path=folder(store)/(token+'.json')
    if path.exists():update(store,token,**fields)


def close_group(store,intent):
    """Complete an interrupted event group with audited abort parts (no objects).

    The fold voids a group with an abort part as a whole, on this Mac and on the
    peer: no part of the interrupted operation ever applies.
    """
    journals=store.journals;instance=intent.get('instance') or ''
    parts=open_group(journals,intent['operation'],instance)
    if not parts:return
    group=parts[0]['group'];present=journals.group_parts((intent['operation'],instance))
    journal_of={k['part']:k['journal'] for k in intent.get('intended') or [] if k.get('part')}
    for part in range(1,group['parts']+1):
        if part in present:continue
        kind=journal_of.get(part) or ('entries' if part==group['parts'] else 'components')
        journals.append(kind,operation=intent['operation'],key=intent['operation']+'-abort-'+str(part)+'-'+digest(instance)[:16],
                        intent=digest({'abort':intent['operation'],'part':part,'instance':instance}),objects={},dependencies=[e['hash'] for e in parts],
                        payload={'actor':'operation-recovery','operation':'abort','reason':'interrupted operation; the note diverged'},
                        group={'parts':group['parts'],'part':part,**({'instance':instance} if instance else {})})
    audit(store,{'operation':intent['operation'],'phase':'group-closed','path':intent.get('path')})


def git_blob(text):
    import hashlib
    data=text.encode('utf-8');return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()


HEADER=re.compile(r'^(?P<prefix>(?:[ \t]*>[ \t]?)+)\[!(?P<type>[\w-]+)(?:\|(?P<meta>[^\]]*))?\]')
AT=re.compile(r'(?:^|\s)at=([0-9a-fA-F-]{36})(?:\s|$)')
QUOTE=re.compile(r'^((?:[ \t]*>[ \t]?)*)')


def component_blocks(text):
    """sha256 of each identified component block, exactly as vault-sync's kl_index parses it.

    The two parsers must agree byte for byte (golden test on both sides): the
    receiving Mac labels a component generated only when its block matches.
    """
    import hashlib
    lines=text.splitlines(keepends=True);result={}
    for index,line in enumerate(lines):
        match=HEADER.match(line)
        if not match:continue
        at=AT.search(match.group('meta') or '')
        if not at:continue
        level=match.group('prefix').count('>');end=index+1
        while end<len(lines) and lines[end].strip() and QUOTE.match(lines[end]).group(1).count('>')>=level:end+=1
        key=at.group(1).lower()
        if key in result:return {} # a repeated identity is never labelled
        result[key]=hashlib.sha256(''.join(lines[index:end]).encode('utf-8')).hexdigest()
    return result


def publish_provenance(live,intent,text,generated=()):
    """Host-local handoff to vault-sync: which bytes a KL operation is about to save.

    Written (fsynced by atomic_json) BEFORE the editor or the closed writer saves
    the note, so a capture at any moment after the write finds the label.

    vault-sync adds a KL-Operation trailer to the capture of exactly these
    bytes, and a KL-Generated trailer per generated component, so the other
    Mac can tell a generated update from a human edit before installing it.
    """
    if live.reader:return None
    target=live.store.root/'local'/'provenance';target.mkdir(parents=True,exist_ok=True)
    blocks=component_blocks(text)
    generated=[{**item,'blockHash':blocks.get(str(item['occurrence']).lower())} for item in generated]
    record={'schema':'kl-provenance/1','operation':intent['operation'],'vaultId':live.vault_id,'vaultRoot':str(live.vault),'path':intent['path'],
            'resultHash':digest(text),'blob':git_blob(text),'generated':generated,'at':now()}
    atomic_json(target/(digest({'o':intent['operation'],'p':intent['path']})+'.json'),record)
    return record


class RecoveryWorker:
    """Resolves unresolved intents while the backend runs, not only at start.

    Every `interval` seconds, when there is an unresolved intent (the condition
    on which vault-sync holds the store) or a prepared intent of a process that
    is gone, a fresh library instance of this vault runs recovery. Intents of operations still in
    flight in this process are under the store lock or prepared by this writer,
    so recovery never races them.
    """
    def __init__(self,root,vault,production=False,role=None,interval=30,start=True):
        import threading
        self.root=Path(root);self.vault=vault;self.production=production;self.role=role;self.interval=interval
        self.stop=threading.Event();self.thread=threading.Thread(target=self.run,name='intent-recovery',daemon=True)
        if start:self.thread.start()
    def due(self):
        if unresolved(self.root):return True
        for path in pending_prepared(self.root):
            try:owner=json.loads(path.read_text()).get('owner')
            except (OSError,ValueError):continue
            if not alive(owner,None) and (owner or {}).get('pid')!=os.getpid():return True
        return False
    def tick(self):
        import time
        if time.monotonic()-getattr(self,'swept',-1e9)>3600:
            import integrations
            integrations.sweep(self.root);self.swept=time.monotonic() # records nobody retired (deleted, never-observed notes)
        if not self.due():return []
        from live_library import LiveLibrary
        return LiveLibrary(self.root,self.vault,production=self.production,role=self.role).recovered
    def close(self):self.stop.set()
    def delay(self):
        """30 s; doubling (to 30 min) while something stays unresolved, so an intent that
        cannot be resolved (a vault not mounted) never makes the worker churn."""
        return min(self.interval*(2**getattr(self,'failures',0)),1800)
    def run(self):
        while not self.stop.wait(self.delay()):
            try:
                self.tick();self.failures=getattr(self,'failures',0)+1 if self.due() else 0
            except Exception as error: # reported in the next status; never stops the backend
                self.failures=getattr(self,'failures',0)+1
                try:audit_path=folder_for(self.root)/'audit.jsonl'
                except OSError:continue
                with audit_path.open('a') as out:out.write(json.dumps({'phase':'timed-recovery-failed','reason':str(error),'at':now()})+'\n')


def folder_for(root):
    path=Path(root)/'local'/'intents';path.mkdir(parents=True,exist_ok=True);return path

