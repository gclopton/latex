"""Durable homes and versions for component identities, shared across vaults.

The header carries entity + occurrence identity. This journal records ownership;
it is not a disposable search index. Source edits are plans applied by the editor.
"""
import copy
import json
import re
import uuid
from collections import ChainMap
from library_store import atomic_json, digest, Conflict
from markdown_scan import components


def fresh(): return str(uuid.uuid4())
def base(identity): return identity.rsplit('.',1)[0]
def note_key(vault,path): return vault+'\n'+path
def header(row,identity,at,origin=None):
    tokens=[t for t in row['metadata'].split() if not re.fullmatch(r'[0-9a-f-]{36}\.(?:local|library)',t,re.I) and not t.startswith(('at=','origin=','rev='))]
    tokens.extend([identity,'at='+at])
    if origin:tokens.append('origin='+origin)
    old=row['header'];left=old.index('[!');right=old.index(']')
    return old[:left]+'[!'+row['type']+'|'+' '.join(tokens)+']'+old[right+1:]


class ComponentIdentities:
    RECEIPT_LIMIT=512
    def __init__(self,store):
        self.store=store;self.root=store.root/'component-identities';self.root.mkdir(exist_ok=True)
        self.entities={};self.occurrences={};self.notes={};self.receipts={};self.sequence=0;self.head=None
        snapshot=self.root/'checkpoint.json'
        if snapshot.exists():
            saved=json.loads(snapshot.read_text());checksum=saved.pop('checksum')
            if digest(saved)!=checksum:raise Conflict('Component checkpoint integrity failed')
            for name in ('entities','occurrences','notes','receipts','sequence','head'):setattr(self,name,saved[name])
        self.by_entity={};self.by_vault={};self.children={}
        for entity in self.entities.values():self.index_origin(entity)
        for occurrence in self.occurrences.values():self.index_occurrence(occurrence)
        self.receipt_root=self.root/'receipt-index';self.receipt_root.mkdir(exist_ok=True)
        with store.lock():
            # Rebuild a missing derived index once, by sequence, never by glob.
            # Existing checkpoints may contain an old, unbounded receipt map.
            cursor=self.receipt_root/'checkpoint.json'
            indexed=json.loads(cursor.read_text()).get('sequence',0) if cursor.exists() else 0
            old_size=len(self.receipts)
            for sequence in range(indexed+1,self.sequence+1):
                event=json.loads((self.root/f'{sequence:012d}.json').read_text());checksum=event.pop('checksum')
                if digest(event)!=checksum:raise Conflict('Component receipt journal integrity failed')
                self.record_receipt(event['key'],sequence)
            while len(self.receipts)>self.RECEIPT_LIMIT:self.receipts.pop(next(iter(self.receipts)))
            atomic_json(cursor,{'sequence':max(indexed,self.sequence)})
            if old_size>self.RECEIPT_LIMIT:self.checkpoint()
            self.load()

    def record_receipt(self,key,sequence):
        path=self.receipt_root/(digest(key)+'.json')
        record={'key':key,'sequence':sequence}
        if path.exists():
            if json.loads(path.read_text())!=record:raise Conflict('Component receipt identity disagrees with journal')
        else:atomic_json(path,record)
        self.receipts[key]=sequence
        while len(self.receipts)>self.RECEIPT_LIMIT:self.receipts.pop(next(iter(self.receipts)))

    def receipt_sequence(self,key):
        if key in self.receipts:return self.receipts[key]
        path=self.receipt_root/(digest(key)+'.json')
        if not path.exists():return None
        saved=json.loads(path.read_text())
        if saved.get('key')!=key or not isinstance(saved.get('sequence'),int):raise Conflict('Invalid component receipt index')
        return saved['sequence']

    def checkpoint(self):
        saved={name:getattr(self,name) for name in ('entities','occurrences','notes','receipts','sequence','head')}
        atomic_json(self.root/'checkpoint.json',{**saved,'checksum':digest(saved)})
        atomic_json(self.receipt_root/'checkpoint.json',{'sequence':self.sequence})

    def index_occurrence(self,occurrence,remove=False):
        if not occurrence or not occurrence.get('alive'):return
        identity,at,vault=occurrence['id'],occurrence['at'],occurrence['vault']
        for table in (self.by_entity,self.by_vault.setdefault(vault,{})):
            values=table.setdefault(identity,set())
            if remove:values.discard(at)
            else:values.add(at)
            if not values:table.pop(identity,None)

    def index_origin(self,entity,remove=False):
        if not entity or not entity.get('origin'):return
        values=self.children.setdefault(entity['origin'],set())
        if remove:values.discard(entity['id'])
        else:values.add(entity['id'])

    def descendants(self,identity):
        result=set();pending=list(self.children.get(identity,()))
        while pending:
            child=pending.pop()
            if child in result or child==identity:continue
            result.add(child);pending.extend(self.children.get(child,()))
        return result

    def origin_snapshot(self,identity,entities=None):
        entities=entities if entities is not None else self.entities
        result={};seen=set()
        while identity and identity not in seen:
            seen.add(identity);entity=entities.get(identity)
            if not entity:break
            result[identity]={k:entity.get(k) for k in ('revision','contentHash','semanticHash','images','hashVersion','raw')}
            identity=entity.get('origin')
        return result

    def ancestor_changes(self,entity):
        result=[];identity=entity.get('origin');seen={entity['id']};depth=0
        while identity and identity not in seen:
            seen.add(identity);depth+=1;ancestor=self.entities.get(identity)
            if not ancestor:break
            prior=entity.get('originSeen',{}).get(identity)
            if prior and (prior.get('semanticHash') or (prior.get('contentHash') if prior.get('hashVersion')==2 else components(prior['raw'])[0]['contentHash']))!=(ancestor.get('semanticHash') or (ancestor.get('contentHash') if ancestor.get('hashVersion')==2 else components(ancestor['raw'])[0]['contentHash'])):
                row=components(ancestor['raw'])[0]
                result.append({'id':identity,'levels':depth,'title':row['title'] or row['type'].capitalize(),
                               'before':prior,'after':{k:ancestor.get(k) for k in ('revision','contentHash','semanticHash','images','hashVersion','raw')}})
            identity=ancestor.get('origin')
        return result

    def load(self):
        # Direct next-sequence lookup: cost depends on new events, not the age
        # of the journal. Historical files need not be globbed or sorted.
        while True:
            path=self.root/f'{self.sequence+1:012d}.json'
            if not path.exists():break
            event=json.loads(path.read_text());checksum=event.pop('checksum')
            if event['sequence']!=self.sequence+1 or event['previous']!=self.head or digest(event)!=checksum:raise Conflict('Component identity journal integrity failed')
            for group in ('entities','occurrences'):
                table=getattr(self,group)
                for key,value in event[group].items():
                    if group=='occurrences':self.index_occurrence(table.get(key),remove=True)
                    else:self.index_origin(table.get(key),remove=True)
                    if value is None:table.pop(key,None)
                    else:table[key]=value
                    if group=='occurrences':self.index_occurrence(value)
                    else:self.index_origin(value)
            for key,delta in event['notes'].items():
                if 'rows' in delta:self.notes[key]=delta;continue # first development candidate
                current=self.notes.get(key,{'rows':[]});rows={r['at']:r for r in current['rows'] if r.get('at')}
                for at in delta['removed']:rows.pop(at,None)
                rows.update(delta['upserts']);order=delta.get('order',[r['at'] for r in current['rows'] if r.get('at')])
                self.notes[key]={'rows':[rows[at] for at in order if at in rows]}
            self.record_receipt(event['key'],event['sequence']);self.sequence=event['sequence'];self.head=checksum

    def commit(self,key,expected,changes,issues):
        with self.store.lock():
            self.load()
            prior=self.receipt_sequence(key)
            if prior is not None:return {'sequence':prior}
            if expected!=self.sequence:raise Conflict('Component ownership changed; refresh the edit')
            event={'sequence':self.sequence+1,'previous':self.head,'key':key,**changes,'issues':issues}
            atomic_json(self.root/f'{event["sequence"]:012d}.json',{**event,'checksum':digest(event)})
            self.load()
            if self.sequence%128==0:self.checkpoint()
            return event

    def rename_notes(self,vault,moves):
        """Journal a verified file/folder rename without copying or versioning entities.

        moves maps old paths to (new path, exact destination text). The caller
        verifies the old filesystem paths are gone before invoking this method.
        """
        self.load();occurrences={};notes={}
        for old,(new,text) in moves.items():
            old_key,new_key=note_key(vault,old),note_key(vault,new)
            previous=self.notes.get(old_key,{'rows':[]})
            if not previous['rows']:continue # idempotent replay after rename
            present={r['at']:r for r in components(text) if r.get('at')}
            for row in previous['rows']:
                at=row.get('at');occ=self.occurrences.get(at)
                if not occ or not occ.get('alive') or occ['path']!=old:continue
                target=present.get(at)
                if not target or base(target['id'])!=occ['id']:
                    raise Conflict('Renamed note is missing a recorded callout identity; no ownership was changed')
                occurrences[at]={**occ,'path':new}
            prior_new=self.notes.get(new_key,{'rows':[]})['rows']
            if prior_new and prior_new!=previous['rows']:
                raise Conflict('The destination already has different callout ownership')
            notes[old_key]={'upserts':{},'removed':[r['at'] for r in previous['rows'] if r.get('at')],'order':[]}
            notes[new_key]={'rows':previous['rows']}
        if not occurrences and not notes:return {'changed':0}
        return self.commit('rename-'+fresh(),self.sequence,{'entities':{},'occurrences':occurrences,'notes':notes},[])

    def plan(self,vault,path,text,*,operation='edit',old_text=None,image_rows=None):
        """No source writes. A finish call accepts only the exact resulting text."""
        if operation not in ('edit','paste','move','undo','observe','sync','presentation'):raise ValueError('Unknown component operation')
        self.load();self.store.load();key=note_key(vault,path);previous=self.notes.get(key,{'rows':[]})
        rows=components(text)
        for n,data in (image_rows or {}).items():rows[n].update(data)
        old_rows=components(old_text) if old_text is not None else previous['rows']
        entities=ChainMap({},self.entities);occurrences=ChainMap({},self.occurrences)
        edits=[];issues=[];seen=set();now=self.sequence+1
        # Exact prior occurrence key is authoritative. If both tokens were erased,
        # recovery additionally requires a unique unchanged body and same header
        # position in this previously observed note; never hash-only relocation.
        old_by_at={r['at']:r for r in old_rows if r.get('at')}
        if operation=='presentation':
            # Presentation is not an unrestricted bypass of copy versioning.
            # Restore only prior type tokens and require identical content hashes.
            restored=text
            for row in reversed(rows):
                prior=old_by_at.get(row.get('at'))
                if prior and row['type']!=prior['type']:
                    start=row['from']+row['header'].index('[!')+2
                    restored=restored[:start]+prior['type']+restored[start+len(row['type']):]
            for row in components(restored):
                prior=old_by_at.get(row.get('at'))
                if prior and row['hash']!=prior['hash']:
                    raise Conflict('A type change cannot also change the callout content')
        occupied_ats={r['at'] for r in rows if r.get('at')}
        for ordinal,row in enumerate(rows):
            identity=row['id'];at=row['at'];origin=row.get('origin')
            prior=old_by_at.get(at) if at else None
            if not identity:
                matches=[r for r in old_rows if r.get('id') and r.get('at') not in occupied_ats and r['hash']==row['hash'] and r['type']==row['type'] and r['title']==row['title']]
                if prior and prior.get('id'):
                    identity=prior['id'];issues.append({'kind':'restored-id','id':identity,'line':row['line']})
                elif len(matches)==1 and old_rows.index(matches[0])==ordinal:
                    prior=matches[0];identity=prior['id'];at=prior.get('at');issues.append({'kind':'restored-id','id':identity,'line':row['line']})
                elif matches or (ordinal<len(old_rows) and old_rows[ordinal].get('id') and old_rows[ordinal]['type']==row['type']):
                    affected=matches or [old_rows[ordinal]]
                    issues.append({'kind':'ambiguous-erased-id','ids':list({r['id'] for r in affected}),'line':row['line']})
                    seen.update(r['at'] for r in affected if r.get('at'));continue
                else:identity=fresh()+'.local'
            at=at or fresh();entity_id=base(identity);known=occurrences.get(at)
            # A present occurrence at a different location means copy. A deleted
            # occurrence returning after cut means move and retains its key.
            elsewhere=known and known.get('alive') and (known['vault']!=vault or known['path']!=path)
            if at in seen or (operation=='paste' and elsewhere):at=fresh();known=None
            elif elsewhere:
                # External duplicate files are copies too; ownership is never stolen.
                at=fresh();known=None
            seen.add(at)
            entity=entities.get(entity_id)
            if entity is not None and entity_id not in entities.maps[0]:
                entity=entities[entity_id]=copy.deepcopy(entity)
            if entity is None:
                entity=entities[entity_id]={'id':entity_id,'home':at,'revision':1,'hash':row['hash'],'contentHash':row['contentHash'],'hashVersion':2,'type':row['type'],'raw':row['raw'],'admitted':identity.endswith('.library'),'origin':origin,**{k:row[k] for k in ('semanticHash','images') if k in row}}
                if origin:entity['originSeen']=self.origin_snapshot(origin,entities)
            elif known and known.get('wasHome') and not known.get('alive') and operation in ('paste','move','undo'):
                entity['home']=at
            if entity.get('hashVersion')!=2:
                canonical=components(entity['raw'])[0]
                entity.update(contentHash=canonical['contentHash'],type=canonical['type'],hashVersion=2)
            is_home=entity['home']==at
            if not is_home and known and (known.get('contentHash')!=(row['contentHash'] if known.get('hashVersion')==2 else row['legacyContentHash']) if known.get('contentHash') else known['hash']!=row['hash']) and operation not in ('undo','sync','presentation'):
                origin=entity_id;entity_id=fresh();identity=entity_id+'.local'
                entity=entities[entity_id]={'id':entity_id,'home':at,'revision':1,'hash':row['hash'],'contentHash':row['contentHash'],'hashVersion':2,'type':row['type'],'raw':row['raw'],'admitted':False,'origin':origin,**{k:row[k] for k in ('semanticHash','images') if k in row}}
                entity['originSeen']=self.origin_snapshot(origin,entities)
                issues.append({'kind':'copy-version','id':entity_id,'origin':origin});is_home=True
            image_changed=(row.get('semanticHash') or row['contentHash'])!=(entity.get('semanticHash') or entity['contentHash'])
            if is_home and (entity['contentHash']!=row['contentHash'] or entity.get('type')!=row['type'] or image_changed) and (known is None or known['hash']!=row['hash'] or image_changed):
                entity.update(hash=row['hash'],contentHash=row['contentHash'],type=row['type'],raw=row['raw'],revision=entity['revision']+1,**{k:row[k] for k in ('semanticHash','images') if k in row})
            entity['admitted']=entity_id in self.store.entries
            identity=entity_id+('.library' if entity['admitted'] else '.local')
            occurrences[at]={'at':at,'id':entity_id,'vault':vault,'path':path,'hash':row['hash'],'contentHash':row['contentHash'],'hashVersion':2,'type':row['type'],'created':known['created'] if known else now,'alive':True,'wasHome':is_home,**{k:row[k] for k in ('semanticHash','images') if k in row}}
            replacement=header(row,identity,at,origin)
            if replacement!=row['header']:edits.append({'from':row['from'],'to':row['headerTo'],'insert':replacement})
        # Whole-note deletion is allowed. Retain tombstones for Undo/cut moves.
        for at in {r.get('at') for r in previous['rows']} - {None}:
            occ=occurrences.get(at)
            if not occ:continue
            if occ['vault']==vault and occ['path']==path and at not in seen and occ.get('alive'):
                occ=occurrences[at]=dict(occ)
                occ['alive']=False;entity=entities[occ['id']]
                if occ['id'] not in entities.maps[0]:entity=entities[occ['id']]=copy.deepcopy(entity)
                if entity['home']==at:
                    choices=sorted((o for o in occurrences.values() if o['id']==occ['id'] and o.get('alive')),key=lambda o:(o['created'],o['at']))
                    if choices:
                        entity['home']=choices[0]['at'];issues.append({'kind':'home-promoted','id':occ['id'],'at':choices[0]['at']})
        result=text
        for edit in sorted(edits,key=lambda e:e['from'],reverse=True):result=result[:edit['from']]+edit['insert']+result[edit['to']:]
        final_rows=components(result)
        for n,data in (image_rows or {}).items():final_rows[n].update(data)
        for row in final_rows:
            if not row.get('id') or not row.get('at'):continue
            entity_id=base(row['id']);entity=entities.get(entity_id)
            if entity and entity['home']==row['at'] and entity['raw']!=row['raw']:
                if entity_id not in entities.maps[0]:entity=entities[entity_id]=copy.deepcopy(entity)
                entity['raw']=row['raw']
        # Record changed identity/content rows, not the entire note or offsets
        # of every following callout. Ordering changes only on insert/move/delete.
        compact=lambda r:{k:r.get(k) for k in ('at','id','hash','contentHash','semanticHash','hashVersion','type','title')}
        before={r['at']:compact(r) for r in previous['rows'] if r.get('at')}
        after={r['at']:compact(r) for r in final_rows if r.get('at')}
        # Unresolved erasures keep their recorded home until repaired or an
        # explicit whole-callout deletion; they are not automatic deletions.
        # Keep unresolved occurrences at their prior ordinal, rather than
        # appending them after copies and losing the evidence for recovery on
        # the next observation.
        old_order=list(before)
        for at in old_order:
            if at in seen and at not in after:
                pairs=list(after.items());pairs.insert(min(old_order.index(at),len(pairs)),(at,before[at]));after=dict(pairs)
        delta={'upserts':{at:r for at,r in after.items() if before.get(at)!=r},'removed':[at for at in before if at not in after]}
        if list(before)!=list(after):delta['order']=list(after)
        changes={group:{k:v for k,v in values.maps[0].items() if getattr(self,group).get(k)!=v} for group,values in [('entities',entities),('occurrences',occurrences)]}
        changes['notes']={key:delta} if delta['upserts'] or delta['removed'] or 'order' in delta else {}
        return {'sequence':self.sequence,'key':fresh(),'text':result,'inputHash':digest(text),'resultHash':digest(result),'changes':changes,'issues':issues}

    def finish(self,plan,text):
        if digest(text)!=plan['resultHash']:raise Conflict('Component text changed before ownership was saved')
        if any(plan['changes'].values()):self.commit(plan['key'],plan['sequence'],plan['changes'],plan['issues'])
        return {'sequence':self.sequence,'issues':plan['issues']}

    def state(self,vault,path):
        self.load();self.store.load();result=[]
        for row in self.notes.get(note_key(vault,path),{}).get('rows',[]):
            occ=self.occurrences.get(row.get('at'));entity=self.entities.get(base(row['id'])) if row.get('id') else None
            if not occ or not entity:continue
            ancestors=[{k:v for k,v in change.items() if k not in ('before','after')} for change in self.ancestor_changes(entity)]
            result.append({'id':row['id'],'at':row['at'],'home':entity['home']==row['at'],'admitted':entity['id'] in self.store.entries,'revision':entity['revision'],'sourceChanged':bool(ancestors) or ((row.get('semanticHash') or row['contentHash'])!=(entity.get('semanticHash') or entity.get('contentHash') or components(entity['raw'])[0]['contentHash']) if row.get('contentHash') else row['hash']!=entity['hash']),'origin':entity.get('origin'),'ancestorChanges':ancestors})
        return result

    def tags(self,identity=None,query=''):
        self.load()
        if identity:
            entity=self.entities.get(base(identity) if '.' in identity else identity)
            if not entity:raise Conflict('Callout identity is unavailable')
            return {'tags':entity.get('tags',[])}
        if getattr(self,'tag_sequence',None)!=self.sequence:
            self.tag_names=sorted({tag for entity in self.entities.values() for tag in entity.get('tags',[])})
            self.tag_sequence=self.sequence
        query=query.strip().casefold()
        return {'tags':[tag for tag in self.tag_names if query in tag][:50]}

    def set_tags(self,identity,tags,key):
        self.load();identity=base(identity) if '.' in identity else identity
        if identity not in self.entities:raise Conflict('Callout identity is unavailable')
        if not isinstance(tags,list) or len(tags)>64 or any(not isinstance(t,str) or len(t)>80 or any(ord(c)<32 for c in t) for t in tags):raise ValueError('Use up to 64 short text tags')
        tags=sorted({t.strip().lstrip('#').casefold() for t in tags if t.strip().lstrip('#')})
        if not isinstance(key,str) or not 1<=len(key)<=128:raise ValueError('Provide a short idempotency key')
        prior_sequence=self.receipt_sequence(key)
        if prior_sequence is not None:
            event=json.loads((self.root/f'{prior_sequence:012d}.json').read_text())
            prior=event.get('entities',{}).get(identity)
            if not prior or prior.get('tags')!=tags:raise Conflict('This idempotency key was used for another change')
            return {'id':identity,'tags':tags}
        entity={**self.entities[identity],'tags':tags}
        self.commit(key,self.sequence,{'entities':{identity:entity},'occurrences':{},'notes':{}},[])
        return {'id':identity,'tags':tags}

    def sync_text(self,vault,path,text,at,ancestor=None,source=None):
        self.load();matches=[r for r in components(text) if r.get('at')==at]
        if len(matches)!=1:raise Conflict('The copied callout changed; reopen it before synchronizing')
        row=matches[0];occ=self.occurrences.get(at);entity=self.entities.get(base(row['id']))
        if not occ or not entity or occ['vault']!=vault or occ['path']!=path:raise Conflict('Callout ownership is unavailable')
        if ancestor:
            changes={c['id']:c for c in self.ancestor_changes(entity)}
            if ancestor not in changes:raise Conflict('The selected ancestor is no longer awaiting review')
            entity=self.entities[ancestor]
        from component_membership import replacement
        return text[:row['from']]+replacement(row,source or entity['raw'],text,take_type=True)+text[row['to']:]
