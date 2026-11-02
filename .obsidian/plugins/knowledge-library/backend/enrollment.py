"""Deterministic identity derivation and the enrollment gate (B4).

Both Macs opening the same unmarked note at the same committed version derive
byte-identical identities, so their header edits and ownership events agree
(Git merges the identical edits; the journal deduplicates the identical
operation). The derivation input is pinned: (parser version, vault UUID,
repository-relative path, base blob hash, occurrence ordinal in parser order,
identity kind).

Enrollment of unmarked components runs only when the note's saved file, the
committed HEAD blob and the editor buffer are the same bytes, with no known
conflict or receive affecting this note. Publication of unrelated files and
peer availability are not identity prerequisites. Divergent offline edits of
the same unmarked callout remain a same-note conflict when integrated; a
status report cannot prove the absence of unpublished work on another Mac.
Already assigned identities are never regenerated.
"""
import hashlib
import json
import subprocess
import uuid
from pathlib import Path

PARSER='kl-components/1'
NAMESPACE=uuid.UUID('6f0b4f8e-3c55-4b8e-9b55-6b2f4a1c0b44')
STATUS=Path.home()/'Library'/'Application Support'/'VaultSync'/'status.json'


def git_blob(text):
    data=text.encode('utf-8');return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()


def derive(vault_uuid,path,blob,ordinal,kind):
    return str(uuid.uuid5(NAMESPACE,json.dumps([PARSER,vault_uuid,path,blob,ordinal,kind],separators=(',',':'))))


def git_binary():
    # The pinned Homebrew Git that vault-sync uses on both Macs, when present.
    pinned=Path('/opt/homebrew/bin/git')
    return str(pinned) if pinned.exists() else 'git'


def head_blob(vault,path):
    """Blob id of the note at HEAD, or None (not a Git repository or untracked)."""
    try:
        result=subprocess.run([git_binary(),'-C',str(vault),'rev-parse','--verify','--quiet','HEAD:./'+path],capture_output=True,text=True,timeout=10)
    except (OSError,subprocess.TimeoutExpired):return None
    value=result.stdout.strip()
    return value if result.returncode==0 and len(value)==40 else None


def sync_state(vault,status_path=None,now=None,*,path=None):
    """Durable local readiness; status.json is only a display snapshot.

    The optional status path selects VaultSync's state directory (which also
    contains registry.json, pause.json, pending/ and vaults/). Neither its age
    nor its incremental row set gates authoring. No network calls are made.
    """
    state=Path(status_path or STATUS).parent
    def read_json(target,default=None):
        try:return json.loads(target.read_text())
        except FileNotFoundError:return default
    try:
        config=read_json(state/'registry.json')
        if not isinstance(config,dict) or config.get('schema')!=1 or not isinstance(config.get('vaults'),list):
            return False,'vault-sync registry is unavailable or invalid'
        host=config.get('host');root=Path(vault).resolve();matches=[]
        for row in config['vaults']:
            if not isinstance(row,dict):return False,'vault-sync registry is invalid'
            local=(row.get('hosts') or {}).get(host,{})
            if isinstance(local,dict) and isinstance(local.get('root'),str) and Path(local['root']).expanduser().resolve()==root:
                matches.append((row,local))
        if len(matches)!=1:return False,'this vault is not uniquely managed by vault-sync'
        row,local=matches[0];key=row.get('id');branch=row.get('branch')
        if not isinstance(key,str) or not key or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in key):
            return False,'vault-sync identity is invalid'
        if not isinstance(branch,str) or not branch:return False,'vault-sync branch is invalid'
        pause=read_json(state/'pause.json',{})
        if not isinstance(pause,dict):return False,'vault-sync pause record is invalid'
        if pause.get('paused'):return False,'vault-sync is paused'
        snapshot=read_json(state/'vaults'/(key+'.json'),{})
        if not isinstance(snapshot,dict):return False,'vault-sync vault record is invalid'
        if snapshot.get('paused') or snapshot.get('state')=='paused':return False,'vault-sync is paused for this vault'
        if path is None:return False,'a note path is required to check readiness'
        def git(*args):
            return subprocess.run([git_binary(),'-C',str(root),*args],capture_output=True,text=True,timeout=10)
        prefix=git('rev-parse','--show-prefix');top=git('rev-parse','--show-toplevel')
        if prefix.returncode or top.returncode:return False,'cannot resolve the note repository'
        if Path(top.stdout.rstrip('\n')).resolve()!=Path(local.get('repositoryRoot','')).expanduser().resolve():
            return False,'the note repository differs from its registry'
        if git('check-ref-format','refs/heads/'+branch).returncode:return False,'vault-sync branch is invalid'
        current=git('symbolic-ref','--short','HEAD')
        if current.returncode or current.stdout.rstrip('\n')!=branch:return False,'the note branch differs from its registry'
        note=prefix.stdout.rstrip('\n')+path
        for field in ('conflictPaths','reviewConflictPaths'):
            paths=snapshot.get(field,[])
            if not isinstance(paths,list) or any(not isinstance(p,str) for p in paths):return False,'vault-sync conflict paths are invalid'
            if note in paths:return False,'this note has a synchronization conflict'
        if snapshot.get('state')=='conflict' and not snapshot.get('conflictPaths'):
            return False,'vault-sync reports a conflict without affected paths'
        pending=read_json(state/'pending'/(key+'.json'))
        if pending is not None:
            if not isinstance(pending,dict) or not isinstance(pending.get('paths'),list) or any(not isinstance(p,str) for p in pending['paths']):
                return False,'the pending receive record is invalid'
            if note in pending['paths']:return False,'this note has a pending receive'
        # The service fetches origin's enrolled branch. Its tracking ref is
        # durable even when the report is partial or an outgoing transfer stalls.
        mapping=git('config','--get-all','remote.origin.fetch')
        allowed={'refs/heads/*:refs/remotes/origin/*',
                 'refs/heads/'+branch+':refs/remotes/origin/'+branch}
        mappings=mapping.stdout.splitlines()
        if mapping.returncode or not mappings or any(m.lstrip('+') not in allowed for m in mappings):
            return False,'the incoming revision cannot be tracked with this fetch mapping'
        remote=git('rev-parse','--verify','--quiet','refs/remotes/origin/'+branch)
        if remote.returncode not in (0,1):return False,'cannot inspect the incoming revision'
        if remote.returncode==0:
            revision=remote.stdout.strip()
            ancestor=git('merge-base','--is-ancestor',revision,'HEAD')
            if ancestor.returncode not in (0,1):return False,'cannot inspect incoming ancestry'
            if ancestor.returncode==1:
                bases=git('merge-base','--all','HEAD',revision)
                if bases.returncode or not bases.stdout.strip():return False,'incoming history has no common base'
                for base in bases.stdout.splitlines():
                    changed=git('diff','--quiet',base,revision,'--',':(literal)'+path)
                    if changed.returncode==1:return False,'an incoming version of this note has not been integrated'
                    if changed.returncode:return False,'cannot inspect the incoming note'
        return True,None
    except (OSError,ValueError,TypeError,AttributeError,subprocess.SubprocessError):
        return False,'vault-sync local readiness records cannot be read'


# Injectable for tests and for hosts without vault-sync (library.local.json:
# "enrollmentGate": "none" for a vault that exists on one Mac only).
SYNC_STATE=sync_state


def context(live,path,text):
    """Enrollment context for one plan; ok=False means unmarked callouts wait."""
    blob=git_blob(text)
    ctx={'vaultUuid':live.vault_id,'path':path,'blob':blob,'ok':True,'reason':None}
    if not live.production:return ctx
    gate=live.store.local_config.get('enrollmentGate','vault-sync')
    if gate=='none':return ctx # a vault that exists on this Mac only
    try:saved=live.read(path)
    except (OSError,ValueError):saved=None
    if saved!=text:return {**ctx,'ok':False,'reason':'the note is not saved yet'}
    if head_blob(live.vault,path)!=blob:return {**ctx,'ok':False,'reason':'the note has changes that vault-sync has not captured yet'}
    status=live.store.local_config.get('vaultSyncStatus') # vault-sync's registry.state/status.json if not the default
    fresh,reason=SYNC_STATE(live.vault,status,path=path) if status else SYNC_STATE(live.vault,path=path)
    if not fresh:return {**ctx,'ok':False,'reason':reason}
    return ctx
