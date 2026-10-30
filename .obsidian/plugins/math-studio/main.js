"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to2, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to2, key) && key !== except)
        __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to2;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MathStudio
});
module.exports = __toCommonJS(main_exports);

// src/auto-numbering.ts
var import_state = require("@codemirror/state");
var import_commands = require("@codemirror/commands");

// src/symbol-model.ts
var REGISTRY_OPEN = "%% study-symbols v2\n";
var LEGACY_REGISTRY_OPEN = "%% study-symbols v1\n";
var ID = /^[0-9a-z]{10}$/;
var DEF_ID = /^d-[0-9a-z]{10}$/;
var ROW_ID = /^[A-Za-z0-9_-]{1,80}$/;
var REGISTRY_LIMIT = 2e6;
var clone = (value) => JSON.parse(JSON.stringify(value));
function object(v2) {
  return !!v2 && typeof v2 === "object" && !Array.isArray(v2);
}
function string(v2, max, name2) {
  if (typeof v2 !== "string" || v2.length > max) throw Error(`Invalid notation ${name2}.`);
}
function validateDefinition(value) {
  if (!object(value)) throw Error("Invalid legacy symbol definition.");
  string(value.tex, 16e3, "TeX");
  string(value.meaning, 4e3, "meaning");
  string(value.units, 1e3, "units");
  if (!value.meaning.trim()) throw Error("Legacy symbol meaning is empty.");
  if (value.concept !== void 0) string(value.concept, 200, "concept key");
  if (!Array.isArray(value.code) || value.code.length > 100) throw Error("Invalid legacy code names.");
  for (const c of value.code) {
    if (!object(c)) throw Error("Invalid legacy code representation.");
    string(c.lang, 60, "language");
    string(c.name, 200, "code name");
    if (!c.lang.trim() || !c.name.trim()) throw Error("Legacy language and code name are required.");
    if (c.scope !== void 0) string(c.scope, 1e3, "scope");
  }
}
function validateLegacyRegistry(value) {
  if (!object(value) || !object(value.defs) || !object(value.occ)) throw Error("Invalid legacy symbol registry; source has been left intact.");
  if (Object.keys(value.defs).length > 1e4 || Object.keys(value.occ).length > 5e4) throw Error("Symbol registry exceeds the supported size.");
  for (const [id, d] of Object.entries(value.defs)) {
    if (!DEF_ID.test(id)) throw Error("Invalid legacy definition ID.");
    validateDefinition(d);
  }
  for (const [id, o] of Object.entries(value.occ)) {
    if (!ID.test(id) || !object(o) || typeof o.def !== "string" || !Object.hasOwn(value.defs, o.def)) throw Error("Occurrence has no valid definition.");
    string(o.glyph, 16e3, "occurrence glyph");
    string(o.equation, 16e3, "equation reference");
  }
}
function validateLanguages(value) {
  if (!Array.isArray(value) || value.length > 100) throw Error("Use at most 100 notation languages.");
  const seen = /* @__PURE__ */ new Set();
  for (const language of value) {
    string(language, 100, "language");
    if (!language.trim() || seen.has(language)) throw Error("Notation languages must be nonempty and unique.");
    seen.add(language);
  }
}
function validateEntry(value) {
  if (!object(value)) throw Error("Invalid notation entry.");
  string(value.symbol, 16e3, "symbol");
  string(value.definitionMarkdown, 64e3, "definition");
  string(value.notesMarkdown, 128e3, "notes");
  if (value.equation !== void 0) string(value.equation, 16e3, "equation reference");
  if (value.languageOverride !== void 0) validateLanguages(value.languageOverride);
  const rows = (items, label, fields) => {
    if (!Array.isArray(items) || items.length > 100) throw Error(`Invalid notation ${label} rows.`);
    const ids = /* @__PURE__ */ new Set();
    for (const r of items) {
      if (!object(r) || typeof r.id !== "string" || !ROW_ID.test(r.id) || ids.has(r.id)) throw Error(`Invalid or duplicate notation ${label} row ID.`);
      ids.add(r.id);
      for (const field of fields) string(r[field], field === "language" ? 100 : field === "code" ? 4e3 : 16e3, field);
    }
  };
  rows(value.units, "value/unit", ["value", "units"]);
  rows(value.code, "language/code", ["language", "code"]);
  if (value.legacy !== void 0) {
    const old = value.legacy;
    if (!object(old) || typeof old.definitionId !== "string" || !DEF_ID.test(old.definitionId)) throw Error("Invalid legacy notation metadata.");
    if (old.concept !== void 0) string(old.concept, 200, "legacy concept");
    if (old.definition !== void 0) validateDefinition(old.definition);
    if (old.occurrence !== void 0) {
      if (!object(old.occurrence) || old.occurrence.def !== old.definitionId) throw Error("Invalid legacy occurrence.");
      string(old.occurrence.glyph, 16e3, "legacy glyph");
      string(old.occurrence.equation, 16e3, "legacy equation");
    }
    if (old.codeScopes !== void 0) {
      if (!Array.isArray(old.codeScopes) || old.codeScopes.length > 100) throw Error("Invalid legacy code scopes.");
      for (const c of old.codeScopes) {
        if (!object(c)) throw Error("Invalid legacy code scope.");
        string(c.rowId, 80, "legacy row ID");
        string(c.scope, 1e3, "legacy scope");
      }
    }
  }
}
function validateRegistry(value) {
  if (!object(value) || !object(value.entries) || Object.hasOwn(value, "defs") || Object.hasOwn(value, "occ")) throw Error("Invalid v2 notation registry; source has been left intact.");
  if (Object.keys(value.entries).length > 5e4) throw Error("Notation registry exceeds the supported size.");
  for (const [id, entry] of Object.entries(value.entries)) {
    if (!ID.test(id)) throw Error("Invalid notation entry ID.");
    validateEntry(entry);
  }
}
function convertLegacyRegistry(legacy) {
  validateLegacyRegistry(legacy);
  const entries = {}, used = new Set(Object.keys(legacy.occ)), referenced = /* @__PURE__ */ new Set();
  const record = (definitionId, occurrence) => {
    const d = legacy.defs[definitionId], code = d.code.map((c, i) => ({ id: "code" + i, language: c.lang, code: c.name }));
    return { symbol: occurrence?.glyph ?? d.tex, definitionMarkdown: d.meaning, units: d.units ? [{ id: "units0", value: "", units: d.units }] : [], code, notesMarkdown: "", ...occurrence ? { equation: occurrence.equation } : {}, legacy: { definitionId, ...d.concept === void 0 ? {} : { concept: d.concept }, codeScopes: d.code.flatMap((c, i) => c.scope === void 0 ? [] : [{ rowId: code[i].id, scope: c.scope }]), definition: clone(d), ...occurrence ? { occurrence: clone(occurrence) } : {} } };
  };
  for (const [id, o] of Object.entries(legacy.occ)) {
    entries[id] = record(o.def, o);
    referenced.add(o.def);
  }
  for (const id of Object.keys(legacy.defs)) if (!referenced.has(id)) {
    let next = id.slice(2);
    for (let n = 0; used.has(next); n++) next = n.toString(36).padStart(10, "0");
    used.add(next);
    entries[next] = record(id);
  }
  const result = { entries };
  validateRegistry(result);
  return result;
}
function registryBlock(source, excluded = []) {
  const starts = [...source.matchAll(/^%% study-symbols[^\n]*\n/gm)].filter((m4) => !excluded.some((r) => m4.index >= r.from && m4.index < r.to));
  if (starts.length > 1) throw Error("Multiple symbol registries found. Resolve them before editing notation.");
  if (!starts.length) return null;
  const m3 = starts[0], from = m3.index, header2 = m3[0].replace(/\r\n/g, "\n");
  const version = header2 === REGISTRY_OPEN ? 2 : header2 === LEGACY_REGISTRY_OPEN ? 1 : null;
  if (!version) throw Error("Unsupported symbol registry version.");
  const bodyFrom = from + m3[0].length, end = /^%%[ \t]*(?:\r?$)/m.exec(source.slice(bodyFrom));
  if (!end) throw Error("Unclosed symbol registry; source has been left intact.");
  const to2 = bodyFrom + end.index + end[0].length, raw = source.slice(bodyFrom, bodyFrom + end.index);
  if (raw.length > REGISTRY_LIMIT) throw Error("Symbol registry exceeds the supported size.");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw Error("Invalid symbol registry JSON; source has been left intact.");
  }
  if (version === 1) {
    validateLegacyRegistry(data);
    return { from, to: to2, version, data: convertLegacyRegistry(data), legacyData: data };
  }
  validateRegistry(data);
  return { from, to: to2, version, data };
}
function escaped(s, i) {
  let n = 0;
  while (i > 0 && s[--i] === "\\") n++;
  return n % 2 === 1;
}
function group(s, at) {
  if (s[at] !== "{") return null;
  let depth = 1;
  for (let i = at + 1; i < s.length; i++) {
    if (escaped(s, i)) continue;
    if (s[i] === "%") {
      const next = s.indexOf("\n", i);
      if (next < 0) return null;
      i = next;
      continue;
    }
    if (s[i] === "{") depth++;
    if (s[i] === "}" && !--depth) return { from: at, to: i + 1, body: s.slice(at + 1, i) };
  }
  return null;
}
function markers(tex) {
  const out = [];
  const command = /\\class\b/g;
  let match;
  while (match = command.exec(tex)) {
    const from = match.index;
    if (escaped(tex, from)) continue;
    const line = tex.lastIndexOf("\n", from) + 1;
    let commented = false;
    for (let k = line; k < from; k++) if (tex[k] === "%" && !escaped(tex, k)) {
      commented = true;
      break;
    }
    if (commented) continue;
    let at = command.lastIndex;
    while (/\s/.test(tex[at] ?? "") && at < tex.length) at++;
    const cls = group(tex, at);
    if (!cls) {
      if (/^\{[^}]*\bmjx-ss(?:\s|$)/.test(tex.slice(at))) throw Error("Unclosed symbol marker class.");
      continue;
    }
    const tokens = cls.body.trim().split(/\s+/);
    if (!tokens.some((t33) => t33 === "mjx-ss" || t33.startsWith("mjx-ss-o-"))) continue;
    const id = /^mjx-ss mjx-ss-o-([0-9a-z]{10})$/.exec(cls.body)?.[1];
    if (!id) throw Error("Malformed symbol marker. Keep its source intact and repair the ID.");
    at = cls.to;
    while (/\s/.test(tex[at] ?? "") && at < tex.length) at++;
    const body = group(tex, at);
    if (!body) throw Error("Unclosed symbol marker.");
    if (out.some((m3) => from > m3.from && from < m3.to)) throw Error("Nested symbol tags are not supported.");
    out.push({ id, from, to: body.to, bodyFrom: at + 1, bodyTo: body.to - 1, body: body.body });
  }
  return out;
}
function applyEdits(source, edits) {
  const sorted = [...edits].sort((a, b) => a.from - b.from || a.to - b.to);
  let last = 0, out = "";
  for (const edit of sorted) {
    if (edit.from < last || edit.to < edit.from || edit.to > source.length) throw Error("Overlapping or invalid symbol edits.");
    out += source.slice(last, edit.from) + edit.insert;
    last = edit.to;
  }
  return out + source.slice(last);
}
function semanticGlyph(tex) {
  let out = "";
  for (let i = 0; i < tex.length; ) {
    const color = /^\\(textcolor|color)(?![A-Za-z])/.exec(tex.slice(i));
    if (color) {
      let at = i + color[0].length;
      while (/\s/.test(tex[at] ?? "") && at < tex.length) at++;
      if (tex[at] === "[") {
        const end = tex.indexOf("]", at);
        if (end < 0) return tex;
        at = end + 1;
      }
      const name2 = group(tex, at);
      if (name2) {
        if (color[1] === "color") {
          i = name2.to;
          continue;
        }
        let bodyAt = name2.to;
        while (/\s/.test(tex[bodyAt] ?? "") && bodyAt < tex.length) bodyAt++;
        const body = group(tex, bodyAt);
        if (body) {
          out += semanticGlyph(body.body);
          i = body.to;
          continue;
        }
      }
    }
    out += tex[i++];
  }
  const normalize = (s) => s.replace(/\s+/g, "").replace(/\\(?:left|right|displaystyle|textstyle|scriptstyle|scriptscriptstyle)\b/g, "").replace(/\\[,;!:]/g, "").replace(/([_^])\{([A-Za-z0-9])\}/g, "$1$2").replace(/\^\{\\prime\}|\^\\prime\b/g, "'");
  let normalized = "", last = 0;
  const text = /\\(?:text|mbox|operatorname)\b\s*/g;
  let hit;
  while (hit = text.exec(out)) {
    const body = group(out, text.lastIndex);
    if (!body) continue;
    normalized += normalize(out.slice(last, hit.index)) + out.slice(hit.index, body.to);
    last = body.to;
    text.lastIndex = body.to;
  }
  return normalized + normalize(out.slice(last));
}

// src/reference-model.ts
var ID2 = "[A-Za-z0-9-]{1,80}";
var CLASS = new RegExp(`^klref kl-([ntbc])-(${ID2}(?:_${ID2})?)(?: kl-label-([0-9a-f]{16}))?$`);
var SAFE_CLASS = new RegExp(`^mjx-klref mjx-kl-([ntbc])-(${ID2}(?:_${ID2})?)(?: mjx-kl-label-([0-9a-f]{16}))?$`);
var escaped2 = (s, i) => {
  let n = 0;
  while (i > 0 && s[--i] === "\\") n++;
  return n % 2 === 1;
};
function mathReferences(source) {
  const out = [];
  const command = /\\class\b/g;
  let match;
  while (match = command.exec(source)) {
    const from = match.index;
    if (escaped2(source, from)) continue;
    const line = source.lastIndexOf("\n", from) + 1;
    let comment2 = false;
    for (let i = line; i < from; i++) if (source[i] === "%" && !escaped2(source, i)) {
      comment2 = true;
      break;
    }
    if (comment2) continue;
    const cls = group(source, command.lastIndex);
    if (!cls) continue;
    if (!/(?:^|\s)(?:mjx-)?klref(?:\s|$)/.test(cls.body)) continue;
    const fields = CLASS.exec(cls.body) || SAFE_CLASS.exec(cls.body), body = group(source, cls.to);
    if (!fields || !body) throw Error("Malformed knowledge reference. Keep its source intact and repair the link.");
    if (out.some((r) => from > r.from && from < r.to)) throw Error("Nested knowledge references are not supported.");
    out.push({ from, to: body.to, bodyFrom: cls.to + 1, bodyTo: body.to - 1, raw: source.slice(from, body.to), body: body.body, mode: fields[1], target: fields[2].replace("_", "."), baseline: fields[3] });
  }
  const symbols = markers(source);
  let symbol = 0;
  for (const reference of out) {
    while (symbol < symbols.length && symbols[symbol].to <= reference.from) symbol++;
    if (symbol < symbols.length && reference.from > symbols[symbol].from && reference.from < symbols[symbol].to) throw Error("A reference cannot be placed inside a symbol tag. Select the whole tagged symbol.");
  }
  return out;
}

// src/model.ts
var escaped3 = (s, i) => {
  let n = 0;
  while (i > 0 && s[--i] === "\\") n++;
  return n % 2 === 1;
};
function displayContainer(source, start, end) {
  const opening = source.slice(source.lastIndexOf("\n", start - 1) + 1, start);
  const prefix = /^[ \t]*(?:>[ \t]*)+/.exec(opening)?.[0] ?? "";
  const depth = (prefix.match(/>/g) || []).length, nextLine = source.indexOf("\n", start), newline = nextLine > 0 && source[nextLine - 1] === "\r" ? "\r\n" : "\n";
  const lines = source.slice(start + 2, end).split(/\r?\n/);
  let issue = "";
  const body = lines.map((line, i) => {
    if (!i || !depth) return line;
    const p2 = /^[ \t]*(?:>[ \t]*)+/.exec(line)?.[0] ?? "";
    if ((p2.match(/>/g) || []).length !== depth) {
      issue = "This display equation crosses Markdown container boundaries. Use native editing to repair it.";
      return line;
    }
    return line.slice(p2.length);
  }).join("\n");
  return { body, ...prefix ? { linePrefix: prefix } : {}, ...newline === "\r\n" ? { newline } : {}, ...issue ? { containerIssue: issue } : {} };
}
function equations(s) {
  const out = [];
  let i = 0;
  let fence = "";
  let fenceLength = 0;
  if (s.startsWith("---\n") || s.startsWith("---\r\n")) {
    const m3 = /\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/g;
    m3.lastIndex = 3;
    const end = m3.exec(s);
    if (end) i = end.index + end[0].length;
  }
  while (i < s.length) {
    if (i === 0 || s[i - 1] === "\n") {
      const line = s.slice(i, s.indexOf("\n", i) < 0 ? s.length : s.indexOf("\n", i));
      const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (f) {
        if (!fence) {
          fence = f[1][0];
          fenceLength = f[1].length;
        } else if (f[1][0] === fence && f[1].length >= fenceLength) fence = "";
        i += line.length + 1;
        continue;
      }
      if (fence || /^ {4}|^\t/.test(line)) {
        i += line.length + 1;
        continue;
      }
    }
    if (s[i] === "`" && !escaped3(s, i)) {
      let n = 1;
      while (s[i + n] === "`") n++;
      const end2 = s.indexOf("`".repeat(n), i + n);
      i = end2 < 0 ? i + n : end2 + n;
      continue;
    }
    if (s[i] !== "$" || escaped3(s, i)) {
      i++;
      continue;
    }
    const display = s[i + 1] === "$";
    const size = display ? 2 : 1;
    const start = i;
    let j = i + size;
    if (!display && /\s/.test(s[j] ?? "")) {
      i++;
      continue;
    }
    let end = -1;
    while (j < s.length) {
      if (!display && s[j] === "\n") break;
      if (s[j] === "$" && !escaped3(s, j) && (!display || s[j + 1] === "$")) {
        end = j;
        break;
      }
      j++;
    }
    if (end < 0) {
      i += size;
      continue;
    }
    if (!display && (/\s/.test(s[end - 1] ?? "") || /\d/.test(s[end + 1] ?? ""))) {
      i = end + size;
      continue;
    }
    const to2 = end + size;
    out.push({ from: start, to: to2, bodyFrom: start + size, bodyTo: end, body: s.slice(start + size, end), display, raw: s.slice(start, to2), ...display ? displayContainer(s, start, end) : {} });
    i = to2;
  }
  return out;
}
function splitTag(body) {
  const auto = /% math-studio:auto:([a-zA-Z0-9-]+)/.exec(body);
  const tags2 = [...body.matchAll(/\\tag\{([^{}]*)\}/g)];
  const tag = tags2.length === 1 ? tags2[0] : void 0;
  return { latex: body.replace(/% math-studio:auto:[a-zA-Z0-9-]+\s*/g, "").replace(/\\tag\{[^{}]*\}/g, "").trim(), tag: auto ? { kind: "auto", label: tag?.[1] ?? "", id: auto[1] } : tag ? { kind: "manual", label: tag[1] } : { kind: "none", label: "" } };
}
function unsupported(body) {
  let portable = body;
  try {
    for (const ref of mathReferences(body).reverse()) portable = portable.slice(0, ref.from) + ref.body + portable.slice(ref.to);
  } catch (error) {
    return error.message;
  }
  const checked = portable.replace(/\\class\{mjx-ss mjx-ss-o-[0-9a-z]{10}\}/g, "");
  if (/\\(?:newcommand|renewcommand|def|gdef|require|html\w*|href|includegraphics|class|style)\b/.test(checked)) return "This equation uses a macro definition or an external/HTML command. Keep editing it in native LaTeX.";
  const stripped = body.replace(/% math-studio:auto:[a-zA-Z0-9-]+/g, "");
  if (/(^|[^\\])%/.test(stripped)) return "This equation contains LaTeX comments. Native editing preserves them exactly.";
  if ((body.match(/\\tag\b/g) || []).length > 1 || /\\tag\*/.test(body) || /\\label\b|\\ref\b|\\eqref\b/.test(body)) return "This equation uses labels, references or multiple tags. Use native editing to preserve them.";
  if (/\\tag\{[^}]*\{/.test(body)) return "Nested equation tags are supported in native editing only.";
  return null;
}
function compose(original, latex, tag) {
  if (original.containerIssue) throw Error(original.containerIssue);
  const label = tag.label.trim();
  if (/[{}\\\n\r]/.test(label)) throw Error("Use a plain equation label without braces, backslashes or line breaks.");
  let body = latex.trim();
  if (tag.kind !== "none" && original.display) body += `\\tag{${label || "1"}}`;
  if (tag.kind === "auto" && original.display) body += `
% math-studio:auto:${tag.id || crypto.randomUUID()}`;
  if (original.display) {
    const newline = original.newline ?? "\n", prefix = original.linePrefix ?? "";
    return "$$" + newline + body.split(/\r?\n/).map((line) => prefix + line).join(newline) + newline + prefix + "$$";
  }
  return `$${body}$`;
}
function numberingEdits(doc) {
  const parsed = equations(doc);
  const reserved = new Set(parsed.filter((q) => q.display).map((q) => splitTag(q.body).tag).filter((tag) => tag.kind === "manual").map((tag) => tag.label.trim()));
  let n = 0;
  const ids = /* @__PURE__ */ new Set();
  const edits = [];
  for (const q of parsed) {
    const { tag } = splitTag(q.body);
    if (tag.kind !== "auto" || !q.display) continue;
    do {
      n++;
    } while (reserved.has(String(n)));
    let raw = q.raw;
    const id = tag.id;
    if (ids.has(id)) raw = raw.replace(`math-studio:auto:${id}`, `math-studio:auto:${crypto.randomUUID()}`);
    ids.add(id);
    raw = /\\tag\{[^{}]*\}/.test(raw) ? raw.replace(/\\tag\{[^{}]*\}/, `\\tag{${n}}`) : raw.replace(/(\r?\n)([ \t]*(?:>[ \t]*)*)% math-studio:auto:/, (_match, newline, prefix) => `\\tag{${n}}${newline}${prefix}% math-studio:auto:`);
    if (raw !== q.raw) edits.push({ from: q.from, to: q.to, insert: raw });
  }
  return edits;
}
function safeReplacement(doc, q, replacement) {
  if (doc.slice(q.from, q.to) !== q.raw) throw Error("The equation changed outside this visual editor. Your draft is kept open; cancel and reopen the current equation.");
  return { from: q.from, to: q.to, insert: replacement };
}
function equationAt(source, at) {
  if (at > 0 && source[at - 1] === "$" && source[at] === "$" && source[at - 2] !== "$" && source[at + 1] !== "$" && !escaped3(source, at - 1)) {
    const probe = source.slice(0, at) + "x" + source.slice(at);
    if (equations(probe).some((q) => q.from === at - 1 && !q.display))
      return { from: at - 1, to: at + 1, bodyFrom: at, bodyTo: at, body: "", display: false, raw: "$$" };
  }
  return equations(source).find((q) => at >= q.from && at <= q.to);
}

// src/auto-numbering.ts
function lineSignature(text, first) {
  const tokens = [];
  if (/^ {4}|^\t/.test(text)) tokens.push("indent");
  const quote = /^[ \t]*(?:>[ \t]*)+/.exec(text);
  if (quote) tokens.push("quote:" + quote[0].replace(/[^>]/g, ""));
  const fence = /^ {0,3}(`{3,}|~{3,})/.exec(text);
  if (fence) tokens.push("fence:" + fence[1]);
  if (/^(?:---|\.\.\.)\s*$/.test(text)) tokens.push((first && /^---\r?$/.test(text) ? "frontmatter-open:" : "") + text.trim());
  for (const m3 of text.matchAll(/\\tag\{[^{}]*\}|\\tag\{|% math-studio:auto:[a-zA-Z0-9-]+|\\+|`+|\$+|[{}]/g)) {
    let token = m3[0];
    if (token[0] === "$") token += ":" + Number(/\s/.test(text[m3.index - 1] ?? "\n")) + Number(/\s/.test(text[m3.index + m3[0].length] ?? "\n")) + Number(/\d/.test(text[m3.index + m3[0].length] ?? ""));
    tokens.push(token);
  }
  return JSON.stringify(tokens);
}
function signatures(doc, from, to2) {
  const first = doc.lineAt(from).number, last = doc.lineAt(to2).number, result = [];
  for (let n = first; n <= last; n++) {
    const signature = lineSignature(doc.line(n).text, n === 1);
    if (signature !== "[]") result.push(signature);
  }
  return JSON.stringify(result);
}
function multilineTags(doc) {
  const ranges = [];
  for (const m3 of doc.toString().matchAll(/\\tag\{[^{}]*\}/g)) if (/[\r\n]/.test(m3[0])) ranges.push({ from: m3.index, to: m3.index + m3[0].length });
  return ranges;
}
function preciseNumberingEdits(source, edits) {
  const result = [];
  for (const edit of edits) {
    const before = source.slice(edit.from, edit.to), after = edit.insert, local = [];
    const oldTag = /\\tag\{[^{}]*\}/.exec(before), newTag = /\\tag\{[^{}]*\}/.exec(after);
    if (oldTag && newTag && oldTag[0] !== newTag[0]) local.push({ from: oldTag.index, to: oldTag.index + oldTag[0].length, insert: newTag[0] });
    else if (!oldTag && newTag) {
      const at = /(\r?\n)([ \t]*(?:>[ \t]*)*)% math-studio:auto:/.exec(before);
      if (at) local.push({ from: at.index, to: at.index, insert: newTag[0] });
    }
    const oldID = /math-studio:auto:([a-zA-Z0-9-]+)/.exec(before), newID = /math-studio:auto:([a-zA-Z0-9-]+)/.exec(after);
    if (oldID && newID && oldID[0] !== newID[0]) local.push({ from: oldID.index, to: oldID.index + oldID[0].length, insert: newID[0] });
    local.sort((a, b) => a.from - b.from);
    let check = before;
    for (const change of [...local].reverse()) check = check.slice(0, change.from) + change.insert + check.slice(change.to);
    if (check === after) result.push(...local.map((change) => ({ ...change, from: edit.from + change.from, to: edit.from + change.to })));
    else {
      let from = 0, endBefore = before.length, endAfter = after.length;
      while (from < endBefore && from < endAfter && before[from] === after[from]) from++;
      while (endBefore > from && endAfter > from && before[endBefore - 1] === after[endAfter - 1]) {
        endBefore--;
        endAfter--;
      }
      if (from < endBefore || from < endAfter) result.push({ from: edit.from + from, to: edit.from + endBefore, insert: after.slice(from, endAfter) });
    }
  }
  return result;
}
function numberingRefresh(state) {
  const source = state.doc.toString(), changes = preciseNumberingEdits(source, numberingEdits(source));
  return changes.length ? { changes, annotations: [import_state.Transaction.userEvent.of("input.math-numbering"), import_commands.isolateHistory.of("full")] } : void 0;
}
function automaticNumbering(options = {}) {
  const relevantCache = /* @__PURE__ */ new WeakMap();
  const relevant = (tr2, ranges) => {
    const cached = relevantCache.get(tr2);
    if (cached !== void 0) return cached;
    let changed = false;
    tr2.changes.iterChangedRanges((from, to2, newFrom, newTo) => {
      if (changed) return;
      changed = ranges.some((r) => from <= r.to && to2 >= r.from) || signatures(tr2.startState.doc, from, to2) !== signatures(tr2.newDoc, newFrom, newTo);
    });
    relevantCache.set(tr2, changed);
    return changed;
  };
  const tagRanges = import_state.StateField.define({
    create: (state) => multilineTags(state.doc),
    update(value, tr2) {
      if (!tr2.docChanged) return value;
      if (relevant(tr2, value)) return multilineTags(tr2.newDoc);
      return value.map((r) => ({ from: tr2.changes.mapPos(r.from, 1), to: tr2.changes.mapPos(r.to, -1) }));
    }
  });
  return [tagRanges, import_state.EditorState.transactionFilter.of((tr2) => {
    if (!tr2.docChanged || options.enabled?.() === false || options.sessionOpen?.(tr2.startState) || tr2.annotation(import_state.Transaction.addToHistory) === false || ["undo", "redo", "set", "input.symbols", "input.type.symbols", "input.math-studio", "input.math-numbering"].some((event) => tr2.isUserEvent(event)) || !relevant(tr2, tr2.startState.field(tagRanges))) return tr2;
    const source = tr2.newDoc.toString(), changes = preciseNumberingEdits(source, (options.number ?? numberingEdits)(source));
    return changes.length ? [tr2, { changes, sequential: true }] : tr2;
  })];
}

// src/layout.ts
function splitOuter(source, delimiter) {
  const parts = [];
  let start = 0, braces = 0, environments = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\\") {
      const environment = source.slice(i).match(/^\\(begin|end)\{[^}]+\}/);
      if (environment) {
        environments += environment[1] === "begin" ? 1 : -1;
        if (environments < 0) throw new Error("This compound layout must be edited in Native LaTeX.");
        i += environment[0].length - 1;
        continue;
      }
      if (!braces && !environments && source.startsWith(delimiter, i)) {
        parts.push(source.slice(start, i));
        i += delimiter.length - 1;
        start = i + 1;
        continue;
      }
      const command = source.slice(i).match(/^\\(?:[a-zA-Z]+|.)/s);
      if (command) i += command[0].length - 1;
      continue;
    }
    if (source[i] === "{") braces++;
    else if (source[i] === "}") {
      braces--;
      if (braces < 0) throw new Error("This compound layout must be edited in Native LaTeX.");
    } else if (!braces && !environments && source.startsWith(delimiter, i)) {
      parts.push(source.slice(start, i));
      i += delimiter.length - 1;
      start = i + 1;
    }
  }
  if (braces || environments) throw new Error("This compound layout must be edited in Native LaTeX.");
  parts.push(source.slice(start));
  return parts;
}

// src/justification-source.ts
function composeSourceDraft(q, before, after, tag) {
  const original = splitTag(q.body);
  if (original.latex !== before || JSON.stringify(original.tag) !== JSON.stringify(tag)) throw Error("Save equation or numbering edits before adding a source-preserving justification.");
  if (before === after) return q.raw;
  let first = 0, end = before.length, last = after.length;
  while (first < end && first < last && before[first] === after[first]) first++;
  while (end > first && last > first && before[end - 1] === after[last - 1]) {
    end--;
    last--;
  }
  const base = q.body.indexOf(before);
  if (base < 0 || q.body.indexOf(before, base + 1) >= 0) throw Error("The exact equation source is ambiguous. Your draft is retained.");
  const map2 = [];
  let body = "";
  const size = q.display ? 2 : 1, raw = q.raw.slice(size, -size), depth = (q.linePrefix?.match(/>/g) || []).length;
  let start = 0, line = 0;
  while (start < raw.length) {
    let at = start;
    if (line && depth) {
      const prefix = /^[ \t]*(?:>[ \t]*)+/.exec(raw.slice(at))?.[0] || "";
      if ((prefix.match(/>/g) || []).length !== depth) throw Error("Equation container changed.");
      at += prefix.length;
    }
    while (at < raw.length && raw[at] !== "\n") {
      if (raw[at] === "\r" && raw[at + 1] === "\n") {
        at++;
        continue;
      }
      map2.push(size + at);
      body += raw[at++];
    }
    if (at < raw.length) {
      map2.push(size + (raw[at - 1] === "\r" ? at - 1 : at));
      body += "\n";
      at++;
    }
    start = at;
    line++;
  }
  map2.push(q.raw.length - size);
  if (body !== q.body) throw Error("The exact equation container could not be mapped.");
  const a = map2[base + first], b = map2[base + end], replacement = after.slice(first, last).replace(/\r?\n/g, (q.newline || "\n") + (q.linePrefix || ""));
  return q.raw.slice(0, a) + replacement + q.raw.slice(b);
}

// src/justification.ts
function justificationRowAt(source, offset) {
  const env = source.match(/^(\s*)\\begin\{(aligned|gathered)\}([\s\S]*)\\end\{\2\}(\s*)$/);
  if (!env) return 0;
  let start = env[1].length + ("\\begin{" + env[2] + "}").length;
  const rows = splitOuter(env[3], "\\\\");
  for (let i = 0; i < rows.length; i++) {
    if (offset <= start + rows[i].length) return i;
    start += rows[i].length + 2;
  }
  return rows.length - 1;
}

// node_modules/yaml/browser/dist/nodes/identity.js
var ALIAS = Symbol.for("yaml.alias");
var DOC = Symbol.for("yaml.document");
var MAP = Symbol.for("yaml.map");
var PAIR = Symbol.for("yaml.pair");
var SCALAR = Symbol.for("yaml.scalar");
var SEQ = Symbol.for("yaml.seq");
var NODE_TYPE = Symbol.for("yaml.node.type");
var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
function isCollection(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case MAP:
      case SEQ:
        return true;
    }
  return false;
}
function isNode(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case ALIAS:
      case MAP:
      case SCALAR:
      case SEQ:
        return true;
    }
  return false;
}
var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

// node_modules/yaml/browser/dist/visit.js
var BREAK = Symbol("break visit");
var SKIP = Symbol("skip children");
var REMOVE = Symbol("remove node");
function visit(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    visit_(null, node, visitor_, Object.freeze([]));
}
visit.BREAK = BREAK;
visit.SKIP = SKIP;
visit.REMOVE = REMOVE;
function visit_(key, node, visitor, path) {
  const ctrl = callVisitor(key, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path, ctrl);
    return visit_(key, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci2 = visit_(i, node.items[i], visitor, path);
        if (typeof ci2 === "number")
          i = ci2 - 1;
        else if (ci2 === BREAK)
          return BREAK;
        else if (ci2 === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = visit_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = visit_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
async function visitAsync(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    await visitAsync_(null, node, visitor_, Object.freeze([]));
}
visitAsync.BREAK = BREAK;
visitAsync.SKIP = SKIP;
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key, node, visitor, path) {
  const ctrl = await callVisitor(key, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path, ctrl);
    return visitAsync_(key, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci2 = await visitAsync_(i, node.items[i], visitor, path);
        if (typeof ci2 === "number")
          i = ci2 - 1;
        else if (ci2 === BREAK)
          return BREAK;
        else if (ci2 === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = await visitAsync_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = await visitAsync_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
function initVisitor(visitor) {
  if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
    return Object.assign({
      Alias: visitor.Node,
      Map: visitor.Node,
      Scalar: visitor.Node,
      Seq: visitor.Node
    }, visitor.Value && {
      Map: visitor.Value,
      Scalar: visitor.Value,
      Seq: visitor.Value
    }, visitor.Collection && {
      Map: visitor.Collection,
      Seq: visitor.Collection
    }, visitor);
  }
  return visitor;
}
function callVisitor(key, node, visitor, path) {
  if (typeof visitor === "function")
    return visitor(key, node, path);
  if (isMap(node))
    return visitor.Map?.(key, node, path);
  if (isSeq(node))
    return visitor.Seq?.(key, node, path);
  if (isPair(node))
    return visitor.Pair?.(key, node, path);
  if (isScalar(node))
    return visitor.Scalar?.(key, node, path);
  if (isAlias(node))
    return visitor.Alias?.(key, node, path);
  return void 0;
}
function replaceNode(key, path, node) {
  const parent = path[path.length - 1];
  if (isCollection(parent)) {
    parent.items[key] = node;
  } else if (isPair(parent)) {
    if (key === "key")
      parent.key = node;
    else
      parent.value = node;
  } else if (isDocument(parent)) {
    parent.contents = node;
  } else {
    const pt2 = isAlias(parent) ? "alias" : "scalar";
    throw new Error(`Cannot replace node with ${pt2} parent`);
  }
}

// node_modules/yaml/browser/dist/doc/directives.js
var escapeChars = {
  "!": "%21",
  ",": "%2C",
  "[": "%5B",
  "]": "%5D",
  "{": "%7B",
  "}": "%7D"
};
var escapeTagName = (tn2) => tn2.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
var Directives = class _Directives {
  constructor(yaml, tags2) {
    this.docStart = null;
    this.docEnd = false;
    this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
    this.tags = Object.assign({}, _Directives.defaultTags, tags2);
  }
  clone() {
    const copy = new _Directives(this.yaml, this.tags);
    copy.docStart = this.docStart;
    return copy;
  }
  /**
   * During parsing, get a Directives instance for the current document and
   * update the stream state according to the current version's spec.
   */
  atDocument() {
    const res = new _Directives(this.yaml, this.tags);
    switch (this.yaml.version) {
      case "1.1":
        this.atNextDocument = true;
        break;
      case "1.2":
        this.atNextDocument = false;
        this.yaml = {
          explicit: _Directives.defaultYaml.explicit,
          version: "1.2"
        };
        this.tags = Object.assign({}, _Directives.defaultTags);
        break;
    }
    return res;
  }
  /**
   * @param onError - May be called even if the action was successful
   * @returns `true` on success
   */
  add(line, onError) {
    if (this.atNextDocument) {
      this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
      this.tags = Object.assign({}, _Directives.defaultTags);
      this.atNextDocument = false;
    }
    const parts = line.trim().split(/[ \t]+/);
    const name2 = parts.shift();
    switch (name2) {
      case "%TAG": {
        if (parts.length !== 2) {
          onError(0, "%TAG directive should contain exactly two parts");
          if (parts.length < 2)
            return false;
        }
        const [handle, prefix] = parts;
        this.tags[handle] = prefix;
        return true;
      }
      case "%YAML": {
        this.yaml.explicit = true;
        if (parts.length !== 1) {
          onError(0, "%YAML directive should contain exactly one part");
          return false;
        }
        const [version] = parts;
        if (version === "1.1" || version === "1.2") {
          this.yaml.version = version;
          return true;
        } else {
          const isValid = /^\d+\.\d+$/.test(version);
          onError(6, `Unsupported YAML version ${version}`, isValid);
          return false;
        }
      }
      default:
        onError(0, `Unknown directive ${name2}`, true);
        return false;
    }
  }
  /**
   * Resolves a tag, matching handles to those defined in %TAG directives.
   *
   * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
   *   `'!local'` tag, or `null` if unresolvable.
   */
  tagName(source, onError) {
    if (source === "!")
      return "!";
    if (source[0] !== "!") {
      onError(`Not a valid tag: ${source}`);
      return null;
    }
    if (source[1] === "<") {
      const verbatim = source.slice(2, -1);
      if (verbatim === "!" || verbatim === "!!") {
        onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
        return null;
      }
      if (source[source.length - 1] !== ">")
        onError("Verbatim tags must end with a >");
      return verbatim;
    }
    const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
    if (!suffix)
      onError(`The ${source} tag has no suffix`);
    const prefix = this.tags[handle];
    if (prefix) {
      try {
        return prefix + decodeURIComponent(suffix);
      } catch (error) {
        onError(String(error));
        return null;
      }
    }
    if (handle === "!")
      return source;
    onError(`Could not resolve tag: ${source}`);
    return null;
  }
  /**
   * Given a fully resolved tag, returns its printable string form,
   * taking into account current tag prefixes and defaults.
   */
  tagString(tag) {
    for (const [handle, prefix] of Object.entries(this.tags)) {
      if (tag.startsWith(prefix))
        return handle + escapeTagName(tag.substring(prefix.length));
    }
    return tag[0] === "!" ? tag : `!<${tag}>`;
  }
  toString(doc) {
    const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
    const tagEntries = Object.entries(this.tags);
    let tagNames;
    if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
      const tags2 = {};
      visit(doc.contents, (_key, node) => {
        if (isNode(node) && node.tag)
          tags2[node.tag] = true;
      });
      tagNames = Object.keys(tags2);
    } else
      tagNames = [];
    for (const [handle, prefix] of tagEntries) {
      if (handle === "!!" && prefix === "tag:yaml.org,2002:")
        continue;
      if (!doc || tagNames.some((tn2) => tn2.startsWith(prefix)))
        lines.push(`%TAG ${handle} ${prefix}`);
    }
    return lines.join("\n");
  }
};
Directives.defaultYaml = { explicit: false, version: "1.2" };
Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

// node_modules/yaml/browser/dist/doc/anchors.js
function anchorIsValid(anchor) {
  if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
    const sa2 = JSON.stringify(anchor);
    const msg = `Anchor must not contain whitespace or control characters: ${sa2}`;
    throw new Error(msg);
  }
  return true;
}
function anchorNames(root) {
  const anchors = /* @__PURE__ */ new Set();
  visit(root, {
    Value(_key, node) {
      if (node.anchor)
        anchors.add(node.anchor);
    }
  });
  return anchors;
}
function findNewAnchor(prefix, exclude) {
  for (let i = 1; true; ++i) {
    const name2 = `${prefix}${i}`;
    if (!exclude.has(name2))
      return name2;
  }
}
function createNodeAnchors(doc, prefix) {
  const aliasObjects = [];
  const sourceObjects = /* @__PURE__ */ new Map();
  let prevAnchors = null;
  return {
    onAnchor: (source) => {
      aliasObjects.push(source);
      prevAnchors ?? (prevAnchors = anchorNames(doc));
      const anchor = findNewAnchor(prefix, prevAnchors);
      prevAnchors.add(anchor);
      return anchor;
    },
    /**
     * With circular references, the source node is only resolved after all
     * of its child nodes are. This is why anchors are set only after all of
     * the nodes have been created.
     */
    setAnchors: () => {
      for (const source of aliasObjects) {
        const ref = sourceObjects.get(source);
        if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
          ref.node.anchor = ref.anchor;
        } else {
          const error = new Error("Failed to resolve repeated object (this should not happen)");
          error.source = source;
          throw error;
        }
      }
    },
    sourceObjects
  };
}

// node_modules/yaml/browser/dist/doc/applyReviver.js
function applyReviver(reviver, obj, key, val) {
  if (val && typeof val === "object") {
    if (Array.isArray(val)) {
      for (let i = 0, len = val.length; i < len; ++i) {
        const v02 = val[i];
        const v1 = applyReviver(reviver, val, String(i), v02);
        if (v1 === void 0)
          delete val[i];
        else if (v1 !== v02)
          val[i] = v1;
      }
    } else if (val instanceof Map) {
      for (const k of Array.from(val.keys())) {
        const v02 = val.get(k);
        const v1 = applyReviver(reviver, val, k, v02);
        if (v1 === void 0)
          val.delete(k);
        else if (v1 !== v02)
          val.set(k, v1);
      }
    } else if (val instanceof Set) {
      for (const v02 of Array.from(val)) {
        const v1 = applyReviver(reviver, val, v02, v02);
        if (v1 === void 0)
          val.delete(v02);
        else if (v1 !== v02) {
          val.delete(v02);
          val.add(v1);
        }
      }
    } else {
      for (const [k, v02] of Object.entries(val)) {
        const v1 = applyReviver(reviver, val, k, v02);
        if (v1 === void 0)
          delete val[k];
        else if (v1 !== v02)
          val[k] = v1;
      }
    }
  }
  return reviver.call(obj, key, val);
}

// node_modules/yaml/browser/dist/nodes/toJS.js
function toJS(value, arg, ctx) {
  if (Array.isArray(value))
    return value.map((v2, i) => toJS(v2, String(i), ctx));
  if (value && typeof value.toJSON === "function") {
    if (!ctx || !hasAnchor(value))
      return value.toJSON(arg, ctx);
    const data = { aliasCount: 0, count: 1, res: void 0 };
    ctx.anchors.set(value, data);
    ctx.onCreate = (res2) => {
      data.res = res2;
      delete ctx.onCreate;
    };
    const res = value.toJSON(arg, ctx);
    if (ctx.onCreate)
      ctx.onCreate(res);
    return res;
  }
  if (typeof value === "bigint" && !ctx?.keep)
    return Number(value);
  return value;
}

// node_modules/yaml/browser/dist/nodes/Node.js
var NodeBase = class {
  constructor(type) {
    Object.defineProperty(this, NODE_TYPE, { value: type });
  }
  /** Create a copy of this node.  */
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** A plain JavaScript representation of this node. */
  toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    if (!isDocument(doc))
      throw new TypeError("A document argument is required");
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc,
      keep: true,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this, "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
};

// node_modules/yaml/browser/dist/nodes/Alias.js
var Alias = class extends NodeBase {
  constructor(source) {
    super(ALIAS);
    this.source = source;
    Object.defineProperty(this, "tag", {
      set() {
        throw new Error("Alias nodes cannot have tags");
      }
    });
  }
  /**
   * Resolve the value of this alias within `doc`, finding the last
   * instance of the `source` anchor before this node.
   */
  resolve(doc, ctx) {
    if (ctx?.maxAliasCount === 0)
      throw new ReferenceError("Alias resolution is disabled");
    let nodes;
    if (ctx?.aliasResolveCache) {
      nodes = ctx.aliasResolveCache;
    } else {
      nodes = [];
      visit(doc, {
        Node: (_key, node) => {
          if (isAlias(node) || hasAnchor(node))
            nodes.push(node);
        }
      });
      if (ctx)
        ctx.aliasResolveCache = nodes;
    }
    let found = void 0;
    for (const node of nodes) {
      if (node === this)
        break;
      if (node.anchor === this.source)
        found = node;
    }
    if (found && ctx) {
      const { anchors, doc: doc2, maxAliasCount } = ctx;
      let data = anchors.get(found);
      if (!data) {
        toJS(found, null, ctx);
        data = anchors.get(found);
      }
      if (data?.res === void 0) {
        const msg = "This should not happen: Alias anchor was not resolved?";
        throw new ReferenceError(msg);
      }
      if (maxAliasCount >= 0) {
        data.count += 1;
        if (data.aliasCount === 0)
          data.aliasCount = getAliasCount(doc2, found, anchors);
        if (data.count * data.aliasCount > maxAliasCount) {
          const msg = "Excessive alias count indicates a resource exhaustion attack";
          throw new ReferenceError(msg);
        }
      }
    }
    return found;
  }
  toJSON(_arg, ctx) {
    if (!ctx)
      return { source: this.source };
    const source = this.resolve(ctx.doc, ctx);
    if (!source) {
      const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
      throw new ReferenceError(msg);
    }
    return ctx.anchors.get(source).res;
  }
  toString(ctx, _onComment, _onChompKeep) {
    const src = `*${this.source}`;
    if (ctx) {
      anchorIsValid(this.source);
      if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new Error(msg);
      }
      if (ctx.implicitKey)
        return `${src} `;
    }
    return src;
  }
};
function getAliasCount(doc, node, anchors) {
  if (isAlias(node)) {
    const source = node.resolve(doc);
    const anchor = anchors && source && anchors.get(source);
    return anchor ? anchor.count * anchor.aliasCount : 0;
  } else if (isCollection(node)) {
    let count = 0;
    for (const item of node.items) {
      const c = getAliasCount(doc, item, anchors);
      if (c > count)
        count = c;
    }
    return count;
  } else if (isPair(node)) {
    const kc2 = getAliasCount(doc, node.key, anchors);
    const vc2 = getAliasCount(doc, node.value, anchors);
    return Math.max(kc2, vc2);
  }
  return 1;
}

// node_modules/yaml/browser/dist/nodes/Scalar.js
var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
var Scalar = class extends NodeBase {
  constructor(value) {
    super(SCALAR);
    this.value = value;
  }
  toJSON(arg, ctx) {
    return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
  }
  toString() {
    return String(this.value);
  }
};
Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
Scalar.PLAIN = "PLAIN";
Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

// node_modules/yaml/browser/dist/doc/createNode.js
var defaultTagPrefix = "tag:yaml.org,2002:";
function findTagObject(value, tagName, tags2) {
  if (tagName) {
    const match = tags2.filter((t33) => t33.tag === tagName);
    const tagObj = match.find((t33) => !t33.format) ?? match[0];
    if (!tagObj)
      throw new Error(`Tag ${tagName} not found`);
    return tagObj;
  }
  return tags2.find((t33) => t33.identify?.(value) && !t33.format);
}
function createNode(value, tagName, ctx) {
  if (isDocument(value))
    value = value.contents;
  if (isNode(value))
    return value;
  if (isPair(value)) {
    const map2 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
    map2.items.push(value);
    return map2;
  }
  if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
    value = value.valueOf();
  }
  const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
  let ref = void 0;
  if (aliasDuplicateObjects && value && typeof value === "object") {
    ref = sourceObjects.get(value);
    if (ref) {
      ref.anchor ?? (ref.anchor = onAnchor(value));
      return new Alias(ref.anchor);
    } else {
      ref = { anchor: null, node: null };
      sourceObjects.set(value, ref);
    }
  }
  if (tagName?.startsWith("!!"))
    tagName = defaultTagPrefix + tagName.slice(2);
  let tagObj = findTagObject(value, tagName, schema4.tags);
  if (!tagObj) {
    if (value && typeof value.toJSON === "function") {
      value = value.toJSON();
    }
    if (!value || typeof value !== "object") {
      const node2 = new Scalar(value);
      if (ref)
        ref.node = node2;
      return node2;
    }
    tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
  }
  if (onTagObj) {
    onTagObj(tagObj);
    delete ctx.onTagObj;
  }
  const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
  if (tagName)
    node.tag = tagName;
  else if (!tagObj.default)
    node.tag = tagObj.tag;
  if (ref)
    ref.node = node;
  return node;
}

// node_modules/yaml/browser/dist/nodes/Collection.js
function collectionFromPath(schema4, path, value) {
  let v2 = value;
  for (let i = path.length - 1; i >= 0; --i) {
    const k = path[i];
    if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
      const a = [];
      a[k] = v2;
      v2 = a;
    } else {
      v2 = /* @__PURE__ */ new Map([[k, v2]]);
    }
  }
  return createNode(v2, void 0, {
    aliasDuplicateObjects: false,
    keepUndefined: false,
    onAnchor: () => {
      throw new Error("This should not happen, please report a bug.");
    },
    schema: schema4,
    sourceObjects: /* @__PURE__ */ new Map()
  });
}
var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
var Collection = class extends NodeBase {
  constructor(type, schema4) {
    super(type);
    Object.defineProperty(this, "schema", {
      value: schema4,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
  /**
   * Create a copy of this collection.
   *
   * @param schema - If defined, overwrites the original's schema
   */
  clone(schema4) {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (schema4)
      copy.schema = schema4;
    copy.items = copy.items.map((it2) => isNode(it2) || isPair(it2) ? it2.clone(schema4) : it2);
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /**
   * Adds a value to the collection. For `!!map` and `!!omap` the value must
   * be a Pair instance or a `{ key, value }` object, which may not have a key
   * that already exists in the map.
   */
  addIn(path, value) {
    if (isEmptyPath(path))
      this.add(value);
    else {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (isCollection(node))
        node.addIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
  /**
   * Removes a value from the collection.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    const [key, ...rest] = path;
    if (rest.length === 0)
      return this.delete(key);
    const node = this.get(key, true);
    if (isCollection(node))
      return node.deleteIn(rest);
    else
      throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    const [key, ...rest] = path;
    const node = this.get(key, true);
    if (rest.length === 0)
      return !keepScalar && isScalar(node) ? node.value : node;
    else
      return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
  }
  hasAllNullValues(allowScalar) {
    return this.items.every((node) => {
      if (!isPair(node))
        return false;
      const n = node.value;
      return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
    });
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   */
  hasIn(path) {
    const [key, ...rest] = path;
    if (rest.length === 0)
      return this.has(key);
    const node = this.get(key, true);
    return isCollection(node) ? node.hasIn(rest) : false;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    const [key, ...rest] = path;
    if (rest.length === 0) {
      this.set(key, value);
    } else {
      const node = this.get(key, true);
      if (isCollection(node))
        node.setIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyComment.js
var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
function indentComment(comment2, indent) {
  if (/^\n+$/.test(comment2))
    return comment2.substring(1);
  return indent ? comment2.replace(/^(?! *$)/gm, indent) : comment2;
}
var lineComment = (str, indent, comment2) => str.endsWith("\n") ? indentComment(comment2, indent) : comment2.includes("\n") ? "\n" + indentComment(comment2, indent) : (str.endsWith(" ") ? "" : " ") + comment2;

// node_modules/yaml/browser/dist/stringify/foldFlowLines.js
var FOLD_FLOW = "flow";
var FOLD_BLOCK = "block";
var FOLD_QUOTED = "quoted";
function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
  if (!lineWidth || lineWidth < 0)
    return text;
  if (lineWidth < minContentWidth)
    minContentWidth = 0;
  const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
  if (text.length <= endStep)
    return text;
  const folds = [];
  const escapedFolds = {};
  let end = lineWidth - indent.length;
  if (typeof indentAtStart === "number") {
    if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
      folds.push(0);
    else
      end = lineWidth - indentAtStart;
  }
  let split = void 0;
  let prev = void 0;
  let overflow = false;
  let i = -1;
  let escStart = -1;
  let escEnd = -1;
  if (mode === FOLD_BLOCK) {
    i = consumeMoreIndentedLines(text, i, indent.length);
    if (i !== -1)
      end = i + endStep;
  }
  for (let ch; ch = text[i += 1]; ) {
    if (mode === FOLD_QUOTED && ch === "\\") {
      escStart = i;
      switch (text[i + 1]) {
        case "x":
          i += 3;
          break;
        case "u":
          i += 5;
          break;
        case "U":
          i += 9;
          break;
        default:
          i += 1;
      }
      escEnd = i;
    }
    if (ch === "\n") {
      if (mode === FOLD_BLOCK)
        i = consumeMoreIndentedLines(text, i, indent.length);
      end = i + indent.length + endStep;
      split = void 0;
    } else {
      if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
        const next = text[i + 1];
        if (next && next !== " " && next !== "\n" && next !== "	")
          split = i;
      }
      if (i >= end) {
        if (split) {
          folds.push(split);
          end = split + endStep;
          split = void 0;
        } else if (mode === FOLD_QUOTED) {
          while (prev === " " || prev === "	") {
            prev = ch;
            ch = text[i += 1];
            overflow = true;
          }
          const j = i > escEnd + 1 ? i - 2 : escStart - 1;
          if (escapedFolds[j])
            return text;
          folds.push(j);
          escapedFolds[j] = true;
          end = j + endStep;
          split = void 0;
        } else {
          overflow = true;
        }
      }
    }
    prev = ch;
  }
  if (overflow && onOverflow)
    onOverflow();
  if (folds.length === 0)
    return text;
  if (onFold)
    onFold();
  let res = text.slice(0, folds[0]);
  for (let i2 = 0; i2 < folds.length; ++i2) {
    const fold = folds[i2];
    const end2 = folds[i2 + 1] || text.length;
    if (fold === 0)
      res = `
${indent}${text.slice(0, end2)}`;
    else {
      if (mode === FOLD_QUOTED && escapedFolds[fold])
        res += `${text[fold]}\\`;
      res += `
${indent}${text.slice(fold + 1, end2)}`;
    }
  }
  return res;
}
function consumeMoreIndentedLines(text, i, indent) {
  let end = i;
  let start = i + 1;
  let ch = text[start];
  while (ch === " " || ch === "	") {
    if (i < start + indent) {
      ch = text[++i];
    } else {
      do {
        ch = text[++i];
      } while (ch && ch !== "\n");
      end = i;
      start = i + 1;
      ch = text[start];
    }
  }
  return end;
}

// node_modules/yaml/browser/dist/stringify/stringifyString.js
var getFoldOptions = (ctx, isBlock2) => ({
  indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
  lineWidth: ctx.options.lineWidth,
  minContentWidth: ctx.options.minContentWidth
});
var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
  if (!lineWidth || lineWidth < 0)
    return false;
  const limit = lineWidth - indentLength;
  const strLen = str.length;
  if (strLen <= limit)
    return false;
  for (let i = 0, start = 0; i < strLen; ++i) {
    if (str[i] === "\n") {
      if (i - start > limit)
        return true;
      start = i + 1;
      if (strLen - start <= limit)
        return false;
    }
  }
  return true;
}
function doubleQuotedString(value, ctx) {
  const json = JSON.stringify(value);
  if (ctx.options.doubleQuotedAsJSON)
    return json;
  const { implicitKey } = ctx;
  const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  let str = "";
  let start = 0;
  for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
    if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
      str += json.slice(start, i) + "\\ ";
      i += 1;
      start = i;
      ch = "\\";
    }
    if (ch === "\\")
      switch (json[i + 1]) {
        case "u":
          {
            str += json.slice(start, i);
            const code = json.substr(i + 2, 4);
            switch (code) {
              case "0000":
                str += "\\0";
                break;
              case "0007":
                str += "\\a";
                break;
              case "000b":
                str += "\\v";
                break;
              case "001b":
                str += "\\e";
                break;
              case "0085":
                str += "\\N";
                break;
              case "00a0":
                str += "\\_";
                break;
              case "2028":
                str += "\\L";
                break;
              case "2029":
                str += "\\P";
                break;
              default:
                if (code.substr(0, 2) === "00")
                  str += "\\x" + code.substr(2);
                else
                  str += json.substr(i, 6);
            }
            i += 5;
            start = i + 1;
          }
          break;
        case "n":
          if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
            i += 1;
          } else {
            str += json.slice(start, i) + "\n\n";
            while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
              str += "\n";
              i += 2;
            }
            str += indent;
            if (json[i + 2] === " ")
              str += "\\";
            i += 1;
            start = i + 1;
          }
          break;
        default:
          i += 1;
      }
  }
  str = start ? str + json.slice(start) : json;
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
  if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
    return doubleQuotedString(value, ctx);
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
  return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
  const { singleQuote } = ctx.options;
  let qs2;
  if (singleQuote === false)
    qs2 = doubleQuotedString;
  else {
    const hasDouble = value.includes('"');
    const hasSingle = value.includes("'");
    if (hasDouble && !hasSingle)
      qs2 = singleQuotedString;
    else if (hasSingle && !hasDouble)
      qs2 = doubleQuotedString;
    else
      qs2 = singleQuote ? singleQuotedString : doubleQuotedString;
  }
  return qs2(value, ctx);
}
var blockEndNewlines;
try {
  blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
} catch {
  blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment: comment2, type, value }, ctx, onComment, onChompKeep) {
  const { blockQuote, commentString, lineWidth } = ctx.options;
  if (!blockQuote || /\n[\t ]+$/.test(value)) {
    return quotedString(value, ctx);
  }
  const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
  const literal2 = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
  if (!value)
    return literal2 ? "|\n" : ">\n";
  let chomp;
  let endStart;
  for (endStart = value.length; endStart > 0; --endStart) {
    const ch = value[endStart - 1];
    if (ch !== "\n" && ch !== "	" && ch !== " ")
      break;
  }
  let end = value.substring(endStart);
  const endNlPos = end.indexOf("\n");
  if (endNlPos === -1) {
    chomp = "-";
  } else if (value === end || endNlPos !== end.length - 1) {
    chomp = "+";
    if (onChompKeep)
      onChompKeep();
  } else {
    chomp = "";
  }
  if (end) {
    value = value.slice(0, -end.length);
    if (end[end.length - 1] === "\n")
      end = end.slice(0, -1);
    end = end.replace(blockEndNewlines, `$&${indent}`);
  }
  let startWithSpace = false;
  let startEnd;
  let startNlPos = -1;
  for (startEnd = 0; startEnd < value.length; ++startEnd) {
    const ch = value[startEnd];
    if (ch === " ")
      startWithSpace = true;
    else if (ch === "\n")
      startNlPos = startEnd;
    else
      break;
  }
  let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
  if (start) {
    value = value.substring(start.length);
    start = start.replace(/\n+/g, `$&${indent}`);
  }
  const indentSize = indent ? "2" : "1";
  let header2 = (startWithSpace ? indentSize : "") + chomp;
  if (comment2) {
    header2 += " " + commentString(comment2.replace(/ ?[\r\n]+/g, " "));
    if (onComment)
      onComment();
  }
  if (!literal2) {
    const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
    let literalFallback = false;
    const foldOptions = getFoldOptions(ctx, true);
    if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
      foldOptions.onOverflow = () => {
        literalFallback = true;
      };
    }
    const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
    if (!literalFallback)
      return `>${header2}
${indent}${body}`;
  }
  value = value.replace(/\n+/g, `$&${indent}`);
  return `|${header2}
${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
  const { type, value } = item;
  const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
  if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
    return quotedString(value, ctx);
  }
  if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
    return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
  }
  if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
    return blockString(item, ctx, onComment, onChompKeep);
  }
  if (containsDocumentMarker(value)) {
    if (indent === "") {
      ctx.forceBlockIndent = true;
      return blockString(item, ctx, onComment, onChompKeep);
    } else if (implicitKey && indent === indentStep) {
      return quotedString(value, ctx);
    }
  }
  const str = value.replace(/\n+/g, `$&
${indent}`);
  if (actualString) {
    const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
    const { compat, tags: tags2 } = ctx.doc.schema;
    if (tags2.some(test) || compat?.some(test))
      return quotedString(value, ctx);
  }
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
  const { implicitKey, inFlow } = ctx;
  const ss2 = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
  let { type } = item;
  if (type !== Scalar.QUOTE_DOUBLE) {
    if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss2.value))
      type = Scalar.QUOTE_DOUBLE;
  }
  const _stringify = (_type) => {
    switch (_type) {
      case Scalar.BLOCK_FOLDED:
      case Scalar.BLOCK_LITERAL:
        return implicitKey || inFlow ? quotedString(ss2.value, ctx) : blockString(ss2, ctx, onComment, onChompKeep);
      case Scalar.QUOTE_DOUBLE:
        return doubleQuotedString(ss2.value, ctx);
      case Scalar.QUOTE_SINGLE:
        return singleQuotedString(ss2.value, ctx);
      case Scalar.PLAIN:
        return plainString(ss2, ctx, onComment, onChompKeep);
      default:
        return null;
    }
  };
  let res = _stringify(type);
  if (res === null) {
    const { defaultKeyType, defaultStringType } = ctx.options;
    const t33 = implicitKey && defaultKeyType || defaultStringType;
    res = _stringify(t33);
    if (res === null)
      throw new Error(`Unsupported default string type ${t33}`);
  }
  return res;
}

// node_modules/yaml/browser/dist/stringify/stringify.js
function createStringifyContext(doc, options) {
  const opt = Object.assign({
    blockQuote: true,
    commentString: stringifyComment,
    defaultKeyType: null,
    defaultStringType: "PLAIN",
    directives: null,
    doubleQuotedAsJSON: false,
    doubleQuotedMinMultiLineLength: 40,
    falseStr: "false",
    flowCollectionPadding: true,
    indentSeq: true,
    lineWidth: 80,
    minContentWidth: 20,
    nullStr: "null",
    simpleKeys: false,
    singleQuote: null,
    trailingComma: false,
    trueStr: "true",
    verifyAliasOrder: true
  }, doc.schema.toStringOptions, options);
  let inFlow;
  switch (opt.collectionStyle) {
    case "block":
      inFlow = false;
      break;
    case "flow":
      inFlow = true;
      break;
    default:
      inFlow = null;
  }
  return {
    anchors: /* @__PURE__ */ new Set(),
    doc,
    flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
    indent: "",
    indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
    inFlow,
    options: opt
  };
}
function getTagObject(tags2, item) {
  if (item.tag) {
    const match = tags2.filter((t33) => t33.tag === item.tag);
    if (match.length > 0)
      return match.find((t33) => t33.format === item.format) ?? match[0];
  }
  let tagObj = void 0;
  let obj;
  if (isScalar(item)) {
    obj = item.value;
    let match = tags2.filter((t33) => t33.identify?.(obj));
    if (match.length > 1) {
      const testMatch = match.filter((t33) => t33.test);
      if (testMatch.length > 0)
        match = testMatch;
    }
    tagObj = match.find((t33) => t33.format === item.format) ?? match.find((t33) => !t33.format);
  } else {
    obj = item;
    tagObj = tags2.find((t33) => t33.nodeClass && obj instanceof t33.nodeClass);
  }
  if (!tagObj) {
    const name2 = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
    throw new Error(`Tag not resolved for ${name2} value`);
  }
  return tagObj;
}
function stringifyProps(node, tagObj, { anchors, doc }) {
  if (!doc.directives)
    return "";
  const props = [];
  const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
  if (anchor && anchorIsValid(anchor)) {
    anchors.add(anchor);
    props.push(`&${anchor}`);
  }
  const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
  if (tag)
    props.push(doc.directives.tagString(tag));
  return props.join(" ");
}
function stringify(item, ctx, onComment, onChompKeep) {
  if (isPair(item))
    return item.toString(ctx, onComment, onChompKeep);
  if (isAlias(item)) {
    if (ctx.doc.directives)
      return item.toString(ctx);
    if (ctx.resolvedAliases?.has(item)) {
      throw new TypeError(`Cannot stringify circular structure without alias nodes`);
    } else {
      if (ctx.resolvedAliases)
        ctx.resolvedAliases.add(item);
      else
        ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
      item = item.resolve(ctx.doc);
    }
  }
  let tagObj = void 0;
  const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
  tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
  const props = stringifyProps(node, tagObj, ctx);
  if (props.length > 0)
    ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
  const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
  if (!props)
    return str;
  return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
}

// node_modules/yaml/browser/dist/stringify/stringifyPair.js
function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
  const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
  let keyComment = isNode(key) && key.comment || null;
  if (simpleKeys) {
    if (keyComment) {
      throw new Error("With simple keys, key nodes cannot have comments");
    }
    if (isCollection(key) || !isNode(key) && typeof key === "object") {
      const msg = "With simple keys, collection cannot be used as a key value";
      throw new Error(msg);
    }
  }
  let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
  ctx = Object.assign({}, ctx, {
    allNullValues: false,
    implicitKey: !explicitKey && (simpleKeys || !allNullValues),
    indent: indent + indentStep
  });
  let keyCommentDone = false;
  let chompKeep = false;
  let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
  if (!explicitKey && !ctx.inFlow && str.length > 1024) {
    if (simpleKeys)
      throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
    explicitKey = true;
  }
  if (ctx.inFlow) {
    if (allNullValues || value == null) {
      if (keyCommentDone && onComment)
        onComment();
      return str === "" ? "?" : explicitKey ? `? ${str}` : str;
    }
  } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
    str = `? ${str}`;
    if (keyComment && !keyCommentDone) {
      str += lineComment(str, ctx.indent, commentString(keyComment));
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  if (keyCommentDone)
    keyComment = null;
  if (explicitKey) {
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
    str = `? ${str}
${indent}:`;
  } else {
    str = `${str}:`;
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
  }
  let vsb, vcb, valueComment;
  if (isNode(value)) {
    vsb = !!value.spaceBefore;
    vcb = value.commentBefore;
    valueComment = value.comment;
  } else {
    vsb = false;
    vcb = null;
    valueComment = null;
    if (value && typeof value === "object")
      value = doc.createNode(value);
  }
  ctx.implicitKey = false;
  if (!explicitKey && !keyComment && isScalar(value))
    ctx.indentAtStart = str.length + 1;
  chompKeep = false;
  if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
    ctx.indent = ctx.indent.substring(2);
  }
  let valueCommentDone = false;
  const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
  let ws2 = " ";
  if (keyComment || vsb || vcb) {
    ws2 = vsb ? "\n" : "";
    if (vcb) {
      const cs2 = commentString(vcb);
      ws2 += `
${indentComment(cs2, ctx.indent)}`;
    }
    if (valueStr === "" && !ctx.inFlow) {
      if (ws2 === "\n" && valueComment)
        ws2 = "\n\n";
    } else {
      ws2 += `
${ctx.indent}`;
    }
  } else if (!explicitKey && isCollection(value)) {
    const vs0 = valueStr[0];
    const nl0 = valueStr.indexOf("\n");
    const hasNewline = nl0 !== -1;
    const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
    if (hasNewline || !flow) {
      let hasPropsLine = false;
      if (hasNewline && (vs0 === "&" || vs0 === "!")) {
        let sp0 = valueStr.indexOf(" ");
        if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
          sp0 = valueStr.indexOf(" ", sp0 + 1);
        }
        if (sp0 === -1 || nl0 < sp0)
          hasPropsLine = true;
      }
      if (!hasPropsLine)
        ws2 = `
${ctx.indent}`;
    }
  } else if (valueStr === "" || valueStr[0] === "\n") {
    ws2 = "";
  }
  str += ws2 + valueStr;
  if (ctx.inFlow) {
    if (valueCommentDone && onComment)
      onComment();
  } else if (valueComment && !valueCommentDone) {
    str += lineComment(str, ctx.indent, commentString(valueComment));
  } else if (chompKeep && onChompKeep) {
    onChompKeep();
  }
  return str;
}

// node_modules/yaml/browser/dist/log.js
function warn(logLevel, warning) {
  if (logLevel === "debug" || logLevel === "warn") {
    console.warn(warning);
  }
}

// node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
var MERGE_KEY = "<<";
var merge = {
  identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
  default: "key",
  tag: "tag:yaml.org,2002:merge",
  test: /^<<$/,
  resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
    addToJSMap: addMergeToJSMap
  }),
  stringify: () => MERGE_KEY
};
var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map2, value) {
  const source = resolveAliasValue(ctx, value);
  if (isSeq(source))
    for (const it2 of source.items)
      mergeValue(ctx, map2, it2);
  else if (Array.isArray(source))
    for (const it2 of source)
      mergeValue(ctx, map2, it2);
  else
    mergeValue(ctx, map2, source);
}
function mergeValue(ctx, map2, value) {
  const source = resolveAliasValue(ctx, value);
  if (!isMap(source))
    throw new Error("Merge sources must be maps or map aliases");
  const srcMap = source.toJSON(null, ctx, Map);
  for (const [key, value2] of srcMap) {
    if (map2 instanceof Map) {
      if (!map2.has(key))
        map2.set(key, value2);
    } else if (map2 instanceof Set) {
      map2.add(key);
    } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
      Object.defineProperty(map2, key, {
        value: value2,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
  return map2;
}
function resolveAliasValue(ctx, value) {
  return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
}

// node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
function addPairToJSMap(ctx, map2, { key, value }) {
  if (isNode(key) && key.addToJSMap)
    key.addToJSMap(ctx, map2, value);
  else if (isMergeKey(ctx, key))
    addMergeToJSMap(ctx, map2, value);
  else {
    const jsKey = toJS(key, "", ctx);
    if (map2 instanceof Map) {
      map2.set(jsKey, toJS(value, jsKey, ctx));
    } else if (map2 instanceof Set) {
      map2.add(jsKey);
    } else {
      const stringKey = stringifyKey(key, jsKey, ctx);
      const jsValue = toJS(value, stringKey, ctx);
      if (stringKey in map2)
        Object.defineProperty(map2, stringKey, {
          value: jsValue,
          writable: true,
          enumerable: true,
          configurable: true
        });
      else
        map2[stringKey] = jsValue;
    }
  }
  return map2;
}
function stringifyKey(key, jsKey, ctx) {
  if (jsKey === null)
    return "";
  if (typeof jsKey !== "object")
    return String(jsKey);
  if (isNode(key) && ctx?.doc) {
    const strCtx = createStringifyContext(ctx.doc, {});
    strCtx.anchors = /* @__PURE__ */ new Set();
    for (const node of ctx.anchors.keys())
      strCtx.anchors.add(node.anchor);
    strCtx.inFlow = true;
    strCtx.inStringifyKey = true;
    const strKey = key.toString(strCtx);
    if (!ctx.mapKeyWarned) {
      let jsonStr = JSON.stringify(strKey);
      if (jsonStr.length > 40)
        jsonStr = jsonStr.substring(0, 36) + '..."';
      warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
      ctx.mapKeyWarned = true;
    }
    return strKey;
  }
  return JSON.stringify(jsKey);
}

// node_modules/yaml/browser/dist/nodes/Pair.js
function createPair(key, value, ctx) {
  const k = createNode(key, void 0, ctx);
  const v2 = createNode(value, void 0, ctx);
  return new Pair(k, v2);
}
var Pair = class _Pair {
  constructor(key, value = null) {
    Object.defineProperty(this, NODE_TYPE, { value: PAIR });
    this.key = key;
    this.value = value;
  }
  clone(schema4) {
    let { key, value } = this;
    if (isNode(key))
      key = key.clone(schema4);
    if (isNode(value))
      value = value.clone(schema4);
    return new _Pair(key, value);
  }
  toJSON(_, ctx) {
    const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    return addPairToJSMap(ctx, pair, this);
  }
  toString(ctx, onComment, onChompKeep) {
    return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyCollection.js
function stringifyCollection(collection, ctx, options) {
  const flow = ctx.inFlow ?? collection.flow;
  const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
  return stringify4(collection, ctx, options);
}
function stringifyBlockCollection({ comment: comment2, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
  const { indent, options: { commentString } } = ctx;
  const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
  let chompKeep = false;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment3 = null;
    if (isNode(item)) {
      if (!chompKeep && item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
      if (item.comment)
        comment3 = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (!chompKeep && ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
      }
    }
    chompKeep = false;
    let str2 = stringify(item, itemCtx, () => comment3 = null, () => chompKeep = true);
    if (comment3)
      str2 += lineComment(str2, itemIndent, commentString(comment3));
    if (chompKeep && comment3)
      chompKeep = false;
    lines.push(blockItemPrefix + str2);
  }
  let str;
  if (lines.length === 0) {
    str = flowChars.start + flowChars.end;
  } else {
    str = lines[0];
    for (let i = 1; i < lines.length; ++i) {
      const line = lines[i];
      str += line ? `
${indent}${line}` : "\n";
    }
  }
  if (comment2) {
    str += "\n" + indentComment(commentString(comment2), indent);
    if (onComment)
      onComment();
  } else if (chompKeep && onChompKeep)
    onChompKeep();
  return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
  const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
  itemIndent += indentStep;
  const itemCtx = Object.assign({}, ctx, {
    indent: itemIndent,
    inFlow: true,
    type: null
  });
  let reqNewline = false;
  let linesAtValue = 0;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment2 = null;
    if (isNode(item)) {
      if (item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, false);
      if (item.comment)
        comment2 = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, false);
        if (ik.comment)
          reqNewline = true;
      }
      const iv = isNode(item.value) ? item.value : null;
      if (iv) {
        if (iv.comment)
          comment2 = iv.comment;
        if (iv.commentBefore)
          reqNewline = true;
      } else if (item.value == null && ik?.comment) {
        comment2 = ik.comment;
      }
    }
    if (comment2)
      reqNewline = true;
    let str = stringify(item, itemCtx, () => comment2 = null);
    reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
    if (i < items.length - 1) {
      str += ",";
    } else if (ctx.options.trailingComma) {
      if (ctx.options.lineWidth > 0) {
        reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
      }
      if (reqNewline) {
        str += ",";
      }
    }
    if (comment2)
      str += lineComment(str, itemIndent, commentString(comment2));
    lines.push(str);
    linesAtValue = lines.length;
  }
  const { start, end } = flowChars;
  if (lines.length === 0) {
    return start + end;
  } else {
    if (!reqNewline) {
      const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
      reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
    }
    if (reqNewline) {
      let str = start;
      for (const line of lines)
        str += line ? `
${indentStep}${indent}${line}` : "\n";
      return `${str}
${indent}${end}`;
    } else {
      return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
    }
  }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment2, chompKeep) {
  if (comment2 && chompKeep)
    comment2 = comment2.replace(/^\n+/, "");
  if (comment2) {
    const ic2 = indentComment(commentString(comment2), indent);
    lines.push(ic2.trimStart());
  }
}

// node_modules/yaml/browser/dist/nodes/YAMLMap.js
function findPair(items, key) {
  const k = isScalar(key) ? key.value : key;
  for (const it2 of items) {
    if (isPair(it2)) {
      if (it2.key === key || it2.key === k)
        return it2;
      if (isScalar(it2.key) && it2.key.value === k)
        return it2;
    }
  }
  return void 0;
}
var YAMLMap = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:map";
  }
  constructor(schema4) {
    super(MAP, schema4);
    this.items = [];
  }
  /**
   * A generic collection parsing method that can be extended
   * to other node classes that inherit from YAMLMap
   */
  static from(schema4, obj, ctx) {
    const { keepUndefined, replacer } = ctx;
    const map2 = new this(schema4);
    const add = (key, value) => {
      if (typeof replacer === "function")
        value = replacer.call(obj, key, value);
      else if (Array.isArray(replacer) && !replacer.includes(key))
        return;
      if (value !== void 0 || keepUndefined)
        map2.items.push(createPair(key, value, ctx));
    };
    if (obj instanceof Map) {
      for (const [key, value] of obj)
        add(key, value);
    } else if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj))
        add(key, obj[key]);
    }
    if (typeof schema4.sortMapEntries === "function") {
      map2.items.sort(schema4.sortMapEntries);
    }
    return map2;
  }
  /**
   * Adds a value to the collection.
   *
   * @param overwrite - If not set `true`, using a key that is already in the
   *   collection will throw. Otherwise, overwrites the previous value.
   */
  add(pair, overwrite) {
    let _pair;
    if (isPair(pair))
      _pair = pair;
    else if (!pair || typeof pair !== "object" || !("key" in pair)) {
      _pair = new Pair(pair, pair?.value);
    } else
      _pair = new Pair(pair.key, pair.value);
    const prev = findPair(this.items, _pair.key);
    const sortEntries = this.schema?.sortMapEntries;
    if (prev) {
      if (!overwrite)
        throw new Error(`Key ${_pair.key} already set`);
      if (isScalar(prev.value) && isScalarValue(_pair.value))
        prev.value.value = _pair.value;
      else
        prev.value = _pair.value;
    } else if (sortEntries) {
      const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
      if (i === -1)
        this.items.push(_pair);
      else
        this.items.splice(i, 0, _pair);
    } else {
      this.items.push(_pair);
    }
  }
  delete(key) {
    const it2 = findPair(this.items, key);
    if (!it2)
      return false;
    const del = this.items.splice(this.items.indexOf(it2), 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const it2 = findPair(this.items, key);
    const node = it2?.value;
    return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
  }
  has(key) {
    return !!findPair(this.items, key);
  }
  set(key, value) {
    this.add(new Pair(key, value), true);
  }
  /**
   * @param ctx - Conversion context, originally set in Document#toJS()
   * @param {Class} Type - If set, forces the returned collection type
   * @returns Instance of Type, Map, or Object
   */
  toJSON(_, ctx, Type2) {
    const map2 = Type2 ? new Type2() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const item of this.items)
      addPairToJSMap(ctx, map2, item);
    return map2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    for (const item of this.items) {
      if (!isPair(item))
        throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
    }
    if (!ctx.allNullValues && this.hasAllNullValues(false))
      ctx = Object.assign({}, ctx, { allNullValues: true });
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "",
      flowChars: { start: "{", end: "}" },
      itemIndent: ctx.indent || "",
      onChompKeep,
      onComment
    });
  }
};

// node_modules/yaml/browser/dist/schema/common/map.js
var map = {
  collection: "map",
  default: true,
  nodeClass: YAMLMap,
  tag: "tag:yaml.org,2002:map",
  resolve(map2, onError) {
    if (!isMap(map2))
      onError("Expected a mapping for this tag");
    return map2;
  },
  createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
};

// node_modules/yaml/browser/dist/nodes/YAMLSeq.js
var YAMLSeq = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:seq";
  }
  constructor(schema4) {
    super(SEQ, schema4);
    this.items = [];
  }
  add(value) {
    this.items.push(value);
  }
  /**
   * Removes a value from the collection.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   *
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return false;
    const del = this.items.splice(idx, 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return void 0;
    const it2 = this.items[idx];
    return !keepScalar && isScalar(it2) ? it2.value : it2;
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   */
  has(key) {
    const idx = asItemIndex(key);
    return typeof idx === "number" && idx < this.items.length;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   *
   * If `key` does not contain a representation of an integer, this will throw.
   * It may be wrapped in a `Scalar`.
   */
  set(key, value) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      throw new Error(`Expected a valid index, not ${key}.`);
    const prev = this.items[idx];
    if (isScalar(prev) && isScalarValue(value))
      prev.value = value;
    else
      this.items[idx] = value;
  }
  toJSON(_, ctx) {
    const seq2 = [];
    if (ctx?.onCreate)
      ctx.onCreate(seq2);
    let i = 0;
    for (const item of this.items)
      seq2.push(toJS(item, String(i++), ctx));
    return seq2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "- ",
      flowChars: { start: "[", end: "]" },
      itemIndent: (ctx.indent || "") + "  ",
      onChompKeep,
      onComment
    });
  }
  static from(schema4, obj, ctx) {
    const { replacer } = ctx;
    const seq2 = new this(schema4);
    if (obj && Symbol.iterator in Object(obj)) {
      let i = 0;
      for (let it2 of obj) {
        if (typeof replacer === "function") {
          const key = obj instanceof Set ? it2 : String(i++);
          it2 = replacer.call(obj, key, it2);
        }
        seq2.items.push(createNode(it2, void 0, ctx));
      }
    }
    return seq2;
  }
};
function asItemIndex(key) {
  let idx = isScalar(key) ? key.value : key;
  if (idx && typeof idx === "string")
    idx = Number(idx);
  return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
}

// node_modules/yaml/browser/dist/schema/common/seq.js
var seq = {
  collection: "seq",
  default: true,
  nodeClass: YAMLSeq,
  tag: "tag:yaml.org,2002:seq",
  resolve(seq2, onError) {
    if (!isSeq(seq2))
      onError("Expected a sequence for this tag");
    return seq2;
  },
  createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
};

// node_modules/yaml/browser/dist/schema/common/string.js
var string2 = {
  identify: (value) => typeof value === "string",
  default: true,
  tag: "tag:yaml.org,2002:str",
  resolve: (str) => str,
  stringify(item, ctx, onComment, onChompKeep) {
    ctx = Object.assign({ actualString: true }, ctx);
    return stringifyString(item, ctx, onComment, onChompKeep);
  }
};

// node_modules/yaml/browser/dist/schema/common/null.js
var nullTag = {
  identify: (value) => value == null,
  createNode: () => new Scalar(null),
  default: true,
  tag: "tag:yaml.org,2002:null",
  test: /^(?:~|[Nn]ull|NULL)?$/,
  resolve: () => new Scalar(null),
  stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
};

// node_modules/yaml/browser/dist/schema/core/bool.js
var boolTag = {
  identify: (value) => typeof value === "boolean",
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
  resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
  stringify({ source, value }, ctx) {
    if (source && boolTag.test.test(source)) {
      const sv = source[0] === "t" || source[0] === "T";
      if (value === sv)
        return source;
    }
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyNumber.js
function stringifyNumber({ format, minFractionDigits, tag, value }) {
  if (typeof value === "bigint")
    return String(value);
  const num = typeof value === "number" ? value : Number(value);
  if (!isFinite(num))
    return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
  let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
  if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
    let i = n.indexOf(".");
    if (i < 0) {
      i = n.length;
      n += ".";
    }
    let d = minFractionDigits - (n.length - i - 1);
    while (d-- > 0)
      n += "0";
  }
  return n;
}

// node_modules/yaml/browser/dist/schema/core/float.js
var floatNaN = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str));
    const dot = str.indexOf(".");
    if (dot !== -1 && str[str.length - 1] === "0")
      node.minFractionDigits = str.length - dot - 1;
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/yaml/browser/dist/schema/core/int.js
var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
function intStringify(node, radix, prefix) {
  const { value } = node;
  if (intIdentify(value) && value >= 0)
    return prefix + value.toString(radix);
  return stringifyNumber(node);
}
var intOct = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^0o[0-7]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
  stringify: (node) => intStringify(node, 8, "0o")
};
var int = {
  identify: intIdentify,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^0x[0-9a-fA-F]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
  stringify: (node) => intStringify(node, 16, "0x")
};

// node_modules/yaml/browser/dist/schema/core/schema.js
var schema = [
  map,
  seq,
  string2,
  nullTag,
  boolTag,
  intOct,
  int,
  intHex,
  floatNaN,
  floatExp,
  float
];

// node_modules/yaml/browser/dist/schema/json/schema.js
function intIdentify2(value) {
  return typeof value === "bigint" || Number.isInteger(value);
}
var stringifyJSON = ({ value }) => JSON.stringify(value);
var jsonScalars = [
  {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify: stringifyJSON
  },
  {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^null$/,
    resolve: () => null,
    stringify: stringifyJSON
  },
  {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^true$|^false$/,
    resolve: (str) => str === "true",
    stringify: stringifyJSON
  },
  {
    identify: intIdentify2,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^-?(?:0|[1-9][0-9]*)$/,
    resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
    stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
  },
  {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
    resolve: (str) => parseFloat(str),
    stringify: stringifyJSON
  }
];
var jsonError = {
  default: true,
  tag: "",
  test: /^/,
  resolve(str, onError) {
    onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
    return str;
  }
};
var schema2 = [map, seq].concat(jsonScalars, jsonError);

// node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
var binary = {
  identify: (value) => value instanceof Uint8Array,
  // Buffer inherits from Uint8Array
  default: false,
  tag: "tag:yaml.org,2002:binary",
  /**
   * Returns a Buffer in node and an Uint8Array in browsers
   *
   * To use the resulting buffer as an image, you'll want to do something like:
   *
   *   const blob = new Blob([buffer], { type: 'image/jpeg' })
   *   document.querySelector('#photo').src = URL.createObjectURL(blob)
   */
  resolve(src, onError) {
    if (typeof atob === "function") {
      const str = atob(src.replace(/[\n\r]/g, ""));
      const buffer = new Uint8Array(str.length);
      for (let i = 0; i < str.length; ++i)
        buffer[i] = str.charCodeAt(i);
      return buffer;
    } else {
      onError("This environment does not support reading binary tags; either Buffer or atob is required");
      return src;
    }
  },
  stringify({ comment: comment2, type, value }, ctx, onComment, onChompKeep) {
    if (!value)
      return "";
    const buf = value;
    let str;
    if (typeof btoa === "function") {
      let s = "";
      for (let i = 0; i < buf.length; ++i)
        s += String.fromCharCode(buf[i]);
      str = btoa(s);
    } else {
      throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
    }
    type ?? (type = Scalar.BLOCK_LITERAL);
    if (type !== Scalar.QUOTE_DOUBLE) {
      const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
      const n = Math.ceil(str.length / lineWidth);
      const lines = new Array(n);
      for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
        lines[i] = str.substr(o, lineWidth);
      }
      str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
    }
    return stringifyString({ comment: comment2, type, value: str }, ctx, onComment, onChompKeep);
  }
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
function resolvePairs(seq2, onError) {
  if (isSeq(seq2)) {
    for (let i = 0; i < seq2.items.length; ++i) {
      let item = seq2.items[i];
      if (isPair(item))
        continue;
      else if (isMap(item)) {
        if (item.items.length > 1)
          onError("Each pair must have its own sequence indicator");
        const pair = item.items[0] || new Pair(new Scalar(null));
        if (item.commentBefore)
          pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
        if (item.comment) {
          const cn2 = pair.value ?? pair.key;
          cn2.comment = cn2.comment ? `${item.comment}
${cn2.comment}` : item.comment;
        }
        item = pair;
      }
      seq2.items[i] = isPair(item) ? item : new Pair(item);
    }
  } else
    onError("Expected a sequence for this tag");
  return seq2;
}
function createPairs(schema4, iterable, ctx) {
  const { replacer } = ctx;
  const pairs2 = new YAMLSeq(schema4);
  pairs2.tag = "tag:yaml.org,2002:pairs";
  let i = 0;
  if (iterable && Symbol.iterator in Object(iterable))
    for (let it2 of iterable) {
      if (typeof replacer === "function")
        it2 = replacer.call(iterable, String(i++), it2);
      let key, value;
      if (Array.isArray(it2)) {
        if (it2.length === 2) {
          key = it2[0];
          value = it2[1];
        } else
          throw new TypeError(`Expected [key, value] tuple: ${it2}`);
      } else if (it2 && it2 instanceof Object) {
        const keys = Object.keys(it2);
        if (keys.length === 1) {
          key = keys[0];
          value = it2[key];
        } else {
          throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
        }
      } else {
        key = it2;
      }
      pairs2.items.push(createPair(key, value, ctx));
    }
  return pairs2;
}
var pairs = {
  collection: "seq",
  default: false,
  tag: "tag:yaml.org,2002:pairs",
  resolve: resolvePairs,
  createNode: createPairs
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
var YAMLOMap = class _YAMLOMap extends YAMLSeq {
  constructor() {
    super();
    this.add = YAMLMap.prototype.add.bind(this);
    this.delete = YAMLMap.prototype.delete.bind(this);
    this.get = YAMLMap.prototype.get.bind(this);
    this.has = YAMLMap.prototype.has.bind(this);
    this.set = YAMLMap.prototype.set.bind(this);
    this.tag = _YAMLOMap.tag;
  }
  /**
   * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
   * but TypeScript won't allow widening the signature of a child method.
   */
  toJSON(_, ctx) {
    if (!ctx)
      return super.toJSON(_);
    const map2 = /* @__PURE__ */ new Map();
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const pair of this.items) {
      let key, value;
      if (isPair(pair)) {
        key = toJS(pair.key, "", ctx);
        value = toJS(pair.value, key, ctx);
      } else {
        key = toJS(pair, "", ctx);
      }
      if (map2.has(key))
        throw new Error("Ordered maps must not include duplicate keys");
      map2.set(key, value);
    }
    return map2;
  }
  static from(schema4, iterable, ctx) {
    const pairs2 = createPairs(schema4, iterable, ctx);
    const omap2 = new this();
    omap2.items = pairs2.items;
    return omap2;
  }
};
YAMLOMap.tag = "tag:yaml.org,2002:omap";
var omap = {
  collection: "seq",
  identify: (value) => value instanceof Map,
  nodeClass: YAMLOMap,
  default: false,
  tag: "tag:yaml.org,2002:omap",
  resolve(seq2, onError) {
    const pairs2 = resolvePairs(seq2, onError);
    const seenKeys = [];
    for (const { key } of pairs2.items) {
      if (isScalar(key)) {
        if (seenKeys.includes(key.value)) {
          onError(`Ordered maps must not include duplicate keys: ${key.value}`);
        } else {
          seenKeys.push(key.value);
        }
      }
    }
    return Object.assign(new YAMLOMap(), pairs2);
  },
  createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
function boolStringify({ value, source }, ctx) {
  const boolObj = value ? trueTag : falseTag;
  if (source && boolObj.test.test(source))
    return source;
  return value ? ctx.options.trueStr : ctx.options.falseStr;
}
var trueTag = {
  identify: (value) => value === true,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
  resolve: () => new Scalar(true),
  stringify: boolStringify
};
var falseTag = {
  identify: (value) => value === false,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
  resolve: () => new Scalar(false),
  stringify: boolStringify
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
var floatNaN2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str.replace(/_/g, "")),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str.replace(/_/g, "")));
    const dot = str.indexOf(".");
    if (dot !== -1) {
      const f = str.substring(dot + 1).replace(/_/g, "");
      if (f[f.length - 1] === "0")
        node.minFractionDigits = f.length;
    }
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
function intResolve2(str, offset, radix, { intAsBigInt }) {
  const sign = str[0];
  if (sign === "-" || sign === "+")
    offset += 1;
  str = str.substring(offset).replace(/_/g, "");
  if (intAsBigInt) {
    switch (radix) {
      case 2:
        str = `0b${str}`;
        break;
      case 8:
        str = `0o${str}`;
        break;
      case 16:
        str = `0x${str}`;
        break;
    }
    const n2 = BigInt(str);
    return sign === "-" ? BigInt(-1) * n2 : n2;
  }
  const n = parseInt(str, radix);
  return sign === "-" ? -1 * n : n;
}
function intStringify2(node, radix, prefix) {
  const { value } = node;
  if (intIdentify3(value)) {
    const str = value.toString(radix);
    return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
  }
  return stringifyNumber(node);
}
var intBin = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "BIN",
  test: /^[-+]?0b[0-1_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
  stringify: (node) => intStringify2(node, 2, "0b")
};
var intOct2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^[-+]?0[0-7_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
  stringify: (node) => intStringify2(node, 8, "0")
};
var int2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9][0-9_]*$/,
  resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^[-+]?0x[0-9a-fA-F_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
  stringify: (node) => intStringify2(node, 16, "0x")
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
var YAMLSet = class _YAMLSet extends YAMLMap {
  constructor(schema4) {
    super(schema4);
    this.tag = _YAMLSet.tag;
  }
  add(key) {
    let pair;
    if (isPair(key))
      pair = key;
    else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
      pair = new Pair(key.key, null);
    else
      pair = new Pair(key, null);
    const prev = findPair(this.items, pair.key);
    if (!prev)
      this.items.push(pair);
  }
  /**
   * If `keepPair` is `true`, returns the Pair matching `key`.
   * Otherwise, returns the value of that Pair's key.
   */
  get(key, keepPair) {
    const pair = findPair(this.items, key);
    return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
  }
  set(key, value) {
    if (typeof value !== "boolean")
      throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
    const prev = findPair(this.items, key);
    if (prev && !value) {
      this.items.splice(this.items.indexOf(prev), 1);
    } else if (!prev && value) {
      this.items.push(new Pair(key));
    }
  }
  toJSON(_, ctx) {
    return super.toJSON(_, ctx, Set);
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    if (this.hasAllNullValues(true))
      return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
    else
      throw new Error("Set items must all have null values");
  }
  static from(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const set2 = new this(schema4);
    if (iterable && Symbol.iterator in Object(iterable))
      for (let value of iterable) {
        if (typeof replacer === "function")
          value = replacer.call(iterable, value, value);
        set2.items.push(createPair(value, null, ctx));
      }
    return set2;
  }
};
YAMLSet.tag = "tag:yaml.org,2002:set";
var set = {
  collection: "map",
  identify: (value) => value instanceof Set,
  nodeClass: YAMLSet,
  default: false,
  tag: "tag:yaml.org,2002:set",
  createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
  resolve(map2, onError) {
    if (isMap(map2)) {
      if (map2.hasAllNullValues(true))
        return Object.assign(new YAMLSet(), map2);
      else
        onError("Set items must all have null values");
    } else
      onError("Expected a mapping for this tag");
    return map2;
  }
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
function parseSexagesimal(str, asBigInt) {
  const sign = str[0];
  const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
  const num = (n) => asBigInt ? BigInt(n) : Number(n);
  const res = parts.replace(/_/g, "").split(":").reduce((res2, p2) => res2 * num(60) + num(p2), num(0));
  return sign === "-" ? num(-1) * res : res;
}
function stringifySexagesimal(node) {
  let { value } = node;
  let num = (n) => n;
  if (typeof value === "bigint")
    num = (n) => BigInt(n);
  else if (isNaN(value) || !isFinite(value))
    return stringifyNumber(node);
  let sign = "";
  if (value < 0) {
    sign = "-";
    value *= num(-1);
  }
  const _60 = num(60);
  const parts = [value % _60];
  if (value < 60) {
    parts.unshift(0);
  } else {
    value = (value - parts[0]) / _60;
    parts.unshift(value % _60);
    if (value >= 60) {
      value = (value - parts[0]) / _60;
      parts.unshift(value);
    }
  }
  return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
}
var intTime = {
  identify: (value) => typeof value === "bigint" || Number.isInteger(value),
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
  resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
  stringify: stringifySexagesimal
};
var floatTime = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
  resolve: (str) => parseSexagesimal(str, false),
  stringify: stringifySexagesimal
};
var timestamp = {
  identify: (value) => value instanceof Date,
  default: true,
  tag: "tag:yaml.org,2002:timestamp",
  // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
  // may be omitted altogether, resulting in a date format. In such a case, the time part is
  // assumed to be 00:00:00Z (start of day, UTC).
  test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
  resolve(str) {
    const match = str.match(timestamp.test);
    if (!match)
      throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
    const [, year, month, day, hour, minute, second] = match.map(Number);
    const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
    let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
    const tz = match[8];
    if (tz && tz !== "Z") {
      let d = parseSexagesimal(tz, false);
      if (Math.abs(d) < 30)
        d *= 60;
      date -= 6e4 * d;
    }
    return new Date(date);
  },
  stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
var schema3 = [
  map,
  seq,
  string2,
  nullTag,
  trueTag,
  falseTag,
  intBin,
  intOct2,
  int2,
  intHex2,
  floatNaN2,
  floatExp2,
  float2,
  binary,
  merge,
  omap,
  pairs,
  set,
  intTime,
  floatTime,
  timestamp
];

// node_modules/yaml/browser/dist/schema/tags.js
var schemas = /* @__PURE__ */ new Map([
  ["core", schema],
  ["failsafe", [map, seq, string2]],
  ["json", schema2],
  ["yaml11", schema3],
  ["yaml-1.1", schema3]
]);
var tagsByName = {
  binary,
  bool: boolTag,
  float,
  floatExp,
  floatNaN,
  floatTime,
  int,
  intHex,
  intOct,
  intTime,
  map,
  merge,
  null: nullTag,
  omap,
  pairs,
  seq,
  set,
  timestamp
};
var coreKnownTags = {
  "tag:yaml.org,2002:binary": binary,
  "tag:yaml.org,2002:merge": merge,
  "tag:yaml.org,2002:omap": omap,
  "tag:yaml.org,2002:pairs": pairs,
  "tag:yaml.org,2002:set": set,
  "tag:yaml.org,2002:timestamp": timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
  const schemaTags = schemas.get(schemaName);
  if (schemaTags && !customTags) {
    return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
  }
  let tags2 = schemaTags;
  if (!tags2) {
    if (Array.isArray(customTags))
      tags2 = [];
    else {
      const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
    }
  }
  if (Array.isArray(customTags)) {
    for (const tag of customTags)
      tags2 = tags2.concat(tag);
  } else if (typeof customTags === "function") {
    tags2 = customTags(tags2.slice());
  }
  if (addMergeTag)
    tags2 = tags2.concat(merge);
  return tags2.reduce((tags3, tag) => {
    const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
    if (!tagObj) {
      const tagName = JSON.stringify(tag);
      const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
    }
    if (!tags3.includes(tagObj))
      tags3.push(tagObj);
    return tags3;
  }, []);
}

// node_modules/yaml/browser/dist/schema/Schema.js
var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
var Schema = class _Schema {
  constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
    this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
    this.name = typeof schema4 === "string" && schema4 || "core";
    this.knownTags = resolveKnownTags ? coreKnownTags : {};
    this.tags = getTags(customTags, this.name, merge2);
    this.toStringOptions = toStringDefaults ?? null;
    Object.defineProperty(this, MAP, { value: map });
    Object.defineProperty(this, SCALAR, { value: string2 });
    Object.defineProperty(this, SEQ, { value: seq });
    this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
  }
  clone() {
    const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
    copy.tags = this.tags.slice();
    return copy;
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyDocument.js
function stringifyDocument(doc, options) {
  const lines = [];
  let hasDirectives = options.directives === true;
  if (options.directives !== false && doc.directives) {
    const dir = doc.directives.toString(doc);
    if (dir) {
      lines.push(dir);
      hasDirectives = true;
    } else if (doc.directives.docStart)
      hasDirectives = true;
  }
  if (hasDirectives)
    lines.push("---");
  const ctx = createStringifyContext(doc, options);
  const { commentString } = ctx.options;
  if (doc.commentBefore) {
    if (lines.length !== 1)
      lines.unshift("");
    const cs2 = commentString(doc.commentBefore);
    lines.unshift(indentComment(cs2, ""));
  }
  let chompKeep = false;
  let contentComment = null;
  if (doc.contents) {
    if (isNode(doc.contents)) {
      if (doc.contents.spaceBefore && hasDirectives)
        lines.push("");
      if (doc.contents.commentBefore) {
        const cs2 = commentString(doc.contents.commentBefore);
        lines.push(indentComment(cs2, ""));
      }
      ctx.forceBlockIndent = !!doc.comment;
      contentComment = doc.contents.comment;
    }
    const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
    let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
    if (contentComment)
      body += lineComment(body, "", commentString(contentComment));
    if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
      lines[lines.length - 1] = `--- ${body}`;
    } else
      lines.push(body);
  } else {
    lines.push(stringify(doc.contents, ctx));
  }
  if (doc.directives?.docEnd) {
    if (doc.comment) {
      const cs2 = commentString(doc.comment);
      if (cs2.includes("\n")) {
        lines.push("...");
        lines.push(indentComment(cs2, ""));
      } else {
        lines.push(`... ${cs2}`);
      }
    } else {
      lines.push("...");
    }
  } else {
    let dc2 = doc.comment;
    if (dc2 && chompKeep)
      dc2 = dc2.replace(/^\n+/, "");
    if (dc2) {
      if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
        lines.push("");
      lines.push(indentComment(commentString(dc2), ""));
    }
  }
  return lines.join("\n") + "\n";
}

// node_modules/yaml/browser/dist/doc/Document.js
var Document = class _Document {
  constructor(value, replacer, options) {
    this.commentBefore = null;
    this.comment = null;
    this.errors = [];
    this.warnings = [];
    Object.defineProperty(this, NODE_TYPE, { value: DOC });
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const opt = Object.assign({
      intAsBigInt: false,
      keepSourceTokens: false,
      logLevel: "warn",
      prettyErrors: true,
      strict: true,
      stringKeys: false,
      uniqueKeys: true,
      version: "1.2"
    }, options);
    this.options = opt;
    let { version } = opt;
    if (options?._directives) {
      this.directives = options._directives.atDocument();
      if (this.directives.yaml.explicit)
        version = this.directives.yaml.version;
    } else
      this.directives = new Directives({ version });
    this.setSchema(version, options);
    this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
  }
  /**
   * Create a deep copy of this Document and its contents.
   *
   * Custom Node values that inherit from `Object` still refer to their original instances.
   */
  clone() {
    const copy = Object.create(_Document.prototype, {
      [NODE_TYPE]: { value: DOC }
    });
    copy.commentBefore = this.commentBefore;
    copy.comment = this.comment;
    copy.errors = this.errors.slice();
    copy.warnings = this.warnings.slice();
    copy.options = Object.assign({}, this.options);
    if (this.directives)
      copy.directives = this.directives.clone();
    copy.schema = this.schema.clone();
    copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** Adds a value to the document. */
  add(value) {
    if (assertCollection(this.contents))
      this.contents.add(value);
  }
  /** Adds a value to the document. */
  addIn(path, value) {
    if (assertCollection(this.contents))
      this.contents.addIn(path, value);
  }
  /**
   * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
   *
   * If `node` already has an anchor, `name` is ignored.
   * Otherwise, the `node.anchor` value will be set to `name`,
   * or if an anchor with that name is already present in the document,
   * `name` will be used as a prefix for a new unique anchor.
   * If `name` is undefined, the generated anchor will use 'a' as a prefix.
   */
  createAlias(node, name2) {
    if (!node.anchor) {
      const prev = anchorNames(this);
      node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      !name2 || prev.has(name2) ? findNewAnchor(name2 || "a", prev) : name2;
    }
    return new Alias(node.anchor);
  }
  createNode(value, replacer, options) {
    let _replacer = void 0;
    if (typeof replacer === "function") {
      value = replacer.call({ "": value }, "", value);
      _replacer = replacer;
    } else if (Array.isArray(replacer)) {
      const keyToStr = (v2) => typeof v2 === "number" || v2 instanceof String || v2 instanceof Number;
      const asStr = replacer.filter(keyToStr).map(String);
      if (asStr.length > 0)
        replacer = replacer.concat(asStr);
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
    const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
      this,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      anchorPrefix || "a"
    );
    const ctx = {
      aliasDuplicateObjects: aliasDuplicateObjects ?? true,
      keepUndefined: keepUndefined ?? false,
      onAnchor,
      onTagObj,
      replacer: _replacer,
      schema: this.schema,
      sourceObjects
    };
    const node = createNode(value, tag, ctx);
    if (flow && isCollection(node))
      node.flow = true;
    setAnchors();
    return node;
  }
  /**
   * Convert a key and a value into a `Pair` using the current schema,
   * recursively wrapping all values as `Scalar` or `Collection` nodes.
   */
  createPair(key, value, options = {}) {
    const k = this.createNode(key, null, options);
    const v2 = this.createNode(value, null, options);
    return new Pair(k, v2);
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    return assertCollection(this.contents) ? this.contents.delete(key) : false;
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    if (isEmptyPath(path)) {
      if (this.contents == null)
        return false;
      this.contents = null;
      return true;
    }
    return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  get(key, keepScalar) {
    return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
  }
  /**
   * Returns item at `path`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    if (isEmptyPath(path))
      return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
    return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
  }
  /**
   * Checks if the document includes a value with the key `key`.
   */
  has(key) {
    return isCollection(this.contents) ? this.contents.has(key) : false;
  }
  /**
   * Checks if the document includes a value at `path`.
   */
  hasIn(path) {
    if (isEmptyPath(path))
      return this.contents !== void 0;
    return isCollection(this.contents) ? this.contents.hasIn(path) : false;
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  set(key, value) {
    if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, [key], value);
    } else if (assertCollection(this.contents)) {
      this.contents.set(key, value);
    }
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    if (isEmptyPath(path)) {
      this.contents = value;
    } else if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, Array.from(path), value);
    } else if (assertCollection(this.contents)) {
      this.contents.setIn(path, value);
    }
  }
  /**
   * Change the YAML version and schema used by the document.
   * A `null` version disables support for directives, explicit tags, anchors, and aliases.
   * It also requires the `schema` option to be given as a `Schema` instance value.
   *
   * Overrides all previously set schema options.
   */
  setSchema(version, options = {}) {
    if (typeof version === "number")
      version = String(version);
    let opt;
    switch (version) {
      case "1.1":
        if (this.directives)
          this.directives.yaml.version = "1.1";
        else
          this.directives = new Directives({ version: "1.1" });
        opt = { resolveKnownTags: false, schema: "yaml-1.1" };
        break;
      case "1.2":
      case "next":
        if (this.directives)
          this.directives.yaml.version = version;
        else
          this.directives = new Directives({ version });
        opt = { resolveKnownTags: true, schema: "core" };
        break;
      case null:
        if (this.directives)
          delete this.directives;
        opt = null;
        break;
      default: {
        const sv = JSON.stringify(version);
        throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
      }
    }
    if (options.schema instanceof Object)
      this.schema = options.schema;
    else if (opt)
      this.schema = new Schema(Object.assign(opt, options));
    else
      throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
  }
  // json & jsonArg are only used from toJSON()
  toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc: this,
      keep: !json,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this.contents, jsonArg ?? "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
  /**
   * A JSON representation of the document `contents`.
   *
   * @param jsonArg Used by `JSON.stringify` to indicate the array index or
   *   property name.
   */
  toJSON(jsonArg, onAnchor) {
    return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
  }
  /** A YAML representation of the document. */
  toString(options = {}) {
    if (this.errors.length > 0)
      throw new Error("Document with errors cannot be stringified");
    if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
      const s = JSON.stringify(options.indent);
      throw new Error(`"indent" option must be a positive integer, not ${s}`);
    }
    return stringifyDocument(this, options);
  }
};
function assertCollection(contents) {
  if (isCollection(contents))
    return true;
  throw new Error("Expected a YAML collection as document contents");
}

// node_modules/yaml/browser/dist/errors.js
var YAMLError = class extends Error {
  constructor(name2, pos, code, message) {
    super();
    this.name = name2;
    this.code = code;
    this.message = message;
    this.pos = pos;
  }
};
var YAMLParseError = class extends YAMLError {
  constructor(pos, code, message) {
    super("YAMLParseError", pos, code, message);
  }
};
var YAMLWarning = class extends YAMLError {
  constructor(pos, code, message) {
    super("YAMLWarning", pos, code, message);
  }
};
var prettifyError = (src, lc2) => (error) => {
  if (error.pos[0] === -1)
    return;
  error.linePos = error.pos.map((pos) => lc2.linePos(pos));
  const { line, col } = error.linePos[0];
  error.message += ` at line ${line}, column ${col}`;
  let ci2 = col - 1;
  let lineStr = src.substring(lc2.lineStarts[line - 1], lc2.lineStarts[line]).replace(/[\n\r]+$/, "");
  if (ci2 >= 60 && lineStr.length > 80) {
    const trimStart = Math.min(ci2 - 39, lineStr.length - 79);
    lineStr = "\u2026" + lineStr.substring(trimStart);
    ci2 -= trimStart - 1;
  }
  if (lineStr.length > 80)
    lineStr = lineStr.substring(0, 79) + "\u2026";
  if (line > 1 && /^ *$/.test(lineStr.substring(0, ci2))) {
    let prev = src.substring(lc2.lineStarts[line - 2], lc2.lineStarts[line - 1]);
    if (prev.length > 80)
      prev = prev.substring(0, 79) + "\u2026\n";
    lineStr = prev + lineStr;
  }
  if (/[^ ]/.test(lineStr)) {
    let count = 1;
    const end = error.linePos[1];
    if (end?.line === line && end.col > col) {
      count = Math.max(1, Math.min(end.col - col, 80 - ci2));
    }
    const pointer = " ".repeat(ci2) + "^".repeat(count);
    error.message += `:

${lineStr}
${pointer}
`;
  }
};

// node_modules/yaml/browser/dist/compose/resolve-props.js
function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
  let spaceBefore = false;
  let atNewline = startOnNewline;
  let hasSpace = startOnNewline;
  let comment2 = "";
  let commentSep = "";
  let hasNewline = false;
  let reqSpace = false;
  let tab = null;
  let anchor = null;
  let tag = null;
  let newlineAfterProp = null;
  let comma = null;
  let found = null;
  let start = null;
  for (const token of tokens) {
    if (reqSpace) {
      if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
        onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      reqSpace = false;
    }
    if (tab) {
      if (atNewline && token.type !== "comment" && token.type !== "newline") {
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      }
      tab = null;
    }
    switch (token.type) {
      case "space":
        if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
          tab = token;
        }
        hasSpace = true;
        break;
      case "comment": {
        if (!hasSpace)
          onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
        const cb = token.source.substring(1) || " ";
        if (!comment2)
          comment2 = cb;
        else
          comment2 += commentSep + cb;
        commentSep = "";
        atNewline = false;
        break;
      }
      case "newline":
        if (atNewline) {
          if (comment2)
            comment2 += token.source;
          else if (!found || indicator !== "seq-item-ind")
            spaceBefore = true;
        } else
          commentSep += token.source;
        atNewline = true;
        hasNewline = true;
        if (anchor || tag)
          newlineAfterProp = token;
        hasSpace = true;
        break;
      case "anchor":
        if (anchor)
          onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
        if (token.source.endsWith(":"))
          onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
        anchor = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      case "tag": {
        if (tag)
          onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
        tag = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      }
      case indicator:
        if (anchor || tag)
          onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
        if (found)
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
        found = token;
        atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
        hasSpace = false;
        break;
      case "comma":
        if (flow) {
          if (comma)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
          comma = token;
          atNewline = false;
          hasSpace = false;
          break;
        }
      // else fallthrough
      default:
        onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
        atNewline = false;
        hasSpace = false;
    }
  }
  const last = tokens[tokens.length - 1];
  const end = last ? last.offset + last.source.length : offset;
  if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
    onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
  }
  if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
    onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
  return {
    comma,
    found,
    spaceBefore,
    comment: comment2,
    hasNewline,
    anchor,
    tag,
    newlineAfterProp,
    end,
    start: start ?? end
  };
}

// node_modules/yaml/browser/dist/compose/util-contains-newline.js
function containsNewline(key) {
  if (!key)
    return null;
  switch (key.type) {
    case "alias":
    case "scalar":
    case "double-quoted-scalar":
    case "single-quoted-scalar":
      if (key.source.includes("\n"))
        return true;
      if (key.end) {
        for (const st2 of key.end)
          if (st2.type === "newline")
            return true;
      }
      return false;
    case "flow-collection":
      for (const it2 of key.items) {
        for (const st2 of it2.start)
          if (st2.type === "newline")
            return true;
        if (it2.sep) {
          for (const st2 of it2.sep)
            if (st2.type === "newline")
              return true;
        }
        if (containsNewline(it2.key) || containsNewline(it2.value))
          return true;
      }
      return false;
    default:
      return true;
  }
}

// node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
function flowIndentCheck(indent, fc2, onError) {
  if (fc2?.type === "flow-collection") {
    const end = fc2.end[0];
    if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc2)) {
      const msg = "Flow end indicator should be more indented than parent";
      onError(end, "BAD_INDENT", msg, true);
    }
  }
}

// node_modules/yaml/browser/dist/compose/util-map-includes.js
function mapIncludes(ctx, items, search) {
  const { uniqueKeys } = ctx.options;
  if (uniqueKeys === false)
    return false;
  const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
  return items.some((pair) => isEqual(pair.key, search));
}

// node_modules/yaml/browser/dist/compose/resolve-block-map.js
var startColMsg = "All mapping items must start at the same column";
function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLMap;
  const map2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  let offset = bm.offset;
  let commentEnd = null;
  for (const collItem of bm.items) {
    const { start, key, sep, value } = collItem;
    const keyProps = resolveProps(start, {
      indicator: "explicit-key-ind",
      next: key ?? sep?.[0],
      offset,
      onError,
      parentIndent: bm.indent,
      startOnNewline: true
    });
    const implicitKey = !keyProps.found;
    if (implicitKey) {
      if (key) {
        if (key.type === "block-seq")
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
        else if ("indent" in key && key.indent !== bm.indent)
          onError(offset, "BAD_INDENT", startColMsg);
      }
      if (!keyProps.anchor && !keyProps.tag && !sep) {
        commentEnd = keyProps.end;
        if (keyProps.comment) {
          if (map2.comment)
            map2.comment += "\n" + keyProps.comment;
          else
            map2.comment = keyProps.comment;
        }
        continue;
      }
      if (keyProps.newlineAfterProp || containsNewline(key)) {
        onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
      }
    } else if (keyProps.found?.indent !== bm.indent) {
      onError(offset, "BAD_INDENT", startColMsg);
    }
    ctx.atKey = true;
    const keyStart = keyProps.end;
    const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bm.indent, key, onError);
    ctx.atKey = false;
    if (mapIncludes(ctx, map2.items, keyNode))
      onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
    const valueProps = resolveProps(sep ?? [], {
      indicator: "map-value-ind",
      next: value,
      offset: keyNode.range[2],
      onError,
      parentIndent: bm.indent,
      startOnNewline: !key || key.type === "block-scalar"
    });
    offset = valueProps.end;
    if (valueProps.found) {
      if (implicitKey) {
        if (value?.type === "block-map" && !valueProps.hasNewline)
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
        if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
          onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, value, onError);
      offset = valueNode.range[2];
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    } else {
      if (implicitKey)
        onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
      if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    }
  }
  if (commentEnd && commentEnd < offset)
    onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
  map2.range = [bm.offset, offset, commentEnd ?? offset];
  return map2;
}

// node_modules/yaml/browser/dist/compose/resolve-block-seq.js
function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs2, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLSeq;
  const seq2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = bs2.offset;
  let commentEnd = null;
  for (const { start, value } of bs2.items) {
    const props = resolveProps(start, {
      indicator: "seq-item-ind",
      next: value,
      offset,
      onError,
      parentIndent: bs2.indent,
      startOnNewline: true
    });
    if (!props.found) {
      if (props.anchor || props.tag || value) {
        if (value?.type === "block-seq")
          onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
        else
          onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
      } else {
        commentEnd = props.end;
        if (props.comment)
          seq2.comment = props.comment;
        continue;
      }
    }
    const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bs2.indent, value, onError);
    offset = node.range[2];
    seq2.items.push(node);
  }
  seq2.range = [bs2.offset, offset, commentEnd ?? offset];
  return seq2;
}

// node_modules/yaml/browser/dist/compose/resolve-end.js
function resolveEnd(end, offset, reqSpace, onError) {
  let comment2 = "";
  if (end) {
    let hasSpace = false;
    let sep = "";
    for (const token of end) {
      const { source, type } = token;
      switch (type) {
        case "space":
          hasSpace = true;
          break;
        case "comment": {
          if (reqSpace && !hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = source.substring(1) || " ";
          if (!comment2)
            comment2 = cb;
          else
            comment2 += sep + cb;
          sep = "";
          break;
        }
        case "newline":
          if (comment2)
            sep += source;
          hasSpace = true;
          break;
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
      }
      offset += source.length;
    }
  }
  return { comment: comment2, offset };
}

// node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
var blockMsg = "Block collections are not allowed within flow collections";
var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc2, onError, tag) {
  const isMap2 = fc2.start.source === "{";
  const fcName = isMap2 ? "flow map" : "flow sequence";
  const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
  const coll = new NodeClass(ctx.schema);
  coll.flow = true;
  const atRoot = ctx.atRoot;
  if (atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = fc2.offset + fc2.start.source.length;
  for (let i = 0; i < fc2.items.length; ++i) {
    const collItem = fc2.items[i];
    const { start, key, sep, value } = collItem;
    const props = resolveProps(start, {
      flow: fcName,
      indicator: "explicit-key-ind",
      next: key ?? sep?.[0],
      offset,
      onError,
      parentIndent: fc2.indent,
      startOnNewline: false
    });
    if (!props.found) {
      if (!props.anchor && !props.tag && !sep && !value) {
        if (i === 0 && props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        else if (i < fc2.items.length - 1)
          onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
        if (props.comment) {
          if (coll.comment)
            coll.comment += "\n" + props.comment;
          else
            coll.comment = props.comment;
        }
        offset = props.end;
        continue;
      }
      if (!isMap2 && ctx.options.strict && containsNewline(key))
        onError(
          key,
          // checked by containsNewline()
          "MULTILINE_IMPLICIT_KEY",
          "Implicit keys of flow sequence pairs need to be on a single line"
        );
    }
    if (i === 0) {
      if (props.comma)
        onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
    } else {
      if (!props.comma)
        onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
      if (props.comment) {
        let prevItemComment = "";
        loop: for (const st2 of start) {
          switch (st2.type) {
            case "comma":
            case "space":
              break;
            case "comment":
              prevItemComment = st2.source.substring(1);
              break loop;
            default:
              break loop;
          }
        }
        if (prevItemComment) {
          let prev = coll.items[coll.items.length - 1];
          if (isPair(prev))
            prev = prev.value ?? prev.key;
          if (prev.comment)
            prev.comment += "\n" + prevItemComment;
          else
            prev.comment = prevItemComment;
          props.comment = props.comment.substring(prevItemComment.length + 1);
        }
      }
    }
    if (!isMap2 && !sep && !props.found) {
      const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
      coll.items.push(valueNode);
      offset = valueNode.range[2];
      if (isBlock(value))
        onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
    } else {
      ctx.atKey = true;
      const keyStart = props.end;
      const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
      if (isBlock(key))
        onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
      ctx.atKey = false;
      const valueProps = resolveProps(sep ?? [], {
        flow: fcName,
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: fc2.indent,
        startOnNewline: false
      });
      if (valueProps.found) {
        if (!isMap2 && !props.found && ctx.options.strict) {
          if (sep)
            for (const st2 of sep) {
              if (st2 === valueProps.found)
                break;
              if (st2.type === "newline") {
                onError(st2, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                break;
              }
            }
          if (props.start < valueProps.found.offset - 1024)
            onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
        }
      } else if (value) {
        if ("source" in value && value.source?.[0] === ":")
          onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
        else
          onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
      if (valueNode) {
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      if (isMap2) {
        const map2 = coll;
        if (mapIncludes(ctx, map2.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        map2.items.push(pair);
      } else {
        const map2 = new YAMLMap(ctx.schema);
        map2.flow = true;
        map2.items.push(pair);
        const endRange = (valueNode ?? keyNode).range;
        map2.range = [keyNode.range[0], endRange[1], endRange[2]];
        coll.items.push(map2);
      }
      offset = valueNode ? valueNode.range[2] : valueProps.end;
    }
  }
  const expectedEnd = isMap2 ? "}" : "]";
  const [ce2, ...ee] = fc2.end;
  let cePos = offset;
  if (ce2?.source === expectedEnd)
    cePos = ce2.offset + ce2.source.length;
  else {
    const name2 = fcName[0].toUpperCase() + fcName.substring(1);
    const msg = atRoot ? `${name2} must end with a ${expectedEnd}` : `${name2} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
    onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
    if (ce2 && ce2.source.length !== 1)
      ee.unshift(ce2);
  }
  if (ee.length > 0) {
    const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
    if (end.comment) {
      if (coll.comment)
        coll.comment += "\n" + end.comment;
      else
        coll.comment = end.comment;
    }
    coll.range = [fc2.offset, cePos, end.offset];
  } else {
    coll.range = [fc2.offset, cePos, cePos];
  }
  return coll;
}

// node_modules/yaml/browser/dist/compose/compose-collection.js
function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
  const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
  const Coll = coll.constructor;
  if (tagName === "!" || tagName === Coll.tagName) {
    coll.tag = Coll.tagName;
    return coll;
  }
  if (tagName)
    coll.tag = tagName;
  return coll;
}
function composeCollection(CN2, ctx, token, props, onError) {
  const tagToken = props.tag;
  const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
  if (token.type === "block-seq") {
    const { anchor, newlineAfterProp: nl2 } = props;
    const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
    if (lastProp && (!nl2 || nl2.offset < lastProp.offset)) {
      const message = "Missing newline after block sequence props";
      onError(lastProp, "MISSING_CHAR", message);
    }
  }
  const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
  if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
    return resolveCollection(CN2, ctx, token, onError, tagName);
  }
  let tag = ctx.schema.tags.find((t33) => t33.tag === tagName && t33.collection === expType);
  if (!tag) {
    const kt2 = ctx.schema.knownTags[tagName];
    if (kt2?.collection === expType) {
      ctx.schema.tags.push(Object.assign({}, kt2, { default: false }));
      tag = kt2;
    } else {
      if (kt2) {
        onError(tagToken, "BAD_COLLECTION_TYPE", `${kt2.tag} used for ${expType} collection, but expects ${kt2.collection ?? "scalar"}`, true);
      } else {
        onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
      }
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
  }
  const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
  const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
  const node = isNode(res) ? res : new Scalar(res);
  node.range = coll.range;
  node.tag = tagName;
  if (tag?.format)
    node.format = tag.format;
  return node;
}

// node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
function resolveBlockScalar(ctx, scalar, onError) {
  const start = scalar.offset;
  const header2 = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
  if (!header2)
    return { value: "", type: null, comment: "", range: [start, start, start] };
  const type = header2.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
  const lines = scalar.source ? splitLines(scalar.source) : [];
  let chompStart = lines.length;
  for (let i = lines.length - 1; i >= 0; --i) {
    const content2 = lines[i][1];
    if (content2 === "" || content2 === "\r")
      chompStart = i;
    else
      break;
  }
  if (chompStart === 0) {
    const value2 = header2.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
    let end2 = start + header2.length;
    if (scalar.source)
      end2 += scalar.source.length;
    return { value: value2, type, comment: header2.comment, range: [start, end2, end2] };
  }
  let trimIndent = scalar.indent + header2.indent;
  let offset = scalar.offset + header2.length;
  let contentStart = 0;
  for (let i = 0; i < chompStart; ++i) {
    const [indent, content2] = lines[i];
    if (content2 === "" || content2 === "\r") {
      if (header2.indent === 0 && indent.length > trimIndent)
        trimIndent = indent.length;
    } else {
      if (indent.length < trimIndent) {
        const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
        onError(offset + indent.length, "MISSING_CHAR", message);
      }
      if (header2.indent === 0)
        trimIndent = indent.length;
      contentStart = i;
      if (trimIndent === 0 && !ctx.atRoot) {
        const message = "Block scalar values in collections must be indented";
        onError(offset, "BAD_INDENT", message);
      }
      break;
    }
    offset += indent.length + content2.length + 1;
  }
  for (let i = lines.length - 1; i >= chompStart; --i) {
    if (lines[i][0].length > trimIndent)
      chompStart = i + 1;
  }
  let value = "";
  let sep = "";
  let prevMoreIndented = false;
  for (let i = 0; i < contentStart; ++i)
    value += lines[i][0].slice(trimIndent) + "\n";
  for (let i = contentStart; i < chompStart; ++i) {
    let [indent, content2] = lines[i];
    offset += indent.length + content2.length + 1;
    const crlf = content2[content2.length - 1] === "\r";
    if (crlf)
      content2 = content2.slice(0, -1);
    if (content2 && indent.length < trimIndent) {
      const src = header2.indent ? "explicit indentation indicator" : "first line";
      const message = `Block scalar lines must not be less indented than their ${src}`;
      onError(offset - content2.length - (crlf ? 2 : 1), "BAD_INDENT", message);
      indent = "";
    }
    if (type === Scalar.BLOCK_LITERAL) {
      value += sep + indent.slice(trimIndent) + content2;
      sep = "\n";
    } else if (indent.length > trimIndent || content2[0] === "	") {
      if (sep === " ")
        sep = "\n";
      else if (!prevMoreIndented && sep === "\n")
        sep = "\n\n";
      value += sep + indent.slice(trimIndent) + content2;
      sep = "\n";
      prevMoreIndented = true;
    } else if (content2 === "") {
      if (sep === "\n")
        value += "\n";
      else
        sep = "\n";
    } else {
      value += sep + content2;
      sep = " ";
      prevMoreIndented = false;
    }
  }
  switch (header2.chomp) {
    case "-":
      break;
    case "+":
      for (let i = chompStart; i < lines.length; ++i)
        value += "\n" + lines[i][0].slice(trimIndent);
      if (value[value.length - 1] !== "\n")
        value += "\n";
      break;
    default:
      value += "\n";
  }
  const end = start + header2.length + scalar.source.length;
  return { value, type, comment: header2.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
  if (props[0].type !== "block-scalar-header") {
    onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
    return null;
  }
  const { source } = props[0];
  const mode = source[0];
  let indent = 0;
  let chomp = "";
  let error = -1;
  for (let i = 1; i < source.length; ++i) {
    const ch = source[i];
    if (!chomp && (ch === "-" || ch === "+"))
      chomp = ch;
    else {
      const n = Number(ch);
      if (!indent && n)
        indent = n;
      else if (error === -1)
        error = offset + i;
    }
  }
  if (error !== -1)
    onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
  let hasSpace = false;
  let comment2 = "";
  let length = source.length;
  for (let i = 1; i < props.length; ++i) {
    const token = props[i];
    switch (token.type) {
      case "space":
        hasSpace = true;
      // fallthrough
      case "newline":
        length += token.source.length;
        break;
      case "comment":
        if (strict && !hasSpace) {
          const message = "Comments must be separated from other tokens by white space characters";
          onError(token, "MISSING_CHAR", message);
        }
        length += token.source.length;
        comment2 = token.source.substring(1);
        break;
      case "error":
        onError(token, "UNEXPECTED_TOKEN", token.message);
        length += token.source.length;
        break;
      /* istanbul ignore next should not happen */
      default: {
        const message = `Unexpected token in block scalar header: ${token.type}`;
        onError(token, "UNEXPECTED_TOKEN", message);
        const ts2 = token.source;
        if (ts2 && typeof ts2 === "string")
          length += ts2.length;
      }
    }
  }
  return { mode, indent, chomp, comment: comment2, length };
}
function splitLines(source) {
  const split = source.split(/\n( *)/);
  const first = split[0];
  const m3 = first.match(/^( *)/);
  const line0 = m3?.[1] ? [m3[1], first.slice(m3[1].length)] : ["", first];
  const lines = [line0];
  for (let i = 1; i < split.length; i += 2)
    lines.push([split[i], split[i + 1]]);
  return lines;
}

// node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
function resolveFlowScalar(scalar, strict, onError) {
  const { offset, type, source, end } = scalar;
  let _type;
  let value;
  const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
  switch (type) {
    case "scalar":
      _type = Scalar.PLAIN;
      value = plainValue(source, _onError);
      break;
    case "single-quoted-scalar":
      _type = Scalar.QUOTE_SINGLE;
      value = singleQuotedValue(source, _onError);
      break;
    case "double-quoted-scalar":
      _type = Scalar.QUOTE_DOUBLE;
      value = doubleQuotedValue(source, _onError);
      break;
    /* istanbul ignore next should not happen */
    default:
      onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
      return {
        value: "",
        type: null,
        comment: "",
        range: [offset, offset + source.length, offset + source.length]
      };
  }
  const valueEnd = offset + source.length;
  const re2 = resolveEnd(end, valueEnd, strict, onError);
  return {
    value,
    type: _type,
    comment: re2.comment,
    range: [offset, valueEnd, re2.offset]
  };
}
function plainValue(source, onError) {
  let badChar = "";
  switch (source[0]) {
    /* istanbul ignore next should not happen */
    case "	":
      badChar = "a tab character";
      break;
    case ",":
      badChar = "flow indicator character ,";
      break;
    case "%":
      badChar = "directive indicator character %";
      break;
    case "|":
    case ">": {
      badChar = `block scalar indicator ${source[0]}`;
      break;
    }
    case "@":
    case "`": {
      badChar = `reserved character ${source[0]}`;
      break;
    }
  }
  if (badChar)
    onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
  return unfoldLines(source);
}
function singleQuotedValue(source, onError) {
  if (source[source.length - 1] !== "'" || source.length === 1)
    onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
  return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function unfoldLines(source) {
  const line = /(.*?)\r?\n/sy;
  let match = line.exec(source);
  if (!match)
    return source;
  let trimEnd, trimBoth;
  try {
    trimEnd = new RegExp("(?<![ 	])[ 	]+$");
    trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
  } catch {
    trimEnd = /[ \t]+$/;
    trimBoth = /^[ \t]+|[ \t]+$/g;
  }
  let res = match[1].replace(trimEnd, "");
  let sep = " ";
  let pos = line.lastIndex;
  while (match = line.exec(source)) {
    const lm = match[1].replace(trimBoth, "");
    if (lm === "") {
      if (sep === "\n")
        res += sep;
      else
        sep = "\n";
    } else {
      res += sep + lm;
      sep = " ";
    }
    pos = line.lastIndex;
  }
  const last = /[ \t]*(.*)/sy;
  last.lastIndex = pos;
  match = last.exec(source);
  return res + sep + (match?.[1] ?? "");
}
function doubleQuotedValue(source, onError) {
  let res = "";
  for (let i = 1; i < source.length - 1; ++i) {
    const ch = source[i];
    if (ch === "\r" && source[i + 1] === "\n")
      continue;
    if (ch === "\n") {
      const { fold, offset } = foldNewline(source, i);
      res += fold;
      i = offset;
    } else if (ch === "\\") {
      let next = source[++i];
      const cc2 = escapeCodes[next];
      if (cc2)
        res += cc2;
      else if (next === "\n") {
        next = source[i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "\r" && source[i + 1] === "\n") {
        next = source[++i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "x" || next === "u" || next === "U") {
        const length = next === "x" ? 2 : next === "u" ? 4 : 8;
        res += parseCharCode(source, i + 1, length, onError);
        i += length;
      } else {
        const raw = source.substr(i - 1, 2);
        onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        res += raw;
      }
    } else if (ch === " " || ch === "	") {
      const wsStart = i;
      let next = source[i + 1];
      while (next === " " || next === "	")
        next = source[++i + 1];
      if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
        res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
    } else {
      res += ch;
    }
  }
  if (source[source.length - 1] !== '"' || source.length === 1)
    onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
  return res;
}
function foldNewline(source, offset) {
  let fold = "";
  let ch = source[offset + 1];
  while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
    if (ch === "\r" && source[offset + 2] !== "\n")
      break;
    if (ch === "\n")
      fold += "\n";
    offset += 1;
    ch = source[offset + 1];
  }
  if (!fold)
    fold = " ";
  return { fold, offset };
}
var escapeCodes = {
  "0": "\0",
  // null character
  a: "\x07",
  // bell character
  b: "\b",
  // backspace
  e: "\x1B",
  // escape character
  f: "\f",
  // form feed
  n: "\n",
  // line feed
  r: "\r",
  // carriage return
  t: "	",
  // horizontal tab
  v: "\v",
  // vertical tab
  N: "\x85",
  // Unicode next line
  _: "\xA0",
  // Unicode non-breaking space
  L: "\u2028",
  // Unicode line separator
  P: "\u2029",
  // Unicode paragraph separator
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  "	": "	"
};
function parseCharCode(source, offset, length, onError) {
  const cc2 = source.substr(offset, length);
  const ok = cc2.length === length && /^[0-9a-fA-F]+$/.test(cc2);
  const code = ok ? parseInt(cc2, 16) : NaN;
  try {
    return String.fromCodePoint(code);
  } catch {
    const raw = source.substr(offset - 2, length + 2);
    onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
    return raw;
  }
}

// node_modules/yaml/browser/dist/compose/compose-scalar.js
function composeScalar(ctx, token, tagToken, onError) {
  const { value, type, comment: comment2, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
  const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
  let tag;
  if (ctx.options.stringKeys && ctx.atKey) {
    tag = ctx.schema[SCALAR];
  } else if (tagName)
    tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
  else if (token.type === "scalar")
    tag = findScalarTagByTest(ctx, value, token, onError);
  else
    tag = ctx.schema[SCALAR];
  let scalar;
  try {
    const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
    scalar = isScalar(res) ? res : new Scalar(res);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
    scalar = new Scalar(value);
  }
  scalar.range = range;
  scalar.source = value;
  if (type)
    scalar.type = type;
  if (tagName)
    scalar.tag = tagName;
  if (tag.format)
    scalar.format = tag.format;
  if (comment2)
    scalar.comment = comment2;
  return scalar;
}
function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
  if (tagName === "!")
    return schema4[SCALAR];
  const matchWithTest = [];
  for (const tag of schema4.tags) {
    if (!tag.collection && tag.tag === tagName) {
      if (tag.default && tag.test)
        matchWithTest.push(tag);
      else
        return tag;
    }
  }
  for (const tag of matchWithTest)
    if (tag.test?.test(value))
      return tag;
  const kt2 = schema4.knownTags[tagName];
  if (kt2 && !kt2.collection) {
    schema4.tags.push(Object.assign({}, kt2, { default: false, test: void 0 }));
    return kt2;
  }
  onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
  return schema4[SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
  const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
  if (schema4.compat) {
    const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
    if (tag.tag !== compat.tag) {
      const ts2 = directives.tagString(tag.tag);
      const cs2 = directives.tagString(compat.tag);
      const msg = `Value may be parsed as either ${ts2} or ${cs2}`;
      onError(token, "TAG_RESOLVE_FAILED", msg, true);
    }
  }
  return tag;
}

// node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
function emptyScalarPosition(offset, before, pos) {
  if (before) {
    pos ?? (pos = before.length);
    for (let i = pos - 1; i >= 0; --i) {
      let st2 = before[i];
      switch (st2.type) {
        case "space":
        case "comment":
        case "newline":
          offset -= st2.source.length;
          continue;
      }
      st2 = before[++i];
      while (st2?.type === "space") {
        offset += st2.source.length;
        st2 = before[++i];
      }
      break;
    }
  }
  return offset;
}

// node_modules/yaml/browser/dist/compose/compose-node.js
var CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
  const atKey = ctx.atKey;
  const { spaceBefore, comment: comment2, anchor, tag } = props;
  let node;
  let isSrcToken = true;
  switch (token.type) {
    case "alias":
      node = composeAlias(ctx, token, onError);
      if (anchor || tag)
        onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
      break;
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "block-scalar":
      node = composeScalar(ctx, token, tag, onError);
      if (anchor)
        node.anchor = anchor.source.substring(1);
      break;
    case "block-map":
    case "block-seq":
    case "flow-collection":
      try {
        node = composeCollection(CN, ctx, token, props, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError(token, "RESOURCE_EXHAUSTION", message);
      }
      break;
    default: {
      const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
      onError(token, "UNEXPECTED_TOKEN", message);
      isSrcToken = false;
    }
  }
  node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
  if (anchor && node.anchor === "")
    onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
    const msg = "With stringKeys, all keys must be strings";
    onError(tag ?? token, "NON_STRING_KEY", msg);
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment2) {
    if (token.type === "scalar" && token.source === "")
      node.comment = comment2;
    else
      node.commentBefore = comment2;
  }
  if (ctx.options.keepSourceTokens && isSrcToken)
    node.srcToken = token;
  return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment: comment2, anchor, tag, end }, onError) {
  const token = {
    type: "scalar",
    offset: emptyScalarPosition(offset, before, pos),
    indent: -1,
    source: ""
  };
  const node = composeScalar(ctx, token, tag, onError);
  if (anchor) {
    node.anchor = anchor.source.substring(1);
    if (node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment2) {
    node.comment = comment2;
    node.range[2] = end;
  }
  return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
  const alias = new Alias(source.substring(1));
  if (alias.source === "")
    onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
  if (alias.source.endsWith(":"))
    onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
  const valueEnd = offset + source.length;
  const re2 = resolveEnd(end, valueEnd, options.strict, onError);
  alias.range = [offset, valueEnd, re2.offset];
  if (re2.comment)
    alias.comment = re2.comment;
  return alias;
}

// node_modules/yaml/browser/dist/compose/compose-doc.js
function composeDoc(options, directives, { offset, start, value, end }, onError) {
  const opts = Object.assign({ _directives: directives }, options);
  const doc = new Document(void 0, opts);
  const ctx = {
    atKey: false,
    atRoot: true,
    directives: doc.directives,
    options: doc.options,
    schema: doc.schema
  };
  const props = resolveProps(start, {
    indicator: "doc-start",
    next: value ?? end?.[0],
    offset,
    onError,
    parentIndent: 0,
    startOnNewline: true
  });
  if (props.found) {
    doc.directives.docStart = true;
    if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
      onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
  }
  doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
  const contentEnd = doc.contents.range[2];
  const re2 = resolveEnd(end, contentEnd, false, onError);
  if (re2.comment)
    doc.comment = re2.comment;
  doc.range = [offset, contentEnd, re2.offset];
  return doc;
}

// node_modules/yaml/browser/dist/compose/composer.js
function getErrorPos(src) {
  if (typeof src === "number")
    return [src, src + 1];
  if (Array.isArray(src))
    return src.length === 2 ? src : [src[0], src[1]];
  const { offset, source } = src;
  return [offset, offset + (typeof source === "string" ? source.length : 1)];
}
function parsePrelude(prelude) {
  let comment2 = "";
  let atComment = false;
  let afterEmptyLine = false;
  for (let i = 0; i < prelude.length; ++i) {
    const source = prelude[i];
    switch (source[0]) {
      case "#":
        comment2 += (comment2 === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
        atComment = true;
        afterEmptyLine = false;
        break;
      case "%":
        if (prelude[i + 1]?.[0] !== "#")
          i += 1;
        atComment = false;
        break;
      default:
        if (!atComment)
          afterEmptyLine = true;
        atComment = false;
    }
  }
  return { comment: comment2, afterEmptyLine };
}
var Composer = class {
  constructor(options = {}) {
    this.doc = null;
    this.atDirectives = false;
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
    this.onError = (source, code, message, warning) => {
      const pos = getErrorPos(source);
      if (warning)
        this.warnings.push(new YAMLWarning(pos, code, message));
      else
        this.errors.push(new YAMLParseError(pos, code, message));
    };
    this.directives = new Directives({ version: options.version || "1.2" });
    this.options = options;
  }
  decorate(doc, afterDoc) {
    const { comment: comment2, afterEmptyLine } = parsePrelude(this.prelude);
    if (comment2) {
      const dc2 = doc.contents;
      if (afterDoc) {
        doc.comment = doc.comment ? `${doc.comment}
${comment2}` : comment2;
      } else if (afterEmptyLine || doc.directives.docStart || !dc2) {
        doc.commentBefore = comment2;
      } else if (isCollection(dc2) && !dc2.flow && dc2.items.length > 0) {
        let it2 = dc2.items[0];
        if (isPair(it2))
          it2 = it2.key;
        const cb = it2.commentBefore;
        it2.commentBefore = cb ? `${comment2}
${cb}` : comment2;
      } else {
        const cb = dc2.commentBefore;
        dc2.commentBefore = cb ? `${comment2}
${cb}` : comment2;
      }
    }
    if (afterDoc) {
      for (let i = 0; i < this.errors.length; ++i)
        doc.errors.push(this.errors[i]);
      for (let i = 0; i < this.warnings.length; ++i)
        doc.warnings.push(this.warnings[i]);
    } else {
      doc.errors = this.errors;
      doc.warnings = this.warnings;
    }
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
  }
  /**
   * Current stream status information.
   *
   * Mostly useful at the end of input for an empty stream.
   */
  streamInfo() {
    return {
      comment: parsePrelude(this.prelude).comment,
      directives: this.directives,
      errors: this.errors,
      warnings: this.warnings
    };
  }
  /**
   * Compose tokens into documents.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *compose(tokens, forceDoc = false, endOffset = -1) {
    for (const token of tokens)
      yield* this.next(token);
    yield* this.end(forceDoc, endOffset);
  }
  /** Advance the composer by one CST token. */
  *next(token) {
    switch (token.type) {
      case "directive":
        this.directives.add(token.source, (offset, message, warning) => {
          const pos = getErrorPos(token);
          pos[0] += offset;
          this.onError(pos, "BAD_DIRECTIVE", message, warning);
        });
        this.prelude.push(token.source);
        this.atDirectives = true;
        break;
      case "document": {
        const doc = composeDoc(this.options, this.directives, token, this.onError);
        if (this.atDirectives && !doc.directives.docStart)
          this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
        this.decorate(doc, false);
        if (this.doc)
          yield this.doc;
        this.doc = doc;
        this.atDirectives = false;
        break;
      }
      case "byte-order-mark":
      case "space":
        break;
      case "comment":
      case "newline":
        this.prelude.push(token.source);
        break;
      case "error": {
        const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
        const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
        if (this.atDirectives || !this.doc)
          this.errors.push(error);
        else
          this.doc.errors.push(error);
        break;
      }
      case "doc-end": {
        if (!this.doc) {
          const msg = "Unexpected doc-end without preceding document";
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
          break;
        }
        this.doc.directives.docEnd = true;
        const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
        this.decorate(this.doc, true);
        if (end.comment) {
          const dc2 = this.doc.comment;
          this.doc.comment = dc2 ? `${dc2}
${end.comment}` : end.comment;
        }
        this.doc.range[2] = end.offset;
        break;
      }
      default:
        this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
    }
  }
  /**
   * Call at end of input to yield any remaining document.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *end(forceDoc = false, endOffset = -1) {
    if (this.doc) {
      this.decorate(this.doc, true);
      yield this.doc;
      this.doc = null;
    } else if (forceDoc) {
      const opts = Object.assign({ _directives: this.directives }, this.options);
      const doc = new Document(void 0, opts);
      if (this.atDirectives)
        this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
      doc.range = [0, endOffset, endOffset];
      this.decorate(doc, false);
      yield doc;
    }
  }
};

// node_modules/yaml/browser/dist/parse/cst-visit.js
var BREAK2 = Symbol("break visit");
var SKIP2 = Symbol("skip children");
var REMOVE2 = Symbol("remove item");
function visit2(cst, visitor) {
  if ("type" in cst && cst.type === "document")
    cst = { start: cst.start, value: cst.value };
  _visit(Object.freeze([]), cst, visitor);
}
visit2.BREAK = BREAK2;
visit2.SKIP = SKIP2;
visit2.REMOVE = REMOVE2;
visit2.itemAtPath = (cst, path) => {
  let item = cst;
  for (const [field, index] of path) {
    const tok = item?.[field];
    if (tok && "items" in tok) {
      item = tok.items[index];
    } else
      return void 0;
  }
  return item;
};
visit2.parentCollection = (cst, path) => {
  const parent = visit2.itemAtPath(cst, path.slice(0, -1));
  const field = path[path.length - 1][0];
  const coll = parent?.[field];
  if (coll && "items" in coll)
    return coll;
  throw new Error("Parent collection not found");
};
function _visit(path, item, visitor) {
  let ctrl = visitor(item, path);
  if (typeof ctrl === "symbol")
    return ctrl;
  for (const field of ["key", "value"]) {
    const token = item[field];
    if (token && "items" in token) {
      for (let i = 0; i < token.items.length; ++i) {
        const ci2 = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
        if (typeof ci2 === "number")
          i = ci2 - 1;
        else if (ci2 === BREAK2)
          return BREAK2;
        else if (ci2 === REMOVE2) {
          token.items.splice(i, 1);
          i -= 1;
        }
      }
      if (typeof ctrl === "function" && field === "key")
        ctrl = ctrl(item, path);
    }
  }
  return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
}

// node_modules/yaml/browser/dist/parse/cst.js
var BOM = "\uFEFF";
var DOCUMENT = "";
var FLOW_END = "";
var SCALAR2 = "";
function tokenType(source) {
  switch (source) {
    case BOM:
      return "byte-order-mark";
    case DOCUMENT:
      return "doc-mode";
    case FLOW_END:
      return "flow-error-end";
    case SCALAR2:
      return "scalar";
    case "---":
      return "doc-start";
    case "...":
      return "doc-end";
    case "":
    case "\n":
    case "\r\n":
      return "newline";
    case "-":
      return "seq-item-ind";
    case "?":
      return "explicit-key-ind";
    case ":":
      return "map-value-ind";
    case "{":
      return "flow-map-start";
    case "}":
      return "flow-map-end";
    case "[":
      return "flow-seq-start";
    case "]":
      return "flow-seq-end";
    case ",":
      return "comma";
  }
  switch (source[0]) {
    case " ":
    case "	":
      return "space";
    case "#":
      return "comment";
    case "%":
      return "directive-line";
    case "*":
      return "alias";
    case "&":
      return "anchor";
    case "!":
      return "tag";
    case "'":
      return "single-quoted-scalar";
    case '"':
      return "double-quoted-scalar";
    case "|":
    case ">":
      return "block-scalar-header";
  }
  return null;
}

// node_modules/yaml/browser/dist/parse/lexer.js
function isEmpty(ch) {
  switch (ch) {
    case void 0:
    case " ":
    case "\n":
    case "\r":
    case "	":
      return true;
    default:
      return false;
  }
}
var hexDigits = new Set("0123456789ABCDEFabcdef");
var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
var flowIndicatorChars = new Set(",[]{}");
var invalidAnchorChars = new Set(" ,[]{}\n\r	");
var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
var Lexer = class {
  constructor() {
    this.atEnd = false;
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    this.buffer = "";
    this.flowKey = false;
    this.flowLevel = 0;
    this.indentNext = 0;
    this.indentValue = 0;
    this.lineEndPos = null;
    this.next = null;
    this.pos = 0;
  }
  /**
   * Generate YAML tokens from the `source` string. If `incomplete`,
   * a part of the last line may be left as a buffer for the next call.
   *
   * @returns A generator of lexical tokens
   */
  *lex(source, incomplete = false) {
    if (source) {
      if (typeof source !== "string")
        throw TypeError("source is not a string");
      this.buffer = this.buffer ? this.buffer + source : source;
      this.lineEndPos = null;
    }
    this.atEnd = !incomplete;
    let next = this.next ?? "stream";
    while (next && (incomplete || this.hasChars(1)))
      next = yield* this.parseNext(next);
  }
  atLineEnd() {
    let i = this.pos;
    let ch = this.buffer[i];
    while (ch === " " || ch === "	")
      ch = this.buffer[++i];
    if (!ch || ch === "#" || ch === "\n")
      return true;
    if (ch === "\r")
      return this.buffer[i + 1] === "\n";
    return false;
  }
  charAt(n) {
    return this.buffer[this.pos + n];
  }
  continueScalar(offset) {
    let ch = this.buffer[offset];
    if (this.indentNext > 0) {
      let indent = 0;
      while (ch === " ")
        ch = this.buffer[++indent + offset];
      if (ch === "\r") {
        const next = this.buffer[indent + offset + 1];
        if (next === "\n" || !next && !this.atEnd)
          return offset + indent + 1;
      }
      return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
    }
    if (ch === "-" || ch === ".") {
      const dt2 = this.buffer.substr(offset, 3);
      if ((dt2 === "---" || dt2 === "...") && isEmpty(this.buffer[offset + 3]))
        return -1;
    }
    return offset;
  }
  getLine() {
    let end = this.lineEndPos;
    if (typeof end !== "number" || end !== -1 && end < this.pos) {
      end = this.buffer.indexOf("\n", this.pos);
      this.lineEndPos = end;
    }
    if (end === -1)
      return this.atEnd ? this.buffer.substring(this.pos) : null;
    if (this.buffer[end - 1] === "\r")
      end -= 1;
    return this.buffer.substring(this.pos, end);
  }
  hasChars(n) {
    return this.pos + n <= this.buffer.length;
  }
  setNext(state) {
    this.buffer = this.buffer.substring(this.pos);
    this.pos = 0;
    this.lineEndPos = null;
    this.next = state;
    return null;
  }
  peek(n) {
    return this.buffer.substr(this.pos, n);
  }
  *parseNext(next) {
    switch (next) {
      case "stream":
        return yield* this.parseStream();
      case "line-start":
        return yield* this.parseLineStart();
      case "block-start":
        return yield* this.parseBlockStart();
      case "doc":
        return yield* this.parseDocument();
      case "flow":
        return yield* this.parseFlowCollection();
      case "quoted-scalar":
        return yield* this.parseQuotedScalar();
      case "block-scalar":
        return yield* this.parseBlockScalar();
      case "plain-scalar":
        return yield* this.parsePlainScalar();
    }
  }
  *parseStream() {
    let line = this.getLine();
    if (line === null)
      return this.setNext("stream");
    if (line[0] === BOM) {
      yield* this.pushCount(1);
      line = line.substring(1);
    }
    if (line[0] === "%") {
      let dirEnd = line.length;
      let cs2 = line.indexOf("#");
      while (cs2 !== -1) {
        const ch = line[cs2 - 1];
        if (ch === " " || ch === "	") {
          dirEnd = cs2 - 1;
          break;
        } else {
          cs2 = line.indexOf("#", cs2 + 1);
        }
      }
      while (true) {
        const ch = line[dirEnd - 1];
        if (ch === " " || ch === "	")
          dirEnd -= 1;
        else
          break;
      }
      const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
      yield* this.pushCount(line.length - n);
      this.pushNewline();
      return "stream";
    }
    if (this.atLineEnd()) {
      const sp = yield* this.pushSpaces(true);
      yield* this.pushCount(line.length - sp);
      yield* this.pushNewline();
      return "stream";
    }
    yield DOCUMENT;
    return yield* this.parseLineStart();
  }
  *parseLineStart() {
    const ch = this.charAt(0);
    if (!ch && !this.atEnd)
      return this.setNext("line-start");
    if (ch === "-" || ch === ".") {
      if (!this.atEnd && !this.hasChars(4))
        return this.setNext("line-start");
      const s = this.peek(3);
      if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
        yield* this.pushCount(3);
        this.indentValue = 0;
        this.indentNext = 0;
        return s === "---" ? "doc" : "stream";
      }
    }
    this.indentValue = yield* this.pushSpaces(false);
    if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
      this.indentNext = this.indentValue;
    return yield* this.parseBlockStart();
  }
  *parseBlockStart() {
    const [ch0, ch1] = this.peek(2);
    if (!ch1 && !this.atEnd)
      return this.setNext("block-start");
    if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
      const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
      this.indentNext = this.indentValue + 1;
      this.indentValue += n;
      return "block-start";
    }
    return "doc";
  }
  *parseDocument() {
    yield* this.pushSpaces(true);
    const line = this.getLine();
    if (line === null)
      return this.setNext("doc");
    let n = yield* this.pushIndicators();
    switch (line[n]) {
      case "#":
        yield* this.pushCount(line.length - n);
      // fallthrough
      case void 0:
        yield* this.pushNewline();
        return yield* this.parseLineStart();
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel = 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        return "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "doc";
      case '"':
      case "'":
        return yield* this.parseQuotedScalar();
      case "|":
      case ">":
        n += yield* this.parseBlockScalarHeader();
        n += yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - n);
        yield* this.pushNewline();
        return yield* this.parseBlockScalar();
      default:
        return yield* this.parsePlainScalar();
    }
  }
  *parseFlowCollection() {
    let nl2, sp;
    let indent = -1;
    do {
      nl2 = yield* this.pushNewline();
      if (nl2 > 0) {
        sp = yield* this.pushSpaces(false);
        this.indentValue = indent = sp;
      } else {
        sp = 0;
      }
      sp += yield* this.pushSpaces(true);
    } while (nl2 + sp > 0);
    const line = this.getLine();
    if (line === null)
      return this.setNext("flow");
    if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
      const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
      if (!atFlowEndMarker) {
        this.flowLevel = 0;
        yield FLOW_END;
        return yield* this.parseLineStart();
      }
    }
    let n = 0;
    while (line[n] === ",") {
      n += yield* this.pushCount(1);
      n += yield* this.pushSpaces(true);
      this.flowKey = false;
    }
    n += yield* this.pushIndicators();
    switch (line[n]) {
      case void 0:
        return "flow";
      case "#":
        yield* this.pushCount(line.length - n);
        return "flow";
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel += 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        this.flowKey = true;
        this.flowLevel -= 1;
        return this.flowLevel ? "flow" : "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "flow";
      case '"':
      case "'":
        this.flowKey = true;
        return yield* this.parseQuotedScalar();
      case ":": {
        const next = this.charAt(1);
        if (this.flowKey || isEmpty(next) || next === ",") {
          this.flowKey = false;
          yield* this.pushCount(1);
          yield* this.pushSpaces(true);
          return "flow";
        }
      }
      // fallthrough
      default:
        this.flowKey = false;
        return yield* this.parsePlainScalar();
    }
  }
  *parseQuotedScalar() {
    const quote = this.charAt(0);
    let end = this.buffer.indexOf(quote, this.pos + 1);
    if (quote === "'") {
      while (end !== -1 && this.buffer[end + 1] === "'")
        end = this.buffer.indexOf("'", end + 2);
    } else {
      while (end !== -1) {
        let n = 0;
        while (this.buffer[end - 1 - n] === "\\")
          n += 1;
        if (n % 2 === 0)
          break;
        end = this.buffer.indexOf('"', end + 1);
      }
    }
    const qb = this.buffer.substring(0, end);
    let nl2 = qb.indexOf("\n", this.pos);
    if (nl2 !== -1) {
      while (nl2 !== -1) {
        const cs2 = this.continueScalar(nl2 + 1);
        if (cs2 === -1)
          break;
        nl2 = qb.indexOf("\n", cs2);
      }
      if (nl2 !== -1) {
        end = nl2 - (qb[nl2 - 1] === "\r" ? 2 : 1);
      }
    }
    if (end === -1) {
      if (!this.atEnd)
        return this.setNext("quoted-scalar");
      end = this.buffer.length;
    }
    yield* this.pushToIndex(end + 1, false);
    return this.flowLevel ? "flow" : "doc";
  }
  *parseBlockScalarHeader() {
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    let i = this.pos;
    while (true) {
      const ch = this.buffer[++i];
      if (ch === "+")
        this.blockScalarKeep = true;
      else if (ch > "0" && ch <= "9")
        this.blockScalarIndent = Number(ch) - 1;
      else if (ch !== "-")
        break;
    }
    return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
  }
  *parseBlockScalar() {
    let nl2 = this.pos - 1;
    let indent = 0;
    let ch;
    loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
      switch (ch) {
        case " ":
          indent += 1;
          break;
        case "\n":
          nl2 = i2;
          indent = 0;
          break;
        case "\r": {
          const next = this.buffer[i2 + 1];
          if (!next && !this.atEnd)
            return this.setNext("block-scalar");
          if (next === "\n")
            break;
        }
        // fallthrough
        default:
          break loop;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("block-scalar");
    if (indent >= this.indentNext) {
      if (this.blockScalarIndent === -1)
        this.indentNext = indent;
      else {
        this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
      }
      do {
        const cs2 = this.continueScalar(nl2 + 1);
        if (cs2 === -1)
          break;
        nl2 = this.buffer.indexOf("\n", cs2);
      } while (nl2 !== -1);
      if (nl2 === -1) {
        if (!this.atEnd)
          return this.setNext("block-scalar");
        nl2 = this.buffer.length;
      }
    }
    let i = nl2 + 1;
    ch = this.buffer[i];
    while (ch === " ")
      ch = this.buffer[++i];
    if (ch === "	") {
      while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
        ch = this.buffer[++i];
      nl2 = i - 1;
    } else if (!this.blockScalarKeep) {
      do {
        let i2 = nl2 - 1;
        let ch2 = this.buffer[i2];
        if (ch2 === "\r")
          ch2 = this.buffer[--i2];
        const lastChar = i2;
        while (ch2 === " ")
          ch2 = this.buffer[--i2];
        if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
          nl2 = i2;
        else
          break;
      } while (true);
    }
    yield SCALAR2;
    yield* this.pushToIndex(nl2 + 1, true);
    return yield* this.parseLineStart();
  }
  *parsePlainScalar() {
    const inFlow = this.flowLevel > 0;
    let end = this.pos - 1;
    let i = this.pos - 1;
    let ch;
    while (ch = this.buffer[++i]) {
      if (ch === ":") {
        const next = this.buffer[i + 1];
        if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
          break;
        end = i;
      } else if (isEmpty(ch)) {
        let next = this.buffer[i + 1];
        if (ch === "\r") {
          if (next === "\n") {
            i += 1;
            ch = "\n";
            next = this.buffer[i + 1];
          } else
            end = i;
        }
        if (next === "#" || inFlow && flowIndicatorChars.has(next))
          break;
        if (ch === "\n") {
          const cs2 = this.continueScalar(i + 1);
          if (cs2 === -1)
            break;
          i = Math.max(i, cs2 - 2);
        }
      } else {
        if (inFlow && flowIndicatorChars.has(ch))
          break;
        end = i;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("plain-scalar");
    yield SCALAR2;
    yield* this.pushToIndex(end + 1, true);
    return inFlow ? "flow" : "doc";
  }
  *pushCount(n) {
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos += n;
      return n;
    }
    return 0;
  }
  *pushToIndex(i, allowEmpty) {
    const s = this.buffer.slice(this.pos, i);
    if (s) {
      yield s;
      this.pos += s.length;
      return s.length;
    } else if (allowEmpty)
      yield "";
    return 0;
  }
  *pushIndicators() {
    let n = 0;
    loop: while (true) {
      switch (this.charAt(0)) {
        case "!":
          n += yield* this.pushTag();
          n += yield* this.pushSpaces(true);
          continue loop;
        case "&":
          n += yield* this.pushUntil(isNotAnchorChar);
          n += yield* this.pushSpaces(true);
          continue loop;
        case "-":
        // this is an error
        case "?":
        // this is an error outside flow collections
        case ":": {
          const inFlow = this.flowLevel > 0;
          const ch1 = this.charAt(1);
          if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
            if (!inFlow)
              this.indentNext = this.indentValue + 1;
            else if (this.flowKey)
              this.flowKey = false;
            n += yield* this.pushCount(1);
            n += yield* this.pushSpaces(true);
            continue loop;
          }
        }
      }
      break loop;
    }
    return n;
  }
  *pushTag() {
    if (this.charAt(1) === "<") {
      let i = this.pos + 2;
      let ch = this.buffer[i];
      while (!isEmpty(ch) && ch !== ">")
        ch = this.buffer[++i];
      return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
    } else {
      let i = this.pos + 1;
      let ch = this.buffer[i];
      while (ch) {
        if (tagChars.has(ch))
          ch = this.buffer[++i];
        else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
          ch = this.buffer[i += 3];
        } else
          break;
      }
      return yield* this.pushToIndex(i, false);
    }
  }
  *pushNewline() {
    const ch = this.buffer[this.pos];
    if (ch === "\n")
      return yield* this.pushCount(1);
    else if (ch === "\r" && this.charAt(1) === "\n")
      return yield* this.pushCount(2);
    else
      return 0;
  }
  *pushSpaces(allowTabs) {
    let i = this.pos - 1;
    let ch;
    do {
      ch = this.buffer[++i];
    } while (ch === " " || allowTabs && ch === "	");
    const n = i - this.pos;
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos = i;
    }
    return n;
  }
  *pushUntil(test) {
    let i = this.pos;
    let ch = this.buffer[i];
    while (!test(ch))
      ch = this.buffer[++i];
    return yield* this.pushToIndex(i, false);
  }
};

// node_modules/yaml/browser/dist/parse/line-counter.js
var LineCounter = class {
  constructor() {
    this.lineStarts = [];
    this.addNewLine = (offset) => this.lineStarts.push(offset);
    this.linePos = (offset) => {
      let low = 0;
      let high = this.lineStarts.length;
      while (low < high) {
        const mid = low + high >> 1;
        if (this.lineStarts[mid] < offset)
          low = mid + 1;
        else
          high = mid;
      }
      if (this.lineStarts[low] === offset)
        return { line: low + 1, col: 1 };
      if (low === 0)
        return { line: 0, col: offset };
      const start = this.lineStarts[low - 1];
      return { line: low, col: offset - start + 1 };
    };
  }
};

// node_modules/yaml/browser/dist/parse/parser.js
function includesToken(list, type) {
  for (let i = 0; i < list.length; ++i)
    if (list[i].type === type)
      return true;
  return false;
}
function findNonEmptyIndex(list) {
  for (let i = 0; i < list.length; ++i) {
    switch (list[i].type) {
      case "space":
      case "comment":
      case "newline":
        break;
      default:
        return i;
    }
  }
  return -1;
}
function isFlowToken(token) {
  switch (token?.type) {
    case "alias":
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "flow-collection":
      return true;
    default:
      return false;
  }
}
function getPrevProps(parent) {
  switch (parent.type) {
    case "document":
      return parent.start;
    case "block-map": {
      const it2 = parent.items[parent.items.length - 1];
      return it2.sep ?? it2.start;
    }
    case "block-seq":
      return parent.items[parent.items.length - 1].start;
    /* istanbul ignore next should not happen */
    default:
      return [];
  }
}
function getFirstKeyStartProps(prev) {
  if (prev.length === 0)
    return [];
  let i = prev.length;
  loop: while (--i >= 0) {
    switch (prev[i].type) {
      case "doc-start":
      case "explicit-key-ind":
      case "map-value-ind":
      case "seq-item-ind":
      case "newline":
        break loop;
    }
  }
  while (prev[++i]?.type === "space") {
  }
  return prev.splice(i, prev.length);
}
function arrayPushArray(target, source) {
  if (source.length < 1e5)
    Array.prototype.push.apply(target, source);
  else
    for (let i = 0; i < source.length; ++i)
      target.push(source[i]);
}
function fixFlowSeqItems(fc2) {
  if (fc2.start.type === "flow-seq-start") {
    for (const it2 of fc2.items) {
      if (it2.sep && !it2.value && !includesToken(it2.start, "explicit-key-ind") && !includesToken(it2.sep, "map-value-ind")) {
        if (it2.key)
          it2.value = it2.key;
        delete it2.key;
        if (isFlowToken(it2.value)) {
          if (it2.value.end)
            arrayPushArray(it2.value.end, it2.sep);
          else
            it2.value.end = it2.sep;
        } else
          arrayPushArray(it2.start, it2.sep);
        delete it2.sep;
      }
    }
  }
}
var Parser = class {
  /**
   * @param onNewLine - If defined, called separately with the start position of
   *   each new line (in `parse()`, including the start of input).
   */
  constructor(onNewLine) {
    this.atNewLine = true;
    this.atScalar = false;
    this.indent = 0;
    this.offset = 0;
    this.onKeyLine = false;
    this.stack = [];
    this.source = "";
    this.type = "";
    this.lexer = new Lexer();
    this.onNewLine = onNewLine;
  }
  /**
   * Parse `source` as a YAML stream.
   * If `incomplete`, a part of the last line may be left as a buffer for the next call.
   *
   * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
   *
   * @returns A generator of tokens representing each directive, document, and other structure.
   */
  *parse(source, incomplete = false) {
    if (this.onNewLine && this.offset === 0)
      this.onNewLine(0);
    for (const lexeme of this.lexer.lex(source, incomplete))
      yield* this.next(lexeme);
    if (!incomplete)
      yield* this.end();
  }
  /**
   * Advance the parser by the `source` of one lexical token.
   */
  *next(source) {
    this.source = source;
    if (this.atScalar) {
      this.atScalar = false;
      yield* this.step();
      this.offset += source.length;
      return;
    }
    const type = tokenType(source);
    if (!type) {
      const message = `Not a YAML token: ${source}`;
      yield* this.pop({ type: "error", offset: this.offset, message, source });
      this.offset += source.length;
    } else if (type === "scalar") {
      this.atNewLine = false;
      this.atScalar = true;
      this.type = "scalar";
    } else {
      this.type = type;
      yield* this.step();
      switch (type) {
        case "newline":
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine)
            this.onNewLine(this.offset + source.length);
          break;
        case "space":
          if (this.atNewLine && source[0] === " ")
            this.indent += source.length;
          break;
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
          if (this.atNewLine)
            this.indent += source.length;
          break;
        case "doc-mode":
        case "flow-error-end":
          return;
        default:
          this.atNewLine = false;
      }
      this.offset += source.length;
    }
  }
  /** Call at end of input to push out any remaining constructions */
  *end() {
    while (this.stack.length > 0)
      yield* this.pop();
  }
  get sourceToken() {
    const st2 = {
      type: this.type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
    return st2;
  }
  *step() {
    const top = this.peek(1);
    if (this.type === "doc-end" && top?.type !== "doc-end") {
      while (this.stack.length > 0)
        yield* this.pop();
      this.stack.push({
        type: "doc-end",
        offset: this.offset,
        source: this.source
      });
      return;
    }
    if (!top)
      return yield* this.stream();
    switch (top.type) {
      case "document":
        return yield* this.document(top);
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return yield* this.scalar(top);
      case "block-scalar":
        return yield* this.blockScalar(top);
      case "block-map":
        return yield* this.blockMap(top);
      case "block-seq":
        return yield* this.blockSequence(top);
      case "flow-collection":
        return yield* this.flowCollection(top);
      case "doc-end":
        return yield* this.documentEnd(top);
    }
    yield* this.pop();
  }
  peek(n) {
    return this.stack[this.stack.length - n];
  }
  *pop(error) {
    const token = error ?? this.stack.pop();
    if (!token) {
      const message = "Tried to pop an empty stack";
      yield { type: "error", offset: this.offset, source: "", message };
    } else if (this.stack.length === 0) {
      yield token;
    } else {
      const top = this.peek(1);
      if (token.type === "block-scalar") {
        token.indent = "indent" in top ? top.indent : 0;
      } else if (token.type === "flow-collection" && top.type === "document") {
        token.indent = 0;
      }
      if (token.type === "flow-collection")
        fixFlowSeqItems(token);
      switch (top.type) {
        case "document":
          top.value = token;
          break;
        case "block-scalar":
          top.props.push(token);
          break;
        case "block-map": {
          const it2 = top.items[top.items.length - 1];
          if (it2.value) {
            top.items.push({ start: [], key: token, sep: [] });
            this.onKeyLine = true;
            return;
          } else if (it2.sep) {
            it2.value = token;
          } else {
            Object.assign(it2, { key: token, sep: [] });
            this.onKeyLine = !it2.explicitKey;
            return;
          }
          break;
        }
        case "block-seq": {
          const it2 = top.items[top.items.length - 1];
          if (it2.value)
            top.items.push({ start: [], value: token });
          else
            it2.value = token;
          break;
        }
        case "flow-collection": {
          const it2 = top.items[top.items.length - 1];
          if (!it2 || it2.value)
            top.items.push({ start: [], key: token, sep: [] });
          else if (it2.sep)
            it2.value = token;
          else
            Object.assign(it2, { key: token, sep: [] });
          return;
        }
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.pop(token);
      }
      if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
        const last = token.items[token.items.length - 1];
        if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st2) => st2.type !== "comment" || st2.indent < token.indent))) {
          if (top.type === "document")
            top.end = last.start;
          else
            top.items.push({ start: last.start });
          token.items.splice(-1, 1);
        }
      }
    }
  }
  *stream() {
    switch (this.type) {
      case "directive-line":
        yield { type: "directive", offset: this.offset, source: this.source };
        return;
      case "byte-order-mark":
      case "space":
      case "comment":
      case "newline":
        yield this.sourceToken;
        return;
      case "doc-mode":
      case "doc-start": {
        const doc = {
          type: "document",
          offset: this.offset,
          start: []
        };
        if (this.type === "doc-start")
          doc.start.push(this.sourceToken);
        this.stack.push(doc);
        return;
      }
    }
    yield {
      type: "error",
      offset: this.offset,
      message: `Unexpected ${this.type} token in YAML stream`,
      source: this.source
    };
  }
  *document(doc) {
    if (doc.value)
      return yield* this.lineEnd(doc);
    switch (this.type) {
      case "doc-start": {
        if (findNonEmptyIndex(doc.start) !== -1) {
          yield* this.pop();
          yield* this.step();
        } else
          doc.start.push(this.sourceToken);
        return;
      }
      case "anchor":
      case "tag":
      case "space":
      case "comment":
      case "newline":
        doc.start.push(this.sourceToken);
        return;
    }
    const bv = this.startBlockValue(doc);
    if (bv)
      this.stack.push(bv);
    else {
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML document`,
        source: this.source
      };
    }
  }
  *scalar(scalar) {
    if (this.type === "map-value-ind") {
      const prev = getPrevProps(this.peek(2));
      const start = getFirstKeyStartProps(prev);
      let sep;
      if (scalar.end) {
        sep = scalar.end;
        sep.push(this.sourceToken);
        delete scalar.end;
      } else
        sep = [this.sourceToken];
      const map2 = {
        type: "block-map",
        offset: scalar.offset,
        indent: scalar.indent,
        items: [{ start, key: scalar, sep }]
      };
      this.onKeyLine = true;
      this.stack[this.stack.length - 1] = map2;
    } else
      yield* this.lineEnd(scalar);
  }
  *blockScalar(scalar) {
    switch (this.type) {
      case "space":
      case "comment":
      case "newline":
        scalar.props.push(this.sourceToken);
        return;
      case "scalar":
        scalar.source = this.source;
        this.atNewLine = true;
        this.indent = 0;
        if (this.onNewLine) {
          let nl2 = this.source.indexOf("\n") + 1;
          while (nl2 !== 0) {
            this.onNewLine(this.offset + nl2);
            nl2 = this.source.indexOf("\n", nl2) + 1;
          }
        }
        yield* this.pop();
        break;
      /* istanbul ignore next should not happen */
      default:
        yield* this.pop();
        yield* this.step();
    }
  }
  *blockMap(map2) {
    const it2 = map2.items[map2.items.length - 1];
    switch (this.type) {
      case "newline":
        this.onKeyLine = false;
        if (it2.value) {
          const end = "end" in it2.value ? it2.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            map2.items.push({ start: [this.sourceToken] });
        } else if (it2.sep) {
          it2.sep.push(this.sourceToken);
        } else {
          it2.start.push(this.sourceToken);
        }
        return;
      case "space":
      case "comment":
        if (it2.value) {
          map2.items.push({ start: [this.sourceToken] });
        } else if (it2.sep) {
          it2.sep.push(this.sourceToken);
        } else {
          if (this.atIndentedComment(it2.start, map2.indent)) {
            const prev = map2.items[map2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it2.start);
              end.push(this.sourceToken);
              map2.items.pop();
              return;
            }
          }
          it2.start.push(this.sourceToken);
        }
        return;
    }
    if (this.indent >= map2.indent) {
      const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
      const atNextItem = atMapIndent && (it2.sep || it2.explicitKey) && this.type !== "seq-item-ind";
      let start = [];
      if (atNextItem && it2.sep && !it2.value) {
        const nl2 = [];
        for (let i = 0; i < it2.sep.length; ++i) {
          const st2 = it2.sep[i];
          switch (st2.type) {
            case "newline":
              nl2.push(i);
              break;
            case "space":
              break;
            case "comment":
              if (st2.indent > map2.indent)
                nl2.length = 0;
              break;
            default:
              nl2.length = 0;
          }
        }
        if (nl2.length >= 2)
          start = it2.sep.splice(nl2[1]);
      }
      switch (this.type) {
        case "anchor":
        case "tag":
          if (atNextItem || it2.value) {
            start.push(this.sourceToken);
            map2.items.push({ start });
            this.onKeyLine = true;
          } else if (it2.sep) {
            it2.sep.push(this.sourceToken);
          } else {
            it2.start.push(this.sourceToken);
          }
          return;
        case "explicit-key-ind":
          if (!it2.sep && !it2.explicitKey) {
            it2.start.push(this.sourceToken);
            it2.explicitKey = true;
          } else if (atNextItem || it2.value) {
            start.push(this.sourceToken);
            map2.items.push({ start, explicitKey: true });
          } else {
            this.stack.push({
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken], explicitKey: true }]
            });
          }
          this.onKeyLine = true;
          return;
        case "map-value-ind":
          if (it2.explicitKey) {
            if (!it2.sep) {
              if (includesToken(it2.start, "newline")) {
                Object.assign(it2, { key: null, sep: [this.sourceToken] });
              } else {
                const start2 = getFirstKeyStartProps(it2.start);
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                });
              }
            } else if (it2.value) {
              map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
            } else if (includesToken(it2.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start, key: null, sep: [this.sourceToken] }]
              });
            } else if (isFlowToken(it2.key) && !includesToken(it2.sep, "newline")) {
              const start2 = getFirstKeyStartProps(it2.start);
              const key = it2.key;
              const sep = it2.sep;
              sep.push(this.sourceToken);
              delete it2.key;
              delete it2.sep;
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: start2, key, sep }]
              });
            } else if (start.length > 0) {
              it2.sep = it2.sep.concat(start, this.sourceToken);
            } else {
              it2.sep.push(this.sourceToken);
            }
          } else {
            if (!it2.sep) {
              Object.assign(it2, { key: null, sep: [this.sourceToken] });
            } else if (it2.value || atNextItem) {
              map2.items.push({ start, key: null, sep: [this.sourceToken] });
            } else if (includesToken(it2.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [], key: null, sep: [this.sourceToken] }]
              });
            } else {
              it2.sep.push(this.sourceToken);
            }
          }
          this.onKeyLine = true;
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs2 = this.flowScalar(this.type);
          if (atNextItem || it2.value) {
            map2.items.push({ start, key: fs2, sep: [] });
            this.onKeyLine = true;
          } else if (it2.sep) {
            this.stack.push(fs2);
          } else {
            Object.assign(it2, { key: fs2, sep: [] });
            this.onKeyLine = true;
          }
          return;
        }
        default: {
          const bv = this.startBlockValue(map2);
          if (bv) {
            if (bv.type === "block-seq") {
              if (!it2.explicitKey && it2.sep && !includesToken(it2.sep, "newline")) {
                yield* this.pop({
                  type: "error",
                  offset: this.offset,
                  message: "Unexpected block-seq-ind on same line with key",
                  source: this.source
                });
                return;
              }
            } else if (atMapIndent) {
              map2.items.push({ start });
            }
            this.stack.push(bv);
            return;
          }
        }
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *blockSequence(seq2) {
    const it2 = seq2.items[seq2.items.length - 1];
    switch (this.type) {
      case "newline":
        if (it2.value) {
          const end = "end" in it2.value ? it2.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            seq2.items.push({ start: [this.sourceToken] });
        } else
          it2.start.push(this.sourceToken);
        return;
      case "space":
      case "comment":
        if (it2.value)
          seq2.items.push({ start: [this.sourceToken] });
        else {
          if (this.atIndentedComment(it2.start, seq2.indent)) {
            const prev = seq2.items[seq2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it2.start);
              end.push(this.sourceToken);
              seq2.items.pop();
              return;
            }
          }
          it2.start.push(this.sourceToken);
        }
        return;
      case "anchor":
      case "tag":
        if (it2.value || this.indent <= seq2.indent)
          break;
        it2.start.push(this.sourceToken);
        return;
      case "seq-item-ind":
        if (this.indent !== seq2.indent)
          break;
        if (it2.value || includesToken(it2.start, "seq-item-ind"))
          seq2.items.push({ start: [this.sourceToken] });
        else
          it2.start.push(this.sourceToken);
        return;
    }
    if (this.indent > seq2.indent) {
      const bv = this.startBlockValue(seq2);
      if (bv) {
        this.stack.push(bv);
        return;
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *flowCollection(fc2) {
    const it2 = fc2.items[fc2.items.length - 1];
    if (this.type === "flow-error-end") {
      let top;
      do {
        yield* this.pop();
        top = this.peek(1);
      } while (top?.type === "flow-collection");
    } else if (fc2.end.length === 0) {
      switch (this.type) {
        case "comma":
        case "explicit-key-ind":
          if (!it2 || it2.sep)
            fc2.items.push({ start: [this.sourceToken] });
          else
            it2.start.push(this.sourceToken);
          return;
        case "map-value-ind":
          if (!it2 || it2.value)
            fc2.items.push({ start: [], key: null, sep: [this.sourceToken] });
          else if (it2.sep)
            it2.sep.push(this.sourceToken);
          else
            Object.assign(it2, { key: null, sep: [this.sourceToken] });
          return;
        case "space":
        case "comment":
        case "newline":
        case "anchor":
        case "tag":
          if (!it2 || it2.value)
            fc2.items.push({ start: [this.sourceToken] });
          else if (it2.sep)
            it2.sep.push(this.sourceToken);
          else
            it2.start.push(this.sourceToken);
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs2 = this.flowScalar(this.type);
          if (!it2 || it2.value)
            fc2.items.push({ start: [], key: fs2, sep: [] });
          else if (it2.sep)
            this.stack.push(fs2);
          else
            Object.assign(it2, { key: fs2, sep: [] });
          return;
        }
        case "flow-map-end":
        case "flow-seq-end":
          fc2.end.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(fc2);
      if (bv)
        this.stack.push(bv);
      else {
        yield* this.pop();
        yield* this.step();
      }
    } else {
      const parent = this.peek(2);
      if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc2.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
        yield* this.pop();
        yield* this.step();
      } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        fixFlowSeqItems(fc2);
        const sep = fc2.end.splice(1, fc2.end.length);
        sep.push(this.sourceToken);
        const map2 = {
          type: "block-map",
          offset: fc2.offset,
          indent: fc2.indent,
          items: [{ start, key: fc2, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else {
        yield* this.lineEnd(fc2);
      }
    }
  }
  flowScalar(type) {
    if (this.onNewLine) {
      let nl2 = this.source.indexOf("\n") + 1;
      while (nl2 !== 0) {
        this.onNewLine(this.offset + nl2);
        nl2 = this.source.indexOf("\n", nl2) + 1;
      }
    }
    return {
      type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
  }
  startBlockValue(parent) {
    switch (this.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return this.flowScalar(this.type);
      case "block-scalar-header":
        return {
          type: "block-scalar",
          offset: this.offset,
          indent: this.indent,
          props: [this.sourceToken],
          source: ""
        };
      case "flow-map-start":
      case "flow-seq-start":
        return {
          type: "flow-collection",
          offset: this.offset,
          indent: this.indent,
          start: this.sourceToken,
          items: [],
          end: []
        };
      case "seq-item-ind":
        return {
          type: "block-seq",
          offset: this.offset,
          indent: this.indent,
          items: [{ start: [this.sourceToken] }]
        };
      case "explicit-key-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        start.push(this.sourceToken);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, explicitKey: true }]
        };
      }
      case "map-value-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, key: null, sep: [this.sourceToken] }]
        };
      }
    }
    return null;
  }
  atIndentedComment(start, indent) {
    if (this.type !== "comment")
      return false;
    if (this.indent <= indent)
      return false;
    return start.every((st2) => st2.type === "newline" || st2.type === "space");
  }
  *documentEnd(docEnd) {
    if (this.type !== "doc-mode") {
      if (docEnd.end)
        docEnd.end.push(this.sourceToken);
      else
        docEnd.end = [this.sourceToken];
      if (this.type === "newline")
        yield* this.pop();
    }
  }
  *lineEnd(token) {
    switch (this.type) {
      case "comma":
      case "doc-start":
      case "doc-end":
      case "flow-seq-end":
      case "flow-map-end":
      case "map-value-ind":
        yield* this.pop();
        yield* this.step();
        break;
      case "newline":
        this.onKeyLine = false;
      // fallthrough
      case "space":
      case "comment":
      default:
        if (token.end)
          token.end.push(this.sourceToken);
        else
          token.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
    }
  }
};

// node_modules/yaml/browser/dist/public-api.js
function parseOptions(options) {
  const prettyErrors = options.prettyErrors !== false;
  const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
  return { lineCounter, prettyErrors };
}
function parseDocument(source, options = {}) {
  const { lineCounter, prettyErrors } = parseOptions(options);
  const parser2 = new Parser(lineCounter?.addNewLine);
  const composer = new Composer(options);
  let doc = null;
  for (const _doc of composer.compose(parser2.parse(source), true, source.length)) {
    if (!doc)
      doc = _doc;
    else if (doc.options.logLevel !== "silent") {
      doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
      break;
    }
  }
  if (prettyErrors && lineCounter) {
    doc.errors.forEach(prettifyError(source, lineCounter));
    doc.warnings.forEach(prettifyError(source, lineCounter));
  }
  return doc;
}

// src/notation-reference-property.ts
var NOTATION_LINKS_KEY = "study-notation-links";
function mayOwnReferenceProperty(source) {
  const opening = /^\uFEFF?---\r?\n/.exec(source);
  if (!opening) return false;
  const tail = source.slice(opening[0].length), closing = /^(?:---|\.\.\.)(?:\r?\n|$)/m.exec(tail), body = closing ? tail.slice(0, closing.index) : tail;
  if (body.includes("{")) {
    const doc = parseDocument(body, { uniqueKeys: true });
    if (isMap(doc.contents) && doc.contents.flow) return doc.contents.items.some((pair) => isScalar(pair.key) && pair.key.value === NOTATION_LINKS_KEY);
  }
  for (const raw of body.split("\n")) {
    const line = raw.trimStart().replace(/^\?\s+/, "");
    if (/^["']?study-notation-links(?:["']|\s|:|$)/.test(line)) return true;
    const quoted = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s*:/.exec(line);
    if (quoted) {
      const key = parseDocument(quoted[1]);
      if (isScalar(key.contents) && key.contents.value === NOTATION_LINKS_KEY) return true;
    }
  }
  return false;
}
function frontmatter(source) {
  const bom = source.startsWith("\uFEFF") ? 1 : 0;
  const match = /^---\r?\n((?:[^\n]*\n)*?)(?:---|\.\.\.)(?:\r?\n|$)/.exec(source.slice(bom));
  if (!match) {
    if (/^---(?:\r?\n|$)/.test(source.slice(bom))) throw Error("Malformed frontmatter; notation references were not written.");
    return void 0;
  }
  return { body: match[1], offset: bom + match[0].indexOf("\n") + 1, newline: match[0].startsWith("---\r\n") ? "\r\n" : "\n" };
}
function lineIndent(source, at) {
  const from = source.lastIndexOf("\n", at - 1) + 1, indent = source.slice(from, at);
  if (!/^ *$/.test(indent)) throw Error("Unsupported frontmatter key layout; notation references were not written.");
  return { from, indent };
}
function notationReferenceProperty(source) {
  const front2 = frontmatter(source);
  if (!front2) return void 0;
  const doc = parseDocument(front2.body, { uniqueKeys: true });
  if (doc.errors.length) throw Error("Invalid or duplicate frontmatter keys; notation references were not written.");
  if (!doc.contents) return void 0;
  if (!isMap(doc.contents)) throw Error("Frontmatter must be a mapping.");
  const pair = doc.contents.items.find((p2) => isScalar(p2.key) && p2.key.value === NOTATION_LINKS_KEY);
  if (!pair) return void 0;
  if (doc.contents.flow) throw Error("Flow-style frontmatter with notation references is unsupported; no source was changed.");
  if (!isScalar(pair.key) || !pair.key.range || !isSeq(pair.value) || !pair.value.range || pair.value.items.some((item) => !isScalar(item) || typeof item.value !== "string")) throw Error("Invalid notation reference list.");
  const { from } = lineIndent(front2.body, pair.key.range[0]);
  return { from: front2.offset + from, to: front2.offset + pair.value.range[2], value: pair.value.items.map((item) => item.value) };
}
function editNotationReferenceProperty(source, links) {
  if (links.some((link) => typeof link !== "string") || links.length > 1e4) throw Error("Invalid notation reference list.");
  if (!links.length && !mayOwnReferenceProperty(source)) return void 0;
  const front2 = frontmatter(source), property = notationReferenceProperty(source), nl2 = front2?.newline ?? source.match(/\r?\n/)?.[0] ?? "\n", line = NOTATION_LINKS_KEY + ": " + JSON.stringify(links);
  if (property) {
    if (JSON.stringify(property.value) === JSON.stringify(links)) return void 0;
    const tail = source.slice(property.from, property.to).endsWith("\n") ? nl2 : "";
    const indent = /^ */.exec(source.slice(property.from))[0];
    return { from: property.from, to: property.to, insert: links.length ? indent + line + tail : "" };
  }
  if (!links.length) return void 0;
  if (front2) {
    const root = parseDocument(front2.body, { uniqueKeys: true }).contents;
    if (isMap(root) && root.flow) throw Error("Flow-style frontmatter with notation references is unsupported; no source was changed.");
    const indent = root?.range ? lineIndent(front2.body, root.range[0]).indent : "";
    return { from: front2.offset, to: front2.offset, insert: indent + line + nl2 };
  }
  const bom = source.startsWith("\uFEFF") ? 1 : 0;
  return { from: bom, to: bom, insert: "---" + nl2 + line + nl2 + "---" + nl2 + nl2 };
}

// src/notation-frontmatter-plan.ts
var FRONT = /^(\uFEFF?---\r?\n)((?:[^\n]*\n)*?)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
var ID3 = /^kl-doc: ([A-Za-z0-9-]{1,80})(\r?\n|\r)?$/;
function header(text) {
  const hit = FRONT.exec(text);
  return hit ? { raw: hit[0], body: hit[2], bodyFrom: hit[1].length, to: hit[0].length } : null;
}
function withoutNotation(text) {
  const property = notationReferenceProperty(text);
  if (!property) return text;
  if (property.value.some((link) => !/^\[\[[^\r\n]+\]\]$/.test(link))) throw Error("Invalid notation links. Your draft is retained.");
  return text.slice(0, property.from) + text.slice(property.to);
}
function identityLines(text) {
  const h = header(text);
  return h ? [...h.body.matchAll(/^kl-doc:[^\n]*(?=\n|$)/gm)].map((m3) => ({ from: h.bodyFrom + m3.index, to: h.bodyFrom + m3.index + m3[0].length, raw: m3[0] })) : [];
}
function isFrontInsert(edit, source) {
  return edit.from === edit.to && edit.from === (source.startsWith("\uFEFF") ? 1 : 0) && !!header(edit.insert);
}
function mergeNotationFrontmatter(source, references, symbols) {
  const original = header(source), bom = source.startsWith("\uFEFF") ? 1 : 0;
  if (bom && original && symbols.some((e) => e.from === 1 && e.to === original.to)) {
    if ([...references, ...symbols].some((e) => e.from < 1)) throw Error("Overlapping BOM edits. Your draft is retained.");
    const shifted = (edits) => edits.map((e) => ({ ...e, from: e.from - 1, to: e.to - 1 }));
    const merged2 = mergeNotationFrontmatter(source.slice(1), shifted(references), shifted(symbols));
    const restore = (edits) => edits.map((e) => ({ ...e, from: e.from + 1, to: e.to + 1 }));
    return { references: restore(merged2.references), symbols: restore(merged2.symbols) };
  }
  if (original) {
    const notationInsert = symbols.find((e) => e.from === original.bodyFrom && e.to === e.from);
    const identityInsert = references.find((e) => e.from === original.bodyFrom && e.to === e.from);
    if (notationInsert && identityInsert) {
      const proposed = source.slice(0, notationInsert.from) + notationInsert.insert + source.slice(notationInsert.to), property = notationReferenceProperty(proposed), identity2 = ID3.exec(identityInsert.insert);
      if (!property || property.from !== notationInsert.from || property.to !== notationInsert.from + notationInsert.insert.length || withoutNotation(proposed) !== source || !identity2 || identity2[1] === "lib" || !identity2[2]?.endsWith("\n")) throw Error("Unexpected property insertion. Your draft is retained.");
      return { references: references.filter((e) => e !== identityInsert), symbols: symbols.map((e) => e === notationInsert ? { ...e, insert: identityInsert.insert + e.insert } : e) };
    }
  }
  const notation = symbols.find((edit) => original ? edit.from === 0 && edit.to === original.to && !!header(edit.insert) : isFrontInsert(edit, source));
  if (!notation) return { references: [...references], symbols: [...symbols] };
  const originalText = original?.raw ?? "", next = header(notation.insert);
  if (original) {
    if (withoutNotation(notation.insert) !== withoutNotation(originalText)) throw Error("Notation properties changed unrelated fields. Your draft is retained.");
  } else {
    const stripped = header(withoutNotation(notation.insert));
    if (!stripped || stripped.body !== "") throw Error("New notation properties contain unrelated fields. Your draft is retained.");
    if (!/^\s*$/.test(notation.insert.slice(next.to))) throw Error("Notation properties include unexpected content. Your draft is retained.");
  }
  const candidates = references.filter((edit) => original ? edit.from >= 0 && edit.from < original.to : isFrontInsert(edit, source));
  if (!candidates.length) return { references: [...references], symbols: [...symbols] };
  if (candidates.length !== 1) throw Error("Overlapping reference properties are ambiguous. Your draft is retained.");
  const identity = candidates[0];
  let merged = notation.insert;
  if (!original) {
    if (identity.from !== bom || identity.to !== bom) throw Error("Reference properties moved. Your draft is retained.");
    const ref = header(identity.insert), line = ref && ID3.exec(ref.body);
    if (!ref || !line || line[1] === "lib" || !/^\s*$/.test(identity.insert.slice(ref.to))) throw Error("Unexpected reference properties. Your draft is retained.");
    const newline = next.raw.includes("\r\n") ? "\r\n" : "\n";
    merged = merged.slice(0, next.bodyFrom) + "kl-doc: " + line[1] + newline + merged.slice(next.bodyFrom);
  } else {
    const line = ID3.exec(identity.insert), old = identityLines(originalText), present = identityLines(merged);
    if (!line || line[1] === "lib" || old.length > 1 || present.length !== old.length) throw Error("Invalid reference identity edit. Your draft is retained.");
    if (identity.from === identity.to) {
      if (identity.from !== original.bodyFrom || old.length || !line[2]?.endsWith("\n")) throw Error("Reference identity insert is outside its properties. Your draft is retained.");
      merged = merged.slice(0, next.bodyFrom) + identity.insert + merged.slice(next.bodyFrom);
    } else {
      const rawIdentity = /^kl-doc: ([A-Za-z0-9-]{1,80})\r?$/.exec(identity.insert);
      if (!rawIdentity || old.length !== 1 || identity.from !== old[0].from || identity.to !== old[0].to || present[0].raw !== old[0].raw) throw Error("Reference identity replacement moved. Your draft is retained.");
      merged = merged.slice(0, present[0].from) + identity.insert + merged.slice(present[0].to);
    }
  }
  return { references: references.filter((edit) => edit !== identity), symbols: symbols.map((edit) => edit === notation ? { ...edit, insert: merged } : edit) };
}

// src/save-plan.ts
function plannedEquation(source, equation, edits) {
  const planned = edits.find((e) => e.from === equation.from && e.to === equation.to);
  if (planned) return planned;
  if (source.slice(equation.from, equation.to) === equation.insert) return equation;
  throw Error("Equation save plan is incomplete.");
}
function mergeEquationPlans(source, equation, referenceEdits, symbolEdits = []) {
  const composed = mergeNotationFrontmatter(source, referenceEdits, symbolEdits);
  referenceEdits = composed.references;
  symbolEdits = composed.symbols;
  const unique = /* @__PURE__ */ new Map();
  for (const plan of [referenceEdits, symbolEdits]) for (const edit of plan) {
    if (!Number.isInteger(edit.from) || !Number.isInteger(edit.to) || typeof edit.insert !== "string" || edit.from < 0 || edit.to < edit.from || edit.to > source.length) throw Error("Invalid equation save plan. Your draft is retained.");
    if (edit.from < equation.to && edit.to > equation.from && (edit.from !== equation.from || edit.to !== equation.to || edit.insert !== equation.insert)) throw Error("Equation save plans disagree. Your draft is retained.");
    unique.set(JSON.stringify([edit.from, edit.to, edit.insert]), edit);
  }
  const eof = [...unique.values()].filter((e) => e.from === source.length && e.to === source.length);
  if (eof.length === 2) {
    const anchor = eof.find((e) => referenceEdits.includes(e) && /^(?:\r?\n){2}\^[A-Za-z0-9-]{1,80}(?:\r?\n)?$/.test(e.insert));
    const registry = eof.find((e) => symbolEdits.includes(e) && e !== anchor);
    if (anchor && registry) {
      const block = registryBlock(registry.insert);
      if (block && /^\s*$/.test(registry.insert.slice(0, block.from)) && /^\s*$/.test(registry.insert.slice(block.to))) {
        for (const e of eof) unique.delete(JSON.stringify([e.from, e.to, e.insert]));
        const joined = { from: source.length, to: source.length, insert: anchor.insert.replace(/(?:\r?\n)+$/, "") + (anchor.insert.startsWith("\r\n") ? "\r\n\r\n" : "\n\n") + registry.insert.trimStart() };
        unique.set("eof-records", joined);
      }
    }
  }
  const edits = [...unique.values()].sort((a, b) => a.from - b.from || a.to - b.to);
  for (let i = 1; i < edits.length; i++) {
    const a = edits[i - 1], b = edits[i];
    if (b.from < a.to || a.from === a.to && b.from === b.to && a.from === b.from) throw Error("Reference and symbol records overlap. Your draft is retained.");
  }
  applyEdits(source, edits);
  return edits;
}

// src/reference-session.ts
var ReferenceDraft = class {
  constructor(api, sessionId, path, hash) {
    this.api = api;
    this.sessionId = sessionId;
    this.path = path;
    this.hash = hash;
  }
  reservations = /* @__PURE__ */ new Map();
  abort = new AbortController();
  async choose(options, text, expression) {
    const choice = await this.api.choose({ ...options, expression, signal: this.abort.signal });
    if (!choice || this.abort.signal.aborted) return null;
    const source = text();
    const prepared = await this.api.prepare({ path: this.path, text: source, sourceHash: this.hash(source), sessionId: this.sessionId, choice, expression, reservations: [...this.reservations.values()] });
    if (this.abort.signal.aborted) return null;
    if (prepared.reservation) this.reservations.set(prepared.target, prepared.reservation);
    return prepared;
  }
  async wrap(prepared, body) {
    if (this.abort.signal.aborted) throw Error("Equation editor was closed.");
    const result = await this.api.wrap({ mode: prepared.mode, target: prepared.target, body });
    if (this.abort.signal.aborted) throw Error("Equation editor was closed.");
    return result.wrapper;
  }
  async plan(source, equation, original, symbolEdits) {
    const plan = await this.api.planEquationSave({ path: this.path, text: source, sourceHash: this.hash(source), sessionId: this.sessionId, from: equation.from, to: equation.to, original, replacement: equation.insert, reservations: [...this.reservations.values()] });
    const edits = mergeEquationPlans(source, equation, plan.changes, symbolEdits);
    return { plan, edits };
  }
  dispose() {
    this.abort.abort();
    this.reservations.clear();
  }
};
function checkReferenceDraftSize(replacement) {
  if (replacement.length > 2e5) throw Error("Equation draft exceeds the interactive size limit.");
  if (mathReferences(replacement).length > 256) throw Error("At most 256 references are supported in one equation.");
}

// node_modules/@lezer/common/dist/index.js
var DefaultBufferLength = 1024;
var nextPropID = 0;
var Range = class {
  constructor(from, to2) {
    this.from = from;
    this.to = to2;
  }
};
var NodeProp = class {
  /**
  Create a new node prop type.
  */
  constructor(config = {}) {
    this.id = nextPropID++;
    this.perNode = !!config.perNode;
    this.deserialize = config.deserialize || (() => {
      throw new Error("This node type doesn't define a deserialize function");
    });
    this.combine = config.combine || null;
  }
  /**
  This is meant to be used with
  [`NodeSet.extend`](#common.NodeSet.extend) or
  [`LRParser.configure`](#lr.ParserConfig.props) to compute
  prop values for each node type in the set. Takes a [match
  object](#common.NodeType^match) or function that returns undefined
  if the node type doesn't get this prop, and the prop's value if
  it does.
  */
  add(match) {
    if (this.perNode)
      throw new RangeError("Can't add per-node props to node types");
    if (typeof match != "function")
      match = NodeType.match(match);
    return (type) => {
      let result = match(type);
      return result === void 0 ? null : [this, result];
    };
  }
};
NodeProp.closedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
NodeProp.openedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
NodeProp.group = new NodeProp({ deserialize: (str) => str.split(" ") });
NodeProp.isolate = new NodeProp({ deserialize: (value) => {
  if (value && value != "rtl" && value != "ltr" && value != "auto")
    throw new RangeError("Invalid value for isolate: " + value);
  return value || "auto";
} });
NodeProp.contextHash = new NodeProp({ perNode: true });
NodeProp.lookAhead = new NodeProp({ perNode: true });
NodeProp.mounted = new NodeProp({ perNode: true });
var MountedTree = class {
  constructor(tree, overlay, parser2, bracketed = false) {
    this.tree = tree;
    this.overlay = overlay;
    this.parser = parser2;
    this.bracketed = bracketed;
  }
  /**
  @internal
  */
  static get(tree) {
    return tree && tree.props && tree.props[NodeProp.mounted.id];
  }
};
var noProps = /* @__PURE__ */ Object.create(null);
var NodeType = class _NodeType {
  /**
  @internal
  */
  constructor(name2, props, id, flags = 0) {
    this.name = name2;
    this.props = props;
    this.id = id;
    this.flags = flags;
  }
  /**
  Define a node type.
  */
  static define(spec) {
    let props = spec.props && spec.props.length ? /* @__PURE__ */ Object.create(null) : noProps;
    let flags = (spec.top ? 1 : 0) | (spec.skipped ? 2 : 0) | (spec.error ? 4 : 0) | (spec.name == null ? 8 : 0);
    let type = new _NodeType(spec.name || "", props, spec.id, flags);
    if (spec.props)
      for (let src of spec.props) {
        if (!Array.isArray(src))
          src = src(type);
        if (src) {
          if (src[0].perNode)
            throw new RangeError("Can't store a per-node prop on a node type");
          props[src[0].id] = src[1];
        }
      }
    return type;
  }
  /**
  Retrieves a node prop for this type. Will return `undefined` if
  the prop isn't present on this node.
  */
  prop(prop) {
    return this.props[prop.id];
  }
  /**
  True when this is the top node of a grammar.
  */
  get isTop() {
    return (this.flags & 1) > 0;
  }
  /**
  True when this node is produced by a skip rule.
  */
  get isSkipped() {
    return (this.flags & 2) > 0;
  }
  /**
  Indicates whether this is an error node.
  */
  get isError() {
    return (this.flags & 4) > 0;
  }
  /**
  When true, this node type doesn't correspond to a user-declared
  named node, for example because it is used to cache repetition.
  */
  get isAnonymous() {
    return (this.flags & 8) > 0;
  }
  /**
  Returns true when this node's name or one of its
  [groups](#common.NodeProp^group) matches the given string.
  */
  is(name2) {
    if (typeof name2 == "string") {
      if (this.name == name2)
        return true;
      let group2 = this.prop(NodeProp.group);
      return group2 ? group2.indexOf(name2) > -1 : false;
    }
    return this.id == name2;
  }
  /**
  Create a function from node types to arbitrary values by
  specifying an object whose property names are node or
  [group](#common.NodeProp^group) names. Often useful with
  [`NodeProp.add`](#common.NodeProp.add). You can put multiple
  names, separated by spaces, in a single property name to map
  multiple node names to a single value.
  */
  static match(map2) {
    let direct = /* @__PURE__ */ Object.create(null);
    for (let prop in map2)
      for (let name2 of prop.split(" "))
        direct[name2] = map2[prop];
    return (node) => {
      for (let groups = node.prop(NodeProp.group), i = -1; i < (groups ? groups.length : 0); i++) {
        let found = direct[i < 0 ? node.name : groups[i]];
        if (found)
          return found;
      }
    };
  }
};
NodeType.none = new NodeType(
  "",
  /* @__PURE__ */ Object.create(null),
  0,
  8
  /* NodeFlag.Anonymous */
);
var NodeSet = class _NodeSet {
  /**
  Create a set with the given types. The `id` property of each
  type should correspond to its position within the array.
  */
  constructor(types) {
    this.types = types;
    for (let i = 0; i < types.length; i++)
      if (types[i].id != i)
        throw new RangeError("Node type ids should correspond to array positions when creating a node set");
  }
  /**
  Create a copy of this set with some node properties added. The
  arguments to this method can be created with
  [`NodeProp.add`](#common.NodeProp.add).
  */
  extend(...props) {
    let newTypes = [];
    for (let type of this.types) {
      let newProps = null;
      for (let source of props) {
        let add = source(type);
        if (add) {
          if (!newProps)
            newProps = Object.assign({}, type.props);
          let value = add[1], prop = add[0];
          if (prop.combine && prop.id in newProps)
            value = prop.combine(newProps[prop.id], value);
          newProps[prop.id] = value;
        }
      }
      newTypes.push(newProps ? new NodeType(type.name, newProps, type.id, type.flags) : type);
    }
    return new _NodeSet(newTypes);
  }
};
var CachedNode = /* @__PURE__ */ new WeakMap();
var CachedInnerNode = /* @__PURE__ */ new WeakMap();
var IterMode;
(function(IterMode2) {
  IterMode2[IterMode2["ExcludeBuffers"] = 1] = "ExcludeBuffers";
  IterMode2[IterMode2["IncludeAnonymous"] = 2] = "IncludeAnonymous";
  IterMode2[IterMode2["IgnoreMounts"] = 4] = "IgnoreMounts";
  IterMode2[IterMode2["IgnoreOverlays"] = 8] = "IgnoreOverlays";
  IterMode2[IterMode2["EnterBracketed"] = 16] = "EnterBracketed";
})(IterMode || (IterMode = {}));
var Tree = class _Tree {
  /**
  Construct a new tree. See also [`Tree.build`](#common.Tree^build).
  */
  constructor(type, children, positions, length, props) {
    this.type = type;
    this.children = children;
    this.positions = positions;
    this.length = length;
    this.props = null;
    if (props && props.length) {
      this.props = /* @__PURE__ */ Object.create(null);
      for (let [prop, value] of props)
        this.props[typeof prop == "number" ? prop : prop.id] = value;
    }
  }
  /**
  @internal
  */
  toString() {
    let mounted = MountedTree.get(this);
    if (mounted && !mounted.overlay)
      return mounted.tree.toString();
    let children = "";
    for (let ch of this.children) {
      let str = ch.toString();
      if (str) {
        if (children)
          children += ",";
        children += str;
      }
    }
    return !this.type.name ? children : (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (children.length ? "(" + children + ")" : "");
  }
  /**
  Get a [tree cursor](#common.TreeCursor) positioned at the top of
  the tree. Mode can be used to [control](#common.IterMode) which
  nodes the cursor visits.
  */
  cursor(mode = 0) {
    return new TreeCursor(this.topNode, mode);
  }
  /**
  Get a [tree cursor](#common.TreeCursor) pointing into this tree
  at the given position and side (see
  [`moveTo`](#common.TreeCursor.moveTo).
  */
  cursorAt(pos, side = 0, mode = 0) {
    let scope = CachedNode.get(this) || this.topNode;
    let cursor = new TreeCursor(scope);
    cursor.moveTo(pos, side);
    CachedNode.set(this, cursor._tree);
    return cursor;
  }
  /**
  Get a [syntax node](#common.SyntaxNode) object for the top of the
  tree.
  */
  get topNode() {
    return new TreeNode(this, 0, 0, null);
  }
  /**
  Get the [syntax node](#common.SyntaxNode) at the given position.
  If `side` is -1, this will move into nodes that end at the
  position. If 1, it'll move into nodes that start at the
  position. With 0, it'll only enter nodes that cover the position
  from both sides.
  
  Note that this will not enter
  [overlays](#common.MountedTree.overlay), and you often want
  [`resolveInner`](#common.Tree.resolveInner) instead.
  */
  resolve(pos, side = 0) {
    let node = resolveNode(CachedNode.get(this) || this.topNode, pos, side, false);
    CachedNode.set(this, node);
    return node;
  }
  /**
  Like [`resolve`](#common.Tree.resolve), but will enter
  [overlaid](#common.MountedTree.overlay) nodes, producing a syntax node
  pointing into the innermost overlaid tree at the given position
  (with parent links going through all parent structure, including
  the host trees).
  */
  resolveInner(pos, side = 0) {
    let node = resolveNode(CachedInnerNode.get(this) || this.topNode, pos, side, true);
    CachedInnerNode.set(this, node);
    return node;
  }
  /**
  In some situations, it can be useful to iterate through all
  nodes around a position, including those in overlays that don't
  directly cover the position. This method gives you an iterator
  that will produce all nodes, from small to big, around the given
  position.
  */
  resolveStack(pos, side = 0) {
    return stackIterator(this, pos, side);
  }
  /**
  Iterate over the tree and its children, calling `enter` for any
  node that touches the `from`/`to` region (if given) before
  running over such a node's children, and `leave` (if given) when
  leaving the node. When `enter` returns `false`, that node will
  not have its children iterated over (or `leave` called).
  */
  iterate(spec) {
    let { enter, leave, from = 0, to: to2 = this.length } = spec;
    let mode = spec.mode || 0, anon = (mode & IterMode.IncludeAnonymous) > 0;
    for (let c = this.cursor(mode | IterMode.IncludeAnonymous); ; ) {
      let entered = false;
      if (c.from <= to2 && c.to >= from && (!anon && c.type.isAnonymous || enter(c) !== false)) {
        if (c.firstChild())
          continue;
        entered = true;
      }
      for (; ; ) {
        if (entered && leave && (anon || !c.type.isAnonymous))
          leave(c);
        if (c.nextSibling())
          break;
        if (!c.parent())
          return;
        entered = true;
      }
    }
  }
  /**
  Get the value of the given [node prop](#common.NodeProp) for this
  node. Works with both per-node and per-type props.
  */
  prop(prop) {
    return !prop.perNode ? this.type.prop(prop) : this.props ? this.props[prop.id] : void 0;
  }
  /**
  Returns the node's [per-node props](#common.NodeProp.perNode) in a
  format that can be passed to the [`Tree`](#common.Tree)
  constructor.
  */
  get propValues() {
    let result = [];
    if (this.props)
      for (let id in this.props)
        result.push([+id, this.props[id]]);
    return result;
  }
  /**
  Balance the direct children of this tree, producing a copy of
  which may have children grouped into subtrees with type
  [`NodeType.none`](#common.NodeType^none).
  */
  balance(config = {}) {
    return this.children.length <= 8 ? this : balanceRange(NodeType.none, this.children, this.positions, 0, this.children.length, 0, this.length, (children, positions, length) => new _Tree(this.type, children, positions, length, this.propValues), config.makeTree || ((children, positions, length) => new _Tree(NodeType.none, children, positions, length)));
  }
  /**
  Build a tree from a postfix-ordered buffer of node information,
  or a cursor over such a buffer.
  */
  static build(data) {
    return buildTree(data);
  }
};
Tree.empty = new Tree(NodeType.none, [], [], 0);
var FlatBufferCursor = class _FlatBufferCursor {
  constructor(buffer, index) {
    this.buffer = buffer;
    this.index = index;
  }
  get id() {
    return this.buffer[this.index - 4];
  }
  get start() {
    return this.buffer[this.index - 3];
  }
  get end() {
    return this.buffer[this.index - 2];
  }
  get size() {
    return this.buffer[this.index - 1];
  }
  get pos() {
    return this.index;
  }
  next() {
    this.index -= 4;
  }
  fork() {
    return new _FlatBufferCursor(this.buffer, this.index);
  }
};
var TreeBuffer = class _TreeBuffer {
  /**
  Create a tree buffer.
  */
  constructor(buffer, length, set2) {
    this.buffer = buffer;
    this.length = length;
    this.set = set2;
  }
  /**
  @internal
  */
  get type() {
    return NodeType.none;
  }
  /**
  @internal
  */
  toString() {
    let result = [];
    for (let index = 0; index < this.buffer.length; ) {
      result.push(this.childString(index));
      index = this.buffer[index + 3];
    }
    return result.join(",");
  }
  /**
  @internal
  */
  childString(index) {
    let id = this.buffer[index], endIndex = this.buffer[index + 3];
    let type = this.set.types[id], result = type.name;
    if (/\W/.test(result) && !type.isError)
      result = JSON.stringify(result);
    index += 4;
    if (endIndex == index)
      return result;
    let children = [];
    while (index < endIndex) {
      children.push(this.childString(index));
      index = this.buffer[index + 3];
    }
    return result + "(" + children.join(",") + ")";
  }
  /**
  @internal
  */
  findChild(startIndex, endIndex, dir, pos, side) {
    let { buffer } = this, pick = -1;
    for (let i = startIndex; i != endIndex; i = buffer[i + 3]) {
      if (checkSide(side, pos, buffer[i + 1], buffer[i + 2])) {
        pick = i;
        if (dir > 0)
          break;
      }
    }
    return pick;
  }
  /**
  @internal
  */
  slice(startI, endI, from) {
    let b = this.buffer;
    let copy = new Uint16Array(endI - startI), len = 0;
    for (let i = startI, j = 0; i < endI; ) {
      copy[j++] = b[i++];
      copy[j++] = b[i++] - from;
      let to2 = copy[j++] = b[i++] - from;
      copy[j++] = b[i++] - startI;
      len = Math.max(len, to2);
    }
    return new _TreeBuffer(copy, len, this.set);
  }
};
function checkSide(side, pos, from, to2) {
  switch (side) {
    case -2:
      return from < pos;
    case -1:
      return to2 >= pos && from < pos;
    case 0:
      return from < pos && to2 > pos;
    case 1:
      return from <= pos && to2 > pos;
    case 2:
      return to2 > pos;
    case 4:
      return true;
  }
}
function resolveNode(node, pos, side, overlays) {
  var _a2;
  while (node.from == node.to || (side < 1 ? node.from >= pos : node.from > pos) || (side > -1 ? node.to <= pos : node.to < pos)) {
    let parent = !overlays && node instanceof TreeNode && node.index < 0 ? null : node.parent;
    if (!parent)
      return node;
    node = parent;
  }
  let mode = overlays ? 0 : IterMode.IgnoreOverlays;
  if (overlays)
    for (let scan = node, parent = scan.parent; parent; scan = parent, parent = scan.parent) {
      if (scan instanceof TreeNode && scan.index < 0 && ((_a2 = parent.enter(pos, side, mode)) === null || _a2 === void 0 ? void 0 : _a2.from) != scan.from)
        node = parent;
    }
  for (; ; ) {
    let inner = node.enter(pos, side, mode);
    if (!inner)
      return node;
    node = inner;
  }
}
var BaseNode = class {
  cursor(mode = 0) {
    return new TreeCursor(this, mode);
  }
  getChild(type, before = null, after = null) {
    let r = getChildren(this, type, before, after);
    return r.length ? r[0] : null;
  }
  getChildren(type, before = null, after = null) {
    return getChildren(this, type, before, after);
  }
  resolve(pos, side = 0) {
    return resolveNode(this, pos, side, false);
  }
  resolveInner(pos, side = 0) {
    return resolveNode(this, pos, side, true);
  }
  matchContext(context) {
    return matchNodeContext(this.parent, context);
  }
  enterUnfinishedNodesBefore(pos) {
    let scan = this.childBefore(pos), node = this;
    while (scan) {
      let last = scan.lastChild;
      if (!last || last.to != scan.to)
        break;
      if (last.type.isError && last.from == last.to) {
        node = scan;
        scan = last.prevSibling;
      } else {
        scan = last;
      }
    }
    return node;
  }
  get node() {
    return this;
  }
  get next() {
    return this.parent;
  }
};
var TreeNode = class _TreeNode extends BaseNode {
  constructor(_tree, from, index, _parent) {
    super();
    this._tree = _tree;
    this.from = from;
    this.index = index;
    this._parent = _parent;
  }
  get type() {
    return this._tree.type;
  }
  get name() {
    return this._tree.type.name;
  }
  get to() {
    return this.from + this._tree.length;
  }
  nextChild(i, dir, pos, side, mode = 0) {
    for (let parent = this; ; ) {
      for (let { children, positions } = parent._tree, e = dir > 0 ? children.length : -1; i != e; i += dir) {
        let next = children[i], start = positions[i] + parent.from, mounted;
        if (!(mode & IterMode.EnterBracketed && next instanceof Tree && (mounted = MountedTree.get(next)) && !mounted.overlay && mounted.bracketed && pos >= start && pos <= start + next.length) && !checkSide(side, pos, start, start + next.length))
          continue;
        if (next instanceof TreeBuffer) {
          if (mode & IterMode.ExcludeBuffers)
            continue;
          let index = next.findChild(0, next.buffer.length, dir, pos - start, side);
          if (index > -1)
            return new BufferNode(new BufferContext(parent, next, i, start), null, index);
        } else if (mode & IterMode.IncludeAnonymous || (!next.type.isAnonymous || hasChild(next))) {
          let mounted2;
          if (!(mode & IterMode.IgnoreMounts) && (mounted2 = MountedTree.get(next)) && !mounted2.overlay)
            return new _TreeNode(mounted2.tree, start, i, parent);
          let inner = new _TreeNode(next, start, i, parent);
          return mode & IterMode.IncludeAnonymous || !inner.type.isAnonymous ? inner : inner.nextChild(dir < 0 ? next.children.length - 1 : 0, dir, pos, side, mode);
        }
      }
      if (mode & IterMode.IncludeAnonymous || !parent.type.isAnonymous)
        return null;
      if (parent.index >= 0)
        i = parent.index + dir;
      else
        i = dir < 0 ? -1 : parent._parent._tree.children.length;
      parent = parent._parent;
      if (!parent)
        return null;
    }
  }
  get firstChild() {
    return this.nextChild(
      0,
      1,
      0,
      4
      /* Side.DontCare */
    );
  }
  get lastChild() {
    return this.nextChild(
      this._tree.children.length - 1,
      -1,
      0,
      4
      /* Side.DontCare */
    );
  }
  childAfter(pos) {
    return this.nextChild(
      0,
      1,
      pos,
      2
      /* Side.After */
    );
  }
  childBefore(pos) {
    return this.nextChild(
      this._tree.children.length - 1,
      -1,
      pos,
      -2
      /* Side.Before */
    );
  }
  prop(prop) {
    return this._tree.prop(prop);
  }
  enter(pos, side, mode = 0) {
    let mounted;
    if (!(mode & IterMode.IgnoreOverlays) && (mounted = MountedTree.get(this._tree)) && mounted.overlay) {
      let rPos = pos - this.from, enterBracketed = mode & IterMode.EnterBracketed && mounted.bracketed;
      for (let { from, to: to2 } of mounted.overlay) {
        if ((side > 0 || enterBracketed ? from <= rPos : from < rPos) && (side < 0 || enterBracketed ? to2 >= rPos : to2 > rPos))
          return new _TreeNode(mounted.tree, mounted.overlay[0].from + this.from, -1, this);
      }
    }
    return this.nextChild(0, 1, pos, side, mode);
  }
  nextSignificantParent() {
    let val = this;
    while (val.type.isAnonymous && val._parent)
      val = val._parent;
    return val;
  }
  get parent() {
    return this._parent ? this._parent.nextSignificantParent() : null;
  }
  get nextSibling() {
    return this._parent && this.index >= 0 ? this._parent.nextChild(
      this.index + 1,
      1,
      0,
      4
      /* Side.DontCare */
    ) : null;
  }
  get prevSibling() {
    return this._parent && this.index >= 0 ? this._parent.nextChild(
      this.index - 1,
      -1,
      0,
      4
      /* Side.DontCare */
    ) : null;
  }
  get tree() {
    return this._tree;
  }
  toTree() {
    return this._tree;
  }
  /**
  @internal
  */
  toString() {
    return this._tree.toString();
  }
};
function getChildren(node, type, before, after) {
  let cur = node.cursor(), result = [];
  if (!cur.firstChild())
    return result;
  if (before != null)
    for (let found = false; !found; ) {
      found = cur.type.is(before);
      if (!cur.nextSibling())
        return result;
    }
  for (; ; ) {
    if (after != null && cur.type.is(after))
      return result;
    if (cur.type.is(type))
      result.push(cur.node);
    if (!cur.nextSibling())
      return after == null ? result : [];
  }
}
function matchNodeContext(node, context, i = context.length - 1) {
  for (let p2 = node; i >= 0; p2 = p2.parent) {
    if (!p2)
      return false;
    if (!p2.type.isAnonymous) {
      if (context[i] && context[i] != p2.name)
        return false;
      i--;
    }
  }
  return true;
}
var BufferContext = class {
  constructor(parent, buffer, index, start) {
    this.parent = parent;
    this.buffer = buffer;
    this.index = index;
    this.start = start;
  }
};
var BufferNode = class _BufferNode extends BaseNode {
  get name() {
    return this.type.name;
  }
  get from() {
    return this.context.start + this.context.buffer.buffer[this.index + 1];
  }
  get to() {
    return this.context.start + this.context.buffer.buffer[this.index + 2];
  }
  constructor(context, _parent, index) {
    super();
    this.context = context;
    this._parent = _parent;
    this.index = index;
    this.type = context.buffer.set.types[context.buffer.buffer[index]];
  }
  child(dir, pos, side) {
    let { buffer } = this.context;
    let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.context.start, side);
    return index < 0 ? null : new _BufferNode(this.context, this, index);
  }
  get firstChild() {
    return this.child(
      1,
      0,
      4
      /* Side.DontCare */
    );
  }
  get lastChild() {
    return this.child(
      -1,
      0,
      4
      /* Side.DontCare */
    );
  }
  childAfter(pos) {
    return this.child(
      1,
      pos,
      2
      /* Side.After */
    );
  }
  childBefore(pos) {
    return this.child(
      -1,
      pos,
      -2
      /* Side.Before */
    );
  }
  prop(prop) {
    return this.type.prop(prop);
  }
  enter(pos, side, mode = 0) {
    if (mode & IterMode.ExcludeBuffers)
      return null;
    let { buffer } = this.context;
    let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], side > 0 ? 1 : -1, pos - this.context.start, side);
    return index < 0 ? null : new _BufferNode(this.context, this, index);
  }
  get parent() {
    return this._parent || this.context.parent.nextSignificantParent();
  }
  externalSibling(dir) {
    return this._parent ? null : this.context.parent.nextChild(
      this.context.index + dir,
      dir,
      0,
      4
      /* Side.DontCare */
    );
  }
  get nextSibling() {
    let { buffer } = this.context;
    let after = buffer.buffer[this.index + 3];
    if (after < (this._parent ? buffer.buffer[this._parent.index + 3] : buffer.buffer.length))
      return new _BufferNode(this.context, this._parent, after);
    return this.externalSibling(1);
  }
  get prevSibling() {
    let { buffer } = this.context;
    let parentStart = this._parent ? this._parent.index + 4 : 0;
    if (this.index == parentStart)
      return this.externalSibling(-1);
    return new _BufferNode(this.context, this._parent, buffer.findChild(
      parentStart,
      this.index,
      -1,
      0,
      4
      /* Side.DontCare */
    ));
  }
  get tree() {
    return null;
  }
  toTree() {
    let children = [], positions = [];
    let { buffer } = this.context;
    let startI = this.index + 4, endI = buffer.buffer[this.index + 3];
    if (endI > startI) {
      let from = buffer.buffer[this.index + 1];
      children.push(buffer.slice(startI, endI, from));
      positions.push(0);
    }
    return new Tree(this.type, children, positions, this.to - this.from);
  }
  /**
  @internal
  */
  toString() {
    return this.context.buffer.childString(this.index);
  }
};
function iterStack(heads) {
  if (!heads.length)
    return null;
  let pick = 0, picked = heads[0];
  for (let i = 1; i < heads.length; i++) {
    let node = heads[i];
    if (node.from > picked.from || node.to < picked.to) {
      picked = node;
      pick = i;
    }
  }
  let next = picked instanceof TreeNode && picked.index < 0 ? null : picked.parent;
  let newHeads = heads.slice();
  if (next)
    newHeads[pick] = next;
  else
    newHeads.splice(pick, 1);
  return new StackIterator(newHeads, picked);
}
var StackIterator = class {
  constructor(heads, node) {
    this.heads = heads;
    this.node = node;
  }
  get next() {
    return iterStack(this.heads);
  }
};
function stackIterator(tree, pos, side) {
  let inner = tree.resolveInner(pos, side), layers = null;
  for (let scan = inner instanceof TreeNode ? inner : inner.context.parent; scan; scan = scan.parent) {
    if (scan.index < 0) {
      let parent = scan.parent;
      (layers || (layers = [inner])).push(parent.resolve(pos, side));
      scan = parent;
    } else {
      let mount = MountedTree.get(scan.tree);
      if (mount && mount.overlay && mount.overlay[0].from <= pos && mount.overlay[mount.overlay.length - 1].to >= pos) {
        let root = new TreeNode(mount.tree, mount.overlay[0].from + scan.from, -1, scan);
        (layers || (layers = [inner])).push(resolveNode(root, pos, side, false));
      }
    }
  }
  return layers ? iterStack(layers) : inner;
}
var TreeCursor = class {
  /**
  Shorthand for `.type.name`.
  */
  get name() {
    return this.type.name;
  }
  /**
  @internal
  */
  constructor(node, mode = 0) {
    this.buffer = null;
    this.stack = [];
    this.index = 0;
    this.bufferNode = null;
    this.mode = mode & ~IterMode.EnterBracketed;
    if (node instanceof TreeNode) {
      this.yieldNode(node);
    } else {
      this._tree = node.context.parent;
      this.buffer = node.context;
      for (let n = node._parent; n; n = n._parent)
        this.stack.unshift(n.index);
      this.bufferNode = node;
      this.yieldBuf(node.index);
    }
  }
  yieldNode(node) {
    if (!node)
      return false;
    this._tree = node;
    this.type = node.type;
    this.from = node.from;
    this.to = node.to;
    return true;
  }
  yieldBuf(index, type) {
    this.index = index;
    let { start, buffer } = this.buffer;
    this.type = type || buffer.set.types[buffer.buffer[index]];
    this.from = start + buffer.buffer[index + 1];
    this.to = start + buffer.buffer[index + 2];
    return true;
  }
  /**
  @internal
  */
  yield(node) {
    if (!node)
      return false;
    if (node instanceof TreeNode) {
      this.buffer = null;
      return this.yieldNode(node);
    }
    this.buffer = node.context;
    return this.yieldBuf(node.index, node.type);
  }
  /**
  @internal
  */
  toString() {
    return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString();
  }
  /**
  @internal
  */
  enterChild(dir, pos, side) {
    if (!this.buffer)
      return this.yield(this._tree.nextChild(dir < 0 ? this._tree._tree.children.length - 1 : 0, dir, pos, side, this.mode));
    let { buffer } = this.buffer;
    let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.buffer.start, side);
    if (index < 0)
      return false;
    this.stack.push(this.index);
    return this.yieldBuf(index);
  }
  /**
  Move the cursor to this node's first child. When this returns
  false, the node has no child, and the cursor has not been moved.
  */
  firstChild() {
    return this.enterChild(
      1,
      0,
      4
      /* Side.DontCare */
    );
  }
  /**
  Move the cursor to this node's last child.
  */
  lastChild() {
    return this.enterChild(
      -1,
      0,
      4
      /* Side.DontCare */
    );
  }
  /**
  Move the cursor to the first child that ends after `pos`.
  */
  childAfter(pos) {
    return this.enterChild(
      1,
      pos,
      2
      /* Side.After */
    );
  }
  /**
  Move to the last child that starts before `pos`.
  */
  childBefore(pos) {
    return this.enterChild(
      -1,
      pos,
      -2
      /* Side.Before */
    );
  }
  /**
  Move the cursor to the child around `pos`. If side is -1 the
  child may end at that position, when 1 it may start there. This
  will also enter [overlaid](#common.MountedTree.overlay)
  [mounted](#common.NodeProp^mounted) trees unless `overlays` is
  set to false.
  */
  enter(pos, side, mode = this.mode) {
    if (!this.buffer)
      return this.yield(this._tree.enter(pos, side, mode));
    return mode & IterMode.ExcludeBuffers ? false : this.enterChild(1, pos, side);
  }
  /**
  Move to the node's parent node, if this isn't the top node.
  */
  parent() {
    if (!this.buffer)
      return this.yieldNode(this.mode & IterMode.IncludeAnonymous ? this._tree._parent : this._tree.parent);
    if (this.stack.length)
      return this.yieldBuf(this.stack.pop());
    let parent = this.mode & IterMode.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
    this.buffer = null;
    return this.yieldNode(parent);
  }
  /**
  @internal
  */
  sibling(dir) {
    if (!this.buffer)
      return !this._tree._parent ? false : this.yield(this._tree.index < 0 ? null : this._tree._parent.nextChild(this._tree.index + dir, dir, 0, 4, this.mode));
    let { buffer } = this.buffer, d = this.stack.length - 1;
    if (dir < 0) {
      let parentStart = d < 0 ? 0 : this.stack[d] + 4;
      if (this.index != parentStart)
        return this.yieldBuf(buffer.findChild(
          parentStart,
          this.index,
          -1,
          0,
          4
          /* Side.DontCare */
        ));
    } else {
      let after = buffer.buffer[this.index + 3];
      if (after < (d < 0 ? buffer.buffer.length : buffer.buffer[this.stack[d] + 3]))
        return this.yieldBuf(after);
    }
    return d < 0 ? this.yield(this.buffer.parent.nextChild(this.buffer.index + dir, dir, 0, 4, this.mode)) : false;
  }
  /**
  Move to this node's next sibling, if any.
  */
  nextSibling() {
    return this.sibling(1);
  }
  /**
  Move to this node's previous sibling, if any.
  */
  prevSibling() {
    return this.sibling(-1);
  }
  atLastNode(dir) {
    let index, parent, { buffer } = this;
    if (buffer) {
      if (dir > 0) {
        if (this.index < buffer.buffer.buffer.length)
          return false;
      } else {
        for (let i = 0; i < this.index; i++)
          if (buffer.buffer.buffer[i + 3] < this.index)
            return false;
      }
      ({ index, parent } = buffer);
    } else {
      ({ index, _parent: parent } = this._tree);
    }
    for (; parent; { index, _parent: parent } = parent) {
      if (index > -1)
        for (let i = index + dir, e = dir < 0 ? -1 : parent._tree.children.length; i != e; i += dir) {
          let child = parent._tree.children[i];
          if (this.mode & IterMode.IncludeAnonymous || child instanceof TreeBuffer || !child.type.isAnonymous || hasChild(child))
            return false;
        }
    }
    return true;
  }
  move(dir, enter) {
    if (enter && this.enterChild(
      dir,
      0,
      4
      /* Side.DontCare */
    ))
      return true;
    for (; ; ) {
      if (this.sibling(dir))
        return true;
      if (this.atLastNode(dir) || !this.parent())
        return false;
    }
  }
  /**
  Move to the next node in a
  [pre-order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order,_NLR)
  traversal, going from a node to its first child or, if the
  current node is empty or `enter` is false, its next sibling or
  the next sibling of the first parent node that has one.
  */
  next(enter = true) {
    return this.move(1, enter);
  }
  /**
  Move to the next node in a last-to-first pre-order traversal. A
  node is followed by its last child or, if it has none, its
  previous sibling or the previous sibling of the first parent
  node that has one.
  */
  prev(enter = true) {
    return this.move(-1, enter);
  }
  /**
  Move the cursor to the innermost node that covers `pos`. If
  `side` is -1, it will enter nodes that end at `pos`. If it is 1,
  it will enter nodes that start at `pos`.
  */
  moveTo(pos, side = 0) {
    while (this.from == this.to || (side < 1 ? this.from >= pos : this.from > pos) || (side > -1 ? this.to <= pos : this.to < pos))
      if (!this.parent())
        break;
    while (this.enterChild(1, pos, side)) {
    }
    return this;
  }
  /**
  Get a [syntax node](#common.SyntaxNode) at the cursor's current
  position.
  */
  get node() {
    if (!this.buffer)
      return this._tree;
    let cache = this.bufferNode, result = null, depth = 0;
    if (cache && cache.context == this.buffer) {
      scan: for (let index = this.index, d = this.stack.length; d >= 0; ) {
        for (let c = cache; c; c = c._parent)
          if (c.index == index) {
            if (index == this.index)
              return c;
            result = c;
            depth = d + 1;
            break scan;
          }
        index = this.stack[--d];
      }
    }
    for (let i = depth; i < this.stack.length; i++)
      result = new BufferNode(this.buffer, result, this.stack[i]);
    return this.bufferNode = new BufferNode(this.buffer, result, this.index);
  }
  /**
  Get the [tree](#common.Tree) that represents the current node, if
  any. Will return null when the node is in a [tree
  buffer](#common.TreeBuffer).
  */
  get tree() {
    return this.buffer ? null : this._tree._tree;
  }
  /**
  Iterate over the current node and all its descendants, calling
  `enter` when entering a node and `leave`, if given, when leaving
  one. When `enter` returns `false`, any children of that node are
  skipped, and `leave` isn't called for it.
  */
  iterate(enter, leave) {
    for (let depth = 0; ; ) {
      let mustLeave = false;
      if (this.type.isAnonymous || enter(this) !== false) {
        if (this.firstChild()) {
          depth++;
          continue;
        }
        if (!this.type.isAnonymous)
          mustLeave = true;
      }
      for (; ; ) {
        if (mustLeave && leave)
          leave(this);
        mustLeave = this.type.isAnonymous;
        if (!depth)
          return;
        if (this.nextSibling())
          break;
        this.parent();
        depth--;
        mustLeave = true;
      }
    }
  }
  /**
  Test whether the current node matches a given context—a sequence
  of direct parent node names. Empty strings in the context array
  are treated as wildcards.
  */
  matchContext(context) {
    if (!this.buffer)
      return matchNodeContext(this.node.parent, context);
    let { buffer } = this.buffer, { types } = buffer.set;
    for (let i = context.length - 1, d = this.stack.length - 1; i >= 0; d--) {
      if (d < 0)
        return matchNodeContext(this._tree, context, i);
      let type = types[buffer.buffer[this.stack[d]]];
      if (!type.isAnonymous) {
        if (context[i] && context[i] != type.name)
          return false;
        i--;
      }
    }
    return true;
  }
};
function hasChild(tree) {
  return tree.children.some((ch) => ch instanceof TreeBuffer || !ch.type.isAnonymous || hasChild(ch));
}
function buildTree(data) {
  var _a2;
  let { buffer, nodeSet, maxBufferLength = DefaultBufferLength, reused = [], minRepeatType = nodeSet.types.length } = data;
  let cursor = Array.isArray(buffer) ? new FlatBufferCursor(buffer, buffer.length) : buffer;
  let types = nodeSet.types;
  let contextHash = 0, lookAhead = 0;
  function takeNode(parentStart, minPos, children2, positions2, inRepeat, depth) {
    let { id, start, end, size } = cursor;
    let lookAheadAtStart = lookAhead, contextAtStart = contextHash;
    if (size < 0) {
      cursor.next();
      if (size == -1) {
        let node2 = reused[id];
        children2.push(node2);
        positions2.push(start - parentStart);
        return;
      } else if (size == -3) {
        contextHash = id;
        return;
      } else if (size == -4) {
        lookAhead = id;
        return;
      } else {
        throw new RangeError(`Unrecognized record size: ${size}`);
      }
    }
    let type = types[id], node, buffer2;
    let startPos = start - parentStart;
    if (end - start <= maxBufferLength && (buffer2 = findBufferSize(cursor.pos - minPos, inRepeat))) {
      let data2 = new Uint16Array(buffer2.size - buffer2.skip);
      let endPos = cursor.pos - buffer2.size, index = data2.length;
      while (cursor.pos > endPos)
        index = copyToBuffer(buffer2.start, data2, index);
      node = new TreeBuffer(data2, end - buffer2.start, nodeSet);
      startPos = buffer2.start - parentStart;
    } else {
      let endPos = cursor.pos - size;
      cursor.next();
      let localChildren = [], localPositions = [];
      let localInRepeat = id >= minRepeatType ? id : -1;
      let lastGroup = 0, lastEnd = end;
      while (cursor.pos > endPos) {
        if (localInRepeat >= 0 && cursor.id == localInRepeat && cursor.size >= 0) {
          if (cursor.end <= lastEnd - maxBufferLength) {
            makeRepeatLeaf(localChildren, localPositions, start, lastGroup, cursor.end, lastEnd, localInRepeat, lookAheadAtStart, contextAtStart);
            lastGroup = localChildren.length;
            lastEnd = cursor.end;
          }
          cursor.next();
        } else if (depth > 2500) {
          takeFlatNode(start, endPos, localChildren, localPositions);
        } else {
          takeNode(start, endPos, localChildren, localPositions, localInRepeat, depth + 1);
        }
      }
      if (localInRepeat >= 0 && lastGroup > 0 && lastGroup < localChildren.length)
        makeRepeatLeaf(localChildren, localPositions, start, lastGroup, start, lastEnd, localInRepeat, lookAheadAtStart, contextAtStart);
      localChildren.reverse();
      localPositions.reverse();
      if (localInRepeat > -1 && lastGroup > 0) {
        let make = makeBalanced(type, contextAtStart);
        node = balanceRange(type, localChildren, localPositions, 0, localChildren.length, 0, end - start, make, make);
      } else {
        node = makeTree(type, localChildren, localPositions, end - start, lookAheadAtStart - end, contextAtStart);
      }
    }
    children2.push(node);
    positions2.push(startPos);
  }
  function takeFlatNode(parentStart, minPos, children2, positions2) {
    let nodes = [];
    let nodeCount = 0, stopAt = -1;
    while (cursor.pos > minPos) {
      let { id, start, end, size } = cursor;
      if (size > 4) {
        cursor.next();
      } else if (stopAt > -1 && start < stopAt) {
        break;
      } else {
        if (stopAt < 0)
          stopAt = end - maxBufferLength;
        nodes.push(id, start, end);
        nodeCount++;
        cursor.next();
      }
    }
    if (nodeCount) {
      let buffer2 = new Uint16Array(nodeCount * 4);
      let start = nodes[nodes.length - 2];
      for (let i = nodes.length - 3, j = 0; i >= 0; i -= 3) {
        buffer2[j++] = nodes[i];
        buffer2[j++] = nodes[i + 1] - start;
        buffer2[j++] = nodes[i + 2] - start;
        buffer2[j++] = j;
      }
      children2.push(new TreeBuffer(buffer2, nodes[2] - start, nodeSet));
      positions2.push(start - parentStart);
    }
  }
  function makeBalanced(type, contextHash2) {
    return (children2, positions2, length2) => {
      let lookAhead2 = 0, lastI = children2.length - 1, last, lookAheadProp;
      if (lastI >= 0 && (last = children2[lastI]) instanceof Tree) {
        if (!lastI && last.type == type && last.length == length2)
          return last;
        if (lookAheadProp = last.prop(NodeProp.lookAhead))
          lookAhead2 = positions2[lastI] + last.length + lookAheadProp;
      }
      return makeTree(type, children2, positions2, length2, lookAhead2, contextHash2);
    };
  }
  function makeRepeatLeaf(children2, positions2, base, i, from, to2, type, lookAhead2, contextHash2) {
    let localChildren = [], localPositions = [];
    while (children2.length > i) {
      localChildren.push(children2.pop());
      localPositions.push(positions2.pop() + base - from);
    }
    children2.push(makeTree(nodeSet.types[type], localChildren, localPositions, to2 - from, lookAhead2 - to2, contextHash2));
    positions2.push(from - base);
  }
  function makeTree(type, children2, positions2, length2, lookAhead2, contextHash2, props) {
    if (contextHash2) {
      let pair = [NodeProp.contextHash, contextHash2];
      props = props ? [pair].concat(props) : [pair];
    }
    if (lookAhead2 > 25) {
      let pair = [NodeProp.lookAhead, lookAhead2];
      props = props ? [pair].concat(props) : [pair];
    }
    return new Tree(type, children2, positions2, length2, props);
  }
  function findBufferSize(maxSize, inRepeat) {
    let fork = cursor.fork();
    let size = 0, start = 0, skip = 0, minStart = fork.end - maxBufferLength;
    let result = { size: 0, start: 0, skip: 0 };
    scan: for (let minPos = fork.pos - maxSize; fork.pos > minPos; ) {
      let nodeSize2 = fork.size;
      if (fork.id == inRepeat && nodeSize2 >= 0) {
        result.size = size;
        result.start = start;
        result.skip = skip;
        skip += 4;
        size += 4;
        fork.next();
        continue;
      }
      let startPos = fork.pos - nodeSize2;
      if (nodeSize2 < 0 || startPos < minPos || fork.start < minStart)
        break;
      let localSkipped = fork.id >= minRepeatType ? 4 : 0;
      let nodeStart = fork.start;
      fork.next();
      while (fork.pos > startPos) {
        if (fork.size < 0) {
          if (fork.size == -3 || fork.size == -4)
            localSkipped += 4;
          else
            break scan;
        } else if (fork.id >= minRepeatType) {
          localSkipped += 4;
        }
        fork.next();
      }
      start = nodeStart;
      size += nodeSize2;
      skip += localSkipped;
    }
    if (inRepeat < 0 || size == maxSize) {
      result.size = size;
      result.start = start;
      result.skip = skip;
    }
    return result.size > 4 ? result : void 0;
  }
  function copyToBuffer(bufferStart, buffer2, index) {
    let { id, start, end, size } = cursor;
    cursor.next();
    if (size >= 0 && id < minRepeatType) {
      let startIndex = index;
      if (size > 4) {
        let endPos = cursor.pos - (size - 4);
        while (cursor.pos > endPos)
          index = copyToBuffer(bufferStart, buffer2, index);
      }
      buffer2[--index] = startIndex;
      buffer2[--index] = end - bufferStart;
      buffer2[--index] = start - bufferStart;
      buffer2[--index] = id;
    } else if (size == -3) {
      contextHash = id;
    } else if (size == -4) {
      lookAhead = id;
    }
    return index;
  }
  let children = [], positions = [];
  while (cursor.pos > 0)
    takeNode(data.start || 0, data.bufferStart || 0, children, positions, -1, 0);
  let length = (_a2 = data.length) !== null && _a2 !== void 0 ? _a2 : children.length ? positions[0] + children[0].length : 0;
  return new Tree(types[data.topID], children.reverse(), positions.reverse(), length);
}
var nodeSizeCache = /* @__PURE__ */ new WeakMap();
function nodeSize(balanceType, node) {
  if (!balanceType.isAnonymous || node instanceof TreeBuffer || node.type != balanceType)
    return 1;
  let size = nodeSizeCache.get(node);
  if (size == null) {
    size = 1;
    for (let child of node.children) {
      if (child.type != balanceType || !(child instanceof Tree)) {
        size = 1;
        break;
      }
      size += nodeSize(balanceType, child);
    }
    nodeSizeCache.set(node, size);
  }
  return size;
}
function balanceRange(balanceType, children, positions, from, to2, start, length, mkTop, mkTree) {
  let total = 0;
  for (let i = from; i < to2; i++)
    total += nodeSize(balanceType, children[i]);
  let maxChild = Math.ceil(
    total * 1.5 / 8
    /* Balance.BranchFactor */
  );
  let localChildren = [], localPositions = [];
  function divide(children2, positions2, from2, to3, offset) {
    for (let i = from2; i < to3; ) {
      let groupFrom = i, groupStart = positions2[i], groupSize = nodeSize(balanceType, children2[i]);
      i++;
      for (; i < to3; i++) {
        let nextSize = nodeSize(balanceType, children2[i]);
        if (groupSize + nextSize >= maxChild)
          break;
        groupSize += nextSize;
      }
      if (i == groupFrom + 1) {
        if (groupSize > maxChild) {
          let only = children2[groupFrom];
          divide(only.children, only.positions, 0, only.children.length, positions2[groupFrom] + offset);
          continue;
        }
        localChildren.push(children2[groupFrom]);
      } else {
        let length2 = positions2[i - 1] + children2[i - 1].length - groupStart;
        localChildren.push(balanceRange(balanceType, children2, positions2, groupFrom, i, groupStart, length2, null, mkTree));
      }
      localPositions.push(groupStart + offset - start);
    }
  }
  divide(children, positions, from, to2, 0);
  return (mkTop || mkTree)(localChildren, localPositions, length);
}
var TreeFragment = class _TreeFragment {
  /**
  Construct a tree fragment. You'll usually want to use
  [`addTree`](#common.TreeFragment^addTree) and
  [`applyChanges`](#common.TreeFragment^applyChanges) instead of
  calling this directly.
  */
  constructor(from, to2, tree, offset, openStart = false, openEnd = false) {
    this.from = from;
    this.to = to2;
    this.tree = tree;
    this.offset = offset;
    this.open = (openStart ? 1 : 0) | (openEnd ? 2 : 0);
  }
  /**
  Whether the start of the fragment represents the start of a
  parse, or the end of a change. (In the second case, it may not
  be safe to reuse some nodes at the start, depending on the
  parsing algorithm.)
  */
  get openStart() {
    return (this.open & 1) > 0;
  }
  /**
  Whether the end of the fragment represents the end of a
  full-document parse, or the start of a change.
  */
  get openEnd() {
    return (this.open & 2) > 0;
  }
  /**
  Create a set of fragments from a freshly parsed tree, or update
  an existing set of fragments by replacing the ones that overlap
  with a tree with content from the new tree. When `partial` is
  true, the parse is treated as incomplete, and the resulting
  fragment has [`openEnd`](#common.TreeFragment.openEnd) set to
  true.
  */
  static addTree(tree, fragments = [], partial = false) {
    let result = [new _TreeFragment(0, tree.length, tree, 0, false, partial)];
    for (let f of fragments)
      if (f.to > tree.length)
        result.push(f);
    return result;
  }
  /**
  Apply a set of edits to an array of fragments, removing or
  splitting fragments as necessary to remove edited ranges, and
  adjusting offsets for fragments that moved.
  */
  static applyChanges(fragments, changes, minGap = 128) {
    if (!changes.length)
      return fragments;
    let result = [];
    let fI = 1, nextF = fragments.length ? fragments[0] : null;
    for (let cI = 0, pos = 0, off = 0; ; cI++) {
      let nextC = cI < changes.length ? changes[cI] : null;
      let nextPos = nextC ? nextC.fromA : 1e9;
      if (nextPos - pos >= minGap)
        while (nextF && nextF.from < nextPos) {
          let cut = nextF;
          if (pos >= cut.from || nextPos <= cut.to || off) {
            let fFrom = Math.max(cut.from, pos) - off, fTo = Math.min(cut.to, nextPos) - off;
            cut = fFrom >= fTo ? null : new _TreeFragment(fFrom, fTo, cut.tree, cut.offset + off, cI > 0, !!nextC);
          }
          if (cut)
            result.push(cut);
          if (nextF.to > nextPos)
            break;
          nextF = fI < fragments.length ? fragments[fI++] : null;
        }
      if (!nextC)
        break;
      pos = nextC.toA;
      off = nextC.toA - nextC.toB;
    }
    return result;
  }
};
var Parser2 = class {
  /**
  Start a parse, returning a [partial parse](#common.PartialParse)
  object. [`fragments`](#common.TreeFragment) can be passed in to
  make the parse incremental.
  
  By default, the entire input is parsed. You can pass `ranges`,
  which should be a sorted array of non-empty, non-overlapping
  ranges, to parse only those ranges. The tree returned in that
  case will start at `ranges[0].from`.
  */
  startParse(input, fragments, ranges) {
    if (typeof input == "string")
      input = new StringInput(input);
    ranges = !ranges ? [new Range(0, input.length)] : ranges.length ? ranges.map((r) => new Range(r.from, r.to)) : [new Range(0, 0)];
    return this.createParse(input, fragments || [], ranges);
  }
  /**
  Run a full parse, returning the resulting tree.
  */
  parse(input, fragments, ranges) {
    let parse2 = this.startParse(input, fragments, ranges);
    for (; ; ) {
      let done = parse2.advance();
      if (done)
        return done;
    }
  }
};
var StringInput = class {
  constructor(string4) {
    this.string = string4;
  }
  get length() {
    return this.string.length;
  }
  chunk(from) {
    return this.string.slice(from);
  }
  get lineChunks() {
    return false;
  }
  read(from, to2) {
    return this.string.slice(from, to2);
  }
};
var stoppedInner = new NodeProp({ perNode: true });

// node_modules/@lezer/highlight/dist/index.js
var nextTagID = 0;
var Tag = class _Tag {
  /**
  @internal
  */
  constructor(name2, set2, base, modified) {
    this.name = name2;
    this.set = set2;
    this.base = base;
    this.modified = modified;
    this.id = nextTagID++;
  }
  toString() {
    let { name: name2 } = this;
    for (let mod of this.modified)
      if (mod.name)
        name2 = `${mod.name}(${name2})`;
    return name2;
  }
  static define(nameOrParent, parent) {
    let name2 = typeof nameOrParent == "string" ? nameOrParent : "?";
    if (nameOrParent instanceof _Tag)
      parent = nameOrParent;
    if (parent === null || parent === void 0 ? void 0 : parent.base)
      throw new Error("Can not derive from a modified tag");
    let tag = new _Tag(name2, [], null, []);
    tag.set.push(tag);
    if (parent)
      for (let t33 of parent.set)
        tag.set.push(t33);
    return tag;
  }
  /**
  Define a tag _modifier_, which is a function that, given a tag,
  will return a tag that is a subtag of the original. Applying the
  same modifier to a twice tag will return the same value (`m1(t1)
  == m1(t1)`) and applying multiple modifiers will, regardless or
  order, produce the same tag (`m1(m2(t1)) == m2(m1(t1))`).
  
  When multiple modifiers are applied to a given base tag, each
  smaller set of modifiers is registered as a parent, so that for
  example `m1(m2(m3(t1)))` is a subtype of `m1(m2(t1))`,
  `m1(m3(t1)`, and so on.
  */
  static defineModifier(name2) {
    let mod = new Modifier(name2);
    return (tag) => {
      if (tag.modified.indexOf(mod) > -1)
        return tag;
      return Modifier.get(tag.base || tag, tag.modified.concat(mod).sort((a, b) => a.id - b.id));
    };
  }
};
var nextModifierID = 0;
var Modifier = class _Modifier {
  constructor(name2) {
    this.name = name2;
    this.instances = [];
    this.id = nextModifierID++;
  }
  static get(base, mods) {
    if (!mods.length)
      return base;
    let exists = mods[0].instances.find((t33) => t33.base == base && sameArray(mods, t33.modified));
    if (exists)
      return exists;
    let set2 = [], tag = new Tag(base.name, set2, base, mods);
    for (let m3 of mods)
      m3.instances.push(tag);
    let configs = powerSet(mods);
    for (let parent of base.set)
      if (!parent.modified.length)
        for (let config of configs)
          set2.push(_Modifier.get(parent, config));
    return tag;
  }
};
function sameArray(a, b) {
  return a.length == b.length && a.every((x, i) => x == b[i]);
}
function powerSet(array) {
  let sets = [[]];
  for (let i = 0; i < array.length; i++) {
    for (let j = 0, e = sets.length; j < e; j++) {
      sets.push(sets[j].concat(array[i]));
    }
  }
  return sets.sort((a, b) => b.length - a.length);
}
function styleTags(spec) {
  let byName = /* @__PURE__ */ Object.create(null);
  for (let prop in spec) {
    let tags2 = spec[prop];
    if (!Array.isArray(tags2))
      tags2 = [tags2];
    for (let part of prop.split(" "))
      if (part) {
        let pieces = [], mode = 2, rest = part;
        for (let pos = 0; ; ) {
          if (rest == "..." && pos > 0 && pos + 3 == part.length) {
            mode = 1;
            break;
          }
          let m3 = /^"(?:[^"\\]|\\.)*?"|[^\/!]+/.exec(rest);
          if (!m3)
            throw new RangeError("Invalid path: " + part);
          pieces.push(m3[0] == "*" ? "" : m3[0][0] == '"' ? JSON.parse(m3[0]) : m3[0]);
          pos += m3[0].length;
          if (pos == part.length)
            break;
          let next = part[pos++];
          if (pos == part.length && next == "!") {
            mode = 0;
            break;
          }
          if (next != "/")
            throw new RangeError("Invalid path: " + part);
          rest = part.slice(pos);
        }
        let last = pieces.length - 1, inner = pieces[last];
        if (!inner)
          throw new RangeError("Invalid path: " + part);
        let rule = new Rule(tags2, mode, last > 0 ? pieces.slice(0, last) : null);
        byName[inner] = rule.sort(byName[inner]);
      }
  }
  return ruleNodeProp.add(byName);
}
var ruleNodeProp = new NodeProp({
  combine(a, b) {
    let cur, root, take;
    while (a || b) {
      if (!a || b && a.depth <= b.depth) {
        take = b;
        b = b.next;
      } else {
        take = a;
        a = a.next;
      }
      if (cur && cur.mode == take.mode && !take.context && !cur.context)
        continue;
      let copy = new Rule(take.tags, take.mode, take.context);
      if (cur)
        cur.next = copy;
      else
        root = copy;
      cur = copy;
    }
    return root;
  }
});
var Rule = class {
  constructor(tags2, mode, context, next) {
    this.tags = tags2;
    this.mode = mode;
    this.context = context;
    this.next = next;
  }
  get opaque() {
    return this.mode == 0;
  }
  get inherit() {
    return this.mode == 1;
  }
  sort(other) {
    if (!other || other.depth < this.depth) {
      this.next = other;
      return this;
    }
    other.next = this.sort(other.next);
    return other;
  }
  get depth() {
    return this.context ? this.context.length : 0;
  }
};
Rule.empty = new Rule([], 2, null);
function tagHighlighter(tags2, options) {
  let map2 = /* @__PURE__ */ Object.create(null);
  for (let style of tags2) {
    if (!Array.isArray(style.tag))
      map2[style.tag.id] = style.class;
    else
      for (let tag of style.tag)
        map2[tag.id] = style.class;
  }
  let { scope, all = null } = options || {};
  return {
    style: (tags3) => {
      let cls = all;
      for (let tag of tags3) {
        for (let sub of tag.set) {
          let tagClass = map2[sub.id];
          if (tagClass) {
            cls = cls ? cls + " " + tagClass : tagClass;
            break;
          }
        }
      }
      return cls;
    },
    scope
  };
}
var t = Tag.define;
var comment = t();
var name = t();
var typeName = t(name);
var propertyName = t(name);
var literal = t();
var string3 = t(literal);
var number = t(literal);
var content = t();
var heading = t(content);
var keyword = t();
var operator = t();
var punctuation = t();
var bracket = t(punctuation);
var meta = t();
var tags = {
  /**
  A comment.
  */
  comment,
  /**
  A line [comment](#highlight.tags.comment).
  */
  lineComment: t(comment),
  /**
  A block [comment](#highlight.tags.comment).
  */
  blockComment: t(comment),
  /**
  A documentation [comment](#highlight.tags.comment).
  */
  docComment: t(comment),
  /**
  Any kind of identifier.
  */
  name,
  /**
  The [name](#highlight.tags.name) of a variable.
  */
  variableName: t(name),
  /**
  A type [name](#highlight.tags.name).
  */
  typeName,
  /**
  A tag name (subtag of [`typeName`](#highlight.tags.typeName)).
  */
  tagName: t(typeName),
  /**
  A property or field [name](#highlight.tags.name).
  */
  propertyName,
  /**
  An attribute name (subtag of [`propertyName`](#highlight.tags.propertyName)).
  */
  attributeName: t(propertyName),
  /**
  The [name](#highlight.tags.name) of a class.
  */
  className: t(name),
  /**
  A label [name](#highlight.tags.name).
  */
  labelName: t(name),
  /**
  A namespace [name](#highlight.tags.name).
  */
  namespace: t(name),
  /**
  The [name](#highlight.tags.name) of a macro.
  */
  macroName: t(name),
  /**
  A literal value.
  */
  literal,
  /**
  A string [literal](#highlight.tags.literal).
  */
  string: string3,
  /**
  A documentation [string](#highlight.tags.string).
  */
  docString: t(string3),
  /**
  A character literal (subtag of [string](#highlight.tags.string)).
  */
  character: t(string3),
  /**
  An attribute value (subtag of [string](#highlight.tags.string)).
  */
  attributeValue: t(string3),
  /**
  A number [literal](#highlight.tags.literal).
  */
  number,
  /**
  An integer [number](#highlight.tags.number) literal.
  */
  integer: t(number),
  /**
  A floating-point [number](#highlight.tags.number) literal.
  */
  float: t(number),
  /**
  A boolean [literal](#highlight.tags.literal).
  */
  bool: t(literal),
  /**
  Regular expression [literal](#highlight.tags.literal).
  */
  regexp: t(literal),
  /**
  An escape [literal](#highlight.tags.literal), for example a
  backslash escape in a string.
  */
  escape: t(literal),
  /**
  A color [literal](#highlight.tags.literal).
  */
  color: t(literal),
  /**
  A URL [literal](#highlight.tags.literal).
  */
  url: t(literal),
  /**
  A language keyword.
  */
  keyword,
  /**
  The [keyword](#highlight.tags.keyword) for the self or this
  object.
  */
  self: t(keyword),
  /**
  The [keyword](#highlight.tags.keyword) for null.
  */
  null: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) denoting some atomic value.
  */
  atom: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) that represents a unit.
  */
  unit: t(keyword),
  /**
  A modifier [keyword](#highlight.tags.keyword).
  */
  modifier: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) that acts as an operator.
  */
  operatorKeyword: t(keyword),
  /**
  A control-flow related [keyword](#highlight.tags.keyword).
  */
  controlKeyword: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) that defines something.
  */
  definitionKeyword: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) related to defining or
  interfacing with modules.
  */
  moduleKeyword: t(keyword),
  /**
  An operator.
  */
  operator,
  /**
  An [operator](#highlight.tags.operator) that dereferences something.
  */
  derefOperator: t(operator),
  /**
  Arithmetic-related [operator](#highlight.tags.operator).
  */
  arithmeticOperator: t(operator),
  /**
  Logical [operator](#highlight.tags.operator).
  */
  logicOperator: t(operator),
  /**
  Bit [operator](#highlight.tags.operator).
  */
  bitwiseOperator: t(operator),
  /**
  Comparison [operator](#highlight.tags.operator).
  */
  compareOperator: t(operator),
  /**
  [Operator](#highlight.tags.operator) that updates its operand.
  */
  updateOperator: t(operator),
  /**
  [Operator](#highlight.tags.operator) that defines something.
  */
  definitionOperator: t(operator),
  /**
  Type-related [operator](#highlight.tags.operator).
  */
  typeOperator: t(operator),
  /**
  Control-flow [operator](#highlight.tags.operator).
  */
  controlOperator: t(operator),
  /**
  Program or markup punctuation.
  */
  punctuation,
  /**
  [Punctuation](#highlight.tags.punctuation) that separates
  things.
  */
  separator: t(punctuation),
  /**
  Bracket-style [punctuation](#highlight.tags.punctuation).
  */
  bracket,
  /**
  Angle [brackets](#highlight.tags.bracket) (usually `<` and `>`
  tokens).
  */
  angleBracket: t(bracket),
  /**
  Square [brackets](#highlight.tags.bracket) (usually `[` and `]`
  tokens).
  */
  squareBracket: t(bracket),
  /**
  Parentheses (usually `(` and `)` tokens). Subtag of
  [bracket](#highlight.tags.bracket).
  */
  paren: t(bracket),
  /**
  Braces (usually `{` and `}` tokens). Subtag of
  [bracket](#highlight.tags.bracket).
  */
  brace: t(bracket),
  /**
  Content, for example plain text in XML or markup documents.
  */
  content,
  /**
  [Content](#highlight.tags.content) that represents a heading.
  */
  heading,
  /**
  A level 1 [heading](#highlight.tags.heading).
  */
  heading1: t(heading),
  /**
  A level 2 [heading](#highlight.tags.heading).
  */
  heading2: t(heading),
  /**
  A level 3 [heading](#highlight.tags.heading).
  */
  heading3: t(heading),
  /**
  A level 4 [heading](#highlight.tags.heading).
  */
  heading4: t(heading),
  /**
  A level 5 [heading](#highlight.tags.heading).
  */
  heading5: t(heading),
  /**
  A level 6 [heading](#highlight.tags.heading).
  */
  heading6: t(heading),
  /**
  A prose [content](#highlight.tags.content) separator (such as a horizontal rule).
  */
  contentSeparator: t(content),
  /**
  [Content](#highlight.tags.content) that represents a list.
  */
  list: t(content),
  /**
  [Content](#highlight.tags.content) that represents a quote.
  */
  quote: t(content),
  /**
  [Content](#highlight.tags.content) that is emphasized.
  */
  emphasis: t(content),
  /**
  [Content](#highlight.tags.content) that is styled strong.
  */
  strong: t(content),
  /**
  [Content](#highlight.tags.content) that is part of a link.
  */
  link: t(content),
  /**
  [Content](#highlight.tags.content) that is styled as code or
  monospace.
  */
  monospace: t(content),
  /**
  [Content](#highlight.tags.content) that has a strike-through
  style.
  */
  strikethrough: t(content),
  /**
  Inserted text in a change-tracking format.
  */
  inserted: t(),
  /**
  Deleted text.
  */
  deleted: t(),
  /**
  Changed text.
  */
  changed: t(),
  /**
  An invalid or unsyntactic element.
  */
  invalid: t(),
  /**
  Metadata or meta-instruction.
  */
  meta,
  /**
  [Metadata](#highlight.tags.meta) that applies to the entire
  document.
  */
  documentMeta: t(meta),
  /**
  [Metadata](#highlight.tags.meta) that annotates or adds
  attributes to a given syntactic element.
  */
  annotation: t(meta),
  /**
  Processing instruction or preprocessor directive. Subtag of
  [meta](#highlight.tags.meta).
  */
  processingInstruction: t(meta),
  /**
  [Modifier](#highlight.Tag^defineModifier) that indicates that a
  given element is being defined. Expected to be used with the
  various [name](#highlight.tags.name) tags.
  */
  definition: Tag.defineModifier("definition"),
  /**
  [Modifier](#highlight.Tag^defineModifier) that indicates that
  something is constant. Mostly expected to be used with
  [variable names](#highlight.tags.variableName).
  */
  constant: Tag.defineModifier("constant"),
  /**
  [Modifier](#highlight.Tag^defineModifier) used to indicate that
  a [variable](#highlight.tags.variableName) or [property
  name](#highlight.tags.propertyName) is being called or defined
  as a function.
  */
  function: Tag.defineModifier("function"),
  /**
  [Modifier](#highlight.Tag^defineModifier) that can be applied to
  [names](#highlight.tags.name) to indicate that they belong to
  the language's standard environment.
  */
  standard: Tag.defineModifier("standard"),
  /**
  [Modifier](#highlight.Tag^defineModifier) that indicates a given
  [names](#highlight.tags.name) is local to some scope.
  */
  local: Tag.defineModifier("local"),
  /**
  A generic variant [modifier](#highlight.Tag^defineModifier) that
  can be used to tag language-specific alternative variants of
  some common tag. It is recommended for themes to define special
  forms of at least the [string](#highlight.tags.string) and
  [variable name](#highlight.tags.variableName) tags, since those
  come up a lot.
  */
  special: Tag.defineModifier("special")
};
for (let name2 in tags) {
  let val = tags[name2];
  if (val instanceof Tag)
    val.name = name2;
}
var classHighlighter = tagHighlighter([
  { tag: tags.link, class: "tok-link" },
  { tag: tags.heading, class: "tok-heading" },
  { tag: tags.emphasis, class: "tok-emphasis" },
  { tag: tags.strong, class: "tok-strong" },
  { tag: tags.keyword, class: "tok-keyword" },
  { tag: tags.atom, class: "tok-atom" },
  { tag: tags.bool, class: "tok-bool" },
  { tag: tags.url, class: "tok-url" },
  { tag: tags.labelName, class: "tok-labelName" },
  { tag: tags.inserted, class: "tok-inserted" },
  { tag: tags.deleted, class: "tok-deleted" },
  { tag: tags.literal, class: "tok-literal" },
  { tag: tags.string, class: "tok-string" },
  { tag: tags.number, class: "tok-number" },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], class: "tok-string2" },
  { tag: tags.variableName, class: "tok-variableName" },
  { tag: tags.local(tags.variableName), class: "tok-variableName tok-local" },
  { tag: tags.definition(tags.variableName), class: "tok-variableName tok-definition" },
  { tag: tags.special(tags.variableName), class: "tok-variableName2" },
  { tag: tags.definition(tags.propertyName), class: "tok-propertyName tok-definition" },
  { tag: tags.typeName, class: "tok-typeName" },
  { tag: tags.namespace, class: "tok-namespace" },
  { tag: tags.className, class: "tok-className" },
  { tag: tags.macroName, class: "tok-macroName" },
  { tag: tags.propertyName, class: "tok-propertyName" },
  { tag: tags.operator, class: "tok-operator" },
  { tag: tags.comment, class: "tok-comment" },
  { tag: tags.meta, class: "tok-meta" },
  { tag: tags.invalid, class: "tok-invalid" },
  { tag: tags.punctuation, class: "tok-punctuation" }
]);

// node_modules/@lezer/markdown/dist/index.js
var CompositeBlock = class _CompositeBlock {
  static create(type, value, from, parentHash, end) {
    let hash = parentHash + (parentHash << 8) + type + (value << 4) | 0;
    return new _CompositeBlock(type, value, from, hash, end, [], []);
  }
  constructor(type, value, from, hash, end, children, positions) {
    this.type = type;
    this.value = value;
    this.from = from;
    this.hash = hash;
    this.end = end;
    this.children = children;
    this.positions = positions;
    this.hashProp = [[NodeProp.contextHash, hash]];
  }
  addChild(child, pos) {
    if (child.prop(NodeProp.contextHash) != this.hash)
      child = new Tree(child.type, child.children, child.positions, child.length, this.hashProp);
    this.children.push(child);
    this.positions.push(pos);
  }
  toTree(nodeSet, end = this.end) {
    let last = this.children.length - 1;
    if (last >= 0)
      end = Math.max(end, this.positions[last] + this.children[last].length + this.from);
    return new Tree(nodeSet.types[this.type], this.children, this.positions, end - this.from).balance({
      makeTree: (children, positions, length) => new Tree(NodeType.none, children, positions, length, this.hashProp)
    });
  }
};
var Type;
(function(Type2) {
  Type2[Type2["Document"] = 1] = "Document";
  Type2[Type2["CodeBlock"] = 2] = "CodeBlock";
  Type2[Type2["FencedCode"] = 3] = "FencedCode";
  Type2[Type2["Blockquote"] = 4] = "Blockquote";
  Type2[Type2["HorizontalRule"] = 5] = "HorizontalRule";
  Type2[Type2["BulletList"] = 6] = "BulletList";
  Type2[Type2["OrderedList"] = 7] = "OrderedList";
  Type2[Type2["ListItem"] = 8] = "ListItem";
  Type2[Type2["ATXHeading1"] = 9] = "ATXHeading1";
  Type2[Type2["ATXHeading2"] = 10] = "ATXHeading2";
  Type2[Type2["ATXHeading3"] = 11] = "ATXHeading3";
  Type2[Type2["ATXHeading4"] = 12] = "ATXHeading4";
  Type2[Type2["ATXHeading5"] = 13] = "ATXHeading5";
  Type2[Type2["ATXHeading6"] = 14] = "ATXHeading6";
  Type2[Type2["SetextHeading1"] = 15] = "SetextHeading1";
  Type2[Type2["SetextHeading2"] = 16] = "SetextHeading2";
  Type2[Type2["HTMLBlock"] = 17] = "HTMLBlock";
  Type2[Type2["LinkReference"] = 18] = "LinkReference";
  Type2[Type2["Paragraph"] = 19] = "Paragraph";
  Type2[Type2["CommentBlock"] = 20] = "CommentBlock";
  Type2[Type2["ProcessingInstructionBlock"] = 21] = "ProcessingInstructionBlock";
  Type2[Type2["Escape"] = 22] = "Escape";
  Type2[Type2["Entity"] = 23] = "Entity";
  Type2[Type2["HardBreak"] = 24] = "HardBreak";
  Type2[Type2["Emphasis"] = 25] = "Emphasis";
  Type2[Type2["StrongEmphasis"] = 26] = "StrongEmphasis";
  Type2[Type2["Link"] = 27] = "Link";
  Type2[Type2["Image"] = 28] = "Image";
  Type2[Type2["InlineCode"] = 29] = "InlineCode";
  Type2[Type2["HTMLTag"] = 30] = "HTMLTag";
  Type2[Type2["Comment"] = 31] = "Comment";
  Type2[Type2["ProcessingInstruction"] = 32] = "ProcessingInstruction";
  Type2[Type2["Autolink"] = 33] = "Autolink";
  Type2[Type2["HeaderMark"] = 34] = "HeaderMark";
  Type2[Type2["QuoteMark"] = 35] = "QuoteMark";
  Type2[Type2["ListMark"] = 36] = "ListMark";
  Type2[Type2["LinkMark"] = 37] = "LinkMark";
  Type2[Type2["EmphasisMark"] = 38] = "EmphasisMark";
  Type2[Type2["CodeMark"] = 39] = "CodeMark";
  Type2[Type2["CodeText"] = 40] = "CodeText";
  Type2[Type2["CodeInfo"] = 41] = "CodeInfo";
  Type2[Type2["LinkTitle"] = 42] = "LinkTitle";
  Type2[Type2["LinkLabel"] = 43] = "LinkLabel";
  Type2[Type2["URL"] = 44] = "URL";
})(Type || (Type = {}));
var LeafBlock = class {
  /**
  @internal
  */
  constructor(start, content2) {
    this.start = start;
    this.content = content2;
    this.marks = [];
    this.parsers = [];
  }
};
var Line = class {
  constructor() {
    this.text = "";
    this.baseIndent = 0;
    this.basePos = 0;
    this.depth = 0;
    this.markers = [];
    this.pos = 0;
    this.indent = 0;
    this.next = -1;
  }
  /**
  @internal
  */
  forward() {
    if (this.basePos > this.pos)
      this.forwardInner();
  }
  /**
  @internal
  */
  forwardInner() {
    let newPos = this.skipSpace(this.basePos);
    this.indent = this.countIndent(newPos, this.pos, this.indent);
    this.pos = newPos;
    this.next = newPos == this.text.length ? -1 : this.text.charCodeAt(newPos);
  }
  /**
  Skip whitespace after the given position, return the position of
  the next non-space character or the end of the line if there's
  only space after `from`.
  */
  skipSpace(from) {
    return skipSpace(this.text, from);
  }
  /**
  @internal
  */
  reset(text) {
    this.text = text;
    this.baseIndent = this.basePos = this.pos = this.indent = 0;
    this.forwardInner();
    this.depth = 1;
    while (this.markers.length)
      this.markers.pop();
  }
  /**
  Move the line's base position forward to the given position.
  This should only be called by composite [block
  parsers](#BlockParser.parse) or [markup skipping
  functions](#NodeSpec.composite).
  */
  moveBase(to2) {
    this.basePos = to2;
    this.baseIndent = this.countIndent(to2, this.pos, this.indent);
  }
  /**
  Move the line's base position forward to the given _column_.
  */
  moveBaseColumn(indent) {
    this.baseIndent = indent;
    this.basePos = this.findColumn(indent);
  }
  /**
  Store a composite-block-level marker. Should be called from
  [markup skipping functions](#NodeSpec.composite) when they
  consume any non-whitespace characters.
  */
  addMarker(elt2) {
    this.markers.push(elt2);
  }
  /**
  Find the column position at `to`, optionally starting at a given
  position and column.
  */
  countIndent(to2, from = 0, indent = 0) {
    for (let i = from; i < to2; i++)
      indent += this.text.charCodeAt(i) == 9 ? 4 - indent % 4 : 1;
    return indent;
  }
  /**
  Find the position corresponding to the given column.
  */
  findColumn(goal) {
    let i = 0;
    for (let indent = 0; i < this.text.length && indent < goal; i++)
      indent += this.text.charCodeAt(i) == 9 ? 4 - indent % 4 : 1;
    return i;
  }
  /**
  @internal
  */
  scrub() {
    if (!this.baseIndent)
      return this.text;
    let result = "";
    for (let i = 0; i < this.basePos; i++)
      result += " ";
    return result + this.text.slice(this.basePos);
  }
};
function skipForList(bl, cx, line) {
  if (line.pos == line.text.length || bl != cx.block && line.indent >= cx.stack[line.depth + 1].value + line.baseIndent)
    return true;
  if (line.indent >= line.baseIndent + 4)
    return false;
  let size = (bl.type == Type.OrderedList ? isOrderedList : isBulletList)(line, cx, false);
  return size > 0 && (bl.type != Type.BulletList || isHorizontalRule(line, cx, false) < 0) && line.text.charCodeAt(line.pos + size - 1) == bl.value;
}
var DefaultSkipMarkup = {
  [Type.Blockquote](bl, cx, line) {
    if (line.next != 62)
      return false;
    line.markers.push(elt(Type.QuoteMark, cx.lineStart + line.pos, cx.lineStart + line.pos + 1));
    line.moveBase(line.pos + (space(line.text.charCodeAt(line.pos + 1)) ? 2 : 1));
    bl.end = cx.lineStart + line.text.length;
    return true;
  },
  [Type.ListItem](bl, _cx, line) {
    if (line.indent < line.baseIndent + bl.value && line.next > -1)
      return false;
    line.moveBaseColumn(line.baseIndent + bl.value);
    return true;
  },
  [Type.OrderedList]: skipForList,
  [Type.BulletList]: skipForList,
  [Type.Document]() {
    return true;
  }
};
function space(ch) {
  return ch == 32 || ch == 9 || ch == 10 || ch == 13;
}
function skipSpace(line, i = 0) {
  while (i < line.length && space(line.charCodeAt(i)))
    i++;
  return i;
}
function skipSpaceBack(line, i, to2) {
  while (i > to2 && space(line.charCodeAt(i - 1)))
    i--;
  return i;
}
function isFencedCode(line) {
  if (line.next != 96 && line.next != 126)
    return -1;
  let pos = line.pos + 1;
  while (pos < line.text.length && line.text.charCodeAt(pos) == line.next)
    pos++;
  if (pos < line.pos + 3)
    return -1;
  if (line.next == 96) {
    for (let i = pos; i < line.text.length; i++)
      if (line.text.charCodeAt(i) == 96)
        return -1;
  }
  return pos;
}
function isBlockquote(line) {
  return line.next != 62 ? -1 : line.text.charCodeAt(line.pos + 1) == 32 ? 2 : 1;
}
function isHorizontalRule(line, cx, breaking) {
  if (line.next != 42 && line.next != 45 && line.next != 95)
    return -1;
  let count = 1;
  for (let pos = line.pos + 1; pos < line.text.length; pos++) {
    let ch = line.text.charCodeAt(pos);
    if (ch == line.next)
      count++;
    else if (!space(ch))
      return -1;
  }
  if (breaking && line.next == 45 && isSetextUnderline(line) > -1 && line.depth == cx.stack.length && cx.parser.leafBlockParsers.indexOf(DefaultLeafBlocks.SetextHeading) > -1)
    return -1;
  return count < 3 ? -1 : 1;
}
function inList(cx, type) {
  for (let i = cx.stack.length - 1; i >= 0; i--)
    if (cx.stack[i].type == type)
      return true;
  return false;
}
function isBulletList(line, cx, breaking) {
  return (line.next == 45 || line.next == 43 || line.next == 42) && (line.pos == line.text.length - 1 || space(line.text.charCodeAt(line.pos + 1))) && (!breaking || inList(cx, Type.BulletList) || line.skipSpace(line.pos + 2) < line.text.length) ? 1 : -1;
}
function isOrderedList(line, cx, breaking) {
  let pos = line.pos, next = line.next;
  for (; ; ) {
    if (next >= 48 && next <= 57)
      pos++;
    else
      break;
    if (pos == line.text.length)
      return -1;
    next = line.text.charCodeAt(pos);
  }
  if (pos == line.pos || pos > line.pos + 9 || next != 46 && next != 41 || pos < line.text.length - 1 && !space(line.text.charCodeAt(pos + 1)) || breaking && !inList(cx, Type.OrderedList) && (line.skipSpace(pos + 1) == line.text.length || pos > line.pos + 1 || line.next != 49))
    return -1;
  return pos + 1 - line.pos;
}
function isAtxHeading(line) {
  if (line.next != 35)
    return -1;
  let pos = line.pos + 1;
  while (pos < line.text.length && line.text.charCodeAt(pos) == 35)
    pos++;
  if (pos < line.text.length && line.text.charCodeAt(pos) != 32)
    return -1;
  let size = pos - line.pos;
  return size > 6 ? -1 : size;
}
function isSetextUnderline(line) {
  if (line.next != 45 && line.next != 61 || line.indent >= line.baseIndent + 4)
    return -1;
  let pos = line.pos + 1;
  while (pos < line.text.length && line.text.charCodeAt(pos) == line.next)
    pos++;
  let end = pos;
  while (pos < line.text.length && space(line.text.charCodeAt(pos)))
    pos++;
  return pos == line.text.length ? end : -1;
}
var EmptyLine = /^[ \t]*$/;
var CommentEnd = /-->/;
var ProcessingEnd = /\?>/;
var HTMLBlockStyle = [
  [/^<(?:script|pre|style)(?:\s|>|$)/i, /<\/(?:script|pre|style)>/i],
  [/^\s*<!--/, CommentEnd],
  [/^\s*<\?/, ProcessingEnd],
  [/^\s*<![A-Z]/, />/],
  [/^\s*<!\[CDATA\[/, /\]\]>/],
  [/^\s*<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i, EmptyLine],
  [/^\s*(?:<\/[a-z][\w-]*\s*>|<[a-z][\w-]*(\s+[a-z:_][\w-.]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*>)\s*$/i, EmptyLine]
];
function isHTMLBlock(line, _cx, breaking) {
  if (line.next != 60)
    return -1;
  let rest = line.text.slice(line.pos);
  for (let i = 0, e = HTMLBlockStyle.length - (breaking ? 1 : 0); i < e; i++)
    if (HTMLBlockStyle[i][0].test(rest))
      return i;
  return -1;
}
function getListIndent(line, pos) {
  let indentAfter = line.countIndent(pos, line.pos, line.indent);
  let indented = line.countIndent(line.skipSpace(pos), pos, indentAfter);
  return indented >= indentAfter + 5 ? indentAfter + 1 : indented;
}
function addCodeText(marks, from, to2) {
  let last = marks.length - 1;
  if (last >= 0 && marks[last].to == from && marks[last].type == Type.CodeText)
    marks[last].to = to2;
  else
    marks.push(elt(Type.CodeText, from, to2));
}
var DefaultBlockParsers = {
  LinkReference: void 0,
  IndentedCode(cx, line) {
    let base = line.baseIndent + 4;
    if (line.indent < base)
      return false;
    let start = line.findColumn(base);
    let from = cx.lineStart + start, to2 = cx.lineStart + line.text.length;
    let marks = [], pendingMarks = [];
    addCodeText(marks, from, to2);
    while (cx.nextLine() && line.depth >= cx.stack.length) {
      if (line.pos == line.text.length) {
        addCodeText(pendingMarks, cx.lineStart - 1, cx.lineStart);
        for (let m3 of line.markers)
          pendingMarks.push(m3);
      } else if (line.indent < base) {
        break;
      } else {
        if (pendingMarks.length) {
          for (let m3 of pendingMarks) {
            if (m3.type == Type.CodeText)
              addCodeText(marks, m3.from, m3.to);
            else
              marks.push(m3);
          }
          pendingMarks = [];
        }
        addCodeText(marks, cx.lineStart - 1, cx.lineStart);
        for (let m3 of line.markers)
          marks.push(m3);
        to2 = cx.lineStart + line.text.length;
        let codeStart = cx.lineStart + line.findColumn(line.baseIndent + 4);
        if (codeStart < to2)
          addCodeText(marks, codeStart, to2);
      }
    }
    if (pendingMarks.length) {
      pendingMarks = pendingMarks.filter((m3) => m3.type != Type.CodeText);
      if (pendingMarks.length)
        line.markers = pendingMarks.concat(line.markers);
    }
    cx.addNode(cx.buffer.writeElements(marks, -from).finish(Type.CodeBlock, to2 - from), from);
    return true;
  },
  FencedCode(cx, line) {
    let fenceEnd = isFencedCode(line);
    if (fenceEnd < 0)
      return false;
    let from = cx.lineStart + line.pos, ch = line.next, len = fenceEnd - line.pos;
    let infoFrom = line.skipSpace(fenceEnd), infoTo = skipSpaceBack(line.text, line.text.length, infoFrom);
    let marks = [elt(Type.CodeMark, from, from + len)];
    if (infoFrom < infoTo)
      marks.push(elt(Type.CodeInfo, cx.lineStart + infoFrom, cx.lineStart + infoTo));
    for (let first = true, empty = true, hasLine = false; cx.nextLine() && line.depth >= cx.stack.length; first = false) {
      let i = line.pos;
      if (line.indent - line.baseIndent < 4)
        while (i < line.text.length && line.text.charCodeAt(i) == ch)
          i++;
      if (i - line.pos >= len && line.skipSpace(i) == line.text.length) {
        for (let m3 of line.markers)
          marks.push(m3);
        if (empty && hasLine)
          addCodeText(marks, cx.lineStart - 1, cx.lineStart);
        marks.push(elt(Type.CodeMark, cx.lineStart + line.pos, cx.lineStart + i));
        cx.nextLine();
        break;
      } else {
        hasLine = true;
        if (!first) {
          addCodeText(marks, cx.lineStart - 1, cx.lineStart);
          empty = false;
        }
        for (let m3 of line.markers)
          marks.push(m3);
        let textStart = cx.lineStart + line.basePos, textEnd = cx.lineStart + line.text.length;
        if (textStart < textEnd) {
          addCodeText(marks, textStart, textEnd);
          empty = false;
        }
      }
    }
    cx.addNode(cx.buffer.writeElements(marks, -from).finish(Type.FencedCode, cx.prevLineEnd() - from), from);
    return true;
  },
  Blockquote(cx, line) {
    let size = isBlockquote(line);
    if (size < 0)
      return false;
    cx.startContext(Type.Blockquote, line.pos);
    cx.addNode(Type.QuoteMark, cx.lineStart + line.pos, cx.lineStart + line.pos + 1);
    line.moveBase(line.pos + size);
    return null;
  },
  HorizontalRule(cx, line) {
    if (isHorizontalRule(line, cx, false) < 0)
      return false;
    let from = cx.lineStart + line.pos;
    cx.nextLine();
    cx.addNode(Type.HorizontalRule, from);
    return true;
  },
  BulletList(cx, line) {
    let size = isBulletList(line, cx, false);
    if (size < 0)
      return false;
    if (cx.block.type != Type.BulletList)
      cx.startContext(Type.BulletList, line.basePos, line.next);
    let newBase = getListIndent(line, line.pos + 1);
    cx.startContext(Type.ListItem, line.basePos, newBase - line.baseIndent);
    cx.addNode(Type.ListMark, cx.lineStart + line.pos, cx.lineStart + line.pos + size);
    line.moveBaseColumn(newBase);
    return null;
  },
  OrderedList(cx, line) {
    let size = isOrderedList(line, cx, false);
    if (size < 0)
      return false;
    if (cx.block.type != Type.OrderedList)
      cx.startContext(Type.OrderedList, line.basePos, line.text.charCodeAt(line.pos + size - 1));
    let newBase = getListIndent(line, line.pos + size);
    cx.startContext(Type.ListItem, line.basePos, newBase - line.baseIndent);
    cx.addNode(Type.ListMark, cx.lineStart + line.pos, cx.lineStart + line.pos + size);
    line.moveBaseColumn(newBase);
    return null;
  },
  ATXHeading(cx, line) {
    let size = isAtxHeading(line);
    if (size < 0)
      return false;
    let off = line.pos, from = cx.lineStart + off;
    let endOfSpace = skipSpaceBack(line.text, line.text.length, off), after = endOfSpace;
    while (after > off && line.text.charCodeAt(after - 1) == line.next)
      after--;
    if (after == endOfSpace || after == off || !space(line.text.charCodeAt(after - 1)))
      after = line.text.length;
    let buf = cx.buffer.write(Type.HeaderMark, 0, size).writeElements(cx.parser.parseInline(line.text.slice(off + size + 1, after), from + size + 1), -from);
    if (after < line.text.length)
      buf.write(Type.HeaderMark, after - off, endOfSpace - off);
    let node = buf.finish(Type.ATXHeading1 - 1 + size, line.text.length - off);
    cx.nextLine();
    cx.addNode(node, from);
    return true;
  },
  HTMLBlock(cx, line) {
    let type = isHTMLBlock(line, cx, false);
    if (type < 0)
      return false;
    let from = cx.lineStart + line.pos, end = HTMLBlockStyle[type][1];
    let marks = [], trailing = end != EmptyLine;
    while (!end.test(line.text) && cx.nextLine()) {
      if (line.depth < cx.stack.length) {
        trailing = false;
        break;
      }
      for (let m3 of line.markers)
        marks.push(m3);
    }
    if (trailing)
      cx.nextLine();
    let nodeType = end == CommentEnd ? Type.CommentBlock : end == ProcessingEnd ? Type.ProcessingInstructionBlock : Type.HTMLBlock;
    let to2 = cx.prevLineEnd();
    cx.addNode(cx.buffer.writeElements(marks, -from).finish(nodeType, to2 - from), from);
    return true;
  },
  SetextHeading: void 0
  // Specifies relative precedence for block-continue function
};
var LinkReferenceParser = class {
  constructor(leaf) {
    this.stage = 0;
    this.elts = [];
    this.pos = 0;
    this.start = leaf.start;
    this.advance(leaf.content);
  }
  nextLine(cx, line, leaf) {
    if (this.stage == -1)
      return false;
    let content2 = leaf.content + "\n" + line.scrub();
    let finish = this.advance(content2);
    if (finish > -1 && finish < content2.length)
      return this.complete(cx, leaf, finish);
    return false;
  }
  finish(cx, leaf) {
    if ((this.stage == 2 || this.stage == 3) && skipSpace(leaf.content, this.pos) == leaf.content.length)
      return this.complete(cx, leaf, leaf.content.length);
    return false;
  }
  complete(cx, leaf, len) {
    cx.addLeafElement(leaf, elt(Type.LinkReference, this.start, this.start + len, this.elts));
    return true;
  }
  nextStage(elt2) {
    if (elt2) {
      this.pos = elt2.to - this.start;
      this.elts.push(elt2);
      this.stage++;
      return true;
    }
    if (elt2 === false)
      this.stage = -1;
    return false;
  }
  advance(content2) {
    for (; ; ) {
      if (this.stage == -1) {
        return -1;
      } else if (this.stage == 0) {
        if (!this.nextStage(parseLinkLabel(content2, this.pos, this.start, true)))
          return -1;
        if (content2.charCodeAt(this.pos) != 58)
          return this.stage = -1;
        this.elts.push(elt(Type.LinkMark, this.pos + this.start, this.pos + this.start + 1));
        this.pos++;
      } else if (this.stage == 1) {
        if (!this.nextStage(parseURL(content2, skipSpace(content2, this.pos), this.start)))
          return -1;
      } else if (this.stage == 2) {
        let skip = skipSpace(content2, this.pos), end = 0;
        if (skip > this.pos) {
          let title = parseLinkTitle(content2, skip, this.start);
          if (title) {
            let titleEnd = lineEnd(content2, title.to - this.start);
            if (titleEnd > 0) {
              this.nextStage(title);
              end = titleEnd;
            }
          }
        }
        if (!end)
          end = lineEnd(content2, this.pos);
        return end > 0 && end < content2.length ? end : -1;
      } else {
        return lineEnd(content2, this.pos);
      }
    }
  }
};
function lineEnd(text, pos) {
  for (; pos < text.length; pos++) {
    let next = text.charCodeAt(pos);
    if (next == 10)
      break;
    if (!space(next))
      return -1;
  }
  return pos;
}
var SetextHeadingParser = class {
  nextLine(cx, line, leaf) {
    let underline = line.depth < cx.stack.length ? -1 : isSetextUnderline(line);
    let next = line.next;
    if (underline < 0)
      return false;
    let underlineMark = elt(Type.HeaderMark, cx.lineStart + line.pos, cx.lineStart + underline);
    cx.nextLine();
    cx.addLeafElement(leaf, elt(next == 61 ? Type.SetextHeading1 : Type.SetextHeading2, leaf.start, cx.prevLineEnd(), [
      ...cx.parser.parseInline(leaf.content, leaf.start),
      underlineMark
    ]));
    return true;
  }
  finish() {
    return false;
  }
};
var DefaultLeafBlocks = {
  LinkReference(_, leaf) {
    return leaf.content.charCodeAt(0) == 91 ? new LinkReferenceParser(leaf) : null;
  },
  SetextHeading() {
    return new SetextHeadingParser();
  }
};
var DefaultEndLeaf = [
  (_, line) => isAtxHeading(line) >= 0,
  (_, line) => isFencedCode(line) >= 0,
  (_, line) => isBlockquote(line) >= 0,
  (p2, line) => isBulletList(line, p2, true) >= 0,
  (p2, line) => isOrderedList(line, p2, true) >= 0,
  (p2, line) => isHorizontalRule(line, p2, true) >= 0,
  (p2, line) => isHTMLBlock(line, p2, true) >= 0
];
var scanLineResult = { text: "", end: 0 };
var BlockContext = class {
  /**
  @internal
  */
  constructor(parser2, input, fragments, ranges) {
    this.parser = parser2;
    this.input = input;
    this.ranges = ranges;
    this.line = new Line();
    this.atEnd = false;
    this.reusePlaceholders = /* @__PURE__ */ new Map();
    this.stoppedAt = null;
    this.rangeI = 0;
    this.to = ranges[ranges.length - 1].to;
    this.lineStart = this.absoluteLineStart = this.absoluteLineEnd = ranges[0].from;
    this.block = CompositeBlock.create(Type.Document, 0, this.lineStart, 0, 0);
    this.stack = [this.block];
    this.fragments = fragments.length ? new FragmentCursor(fragments, input) : null;
    this.readLine();
  }
  get parsedPos() {
    return this.absoluteLineStart;
  }
  advance() {
    if (this.stoppedAt != null && this.absoluteLineStart > this.stoppedAt)
      return this.finish();
    let { line } = this;
    for (; ; ) {
      for (let markI = 0; ; ) {
        let next = line.depth < this.stack.length ? this.stack[this.stack.length - 1] : null;
        while (markI < line.markers.length && (!next || line.markers[markI].from < next.end)) {
          let mark = line.markers[markI++];
          this.addNode(mark.type, mark.from, mark.to);
        }
        if (!next)
          break;
        this.finishContext();
      }
      if (line.pos < line.text.length)
        break;
      if (!this.nextLine())
        return this.finish();
    }
    if (this.fragments && this.reuseFragment(line.basePos))
      return null;
    start: for (; ; ) {
      for (let type of this.parser.blockParsers)
        if (type) {
          let result = type(this, line);
          if (result != false) {
            if (result == true)
              return null;
            line.forward();
            continue start;
          }
        }
      break;
    }
    let leaf = new LeafBlock(this.lineStart + line.pos, line.text.slice(line.pos));
    for (let parse2 of this.parser.leafBlockParsers)
      if (parse2) {
        let parser2 = parse2(this, leaf);
        if (parser2)
          leaf.parsers.push(parser2);
      }
    lines: while (this.nextLine()) {
      if (line.pos == line.text.length)
        break;
      if (line.indent < line.baseIndent + 4) {
        for (let stop of this.parser.endLeafBlock)
          if (stop(this, line, leaf))
            break lines;
      }
      for (let parser2 of leaf.parsers)
        if (parser2.nextLine(this, line, leaf))
          return null;
      leaf.content += "\n" + line.scrub();
      for (let m3 of line.markers)
        leaf.marks.push(m3);
    }
    this.finishLeaf(leaf);
    return null;
  }
  stopAt(pos) {
    if (this.stoppedAt != null && this.stoppedAt < pos)
      throw new RangeError("Can't move stoppedAt forward");
    this.stoppedAt = pos;
  }
  reuseFragment(start) {
    if (!this.fragments.moveTo(this.absoluteLineStart + start, this.absoluteLineStart) || !this.fragments.matches(this.block.hash))
      return false;
    let taken = this.fragments.takeNodes(this);
    if (!taken)
      return false;
    this.absoluteLineStart += taken;
    this.lineStart = toRelative(this.absoluteLineStart, this.ranges);
    this.moveRangeI();
    if (this.absoluteLineStart < this.to) {
      this.lineStart++;
      this.absoluteLineStart++;
      this.readLine();
    } else {
      this.atEnd = true;
      this.readLine();
    }
    return true;
  }
  /**
  The number of parent blocks surrounding the current block.
  */
  get depth() {
    return this.stack.length;
  }
  /**
  Get the type of the parent block at the given depth. When no
  depth is passed, return the type of the innermost parent.
  */
  parentType(depth = this.depth - 1) {
    return this.parser.nodeSet.types[this.stack[depth].type];
  }
  /**
  Move to the next input line. This should only be called by
  (non-composite) [block parsers](#BlockParser.parse) that consume
  the line directly, or leaf block parser
  [`nextLine`](#LeafBlockParser.nextLine) methods when they
  consume the current line (and return true).
  */
  nextLine() {
    this.lineStart += this.line.text.length;
    if (this.absoluteLineEnd >= this.to) {
      this.absoluteLineStart = this.absoluteLineEnd;
      this.atEnd = true;
      this.readLine();
      return false;
    } else {
      this.lineStart++;
      this.absoluteLineStart = this.absoluteLineEnd + 1;
      this.moveRangeI();
      this.readLine();
      return true;
    }
  }
  /**
  Retrieve the text of the line after the current one, without
  actually moving the context's current line forward.
  */
  peekLine() {
    return this.scanLine(this.absoluteLineEnd + 1).text;
  }
  moveRangeI() {
    while (this.rangeI < this.ranges.length - 1 && this.absoluteLineStart >= this.ranges[this.rangeI].to) {
      this.rangeI++;
      this.absoluteLineStart = Math.max(this.absoluteLineStart, this.ranges[this.rangeI].from);
    }
  }
  /**
  @internal
  Collect the text for the next line.
  */
  scanLine(start) {
    let r = scanLineResult;
    r.end = start;
    if (start >= this.to) {
      r.text = "";
    } else {
      r.text = this.lineChunkAt(start);
      r.end += r.text.length;
      if (this.ranges.length > 1) {
        let textOffset = this.absoluteLineStart, rangeI = this.rangeI;
        while (this.ranges[rangeI].to < r.end) {
          rangeI++;
          let nextFrom = this.ranges[rangeI].from;
          let after = this.lineChunkAt(nextFrom);
          r.end = nextFrom + after.length;
          r.text = r.text.slice(0, this.ranges[rangeI - 1].to - textOffset) + after;
          textOffset = r.end - r.text.length;
        }
      }
    }
    return r;
  }
  /**
  @internal
  Populate this.line with the content of the next line. Skip
  leading characters covered by composite blocks.
  */
  readLine() {
    let { line } = this, { text, end } = this.scanLine(this.absoluteLineStart);
    this.absoluteLineEnd = end;
    line.reset(text);
    for (; line.depth < this.stack.length; line.depth++) {
      let cx = this.stack[line.depth], handler = this.parser.skipContextMarkup[cx.type];
      if (!handler)
        throw new Error("Unhandled block context " + Type[cx.type]);
      let marks = this.line.markers.length;
      if (!handler(cx, this, line)) {
        if (this.line.markers.length > marks)
          cx.end = this.line.markers[this.line.markers.length - 1].to;
        line.forward();
        break;
      }
      line.forward();
    }
  }
  lineChunkAt(pos) {
    let next = this.input.chunk(pos), text;
    if (!this.input.lineChunks) {
      let eol = next.indexOf("\n");
      text = eol < 0 ? next : next.slice(0, eol);
    } else {
      text = next == "\n" ? "" : next;
    }
    return pos + text.length > this.to ? text.slice(0, this.to - pos) : text;
  }
  /**
  The end position of the previous line.
  */
  prevLineEnd() {
    return this.atEnd ? this.lineStart : this.lineStart - 1;
  }
  /**
  @internal
  */
  startContext(type, start, value = 0) {
    this.block = CompositeBlock.create(type, value, this.lineStart + start, this.block.hash, this.lineStart + this.line.text.length);
    this.stack.push(this.block);
  }
  /**
  Start a composite block. Should only be called from [block
  parser functions](#BlockParser.parse) that return null.
  */
  startComposite(type, start, value = 0) {
    this.startContext(this.parser.getNodeType(type), start, value);
  }
  /**
  @internal
  */
  addNode(block, from, to2) {
    if (typeof block == "number")
      block = new Tree(this.parser.nodeSet.types[block], none, none, (to2 !== null && to2 !== void 0 ? to2 : this.prevLineEnd()) - from);
    this.block.addChild(block, from - this.block.from);
  }
  /**
  Add a block element. Can be called by [block
  parsers](#BlockParser.parse).
  */
  addElement(elt2) {
    this.block.addChild(elt2.toTree(this.parser.nodeSet), elt2.from - this.block.from);
  }
  /**
  Add a block element from a [leaf parser](#LeafBlockParser). This
  makes sure any extra composite block markup (such as blockquote
  markers) inside the block are also added to the syntax tree.
  */
  addLeafElement(leaf, elt2) {
    this.addNode(this.buffer.writeElements(injectMarks(elt2.children, leaf.marks), -elt2.from).finish(elt2.type, elt2.to - elt2.from), elt2.from);
  }
  /**
  @internal
  */
  finishContext() {
    let cx = this.stack.pop();
    let top = this.stack[this.stack.length - 1];
    top.addChild(cx.toTree(this.parser.nodeSet), cx.from - top.from);
    this.block = top;
  }
  finish() {
    while (this.stack.length > 1)
      this.finishContext();
    return this.addGaps(this.block.toTree(this.parser.nodeSet, this.lineStart));
  }
  addGaps(tree) {
    return this.ranges.length > 1 ? injectGaps(this.ranges, 0, tree.topNode, this.ranges[0].from, this.reusePlaceholders) : tree;
  }
  /**
  @internal
  */
  finishLeaf(leaf) {
    for (let parser2 of leaf.parsers)
      if (parser2.finish(this, leaf))
        return;
    let inline = injectMarks(this.parser.parseInline(leaf.content, leaf.start), leaf.marks);
    this.addNode(this.buffer.writeElements(inline, -leaf.start).finish(Type.Paragraph, leaf.content.length), leaf.start);
  }
  elt(type, from, to2, children) {
    if (typeof type == "string")
      return elt(this.parser.getNodeType(type), from, to2, children);
    return new TreeElement(type, from);
  }
  /**
  @internal
  */
  get buffer() {
    return new Buffer2(this.parser.nodeSet);
  }
};
function injectGaps(ranges, rangeI, tree, offset, dummies) {
  let rangeEnd = ranges[rangeI].to;
  let children = [], positions = [], start = tree.from + offset;
  function movePastNext(upto, inclusive) {
    while (inclusive ? upto >= rangeEnd : upto > rangeEnd) {
      let size = ranges[rangeI + 1].from - rangeEnd;
      offset += size;
      upto += size;
      rangeI++;
      rangeEnd = ranges[rangeI].to;
    }
  }
  for (let ch = tree.firstChild; ch; ch = ch.nextSibling) {
    movePastNext(ch.from + offset, true);
    let from = ch.from + offset, node, reuse = dummies.get(ch.tree);
    if (reuse) {
      node = reuse;
    } else if (ch.to + offset > rangeEnd) {
      node = injectGaps(ranges, rangeI, ch, offset, dummies);
      movePastNext(ch.to + offset, false);
    } else {
      node = ch.toTree();
    }
    children.push(node);
    positions.push(from - start);
  }
  movePastNext(tree.to + offset, false);
  return new Tree(tree.type, children, positions, tree.to + offset - start, tree.tree ? tree.tree.propValues : void 0);
}
var MarkdownParser = class _MarkdownParser extends Parser2 {
  /**
  @internal
  */
  constructor(nodeSet, blockParsers, leafBlockParsers, blockNames, endLeafBlock, skipContextMarkup, inlineParsers, inlineNames, wrappers) {
    super();
    this.nodeSet = nodeSet;
    this.blockParsers = blockParsers;
    this.leafBlockParsers = leafBlockParsers;
    this.blockNames = blockNames;
    this.endLeafBlock = endLeafBlock;
    this.skipContextMarkup = skipContextMarkup;
    this.inlineParsers = inlineParsers;
    this.inlineNames = inlineNames;
    this.wrappers = wrappers;
    this.nodeTypes = /* @__PURE__ */ Object.create(null);
    for (let t33 of nodeSet.types)
      this.nodeTypes[t33.name] = t33.id;
  }
  createParse(input, fragments, ranges) {
    let parse2 = new BlockContext(this, input, fragments, ranges);
    for (let w of this.wrappers)
      parse2 = w(parse2, input, fragments, ranges);
    return parse2;
  }
  /**
  Reconfigure the parser.
  */
  configure(spec) {
    let config = resolveConfig(spec);
    if (!config)
      return this;
    let { nodeSet, skipContextMarkup } = this;
    let blockParsers = this.blockParsers.slice(), leafBlockParsers = this.leafBlockParsers.slice(), blockNames = this.blockNames.slice(), inlineParsers = this.inlineParsers.slice(), inlineNames = this.inlineNames.slice(), endLeafBlock = this.endLeafBlock.slice(), wrappers = this.wrappers;
    if (nonEmpty(config.defineNodes)) {
      skipContextMarkup = Object.assign({}, skipContextMarkup);
      let nodeTypes2 = nodeSet.types.slice(), styles;
      for (let s of config.defineNodes) {
        let { name: name2, block, composite, style } = typeof s == "string" ? { name: s } : s;
        if (nodeTypes2.some((t33) => t33.name == name2))
          continue;
        if (composite)
          skipContextMarkup[nodeTypes2.length] = (bl, cx, line) => composite(cx, line, bl.value);
        let id = nodeTypes2.length;
        let group2 = composite ? ["Block", "BlockContext"] : !block ? void 0 : id >= Type.ATXHeading1 && id <= Type.SetextHeading2 ? ["Block", "LeafBlock", "Heading"] : ["Block", "LeafBlock"];
        nodeTypes2.push(NodeType.define({
          id,
          name: name2,
          props: group2 && [[NodeProp.group, group2]]
        }));
        if (style) {
          if (!styles)
            styles = {};
          if (Array.isArray(style) || style instanceof Tag)
            styles[name2] = style;
          else
            Object.assign(styles, style);
        }
      }
      nodeSet = new NodeSet(nodeTypes2);
      if (styles)
        nodeSet = nodeSet.extend(styleTags(styles));
    }
    if (nonEmpty(config.props))
      nodeSet = nodeSet.extend(...config.props);
    if (nonEmpty(config.remove)) {
      for (let rm of config.remove) {
        let block = this.blockNames.indexOf(rm), inline = this.inlineNames.indexOf(rm);
        if (block > -1)
          blockParsers[block] = leafBlockParsers[block] = void 0;
        if (inline > -1)
          inlineParsers[inline] = void 0;
      }
    }
    if (nonEmpty(config.parseBlock)) {
      for (let spec2 of config.parseBlock) {
        let found = blockNames.indexOf(spec2.name);
        if (found > -1) {
          blockParsers[found] = spec2.parse;
          leafBlockParsers[found] = spec2.leaf;
        } else {
          let pos = spec2.before ? findName(blockNames, spec2.before) : spec2.after ? findName(blockNames, spec2.after) + 1 : blockNames.length - 1;
          blockParsers.splice(pos, 0, spec2.parse);
          leafBlockParsers.splice(pos, 0, spec2.leaf);
          blockNames.splice(pos, 0, spec2.name);
        }
        if (spec2.endLeaf)
          endLeafBlock.push(spec2.endLeaf);
      }
    }
    if (nonEmpty(config.parseInline)) {
      for (let spec2 of config.parseInline) {
        let found = inlineNames.indexOf(spec2.name);
        if (found > -1) {
          inlineParsers[found] = spec2.parse;
        } else {
          let pos = spec2.before ? findName(inlineNames, spec2.before) : spec2.after ? findName(inlineNames, spec2.after) + 1 : inlineNames.length - 1;
          inlineParsers.splice(pos, 0, spec2.parse);
          inlineNames.splice(pos, 0, spec2.name);
        }
      }
    }
    if (config.wrap)
      wrappers = wrappers.concat(config.wrap);
    return new _MarkdownParser(nodeSet, blockParsers, leafBlockParsers, blockNames, endLeafBlock, skipContextMarkup, inlineParsers, inlineNames, wrappers);
  }
  /**
  @internal
  */
  getNodeType(name2) {
    let found = this.nodeTypes[name2];
    if (found == null)
      throw new RangeError(`Unknown node type '${name2}'`);
    return found;
  }
  /**
  Parse the given piece of inline text at the given offset,
  returning an array of [`Element`](#Element) objects representing
  the inline content.
  */
  parseInline(text, offset) {
    let cx = new InlineContext(this, text, offset);
    outer: for (let pos = offset; pos < cx.end; ) {
      let next = cx.char(pos);
      for (let token of this.inlineParsers)
        if (token) {
          let result = token(cx, next, pos);
          if (result >= 0) {
            pos = result;
            continue outer;
          }
        }
      pos++;
    }
    return cx.resolveMarkers(0);
  }
};
function nonEmpty(a) {
  return a != null && a.length > 0;
}
function resolveConfig(spec) {
  if (!Array.isArray(spec))
    return spec;
  if (spec.length == 0)
    return null;
  let conf = resolveConfig(spec[0]);
  if (spec.length == 1)
    return conf;
  let rest = resolveConfig(spec.slice(1));
  if (!rest || !conf)
    return conf || rest;
  let conc = (a, b) => (a || none).concat(b || none);
  let wrapA = conf.wrap, wrapB = rest.wrap;
  return {
    props: conc(conf.props, rest.props),
    defineNodes: conc(conf.defineNodes, rest.defineNodes),
    parseBlock: conc(conf.parseBlock, rest.parseBlock),
    parseInline: conc(conf.parseInline, rest.parseInline),
    remove: conc(conf.remove, rest.remove),
    wrap: !wrapA ? wrapB : !wrapB ? wrapA : (inner, input, fragments, ranges) => wrapA(wrapB(inner, input, fragments, ranges), input, fragments, ranges)
  };
}
function findName(names, name2) {
  let found = names.indexOf(name2);
  if (found < 0)
    throw new RangeError(`Position specified relative to unknown parser ${name2}`);
  return found;
}
var nodeTypes = [NodeType.none];
for (let i = 1, name2; name2 = Type[i]; i++) {
  nodeTypes[i] = NodeType.define({
    id: i,
    name: name2,
    props: i >= Type.Escape ? [] : [[NodeProp.group, i in DefaultSkipMarkup ? ["Block", "BlockContext"] : ["Block", "LeafBlock"]]],
    top: name2 == "Document"
  });
}
var none = [];
var Buffer2 = class {
  constructor(nodeSet) {
    this.nodeSet = nodeSet;
    this.content = [];
    this.nodes = [];
  }
  write(type, from, to2, children = 0) {
    this.content.push(type, from, to2, 4 + children * 4);
    return this;
  }
  writeElements(elts, offset = 0) {
    for (let e of elts)
      e.writeTo(this, offset);
    return this;
  }
  finish(type, length) {
    return Tree.build({
      buffer: this.content,
      nodeSet: this.nodeSet,
      reused: this.nodes,
      topID: type,
      length
    });
  }
};
var Element = class {
  /**
  @internal
  */
  constructor(type, from, to2, children = none) {
    this.type = type;
    this.from = from;
    this.to = to2;
    this.children = children;
  }
  /**
  @internal
  */
  writeTo(buf, offset) {
    let startOff = buf.content.length;
    buf.writeElements(this.children, offset);
    buf.content.push(this.type, this.from + offset, this.to + offset, buf.content.length + 4 - startOff);
  }
  /**
  @internal
  */
  toTree(nodeSet) {
    return new Buffer2(nodeSet).writeElements(this.children, -this.from).finish(this.type, this.to - this.from);
  }
};
var TreeElement = class {
  constructor(tree, from) {
    this.tree = tree;
    this.from = from;
  }
  get to() {
    return this.from + this.tree.length;
  }
  get type() {
    return this.tree.type.id;
  }
  get children() {
    return none;
  }
  writeTo(buf, offset) {
    buf.nodes.push(this.tree);
    buf.content.push(buf.nodes.length - 1, this.from + offset, this.to + offset, -1);
  }
  toTree() {
    return this.tree;
  }
};
function elt(type, from, to2, children) {
  return new Element(type, from, to2, children);
}
var EmphasisUnderscore = { resolve: "Emphasis", mark: "EmphasisMark" };
var EmphasisAsterisk = { resolve: "Emphasis", mark: "EmphasisMark" };
var LinkStart = {};
var ImageStart = {};
var InlineDelimiter = class {
  constructor(type, from, to2, side) {
    this.type = type;
    this.from = from;
    this.to = to2;
    this.side = side;
  }
};
var Escapable = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
var Punctuation = /[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~\xA1\u2010-\u2027]/;
try {
  Punctuation = new RegExp("[\\p{S}|\\p{P}]", "u");
} catch (_) {
}
var DefaultInline = {
  Escape(cx, next, start) {
    if (next != 92 || start == cx.end - 1)
      return -1;
    let escaped4 = cx.char(start + 1);
    for (let i = 0; i < Escapable.length; i++)
      if (Escapable.charCodeAt(i) == escaped4)
        return cx.append(elt(Type.Escape, start, start + 2));
    return -1;
  },
  Entity(cx, next, start) {
    if (next != 38)
      return -1;
    let m3 = /^(?:#\d+|#x[a-f\d]+|\w+);/i.exec(cx.slice(start + 1, start + 31));
    return m3 ? cx.append(elt(Type.Entity, start, start + 1 + m3[0].length)) : -1;
  },
  InlineCode(cx, next, start) {
    if (next != 96 || start && cx.char(start - 1) == 96)
      return -1;
    let pos = start + 1;
    while (pos < cx.end && cx.char(pos) == 96)
      pos++;
    let size = pos - start, curSize = 0;
    for (; pos < cx.end; pos++) {
      if (cx.char(pos) == 96) {
        curSize++;
        if (curSize == size && cx.char(pos + 1) != 96)
          return cx.append(elt(Type.InlineCode, start, pos + 1, [
            elt(Type.CodeMark, start, start + size),
            elt(Type.CodeMark, pos + 1 - size, pos + 1)
          ]));
      } else {
        curSize = 0;
      }
    }
    return -1;
  },
  HTMLTag(cx, next, start) {
    if (next != 60 || start == cx.end - 1)
      return -1;
    let after = cx.slice(start + 1, cx.end);
    let url = /^(?:[a-z][-\w+.]+:[^\s>]+|[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*)>/i.exec(after);
    if (url) {
      return cx.append(elt(Type.Autolink, start, start + 1 + url[0].length, [
        elt(Type.LinkMark, start, start + 1),
        // url[0] includes the closing bracket, so exclude it from this slice
        elt(Type.URL, start + 1, start + url[0].length),
        elt(Type.LinkMark, start + url[0].length, start + 1 + url[0].length)
      ]));
    }
    let comment2 = /^!--[^>](?:-[^-]|[^-])*?-->/i.exec(after);
    if (comment2)
      return cx.append(elt(Type.Comment, start, start + 1 + comment2[0].length));
    let procInst = /^\?[^]*?\?>/.exec(after);
    if (procInst)
      return cx.append(elt(Type.ProcessingInstruction, start, start + 1 + procInst[0].length));
    let m3 = /^(?:![A-Z][^]*?>|!\[CDATA\[[^]*?\]\]>|\/\s*[a-zA-Z][\w-]*\s*>|\s*[a-zA-Z][\w-]*(\s+[a-zA-Z:_][\w-.:]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*(\/\s*)?>)/.exec(after);
    if (!m3)
      return -1;
    return cx.append(elt(Type.HTMLTag, start, start + 1 + m3[0].length));
  },
  Emphasis(cx, next, start) {
    if (next != 95 && next != 42)
      return -1;
    let pos = start + 1;
    while (cx.char(pos) == next)
      pos++;
    let before = cx.slice(start - 1, start), after = cx.slice(pos, pos + 1);
    let pBefore = Punctuation.test(before), pAfter = Punctuation.test(after);
    let sBefore = /\s|^$/.test(before), sAfter = /\s|^$/.test(after);
    let leftFlanking = !sAfter && (!pAfter || sBefore || pBefore);
    let rightFlanking = !sBefore && (!pBefore || sAfter || pAfter);
    let canOpen = leftFlanking && (next == 42 || !rightFlanking || pBefore);
    let canClose = rightFlanking && (next == 42 || !leftFlanking || pAfter);
    return cx.append(new InlineDelimiter(next == 95 ? EmphasisUnderscore : EmphasisAsterisk, start, pos, (canOpen ? 1 : 0) | (canClose ? 2 : 0)));
  },
  HardBreak(cx, next, start) {
    if (next == 92 && cx.char(start + 1) == 10)
      return cx.append(elt(Type.HardBreak, start, start + 2));
    if (next == 32) {
      let pos = start + 1;
      while (cx.char(pos) == 32)
        pos++;
      if (cx.char(pos) == 10 && pos >= start + 2)
        return cx.append(elt(Type.HardBreak, start, pos + 1));
    }
    return -1;
  },
  Link(cx, next, start) {
    return next == 91 ? cx.append(new InlineDelimiter(
      LinkStart,
      start,
      start + 1,
      1
      /* Mark.Open */
    )) : -1;
  },
  Image(cx, next, start) {
    return next == 33 && cx.char(start + 1) == 91 ? cx.append(new InlineDelimiter(
      ImageStart,
      start,
      start + 2,
      1
      /* Mark.Open */
    )) : -1;
  },
  LinkEnd(cx, next, start) {
    if (next != 93)
      return -1;
    for (let i = cx.parts.length - 1; i >= 0; i--) {
      let part = cx.parts[i];
      if (part instanceof InlineDelimiter && (part.type == LinkStart || part.type == ImageStart)) {
        if (!part.side || cx.skipSpace(part.to) == start && !/[(\[]/.test(cx.slice(start + 1, start + 2))) {
          cx.parts[i] = null;
          return -1;
        }
        let content2 = cx.takeContent(i);
        let link = cx.parts[i] = finishLink(cx, content2, part.type == LinkStart ? Type.Link : Type.Image, part.from, start + 1);
        if (part.type == LinkStart)
          for (let j = 0; j < i; j++) {
            let p2 = cx.parts[j];
            if (p2 instanceof InlineDelimiter && p2.type == LinkStart)
              p2.side = 0;
          }
        return link.to;
      }
    }
    return -1;
  }
};
function finishLink(cx, content2, type, start, startPos) {
  let { text } = cx, next = cx.char(startPos), endPos = startPos;
  content2.unshift(elt(Type.LinkMark, start, start + (type == Type.Image ? 2 : 1)));
  content2.push(elt(Type.LinkMark, startPos - 1, startPos));
  if (next == 40) {
    let pos = cx.skipSpace(startPos + 1);
    let dest = parseURL(text, pos - cx.offset, cx.offset), title;
    if (dest) {
      pos = cx.skipSpace(dest.to);
      if (pos != dest.to) {
        title = parseLinkTitle(text, pos - cx.offset, cx.offset);
        if (title)
          pos = cx.skipSpace(title.to);
      }
    }
    if (cx.char(pos) == 41) {
      content2.push(elt(Type.LinkMark, startPos, startPos + 1));
      endPos = pos + 1;
      if (dest)
        content2.push(dest);
      if (title)
        content2.push(title);
      content2.push(elt(Type.LinkMark, pos, endPos));
    }
  } else if (next == 91) {
    let label = parseLinkLabel(text, startPos - cx.offset, cx.offset, false);
    if (label) {
      content2.push(label);
      endPos = label.to;
    }
  }
  return elt(type, start, endPos, content2);
}
function parseURL(text, start, offset) {
  let next = text.charCodeAt(start);
  if (next == 60) {
    for (let pos = start + 1; pos < text.length; pos++) {
      let ch = text.charCodeAt(pos);
      if (ch == 62)
        return elt(Type.URL, start + offset, pos + 1 + offset);
      if (ch == 60 || ch == 10)
        return false;
    }
    return null;
  } else {
    let depth = 0, pos = start;
    for (let escaped4 = false; pos < text.length; pos++) {
      let ch = text.charCodeAt(pos);
      if (space(ch)) {
        break;
      } else if (escaped4) {
        escaped4 = false;
      } else if (ch == 40) {
        depth++;
      } else if (ch == 41) {
        if (!depth)
          break;
        depth--;
      } else if (ch == 92) {
        escaped4 = true;
      }
    }
    return pos > start ? elt(Type.URL, start + offset, pos + offset) : pos == text.length ? null : false;
  }
}
function parseLinkTitle(text, start, offset) {
  let next = text.charCodeAt(start);
  if (next != 39 && next != 34 && next != 40)
    return false;
  let end = next == 40 ? 41 : next;
  for (let pos = start + 1, escaped4 = false; pos < text.length; pos++) {
    let ch = text.charCodeAt(pos);
    if (escaped4)
      escaped4 = false;
    else if (ch == end)
      return elt(Type.LinkTitle, start + offset, pos + 1 + offset);
    else if (ch == 92)
      escaped4 = true;
  }
  return null;
}
function parseLinkLabel(text, start, offset, requireNonWS) {
  for (let escaped4 = false, pos = start + 1, end = Math.min(text.length, pos + 999); pos < end; pos++) {
    let ch = text.charCodeAt(pos);
    if (escaped4)
      escaped4 = false;
    else if (ch == 93)
      return requireNonWS ? false : elt(Type.LinkLabel, start + offset, pos + 1 + offset);
    else {
      if (requireNonWS && !space(ch))
        requireNonWS = false;
      if (ch == 91)
        return false;
      else if (ch == 92)
        escaped4 = true;
    }
  }
  return null;
}
var InlineContext = class {
  /**
  @internal
  */
  constructor(parser2, text, offset) {
    this.parser = parser2;
    this.text = text;
    this.offset = offset;
    this.parts = [];
  }
  /**
  Get the character code at the given (document-relative)
  position.
  */
  char(pos) {
    return pos >= this.end ? -1 : this.text.charCodeAt(pos - this.offset);
  }
  /**
  The position of the end of this inline section.
  */
  get end() {
    return this.offset + this.text.length;
  }
  /**
  Get a substring of this inline section. Again uses
  document-relative positions.
  */
  slice(from, to2) {
    return this.text.slice(from - this.offset, to2 - this.offset);
  }
  /**
  @internal
  */
  append(elt2) {
    this.parts.push(elt2);
    return elt2.to;
  }
  /**
  Add a [delimiter](#DelimiterType) at this given position. `open`
  and `close` indicate whether this delimiter is opening, closing,
  or both. Returns the end of the delimiter, for convenient
  returning from [parse functions](#InlineParser.parse).
  */
  addDelimiter(type, from, to2, open, close) {
    return this.append(new InlineDelimiter(type, from, to2, (open ? 1 : 0) | (close ? 2 : 0)));
  }
  /**
  Returns true when there is an unmatched link or image opening
  token before the current position.
  */
  get hasOpenLink() {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      let part = this.parts[i];
      if (part instanceof InlineDelimiter && (part.type == LinkStart || part.type == ImageStart))
        return true;
    }
    return false;
  }
  /**
  Add an inline element. Returns the end of the element.
  */
  addElement(elt2) {
    return this.append(elt2);
  }
  /**
  Resolve markers between this.parts.length and from, wrapping matched markers in the
  appropriate node and updating the content of this.parts. @internal
  */
  resolveMarkers(from) {
    for (let i = from; i < this.parts.length; i++) {
      let close = this.parts[i];
      if (!(close instanceof InlineDelimiter && close.type.resolve && close.side & 2))
        continue;
      let emp = close.type == EmphasisUnderscore || close.type == EmphasisAsterisk;
      let closeSize = close.to - close.from;
      let open, j = i - 1;
      for (; j >= from; j--) {
        let part = this.parts[j];
        if (part instanceof InlineDelimiter && part.side & 1 && part.type == close.type && // Ignore emphasis delimiters where the character count doesn't match
        !(emp && (close.side & 1 || part.side & 2) && (part.to - part.from + closeSize) % 3 == 0 && ((part.to - part.from) % 3 || closeSize % 3))) {
          open = part;
          break;
        }
      }
      if (!open)
        continue;
      let type = close.type.resolve, content2 = [];
      let start = open.from, end = close.to;
      if (emp) {
        let size = Math.min(2, open.to - open.from, closeSize);
        start = open.to - size;
        end = close.from + size;
        type = size == 1 ? "Emphasis" : "StrongEmphasis";
      }
      if (open.type.mark)
        content2.push(this.elt(open.type.mark, start, open.to));
      for (let k = j + 1; k < i; k++) {
        if (this.parts[k] instanceof Element)
          content2.push(this.parts[k]);
        this.parts[k] = null;
      }
      if (close.type.mark)
        content2.push(this.elt(close.type.mark, close.from, end));
      let element = this.elt(type, start, end, content2);
      this.parts[j] = emp && open.from != start ? new InlineDelimiter(open.type, open.from, start, open.side) : null;
      let keep = this.parts[i] = emp && close.to != end ? new InlineDelimiter(close.type, end, close.to, close.side) : null;
      if (keep)
        this.parts.splice(i, 0, element);
      else
        this.parts[i] = element;
    }
    let result = [];
    for (let i = from; i < this.parts.length; i++) {
      let part = this.parts[i];
      if (part instanceof Element)
        result.push(part);
    }
    return result;
  }
  /**
  Find an opening delimiter of the given type. Returns `null` if
  no delimiter is found, or an index that can be passed to
  [`takeContent`](#InlineContext.takeContent) otherwise.
  */
  findOpeningDelimiter(type) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      let part = this.parts[i];
      if (part instanceof InlineDelimiter && part.type == type && part.side & 1)
        return i;
    }
    return null;
  }
  /**
  Remove all inline elements and delimiters starting from the
  given index (which you should get from
  [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter),
  resolve delimiters inside of them, and return them as an array
  of elements.
  */
  takeContent(startIndex) {
    let content2 = this.resolveMarkers(startIndex);
    this.parts.length = startIndex;
    return content2;
  }
  /**
  Return the delimiter at the given index. Mostly useful to get
  additional info out of a delimiter index returned by
  [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter).
  Returns null if there is no delimiter at this index.
  */
  getDelimiterAt(index) {
    let part = this.parts[index];
    return part instanceof InlineDelimiter ? part : null;
  }
  /**
  Skip space after the given (document) position, returning either
  the position of the next non-space character or the end of the
  section.
  */
  skipSpace(from) {
    return skipSpace(this.text, from - this.offset) + this.offset;
  }
  elt(type, from, to2, children) {
    if (typeof type == "string")
      return elt(this.parser.getNodeType(type), from, to2, children);
    return new TreeElement(type, from);
  }
};
InlineContext.linkStart = LinkStart;
InlineContext.imageStart = ImageStart;
function injectMarks(elements, marks) {
  if (!marks.length)
    return elements;
  if (!elements.length)
    return marks;
  let elts = elements.slice(), eI = 0;
  for (let mark of marks) {
    while (eI < elts.length && elts[eI].to < mark.to)
      eI++;
    if (eI < elts.length && elts[eI].from < mark.from) {
      let e = elts[eI];
      if (e instanceof Element)
        elts[eI] = new Element(e.type, e.from, e.to, injectMarks(e.children, [mark]));
    } else {
      elts.splice(eI++, 0, mark);
    }
  }
  return elts;
}
var NotLast = [Type.CodeBlock, Type.ListItem, Type.OrderedList, Type.BulletList];
var FragmentCursor = class {
  constructor(fragments, input) {
    this.fragments = fragments;
    this.input = input;
    this.i = 0;
    this.fragment = null;
    this.fragmentEnd = -1;
    this.cursor = null;
    if (fragments.length)
      this.fragment = fragments[this.i++];
  }
  nextFragment() {
    this.fragment = this.i < this.fragments.length ? this.fragments[this.i++] : null;
    this.cursor = null;
    this.fragmentEnd = -1;
  }
  moveTo(pos, lineStart) {
    while (this.fragment && this.fragment.to <= pos)
      this.nextFragment();
    if (!this.fragment || this.fragment.from > (pos ? pos - 1 : 0))
      return false;
    if (this.fragmentEnd < 0) {
      let end = this.fragment.to;
      while (end > 0 && this.input.read(end - 1, end) != "\n")
        end--;
      this.fragmentEnd = end ? end - 1 : 0;
    }
    let c = this.cursor;
    if (!c) {
      c = this.cursor = this.fragment.tree.cursor();
      c.firstChild();
    }
    let rPos = pos + this.fragment.offset;
    while (c.to <= rPos)
      if (!c.parent())
        return false;
    for (; ; ) {
      if (c.from >= rPos)
        return this.fragment.from <= lineStart;
      if (!c.childAfter(rPos))
        return false;
    }
  }
  matches(hash) {
    let tree = this.cursor.tree;
    return tree && tree.prop(NodeProp.contextHash) == hash;
  }
  takeNodes(cx) {
    let cur = this.cursor, off = this.fragment.offset, fragEnd = this.fragmentEnd - (this.fragment.openEnd ? 1 : 0);
    let start = cx.absoluteLineStart, end = start, blockI = cx.block.children.length;
    let prevEnd = end, prevI = blockI;
    for (; ; ) {
      if (cur.to - off > fragEnd) {
        if (cur.type.isAnonymous && cur.firstChild())
          continue;
        break;
      }
      let pos = toRelative(cur.from - off, cx.ranges);
      if (cur.to - off <= cx.ranges[cx.rangeI].to) {
        cx.addNode(cur.tree, pos);
      } else {
        let dummy = new Tree(cx.parser.nodeSet.types[Type.Paragraph], [], [], 0, cx.block.hashProp);
        cx.reusePlaceholders.set(dummy, cur.tree);
        cx.addNode(dummy, pos);
      }
      if (cur.type.is("Block")) {
        if (NotLast.indexOf(cur.type.id) < 0) {
          end = cur.to - off;
          blockI = cx.block.children.length;
        } else {
          end = prevEnd;
          blockI = prevI;
        }
        prevEnd = cur.to - off;
        prevI = cx.block.children.length;
      }
      if (!cur.nextSibling())
        break;
    }
    while (cx.block.children.length > blockI) {
      cx.block.children.pop();
      cx.block.positions.pop();
    }
    return end - start;
  }
};
function toRelative(abs, ranges) {
  let pos = abs;
  for (let i = 1; i < ranges.length; i++) {
    let gapFrom = ranges[i - 1].to, gapTo = ranges[i].from;
    if (gapFrom < abs)
      pos -= gapTo - gapFrom;
  }
  return pos;
}
var markdownHighlighting = styleTags({
  "Blockquote/...": tags.quote,
  HorizontalRule: tags.contentSeparator,
  "ATXHeading1/... SetextHeading1/...": tags.heading1,
  "ATXHeading2/... SetextHeading2/...": tags.heading2,
  "ATXHeading3/...": tags.heading3,
  "ATXHeading4/...": tags.heading4,
  "ATXHeading5/...": tags.heading5,
  "ATXHeading6/...": tags.heading6,
  "Comment CommentBlock": tags.comment,
  Escape: tags.escape,
  Entity: tags.character,
  "Emphasis/...": tags.emphasis,
  "StrongEmphasis/...": tags.strong,
  "Link/... Image/...": tags.link,
  "OrderedList/... BulletList/...": tags.list,
  "BlockQuote/...": tags.quote,
  "InlineCode CodeText": tags.monospace,
  "URL Autolink": tags.url,
  "HeaderMark HardBreak QuoteMark ListMark LinkMark EmphasisMark CodeMark": tags.processingInstruction,
  "CodeInfo LinkLabel": tags.labelName,
  LinkTitle: tags.string,
  Paragraph: tags.content
});
var parser = new MarkdownParser(new NodeSet(nodeTypes).extend(markdownHighlighting), Object.keys(DefaultBlockParsers).map((n) => DefaultBlockParsers[n]), Object.keys(DefaultBlockParsers).map((n) => DefaultLeafBlocks[n]), Object.keys(DefaultBlockParsers), DefaultEndLeaf, DefaultSkipMarkup, Object.keys(DefaultInline).map((n) => DefaultInline[n]), Object.keys(DefaultInline), []);
var StrikethroughDelim = { resolve: "Strikethrough", mark: "StrikethroughMark" };
var Strikethrough = {
  defineNodes: [{
    name: "Strikethrough",
    style: { "Strikethrough/...": tags.strikethrough }
  }, {
    name: "StrikethroughMark",
    style: tags.processingInstruction
  }],
  parseInline: [{
    name: "Strikethrough",
    parse(cx, next, pos) {
      if (next != 126 || cx.char(pos + 1) != 126 || cx.char(pos + 2) == 126)
        return -1;
      let before = cx.slice(pos - 1, pos), after = cx.slice(pos + 2, pos + 3);
      let sBefore = /\s|^$/.test(before), sAfter = /\s|^$/.test(after);
      let pBefore = Punctuation.test(before), pAfter = Punctuation.test(after);
      return cx.addDelimiter(StrikethroughDelim, pos, pos + 2, !sAfter && (!pAfter || sBefore || pBefore), !sBefore && (!pBefore || sAfter || pAfter));
    },
    after: "Emphasis"
  }]
};
function parseRow(cx, line, startI = 0, elts, offset = 0) {
  let count = 0, first = true, cellStart = -1, cellEnd = -1, esc = false;
  let parseCell = () => {
    elts.push(cx.elt("TableCell", offset + cellStart, offset + cellEnd, cx.parser.parseInline(line.slice(cellStart, cellEnd), offset + cellStart)));
  };
  for (let i = startI; i < line.length; i++) {
    let next = line.charCodeAt(i);
    if (next == 124 && !esc) {
      if (!first || cellStart > -1)
        count++;
      first = false;
      if (elts) {
        if (cellStart > -1)
          parseCell();
        elts.push(cx.elt("TableDelimiter", i + offset, i + offset + 1));
      }
      cellStart = cellEnd = -1;
    } else if (esc || next != 32 && next != 9) {
      if (cellStart < 0)
        cellStart = i;
      cellEnd = i + 1;
    }
    esc = !esc && next == 92;
  }
  if (cellStart > -1) {
    count++;
    if (elts)
      parseCell();
  }
  return count;
}
function hasPipe(str, start) {
  for (let i = start; i < str.length; i++) {
    let next = str.charCodeAt(i);
    if (next == 124)
      return true;
    if (next == 92)
      i++;
  }
  return false;
}
var delimiterLine = /^\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?$/;
var TableParser = class {
  constructor() {
    this.rows = null;
  }
  nextLine(cx, line, leaf) {
    if (this.rows == null) {
      this.rows = false;
      let lineText;
      if ((line.next == 45 || line.next == 58 || line.next == 124) && delimiterLine.test(lineText = line.text.slice(line.pos))) {
        let firstRow = [], firstCount = parseRow(cx, leaf.content, 0, firstRow, leaf.start);
        if (firstCount == parseRow(cx, lineText, line.pos))
          this.rows = [
            cx.elt("TableHeader", leaf.start, leaf.start + leaf.content.length, firstRow),
            cx.elt("TableDelimiter", cx.lineStart + line.pos, cx.lineStart + line.text.length)
          ];
      }
    } else if (this.rows) {
      let content2 = [];
      parseRow(cx, line.text, line.pos, content2, cx.lineStart);
      this.rows.push(cx.elt("TableRow", cx.lineStart + line.pos, cx.lineStart + line.text.length, content2));
    }
    return false;
  }
  finish(cx, leaf) {
    if (!this.rows)
      return false;
    cx.addLeafElement(leaf, cx.elt("Table", leaf.start, leaf.start + leaf.content.length, this.rows));
    return true;
  }
};
var Table = {
  defineNodes: [
    { name: "Table", block: true },
    { name: "TableHeader", style: { "TableHeader/...": tags.heading } },
    "TableRow",
    { name: "TableCell", style: tags.content },
    { name: "TableDelimiter", style: tags.processingInstruction }
  ],
  parseBlock: [{
    name: "Table",
    leaf(_, leaf) {
      return hasPipe(leaf.content, 0) ? new TableParser() : null;
    },
    endLeaf(cx, line, leaf) {
      if (leaf.parsers.some((p2) => p2 instanceof TableParser) || !hasPipe(line.text, line.basePos))
        return false;
      let next = cx.peekLine();
      return delimiterLine.test(next) && parseRow(cx, line.text, line.basePos) == parseRow(cx, next, line.basePos);
    },
    before: "SetextHeading"
  }]
};
var TaskParser = class {
  nextLine() {
    return false;
  }
  finish(cx, leaf) {
    cx.addLeafElement(leaf, cx.elt("Task", leaf.start, leaf.start + leaf.content.length, [
      cx.elt("TaskMarker", leaf.start, leaf.start + 3),
      ...cx.parser.parseInline(leaf.content.slice(3), leaf.start + 3)
    ]));
    return true;
  }
};
var TaskList = {
  defineNodes: [
    { name: "Task", block: true, style: tags.list },
    { name: "TaskMarker", style: tags.atom }
  ],
  parseBlock: [{
    name: "TaskList",
    leaf(cx, leaf) {
      return /^\[[ xX]\][ \t]/.test(leaf.content) && cx.parentType().name == "ListItem" ? new TaskParser() : null;
    },
    after: "SetextHeading"
  }]
};
function parseSubSuper(ch, node, mark) {
  return (cx, next, pos) => {
    if (next != ch || cx.char(pos + 1) == ch)
      return -1;
    let elts = [cx.elt(mark, pos, pos + 1)];
    for (let i = pos + 1; i < cx.end; i++) {
      let next2 = cx.char(i);
      if (next2 == ch)
        return cx.addElement(cx.elt(node, pos, i + 1, elts.concat(cx.elt(mark, i, i + 1))));
      if (next2 == 92)
        elts.push(cx.elt("Escape", i, i++ + 2));
      if (space(next2))
        break;
    }
    return -1;
  };
}
var Superscript = {
  defineNodes: [
    { name: "Superscript", style: tags.special(tags.content) },
    { name: "SuperscriptMark", style: tags.processingInstruction }
  ],
  parseInline: [{
    name: "Superscript",
    parse: parseSubSuper(94, "Superscript", "SuperscriptMark")
  }]
};
var Subscript = {
  defineNodes: [
    { name: "Subscript", style: tags.special(tags.content) },
    { name: "SubscriptMark", style: tags.processingInstruction }
  ],
  parseInline: [{
    name: "Subscript",
    parse: parseSubSuper(126, "Subscript", "SubscriptMark")
  }]
};
var Emoji = {
  defineNodes: [{ name: "Emoji", style: tags.character }],
  parseInline: [{
    name: "Emoji",
    parse(cx, next, pos) {
      let match;
      if (next != 58 || !(match = /^[a-zA-Z_0-9]+:/.exec(cx.slice(pos + 1, cx.end))))
        return -1;
      return cx.addElement(cx.elt("Emoji", pos, pos + 1 + match[0].length));
    }
  }]
};

// src/notation-history.ts
var import_state2 = require("@codemirror/state");
var front = (s) => /^\uFEFF?---\r?\n(?:[^\n]*\n)*?(?:---|\.\.\.)(?:\r?\n|$)/.exec(s)?.[0] ?? "";
function rawRegistries(source) {
  const excluded = [], raw = [];
  if (!source.includes("%% study-symbols")) return { raw, excluded };
  parser.parse(source).iterate({ enter: (n) => {
    if (["CodeBlock", "FencedCode", "InlineCode"].includes(n.name)) {
      excluded.push({ from: n.from, to: n.to });
      return false;
    }
  } });
  const header2 = front(source);
  if (header2) excluded.push({ from: 0, to: header2.length });
  for (const m3 of source.matchAll(/^%% study-symbols[^\n]*\n/gm)) {
    const from = m3.index;
    if (excluded.some((r) => from >= r.from && from < r.to)) continue;
    const bodyFrom = from + m3[0].length, end = /^%%[ \t]*(?:\r?$)/m.exec(source.slice(bodyFrom));
    raw.push(source.slice(from, end ? bodyFrom + end.index + end[0].length : source.length));
  }
  return { raw, excluded };
}
function propertyRaw(source) {
  editNotationReferenceProperty(source, []);
  try {
    const property = notationReferenceProperty(source);
    return property ? source.slice(property.from, property.to) : null;
  } catch {
    return null;
  }
}
function touchesNotation(before, after) {
  if (before === after) return false;
  const old = rawRegistries(before), next = rawRegistries(after);
  if (JSON.stringify(old.raw) !== JSON.stringify(next.raw)) {
    registryBlock(before, old.excluded);
    registryBlock(after, next.excluded);
    return true;
  }
  const tags2 = (source) => equations(source).flatMap((q) => markers(q.raw).map((m3) => [m3.id, m3.body]));
  if (JSON.stringify(tags2(before)) !== JSON.stringify(tags2(after))) return true;
  return front(before) !== front(after) && propertyRaw(before) !== propertyRaw(after);
}
function withAutomaticNumbering(source, edits) {
  const first = import_state2.ChangeSet.of(edits, source.length), planned = applyEdits(source, edits), numbers = numberingEdits(planned);
  if (!numbers.length) return [...edits];
  const combined = first.compose(import_state2.ChangeSet.of(numbers, planned.length)), result = [];
  combined.iterChanges((from, to2, _newFrom, _newTo, insert) => result.push({ from, to: to2, insert: insert.toString() }));
  return result;
}
function commitEquationPlan(api, input, notationWritable, nativeCommit) {
  const changed = touchesNotation(input.expectedSource, applyEdits(input.expectedSource, input.edits));
  if (changed && notationWritable) {
    if (api?.version !== 2 || api.managedHistory !== true || typeof api.applyNativeEquationPlan !== "function" || !input.path) throw Error("Matching notation history tools are required. Your draft is retained.");
    api.applyNativeEquationPlan(input);
    return "managed";
  }
  nativeCommit();
  return "native";
}

// src/editor-mount.ts
function calloutBounds(view, child) {
  if (!child.matches(".cm-callout")) return null;
  try {
    const index = Array.prototype.indexOf.call(view.contentDOM.childNodes, child);
    const from = view.posAtDOM(view.contentDOM, index), to2 = view.posAtDOM(view.contentDOM, index + 1);
    return Number.isInteger(from) && Number.isInteger(to2) && from >= 0 && to2 <= view.state.doc.length && to2 > from ? { from, to: to2 } : null;
  } catch {
    return null;
  }
}
function editorMount(view, q) {
  const empty = q.bodyFrom === q.bodyTo;
  const fallback = { at: empty ? q.from : q.to, side: empty ? -1 : 1 };
  for (const child of Array.from(view.contentDOM.children)) {
    const range = calloutBounds(view, child);
    if (range && range.from <= q.from && range.to >= q.to) return { at: range.to, side: 1 };
  }
  return sourceQuoteMount(view.state.doc.toString(), q) ?? fallback;
}
function sourceQuoteMount(source, q) {
  if (!source.includes(">")) return null;
  let outer = null;
  for (let node = parser.parse(source).resolveInner(q.from, 1); node; node = node.parent) {
    if (node.name === "Blockquote" && node.from <= q.from && node.to >= q.to) outer = { from: node.from, to: node.to };
  }
  if (!outer) return null;
  let end = outer.to;
  if (source.slice(end, end + 2) === "\r\n") end += 2;
  else if (source[end] === "\n") end++;
  return { at: end, side: end === source.length ? 1 : -1 };
}
function matchingEquation(equations2, rendered, index) {
  const normalize = (s) => s.replace(/\r\n/g, "\n").trim();
  if (index < 0 || index >= rendered.length || equations2.length !== rendered.length) return null;
  if (equations2.some((q, i) => rendered[i].body === null || q.display !== rendered[i].display || normalize(q.body) !== normalize(rendered[i].body))) return null;
  return equations2[index];
}
function editableCalloutEquations(source, equations2, offset = 0) {
  let masked = "", last = 0;
  for (const q of equations2) {
    masked += source.slice(last, q.from - offset) + q.raw.replace(/[^\r\n]/g, "x");
    last = q.to - offset;
  }
  masked += source.slice(last);
  const links = [];
  parser.parse(masked).iterate({ enter(n) {
    if (["Link", "Image", "Autolink"].includes(n.name)) {
      links.push({ from: n.from, to: n.to });
      return false;
    }
  } });
  for (const m3 of masked.matchAll(/!?\[\[[^\]\r\n]*\]\]/g)) links.push({ from: m3.index, to: m3.index + m3[0].length });
  return equations2.filter((q) => !links.some((r) => q.from - offset >= r.from && q.to - offset <= r.to));
}
function calloutEquation(view, math, equations2) {
  if (math.closest(".internal-embed,.markdown-embed,.kl-dynamic-reference,a")) return null;
  const widget = Array.from(view.contentDOM.children).find((e) => e.matches(".cm-callout") && e.contains(math));
  if (!widget) return void 0;
  const range = calloutBounds(view, widget);
  if (!range) return null;
  if (range.to - range.from > 65536) return null;
  const nodes = Array.from(widget.querySelectorAll(".math")).filter((e) => !e.closest(".internal-embed,.markdown-embed,.kl-dynamic-reference,a"));
  const target = math.closest(".math");
  const scoped = equations2.filter((q) => q.from >= range.from && q.to <= range.to);
  const editable = editableCalloutEquations(view.state.doc.sliceString(range.from, range.to), scoped, range.from);
  return matchingEquation(editable, nodes.map((e) => ({
    body: e.getAttribute("data-math-studio-latex") ?? e.querySelector(":scope > mjx-container")?.getAttribute("data-kl-source-latex") ?? e.querySelector(":scope > mjx-container > mjx-math")?.getAttribute("data-latex") ?? null,
    display: e.classList.contains("math-block")
  })), nodes.indexOf(target));
}

// src/section-lines.ts
function sectionLines(source, first, last) {
  let from = 0;
  for (let line = 0; line < first; line++) {
    const end = source.indexOf("\n", from);
    if (end < 0) return "";
    from = end + 1;
  }
  let to2 = from;
  for (let line = first; line <= last; line++) {
    const end = source.indexOf("\n", to2);
    if (end < 0) return source.slice(from);
    if (line === last) return source.slice(from, end);
    to2 = end + 1;
  }
  return "";
}

// src/build-id.ts
var BUILD_ID = "0c58b3961bc2d660";

// src/symbol-session.ts
function compatibleSymbolApi(value) {
  return value?.version === 2 && ["session", "checkTag", "planEquationSave"].every((name2) => typeof value[name2] === "function");
}
function preservesSymbolTags(initial, next) {
  const before = markers(initial), after = markers(next);
  return before.length === after.length && before.every((m3, i) => m3.id === after[i].id && semanticGlyph(m3.body) === semanticGlyph(after[i].body));
}
async function prepareSymbolSession(api, source, path) {
  if (!compatibleSymbolApi(api)) return;
  if (typeof api.prepare === "function" && path) await api.prepare(path);
  const context = api.session(source(), path);
  if (context?.version !== 2) throw Error("Study Studio returned an incompatible notation session.");
  return context;
}

// src/emphasis.ts
var EmphasisIndex = class {
  masked = "";
  tree;
  scan(source, math = equations(source)) {
    if (!math.length) {
      this.tree = void 0;
      this.masked = "";
      return [];
    }
    let masked = "", last = 0;
    for (const q of math) {
      masked += source.slice(last, q.from) + q.raw.replace(/[^\n\r]/g, "x");
      last = q.to;
    }
    masked += source.slice(last);
    let fragments = [];
    if (this.tree) {
      let from = 0, toA = this.masked.length, toB = masked.length;
      const length = Math.min(toA, toB);
      while (from + 1024 <= length && this.masked.slice(from, from + 1024) === masked.slice(from, from + 1024)) from += 1024;
      while (from < length && this.masked[from] === masked[from]) from++;
      while (toA - from >= 1024 && toB - from >= 1024 && this.masked.slice(toA - 1024, toA) === masked.slice(toB - 1024, toB)) {
        toA -= 1024;
        toB -= 1024;
      }
      while (toA > from && toB > from && this.masked[toA - 1] === masked[toB - 1]) {
        toA--;
        toB--;
      }
      fragments = TreeFragment.addTree(this.tree);
      if (from < toA || from < toB) fragments = TreeFragment.applyChanges(fragments, [{ fromA: from, toA, fromB: from, toB }]);
    }
    const tree = parser.parse(masked, fragments);
    this.masked = masked;
    this.tree = tree;
    return math.filter((q) => !q.display).flatMap((q) => {
      let strong = false, em = false;
      for (let node = tree.resolveInner(q.from + 1, 1); node; node = node.parent) {
        if (node.name === "StrongEmphasis") strong = true;
        if (node.name === "Emphasis") em = true;
      }
      return strong || em ? [{ from: q.from, to: q.to, strong, em }] : [];
    });
  }
};

// node_modules/mathlive/mathlive-ssr.min.mjs
var kl = Object.defineProperty;
var _l = Object.defineProperties;
var Cl = Object.getOwnPropertyDescriptors;
var Do = Object.getOwnPropertySymbols;
var Ll = Object.prototype.hasOwnProperty;
var Bl = Object.prototype.propertyIsEnumerable;
var zo = (t33, e, r) => e in t33 ? kl(t33, e, { enumerable: true, configurable: true, writable: true, value: r }) : t33[e] = r;
var m = (t33, e) => {
  for (var r in e || (e = {})) Ll.call(e, r) && zo(t33, r, e[r]);
  if (Do) for (var r of Do(e)) Bl.call(e, r) && zo(t33, r, e[r]);
  return t33;
};
var u = (t33, e) => _l(t33, Cl(e));
var $o = { fractionNavigationOrder: "numerator-denominator" };
var Me = [0, 0.68889, 0, 0, 0.72222];
var Bt = [0, 0.68889, 0, 0, 0.66667];
var xn = [0, 0.68889, 0, 0, 0.77778];
var Qr = [0, 0.68889, 0, 0, 0.61111];
var Eo = [0.16667, 0.68889, 0, 0, 0.77778];
var vr = [0, 0.68889, 0, 0, 0.55556];
var N = [0, 0, 0, 0, 0.25];
var Ro = [0, 0.825, 0, 0, 2.33334];
var Fo = [0, 0.9, 0, 0, 2.33334];
var ei = [0, 0.68889, 0, 0, 0.54028];
var vn = [-0.03598, 0.46402, 0, 0, 0.5];
var ue = [-0.13313, 0.36687, 0, 0, 1];
var ti = [0.01354, 0.52239, 0, 0, 1];
var Po = [0.01354, 0.52239, 0, 0, 1.11111];
var Oo = [0, 0.54986, 0, 0, 1];
var ri = [0, 0.69224, 0, 0, 0.5];
var Sn = [0, 0.43056, 0, 0, 1];
var st = [0.08198, 0.58198, 0, 0, 0.77778];
var ii = [0.19444, 0.69224, 0, 0, 0.41667];
var ni = [0.1808, 0.675, 0, 0, 1];
var qo = [0.19444, 0.69224, 0, 0, 0.83334];
var Io = [0.13667, 0.63667, 0, 0, 1];
var No = [-0.064, 0.437, 0, 0, 1.334];
var lt = [0.08167, 0.58167, 0, 0, 0.77778];
var Sr = [0, 0.69224, 0, 0, 0.72222];
var wn = [0, 0.69224, 0, 0, 0.66667];
var oi = [-0.13313, 0.36687, 0, 0, 0.77778];
var Vo = [0.06062, 0.54986, 0, 0, 0.77778];
var ai = [0, 0.69224, 0, 0, 0.77778];
var Ut = [0.25583, 0.75583, 0, 0, 0.77778];
var Ie = [0.25142, 0.75726, 0, 0, 0.77778];
var Zt = [0.20576, 0.70576, 0, 0, 0.77778];
var Le = [0.30274, 0.79383, 0, 0, 0.77778];
var wr = [0.22958, 0.72958, 0, 0, 0.77778];
var Jo = [0.1808, 0.675, 0, 0, 0.77778];
var Ne = [0.13667, 0.63667, 0, 0, 0.77778];
var fe = [0.13597, 0.63597, 0, 0, 0.77778];
var ct = [0.03517, 0.54986, 0, 0, 0.77778];
var jt = [0, 0.675, 0, 0, 0.77778];
var Ho = [0.19444, 0.69224, 0, 0, 0.61111];
var Go = [0, 0.54986, 0, 0, 0.76042];
var Wo = [0, 0.54986, 0, 0, 0.66667];
var mt = [0.0391, 0.5391, 0, 0, 0.77778];
var Uo = [0.03517, 0.54986, 0, 0, 1.33334];
var Zo = [0.38569, 0.88569, 0, 0, 0.77778];
var si = [0.23222, 0.74111, 0, 0, 0.77778];
var jo = [0.19444, 0.69224, 0, 0, 0.77778];
var Xo = [0, 0.37788, 0, 0, 0.5];
var li = [0, 0.54986, 0, 0, 0.72222];
var Ko = [0, 0.69224, 0, 0, 0.83334];
var Yo = [0.11111, 0.69224, 0, 0, 0.66667];
var Xt = [0.26167, 0.75726, 0, 0, 0.77778];
var Qo = [0.48256, 0.98256, 0, 0, 0.77778];
var ea = [0.28481, 0.79383, 0, 0, 0.77778];
var ta = [0.08167, 0.58167, 0, 0, 0.22222];
var ra = [0.08167, 0.58167, 0, 0, 0.38889];
var ia = [0, 0.43056, 0.04028, 0, 0.66667];
var na = [0.41951, 0.91951, 0, 0, 0.77778];
var oa = [0.24982, 0.74947, 0, 0, 0.38865];
var aa = [0.08319, 0.58283, 0, 0, 0.75623];
var sa = [0, 0.10803, 0, 0, 0.27764];
var Mn = [0, 0.47534, 0, 0, 0.50181];
var Mr = [0.18906, 0.47534, 0, 0, 0.50181];
var la = [0, 0.69141, 0, 0, 0.50181];
var ca = [0.24982, 0.74947, 0, 0, 0.27764];
var An = [0, 0.69141, 0, 0, 0.21471];
var ci = [0.25, 0.75, 0, 0, 0.44722];
var Ae = [0, 0.64444, 0, 0, 0.575];
var Kt = [0.08556, 0.58556, 0, 0, 0.89444];
var mi = [0, 0.69444, 0, 0, 0.89444];
var ui = [0, 0.68611, 0, 0, 0.9];
var kn = [0, 0.68611, 0, 0, 0.86944];
var ut = [0.25, 0.75, 0, 0, 0.575];
var hi = [0.25, 0.75, 0, 0, 0.31944];
var Tt = [0, 0.69444, 0, 0, 0.63889];
var Yt = [0, 0.69444, 0, 0, 0.31944];
var ma = [0, 0.44444, 0, 0, 0.63889];
var ua = [0, 0.44444, 0, 0, 0.51111];
var ht = [0, 0.69444, 0, 0, 0.575];
var Be = [0.13333, 0.63333, 0, 0, 0.89444];
var ha = [0, 0.44444, 0, 0, 0.31944];
var da = [0, 0.69444, 0, 0, 0.86944];
var pa = [0, 0.68611, 0, 0, 0.69166];
var di = [0, 0.68611, 0, 0, 0.83055];
var _n = [0, 0.68611, 0, 0, 0.89444];
var Cn = [0, 0.69444, 0, 0, 0.60278];
var fa = [0.19444, 0.69444, 0, 0, 0.51111];
var ga = [0, 0.69444, 0, 0, 0.83055];
var Ve = [-0.10889, 0.39111, 0, 0, 1.14999];
var ya = [0.19444, 0.69444, 0, 0, 0.575];
var Ar = [0.19444, 0.69444, 0, 0, 1.14999];
var ba = [0.19444, 0.69444, 0, 0, 0.70277];
var xa = [0.05556, 0.75, 0, 0, 0.575];
var Ln = [0, 0.68611, 0, 0, 0.95833];
var va = [0.08556, 0.58556, 0, 0, 0.76666];
var Bn = [-0.02639, 0.47361, 0, 0, 0.575];
var Sa = [0, 0.44444, 0, 0, 0.89444];
var Dt = [0, 0.55556, 0, 0, 0.76666];
var wa = [-0.10889, 0.39111, 0, 0, 0.89444];
var Tn = [222e-5, 0.50222, 0, 0, 0.89444];
var dt = [0.19667, 0.69667, 0, 0, 0.89444];
var Ma = [0.08556, 0.58556, 0, 0, 1.14999];
var Dn = [0, 0.69444, 0, 0, 0.70277];
var pi = [-0.02778, 0.47222, 0, 0, 0.575];
var fi = [0.25, 0.75, 0, 0, 0.51111];
var Aa = [-0.13889, 0.36111, 0, 0, 1.14999];
var ka = [0.19444, 0.69444, 0, 0, 1.02222];
var gi = [0.12963, 0.69444, 0, 0, 0.89444];
var _a = [0.19444, 0.69444, 0, 0, 0.44722];
var pt = [0, 0.64444, 0.13167, 0, 0.59111];
var Ca = [0.19444, 0.64444, 0.13167, 0, 0.59111];
var zn = [0, 0.68611, 0.17208, 0, 0.8961];
var La = [0.19444, 0.44444, 0.105, 0, 0.53222];
var Ba = [0, 0.44444, 0.085, 0, 0.82666];
var Ta = [0, 0.69444, 0.06709, 0, 0.59111];
var yi = [0, 0.69444, 0.12945, 0, 0.35555];
var Da = [0, 0.69444, 0, 0, 0.94888];
var $n = [0, 0.69444, 0.11472, 0, 0.59111];
var za = [0, 0.68611, 0.10778, 0, 0.88555];
var $a = [0, 0.69444, 0.07939, 0, 0.62055];
var bi = [0, 0.69444, 0.12417, 0, 0.30667];
var ft = [0, 0.64444, 0.13556, 0, 0.51111];
var Ea = [0.19444, 0.64444, 0.13556, 0, 0.51111];
var xi = [0, 0.68333, 0.16389, 0, 0.74333];
var Ra = [0.19444, 0.43056, 0.08847, 0, 0.46];
var Fa = [0, 0.43056, 0.07514, 0, 0.71555];
var Pa = [0, 0.69444, 0.06646, 0, 0.51111];
var Oa = [0, 0.69444, 0, 0, 0.83129];
var qa = [0, 0.69444, 0.1225, 0, 0.51111];
var Ia = [0, 0.68333, 0.09403, 0, 0.76666];
var Na = [0, 0.68333, 0.11111, 0, 0.76666];
var Va = [0, 0.69444, 0.06961, 0, 0.51444];
var Ye = [0, 0.69444, 0, 0, 0.27778];
var Qt = [0.25, 0.75, 0, 0, 0.38889];
var ke = [0, 0.64444, 0, 0, 0.5];
var zt = [0, 0.69444, 0, 0, 0.77778];
var $t = [0, 0.68333, 0, 0, 0.75];
var kr = [0, 0.68333, 0, 0, 0.77778];
var Ja = [0, 0.68333, 0, 0, 0.68056];
var _r = [0, 0.68333, 0, 0, 0.72222];
var Qe = [0.25, 0.75, 0, 0, 0.5];
var vi = [0.25, 0.75, 0, 0, 0.27778];
var re = [0, 0.69444, 0, 0, 0.5];
var er = [0, 0.69444, 0, 0, 0.55556];
var En = [0, 0.43056, 0, 0, 0.44445];
var Cr = [0, 0.43056, 0, 0, 0.5];
var Ha = [0.19444, 0.43056, 0, 0, 0.55556];
var Ga = [0, 0.43056, 0, 0, 0.55556];
var _e = [0.08333, 0.58333, 0, 0, 0.77778];
var Wa = [0, 0.43056, 0, 0, 0.27778];
var Ua = [0, 0.66786, 0, 0, 0.27778];
var Za = [0, 0.69444, 0, 0, 0.75];
var ja = [0, 0.66786, 0, 0, 0.5];
var Xa = [0, 0.68333, 0, 0, 0.625];
var Rn = [0.19444, 0.69444, 0, 0, 0.44445];
var Lr = [0, 0.69444, 0, 0, 0.72222];
var Ka = [0.19444, 0.69444, 0, 0, 0.5];
var Br = [0.19444, 0.69444, 0, 0, 1];
var Ya = [0.011, 0.511, 0, 0, 1.126];
var Fn = [0.19444, 0.69444, 0, 0, 0.61111];
var Pn = [0.05556, 0.75, 0, 0, 0.5];
var Qa = [0, 0.68333, 0, 0, 0.83334];
var es = [0.0391, 0.5391, 0, 0, 0.66667];
var On = [-0.05555, 0.44445, 0, 0, 0.5];
var ts = [0, 0.43056, 0, 0, 0.77778];
var Et = [0, 0.55556, 0, 0, 0.66667];
var Si = [-0.03625, 0.46375, 0, 0, 0.77778];
var rs = [-0.01688, 0.48312, 0, 0, 0.77778];
var is = [0.0391, 0.5391, 0, 0, 1];
var gt = [0, 0.69444, 0, 0, 0.61111];
var wi = [-0.03472, 0.46528, 0, 0, 0.5];
var Mi = [0.25, 0.75, 0, 0, 0.44445];
var ns = [-0.14236, 0.35764, 0, 0, 1];
var Ai = [0.244, 0.744, 0, 0, 0.412];
var os = [0.19444, 0.69444, 0, 0, 0.88889];
var ki = [0.12963, 0.69444, 0, 0, 0.77778];
var as = [0.19444, 0.69444, 0, 0, 0.38889];
var ss = [0.011, 0.511, 0, 0, 1.638];
var ls = [0.19444, 0.69444, 0, 0, 0];
var _i = [0, 0.44444, 0, 0, 0.575];
var Tr = [0.19444, 0.44444, 0, 0, 0.575];
var cs = [0, 0.68611, 0, 0, 0.75555];
var ms = [0, 0.69444, 0, 0, 0.66759];
var us = [0, 0.68611, 0, 0, 0.80555];
var hs = [0, 0.68611, 0.08229, 0, 0.98229];
var ds = [0, 0.68611, 0, 0, 0.76666];
var ps = [0, 0.44444, 0, 0, 0.58472];
var fs = [0.19444, 0.44444, 0, 0, 0.6118];
var Dr = [0.19444, 0.43056, 0, 0, 0.5];
var gs = [0, 0.68333, 0.02778, 0.08334, 0.76278];
var ys = [0, 0.68333, 0.08125, 0.05556, 0.83125];
var bs = [0, 0.43056, 0, 0.05556, 0.48472];
var xs = [0.19444, 0.43056, 0, 0.08334, 0.51702];
var vs = [0.25, 0.75, 0, 0, 0.42778];
var le = [0, 0.69444, 0, 0, 0.55];
var et = [0, 0.69444, 0, 0, 0.73334];
var yt = [0, 0.69444, 0, 0, 0.79445];
var Ss = [0, 0.69444, 0, 0, 0.51945];
var qn = [0, 0.69444, 0, 0, 0.70278];
var ws = [0, 0.69444, 0, 0, 0.76389];
var Ms = [0.25, 0.75, 0, 0, 0.34306];
var In = [0, 0.69444, 0, 0, 0.56111];
var As = [0, 0.69444, 0, 0, 0.25556];
var ks = [0.19444, 0.45833, 0, 0, 0.56111];
var _s = [0, 0.45833, 0, 0, 0.56111];
var Ci = [0, 0.69444, 0, 0, 0.30556];
var Cs = [0, 0.69444, 0, 0, 0.58056];
var Ls = [0, 0.69444, 0, 0, 0.67223];
var Nn = [0, 0.69444, 0, 0, 0.85556];
var Vn = [0, 0.69444, 0, 0, 0.55834];
var Je = [0, 0.65556, 0.11156, 0, 0.5];
var Jn = [0, 0.69444, 0.08094, 0, 0.70834];
var Hn = [0.17014, 0, 0, 0, 0.44445];
var Bs = [0, 0.69444, 0.0799, 0, 0.5];
var Ts = [0, 0.69444, 0, 0, 0.73752];
var Ds = [0, 0.69444, 0.09205, 0, 0.5];
var zs = [0, 0.69444, 0.09031, 0, 0.77778];
var Gn = [0, 0.69444, 0.07816, 0, 0.27778];
var $s = [0, 0.69444, 316e-5, 0, 0.5];
var Es = [0.19444, 0.69444, 0, 0, 0.83334];
var Rs = [0.05556, 0.75, 0, 0, 0.83334];
var Fs = [0, 0.75, 0, 0, 0.5];
var Ps = [0.125, 0.08333, 0, 0, 0.27778];
var Os = [0, 0.08333, 0, 0, 0.27778];
var He = [0, 0.65556, 0, 0, 0.5];
var Wn = [0, 0.69444, 0, 0, 0.47222];
var tt = [0, 0.69444, 0, 0, 0.66667];
var qs = [0, 0.69444, 0, 0, 0.59722];
var Un = [0, 0.69444, 0, 0, 0.54167];
var Zn = [0, 0.69444, 0, 0, 0.70834];
var Is = [0.25, 0.75, 0, 0, 0.28889];
var jn = [0, 0.69444, 0, 0, 0.51667];
var Ns = [0, 0.44444, 0, 0, 0.44445];
var Vs = [0.19444, 0.44444, 0, 0, 0.51667];
var Js = [0, 0.44444, 0, 0, 0.38333];
var Hs = [0, 0.44444, 0, 0, 0.51667];
var Gs = [0, 0.69444, 0, 0, 0.83334];
var Ws = [0.35001, 0.85, 0, 0, 0.45834];
var Us = [0.35001, 0.85, 0, 0, 0.57778];
var Zs = [0.35001, 0.85, 0, 0, 0.41667];
var js = [0.35001, 0.85, 0, 0, 0.58334];
var Li = [0, 0.72222, 0, 0, 0.55556];
var Xs = [1e-5, 0.6, 0, 0, 0.66667];
var Ks = [1e-5, 0.6, 0, 0, 0.77778];
var Ys = [0.25001, 0.75, 0, 0, 0.94445];
var Qs = [0.306, 0.805, 0.19445, 0, 0.47222];
var e0 = [0.30612, 0.805, 0.19445, 0, 0.47222];
var tr = [0.25001, 0.75, 0, 0, 0.83334];
var rr = [0.35001, 0.85, 0, 0, 0.47222];
var Xn = [0.25001, 0.75, 0, 0, 1.11111];
var t0 = [0.65002, 1.15, 0, 0, 0.59722];
var r0 = [0.65002, 1.15, 0, 0, 0.81111];
var i0 = [0.65002, 1.15, 0, 0, 0.47222];
var n0 = [0.65002, 1.15, 0, 0, 0.66667];
var Bi = [0, 0.75, 0, 0, 1];
var o0 = [0.55001, 1.05, 0, 0, 1.27778];
var a0 = [0.862, 1.36, 0.44445, 0, 0.55556];
var s0 = [0.86225, 1.36, 0.44445, 0, 0.55556];
var ir = [0.55001, 1.05, 0, 0, 1.11111];
var Ti = [0.65002, 1.15, 0, 0, 0.52778];
var l0 = [0.65002, 1.15, 0, 0, 0.61111];
var Kn = [0.55001, 1.05, 0, 0, 1.51112];
var c0 = [0.95003, 1.45, 0, 0, 0.73611];
var m0 = [0.95003, 1.45, 0, 0, 1.04445];
var u0 = [0.95003, 1.45, 0, 0, 0.52778];
var Di = [0.95003, 1.45, 0, 0, 0.75];
var zi = [0, 0.75, 0, 0, 1.44445];
var $i = [0.95003, 1.45, 0, 0, 0.58334];
var h0 = [1.25003, 1.75, 0, 0, 0.79167];
var d0 = [1.25003, 1.75, 0, 0, 1.27778];
var p0 = [1.25003, 1.75, 0, 0, 0.58334];
var Ei = [1.25003, 1.75, 0, 0, 0.80556];
var Ri = [0, 0.825, 0, 0, 1.8889];
var Fi = [1.25003, 1.75, 0, 0, 0.63889];
var Pi = [0.64502, 1.155, 0, 0, 0.875];
var f0 = [1e-5, 0.6, 0, 0, 0.875];
var Yn = [-99e-5, 0.601, 0, 0, 0.66667];
var Oi = [0.64502, 1.155, 0, 0, 0.66667];
var g0 = [1e-5, 0.9, 0, 0, 0.88889];
var y0 = [0.65002, 1.15, 0, 0, 0.88889];
var b0 = [0.90001, 0, 0, 0, 0.88889];
var x0 = [-499e-5, 0.605, 0, 0, 1.05556];
var qi = [0, 0.12, 0, 0, 0.45];
var C = [0, 0.61111, 0, 0, 0.525];
var Te = [0.08333, 0.69444, 0, 0, 0.525];
var v0 = [-0.08056, 0.53055, 0, 0, 0.525];
var S0 = [-0.05556, 0.55556, 0, 0, 0.525];
var he = [0, 0.43056, 0, 0, 0.525];
var zr = [0.22222, 0.43056, 0, 0, 0.525];
var w0 = [0, 0, 0, 0, 0.525];
var M0 = { "AMS-Regular": { 32: N, 65: Me, 66: Bt, 67: Me, 68: Me, 69: Bt, 70: Qr, 71: xn, 72: xn, 73: [0, 0.68889, 0, 0, 0.38889], 74: [0.16667, 0.68889, 0, 0, 0.5], 75: xn, 76: Bt, 77: [0, 0.68889, 0, 0, 0.94445], 78: Me, 79: Eo, 80: Qr, 81: Eo, 82: Me, 83: vr, 84: Bt, 85: Me, 86: Me, 87: [0, 0.68889, 0, 0, 1], 88: Me, 89: Me, 90: Bt, 107: vr, 160: N, 165: [0, 0.675, 0.025, 0, 0.75], 174: [0.15559, 0.69224, 0, 0, 0.94666], 240: vr, 295: ei, 710: Ro, 732: Fo, 770: Ro, 771: Fo, 989: lt, 1008: ia, 8245: [0, 0.54986, 0, 0, 0.275], 8463: ei, 8487: Me, 8498: vr, 8502: Bt, 8503: [0, 0.68889, 0, 0, 0.44445], 8504: Bt, 8513: [0, 0.68889, 0, 0, 0.63889], 8592: vn, 8594: vn, 8602: ue, 8603: ue, 8606: ti, 8608: ti, 8610: Po, 8611: Po, 8619: Oo, 8620: Oo, 8621: [-0.13313, 0.37788, 0, 0, 1.38889], 8622: ue, 8624: ri, 8625: ri, 8630: Sn, 8631: Sn, 8634: st, 8635: st, 8638: ii, 8639: ii, 8642: ii, 8643: ii, 8644: ni, 8646: ni, 8647: ni, 8648: qo, 8649: ni, 8650: qo, 8651: ti, 8652: ti, 8653: ue, 8654: ue, 8655: ue, 8666: Io, 8667: Io, 8669: [-0.13313, 0.37788, 0, 0, 1], 8672: No, 8674: No, 8705: [0, 0.825, 0, 0, 0.5], 8708: vr, 8709: lt, 8717: [0, 0.43056, 0, 0, 0.42917], 8722: vn, 8724: [0.08198, 0.69224, 0, 0, 0.77778], 8726: lt, 8733: ai, 8736: Sr, 8737: Sr, 8738: [0.03517, 0.52239, 0, 0, 0.72222], 8739: ta, 8740: [0.25142, 0.74111, 0, 0, 0.27778], 8741: ra, 8742: [0.25142, 0.74111, 0, 0, 0.5], 8756: wn, 8757: wn, 8764: oi, 8765: [-0.13313, 0.37788, 0, 0, 0.77778], 8769: oi, 8770: Si, 8774: Le, 8776: rs, 8778: lt, 8782: Vo, 8783: Vo, 8785: st, 8786: st, 8787: st, 8790: ai, 8791: wr, 8796: [0.08198, 0.91667, 0, 0, 0.77778], 8806: Ut, 8807: Ut, 8808: Ie, 8809: Ie, 8812: [0.25583, 0.75583, 0, 0, 0.5], 8814: Zt, 8815: Zt, 8816: Le, 8817: Le, 8818: wr, 8819: wr, 8822: Jo, 8823: Jo, 8828: Ne, 8829: Ne, 8830: wr, 8831: wr, 8832: Zt, 8833: Zt, 8840: Le, 8841: Le, 8842: fe, 8843: fe, 8847: ct, 8848: ct, 8858: st, 8859: st, 8861: st, 8862: jt, 8863: jt, 8864: jt, 8865: jt, 8872: [0, 0.69224, 0, 0, 0.61111], 8873: Sr, 8874: [0, 0.69224, 0, 0, 0.88889], 8876: Qr, 8877: Qr, 8878: Me, 8879: Me, 8882: ct, 8883: ct, 8884: Ne, 8885: Ne, 8888: [0, 0.54986, 0, 0, 1.11111], 8890: Ha, 8891: Ho, 8892: Ho, 8901: [0, 0.54986, 0, 0, 0.27778], 8903: lt, 8905: lt, 8906: lt, 8907: ai, 8908: ai, 8909: [-0.03598, 0.46402, 0, 0, 0.77778], 8910: Go, 8911: Go, 8912: ct, 8913: ct, 8914: Wo, 8915: Wo, 8916: wn, 8918: mt, 8919: mt, 8920: Uo, 8921: Uo, 8922: Zo, 8923: Zo, 8926: Ne, 8927: Ne, 8928: Le, 8929: Le, 8934: si, 8935: si, 8936: si, 8937: si, 8938: Zt, 8939: Zt, 8940: Le, 8941: Le, 8994: jo, 8995: jo, 9416: [0.15559, 0.69224, 0, 0, 0.90222], 9484: ri, 9488: ri, 9492: Xo, 9496: Xo, 9585: [0.19444, 0.68889, 0, 0, 0.88889], 9586: [0.19444, 0.74111, 0, 0, 0.88889], 9632: jt, 9633: jt, 9650: li, 9651: li, 9654: ct, 9660: li, 9661: li, 9664: ct, 9674: Yo, 9733: [0.19444, 0.69224, 0, 0, 0.94445], 10003: Ko, 10016: Ko, 10731: Yo, 10846: [0.19444, 0.75583, 0, 0, 0.61111], 10877: Ne, 10878: Ne, 10885: Ut, 10886: Ut, 10887: fe, 10888: fe, 10889: Xt, 10890: Xt, 10891: Qo, 10892: Qo, 10901: Ne, 10902: Ne, 10933: Ie, 10934: Ie, 10935: Xt, 10936: Xt, 10937: Xt, 10938: Xt, 10949: Ut, 10950: Ut, 10955: ea, 10956: ea, 57350: ta, 57351: ra, 57352: lt, 57353: ia, 57356: Ie, 57357: Ie, 57358: na, 57359: Le, 57360: Le, 57361: na, 57366: Ie, 57367: Ie, 57368: Ie, 57369: Ie, 57370: fe, 57371: fe }, "Caligraphic-Regular": { 32: N, 65: [0, 0.68333, 0, 0.19445, 0.79847], 66: [0, 0.68333, 0.03041, 0.13889, 0.65681], 67: [0, 0.68333, 0.05834, 0.13889, 0.52653], 68: [0, 0.68333, 0.02778, 0.08334, 0.77139], 69: [0, 0.68333, 0.08944, 0.11111, 0.52778], 70: [0, 0.68333, 0.09931, 0.11111, 0.71875], 71: [0.09722, 0.68333, 0.0593, 0.11111, 0.59487], 72: [0, 0.68333, 965e-5, 0.11111, 0.84452], 73: [0, 0.68333, 0.07382, 0, 0.54452], 74: [0.09722, 0.68333, 0.18472, 0.16667, 0.67778], 75: [0, 0.68333, 0.01445, 0.05556, 0.76195], 76: [0, 0.68333, 0, 0.13889, 0.68972], 77: [0, 0.68333, 0, 0.13889, 1.2009], 78: [0, 0.68333, 0.14736, 0.08334, 0.82049], 79: [0, 0.68333, 0.02778, 0.11111, 0.79611], 80: [0, 0.68333, 0.08222, 0.08334, 0.69556], 81: [0.09722, 0.68333, 0, 0.11111, 0.81667], 82: [0, 0.68333, 0, 0.08334, 0.8475], 83: [0, 0.68333, 0.075, 0.13889, 0.60556], 84: [0, 0.68333, 0.25417, 0, 0.54464], 85: [0, 0.68333, 0.09931, 0.08334, 0.62583], 86: [0, 0.68333, 0.08222, 0, 0.61278], 87: [0, 0.68333, 0.08222, 0.08334, 0.98778], 88: [0, 0.68333, 0.14643, 0.13889, 0.7133], 89: [0.09722, 0.68333, 0.08222, 0.08334, 0.66834], 90: [0, 0.68333, 0.07944, 0.13889, 0.72473], 160: N }, "Fraktur-Regular": { 32: N, 33: [0, 0.69141, 0, 0, 0.29574], 34: An, 38: [0, 0.69141, 0, 0, 0.73786], 39: [0, 0.69141, 0, 0, 0.21201], 40: oa, 41: oa, 42: [0, 0.62119, 0, 0, 0.27764], 43: aa, 44: sa, 45: aa, 46: sa, 47: [0.24982, 0.74947, 0, 0, 0.50181], 48: Mn, 49: Mn, 50: Mn, 51: Mr, 52: Mr, 53: Mr, 54: la, 55: Mr, 56: la, 57: Mr, 58: [0, 0.47534, 0, 0, 0.21606], 59: [0.12604, 0.47534, 0, 0, 0.21606], 61: [-0.13099, 0.36866, 0, 0, 0.75623], 63: [0, 0.69141, 0, 0, 0.36245], 65: [0, 0.69141, 0, 0, 0.7176], 66: [0, 0.69141, 0, 0, 0.88397], 67: [0, 0.69141, 0, 0, 0.61254], 68: [0, 0.69141, 0, 0, 0.83158], 69: [0, 0.69141, 0, 0, 0.66278], 70: [0.12604, 0.69141, 0, 0, 0.61119], 71: [0, 0.69141, 0, 0, 0.78539], 72: [0.06302, 0.69141, 0, 0, 0.7203], 73: [0, 0.69141, 0, 0, 0.55448], 74: [0.12604, 0.69141, 0, 0, 0.55231], 75: [0, 0.69141, 0, 0, 0.66845], 76: [0, 0.69141, 0, 0, 0.66602], 77: [0, 0.69141, 0, 0, 1.04953], 78: [0, 0.69141, 0, 0, 0.83212], 79: [0, 0.69141, 0, 0, 0.82699], 80: [0.18906, 0.69141, 0, 0, 0.82753], 81: [0.03781, 0.69141, 0, 0, 0.82699], 82: [0, 0.69141, 0, 0, 0.82807], 83: [0, 0.69141, 0, 0, 0.82861], 84: [0, 0.69141, 0, 0, 0.66899], 85: [0, 0.69141, 0, 0, 0.64576], 86: [0, 0.69141, 0, 0, 0.83131], 87: [0, 0.69141, 0, 0, 1.04602], 88: [0, 0.69141, 0, 0, 0.71922], 89: [0.18906, 0.69141, 0, 0, 0.83293], 90: [0.12604, 0.69141, 0, 0, 0.60201], 91: ca, 93: ca, 94: [0, 0.69141, 0, 0, 0.49965], 97: [0, 0.47534, 0, 0, 0.50046], 98: [0, 0.69141, 0, 0, 0.51315], 99: [0, 0.47534, 0, 0, 0.38946], 100: [0, 0.62119, 0, 0, 0.49857], 101: [0, 0.47534, 0, 0, 0.40053], 102: [0.18906, 0.69141, 0, 0, 0.32626], 103: [0.18906, 0.47534, 0, 0, 0.5037], 104: [0.18906, 0.69141, 0, 0, 0.52126], 105: [0, 0.69141, 0, 0, 0.27899], 106: [0, 0.69141, 0, 0, 0.28088], 107: [0, 0.69141, 0, 0, 0.38946], 108: [0, 0.69141, 0, 0, 0.27953], 109: [0, 0.47534, 0, 0, 0.76676], 110: [0, 0.47534, 0, 0, 0.52666], 111: [0, 0.47534, 0, 0, 0.48885], 112: [0.18906, 0.52396, 0, 0, 0.50046], 113: [0.18906, 0.47534, 0, 0, 0.48912], 114: [0, 0.47534, 0, 0, 0.38919], 115: [0, 0.47534, 0, 0, 0.44266], 116: [0, 0.62119, 0, 0, 0.33301], 117: [0, 0.47534, 0, 0, 0.5172], 118: [0, 0.52396, 0, 0, 0.5118], 119: [0, 0.52396, 0, 0, 0.77351], 120: [0.18906, 0.47534, 0, 0, 0.38865], 121: [0.18906, 0.47534, 0, 0, 0.49884], 122: [0.18906, 0.47534, 0, 0, 0.39054], 160: N, 8216: An, 8217: An, 58112: [0, 0.62119, 0, 0, 0.49749], 58113: [0, 0.62119, 0, 0, 0.4983], 58114: [0.18906, 0.69141, 0, 0, 0.33328], 58115: [0.18906, 0.69141, 0, 0, 0.32923], 58116: [0.18906, 0.47534, 0, 0, 0.50343], 58117: [0, 0.69141, 0, 0, 0.33301], 58118: [0, 0.62119, 0, 0, 0.33409], 58119: [0, 0.47534, 0, 0, 0.50073] }, "Main-Bold": { 32: N, 33: [0, 0.69444, 0, 0, 0.35], 34: Cn, 35: [0.19444, 0.69444, 0, 0, 0.95833], 36: xa, 37: [0.05556, 0.75, 0, 0, 0.95833], 38: mi, 39: Yt, 40: ci, 41: ci, 42: [0, 0.75, 0, 0, 0.575], 43: Be, 44: [0.19444, 0.15556, 0, 0, 0.31944], 45: Js, 46: [0, 0.15556, 0, 0, 0.31944], 47: ut, 48: Ae, 49: Ae, 50: Ae, 51: Ae, 52: Ae, 53: Ae, 54: Ae, 55: Ae, 56: Ae, 57: Ae, 58: ha, 59: [0.19444, 0.44444, 0, 0, 0.31944], 60: Kt, 61: wa, 62: Kt, 63: [0, 0.69444, 0, 0, 0.54305], 64: mi, 65: kn, 66: [0, 0.68611, 0, 0, 0.81805], 67: di, 68: [0, 0.68611, 0, 0, 0.88194], 69: cs, 70: [0, 0.68611, 0, 0, 0.72361], 71: [0, 0.68611, 0, 0, 0.90416], 72: ui, 73: [0, 0.68611, 0, 0, 0.43611], 74: [0, 0.68611, 0, 0, 0.59444], 75: [0, 0.68611, 0, 0, 0.90138], 76: pa, 77: [0, 0.68611, 0, 0, 1.09166], 78: ui, 79: [0, 0.68611, 0, 0, 0.86388], 80: [0, 0.68611, 0, 0, 0.78611], 81: [0.19444, 0.68611, 0, 0, 0.86388], 82: [0, 0.68611, 0, 0, 0.8625], 83: [0, 0.68611, 0, 0, 0.63889], 84: [0, 0.68611, 0, 0, 0.8], 85: [0, 0.68611, 0, 0, 0.88472], 86: [0, 0.68611, 0.01597, 0, 0.86944], 87: [0, 0.68611, 0.01597, 0, 1.18888], 88: kn, 89: [0, 0.68611, 0.02875, 0, 0.86944], 90: [0, 0.68611, 0, 0, 0.70277], 91: hi, 92: ut, 93: hi, 94: ht, 95: [0.31, 0.13444, 0.03194, 0, 0.575], 97: [0, 0.44444, 0, 0, 0.55902], 98: Tt, 99: ua, 100: Tt, 101: [0, 0.44444, 0, 0, 0.52708], 102: [0, 0.69444, 0.10903, 0, 0.35139], 103: [0.19444, 0.44444, 0.01597, 0, 0.575], 104: Tt, 105: Yt, 106: [0.19444, 0.69444, 0, 0, 0.35139], 107: [0, 0.69444, 0, 0, 0.60694], 108: Yt, 109: [0, 0.44444, 0, 0, 0.95833], 110: ma, 111: _i, 112: [0.19444, 0.44444, 0, 0, 0.63889], 113: [0.19444, 0.44444, 0, 0, 0.60694], 114: [0, 0.44444, 0, 0, 0.47361], 115: [0, 0.44444, 0, 0, 0.45361], 116: [0, 0.63492, 0, 0, 0.44722], 117: ma, 118: [0, 0.44444, 0.01597, 0, 0.60694], 119: [0, 0.44444, 0.01597, 0, 0.83055], 120: [0, 0.44444, 0, 0, 0.60694], 121: [0.19444, 0.44444, 0.01597, 0, 0.60694], 122: ua, 123: ut, 124: hi, 125: ut, 126: [0.35, 0.34444, 0, 0, 0.575], 160: N, 163: [0, 0.69444, 0, 0, 0.86853], 168: ht, 172: [0, 0.44444, 0, 0, 0.76666], 176: da, 177: Be, 184: [0.17014, 0, 0, 0, 0.51111], 198: [0, 0.68611, 0, 0, 1.04166], 215: Be, 216: [0.04861, 0.73472, 0, 0, 0.89444], 223: qs, 230: [0, 0.44444, 0, 0, 0.83055], 247: Be, 248: [0.09722, 0.54167, 0, 0, 0.575], 305: ha, 338: [0, 0.68611, 0, 0, 1.16944], 339: Sa, 567: [0.19444, 0.44444, 0, 0, 0.35139], 710: ht, 711: [0, 0.63194, 0, 0, 0.575], 713: [0, 0.59611, 0, 0, 0.575], 714: ht, 715: ht, 728: ht, 729: Yt, 730: da, 732: ht, 733: ht, 915: pa, 916: Ln, 920: _n, 923: us, 926: ds, 928: ui, 931: di, 933: _n, 934: di, 936: _n, 937: di, 8211: [0, 0.44444, 0.03194, 0, 0.575], 8212: [0, 0.44444, 0.03194, 0, 1.14999], 8216: Yt, 8217: Yt, 8220: Cn, 8221: Cn, 8224: fa, 8225: fa, 8242: [0, 0.55556, 0, 0, 0.34444], 8407: [0, 0.72444, 0.15486, 0, 0.575], 8463: ms, 8465: ga, 8467: [0, 0.69444, 0, 0, 0.47361], 8472: [0.19444, 0.44444, 0, 0, 0.74027], 8476: ga, 8501: Dn, 8592: Ve, 8593: ya, 8594: Ve, 8595: ya, 8596: Ve, 8597: ut, 8598: Ar, 8599: Ar, 8600: Ar, 8601: Ar, 8636: Ve, 8637: Ve, 8640: Ve, 8641: Ve, 8656: Ve, 8657: ba, 8658: Ve, 8659: ba, 8660: Ve, 8661: [0.25, 0.75, 0, 0, 0.70277], 8704: Tt, 8706: [0, 0.69444, 0.06389, 0, 0.62847], 8707: Tt, 8709: xa, 8711: Ln, 8712: va, 8715: va, 8722: Be, 8723: Be, 8725: ut, 8726: ut, 8727: pi, 8728: Bn, 8729: Bn, 8730: [0.18, 0.82, 0, 0, 0.95833], 8733: Sa, 8734: [0, 0.44444, 0, 0, 1.14999], 8736: Sr, 8739: hi, 8741: ut, 8743: Dt, 8744: Dt, 8745: Dt, 8746: Dt, 8747: [0.19444, 0.69444, 0.12778, 0, 0.56875], 8764: wa, 8768: [0.19444, 0.69444, 0, 0, 0.31944], 8771: Tn, 8776: [0.02444, 0.52444, 0, 0, 0.89444], 8781: Tn, 8801: Tn, 8804: dt, 8805: dt, 8810: Ma, 8811: Ma, 8826: Kt, 8827: Kt, 8834: Kt, 8835: Kt, 8838: dt, 8839: dt, 8846: Dt, 8849: dt, 8850: dt, 8851: Dt, 8852: Dt, 8853: Be, 8854: Be, 8855: Be, 8856: Be, 8857: Be, 8866: Dn, 8867: Dn, 8868: mi, 8869: mi, 8900: Bn, 8901: [-0.02639, 0.47361, 0, 0, 0.31944], 8902: pi, 8968: fi, 8969: fi, 8970: fi, 8971: fi, 8994: Aa, 8995: Aa, 9651: ka, 9657: pi, 9661: ka, 9667: pi, 9711: Ar, 9824: gi, 9825: gi, 9826: gi, 9827: gi, 9837: [0, 0.75, 0, 0, 0.44722], 9838: _a, 9839: _a, 10216: ci, 10217: ci, 10815: ui, 10927: dt, 10928: dt, 57376: ls }, "Main-BoldItalic": { 32: N, 33: [0, 0.69444, 0.11417, 0, 0.38611], 34: $a, 35: [0.19444, 0.69444, 0.06833, 0, 0.94444], 37: [0.05556, 0.75, 0.12861, 0, 0.94444], 38: [0, 0.69444, 0.08528, 0, 0.88555], 39: yi, 40: [0.25, 0.75, 0.15806, 0, 0.47333], 41: [0.25, 0.75, 0.03306, 0, 0.47333], 42: [0, 0.75, 0.14333, 0, 0.59111], 43: [0.10333, 0.60333, 0.03306, 0, 0.88555], 44: [0.19444, 0.14722, 0, 0, 0.35555], 45: [0, 0.44444, 0.02611, 0, 0.41444], 46: [0, 0.14722, 0, 0, 0.35555], 47: [0.25, 0.75, 0.15806, 0, 0.59111], 48: pt, 49: pt, 50: pt, 51: pt, 52: Ca, 53: pt, 54: pt, 55: Ca, 56: pt, 57: pt, 58: [0, 0.44444, 0.06695, 0, 0.35555], 59: [0.19444, 0.44444, 0.06695, 0, 0.35555], 61: [-0.10889, 0.39111, 0.06833, 0, 0.88555], 63: $n, 64: [0, 0.69444, 0.09208, 0, 0.88555], 65: [0, 0.68611, 0, 0, 0.86555], 66: [0, 0.68611, 0.0992, 0, 0.81666], 67: [0, 0.68611, 0.14208, 0, 0.82666], 68: [0, 0.68611, 0.09062, 0, 0.87555], 69: [0, 0.68611, 0.11431, 0, 0.75666], 70: [0, 0.68611, 0.12903, 0, 0.72722], 71: [0, 0.68611, 0.07347, 0, 0.89527], 72: zn, 73: [0, 0.68611, 0.15681, 0, 0.47166], 74: [0, 0.68611, 0.145, 0, 0.61055], 75: [0, 0.68611, 0.14208, 0, 0.89499], 76: [0, 0.68611, 0, 0, 0.69777], 77: [0, 0.68611, 0.17208, 0, 1.07277], 78: zn, 79: [0, 0.68611, 0.09062, 0, 0.85499], 80: [0, 0.68611, 0.0992, 0, 0.78721], 81: [0.19444, 0.68611, 0.09062, 0, 0.85499], 82: [0, 0.68611, 0.02559, 0, 0.85944], 83: [0, 0.68611, 0.11264, 0, 0.64999], 84: [0, 0.68611, 0.12903, 0, 0.7961], 85: [0, 0.68611, 0.17208, 0, 0.88083], 86: [0, 0.68611, 0.18625, 0, 0.86555], 87: [0, 0.68611, 0.18625, 0, 1.15999], 88: [0, 0.68611, 0.15681, 0, 0.86555], 89: [0, 0.68611, 0.19803, 0, 0.86555], 90: [0, 0.68611, 0.14208, 0, 0.70888], 91: [0.25, 0.75, 0.1875, 0, 0.35611], 93: [0.25, 0.75, 0.09972, 0, 0.35611], 94: Ta, 95: [0.31, 0.13444, 0.09811, 0, 0.59111], 97: [0, 0.44444, 0.09426, 0, 0.59111], 98: [0, 0.69444, 0.07861, 0, 0.53222], 99: [0, 0.44444, 0.05222, 0, 0.53222], 100: [0, 0.69444, 0.10861, 0, 0.59111], 101: [0, 0.44444, 0.085, 0, 0.53222], 102: [0.19444, 0.69444, 0.21778, 0, 0.4], 103: La, 104: [0, 0.69444, 0.09426, 0, 0.59111], 105: [0, 0.69326, 0.11387, 0, 0.35555], 106: [0.19444, 0.69326, 0.1672, 0, 0.35555], 107: [0, 0.69444, 0.11111, 0, 0.53222], 108: [0, 0.69444, 0.10861, 0, 0.29666], 109: [0, 0.44444, 0.09426, 0, 0.94444], 110: [0, 0.44444, 0.09426, 0, 0.64999], 111: [0, 0.44444, 0.07861, 0, 0.59111], 112: [0.19444, 0.44444, 0.07861, 0, 0.59111], 113: La, 114: [0, 0.44444, 0.11111, 0, 0.50167], 115: [0, 0.44444, 0.08167, 0, 0.48694], 116: [0, 0.63492, 0.09639, 0, 0.385], 117: [0, 0.44444, 0.09426, 0, 0.62055], 118: [0, 0.44444, 0.11111, 0, 0.53222], 119: [0, 0.44444, 0.11111, 0, 0.76777], 120: [0, 0.44444, 0.12583, 0, 0.56055], 121: [0.19444, 0.44444, 0.105, 0, 0.56166], 122: [0, 0.44444, 0.13889, 0, 0.49055], 126: [0.35, 0.34444, 0.11472, 0, 0.59111], 160: N, 168: [0, 0.69444, 0.11473, 0, 0.59111], 176: Da, 184: [0.17014, 0, 0, 0, 0.53222], 198: [0, 0.68611, 0.11431, 0, 1.02277], 216: [0.04861, 0.73472, 0.09062, 0, 0.88555], 223: [0.19444, 0.69444, 0.09736, 0, 0.665], 230: Ba, 248: [0.09722, 0.54167, 0.09458, 0, 0.59111], 305: [0, 0.44444, 0.09426, 0, 0.35555], 338: [0, 0.68611, 0.11431, 0, 1.14054], 339: Ba, 567: [0.19444, 0.44444, 0.04611, 0, 0.385], 710: Ta, 711: [0, 0.63194, 0.08271, 0, 0.59111], 713: [0, 0.59444, 0.10444, 0, 0.59111], 714: [0, 0.69444, 0.08528, 0, 0.59111], 715: [0, 0.69444, 0, 0, 0.59111], 728: [0, 0.69444, 0.10333, 0, 0.59111], 729: yi, 730: Da, 732: $n, 733: $n, 915: [0, 0.68611, 0.12903, 0, 0.69777], 916: [0, 0.68611, 0, 0, 0.94444], 920: [0, 0.68611, 0.09062, 0, 0.88555], 923: [0, 0.68611, 0, 0, 0.80666], 926: [0, 0.68611, 0.15092, 0, 0.76777], 928: zn, 931: [0, 0.68611, 0.11431, 0, 0.82666], 933: za, 934: [0, 0.68611, 0.05632, 0, 0.82666], 936: za, 937: [0, 0.68611, 0.0992, 0, 0.82666], 8211: [0, 0.44444, 0.09811, 0, 0.59111], 8212: [0, 0.44444, 0.09811, 0, 1.18221], 8216: yi, 8217: yi, 8220: [0, 0.69444, 0.16772, 0, 0.62055], 8221: $a }, "Main-Italic": { 32: N, 33: bi, 34: Va, 35: [0.19444, 0.69444, 0.06616, 0, 0.81777], 37: [0.05556, 0.75, 0.13639, 0, 0.81777], 38: [0, 0.69444, 0.09694, 0, 0.76666], 39: bi, 40: [0.25, 0.75, 0.16194, 0, 0.40889], 41: [0.25, 0.75, 0.03694, 0, 0.40889], 42: [0, 0.75, 0.14917, 0, 0.51111], 43: [0.05667, 0.56167, 0.03694, 0, 0.76666], 44: [0.19444, 0.10556, 0, 0, 0.30667], 45: [0, 0.43056, 0.02826, 0, 0.35778], 46: [0, 0.10556, 0, 0, 0.30667], 47: [0.25, 0.75, 0.16194, 0, 0.51111], 48: ft, 49: ft, 50: ft, 51: ft, 52: Ea, 53: ft, 54: ft, 55: Ea, 56: ft, 57: ft, 58: [0, 0.43056, 0.0582, 0, 0.30667], 59: [0.19444, 0.43056, 0.0582, 0, 0.30667], 61: [-0.13313, 0.36687, 0.06616, 0, 0.76666], 63: qa, 64: [0, 0.69444, 0.09597, 0, 0.76666], 65: [0, 0.68333, 0, 0, 0.74333], 66: [0, 0.68333, 0.10257, 0, 0.70389], 67: [0, 0.68333, 0.14528, 0, 0.71555], 68: [0, 0.68333, 0.09403, 0, 0.755], 69: [0, 0.68333, 0.12028, 0, 0.67833], 70: [0, 0.68333, 0.13305, 0, 0.65277], 71: [0, 0.68333, 0.08722, 0, 0.77361], 72: xi, 73: [0, 0.68333, 0.15806, 0, 0.38555], 74: [0, 0.68333, 0.14028, 0, 0.525], 75: [0, 0.68333, 0.14528, 0, 0.76888], 76: [0, 0.68333, 0, 0, 0.62722], 77: [0, 0.68333, 0.16389, 0, 0.89666], 78: xi, 79: Ia, 80: [0, 0.68333, 0.10257, 0, 0.67833], 81: [0.19444, 0.68333, 0.09403, 0, 0.76666], 82: [0, 0.68333, 0.03868, 0, 0.72944], 83: [0, 0.68333, 0.11972, 0, 0.56222], 84: [0, 0.68333, 0.13305, 0, 0.71555], 85: xi, 86: [0, 0.68333, 0.18361, 0, 0.74333], 87: [0, 0.68333, 0.18361, 0, 0.99888], 88: [0, 0.68333, 0.15806, 0, 0.74333], 89: [0, 0.68333, 0.19383, 0, 0.74333], 90: [0, 0.68333, 0.14528, 0, 0.61333], 91: [0.25, 0.75, 0.1875, 0, 0.30667], 93: [0.25, 0.75, 0.10528, 0, 0.30667], 94: Pa, 95: [0.31, 0.12056, 0.09208, 0, 0.51111], 97: [0, 0.43056, 0.07671, 0, 0.51111], 98: [0, 0.69444, 0.06312, 0, 0.46], 99: [0, 0.43056, 0.05653, 0, 0.46], 100: [0, 0.69444, 0.10333, 0, 0.51111], 101: [0, 0.43056, 0.07514, 0, 0.46], 102: [0.19444, 0.69444, 0.21194, 0, 0.30667], 103: Ra, 104: [0, 0.69444, 0.07671, 0, 0.51111], 105: [0, 0.65536, 0.1019, 0, 0.30667], 106: [0.19444, 0.65536, 0.14467, 0, 0.30667], 107: [0, 0.69444, 0.10764, 0, 0.46], 108: [0, 0.69444, 0.10333, 0, 0.25555], 109: [0, 0.43056, 0.07671, 0, 0.81777], 110: [0, 0.43056, 0.07671, 0, 0.56222], 111: [0, 0.43056, 0.06312, 0, 0.51111], 112: [0.19444, 0.43056, 0.06312, 0, 0.51111], 113: Ra, 114: [0, 0.43056, 0.10764, 0, 0.42166], 115: [0, 0.43056, 0.08208, 0, 0.40889], 116: [0, 0.61508, 0.09486, 0, 0.33222], 117: [0, 0.43056, 0.07671, 0, 0.53666], 118: [0, 0.43056, 0.10764, 0, 0.46], 119: [0, 0.43056, 0.10764, 0, 0.66444], 120: [0, 0.43056, 0.12042, 0, 0.46389], 121: [0.19444, 0.43056, 0.08847, 0, 0.48555], 122: [0, 0.43056, 0.12292, 0, 0.40889], 126: [0.35, 0.31786, 0.11585, 0, 0.51111], 160: N, 168: [0, 0.66786, 0.10474, 0, 0.51111], 176: Oa, 184: [0.17014, 0, 0, 0, 0.46], 198: [0, 0.68333, 0.12028, 0, 0.88277], 216: [0.04861, 0.73194, 0.09403, 0, 0.76666], 223: [0.19444, 0.69444, 0.10514, 0, 0.53666], 230: Fa, 248: [0.09722, 0.52778, 0.09194, 0, 0.51111], 338: [0, 0.68333, 0.12028, 0, 0.98499], 339: Fa, 710: Pa, 711: [0, 0.62847, 0.08295, 0, 0.51111], 713: [0, 0.56167, 0.10333, 0, 0.51111], 714: [0, 0.69444, 0.09694, 0, 0.51111], 715: [0, 0.69444, 0, 0, 0.51111], 728: [0, 0.69444, 0.10806, 0, 0.51111], 729: [0, 0.66786, 0.11752, 0, 0.30667], 730: Oa, 732: [0, 0.66786, 0.11585, 0, 0.51111], 733: qa, 915: [0, 0.68333, 0.13305, 0, 0.62722], 916: [0, 0.68333, 0, 0, 0.81777], 920: Ia, 923: [0, 0.68333, 0, 0, 0.69222], 926: [0, 0.68333, 0.15294, 0, 0.66444], 928: xi, 931: [0, 0.68333, 0.12028, 0, 0.71555], 933: Na, 934: [0, 0.68333, 0.05986, 0, 0.71555], 936: Na, 937: [0, 0.68333, 0.10257, 0, 0.71555], 8211: [0, 0.43056, 0.09208, 0, 0.51111], 8212: [0, 0.43056, 0.09208, 0, 1.02222], 8216: bi, 8217: bi, 8220: [0, 0.69444, 0.1685, 0, 0.51444], 8221: Va, 8463: ei }, "Main-Regular": { 32: N, 33: Ye, 34: re, 35: Es, 36: Pn, 37: Rs, 38: zt, 39: Ye, 40: Qt, 41: Qt, 42: Fs, 43: _e, 44: [0.19444, 0.10556, 0, 0, 0.27778], 45: [0, 0.43056, 0, 0, 0.33333], 46: [0, 0.10556, 0, 0, 0.27778], 47: Qe, 48: ke, 49: ke, 50: ke, 51: ke, 52: ke, 53: ke, 54: ke, 55: ke, 56: ke, 57: ke, 58: Wa, 59: [0.19444, 0.43056, 0, 0, 0.27778], 60: mt, 61: oi, 62: mt, 63: Wn, 64: zt, 65: $t, 66: [0, 0.68333, 0, 0, 0.70834], 67: _r, 68: [0, 0.68333, 0, 0, 0.76389], 69: Ja, 70: [0, 0.68333, 0, 0, 0.65278], 71: [0, 0.68333, 0, 0, 0.78472], 72: $t, 73: [0, 0.68333, 0, 0, 0.36111], 74: [0, 0.68333, 0, 0, 0.51389], 75: kr, 76: Xa, 77: [0, 0.68333, 0, 0, 0.91667], 78: $t, 79: kr, 80: Ja, 81: [0.19444, 0.68333, 0, 0, 0.77778], 82: [0, 0.68333, 0, 0, 0.73611], 83: [0, 0.68333, 0, 0, 0.55556], 84: _r, 85: $t, 86: [0, 0.68333, 0.01389, 0, 0.75], 87: [0, 0.68333, 0.01389, 0, 1.02778], 88: $t, 89: [0, 0.68333, 0.025, 0, 0.75], 90: [0, 0.68333, 0, 0, 0.61111], 91: vi, 92: Qe, 93: vi, 94: re, 95: [0.31, 0.12056, 0.02778, 0, 0.5], 97: Cr, 98: er, 99: En, 100: er, 101: En, 102: [0, 0.69444, 0.07778, 0, 0.30556], 103: [0.19444, 0.43056, 0.01389, 0, 0.5], 104: er, 105: Ua, 106: [0.19444, 0.66786, 0, 0, 0.30556], 107: [0, 0.69444, 0, 0, 0.52778], 108: Ye, 109: [0, 0.43056, 0, 0, 0.83334], 110: Ga, 111: Cr, 112: Ha, 113: [0.19444, 0.43056, 0, 0, 0.52778], 114: [0, 0.43056, 0, 0, 0.39167], 115: [0, 0.43056, 0, 0, 0.39445], 116: [0, 0.61508, 0, 0, 0.38889], 117: Ga, 118: [0, 0.43056, 0.01389, 0, 0.52778], 119: [0, 0.43056, 0.01389, 0, 0.72222], 120: [0, 0.43056, 0, 0, 0.52778], 121: [0.19444, 0.43056, 0.01389, 0, 0.52778], 122: En, 123: Qe, 124: vi, 125: Qe, 126: [0.35, 0.31786, 0, 0, 0.5], 160: N, 163: [0, 0.69444, 0, 0, 0.76909], 167: Rn, 168: ja, 172: [0, 0.43056, 0, 0, 0.66667], 176: Za, 177: _e, 182: Fn, 184: Hn, 198: [0, 0.68333, 0, 0, 0.90278], 215: _e, 216: [0.04861, 0.73194, 0, 0, 0.77778], 223: re, 230: [0, 0.43056, 0, 0, 0.72222], 247: _e, 248: [0.09722, 0.52778, 0, 0, 0.5], 305: Wa, 338: [0, 0.68333, 0, 0, 1.01389], 339: ts, 567: [0.19444, 0.43056, 0, 0, 0.30556], 710: re, 711: [0, 0.62847, 0, 0, 0.5], 713: [0, 0.56778, 0, 0, 0.5], 714: re, 715: re, 728: re, 729: Ua, 730: Za, 732: ja, 733: re, 915: Xa, 916: Qa, 920: kr, 923: [0, 0.68333, 0, 0, 0.69445], 926: [0, 0.68333, 0, 0, 0.66667], 928: $t, 931: _r, 933: kr, 934: _r, 936: kr, 937: _r, 8211: [0, 0.43056, 0.02778, 0, 0.5], 8212: [0, 0.43056, 0.02778, 0, 1], 8216: Ye, 8217: Ye, 8220: re, 8221: re, 8224: Rn, 8225: Rn, 8230: [0, 0.12, 0, 0, 1.172], 8242: [0, 0.55556, 0, 0, 0.275], 8407: [0, 0.71444, 0.15382, 0, 0.5], 8463: ei, 8465: Lr, 8467: [0, 0.69444, 0, 0.11111, 0.41667], 8472: [0.19444, 0.43056, 0, 0.11111, 0.63646], 8476: Lr, 8501: gt, 8592: ue, 8593: Ka, 8594: ue, 8595: Ka, 8596: ue, 8597: Qe, 8598: Br, 8599: Br, 8600: Br, 8601: Br, 8614: [0.011, 0.511, 0, 0, 1], 8617: Ya, 8618: Ya, 8636: ue, 8637: ue, 8640: ue, 8641: ue, 8652: [0.011, 0.671, 0, 0, 1], 8656: ue, 8657: Fn, 8658: ue, 8659: Fn, 8660: ue, 8661: [0.25, 0.75, 0, 0, 0.61111], 8704: er, 8706: [0, 0.69444, 0.05556, 0.08334, 0.5309], 8707: er, 8709: Pn, 8711: Qa, 8712: es, 8715: es, 8722: _e, 8723: _e, 8725: Qe, 8726: Qe, 8727: wi, 8728: On, 8729: On, 8730: [0.2, 0.8, 0, 0, 0.83334], 8733: ts, 8734: Sn, 8736: Sr, 8739: vi, 8741: Qe, 8743: Et, 8744: Et, 8745: Et, 8746: Et, 8747: [0.19444, 0.69444, 0.11111, 0, 0.41667], 8764: oi, 8768: [0.19444, 0.69444, 0, 0, 0.27778], 8771: Si, 8773: [-0.022, 0.589, 0, 0, 1], 8776: rs, 8781: Si, 8784: [-0.133, 0.67, 0, 0, 0.778], 8801: Si, 8804: fe, 8805: fe, 8810: is, 8811: is, 8826: mt, 8827: mt, 8834: mt, 8835: mt, 8838: fe, 8839: fe, 8846: Et, 8849: fe, 8850: fe, 8851: Et, 8852: Et, 8853: _e, 8854: _e, 8855: _e, 8856: _e, 8857: _e, 8866: gt, 8867: gt, 8868: zt, 8869: zt, 8872: [0.249, 0.75, 0, 0, 0.867], 8900: On, 8901: [-0.05555, 0.44445, 0, 0, 0.27778], 8902: wi, 8904: [5e-3, 0.505, 0, 0, 0.9], 8942: [0.03, 0.9, 0, 0, 0.278], 8943: [-0.19, 0.31, 0, 0, 1.172], 8945: [-0.1, 0.82, 0, 0, 1.282], 8968: Mi, 8969: Mi, 8970: Mi, 8971: Mi, 8994: ns, 8995: ns, 9136: Ai, 9137: Ai, 9651: os, 9657: wi, 9661: os, 9667: wi, 9711: Br, 9824: ki, 9825: ki, 9826: ki, 9827: ki, 9837: [0, 0.75, 0, 0, 0.38889], 9838: as, 9839: as, 10216: Qt, 10217: Qt, 10222: Ai, 10223: Ai, 10229: [0.011, 0.511, 0, 0, 1.609], 10230: ss, 10231: [0.011, 0.511, 0, 0, 1.859], 10232: [0.024, 0.525, 0, 0, 1.609], 10233: [0.024, 0.525, 0, 0, 1.638], 10234: [0.024, 0.525, 0, 0, 1.858], 10236: ss, 10815: $t, 10927: fe, 10928: fe, 57376: ls }, "Math-BoldItalic": { 32: N, 48: _i, 49: _i, 50: _i, 51: Tr, 52: Tr, 53: Tr, 54: Ae, 55: Tr, 56: Ae, 57: Tr, 65: kn, 66: [0, 0.68611, 0.04835, 0, 0.8664], 67: [0, 0.68611, 0.06979, 0, 0.81694], 68: [0, 0.68611, 0.03194, 0, 0.93812], 69: [0, 0.68611, 0.05451, 0, 0.81007], 70: [0, 0.68611, 0.15972, 0, 0.68889], 71: [0, 0.68611, 0, 0, 0.88673], 72: hs, 73: [0, 0.68611, 0.07778, 0, 0.51111], 74: [0, 0.68611, 0.10069, 0, 0.63125], 75: [0, 0.68611, 0.06979, 0, 0.97118], 76: cs, 77: [0, 0.68611, 0.11424, 0, 1.14201], 78: [0, 0.68611, 0.11424, 0, 0.95034], 79: [0, 0.68611, 0.03194, 0, 0.83666], 80: [0, 0.68611, 0.15972, 0, 0.72309], 81: [0.19444, 0.68611, 0, 0, 0.86861], 82: [0, 0.68611, 421e-5, 0, 0.87235], 83: [0, 0.68611, 0.05382, 0, 0.69271], 84: [0, 0.68611, 0.15972, 0, 0.63663], 85: [0, 0.68611, 0.11424, 0, 0.80027], 86: [0, 0.68611, 0.25555, 0, 0.67778], 87: [0, 0.68611, 0.15972, 0, 1.09305], 88: [0, 0.68611, 0.07778, 0, 0.94722], 89: [0, 0.68611, 0.25555, 0, 0.67458], 90: [0, 0.68611, 0.06979, 0, 0.77257], 97: [0, 0.44444, 0, 0, 0.63287], 98: [0, 0.69444, 0, 0, 0.52083], 99: [0, 0.44444, 0, 0, 0.51342], 100: [0, 0.69444, 0, 0, 0.60972], 101: [0, 0.44444, 0, 0, 0.55361], 102: [0.19444, 0.69444, 0.11042, 0, 0.56806], 103: [0.19444, 0.44444, 0.03704, 0, 0.5449], 104: ms, 105: [0, 0.69326, 0, 0, 0.4048], 106: [0.19444, 0.69326, 0.0622, 0, 0.47083], 107: [0, 0.69444, 0.01852, 0, 0.6037], 108: [0, 0.69444, 88e-4, 0, 0.34815], 109: [0, 0.44444, 0, 0, 1.0324], 110: [0, 0.44444, 0, 0, 0.71296], 111: ps, 112: [0.19444, 0.44444, 0, 0, 0.60092], 113: [0.19444, 0.44444, 0.03704, 0, 0.54213], 114: [0, 0.44444, 0.03194, 0, 0.5287], 115: [0, 0.44444, 0, 0, 0.53125], 116: [0, 0.63492, 0, 0, 0.41528], 117: [0, 0.44444, 0, 0, 0.68102], 118: [0, 0.44444, 0.03704, 0, 0.56666], 119: [0, 0.44444, 0.02778, 0, 0.83148], 120: [0, 0.44444, 0, 0, 0.65903], 121: [0.19444, 0.44444, 0.03704, 0, 0.59028], 122: [0, 0.44444, 0.04213, 0, 0.55509], 160: N, 915: [0, 0.68611, 0.15972, 0, 0.65694], 916: Ln, 920: [0, 0.68611, 0.03194, 0, 0.86722], 923: us, 926: [0, 0.68611, 0.07458, 0, 0.84125], 928: hs, 931: [0, 0.68611, 0.05451, 0, 0.88507], 933: [0, 0.68611, 0.15972, 0, 0.67083], 934: ds, 936: [0, 0.68611, 0.11653, 0, 0.71402], 937: [0, 0.68611, 0.04835, 0, 0.8789], 945: [0, 0.44444, 0, 0, 0.76064], 946: [0.19444, 0.69444, 0.03403, 0, 0.65972], 947: [0.19444, 0.44444, 0.06389, 0, 0.59003], 948: [0, 0.69444, 0.03819, 0, 0.52222], 949: [0, 0.44444, 0, 0, 0.52882], 950: [0.19444, 0.69444, 0.06215, 0, 0.50833], 951: [0.19444, 0.44444, 0.03704, 0, 0.6], 952: [0, 0.69444, 0.03194, 0, 0.5618], 953: [0, 0.44444, 0, 0, 0.41204], 954: [0, 0.44444, 0, 0, 0.66759], 955: [0, 0.69444, 0, 0, 0.67083], 956: [0.19444, 0.44444, 0, 0, 0.70787], 957: [0, 0.44444, 0.06898, 0, 0.57685], 958: [0.19444, 0.69444, 0.03021, 0, 0.50833], 959: ps, 960: [0, 0.44444, 0.03704, 0, 0.68241], 961: fs, 962: [0.09722, 0.44444, 0.07917, 0, 0.42361], 963: [0, 0.44444, 0.03704, 0, 0.68588], 964: [0, 0.44444, 0.13472, 0, 0.52083], 965: [0, 0.44444, 0.03704, 0, 0.63055], 966: [0.19444, 0.44444, 0, 0, 0.74722], 967: [0.19444, 0.44444, 0, 0, 0.71805], 968: [0.19444, 0.69444, 0.03704, 0, 0.75833], 969: [0, 0.44444, 0.03704, 0, 0.71782], 977: [0, 0.69444, 0, 0, 0.69155], 981: [0.19444, 0.69444, 0, 0, 0.7125], 982: [0, 0.44444, 0.03194, 0, 0.975], 1009: fs, 1013: [0, 0.44444, 0, 0, 0.48333], 57649: [0, 0.44444, 0, 0, 0.39352], 57911: [0.19444, 0.44444, 0, 0, 0.43889] }, "Math-Italic": { 32: N, 48: Cr, 49: Cr, 50: Cr, 51: Dr, 52: Dr, 53: Dr, 54: ke, 55: Dr, 56: ke, 57: Dr, 65: [0, 0.68333, 0, 0.13889, 0.75], 66: [0, 0.68333, 0.05017, 0.08334, 0.75851], 67: [0, 0.68333, 0.07153, 0.08334, 0.71472], 68: [0, 0.68333, 0.02778, 0.05556, 0.82792], 69: [0, 0.68333, 0.05764, 0.08334, 0.7382], 70: [0, 0.68333, 0.13889, 0.08334, 0.64306], 71: [0, 0.68333, 0, 0.08334, 0.78625], 72: ys, 73: [0, 0.68333, 0.07847, 0.11111, 0.43958], 74: [0, 0.68333, 0.09618, 0.16667, 0.55451], 75: [0, 0.68333, 0.07153, 0.05556, 0.84931], 76: [0, 0.68333, 0, 0.02778, 0.68056], 77: [0, 0.68333, 0.10903, 0.08334, 0.97014], 78: [0, 0.68333, 0.10903, 0.08334, 0.80347], 79: gs, 80: [0, 0.68333, 0.13889, 0.08334, 0.64201], 81: [0.19444, 0.68333, 0, 0.08334, 0.79056], 82: [0, 0.68333, 773e-5, 0.08334, 0.75929], 83: [0, 0.68333, 0.05764, 0.08334, 0.6132], 84: [0, 0.68333, 0.13889, 0.08334, 0.58438], 85: [0, 0.68333, 0.10903, 0.02778, 0.68278], 86: [0, 0.68333, 0.22222, 0, 0.58333], 87: [0, 0.68333, 0.13889, 0, 0.94445], 88: [0, 0.68333, 0.07847, 0.08334, 0.82847], 89: [0, 0.68333, 0.22222, 0, 0.58056], 90: [0, 0.68333, 0.07153, 0.08334, 0.68264], 97: [0, 0.43056, 0, 0, 0.52859], 98: [0, 0.69444, 0, 0, 0.42917], 99: [0, 0.43056, 0, 0.05556, 0.43276], 100: [0, 0.69444, 0, 0.16667, 0.52049], 101: [0, 0.43056, 0, 0.05556, 0.46563], 102: [0.19444, 0.69444, 0.10764, 0.16667, 0.48959], 103: [0.19444, 0.43056, 0.03588, 0.02778, 0.47697], 104: [0, 0.69444, 0, 0, 0.57616], 105: [0, 0.65952, 0, 0, 0.34451], 106: [0.19444, 0.65952, 0.05724, 0, 0.41181], 107: [0, 0.69444, 0.03148, 0, 0.5206], 108: [0, 0.69444, 0.01968, 0.08334, 0.29838], 109: [0, 0.43056, 0, 0, 0.87801], 110: [0, 0.43056, 0, 0, 0.60023], 111: bs, 112: [0.19444, 0.43056, 0, 0.08334, 0.50313], 113: [0.19444, 0.43056, 0.03588, 0.08334, 0.44641], 114: [0, 0.43056, 0.02778, 0.05556, 0.45116], 115: [0, 0.43056, 0, 0.05556, 0.46875], 116: [0, 0.61508, 0, 0.08334, 0.36111], 117: [0, 0.43056, 0, 0.02778, 0.57246], 118: [0, 0.43056, 0.03588, 0.02778, 0.48472], 119: [0, 0.43056, 0.02691, 0.08334, 0.71592], 120: [0, 0.43056, 0, 0.02778, 0.57153], 121: [0.19444, 0.43056, 0.03588, 0.05556, 0.49028], 122: [0, 0.43056, 0.04398, 0.05556, 0.46505], 160: N, 915: [0, 0.68333, 0.13889, 0.08334, 0.61528], 916: [0, 0.68333, 0, 0.16667, 0.83334], 920: gs, 923: [0, 0.68333, 0, 0.16667, 0.69445], 926: [0, 0.68333, 0.07569, 0.08334, 0.74236], 928: ys, 931: [0, 0.68333, 0.05764, 0.08334, 0.77986], 933: [0, 0.68333, 0.13889, 0.05556, 0.58333], 934: [0, 0.68333, 0, 0.08334, 0.66667], 936: [0, 0.68333, 0.11, 0.05556, 0.61222], 937: [0, 0.68333, 0.05017, 0.08334, 0.7724], 945: [0, 0.43056, 37e-4, 0.02778, 0.6397], 946: [0.19444, 0.69444, 0.05278, 0.08334, 0.56563], 947: [0.19444, 0.43056, 0.05556, 0, 0.51773], 948: [0, 0.69444, 0.03785, 0.05556, 0.44444], 949: [0, 0.43056, 0, 0.08334, 0.46632], 950: [0.19444, 0.69444, 0.07378, 0.08334, 0.4375], 951: [0.19444, 0.43056, 0.03588, 0.05556, 0.49653], 952: [0, 0.69444, 0.02778, 0.08334, 0.46944], 953: [0, 0.43056, 0, 0.05556, 0.35394], 954: [0, 0.43056, 0, 0, 0.57616], 955: [0, 0.69444, 0, 0, 0.58334], 956: [0.19444, 0.43056, 0, 0.02778, 0.60255], 957: [0, 0.43056, 0.06366, 0.02778, 0.49398], 958: [0.19444, 0.69444, 0.04601, 0.11111, 0.4375], 959: bs, 960: [0, 0.43056, 0.03588, 0, 0.57003], 961: xs, 962: [0.09722, 0.43056, 0.07986, 0.08334, 0.36285], 963: [0, 0.43056, 0.03588, 0, 0.57141], 964: [0, 0.43056, 0.1132, 0.02778, 0.43715], 965: [0, 0.43056, 0.03588, 0.02778, 0.54028], 966: [0.19444, 0.43056, 0, 0.08334, 0.65417], 967: [0.19444, 0.43056, 0, 0.05556, 0.62569], 968: [0.19444, 0.69444, 0.03588, 0.11111, 0.65139], 969: [0, 0.43056, 0.03588, 0, 0.62245], 977: [0, 0.69444, 0, 0.08334, 0.59144], 981: [0.19444, 0.69444, 0, 0.08334, 0.59583], 982: [0, 0.43056, 0.02778, 0, 0.82813], 1009: xs, 1013: [0, 0.43056, 0, 0.05556, 0.4059], 57649: [0, 0.43056, 0, 0.02778, 0.32246], 57911: [0.19444, 0.43056, 0, 0.08334, 0.38403] }, "SansSerif-Bold": { 32: N, 33: [0, 0.69444, 0, 0, 0.36667], 34: Vn, 35: [0.19444, 0.69444, 0, 0, 0.91667], 36: [0.05556, 0.75, 0, 0, 0.55], 37: [0.05556, 0.75, 0, 0, 1.02912], 38: [0, 0.69444, 0, 0, 0.83056], 39: Ci, 40: vs, 41: vs, 42: [0, 0.75, 0, 0, 0.55], 43: [0.11667, 0.61667, 0, 0, 0.85556], 44: [0.10556, 0.13056, 0, 0, 0.30556], 45: [0, 0.45833, 0, 0, 0.36667], 46: [0, 0.13056, 0, 0, 0.30556], 47: [0.25, 0.75, 0, 0, 0.55], 48: le, 49: le, 50: le, 51: le, 52: le, 53: le, 54: le, 55: le, 56: le, 57: le, 58: [0, 0.45833, 0, 0, 0.30556], 59: [0.10556, 0.45833, 0, 0, 0.30556], 61: [-0.09375, 0.40625, 0, 0, 0.85556], 63: Ss, 64: et, 65: et, 66: et, 67: qn, 68: yt, 69: [0, 0.69444, 0, 0, 0.64167], 70: gt, 71: et, 72: yt, 73: [0, 0.69444, 0, 0, 0.33056], 74: Ss, 75: ws, 76: Cs, 77: [0, 0.69444, 0, 0, 0.97778], 78: yt, 79: yt, 80: qn, 81: [0.10556, 0.69444, 0, 0, 0.79445], 82: qn, 83: gt, 84: et, 85: ws, 86: [0, 0.69444, 0.01528, 0, 0.73334], 87: [0, 0.69444, 0.01528, 0, 1.03889], 88: et, 89: [0, 0.69444, 0.0275, 0, 0.73334], 90: Ls, 91: Ms, 93: Ms, 94: le, 95: [0.35, 0.10833, 0.03056, 0, 0.55], 97: [0, 0.45833, 0, 0, 0.525], 98: In, 99: [0, 0.45833, 0, 0, 0.48889], 100: In, 101: [0, 0.45833, 0, 0, 0.51111], 102: [0, 0.69444, 0.07639, 0, 0.33611], 103: [0.19444, 0.45833, 0.01528, 0, 0.55], 104: In, 105: As, 106: [0.19444, 0.69444, 0, 0, 0.28611], 107: [0, 0.69444, 0, 0, 0.53056], 108: As, 109: [0, 0.45833, 0, 0, 0.86667], 110: _s, 111: [0, 0.45833, 0, 0, 0.55], 112: ks, 113: ks, 114: [0, 0.45833, 0.01528, 0, 0.37222], 115: [0, 0.45833, 0, 0, 0.42167], 116: [0, 0.58929, 0, 0, 0.40417], 117: _s, 118: [0, 0.45833, 0.01528, 0, 0.5], 119: [0, 0.45833, 0.01528, 0, 0.74445], 120: [0, 0.45833, 0, 0, 0.5], 121: [0.19444, 0.45833, 0.01528, 0, 0.5], 122: [0, 0.45833, 0, 0, 0.47639], 126: [0.35, 0.34444, 0, 0, 0.55], 160: N, 168: le, 176: et, 180: le, 184: [0.17014, 0, 0, 0, 0.48889], 305: [0, 0.45833, 0, 0, 0.25556], 567: [0.19444, 0.45833, 0, 0, 0.28611], 710: le, 711: [0, 0.63542, 0, 0, 0.55], 713: [0, 0.63778, 0, 0, 0.55], 728: le, 729: Ci, 730: et, 732: le, 733: le, 915: Cs, 916: [0, 0.69444, 0, 0, 0.91667], 920: Nn, 923: Ls, 926: et, 928: yt, 931: yt, 933: Nn, 934: yt, 936: Nn, 937: yt, 8211: [0, 0.45833, 0.03056, 0, 0.55], 8212: [0, 0.45833, 0.03056, 0, 1.10001], 8216: Ci, 8217: Ci, 8220: Vn, 8221: Vn }, "SansSerif-Italic": { 32: N, 33: [0, 0.69444, 0.05733, 0, 0.31945], 34: $s, 35: [0.19444, 0.69444, 0.05087, 0, 0.83334], 36: [0.05556, 0.75, 0.11156, 0, 0.5], 37: [0.05556, 0.75, 0.03126, 0, 0.83334], 38: [0, 0.69444, 0.03058, 0, 0.75834], 39: Gn, 40: [0.25, 0.75, 0.13164, 0, 0.38889], 41: [0.25, 0.75, 0.02536, 0, 0.38889], 42: [0, 0.75, 0.11775, 0, 0.5], 43: [0.08333, 0.58333, 0.02536, 0, 0.77778], 44: Ps, 45: [0, 0.44444, 0.01946, 0, 0.33333], 46: Os, 47: [0.25, 0.75, 0.13164, 0, 0.5], 48: Je, 49: Je, 50: Je, 51: Je, 52: Je, 53: Je, 54: Je, 55: Je, 56: Je, 57: Je, 58: [0, 0.44444, 0.02502, 0, 0.27778], 59: [0.125, 0.44444, 0.02502, 0, 0.27778], 61: [-0.13, 0.37, 0.05087, 0, 0.77778], 63: [0, 0.69444, 0.11809, 0, 0.47222], 64: [0, 0.69444, 0.07555, 0, 0.66667], 65: tt, 66: [0, 0.69444, 0.08293, 0, 0.66667], 67: [0, 0.69444, 0.11983, 0, 0.63889], 68: [0, 0.69444, 0.07555, 0, 0.72223], 69: [0, 0.69444, 0.11983, 0, 0.59722], 70: [0, 0.69444, 0.13372, 0, 0.56945], 71: [0, 0.69444, 0.11983, 0, 0.66667], 72: Jn, 73: [0, 0.69444, 0.13372, 0, 0.27778], 74: [0, 0.69444, 0.08094, 0, 0.47222], 75: [0, 0.69444, 0.11983, 0, 0.69445], 76: Un, 77: [0, 0.69444, 0.08094, 0, 0.875], 78: Jn, 79: [0, 0.69444, 0.07555, 0, 0.73611], 80: [0, 0.69444, 0.08293, 0, 0.63889], 81: [0.125, 0.69444, 0.07555, 0, 0.73611], 82: [0, 0.69444, 0.08293, 0, 0.64584], 83: [0, 0.69444, 0.09205, 0, 0.55556], 84: [0, 0.69444, 0.13372, 0, 0.68056], 85: [0, 0.69444, 0.08094, 0, 0.6875], 86: [0, 0.69444, 0.1615, 0, 0.66667], 87: [0, 0.69444, 0.1615, 0, 0.94445], 88: [0, 0.69444, 0.13372, 0, 0.66667], 89: [0, 0.69444, 0.17261, 0, 0.66667], 90: [0, 0.69444, 0.11983, 0, 0.61111], 91: [0.25, 0.75, 0.15942, 0, 0.28889], 93: [0.25, 0.75, 0.08719, 0, 0.28889], 94: Bs, 95: [0.35, 0.09444, 0.08616, 0, 0.5], 97: [0, 0.44444, 981e-5, 0, 0.48056], 98: [0, 0.69444, 0.03057, 0, 0.51667], 99: [0, 0.44444, 0.08336, 0, 0.44445], 100: [0, 0.69444, 0.09483, 0, 0.51667], 101: [0, 0.44444, 0.06778, 0, 0.44445], 102: [0, 0.69444, 0.21705, 0, 0.30556], 103: [0.19444, 0.44444, 0.10836, 0, 0.5], 104: [0, 0.69444, 0.01778, 0, 0.51667], 105: [0, 0.67937, 0.09718, 0, 0.23889], 106: [0.19444, 0.67937, 0.09162, 0, 0.26667], 107: [0, 0.69444, 0.08336, 0, 0.48889], 108: [0, 0.69444, 0.09483, 0, 0.23889], 109: [0, 0.44444, 0.01778, 0, 0.79445], 110: [0, 0.44444, 0.01778, 0, 0.51667], 111: [0, 0.44444, 0.06613, 0, 0.5], 112: [0.19444, 0.44444, 0.0389, 0, 0.51667], 113: [0.19444, 0.44444, 0.04169, 0, 0.51667], 114: [0, 0.44444, 0.10836, 0, 0.34167], 115: [0, 0.44444, 0.0778, 0, 0.38333], 116: [0, 0.57143, 0.07225, 0, 0.36111], 117: [0, 0.44444, 0.04169, 0, 0.51667], 118: [0, 0.44444, 0.10836, 0, 0.46111], 119: [0, 0.44444, 0.10836, 0, 0.68334], 120: [0, 0.44444, 0.09169, 0, 0.46111], 121: [0.19444, 0.44444, 0.10836, 0, 0.46111], 122: [0, 0.44444, 0.08752, 0, 0.43472], 126: [0.35, 0.32659, 0.08826, 0, 0.5], 160: N, 168: [0, 0.67937, 0.06385, 0, 0.5], 176: Ts, 184: Hn, 305: [0, 0.44444, 0.04169, 0, 0.23889], 567: [0.19444, 0.44444, 0.04169, 0, 0.26667], 710: Bs, 711: [0, 0.63194, 0.08432, 0, 0.5], 713: [0, 0.60889, 0.08776, 0, 0.5], 714: Ds, 715: re, 728: [0, 0.69444, 0.09483, 0, 0.5], 729: [0, 0.67937, 0.07774, 0, 0.27778], 730: Ts, 732: [0, 0.67659, 0.08826, 0, 0.5], 733: Ds, 915: [0, 0.69444, 0.13372, 0, 0.54167], 916: Gs, 920: [0, 0.69444, 0.07555, 0, 0.77778], 923: gt, 926: [0, 0.69444, 0.12816, 0, 0.66667], 928: Jn, 931: [0, 0.69444, 0.11983, 0, 0.72222], 933: zs, 934: [0, 0.69444, 0.04603, 0, 0.72222], 936: zs, 937: [0, 0.69444, 0.08293, 0, 0.72222], 8211: [0, 0.44444, 0.08616, 0, 0.5], 8212: [0, 0.44444, 0.08616, 0, 1], 8216: Gn, 8217: Gn, 8220: [0, 0.69444, 0.14205, 0, 0.5], 8221: $s }, "SansSerif-Regular": { 32: N, 33: [0, 0.69444, 0, 0, 0.31945], 34: re, 35: Es, 36: Pn, 37: Rs, 38: [0, 0.69444, 0, 0, 0.75834], 39: Ye, 40: Qt, 41: Qt, 42: Fs, 43: _e, 44: Ps, 45: [0, 0.44444, 0, 0, 0.33333], 46: Os, 47: Qe, 48: He, 49: He, 50: He, 51: He, 52: He, 53: He, 54: He, 55: He, 56: He, 57: He, 58: [0, 0.44444, 0, 0, 0.27778], 59: [0.125, 0.44444, 0, 0, 0.27778], 61: [-0.13, 0.37, 0, 0, 0.77778], 63: Wn, 64: tt, 65: tt, 66: tt, 67: Tt, 68: [0, 0.69444, 0, 0, 0.72223], 69: qs, 70: [0, 0.69444, 0, 0, 0.56945], 71: tt, 72: Zn, 73: Ye, 74: Wn, 75: [0, 0.69444, 0, 0, 0.69445], 76: Un, 77: [0, 0.69444, 0, 0, 0.875], 78: Zn, 79: [0, 0.69444, 0, 0, 0.73611], 80: Tt, 81: [0.125, 0.69444, 0, 0, 0.73611], 82: [0, 0.69444, 0, 0, 0.64584], 83: er, 84: [0, 0.69444, 0, 0, 0.68056], 85: [0, 0.69444, 0, 0, 0.6875], 86: [0, 0.69444, 0.01389, 0, 0.66667], 87: [0, 0.69444, 0.01389, 0, 0.94445], 88: tt, 89: [0, 0.69444, 0.025, 0, 0.66667], 90: gt, 91: Is, 93: Is, 94: re, 95: [0.35, 0.09444, 0.02778, 0, 0.5], 97: [0, 0.44444, 0, 0, 0.48056], 98: jn, 99: Ns, 100: jn, 101: Ns, 102: [0, 0.69444, 0.06944, 0, 0.30556], 103: [0.19444, 0.44444, 0.01389, 0, 0.5], 104: jn, 105: [0, 0.67937, 0, 0, 0.23889], 106: [0.19444, 0.67937, 0, 0, 0.26667], 107: [0, 0.69444, 0, 0, 0.48889], 108: [0, 0.69444, 0, 0, 0.23889], 109: [0, 0.44444, 0, 0, 0.79445], 110: Hs, 111: [0, 0.44444, 0, 0, 0.5], 112: Vs, 113: Vs, 114: [0, 0.44444, 0.01389, 0, 0.34167], 115: Js, 116: [0, 0.57143, 0, 0, 0.36111], 117: Hs, 118: [0, 0.44444, 0.01389, 0, 0.46111], 119: [0, 0.44444, 0.01389, 0, 0.68334], 120: [0, 0.44444, 0, 0, 0.46111], 121: [0.19444, 0.44444, 0.01389, 0, 0.46111], 122: [0, 0.44444, 0, 0, 0.43472], 126: [0.35, 0.32659, 0, 0, 0.5], 160: N, 168: [0, 0.67937, 0, 0, 0.5], 176: tt, 184: Hn, 305: [0, 0.44444, 0, 0, 0.23889], 567: [0.19444, 0.44444, 0, 0, 0.26667], 710: re, 711: [0, 0.63194, 0, 0, 0.5], 713: [0, 0.60889, 0, 0, 0.5], 714: re, 715: re, 728: re, 729: [0, 0.67937, 0, 0, 0.27778], 730: tt, 732: [0, 0.67659, 0, 0, 0.5], 733: re, 915: Un, 916: Gs, 920: zt, 923: gt, 926: tt, 928: Zn, 931: Lr, 933: zt, 934: Lr, 936: zt, 937: Lr, 8211: [0, 0.44444, 0.02778, 0, 0.5], 8212: [0, 0.44444, 0.02778, 0, 1], 8216: Ye, 8217: Ye, 8220: re, 8221: re }, "Script-Regular": { 32: N, 65: [0, 0.7, 0.22925, 0, 0.80253], 66: [0, 0.7, 0.04087, 0, 0.90757], 67: [0, 0.7, 0.1689, 0, 0.66619], 68: [0, 0.7, 0.09371, 0, 0.77443], 69: [0, 0.7, 0.18583, 0, 0.56162], 70: [0, 0.7, 0.13634, 0, 0.89544], 71: [0, 0.7, 0.17322, 0, 0.60961], 72: [0, 0.7, 0.29694, 0, 0.96919], 73: [0, 0.7, 0.19189, 0, 0.80907], 74: [0.27778, 0.7, 0.19189, 0, 1.05159], 75: [0, 0.7, 0.31259, 0, 0.91364], 76: [0, 0.7, 0.19189, 0, 0.87373], 77: [0, 0.7, 0.15981, 0, 1.08031], 78: [0, 0.7, 0.3525, 0, 0.9015], 79: [0, 0.7, 0.08078, 0, 0.73787], 80: [0, 0.7, 0.08078, 0, 1.01262], 81: [0, 0.7, 0.03305, 0, 0.88282], 82: [0, 0.7, 0.06259, 0, 0.85], 83: [0, 0.7, 0.19189, 0, 0.86767], 84: [0, 0.7, 0.29087, 0, 0.74697], 85: [0, 0.7, 0.25815, 0, 0.79996], 86: [0, 0.7, 0.27523, 0, 0.62204], 87: [0, 0.7, 0.27523, 0, 0.80532], 88: [0, 0.7, 0.26006, 0, 0.94445], 89: [0, 0.7, 0.2939, 0, 0.70961], 90: [0, 0.7, 0.24037, 0, 0.8212], 160: N }, "Size1-Regular": { 32: N, 40: Ws, 41: Ws, 47: Us, 91: Zs, 92: Us, 93: Zs, 123: js, 125: js, 160: N, 710: Li, 732: Li, 770: Li, 771: Li, 8214: [-99e-5, 0.601, 0, 0, 0.77778], 8593: Xs, 8595: Xs, 8657: Ks, 8659: Ks, 8719: Ys, 8720: Ys, 8721: [0.25001, 0.75, 0, 0, 1.05556], 8730: [0.35001, 0.85, 0, 0, 1], 8739: [-599e-5, 0.606, 0, 0, 0.33333], 8741: [-599e-5, 0.606, 0, 0, 0.55556], 8747: e0, 8748: Qs, 8749: Qs, 8750: e0, 8896: tr, 8897: tr, 8898: tr, 8899: tr, 8968: rr, 8969: rr, 8970: rr, 8971: rr, 9168: Yn, 10216: rr, 10217: rr, 10752: Xn, 10753: Xn, 10754: Xn, 10756: tr, 10758: tr }, "Size2-Regular": { 32: N, 40: t0, 41: t0, 47: r0, 91: i0, 92: r0, 93: i0, 123: n0, 125: n0, 160: N, 710: Bi, 732: Bi, 770: Bi, 771: Bi, 8719: o0, 8720: o0, 8721: [0.55001, 1.05, 0, 0, 1.44445], 8730: [0.65002, 1.15, 0, 0, 1], 8747: s0, 8748: a0, 8749: a0, 8750: s0, 8896: ir, 8897: ir, 8898: ir, 8899: ir, 8968: Ti, 8969: Ti, 8970: Ti, 8971: Ti, 10216: l0, 10217: l0, 10752: Kn, 10753: Kn, 10754: Kn, 10756: ir, 10758: ir }, "Size3-Regular": { 32: N, 40: c0, 41: c0, 47: m0, 91: u0, 92: m0, 93: u0, 123: Di, 125: Di, 160: N, 710: zi, 732: zi, 770: zi, 771: zi, 8730: [0.95003, 1.45, 0, 0, 1], 8968: $i, 8969: $i, 8970: $i, 8971: $i, 10216: Di, 10217: Di }, "Size4-Regular": { 32: N, 40: h0, 41: h0, 47: d0, 91: p0, 92: d0, 93: p0, 123: Ei, 125: Ei, 160: N, 710: Ri, 732: Ri, 770: Ri, 771: Ri, 8730: [1.25003, 1.75, 0, 0, 1], 8968: Fi, 8969: Fi, 8970: Fi, 8971: Fi, 9115: Pi, 9116: f0, 9117: Pi, 9118: Pi, 9119: f0, 9120: Pi, 9121: Oi, 9122: Yn, 9123: Oi, 9124: Oi, 9125: Yn, 9126: Oi, 9127: g0, 9128: y0, 9129: b0, 9130: [0, 0.3, 0, 0, 0.88889], 9131: g0, 9132: y0, 9133: b0, 9143: [0.88502, 0.915, 0, 0, 1.05556], 10216: Ei, 10217: Ei, 57344: x0, 57345: x0, 57680: qi, 57681: qi, 57682: qi, 57683: qi }, "Typewriter-Regular": { 32: w0, 33: C, 34: C, 35: C, 36: Te, 37: Te, 38: C, 39: C, 40: Te, 41: Te, 42: [0, 0.52083, 0, 0, 0.525], 43: v0, 44: [0.13889, 0.125, 0, 0, 0.525], 45: v0, 46: [0, 0.125, 0, 0, 0.525], 47: Te, 48: C, 49: C, 50: C, 51: C, 52: C, 53: C, 54: C, 55: C, 56: C, 57: C, 58: he, 59: [0.13889, 0.43056, 0, 0, 0.525], 60: S0, 61: [-0.19549, 0.41562, 0, 0, 0.525], 62: S0, 63: C, 64: C, 65: C, 66: C, 67: C, 68: C, 69: C, 70: C, 71: C, 72: C, 73: C, 74: C, 75: C, 76: C, 77: C, 78: C, 79: C, 80: C, 81: [0.13889, 0.61111, 0, 0, 0.525], 82: C, 83: C, 84: C, 85: C, 86: C, 87: C, 88: C, 89: C, 90: C, 91: Te, 92: Te, 93: Te, 94: C, 95: [0.09514, 0, 0, 0, 0.525], 96: C, 97: he, 98: C, 99: he, 100: C, 101: he, 102: C, 103: zr, 104: C, 105: C, 106: [0.22222, 0.61111, 0, 0, 0.525], 107: C, 108: C, 109: he, 110: he, 111: he, 112: zr, 113: zr, 114: he, 115: he, 116: [0, 0.55358, 0, 0, 0.525], 117: he, 118: he, 119: he, 120: he, 121: zr, 122: he, 123: Te, 124: Te, 125: Te, 126: C, 127: C, 160: w0, 176: C, 184: [0.19445, 0, 0, 0, 0.525], 305: he, 567: zr, 711: [0, 0.56597, 0, 0, 0.525], 713: [0, 0.56555, 0, 0, 0.525], 714: C, 715: C, 728: C, 730: C, 770: C, 771: C, 776: C, 915: C, 916: C, 920: C, 923: C, 926: C, 928: C, 931: C, 933: C, 934: C, 936: C, 937: C, 8216: C, 8217: C, 8242: C, 9251: [0.11111, 0.21944, 0, 0, 0.525] } };
var Tl = /[\u3040-\u309F]|[\u30A0-\u30FF]|[\u4E00-\u9FAF]|[\uAC00-\uD7AF]/;
var Ge = 10;
var de = 0.25;
var k0 = 1.2;
var ve = 0.431;
var Qn = { slant: [0.25, 0.25, 0.25], space: [0, 0, 0], stretch: [0, 0, 0], shrink: [0, 0, 0], xHeight: [ve, ve, ve], quad: [1, 1.171, 1.472], extraSpace: [0, 0, 0], num1: [0.5, 0.732, 0.925], num2: [0.394, 0.384, 0.5], num3: [0.444, 0.471, 0.504], denom1: [0.686, 0.752, 1.025], denom2: [0.345, 0.344, 0.532], sup1: [0.413, 0.503, 0.504], sup2: [0.363, 0.431, 0.404], sup3: [0.289, 0.286, 0.294], sub1: [0.15, 0.143, 0.2], sub2: [0.247, 0.286, 0.4], supDrop: [0.386, 0.353, 0.494], subDrop: [0.05, 0.071, 0.1], delim1: [2.39, 1.7, 1.98], delim2: [1.01, 1.157, 1.42], axisHeight: [de, de, de], defaultRuleThickness: [0.04, 0.049, 0.049], bigOpSpacing1: [0.111, 0.111, 0.111], bigOpSpacing2: [0.166, 0.166, 0.166], bigOpSpacing3: [0.2, 0.2, 0.2], bigOpSpacing4: [0.6, 0.611, 0.611], bigOpSpacing5: [0.1, 0.143, 0.143], sqrtRuleThickness: [0.04, 0.04, 0.04] };
var $r = [0, 0.5, 0.7, 0.8, 0.9, 1, 1.2, 1.44, 1.728, 2.074, 2.488];
var Er = 5;
var A0 = { "\xA0": " ", "\u200B": " ", \u00C5: "A", \u00C7: "C", \u00D0: "D", \u00DE: "o", \u00E5: "a", \u00E7: "c", \u00F0: "d", \u00FE: "o", \u0410: "A", \u0411: "B", \u0412: "B", \u0413: "F", \u0414: "A", \u0415: "E", \u0416: "K", \u0417: "3", \u0418: "N", \u0419: "N", \u041A: "K", \u041B: "N", \u041C: "M", \u041D: "H", \u041E: "O", \u041F: "N", \u0420: "P", \u0421: "C", \u0422: "T", \u0423: "y", \u0424: "O", \u0425: "X", \u0426: "U", \u0427: "h", \u0428: "W", \u0429: "W", \u042A: "B", \u042B: "X", \u042C: "B", \u042D: "3", \u042E: "X", \u042F: "R", \u0430: "a", \u0431: "b", \u0432: "a", \u0433: "r", \u0434: "y", \u0435: "e", \u0436: "m", \u0437: "e", \u0438: "n", \u0439: "n", \u043A: "n", \u043B: "n", \u043C: "m", \u043D: "n", \u043E: "o", \u043F: "n", \u0440: "p", \u0441: "c", \u0442: "o", \u0443: "y", \u0444: "b", \u0445: "x", \u0446: "n", \u0447: "n", \u0448: "w", \u0449: "w", \u044A: "a", \u044B: "m", \u044C: "a", \u044D: "e", \u044E: "m", \u044F: "r" };
function bt(t33, e) {
  t33 === void 0 && (t33 = 77);
  let r = M0[e][t33];
  if (r) return { defaultMetrics: false, depth: r[0], height: r[1], italic: r[2], skew: r[3], width: r[4] };
  if (t33 === 11034) return { defaultMetrics: true, depth: 0.2, height: 0.8, italic: 0, skew: 0, width: 0.8 };
  let i = String.fromCodePoint(t33);
  if (i in A0) t33 = A0[i].codePointAt(0);
  else if (Tl.test(i)) return t33 = 77, { defaultMetrics: true, depth: 0.2, height: 0.9, italic: 0, skew: 0, width: 1 };
  return { defaultMetrics: true, depth: 0.2, height: 0.7, italic: 0, skew: 0, width: 0.8 };
}
function ge(t33) {
  return Array.isArray(t33);
}
var eo = { overrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"], overleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"], underrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"], underleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"], xrightarrow: [["rightarrow"], 1.469, 522, "xMaxYMin"], longrightarrow: [["rightarrow"], 1.469, 522, "xMaxYMin"], xleftarrow: [["leftarrow"], 1.469, 522, "xMinYMin"], longleftarrow: [["leftarrow"], 1.469, 522, "xMinYMin"], Overrightarrow: [["doublerightarrow"], 0.888, 560, "xMaxYMin"], xRightarrow: [["doublerightarrow"], 1.526, 560, "xMaxYMin"], xLeftarrow: [["doubleleftarrow"], 1.526, 560, "xMinYMin"], overleftharpoon: [["leftharpoon"], 0.888, 522, "xMinYMin"], xleftharpoonup: [["leftharpoon"], 0.888, 522, "xMinYMin"], xleftharpoondown: [["leftharpoondown"], 0.888, 522, "xMinYMin"], overrightharpoon: [["rightharpoon"], 0.888, 522, "xMaxYMin"], xrightharpoonup: [["rightharpoon"], 0.888, 522, "xMaxYMin"], xrightharpoondown: [["rightharpoondown"], 0.888, 522, "xMaxYMin"], xlongequal: [["longequal"], 0.888, 334, "xMinYMin"], xtwoheadleftarrow: [["twoheadleftarrow"], 0.888, 334, "xMinYMin"], xtwoheadrightarrow: [["twoheadrightarrow"], 0.888, 334, "xMaxYMin"], overleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522], overbrace: [["leftbrace", "midbrace", "rightbrace"], 1.6, 548], underbrace: [["leftbraceunder", "midbraceunder", "rightbraceunder"], 1.6, 548], underleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522], xleftrightarrow: [["leftarrow", "rightarrow"], 1.75, 522], longleftrightarrow: [["leftarrow", "rightarrow"], 1.75, 522], xLeftrightarrow: [["doubleleftarrow", "doublerightarrow"], 1.75, 560], xrightleftharpoons: [["leftharpoondownplus", "rightharpoonplus"], 1.75, 716], longrightleftharpoons: [["leftharpoondownplus", "rightharpoonplus"], 1.75, 716], xleftrightharpoons: [["leftharpoonplus", "rightharpoondownplus"], 1.75, 716], longleftrightharpoons: [["leftharpoonplus", "rightharpoondownplus"], 1.75, 716], xhookleftarrow: [["leftarrow", "righthook"], 1.08, 522], xhookrightarrow: [["lefthook", "rightarrow"], 1.08, 522], overlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522], underlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522], overgroup: [["leftgroup", "rightgroup"], 0.888, 342], undergroup: [["leftgroupunder", "rightgroupunder"], 0.888, 342], xmapsto: [["leftmapsto", "rightarrow"], 1.5, 522], xtofrom: [["leftToFrom", "rightToFrom"], 1.75, 528], xleftrightarrows: [["baraboveleftarrow", "rightarrowabovebar"], 1.75, 901], longleftrightarrows: [["baraboveleftarrow", "rightarrowabovebar"], 1.75, 901], xRightleftharpoons: [["baraboveshortleftharpoon", "rightharpoonaboveshortbar"], 1.75, 716], longRightleftharpoons: [["baraboveshortleftharpoon", "rightharpoonaboveshortbar"], 1.75, 716], xLeftrightharpoons: [["shortbaraboveleftharpoon", "shortrightharpoonabovebar"], 1.75, 716], longLeftrightharpoons: [["shortbaraboveleftharpoon", "shortrightharpoonabovebar"], 1.75, 716] };
var to = { widehat1: [1062, 239, 0.24], widehat2: [2364, 300, 0.3], widehat3: [2364, 360, 0.36], widehat4: [2364, 420, 0.42], widecheck1: [1062, 239, 0.24], widecheck2: [2364, 300, 0.3], widecheck3: [2364, 360, 0.36], widecheck4: [2364, 420, 0.42], widetilde1: [600, 260, 0.26], widetilde2: [1033, 286, 0.286], widetilde3: [2339, 306, 0.306], widetilde4: [2340, 312, 0.34], overarc: [1061, 159, 0.3], underarc: [1061, 159, 0.3] };
var _0 = { doubleleftarrow: `M262 157
l10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3
 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28
 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5
c2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5
 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87
-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7
-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z
m8 0v40h399730v-40zm0 194v40h399730v-40z`, doublerightarrow: `M399738 392l
-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5
 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88
-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68
-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18
-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782
c-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3
-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z`, leftarrow: `M400000 241H110l3-3c68.7-52.7 113.7-120
 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8
-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247
c-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208
 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3
 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202
 l-3-3h399890zM100 241v40h399900v-40z`, leftbrace: `M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117
-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7
 5-6 9-10 13-.7 1-7.3 1-20 1H6z`, leftbraceunder: `M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13
 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688
 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7
-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z`, overarc: "M529 0c179 0 524 115 524 115 5 1 9 5 9 10 0 1-1 2-1 3l-4 22c-1 5-5 9-11 9h-2s-338-93-512-92c-174 0-513 92-513 92h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13 0 0 342-115 520-115z", underarc: `m 529 160
  c -179 0 -524 -115 -524 -115
  c -5 -1 -9 -5 -9 -10
  c 0 -1 1 -2 1 -3
  l 4 -22
  c 1 -5 5 -9 11 -9
  h 2
  s 338 93 512 92
  c 174 0 513 -92 513 -92
  h 2
  c 5 0 9 4 11 9
  l 5 22
  c 1 6 -2 12 -8 13
  c 0 0 -342 115 -520 115
  z
  `, leftgroup: `M400000 80
H435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0
 435 0h399565z`, leftgroupunder: `M400000 262
H435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219
 435 219h399565z`, leftharpoon: `M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3
-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5
-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7
-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z`, leftharpoonplus: `M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5
 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3
-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7
-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z
m0 0v40h400000v-40z`, leftharpoondown: `M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333
 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5
 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667
-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z`, leftharpoondownplus: `M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12
 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7
-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0
v40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z`, lefthook: `M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5
-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3
-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21
 71.5 23h399859zM103 281v-40h399897v40z`, leftlinesegment: `M40 281 V428 H0 V94 H40 V241 H400000 v40z
M40 281 V428 H0 V94 H40 V241 H400000 v40z`, leftmapsto: `M40 281 V448H0V74H40V241H400000v40z
M40 281 V448H0V74H40V241H400000v40z`, leftToFrom: `M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23
-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8
c28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3
 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z`, longequal: `M0 50 h400000 v40H0z m0 194h40000v40H0z
M0 50 h400000 v40H0z m0 194h40000v40H0z`, midbrace: `M200428 334
c-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14
-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7
 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11
 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z`, midbraceunder: `M199572 214
c100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14
 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3
 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0
-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z`, oiintSize1: `M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6
-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z
m368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8
60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z`, oiintSize2: `M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8
-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z
m502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2
c0 110 84 276 504 276s502.4-166 502.4-276z`, oiiintSize1: `M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6
-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z
m525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0
85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z`, oiiintSize2: `M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8
-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z
m770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1
c0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z`, rightarrow: `M0 241v40h399891c-47.3 35.3-84 78-110 128
-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20
 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7
 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85
-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5
-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67
 151.7 139 205zm0 0v40h399900v-40z`, rightbrace: `M400000 542l
-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5
s-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1
c124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z`, rightbraceunder: `M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3
 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237
-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z`, rightgroup: `M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0
 3-1 3-3v-38c-76-158-257-219-435-219H0z`, rightgroupunder: `M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18
 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z`, rightharpoon: `M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3
-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2
-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58
 69.2 92 94.5zm0 0v40h399900v-40z`, rightharpoonplus: `M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11
-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7
 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z
m0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z`, rightharpoondown: `M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8
 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5
-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95
-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z`, rightharpoondownplus: `M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8
 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3
 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3
-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z
m0-194v40h400000v-40zm0 0v40h400000v-40z`, righthook: `M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3
 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0
-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21
 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z`, rightlinesegment: `M399960 241 V94 h40 V428 h-40 V281 H0 v-40z
M399960 241 V94 h40 V428 h-40 V281 H0 v-40z`, rightToFrom: `M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23
 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32
-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142
-167z M100 147v40h399900v-40zM0 341v40h399900v-40z`, twoheadleftarrow: `M0 167c68 40
 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69
-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3
-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19
-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101
 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z`, twoheadrightarrow: `M400000 167
c-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3
 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42
 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333
-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70
 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z`, widetilde1: `M200 55.538c-77 0-168 73.953-177 73.953-3 0-7
-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0
 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0
 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128
-68.267.847-113-73.952-191-73.952z`, widetilde2: `M344 55.266c-142 0-300.638 81.316-311.5 86.418
-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9
 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114
c1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751
 181.476 676 181.476c-149 0-189-126.21-332-126.21z`, widetilde3: `M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457
-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0
 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697
 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696
 -338 0-409-156.573-744-156.573z`, widetilde4: `M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345
-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409
 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9
 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409
 -175.236-744-175.236z`, vec: `M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5
3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11
10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63
-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1
-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59
H213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359
c-16-25.333-24-45-24-59z`, widehat1: `M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22
c-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z`, widehat2: `M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`, widehat3: `M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`, widehat4: `M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`, widecheck1: `M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,
-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z`, widecheck2: `M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`, widecheck3: `M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`, widecheck4: `M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`, baraboveleftarrow: `M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202
c4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5
c-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130
s-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47
121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6
s2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11
c0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z
M100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z`, rightarrowabovebar: `M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32
-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0
13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39
-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5
-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5
-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67
151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z`, baraboveshortleftharpoon: `M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11
c1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17
c2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21
c-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40
c-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z
M0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z`, rightharpoonaboveshortbar: `M0,241 l0,40c399126,0,399993,0,399993,0
c4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,
-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6
c-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z
M0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z`, shortbaraboveleftharpoon: `M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11
c1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,
1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,
-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z
M93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z`, shortrightharpoonabovebar: `M53,241l0,40c398570,0,399437,0,399437,0
c4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,
-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6
c-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z
M500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z` };
function C0(t33) {
  if (to[t33]) {
    let [c, h, d] = to[t33], f = `<span class="ML__stretchy" style="height:${d}em"><svg width="100%" height="${d}em" viewBox="0 0 ${c} ${h}" preserveAspectRatio="none" ><path fill="currentcolor" d="${_0[t33]}"></path></svg></span>`;
    return `<span style="display:inline-block;height:${Math.floor(100 * d / 2) / 100}em;min-width:0">${f}</span>`;
  }
  let [e, r, i, n] = eo[t33], o, a, s = i / 1e3;
  e.length === 3 ? (o = ["slice-1-of-3", "slice-2-of-3", "slice-3-of-3"], a = ["xMinYMin", "xMidYMin", "xMaxYMin"]) : e.length === 2 ? (o = ["slice-1-of-2", "slice-2-of-2"], a = ["xMinYMin", "xMaxYMin"]) : (o = ["slice-1-of-1"], a = [n]);
  let l = e.map((c, h) => `<span class="${o[h]}" style=height:${s}em><svg width=400em height=${s}em viewBox="0 0 400000 ${i}" preserveAspectRatio="${a[h]} slice"><path fill="currentcolor" d="${_0[c]}"></path></svg></span>`).join("");
  return `<span style="display:inline-block;height:${s}em;min-width:${r}em;">${l}</span>`;
}
function L0(t33) {
  return eo[t33] ? eo[t33][2] / 1e3 : to[t33][2];
}
var Dl = { m0: "#3F3D99", m1: "#993D71", m2: "#998B3D", m3: "#3D9956", m4: "#3D5A99", m5: "#993D90", m6: "#996D3D", m7: "#43993D", m8: "#3D7999", m9: "#843D99" };
var zl = { blue: "#0072BD", orange: "#D95319", yellow: "#EDB120", purple: "#7E2F8E", green: "#77AC30", cyan: "#4DBEEE", red: "#A2142F" };
var B0 = { red: "#fbbbb6", orange: "#ffe0c2", yellow: "#fff1c2", lime: "#d0e8b9", green: "#bceac4", teal: "#b9f1f1", cyan: "#b8e5c9", blue: "#b6d9fb", indigo: "#d1c2f0", purple: "#e3baf8", magenta: "#f9c8e0", black: "#353535", "dark-grey": "#8C8C8C", grey: "#D0D0D0", "light-grey": "#F0F0F0", white: "#ffffff" };
var T0 = { red: "#d7170b", orange: "#fe8a2b", yellow: "#ffc02b", lime: "#63b215", green: "#21ba3a", teal: "#17cfcf", cyan: "#13a7ec", blue: "#0d80f2", indigo: "#63c", purple: "#a219e6", magenta: "#eb4799", black: "#000", "dark-grey": "#666", grey: "#A6A6A6", "light-grey": "#d4d5d2", white: "#ffffff" };
var D0 = { Red: "red", Orange: "orange", Yellow: "yellow", LimeGreen: "lime", Green: "green", TealBlue: "teal", Blue: "blue", Violet: "indigo", Purple: "purple", Magenta: "magenta", Black: "black", Gray: "grey", White: "white" };
var $l = { Apricot: "#FBB982", Aquamarine: "#00B5BE", Bittersweet: "#C04F17", Black: "#221E1F", Blue: "#2D2F92", BlueGreen: "#00B3B8", BlueViolet: "#473992", BrickRed: "#B6321C", Brown: "#792500", BurntOrange: "#F7921D", CadetBlue: "#74729A", CarnationPink: "#F282B4", Cerulean: "#00A2E3", CornflowerBlue: "#41B0E4", Cyan: "#00AEEF", Dandelion: "#FDBC42", DarkOrchid: "#A4538A", Emerald: "#00A99D", ForestGreen: "#009B55", Fuchsia: "#8C368C", Goldenrod: "#FFDF42", Gray: "#949698", Green: "#00A64F", GreenYellow: "#DFE674", JungleGreen: "#00A99A", Lavender: "#F49EC4", Limegreen: "#8DC73E", Magenta: "#EC008C", Mahogany: "#A9341F", Maroon: "#AF3235", Melon: "#F89E7B", MidnightBlue: "#006795", Mulberry: "#A93C93", NavyBlue: "#006EB8", OliveGreen: "#3C8031", Orange: "#F58137", OrangeRed: "#ED135A", Orchid: "#AF72B0", Peach: "#F7965A", Periwinkle: "#7977B8", PineGreen: "#008B72", Plum: "#92268F", ProcessBlue: "#00B0F0", Purple: "#99479B", RawSienna: "#974006", Red: "#ED1B23", RedOrange: "#F26035", RedViolet: "#A1246B", Rhodamine: "#EF559F", RoyalBlue: "#0071BC", RoyalPurple: "#613F99", RubineRed: "#ED017D", Salmon: "#F69289", SeaGreen: "#3FBC9D", Sepia: "#671800", SkyBlue: "#46C5DD", SpringGreen: "#C6DC67", Tan: "#DA9D76", TealBlue: "#00AEB3", Thistle: "#D883B7", Turquoise: "#00B4CE", Violet: "#58429B", VioletRed: "#EF58A0", White: "#FFFFFF", WildStrawberry: "#EE2967", Yellow: "#FFF200", YellowGreen: "#98CC70", YellowOrange: "#FAA21A" };
function no(t33) {
  var h, d, f, S, x, w;
  let e = t33.split("!"), r, i, n, o = 255, a = 255, s = 255, l = -1, c = e.length > 0 && e[0].startsWith("-");
  c && (e[0] = e[0].slice(1));
  for (let T = 0; T < e.length; T++) {
    r = o, i = a, n = s;
    let b = (h = e[T].trim().match(/^([A-Za-z\d-]+)/)) == null ? void 0 : h[1], A = b == null ? void 0 : b.toLowerCase(), k = b && (w = (x = (S = (f = (d = T0[A]) != null ? d : T0[D0[b]]) != null ? f : zl[b]) != null ? S : $l[b]) != null ? x : Dl[b]) != null ? w : e[T].trim(), L = k.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (L != null && L[1] && L[2] && L[3]) o = Math.max(0, Math.min(255, Number.parseInt(L[1], 16))), a = Math.max(0, Math.min(255, Number.parseInt(L[2], 16))), s = Math.max(0, Math.min(255, Number.parseInt(L[3], 16)));
    else if (L = k.match(/^#([\da-f]{3})$/i), L != null && L[1]) {
      let P = Number.parseInt(L[1][0], 16), B = Number.parseInt(L[1][1], 16), _ = Number.parseInt(L[1][2], 16);
      o = Math.max(0, Math.min(255, P * 16 + P)), a = Math.max(0, Math.min(255, B * 16 + B)), s = Math.max(0, Math.min(255, _ * 16 + _));
    } else if (L = k.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i), L != null && L[1] && L[2] && L[3]) o = Math.max(0, Math.min(255, Number.parseInt(L[1]))), a = Math.max(0, Math.min(255, Number.parseInt(L[2]))), s = Math.max(0, Math.min(255, Number.parseInt(L[3])));
    else return;
    l >= 0 && (o = (1 - l) * o + l * r, a = (1 - l) * a + l * i, s = (1 - l) * s + l * n, l = -1), T + 1 < e.length && (l = Math.max(0, Math.min(100, Number.parseInt(e[++T]))) / 100);
  }
  return l >= 0 && (o = l * o + (1 - l) * r, a = l * a + (1 - l) * i, s = l * s + (1 - l) * n), c && (o = 255 - o, a = 255 - a, s = 255 - s), "#" + ("00" + Math.round(o).toString(16)).slice(-2) + ("00" + Math.round(a).toString(16)).slice(-2) + ("00" + Math.round(s).toString(16)).slice(-2);
}
function z0(t33) {
  var e, r;
  return t33 = t33.trim(), (r = (e = B0[t33.toLowerCase()]) != null ? e : B0[D0[t33]]) != null ? r : no(t33);
}
function El(t33) {
  if (!t33 || t33[0] !== "#") return;
  t33 = t33.slice(1);
  let e;
  return t33.length <= 4 ? (e = { r: parseInt(t33[0] + t33[0], 16), g: parseInt(t33[1] + t33[1], 16), b: parseInt(t33[2] + t33[2], 16) }, t33.length === 4 && (e.a = parseInt(t33[3] + t33[3], 16) / 255)) : (e = { r: parseInt(t33[0] + t33[1], 16), g: parseInt(t33[2] + t33[3], 16), b: parseInt(t33[4] + t33[5], 16) }, t33.length === 8 && (e.a = parseInt(t33[6] + t33[7], 16) / 255)), e && e.a === void 0 && (e.a = 1), e;
}
function ro(t33, e, r) {
  return r < 0 && (r += 6), r >= 6 && (r -= 6), r < 1 ? (e - t33) * r + t33 : r < 3 ? e : r < 4 ? (e - t33) * (4 - r) + t33 : t33;
}
function Rl(t33) {
  let [e, r, i] = [t33.h, t33.s, t33.l];
  e = (e + 360) % 360 / 60, i = Math.max(0, Math.min(i, 1)), r = Math.max(0, Math.min(r, 1));
  let n = i <= 0.5 ? i * (r + 1) : i + r - i * r, o = i * 2 - n;
  return { r: Math.round(255 * ro(o, n, e + 2)), g: Math.round(255 * ro(o, n, e)), b: Math.round(255 * ro(o, n, e - 2)) };
}
function io(t33) {
  return t33 < 0 ? 0 : t33 > 255 ? 255 : Math.round(t33);
}
function Fl(t33) {
  let { r: e, g: r, b: i } = t33, n = ((1 << 24) + (io(e) << 16) + (io(r) << 8) + io(i)).toString(16).slice(1);
  return n[0] === n[1] && n[2] === n[3] && n[4] === n[5] && n[6] === n[7] && (n = n[0] + n[2] + n[4]), "#" + n;
}
function Pl(t33) {
  let { r: e, g: r, b: i } = t33;
  e = e / 255, r = r / 255, i = i / 255;
  let n = Math.min(e, r, i), o = Math.max(e, r, i), a = o - n, s, l;
  o === n ? s = 0 : e === o ? s = (r - i) / a : r === o ? s = 2 + (i - e) / a : i === o && (s = 4 + (e - r) / a), s = Math.min(s * 60, 360), s < 0 && (s += 360);
  let c = (n + o) / 2;
  return o === n ? l = 0 : c <= 0.5 ? l = a / (o + n) : l = a / (2 - o - n), { h: s, s: l, l: c };
}
function $0(t33) {
  let e = El(t33);
  if (!e) return t33;
  let { h: r, s: i, l: n } = Pl(e);
  return i += 0.1, n -= 0.1, Fl(Rl({ h: r, s: i, l: n }));
}
function Ii() {
  return "window" in globalThis && "document" in globalThis;
}
function R0() {
  if (!Ii()) return true;
  if (/firefox/i.test(navigator.userAgent)) {
    let t33 = navigator.userAgent.match(/firefox\/(\d+)/i);
    return t33 ? parseInt(t33[1]) >= 78 : false;
  }
  if (/trident/i.test(navigator.userAgent)) return false;
  if (/edge/i.test(navigator.userAgent)) {
    let t33 = navigator.userAgent.match(/edg\/(\d+)/i);
    return t33 ? parseInt(t33[1]) >= 79 : false;
  }
  return true;
}
var ao = { 60: "\\lt", 62: "\\gt", 111: "o", 38: "\\&", 123: "\\lbrace", 125: "\\rbrace", 91: "\\lbrack", 93: "\\rbrack", 58: "\\colon", 160: "~", 172: "\\neg", 183: "\\cdot", 188: "\\frac{1}{4}", 189: "\\frac{1}{2}", 190: "\\frac{3}{4}", 8304: "^{0}", 8305: "^{i}", 185: "^{1}", 178: "^{2}", 179: "^{3}", 8224: "\\dagger", 8225: "\\ddagger", 8230: "\\ldots", 8308: "^{4}", 8309: "^{5}", 8310: "^{6}", 8311: "^{7}", 8312: "^{8}", 8313: "^{9}", 8314: "^{+}", 8315: "^{-}", 8316: "^{=}", 8319: "^{n}", 8320: "_{0}", 8321: "_{1}", 8322: "_{2}", 8323: "_{3}", 8324: "_{4}", 8325: "_{5}", 8326: "_{6}", 8327: "_{7}", 8328: "_{8}", 8329: "_{9}", 8330: "_{+}", 8331: "_{-}", 8332: "_{=}", 8336: "_{a}", 8337: "_{e}", 8338: "_{o}", 8339: "_{x}", 8242: "\\prime", 39: "\\prime", 8592: "\\gets", 8594: "\\to", 9651: "\\triangle", 9661: "\\triangledown", 8715: "\\owns", 8727: "\\ast", 8739: "\\vert", 8741: "\\Vert", 8743: "\\land", 8744: "\\lor", 8901: "\\cdot", 8904: "\\bowtie", 8800: "\\ne", 8804: "\\le", 8805: "\\ge", 8869: "\\bot", 10178: "\\perp", 10231: "\\biconditional", 10232: "\\impliedby", 10233: "\\implies", 10234: "\\iff", 8450: "\\mathbb{C}", 8469: "\\mathbb{N}", 8473: "\\mathbb{P}", 8474: "\\mathbb{Q}", 8477: "\\mathbb{R}", 8484: "\\mathbb{Z}", 8461: "\\mathbb{H}", 8476: "\\Re", 8465: "\\Im", 42: "\\ast", 11036: "\\square", 9633: "\\square", 8720: "\\coprod", 8716: "\\not\\ni", 9671: "\\diamond", 8846: "\\uplus", 8851: "\\sqcap", 8852: "\\sqcup", 8768: "\\wr", 8750: "\\oint", 8226: "\\textbullet", 8722: "-", 978: "\\Upsilon" };
var oo = { 119893: 8462, 119965: 8492, 119968: 8496, 119969: 8497, 119971: 8459, 119972: 8464, 119975: 8466, 119976: 8499, 119981: 8475, 119994: 8495, 119996: 8458, 120004: 8500, 120070: 8493, 120075: 8460, 120076: 8465, 120085: 8476, 120093: 8488, 120122: 8450, 120127: 8461, 120133: 8469, 120135: 8473, 120136: 8474, 120137: 8477, 120145: 8484 };
var F0 = [{ start: 119808, len: 26, offset: 65, style: "bold" }, { start: 119834, len: 26, offset: 97, style: "bold" }, { start: 120488, len: 25, offset: 913, style: "bold" }, { start: 120514, len: 25, offset: 945, style: "bold" }, { start: 119860, len: 26, offset: 65, style: "italic" }, { start: 119886, len: 26, offset: 97, style: "italic" }, { start: 120546, len: 25, offset: 913, style: "italic" }, { start: 120572, len: 25, offset: 945, style: "italic" }, { start: 119912, len: 26, offset: 65, style: "bolditalic" }, { start: 119938, len: 26, offset: 97, style: "bolditalic" }, { start: 120604, len: 25, offset: 913, style: "bolditalic" }, { start: 120630, len: 25, offset: 945, style: "bolditalic" }, { start: 120782, len: 10, offset: 48, variant: "main", style: "bold" }, { start: 119964, len: 26, offset: 65, variant: "script" }, { start: 119990, len: 26, offset: 97, variant: "script" }, { start: 120016, len: 26, offset: 65, variant: "script", style: "bold" }, { start: 120042, len: 26, offset: 97, variant: "script", style: "bold" }, { start: 120068, len: 26, offset: 65, variant: "fraktur" }, { start: 120094, len: 26, offset: 97, variant: "fraktur" }, { start: 120172, len: 26, offset: 65, variant: "fraktur", style: "bold" }, { start: 120198, len: 26, offset: 97, variant: "fraktur", style: "bold" }, { start: 120120, len: 26, offset: 65, variant: "double-struck" }, { start: 120146, len: 26, offset: 97, variant: "double-struck" }, { start: 120792, len: 10, offset: 48, variant: "double-struck" }, { start: 120432, len: 26, offset: 65, variant: "monospace" }, { start: 120458, len: 26, offset: 97, variant: "monospace" }, { start: 120822, len: 10, offset: 48, variant: "monospace" }, { start: 120224, len: 26, offset: 65, variant: "sans-serif" }, { start: 120250, len: 26, offset: 97, variant: "sans-serif" }, { start: 120276, len: 26, offset: 65, variant: "sans-serif", style: "bold" }, { start: 120302, len: 26, offset: 97, variant: "sans-serif", style: "bold" }, { start: 120328, len: 26, offset: 65, variant: "sans-serif", style: "italic" }, { start: 120354, len: 26, offset: 97, variant: "sans-serif", style: "italic" }, { start: 120380, len: 26, offset: 65, variant: "sans-serif", style: "bolditalic" }, { start: 120406, len: 26, offset: 97, variant: "sans-serif", style: "bolditalic" }, { start: 120662, len: 25, offset: 913, variant: "sans-serif", style: "bold" }, { start: 120688, len: 25, offset: 945, variant: "sans-serif", style: "bold" }, { start: 120720, len: 25, offset: 913, variant: "sans-serif", style: "bolditalic" }, { start: 120746, len: 25, offset: 945, variant: "sans-serif", style: "bolditalic" }, { start: 120803, len: 10, offset: 48, variant: "sans-serif" }, { start: 120812, len: 10, offset: 48, variant: "sans-serif", style: "bold" }];
function Rr(t33, e, r) {
  if (!/[A-Za-z\d]/.test(t33) || (r === "up" && (r = void 0), !e && !r)) return;
  let i = t33.codePointAt(0);
  if (i === void 0) return t33;
  for (let n of F0) if ((!e || n.variant === e) && (!r || n.style === r) && i >= n.offset && i < n.offset + n.len) {
    let o = n.start + i - n.offset;
    return String.fromCodePoint(oo[o] || o);
  }
}
function Ol(t33) {
  var e;
  if ((t33 < 119808 || t33 > 120831) && (t33 < 8448 || t33 > 8527)) return { char: String.fromCodePoint(t33) };
  for (let r in oo) if (oo[r] === t33) {
    t33 = (e = r.codePointAt(0)) != null ? e : 0;
    break;
  }
  for (let r of F0) if (t33 >= r.start && t33 < r.start + r.len) return { char: String.fromCodePoint(t33 - r.start + r.offset), variant: r.variant, style: r.style };
  return { char: String.fromCodePoint(t33) };
}
function P0(t33) {
  var a;
  if ("{}<>[]$&*#^_%:'\u02DC".includes(t33) || t33.length > 1) return;
  let e = (a = t33.codePointAt(0)) != null ? a : 0, r = ao[e];
  if (r) return r;
  let { char: i, variant: n, style: o } = Ol(e);
  if (!(!n && !o)) {
    switch (r = i, n) {
      case "double-struck":
        r = `\\mathbb{${r}}`;
        break;
      case "fraktur":
        r = `\\mathfrak{${r}}`;
        break;
      case "script":
        r = `\\mathscr{${r}}`;
        break;
      case "sans-serif":
        r = `\\mathsf{${r}}`;
        break;
      case "monospace":
        r = `\\mathtt{${r}}`;
        break;
      case "calligraphic":
        r = `\\mathcal{${r}}`;
        break;
    }
    switch (o) {
      case "bold":
        r = `\\mathbf{${r}}`;
        break;
      case "italic":
        r = `\\mathit{${r}}`;
        break;
      case "bolditalic":
        r = `\\mathbfit{${r}}`;
        break;
    }
    return r;
  }
}
function M(t33) {
  return t33 ? Array.isArray(t33) ? t33 : typeof t33 == "object" && "group" in t33 ? t33.group : [] : [];
}
var so = {};
var Vi = m({}, ao);
var lo = {};
var mo = {};
var ql = { darr: "\\downarrow", dArr: "\\Downarrow", Darr: "\\Downarrow", lang: "\\langle", rang: "\\rangle", uarr: "\\uparrow", uArr: "\\Uparrow", Uarr: "\\Uparrow", C: "\\mathbb{C}", H: "\\mathbb{H}", N: "\\mathbb{N}", Q: "\\mathbb{Q}", R: "\\mathbb{R}", Z: "\\mathbb{Z}", alef: "\\aleph", alefsym: "\\aleph", Alpha: "\\mathrm{A}", Beta: "\\mathrm{B}", bull: "\\bullet", Chi: "\\mathrm{X}", clubs: "\\clubsuit", cnums: "\\mathbb{C}", Complex: "\\mathbb{C}", Dagger: "\\ddagger", diamonds: "\\diamondsuit", doublecap: "\\Cap", doublecup: "\\Cup", empty: "\\emptyset", Epsilon: "\\mathrm{E}", Eta: "\\mathrm{H}", exist: "\\exists", hArr: "\\Leftrightarrow", harr: "\\leftrightarrow", Harr: "\\Leftrightarrow", hearts: "\\heartsuit", image: "\\Im", infin: "\\infty", Iota: "\\mathrm{I}", isin: "\\in", Kappa: "\\mathrm{K}", larr: "\\leftarrow", Larr: "\\Leftarrow", lArr: "\\Leftarrow", lrarr: "\\leftrightarrow", Lrarr: "\\Leftrightarrow", lrArr: "\\Leftrightarrow", Mu: "\\mathrm{M}", natnums: "\\mathbb{N}", Nu: "\\mathrm{N}", Omicron: "\\mathrm{O}", part: "\\partial", plusmn: "\\pm", rarr: "\\rightarrow", Rarr: "\\Rightarrow", rArr: "\\Rightarrow", real: "\\Re", reals: "\\mathbb{R}", Reals: "\\mathbb{R}", restriction: "\\upharpoonright", Rho: "\\mathrm{P}", sdot: "\\cdot", sect: "\\S", spades: "\\spadesuit", sub: "\\subset", sube: "\\subseteq", supe: "\\supseteq", Tau: "\\mathrm{T}", thetasym: "\\vartheta", varcoppa: "\\coppa", weierp: "\\wp", Zeta: "\\mathrm{Z}" };
var Il = { varGamma: "\\mathit{\\Gamma}", varDelta: "\\mathit{\\Delta}", varTheta: "\\mathit{\\Theta}", varLambda: "\\mathit{\\Lambda}", varXi: "\\mathit{\\Xi}", varPi: "\\mathit{\\Pi}", varSigma: "\\mathit{\\Sigma}", varUpsilon: "\\mathit{\\Upsilon}", varPhi: "\\mathit{\\Phi}", varPsi: "\\mathit{\\Psi}", varOmega: "\\mathit{\\Omega}", pmod: { def: "\\quad(\\operatorname{mod}\\ #1)", args: 1, expand: false, captureSelection: false }, mod: { def: "\\quad\\operatorname{mod}\\,\\,#1", args: 1, expand: false }, bmod: { def: "\\;\\mathbin{\\operatorname{mod }}", expand: false } };
var Nl = { bra: { def: "\\mathinner{\\langle{#1}|}", args: 1, captureSelection: false }, ket: { def: "\\mathinner{|{#1}\\rangle}", args: 1, captureSelection: false }, braket: { def: "\\mathinner{\\langle{#1}\\rangle}", args: 1, captureSelection: false }, set: { def: "\\mathinner{\\lbrace #1 \\rbrace}", args: 1, captureSelection: false }, Bra: { def: "\\left\\langle #1\\right|", args: 1, captureSelection: false }, Ket: { def: "\\left|#1\\right\\rangle", args: 1, captureSelection: false }, Braket: { def: "\\left\\langle{#1}\\right\\rangle", args: 1, captureSelection: false }, Set: { def: "\\left\\lbrace #1 \\right\\rbrace", args: 1, captureSelection: false } };
var Vl = { strut: { primitive: true, def: "\\phantom{\\rule[0.3\\baselineskip]{0}{0.7\\baselineskip}}", args: 0, captureSelection: true }, iff: { primitive: true, captureSelection: true, def: "\\;\\Longleftrightarrow\\;" }, nicefrac: "^{#1}\\!\\!/\\!_{#2}", phase: { def: "\\enclose{phasorangle}{#1}", args: 1, captureSelection: false }, rd: "\\mathrm{d}", rD: "\\mathrm{D}", odif: "\\mathrm{d}", doubleStruckCapitalN: "\\mathbb{N}", doubleStruckCapitalR: "\\mathbb{R}", doubleStruckCapitalQ: "\\mathbb{Q}", doubleStruckCapitalZ: "\\mathbb{Z}", doubleStruckCapitalP: "\\mathbb{P}", scriptCapitalE: "\\mathscr{E}", scriptCapitalH: "\\mathscr{H}", scriptCapitalL: "\\mathscr{L}", gothicCapitalC: "\\mathfrak{C}", gothicCapitalH: "\\mathfrak{H}", gothicCapitalI: "\\mathfrak{I}", gothicCapitalR: "\\mathfrak{R}", imaginaryI: "\\mathrm{i}", imaginaryJ: "\\mathrm{j}", exponentialE: "\\mathrm{e}", differentialD: "\\mathrm{d}", capitalDifferentialD: "\\mathrm{D}", mathstrut: { def: "\\vphantom{(}", primitive: true }, angl: "\\enclose{actuarial}{#1}", angln: "\\enclose{actuarial}{n}", anglr: "\\enclose{actuarial}{r}", anglk: "\\enclose{actuarial}{k}", mathtools: { primitive: true, package: { ordinarycolon: ":", vcentcolon: "\\mathrel{\\mathop\\ordinarycolon}", dblcolon: '{\\mathop{\\char"2237}}', coloneqq: '{\\mathop{\\char"2254}}', Coloneqq: '{\\mathop{\\char"2A74}}', coloneq: '{\\mathop{\\char"2254}}', Coloneq: '{\\mathop{\\char"2A74}}', eqqcolon: '{\\mathop{\\char"2255}}', Eqqcolon: '{\\mathop{\\char"3D\\char"2237}}', eqcolon: '{\\mathop{\\char"2255}}', Eqcolon: '{\\mathop{\\char"3D\\char"2237}}', colonapprox: '{\\mathop{\\char"003A\\char"2248}}', Colonapprox: '{\\mathop{\\char"2237\\char"2248}}', colonsim: '{\\mathop{\\char"3A\\char"223C}}', Colonsim: '{\\mathop{\\char"2237\\char"223C}}', colondash: "\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}", Colondash: "\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}", dashcolon: "\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}", Dashcolon: "\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}" } }, ratio: "\\vcentcolon", coloncolon: "\\dblcolon", colonequals: "\\coloneq", coloncolonequals: "\\Coloneq", equalscolon: "\\eqcolon", equalscoloncolon: "\\Eqcolon", colonminus: "\\colondash", coloncolonminus: "\\Colondash", minuscolon: "\\dashcolon", minuscoloncolon: "\\Dashcolon", coloncolonapprox: "\\Colonapprox", coloncolonsim: "\\Colonsim", simcolon: "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}", Simcolon: "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}", simcoloncolon: "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}", approxcolon: "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}", Approxcolon: "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}", approxcoloncolon: "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}", notni: "\\mathrel{\\char`\u220C}", limsup: "\\operatorname*{lim\\,sup}", liminf: "\\operatorname*{lim\\,inf}", injlim: "\\operatorname*{inj\\,lim}", projlim: "\\operatorname*{proj\\,lim}", varlimsup: "\\operatorname*{\\overline{lim}}", varliminf: "\\operatorname*{\\underline{lim}}", varinjlim: "\\operatorname*{\\underrightarrow{lim}}", varprojlim: "\\operatorname*{\\underleftarrow{lim}}", argmin: "\\operatorname*{arg\\,min}", argmax: "\\operatorname*{arg\\,max}", plim: "\\mathop{\\operatorname{plim}}\\limits", tripledash: { def: "\\vphantom{-}\\raise{4mu}{\\mkern1.5mu\\rule{2mu}{1.5mu}\\mkern{2.25mu}\\rule{2mu}{1.5mu}\\mkern{2.25mu}\\rule{2mu}{1.5mu}\\mkern{2mu}}", expand: true }, "braket.sty": { package: Nl }, "amsmath.sty": { package: Il, primitive: true }, "texvc.sty": { package: ql, primitive: false } };
var nr = { " ": 32, "\\!": 33, "\\#": 35, "\\$": 36, "\\%": 37, "\\&": 38, "\\_": 95, "-": 45, "\\textunderscore": 95, "\\euro": 8364, "\\maltese": 10016, "\\{": 123, "\\}": 125, "\\textbraceleft": 123, "\\textbraceright": 125, "\\lbrace": 123, "\\rbrace": 125, "\\lbrack": 91, "\\rbrack": 93, "\\nobreakspace": 160, "\\ldots": 8230, "\\textellipsis": 8230, "\\backslash": 92, "`": 8216, "'": 8217, "``": 8220, "''": 8221, "\\degree": 176, "\\textasciicircum": 94, "\\textasciitilde": 126, "\\textasteriskcentered": 42, "\\textbackslash": 92, "\\textbullet": 8226, "\\textdollar": 36, "\\textsterling": 163, "\\textdagger": 8224, "\\textdaggerdbl": 8225, "\u2013": 8211, "\u2014": 8212, "\u2018": 8216, "\u2019": 8217, "\u201C": 8220, "\u201D": 8221, '"': 8221, "\\ss": 223, "\\ae": 230, "\\oe": 339, "\\AE": 198, "\\OE": 338, "\\O": 216, "\\i": 305, "\\j": 567, "\\aa": 229, "\\AA": 197 };
var Ji;
var O0;
R0() ? (Ji = new RegExp("\\p{Letter}", "u"), O0 = new RegExp("[0-9\\p{Letter}]", "u")) : (Ji = /[a-zA-ZаАбБвВгГдДеЕёЁжЖзЗиИйЙкКлЛмМнНоОпПрРсСтТуУфФхХцЦчЧшШщЩъЪыЫьЬэЭюЮяĄąĆćĘęŁłŃńÓóŚśŹźŻżàâäôéèëêïîçùûüÿæœÀÂÄÔÉÈËÊÏÎŸÇÙÛÜÆŒößÖẞìíòúÌÍÒÚáñÁÑ]/, O0 = /[\da-zA-ZаАбБвВгГдДеЕёЁжЖзЗиИйЙкКлЛмМнНоОпПрРсСтТуУфФхХцЦчЧшШщЩъЪыЫьЬэЭюЮяĄąĆćĘęŁłŃńÓóŚśŹźŻżàâäôéèëêïîçùûüÿæœÀÂÄÔÉÈËÊÏÎŸÇÙÛÜÆŒößÖẞìíòúÌÍÒÚáñÁÑ]/);
function co(t33, e, r = "mord", i) {
  e !== void 0 && (so[t33] = { definitionType: "symbol", type: r, variant: i, codepoint: e }, Vi[e] || (Vi[e] = t33));
}
function ie(t33, e, r) {
  if (typeof t33 == "string") {
    for (let i = 0; i < t33.length; i++) {
      let n = t33.charAt(i);
      co(n, n.codePointAt(0));
    }
    return;
  }
  for (let [i, n, o, a] of t33) co(i, n, o != null ? o : e, a != null ? a : r);
}
function uo(t33, e) {
  for (let r = t33; r <= e; r++) co(String.fromCodePoint(r), r);
}
function N0(t33) {
  var e;
  return (e = mo[t33]) != null ? e : null;
}
function q0(t33) {
  let e = "auto", r = t33.match(/:([^=]+)/);
  return r && (e = r[1].trim()), e;
}
function Hi(t33) {
  if (!t33) return [];
  let e = [], r = t33.split("]");
  if (r[0].startsWith("[")) {
    e.push({ isOptional: true, type: q0(r[0].slice(1)) });
    for (let i = 1; i <= r.length; i++) e.push(...Hi(r[i]));
  } else if (r = t33.split("}"), r[0].startsWith("{")) {
    e.push({ isOptional: false, type: q0(r[0].slice(1)) });
    for (let i = 1; i <= r.length; i++) e.push(...Hi(r[i]));
  }
  return e;
}
function ho(t33) {
  if (!t33) return "";
  let e = "", r = true;
  for (let i of t33) typeof i.value == "string" ? e += i.value : r = false;
  return r ? e : "";
}
function We(t33, e, r) {
  typeof t33 == "string" && (t33 = [t33]);
  let n = { tabular: true, rootOnly: false, params: Hi(e), createAtom: r };
  for (let o of t33) mo[o] = n;
}
function Gi(t33, e, r) {
  var n;
  typeof t33 == "string" && (t33 = [t33]);
  let i = { tabular: (n = r == null ? void 0 : r.tabular) != null ? n : false, rootOnly: true, params: [], createAtom: e };
  for (let o of t33) mo[o] = i;
}
function g(t33, e, r) {
  var n, o;
  r || (r = {});
  let i = { definitionType: "function", params: Hi(e), ifMode: r.ifMode, isFunction: (n = r.isFunction) != null ? n : false, applyMode: r.applyMode, infix: (o = r.infix) != null ? o : false, parse: r.parse, createAtom: r.createAtom, applyStyle: r.applyStyle, serialize: r.serialize, render: r.render };
  if (typeof t33 == "string") lo["\\" + t33] = i;
  else for (let a of t33) lo["\\" + a] = i;
}
var Ni;
function Wi(t33) {
  return Ni || (Ni = Fr(Vl)), t33 ? Fr(m(m({}, Ni), t33)) : Ni;
}
function I0(t33, e) {
  var r, i, n, o;
  if (typeof t33 == "string") {
    let a = 0, s = t33;
    return /(^|[^\\])#1/.test(s) && (a = 1), /(^|[^\\])#2/.test(s) && (a = 2), /(^|[^\\])#3/.test(s) && (a = 3), /(^|[^\\])#4/.test(s) && (a = 4), /(^|[^\\])#5/.test(s) && (a = 5), /(^|[^\\])#6/.test(s) && (a = 6), /(^|[^\\])#7/.test(s) && (a = 7), /(^|[^\\])#8/.test(s) && (a = 8), /(^|[^\\])#9/.test(s) && (a = 9), { expand: (r = e == null ? void 0 : e.expand) != null ? r : true, captureSelection: (i = e == null ? void 0 : e.captureSelection) != null ? i : true, args: a, def: s };
  }
  return m({ expand: (n = e == null ? void 0 : e.expand) != null ? n : true, captureSelection: (o = e == null ? void 0 : e.captureSelection) != null ? o : true, args: 0 }, t33);
}
function Fr(t33) {
  if (!t33) return {};
  let e = {};
  for (let r of Object.keys(t33)) {
    let i = t33[r];
    if (i == null) delete e[r];
    else if (typeof i == "object" && "package" in i) for (let n of Object.keys(i.package)) e[n] = I0(i.package[n], { expand: !i.primitive, captureSelection: i.captureSelection });
    else e[r] = I0(i);
  }
  return e;
}
function H(t33, e = "math") {
  if (!t33 || t33.length === 0) return null;
  let r = null;
  if (t33.startsWith("\\")) {
    if (r = lo[t33], r) return !r.ifMode || r.ifMode === e ? r : null;
    e === "math" ? r = so[t33] : nr[t33] && (r = { definitionType: "symbol", type: "mord", codepoint: nr[t33] });
  } else if (e === "math") {
    if (r = so[t33], !r && t33.length === 1) {
      let i = po("math", t33.codePointAt(0));
      return i.startsWith("\\") ? u(m({}, H(i, "math")), { command: i }) : null;
    }
  } else nr[t33] ? r = { definitionType: "symbol", type: "mord", codepoint: nr[t33] } : e === "text" && (r = { definitionType: "symbol", type: "mord", codepoint: t33.codePointAt(0) });
  return r != null ? r : null;
}
function Pr(t33, e) {
  if (!t33.startsWith("\\")) return null;
  let r = t33.slice(1);
  return e[r];
}
function po(t33, e) {
  if (e === void 0) return "";
  if (t33 === "math" && Vi[e]) return Vi[e];
  if (t33 === "text") {
    let r = Object.keys(nr).find((i) => nr[i] === e);
    return r || String.fromCodePoint(e);
  }
  return String.fromCodePoint(e);
}
function Jl(t33) {
  let e = [];
  for (let r = 0; r < t33.length; r++) {
    let i = t33.charCodeAt(r);
    if (i === 13 && t33.charCodeAt(r + 1) === 10 && (i = 10, r++), (i === 13 || i === 12) && (i = 10), i === 0 && (i = 65533), i >= 55296 && i <= 56319) {
      let n = t33.charCodeAt(r + 1);
      if (n >= 56320 && n <= 57343) {
        let o = i - 55296, a = n - 56320;
        i = 2 ** 16 + o * 2 ** 10 + a, r++;
      }
    }
    e.push(i);
  }
  return e;
}
var Zi = 8205;
var Hl = [[Zi, 1], [65038, 2], [127995, 5], [129456, 4], [917536, 96]];
var Ui;
var V0 = [127462, 127487];
function J0(t33) {
  var e;
  if (Ui === void 0) {
    Ui = {};
    for (let r of Hl) for (let i = r[0]; i <= r[0] + r[1] - 1; i++) Ui[i] = true;
  }
  return (e = Ui[t33]) != null ? e : false;
}
function Gl(t33) {
  return t33 >= V0[0] && t33 <= V0[1];
}
function H0(t33) {
  if (/^[\u0020-\u00FF]*$/.test(t33)) return t33;
  let e = [], r = Jl(t33), i = 0;
  for (; i < r.length; ) {
    let n = r[i++], o = r[i];
    if (o === Zi) {
      let a = i - 1;
      for (i += 2; r[i] === Zi; ) i += 2;
      e.push(String.fromCodePoint(...r.slice(a, i - a + 1)));
    } else if (J0(o)) {
      let a = i - 1;
      for (; J0(r[i]); ) i += r[i] === Zi ? 2 : 1;
      e.push(String.fromCodePoint(...r.slice(a, 2 * i - a - 1)));
    } else Gl(n) ? (i += 1, e.push(String.fromCodePoint(...r.slice(i - 2, 2)))) : e.push(String.fromCodePoint(n));
  }
  return e;
}
var fo = class {
  constructor(e) {
    this.obeyspaces = false;
    this.pos = 0;
    this.s = H0(e);
  }
  end() {
    return this.pos >= this.s.length;
  }
  get() {
    return this.pos < this.s.length ? this.s[this.pos++] : "";
  }
  peek() {
    return this.s[this.pos];
  }
  match(e) {
    let r = typeof this.s == "string" ? e.exec(this.s.slice(this.pos)) : e.exec(this.s.slice(this.pos).join(""));
    return r != null && r[0] ? (this.pos += r[0].length, r[0]) : "";
  }
  next() {
    if (this.end()) return null;
    if (!this.obeyspaces && this.match(/^[ \f\n\r\t\v\u00A0\u2028\u2029]+/) || this.obeyspaces && this.match(/^[ \f\n\r\t\v\u00A0\u2028\u2029]/)) return "<space>";
    let e = this.get();
    if (e === "\\") {
      if (!this.end()) {
        let r = this.match(/^[a-zA-Z\*]+/);
        return r ? this.match(/^[ \f\n\r\t\v\u00A0\u2028\u2029]*/) : r = this.get(), "\\" + r;
      }
    } else {
      if (e === "{") return "<{>";
      if (e === "}") return "<}>";
      if (e === "^") {
        if (this.peek() === "^") {
          this.get();
          let r = this.match(/^(\^(\^(\^(\^[\da-f])?[\da-f])?[\da-f])?[\da-f])?[\da-f]{2}/);
          if (r) return String.fromCodePoint(Number.parseInt(r.slice(r.lastIndexOf("^") + 1), 16));
        }
        return e;
      } else if (e === "#") {
        if (!this.end()) {
          let r = false;
          if (/[\d?@]/.test(this.peek()) && (r = true, this.pos + 1 < this.s.length)) {
            let i = this.s[this.pos + 1];
            r = /[^\dA-Za-z]/.test(i);
          }
          return r ? "#" + this.get() : "#";
        }
      } else if (e === "$") return this.peek() === "$" ? (this.get(), "<$$>") : "<$>";
    }
    return e;
  }
};
function Wl(t33, e) {
  var n, o, a, s;
  let r = [], i = t33.next();
  if (i && i !== "\\relax") {
    if (i === "\\noexpand") i = t33.next(), i && r.push(i);
    else if (i === "\\obeyspaces") t33.obeyspaces = true;
    else if (i === "\\bgroup") r.push("<{>");
    else if (i === "\\egroup") r.push("<}>");
    else if (i === "\\string") {
      if (i = t33.next(), i) if (i.startsWith("\\")) for (let l of i) r.push(l === "\\" ? "\\backslash" : l);
      else i === "<{>" ? r.push("\\{") : i === "<space>" ? r.push("~") : i === "<}>" && r.push("\\}");
    } else if (i === "\\csname") {
      for (; t33.peek() === "<space>"; ) t33.next();
      let l = "", c = false, h = [];
      do {
        if (h.length === 0) if (/^#[\d?@]$/.test(t33.peek())) {
          let d = t33.get().slice(1);
          h = or((o = (n = e == null ? void 0 : e(d)) != null ? n : e == null ? void 0 : e("?")) != null ? o : "\\placeholder{}", e), i = h[0];
        } else i = t33.next(), h = i ? [i] : [];
        c = h.length === 0, !c && i === "\\endcsname" && (c = true, h.shift()), c || (c = i === "<$>" || i === "<$$>" || i === "<{>" || i === "<}>" || typeof i == "string" && i.length > 1 && i.startsWith("\\")), c || (l += h.shift());
      } while (!c);
      l && r.push("\\" + l), r.push(...h);
    } else if (i !== "\\endcsname") if (i.length > 1 && i.startsWith("#")) {
      let l = i.slice(1);
      r.push(...or((s = (a = e == null ? void 0 : e(l)) != null ? a : e == null ? void 0 : e("?")) != null ? s : "\\placeholder{}", e));
    } else r.push(i);
  }
  return r;
}
function or(t33, e = null) {
  if (!t33) return [];
  let r = [], i = "";
  for (let a of t33.toString().split(/\r?\n/)) {
    i && r.push(i), i = " ";
    let s = a.match(/((?:\\%)|[^%])*/);
    s !== null && r.push(s[0]);
  }
  let n = new fo(r.join("")), o = [];
  do
    o.push(...Wl(n, e));
  while (!n.end());
  return o;
}
function D(t33) {
  let e = "", r = [];
  for (let i of t33) i && (e && /^[a-zA-Z\*]/.test(i) && r.push(e), r.push(i), /^\\[a-zA-Z]+\*?[\"\'][^\ ]+$/.test(i) && r.push(" "), e = /\\[a-zA-Z]+\*?$/.test(i) ? " " : "");
  return r.join("");
}
function F(t33, ...e) {
  return t33.startsWith("\\"), e.length === 0 ? t33 : D([t33, ...e.map((r) => `{${r}}`)]);
}
function xt(t33) {
  return D(t33.map((e) => {
    var r;
    return (r = { "<space>": " ", "<$$>": "$$", "<$>": "$", "<{>": "{", "<}>": "}" }[e]) != null ? r : e;
  }));
}
var Rt = class Rt2 {
  constructor(e) {
    Rt2._registry[e] = this;
  }
  static createAtom(e, r, i) {
    return Rt2._registry[e].createAtom(r, H(r, e), i);
  }
  static serialize(e, r) {
    var i;
    if (!e || e.length === 0) return "";
    if ((i = r.skipStyles) != null && i) {
      let n = [];
      for (let o of W0(e)) {
        let a = Rt2._registry[o[0].mode];
        n.push(...a.serialize(o, r));
      }
      return D(n);
    }
    return D(Zl(e, r));
  }
  static getFont(e, r, i) {
    return Rt2._registry[e].getFont(r, i);
  }
};
Rt._registry = {};
var Y = Rt;
function W0(t33) {
  let e = [], r = [], i = "NONE";
  for (let n of t33) n.type !== "first" && (n.mode !== i ? (r.length > 0 && e.push(r), r = [n], i = n.mode) : r.push(n));
  return r.length > 0 && e.push(r), e;
}
function ji(t33) {
  if ((t33 == null ? void 0 : t33.mode) !== "math") return "";
  let { style: e } = t33;
  return !e || !e.variantStyle ? "" : e.variantStyle === "bold" || e.variantStyle === "bolditalic" ? "bold" : "";
}
function Xi(t33) {
  if (!t33) return "";
  let { style: e } = t33;
  if (!e) return "";
  let r = e.variant;
  return r === void 0 && (r = "normal"), !["calligraphic", "fraktur", "double-struck", "script", "monospace", "sans-serif"].includes(r) && e.variantStyle && (r += "-" + e.variantStyle), r;
}
function De(t33, e) {
  let r = [], i = [], n;
  for (let o of t33) {
    if (o.type === "first") continue;
    let a;
    e === "variant" ? a = Xi(o) : e === "bold" ? a = ji(o) : a = o.style[e], a === n ? i.push(o) : (i.length > 0 && r.push(i), i = [o], n = a);
  }
  return i.length > 0 && r.push(i), r;
}
function G0(t33, e) {
  var o;
  let { parent: r } = t33[0], i = r == null ? void 0 : r.style.color, n = [];
  for (let a of W0(t33)) {
    let s = e.defaultMode;
    for (let l of De(a, "color")) {
      let c = l[0].style, h = Y._registry[l[0].mode].serialize(l, u(m({}, e), { defaultMode: s === "text" ? "text" : "math" }));
      !e.skipStyles && c.color && c.color !== "none" && (!r || i !== c.color) ? n.push(F("\\textcolor", (o = c.verbatimColor) != null ? o : c.color, D(h))) : n.push(D(h));
    }
  }
  return n;
}
function Ul(t33, e) {
  let { parent: r } = t33[0], i = r == null ? void 0 : r.style.backgroundColor;
  return De(t33, "backgroundColor").map((n) => {
    var o;
    if (n.length > 0 || n[0].type !== "box") {
      let a = n[0].style;
      if (a.backgroundColor && a.backgroundColor !== "none" && (!r || i !== a.backgroundColor)) return F("\\colorbox", (o = a.verbatimBackgroundColor) != null ? o : a.backgroundColor, D(G0(n, u(m({}, e), { defaultMode: "text" }))));
    }
    return D(G0(n, e));
  });
}
function Zl(t33, e) {
  if (t33.length === 0) return [];
  let { parent: r } = t33[0], i = r == null ? void 0 : r.style.fontSize, n = [];
  for (let o of De(t33, "fontSize")) {
    let a = o[0].style.fontSize, s = Ul(o, e);
    s && (a && a !== "auto" && (!r || i !== a) ? n.push(["", "\\tiny", "\\scriptsize", "\\footnotesize", "\\small", "\\normalsize", "\\large", "\\Large", "\\LARGE", "\\huge", "\\Huge"][a], ...s) : n.push(...s));
  }
  return n;
}
function Ki(t33) {
  return t33 ? { mord: "ord", mbin: "bin", mop: "op", mrel: "rel", mopen: "open", mclose: "close", mpunct: "punct", minner: "inner", spacing: "ignore", latex: "latex", composition: "inner", error: "inner", placeholder: "ord", supsub: "ignore" }[t33] : void 0;
}
function Ft(t33) {
  if (t33.length === 0) return "ord";
  let e = Ki(t33[0].type), r = Ki(t33[t33.length - 1].type);
  return e && e === r ? e : "ord";
}
function Or(t33, e) {
  if (typeof t33 == "string") return t33;
  if (typeof t33 == "number") {
    Number.isFinite(t33);
    let r = Math.ceil(100 * t33) / 100;
    return r === 0 ? "0" : r.toString() + (e != null ? e : "");
  }
  return "";
}
var y = class t2 {
  constructor(e, r) {
    var n, o, a, s, l;
    if (typeof e == "number" ? this.value = String.fromCodePoint(e) : typeof e == "string" ? this.value = e : ge(e) ? this.children = e.filter((c) => c !== null) : e && e instanceof t2 && (this.children = [e]), this.children) for (let c of this.children) c.parent = this;
    this.type = (n = r == null ? void 0 : r.type) != null ? n : "ignore", this.isSelected = (r == null ? void 0 : r.isSelected) === true, r != null && r.caret && (this.caret = r.caret), this.classes = (o = r == null ? void 0 : r.classes) != null ? o : "", this.isTight = (a = r == null ? void 0 : r.isTight) != null ? a : false, r != null && r.attributes && (this.attributes = r.attributes);
    let i = r == null ? void 0 : r.fontFamily;
    r != null && r.style && this.value && (i = (l = Y.getFont((s = r.mode) != null ? s : "math", this, u(m({ variant: "normal" }, r.style), { letterShapeStyle: r.letterShapeStyle }))) != null ? l : void 0), i || (i = "Main-Regular"), this._height = 0, this._depth = 0, this._width = 0, this.hasExplicitWidth = false, this.skew = 0, this.italic = 0, this.maxFontSize = 0, this.scale = 1, (r == null ? void 0 : r.maxFontSize) !== void 0 && (this.maxFontSize = r.maxFontSize), jl(this, i);
  }
  set atomID(e) {
    e === void 0 || e.length === 0 || (this.id = e);
  }
  selected(e) {
    if (this.isSelected !== e && (this.isSelected = e, this.children)) for (let r of this.children) r.selected(e);
  }
  setStyle(e, r, i) {
    if (r === void 0) return;
    let n = Or(r, i);
    n.length > 0 && (this.cssProperties || (this.cssProperties = {}), this.cssProperties[e] = n);
  }
  setTop(e) {
    Number.isFinite(e) && Math.abs(e) > 0.01 && (this.cssProperties || (this.cssProperties = {}), this.cssProperties.top = Or(e, "em"), this.height -= e, this.depth += e);
  }
  get left() {
    var e;
    return (e = this.cssProperties) != null && e["margin-left"] ? Number.parseFloat(this.cssProperties["margin-left"]) : 0;
  }
  set left(e) {
    Number.isFinite(e) && (e === 0 ? this.cssProperties && delete this.cssProperties["margin-left"] : (this.cssProperties || (this.cssProperties = {}), this.cssProperties["margin-left"] = Or(e, "em")));
  }
  set right(e) {
    Number.isFinite(e) && (e === 0 ? this.cssProperties && delete this.cssProperties["margin-right"] : (this.cssProperties || (this.cssProperties = {}), this.cssProperties["margin-right"] = Or(e, "em")));
  }
  set bottom(e) {
    Number.isFinite(e) && (e === 0 ? this.cssProperties && delete this.cssProperties["margin-bottom"] : (this.cssProperties || (this.cssProperties = {}), this.cssProperties["margin-bottom"] = Or(e, "em")));
  }
  get width() {
    return this._width * this.scale;
  }
  set width(e) {
    this._width = e, this.hasExplicitWidth = true;
  }
  set softWidth(e) {
  }
  get height() {
    return this._height * this.scale;
  }
  set height(e) {
    this._height = e;
  }
  get depth() {
    return this._depth * this.scale;
  }
  set depth(e) {
    this._depth = e;
  }
  wrap(e) {
    let r = e.parent;
    if (!r) return this;
    e.isPhantom && this.setStyle("opacity", 0);
    let i = e.color;
    i && i !== r.color && this.setStyle("color", i);
    let o = e.backgroundColor;
    this.isSelected && (o = $0(o)), o && o !== r.backgroundColor && (this.setStyle("background-color", o), this.setStyle("--bg-color", o), this.setStyle("display", "inline-block"), this.setStyle("position", "relative"), this.classes = this.classes ? `${this.classes} ML__bg` : "ML__bg");
    let a = e.scalingFactor;
    return this.scale = a, this.skew *= a, this.italic *= a, this;
  }
  toMarkup() {
    var c, h, d;
    let e = this.value ? Xl(this.value) : "";
    if (this.children) for (let f of this.children) e += f.toMarkup();
    let r = "";
    if (this.svgBody) r = C0(this.svgBody);
    else if (this.svgOverlay) {
      r = '<span style="', r += "display: inline-block;", r += `height:${Math.floor(100 * (this.height + this.depth)) / 100}em;`, r += `vertical-align:${Math.floor(100 * this.depth) / 100}em;`, r += '">', r += e, r += "</span>", r += '<svg style="position:absolute;overflow:visible;', r += `height:${Math.floor(100 * (this.height + this.depth)) / 100}em;`;
      let f = (c = this.cssProperties) == null ? void 0 : c.padding;
      f ? (r += `top:${f};`, r += `left:${f};`, r += `width:calc(100% - 2 * ${f} );`) : r += "top:0;left:0;width:100%;", r += "z-index:2;", r += '"', this.svgStyle && (r += this.svgStyle), r += ` viewBox="0 0 ${Math.floor(100 * this.width) / 100} ${Math.floor(100 * (this.height + this.depth)) / 100}"`, r += `>${this.svgOverlay}</svg>`;
    }
    let i = [], n = this.classes.split(" ");
    n.push((h = { latex: "ML__raw-latex", placeholder: "ML__placeholder", error: "ML__error" }[this.type]) != null ? h : ""), this.caret === "latex" && n.push("ML__latex-caret"), this.isSelected && n.push("ML__selected");
    let o = n.length === 1 ? n[0] : n.filter((f, S, x) => f.length > 0 && x.indexOf(f) === S).join(" ");
    if (o.length > 0 && i.push(`class=${ar(`"${o}"`)}`), this.id && i.push(` data-atom-id=${ar(this.id)}`), this.cssId && i.push(` id=${ar(`"${this.cssId.replace(/ /g, "-")}"`)}`), this.attributes && i.push(...Object.keys(this.attributes).map((f) => `${go(f)}=${ar(this.attributes[f])}`)), this.htmlData) {
      let f = this.htmlData.split(",");
      for (let S of f) {
        let x = S.match(/([^=]+)=(.+$)/);
        if (x) {
          let w = go(x[1]);
          if (w) if (w === "href") {
            let T = new URL(x[2]);
            if (T.protocol !== "http:" && T.protocol !== "https:") throw new Error(`Invalid URL: ${x[2]}`);
            i.push(`href="${x[2].replace(/"/g, "&quot;")}"`);
          } else i.push(`data-${w}=${ar(x[2])}`);
        } else {
          let w = go(S);
          w && i.push(`data-${w} `);
        }
      }
    }
    let a = (d = this.cssProperties) != null ? d : {};
    this.hasExplicitWidth && a.width === void 0 && (a.width = `${Math.ceil(this._width * 100) / 100}em`);
    let s = Object.keys(a).map((f) => `${f}:${a[f]}`);
    if (this.scale !== void 0 && this.scale !== 1 && (e.length > 0 || r.length > 0) && s.push(`font-size: ${Math.ceil(this.scale * 1e4) / 100}%`), this.htmlStyle) for (let f of this.htmlStyle.split(";")) {
      let S = f.match(/([^:]+):(.+$)/);
      if (S) {
        let x = S[1].trim().replace(/ /g, "-");
        x && s.push(`${x}:${S[2]}`);
      }
    }
    s.length > 0 && i.push(`style=${ar(s.join(";"))}`);
    let l = "";
    return i.length > 0 || r.length > 0 ? l = `<span ${i.join(" ")}>${e}${r}</span>` : l = e, this.caret === "text" ? l += '<span class="ML__text-caret"></span>' : this.caret === "math" && (l += '<span class="ML__caret"></span>'), l;
  }
  tryCoalesceWith(e) {
    if (this.svgBody || !this.value || e.svgBody || !e.value) return false;
    let r = this.children && this.children.length > 0, i = e.children && e.children.length > 0;
    if (r || i) return false;
    if (e.cssProperties || this.cssProperties) {
      for (let l of ["border", "border-left", "border-right", "border-right-width", "left", "margin", "margin-left", "margin-right", "padding", "position", "width"]) if (e.cssProperties && l in e.cssProperties || this.cssProperties && l in this.cssProperties) return false;
    }
    let n = this.cssProperties ? Object.keys(this.cssProperties).length : 0, o = e.cssProperties ? Object.keys(e.cssProperties).length : 0;
    if (n !== o) return false;
    if (n > 0) {
      for (let l of Object.keys(this.cssProperties)) if (this.cssProperties[l] !== e.cssProperties[l]) return false;
    }
    let a = this.classes.trim().replace(/\s+/g, " ").split(" "), s = e.classes.trim().replace(/\s+/g, " ").split(" ");
    if (a.length !== s.length) return false;
    a.sort(), s.sort();
    for (let [l, c] of a.entries()) if (c === "ML__vertical-separator" || c !== s[l]) return false;
    return this.value += e.value, this.height = Math.max(this.height, e.height), this.depth = Math.max(this.depth, e.depth), this._width = this._width + e._width, this.maxFontSize = Math.max(this.maxFontSize, e.maxFontSize), this.italic = e.italic, true;
  }
};
function yo(t33) {
  if (!t33 || t33.length === 0) return [];
  t33[0].children = yo(t33[0].children);
  let e = [t33[0]];
  for (let r = 1; r < t33.length; r++) e[e.length - 1].tryCoalesceWith(t33[r]) || (t33[r].children = yo(t33[r].children), e.push(t33[r]));
  return e;
}
function Yi(t33) {
  return t33.children && (t33.children = yo(t33.children)), t33;
}
function U0(t33, e) {
  if (!t33) return new y(null, e);
  let r = new y(null, { classes: "ML__strut", type: "ignore" });
  r.setStyle("height", Math.max(0, t33.height), "em");
  let i = [r];
  if (t33.depth !== 0) {
    let n = new y(null, { classes: "ML__strut--bottom", type: "ignore" });
    n.setStyle("height", t33.height + t33.depth, "em"), n.setStyle("vertical-align", -t33.depth, "em"), i.push(n);
  }
  return i.push(t33), new y(i, u(m({}, e), { type: "lift" }));
}
function sr(t33) {
  let e = L0(t33) / 2, r = new y(null, { maxFontSize: 0 });
  return r.height = e + 0.166, r.depth = e - 0.166, r.svgBody = t33, r;
}
function jl(t33, e) {
  var r;
  if (t33.type === "latex") {
    t33.height = 0.9, t33.depth = 0.2, t33._width = 1;
    return;
  }
  if (t33.value) {
    t33.height = -1 / 0, t33.depth = -1 / 0, t33._width = 0, t33.skew = -1 / 0, t33.italic = -1 / 0;
    for (let i = 0; i < t33.value.length; i++) {
      let n = bt(t33.value.codePointAt(i), e);
      t33.height = Math.max(t33.height, n.height), t33.depth = Math.max(t33.depth, n.depth), t33._width += n.width, t33.skew = n.skew, t33.italic = n.italic;
    }
    return;
  }
  if (t33.children && t33.children.length > 0) {
    let i = -1 / 0, n = -1 / 0, o = 0;
    for (let a of t33.children) a.height > i && (i = a.height), a.depth > n && (n = a.depth), o = Math.max(o, (r = a.maxFontSize) != null ? r : 0);
    t33.height = i, t33.depth = n, t33._width = t33.children.reduce((a, s) => a + s.width, 0), t33.maxFontSize = o;
  }
}
function Xl(t33) {
  return t33.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function go(t33) {
  if (t33 = t33.trim().replace(/ /g, "-"), t33.length === 0) throw new Error("Invalid empty attribute name");
  if (/[\x20\x09\x0a\x0c\x0d"'>/=\x00-\x1f]/.test(t33)) throw new Error(`Invalid attribute name "${t33}"`);
  return t33;
}
function ar(t33) {
  if (t33 = t33.trim(), t33.startsWith('"') && t33.endsWith('"')) {
    if (/"/.test(t33.slice(1, -1))) throw new Error(`Invalid attribute value: ${t33}`);
    return t33;
  }
  if (t33.startsWith("'") && t33.endsWith("'")) {
    if (/'/.test(t33.slice(1, -1))) throw new Error(`Invalid attribute value: ${t33}`);
    return t33;
  }
  if (t33.length === 0) throw new Error("Invalid empty attribute value");
  return `"${t33.replace(/"/g, "&quot;")}"`;
}
function Kl(t33) {
  if ("individualShift" in t33) {
    let e = t33.individualShift, r = e[0];
    if (r == null) return [null, 0];
    let i = [r], n = -r.shift - r.box.depth, o = n;
    for (let a = 1; a < e.length; a++) {
      let s = e[a], l = -s.shift - o - s.box.depth, c = l - (r.box.height + r.box.depth);
      o = o + l, i.push(c), i.push(s), r = s;
    }
    return [i, n];
  }
  if ("top" in t33) {
    let e = t33.top;
    for (let r of t33.children) e -= typeof r == "number" ? r : r.box.height + r.box.depth;
    return [t33.children, e];
  } else {
    if ("bottom" in t33) return [t33.children, -t33.bottom];
    if ("firstBaseline" in t33) {
      let e = t33.firstBaseline[0];
      if (typeof e == "number") throw new Error("First child must be an element.");
      return [t33.firstBaseline, -e.box.depth];
    } else if ("shift" in t33) {
      let e = t33.children[0];
      if (typeof e == "number") throw new Error("First child must be an element.");
      return [t33.children, -e.box.depth - t33.shift];
    }
  }
  return [null, 0];
}
function Yl(t33) {
  var S;
  let [e, r] = Kl(t33);
  if (!e) return [[], 0, 0];
  let i = new y(null, { classes: "ML__pstrut" }), n = 0;
  for (let x of e) if (typeof x != "number") {
    let w = x.box;
    n = Math.max(n, w.maxFontSize, w.height);
  }
  n += 2, i.height = n, i.setStyle("height", n, "em");
  let o = [], a = r, s = r, l = r, c = 0;
  for (let x of e) {
    if (typeof x == "number") l += x;
    else {
      let w = x.box, T = (S = x.classes) != null ? S : [], b = new y([i, w], { classes: T.join(" "), style: x.style });
      w.setStyle("height", w.height + w.depth, "em"), w.setStyle("display", "inline-block"), b.setStyle("top", -n - l - w.depth, "em"), x.marginLeft && b.setStyle("margin-left", x.marginLeft, "em"), x.marginRight && b.setStyle("margin-right", x.marginRight, "em"), o.push(b), l += w.height + w.depth, c = Math.max(c, b.width);
    }
    a = Math.min(a, l), s = Math.max(s, l);
  }
  o.forEach((x) => {
    x.softWidth = c;
  });
  let h = new y(o, { classes: "ML__vlist" });
  if (h.softWidth = c, h.height = s, h.setStyle("height", s, "em"), a >= 0) return [[new y(h, { classes: "ML__vlist-r" })], s, -a];
  let d = new y(new y(null), { classes: "ML__vlist" });
  d.height = -a, d.setStyle("height", -a, "em");
  let f = new y(8203, { classes: "ML__vlist-s", maxFontSize: 0 });
  return f.softWidth = 0, f.height = 0, f.depth = 0, [[new y([h, f], { classes: "ML__vlist-r" }), new y(d, { classes: "ML__vlist-r" })], s, -a];
}
var V = class extends y {
  constructor(e, r) {
    var a;
    let [i, n, o] = Yl(e);
    super(i.length === 1 ? i[0] : i, { type: r == null ? void 0 : r.type, classes: ((a = r == null ? void 0 : r.classes) != null ? a : "") + " ML__vlist-t" + (i.length === 2 ? " ML__vlist-t2" : "") }), this.height = n, this.depth = o, this.softWidth = i.reduce((s, l) => Math.max(s, l.width), 0);
  }
};
function Z0(t33, e) {
  var c, h, d, f, S;
  let r = t33.metrics, i = new y(e.base), n = (c = e.baseShift) != null ? c : 0, o = (h = e.slant) != null ? h : 0, a = 0, s = 0;
  e.above && (a = (d = e.aboveShift) != null ? d : Math.max(r.bigOpSpacing1, r.bigOpSpacing3 - e.above.depth)), e.below && (s = (f = e.belowShift) != null ? f : Math.max(r.bigOpSpacing2, r.bigOpSpacing4 - e.below.height));
  let l = null;
  if (e.below && e.above) {
    let x = r.bigOpSpacing5 + e.below.height + e.below.depth + s + i.depth + n;
    l = new V({ bottom: x, children: [r.bigOpSpacing5, { box: e.below, marginLeft: -o, classes: ["ML__center"] }, s, { box: i, classes: ["ML__center"] }, a, { box: e.above, marginLeft: o, classes: ["ML__center"] }, r.bigOpSpacing5] }).wrap(t33);
  } else if (e.below && !e.above) l = new V({ top: i.height - n, children: [r.bigOpSpacing5, { box: e.below, marginLeft: -o, classes: ["ML__center"] }, s, { box: i, classes: ["ML__center"] }] }).wrap(t33);
  else if (!e.below && e.above) {
    let x = i.depth + n;
    l = new V({ bottom: x, children: [{ box: i, classes: ["ML__center"] }, a, { box: e.above, marginLeft: o, classes: ["ML__center"] }, r.bigOpSpacing5] }).wrap(t33);
  } else {
    let x = i.depth + n;
    l = new V({ bottom: x, children: [{ box: i }, r.bigOpSpacing5] }).wrap(t33);
  }
  return new y(l, { type: (S = e.type) != null ? S : "op" });
}
var Qi = 7;
var Ir = 6;
var Nr = 5;
var vt = 4;
var Pt = 3;
var ye = 2;
var St = 1;
var ce = 0;
var Ue = class {
  constructor(e, r, i) {
    this.id = e, this.sizeDelta = r, this.cramped = i;
    let n = { "-4": 2, "-3": 1, 0: 0 }[r];
    this.metrics = Object.keys(Qn).reduce((o, a) => u(m({}, o), { [a]: Qn[a][n] }), {});
  }
  getFontSize(e) {
    return Math.max(1, e + this.sizeDelta);
  }
  get sup() {
    return ze[[ce, St, ce, St, ye, Pt, ye, Pt][this.id]];
  }
  get sub() {
    return ze[[ce, ce, ce, ce, ye, ye, ye, ye][this.id]];
  }
  get fracNum() {
    return ze[[ce, St, ce, St, ye, Pt, vt, Nr][this.id]];
  }
  get fracDen() {
    return ze[[ce, ce, ce, ce, ye, ye, vt, vt][this.id]];
  }
  get cramp() {
    return ze[[ce, ce, ye, ye, vt, vt, Ir, Ir][this.id]];
  }
  get isTight() {
    return this.sizeDelta < 0;
  }
};
var qr = { 7: new Ue(Qi, 0, false), 6: new Ue(Ir, 0, true), 5: new Ue(Nr, 0, false), 4: new Ue(vt, 0, true), 3: new Ue(Pt, -3, false), 2: new Ue(ye, -3, true), 1: new Ue(St, -4, false), 0: new Ue(ce, -4, true) };
var ze = u(m({}, qr), { displaystyle: qr[Qi], textstyle: qr[Nr], scriptstyle: qr[Pt], scriptscriptstyle: qr[St] });
function xo(t33, e) {
  var i;
  if (!t33) return 0;
  let r = { pt: 1, mm: 7227 / 2540, cm: 7227 / 254, ex: 35271 / 8192, px: 3 / 4, em: Ge, bp: 803 / 800, dd: 1238 / 1157, pc: 12, in: 72.27, mu: 10 / 18 }[(i = t33.unit) != null ? i : "pt"];
  if (Number.isFinite(e)) {
    let n = 10 ** e;
    return Math.round(t33.dimension / Ge * r * n) / n;
  }
  return t33.dimension * r;
}
function en(t33, e) {
  if (t33 === null) return 0;
  let r = xo(t33) / Ge;
  if (Number.isFinite(e)) {
    let i = 10 ** e;
    return Math.round(r * i) / i;
  }
  return r;
}
function bo(t33) {
  var e;
  return `${t33.dimension}${(e = t33.unit) != null ? e : "pt"}`;
}
function Ql(t33) {
  let e = bo(t33.glue);
  return t33.grow && t33.grow.dimension !== 0 && (e += ` plus ${bo(t33.grow)}`), t33.shrink && t33.shrink.dimension !== 0 && (e += ` minus ${bo(t33.shrink)}`), e;
}
function Q(t33) {
  var r, i;
  if (t33 == null) return null;
  let e = "";
  if ("dimension" in t33 && (e = `${t33.dimension}${(r = t33.unit) != null ? r : "pt"}`), "glue" in t33 && (e = Ql(t33)), "number" in t33) if (!("base" in t33) || t33.base === "decimal") e = Number(t33.number).toString();
  else if (t33.base === "alpha") e = `\`${String.fromCodePoint(t33.number)}`;
  else {
    let n = Math.round(t33.number) >>> 0;
    t33.base === "hexadecimal" ? (e = Number(n).toString(16).toUpperCase(), n <= 255 ? e = e.padStart(2, "0") : n <= 65535 ? e = e.padStart(4, "0") : n <= 16777215 ? e = e.padStart(6, "0") : e = e.padStart(8, "0"), e = `"${e}`) : t33.base === "octal" && (e = Number(n).toString(8), n <= 63 ? e = e.padStart(2, "0") : n <= 30583 ? e = e.padStart(4, "0") : e = e.padStart(8, "0"), e = `'${e}`);
  }
  return "register" in t33 && ("factor" in t33 && (t33.factor === -1 ? e = "-" : t33.factor !== 1 && (e = Number(t33.factor).toString())), "global" in t33 && t33.global && (e += "\\global"), e += `\\${t33.register}`), "string" in t33 && (e = t33.string), (i = t33.relax) != null && i && (e += "\\relax"), e;
}
function $e(t33, e) {
  return t33 == null ? null : "number" in t33 ? u(m({}, t33), { number: t33.number * e }) : "register" in t33 ? "factor" in t33 && t33.factor ? u(m({}, t33), { factor: t33.factor * e }) : u(m({}, t33), { factor: e }) : "dimension" in t33 ? u(m({}, t33), { dimension: t33.dimension * e }) : "glue" in t33 ? t33.shrink && t33.grow ? { glue: $e(t33.glue, e), shrink: $e(t33.shrink, e), grow: $e(t33.grow, e) } : t33.shrink ? { glue: $e(t33.glue, e), shrink: $e(t33.shrink, e) } : t33.grow ? { glue: $e(t33.glue, e), grow: $e(t33.grow, e) } : { glue: $e(t33.glue, e) } : null;
}
var j0 = { en: { "keyboard.tooltip.symbols": "Symbols", "keyboard.tooltip.greek": "Greek Letters", "keyboard.tooltip.numeric": "Numeric", "keyboard.tooltip.alphabetic": "Roman Letters", "tooltip.copy to clipboard": "Copy to Clipboard", "tooltip.cut to clipboard": "Cut to Clipboard", "tooltip.paste from clipboard": "Paste from Clipboard", "tooltip.redo": "Redo", "tooltip.toggle virtual keyboard": "Toggle Virtual Keyboard", "tooltip.menu": "Menu", "tooltip.undo": "Undo", "menu.borders": "Borders", "menu.insert matrix": "Insert Matrix", "menu.array.add row above": "Add Row Before", "menu.array.add row below": "Add Row After", "menu.array.add column after": "Add Column After", "menu.array.add column before": "Add Column Before", "menu.array.delete row": "Delete Row", "menu.array.delete rows": "Delete Selected Rows", "menu.array.delete column": "Delete Column", "menu.array.delete columns": "Delete Selected Columns", "menu.mode": "Mode", "menu.mode-math": "Math", "menu.mode-text": "Text", "menu.mode-latex": "LaTeX", "menu.insert": "Insert", "menu.insert.abs": "Absolute Value", "menu.insert.abs-template": "\\left|x\\right|", "menu.insert.nth-root": "n<sup>th</sup> Root", "menu.insert.nth-root-template": "\\sqrt[n]{x}", "menu.insert.log-base": "Logarithm base a", "menu.insert.log-base-template": "\\log_a(x)", "menu.insert.heading-calculus": "Calculus", "menu.insert.derivative": "Derivative", "menu.insert.derivative-template": "\\dfrac{\\mathrm{d}}{\\mathrm{d}x}f(x)\\bigm|_{x=a}", "menu.insert.nth-derivative": "n<sup>th</sup> derivative", "menu.insert.nth-derivative-template": "\\dfrac{\\mathrm{d}^n}{\\mathrm{d}x^n}f(x)\\bigm|_{x=a}", "menu.insert.integral": "Integral", "menu.insert.integral-template": "$\\int_a^b f(x)\\,\\mathrm{d}x$", "menu.insert.sum": "Sum", "menu.insert.sum-template": "$\\sum_{i=1}^n x_i$", "menu.insert.product": "Product", "menu.insert.product-template": "\\prod_{i=1}^n x_i", "menu.insert.heading-complex-numbers": "Complex Numbers", "menu.insert.modulus": "Modulus", "menu.insert.modulus-template": "\\lvert z \\rvert", "menu.insert.argument": "Argument", "menu.insert.argument-template": "\\arg(z)", "menu.insert.real-part": "Real Part", "menu.insert.real-part-template": "\\Re(z)", "menu.insert.imaginary-part": "Imaginary Part", "menu.insert.imaginary-part-template": "\\Im(z)", "menu.insert.conjugate": "Conjugate", "menu.insert.conjugate-template": "\\overline{z}", "tooltip.blackboard": "Blackboard", "tooltip.bold": "Bold", "tooltip.italic": "Italic", "tooltip.fraktur": "Fraktur", "tooltip.script": "Script", "tooltip.caligraphic": "Caligraphic", "tooltip.typewriter": "Typewriter", "tooltip.roman-upright": "Roman Upright", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "Font Style", "menu.accent": "Accent", "menu.decoration": "Decoration", "menu.color": "Color", "menu.background-color": "Background", "menu.evaluate": "Evaluate", "menu.simplify": "Simplify", "menu.solve": "Solve", "menu.solve-for": "Solve for %@", "menu.cut": "Cut", "menu.copy": "Copy", "menu.copy-as-latex": "Copy as LaTeX", "menu.copy-as-typst": "Copy as Typst", "menu.copy-as-ascii-math": "Copy as ASCII Math", "menu.copy-as-mathml": "Copy as MathML", "menu.paste": "Paste", "menu.select-all": "Select All", "color.red": "Red", "color.orange": "Orange", "color.yellow": "Yellow", "color.lime": "Lime", "color.green": "Green", "color.teal": "Teal", "color.cyan": "Cyan", "color.blue": "Blue", "color.indigo": "Indigo", "color.purple": "Purple", "color.magenta": "Magenta", "color.black": "Black", "color.dark-grey": "Dark Grey", "color.grey": "Grey", "color.light-grey": "Light Grey", "color.white": "White" }, ar: { "keyboard.tooltip.symbols": "\u062D\u0631\u0641 \u0627\u0648 \u0631\u0645\u0632", "keyboard.tooltip.greek": "\u062D\u0631\u0648\u0641 \u064A\u0648\u0646\u0627\u0646\u064A\u0629", "keyboard.tooltip.numeric": "\u0627\u0644\u0631\u0642\u0645\u064A\u0629", "keyboard.tooltip.alphabetic": "\u0631\u0645\u0648\u0632 \u0627\u0644\u0627\u062D\u0631\u0641 \u0627\u0644\u0631\u0648\u0645\u0627\u0646\u064A\u0629", "tooltip.copy to clipboard": "\u0646\u0633\u062E \u0625\u0644\u0649 \u0627\u0644\u062D\u0627\u0641\u0638\u0629", "tooltip.cut to clipboard": "\u0642\u0635 \u0625\u0644\u0649 \u0627\u0644\u062D\u0627\u0641\u0638\u0629", "tooltip.paste from clipboard": "\u0644\u0635\u0642 \u0645\u0646 \u0627\u0644\u062D\u0627\u0641\u0638\u0629", "tooltip.redo": "\u0627\u0644\u0625\u0639\u0627\u062F\u0629", "tooltip.toggle virtual keyboard": "\u062A\u0628\u062F\u064A\u0644 \u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u0641\u0627\u062A\u064A\u062D \u0627\u0644\u0625\u0641\u062A\u0631\u0627\u0636\u064A\u0629", "tooltip.undo": "\u0625\u0644\u063A\u0627\u0621", "menu.insert matrix": "\u0623\u062F\u062E\u0644 \u0627\u0644\u0645\u0635\u0641\u0648\u0641\u0629", "menu.borders": "\u0645\u062D\u062F\u062F\u0627\u062A \u0627\u0644\u0645\u0635\u0641\u0648\u0641\u0629", "menu.array.add row above": "\u0623\u0636\u0641 \u0635\u0641\u064B\u0627 \u0628\u0639\u062F \u0630\u0644\u0643", "menu.array.add row below": "\u0623\u0636\u0641 \u0627\u0644\u0635\u0641 \u0642\u0628\u0644", "menu.array.add column after": "\u0623\u0636\u0641 \u0627\u0644\u0639\u0645\u0648\u062F \u0628\u0639\u062F \u0630\u0644\u0643", "menu.array.add column before": "\u0623\u0636\u0641 \u0627\u0644\u0639\u0645\u0648\u062F \u0642\u0628\u0644", "menu.array.delete row": "\u0627\u062D\u0630\u0641 \u0635\u0641", "menu.array.delete rows": "\u062D\u0630\u0641 \u0627\u0644\u0635\u0641\u0648\u0641 \u0627\u0644\u0645\u062D\u062F\u062F\u0629", "menu.array.delete column": "\u062D\u0630\u0641 \u0627\u0644\u0639\u0645\u0648\u062F", "menu.array.delete columns": "\u062D\u0630\u0641 \u0627\u0644\u0623\u0639\u0645\u062F\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629", "menu.mode": "\u0648\u0636\u0639", "menu.mode-math": "\u0631\u064A\u0627\u0636\u064A\u0627\u062A", "menu.mode-text": "\u0646\u0635", "menu.mode-latex": "\u0644\u0627\u062A\u0643\u0633", "tooltip.blackboard": "\u0633\u0628\u0648\u0631\u0629", "tooltip.bold": "\u0639\u0631\u064A\u0636", "tooltip.italic": "\u0645\u0627\u0626\u0644", "tooltip.fraktur": "\u0641\u0631\u0627\u0643\u062A\u0648\u0631", "tooltip.script": "\u0633\u0643\u0631\u064A\u0628\u062A", "tooltip.caligraphic": "\u0643\u0627\u0644\u064A\u062C\u0631\u0627\u0641\u064A\u0643", "tooltip.typewriter": "\u0622\u0644\u0629 \u0643\u0627\u062A\u0628\u0629", "tooltip.roman-upright": "\u0631\u0648\u0645\u0627\u0646\u064A \u0645\u0633\u062A\u0642\u064A\u0645", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "\u0646\u0645\u0637 \u0627\u0644\u062E\u0637", "menu.accent": "\u062A\u0634\u0643\u064A\u0644", "menu.decoration": "\u0632\u062E\u0631\u0641\u0629", "menu.color": "\u0644\u0648\u0646", "menu.background-color": "\u0627\u0644\u062E\u0644\u0641\u064A\u0629", "menu.evaluate": "\u062A\u0642\u064A\u064A\u0645", "menu.simplify": "\u062A\u0628\u0633\u064A\u0637", "menu.solve": "\u062D\u0644", "menu.solve-for": "\u062D\u0644 \u0644\u0640 %@", "menu.cut": "\u0642\u0635", "menu.copy": "\u0646\u0633\u062E", "menu.copy-as-latex": "\u0646\u0633\u062E \u0643\u0640 LaTeX", "menu.copy-as-ascii-math": "\u0646\u0633\u062E \u0643\u0640 ASCII Math", "menu.copy-as-mathml": "\u0646\u0633\u062E \u0643\u0640 MathML", "menu.paste": "\u0644\u0635\u0642", "menu.select-all": "\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0643\u0644", "color.red": "\u0623\u062D\u0645\u0631", "color.orange": "\u0628\u0631\u062A\u0642\u0627\u0644\u064A", "color.yellow": "\u0623\u0635\u0641\u0631", "color.lime": "\u0644\u064A\u0645\u0648\u0646\u064A", "color.green": "\u0623\u062E\u0636\u0631", "color.teal": "\u0633\u0645\u0627\u0648\u064A", "color.cyan": "\u0633\u0645\u0627\u0648\u064A \u0641\u0627\u062A\u062D", "color.blue": "\u0623\u0632\u0631\u0642", "color.indigo": "\u0646\u064A\u0644\u064A", "color.purple": "\u0628\u0646\u0641\u0633\u062C\u064A", "color.magenta": "\u0623\u0631\u062C\u0648\u0627\u0646\u064A", "color.black": "\u0623\u0633\u0648\u062F", "color.dark-grey": "\u0631\u0645\u0627\u062F\u064A \u063A\u0627\u0645\u0642", "color.grey": "\u0631\u0645\u0627\u062F\u064A", "color.light-grey": "\u0631\u0645\u0627\u062F\u064A \u0641\u0627\u062A\u062D", "color.white": "\u0623\u0628\u064A\u0636" }, de: { "keyboard.tooltip.symbols": "Symbole", "keyboard.tooltip.greek": "Griechische Buchstaben", "keyboard.tooltip.numeric": "Numerisch", "keyboard.tooltip.alphabetic": "R\xF6mische Buchstaben", "tooltip.copy to clipboard": "In die Zwischenablage kopieren", "tooltip.redo": "Wiederholen", "tooltip.toggle virtual keyboard": "Virtuelle Tastatur umschalten", "tooltip.undo": "Widerrufen", "menu.insert matrix": "Matrix einf\xFCgen", "menu.borders": "Matrixtrennzeichen", "menu.array.add row above": "Zeile hinzuf\xFCgen nach", "menu.array.add row below": "Zeile hinzuf\xFCgen vor", "menu.array.add column after": "Spalte hinzuf\xFCgen nach", "menu.array.add column before": "Spalte hinzuf\xFCgen vor", "menu.array.delete row": "Zeile l\xF6schen", "menu.array.delete rows": "Ausgew\xE4hlte Zeilen l\xF6schen", "menu.array.delete column": "Spalte l\xF6schen", "menu.array.delete columns": "Ausgew\xE4hlte Spalten l\xF6schen", "menu.mode": "Modus", "menu.mode-math": "Mathematik", "menu.mode-text": "Text", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "Tafel", "tooltip.bold": "Fett", "tooltip.italic": "Kursiv", "tooltip.fraktur": "Fraktur", "tooltip.script": "Skript", "tooltip.caligraphic": "Kalligraphie", "tooltip.typewriter": "Schreibmaschine", "tooltip.roman-upright": "R\xF6misch aufrecht", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "Schriftstil", "menu.accent": "Akzent", "menu.decoration": "Dekoration", "menu.color": "Farbe", "menu.background-color": "Hintergrund", "menu.evaluate": "Auswerten", "menu.simplify": "Vereinfachen", "menu.solve": "L\xF6sen", "menu.solve-for": "L\xF6sen f\xFCr %@", "menu.cut": "Ausschneiden", "menu.copy": "Kopieren", "menu.copy-as-latex": "Als LaTeX kopieren", "menu.copy-as-ascii-math": "Als ASCII Math kopieren", "menu.copy-as-mathml": "Als MathML kopieren", "menu.paste": "Einf\xFCgen", "menu.select-all": "Alles ausw\xE4hlen", "color.red": "Rot", "color.orange": "Orange", "color.yellow": "Gelb", "color.lime": "Limette", "color.green": "Gr\xFCn", "color.teal": "Blaugr\xFCn", "color.cyan": "Cyan", "color.blue": "Blau", "color.indigo": "Indigo", "color.purple": "Lila", "color.magenta": "Magenta", "color.black": "Schwarz", "color.dark-grey": "Dunkelgrau", "color.grey": "Grau", "color.light-grey": "Hellgrau", "color.white": "Wei\xDF" }, el: { "keyboard.tooltip.symbols": "\u03C3\u03CD\u03BC\u03B2\u03BF\u03BB\u03B1", "keyboard.tooltip.greek": "\u03B5\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC \u03B3\u03C1\u03AC\u03BC\u03BC\u03B1\u03C4\u03B1", "keyboard.tooltip.numeric": "\u0391\u03C1\u03B9\u03B8\u03BC\u03B7\u03C4\u03B9\u03BA\u03CC\u03C2", "keyboard.tooltip.alphabetic": "\u03A1\u03C9\u03BC\u03B1\u03CA\u03BA\u03AC \u03B3\u03C1\u03AC\u03BC\u03BC\u03B1\u03C4\u03B1", "tooltip.copy to clipboard": "\u0391\u03BD\u03C4\u03B9\u03B3\u03C1\u03B1\u03C6\u03AE \u03C3\u03C4\u03BF \u03C0\u03C1\u03CC\u03C7\u03B5\u03B9\u03C1\u03BF", "tooltip.redo": "\u039E\u03B1\u03BD\u03B1\u03BA\u03AC\u03BD\u03C9", "tooltip.toggle virtual keyboard": "\u0395\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AE \u03B5\u03B9\u03BA\u03BF\u03BD\u03B9\u03BA\u03BF\u03CD \u03C0\u03BB\u03B7\u03BA\u03C4\u03C1\u03BF\u03BB\u03BF\u03B3\u03AF\u03BF\u03C5", "tooltip.undo": "\u039E\u03B5\u03BA\u03AC\u03BD\u03C9", "menu.insert matrix": "\u0395\u03B9\u03C3\u03B1\u03B3\u03C9\u03B3\u03AE \u03BC\u03AE\u03C4\u03C1\u03B1", "menu.borders": "\u039F\u03C1\u03B9\u03BF\u03B8\u03AD\u03C4\u03B5\u03C2 \u03BC\u03AE\u03C4\u03C1\u03B1", "menu.array.add row above": "\u03A0\u03C1\u03BF\u03C3\u03B8\u03AE\u03BA\u03B7 \u03C3\u03B5\u03B9\u03C1\u03AC\u03C2 \u03BC\u03B5\u03C4\u03AC", "menu.array.add row below": "\u03A0\u03C1\u03BF\u03C3\u03B8\u03AE\u03BA\u03B7 \u03C3\u03B5\u03B9\u03C1\u03AC\u03C2 \u03C0\u03C1\u03B9\u03BD", "menu.array.add column after": "\u03A0\u03C1\u03BF\u03C3\u03B8\u03AE\u03BA\u03B7 \u03C3\u03C4\u03AE\u03BB\u03B7\u03C2 \u03BC\u03B5\u03C4\u03AC", "menu.array.add column before": "\u03A0\u03C1\u03BF\u03C3\u03B8\u03AE\u03BA\u03B7 \u03C3\u03C4\u03AE\u03BB\u03B7\u03C2 \u03C0\u03C1\u03B9\u03BD", "menu.array.delete row": "\u0394\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03C3\u03B5\u03B9\u03C1\u03AC\u03C2", "menu.array.delete rows": "\u0394\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03B5\u03C0\u03B9\u03BB\u03B5\u03B3\u03BC\u03AD\u03BD\u03C9\u03BD \u03C3\u03B5\u03B9\u03C1\u03CE\u03BD", "menu.array.delete column": "\u0394\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03C3\u03C4\u03AE\u03BB\u03B7\u03C2", "menu.array.delete columns": "\u0394\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03B5\u03C0\u03B9\u03BB\u03B5\u03B3\u03BC\u03AD\u03BD\u03C9\u03BD \u03C3\u03C4\u03B7\u03BB\u03CE\u03BD", "menu.mode": "\u039B\u03B5\u03B9\u03C4\u03BF\u03C5\u03C1\u03B3\u03AF\u03B1", "menu.mode-math": "\u039C\u03B1\u03B8\u03B7\u03BC\u03B1\u03C4\u03B9\u03BA\u03AC", "menu.mode-text": "\u039A\u03B5\u03AF\u03BC\u03B5\u03BD\u03BF", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "\u03A0\u03AF\u03BD\u03B1\u03BA\u03B1\u03C2", "tooltip.bold": "\u0388\u03BD\u03C4\u03BF\u03BD\u03B7", "tooltip.italic": "\u03A0\u03BB\u03AC\u03B3\u03B9\u03B1", "tooltip.fraktur": "\u03A6\u03C1\u03AC\u03BA\u03C4\u03BF\u03C5\u03C1", "tooltip.script": "\u03A3\u03B5\u03BD\u03AC\u03C1\u03B9\u03BF", "tooltip.caligraphic": "\u039A\u03B1\u03BB\u03BB\u03B9\u03B3\u03C1\u03B1\u03C6\u03B9\u03BA\u03AE", "tooltip.typewriter": "\u039C\u03B7\u03C7\u03B1\u03BD\u03AE \u03B3\u03C1\u03B1\u03C6\u03AE\u03C2", "tooltip.roman-upright": "\u03A1\u03C9\u03BC\u03B1\u03CA\u03BA\u03CC \u039A\u03B1\u03C4\u03B1\u03BA\u03CC\u03C1\u03C5\u03C6\u03BF", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "\u03A3\u03C4\u03C5\u03BB \u03B3\u03C1\u03B1\u03BC\u03BC\u03B1\u03C4\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC\u03C2", "menu.accent": "\u03A4\u03CC\u03BD\u03BF\u03C2", "menu.decoration": "\u0394\u03B9\u03B1\u03BA\u03CC\u03C3\u03BC\u03B7\u03C3\u03B7", "menu.color": "\u03A7\u03C1\u03CE\u03BC\u03B1", "menu.background-color": "\u03A7\u03C1\u03CE\u03BC\u03B1 \u03C6\u03CC\u03BD\u03C4\u03BF\u03C5", "menu.evaluate": "\u0391\u03BE\u03B9\u03BF\u03BB\u03CC\u03B3\u03B7\u03C3\u03B7", "menu.simplify": "\u0391\u03C0\u03BB\u03BF\u03C0\u03BF\u03AF\u03B7\u03C3\u03B7", "menu.solve": "\u039B\u03CD\u03C3\u03B7", "menu.solve-for": "\u039B\u03CD\u03C3\u03B7 \u03B3\u03B9\u03B1 %@", "menu.cut": "\u0391\u03C0\u03BF\u03BA\u03BF\u03C0\u03AE", "menu.copy": "\u0391\u03BD\u03C4\u03B9\u03B3\u03C1\u03B1\u03C6\u03AE", "menu.copy-as-latex": "\u0391\u03BD\u03C4\u03B9\u03B3\u03C1\u03B1\u03C6\u03AE \u03C9\u03C2 LaTeX", "menu.copy-as-ascii-math": "\u0391\u03BD\u03C4\u03B9\u03B3\u03C1\u03B1\u03C6\u03AE \u03C9\u03C2 ASCII Math", "menu.copy-as-mathml": "\u0391\u03BD\u03C4\u03B9\u03B3\u03C1\u03B1\u03C6\u03AE \u03C9\u03C2 MathML", "menu.paste": "\u0395\u03C0\u03B9\u03BA\u03CC\u03BB\u03BB\u03B7\u03C3\u03B7", "menu.select-all": "\u0395\u03C0\u03B9\u03BB\u03BF\u03B3\u03AE \u03CC\u03BB\u03C9\u03BD", "color.red": "\u039A\u03CC\u03BA\u03BA\u03B9\u03BD\u03BF", "color.orange": "\u03A0\u03BF\u03C1\u03C4\u03BF\u03BA\u03B1\u03BB\u03AF", "color.yellow": "\u039A\u03AF\u03C4\u03C1\u03B9\u03BD\u03BF", "color.lime": "\u039B\u03B1\u03C7\u03B1\u03BD\u03AF", "color.green": "\u03A0\u03C1\u03AC\u03C3\u03B9\u03BD\u03BF", "color.teal": "\u039A\u03C5\u03B1\u03BD\u03CC", "color.cyan": "\u0393\u03B1\u03BB\u03AC\u03B6\u03B9\u03BF", "color.blue": "\u039C\u03C0\u03BB\u03B5", "color.indigo": "\u0399\u03BD\u03B4\u03B9\u03BA\u03CC", "color.purple": "\u039C\u03C9\u03B2", "color.magenta": "\u039C\u03B1\u03C4\u03B6\u03AD\u03BD\u03C4\u03B1", "color.black": "\u039C\u03B1\u03CD\u03C1\u03BF", "color.dark-grey": "\u03A3\u03BA\u03BF\u03CD\u03C1\u03BF \u0393\u03BA\u03C1\u03B9", "color.grey": "\u0393\u03BA\u03C1\u03B9", "color.light-grey": "\u0391\u03BD\u03BF\u03B9\u03C7\u03C4\u03CC \u0393\u03BA\u03C1\u03B9", "color.white": "\u039B\u03B5\u03C5\u03BA\u03CC" }, es: { "keyboard.tooltip.symbols": "S\xEDmbolos", "keyboard.tooltip.greek": "Letras griegas", "keyboard.tooltip.numeric": "Num\xE9rico", "keyboard.tooltip.alphabetic": "Letras romanas", "tooltip.copy to clipboard": "Copiar al portapapeles", "tooltip.redo": "Rehacer", "tooltip.toggle virtual keyboard": "Alternar teclado virtual", "tooltip.undo": "Deshacer", "menu.insert matrix": "A\xF1adir Matriz", "menu.borders": "Delimitadores de Matriz", "menu.array.add row above": "A\xF1adir L\xEDnea Antes", "menu.array.add row below": "A\xF1adir L\xEDnea Despues", "menu.array.add column after": "A\xF1adir Columna Despues", "menu.array.add column before": "A\xF1adir Columna Antes", "menu.array.delete row": "Borrar L\xEDnea", "menu.array.delete rows": "Borrar L\xEDneas Seleccionadas", "menu.array.delete column": "Borrar Columna", "menu.array.delete columns": "Borrar Columnas Seleccionadas", "menu.mode": "Modo", "menu.mode-math": "Matem\xE1ticas", "menu.mode-text": "Texto", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "Pizarra", "tooltip.bold": "Negrita", "tooltip.italic": "Cursiva", "tooltip.fraktur": "Fraktur", "tooltip.script": "Script", "tooltip.caligraphic": "Caligr\xE1fico", "tooltip.typewriter": "M\xE1quina de escribir", "tooltip.roman-upright": "Romano Vertical", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "Estilo de fuente", "menu.accent": "Acento", "menu.decoration": "Decoraci\xF3n", "menu.color": "Color", "menu.background-color": "Fondo", "menu.evaluate": "Evaluar", "menu.simplify": "Simplificar", "menu.solve": "Resolver", "menu.solve-for": "Resolver para %@", "menu.cut": "Cortar", "menu.copy": "Copiar", "menu.copy-as-latex": "Copiar como LaTeX", "menu.copy-as-ascii-math": "Copiar como ASCII Math", "menu.copy-as-mathml": "Copiar como MathML", "menu.paste": "Pegar", "menu.select-all": "Seleccionar todo", "color.red": "Rojo", "color.orange": "Naranja", "color.yellow": "Amarillo", "color.lime": "Lima", "color.green": "Verde", "color.teal": "Verde azulado", "color.cyan": "Cian", "color.blue": "Azul", "color.indigo": "\xCDndigo", "color.purple": "Morado", "color.magenta": "Magenta", "color.black": "Negro", "color.dark-grey": "Gris oscuro", "color.grey": "Gris", "color.light-grey": "Gris claro", "color.white": "Blanco" }, fr: { "keyboard.tooltip.symbols": "Symboles", "keyboard.tooltip.greek": "Lettres grecques", "keyboard.tooltip.numeric": "Num\xE9rique", "keyboard.tooltip.alphabetic": "Lettres romaines", "tooltip.menu": "Menu", "tooltip.copy to clipboard": "Copier dans le presse-papiers", "tooltip.redo": "R\xE9tablir", "tooltip.toggle virtual keyboard": "Afficher/Masquer le clavier virtuel", "tooltip.undo": "Annuler", "menu.insert matrix": "Ins\xE9rer une Matrice", "menu.borders": "Bords", "menu.array.add row above": "Ajouter une Ligne Avant", "menu.array.add row below": "Ajouter une Ligne Apr\xE8s", "menu.array.add column before": "Ajouter une Colonne Avant", "menu.array.add column after": "Ajouter une Colonne Apr\xE8s", "menu.array.delete row": "Enlever une Ligne", "menu.array.delete rows": "Enlever les Lignes S\xE9lection\xE9es", "menu.array.delete column": "Enlever une Colone", "menu.array.delete columns": "Enlever les Colonnes S\xE9lection\xE9es", "menu.mode": "Mode", "menu.mode-math": "Math", "menu.mode-text": "Text", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "Tableau noir", "tooltip.bold": "Gras", "tooltip.italic": "Italique", "tooltip.fraktur": "Fraktur", "tooltip.script": "Script", "tooltip.caligraphic": "Calligraphique", "tooltip.typewriter": "Machine \xE0 \xE9crire", "tooltip.roman-upright": "Romain droit", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "Style de police", "menu.accent": "Accent", "menu.decoration": "D\xE9coration", "menu.color": "Couleur", "menu.background-color": "Arri\xE8re-plan", "menu.evaluate": "\xC9valuer", "menu.simplify": "Simplifier", "menu.solve": "R\xE9soudre", "menu.solve-for": "R\xE9soudre pour %@", "menu.cut": "Couper", "menu.copy": "Copier", "menu.copy-as-latex": "Copier en LaTeX", "menu.copy-as-ascii-math": "Copier en ASCII Math", "menu.copy-as-mathml": "Copier en MathML", "menu.paste": "Coller", "menu.select-all": "S\xE9lectionner tout", "color.red": "Rouge", "color.orange": "Orange", "color.yellow": "Jaune", "color.lime": "Citron vert", "color.green": "Vert", "color.teal": "Turquoise", "color.cyan": "Cyan", "color.blue": "Bleu", "color.indigo": "Indigo", "color.purple": "Violet", "color.magenta": "Magenta", "color.black": "Noir", "color.dark-grey": "Gris fonc\xE9", "color.grey": "Gris", "color.light-grey": "Gris clair", "color.white": "Blanc" }, he: { "keyboard.tooltip.symbols": "\u05E1\u05DE\u05DC\u05D9\u05DD", "keyboard.tooltip.greek": "\u05D0\u05D5\u05EA\u05D9\u05D5\u05EA \u05D9\u05D5\u05D5\u05E0\u05D9\u05D5\u05EA", "keyboard.tooltip.numeric": "\u05DE\u05E1\u05E4\u05E8\u05D9", "keyboard.tooltip.alphabetic": "\u05DE\u05DB\u05EA\u05D1\u05D9\u05DD \u05E8\u05D5\u05DE\u05D9\u05D9\u05DD", "tooltip.copy to clipboard": "\u05D4\u05E2\u05EA\u05E7 \u05DC\u05DC\u05D5\u05D7", "tooltip.redo": "\u05DC\u05B7\u05E2\u05B2\u05E9\u05C2\u05D5\u05B9\u05EA \u05E9\u05C1\u05D5\u05BC\u05D1", "tooltip.toggle virtual keyboard": "\u05D4\u05D7\u05DC\u05E3 \u05D0\u05EA \u05D4\u05DE\u05E7\u05DC\u05D3\u05EA \u05D4\u05D5\u05D5\u05D9\u05E8\u05D8\u05D5\u05D0\u05DC\u05D9\u05EA", "tooltip.undo": "\u05DC\u05D1\u05D8\u05DC", "menu.insert matrix": "\u05D4\u05DB\u05E0\u05E1 \u05DE\u05D8\u05E8\u05D9\u05E7\u05E1", "menu.borders": "\u05DE\u05E4\u05E8\u05D9\u05D3\u05D9 \u05DE\u05D8\u05E8\u05D9\u05E7\u05E1", "menu.array.add row above": "\u05D4\u05D5\u05E1\u05E3 \u05E9\u05D5\u05E8\u05D4 \u05D0\u05D7\u05E8\u05D9", "menu.array.add row below": "\u05D4\u05D5\u05E1\u05E3 \u05E9\u05D5\u05E8\u05D4 \u05DC\u05E4\u05E0\u05D9", "menu.array.add column after": "\u05D4\u05D5\u05E1\u05E3 \u05E2\u05DE\u05D5\u05D3\u05D4 \u05D0\u05D7\u05E8\u05D9", "menu.array.add column before": "\u05D4\u05D5\u05E1\u05E3 \u05E2\u05DE\u05D5\u05D3\u05D4 \u05DC\u05E4\u05E0\u05D9", "menu.array.delete row": "\u05DE\u05D7\u05E7 \u05E9\u05D5\u05E8\u05D4", "menu.array.delete rows": "\u05DE\u05D7\u05E7 \u05E9\u05D5\u05E8\u05D5\u05EA \u05E9\u05E0\u05D1\u05D7\u05E8\u05D5", "menu.array.delete column": "\u05DE\u05D7\u05E7 \u05E2\u05DE\u05D5\u05D3\u05D4", "menu.array.delete columns": "\u05DE\u05D7\u05E7 \u05E2\u05DE\u05D5\u05D3\u05D5\u05EA \u05E9\u05E0\u05D1\u05D7\u05E8\u05D5", "menu.mode": "\u05DE\u05E6\u05D1", "menu.mode-math": "\u05DE\u05EA\u05DE\u05D8\u05D9\u05E7\u05D4", "menu.mode-text": "\u05D8\u05E7\u05E1\u05D8", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "\u05DC\u05D5\u05D7 \u05E9\u05D7\u05D5\u05E8", "tooltip.bold": "\u05DE\u05D5\u05D3\u05D2\u05E9", "tooltip.italic": "\u05E0\u05D8\u05D5\u05D9", "tooltip.fraktur": "\u05E4\u05E8\u05E7\u05D8\u05D5\u05E8", "tooltip.script": "\u05DB\u05EA\u05D1", "tooltip.caligraphic": "\u05E7\u05DC\u05D9\u05D2\u05E8\u05E4\u05D9", "tooltip.typewriter": "\u05DE\u05DB\u05D5\u05E0\u05EA \u05DB\u05EA\u05D9\u05D1\u05D4", "tooltip.roman-upright": "\u05E8\u05D5\u05DE\u05D9 \u05D9\u05E9\u05E8", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "\u05E1\u05D2\u05E0\u05D5\u05DF \u05D2\u05D5\u05E4\u05DF", "menu.accent": "\u05E6\u05DC\u05D9\u05DC", "menu.decoration": "\u05E7\u05D9\u05E9\u05D5\u05D8", "menu.color": "\u05E6\u05D1\u05E2", "menu.background-color": "\u05E8\u05E7\u05E2", "menu.evaluate": "\u05D7\u05E9\u05D1", "menu.simplify": "\u05E4\u05E9\u05D8", "menu.solve": "\u05E4\u05EA\u05D5\u05E8", "menu.solve-for": "\u05E4\u05EA\u05D5\u05E8 \u05E2\u05D1\u05D5\u05E8 %@", "menu.cut": "\u05D2\u05D6\u05D5\u05E8", "menu.copy": "\u05D4\u05E2\u05EA\u05E7", "menu.copy-as-latex": "\u05D4\u05E2\u05EA\u05E7 \u05DB\u05BELaTeX", "menu.copy-as-ascii-math": "\u05D4\u05E2\u05EA\u05E7 \u05DB\u05BEASCII Math", "menu.copy-as-mathml": "\u05D4\u05E2\u05EA\u05E7 \u05DB\u05BEMathML", "menu.paste": "\u05D4\u05D3\u05D1\u05E7", "menu.select-all": "\u05D1\u05D7\u05E8 \u05D4\u05DB\u05DC", "color.red": "\u05D0\u05D3\u05D5\u05DD", "color.orange": "\u05DB\u05EA\u05D5\u05DD", "color.yellow": "\u05E6\u05D4\u05D5\u05D1", "color.lime": "\u05D9\u05E8\u05D5\u05E7 \u05DC\u05D9\u05D9\u05DD", "color.green": "\u05D9\u05E8\u05D5\u05E7", "color.teal": "\u05D8\u05D9\u05DC", "color.cyan": "\u05E6\u05D9\u05D0\u05DF", "color.blue": "\u05DB\u05D7\u05D5\u05DC", "color.indigo": "\u05D0\u05D9\u05E0\u05D3\u05D9\u05D2\u05D5", "color.purple": "\u05E1\u05D2\u05D5\u05DC", "color.magenta": "\u05DE\u05D2\u05E0\u05D8\u05D4", "color.black": "\u05E9\u05D7\u05D5\u05E8", "color.dark-grey": "\u05D0\u05E4\u05D5\u05E8 \u05DB\u05D4\u05D4", "color.grey": "\u05D0\u05E4\u05D5\u05E8", "color.light-grey": "\u05D0\u05E4\u05D5\u05E8 \u05D1\u05D4\u05D9\u05E8", "color.white": "\u05DC\u05D1\u05DF" }, it: { "keyboard.tooltip.symbols": "Simboli", "keyboard.tooltip.greek": "Lettere greche", "keyboard.tooltip.numeric": "Numerico", "keyboard.tooltip.alphabetic": "Lettere romane", "tooltip.copy to clipboard": "Copia negli appunti", "tooltip.cut to clipboard": "Taglia negli appunti", "tooltip.paste from clipboard": "Incolla dagli appunti", "tooltip.redo": "Ripeti", "tooltip.toggle virtual keyboard": "Attiva/disattiva tastiera virtuale", "tooltip.menu": "Menu", "tooltip.undo": "Annulla", "menu.borders": "Delimitatori", "menu.insert matrix": "Inserisci matrice", "menu.array.add row above": "Aggiungi riga sopra", "menu.array.add row below": "Aggiungi riga sotto", "menu.array.add column after": "Aggiungi colonna dopo", "menu.array.add column before": "Aggiungi colonna prima", "menu.array.delete row": "Elimina riga", "menu.array.delete rows": "Elimina righe selezionate", "menu.array.delete column": "Elimina colonna", "menu.array.delete columns": "Elimina colonne selezionate", "menu.mode": "Modalit\xE0", "menu.mode-math": "Matematica", "menu.mode-text": "Testo", "menu.mode-latex": "LaTeX", "menu.insert": "Inserisci", "menu.insert.abs": "Valore assoluto", "menu.insert.abs-template": "\\left|x\\right|", "menu.insert.nth-root": "Radice n-esima", "menu.insert.nth-root-template": "\\sqrt[n]{x}", "menu.insert.log-base": "Logaritmo in base a", "menu.insert.log-base-template": "\\log_a(x)", "menu.insert.heading-calculus": "Calcolo", "menu.insert.derivative": "Derivata", "menu.insert.derivative-template": "\\dfrac{\\mathrm{d}}{\\mathrm{d}x}f(x)\\bigm|_{x=a}", "menu.insert.nth-derivative": "Derivata n-esima", "menu.insert.nth-derivative-template": "\\dfrac{\\mathrm{d}^n}{\\mathrm{d}x^n}f(x)\\bigm|_{x=a}", "menu.insert.integral": "Integrale", "menu.insert.integral-template": "$\\int_a^b f(x)\\,\\mathrm{d}x$", "menu.insert.sum": "Somma", "menu.insert.sum-template": "$\\sum_{i=1}^n x_i$", "menu.insert.product": "Prodotto", "menu.insert.product-template": "\\prod_{i=1}^n x_i", "menu.insert.heading-complex-numbers": "Numeri complessi", "menu.insert.modulus": "Modulo", "menu.insert.modulus-template": "\\lvert z \\rvert", "menu.insert.argument": "Argomento", "menu.insert.argument-template": "\\arg(z)", "menu.insert.real-part": "Parte reale", "menu.insert.real-part-template": "\\Re(z)", "menu.insert.imaginary-part": "Parte immaginaria", "menu.insert.imaginary-part-template": "\\Im(z)", "menu.insert.conjugate": "Coniugato", "menu.insert.conjugate-template": "\\overline{z}", "tooltip.blackboard": "Lavagna", "tooltip.bold": "Grassetto", "tooltip.italic": "Corsivo", "tooltip.fraktur": "Fraktur", "tooltip.script": "Script", "tooltip.caligraphic": "Calligrafico", "tooltip.typewriter": "Macchina da scrivere", "tooltip.roman-upright": "Romano diritto", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "Stile carattere", "menu.accent": "Accento", "menu.decoration": "Decorazione", "menu.color": "Colore", "menu.background-color": "Sfondo", "menu.evaluate": "Valuta", "menu.simplify": "Semplifica", "menu.solve": "Risolvi", "menu.solve-for": "Risolvi per %@", "menu.cut": "Taglia", "menu.copy": "Copia", "menu.copy-as-latex": "Copia come LaTeX", "menu.copy-as-ascii-math": "Copia come ASCII Math", "menu.copy-as-mathml": "Copia come MathML", "menu.paste": "Incolla", "menu.select-all": "Seleziona tutto", "color.red": "Rosso", "color.orange": "Arancione", "color.yellow": "Giallo", "color.lime": "Lime", "color.green": "Verde", "color.teal": "Verde acqua", "color.cyan": "Ciano", "color.blue": "Blu", "color.indigo": "Indaco", "color.purple": "Viola", "color.magenta": "Magenta", "color.black": "Nero", "color.dark-grey": "Grigio scuro", "color.grey": "Grigio", "color.light-grey": "Grigio chiaro", "color.white": "Bianco" }, ja: { "keyboard.tooltip.symbols": "\u30B7\u30F3\u30DC\u30EB", "keyboard.tooltip.greek": "\u30AE\u30EA\u30B7\u30E3\u6587\u5B57", "keyboard.tooltip.numeric": "\u6570\u5024", "keyboard.tooltip.alphabetic": "\u30ED\u30FC\u30DE\u5B57", "tooltip.menu": "\u30E1\u30CB\u30E5\u30FC", "tooltip.copy to clipboard": "\u30AF\u30EA\u30C3\u30D7\u30DC\u30FC\u30C9\u306B\u30B3\u30D4\u30FC", "tooltip.redo": "\u3084\u308A\u76F4\u3057", "tooltip.toggle virtual keyboard": "\u4EEE\u60F3\u30AD\u30FC\u30DC\u30FC\u30C9\u306E\u5207\u308A\u66FF\u3048", "tooltip.undo": "\u5143\u306B\u623B\u3059", "menu.insert matrix": "\u30DE\u30C8\u30EA\u30C3\u30AF\u30B9\u3092\u633F\u5165", "menu.borders": "\u884C\u5217\u533A\u5207\u308A\u6587\u5B57", "menu.array.add row above": "\u5F8C\u306B\u884C\u3092\u8FFD\u52A0", "menu.array.add row below": "\u524D\u306B\u884C\u3092\u8FFD\u52A0", "menu.array.add column after": "\u5F8C\u306B\u5217\u3092\u8FFD\u52A0", "menu.array.add column before": "\u524D\u306B\u5217\u3092\u8FFD\u52A0", "menu.array.delete row": "\u884C\u3092\u524A\u9664", "menu.array.delete rows": "\u9078\u629E\u3057\u305F\u884C\u3092\u524A\u9664\u3059\u308B", "menu.array.delete column": "\u5217\u3092\u524A\u9664", "menu.array.delete columns": "\u9078\u629E\u3057\u305F\u5217\u3092\u524A\u9664\u3059\u308B", "menu.mode": "\u30E2\u30FC\u30C9", "menu.mode-math": "\u6570\u5F0F", "menu.mode-text": "\u30C6\u30AD\u30B9\u30C8", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "\u9ED2\u677F", "tooltip.bold": "\u592A\u5B57", "tooltip.italic": "\u30A4\u30BF\u30EA\u30C3\u30AF", "tooltip.fraktur": "\u30D5\u30E9\u30AF\u30C8\u30A5\u30FC\u30EB", "tooltip.script": "\u30B9\u30AF\u30EA\u30D7\u30C8", "tooltip.caligraphic": "\u30AB\u30EA\u30B0\u30E9\u30D5\u30A3\u30C3\u30AF", "tooltip.typewriter": "\u30BF\u30A4\u30D7\u30E9\u30A4\u30BF\u30FC", "tooltip.roman-upright": "\u30ED\u30FC\u30DE\u76F4\u7ACB", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "\u30D5\u30A9\u30F3\u30C8\u30B9\u30BF\u30A4\u30EB", "menu.accent": "\u30A2\u30AF\u30BB\u30F3\u30C8", "menu.decoration": "\u88C5\u98FE", "menu.color": "\u8272", "menu.background-color": "\u80CC\u666F", "menu.evaluate": "\u8A55\u4FA1", "menu.simplify": "\u7C21\u7565\u5316", "menu.solve": "\u89E3\u304F", "menu.solve-for": "%@ \u3092\u89E3\u304F", "menu.cut": "\u5207\u308A\u53D6\u308A", "menu.copy": "\u30B3\u30D4\u30FC", "menu.copy-as-latex": "LaTeX\u3068\u3057\u3066\u30B3\u30D4\u30FC", "menu.copy-as-ascii-math": "ASCII Math\u3068\u3057\u3066\u30B3\u30D4\u30FC", "menu.copy-as-mathml": "MathML\u3068\u3057\u3066\u30B3\u30D4\u30FC", "menu.paste": "\u8CBC\u308A\u4ED8\u3051", "menu.select-all": "\u3059\u3079\u3066\u9078\u629E", "color.red": "\u8D64", "color.orange": "\u30AA\u30EC\u30F3\u30B8", "color.yellow": "\u9EC4\u8272", "color.lime": "\u30E9\u30A4\u30E0", "color.green": "\u7DD1", "color.teal": "\u30C6\u30A3\u30FC\u30EB", "color.cyan": "\u30B7\u30A2\u30F3", "color.blue": "\u9752", "color.indigo": "\u30A4\u30F3\u30C7\u30A3\u30B4", "color.purple": "\u7D2B", "color.magenta": "\u30DE\u30BC\u30F3\u30BF", "color.black": "\u9ED2", "color.dark-grey": "\u6FC3\u3044\u30B0\u30EC\u30FC", "color.grey": "\u30B0\u30EC\u30FC", "color.light-grey": "\u8584\u3044\u30B0\u30EC\u30FC", "color.white": "\u767D" }, ko: { "keyboard.tooltip.symbols": "\uAE30\uD638", "keyboard.tooltip.greek": "\uADF8\uB9AC\uC2A4 \uBB38\uC790", "keyboard.tooltip.numeric": "\uC22B\uC790", "keyboard.tooltip.alphabetic": "\uB85C\uB9C8 \uBB38\uC790", "tooltip.copy to clipboard": "\uD074\uB9BD \uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC", "tooltip.redo": "\uB2E4\uC2DC \uC2E4\uD589", "tooltip.toggle virtual keyboard": "\uAC00\uC0C1 \uD0A4\uBCF4\uB4DC \uC804\uD658", "tooltip.undo": "\uC2E4\uD589 \uCDE8\uC18C", "menu.insert matrix": "\uD589\uB82C \uC0BD\uC785", "menu.borders": "\uD589\uB82C \uAD6C\uBD84 \uAE30\uD638", "menu.array.add row above": "\uB4A4\uC5D0 \uD589 \uCD94\uAC00", "menu.array.add row below": "\uC55E\uC5D0 \uD589 \uCD94\uAC00", "menu.array.add column after": "\uB4A4\uC5D0 \uC5F4 \uCD94\uAC00", "menu.array.add column before": "\uC55E\uC5D0 \uC5F4 \uCD94\uAC00", "menu.array.delete row": "\uD589 \uC0AD\uC81C", "menu.array.delete rows": "\uC120\uD0DD\uD55C \uD589 \uC0AD\uC81C", "menu.array.delete column": "\uC5F4 \uC0AD\uC81C", "menu.array.delete columns": "\uC120\uD0DD\uD55C \uC5F4 \uC0AD\uC81C", "menu.mode": "\uBAA8\uB4DC", "menu.mode-math": "\uC218\uC2DD", "menu.mode-text": "\uD14D\uC2A4\uD2B8", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "\uCE60\uD310", "tooltip.bold": "\uAD75\uAC8C", "tooltip.italic": "\uC774\uD0E4\uB9AD", "tooltip.fraktur": "\uD504\uB799\uD22C\uC5B4", "tooltip.script": "\uCCA8\uC790", "tooltip.caligraphic": "\uD544\uAE30\uCCB4", "tooltip.typewriter": "\uD0C0\uC790\uAE30", "tooltip.roman-upright": "\uC77C\uBC18 \uB85C\uB9C8\uC790", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "\uAE00\uAF34 \uC2A4\uD0C0\uC77C", "menu.accent": "\uBC1C\uC74C \uAE30\uD638", "menu.decoration": "\uC7A5\uC2DD", "menu.color": "\uC0C9\uC0C1", "menu.background-color": "\uBC30\uACBD", "menu.evaluate": "\uD3C9\uAC00", "menu.simplify": "\uAC04\uC18C\uD654", "menu.solve": "\uD574\uACB0", "menu.solve-for": "%@\uC5D0 \uB300\uD574 \uD574\uACB0", "menu.cut": "\uC798\uB77C\uB0B4\uAE30", "menu.copy": "\uBCF5\uC0AC", "menu.copy-as-latex": "LaTeX\uB85C \uBCF5\uC0AC", "menu.copy-as-ascii-math": "ASCIIMath\uB85C \uBCF5\uC0AC", "menu.copy-as-mathml": "MathML\uB85C \uBCF5\uC0AC", "menu.paste": "\uBD99\uC5EC\uB123\uAE30", "menu.select-all": "\uBAA8\uB450 \uC120\uD0DD", "color.red": "\uBE68\uAC15", "color.orange": "\uC8FC\uD669", "color.yellow": "\uB178\uB791", "color.lime": "\uB77C\uC784", "color.green": "\uCD08\uB85D", "color.teal": "\uCCAD\uB85D", "color.cyan": "\uCCAD\uC0C9", "color.blue": "\uD30C\uB791", "color.indigo": "\uB0A8\uC0C9", "color.purple": "\uBCF4\uB77C", "color.magenta": "\uC790\uD64D", "color.black": "\uAC80\uC815", "color.dark-grey": "\uC9C4\uD55C \uD68C\uC0C9", "color.grey": "\uD68C\uC0C9", "color.light-grey": "\uC5F0\uD55C \uD68C\uC0C9", "color.white": "\uD770\uC0C9" }, pl: { "keyboard.tooltip.symbols": "Symbolika", "keyboard.tooltip.greek": "Litery greckie", "keyboard.tooltip.numeric": "Numeryczne", "keyboard.tooltip.alphabetic": "Litery rzymskie", "tooltip.copy to clipboard": "Kopiuj do Schowka", "tooltip.cut to clipboard": "Wytnij ze Schowka", "tooltip.paste from clipboard": "Wklej ze Schowka", "tooltip.redo": "Przywr\xF3\u0107", "tooltip.toggle virtual keyboard": "Prze\u0142\u0105cz klawiatur\u0119 wirtualn\u0105", "tooltip.menu": "Menu", "tooltip.undo": "Cofnij", "menu.borders": "Ograniczniki macierzy", "menu.insert matrix": "Wstaw macierz", "menu.array.add row above": "Dodaj wiersz przed", "menu.array.add row below": "Dodaj wiersz po", "menu.array.add column after": "Dodaj kolumn\u0119 po", "menu.array.add column before": "Dodaj kolumn\u0119 przed", "menu.array.delete row": "Usu\u0144 wiersz", "menu.array.delete rows": "Usu\u0144 wybrane wiersze", "menu.array.delete column": "Usu\u0144 kolumn\u0119", "menu.array.delete columns": "Usu\u0144 wybrane kolumny", "menu.mode": "Tryb", "menu.mode-math": "Formu\u0142a", "menu.mode-text": "Tekst", "menu.mode-latex": "LaTeX", "menu.insert": "Wstaw", "menu.insert.abs": "Warto\u015B\u0107 bezwzgl\u0119dna", "menu.insert.abs-template": "\\left|x\\right|", "menu.insert.nth-root": "Pierwiastek n-tego stopnia", "menu.insert.nth-root-template": "\\sqrt[n]{x}", "menu.insert.log-base": "Logarytm o podstawie a", "menu.insert.log-base-template": "\\log_a(x)", "menu.insert.heading-calculus": "Rachunek r\xF3\u017Cniczkowy i ca\u0142kowy", "menu.insert.derivative": "Pochodna", "menu.insert.derivative-template": "\\dfrac{\\mathrm{d}}{\\mathrm{d}x}f(x)\\bigm|_{x=a}", "menu.insert.nth-derivative": "Pochodna n-tego rz\u0119du", "menu.insert.nth-derivative-template": "\\dfrac{\\mathrm{d}^n}{\\mathrm{d}x^n}f(x)\\bigm|_{x=a}", "menu.insert.integral": "Ca\u0142ka", "menu.insert.integral-template": "$\\int_a^b f(x)\\,\\mathrm{d}x$", "menu.insert.sum": "Suma", "menu.insert.sum-template": "$\\sum_{i=1}^n x_i$", "menu.insert.product": "Iloczyn", "menu.insert.product-template": "\\prod_{i=1}^n x_i", "menu.insert.heading-complex-numbers": "Liczby zespolone", "menu.insert.modulus": "Modu\u0142", "menu.insert.modulus-template": "\\lvert z \\rvert", "menu.insert.argument": "Argument", "menu.insert.argument-template": "\\arg(z)", "menu.insert.real-part": "Cz\u0119\u015B\u0107 rzeczywista", "menu.insert.real-part-template": "\\Re(z)", "menu.insert.imaginary-part": "Cz\u0119\u015B\u0107 urojona", "menu.insert.imaginary-part-template": "\\Im(z)", "menu.insert.conjugate": "Sprz\u0119\u017Cenie", "menu.insert.conjugate-template": "\\overline{z}", "tooltip.blackboard": "Tablica", "tooltip.bold": "Pogrubienie", "tooltip.italic": "Kursywa", "tooltip.fraktur": "Fraktura", "tooltip.script": "Skrypt", "tooltip.caligraphic": "Kaligraficzny", "tooltip.typewriter": "Maszynowy", "tooltip.roman-upright": "Rzymski prosto", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "Styl czcionki", "menu.accent": "Akcent", "menu.decoration": "Dekoracja", "menu.color": "Kolor", "menu.background-color": "T\u0142o", "menu.evaluate": "Oblicz", "menu.simplify": "Upro\u015B\u0107", "menu.solve": "Rozwi\u0105\u017C", "menu.solve-for": "Rozwi\u0105\u017C dla %@", "menu.cut": "Wytnij", "menu.copy": "Kopiuj", "menu.copy-as-latex": "Kopiuj jako LaTeX", "menu.copy-as-ascii-math": "Kopiuj jako ASCII Math", "menu.copy-as-mathml": "Kopiuj jako MathML", "menu.paste": "Wklej", "menu.select-all": "Zaznacz wszystko", "color.red": "Czerwony", "color.orange": "Pomara\u0144czowy", "color.yellow": "\u017B\xF3\u0142ty", "color.lime": "Limetkowy", "color.green": "Zielony", "color.teal": "Turkusowy", "color.cyan": "Cyjan", "color.blue": "Niebieski", "color.indigo": "Indygo", "color.purple": "Fioletowy", "color.magenta": "Magenta", "color.black": "Czarny", "color.dark-grey": "Ciemnoszary", "color.grey": "Szary", "color.light-grey": "Jasnoszary", "color.white": "Bia\u0142y" }, pt: { "keyboard.tooltip.symbols": "S\xEDmbolos", "keyboard.tooltip.greek": "Letras gregas", "keyboard.tooltip.numeric": "Num\xE9rico", "keyboard.tooltip.alphabetic": "Letras romanas", "tooltip.copy to clipboard": "Copiar para \xE1rea de transfer\xEAncia", "tooltip.redo": "Refazer", "tooltip.toggle virtual keyboard": "Alternar teclado virtual", "tooltip.undo": "Desfazer", "menu.insert matrix": "Inserir Matriz", "menu.borders": "Delimitadores de matriz", "menu.array.add row above": "Adicionar linha depois", "menu.array.add row below": "Adicionar linha antes", "menu.array.add column after": "Adicionar coluna depois", "menu.array.add column before": "Adicionar coluna antes", "menu.array.delete row": "Excluir linha", "menu.array.delete rows": "Excluir linhas selecionadas", "menu.array.delete column": "Apagar Coluna", "menu.array.delete columns": "Excluir Colunas Selecionadas", "menu.mode": "Modo", "menu.mode-math": "F\xF3rmula", "menu.mode-text": "Texto", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "Quadro Negro", "tooltip.bold": "Negrito", "tooltip.italic": "It\xE1lico", "tooltip.fraktur": "Fraktur", "tooltip.script": "Script", "tooltip.caligraphic": "Caligr\xE1fico", "tooltip.typewriter": "M\xE1quina de Escrever", "tooltip.roman-upright": "Romano Vertical", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "Estilo da Fonte", "menu.accent": "Acento", "menu.decoration": "Decora\xE7\xE3o", "menu.color": "Cor", "menu.background-color": "Cor de Fundo", "menu.evaluate": "Avaliar", "menu.simplify": "Simplificar", "menu.solve": "Resolver", "menu.solve-for": "Resolver para %@", "menu.cut": "Recortar", "menu.copy": "Copiar", "menu.copy-as-latex": "Copiar como LaTeX", "menu.copy-as-ascii-math": "Copiar como ASCII Math", "menu.copy-as-mathml": "Copiar como MathML", "menu.paste": "Colar", "menu.select-all": "Selecionar Tudo", "color.red": "Vermelho", "color.orange": "Laranja", "color.yellow": "Amarelo", "color.lime": "Verde Lima", "color.green": "Verde", "color.teal": "Verde-azulado", "color.cyan": "Ciano", "color.blue": "Azul", "color.indigo": "\xCDndigo", "color.purple": "Roxo", "color.magenta": "Magenta", "color.black": "Preto", "color.dark-grey": "Cinza Escuro", "color.grey": "Cinza", "color.light-grey": "Cinza Claro", "color.white": "Branco" }, uk: { "keyboard.tooltip.symbols": "\u0421\u0438\u043C\u0432\u043E\u043B\u0438", "keyboard.tooltip.greek": "\u0413\u0440\u0435\u0446\u044C\u043A\u0456 \u043B\u0456\u0442\u0435\u0440\u0438", "keyboard.tooltip.numeric": "\u0427\u0438\u0441\u043B\u043E\u0432\u0438\u0439", "keyboard.tooltip.alphabetic": "\u0420\u0438\u043C\u0441\u044C\u043A\u0456 \u043B\u0456\u0442\u0435\u0440\u0438", "tooltip.copy to clipboard": "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 \u0432 \u0431\u0443\u0444\u0435\u0440 \u043E\u0431\u043C\u0456\u043D\u0443", "tooltip.cut to clipboard": "\u0412\u0438\u0440\u0456\u0437\u0430\u0442\u0438 \u0432 \u0431\u0443\u0444\u0435\u0440 \u043E\u0431\u043C\u0456\u043D\u0443", "tooltip.paste from clipboard": "\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u0438 \u0437 \u0431\u0443\u0444\u0435\u0440\u0430 \u043E\u0431\u043C\u0456\u043D\u0443", "tooltip.redo": "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0438", "tooltip.toggle virtual keyboard": "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u0438 \u0432\u0456\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0443 \u043A\u043B\u0430\u0432\u0456\u0430\u0442\u0443\u0440\u0443", "tooltip.menu": "\u041C\u0435\u043D\u044E", "tooltip.undo": "\u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438", "menu.borders": "\u041C\u0435\u0436\u0456", "menu.insert matrix": "\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u0438 \u043C\u0430\u0442\u0440\u0438\u0446\u044E", "menu.array.add row above": "\u0414\u043E\u0434\u0430\u0442\u0438 \u0440\u044F\u0434\u043E\u043A \u043F\u0435\u0440\u0435\u0434", "menu.array.add row below": "\u0414\u043E\u0434\u0430\u0442\u0438 \u0440\u044F\u0434\u043E\u043A \u043F\u0456\u0441\u043B\u044F", "menu.array.add column after": "\u0414\u043E\u0434\u0430\u0442\u0438 \u0441\u0442\u043E\u0432\u043F\u0435\u0446\u044C \u043F\u0456\u0441\u043B\u044F", "menu.array.add column before": "\u0414\u043E\u0434\u0430\u0442\u0438 \u0441\u0442\u043E\u0432\u043F\u0435\u0446\u044C \u043F\u0435\u0440\u0435\u0434", "menu.array.delete row": "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0440\u044F\u0434\u043E\u043A", "menu.array.delete rows": "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0432\u0438\u0431\u0440\u0430\u043D\u0456 \u0440\u044F\u0434\u043A\u0438", "menu.array.delete column": "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0441\u0442\u043E\u0432\u043F\u0435\u0446\u044C", "menu.array.delete columns": "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0432\u0438\u0431\u0440\u0430\u043D\u0456 \u0441\u0442\u043E\u0432\u043F\u0446\u0456", "menu.mode": "\u0420\u0435\u0436\u0438\u043C", "menu.mode-math": "\u041C\u0430\u0442\u0435\u043C\u0430\u0442\u0438\u043A\u0430", "menu.mode-text": "\u0422\u0435\u043A\u0441\u0442", "menu.mode-latex": "LaTeX", "menu.insert": "\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u0438", "menu.insert.abs": "\u0410\u0431\u0441\u043E\u043B\u044E\u0442\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F", "menu.insert.abs-template": "\\left|x\\right|", "menu.insert.nth-root": "\u041A\u043E\u0440\u0456\u043D\u044C n-\u0433\u043E \u0441\u0442\u0435\u043F\u0435\u043D\u044F", "menu.insert.nth-root-template": "\\sqrt[n]{x}", "menu.insert.log-base": "\u041B\u043E\u0433\u0430\u0440\u0438\u0444\u043C \u0437\u0430 \u043E\u0441\u043D\u043E\u0432\u043E\u044E a", "menu.insert.log-base-template": "\\log_a(x)", "menu.insert.heading-calculus": "\u041E\u0431\u0447\u0438\u0441\u043B\u0435\u043D\u043D\u044F", "menu.insert.derivative": "\u041F\u043E\u0445\u0456\u0434\u043D\u0430", "menu.insert.derivative-template": "\\dfrac{\\mathrm{d}}{\\mathrm{d}x}f(x)\\bigm|_{x=a}", "menu.insert.nth-derivative": "\u041F\u043E\u0445\u0456\u0434\u043D\u0430 n-\u0433\u043E \u043F\u043E\u0440\u044F\u0434\u043A\u0443", "menu.insert.nth-derivative-template": "\\dfrac{\\mathrm{d}^n}{\\mathrm{d}x^n}f(x)\\bigm|_{x=a}", "menu.insert.integral": "\u0406\u043D\u0442\u0435\u0433\u0440\u0430\u043B", "menu.insert.integral-template": "$\\int_a^b f(x)\\,\\mathrm{d}x$", "menu.insert.sum": "\u0421\u0443\u043C\u0430", "menu.insert.sum-template": "$\\sum_{i=1}^n x_i$", "menu.insert.product": "\u0414\u043E\u0431\u0443\u0442\u043E\u043A", "menu.insert.product-template": "\\prod_{i=1}^n x_i", "menu.insert.heading-complex-numbers": "\u041A\u043E\u043C\u043F\u043B\u0435\u043A\u0441\u043D\u0456 \u0447\u0438\u0441\u043B\u0430", "menu.insert.modulus": "\u041C\u043E\u0434\u0443\u043B\u044C", "menu.insert.modulus-template": "\\lvert z \\rvert", "menu.insert.argument": "\u0410\u0440\u0433\u0443\u043C\u0435\u043D\u0442", "menu.insert.argument-template": "\\arg(z)", "menu.insert.real-part": "\u0414\u0456\u0439\u0441\u043D\u0430 \u0447\u0430\u0441\u0442\u0438\u043D\u0430", "menu.insert.real-part-template": "\\Re(z)", "menu.insert.imaginary-part": "\u0423\u044F\u0432\u043D\u0430 \u0447\u0430\u0441\u0442\u0438\u043D\u0430", "menu.insert.imaginary-part-template": "\\Im(z)", "menu.insert.conjugate": "\u0421\u043F\u0440\u044F\u0436\u0435\u043D\u0435 \u0447\u0438\u0441\u043B\u043E", "menu.insert.conjugate-template": "\\overline{z}", "tooltip.blackboard": "\u0414\u043E\u0448\u043A\u0430", "tooltip.bold": "\u0416\u0438\u0440\u043D\u0438\u0439", "tooltip.italic": "\u041A\u0443\u0440\u0441\u0438\u0432", "tooltip.fraktur": "\u0424\u0440\u0430\u043A\u0442\u0443\u0440\u043D\u0438\u0439", "tooltip.script": "\u0420\u0443\u043A\u043E\u043F\u0438\u0441\u043D\u0438\u0439", "tooltip.caligraphic": "\u041A\u0430\u043B\u0456\u0433\u0440\u0430\u0444\u0456\u0447\u043D\u0438\u0439", "tooltip.typewriter": "\u0414\u0440\u0443\u043A\u0430\u0440\u0441\u044C\u043A\u0438\u0439", "tooltip.roman-upright": "\u041F\u0440\u044F\u043C\u0438\u0439 \u0440\u0438\u043C\u0441\u044C\u043A\u0438\u0439", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "\u0421\u0442\u0438\u043B\u044C \u0448\u0440\u0438\u0444\u0442\u0443", "menu.accent": "\u0410\u043A\u0446\u0435\u043D\u0442", "menu.decoration": "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u043D\u044F", "menu.color": "\u041A\u043E\u043B\u0456\u0440", "menu.background-color": "\u0424\u043E\u043D", "menu.evaluate": "\u041E\u0431\u0447\u0438\u0441\u043B\u0438\u0442\u0438", "menu.simplify": "\u0421\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0438", "menu.solve": "\u0420\u043E\u0437\u0432\u2019\u044F\u0437\u0430\u0442\u0438", "menu.solve-for": "\u0420\u043E\u0437\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0434\u043B\u044F %@", "menu.cut": "\u0412\u0438\u0440\u0456\u0437\u0430\u0442\u0438", "menu.copy": "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438", "menu.copy-as-latex": "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 \u044F\u043A LaTeX", "menu.copy-as-ascii-math": "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 \u044F\u043A ASCII Math", "menu.copy-as-mathml": "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 \u044F\u043A MathML", "menu.paste": "\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u0438", "menu.select-all": "\u0412\u0438\u0431\u0440\u0430\u0442\u0438 \u0432\u0441\u0435", "color.red": "\u0427\u0435\u0440\u0432\u043E\u043D\u0438\u0439", "color.orange": "\u041F\u043E\u043C\u0430\u0440\u0430\u043D\u0447\u0435\u0432\u0438\u0439", "color.yellow": "\u0416\u043E\u0432\u0442\u0438\u0439", "color.lime": "\u041B\u0430\u0439\u043C\u043E\u0432\u0438\u0439", "color.green": "\u0417\u0435\u043B\u0435\u043D\u0438\u0439", "color.teal": "\u0411\u0456\u0440\u044E\u0437\u043E\u0432\u0438\u0439", "color.cyan": "\u0421\u0438\u043D\u044C\u043E-\u0437\u0435\u043B\u0435\u043D\u0438\u0439", "color.blue": "\u0421\u0438\u043D\u0456\u0439", "color.indigo": "\u0406\u043D\u0434\u0438\u0433\u043E", "color.purple": "\u0424\u0456\u043E\u043B\u0435\u0442\u043E\u0432\u0438\u0439", "color.magenta": "\u041F\u0443\u0440\u043F\u0443\u0440\u043D\u0438\u0439", "color.black": "\u0427\u043E\u0440\u043D\u0438\u0439", "color.dark-grey": "\u0422\u0435\u043C\u043D\u043E-\u0441\u0456\u0440\u0438\u0439", "color.grey": "\u0421\u0456\u0440\u0438\u0439", "color.light-grey": "\u0421\u0432\u0456\u0442\u043B\u043E-\u0441\u0456\u0440\u0438\u0439", "color.white": "\u0411\u0456\u043B\u0438\u0439" }, "zh-cn": { "keyboard.tooltip.symbols": "\u7B26\u53F7", "keyboard.tooltip.greek": "\u5E0C\u814A\u5B57\u6BCD", "keyboard.tooltip.numeric": "\u6570\u5B57", "keyboard.tooltip.alphabetic": "\u7F57\u9A6C\u5B57\u6BCD", "tooltip.copy to clipboard": "\u590D\u5236\u5230\u526A\u8D34\u677F", "tooltip.redo": "\u91CD\u505A", "tooltip.toggle virtual keyboard": "\u5207\u6362\u865A\u62DF\u952E\u76D8", "tooltip.undo": "\u64A4\u6D88", "menu.insert matrix": "\u63D2\u5165\u77E9\u9635", "menu.borders": "\u77E9\u9635\u5206\u9694\u7B26", "menu.array.add row above": "\u5728\u540E\u9762\u6DFB\u52A0\u884C", "menu.array.add row below": "\u5728\u524D\u9762\u6DFB\u52A0\u884C", "menu.array.add column after": "\u5728\u540E\u9762\u6DFB\u52A0\u5217r", "menu.array.add column before": "\u5728\u524D\u9762\u6DFB\u52A0\u5217", "menu.array.delete row": "\u5220\u9664\u884C", "menu.array.delete rows": "\u5220\u9664\u9009\u5B9A\u884C", "menu.array.delete column": "\u5220\u9664\u5217", "menu.array.delete columns": "\u5220\u9664\u9009\u5B9A\u7684\u5217", "menu.mode": "\u6A21\u5F0F", "menu.mode-math": "\u6570\u5B66", "menu.mode-text": "\u6587\u672C", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "\u9ED1\u677F", "tooltip.bold": "\u7C97\u4F53", "tooltip.italic": "\u659C\u4F53", "tooltip.fraktur": "Fraktur", "tooltip.script": "\u811A\u672C", "tooltip.caligraphic": "\u8349\u4E66", "tooltip.typewriter": "\u6253\u5B57\u673A", "tooltip.roman-upright": "\u7F57\u9A6C\u76F4\u7ACB", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "\u5B57\u4F53\u6837\u5F0F", "menu.accent": "\u91CD\u97F3", "menu.decoration": "\u88C5\u9970", "menu.color": "\u989C\u8272", "menu.background-color": "\u80CC\u666F", "menu.evaluate": "\u8BA1\u7B97", "menu.simplify": "\u7B80\u5316", "menu.solve": "\u6C42\u89E3", "menu.solve-for": "\u6C42\u89E3 %@", "menu.cut": "\u526A\u5207", "menu.copy": "\u590D\u5236", "menu.copy-as-latex": "\u590D\u5236\u4E3A LaTeX", "menu.copy-as-ascii-math": "\u590D\u5236\u4E3A ASCII Math", "menu.copy-as-mathml": "\u590D\u5236\u4E3A MathML", "menu.paste": "\u7C98\u8D34", "menu.select-all": "\u5168\u9009", "color.red": "\u7EA2\u8272", "color.orange": "\u6A59\u8272", "color.yellow": "\u9EC4\u8272", "color.lime": "\u7EFF\u9EC4\u8272", "color.green": "\u7EFF\u8272", "color.teal": "\u9752\u8272", "color.cyan": "\u84DD\u7EFF\u8272", "color.blue": "\u84DD\u8272", "color.indigo": "\u975B\u84DD\u8272", "color.purple": "\u7D2B\u8272", "color.magenta": "\u6D0B\u7EA2\u8272", "color.black": "\u9ED1\u8272", "color.dark-grey": "\u6DF1\u7070\u8272", "color.grey": "\u7070\u8272", "color.light-grey": "\u6D45\u7070\u8272", "color.white": "\u767D\u8272" }, "zh-tw": { "keyboard.tooltip.symbols": "\u7B26\u865F", "keyboard.tooltip.greek": "\u5E0C\u81D8\u5B57\u6BCD", "keyboard.tooltip.numeric": "\u6578\u5B57", "keyboard.tooltip.alphabetic": "\u7F85\u99AC\u5B57\u6BCD", "tooltip.copy to clipboard": "\u8907\u88FD\u5230\u526A\u8CBC\u677F", "tooltip.redo": "\u91CD\u505A", "tooltip.toggle virtual keyboard": "\u5207\u63DB\u865B\u64EC\u9375\u76E4", "tooltip.undo": "\u64A4\u6D88", "menu.insert matrix": "\u63D2\u5165\u77E9\u9663", "menu.borders": "\u77E9\u9663\u5206\u9694\u7B26", "menu.array.add row above": "\u5728\u5F8C\u9762\u6DFB\u52A0\u884C", "menu.array.add row below": "\u5728\u524D\u9762\u6DFB\u52A0\u884C", "menu.array.add column after": "\u5728\u5F8C\u9762\u6DFB\u52A0\u5217", "menu.array.add column before": "\u5728\u524D\u9762\u6DFB\u52A0\u5217", "menu.array.delete row": "\u522A\u9664\u884C", "menu.array.delete rows": "\u522A\u9664\u9078\u5B9A\u884C", "menu.array.delete column": "\u522A\u9664\u5217", "menu.array.delete columns": "\u522A\u9664\u9078\u5B9A\u7684\u5217", "menu.mode": "\u6A21\u5F0F", "menu.mode-math": "\u6578\u5B78", "menu.mode-text": "\u6587\u672C", "menu.mode-latex": "LaTeX", "tooltip.blackboard": "\u9ED1\u677F", "tooltip.bold": "\u7C97\u9AD4", "tooltip.italic": "\u659C\u9AD4", "tooltip.fraktur": "Fraktur", "tooltip.script": "\u8173\u672C", "tooltip.caligraphic": "\u8349\u66F8", "tooltip.typewriter": "\u6253\u5B57\u6A5F", "tooltip.roman-upright": "\u7F85\u99AC\u76F4\u7ACB", "tooltip.row-by-col": "%@ \xD7 %@", "menu.font-style": "\u5B57\u9AD4\u6A23\u5F0F", "menu.accent": "\u91CD\u97F3", "menu.decoration": "\u88DD\u98FE", "menu.color": "\u984F\u8272", "menu.background-color": "\u80CC\u666F", "menu.evaluate": "\u8A08\u7B97", "menu.simplify": "\u7C21\u5316", "menu.solve": "\u6C42\u89E3", "menu.solve-for": "\u6C42\u89E3 %@", "menu.cut": "\u526A\u4E0B", "menu.copy": "\u8907\u88FD", "menu.copy-as-latex": "\u8907\u88FD\u70BA LaTeX", "menu.copy-as-ascii-math": "\u8907\u88FD\u70BA ASCII Math", "menu.copy-as-mathml": "\u8907\u88FD\u70BA MathML", "menu.paste": "\u8CBC\u4E0A", "menu.select-all": "\u5168\u9078", "color.red": "\u7D05\u8272", "color.orange": "\u6A59\u8272", "color.yellow": "\u9EC3\u8272", "color.lime": "\u7DA0\u9EC3\u8272", "color.green": "\u7DA0\u8272", "color.teal": "\u9752\u8272", "color.cyan": "\u85CD\u7DA0\u8272", "color.blue": "\u85CD\u8272", "color.indigo": "\u975B\u85CD\u8272", "color.purple": "\u7D2B\u8272", "color.magenta": "\u6D0B\u7D05\u8272", "color.black": "\u9ED1\u8272", "color.dark-grey": "\u6DF1\u7070\u8272", "color.grey": "\u7070\u8272", "color.light-grey": "\u6DFA\u7070\u8272", "color.white": "\u767D\u8272" } };
var I = { strings: j0, _locale: "", _dirty: false, _subscribers: [], _numberFormatter: void 0, get locale() {
  return I._locale || (I._locale = Ii() ? navigator.language.slice(0, 5) : "en-US"), I._locale;
}, set locale(t33) {
  I._locale = t33, I._numberFormatter = void 0, I.dirty = true;
}, get numberFormatter() {
  if (!I._numberFormatter) try {
    I._numberFormatter = new Intl.NumberFormat(I.locale);
  } catch (t33) {
    try {
      I._numberFormatter = new Intl.NumberFormat(I.locale.slice(0, 2));
    } catch (e) {
      I._numberFormatter = new Intl.NumberFormat("en-US");
    }
  }
  return I._numberFormatter;
}, merge(t33, e) {
  if (typeof t33 == "string" && e) I.strings[t33] = m(m({}, I.strings[t33]), e), I.dirty = true;
  else for (let r of Object.keys(t33)) I.merge(r, t33[r]);
}, get dirty() {
  return I._dirty;
}, set dirty(t33) {
  I._dirty || I._dirty === t33 || (I._dirty = true, setTimeout(() => {
    I._dirty = false, this._subscribers.forEach((e) => e == null ? void 0 : e());
  }, 0));
}, subscribe(t33) {
  return I._subscribers.push(t33), I._subscribers.length - 1;
}, unsubscribe(t33) {
  t33 < 0 || t33 >= I._subscribers.length || (I._subscribers[t33] = void 0);
}, update(t33) {
  let e = t33.querySelectorAll("[data-l10n-tooltip]");
  for (let r of e) {
    let i = r.getAttribute("data-l10n-tooltip");
    if (i) {
      let n = X0(i);
      n && r.setAttribute("data-tooltip", n);
    }
  }
  e = t33.querySelectorAll("[data-l10n-arial-label]");
  for (let r of e) {
    let i = r.getAttribute("data-l10n-arial-label");
    if (i) {
      let n = X0(i);
      n && r.setAttribute("aria-label", n);
    }
  }
} };
function X0(t33, ...e) {
  if (t33 === void 0) return;
  let r = "", i = I.locale;
  I.strings[i] && (r = I.strings[i][t33]);
  let n = i.slice(0, 2);
  if (!r && I.strings[n] && (r = I.strings[n][t33]), r || (r = I.strings.en[t33]), !r) return;
  let o = /(%@|%([0-9]+)\$@)/g, a = o.exec(r), s = 0;
  for (; a; ) {
    if (e[s++]) {
      let c = a[2] ? parseInt(a[2], 10) - 1 : s - 1, h = e[c];
      typeof h == "number" && (h = I.numberFormatter.format(h)), r = r.replace(a[1], h);
    }
    a = o.exec(r);
  }
  return r = r.replace(/%%/g, "%"), r;
}
var ec = { "p@": { dimension: 1 }, "z@": { dimension: 0 }, maxdimen: { dimension: 16383.99999 }, hfuzz: { dimension: 0.1 }, vfuzz: { dimension: 0.1 }, overfullrule: { dimension: 5 }, hsize: { dimension: 6.5, unit: "in" }, vsize: { dimension: 8.9, unit: "in" }, parindent: { dimension: 20 }, maxdepth: { dimension: 4 }, splitmaxdepth: { register: "maxdimen" }, boxmaxdepth: { register: "maxdimen" }, delimitershortfall: { dimension: 5 }, nulldelimiterspace: { dimension: 1.2, unit: "pt" }, scriptspace: { dimension: 0.5 }, topskip: { dimension: 10 }, splittopskip: { dimension: 10 }, normalbaselineskip: { dimension: 12 }, normallineskip: { dimension: 1 }, normallineskiplimit: { dimension: 0 }, jot: { dimension: 3 }, doublerulesep: { dimension: 2 }, arrayrulewidth: { dimension: 0.4 }, arraycolsep: { dimension: 5 }, fboxsep: { dimension: 3 }, fboxrule: { dimension: 0.4 }, "z@skip": { glue: { dimension: 0 }, shrink: { dimension: 0 }, grow: { dimension: 0 } }, hideskip: { glue: { dimension: -1e3 }, grow: { dimension: 1, unit: "fill" } }, "@flushglue": { glue: { dimension: 0 }, grow: { dimension: 1, unit: "fill" } }, parskip: { glue: { dimension: 0 }, grow: { dimension: 1 } }, abovedisplayskip: { glue: { dimension: 12 }, grow: { dimension: 3 }, shrink: { dimension: 9 } }, abovedisplayshortskip: { glue: { dimension: 0 }, grow: { dimension: 3 } }, belowdisplayskip: { glue: { dimension: 12 }, grow: { dimension: 3 }, shrink: { dimension: 9 } }, belowdisplayshortskip: { glue: { dimension: 7 }, grow: { dimension: 3 }, shrink: { dimension: 4 } }, parfillskip: { glue: { dimension: 0 }, grow: { dimension: 1, unit: "fil" } }, thinmuskip: { glue: { dimension: 3, unit: "mu" } }, medmuskip: { glue: { dimension: 4, unit: "mu" }, grow: { dimension: 2, unit: "mu" }, shrink: { dimension: 4, unit: "mu" } }, thickmuskip: { glue: { dimension: 5, unit: "mu" }, grow: { dimension: 5, unit: "mu" } }, smallskipamount: { glue: { dimension: 3 }, grow: { dimension: 1 }, shrink: { dimension: 1 } }, medskipamount: { glue: { dimension: 6 }, grow: { dimension: 2 }, shrink: { dimension: 3 } }, bigskipamount: { glue: { dimension: 12 }, grow: { dimension: 2 }, shrink: { dimension: 4 } }, pretolerance: 100, tolerance: 200, hbadness: 1e3, vbadness: 1e3, linepenalty: 10, hyphenpenalty: 50, exhyphenpenalty: 50, binoppenalty: 700, relpenalty: 500, clubpenalty: 150, widowpenalty: 150, displaywidowpenalty: 50, brokenpenalty: 100, predisplaypenalty: 1e4, doublehyphendemerits: 1e4, finalhyphendemerits: 5e3, adjdemerits: 1e4, tracinglostchars: 1, uchyph: 1, delimiterfactor: 901, defaulthyphenchar: "\\-", defaultskewchar: -1, newlinechar: -1, showboxbreadth: 5, showboxdepth: 3, errorcontextlines: 5, interdisplaylinepenalty: 100, interfootnotelinepenalty: 100, baselineSkip: 1.2, arraystretch: 1, month: (/* @__PURE__ */ new Date()).getMonth() + 1, day: (/* @__PURE__ */ new Date()).getDate(), year: (/* @__PURE__ */ new Date()).getFullYear() };
function K0() {
  return m({}, ec);
}
function Vr() {
  return { registers: K0(), smartFence: false, renderPlaceholder: void 0, placeholderSymbol: "\u25A2", letterShapeStyle: I.locale.startsWith("fr") ? "french" : "tex", minFontScale: 0, maxMatrixCols: 10, colorMap: no, backgroundColorMap: z0, getMacro: (t33) => Pr(t33, Wi()) };
}
var z = class t3 {
  constructor(e, r) {
    var o, a, s, l, c, h, d, f, S, x, w, T, b, A, k;
    let i;
    e != null && e.parent ? (this.parent = e.parent, i = e.parent, this.registers = {}) : (i = m(m({}, Vr()), (o = e == null ? void 0 : e.from) != null ? o : {}), this.registers = i.registers), i.atomIdsSettings && (this.atomIdsSettings = m({}, i.atomIdsSettings)), this.renderPlaceholder = i.renderPlaceholder, this.isPhantom = (l = (s = e == null ? void 0 : e.isPhantom) != null ? s : (a = this.parent) == null ? void 0 : a.isPhantom) != null ? l : false, this.letterShapeStyle = i.letterShapeStyle, this.minFontScale = i.minFontScale, this.maxMatrixCols = i.maxMatrixCols, r != null && r.color && r.color !== "none" ? this.color = r.color : this.color = (h = (c = this.parent) == null ? void 0 : c.color) != null ? h : "", r != null && r.backgroundColor && r.backgroundColor !== "none" ? this.backgroundColor = r.backgroundColor : this.backgroundColor = (f = (d = this.parent) == null ? void 0 : d.backgroundColor) != null ? f : "", r != null && r.fontSize && r.fontSize !== "auto" && r.fontSize !== ((S = this.parent) == null ? void 0 : S.size) ? this.size = r.fontSize : this.size = (w = (x = this.parent) == null ? void 0 : x.size) != null ? w : Er;
    let n = (b = (T = this.parent) == null ? void 0 : T.mathstyle) != null ? b : ze.displaystyle;
    if (typeof (e == null ? void 0 : e.mathstyle) == "string") {
      if (i instanceof t3) switch (e.mathstyle) {
        case "cramp":
          n = n.cramp;
          break;
        case "superscript":
          n = n.sup;
          break;
        case "subscript":
          n = n.sub;
          break;
        case "numerator":
          n = n.fracNum;
          break;
        case "denominator":
          n = n.fracDen;
          break;
      }
      switch (e.mathstyle) {
        case "textstyle":
          n = ze.textstyle;
          break;
        case "displaystyle":
          n = ze.displaystyle;
          break;
        case "scriptstyle":
          n = ze.scriptstyle;
          break;
        case "scriptscriptstyle":
          n = ze.scriptscriptstyle;
          break;
        case "":
        case "auto":
          break;
      }
    }
    this.mathstyle = n, this.smartFence = i.smartFence, this.placeholderSymbol = i.placeholderSymbol, this.colorMap = (A = i.colorMap) != null ? A : ((L) => L), this.backgroundColorMap = (k = i.backgroundColorMap) != null ? k : ((L) => L), this.getMacro = i.getMacro, this.parent !== void 0 || this.registers;
  }
  makeID() {
    if (!this.atomIdsSettings) return;
    if (this.atomIdsSettings.overrideID) return this.atomIdsSettings.overrideID;
    if (typeof this.atomIdsSettings.seed != "number") return `${Date.now().toString(36).slice(-2)}${Math.floor(Math.random() * 1e5).toString(36)}`;
    let e = this.atomIdsSettings.seed.toString(36);
    return this.atomIdsSettings.seed += 1, e;
  }
  scale(e) {
    return e * this.effectiveFontSize;
  }
  get scalingFactor() {
    return this.parent ? this.effectiveFontSize / this.parent.effectiveFontSize : 1;
  }
  get isDisplayStyle() {
    return this.mathstyle.id === Qi || this.mathstyle.id === Ir;
  }
  get isCramped() {
    return this.mathstyle.cramped;
  }
  get isTight() {
    return this.mathstyle.isTight;
  }
  get metrics() {
    return this.mathstyle.metrics;
  }
  get effectiveFontSize() {
    return Math.max($r[Math.max(1, this.size + this.mathstyle.sizeDelta)], this.minFontScale);
  }
  getRegister(e) {
    if (this.registers && e in this.registers) return this.registers[e];
    if (this.parent) return this.parent.getRegister(e);
  }
  getRegisterAsNumber(e) {
    let r = this.getRegister(e);
    if (typeof r == "number") return r;
    if (typeof r == "string") return Number(r);
  }
  getRegisterAsGlue(e) {
    if (this.registers && e in this.registers) {
      let r = this.registers[e];
      return typeof r == "object" && "glue" in r ? r : typeof r == "object" && "dimension" in r ? { glue: { dimension: r.dimension } } : typeof r == "number" ? { glue: { dimension: r } } : void 0;
    }
    if (this.parent) return this.parent.getRegisterAsGlue(e);
  }
  getRegisterAsEm(e, r) {
    return en(this.getRegisterAsDimension(e), r);
  }
  getRegisterAsDimension(e) {
    if (this.registers && e in this.registers) {
      let r = this.registers[e];
      return typeof r == "object" && "glue" in r ? r.glue : typeof r == "object" && "dimension" in r ? r : typeof r == "number" ? { dimension: r } : void 0;
    }
    if (this.parent) return this.parent.getRegisterAsDimension(e);
  }
  setRegister(e, r) {
    if (r === void 0) {
      delete this.registers[e];
      return;
    }
    this.registers[e] = r;
  }
  evaluate(e) {
    if (!e || !("register" in e)) return e;
    let r = this;
    if ("global" in e && e.global) for (; r.parent; ) r = r.parent;
    let i = 1;
    "factor" in e && e.factor !== 1 && e.factor !== void 0 && (i = e.factor);
    let n = r.getRegister(e.register);
    if (n === void 0) return;
    if (typeof n == "string") return { string: Number(n).toString() + n };
    if (typeof n == "number") return { number: i * n };
    let o = r.evaluate(n);
    if (o !== void 0) return "string" in o ? { string: Number(n).toString() + o.string } : "number" in o ? { number: i * o.number } : "dimension" in o ? u(m({}, o), { dimension: i * o.dimension }) : "glue" in o ? u(m({}, o), { glue: u(m({}, o.glue), { dimension: i * o.glue.dimension }), shrink: o.shrink ? u(m({}, o.shrink), { dimension: i * o.shrink.dimension }) : void 0, grow: o.grow ? u(m({}, o.grow), { dimension: i * o.grow.dimension }) : void 0 }) : e;
  }
  toDimension(e) {
    let r = this.evaluate(e);
    if (r === void 0) return null;
    if ("dimension" in r) return r;
    if ("glue" in r) return r.glue;
    if ("number" in r) return { dimension: r.number };
    if ("string" in r) {
      let i = parseFloat(r.string), n = r.string.match(/(mm|cm|ex|px|em|bp|dd|pc|in|mu)$/);
      return n ? { dimension: i, unit: n[0] } : { dimension: i };
    }
    return null;
  }
  toEm(e, r) {
    if (e === null) return 0;
    let i = this.toDimension(e);
    return i === null ? 0 : xo(i, r) / Ge;
  }
  toNumber(e) {
    if (e === null) return null;
    let r = this.evaluate(e);
    return r === void 0 ? null : "number" in r ? r.number : "dimension" in r ? r.dimension : "glue" in r ? r.glue.dimension : "string" in r ? Number(r.string) : null;
  }
  toColor(e) {
    var i, n;
    if (e === null) return null;
    let r = this.evaluate(e);
    return r === void 0 ? null : "string" in r ? (n = (i = this.colorMap) == null ? void 0 : i.call(this, r.string)) != null ? n : r.string : null;
  }
  toBackgroundColor(e) {
    var i, n;
    if (e === null) return null;
    let r = this.evaluate(e);
    return r === void 0 ? null : "string" in r ? (n = (i = this.backgroundColorMap) == null ? void 0 : i.call(this, r.string)) != null ? n : r.string : null;
  }
};
var Mt = ["body", "above", "below", "superscript", "subscript"];
function wt(t33) {
  return typeof t33 == "string" && Mt.includes(t33);
}
function Jr(t33) {
  return t33 !== void 0 && Array.isArray(t33) && t33.length === 2;
}
var p = class t4 {
  constructor(e) {
    this.isRoot = false;
    var r, i, n, o, a, s, l;
    this.type = e.type, typeof e.value == "string" && (this.value = e.value), this.command = (i = (r = e.command) != null ? r : this.value) != null ? i : "", this.mode = (n = e.mode) != null ? n : "math", e.isFunction && (this.isFunction = true), (e.isRoot || this.type === "root") && (this.isRoot = true), e.limits && (this.subsupPlacement = e.limits), this.style = m({}, (o = e.style) != null ? o : {}), this.displayContainsHighlight = (a = e.displayContainsHighlight) != null ? a : false, this.captureSelection = (s = e.captureSelection) != null ? s : false, this.skipBoundary = (l = e.skipBoundary) != null ? l : false, e.verbatimLatex !== void 0 && e.verbatimLatex !== null && (this.verbatimLatex = e.verbatimLatex), e.args && (this.args = e.args), e.body && (this.body = e.body), this._changeCounter = 0;
  }
  static createBox(e, r, i) {
    var s;
    if (!r) return null;
    let n = tc(r), o = [];
    for (let l of n) {
      let c = l[0].style, h = rc(e, l, { style: { color: c.color, backgroundColor: c.backgroundColor, fontSize: c.fontSize } });
      h && o.push(h);
    }
    if (o.length === 0) return null;
    let a = ((s = i == null ? void 0 : i.classes) != null ? s : "").trim();
    return o.length === 1 && !a && !(i != null && i.type) ? o[0].wrap(e) : new y(o, { classes: a, type: i == null ? void 0 : i.type }).wrap(e);
  }
  static serialize(e, r) {
    return Y.serialize(e, r);
  }
  static commonAncestor(e, r) {
    if (e === r || e.parent === r.parent) return e.parent;
    let i = /* @__PURE__ */ new WeakSet(), { parent: n } = e;
    for (; n; ) i.add(n), n = n.parent;
    for (n = r.parent; n; ) {
      if (i.has(n)) return n;
      n = n.parent;
    }
  }
  static fromJson(e) {
    return typeof e == "string" ? new t4({ type: "mord", value: e, mode: "math" }) : new t4(e);
  }
  toJson() {
    if (this._json) return this._json;
    let e = {};
    if (this.type && (e.type = this.type), this.mode !== "math" && (e.mode = this.mode), this.command && this.command !== this.value && (e.command = this.command), this.value !== void 0 && (e.value = this.value), this.style && Object.keys(this.style).length > 0 && (e.style = m({}, this.style)), this.verbatimLatex !== void 0 && (e.verbatimLatex = this.verbatimLatex), this.subsupPlacement && (e.subsupPlacement = this.subsupPlacement), this.explicitSubsupPlacement && (e.explicitSubsupPlacement = true), this.isFunction && (e.isFunction = true), this.displayContainsHighlight && (e.displayContainsHighlight = true), this.skipBoundary && (e.skipBoundary = true), this.captureSelection && (e.captureSelection = true), this.args && (e.args = ic(this.args)), this._branches) for (let r of Object.keys(this._branches)) this._branches[r] && (e[r] = this._branches[r].filter((i) => i.type !== "first").map((i) => i.toJson()));
    return e.type === "mord" && Object.keys(e).length === 2 && "value" in e ? e.value : (this._json = e, e);
  }
  get changeCounter() {
    return this.parent ? this.parent.changeCounter : this._changeCounter;
  }
  set isDirty(e) {
    e && (this._json = void 0, this.parent || this._changeCounter++, "verbatimLatex" in this && (this.verbatimLatex = void 0), this._children = void 0, this.parent && (this.parent.isDirty = true));
  }
  _serialize(e) {
    if (!(e.expandMacro || e.skipStyles || e.skipPlaceholders) && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    return r != null && r.serialize ? r.serialize(this, e) : this.body && this.command ? D([F(this.command, this.bodyToLatex(e)), this.supsubToLatex(e)]) : this.body ? D([this.bodyToLatex(e), this.supsubToLatex(e)]) : !this.value || this.value === "\u200B" ? "" : this.command;
  }
  bodyToLatex(e) {
    var i;
    let r = (i = e.defaultMode) != null ? i : this.mode === "math" ? "math" : "text";
    return Y.serialize(this.body, u(m({}, e), { defaultMode: r }));
  }
  aboveToLatex(e) {
    return Y.serialize(this.above, e);
  }
  belowToLatex(e) {
    return Y.serialize(this.below, e);
  }
  supsubToLatex(e) {
    let r = "";
    if (e = u(m({}, e), { defaultMode: "math" }), this.branch("subscript") !== void 0) {
      let i = Y.serialize(this.subscript, e);
      i.length === 0 ? r += "_{}" : i.length === 1 ? /^[0-9]$/.test(i) ? r += `_${i}` : r += `_{${i}}` : r += `_{${i}}`;
    }
    if (this.branch("superscript") !== void 0) {
      let i = Y.serialize(this.superscript, e);
      i.length === 0 ? r += "^{}" : i.length === 1 ? i === "\u2032" ? r += "^\\prime " : i === "\u2033" ? r += "^\\doubleprime " : /^[0-9]$/.test(i) ? r += `^${i}` : r += `^{${i}}` : r += `^{${i}}`;
    }
    return r;
  }
  get treeDepth() {
    let e = 1, r = this.parent;
    for (; r; ) r = r.parent, e += 1;
    return e;
  }
  get inCaptureSelection() {
    let e = this;
    for (; e; ) {
      if (e.captureSelection) return true;
      e = e.parent;
    }
    return false;
  }
  get parentPrompt() {
    let e = this.parent;
    for (; e; ) {
      if (e.type === "prompt" && !e.captureSelection) return e;
      e = e.parent;
    }
    return null;
  }
  branch(e) {
    if (wt(e) && this._branches) return this._branches[e];
  }
  get branches() {
    if (!this._branches) return [];
    let e = [];
    for (let r of Mt) this._branches[r] && e.push(r);
    return e;
  }
  createBranch(e) {
    return wt(e), wt(e) ? (this._branches ? this._branches[e] || (this._branches[e] = [this.makeFirstAtom(e)]) : this._branches = { [e]: [this.makeFirstAtom(e)] }, this.isDirty = true, this._branches[e]) : [];
  }
  get row() {
    return Jr(this.parentBranch) ? this.parentBranch[0] : -1;
  }
  get col() {
    return Jr(this.parentBranch) ? this.parentBranch[1] : -1;
  }
  get body() {
    var e;
    return (e = this._branches) == null ? void 0 : e.body;
  }
  set body(e) {
    this.setChildren(e, "body");
  }
  get superscript() {
    var e;
    return (e = this._branches) == null ? void 0 : e.superscript;
  }
  set superscript(e) {
    this.setChildren(e, "superscript");
  }
  get subscript() {
    var e;
    return (e = this._branches) == null ? void 0 : e.subscript;
  }
  set subscript(e) {
    this.setChildren(e, "subscript");
  }
  get above() {
    var e;
    return (e = this._branches) == null ? void 0 : e.above;
  }
  set above(e) {
    this.setChildren(e, "above");
  }
  get below() {
    var e;
    return (e = this._branches) == null ? void 0 : e.below;
  }
  set below(e) {
    this.setChildren(e, "below");
  }
  applyStyle(e, r) {
    this.isDirty = true, r != null && r.unstyledOnly ? (e.color && !this.style.color && (this.style.color = e.color), e.backgroundColor && !this.style.backgroundColor && (this.style.backgroundColor = e.backgroundColor), e.fontFamily && !this.style.fontFamily && (this.style.fontFamily = e.fontFamily), e.fontShape && !this.style.fontShape && (this.style.fontShape = e.fontShape), e.fontSeries && !this.style.fontSeries && (this.style.fontSeries = e.fontSeries), e.fontSize && !this.style.fontSize && (this.style.fontSize = e.fontSize), e.variant && !this.style.variant && (this.style.variant = e.variant), e.variantStyle && !this.style.variantStyle && (this.style.variantStyle = e.variantStyle)) : this.style = m(m({}, this.style), e), this.style.fontFamily === "none" && delete this.style.fontFamily, this.style.fontShape === "auto" && delete this.style.fontShape, this.style.fontSeries === "auto" && delete this.style.fontSeries, this.style.color === "none" && (delete this.style.color, delete this.style.verbatimColor), this.style.backgroundColor === "none" && (delete this.style.backgroundColor, delete this.style.verbatimBackgroundColor), this.style.fontSize === "auto" && delete this.style.fontSize;
    for (let i of this.children) i.applyStyle(e, r);
  }
  getInitialBaseElement() {
    var e, r, i;
    return this.hasEmptyBranch("body") ? this : ((e = this.body) == null || e[0].type, (i = (r = this.body[1]) == null ? void 0 : r.getInitialBaseElement()) != null ? i : this);
  }
  getFinalBaseElement() {
    return this.hasEmptyBranch("body") ? this : this.body[this.body.length - 1].getFinalBaseElement();
  }
  isCharacterBox() {
    return this.type === "leftright" || this.type === "genfrac" || this.type === "subsup" || this.type === "delim" || this.type === "array" || this.type === "surd" ? false : this.getFinalBaseElement().type === "mord";
  }
  hasEmptyBranch(e) {
    let r = this.branch(e);
    return r ? (r.length > 0, r[0].type, r.length === 1) : true;
  }
  setChildren(e, r) {
    var n;
    if (!e || (wt(r), !wt(r))) return;
    let i = ((n = e[0]) == null ? void 0 : n.type) === "first" ? [...e] : [this.makeFirstAtom(r), ...e];
    this._branches ? this._branches[r] = i : this._branches = { [r]: i };
    for (let o of e) o.parent = this, o.parentBranch = r;
    this.isDirty = true;
  }
  makeFirstAtom(e) {
    let r = new t4({ type: "first", mode: this.mode });
    return r.parent = this, r.parentBranch = e, r;
  }
  addChild(e, r) {
    e.type, this.createBranch(r).push(e), this.isDirty = true, e.parent = this, e.parentBranch = r;
  }
  addChildBefore(e, r) {
    r.parentBranch;
    let i = this.createBranch(r.parentBranch);
    i.splice(i.indexOf(r), 0, e), this.isDirty = true, e.parent = this, e.parentBranch = r.parentBranch;
  }
  addChildAfter(e, r) {
    r.parentBranch;
    let i = this.createBranch(r.parentBranch);
    i.splice(i.indexOf(r) + 1, 0, e), this.isDirty = true, e.parent = this, e.parentBranch = r.parentBranch;
  }
  addChildren(e, r) {
    let i = this.createBranch(r);
    for (let n of e) n.parent = this, n.parentBranch = r, i.push(n);
    this.isDirty = true;
  }
  addChildrenAfter(e, r) {
    e.length === 0 || e[0].type, r.parentBranch;
    let i = this.createBranch(r.parentBranch);
    i.splice(i.indexOf(r) + 1, 0, ...e), this.isDirty = true;
    for (let n of e) n.parent = this, n.parentBranch = r.parentBranch;
    return e[e.length - 1];
  }
  removeBranch(e) {
    let r = this.branch(e);
    if (wt(e) && (this._branches[e] = void 0), !r) return [];
    for (let o of r) o.parent = void 0, o.parentBranch = void 0;
    r[0].type;
    let [i, ...n] = r;
    return this.isDirty = true, n;
  }
  removeChild(e) {
    if (e.parent, e.type === "first") return;
    let r = this.branch(e.parentBranch), i = r.indexOf(e);
    i >= 0, r.splice(i, 1), this.isDirty = true, e.parent = void 0, e.parentBranch = void 0;
  }
  get siblings() {
    return this.parent ? this.parent.branch(this.parentBranch) : [];
  }
  get firstSibling() {
    return this.siblings[0];
  }
  get lastSibling() {
    let { siblings: e } = this;
    return e[e.length - 1];
  }
  get isFirstSibling() {
    return this === this.firstSibling;
  }
  get isLastSibling() {
    return this === this.lastSibling;
  }
  get hasNoSiblings() {
    return this.siblings.length === 1;
  }
  get leftSibling() {
    this.parent;
    let e = this.parent.branch(this.parentBranch);
    return e[e.indexOf(this) - 1];
  }
  get rightSibling() {
    this.parent;
    let e = this.parent.branch(this.parentBranch);
    return e[e.indexOf(this) + 1];
  }
  get hasChildren() {
    return !!(this._branches && this.children.length > 0);
  }
  get firstChild() {
    return this.hasChildren, this.children[0];
  }
  get lastChild() {
    this.hasChildren;
    let { children: e } = this;
    return e[e.length - 1];
  }
  get children() {
    if (this._children) return this._children;
    if (!this._branches) return [];
    let e = [];
    for (let r of Mt) if (this._branches[r]) for (let i of this._branches[r]) e.push(...i.children), e.push(i);
    return this._children = e, e;
  }
  render(e) {
    if (this.type === "first" && !e.atomIdsSettings) return null;
    let r = H(this.command, this.mode);
    if (r != null && r.render) return r.render(this, e);
    let i = new z({ parent: e }, this.style), n = this.createBox(i, { classes: this.parent ? "" : "ML__base" });
    return n ? (!this.subsupPlacement && (this.superscript || this.subscript) && (n = this.attachSupsub(i, { base: n })), n.wrap(i)) : null;
  }
  attachSupsub(e, r) {
    var x;
    let i = r.base, n = this.superscript, o = this.subscript;
    if (!n && !o) return i;
    let a = null, s = null, l = (x = r.isCharacterBox) != null ? x : this.isCharacterBox(), c = 0;
    if (n) {
      let w = new z({ parent: e, mathstyle: "superscript" });
      a = t4.createBox(w, n), l || (c = i.height - e.metrics.supDrop * w.scalingFactor);
    }
    let h = 0;
    if (o) {
      let w = new z({ parent: e, mathstyle: "subscript" });
      s = t4.createBox(w, o), l || (h = i.depth + e.metrics.subDrop * w.scalingFactor);
    }
    let d;
    e.isDisplayStyle ? d = e.metrics.sup1 : e.isCramped ? d = e.metrics.sup3 : d = e.metrics.sup2;
    let f = 0.5 / Ge / e.scalingFactor, S = null;
    if (s && a) {
      c = Math.max(c, d, a.depth + 0.25 * e.metrics.xHeight), h = Math.max(h, e.metrics.sub2);
      let w = e.metrics.defaultRuleThickness;
      if (c - a.depth - (s.height - h) < 4 * w) {
        h = 4 * w - (c - a.depth) + s.height;
        let b = 0.8 * e.metrics.xHeight - (c - a.depth);
        b > 0 && (c += b, h -= b);
      }
      let T = this.type === "extensible-symbol" && i.italic ? -i.italic : 0;
      S = new V({ individualShift: [{ box: s, shift: h, marginLeft: T }, { box: a, shift: -c }] });
    } else s && !a ? (h = Math.max(h, e.metrics.sub1, s.height - 0.8 * ve), S = new V({ shift: h, children: [{ box: s, marginRight: f, marginLeft: this.isCharacterBox() ? -i.italic : 0 }] })) : !s && a && (c = Math.max(c, d, a.depth + 0.25 * ve), S = new V({ shift: -c, children: [{ box: a, marginRight: f }] }));
    return new y([i, new y(S, { caret: this.caret, isSelected: this.isSelected, classes: "ML__msubsup" })], { type: r.type });
  }
  attachLimits(e, r) {
    let i = this.superscript ? t4.createBox(new z({ parent: e, mathstyle: "superscript" }, this.style), this.superscript) : null, n = this.subscript ? t4.createBox(new z({ parent: e, mathstyle: "subscript" }, this.style), this.subscript) : null;
    return !i && !n ? r.base.wrap(e) : Z0(e, u(m({}, r), { above: i, below: n }));
  }
  bind(e, r) {
    if (!r || e.isPhantom || this.value === "\u200B") return r;
    let i = this.parent;
    for (; i && !i.captureSelection; ) i = i.parent;
    return i != null && i.captureSelection || (this.id || (this.id = e.makeID()), r.atomID = this.id), r;
  }
  createBox(e, r) {
    var s, l, c, h;
    let i = (s = this.value) != null ? s : this.body, n = (l = r == null ? void 0 : r.boxType) != null ? l : Ki(this.type), o = (c = r == null ? void 0 : r.classes) != null ? c : "";
    this.mode === "text" && (o += " ML__text");
    let a = typeof i == "string" || i === void 0 ? new y(i != null ? i : null, { type: n, isSelected: this.isSelected, mode: this.mode, maxFontSize: e.scalingFactor, style: u(m({ variant: "normal" }, this.style), { fontSize: Math.max(1, e.size + e.mathstyle.sizeDelta) }), letterShapeStyle: e.letterShapeStyle, classes: o }) : (h = t4.createBox(e, i, { type: n, classes: o })) != null ? h : new y(null);
    return e.isTight && (a.isTight = true), (this.mode !== "math" || this.style.variant === "main") && (a.italic = 0), a.right = a.italic, this.bind(e, a), this.caret && !this.superscript && !this.subscript && (a.caret = this.caret), a;
  }
  isDigit() {
    var e;
    return this.type === "mord" && this.value ? /^[\d,\.]$/.test(this.value) : this.type === "group" && ((e = this.body) == null ? void 0 : e.length) === 2 ? this.body[0].type === "first" && this.body[1].value === "," : false;
  }
  asDigit() {
    var e;
    return this.type === "mord" && this.value && /^[\d,\.]$/.test(this.value) ? this.value : this.type === "group" && ((e = this.body) == null ? void 0 : e.length) === 2 && this.body[0].type === "first" && this.body[1].value === "," ? "." : "";
  }
};
function tc(t33) {
  let e, r = [], i = [];
  for (let n of t33) {
    if (n.type === "first") {
      i.push(n);
      continue;
    }
    if (!e && !n.style) i.push(n);
    else {
      let o = n.style;
      e && o.color === e.color && o.backgroundColor === e.backgroundColor && o.fontSize === e.fontSize ? i.push(n) : (i.length > 0 && r.push(i), i = [n], e = o);
    }
  }
  return i.length > 0 && r.push(i), r;
}
function rc(t33, e, r) {
  var s, l, c, h, d;
  if (!e || e.length === 0) return null;
  let i = new z({ parent: t33 }, r.style), n = !((s = i.atomIdsSettings) != null && s.groupNumbers), o = [];
  if (e.length === 1) {
    let f = e[0], S = f.render(i);
    S && (n && f.isSelected && S.selected(true), o = [S]);
  } else {
    let f = "", S = true;
    for (let x of e) {
      (l = i.atomIdsSettings) != null && l.groupNumbers && f && (S && x.isDigit() || !S && vo(x)) && (i.atomIdsSettings.overrideID = f);
      let w = x.render(i);
      i.atomIdsSettings && (i.atomIdsSettings.overrideID = void 0), w && ((c = i.atomIdsSettings) != null && c.groupNumbers && ((x.isDigit() || vo(x)) && (!f || S !== x.isDigit()) && (S = x.isDigit(), f = (h = x.id) != null ? h : ""), f && (!(x.isDigit() || vo(x)) || !x.hasEmptyBranch("superscript") || !x.hasEmptyBranch("subscript")) && (f = "")), n && x.isSelected && w.selected(true), o.push(w));
    }
  }
  if (o.length === 0) return null;
  let a = new y(o, u(m({ isTight: i.isTight }, r), { type: (d = r.type) != null ? d : "lift" }));
  return a.isSelected = o.every((f) => f.isSelected), a.wrap(i);
}
function vo(t33) {
  return t33.mode === "text";
}
function ic(t33) {
  return t33.map((e) => e === null ? "<null>" : Array.isArray(e) && e[0] instanceof p ? { atoms: e.map((r) => r.toJson()) } : typeof e == "object" && "group" in e ? { group: e.group.map((r) => r.toJson()) } : e);
}
var At = class t5 extends p {
  constructor(e) {
    var r;
    super(u(m({}, e), { type: "accent", body: (r = e.body) != null ? r : void 0 })), e.accentChar ? this.accent = e.accentChar : this.svgAccent = e == null ? void 0 : e.svgAccent, this.skipBoundary = true, this.captureSelection = true;
  }
  static fromJson(e) {
    return new t5(e);
  }
  toJson() {
    return u(m({}, super.toJson()), { accentChar: this.accent, svgAccent: this.svgAccent });
  }
  render(e) {
    var c;
    let r = new z({ parent: e, mathstyle: "cramp" }, this.style), i = (c = p.createBox(r, this.body)) != null ? c : new y("\u25A1", { style: this.style }), n = 0;
    !this.hasEmptyBranch("body") && this.body.length === 2 && this.body[1].isCharacterBox() && (n = i.skew);
    let o = Math.min(i.height, ve), a;
    if (this.svgAccent) a = sr(this.svgAccent), o = r.metrics.bigOpSpacing1 - o;
    else if (this.accent) {
      let h = new y(this.accent, { fontFamily: "Main-Regular" });
      h.italic = 0;
      let d = this.accent === 8407 || this.accent === 8411 || this.accent === 8412 ? " ML__accent-combining-char" : "";
      a = new y(h, { classes: "ML__accent-body" + d });
    }
    let s = (i.width - a.width) / 2 + i.left + 2 * n;
    a = new V({ shift: 0, children: [{ box: new y(i) }, -o, { box: a, marginLeft: s, classes: ["ML__center"] }] });
    let l = new y(a, { type: "ord" });
    return this.caret && (l.caret = this.caret), this.bind(r, l.wrap(r)), this.attachSupsub(r, { base: l });
  }
};
var So = { "(": ")", "{": "}", "[": "]", "|": "|", "\\lbrace": "\\rbrace", "\\lparen": "\\rparen", "\\{": "\\}", "\\langle": "\\rangle", "\\lfloor": "\\rfloor", "\\lceil": "\\rceil", "\\vert": "\\vert", "\\lvert": "\\rvert", "\\Vert": "\\Vert", "\\lVert": "\\rVert", "\\lbrack": "\\rbrack", "\\ulcorner": "\\urcorner", "\\llcorner": "\\lrcorner", "\\lgroup": "\\rgroup", "\\lmoustache": "\\rmoustache" };
var bu = Object.fromEntries(Object.entries(So).map(([t33, e]) => [e, t33]));
function tn(t33) {
  var e;
  return (e = { "[": 91, "]": 93, "(": 40, ")": 41, "\\mid": 8739, "|": 8739, "\u2223": 8739, "\u2225": 8741, "\\|": 8739, "\\{": 123, "\\}": 125, "\\lbrace": 123, "\\rbrace": 125, "\\lparen": 40, "\\rparen": 41, "\\lbrack": 91, "\\rbrack": 93, "\\vert": 8739, "\\lvert": 8739, "\\mvert": 8739, "\\rvert": 8739, "\\Vert": 8741, "\\lVert": 8741, "\\mVert": 8741, "\\rVert": 8741, "\\parallel": 8741, "\\shortparallel": 8741, "\\langle": 10216, "\\rangle": 10217, "\\lfloor": 8970, "\\rfloor": 8971, "\\lceil": 8968, "\\rceil": 8969, "\\ulcorner": 9484, "\\urcorner": 9488, "\\llcorner": 9492, "\\lrcorner": 9496, "\\lgroup": 10222, "\\rgroup": 10223, "\\lmoustache": 9136, "\\rmoustache": 9137, "\\surd": 8730 }[t33]) != null ? e : t33.codePointAt(0);
}
function nc(t33, e, r, i) {
  var a;
  let o = new y(tn(t33), { fontFamily: "Main-Regular", isSelected: i.isSelected, classes: "ML__small-delim " + ((a = i.classes) != null ? a : "") }).wrap(e);
  return r && o.setTop((1 - e.scalingFactor) * de), o;
}
function Y0(t33, e, r, i, n) {
  var s, l;
  let o = new z({ parent: i, mathstyle: "textstyle" }, n == null ? void 0 : n.style), a = new y(tn(t33), { fontFamily: `Size${e}-Regular`, isSelected: n.isSelected, classes: ((s = n.classes) != null ? s : "") + ` ML__delim-size${e}`, type: (l = n.type) != null ? l : "ignore" }).wrap(o);
  return r && a.setTop((1 - o.scalingFactor) * de), a;
}
function Q0(t33, e, r, i, n) {
  var ee;
  let o, a, s, l;
  o = s = l = tn(t33), a = null;
  let c = "Size1-Regular";
  t33 === "\\vert" || t33 === "\\lvert" || t33 === "\\rvert" || t33 === "\\mvert" || t33 === "\\mid" ? s = o = l = 8739 : t33 === "\\Vert" || t33 === "\\lVert" || t33 === "\\rVert" || t33 === "\\mVert" || t33 === "\\|" ? s = o = l = 8741 : t33 === "\\uparrow" ? s = l = 9168 : t33 === "\\Uparrow" ? s = l = 8214 : t33 === "\\downarrow" ? o = s = 9168 : t33 === "\\Downarrow" ? o = s = 8214 : t33 === "\\updownarrow" ? (o = 8593, s = 9168, l = 8595) : t33 === "\\Updownarrow" ? (o = 8657, s = 8214, l = 8659) : t33 === "[" || t33 === "\\lbrack" ? (o = 9121, s = 9122, l = 9123, c = "Size4-Regular") : t33 === "]" || t33 === "\\rbrack" ? (o = 9124, s = 9125, l = 9126, c = "Size4-Regular") : t33 === "\\lfloor" || t33 === "\u230A" ? (s = o = 9122, l = 9123, c = "Size4-Regular") : t33 === "\\lceil" || t33 === "\u2308" ? (o = 9121, s = l = 9122, c = "Size4-Regular") : t33 === "\\rfloor" || t33 === "\u230B" ? (s = o = 9125, l = 9126, c = "Size4-Regular") : t33 === "\\rceil" || t33 === "\u2309" ? (o = 9124, s = l = 9125, c = "Size4-Regular") : t33 === "(" || t33 === "\\lparen" ? (o = 9115, s = 9116, l = 9117, c = "Size4-Regular") : t33 === ")" || t33 === "\\rparen" ? (o = 9118, s = 9119, l = 9120, c = "Size4-Regular") : t33 === "\\{" || t33 === "\\lbrace" ? (o = 9127, a = 9128, l = 9129, s = 9130, c = "Size4-Regular") : t33 === "\\}" || t33 === "\\rbrace" ? (o = 9131, a = 9132, l = 9133, s = 9130, c = "Size4-Regular") : t33 === "\\lgroup" || t33 === "\u27EE" ? (o = 9127, l = 9129, s = 9130, c = "Size4-Regular") : t33 === "\\rgroup" || t33 === "\u27EF" ? (o = 9131, l = 9133, s = 9130, c = "Size4-Regular") : t33 === "\\lmoustache" || t33 === "\u23B0" ? (o = 9127, l = 9133, s = 9130, c = "Size4-Regular") : t33 === "\\rmoustache" || t33 === "\u23B1" ? (o = 9131, l = 9129, s = 9130, c = "Size4-Regular") : t33 === "\\surd" ? (o = 57345, l = 9143, s = 57344, c = "Size4-Regular") : t33 === "\\ulcorner" ? (o = 9484, s = l = 32) : t33 === "\\urcorner" ? (o = 9488, s = l = 32) : t33 === "\\llcorner" ? (l = 9492, s = o = 32) : t33 === "\\lrcorner" && (o = 9496, s = o = 32);
  let h = bt(o, c), d = h.height + h.depth, f = bt(s, c), S = f.height + f.depth, x = bt(l, c), w = x.height + x.depth, T = 0, b = 1;
  if (a !== null) {
    let te = bt(a, c);
    T = te.height + te.depth, b = 2;
  }
  let A = d + w + T, k = Math.max(0, Math.ceil((e - A) / (b * S))), L = A + k * b * S, P = de;
  r && (P = P * i.scalingFactor);
  let B = L / 2 - P, _ = 8e-3, $ = [];
  $.push({ box: new y(l, { fontFamily: c }) }), $.push(-_);
  let O = new y(s, { fontFamily: c });
  if (a === null) for (let te = 0; te < k; te++) $.push({ box: O });
  else {
    for (let te = 0; te < k; te++) $.push({ box: O });
    $.push(-_), $.push({ box: new y(a, { fontFamily: c }) }), $.push(-_);
    for (let te = 0; te < k; te++) $.push({ box: O });
  }
  $.push(-_), $.push({ box: new y(o, { fontFamily: c }) });
  let K = "";
  c === "Size1-Regular" ? K = " delim-size1" : c === "Size4-Regular" && (K = " delim-size4");
  let E = new V({ bottom: B, children: $ }, { classes: K });
  return new y(E, u(m({}, n != null ? n : {}), { classes: ((ee = n == null ? void 0 : n.classes) != null ? ee : "") + " ML__delim-mult" }));
}
var el = /* @__PURE__ */ new Set(["(", ")", "\\lparen", "\\rparen", "[", "]", "\\lbrack", "\\rbrack", "\\{", "\\}", "\\lbrace", "\\rbrace", "\\lfloor", "\\rfloor", "\\lceil", "\\rceil", "\\surd", "\u230A", "\u230B", "\u2308", "\u2309"]);
var oc = /* @__PURE__ */ new Set(["\\uparrow", "\\downarrow", "\\updownarrow", "\\Uparrow", "\\Downarrow", "\\Updownarrow", "|", "\\|", "\\vert", "\\Vert", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\mvert", "\\mid", "\\lgroup", "\\rgroup", "\\lmoustache", "\\rmoustache", "\u27EE", "\u27EF", "\u23B0", "\u23B1"]);
var tl = /* @__PURE__ */ new Set(["<", ">", "\\langle", "\\rangle", "/", "\\backslash", "\\lt", "\\gt"]);
var ac = [0, 1.2, 1.8, 2.4, 3];
function rl(t33, e, r, i) {
  return t33 === void 0 || t33 === "." ? rt(r, i.classes) : (t33 === "<" || t33 === "\\lt" || t33 === "\u27E8" ? t33 = "\\langle" : (t33 === ">" || t33 === "\\gt" || t33 === "\u27E9") && (t33 = "\\rangle"), el.has(t33) || tl.has(t33) ? Y0(t33, e, false, r, i) : oc.has(t33) ? Q0(t33, ac[e], false, r, i) : ("" + t33, null));
}
var sc = [{ type: "small", mathstyle: "scriptscriptstyle" }, { type: "small", mathstyle: "scriptstyle" }, { type: "small", mathstyle: "textstyle" }, { type: "large", size: 1 }, { type: "large", size: 2 }, { type: "large", size: 3 }, { type: "large", size: 4 }];
var lc = [{ type: "small", mathstyle: "scriptscriptstyle" }, { type: "small", mathstyle: "scriptscriptstyle" }, { type: "small", mathstyle: "textstyle" }, { type: "stack" }];
var cc = [{ type: "small", mathstyle: "scriptscriptstyle" }, { type: "small", mathstyle: "scriptstyle" }, { type: "small", mathstyle: "textstyle" }, { type: "large", size: 1 }, { type: "large", size: 2 }, { type: "large", size: 3 }, { type: "large", size: 4 }, { type: "stack" }];
function mc(t33) {
  return t33.type === "small" ? "Main-Regular" : t33.type === "large" ? "Size" + t33.size + "-Regular" : (t33.type, "Size4-Regular");
}
function uc(t33, e, r, i) {
  let n = { "-4": 0, "-3": 1, 0: 2 }[i.mathstyle.sizeDelta];
  for (let o = n; o < r.length && r[o].type !== "stack"; o++) {
    let a = bt(t33, mc(r[o]));
    if (a.defaultMetrics) return { type: "small", mathstyle: "scriptstyle" };
    let s = a.height + a.depth;
    if (r[o].type === "small" && (r[o].mathstyle === "scriptscriptstyle" ? s *= Math.max($r[Math.max(1, i.size - 2)], i.minFontScale) : r[o].mathstyle === "scriptstyle" && (s *= Math.max($r[Math.max(1, i.size - 1)], i.minFontScale))), s > e) return r[o];
  }
  return r[r.length - 1];
}
function lr(t33, e, r, i, n, o) {
  if (!e || e.length === 0 || e === ".") return rt(n);
  e === "<" || e === "\\lt" ? e = "\\langle" : (e === ">" || e === "\\gt") && (e = "\\rangle");
  let a;
  tl.has(e) ? a = sc : el.has(e) ? a = cc : a = lc;
  let s = uc(tn(e), r, a, n), l = new z({ parent: n, mathstyle: s.mathstyle }, o == null ? void 0 : o.style);
  return s.type === "small" ? nc(e, l, i, u(m({}, o), { type: t33 })) : s.type === "large" ? Y0(e, s.size, i, l, u(m({}, o), { type: t33 })) : (s.type, Q0(e, r, i, l, u(m({}, o), { type: t33 })));
}
function Ot(t33, e, r, i, n, o) {
  if (e === ".") return rt(n, o == null ? void 0 : o.classes);
  let a = de * n.scalingFactor, s = 901, l = 5 / Ge, c = Math.max(r - a, i + a), h = Math.max(c / 500 * s, 2 * c - l);
  return lr(t33, e, h, true, n, o);
}
function rt(t33, e) {
  let r = new y(null, { classes: " ML__nulldelimiter " + (e != null ? e : ""), type: "ignore" });
  return r.width = t33.getRegisterAsEm("nulldelimiterspace"), r.wrap(new z({ parent: t33, mathstyle: "textstyle" }));
}
var se = class t6 extends p {
  constructor(e) {
    var r, i, n, o;
    super({ type: "overunder", command: e.command, style: e.style, mode: e.mode, body: e.body, skipBoundary: (r = e.skipBoundary) != null ? r : true }), this.subsupPlacement = e.supsubPlacement, this.svgAbove = e.svgAbove, this.svgBelow = e.svgBelow, this.svgBody = e.svgBody, this.above = e.above, this.below = e.below, this.boxType = (i = e.boxType) != null ? i : "ord", this.paddedBody = (n = e.paddedBody) != null ? n : false, this.paddedLabels = (o = e.paddedLabels) != null ? o : false;
  }
  static fromJson(e) {
    return new t6(e);
  }
  toJson() {
    let e = super.toJson();
    return this.skipBoundary || (e.skipBoundary = false), this.subsupPlacement && (e.subsupPlacement = this.subsupPlacement), this.svgAbove && (e.svgAbove = this.svgAbove), this.svgBelow && (e.svgBelow = this.svgBelow), this.svgBody && (e.svgBody = this.svgBody), this.boxType !== "ord" && (e.boxType = this.boxType), this.paddedBody && (e.paddedBody = true), this.paddedLabels && (e.paddedLabels = true), e;
  }
  render(e) {
    let r = this.svgBody ? sr(this.svgBody) : p.createBox(e, this.body, { type: "ignore" }), i = new z({ parent: e, mathstyle: "scriptstyle" }, this.style), n = null;
    this.svgAbove ? n = sr(this.svgAbove) : this.above && (n = p.createBox(i, this.above, { type: "ignore" }));
    let o = null;
    this.svgBelow ? o = sr(this.svgBelow) : this.below && (o = p.createBox(i, this.below, { type: "ignore" })), this.paddedBody && (r = new y([rt(e, "ML__open"), r, rt(e, "ML__close")], { type: "ignore" }));
    let a = hc(e, { base: r, above: n, below: o, type: this.boxType === "bin" || this.boxType === "rel" ? this.boxType : "ord", paddedAboveBelow: this.paddedLabels });
    return a ? (this.subsupPlacement === "over-under" ? a = this.attachLimits(e, { base: a, type: a.type }) : a = this.attachSupsub(e, { base: a }), this.caret && (a.caret = this.caret), this.bind(e, a)) : null;
  }
};
function hc(t33, e) {
  if (!e.base) return null;
  if (!e.above && !e.below) {
    let s = new y(e.base, { type: e.type });
    return s.setStyle("position", "relative"), s;
  }
  let r = 0;
  e.above && (r = t33.metrics.bigOpSpacing5);
  let i = null, n = e.base, o = 0, a = ["ML__center"];
  if (e.paddedAboveBelow && a.push("ML__label_padding"), e.below && e.above) {
    let s = t33.metrics.bigOpSpacing5 + e.below.height + e.below.depth + n.depth + o;
    i = new V({ bottom: s, children: [t33.metrics.bigOpSpacing5, { box: e.below, classes: a }, { box: n, classes: ["ML__center"] }, r, { box: e.above, classes: a }, t33.metrics.bigOpSpacing5] });
  } else e.below ? i = new V({ top: n.height - o, children: [t33.metrics.bigOpSpacing5, { box: e.below, classes: a }, { box: n, classes: ["ML__center"] }] }) : e.above && (i = new V({ bottom: n.depth + o, children: [{ box: n, classes: ["ML__center"] }, r, { box: e.above, classes: a }, t33.metrics.bigOpSpacing5] }));
  return new y(i, { type: e.type });
}
var il = { acute: 714, grave: 715, dot: 729, ddot: 168, dddot: 8411, ddddot: 8412, mathring: 730, tilde: 126, bar: 713, breve: 728, check: 711, hat: 94, vec: 8407 };
g(Object.keys(il), "{body:auto}", { createAtom: (t33) => new At(u(m({}, t33), { body: M(t33.args[0]), accentChar: il[t33.command.slice(1)] })) });
g(["widehat", "widecheck", "widetilde"], "{body:auto}", { createAtom: (t33) => {
  let e = ho(M(t33.args[0]));
  return new At(u(m({}, t33), { body: M(t33.args[0]), svgAccent: t33.command.slice(1) + (e.length > 5 ? "4" : ["1", "1", "2", "2", "3", "3"][e.length]) }));
} });
g(["overarc", "overparen", "wideparen"], "{body:auto}", { createAtom: (t33) => new At(u(m({}, t33), { body: M(t33.args[0]), svgAccent: "overarc" })) });
g(["underarc", "underparen"], "{body:auto}", { createAtom: (t33) => new se(u(m({}, t33), { body: M(t33.args[0]), svgBelow: "underarc" })) });
g("utilde", "{body:auto}", { createAtom: (t33) => {
  let e = M(t33.args[0]), r = ho(e), i = "widetilde" + (r.length > 5 ? "4" : ["1", "1", "2", "2", "3", "3"][r.length]);
  return new se(u(m({}, t33), { body: e, svgBelow: i, boxType: Ft(e) }));
} });
g("^", "{:string}", { createAtom: (t33) => {
  var e;
  return new p(u(m({}, t33), { type: "mord", isFunction: false, limits: "adjacent", value: t33.args[0] && (e = { a: "\xE2", e: "\xEA", i: "\xEE", o: "\xF4", u: "\xFB", A: "\xC2", E: "\xCA", I: "\xCE", O: "\xD4", U: "\xDB" }[t33.args[0]]) != null ? e : "^" }));
} });
g("`", "{:string}", { createAtom: (t33) => {
  var e;
  return new p(u(m({}, t33), { type: "mord", isFunction: false, limits: "adjacent", value: t33.args[0] && (e = { a: "\xE0", e: "\xE8", i: "\xEC", o: "\xF2", u: "\xF9", A: "\xC0", E: "\xC8", I: "\xCC", O: "\xD2", U: "\xD9" }[t33.args[0]]) != null ? e : "`" }));
} });
g("'", "{:string}", { createAtom: (t33) => {
  var e;
  return new p(u(m({}, t33), { type: "mord", isFunction: false, limits: "adjacent", value: t33.args[0] && (e = { a: "\xE1", e: "\xE9", i: "\xED", o: "\xF3", u: "\xFA", A: "\xC1", E: "\xC9", I: "\xCD", O: "\xD3", U: "\xDA" }[t33.args[0]]) != null ? e : "'" }));
} });
g('"', "{:string}", { createAtom: (t33) => {
  var e, r;
  return new p(u(m({}, t33), { type: "mord", isFunction: false, limits: "adjacent", value: (e = t33.args) != null && e[0] ? (r = { a: "\xE4", e: "\xEB", i: "\xEF", o: "\xF6", u: "\xFC", A: "\xC4", E: "\xCB", I: "\xCB", O: "\xD6", U: "\xDC" }[t33.args[0]]) != null ? r : '"' + t33.args[0] : '"' }));
} });
g(".", "{:string}", { createAtom: (t33) => {
  var e, r;
  return new p(u(m({}, t33), { type: "mord", isFunction: false, limits: "adjacent", value: (e = t33.args) != null && e[0] ? (r = { a: "\u0227", e: "\u0117", i: "\u0307i", o: "\u022F", u: "\u0307u", A: "\u0226", E: "\u0116", I: "\u0130", O: "\u022E", U: "\u0307U" }[t33.args[0]]) != null ? r : "." + t33.args[0] : "." }));
} });
g("=", "{:string}", { createAtom: (t33) => {
  var e, r;
  return new p(u(m({}, t33), { type: "mord", isFunction: false, limits: "adjacent", value: (e = t33.args) != null && e[0] ? (r = { a: "\u0101", e: "\u0113", i: "\u012B", o: "\u014D", u: "\u016B", A: "\u0100", E: "\u0112", I: "\u012A", O: "\u014C", U: "\u016A" }[t33.args[0]]) != null ? r : "=" + t33.args[0] : "=" }));
} });
g("~", "{:string}", { createAtom: (t33) => {
  var e;
  return new p(u(m({ type: "mord" }, t33), { isFunction: false, limits: "adjacent", value: t33.args[0] && (e = { n: "\xF1", N: "\xD1", a: "\xE3", o: "\xF5", A: "\xC3", O: "\xD5" }[t33.args[0]]) != null ? e : "\xB4" }));
} });
g("c", "{:string}", { createAtom: (t33) => {
  var e;
  return new p(u(m({}, t33), { type: "mord", isFunction: false, limits: "adjacent", value: t33.args[0] && (e = { c: "\xE7", C: "\xC7" }[t33.args[0]]) != null ? e : "" }));
} });
function cr(t33) {
  return t33.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var it = class t7 extends p {
  constructor(e, r, i, n) {
    var o, a;
    super({ type: "enclose", command: e, style: n.style }), this.body = r, this.backgroundcolor = n.backgroundcolor, i.updiagonalarrow && (i.updiagonalstrike = false), i.box && (i.left = false, i.right = false, i.bottom = false, i.top = false), this.notation = i, this.shadow = (o = n.shadow) != null ? o : "none", this.strokeWidth = (a = n.strokeWidth) != null ? a : "0.06em", this.strokeWidth || (this.strokeWidth = "0.06em"), this.strokeStyle = n.strokeStyle, this.svgStrokeStyle = n.svgStrokeStyle, this.strokeColor = n.strokeColor, this.borderStyle = n.borderStyle, this.padding = n.padding, this.captureSelection = false;
  }
  static fromJson(e) {
    return new t7(e.command, e.body, e.notation, e);
  }
  toJson() {
    return u(m({}, super.toJson()), { notation: this.notation, shadow: this.shadow, strokeWidth: this.strokeWidth, strokeStyle: this.strokeStyle, svgStrokeStyle: this.svgStrokeStyle, strokeColor: this.strokeColor, borderStyle: this.borderStyle, padding: this.padding });
  }
  _serialize(e) {
    var n;
    if (!(e.expandMacro || e.skipStyles || e.skipPlaceholders) && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    if (r != null && r.serialize) return r.serialize(this, e);
    let i = (n = this.command) != null ? n : "";
    if (this.command === "\\enclose") {
      i += "{" + Object.keys(this.notation).join(" ") + "}";
      let o = "", a = "";
      this.backgroundcolor && this.backgroundcolor !== "transparent" && (o += a + 'mathbackground="' + this.backgroundcolor + '"', a = ","), this.shadow && this.shadow !== "auto" && (o += a + 'shadow="' + this.shadow + '"', a = ","), this.strokeWidth || this.strokeStyle !== "solid" ? (o += a + this.borderStyle, a = ",") : this.strokeColor && this.strokeColor !== "currentColor" && (o += a + 'mathcolor="' + this.strokeColor + '"', a = ","), o && (i += `[${o}]`);
    }
    return F(i, this.bodyToLatex(e));
  }
  render(e) {
    var S, x, w, T, b;
    let r = new z({ parent: e }, this.style), i = p.createBox(r, this.body);
    if (!i) return null;
    let n = dc(this.borderStyle), o = r.toEm(!this.padding || this.padding === "auto" ? { register: "fboxsep" } : { string: this.padding });
    i.setStyle("position", "relative"), i.setStyle("display", "inline-block"), i.setStyle("height", i.height + i.depth, "em"), i.setStyle("width", i.width, "em");
    let a = new y(null, { classes: "ML__notation" }), s = i.height + i.depth + 2 * o, l = i.width + 2 * o, c = "", h = Math.min(o * 0.2, 0.05);
    if (this.notation.horizontalstrike) {
      let A = 2 * o + i.height - ve / 2;
      c += this.line((o + h).toString(), A.toString(), (o + i.width - h).toString(), A.toString());
    }
    if (this.notation.verticalstrike) {
      let A = o + i.width / 2;
      c += this.line(A.toString(), (o + h).toString(), A.toString(), (s - o - h).toString());
    }
    if (this.notation.updiagonalstrike && (c += this.line((o + h).toString(), (s - o - h).toString(), (o + i.width - h).toString(), (o + h).toString())), this.notation.downdiagonalstrike && (c += this.line((o + h).toString(), (o + h).toString(), (o + i.width - h).toString(), (s - o - h).toString())), this.notation.updiagonalarrow) {
      c += this.line(o.toString(), (2 * o + i.depth + i.height).toString(), (o + i.width).toString(), o.toString());
      let L = 0.03 * Math.sqrt(l * l + s * s) * 1, P = i.width * L, B = (i.depth + i.height) * L, _ = o + i.width, $ = o;
      $ + B - 0.4 * P < 0 && ($ = 0.4 * P - B), c += '<polygon points="', c += `${_},${$} ${_ - P - 0.4 * B},${$ + B - 0.4 * P} `, c += `${_ - 0.7 * P},${$ + 0.7 * B} ${_ - P + 0.4 * B},${$ + B + 0.4 * P} `, c += `${_},${$}`, c += `" stroke='none' fill="${cr((S = this.strokeColor) != null ? S : "")}"`, c += "/>";
    }
    let d = 0;
    if (this.notation.phasorangle) {
      let A = nl(r), k = (i.height + i.depth + 2 * A + 2 * o).toString(), L = (i.height + i.depth) / 2;
      c += this.line(o.toString(), k, (o + L + i.width).toString(), k), c += this.line(o.toString(), k, (o + L).toString(), (o - A).toString()), s += A, d = L, i.left += s / 2 - o;
    }
    if (this.notation.longdiv) {
      let A = nl(r);
      s += A, c += this.line(o.toString(), o.toString(), (o + i.width).toString(), o.toString());
      let k = 0.3;
      d = k + A, i.left += k + A, i.setTop(o + A), c += '<path d="', c += `M ${o} ${o}  a${k} ${(i.depth + i.height + 2 * A) / 2}, 0, 1, 1, 0 ${i.depth + i.height + 2 * A} "`, c += ` stroke-width="${pc(r)}" stroke="${cr((x = this.strokeColor) != null ? x : "")}" fill="none"`, c += "/>";
    }
    if (a.width = i.width + 2 * o + d, a.height = i.height + 2 * o, a.depth = i.depth, a.setStyle("box-sizing", "border-box"), a.setStyle("left", `calc(-1 * ${n} - ${o}em)`), a.setStyle("height", `calc( ${i.height + i.depth + 2 * o}em + ${n})`), a.setStyle("top", "0em"), a.setStyle("width", `calc(${i.width + 2 * o}em + ${n})`), this.backgroundcolor && a.setStyle("background-color", this.backgroundcolor), this.notation.box && a.setStyle("border", "1px solid red"), this.notation.actuarial && (a.setStyle("border-top", this.borderStyle), a.setStyle("border-right", this.borderStyle)), this.notation.madruwb && (a.setStyle("border-bottom", this.borderStyle), a.setStyle("border-right", this.borderStyle)), this.notation.roundedbox && (a.setStyle("border-radius", "8px"), a.setStyle("border", this.borderStyle)), this.notation.circle && (a.setStyle("border-radius", "50%"), a.setStyle("border", this.borderStyle)), this.notation.top && a.setStyle("border-top", this.borderStyle), this.notation.left && a.setStyle("border-left", this.borderStyle), this.notation.right && a.setStyle("border-right", this.borderStyle), this.notation.bottom && a.setStyle("border-bottom", this.borderStyle), c) {
      let A = "";
      this.shadow === "auto" && (A += "filter: drop-shadow(0 0 .5px rgba(255, 255, 255, .7)) drop-shadow(1px 1px 2px #333)"), this.shadow !== "none" && (A += `filter: drop-shadow(${cr((w = this.shadow) != null ? w : "")})`), A += ` stroke-width="${cr((T = this.strokeWidth) != null ? T : "")}" stroke="${cr((b = this.strokeColor) != null ? b : "")}"`, A += ' stroke-linecap="round"', this.svgStrokeStyle && (A += ` stroke-dasharray="${cr(this.svgStrokeStyle)}"`), a.svgStyle = A, a.svgOverlay = c;
    }
    let f = new y([a, i]);
    return f.setStyle("position", "relative"), f.setStyle("height", `${Math.floor(100 * (a.depth + a.height)) / 100}em`), f.setStyle("display", "inline-block"), f.height = a.height, f.depth = a.depth, f.width = a.width - 2 * o, f.left = o, f.right = o, this.caret && (f.caret = this.caret), f.wrap(r);
  }
  line(e, r, i, n) {
    return `<line x1="${rn(e)}"  y1="${rn(r)}" x2="${rn(i)}" y2="${rn(n)}" vector-effect="non-scaling-stroke"></line>`;
  }
};
function rn(t33) {
  return typeof t33 == "number" ? `${Math.floor(100 * t33) / 100}%` : t33;
}
function dc(t33) {
  if (!t33) return "1px";
  let e = t33.match(/([0-9][a-zA-Z\%]+)/);
  return e === null ? "1px" : e[1];
}
function pc(t33) {
  return (Math.floor(100 * t33.metrics.sqrtRuleThickness / t33.scalingFactor) / 100 / 10).toString() + "em";
}
function nl(t33) {
  let e = t33.isDisplayStyle ? ve : t33.metrics.defaultRuleThickness;
  return t33.metrics.defaultRuleThickness + t33.scalingFactor * e / 4;
}
g("enclose", "{notation:string}[style:string]{body:auto}", { createAtom: (t33) => {
  var n, o;
  let e = t33.args, r = { strokeColor: "currentColor", strokeWidth: "", strokeStyle: "solid", backgroundcolor: "transparent", padding: "auto", shadow: "none", svgStrokeStyle: void 0, borderStyle: void 0, style: (n = t33.style) != null ? n : {} };
  if (e[1]) {
    let a = e[1].split(/,(?![^(]*\)(?:(?:[^(]*\)){2})*[^"]*$)/);
    for (let s of a) {
      let l = s.match(/\s*(\S+)\s+(\S+)\s+(.*)/);
      if (l) r.strokeWidth = l[1], r.strokeStyle = l[2], r.strokeColor = l[3];
      else {
        let c = s.match(/\s*([a-z]*)\s*=\s*"(.*)"/);
        c && (c[1] === "mathbackground" ? r.backgroundcolor = c[2] : c[1] === "mathcolor" ? r.strokeColor = c[2] : c[1] === "padding" ? r.padding = c[2] : c[1] === "shadow" && (r.shadow = c[2]));
      }
    }
    r.strokeStyle === "dashed" ? r.svgStrokeStyle = "5,5" : r.strokeStyle === "dotted" && (r.svgStrokeStyle = "1,5");
  }
  r.borderStyle = `${r.strokeWidth} ${r.strokeStyle} ${r.strokeColor}`;
  let i = {};
  return ((o = e[0]) != null ? o : "").split(/[, ]/).filter((a) => a.length > 0).forEach((a) => {
    i[a.toLowerCase()] = true;
  }), new it(t33.command, M(e[2]), i, r);
} });
g("cancel", "{body:auto}", { createAtom: (t33) => {
  var e;
  return new it(t33.command, M(t33.args[0]), { updiagonalstrike: true }, { strokeColor: "currentColor", strokeWidth: "", strokeStyle: "solid", borderStyle: "1px solid currentColor", backgroundcolor: "transparent", padding: "auto", shadow: "none", style: (e = t33.style) != null ? e : {} });
} });
g("bcancel", "{body:auto}", { createAtom: (t33) => {
  var e;
  return new it(t33.command, M(t33.args[0]), { downdiagonalstrike: true }, { strokeColor: "currentColor", strokeWidth: "", strokeStyle: "solid", borderStyle: "1px solid currentColor", backgroundcolor: "transparent", padding: "auto", shadow: "none", style: (e = t33.style) != null ? e : {} });
} });
g("xcancel", "{body:auto}", { createAtom: (t33) => {
  var e;
  return new it(t33.command, M(t33.args[0]), { updiagonalstrike: true, downdiagonalstrike: true }, { strokeColor: "currentColor", strokeWidth: "", strokeStyle: "solid", borderStyle: "1px solid currentColor", backgroundcolor: "transparent", padding: "auto", shadow: "none", style: (e = t33.style) != null ? e : {} });
} });
var me = class t8 extends p {
  constructor(e) {
    var r;
    super({ type: "placeholder", command: "\\placeholder", mode: (r = e == null ? void 0 : e.mode) != null ? r : "math", style: e == null ? void 0 : e.style }), this.captureSelection = true;
  }
  static fromJson(e) {
    return new t8(e);
  }
  toJson() {
    return super.toJson();
  }
  render(e) {
    let r;
    return this.value = e.placeholderSymbol, typeof e.renderPlaceholder == "function" ? r = e.renderPlaceholder(e) : r = this.createBox(e), this.caret && (r.classes += " ML__placeholder-selected"), r;
  }
  _serialize(e) {
    return e.skipPlaceholders ? "" : "\\placeholder{}";
  }
};
var fc = ["matrix", "matrix*", "pmatrix", "pmatrix*", "bmatrix", "bmatrix*", "Bmatrix", "Bmatrix*", "vmatrix", "vmatrix*", "Vmatrix", "Vmatrix*"];
function ol(t33) {
  return fc.includes(t33);
}
function gc(t33, e, r) {
  let i = 0;
  for (let c of r.columns) "align" in c && (i += 1);
  i = Math.max(i, r.minColumns);
  let n = 0, o = [];
  for (let c of e) {
    n = Math.max(n, Math.min(c.length, i));
    let h = 0;
    for (; h < c.length; ) {
      let d = [], f = Math.min(c.length, h + i);
      for (; h < f; ) d.push(xc(c[h], t33.mode)), h += 1;
      if (d.length < r.minColumns) for (; d.length < r.minColumns; ) d.push([new p({ type: "first", mode: t33.mode })]);
      o.push(d);
    }
  }
  !t33.isMultiline && o.length > 0 && o[o.length - 1].length === 1 && vc(o[o.length - 1][0]) && o.pop();
  let a = [];
  for (let c of o) {
    if (c.length !== n) for (let h = c.length; h < n; h++) t33.isMultiline ? c.push([new p({ type: "first", mode: t33.mode })]) : c.push([new p({ type: "first", mode: t33.mode }), new me()]);
    a.push(c);
  }
  let s = 0, l = 0;
  for (let c of a) {
    l = 0;
    for (let h of c) {
      for (let d of h) d.parent = t33, d.parentBranch = [s, l];
      l += 1;
    }
    s += 1;
  }
  return t33.isDirty = true, a;
}
function yc(t33) {
  return t33.length > 0 && t33.every((e) => e.type === "first");
}
function bc(t33, e, r) {
  let i = new y(null, { classes: "ML__empty-line-anchor" }), n = t33[0];
  n && (n.id || (n.id = e.makeID()), i.atomID = n.id), i.setStyle("display", "inline-block"), i.setStyle("width", 0), i.setStyle("position", "relative"), i.setStyle("height", Math.max(0, r.height + r.depth), "em"), i.setStyle("vertical-align", -r.depth, "em"), i.height = r.height, i.depth = r.depth;
  let o = t33.find((a) => a.caret);
  return o != null && o.caret && (i.caret = o.caret), t33.some((a) => a.isSelected) && i.selected(true), i;
}
function xc(t33, e) {
  return t33.length === 0 ? [new p({ type: "first", mode: e })] : t33[0].type !== "first" ? [new p({ type: "first", mode: e }), ...t33] : (t33.slice(1).some((r) => r.type === "first"), t33);
}
function vc(t33) {
  return t33.length === 1 && t33[0].type === "first";
}
var G = class t9 extends p {
  get isMultiline() {
    let e = this.environmentName;
    return ["lines", "multline", "multline*", "align", "split", "gather", "gathered"].includes(e);
  }
  constructor(e, r, i, n = {}) {
    var o, a, s, l;
    if (super({ type: "array", isRoot: n.isRoot }), this.environmentName = e, n.columns) n.columns.length === 0 ? this.colFormat = [{ align: "l" }] : this.colFormat = [...n.columns];
    else if (n.minColumns) {
      let c = [];
      for (let h = 0; h < n.minColumns; h++) c.push({ align: "l" });
      this.colFormat = c;
    } else this.colFormat = [{ align: "l" }, { align: "l" }, { align: "l" }, { align: "l" }, { align: "l" }, { align: "l" }, { align: "l" }, { align: "l" }, { align: "l" }, { align: "l" }];
    this.minColumns = (o = n.minColumns) != null ? o : 1, this.minRows = (a = n.minRows) != null ? a : 1, this.maxRows = (s = n.maxRows) != null ? s : 1 / 0, this._rows = gc(this, r, { columns: this.colFormat, minColumns: this.minColumns, minRows: this.minRows, maxRows: this.maxRows }), this.rowGaps = i, n.arraycolsep !== void 0 && (this.arraycolsep = n.arraycolsep), this.colSeparationType = n.colSeparationType, n.arraystretch !== void 0 && (this.arraystretch = n.arraystretch), n.mathstyleName && (this.mathstyleName = n.mathstyleName), n.leftDelim && (this.leftDelim = n.leftDelim), n.rightDelim && (this.rightDelim = n.rightDelim), this.classes = (l = n.classes) != null ? l : [];
  }
  static fromJson(e) {
    return new t9(e.environmentName, e.array, e.rowGaps, e);
  }
  toJson() {
    let e = u(m({}, super.toJson()), { environmentName: this.environmentName, array: this._rows.map((r) => r.map((i) => i.map((n) => n.toJson()))), rowGaps: this.rowGaps, columns: this.colFormat, colSeparationType: this.colSeparationType, minColumns: this.minColumns, minRows: this.minRows, maxRows: this.maxRows });
    return this.arraystretch !== void 0 && (e.arraystretch = this.arraystretch), this.arraycolsep !== void 0 && (e.arraycolsep = this.arraycolsep), this.leftDelim && (e.leftDelim = this.leftDelim), this.rightDelim && (e.rightDelim = this.rightDelim), this.isRoot && (e.isRoot = true), e.minColumns = this.minColumns, e.minRows = this.minRows, e.maxRows = this.maxRows, this.mathstyleName && (e.mathstyleName = this.mathstyleName), this.classes.length > 0 && (e.classes = this.classes), e;
  }
  branch(e) {
    var r;
    if (Jr(e)) return (r = this._rows[e[0]][e[1]]) != null ? r : void 0;
  }
  createBranch(e) {
    var r;
    return Jr(e) ? (this.isDirty = true, (r = this.branch(e)) != null ? r : []) : [];
  }
  get rowCount() {
    return this._rows.length;
  }
  get colCount() {
    return this._rows[0].length;
  }
  get maxColumns() {
    return this.colFormat.filter((e) => !!e.align).length;
  }
  removeBranch(e) {
    if (wt(e)) return super.removeBranch(e);
    let [r, ...i] = this.branch(e);
    return r.type, this._rows[e[0]][e[1]] = void 0, i.forEach((n) => {
      n.parent = void 0, n.parentBranch = void 0;
    }), this.isDirty = true, i;
  }
  get hasChildren() {
    return this.children.length > 0;
  }
  get children() {
    let e = [];
    for (let r of this._rows) for (let i of r) if (i) for (let n of i) e.push(...n.children), e.push(n);
    return [...e, ...super.children];
  }
  render(e) {
    var E, X, ee, te, Ct, ot;
    let r = new z({ parent: e, mathstyle: this.mathstyleName }, this.style), i = r.getRegisterAsEm("arrayrulewidth"), n = r.getRegisterAsEm("arraycolsep"), o = r.getRegisterAsEm("doublerulesep"), a = (X = (E = this.arraystretch) != null ? E : r.getRegisterAsNumber("arraystretch")) != null ? X : 1, s = typeof this.arraycolsep == "number" ? this.arraycolsep : n;
    this.colSeparationType === "small" && (s = 0.2778 * (new z({ parent: e, mathstyle: "scriptstyle" }).scalingFactor / e.scalingFactor));
    let l = a * k0, c = 0.7 * l, h = 0.3 * l, d = 0, f = [], S = 0, x = this._rows.length;
    for (let j = 0; j < x; ++j) {
      let ne = this._rows[j];
      S = Math.max(S, ne.length);
      let ae = new z({ parent: r, mathstyle: this.mathstyleName }, this.style), Se = c / ae.scalingFactor, qe = h / ae.scalingFactor, W = { cells: [], height: 0, depth: 0, pos: 0 };
      for (let Lt of ne) {
        let at = this.isMultiline && Lt && yc(Lt) ? bc(Lt, ae, { height: c / ae.scalingFactor, depth: h / ae.scalingFactor }) : (ee = p.createBox(ae, Lt, { type: "ignore" })) != null ? ee : new y(null, { type: "ignore" });
        qe = Math.max(qe, at.depth), Se = Math.max(Se, at.height), W.cells.push(at);
      }
      let oe = (te = en(this.rowGaps[j])) != null ? te : 0;
      oe > 0 && (oe += h, qe = Math.max(qe, oe), oe = 0), j < x - 1 && !ol(this.environmentName) && this.environmentName !== "cases" && this.environmentName !== "array" && (qe += r.getRegisterAsEm("jot")), W.height = Se, W.depth = qe, d += Se, W.pos = d, d += qe + oe, f.push(W);
    }
    let w = this.environmentName === "array" && !this.isMultiline ? f[0].height : d / 2 + de, T = [];
    for (let j = 0; j < S; j++) {
      let ne = [];
      for (let ae of f) {
        let Se = ae.cells[j];
        Se && (Se.depth = ae.depth, Se.height = ae.height, ne.push({ box: Se, shift: ae.pos - w }));
      }
      ne.length > 0 && T.push(new V({ individualShift: ne }));
    }
    let b = [], A = false, k = false, L = 0, P = !this.leftDelim, { colFormat: B } = this;
    for (let j of B) {
      if ("align" in j && L >= T.length) break;
      if ("align" in j) A ? b.push(on(2 * s)) : (k || P) && b.push(on(s)), b.push(new y(T[L], { classes: "col-align-" + j.align })), L++, A = true, k = false, P = false;
      else if ("gap" in j) {
        if (typeof j.gap == "number") b.push(on(j.gap));
        else {
          let ne = Sc(e, f, w, j.gap);
          ne && b.push(ne);
        }
        A = false, k = false, P = false;
      } else if ("separator" in j) {
        let ne = new y(null, { classes: "ML__vertical-separator" });
        ne.height = d, ne.setStyle("height", d, "em"), ne.setStyle("border-right", `${i}em ${j.separator} currentColor`), ne.setStyle("vertical-align", -(d - w), "em");
        let ae = 0;
        k ? ae = o - i : A && (ae = s - i), ne.left = ae, b.push(ne), A = false, k = true, P = false;
      }
    }
    A && !this.rightDelim && b.push(on(s));
    let _ = new y(b, { classes: ["ML__mtable", ...this.classes].join(" ") });
    if (this.environmentName === "array" && !this.isMultiline && (_.height = f[0].height, _.depth = d - f[0].height), (!this.leftDelim || this.leftDelim === ".") && (!this.rightDelim || this.rightDelim === ".")) return this.caret && (_.caret = this.caret), this.bind(e, _);
    let $ = _.height, O = _.depth, K = this.bind(e, new y([this.bind(e, Ot("open", (Ct = this.leftDelim) != null ? Ct : ".", $, O, r, { isSelected: this.isSelected })), _, this.bind(e, Ot("close", (ot = this.rightDelim) != null ? ot : ".", $, O, r, { isSelected: this.isSelected }))], { type: "ord" }));
    return K ? (K.setStyle("display", "inline-block"), this.caret && (K.caret = this.caret), this.bind(e, this.attachSupsub(e, { base: K }))) : null;
  }
  _serialize(e) {
    var i;
    let r = [];
    if (this.environmentName === "lines" && this._rows.length > 1 ? r.push("\\displaylines{") : this.environmentName !== "lines" && r.push(`\\begin{${this.environmentName}}`), this.environmentName === "array") {
      if (r.push("{"), this.colFormat !== void 0) for (let n of this.colFormat) "align" in n && typeof n.align == "string" ? r.push(n.align) : "separator" in n && n.separator === "solid" ? r.push("|") : "separator" in n && n.separator === "dashed" && r.push(":");
      r.push("}");
    }
    for (let n = 0; n < this._rows.length; n++) {
      for (let o = 0; o < this._rows[n].length; o++) o > 0 && r.push(" & "), r.push(p.serialize(this._rows[n][o], e));
      if (n < this._rows.length - 1) {
        let o = this.rowGaps[n];
        o != null && o.dimension ? r.push(`\\\\[${o.dimension} ${(i = o.unit) != null ? i : "pt"}] `) : r.push("\\\\ ");
      }
    }
    return this.environmentName === "lines" && this._rows.length > 1 ? r.push("}") : this.environmentName !== "lines" && r.push(`\\end{${this.environmentName}}`), D(r);
  }
  forEachCell(e) {
    for (let r = 0; r < this.rowCount; r++) for (let i = 0; i < this.colCount; i++) e(this._rows[r][i], r, i);
  }
  getCell(e, r) {
    var i;
    return (i = this._rows[e]) == null ? void 0 : i[r];
  }
  setCell(e, r, i) {
    this.type === "array" && Array.isArray(this._rows) && this._rows[e][r];
    for (let o of this._rows[e][r]) o.parent = void 0, o.parentBranch = void 0;
    let n = [new p({ type: "first", mode: this.mode }), ...i.filter((o) => o.type !== "first")];
    this._rows[e][r] = n, qt(this), this.isDirty = true;
  }
  addRowBefore(e) {
    this.type === "array" && Array.isArray(this._rows), this._rows.splice(e, 0, Array.from({ length: this.colCount }, () => nn(this, !this.isMultiline))), qt(this), this.isDirty = true;
  }
  addRowAfter(e) {
    this.type === "array" && Array.isArray(this._rows), this._rows.splice(e + 1, 0, Array.from({ length: this.colCount }, () => nn(this, !this.isMultiline))), qt(this), this.isDirty = true;
  }
  removeRow(e) {
    this.type === "array" && Array.isArray(this._rows) && this.rowCount > e;
    let r = this._rows.splice(e, 1);
    for (let i of r) for (let n of i) if (n) for (let o of n) o.parent = void 0, o.parentBranch = void 0;
    qt(this), this.isDirty = true;
  }
  addColumnBefore(e) {
    this.type === "array" && Array.isArray(this._rows);
    for (let r of this._rows) r.splice(e, 0, nn(this));
    qt(this), this.isDirty = true;
  }
  addColumnAfter(e) {
    this.type === "array" && Array.isArray(this._rows);
    for (let r of this._rows) r.splice(e + 1, 0, nn(this));
    qt(this), this.isDirty = true;
  }
  addColumn() {
    this.addColumnAfter(this.colCount - 1);
  }
  removeColumn(e) {
    this.type === "array" && Array.isArray(this._rows) && this.colCount > e;
    for (let r of this._rows) {
      let i = r.splice(e, 1);
      for (let n of i) if (n) for (let o of n) o.parent = void 0, o.parentBranch = void 0;
    }
    qt(this), this.isDirty = true;
  }
  get cells() {
    let e = [];
    for (let r of this._rows) for (let i of r) i && e.push(i.filter((n) => n.type !== "first"));
    return e;
  }
  get rows() {
    return this._rows;
  }
};
function nn(t33, e = false) {
  let r = new p({ type: "first", mode: t33.mode });
  r.parent = t33;
  let i = [r];
  if (e) {
    let n = new me();
    n.parent = t33, i.push(n);
  }
  return i;
}
function qt(t33) {
  for (let e = 0; e < t33.rowCount; e++) for (let r = 0; r < t33.colCount; r++) {
    let i = t33.getCell(e, r);
    if (i) for (let n of i) n && (n.parent = t33, n.parentBranch = [e, r]);
  }
}
function on(t33) {
  let e = new y(null, { classes: "ML__arraycolsep" });
  return e.width = t33, e;
}
function Sc(t33, e, r, i) {
  if (!i) return null;
  let n = [];
  for (let o of e) {
    let a = p.createBox(t33, i, { type: "ignore" });
    a && (a.depth = o.depth, a.height = o.height, n.push({ box: a, shift: o.pos - r }));
  }
  return new V({ individualShift: n }).wrap(t33);
}
Gi(["math", "displaymath"], Ee);
Gi("center", Ee);
We(["multline", "multline*"], "", Ee);
g("displaylines", "", { parse: (t33) => {
  if (t33.skipWhitespace(), !t33.match("<{>")) return [];
  let e = [], r = [];
  t33.mathlist.length > 0 && e.push([t33.mathlist]), t33.beginContext({ tabular: true, root: true });
  do {
    if (t33.end() || t33.match("<}>")) break;
    t33.matchColumnSeparator() || t33.matchRowSeparator() ? (e.push([r]), r = []) : r.push(...t33.scan((n) => ["<}>", "&", "\\cr", "\\\\", "\\tabularnewline"].includes(n)));
  } while (true);
  t33.endContext(), e.push([r]);
  let i = t33.scan();
  return i.length > 0 && e.push([i]), e;
}, createAtom: (t33) => new G("lines", t33.args, [], { leftDelim: ".", rightDelim: ".", columns: [{ align: "l" }], classes: ["ML__multiline_environment"], isRoot: true, minColumns: 1, maxColumns: 1, minRows: 1 }) });
We("split", "", Ee);
We(["gather", "gather*", "gathered"], "", Ee);
We(["equation", "equation*", "subequations"], "", Ee);
Gi(["align", "align*", "eqnarray"], Ee, { tabular: true });
We(["aligned"], "", Ee);
We("array", "{columns:colspec}", (t33, e, r, i) => new G(t33, e, r, { columns: i[0], mathstyleName: "textstyle" }));
We(["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "matrix*", "pmatrix*", "bmatrix*", "Bmatrix*", "vmatrix*", "Vmatrix*"], "[columns:colspec]", Ee);
We(["smallmatrix", "smallmatrix*"], "[columns:colspec]", Ee);
We(["cases", "dcases", "rcases"], "", Ee);
function Ee(t33, e = [[[]]], r = [], i = [], n) {
  switch (t33) {
    case "math":
      return new G(t33, e, r, { mathstyleName: "textstyle", isRoot: true, minColumns: 1, maxColumns: 1, minRows: 1, maxRows: 1 });
    case "displaymath":
      return new G(t33, e, r, { mathstyleName: "textstyle", isRoot: true, minColumns: 1, maxColumns: 1, minRows: 1, maxRows: 1 });
    case "center":
      return new G(t33, e, r, { columns: [{ align: "c" }], classes: ["ML__center_environment"], isRoot: true, minColumns: 1, maxColumns: 1, minRows: 1, maxRows: 1 });
    case "multline":
    case "multline*":
      return new G(t33, e, r, { columns: [{ align: "m" }], leftDelim: ".", rightDelim: ".", isRoot: true, minColumns: 1, maxColumns: 1, minRows: 1 });
    case "split":
      return new G(t33, e, r, { columns: [{ align: "r" }, { align: "l" }], minColumns: 2, minRows: 1, isRoot: false });
    case "gather":
    case "gather*":
      return new G(t33, e, r, { columns: [{ gap: 0.25 }, { align: "c" }, { gap: 0 }], minColumns: 1, maxColumns: 1, minRows: 1, isRoot: true, classes: ["ML__gather_environment"] });
    case "gathered":
      return new G(t33, e, r, { columns: [{ gap: 0.25 }, { align: "c" }, { gap: 0 }], minColumns: 1, maxColumns: 1, minRows: 1 });
    case "equation":
    case "equation*":
    case "subequations":
      return new G(t33, e, r, { columns: [{ align: "c" }], isRoot: true, minColumns: 1, maxColumns: 1, minRows: 1 });
    case "aligned": {
      let o = 0;
      for (let l of e) o = Math.max(o, l.length);
      let a = [{ gap: 0 }, { align: "r" }, { gap: 0.25 }, { align: "l" }], s = 2;
      for (; s < o; ) a.push({ gap: 1 }, { align: "r" }, { gap: 0.25 }, { align: "l" }), s += 2;
      return a.push({ gap: 0 }), new G(t33, e, r, { arraycolsep: 0, columns: a, minColumns: 2, minRows: 1, isRoot: t33 !== "aligned" });
    }
    case "eqnarray":
      return new G(t33, e, r, { arraycolsep: 0, columns: [{ gap: 0 }, { align: "r" }, { align: "c" }, { align: "l" }], minColumns: 3, maxColumns: 3, minRows: 1, isRoot: true, classes: ["ML__eqnarray_environment"] });
    case "align":
    case "align*":
      return new G(t33, e, r, { arraycolsep: 0, columns: [{ gap: 0 }, { align: "r" }, { gap: 0.25 }, { align: "l" }], minColumns: 2, maxColumns: 2, minRows: 1, isRoot: true, classes: ["ML__align_environment"] });
    case "pmatrix":
    case "pmatrix*":
      return new G(t33, e, r, { mathstyleName: "textstyle", leftDelim: "(", rightDelim: ")", columns: It(i[0], n) });
    case "bmatrix":
    case "bmatrix*":
      return new G(t33, e, r, { mathstyleName: "textstyle", leftDelim: "[", rightDelim: "]", columns: It(i[0], n) });
    case "Bmatrix":
    case "Bmatrix*":
      return new G(t33, e, r, { mathstyleName: "textstyle", leftDelim: "\\lbrace", rightDelim: "\\rbrace", columns: It(i[0], n) });
    case "vmatrix":
    case "vmatrix*":
      return new G(t33, e, r, { mathstyleName: "textstyle", leftDelim: "\\vert", rightDelim: "\\vert", columns: It(i[0], n) });
    case "Vmatrix":
    case "Vmatrix*":
      return new G(t33, e, r, { mathstyleName: "textstyle", leftDelim: "\\Vert", rightDelim: "\\Vert", columns: It(i[0], n) });
    case "matrix":
    case "matrix*":
      return new G(t33, e, r, { mathstyleName: "textstyle", leftDelim: ".", rightDelim: ".", columns: It(i == null ? void 0 : i[0], n) });
    case "smallmatrix":
    case "smallmatrix*":
      return new G(t33, e, r, { mathstyleName: "scriptstyle", columns: It(i == null ? void 0 : i[0], n), colSeparationType: "small", arraystretch: 0.5 });
    case "cases":
    case "dcases":
      return new G(t33, e, r, { mathstyleName: t33 === "dcases" ? "displaystyle" : "textstyle", arraystretch: 1.2, leftDelim: "\\lbrace", rightDelim: ".", columns: al() });
    case "rcases":
      return new G(t33, e, r, { arraystretch: 1.2, leftDelim: ".", rightDelim: "\\rbrace", columns: al() });
    case "lines":
      return new G(t33, e, r, { leftDelim: ".", rightDelim: ".", columns: [{ align: "l" }], isRoot: true, minColumns: 1, maxColumns: 1, minRows: 1 });
  }
  return new G(t33, e, r, { mathstyleName: "textstyle" });
}
function It(t33, e = 10) {
  return t33 != null ? t33 : Array(e).fill({ align: "c" });
}
function al(t33 = 10) {
  let e = [];
  for (let r = 0; r < t33; r++) r > 0 && e.push({ gap: 1 }), e.push({ align: "l" });
  return e;
}
g(["overrightarrow", "overleftarrow", "Overrightarrow", "overleftharpoon", "overrightharpoon", "overleftrightarrow", "overlinesegment", "overgroup"], "{:auto}", { createAtom: (t33) => {
  var e;
  return new se(u(m({}, t33), { body: M((e = t33.args) == null ? void 0 : e[0]), skipBoundary: false, supsubPlacement: "over-under", paddedBody: true, boxType: "rel", svgAbove: t33.command.slice(1) }));
} });
g("overbrace", "{:auto}", { createAtom: (t33) => new se(u(m({}, t33), { body: M(t33.args[0]), skipBoundary: false, supsubPlacement: "over-under", paddedBody: true, boxType: "ord", svgAbove: t33.command.slice(1) })) });
g(["underrightarrow", "underleftarrow", "underleftrightarrow", "underlinesegment", "undergroup"], "{:auto}", { createAtom: (t33) => new se(u(m({}, t33), { body: M(t33.args[0]), skipBoundary: false, supsubPlacement: "over-under", paddedBody: true, boxType: "rel", svgBelow: t33.command.slice(1) })) });
g(["underbrace"], "{:auto}", { createAtom: (t33) => new se(u(m({}, t33), { body: M(t33.args[0]), skipBoundary: false, supsubPlacement: "over-under", paddedBody: true, boxType: "ord", svgBelow: t33.command.slice(1) })) });
g(["xrightarrow", "longrightarrow", "xleftarrow", "longleftarrow", "xRightarrow", "xLeftarrow", "xleftharpoonup", "xleftharpoondown", "xrightharpoonup", "xrightharpoondown", "xlongequal", "xtwoheadleftarrow", "xtwoheadrightarrow", "xleftrightarrow", "longleftrightarrow", "xLeftrightarrow", "xrightleftharpoons", "longrightleftharpoons", "xleftrightharpoons", "xhookleftarrow", "xhookrightarrow", "xmapsto", "xtofrom", "xleftrightarrows", "longleftrightarrows", "xRightleftharpoons", "longRightleftharpoons", "xLeftrightharpoons", "longLeftrightharpoons"], "[:auto]{:auto}", { createAtom: (t33) => {
  var e, r, i, n, o;
  return new se(u(m({}, t33), { svgBody: t33.command.slice(1), above: ((r = M((e = t33.args) == null ? void 0 : e[1])) == null ? void 0 : r.length) === 0 ? void 0 : M((i = t33.args) == null ? void 0 : i[1]), below: (o = M((n = t33.args) == null ? void 0 : n[0])) != null ? o : null, skipBoundary: false, supsubPlacement: "over-under", paddedBody: true, paddedLabels: true, boxType: "rel" }));
}, serialize: (t33, e) => t33.command + (t33.hasEmptyBranch("below") ? "" : `[${t33.belowToLatex(e)}]`) + `{${t33.aboveToLatex(e)}}${t33.supsubToLatex(e)}` });
var Nt = class t10 extends p {
  constructor(e, r) {
    super(u(m({}, r), { type: "extensible-symbol", isFunction: r == null ? void 0 : r.isFunction })), this.value = e, this.variant = r == null ? void 0 : r.variant, this.subsupPlacement = r == null ? void 0 : r.limits;
  }
  static fromJson(e) {
    return new t10(e.symbol, e);
  }
  toJson() {
    let e = super.toJson();
    return this.variant && (e.variant = this.variant), this.subsupPlacement && (e.limits = this.subsupPlacement), this.value && (e.symbol = this.value), e;
  }
  render(e) {
    var s;
    let r = e.isDisplayStyle && this.value !== "\\smallint", i = new y(this.value === "\u222F" ? "\u222C" : this.value === "\u2230" ? "\u222D" : this.value, { fontFamily: r ? "Size2-Regular" : "Size1-Regular", classes: "ML__op-symbol " + (r ? "ML__large-op" : "ML__small-op"), type: "op", maxFontSize: e.scalingFactor, isSelected: this.isSelected });
    if (!i) return null;
    if (this.value === "\u222F" || this.value === "\u2230") {
      i.setStyle("position", "relative");
      const originalMarkup = i.toMarkup.bind(i);
      i.toMarkup = () => {
        const html = originalMarkup();
        const end = html.lastIndexOf("</span>");
        return html.slice(0, end) + '<span aria-hidden="true" style="position:absolute;left:0.08em;top:calc(50% + 0.025em);width:calc(100% + 0.32em);height:0.52em;transform:translateY(-50%);box-sizing:border-box;border:0.065em solid currentColor;border-radius:50%;pointer-events:none"></span>' + html.slice(end);
      };
    }
    i.right = i.italic;
    let n = (i.height - i.depth) / 2 - de * e.scalingFactor, o = i.italic;
    i.setTop(n);
    let a = i;
    if (this.superscript || this.subscript) {
      let l = (s = this.subsupPlacement) != null ? s : "auto";
      l === "auto" && e.isDisplayStyle && (l = "over-under"), a = l === "over-under" ? this.attachLimits(e, { base: i, baseShift: n, slant: o }) : this.attachSupsub(e, { base: i });
    }
    return new y(this.bind(e, a), { type: "op", caret: this.caret, isSelected: this.isSelected, classes: "ML__op-group" }).wrap(e);
  }
  _serialize(e) {
    if (!(e.expandMacro || e.skipStyles || e.skipPlaceholders) && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    if (r != null && r.serialize) return r.serialize(this, e);
    let i = [];
    return i.push(this.command), this.explicitSubsupPlacement && (this.subsupPlacement === "over-under" && i.push("\\limits"), this.subsupPlacement === "adjacent" && i.push("\\nolimits"), this.subsupPlacement === "auto" && i.push("\\displaylimits")), i.push(this.supsubToLatex(e)), D(i);
  }
};
var mr = class t11 extends p {
  constructor(e) {
    var r;
    super(u(m({}, e), { type: "surd", mode: (r = e.mode) != null ? r : "math", style: e.style, displayContainsHighlight: true, body: e.body })), this.above = e.index;
  }
  static fromJson(e) {
    return new t11(u(m({}, e), { index: e.above }));
  }
  _serialize(e) {
    if (!(e.expandMacro || e.skipStyles || e.skipPlaceholders) && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    if (r != null && r.serialize) return r.serialize(this, e);
    let i = this.command, n = this.bodyToLatex(e);
    return this.above && !this.hasEmptyBranch("above") ? F(`${i}[${this.aboveToLatex(e)}]`, n) : /^[0-9]$/.test(n) ? `${i}${n}` : F(i, n);
  }
  get children() {
    if (this._children) return this._children;
    let e = [];
    if (this.above) for (let r of this.above) e.push(...r.children), e.push(r);
    if (this.body) for (let r of this.body) e.push(...r.children), e.push(r);
    return this._children = e, e;
  }
  render(e) {
    var A;
    let r = new z({ parent: e, mathstyle: "cramp" }, this.style), i = (A = p.createBox(r, this.body, { type: "inner" })) != null ? A : new y(null), n = r.scalingFactor, o = r.metrics.defaultRuleThickness / n, a = e.isDisplayStyle ? ve : o, s = new y(null, { classes: "ML__sqrt-line", style: this.style });
    s.height = o, s.softWidth = i.width;
    let l = n * (o + a / 4), h = Math.max(n * 2 * a, i.height + i.depth) + l + o, d = new z({ parent: e }, this.style), f = this.bind(d, new y(lr("inner", "\\surd", h, false, d, { isSelected: this.isSelected }), { isSelected: this.isSelected, classes: "ML__sqrt-sign", style: this.style }));
    if (!f) return null;
    let S = f.height + f.depth - o;
    S > i.height + i.depth + l && (l = (l + S - (i.height + i.depth)) / 2), f.setTop(f.height - i.height - l);
    let x = this.bind(e, new V({ firstBaseline: [{ box: new y(i) }, l - 2 * o, { box: s }, o] })), w = p.createBox(new z({ parent: e, mathstyle: "scriptscriptstyle" }), this.above, { type: "ignore" });
    if (!w) {
      let k = new y([f, x], { classes: this.containsCaret ? "ML__contains-caret" : "", type: "inner" });
      return k.setStyle("display", "inline-block"), k.setStyle("height", k.height + k.depth, "em"), this.caret && (k.caret = this.caret), this.bind(e, k);
    }
    let T = new V({ shift: -0.6 * (Math.max(f.height, x.height) - Math.max(f.depth, x.depth)), children: [{ box: w }] }), b = new y([new y(T, { classes: "ML__sqrt-index", type: "ignore" }), f, x], { type: "inner", classes: this.containsCaret ? "ML__contains-caret" : "" });
    return b.height = f.height, b.depth = f.depth, this.caret && (b.caret = this.caret), this.bind(e, b);
  }
};
var Re = class t12 extends p {
  constructor(e, r, i) {
    var n, o, a;
    super(u(m({}, i), { type: "genfrac", displayContainsHighlight: true })), this.above = e, this.below = r, this.hasBarLine = (n = i == null ? void 0 : i.hasBarLine) != null ? n : true, this.continuousFraction = (o = i == null ? void 0 : i.continuousFraction) != null ? o : false, this.align = (a = i == null ? void 0 : i.align) != null ? a : "center", this.numerPrefix = i == null ? void 0 : i.numerPrefix, this.denomPrefix = i == null ? void 0 : i.denomPrefix, this.mathstyleName = i == null ? void 0 : i.mathstyleName, this.leftDelim = i == null ? void 0 : i.leftDelim, this.rightDelim = i == null ? void 0 : i.rightDelim;
  }
  static fromJson(e) {
    return new t12(e.above, e.below, e);
  }
  toJson() {
    let e = {};
    return this.continuousFraction && (e.continuousFraction = true), this.align !== "center" && (e.align = this.align), this.numerPrefix && (e.numerPrefix = this.numerPrefix), this.denomPrefix && (e.denomPrefix = this.denomPrefix), this.leftDelim && (e.leftDelim = this.leftDelim), this.rightDelim && (e.rightDelim = this.rightDelim), this.hasBarLine || (e.hasBarLine = false), this.mathstyleName && (e.mathstyleName = this.mathstyleName), m(m({}, super.toJson()), e);
  }
  get children() {
    if (this._children) return this._children;
    let e = [];
    if ($o.fractionNavigationOrder === "denominator-numerator") {
      for (let r of this.below) e.push(...r.children), e.push(r);
      for (let r of this.above) e.push(...r.children), e.push(r);
    } else {
      for (let r of this.above) e.push(...r.children), e.push(r);
      for (let r of this.below) e.push(...r.children), e.push(r);
    }
    return this._children = e, e;
  }
  render(e) {
    var P, B;
    let r = new z({ parent: e, mathstyle: this.mathstyleName }, this.style), i = r.metrics, n = new z({ parent: r, mathstyle: this.continuousFraction ? "" : "numerator" }, this.style), o = this.numerPrefix ? new y([new y(this.numerPrefix), p.createBox(n, this.above)], { isTight: n.isTight, type: "ignore" }) : (P = p.createBox(n, this.above, { type: "ignore" })) != null ? P : new y(null, { type: "ignore" }), a = new z({ parent: r, mathstyle: this.continuousFraction ? "" : "denominator" }, this.style), s = this.denomPrefix ? new y([new y(this.denomPrefix), p.createBox(a, this.below, { type: "ignore" })]) : (B = p.createBox(a, this.below, { type: "ignore" })) != null ? B : new y(null, { type: "ignore" }), l = this.hasBarLine ? i.defaultRuleThickness : 0, c, h = 0, d;
    r.isDisplayStyle ? (c = n.metrics.num1, h = l > 0 ? 3 * l : 7 * l, d = a.metrics.denom1) : (l > 0 ? (c = n.metrics.num2, h = l) : (c = n.metrics.num3, h = 3 * i.defaultRuleThickness), d = a.metrics.denom2);
    let f = [];
    this.isSelected && f.push("ML__selected");
    let S = o.depth, x = s.height, w;
    if (l <= 0) {
      let _ = c - S - (x - d);
      _ < h && (c += (h - _) / 2, d += (h - _) / 2), w = new V({ individualShift: [{ box: o, shift: -c, classes: [...f, an(this.align)] }, { box: s, shift: d, classes: [...f, an(this.align)] }] }).wrap(r);
    } else {
      let _ = new y(null, { classes: "ML__frac-line", mode: this.mode, style: this.style });
      _.softWidth = Math.max(o.width, s.width), _.height = l / 2, _.depth = l / 2;
      let $ = de + l / 2;
      c < h + S + $ && (c = h + S + $);
      let O = de - l / 2;
      d < h + x - O && (d = h + x - O), w = new V({ individualShift: [{ box: s, shift: d, classes: [...f, an(this.align)] }, { box: _, shift: -O, classes: f }, { box: o, shift: -c, classes: [...f, an(this.align)] }] }).wrap(r);
    }
    let T = r.isDisplayStyle ? i.delim1 : i.delim2, b = this.leftDelim ? this.bind(e, lr("open", this.leftDelim, T, true, e, { style: this.style, mode: this.mode, isSelected: this.isSelected })) : rt(r, "ML__open"), A = null;
    this.continuousFraction ? A = new y(null, { type: "close" }) : this.rightDelim ? A = this.bind(e, lr("close", this.rightDelim, T, true, e, { style: this.style, mode: this.mode, isSelected: this.isSelected })) : A = rt(r, "ML__close");
    let k = new y([b, w, A], { isTight: r.isTight, type: "inner", classes: "ML__mfrac" }), L = this.bind(e, k);
    return this.caret && (L.caret = this.caret), this.attachSupsub(e, { base: L });
  }
};
function an(t33) {
  var e;
  return (e = { left: "ML__left", right: "ML__right", center: "ML__center" }[t33]) != null ? e : "ML__center";
}
var ur = class t13 extends p {
  constructor(e) {
    super(u(m({}, e), { type: "delim" })), this.value = e.delim, this.size = e.size;
  }
  static fromJson(e) {
    return new t13(e);
  }
  toJson() {
    return u(m({}, super.toJson()), { delim: this.value, size: this.size });
  }
  render(e) {
    return new y(this.value, { type: "middle" });
  }
  _serialize(e) {
    if (!(e.expandMacro || e.skipStyles || e.skipPlaceholders) && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    return r != null && r.serialize ? r.serialize(this, e) : F(this.command, this.value);
  }
};
var hr = class t14 extends p {
  constructor(e) {
    super(u(m({}, e), { type: "sizeddelim", value: e.delim })), this.delimType = e.delimType, this.size = e.size;
  }
  static fromJson(e) {
    return new t14(e);
  }
  toJson() {
    return u(m({}, super.toJson()), { delim: this.value, size: this.size, delimType: this.delimType });
  }
  render(e) {
    let r = rl(this.value, this.size, e, { classes: { open: "ML__open", close: "ML__close" }[this.delimType], type: this.delimType, isSelected: this.isSelected });
    return r ? (r = this.bind(e, r), this.caret && (r.caret = this.caret), r) : null;
  }
  _serialize(e) {
    if (!(e.expandMacro || e.skipStyles || e.skipPlaceholders) && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    return r != null && r.serialize ? r.serialize(this, e) : F(this.command, this.value);
  }
};
var Fe = class t15 extends p {
  constructor(e, r) {
    super(u(m({}, r), { type: "operator", isFunction: r == null ? void 0 : r.isFunction })), this.value = e, this.variant = r == null ? void 0 : r.variant, this.variantStyle = r == null ? void 0 : r.variantStyle, this.subsupPlacement = r == null ? void 0 : r.limits;
  }
  static fromJson(e) {
    return new t15(e.symbol, e);
  }
  toJson() {
    let e = super.toJson();
    return this.variant && (e.variant = this.variant), this.variantStyle && (e.variantStyle = this.variantStyle), this.subsupPlacement && (e.limits = this.subsupPlacement), this.value && (e.symbol = this.value), e;
  }
  render(e) {
    var n;
    let r = new y(this.value, { type: "op", mode: "math", maxFontSize: e.scalingFactor, style: { variant: this.variant, variantStyle: this.variantStyle }, isSelected: this.isSelected, letterShapeStyle: e.letterShapeStyle }), i = r;
    if (this.superscript || this.subscript) {
      let o = (n = this.subsupPlacement) != null ? n : "auto";
      i = o === "over-under" || o === "auto" && e.isDisplayStyle ? this.attachLimits(e, { base: r }) : this.attachSupsub(e, { base: r });
    }
    return new y(this.bind(e, i), { type: "op", caret: this.caret, isSelected: this.isSelected, classes: "ML__op-group" }).wrap(e);
  }
  _serialize(e) {
    if (!(e.expandMacro || e.skipStyles || e.skipPlaceholders) && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    if (r != null && r.serialize) return r.serialize(this, e);
    let i = [this.command];
    return this.explicitSubsupPlacement && (this.subsupPlacement === "over-under" && i.push("\\limits"), this.subsupPlacement === "adjacent" && i.push("\\nolimits"), this.subsupPlacement === "auto" && i.push("\\displaylimits")), i.push(this.supsubToLatex(e)), D(i);
  }
};
g(["arccos", "arcsin", "arctan", "arctg", "arcctg", "arg", "ch", "cos", "cosh", "cot", "cotg", "coth", "ctg", "cth", "csc", "cosec", "deg", "dim", "exp", "gcd", "hom", "inf", "ker", "lb", "lg", "ln", "log", "Pr", "sec", "sh", "sin", "sinh", "sup", "tan", "tanh", "tg", "th", "arcsec", "arccsc", "arsinh", "arcosh", "artanh", "arcsech", "arccsch"], "", { isFunction: true, ifMode: "math", createAtom: (t33) => new Fe(t33.command.slice(1), u(m({}, t33), { limits: "adjacent", isFunction: true, variant: "main", variantStyle: "up" })) });
g(["liminf", "limsup"], "", { ifMode: "math", createAtom: (t33) => new Fe({ "\\liminf": "lim inf", "\\limsup": "lim sup" }[t33.command], u(m({}, t33), { limits: "over-under", variant: "main" })) });
g(["lim", "mod"], "", { ifMode: "math", createAtom: (t33) => new Fe(t33.command.slice(1), u(m({}, t33), { limits: "over-under", variant: "main" })) });
g(["det", "max", "min"], "", { ifMode: "math", isFunction: true, createAtom: (t33) => new Fe(t33.command.slice(1), u(m({}, t33), { limits: "over-under", isFunction: true, variant: "main" })) });
g("ang", "{:math}", { ifMode: "math", createAtom: (t33) => new p(u(m({}, t33), { body: M(t33.args[0]) })), serialize: (t33, e) => `\\ang{${t33.bodyToLatex(e)}}`, render: (t33, e) => {
  let r = t33.createBox(e), i = r.caret;
  r.caret = void 0;
  let n = new y("\xB0", { style: u(m({}, t33.style), { variant: "normal", variantStyle: "up" }) });
  return new y([r, n], { type: "inner", isSelected: t33.isSelected, caret: i });
} });
g("sqrt", "[index:auto]{radicand:expression}", { ifMode: "math", createAtom: (t33) => new mr(u(m({}, t33), { body: M(t33.args[1]), index: t33.args[0] ? M(t33.args[0]) : void 0 })) });
g(["frac", "dfrac", "tfrac", "binom", "dbinom", "tbinom"], "{:expression}{:expression}", { ifMode: "math", createAtom: (t33) => {
  let e = m({}, t33), r = t33.command, i = t33.args;
  switch (r) {
    case "\\dfrac":
    case "\\frac":
    case "\\tfrac":
      e.hasBarLine = true;
      break;
    case "\\atopfrac":
      e.hasBarLine = false;
      break;
    case "\\dbinom":
    case "\\binom":
    case "\\tbinom":
      e.hasBarLine = false, e.leftDelim = "(", e.rightDelim = ")";
      break;
    case "\\cfrac":
      e.hasBarLine = true, e.continuousFraction = true;
      break;
    default:
  }
  switch (r) {
    case "\\dfrac":
    case "\\dbinom":
      e.mathstyleName = "displaystyle";
      break;
    case "\\tfrac":
    case "\\tbinom":
      e.mathstyleName = "textstyle";
      break;
    default:
  }
  return new Re(i[0] ? M(i[0]) : [new me()], i[1] ? M(i[1]) : [new me()], e);
}, serialize: (t33, e) => {
  let r = t33.aboveToLatex(e), i = t33.belowToLatex(e);
  return /^[0-9]$/.test(r) && /^[0-9]$/.test(i) ? `${t33.command}${r}${i}` : F(t33.command, r, i);
} });
g(["cfrac"], "[:string]{:expression}{:expression}", { ifMode: "math", createAtom: (t33) => {
  let e = m({}, t33), r = t33.args;
  return e.hasBarLine = true, e.continuousFraction = true, r[0] === "r" && (e.align = "right"), r[0] === "l" && (e.align = "left"), new Re(r[1] ? M(r[1]) : [new me()], r[2] ? M(r[2]) : [new me()], e);
}, serialize: (t33, e) => {
  let r = t33.aboveToLatex(e), i = t33.belowToLatex(e);
  return F(t33.command, r, i);
} });
g(["brace", "brack"], "", { infix: true, createAtom: (t33) => new Re(M(t33.args[0]), M(t33.args[1]), u(m({}, t33), { hasBarLine: false, leftDelim: t33.command === "\\brace" ? "\\lbrace" : "\\lbrack", rightDelim: t33.command === "\\brace" ? "\\rbrace" : "\\rbrack" })), serialize: (t33, e) => D([t33.aboveToLatex(e), t33.command, t33.belowToLatex(e)]) });
g(["over", "atop", "choose"], "", { infix: true, createAtom: (t33) => {
  let e, r, i = t33.args;
  return t33.command === "\\choose" && (e = "(", r = ")"), new Re(M(i[0]), M(i[1]), u(m({}, t33), { hasBarLine: t33.command === "\\over", leftDelim: e, rightDelim: r }));
}, serialize: (t33, e) => D([t33.aboveToLatex(e), t33.command, t33.belowToLatex(e)]) });
g(["overwithdelims", "atopwithdelims"], "{numer:auto}{denom:auto}{left-delim:delim}{right-delim:delim}", { infix: true, createAtom: (t33) => {
  var r, i;
  let e = t33.args;
  return new Re(M(e[0]), M(e[1]), u(m({}, t33), { leftDelim: (r = e[2]) != null ? r : ".", rightDelim: (i = e[3]) != null ? i : ".", hasBarLine: false }));
}, serialize: (t33, e) => `${t33.aboveToLatex(e)} ${t33.command}${t33.leftDelim}${t33.rightDelim}${t33.belowToLatex(e)}` });
g("pdiff", "{numerator}{denominator}", { ifMode: "math", createAtom: (t33) => new Re(M(t33.args[0]), M(t33.args[1]), u(m({}, t33), { hasBarLine: true, numerPrefix: "\u2202", denomPrefix: "\u2202" })), serialize: (t33, e) => D([t33.aboveToLatex(e), t33.command, t33.belowToLatex(e)]) });
g(["sum", "prod", "bigcup", "bigcap", "coprod", "bigvee", "bigwedge", "biguplus", "bigotimes", "bigoplus", "bigodot", "bigsqcup", "intop"], "", { ifMode: "math", createAtom: (t33) => new Nt({ coprod: "\u2210", bigvee: "\u22C1", bigwedge: "\u22C0", biguplus: "\u2A04", bigcap: "\u22C2", bigcup: "\u22C3", intop: "\u222B", prod: "\u220F", sum: "\u2211", bigotimes: "\u2A02", bigoplus: "\u2A01", bigodot: "\u2A00", bigsqcup: "\u2A06", smallint: "\u222B" }[t33.command.slice(1)], u(m({}, t33), { limits: "auto", variant: "main" })) });
g("smallint", "", { ifMode: "math", createAtom: (t33) => new Fe("\u222B", u(m({}, t33), { limits: "adjacent", variant: "main" })) });
var sl = { int: "\u222B", iint: "\u222C", iiint: "\u222D", oint: "\u222E", oiint: "\u222F", oiiint: "\u2230", intclockwise: "\u2231", varointclockwise: "\u2232", ointctrclockwise: "\u2233", intctrclockwise: "\u2A11", sqcup: "\u2294", sqcap: "\u2293", uplus: "\u228E", wr: "\u2240", amalg: "\u2A3F", Cap: "\u22D2", Cup: "\u22D3", doublecap: "\u22D2", doublecup: "\u22D3" };
g(Object.keys(sl), "", { ifMode: "math", createAtom: (t33) => {
  let e = t33.command, r = sl[e.slice(1)];
  return new Nt(r, u(m({}, t33), { limits: "adjacent", variant: { "\u22D2": "ams", "\u22D3": "ams" }[r] }));
} });
g(["Re", "Im"], "", { ifMode: "math", createAtom: (t33) => new Fe({ "\\Re": "\u211C", "\\Im": "\u2111" }[t33.command], u(m({}, t33), { limits: "adjacent", isFunction: true, variant: "fraktur" })) });
g("middle", "{:delim}", { ifMode: "math", createAtom: (t33) => {
  var e;
  return new ur(u(m({}, t33), { delim: (e = t33.args[0]) != null ? e : "|", size: 1 }));
} });
g("the", "{:value}", { createAtom: (t33) => new p(u(m({}, t33), { captureSelection: true, verbatimLatex: null })), render: (t33, e) => {
  var o;
  let r = new z({ parent: e }, t33.style), i = "";
  t33.isSelected && (i += " ML__selected");
  let n = r.evaluate(t33.args[0]);
  return new y(((o = Q(n)) != null ? o : "").split("").map((a) => new y(a, { type: "ord", classes: i, mode: t33.mode, isSelected: t33.isSelected, style: m({ variant: "main" }, t33.style) })), { type: "lift", style: t33.style, caret: t33.caret, isSelected: t33.isSelected, classes: i }).wrap(r);
}, serialize: (t33) => {
  var e;
  return `\\the${(e = Q(t33.args[0])) != null ? e : "\\relax"}`;
} });
var Pe = class t16 extends p {
  constructor(e) {
    super({ type: "error", value: e, command: e, mode: "math" }), this.verbatimLatex = e;
  }
  static fromJson(e) {
    return new t16(e.command);
  }
  toJson() {
    return super.toJson();
  }
  render(e) {
    let r = this.createBox(e, { classes: "ML__error" });
    return this.caret && (r.caret = this.caret), r;
  }
};
var dr = class t17 extends p {
  constructor(e, r) {
    super({ type: "group", mode: r }), this.body = e, this.boxType = e.length > 1 ? "ord" : "ignore", this.skipBoundary = true, this.displayContainsHighlight = false, (e == null ? void 0 : e.length) === 1 && e[0].command === "," && (this.captureSelection = true);
  }
  static fromJson(e) {
    return new t17(e.body, e.mode);
  }
  render(e) {
    let r = p.createBox(e, this.body, { type: this.boxType });
    return r ? (this.caret && (r.caret = this.caret), this.bind(e, r)) : null;
  }
  _serialize(e) {
    if (!(e.expandMacro || e.skipStyles || e.skipPlaceholders) && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    return r != null && r.serialize ? r.serialize(this, e) : `{${this.bodyToLatex(e)}}`;
  }
};
var Vt = class t18 extends p {
  constructor(e, r, i) {
    super({ type: "leftright", style: i.style, displayContainsHighlight: true }), this.variant = e, this.body = r, this.leftDelim = i.leftDelim, this.rightDelim = i.rightDelim;
  }
  static fromJson(e) {
    var r;
    return new t18((r = e.variant) != null ? r : "", e.body, e);
  }
  toJson() {
    let e = super.toJson();
    return this.variant && (e.variant = this.variant), this.leftDelim && (e.leftDelim = this.leftDelim), this.rightDelim && (e.rightDelim = this.rightDelim), e;
  }
  _serialize(e) {
    var i, n;
    let r = this.matchingRightDelim();
    return this.variant === "left...right" ? D(["\\left", (i = this.leftDelim) != null ? i : ".", this.bodyToLatex(e), "\\right", r]) : this.variant === "mleft...mright" ? D(["\\mleft", (n = this.leftDelim) != null ? n : ".", this.bodyToLatex(e), "\\mright", r]) : D([!this.leftDelim || this.leftDelim === "." ? "" : this.leftDelim, this.bodyToLatex(e), r]);
  }
  matchingRightDelim() {
    var r, i;
    if (this.rightDelim && this.rightDelim !== "?") return this.rightDelim;
    let e = (r = this.leftDelim) != null ? r : ".";
    return (i = So[e]) != null ? i : e;
  }
  render(e) {
    var d, f;
    let r = new z({ parent: e }, this.style);
    this.body;
    let i = new z({ parent: e, mathstyle: "textstyle" }, this.style), n = (d = p.createBox(r, this.body, { type: "inner" })) != null ? d : new y(null, { type: "inner" }), o = n.height / i.scalingFactor, a = n.depth / i.scalingFactor, s = [];
    if (this.leftDelim && s.push(this.bind(i, Ot("open", this.leftDelim, o, a, i, { isSelected: this.isSelected, classes: "ML__open" + (this.containsCaret ? " ML__contains-caret" : ""), mode: this.mode, style: this.style }))), n && (ll(n.children, this, r, o, a), s.push(n)), this.rightDelim) {
      let S = this.containsCaret ? " ML__contains-caret" : "", x = this.rightDelim;
      x === "?" && (r.smartFence ? (x = this.matchingRightDelim(), S += " ML__smart-fence__close") : x = "."), s.push(this.bind(i, Ot("close", x, o, a, i, { isSelected: this.isSelected, classes: S + " ML__close", mode: this.mode, style: this.style })));
    }
    let l = this.variant === "mleft...mright", c = this.leftSibling;
    c && (!l && c.isFunction && (l = true), !l && c.type === "subsup" && ((f = c.leftSibling) != null && f.isFunction) && (l = true));
    let h = new y(s, { type: l ? "close" : "inner", classes: "ML__left-right" });
    return h.setStyle("margin-top", `${-n.depth}em`), h.setStyle("height", `${n.height + n.depth}em`), this.caret && (h.caret = this.caret), this.bind(r, h.wrap(r));
  }
};
function ll(t33, e, r, i, n) {
  if (t33) for (let o = 0; o < t33.length; o++) {
    let a = t33[o];
    a.type === "middle" ? (t33[o] = e.bind(r, Ot("inner", a.value, i, n, r, { isSelected: e.isSelected })), t33[o].caret = a.caret, t33[o].isSelected = a.isSelected, t33[o].cssId = a.cssId, t33[o].htmlData = a.htmlData, t33[o].htmlStyle = a.htmlStyle, t33[o].attributes = a.attributes, t33[o].cssProperties = a.cssProperties) : a.children && ll(a.children, e, r, i, n);
  }
}
var pr = class t19 extends p {
  constructor(e, r) {
    var i;
    super({ type: "macro", command: e, style: r.style }), this.body = r.body, r.captureSelection === void 0 ? r.args ? this.captureSelection = false : this.captureSelection = true : this.captureSelection = r.captureSelection, this.macroArgs = r.args, this.expand = (i = r.expand) != null ? i : false;
  }
  static fromJson(e) {
    return new t19(e.command, e);
  }
  toJson() {
    let e = super.toJson();
    return this.expand && (e.expand = true), this.captureSelection !== void 0 && (e.captureSelection = this.captureSelection), this.macroArgs && (e.args = this.macroArgs), e;
  }
  _serialize(e) {
    var r;
    return e.expandMacro && this.expand ? this.bodyToLatex(e) : this.command + ((r = this.macroArgs) != null ? r : "");
  }
  applyStyle(e, r) {
    let i = {};
    e.color && (i.color = e.color), e.backgroundColor && (i.backgroundColor = e.backgroundColor), super.applyStyle(i, r);
  }
  render(e) {
    let r = p.createBox(e, this.body, { type: "lift" });
    return r ? (this.caret && (r.caret = this.caret), this.bind(e, r)) : null;
  }
};
var sn = class t20 extends p {
  constructor() {
    super({ type: "macro-argument" });
  }
  static fromJson(e) {
    return new t20();
  }
  toJson() {
    return super.toJson();
  }
  _serialize(e) {
    return "";
  }
  render(e) {
    return null;
  }
};
var fr = class t21 extends p {
  constructor(e, r, i = false, n, o) {
    var a;
    super({ type: "prompt", mode: (a = o == null ? void 0 : o.mode) != null ? a : "math", style: o == null ? void 0 : o.style, command: "\\placeholder" }), this.body = n, this.correctness = r, this.placeholderId = e, this.locked = i, this.captureSelection = this.locked;
  }
  static fromJson(e) {
    return new t21(e.placeholderId, e.correctness, e.locked, e.body, e);
  }
  toJson() {
    let e = super.toJson();
    return this.placeholderId && (e.placeholderId = this.placeholderId), this.body || delete e.body, this.body && (e.body = this.body.filter((r) => r.type !== "first").map((r) => r.toJson())), this.correctness && (e.correctness = this.correctness), e.locked = this.locked, e;
  }
  render(e) {
    var B, _, $, O, K;
    let r = new z({ parent: e }), i = r.getRegisterAsEm("fboxsep"), n = i, o = i, a = p.createBox(e, this.body);
    if (!a) return null;
    let l = !this.body || this.body.length === 0 || this.body.every((E) => E.type === "first") ? new me({ mode: this.mode, style: this.style }).render(new z({ parent: e, isPhantom: true })) : null, c = (B = l == null ? void 0 : l.height) != null ? B : r.metrics.xHeight, h = (_ = l == null ? void 0 : l.depth) != null ? _ : c / 2, d = Math.max(($ = a.height) != null ? $ : 0, c), f = Math.max((O = a.depth) != null ? O : 0, h);
    a.setStyle("vertical-align", `calc(-${d}em + 2px)`), this.correctness === "correct" ? a.setStyle("color", "var(--correct-color, var(--ML__correct-color))") : this.correctness === "incorrect" && a.setStyle("color", "var(--incorrect-color, var(--ML__incorrect-color))");
    let x = d + f + 2 * o - 2 * n, w = new y(a, { type: "ord" });
    w.setStyle("display", "inline-block"), w.height = d, w.depth = f, w.setStyle("height", d + f, "em"), w.setStyle("vertical-align", -o, "em"), ((K = a.width) != null ? K : 0) < x && (w.width = x, w.setStyle("width", x, "em"));
    let T = "ML__prompt ";
    this.locked ? T += " ML__lockedPromptBox " : T += " ML__editablePromptBox ", this.correctness === "correct" ? T += " ML__correctPromptBox " : this.correctness === "incorrect" && (T += " ML__incorrectPromptBox "), this.containsCaret && (T += " ML__focusedPromptBox ");
    let b = new y(null, { classes: T, attributes: { part: "prompt" } });
    b.height = w.height + o, b.depth = w.depth + o, b.width = w.width + 2 * n, b.setStyle("position", "absolute"), b.setStyle("height", w.height + w.depth + 2 * o, "em"), n === 0 && b.setStyle("width", "100%"), n !== 0 && (b.setStyle("width", `calc(100% + ${2 * n}em)`), b.setStyle("top", i, "em"), b.setStyle("left", -n, "em"));
    let A = "";
    this.correctness === "incorrect" && (A += '<line x1="3%"  y1="97%" x2="97%" y2="3%" stroke-width="0.5" stroke="var(--incorrect-color, var(--ML__incorrect-color))" stroke-linecap="round" />'), A && (b.svgOverlay = A);
    let k = new y([b, w], { classes: "ML__prompt-atom" });
    w.setStyle("line-height", 1), k.setStyle("position", "relative"), k.setStyle("display", "inline-block"), k.setStyle("line-height", 0), k.height = d + o + 0.2, k.depth = f + o, k.left = n, k.right = n, k.setStyle("height", d + 2 * o, "em"), k.setStyle("top", f - d - o / 2, "em"), k.setStyle("vertical-align", w.depth, "em"), k.setStyle("margin-left", 0.5, "em"), k.setStyle("margin-right", 0.5, "em"), this.caret && (k.caret = this.caret);
    let L = this.attachSupsub(e, { base: k }), P = this.bind(r, L);
    return P && this.id && (b.atomID = this.id, w.atomID = this.id, k.atomID = this.id), P;
  }
  _serialize(e) {
    var n;
    let r = (n = this.bodyToLatex(e)) != null ? n : "";
    if (e.skipPlaceholders) return r;
    let i = "\\placeholder";
    return this.placeholderId && (i += `[${this.placeholderId}]`), this.correctness === "correct" ? i += "[correct]" : this.correctness === "incorrect" && (i += "[incorrect]"), this.locked && (i += "[locked]"), F(i, r);
  }
};
var gr = class t22 extends p {
  constructor(e) {
    super({ type: "subsup", style: e == null ? void 0 : e.style }), this.subsupPlacement = "auto";
  }
  get children() {
    if (!this._children) {
      let e = [], r = this.branch("subscript");
      if (r) for (let n of r) e.push(...n.children), e.push(n);
      let i = this.branch("superscript");
      if (i) for (let n of i) e.push(...n.children), e.push(n);
      this._children = e;
    }
    return this._children;
  }
  static fromJson(e) {
    let r = new t22(e);
    for (let i of Mt) e[i] && r.setChildren(e[i], i);
    return r;
  }
  render(e) {
    var a;
    let r = new z({ parent: e, isPhantom: true }), i = this.leftSibling, n = (a = i.render(r)) != null ? a : new y(null), o = new y(null);
    return o.height = n.height, o.depth = n.depth, this.attachSupsub(e, { base: o, isCharacterBox: i.isCharacterBox(), type: "ignore" });
  }
  _serialize(e) {
    return this.supsubToLatex(e);
  }
};
var kt = class t23 extends p {
  constructor(e, r, i) {
    super({ type: "text", command: e, mode: "text", displayContainsHighlight: true }), this.value = r, this.verbatimLatex = r, this.applyStyle(i);
  }
  static fromJson(e) {
    return new t23(e.command, e.value, e.style);
  }
  render(e) {
    let r = this.createBox(e);
    return this.caret && (r.caret = this.caret), r;
  }
  _serialize(e) {
    var r;
    return (r = this.verbatimLatex) != null ? r : po("text", this.value.codePointAt(0));
  }
};
function yr(t33) {
  return t33 ? !/^(<$$>|<$>|<space>|<{>|<}>|#[0-9\?]|\\.+)$/.test(t33) : false;
}
var ln = class {
  constructor(e, r, i) {
    this.errors = [];
    this.index = 0;
    this.endCount = 0;
    var n, o, a, s;
    i != null || (i = {}), this.tokens = e, this.context = r instanceof z && !(i != null && i.parseMode) && !i.mathstyle ? r : new z({ from: r, mathstyle: i.mathstyle }, i.style), this.args = (n = i.args) != null ? n : void 0, this.smartFence = this.context.smartFence, this.parsingContext = { parent: void 0, mathlist: [], style: (o = i.style) != null ? o : {}, parseMode: (a = i.parseMode) != null ? a : "math", mathstyle: (s = i.mathstyle) != null ? s : "displaystyle", tabular: false };
  }
  beginContext(e) {
    var n, o, a, s, l, c;
    if (e != null && e.root) {
      this.parsingContext = { parent: this.parsingContext.parent, mathlist: [], style: {}, parseMode: (n = e == null ? void 0 : e.mode) != null ? n : "math", mathstyle: (o = e == null ? void 0 : e.mathstyle) != null ? o : "displaystyle", tabular: (a = e == null ? void 0 : e.tabular) != null ? a : false };
      return;
    }
    let r = this.parsingContext, i = { parent: r, mathlist: [], style: m({}, r.style), parseMode: (s = e == null ? void 0 : e.mode) != null ? s : r.parseMode, mathstyle: (l = e == null ? void 0 : e.mathstyle) != null ? l : r.mathstyle, tabular: (c = e == null ? void 0 : e.tabular) != null ? c : false };
    this.parsingContext = i;
  }
  endContext() {
    this.parsingContext = this.parsingContext.parent;
  }
  onError(e) {
    this.errors.push(m({ before: xt(this.tokens.slice(this.index, this.index + 10)), after: xt(this.tokens.slice(Math.max(0, this.index - 10), this.index)) }, e));
  }
  get mathlist() {
    return this.parsingContext.mathlist;
  }
  set mathlist(e) {
    this.parsingContext.mathlist = e;
  }
  get parseMode() {
    return this.parsingContext.parseMode;
  }
  set parseMode(e) {
    this.parsingContext.parseMode = e;
  }
  get tabularMode() {
    return this.parsingContext.tabular;
  }
  get style() {
    let e = this.parsingContext;
    for (; e; ) {
      if (e.style) return m({}, e.style);
      e = e.parent;
    }
    return {};
  }
  set style(e) {
    this.parsingContext.style = e;
  }
  end() {
    return this.endCount++, this.index >= this.tokens.length || this.endCount > 1e3;
  }
  next() {
    this.index += 1;
  }
  get() {
    return this.endCount = 0, this.index < this.tokens.length ? this.tokens[this.index++] : "";
  }
  peek() {
    return this.tokens[this.index];
  }
  expandUnicode() {
    if (!this.peek() || this.parseMode !== "math") return;
    let e = P0(this.peek());
    e && this.tokens.splice(this.index, 1, ...or(e));
  }
  match(e) {
    return this.tokens[this.index] === e ? (this.index++, true) : false;
  }
  lastSubsupAtom() {
    let e;
    return this.mathlist.length > 0 && (e = this.mathlist[this.mathlist.length - 1], e.type === "subsup" || e.subsupPlacement !== void 0) || (e = new gr({ style: this.style }), this.mathlist.push(e)), e;
  }
  hasPattern(e) {
    return e.test(this.tokens[this.index]);
  }
  hasInfixCommand() {
    var r;
    let { index: e } = this;
    if (e < this.tokens.length && this.tokens[e].startsWith("\\")) {
      let i = H(this.tokens[e], this.parseMode);
      return !i || i.definitionType === "symbol" || i.ifMode && !i.ifMode.includes(this.parseMode) ? false : (r = i.infix) != null ? r : false;
    }
    return false;
  }
  matchColumnSeparator() {
    return !this.tabularMode || this.peek() !== "&" ? false : (this.index++, true);
  }
  matchRowSeparator() {
    if (!this.tabularMode) return false;
    let e = this.peek();
    return e !== "\\\\" && e !== "\\cr" && e !== "\\tabularnewline" ? false : (this.index++, true);
  }
  placeholder() {
    var r;
    let e = (r = this.args) == null ? void 0 : r.call(this, "?");
    return e ? nt(e, { parseMode: this.parseMode, mathstyle: "textstyle" }) : [new me({ mode: this.parseMode, style: this.style })];
  }
  skipWhitespace() {
    for (; this.match("<space>"); ) ;
  }
  skipUntilToken(e) {
    let r = this.tokens[this.index];
    for (; r && r !== e; ) r = this.tokens[++this.index];
    r === e && this.index++;
  }
  skipFiller() {
    for (; this.match("\\relax") || this.match("<space>"); ) ;
  }
  matchKeyword(e) {
    let r = this.index, i = this.end(), n = "";
    for (; !i; ) {
      let a = this.get();
      yr(a) ? (n += a, i = this.end() || n.length >= e.length) : i = true;
    }
    let o = e.toUpperCase() === n.toUpperCase();
    return o || (this.index = r), o;
  }
  scanString() {
    let e = "";
    for (; !this.end(); ) {
      let r = this.peek();
      if (r === "]") return e;
      if (r === "<space>") e += " ";
      else if (r.startsWith("\\")) this.onError({ code: "unexpected-command-in-string" }), e += r.substring(1);
      else if (yr(r)) e += r;
      else return e;
      this.next();
    }
    return e;
  }
  scanBalancedString() {
    let e = "", r = this.end(), i = 1;
    for (; !r; ) {
      let n = this.get();
      n === "<space>" ? e += " " : n === "<{>" ? (e += "{", i += 1) : n === "<}>" ? (i -= 1, i > 0 ? e += "}" : this.index -= 1) : n === "<$>" ? e += "$" : n === "<$$>" ? e += "$$" : e += n, r = i === 0 || this.end();
    }
    return e;
  }
  scanLiteralGroup() {
    var i;
    if (!this.match("<{>")) return "";
    let e = "", r = 1;
    for (; r > 0 && !this.end(); ) {
      let n = this.get();
      n === "<}>" ? (r -= 1, r > 0 && (e += "}")) : n === "<{>" ? (r += 1, e += "{") : (/\\[a-zA-Z]+$/.test(e) && /^[a-zA-Z]/.test(n) && (e += " "), e += (i = { "<space>": " ", "<$$>": "$$", "<$>": "$" }[n]) != null ? i : n);
    }
    return e;
  }
  scanNumber(e = true) {
    var l, c;
    let r = false, i = this.peek();
    for (; i === "<space>" || i === "+" || i === "-"; ) this.get(), i === "-" && (r = !r), i = this.peek();
    e = !!e;
    let n = 10, o = /\d/;
    if (this.match("'")) n = 8, o = /[0-7]/, e = true;
    else if (this.match('"')) n = 16, o = /[\dA-F]/, e = true;
    else if (this.match("x")) n = 16, o = /[\dA-Fa-f]/, e = true;
    else if (this.match("`")) return i = this.get(), i ? i.length === 2 && i.startsWith("\\") ? { number: (r ? -1 : 1) * ((l = i.codePointAt(1)) != null ? l : 0), base: "alpha" } : { number: (r ? -1 : 1) * ((c = i.codePointAt(0)) != null ? c : 0), base: "alpha" } : null;
    let a = "";
    for (; this.hasPattern(o); ) a += this.get();
    if (!e && (this.match(".") || this.match(","))) for (a += "."; this.hasPattern(o); ) a += this.get();
    let s = e ? Number.parseInt(a, n) : Number.parseFloat(a);
    return Number.isNaN(s) ? null : { number: r ? -s : s, base: n === 16 ? "hexadecimal" : n === 8 ? "octal" : "decimal" };
  }
  scanRegister() {
    var o;
    let e = this.index, r = this.scanNumber(false);
    if (this.skipWhitespace(), this.match("\\relax")) return r;
    let i = false;
    if (r === null) for (; ; ) {
      let a = this.peek();
      if (a === "-") i = !i;
      else if (a !== "+") break;
      this.next(), this.skipWhitespace();
    }
    if (this.match("\\global")) {
      this.skipWhitespace();
      let a = this.get();
      return a.startsWith("\\") ? r ? { register: a, global: true, factor: (i ? -1 : 1) * r.number } : i ? { register: a, global: true, factor: -1 } : { register: a, global: true } : (this.index = e, null);
    }
    let n = this.get();
    return n != null && n.startsWith("\\") ? (n = n.substring(1), this.context.registers[n] ? !i || r !== null ? { register: n, factor: (i ? -1 : 1) * ((o = r == null ? void 0 : r.number) != null ? o : 1) } : { register: n } : (this.index = e, null)) : (this.index = e, null);
  }
  scanValue() {
    let e = this.scanRegister();
    if (e) return e;
    let r = this.index, i = this.scanGlueOrDimen();
    if (i && ("unit" in i || "glue" in i && "unit" in i.glue)) return i;
    this.index = r;
    let n = this.scanNumber();
    if (n) return n;
    if (this.end() || !yr(this.peek())) return null;
    let o = this.scanString();
    return o.length > 0 ? { string: o } : null;
  }
  scanDimen() {
    let e = this.scanNumber(false);
    if (e === null) return null;
    let r = e.number;
    this.skipWhitespace(), this.matchKeyword("true"), this.skipWhitespace();
    let i;
    return this.matchKeyword("pt") ? i = "pt" : this.matchKeyword("mm") ? i = "mm" : this.matchKeyword("cm") ? i = "cm" : this.matchKeyword("ex") ? i = "ex" : this.matchKeyword("px") ? i = "px" : this.matchKeyword("em") ? i = "em" : this.matchKeyword("bp") ? i = "bp" : this.matchKeyword("dd") ? i = "dd" : this.matchKeyword("pc") ? i = "pc" : this.matchKeyword("in") ? i = "in" : this.matchKeyword("mu") && (i = "mu"), i ? { dimension: r, unit: i } : { dimension: r };
  }
  scanGlueOrDimen() {
    let e = this.scanDimen();
    if (e === null) return null;
    if (this.skipWhitespace(), this.match("\\relax")) return e;
    let r = { glue: e };
    if (this.matchKeyword("plus")) {
      let i = this.scanDimen();
      if (i) r.grow = i;
      else return r;
    }
    if (this.skipWhitespace(), this.match("\\relax")) return r;
    if (this.skipWhitespace(), this.matchKeyword("minus")) {
      let i = this.scanDimen();
      if (i) r.shrink = i;
      else return r;
    }
    return !r.grow && !r.shrink ? e : r;
  }
  scanColspec() {
    this.skipWhitespace();
    let e = [];
    for (; !this.end() && !(this.peek() === "<}>" || this.peek() === "]"); ) {
      let r = this.get();
      r === "c" || r === "r" || r === "l" ? e.push({ align: r }) : r === "|" ? e.push({ separator: "solid" }) : r === ":" ? e.push({ separator: "dashed" }) : r === "@" && (this.match("<{>") && (this.beginContext({ mode: "math" }), e.push({ gap: this.scan((i) => i === "<}>") }), this.endContext()), this.match("<}>") || this.onError({ code: "unbalanced-braces" }));
    }
    return e;
  }
  scanModeSet() {
    let e;
    if (this.match("\\(") && (e = "textstyle"), !e && this.match("\\[") && (e = "displaystyle"), !e) return null;
    this.beginContext({ mode: "math", mathstyle: e });
    let r = this.scan((i) => i === (e === "displaystyle" ? "\\]" : "\\)"));
    return this.match(e === "displaystyle" ? "\\]" : "\\)") || this.onError({ code: "unbalanced-mode-shift" }), this.endContext(), r;
  }
  scanModeShift() {
    let e = "";
    if (this.match("<$>") && (e = "<$>"), !e && this.match("<$$>") && (e = "<$$>"), !e) return null;
    this.beginContext({ mode: "math", mathstyle: e === "<$>" ? "textstyle" : "displaystyle" });
    let r = this.scan((i) => i === e);
    return this.match(e) || this.onError({ code: "unbalanced-mode-shift" }), this.endContext(), r;
  }
  scanEnvironment() {
    if (!this.match("\\begin")) return null;
    let e = this.scanArgument("string");
    if (!e) return null;
    let r = N0(e);
    if (!r) return this.onError({ code: "unknown-environment", arg: e }), null;
    let i = [];
    if (r.params) for (let l of r.params) if (l.isOptional) i.push(this.scanOptionalArgument(l.type));
    else {
      let c = this.scanArgument(l.type);
      c || this.onError({ code: "missing-argument", arg: e }), i.push(c);
    }
    this.beginContext({ tabular: r.tabular, root: r.rootOnly });
    let n = [], o = [], a = [], s = false;
    do
      if (this.end() && (this.onError({ code: "unbalanced-environment", arg: e }), s = true), !s && this.match("\\end") && (this.scanArgument("string") !== e && this.onError({ code: "unbalanced-environment", arg: e }), s = true), !s) if (this.matchColumnSeparator()) a.push(this.mathlist), this.mathlist = [];
      else if (this.matchRowSeparator()) {
        a.push(this.mathlist), this.mathlist = [];
        let l = null;
        this.skipWhitespace(), this.match("[") && (l = this.scanDimen(), this.skipWhitespace(), this.match("]")), o.push(l != null ? l : { dimension: 0 }), n.push(a), a = [];
      } else this.mathlist.push(...this.scan((l) => ["<}>", "&", "\\end", "\\cr", "\\\\", "\\tabularnewline"].includes(l)));
    while (!s);
    return a.push(this.mathlist), a.length > 0 && n.push(a), this.endContext(), r.rootOnly && (this.index = this.tokens.length), r.createAtom(e, n, o, i, this.context.maxMatrixCols);
  }
  scanExpression() {
    let e = this.mathlist;
    if (this.mathlist = [], this.parseExpression()) {
      let r = this.mathlist;
      return this.mathlist = e, r;
    }
    return this.mathlist = e, null;
  }
  scan(e) {
    this.beginContext(), e || (e = (s) => s === "<}>");
    let r = "", i = null, n = [], o = null;
    for (; !this.end() && !e(this.peek()); ) this.hasInfixCommand() && !r ? (r = this.get(), i = H(r, "math"), i && (n = this.scanArguments(i)[1]), o = this.mathlist, this.mathlist = []) : this.parseExpression();
    let a;
    return r ? (n.unshift(this.mathlist), o && n.unshift(o), a = [i.createAtom({ command: r, args: n, style: this.style, mode: this.parseMode })]) : a = this.mathlist, this.endContext(), a;
  }
  scanGroup() {
    let e = this.index;
    if (!this.match("<{>")) return null;
    let r = this.scan((n) => n === "<}>");
    if (this.match("<}>") || this.onError({ code: "unbalanced-braces" }), r.length === 1 && r[0].type === "placeholder") return r[0];
    let i = new dr(r, this.parseMode);
    return i.verbatimLatex = xt(this.tokens.slice(e, this.index)), i;
  }
  scanSmartFence() {
    if (this.skipWhitespace(), !this.match("(")) return null;
    this.beginContext();
    let e = 1;
    for (; !this.end() && e !== 0; ) this.match("(") && (e += 1), this.match(")") && (e -= 1), e !== 0 && this.parseExpression();
    let r = new Vt("", this.mathlist, { leftDelim: "(", rightDelim: e === 0 ? ")" : "?" });
    return this.endContext(), r;
  }
  scanDelim() {
    this.skipWhitespace();
    let e = this.peek();
    if (!e) return this.onError({ code: "unexpected-end-of-string" }), null;
    if (!yr(e) && !e.startsWith("\\")) return null;
    this.next();
    let r = H(e, "math");
    return r ? r.definitionType === "function" && r.ifMode && !r.ifMode.includes(this.parseMode) ? (this.onError({ code: "unexpected-delimiter", arg: e }), null) : r.definitionType === "symbol" && (r.type === "mopen" || r.type === "mclose") || /^(\.|\?|\||<|>|\\vert|\\Vert|\\\||\\surd|\\uparrow|\\downarrow|\\Uparrow|\\Downarrow|\\updownarrow|\\Updownarrow|\\mid|\\mvert|\\mVert)$/.test(e) ? e : (this.onError({ code: "unexpected-delimiter", arg: e }), null) : (this.onError({ code: "unknown-command", arg: e }), null);
  }
  scanLeftRight() {
    var o;
    if (this.match("\\right")) return this.onError({ code: "unbalanced-braces" }), new Pe("\\right");
    if (this.match("\\mright")) return this.onError({ code: "unbalanced-braces" }), new Pe("\\mright");
    let e = "\\right";
    if (!this.match("\\left")) {
      if (!this.match("\\mleft")) return null;
      e = "\\mright";
    }
    let r = this.scanDelim();
    if (!r) return this.onError({ code: "unexpected-delimiter" }), new Pe(e === "\\right" ? "\\left" : "\\mleft");
    for (this.beginContext(); !this.end() && !this.match(e); ) this.parseExpression();
    let i = this.mathlist;
    this.endContext();
    let n = (o = this.scanDelim()) != null ? o : ".";
    return new Vt(e === "\\right" ? "left...right" : "mleft...mright", i, { leftDelim: r, rightDelim: n, style: this.style });
  }
  parseSupSub() {
    if (this.parseMode !== "math") return false;
    let e = this.peek();
    if (e !== "^" && e !== "_" && e !== "'") return false;
    let r = this.lastSubsupAtom();
    for (; e === "^" || e === "_" || e === "'"; ) this.match("'") ? this.match("'") ? r.addChild(new p({ type: "mord", command: "\\doubleprime", mode: "math", value: "\u2032\u2032" }), "superscript") : r.addChild(new p({ type: "mord", command: "\\prime", mode: "math", value: "\u2032" }), "superscript") : (this.match("^") || this.match("_")) && r.addChildren(M(this.scanArgument("expression")), e === "_" ? "subscript" : "superscript"), e = this.peek();
    return true;
  }
  parseLimits() {
    if (this.parseMode !== "math") return false;
    let e = this.match("\\limits"), r = !e && this.match("\\nolimits"), i = !r && !e && this.match("\\displaylimits");
    if (!e && !r && !i) return false;
    let n = this.mathlist.length > 0 ? this.mathlist[this.mathlist.length - 1] : null;
    return n === null ? false : (n.explicitSubsupPlacement = true, e && (n.subsupPlacement = "over-under"), r && (n.subsupPlacement = "adjacent"), i && (n.subsupPlacement = "auto"), true);
  }
  scanArguments(e) {
    if (!(e != null && e.params)) return [void 0, []];
    let r, i = [], n = e.infix ? 2 : 0;
    for (; n < e.params.length; ) {
      let o = e.params[n];
      o.type === "rest" ? i.push(this.scan((a) => ["<}>", "&", "\\end", "\\cr", "\\\\", "\\tabularnewline", "\\right"].includes(a))) : o.isOptional ? i.push(this.scanOptionalArgument(o.type)) : o.type.endsWith("*") ? r = o.type.slice(0, -1) : i.push(this.scanArgument(o.type)), n += 1;
    }
    return [r, i];
  }
  scanSymbolOrLiteral() {
    let e = this.peek();
    if (!e) return null;
    this.next();
    let r;
    if (yr(e)) {
      let i = Y.createAtom(this.parseMode, e, m({}, this.style));
      return i ? [i] : null;
    }
    if (r = this.scanMacro(e), r) return [r];
    if (e.startsWith("\\")) {
      let i = H(e, this.parseMode);
      if (!i) return this.onError({ code: "unknown-command", arg: e }), [new Pe(e)];
      if (i.definitionType === "symbol") {
        let n = m({}, this.style);
        i.variant && (n.variant = i.variant), r = new p({ type: i.type, command: e, style: n, value: String.fromCodePoint(i.codepoint), mode: this.parseMode, verbatimLatex: e });
      } else {
        if (i.applyMode || i.applyStyle || i.infix) return this.onError({ code: "invalid-command", arg: e }), [new Pe(e)];
        i.createAtom && (r = i.createAtom({ command: e, args: [], style: this.style, mode: this.parseMode }));
      }
    }
    return r ? [r] : null;
  }
  scanArgument(e) {
    var n;
    this.skipFiller();
    let r = this.parseMode;
    if (e === "auto" && (e = r), !this.match("<{>")) {
      if (e === "string") return this.scanString();
      if (e === "value") return this.scanValue();
      if (e === "delim") return (n = this.scanDelim()) != null ? n : ".";
      if (e === "expression") return this.scanExpression();
      if (e === "math") {
        e !== r && this.beginContext({ mode: "math" });
        let o = this.scanSymbolOrLiteral();
        return e !== r && this.endContext(), o;
      }
      if (e === "text") {
        e !== r && this.beginContext({ mode: "text" });
        let o = this.scanSymbolOrLiteral();
        return e !== r && this.endContext(), o;
      }
      return e === "balanced-string" ? null : e === "rest" ? this.scan((o) => ["<}>", "&", "\\end", "\\cr", "\\\\", "\\tabularnewline", "\\right"].includes(o)) : null;
    }
    if (e === "text") {
      this.beginContext({ mode: "text" });
      do
        this.mathlist.push(...this.scan());
      while (!this.match("<}>") && !this.end());
      let o = this.mathlist;
      return this.endContext(), { group: o };
    }
    if (e === "math") {
      this.beginContext({ mode: "math" });
      do
        this.mathlist.push(...this.scan());
      while (!this.match("<}>") && !this.end());
      let o = this.mathlist;
      return this.endContext(), { group: o };
    }
    if (e === "rest") {
      let o = this.scan();
      return this.match("<}>") || this.onError({ code: "unbalanced-braces" }), { group: o };
    }
    let i = null;
    if (e === "expression") {
      this.beginContext({ mode: "math" });
      do
        this.mathlist.push(...this.scan());
      while (!this.match("<}>") && !this.end());
      let o = this.mathlist;
      return this.endContext(), { group: o };
    }
    return e === "string" ? i = this.scanString() : e === "balanced-string" ? i = this.scanBalancedString() : e === "colspec" ? i = this.scanColspec() : e === "value" && (i = this.scanValue()), this.skipUntilToken("<}>"), i;
  }
  scanOptionalArgument(e) {
    if (e = e === "auto" ? this.parseMode : e, this.skipFiller(), !this.match("[")) return null;
    let r = null;
    for (; !this.end() && !this.match("]"); ) if (e === "string") r = this.scanString();
    else if (e === "value") r = this.scanValue();
    else if (e === "colspec") r = this.scanColspec();
    else if (e === "bbox") {
      let i = {}, n = this.scanString().toLowerCase().trim().split(/,(?![^(]*\)(?:(?:[^(]*\)){2})*[^"]*$)/);
      for (let o of n) {
        let a = o.match(/^\s*([\d.]+)\s*([a-z]{2})/);
        if (a) i.padding = { dimension: Number.parseFloat(a[1]), unit: a[2] };
        else {
          let s = o.match(/^\s*border\s*:\s*(.*)/);
          s ? i.border = s[1] : i.backgroundcolor = { string: o };
        }
      }
      r = i;
    } else e === "math" && (this.beginContext({ mode: "math" }), r = this.mathlist.concat(this.scan((i) => i === "]")), this.endContext());
    return r;
  }
  scanSymbolOrCommand(e) {
    var o, a, s;
    if (e === "\\placeholder") {
      let l = this.scanOptionalArgument("string"), c = this.scanOptionalArgument("math"), h = p.serialize(c, { defaultMode: "math" }), d = [], f;
      !f && h === "correct" ? f = "correct" : !f && h === "incorrect" ? f = "incorrect" : h !== "" && (d = c);
      let S = this.scanOptionalArgument("string") === "locked", x = this.scanArgument("auto"), w;
      return x && Array.isArray(x) && x.length > 0 ? w = x : x && typeof x == "object" && "group" in x ? w = x.group : w = d, l ? [new fr(l, f, S, w != null ? w : d, { mode: this.parseMode, style: this.style })] : [new me({ mode: this.parseMode, style: this.style })];
    }
    if (e === "\\renewcommand" || e === "\\newcommand" || e === "\\providecommand" || e === "\\def") {
      let l = this.index, c = this.scanLiteralGroup() || this.next();
      if (!c) return null;
      if (this.context.registers[c.substring(1)]) {
        let h = this.scanArgument("string");
        h !== null && (this.context.registers[c.substring(1)] = h);
        let d = D([e, xt(this.tokens.slice(l, this.index))]);
        return [new p({ type: "text", value: "", verbatimLatex: d })];
      }
    }
    let r = this.scanMacro(e);
    if (r) return [r];
    let i = H(e, this.parseMode);
    if (!i) return this.parseMode === "text" ? (/[a-zA-Z]/.test((o = this.peek()) != null ? o : "") && (e += " "), [...e].map((l) => new p({ type: "text", value: l, mode: "text", style: this.style }))) : (this.onError({ code: "unknown-command", arg: e }), [new Pe(e)]);
    let n = this.index;
    if (i.definitionType === "symbol") {
      let l = m({}, this.style);
      i.variant && (l.variant = i.variant), r = new p({ type: i.type, command: e, style: l, value: String.fromCodePoint(i.codepoint), mode: this.parseMode });
    } else {
      if (i.ifMode && !i.ifMode.includes(this.parseMode)) return [];
      let l = this.parseMode;
      i.applyMode && (this.parseMode = i.applyMode);
      let c, h = [];
      if (i.parse ? h = i.parse(this) : [c, h] = this.scanArguments(i), this.parseMode = l, i.applyMode && !i.applyStyle && !i.createAtom) return M(h[0]);
      if (i.infix) return this.onError({ code: "too-many-infix-commands", arg: e }), null;
      if (typeof i.createAtom == "function") r = i.createAtom({ command: e, args: h, style: this.style, mode: this.parseMode }), c && (r.body = M(this.scanArgument(c)));
      else if (typeof i.applyStyle == "function") {
        let d = i.applyStyle(this.style, e, h, this.context), f = this.parseMode;
        if (i.applyMode && (this.parseMode = i.applyMode), c) {
          let S = this.style;
          this.style = d;
          let x = this.scanArgument(c);
          return this.style = S, this.parseMode = f, M(x);
        }
        this.style = d;
      } else r = new p({ type: "mord", command: (a = i.command) != null ? a : e, style: m({}, this.style), value: e, mode: (s = i.applyMode) != null ? s : this.parseMode });
    }
    if (!r) return null;
    if (r instanceof p && r.verbatimLatex === void 0 && !/^\\(llap|rlap|class|cssId|htmlData)$/.test(e)) {
      let l = D([e, xt(this.tokens.slice(n, this.index))]);
      l && (r.verbatimLatex = l);
    }
    if (r.verbatimLatex === null && (r.verbatimLatex = void 0), r.isFunction && this.smartFence) {
      let l = this.scanSmartFence();
      if (l) return [r, l];
    }
    return [r];
  }
  scanSymbolCommandOrLiteral() {
    this.expandUnicode();
    let e = this.get();
    if (!e) return null;
    if (yr(e)) {
      let r = Y.createAtom(this.parseMode, e, m({}, this.style));
      if (!r) return null;
      if (r.isFunction && this.smartFence) {
        let i = this.scanSmartFence();
        if (i) return [r, i];
      }
      return [r];
    }
    return e.startsWith("\\") ? this.scanSymbolOrCommand(e) : e === "<space>" ? this.parseMode === "text" ? [new kt(" ", " ", this.style)] : null : (e === "<}>" ? this.onError({ latex: "", code: "unbalanced-braces" }) : this.onError({ latex: "", code: "unexpected-token", arg: e }), null);
  }
  scanMacro(e) {
    var a;
    let r = this.context.getMacro(e);
    if (!r) return null;
    let i = this.index, n = r.args, o = { "?": (a = this.args) == null ? void 0 : a.call(this, "?") };
    for (let s = 1; s <= n; s++) {
      let l = this.scanLiteralGroup();
      if (!l) {
        let c = this.index;
        this.scanExpression(), l = xt(this.tokens.slice(c, this.index));
      }
      o[s] = l;
    }
    return new pr(e, { expand: r.expand, captureSelection: r.captureSelection, args: i === this.index ? null : xt(this.tokens.slice(i, this.index)), style: this.parsingContext.style, body: nt(r.def, { context: this.context, parseMode: this.parseMode, args: (s) => o[s], mathstyle: this.parsingContext.mathstyle, style: this.parsingContext.style }) });
  }
  parseExpression() {
    var r, i, n, o;
    let e = (o = (n = (i = (r = this.scanEnvironment()) != null ? r : this.scanModeShift()) != null ? i : this.scanModeSet()) != null ? n : this.scanGroup()) != null ? o : this.scanLeftRight();
    if (e === null) {
      if (this.parseSupSub() || this.parseLimits()) return true;
      e = this.scanSymbolCommandOrLiteral();
    }
    return e ? (ge(e) ? this.mathlist.push(...e) : this.mathlist.push(e), true) : false;
  }
};
function nt(t33, e) {
  var o, a, s, l;
  let r = (o = e == null ? void 0 : e.args) != null ? o : void 0, i = new ln(or(t33, r), e == null ? void 0 : e.context, { args: r, mathstyle: (a = e == null ? void 0 : e.mathstyle) != null ? a : "displaystyle", parseMode: (s = e == null ? void 0 : e.parseMode) != null ? s : "math", style: (l = e == null ? void 0 : e.style) != null ? l : {} }), n = [];
  for (; !i.end(); ) n.push(...i.scan(() => false));
  return n;
}
function cl(t33, e) {
  var i;
  let r = new ln(or(t33, null), e == null ? void 0 : e.context, { mathstyle: "displaystyle", parseMode: (i = e == null ? void 0 : e.parseMode) != null ? i : "math" });
  for (; !r.end(); ) r.scan();
  return r.errors;
}
var Hr = class t24 extends p {
  constructor(e, r) {
    super({ type: "chem" }, { command: e, mode: "math" });
    let i = U.go(v.go(r, e === "\\pu" ? "pu" : "ce"), false);
    this.body = nt(i), this._verbatimLatex = e + "{" + r + "}", this.arg = r, this.captureSelection = true;
  }
  static fromJson(e) {
    return new t24(e.command, e.arg);
  }
  set verbatimLatex(e) {
  }
  get verbatimLatex() {
    return this._verbatimLatex;
  }
  toJson() {
    return u(m({}, super.toJson()), { arg: this.arg });
  }
  render(e) {
    let r = p.createBox(e, this.body, { type: "inner" });
    return this.caret && (r.caret = this.caret), this.bind(e, r);
  }
  _serialize(e) {
    return this.verbatimLatex, this.verbatimLatex;
  }
};
g(["ce", "pu"], "{chemformula:balanced-string}", { createAtom: (t33) => {
  var e;
  return new Hr(t33.command, (e = t33.args[0]) != null ? e : "");
} });
var v = { go: function(t33, e) {
  if (!t33) return [];
  e === void 0 && (e = "ce");
  var r = "0", i = {};
  i.parenthesisLevel = 0, t33 = t33.replace(/\n/g, " "), t33 = t33.replace(/[\u2212\u2013\u2014\u2010]/g, "-"), t33 = t33.replace(/[\u2026]/g, "...");
  for (var n, o = 10, a = []; ; ) {
    n !== t33 ? (o = 10, n = t33) : o--;
    var s = v.stateMachines[e], l = s.transitions[r] || s.transitions["*"];
    e: for (var c = 0; c < l.length; c++) {
      var h = v.patterns.match_(l[c].pattern, t33);
      if (h) {
        for (var d = l[c].task, f = 0; f < d.action_.length; f++) {
          var S;
          if (s.actions[d.action_[f].type_]) S = s.actions[d.action_[f].type_](i, h.match_, d.action_[f].option);
          else if (v.actions[d.action_[f].type_]) S = v.actions[d.action_[f].type_](i, h.match_, d.action_[f].option);
          else throw ["MhchemBugA", "mhchem bug A. Please report. (" + d.action_[f].type_ + ")"];
          v.concatArray(a, S);
        }
        if (r = d.nextState || r, t33.length > 0) {
          if (d.revisit || (t33 = h.remainder), !d.toContinue) break e;
        } else return a;
      }
    }
    if (o <= 0) throw ["MhchemBugU", "mhchem bug U. Please report."];
  }
}, concatArray: function(t33, e) {
  if (e) if (Object.prototype.toString.call(e) === "[object Array]") for (var r = 0; r < e.length; r++) t33.push(e[r]);
  else t33.push(e);
}, patterns: { patterns: { empty: /^$/, else: /^./, else2: /^./, space: /^\s/, "space A": /^\s(?=[A-Z\\$])/, space$: /^\s$/, "a-z": /^[a-z]/, x: /^x/, x$: /^x$/, i$: /^i$/, letters: /^(?:[a-zA-Z\u03B1-\u03C9\u0391-\u03A9?@]|(?:\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)(?:\s+|\{\}|(?![a-zA-Z]))))+/, "\\greek": /^\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)(?:\s+|\{\}|(?![a-zA-Z]))/, "one lowercase latin letter $": /^(?:([a-z])(?:$|[^a-zA-Z]))$/, "$one lowercase latin letter$ $": /^\$(?:([a-z])(?:$|[^a-zA-Z]))\$$/, "one lowercase greek letter $": /^(?:\$?[\u03B1-\u03C9]\$?|\$?\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\s*\$?)(?:\s+|\{\}|(?![a-zA-Z]))$/, digits: /^[0-9]+/, "-9.,9": /^[+\-]?(?:[0-9]+(?:[,.][0-9]+)?|[0-9]*(?:\.[0-9]+))/, "-9.,9 no missing 0": /^[+\-]?[0-9]+(?:[.,][0-9]+)?/, "(-)(9.,9)(e)(99)": function(t33) {
  var e = t33.match(/^(\+\-|\+\/\-|\+|\-|\\pm\s?)?([0-9]+(?:[,.][0-9]+)?|[0-9]*(?:\.[0-9]+))?(\((?:[0-9]+(?:[,.][0-9]+)?|[0-9]*(?:\.[0-9]+))\))?(?:(?:([eE])|\s*(\*|x|\\times|\u00D7)\s*10\^)([+\-]?[0-9]+|\{[+\-]?[0-9]+\}))?/);
  return e && e[0] ? { match_: e.slice(1), remainder: t33.substr(e[0].length) } : null;
}, "(-)(9)^(-9)": function(t33) {
  var e = t33.match(/^(\+\-|\+\/\-|\+|\-|\\pm\s?)?([0-9]+(?:[,.][0-9]+)?|[0-9]*(?:\.[0-9]+)?)\^([+\-]?[0-9]+|\{[+\-]?[0-9]+\})/);
  return e && e[0] ? { match_: e.slice(1), remainder: t33.substr(e[0].length) } : null;
}, "state of aggregation $": function(t33) {
  var e = v.patterns.findObserveGroups(t33, "", /^\([a-z]{1,3}(?=[\),])/, ")", "");
  if (e && e.remainder.match(/^($|[\s,;\)\]\}])/)) return e;
  var r = t33.match(/^(?:\((?:\\ca\s?)?\$[amothc]\$\))/);
  return r ? { match_: r[0], remainder: t33.substr(r[0].length) } : null;
}, "_{(state of aggregation)}$": /^_\{(\([a-z]{1,3}\))\}/, "{[(": /^(?:\\\{|\[|\()/, ")]}": /^(?:\)|\]|\\\})/, ", ": /^[,;]\s*/, ",": /^[,;]/, ".": /^[.]/, ". ": /^([.\u22C5\u00B7\u2022])\s*/, "...": /^\.\.\.(?=$|[^.])/, "* ": /^([*])\s*/, "^{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "^{", "", "", "}");
}, "^($...$)": function(t33) {
  return v.patterns.findObserveGroups(t33, "^", "$", "$", "");
}, "^a": /^\^([0-9]+|[^\\_])/, "^\\x{}{}": function(t33) {
  return v.patterns.findObserveGroups(t33, "^", /^\\[a-zA-Z]+\{/, "}", "", "", "{", "}", "", true);
}, "^\\x{}": function(t33) {
  return v.patterns.findObserveGroups(t33, "^", /^\\[a-zA-Z]+\{/, "}", "");
}, "^\\x": /^\^(\\[a-zA-Z]+)\s*/, "^(-1)": /^\^(-?\d+)/, "'": /^'/, "_{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "_{", "", "", "}");
}, "_($...$)": function(t33) {
  return v.patterns.findObserveGroups(t33, "_", "$", "$", "");
}, _9: /^_([+\-]?[0-9]+|[^\\])/, "_\\x{}{}": function(t33) {
  return v.patterns.findObserveGroups(t33, "_", /^\\[a-zA-Z]+\{/, "}", "", "", "{", "}", "", true);
}, "_\\x{}": function(t33) {
  return v.patterns.findObserveGroups(t33, "_", /^\\[a-zA-Z]+\{/, "}", "");
}, "_\\x": /^_(\\[a-zA-Z]+)\s*/, "^_": /^(?:\^(?=_)|\_(?=\^)|[\^_]$)/, "{}": /^\{\}/, "{...}": function(t33) {
  return v.patterns.findObserveGroups(t33, "", "{", "}", "");
}, "{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "{", "", "", "}");
}, "$...$": function(t33) {
  return v.patterns.findObserveGroups(t33, "", "$", "$", "");
}, "${(...)}$": function(t33) {
  return v.patterns.findObserveGroups(t33, "${", "", "", "}$");
}, "$(...)$": function(t33) {
  return v.patterns.findObserveGroups(t33, "$", "", "", "$");
}, "=<>": /^[=<>]/, "#": /^[#\u2261]/, "+": /^\+/, "-$": /^-(?=[\s_},;\]/]|$|\([a-z]+\))/, "-9": /^-(?=[0-9])/, "- orbital overlap": /^-(?=(?:[spd]|sp)(?:$|[\s,;\)\]\}]))/, "-": /^-/, "pm-operator": /^(?:\\pm|\$\\pm\$|\+-|\+\/-)/, operator: /^(?:\+|(?:[\-=<>]|<<|>>|\\approx|\$\\approx\$)(?=\s|$|-?[0-9]))/, arrowUpDown: /^(?:v|\(v\)|\^|\(\^\))(?=$|[\s,;\)\]\}])/, "\\bond{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\bond{", "", "", "}");
}, "->": /^(?:<->|<-->|->|<-|<=>>|<<=>|<=>|[\u2192\u27F6\u21CC])/, CMT: /^[CMT](?=\[)/, "[(...)]": function(t33) {
  return v.patterns.findObserveGroups(t33, "[", "", "", "]");
}, "1st-level escape": /^(&|\\\\|\\hline)\s*/, "\\,": /^(?:\\[,\ ;:])/, "\\x{}{}": function(t33) {
  return v.patterns.findObserveGroups(t33, "", /^\\[a-zA-Z]+\{/, "}", "", "", "{", "}", "", true);
}, "\\x{}": function(t33) {
  return v.patterns.findObserveGroups(t33, "", /^\\[a-zA-Z]+\{/, "}", "");
}, "\\ca": /^\\ca(?:\s+|(?![a-zA-Z]))/, "\\x": /^(?:\\[a-zA-Z]+\s*|\\[_&{}%])/, orbital: /^(?:[0-9]{1,2}[spdfgh]|[0-9]{0,2}sp)(?=$|[^a-zA-Z])/, others: /^[\/~|]/, "\\frac{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\frac{", "", "", "}", "{", "", "", "}");
}, "\\overset{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\overset{", "", "", "}", "{", "", "", "}");
}, "\\underset{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\underset{", "", "", "}", "{", "", "", "}");
}, "\\underbrace{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\underbrace{", "", "", "}_", "{", "", "", "}");
}, "\\color{(...)}0": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\color{", "", "", "}");
}, "\\color{(...)}{(...)}1": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\color{", "", "", "}", "{", "", "", "}");
}, "\\color(...){(...)}2": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\color", "\\", "", /^(?=\{)/, "{", "", "", "}");
}, "\\ce{(...)}": function(t33) {
  return v.patterns.findObserveGroups(t33, "\\ce{", "", "", "}");
}, oxidation$: /^(?:[+-][IVX]+|\\pm\s*0|\$\\pm\$\s*0)$/, "d-oxidation$": /^(?:[+-]?\s?[IVX]+|\\pm\s*0|\$\\pm\$\s*0)$/, "roman numeral": /^[IVX]+/, "1/2$": /^[+\-]?(?:[0-9]+|\$[a-z]\$|[a-z])\/[0-9]+(?:\$[a-z]\$|[a-z])?$/, amount: function(t33) {
  var e;
  if (e = t33.match(/^(?:(?:(?:\([+\-]?[0-9]+\/[0-9]+\)|[+\-]?(?:[0-9]+|\$[a-z]\$|[a-z])\/[0-9]+|[+\-]?[0-9]+[.,][0-9]+|[+\-]?\.[0-9]+|[+\-]?[0-9]+)(?:[a-z](?=\s*[A-Z]))?)|[+\-]?[a-z](?=\s*[A-Z])|\+(?!\s))/), e) return { match_: e[0], remainder: t33.substr(e[0].length) };
  var r = v.patterns.findObserveGroups(t33, "", "$", "$", "");
  return r && (e = r.match_.match(/^\$(?:\(?[+\-]?(?:[0-9]*[a-z]?[+\-])?[0-9]*[a-z](?:[+\-][0-9]*[a-z]?)?\)?|\+|-)\$$/), e) ? { match_: e[0], remainder: t33.substr(e[0].length) } : null;
}, amount2: function(t33) {
  return this.amount(t33);
}, "(KV letters),": /^(?:[A-Z][a-z]{0,2}|i)(?=,)/, formula$: function(t33) {
  if (t33.match(/^\([a-z]+\)$/)) return null;
  var e = t33.match(/^(?:[a-z]|(?:[0-9\ \+\-\,\.\(\)]+[a-z])+[0-9\ \+\-\,\.\(\)]*|(?:[a-z][0-9\ \+\-\,\.\(\)]+)+[a-z]?)$/);
  return e ? { match_: e[0], remainder: t33.substr(e[0].length) } : null;
}, uprightEntities: /^(?:pH|pOH|pC|pK|iPr|iBu)(?=$|[^a-zA-Z])/, "/": /^\s*(\/)\s*/, "//": /^\s*(\/\/)\s*/, "*": /^\s*[*.]\s*/ }, findObserveGroups: function(t33, e, r, i, n, o, a, s, l, c) {
  var h = function(b, A) {
    if (typeof A == "string") return b.indexOf(A) !== 0 ? null : A;
    var k = b.match(A);
    return k ? k[0] : null;
  }, d = function(b, A, k) {
    for (var L = 0; A < b.length; ) {
      var P = b.charAt(A), B = h(b.substr(A), k);
      if (B !== null && L === 0) return { endMatchBegin: A, endMatchEnd: A + B.length };
      if (P === "{") L++;
      else if (P === "}") {
        if (L === 0) throw ["ExtraCloseMissingOpen", "Extra close brace or missing open brace"];
        L--;
      }
      A++;
    }
    return L > 0, null;
  }, f = h(t33, e);
  if (f === null || (t33 = t33.substr(f.length), f = h(t33, r), f === null)) return null;
  var S = d(t33, f.length, i || n);
  if (S === null) return null;
  var x = t33.substring(0, i ? S.endMatchEnd : S.endMatchBegin);
  if (o || a) {
    var w = this.findObserveGroups(t33.substr(S.endMatchEnd), o, a, s, l);
    if (w === null) return null;
    var T = [x, w.match_];
    return { match_: c ? T.join("") : T, remainder: w.remainder };
  } else return { match_: x, remainder: t33.substr(S.endMatchEnd) };
}, match_: function(t33, e) {
  var r = v.patterns.patterns[t33];
  if (r === void 0) throw ["MhchemBugP", "mhchem bug P. Please report. (" + t33 + ")"];
  if (typeof r == "function") return v.patterns.patterns[t33](e);
  var i = e.match(r);
  if (i) {
    var n;
    return i[2] ? n = [i[1], i[2]] : i[1] ? n = i[1] : n = i[0], { match_: n, remainder: e.substr(i[0].length) };
  }
  return null;
} }, actions: { "a=": function(t33, e) {
  t33.a = (t33.a || "") + e;
}, "b=": function(t33, e) {
  t33.b = (t33.b || "") + e;
}, "p=": function(t33, e) {
  t33.p = (t33.p || "") + e;
}, "o=": function(t33, e) {
  t33.o = (t33.o || "") + e;
}, "q=": function(t33, e) {
  t33.q = (t33.q || "") + e;
}, "d=": function(t33, e) {
  t33.d = (t33.d || "") + e;
}, "rm=": function(t33, e) {
  t33.rm = (t33.rm || "") + e;
}, "text=": function(t33, e) {
  t33.text_ = (t33.text_ || "") + e;
}, insert: function(t33, e, r) {
  return { type_: r };
}, "insert+p1": function(t33, e, r) {
  return { type_: r, p1: e };
}, "insert+p1+p2": function(t33, e, r) {
  return { type_: r, p1: e[0], p2: e[1] };
}, copy: function(t33, e) {
  return e;
}, rm: function(t33, e) {
  return { type_: "rm", p1: e || "" };
}, text: function(t33, e) {
  return v.go(e, "text");
}, "{text}": function(t33, e) {
  var r = ["{"];
  return v.concatArray(r, v.go(e, "text")), r.push("}"), r;
}, "tex-math": function(t33, e) {
  return v.go(e, "tex-math");
}, "tex-math tight": function(t33, e) {
  return v.go(e, "tex-math tight");
}, bond: function(t33, e, r) {
  return { type_: "bond", kind_: r || e };
}, "color0-output": function(t33, e) {
  return { type_: "color0", color: e[0] };
}, ce: function(t33, e) {
  return v.go(e);
}, "1/2": function(t33, e) {
  var r = [];
  e.match(/^[+\-]/) && (r.push(e.substr(0, 1)), e = e.substr(1));
  var i = e.match(/^([0-9]+|\$[a-z]\$|[a-z])\/([0-9]+)(\$[a-z]\$|[a-z])?$/);
  return i[1] = i[1].replace(/\$/g, ""), r.push({ type_: "frac", p1: i[1], p2: i[2] }), i[3] && (i[3] = i[3].replace(/\$/g, ""), r.push({ type_: "tex-math", p1: i[3] })), r;
}, "9,9": function(t33, e) {
  return v.go(e, "9,9");
} }, createTransitions: function(t33) {
  var e, r, i, n, o = {};
  for (e in t33) for (r in t33[e]) for (i = r.split("|"), t33[e][r].stateArray = i, n = 0; n < i.length; n++) o[i[n]] = [];
  for (e in t33) for (r in t33[e]) for (i = t33[e][r].stateArray || [], n = 0; n < i.length; n++) {
    var a = t33[e][r];
    if (a.action_) {
      a.action_ = [].concat(a.action_);
      for (var s = 0; s < a.action_.length; s++) typeof a.action_[s] == "string" && (a.action_[s] = { type_: a.action_[s] });
    } else a.action_ = [];
    for (var l = e.split("|"), c = 0; c < l.length; c++) if (i[n] === "*") for (var h in o) o[h].push({ pattern: l[c], task: a });
    else o[i[n]].push({ pattern: l[c], task: a });
  }
  return o;
}, stateMachines: {} };
v.stateMachines = { ce: { transitions: v.createTransitions({ empty: { "*": { action_: "output" } }, else: { "0|1|2": { action_: "beginsWithBond=false", revisit: true, toContinue: true } }, oxidation$: { 0: { action_: "oxidation-output" } }, CMT: { r: { action_: "rdt=", nextState: "rt" }, rd: { action_: "rqt=", nextState: "rdt" } }, arrowUpDown: { "0|1|2|as": { action_: ["sb=false", "output", "operator"], nextState: "1" } }, uprightEntities: { "0|1|2": { action_: ["o=", "output"], nextState: "1" } }, orbital: { "0|1|2|3": { action_: "o=", nextState: "o" } }, "->": { "0|1|2|3": { action_: "r=", nextState: "r" }, "a|as": { action_: ["output", "r="], nextState: "r" }, "*": { action_: ["output", "r="], nextState: "r" } }, "+": { o: { action_: "d= kv", nextState: "d" }, "d|D": { action_: "d=", nextState: "d" }, q: { action_: "d=", nextState: "qd" }, "qd|qD": { action_: "d=", nextState: "qd" }, dq: { action_: ["output", "d="], nextState: "d" }, 3: { action_: ["sb=false", "output", "operator"], nextState: "0" } }, amount: { "0|2": { action_: "a=", nextState: "a" } }, "pm-operator": { "0|1|2|a|as": { action_: ["sb=false", "output", { type_: "operator", option: "\\pm" }], nextState: "0" } }, operator: { "0|1|2|a|as": { action_: ["sb=false", "output", "operator"], nextState: "0" } }, "-$": { "o|q": { action_: ["charge or bond", "output"], nextState: "qd" }, d: { action_: "d=", nextState: "d" }, D: { action_: ["output", { type_: "bond", option: "-" }], nextState: "3" }, q: { action_: "d=", nextState: "qd" }, qd: { action_: "d=", nextState: "qd" }, "qD|dq": { action_: ["output", { type_: "bond", option: "-" }], nextState: "3" } }, "-9": { "3|o": { action_: ["output", { type_: "insert", option: "hyphen" }], nextState: "3" } }, "- orbital overlap": { o: { action_: ["output", { type_: "insert", option: "hyphen" }], nextState: "2" }, d: { action_: ["output", { type_: "insert", option: "hyphen" }], nextState: "2" } }, "-": { "0|1|2": { action_: [{ type_: "output", option: 1 }, "beginsWithBond=true", { type_: "bond", option: "-" }], nextState: "3" }, 3: { action_: { type_: "bond", option: "-" } }, a: { action_: ["output", { type_: "insert", option: "hyphen" }], nextState: "2" }, as: { action_: [{ type_: "output", option: 2 }, { type_: "bond", option: "-" }], nextState: "3" }, b: { action_: "b=" }, o: { action_: { type_: "- after o/d", option: false }, nextState: "2" }, q: { action_: { type_: "- after o/d", option: false }, nextState: "2" }, "d|qd|dq": { action_: { type_: "- after o/d", option: true }, nextState: "2" }, "D|qD|p": { action_: ["output", { type_: "bond", option: "-" }], nextState: "3" } }, amount2: { "1|3": { action_: "a=", nextState: "a" } }, letters: { "0|1|2|3|a|as|b|p|bp|o": { action_: "o=", nextState: "o" }, "q|dq": { action_: ["output", "o="], nextState: "o" }, "d|D|qd|qD": { action_: "o after d", nextState: "o" } }, digits: { o: { action_: "q=", nextState: "q" }, "d|D": { action_: "q=", nextState: "dq" }, q: { action_: ["output", "o="], nextState: "o" }, a: { action_: "o=", nextState: "o" } }, "space A": { "b|p|bp": {} }, space: { a: { nextState: "as" }, 0: { action_: "sb=false" }, "1|2": { action_: "sb=true" }, "r|rt|rd|rdt|rdq": { action_: "output", nextState: "0" }, "*": { action_: ["output", "sb=true"], nextState: "1" } }, "1st-level escape": { "1|2": { action_: ["output", { type_: "insert+p1", option: "1st-level escape" }] }, "*": { action_: ["output", { type_: "insert+p1", option: "1st-level escape" }], nextState: "0" } }, "[(...)]": { "r|rt": { action_: "rd=", nextState: "rd" }, "rd|rdt": { action_: "rq=", nextState: "rdq" } }, "...": { "o|d|D|dq|qd|qD": { action_: ["output", { type_: "bond", option: "..." }], nextState: "3" }, "*": { action_: [{ type_: "output", option: 1 }, { type_: "insert", option: "ellipsis" }], nextState: "1" } }, ". |* ": { "*": { action_: ["output", { type_: "insert", option: "addition compound" }], nextState: "1" } }, "state of aggregation $": { "*": { action_: ["output", "state of aggregation"], nextState: "1" } }, "{[(": { "a|as|o": { action_: ["o=", "output", "parenthesisLevel++"], nextState: "2" }, "0|1|2|3": { action_: ["o=", "output", "parenthesisLevel++"], nextState: "2" }, "*": { action_: ["output", "o=", "output", "parenthesisLevel++"], nextState: "2" } }, ")]}": { "0|1|2|3|b|p|bp|o": { action_: ["o=", "parenthesisLevel--"], nextState: "o" }, "a|as|d|D|q|qd|qD|dq": { action_: ["output", "o=", "parenthesisLevel--"], nextState: "o" } }, ", ": { "*": { action_: ["output", "comma"], nextState: "0" } }, "^_": { "*": {} }, "^{(...)}|^($...$)": { "0|1|2|as": { action_: "b=", nextState: "b" }, p: { action_: "b=", nextState: "bp" }, "3|o": { action_: "d= kv", nextState: "D" }, q: { action_: "d=", nextState: "qD" }, "d|D|qd|qD|dq": { action_: ["output", "d="], nextState: "D" } }, "^a|^\\x{}{}|^\\x{}|^\\x|'": { "0|1|2|as": { action_: "b=", nextState: "b" }, p: { action_: "b=", nextState: "bp" }, "3|o": { action_: "d= kv", nextState: "d" }, q: { action_: "d=", nextState: "qd" }, "d|qd|D|qD": { action_: "d=" }, dq: { action_: ["output", "d="], nextState: "d" } }, "_{(state of aggregation)}$": { "d|D|q|qd|qD|dq": { action_: ["output", "q="], nextState: "q" } }, "_{(...)}|_($...$)|_9|_\\x{}{}|_\\x{}|_\\x": { "0|1|2|as": { action_: "p=", nextState: "p" }, b: { action_: "p=", nextState: "bp" }, "3|o": { action_: "q=", nextState: "q" }, "d|D": { action_: "q=", nextState: "dq" }, "q|qd|qD|dq": { action_: ["output", "q="], nextState: "q" } }, "=<>": { "0|1|2|3|a|as|o|q|d|D|qd|qD|dq": { action_: [{ type_: "output", option: 2 }, "bond"], nextState: "3" } }, "#": { "0|1|2|3|a|as|o": { action_: [{ type_: "output", option: 2 }, { type_: "bond", option: "#" }], nextState: "3" } }, "{}": { "*": { action_: { type_: "output", option: 1 }, nextState: "1" } }, "{...}": { "0|1|2|3|a|as|b|p|bp": { action_: "o=", nextState: "o" }, "o|d|D|q|qd|qD|dq": { action_: ["output", "o="], nextState: "o" } }, "$...$": { a: { action_: "a=" }, "0|1|2|3|as|b|p|bp|o": { action_: "o=", nextState: "o" }, "as|o": { action_: "o=" }, "q|d|D|qd|qD|dq": { action_: ["output", "o="], nextState: "o" } }, "\\bond{(...)}": { "*": { action_: [{ type_: "output", option: 2 }, "bond"], nextState: "3" } }, "\\frac{(...)}": { "*": { action_: [{ type_: "output", option: 1 }, "frac-output"], nextState: "3" } }, "\\overset{(...)}": { "*": { action_: [{ type_: "output", option: 2 }, "overset-output"], nextState: "3" } }, "\\underset{(...)}": { "*": { action_: [{ type_: "output", option: 2 }, "underset-output"], nextState: "3" } }, "\\underbrace{(...)}": { "*": { action_: [{ type_: "output", option: 2 }, "underbrace-output"], nextState: "3" } }, "\\color{(...)}{(...)}1|\\color(...){(...)}2": { "*": { action_: [{ type_: "output", option: 2 }, "color-output"], nextState: "3" } }, "\\color{(...)}0": { "*": { action_: [{ type_: "output", option: 2 }, "color0-output"] } }, "\\ce{(...)}": { "*": { action_: [{ type_: "output", option: 2 }, "ce"], nextState: "3" } }, "\\,": { "*": { action_: [{ type_: "output", option: 1 }, "copy"], nextState: "1" } }, "\\x{}{}|\\x{}|\\x": { "0|1|2|3|a|as|b|p|bp|o|c0": { action_: ["o=", "output"], nextState: "3" }, "*": { action_: ["output", "o=", "output"], nextState: "3" } }, others: { "*": { action_: [{ type_: "output", option: 1 }, "copy"], nextState: "3" } }, else2: { a: { action_: "a to o", nextState: "o", revisit: true }, as: { action_: ["output", "sb=true"], nextState: "1", revisit: true }, "r|rt|rd|rdt|rdq": { action_: ["output"], nextState: "0", revisit: true }, "*": { action_: ["output", "copy"], nextState: "3" } } }), actions: { "o after d": function(t33, e) {
  var r;
  if ((t33.d || "").match(/^[0-9]+$/)) {
    var i = t33.d;
    t33.d = void 0, r = this.output(t33), t33.b = i;
  } else r = this.output(t33);
  return v.actions["o="](t33, e), r;
}, "d= kv": function(t33, e) {
  t33.d = e, t33.dType = "kv";
}, "charge or bond": function(t33, e) {
  if (t33.beginsWithBond) {
    var r = [];
    return v.concatArray(r, this.output(t33)), v.concatArray(r, v.actions.bond(t33, e, "-")), r;
  } else t33.d = e;
}, "- after o/d": function(t33, e, r) {
  var i = v.patterns.match_("orbital", t33.o || ""), n = v.patterns.match_("one lowercase greek letter $", t33.o || ""), o = v.patterns.match_("one lowercase latin letter $", t33.o || ""), a = v.patterns.match_("$one lowercase latin letter$ $", t33.o || ""), s = e === "-" && (i && i.remainder === "" || n || o || a);
  s && !t33.a && !t33.b && !t33.p && !t33.d && !t33.q && !i && o && (t33.o = "$" + t33.o + "$");
  var l = [];
  return s ? (v.concatArray(l, this.output(t33)), l.push({ type_: "hyphen" })) : (i = v.patterns.match_("digits", t33.d || ""), r && i && i.remainder === "" ? (v.concatArray(l, v.actions["d="](t33, e)), v.concatArray(l, this.output(t33))) : (v.concatArray(l, this.output(t33)), v.concatArray(l, v.actions.bond(t33, e, "-")))), l;
}, "a to o": function(t33) {
  t33.o = t33.a, t33.a = void 0;
}, "sb=true": function(t33) {
  t33.sb = true;
}, "sb=false": function(t33) {
  t33.sb = false;
}, "beginsWithBond=true": function(t33) {
  t33.beginsWithBond = true;
}, "beginsWithBond=false": function(t33) {
  t33.beginsWithBond = false;
}, "parenthesisLevel++": function(t33) {
  t33.parenthesisLevel++;
}, "parenthesisLevel--": function(t33) {
  t33.parenthesisLevel--;
}, "state of aggregation": function(t33, e) {
  return { type_: "state of aggregation", p1: v.go(e, "o") };
}, comma: function(t33, e) {
  var r = e.replace(/\s*$/, ""), i = r !== e;
  return i && t33.parenthesisLevel === 0 ? { type_: "comma enumeration L", p1: r } : { type_: "comma enumeration M", p1: r };
}, output: function(t33, e, r) {
  var i;
  if (!t33.r) i = [], !t33.a && !t33.b && !t33.p && !t33.o && !t33.q && !t33.d && !r || (t33.sb && i.push({ type_: "entitySkip" }), !t33.o && !t33.q && !t33.d && !t33.b && !t33.p && r !== 2 ? (t33.o = t33.a, t33.a = void 0) : !t33.o && !t33.q && !t33.d && (t33.b || t33.p) ? (t33.o = t33.a, t33.d = t33.b, t33.q = t33.p, t33.a = t33.b = t33.p = void 0) : t33.o && t33.dType === "kv" && v.patterns.match_("d-oxidation$", t33.d || "") ? t33.dType = "oxidation" : t33.o && t33.dType === "kv" && !t33.q && (t33.dType = void 0), i.push({ type_: "chemfive", a: v.go(t33.a, "a"), b: v.go(t33.b, "bd"), p: v.go(t33.p, "pq"), o: v.go(t33.o, "o"), q: v.go(t33.q, "pq"), d: v.go(t33.d, t33.dType === "oxidation" ? "oxidation" : "bd"), dType: t33.dType }));
  else {
    var n;
    t33.rdt === "M" ? n = v.go(t33.rd, "tex-math") : t33.rdt === "T" ? n = [{ type_: "text", p1: t33.rd || "" }] : n = v.go(t33.rd);
    var o;
    t33.rqt === "M" ? o = v.go(t33.rq, "tex-math") : t33.rqt === "T" ? o = [{ type_: "text", p1: t33.rq || "" }] : o = v.go(t33.rq), i = { type_: "arrow", r: t33.r, rd: n, rq: o };
  }
  for (var a in t33) a !== "parenthesisLevel" && a !== "beginsWithBond" && delete t33[a];
  return i;
}, "oxidation-output": function(t33, e) {
  var r = ["{"];
  return v.concatArray(r, v.go(e, "oxidation")), r.push("}"), r;
}, "frac-output": function(t33, e) {
  return { type_: "frac-ce", p1: v.go(e[0]), p2: v.go(e[1]) };
}, "overset-output": function(t33, e) {
  return { type_: "overset", p1: v.go(e[0]), p2: v.go(e[1]) };
}, "underset-output": function(t33, e) {
  return { type_: "underset", p1: v.go(e[0]), p2: v.go(e[1]) };
}, "underbrace-output": function(t33, e) {
  return { type_: "underbrace", p1: v.go(e[0]), p2: v.go(e[1]) };
}, "color-output": function(t33, e) {
  return { type_: "color", color1: e[0], color2: v.go(e[1]) };
}, "r=": function(t33, e) {
  t33.r = e;
}, "rdt=": function(t33, e) {
  t33.rdt = e;
}, "rd=": function(t33, e) {
  t33.rd = e;
}, "rqt=": function(t33, e) {
  t33.rqt = e;
}, "rq=": function(t33, e) {
  t33.rq = e;
}, operator: function(t33, e, r) {
  return { type_: "operator", kind_: r || e };
} } }, a: { transitions: v.createTransitions({ empty: { "*": {} }, "1/2$": { 0: { action_: "1/2" } }, else: { 0: { nextState: "1", revisit: true } }, "$(...)$": { "*": { action_: "tex-math tight", nextState: "1" } }, ",": { "*": { action_: { type_: "insert", option: "commaDecimal" } } }, else2: { "*": { action_: "copy" } } }), actions: {} }, o: { transitions: v.createTransitions({ empty: { "*": {} }, "1/2$": { 0: { action_: "1/2" } }, else: { 0: { nextState: "1", revisit: true } }, letters: { "*": { action_: "rm" } }, "\\ca": { "*": { action_: { type_: "insert", option: "circa" } } }, "\\x{}{}|\\x{}|\\x": { "*": { action_: "copy" } }, "${(...)}$|$(...)$": { "*": { action_: "tex-math" } }, "{(...)}": { "*": { action_: "{text}" } }, else2: { "*": { action_: "copy" } } }), actions: {} }, text: { transitions: v.createTransitions({ empty: { "*": { action_: "output" } }, "{...}": { "*": { action_: "text=" } }, "${(...)}$|$(...)$": { "*": { action_: "tex-math" } }, "\\greek": { "*": { action_: ["output", "rm"] } }, "\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: ["output", "copy"] } }, else: { "*": { action_: "text=" } } }), actions: { output: function(t33) {
  if (t33.text_) {
    var e = { type_: "text", p1: t33.text_ };
    for (var r in t33) delete t33[r];
    return e;
  }
} } }, pq: { transitions: v.createTransitions({ empty: { "*": {} }, "state of aggregation $": { "*": { action_: "state of aggregation" } }, i$: { 0: { nextState: "!f", revisit: true } }, "(KV letters),": { 0: { action_: "rm", nextState: "0" } }, formula$: { 0: { nextState: "f", revisit: true } }, "1/2$": { 0: { action_: "1/2" } }, else: { 0: { nextState: "!f", revisit: true } }, "${(...)}$|$(...)$": { "*": { action_: "tex-math" } }, "{(...)}": { "*": { action_: "text" } }, "a-z": { f: { action_: "tex-math" } }, letters: { "*": { action_: "rm" } }, "-9.,9": { "*": { action_: "9,9" } }, ",": { "*": { action_: { type_: "insert+p1", option: "comma enumeration S" } } }, "\\color{(...)}{(...)}1|\\color(...){(...)}2": { "*": { action_: "color-output" } }, "\\color{(...)}0": { "*": { action_: "color0-output" } }, "\\ce{(...)}": { "*": { action_: "ce" } }, "\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: "copy" } }, else2: { "*": { action_: "copy" } } }), actions: { "state of aggregation": function(t33, e) {
  return { type_: "state of aggregation subscript", p1: v.go(e, "o") };
}, "color-output": function(t33, e) {
  return { type_: "color", color1: e[0], color2: v.go(e[1], "pq") };
} } }, bd: { transitions: v.createTransitions({ empty: { "*": {} }, x$: { 0: { nextState: "!f", revisit: true } }, formula$: { 0: { nextState: "f", revisit: true } }, else: { 0: { nextState: "!f", revisit: true } }, "-9.,9 no missing 0": { "*": { action_: "9,9" } }, ".": { "*": { action_: { type_: "insert", option: "electron dot" } } }, "a-z": { f: { action_: "tex-math" } }, x: { "*": { action_: { type_: "insert", option: "KV x" } } }, letters: { "*": { action_: "rm" } }, "'": { "*": { action_: { type_: "insert", option: "prime" } } }, "${(...)}$|$(...)$": { "*": { action_: "tex-math" } }, "{(...)}": { "*": { action_: "text" } }, "\\color{(...)}{(...)}1|\\color(...){(...)}2": { "*": { action_: "color-output" } }, "\\color{(...)}0": { "*": { action_: "color0-output" } }, "\\ce{(...)}": { "*": { action_: "ce" } }, "\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: "copy" } }, else2: { "*": { action_: "copy" } } }), actions: { "color-output": function(t33, e) {
  return { type_: "color", color1: e[0], color2: v.go(e[1], "bd") };
} } }, oxidation: { transitions: v.createTransitions({ empty: { "*": {} }, "roman numeral": { "*": { action_: "roman-numeral" } }, "${(...)}$|$(...)$": { "*": { action_: "tex-math" } }, else: { "*": { action_: "copy" } } }), actions: { "roman-numeral": function(t33, e) {
  return { type_: "roman numeral", p1: e || "" };
} } }, "tex-math": { transitions: v.createTransitions({ empty: { "*": { action_: "output" } }, "\\ce{(...)}": { "*": { action_: ["output", "ce"] } }, "{...}|\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: "o=" } }, else: { "*": { action_: "o=" } } }), actions: { output: function(t33) {
  if (t33.o) {
    var e = { type_: "tex-math", p1: t33.o };
    for (var r in t33) delete t33[r];
    return e;
  }
} } }, "tex-math tight": { transitions: v.createTransitions({ empty: { "*": { action_: "output" } }, "\\ce{(...)}": { "*": { action_: ["output", "ce"] } }, "{...}|\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: "o=" } }, "-|+": { "*": { action_: "tight operator" } }, else: { "*": { action_: "o=" } } }), actions: { "tight operator": function(t33, e) {
  t33.o = (t33.o || "") + "{" + e + "}";
}, output: function(t33) {
  if (t33.o) {
    var e = { type_: "tex-math", p1: t33.o };
    for (var r in t33) delete t33[r];
    return e;
  }
} } }, "9,9": { transitions: v.createTransitions({ empty: { "*": {} }, ",": { "*": { action_: "comma" } }, else: { "*": { action_: "copy" } } }), actions: { comma: function() {
  return { type_: "commaDecimal" };
} } }, pu: { transitions: v.createTransitions({ empty: { "*": { action_: "output" } }, space$: { "*": { action_: ["output", "space"] } }, "{[(|)]}": { "0|a": { action_: "copy" } }, "(-)(9)^(-9)": { 0: { action_: "number^", nextState: "a" } }, "(-)(9.,9)(e)(99)": { 0: { action_: "enumber", nextState: "a" } }, space: { "0|a": {} }, "pm-operator": { "0|a": { action_: { type_: "operator", option: "\\pm" }, nextState: "0" } }, operator: { "0|a": { action_: "copy", nextState: "0" } }, "//": { d: { action_: "o=", nextState: "/" } }, "/": { d: { action_: "o=", nextState: "/" } }, "{...}|else": { "0|d": { action_: "d=", nextState: "d" }, a: { action_: ["space", "d="], nextState: "d" }, "/|q": { action_: "q=", nextState: "q" } } }), actions: { enumber: function(t33, e) {
  var r = [];
  return e[0] === "+-" || e[0] === "+/-" ? r.push("\\pm ") : e[0] && r.push(e[0]), e[1] && (v.concatArray(r, v.go(e[1], "pu-9,9")), e[2] && (e[2].match(/[,.]/) ? v.concatArray(r, v.go(e[2], "pu-9,9")) : r.push(e[2])), (e[3] || e[4]) && (e[3] === "e" || e[4] === "*" ? r.push({ type_: "cdot" }) : r.push({ type_: "times" }))), e[5] && r.push("10^{" + e[5] + "}"), r;
}, "number^": function(t33, e) {
  var r = [];
  return e[0] === "+-" || e[0] === "+/-" ? r.push("\\pm ") : e[0] && r.push(e[0]), v.concatArray(r, v.go(e[1], "pu-9,9")), r.push("^{" + e[2] + "}"), r;
}, operator: function(t33, e, r) {
  return { type_: "operator", kind_: r || e };
}, space: function() {
  return { type_: "pu-space-1" };
}, output: function(t33) {
  var e, r = v.patterns.match_("{(...)}", t33.d || "");
  r && r.remainder === "" && (t33.d = r.match_);
  var i = v.patterns.match_("{(...)}", t33.q || "");
  if (i && i.remainder === "" && (t33.q = i.match_), t33.d && (t33.d = t33.d.replace(/\u00B0C|\^oC|\^{o}C/g, "{}^{\\circ}C"), t33.d = t33.d.replace(/\u00B0F|\^oF|\^{o}F/g, "{}^{\\circ}F")), t33.q) {
    t33.q = t33.q.replace(/\u00B0C|\^oC|\^{o}C/g, "{}^{\\circ}C"), t33.q = t33.q.replace(/\u00B0F|\^oF|\^{o}F/g, "{}^{\\circ}F");
    var n = { d: v.go(t33.d, "pu"), q: v.go(t33.q, "pu") };
    t33.o === "//" ? e = { type_: "pu-frac", p1: n.d, p2: n.q } : (e = n.d, n.d.length > 1 || n.q.length > 1 ? e.push({ type_: " / " }) : e.push({ type_: "/" }), v.concatArray(e, n.q));
  } else e = v.go(t33.d, "pu-2");
  for (var o in t33) delete t33[o];
  return e;
} } }, "pu-2": { transitions: v.createTransitions({ empty: { "*": { action_: "output" } }, "*": { "*": { action_: ["output", "cdot"], nextState: "0" } }, "\\x": { "*": { action_: "rm=" } }, space: { "*": { action_: ["output", "space"], nextState: "0" } }, "^{(...)}|^(-1)": { 1: { action_: "^(-1)" } }, "-9.,9": { 0: { action_: "rm=", nextState: "0" }, 1: { action_: "^(-1)", nextState: "0" } }, "{...}|else": { "*": { action_: "rm=", nextState: "1" } } }), actions: { cdot: function() {
  return { type_: "tight cdot" };
}, "^(-1)": function(t33, e) {
  t33.rm += "^{" + e + "}";
}, space: function() {
  return { type_: "pu-space-2" };
}, output: function(t33) {
  var e = [];
  if (t33.rm) {
    var r = v.patterns.match_("{(...)}", t33.rm || "");
    r && r.remainder === "" ? e = v.go(r.match_, "pu") : e = { type_: "rm", p1: t33.rm };
  }
  for (var i in t33) delete t33[i];
  return e;
} } }, "pu-9,9": { transitions: v.createTransitions({ empty: { 0: { action_: "output-0" }, o: { action_: "output-o" } }, ",": { 0: { action_: ["output-0", "comma"], nextState: "o" } }, ".": { 0: { action_: ["output-0", "copy"], nextState: "o" } }, else: { "*": { action_: "text=" } } }), actions: { comma: function() {
  return { type_: "commaDecimal" };
}, "output-0": function(t33) {
  var e = [];
  if (t33.text_ = t33.text_ || "", t33.text_.length > 4) {
    var r = t33.text_.length % 3;
    r === 0 && (r = 3);
    for (var i = t33.text_.length - 3; i > 0; i -= 3) e.push(t33.text_.substr(i, 3)), e.push({ type_: "1000 separator" });
    e.push(t33.text_.substr(0, r)), e.reverse();
  } else e.push(t33.text_);
  for (var n in t33) delete t33[n];
  return e;
}, "output-o": function(t33) {
  var e = [];
  if (t33.text_ = t33.text_ || "", t33.text_.length > 4) {
    for (var r = t33.text_.length - 3, i = 0; i < r; i += 3) e.push(t33.text_.substr(i, 3)), e.push({ type_: "1000 separator" });
    e.push(t33.text_.substr(i));
  } else e.push(t33.text_);
  for (var n in t33) delete t33[n];
  return e;
} } } };
var U = { go: function(t33, e) {
  if (!t33) return "";
  for (var r = "", i = false, n = 0; n < t33.length; n++) {
    var o = t33[n];
    typeof o == "string" ? r += o : (r += U._go2(o), o.type_ === "1st-level escape" && (i = true));
  }
  return !e && !i && r && (r = "{" + r + "}"), r;
}, _goInner: function(t33) {
  return t33 && U.go(t33, true);
}, _go2: function(t33) {
  var e;
  switch (t33.type_) {
    case "chemfive":
      e = "";
      var r = { a: U._goInner(t33.a), b: U._goInner(t33.b), p: U._goInner(t33.p), o: U._goInner(t33.o), q: U._goInner(t33.q), d: U._goInner(t33.d) };
      r.a && (r.a.match(/^[+\-]/) && (r.a = "{" + r.a + "}"), e += r.a + "\\,"), (r.b || r.p) && (e += "{\\vphantom{X}}", e += "^{\\hphantom{" + (r.b || "") + "}}_{\\hphantom{" + (r.p || "") + "}}", e += "{\\vphantom{X}}", e += "^{\\smash[t]{\\vphantom{2}}\\llap{" + (r.b || "") + "}}", e += "_{\\vphantom{2}\\llap{\\smash[t]{" + (r.p || "") + "}}}"), r.o && (r.o.match(/^[+\-]/) && (r.o = "{" + r.o + "}"), e += r.o), t33.dType === "kv" ? ((r.d || r.q) && (e += "{\\vphantom{X}}"), r.d && (e += "^{" + r.d + "}"), r.q && (e += "_{\\smash[t]{" + r.q + "}}")) : t33.dType === "oxidation" ? (r.d && (e += "{\\vphantom{X}}", e += "^{" + r.d + "}"), r.q && (e += "{\\vphantom{X}}", e += "_{\\smash[t]{" + r.q + "}}")) : (r.q && (e += "{\\vphantom{X}}", e += "_{\\smash[t]{" + r.q + "}}"), r.d && (e += "{\\vphantom{X}}", e += "^{" + r.d + "}"));
      break;
    case "rm":
      e = "\\mathrm{" + t33.p1 + "}";
      break;
    case "text":
      t33.p1.match(/[\^_]/) ? (t33.p1 = t33.p1.replace(" ", "~").replace("-", "\\text{-}"), e = "\\mathrm{" + t33.p1 + "}") : e = "\\text{" + t33.p1 + "}";
      break;
    case "roman numeral":
      e = "\\mathrm{" + t33.p1 + "}";
      break;
    case "state of aggregation":
      e = "\\mskip2mu " + U._goInner(t33.p1);
      break;
    case "state of aggregation subscript":
      e = "\\mskip1mu " + U._goInner(t33.p1);
      break;
    case "bond":
      if (e = U._getBond(t33.kind_), !e) throw ["MhchemErrorBond", "mhchem Error. Unknown bond type (" + t33.kind_ + ")"];
      break;
    case "frac":
      var i = "\\frac{" + t33.p1 + "}{" + t33.p2 + "}";
      e = "\\mathchoice{\\textstyle" + i + "}{" + i + "}{" + i + "}{" + i + "}";
      break;
    case "pu-frac":
      var n = "\\frac{" + U._goInner(t33.p1) + "}{" + U._goInner(t33.p2) + "}";
      e = "\\mathchoice{\\textstyle" + n + "}{" + n + "}{" + n + "}{" + n + "}";
      break;
    case "tex-math":
      e = t33.p1 + " ";
      break;
    case "frac-ce":
      e = "\\frac{" + U._goInner(t33.p1) + "}{" + U._goInner(t33.p2) + "}";
      break;
    case "overset":
      e = "\\overset{" + U._goInner(t33.p1) + "}{" + U._goInner(t33.p2) + "}";
      break;
    case "underset":
      e = "\\underset{" + U._goInner(t33.p1) + "}{" + U._goInner(t33.p2) + "}";
      break;
    case "underbrace":
      e = "\\underbrace{" + U._goInner(t33.p1) + "}_{" + U._goInner(t33.p2) + "}";
      break;
    case "color":
      e = "{\\color{" + t33.color1 + "}{" + U._goInner(t33.color2) + "}}";
      break;
    case "color0":
      e = "\\color{" + t33.color + "}";
      break;
    case "arrow":
      var o = { rd: U._goInner(t33.rd), rq: U._goInner(t33.rq) }, a = U._getArrow(t33.r);
      o.rd || o.rq ? t33.r === "<=>" || t33.r === "<=>>" || t33.r === "<<=>" || t33.r === "<-->" ? (a = "\\long" + a, o.rd && (a = "\\overset{" + o.rd + "}{" + a + "}"), o.rq && (t33.r === "<-->" ? a = "\\underset{\\lower2mu{" + o.rq + "}}{" + a + "}" : a = "\\underset{\\lower6mu{" + o.rq + "}}{" + a + "}"), a = " {}\\mathrel{" + a + "}{} ") : (o.rq && (a += "[{" + o.rq + "}]"), a += "{" + o.rd + "}", a = " {}\\mathrel{\\x" + a + "}{} ") : a = " {}\\mathrel{\\long" + a + "}{} ", e = a;
      break;
    case "operator":
      e = U._getOperator(t33.kind_);
      break;
    case "1st-level escape":
      e = t33.p1 + " ";
      break;
    case "space":
      e = " ";
      break;
    case "entitySkip":
      e = "~";
      break;
    case "pu-space-1":
      e = "~";
      break;
    case "pu-space-2":
      e = "\\mkern3mu ";
      break;
    case "1000 separator":
      e = "\\mkern2mu ";
      break;
    case "commaDecimal":
      e = "{,}";
      break;
    case "comma enumeration L":
      e = "{" + t33.p1 + "}\\mkern6mu ";
      break;
    case "comma enumeration M":
      e = "{" + t33.p1 + "}\\mkern3mu ";
      break;
    case "comma enumeration S":
      e = "{" + t33.p1 + "}\\mkern1mu ";
      break;
    case "hyphen":
      e = "\\text{-}";
      break;
    case "addition compound":
      e = "\\,{\\cdot}\\,";
      break;
    case "electron dot":
      e = "\\mkern1mu \\bullet\\mkern1mu ";
      break;
    case "KV x":
      e = "{\\times}";
      break;
    case "prime":
      e = "\\prime ";
      break;
    case "cdot":
      e = "\\cdot ";
      break;
    case "tight cdot":
      e = "\\mkern1mu{\\cdot}\\mkern1mu ";
      break;
    case "times":
      e = "\\times ";
      break;
    case "circa":
      e = "{\\sim}";
      break;
    case "^":
      e = "uparrow";
      break;
    case "v":
      e = "downarrow";
      break;
    case "ellipsis":
      e = "\\ldots ";
      break;
    case "/":
      e = "/";
      break;
    case " / ":
      e = "\\,/\\,";
      break;
    default:
      throw ["MhchemBugT", "mhchem bug T. Please report."];
  }
  return e;
}, _getArrow: function(t33) {
  switch (t33) {
    case "->":
      return "rightarrow";
    case "\u2192":
      return "rightarrow";
    case "\u27F6":
      return "rightarrow";
    case "<-":
      return "leftarrow";
    case "<->":
      return "leftrightarrow";
    case "<-->":
      return "leftrightarrows";
    case "<=>":
      return "rightleftharpoons";
    case "\u21CC":
      return "rightleftharpoons";
    case "<=>>":
      return "Rightleftharpoons";
    case "<<=>":
      return "Leftrightharpoons";
    default:
      throw ["MhchemBugT", "mhchem bug T. Please report."];
  }
}, _getBond: function(t33) {
  switch (t33) {
    case "-":
      return "{-}";
    case "1":
      return "{-}";
    case "=":
      return "{=}";
    case "2":
      return "{=}";
    case "#":
      return "{\\equiv}";
    case "3":
      return "{\\equiv}";
    case "~":
      return "{\\tripledash}";
    case "~-":
      return "{\\rlap{\\lower.1em{-}}\\raise.1em{\\tripledash}}";
    case "~=":
      return "{\\rlap{\\lower.2em{-}}\\rlap{\\raise.2em{\\tripledash}}-}";
    case "~--":
      return "{\\rlap{\\lower.2em{-}}\\rlap{\\raise.2em{\\tripledash}}-}";
    case "-~-":
      return "{\\rlap{\\lower.2em{-}}\\rlap{\\raise.2em{-}}\\tripledash}";
    case "...":
      return "{{\\cdot}{\\cdot}{\\cdot}}";
    case "....":
      return "{{\\cdot}{\\cdot}{\\cdot}{\\cdot}}";
    case "->":
      return "{\\rightarrow}";
    case "<-":
      return "{\\leftarrow}";
    case "<":
      return "{<}";
    case ">":
      return "{>}";
    default:
      throw ["MhchemBugT", "mhchem bug T. Please report."];
  }
}, _getOperator: function(t33) {
  switch (t33) {
    case "+":
      return " {}+{} ";
    case "-":
      return " {}-{} ";
    case "=":
      return " {}={} ";
    case "<":
      return " {}<{} ";
    case ">":
      return " {}>{} ";
    case "<<":
      return " {}\\ll{} ";
    case ">>":
      return " {}\\gg{} ";
    case "\\pm":
      return " {}\\pm{} ";
    case "\\approx":
      return " {}\\approx{} ";
    case "$\\approx$":
      return " {}\\approx{} ";
    case "v":
      return " \\downarrow{} ";
    case "(v)":
      return " \\downarrow{} ";
    case "^":
      return " \\uparrow{} ";
    case "(^)":
      return " \\uparrow{} ";
    default:
      throw ["MhchemBugT", "mhchem bug T. Please report."];
  }
} };
var Ce = class t25 extends p {
  constructor(e) {
    super({ mode: e.mode, command: e.command, style: e.style, body: e.body, type: "box" }), this.framecolor = e.framecolor, this.backgroundcolor = e.backgroundcolor, this.padding = e.padding, this.offset = e.offset, this.border = e.border;
  }
  static fromJson(e) {
    return new t25(e);
  }
  toJson() {
    return u(m({}, super.toJson()), { framecolor: this.framecolor, backgroundcolor: this.backgroundcolor, padding: this.padding, offset: this.offset, border: this.border });
  }
  render(e) {
    var l, c, h, d;
    let r = p.createBox(e, this.body, { type: "lift" });
    if (!r) return null;
    let i = e.toEm((l = this.offset) != null ? l : { dimension: 0 });
    r.depth += i, r.setStyle("display", "inline-block"), r.setStyle("position", "relative"), r.setStyle("height", Math.floor(100 * r.height + r.depth) / 100, "em"), r.setStyle("vertical-align", -Math.floor(100 * r.height) / 100, "em");
    let n = new z({ parent: e }, this.style), o = n.toEm((c = this.padding) != null ? c : { register: "fboxsep" }), a = new y(null, { classes: "ML__box" });
    a.height = r.height + o, a.depth = r.depth + o, a.setStyle("box-sizing", "border-box"), a.setStyle("position", "absolute"), a.setStyle("top", -o + 0.3, "em"), a.setStyle("left", 0), a.setStyle("height", a.height + a.depth, "em"), a.setStyle("width", "100%"), this.backgroundcolor && a.setStyle("background-color", (h = n.toBackgroundColor(this.backgroundcolor)) != null ? h : "transparent"), this.framecolor && a.setStyle("border", `${n.getRegisterAsEm("fboxrule", 2)}em solid ${(d = n.toColor(this.framecolor)) != null ? d : "black"}`), this.border && a.setStyle("border", this.border);
    let s = new y([a, r], { type: "lift" });
    return s.setStyle("display", "inline-block"), s.setStyle("position", "relative"), s.setStyle("line-height", 0), s.height = r.height + o + (i > 0 ? i : 0), s.depth = r.depth + o + (i < 0 ? -i : 0), s.setStyle("padding-left", o, "em"), s.setStyle("padding-right", o, "em"), s.setStyle("height", Math.floor(100 * (r.height + r.depth + 2 * o + Math.abs(i))) / 100, "em"), s.setStyle("margin-top", -o, "em"), s.setStyle("top", Math.floor(100 * (r.depth - r.height + 2 * o - i)) / 100, "em"), s.setStyle("vertical-align", Math.floor(100 * (r.depth + 2 * o)) / 100, "em"), this.caret && (s.caret = this.caret), this.attachSupsub(e, { base: s });
  }
  _serialize(e) {
    return e.skipStyles ? D([this.bodyToLatex(e), this.supsubToLatex(e)]) : super._serialize(e);
  }
};
var Ze = class t26 extends p {
  constructor(e) {
    var r, i, n, o;
    super(u(m({}, e), { type: "phantom" })), this.captureSelection = true, this.isInvisible = (r = e.isInvisible) != null ? r : false, this.smashDepth = (i = e.smashDepth) != null ? i : false, this.smashHeight = (n = e.smashHeight) != null ? n : false, this.smashWidth = (o = e.smashWidth) != null ? o : false;
  }
  static fromJson(e) {
    return new t26(e);
  }
  toJson() {
    let e = {};
    return this.isInvisible && (e.isInvisible = true), this.smashDepth && (e.smashDepth = true), this.smashHeight && (e.smashHeight = true), this.smashWidth && (e.smashWidth = true), m(m({}, super.toJson()), e);
  }
  render(e) {
    let r = new z({ parent: e, isPhantom: true });
    if (!this.smashDepth && !this.smashHeight && !this.smashWidth) return this.isInvisible, p.createBox(r, this.body, { classes: "ML__inner" });
    let i = p.createBox(this.isInvisible ? r : e, this.body);
    if (!i) return null;
    if (this.smashWidth) {
      let n = new y(null, { classes: "ML__fix" });
      return new y([i, n], { classes: "ML__rlap" }).wrap(e);
    }
    if (!this.smashHeight && !this.smashDepth) return i;
    if (this.smashHeight && (i.height = 0), this.smashDepth && (i.depth = 0), i.children) for (let n of i.children) this.smashHeight && (n.height = 0), this.smashDepth && (n.depth = 0);
    return new V({ firstBaseline: [{ box: i }] }, { type: i.type }).wrap(e);
  }
};
var je = class t27 extends p {
  constructor(e) {
    var r;
    super(m({ type: "spacing" }, e)), this.width = e == null ? void 0 : e.width, this._braced = (r = e == null ? void 0 : e.braced) != null ? r : false;
  }
  static fromJson(e) {
    return new t27(e);
  }
  toJson() {
    let e = super.toJson();
    return this.width !== void 0 && (e.width = this.width), this._braced && (e.braced = true), e;
  }
  render(e) {
    var i;
    if (this.command === "space") return new y(this.mode === "math" ? null : " ");
    let r;
    if (this.width !== void 0) r = new y(null, { classes: "ML__mspace" }), r.left = e.toEm(this.width);
    else {
      let n = (i = { "\\qquad": "ML__qquad", "\\quad": "ML__quad", "\\enspace": "ML__enspace", "\\;": "ML__thickspace", "\\:": "ML__mediumspace", "\\>": "ML__mediumspace", "\\,": "ML__thinspace", "\\!": "ML__negativethinspace" }[this.command]) != null ? i : "ML__mediumspace";
      r = new y(null, { classes: n });
    }
    return r = this.bind(e, r), this.caret && (r.caret = this.caret), r;
  }
  _serialize(e) {
    var n;
    if (!e.expandMacro && typeof this.verbatimLatex == "string") return this.verbatimLatex;
    let r = H(this.command, this.mode);
    if (r != null && r.serialize) return r.serialize(this, e);
    let i = (n = this.command) != null ? n : "";
    return this.width === void 0 ? i : this._braced && !("register" in this.width) ? `${i}{${Q(this.width)}}` : `${i}${Q(this.width)}`;
  }
};
var Oe = class t28 extends p {
  constructor(e) {
    let r = e.body;
    super(u(m({}, e), { type: "overlap", body: typeof r == "string" ? [new p({ value: r })] : r, style: e == null ? void 0 : e.style })), this.skipBoundary = true, this.align = e == null ? void 0 : e.align, this.boxType = e == null ? void 0 : e.boxType;
  }
  static fromJson(e) {
    return new t28(e);
  }
  toJson() {
    let e = {};
    return this.align && (e.align = this.align), this.boxType && (e.boxType = this.boxType), m(m({}, super.toJson()), e);
  }
  render(e) {
    let r = p.createBox(e, this.body, { classes: "ML__inner" });
    return r ? (this.caret && (r.caret = this.caret), this.bind(e, new y([r, new y(null, { classes: "ML__fix" })], { classes: this.align === "right" ? "ML__rlap" : "ML__llap", type: this.boxType }))) : null;
  }
};
var cn = class t29 extends p {
  constructor(e, r) {
    var i;
    super({ type: "composition", mode: (i = r == null ? void 0 : r.mode) != null ? i : "math", value: e });
  }
  static fromJson(e) {
    return new t29(e.value, e);
  }
  toJson() {
    return super.toJson();
  }
  render(e) {
    let r = new y(this.value, { classes: "ML__composition", type: "composition" });
    return this.bind(e, r), this.caret && (r.caret = this.caret), r;
  }
  _serialize(e) {
    return "";
  }
};
var _t = class t30 extends p {
  constructor(e, r) {
    var i;
    super({ type: "latex", value: e, mode: "latex" }), this.isSuggestion = (i = r == null ? void 0 : r.isSuggestion) != null ? i : false, this.isError = false;
  }
  static fromJson(e) {
    let r = new t30(e.value);
    return e.isSuggestion && (r.isSuggestion = true), e.isError && (r.isError = true), r;
  }
  toJson() {
    let e = {};
    return this.isSuggestion && (e.isSuggestion = true), this.isError && (e.isError = true), m({ type: "latex", value: this.value }, e);
  }
  render(e) {
    let r = new y(this.value, { classes: this.isSuggestion ? "ML__suggestion" : this.isError ? "ML__error" : "", type: "latex", maxFontSize: 1 });
    return r ? (this.caret && (r.caret = this.caret), this.bind(e, r)) : null;
  }
};
var mn = class t31 extends p {
  constructor(e = "") {
    super({ type: "latexgroup", mode: "latex" }), this.body = [...e].map((r) => new _t(r)), this.skipBoundary = true;
  }
  static fromJson(e) {
    return new t31();
  }
  toJson() {
    return super.toJson();
  }
  render(e) {
    let r = p.createBox(e, this.body);
    return r ? (this.caret && (r.caret = this.caret), this.bind(e, r)) : null;
  }
  _serialize(e) {
    var r, i;
    return (i = (r = this.body) == null ? void 0 : r.map((n) => n.value).join("")) != null ? i : "";
  }
};
function Jt(t33) {
  if (ge(t33)) return t33.map((i) => Jt(i));
  if (typeof t33 == "string") return p.fromJson(t33);
  t33 = m({}, t33);
  for (let i of Mt) t33[i] && (t33[i] = Jt(t33[i]));
  t33.args && (t33.args = wc(t33.args)), t33.array && (t33.array = Jt(t33.array));
  let e = t33.type, r;
  e === "accent" && (r = At.fromJson(t33)), e === "array" && (r = G.fromJson(t33)), e === "box" && (r = Ce.fromJson(t33)), e === "chem" && (r = Hr.fromJson(t33)), e === "composition" && (r = cn.fromJson(t33)), e === "delim" && (r = ur.fromJson(t33)), e === "enclose" && (r = it.fromJson(t33)), e === "error" && (r = Pe.fromJson(t33)), e === "extensible-symbol" && (r = Nt.fromJson(t33)), e === "genfrac" && (r = Re.fromJson(t33)), e === "group" && (r = dr.fromJson(t33)), e === "latex" && (r = _t.fromJson(t33)), e === "latexgroup" && (r = mn.fromJson(t33)), e === "leftright" && (r = Vt.fromJson(t33)), e === "macro" && (r = pr.fromJson(t33)), e === "macro-argument" && (r = sn.fromJson(t33)), e === "operator" && (r = Fe.fromJson(t33)), e === "overlap" && (r = Oe.fromJson(t33)), e === "overunder" && (r = se.fromJson(t33)), e === "placeholder" && (r = me.fromJson(t33)), e === "prompt" && (r = fr.fromJson(t33)), e === "phantom" && (r = Ze.fromJson(t33)), e === "sizeddelim" && (r = hr.fromJson(t33)), e === "spacing" && (r = je.fromJson(t33)), e === "subsup" && (r = gr.fromJson(t33)), e === "surd" && (r = mr.fromJson(t33)), e === "text" && (r = kt.fromJson(t33)), e === "tooltip" && (r = Ht.fromJson(t33)), r || (!e || ["first", "mbin", "mrel", "mclose", "minner", "mop", "mopen", "mord", "mpunct", "root", "space"].includes(e), `${e}`, r = p.fromJson(t33));
  for (let i of Mt) t33[i] && r.setChildren(t33[i], i);
  return t33.verbatimLatex !== void 0 && (r.verbatimLatex = t33.verbatimLatex), t33.subsupPlacement && (r.subsupPlacement = t33.subsupPlacement), t33.explicitSubsupPlacement && (r.explicitSubsupPlacement = true), t33.isFunction && (r.isFunction = true), t33.skipBoundary && (r.skipBoundary = true), t33.captureSelection && (r.captureSelection = true), r;
}
function wc(t33) {
  if (t33) {
    if (typeof t33 == "string") return t33;
    if (Array.isArray(t33)) return t33.map((e) => e === "<null>" ? null : typeof e == "object" && "group" in e ? { group: e.group.map((r) => Jt(r)) } : typeof e == "object" && "atoms" in e ? e.atoms.map((r) => Jt(r)) : e);
  }
}
var wo = class extends y {
  constructor(e) {
    super(null, { type: "skip" }), this._width = e;
  }
  toMarkup() {
    return `<span style="display:inline-block;width:${Math.ceil(this.width * 100) / 100}em"></span>`;
  }
};
function Gr(t33, e) {
  if (!t33.parent) return;
  let r = t33.parent.children, i = r.indexOf(t33), n = i - 1;
  for (; n >= 0 && r[n].type === "ignore"; ) n -= 1;
  if (n < 0 && t33.parent.parent && t33.parent.type === "lift") {
    Gr(t33.parent, e);
    return;
  }
  i > 0 && r[i - 1].type === "skip" ? r[i - 1].width += e : r.splice(i, 0, new wo(e));
}
var Mc = { ord: { op: 3, bin: 4, rel: 5, inner: 3 }, op: { ord: 3, op: 3, rel: 5, inner: 3 }, bin: { ord: 4, op: 4, open: 4, inner: 4 }, rel: { ord: 5, op: 5, open: 5, inner: 5 }, close: { op: 3, bin: 4, rel: 5, inner: 3 }, punct: { ord: 3, op: 3, rel: 3, open: 3, punct: 3, inner: 3 }, inner: { ord: 3, op: 3, bin: 4, rel: 5, open: 3, punct: 3, inner: 3 } };
var Ac = { ord: { op: 3 }, op: { ord: 3, op: 3 }, close: { op: 3 }, inner: { op: 3 } };
function kc(t33) {
  Wr(t33, (e, r) => {
    r.type === "bin" && (!e || /^(middle|bin|op|rel|open|punct)$/.test(e.type)) && (r.type = "ord"), (e == null ? void 0 : e.type) === "bin" && /^(rel|close|punct)$/.test(r.type) && (e.type = "ord"), r.type !== "ignore" && (e = r);
  });
}
function un(t33, e) {
  if (!t33.children) return t33;
  let r = t33.children;
  kc(r);
  let i = e.getRegisterAsEm("thinmuskip"), n = e.getRegisterAsEm("medmuskip"), o = e.getRegisterAsEm("thickmuskip");
  return Wr(r, (a, s) => {
    var d, f, S;
    if (!a) return;
    let l = a.type, c = s.isTight ? (d = Ac[l]) != null ? d : null : (f = Mc[l]) != null ? f : null, h = (S = c == null ? void 0 : c[s.type]) != null ? S : null;
    h === 3 && Gr(s, i), h === 4 && Gr(s, n), h === 5 && Gr(s, o);
  }), t33;
}
function Wr(t33, e, r = void 0) {
  if (!t33) return r;
  t33 = [...t33];
  for (let i of t33) i.type === "lift" ? r = Wr(i.children, e, r) : i.type === "ignore" ? Wr(i.children, e) : (e(r, i), Wr(i.children, e), r = i);
  return r;
}
var Ht = class t32 extends p {
  constructor(e) {
    super({ type: "tooltip", command: e.command, mode: e.mode, style: e.style, body: e.body, displayContainsHighlight: true }), this.tooltip = new p({ type: "root", mode: e.content, body: e.tooltip, style: {} }), this.skipBoundary = true, this.captureSelection = false;
  }
  static fromJson(e) {
    return new t32(u(m({}, e), { tooltip: Jt(e.tooltip) }));
  }
  toJson() {
    var r;
    let e = (r = this.tooltip.body) == null ? void 0 : r.filter((i) => i.type !== "first").map((i) => i.toJson());
    return u(m({}, super.toJson()), { tooltip: e });
  }
  render(e) {
    let r = p.createBox(e, this.body);
    if (!r) return null;
    let i = new z({ parent: e, mathstyle: "displaystyle" }, { fontSize: Er }), n = Yi(un(new y(this.tooltip.render(i), { classes: "ML__tooltip-content" }), i)), o = new y([n, r], { classes: "ML__tooltip-container" });
    return this.caret && (o.caret = this.caret), this.bind(e, o);
  }
};
function ml(t33) {
  return { up: "italic", bold: "bolditalic", italic: "italic", bolditalic: "bolditalic", "": "italic" }[t33 != null ? t33 : ""];
}
function Ur(t33) {
  return { up: "up", bold: "bold", italic: void 0, bolditalic: "bold", "": void 0 }[t33 != null ? t33 : ""];
}
g("mathtip", "{:auto}{:math}", { createAtom: (t33) => new Ht(u(m({}, t33), { body: M(t33.args[0]), tooltip: M(t33.args[1]), content: "math" })), serialize: (t33, e) => e.skipStyles ? t33.bodyToLatex(e) : `\\mathtip{${t33.bodyToLatex(e)}}{${p.serialize([t33.tooltip], u(m({}, e), { defaultMode: "math" }))}}` });
g("texttip", "{:auto}{:text}", { createAtom: (t33) => new Ht(u(m({}, t33), { body: M(t33.args[0]), tooltip: M(t33.args[1]), content: "text" })), serialize: (t33, e) => e.skipStyles ? t33.bodyToLatex(e) : `\\texttip{${t33.bodyToLatex(e)}}{${p.serialize([t33.tooltip], u(m({}, e), { defaultMode: "text" }))}}` });
g("error", "{:math}", { createAtom: (t33) => new p(u(m({}, t33), { body: M(t33.args[0]) })), serialize: (t33, e) => `\\error{${t33.bodyToLatex(e)}}`, render: (t33, e) => t33.createBox(e, { classes: "ML__error" }) });
g("ensuremath", "{:math}", { createAtom: (t33) => new p(u(m({}, t33), { body: M(t33.args[0]) })), serialize: (t33, e) => `${t33.command}{${t33.bodyToLatex(u(m({}, e), { defaultMode: "math" }))}}` });
g("color", "{:value}", { applyStyle: (t33, e, r, i) => {
  var n, o;
  return u(m({}, t33), { verbatimColor: (n = Q(r[0])) != null ? n : void 0, color: i.toColor((o = r[0]) != null ? o : { string: "red" }) });
} });
g("textcolor", "{:value}{content:auto*}", { applyStyle: (t33, e, r, i) => {
  var n, o;
  return u(m({}, t33), { verbatimColor: (n = Q(r[0])) != null ? n : void 0, color: i.toColor((o = r[0]) != null ? o : { string: "red" }) });
} });
g("boxed", "{content:math}", { createAtom: (t33) => new Ce(u(m({}, t33), { body: M(t33.args[0]), framecolor: { string: "black" } })) });
g("colorbox", "{:value}{:text*}", { applyStyle: (t33, e, r, i) => {
  var n, o;
  return u(m({}, t33), { verbatimBackgroundColor: (n = Q(r[0])) != null ? n : void 0, backgroundColor: i.toBackgroundColor((o = r[0]) != null ? o : { string: "yellow" }) });
} });
g("fcolorbox", "{frame-color:value}{background-color:value}{content:text}", { applyMode: "text", createAtom: (t33) => {
  var e, r;
  return new Ce(u(m({}, t33), { body: M(t33.args[2]), framecolor: (e = t33.args[0]) != null ? e : { string: "blue" }, backgroundcolor: (r = t33.args[1]) != null ? r : { string: "yellow" } }));
}, serialize: (t33, e) => {
  var r, i;
  return e.skipStyles ? t33.bodyToLatex(u(m({}, e), { defaultMode: "text" })) : F(t33.command, (r = Q(t33.framecolor)) != null ? r : "", (i = Q(t33.backgroundcolor)) != null ? i : "", t33.bodyToLatex(u(m({}, e), { defaultMode: "text" })));
} });
g("bbox", "[:bbox]{body:auto}", { createAtom: (t33) => {
  var i;
  let e = t33.args[0], r = M(t33.args[1]);
  return e ? new Ce(u(m({}, t33), { body: r, padding: e.padding, border: e.border, backgroundcolor: (i = e.backgroundcolor) != null ? i : void 0 })) : new Ce(u(m({}, t33), { body: r }));
}, serialize: (t33, e) => {
  var i, n;
  if (e.skipStyles) return t33.bodyToLatex(e);
  let r = t33.command;
  if (Number.isFinite(t33.padding) || t33.border !== void 0 || t33.backgroundcolor !== void 0) {
    let o = [];
    t33.padding && o.push((i = Q(t33.padding)) != null ? i : ""), t33.border && o.push(`border: ${t33.border}`), t33.backgroundcolor && o.push((n = Q(t33.backgroundcolor)) != null ? n : ""), r += `[${o.join(",")}]`;
  }
  return F(r, t33.bodyToLatex(e));
} });
g(["displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle"], "{:rest}", { createAtom: (t33) => new p(u(m({}, t33), { body: M(t33.args[0]) })), render: (t33, e) => {
  let r = new z({ parent: e, mathstyle: t33.command.slice(1) }, t33.style), i = p.createBox(r, t33.body, { type: "lift" });
  return t33.caret && (i.caret = t33.caret), t33.bind(e, i);
}, serialize: (t33, e) => e.skipStyles ? t33.bodyToLatex(e) : `{${D([t33.command, t33.bodyToLatex(e)])}}` });
g(["tiny", "scriptsize", "footnotesize", "small", "normalsize", "large", "Large", "LARGE", "huge", "Huge"], "", { applyStyle: (t33, e) => u(m({}, t33), { fontSize: { "\\tiny": 1, "\\scriptsize": 2, "\\footnotesize": 3, "\\small": 4, "\\normalsize": 5, "\\large": 6, "\\Large": 7, "\\LARGE": 8, "\\huge": 9, "\\Huge": 10 }[e] }) });
g("fontseries", "{:string}", { ifMode: "text", applyStyle: (t33, e, r) => {
  var i;
  return u(m({}, t33), { fontSeries: (i = r[0]) != null ? i : "auto" });
} });
g("fontshape", "{:string}", { ifMode: "text", applyStyle: (t33, e, r) => {
  var i;
  return u(m({}, t33), { fontShape: (i = r[0]) != null ? i : "auto" });
} });
g("fontfamily", "{:string}", { ifMode: "text", applyStyle: (t33, e, r) => {
  var i;
  return u(m({}, t33), { fontFamily: (i = r[0]) != null ? i : "roman" });
} });
g("selectfont", "", { ifMode: "text", applyStyle: (t33) => t33 });
g("bf", "{:rest*}", { applyStyle: (t33) => u(m({}, t33), { fontSeries: "b", fontShape: "n", fontFamily: "roman" }) });
g(["boldsymbol", "bm", "bold"], "{:math*}", { applyMode: "math", applyStyle: (t33) => u(m({}, t33), { variantStyle: "bold" }) });
g("bfseries", "{:rest*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontSeries: "b" }) });
g("mdseries", "{:rest*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontSeries: "m" }) });
g("upshape", "{:rest*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontShape: "n" }) });
g("slshape", "{:rest*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontShape: "sl" }) });
g("scshape", "{:rest*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontShape: "sc" }) });
g("textbf", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontSeries: "b" }) });
g("textmd", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontSeries: "m" }) });
g("textup", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontShape: "n" }) });
g("textnormal", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontShape: "n", fontSeries: "m" }) });
g("textsl", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontShape: "sl" }) });
g("textit", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontShape: "it" }) });
g("textsc", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontShape: "sc" }) });
g("textrm", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontFamily: "roman" }) });
g("textsf", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontFamily: "sans-serif" }) });
g("texttt", "{:text*}", { applyMode: "text", applyStyle: (t33) => u(m({}, t33), { fontFamily: "monospace" }) });
g("mathbf", "{:math*}", { applyMode: "math", applyStyle: (t33) => u(m({}, t33), { variant: "normal", variantStyle: "bold" }) });
g("mathit", "{:math*}", { applyMode: "math", applyStyle: (t33) => u(m({}, t33), { variant: "main", variantStyle: "italic" }) });
g("mathnormal", "{:math*}", { applyMode: "math", applyStyle: (t33) => u(m({}, t33), { variant: "normal", variantStyle: "italic" }) });
g("mathbfit", "{:math*}", { applyMode: "math", applyStyle: (t33) => u(m({}, t33), { variant: "main", variantStyle: "bolditalic" }) });
g("mathrm", "{:math*}", { applyMode: "math", applyStyle: (t33) => u(m({}, t33), { variant: "normal", variantStyle: "up" }) });
g("mathsf", "{:math*}", { applyMode: "math", applyStyle: (t33) => u(m({}, t33), { variant: "sans-serif", variantStyle: "up" }) });
g("mathtt", "{:math*}", { applyMode: "math", applyStyle: (t33) => u(m({}, t33), { variant: "monospace", variantStyle: "up" }) });
g("it", "{:rest*}", { applyStyle: (t33) => u(m({}, t33), { fontSeries: "m", fontShape: "it", fontFamily: "roman", variantStyle: "italic" }) });
g("rmfamily", "{:rest*}", { applyStyle: (t33) => u(m({}, t33), { fontFamily: "roman" }) });
g("sffamily", "{:rest*}", { applyStyle: (t33) => u(m({}, t33), { fontFamily: "sans-serif" }) });
g("ttfamily", "{:rest*}", { applyStyle: (t33) => u(m({}, t33), { fontFamily: "monospace" }) });
g(["Bbb", "mathbb"], "{:math*}", { applyStyle: (t33) => u(m({}, t33), { variant: "double-struck", variantStyle: Ur(t33.variantStyle) }) });
g(["frak", "mathfrak"], "{:math*}", { applyStyle: (t33) => u(m({}, t33), { variant: "fraktur", variantStyle: Ur(t33.variantStyle) }) });
g("mathcal", "{:math*}", { applyStyle: (t33) => u(m({}, t33), { variant: "calligraphic", variantStyle: Ur(t33.variantStyle) }) });
g("mathscr", "{:math*}", { applyStyle: (t33) => u(m({}, t33), { variant: "script", variantStyle: Ur(t33.variantStyle) }) });
g("mbox", "{:text}", { ifMode: "math", createAtom: (t33) => new p(u(m({}, t33), { type: "mord", body: M(t33.args[0]), mode: "math" })), serialize: (t33, e) => F("\\mbox", t33.bodyToLatex(u(m({}, e), { defaultMode: "text" }))) });
g("text", "{:text}", { ifMode: "math", applyMode: "text" });
g(["class", "htmlClass"], "{name:string}{content:auto*}", { createAtom: (t33) => new p(u(m({}, t33), { type: "mord", body: M(t33.args[1]) })), serialize: (t33, e) => !t33.args[0] || e.skipStyles ? t33.bodyToLatex(e) : `${t33.command}{${t33.args[0]}}{${t33.bodyToLatex(e)}}`, render: (t33, e) => {
  var r;
  return t33.createBox(e, { classes: (r = t33.args[0]) != null ? r : "", boxType: "lift" });
} });
g(["cssId", "htmlId"], "{id:string}{content:auto*}", { createAtom: (t33) => new p(u(m({}, t33), { type: "mord", body: M(t33.args[1]) })), serialize: (t33, e) => {
  var r;
  return !((r = t33.args) != null && r[0]) || e.skipStyles ? t33.bodyToLatex(e) : `${t33.command}{${t33.args[0]}}{${t33.bodyToLatex(e)}}`;
}, render: (t33, e) => {
  var i;
  let r = t33.createBox(e);
  return r.cssId = (i = t33.args[0]) != null ? i : "", r;
} });
g("htmlData", "{data:string}{content:auto*}", { createAtom: (t33) => new p(u(m({}, t33), { type: "mord", body: M(t33.args[1]) })), serialize: (t33, e) => {
  var r;
  return !((r = t33.args) != null && r[0]) || e.skipStyles ? t33.bodyToLatex(e) : `\\htmlData{${t33.args[0]}}{${t33.bodyToLatex(e)}}`;
}, render: (t33, e) => {
  var i;
  let r = t33.createBox(e);
  return r.htmlData = (i = t33.args[0]) != null ? i : "", r;
} });
g(["style", "htmlStyle"], "{data:string}{content:auto*}", { createAtom: (t33) => new p(u(m({}, t33), { type: "mord", body: M(t33.args[1]) })), serialize: (t33, e) => {
  var r;
  return !((r = t33.args) != null && r[0]) || e.skipStyles ? t33.bodyToLatex(e) : `${t33.command}{${t33.args[0]}}{${t33.bodyToLatex(e)}}`;
}, render: (t33, e) => {
  var i;
  let r = t33.createBox(e);
  return r.htmlStyle = (i = t33.args[0]) != null ? i : "", r;
} });
g("href", "{url:string}{content:auto*}", { createAtom: (t33) => new p(u(m({}, t33), { type: "mord", body: M(t33.args[1]) })), render: (t33, e) => {
  var n;
  let r = t33.createBox(e), i = (n = t33.args[0]) != null ? n : "";
  return i && (r.htmlData = `href=${i}`), r;
} });
g("em", "{:rest}", { createAtom: (t33) => new p(u(m({}, t33), { body: M(t33.args[0]) })), serialize: (t33, e) => e.skipStyles ? t33.bodyToLatex(e) : `{\\em ${t33.bodyToLatex(e)}}`, render: (t33, e) => t33.createBox(e, { classes: "ML__emph", boxType: "lift" }) });
g("emph", "{:auto}", { createAtom: (t33) => new p(u(m({}, t33), { body: M(t33.args[1]) })), serialize: (t33, e) => e.skipStyles ? t33.bodyToLatex(e) : `\\emph{${t33.bodyToLatex(e)}}`, render: (t33, e) => t33.createBox(e, { classes: "ML__emph", boxType: "lift" }) });
var ul = { "\\bigl": { mclass: "mopen", size: 1 }, "\\Bigl": { mclass: "mopen", size: 2 }, "\\biggl": { mclass: "mopen", size: 3 }, "\\Biggl": { mclass: "mopen", size: 4 }, "\\bigr": { mclass: "mclose", size: 1 }, "\\Bigr": { mclass: "mclose", size: 2 }, "\\biggr": { mclass: "mclose", size: 3 }, "\\Biggr": { mclass: "mclose", size: 4 }, "\\bigm": { mclass: "mrel", size: 1 }, "\\Bigm": { mclass: "mrel", size: 2 }, "\\biggm": { mclass: "mrel", size: 3 }, "\\Biggm": { mclass: "mrel", size: 4 }, "\\big": { mclass: "mord", size: 1 }, "\\Big": { mclass: "mord", size: 2 }, "\\bigg": { mclass: "mord", size: 3 }, "\\Bigg": { mclass: "mord", size: 4 } };
g(["bigl", "Bigl", "biggl", "Biggl", "bigr", "Bigr", "biggr", "Biggr", "bigm", "Bigm", "biggm", "Biggm", "big", "Big", "bigg", "Bigg"], "{:delim}", { createAtom: (t33) => {
  var e;
  return new hr(u(m({}, t33), { delim: (e = t33.args[0]) != null ? e : ".", size: ul[t33.command].size, delimType: ul[t33.command].mclass }));
}, serialize: (t33, e) => D([t33.command, /^[a-zA-Z]/.test(t33.value) ? `{${t33.value}}` : t33.value]) });
g(["hspace", "hspace*"], "{width:value}", { createAtom: (t33) => {
  var e;
  return new je(u(m({}, t33), { width: (e = t33.args[0]) != null ? e : { dimension: 0 } }));
} });
g(["mkern", "kern", "mskip", "hskip", "mspace"], "{width:value}", { createAtom: (t33) => {
  var e;
  return new je(u(m({}, t33), { width: (e = t33.args[0]) != null ? e : { dimension: 0 } }));
} });
g("mathchoice", "{:math}{:math}{:math}{:math}", { createAtom: (t33) => new p(t33), render: (t33, e) => {
  let r = 0, i = e.mathstyle.id;
  (i === Nr || i === vt) && (r = 1), (i === Pt || i === ye) && (r = 2), (i === St || i === ce) && (r = 3);
  let n = M(t33.args[r]);
  return p.createBox(e, n);
}, serialize: (t33, e) => `\\mathchoice{${p.serialize(t33.args[0], e)}}{${p.serialize(t33.args[1], e)}}{${p.serialize(t33.args[2], e)}}{${p.serialize(t33.args[3], e)}}` });
g("mathop", "{:auto}", { createAtom: (t33) => new p(u(m({}, t33), { type: "mop", body: M(t33.args[0]), limits: "over-under", isFunction: true, captureSelection: true })), render: (t33, e) => {
  var i;
  let r = p.createBox(e, t33.body);
  if (t33.superscript || t33.subscript) {
    let n = (i = t33.subsupPlacement) != null ? i : "auto";
    r = n === "over-under" || n === "auto" && e.isDisplayStyle ? t33.attachLimits(e, { base: r }) : t33.attachSupsub(e, { base: r });
  }
  return t33.caret && (r.caret = t33.caret), new y(t33.bind(e, r), { type: "op", isSelected: t33.isSelected, classes: "ML__op-group" });
}, serialize: (t33, e) => {
  let r = [F(t33.command, t33.bodyToLatex(e))];
  return t33.explicitSubsupPlacement && (t33.subsupPlacement === "over-under" && r.push("\\limits"), t33.subsupPlacement === "adjacent" && r.push("\\nolimits"), t33.subsupPlacement === "auto" && r.push("\\displaylimits")), r.push(t33.supsubToLatex(e)), D(r);
} });
g(["mathbin", "mathrel", "mathopen", "mathclose", "mathpunct", "mathord", "mathinner"], "{:auto}", { createAtom: (t33) => new p(u(m({}, t33), { type: { "\\mathbin": "mbin", "\\mathrel": "mrel", "\\mathopen": "mopen", "\\mathclose": "mclose", "\\mathpunct": "mpunct", "\\mathord": "mord", "\\mathinner": "minner" }[t33.command], body: M(t33.args[0]) })) });
g(["operatorname", "operatorname*"], "{operator:math}", { createAtom: (t33) => {
  let e = M(t33.args[0]).map((r) => {
    var i;
    return r.type !== "first" && (r.type = "mord", r.value = (i = { "\u2217": "*", "\u2212": "-" }[r.value]) != null ? i : r.value, r.isFunction = false, !r.style.variant && !r.style.variantStyle && (r.style.variant = "main", r.style.variantStyle = "up")), r;
  });
  return new p(u(m({}, t33), { type: "mop", body: e, isFunction: true, limits: t33.command === "\\operatorname" ? "adjacent" : "over-under" }));
}, render: (t33, e) => {
  var i;
  let r = p.createBox(e, t33.body);
  if (t33.superscript || t33.subscript) {
    let n = (i = t33.subsupPlacement) != null ? i : "auto";
    r = n === "over-under" || n === "auto" && e.isDisplayStyle ? t33.attachLimits(e, { base: r }) : t33.attachSupsub(e, { base: r });
  }
  return t33.caret && (r.caret = t33.caret), new y(t33.bind(e, r), { type: "op", isSelected: t33.isSelected, classes: "ML__op-group" });
}, serialize: (t33, e) => {
  let r = [F(t33.command, t33.bodyToLatex(e))];
  return t33.explicitSubsupPlacement && (t33.subsupPlacement === "over-under" && r.push("\\limits"), t33.subsupPlacement === "adjacent" && r.push("\\nolimits"), t33.subsupPlacement === "auto" && r.push("\\displaylimits")), r.push(t33.supsubToLatex(e)), D(r);
} });
g(["char", "unicode"], "{charcode:value}", { createAtom: (t33) => new p(u(m({}, t33), { type: t33.mode === "text" ? "text" : "mord" })), serialize: (t33) => {
  var e;
  return `${t33.command}${Q((e = t33.args[0]) != null ? e : { number: 10067, base: "hexadecimal" })}`;
}, render: (t33, e) => {
  let r = e.evaluate(t33.args[0]);
  return (!r || !("number" in r)) && (r = { number: 10067, base: "hexadecimal" }), t33.value = String.fromCodePoint(r.number), t33.createBox(e);
} });
g("rule", "[raise:value]{width:value}{thickness:value}", { createAtom: (t33) => new p(t33), render: (t33, e) => {
  var s, l, c;
  let r = new z({ parent: e, mathstyle: "textstyle" }, t33.style), i = r.toEm((s = t33.args[0]) != null ? s : { dimension: 0 }), n = r.toEm((l = t33.args[1]) != null ? l : { dimension: 10 }), o = r.toEm((c = t33.args[2]) != null ? c : { dimension: 10 }), a = new y(null, { classes: "ML__rule", type: "ord" });
  return a.width = n, a.height = o + i, a.depth = -i, a.setStyle("border-right-width", n, "em"), a.setStyle("border-top-width", o, "em"), a.setStyle("border-color", t33.style.color), a.setStyle("vertical-align", i, "em"), t33.isSelected && a.setStyle("opacity", "50%"), t33.bind(r, a), t33.caret && (a.caret = t33.caret), a.wrap(e);
}, serialize: (t33) => `\\rule${t33.args[0] ? `[${Q(t33.args[0])}]` : ""}{${Q(t33.args[1])}}{${Q(t33.args[2])}}` });
g(["overline", "underline"], "{:auto}", { createAtom: (t33) => new p(u(m({}, t33), { body: M(t33.args[0]) })), render: (t33, e) => {
  let r = t33.command.substring(1), i = new z({ parent: e, mathstyle: "cramp" }, t33.style), n = p.createBox(i, t33.body);
  if (!n) return null;
  let o = i.metrics.defaultRuleThickness / i.scalingFactor, a = new y(null, { classes: r + "-line" });
  a.height = o, a.maxFontSize = o * 1.125 * i.scalingFactor;
  let s;
  return r === "overline" ? s = new V({ shift: 0, children: [{ box: n }, 3 * o, { box: a }, o] }) : s = new V({ top: n.height, children: [o, { box: a }, 3 * o, { box: n }] }), t33.caret && (s.caret = t33.caret), new y(s, { classes: r, type: "ignore" });
} });
g("overset", "{:auto}{base:auto}", { createAtom: (t33) => {
  let e = M(t33.args[1]);
  return new se(u(m({}, t33), { above: M(t33.args[0]), body: e, skipBoundary: false, boxType: Ft(e) }));
}, serialize: (t33, e) => F(t33.command, t33.aboveToLatex(e), t33.bodyToLatex(e)) });
g("underset", "{:auto}{base:auto}", { createAtom: (t33) => {
  let e = M(t33.args[1]);
  return new se(u(m({}, t33), { below: M(t33.args[0]), body: e, skipBoundary: false, boxType: Ft(e) }));
}, serialize: (t33, e) => F(t33.command, t33.belowToLatex(e), t33.bodyToLatex(e)) });
g("overunderset", "{above:auto}{below:auto}{base:auto}", { createAtom: (t33) => {
  let e = M(t33.args[2]);
  return new se(u(m({}, t33), { above: M(t33.args[0]), below: M(t33.args[1]), body: e, skipBoundary: false, boxType: Ft(e) }));
}, serialize: (t33, e) => F(t33.command, t33.belowToLatex(e), t33.bodyToLatex(e)) });
g(["stackrel", "stackbin"], "[below:auto]{above:auto}{base:auto}", { createAtom: (t33) => new se(u(m({}, t33), { body: M(t33.args[2]), above: M(t33.args[1]), below: M(t33.args[0]), skipBoundary: false, boxType: t33.command === "\\stackrel" ? "rel" : "bin" })), serialize: (t33, e) => F(t33.command, t33.aboveToLatex(e), t33.bodyToLatex(e)) });
g("smash", "[:string]{:auto}", { createAtom: (t33) => {
  var e, r, i, n;
  return new Ze(u(m({}, t33), { body: M(t33.args[1]), smashHeight: (r = (e = t33.args[0]) == null ? void 0 : e.includes("t")) != null ? r : true, smashDepth: (n = (i = t33.args[0]) == null ? void 0 : i.includes("b")) != null ? n : true }));
} });
g("vphantom", "{:auto}", { createAtom: (t33) => new Ze(u(m({}, t33), { body: M(t33.args[0]), isInvisible: true, smashWidth: true })) });
g("hphantom", "{:auto}", { createAtom: (t33) => new Ze(u(m({}, t33), { body: M(t33.args[0]), isInvisible: true, smashHeight: true, smashDepth: true })) });
g("phantom", "{:auto}", { createAtom: (t33) => new Ze(u(m({}, t33), { body: M(t33.args[0]), isInvisible: true })) });
g("mathstrut", "", { createAtom: (t33) => new Ze(u(m({}, t33), { body: [new p({ value: "(" })], isInvisible: true })) });
g("not", "{:math}", { createAtom: (t33) => {
  let e = M(t33.args[0]);
  return e.length === 0 ? new p(u(m({}, t33), { type: "mrel", value: "\uE020" })) : new p(u(m({}, t33), { body: [new Oe(u(m({}, t33), { body: "\uE020", align: "right" })), ...e], captureSelection: true }));
}, serialize: (t33, e) => {
  let r = t33.args[0], i = r && typeof r == "object" && "group" in r;
  return t33.value !== "\uE020" ? i ? `\\not{${p.serialize(r.group, e)}}` : `\\not${p.serialize(r, e)}` : i ? "\\not{}" : "\\not";
}, render: (t33, e) => {
  if (t33.value) return t33.createBox(e);
  let i = t33.args[0] && typeof t33.args[0] == "object" && "group" in t33.args[0] ? "ord" : Ft(M(t33.args[0])), n = p.createBox(e, t33.body, { type: i });
  return t33.caret && (n.caret = t33.caret), t33.bind(e, n);
} });
g(["ne", "neq"], "", { createAtom: (t33) => new p(u(m({}, t33), { type: "mrel", body: [new Oe(u(m({}, t33), { body: "\uE020", align: "right", boxType: "rel" })), new p(u(m({}, t33), { value: "=" }))], captureSelection: true })), serialize: (t33) => t33.command });
g("rlap", "{:auto}", { createAtom: (t33) => new Oe(u(m({}, t33), { body: M(t33.args[0]), align: "right" })) });
g("llap", "{:auto}", { createAtom: (t33) => new Oe(u(m({}, t33), { body: M(t33.args[0]), align: "left" })) });
g("mathrlap", "{:math}", { createAtom: (t33) => new Oe(u(m({}, t33), { body: M(t33.args[0]), align: "right" })) });
g("mathllap", "{:math}", { createAtom: (t33) => new Oe(u(m({}, t33), { body: M(t33.args[0]), align: "left" })) });
g("raisebox", "{:value}{:text}", { createAtom: (t33) => {
  var e;
  return new Ce(u(m({}, t33), { body: M(t33.args[1]), padding: { dimension: 0 }, offset: (e = t33.args[0]) != null ? e : { dimension: 0 } }));
}, serialize: (t33, e) => {
  var r;
  return F("\\raisebox", (r = Q(t33.offset)) != null ? r : "0pt", t33.bodyToLatex(e));
} });
g("raise", "{:value}{:auto}", { createAtom: (t33) => {
  var e;
  return new Ce(u(m({}, t33), { body: M(t33.args[1]), padding: { dimension: 0 }, offset: (e = t33.args[0]) != null ? e : { dimension: 0 } }));
}, serialize: (t33, e) => {
  var r;
  return F("\\raise", (r = Q(t33.offset)) != null ? r : "0pt", t33.bodyToLatex(e));
} });
g("lower", "{:value}{:auto}", { createAtom: (t33) => {
  var e;
  return new Ce(u(m({}, t33), { body: M(t33.args[1]), padding: { dimension: 0 }, offset: (e = $e(t33.args[0], -1)) != null ? e : { dimension: 0 } }));
}, serialize: (t33, e) => {
  var r, i;
  return F("\\lower", (i = Q($e((r = t33.offset) != null ? r : { dimension: 0 }, -1))) != null ? i : "0pt", t33.bodyToLatex(e));
} });
ie("0123456789/@.?!");
uo(65, 90);
uo(97, 122);
ie([["\\forall", 8704], ["\\exists", 8707], ["\\nexists", 8708, "mord", "ams"], ["\\mid", 8739, "mrel"], ["\\top", 8868], ["\\bot", 8869]]);
ie([["\\#", 35], ["\\&", 38], ["\\parallelogram", 9649], ["\\spadesuit", 9824], ["\\heartsuit", 9825], ["\\diamondsuit", 9826], ["\\clubsuit", 9827], ["\\flat", 9837], ["\\natural", 9838], ["\\sharp", 9839]]);
ie([["\\backslash", 92], ["\\nabla", 8711], ["\\partial", 8706], ["\\ell", 8467], ["\\hbar", 8463], ["\\pounds", 163], ["\\euro", 8364]]);
ie([["\\rightarrow", 8594], ["\\to", 8594], ["\\leftarrow", 8592], ["\\gets", 8592], ["\\Rightarrow", 8658], ["\\Leftarrow", 8656], ["\\longrightarrow", 10230], ["\\longleftarrow", 10229], ["\\Longrightarrow", 10233], ["\\implies", 10233], ["\\Longleftarrow", 10232], ["\\impliedby", 10232], ["\\longleftrightarrow", 10231], ["\\biconditional", 10231], ["\\Longleftrightarrow", 10234], ["\\mapsto", 8614], ["\\longmapsto", 10236], ["\\uparrow", 8593], ["\\downarrow", 8595], ["\\Uparrow", 8657], ["\\Downarrow", 8659], ["\\updownarrow", 8597], ["\\Updownarrow", 8661], ["\\hookrightarrow", 8618], ["\\hookleftarrow", 8617], ["\\rightharpoonup", 8640], ["\\leftharpoonup", 8636], ["\\rightharpoondown", 8641], ["\\leftharpoondown", 8637], ["\\searrow", 8600], ["\\nearrow", 8599], ["\\swarrow", 8601], ["\\nwarrow", 8598], ["\\originalof", 8886], ["\\laplace", 8886], ["\\imageof", 8887], ["\\Laplace", 8887]], "mrel");
ie([["\\mapsfrom", 8612, "mrel"], ["\\Mapsfrom", 10502, "mrel"], ["\\MapsTo", 10503, "mrel"], ["\\Yup", 8516, "mord"], ["\\lightning", 8623, "mrel"], ["\\leftarrowtriangle", 8701, "mrel"], ["\\rightarrowtriangle", 8702, "mrel"], ["\\leftrightarrowtriangle", 8703, "mrel"], ["\\boxdot", 8865, "mbin"], ["\\bigtriangleup", 9651, "mbin"], ["\\bigtriangledown", 9661, "mbin"], ["\\boxbar", 9707, "mbin"], ["\\Lbag", 10181, "mopen"], ["\\Rbag", 10182, "mclose"], ["\\llbracket", 10214, "mopen"], ["\\rrbracket", 10215, "mclose"], ["\\longmapsfrom", 10235, "mrel"], ["\\Longmapsfrom", 10237, "mrel"], ["\\Longmapsto", 10238, "mrel"], ["\\boxslash", 10692, "mbin"], ["\\boxbslash", 10693, "mbin"], ["\\boxast", 10694, "mbin"], ["\\boxcircle", 10695, "mbin"], ["\\boxbox", 10696, "mbin"], ["\\fatsemi", 10783, "mop"], ["\\leftslice", 10918, "mrel"], ["\\rightslice", 10919, "mrel"], ["\\interleave", 10996, "mbin"], ["\\biginterleave", 11004, "mop"], ["\\sslash", 11005, "mbin"], ["\\talloblong", 11006, "mbin"]]);
ie([["\\lbrace", 123, "mopen"], ["\\rbrace", 125, "mclose"], ["\\lparen", 40, "mopen"], ["\\rparen", 41, "mclose"], ["\\langle", 10216, "mopen"], ["\\rangle", 10217, "mclose"], ["\\lfloor", 8970, "mopen"], ["\\rfloor", 8971, "mclose"], ["\\lceil", 8968, "mopen"], ["\\rceil", 8969, "mclose"], ["\\vert", 8739], ["\\lvert", 8739, "mopen"], ["\\rvert", 8739, "mclose"], ["\\|", 8741], ["\\Vert", 8741], ["\\mVert", 8741], ["\\lVert", 8741, "mopen"], ["\\rVert", 8741, "mclose"], ["\\lbrack", 91, "mopen"], ["\\rbrack", 93, "mclose"], ["\\{", 123, "mopen"], ["\\}", 125, "mclose"], ["(", 40, "mopen"], [")", 41, "mclose"], ["[", 91, "mopen"], ["]", 93, "mclose"], ["\\ulcorner", 9484, "mopen", "ams"], ["\\urcorner", 9488, "mclose", "ams"], ["\\llcorner", 9492, "mopen", "ams"], ["\\lrcorner", 9496, "mclose", "ams"], ["\\lgroup", 10222, "mopen"], ["\\rgroup", 10223, "mclose"], ["\\lmoustache", 9136, "mopen"], ["\\rmoustache", 9137, "mclose"]]);
ie([["\\dashrightarrow", 8674], ["\\dashleftarrow", 8672], ["\\Rrightarrow", 8667], ["\\Lleftarrow", 8666], ["\\leftrightarrows", 8646], ["\\rightleftarrows", 8644], ["\\curvearrowright", 8631], ["\\curvearrowleft", 8630], ["\\rightrightarrows", 8649], ["\\leftleftarrows", 8647], ["\\upuparrows", 8648], ["\\downdownarrows", 8650], ["\\vartriangle", 9651], ["\\triangleq", 8796], ["\\vartriangleleft", 8882], ["\\trianglelefteq", 8884], ["\\ntriangleleft", 8938], ["\\ntrianglelefteq", 8940], ["\\vartriangleright", 8883], ["\\trianglerighteq", 8885], ["\\ntriangleright", 8939], ["\\ntrianglerighteq", 8941], ["\\blacktriangleleft", 9664], ["\\blacktriangleright", 9654], ["\\leftarrowtail", 8610], ["\\rightarrowtail", 8611], ["\\looparrowright", 8620], ["\\looparrowleft", 8619], ["\\twoheadleftarrow", 8606], ["\\twoheadrightarrow", 8608], ["\\twoheadrightarrowtail", 10518], ["\\rightleftharpoons", 8652], ["\\leftrightharpoons", 8651], ["\\Rsh", 8625], ["\\Lsh", 8624], ["\\circlearrowright", 8635], ["\\circlearrowleft", 8634], ["\\restriction", 8638], ["\\upharpoonright", 8638], ["\\upharpoonleft", 8639], ["\\downharpoonright", 8642], ["\\downharpoonleft", 8643], ["\\rightsquigarrow", 8669], ["\\leadsto", 8669], ["\\leftrightsquigarrow", 8621], ["\\multimap", 8888], ["\\nleftarrow", 8602], ["\\nrightarrow", 8603], ["\\nRightarrow", 8655], ["\\nLeftarrow", 8653], ["\\nleftrightarrow", 8622], ["\\nLeftrightarrow", 8654], ["\\nvrightarrow", 8696], ["\\nvtwoheadrightarrow", 10496], ["\\nvrightarrowtail", 10516], ["\\nvtwoheadrightarrowtail", 10519], ["\\shortparallel", 8741], ["\\nless", 8814], ["\\nleqslant", 57360], ["\\lneq", 10887], ["\\lneqq", 8808], ["\\nleqq", 57361], ["\\lvertneqq", 57356], ["\\lnsim", 8934], ["\\lnapprox", 10889], ["\\nprec", 8832], ["\\npreceq", 8928], ["\\precnsim", 8936], ["\\precnapprox", 10937], ["\\nsim", 8769], ["\\nshortmid", 57350], ["\\nmid", 8740], ["\\nvdash", 8876], ["\\nvDash", 8877], ["\\ngtr", 8815], ["\\ngeqslant", 57359], ["\\ngeqq", 57358], ["\\gneq", 10888], ["\\gneqq", 8809], ["\\gvertneqq", 57357], ["\\gnsim", 8935], ["\\gnapprox", 10890], ["\\nsucc", 8833], ["\\nsucceq", 8929], ["\\succnsim", 8937], ["\\succnapprox", 10938], ["\\ncong", 8774], ["\\nshortparallel", 57351], ["\\nparallel", 8742], ["\\nVDash", 8879], ["\\nsupseteqq", 57368], ["\\supsetneq", 8843], ["\\varsupsetneq", 57371], ["\\supsetneqq", 10956], ["\\varsupsetneqq", 57369], ["\\nVdash", 8878], ["\\precneqq", 10933], ["\\succneqq", 10934], ["\\nsubseteqq", 57366], ["\\leqslant", 10877], ["\\geqslant", 10878], ["\\gtrsim", 8819], ["\\approxeq", 8778], ["\\thickapprox", 8776], ["\\lessapprox", 10885], ["\\gtrapprox", 10886], ["\\precapprox", 10935], ["\\succapprox", 10936], ["\\thicksim", 8764], ["\\succsim", 8831], ["\\precsim", 8830], ["\\backsim", 8765], ["\\eqsim", 8770], ["\\backsimeq", 8909], ["\\lesssim", 8818], ["\\nleq", 8816], ["\\ngeq", 8817], ["\\smallsmile", 8995], ["\\smallfrown", 8994], ["\\leqq", 8806], ["\\eqslantless", 10901], ["\\lll", 8920], ["\\lessgtr", 8822], ["\\lesseqgtr", 8922], ["\\lesseqqgtr", 10891], ["\\risingdotseq", 8787], ["\\fallingdotseq", 8786], ["\\subseteqq", 10949], ["\\Subset", 8912], ["\\sqsubset", 8847], ["\\preccurlyeq", 8828], ["\\curlyeqprec", 8926], ["\\vDash", 8872], ["\\Vvdash", 8874], ["\\bumpeq", 8783], ["\\Bumpeq", 8782], ["\\geqq", 8807], ["\\eqslantgtr", 10902], ["\\ggg", 8921], ["\\gtrless", 8823], ["\\gtreqless", 8923], ["\\gtreqqless", 10892], ["\\supseteqq", 10950], ["\\Supset", 8913], ["\\sqsupset", 8848], ["\\succcurlyeq", 8829], ["\\curlyeqsucc", 8927], ["\\Vdash", 8873], ["\\shortmid", 8739], ["\\between", 8812], ["\\pitchfork", 8916], ["\\varpropto", 8733], ["\\backepsilon", 8717], ["\\llless", 8920], ["\\gggtr", 8921], ["\\doteqdot", 8785], ["\\Doteq", 8785], ["\\eqcirc", 8790], ["\\circeq", 8791], ["\\therefore", 8756], ["\\because", 8757]], "mrel", "ams");
ie([["+", 43], ["-", 8722], ["\u2212", 8722], ["\\pm", 177], ["\\mp", 8723], ["*", 8727], ["\\times", 215], ["\\div", 247], ["\\divides", 8739], ["\\cdot", 8901], ["\\cap", 8745], ["\\cup", 8746], ["\\setminus", 8726], ["\\land", 8743], ["\\wedge", 8743], ["\\lor", 8744], ["\\vee", 8744], ["\\circ", 8728], ["\\bigcirc", 9711], ["\\bullet", 8729], ["\\oplus", 8853], ["\\ominus", 8854], ["\\otimes", 8855], ["\\odot", 8857], ["\\oslash", 8856], ["\\bigtriangleup", 9651], ["\\bigtriangledown", 9661], ["\\triangleleft", 9667], ["\\triangleright", 9657], ["\\And", 38], ["\\dagger", 8224], ["\\dag", 8224], ["\\ddag", 8225], ["\\ddagger", 8225], ["\\ast", 8727], ["\\star", 8902], ["\\bigstar", 9733], ["\\diamond", 8900]], "mbin");
ie([["\\lhd", 8882], ["\\rhd", 8883], ["\\lessdot", 8918], ["\\gtrdot", 8919], ["\\ltimes", 8905], ["\\rtimes", 8906], ["\\leftthreetimes", 8907], ["\\rightthreetimes", 8908], ["\\intercal", 8890], ["\\dotplus", 8724], ["\\doublebarwedge", 10846], ["\\divideontimes", 8903], ["\\centerdot", 8901], ["\\smallsetminus", 8726], ["\\barwedge", 8892], ["\\veebar", 8891], ["\\nor", 8891], ["\\curlywedge", 8911], ["\\curlyvee", 8910], ["\\boxminus", 8863], ["\\boxplus", 8862], ["\\boxtimes", 8864], ["\\boxdot", 8865], ["\\circleddash", 8861], ["\\circledast", 8859], ["\\circledcirc", 8858], ["\\unlhd", 8884], ["\\unrhd", 8885]], "mbin", "ams");
ie([["\\surd", 8730], ["\\S", 167], ["\\infty", 8734], ["\\prime", 8242], ["\\doubleprime", 8243], ["\\angle", 8736], ["`", 8216], ["\\$", 36], ["\\%", 37], ["\\_", 95], ["\\alpha", 945], ["\\beta", 946], ["\\gamma", 947], ["\\delta", 948], ["\\epsilon", 1013], ["\\varepsilon", 949], ["\\zeta", 950], ["\\eta", 951], ["\\theta", 952], ["\\vartheta", 977], ["\\iota", 953], ["\\kappa", 954], ["\\varkappa", 1008, "mord", "ams"], ["\\lambda", 955], ["\\mu", 956], ["\\nu", 957], ["\\xi", 958], ["\\omicron", 111], ["\\pi", 960], ["\\varpi", 982], ["\\rho", 961], ["\\varrho", 1009], ["\\sigma", 963], ["\\varsigma", 962], ["\\tau", 964], ["\\phi", 981], ["\\varphi", 966], ["\\upsilon", 965], ["\\chi", 967], ["\\psi", 968], ["\\omega", 969], ["\\Gamma", 915], ["\\Delta", 916], ["\\Theta", 920], ["\\Lambda", 923], ["\\Xi", 926], ["\\Pi", 928], ["\\Sigma", 931], ["\\Upsilon", 933], ["\\Phi", 934], ["\\Psi", 936], ["\\Omega", 937], ["\\digamma", 989, "mord", "ams"], ["\\varkappa", 1008, "mord", "ams"], ["\\coppa", 985, "mord", "ams"], ["\\koppa", 985, "mord", "ams"], ["\\Coppa", 984, "mord", "ams"], ["\\Koppa", 984, "mord", "ams"], ["\\sampi", 993, "mord", "ams"], ["\\Sampi", 992, "mord", "ams"], ["\\emptyset", 8709]]);
ie([["=", 61], ["<", 60], ["\\lt", 60], [">", 62], ["\\gt", 62], ["\\le", 8804], ["\\leq", 8804], ["\\ge", 8805], ["\\geq", 8805], ["\\ll", 8810], ["\\gg", 8811], ["\\coloneq", 8788], ["\\coloneqq", 8788], ["\\colonequals", 8788], ["\\measeq", 8797], ["\\eqdef", 8798], ["\\questeq", 8799], [":", 58], ["\\cong", 8773], ["\\equiv", 8801], ["\\prec", 8826], ["\\preceq", 10927], ["\\succ", 8827], ["\\succeq", 10928], ["\\perp", 10178], ["\\propto", 8733], ["\\Colon", 8759], ["\\smile", 8995], ["\\frown", 8994], ["\\sim", 8764], ["\\doteq", 8784], ["\\bowtie", 8904], ["\\Join", 8904], ["\\asymp", 8781], ["\\sqsubseteq", 8849], ["\\sqsupseteq", 8850], ["\\approx", 8776], ["\\~", 126], ["\\leftrightarrow", 8596], ["\\Leftrightarrow", 8660], ["\\models", 8872], ["\\vdash", 8866], ["\\dashv", 8867], ["\\roundimplies", 10608], ["\\in", 8712], ["\\notin", 8713], ["\\ni", 8715], ["\\owns", 8715], ["\\subset", 8834], ["\\supset", 8835], ["\\subseteq", 8838], ["\\supseteq", 8839], ["\\differencedelta", 8710], ["\\mvert", 8739], ["\\parallel", 8741], ["\\simeq", 8771]], "mrel");
ie([["\\lnot", 172], ["\\neg", 172], ["\\triangle", 9651], ["\\subsetneq", 8842], ["\\varsubsetneq", 57370], ["\\subsetneqq", 10955], ["\\varsubsetneqq", 57367], ["\\nsubset", 8836], ["\\nsupset", 8837], ["\\nsubseteq", 8840], ["\\nsupseteq", 8841]], "mrel", "ams");
ie([["\\wp", 8472], ["\\aleph", 8501]]);
ie([["\\blacktriangle", 9650], ["\\hslash", 8463], ["\\Finv", 8498], ["\\Game", 8513], ["\\eth", 240], ["\\mho", 8487], ["\\Bbbk", 107], ["\\yen", 165], ["\\square", 9633], ["\\Box", 9633], ["\\blacksquare", 9632], ["\\circledS", 9416], ["\\circledR", 174], ["\\triangledown", 9661], ["\\blacktriangledown", 9660], ["\\checkmark", 10003], ["\\diagup", 9585], ["\\measuredangle", 8737], ["\\sphericalangle", 8738], ["\\backprime", 8245], ["\\backdoubleprime", 8246], ["\\Diamond", 9674], ["\\lozenge", 9674], ["\\blacklozenge", 10731], ["\\varnothing", 8709], ["\\complement", 8705], ["\\maltese", 10016], ["\\beth", 8502], ["\\daleth", 8504], ["\\gimel", 8503]], "mord", "ams");
ie([["\\ ", 160], ["~", 160]], "space");
g(["!", ",", ":", ";", ">", "enskip", "enspace", "quad", "qquad"], "", { createAtom: (t33) => new je(t33) });
g("space", "", { createAtom: (t33) => new je(t33) });
ie([["\\colon", 58], ["\\cdotp", 8901], ["\\vdots", 8942, "mord"], ["\\ldotp", 46], [",", 44], [";", 59]], "mpunct");
ie([["\\cdots", 8943], ["\\ddots", 8945], ["\\ldots", 8230], ["\\mathellipsis", 8230]], "minner");
ie([["\\/", 47], ["|", 8739, "mord"], ["\\imath", 305], ["\\jmath", 567], ["\\degree", 176], ["'", 8242], ['"', 8221]]);
var fn = { main: ["Main-Regular", "ML__cmr"], "main-italic": ["Main-Italic", "ML__cmr ML__it"], "main-bold": ["Main-Bold", "ML__cmr ML__bold"], "main-bolditalic": ["Main-BoldItalic", "ML__cmr ML__bold ML__it"], normal: ["Main-Regular", "ML__cmr"], "normal-bold": ["Main-Bold", "ML__mathbf"], "normal-italic": ["Math-Italic", "ML__mathit"], "normal-bolditalic": ["Math-BoldItalic", "ML__mathbfit"], roman: ["Main-Regular", "ML__cmr"], "roman-bold": ["Main-Bold", "ML__mathbf"], "roman-italic": ["Math-Italic", "ML__mathit"], "roman-bolditalic": ["Math-BoldItalic", "ML__mathbfit"], ams: ["AMS-Regular", "ML__ams"], "ams-bold": ["AMS-Regular", "ML__ams ML__bold"], "ams-italic": ["AMS-Regular", "ML__ams ML__it"], "ams-bolditalic": ["AMS-Regular", "ML__ams ML__bold ML__it"], "sans-serif": ["SansSerif-Regular", "ML__sans"], "sans-serif-bold": ["SansSerif-Regular", "ML__sans ML__bold"], "sans-serif-italic": ["SansSerif-Regular", "ML__sans ML__it"], "sans-serif-bolditalic": ["SansSerif-Regular", "ML__sans ML__bold ML__it"], calligraphic: ["Caligraphic-Regular", "ML__cal"], "calligraphic-bold": ["Caligraphic-Regular", "ML__cal ML__bold"], "calligraphic-italic": ["Caligraphic-Regular", "ML__cal ML__it"], "calligraphic-bolditalic": ["Caligraphic-Regular", "ML__cal ML__bold ML__it"], script: ["Script-Regular", "ML__script"], "script-bold": ["Script-Regular", "ML__script ML__bold"], "script-italic": ["Script-Regular", "ML__script ML__it"], "script-bolditalic": ["Script-Regular", "ML__script ML__bold ML__it"], fraktur: ["Fraktur-Regular", "ML__frak"], "fraktur-bold": ["Fraktur-Regular", "ML__frak ML__bold"], "fraktur-italic": ["Fraktur-Regular", "ML__frak ML__it"], "fraktur-bolditalic": ["Fraktur-Regular", "ML__frak ML__bold ML__it"], monospace: ["Typewriter-Regular", "ML__tt"], "monospace-bold": ["Typewriter-Regular", "ML__tt ML__bold"], "monospace-italic": ["Typewriter-Regular", "ML__tt ML__it"], "monospace-bolditalic": ["Typewriter-Regular", "ML__tt ML__bold ML__it"], "double-struck": ["AMS-Regular", "ML__bb"], "double-struck-bold": ["AMS-Regular", "ML__bb ML__bold"], "double-struck-italic": ["AMS-Regular", "ML__bb ML_italic"], "double-struck-bolditalic": ["AMS-Regular", "ML__bb ML_bolditalic"] };
var Sl = { "double-struck": /^[A-Z ]$/, script: /^[A-Z ]$/, calligraphic: /^[\dA-Z ]$/, fraktur: /^[\dA-Za-z ]$|^[!"#$%&'()*+,\-./:;=?[]^’‘]$/, monospace: /^[\dA-Za-z ]$|^[!"&'()*+,\-./:;=?@[\]^_~\u0131\u0237\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A5\u03A8\u03A9]$/, "sans-serif": /^[\dA-Za-z ]$|^[!"&'()*+,\-./:;=?@[\]^_~\u0131\u0237\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A5\u03A8\u03A9]$/ };
var wl = /^[\u03B1-\u03C9]|\u03D1|\u03D5|\u03D6|\u03F1|\u03F5]$/;
var Nc = /^[\u0393|\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A5\u03A6\u03A8\u03A9]$/;
var Vc = [/^[a-z]$/, /^[A-Z]$/, wl, Nc];
var Jc = { iso: ["it", "it", "it", "it"], tex: ["it", "it", "it", "up"], french: ["it", "up", "up", "up"], upright: ["up", "up", "up", "up"] };
var Co = class extends Y {
  constructor() {
    super("math");
  }
  createAtom(e, r, i) {
    var a, s, l, c, h, d;
    if (r === null) return new p({ type: "mord", mode: "math", command: e, value: e, style: i });
    let n;
    try {
      n = (l = (s = globalThis.MathfieldElement) == null ? void 0 : s.isFunction((a = r.command) != null ? a : e)) != null ? l : false;
    } catch (f) {
      n = false;
    }
    if (r.definitionType === "symbol") {
      let f = new p({ type: (c = r.type) != null ? c : "mord", mode: "math", command: (h = r.command) != null ? h : e, value: String.fromCodePoint(r.codepoint), isFunction: n, style: i });
      return e.startsWith("\\") && (f.verbatimLatex = e), f;
    }
    let o = new p({ type: "mord", mode: "math", command: (d = r.command) != null ? d : e, value: e, isFunction: n, style: i });
    return e.startsWith("\\") && (o.verbatimLatex = e), o;
  }
  serialize(e, r) {
    let i = Hc(e, u(m({}, r), { defaultMode: "math" }));
    return i.length === 0 || r.defaultMode !== "text" ? i : ["$ ", ...i, " $"];
  }
  getFont(e, r) {
    var l, c, h;
    if (r.variant, r.fontFamily) {
      let d = r.fontFamily;
      r.fontSeries === "b" && r.fontShape === "it" ? d += "-bolditalic" : r.fontSeries === "b" ? d += "-bold" : r.fontShape === "it" && (d += "-italic");
      let f = (l = fn[d]) != null ? l : fn[r.fontFamily];
      if (!f) return console.error(`Unknown font family variant: ${d}`), null;
      let [S, x] = f;
      return x && (e.classes += " " + x), S;
    }
    let { variant: i } = r, { variantStyle: n } = r;
    if (i === "normal" && !n && /[\u00A3\u0131\u0237]/.test(e.value) && (i = "main", n = "italic"), i === "normal" && !n && e.value.length === 1) {
      let d = false;
      Vc.forEach((f, S) => {
        var x;
        f.test(e.value) && Jc[(x = r.letterShapeStyle) != null ? x : "tex"][S] === "it" && (d = true);
      }), d && (n = ml(n));
    }
    n === "up" && (n = void 0);
    let o = n ? i + "-" + n : i;
    fn[o];
    let [a, s] = fn[o];
    if (Sl[i] && !Sl[i].test(e.value)) {
      let d = Rr(e.value, i, n);
      return d || (d = (c = Rr(e.value, i)) != null ? c : e.value, e.classes += (h = { bold: " ML__bold", italic: " ML__it", "bold-italic": " ML__bold ML__it" }[n != null ? n : ""]) != null ? h : ""), e.value = d, null;
    }
    return wl.test(e.value) && (e.classes += " lcGreek"), s && (e.classes += " " + s), a;
  }
};
function Hc(t33, e) {
  return De(t33, "bold").map((r) => {
    if (ji(r[0]) !== "bold") return D(gn(r, e));
    if (ji(r[0].parent) === "bold") return D(gn(r, e));
    let n = D(r.map((o) => {
      var a;
      return (a = o.value) != null ? a : "";
    }));
    return /^[a-zA-Z0-9]+$/.test(n) ? F("\\mathbf", D(gn(r, e))) : F("\\bm", D(gn(r, e)));
  });
}
function gn(t33, e) {
  let { parent: r } = t33[0], i = Xi(r);
  return De(t33, "variant").map((n) => {
    let o = Xi(n[0]), a = "";
    o && o !== i && (a = { calligraphic: "\\mathcal", "calligraphic-uo": "\\mathcal", fraktur: "\\mathfrak", "fraktur-uo": "\\mathfrak", "double-struck": "\\mathbb", "double-struck-uo": "\\mathbb", script: "\\mathscr", "script-uo": "\\mathscr", monospace: "\\mathtt", "monospace-uo": "\\mathtt", "sans-serif": "\\mathsf", "sans-serif-uo": "\\mathsf", normal: "", "normal-up": "\\mathrm", "normal-italic": "\\mathnormal", "normal-bold": "", "normal-bolditalic": "\\mathbfit", ams: "", "ams-up": "\\mathrm", "ams-italic": "\\mathit", "ams-bold": "", "ams-bolditalic": "\\mathbfit", main: "", "main-up": "\\mathrm", "main-italic": "\\mathit", "main-bold": "", "main-bolditalic": "\\mathbfit" }[o]);
    let s = "", l = n[n.length - 1], c = a && n.length > 0 && (l.branch("subscript") !== void 0 || l.branch("superscript") !== void 0);
    c && (s = l.supsubToLatex(e));
    let h = D(n.map((d, f) => {
      if (c && f === n.length - 1) {
        let S = H(d.command, d.mode);
        return S != null && S.serialize ? S.serialize(d, e) : d.body && d.command ? F(d.command, d.bodyToLatex(e)) : d.body ? d.bodyToLatex(e) : !d.value || d.value === "\u200B" ? "" : d.command || d.value;
      }
      return d._serialize(e);
    }));
    return a ? F(a, h) + s : h;
  });
}
new Co();
function Gc(t33, e) {
  return t33.map((r) => r._serialize(e));
}
function Wc(t33, e) {
  return De(t33, "fontShape").map((r) => {
    let i = Gc(r, e), { fontShape: n } = r[0].style, o = "";
    return n === "it" && (o = "\\textit"), n === "sl" && (o = "\\textsl"), n === "sc" && (o = "\\textsc"), n === "n" && (o = "\\textup"), !o && n ? `{${F("\\fontshape", n)}${D(i)}}` : o ? F(o, D(i)) : D(i);
  });
}
function Uc(t33, e) {
  return De(t33, "fontSeries").map((r) => {
    let i = Wc(r, e), { fontSeries: n } = r[0].style, o = "";
    return n === "b" && (o = "\\textbf"), n === "l" && (o = "\\textlf"), n === "m" && (o = "\\textmd"), n && !o ? `{${F("\\fontseries", n)}${D(i)}}` : o ? F(o, D(i)) : D(i);
  });
}
function Zc(t33, e) {
  return De(t33, "fontSize").map((r) => {
    var o, a;
    let i = Uc(r, e), n = (a = ["", "\\tiny", "\\scriptsize", "\\footnotesize", "\\small", "\\normalsize", "\\large", "\\Large", "\\LARGE", "\\huge", "\\Huge"][(o = r[0].style.fontSize) != null ? o : ""]) != null ? a : "";
    return n ? `${n} ${D(i)}` : D(i);
  });
}
function jc(t33, e, r) {
  return De(t33, "fontFamily").map((i) => {
    var s;
    r = r && !i.every((l) => l.style.fontFamily || l.style.fontShape || l.style.fontSeries || l.style.fontSize);
    let n = Zc(i, e), { fontFamily: o } = i[0].style, a = (s = { roman: "textrm", monospace: "texttt", "sans-serif": "textsf" }[o != null ? o : ""]) != null ? s : "";
    return a ? `\\${a}{${D(n)}}` : o ? `{\\fontfamily{${i[0].style.fontFamily}} ${D(n)}}` : r ? `\\text{${D(n)}}` : D(n);
  });
}
var Ml = { roman: "", "sans-serif": "ML__sans", monospace: "ML__tt" };
var Lo = class extends Y {
  constructor() {
    super("text");
  }
  createAtom(e, r, i) {
    return r && r.definitionType === "symbol" ? new kt(e, String.fromCodePoint(r.codepoint), i != null ? i : {}) : null;
  }
  serialize(e, r) {
    return jc(e, u(m({}, r), { defaultMode: "text" }), r.defaultMode !== "text");
  }
  getFont(e, r) {
    var n, o, a, s, l;
    let { fontFamily: i } = r;
    if (Ml[i] ? e.classes += " " + Ml[i] : i && e.setStyle("font-family", i), r.fontShape && (e.classes += " ", e.classes += (n = { it: "ML__it", sl: "ML__shape_sl", sc: "ML__shape_sc", ol: "ML__shape_ol" }[r.fontShape]) != null ? n : ""), r.fontSeries) {
      let c = r.fontSeries.match(/(.?[lbm])?(.?[cx])?/);
      c && (e.classes += " ", e.classes += (a = { ul: "ML__series_ul", el: "ML__series_el", l: "ML__series_l", sl: "ML__series_sl", m: "", sb: "ML__series_sb", b: "ML__bold", eb: "ML__series_eb", ub: "ML__series_ub" }[(o = c[1]) != null ? o : ""]) != null ? a : "", e.classes += " ", e.classes += (l = { uc: "ML__series_uc", ec: "ML__series_ec", c: "ML__series_c", sc: "ML__series_sc", n: "", sx: "ML__series_sx", x: "ML__series_x", ex: "ML__series_ex", ux: "ML__series_ux" }[(s = c[2]) != null ? s : ""]) != null ? l : "");
    }
    return "Main-Regular";
  }
};
new Lo();
var Bo = class extends Y {
  constructor() {
    super("latex");
  }
  createAtom(e) {
    return new _t(e);
  }
  serialize(e, r) {
    return e.filter((i) => i instanceof _t && !i.isSuggestion).map((i) => i.value);
  }
  getFont() {
    return null;
  }
};
new Bo();
function m2(t33, e) {
  var h;
  let r = u(m({}, Vr()), { renderPlaceholder: () => new y(160, { maxFontSize: 1 }) });
  if (e != null && e.letterShapeStyle && (e == null ? void 0 : e.letterShapeStyle) !== "auto" && (r.letterShapeStyle = e.letterShapeStyle), e != null && e.macros) {
    let d = Fr(e == null ? void 0 : e.macros);
    r.getMacro = (f) => Pr(f, d);
  }
  e != null && e.registers && (r.registers = m(m({}, r.registers), e.registers));
  let i = (h = e == null ? void 0 : e.defaultMode) != null ? h : "math", n = "math", o = "displaystyle";
  i === "inline-math" ? o = "textstyle" : i === "math" ? o = "displaystyle" : i === "text" && (o = "textstyle", n = "text");
  let a = new z({ from: r }), l = new p({ type: "root", mode: n, body: nt(t33, { context: a, parseMode: n, mathstyle: o }) }).render(a);
  return l ? (Yi(un(l, a)), U0(l, { classes: "ML__latex" }).toMarkup()) : "";
}
function u2(t33, e) {
  let r = m({}, Vr());
  if (e != null && e.macros) {
    let i = Fr(e.macros);
    r.getMacro = (n) => Pr(n, i);
  }
  return cl(t33, { context: r });
}

// src/main.ts
var import_obsidian = require("obsidian");
var import_state3 = require("@codemirror/state");
var import_view = require("@codemirror/view");
var openEffect = import_state3.StateEffect.define();
var plugin;
var equationCache = /* @__PURE__ */ new WeakMap();
var closedCache = /* @__PURE__ */ new WeakMap();
function equationsFor(doc) {
  let result = equationCache.get(doc);
  if (!result) {
    result = equations(doc.toString());
    equationCache.set(doc, result);
  }
  return result;
}
function closedFor(doc) {
  let result = closedCache.get(doc);
  if (!result) {
    result = equationsFor(doc).filter((q) => hasClosedIntegral(q) && !u2(splitTag(q.body).latex).length);
    closedCache.set(doc, result);
  }
  return result;
}
var MathWidget = class extends import_view.WidgetType {
  constructor(session) {
    super();
    this.session = session;
  }
  eq(other) {
    return other.session.id === this.session.id;
  }
  toDOM(view) {
    return plugin.mount(view, this.session);
  }
  ignoreEvent() {
    return true;
  }
  destroy(dom) {
    dom.mathStudioCleanup?.();
  }
};
var sessionField = import_state3.StateField.define({
  create: () => null,
  update(value, tr2) {
    for (const e of tr2.effects) if (e.is(openEffect)) return e.value;
    if (value && tr2.docChanged) {
      let conflict = value.conflict;
      tr2.changes.iterChangedRanges((from2, to3) => {
        if (from2 < value.q.to && to3 > value.q.from || from2 === to3 && from2 > value.q.from && from2 < value.q.to) conflict = true;
      });
      const from = tr2.changes.mapPos(value.q.from, 1), to2 = tr2.changes.mapPos(value.q.to, -1);
      return { ...value, conflict, mount: { ...value.mount, at: tr2.changes.mapPos(value.mount.at, value.mount.side) }, q: { ...value.q, from, to: to2, bodyFrom: from + (value.q.display ? 2 : 1), bodyTo: to2 - (value.q.display ? 2 : 1) } };
    }
    return value;
  },
  provide: (field) => import_view.EditorView.decorations.from(field, (value) => value ? import_view.Decoration.set([import_view.Decoration.widget({ widget: new MathWidget(value), block: true, side: value.mount.side }).range(value.mount.at)]) : import_view.Decoration.none)
});
var EditButton = class extends import_view.WidgetType {
  constructor(from) {
    super();
    this.from = from;
  }
  eq(other) {
    return other.from === this.from;
  }
  toDOM(view) {
    const button = view.dom.ownerDocument.createElement("button");
    button.className = "math-studio-edit";
    button.textContent = "\u270E";
    button.title = "Edit equation visually";
    button.setAttribute("aria-label", "Edit equation visually");
    button.onmousedown = (e) => e.preventDefault();
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      plugin.start(view, this.from);
    };
    return button;
  }
  ignoreEvent() {
    return true;
  }
};
var controls = import_view.ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view;
    this.build();
    view.dom.addEventListener("mousedown", this.onMouse, true);
  }
  decorations = import_view.Decoration.none;
  onMouse = (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target.closest(".math-studio-host")) return;
    const math = target.closest(".math, mjx-container");
    if (!math || math.closest(".internal-embed,.markdown-embed,.kl-dynamic-reference,a") || this.view.state.field(sessionField, false)) return;
    try {
      const matched = calloutEquation(this.view, math, equationsFor(this.view.state.doc));
      if (matched === null) {
        event.preventDefault();
        event.stopImmediatePropagation();
        new import_obsidian.Notice("Couldn\u2019t identify this equation; open it from source.");
        return;
      }
      const at = matched?.from ?? this.view.posAtDOM(math);
      if (equationsFor(this.view.state.doc).some((q) => at >= q.from && at <= q.to)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        plugin.start(this.view, at);
      }
    } catch {
    }
  };
  build() {
    const state = this.view.state;
    if (!plugin?.settings.buttons || state.field(sessionField, false)) {
      this.decorations = import_view.Decoration.none;
      return;
    }
    const ranges = equationsFor(state.doc).filter((q) => this.view.visibleRanges.some((r) => q.to >= r.from && q.from <= r.to)).map((q) => import_view.Decoration.widget({ widget: new EditButton(q.from), side: 1 }).range(q.to));
    this.decorations = import_view.Decoration.set(ranges, true);
  }
  update(update) {
    if (update.docChanged || update.viewportChanged || update.transactions.some((t33) => t33.effects.some((e) => e.is(openEffect)))) this.build();
  }
  destroy() {
    this.view.dom.removeEventListener("mousedown", this.onMouse, true);
  }
}, { decorations: (x) => x.decorations });
var emphasisColors = import_view.ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view;
    this.ranges = this.index.scan(view.state.doc.toString(), equationsFor(view.state.doc));
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(view.contentDOM, { childList: true, subtree: true });
    this.schedule();
  }
  ranges;
  index = new EmphasisIndex();
  frame = 0;
  observer;
  schedule() {
    if (this.frame) return;
    this.frame = this.view.dom.ownerDocument.defaultView.requestAnimationFrame(() => {
      this.frame = 0;
      this.paint();
    });
  }
  update(u3) {
    if (u3.docChanged) this.ranges = this.index.scan(u3.state.doc.toString(), equationsFor(u3.state.doc));
    this.schedule();
  }
  paint() {
    for (const el2 of Array.from(this.view.contentDOM.querySelectorAll("span.math,span.math-studio-special"))) {
      if (el2.closest(".math-studio-host")) continue;
      let range;
      try {
        const at = this.view.posAtDOM(el2);
        range = this.ranges.find((q) => at >= q.from && at <= q.to);
      } catch {
      }
      el2.classList.toggle("math-studio-strong", !!range?.strong);
      el2.classList.toggle("math-studio-em", !!range?.em);
    }
  }
  destroy() {
    this.observer.disconnect();
    if (this.frame) this.view.dom.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
    for (const el2 of Array.from(this.view.contentDOM.querySelectorAll(".math-studio-strong,.math-studio-em"))) el2.classList.remove("math-studio-strong", "math-studio-em");
  }
});
var hasClosedIntegral = (q) => /\\oii?int(?![a-zA-Z])/.test(q.body);
function staticMarkup(q) {
  const { latex, tag } = splitTag(q.body);
  return m2(latex, { defaultMode: q.display ? "math" : "inline-math" }) + (tag.kind !== "none" ? `<span class="math-studio-tag">(${tag.label.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])})</span>` : "");
}
var IntegralWidget = class extends import_view.WidgetType {
  constructor(q) {
    super();
    this.q = q;
  }
  eq(o) {
    return o.q.raw === this.q.raw && o.q.from === this.q.from;
  }
  toDOM(view) {
    plugin.styleMath(view.dom.ownerDocument);
    const el2 = view.dom.ownerDocument.createElement(this.q.display ? "div" : "span");
    el2.className = "math-studio-special" + (this.q.display ? " math-studio-display" : "");
    el2.innerHTML = staticMarkup(this.q);
    el2.dataset.mathStudioLatex = this.q.body;
    el2.title = "Click to edit this equation visually";
    el2.setAttribute("role", "button");
    el2.setAttribute("aria-label", "Edit closed integral equation");
    el2.tabIndex = 0;
    el2.onclick = (e) => {
      e.preventDefault();
      plugin.start(view, this.q.from);
    };
    el2.onkeydown = (e) => {
      if (e.key === "Enter") plugin.start(view, this.q.from);
    };
    return el2;
  }
  ignoreEvent() {
    return true;
  }
};
var compatibilityField = import_state3.StateField.define({ create: () => import_view.Decoration.none, update(value, tr2) {
  if (!plugin.settings.closedIntegrals) return import_view.Decoration.none;
  if (!tr2.docChanged && !tr2.selection && !tr2.effects.length && value.size) return value;
  const head = tr2.state.selection.main.head;
  return import_view.Decoration.set(closedFor(tr2.state.doc).filter((q) => !(head >= q.from && head <= q.to)).map((q) => import_view.Decoration.replace({ widget: new IntegralWidget(q), block: q.display }).range(q.from, q.to)), true);
}, provide: (f) => import_view.EditorView.decorations.from(f) });
var MathStudio = class extends import_obsidian.Plugin {
  composeReferenceSource = composeSourceDraft;
  buildId = BUILD_ID;
  frameCode = "";
  mathCSS = "";
  fontCSS = "";
  styledDocs = /* @__PURE__ */ new Map();
  settings = { buttons: false, autoNumber: true, closedIntegrals: true };
  liveFrames = /* @__PURE__ */ new Set();
  async onload() {
    plugin = this;
    this.settings = { ...this.settings, ...await this.loadData() };
    this.frameCode = await this.app.vault.adapter.read(`${this.manifest.dir}/frame.js`);
    this.mathCSS = await this.app.vault.adapter.read(`${this.manifest.dir}/vendor/mathlive-static.css`);
    this.fontCSS = await this.app.vault.adapter.read(`${this.manifest.dir}/vendor/mathlive-fonts.css`);
    this.registerEditorExtension([sessionField, automaticNumbering({ enabled: () => this.settings.autoNumber, sessionOpen: (state) => !!state.field(sessionField, false) }), emphasisColors, import_state3.Prec.highest(import_view.keymap.of([{ key: "Mod-Shift-m", run: (view) => {
      if (!equationAt(view.state.doc.toString(), view.state.selection.main.head)) return false;
      this.start(view, view.state.selection.main.head);
      return true;
    } }])), import_state3.Prec.highest(compatibilityField), controls, import_view.EditorView.domEventHandlers({ mousedown: (event, view) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return false;
      const target = event.target;
      const math = target.closest(".math");
      if (!math || math.closest(".internal-embed,.markdown-embed,.kl-dynamic-reference,a") || target.closest(".math-studio-host") || view.state.field(sessionField, false)) return false;
      try {
        const matched = calloutEquation(view, math, equationsFor(view.state.doc));
        if (matched === null) {
          new import_obsidian.Notice("Couldn\u2019t identify this equation; open it from source.");
          return true;
        }
        const at = matched?.from ?? view.posAtDOM(math);
        if (equationsFor(view.state.doc).some((q) => at >= q.from && at <= q.to)) {
          event.preventDefault();
          this.start(view, at);
          return true;
        }
      } catch {
      }
      return false;
    } })]);
    this.addCommand({ id: "edit-equation", name: "Edit equation visually", hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }], editorCallback: (editor) => {
      const cm = editor.cm;
      if (cm) this.start(cm, editor.posToOffset(editor.getCursor()));
      else new import_obsidian.Notice("Open the note in an editable Markdown view.");
    } });
    this.addCommand({ id: "insert-equation", name: "Insert display equation", editorCallback: (editor) => {
      const cm = editor.cm;
      if (!cm) return;
      const pos = editor.posToOffset(editor.getCursor());
      editor.replaceRange("\n$$\nx\n$$\n", editor.getCursor());
      this.start(cm, pos + 1);
    } });
    this.addCommand({ id: "renumber-equations", name: "Refresh automatic equation numbers", editorCallback: (editor) => {
      const cm = editor.cm;
      if (cm) this.renumber(cm);
    } });
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
      const cm = editor.cm;
      if (!cm) return;
      const at = editor.posToOffset(editor.getCursor());
      if (equationAt(editor.getValue(), at)) menu.addItem((item) => item.setTitle("Edit equation visually").setIcon("sigma").onClick(() => this.start(cm, at)));
    }));
    this.registerMarkdownPostProcessor((el2, ctx) => {
      if (!this.settings.closedIntegrals) return;
      const math = Array.from(el2.querySelectorAll(".math"));
      if (!math.length) return;
      const section = ctx.getSectionInfo(el2);
      if (!section) return;
      const text = sectionLines(section.text, section.lineStart, section.lineEnd);
      if (!/\\oii?int(?![a-zA-Z])/.test(text)) return;
      const parsed = equations(text);
      for (const [i, target] of math.entries()) {
        if (target.closest(".math-studio-host")) continue;
        const q = parsed[i];
        if (q && hasClosedIntegral(q) && !u2(splitTag(q.body).latex).length) {
          this.styleMath(el2.ownerDocument);
          target.innerHTML = staticMarkup(q);
          target.dataset.mathStudioLatex = q.body;
          target.classList.add("math-studio-special");
        }
      }
    });
    this.addSettingTab(new MathSettings(this.app, this));
  }
  onunload() {
    for (const dispose of this.liveFrames) dispose();
    for (const style of this.styledDocs.values()) style.remove();
  }
  styleMath(doc) {
    if (this.styledDocs.has(doc)) return;
    const style = doc.createElement("style");
    style.textContent = this.mathCSS.replace(/url\(fonts\/([^)]*)\)/g, (_m, file) => `url("${this.app.vault.adapter.getResourcePath(`${this.manifest.dir}/vendor/fonts/${file}`)}")`);
    doc.head.append(style);
    this.styledDocs.set(doc, style);
  }
  start(view, at, justify = false) {
    if (view.state.field(sessionField, false)) {
      new import_obsidian.Notice("Save or cancel the current visual equation first.");
      return;
    }
    const q = equationAt(view.state.doc.toString(), at);
    if (!q) {
      new import_obsidian.Notice("Place the cursor inside an inline or display equation.");
      return;
    }
    const row = justificationRowAt(q.body, Math.max(0, at - q.bodyFrom));
    const info = view.state.field(import_obsidian.editorInfoField, false), s = { ...justify ? { justifyRow: row } : {}, id: crypto.randomUUID(), q, conflict: false, filePath: info?.file?.path ?? null, mount: editorMount(view, q) };
    view.dispatch({ effects: [openEffect.of(s), import_view.EditorView.scrollIntoView(s.mount.at, { y: "nearest" })], selection: import_state3.EditorSelection.cursor(s.mount.at !== q.to ? s.mount.at : q.bodyFrom === q.bodyTo ? q.bodyFrom : Math.min(view.state.doc.length, q.to + 1)) });
    const check = (retry) => view.requestMeasure({ read: () => !!view.dom.querySelector(`[data-math-studio-session="${s.id}"]`), write: (mounted) => {
      const current = view.state.field(sessionField, false);
      if (mounted || current?.id !== s.id) return;
      const mount = editorMount(view, current.q);
      if (retry && (mount.at !== current.mount.at || mount.side !== current.mount.side)) {
        view.dispatch({ effects: [openEffect.of({ ...current, mount }), import_view.EditorView.scrollIntoView(mount.at, { y: "nearest" })], selection: import_state3.EditorSelection.cursor(mount.at) });
        check(false);
      } else {
        view.dispatch({ effects: openEffect.of(null) });
        new import_obsidian.Notice("Couldn\u2019t place the editor; open it from source.");
      }
    } });
    check(true);
  }
  renumber(view) {
    if (view.state.field(sessionField, false)) return;
    const refresh = numberingRefresh(view.state);
    if (refresh) view.dispatch(refresh);
  }
  mount(view, s) {
    const doc = view.dom.ownerDocument;
    const host = doc.createElement("div");
    host.className = "math-studio-host";
    host.dataset.mathStudioSession = s.id;
    host.tabIndex = -1;
    const iframe = doc.createElement("iframe");
    iframe.className = "math-studio-frame";
    iframe.title = "Math Studio visual equation editor";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    host.append(iframe);
    const colors = {};
    const computed = doc.defaultView.getComputedStyle(view.dom);
    for (const key of ["--text-normal", "--text-muted", "--text-error", "--text-warning", "--color-purple", "--text-faint", "--background-primary", "--background-secondary", "--background-modifier-border", "--background-modifier-hover", "--interactive-accent", "--text-on-accent"]) colors[key] = computed.getPropertyValue(key).trim();
    const symbolApi = this.app.plugins?.plugins?.["study-studio"]?.symbolApi;
    const providers = this.app.plugins?.plugins;
    const referenceApi = (providers?.["knowledge-library-lab"] ?? providers?.["knowledge-library"])?.referenceApi;
    const hash = (text) => require("crypto").createHash("sha256").update(text).digest("hex");
    const referenceDraft = s.filePath && referenceApi?.version === 1 && ["choose", "prepare", "wrap", "planEquationSave", "verifyEquationSave"].every((k) => typeof referenceApi[k] === "function") ? new ReferenceDraft(referenceApi, s.id, s.filePath, hash) : null;
    const preparedReferences = /* @__PURE__ */ new Map();
    let symbols, disposed = false;
    const { latex, tag } = splitTag(s.q.body);
    const config = { id: s.id, buildId: BUILD_ID, justifyRow: s.justifyRow, context: s.mount.at !== s.q.to ? "Line " + view.state.doc.lineAt(s.q.from).number : void 0, symbols, references: !!referenceDraft, fontCSS: this.fontCSS, mathCSS: this.mathCSS, latex, tag, display: s.q.display, fonts: this.app.vault.adapter.getResourcePath(`${this.manifest.dir}/vendor/fonts`), dark: doc.body.classList.contains("theme-dark"), colors, blocked: s.q.containerIssue || unsupported(s.q.body) || (!referenceDraft && /\\class\{(?:mjx-)?klref\b/.test(latex) ? "Enable Knowledge Library to edit linked equations." : null) };
    const launch = async () => {
      try {
        symbols = await prepareSymbolSession(symbolApi, () => view.state.doc.toString(), s.filePath);
      } catch (error) {
        new import_obsidian.Notice(error.message);
      }
      if (disposed) return;
      config.symbols = symbols;
      const script = this.frameCode.replace(/<\/script/gi, "<\\/script");
      iframe.srcdoc = `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src app: data:; img-src data:; connect-src 'none'"></head><body><script>window.mathStudioConfig=${JSON.stringify(config).replace(/</g, "\\u003c")};<\/script><script>${script}<\/script></body></html>`;
    };
    let finishTarget = null;
    const outside = (event) => {
      const target = event.target;
      if (event.button !== 0 || host.contains(target) || !view.dom.contains(target)) return;
      const at = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (at === null) return;
      finishTarget = { at, math: !!target.closest?.(".math, mjx-container, .math-studio-special, .math-studio-edit") };
      event.preventDefault();
      event.stopImmediatePropagation();
      iframe.contentWindow?.postMessage({ mathStudio: s.id, type: "finish" }, "*");
    };
    const fail = (message) => iframe.contentWindow?.postMessage({ mathStudio: s.id, type: "error", message }, "*");
    let readyBuild, saving = false, initialScroll = false;
    const receive = async (event) => {
      if (event.source !== iframe.contentWindow || event.data?.mathStudio !== s.id) return;
      const data = event.data;
      const current = view.state.field(sessionField, false);
      if (!current || current.id !== s.id) return;
      if (data.type === "ready") {
        readyBuild = data.buildId;
        if (readyBuild !== BUILD_ID) fail("Math Studio main.js and frame.js do not match. Install the complete release.");
      }
      if (data.type === "open-symbols") {
        if (compatibleSymbolApi(symbolApi) && typeof data.id === "string" && /^[0-9a-z]{10}$/.test(data.id)) {
          host.focus({ preventScroll: true });
          void this.app.plugins?.plugins?.["study-studio"]?.symbolSystem?.open(s.filePath, data.id);
        }
      }
      if (data.type === "check-symbol") {
        try {
          if (readyBuild !== BUILD_ID || !compatibleSymbolApi(symbolApi)) throw Error("Matching notation tools are not available.");
          if (typeof data.latex !== "string" || data.latex.length > 2e5) throw Error("This equation is too large for interactive tagging.");
          await symbolApi.checkTag(data.latex, data.id, s.q.display);
          iframe.contentWindow?.postMessage({ mathStudio: s.id, type: "symbol-checked", request: data.request }, "*");
        } catch (error) {
          iframe.contentWindow?.postMessage({ mathStudio: s.id, type: "symbol-checked", request: data.request, error: error.message }, "*");
        }
      }
      if (data.type === "discard-reference") {
        preparedReferences.delete(data.token);
        iframe.contentWindow?.postMessage({ mathStudio: s.id, type: "reference-result", request: data.request, result: null }, "*");
      }
      if (data.type === "choose-reference" || data.type === "wrap-reference") {
        try {
          if (readyBuild !== BUILD_ID || !referenceDraft) throw Error("Enable the matching Knowledge Library reference tools.");
          if (saving) throw Error("Wait for the equation save to finish.");
          let result = null;
          if (data.type === "choose-reference") {
            if (typeof data.expression !== "string" || data.expression.length > 2e5) throw Error("Select an expression to link.");
            const info = view.state.field(import_obsidian.editorInfoField, false);
            if (info?.file?.path !== s.filePath || !info?.editor) throw Error("The note changed. Reopen its equation.");
            host.focus({ preventScroll: true });
            const prepared = await referenceDraft.choose({ editor: info.editor, info, anchorRect: host.getBoundingClientRect(), mode: data.mode, currentTarget: data.currentTarget, purpose: data.purpose }, () => view.state.doc.toString(), data.expression);
            if (prepared) {
              if (preparedReferences.size >= 256) throw Error("Too many pending choices; save or reopen this equation.");
              const token = crypto.randomUUID();
              preparedReferences.set(token, prepared);
              result = { token, expression: prepared.expression, mode: prepared.mode, target: prepared.target };
            }
          } else {
            const prepared = preparedReferences.get(data.token);
            if (!prepared) throw Error("Choose the reference again.");
            if (typeof data.body !== "string" || data.body.length > 2e5) throw Error("Invalid reference expression.");
            result = { wrapper: await referenceDraft.wrap(prepared, data.body) };
            preparedReferences.delete(data.token);
          }
          if (view.state.field(sessionField, false)?.id === s.id) {
            iframe.focus({ preventScroll: true });
            iframe.contentWindow?.postMessage({ mathStudio: s.id, type: "reference-result", request: data.request, result }, "*");
          }
        } catch (error) {
          if (view.state.field(sessionField, false)?.id === s.id) iframe.focus({ preventScroll: true });
          iframe.contentWindow?.postMessage({ mathStudio: s.id, type: "reference-result", request: data.request, error: error.message }, "*");
        }
      }
      if (data.type === "resize") {
        iframe.style.height = `${Math.max(150, Math.min(780, Number(data.height) || 200))}px`;
        view.requestMeasure();
        if (!initialScroll) {
          initialScroll = true;
          host.scrollIntoView({ block: "nearest" });
        }
      }
      if ((data.type === "cancel" || data.type === "native") && !saving) {
        view.dispatch({ effects: openEffect.of(null), selection: import_state3.EditorSelection.cursor(current.q.bodyFrom) });
        view.focus();
      }
      if (data.type === "copy") {
        void navigator.clipboard.writeText(String(data.latex)).then(() => new import_obsidian.Notice("Equation LaTeX copied."));
      }
      if (data.type === "save") {
        if (saving) return;
        saving = true;
        try {
          if (readyBuild !== BUILD_ID) throw Error("Math Studio runtime files do not match. Your draft is retained.");
          const path = view.state.field(import_obsidian.editorInfoField, false)?.file?.path ?? null;
          if (current.conflict || path !== current.filePath) throw Error("The note or equation changed while you were editing. Your draft is still here; copy it before reopening the current source.");
          if (typeof data.latex !== "string" || !["none", "manual", "auto"].includes(data.tag?.kind)) throw Error("Invalid equation draft.");
          const snapshot = view.state.doc, source = snapshot.toString();
          let replacement = data.referenceSource ? composeSourceDraft(current.q, data.referenceSource.before, data.referenceSource.after, data.tag) : data.changed ? compose(current.q, data.latex, data.tag) : current.q.raw;
          const change = safeReplacement(source, current.q, replacement);
          checkReferenceDraftSize(replacement);
          let changes = [change];
          let foreignIdentities = [];
          if (data.symbols) {
            if (!compatibleSymbolApi(symbolApi) || data.symbols.version !== 2) throw Error("Matching notation tools are required. Your draft is retained.");
            changes = await symbolApi.planEquationSave(path, source, current.q.from, current.q.to, current.q.raw, replacement, data.symbols);
          } else if (!preservesSymbolTags(current.q.raw, replacement)) throw Error("The existing notation tags must stay unchanged. Your draft is retained.");
          if (referenceDraft) {
            const finalEquation = plannedEquation(source, change, changes);
            replacement = finalEquation.insert;
            checkReferenceDraftSize(replacement);
            const planned = await referenceDraft.plan(source, finalEquation, current.q.raw, changes);
            await referenceApi.verifyEquationSave(planned.plan, source);
            if (data.symbols) {
              if (!compatibleSymbolApi(symbolApi) || data.symbols.version !== 2) throw Error("Notation tools changed during save. Your draft is retained.");
              const verified = await symbolApi.planEquationSave(path, source, current.q.from, current.q.to, current.q.raw, change.insert, data.symbols);
              if (JSON.stringify(verified) !== JSON.stringify(changes)) throw Error("Symbol definitions changed during save. Review your draft again.");
            }
            changes = planned.edits;
            foreignIdentities = planned.plan.foreignIdentities || [];
          } else if (/\\class\{(?:mjx-)?klref\b/.test(replacement) && replacement !== current.q.raw) throw Error("Enable the matching Knowledge Library before changing linked equations.");
          changes = changes.filter((e) => source.slice(e.from, e.to) !== e.insert);
          if (this.settings.autoNumber) changes = withAutomaticNumbering(source, changes);
          const expected = applyEdits(source, changes), expectedHash = hash(expected);
          if (view.state.field(sessionField, false)?.id !== s.id) return;
          if (view.state.doc !== snapshot || view.state.field(import_obsidian.editorInfoField, false)?.file?.path !== path) throw Error("The note changed during the save check. Your draft is retained.");
          const annotations = [import_state3.Transaction.userEvent.of("input.math-studio")];
          let isolated = false;
          try {
            const commands = require("@codemirror/commands");
            if (view.state.field(commands.historyField, false) !== void 0) {
              annotations.push(commands.isolateHistory.of("full"));
              isolated = true;
            }
          } catch {
          }
          const target = finishTarget;
          finishTarget = null;
          const changeSet = view.state.changes(changes), mappedStart = changeSet.mapPos(current.q.from, -1), mappedTarget = target ? changeSet.mapPos(target.at, 1) : null;
          replacement = equations(expected).find((q) => q.from === mappedStart)?.raw ?? replacement;
          const commit = async (extraEffects = []) => {
            if (view.state.doc !== snapshot || view.state.field(sessionField, false)?.id !== s.id) throw Error("The equation changed during its grouped save. Your draft is retained.");
            const selection = import_state3.EditorSelection.create([import_state3.EditorSelection.cursor(mappedTarget ?? (!data.native && current.mount.at !== current.q.to ? changeSet.mapPos(current.mount.at, 1) : data.native ? mappedStart + (current.q.display ? 2 : 1) : Math.min(changeSet.newLength, mappedStart + replacement.length + 1)))]), effects = [openEffect.of(null)];
            const owner = commitEquationPlan(symbolApi, { path, view, expectedSource: source, edits: changes, selection, effects, historyEffects: extraEffects }, symbols?.version === 2 && !symbols.readOnly, () => {
              const transaction = view.state.update({ changes: changeSet, effects: [...effects, ...extraEffects], selection, annotations });
              if (transaction.newDoc.toString() !== applyEdits(source, changes)) throw Error("The editor refused part of this change. Equation and symbol records were left untouched.");
              view.dispatch(transaction);
            });
            if (owner === "managed") isolated = true;
          };
          if (foreignIdentities.length) {
            if (typeof referenceApi.commitEquationSave !== "function") throw Error("Enable matching Knowledge Library tools to save this foreign identity.");
            await referenceApi.commitEquationSave({ view, path, before: source, after: expected, identities: foreignIdentities }, commit);
          } else await commit();
          if (!isolated) view.dispatch({ selection: view.state.selection, userEvent: "select.math-studio" });
          if (hash(view.state.doc.toString()) !== expectedHash) {
            new import_obsidian.Notice("The saved equation differs from its verified plan. Undo this edit before continuing.");
            return;
          }
          view.focus();
          if (target?.math && mappedTarget !== null) this.start(view, mappedTarget);
        } catch (error) {
          fail(error.message);
        } finally {
          saving = false;
        }
      }
    };
    doc.defaultView.addEventListener("message", receive);
    doc.addEventListener("mousedown", outside, true);
    const dispose = () => {
      disposed = true;
      referenceDraft?.dispose();
      preparedReferences.clear();
      doc.removeEventListener("mousedown", outside, true);
      doc.defaultView?.removeEventListener("message", receive);
      this.liveFrames.delete(dispose);
    };
    host.mathStudioCleanup = dispose;
    this.liveFrames.add(dispose);
    void launch();
    return host;
  }
};
var MathSettings = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin2) {
    super(app, plugin2);
    this.plugin = plugin2;
  }
  display() {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "Math Studio" });
    new import_obsidian.Setting(this.containerEl).setName("Show optional editor pencils").setDesc("Off by default. Applies only to editing mode; reading and print output never show pencils. Click rendered math or use the visual-edit command without them. Reopen the note after changing this.").addToggle((t33) => t33.setValue(this.plugin.settings.buttons).onChange(async (v2) => {
      this.plugin.settings.buttons = v2;
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian.Setting(this.containerEl).setName("Maintain automatic equation numbers").setDesc("Renumber equations marked Automatic after edits, skipping numbers already used by fixed labels. Fixed labels are unchanged.").addToggle((t33) => t33.setValue(this.plugin.settings.autoNumber).onChange(async (v2) => {
      this.plugin.settings.autoNumber = v2;
      await this.plugin.saveData(this.plugin.settings);
    }));
  }
};
