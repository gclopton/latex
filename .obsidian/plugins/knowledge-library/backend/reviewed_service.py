"""Local JSON-lines adapter for the explicitly reviewed TEST collection."""
import argparse
import json
import os
import sys
import sqlite3
from pathlib import Path
from live_library import LiveLibrary
from library_store import Conflict
from query_service import Library
import reuse
import portability
import component_membership
import component_entry_edit

# Operations a reader host may run. They read the store, the registry or a
# saved note and never write the shared store, identities, markers or notes.
READER_OPS=frozenset(('live-status','live-preview','live-index-conflicts','live-locate','live-history','live-component-detail',
    'live-component-state','live-component-tags','live-component-ancestor-changes','live-component-remove-preview'))

class ReviewedService:
    def __init__(self, root, vault, capability, production=False,enrollment=False,role=None):
        if not capability:raise ValueError('An editor review capability is required.')
        self.live=LiveLibrary(root,vault,allow_readonly=True,production=production,enrollment=enrollment and role!='reader',role=role);self.live.review_capability=capability
        self.query=None;self.sequence=-1;self.closed_worker=None;self.closed_stamp=None

    def handle(self, request):
        op=request.get('op','search');live=self.live;store=live.store
        if op.startswith('live-'):
            if live.reader and op not in READER_OPS:
                from host_role import ReaderHost
                raise ReaderHost('"'+op+'"')
            if op!='live-status':store.guard(request.get('profile'),request.get('epoch'))
            if op=='live-status':
                store.load()
                review=store.root/'local'/'intents'/'review'
                data={'role':live.role,'index':{'conflicts':store.conflicts(),'incomplete':store.incomplete,'fault':store.fault,
                                                'needsReview':len(list(review.glob('*.json'))) if review.is_dir() else 0},'sequence':store.sequence,'count':len(store.entries),'paths':sorted(store.paths_by_vault.get(live.vault_id,{})),**store.changes_since(request.get('since'))}
            elif op=='live-index-conflicts':
                store.load();registry=live.component_registry();registry.load();conflicts=store.conflicts()
                data={**conflicts,'entries':{obj[6:]:[{'revisionId':h,**{k:store.journal.revisions[h]['value'].get(k) for k in ('title','body','revision','deleted')},'writer':store.journal.revisions[h]['writer']}
                                                    for h in store.journal.heads[obj]] for obj in conflicts['objects'] if obj.startswith('entry:')},
                      'incomplete':store.incomplete}
            elif op=='live-resolve-entry':
                heads=store.journal.heads.get('entry:'+request['id'],[])
                if request['revisionId'] not in heads:raise Conflict('Choose one of the current competing versions.')
                chosen=store.journal.revisions[request['revisionId']]['value']
                data=store.resolve(**live.metadata(),key=request['key'],actor='human-resolution',entry_id=request['id'],entry=None if chosen.get('deleted') else chosen,expected_heads=request['expectedHeads'])
            elif op=='live-resolve-component':data=live.component_registry().resolve(request['object'],request['revisionId'],request['key'],request['expectedHeads'])
            elif op=='live-image-change':
                from image_assets import changed
                data=changed(live,request.get('path'))
            elif op=='live-component-session':component_entry_edit.session(live);data={'ok':True}
            elif op=='live-component-edit-fail':data=component_entry_edit.fail(live,request['key'],request['message'])
            elif op=='live-component-edit-context':
                data=component_entry_edit.context(live,request['id']);data={k:v for k,v in data.items() if k not in ('text','row')}
            elif op=='live-component-edit-enqueue':data=component_entry_edit.enqueue(live,request['id'],request['revision'],request['sourceHash'],request['title'],request['body'],request['key'])
            elif op=='live-component-edit-pending':
                from agent_api import pending
                data=component_entry_edit.pending(live)+pending(live)
            elif op in ('live-agent-prepare','live-agent-finish','live-agent-fail'):
                from agent_api import AgentAPI
                api=AgentAPI(self)
                data=api.prepare_online(request['key'],request['text']) if op=='live-agent-prepare' else api.finish_online(request['key'],request['text']) if op=='live-agent-finish' else api.fail_online(request['key'],request['message'])
            elif op=='live-component-edit-prepare':data=component_entry_edit.prepare(live,request['key'],request['text'])
            elif op=='live-component-edit-finish':data=component_entry_edit.finish(live,request['key'],request['token'],request['text'])
            elif op=='live-component-edit-status':data=component_entry_edit.status(live,request['key'])
            elif op=='live-component-plan':data=live.component_plan(request['path'],request['text'],request.get('operation','edit'),request.get('syncAt'),request.get('ancestor'))
            elif op=='live-component-finish':data=live.component_finish(request['token'],request['text'])
            elif op=='live-component-state':data=live.component_registry().state(live.vault_id,request['path'])
            elif op=='live-component-tags':data=live.component_registry().tags(request.get('id'),request.get('query',''))
            elif op=='live-component-set-tags':data=live.component_registry().set_tags(request['id'],request['tags'],request['key'])
            elif op=='live-component-copy-body':
                from component_references import copy_body
                data=copy_body(live,request['id'],request['revision'])
            elif op=='live-component-detail':data=live.component_detail(request['id'])
            elif op=='live-component-remove-preview':data=component_membership.preview(live,request['id'])
            elif op=='live-component-remove':data=component_membership.remove(live,request['id'],request['revision'],request['key'])
            elif op=='live-component-membership-undo':data=component_membership.undo(live,request['target'],request['key'])
            elif op=='live-component-membership-replay':data=component_membership.replay(live,request.get('cursor'),request.get('limit',100),request.get('audit',False))
            elif op=='live-component-closed-resolved':
                from closed_vault_updates import deferred
                data=deferred(live,request.get('paths'))
            elif op=='live-component-closed-notices':
                from closed_vault_updates import notices
                data=notices(live,request.get('ack'))
            elif op=='live-component-propagation-plan':
                data=component_membership.propagation_plan(live,request['path'],request['text'],request['ids'])
            elif op=='live-component-propagation-undo':data=component_membership.propagation_undo(live,request['token'],request['text'])
            elif op=='live-component-propagation-resume':data=component_membership.propagation_resume(live,request['token'],request['text'],request.get('ids',()))
            elif op=='live-component-ancestor-changes':
                registry=live.component_registry();registry.load();data=registry.ancestor_changes(registry.entities[request['id']])
            elif op=='live-reference-index-note':data=live.index_reference_note(request['path'],request['sourceHash'],request.get('numbering'))
            elif op=='live-reference-refresh-note':data=live.refresh_reference_note(request['path'],request.get('numbering'))
            elif op=='live-reference-check-notes':data=live.check_reference_notes(request['paths'],request.get('includePolicy',False))
            elif op=='live-reference-policy-reconcile':data=live.reference_policy_reconcile(request.get('after',''),request.get('limit',500),request.get('revision'))
            elif op=='live-reference-index-remove':data=live.remove_reference_note(request['path'])
            elif op=='live-reference-label-plan':
                import reference_labels
                data=reference_labels.plan(live,request['path'],request['text'])
            elif op=='live-reference-label-finish':
                import reference_labels
                data=reference_labels.finish(live,request['plan'],request['text'])
            elif op=='live-reference-pending':data=live.reference_index().pending(request.get('limit',100),request.get('labelsFirst',False))
            elif op=='live-reference-outdated':data=live.reference_index().outdated(request.get('limit',100))
            elif op=='live-reference-state':data=live.reference_display_state()
            elif op=='live-reference-callouts':data=live.saved_callouts(request['path'],request.get('lines'),request.get('after',-1),request.get('limit',256))
            elif op=='live-reference-targets':data=live.resolve_reference_targets(request['path'],request['targets'])
            elif op=='live-reference-preview':data=live.reference_preview(request['path'],request['sourceHash'],request.get('numbering'))
            elif op=='live-reference-plan':raise ValueError('Detached anchor creation is retired; use component reference insertion.')
            elif op=='live-reference-verify':data=live.verify_reference_plan(request['plan'])
            elif op=='live-reference-write-begin':
                from component_reference_writes import begin
                data=begin(live,request['path'],request['before'],request['after'],request['rows'],request['key'])
            elif op=='live-reference-write-pending':
                from component_reference_writes import pending
                data=pending(live)
            elif op=='live-reference-write-record':
                from component_reference_writes import record
                data=record(live,request['key'],request['state'])
            elif op=='live-math-reference-choice':
                from math_reference_service import prepare_choice
                data=prepare_choice(live,request['path'],request['text'],request['sourceHash'],request['sessionId'],request['choice'],request['expression'],request.get('reservations',[]))
            elif op=='live-math-reference-wrap':
                from math_reference_service import wrap_expression
                data=wrap_expression(request['mode'],request['target'],request['body'])
            elif op=='live-math-reference-save':
                from math_reference_service import save_plan
                data=save_plan(live,request['path'],request['text'],request['sourceHash'],request['sessionId'],request['from'],request['to'],request['original'],request['replacement'],request.get('reservations',[]))
            elif op=='live-math-reference-verify':
                from math_reference_service import verify_plan
                data=verify_plan(live,request['plan'],request['text'])
            elif op=='live-editor-reference-preview':data=live.editor_reference_preview(request['path'],request['text'],request['sourceHash'],request.get('numbering'))
            elif op=='live-callout-controls-context':data=live.callout_controls_context(request['path'],request['text'],request['sourceHash'])
            elif op=='live-callout-numbering-plan':data=live.callout_numbering_plan(request['path'],request['text'],request['sourceHash'],request['settings'])
            elif op=='live-callout-numbering-verify':data=live.verify_callout_numbering_plan(request['plan'],request['text'])
            elif op=='live-callout-contents':data=live.callout_contents(request['path'],request['text'],request['sourceHash'],request['at'])
            elif op=='live-editor-reference-targets':data=live.editor_reference_targets(request['path'],request.get('text'),request['targets'],request.get('calloutLines'),request.get('snapshotToken'),request.get('includeCallouts',False))
            elif op=='live-editor-reference-plan':data=live.editor_reference_plan(request['path'],request['text'],request['sourceHash'],request['at'],request['selection'],request.get('mode','auto'),request.get('numbering'))
            elif op=='live-editor-reference-verify':data=live.verify_editor_reference_plan(request['plan'],request['text'])
            elif op=='live-editor-library-reference-plan':data=live.editor_library_reference_plan(request['path'],request['text'],request['sourceHash'],request['selection'],request['entryId'],request.get('mode','t'))
            elif op=='live-editor-library-reference-verify':data=live.verify_editor_library_reference_plan(request['plan'],request['text'])
            elif op=='live-document-snapshot':data=live.document_claims(request['records'],snapshot=True,unknown=request.get('unknown',[]))
            elif op=='live-document-update':data=live.document_claims(request.get('records',[]),request.get('deleted',[]))
            elif op=='live-document-rename':data=live.document_registry().rename(request['oldPath'],request['path'])
            elif op=='live-preview':data=live.preview(request['path'],request['sourceHash'])
            elif op=='live-prepare':
                preview=live.preview(request['path'],request['sourceHash'])
                selected={(e['line_start'],e['body_sha256']) for e in request['selected']}
                if any((e['line_start'],e['body_sha256']) in selected and not e.get('component') for e in preview['entries']):
                    raise Conflict('Open or convert these legacy callouts to components before admission. Detached markers are retired.')
                data=live.prepare_admission(path=request['path'],expected_hash=request['sourceHash'],selected=request['selected'],capability=request.get('capability',''),actor='human-note-review')
            elif op=='live-finish':data=live.finish_admission(request['token'])
            elif op=='live-sync':
                data=live.sync(request['path']);data['repair']=None
                # Old paired-marker recovery is migration-only. Runtime identity
                # recovery belongs to the component registry, never detached lines.
            elif op=='live-relocate':data=live.relocate(request['path'])
            elif op=='live-stop-tracking':data=live.stop_tracking(request['path'],request['ids'],request.get('capability',''),request.get('archive',False))
            elif op=='live-rename':data=live.rename(request['oldPath'],request['path'])
            elif op=='live-move-tree':data=live.move_tree(request['oldPath'],request['path'])
            elif op=='live-cancel':data=live.cancel_admission(request['token'],request.get('capability',''))
            elif op=='live-recover':data=live.recover()
            elif op=='live-locate':data=reuse.locate(live,request['id'])
            elif op=='live-history':data=reuse.history(live,request['id'])
            elif op=='live-portable':data=portability.portable(live,request['id'],preview=request.get('preview',False))
            elif op=='live-reuse':raise ValueError('Legacy reuse is disabled; use component copy insertion.')
            else:raise ValueError('Unknown live operation.')
            if op in ('live-agent-finish','live-image-change','live-sync','live-finish','live-component-finish','live-component-remove','live-component-membership-undo','live-component-edit-finish','live-component-membership-replay'):
                registry=live.component_registry()
                stamp=(store.sequence,registry.sequence)
                if self.closed_worker and stamp!=self.closed_stamp:
                    self.closed_stamp=stamp;self.closed_worker.notify()
            return {**live.metadata(),'data':data,'mode':'REVIEWED' if live.production else 'TEST_REVIEWED'}
        if op=='detail':
            store.load()
            if request['id'] not in store.entries:
                return {**live.metadata(),'data':live.component_detail(request['id']),'mode':'REVIEWED' if live.production else 'TEST_REVIEWED'}
        with store.lock():
            try:store.load()
            except (Conflict,json.JSONDecodeError) as exc:store.fault=str(exc)
            database=store.database
            if self.sequence!=store.sequence or not database.exists():store.project_or_defer()
            stat=database.stat();identity=(stat.st_dev,stat.st_ino)
            if self.sequence!=store.sequence or identity!=getattr(self,'database_identity',None):
                connection=sqlite3.connect(f'file:{database}?mode=ro',uri=True)
                try:
                    # Pin one consistent generation before releasing the writer lock.
                    connection.execute('BEGIN')
                    from source_catalog import valid_rules
                    configs={};configuration_diagnostics=[]
                    registry_path=store.root/'vaults.json'
                    registry=json.loads(registry_path.read_text()) if registry_path.exists() else {}
                    if not live.production:registry[live.vault_id]={'path':str(live.vault)}
                    for vault_id,info in registry.items():
                        marker=Path(info['path'])/'.knowledge-library'/'vault.json'
                        if marker.exists():
                            try:rules,errors=valid_rules(json.loads(marker.read_text()).get('sources',[]))
                            except (ValueError,OSError) as error:rules,errors=[],[str(error)]
                            configs[vault_id]=rules
                            configuration_diagnostics.extend({'vault':vault_id,'message':message} for message in errors)
                    replacement=Library(store.root,reviewed=True,production=live.production,connection=connection,source_configs=configs)
                    replacement.configuration_diagnostics=configuration_diagnostics
                except Exception:
                    connection.close()
                    raise
                previous=self.query;self.query=replacement;self.sequence=int(replacement.meta['sequence']);self.database_identity=identity
                if previous:previous.db.close()
            else:
                self.query.db.execute('BEGIN')
                self.query.db.execute("SELECT value FROM meta WHERE key='sequence'").fetchone()
        try:
            if request.get('referencePath') is not None:
                path=request['referencePath'];resolved=live.path(path)
                if not resolved.is_file():raise ValueError('The reference destination note is unavailable.')
                self.query.set_reference_context(live.vault_id,path)
            if op=='search':
                from tag_search import TagSearch
                if not hasattr(self,'tag_search'):self.tag_search=TagSearch()
                self.tag_search.sync(live);self.query.tag_search=self.tag_search
                from search_filters import apply as search_filters
                request=search_filters(request,live,{'types':self.query.types})
            result=self.query.handle(request)
            # The query and the source mapping refer to the same loaded revision.
            data=result['data']
            if op=='search' and request.get('referencePath'):
                from local_reference_search import LocalReferenceSearch
                if not hasattr(self,'local_reference_search'):self.local_reference_search=LocalReferenceSearch()
                for index,group in enumerate(data.get('groups',[])):group['queryKey']=str(index)
                data['groups']=self.local_reference_search.groups(live,request,self.query.sources)+data.get('groups',[])
            if op=='catalog':data['configurationDiagnostics']=getattr(self.query,'configuration_diagnostics',[])
            rows=[data] if op=='detail' else data.get('rows',[])
            for group in data.get('groups',[]):rows.extend(group['rows'])
            for row in rows:
                if 'path' in row:
                    if 'kind' in row and 'title' in row:
                        from callout_labels import parse_label
                        row['referenceTitle']=parse_label(row['kind'],row['title'])['nameText'] or 'Unnamed '+row['kind']
                    row['sourcePath']=row['path']
                    # Pending projection responses must not mix new homes with old rows.
                    home={'vault':row['vault'],'vaultId':row['vault'],'path':row['path']}
                    try:row['vaultRoot']=str(live.source_root({'home':home},verify=False));row['vault']=Path(row['vaultRoot']).name
                    except (Conflict,OSError,ValueError,KeyError):row['vaultRoot']=None # not on this Mac (or a reader without a registry)
            pending=store.sequence if self.sequence!=store.sequence else None
            warning=('Read-only: '+store.fault) if store.fault else ('Saved changes are being indexed; showing the previous saved version.' if pending is not None else getattr(store,'backup_warning',None))
            return {**result,**live.metadata(),'sequence':self.sequence,'pendingSequence':pending,'warning':warning}
        finally:
            self.query.db.rollback()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--vault',required=True);ap.add_argument('--production',action='store_true');ap.add_argument('--enroll',action='store_true')
    ap.add_argument('--role',choices=('writer','reader'),default=None);args=ap.parse_args()
    service=ReviewedService(args.root,args.vault,os.environ.pop('KL_REVIEW_CAPABILITY',''),production=args.production,enrollment=args.enroll,role=args.role)
    reader=service.live.reader
    if not reader:
        component_entry_edit.session(service.live)
        from closed_vault_updates import Worker
        service.closed_worker=Worker(args.root,args.vault,production=args.production,role=service.live.role);service.closed_worker.notify()
        import operations # unresolved intents are resolved while running, not only at start
        service.recovery_worker=operations.RecoveryWorker(args.root,args.vault,production=args.production,role=service.live.role)
    try:
        for line in sys.stdin:
            request={}
            try:
                request=json.loads(line);response={**service.handle(request),'requestId':request.get('requestId')}
            except Exception as exc:response={'requestId':request.get('requestId'),'error':str(exc),'code':getattr(exc,'code',None),'retryable':not isinstance(exc,(ValueError,Conflict))}
            print(json.dumps(response,ensure_ascii=False),flush=True)
    finally:
        if not reader:
            service.closed_worker.close();service.recovery_worker.close()
            component_entry_edit.session(service.live,False)

if __name__=='__main__':main()
