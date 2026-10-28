"""Portable numbering authority: vault defaults, existing book rules, note YAML.

This module only reads. Invalid overrides fall back with diagnostics; an
unreadable vault configuration never silently renumbers its documents.
"""
import hashlib
import json
import re
from pathlib import Path
from source_catalog import configured_book
from document_numbers import ordinal,format_number


def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def validate(value):
    if not isinstance(value,dict) or set(value)-{'chapter','section','bothFormat','types','authoredGroups','series','titleMode'}:raise ValueError('Numbering accepts chapter, section, bothFormat, types, series, authoredGroups and titleMode')
    if value.get('titleMode','numbered') not in ('numbered','source'):raise ValueError('titleMode must be source or numbered')
    if value.get('authoredGroups','number') not in ('number','unnumbered'):raise ValueError('authoredGroups must be number or unnumbered')
    for name in ('chapter','section'):
        if name in value and (type(value[name]) not in (str,int) or len(str(value[name]))>80):raise ValueError(name+' must be short text or an integer; quote dotted labels, for example '+name+': "1.10"')
    if 'bothFormat' in value:
        import string
        if not isinstance(value['bothFormat'],str) or len(value['bothFormat'])>120:raise ValueError('Invalid label/title format')
        for _,key,spec,conversion in string.Formatter().parse(value['bothFormat']):
            if key is not None and (key not in ('label','title') or spec or conversion):raise ValueError('Both format accepts only {label} and {title}')
    series=value.get('series',{})
    if not isinstance(series,dict) or len(series)>100:raise ValueError('Invalid series settings')
    for key,rule in series.items():
        if not isinstance(key,str) or not key.startswith('user:') or not isinstance(rule,dict) or set(rule)-{'series','prefix','format'}:raise ValueError('Invalid series rule')
        for field in ('series','prefix'):
            if field in rule and (not isinstance(rule[field],str) or not rule[field].strip() or len(rule[field])>80 or any(ord(c)<32 for c in rule[field])):raise ValueError('Invalid series '+field)
        format_number(rule.get('format','{type} {chapter}.{prefix}{n}'),{'type':'Theorem','chapter':'5','section':'1','n':'1','prefix':'A','series':'Personal'})
    types=value.get('types',{})
    if not isinstance(types,dict) or len(types)>100:raise ValueError('Types must be a numbering policy object')
    for kind,rule in types.items():
        if not isinstance(kind,str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,79}',kind) or not isinstance(rule,dict):raise ValueError('Invalid callout type policy')
        if set(rule)-{'mode','label','counter','reset','start','style','format','typeLabel','overrideAuthored','prefix','series'}:raise ValueError('Unknown numbering option')
        if 'overrideAuthored' in rule and type(rule['overrideAuthored']) is not bool:raise ValueError('overrideAuthored must be true or false')
        if rule.get('mode','auto') not in ('auto','fixed','off'):raise ValueError('Invalid numbering mode')
        if rule.get('reset','document') not in ('document','chapter','section'):raise ValueError('Invalid numbering reset')
        ordinal(rule.get('start',1),rule.get('style','decimal'))
        format_number(rule.get('format','{n}'),{'n':'1','chapter':'1','section':'1','type':'Theorem','prefix':'A','series':'Personal'})
        for name in ('label','counter','typeLabel','prefix','series'):
            if name in rule and (not isinstance(rule[name],str) or not rule[name].strip() or len(rule[name])>80 or any(ord(c)<32 for c in rule[name])):raise ValueError('Invalid '+name)
    return value


def merge(base,override):
    result={**base,**override}
    if 'types' in base or 'types' in override:
        result['types']={k:{**base.get('types',{}).get(k,{}),**override.get('types',{}).get(k,{})} for k in base.get('types',{}).keys()|override.get('types',{}).keys()}
    if 'series' in base or 'series' in override:result['series']={k:{**base.get('series',{}).get(k,{}),**override.get('series',{}).get(k,{})} for k in base.get('series',{}).keys()|override.get('series',{}).keys()}
    return result


def note_policy(base,parsed):
    if parsed.get('numberingIssue'):return base,[{'code':'invalid-numbering','severity':'warning','reason':parsed['numberingIssue']}]
    if 'numbering' not in parsed:return base,[]
    try:return merge(base,validate(parsed['numbering'])),[]
    except ValueError as error:return base,[{'code':'invalid-numbering','severity':'warning','reason':str(error)}]


class PolicyUnavailable(ValueError):pass


class Snapshot:
    def __init__(self,data,previous=None):
        self.revision=digest(data)
        self.rules=[];self.errors={};self.good=dict(previous.good) if previous else {};self.cache={}
        try:self.default=validate(data.get('numbering',{}))
        except ValueError as error:self.default={};self.errors['*']='Vault: '+str(error)
        rules=data.get('sources',[])
        if not isinstance(rules,list):
            self.errors['*']='Source configuration must be a list of books';rules=[]
            if previous:self.rules=list(previous.rules)
        seen=set()
        for rule in rules:
            try:
                root=rule.get('book') if isinstance(rule,dict) else None
                configured_book('',[{'book':root}])
            except ValueError as error:
                self.errors['*']=str(error)
                if previous:self.rules=list(previous.rules)
                break
            if root in seen:self.errors[root]='Duplicate book configuration: '+root;continue
            seen.add(root);self.rules.append({'book':root})
            try:
                configured_book('',[rule]);numbering=validate(rule.get('numbering',{}))
                if '*' not in self.errors:self.good[root]=merge(self.default,numbering)
            except ValueError as error:self.errors[root]=root+': '+str(error)
        if '*' in self.errors:
            self.good=dict(previous.good) if previous else {}
            self.rules=list(previous.rules) if previous else []
        else:
            self.good['']=self.default
            for key in self.errors:
                if previous and key in previous.good:self.good[key]=previous.good[key]
                else:self.good.pop(key,None)

    def resolve(self,path):
        rule=configured_book(path,self.rules);key=rule['book'] if rule else ''
        if key not in self.cache:
            error=self.errors.get('*') or self.errors.get(key)
            if error and key not in self.good:raise PolicyUnavailable(error)
            config=self.good[key]
            self.cache[key]={'config':config,'bookKey':key,'policyDigest':digest([key,config]),'policyRevision':self.revision,'policyStamp':digest([self.revision,None]),'diagnostics':
                [{'code':'policy-unavailable','severity':'warning','reason':error}] if error else []}
            if error:self.cache[key]['policyStale']=True
        return self.cache[key]


class StaleSnapshot:
    def __init__(self,previous,error):self.previous=previous;self.error=error;self.revision=previous.revision
    def resolve(self,path):
        old=self.previous.resolve(path)
        return {**old,'policyStale':True,'policyStamp':digest([self.revision,self.error]),'diagnostics':old['diagnostics']+[{'code':'policy-unavailable','severity':'warning','reason':self.error}]}


class NumberingPolicies:
    def __init__(self,vault):
        self.file=Path(vault)/'.knowledge-library/vault.json';self.signature=object();self.cached=None
        self.failed_signature=object();self.failure=None

    def unavailable(self,message):
        if self.cached:return StaleSnapshot(self.cached,message)
        raise PolicyUnavailable(message)

    def snapshot(self):
        def signature():
            try:
                from pilot_config import authority
                selected=authority(self.file.parent.parent)
                s=selected.stat();return (str(selected),s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
            except FileNotFoundError:
                from pilot_config import authority
                selected=authority(self.file.parent.parent)
                return ('missing-pilot',) if selected.name=='pilot.json' else None
        try:
            before=signature()
            if before==self.signature:return self.cached
            if before==self.failed_signature:return self.unavailable(self.failure)
            if before is None and self.cached and self.signature is not None:raise ValueError('Vault configuration was removed')
            from pilot_config import read
            data=read(self.file.parent.parent)
            if not isinstance(data,dict):raise ValueError('Vault configuration must be an object')
            if signature()!=before:raise ValueError('Vault configuration changed while reading')
            result=Snapshot(data,self.cached)
        except PolicyUnavailable:raise
        except (OSError,ValueError) as error:
            message='Numbering configuration unavailable: '+str(error)
            if 'before' in locals():self.failed_signature=before;self.failure=message
            return self.unavailable(message)
        self.signature=before;self.cached=result;self.failed_signature=object();return result
