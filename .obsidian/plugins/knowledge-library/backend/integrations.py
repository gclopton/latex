"""Integration records: vault-sync tells the index which note bytes arrived from the other Mac.

vault-sync writes, before it installs an integrated note into a vault (host-local,
never synced): <store>/local/integrations/<key>.json, key = sha256 of the
normalized vault root + "\\n" + normalized path (Unicode NFC, case-folded, so the
two programs agree whatever spelling of the root each one was given):

  {"schema": "kl-integration/1", "vaultRoot": ..., "path": ...,
   "blocks": {occurrence id: sha256 of its block in the installed bytes, or null if
              the integration removed it}, "operations": [KL-Operation ids], "at": ...}

Both programs change a record only under the same lock
(<store>/local/integrations/.lock), so neither ever loses the other's update.

The index never originates events from a row exactly as integrated while one of
the record's KL operations is not folded into its journal (the other Mac's
events explain the row). When none is owed, the integrated text is observed
normally (both Macs then write the same revision). A row typed on top of an
integrated version waits the same way, then is recorded on top of it.
The block hash is the same parser on both sides (operations.component_blocks /
vault_sync.kl_index.block_hashes, golden-tested).
"""
import fcntl
import hashlib
import json
import unicodedata
from contextlib import contextmanager
from datetime import datetime,timezone
from pathlib import Path

SCHEMA='kl-integration/1'
ESCALATE_SECONDS=15*60 # a wait older than this is shown as a needs-review item


def normalized(value):
    return unicodedata.normalize('NFC',str(value)).casefold()


def record_key(vault_root,path):
    return hashlib.sha256((normalized(Path(vault_root).resolve())+'\n'+normalized(path)).encode()).hexdigest()


def folder(store_root):return Path(store_root)/'local'/'integrations'


def record_path(store_root,vault_root,path):
    return folder(store_root)/(record_key(vault_root,path)+'.json')


@contextmanager
def lock(store_root):
    """The lock vault-sync takes for the same read-modify-write (kl_index.integration_record)."""
    target=folder(store_root);target.mkdir(parents=True,exist_ok=True)
    with (target/'.lock').open('a') as handle:
        fcntl.flock(handle.fileno(),fcntl.LOCK_EX)
        try:yield
        finally:fcntl.flock(handle.fileno(),fcntl.LOCK_UN)


def load(store_root,vault_root,path):
    """The whole record ({} if none)."""
    try:value=json.loads(record_path(store_root,vault_root,path).read_text())
    except (OSError,ValueError):return {}
    if not isinstance(value,dict) or value.get('schema')!=SCHEMA or normalized(value.get('path',''))!=normalized(path):return {}
    if not isinstance(value.get('blocks'),dict):return {}
    return value


def read(store_root,vault_root,path):
    return load(store_root,vault_root,path).get('blocks',{})


def changed_blocks(before,after):
    from operations import component_blocks
    old=component_blocks(before) if before is not None else {}
    new=component_blocks(after) if after is not None else {}
    result={at:digest for at,digest in new.items() if old.get(at)!=digest}
    result.update({at:None for at in old if at not in new})
    return result


def record(store_root,vault_root,path,before,after,operations=(),now=None):
    """Write (merge) a record, exactly as vault-sync does before installing `after`. Used by tests and tools."""
    from library_store import atomic_json
    blocks=changed_blocks(before,after)
    if not blocks:return None
    with lock(store_root):
        prior=load(store_root,vault_root,path)
        value={'schema':SCHEMA,'vaultRoot':str(Path(vault_root).resolve()),'path':path,'blocks':{**prior.get('blocks',{}),**blocks},
               'operations':sorted(set(prior.get('operations') or [])|set(operations)),
               # Retain the start of this pending record. Unrelated later
               # integrations must not postpone a held row's escalation.
               'at':prior.get('at') or (datetime.fromtimestamp(now,timezone.utc).isoformat() if now else datetime.now(timezone.utc).isoformat())}
        atomic_json(record_path(store_root,vault_root,path),value)
    return value


def retire(store_root,vault_root,path,satisfied):
    """Drop entries the journal now agrees with (writer hosts only), under the shared lock."""
    if not satisfied:return
    from library_store import atomic_json
    with lock(store_root):
        target=record_path(store_root,vault_root,path);value=load(store_root,vault_root,path)
        if not value:return
        blocks={at:h for at,h in value['blocks'].items() if at not in satisfied}
        if blocks:atomic_json(target,{**value,'blocks':blocks})
        else:target.unlink(missing_ok=True)


def age_seconds(value,now=None):
    try:at=datetime.fromisoformat(value['at'])
    except (KeyError,TypeError,ValueError):return 0
    now=datetime.now(timezone.utc) if now is None else now
    return (now-at).total_seconds()


def flag_path(store_root,vault_root,path):
    return Path(store_root)/'local'/'intents'/'review'/('awaiting-'+record_key(vault_root,path)+'.json')


def escalate(store_root,vault_root,path,waiting,owed):
    """A wait that outlived ESCALATE_SECONDS becomes a visible needs-review item (live-status)."""
    from library_store import atomic_json
    target=flag_path(store_root,vault_root,path);target.parent.mkdir(parents=True,exist_ok=True)
    atomic_json(target,{'schema':'kl-awaiting/1','kind':'awaiting-source','vaultRoot':str(Path(vault_root).resolve()),'path':path,
                        'rows':waiting,'owedOperations':sorted(owed),'reason':'the other Mac\'s index events for this note have not arrived',
                        'at':datetime.now(timezone.utc).isoformat()})


def clear_flag(store_root,vault_root,path):
    flag_path(store_root,vault_root,path).unlink(missing_ok=True)


def sweep(store_root,max_age_seconds=30*86400):
    """Expire only unflagged records without operation obligations.

    Retaining an already-folded operation record costs a small local JSON file;
    expiring an owed one could silently adopt another host's generated bytes.
    Normal observation retires satisfied records with their exact row checks.
    """
    with lock(store_root):
        for target in folder(store_root).glob('*.json'):
            try:value=json.loads(target.read_text())
            except (OSError,ValueError):continue
            if not isinstance(value,dict):continue
            if value.get('operations') or (Path(store_root)/'local'/'intents'/'review'/('awaiting-'+target.stem+'.json')).exists():continue
            if age_seconds(value)>max_age_seconds:target.unlink(missing_ok=True)
