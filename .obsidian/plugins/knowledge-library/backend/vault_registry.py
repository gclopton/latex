"""Explicit vault enrollment. Registering never scans or admits note contents."""
import json
import uuid
from pathlib import Path
from library_store import Conflict, atomic_json

def enroll(store, vault):
    from host_role import require_writer
    # The marker is synced: rewriting it on a reader would move the vault to
    # another library on every Mac.
    require_writer(store,'Enrolling a vault')
    vault=Path(vault).resolve()
    if not (vault/'.obsidian').is_dir():raise ValueError('An existing Obsidian vault is required.')
    with store.lock():
        registry_path=store.root/'vaults.json'
        registry=json.loads(registry_path.read_text()) if registry_path.exists() else {}
        existing=next((key for key,row in registry.items() if row['path']==str(vault)),None)
        identity_file=vault/'.knowledge-library'/'vault.json'
        marker=json.loads(identity_file.read_text()) if identity_file.exists() else {}
        identity=existing or marker.get('id') or str(uuid.uuid4())
        if identity in registry and registry[identity]['path']!=str(vault):
            old_marker=Path(registry[identity]['path'])/'.knowledge-library'/'vault.json'
            old=json.loads(old_marker.read_text()) if old_marker.exists() else {}
            # Preserve identity for a move; a simultaneously existing copy gets its own.
            if old.get('id')==identity:identity=str(uuid.uuid4())
        # The marker syncs to every Mac. It is written only when it is missing
        # or must change for this vault's own copy, and it is never switched to
        # another library: that would move the vault on both Macs.
        if marker.get('library') not in (None,store.config['id']):
            raise Conflict('This vault belongs to another library ('+str(marker.get('library'))+'); it is not re-enrolled automatically.')
        wanted={**marker,'id':identity,'library':store.config['id']}
        if wanted!=marker:
            identity_file.parent.mkdir(exist_ok=True)
            atomic_json(identity_file,wanted)
        registry[identity]={'path':str(vault),'name':vault.name}
        atomic_json(registry_path,registry)
        store.try_backup()
        return identity

def identity(store,vault,strict_path=True):
    registry_path=store.root/'vaults.json'
    registry=json.loads(registry_path.read_text()) if registry_path.exists() else {}
    marker=Path(vault)/'.knowledge-library'/'vault.json'
    value=json.loads(marker.read_text()) if marker.exists() else {}
    key=value.get('id')
    # vaults.json is host-local (this Mac's paths). A reader never enrolls, so
    # it relies on the synced marker alone: same library, a vault id present.
    if not strict_path:
        if value.get('library')!=store.config['id'] or not key:raise Conflict('This vault has not been enrolled in this library.')
        return key
    if value.get('library')!=store.config['id'] or key not in registry or registry[key]['path']!=str(Path(vault).resolve()):
        raise Conflict('This vault has not been enrolled in this library.')
    return key

def root_for(store,home,verify=True):
    registry=json.loads((store.root/'vaults.json').read_text())
    row=registry.get(home.get('vaultId'))
    if not row:raise Conflict('Source vault is unavailable.')
    root=Path(row['path']).resolve()
    if verify:identity(store,root,strict_path=not getattr(store,'reader',False))
    return root
