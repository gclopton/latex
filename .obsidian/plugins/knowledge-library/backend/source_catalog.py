"""Derived book/folder and chapter/note scopes; no source scanning or admission."""
from pathlib import PurePosixPath
import uuid
import re


def configured_book(path, rules):
    """Explicit roots override conventions; paths never escape a vault."""
    matches=[]
    for rule in rules or []:
        if not isinstance(rule,dict):raise ValueError('Source configuration must contain book objects.')
        root=rule.get('book','')
        if not isinstance(root,str) or not root or root.startswith('/') or any(p in ('','..','.') for p in root.split('/')) or '\\' in root:
            raise ValueError('Configured book must be a relative folder path.')
        if rule.get('chapters','child-folders') not in ('child-folders','conventional'):
            raise ValueError('Unknown chapter folder convention.')
        if rule.get('label') is not None and (not isinstance(rule['label'],str) or not rule['label'].strip()):
            raise ValueError('Book label must be nonempty text.')
        if path.startswith(root+'/'):matches.append(rule)
    return max(matches,key=lambda r:len(r['book'])) if matches else None


def valid_rules(value):
    if not isinstance(value,list):return [],['Source configuration must be a list of books.']
    rules=[];diagnostics=[]
    for i,rule in enumerate(value):
        try:configured_book('',[rule]);rules.append(rule)
        except ValueError as error:diagnostics.append(f'Book configuration {i+1}: {error}')
    return rules,diagnostics


def source_scopes(path,rules=None):
    parts=PurePosixPath(path).parts
    rule=configured_book(path,rules)
    book_index=len(PurePosixPath(rule['book']).parts)-1 if rule else book_root(parts)
    book_path='/'.join(parts[:book_index+1]) if book_index is not None else None
    chapter_path=chapter_folder(parts,book_index)
    if rule and rule.get('chapters','child-folders')=='child-folders':
        from crawl import role
        i=book_index+1
        chapter_path=None
        if i<len(parts)-1 and parts[i].casefold() not in ('images','scripts','pdf','original markdown','review','figures','attachments') and role('/'.join(parts[:i+1])+'/note.md') not in ('snapshot','support','source'):
            chapter_path='/'.join(parts[:i+1])
    scopes=[]
    if book_path:
        label=(rule.get('label') or parts[book_index]) if rule else parts[book_index-1] if parts[book_index]=='Book' else parts[book_index]
        scopes.append((book_path,True,'book',label))
    elif len(parts)>1:scopes.append(('/'.join(parts[:-1]),True,'folder',parts[-2]))
    if chapter_path:scopes.append((chapter_path,True,'chapter',parts[book_index+1]))
    scopes.append((path,False,'chapter' if book_path and not chapter_path and re.match(r'(?i)^(chapter\s+\d+|\d{1,3}(?:\s*[-–]|\s+))',PurePosixPath(path).stem) else 'note',PurePosixPath(path).stem))
    if len(parts)>1:scopes.append(('/'.join(parts[:-1]),True,'folder',parts[-2]))
    for i,part in enumerate(parts[:-1]):
        if part.casefold() in ('books','textbooks') and i+1<len(parts)-1:
            scopes.append(('/'.join(parts[:i+2]),True,'folder',parts[i+1]));break
    return scopes,book_path,chapter_path


def book_root(parts):
    """Recognize the vault's evidenced layouts, not arbitrary parent folders."""
    for i,part in enumerate(parts[:-1]):
        if part.casefold() in ('books','textbooks') and i+1<len(parts)-1:
            if parts[i+1].casefold()=='nptel':
                return i+3 if i+3<len(parts)-1 else None
            return i+1
        if part=='Book' and i>=2 and parts[i-2]=='Courses':
            return i
    return None


def chapter_folder(parts,book_index):
    if book_index is None:return None
    i=book_index+1
    if i<len(parts)-1 and re.match(r'(?i)^(?:\d{1,3}(?:\s*[-–]\s*|\s+)|chapter\s+\d+\b)',parts[i]):
        return '/'.join(parts[:i+1])
    return None


def source_id(vault,path,folder):
    return str(uuid.uuid5(uuid.NAMESPACE_URL,'index-source:'+vault+':'+('folder:' if folder else 'note:')+path))


def catalog(rows,vaults,configs=None):
    vault_map={v['name']:v for v in vaults};sources={}
    for vault,path,count in rows:
        scopes,book_path,chapter_path=source_scopes(path,(configs or {}).get(vault))
        counted=set()
        for scope_path,folder,kind,label in scopes:
            id=source_id(vault,scope_path,folder)
            if id in counted:continue
            counted.add(id)
            if id not in sources:
                parent=chapter_path if not folder and chapter_path else book_path if kind=='chapter' or (book_path and not folder) else None
                sources[id]={'id':id,'vault':vault,'vaultId':vault_map[vault]['id'],'vaultLabel':vault_map[vault]['label'],'path':scope_path,'folder':folder,'kind':kind,'label':label,'count':0,'parentId':source_id(vault,parent,True) if parent else None}
            sources[id]['count']+=count
    return sorted(sources.values(),key=lambda s:(s['vaultLabel'].casefold(),s['path'].casefold(),not s['folder']))


def reference_context(vault,path,vaults,configs=None):
    nodes=catalog([(vault,path,0)],vaults,configs)
    book=next((n for n in nodes if n['kind']=='book'),None)
    chapter=next((n for n in nodes if n['kind']=='chapter'),None)
    note=next(n for n in nodes if not n['folder'] and n['path']==path)
    fallback=next((n for n in nodes if n['folder'] and n['path']==str(PurePosixPath(path).parent)),note)
    return {'book':book,'chapter':chapter,'note':note,'defaultSource':book or fallback,'sources':nodes}
