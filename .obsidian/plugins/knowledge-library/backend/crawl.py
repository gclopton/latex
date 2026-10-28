#!/usr/bin/env python3
"""Read-only vault crawl into an isolated, explicitly unapproved test corpus."""
import argparse
import collections
import hashlib
import json
import re
import sqlite3
import subprocess
import time
import uuid
import posixpath
from urllib.parse import unquote
from pathlib import Path
from callout_labels import parse_label, body_title, ALIASES

KINDS = {
    "definition", "theorem", "corollary", "lemma", "proposition", "equation",
    "identity", "relation", "assumption", "rule", "convention", "axiom",
    "postulate", "result", "key-point", "notation", "table", "law", "principle",
    "property", "formula", "figure",
}
CALLOUT = re.compile(r"^\s*(?:>\s*)+\[!([\w-]+)(?:\|[^\]\n]*)?\][+-]?\s*(.*)$", re.I)
BLOCK = re.compile(r"(?:^|\s)\^([A-Za-z0-9-]+)\s*$")
WIKI = re.compile(r"(?<!!)\[\[([^]\n]+)\]\]")
FENCE = re.compile(r"^\s*(`{3,}|~{3,})(.*)$")


def digest(s):
    return hashlib.sha256(s.encode() if isinstance(s, str) else s).hexdigest()


def ident(*parts):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "\0".join(parts)))


def role(path):
    s = path.lower()
    if any(x in s for x in ("snapshot", "review checkpoint", "backup", "original copy", "/revisions/", "before ")):
        return "snapshot"
    if any(x in s for x in ("style guide/", "scripts/", "tools/", "templates/")) or Path(s).name in ("agents.md", "skill.md") or re.search(r"\b(quiz|quizzes)\b", Path(s).stem):
        return "support"
    if re.search(r"\bdraft\s+\d+\b", Path(s).name) or (re.search(r"\b1[a-g](?:\W|_)", Path(s).name) and "final draft" not in s):
        return "draft"
    if any(x in Path(s).name for x in ("definitions", "glossary", "index", "theorems", "notation")):
        return "companion"
    if any(x in s for x in ("original markdown/", "source archive/", "markdown_originals/")):
        return "source"
    return "working"


def math_search(s):
    # Retrieval-only representation. Never used for identity or equivalence.
    s = re.sub(r"\\(?:left|right|displaystyle)\b", "", s)
    s = re.sub(r"\\(?:dfrac|tfrac)\b", r"\\frac", s)
    return re.sub(r"[{}$\\_^]", " ", s)


def source_lines(text):
    # Match editor line numbering: CR/LF break lines; form feeds/Unicode separators do not.
    return re.findall(r'[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$',text)


def extract(text, path):
    lines = source_lines(text)
    i, heading, occupied = 0, "", set()
    while i < len(lines):
        line = lines[i]
        if line.startswith("#"):
            heading = line.lstrip("#").strip()
        f = FENCE.match(line)
        if f:
            end = i + 1
            while end < len(lines) and not re.match(r"^\s*" + re.escape(f[1][0]) + "{" + str(len(f[1])) + r",}\s*$", lines[end]):
                end += 1
            end = min(end + 1, len(lines))
            occupied.update(range(i, end))
            i = end
            continue
        m = CALLOUT.match(line)
        if m:
            end = i + 1
            depth = line.split("[!", 1)[0].count(">")
            # Only quoted lines belong to this callout. Unquoted blanks terminate it.
            while end < len(lines):
                next_callout = CALLOUT.match(lines[end])
                if next_callout and lines[end].split("[!", 1)[0].count(">") <= depth:
                    break
                if lines[end].lstrip().startswith(">"):
                    end += 1
                else:
                    break
            style = m[1].lower()
            title = m[2].strip().lstrip("-").strip()
            label = parse_label(style, title)
            if ALIASES.get(style, style) in KINDS or label['kind'] in KINDS:
                authored_title = title or body_title(lines[i+1:end], style)
                kind = parse_label(style, authored_title or '')['kind']
                entry=make_record(lines, i, end, kind, authored_title or heading, "callout:" + style)
                if ALIASES.get(style,style) not in KINDS:
                    entry['reviewWarning']='Styled as '+style+'; verify that this is a reusable '+kind
                yield entry
            occupied.update(range(i, end))
            i = end
            continue
        # User's admission boundary is callouts only. Do not extract standalone
        # equations, tables, headings or prose as entries.
        i += 1


def make_record(lines, start, end, kind, title, syntax):
    before = "".join(lines[max(0, start - 8):start])
    after_lines = []
    for line in lines[end:min(len(lines), end + 40)]:
        callout = CALLOUT.match(line)
        # Retain adjacent qualifying notes as evidence, not additional entries.
        if (callout and callout[1].lower() not in ("note", "warning", "important")) or line.lstrip().startswith("#"):
            break
        after_lines.append(line)
    after = "".join(after_lines)
    body = "".join(lines[start:end])
    # Nearby context is evidence to review, never silently part of the statement.
    return dict(kind=kind, title=title, syntax=syntax, line_start=start + 1,
                line_end=end, body=body, context_before=before,
                context_after=after, body_sha256=digest(body))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault-root", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--snapshot-corpus", type=Path, help="Re-extract a previous frozen capture without rereading live notes")
    args = ap.parse_args()
    root, out = args.vault_root.resolve(), args.output.resolve()
    if out == root or root in out.parents:
        raise SystemExit("Test output must be outside the source vault tree")
    if out.exists():
        raise SystemExit("Use a fresh test output directory")
    out.mkdir(parents=True)
    snapshots = out / "snapshots"
    snapshots.mkdir()
    profile = "test-" + str(uuid.uuid4())
    started = time.perf_counter()
    db = sqlite3.connect(out / "test.sqlite")
    db.executescript("""
    PRAGMA journal_mode=WAL;
    CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE documents(id TEXT PRIMARY KEY,vault TEXT,path TEXT,role TEXT,
        sha256 TEXT,snapshot TEXT,bytes INTEGER,mtime_ns INTEGER);
    CREATE TABLE entries(id TEXT PRIMARY KEY,document_id TEXT,kind TEXT,title TEXT,
        syntax TEXT,line_start INTEGER,line_end INTEGER,body TEXT,
        context_before TEXT,context_after TEXT,body_sha256 TEXT,status TEXT);
    CREATE TABLE groups(id TEXT PRIMARY KEY,kind TEXT,label TEXT);
    CREATE TABLE memberships(group_id TEXT,entry_id TEXT,PRIMARY KEY(group_id,entry_id));
    CREATE TABLE edges(source_id TEXT,target_id TEXT,kind TEXT,evidence TEXT,status TEXT,
        PRIMARY KEY(source_id,target_id,kind,evidence));
    CREATE TABLE unresolved(source_id TEXT,target_text TEXT,kind TEXT,reason TEXT);
    CREATE VIRTUAL TABLE search USING fts5(entry_id UNINDEXED,title,body,context,math);
    CREATE INDEX document_vault ON documents(vault);
    CREATE INDEX entry_document ON entries(document_id);
    CREATE INDEX entry_kind ON entries(kind);
    CREATE INDEX edge_source ON edges(source_id);
    CREATE INDEX edge_target ON edges(target_id);
    """)
    db.executemany("INSERT INTO meta VALUES(?,?)", [
        ("profile", profile), ("mode", "TEST_ONLY_UNREVIEWED"),
        ("production_approvals", "0"), ("source_root", str(root)),
    ])
    frozen = {}
    if args.snapshot_corpus:
        for line in (args.snapshot_corpus / "documents.jsonl").read_text().splitlines():
            d = json.loads(line)
            frozen[str(root / d["vault"] / d["path"])] = d
        paths = list(frozen)
    else:
        paths = subprocess.check_output(
            ["rg", "--files", "--hidden", str(root), "-g", "*.md", "-g", "!**/.*/**"],
            text=True).splitlines()
    docs, entries, errors, names, body_groups, title_groups, blocks = [], [], [], collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list), {}
    with (out / "candidates.jsonl").open("w") as jsonl:
        for n, path in enumerate(paths):
            p = Path(path)
            try:
                rel = p.relative_to(root)
                if len(rel.parts) < 2:
                    continue
                # Never follow a symlink out of the requested source tree.
                if not frozen and root not in p.resolve().parents:
                    errors.append({"path": path, "reason": "symlink outside source root"})
                    continue
                if frozen:
                    old = frozen[path]
                    raw = (args.snapshot_corpus / old["snapshot"]).read_bytes()
                    if digest(raw) != old["sha256"]:
                        raise ValueError("Frozen snapshot checksum mismatch")
                    mtime_ns = old["mtime_ns"]
                else:
                    st = p.stat()
                    raw = p.read_bytes()
                    if p.stat().st_mtime_ns != st.st_mtime_ns:
                        errors.append({"path": path, "reason": "changed during snapshot"})
                        continue
                    mtime_ns = st.st_mtime_ns
                text = raw.decode("utf-8-sig")
                h = digest(raw)
                snap = snapshots / (h + ".md")
                if not snap.exists():
                    snap.write_bytes(raw)
                vault, local = rel.parts[0], Path(*rel.parts[1:]).as_posix()
                did = ident(profile, vault, local)
                doc = dict(id=did, vault=vault, path=local, role=role(local), sha256=h,
                           snapshot=str(snap.relative_to(out)), bytes=len(raw), mtime_ns=mtime_ns)
                docs.append(doc)
                names[(vault, local.removesuffix(".md"))].append(did)
                names[(vault, Path(local).stem)].append(did)
                db.execute("INSERT INTO documents VALUES(:id,:vault,:path,:role,:sha256,:snapshot,:bytes,:mtime_ns)", doc)
                recs = []
                for e in extract(text, local):
                    e.update(id=ident(profile, did, str(e["line_start"]), e["body_sha256"]), document_id=did, status="test-unreviewed")
                    db.execute("INSERT INTO entries VALUES(:id,:document_id,:kind,:title,:syntax,:line_start,:line_end,:body,:context_before,:context_after,:body_sha256,:status)", e)
                    db.execute("INSERT INTO search VALUES(?,?,?,?,?)", (e["id"], e["title"], e["body"], e["context_before"] + e["context_after"], math_search(e["body"])))
                    jsonl.write(json.dumps({**e, "vault": vault, "path": local, "role": doc["role"]}, ensure_ascii=False) + "\n")
                    entries.append((e, doc))
                    recs.append(e)
                    body_groups[e["body_sha256"]].append(e["id"])
                    title = re.sub(r"^(?:definition|theorem|result|corollary|lemma|proposition|equation)\s*[\d.]+[:.)\s-]*", "", e["title"], flags=re.I).strip().casefold()
                    if title and e["syntax"].startswith("callout"):
                        title_groups[(e["kind"], title)].append(e["id"])
                # Block IDs are document-local and must be unique within that document.
                for i, line in enumerate(source_lines(text), 1):
                    m = BLOCK.search(line)
                    if not m:
                        continue
                    candidates = [e for e in recs if e["line_start"] <= i <= e["line_end"] + 2]
                    key = (did, m[1])
                    value = candidates[-1]["id"] if candidates else did
                    blocks[key] = None if key in blocks else value
            except (OSError, UnicodeError) as exc:
                errors.append({"path": path, "reason": str(exc)})
            if n % 2000 == 0:
                db.commit()
                print(f"Scanned {n}/{len(paths)} files; extracted {len(entries)} candidates", flush=True)
        db.commit()
    # Literal clusters are navigation aids, not semantic merges.
    for kind, mapping in (("identical-source-text", body_groups), ("same-title-suggestion", title_groups)):
        for label, ids in mapping.items():
            if len(ids) < 2:
                continue
            label = str(label)
            gid = ident(profile, kind, label)
            db.execute("INSERT INTO groups VALUES(?,?,?)", (gid, kind, label))
            db.executemany("INSERT INTO memberships VALUES(?,?)", [(gid, x) for x in ids])
    for e, d in entries:
        # Explicit source labels and standalone block links after a callout are
        # provenance candidates, not proof of identity or semantic dependence.
        for field in ("body", "context_after"):
            value = e[field]
            if field == "context_after":
                value = next((line for line in value.splitlines() if
                    re.match(r"^\s*Source:", line, re.I) or
                    re.match(r"^\s*\[\[[^]\n]+#\^[^]\n]+\]\]\s*$", line) or
                    re.match(r"^\s*\[[^]]+\]\([^)]*(?:#\^|%23%5[eE]|#%5[eE])[^)]*\)\s*$", line)), "")
            links = [(m[0], m[1].split("|", 1)[0]) for m in WIKI.finditer(value)]
            links += [(m[0], unquote(m[1])) for m in re.finditer(r"(?<!!)\[[^]\n]+\]\(([^)\n]+)\)", value)
                      if not re.match(r"^\w+://", m[1])]
            for literal, raw_target in links:
                target, _, fragment = raw_target.partition("#")
                if target:
                    joined = posixpath.normpath((Path(d["path"]).parent / target).as_posix()).removesuffix(".md")
                    possible = set(names.get((d["vault"], target.removesuffix(".md")), []) or names.get((d["vault"], joined), []))
                else:
                    possible = {d["id"]}
                if len(possible) != 1:
                    db.execute("INSERT INTO unresolved VALUES(?,?,?,?)", (e["id"], raw_target, "wikilink", "ambiguous" if possible else "not resolved"))
                    continue
                target_id = next(iter(possible))
                if fragment.startswith("^"):
                    resolved = blocks.get((target_id, fragment[1:]))
                    if resolved:
                        target_id = resolved
                    else:
                        db.execute("INSERT INTO unresolved VALUES(?,?,?,?)", (e["id"], raw_target, "block-link", "block absent, ambiguous, or not extracted"))
                evidence = json.dumps({"field": field, "literal": literal}, ensure_ascii=False)
                kind = "explicit-reference" if field == "body" else "source-link-candidate"
                db.execute("INSERT OR IGNORE INTO edges VALUES(?,?,?,?,?)", (e["id"], target_id, kind, evidence, "observed-link-not-equivalence"))
    db.commit()
    queries = ["Stokes", "Hermitian", "enthalpy", '"simply connected"', "polarization", "continuity", "eigenvalues", "Cauchy", "viscosity", "density"]
    times, samples = [], []
    for q in queries:
        for _ in range(12):
            t = time.perf_counter()
            rows = db.execute("""SELECT e.id,e.title,d.vault,d.path,e.line_start
                FROM search JOIN entries e ON e.id=search.entry_id
                JOIN documents d ON d.id=e.document_id
                WHERE search MATCH ? AND d.role NOT IN ('snapshot','support','draft')
                ORDER BY bm25(search,0.0,8.0,3.0,0.2,1.0)
                  * CASE WHEN d.role='source' THEN 0.5 ELSE 1.0 END LIMIT 20""", (q,)).fetchall()
            times.append((time.perf_counter() - t) * 1000)
        samples.append({"query": q, "top_results": rows[:3]})
    times.sort()
    counts = lambda sql: dict(db.execute(sql).fetchall())
    report = {
        "profile": profile, "mode": "TEST_ONLY_UNREVIEWED", "production_entries": 0,
        "files_discovered": len(paths), "documents_snapshotted": len(docs),
        "source_bytes": sum(d["bytes"] for d in docs), "candidates": len(entries),
        "by_vault": counts("SELECT d.vault,count(*) FROM entries e JOIN documents d ON d.id=e.document_id GROUP BY d.vault"),
        "by_kind": counts("SELECT kind,count(*) FROM entries GROUP BY kind"),
        "by_role": counts("SELECT d.role,count(*) FROM entries e JOIN documents d ON d.id=e.document_id GROUP BY d.role"),
        "groups": counts("SELECT kind,count(*) FROM groups GROUP BY kind"),
        "edges": counts("SELECT kind,count(*) FROM edges GROUP BY kind"),
        "unresolved_links": db.execute("SELECT count(*) FROM unresolved").fetchone()[0],
        "errors": errors, "elapsed_seconds": time.perf_counter() - started,
        "warm_sql_query_ms": {"p50": times[len(times)//2], "p95": times[int(len(times)*.95)], "queries": len(times)},
        "query_samples": samples,
        "limits": [
            "Test candidate extraction, not reviewed library entries; counts include duplicates.",
            "CALL OUTS ONLY per user instruction; standalone prose, equations, and tables are intentionally excluded.",
            "Callout types and file roles are heuristic; nearby context is not automatically part of a statement.",
            "Annotation sidecars are not included in this Markdown crawl; use guarded live API in the plugin integration.",
            "Snapshots preserve source Markdown; linked images and macros are not yet packaged.",
            "Relations record literal references or candidate clusters, never inferred mathematical equivalence.",
            "Benchmark measures warm local SQL only, not API latency, native rendering or crash recovery.",
            "Test IDs are reproducible within this profile; production requires durable assigned identity.",
        ],
    }
    (out / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    (out / "documents.jsonl").write_text("".join(json.dumps(d, ensure_ascii=False) + "\n" for d in docs))
    db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    print(json.dumps({k:v for k,v in report.items() if k not in ("query_samples","by_vault")}, indent=2), flush=True)
    db.close()


if __name__ == "__main__":
    main()
