"""Pure, memory-only local-target reservations for Math Studio.

No files, registry entries or anchors are written by choosing a target. The save
planner consumes only reservations whose target survives in the final equation.
"""
import hashlib,re
from collections import Counter
from reference_document import catalog,identity_plan
from reference_format import references,math_reference,apply_plan,MATH,label_digest
from reference_insert import editor_changes


def reserve_local(text,path,expected_hash,at,session_id,registered_id=None,config=None,identity_context=None,*,reserved_document=None,reserved_block=None,local_only=False):
    if not isinstance(session_id,str) or not 1<=len(session_id)<=100:raise ValueError('Invalid Math Studio session')
    data=catalog(text,path,registered_id,config)
    plan=identity_plan(text,path,expected_hash,at,registered_id,config,identity_context,data,reserved_document=reserved_document,reserved_block=reserved_block,local_only=local_only)
    occurrence=next((o for o in data['occurrences'] if o['from']==at),None)
    if occurrence is None:raise ValueError('The selected result changed. Choose it again.')
    return {'version':1,'sessionId':session_id,'path':path,'sourceHash':expected_hash,'at':at,'localOnly':local_only,
            'documentId':plan['documentId'],'blockId':plan['blockId'],'identityEdits':plan['edits'],
            'identityContext':plan['identityContext'],'occurrence':{'title':occurrence['title'],'sourceStyle':occurrence['sourceStyle']},
            'display':occurrence['display']}


def reserve_component(text,path,expected_hash,at,session_id,config=None,*,identity=None,occurrence_key=None):
    from markdown_scan import components
    from component_identities import header,fresh
    if hashlib.sha256(text.encode()).hexdigest()!=expected_hash:raise ValueError('The note changed; choose the result again')
    rows=[r for r in components(text) if r['from']==at]
    if len(rows)!=1 or rows[0].get('id'):raise ValueError('The selected component changed; choose it again')
    row=rows[0];identity=identity or fresh();occurrence_key=occurrence_key or fresh()
    import uuid
    uuid.UUID(identity);uuid.UUID(occurrence_key)
    display=next(r['display'] for r in catalog(text,path,None,config)['occurrences'] if r['from']==at)
    return {'version':1,'component':True,'localOnly':True,'sessionId':session_id,'path':path,'sourceHash':expected_hash,'at':at,
            'documentId':None,'blockId':'lib.'+identity,'identity':identity,'occurrenceKey':occurrence_key,
            'identityContext':None,'occurrence':{'title':row['title'],'sourceStyle':row['type']},'display':display,
            'identityEdits':[{'start':row['from'],'end':row['headerTo'],'before':row['header'],
                              'after':header(row,identity+'.local',occurrence_key)}]}


def verify_reservation(reservation,text,path,session_id,registered_id=None,config=None,identity_context=None):
    if reservation.get('version')!=1 or reservation.get('path')!=path or reservation.get('sessionId')!=session_id:
        raise ValueError('Reference reservation belongs to another note or editing session')
    if reservation.get('component'):
        current=reserve_component(text,path,reservation['sourceHash'],reservation['at'],session_id,config,identity=reservation['identity'],occurrence_key=reservation['occurrenceKey'])
        if current!=reservation:raise ValueError('The component changed. Choose it again; your draft is retained.')
        return current
    current=reserve_local(text,path,reservation['sourceHash'],reservation['at'],session_id,registered_id,config,identity_context,
                          reserved_document=reservation['documentId'],reserved_block=reservation['blockId'],local_only=reservation.get('localOnly',False))
    if current!=reservation:raise ValueError('The reference target changed. Choose it again; your draft is retained.')
    return current


def equation_plan(text,path,expected_hash,start,end,original,replacement,session_id,reservations,registered_id=None,config=None,identity_context=None,resolve=None):
    if hashlib.sha256(text.encode()).hexdigest()!=expected_hash:raise ValueError('The note changed during equation save')
    if type(start) is not int or type(end) is not int or not 0<=start<end<=len(text) or text[start:end]!=original:
        raise ValueError('The equation changed; your draft is retained')
    from markdown_scan import structure
    original_structure=structure(text)
    if [start,end] not in [list(span) for span in original_structure['math']]:raise ValueError('The selected source is not a complete equation')
    if not isinstance(reservations,list) or len(reservations)>256:raise ValueError('Provide at most 256 reference reservations')
    if not isinstance(replacement,str) or len(replacement)>200000:raise ValueError('Equation draft exceeds the interactive size limit')
    # Validate in its Markdown container; quoted display math is not a valid
    # standalone paragraph. Other math/code/metadata spans must remain intact.
    proposed=text[:start]+replacement+text[end:];proposed_structure=structure(proposed);delta=len(replacement)-(end-start)
    for kind in ('math','protected'):
        expected=[(a,b) if b<=start else (a+delta,b+delta) for a,b in original_structure[kind] if (a,b)!=(start,end)]
        if kind=='math':expected.append((start,start+len(replacement)))
        if sorted(expected)!=sorted(proposed_structure[kind]):raise ValueError('Keep the replacement inside one complete equation and its Markdown container')
    prefix=re.match(r'[ \t]*(?:>[ \t]*)+',text[text.rfind('\n',0,start)+1:start])
    def quote_depth(line):
        match=re.match(r'[ \t]*(?:>[ \t]*)+',line)
        return match[0].count('>') if match else 0
    if original.startswith('$$') and prefix and any(quote_depth(line)!=prefix[0].count('>') for line in replacement.splitlines()[1:]):
        raise ValueError('Preserve the callout quote markers on every equation line')
    originals=[r for r in references(original,[]) if r.kind=='math']
    old=Counter(original[r.start:r.end] for r in originals)
    identity=lambda r:(r.target,r.mode,r.baseline)
    remaining=Counter(identity(r) for r in originals)
    current=[r for r in references(replacement,[]) if r.kind=='math']
    if len(current)>256:raise ValueError('At most 256 references are supported in one equation')
    from reference_format import _balanced_end
    symbols=[]
    for match in re.finditer(r'\\class\{mjx-ss mjx-ss-o-[0-9a-z]{10}\}\{',replacement):
        finish=_balanced_end(replacement,match.end())
        if finish is None:raise ValueError('Unclosed symbol tag')
        symbols.append((match.start(),finish+1))
    index=0
    for ref in current:
        while index<len(symbols) and symbols[index][1]<=ref.start:index+=1
        if index<len(symbols) and symbols[index][0]<ref.start<symbols[index][1]:raise ValueError('A reference cannot be inside a symbol tag')
    if len(current)!=len(list(MATH.finditer(replacement))) or len(current)!=len(re.findall(r'\\class\s*\{(?:mjx-)?klref\b',replacement)):raise ValueError('Malformed or nested math reference')
    reserved={};documents=set()
    for item in reservations:
        key=item.get('blockId')
        if key in reserved and reserved[key]!=item:raise ValueError('Conflicting reference reservations')
        reserved[key]=item
    # Match exact originals first, irrespective of row order. An edited label
    # must not consume the allowance belonging to a later unchanged wrapper.
    existing=set()
    for index,reference in enumerate(current):
        raw=replacement[reference.start:reference.end]
        if old[raw]:
            old[raw]-=1;remaining[identity(reference)]-=1;existing.add(index)
    edits=[{'start':start,'end':end,'before':original,'after':replacement}];used=[]
    for index,reference in enumerate(current):
        # Existing broken or deliberately edited labels remain editable. Only
        # their original multiplicity is exempt from new-target validation.
        if index in existing:continue
        if remaining[identity(reference)]:
            remaining[identity(reference)]-=1;continue
        if reference.mode!='c' and reference.baseline!=label_digest(reference.label):raise ValueError('Refresh this link; its generated label changed during editing')
        if '.' in reference.target and reference.target.split('.',1)[1] in reserved:raise ValueError('Reserved own-note references must use their local block identity')
        item=reserved.get(reference.target)
        if item is not None:
            if reference.target in used:continue
            valid=verify_reservation(item,text,path,session_id,registered_id,config,identity_context)
            documents.add(valid['documentId']);used.append(reference.target)
            edits.extend(valid['identityEdits'])
        elif resolve is None or not resolve(reference):raise ValueError('Re-link this reference; its target is unavailable')
    if len(documents)>1:raise ValueError('References reserved different note identities; choose them again')
    # Shared document insertion and repeated target references appear only once.
    unique={}
    for e in edits:unique[(e['start'],e['end'],e['before'],e['after'])]=e
    edits=sorted(unique.values(),key=lambda e:(e['start'],e['end']))
    plan={'path':path,'sourceHash':expected_hash,'edits':edits,'usedReservations':used}
    proposed=apply_plan(text,plan)
    plan['afterHash']=hashlib.sha256(proposed.encode()).hexdigest();plan['editorChanges']=editor_changes(text,edits)
    return plan
