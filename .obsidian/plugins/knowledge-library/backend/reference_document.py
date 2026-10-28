"""Source-derived callout catalog for one note. Reading does not assign IDs."""
import bisect
import hashlib
import re
import json
from markdown_scan import structure
from callout_labels import parse_label
from document_numbers import resolve_document

HEADER=re.compile(r'^>\s*\[!([\w-]+)(?:\|[^\]\n]*)?\][+-]?\s*(.*)$')
ANCHOR=re.compile(r'^[ \t]*\^([A-Za-z0-9-]+)[ \t]*(?:\r?\n|$)')
OVERRIDE=re.compile(r'^%%\s*callout-outline\s*:\s*(.*?)\s*%%$',re.I)

def legacy_override(body,depth):
    for line in body.splitlines()[1:]:
        quote=re.match(r'^\s*((?:>\s*)+)(.*)$',line)
        if not quote or quote[1].count('>')<depth:break
        if quote[1].count('>')!=depth or not quote[2].strip():continue
        match=OVERRIDE.fullmatch(quote[2].strip())
        if not match:return None
        directive=match[1].strip()
        if directive.lower()=='manual':return {'mode':'manual'}
        start=re.fullmatch(r'start\s*=\s*(\d+)',directive,re.I)
        if start and 1<=int(start[1])<=9007199254740991:return {'mode':'start','start':int(start[1])}
        return {'mode':'unknown','raw':directive}
    return None

DOC_ID=re.compile(r'^kl-doc:[ \t]*[\'"]?([A-Za-z0-9-]{1,80})[\'"]?[ \t]*$',re.M)


def document_identity(text,registered=None):
    front=re.match(r'^\ufeff?---\r?\n((?:[^\n]*\n)*?)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)',text)
    properties=front[1].replace('\r\n','\n') if front else ''
    keys=re.findall(r'^kl-doc:',properties,re.M)
    ids=DOC_ID.findall(properties)
    if len(keys)>1 or len(keys)!=len(ids):raise ValueError('Document identity property is invalid or duplicated')
    identity=ids[0] if ids else registered
    if identity=='lib':raise ValueError('The document identity lib is reserved for library references')
    if identity and registered and identity!=registered:raise ValueError('Document identity disagrees with the registered source')
    return identity


def catalog(text,path,registered_id=None,config=None,parsed=None):
    parsed=structure(text) if parsed is None else parsed;line_starts=[0]+[m.end() for m in re.finditer('\n',text)]
    from numbering_policy import note_policy
    config,diagnostics=note_policy(config or {},parsed);occurrences=[]
    try:document=document_identity(text,registered_id)
    except ValueError as error:document=None;diagnostics.append({'reason':str(error)})
    protected=parsed['protected'];at=0;containers=[]
    for node in parsed['structure']:
        while containers and containers[-1]['to']<=node['from']:containers.pop()
        enclosed=bool(containers)
        if node['type'] in ('ListItem','Blockquote'):containers.append(node)
        if node['type']!='Blockquote':continue
        start,end=node['from'],node['to']
        # Lezer includes the carriage return but not the line feed at block end.
        # Never split that pair when inserting metadata after the block.
        if text[max(start,end-1):end+1]=='\r\n':end-=1
        while at<len(protected) and protected[at][1]<=start:at+=1
        if at<len(protected) and protected[at][0]<=start<protected[at][1]:continue
        first=text[start:end].split('\n',1)[0].rstrip('\r');header=HEADER.match(first)
        if not header:continue
        title=header[2].strip();label=parse_label(header[1],title)
        line=bisect.bisect_right(line_starts,start)
        line_start=line_starts[line-1]
        nested=enclosed or '>' in text[line_start:start]
        block=None
        # A top-level block anchor follows the callout after blank lines.
        tail=re.match(r'\r?\n(?:(?:[ \t]*|[ \t]*<!-- knowledge-library:[0-9a-f-]{36} -->[ \t]*)\r?\n)*',text[end:])
        anchor=ANCHOR.match(text[end+tail.end():]) if tail and not nested else None
        if anchor:block=anchor[1]
        metadata=re.search(r'\[![\w-]+\|([^\]]+)\]',first)
        entity=re.search(r'(?:^|\s)([0-9a-f-]{36})\.(local|library)(?=\s|$)',metadata[1],re.I) if metadata else None
        occurrence=re.search(r'(?:^|\s)at=([0-9a-f-]{36})(?=\s|$)',metadata[1],re.I) if metadata else None
        if entity and occurrence:block=occurrence[1]
        numbering={}
        encoded=next((t[2:] for t in metadata[1].split() if t.startswith('n=')),None) if metadata else None
        if encoded:
            try:
                numbering=json.loads(bytes.fromhex(encoded))
                if not isinstance(numbering,dict) or set(numbering)-{'mode','label','counter','overrideAuthored'}:raise ValueError('Invalid fields')
            except (ValueError,TypeError):
                numbering={};diagnostics.append({'line':line,'reason':'Invalid callout numbering metadata'})
        occurrences.append({'component':bool(metadata and re.search(r'[0-9a-f-]{36}\.(?:local|library)',metadata[1],re.I)),'entityId':entity[1] if entity else None,'occurrenceKey':occurrence[1] if occurrence else None,'kind':label['kind'],'title':title,'blockId':block,'line':line,
                            'from':start,'to':end,'nested':nested,'depth':text[line_start:start].count('>')+1,'sourceStyle':header[1],'collapsed':bool(re.match(r'^>\s*\[![^\]\n]+\]-',first)),
                            'numbering':numbering,'legacyOverride':legacy_override(text[start:end],text[line_start:start].count('>')+1)})
    labels=resolve_document(document,occurrences,config)
    diagnostics.extend(labels['diagnostics'])
    for occurrence,display in zip(occurrences,labels['displays']):occurrence['display']=display
    return {'path':path,'documentId':document,'sourceHash':hashlib.sha256(text.encode()).hexdigest(),
            'occurrences':occurrences,'targets':labels['targets'],'diagnostics':diagnostics,'numbering':config}


def identity_plan(text,path,source_hash,at,registered_id=None,config=None,identity_context=None,data=None,*,reserved_document=None,reserved_block=None,local_only=False):
    """One editor transaction enrolls a selected callout for linking.

    Does not admit it to the knowledge library, change prose, or assign a number
    in source. Existing native anchors and registered document IDs are reused.
    """
    import uuid
    from document_numbers import BLOCK_ID
    if type(local_only) is not bool:raise ValueError('Invalid local identity mode')
    if local_only and reserved_document is not None:raise ValueError('Local references cannot reserve a document identity')
    for reserved in (reserved_document,reserved_block):
        if reserved is not None and (not isinstance(reserved,str) or not BLOCK_ID.fullmatch(reserved) or reserved=='lib'):
            raise ValueError('Invalid reserved reference identity')
    current=hashlib.sha256(text.encode()).hexdigest()
    if current!=source_hash:raise ValueError('Note changed before preparing its reference')
    data=catalog(text,path,registered_id,config) if data is None else data
    matches=[o for o in data['occurrences'] if o['from']==at]
    if len(matches)!=1:raise ValueError('The selected callout is missing or ambiguous')
    selected=matches[0]
    if selected['nested']:raise ValueError('Nested callout anchor placement requires native verification before editing')
    existing=document_identity(text)
    context=identity_context or {}
    if existing and not context:raise ValueError('Document registry must verify the existing identity before editing')
    if context:
        if context.get('path')!=path:raise ValueError('Document registry context belongs to another note')
        if context.get('status') not in ('new','owned','restore','copy','template-copy','pending'):raise ValueError('Document identity needs reconciliation: '+str(context.get('status')))
        if context.get('status') in ('owned','copy','template-copy','pending') and context.get('documentId')!=existing:raise ValueError('Document identity changed after registry inspection')
        if context.get('status')=='restore' and existing is not None:raise ValueError('Document identity changed after registry inspection')
        if context.get('status')=='new' and existing is not None:raise ValueError('Document identity changed after registry inspection')
    copied=context.get('status') in ('copy','template-copy')
    if local_only and copied:raise ValueError('Reconcile the copied note identity before adding references')
    document=None if local_only else ((registered_id if registered_id and registered_id!=existing else reserved_document or str(uuid.uuid4())) if copied else document_identity(text,registered_id) or context.get('documentId') or reserved_document or str(uuid.uuid4()))
    if reserved_document is not None and document!=reserved_document:raise ValueError('Reserved document identity changed')
    if document is not None and not BLOCK_ID.fullmatch(document):raise ValueError('Invalid registered document identity')
    edits=[];front=re.match(r'^\ufeff?---\r?\n((?:[^\n]*\n)*?)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)',text)
    newline='\r\n' if '\r\n' in text else '\n'
    if not front and re.match(r'^\ufeff?---(?:\r?\n|$)',text):raise ValueError('Finish the note properties before creating a reference')
    if copied and not local_only:
        identity_line=re.search(r'^kl-doc:[^\n]*(?=\n|$)',front[0],re.M)
        begin=identity_line.start();end=identity_line.end()
        before=text[begin:end]
        edits.append({'start':begin,'end':end,'before':before,'after':'kl-doc: '+document+('\r' if before.endswith('\r') else '')})
    elif existing is None and not local_only:
        if front:
            pos=front.start(1);addition='kl-doc: '+document+newline
        else:
            pos=1 if text.startswith('\ufeff') else 0;addition='---'+newline+'kl-doc: '+document+newline+'---'+newline+newline
        edits.append({'start':pos,'end':pos,'before':'','after':addition})
    block=selected['blockId']
    if block:
        if reserved_block is not None and block!=reserved_block:raise ValueError('The target acquired a different anchor; choose it again')
        target=data['targets'].get(block)
        if not target or target.get('issue'):raise ValueError('The selected block identity or label is ambiguous')
    else:
        import base64
        occupied=set(re.findall(r'(?m)(?:^|[ \t])\^([A-Za-z0-9-]+)[ \t]*\r?$',text))
        if reserved_block is not None:
            if reserved_block in occupied:raise ValueError('Reserved block identity is already in use')
            block=reserved_block
        else:
            while True:
                block='kl-'+base64.b32encode(uuid.uuid4().bytes[:5]).decode().lower()
                if block not in occupied:break
        pos=selected['to']
        # Isolate the anchor from a directly following paragraph or math block.
        suffix='' if pos==len(text) or re.match(r'^\r?\n[ \t]*\r?\n',text[pos:]) else newline
        edits.append({'start':pos,'end':pos,'before':'','after':newline+newline+'^'+block+suffix})
    return {'sourceHash':current,'documentId':document,'blockId':block,'edits':sorted(edits,key=lambda e:e['start']),
            'identityContext':context,'diagnostics':[{'reason':'Copied note receives a new document identity','originalDocumentId':existing}] if copied else []}
