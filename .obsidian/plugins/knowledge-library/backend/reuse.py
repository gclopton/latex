"""Guarded reuse and source navigation; source writes remain editor transactions."""
import json
import re
import secrets
import uuid
from pathlib import Path
from library_store import Conflict, atomic_json


def locate(live, entry_id):
    from live_library import candidates
    live.store.load()
    entry=live.reference_entry(entry_id)
    if not entry:raise Conflict('This entry is no longer available.')
    home=entry['home'];root=live.source_root(entry);source=(root/home['path']).resolve()
    if not source.is_relative_to(root):raise Conflict('Source path escapes its vault.')
    text=source.read_bytes().decode('utf-8')
    if home.get('markerFormat')=='component-v1':
        from markdown_scan import components
        matches=[{'line_start':r['line']+1,'line_end':r['line']+1+r['raw'].count('\n')} for r in components(text) if r.get('at')==home['occurrenceId']]
    else:
        matches=[e for e in candidates(text,home['path']) if (
            e['occurrenceId']==home['occurrenceId'] if home.get('mode')!='snapshot'
            else e['body'].replace('\r\n','\n').replace('\r','\n')==entry['body'])]
    if len(matches)!=1:raise Conflict('The source entry is missing or ambiguous. Open the note from its path to reconcile it.')
    obsidian_id=None
    registry=Path.home()/'Library/Application Support/obsidian/obsidian.json'
    if registry.exists():
        try:obsidian_id=next((key for key,row in json.loads(registry.read_text()).get('vaults',{}).items() if Path(row.get('path','')).resolve()==root),None)
        except (ValueError,OSError):pass
    return {'id':entry_id,'path':home['path'],'vault':home['vault'],
            'line':matches[0]['line_start'],'endLine':matches[0]['line_end'],
            'vaultRoot':str(root),'obsidianId':obsidian_id,'mode':home.get('mode','owned'),'occurrenceId':home['occurrenceId']}


def prepare_reuse(live, *, entry_id, revision, path, expected_hash, line, capability,
                  portable_body=None,admit_copy=True):
    raise Conflict('Legacy reuse is disabled; use the component copy plan and guarded editor commit.')


def history(live, entry_id):
    live.store.load()
    if entry_id not in live.store.entries:raise Conflict('Entry unavailable.')
    entry=live.store.entries[entry_id]
    revisions=live.store.history.get(entry_id,[])[-100:];display=[]
    from datetime import datetime
    for revision in revisions:
        if display and revision['actor']=='editor-autosave' and display[-1]['actor']==revision['actor'] and (datetime.fromisoformat(revision['at'])-datetime.fromisoformat(display[-1]['at'])).total_seconds()<600:
            revision={**revision,'editCount':display[-1].get('editCount',1)+1};display[-1]=revision
        else:display.append(revision)
    return {'entry':entry,'revisions':revisions,'displayRevisions':display,
            'parent':live.store.entries.get(entry.get('parent')),
            'variants':[{'id':e['id'],'title':e['title'],'home':e['home'],'revision':e['revision']}
                        for e in live.store.entries.values() if e.get('parent')==entry_id]}
