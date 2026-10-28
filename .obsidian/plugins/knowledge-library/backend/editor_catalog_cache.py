"""Bounded ephemeral editor projections. Never retains source text or writes files."""
from collections import OrderedDict
import secrets
import sys


class SnapshotExpired(ValueError):
    code='snapshot-evicted'


def retained_size(obj,seen=None):
    seen=set() if seen is None else seen
    if id(obj) in seen:return 0
    seen.add(id(obj));size=sys.getsizeof(obj)
    if isinstance(obj,dict):size+=sum(retained_size(k,seen)+retained_size(v,seen) for k,v in obj.items())
    elif isinstance(obj,(list,tuple)):size+=sum(retained_size(x,seen) for x in obj)
    return size


class EditorCatalogCache:
    def __init__(self,max_entries=32,max_bytes=32*1024*1024,max_snapshot_bytes=8*1024*1024,max_rows=10000):
        self.entries=OrderedDict();self.keys={};self.bytes=0
        self.max_entries=max_entries;self.max_bytes=max_bytes;self.max_snapshot_bytes=max_snapshot_bytes;self.max_rows=max_rows

    def by_key(self,key):
        token=self.keys.get(key)
        return self.get(token) if token else None

    def get(self,token):
        if not isinstance(token,str) or token not in self.entries:raise SnapshotExpired('Editor snapshot expired; refresh this note once.')
        row=self.entries[token];self.entries.move_to_end(token);return row

    def put(self,key,data,metadata):
        existing=self.by_key(key)
        if existing:return existing
        if len(data['occurrences'])>self.max_rows:raise ValueError(f'This note exceeds the {self.max_rows:,}-callout editor projection limit.')
        token=secrets.token_urlsafe(24)
        row={'token':token,'key':key,'data':data,'metadata':metadata,'bytes':0,'summaryBytes':None,'lines':{o['line']:o for o in data['occurrences']}}
        size=retained_size(row)
        if size>min(self.max_snapshot_bytes,self.max_bytes):raise ValueError('This note exceeds the editor projection memory limit.')
        group=tuple(metadata.get(k) for k in ('path','registered','policyStamp')) if 'path' in metadata else None
        if group is not None:
            related=[old for old in self.entries.values() if tuple(old['metadata'].get(k) for k in ('path','registered','policyStamp'))==group]
            for old in related[:-1]:self.remove(old)
        while self.entries and (len(self.entries)>=self.max_entries or self.bytes+size>self.max_bytes):
            self.remove(next(iter(self.entries.values())))
        row['bytes']=size;self.entries[token]=row;self.keys[key]=token;self.bytes+=size;return row

    def remove(self,row):
        self.entries.pop(row['token'],None);self.bytes-=row['bytes'];self.keys.pop(row['key'],None)
