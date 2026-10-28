"""Panel suffixes address one figure entity, never extra library entries."""
import re
UUID=r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}'
def split(identity):
    match=re.fullmatch('('+UUID+r')-panel-([A-Za-z0-9]{1,8})',identity)
    return (match[1],match[2]) if match else (identity,None)
def panels(body):
    explicit=re.search(r'(?:\||\s)panels=([A-Za-z0-9,]+)(?=\s|\])',body.split('\n',1)[0])
    if explicit:return list(dict.fromkeys(explicit[1].split(',')))
    prose=re.sub(r'\$\$.*?\$\$|\$[^$\n]*\$','',body,flags=re.S)
    return list(dict.fromkeys(re.findall(r'(?:^|[\s>*;:])\(([a-z]|[ivx]{1,4}|[1-9][0-9]?)\)(?=[\s*.,:])',prose)))
def labels(value,panel):
    result=dict(value)
    for key in ('numberLabel','title','bothLabel'):
        if result.get(key):result[key]+='('+panel+')'
    result['panel']=panel;return result
