"""One source transaction enrolls a callout and inserts a same-note reference."""
import hashlib
from reference_document import catalog,identity_plan
from document_numbers import resolve_document
from reference_format import apply_plan,prose_reference,references
from markdown_scan import structure


def editor_changes(text,edits):
    """Convert raw Python offsets to CodeMirror line/UTF-16-column positions.

    Work happens in the backend. CRLF pairs and non-BMP symbols are preserved;
    the editor receives only small local replacements, never a whole-note reset.
    """
    wanted={p for edit in edits for p in (edit['start'],edit['end'])};positions={};line=0;column=0;offset=0
    while offset<=len(text):
        if offset in wanted:positions[offset]={'line':line,'ch':column}
        if offset==len(text):break
        char=text[offset]
        if char=='\r' and text[offset:offset+2]=='\r\n':
            if offset+1 in wanted:raise ValueError('Edit splits a CRLF line ending')
            offset+=2;line+=1;column=0;continue
        if char in '\r\n':line+=1;column=0
        else:column+=2 if ord(char)>0xffff else 1
        offset+=1
    if wanted-set(positions):raise ValueError('Edit position is outside the note')
    return [{'from':positions[e['start']],'to':positions[e['end']],
             'text':e['after'].replace('\r\n','\n').replace('\r','\n')} for e in edits]



def editor_offsets(text,positions):
    """Resolve editor line/UTF-16 columns, rejecting split surrogate pairs."""
    wanted=set()
    for position in positions:
        if not isinstance(position,dict) or any(type(position.get(k)) is not int or position[k]<0 for k in ('line','ch')):
            raise ValueError('Invalid editor position')
        wanted.add((position['line'],position['ch']))
    found={};line=column=offset=0
    while offset<=len(text):
        key=(line,column)
        if key in wanted:found[key]=offset
        if offset==len(text):break
        char=text[offset]
        if char=='\r' and text[offset:offset+2]=='\r\n':offset+=2;line+=1;column=0;continue
        if char in '\r\n':line+=1;column=0
        else:column+=2 if ord(char)>0xffff else 1
        offset+=1
    if wanted-set(found):raise ValueError('Editor position is outside the note or splits a Unicode character')
    return [found[(p['line'],p['ch'])] for p in positions]


def local_reference_plan(text,path,source_hash,target_at,selection,mode='auto',registered_id=None,config=None,identity_context=None):
    start,end=selection
    if not isinstance(start,int) or not isinstance(end,int) or not 0<=start<=end<=len(text):raise ValueError('Invalid reference selection')
    if mode not in ('auto','n','t','b','c'):raise ValueError('Invalid reference label mode')
    parsed=structure(text)
    if any(start<b and end>a or start==end and a<=start<b for a,b in parsed['protected']+parsed['math']):
        raise ValueError('Use Math Studio for math attachments; code and metadata are not prose link targets')
    if any(start<r.end and end>r.start or start==end and r.start<start<r.end for r in references(text,parsed['protected'])):
        raise ValueError('Edit the existing reference instead of nesting another link')
    if any(start<b and end>a or start==end and a<start<b for a,b in parsed['links']):
        raise ValueError('Edit the existing link instead of nesting another link')
    source=catalog(text,path,registered_id,config,parsed)
    identity=identity_plan(text,path,source_hash,target_at,registered_id,config,identity_context,source)
    for occurrence in source['occurrences']:
        if occurrence['from']==target_at:occurrence['blockId']=identity['blockId']
        header_end=text.find('\n',occurrence['from'])
        header_end=len(text) if header_end<0 else header_end
        if start<header_end and end>occurrence['from'] or start==end and occurrence['from']<=start<header_end:
            raise ValueError('Insert the reference in prose, not in a callout header')
    resolved=resolve_document(identity['documentId'],source['occurrences'],source['numbering'])['targets'].get(identity['blockId'])
    if not resolved or resolved.get('issue'):raise ValueError('The selected result has an ambiguous identity or number')
    if mode=='auto':mode='n' if resolved['numberLabel'] else 't'
    label={'n':resolved['numberLabel'],'t':resolved['title'],'b':resolved['bothLabel'],'c':text[start:end]}[mode]
    if not label:raise ValueError('This result has no requested label; choose its title or number')
    if mode=='c' and any(c in label for c in ('[',']','|','\n','\r','%%')):
        raise ValueError('Select words on one line, without brackets or pipes')
    link=prose_reference('#^'+identity['blockId'],label,mode,identity['blockId'])
    # At a block-end caret the reference precedes the newly added anchor.
    edits=[{'start':start,'end':end,'before':text[start:end],'after':link}]+identity['edits']
    edits.sort(key=lambda edit:edit['start'])
    # Merge coincident insertions so native editor ordering is unambiguous.
    merged=[]
    for edit in edits:
        if merged and edit['start']==edit['end']==merged[-1]['start']==merged[-1]['end']:
            merged[-1]={**merged[-1],'after':merged[-1]['after']+edit['after']}
        else:merged.append(edit)
    edits=merged
    plan={**identity,'path':path,'edits':edits,'reference':{'target':identity['blockId'],'mode':mode,'label':label}}
    proposed=apply_plan(text,plan)
    plan['afterHash']=hashlib.sha256(proposed.encode()).hexdigest()
    plan['editorChanges']=editor_changes(text,edits)
    return plan


def library_reference_plan(text,path,source_hash,selection,entry,mode='t'):
    """Link a stored entry without reading or editing its source vault."""
    from reference_format import library_reference
    from callout_labels import parse_label
    if hashlib.sha256(text.encode()).hexdigest()!=source_hash:raise ValueError('Editor snapshot changed')
    if mode not in ('auto','t','c'):raise ValueError('Library references use titles or selected words, not document numbering')
    start,end=editor_offsets(text,selection)
    if end<start:raise ValueError('Invalid reference selection')
    parsed=structure(text)
    for a,b in parsed['protected']+parsed['math']+parsed['links']:
        if start<b and end>a or start==end and a<=start<b:
            raise ValueError('Choose prose outside existing links, math, code and metadata')
    source=catalog(text,path,parsed=parsed)
    for occurrence in source['occurrences']:
        line_end=text.find('\n',occurrence['from']);line_end=len(text) if line_end<0 else line_end
        if start<line_end and end>occurrence['from'] or start==end and occurrence['from']<=start<line_end:
            raise ValueError('Insert the reference in prose, not in a callout header')
    title=parse_label(entry['kind'],entry['title'])['nameText']
    if not title and mode!='c':raise ValueError('This result has no title. Select the words you want to link.')
    mode='c' if mode=='c' else 't';label=text[start:end] if mode=='c' else title
    replacement=library_reference(entry['id'],label,mode)
    edits=[{'start':start,'end':end,'before':text[start:end],'after':replacement}]
    plan={'path':path,'sourceHash':source_hash,'edits':edits,'entryId':entry['id'],'entryRevision':entry['revision'],'mode':mode,'selection':selection,
          'reference':{'target':'lib.'+entry['id'],'mode':mode,'label':label}}
    plan['afterHash']=hashlib.sha256(apply_plan(text,plan).encode()).hexdigest()
    plan['editorChanges']=editor_changes(text,edits)
    return plan
