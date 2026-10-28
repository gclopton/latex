"""Durable image snapshots and destination materialization for component entries."""
import hashlib,os,re,uuid
from pathlib import Path
from urllib.parse import unquote
from library_store import Conflict,digest


def resolve(root,note,target,wiki):
    root=Path(root).resolve();source=root/note
    base=unquote(target).partition('#')[0]
    possibilities=[root/base,source.parent/base] if wiki else [source.parent/base,root/base]
    if not Path(base).suffix:possibilities += [p.with_suffix('.md') for p in possibilities]
    for candidate in possibilities:
        p=candidate.resolve()
        if p.is_relative_to(root) and p.is_file():return p
    names={Path(base).name,Path(base).name+'.md'}
    matches=[p for p in root.rglob('*') if p.is_file() and p.name in names and not any(x.startswith('.') for x in p.relative_to(root).parts)]
    if len(matches)==1:return matches[0]
    raise Conflict('Missing or ambiguous embedded image: '+target)


def rewrite(body,replace):
    from portability import PROTECTED,LINK
    result=[];at=0
    for part in PROTECTED.finditer(body):
        result.append(LINK.sub(replace,body[at:part.start()]));result.append(part[0]);at=part.end()
    result.append(LINK.sub(replace,body[at:]));return ''.join(result)


def image_match(match):
    from portability import IMAGE_EXT
    wiki=match[2] is not None;embed=match[1] if wiki else match[3]
    if not embed:return None
    values=match[2].split('|') if wiki else None
    target=values[0] if wiki else match[5].strip('<>')
    if Path(unquote(target).partition('#')[0]).suffix.lower() not in IMAGE_EXT:return None
    return target,wiki,('|'.join(values[1:]) if len(values)>1 else '') if wiki else match[4]


def blob_path(live,image):
    from portability import IMAGE_EXT
    sha=image.get('sha256','');ext=image.get('extension','')
    if not re.fullmatch('[0-9a-f]{64}',sha) or ext not in IMAGE_EXT:raise Conflict('Invalid image snapshot identity')
    return live.store.root/'assets'/(sha+ext)


def put(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists():
        if path.read_bytes()!=data:raise Conflict('Image snapshot hash collision or damaged asset: '+str(path))
        return
    temp=path.with_name(path.name+'.tmp-'+str(uuid.uuid4()))
    try:
        with temp.open('xb') as out:out.write(data);out.flush();os.fsync(out.fileno())
        try:os.link(temp,path)
        except FileExistsError:
            if path.read_bytes()!=data:raise Conflict('Image asset changed during materialization')
        except OSError as error:
            import errno,fcntl
            if error.errno not in (errno.EPERM,errno.EOPNOTSUPP,errno.ENOSYS,errno.EXDEV):raise
            # Serialize the fallback publisher, then atomically rename the fully
            # fsynced blob. A competing publisher must agree byte-for-byte.
            with (path.parent/'.asset-publish.lock').open('a') as lock:
                fcntl.flock(lock,fcntl.LOCK_EX)
                if path.exists():
                    if path.read_bytes()!=data:raise Conflict('Image asset changed during materialization')
                else:os.replace(temp,path)
        descriptor=os.open(path.parent,os.O_RDONLY)
        try:os.fsync(descriptor)
        finally:os.close(descriptor)
    finally:temp.unlink(missing_ok=True)


def verified(live,image):
    path=blob_path(live,image)
    try:data=path.read_bytes()
    except FileNotFoundError:raise Conflict('Image snapshot unavailable: '+image['sha256'])
    if hashlib.sha256(data).hexdigest()!=image['sha256']:raise Conflict('Image snapshot failed its hash check: '+image['sha256'])
    return path,data


def snapshot(live,entry,previous=None,retain_missing=False):
    """Snapshot local embeds before admission/revision; never mutate note text."""
    root=live.source_root(entry,verify=False);images=[]
    old={(a['target'],a['wiki']):a for a in (previous or {}).get('images',[])}
    def visit(match):
        info=image_match(match)
        if info is None:return match[0]
        target,wiki,label=info
        if re.match(r'^[a-z][a-z0-9+.-]*:',target,re.I) or target.startswith('//'):
            raise Conflict('Download this embedded image into the source vault before admission: '+target)
        try:file=resolve(root,entry['home']['path'],target,wiki)
        except Conflict:
            saved=old.get((target,wiki))
            if not retain_missing or not saved:raise
            verified(live,saved);images.append(saved);return match[0]
        raw=file.read_bytes();sha=hashlib.sha256(raw).hexdigest()
        image={'target':target,'wiki':wiki,'sourcePath':file.relative_to(root).as_posix(),'sha256':sha,'extension':file.suffix.lower()}
        put(blob_path(live,image),raw);images.append(image);return match[0]
    rewrite(entry['body'],visit)
    if not images and not (previous or {}).get('images') and 'images' not in entry:return entry
    return {**entry,'images':images,'imagesHash':digest([(i['sha256'],i['extension']) for i in images])}


def materialize(live,images):
    assets=[]
    for image in images:
        source,data=verified(live,image);relative='_Knowledge Library assets/'+source.name
        destination=(live.vault/relative).resolve()
        if not destination.is_relative_to(live.vault):raise Conflict('Image destination escapes its vault')
        put(destination,data);assets.append({'source':str(source),'path':relative,'sha256':image['sha256']})
    return assets


def semantic_raw(raw,images):
    by_target={(a['target'],a['wiki']):a for a in images}
    by_hash={a['sha256']:a for a in images}
    def replace(match):
        info=image_match(match)
        if info is None:return match[0]
        target,wiki,label=info;image=by_target.get((target,wiki))
        if image is None:image=by_hash.get(Path(unquote(target)).stem)
        if image is None:return match[0]
        return '!['+label+'](sha256:'+image['sha256']+')'
    return rewrite(raw,replace)


def component_images(live,path,rows):
    """Image semantics supplement raw text hashes; paths differ across vaults."""
    from markdown_scan import components
    registry=live.component_registry();registry.load();result={}
    for n,row in enumerate(rows):
        identity=(row.get('id') or '').split('.')[0];previous=registry.entities.get(identity,{})
        if '![' not in row['raw'] and not previous.get('images'):continue
        entry={'body':row['raw'],'home':{'vault':live.vault_id,'vaultId':live.vault_id,'path':path}}
        try:snap=snapshot(live,entry,previous=previous,retain_missing=True)
        except Conflict:
            # A draft may contain an unfinished image path. Admission remains strict.
            if identity in live.store.entries:raise
            continue
        images=snap.get('images',[])
        result[n]={'images':images,'semanticHash':components(semantic_raw(row['raw'],images))[0]['contentHash']}
    return result


def prepare_paste(live,path,text):
    """Make a foreign callout's embedded images available before it is inserted."""
    from markdown_scan import components
    registry=live.component_registry();registry.load();edits=[]
    for row in components(text):
        identity=(row.get('id') or '').split('.')[0];entity=registry.entities.get(identity)
        if not entity or not entity.get('images'):continue
        occ=registry.occurrences.get(row.get('at'));home=registry.occurrences.get(entity['home'])
        if occ and occ.get('alive') and occ['vault']==live.vault_id and occ['path']==path:continue
        if home and home['vault']==live.vault_id:continue
        images=entity['images'];assets=materialize(live,images);dest={a['sha256']:a['path'] for a in assets}
        by_target={(a['target'],a['wiki']):a for a in images}
        def replace(match):
            info=image_match(match)
            if info is None:return match[0]
            target,wiki,label=info;image=by_target.get((target,wiki))
            if not image:return match[0]
            return '![[%s%s]]'%(dest[image['sha256']],('|'+label) if label else '') if wiki else '!['+label+'](<'+dest[image['sha256']]+'>)'
        changed=rewrite(row['raw'],replace)
        if changed!=row['raw'] and not any(a<=row['from']<b for a,b,_ in edits):edits.append((row['from'],row['to'],changed))
    for a,b,value in reversed(edits):text=text[:a]+value+text[b:]
    return text


def affected_notes(live,image_path):
    """Incremental reverse image index; never scan the vault for dependents."""
    live.store.load();sequence=getattr(live,'_image_sequence',None)
    if sequence is None or sequence>live.store.sequence:
        live._image_entries={e['id']:e for e in live.store.entries.values() if live.owns(e) and e.get('images')}
    elif sequence!=live.store.sequence:
        for n in range(sequence+1,live.store.sequence+1):
            for change in live.store.records[n]['changes']:
                entry=change['after'];identity=(entry or change['before'])['id'];live._image_entries.pop(identity,None)
                if entry and live.owns(entry) and entry.get('images'):live._image_entries[identity]=entry
    if sequence!=live.store.sequence:
        index={}
        for entry in live._image_entries.values():
            for image in entry['images']:index.setdefault(image['sourcePath'],set()).add(entry['home']['path'])
        live._image_paths=index;live._image_sequence=live.store.sequence
    if image_path is None:return sorted({p for paths in live._image_paths.values() for p in paths})
    return sorted(live._image_paths.get(image_path,()))


def changed(live,image_path):
    result=[]
    for path in affected_notes(live,image_path):
        text=live.read(path);plan=live.component_plan(path,text,'observe')
        if plan['text']!=text or live.read(path)!=text:raise Conflict('The image owner is being edited; retry after it saves.')
        live.component_finish(plan['token'],text);result.append(live.sync(path))
    return {'paths':affected_notes(live,image_path),'changed':any(r.get('receipt') for r in result)}
