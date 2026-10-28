"""Explicit callout actions. Plans preserve source outside the owned setting."""
import hashlib
import re
from markdown_scan import structure,numbering_patch
from numbering_policy import validate
from callout_labels import ALIASES
from reference_document import catalog,OVERRIDE
from reference_insert import editor_changes


class NumberingEditError(ValueError):
    code='numbering-edit'

def source_hash(text):return hashlib.sha256(text.encode('utf-8')).hexdigest()


def checked_source(text,expected_hash):
    if not isinstance(text,str) or len(text.encode('utf-8'))>8*1024*1024:raise ValueError('This note exceeds the 8 MiB interactive snapshot limit')
    if source_hash(text)!=expected_hash:raise ValueError('The note changed; reopen the callout controls')


def numbering_context(text,path,expected_hash,base=None,registered=None):
    checked_source(text,expected_hash);parsed=structure(text)
    override=parsed.get('numbering',{});issue=parsed.get('numberingIssue')
    try:validate(override)
    except ValueError as error:issue=issue or str(error)
    if issue:override=None
    data=catalog(text,path,registered,base,parsed)
    return {'settings':override,'effective':data['numbering'],'aliases':ALIASES,
            'types':sorted({o['sourceStyle'].lower() for o in data['occurrences']}),
            'series':sorted({o.get('numbering',{}).get('counter') for o in data['occurrences'] if o.get('numbering',{}).get('counter','').startswith('user:')}),
            'count':len(data['occurrences']),'diagnostics':data['diagnostics'],'issue':issue}


def numbering_plan(text,path,expected_hash,settings,base=None,registered=None):
    checked_source(text,expected_hash);validate(settings)
    parsed=numbering_patch(text,settings)
    if parsed.get('numberingEditIssue'):raise NumberingEditError(parsed['numberingEditIssue'])
    edit=parsed['numberingEdit']
    if not parsed.get('numberingIssue') and parsed.get('numbering',{})==settings:edit={**edit,'after':edit['before']}
    before=catalog(text,path,registered,base,parsed)
    proposed=text[:edit['start']]+edit['after']+text[edit['end']:]
    after=catalog(proposed,path,registered,base)
    if len(before['occurrences'])!=len(after['occurrences']):raise ValueError('Numbering would change the callout structure; no edit was made')
    rows=[];changed=kept=0
    for old,new in zip(before['occurrences'],after['occurrences']):
        a,b=old['display'],new['display']
        old_label=a['bothLabel'] or a['displayType'];new_label=b['bothLabel'] or b['displayType']
        changes=old_label!=new_label;changed+=changes
        kept+=bool(b['authoredNumber'] and b['pinned'])
        rows.append({'line':old['line'],'type':old['sourceStyle'],'before':old_label,'after':new_label,'changed':changes,
                     'issue':b.get('issue'),'newIssue':bool(b.get('issue') and b.get('issue')!=a.get('issue')),'warning':b.get('warning')})
    edits=[] if edit['before']==edit['after'] else [edit]
    return {'path':path,'sourceHash':expected_hash,'afterHash':source_hash(proposed),'settings':settings,
            'edits':edits,'editorChanges':editor_changes(text,edits),'preview':sorted(rows,key=lambda r:(not r['newIssue'],not r['changed']))[:8],
            'changed':changed,'authoredKept':kept,'count':len(rows),'valid':not any(row['newIssue'] for row in rows),'diagnostics':after['diagnostics']}


def callout_contents(text,occurrence):
    """Remove only the selected callout's quote layer; preserve nested content."""
    body=text[occurrence['from']:occurrence['to']].splitlines(keepends=True)[1:]
    depth=occurrence.get('depth',1);result=[];first_content=True
    for line in body:
        count=0
        while count<depth:
            prefix=re.match(r'^[ \t]*>[ \t]?',line)
            if not prefix:break
            line=line[prefix.end():];count+=1
        # Only the own-depth first nonblank content line is a numbering hint.
        if first_content and line.strip():
            first_content=False
            if count==depth and OVERRIDE.fullmatch(line.strip()):continue
        result.append(line)
    return ''.join(result)


def contents_at(text,path,expected_hash,at,base=None,registered=None):
    checked_source(text,expected_hash)
    data=catalog(text,path,registered,base)
    matches=[o for o in data['occurrences'] if o['from']<=at<=o['to']]
    if not matches:raise ValueError('Place the cursor inside a callout')
    occurrence=min(matches,key=lambda o:o['to']-o['from'])
    return {'contents':callout_contents(text,occurrence),'from':occurrence['from'],'to':occurrence['to'],
            'title':occurrence['title'],'type':occurrence['sourceStyle']}
