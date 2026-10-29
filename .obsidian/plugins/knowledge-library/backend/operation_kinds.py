"""Per-kind recovery handlers for durable operation intents (operations.resolve).

Each handler knows how to finish its operation from a verified postimage with
the original event keys, what "retry" means for an exact preimage (the owning
queue keeps the operation), and what to mark when a divergent note needs review.
"""
import json
from library_store import Conflict, atomic_json


class Handler:
    def completed(self,live,token,intent):pass
    def finish(self,live,token,intent,text):raise Conflict('This operation cannot be finished automatically')
    def retry(self,live,token,intent):return 'it is planned again from the current note'
    def divergent(self,live,token,intent,text):return None
    def review(self,live,token,intent,text):pass


def active(live,token):
    import operations
    path=operations.folder(live.store)/(token+'.json')
    return json.loads(path.read_text())


class Component(Handler):
    """Editor observation plans and other component plans (paste, sync, undo)."""
    def finish(self,live,token,intent,text):
        live.finish_component_intent(token,active(live,token),text)


class Propagation(Handler):
    """Copy updates (open editor or closed-vault writer) and their Undo."""
    def finish(self,live,token,intent,text):
        from component_membership import propagation_resume
        propagation_resume(live,token,text)
    def retry(self,live,token,intent):return 'its copy-update receipt stays pending and is written again'


class EntryEdit(Handler):
    """Index entry edits: one job, its note write and one event group."""
    def job(self,intent):return (intent.get('data') or {}).get('job')
    def known(self,live,intent):
        import component_entry_edit
        try:component_entry_edit.read_job(live,self.job(intent));return True
        except (OSError,ValueError,TypeError,AttributeError):return False
    def finish(self,live,token,intent,text):
        import component_entry_edit
        if not self.known(live,intent):
            # No job to complete (an intent from before the key was carried, or a
            # removed job): the component events still finish; the job's own
            # queue reconciles its receipt.
            Component().finish(live,token,intent,text);return
        component_entry_edit.finish(live,self.job(intent),token,text)
    def completed(self,live,token,intent):
        import component_entry_edit
        try:job=component_entry_edit.read_job(live,self.job(intent))
        except (OSError,ValueError,TypeError,AttributeError):return
        if job.get('state')=='pending':component_entry_edit.complete(live,self.job(intent),intent.get('after'))
    def retry(self,live,token,intent):return 'the edit job stays queued and is applied again'
    def review(self,live,token,intent,text):
        import component_entry_edit
        try:component_entry_edit.fail(live,self.job(intent),'The home note changed during an interrupted index edit; both versions were preserved for review.')
        except (OSError,ValueError,TypeError,AttributeError,Conflict):pass


class Agent(Handler):
    """Agent apply and agent Undo (a reverse plan of the same kind)."""
    def path(self,live,intent):return live.store.root/'agent-writes'/(str((intent.get('data') or {}).get('agent') or 'missing')+'.json')
    def complete(self,live,intent):
        from agent_api import read_job,publish_terminal
        path=self.path(live,intent)
        if not path.exists():return
        job=read_job(path)
        if job.get('state')=='complete':return
        job['state']='complete';publish_terminal(path,job);atomic_json(path,job)
        (path.parent/'pending'/path.name).unlink(missing_ok=True)
    def finish(self,live,token,intent,text):
        live.finish_component_intent(token,active(live,token),text);self.complete(live,intent)
    def completed(self,live,token,intent):self.complete(live,intent)
    def retry(self,live,token,intent):return 'the agent plan stays applicable with the same token'
    def review(self,live,token,intent,text):
        from agent_api import read_job,publish_terminal
        path=self.path(live,intent)
        if not path.exists():return
        job=read_job(path)
        if job.get('state')=='complete':return
        job.update(state='conflict',error='The note changed during an interrupted agent write; both versions were preserved for review.')
        publish_terminal(path,job);atomic_json(path,job);(path.parent/'pending'/path.name).unlink(missing_ok=True)


class Admission(Handler):
    def token(self,intent):return (intent.get('data') or {}).get('admission')
    def finish(self,live,token,intent,text):live.finish_admission(self.token(intent))
    def completed(self,live,token,intent):
        try:live.finish_admission(self.token(intent)) # archives the committed plan
        except (Conflict,OSError,ValueError):pass
    def retry(self,live,token,intent):return 'the reviewed admission stays pending until it is saved again or discarded'
    def divergent(self,live,token,intent,text):
        try:live.finish_admission(self.token(intent))
        except (Conflict,OSError,ValueError):return None
        return 'every reviewed entry was verified in the current note'


class Rename(Handler):
    def finish(self,live,token,intent,text):live.finish_rename(intent)
    def retry(self,live,token,intent):return 'the next rename event or discovery records it'


HANDLERS={'component':Component(),'propagation':Propagation(),'propagation-undo':Component(),'entry-edit':EntryEdit(),
          'agent':Agent(),'admission':Admission(),'rename':Rename(),'journal':Handler()}


def handler(kind):return HANDLERS.get(kind,HANDLERS['component'])
