"""Disposable, transaction-owned search data. Never edits notes or the journal.

Call refresh after primary rows have changed, in the same transaction. The old
facts and name rows identify dependencies even after a deletion or rename.
"""
import posixpath
import re
import unicodedata
from pathlib import PurePosixPath
from display_groups import display_key, links

SCHEMA = 7
EXCLUDED = {'fixture', 'unadmitted', 'deleted'}


def normalize_words(text):
    text = unicodedata.normalize('NFKC', text).casefold().replace('’', "'")
    return re.sub(r"(?<=\w)'s\b", '', text)


def words(title):
    return set(re.findall(r'[^\W\d_]{4,}', normalize_words(title or '')))


def create(db):
    # execute individually: executescript would commit the caller's transaction.
    for sql in (
        'CREATE VIRTUAL TABLE formula_search USING fts5(entry_id UNINDEXED, tokens, raw)',
        'CREATE TABLE formula_rows(entry_id TEXT PRIMARY KEY, row_id INTEGER UNIQUE, literal TEXT)',
        'CREATE TABLE display_groups(entry_id TEXT PRIMARY KEY, display_key TEXT, base_key TEXT)',
        'CREATE INDEX display_groups_key ON display_groups(display_key)',
        'CREATE TABLE document_names(document_id TEXT, vault TEXT, name TEXT, path TEXT, PRIMARY KEY(document_id,name))',
        'CREATE INDEX document_names_lookup ON document_names(vault,name)',
        'CREATE TABLE link_dependencies(entry_id TEXT, vault TEXT, target TEXT, PRIMARY KEY(entry_id,vault,target))',
        'CREATE INDEX link_dependencies_target ON link_dependencies(vault,target)',
        'CREATE TABLE entry_facts(entry_id TEXT PRIMARY KEY, vault TEXT, kind TEXT, active INTEGER, document_id TEXT)',
        'CREATE TABLE document_counts(document_id TEXT PRIMARY KEY, count INTEGER)',
        'CREATE TABLE search_counts(category TEXT, name TEXT, count INTEGER, PRIMARY KEY(category,name))',
        'CREATE TABLE title_words(entry_id TEXT, word TEXT, PRIMARY KEY(entry_id,word))',
        'CREATE INDEX title_words_word ON title_words(word,entry_id)',
        'CREATE TABLE words(word TEXT PRIMARY KEY, count INTEGER)',
        'CREATE TABLE spell_keys(key TEXT, word TEXT, PRIMARY KEY(key,word))',
        'CREATE INDEX spell_keys_word ON spell_keys(word)',
        'CREATE TABLE spell_grams(gram TEXT, word TEXT, PRIMARY KEY(gram,word))',
        'CREATE INDEX spell_grams_word ON spell_grams(word)',
        'CREATE INDEX IF NOT EXISTS entries_document ON entries(document_id)',
        'CREATE INDEX IF NOT EXISTS entries_kind ON entries(kind)',
        'CREATE INDEX IF NOT EXISTS documents_location ON documents(vault,path)',
        'CREATE INDEX IF NOT EXISTS entries_parent ON entries(parent)',
        "CREATE INDEX IF NOT EXISTS entries_browse ON entries((title=''),title COLLATE NOCASE,id)",
    ):
        db.execute(sql)


class Names:
    def __init__(self, db):
        self.db, self.cache = db, {}

    def get(self, key, default=None):
        if key not in self.cache:
            self.cache[key] = {r[0] for r in self.db.execute(
                'SELECT path FROM document_names WHERE vault=? AND name=?', key)}
        return self.cache[key] or default


def _count(db, category, name, delta):
    db.execute('INSERT INTO search_counts VALUES(?,?,?) ON CONFLICT(category,name) '
               'DO UPDATE SET count=count+excluded.count', (category, name, delta))
    db.execute('DELETE FROM search_counts WHERE category=? AND name=? AND count=0', (category, name))


def _word_delta(db, word, delta):
    previous = db.execute('SELECT count FROM words WHERE word=?', (word,)).fetchone()
    count = (previous[0] if previous else 0) + delta
    if count <= 0:
        db.execute('DELETE FROM words WHERE word=?', (word,))
        db.execute('DELETE FROM spell_keys WHERE word=?', (word,))
        db.execute('DELETE FROM spell_grams WHERE word=?', (word,))
    else:
        db.execute('INSERT INTO words VALUES(?,?) ON CONFLICT(word) DO UPDATE SET count=excluded.count', (word, count))
        if not previous:
            db.executemany('INSERT INTO spell_keys VALUES(?,?)',
                           ((key, word) for key in {word} | {word[:i] + word[i+1:] for i in range(len(word))}))
            db.executemany('INSERT INTO spell_grams VALUES(?,?)',
                           ((gram, word) for gram in {word[i:i+3] for i in range(len(word)-2)}))


def refresh(db, entry_ids, document_ids=()):
    """Recompute changed entries, link dependents and copy descendants only.

    Return work counts for tests/benchmarks; neither count is a release claim.
    """
    affected = set(entry_ids)
    for document_id in set(document_ids):
        old = list(db.execute('SELECT vault,name FROM document_names WHERE document_id=?', (document_id,)))
        row = db.execute('SELECT vault,path FROM documents WHERE id=?', (document_id,)).fetchone()
        new = {(row[0], row[1].removesuffix('.md')), (row[0], PurePosixPath(row[1]).stem)} if row else set()
        if set(map(tuple, old)) != new:
            # A newly ambiguous basename can change a pre-existing link's key.
            for key in set(map(tuple, old)) | new:
                affected.update(r[0] for r in db.execute(
                    'SELECT entry_id FROM link_dependencies WHERE vault=? AND target=?', key))
            affected.update(r[0] for r in db.execute('SELECT id FROM entries WHERE document_id=?', (document_id,)))
            db.execute('DELETE FROM document_names WHERE document_id=?', (document_id,))
            if row:
                db.executemany('INSERT INTO document_names VALUES(?,?,?,?)',
                               ((document_id, vault, name, row[1]) for vault, name in new))

    names = Names(db)
    def document_count(document_id,delta):
        db.execute('INSERT INTO document_counts VALUES(?,?) ON CONFLICT(document_id) DO UPDATE SET count=count+excluded.count',(document_id,delta))
        db.execute('DELETE FROM document_counts WHERE document_id=? AND count=0',(document_id,))
    # Clear old rowids for the whole changed batch before any rowid is reused.
    for entry_id in affected:
        prior=db.execute('SELECT row_id FROM formula_rows WHERE entry_id=?',(entry_id,)).fetchone()
        if prior:db.execute('DELETE FROM formula_search WHERE rowid=?',(prior[0],))
        db.execute('DELETE FROM formula_rows WHERE entry_id=?',(entry_id,))
    for entry_id in affected:
        from formula_search import projection,literal,fragments
        formula_row=db.execute('SELECT rowid,body FROM entries WHERE id=?',(entry_id,)).fetchone()
        if formula_row:
            db.execute('INSERT INTO formula_search(rowid,entry_id,tokens,raw) VALUES(?,?,?,?)',(formula_row[0],entry_id,projection(formula_row[1]),' '.join(next((x for x in group if x),'') for group in fragments(formula_row[1]))))
            db.execute('INSERT INTO formula_rows VALUES(?,?,?)',(entry_id,formula_row[0],literal(formula_row[1])))
        old = db.execute('SELECT vault,kind,active,document_id FROM entry_facts WHERE entry_id=?', (entry_id,)).fetchone()
        if old and old[2]:
            _count(db, 'vault', old[0], -1)
            _count(db, 'kind', old[1], -1)
            document_count(old[3],-1)
        previous_words = {r[0] for r in db.execute('SELECT word FROM title_words WHERE entry_id=?', (entry_id,))}
        row = db.execute('SELECT e.kind,e.title,e.body,d.vault,d.path,c.disposition,e.document_id '
                         'FROM entries e JOIN documents d ON e.document_id=d.id '
                         'JOIN cleanup c ON c.entry_id=e.id WHERE e.id=?', (entry_id,)).fetchone()
        current_words = words(row[1]) if row and row[5] not in EXCLUDED else set()
        for word in previous_words - current_words:
            db.execute('DELETE FROM title_words WHERE entry_id=? AND word=?', (entry_id, word))
            _word_delta(db, word, -1)
        for word in current_words - previous_words:
            db.execute('INSERT INTO title_words VALUES(?,?)', (entry_id, word))
            _word_delta(db, word, 1)
        db.execute('DELETE FROM link_dependencies WHERE entry_id=?', (entry_id,))
        if row is None:
            db.execute('DELETE FROM display_groups WHERE entry_id=?', (entry_id,))
            db.execute('DELETE FROM entry_facts WHERE entry_id=?', (entry_id,))
            continue
        kind, title, body, vault, path, disposition, document_id = row
        active = disposition not in EXCLUDED
        db.execute('INSERT OR REPLACE INTO entry_facts VALUES(?,?,?,?,?)', (entry_id, vault, kind, active,document_id))
        if active:
            _count(db, 'vault', vault, 1)
            _count(db, 'kind', kind, 1)
            document_count(document_id,1)
        key = display_key(kind, title, body, vault, path, names)
        db.execute('INSERT OR REPLACE INTO display_groups VALUES(?,?,?)', (entry_id, key, key))
        targets = set()
        for raw in links(body):
            if re.match(r'^\w+://', raw):
                continue
            target = raw.partition('#')[0]
            if target:
                targets.add(target.removesuffix('.md'))
                targets.add(posixpath.normpath((PurePosixPath(path).parent / target).as_posix()).removesuffix('.md'))
        db.executemany('INSERT INTO link_dependencies VALUES(?,?,?)', ((entry_id, vault, target) for target in targets))

    # A source revision can split an otherwise unchanged chain of owned copies.
    families, pending = set(affected), list(affected)
    while pending:
        parent = pending.pop()
        for (child,) in db.execute('SELECT id FROM entries WHERE parent=?', (parent,)):
            if child not in families:
                families.add(child)
                pending.append(child)
    cache = {}

    def entry(entry_id):
        if entry_id not in cache:
            cache[entry_id] = db.execute('SELECT e.parent,e.body_sha256,e.copy_body_hash,e.parent_body_hash,dg.base_key '
                                        'FROM entries e JOIN display_groups dg ON dg.entry_id=e.id WHERE e.id=?', (entry_id,)).fetchone()
        return cache[entry_id]

    for entry_id in families:
        current = entry(entry_id)
        if current is None:
            continue
        seen = set()
        cursor = entry_id
        while current[0] and current[0] not in seen:
            parent = entry(current[0])
            if parent is None or current[1] != current[2] or parent[1] != current[3]:
                break
            seen.add(cursor)
            cursor, current = current[0], parent
        db.execute('UPDATE display_groups SET display_key=? WHERE entry_id=?', (current[4], entry_id))
    return {'entries': len(affected), 'families': len(families)}


def rebuild(db):
    create(db)
    return refresh(db, (r[0] for r in db.execute('SELECT id FROM entries')),
                   (r[0] for r in db.execute('SELECT id FROM documents')))
