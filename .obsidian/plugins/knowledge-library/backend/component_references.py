"""References to component headers, with no detached block anchors.

The shared entity is the link target. Numbering belongs to the preferred
occurrence in the destination note, or to its home when used elsewhere.
"""
import hashlib
from pathlib import Path
from reference_document import catalog
from reference_format import library_reference,apply_plan,references
from reference_insert import editor_offsets,editor_changes
from markdown_scan import structure


def cached_catalog(live,root,path,text,policy):
    source=(root/path).resolve()
    if not source.is_relative_to(root):raise ValueError('Source escapes its vault')
    signature=live.reference_signature(source) if text is None else None
    # Signature lookup avoids rereading a source within and between batches;
    # the actual catalog cache key still includes its content hash and policy.
    from collections import OrderedDict
    if not hasattr(live,'_component_source_catalogs'):live._component_source_catalogs=OrderedDict()
    files=live._component_source_catalogs;key=(str(root),path,tuple(signature) if signature else None,policy['policyStamp'])
    catalogs=live.editor_catalog_cache()
    if signature and key in files:
        row=catalogs.by_key(files[key])
        if row:files.move_to_end(key);return row['data']
    if text is None:text=source.read_bytes().decode('utf-8')
    digest=hashlib.sha256(text.encode()).hexdigest();catalog_key=('component-source',str(root),path,digest,policy['policyStamp'])
    row=catalogs.by_key(catalog_key)
    if row is None:row=catalogs.put(catalog_key,catalog(text,path,config=policy['config']),{'sourcePath':str(source),'sourceHash':digest,'policyStamp':policy['policyStamp']})
    if signature:
        if live.reference_signature(source)!=signature:raise ValueError('Source changed while resolving its references')
        files[key]=catalog_key
        while len(files)>64:files.popitem(last=False)
    return row['data']


def display(data,identity,path):
    rows=[r for r in data['occurrences'] if r.get('entityId')==identity]
    if not rows:return None
    row=rows[0];result=dict(row['display'])
    result['title']=result.get('title') or result.get('displayType') or row['kind'].capitalize()
    if not result.get('bothLabel'):result['bothLabel']=result['title']
    return {**result,'path':path,'line':row['line'],'entityId':identity,'occurrenceKey':row['occurrenceKey'],
            'link':'obsidian://knowledge-library?entry='+identity}


def resolve(live,path,identity,text=None,data=None,cache=None):
    from figure_panels import split,panels,labels
    base,panel=split(identity)
    if panel:
        entry=live.reference_entry(base)
        if not entry or entry['kind']!='figure' or panel not in panels(entry['body']):return {'issueCode':'missing-panel','issue':'This figure panel is no longer available'}
        value=resolve(live,path,base,text,data,cache)
        return labels(value,panel) if value and not value.get('issue') else value
    cache={} if cache is None else cache
    registry=live.component_registry();registry.load();entity=registry.entities.get(identity)
    if data is None:
        # Only read this note when its indexed occurrences include this entity.
        own=any(registry.occurrences[a]['path']==path for a in registry.by_vault.get(live.vault_id,{}).get(identity,()))
        if text is not None or own:
            key=('own',path)
            if key not in cache:cache[key]=cached_catalog(live,live.vault,path,text,live.numbering_policy(path))
            data=cache[key]
    result=display(data,identity,path) if data else None
    if result:return result
    if not entity:return None  # A pre-component library entry uses its existing resolver.
    home=registry.occurrences.get(entity['home'])
    if not home or not home.get('alive'):return {'issueCode':'missing','issue':'This callout has been removed'}
    entry=live.reference_entry(identity)
    if not entry:return {'issueCode':'missing','issue':'This callout has been removed'}
    root=live.source_root(entry);source=(root/home['path']).resolve()
    if not source.is_relative_to(root):raise ValueError('Source escapes its vault')
    try:
        from numbering_policy import NumberingPolicies
        key=('source',str(root),home['path'])
        if key not in cache:
            policies=live.numbering_snapshot() if root==live.vault else NumberingPolicies(root).snapshot()
            cache[key]=cached_catalog(live,root,home['path'],None,policies.resolve(home['path']))
        data=cache[key]
    except (OSError,ValueError) as error:return {'issueCode':'unavailable','issue':str(error)}
    result=display(data,identity,home['path'])
    if result is None:return {'issueCode':'missing','issue':'The source callout is missing'}
    result['sourceContext']=str(Path(home['path']).parent)
    result['vaultId']=home['vault']
    return result


def insertion(live,path,text,expected_hash,selection,identity,mode='auto'):
    if hashlib.sha256(text.encode()).hexdigest()!=expected_hash:raise ValueError('The note changed')
    start,end=editor_offsets(text,selection);parsed=structure(text)
    for a,b in parsed['protected']+parsed['math']:
        if start<b and end>a or start==end and a<=start<b:raise ValueError('Choose prose outside code or equation')
    for a,b in parsed['links']:
        if start<b and end>a or start==end and a<start<b:raise ValueError('Choose prose outside an existing link')
    if any(start<r.end and end>r.start for r in references(text,parsed['protected'])):raise ValueError('Do not nest references')
    resolved=resolve(live,path,identity,text)
    if not resolved or resolved.get('issue'):raise ValueError((resolved or {}).get('issue','The target is unavailable'))
    if mode=='auto':mode='n' if resolved.get('numberLabel') else 't'
    if mode not in ('n','t','b','c'):raise ValueError('Invalid label mode')
    label={'n':resolved.get('numberLabel'),'t':resolved.get('title'),'b':resolved.get('bothLabel'),'c':text[start:end]}[mode]
    if not label:raise ValueError('This result has no requested label')
    edit={'start':start,'end':end,'before':text[start:end],'after':library_reference(identity,label,mode)}
    plan={'path':path,'sourceHash':expected_hash,'edits':[edit],'componentReference':True,'entryId':identity,'mode':mode,'selection':selection,
          'reference':{'target':'lib.'+identity,'mode':mode,'label':label}}
    plan['afterHash']=hashlib.sha256(apply_plan(text,plan).encode()).hexdigest()
    plan['editorChanges']=editor_changes(text,plan['edits'])
    return plan


def local_insertion(live,path,text,expected_hash,at,selection,mode='auto',reservation=None):
    from math_reference_draft import reserve_component,verify_reservation
    from markdown_scan import components
    rows=[r for r in components(text) if r['from']==at]
    if len(rows)!=1:raise ValueError('Choose a callout again')
    row=rows[0];policy=live.numbering_policy(path)
    if row.get('id'):return insertion(live,path,text,expected_hash,selection,row['id'].split('.')[0],mode)
    if reservation:verify_reservation(reservation,text,path,'prose',config=policy['config'])
    else:reservation=reserve_component(text,path,expected_hash,at,'prose',policy['config'])
    data=catalog(text,path,config=policy['config']);resolved=next(r['display'] for r in data['occurrences'] if r['from']==at)
    start,end=editor_offsets(text,selection);parsed=structure(text)
    if any(start<b and end>a or start==end and a<=start<b for a,b in parsed['protected']+parsed['math']+parsed['links']):raise ValueError('Choose prose outside code, math and links')
    if any(start<r['headerTo'] and end>r['from'] or start==end and r['from']<=start<r['headerTo'] for r in components(text)):raise ValueError('Insert references in the body, not a header')
    if mode=='auto':mode='n' if resolved.get('numberLabel') else 't'
    label={'n':resolved.get('numberLabel'),'t':resolved.get('title') or row['type'].capitalize(),'b':resolved.get('bothLabel'),'c':text[start:end]}.get(mode)
    if not label:raise ValueError('Choose a reference label')
    edits=reservation['identityEdits']+[{'start':start,'end':end,'before':text[start:end],'after':library_reference(reservation['identity'],label,mode)}]
    edits.sort(key=lambda e:e['start'])
    plan={'path':path,'sourceHash':expected_hash,'selection':selection,'at':at,'mode':mode,'reservation':reservation,'componentLocal':True,'edits':edits}
    plan['afterHash']=hashlib.sha256(apply_plan(text,plan).encode()).hexdigest();plan['editorChanges']=editor_changes(text,edits)
    return plan


def copy_body(live,identity,revision,materialize_assets=True):
    from component_identities import header,fresh
    from markdown_scan import components
    from portability import portable
    registry=live.component_registry();registry.load();entry=live.reference_entry(identity)
    if not entry or entry['revision']!=revision:raise ValueError('The entry changed. Refresh the picker.')
    if identity not in registry.entities:raise ValueError('Open the source vault to initialize this legacy callout, or convert it first.')
    portable_entry=portable(live,identity)
    from image_assets import materialize,snapshot
    # Assets are durable before any caller can insert the returned Markdown.
    if materialize_assets and portable_entry['assets']:
        materialize(live,entry.get('images') or snapshot(live,entry).get('images',[]))
    body=portable_entry['body'];rows=components(body)
    if not rows or rows[0]['from']!=0:raise ValueError('The index entry must contain a callout')
    root=rows[0];edits=[]
    live.store.load()
    for row in rows:
        entity=identity if row is root else (row.get('id') or '').split('.')[0]
        if not entity:entity=fresh()
        suffix='.library' if entity in live.store.entries else '.local'
        value=header(row,entity+suffix,fresh(),identity if row is root else None)
        if row is root:
            # Destination numbering is computed from its own position and policy.
            from callout_labels import parse_label
            title=parse_label(entry['kind'],entry['title'])['nameText']
            close=value.index(']');fold=value[close+1:close+2] if value[close+1:close+2] in ('+','-') else ''
            value=value[:close+1]+fold+(' '+title if title else '')
        import re
        value=re.sub(r'(?<=\s)n=[^\s\]]+','',value)
        edits.append((row['from'],row['headerTo'],value))
    for a,b,value in reversed(edits):body=body[:a]+value+body[b:]
    if '^kl-' in body or '<!-- knowledge-library' in body:raise ValueError('Convert legacy anchors in this entry before reusing it.')
    return {'body':body,'id':identity,'revision':revision}
