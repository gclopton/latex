"""Install the reviewed library plugin; enrollment never reads note contents."""
import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path
from library_store import PortableLibrary,atomic_json
from vault_registry import enroll

PROJECT=Path(__file__).resolve().parent
# B4 store root; the retired single-writer root (.../library) is fenced by retire_root().
DEFAULT_LIBRARY=Path.home()/'Library/Application Support/Knowledge Library/library-b4'

def install(vault,root,backup,template=False):
    vault=Path(vault);config=vault if template else vault/'.obsidian'
    if not config.is_dir():raise ValueError('Missing configuration folder: '+str(config))
    plugin=config/'plugins'/'knowledge-library';plugin.mkdir(parents=True,exist_ok=True)
    relative=vault.name+('-template' if template else '')
    for source in [config/'community-plugins.json',config/'hotkeys.json',plugin/'main.js',plugin/'manifest.json',plugin/'styles.css',plugin/'data.json']:
        if source.exists():
            target=backup/relative/source.relative_to(config);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
    shutil.copy2(PROJECT/'dist/main.js',plugin/'main.js');shutil.copy2(PROJECT/'plugin/styles.css',plugin/'styles.css')
    manifest=json.loads((PROJECT/'plugin/manifest.json').read_text())
    manifest.update(id='knowledge-library',name='Index',version='0.2.1',description='Reviewed cross-vault definitions, results, theorems and equations. Browse, reuse and edit sources.')
    atomic_json(plugin/'manifest.json',manifest)
    data=json.loads((plugin/'data.json').read_text()) if (plugin/'data.json').exists() else {}
    data.update(enrolled=True,libraryRoot=str(root))
    atomic_json(plugin/'data.json',data)
    enabled=json.loads((config/'community-plugins.json').read_text()) if (config/'community-plugins.json').exists() else []
    if 'knowledge-library' not in enabled:enabled.append('knowledge-library')
    atomic_json(config/'community-plugins.json',enabled)
    hotkeys=json.loads((config/'hotkeys.json').read_text()) if (config/'hotkeys.json').exists() else {}
    hotkeys['knowledge-library:browse-window']=[{'modifiers':['Mod'],'key':'K'}]
    hotkeys['editor:insert-link']=[{'modifiers':['Mod','Shift'],'key':'K'}]
    atomic_json(config/'hotkeys.json',hotkeys)
    if not template:enroll(PortableLibrary(root,mode='PRODUCTION'),vault)
    assert (plugin/'main.js').read_bytes()==(PROJECT/'dist/main.js').read_bytes()
    return {'vault':str(vault),'template':template,'plugin':'knowledge-library','enabled':True}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--vault',action='append',default=[]);ap.add_argument('--all',action='store_true');ap.add_argument('--template');ap.add_argument('--root',type=Path,default=DEFAULT_LIBRARY);ap.add_argument('--plan',action='store_true');args=ap.parse_args()
    vaults=[Path(v) for v in args.vault]
    if args.all:
        vaults.extend(p for p in (Path.home()/'ObsidianVaults').iterdir() if (p/'.obsidian').is_dir() and not(p.name.endswith('_lab') or p.name.startswith('test') or p.name.startswith('knowledge_library_')))
    vaults=sorted(set(vaults))
    if args.plan:print(json.dumps({'vaults':[str(v) for v in vaults],'template':args.template},indent=2));return
    if args.root.resolve()==DEFAULT_LIBRARY.resolve():
        store=PortableLibrary(args.root,mode='PRODUCTION')
        with store.lock():
            store.config.setdefault('backupRoot',str(Path.home()/'ObsidianBackups/knowledge_library/verified'))
            atomic_json(store.config_path,store.config);store.try_backup()
    backup=PROJECT/'outputs'/('deployment-'+datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True)
    results=[install(v,args.root,backup) for v in vaults]
    if args.template:results.append(install(Path(args.template),args.root,backup,template=True))
    atomic_json(backup/'receipt.json',{'installed':results,'library':str(args.root),'automaticAdmissions':0})
    print(json.dumps({'count':len(results),'receipt':str(backup/'receipt.json'),'automaticAdmissions':0}))

if __name__=='__main__':main()
