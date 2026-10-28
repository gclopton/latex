"""Durable, guarded stored-label refresh, using the existing reverse index.

No filesystem writes to notes here: the Obsidian adapter owns open/closed
note transactions. A receipt is acknowledged only after the file is durable.
"""
import hashlib,json,secrets
from library_store import atomic_json,Conflict
from reference_format import references,refresh_plan,apply_plan
from reference_insert import editor_changes


def plan(live,path,text):
    policy=live.numbering_policy(path);live.guard_numbering(path,policy)
    index_revision=live.reference_index().revision
    refs=list(references(text));targets=list(dict.fromkeys(r.target for r in refs));resolved={}
    for offset in range(0,len(targets),256):
        batch=targets[offset:offset+256]
        overlay=live.editor_reference_targets(path,text,batch)['targets']
        foreign=[t for t,v in overlay.items() if v.get('issueCode')=='not-own-target']
        if foreign:overlay.update(live.resolve_reference_targets(path,foreign)['targets'])
        resolved.update(overlay)
    result=refresh_plan(text,lambda ref:resolved.get(ref.target));after=apply_plan(text,result)
    result.update(path=path,afterHash=hashlib.sha256(after.encode()).hexdigest(),text=after,
                  editorChanges=editor_changes(text,result['edits']),policyDigest=policy['policyDigest'],bookKey=policy['bookKey'],indexRevision=index_revision)
    # Persist only plans which will write; no unbounded receipt per idle check.
    if result['edits']:
        result['token']='labels-'+secrets.token_hex(16)
        atomic_json(live.plans/(result['token']+'.json'),{**result,'state':'reference-labels'})
    return result


def finish(live,result,text):
    if result.get('token'):
        token=result['token']
        if not isinstance(token,str) or not token.startswith('labels-') or not token[7:].isalnum():raise Conflict('Invalid label receipt')
        saved=json.loads((live.plans/(token+'.json')).read_text())
        if saved.get('state') not in ('reference-labels','reference-labels-finished'):raise Conflict('Invalid label receipt')
        result=saved
    if hashlib.sha256(text.encode()).hexdigest()!=result['afterHash']:raise Conflict('Labels changed before acknowledgement; re-plan')
    live.guard_numbering(result['path'],result)
    if live.read(result['path'])!=text:raise Conflict('Reference labels have not reached disk yet')
    index=live.reference_index()
    changed_during_write=index.revision!=result['indexRevision']
    live.index_reference_note(result['path'],result['afterHash'])
    row=index.db.execute('SELECT revision FROM pending WHERE path=?',(result['path'],)).fetchone()
    if row and not changed_during_write:index.finish(result['path'],row['revision'],result['afterHash'],result['diagnostics'])
    if result.get('token'):atomic_json(live.plans/(result['token']+'.json'),{**result,'state':'reference-labels-finished'})
    return {'path':result['path'],'updated':len(result['edits']),'diagnostics':result['diagnostics'],'retry':changed_during_write}
