"""Shared short-form filters for the picker and shell; formulas remain literal."""
import re

def apply(request,live,catalog):
    request=dict(request);filters={'t':[],'b':[],'#':[]}
    def take(m):
        key=m[1].rstrip(':');filters[key].append(m[2].strip('"'));return ''
    # Dollar-delimited formula fragments must never be treated as filter text.
    pieces=re.split(r'(\$[^$]*\$)',request.get('query',''))
    request['query']=''.join(p if p.startswith('$') else re.sub(r'(?<!\S)(t:|b:|#)("[^"]+"|[^\s;]+)',take,p) for p in pieces).strip()
    if filters['t']:
        wanted={t.casefold() for t in filters['t']};ids=[t['id'] for t in catalog['types'] if t['id'].casefold() in wanted or t.get('name','').casefold() in wanted]
        request['types']=[i for i in ids if request.get('types') is None or i in request['types']]
    if filters['b']:request['books']=list(dict.fromkeys([*request.get('books',[]),*filters['b']]))
    if filters['#']:
        registry=live.component_registry();registry.load();wanted={t.casefold() for t in filters['#']}
        ids=[id for id,e in registry.entities.items() if wanted.issubset(set(e.get('tags',[])))]
        request['entryIds']=[i for i in ids if request.get('entryIds') is None or i in request['entryIds']]
    return request
