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


ENTITY='entity:';OCCURRENCE='occurrence:';NOTE='note:'
ROW_FIELDS=('hash','contentHash','semanticHash','hashVersion','type','title')


class NotesView:
    """Note rows as before B4: membership and order from the note object, content
    from each occurrence (the note object itself holds only at/id)."""
    def __init__(self,registry):self.registry=registry;self.raw={}
    def enrich(self,value):
        rows=[]
        for row in value.get('rows',[]):
            occurrence=self.registry.occurrences.get(row.get('at')) or {}
            rows.append({**row,**{k:occurrence[k] for k in ROW_FIELDS if k in occurrence}})
        return {**value,'rows':rows}
    def get(self,key,default=None):return self.enrich(self.raw[key]) if key in self.raw else default
    def __getitem__(self,key):return self.enrich(self.raw[key])
    def __setitem__(self,key,value):self.raw[key]=value
    def __contains__(self,key):return key in self.raw
    def __iter__(self):return iter(self.raw)
    def __len__(self):return len(self.raw)
    def pop(self,key,default=None):return self.raw.pop(key,default)
    def keys(self):return self.raw.keys()
    def items(self):return [(k,self[k]) for k in self.raw]
    def values(self):return [self[k] for k in self.raw]
    def __eq__(self,other):return dict(self.items())==(dict(other.items()) if isinstance(other,NotesView) else other)


class ComponentIdentities:
    """Folded view of the replicated component journal (journals/components).

    Entities, occurrences and the ordered rows of each note are journal objects
    with explicit parent revisions. Concurrent changes from two Macs leave
    competing heads: the object is flagged and every write touching it is
    refused until it is resolved. A reader host only reads.
    """
    RECEIPT_LIMIT=512 # retained for compatibility; every key stays resolvable
    def __init__(self,store):
        self.store=store;self.journal=store.component_journal
        self.root=store.root/'journals'/'components'
        self.reader=bool(getattr(store,'reader',False))
        self.entities={};self.occurrences={};self.notes=NotesView(self);self.receipts={};self.sequence=0;self.head=None
        self.by_entity={};self.by_vault={};self.children={};self.event_entities={};self.competing=set()
        self.load()

    def record_receipt(self,key,sequence):
        self.receipts.setdefault(key,sequence)

    def receipt_sequence(self,key):
        return self.receipts.get(key)

    def checkpoint(self):
        """The shared journal is folded by the store; its host-local checkpoint covers both journals."""
        if not self.reader:self.store.checkpoint()

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

    def _display(self,obj):
        value,heads=self.journal.state(obj)
        if not heads:return None,False
        if len(heads)>1:
            versions=[self.journal.revisions[h]['value'] for h in heads]
            live=[v for v in versions if v is not None and not (isinstance(v,dict) and v.get('deleted'))]
            if not live:return None,True
            value=copy.deepcopy(live[-1])
            if isinstance(value,dict):value['competing']=[{'revisionId':h,'writer':self.journal.revisions[h]['writer']} for h in heads]
            return value,True
        if isinstance(value,dict) and value.get('deleted'):return None,False
        return value,False

    def load(self):
        """Consume component events newly folded by the store, in the local order."""
        self.store.load()
        while self.sequence<len(self.journal.applied):
            h=self.journal.applied[self.sequence];event=self.journal.events[h];changed_entities=set()
            for obj in self.journal.changed[h]:
                value,conflicted=self._display(obj)
                if conflicted:self.competing.add(obj)
                else:self.competing.discard(obj)
                if obj.startswith(ENTITY):
                    key=obj[len(ENTITY):];changed_entities.add(key)
                    self.index_origin(self.entities.get(key),remove=True)
                    if value is None:self.entities.pop(key,None)
                    else:self.entities[key]=value
                    self.index_origin(value)
                elif obj.startswith(OCCURRENCE):
                    key=obj[len(OCCURRENCE):]
                    self.index_occurrence(self.occurrences.get(key),remove=True)
                    if value is None:self.occurrences.pop(key,None)
                    else:self.occurrences[key]=value
                    self.index_occurrence(value)
                elif obj.startswith(NOTE):
                    key=obj[len(NOTE):]
                    if value is None:self.notes.pop(key,None)
                    else:self.notes[key]=value
            self.sequence+=1;self.head=h;self.event_entities[self.sequence]=sorted(changed_entities)
            if h not in self.journal.voided:self.receipts.setdefault(event['key'],self.sequence)

    def resolve(self,obj,revision,key,expected_heads):
        """Replace exactly the competing heads the person saw with the chosen head's value."""
        with self.store.lock():
            return self._resolve(obj,revision,key,expected_heads)

    def _resolve(self,obj,revision,key,expected_heads):
        self.load();heads=self.journal.heads.get(obj,[])
        if len(heads)<2:raise Conflict('This callout identity has no competing versions')
        if sorted(heads)!=sorted(expected_heads or []):raise Conflict('Another version arrived after this choice; review the current versions again')
        if revision not in heads:raise Conflict('Choose one of the current competing versions')
        value=self.journal.revisions[revision]['value'];kind,name=obj.split(':',1)
        group={'entity':'entities','occurrence':'occurrences','note':'notes'}[kind]
        changes={'entities':{},'occurrences':{},'notes':{}}
        changes[group][name]=value if group!='notes' else {'rows':value['rows']}
        return self.commit(key,None,changes,[{'kind':'resolved','object':obj,'kept':revision}],operation='resolve',parents={obj:heads})

    def quarantine(self):
        """Identities preserved from an unfolded legacy profile, pending Grady's reconciliation."""
        if not hasattr(self,'_quarantine'):
            ids=set()
            for path in sorted((self.store.root/'legacy').glob('*/quarantine.json')):
                data=json.loads(path.read_text());ids.update(data.get('entities',[]));ids.update(data.get('occurrences',[]))
            self._quarantine=ids
        return self._quarantine

    def blocked(self,objects):
        """Competing versions block every change to an object until resolved.

        A note's membership record is the exception: heads that add or remove
        disjoint rows merge deterministically, with the merged note text as the
        arbiter (each head's change must be in it).
        """
        return sorted(obj for obj in objects if self.journal.conflicted(obj)
                      and not (obj.startswith(NOTE) and self.mergeable(obj,objects[obj]['value'].get('rows',[]) if isinstance(objects[obj].get('value'),dict) else [])))

    def ancestors(self,revision):
        seen=set();pending=[revision]
        while pending:
            h=pending.pop()
            if h in seen or h not in self.journal.revisions:continue
            seen.add(h);pending.extend(self.journal.revisions[h]['parents'])
        return seen

    def mergeable(self,obj,rows):
        heads=self.journal.heads.get(obj,[])
        if len(heads)<2:return False
        lineage=[self.ancestors(h) for h in heads];common=set.intersection(*lineage)
        bases=[c for c in common if not any(c!=o and c in self.ancestors(o) for o in common)]
        if len(bases)>1:return False
        pairs=lambda value:{(r.get('at'),r.get('id')) for r in ((value or {}).get('rows') or [])}
        base_rows=pairs(self.journal.revisions[bases[0]]['value']) if bases else set()
        result={(r.get('at'),r.get('id')) for r in rows};touched=set()
        for head in heads:
            mine=pairs(self.journal.revisions[head]['value']);added=mine-base_rows;removed=base_rows-mine
            ats={at for at,_ in added|removed}
            if ats&touched:return False # two heads changed the same row
            touched|=ats
            if not added<=result or removed&result:return False # the merged text must carry each head's change
        return True

    def commit(self,key,expected,changes,issues,*,provenance=None,group=None,dependencies=(),operation=None,parents=None,merges=()):
        from host_role import require_writer
        require_writer(self,'Changing a callout identity')
        intent=digest({'changes':changes,'issues':issues})
        with self.store.lock():
            self.store.revalidate();self.load()
            if self.store.fault:raise Conflict('Library is read-only: '+self.store.fault)
            known=self.journal.keys.get(key)
            mine=self.store.journals.parked_events(key=key,instance=(group or {}).get('instance',''))
            parked=[e for e in mine if e['kind']=='components' and e['intent']==intent]
            if known or mine:
                same=self.journal.event_for_key(key,intent)
                if same is None and not parked:raise Conflict('This idempotency key was used for another change')
                return {'sequence':self.receipts.get(key,self.sequence),'key':key,'replayed':True,'event':same or parked[0]['hash'],'pending':same is None}
            if isinstance(expected,dict):
                moved=[obj for obj,heads in expected.items() if obj not in (parents or {}) and list(self.journal.heads.get(obj,[]))!=heads]
                if moved:raise Conflict('Component ownership changed; refresh the edit')
            objects={}
            for group_name,prefix in (('entities',ENTITY),('occurrences',OCCURRENCE)):
                for name,value in changes.get(group_name,{}).items():
                    current,heads=self.journal.state(prefix+name)
                    if prefix+name in (parents or {}):heads=[h for h in parents[prefix+name] if h in self.journal.revisions]
                    stored=value if value is not None else {'deleted':True}
                    if heads and current==stored and len(heads)==1:continue
                    objects[prefix+name]={'parents':list(heads),'value':stored}
            override=parents or {}
            for name,delta in changes.get('notes',{}).items():
                # The note object records membership and order only; content
                # lives on each occurrence, so edits to different callouts of
                # one note never compete on the note record.
                current,heads=self.journal.state(NOTE+name)
                if NOTE+name in override:heads=[h for h in override[NOTE+name] if h in self.journal.revisions]
                if 'rows' in delta:rows=[{'at':r.get('at'),'id':r.get('id')} for r in delta['rows']]
                else:
                    base_rows=(current or {'rows':[]})['rows'];order=delta.get('order',[r['at'] for r in base_rows if r.get('at')])
                    ids={r['at']:r.get('id') for r in base_rows if r.get('at')};ids.update({at:r.get('id') for at,r in delta['upserts'].items()})
                    rows=[{'at':at,'id':ids.get(at)} for at in order if at in ids and at not in delta['removed']]
                rows={'rows':rows}
                if heads and current==rows and len(heads)==1:continue
                objects[NOTE+name]={'parents':list(heads),'value':rows}
            # A merge an observation makes from integrated text names every current
            # head it saw; one that arrived since keeps the object blocked.
            blocked=[obj for obj in self.blocked(objects) if not (obj in merges and sorted(objects[obj]['parents'])==sorted(self.journal.heads.get(obj,[])))]
            if blocked and operation!='resolve':raise Conflict('Callout identities have competing versions from both Macs; resolve them first: '+', '.join(blocked[:3]))
            from journal import JournalFault
            try:
                written,_=self.store.journals.append('components',operation=(group or {}).get('operation') or digest({'key':key,'intent':intent}),key=key,intent=intent,
                                           objects=objects,provenance=provenance,payload={'issues':issues},group=group,dependencies=dependencies)
                self.load()
            except JournalFault as error:
                self.store.fault=str(error);raise Conflict('Index journal integrity failed: '+str(error)) from error
            self.store.checkpoint()
            return {'sequence':self.sequence,'key':key,'event':written['hash'],'entities':changes.get('entities',{}),'occurrences':changes.get('occurrences',{}),'notes':changes.get('notes',{}),'issues':issues}

    def rename_notes(self,vault,moves,*,key=None,group=None,dependencies=()):
        """Journal a verified file/folder rename without copying or versioning entities.

        moves maps old paths to (new path, exact destination text). The caller
        verifies the old filesystem paths are gone before invoking this method.
        """
        changes=self.rename_changes(vault,moves)
        if not changes:return {'changed':0}
        return self.commit(key or self.rename_key(vault,moves),self.sequence,changes,[],group=group,dependencies=dependencies)

    def rename_key(self,vault,moves):
        return 'rename-'+digest({'vault':vault,'moves':{k:[v[0],digest(v[1])] for k,v in moves.items()},'heads':{k:self.journal.heads.get(NOTE+note_key(vault,k),[]) for k in moves}})

    def rename_changes(self,vault,moves):
        """The component part of a rename (occurrence paths, note records), or None."""
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
        if not occurrences and not notes:return None
        return {'entities':{},'occurrences':occurrences,'notes':notes}

    # ----- per-component observation gate (store-before-source, source-before-store) -----
    def note_heads(self,vault,path):
        return self.journal.heads.get(NOTE+note_key(vault,path),[])

    def base_path(self,vault,path):
        return self.store.root/'local'/'note-bases'/(digest(note_key(vault,path))+'.json')

    def read_base(self,vault,path):
        try:
            value=json.loads(self.base_path(vault,path).read_text())
            return value if isinstance(value,dict) and 'objects' in value else None
        except (OSError,ValueError):return None

    def note_object_heads(self,vault,path,rows=None):
        key=note_key(vault,path);value,_=self.journal.state(NOTE+key)
        rows=rows if rows is not None else (value or {}).get('rows',[])
        objects={NOTE+key}
        for row in rows:
            if row.get('at'):objects.add(OCCURRENCE+row['at'])
            if row.get('id'):objects.add(ENTITY+base(row['id']))
        return {obj:list(self.journal.heads.get(obj,[])) for obj in sorted(objects)}

    def write_base(self,vault,path,text_hash=None,minted=()):
        """This host's last agreement with the journal, per object of the note."""
        if self.reader:return
        prior=self.read_base(vault,path) or {}
        target=self.base_path(vault,path);target.parent.mkdir(parents=True,exist_ok=True)
        atomic_json(target,{'objects':self.note_object_heads(vault,path),'minted':sorted(set(prior.get('minted',[]))|set(minted))})

    def remember_minted(self,vault,path,ats):
        """Identities this host derived (written before the editor saves them)."""
        if self.reader or not ats:return
        prior=self.read_base(vault,path) or {'objects':{},'minted':[]}
        target=self.base_path(vault,path);target.parent.mkdir(parents=True,exist_ok=True)
        atomic_json(target,{**prior,'minted':sorted(set(prior.get('minted',[]))|set(ats))})

    @staticmethod
    def content_key(value):
        if not value:return None
        return ('2',value.get('contentHash')) if value.get('hashVersion')==2 else ('1',value.get('hash'))

    def occurrence_history(self,obj):
        hashes=set();pending=list(self.journal.heads.get(obj,[]));seen=set()
        while pending:
            h=pending.pop()
            if h in seen:continue
            seen.add(h);info=self.journal.revisions[h];value=info['value'] or {}
            for key in (('2',value.get('contentHash')),('1',value.get('hash'))):
                if key[1]:hashes.add(key)
            pending.extend(info['parents'])
        return hashes

    def source_state(self,vault,path,text,details=None):
        """Per component: (state, parents override, waiting rows).

        awaiting: some rows wait (only those rows; the note's other rows are
        observed normally): a row is older than the journal's current version
        (the newer note has not arrived); it carries identities the journal does
        not know and this host did not mint; or it is exactly as integrated from
        the other Mac (or typed on top of that) while a KL operation the
        integration carried is not folded here yet.
        concurrent: a row was edited here on top of an older version than the
        journal's current one; it is recorded against that older version and
        becomes a competing head instead of silently replacing the newer one.
        An integrated row that no owed operation explains (a clean Git merge of
        two edits, an edit the other Mac never recorded) is observed normally on
        top of every current head: both Macs write the same merge revision.
        details (a dict) receives 'merges' (objects merged) and 'integrated'
        (record entries this observation settles once recorded).
        """
        prior=self.read_base(vault,path) or {'objects':{},'minted':[]}
        minted=set(prior.get('minted',[]));quarantined=self.quarantine()
        parents={};waiting=[];consistent=True;merges=set();settles=set()
        record=self.arrival(path);arrived=record.get('blocks',{});satisfied=set();present=set()
        owed=sorted(op for op in record.get('operations',[]) if not self.store.journals.knows_operation(op))
        blocks=None
        if arrived:
            from operations import component_blocks
            blocks=component_blocks(text)
        for row in components(text):
            at=row.get('at');identity=row.get('id')
            if not at or not identity:continue
            present.add(at)
            obj=OCCURRENCE+at;value,heads=self.journal.state(obj);entity=ENTITY+base(identity)
            pending=at in arrived and arrived.get(at) is not None # an integrated version of this row exists
            integrated=pending and blocks.get(at)==arrived.get(at)
            if not heads:
                consistent=False
                if not self.journal.heads.get(entity) and at not in minted and base(identity) not in quarantined:
                    waiting.append({'line':row['line'],'at':at,'reason':'identity not in the index yet'})
                continue
            row_key=('2',row['contentHash']) if (value or {}).get('hashVersion')==2 else ('1',row['hash'])
            same=row_key==self.content_key(value)
            here=bool(value) and value.get('alive',True) and value.get('vault')==vault and value.get('path')==path
            if pending and owed:
                # Content hashes intentionally omit some header presentation.
                # Even when the body matches, a pending integrated type/header
                # change cannot be adopted before its effective operation folds.
                consistent=False
                waiting.append({'line':row['line'],'at':at,'reason':'arrived from the other Mac; its index events have not arrived' if integrated
                                else 'typed on top of a version from the other Mac whose index events have not arrived'})
                continue
            competing=(len(heads)>1 or len(self.journal.heads.get(entity,()))>1 or
                       len(self.store.journal.heads.get('entry:'+base(identity),()))>1)
            if same and here and not (pending and competing):
                if at in arrived:satisfied.add(at)
                continue
            if pending:
                consistent=False
                if same and not here:continue # moved here: the rename rules decide (discovery or copy)
                # Nothing owed: an observation on top of the integrated version,
                # i.e. on every current head (a merge when they compete).
                settles.add(at)
                heads_now=list(heads)
                if len(heads_now)>1:parents[obj]=heads_now;merges.add(obj)
                entity_heads=list(self.journal.heads.get(entity,[]))
                if len(entity_heads)>1:parents[entity]=entity_heads;merges.add(entity)
                continue
            if same:continue
            consistent=False
            seen=prior['objects'].get(obj)
            if seen==heads:continue # nothing arrived since this host agreed: a local edit
            if row_key in self.occurrence_history(obj):
                waiting.append({'line':row['line'],'at':at,'reason':'a newer version from the other Mac has not arrived'})
            elif seen:
                parents[obj]=seen
                entity_seen=prior['objects'].get(entity)
                if entity_seen and entity_seen!=self.journal.heads.get(entity):parents[entity]=entity_seen
        for at,integrated_block in arrived.items():
            if integrated_block is not None or at in present:continue
            occurrence=self.occurrences.get(at)
            if occurrence and occurrence.get('alive') and occurrence.get('vault')==vault and occurrence.get('path')==path:
                consistent=False
                if owed:waiting.append({'line':None,'at':at,'reason':'removed on the other Mac; its index events have not arrived'})
                else:settles.add(at)
            else:satisfied.add(at)
        live=getattr(self,'live',None)
        if not self.reader and live is not None:
            import integrations
            if satisfied:integrations.retire(self.store.root,live.vault,path,satisfied)
            if waiting and owed and integrations.age_seconds(record)>integrations.ESCALATE_SECONDS:
                integrations.escalate(self.store.root,live.vault,path,waiting,owed)
            elif not waiting:integrations.clear_flag(self.store.root,live.vault,path)
        if details is not None:details.update(merges=merges,integrated=settles,owed=owed)
        if waiting:return 'awaiting',parents or None,waiting
        if parents:return 'concurrent',parents,[]
        return ('consistent' if consistent else 'local'),None,[]

    def arrival(self,path):
        """Integration record of this note in this vault ({} without vault-sync)."""
        live=getattr(self,'live',None)
        if live is None:return {}
        import integrations
        return integrations.load(self.store.root,live.vault,path)

    def arrived(self,path):return self.arrival(path).get('blocks',{})

    def owed(self,path):
        record=self.arrival(path)
        return sorted(op for op in record.get('operations',[]) if not self.store.journals.knows_operation(op))

    def plan(self,vault,path,text,*,operation='edit',old_text=None,image_rows=None,enrollment=None):
        """No source writes. A finish call accepts only the exact resulting text."""
        details={}
        state,parents,waiting=self.source_state(vault,path,text,details)
        # Only the waiting rows wait: they keep their recorded identity, content
        # and membership; every other row of the note is observed (and new
        # callouts get identities) as usual.
        held={w['at'] for w in waiting} if state=='awaiting' and operation not in ('paste','sync','undo') else set()
        result=self._plan_changes(vault,path,text,operation=operation,old_text=old_text,image_rows=image_rows,enrollment=enrollment,held=held)
        if waiting:result['issues'].append({'kind':'awaiting-source','path':path,'rows':waiting})
        if details.get('merges'):
            result['merges']=sorted(details['merges'])
            # Selecting the displayed version still resolves its other heads.
            # Keep unchanged values in this explicit integrated merge only.
            for obj in details['merges']:
                for prefix,group in ((ENTITY,'entities'),(OCCURRENCE,'occurrences')):
                    if obj.startswith(prefix):
                        name=obj[len(prefix):]
                        result['changes'][group].setdefault(name,getattr(self,group)[name])
        if details.get('integrated'):result['integrated']=sorted(details['integrated'])
        if state=='consistent' and not any(result['changes'].values()):
            prior=self.read_base(vault,path)
            if not prior or prior['objects']!=self.note_object_heads(vault,path):self.write_base(vault,path)
        result['sourceState']=state
        if parents:result['parents']=parents
        # Per-object expected heads replace a global sequence check: unrelated
        # traffic (other notes, the other Mac) never invalidates this plan.
        touched=[ENTITY+k for k in result['changes']['entities']]+[OCCURRENCE+k for k in result['changes']['occurrences']]+[NOTE+k for k in result['changes']['notes']]
        result['expected']={obj:list(self.journal.heads.get(obj,[])) for obj in touched}
        known=set(self.occurrences)
        minted=[r['at'] for r in components(result['text']) if r.get('at') and r['at'] not in known and r['at'] in result['changes']['occurrences']]
        self.remember_minted(vault,path,minted)
        key='component-'+digest({'vault':vault,'path':path,'input':result['inputHash'],'result':result['resultHash'],'changes':result['changes'],'parents':parents,'heads':self.note_object_heads(vault,path)})
        # An aborted group instance never absorbs a retry: the retry writes a new
        # instance of the same operation (identical plans on both Macs keep one id).
        result['key']=key
        return result

    def _plan_changes(self,vault,path,text,*,operation='edit',old_text=None,image_rows=None,enrollment=None,held=frozenset()):
        if operation not in ('edit','paste','move','undo','observe','sync','presentation'):raise ValueError('Unknown component operation')
        self.load();self.store.load();key=note_key(vault,path);previous=self.notes.get(key,{'rows':[]})
        rows=components(text)
        for n,data in (image_rows or {}).items():rows[n].update(data)
        old_rows=components(old_text) if old_text is not None else previous['rows']
        from enrollment import derive,git_blob
        enrollment=enrollment or {'ok':True,'vaultUuid':vault,'path':path,'blob':git_blob(text)}
        def new_id(ordinal,kind):
            # Pinned convention: the ordinal is the row's index in components(text).
            return derive(enrollment.get('vaultUuid',vault),path,enrollment.get('blob') or git_blob(text),ordinal,kind)
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
        seen.update(at for at in held if at not in occupied_ats) # a waiting removal keeps its row
        quarantined=self.quarantine()
        for ordinal,row in enumerate(rows):
            identity=row['id'];at=row['at'];origin=row.get('origin')
            if at and at in held:seen.add(at);continue # waits: no identity, content or header change
            if quarantined and ((identity and base(identity) in quarantined) or (at and at in quarantined)):
                # Never adopt an unreconciled legacy identity from a marker.
                issues.append({'kind':'quarantined-identity','line':row['line'],'id':identity,'at':at});seen.add(at);continue
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
                else:
                    # A new identity: deterministic, and only from a committed,
                    # integrated base (both Macs derive the same bytes).
                    if not enrollment.get('ok'):
                        issues.append({'kind':'enrollment-waiting','line':row['line'],'reason':enrollment.get('reason')});continue
                    identity=new_id(ordinal,'entity')+'.local'
            if not at:
                if not enrollment.get('ok'):
                    issues.append({'kind':'enrollment-waiting','line':row['line'],'reason':enrollment.get('reason')});continue
                at=new_id(ordinal,'occurrence')
            entity_id=base(identity);known=occurrences.get(at)
            # A present occurrence at a different location means copy. A deleted
            # occurrence returning after cut means move and retains its key.
            elsewhere=known and known.get('alive') and (known['vault']!=vault or known['path']!=path)
            if at in seen or (operation=='paste' and elsewhere):at=new_id(ordinal,'copy-occurrence');known=None
            elif elsewhere:
                # External duplicate files are copies too; ownership is never stolen.
                at=new_id(ordinal,'copy-occurrence');known=None
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
                origin=entity_id;entity_id=new_id(ordinal,'copy-version');identity=entity_id+'.local'
                entity=entities[entity_id]={'id':entity_id,'home':at,'revision':1,'hash':row['hash'],'contentHash':row['contentHash'],'hashVersion':2,'type':row['type'],'raw':row['raw'],'admitted':False,'origin':origin,**{k:row[k] for k in ('semanticHash','images') if k in row}}
                entity['originSeen']=self.origin_snapshot(origin,entities)
                issues.append({'kind':'copy-version','id':entity_id,'origin':origin});is_home=True
            image_changed=(row.get('semanticHash') or row['contentHash'])!=(entity.get('semanticHash') or entity['contentHash'])
            if is_home and (entity['contentHash']!=row['contentHash'] or entity.get('type')!=row['type'] or image_changed) and (known is None or known['hash']!=row['hash'] or image_changed):
                entity.update(hash=row['hash'],contentHash=row['contentHash'],type=row['type'],raw=row['raw'],revision=entity['revision']+1,**{k:row[k] for k in ('semanticHash','images') if k in row})
            entity['admitted']=entity_id in self.store.entries
            identity=entity_id+('.library' if entity['admitted'] else '.local')
            occurrences[at]={'at':at,'id':entity_id,'vault':vault,'path':path,'hash':row['hash'],'contentHash':row['contentHash'],'hashVersion':2,'type':row['type'],'title':row.get('title'),'created':known['created'] if known else 1+sum(1 for o in occurrences.values() if o['id']==entity_id),'alive':True,'wasHome':is_home,**{k:row[k] for k in ('semanticHash','images') if k in row}}
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
            if not row.get('id') or not row.get('at') or row['at'] in held:continue
            entity_id=base(row['id']);entity=entities.get(entity_id)
            if entity and entity['home']==row['at'] and entity['raw']!=row['raw']:
                if entity_id not in entities.maps[0]:entity=entities[entity_id]=copy.deepcopy(entity)
                entity['raw']=row['raw']
        # Record changed identity/content rows, not the entire note or offsets
        # of every following callout. Ordering changes only on insert/move/delete.
        compact=lambda r:{k:r.get(k) for k in ('at','id','hash','contentHash','semanticHash','hashVersion','type','title')}
        before={r['at']:compact(r) for r in previous['rows'] if r.get('at')}
        after={r['at']:(before[r['at']] if r['at'] in held else compact(r)) for r in final_rows if r.get('at') and (r['at'] not in held or r['at'] in before)}
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
        if not changes['notes'] and self.journal.conflicted(NOTE+key):
            rows=[{'at':r['at'],'id':r.get('id')} for r in final_rows if r.get('at')]
            if self.mergeable(NOTE+key,rows):changes['notes']={key:{'rows':rows}} # record the merge
        return {'sequence':self.sequence,'key':fresh(),'text':result,'inputHash':digest(text),'resultHash':digest(result),'changes':changes,'issues':issues}

    def finish(self,plan,text,*,provenance=None,group=None):
        if digest(text)!=plan['resultHash']:raise Conflict('Component text changed before ownership was saved')
        event=None
        if any(plan['changes'].values()):
            event=self.commit(plan['key'],plan.get('expected',plan['sequence']),plan['changes'],plan['issues'],provenance=provenance,group=group,parents=plan.get('parents'),merges=plan.get('merges',()))
        return {'sequence':self.sequence,'issues':plan['issues'],'event':event}

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
        known=self.journal.keys.get(key)
        if known:
            event=self.journal.events[known['events'][0]];prior=event['objects'].get(ENTITY+identity,{}).get('value')
            if not prior or prior.get('tags')!=tags:raise Conflict('This idempotency key was used for another change')
            return {'id':identity,'tags':tags}
        entity={**self.entities[identity],'tags':tags}
        import operations
        operations.journal_operation(self.live,'journal',key,'components',
                                     lambda:self.commit(key,self.sequence,{'entities':{identity:entity},'occurrences':{},'notes':{}},[]),affected=[identity]) if getattr(self,'live',None) else \
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
