"""Membership lifecycle over the existing portable transaction journal.

Returns guarded editor plans; never writes note files or scans a vault.
"""
from library_store import Conflict, atomic_json, digest
from pathlib import Path
import json


def preview(live, identity):
    live.store.load(); registry=live.component_registry();registry.load()
    entry=live.store.entries.get(identity)
    if not entry:raise Conflict('This callout is no longer in the index.')
    copies=[dict(registry.occurrences[at]) for at in registry.by_entity.get(identity,())
            if registry.occurrences[at].get('alive')]
    roots_file=live.store.root/'lab-roots.json'
    roots=json.loads(roots_file.read_text()) if roots_file.exists() else {}
    for occurrence in copies:
        root=roots.get(occurrence['vault'])
        occurrence['vaultLabel']=str(Path(root).parent.name)+' / '+Path(root).name if root else occurrence['vault']
    return {'id':identity,'title':entry['title'],'revision':entry['revision'],
            'copies':sorted(copies,key=lambda o:(o['vault'],o['path'],o['at']))}


def remove(live, identity, revision, key):
    return live.store.commit(**live.metadata(),key=key,actor='component-membership',
        changes=[{'id':identity,'expectedRevision':revision,'entry':None}],operation='remove-from-index')


def undo(live, target, key):
    return live.store.undo(**live.metadata(),key=key,target=target,actor='component-membership')


def replay(live, cursor=None, limit=100, audit=False):
    """Page durable membership changes, resolving only indexed occurrences.

    Cursor is acknowledged by the client only after ALL note plans finish. A
    crash before acknowledgement repeats a page safely. Bootstrap additionally
    checks the occurrence journal, covering a replaced/deleted index.
    """
    store=live.store;store.load();registry=live.component_registry();registry.load()
    if not isinstance(limit,int) or not 1<=limit<=500:raise ValueError('Invalid replay page size')
    token={'profile':store.config['id'],'epoch':store.config['epoch']}
    valid=isinstance(cursor,dict) and all(cursor.get(k)==v for k,v in token.items())
    since=cursor.get('sequence',0) if valid else 0
    if not isinstance(since,int) or since<0:raise ValueError('Invalid library sequence')
    if since>store.sequence:valid=False;since=0
    end=min(store.sequence,since+limit);affected=set();removals=[];updates=set();signals=set()
    for n in range(since+1,end+1):
        record=store.records[n]
        for change in record['changes']:
            before,after=change['before'],change['after']
            if before and after and (before.get('body')!=after.get('body') or before.get('imagesHash')!=after.get('imagesHash')):
                updates.add(after['id']);affected.add(after['id'])
            if bool(before)==bool(after):continue
            identity=(after or before)['id'];affected.add(identity)
            if before and not after:removals.append({'id':identity,'key':record['key'],'sequence':n})
    if not valid or audit:
        # Registry index, not a filesystem scan. Only this vault's enrolled
        # entities are considered when the store/cursor is new or replaced.
        registered_paths={registry.occurrences[at]['path']
                          for ats in registry.by_vault.get(live.vault_id,{}).values()
                          for at in ats}
        for path in registered_paths:
            for row in registry.notes.get(live.vault_id+'\n'+path,{}).get('rows',[]):
                identity=row.get('id')
                if identity and identity.endswith('.library')!=(identity.split('.')[0] in store.entries):
                    affected.add(identity.split('.')[0])
    component_since=cursor.get('components',0) if valid else 0
    if not isinstance(component_since,int) or not 0<=component_since<=registry.sequence:component_since=0
    component_end=min(registry.sequence,component_since+limit)
    for n in range(component_since+1,component_end+1):
        event=json.loads((registry.root/f'{n:012d}.json').read_text())
        for identity in event['entities']:
            signals.update(registry.descendants(identity))
    affected.update(signals)
    paths=set();ids=set();update_paths={}
    for identity in affected:
        for at in registry.by_entity.get(identity,()):
            occurrence=registry.occurrences[at]
            if occurrence.get('alive') and occurrence['vault']==live.vault_id:
                paths.add(occurrence['path']);ids.add(identity)
                if identity in updates and registry.entities.get(identity,{}).get('home')!=at:
                    update_paths.setdefault(occurrence['path'],set()).add(identity)
    return {'cursor':{**token,'sequence':end,'components':component_end},'more':end<store.sequence or component_end<registry.sequence,
            'paths':sorted(paths),'removals':[r for r in removals if r['id'] in ids],
            'updates':sorted(updates & ids),'signals':sorted(signals & ids),
            'updatePaths':{path:sorted(values) for path,values in update_paths.items()},
            'membership':{identity:identity in store.entries for identity in ids}}


def replacement(row, source, document, take_type=False):
    """Apply source content while keeping this occurrence's presentation/IDs.

    Matching nested occurrences keep their own header metadata and fold state.
    New nested items are allocated occurrence keys by the normal identity plan.
    """
    from markdown_scan import components
    from callout_labels import parse_label
    from component_identities import header
    from collections import defaultdict, deque
    current=components(source)[0]
    local=parse_label(row['type'],row['title']);name=parse_label(current['type'],current['title'])['nameText']
    title=(local['prefixText']+(': '+name if name else '')) if local['number'] else name
    typ=current['type'] if take_type else row['type']
    head=row['header'][:row['header'].index(']')+1]+row['fold']+(' '+title if title else '')
    if typ!=row['type']:head=head.replace('[!'+row['type'],'[!'+typ,1)
    result=head+current['raw'][len(current['header']):]
    old=defaultdict(deque)
    for nested in components(row['raw'])[1:]:
        if nested.get('id'):old[nested['id'].split('.')[0]].append(nested)
    edits=[]
    for nested in components(result)[1:]:
        matches=old.get((nested.get('id') or '').split('.')[0])
        if not matches:continue
        dest=matches.popleft();label=parse_label(dest['type'],dest['title'])
        name=parse_label(nested['type'],nested['title'])['nameText']
        title=label['prefixText']+(': '+name if name else '') if label['number'] else name
        h=dest['header'][:dest['header'].index(']')+1]+dest['fold']+(' '+title if title else '')
        edits.append((nested['from'],nested['headerTo'],h))
    for start,end,h in reversed(edits):result=result[:start]+h+result[end:]
    prefix=document[document.rfind('\n',0,row['from'])+1:row['from']]
    if prefix:result=result.replace('\n','\n'+prefix)
    return result


def propagation_text(live,path,text,identities,verified_rows=()):
    """Replace untouched same-ID occurrences, preserving local presentation."""
    from markdown_scan import components
    registry=live.component_registry();registry.load();live.store.load()
    result=text;updated=[];rows=components(text);covered=[]
    from image_assets import component_images,materialize
    from portability import portable
    for n,data in component_images(live,path,rows).items():rows[n].update(data)
    for row in rows:
        if not row.get('id') or row['id'].split('.')[0] not in identities:continue
        identity=row['id'].split('.')[0];entity=registry.entities.get(identity);occ=registry.occurrences.get(row.get('at'))
        if not entity or not occ or entity['home']==row['at'] or identity not in live.store.entries:continue
        if row.get('at') not in verified_rows and (row['contentHash'] if occ.get('hashVersion')==2 else row['legacyContentHash'])!=occ.get('contentHash'):raise Conflict('A copied callout has unsaved content edits; finish that edit before updating it.')
        if (row.get('semanticHash') or row['contentHash'])==(entity.get('semanticHash') or entity.get('contentHash')):continue
        if any(start<=row['from']<end for start,end,_ in covered):continue
        source=entity['raw']
        entry=live.store.entries[identity]
        if entry.get('images'):
            prepared=portable(live,identity);materialize(live,entry['images']);source=prepared['body']
        covered.append((row['from'],row['to'],replacement(row,source,text)))
        updated.append({'id':identity,'at':row['at']})
    for start,end,value in reversed(covered):result=result[:start]+value+result[end:]
    return result,updated


def propagation_plan(live,path,text,identities,verified_rows=()):
    from markdown_scan import components
    changed,updates=propagation_text(live,path,text,identities,verified_rows)
    plan=live.component_plan(path,changed,'sync')
    saved_path=live.plans/'components'/(plan['token']+'.json')
    saved=json.loads(saved_path.read_text())
    saved['undo']={'text':text,'afterHash':digest(plan['text'])}
    updated_at={u['at'] for u in updates}
    saved['propagation']={'updates':updates,'afterRows':{r['at']:{'contentHash':r['contentHash']} for r in components(plan['text']) if r.get('at') in updated_at}}
    atomic_json(saved_path,saved)
    return {**plan,'updates':updates}


def propagation_resume(live,token,text,identities=()):
    """Resume exact writes, or rebase verified occurrences around unrelated edits."""
    import re
    if not re.fullmatch(r'[A-Za-z0-9_-]{32}',token):raise ValueError('Invalid propagation receipt')
    location=live.plans/'components'/(token+'.json');saved=json.loads(location.read_text())
    if not saved.get('propagation') or not saved.get('undo'):raise Conflict('Not a copy update receipt')
    after=saved.get('resultHash') or saved['plan']['resultHash']
    if digest(text)==after:
        if 'finished' not in saved:
            # Another note may have advanced the shared identity journal while
            # this vault was closed. Replan the exact verified post-write text,
            # retaining the original Undo snapshot and the stable receipt token.
            registry=live.component_registry();registry.load()
            if saved['plan']['sequence']!=registry.sequence:
                from image_assets import component_images
                from markdown_scan import components
                saved['plan']=registry.plan(live.vault_id,saved['path'],text,operation='sync',image_rows=component_images(live,saved['path'],components(text)))
                atomic_json(location,saved)
            live.component_finish(token,text)
        return {'state':'complete','updates':saved['propagation']['updates'],'path':saved['path']}
    if text==saved['undo']['text']:return {'state':'retry','updates':[],'path':saved['path']}
    # Editing another paragraph does not make the copied callout a conflict.
    # Verify the affected occurrences individually, then keep the current note
    # around them, including any new position, numbering and fold state.
    from markdown_scan import components
    before={r.get('at'):r for r in components(saved['undo']['text'])}
    after_text=saved.get('plan',{}).get('text')
    if after_text is None:
        # A completed receipt retains hashes of just its updated occurrences.
        after_rows=saved['propagation'].get('afterRows',{})
    else:after_rows={r.get('at'):r for r in components(after_text)}
    current={r.get('at'):r for r in components(text)};verified=set();edits=[];updates=[]
    for update in saved['propagation']['updates']:
        at=update['at'];row=current.get(at);old=before.get(at);new=after_rows.get(at)
        if row is None:continue # A deliberate deletion must not be resurrected.
        hashes={r['contentHash'] for r in (old,new) if r}
        if not row.get('id') or row['id'].split('.')[0]!=update['id'] or row['contentHash'] not in hashes:
            raise Conflict('The copied callout changed during an interrupted index update. Its draft and Undo receipt were preserved.')
        verified.add(at);updates.append(update)
        if old:edits.append((row['from'],row['to'],replacement(row,old['raw'],text)))
    ids=set(identities)|{u['id'] for u in updates}
    plan=propagation_plan(live,saved['path'],text,ids,verified)
    undo_text=text
    for start,end,value in sorted(edits,reverse=True):undo_text=undo_text[:start]+value+undo_text[end:]
    location=live.plans/'components'/(plan['token']+'.json');rebased=json.loads(location.read_text())
    combined={u['at']:u for u in updates+plan['updates']}
    rebased['undo']['text']=undo_text;rebased['propagation']['updates']=list(combined.values())
    rebased['propagation']['afterRows']={r['at']:{'contentHash':r['contentHash']} for r in components(plan['text']) if r.get('at') in combined}
    atomic_json(location,rebased)
    plan['updates']=list(combined.values())
    return {'state':'rebase','path':saved['path'],'plan':plan,'updates':[]}


def propagation_undo(live,token,text):
    import re
    if not re.fullmatch(r'[A-Za-z0-9_-]{32}',token):raise ValueError('Invalid propagation receipt')
    saved=json.loads((live.plans/'components'/(token+'.json')).read_text())
    undo=saved.get('undo')
    if not undo or digest(text)!=undo['afterHash']:raise Conflict('This note changed after the update; Undo would overwrite that edit.')
    return live.component_plan(saved['path'],undo['text'],'undo')
