"""Small process-local FTS supplement for tagged admitted entries.

Only tagged bodies are indexed here. Registry revisions invalidate changed rows;
the durable library and identity journals remain authoritative.
"""
import sqlite3

class TagSearch:
    def __init__(self):
        self.db=sqlite3.connect(':memory:');self.rows={};self.generation=None
        self.db.execute('CREATE VIRTUAL TABLE tags USING fts5(id UNINDEXED,title,body,tag_text)')
    def __del__(self):
        if hasattr(self,"db"):self.db.close()
    def sync(self,live):
        registry=live.component_registry();registry.load()
        generation=(registry.sequence,live.store.sequence)
        if self.generation==generation:return
        current={id:(entry['title'],entry['body'],' '.join(registry.entities.get(id,{}).get('tags',[])))
                 for id,entry in live.store.entries.items() if registry.entities.get(id,{}).get('tags')}
        for id in self.rows.keys()|current.keys():
            if self.rows.get(id)==current.get(id):continue
            self.db.execute('DELETE FROM tags WHERE id=?',(id,))
            if id in current:self.db.execute('INSERT INTO tags VALUES(?,?,?,?)',(id,*current[id]))
        self.db.commit();self.rows=current;self.generation=generation
    def matches(self,expression):
        return self.db.execute('SELECT id,bm25(tags,0,8,3,3) FROM tags WHERE tags MATCH ?',(expression,))
