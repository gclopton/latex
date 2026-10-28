"""Conservative display-only copy grouping; never semantic identity or deduplication."""
import hashlib
import json
import posixpath
import re
from pathlib import PurePosixPath
from urllib.parse import unquote

HEADER=re.compile(r'^\s*>\s*\[![^\]]+\][-+]?\s*(.*)$')
NUMBERED=re.compile(r'^[-–—]?\s*(?:definition|theorem|lemma|corollary|proposition|result|equation|identity|assumption|rule|convention|notation|property|key[ -]point)\s+\d+(?:\.\d+)*(?:\s*[:.\-–—]\s*|\s+|$)',re.I)
OUTLINE=re.compile(r'^\s*>?\s*%%\s*callout-outline:[^\n]*%%\s*$',re.I)

def links(body):
    # Brackets inside math are mathematical notation, not wikilinks.
    text=re.sub(r'(?s)\$\$.*?\$\$|(?<!\\)\$[^$]*?(?<!\\)\$|\\\[.*?\\\]|\\\(.*?\\\)', '',body)
    return [m[1].split('|',1)[0] for m in re.finditer(r'!?\[\[([^\]\n]+)\]\]',text)]+[unquote(m[1]) for m in re.finditer(r'!?\[[^\]\n]*\]\(([^)\n]+)\)',text)]

def link_context(body,vault,path,names=None):
    resolved=[]
    for raw in links(body):
        if re.match(r'^\w+://',raw):resolved.append(raw);continue
        target,_,fragment=raw.partition('#')
        if not target:resolved.append((vault,path,fragment));continue
        joined=posixpath.normpath((PurePosixPath(path).parent/target).as_posix())
        possible=(names or {}).get((vault,target.removesuffix('.md')),set()) or (names or {}).get((vault,joined.removesuffix('.md')),set())
        if len(possible)==1:resolved.append((vault,next(iter(possible)),fragment))
        elif len(possible)>1:resolved.append(('ambiguous',vault,path,raw))
        else:resolved.append((vault,joined,fragment))
    return resolved

def display_key(kind,title,body,vault='',path='',names=None):
    lines=body.replace('\r\n','\n').replace('\r','\n').split('\n')
    match=HEADER.match(lines[0]) if lines else None
    heading=NUMBERED.sub('',match[1] if match else title).strip()
    content='\n'.join(line.rstrip() for line in (lines[1:] if match else lines) if not OUTLINE.match(line)).strip()
    return hashlib.sha256(json.dumps([kind,heading,content,link_context(content,vault,path,names)],ensure_ascii=False).encode()).hexdigest()
