"""TEST-only admission/synchronization adapter. Source files are read, never written."""
import hashlib
import json
import re
import secrets
import uuid
from pathlib import Path
from crawl import extract,source_lines,make_record,body_title
from callout_labels import library_component
from library_store import PortableLibrary, Conflict, atomic_json

MARKER=re.compile(r'^\s*<!-- knowledge-library:([0-9a-f-]{36}) -->\s*$')
START_MARKER=re.compile(r'^\s*<!-- knowledge-library-start:([0-9a-f-]{36}) -->\s*$')

def source_hash(text):return hashlib.sha256(text.replace('\r\n','\n').replace('\r','\n').encode()).hexdigest()

def complete(body):
    # Guard incomplete editing states; this is structural, not scientific validation.
    if not any(line.lstrip('> ').strip() for line in body.splitlines()[1:]):return False
    dollars=re.findall(r'(?<!\\)(?:\$\$|\$)',body)
    stack=None
    for token in dollars:
        if stack is None:stack=token
        elif stack==token:stack=None
        else:return False
    if stack:return False
    for opening,closing in [(r'\(',r'\)'),(r'\[',r'\]')]:
        if body.count(opening)!=body.count(closing):return False
    return True


def candidates(text, path):
    lines=source_lines(text);result=[]
    component_rows={}
    if re.search(r'\[![\w-]+\|[^\]\n]*[0-9a-f-]{36}\.(?:local|library)',text,re.I):
        from markdown_scan import components
        component_rows={row['line']+1:row for row in components(text)}
    extracted=list(extract(text,path));covered={e['line_start'] for e in extracted}
    # New components explicitly own their identity, even when their type is
    # outside legacy admission defaults or they are nested inside another item.
    for line,row in component_rows.items():
        if line in covered or not row.get('id') or not row.get('at'):continue
        end=line+row['raw'].count('\n')
        title=row['title'] or body_title(row['raw'].splitlines(keepends=True)[1:],row['type']) or row['type'].capitalize()
        entry=make_record(lines,line-1,end,row['type'],title,'callout:'+row['type'])
        entry.update(body=row['raw'],body_sha256=hashlib.sha256(row['raw'].encode()).hexdigest())
        extracted.append(entry)
    for entry in sorted(extracted,key=lambda e:e['line_start']):
        marker=None;marker_line=None;insertion_line=entry['line_end']
        for index in range(entry['line_end'],min(len(lines),entry['line_end']+8)):
            line=lines[index]
            if not line.strip():continue
            if re.fullmatch(r'\s*\^[A-Za-z0-9-]+\s*',line):
                insertion_line=index+1;continue
            match=MARKER.match(line)
            if match:marker=match[1];marker_line=index
            break
        preceding=next((lines[i] for i in range(entry['line_start']-2,-1,-1) if lines[i].strip()),'')
        start=START_MARKER.match(preceding)
        component=component_rows.get(entry['line_start'])
        if component and component.get('id') and component.get('at'):
            marker=component['at']
            # An explicit component type wins over a legacy word in its title.
            from callout_labels import ALIASES
            entry['kind']=ALIASES.get(component['type'],component['type'])
        result.append({**entry,'component':component,'occurrenceId':marker,'startId':marker if component else start[1] if start else None,'markerLine':marker_line,'insertionLine':insertion_line,'complete':complete(entry['body'])})
    return result


class LiveLibrary:
    def __init__(self, root, vault_root, allow_readonly=False, production=False, enrollment=False, role=None, writer=None, recover=True):
        self.vault=Path(vault_root).resolve()
        if not production and self.vault.name!='knowledge_library_lab':raise ValueError('Live operations are restricted to the development vault.')
        self.production=production
        from host_role import effective,READER
        # Missing or unknown host-local role means reader: no store, identity,
        # marker or note write can start from this process.
        self.role=effective(self.vault,production,role);self.reader=self.role==READER
        self.store=PortableLibrary(root,allow_readonly=allow_readonly,mode='PRODUCTION' if production else 'TEST',reader=self.reader,writer=writer,create=not production)
        from vault_registry import identity,enroll
        if not production:self.vault_id='knowledge_library_lab'
        elif self.reader:self.vault_id=identity(self.store,self.vault,strict_path=False)
        else:self.vault_id=enroll(self.store,self.vault) if enrollment else identity(self.store,self.vault)
        # A second isolated lab uses the same TEST store but a durable distinct
        # vault identity. Production enrollment and its paths remain unchanged.
        lab_instance=self.vault/'.knowledge-library/lab-instance.json'
        if not production and lab_instance.exists():
            instance=json.loads(lab_instance.read_text())['id']
            self.vault_id='lab-'+str(uuid.UUID(instance))
        if not production and not self.reader:
            with self.store.lock():
                roots_path=self.store.root/'lab-roots.json'
                roots=json.loads(roots_path.read_text()) if roots_path.exists() else {}
                if roots.get(self.vault_id)!=str(self.vault):
                    roots[self.vault_id]=str(self.vault);atomic_json(roots_path,roots)
        self.plans=Path(root)/'plans'/self.vault_id if production or self.vault_id!='knowledge_library_lab' else Path(root)/'plans'
        self.archive=self.plans/'archive'
        if not self.reader:self.plans.mkdir(parents=True,exist_ok=True);self.archive.mkdir(exist_ok=True)
        if not self.store.fault and not self.reader:
            for path in self.plans.glob('*.json'):
                if json.loads(path.read_text()).get('state') in ('committed','cancelled'):path.replace(self.archive/path.name)
        # This capability is held only by the live editor client, not saved in the journal.
        self.review_capability=secrets.token_urlsafe(32)
        # Resolve operations a crashed process of this host left unfinished,
        # before any observation of their notes can run.
        self.recovered=[]
        if not self.reader and not self.store.fault and recover:
            import operations
            self.recovered=operations.recover(self)
            if self.recovered:self.store.load()

    def owns(self, entry):
        return entry['home'].get('vaultId',entry['home']['vault'])==self.vault_id

    def source_root(self, entry,verify=True):
        # A shell mount and the editor may use different paths for this same vault.
        if self.owns(entry):return self.vault
        if not self.production:
            roots=json.loads((self.store.root/'lab-roots.json').read_text())
            root=roots.get(entry['home'].get('vaultId',entry['home']['vault']))
            if not root:raise Conflict('Source lab is unavailable.')
            return Path(root)
        from vault_registry import root_for
        return root_for(self.store,entry['home'],verify=verify)

    def path(self, relative):
        p=(self.vault/relative).resolve()
        if not p.is_relative_to(self.vault) or p.suffix!='.md':raise ValueError('Source must be a Markdown note inside the enrolled vault.')
        return p

    def read(self, relative):return self.path(relative).read_bytes().decode('utf-8')

    def metadata(self):return {'profile':self.store.config['id'],'epoch':self.store.config['epoch']}

    def local_reference_directory(self):
        # Rebuildable projections never travel with the shared journal.
        base=(Path.home()/'Library/Application Support/Knowledge Library/local-reference-state') if self.production else self.store.root.parent/'local-reference-state'
        key=hashlib.sha256((str(self.vault)+'\n'+str(self.store.root)).encode()).hexdigest()
        directory=base/key;directory.mkdir(parents=True,exist_ok=True)
        return directory

    def document_registry(self):
        if not hasattr(self,'_document_registry'):
            from document_registry import DocumentRegistry
            self._document_registry=DocumentRegistry(self.local_reference_directory()/'documents.sqlite')
        return self._document_registry

    def component_registry(self):
        if not hasattr(self,'_component_registry'):
            from component_identities import ComponentIdentities
            self._component_registry=ComponentIdentities(self.store);self._component_registry.live=self
        return self._component_registry

    def reference_entry(self,identity):
        """Preview an unadmitted entity without inserting it into the library."""
        from figure_panels import split,panels
        base,panel=split(identity)
        if panel:
            entry=self.reference_entry(base)
            if not entry or entry['kind']!='figure' or panel not in panels(entry['body']):return None
            return {**entry,'panel':panel,'title':entry['title']+' ('+panel+')'}
        entry=self.store.entries.get(identity)
        if entry:return entry
        registry=self.component_registry();registry.load()
        entity=registry.entities.get(identity)
        home=registry.occurrences.get(entity['home']) if entity else None
        if not home or not home.get('alive'):return None
        from markdown_scan import components
        row=components(entity['raw'])[0]
        return {'id':identity,'kind':row['type'],'title':row['title'],'body':entity['raw'],
                'revision':entity['revision'],'status':'current','admission':'local',**{k:entity[k] for k in ('images',) if k in entity},
                'home':{'vault':home['vault'],'vaultId':home['vault'],'path':home['path'],
                        'occurrenceId':home['at'],'markerFormat':'component-v1','mode':'owned'}}

    def component_detail(self,identity):
        entry=self.reference_entry(identity)
        if not entry:raise Conflict('This callout is no longer available.')
        from reuse import locate
        from figure_panels import split
        place=locate(self,split(identity)[0])
        return {**entry,**place,'line_start':place['line'],'line_end':place['endLine'],
                'sourcePath':place['path'],'context_after':'','copies':1}

    def component_plan(self,path,text,operation='edit',sync_at=None,ancestor=None,intent_kind=None,intent_data=None):
        from component_scope import guard
        guard(self.vault,path)
        self.store.load()
        self.path(path)
        unsettled=self.settle(path) if not self.reader else ''
        if unsettled:
            # An interrupted operation of this note is still being recovered:
            # nothing is observed until it is (never a copy-version of its bytes).
            from library_store import digest
            plan={'sequence':self.store.sequence,'key':'awaiting-'+digest({'v':self.vault_id,'p':path,'t':digest(text)}),'text':text,'inputHash':digest(text),'resultHash':digest(text),
                  'changes':{'entities':{},'occurrences':{},'notes':{}},'sourceState':'awaiting',
                  'issues':[{'kind':'awaiting-source','path':path,'rows':[],'reason':'an interrupted index operation of this note is being recovered: '+unsettled}]}
            token=secrets.token_urlsafe(24);directory=self.plans/'components';directory.mkdir(exist_ok=True)
            atomic_json(directory/(token+'.json'),{'path':path,'plan':plan,'before':text})
            return {'token':token,'text':text,'inputHash':plan['inputHash'],'issues':plan['issues'],'sourceState':'awaiting'}
        if not self.reader and operation in ('edit','observe'):self.discover_moves(path,text)
        if sync_at:
            from markdown_scan import components
            from portability import portable
            from image_assets import materialize
            row=next((r for r in components(text) if r.get('at')==sync_at),None)
            entry=self.reference_entry(ancestor or row['id'].split('.')[0]) if row else None
            source=None
            if entry and entry.get('images'):
                source=portable(self,entry['id'])['body'];materialize(self,entry['images'])
            text=self.component_registry().sync_text(self.vault_id,path,text,sync_at,ancestor,source);operation='sync'
        from image_assets import component_images,prepare_paste
        from markdown_scan import components
        if operation=='paste':text=prepare_paste(self,path,text)
        from enrollment import context
        plan=self.component_registry().plan(self.vault_id,path,text,operation=operation,image_rows=component_images(self,path,components(text)),enrollment=context(self,path,text))
        if ancestor:
            from markdown_scan import components
            import copy
            row=next(r for r in components(plan['text']) if r.get('at')==sync_at)
            identity=row['id'].split('.')[0];registry=self.component_registry()
            entity=copy.deepcopy(plan['changes']['entities'].get(identity,registry.entities[identity]))
            entity.setdefault('originSeen',{})[ancestor]={k:registry.entities[ancestor].get(k) for k in ('revision','contentHash','semanticHash','images','hashVersion','raw')}
            plan['changes']['entities'][identity]=entity
        if plan.get('integrated'):
            plan['integratedEntryChanges']=self.entry_changes(plan,{'path':path,'kind':intent_kind},plan['text'])
            plan['integratedEntryHeads']={change['id']:list(self.store.journal.heads.get('entry:'+change['id'],()))
                for change in plan['integratedEntryChanges']}
        token=secrets.token_urlsafe(24);directory=self.plans/'components';directory.mkdir(exist_ok=True)
        atomic_json(directory/(token+'.json'),{'path':path,'plan':plan,'before':text})
        if not self.reader and (intent_kind or plan['text']!=text or operation in ('sync','undo')):
            try:disk=self.read(path)
            except FileNotFoundError:disk=None
            if disk!=plan['text']:
                # Durable intent before KL's bytes (or a generated update) reach
                # the note: exact pre/postimage, intended events, affected ids.
                import operations
                kind=intent_kind or {'sync':'propagation','undo':'propagation-undo'}.get(operation,'component')
                operations.prepare(self,kind,token,operation=plan['key'],path=path,before=disk,after=plan['text'],
                                   intended=[{'journal':'components','key':plan['key']},{'journal':'entries','key':'component-home-'+plan['key']}],
                                   data={**(intent_data or {}),'plan':token,'operation':operation},affected=list(plan['changes']['entities']),
                                   expected=plan.get('expected') if isinstance(plan.get('expected'),dict) else None,
                                   assets=[i['sha256'] for e in plan['changes']['entities'].values() if e for i in e.get('images',[]) if isinstance(i,dict) and i.get('sha256')])
        if (plan['text']!=text or any(plan['changes'].values())) and not self.reader:
            # Label the bytes before anyone saves (or captures) them: KL-produced
            # bytes, and the note bytes this plan records. The other Mac then
            # waits for exactly this operation before it observes those bytes.
            import operations
            operations.publish_provenance(self,{'operation':plan['key'],'path':path},plan['text'])
        self.__dict__.pop('_materialized',None) # never attributed to a later operation
        # Return just the editor plan, never the entire ownership journal.
        return {'token':token,'text':plan['text'],'inputHash':plan['inputHash'],'issues':plan['issues'],'sourceState':plan.get('sourceState')}

    def component_finish(self,token,text,kind=None,data=None):
        if not re.fullmatch(r'[A-Za-z0-9_-]{32}',token):raise ValueError('Invalid component plan')
        plan_path=self.plans/'components'/(token+'.json');saved=json.loads(plan_path.read_text())
        from component_scope import guard
        guard(self.vault,saved['path'])
        if 'finished' in saved:
            from library_store import digest
            if digest(text)!=saved['resultHash']:raise Conflict('Component text differs from the completed plan')
            return {**saved['finished'],'states':self.component_registry().state(self.vault_id,saved['path'])}
        from library_store import digest
        if digest(text)!=saved['plan']['resultHash']:raise Conflict('Component text changed before ownership was saved')
        try:on_disk=self.read(saved['path'])
        except FileNotFoundError:on_disk='' if text=='' else None
        # Saved-byte acknowledgement: the journal records only text that is on disk.
        if on_disk!=text:raise Conflict('The note has not finished saving; its index update will retry.')
        import operations
        intent={'operation':saved['plan']['key'],'vaultId':self.vault_id,'path':saved['path'],'token':token,
                'inputHash':saved['plan']['inputHash'],'resultHash':saved['plan']['resultHash'],'before':saved.get('before'),'after':text,
                'intended':[{'journal':'components','key':saved['plan']['key']},{'journal':'entries','key':'component-home-'+saved['plan']['key']}],
                **({'kind':kind} if kind else {}),**({'data':data} if data else {})}
        with self.store.lock():
            # Verified again under the store lock: the bytes being recorded are on disk.
            try:on_disk=self.read(saved['path'])
            except FileNotFoundError:on_disk='' if text=='' else None
            if on_disk!=text:raise Conflict('The note has not finished saving; its index update will retry.')
            intent=operations.begin(self.store,token,intent)
            result=self.finish_component_intent(token,intent,text,saved=saved)
        for issue in result['issues']:
            if issue['kind']=='ambiguous-erased-id':
                issue['affectedReferences']=self.reference_index().component_dependents(saved['path'],issue['ids'])
                issue['referenceScope']='indexed notes in this vault'
        # Keep a compact retry receipt, not the entire document for every edit.
        atomic_json(plan_path,{'path':saved['path'],'resultHash':saved['plan']['resultHash'],'finished':result,
                              **{key:saved[key] for key in ('undo','propagation') if key in saved}})
        return {**result,'states':self.component_registry().state(self.vault_id,saved['path'])}

    def finish_component_intent(self,token,intent,text,saved=None):
        """Write the operation's events as one group: ownership, then entry homes.

        Called under the store lock, for a live finish and for crash recovery
        (exact postimage only). Keys and the operation id are the plan's, so a
        retry never duplicates an event.
        """
        import operations
        if saved is None:saved=json.loads((self.plans/'components'/(token+'.json')).read_text())
        plan=saved['plan'];registry=self.component_registry();registry.load()
        provenance={'vault':self.vault_id,'path':intent['path'],'inputHash':plan['inputHash'],'resultHash':plan['resultHash'],'operation':plan['key']}
        try:homes=self.entry_changes(plan,intent,text)
        except Conflict as error:
            operations.close_group(self.store,intent)
            operations.end(self.store,token,'needs-review',str(error))
            raise
        grouped=bool(any(plan['changes'].values()) and homes);instance=intent.get('instance')
        group1={'operation':plan['key'],'parts':2,'part':1,'instance':instance} if grouped else None
        intended=([{'journal':'components','key':plan['key'],**({'part':1} if grouped else {})}] if any(plan['changes'].values()) else [])+\
                 ([{'journal':'entries','key':'component-home-'+plan['key'],**({'part':2} if grouped else {})}] if homes else [])
        if (operations.folder(self.store)/(token+'.json')).exists():operations.update(self.store,token,intended=intended)
        intent={**intent,'intended':intended}
        try:
            result=registry.finish(plan,text,provenance=provenance,group=group1)
            if grouped and (result.get('event') or {}).get('replayed') and not (result.get('event') or {}).get('pending'):
                grouped=False # part 1 already exists as an applied event: part 2 must not wait for a group
            if homes:
                dependency=[result['event']['event']] if result.get('event') else []
                self.store.commit(**self.metadata(),key='component-home-'+plan['key'],actor='component-ownership',changes=homes,operation='replace-source',
                                  provenance=provenance,group={'operation':plan['key'],'parts':2,'part':2,'instance':instance} if grouped else None,dependencies=dependency)
        except Conflict as error:
            operations.close_group(self.store,intent)
            operations.end(self.store,token,'needs-review',str(error))
            raise
        except Exception as error:
            operations.interrupted(self,token,intent,error)
            raise
        # This host's instance may hold a parked part whose operation another Mac
        # completed (its parts replayed here): void the leftover instance.
        operations.close_group(self.store,intent)
        registry.load();registry.write_base(self.vault_id,intent['path'],plan['resultHash'])
        if plan.get('integrated'):
            import integrations # the integrated rows this observation recorded are settled
            integrations.retire(self.store.root,self.vault,intent['path'],set(plan['integrated']))
        operations.end(self.store,token,'completed')
        return {'sequence':registry.sequence,'issues':result['issues']}

    def entry_changes(self,plan,intent,text):
        """The entries part of a component operation, computed before anything is written.

        Home moves always; index edits and reconciled incoming source rows also
        record the entry's body, title and kind in this same durable group.
        A capture or crash cannot publish the component half without the entry
        half, or discard the incoming merge proof before both are recorded.
        """
        if 'integratedEntryChanges' in plan:
            self.store.load();pending=[]
            for change in plan['integratedEntryChanges']:
                entry_id=change['id'];expected=plan['integratedEntryHeads'].get(entry_id,[])
                heads=list(self.store.journal.heads.get('entry:'+entry_id,()))
                if sorted(heads)==sorted(expected):pending.append(change);continue
                # An autosave between plan and finish may have recorded exactly
                # this merge. Accept only its exact parents and committed value.
                value={**change['entry'],'id':entry_id,'revision':change['expectedRevision']+1}
                for transient in ('competing','ownershipConflict'):value.pop(transient,None)
                revision=self.store.journal.revisions[heads[0]] if len(heads)==1 else None
                if revision and sorted(revision['parents'])==sorted(expected) and revision['value']==value:continue
                raise Conflict('Entry versions changed after the integrated source was reviewed; refresh the observation.')
            return pending
        homes=self.planned_home_changes(plan)
        kind=intent.get('kind')
        integrated=set(plan.get('integrated',()))
        if kind not in ('entry-edit',) and not integrated:return homes
        for entry_id,heads in plan.get('integratedEntryHeads',{}).items():
            if sorted(self.store.journal.heads.get('entry:'+entry_id,()))!=sorted(heads):
                raise Conflict('Entry versions changed after the integrated source was reviewed; refresh the observation.')
        overlay={c['id']:{**c['entry'],'revision':c['expectedRevision']} for c in homes}
        updates,_=self.sync_changes(intent['path'],text,True,None,overlay,integrated=integrated)
        merged={c['id']:c for c in homes}
        for change in updates:
            if kind=='entry-edit' or change['entry']['home'].get('occurrenceId') in integrated:
                merged[change['id']]=change
        return list(merged.values())

    def planned_home_changes(self,plan):
        """Entry home moves implied by a component plan, computed before it is written."""
        from collections import ChainMap
        registry=self.component_registry();registry.load();self.store.load();changes=[]
        entities=ChainMap(plan['changes']['entities'],registry.entities);occurrences=ChainMap(plan['changes']['occurrences'],registry.occurrences)
        for identity in plan['changes']['entities']:
            entry=self.store.entries.get(identity);entity=entities.get(identity)
            if not entry or not entity or entry['home'].get('markerFormat')!='component-v1':continue
            occurrence=occurrences.get(entity['home'])
            if not occurrence or not occurrence.get('alive'):continue
            old=entry['home']
            same_home=(old.get('vaultId',old['vault']),old['path'],old['occurrenceId'])==(occurrence['vault'],occurrence['path'],occurrence['at'])
            type_changed=entity.get('type',entry['kind'])!=entry['kind']
            if same_home and not type_changed:continue
            document=str(uuid.uuid5(uuid.NAMESPACE_URL,'knowledge-library:'+occurrence['vault']+'\n'+occurrence['path']))
            home={**old,'vault':occurrence['vault'],'vaultId':occurrence['vault'],'path':occurrence['path'],'occurrenceId':occurrence['at'],'documentId':document,'line':1}
            clean={k:v for k,v in entry.items() if k not in ('competing','ownershipConflict')}
            changes.append({'id':identity,'expectedRevision':entry['revision'],'entry':{**clean,'home':home,'status':'current',**({'kind':entity['type'],**library_component(entity['raw'])} if type_changed else {})}})
        return changes

    def reconcile_component_homes(self,plan):
        """The durable occurrence journal also owns admitted source locations.

        Replaying a finished plan is safe after interruption between the two
        journals. Promotion changes location, never replaces canonical content
        with a potentially stale copy.
        """
        registry=self.component_registry();registry.load();self.store.load();changes=[]
        for identity in plan['changes']['entities']:
            entry=self.store.entries.get(identity);entity=registry.entities.get(identity)
            if not entry or not entity or entry['home'].get('markerFormat')!='component-v1':continue
            occurrence=registry.occurrences.get(entity['home'])
            if not occurrence or not occurrence.get('alive'):continue
            old=entry['home']
            same_home=(old.get('vaultId',old['vault']),old['path'],old['occurrenceId'])==(occurrence['vault'],occurrence['path'],occurrence['at'])
            type_changed=entity.get('type',entry['kind'])!=entry['kind']
            if same_home and not type_changed:continue
            document=str(uuid.uuid5(uuid.NAMESPACE_URL,'knowledge-library:'+occurrence['vault']+'\n'+occurrence['path']))
            home={**old,'vault':occurrence['vault'],'vaultId':occurrence['vault'],'path':occurrence['path'],'occurrenceId':occurrence['at'],'documentId':document,'line':1}
            changes.append({'id':identity,'expectedRevision':entry['revision'],'entry':{**entry,'home':home,'status':'current',**({'kind':entity['type'],**library_component(entity['raw'])} if type_changed else {})}})
        if changes:self.store.commit(**self.metadata(),key='component-home-'+plan['key'],actor='component-ownership',changes=changes,operation='replace-source')

    def reference_index(self):
        if not hasattr(self,'_reference_index'):
            from reference_index import ReferenceIndex
            self._reference_index=ReferenceIndex(self.local_reference_directory()/'references.sqlite')
        return self._reference_index

    def numbering_snapshot(self):
        if not hasattr(self,'_numbering_policies'):
            from numbering_policy import NumberingPolicies
            self._numbering_policies=NumberingPolicies(self.vault)
        return self._numbering_policies.snapshot()

    def numbering_policy(self,path,override=None):
        if override is not None:raise ValueError('Numbering is configured in vault/book settings or note properties, not per request.')
        self.path(path)
        return self.numbering_snapshot().resolve(path)

    def guard_numbering(self,path,policy):
        current=self.numbering_policy(path)
        if current.get('policyStale'):raise Conflict('Numbering configuration is unavailable; repair it before applying reference changes.')
        if any(current[k]!=policy.get(k) for k in ('policyDigest','bookKey')):raise Conflict('Numbering settings changed; refresh the reference plan.')

    @staticmethod
    def reference_signature(file):
        stat=file.stat()
        return [stat.st_dev,stat.st_ino,stat.st_size,stat.st_mtime_ns,stat.st_ctime_ns]

    def index_reference_note(self,path,expected_hash,config=None):
        policy=self.numbering_policy(path,config)
        self.guard_numbering(path,policy)
        file=self.path(path);before=self.reference_signature(file);text=self.read(path)
        if hashlib.sha256(text.encode()).hexdigest()!=expected_hash:raise Conflict('Note changed before reference indexing.')
        return self._index_reference_snapshot(path,text,policy,before)

    def _index_reference_snapshot(self,path,text,policy,before):
        self.guard_numbering(path,policy)
        file=self.path(path)
        if self.reference_signature(file)!=before:raise Conflict('Note changed during reference indexing.')
        index=self.reference_index();result=index.update(path,text,policy['config'])
        if self.reference_signature(file)!=before:raise Conflict('Note changed during reference indexing.')
        self.guard_numbering(path,policy);index.record_signature(path,before,policy)
        return {**result,'configurationDiagnostics':policy['diagnostics']}

    def refresh_reference_note(self,path,config=None):
        # One saved note per background request. No body read/hash for unchanged
        # files, including after restart. ctime/inode detect replacement with a
        # preserved timestamp; the signature never travels between computers.
        from numbering_policy import PolicyUnavailable
        try:policy=self.numbering_policy(path,config)
        except PolicyUnavailable as error:return {'issueCode':'policy-unavailable','issue':str(error),'path':path}
        finish=lambda result:{**result,'policyRevision':policy['policyRevision'],'policyStamp':policy['policyStamp']}
        if policy.get('policyStale'):return finish({'issueCode':'policy-unavailable','issue':policy['diagnostics'][-1]['reason'],'path':path})
        file=self.path(path);index=self.reference_index()
        try:
            signature=self.reference_signature(file)
            if index.current(path,signature,policy=policy):return finish({'changed':False,'revision':index.revision,'configurationDiagnostics':policy['diagnostics']})
            return finish(self._index_reference_snapshot(path,self.read(path),policy,signature))
        except UnicodeDecodeError:return finish({'issueCode':'unreadable','issue':'Target note is not valid UTF-8','path':path})
        except FileNotFoundError:return finish({'issueCode':'missing','issue':'Target note is missing','path':path})
        except OSError:return finish({'issueCode':'unavailable','issue':'Target note is temporarily unavailable','path':path})

    def reference_disk_state(self,path,policy=None):
        file=self.path(path)
        policy=policy or self.numbering_policy(path)
        try:
            if self.reference_index().current(path,self.reference_signature(file),policy=policy):return None
            if policy.get('policyStale'):return {'issueCode':'policy-unavailable','issue':policy['diagnostics'][-1]['reason'],'path':path}
            return {'issueCode':'not-indexed','issue':'Target note is updating','path':path}
        except FileNotFoundError:return {'issueCode':'missing','issue':'Target note is missing','path':path}
        except OSError:return {'issueCode':'unavailable','issue':'Target note is temporarily unavailable','path':path}

    def check_reference_notes(self,paths,include_policy=False):
        # Batch cheap stat checks, not parsing. The caller can yield between
        # individual changed-note refreshes so a large catch-up cannot occupy
        # the service ahead of interactive search requests.
        if not isinstance(paths,list) or len(paths)>500 or any(not isinstance(p,str) for p in paths):raise ValueError('Provide at most 500 note paths')
        from numbering_policy import PolicyUnavailable
        try:policies=self.numbering_snapshot()
        except PolicyUnavailable as error:
            notes=[{'path':p,'issueCode':'policy-unavailable','issue':str(error)} for p in dict.fromkeys(paths)]
            return {'notes':notes,'policyRevision':None,'issue':str(error)} if include_policy else notes
        result=[]
        for path in dict.fromkeys(paths):
            try:
                from document_registry import DocumentRegistry
                DocumentRegistry.record({'path':path})
                self.path(path)
                policy=policies.resolve(path)
                result.append({'path':path,**(self.reference_disk_state(path,policy) or {'state':'current'}),'configurationDiagnostics':policy['diagnostics']})
            except PolicyUnavailable as error:result.append({'path':path,'issueCode':'policy-unavailable','issue':str(error)})
            except ValueError as error:result.append({'path':path,'issueCode':'invalid-path','issue':str(error)})
        from numbering_policy import digest
        return {'notes':result,'policyRevision':policies.revision,'policyStamp':digest([policies.revision,getattr(policies,'error',None)])} if include_policy else result

    def reference_policy_reconcile(self,after='',limit=500,revision=None):
        from numbering_policy import PolicyUnavailable
        policies=self.numbering_snapshot()
        if revision is not None and revision!=policies.revision:raise Conflict('Numbering settings changed; restart policy reconciliation.')
        rows=self.reference_index().policy_page(after,limit);changed=[];issues=[]
        for row in rows:
            try:
                policy=policies.resolve(row['path'])
                if policy.get('policyStale'):raise PolicyUnavailable(policy['diagnostics'][-1]['reason'])
                if (row['book_key'],row['digest'])!=(policy['bookKey'],policy['policyDigest']):changed.append(row['path'])
            except PolicyUnavailable as error:issues.append({'path':row['path'],'issueCode':'policy-unavailable','issue':str(error)})
        return {'paths':changed,'indexedPaths':[row['path'] for row in rows],'issues':issues,'revision':policies.revision,'nextCursor':rows[-1]['path'] if len(rows)==limit else None}

    def remove_reference_note(self,path):
        if self.exact_note_exists(path):raise Conflict('The note still exists; refresh its references instead.')
        return {'removed':self.reference_index().remove(path)}

    def reference_display_state(self):
        """Cheap shared invalidation state; no source note reads or scans."""
        from numbering_policy import PolicyUnavailable,digest
        self.store.load()
        try:
            policy=self.numbering_snapshot()
            policy_stamp=digest([policy.revision,getattr(policy,'error',None)])
        except PolicyUnavailable as error:policy_stamp=digest(['unavailable',str(error)])
        return {'index':self.reference_index().revision,'registry':self.document_registry().generation,
                'library':self.store.sequence,'policy':policy_stamp}

    def resolve_reference_targets(self,path,targets):
        from reference_format import TARGET
        self.path(path)
        if not isinstance(targets,list) or len(targets)>256 or any(not isinstance(t,str) or not re.fullmatch(TARGET,t) for t in targets):
            raise ValueError('Provide at most 256 valid reference targets')
        registry=self.document_registry();index=self.reference_index();self.store.load();states={};owners={};diagnostics={}
        from numbering_policy import PolicyUnavailable
        try:policies=self.numbering_snapshot();policy_error=None
        except PolicyUnavailable as error:policies=None;policy_error=str(error)
        def owner(identity):
            if identity not in owners:owners[identity]=registry.owner(identity)
            return owners[identity]
        component_cache={}
        def resolve(target):
            if target.startswith('lib.'):
                from component_references import resolve as component_resolve
                component=component_resolve(self,path,target[4:],cache=component_cache)
                if component is not None:return component
            if not target.startswith('lib.'):
                if policy_error:return {'issueCode':'policy-unavailable','issue':policy_error}
                destination=owner(target.split('.',1)[0]) if '.' in target else path
                if destination:
                    if destination not in states:
                        try:policy=policies.resolve(destination)
                        except PolicyUnavailable as error:return {'issueCode':'policy-unavailable','issue':str(error),'path':destination}
                        for issue in policy['diagnostics']:diagnostics[issue['reason']]=issue
                        states[destination]=self.reference_disk_state(destination,policy)
                    if states[destination]:return states[destination]
            return index.resolve(path,target,owner,self.reference_entry)
        resolved={target:resolve(target) for target in dict.fromkeys(targets)}
        return {'revision':index.revision,'targets':resolved,'configurationDiagnostics':list(diagnostics.values()),'snapshotOnly':True}

    def document_claims(self,records,deleted=(),snapshot=False,unknown=()):
        from document_registry import DocumentRegistry
        valid=[];rejected=[];uncached=[];removed=[]
        for record in records:
            if not isinstance(record,dict):rejected.append({'path':None,'reason':'Invalid document metadata record'});continue
            try:self.path(record['path']);DocumentRegistry.record(record);valid.append(record)
            except (ValueError,KeyError,TypeError) as error:
                rejected.append({'path':record.get('path'),'reason':str(error)})
                try:self.path(record['path']);DocumentRegistry.record({'path':record['path']});uncached.append(record['path'])
                except (ValueError,KeyError,TypeError):pass
        for path in unknown:
            try:self.path(path);DocumentRegistry.record({'path':path});uncached.append(path)
            except (ValueError,TypeError) as error:rejected.append({'path':path,'reason':str(error)})
        for path in deleted:
            try:self.path(path);removed.append(path)
            except (ValueError,TypeError) as error:rejected.append({'path':path,'reason':str(error)})
        registry=self.document_registry()
        if not snapshot:
            listings={}
            # External renames can emit the new metadata before the old delete.
            # Check only owners of changed IDs against the actual filesystem,
            # so this event ordering cannot turn a move into a stale copy claim.
            for record in valid:
                owner=registry.db.execute('SELECT path FROM owners WHERE id=?',(record.get('documentId'),)).fetchone()
                if owner and owner['path']!=record['path'] and not self.exact_note_exists(owner['path'],listings):removed.append(owner['path'])
            removed=sorted(set(removed)-{record['path'] for record in valid})
        result=registry.snapshot(valid,unknown=sorted(set(uncached)-{r['path'] for r in valid})) if snapshot else registry.update(valid,removed)
        return {**result,'rejected':rejected}

    def exact_note_exists(self,relative,listings=None):
        """Preserve exact path spelling even on a case-insensitive Mac volume."""
        self.path(relative);listings={} if listings is None else listings;parent=self.vault
        for part in Path(relative).parts:
            key=str(parent)
            if key not in listings:
                try:listings[key]={p.name for p in parent.iterdir()}
                except FileNotFoundError:return False
            if part not in listings[key]:return False
            parent=parent/part
        return parent.is_file()

    def reference_context(self,path):
        self.store.load()
        documents=self.store.documents_by_path.get((self.vault_id,path),{})
        if len(documents)>1:raise Conflict('Document identity needs reconciliation.')
        registered=next(iter(documents),None)
        context=self.document_registry().inspect(path)
        return context,registered

    def reference_preview(self,path,expected_hash,config=None):
        from reference_document import catalog
        policy=self.numbering_policy(path,config)
        text=self.read(path)
        if hashlib.sha256(text.encode()).hexdigest()!=expected_hash:raise Conflict('Note changed before reference inspection.')
        context,registered=self.reference_context(path)
        result=catalog(text,path,registered,policy['config']);result['diagnostics'].extend(policy['diagnostics'])
        result['identityContext']=context
        if context['status'] not in ('new','owned','restore'):
            result['targets']={}
            result['diagnostics'].append({'reason':'Document identity: '+context['status']})
        return result

    def reference_plan(self,path,expected_hash,at,config=None):
        from component_scope import guard
        guard(self.vault,path)
        from reference_document import identity_plan,document_identity
        policy=self.numbering_policy(path,config)
        self.guard_numbering(path,policy)
        text=self.read(path);context,registered=self.reference_context(path)
        registry=self.document_registry();registry.guard_context(context)
        owner=context.get('ownerPath')
        if owner and owner!=path:
            if not self.path(owner).exists():raise Conflict('Reference owner moved; refresh document metadata.')
            actual=document_identity(self.read(owner))
            cached=registry.db.execute('SELECT id FROM claims WHERE path=?',(owner,)).fetchone()
            if not cached or actual!=cached['id']:raise Conflict('Reference owner changed; refresh document metadata.')
        result=identity_plan(text,path,expected_hash,at,registered,policy['config'],context)
        registry.guard_context(context)
        if self.read(path)!=text:raise Conflict('Note changed while preparing its reference.')
        return {**result,'path':path,'registeredDocumentId':registered,'policyDigest':policy['policyDigest'],'bookKey':policy['bookKey']}

    def verify_reference_plan(self,plan):
        """Last read-only check before the editor's synchronous guarded dispatch."""
        from reference_document import document_identity
        from reference_format import apply_plan
        path=plan['path'];context=plan['identityContext'];registry=self.document_registry()
        self.guard_numbering(path,plan)
        if context.get('path')!=path:raise Conflict('Reference plan belongs to another note.')
        registry.guard_context(context)
        _,registered=self.reference_context(path)
        if registered!=plan.get('registeredDocumentId'):raise Conflict('Library document identity changed; refresh the reference plan.')
        owner=context.get('ownerPath')
        if owner and owner!=path:
            if not self.path(owner).exists():raise Conflict('Reference owner moved; refresh document metadata.')
            row=registry.db.execute('SELECT id FROM claims WHERE path=?',(owner,)).fetchone()
            if not row or document_identity(self.read(owner))!=row['id']:raise Conflict('Reference owner changed; refresh document metadata.')
        text=self.read(path);proposed=apply_plan(text,plan)
        registry.guard_context(context)
        return {'path':path,'sourceHash':plan['sourceHash'],'afterHash':hashlib.sha256(proposed.encode()).hexdigest(),
                'dependencyToken':context['dependencyToken']}

    def editor_reference_context(self,path,text):
        from reference_document import document_identity
        self.path(path)
        _,registered=self.reference_context(path)
        context=self.document_registry().inspect(path,document_identity(text))
        return context,registered

    def editor_reference_preview(self,path,text,expected_hash,config=None):
        from reference_document import catalog
        policy=self.numbering_policy(path,config)
        if hashlib.sha256(text.encode()).hexdigest()!=expected_hash:raise Conflict('Editor snapshot changed.')
        context,registered=self.editor_reference_context(path,text)
        result=catalog(text,path,registered,policy['config']);result['diagnostics'].extend(policy['diagnostics'])
        result['identityContext']=context
        for original in result['occurrences']:
            original['body']=text[original['from']:original['to']]
            original['line_start']=text[:original['from']].count('\n')+1
        return result

    def callout_controls_context(self,path,text,expected_hash):
        from component_scope import guard
        guard(self.vault,path)
        from callout_controls import numbering_context
        self.path(path);policy=self.numbering_policy(path)
        _,registered=self.reference_context(path)
        return {**numbering_context(text,path,expected_hash,policy['config'],registered),
                'bookKey':policy['bookKey'],'policyDigest':policy['policyDigest'],'inherited':policy['config']}

    def callout_numbering_plan(self,path,text,expected_hash,settings):
        from component_scope import guard
        guard(self.vault,path)
        from callout_controls import numbering_plan
        self.path(path);policy=self.numbering_policy(path);self.guard_numbering(path,policy)
        _,registered=self.reference_context(path)
        return {**numbering_plan(text,path,expected_hash,settings,policy['config'],registered),
                'bookKey':policy['bookKey'],'policyDigest':policy['policyDigest']}

    def verify_callout_numbering_plan(self,plan,text):
        self.guard_numbering(plan['path'],plan)
        current=self.callout_numbering_plan(plan['path'],text,plan['sourceHash'],plan['settings'])
        if current!=plan:raise Conflict('Numbering settings changed; review the current preview again.')
        if not current['valid']:raise Conflict('Resolve the numbering errors before applying these settings.')
        return {'afterHash':current['afterHash']}

    def callout_contents(self,path,text,expected_hash,at):
        from callout_controls import contents_at
        self.path(path);policy=self.numbering_policy(path)
        _,registered=self.reference_context(path)
        return contents_at(text,path,expected_hash,at,policy['config'],registered)

    def editor_catalog_cache(self):
        if not hasattr(self,'_editor_catalogs'):
            from editor_catalog_cache import EditorCatalogCache
            self._editor_catalogs=EditorCatalogCache()
        return self._editor_catalogs

    def editor_reference_targets(self,path,text,targets,callout_lines=None,snapshot_token=None,include_callouts=False):
        """Read-only own-note overlay; source is uploaded once per shared snapshot."""
        from reference_document import catalog,document_identity
        from reference_format import TARGET
        from numbering_policy import PolicyUnavailable
        from editor_catalog_cache import SnapshotExpired
        self.path(path)
        if not isinstance(targets,list) or len(targets)>256 or any(not isinstance(t,str) or not re.fullmatch(TARGET,t) for t in targets):raise ValueError('Provide at most 256 valid reference targets')
        callout_lines=[] if callout_lines is None else callout_lines
        if not isinstance(callout_lines,list) or len(callout_lines)>256 or any(type(n) is not int or n<1 for n in callout_lines):raise ValueError('Provide at most 256 positive callout line numbers')
        if type(include_callouts) is not bool:raise ValueError('includeCallouts must be boolean')
        if snapshot_token is not None and text is not None:raise ValueError('Provide text or snapshotToken, not both')
        requested=list(dict.fromkeys(targets));source_hash=None
        def unavailable(code,message):
            return {'path':path,'sourceHash':source_hash,'provisional':True,'issueCode':code,'issue':message,
                    'targets':{t:{'issueCode':code,'issue':message,'path':path,'provisional':True} for t in requested}}
        try:policy=self.numbering_policy(path)
        except PolicyUnavailable as error:return unavailable('policy-unavailable',str(error))
        cache=self.editor_catalog_cache();context=None
        _,registered=self.reference_context(path)
        if snapshot_token is not None:
            try:row=cache.get(snapshot_token)
            except SnapshotExpired as error:return unavailable(error.code,str(error))
            metadata=row['metadata'];source_hash=metadata['sourceHash']
            if metadata['path']!=path:return unavailable('snapshot-mismatch','Editor snapshot belongs to a different note')
            if metadata['policyStamp']!=policy['policyStamp']:return unavailable('policy-changed','Numbering policy changed; refresh the editor snapshot')
            if metadata['registered']!=registered:return unavailable('identity-changed','Registered document identity changed; refresh the editor snapshot')
        else:
            if not isinstance(text,str):raise ValueError('Provide editor text or snapshotToken')
            encoded=text.encode()
            if len(encoded)>8*1024*1024:return unavailable('projection-limit','This note exceeds the 8 MiB UTF-8 editor snapshot limit.')
            source_hash=hashlib.sha256(encoded).hexdigest();key=(path,source_hash,registered,policy['policyStamp']);row=cache.by_key(key)
            if row is None:
                identity=None;identity_issue=None
                try:identity=document_identity(text);document_identity(text,registered)
                except ValueError as error:identity_issue=str(error)
                data=catalog(text,path,registered,policy['config'])
                metadata={'path':path,'sourceHash':source_hash,'registered':registered,'policyStamp':policy['policyStamp'],'identity':identity,'identityIssue':identity_issue}
                try:row=cache.put(key,data,metadata)
                except ValueError as error:return unavailable('projection-limit',str(error))
            metadata=row['metadata']
        identity=metadata['identity'];identity_issue=metadata['identityIssue'];registry=self.document_registry()
        if not identity_issue:
            context=registry.inspect(path,identity)
            if context['status'] not in ('new','owned','copy','template','template-copy','pending'):
                identity_issue='Document identity needs reconciliation: '+context['status']
        data=row['data'];diagnostics=[*data['diagnostics'],*policy['diagnostics']]
        if identity_issue:diagnostics.append({'code':'identity-unavailable','reason':identity_issue})
        index=self.reference_index();saved=index.db.execute('SELECT source_hash FROM documents WHERE path=?',(path,)).fetchone()
        provisional=bool(identity_issue or policy.get('policyStale')) or not(saved and saved['source_hash']==source_hash and self.reference_disk_state(path,policy) is None)
        issues={d.get('blockId'):d for d in diagnostics if d.get('blockId') and d['blockId'] not in data['targets']};resolved={}
        for target in requested:
            if target.startswith('lib.'):
                from component_references import display
                from figure_panels import split
                if split(target[4:])[1]:
                    from component_references import resolve as component_resolve
                    component=component_resolve(self,path,target[4:],text,data)
                else:component=display(data,target[4:],path)
                if component is not None:
                    resolved[target]={**component,'sourceHash':source_hash,'provisional':provisional};continue
            if '.' in target:
                document,block=target.split('.',1);own=document!='lib' and document==identity and registry.owner(document)==path
            else:block=target;own=True
            if '.' in target and not target.startswith('lib.') and identity_issue:result={'issueCode':'identity-unavailable','issue':identity_issue}
            elif not own:result={'issueCode':'not-own-target','issue':'Use the saved index for targets outside this note'}
            elif block in issues:result={'issueCode':issues[block]['code'],'issue':issues[block]['reason']}
            elif block not in data['targets']:result={'issueCode':'missing','issue':'Referenced block is missing from the editor'}
            else:result={**data['targets'][block],'link':'#^'+block}
            resolved[target]={**result,'path':path,'sourceHash':source_hash,'provisional':provisional}
        if context and not identity_issue:registry.guard_context(context)
        response={'path':path,'documentId':identity,'sourceHash':source_hash,'snapshotToken':row['token'],'provisional':provisional,
                  'policyStale':bool(policy.get('policyStale')),'policyStamp':policy['policyStamp'],'targets':resolved,'diagnostics':diagnostics,
                  'callouts':{str(line):row['lines'][line] for line in dict.fromkeys(callout_lines) if line in row['lines']}}
        if include_callouts:
            # Computed once per catalog. No body, source text, DOM or symbols.
            rows=[{'line':o['line'],'title':o['title'],'sourceStyle':o['sourceStyle'],'nested':o['nested'],'depth':o.get('depth',1),'collapsed':o.get('collapsed',False),
                       'display':o['display']} for o in data['occurrences']]
            if row['summaryBytes'] is None:
                size=len(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode())
                # Do not retain a second object graph; only memoize its size.
                row['summaryBytes']=size
            if row['summaryBytes']>2*1024*1024:response['outlineIssue']='This note exceeds the 2 MiB outline response limit; individual callout references still work.'
            else:response['calloutList']=rows
        return response

    def saved_callouts(self,path,lines=None,after=-1,limit=256):
        from numbering_policy import PolicyUnavailable
        self.path(path)
        try:policy=self.numbering_policy(path)
        except PolicyUnavailable as error:return {'path':path,'issueCode':'policy-unavailable','issue':str(error),'callouts':{} if lines is not None else []}
        state=self.reference_disk_state(path,policy)
        if state:return {'path':path,**state,'callouts':{} if lines is not None else [],'state':state}
        result=self.reference_index().callout_lines(path,lines) if lines is not None else self.reference_index().callout_page(path,after,limit)
        return {**result,'policyStamp':policy['policyStamp'],'policyStale':bool(policy.get('policyStale')),'diagnostics':policy['diagnostics']}

    def editor_reference_plan(self,path,text,expected_hash,at,selection,mode='auto',config=None):
        from component_scope import guard
        guard(self.vault,path)
        from component_references import local_insertion
        return local_insertion(self,path,text,expected_hash,at,selection,mode)

    def verify_editor_reference_plan(self,plan,text):
        if plan.get('componentReference'):
            from component_references import insertion
            current=insertion(self,plan['path'],text,plan['sourceHash'],plan['selection'],plan['entryId'],plan['mode'])
            if current!=plan:raise Conflict('The reference target changed; choose it again.')
            return {'afterHash':current['afterHash']}
        from component_references import local_insertion
        current=local_insertion(self,plan['path'],text,plan['sourceHash'],plan['at'],plan['selection'],plan['mode'],plan.get('reservation'))
        if current!=plan:raise Conflict('The reference target changed; choose it again.')
        return {'afterHash':current['afterHash']}

    def editor_library_reference_plan(self,path,text,expected_hash,selection,entry_id,mode='t'):
        from component_scope import guard
        guard(self.vault,path)
        from reference_insert import library_reference_plan
        registry=self.component_registry();registry.load()
        if entry_id in registry.entities:
            from component_references import insertion
            return insertion(self,path,text,expected_hash,selection,entry_id,mode)
        self.path(path);self.store.load();entry=self.store.entries.get(entry_id)
        if not entry or entry.get('admission')=='pending-variant' or entry.get('status')=='deleted':raise Conflict('Library entry is unavailable or retired.')
        return library_reference_plan(text,path,expected_hash,selection,entry,mode)

    def verify_editor_library_reference_plan(self,plan,text):
        current=self.editor_library_reference_plan(plan['path'],text,plan['sourceHash'],plan['selection'],plan['entryId'],plan['mode'])
        if current!=plan:raise Conflict('The library entry changed; insert the current version again.')
        return {'afterHash':current['afterHash']}

    def preview(self, path, expected_hash):
        text=self.read(path)
        if source_hash(text)!=expected_hash:raise Conflict('Note changed before review. Refresh the review.')
        self.store.load();entries=candidates(text,path)
        counts={}
        for e in entries:
            if e['occurrenceId']:counts[e['occurrenceId']]=counts.get(e['occurrenceId'],0)+1
        owners={e['home']['occurrenceId']:e for e in self.store.entries.values()}
        for e in entries:
            owner=owners.get(e['occurrenceId'])
            e['issue']='Repeated identity marker; resolve the copied marker first' if e['occurrenceId'] and counts[e['occurrenceId']]>1 else 'Copied identity belongs to another note' if owner and (not self.owns(owner) or owner['home']['path']!=path) else None
            e['admitted']=bool(owner and not e['issue'] and owner.get('admission')!='pending-variant') or any(self.owns(old) and old['home'].get('mode')=='snapshot' and old['home']['path']==path and old['home'].get('line')==e['line_start'] and old['body']==e['body'].replace('\r\n','\n').replace('\r','\n') for old in self.store.entries.values())
        return {'path':path,'sourceHash':expected_hash,'entries':[e for e in entries if e['kind']!='key-point'],**self.metadata()}

    def prepare_admission(self, *, path, expected_hash, selected, capability, actor):
        if not secrets.compare_digest(capability,self.review_capability):raise Conflict('Admission requires the live review action.')
        text=self.read(path)
        if source_hash(text)!=expected_hash:raise Conflict('The reviewed note changed. Review the current text.')
        self.recover();self.store.load();all_entries=candidates(text,path)
        reserved={c['entry']['home']['occurrenceId'] for p in self.plans.glob('*.json') for plan in [json.loads(p.read_text())] if plan['state']=='reviewed' for c in plan['changes']}
        occurrence_counts={}
        for e in all_entries:
            if e['occurrenceId']:occurrence_counts[e['occurrenceId']]=occurrence_counts.get(e['occurrenceId'],0)+1
        # Each selection includes reviewed range and exact body hash, never a guessed title.
        chosen=[]
        for selection in selected:
            matches=[e for e in all_entries if e['line_start']==selection['line_start'] and e['body_sha256']==selection['body_sha256']]
            if len(matches)!=1 or not matches[0]['complete']:raise Conflict('Selected entry changed or is incomplete.')
            if matches[0]['kind']=='key-point':raise Conflict('Classify this key point as a supported index type before adding it.')
            if matches[0] in chosen:raise Conflict('An entry was selected twice.')
            chosen.append(matches[0])
        if not chosen:raise ValueError('Select at least one entry.')
        owned={e['home']['occurrenceId']:e for e in self.store.entries.values()}
        documents={e['home']['documentId'] for e in self.store.entries.values() if self.owns(e) and e['home']['path']==path}
        if len(documents)>1:raise Conflict('Document identity needs reconciliation.')
        document_id=next(iter(documents),str(uuid.uuid4()))
        snapshot='markdown_originals' in Path(path).parts
        insertions=[];changes=[];edits=[]
        for e in chosen:
            occurrence=e['occurrenceId'] or str(uuid.uuid4())
            if occurrence in reserved:raise Conflict('A saved admission is still pending for this occurrence. Finish or cancel that review first.')
            if occurrence_counts.get(occurrence,0)>1:raise Conflict('Repeated occurrence marker. Resolve the copied marker before admission.')
            if occurrence in owned:
                if not self.owns(owned[occurrence]) or owned[occurrence]['home']['path']!=path:raise Conflict('This occurrence ID belongs to another note. Create a linked copy or local variant.')
                owner=owned[occurrence]
                if owner.get('admission')=='pending-variant':
                    updated={**owner,'admission':'reviewed','body':e['body'].replace('\r\n','\n').replace('\r','\n'),'title':e['title'] or owner['title'],'kind':e['kind'],'home':{**owner['home'],'line':e['line_start']}}
                    changes.append({'id':owner['id'],'expectedRevision':owner['revision'],'entry':updated})
                continue
            if snapshot and any(self.owns(old) and old['home']['path']==path and old['home'].get('line')==e['line_start'] and old['body']==e['body'].replace('\r\n','\n').replace('\r','\n') for old in owned.values()):continue
            component=e.get('component')
            if component:
                from component_identities import base,header
                registry=self.component_registry();registry.load();entity=registry.entities.get(base(component['id']))
                if not entity or entity['home']!=component['at']:raise Conflict('Add the original callout to the index; this occurrence is a copy.')
                # Exact component duplicates reuse the existing shared identity;
                # admission itself never creates a second library entry.
                duplicates=[x for x in registry.entities.values() if x['id']!=entity['id'] and x.get('admitted') and x['hash']==entity['hash']]
                if duplicates:raise Conflict('This exact result is already in the index. Insert its existing copy instead.')
                edits.append({'from':component['from'],'to':component['headerTo'],'insert':header(component,base(component['id'])+'.library',component['at'],component.get('origin'))})
            if not component and not snapshot and not e['occurrenceId']:
                at=e['insertionLine'];raw_lines=source_lines(text);newline='\r\n' if '\r\n' in text else '\r' if '\r' in text else '\n'
                prefix=newline if at and raw_lines[at-1].endswith(('\n','\r')) else newline*2
                insertions.append({'line':at,'text':prefix+'<!-- knowledge-library:'+occurrence+' -->'+newline})
            if not component and not snapshot and e.get('startId')!=occurrence:
                newline='\r\n' if '\r\n' in text else '\r' if '\r' in text else '\n'
                insertions.append({'line':e['line_start']-1,'text':'<!-- knowledge-library-start:'+occurrence+' -->'+newline})
            entry_id=base(component['id']) if component else str(uuid.uuid4())
            entry={'id':entry_id,'kind':e['kind'],'title':e['title'] or e['kind'].capitalize(),'body':e['body'].replace('\r\n','\n').replace('\r','\n'),
                   'context':{'before':e['context_before'],'after':e['context_after']},'status':'current',
                   'home':{'vault':self.vault.name,'vaultId':self.vault_id,'path':path,'documentId':document_id,'occurrenceId':occurrence,
                           'mode':'snapshot' if snapshot else 'owned','markerFormat':'component-v1' if component else 'paired-v1','line':e['line_start']}}
            changes.append({'id':entry_id,'expectedRevision':self.store.clocks.get(entry_id,0),'entry':entry})
        if not changes:return {'alreadyAdmitted':True}
        grouped={}
        for insertion in insertions:grouped[insertion['line']]=grouped.get(insertion['line'],'')+insertion['text']
        insertions=[{'line':line,'text':value} for line,value in grouped.items()]
        lines=source_lines(text);offsets=[0]
        for line in lines:offsets.append(offsets[-1]+len(line))
        all_edits=edits+[{'from':offsets[i['line']],'to':offsets[i['line']],'insert':i['text']} for i in insertions]
        proposed=text
        for edit in sorted(all_edits,key=lambda e:e['from'],reverse=True):proposed=proposed[:edit['from']]+edit['insert']+proposed[edit['to']:]
        updated_candidates={e['occurrenceId']:e for e in candidates(proposed,path) if e['occurrenceId']}
        for change in changes:
            home=change['entry']['home'];updated=updated_candidates.get(home['occurrenceId'])
            if updated:
                home['line']=updated['line_start'];change['entry']['body']=updated['body'].replace('\r\n','\n').replace('\r','\n')
                if updated.get('component'):change['entry'].update(library_component(updated['body']))
        from image_assets import snapshot
        for change in changes:change['entry']=snapshot(self,change['entry'])
        token=secrets.token_urlsafe(24)
        plan={'token':token,'path':path,'beforeHash':expected_hash,'afterHash':source_hash(proposed),'insertions':insertions,'edits':edits,
              'changes':changes,'actor':actor,'metadata':self.metadata(),'state':'reviewed'}
        atomic_json(self.plans/(token+'.json'),plan)
        import operations # durable intent, then label the bytes, before the editor saves them
        operations.prepare(self,'admission',token,operation='admit-'+token,path=path,before=text,after=proposed,
                           intended=[{'journal':'entries','key':'admit-'+token}],data={'admission':token},affected=[c['id'] for c in changes],
                           expected={'entry:'+c['id']:c['expectedRevision'] for c in changes},
                           assets=[i['sha256'] for c in changes for i in c['entry'].get('images',[]) if i.get('sha256')])
        operations.publish_provenance(self,{'operation':'admit-'+token,'path':path},proposed)
        self.store.try_backup()
        return {**plan,'proposedText':proposed}

    def finish_admission(self, token):
        if not re.fullmatch(r'[\w-]{20,80}',token):raise ValueError('Invalid review token.')
        plan_path=self.plans/(token+'.json')
        self.store.load()
        committed=self.store.receipts.get('admit-'+token)
        if committed:
            receipt=self.store.receipt(committed)
            if not self.reader:
                import operations
                operations.end(self.store,token,'completed','the admission event was already durable')
            if plan_path.exists():
                plan=json.loads(plan_path.read_text());plan['state']='committed';plan['receipt']=receipt;atomic_json(plan_path,plan);plan_path.replace(self.archive/plan_path.name)
            return receipt
        if not plan_path.exists() and (self.archive/plan_path.name).exists():raise Conflict('This admission was cancelled.')
        plan=json.loads(plan_path.read_text())
        if plan['state']!='reviewed':raise Conflict('This admission was cancelled.')
        text=self.read(plan['path'])
        if source_hash(text)!=plan['afterHash']:
            current=candidates(text,plan['path'])
            for change in plan['changes']:
                entry=change['entry'];home=entry['home']
                matches=[e for e in current if e['occurrenceId']==home['occurrenceId']]
                if home['mode']=='snapshot' or len(matches)!=1 or (home.get('markerFormat')=='paired-v1' and matches[0]['startId']!=home['occurrenceId']) or (library_component(matches[0]['body'])['body'] if matches[0].get('component') else matches[0]['body'].replace('\r\n','\n').replace('\r','\n'))!=entry['body']:
                    raise Conflict('A reviewed entry changed or its marker is unavailable. Review it again or discard the unfinished admission.')
                home['line']=matches[0]['line_start']
            if source_hash(self.read(plan['path']))!=source_hash(text):raise Conflict('Note changed during admission recovery. Retry after writing stops.')
        from image_assets import snapshot
        for change in plan['changes']:
            entry=change['entry'];checked=snapshot(self,entry)
            if checked.get('images')!=entry.get('images'):raise Conflict('An embedded image changed during admission. Review the current image again.')
        provenance={'vault':self.vault_id,'path':plan['path'],'inputHash':plan['beforeHash'],'resultHash':source_hash(text),'operation':'admit-'+token}
        import operations
        from library_store import digest
        with self.store.lock():
            if self.read(plan['path'])!=text:raise Conflict('Note changed during admission. Retry after writing stops.')
            operations.begin(self.store,token,{'kind':'admission','operation':'admit-'+token,'vaultId':self.vault_id,'path':plan['path'],'token':token,
                                               'resultHash':digest(text),'after':text,'intended':[{'journal':'entries','key':'admit-'+token}],
                                               'data':{'admission':token},'affected':[c['id'] for c in plan['changes']]})
            try:receipt=self.store.commit(**plan['metadata'],key='admit-'+token,actor=plan['actor'],changes=plan['changes'],operation='admit',provenance=provenance)
            except Conflict as error:
                operations.end(self.store,token,'cancelled','not written: '+str(error)+' (the reviewed plan stays pending)');raise
            operations.end(self.store,token,'completed')
        plan['state']='committed';plan['receipt']=receipt;atomic_json(plan_path,plan);plan_path.replace(self.archive/plan_path.name)
        return receipt

    def sync(self, path):
        exists=self.path(path).exists()
        text=self.read(path) if exists else '';entries=candidates(text,path)
        self.store.load()
        changes,statuses=self.sync_changes(path,text,exists,entries,gate=True)
        if self.path(path).exists()!=exists or (exists and source_hash(self.read(path))!=source_hash(text)):raise Conflict('Note changed during synchronization. Retry after writing stops.')
        receipt=None
        if changes:
            # Deterministic: the same observation on both Macs (same note bytes,
            # same entry parents, same result) is one revision, not two.
            from library_store import digest
            key='sync-'+digest({'vault':self.vault_id,'path':path,'input':source_hash(text),'changes':changes,
                                 'parents':{c['id']:list(self.store.journal.heads.get('entry:'+c['id'],[])) for c in changes}})
            if not self.reader:
                import operations # the other Mac waits for this operation before it observes these bytes
                operations.publish_provenance(self,{'operation':key,'path':path},text)
            receipt=self.store.commit(**self.metadata(),key=key,actor='editor-autosave',changes=changes)
        return {'statuses':statuses,'receipt':receipt,'sourceHash':source_hash(text),'repair':self.repair_markers(path,text,entries) if exists else None}

    def entry_history_bodies(self,entry_id):
        """Bodies of this entry's earlier revisions (not its current heads)."""
        journal=self.store.journal;heads=list(journal.heads.get('entry:'+entry_id,[]));seen=set(heads);pending=[p for h in heads for p in journal.revisions[h]['parents']];bodies=set()
        while pending:
            h=pending.pop()
            if h in seen or h not in journal.revisions:continue
            seen.add(h);value=journal.revisions[h]['value'] or {}
            if value.get('body'):bodies.add(value['body'])
            pending.extend(journal.revisions[h]['parents'])
        return bodies

    def sync_changes(self,path,text,exists=True,entries=None,overlay=None,gate=False,integrated=()):
        """Entry updates implied by the saved note (status, body, title, kind, line).

        overlay maps entry ids to versions planned earlier in the same operation
        (an index entry edit computes its home move and its body update as one
        entries event of one group).
        """
        entries=candidates(text,path) if entries is None else entries;markers={}
        for e in entries:
            if e['occurrenceId']:markers.setdefault(e['occurrenceId'],[]).append(e)
        changes=[];statuses=[]
        view={**self.store.entries,**(overlay or {})}
        awaiting=set();merged=set(integrated);owed=[]
        if gate and exists:
            # Spec 8, entries side: a component row that is older than the index
            # (store first) or exactly as integrated from the other Mac (note
            # first) waits; its entry is neither reverted nor re-recorded here.
            registry=self.component_registry();details={}
            _,_,waiting=registry.source_state(self.vault_id,path,text,details)
            awaiting={w['at'] for w in waiting};merged.update(details.get('integrated',()));owed=details.get('owed',[])
        for owned in view.values():
            if owned['home'].get('occurrenceId') in awaiting and owned['home'].get('markerFormat')=='component-v1':
                statuses.append({'id':owned['id'],'status':'awaiting-source'});continue
            home=owned['home']
            if not self.owns(owned) or home['path']!=path or (home.get('mode')=='snapshot' and not home.get('formerMode')):continue
            matches=markers.get(home['occurrenceId'],[])
            if home.get('formerMode') and (len(matches)!=1 or matches[0]['startId']!=home['occurrenceId']):continue
            if len(matches)!=1:
                status='missing' if not matches else 'ambiguous';e=None
                if not matches and exists and home.get('markerFormat')=='paired-v1' and home['occurrenceId'] not in text and not any(source_hash(candidate['body'])==source_hash(owned['body']) for candidate in entries):status='deleted'
            elif home.get('markerFormat')=='paired-v1' and matches[0]['startId']!=home['occurrenceId']:status='detached';e=None
            elif not matches[0]['complete']:status='incomplete';e=None
            else:status='current';e=matches[0]
            if e and home.get('markerFormat')=='component-v1':
                registry=self.component_registry();registry.load()
                entity=registry.entities.get(owned['id']);occurrence=registry.occurrences.get(home['occurrenceId'])
                if entity and occurrence and e.get('component') and e['component']['hash']==occurrence['hash']!=entity['hash']:
                    # A stale copy promoted after deleting the home remains stale
                    # until explicitly synced or edited; do not roll the library back.
                    status='source-changed';e=None
            if gate and e and home.get('markerFormat')=='paired-v1':
                body=e['body'].replace('\r\n','\n').replace('\r','\n')
                if body!=owned['body'] and (owed or body in self.entry_history_bodies(owned['id'])):
                    # The same gate for entries without a component identity: an older
                    # body (the newer note has not arrived) or bytes whose events are owed.
                    statuses.append({'id':owned['id'],'status':'awaiting-source'});continue
            statuses.append({'id':owned['id'],'status':status})
            updated={**owned,'status':status}
            if e:
                restored_home={**home,'line':e['line_start']}
                if restored_home.get('formerMode'):restored_home['mode']=restored_home.pop('formerMode')
                updated.update(body=e['body'].replace('\r\n','\n').replace('\r','\n'),title=e['title'] or owned['title'],kind=e['kind'],home=restored_home)
                if e.get('component'):updated.update(library_component(e['body']))
            if e:
                from image_assets import snapshot
                updated=snapshot(self,updated,previous=owned,retain_missing=True)
            if e and owned.get('admission') in ('copy','pending-variant'):
                updated['admission']='copy' if source_hash(updated['body'])==owned.get('copyBodyHash') else 'pending-variant'
            heads=list(self.store.journal.heads.get('entry:'+owned['id'],[]))
            merge_entry=home.get('occurrenceId') in merged and len(heads)>1
            if updated!=owned or owned['id'] in (overlay or {}) or merge_entry:
                change={'id':owned['id'],'expectedRevision':owned['revision'],'entry':updated}
                if merge_entry:change['mergeHeads']=heads # the integrated text merges both Macs' versions
                changes.append(change)
        return changes,statuses

    def repair_markers(self,path,text,entries):
        """Recover only an exact, unique saved passage; never infer from proximity."""
        insertions=[];newline='\r\n' if '\r\n' in text else '\r' if '\r' in text else '\n'
        for owned in self.store.entries.values():
            home=owned['home'];occurrence=home['occurrenceId']
            if not self.owns(owned) or home['path']!=path or home.get('mode')=='snapshot' or home.get('markerFormat')!='paired-v1':continue
            matches=[e for e in entries if source_hash(e['body'])==source_hash(owned['body'])]
            if len(matches)!=1:continue
            e=matches[0]
            if e['occurrenceId'] not in (None,occurrence) or e['startId'] not in (None,occurrence):continue
            start='<!-- knowledge-library-start:'+occurrence+' -->';end='<!-- knowledge-library:'+occurrence+' -->'
            if e['startId'] is None and start not in text:insertions.append({'line':e['line_start']-1,'text':start+newline})
            if e['occurrenceId'] is None and end not in text:insertions.append({'line':e['insertionLine'],'text':newline+end+newline})
        if not insertions:return None
        lines=source_lines(text)
        for insertion in sorted(insertions,key=lambda x:x['line'],reverse=True):
            if insertion['line']==len(lines) and lines and not lines[-1].endswith(('\n','\r')):insertion['text']=newline+insertion['text']
            lines.insert(insertion['line'],insertion['text'])
        return {'beforeHash':source_hash(text),'afterHash':source_hash(''.join(lines)),'insertions':insertions,'proposedText':''.join(lines)}

    def stop_tracking(self,path,ids,capability,archive=False):
        if not secrets.compare_digest(capability,self.review_capability):raise Conflict('Removing library links requires the editor action.')
        self.store.load();changes=[]
        for e in self.store.entries.values():
            if e['home']['occurrenceId'] not in ids:continue
            if not self.owns(e) or e['home']['path']!=path:raise Conflict('Source ownership changed.')
            changes.append({'id':e['id'],'expectedRevision':e['revision'],'entry':{**e,'home':{**e['home'],'mode':'snapshot','formerMode':'owned'},'status':'deleted' if archive else 'current'}})
        return self.store.commit(**self.metadata(),key='unlink-'+str(uuid.uuid4()),actor='human-unlink',changes=changes) if changes else {}

    def relocate(self,path):
        """Follow an exact marked move only when the old home is gone and ID is unique."""
        self.store.load();text=self.read(path);parsed=candidates(text,path);changes=[]
        documents={e['home']['documentId'] for e in self.store.entries.values() if self.owns(e) and e['home']['path']==path}
        document_id=next(iter(documents),str(uuid.uuid4()))
        for candidate in parsed:
            occurrence=candidate['occurrenceId'];entry_id=self.store.owners.get(occurrence)
            if not entry_id:continue
            entry=self.store.entries[entry_id];home=entry['home']
            if not self.owns(entry) or home['path']==path or home.get('mode')=='snapshot' or not candidate['complete']:continue
            if home.get('markerFormat')=='paired-v1' and candidate['startId']!=occurrence:continue
            old=self.path(home['path'])
            if old.exists() and any(e['occurrenceId']==occurrence for e in candidates(self.read(home['path']),home['path'])):continue
            matches=[]
            for note in self.vault.rglob('*.md'):
                if any(p.startswith('.') for p in note.relative_to(self.vault).parts):continue
                content=note.read_bytes().decode('utf-8')
                if occurrence in content:
                    matches.extend(str(note.relative_to(self.vault)) for e in candidates(content,str(note.relative_to(self.vault))) if e['occurrenceId']==occurrence)
            if matches!=[path]:continue
            changes.append({'id':entry_id,'expectedRevision':entry['revision'],'entry':{**entry,'status':'current','home':{**home,'path':path,'line':candidate['line_start'],'documentId':document_id}}})
        if source_hash(self.read(path))!=source_hash(text):raise Conflict('Note changed during synchronization. Retry after writing stops.')
        for change in changes:
            old_path=self.store.entries[change['id']]['home']['path']
            occurrence=change['entry']['home']['occurrenceId']
            if self.path(old_path).exists() and any(e['occurrenceId']==occurrence for e in candidates(self.read(old_path),old_path)):
                raise Conflict('The original occurrence reappeared during synchronization. Retry after writing stops.')
        receipt=self.store.commit(**self.metadata(),key='relocate-'+str(uuid.uuid4()),actor='tracked-move',changes=changes,operation='replace-source') if changes else None
        return {'receipt':receipt}

    def rename(self, old_path, new_path):
        if self.path(old_path).exists():raise Conflict('The previous home still exists; ownership cannot be inferred.')
        result=self.record_moves({old_path:(new_path,self.read(new_path))})
        self.rehome_pending(old_path,new_path)
        return result

    def settle(self,path):
        """Finish (or close) this host's interrupted operations of this note now.

        Returns '' when none is left, otherwise why one could not be resolved.
        """
        import operations
        pending=[]
        for item in operations.unresolved(self.store.root):
            try:value=json.loads(item.read_text())
            except (OSError,ValueError):continue
            if value.get('vaultId')==self.vault_id and value.get('path')==path:pending.append(item.stem)
        if not pending:return ''
        problems=[]
        with self.store.lock():
            for token in pending:
                target=operations.folder(self.store)/(token+'.json')
                if not target.exists():continue
                try:operations.resolve(self,token,json.loads(target.read_text()))
                except Exception as error:problems.append(str(error))
        self.store.load()
        return '; '.join(problems)

    def discover_moves(self,path,text):
        """A note this vault moved while no backend recorded the rename (Low 1).

        Known live occurrences of this vault that appear here although their
        recorded note no longer exists were moved, not copied: record the
        rename (one intent, one group) instead of minting copy identities.
        Rows installed from the other Mac wait for its rename events instead.
        """
        from markdown_scan import components
        registry=self.component_registry();registry.load();arrived=registry.arrived(path);olds=set()
        owed=registry.owed(path)
        for row in components(text):
            at=row.get('at');occurrence=registry.occurrences.get(at) if at else None
            if not occurrence or not occurrence.get('alive') or occurrence.get('vault')!=self.vault_id or occurrence.get('path')==path:continue
            if arrived.get(at) is not None and owed:continue # the other Mac's rename events explain it
            try:missing=not self.path(occurrence['path']).exists()
            except ValueError:continue
            if missing:olds.add(occurrence['path'])
        for old in sorted(olds):
            try:self.rename(old,path)
            except Conflict:pass # a partial move (cut and paste): the normal copy rules apply

    def rename_entry_changes(self,moves,tree=None):
        self.store.load();changes=[]
        for e in self.store.entries.values():
            home=e['home']
            if not self.owns(e):continue
            if tree:
                old_dir,new_dir=tree
                if not home['path'].startswith(old_dir+'/'):continue
                target=new_dir+home['path'][len(old_dir):]
                present=[c['occurrenceId'] for c in candidates(moves[home['path']][1],target)] if home['path'] in moves else [c['occurrenceId'] for c in candidates(self.read(target),target)]
                if home.get('mode')!='snapshot' and present.count(home['occurrenceId'])!=1:raise Conflict('Moved folder has a missing or ambiguous owning occurrence.')
            else:
                if home['path'] not in moves:continue
                target,text=moves[home['path']]
                if home.get('mode')!='snapshot' and home['occurrenceId'] not in {c['occurrenceId'] for c in candidates(text,target)}:raise Conflict('The moved note does not contain the owning occurrence.')
            changes.append({'id':e['id'],'expectedRevision':e['revision'],'entry':{**e,'home':{**home,'path':target}}})
        return changes

    def record_moves(self,moves,tree=None):
        """A rename or folder move as one operation: one durable intent and one event group.

        The note move itself was done by the vault (the source is already saved);
        the intent records every destination's exact bytes, so recovery finishes
        only when those are still in place, and otherwise voids the group.
        """
        import operations
        from library_store import digest
        operation='rename-'+digest({'vault':self.vault_id,'moves':{k:[v[0],digest(v[1])] for k,v in sorted(moves.items())},'tree':tree})
        token='r'+digest({'operation':operation})[:40]
        changes=self.rename_entry_changes(moves,tree)
        registry=self.component_registry();components=registry.rename_changes(self.vault_id,moves)
        # Always one group whose operation id is the rename's (deterministic): the
        # other Mac's integration of the moved note names it (KL-Operation) and
        # waits for exactly it; both Macs recording the same rename converge.
        grouped=True
        intended=([{'journal':'entries','key':operation+'-entries'}] if changes else [])+([{'journal':'components','key':operation+'-components'}] if components else [])
        for n,item in enumerate(intended,1):item['part']=n
        if not intended:return {'changed':0}
        first=next(iter(moves.values()))
        for old,(new,text) in moves.items():operations.publish_provenance(self,{'operation':operation,'path':new},text)
        with self.store.lock():
            operations.begin(self.store,token,{'kind':'rename','operation':operation,'vaultId':self.vault_id,'path':first[0],'token':token,
                                               'resultHash':digest(first[1]),'after':first[1],'intended':intended,
                                               'data':{'moves':{k:[v[0],digest(v[1])] for k,v in moves.items()},'tree':list(tree) if tree else None},
                                               'affected':[c['id'] for c in changes]})
            intent=json.loads((operations.folder(self.store)/(token+'.json')).read_text())
            try:result=self.write_moves(operation,moves,tree,changes,components,grouped,intent)
            except Conflict as error:
                try:operations.close_group(self.store,intent);operations.end(self.store,token,'needs-review','interrupted: '+str(error))
                except Exception:pass
                raise
            except Exception as error:
                operations.interrupted(self,token,intent,error) # the moved notes hold their bytes: recovery finishes it
                raise
            operations.end(self.store,token,'completed')
        return result

    def write_moves(self,operation,moves,tree,changes,components,grouped,intent):
        import operations
        result={'changed':0};dependency=[];instance=intent.get('instance');parts=int(bool(changes))+int(bool(components))
        if changes:
            result=self.store.commit(**self.metadata(),key=operation+'-entries',actor='vault-rename',changes=changes,operation='replace-source',
                                     group={'operation':operation,'parts':parts,'part':1,'instance':instance} if grouped else None)
            if grouped and parts>1 and not result.get('pending'):grouped=False # replayed: the other Mac's instance already applied it
            dependency=[e for e in [self.store.journals.journals['entries'].keys.get(operation+'-entries',{}).get('events',[None])[0]] if e] or \
                       [e['hash'] for e in self.store.journals.parked_events(key=operation+'-entries',instance=instance or '')]
        if components:
            self.component_registry().commit(operation+'-components',self.component_registry().sequence,components,[],
                                             group={'operation':operation,'parts':parts,'part':parts,'instance':instance} if grouped else None,dependencies=dependency)
        operations.close_group(self.store,intent) # a leftover parked part of this host's instance
        return result

    def finish_rename(self,intent):
        """Recovery: the moved notes still hold exactly the recorded bytes; write the missing parts."""
        from library_store import digest
        data=intent['data'];moves={}
        for old,(new,hashed) in data['moves'].items():
            if self.path(old).exists():raise Conflict('The previous home exists again; the rename is no longer verified.')
            text=self.read(new)
            if digest(text)!=hashed:raise Conflict('A moved note changed after the rename; the rename is no longer verified.')
            moves[old]=(new,text)
        tree=tuple(data['tree']) if data.get('tree') else None
        changes=self.rename_entry_changes(moves,tree);components=self.component_registry().rename_changes(self.vault_id,moves)
        keys={k['key'] for k in intent['intended']}
        if (intent['operation']+'-entries' in keys)!=bool(changes) or (intent['operation']+'-components' in keys)!=bool(components):
            raise Conflict('The index changed since this rename; it is no longer verified.')
        self.write_moves(intent['operation'],moves,tree,changes,components,True,intent)

    def recover(self):
        recovered=[];pending=[]
        for path in self.plans.glob('*.json'):
            plan=json.loads(path.read_text())
            if plan['state']!='reviewed':continue
            try:
                recovered.append(self.finish_admission(plan['token']))
            except (Conflict,FileNotFoundError) as exc:pending.append({'token':plan['token'],'path':plan['path'],'occurrenceIds':[c['entry']['home']['occurrenceId'] for c in plan['changes']],'reason':str(exc)})
        return {'recovered':recovered,'pending':pending}

    def move_tree(self, old_path, new_path):
        old=(self.vault/old_path).resolve();new=(self.vault/new_path).resolve()
        if not old.is_relative_to(self.vault) or not new.is_relative_to(self.vault) or old==self.vault or new==self.vault:raise ValueError('Invalid source folder move.')
        if old.exists() or not new.is_dir():raise Conflict('Folder move is not complete.')
        self.store.load();registry=self.component_registry();registry.load()
        paths={o['path'] for o in registry.occurrences.values() if o.get('alive') and o['vault']==self.vault_id and o['path'].startswith(old_path+'/')}
        paths|={e['home']['path'] for e in self.store.entries.values() if self.owns(e) and e['home']['path'].startswith(old_path+'/')}
        moves={p:(new_path+p[len(old_path):],self.read(new_path+p[len(old_path):])) for p in sorted(paths)}
        result=self.record_moves(moves,(old_path,new_path)) if moves else {'changed':0}
        self.rehome_pending(old_path,new_path,tree=True)
        return result

    def cancel_admission(self, token, capability):
        if not secrets.compare_digest(capability,self.review_capability):raise Conflict('Canceling a review requires the live review action.')
        if not re.fullmatch(r'[\w-]{20,80}',token):raise ValueError('Invalid review token.')
        plan_path=self.plans/(token+'.json');self.store.load()
        if not plan_path.exists() and (self.archive/plan_path.name).exists():
            archived=json.loads((self.archive/plan_path.name).read_text())
            if archived.get('state')=='cancelled':return {'cancelled':token,'path':archived['path']}
            raise Conflict('This admission is already committed.')
        plan=json.loads(plan_path.read_text())
        if plan['state']=='committed' or 'admit-'+token in self.store.receipts:raise Conflict('This admission is already committed.')
        plan['state']='cancelled';atomic_json(plan_path,plan);plan_path.replace(self.archive/plan_path.name)
        if not self.reader:
            import operations
            operations.end(self.store,token,'cancelled','admission discarded by the person')
        return {'cancelled':token,'path':plan['path']}

    def rehome_pending(self, old_path, new_path, tree=False):
        for path in self.plans.glob('*.json'):
            plan=json.loads(path.read_text())
            if plan['state']!='reviewed':continue
            previous=plan['path']
            if previous!=old_path and not (tree and previous.startswith(old_path+'/')):continue
            target=new_path+previous[len(old_path):]
            self.path(target)  # Validate the target before updating the pending identity.
            plan['path']=target
            for change in plan['changes']:change['entry']['home']['path']=target
            atomic_json(path,plan)
