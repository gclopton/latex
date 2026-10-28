"""Portable reference syntax and source-preserving refresh plans.

No filesystem or UI writes. References carry their target and label mode, so a
copied paragraph/equation does not depend on a separate frontmatter map. Native
wikilinks remain useful without this plugin. Same-note targets stay relative.
"""
from dataclasses import dataclass, replace
import hashlib
import re

IDENTIFIER = r'[A-Za-z0-9-]{1,80}'
TARGET = rf'(?:{IDENTIFIER}\.)?{IDENTIFIER}'
PROSE = re.compile(rf'(?<!!)\[\[(?P<link>[^\]\n]+)\]\]%%kl:(?P<mode>[ntbc]):(?P<target>{TARGET})(?::(?P<baseline>[0-9a-f]{{16}}))?%%')
LIBRARY = re.compile(rf'(?<!!)\[(?P<label>[^\]\n]+)\]\((?P<link>obsidian://knowledge-library\?entry=(?P<entry>{IDENTIFIER}))\)%%kl:(?P<mode>[ntbc]):lib\.(?P<target>{IDENTIFIER})(?::(?P<baseline>[0-9a-f]{{16}}))?%%')
MATH = re.compile(rf'\\class\{{(?P<prefix>mjx-|)klref (?P=prefix)kl-(?P<mode>[ntbc])-(?P<target>{IDENTIFIER}(?:_{IDENTIFIER})?)(?: (?P=prefix)kl-label-(?P<baseline>[0-9a-f]{{16}}))?\}}\{{')
FENCE = re.compile(r'^\s*(?:>\s*)*(`{3,}|~{3,})')


@dataclass(frozen=True)
class Reference:
    start: int
    end: int
    kind: str
    mode: str
    target: str
    label: str
    link: str = ''
    separator: str = '|'
    baseline: str = None


def target_key(document, occurrence, current_document):
    if not re.fullmatch(IDENTIFIER, occurrence) or not re.fullmatch(IDENTIFIER, document):
        raise ValueError('Reference identity contains unsupported characters')
    return occurrence if document == current_document else document+'.'+occurrence


def _code_spans(text):
    from markdown_scan import structure
    return structure(text)['protected']


def _legacy_code_spans(text):
    """Exclude examples in fenced and inline code, including quoted fences."""
    spans=[];offset=0;fence=None;start=0
    for line in text.splitlines(True):
        match=FENCE.match(line)
        if match:
            if fence is None:
                fence=match[1];start=offset
            elif match[1][0]==fence[0] and len(match[1])>=len(fence) and not line[match.end():].strip():
                spans.append((start,offset+len(line)));fence=None
        elif fence is None:
            runs=list(re.finditer(r'`+',line));i=0
            while i<len(runs):
                end=next((j for j in range(i+1,len(runs)) if len(runs[j][0])==len(runs[i][0])),None)
                if end is None:i+=1;continue
                spans.append((offset+runs[i].start(),offset+runs[end].end()));i=end+1
        offset+=len(line)
    if fence is not None:spans.append((start,len(text)))
    # Inline code may span newlines. Resolve it only outside fenced ranges.
    runs=list(re.finditer(r'`+',text));i=0
    while i<len(runs):
        run=runs[i]
        if any(a<=run.start()<b for a,b in spans):i+=1;continue
        end=next((j for j in range(i+1,len(runs)) if len(runs[j][0])==len(run[0]) and not any(a<=runs[j].start()<b for a,b in spans)),None)
        if end is None:i+=1;continue
        spans.append((run.start(),runs[end].end()));i=end+1
    # Conservative: never refresh source examples in indented blocks.
    for match in re.finditer(r'(?m)^(?: {4}|\t)[^\n]*(?:\n|$)',text):spans.append(match.span())
    for match in re.finditer(r'<!--.*?(?:-->|\Z)',text,re.S):spans.append(match.span())
    # kl tokens are metadata, not comment openers. An outer comment still wins.
    cursor=0
    while True:
        start=text.find('%%',cursor)
        if start<0:break
        protected_end=next((b for a,b in spans if a<=start<b),None)
        if protected_end is not None:
            cursor=protected_end;continue
        end=text.find('%%',start+2)
        if end<0:break
        cursor=end+2
        if not text.startswith('%%kl:',start):spans.append((start,cursor))
    merged=[]
    for start,end in sorted(spans):
        if merged and start<=merged[-1][1]:merged[-1]=(merged[-1][0],max(end,merged[-1][1]))
        else:merged.append((start,end))
    return merged


def _balanced_end(text,start):
    depth=1;i=start
    while i<len(text):
        if text[i]=='\\':i+=2;continue
        if text[i]=='%':
            newline=text.find('\n',i);i=len(text) if newline<0 else newline+1;continue
        if text[i]=='{':depth+=1
        elif text[i]=='}':
            depth-=1
            if not depth:return i
        i+=1
    return None


def references(text,protected=None):
    spans=_code_spans(text) if protected is None else protected
    matches=sorted([(m,'prose') for m in PROSE.finditer(text)]+[(m,'math') for m in MATH.finditer(text)]+[(m,'library') for m in LIBRARY.finditer(text)],key=lambda item:item[0].start())
    span_index=0;consumed=0
    for match,kind in matches:
        start=match.start()
        while span_index<len(spans) and spans[span_index][1]<=start:span_index+=1
        if start<consumed or (span_index<len(spans) and spans[span_index][0]<=start<spans[span_index][1]):continue
        if kind=='prose':
            parts=re.split(r'(\\?\|)',match['link'],maxsplit=1)
            if len(parts)!=3:continue
            result=Reference(start,match.end(),kind,match['mode'],match['target'],parts[2],parts[0],parts[1])
        elif kind=='library':
            if match['entry']!=match['target']:continue
            result=Reference(start,match.end(),kind,match['mode'],'lib.'+match['target'],match['label'],match['link'])
        else:
            end=_balanced_end(text,match.end())
            if end is None:continue
            result=Reference(start,end+1,kind,match['mode'],match['target'].replace('_','.'),text[match.end():end])
        result=replace(result,baseline=match['baseline'])
        consumed=result.end
        yield result


def _validate(mode,target):
    if mode not in 'ntbc' or len(mode)!=1 or not re.fullmatch(TARGET,target):
        raise ValueError('Invalid reference mode or target')


def label_digest(label):return hashlib.sha256(label.encode('utf-8')).hexdigest()[:16]


def _baseline(label,mode,baseline):
    if baseline=='generate':baseline=label_digest(label) if mode!='c' else None
    if baseline is not None and not re.fullmatch(r'[0-9a-f]{16}',baseline):raise ValueError('Invalid generated-label digest')
    return baseline


def prose_reference(link,label,mode,target,separator="|",baseline='generate'):
    _validate(mode,target)
    if separator not in ('|',r'\|'):raise ValueError('Invalid alias separator')
    if any(c in link for c in ('[',']','|','\n','\r','%%')) or any(c in label for c in ('[',']','|','\n','\r','%%')):
        raise ValueError('Reference label or path needs escaping before insertion')
    baseline=_baseline(label,mode,baseline)
    return '[['+link+separator+label+']]%%kl:'+mode+':'+target+(':'+baseline if baseline else '')+'%%'


def library_reference(entry,label,mode='t',baseline='generate'):
    if not re.fullmatch(IDENTIFIER,entry) or mode not in ('n','t','b','c'):raise ValueError('Invalid library reference')
    if not label or any(c in label for c in ('[',']','|','\n','\r','%%')):raise ValueError('Select words on one line, without brackets or pipes')
    baseline=_baseline(label,mode,baseline)
    return '['+label+'](obsidian://knowledge-library?entry='+entry+')%%kl:'+mode+':lib.'+entry+(':'+baseline if baseline else '')+'%%'


def math_reference(expression,mode,target,baseline='generate'):
    _validate(mode,target)
    # Require a balanced expression; preserve all original TeX inside it.
    if re.search(r'\\class\{(?:mjx-)?klref\b',expression):raise ValueError('Nested references need separate attachments')
    wrapped=expression+'}'
    if _balanced_end(wrapped,0)!=len(expression):raise ValueError('Unbalanced math expression')
    baseline=_baseline(expression,mode,baseline)
    return r'\class{mjx-klref mjx-kl-'+mode+'-'+target.replace('.','_')+(' mjx-kl-label-'+baseline if baseline else '')+'}{'+expression+'}'


def _math_text(text):
    from math_label import math_label
    return math_label(text)


def refresh_plan(text,resolve):
    """resolve(reference) supplies one unambiguous current target, or None.

    Caller owns identity lookup, manual-retarget reconciliation and persistence.
    Resolver may return a diagnostic instead of guessing. Custom expressions
    never change; only their cached native destination may change.
    """
    edits=[];diagnostics=[];protected=_code_spans(text);parsed=list(references(text,protected))
    protected_index=0;reference_index=0
    for token in re.finditer(r'%%kl:[^\n]*?%%|\\class\{(?:mjx-)?klref[^}]*\}',text):
        while protected_index<len(protected) and protected[protected_index][1]<=token.start():protected_index+=1
        if protected_index<len(protected) and protected[protected_index][0]<=token.start()<protected[protected_index][1]:continue
        while reference_index<len(parsed) and parsed[reference_index].end<=token.start():reference_index+=1
        owner=parsed[reference_index] if reference_index<len(parsed) and parsed[reference_index].start<=token.start()<parsed[reference_index].end else None
        if not owner or (token[0].startswith(r'\class') and token.start()!=owner.start):
            diagnostics.append({'start':token.start(),'target':None,'reason':'Orphaned, nested or malformed reference'})
    for ref in parsed:
        target=resolve(ref)
        if not target or target.get('issue'):
            diagnostics.append({'start':ref.start,'target':ref.target,'reason':target.get('issue') if target else 'Target unavailable'})
            continue
        if target.get('warningCode'):
            diagnostics.append({'start':ref.start,'target':ref.target,'reason':target['warning'],'code':target['warningCode'],'severity':'warning'})
        label=ref.label
        if ref.mode!='c':
            number,title=target.get('numberLabel',''),target.get('title','')
            label={'n':number,'t':title,'b':target.get('bothLabel',': '.join(s for s in (number,title) if s))}[ref.mode]
            if not label:
                diagnostics.append({'start':ref.start,'target':ref.target,'reason':'Requested label is unavailable'});continue
        try:
            if ref.mode!='c':
                canonical=_math_text(label) if ref.kind=='math' else label
                if ref.baseline:
                    if label_digest(ref.label)!=ref.baseline:raise ValueError('Edited dynamic label; preserve it as custom or restore its generated label')
                elif ref.label!=canonical:raise ValueError('Generated label baseline is unknown; explicitly refresh it or keep it as custom')
            baseline='generate' if ref.baseline else None
            if ref.kind=='prose':
                replacement=prose_reference(target.get('link',ref.link),label,ref.mode,ref.target,ref.separator,baseline)
            elif ref.kind=='library':
                replacement=library_reference(ref.target[4:],label,ref.mode,baseline)
            else:
                replacement=math_reference(label if ref.mode=='c' else _math_text(label),ref.mode,ref.target,baseline)
        except ValueError as error:
            diagnostics.append({'start':ref.start,'target':ref.target,'reason':str(error)});continue
        if replacement!=text[ref.start:ref.end]:edits.append({'start':ref.start,'end':ref.end,'before':text[ref.start:ref.end],'after':replacement})
    return {'sourceHash':hashlib.sha256(text.encode()).hexdigest(),'edits':edits,'diagnostics':diagnostics}


def apply_plan(text,plan):
    if hashlib.sha256(text.encode()).hexdigest()!=plan['sourceHash']:raise ValueError('Note changed; recompute the reference plan')
    cursor=0;parts=[]
    for edit in plan['edits']:
        if not cursor<=edit['start']<=edit['end']<=len(text) or text[edit['start']:edit['end']]!=edit['before']:
            raise ValueError('Invalid or overlapping reference edits')
        parts.extend((text[cursor:edit['start']],edit['after']));cursor=edit['end']
    parts.append(text[cursor:]);return ''.join(parts)


def qualify_paste_plan(text,source_document,source_path,destination_document):
    """Qualify each partial-copy reference independently; preserve uncertain ones.

    Caller must surface diagnostics before persisting a paste. A whole-note copy
    does not use this operation: local identities intentionally stay relative.
    """
    plan={'sourceHash':hashlib.sha256(text.encode()).hexdigest(),'edits':[],'diagnostics':[]}
    if source_document==destination_document:return plan
    normalize=lambda path:path.removesuffix('.md')
    for ref in references(text):
        if '.' in ref.target:continue
        try:
            target=target_key(source_document,ref.target,destination_document)
            if ref.kind=='prose':
                path,separator,fragment=ref.link.partition('#')
                if not separator or (path and normalize(path)!=normalize(source_path)):
                    raise ValueError('Relative identity disagrees with native path')
                replacement=prose_reference(source_path+'#'+fragment,ref.label,ref.mode,target,ref.separator,ref.baseline)
            else:replacement=math_reference(ref.label,ref.mode,target,ref.baseline)
        except ValueError as error:
            plan['diagnostics'].append({'start':ref.start,'target':ref.target,'reason':str(error)})
            continue
        plan['edits'].append({'start':ref.start,'end':ref.end,'before':text[ref.start:ref.end],'after':replacement})
    return plan


def qualify_paste(text,source_document,source_path,destination_document):
    """Compatibility helper; editor adapters should consume qualify_paste_plan."""
    return apply_plan(text,qualify_paste_plan(text,source_document,source_path,destination_document))
