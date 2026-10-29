"""Deterministic identity derivation and the enrollment gate (B4).

Both Macs opening the same unmarked note at the same committed version derive
byte-identical identities, so their header edits and ownership events agree
(Git merges the identical edits; the journal deduplicates the identical
operation). The derivation input is pinned: (parser version, vault UUID,
repository-relative path, base blob hash, occurrence ordinal in parser order,
identity kind).

Enrollment of unmarked components runs only when the note's saved file, the
committed HEAD blob and the editor buffer are the same bytes, and vault-sync
reports a fresh, fully integrated state for the vault. Otherwise it waits and
retries; already assigned identities are never regenerated.
"""
import hashlib
import json
import subprocess
import time
import uuid
from pathlib import Path

PARSER='kl-components/1'
NAMESPACE=uuid.UUID('6f0b4f8e-3c55-4b8e-9b55-6b2f4a1c0b44')
FRESH_SECONDS=180
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


def sync_state(vault,status_path=None,now=None):
    """(fresh, reason) from vault-sync's host-local status for this vault root."""
    try:report=json.loads(Path(status_path or STATUS).read_text())
    except (OSError,ValueError):return False,'vault-sync status is unavailable'
    now=time.time() if now is None else now
    if report.get('paused'):return False,'vault-sync is paused'
    if not isinstance(report.get('at'),(int,float)) or now-report['at']>FRESH_SECONDS:return False,'vault-sync status is stale'
    root=str(Path(vault).resolve())
    row=next((r for r in report.get('vaults',{}).values() if isinstance(r,dict) and r.get('root')==root),None)
    if row is None:return False,'this vault is not managed by vault-sync'
    if row.get('state') in ('error','conflict','offline','paused') or row.get('error'):return False,'vault-sync reports '+str(row.get('state'))
    if row.get('captured')!=row.get('published'):return False,'local changes are not published yet'
    for host,peer in (row.get('peers') or {}).items():
        published=(peer.get('state') or {}).get('published')
        if published and published!=row.get('applied'):return False,'changes from '+host+' are not integrated yet'
    return True,None


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
    fresh,reason=SYNC_STATE(live.vault,status) if status else SYNC_STATE(live.vault)
    if not fresh:return {**ctx,'ok':False,'reason':reason}
    return ctx
