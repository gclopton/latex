"""Replicated per-writer journals with explicit revision ancestry (B4).

Shared layout (synced between Macs):
    journals/<kind>/<writer-id>/<sequence:010d>-<event-hash>.json

Each writer appends only to its own chain, with exclusive creation, so the two
Macs never write the same file. An event names, for every object it changes,
the parent revisions it replaces and the events it depends on. The fold is
topological: an event applies only after its chain predecessor, every
dependency (in any journal) and every other event of its operation group are
present. Missing ones leave it pending; nothing half-applies. Each object keeps
the revisions that no other revision replaces (its heads). One head is the
current value; two or more heads are competing versions, flagged and never
resolved silently. Revision ids derive from (object, parents, value): identical
revisions converge across producers while events retain their operation ids.

Host-local state under <store>/local/ never syncs: the local application order
(stable local sequence numbers for consumers), the host label and the
checkpoint cache.
"""
import fcntl
import hashlib
import json
import os
from contextlib import contextmanager
import re
import socket
import uuid
from datetime import datetime,timezone
from pathlib import Path

SCHEMA='kl-journal/2'
KINDS=('entries','components')
EVENT_NAME=re.compile(r'^(\d{10})-([0-9a-f]{64})\.json$')
WRITER_NAME=re.compile(r'^[a-z0-9][a-z0-9-]{1,95}$')
INCARNATION=re.compile(r'^(.+)-([0-9a-f]{16})$') # host label + process incarnation
CHECKPOINT_SCHEMA='kl-journal-checkpoint/2'
ORDER_SCHEMA='kl-journal-order/1'


def encoded(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


class JournalFault(Exception):
    """Integrity failure: a fork, changed immutable bytes, invalid ancestry or a cycle.

    The journal becomes read-only; every file is preserved as evidence.
    """
    code='journal-fault'


def revision_id(operation,obj,parents,value):
    """A revision is the object's value on top of its parents.

    The operation is not part of the id: the same change written by both Macs
    (the same note bytes observed on each, a merge both make from the same
    integrated text) is one revision with several producing events, whichever
    operation wrote it. Different values or parents are different revisions.
    """
    return digest({'object':obj,'parents':sorted(parents),'value':value})


def payload_checksum(event):
    return digest({'objects':event['objects'],'payload':event.get('payload'),'provenance':event.get('provenance')})


_INCARNATION=None


def process_incarnation():
    """A fresh writer incarnation for every backend process start.

    A restored or cloned machine never continues an old chain: its next process
    starts a new chain. Old chains simply stay closed.
    """
    global _INCARNATION
    if _INCARNATION is None:_INCARNATION=uuid.uuid4().hex[:16]
    return _INCARNATION


def _write_atomic(path,data):
    path=Path(path);temporary=path.with_name('.tmp-'+path.name+'-'+uuid.uuid4().hex)
    try:
        with temporary.open('xb') as out:out.write(data);out.flush();os.fsync(out.fileno())
        os.replace(temporary,path)
    finally:
        if temporary.exists():temporary.unlink()


def _fsync_dir(path):
    descriptor=os.open(path,os.O_RDONLY)
    try:os.fsync(descriptor)
    finally:os.close(descriptor)


_MACHINE=None


def machine_id():
    """A stable id of this computer, recorded in every event it writes (None if unknown).

    macOS: the platform UUID; Linux: /etc/machine-id; otherwise the hardware
    address when it is a real one. Never random: a random value would make
    one machine look like two.
    """
    global _MACHINE
    if _MACHINE is None:
        value=None
        try:
            import subprocess
            out=subprocess.run(['ioreg','-rd1','-c','IOPlatformExpertDevice'],capture_output=True,text=True,timeout=5).stdout
            found=re.search(r'"IOPlatformUUID"\s*=\s*"([^"]+)"',out);value=found[1] if found else None
        except (OSError,ValueError,subprocess.SubprocessError):value=None
        for name in ('/etc/machine-id','/var/lib/dbus/machine-id'):
            if value:break
            try:value=Path(name).read_text().strip() or None
            except OSError:value=None
        if not value:
            node=uuid.getnode();value=None if node>>40&1 else str(node) # a multicast bit means uuid made it up
        _MACHINE=hashlib.sha256(('kl-machine:'+value).encode()).hexdigest()[:16] if value else ''
    return _MACHINE or None


def host_label(local):
    """Stable host-local label (never synced), created once from the host name."""
    path=Path(local)/'host.json'
    try:
        value=json.loads(path.read_text())['host']
        if WRITER_NAME.fullmatch(value):return value
    except (OSError,ValueError,KeyError,TypeError):pass
    label=re.sub(r'[^a-z0-9]+','-',socket.gethostname().split('.')[0].lower()).strip('-')[:40] or 'host'
    if not WRITER_NAME.fullmatch(label):label='host-'+label
    path.parent.mkdir(parents=True,exist_ok=True)
    _write_atomic(path,encoded({'host':label}))
    return label


def group_key(event):
    """One instance of an operation group: (operation id, instance id).

    Deterministic plans give the same operation id on both Macs (identical
    revisions then deduplicate), but each Mac writes its own instance of the
    group. Completeness and voiding are decided per instance, so one Mac's
    aborted instance never voids the other Mac's complete one, whatever the
    arrival order. Events without an instance (older events) form one
    instance per operation.
    """
    group=event.get('group') or {}
    return (event['operation'],group.get('instance') or '')


class Journal:
    """Object state of one journal kind; JournalSet decides what applies when."""

    def __init__(self,root,kind,library,epoch):
        self.root=Path(root);self.kind=kind;self.dir=self.root/'journals'/kind
        self.library=library;self.epoch=epoch;self.listeners=[]
        self.reset()

    def reset(self):
        self.events={};self.applied=[];self.changed={}
        self.revisions={};self.heads={};self.keys={};self.key_conflicts=set()
        self.chains={};self.inventory={};self.seen_groups={};self._scan_cache={};self.voided=set()

    @property
    def sequence(self):return len(self.applied)

    @property
    def head(self):return self.applied[-1] if self.applied else None

    def stable(self,revision):
        info=self.revisions[revision]
        return (*info['displayOrder'],revision)

    def state(self,obj):
        """(value of the display head, heads). More than one head: competing versions."""
        heads=self.heads.get(obj,[])
        if not heads:return None,[]
        return self.revisions[heads[-1]]['value'],list(heads)

    def conflicted(self,obj):return len(self.heads.get(obj,()))>1

    def frontiers(self):return {writer:max(chain) for writer,chain in self.chains.items()}

    def stamp(self):
        """Exact names of every event file; directory times are too coarse on some filesystems."""
        if not self.dir.is_dir():return ('missing',)
        return tuple((child.name,tuple(sorted(os.listdir(child)))) for child in sorted(self.dir.iterdir()) if child.is_dir())

    def scan(self):
        """{writer: {sequence: (hash, path)}}; two files for one sequence are a fork."""
        files={}
        if not self.dir.is_dir():return files
        for child in sorted(self.dir.iterdir()):
            if child.name.startswith('.'):continue
            if not child.is_dir() or not WRITER_NAME.fullmatch(child.name):raise JournalFault('Unexpected entry in the journal: '+str(child.relative_to(self.root)))
            chain=files.setdefault(child.name,{})
            for path in child.iterdir():
                if path.name.startswith('.'):continue # temporary file of an append in progress
                match=EVENT_NAME.fullmatch(path.name)
                if not match:raise JournalFault('Unexpected journal file '+str(path.relative_to(self.root)))
                sequence=int(match[1])
                if sequence in chain and chain[sequence][0]!=match[2]:
                    raise JournalFault('Writer fork: '+child.name+' has two events with sequence '+str(sequence))
                chain[sequence]=(match[2],path)
        return files

    def read(self,writer,sequence,expected,path):
        """Parsed, validated event; None while its bytes are still arriving."""
        raw=path.read_bytes()
        try:body=json.loads(raw)
        except (ValueError,UnicodeDecodeError):return None
        rel=str(path.relative_to(self.root))
        if not isinstance(body,dict):raise JournalFault('Malformed journal event '+rel)
        content={k:v for k,v in body.items() if k!='hash'}
        if body.get('hash')!=expected or digest(content)!=expected:raise JournalFault('Journal event bytes changed: '+rel)
        if content.get('schema')!=SCHEMA or content.get('kind')!=self.kind:raise JournalFault('Unknown journal schema in '+rel)
        if content.get('library')!=self.library or content.get('epoch')!=self.epoch:raise JournalFault('Journal event belongs to another library or epoch: '+rel)
        if content.get('writer')!=writer or content.get('sequence')!=sequence:raise JournalFault('Journal event location disagrees with its content: '+rel)
        if content.get('checksum')!=payload_checksum(content):raise JournalFault('Journal payload checksum failed: '+rel)
        if not isinstance(content.get('objects'),dict) or not isinstance(content.get('dependencies'),list):raise JournalFault('Malformed journal event '+rel)
        if (sequence==1)!=(content.get('previous') is None):raise JournalFault('Broken chain link in '+rel)
        for spec in content['objects'].values():
            if not isinstance(spec,dict) or not isinstance(spec.get('parents'),list) or 'value' not in spec:raise JournalFault('Malformed journal object in '+rel)
        group=content.get('group')
        if group is not None and (not isinstance(group,dict) or not isinstance(group.get('parts'),int) or not isinstance(group.get('part'),int)
                                  or not 1<=group['part']<=group['parts']<=16 or group.get('operation')!=content.get('operation')
                                  or not isinstance(group.get('instance',''),str) or len(group.get('instance',''))>200):
            raise JournalFault('Malformed operation group in '+rel)
        content['hash']=expected
        return content

    def apply(self,event,void=False):
        """Apply one event. A voided event (a member of an aborted operation group)
        keeps its place in the chain and the order but changes no object."""
        h=event['hash'];changed=[]
        for obj in ([] if void else sorted(event['objects'])):
            spec=event['objects'][obj];rev=revision_id(event['operation'],obj,spec['parents'],spec['value'])
            if rev in self.revisions:
                # The same deterministic revision written by another writer: one
                # revision, several producing events (any of them satisfies a child).
                info=self.revisions[rev]
                if h not in info['events']:info['events'].append(h)
                # First-producing-event metadata remains provenance. Display
                # order instead uses the minimum of *all* producers, so peers
                # agree even when each folded its own producer first.
                info['displayOrder']=min(info['displayOrder'],(event['writer'],event['sequence'],h))
                before=self.heads.get(obj,[])
                self.heads[obj]=sorted(before,key=self.stable)
                if self.heads[obj]!=before:changed.append(obj)
                continue
            for parent in spec['parents']:
                info=self.revisions.get(parent)
                if info is None or info['object']!=obj:raise JournalFault('Invalid revision ancestry in '+h+' for '+obj)
                if not set(info['events'])&set(event['dependencies']):raise JournalFault('A parent revision is not a declared dependency in '+h)
            self.revisions[rev]={'object':obj,'parents':list(spec['parents']),'value':spec['value'],'event':h,'events':[h],'writer':event['writer'],'sequence':event['sequence'],
                                 'displayOrder':(event['writer'],event['sequence'],h)}
            heads=[x for x in self.heads.get(obj,[]) if x not in spec['parents']]+[rev]
            self.heads[obj]=sorted(heads,key=self.stable);changed.append(obj)
        if void:self.voided.add(h)
        else:
            known=self.keys.get(event['key'])
            if known:
                if event['intent'] not in known['intents'].values():self.key_conflicts.add(event['key'])
                known['events'].append(h);known['intents'][h]=event['intent']
            else:self.keys[event['key']]={'intent':event['intent'],'operation':event['operation'],'events':[h],'intents':{h:event['intent']}}
        if event.get('group'):self.seen_groups.setdefault(group_key(event),set()).add(event['group']['part'])
        self.events[h]=event;self.applied.append(h);self.changed[h]=changed
        self.chains.setdefault(event['writer'],{})[event['sequence']]=h
        for listener in list(self.listeners):listener(event,changed)

    def event_for_key(self,key,intent):
        """This key's applied event with exactly this intent (any writer), or None."""
        known=self.keys.get(key)
        if not known:return None
        return next((h for h in known['events'] if known['intents'].get(h)==intent),None)


class JournalSet:
    """Folds the entries and component journals together under one local order."""

    def __init__(self,root,library,epoch,*,writer=None,reader=False,local=None,kinds=KINDS):
        self.root=Path(root);self.library=library;self.epoch=epoch;self.reader=bool(reader)
        self.local=Path(local) if local else self.root/'local';self._writer=writer
        self.journals={kind:Journal(root,kind,library,epoch) for kind in kinds}
        self.ready=lambda event:True
        self.reset()

    def reset(self):
        for journal in self.journals.values():journal.reset()
        self.order=[];self.order_id=None;self._order_loaded=False;self.pending={};self.parked={};self.stamp=None;self.restored_from_checkpoint=False;self.group_members={}
        self._operations_stamp=None

    @property
    def writer(self):
        if self._writer is None:self._writer=host_label(self.local)+'-'+process_incarnation()
        if not WRITER_NAME.fullmatch(self._writer):raise ValueError('Invalid writer id')
        return self._writer

    # ----- distinct host labels (the two Macs must never share one) ----------
    def check_host_label(self,events):
        """An event with this host's label written on another machine: two Macs share a label. Red."""
        label=host_label(self.local);mine=machine_id()
        for event in events:
            match=INCARNATION.fullmatch(event.get('writer',''))
            if match and match[1]==label and event.get('machine') not in (None,mine):
                raise JournalFault('Two Macs use the same host label "'+label+'" (chain '+event['writer']+' was written on another machine). '
                                   'Give each Mac its own label in local/host.json of its store before any further index write.')

    def applied(self,h):return any(h in j.events for j in self.journals.values())

    def knows_operation(self,operation):
        """Has an effective event of this operation id (or key) folded here?

        An aborted instance explains no source bytes: its retry may still be
        pending on the origin. Keep the peer's owed-operation gate closed until
        a non-voided retry folds. Without one, the existing bounded escalation
        retains the source and flags it for review instead of inventing an edit.
        """
        stamp=sum(len(j.events) for j in self.journals.values())
        if getattr(self,'_operations_stamp',None)!=stamp:
            self._operations={value for j in self.journals.values() for h,e in j.events.items() if h not in j.voided
                              for value in (e['operation'],e['key'])}
            self._operations_stamp=stamp
        return operation in self._operations

    def aborted(self,key):
        """An instance of an operation group that recovery closed with an abort part: none of it applies."""
        return any((e.get('payload') or {}).get('operation')=='abort' for e in self.group_members.get(key,{}).values())

    def note_member(self,event):
        if event.get('group'):self.group_members.setdefault(group_key(event),{})[event['hash']]=event

    def group_parts(self,key):
        parts=set()
        for journal in self.journals.values():parts|=journal.seen_groups.get(key,set())
        return parts

    def eligible(self,event):
        journal=self.journals[event['kind']];chain=journal.chains.get(event['writer'],{})
        if event['sequence']>1:
            prior=chain.get(event['sequence']-1)
            if prior is None:return False
            if prior!=event['previous']:raise JournalFault('Writer fork in '+event['writer']+' at sequence '+str(event['sequence']))
        group=event.get('group')
        # The events of one operation become visible together or not at all.
        if group and len(self.group_parts(group_key(event)))<group['parts']:return False
        if not all(self.applied(d) for d in event['dependencies']):return False
        # Content the event needs from outside the journal (image assets).
        return self.ready(event)

    def apply(self,item,event):
        self.note_member(event)
        void=bool(event.get('group')) and self.aborted(group_key(event))
        self.journals[item[0]].apply(event,void=void);self.order.append(item)

    # ----- local order ---------------------------------------------------
    def order_path(self):return self.local/'order.jsonl'

    def load_order(self):
        """The host-local application order shared by every process of this host.

        Rebuilt with a new id only if missing or damaged. A torn final line from a
        crash is cut off (the caller holds the order lock).
        """
        self._order_loaded=True;path=self.order_path()
        try:data=path.read_bytes()
        except FileNotFoundError:data=b''
        if data and not data.endswith(b'\n'):
            data=data[:data.rfind(b'\n')+1];_write_atomic(path,data)
        lines=data.decode('utf-8','replace').splitlines()
        header=None
        if lines:
            try:header=json.loads(lines[0])
            except ValueError:header=None
        if not isinstance(header,dict) or header.get('schema')!=ORDER_SCHEMA or header.get('library')!=self.library or header.get('epoch')!=self.epoch:
            if self.order:raise JournalFault('The local application order was replaced while this process was running')
            self.order_id=uuid.uuid4().hex
            self.local.mkdir(parents=True,exist_ok=True)
            _write_atomic(path,encoded({'schema':ORDER_SCHEMA,'orderId':self.order_id,'library':self.library,'epoch':self.epoch})+b'\n')
            return []
        if self.order_id is not None and header['orderId']!=self.order_id:raise JournalFault('The local application order was replaced while this process was running')
        self.order_id=header['orderId'];result=[]
        for line in lines[1:]:
            parts=line.split()
            if len(parts)!=2 or parts[0] not in self.journals or not re.fullmatch(r'[0-9a-f]{64}',parts[1]):raise JournalFault('The local application order is damaged')
            result.append((parts[0],parts[1]))
        return result

    def record_order(self,items):
        if not items:return
        descriptor=os.open(self.order_path(),os.O_WRONLY|os.O_APPEND)
        try:os.write(descriptor,''.join(kind+' '+h+'\n' for kind,h in items).encode());os.fsync(descriptor)
        finally:os.close(descriptor)

    @contextmanager
    def order_lock(self):
        """Every process of this host applies events in one shared order."""
        self.local.mkdir(parents=True,exist_ok=True)
        with (self.local/'order.lock').open('a') as handle:
            fcntl.flock(handle.fileno(),fcntl.LOCK_EX)
            try:yield
            finally:fcntl.flock(handle.fileno(),fcntl.LOCK_UN)

    # ----- fold ----------------------------------------------------------
    def refresh(self,force=False):
        """Fold newly arrived events of every journal. Returns [(kind, hash)] newly applied."""
        stamp=tuple(j.stamp() for j in self.journals.values())
        if stamp==self.stamp and not force and not self.pending:return []
        located={};parsed={};self.pending={}
        for kind,journal in self.journals.items():
            files=journal.scan()
            journal.inventory={}
            for writer,chain in files.items():
                for sequence,(h,path) in chain.items():
                    located[(kind,h)]=(writer,sequence,path);journal.inventory[str(path.relative_to(self.root))]=h
            for h in journal.events:
                if (kind,h) not in located:raise JournalFault('A journal event disappeared: '+kind+'/'+h)
        for (kind,h),(writer,sequence,path) in located.items():
            if h in self.journals[kind].events:continue
            event=self.journals[kind].read(writer,sequence,h,path)
            if event is None:self.pending[(kind,h)]='arriving';continue
            parsed[(kind,h)]=event;self.note_member(event)
            if event.get('group'):self.journals[kind].seen_groups.setdefault(group_key(event),set()).add(event['group']['part'])
        new=[];before=len(self.order)
        with self.order_lock():
            logged=self.load_order()
            if logged[:len(self.order)]!=self.order:raise JournalFault('The local application order is inconsistent with this process')
            # Events other processes of this host applied first, in their order.
            for item in logged[len(self.order):]:
                event=parsed.get(item)
                if event is None:raise JournalFault('An event of the local order is missing or unreadable: '+'/'.join(item))
                if not self.eligible(event):raise JournalFault('The local journal order is inconsistent at '+'/'.join(item))
                self.apply(item,event);del parsed[item]
            while True:
                ready=[(item,event) for item,event in parsed.items() if self.eligible(event)]
                if not ready:break
                ready.sort(key=lambda pair:(pair[1]['writer'],pair[1]['sequence'],pair[0][0],pair[0][1]))
                item,event=ready[0]
                self.apply(item,event);new.append(item);del parsed[item]
            self.record_order(new)
        for item,event in parsed.items():
            missing=[d for d in event['dependencies'] if not self.applied(d)]
            if event['sequence']>1 and event['previous'] not in self.journals[item[0]].events:missing.append(event['previous'])
            group=event.get('group')
            if group and len(self.group_parts(group_key(event)))<group['parts']:missing.append('the rest of operation '+event['operation'])
            if not missing and not self.ready(event):missing.append('image assets')
            self.pending[item]='waiting for '+', '.join(sorted(set(missing)))
        # Everything a pending event waits for is present and valid, yet nothing
        # can apply: a dependency cycle or a broken chain. That is red.
        present={h for (_,h) in parsed}|{h for j in self.journals.values() for h in j.events}
        if parsed and all(all(d in present for d in e['dependencies']+([e['previous']] if e['previous'] else []))
                          and not (e.get('group') and len(self.group_parts(group_key(e)))<e['group']['parts']) and self.ready(e) for e in parsed.values()):
            raise JournalFault('Journal events can never apply (dependency cycle or broken chain): '+', '.join(sorted(h for _,h in parsed)[:3]))
        self.parked=dict(parsed) # valid events waiting for a dependency or the rest of their group
        self.check_host_label([self.journals[kind].events[h] for kind,h in self.order[before:]]+list(parsed.values()))
        self.stamp=stamp
        return new

    # ----- append --------------------------------------------------------
    def append(self,kind,*,operation,key,intent,objects,dependencies=(),provenance=None,payload=None,group=None,at=None):
        """Create one immutable event in this writer's chain. The caller holds the store lock."""
        if self.reader:
            from host_role import ReaderHost
            raise ReaderHost('Writing an index journal event')
        from library_store import Conflict
        self.refresh(force=True)
        journal=self.journals[kind]
        known=journal.keys.get(key)
        if known:
            same=journal.event_for_key(key,intent)
            if same is None:raise Conflict('Idempotency key was already used for different changes.')
            return journal.events[same],False
        unapplied={h for (k,h) in self.parked}
        for obj,spec in objects.items():
            for parent in spec['parents']:
                if parent not in journal.revisions or journal.revisions[parent]['object']!=obj:raise Conflict('Unknown parent revision for '+obj)
        deps=set(dependencies)|{e for spec in objects.values() for p in spec['parents'] for e in journal.revisions[p]['events']}
        for dep in deps:
            if not self.applied(dep) and dep not in unapplied:raise Conflict('A dependency has not been written here: '+dep)
        writer=self.writer;folder=journal.dir/writer;own={}
        if folder.is_dir():
            for path in folder.iterdir():
                match=EVENT_NAME.fullmatch(path.name)
                if match:own[int(match[1])]=match[2]
        sequence=len(own)+1
        if sorted(own)!=list(range(1,sequence)):raise JournalFault('This writer chain is not contiguous: '+writer)
        event={'schema':SCHEMA,'kind':kind,'library':self.library,'epoch':self.epoch,'writer':writer,'sequence':sequence,'previous':own.get(sequence-1),
               'operation':operation,'key':key,'intent':intent,'objects':objects,'dependencies':sorted(deps),'provenance':provenance or {},
               'payload':payload or {},'at':at or datetime.now(timezone.utc).isoformat(),'machine':machine_id()}
        if group:event['group']={'operation':operation,'parts':int(group['parts']),'part':int(group['part']),**({'instance':str(group['instance'])} if group.get('instance') else {})}
        event['checksum']=payload_checksum(event)
        h=digest(event);folder.mkdir(parents=True,exist_ok=True)
        path=folder/f'{sequence:010d}-{h}.json';temporary=folder/('.tmp-'+uuid.uuid4().hex)
        try:
            with temporary.open('xb') as out:out.write(encoded({**event,'hash':h}));out.flush();os.fsync(out.fileno())
            os.link(temporary,path) # exclusive: an existing event is never replaced
        finally:
            if temporary.exists():temporary.unlink()
        _fsync_dir(folder)
        self.refresh(force=True)
        if h not in journal.events and not (group and group['part']<group['parts']) and not (group and (kind,h) in self.pending):
            raise JournalFault('A new journal event did not apply: '+h)
        return journal.events.get(h,{**event,'hash':h}),True

    def unapplied_own(self):
        """This writer's events that are written but not yet applied (an open operation group)."""
        writer=self.writer
        return {item:event for item,event in self.parked.items() if event['writer']==writer}

    def parked_events(self,operation=None,key=None,instance=None):
        return [e for e in self.parked.values() if (operation is None or e['operation']==operation) and (key is None or e['key']==key)
                and (instance is None or (e.get('group') or {}).get('instance','')==instance)]

    # ----- checkpoint ----------------------------------------------------
    def checkpoint_path(self):return self.local/'checkpoint.json'

    def raw_inventory(self):
        return {rel:hashlib.sha256((self.root/rel).read_bytes()).hexdigest() for journal in self.journals.values() for rel in sorted(journal.inventory)}

    def save_checkpoint(self):
        """Host-local cache bound to the exact event inventory, its bytes, the order and frontiers."""
        if self.pending:return False
        record={'schema':CHECKPOINT_SCHEMA,'library':self.library,'epoch':self.epoch,'orderId':self.order_id,'order':self.order,
                'inventory':self.raw_inventory(),'frontiers':{kind:j.frontiers() for kind,j in self.journals.items()},'pending':[],
                'events':[self.journals[kind].events[h] for kind,h in self.order]}
        self.local.mkdir(parents=True,exist_ok=True)
        _write_atomic(self.checkpoint_path(),encoded({**record,'checksum':digest(record)}))
        return True

    def restore_checkpoint(self):
        """Reuse a checkpoint only for exactly the inventory and bytes it covers.

        A newly discovered record, writer or filled gap, a missing file or any
        changed byte invalidates it; the caller then folds from the journals.
        """
        try:saved=json.loads(self.checkpoint_path().read_text())
        except (OSError,ValueError):return False
        try:
            checksum=saved.pop('checksum')
            if digest(saved)!=checksum or saved['schema']!=CHECKPOINT_SCHEMA or saved['library']!=self.library or saved['epoch']!=self.epoch:return False
            on_disk={}
            for journal in self.journals.values():
                for chain in journal.scan().values():
                    for h,path in chain.values():on_disk[str(path.relative_to(self.root))]=path
            if set(on_disk)!=set(saved['inventory']) or saved['pending']:return False
            for rel,raw in saved['inventory'].items():
                if hashlib.sha256(on_disk[rel].read_bytes()).hexdigest()!=raw:return False
            order=[tuple(item) for item in saved['order']]
            if self.load_order()!=order or self.order_id!=saved['orderId']:return False
            for event in saved['events']:
                self.note_member(event)
                if event.get('group'):self.journals[event['kind']].seen_groups.setdefault(group_key(event),set()).add(event['group']['part'])
            self.check_host_label(saved['events'])
            for event in saved['events']:
                if not self.eligible(event):raise JournalFault('checkpoint order')
                self.apply((event['kind'],event['hash']),event)
            for kind,journal in self.journals.items():
                journal.inventory={rel:EVENT_NAME.fullmatch(Path(rel).name)[2] for rel in saved['inventory'] if rel.startswith('journals/'+kind+'/')}
            self.stamp=tuple(j.stamp() for j in self.journals.values());self.restored_from_checkpoint=True
            return True
        except (KeyError,TypeError,ValueError,JournalFault):
            return None # partially applied: the caller must rebuild its state from scratch
