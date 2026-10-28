"""Read-only foreign header reservations and durable grouped-save receipts.

The vault/editor is the writer. This journal records intent before either file
changes, so retry and Undo can identify the exact paired operation.
"""
import hashlib,json,uuid
from pathlib import Path
from library_store import atomic_json,Conflict
from markdown_scan import components
from component_identities import header
from reuse import locate
H=lambda value:hashlib.sha256(value.encode()).hexdigest()

def reserve(live,identity,session_id):
    from figure_panels import split
    identity,panel=split(identity)
    entry=live.reference_entry(identity)
    if not entry or not entry.get('home') or entry['home'].get('markerFormat')=='component-v1':return None
    place=locate(live,identity);root=Path(place['vaultRoot'])
    from component_scope import guard
    guard(root,place['path'])
    text=(root/place['path']).read_bytes().decode('utf-8')
    rows=[r for r in components(text) if r['line']+1==place['line']]
    if len(rows)!=1:raise Conflict('The selected source is not one callout')
    row=rows[0]
    if row.get('id'):return None
    uuid.UUID(identity)
    at=str(uuid.uuid4());after=text[:row['from']]+header(row,identity+'.library',at)+text[row['headerTo']:]
    from numbering_policy import NumberingPolicies
    from reference_document import catalog
    policy=live.numbering_policy(place['path']) if root==live.vault else NumberingPolicies(root).snapshot().resolve(place['path'])
    display=next(r['display'] for r in catalog(text,place['path'],config=policy['config'])['occurrences'] if r['from']==row['from'])
    return {'version':1,'foreign':True,'sessionId':session_id,'path':place['path'],'root':str(root),
            'blockId':'lib.'+identity,'identity':identity,'at':at,'before':text,'after':after,'sourceHash':H(text),'display':display}

def verify(live,row,session_id):
    from component_scope import guard
    guard(Path(row['root']),row['path'])
    if row.get('version')!=1 or row.get('sessionId')!=session_id:raise Conflict('Foreign identity belongs to another draft')
    entry=live.reference_entry(row['identity'])
    if not entry or str(live.source_root(entry))!=row['root'] or entry['home']['path']!=row['path']:raise Conflict('The source location changed')
    source=(Path(row['root'])/row['path']).resolve()
    if not source.is_relative_to(Path(row['root'])):raise Conflict('Invalid source path')
    current=source.read_bytes().decode('utf-8')
    if H(row['before'])!=row['sourceHash'] or current!=row['before']:raise Conflict('The source callout changed; your equation draft is retained')
    parsed=[r for r in components(row['after']) if r.get('at')==row['at']]
    if len(parsed)!=1 or parsed[0]['id']!=row['identity']+'.library':raise Conflict('Invalid identity reservation')
    original=[r for r in components(row['before']) if r['from']==parsed[0]['from']]
    if len(original)!=1:raise Conflict('Source callout changed')
    expected=row['before'][:original[0]['from']]+header(original[0],row['identity']+'.library',row['at'])+row['before'][original[0]['headerTo']:]
    if expected!=row['after']:raise Conflict('Reservation changes more than the source identity')
    return row

def directory(live):
    root=live.plans/'reference-writes';root.mkdir(exist_ok=True);return root

def begin(live,path,before,after,rows,key):
    from component_scope import guard
    guard(live.vault,path)
    key=str(uuid.UUID(key));live.path(path)
    docs=[]
    for row in rows:
        verify(live,row,row['sessionId'])
        if Path(row['root'])!=live.vault:raise Conflict('Open the source vault and initialize or convert its callouts before linking this legacy result. Your equation draft is retained')
        docs.append({'path':row['path'],'before':row['before'],'after':row['after']})
    if len({d['path'] for d in docs})!=len(docs):raise Conflict('Choose one uninitialized source per note in this save')
    job={'key':key,'path':path,'before':before,'after':after,'sources':docs,'state':'prepared'}
    file=directory(live)/(key+'.json')
    existing=file if file.exists() else directory(live)/'receipts'/file.name
    if existing.exists():
        prior=json.loads(existing.read_text())
        if any(prior.get(k)!=v for k,v in job.items() if k!='state'):raise Conflict('Save key already used')
        return prior
    atomic_json(file,job);return job

def record(live,key,state):
    if state not in ('complete','undone','conflict','rolled-back'):raise ValueError('Invalid grouped-save state')
    root=directory(live);name=str(uuid.UUID(key))+'.json';file=root/name
    if not file.exists():file=root/'receipts'/name
    job=json.loads(file.read_text());job['state']=state
    receipts=root/'receipts';receipts.mkdir(exist_ok=True);destination=receipts/name
    atomic_json(destination,job)
    if file!=destination:file.unlink(missing_ok=True)
    return job


def pending(live):
    return [job for file in directory(live).glob('*.json')
            if (job:=json.loads(file.read_text())).get('state')=='prepared']
