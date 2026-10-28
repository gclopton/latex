"""Read authored labels without changing source or inventing library numbers.

The shared JSON fixtures also define the contract for the renderer. Published
numbers are strings: dotted sections, appendices and panels are not decimals.
"""
import re
from functools import lru_cache

ALIASES = {'vocabulary': 'definition', 'problem': 'exercise', 'fig': 'figure',
           'eq': 'equation', 'def': 'definition'}
LABELS = ('definition', 'theorem', 'corollary', 'lemma', 'proposition', 'equation',
          'identity', 'relation', 'assumption', 'rule', 'convention', 'axiom',
          'postulate', 'result', 'notation', 'table', 'law', 'principle',
          'property', 'formula', 'figure', 'exercise', 'example', 'problem',
          'vocabulary', 'self-test', 'fig', 'eq', 'def')
PREFIX = re.compile(r'^('+'|'.join(LABELS)+r')\b\.?', re.I)
NUMBER = re.compile(r'(?:[A-Za-z]+\d+|[A-Za-z]+[.-]\d+|\d+)(?:[.-]\d+)*(?:\([A-Za-z0-9]+\))?')

@lru_cache(maxsize=256)
def custom_prefix(kind):
    return re.compile(r'^('+r'[-_\s]+'.join(re.escape(word) for word in re.split(r'[-_\s]+',kind))+r')\b\.?',re.I)


def single_parenthesis_group(text):
    depth=0
    for index,char in enumerate(text):
        if char=='(':depth+=1
        elif char==')':
            depth-=1
            if depth==0:return index==len(text)-1
            if depth<0:return False
    return False


def parse_label(kind, title):
    kind = ALIASES.get(kind.lower(), kind.lower())
    original_title=title.strip()
    title = title.strip().lstrip('-').strip()
    result = dict(kind=kind, number=None, nameText=title, label=None, issue=None, prefixText=None)
    prefix = PREFIX.match(title)
    custom = prefix is None
    if custom:prefix=custom_prefix(kind).match(title)
    if not prefix:
        return result
    tail = title[prefix.end():].lstrip()
    number = NUMBER.match(tail)
    # A number must end cleanly. Never turn "1.4 .4" into result "1.4".
    if number:
        rest = tail[number.end():]
        if re.match(r'\s*\.\s*\d', rest) or (rest and not re.match(r'(?:\s|[.:—–-]|\()', rest)):
            result['issue'] = 'Unparsed authored number'
            return result
        result['kind'] = kind if custom else ALIASES.get(prefix[1].lower(), prefix[1].lower())
        result['number'] = number[0]
        prefix_end=prefix.end()+len(title[prefix.end():])-len(tail)+number.end()
        result['prefixText']=original_title[:len(original_title)-len(title)+prefix_end]
        result['label'] = prefix[0].capitalize() + ' ' + number[0]
        name = rest.strip().lstrip(':—–-').strip()
        if name.startswith('.'):
            name = name[1:].strip()
        group=name[:-1] if name.endswith(').') else name
        if group.startswith('(') and single_parenthesis_group(group):
            name = group[1:-1]
        result['nameText'] = name
    elif tail.startswith(':'):
        result['kind'] = kind if custom else ALIASES.get(prefix[1].lower(), prefix[1].lower())
        result['nameText'] = tail[1:].strip()
    return result


def body_title(lines, kind):
    """Only an explicit matching caption can supply an empty header's title."""
    for line in lines:
        text = re.sub(r'^\s*(?:>\s*)+', '', line).strip()
        if not text:
            continue
        parsed = parse_label(kind, text)
        return text if parsed['number'] and parsed['kind'] == ALIASES.get(kind, kind) else None
    return None


def library_component(body):
    """Remove occurrence numbering from component headers, preserving body math.

    Parse actual headers so fenced examples and mathematical numbers survive.
    A source's author label and n= policy remain only in its note.
    """
    from markdown_scan import components
    rows=components(body);result=body
    for row in reversed(rows):
        title=parse_label(row['type'],row['title'])['nameText']
        tokens=[t for t in row['metadata'].split() if not t.startswith('n=')]
        old=row['header'];head=old[:old.index('[!')]+'[!'+row['type']+('|'+' '.join(tokens) if tokens else '')+']'
        replacement=head+row['fold']+(' '+title if title else '')
        result=result[:row['from']]+replacement+result[row['headerTo']:]
    title=parse_label(rows[0]['type'],rows[0]['title'])['nameText'] if rows else ''
    return {'title':title or (rows[0]['type'].replace('-',' ').capitalize() if rows else 'Callout'),'body':result.replace('\r\n','\n').replace('\r','\n')}
