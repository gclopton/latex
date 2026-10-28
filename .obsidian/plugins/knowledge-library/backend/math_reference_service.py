"""Read-only Math Studio bridge. Editor edit offsets are UTF-16; opaque catalog/reservation `at` values
are backend code-point positions and must never be used as CodeMirror offsets.

Selections reserve identities in the caller's draft only. Final save plans are
recomputed immediately before the host's single guarded editor transaction.
"""
import hashlib
from reference_document import catalog,document_identity
from reference_format import references
from math_reference_draft import reserve_local,reserve_component,verify_reservation,equation_plan
from math_label import math_label



def validate_envelopes(reservations):
    if not isinstance(reservations,list) or len(reservations)>256:raise ValueError('Invalid reference reservations')
    for envelope in reservations:
        if isinstance(envelope,dict) and envelope.get('reservation',{}).get('foreign'):continue
        if not isinstance(envelope,dict) or not isinstance(envelope.get('reservation'),dict) or not isinstance(envelope.get('policyDigest'),str) or 'bookKey' not in envelope:
            raise ValueError('Malformed reference reservation; choose the target again')
        r=envelope['reservation']
        if r.get('localOnly') is not True:raise ValueError('Math Studio requires a local-only reference reservation')
        if any(k not in r for k in ('version','path','sessionId','sourceHash','at','documentId','blockId','identityEdits','identityContext','occurrence','display')):
            raise ValueError('Incomplete reference reservation; choose the target again')


def wrap_expression(mode,target,body):
    from reference_format import math_reference
    if not isinstance(body,str) or not body.strip() or len(body)>200000:raise ValueError('Invalid reference expression')
    if not isinstance(mode,str) or not isinstance(target,str):raise ValueError('Invalid reference target or mode')
    return {'wrapper':math_reference(body,mode,target)}


def utf16_offsets(text,positions):
    if not isinstance(positions,list) or any(type(n) is not int or n<0 for n in positions):raise ValueError('Invalid editor offsets')
    wanted=set(positions);found={};offset=0
    for i,char in enumerate(text):
        if offset in wanted:found[offset]=i
        offset+=2 if ord(char)>0xffff else 1
    if offset in wanted:found[offset]=len(text)
    if wanted-set(found):raise ValueError('Editor offset is outside the note or splits a Unicode character')
    return [found[n] for n in positions]


def snapshot(live,path,text,digest,guard=True):
    live.path(path)
    if not isinstance(text,str) or len(text.encode())>8*1024*1024:raise ValueError('This note exceeds the interactive snapshot limit')
    if hashlib.sha256(text.encode()).hexdigest()!=digest:raise ValueError('The note changed; reopen the reference choice')
    policy=live.numbering_policy(path)
    if guard:live.guard_numbering(path,policy)
    context,registered=live.editor_reference_context(path,text)
    return policy,context,registered


def prepare_choice(live,path,text,source_hash,session_id,choice,expression,reservations=None):
    policy,context,registered=snapshot(live,path,text,source_hash,guard=False)
    if not isinstance(session_id,str) or not 1<=len(session_id)<=100:raise ValueError('Invalid Math Studio session')
    if not isinstance(choice,dict) or choice.get('version')!=1 or choice.get('path')!=path:raise ValueError('Choice belongs to another note')
    if not isinstance(expression,str) or not expression.strip() or len(expression)>200000:raise ValueError('Select an expression to link')
    mode=choice.get('mode');selected=choice.get('target',{});reservation=None
    reservations=[] if reservations is None else reservations
    validate_envelopes(reservations)
    if mode not in ('auto','n','t','b','c'):raise ValueError('Invalid reference label mode')
    if not isinstance(selected,dict):raise ValueError('Invalid reference target')
    if selected.get('kind')=='local':
        live.guard_numbering(path,policy)
        data=catalog(text,path,registered,policy['config']);block=selected.get('blockId')
        matches=[r for r in data['occurrences'] if r['blockId']==block] if block else [r for r in data['occurrences'] if r['from']==selected.get('at')]
        if len(matches)!=1:raise ValueError('The selected result changed or has duplicate anchors')
        row=matches[0]
        if (row['nested'] and not selected.get('component')) or row['display'].get('issue'):raise ValueError('The selected result cannot be linked unambiguously')
        if block:
            if block not in data['targets']:raise ValueError('The selected anchor is ambiguous')
        else:
            if choice.get('sourceHash')!=source_hash:raise ValueError('The note changed; choose the unanchored result again')
            prior=[e for e in reservations if e['reservation'].get('at')==row['from']]
            if len(prior)>1:raise ValueError('Conflicting draft targets; reopen this reference choice')
            if prior:
                reservation=prior[0];live.guard_numbering(path,reservation)
                r=verify_reservation(reservation['reservation'],text,path,session_id,registered,policy['config'],context)
            else:
                r=reserve_component(text,path,source_hash,row['from'],session_id,policy['config'])
                reservation={'reservation':r,'policyDigest':policy['policyDigest'],'bookKey':policy['bookKey']}
            block=r['blockId']
        display=row['display'];target=block
        if mode=='auto':mode='n' if display.get('numberLabel') else 't'
        label={'n':display.get('numberLabel'),'t':display.get('title'),'b':display.get('bothLabel'),'c':expression}[mode]
    elif selected.get('kind')=='library':
        target='lib.'+str(selected.get('entryId',''))
        from component_reference_writes import reserve as reserve_foreign
        foreign=reserve_foreign(live,str(selected.get('entryId','')),session_id)
        if foreign:reservation={'reservation':foreign}
        from component_references import resolve as component_resolve
        resolved=component_resolve(live,path,str(selected.get('entryId','')),text) or live.resolve_reference_targets(path,[target])['targets'][target]
        if foreign:resolved={**resolved,**foreign['display']}
        if resolved.get('issue'):raise ValueError(resolved['issue'])
        if mode=='auto':mode='n' if resolved.get('numberLabel') else 't'
        label={'c':expression,'n':resolved.get('numberLabel'),'t':resolved.get('title'),'b':resolved.get('bothLabel')}[mode]
    else:raise ValueError('Unsupported reference choice')
    if not label:raise ValueError('This result has no requested label; choose another label mode')
    body=label if mode=='c' else math_label(label)
    from reference_format import math_reference
    math_reference(body,mode,target) # reject malformed/nested selected TeX
    return {'version':1,'mode':mode,'target':target,'expression':body,'reservation':reservation}


def save_plan(live,path,text,source_hash,session_id,start,end,original,replacement,reservations):
    if not isinstance(replacement,str) or len(replacement)>200000:raise ValueError('Equation draft exceeds the interactive size limit')
    current_refs=[r for r in references(replacement,[]) if r.kind=='math']
    if len(current_refs)>256:raise ValueError('At most 256 references are supported in one equation')
    policy,context,registered=snapshot(live,path,text,source_hash)
    start_cp,end_cp=utf16_offsets(text,[start,end])
    validate_envelopes(reservations)
    raw=[];foreign=[]
    for envelope in reservations:
        r=envelope['reservation']
        if r.get('foreign'):
            if any(ref.target==r['blockId'] for ref in current_refs):
                from component_reference_writes import verify
                foreign.append(verify(live,r,session_id))
        else:raw.append(r)
    resolved={};available=None
    def resolve(ref):
        nonlocal available
        if available is None:
            targets=list(dict.fromkeys(r.target for r in current_refs))
            available=live.editor_reference_targets(path,text,targets)['targets']
            foreign=[t for t,v in available.items() if v.get('issueCode')=='not-own-target']
            if foreign:available.update(live.resolve_reference_targets(path,foreign)['targets'])
        if ref.target not in resolved:
            overlay=available[ref.target]
            resolved[ref.target]={k:v for k,v in overlay.items() if k not in ('sourceHash','provisional')}
        return not resolved[ref.target].get('issue')
    plan=equation_plan(text,path,source_hash,start_cp,end_cp,original,replacement,session_id,raw,registered,policy['config'],context,resolve)
    for envelope in reservations:
        if envelope['reservation']['blockId'] in plan['usedReservations']:live.guard_numbering(path,envelope)
    # Convert positions in one pass, not once per edit in a long chapter.
    wanted={e[k] for e in plan['edits'] for k in ('start','end')};positions={};offset=0
    for i,char in enumerate(text):
        if i in wanted:positions[i]=offset
        offset+=2 if ord(char)>0xffff else 1
    positions[len(text)]=offset
    return {**plan,'changes':[{'from':positions[e['start']],'to':positions[e['end']],'insert':e['after']} for e in plan['edits']],
            'resolved':resolved,'policyDigest':policy['policyDigest'],'bookKey':policy['bookKey'],
            'foreignIdentities':foreign,'request':{'path':path,'source_hash':source_hash,'session_id':session_id,'start':start,'end':end,'original':original,'replacement':replacement,'reservations':reservations}}


def verify_plan(live,plan,text):
    current=save_plan(live,text=text,**plan['request'])
    if current!=plan:raise ValueError('Reference dependencies changed; review the current draft again')
    return {'afterHash':current['afterHash']}
