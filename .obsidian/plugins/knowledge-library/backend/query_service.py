"""Read-only JSON-lines API for the isolated browsing pilot. No network listener."""
import argparse
from collections import defaultdict, Counter
from functools import lru_cache
from itertools import product
import uuid
import json
import re
import sqlite3
import sys
import time
import heapq
from pathlib import Path
from crawl import math_search
from search_projection import normalize_words, SCHEMA as SEARCH_PROJECTION_SCHEMA


def split_queries(text):
    if len(text) > 2000:
        raise ValueError("Search is limited to 2,000 characters.")
    parts, buf, quote, math = [], [], False, None
    i = 0
    while i < len(text):
        c = text[i]
        if c == "\\" and i + 1 < len(text):
            token = text[i:i + 2]
            if token in (r"\(", r"\[") and not quote and math is None:
                math = r"\)" if token == r"\(" else r"\]"
            elif token == math:
                math = None
            buf.append(token)
            i += 2
            continue
        if c == '"' and math is None:
            quote = not quote
        elif c == "$" and not quote:
            token = "$$" if text[i:i+2] == "$$" else "$"
            math = None if math == token else token if math is None else math
            buf.append(token)
            i += len(token)
            continue
        if c in ";\n" and not quote and math is None:
            if "".join(buf).strip():
                parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(c)
        i += 1
    if "".join(buf).strip():
        parts.append("".join(buf).strip())
    if len(parts) > 8:
        raise ValueError("Search up to eight terms at once, separated by semicolons.")
    return parts


def edit_distance(a, b):
    """Damerau restricted distance: adjacent transpositions are one typo."""
    rows = [list(range(len(b) + 1))]
    for i, ca in enumerate(a, 1):
        row = [i]
        for j, cb in enumerate(b, 1):
            value = min(row[-1] + 1, rows[-1][j] + 1, rows[-1][j-1] + (ca != cb))
            if i > 1 and j > 1 and ca == b[j-2] and a[i-2] == cb:
                value = min(value, rows[-2][j-2] + 1)
            row.append(value)
        rows.append(row)
    return rows[-1][-1]


def search_expression(text):
    text = normalize_words(math_search(text))
    # Quotes preserve phrases. Punctuation and TeX wrappers are retrieval-only.
    atoms = []
    for match in re.finditer(r'"([^"]+)"|([^"\s]+)', text):
        value = match[1] or match[2]
        words = re.findall(r"\w+", value, re.UNICODE)
        if not words:
            continue
        if match[1]:
            atoms.append('"' + " ".join(words) + '"')
        else:
            atoms.extend('"' + w + '"' for w in words)
    return " AND ".join(atoms)


from display_groups import display_key
from source_catalog import catalog as source_catalog

class Library:
    def __del__(self):
        connection=getattr(self,'db',None)
        if connection is not None:
            try:connection.close()
            except sqlite3.Error:pass

    def __init__(self, root, database="test.sqlite", reviewed=False, production=False, connection=None, legacy_projection=False, source_configs=None):
        self.reviewed=reviewed
        self.source_configs=source_configs or {};self.reference_context=None
        self.root = Path(root).resolve()
        self.db = connection or sqlite3.connect(f"file:{self.root / database}?mode=ro", uri=True)
        self.db.row_factory = sqlite3.Row
        from formula_search import literal
        self.db.create_function("kl_literal",1,literal,deterministic=True)
        self.meta = dict(self.db.execute("SELECT key,value FROM meta").fetchall())
        if self.meta.get("mode") != (("REVIEWED" if production else "TEST_REVIEWED") if reviewed else "TEST_ONLY_UNREVIEWED") or self.meta.get("production_approvals") != "0":
            raise ValueError("This pilot only opens an unadmitted TEST corpus.")
        self.base = """FROM entries e JOIN documents d ON e.document_id=d.id
            JOIN cleanup c ON c.entry_id=e.id"""

        self.spelling_candidates=lru_cache(maxsize=512)(self.spelling_candidates)
        self.scope_vocabulary=lru_cache(maxsize=32)(self.scope_vocabulary)
        self.persisted = self.meta.get('search_projection') == str(SEARCH_PROJECTION_SCHEMA) and not legacy_projection
        if reviewed and not self.persisted and not legacy_projection:
            raise ValueError('Search projection version changed; rebuild the derived index before reading it.')
        if self.persisted:
            self.base += ' JOIN display_groups dg ON dg.entry_id=e.id'
            self._init_catalogs(production)
            return

        names=defaultdict(set)
        for vault,path in self.db.execute("SELECT vault,path FROM documents"):
            for key in (path.removesuffix('.md'),Path(path).stem):names[(vault,key)].add(path)
        self.db.execute("CREATE TEMP TABLE display_groups(entry_id TEXT PRIMARY KEY, display_key TEXT)")
        keys={r[0]:display_key(r[1],r[2],r[3],r[4],r[5],names) for r in self.db.execute("SELECT e.id,e.kind,e.title,e.body,d.vault,d.path "+self.base)}
        if reviewed:
            copies={r['id']:dict(r) for r in self.db.execute('SELECT id,parent,body_sha256,copy_body_hash,parent_body_hash FROM entries')}
            def key_for(entry_id,seen):
                e=copies[entry_id];parent=copies.get(e['parent'])
                if parent and e['parent'] not in seen and e['body_sha256']==e['copy_body_hash'] and parent['body_sha256']==e['parent_body_hash']:
                    return key_for(parent['id'],seen|{entry_id})
                return keys[entry_id]
            keys={entry_id:key_for(entry_id,set()) for entry_id in keys}
        self.db.executemany("INSERT INTO display_groups VALUES(?,?)",keys.items())
        self.db.execute("CREATE INDEX temp.display_groups_key ON display_groups(display_key)")
        self.db.commit()
        self.base+=" JOIN display_groups dg ON dg.entry_id=e.id"
        # Derived in-memory spelling index; never modifies the frozen corpus.
        self.vaults = []
        labels=json.loads((self.root/'vaults.json').read_text()) if production and (self.root/'vaults.json').exists() else {}
        vault_counts=dict(self.db.execute("SELECT d.vault,COUNT(*) " + self.base + " WHERE c.disposition NOT IN ('fixture','unadmitted','deleted') GROUP BY d.vault"))
        for name in sorted(set(vault_counts)|set(labels)):
            self.vaults.append({"id": str(uuid.uuid5(uuid.NAMESPACE_URL, "knowledge-library-test-vault:" + name)),
                                "name": name, "label": labels.get(name,{}).get('name',name).replace("_", " "), "count": vault_counts.get(name,0)})
        from crawl import KINDS
        type_counts=dict(self.db.execute("SELECT e.kind,COUNT(*) " + self.base + " WHERE c.disposition NOT IN ('fixture','unadmitted','deleted') GROUP BY e.kind"))
        self.types = [{"id": kind, "count": type_counts.get(kind,0)} for kind in sorted((KINDS-{'key-point'})|set(type_counts))]
        self.type_ids = {t["id"] for t in self.types}
        self.vault_by_id = {v["id"]: v["name"] for v in self.vaults}
        self.vocabulary = Counter()
        self.vault_words = defaultdict(Counter)
        for row in self.db.execute("SELECT e.title,d.vault,d.role,e.kind " + self.base + " WHERE c.disposition NOT IN ('fixture','unadmitted','deleted')"):
            words = set(re.findall(r"[^\W\d_]{4,}", normalize_words(row[0] or "")))
            self.vocabulary.update(words)
            self.vault_words[(row[1], row[2] == "draft", row[3])].update(words)
        self.deletions = defaultdict(set)
        self.grams = defaultdict(set)
        for word in self.vocabulary:
            for key in {word} | {word[:i] + word[i+1:] for i in range(len(word))}:
                self.deletions[key].add(word)
            for i in range(len(word)-2):
                self.grams[word[i:i+3]].add(word)

    def _init_catalogs(self, production):
        labels=json.loads((self.root/'vaults.json').read_text()) if production and (self.root/'vaults.json').exists() else {}
        vault_counts=dict(self.db.execute("SELECT name,count FROM search_counts WHERE category='vault'"))
        self.vaults=[{"id":str(uuid.uuid5(uuid.NAMESPACE_URL,"knowledge-library-test-vault:"+name)),
                     "name":name,"label":labels.get(name,{}).get('name',name).replace('_',' '),"count":vault_counts.get(name,0)}
                    for name in sorted(set(vault_counts)|set(labels))]
        from crawl import KINDS
        type_counts=dict(self.db.execute("SELECT name,count FROM search_counts WHERE category='kind'"))
        self.types=[{"id":kind,"count":type_counts.get(kind,0)} for kind in sorted((KINDS-{'key-point'})|set(type_counts))]
        self.type_ids={t['id'] for t in self.types}
        self.vault_by_id={v['id']:v['name'] for v in self.vaults}

    @property
    def sources(self):
        if not hasattr(self,'_sources'):
            sql='SELECT d.vault,d.path,SUM(c.count) FROM document_counts c JOIN documents d ON d.id=c.document_id GROUP BY d.vault,d.path' if self.persisted else "SELECT d.vault,d.path,COUNT(*) "+self.base+" WHERE c.disposition NOT IN ('fixture','unadmitted','deleted') GROUP BY d.vault,d.path"
            self._sources=source_catalog(self.db.execute(sql),self.vaults,self.source_configs)
        return self._sources

    def set_reference_context(self,vault,path):
        """Add a real note's empty scopes without scanning or admitting anything."""
        if getattr(self,'_context_key',None)==(vault,path):return self.reference_context
        from source_catalog import reference_context
        if not any(v['name']==vault for v in self.vaults):
            self.vaults.append({'id':str(uuid.uuid5(uuid.NAMESPACE_URL,'knowledge-library-test-vault:'+vault)),
                               'name':vault,'label':vault.replace('_',' '),'count':0})
            self.vault_by_id={v['id']:v['name'] for v in self.vaults}
        context=reference_context(vault,path,self.vaults,self.source_configs)
        # Do not accumulate stale zero-count selectors as notes are switched.
        base=getattr(self,'_base_sources',None)
        if base is None:self._base_sources=base=list(self.sources)
        known={s['id']:s for s in base}
        for node in context['sources']:known.setdefault(node['id'],node)
        self._sources=list(known.values());self._source_by_id=known
        self.reference_context={k:known[v['id']] if isinstance(v,dict) and 'id' in v else v for k,v in context.items() if k!='sources'}
        self._context_key=(vault,path)
        return self.reference_context

    @property
    def source_by_id(self):
        if not hasattr(self,'_source_by_id'):
            self._source_by_id={s['id']:s for s in self.sources}
        return self._source_by_id

    def _persisted_spelling(self, word, scope, drafts, kinds, sources):
        if len(word)<4 or len(word)>40 or self.db.execute('SELECT 1 FROM words WHERE word=?',(word,)).fetchone():
            return (word,)
        candidates=set()
        for key in {word}|{word[:i]+word[i+1:] for i in range(len(word))}:
            candidates.update(r[0] for r in self.db.execute('SELECT word FROM spell_keys WHERE key=?',(key,)))
        if len(word)>=7:
            overlap=Counter()
            for i in range(len(word)-2):
                overlap.update(r[0] for r in self.db.execute('SELECT word FROM spell_grams WHERE gram=?',(word[i:i+3],)))
            candidates.update(w for w,_ in overlap.most_common(32))
        limit=2 if len(word)>=7 else 1
        # Count only candidate words in scope; never load all titles to fix one typo.
        where,params=self.scope_sql(scope,drafts,kinds,sources)
        ranked=[]
        for candidate in candidates:
            if abs(len(word)-len(candidate))>limit:continue
            distance=edit_distance(word,candidate)
            if distance>limit:continue
            count=self.db.execute('SELECT COUNT(*) FROM title_words tw JOIN entries e ON e.id=tw.entry_id '
                                  'JOIN documents d ON d.id=e.document_id JOIN cleanup c ON c.entry_id=e.id '
                                  'WHERE tw.word=? AND '+where,[candidate,*params]).fetchone()[0]
            if count:ranked.append((distance,-count,candidate))
        ranked.sort()
        return tuple(w for _,_,w in ranked[:1]) or (word,)

    def spelling_candidates(self, word, scope=None, drafts=False, kinds=None, sources=None):
        if self.persisted:
            return self._persisted_spelling(word,scope,drafts,kinds,sources)
        vocabulary = self.scope_vocabulary(scope, drafts, kinds, sources)
        if len(word) < 4 or len(word) > 40 or word in self.vocabulary:
            return (word,)
        candidates = set()
        for key in {word} | {word[:i] + word[i+1:] for i in range(len(word))}:
            candidates.update(self.deletions.get(key, ()))
        if len(word) >= 7:
            overlap = Counter()
            for i in range(len(word)-2):
                overlap.update(self.grams.get(word[i:i+3], ()))
            candidates.update(w for w, _ in overlap.most_common(32))
        limit = 2 if len(word) >= 7 else 1
        ranked = sorted((edit_distance(word, w), -vocabulary[w], w)
                        for w in candidates if w in vocabulary and abs(len(word)-len(w)) <= limit)
        return tuple(w for distance, _, w in ranked if distance <= limit)[:1] or (word,)

    def scope_vocabulary(self, scope, drafts, kinds, sources=None):
        result = Counter()
        if sources is not None:
            where,params=self.scope_sql(scope,drafts,kinds,sources)
            for row in self.db.execute('SELECT e.title '+self.base+' WHERE '+where,params):
                result.update(set(re.findall(r"[^\W\d_]{4,}",normalize_words(row[0] or ''))))
            return result
        names = set(self.vault_by_id.values()) if scope is None else set(scope)
        for (name, is_draft, kind), words in self.vault_words.items():
            if name in names and (drafts or not is_draft) and (kinds is None or kind in kinds):
                result.update(words)
        return result

    def resolve_scope(self, ids):
        if ids is None:
            return None
        if not isinstance(ids, list) or any(not isinstance(v, str) for v in ids):
            raise ValueError("Vault scope must be a list of vault IDs.")
        unknown = set(ids) - self.vault_by_id.keys()
        if unknown:
            raise ValueError("Selected vault is unavailable in this test library. Choose a scope again.")
        return tuple(sorted({self.vault_by_id[v] for v in ids}))

    def resolve_types(self, ids):
        if ids is None:
            return None
        if not isinstance(ids, list) or any(not isinstance(v, str) for v in ids) or set(ids)-self.type_ids:
            raise ValueError("Selected entry type is unavailable. Choose filters again.")
        return tuple(sorted(set(ids)))

    def resolve_sources(self, ids):
        if ids is None:return None
        if not isinstance(ids,list) or len(ids)>100 or any(not isinstance(i,str) for i in ids) or set(ids)-self.source_by_id.keys():
            raise ValueError('Selected source is unavailable. Choose book or chapter filters again.')
        return tuple(sorted(set(ids)))

    def scope_sql(self, scope, drafts, kinds=None, sources=None, suffix=""):
        e,d,c=(name+suffix for name in ("e","d","c"))
        params = []
        where = f"{c}.disposition NOT IN ('fixture','unadmitted','deleted') AND {d}.role!='snapshot'" + ("" if drafts else f" AND {d}.role!='draft'")
        if getattr(self,'excluded_reference_note',None):
            where+=f' AND NOT ({d}.vault=? AND {d}.path=?)'
            params.extend(self.excluded_reference_note)
        if kinds is not None:
            where += f" AND {e}.kind IN (" + ",".join("?" for _ in kinds) + ")" if kinds else " AND 0"
            params.extend(kinds)
        if sources is not None:
            conditions=[]
            for id in sources:
                source=self.source_by_id[id]
                if source['folder']:
                    prefix=source['path']+'/'
                    conditions.append(f'({d}.vault=? AND substr({d}.path,1,?)=?)');params.extend([source['vault'],len(prefix),prefix])
                else:
                    conditions.append(f'({d}.vault=? AND {d}.path=?)');params.extend([source['vault'],source['path']])
            where+=' AND ('+' OR '.join(conditions)+')' if conditions else ' AND 0'
        if scope is None:
            return where, params
        if not scope:
            return where + " AND 0", params
        return where + f" AND {d}.vault IN (" + ",".join("?" for _ in scope) + ")", [*params,*scope]

    def folded_rows(self, expression, where, scope_params, offset, size, other_where=None, selective=False):
        if self.persisted and not expression:
            return self._browse_rows(where,scope_params,offset,size,other_where,selective)
        if self.persisted:
            return self._search_rows(expression,where,scope_params,offset,size)
        # Folding is a display operation only. Every occurrence remains addressable.
        scope_where=where
        columns = "e.id,e.kind,e.title,e.body_sha256,d.vault,d.path,c.disposition,e.line_start,d.role,dg.display_key,"+("(e.parent IS NOT NULL)" if self.reviewed else "0")+" AS is_copy"
        source = self.base
        params = list(scope_params)
        score = "0.0"
        if expression:
            source += " JOIN search ON "+("search.rowid=e.rowid" if self.persisted else "search.entry_id=e.id")
            where += " AND search MATCH ?"
            params.append("{title body math} : (" + expression + ")")
            score = "bm25(search,0,8,3,0.1,1)"
        sql = """WITH matches AS MATERIALIZED (
            SELECT """ + columns + "," + score + " AS score " + source + " WHERE " + where + """
        ), ranked AS (
            SELECT *, COUNT(*) OVER family AS copies, MIN(score) OVER family AS best_score,
                ROW_NUMBER() OVER (PARTITION BY kind,display_key
                    ORDER BY is_copy,CASE role WHEN 'working' THEN 0 WHEN 'companion' THEN 1 WHEN 'source' THEN 2 ELSE 3 END,score,id) AS position
            FROM matches WINDOW family AS (PARTITION BY kind,display_key)
        ) SELECT id,kind,title,body_sha256,vault,path,disposition,line_start,copies,display_key
          FROM ranked WHERE position=1 ORDER BY best_score,(title=''),title COLLATE NOCASE,id LIMIT ? OFFSET ?"""
        rows=[dict(r) for r in self.db.execute(sql, [*params, size+1, offset])]
        if rows:
            keys=list({r['display_key'] for r in rows})
            counts=dict(self.db.execute("SELECT dg.display_key,COUNT(*) "+self.base+" WHERE "+scope_where+" AND dg.display_key IN ("+','.join('?' for _ in keys)+") GROUP BY dg.display_key",[*scope_params,*keys]))
            for row in rows:row['copies']=counts[row.pop('display_key')]
        return rows

    def _search_rows(self, expression, where, params, offset, size):
        # Keep exact old ranking, including every boundary tie. Stream matches
        # once instead of materializing and sorting three SQL windows. Work is
        # proportional to matches, not to all stored bodies; no top-K truncation.
        columns='e.id,e.kind,e.title,d.role,dg.display_key,'
        columns+=('(e.parent IS NOT NULL)' if self.reviewed else '0')+',bm25(search,0,8,3,0.1,1)'
        # FTS must drive this join. The bundled SQLite planner can otherwise start at
        # the kind index and repeat MATCH for every entry of that kind.
        source=(' FROM search CROSS JOIN entries e ON e.rowid=search.rowid '
                'JOIN documents d ON d.id=e.document_id JOIN cleanup c ON c.entry_id=e.id '
                'JOIN display_groups dg ON dg.entry_id=e.id ')
        sql='SELECT '+columns+source+' WHERE '+where+' AND search MATCH ?'
        families={};priorities={'working':0,'companion':1,'source':2}
        def candidates():
            yield from self.db.execute(sql,[*params,'{title body math} : ('+expression+')'])
            tags=getattr(self,'tag_search',None)
            if tags:
                for identity,score in tags.matches(expression):
                    row=self.db.execute('SELECT e.id,e.kind,e.title,d.role,dg.display_key,'+
                        ('(e.parent IS NOT NULL)' if self.reviewed else '0')+' '+self.base+
                        ' WHERE '+where+' AND e.id=?',[*params,identity]).fetchone()
                    if row:yield (*row,score)
        for row in candidates():
            key=(row[1],row[4]);score=row[6]
            rank=(row[5],priorities.get(row[3],3),score,row[0])
            family=families.get(key)
            if family is None:
                families[key]=[score,rank,row]
            else:
                if score<family[0]:family[0]=score
                if rank<family[1]:family[1:]=[rank,row]
        # SQLite NOCASE folds ASCII only. Python casefold would change ordering.
        lower=str.maketrans('ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
        def order(family):
            row=family[2];title=row[2]
            return (family[0],-1 if title is None else int(title==''),'' if title is None else title.translate(lower),row[0])
        page=heapq.nsmallest(offset+size+1,families.values(),key=order)[offset:]
        rows=[]
        for _,_,row in page:
            result=dict(self.db.execute('SELECT e.id,e.kind,e.title,e.body_sha256,d.vault,d.path,c.disposition,e.line_start '+
                                       self.base+' WHERE e.id=?',(row[0],)).fetchone())
            result['copies']=self._family_count(where,params,row[4])
            rows.append(result)
        return rows

    @property
    def family_base(self):
        return ('FROM display_groups dg INDEXED BY display_groups_key CROSS JOIN entries e ON e.id=dg.entry_id '
                'JOIN documents d ON d.id=e.document_id JOIN cleanup c ON c.entry_id=e.id')

    def _family_count(self,where,params,key):
        return self.db.execute('SELECT COUNT(*) '+self.family_base+' WHERE dg.display_key=? AND '+where,[key,*params]).fetchone()[0]

    def _browse_rows(self, where, params, offset, size, other, selective):
        # Walk title order and reject non-representatives using the family index.
        # This preserves scope-dependent representatives without sorting the store.
        role=lambda alias:"CASE "+alias+".role WHEN 'working' THEN 0 WHEN 'companion' THEN 1 WHEN 'source' THEN 2 ELSE 3 END"
        copy=lambda alias:'('+alias+'.parent IS NOT NULL)' if self.reviewed else '0'
        source=self.base if selective else self.base.replace('FROM entries e ', 'FROM entries e INDEXED BY entries_browse ')
        sql=('SELECT e.id,e.kind,e.title,e.body_sha256,d.vault,d.path,c.disposition,e.line_start,dg.display_key '+source+
             ' WHERE '+where+' AND NOT EXISTS (SELECT 1 FROM display_groups dg2 INDEXED BY display_groups_key '
             'CROSS JOIN entries e2 ON e2.id=dg2.entry_id JOIN documents d2 ON d2.id=e2.document_id '
             'JOIN cleanup c2 ON c2.entry_id=e2.id WHERE dg2.display_key=dg.display_key AND e2.kind=e.kind AND '+other+
             ' AND ('+copy('e2')+','+role('d2')+',e2.id)<('+copy('e')+','+role('d')+',e.id)) '
             "ORDER BY (e.title=''),e.title COLLATE NOCASE,e.id LIMIT ? OFFSET ?")
        rows=[dict(r) for r in self.db.execute(sql,[*params,*params,size+1,offset])]
        for row in rows:
            row['copies']=self._family_count(where,params,row.pop('display_key'))
        return rows

    def alternatives(self, term, scope=None, drafts=False, kinds=None, sources=None):
        # Literal phrases and mathematical symbols must not be silently corrected.
        if any(c in term for c in '\\$"_^'):
            return []
        words = re.findall(r"\w+", normalize_words(term))
        if not words or len(words) > 10:
            return []
        choices = [self.spelling_candidates(w, scope, drafts, kinds, sources) for w in words]
        result = []
        for candidate in product(*choices):
            if list(candidate) != words:
                result.append(" ".join(candidate))
            if len(result) >= 4:
                break
        return result

    def handle(self, request):
        start = time.perf_counter()
        exclude=getattr(self,'_context_key',None) if request.get('referencePath') and request.get('op','search')=='search' else None
        if exclude!=getattr(self,'excluded_reference_note',None):
            self.excluded_reference_note=exclude
            self.spelling_candidates.cache_clear();self.scope_vocabulary.cache_clear()
        if request.get("profile") and request["profile"] != self.meta["profile"]:
            raise ValueError("Profile changed. Reopen the browser.")
        op = request.get("op", "search")
        scope = self.resolve_scope(request.get("vaultIds"))
        kinds = self.resolve_types(request.get("types"))
        sources = self.resolve_sources(request.get("sourceIds"))
        where, scope_params = self.scope_sql(scope, bool(request.get("drafts")), kinds, sources)
        base_where=where
        if request.get('entryIds') is not None:
            ids=request['entryIds']
            if len(ids)>10000:raise ValueError('Narrow the tag filter before searching')
            where+=' AND e.id IN ('+','.join('?' for _ in ids)+')' if ids else ' AND 0'
            scope_params.extend(ids)
        if request.get('books'):
            where+=' AND ('+' OR '.join('instr(lower(d.path),lower(?))>0' for _ in request['books'])+')';scope_params.extend(request['books'])
        for field in ('book','chapter'):
            if request.get(field):
                where+=' AND instr(lower(d.path),lower(?))>0';scope_params.append(request[field])

        if op == "catalog":
            previous = request.get("previousProfile")
            vaults = [{**v, "legacyId": str(uuid.uuid5(uuid.NAMESPACE_URL, str(previous) + ":vault:" + v["name"]))} for v in self.vaults]
            result = {"vaults": vaults, "types": self.types, "sources":self.sources}
            if request.get('referencePath') is not None:result['referenceContext']=self.reference_context
        elif op == "copies":
            seed = self.db.execute("SELECT dg.display_key,e.id " + self.base + " WHERE " + where + " AND e.id=?", [*scope_params, request["id"]]).fetchone()
            if seed is None:
                raise ValueError("Entry is unavailable in the selected scope.")
            condition = "dg.display_key=?"
            values = [seed["display_key"]]
            rows = self.db.execute("SELECT e.id,d.vault,d.path,e.line_start " + self.family_base + " WHERE " + where + " AND " + condition + " ORDER BY d.vault,d.path,e.id LIMIT 201", [*scope_params,*values]).fetchall()
            result = {"rows": [dict(r) for r in rows[:200]], "more": len(rows)>200}
        elif op == "detail":
            row = self.db.execute("SELECT e.*,d.vault,d.path,c.reasons,c.disposition " + self.base +
                                  " WHERE " + where + " AND e.id=?", [*scope_params, request["id"]]).fetchone()
            if row is None:
                raise ValueError("Entry is unavailable in this profile.")
            result = dict(row)
        elif op == "search":
            total=sum(v['count'] for v in self.vaults)
            counts=[total]
            if scope is not None:counts.append(sum(v['count'] for v in self.vaults if v['name'] in scope))
            if kinds is not None:counts.append(sum(t['count'] for t in self.types if t['id'] in kinds))
            if sources is not None:counts.append(sum(self.source_by_id[s]['count'] for s in sources))
            # Tiny scopes benefit from filtering then sorting. Broad scopes
            # should take the first page directly from the ordered index.
            selective=bool(request.get('entryIds') is not None or request.get('book') or request.get('books') or request.get('chapter')) or min(counts)<=min(2000,max(32,total//100))
            other_where=self.scope_sql(scope, bool(request.get('drafts')), kinds, sources, suffix='2')[0]+where[len(base_where):].replace('e.id','e2.id').replace('d.path','d2.path')
            terms = split_queries(request.get("query", ""))
            default_offset = max(0, min(int(request.get("offset", 0)), 10000))
            size = max(1,min(100,int(request.get("limit",16))))
            groups = []
            for group_index, term in enumerate(terms or [""]):
                offsets = request.get("offsets", {})
                offset = max(0, min(int(offsets.get(str(group_index), default_offset)), 10000))
                if term.startswith('$') and term.endswith('$'):
                    from formula_search import expression as formula_expression, literal
                    expr=formula_expression(term)
                    rows=[]
                    if expr:
                        # FTS rank streams top matches; a global custom sort would
                        # materialize every matching formula before returning five rows.
                        base=('SELECT e.id,e.kind,e.title,e.body_sha256,d.vault,d.path,c.disposition,e.line_start '
                              'FROM formula_search CROSS JOIN entries e ON e.rowid=formula_search.rowid '
                              'JOIN documents d ON d.id=e.document_id JOIN cleanup c ON c.entry_id=e.id '
                              'JOIN formula_rows fr ON fr.row_id=e.rowid WHERE '+where+' AND formula_search MATCH ?')
                        # Both buckets use the same normalized token match. Raw
                        # FTS treats x_1y_1 and x_1 y_1 differently even though the
                        # whitespace-free literal filter considers them identical.
                        exact=[dict(r) for r in self.db.execute(base+' AND instr(fr.literal,?)>0 ORDER BY formula_search.rank LIMIT ?',[*scope_params,'tokens:'+expr,literal(term),offset+size+1])]
                        rows=exact[offset:offset+size+1]
                        if len(rows)<size+1:
                            rows += [dict(r) for r in self.db.execute(base+' AND instr(fr.literal,?)=0 ORDER BY formula_search.rank LIMIT ? OFFSET ?',[*scope_params,'tokens:'+expr,literal(term),size+1-len(rows),max(0,offset-len(exact))])]
                        for row in rows:row.pop('body',None);row['copies']=1
                    groups.append({'term':term,'rows':rows[:size],'more':len(rows)>size,'offset':offset,'match':'formula','matchedQueries':[]})
                    continue
                expression = search_expression(term)
                if term and not expression:
                    groups.append({"term": term, "rows": [], "more": False, "offset": offset})
                    continue
                fetched={}
                def fetch(expr, page_offset):
                    key=(expr,page_offset)
                    if key not in fetched:fetched[key]=self.folded_rows(expr, where, scope_params, page_offset, size, other_where,selective)
                    return fetched[key]
                matched = []
                prefix_used = False
                partial_used = False
                if expression:
                    rows = fetch(expression, offset)
                    # Exhausting a later page is not a spelling failure.
                    exact_exists = bool(rows) or (offset > 0 and bool(fetch(expression, 0)))
                    if not exact_exists and not any(c in term for c in '\\$"_^'):
                        tokens = re.findall(r"\w+", normalize_words(term))
                        if tokens and len(tokens[-1]) >= 3:
                            prefix_rows = fetch(expression + "*", 0)
                            if prefix_rows:
                                rows = fetch(expression + "*", offset) if offset else prefix_rows
                                exact_exists = True
                                prefix_used = True
                    if not exact_exists:
                        alternatives = self.alternatives(term, scope, bool(request.get("drafts")), kinds, sources)
                        matched = [q for q in alternatives if fetch(search_expression(q), 0)]
                        if matched:
                            fallback = search_expression(matched[0]) if len(matched)==1 else " OR ".join("(" + search_expression(q) + ")" for q in matched)
                            rows = fetch(fallback, offset)
                    if not exact_exists and not matched and not any(c in term for c in '\\$"_^'):
                        atoms=expression.split(' AND ')
                        if len(atoms)>1:
                            partial=' OR '.join(atoms)
                            if fetch(partial,0):rows=fetch(partial,offset);partial_used=True
                else:
                    rows = fetch(None, offset)
                groups.append({"term": term, "rows": rows[:size], "more": len(rows) > size,
                               "match": "partial" if partial_used else "approximate" if matched else "prefix" if prefix_used else "exact", "matchedQueries": matched, "offset": offset})
            result = {"groups": groups, "offset": default_offset, "pageSize": size}
        else:
            raise ValueError("Unknown operation.")
        return {"profile": self.meta["profile"], "mode": self.meta["mode"], "data": result,
                "sqlMs": round((time.perf_counter() - start) * 1000, 3)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True)
    args = ap.parse_args()
    library = Library(args.corpus)
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            result = library.handle(request)
            response = {"requestId": request.get("requestId"), **result}
        except Exception as exc:
            response = {"requestId": request.get("requestId"), "error": str(exc)}
        print(json.dumps(response, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
