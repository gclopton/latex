var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// plugin/monitor.js
var require_monitor = __commonJS({
  "plugin/monitor.js"(exports2, module2) {
    module2.exports = function startMonitor2(app, folder, targetWindow = globalThis.window) {
      const window = targetWindow, document = window.document, performance2 = window.performance, PerformanceObserver = window.PerformanceObserver, MutationObserver = window.MutationObserver;
      window.__libraryPerf?.stop?.();
      const fs2 = require("fs"), stamp = Date.now(), start = performance2.now(), base = folder + "/study-" + stamp;
      fs2.mkdirSync(folder, { recursive: true });
      const data = { vault: app.vault.getName(), start: (/* @__PURE__ */ new Date()).toISOString(), events: [], longTasks: [], lag: [], mutations: [], resources: [], states: [], errors: [] };
      const now = () => Math.round(performance2.now() - start);
      const observers = [], refs = [], listeners = [];
      let stopped = false;
      const event = (type, extra = {}) => data.events.length < 1e4 && data.events.push({ type, ms: now(), ...extra });
      refs.push([app.workspace, app.workspace.on("editor-change", () => event("editor-change"))]);
      refs.push([app.vault, app.vault.on("modify", (f) => {
        if (f === app.workspace.getActiveFile()) event("active-file-save");
      })]);
      for (const name of ["beforeinput", "input", "keydown", "scroll", "load"]) {
        const fn = (e) => {
          if (name === "load" && e.target?.tagName !== "IMG") return;
          if (name === "scroll" && data.events.at(-1)?.type === "scroll" && now() - data.events.at(-1).ms < 100) return;
          event(name, { target: e.target?.tagName });
        };
        document.addEventListener(name, fn, true);
        listeners.push([name, fn]);
      }
      try {
        const p = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (data.longTasks.length < 5e3) data.longTasks.push({ ms: Math.round(e.startTime - start), duration: Math.round(e.duration) });
        });
        p.observe({ type: "longtask" });
        observers.push(p);
      } catch (e) {
        data.errors.push(String(e));
      }
      try {
        const p = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (e.initiatorType === "img" && data.resources.length < 5e3) data.resources.push({ ms: Math.round(e.startTime - start), duration: Math.round(e.duration), transfer: e.transferSize, decoded: e.decodedBodySize });
        });
        p.observe({ type: "resource" });
        observers.push(p);
      } catch (e) {
        data.errors.push(String(e));
      }
      const counts = (n) => {
        if (n.nodeType !== 1) return { images: 0, figures: 0, math: 0 };
        return { images: (n.matches("img") ? 1 : 0) + n.querySelectorAll("img").length, figures: (n.matches(".ss-scientific") ? 1 : 0) + n.querySelectorAll(".ss-scientific").length, math: (n.matches("mjx-container") ? 1 : 0) + n.querySelectorAll("mjx-container").length };
      };
      const m = new MutationObserver((rs) => {
        let added = { images: 0, figures: 0, math: 0 }, removed = { ...added };
        for (const r of rs) {
          for (const n of r.addedNodes) {
            const c = counts(n);
            for (const k in c) added[k] += c[k];
          }
          for (const n of r.removedNodes) {
            const c = counts(n);
            for (const k in c) removed[k] += c[k];
          }
        }
        if (Object.values(added).some(Boolean) || Object.values(removed).some(Boolean)) {
          if (data.mutations.length < 5e3) data.mutations.push({ ms: now(), added, removed });
        }
      });
      m.observe(document.body, { subtree: true, childList: true });
      observers.push(m);
      let last = performance2.now();
      const lag = setInterval(() => {
        const t = performance2.now(), delay = t - last - 100;
        if (delay > 50) data.lag.push({ ms: now(), delay: Math.round(delay) });
        last = t;
      }, 100);
      const snapshot = () => {
        const v = app.workspace.activeLeaf?.view;
        data.states.push({ ms: now(), file: v?.file?.basename, mode: v?.getMode?.(), images: document.querySelectorAll(".workspace img").length, figures: document.querySelectorAll(".workspace .ss-scientific").length });
      };
      let writing = Promise.resolve();
      const write = () => {
        data.elapsed = now();
        const before = performance2.now(), payload = JSON.stringify(data);
        data.serializationMs = (data.serializationMs || 0) + performance2.now() - before;
        writing = writing.then(() => fs2.promises.writeFile(base + ".json", payload)).catch((e) => {
          if (data.errors.length < 20) data.errors.push(String(e));
        });
      };
      snapshot();
      write();
      const heartbeat = setInterval(() => {
        snapshot();
        write();
      }, 1e4);
      const stop = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(lag);
        clearInterval(heartbeat);
        clearTimeout(end);
        for (const p of observers) p.disconnect();
        for (const [owner, r] of refs) owner.offref(r);
        for (const [name, fn] of listeners) document.removeEventListener(name, fn, true);
        snapshot();
        write();
      };
      const end = setTimeout(stop, 18e4);
      window.__libraryPerf = { stop, data };
      return { stop, data, path: base + ".json" };
    };
  }
});

// plugin/filter-model.js
var require_filter_model = __commonJS({
  "plugin/filter-model.js"(exports2, module2) {
    var clone = (x) => JSON.parse(JSON.stringify(x));
    var KEYS = { book: "book", chapter: "chapter", ch: "chapter", source: "source", type: "type", vault: "vault", group: "group" };
    var labelKind = (k) => k.charAt(0).toUpperCase() + k.slice(1);
    var typeLabel2 = (k) => ({ identity: "Identities", property: "Properties", notation: "Notation", "key-point": "Key points" })[k] || labelKind(k) + "s";
    var axis = (k) => ["book", "chapter", "source"].includes(k) ? "source" : k === "type" ? "type" : "vault";
    var identity = (t) => t.kind + ":" + t.id;
    var normalize = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_’]/g, " ").trim();
    function prefixAt(text, caret) {
      let quote = false, math = null;
      for (let i = 0; i < caret; ) {
        const c = text[i], pair = text.slice(i, i + 2);
        if (c === "\\") {
          if (!quote && !math && (pair === "\\(" || pair === "\\[")) math = pair === "\\(" ? "\\)" : "\\]";
          else if (pair === math) math = null;
          i += 2;
          continue;
        }
        if (c === '"' && !math) {
          quote = !quote;
          i++;
          continue;
        }
        if (c === "$" && !quote) {
          const token = pair === "$$" ? "$$" : "$";
          math = math === token ? null : math || token;
          i += token.length;
          continue;
        }
        if (!quote && !math && (i === 0 || /[\s;]/.test(text[i - 1]))) {
          const m = /^(book|chapter|ch|source|type|vault|group):/i.exec(text.slice(i, caret));
          if (m && i + m[0].length === caret) return { kind: KEYS[m[1].toLowerCase()], from: i, to: caret };
        }
        i++;
      }
      return null;
    }
    function catalogRows(catalog, groups = []) {
      const sourceMap = new Map((catalog.sources || []).map((s) => [s.id, s]));
      return [
        ...(catalog.vaults || []).map((v) => ({ kind: "vault", id: v.id, label: v.label, context: "Vault", count: v.count })),
        ...(catalog.types || []).map((t) => ({ kind: "type", id: t.id, label: typeLabel2(t.id), context: "Entry type", count: t.count })),
        ...groups.map((g) => ({ kind: "group", id: g.id, label: g.name, context: `${g.vaultIds.length} vaults`, ids: [...g.vaultIds] })),
        ...(catalog.sources || []).map((s) => ({
          kind: s.kind === "book" ? "book" : s.kind === "chapter" ? "chapter" : "source",
          id: s.id,
          label: s.label,
          context: s.vaultLabel + " \xB7 " + (sourceMap.get(s.parentId)?.label || s.path),
          count: s.count,
          vaultId: s.vaultId,
          path: s.path,
          folder: s.folder,
          parentId: s.parentId
        }))
      ].map((r) => ({ ...r, searchLabel: normalize(r.label), searchContext: normalize(r.context || "") }));
    }
    function migrate(settings, catalog, query = "") {
      const rows = catalogRows(catalog, settings.groups), tokens = [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      if (settings.filters?.version === 2) return cleanState({ ...clone(settings.filters.state), query, cursor: [query.length, query.length], draft: null });
      const add = (ids, kind) => {
        if (ids == null) return;
        if (!ids.length) {
          tokens.push({ kind, id: "__none__", label: "No " + (kind === "source" ? "sources" : kind + "s"), empty: true });
          return;
        }
        for (const id of ids) {
          const found = byId.get(id);
          tokens.push(found ? clone(found) : { kind, id, label: "Unavailable " + kind });
        }
      };
      const group = (settings.groups || []).find((g) => g.id === settings.scopeGroupId && JSON.stringify([...g.vaultIds].sort()) === JSON.stringify([...settings.vaultIds || []].sort()));
      if (group) tokens.push(clone(byId.get(group.id)));
      else add(settings.vaultIds, "vault");
      add(settings.typeIds, "type");
      add(settings.sourceIds, "source");
      return { query, tokens, cursor: [query.length, query.length], draft: null };
    }
    var catalogCache = /* @__PURE__ */ new WeakMap();
    function scope(state, catalog) {
      let cached = catalogCache.get(catalog);
      if (!cached) {
        cached = { byKey: new Map(catalogRows(catalog).map((r) => [identity(r), r])), bySource: new Map((catalog.sources || []).map((s) => [s.id, s])), vaultIds: new Set((catalog.vaults || []).map((v) => v.id)) };
        catalogCache.set(catalog, cached);
      }
      const { byKey, bySource } = cached;
      const warnings = [], missing = /* @__PURE__ */ new Set(), vaults = [], types = [], sources = [];
      for (const t of state.tokens) {
        const a = axis(t.kind);
        if (t.empty) {
          missing.add(a);
          warnings.push(t.label);
          continue;
        }
        const r = a === "source" ? bySource.get(t.id) : t.kind === "group" && Array.isArray(t.ids) ? t : byKey.get(identity(t));
        if (!r) {
          missing.add(a);
          warnings.push(t.label + " is unavailable");
          continue;
        }
        if (a === "source") sources.push(r);
        else if (t.kind === "group") {
          const ids = t.ids;
          if (ids.some((id) => !cached.vaultIds.has(id))) {
            missing.add("vault");
            warnings.push(t.label + " contains an unavailable vault");
          }
          vaults.push(...ids);
        } else if (a === "vault") vaults.push(t.id);
        else types.push(t.id);
      }
      const narrowed = sources.filter((s) => !sources.some((child) => child.id !== s.id && child.vaultId === s.vaultId && s.folder && child.path.startsWith(s.path + "/")));
      const has = (a) => state.tokens.some((t) => axis(t.kind) === a);
      const unique = (a) => [...new Set(a)];
      const result = {
        vaultIds: has("vault") ? missing.has("vault") ? [] : unique(vaults) : null,
        types: has("type") ? missing.has("type") ? [] : unique(types) : null,
        sourceIds: has("source") ? missing.has("source") ? [] : unique(narrowed.map((s) => s.id)) : null
      };
      if (result.vaultIds && result.sourceIds?.length && narrowed.every((s) => !result.vaultIds.includes(s.vaultId)))
        warnings.push("The selected sources are outside the selected vaults.");
      return { ...result, warnings, narrowed };
    }
    function oneTypo(a, b) {
      if (Math.abs(a.length - b.length) > 1) return false;
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      if (i === a.length || i === b.length) return true;
      if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
      return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
    }
    function rank(row, q) {
      if (!q) return 0;
      const name = row.searchLabel || normalize(row.label), context = row.searchContext || normalize(row.context || "");
      if (name === q) return 1e3;
      if (name.startsWith(q)) return 900;
      if (name.includes(q)) return 800;
      const words = q.split(/\s+/), parts = name.split(/[^a-z0-9]+/);
      if (words.every((w) => parts.some((p) => p.startsWith(w)))) return 700;
      if (words.every((w) => parts.some((p) => w.length >= 4 && oneTypo(w, p)))) return 600;
      let at = 0;
      for (const c of name) if (c === q[at]) at++;
      if (at === q.length) return 400 - q.length;
      if (context.includes(q)) return 200;
      return -1;
    }
    function cleanState(state) {
      const copy = clone(state);
      delete copy.groups;
      return copy;
    }
    var FilterModel = class {
      constructor(state) {
        this.state = cleanState(state);
        this.undoStack = [];
        this.redoStack = [];
        this.undoEffects = [];
        this.redoEffects = [];
        this.lastRun = null;
      }
      change(next, run = null, effect = null) {
        const before = this.state;
        if (!effect && JSON.stringify(before) === JSON.stringify(next)) return;
        const merged = !effect && run && this.lastRun && run.at - this.lastRun.at < 700 && run.field === this.lastRun.field && run.start === this.lastRun.end && run.merge && this.lastRun.merge;
        if (!merged) {
          this.undoStack.push(clone(before));
          this.undoEffects.push(effect);
          if (this.undoStack.length > 200) {
            this.undoStack.shift();
            this.undoEffects.shift();
          }
        }
        this.state = clone(next);
        this.redoStack = [];
        this.redoEffects = [];
        this.lastRun = run;
      }
      selection(start, end) {
        this.state.cursor = [start, end];
        this.lastRun = null;
      }
      text(value, start, end, { typed = false, inputType = "", at = Date.now() } = {}) {
        const prev = this.state, field = prev.draft ? "draft" : "query", old = prev.draft?.value ?? prev.query;
        const next = clone(prev);
        if (next.draft) next.draft.value = value;
        else next.query = value;
        next.cursor = [start, end];
        const p = !next.draft && typed ? prefixAt(value, start) : null;
        if (p) {
          next.query = value.slice(0, p.from) + value.slice(p.to);
          next.draft = { kind: p.kind, value: "", insert: p.from };
          next.cursor = [0, 0];
        }
        const added = value.slice(Math.max(0, start - (value.length - old.length)), start);
        this.change(next, { field, at, start: prev.cursor?.[0], end: start, merge: !p && inputType === "insertText" && value.length > old.length && !/[\s;]/.test(added) });
      }
      begin(kind, index = null) {
        const next = clone(this.state), t = index == null ? null : next.tokens[index];
        next.draft = { kind, value: t?.label || "", edit: index, insert: next.cursor?.[0] ?? next.query.length };
        next.cursor = [0, next.draft.value.length];
        this.change(next);
      }
      cancel() {
        if (!this.state.draft) return;
        const next = clone(this.state), at = next.draft.insert;
        next.draft = null;
        next.cursor = [at, at];
        this.change(next);
      }
      commit(row, catalog) {
        const next = clone(this.state), draft = next.draft;
        if (!draft) return;
        const token = clone(row);
        if (draft.edit != null) next.tokens.splice(draft.edit, 1);
        next.tokens = next.tokens.filter((t) => !(t.empty && axis(t.kind) === axis(row.kind)));
        if (!next.tokens.some((t) => identity(t) === identity(token))) next.tokens.splice(draft.edit == null ? next.tokens.length : Math.min(draft.edit, next.tokens.length), 0, token);
        if (scope(next, catalog).sourceIds?.length > 100) throw new Error("Choose up to 100 source filters. Remove a source tag first.");
        next.draft = null;
        next.cursor = [draft.insert, draft.insert];
        this.change(next);
      }
      remove(index) {
        const next = clone(this.state);
        next.tokens.splice(index, 1);
        next.draft = null;
        this.change(next);
      }
      clear() {
        const next = clone(this.state);
        next.tokens = [];
        next.draft = null;
        this.change(next);
      }
      undo() {
        if (!this.undoStack.length) return;
        let effect = this.undoEffects.pop(), error;
        try {
          effect?.undo();
        } catch (e) {
          error = e;
          effect = null;
        }
        this.redoEffects.push(effect);
        this.redoStack.push(clone(this.state));
        this.state = this.undoStack.pop();
        this.lastRun = null;
        if (error) throw error;
      }
      redo() {
        if (!this.redoStack.length) return;
        let effect = this.redoEffects.pop(), error;
        try {
          effect?.redo();
        } catch (e) {
          error = e;
          effect = null;
        }
        this.undoEffects.push(effect);
        this.undoStack.push(clone(this.state));
        this.state = this.redoStack.pop();
        this.lastRun = null;
        if (error) throw error;
      }
      saved() {
        return { version: 2, state: { ...clone(this.state), draft: null, cursor: [0, 0] } };
      }
    };
    module2.exports = { FilterModel, prefixAt, catalogRows, migrate, scope, rank, normalize, axis, identity, labelKind, typeLabel: typeLabel2, clone };
  }
});

// plugin/filter-bar.js
var require_filter_bar = __commonJS({
  "plugin/filter-bar.js"(exports2, module2) {
    var { FilterModel, migrate, catalogRows, scope, rank, normalize, axis, labelKind, clone } = require_filter_model();
    var COLORS = {
      book: "101,190,244",
      chapter: "101,190,244",
      source: "101,190,244",
      vault: "98,211,185",
      group: "98,211,185",
      type: "193,180,217",
      definition: "238,255,0",
      notation: "166,139,255",
      theorem: "43,230,109",
      result: "43,230,109",
      lemma: "43,230,109",
      corollary: "43,230,109",
      proposition: "43,230,109",
      equation: "96,183,255"
    };
    function el(parent, tag, cls, text) {
      const node = parent.ownerDocument.createElement(tag);
      if (cls) node.className = cls;
      if (text != null) node.textContent = text;
      parent.appendChild(node);
      return node;
    }
    module2.exports = class FilterBar {
      constructor(browser, parent, summary) {
        this.browser = browser;
        this.document = parent.ownerDocument;
        this.win = this.document.defaultView;
        this.summary = summary;
        this.catalog = { vaults: [], types: [], sources: [] };
        this.ready = false;
        this.serial = 0;
        this.host = el(parent, "div", "kl-filter-host");
        this.bar = el(this.host, "div", "kl-filter-bar");
        this.chips = el(this.bar, "div", "kl-tag-list");
        this.queryEcho = el(this.bar, "span", "kl-query-echo");
        this.prefix = el(this.bar, "span", "kl-draft-label");
        this.input = el(this.bar, "input", "kl-filter-input");
        this.input.type = "text";
        this.input.placeholder = "Search\u2026  Book:  Type:  Vault:";
        this.input.setAttribute("aria-label", "Search index");
        this.input.setAttribute("role", "combobox");
        this.input.setAttribute("aria-autocomplete", "list");
        this.input.setAttribute("autocomplete", "off");
        this.input.setAttribute("spellcheck", "false");
        this.suggestions = el(this.host, "div", "kl-tag-suggestions");
        this.suggestions.id = browser.uid + "-filters";
        this.suggestions.setAttribute("role", "listbox");
        this.suggestions.hidden = true;
        this.help = el(this.host, "div", "kl-filter-help");
        this.help.setAttribute("role", "status");
        this.input.addEventListener("beforeinput", (e) => {
          if (e.isComposing || this.composing) return;
          if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
            e.preventDefault();
            this.history(e.inputType === "historyRedo");
            return;
          }
          if (this.model) this.model.state.cursor = [this.input.selectionStart, this.input.selectionEnd];
        });
        this.input.addEventListener("compositionstart", () => {
          this.composing = true;
        });
        this.input.addEventListener("compositionend", () => {
          this.composing = false;
          this.acceptInput(false, "composition");
        });
        this.input.addEventListener("input", (e) => {
          if (!this.composing && !e.isComposing) this.acceptInput(e.inputType === "insertText", "" + e.inputType);
        });
        this.input.addEventListener("paste", (e) => {
          if (!this.model) return;
          e.preventDefault();
          const text = e.clipboardData?.getData("text/plain") || "";
          this.model.state.cursor = [this.input.selectionStart, this.input.selectionEnd];
          this.input.setRangeText(text.replace(/\r?\n/g, "; "), this.input.selectionStart, this.input.selectionEnd, "end");
          this.acceptInput(false, "insertFromPaste");
        });
        this.input.addEventListener("keydown", (e) => {
          if (this.keys(e)) {
            e.preventDefault();
            e.stopPropagation();
          } else browser.keys(e);
        });
        this.input.addEventListener("focus", () => {
          if (this.expandedKind) {
            this.expandedKind = null;
            this.render(false);
          }
        });
        this.input.addEventListener("click", () => {
          if (this.model) this.model.selection(this.input.selectionStart, this.input.selectionEnd);
        });
        this.bar.addEventListener("click", (e) => {
          if (e.target === this.bar || e.target === this.chips) this.input.focus();
        });
      }
      load(catalog, settings, restored) {
        this.catalog = catalog;
        this.settings = this.browser.settings || settings;
        this.ready = true;
        this.catalogVersion = (this.catalogVersion || 0) + 1;
        if (!this.model) {
          this.model = new FilterModel(restored?.filters?.version === 2 ? { ...clone(restored.filters.state), query: restored.query ?? restored.filters.state.query ?? "", draft: null } : migrate(settings, catalog, restored?.query ?? this.input.value));
        }
        this.rows = catalogRows(catalog, this.settings.groups);
        this.render(false);
        this.browser.filtersChanged(false);
      }
      restore(state) {
        if (!this.model) return;
        if (state.filters?.version === 2) this.model = new FilterModel({ ...clone(state.filters.state), query: state.query ?? state.filters.state.query ?? "", draft: null });
        else {
          this.model.state.query = state.query ?? "";
          this.model.state.draft = null;
        }
        this.model.state.cursor = [this.model.state.query.length, this.model.state.query.length];
        this.render();
        this.browser.filtersChanged();
      }
      groups() {
        return this.settings.groups || [];
      }
      refreshRows() {
        const sig = JSON.stringify(this.groups());
        if (sig !== this.groupSignature) {
          this.groupSignature = sig;
          this.rows = catalogRows(this.catalog, this.groups());
        }
      }
      focusInput() {
        this.input.focus();
        const [a, b] = this.model.state.cursor || [0, 0];
        this.input.setSelectionRange(a, b);
      }
      groupEffect(before, after) {
        const id = (after || before).id;
        const apply = (expected, value) => {
          const current = this.groups().find((g) => g.id === id) || null;
          if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error("This group changed in another window. Its newer version has been kept.");
          this.settings.groups = this.groups().filter((g) => g.id !== id);
          if (value) this.settings.groups.push(clone(value));
          this.refreshRows();
          this.browser.plugin?.persist().catch(() => {
            this.help.textContent = "Group settings could not be saved.";
          });
        };
        apply(before, after);
        return { undo: () => apply(after, before), redo: () => apply(before, after) };
      }
      query() {
        return this.model?.state.query ?? this.input.value;
      }
      snapshot() {
        return { reviewed: this.browser.reviewed, query: this.query(), filters: this.model?.saved() };
      }
      request() {
        return this.model ? scope(this.model.state, this.catalog) : { vaultIds: null, types: null, sourceIds: null, warnings: [] };
      }
      blocked() {
        return !!this.model?.state.draft || !this.ready;
      }
      acceptInput(typed, inputType) {
        if (!this.model) return;
        this.model.text(this.input.value, this.input.selectionStart, this.input.selectionEnd, { typed, inputType });
        this.changed();
      }
      changed() {
        this.render();
        this.browser.filtersChanged();
      }
      begin(kind, index = null) {
        if (!this.model) return;
        this.model.state.cursor = [this.input.selectionStart || 0, this.input.selectionEnd || 0];
        this.model.begin(kind, index);
        this.changed();
        this.focusInput();
      }
      cancel() {
        this.model.cancel();
        this.changed();
        this.focusInput();
      }
      clear() {
        if (!this.model) return;
        this.model.clear();
        this.changed();
        this.focusInput();
      }
      history(redo = false) {
        if (!this.model) return;
        let warning;
        try {
          redo ? this.model.redo() : this.model.undo();
        } catch (e) {
          warning = e.message;
        }
        this.changed();
        this.focusInput();
        if (warning) this.help.textContent = warning;
      }
      commit(row) {
        if (!row || !this.model || this.loading) return;
        try {
          const draft = this.model.state.draft;
          if (draft?.kind === "group-name") {
            const name = draft.value.trim();
            if (!name) return;
            const next = clone(this.model.state), old = this.groups().find((g) => g.id === draft.groupId) || null;
            if (name.length > 80) throw new Error("Use a group name under 80 characters.");
            if (this.groups().some((g) => g.id !== draft.groupId && normalize(g.name) === normalize(name))) throw new Error("That group name already exists.");
            const updated = old ? { ...clone(old), name } : { id: require("crypto").randomUUID(), name, vaultIds: draft.vaultIds };
            next.tokens.filter((t) => t.kind === "group" && t.id === updated.id).forEach((t) => t.label = name);
            next.draft = null;
            this.model.change(next, null, this.groupEffect(old, updated));
          } else this.model.commit(row, this.catalog);
          this.changed();
          this.focusInput();
        } catch (e) {
          this.help.textContent = e.message;
        }
      }
      nameGroup(group = null) {
        if (!this.model) return;
        const ids = this.request().vaultIds ?? this.catalog.vaults.map((v) => v.id);
        if (!group && !ids.length) {
          this.help.textContent = "Choose a vault before saving a group.";
          return;
        }
        const next = clone(this.model.state);
        next.draft = { kind: "group-name", value: group?.name || "", groupId: group?.id, vaultIds: ids, insert: next.query.length };
        next.cursor = [0, next.draft.value.length];
        this.model.change(next);
        this.changed();
        this.focusInput();
      }
      deleteGroup(group) {
        const next = clone(this.model.state);
        next.tokens = next.tokens.flatMap((t) => t.kind === "group" && t.id === group.id ? (t.ids || group.vaultIds).map((id) => this.rows.find((r) => r.kind === "vault" && r.id === id) || { kind: "vault", id, label: "Unavailable vault" }) : [t]);
        this.model.change(next, null, this.groupEffect(group, null));
        this.changed();
        this.focusInput();
      }
      remove(index) {
        this.model.remove(index);
        this.changed();
        const items = [...this.chips.querySelectorAll(".kl-tag-main")];
        (items.find((b) => Number(b.dataset.index) >= index) || items.at(-1) || this.input).focus();
      }
      focusTag(index) {
        const button = this.chips.querySelector(`[data-index="${index}"]`);
        button?.focus();
      }
      tagKey(e, index) {
        if (e.isComposing) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.stopPropagation();
          this.history(e.shiftKey);
          return;
        }
        if (!["Backspace", "Delete", "Enter", "ArrowLeft", "ArrowRight", "Escape"].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape") {
          this.focusInput();
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") this.remove(index);
        else if (e.key === "Enter") this.begin(this.model.state.tokens[index].kind, index);
        else {
          const items = [...this.chips.querySelectorAll(".kl-tag-main")], at = items.indexOf(e.currentTarget) + (e.key === "ArrowLeft" ? -1 : 1);
          if (at >= 0 && at < items.length) {
            this.enterFromRight = e.key === "ArrowLeft";
            items[at].focus();
            this.enterFromRight = false;
          } else {
            this.input.focus();
            this.input.setSelectionRange(0, 0);
          }
        }
      }
      keys(e) {
        if (e.isComposing || this.composing) return false;
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === "z") {
          this.history(e.shiftKey);
          return true;
        }
        const draft = this.model?.state.draft;
        if (draft) {
          if (e.key === "Escape") {
            this.cancel();
            return true;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            this.choice = Math.max(0, Math.min((this.matches?.length || 1) - 1, (this.choice || 0) + (e.key === "ArrowDown" ? 1 : -1)));
            this.drawChoices();
            return true;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            if (!mod) this.commit(draft.kind === "group-name" ? {} : this.matches?.[this.choice || 0]);
            return true;
          }
          if (e.key === "Backspace" && !this.input.value) {
            this.cancel();
            return true;
          }
          return false;
        }
        if ((e.key === "Backspace" || e.key === "ArrowLeft") && this.input.selectionStart === 0 && this.input.selectionEnd === 0) {
          const buttons = this.chips.querySelectorAll(".kl-tag-main");
          if (buttons.length) {
            this.enterFromRight = true;
            buttons[buttons.length - 1].focus();
            this.enterFromRight = false;
            return true;
          }
        }
        return false;
      }
      render(focus = true) {
        if (!this.model) return;
        this.refreshRows();
        const state = this.model.state, draft = state.draft, value = draft ? draft.value : state.query, req = this.request();
        this.queryEcho.hidden = !draft || !state.query;
        this.queryEcho.textContent = draft ? state.query : "";
        this.prefix.hidden = !draft;
        this.prefix.textContent = draft ? (draft.kind === "group-name" ? "Group name" : labelKind(draft.kind)) + ":" : "";
        this.bar.classList.toggle("is-drafting", !!draft);
        this.host.closest(".kl-pane-content,.modal-content")?.classList.toggle("kl-drafting", !!draft);
        this.input.placeholder = draft ? "Find " + draft.kind + "\u2026" : "Search\u2026  Book:  Type:  Vault:";
        if (this.input.value !== value) this.input.value = value;
        if (focus && this.document.activeElement === this.input) {
          const [a, b] = state.cursor || [value.length, value.length];
          this.input.setSelectionRange(Math.min(a, value.length), Math.min(b, value.length));
        }
        const signature = JSON.stringify([state.tokens, this.catalogVersion, this.groupSignature, this.expandedKind]);
        if (signature !== this.chipSignature) {
          this.chipSignature = signature;
          this.chips.replaceChildren();
          this.summary.replaceChildren();
          const kinds = /* @__PURE__ */ new Map(), parts = /* @__PURE__ */ new Map();
          state.tokens.forEach((token, index) => {
            if (!kinds.has(token.kind)) kinds.set(token.kind, []);
            kinds.get(token.kind).push(index);
            const live = this.rows.find((r) => r.id === token.id && axis(r.kind) === axis(token.kind));
            const label = live?.label || token.label, full = labelKind(token.kind) + ": " + label;
            const parent = state.tokens.find((t) => t.id !== token.id && t.folder && t.vaultId === token.vaultId && token.path?.startsWith(t.path + "/"));
            const narrowed = token.folder && state.tokens.some((t) => t.id !== token.id && t.vaultId === token.vaultId && t.path?.startsWith(token.path + "/"));
            const part = el(this.summary, "span", "kl-scope-part", (parent ? "\u21B3 " : "") + labelKind(token.kind) + " \xB7 " + label + (narrowed ? " \u203A" : ""));
            part.style.setProperty("--tag-color", COLORS[token.id] || COLORS[token.kind]);
            part.title = full + (token.context ? " \xB7 " + token.context : "");
            parts.set(index, part);
          });
          const emitted = /* @__PURE__ */ new Set();
          [...kinds.values()].flat().forEach((index) => {
            const token = state.tokens[index];
            const indices = kinds.get(token.kind), collapsed = indices.length > 1 && this.expandedKind !== token.kind;
            if (collapsed && emitted.has(token.kind)) return;
            emitted.add(token.kind);
            const live = this.rows.find((r) => r.id === token.id && axis(r.kind) === axis(token.kind));
            const warning = token.empty || !live && !(token.kind === "group" && token.ids?.every((id) => this.catalog.vaults.some((v) => v.id === id)));
            const full = collapsed ? labelKind(token.kind) + ": " + indices.map((i) => state.tokens[i].label).join("; ") : labelKind(token.kind) + ": " + (live?.label || token.label) + (warning ? " \xB7 unavailable" : "");
            const key = labelKind(token.kind) + (collapsed ? " \xD7" + indices.length : indices.length > 1 ? " " + (indices.indexOf(index) + 1) : "");
            const chip = el(this.chips, "span", "kl-filter-tag" + (warning ? " is-unavailable" : ""));
            chip.style.setProperty("--tag-color", collapsed ? COLORS[token.kind] : COLORS[token.id] || COLORS[token.kind]);
            chip.title = full;
            const button = el(chip, "button", "kl-tag-main");
            button.dataset.index = String(index);
            el(button, "span", "kl-tag-key", key);
            button.setAttribute("aria-label", full + (collapsed ? ". Select to expand individual filters." : ". Backspace removes; Enter edits."));
            if (collapsed) {
              button.onfocus = () => {
                const target = this.enterFromRight ? indices.at(-1) : indices[0];
                this.expandedKind = token.kind;
                this.render(false);
                this.focusTag(target);
              };
              button.onclick = () => button.focus();
            } else {
              button.onclick = () => button.focus();
              button.ondblclick = () => this.begin(token.kind, index);
              button.onkeydown = (e) => this.tagKey(e, index);
              const remove = el(chip, "button", "kl-tag-remove", "\xD7");
              remove.setAttribute("aria-label", "Remove " + full);
              remove.title = "Remove filter";
              remove.onclick = () => this.remove(index);
              button.onfocus = () => parts.get(index).classList.add("is-focused");
              button.onblur = () => parts.get(index).classList.remove("is-focused");
            }
            chip.onmouseenter = () => {
              for (const i of collapsed ? indices : [index]) parts.get(i).classList.add("is-focused");
            };
            chip.onmouseleave = () => {
              for (const i of collapsed ? indices : [index]) if (this.document.activeElement !== button) parts.get(i).classList.remove("is-focused");
            };
          });
          if (!state.tokens.length) el(this.summary, "span", "kl-scope-all", "All vaults \xB7 All sources \xB7 All types");
        }
        this.help.textContent = req.warnings.join(" ");
        if (draft) this.suggest();
        else {
          this.serial++;
          this.suggestions.hidden = true;
          this.input.setAttribute("aria-expanded", "false");
          this.input.setAttribute("aria-controls", this.browser.uid + "-list");
        }
      }
      async suggest() {
        const draft = this.model.state.draft, ticket = ++this.serial;
        this.choice = 0;
        this.matches = [];
        this.loading = true;
        this.suggestions.hidden = false;
        this.input.setAttribute("aria-expanded", "true");
        this.input.setAttribute("aria-controls", this.suggestions.id);
        this.input.removeAttribute("aria-activedescendant");
        this.suggestions.replaceChildren();
        el(this.suggestions, "div", "kl-suggestion-empty", draft.kind === "group-name" ? "Enter a group name, then press Enter." : "Finding " + draft.kind + "s\u2026");
        if (draft.kind === "group-name") {
          this.loading = false;
          return;
        }
        this.refreshRows();
        const selectedBooks = this.model.state.tokens.filter((t) => t.kind === "book"), books = selectedBooks.map((t) => this.rows.find((r) => r.kind === "book" && r.id === t.id)).filter(Boolean);
        this.chapterEmpty = draft.kind === "chapter" && selectedBooks.length ? books.length ? "No chapters in the selected books." : "The selected book is unavailable. Remove or replace its Book tag." : null;
        const query = normalize(draft.value), rows = this.rows.filter((r) => r.kind === draft.kind && (draft.kind !== "chapter" || !selectedBooks.length || books.some((b) => b.vaultId === r.vaultId && r.path.startsWith(b.path + "/")))), found = [], started = this.win.performance.now();
        let since = started;
        const editing = draft.edit == null ? null : this.model.state.tokens[draft.edit];
        for (let i = 0; i < rows.length; i++) {
          let score = rank(rows[i], query);
          if (editing && rows[i].id === editing.id && query === normalize(editing.label)) score += 1e4;
          if (score >= 0) found.push({ row: rows[i], score });
          if (i % 500 === 0 && this.win.performance.now() - since > 7) {
            await new Promise((resolve) => this.win.setTimeout(resolve, 0));
            if (ticket !== this.serial || this.browser.closed) return;
            since = this.win.performance.now();
          }
        }
        if (ticket !== this.serial || this.browser.closed) return;
        found.sort((a, b) => b.score - a.score || a.row.label.localeCompare(b.row.label) || a.row.context.localeCompare(b.row.context));
        this.matchCount = found.length;
        this.matches = found.slice(0, 30).map((m) => m.row);
        this.loading = false;
        this.drawChoices();
        this.browser.metrics.push({ type: "filter-suggestions", ms: this.win.performance.now() - started, catalogRows: rows.length, matches: found.length, rendered: this.matches.length });
      }
      drawChoices() {
        if (this.loading || !this.model.state.draft) return;
        if (this.model.state.draft.kind === "group-name") return;
        this.suggestions.replaceChildren();
        if (!this.matches.length) {
          el(this.suggestions, "div", "kl-suggestion-empty", this.chapterEmpty || "No " + this.model.state.draft.kind + " matches. Try another name, or Esc to cancel.");
          this.input.removeAttribute("aria-activedescendant");
          return;
        }
        const req = this.request();
        this.matches.forEach((row, i) => {
          const item = el(this.suggestions, "div", "kl-tag-option" + (i === this.choice ? " is-selected" : ""));
          item.id = this.browser.uid + "-filter-" + i;
          item.setAttribute("role", "option");
          item.setAttribute("aria-selected", String(i === this.choice));
          const text = el(item, "div", "kl-tag-option-text");
          el(text, "span", "kl-tag-option-label", row.label);
          el(text, "span", "kl-tag-option-context", row.context + (row.vaultId && req.vaultIds && !req.vaultIds.includes(row.vaultId) ? " \xB7 outside selected vaults" : ""));
          if (row.count != null) el(item, "span", "kl-tag-option-count", row.count + " entries");
          item.onmousedown = (e) => e.preventDefault();
          item.onclick = () => this.commit(row);
          if (i === this.choice) this.win.requestAnimationFrame(() => item.isConnected && item.scrollIntoView({ block: "nearest" }));
        });
        if (this.matchCount > 30) el(this.suggestions, "div", "kl-suggestion-empty", this.matchCount + " matches \xB7 keep typing to narrow");
        this.input.setAttribute("aria-activedescendant", this.browser.uid + "-filter-" + this.choice);
      }
      close() {
        this.serial++;
        this.host.remove();
      }
    };
  }
});

// plugin/title-renderer.js
var require_title_renderer = __commonJS({
  "plugin/title-renderer.js"(exports2, module2) {
    var { loadMathJax, renderMath, finishRenderMath } = require("obsidian");
    function segments(text) {
      const out = [];
      let plain = "", i = 0;
      const flush = () => {
        if (plain) {
          out.push({ text: plain });
          plain = "";
        }
      };
      while (i < text.length) {
        if (text.slice(i, i + 2) === "\\$") {
          plain += "$";
          i += 2;
          continue;
        }
        const opener = text.startsWith("$$", i) ? "$$" : text[i] === "$" ? "$" : ["\\(", "\\["].find((t) => text.startsWith(t, i));
        if (!opener) {
          plain += text[i++];
          continue;
        }
        const closer = opener === "\\(" ? "\\)" : opener === "\\[" ? "\\]" : opener;
        let end = i + opener.length;
        while (end < text.length) {
          if (text.startsWith(closer, end) && text[end - 1] !== "\\") break;
          end++;
        }
        if (end === text.length) {
          plain += text[i++];
          continue;
        }
        const tex = text.slice(i + opener.length, end);
        flush();
        out.push({ math: tex, raw: text.slice(i, end + closer.length) });
        i = end + closer.length;
      }
      flush();
      return out;
    }
    var TitleRenderer2 = class {
      constructor(document, redraw) {
        this.document = document;
        this.win = document.defaultView;
        this.cache = /* @__PURE__ */ new Map();
        this.queue = [];
        this.ready = false;
        this.closed = false;
        Promise.resolve().then(() => loadMathJax()).then(() => {
          if (!this.closed) {
            this.ready = true;
            redraw();
          }
        }).catch(() => {
        });
      }
      render(parent, key, title) {
        const cacheKey = JSON.stringify([key, title]);
        let entry = this.cache.get(cacheKey);
        if (!entry) {
          const node = this.document.createElement("div");
          node.className = "kl-row-title";
          node.textContent = title;
          const parts = segments(title);
          entry = { node, parts, done: !parts.some((p) => p.math != null), queued: false };
          if (entry.done) node.textContent = parts.map((p) => p.text).join("");
          this.cache.set(cacheKey, entry);
          if (this.cache.size > 256) this.cache.delete(this.cache.keys().next().value);
        }
        parent.appendChild(entry.node);
        if (this.ready && !entry.done && !entry.queued) {
          entry.queued = true;
          this.queue.push(entry);
        }
      }
      flush() {
        if (this.timer || !this.queue.length || this.closed) return;
        this.timer = this.win.setTimeout(() => this.pump(), 0);
      }
      pump() {
        this.timer = null;
        if (this.closed) return;
        const start = this.win.performance.now();
        let rendered = 0;
        while (this.queue.length && rendered < 2 && this.win.performance.now() - start < 6) {
          const entry = this.queue.shift();
          entry.queued = false;
          if (!entry.node.isConnected) continue;
          entry.node.replaceChildren();
          for (const part of entry.parts) {
            if (part.math != null) {
              try {
                const math = renderMath(part.math, false);
                this.mathDocument = math.ownerDocument;
                entry.node.appendChild(this.document.adoptNode(math));
              } catch {
                entry.node.appendChild(this.document.createTextNode(part.raw));
              }
            } else entry.node.appendChild(this.document.createTextNode(part.text));
          }
          entry.done = true;
          rendered++;
        }
        if (rendered) finishRenderMath().then(() => this.syncStyles()).catch(() => {
        });
        this.flush();
      }
      syncStyles() {
        if (this.closed || !this.mathDocument || this.mathDocument === this.document) return;
        const source = this.mathDocument.getElementById("MJX-CHTML-styles");
        if (!source) return;
        let target = this.document.getElementById("MJX-CHTML-styles");
        if (!target) {
          target = this.document.createElement("style");
          target.id = source.id;
          this.document.head.appendChild(target);
        }
        const css = source.sheet ? Array.from(source.sheet.cssRules, (r) => r.cssText).join("\n") : source.textContent;
        if (target.textContent !== css) target.textContent = css;
      }
      close() {
        this.closed = true;
        this.win.clearTimeout(this.timer);
        this.queue = [];
        this.cache.clear();
      }
    };
    module2.exports = { TitleRenderer: TitleRenderer2, segments };
  }
});

// plugin/admission.js
var require_admission = __commonJS({
  "plugin/admission.js"(exports2, module2) {
    var { Modal: Modal2, Component: Component2, MarkdownRenderer: MarkdownRenderer2, Notice: Notice2, MarkdownView: MarkdownView2, Menu: Menu2 } = require("obsidian");
    var crypto = require("crypto");
    var { Transaction } = require("@codemirror/state");
    var hash = (text) => crypto.createHash("sha256").update(text.replace(/\r\n?/g, "\n")).digest("hex");
    var NoteReview = class extends Modal2 {
      constructor(adapter, view) {
        super(adapter.plugin.app);
        this.adapter = adapter;
        this.view = view;
        this.file = view.file;
        this.selected = /* @__PURE__ */ new Set();
        this.closed = false;
        this.types = /* @__PURE__ */ new Set(["definition"]);
      }
      async onOpen() {
        this.modalEl.addClass("kl-review-modal");
        this.titleEl.setText("Review this note");
        this.typeButton = this.contentEl.createEl("button", { text: "Definitions", cls: "kl-scope-chip", attr: { "aria-label": "Choose entry types to add", "aria-haspopup": "menu" } });
        this.typeButton.onclick = (e) => this.chooseTypes(e);
        this.hint = this.contentEl.createDiv({ cls: "kl-status", text: "Reading saved callouts\u2026" });
        this.list = this.contentEl.createDiv({ cls: "kl-review-list" });
        const footer = this.contentEl.createDiv({ cls: "kl-footer" });
        this.all = footer.createEl("button", { text: "Select all shown" });
        this.all.onclick = () => {
          this.entries?.forEach((e, i) => this.matches(e) && e.complete && !e.admitted && !e.issue && this.selected.add(i));
          this.update();
        };
        this.button = footer.createEl("button", { text: "Add selected entries", cls: "mod-cta" });
        this.button.disabled = true;
        this.button.onclick = () => this.admit();
        this.scope.register(["Mod"], "Enter", () => {
          this.admit();
          return false;
        });
        this.owner = new Component2();
        this.owner.load();
        this.hint.oncontextmenu = (e) => this.pendingActions(e);
        try {
          const recovery = await this.adapter.request("live-recover");
          const markers = new Set([...this.view.editor.getValue().matchAll(/<!-- knowledge-library:([0-9a-f-]{36}) -->/g)].map((m) => m[1]));
          this.pending = recovery.pending.filter((p) => p.path === this.file.path || p.occurrenceIds?.some((id) => markers.has(id)));
          if (this.pending.length) {
            this.pendingButton = footer.createEl("button", { text: "Unfinished review" });
            this.pendingButton.onclick = (e) => this.pendingActions(e);
          }
          const text = await this.adapter.savedText(this.view);
          const preview = await this.adapter.request("live-preview", { path: this.file.path, sourceHash: hash(text) });
          if (this.closed) return;
          this.sourceHash = preview.sourceHash;
          this.entries = preview.entries;
          this.text = text;
          this.observer = new IntersectionObserver((changes) => {
            for (const change of changes) if (change.isIntersecting) {
              this.observer.unobserve(change.target);
              this.renderBody(change.target);
            }
          }, { root: this.list, rootMargin: "300px" });
          this.entries.forEach((e, i) => {
            if (e.complete && !e.admitted && !e.issue) this.selected.add(i);
          });
          this.renderCards();
          this.update();
        } catch (e) {
          this.hint.setText(e.message);
        }
      }
      matchesType(entry) {
        return this.types === null || this.types.has(entry.kind);
      }
      needsReview(entry) {
        return !entry.admitted || !!entry.issue || !entry.complete;
      }
      matches(entry) {
        return this.matchesType(entry) && this.needsReview(entry);
      }
      selectedIndices() {
        return [...this.selected].filter((i) => {
          const e = this.entries?.[i];
          return e && this.matches(e) && e.complete && !e.admitted && !e.issue;
        });
      }
      typeLabel(kind) {
        return { definition: "Definitions", notation: "Notation", equation: "Equations", theorem: "Theorems", result: "Results", lemma: "Lemmas", corollary: "Corollaries", proposition: "Propositions", assumption: "Assumptions", rule: "Rules", convention: "Conventions", table: "Tables", law: "Laws", principle: "Principles", postulate: "Postulates" }[kind] || kind;
      }
      chooseTypes(event) {
        if (!this.entries || this.busy) return;
        const counts = /* @__PURE__ */ new Map();
        this.entries.forEach((e) => counts.set(e.kind, (counts.get(e.kind) || 0) + (this.needsReview(e) ? 1 : 0)));
        const menu = new Menu2();
        menu.addItem((i) => i.setTitle("All entry types").setChecked(this.types === null).onClick(() => this.setTypes(null)));
        menu.addSeparator();
        for (const [kind, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
          menu.addItem((i) => i.setTitle(this.typeLabel(kind) + " (" + count + ")").setChecked(this.types === null || this.types.has(kind)).onClick(() => {
            const types = this.types === null ? /* @__PURE__ */ new Set([kind]) : new Set(this.types);
            if (this.types !== null) {
              types.has(kind) ? types.delete(kind) : types.add(kind);
            }
            this.setTypes(types);
          }));
        }
        if (event?.clientX != null) menu.showAtMouseEvent(event);
        else {
          const r = this.typeButton.getBoundingClientRect();
          menu.showAtPosition({ x: r.left, y: r.bottom });
        }
      }
      setTypes(types) {
        if (this.busy) return;
        this.types = types;
        this.renderCards();
        this.update();
      }
      renderCards() {
        this.observer.disconnect();
        this.list.empty();
        this.entries.forEach((entry, i) => {
          entry.box = null;
          if (!this.matches(entry)) return;
          const card = this.list.createDiv({ cls: "kl-review-card" });
          const label = card.createEl("label", { cls: "kl-review-choice" });
          const box = label.createEl("input", { type: "checkbox", attr: { "aria-label": "Select " + entry.title } });
          box.disabled = !entry.complete || entry.admitted || !!entry.issue;
          label.createSpan({ text: entry.kind + " \xB7 line " + entry.line_start + (entry.issue ? " \xB7 " + entry.issue : !entry.complete ? " \xB7 finish writing before " + (entry.admitted ? "updating" : "adding") : "") });
          box.onchange = () => {
            box.checked ? this.selected.add(i) : this.selected.delete(i);
            this.update();
          };
          entry.box = box;
          const body = card.createDiv({ cls: "markdown-rendered" });
          body.dataset.entryIndex = String(i);
          body.setText(entry.title);
          this.observer.observe(body);
        });
        if (!this.entries.some((e) => this.matches(e))) this.list.createEl("p", { text: this.entries.some((e) => this.matchesType(e)) ? "These entries are already indexed. Nothing to add." : "No entries of these types in this note. Choose another type above." });
      }
      pendingActions(event) {
        if (!this.pending?.length) return;
        const menu = new Menu2();
        menu.addItem((i) => i.setTitle("Discard unfinished admission for this note").onClick(async () => {
          try {
            for (const plan of this.pending) await this.adapter.request("live-cancel", { token: plan.token, capability: this.adapter.client.capability });
            this.pending = [];
            this.pendingButton?.remove();
            new Notice2("Unfinished admission discarded. Saved note text is unchanged.");
          } catch (e) {
            new Notice2(e.message);
          }
        }));
        if (event?.clientX != null) menu.showAtMouseEvent(event);
        else menu.showAtPosition({ x: 100, y: 100 });
      }
      async renderBody(el) {
        if (this.closed) return;
        const entry = this.entries[Number(el.dataset.entryIndex)];
        el.empty();
        try {
          await MarkdownRenderer2.render(this.app, entry.body.replace(/^(\s*>\s*\[![^\]]+\])[-+]/gm, "$1"), el, this.file.path, this.owner);
        } catch (e) {
          if (!this.closed) el.setText("Preview unavailable: " + e.message);
        }
      }
      update() {
        if (!this.entries) return;
        this.entries.forEach((e, i) => {
          if (e.box) e.box.checked = this.selected.has(i);
        });
        const selected = this.selectedIndices().length, shown = this.entries.filter((e) => this.matches(e)).length;
        this.button.disabled = this.busy || !selected;
        this.button.setText(`Add ${selected || "selected"} entries`);
        this.typeButton.disabled = !!this.busy;
        this.all.disabled = !!this.busy || !this.entries.some((e) => this.matches(e) && e.complete && !e.admitted && !e.issue);
        this.typeButton.setText(this.types === null ? "All entry types" : this.types.size ? [...this.types].map((t) => this.typeLabel(t)).join(" + ") : "Choose entry types");
        this.hint.setText(`${shown} shown \xB7 ${selected} selected \xB7 \u2318Enter add \xB7 Escape cancel`);
      }
      async admit() {
        const selected = this.selectedIndices();
        if (this.busy || !selected.length || this.closed) return;
        this.busy = true;
        this.update();
        this.adapter.paused.add(this.file.path);
        try {
          if (this.view.file?.path !== this.file.path || hash(this.view.editor.getValue()) !== this.sourceHash) throw new Error("The note changed. Close and review it again.");
          await this.adapter.savedText(this.view);
          const plan = await this.adapter.request("live-prepare", { path: this.file.path, sourceHash: this.sourceHash, selected: selected.map((i) => ({ line_start: this.entries[i].line_start, body_sha256: this.entries[i].body_sha256 })), capability: this.adapter.client.capability });
          if (plan.alreadyAdmitted) {
            new Notice2("These entries are already in the reviewed index.");
            this.close();
            return;
          }
          if (this.closed || hash(this.view.editor.getValue()) !== plan.beforeHash) throw new Error("The note changed. No markers were inserted. Review it again.");
          const editor = this.view.editor;
          if (plan.insertions.length) {
            const changes = plan.insertions.map((insertion) => ({ from: insertion.line < editor.lineCount() ? { line: insertion.line, ch: 0 } : { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length }, text: insertion.text }));
            editor.transaction({ changes }, "knowledge-library-admission");
            if (hash(editor.getValue()) !== plan.afterHash) throw new Error("Marker placement needs review. The batch was not admitted. Use editor Undo to restore it.");
          }
          await this.adapter.savedText(this.view, plan.afterHash);
          const receipt = await this.adapter.request("live-finish", { token: plan.token });
          this.adapter.paths.add(this.file.path);
          this.adapter.lastReceipt = receipt;
          new Notice2(`Added ${receipt.entries.length} entries to the index.`);
          this.close();
        } catch (e) {
          if (!this.closed) this.hint.setText(e.message);
          new Notice2(e.message, 8e3);
        } finally {
          this.busy = false;
          this.adapter.paused.delete(this.file.path);
          this.adapter.schedule(this.file.path);
          if (!this.closed) this.update();
        }
      }
      onClose() {
        this.closed = true;
        this.observer?.disconnect();
        this.owner?.unload();
        this.contentEl.empty();
      }
    };
    module2.exports = class AdmissionAdapter {
      constructor(plugin, client) {
        this.plugin = plugin;
        this.client = client;
        this.paths = /* @__PURE__ */ new Set();
        this.paused = /* @__PURE__ */ new Set();
        this.timers = /* @__PURE__ */ new Map();
        this.closed = false;
      }
      async start() {
        const status = await this.client.request({ op: "live-status" });
        this.meta = { profile: status.profile, epoch: status.epoch };
        this.paths = new Set(status.data.paths);
        const recovery = await this.request("live-recover");
        if (recovery.pending.length) new Notice2(`${recovery.pending.length} admission reviews are pending; reopen note review to reconcile.`, 1e4);
        if (recovery.recovered.length) {
          const fresh = await this.request("live-status");
          this.paths = new Set(fresh.paths);
        }
        for (const p of this.paths) this.schedule(p);
      }
      async request(op, args = {}) {
        const result = await this.client.request({ op, ...this.meta, ...args });
        return result.data;
      }
      async savedText(view, expected) {
        const file = view.file;
        if (!file) throw new Error("Open a Markdown note first.");
        const original = view.editor.getValue(), digest = expected || hash(original);
        for (let i = 0; i < 30; i++) {
          if (this.closed || view.file?.path !== file.path || hash(view.editor.getValue()) !== digest) throw new Error("The note changed while saving. Review the current text.");
          const disk = await this.plugin.app.vault.read(file);
          if (hash(disk) === digest) return disk;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("The note has not finished saving. Try again in a moment.");
      }
      async review() {
        try {
          await this.ready;
          const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView2);
          if (!view?.file) {
            new Notice2("Open a Markdown note to review its callouts.");
            return;
          }
          new NoteReview(this, view).open();
        } catch (e) {
          new Notice2(e.message);
        }
      }
      async reuse(view, entry, line, expectedHash, portableBody, admitCopy = true) {
        await this.ready;
        if (!view?.file || hash(view.editor.getValue()) !== expectedHash) throw new Error("The destination note changed. Reopen the index from that note.");
        const path2 = view.file.path;
        this.paused.add(path2);
        try {
          await this.savedText(view, expectedHash);
          const plan = await this.request("live-reuse", { id: entry.id, revision: entry.revision, path: path2, line, sourceHash: expectedHash, portableBody, admitCopy, capability: this.client.capability });
          if (view.file?.path !== path2 || hash(view.editor.getValue()) !== plan.beforeHash) throw new Error("The destination note changed before insertion.");
          view.editor.transaction({ changes: plan.insertions.map((i) => ({ from: { line: i.line, ch: i.ch || 0 }, text: i.text })) }, "knowledge-library-reuse");
          if (hash(view.editor.getValue()) !== plan.afterHash) throw new Error("Insertion needs review. Use editor Undo to restore the note.");
          await this.savedText(view, plan.afterHash);
          const receipt = await this.request("live-finish", { token: plan.token });
          this.paths.add(path2);
          new Notice2(admitCopy ? "Added an editable copy. Changes update its index version automatically." : "Added a linked copy. Review any new wording with the entries in this note.");
          return receipt;
        } finally {
          this.paused.delete(path2);
          this.schedule(path2);
        }
      }
      schedule(path2) {
        if (this.closed) return;
        if (!this.paths.has(path2)) {
          clearTimeout(this.timers.get(path2));
          this.timers.set(path2, setTimeout(() => this.discover(path2), 1200));
          return;
        }
        clearTimeout(this.timers.get(path2));
        this.timers.set(path2, setTimeout(() => this.sync(path2).catch((e) => new Notice2("Index update pending: " + e.message)), 1800));
      }
      async sync(path2) {
        this.timers.delete(path2);
        if (this.closed) return;
        if (this.paused.has(path2)) {
          this.schedule(path2);
          return;
        }
        const views = this.plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).filter((v) => v.file?.path === path2);
        const file = this.plugin.app.vault.getAbstractFileByPath(path2);
        if (file) {
          const disk = await this.plugin.app.vault.read(file);
          if (views.some((v) => v.editor && hash(v.editor.getValue()) !== hash(disk))) {
            this.schedule(path2);
            return;
          }
        }
        try {
          const result = await this.request("live-sync", { path: path2 });
          if (result.repair && file) {
            const repair = result.repair, view = views.find((v) => v.editor);
            if (view && hash(view.editor.getValue()) === repair.beforeHash) {
              const editor = view.editor;
              const changes = repair.insertions.map((i) => ({ from: editor.posToOffset(i.line < editor.lineCount() ? { line: i.line, ch: 0 } : { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length }), insert: i.text }));
              editor.cm.dispatch({ changes, annotations: Transaction.addToHistory.of(false) });
            } else if (!views.length) {
              await this.plugin.app.vault.process(file, (current) => hash(current) === repair.beforeHash ? repair.proposedText : current);
            }
            this.schedule(path2);
          }
          if (result.receipt) this.plugin.refreshBrowsers();
        } catch (e) {
          if (e.message.startsWith("Note changed during synchronization")) this.schedule(path2);
          else new Notice2("Index update pending: " + e.message, 6e3);
        }
      }
      async discover(path2) {
        this.timers.delete(path2);
        if (this.closed || !path2.endsWith(".md")) return;
        try {
          await this.ready;
          const file = this.plugin.app.vault.getAbstractFileByPath(path2);
          if (file && (await this.plugin.app.vault.read(file)).includes("<!-- knowledge-library:")) {
            const result = await this.request("live-relocate", { path: path2 });
            if (result.receipt) {
              this.paths.add(path2);
              this.schedule(path2);
              this.plugin.refreshBrowsers();
            }
          }
          await this.recover();
        } catch (e) {
          if (!e.message.startsWith("Note changed during synchronization")) new Notice2("Index source check: " + e.message);
        }
      }
      async recover() {
        if (this.closed) return;
        try {
          await this.ready;
          const result = await this.request("live-recover");
          if (result.recovered.length) {
            const status = await this.request("live-status");
            this.paths = new Set(status.paths);
            this.plugin.refreshBrowsers();
            new Notice2("Finished the saved index admission.");
          }
        } catch (e) {
          new Notice2("Index admission recovery: " + e.message, 8e3);
        }
      }
      async rename(file, oldPath) {
        if (!this.paths.has(oldPath) && file.extension !== "md") {
          if (!file.children) return;
          const descendants = [...this.paths].filter((p) => p.startsWith(oldPath + "/"));
          try {
            await this.request("live-move-tree", { oldPath, path: file.path });
            for (const p of descendants) {
              this.paths.delete(p);
              this.paths.add(file.path + p.slice(oldPath.length));
            }
            this.plugin.refreshBrowsers();
          } catch (e) {
            new Notice2("Index folder move needs review: " + e.message, 8e3);
          }
          return;
        }
        try {
          await this.request("live-rename", { oldPath, path: file.path });
          this.paths.delete(oldPath);
          this.paths.add(file.path);
          this.schedule(file.path);
          this.plugin.refreshBrowsers();
        } catch (e) {
          new Notice2("Index source move needs review: " + e.message, 8e3);
        }
      }
      close() {
        this.closed = true;
        clearTimeout(this.recoveryTimer);
        for (const t of this.timers.values()) clearTimeout(t);
        this.client.close();
      }
    };
  }
});

// plugin/tracking-model.js
var require_tracking_model = __commonJS({
  "plugin/tracking-model.js"(exports2, module2) {
    var pattern = () => /^[ \t]*<!-- knowledge-library(-start)?:([0-9a-f-]{36}) -->[ \t]*$/gm;
    function markers(text) {
      return [...text.matchAll(pattern())].map((m) => ({ id: m[2], start: !!m[1], from: m.index, to: m.index + m[0].length, key: m[0].trim() }));
    }
    function losesMarkers(before, after) {
      const remaining = new Set(markers(after).map((m) => m.key));
      return markers(before).some((m) => !remaining.has(m.key));
    }
    function deletionPlan(before, after, changes, mapPos = null, oldItems = null, newItems = null) {
      const old = oldItems || markers(before), next = newItems || markers(after), deleted = /* @__PURE__ */ new Set(), cleanup = [];
      for (const start of old.filter((m) => m.start)) {
        const ends = old.filter((m) => !m.start && m.id === start.id && m.from > start.to);
        if (!ends.length) continue;
        const end = ends[0], body = before.slice(start.to, end.from);
        const callout = body.match(/^[ \t]*>[ \t]*\[![^\n]*(?:\n[ \t]*>[^\n]*)*/m);
        const trimmed = (callout?.[0] || "").replace(/^[\s>]+|[\s>]+$/g, "");
        const bodyStart = start.to + body.indexOf(trimmed), bodyEnd = bodyStart + trimmed.length;
        const a = next.find((m) => m.start && m.id === start.id && (!mapPos || m.from === mapPos(start.from, 1)));
        const b = next.find((m) => !m.start && m.id === start.id && (!mapPos || m.from === mapPos(end.from, 1)));
        if (a && b) {
          if (/^[ \t]*>[ \t]*\[!/m.test(after.slice(a.to, b.from))) continue;
        } else if (!trimmed || !changes.some((c) => c.from <= bodyStart && c.to >= bodyEnd)) continue;
        deleted.add(start.id);
        for (const m of [a, b]) if (m) cleanup.push({ from: m.from, to: Math.min(after.length, m.to + (after[m.to] === "\n" ? 1 : 0)), insert: "" });
      }
      const remainingOld = old.filter((m) => !deleted.has(m.id)).map((m) => m.key).join("\n");
      const allowed = !losesMarkers(remainingOld, after);
      return { allowed, cleanup: cleanup.sort((a, b) => a.from - b.from) };
    }
    function mapMarkers(items, tr) {
      const ranges = [];
      tr.changes.iterChangedRanges((from, to, nextFrom, nextTo) => ranges.push({ from, to, nextFrom: tr.newDoc.lineAt(nextFrom).from, nextTo: tr.newDoc.lineAt(nextTo).to }));
      const mapped = items.filter((m) => !ranges.some((r) => r.from <= m.to && r.to >= m.from)).map((m) => ({ ...m, from: tr.changes.mapPos(m.from, 1), to: tr.changes.mapPos(m.to, -1) })).filter((m) => !ranges.some((r) => r.nextFrom <= m.to && r.nextTo >= m.from));
      const added = /* @__PURE__ */ new Map();
      for (const r of ranges) for (const m of markers(tr.newDoc.sliceString(r.nextFrom, r.nextTo))) {
        m.from += r.nextFrom;
        m.to += r.nextFrom;
        added.set(m.from, m);
      }
      return [...mapped, ...added.values()].sort((a, b) => a.from - b.from);
    }
    module2.exports = { markers, losesMarkers, deletionPlan, mapMarkers };
  }
});

// plugin/tracking.js
var require_tracking = __commonJS({
  "plugin/tracking.js"(exports2, module2) {
    var { EditorState, Annotation, StateField } = require("@codemirror/state");
    var { EditorView, Decoration } = require("@codemirror/view");
    var { Notice: Notice2, Modal: Modal2, editorInfoField } = require("obsidian");
    var { markers, deletionPlan, mapMarkers } = require_tracking_model();
    var deliberateRemoval = Annotation.define();
    module2.exports = function registerTracking2(plugin) {
      let lastNotice = 0;
      plugin.registerEditorExtension(EditorState.transactionFilter.of((tr) => {
        if (!tr.docChanged || tr.annotation(deliberateRemoval)) return tr;
        const before = tr.startState.field(editorInfoField, false)?.file, after = tr.state.field(editorInfoField, false)?.file;
        if (!before || before.path !== after?.path) return tr;
        const changes = [];
        tr.changes.iterChangedRanges((from, to) => changes.push({ from, to }));
        if (tr.isUserEvent("undo") || tr.isUserEvent("redo")) return tr;
        const old = tr.startState.field(hidden).items;
        const touched = old.some((m) => {
          const end = m.start ? old.find((e) => !e.start && e.id === m.id && e.from > m.to) : m;
          return end && changes.some((c) => c.from <= end.to + 1 && c.to >= m.from);
        });
        if (!touched) return tr;
        const plan = deletionPlan(tr.startState.doc.toString(), tr.newDoc.toString(), changes, (pos, assoc) => tr.changes.mapPos(pos, assoc), old, mapMarkers(old, tr));
        if (plan.allowed) return plan.cleanup.length ? [tr, { changes: plan.cleanup, sequential: true }] : tr;
        if (Date.now() - lastNotice > 2500) {
          lastNotice = Date.now();
          new Notice2("Index links are protected. Use \u201CRemove index links from selection\u201D to remove them deliberately.");
        }
        return [];
      }));
      const hidden = StateField.define({
        create: (state) => decorate(markers(state.doc.toString()), state.doc.length),
        update: (value, tr) => tr.docChanged ? decorate(mapMarkers(value.items, tr), tr.newDoc.length) : value,
        provide: (field) => [EditorView.decorations.from(field, (value) => value.decorations), EditorView.atomicRanges.of((view) => view.state.field(field).decorations)]
      });
      function decorate(items, length) {
        return { items, decorations: Decoration.set(items.map((m) => Decoration.replace({ block: true }).range(m.from, Math.min(length, m.to + 1))), true) };
      }
      plugin.registerEditorExtension(hidden);
      plugin.registerEditorExtension(EditorView.updateListener.of((update) => {
        for (const tr of update.transactions) {
          if (!tr.docChanged || !tr.isUserEvent("undo")) continue;
          const file = tr.state.field(editorInfoField, false)?.file;
          if (!file) continue;
          const before = tr.startState.doc.toString(), after = tr.newDoc.toString(), old = markers(before), next = markers(after), ids = [];
          for (const start of old.filter((m) => m.start)) {
            const end = old.find((m) => !m.start && m.id === start.id && m.from > start.to);
            if (end && !next.some((m) => m.id === start.id) && after.includes(before.slice(start.to, end.from).trim())) ids.push(start.id);
          }
          if (ids.length) plugin.admission.ready.then(() => plugin.admission.request("live-stop-tracking", { path: file.path, ids, archive: true, capability: plugin.admission.client.capability })).catch((e) => new Notice2(e.message));
        }
      }));
      plugin.addCommand({ id: "remove-tracking", name: "Remove index links from selection", editorCheckCallback: (checking, editor, info) => {
        const cm = editor.cm;
        if (!cm || !info.file) return false;
        const from = editor.posToOffset(editor.getCursor("from")), to = editor.posToOffset(editor.getCursor("to"));
        const text = editor.getValue(), all = markers(text);
        const selected = new Set(all.filter((m) => m.from >= from && m.to <= to || m.start && m.from <= from && all.some((end) => !end.start && end.id === m.id && end.to >= to)).map((m) => m.id));
        if (!selected.size) return false;
        if (checking) return true;
        const modal = new Modal2(plugin.app);
        modal.titleEl.setText("Remove these index links?");
        modal.contentEl.createEl("p", { text: "The passage text and saved index versions remain. Automatic updates from these passages will stop." });
        const button = modal.contentEl.createEl("button", { text: "Remove links", cls: "mod-warning" });
        button.onclick = async () => {
          if (editor.getValue() !== text) {
            new Notice2("The note changed. Select the passage again.");
            modal.close();
            return;
          }
          try {
            await plugin.admission.request("live-stop-tracking", { path: info.file.path, ids: [...selected], capability: plugin.admission.client.capability });
          } catch (e) {
            new Notice2(e.message);
            return;
          }
          if (editor.getValue() !== text) {
            new Notice2("The note changed. Its saved index version is retained; select the links again.");
            modal.close();
            return;
          }
          cm.dispatch({ changes: all.filter((m) => selected.has(m.id)).map((m) => ({ from: m.from, to: m.to, insert: "" })), annotations: deliberateRemoval.of(true), userEvent: "input.library-unlink" });
          modal.close();
        };
        modal.open();
        return true;
      } });
    };
  }
});

// plugin/main.js
var { Plugin, Modal, Component, MarkdownRenderer, Notice, Menu, MarkdownView, ItemView, Scope, Platform } = require("obsidian");
var { spawn } = require("child_process");
var fs = require("fs");
var path = require("path");
var startMonitor = require_monitor();
var FilterBar = require_filter_bar();
var { TitleRenderer } = require_title_renderer();
var { typeLabel } = require_filter_model();
var AdmissionAdapter = require_admission();
var registerTracking = require_tracking();
var ROOT = "/Users/gradyclopton/Projects/cross-vault-library-lab";
var CORPUS = path.join(ROOT, "test-corpus-20261020-v4");
var PALETTE = {
  definition: "238,255,0",
  notation: "166,139,255",
  theorem: "43,230,109",
  result: "43,230,109",
  lemma: "43,230,109",
  corollary: "43,230,109",
  proposition: "43,230,109",
  equation: "96,183,255",
  assumption: "255,183,94",
  rule: "255,183,94",
  convention: "255,183,94"
};
var Client = class {
  constructor(vaultRoot = null, production = false, libraryRoot = null) {
    this.serial = 0;
    this.pending = /* @__PURE__ */ new Map();
    this.buffer = "";
    this.capability = require("crypto").randomBytes(32).toString("hex");
    const args = vaultRoot ? ["-u", path.join(ROOT, "reviewed_service.py"), "--root", libraryRoot || path.join(ROOT, "reviewed-library-test"), "--vault", vaultRoot, ...production ? ["--production", "--enroll"] : []] : ["-u", path.join(ROOT, "query_service.py"), "--corpus", CORPUS];
    this.process = spawn("/usr/bin/python3", args, { stdio: ["pipe", "pipe", "pipe"], env: { ...require("process").env, KL_REVIEW_CAPABILITY: this.capability } });
    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString();
      let end;
      while ((end = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, end);
        this.buffer = this.buffer.slice(end + 1);
        try {
          const result = JSON.parse(line), wait = this.pending.get(result.requestId);
          if (wait) {
            clearTimeout(wait.timer);
            this.pending.delete(result.requestId);
            result.error ? wait.reject(new Error(result.error)) : wait.resolve(result);
          }
        } catch {
          this.fail(new Error("Invalid response from the local index service."));
        }
      }
    });
    this.process.on("error", (e) => this.fail(e));
    this.process.on("exit", () => {
      this.dead = true;
      const reason = (this.errorTail || "").trim().split("\n").pop();
      this.fail(new Error("Local index service stopped." + (reason ? " " + reason : "") + " Reopen the index to reconnect."));
    });
    this.process.stderr.on("data", (chunk) => {
      this.errorTail = ((this.errorTail || "") + chunk.toString()).slice(-1800);
    });
  }
  fail(e) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(e);
    }
    this.pending.clear();
  }
  request(payload) {
    if (this.dead) return Promise.reject(new Error("Local index service is unavailable."));
    const requestId = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Search took too long. Try a shorter query."));
      }, 15e3);
      this.pending.set(requestId, { resolve, reject, timer });
      this.process.stdin.write(JSON.stringify({ ...payload, requestId }) + "\n", (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(requestId);
          reject(error);
        }
      });
    });
  }
  close() {
    this.dead = true;
    this.fail(new Error("Browser closed"));
    this.process.kill();
  }
};
var LibraryBrowser = class extends Modal {
  constructor(plugin, reviewed = false) {
    super(plugin.app);
    this.plugin = plugin;
    this.reviewed = reviewed;
    this.settings = reviewed ? plugin.settings.reviewed : plugin.settings;
    this.ticket = 0;
    this.previewTicket = 0;
    this.rows = [];
    this.selected = 0;
    this.offset = 0;
    this.offsets = {};
    this.drafts = false;
    this.vaultIds = this.settings.vaultIds;
    this.scopeGroupId = this.settings.scopeGroupId;
    this.typeIds = this.settings.typeIds;
    this.sourceIds = this.settings.sourceIds ?? null;
    this.sourceCatalog = [];
    this.catalog = [];
    this.typeCatalog = [];
    this.cache = /* @__PURE__ */ new Map();
    this.metrics = [];
    this.closed = false;
    this.uid = "kl-" + Date.now();
    this.destination = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (this.destination?.file) {
      this.destinationPath = this.destination.file.path;
      this.destinationLine = this.destination.editor.getCursor().line;
      this.destinationHash = require("crypto").createHash("sha256").update(this.destination.editor.getValue().replace(/\r\n?/g, "\n")).digest("hex");
    }
  }
  onOpen() {
    this.client = this.reviewed ? this.plugin.admission.client : new Client();
    this.owner = new Component();
    this.owner.load();
    this.monitor = this.plugin.production ? null : startMonitor(this.app, path.join(ROOT, "outputs"), this.contentEl.ownerDocument.defaultView);
    this.modalEl.addClass("kl-modal");
    this.titleEl.setText("Index");
    const head = this.contentEl.createDiv({ cls: "kl-head" });
    this.scopeChip = head.createDiv({ cls: "kl-scope-summary", attr: { "aria-label": "Active search filters" } });
    head.createSpan({ text: this.plugin.production ? "REVIEWED" : this.reviewed ? "REVIEWED \xB7 TEST" : "CORPUS \xB7 TEST", cls: "kl-test" });
    this.titleRenderer = new TitleRenderer(this.contentEl.ownerDocument, () => this.draw());
    this.filterBar = new FilterBar(this, this.contentEl, this.scopeChip);
    this.input = this.filterBar.input;
    this.status = this.contentEl.createDiv({ cls: "kl-status", attr: { role: "status", "aria-live": "polite" } });
    const panes = this.contentEl.createDiv({ cls: "kl-panes" });
    this.list = panes.createDiv({ cls: "kl-list", attr: { role: "listbox", id: this.uid + "-list", "aria-label": "Search results" } });
    this.layer = this.list.createDiv({ cls: "kl-layer" });
    this.preview = panes.createDiv({ cls: "kl-preview", attr: { tabindex: "0", "aria-label": "Entry preview" } });
    const foot = this.contentEl.createDiv({ cls: "kl-footer" });
    foot.createSpan({ text: "\u2191 \u2193 browse \xB7 Enter read \xB7 \u2318Enter source \xB7 \u2318. actions" });
    this.pages = foot.createSpan({ cls: "kl-page-status" });
    this.list.onscroll = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.draw());
    };
    this.list.oncontextmenu = (e) => {
      e.preventDefault();
      this.actions(e);
    };
    this.resize = new this.contentEl.ownerDocument.defaultView.ResizeObserver(() => this.draw());
    this.resize.observe(this.list);
    const shortcuts = { ".": () => this.actions(), k: () => this.plugin.openPane(true, this.filterBar.snapshot()), f: () => {
      this.input.focus();
      this.input.select();
    }, e: () => this.chooseScope(), "shift+a": () => this.filterBar.clear() };
    for (const [key, fn] of Object.entries(shortcuts)) this.scope.register(key.startsWith("shift+") ? ["Mod", "Shift"] : ["Mod"], key.split("+").pop(), () => {
      fn();
      return false;
    });
    this.scope.register(["Mod", "Shift"], "h", () => {
      this.showHistory();
      return false;
    });
    this.scope.register(["Mod", "Shift"], "Enter", () => {
      if (!this.filterBar.blocked()) this.reuseSelected();
      return false;
    });
    this.loadCatalog();
    this.input.focus();
    this.plugin.active = this;
    this.plugin.browsers.add(this);
    this.contentEl.addEventListener("focusin", () => {
      this.plugin.active = this;
    });
  }
  async loadCatalog() {
    this.pendingSearch = true;
    try {
      const response = await this.client.request({ op: "catalog", previousProfile: this.settings.profile });
      if (this.closed) return;
      this.catalog = response.data.vaults;
      this.typeCatalog = response.data.types;
      this.sourceCatalog = response.data.sources || [];
      this.profile = response.profile;
      const migrate = (ids) => ids === null ? null : ids.map((id) => this.catalog.find((v) => v.legacyId === id)?.id || id);
      this.vaultIds = migrate(this.vaultIds);
      for (const group of this.settings.groups) group.vaultIds = migrate(group.vaultIds);
      this.settings.profile = this.profile;
      this.settings.vaultIds = this.vaultIds;
      this.plugin.persist().catch(() => new Notice("Filter settings could not be saved."));
      this.filterBar.load({ vaults: this.catalog, types: this.typeCatalog, sources: this.sourceCatalog }, this.settings, this.restoredState);
      this.restoredState = null;
      this.search();
    } catch (e) {
      if (!this.closed) {
        this.pendingSearch = false;
        this.status.setText(e.message);
      }
    }
  }
  vaultLabel() {
    if (this.vaultIds === null) return "All vaults";
    const group = this.settings.groups.find((g) => g.id === this.scopeGroupId);
    const missing = this.vaultIds.filter((id) => !this.catalog.some((v) => v.id === id)).length;
    if (group) return group.name + " (group)" + (missing ? " \xB7 " + missing + " unavailable" : "");
    if (!this.vaultIds.length) return "No vaults selected";
    const names = this.vaultIds.map((id) => this.catalog.find((v) => v.id === id)?.label || "Unavailable vault");
    return names.length <= 2 ? names.join(" + ") : names.length + " vaults";
  }
  sourceLabel() {
    if (this.sourceIds === null) return "";
    if (!this.sourceIds.length) return "No sources selected";
    return this.sourceIds.length === 1 ? (() => {
      const source = this.sourceCatalog.find((s) => s.id === this.sourceIds[0]), book = this.sourceCatalog.find((s) => s.id === source?.parentId);
      return source ? (book ? book.label + " \u203A " : "") + source.label : "Unavailable source";
    })() : this.sourceIds.length + " sources";
  }
  scopeLabel() {
    return [this.vaultLabel(), this.sourceLabel()].filter(Boolean).join(" \xB7 ") + " \xB7 " + (this.typeIds === null ? "all types" : !this.typeIds.length ? "no types selected" : this.typeIds.length <= 2 ? this.typeIds.map(typeLabel).join(" + ") : this.typeIds.length + " types");
  }
  updateScopeChip() {
    this.filterBar?.render(false);
  }
  chooseScope() {
    this.filterBar?.begin("book");
  }
  filtersChanged(search = true) {
    if (!this.filterBar?.model) return;
    const request = this.filterBar.request();
    this.vaultIds = request.vaultIds;
    this.typeIds = request.types;
    this.sourceIds = request.sourceIds;
    this.scopeGroupId = null;
    this.settings.filters = this.filterBar.model.saved();
    this.settings.filters.state.query = "";
    this.settings.vaultIds = this.vaultIds;
    this.settings.typeIds = this.typeIds;
    this.settings.sourceIds = this.sourceIds;
    this.settings.scopeGroupId = null;
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.plugin.persist().catch(() => new Notice("Filters could not be saved.")), 180);
    this.app.workspace.requestSaveLayout?.();
    clearTimeout(this.searchTimer);
    this.ticket++;
    this.pendingSearch = true;
    this.offsets = {};
    if (this.filterBar.blocked()) {
      this.status.setText("Choose a filter match \xB7 Enter select \xB7 Esc cancel");
      this.list?.removeAttribute("aria-busy");
      return;
    }
    if (search) {
      this.inputAt = performance.now();
      this.searchTimer = setTimeout(() => this.search(), 40);
    }
  }
  async applyScope(ids, groupId = null, types = null, sources = null) {
    if (ids === null && types === null && sources === null) this.filterBar.clear();
  }
  scopeRequest() {
    if (this.filterBar?.model) {
      const { vaultIds, types, sourceIds } = this.filterBar.request();
      return { vaultIds, types, sourceIds, drafts: this.drafts, profile: this.profile };
    }
    return { vaultIds: this.vaultIds === null ? null : this.vaultIds.filter((id) => this.catalog.some((v) => v.id === id)), sourceIds: this.sourceIds == null ? null : this.sourceIds.filter((id) => this.sourceCatalog.some((s) => s.id === id)), types: this.typeIds, drafts: this.drafts, profile: this.profile };
  }
  keys(e) {
    if (e.isComposing || this.filterBar?.blocked()) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (e.shiftKey) {
        this.preview.scrollBy({ top: e.key === "ArrowDown" ? 100 : -100 });
        return;
      }
      this.move(e.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      this.page(e.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      this.move(e.key === "PageDown" ? 5 : -5);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.shiftKey ? this.reuseSelected() : this.openSource();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      this.preview.focus();
    }
  }
  async search() {
    if (this.filterBar?.blocked()) return;
    clearTimeout(this.searchTimer);
    const searchKey = JSON.stringify([this.filterBar.query(), this.offsets, this.drafts, this.vaultIds, this.typeIds, this.sourceIds]);
    const retain = searchKey === this.shownSearchKey;
    const ticket = ++this.ticket, begin = this.inputAt || performance.now(), oldId = this.rows[this.selected]?.id, oldIndex = this.selected;
    this.previewTicket++;
    clearTimeout(this.previewTimer);
    this.pendingSearch = true;
    this.status.setText("Searching\u2026");
    this.list.setAttribute("aria-busy", "true");
    try {
      const response = await this.client.request({ query: this.filterBar.query(), offsets: this.offsets, ...this.scopeRequest() });
      if (this.closed || ticket !== this.ticket) return;
      this.pendingSearch = false;
      this.shownSearchKey = searchKey;
      this.profile = response.profile;
      this.groups = response.data.groups;
      this.warning = response.warning;
      this.rows = [];
      this.items = [];
      for (const [groupIndex, group] of this.groups.entries()) {
        this.items.push({ header: true, title: group.term || "Browse the collection", count: group.rows.length, more: group.more });
        if (group.match === "approximate") this.items.push({ header: true, title: "Possible matches: " + group.matchedQueries.join(" / "), empty: true });
        for (const row of group.rows) {
          row.groupIndex = groupIndex;
          this.items.push({ ...row, index: this.rows.length });
          this.rows.push(row);
        }
        if (!group.rows.length) this.items.push({ header: true, title: group.offset ? "No more entries on this page" : this.vaultIds === null && this.typeIds === null && this.sourceIds === null ? "No matches for this search" : "No matches in " + this.scopeLabel() + " \xB7 \u2318\u21E7A search all", empty: true });
      }
      const found = retain ? this.rows.findIndex((x) => x.id === oldId) : -1;
      this.selected = found >= 0 ? found : 0;
      if (this.pageTarget != null) {
        const target = this.rows.findIndex((x) => x.groupIndex === this.pageTarget);
        if (target >= 0) this.selected = target;
        this.pageTarget = null;
      }
      this.list.scrollTop = 0;
      this.status.setText(this.groups.length > 1 ? `${this.groups.length} separate searches \xB7 ${this.rows.length} results on this page` : `${this.rows.length} results on this page${this.groups.some((g) => g.more) ? " \xB7 more available" : ""}`);
      if (this.warning) this.status.setText(this.warning + " \xB7 " + this.rows.length + " results");
      this.pages.setText(this.groups.some((g) => g.offset) ? "\u2325\u2190 previous \xB7 \u2325\u2192 more in selected search" : this.groups.some((g) => g.more) ? "\u2325\u2192 more in selected search" : "");
      this.list.removeAttribute("aria-busy");
      this.draw();
      this.buildFeed();
      if (this.refreshScroll) {
        this.preview.scrollTop = this.refreshScroll.preview;
        this.list.scrollTop = this.refreshScroll.list;
        this.refreshScroll = null;
      } else if (this.selected > 0) this.move(0);
      requestAnimationFrame(() => {
        if (!this.closed && ticket === this.ticket) this.metrics.push({ type: "input-to-results", ms: performance.now() - begin, sqlMs: response.sqlMs, rows: this.rows.length });
      });
    } catch (e) {
      if (!this.closed && ticket === this.ticket) {
        this.pendingSearch = false;
        this.rows = [];
        this.items = [];
        this.draw();
        this.clearFeed();
        this.status.setText(e.message);
        this.list.removeAttribute("aria-busy");
      }
    }
    if (ticket === this.ticket) this.inputAt = null;
  }
  draw() {
    if (this.closed || !this.items) return;
    const stride = 78, start = Math.max(0, Math.floor(this.list.scrollTop / stride) - 2), end = Math.min(this.items.length, Math.ceil((this.list.scrollTop + this.list.clientHeight) / stride) + 2);
    this.layer.style.height = this.items.length * stride + "px";
    this.layer.empty();
    for (let i = start; i < end; i++) {
      const item = this.items[i], row = this.layer.createDiv({ cls: item.header ? "kl-group" : "kl-row" });
      row.style.top = i * stride + "px";
      row.style.height = stride + "px";
      if (item.header) {
        row.createSpan({ text: item.title });
        if (!item.empty) row.createSpan({ text: String(item.count) + (item.more ? "+" : ""), cls: "kl-group-count" });
        continue;
      }
      row.style.setProperty("--kl-color", PALETTE[item.kind] || "175,180,194");
      row.id = this.uid + "-row-" + item.index;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(item.index === this.selected));
      row.setAttribute("aria-label", `${item.kind}: ${item.title}. ${item.vault}.`);
      row.toggleClass("is-selected", item.index === this.selected);
      this.titleRenderer.render(row, item.index + ":" + item.id, item.title);
      const label = row.createDiv({ cls: "kl-row-meta" });
      label.createSpan({ text: item.kind, cls: "kl-kind" });
      if (item.copies > 1) label.createSpan({ text: "\xD7" + item.copies, cls: "kl-copies" });
      label.createSpan({ text: item.vault.replaceAll("_", " ") + " \xB7 " + this.shortSource(item.path) });
      row.title = item.path;
      row.onclick = () => {
        if (this.pendingSearch) return;
        this.selected = item.index;
        this.draw();
        this.schedulePreview();
        this.input.focus();
      };
      row.ondblclick = () => this.openSource();
    }
    this.titleRenderer.flush();
    const selectedId = this.uid + "-row-" + this.selected;
    if (this.filterBar?.blocked()) return;
    if (this.contentEl.ownerDocument.getElementById(selectedId)) this.input.setAttribute("aria-activedescendant", selectedId);
    else this.input.removeAttribute("aria-activedescendant");
  }
  shortSource(p) {
    const parts = p.split("/");
    return parts.length > 2 ? parts[1] + " / " + parts.at(-1).replace(/\.md$/, "") : p.replace(/\.md$/, "");
  }
  move(delta) {
    if (this.pendingSearch || !this.rows.length) return;
    this.selected = Math.max(0, Math.min(this.rows.length - 1, this.selected + delta));
    const at = this.items.findIndex((x) => !x.header && x.index === this.selected), top = at * 78;
    if (top < this.list.scrollTop) this.list.scrollTop = top;
    else if (top + 78 > this.list.scrollTop + this.list.clientHeight) this.list.scrollTop = top + 78 - this.list.clientHeight;
    this.draw();
    this.schedulePreview();
  }
  clearFeed() {
    this.feedGeneration = (this.feedGeneration || 0) + 1;
    this.observer?.disconnect();
    for (const slot of this.slots || []) slot.owner?.unload();
    this.slots = [];
    this.renderQueue = [];
    this.feedSignature = null;
    this.preview.empty();
  }
  buildFeed() {
    const signature = JSON.stringify(this.items.map((x) => x.header ? "heading" : [x.id, x.copies, this.vaultIds, this.typeIds]));
    if (signature === this.feedSignature && this.slots?.length) {
      const headings = [...this.preview.querySelectorAll(":scope > .kl-feed-heading")];
      let index = 0;
      for (const item of this.items) if (item.header) headings[index++].setText(item.title);
      return;
    }
    this.clearFeed();
    this.feedSignature = signature;
    this.preview.scrollTop = 0;
    const generation = this.feedGeneration;
    for (const item of this.items) {
      if (item.header) {
        this.preview.createEl("h3", { cls: "kl-feed-heading", text: item.title });
        continue;
      }
      const el = this.preview.createEl("article", { cls: "kl-feed-entry", attr: { "aria-label": item.kind + ": " + item.title } });
      el.style.setProperty("--kl-color", PALETTE[item.kind] || "175,180,194");
      el.dataset.index = String(item.index);
      const slot = { el, entry: item, generation, visible: false, rendered: false, queued: false, owner: null };
      this.slots[item.index] = slot;
      this.placeholder(slot);
    }
    this.observer = new this.contentEl.ownerDocument.defaultView.IntersectionObserver((entries) => {
      for (const observation of entries) {
        const slot = this.slots[Number(observation.target.dataset.index)];
        if (!slot || slot.el !== observation.target || generation !== this.feedGeneration) continue;
        slot.visible = observation.isIntersecting;
        if (slot.visible) this.enqueue(slot);
        else if (slot.rendered) {
          const height = slot.el.getBoundingClientRect().height;
          slot.owner?.unload();
          slot.owner = null;
          slot.rendered = false;
          slot.el.style.minHeight = height + "px";
          this.placeholder(slot);
        }
      }
    }, { root: this.preview, rootMargin: "500px 0px" });
    for (const slot of this.slots) this.observer.observe(slot.el);
    if (!this.rows.length) this.preview.createEl("p", { text: this.reviewed && !this.catalog.length ? "Your index starts empty. Open a note and run \u201CReview current note for index\u201D to add its entries together." : "Try a term, a theorem name, or a LaTeX expression." });
  }
  placeholder(slot) {
    slot.el.empty();
    slot.el.createDiv({ cls: "kl-preview-meta", text: slot.entry.kind + " \xB7 " + slot.entry.vault.replaceAll("_", " ") });
    slot.el.createEl("h3", { text: slot.entry.title });
    slot.el.createDiv({ cls: "kl-loading", text: "Preview loads as you browse" });
  }
  enqueue(slot) {
    if (slot.rendered || slot.queued || this.closed) return;
    slot.queued = true;
    this.renderQueue.push(slot);
    this.pump();
  }
  pump() {
    this.rendering = this.rendering || 0;
    while (this.rendering < 2 && this.renderQueue?.length) {
      const slot = this.renderQueue.shift();
      if (slot.generation !== this.feedGeneration || !slot.visible) {
        slot.queued = false;
        continue;
      }
      this.rendering++;
      this.renderSlot(slot).finally(() => {
        this.rendering--;
        slot.queued = false;
        if (!this.closed) this.pump();
      });
    }
  }
  schedulePreview() {
    const slot = this.slots?.[this.selected];
    if (!slot) return;
    for (const s of this.slots) s.el.toggleClass("is-selected", s === slot);
    slot.el.scrollIntoView({ block: "nearest" });
    slot.visible = true;
    this.enqueue(slot);
  }
  async renderSlot(slot) {
    const begin = performance.now(), entry = slot.entry;
    const alive = () => !this.closed && slot.generation === this.feedGeneration && slot.visible;
    let owner;
    try {
      let data = this.cache.get(entry.id);
      if (!data) {
        data = (await this.client.request({ op: "detail", id: entry.id, ...this.scopeRequest() })).data;
        this.cache.set(entry.id, data);
        if (this.cache.size > 20) this.cache.delete(this.cache.keys().next().value);
      }
      if (!alive()) return;
      owner = new Component();
      owner.load();
      const staging = this.contentEl.ownerDocument.createElement("div");
      const meta = staging.createDiv({ cls: "kl-preview-meta" });
      meta.createSpan({ text: data.kind + " \xB7 " + data.vault.replaceAll("_", " ") });
      meta.createSpan({ text: this.plugin.production ? "r" + data.revision : "TEST COPY" });
      const body = staging.createDiv({ cls: "kl-body markdown-rendered" });
      const sourcePath = data.sourcePath || "Sources/" + data.vault + "/" + data.path;
      if (data.status && data.status !== "current") meta.createSpan({ text: "Saved version \xB7 source " + data.status });
      let renderBody = data.body;
      if (this.reviewed && data.vaultRoot !== this.app.vault.adapter.getBasePath()) {
        const portable = await this.plugin.admission.request("live-portable", { id: data.id, preview: true });
        renderBody = portable.body;
        for (const asset of portable.assets) renderBody = renderBody.replace(asset.key, Platform.resourcePathPrefix + asset.source);
      }
      await MarkdownRenderer.render(this.app, renderBody.replace(/^(\s*>\s*\[![^\]]+\])[-+]/gm, "$1"), body, sourcePath, owner);
      if (!alive()) {
        owner.unload();
        return;
      }
      const source = staging.createEl("a", { cls: "kl-provenance kl-copy-source", href: "#", text: data.path + " \xB7 line " + data.line_start });
      source.onclick = (e) => {
        e.preventDefault();
        if (!this.pendingSearch) this.openOccurrence(data);
      };
      if (entry.copies > 1) {
        const copies = staging.createEl("details", { cls: "kl-context" });
        copies.createEl("summary", { text: entry.copies + " identical copies \xB7 show sources" });
        let loaded = false;
        copies.ontoggle = async () => {
          if (!copies.open || loaded || !alive() || slot.owner !== owner) return;
          loaded = true;
          const holder = copies.createDiv({ text: "Loading sources\u2026" });
          try {
            const response = await this.client.request({ op: "copies", id: entry.id, ...this.scopeRequest() });
            if (!alive() || slot.owner !== owner) return;
            holder.empty();
            for (const source2 of response.data.rows) {
              const link = holder.createEl("a", { text: source2.vault.replaceAll("_", " ") + " \xB7 " + source2.path + " \xB7 line " + source2.line_start, cls: "kl-copy-source", href: "#" });
              link.onclick = (e) => {
                e.preventDefault();
                if (!this.pendingSearch) this.openOccurrence(source2);
              };
            }
            if (response.data.more) holder.createEl("p", { text: "Showing the first 200 source copies." });
          } catch (e) {
            if (alive()) {
              holder.setText(e.message);
              loaded = false;
            }
          }
        };
      }
      if (data.context_after.trim()) {
        const context = staging.createEl("details", { cls: "kl-context" });
        context.createEl("summary", { text: "Surrounding explanation and conditions" });
        let rendered = false;
        context.ontoggle = async () => {
          if (alive() && slot.owner === owner && context.open && !rendered) {
            rendered = true;
            await MarkdownRenderer.render(this.app, data.context_after, context.createDiv({ cls: "markdown-rendered" }), sourcePath, owner);
          }
        };
      }
      slot.owner = owner;
      slot.el.replaceChildren(staging);
      slot.el.style.minHeight = "";
      slot.rendered = true;
      requestAnimationFrame(() => {
        if (alive()) this.metrics.push({ type: "feed-preview-render", ms: performance.now() - begin, entryId: entry.id, characters: data.body.length, mathNodes: body.querySelectorAll("mjx-container").length, livePreviews: this.slots.filter((x) => x.rendered).length });
      });
    } catch (e) {
      owner?.unload();
      if (alive()) {
        slot.el.empty();
        slot.el.createEl("p", { text: "Preview unavailable: " + e.message });
      }
    }
  }
  async openSource() {
    if (this.pendingSearch) return;
    const row = this.rows[this.selected];
    if (!row) return;
    await this.openOccurrence(row);
  }
  async openOccurrence(row) {
    try {
      let line = row.line_start - 1, sourcePath = row.sourcePath || "Sources/" + row.vault + "/" + row.path, mode = "preview";
      if (this.reviewed) {
        const located = await this.plugin.admission.request("live-locate", { id: row.id });
        line = located.line - 1;
        sourcePath = located.path;
        mode = located.mode === "snapshot" ? "preview" : "source";
        if (located.vaultRoot !== this.app.vault.adapter.getBasePath()) {
          const url = "obsidian://knowledge-library-source?vault=" + encodeURIComponent(located.obsidianId || located.vault) + "&file=" + encodeURIComponent(sourcePath) + "&entry=" + encodeURIComponent(row.id);
          await require("electron").shell.openExternal(url);
          return;
        }
      }
      const file = this.app.vault.getAbstractFileByPath(sourcePath);
      if (!file) throw new Error("The source note is unavailable.");
      if (!this.hostLeaf) this.close();
      if (this.hostLeaf && this.plugin.lastEditor?.leaf) this.app.workspace.setActiveLeaf(this.plugin.lastEditor.leaf, { focus: false });
      const leaf = this.hostLeaf && !this.plugin.lastEditor?.leaf ? this.app.workspace.getLeaf("split", "vertical") : this.app.workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode }, eState: { line } });
      if (mode === "source" && leaf.view.editor) {
        leaf.view.editor.setCursor({ line, ch: 0 });
        leaf.view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
        leaf.view.editor.focus();
      }
    } catch (e) {
      new Notice(e.message);
    }
  }
  async reuseSelected(admitCopy = true) {
    if (this.pendingSearch || !this.reviewed || this.reusing) return;
    const row = this.rows[this.selected];
    if (!row) return;
    this.reusing = true;
    try {
      if (this.hostLeaf && this.plugin.lastEditor?.file) {
        this.destination = this.plugin.lastEditor;
        this.destinationPath = this.destination.file.path;
        this.destinationLine = this.destination.editor.getCursor().line;
        this.destinationHash = require("crypto").createHash("sha256").update(this.destination.editor.getValue().replace(/\r\n?/g, "\n")).digest("hex");
      }
      if (!this.destination?.file || this.destination.file.path !== this.destinationPath) throw new Error("Open a destination note and place the cursor on a blank line before opening the index.");
      const data = (await this.client.request({ op: "detail", id: row.id, ...this.scopeRequest() })).data;
      const portable = await this.plugin.portableBody(data);
      await this.plugin.admission.reuse(this.destination, data, this.destinationLine, this.destinationHash, portable, admitCopy);
      if (!this.hostLeaf) this.close();
      this.app.workspace.setActiveLeaf(this.destination.leaf, { focus: true });
      this.destination.editor.focus();
    } catch (e) {
      new Notice(e.message, 8e3);
    } finally {
      this.reusing = false;
    }
  }
  async showHistory() {
    if (this.pendingSearch || !this.reviewed) return;
    const row = this.rows[this.selected];
    if (!row) return;
    try {
      const data = await this.plugin.admission.request("live-history", { id: row.id });
      const modal = new Modal(this.app);
      modal.titleEl.setText("History \xB7 " + data.entry.title);
      modal.modalEl.addClass("kl-review-modal");
      const owner = new Component();
      owner.load();
      modal.onClose = () => owner.unload();
      if (data.parent) {
        const link = modal.contentEl.createEl("a", { href: "#", text: "Reused from " + data.parent.title + " \xB7 revision " + data.entry.parentRevision });
        link.onclick = (e) => {
          e.preventDefault();
          modal.close();
          this.openOccurrence({ id: data.parent.id });
        };
      }
      for (const variant of data.variants) {
        const link = modal.contentEl.createEl("a", { href: "#", cls: "kl-copy-source", text: "Local version \xB7 " + variant.home.vault + " / " + variant.home.path });
        link.onclick = (e) => {
          e.preventDefault();
          modal.close();
          this.openOccurrence(variant);
        };
      }
      for (const revision of [...data.displayRevisions || data.revisions].reverse()) {
        const section = modal.contentEl.createEl("details", { cls: "kl-context" });
        section.createEl("summary", { text: new Date(revision.at).toLocaleString() + " \xB7 " + revision.actor + " \xB7 revision " + (revision.revision?.revision ?? "removed") + (revision.editCount ? " \xB7 " + revision.editCount + " edits" : "") });
        let rendered = false;
        section.ontoggle = async () => {
          if (section.open && !rendered) {
            rendered = true;
            await MarkdownRenderer.render(this.app, revision.revision?.body || "Removed", section.createDiv({ cls: "markdown-rendered" }), data.entry.home.path, owner);
          }
        };
      }
      modal.open();
    } catch (e) {
      new Notice(e.message);
    }
  }
  async copyMarkdown() {
    if (this.pendingSearch) return;
    const row = this.rows[this.selected];
    if (!row) return;
    try {
      const data = (await this.client.request({ op: "detail", id: row.id, ...this.scopeRequest() })).data;
      await this.contentEl.ownerDocument.defaultView.navigator.clipboard.writeText(data.body);
      new Notice("Entry copied as Markdown.");
    } catch (e) {
      new Notice(e.message);
    }
  }
  page(delta) {
    if (this.pendingSearch) return;
    const groupIndex = this.rows[this.selected]?.groupIndex ?? 0, group = this.groups?.[groupIndex];
    if (!group || delta < 0 && !group.offset || delta > 0 && !group.more) return;
    this.offsets[String(groupIndex)] = Math.max(0, (group.offset || 0) + delta * 16);
    this.pageTarget = groupIndex;
    this.search();
  }
  actions(event) {
    const menu = new Menu();
    menu.addItem((i) => i.setTitle("Open index in new tab").onClick(() => this.plugin.openPane(false, this.filterBar.snapshot())));
    menu.addItem((i) => i.setTitle("Open index in new window").onClick(() => this.plugin.openPane(true, this.filterBar.snapshot())));
    if (!this.plugin.production) menu.addItem((i) => i.setTitle(this.reviewed ? "Browse large test corpus" : "Browse reviewed entries").onClick(() => {
      this.close();
      this.plugin.open(!this.reviewed);
    }));
    menu.addItem((i) => i.setTitle("Add a filter").onClick(() => this.chooseScope()));
    menu.addItem((i) => i.setTitle("Save vault filters as group").onClick(() => this.filterBar.nameGroup()));
    for (const group of this.settings.groups || []) {
      menu.addItem((i) => i.setTitle("Rename group: " + group.name).onClick(() => this.filterBar.nameGroup(group)));
      menu.addItem((i) => i.setTitle("Delete group: " + group.name + " (Undo available)").onClick(() => this.filterBar.deleteGroup(group)));
    }
    menu.addItem((i) => i.setTitle("Clear all filters").onClick(() => this.filterBar.clear()));
    menu.addItem((i) => i.setTitle("Open source at this entry").onClick(() => this.openSource()));
    menu.addItem((i) => i.setTitle("Copy entry as Markdown").onClick(() => this.copyMarkdown()));
    if (this.reviewed) {
      menu.addItem((i) => i.setTitle("Reuse editable copy here").onClick(() => this.reuseSelected()));
      menu.addItem((i) => i.setTitle("History and related versions").onClick(() => this.showHistory()));
    }
    menu.addItem((i) => i.setTitle("Focus search").onClick(() => this.input.focus()));
    menu.addItem((i) => i.setTitle("More results for selected search").onClick(() => this.page(1)));
    menu.addItem((i) => i.setTitle("Previous results for selected search").onClick(() => this.page(-1)));
    menu.addItem((i) => i.setTitle(this.drafts ? "Hide draft sources" : "Include draft sources").onClick(() => {
      this.drafts = !this.drafts;
      this.offset = 0;
      this.offsets = {};
      this.search();
    }));
    menu.addItem((i) => i.setTitle("Search help").onClick(() => new Notice("Type Book:, Chapter:, Type:, Vault:, Source: or Group: and choose a match. Tags are filters; Backspace removes a selected tag. Separate searches with ; or paste one term per line. Spaces match all words; double quotes match a phrase. Semicolons inside math or quotes stay intact. Shift+\u2191/\u2193 scrolls the preview. \u2325\u2190/\u2192 changes page.", 12e3)));
    if (event) menu.showAtMouseEvent(event);
    else {
      const r = this.input.getBoundingClientRect();
      menu.showAtPosition({ x: r.left, y: r.bottom });
    }
  }
  refreshReviewed() {
    if (this.reviewed && !this.closed) {
      this.refreshScroll = { preview: this.preview.scrollTop, list: this.list.scrollTop };
      this.cache.clear();
      this.feedSignature = null;
      this.loadCatalog();
    }
  }
  onClose() {
    this.titleRenderer?.close();
    this.closed = true;
    this.ticket++;
    this.previewTicket++;
    clearTimeout(this.searchTimer);
    clearTimeout(this.previewTimer);
    cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    this.clearFeed();
    this.owner?.unload();
    if (!this.reviewed) this.client?.close();
    this.monitor?.stop();
    const data = {
      capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
      profile: this.profile,
      metrics: this.metrics,
      recorder: this.monitor?.path,
      limits: "Test vault only; corpus and explicitly reviewed collection are separate."
    };
    if (!this.plugin.production) fs.promises.writeFile(path.join(ROOT, "outputs", "ui-" + Date.now() + ".json"), JSON.stringify(data, null, 2)).catch(() => {
    });
    clearTimeout(this.persistTimer);
    this.plugin.persist().catch(() => {
    });
    this.filterBar?.close();
    this.cache.clear();
    this.contentEl.empty();
    this.plugin.browsers.delete(this);
    if (this.plugin.active === this) this.plugin.active = null;
  }
};
var LibraryView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.scope = new Scope(this.app.scope);
  }
  getViewType() {
    return "knowledge-library";
  }
  getDisplayText() {
    return "Index";
  }
  getIcon() {
    return "library";
  }
  async onOpen() {
    this.initialize(true);
  }
  initialize(reviewed) {
    this.contentEl.empty();
    this.contentEl.addClass("kl-pane");
    this.browser = new LibraryBrowser(this.plugin, reviewed);
    this.browser.hostLeaf = this.leaf;
    this.browser.scope = this.scope;
    this.browser.modalEl = this.contentEl;
    this.browser.titleEl = this.contentEl.createEl("h2");
    this.browser.contentEl = this.contentEl.createDiv({ cls: "kl-pane-content" });
    this.browser.close = () => this.leaf.detach();
    this.browser.onOpen();
  }
  async setState(state, result) {
    await super.setState(state, result);
    if (this.browser) {
      const reviewed = this.plugin.production || state.reviewed !== false;
      if (reviewed !== this.browser.reviewed) {
        this.browser.onClose();
        this.initialize(reviewed);
      }
      if (this.browser.filterBar.model) this.browser.filterBar.restore(state);
      else {
        this.browser.restoredState = state;
        this.browser.input.value = state.query || "";
      }
    }
  }
  getState() {
    return this.browser?.filterBar.snapshot() || { query: "" };
  }
  async onClose() {
    this.browser?.onClose();
  }
};
module.exports = class KnowledgeLibraryPlugin extends Plugin {
  async portableBody(entry) {
    const result = await this.admission.request("live-portable", { id: entry.id });
    for (const asset of result.assets) {
      const bytes = await fs.promises.readFile(asset.source);
      if (require("crypto").createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error("An image changed while preparing this copy. Try again.");
      if (!await this.app.vault.adapter.exists("_Knowledge Library assets")) await this.app.vault.createFolder("_Knowledge Library assets");
      if (!await this.app.vault.adapter.exists(asset.path)) await this.app.vault.createBinary(asset.path, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      else {
        const saved = Buffer.from(await this.app.vault.adapter.readBinary(asset.path));
        if (require("crypto").createHash("sha256").update(saved).digest("hex") !== asset.sha256) throw new Error("An existing reusable image has changed.");
      }
    }
    if (result.warnings.length) new Notice(result.warnings.join("\n"), 9e3);
    return result.body;
  }
  async onload() {
    this.browsers = /* @__PURE__ */ new Set();
    const stored = await this.loadData();
    this.settings = { profile: null, vaultIds: null, typeIds: null, scopeGroupId: null, groups: [], ...stored };
    this.settings.reviewed = { profile: null, vaultIds: null, typeIds: null, scopeGroupId: null, groups: [], ...this.settings.reviewed };
    if (!Array.isArray(this.settings.groups)) this.settings.groups = [];
    this.production = this.app.vault.getName() !== "knowledge_library_lab";
    this.libraryRoot = this.settings.libraryRoot || path.join(require("os").homedir(), "Library", "Application Support", "Knowledge Library", "library");
    if (this.production && !this.settings.enrolled) {
      new Notice("Index is not enrolled for this vault.");
      return;
    }
    registerTracking(this);
    this.startService();
    this.registerEvent(this.app.vault.on("modify", (file) => this.admission.schedule(file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.admission.schedule(file.path)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.admission.rename(file, oldPath)));
    this.registerView("knowledge-library", (leaf) => new LibraryView(leaf, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf?.view instanceof MarkdownView) this.lastEditor = leaf.view;
    }));
    this.registerInterval(setInterval(async () => {
      if (!this.browsers.size) return;
      try {
        const status = await this.admission.request("live-status");
        if (this.lastSequence !== void 0 && status.sequence !== this.lastSequence) this.refreshBrowsers();
        this.lastSequence = status.sequence;
      } catch {
      }
    }, 3e3));
    this.addCommand({ id: "browse-tab", name: "Open index in new tab", callback: () => this.openPane(false) });
    this.addCommand({ id: "browse-window", name: "Open index in new window", callback: () => this.openPane(true) });
    this.addCommand({ id: "review-note", name: "Review current note for index", callback: () => this.admission.review() });
    this.addCommand({ id: "browse-reviewed", name: "Browse reviewed entries", callback: () => this.open(true) });
    this.addCommand({ id: "browse", name: "Browse index", hotkeys: [{ modifiers: ["Mod", "Shift"], key: "l" }], callback: () => this.open() });
    this.addCommand({ id: "actions", name: "Index actions", callback: () => {
      if (this.active) this.active.actions();
      else this.open();
    } });
    this.registerObsidianProtocolHandler("knowledge-library-lab", () => this.open());
    this.registerObsidianProtocolHandler("knowledge-library", (params) => this.openPane(params.window === "true", params.query || ""));
    this.registerObsidianProtocolHandler("knowledge-library-source", async (params) => {
      try {
        await this.admission.ready;
        const located = await this.admission.request("live-locate", { id: params.entry });
        if (located.vaultRoot !== this.app.vault.adapter.getBasePath()) return;
        const file = this.app.vault.getAbstractFileByPath(located.path);
        if (!file) throw new Error("Source note unavailable.");
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.openFile(file, { state: { mode: located.mode === "snapshot" ? "preview" : "source" }, eState: { line: located.line - 1 } });
        if (located.mode !== "snapshot" && leaf.view.editor) {
          leaf.view.editor.setCursor({ line: located.line - 1, ch: 0 });
          leaf.view.editor.focus();
        }
      } catch (e) {
        new Notice(e.message);
      }
    });
  }
  async persist() {
    const snapshot = JSON.parse(JSON.stringify(this.settings));
    this.saveQueue = (this.saveQueue || Promise.resolve()).catch(() => {
    }).then(() => this.saveData(snapshot));
    await this.saveQueue;
  }
  startService() {
    this.admission?.close();
    this.admission = new AdmissionAdapter(this, new Client(this.app.vault.adapter.getBasePath(), this.production, this.production ? this.libraryRoot : null));
    this.admission.ready = this.admission.start();
    this.admission.ready.catch((e) => new Notice("Index service: " + e.message));
    for (const browser of this.browsers) if (browser.reviewed) {
      browser.client = this.admission.client;
      this.admission.ready.then(() => browser.refreshReviewed()).catch(() => {
      });
    }
  }
  open(reviewed = false) {
    if (this.admission?.client.dead) this.startService();
    reviewed = this.production || reviewed;
    if (this.active) {
      if (this.active.reviewed === reviewed) {
        this.active.input.focus();
        return;
      }
      this.active.close();
    }
    new LibraryBrowser(this, reviewed).open();
  }
  async openPane(popout = false, query = "") {
    const state = typeof query === "string" ? { query } : query;
    if (this.admission?.client.dead) this.startService();
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) this.lastEditor = view;
    const leaf = popout ? this.app.workspace.openPopoutLeaf() : this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: "knowledge-library", active: true, state });
    await this.app.workspace.revealLeaf(leaf);
    const input = leaf.view.browser?.input, win = input?.ownerDocument.defaultView;
    if (input && win) {
      const focus = () => {
        if (input.isConnected) input.focus();
      };
      win.requestAnimationFrame(focus);
      win.setTimeout(focus, 150);
    }
  }
  refreshBrowsers() {
    for (const browser of this.browsers) browser.refreshReviewed();
  }
  onunload() {
    for (const browser of [...this.browsers]) {
      if (browser.hostLeaf) browser.onClose();
      else browser.close();
    }
    this.admission?.close();
  }
};
