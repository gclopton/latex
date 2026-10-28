"""Resolve entry links at their source; bundle local images for cross-vault reuse."""
import hashlib
import re
from pathlib import Path
from urllib.parse import quote,unquote
from library_store import Conflict

# Protect inline/display mathematics and code from Markdown-link rewriting.
PROTECTED=re.compile(r'```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$\n])*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]')
LINK=re.compile(r'(!?)\[\[([^\]\n]+)\]\]|(!?)\[([^\]\n]*)\]\((<[^>\n]+>|[^)\n]+)\)')
IMAGE_EXT={'.png','.jpg','.jpeg','.gif','.webp','.svg','.avif'}

def portable(live, entry_id, preview=False, entry=None):
    live.store.load();entry=entry or live.reference_entry(entry_id)
    if not entry:raise Conflict('Entry unavailable.')
    from image_assets import snapshot,verified,image_match
    if 'images' not in entry:entry=snapshot(live,entry)
    images={(i['target'],i['wiki']):i for i in entry.get('images',[])}
    source_root=live.source_root(entry,verify=False);source=source_root/entry['home']['path']
    different=source_root!=live.vault;assets=[];warnings=[]
    def resolve(raw,wiki):
        raw=unquote(raw);base,sep,fragment=raw.partition('#')
        if not base:return source,('#'+fragment if sep else '')
        possibilities=[source_root/base,source.parent/base] if wiki else [source.parent/base,source_root/base]
        if not Path(base).suffix:possibilities += [p.with_suffix('.md') for p in possibilities]
        for candidate in possibilities:
            p=candidate.resolve()
            if p.is_relative_to(source_root) and p.is_file():return p,('#'+fragment if sep else '')
        # Obsidian allows a shortest unambiguous name. Search only if direct resolution failed.
        names={Path(base).name,Path(base).name+'.md'}
        matches=[p for p in source_root.rglob('*') if p.is_file() and p.name in names and not any(x.startswith('.') for x in p.relative_to(source_root).parts)]
        if len(matches)==1:return matches[0],('#'+fragment if sep else '')
        raise Conflict('Missing or ambiguous source link: '+raw)
    def replace(match):
        wiki=match[2] is not None
        embed=match[1] if wiki else match[3]
        if wiki:
            values=match[2].split('|');target=values[0];label='|'.join(values[1:]) if len(values)>1 else Path(target.split('#')[0]).stem or target
        else:
            label=match[4];target=match[5].strip('<>')
        if re.match(r'^[a-z][a-z0-9+.-]*:',target,re.I) or target.startswith('//'):return match[0]
        image=images.get((target,wiki)) if embed else None
        if image:
            snapshot_file,raw=verified(live,image)
            if preview:
                key='knowledge-library-asset:'+str(len(assets));assets.append({'source':str(snapshot_file),'key':key,'sha256':image['sha256']})
                return f'![{label}](<{key}>)'
            original=source_root/image['sourcePath']
            if different or not original.is_file():
                destination='_Knowledge Library assets/'+snapshot_file.name
                assets.append({'source':str(snapshot_file),'path':destination,'sha256':image['sha256']})
                return ('![['+destination+('|'+'|'.join(values[1:]) if len(values)>1 else '')+']]') if wiki else f'![{label}](<{destination}>)'
            relative=image['sourcePath']
            return ('![['+relative+('|'+'|'.join(values[1:]) if len(values)>1 else '')+']]') if wiki else f'![{label}](<{relative}>)'
        file,fragment=resolve(target,wiki);relative=file.relative_to(source_root).as_posix()
        if embed and file.suffix.lower() in IMAGE_EXT:
            if preview:
                key='knowledge-library-asset:'+str(len(assets));assets.append({'source':str(file),'key':key})
                return f'![{label}](<{key}>)'
            if different:
                raw=file.read_bytes();digest=hashlib.sha256(raw).hexdigest()
                destination='_Knowledge Library assets/'+digest+file.suffix.lower()
                assets.append({'source':str(file),'path':destination,'sha256':digest})
                return ('![['+destination+('|'+'|'.join(values[1:]) if len(values)>1 else '')+']]') if wiki else f'![{label}](<{destination}>)'
        if different:
            url='obsidian://open?path='+quote(str(file)+fragment,safe='')
            if embed:warnings.append('Embedded note opens at its source: '+relative)
            return f'[{label}](<{url}>)'
        if wiki:return ('!' if embed else '')+'[['+relative+fragment+('|'+'|'.join(values[1:]) if len(values)>1 else '')+']]'
        return ('!' if embed else '')+f'[{label}](<{relative+fragment}>)'
    result=[];at=0
    for part in PROTECTED.finditer(entry['body']):
        result.append(LINK.sub(replace,entry['body'][at:part.start()]));result.append(part[0]);at=part.end()
    result.append(LINK.sub(replace,entry['body'][at:]))
    return {'body':''.join(result),'assets':assets,'warnings':warnings}
