var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// plugin/monitor.js
var require_monitor = __commonJS({
  "plugin/monitor.js"(exports2, module2) {
    module2.exports = function startMonitor2(app, folder, targetWindow = globalThis.window) {
      const window2 = targetWindow, document2 = window2.document, performance2 = window2.performance, PerformanceObserver = window2.PerformanceObserver, MutationObserver = window2.MutationObserver;
      window2.__libraryPerf?.stop?.();
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
        document2.addEventListener(name, fn, true);
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
      m.observe(document2.body, { subtree: true, childList: true });
      observers.push(m);
      let last = performance2.now();
      const lag = setInterval(() => {
        const t = performance2.now(), delay = t - last - 100;
        if (delay > 50) data.lag.push({ ms: now(), delay: Math.round(delay) });
        last = t;
      }, 100);
      const snapshot = () => {
        const v = app.workspace.activeLeaf?.view;
        data.states.push({ ms: now(), file: v?.file?.basename, mode: v?.getMode?.(), images: document2.querySelectorAll(".workspace img").length, figures: document2.querySelectorAll(".workspace .ss-scientific").length });
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
        for (const [name, fn] of listeners) document2.removeEventListener(name, fn, true);
        snapshot();
        write();
      };
      const end = setTimeout(stop, 18e4);
      window2.__libraryPerf = { stop, data };
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
      removeKind(kind) {
        const next = clone(this.state);
        next.tokens = next.tokens.filter((t) => t.kind !== kind);
        next.draft = null;
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
        if (e.key === "Backspace" && this.model && this.input.selectionStart === 0 && this.input.selectionEnd === 0) {
          const tokens = this.model.state.tokens, last = tokens.at(-1);
          if (last) {
            const collapsed = this.expandedKind !== last.kind && tokens.filter((t) => t.kind === last.kind).length > 1;
            collapsed ? this.model.removeKind(last.kind) : this.model.remove(tokens.length - 1);
            this.changed();
            this.focusInput();
            return true;
          }
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
              button.onkeydown = (e) => {
                if (e.key === "Backspace" || e.key === "Delete") {
                  e.preventDefault();
                  e.stopPropagation();
                  this.model.removeKind(token.kind);
                  this.changed();
                  this.focusInput();
                }
              };
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
      constructor(document2, redraw) {
        this.document = document2;
        this.win = document2.defaultView;
        this.cache = /* @__PURE__ */ new Map();
        this.queue = [];
        this.ready = false;
        this.closed = false;
        Promise.resolve().then(() => loadMathJax()).then(() => {
          if (!this.closed) {
            this.ready = true;
            for (const entry of this.cache.values()) if (!entry.done && !entry.queued) {
              entry.queued = true;
              this.queue.push(entry);
            }
            this.flush();
            redraw();
          }
        }).catch(() => {
        });
      }
      render(parent, key, title, { inline = false } = {}) {
        const cacheKey = JSON.stringify([key, title, inline]);
        let entry = this.cache.get(cacheKey);
        if (!entry) {
          const node = this.document.createElement(inline ? "span" : "div");
          node.className = inline ? "kl-inline-title" : "kl-row-title";
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

// plugin/resize-modal.js
var require_resize_modal = __commonJS({
  "plugin/resize-modal.js"(exports2, module2) {
    function bounds(rect, width, height, viewport) {
      const left = Math.max(12, Math.min(rect.left, viewport.width - 36));
      const top = Math.max(12, Math.min(rect.top, viewport.height - 36));
      const maxWidth = Math.max(24, viewport.width - left - 12), maxHeight = Math.max(24, viewport.height - top - 12);
      return {
        left,
        top,
        width: Math.min(maxWidth, Math.max(Math.min(600, maxWidth), width)),
        height: Math.min(maxHeight, Math.max(Math.min(360, maxHeight), height))
      };
    }
    function attachResize(el, saved, save) {
      const doc = el.ownerDocument, win = doc.defaultView;
      const grip = doc.createElement("div");
      grip.className = "kl-resize-grip";
      grip.title = "Drag to resize \xB7 double-click to reset";
      el.append(grip);
      let drag = null, frame = 0, pending = null;
      const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
      const apply = (r) => Object.assign(el.style, { position: "fixed", margin: "0", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      if (saved?.width && saved?.height) {
        const r = bounds({ left: 12, top: 12 }, saved.width, saved.height, viewport());
        apply({ ...r, left: (win.innerWidth - r.width) / 2, top: (win.innerHeight - r.height) / 2 });
      }
      const flush = () => {
        frame = 0;
        if (pending) {
          apply(pending);
          pending = null;
        }
      };
      const finish = (cancelled) => {
        if (!drag) return;
        if (frame) win.cancelAnimationFrame(frame);
        flush();
        const previous = drag;
        drag = null;
        win.removeEventListener("pointermove", move, true);
        win.removeEventListener("pointerup", up, true);
        win.removeEventListener("pointercancel", cancel, true);
        win.removeEventListener("blur", blur);
        if (cancelled) el.style.cssText = previous.style;
        else {
          const r = el.getBoundingClientRect();
          save?.({ width: r.width, height: r.height });
        }
        if (grip.hasPointerCapture(previous.id)) grip.releasePointerCapture(previous.id);
        el.classList.remove("is-resizing");
      };
      grip.onpointerdown = (e) => {
        if (e.button !== 0 || e.isPrimary === false || drag) return;
        e.preventDefault();
        e.stopPropagation();
        const r = el.getBoundingClientRect();
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, rect: r, style: el.style.cssText };
        apply(bounds(r, r.width, r.height, viewport()));
        win.addEventListener("pointermove", move, true);
        win.addEventListener("pointerup", up, true);
        win.addEventListener("pointercancel", cancel, true);
        win.addEventListener("blur", blur);
        grip.setPointerCapture(e.pointerId);
        el.classList.add("is-resizing");
      };
      const move = (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        if ((e.buttons & 1) === 0) {
          finish(false);
          return;
        }
        pending = bounds(drag.rect, drag.rect.width + e.clientX - drag.x, drag.rect.height + e.clientY - drag.y, viewport());
        if (!frame) frame = win.requestAnimationFrame(flush);
      };
      const up = (e) => {
        if (drag?.id === e.pointerId) finish(false);
      };
      const cancel = (e) => {
        if (drag?.id === e.pointerId) finish(true);
      };
      const blur = () => finish(false);
      grip.onlostpointercapture = () => finish(true);
      const escape = (e) => {
        if (drag && e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          finish(true);
        }
      };
      doc.addEventListener("keydown", escape, true);
      const reset = () => {
        finish(true);
        for (const key of ["position", "margin", "left", "top", "width", "height"]) el.style[key] = "";
        save?.(null);
      };
      grip.ondblclick = reset;
      const clamp = () => {
        if (el.style.position === "fixed") {
          const r = el.getBoundingClientRect();
          apply(bounds(r, r.width, r.height, viewport()));
        }
      };
      win.addEventListener("resize", clamp);
      return () => {
        finish(true);
        doc.removeEventListener("keydown", escape, true);
        win.removeEventListener("resize", clamp);
        grip.remove();
      };
    }
    module2.exports = { attachResize, bounds };
  }
});

// plugin/admission.js
var require_admission = __commonJS({
  "plugin/admission.js"(exports2, module2) {
    var { Modal: Modal2, Component: Component2, MarkdownRenderer: MarkdownRenderer2, Notice: Notice2, MarkdownView: MarkdownView2, Menu: Menu2, Scope: Scope2 } = require("obsidian");
    var crypto = require("crypto");
    var { Transaction } = require("@codemirror/state");
    var hash = (text) => crypto.createHash("sha256").update(text.replace(/\r\n?/g, "\n")).digest("hex");
    var NoteReview = class extends Modal2 {
      constructor(adapter, view, occurrence = null) {
        super(adapter.plugin.app);
        this.scope = new Scope2(this.scope);
        this.adapter = adapter;
        this.view = view;
        this.file = view.file;
        this.occurrence = occurrence;
        this.selected = /* @__PURE__ */ new Set();
        this.closed = false;
        this.types = occurrence ? null : /* @__PURE__ */ new Set(["definition"]);
        this.focused = null;
        this.searchQuery = "";
        this.previewTicket = 0;
        this.previewOwners = /* @__PURE__ */ new Set();
      }
      async onOpen() {
        this.modalEl.addClass("kl-review-modal");
        this.titleEl.setText("Add to index");
        const plugin = this.adapter.plugin;
        this.closeResize = require_resize_modal().attachResize(this.modalEl, plugin.settings?.reviewWindow, (size) => {
          plugin.settings.reviewWindow = size;
          plugin.persist().catch(() => new Notice2("Window size could not be saved."));
        });
        this.contentEl.createDiv({ cls: "kl-review-source", text: this.app.vault.getName().replaceAll("_", " ") + " \u203A " + this.file.basename, attr: { title: this.file.path } });
        this.search = this.contentEl.createEl("input", { type: "search", cls: "kl-review-search", attr: { placeholder: "Search entries\u2026", "aria-label": "Search entries to add" } });
        this.search.oninput = () => this.filterSearch();
        this.search.onkeydown = (e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            this.rows?.get(this.shownIndices()[0])?.focus();
          } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
          }
        };
        this.scope.register([], "Escape", () => {
          if (this.search === this.search.ownerDocument.activeElement && this.search.value) {
            this.search.value = "";
            this.filterSearch();
            return false;
          }
          this.close();
          return false;
        });
        this.chips = this.contentEl.createDiv({ cls: "kl-review-types", attr: { "aria-label": "Entry type filters" } });
        this.selectionBar = this.contentEl.createDiv({ cls: "kl-review-selection" });
        const selectionLabel = this.selectionBar.createEl("label");
        this.all = selectionLabel.createEl("input", { type: "checkbox", attr: { "aria-label": "Select or clear all shown" } });
        this.all.onchange = () => this.selectShown(this.all.checked);
        this.count = selectionLabel.createSpan();
        this.hint = this.contentEl.createDiv({ cls: "kl-status", text: "Reading saved callouts\u2026" });
        const panes = this.contentEl.createDiv({ cls: "kl-review-panes" });
        this.list = panes.createDiv({ cls: "kl-review-list", attr: { "aria-label": "Entries to review" } });
        this.preview = panes.createDiv({ cls: "kl-review-preview markdown-rendered", attr: { "aria-label": "Focused entry preview" } });
        this.preview.setText("Choose an entry to preview.");
        const footer = this.contentEl.createDiv({ cls: "kl-footer kl-review-footer" });
        footer.createSpan({ text: "\u2191\u2193 preview \xB7 Space select \xB7 \u21E7click range", cls: "kl-review-shortcuts" });
        const actions = footer.createDiv({ cls: "kl-review-actions" });
        actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
        this.button = actions.createEl("button", { text: "Add selected", cls: "mod-cta" });
        this.button.disabled = true;
        this.button.onclick = () => this.admit();
        this.button.setAttribute("title", "Adds the selected visible entries and stable hidden markers to this note. Undo in the note restores its text.");
        this.scope.register(["Mod"], "Enter", () => {
          this.admit();
          return false;
        });
        this.scope.register(["Mod"], "a", () => {
          if (this.search === this.search.ownerDocument.activeElement) return true;
          this.selectShown(true);
          return false;
        });
        this.scope.register(["Mod", "Shift"], "a", () => {
          if (this.search === this.search.ownerDocument.activeElement) return true;
          this.selectShown(false);
          return false;
        });
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
          this.entries = this.occurrence ? preview.entries.filter((e) => e.component?.at === this.occurrence) : preview.entries;
          this.text = text;
          this.searchTexts = new WeakMap(this.entries.map((e) => [e, (e.title + "\n" + e.body).toLocaleLowerCase()]));
          this.entries.forEach((e, i) => {
            if (this.matchesType(e) && e.complete && !e.admitted && !e.issue && !e.reviewWarning) this.selected.add(i);
          });
          this.renderTypes();
          this.renderCards();
          this.update();
        } catch (e) {
          this.hint.setText(e.message);
        }
      }
      filterSearch() {
        this.searchQuery = this.search.value.trim().toLocaleLowerCase();
        if (this.entries && !this.closed) {
          this.renderCards();
          this.update();
        }
      }
      matchesType(entry) {
        return this.types === null || this.types.has(entry.kind);
      }
      needsReview(entry) {
        return !entry.admitted || !!entry.issue || !entry.complete;
      }
      matches(entry) {
        return this.matchesType(entry) && this.needsReview(entry) && (!this.searchQuery || (this.searchTexts?.get(entry) || (entry.title + "\n" + entry.body).toLocaleLowerCase()).includes(this.searchQuery));
      }
      selectedIndices() {
        return [...this.selected].filter((i) => {
          const e = this.entries?.[i];
          return e && this.matches(e) && e.complete && !e.admitted && !e.issue;
        });
      }
      typeLabel(kind) {
        return { definition: "Definitions", notation: "Notation", equation: "Equations", theorem: "Theorems", result: "Results", lemma: "Lemmas", corollary: "Corollaries", proposition: "Propositions", assumption: "Assumptions", rule: "Rules", convention: "Conventions", table: "Tables", figure: "Figures", law: "Laws", principle: "Principles", postulate: "Postulates" }[kind] || kind;
      }
      eligible(e) {
        return e.complete && !e.admitted && !e.issue;
      }
      shownIndices() {
        return (this.entries || []).flatMap((e, i) => this.matches(e) ? [i] : []);
      }
      selectShown(value) {
        if (this.busy || !this.entries) return;
        for (const i of this.shownIndices()) if (this.eligible(this.entries[i])) value ? this.selected.add(i) : this.selected.delete(i);
        this.update();
      }
      toggleEntry(i, range = false) {
        if (this.busy || !this.eligible(this.entries[i])) return;
        const shown = this.shownIndices(), end = shown.indexOf(i), start = shown.indexOf(this.rangeAnchor);
        if (range && start >= 0) {
          for (const j of shown.slice(Math.min(start, end), Math.max(start, end) + 1)) if (this.eligible(this.entries[j])) this.selected.add(j);
        } else {
          this.selected.has(i) ? this.selected.delete(i) : this.selected.add(i);
          this.rangeAnchor = i;
        }
        this.update();
      }
      renderTypes() {
        this.chips.empty();
        this.typeControls = [];
        const counts = /* @__PURE__ */ new Map();
        this.entries.forEach((e) => {
          if (this.needsReview(e)) counts.set(e.kind, (counts.get(e.kind) || 0) + 1);
        });
        const add = (kind, label) => {
          const b = this.chips.createEl("button", { text: label, cls: "kl-review-type" });
          b.onclick = () => {
            if (this.busy) return;
            if (kind === null) this.setTypes(null);
            else {
              const types = this.types === null ? /* @__PURE__ */ new Set([kind]) : new Set(this.types);
              if (this.types !== null) types.has(kind) ? types.delete(kind) : types.add(kind);
              this.setTypes(types);
            }
          };
          this.typeControls.push({ kind, button: b });
        };
        add(null, "All " + [...counts.values()].reduce((a, b) => a + b, 0));
        for (const [kind, count] of counts) add(kind, this.typeLabel(kind) + " " + count);
      }
      setTypes(types) {
        if (this.busy) return;
        this.types = types;
        this.renderCards();
        this.update();
      }
      renderCards() {
        this.list.empty();
        this.rows = /* @__PURE__ */ new Map();
        this.entries.forEach((entry, i) => {
          entry.box = null;
          if (!this.matches(entry)) return;
          const row = this.list.createDiv({ cls: "kl-review-row", attr: { tabindex: "0", "aria-label": entry.title } });
          const box = row.createEl("input", { type: "checkbox", attr: { "aria-label": "Select " + entry.title } });
          box.disabled = !this.eligible(entry);
          entry.box = box;
          box.onclick = (e) => {
            e.stopPropagation();
            this.toggleEntry(i, e.shiftKey);
            this.focusEntry(i);
          };
          const words = row.createDiv({ cls: "kl-review-row-words" });
          words.createDiv({ text: entry.title, cls: "kl-review-row-title", attr: { title: entry.title } });
          const reason = entry.issue || (!entry.complete ? "Incomplete" : entry.reviewWarning || "");
          words.createDiv({ text: entry.kind + " \xB7 line " + entry.line_start + (reason ? " \xB7 " + reason : ""), cls: "kl-review-row-meta", attr: { title: reason } });
          row.onclick = (e) => {
            if (e.shiftKey) this.toggleEntry(i, true);
            this.focusEntry(i);
          };
          row.onkeydown = (e) => {
            if (e.key === " ") {
              e.preventDefault();
              this.toggleEntry(i, e.shiftKey);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const shown2 = this.shownIndices(), at = shown2.indexOf(i), next = shown2[Math.max(0, Math.min(shown2.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))];
              this.rows.get(next)?.focus();
              this.focusEntry(next);
            }
          };
          row.onfocus = () => this.focusEntry(i);
          this.rows.set(i, row);
        });
        const shown = this.shownIndices();
        if (!shown.length) {
          this.list.createEl("p", { text: this.searchQuery ? "No matching entries." : this.entries.some((e) => this.matchesType(e)) ? "These entries are already indexed. Nothing to add." : "No entries of these types in this note. Choose another type above." });
          this.focused = null;
          ++this.previewTicket;
          clearTimeout(this.previewTimer);
          this.preview?.empty();
          this.currentOwner?.unload();
          this.previewOwners.delete(this.currentOwner);
          this.currentOwner = null;
        } else this.focusEntry(shown.includes(this.focused) ? this.focused : shown[0]);
      }
      focusEntry(i, force = false) {
        if (this.closed) return;
        for (const [j, row] of this.rows) row.toggleClass("is-focused", j === i);
        if (!force && this.focused === i) return;
        this.focused = i;
        clearTimeout(this.previewTimer);
        const ticket = ++this.previewTicket;
        this.previewTimer = setTimeout(() => this.renderPreview(i, ticket), 100);
      }
      async renderPreview(i, ticket) {
        if (this.closed || ticket !== this.previewTicket) return;
        const entry = this.entries[i], owner = new Component2();
        owner.load();
        this.previewOwners.add(owner);
        const stage = this.contentEl.ownerDocument.createElement("div");
        stage.className = "kl-review-preview-body";
        stage.createDiv({ cls: "kl-review-preview-meta", text: entry.kind + " \xB7 line " + entry.line_start });
        const body = stage.createDiv({ cls: "markdown-rendered" });
        try {
          await MarkdownRenderer2.render(this.app, entry.body.replace(/^(\s*>\s*\[![^\]]+\])[-+]/gm, "$1"), body, this.file.path, owner);
        } catch (e) {
          body.setText("Preview unavailable: " + e.message);
        }
        if (this.closed || ticket !== this.previewTicket) {
          owner.unload();
          this.previewOwners.delete(owner);
          return;
        }
        const source = stage.createEl("a", { text: "Open at source", attr: { href: "#" } });
        source.onclick = (e) => {
          e.preventDefault();
          this.close();
          this.view.setState({ ...this.view.getState(), mode: "source" }).then(() => {
            this.view.editor.setCursor({ line: entry.line_start - 1, ch: 0 });
            this.view.editor.scrollIntoView({ from: { line: entry.line_start - 1, ch: 0 }, to: { line: entry.line_start - 1, ch: 0 } }, true);
          });
        };
        const previous = this.currentOwner;
        this.preview.replaceChildren(stage);
        this.preview.scrollTop = 0;
        this.currentOwner = owner;
        previous?.unload();
        this.previewOwners.delete(previous);
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
      update() {
        if (!this.entries) return;
        this.entries.forEach((e, i) => {
          if (e.box) {
            e.box.checked = this.selected.has(i);
            e.box.disabled = !!this.busy || !this.eligible(e);
          }
        });
        const selected = this.selectedIndices().length, shown = this.shownIndices(), eligible = shown.filter((i) => this.eligible(this.entries[i])).length;
        const hidden = [...this.selected].filter((i) => this.entries[i] && this.eligible(this.entries[i]) && !this.matches(this.entries[i])).length;
        if (this.search) this.search.disabled = !!this.busy;
        this.button.disabled = this.busy || !!this.error || !selected;
        this.button.setText(this.busy ? "Adding\u2026" : `Add ${selected || "selected"} to index`);
        this.all.disabled = !!this.busy || !eligible;
        this.all.checked = !!eligible && selected === eligible;
        this.all.indeterminate = selected > 0 && selected < eligible;
        this.count.setText(`${selected} selected \xB7 ${shown.length} shown` + (hidden ? ` \xB7 ${hidden} hidden, not added` : ""));
        for (const { kind, button } of this.typeControls || []) {
          button.disabled = !!this.busy;
          button.setAttribute("aria-pressed", String(kind === null ? this.types === null : this.types !== null && this.types.has(kind)));
        }
        this.hint.setText(this.error || "");
      }
      async admit() {
        const selected = this.selectedIndices();
        if (this.busy || !selected.length || this.closed) return;
        this.error = null;
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
          if (plan.insertions.length || plan.edits?.length) {
            const changes = [...plan.insertions.map((insertion) => ({ from: insertion.line < editor.lineCount() ? { line: insertion.line, ch: 0 } : { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length }, text: insertion.text })), ...(plan.edits || []).map((e) => ({ from: editor.offsetToPos(e.from), to: editor.offsetToPos(e.to), text: e.insert }))];
            editor.transaction({ changes }, "knowledge-library-admission");
            if (hash(editor.getValue()) !== plan.afterHash) throw new Error("Marker placement needs review. The batch was not admitted. Use editor Undo to restore it.");
          }
          await this.adapter.savedText(this.view, plan.afterHash);
          const receipt = await this.adapter.request("live-finish", { token: plan.token });
          if (editor.cm) await this.adapter.plugin.componentIdentities?.observe(editor.cm);
          this.adapter.paths.add(this.file.path);
          this.adapter.lastReceipt = receipt;
          new Notice2(`Added ${receipt.entries.length} entries to the index.`);
          this.close();
        } catch (e) {
          this.error = e.message;
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
        this.closeResize?.();
        this.closed = true;
        ++this.previewTicket;
        clearTimeout(this.previewTimer);
        for (const owner of this.previewOwners) owner.unload();
        this.previewOwners.clear();
        this.contentEl.empty();
      }
    };
    module2.exports = class AdmissionAdapter {
      constructor(plugin, client) {
        this.plugin = plugin;
        this.client = client;
        this.paths = /* @__PURE__ */ new Set();
        this.pathsVersion = 0;
        this.paused = /* @__PURE__ */ new Set();
        this.timers = /* @__PURE__ */ new Map();
        this.closed = false;
      }
      acceptStatus(status, version = this.pathsVersion) {
        if (version !== this.pathsVersion) return false;
        this.paths = new Set(status.paths);
        return true;
      }
      async refreshPaths() {
        const version = this.pathsVersion, status = await this.request("live-status");
        this.acceptStatus(status, version);
        return status;
      }
      async start() {
        const status = await this.client.request({ op: "live-status" });
        this.meta = { profile: status.profile, epoch: status.epoch };
        this.acceptStatus(status.data);
        this.plugin.lastSequence = status.data.sequence;
        const recovery = await this.request("live-recover");
        if (recovery.pending.length) new Notice2(`${recovery.pending.length} admission reviews are pending; reopen note review to reconcile.`, 1e4);
        if (recovery.recovered.length) {
          const fresh = await this.refreshPaths();
          this.plugin.lastSequence = fresh.sequence;
        }
        const images = await this.request("live-image-change");
        if (images.changed) this.plugin.refreshBrowsers();
        for (const p of this.paths) this.schedule(p);
      }
      async request(op, args = {}) {
        try {
          return (await this.client.request({ op, ...this.meta, ...args })).data;
        } finally {
          if (["live-finish", "live-relocate", "live-rename", "live-move-tree", "live-recover", "live-stop-tracking", "live-cancel"].includes(op)) this.pathsVersion++;
        }
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
      async review(occurrence = null) {
        try {
          await this.ready;
          const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView2);
          if (!view?.file) {
            new Notice2("Open a Markdown note to review its callouts.");
            return;
          }
          new NoteReview(this, view, occurrence).open();
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
        if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path2)) {
          clearTimeout(this.timers.get(path2));
          this.timers.set(path2, setTimeout(async () => {
            this.timers.delete(path2);
            try {
              await this.ready;
              const result = await this.request("live-image-change", { path: path2 });
              if (result.changed) {
                this.plugin.refreshBrowsers();
                this.refreshImage(path2);
              }
            } catch (error) {
              new Notice2("Image update pending: " + error.message);
            }
          }, 300));
          return;
        }
        if (!this.paths.has(path2)) {
          clearTimeout(this.timers.get(path2));
          this.timers.set(path2, setTimeout(() => this.discover(path2), 1200));
          return;
        }
        clearTimeout(this.timers.get(path2));
        this.timers.set(path2, setTimeout(() => this.sync(path2).catch((e) => new Notice2("Index update pending: " + e.message)), 1800));
      }
      refreshImage(path2) {
        const file = this.plugin.app.vault.getAbstractFileByPath(path2);
        if (!file) return;
        const resource = this.plugin.app.vault.getResourcePath(file), base = resource.split("?")[0];
        this.plugin.app.workspace.iterateAllLeaves((leaf) => {
          for (const img of leaf.view.containerEl.querySelectorAll("img")) if (img.src.split("?")[0] === base) img.src = resource;
        });
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
            await this.refreshPaths();
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

// plugin/reference-refresh.js
var require_reference_refresh = __commonJS({
  "plugin/reference-refresh.js"(exports2, module2) {
    var ReferenceRefresh = class {
      constructor(feed, { delay = feed.delay, cancel = feed.cancelDelay, pollMs = 3e4, idle = globalThis.requestIdleCallback?.bind(globalThis), cancelIdle = globalThis.cancelIdleCallback?.bind(globalThis) } = {}) {
        this.feed = feed;
        this.delay = delay;
        this.cancel = cancel;
        this.pollMs = pollMs;
        this.checks = /* @__PURE__ */ new Set();
        this.parses = /* @__PURE__ */ new Set();
        this.removals = /* @__PURE__ */ new Set();
        this.diagnostics = /* @__PURE__ */ new Map();
        this.urgentChecks = /* @__PURE__ */ new Set();
        this.urgentParses = /* @__PURE__ */ new Set();
        this.running = false;
        this.closed = false;
        this.attempt = 0;
        this.policyDue = true;
        this.policyRevision = void 0;
        this.reconcile = null;
        this.idle = idle;
        this.cancelIdle = cancelIdle;
        this.lastProbe = 0;
        this.lastProgress = 0;
        this.policyBlocked = /* @__PURE__ */ new Set();
        this.pathRetries = /* @__PURE__ */ new Map();
        this.pathAttempts = /* @__PURE__ */ new Map();
      }
      probe() {
        const now = Date.now();
        if (now - this.lastProbe < 1e3) return;
        this.lastProbe = now;
        this.policyDue = true;
        this.kick();
      }
      progress() {
        return { checking: this.checks.size + this.urgentChecks.size, refreshing: this.parses.size + this.urgentParses.size, removing: this.removals.size, reconciling: !!this.reconcile, issues: this.diagnostics.size };
      }
      add(path2) {
        if (!this.closed && path2.endsWith(".md")) {
          this.cancel(this.pathRetries.get(path2));
          this.pathRetries.delete(path2);
          this.pathAttempts.delete(path2);
          this.checks.delete(path2);
          this.parses.delete(path2);
          this.urgentChecks.add(path2);
          this.kick();
        }
      }
      start() {
        for (const path2 of this.feed.known.keys()) if (!this.urgentChecks.has(path2)) this.checks.add(path2);
        this.kick();
        this.poll();
      }
      poll() {
        if (this.closed || this.pollTimer || !this.pollMs) return;
        this.pollTimer = this.delay(() => {
          this.pollTimer = null;
          this.policyDue = true;
          this.kick();
          this.poll();
        }, this.pollMs);
      }
      eligible(path2) {
        if (this.feed.pending.has(path2) || this.feed.unknown.has(path2)) return false;
        if ((this.feed.excludedFolders || []).some((folder) => path2 === folder || path2.startsWith(folder + "/"))) return false;
        return this.feed.known.has(path2) || !this.feed.app.vault.getAbstractFileByPath(path2);
      }
      take(set, limit) {
        const paths = [];
        let inspected = 0;
        for (const path2 of set) {
          set.delete(path2);
          if (this.eligible(path2)) paths.push(path2);
          if (++inspected >= limit) break;
        }
        return paths;
      }
      hasWork() {
        return this.urgentChecks.size || this.urgentParses.size || this.checks.size || this.parses.size || this.removals.size || this.policyDue || this.reconcile;
      }
      kick(ms = 10) {
        if (this.closed || this.timer || this.idleTask || this.running || !this.feed.ready || this.feed.running || !this.hasWork()) return;
        this.timer = this.delay(() => {
          this.timer = null;
          if (this.idle) this.idleTask = this.idle(() => {
            this.idleTask = null;
            this.step();
          }, { timeout: this.urgentChecks.size || this.urgentParses.size ? 250 : 2e3 });
          else this.step();
        }, ms);
      }
      observePolicy(revision, stamp = revision) {
        if (revision === null || revision === void 0) return;
        if (stamp !== this.policyStamp) {
          this.policyStamp = stamp;
          this.policyRevision = revision;
          this.reconcile = { after: "", revision };
          for (const path2 of this.policyBlocked) this.checks.add(path2);
          this.policyBlocked.clear();
        }
      }
      issue(path2, result) {
        this.diagnostics.set(path2, { path: path2, reason: result.issue || result.reason || "Reference unavailable", code: result.issueCode });
      }
      route(row, urgent = false) {
        const path2 = row.path;
        if (row.state === "current") {
          this.diagnostics.delete(path2);
          this.pathAttempts.delete(path2);
          return;
        }
        if (row.issueCode === "not-indexed") {
          if (urgent || this.urgentChecks.has(path2) || this.urgentParses.has(path2)) {
            this.parses.delete(path2);
            this.urgentParses.add(path2);
          } else this.parses.add(path2);
          return;
        }
        if (row.issueCode === "missing") {
          this.removals.add(path2);
          return;
        }
        this.issue(path2, row);
        if (row.issueCode === "policy-unavailable") this.policyBlocked.add(path2);
        if (row.issueCode === "unavailable" && !this.pathRetries.has(path2)) {
          const attempt = this.pathAttempts.get(path2) || 0;
          this.pathAttempts.set(path2, attempt + 1);
          const lane = urgent ? this.urgentChecks : this.checks;
          this.pathRetries.set(path2, this.delay(() => {
            this.pathRetries.delete(path2);
            if (!this.closed) {
              lane.add(path2);
              this.kick();
            }
          }, [1e3, 5e3, 3e4][Math.min(attempt, 2)]));
        }
      }
      async step() {
        if (this.closed || this.running || this.feed.running || !this.feed.ready) return;
        this.running = true;
        let restore = () => {
        }, retry = false, operation = "";
        try {
          if (this.urgentChecks.size || !this.urgentParses.size && (this.checks.size || this.policyDue)) {
            const urgent = !!this.urgentChecks.size, queue = urgent ? this.urgentChecks : this.checks;
            const paths = this.take(queue, 500);
            if (!paths.length && !this.policyDue) return;
            this.policyDue = false;
            restore = () => {
              for (const path2 of paths) queue.add(path2);
              this.policyDue = true;
            };
            const result = await this.feed.request("live-reference-check-notes", { paths, includePolicy: true });
            if (this.closed) return;
            this.observePolicy(result.policyRevision, result.policyStamp);
            if (result.issue) this.issue("numbering-policy", result);
            else this.diagnostics.delete("numbering-policy");
            for (const row of result.notes) this.route(row, urgent);
          } else if (this.urgentParses.size || this.parses.size && !this.removals.size) {
            const urgent = !!this.urgentParses.size;
            const [path2] = this.take(urgent ? this.urgentParses : this.parses, 1);
            if (!path2) return;
            restore = () => urgent ? this.urgentChecks.add(path2) : this.checks.add(path2);
            const result = await this.feed.request("live-reference-refresh-note", { path: path2 });
            if (this.closed) return;
            this.observePolicy(result.policyRevision, result.policyStamp);
            if (result.issueCode) this.route({ ...result, path: path2 }, urgent);
            else {
              this.diagnostics.delete(path2);
              this.pathAttempts.delete(path2);
            }
          } else if (this.removals.size) {
            const path2 = this.removals.values().next().value;
            this.removals.delete(path2);
            restore = () => this.removals.add(path2);
            if (this.feed.app.vault.getAbstractFileByPath(path2)) {
              this.checks.add(path2);
              return;
            }
            await this.feed.request("live-reference-index-remove", { path: path2 });
            this.diagnostics.delete(path2);
          } else if (this.reconcile) {
            operation = "reconcile";
            const cursor = this.reconcile;
            restore = () => {
              this.reconcile = null;
              this.policyDue = true;
            };
            const result = await this.feed.request("live-reference-policy-reconcile", { after: cursor.after, revision: cursor.revision, limit: 500 });
            if (this.closed) return;
            this.reconcile = result.nextCursor ? { after: result.nextCursor, revision: result.revision } : null;
            for (const path2 of result.indexedPaths || []) this.checks.add(path2);
            for (const row of result.issues || []) this.issue(row.path, row);
          }
          this.diagnostics.delete("reference-refresh");
          if (!retry) this.attempt = 0;
        } catch (error) {
          if (this.closed) return;
          this.issue("reference-refresh", { issue: error.message });
          if (error.retryable !== false) {
            restore();
            retry = true;
          } else if (operation === "reconcile") {
            this.reconcile = null;
            this.policyDue = true;
            retry = true;
          }
        } finally {
          this.running = false;
          if (!this.closed && (Date.now() - this.lastProgress >= 500 || !this.hasWork())) {
            this.lastProgress = Date.now();
            this.feed.onReferenceProgress?.(this.progress());
          }
          if (!this.closed) this.kick(retry ? [1e3, 5e3, 3e4][Math.min(this.attempt++, 2)] : 10);
        }
      }
      close() {
        this.closed = true;
        this.cancel(this.timer);
        this.cancel(this.pollTimer);
        if (this.idleTask) this.cancelIdle?.(this.idleTask);
        for (const timer of this.pathRetries.values()) this.cancel(timer);
        this.pathRetries.clear();
        this.policyBlocked.clear();
        this.checks.clear();
        this.parses.clear();
        this.urgentChecks.clear();
        this.urgentParses.clear();
        this.removals.clear();
      }
    };
    module2.exports = { ReferenceRefresh };
  }
});

// plugin/document-feed.js
var require_document_feed = __commonJS({
  "plugin/document-feed.js"(exports2, module2) {
    var validId = /^[A-Za-z0-9-]{1,80}$/;
    var DocumentFeed2 = class {
      constructor(app, request, { excludedFolders = [], editorClaim = () => void 0, canInitialize = () => true, schedule = (fn) => setTimeout(fn, 0), delay = (fn, ms) => setTimeout(fn, ms), cancelDelay = (id) => clearTimeout(id), onError = () => {
      }, references = false, onReferenceProgress = () => {
      } } = {}) {
        this.app = app;
        this.request = request;
        this.editorClaim = editorClaim;
        this.excludedFolders = excludedFolders;
        this.schedule = schedule;
        this.onError = onError;
        this.canInitialize = canInitialize;
        this.delay = delay;
        this.cancelDelay = cancelDelay;
        this.retryAttempt = 0;
        this.known = /* @__PURE__ */ new Map();
        this.unknown = /* @__PURE__ */ new Set();
        this.pending = /* @__PURE__ */ new Set();
        this.renames = [];
        this.ready = false;
        this.closed = false;
        this.running = false;
        this.scheduled = false;
        this.diagnostics = /* @__PURE__ */ new Map();
        this.onReferenceProgress = onReferenceProgress;
        if (references) this.references = new (require_reference_refresh()).ReferenceRefresh(this);
      }
      record(file) {
        if (!file || file.extension !== "md") return null;
        const editor = this.editorClaim(file.path);
        if (editor && !editor.valid) {
          this.diagnostics.set(file.path, { path: file.path, reason: editor.reason, source: "editor" });
          return void 0;
        }
        if (["editor", "metadata"].includes(this.diagnostics.get(file.path)?.source)) this.diagnostics.delete(file.path);
        const cache = editor ? null : this.app.metadataCache.getFileCache(file);
        if (!editor && cache == null) return void 0;
        const id = editor ? editor.documentId : cache.frontmatter?.["kl-doc"];
        if (!editor && cache.frontmatter && Object.prototype.hasOwnProperty.call(cache.frontmatter, "kl-doc") && !(typeof id === "string" && id !== "lib" && validId.test(id))) {
          this.diagnostics.set(file.path, { path: file.path, reason: "Document identity property is invalid; normalize it before linking.", source: "metadata" });
          return void 0;
        }
        return {
          path: file.path,
          documentId: typeof id === "string" && id !== "lib" && validId.test(id) ? id : null,
          excluded: this.excludedFolders.some((folder) => file.path === folder || file.path.startsWith(folder + "/"))
        };
      }
      changed(file) {
        if (this.closed) return;
        this.pending.add(file.path);
        this.references?.add(file.path);
        this.wake();
      }
      deleted(file) {
        if (this.closed) return;
        for (const path2 of [...this.known.keys(), ...this.unknown]) if (path2 === file.path || path2.startsWith(file.path + "/")) {
          this.pending.add(path2);
          this.references?.add(path2);
        }
        this.wake();
      }
      renamed(file, oldPath) {
        if (this.closed) return;
        this.renames.push({ oldPath, path: file.path });
        this.pending.add(oldPath);
        this.pending.add(file.path);
        this.wake();
        for (const old of [...this.known.keys(), ...this.unknown]) if (old === oldPath || old.startsWith(oldPath + "/")) {
          this.references?.add(old);
          this.references?.add(file.path + old.slice(oldPath.length));
        }
      }
      wake() {
        if (this.closed || this.scheduled || this.running) return;
        if (this.retryTimer) {
          this.cancelDelay(this.retryTimer);
          this.retryTimer = null;
        }
        this.scheduled = true;
        this.schedule(() => {
          this.scheduled = false;
          this.flush().then(() => {
            this.retryAttempt = 0;
          }).catch((error) => {
            this.onError(error);
            if (error.retryable === false) this.diagnostics.set("metadata-service", { reason: error.message });
            else if (!this.closed) this.retryTimer = this.delay(() => {
              this.retryTimer = null;
              this.wake();
            }, [1e3, 5e3, 3e4][Math.min(this.retryAttempt++, 2)]);
          });
        });
      }
      async initialize() {
        if (!this.canInitialize()) return false;
        const files = this.app.vault.getMarkdownFiles(), records = [], unknown = [];
        for (let offset = 0; offset < files.length; offset += 100) {
          if (this.closed) return false;
          for (const file of files.slice(offset, offset + 100)) {
            const record = this.record(file);
            if (record === void 0) {
              unknown.push(file.path);
              this.pending.add(file.path);
              continue;
            }
            if (record) records.push(record);
          }
          if (offset + 100 < files.length) await new Promise((resolve) => this.schedule(resolve));
        }
        if (this.closed) return false;
        const result = await this.request("live-document-snapshot", { records, unknown });
        for (const item of result?.rejected || []) this.diagnostics.set(item.path, item);
        this.known = new Map(records.map((row) => [row.path, JSON.stringify(row)]));
        this.unknown = new Set(unknown);
        this.ready = true;
        this.references?.start();
        return true;
      }
      flush() {
        if (!this.inflight) this.inflight = this.performFlush().finally(() => {
          this.inflight = null;
        });
        return this.inflight;
      }
      async performFlush() {
        if (this.closed || this.running) return;
        this.running = true;
        let resetAttempted = false;
        try {
          if (!this.ready && !await this.initialize()) return;
          while (!this.closed && (this.pending.size || this.renames.length)) {
            const renames = this.renames.splice(0);
            for (let index = 0; index < renames.length; index++) {
              const move = renames[index];
              try {
                await this.request("live-document-rename", move);
              } catch (error) {
                if (error.retryable !== false) {
                  this.renames.unshift(...renames.slice(index));
                  throw error;
                }
                this.diagnostics.set("rename:" + move.oldPath, { path: move.oldPath, newPath: move.path, reason: error.message, state: "pending" });
                for (const old of [...this.known.keys(), ...this.unknown]) if (old === move.oldPath || old.startsWith(move.oldPath + "/")) {
                  this.pending.add(old);
                  this.pending.add(move.path + old.slice(move.oldPath.length));
                }
                this.pending.add(move.path);
                continue;
              }
              for (const old of [...this.known.keys()]) if (old === move.oldPath || old.startsWith(move.oldPath + "/")) {
                const row = JSON.parse(this.known.get(old));
                this.known.delete(old);
                row.path = move.path + old.slice(move.oldPath.length);
                this.known.set(row.path, JSON.stringify(row));
                this.pending.add(row.path);
              }
              for (const old of [...this.unknown]) if (old === move.oldPath || old.startsWith(move.oldPath + "/")) {
                this.unknown.delete(old);
                const path2 = move.path + old.slice(move.oldPath.length);
                this.unknown.add(path2);
                this.pending.add(path2);
              }
            }
            const paths = [...this.pending];
            this.pending.clear();
            const records = [], deleted = [], next = [];
            for (const path2 of paths) {
              const file = this.app.vault.getAbstractFileByPath(path2), row = this.record(file);
              if (row === void 0) {
                this.pending.add(path2);
                continue;
              }
              if (!row) {
                if (this.known.has(path2) || this.unknown.has(path2)) deleted.push(path2);
                continue;
              }
              const encoded = JSON.stringify(row);
              if (encoded !== this.known.get(path2)) {
                records.push(row);
                next.push([path2, encoded]);
              }
            }
            if (records.length || deleted.length) {
              try {
                const result = await this.request("live-document-update", { records, deleted });
                for (const path2 of [...records.map((r) => r.path), ...deleted]) this.diagnostics.delete(path2);
                for (const item of result?.rejected || []) this.diagnostics.set(item.path, item);
                for (const item of this.diagnostics.values()) if (item.newPath && paths.some((p) => p === item.path || p.startsWith(item.path + "/")) && paths.some((p) => p === item.newPath || p.startsWith(item.newPath + "/"))) item.state = "resolved";
              } catch (error) {
                if (error.retryable === false) {
                  for (const path2 of paths) this.diagnostics.set(path2, { path: path2, reason: error.message });
                  if (!resetAttempted) {
                    resetAttempted = true;
                    this.ready = false;
                    for (const path2 of paths) this.pending.add(path2);
                    if (!await this.initialize()) return;
                  }
                  continue;
                }
                for (const path2 of paths) this.pending.add(path2);
                throw error;
              }
              for (const path2 of deleted) {
                this.known.delete(path2);
                this.unknown.delete(path2);
              }
              for (const [path2, encoded] of next) {
                this.known.set(path2, encoded);
                this.unknown.delete(path2);
              }
              for (const path2 of [...records.map((row) => row.path), ...deleted]) this.references?.add(path2);
            }
            if (!records.length && !deleted.length && this.pending.size && !this.renames.length) break;
          }
        } finally {
          this.running = false;
          this.references?.kick();
        }
      }
      close() {
        this.closed = true;
        this.references?.close();
        this.cancelDelay(this.retryTimer);
        this.pending.clear();
        this.renames = [];
      }
    };
    module2.exports = { DocumentFeed: DocumentFeed2 };
  }
});

// plugin/entry-palette.js
var require_entry_palette = __commonJS({
  "plugin/entry-palette.js"(exports2, module2) {
    module2.exports = {
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
  }
});

// plugin/reference-focus.js
var require_reference_focus = __commonJS({
  "plugin/reference-focus.js"(exports2, module2) {
    function holdReferenceFocus(modal, input) {
      const doc = input.ownerDocument, win = doc.defaultView;
      const hosts = [...doc.querySelectorAll(".math-studio-host")].filter((el) => !modal.contains(el));
      const prior = hosts.map((el) => [el, el.inert]);
      for (const [el] of prior) el.inert = true;
      let closed = false;
      const timers = [];
      const focus = () => {
        if (!closed && input.isConnected) input.focus({ preventScroll: true });
      };
      const outside = (e) => {
        if (!closed && hosts.some((el) => el === e.target || el.contains(e.target))) focus();
      };
      doc.addEventListener("focusin", outside, true);
      for (const delay of [0, 50, 150]) timers.push(win.setTimeout(focus, delay));
      const frame = win.requestAnimationFrame(focus);
      return () => {
        closed = true;
        for (const t of timers) win.clearTimeout(t);
        win.cancelAnimationFrame(frame);
        doc.removeEventListener("focusin", outside, true);
        for (const [el, inert] of prior) el.inert = inert;
      };
    }
    module2.exports = { holdReferenceFocus };
  }
});

// plugin/entry-layout.js
var require_entry_layout = __commonJS({
  "plugin/entry-layout.js"(exports2, module2) {
    function placement(anchor, viewport) {
      const width = Math.min(520, Math.max(100, viewport.width - 32));
      const left = Math.max(16, Math.min(anchor.left, viewport.width - width - 16));
      const below = viewport.height - anchor.bottom - 24, above = anchor.top - 24;
      const useBelow = below >= 180 || below >= above;
      const available = Math.max(80, useBelow ? below : above);
      return {
        position: "fixed",
        margin: "0",
        left: left + "px",
        width: width + "px",
        top: useBelow ? Math.max(16, anchor.bottom + 8) + "px" : "auto",
        bottom: useBelow ? "auto" : Math.max(16, viewport.height - anchor.top + 8) + "px",
        maxHeight: Math.min(viewport.height * 0.6, available) + "px"
      };
    }
    function canRestoreFocus(target, anchor, active) {
      if (!active || active === target.ownerDocument.body) return true;
      if (active === target) return false;
      if (target.contains?.(active)) {
        const control = active.closest?.('input,textarea,select,button,[contenteditable="true"],[role="textbox"]');
        return !control || control === target;
      }
      return active === anchor;
    }
    module2.exports = { placement, canRestoreFocus };
  }
});

// plugin/figure-panels.js
var require_figure_panels = __commonJS({
  "plugin/figure-panels.js"(exports2, module2) {
    function panels(body = "") {
      const explicit = body.split("\n", 1)[0].match(/(?:\||\s)panels=([A-Za-z0-9,]+)(?=\s|\])/);
      if (explicit) return [...new Set(explicit[1].split(","))];
      const prose = body.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, "");
      return [...new Set([...prose.matchAll(/(?:^|[\s>*;:])\(([a-z]|[ivx]{1,4}|[1-9][0-9]?)\)(?=[\s*.,:])/g)].map((m) => m[1]))];
    }
    function target(row, panel) {
      const id = row.entityId || row.id;
      return panel ? id + "-panel-" + panel : id;
    }
    function emphasize(body, panel) {
      const doc = body.ownerDocument, walker = doc.createTreeWalker(body, 4), needle = "(" + panel + ")";
      let node;
      while (node = walker.nextNode()) {
        if (node.parentElement.closest(".math,code,.callout-title")) continue;
        const at = node.data.indexOf(needle);
        if (at < 0) continue;
        const range = doc.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        const mark = doc.createElement("mark");
        mark.className = "kl-selected-panel";
        range.surroundContents(mark);
        return mark;
      }
      return null;
    }
    module2.exports = { panels, target, emphasize };
  }
});

// plugin/reference-session.js
var require_reference_session = __commonJS({
  "plugin/reference-session.js"(exports2, module2) {
    var { catalogRows, normalize } = require_filter_model();
    var hash = (text) => require("crypto").createHash("sha256").update(text).digest("hex");
    function defaultFilters(settings, catalog, context, purpose) {
      const previous = settings.filters?.state?.tokens || [];
      const tokens = purpose === "justification" ? catalogRows(catalog).filter((t) => t.kind === "type" && ["result", "definition", "theorem", "lemma", "corollary", "proposition", "equation", "notation"].includes(t.id)) : previous.filter((t) => t.kind === "type").map((t) => ({ ...t }));
      const source = catalogRows(catalog).find((r) => r.id === context?.defaultSource?.id);
      if (source) tokens.unshift(source);
      return { query: "", filters: { version: 2, state: { query: "", tokens, cursor: [0, 0], draft: null } } };
    }
    function inScope(path2, vaultId, request, sources) {
      if (request.vaultIds !== null && !request.vaultIds.includes(vaultId)) return false;
      if (request.sourceIds === null) return true;
      return request.sourceIds.some((id) => {
        const s = sources.find((s2) => s2.id === id);
        return s?.vaultId === vaultId && (s.folder ? path2.startsWith(s.path + "/") : path2 === s.path);
      });
    }
    var ReferenceSession = class {
      constructor(plugin, editor, info) {
        this.plugin = plugin;
        this.editor = editor;
        this.info = info;
        this.path = info.file.path;
        this.text = editor.getValue();
        this.snapshot = editor.cm?.state.doc;
        this.positions = [editor.getCursor("from"), editor.getCursor("to")];
        this.words = editor.getSelection();
        this.mode = this.words ? "c" : "auto";
      }
      async load() {
        await this.plugin.admission.ready;
        await this.plugin.documentFeed.flush().catch(() => {
        });
        this.local = await this.plugin.admission.request("live-editor-reference-preview", { path: this.path, text: this.text, sourceHash: hash(this.text) });
        for (const row of this.local.occurrences) row.searchText = normalize(row.title + " " + row.kind + " " + (row.display?.numberLabel || "") + " " + row.body);
      }
      localGroup(query, request, sources, context) {
        if (!this.local || !inScope(this.path, context.note.vaultId, request, sources)) return [];
        const terms = normalize(query).split(/\s+/).filter(Boolean);
        const rows = this.local.occurrences.filter((row) => (request.types === null || request.types.includes(row.kind)) && terms.every((term) => (row.searchText || normalize(row.title + " " + row.kind + " " + row.body)).includes(term)));
        return rows.map((row) => ({
          ...row,
          id: "local-" + row.from,
          local: true,
          title: row.display?.title || row.title,
          path: this.path,
          sourcePath: this.path,
          vault: this.plugin.app.vault.getName(),
          vaultRoot: this.plugin.app.vault.adapter.getBasePath(),
          line_start: row.line_start,
          copies: 1,
          context_after: "",
          status: "current"
        }));
      }
      label(row) {
        const d = row?.display;
        const value = this.mode === "c" ? this.words : this.mode === "n" ? d?.numberLabel : this.mode === "b" ? d?.bothLabel : this.mode === "t" ? d?.title || row?.referenceTitle || row?.title : d?.numberLabel ? d.numberLabel : d?.title || row?.referenceTitle || row?.title;
        return value && this.panel && this.mode !== "c" ? value + "(" + this.panel + ")" : value;
      }
      reason(row) {
        if (!row) return "Choose a result to link.";
        if (row.display?.issue) return row.display.issue;
        if (row.local && !row.entityId && this.local?.identityContext?.status === "uninitialized") return "Still reading note metadata; try again in a moment.";
        return this.label(row) ? null : "Choose a label for this reference.";
      }
      async apply(row) {
        if (this.reason(row)) throw Error(this.reason(row));
        if (this.editor.getValue() !== this.text || this.info.file?.path !== this.path) throw Error("The note changed. Close and reopen Insert reference.");
        const operation = row.local && !row.entityId ? "live-editor-reference" : "live-editor-library-reference";
        const plan = await this.plugin.admission.request(operation + "-plan", { path: this.path, text: this.text, sourceHash: hash(this.text), at: row.from, entryId: require_figure_panels().target(row, this.panel), selection: this.positions, mode: this.mode });
        await this.plugin.admission.request(operation + "-verify", { plan, text: this.text });
        const cm = this.editor.cm;
        if (this.closed) return false;
        if (!cm || cm.state.doc !== this.snapshot || this.info.file?.path !== this.path) throw Error("The note changed. Close and reopen Insert reference.");
        const changes = plan.editorChanges.map((e) => ({ from: this.editor.posToOffset(e.from), to: this.editor.posToOffset(e.to), insert: e.text }));
        cm.dispatch({ changes, userEvent: "input.reference" });
        if (cm.state.doc === this.snapshot) throw Error("Another editor extension blocked the insertion; nothing changed.");
        if (hash(this.editor.getValue()) !== plan.afterHash) throw Error("The editor changed the insertion. Please undo it; the source was not written separately.");
        return true;
      }
    };
    module2.exports = { ReferenceSession, defaultFilters, inScope };
  }
});

// plugin/callout-presentation.js
var require_callout_presentation = __commonJS({
  "plugin/callout-presentation.js"(exports2, module2) {
    var attrs = ["data-kl-heading-prefix", "data-kl-heading-suffix", "data-kl-heading-issue"];
    function presentation(occurrence) {
      const d = occurrence?.display;
      if (!d || d.state === "issue") return { prefix: "", suffix: "", issue: d?.issue || "", label: occurrence?.title || d?.displayType || "Callout" };
      if (d.sourceTitle !== void 0) return { prefix: "", suffix: "", label: d.sourceTitle, issue: d.warning || "" };
      const label = d.numberLabel ? d.bothLabel : occurrence.title || d.displayType;
      if (!d.numberLabel) return { prefix: "", suffix: "", label, issue: d.warning || "" };
      if (!occurrence.title) return { prefix: "", suffix: "", label, issue: d.warning || "", replaceDefault: d.numberLabel, fallbacks: [occurrence.sourceStyle?.charAt(0).toUpperCase() + occurrence.sourceStyle?.slice(1).toLowerCase(), d.displayType] };
      if (d.authoredNumber) {
        return { prefix: "", suffix: "", label, issue: d.warning || "", replace: d.number !== d.authoredNumber || d.overrideAuthored && d.numberLabel !== d.authoredLabel ? { from: d.authoredPrefix, to: d.numberLabel } : null };
      }
      return { prefix: occurrence.title ? d.numberLabel + ": " : "", suffix: occurrence.title ? "" : " " + d.number, label, issue: d.warning || "" };
    }
    var CalloutHeadings = class {
      constructor() {
        this.entries = /* @__PURE__ */ new Map();
      }
      render(element, occurrence) {
        const p = presentation(occurrence), key = JSON.stringify(p);
        let old = this.entries.get(element);
        if (old?.key === key) return;
        if (!old) {
          old = { marker: element.getAttribute("data-kl-heading"), attrs: attrs.map((a) => element.getAttribute(a)), tooltip: element.getAttribute("title") };
          this.entries.set(element, old);
        }
        if (old.changed && old.changed.node.data === old.changed.after) old.changed.node.data = old.changed.before;
        old.changed = null;
        old.key = key;
        element.setAttribute("data-kl-heading", "");
        if (p.replaceDefault) {
          const node = element.firstChild;
          if (node?.nodeType === 3 && element.childNodes.length === 1 && p.fallbacks.includes(node.data)) {
            const before = node.data, after = p.replaceDefault;
            node.data = after;
            old.changed = { node, before, after };
          } else p.issue = "Computed label is " + p.replaceDefault + ". Native title retained.";
        } else if (p.replace) {
          const node = element.firstChild, from = p.replace.from;
          if (from && node?.nodeType === 3 && node.data.startsWith(from) && !/^(?:[\p{L}\p{N}]|\.\d)/u.test(node.data.slice(from.length))) {
            const before = node.data, after = p.replace.to + before.slice(from.length);
            node.data = after;
            old.changed = { node, before, after };
          } else p.issue = "Authored title retained: computed label is " + p.replace.to + ". Edit its prefix to apply automatic numbering.";
        }
        for (const [name, value] of [[attrs[0], p.prefix], [attrs[1], p.suffix], [attrs[2], p.issue]]) {
          if (value) {
            if (element.getAttribute(name) !== value) element.setAttribute(name, value);
          } else element.removeAttribute(name);
        }
        if (p.issue) element.setAttribute("title", p.issue);
        else if (old.tooltip === null) element.removeAttribute("title");
        else element.setAttribute("title", old.tooltip);
      }
      remove(element) {
        const old = this.entries.get(element);
        if (!old) return;
        if (old.changed && old.changed.node.data === old.changed.after) old.changed.node.data = old.changed.before;
        attrs.forEach((name, i) => {
          if (old.attrs[i] === null) element.removeAttribute(name);
          else element.setAttribute(name, old.attrs[i]);
        });
        if (old.tooltip === null) element.removeAttribute("title");
        else element.setAttribute("title", old.tooltip);
        if (old.marker === null) element.removeAttribute("data-kl-heading");
        else element.setAttribute("data-kl-heading", old.marker);
        this.entries.delete(element);
      }
      close() {
        for (const element of this.entries.keys()) this.remove(element);
      }
    };
    function pickerPresentation(item) {
      const d = item?.display;
      if (!item?.local || !d || d.state === "issue" || d.issue) return { title: item.title, kind: item.kind };
      return { title: d.numberLabel ? d.bothLabel || d.numberLabel : d.title || item.title || d.displayType, kind: d.displayType || item.kind };
    }
    module2.exports = { presentation, CalloutHeadings, pickerPresentation };
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/common/dist/index.cjs
var require_dist = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/common/dist/index.cjs"(exports2) {
    "use strict";
    var DefaultBufferLength = 1024;
    var nextPropID = 0;
    var Range = class {
      constructor(from, to) {
        this.from = from;
        this.to = to;
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
      constructor(tree, overlay, parser, bracketed = false) {
        this.tree = tree;
        this.overlay = overlay;
        this.parser = parser;
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
      constructor(name, props, id, flags = 0) {
        this.name = name;
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
      is(name) {
        if (typeof name == "string") {
          if (this.name == name)
            return true;
          let group = this.prop(NodeProp.group);
          return group ? group.indexOf(name) > -1 : false;
        }
        return this.id == name;
      }
      /**
      Create a function from node types to arbitrary values by
      specifying an object whose property names are node or
      [group](#common.NodeProp^group) names. Often useful with
      [`NodeProp.add`](#common.NodeProp.add). You can put multiple
      names, separated by spaces, in a single property name to map
      multiple node names to a single value.
      */
      static match(map) {
        let direct = /* @__PURE__ */ Object.create(null);
        for (let prop in map)
          for (let name of prop.split(" "))
            direct[name] = map[prop];
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
    exports2.IterMode = void 0;
    (function(IterMode) {
      IterMode[IterMode["ExcludeBuffers"] = 1] = "ExcludeBuffers";
      IterMode[IterMode["IncludeAnonymous"] = 2] = "IncludeAnonymous";
      IterMode[IterMode["IgnoreMounts"] = 4] = "IgnoreMounts";
      IterMode[IterMode["IgnoreOverlays"] = 8] = "IgnoreOverlays";
      IterMode[IterMode["EnterBracketed"] = 16] = "EnterBracketed";
    })(exports2.IterMode || (exports2.IterMode = {}));
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
        let { enter, leave, from = 0, to = this.length } = spec;
        let mode = spec.mode || 0, anon = (mode & exports2.IterMode.IncludeAnonymous) > 0;
        for (let c = this.cursor(mode | exports2.IterMode.IncludeAnonymous); ; ) {
          let entered = false;
          if (c.from <= to && c.to >= from && (!anon && c.type.isAnonymous || enter(c) !== false)) {
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
      constructor(buffer, length, set) {
        this.buffer = buffer;
        this.length = length;
        this.set = set;
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
          let to = copy[j++] = b[i++] - from;
          copy[j++] = b[i++] - startI;
          len = Math.max(len, to);
        }
        return new _TreeBuffer(copy, len, this.set);
      }
    };
    function checkSide(side, pos, from, to) {
      switch (side) {
        case -2:
          return from < pos;
        case -1:
          return to >= pos && from < pos;
        case 0:
          return from < pos && to > pos;
        case 1:
          return from <= pos && to > pos;
        case 2:
          return to > pos;
        case 4:
          return true;
      }
    }
    function resolveNode(node, pos, side, overlays) {
      var _a;
      while (node.from == node.to || (side < 1 ? node.from >= pos : node.from > pos) || (side > -1 ? node.to <= pos : node.to < pos)) {
        let parent = !overlays && node instanceof TreeNode && node.index < 0 ? null : node.parent;
        if (!parent)
          return node;
        node = parent;
      }
      let mode = overlays ? 0 : exports2.IterMode.IgnoreOverlays;
      if (overlays)
        for (let scan = node, parent = scan.parent; parent; scan = parent, parent = scan.parent) {
          if (scan instanceof TreeNode && scan.index < 0 && ((_a = parent.enter(pos, side, mode)) === null || _a === void 0 ? void 0 : _a.from) != scan.from)
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
            if (!(mode & exports2.IterMode.EnterBracketed && next instanceof Tree && (mounted = MountedTree.get(next)) && !mounted.overlay && mounted.bracketed && pos >= start && pos <= start + next.length) && !checkSide(side, pos, start, start + next.length))
              continue;
            if (next instanceof TreeBuffer) {
              if (mode & exports2.IterMode.ExcludeBuffers)
                continue;
              let index = next.findChild(0, next.buffer.length, dir, pos - start, side);
              if (index > -1)
                return new BufferNode(new BufferContext(parent, next, i, start), null, index);
            } else if (mode & exports2.IterMode.IncludeAnonymous || (!next.type.isAnonymous || hasChild(next))) {
              let mounted2;
              if (!(mode & exports2.IterMode.IgnoreMounts) && (mounted2 = MountedTree.get(next)) && !mounted2.overlay)
                return new _TreeNode(mounted2.tree, start, i, parent);
              let inner = new _TreeNode(next, start, i, parent);
              return mode & exports2.IterMode.IncludeAnonymous || !inner.type.isAnonymous ? inner : inner.nextChild(dir < 0 ? next.children.length - 1 : 0, dir, pos, side, mode);
            }
          }
          if (mode & exports2.IterMode.IncludeAnonymous || !parent.type.isAnonymous)
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
        if (!(mode & exports2.IterMode.IgnoreOverlays) && (mounted = MountedTree.get(this._tree)) && mounted.overlay) {
          let rPos = pos - this.from, enterBracketed = mode & exports2.IterMode.EnterBracketed && mounted.bracketed;
          for (let { from, to } of mounted.overlay) {
            if ((side > 0 || enterBracketed ? from <= rPos : from < rPos) && (side < 0 || enterBracketed ? to >= rPos : to > rPos))
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
      for (let p = node; i >= 0; p = p.parent) {
        if (!p)
          return false;
        if (!p.type.isAnonymous) {
          if (context[i] && context[i] != p.name)
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
        if (mode & exports2.IterMode.ExcludeBuffers)
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
        this.mode = mode & ~exports2.IterMode.EnterBracketed;
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
        return mode & exports2.IterMode.ExcludeBuffers ? false : this.enterChild(1, pos, side);
      }
      /**
      Move to the node's parent node, if this isn't the top node.
      */
      parent() {
        if (!this.buffer)
          return this.yieldNode(this.mode & exports2.IterMode.IncludeAnonymous ? this._tree._parent : this._tree.parent);
        if (this.stack.length)
          return this.yieldBuf(this.stack.pop());
        let parent = this.mode & exports2.IterMode.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
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
              if (this.mode & exports2.IterMode.IncludeAnonymous || child instanceof TreeBuffer || !child.type.isAnonymous || hasChild(child))
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
      var _a;
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
          let lastGroup = 0, lastEnd = end, groupLookAhead = lookAheadAtStart;
          while (cursor.pos > endPos) {
            if (localInRepeat >= 0 && cursor.id == localInRepeat && cursor.size >= 0) {
              if (cursor.end <= lastEnd - maxBufferLength) {
                makeRepeatLeaf(localChildren, localPositions, start, lastGroup, cursor.end, lastEnd, localInRepeat, groupLookAhead, contextAtStart);
                lastGroup = localChildren.length;
                lastEnd = cursor.end;
                groupLookAhead = lookAhead;
              }
              cursor.next();
            } else if (depth > 2500) {
              takeFlatNode(start, endPos, localChildren, localPositions);
            } else {
              takeNode(start, endPos, localChildren, localPositions, localInRepeat, depth + 1);
            }
          }
          if (localInRepeat >= 0 && lastGroup > 0 && lastGroup < localChildren.length)
            makeRepeatLeaf(localChildren, localPositions, start, lastGroup, start, lastEnd, localInRepeat, groupLookAhead, contextAtStart);
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
              lookAhead2 = positions2[lastI] + last.length + lookAheadProp - length2;
          }
          return makeTree(type, children2, positions2, length2, lookAhead2, contextHash2);
        };
      }
      function makeRepeatLeaf(children2, positions2, base, i, from, to, type, lookAhead2, contextHash2) {
        let localChildren = [], localPositions = [];
        while (children2.length > i) {
          localChildren.push(children2.pop());
          localPositions.push(positions2.pop() + base - from);
        }
        children2.push(makeTree(nodeSet.types[type], localChildren, localPositions, to - from, lookAhead2 - to, contextHash2));
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
      let length = (_a = data.length) !== null && _a !== void 0 ? _a : children.length ? positions[0] + children[0].length : 0;
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
    function balanceRange(balanceType, children, positions, from, to, start, length, mkTop, mkTree) {
      let total = 0;
      for (let i = from; i < to; i++)
        total += nodeSize(balanceType, children[i]);
      let maxChild = Math.ceil(
        total * 1.5 / 8
        /* Balance.BranchFactor */
      );
      let localChildren = [], localPositions = [];
      function divide(children2, positions2, from2, to2, offset) {
        for (let i = from2; i < to2; ) {
          let groupFrom = i, groupStart = positions2[i], groupSize = nodeSize(balanceType, children2[i]);
          i++;
          for (; i < to2; i++) {
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
      divide(children, positions, from, to, 0);
      return (mkTop || mkTree)(localChildren, localPositions, length);
    }
    var NodeWeakMap = class {
      constructor() {
        this.map = /* @__PURE__ */ new WeakMap();
      }
      setBuffer(buffer, index, value) {
        let inner = this.map.get(buffer);
        if (!inner)
          this.map.set(buffer, inner = /* @__PURE__ */ new Map());
        inner.set(index, value);
      }
      getBuffer(buffer, index) {
        let inner = this.map.get(buffer);
        return inner && inner.get(index);
      }
      /**
      Set the value for this syntax node.
      */
      set(node, value) {
        if (node instanceof BufferNode)
          this.setBuffer(node.context.buffer, node.index, value);
        else if (node instanceof TreeNode)
          this.map.set(node.tree, value);
      }
      /**
      Retrieve value for this syntax node, if it exists in the map.
      */
      get(node) {
        return node instanceof BufferNode ? this.getBuffer(node.context.buffer, node.index) : node instanceof TreeNode ? this.map.get(node.tree) : void 0;
      }
      /**
      Set the value for the node that a cursor currently points to.
      */
      cursorSet(cursor, value) {
        if (cursor.buffer)
          this.setBuffer(cursor.buffer.buffer, cursor.index, value);
        else
          this.map.set(cursor.tree, value);
      }
      /**
      Retrieve the value for the node that a cursor currently points
      to.
      */
      cursorGet(cursor) {
        return cursor.buffer ? this.getBuffer(cursor.buffer.buffer, cursor.index) : this.map.get(cursor.tree);
      }
    };
    var TreeFragment = class _TreeFragment {
      /**
      Construct a tree fragment. You'll usually want to use
      [`addTree`](#common.TreeFragment^addTree) and
      [`applyChanges`](#common.TreeFragment^applyChanges) instead of
      calling this directly.
      */
      constructor(from, to, tree, offset, openStart = false, openEnd = false) {
        this.from = from;
        this.to = to;
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
    var Parser = class {
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
        let parse = this.startParse(input, fragments, ranges);
        for (; ; ) {
          let done = parse.advance();
          if (done)
            return done;
        }
      }
    };
    var StringInput = class {
      constructor(string) {
        this.string = string;
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
      read(from, to) {
        return this.string.slice(from, to);
      }
    };
    function parseMixed(nest) {
      return (parse, input, fragments, ranges) => new MixedParse(parse, nest, input, fragments, ranges);
    }
    var InnerParse = class {
      constructor(parser, parse, overlay, bracketed, target, from) {
        this.parser = parser;
        this.parse = parse;
        this.overlay = overlay;
        this.bracketed = bracketed;
        this.target = target;
        this.from = from;
      }
    };
    function checkRanges(ranges) {
      if (!ranges.length || ranges.some((r) => r.from >= r.to))
        throw new RangeError("Invalid inner parse ranges given: " + JSON.stringify(ranges));
    }
    var ActiveOverlay = class {
      constructor(parser, predicate, mounts, index, start, bracketed, target, prev) {
        this.parser = parser;
        this.predicate = predicate;
        this.mounts = mounts;
        this.index = index;
        this.start = start;
        this.bracketed = bracketed;
        this.target = target;
        this.prev = prev;
        this.depth = 0;
        this.ranges = [];
      }
    };
    var stoppedInner = new NodeProp({ perNode: true });
    var MixedParse = class {
      constructor(base, nest, input, fragments, ranges) {
        this.nest = nest;
        this.input = input;
        this.fragments = fragments;
        this.ranges = ranges;
        this.inner = [];
        this.innerDone = 0;
        this.baseTree = null;
        this.stoppedAt = null;
        this.baseParse = base;
      }
      advance() {
        if (this.baseParse) {
          let done2 = this.baseParse.advance();
          if (!done2)
            return null;
          this.baseParse = null;
          this.baseTree = done2;
          this.startInner();
          if (this.stoppedAt != null)
            for (let inner2 of this.inner)
              inner2.parse.stopAt(this.stoppedAt);
        }
        if (this.innerDone == this.inner.length) {
          let result = this.baseTree;
          if (this.stoppedAt != null)
            result = new Tree(result.type, result.children, result.positions, result.length, result.propValues.concat([[stoppedInner, this.stoppedAt]]));
          return result;
        }
        let inner = this.inner[this.innerDone], done = inner.parse.advance();
        if (done) {
          this.innerDone++;
          let props = Object.assign(/* @__PURE__ */ Object.create(null), inner.target.props);
          props[NodeProp.mounted.id] = new MountedTree(done, inner.overlay, inner.parser, inner.bracketed);
          inner.target.props = props;
        }
        return null;
      }
      get parsedPos() {
        if (this.baseParse)
          return 0;
        let pos = this.input.length;
        for (let i = this.innerDone; i < this.inner.length; i++) {
          if (this.inner[i].from < pos)
            pos = Math.min(pos, this.inner[i].parse.parsedPos);
        }
        return pos;
      }
      stopAt(pos) {
        this.stoppedAt = pos;
        if (this.baseParse)
          this.baseParse.stopAt(pos);
        else
          for (let i = this.innerDone; i < this.inner.length; i++)
            this.inner[i].parse.stopAt(pos);
      }
      startInner() {
        let fragmentCursor = new FragmentCursor(this.fragments);
        let overlay = null;
        let covered = null;
        let cursor = new TreeCursor(new TreeNode(this.baseTree, this.ranges[0].from, 0, null), exports2.IterMode.IncludeAnonymous | exports2.IterMode.IgnoreMounts);
        scan: for (let nest, isCovered; ; ) {
          let enter = true, range;
          if (this.stoppedAt != null && cursor.from >= this.stoppedAt) {
            enter = false;
          } else if (fragmentCursor.hasNode(cursor)) {
            if (overlay) {
              let match = overlay.mounts.find((m) => m.frag.from <= cursor.from && m.frag.to >= cursor.to && m.mount.overlay);
              if (match)
                for (let r of match.mount.overlay) {
                  let from = r.from + match.pos, to = r.to + match.pos;
                  if (from >= cursor.from && to <= cursor.to && !overlay.ranges.some((r2) => r2.from < to && r2.to > from))
                    overlay.ranges.push({ from, to });
                }
            }
            enter = false;
          } else if (covered && (isCovered = checkCover(covered.ranges, cursor.from, cursor.to))) {
            enter = isCovered != 2;
          } else if (!cursor.type.isAnonymous && (nest = this.nest(cursor, this.input)) && (cursor.from < cursor.to || !nest.overlay)) {
            if (!cursor.tree) {
              materialize(cursor);
              if (overlay)
                overlay.depth++;
              if (covered)
                covered.depth++;
            }
            let oldMounts = fragmentCursor.findMounts(cursor.from, nest.parser);
            if (typeof nest.overlay == "function") {
              overlay = new ActiveOverlay(nest.parser, nest.overlay, oldMounts, this.inner.length, cursor.from, !!nest.bracketed, cursor.tree, overlay);
            } else {
              let ranges = punchRanges(this.ranges, nest.overlay || (cursor.from < cursor.to ? [new Range(cursor.from, cursor.to)] : []));
              if (ranges.length)
                checkRanges(ranges);
              if (ranges.length || !nest.overlay)
                this.inner.push(new InnerParse(nest.parser, ranges.length ? nest.parser.startParse(this.input, enterFragments(oldMounts, ranges), ranges) : nest.parser.startParse(""), nest.overlay ? nest.overlay.map((r) => new Range(r.from - cursor.from, r.to - cursor.from)) : null, !!nest.bracketed, cursor.tree, ranges.length ? ranges[0].from : cursor.from));
              if (!nest.overlay)
                enter = false;
              else if (ranges.length)
                covered = { ranges, depth: 0, prev: covered };
            }
          } else if (overlay && (range = overlay.predicate(cursor))) {
            if (range === true)
              range = new Range(cursor.from, cursor.to);
            if (range.from < range.to) {
              let last = overlay.ranges.length - 1;
              if (last >= 0 && overlay.ranges[last].to == range.from)
                overlay.ranges[last] = { from: overlay.ranges[last].from, to: range.to };
              else
                overlay.ranges.push(range);
            }
          }
          if (enter && cursor.firstChild()) {
            if (overlay)
              overlay.depth++;
            if (covered)
              covered.depth++;
          } else {
            for (; ; ) {
              if (cursor.nextSibling())
                break;
              if (!cursor.parent())
                break scan;
              if (overlay && !--overlay.depth) {
                let ranges = punchRanges(this.ranges, overlay.ranges);
                if (ranges.length) {
                  checkRanges(ranges);
                  this.inner.splice(overlay.index, 0, new InnerParse(overlay.parser, overlay.parser.startParse(this.input, enterFragments(overlay.mounts, ranges), ranges), overlay.ranges.map((r) => new Range(r.from - overlay.start, r.to - overlay.start)), overlay.bracketed, overlay.target, ranges[0].from));
                }
                overlay = overlay.prev;
              }
              if (covered && !--covered.depth)
                covered = covered.prev;
            }
          }
        }
      }
    };
    function checkCover(covered, from, to) {
      for (let range of covered) {
        if (range.from >= to)
          break;
        if (range.to > from)
          return range.from <= from && range.to >= to ? 2 : 1;
      }
      return 0;
    }
    function sliceBuf(buf, startI, endI, nodes, positions, off) {
      if (startI < endI) {
        let from = buf.buffer[startI + 1];
        nodes.push(buf.slice(startI, endI, from));
        positions.push(from - off);
      }
    }
    function materialize(cursor) {
      let { node } = cursor, stack = [];
      let buffer = node.context.buffer;
      do {
        stack.push(cursor.index);
        cursor.parent();
      } while (!cursor.tree);
      let base = cursor.tree, i = base.children.indexOf(buffer);
      let buf = base.children[i], b = buf.buffer, newStack = [i];
      function split(startI, endI, type, innerOffset, length, stackPos) {
        let targetI = stack[stackPos];
        let children = [], positions = [];
        sliceBuf(buf, startI, targetI, children, positions, innerOffset);
        let from = b[targetI + 1], to = b[targetI + 2];
        newStack.push(children.length);
        let child = stackPos ? split(targetI + 4, b[targetI + 3], buf.set.types[b[targetI]], from, to - from, stackPos - 1) : node.toTree();
        children.push(child);
        positions.push(from - innerOffset);
        sliceBuf(buf, b[targetI + 3], endI, children, positions, innerOffset);
        return new Tree(type, children, positions, length);
      }
      base.children[i] = split(0, b.length, NodeType.none, 0, buf.length, stack.length - 1);
      for (let index of newStack) {
        let tree = cursor.tree.children[index], pos = cursor.tree.positions[index];
        cursor.yield(new TreeNode(tree, pos + cursor.from, index, cursor._tree));
      }
    }
    var StructureCursor = class {
      constructor(root, offset) {
        this.offset = offset;
        this.done = false;
        this.cursor = root.cursor(exports2.IterMode.IncludeAnonymous | exports2.IterMode.IgnoreMounts | exports2.IterMode.ExcludeBuffers);
      }
      // Move to the first node (in pre-order) that starts at or after `pos`.
      moveTo(pos) {
        let { cursor } = this, p = pos - this.offset;
        while (!this.done && cursor.from < p) {
          if (cursor.to >= p && cursor.enter(p, 1, exports2.IterMode.IncludeAnonymous | exports2.IterMode.IgnoreOverlays | exports2.IterMode.ExcludeBuffers)) ;
          else if (cursor.to <= p) {
            if (!cursor.next(false))
              this.done = true;
          } else {
            break;
          }
        }
      }
      hasNode(cursor) {
        this.moveTo(cursor.from);
        if (!this.done && this.cursor.from + this.offset == cursor.from && this.cursor.tree) {
          for (let tree = this.cursor.tree; ; ) {
            if (tree == cursor.tree)
              return true;
            if (tree.children.length && tree.positions[0] == 0 && tree.children[0] instanceof Tree)
              tree = tree.children[0];
            else
              break;
          }
        }
        return false;
      }
    };
    var FragmentCursor = class {
      constructor(fragments) {
        var _a;
        this.fragments = fragments;
        this.curTo = 0;
        this.fragI = 0;
        if (fragments.length) {
          let first = this.curFrag = fragments[0];
          this.curTo = (_a = first.tree.prop(stoppedInner)) !== null && _a !== void 0 ? _a : first.to;
          this.inner = new StructureCursor(first.tree, -first.offset);
        } else {
          this.curFrag = this.inner = null;
        }
      }
      hasNode(node) {
        while (this.curFrag && node.from >= this.curTo)
          this.nextFrag();
        return this.curFrag && this.curFrag.from <= node.from && this.curTo >= node.to && this.inner.hasNode(node);
      }
      nextFrag() {
        var _a;
        this.fragI++;
        if (this.fragI == this.fragments.length) {
          this.curFrag = this.inner = null;
        } else {
          let frag = this.curFrag = this.fragments[this.fragI];
          this.curTo = (_a = frag.tree.prop(stoppedInner)) !== null && _a !== void 0 ? _a : frag.to;
          this.inner = new StructureCursor(frag.tree, -frag.offset);
        }
      }
      findMounts(pos, parser) {
        var _a;
        let result = [];
        if (this.inner) {
          this.inner.cursor.moveTo(pos, 1);
          for (let pos2 = this.inner.cursor.node; pos2; pos2 = pos2.parent) {
            let mount = (_a = pos2.tree) === null || _a === void 0 ? void 0 : _a.prop(NodeProp.mounted);
            if (mount && mount.parser == parser) {
              for (let i = this.fragI; i < this.fragments.length; i++) {
                let frag = this.fragments[i];
                if (frag.from >= pos2.to)
                  break;
                if (frag.tree == this.curFrag.tree)
                  result.push({
                    frag,
                    pos: pos2.from - frag.offset,
                    mount
                  });
              }
            }
          }
        }
        return result;
      }
    };
    function punchRanges(outer, ranges) {
      let copy = null, current = ranges;
      for (let i = 1, j = 0; i < outer.length; i++) {
        let gapFrom = outer[i - 1].to, gapTo = outer[i].from;
        for (; j < current.length; j++) {
          let r = current[j];
          if (r.from >= gapTo)
            break;
          if (r.to <= gapFrom)
            continue;
          if (!copy)
            current = copy = ranges.slice();
          if (r.from < gapFrom) {
            copy[j] = new Range(r.from, gapFrom);
            if (r.to > gapTo)
              copy.splice(j + 1, 0, new Range(gapTo, r.to));
          } else if (r.to > gapTo) {
            copy[j--] = new Range(gapTo, r.to);
          } else {
            copy.splice(j--, 1);
          }
        }
      }
      return current;
    }
    function findCoverChanges(a, b, from, to) {
      let iA = 0, iB = 0, inA = false, inB = false, pos = -1e9;
      let result = [];
      for (; ; ) {
        let nextA = iA == a.length ? 1e9 : inA ? a[iA].to : a[iA].from;
        let nextB = iB == b.length ? 1e9 : inB ? b[iB].to : b[iB].from;
        if (inA != inB) {
          let start = Math.max(pos, from), end = Math.min(nextA, nextB, to);
          if (start < end)
            result.push(new Range(start, end));
        }
        pos = Math.min(nextA, nextB);
        if (pos == 1e9)
          break;
        if (nextA == pos) {
          if (!inA)
            inA = true;
          else {
            inA = false;
            iA++;
          }
        }
        if (nextB == pos) {
          if (!inB)
            inB = true;
          else {
            inB = false;
            iB++;
          }
        }
      }
      return result;
    }
    function enterFragments(mounts, ranges) {
      let result = [];
      for (let { pos, mount, frag } of mounts) {
        let startPos = pos + (mount.overlay ? mount.overlay[0].from : 0), endPos = startPos + mount.tree.length;
        let from = Math.max(frag.from, startPos), to = Math.min(frag.to, endPos);
        if (mount.overlay) {
          let overlay = mount.overlay.map((r) => new Range(r.from + pos, r.to + pos));
          let changes = findCoverChanges(ranges, overlay, from, to);
          for (let i = 0, pos2 = from; ; i++) {
            let last = i == changes.length, end = last ? to : changes[i].from;
            if (end > pos2)
              result.push(new TreeFragment(pos2, end, mount.tree, -startPos, frag.from >= pos2 || frag.openStart, frag.to <= end || frag.openEnd));
            if (last)
              break;
            pos2 = changes[i].to;
          }
        } else {
          result.push(new TreeFragment(from, to, mount.tree, -startPos, frag.from >= startPos || frag.openStart, frag.to <= endPos || frag.openEnd));
        }
      }
      return result;
    }
    exports2.DefaultBufferLength = DefaultBufferLength;
    exports2.MountedTree = MountedTree;
    exports2.NodeProp = NodeProp;
    exports2.NodeSet = NodeSet;
    exports2.NodeType = NodeType;
    exports2.NodeWeakMap = NodeWeakMap;
    exports2.Parser = Parser;
    exports2.Tree = Tree;
    exports2.TreeBuffer = TreeBuffer;
    exports2.TreeCursor = TreeCursor;
    exports2.TreeFragment = TreeFragment;
    exports2.parseMixed = parseMixed;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/highlight/dist/index.cjs
var require_dist2 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/highlight/dist/index.cjs"(exports2) {
    "use strict";
    var common = require_dist();
    var nextTagID = 0;
    var Tag = class _Tag {
      /**
      @internal
      */
      constructor(name2, set, base, modified) {
        this.name = name2;
        this.set = set;
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
          for (let t2 of parent.set)
            tag.set.push(t2);
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
        let exists = mods[0].instances.find((t2) => t2.base == base && sameArray(mods, t2.modified));
        if (exists)
          return exists;
        let set = [], tag = new Tag(base.name, set, base, mods);
        for (let m of mods)
          m.instances.push(tag);
        let configs = powerSet(mods);
        for (let parent of base.set)
          if (!parent.modified.length)
            for (let config of configs)
              set.push(_Modifier.get(parent, config));
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
              let m = /^"(?:[^"\\]|\\.)*?"|[^\/!]+/.exec(rest);
              if (!m)
                throw new RangeError("Invalid path: " + part);
              pieces.push(m[0] == "*" ? "" : m[0][0] == '"' ? JSON.parse(m[0]) : m[0]);
              pos += m[0].length;
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
    var ruleNodeProp = new common.NodeProp({
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
      let map = /* @__PURE__ */ Object.create(null);
      for (let style of tags2) {
        if (!Array.isArray(style.tag))
          map[style.tag.id] = style.class;
        else
          for (let tag of style.tag)
            map[tag.id] = style.class;
      }
      let { scope, all = null } = options || {};
      return {
        style: (tags3) => {
          let cls = all;
          for (let tag of tags3) {
            for (let sub of tag.set) {
              let tagClass = map[sub.id];
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
    function highlightTags(highlighters, tags2) {
      let result = null;
      for (let highlighter of highlighters) {
        let value = highlighter.style(tags2);
        if (value)
          result = result ? result + " " + value : value;
      }
      return result;
    }
    function highlightTree(tree, highlighter, putStyle, from = 0, to = tree.length) {
      let builder = new HighlightBuilder(from, Array.isArray(highlighter) ? highlighter : [highlighter], putStyle);
      builder.highlightRange(tree.cursor(), from, to, "", builder.highlighters);
      builder.flush(to);
    }
    function highlightCode(code, tree, highlighter, putText, putBreak, from = 0, to = code.length) {
      let pos = from;
      function writeTo(p, classes) {
        if (p <= pos)
          return;
        for (let text = code.slice(pos, p), i = 0; ; ) {
          let nextBreak = text.indexOf("\n", i);
          let upto = nextBreak < 0 ? text.length : nextBreak;
          if (upto > i)
            putText(text.slice(i, upto), classes);
          if (nextBreak < 0)
            break;
          putBreak();
          i = nextBreak + 1;
        }
        pos = p;
      }
      highlightTree(tree, highlighter, (from2, to2, classes) => {
        writeTo(from2, "");
        writeTo(to2, classes);
      }, from, to);
      writeTo(to, "");
    }
    var HighlightBuilder = class {
      constructor(at, highlighters, span) {
        this.at = at;
        this.highlighters = highlighters;
        this.span = span;
        this.class = "";
      }
      startSpan(at, cls) {
        if (cls != this.class) {
          this.flush(at);
          if (at > this.at)
            this.at = at;
          this.class = cls;
        }
      }
      flush(to) {
        if (to > this.at && this.class)
          this.span(this.at, to, this.class);
      }
      highlightRange(cursor, from, to, inheritedClass, highlighters) {
        let { type, from: start, to: end } = cursor;
        if (start >= to || end <= from)
          return;
        if (type.isTop)
          highlighters = this.highlighters.filter((h) => !h.scope || h.scope(type));
        let cls = inheritedClass;
        let rule = getStyleTags(cursor) || Rule.empty;
        let tagCls = highlightTags(highlighters, rule.tags);
        if (tagCls) {
          if (cls)
            cls += " ";
          cls += tagCls;
          if (rule.mode == 1)
            inheritedClass += (inheritedClass ? " " : "") + tagCls;
        }
        this.startSpan(Math.max(from, start), cls);
        if (rule.opaque)
          return;
        let mounted = cursor.tree && cursor.tree.prop(common.NodeProp.mounted);
        if (mounted && mounted.overlay) {
          let inner = cursor.node.enter(mounted.overlay[0].from + start, 1);
          let innerHighlighters = this.highlighters.filter((h) => !h.scope || h.scope(mounted.tree.type));
          let hasChild = cursor.firstChild();
          for (let i = 0, pos = start; ; i++) {
            let next = i < mounted.overlay.length ? mounted.overlay[i] : null;
            let nextPos = next ? next.from + start : end;
            let rangeFrom = Math.max(from, pos), rangeTo = Math.min(to, nextPos);
            if (rangeFrom < rangeTo && hasChild) {
              while (cursor.from < rangeTo) {
                this.highlightRange(cursor, rangeFrom, rangeTo, inheritedClass, highlighters);
                this.startSpan(Math.min(rangeTo, cursor.to), cls);
                if (cursor.to >= nextPos || !cursor.nextSibling())
                  break;
              }
            }
            if (!next || nextPos > to)
              break;
            pos = next.to + start;
            if (pos > from) {
              this.highlightRange(inner.cursor(), Math.max(from, next.from + start), Math.min(to, pos), "", innerHighlighters);
              this.startSpan(Math.min(to, pos), cls);
            }
          }
          if (hasChild)
            cursor.parent();
        } else if (cursor.firstChild()) {
          if (mounted)
            inheritedClass = "";
          do {
            if (cursor.to <= from)
              continue;
            if (cursor.from >= to)
              break;
            this.highlightRange(cursor, from, to, inheritedClass, highlighters);
            this.startSpan(Math.min(to, cursor.to), cls);
          } while (cursor.nextSibling());
          cursor.parent();
        }
      }
    };
    function getStyleTags(node) {
      let rule = node.type.prop(ruleNodeProp);
      while (rule && rule.context && !node.matchContext(rule.context))
        rule = rule.next;
      return rule || null;
    }
    var t = Tag.define;
    var comment = t();
    var name = t();
    var typeName = t(name);
    var propertyName = t(name);
    var literal = t();
    var string = t(literal);
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
      string,
      /**
      A documentation [string](#highlight.tags.string).
      */
      docString: t(string),
      /**
      A character literal (subtag of [string](#highlight.tags.string)).
      */
      character: t(string),
      /**
      An attribute value (subtag of [string](#highlight.tags.string)).
      */
      attributeValue: t(string),
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
    exports2.Tag = Tag;
    exports2.classHighlighter = classHighlighter;
    exports2.getStyleTags = getStyleTags;
    exports2.highlightCode = highlightCode;
    exports2.highlightTree = highlightTree;
    exports2.styleTags = styleTags;
    exports2.tagHighlighter = tagHighlighter;
    exports2.tags = tags;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/markdown/dist/index.cjs
var require_dist3 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/markdown/dist/index.cjs"(exports2) {
    "use strict";
    var common = require_dist();
    var highlight = require_dist2();
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
        this.hashProp = [[common.NodeProp.contextHash, hash]];
      }
      addChild(child, pos) {
        if (child.prop(common.NodeProp.contextHash) != this.hash)
          child = new common.Tree(child.type, child.children, child.positions, child.length, this.hashProp);
        this.children.push(child);
        this.positions.push(pos);
      }
      toTree(nodeSet, end = this.end) {
        let last = this.children.length - 1;
        if (last >= 0)
          end = Math.max(end, this.positions[last] + this.children[last].length + this.from);
        return new common.Tree(nodeSet.types[this.type], this.children, this.positions, end - this.from).balance({
          makeTree: (children, positions, length) => new common.Tree(common.NodeType.none, children, positions, length, this.hashProp)
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
      constructor(start, content) {
        this.start = start;
        this.content = content;
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
      moveBase(to) {
        this.basePos = to;
        this.baseIndent = this.countIndent(to, this.pos, this.indent);
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
      countIndent(to, from = 0, indent = 0) {
        for (let i = from; i < to; i++)
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
    function skipSpaceBack(line, i, to) {
      while (i > to && space(line.charCodeAt(i - 1)))
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
      let count2 = 1;
      for (let pos = line.pos + 1; pos < line.text.length; pos++) {
        let ch = line.text.charCodeAt(pos);
        if (ch == line.next)
          count2++;
        else if (!space(ch))
          return -1;
      }
      if (breaking && line.next == 45 && isSetextUnderline(line) > -1 && line.depth == cx.stack.length && cx.parser.leafBlockParsers.indexOf(DefaultLeafBlocks.SetextHeading) > -1)
        return -1;
      return count2 < 3 ? -1 : 1;
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
    function addCodeText(marks, from, to) {
      let last = marks.length - 1;
      if (last >= 0 && marks[last].to == from && marks[last].type == Type.CodeText)
        marks[last].to = to;
      else
        marks.push(elt(Type.CodeText, from, to));
    }
    var DefaultBlockParsers = {
      LinkReference: void 0,
      IndentedCode(cx, line) {
        let base = line.baseIndent + 4;
        if (line.indent < base)
          return false;
        let start = line.findColumn(base);
        let from = cx.lineStart + start, to = cx.lineStart + line.text.length;
        let marks = [], pendingMarks = [];
        addCodeText(marks, from, to);
        while (cx.nextLine() && line.depth >= cx.stack.length) {
          if (line.pos == line.text.length) {
            addCodeText(pendingMarks, cx.lineStart - 1, cx.lineStart);
            for (let m of line.markers)
              pendingMarks.push(m);
          } else if (line.indent < base) {
            break;
          } else {
            if (pendingMarks.length) {
              for (let m of pendingMarks) {
                if (m.type == Type.CodeText)
                  addCodeText(marks, m.from, m.to);
                else
                  marks.push(m);
              }
              pendingMarks = [];
            }
            addCodeText(marks, cx.lineStart - 1, cx.lineStart);
            for (let m of line.markers)
              marks.push(m);
            to = cx.lineStart + line.text.length;
            let codeStart = cx.lineStart + line.findColumn(line.baseIndent + 4);
            if (codeStart < to)
              addCodeText(marks, codeStart, to);
          }
        }
        if (pendingMarks.length) {
          pendingMarks = pendingMarks.filter((m) => m.type != Type.CodeText);
          if (pendingMarks.length)
            line.markers = pendingMarks.concat(line.markers);
        }
        cx.addNode(cx.buffer.writeElements(marks, -from).finish(Type.CodeBlock, to - from), from);
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
            for (let m of line.markers)
              marks.push(m);
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
            for (let m of line.markers)
              marks.push(m);
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
          for (let m of line.markers)
            marks.push(m);
        }
        if (trailing)
          cx.nextLine();
        let nodeType = end == CommentEnd ? Type.CommentBlock : end == ProcessingEnd ? Type.ProcessingInstructionBlock : Type.HTMLBlock;
        let to = cx.prevLineEnd();
        cx.addNode(cx.buffer.writeElements(marks, -from).finish(nodeType, to - from), from);
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
        let content = leaf.content + "\n" + line.scrub();
        let finish = this.advance(content);
        if (finish > -1 && finish < content.length)
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
      advance(content) {
        for (; ; ) {
          if (this.stage == -1) {
            return -1;
          } else if (this.stage == 0) {
            if (!this.nextStage(parseLinkLabel(content, this.pos, this.start, true)))
              return -1;
            if (content.charCodeAt(this.pos) != 58)
              return this.stage = -1;
            this.elts.push(elt(Type.LinkMark, this.pos + this.start, this.pos + this.start + 1));
            this.pos++;
          } else if (this.stage == 1) {
            if (!this.nextStage(parseURL(content, skipSpace(content, this.pos), this.start)))
              return -1;
          } else if (this.stage == 2) {
            let skip = skipSpace(content, this.pos), end = 0;
            if (skip > this.pos) {
              let title = parseLinkTitle(content, skip, this.start);
              if (title) {
                let titleEnd = lineEnd(content, title.to - this.start);
                if (titleEnd > 0) {
                  this.nextStage(title);
                  end = titleEnd;
                }
              }
            }
            if (!end)
              end = lineEnd(content, this.pos);
            return end > 0 && end < content.length ? end : -1;
          } else {
            return lineEnd(content, this.pos);
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
      (p, line) => isBulletList(line, p, true) >= 0,
      (p, line) => isOrderedList(line, p, true) >= 0,
      (p, line) => isHorizontalRule(line, p, true) >= 0,
      (p, line) => isHTMLBlock(line, p, true) >= 0
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
        for (let parse of this.parser.leafBlockParsers)
          if (parse) {
            let parser2 = parse(this, leaf);
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
          for (let m of line.markers)
            leaf.marks.push(m);
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
      addNode(block, from, to) {
        if (typeof block == "number")
          block = new common.Tree(this.parser.nodeSet.types[block], none, none, (to !== null && to !== void 0 ? to : this.prevLineEnd()) - from);
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
      elt(type, from, to, children) {
        if (typeof type == "string")
          return elt(this.parser.getNodeType(type), from, to, children);
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
      return new common.Tree(tree.type, children, positions, tree.to + offset - start, tree.tree ? tree.tree.propValues : void 0);
    }
    var MarkdownParser = class _MarkdownParser extends common.Parser {
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
        for (let t of nodeSet.types)
          this.nodeTypes[t.name] = t.id;
      }
      createParse(input, fragments, ranges) {
        let parse = new BlockContext(this, input, fragments, ranges);
        for (let w of this.wrappers)
          parse = w(parse, input, fragments, ranges);
        return parse;
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
            let { name, block, composite, style } = typeof s == "string" ? { name: s } : s;
            if (nodeTypes2.some((t) => t.name == name))
              continue;
            if (composite)
              skipContextMarkup[nodeTypes2.length] = (bl, cx, line) => composite(cx, line, bl.value);
            let id = nodeTypes2.length;
            let group = composite ? ["Block", "BlockContext"] : !block ? void 0 : id >= Type.ATXHeading1 && id <= Type.SetextHeading2 ? ["Block", "LeafBlock", "Heading"] : ["Block", "LeafBlock"];
            nodeTypes2.push(common.NodeType.define({
              id,
              name,
              props: group && [[common.NodeProp.group, group]]
            }));
            if (style) {
              if (!styles)
                styles = {};
              if (Array.isArray(style) || style instanceof highlight.Tag)
                styles[name] = style;
              else
                Object.assign(styles, style);
            }
          }
          nodeSet = new common.NodeSet(nodeTypes2);
          if (styles)
            nodeSet = nodeSet.extend(highlight.styleTags(styles));
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
      getNodeType(name) {
        let found = this.nodeTypes[name];
        if (found == null)
          throw new RangeError(`Unknown node type '${name}'`);
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
    function findName(names, name) {
      let found = names.indexOf(name);
      if (found < 0)
        throw new RangeError(`Position specified relative to unknown parser ${name}`);
      return found;
    }
    var nodeTypes = [common.NodeType.none];
    for (let i = 1, name; name = Type[i]; i++) {
      nodeTypes[i] = common.NodeType.define({
        id: i,
        name,
        props: i >= Type.Escape ? [] : [[common.NodeProp.group, i in DefaultSkipMarkup ? ["Block", "BlockContext"] : ["Block", "LeafBlock"]]],
        top: name == "Document"
      });
    }
    var none = [];
    var Buffer2 = class {
      constructor(nodeSet) {
        this.nodeSet = nodeSet;
        this.content = [];
        this.nodes = [];
      }
      write(type, from, to, children = 0) {
        this.content.push(type, from, to, 4 + children * 4);
        return this;
      }
      writeElements(elts, offset = 0) {
        for (let e of elts)
          e.writeTo(this, offset);
        return this;
      }
      finish(type, length) {
        return common.Tree.build({
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
      constructor(type, from, to, children = none) {
        this.type = type;
        this.from = from;
        this.to = to;
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
    function elt(type, from, to, children) {
      return new Element(type, from, to, children);
    }
    var EmphasisUnderscore = { resolve: "Emphasis", mark: "EmphasisMark" };
    var EmphasisAsterisk = { resolve: "Emphasis", mark: "EmphasisMark" };
    var LinkStart = {};
    var ImageStart = {};
    var InlineDelimiter = class {
      constructor(type, from, to, side) {
        this.type = type;
        this.from = from;
        this.to = to;
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
        let escaped = cx.char(start + 1);
        for (let i = 0; i < Escapable.length; i++)
          if (Escapable.charCodeAt(i) == escaped)
            return cx.append(elt(Type.Escape, start, start + 2));
        return -1;
      },
      Entity(cx, next, start) {
        if (next != 38)
          return -1;
        let m = /^(?:#\d+|#x[a-f\d]+|\w+);/i.exec(cx.slice(start + 1, start + 31));
        return m ? cx.append(elt(Type.Entity, start, start + 1 + m[0].length)) : -1;
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
        let comment = /^!--[^>](?:-[^-]|[^-])*?-->/i.exec(after);
        if (comment)
          return cx.append(elt(Type.Comment, start, start + 1 + comment[0].length));
        let procInst = /^\?[^]*?\?>/.exec(after);
        if (procInst)
          return cx.append(elt(Type.ProcessingInstruction, start, start + 1 + procInst[0].length));
        let m = /^(?:![A-Z][^]*?>|!\[CDATA\[[^]*?\]\]>|\/\s*[a-zA-Z][\w-]*\s*>|\s*[a-zA-Z][\w-]*(\s+[a-zA-Z:_][\w-.:]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*(\/\s*)?>)/.exec(after);
        if (!m)
          return -1;
        return cx.append(elt(Type.HTMLTag, start, start + 1 + m[0].length));
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
            let content = cx.takeContent(i);
            let link = cx.parts[i] = finishLink(cx, content, part.type == LinkStart ? Type.Link : Type.Image, part.from, start + 1);
            if (part.type == LinkStart)
              for (let j = 0; j < i; j++) {
                let p = cx.parts[j];
                if (p instanceof InlineDelimiter && p.type == LinkStart)
                  p.side = 0;
              }
            return link.to;
          }
        }
        return -1;
      }
    };
    function finishLink(cx, content, type, start, startPos) {
      let { text } = cx, next = cx.char(startPos), endPos = startPos;
      content.unshift(elt(Type.LinkMark, start, start + (type == Type.Image ? 2 : 1)));
      content.push(elt(Type.LinkMark, startPos - 1, startPos));
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
          content.push(elt(Type.LinkMark, startPos, startPos + 1));
          endPos = pos + 1;
          if (dest)
            content.push(dest);
          if (title)
            content.push(title);
          content.push(elt(Type.LinkMark, pos, endPos));
        }
      } else if (next == 91) {
        let label = parseLinkLabel(text, startPos - cx.offset, cx.offset, false);
        if (label) {
          content.push(label);
          endPos = label.to;
        }
      }
      return elt(type, start, endPos, content);
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
        for (let escaped = false; pos < text.length; pos++) {
          let ch = text.charCodeAt(pos);
          if (space(ch)) {
            break;
          } else if (escaped) {
            escaped = false;
          } else if (ch == 40) {
            depth++;
          } else if (ch == 41) {
            if (!depth)
              break;
            depth--;
          } else if (ch == 92) {
            escaped = true;
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
      for (let pos = start + 1, escaped = false; pos < text.length; pos++) {
        let ch = text.charCodeAt(pos);
        if (escaped)
          escaped = false;
        else if (ch == end)
          return elt(Type.LinkTitle, start + offset, pos + 1 + offset);
        else if (ch == 92)
          escaped = true;
      }
      return null;
    }
    function parseLinkLabel(text, start, offset, requireNonWS) {
      for (let escaped = false, pos = start + 1, end = Math.min(text.length, pos + 999); pos < end; pos++) {
        let ch = text.charCodeAt(pos);
        if (escaped)
          escaped = false;
        else if (ch == 93)
          return requireNonWS ? false : elt(Type.LinkLabel, start + offset, pos + 1 + offset);
        else {
          if (requireNonWS && !space(ch))
            requireNonWS = false;
          if (ch == 91)
            return false;
          else if (ch == 92)
            escaped = true;
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
      slice(from, to) {
        return this.text.slice(from - this.offset, to - this.offset);
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
      addDelimiter(type, from, to, open, close) {
        return this.append(new InlineDelimiter(type, from, to, (open ? 1 : 0) | (close ? 2 : 0)));
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
          let type = close.type.resolve, content = [];
          let start = open.from, end = close.to;
          if (emp) {
            let size = Math.min(2, open.to - open.from, closeSize);
            start = open.to - size;
            end = close.from + size;
            type = size == 1 ? "Emphasis" : "StrongEmphasis";
          }
          if (open.type.mark)
            content.push(this.elt(open.type.mark, start, open.to));
          for (let k = j + 1; k < i; k++) {
            if (this.parts[k] instanceof Element)
              content.push(this.parts[k]);
            this.parts[k] = null;
          }
          if (close.type.mark)
            content.push(this.elt(close.type.mark, close.from, end));
          let element = this.elt(type, start, end, content);
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
        let content = this.resolveMarkers(startIndex);
        this.parts.length = startIndex;
        return content;
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
      elt(type, from, to, children) {
        if (typeof type == "string")
          return elt(this.parser.getNodeType(type), from, to, children);
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
        return tree && tree.prop(common.NodeProp.contextHash) == hash;
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
            let dummy = new common.Tree(cx.parser.nodeSet.types[Type.Paragraph], [], [], 0, cx.block.hashProp);
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
    var markdownHighlighting = highlight.styleTags({
      "Blockquote/...": highlight.tags.quote,
      HorizontalRule: highlight.tags.contentSeparator,
      "ATXHeading1/... SetextHeading1/...": highlight.tags.heading1,
      "ATXHeading2/... SetextHeading2/...": highlight.tags.heading2,
      "ATXHeading3/...": highlight.tags.heading3,
      "ATXHeading4/...": highlight.tags.heading4,
      "ATXHeading5/...": highlight.tags.heading5,
      "ATXHeading6/...": highlight.tags.heading6,
      "Comment CommentBlock": highlight.tags.comment,
      Escape: highlight.tags.escape,
      Entity: highlight.tags.character,
      "Emphasis/...": highlight.tags.emphasis,
      "StrongEmphasis/...": highlight.tags.strong,
      "Link/... Image/...": highlight.tags.link,
      "OrderedList/... BulletList/...": highlight.tags.list,
      "BlockQuote/...": highlight.tags.quote,
      "InlineCode CodeText": highlight.tags.monospace,
      "URL Autolink": highlight.tags.url,
      "HeaderMark HardBreak QuoteMark ListMark LinkMark EmphasisMark CodeMark": highlight.tags.processingInstruction,
      "CodeInfo LinkLabel": highlight.tags.labelName,
      LinkTitle: highlight.tags.string,
      Paragraph: highlight.tags.content
    });
    var parser = new MarkdownParser(new common.NodeSet(nodeTypes).extend(markdownHighlighting), Object.keys(DefaultBlockParsers).map((n) => DefaultBlockParsers[n]), Object.keys(DefaultBlockParsers).map((n) => DefaultLeafBlocks[n]), Object.keys(DefaultBlockParsers), DefaultEndLeaf, DefaultSkipMarkup, Object.keys(DefaultInline).map((n) => DefaultInline[n]), Object.keys(DefaultInline), []);
    function leftOverSpace(node, from, to) {
      let ranges = [];
      for (let n = node.firstChild, pos = from; ; n = n.nextSibling) {
        let nextPos = n ? n.from : to;
        if (nextPos > pos)
          ranges.push({ from: pos, to: nextPos });
        if (!n)
          break;
        pos = n.to;
      }
      return ranges;
    }
    function parseCode(config) {
      let { codeParser, htmlParser } = config;
      let wrap = common.parseMixed((node, input) => {
        let id = node.type.id;
        if (codeParser && (id == Type.CodeBlock || id == Type.FencedCode)) {
          let info = "";
          if (id == Type.FencedCode) {
            let infoNode = node.node.getChild(Type.CodeInfo);
            if (infoNode)
              info = input.read(infoNode.from, infoNode.to);
          }
          let parser2 = codeParser(info);
          if (parser2)
            return { parser: parser2, overlay: (node2) => node2.type.id == Type.CodeText, bracketed: id == Type.FencedCode };
        } else if (htmlParser && (id == Type.HTMLBlock || id == Type.HTMLTag || id == Type.CommentBlock)) {
          return { parser: htmlParser, overlay: leftOverSpace(node.node, node.from, node.to) };
        }
        return null;
      });
      return { wrap };
    }
    var StrikethroughDelim = { resolve: "Strikethrough", mark: "StrikethroughMark" };
    var Strikethrough = {
      defineNodes: [{
        name: "Strikethrough",
        style: { "Strikethrough/...": highlight.tags.strikethrough }
      }, {
        name: "StrikethroughMark",
        style: highlight.tags.processingInstruction
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
      let count2 = 0, first = true, cellStart = -1, cellEnd = -1, esc = false;
      let parseCell = () => {
        elts.push(cx.elt("TableCell", offset + cellStart, offset + cellEnd, cx.parser.parseInline(line.slice(cellStart, cellEnd), offset + cellStart)));
      };
      for (let i = startI; i < line.length; i++) {
        let next = line.charCodeAt(i);
        if (next == 124 && !esc) {
          if (!first || cellStart > -1)
            count2++;
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
        count2++;
        if (elts)
          parseCell();
      }
      return count2;
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
          let content = [];
          parseRow(cx, line.text, line.pos, content, cx.lineStart);
          this.rows.push(cx.elt("TableRow", cx.lineStart + line.pos, cx.lineStart + line.text.length, content));
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
        { name: "TableHeader", style: { "TableHeader/...": highlight.tags.heading } },
        "TableRow",
        { name: "TableCell", style: highlight.tags.content },
        { name: "TableDelimiter", style: highlight.tags.processingInstruction }
      ],
      parseBlock: [{
        name: "Table",
        leaf(_, leaf) {
          return hasPipe(leaf.content, 0) ? new TableParser() : null;
        },
        endLeaf(cx, line, leaf) {
          if (leaf.parsers.some((p) => p instanceof TableParser) || !hasPipe(line.text, line.basePos))
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
        { name: "Task", block: true, style: highlight.tags.list },
        { name: "TaskMarker", style: highlight.tags.atom }
      ],
      parseBlock: [{
        name: "TaskList",
        leaf(cx, leaf) {
          return /^\[[ xX]\][ \t]/.test(leaf.content) && cx.parentType().name == "ListItem" ? new TaskParser() : null;
        },
        after: "SetextHeading"
      }]
    };
    var autolinkRE = /(www\.)|(https?:\/\/)|([\w.+-]{1,100}@)|(mailto:|xmpp:)/gy;
    var urlRE = /[\w-]+(\.[\w-]+)+(\/[^\s<]*)?/gy;
    var lastTwoDomainWords = /[\w-]+\.[\w-]+($|\/)/;
    var emailRE = /[\w.+-]+@[\w-]+(\.[\w.-]+)+/gy;
    var xmppResourceRE = /\/[a-zA-Z\d@.]+/gy;
    function count(str, from, to, ch) {
      let result = 0;
      for (let i = from; i < to; i++)
        if (str[i] == ch)
          result++;
      return result;
    }
    function autolinkURLEnd(text, from) {
      urlRE.lastIndex = from;
      let m = urlRE.exec(text);
      if (!m || lastTwoDomainWords.exec(m[0])[0].indexOf("_") > -1)
        return -1;
      let end = from + m[0].length;
      for (; ; ) {
        let last = text[end - 1], m2;
        if (/[?!.,:*_~]/.test(last) || last == ")" && count(text, from, end, ")") > count(text, from, end, "("))
          end--;
        else if (last == ";" && (m2 = /&(?:#\d+|#x[a-f\d]+|\w+);$/.exec(text.slice(from, end))))
          end = from + m2.index;
        else
          break;
      }
      return end;
    }
    function autolinkEmailEnd(text, from) {
      emailRE.lastIndex = from;
      let m = emailRE.exec(text);
      if (!m)
        return -1;
      let last = m[0][m[0].length - 1];
      return last == "_" || last == "-" ? -1 : from + m[0].length - (last == "." ? 1 : 0);
    }
    var Autolink = {
      parseInline: [{
        name: "Autolink",
        parse(cx, next, absPos) {
          let pos = absPos - cx.offset;
          if (pos && /\w/.test(cx.text[pos - 1]))
            return -1;
          autolinkRE.lastIndex = pos;
          let m = autolinkRE.exec(cx.text), end = -1;
          if (!m)
            return -1;
          if (m[1] || m[2]) {
            end = autolinkURLEnd(cx.text, pos + m[0].length);
            if (end > -1 && cx.hasOpenLink) {
              let noBracket = /([^\[\]]|\[[^\]]*\])*/.exec(cx.text.slice(pos, end));
              end = pos + noBracket[0].length;
            }
          } else if (m[3]) {
            end = autolinkEmailEnd(cx.text, pos);
          } else {
            end = autolinkEmailEnd(cx.text, pos + m[0].length);
            if (end > -1 && m[0] == "xmpp:") {
              xmppResourceRE.lastIndex = end;
              m = xmppResourceRE.exec(cx.text);
              if (m)
                end = m.index + m[0].length;
            }
          }
          if (end < 0)
            return -1;
          cx.addElement(cx.elt("URL", absPos, end + cx.offset));
          return end + cx.offset;
        }
      }]
    };
    var GFM = [Table, TaskList, Strikethrough, Autolink];
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
        { name: "Superscript", style: highlight.tags.special(highlight.tags.content) },
        { name: "SuperscriptMark", style: highlight.tags.processingInstruction }
      ],
      parseInline: [{
        name: "Superscript",
        parse: parseSubSuper(94, "Superscript", "SuperscriptMark")
      }]
    };
    var Subscript = {
      defineNodes: [
        { name: "Subscript", style: highlight.tags.special(highlight.tags.content) },
        { name: "SubscriptMark", style: highlight.tags.processingInstruction }
      ],
      parseInline: [{
        name: "Subscript",
        parse: parseSubSuper(126, "Subscript", "SubscriptMark")
      }]
    };
    var Emoji = {
      defineNodes: [{ name: "Emoji", style: highlight.tags.character }],
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
    exports2.Autolink = Autolink;
    exports2.BlockContext = BlockContext;
    exports2.Element = Element;
    exports2.Emoji = Emoji;
    exports2.GFM = GFM;
    exports2.InlineContext = InlineContext;
    exports2.LeafBlock = LeafBlock;
    exports2.Line = Line;
    exports2.MarkdownParser = MarkdownParser;
    exports2.Strikethrough = Strikethrough;
    exports2.Subscript = Subscript;
    exports2.Superscript = Superscript;
    exports2.Table = Table;
    exports2.TaskList = TaskList;
    exports2.parseCode = parseCode;
    exports2.parser = parser;
  }
});

// plugin/component-model.js
var require_component_model = __commonJS({
  "plugin/component-model.js"(exports2, module2) {
    var { parser } = require_dist3();
    var { TreeFragment } = require_dist();
    var identity = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(local|library)$/i;
    function input(doc) {
      return typeof doc === "string" ? doc : { length: doc.length, lineChunks: true, chunk: (from) => {
        const line = doc.lineAt(from);
        return from === line.to && from < doc.length ? "\n" : line.text.slice(from - line.from);
      }, read: (from, to) => doc.sliceString(from, to) };
    }
    function read(doc, from, to) {
      return typeof doc === "string" ? doc.slice(from, to) : doc.sliceString(from, to);
    }
    function parseComponents(doc, previous = null, changes = []) {
      const fragments = previous ? TreeFragment.applyChanges(TreeFragment.addTree(previous.tree), changes) : [];
      const tree = parser.parse(input(doc), fragments), items = [], reusable = /* @__PURE__ */ new Map();
      for (const item of previous?.items || []) {
        if (changes.some((c) => c.fromA <= item.to && c.toA >= item.from)) continue;
        let delta = 0;
        for (const c of changes) if (c.toA < item.from) delta = c.toB - c.toA;
        const moved = delta ? { ...item, from: item.from + delta, to: item.to + delta } : item;
        reusable.set(moved.from, moved);
      }
      let unchanged = !!previous;
      tree.iterate({ enter(node) {
        if (node.name !== "Blockquote") return;
        const cached = reusable.get(node.from);
        if (cached && cached.to === node.to) {
          items.push(cached);
          return false;
        }
        const raw = read(doc, node.from, node.to), end = raw.indexOf("\n"), header = (end < 0 ? raw : raw.slice(0, end)).replace(/\r$/, "");
        const match = /^(>\s*)\[!([\w-]+)(?:\|([^\]]+))?\]([+-]?)(?:[ \t]+(.*))?$/.exec(header);
        if (!match) return;
        unchanged = false;
        items.push({ key: {}, from: node.from, to: node.to, raw, header, type: match[2].toLowerCase(), metadata: match[3] || "", id: (match[3] || "").split(/\s+/).find((token) => identity.test(token)) || null, fold: match[4], title: match[5] || "", eol: raw.includes("\r\n") ? "\r\n" : "\n", body: end < 0 ? "" : raw.slice(end + 1).split("\n").map((line) => line.replace(/\r$/, "").replace(/^>[ \t]?/, "")).join("\n") });
        return false;
      } });
      return { tree, items, unchanged: unchanged && items.length === previous.items.length, byKey: new Map(items.map((item) => [item.key, item])) };
    }
    function componentHeaders(source) {
      const tree = parser.parse(source), items = [], starts = [0];
      for (let n = source.indexOf("\n"); n >= 0; n = source.indexOf("\n", n + 1)) starts.push(n + 1);
      const lineAt = (pos) => {
        let lo = 0, hi = starts.length;
        while (lo + 1 < hi) {
          const mid = lo + hi >> 1;
          if (starts[mid] <= pos) lo = mid;
          else hi = mid;
        }
        return lo;
      };
      tree.iterate({ enter(node) {
        if (node.name !== "Blockquote") return;
        const end = source.indexOf("\n", node.from), to = end < 0 ? source.length : end;
        const header = source.slice(node.from, to).replace(/\r$/, "");
        const m = /^(>\s*)\[!([\w-]+)(?:\|([^\]]+))?\]([+-]?)(?:[ \t]+(.*))?$/.exec(header);
        if (!m) return;
        const close = header.indexOf("]"), metadata = m[3] || "";
        items.push({ from: node.from, to: node.to, headerTo: node.from + header.length, header, type: m[2].toLowerCase(), metadata, id: metadata.split(/\s+/).find((t) => identity.test(t)) || null, fold: m[4], foldFrom: node.from + close + 1, title: m[5] || "", line: lineAt(node.from) });
      } });
      return items;
    }
    function replaceComponent(item, { title = item.title, body = item.body, fold = item.fold, type = item.type, metadata = item.metadata } = {}) {
      if (/[\r\n]/.test(title)) throw Error("A callout title must be one line.");
      if (!["", "+", "-"].includes(fold)) throw Error("Invalid fold state.");
      if (!/^[\w-]+$/.test(type) || /[\]\r\n]/.test(metadata)) throw Error("Invalid callout metadata.");
      const header = `> [!${type}${metadata ? "|" + metadata : ""}]${fold}${title ? " " + title : ""}`;
      const eol = item.eol || "\n";
      if (body === item.body && typeof item.raw === "string") {
        if (header === item.header) return item.raw;
        const line = item.raw.indexOf("\n");
        return header + (line < 0 ? "" : eol + item.raw.slice(line + 1));
      }
      if (typeof item.raw === "string" && item.raw.includes("\n") && body) {
        const oldLines = item.body.split("\n"), next = body.split("\n"), rawLines = item.raw.slice(item.raw.indexOf("\n") + 1).split(eol);
        let first = 0, last = oldLines.length, tail = next.length;
        while (first < last && first < tail && oldLines[first] === next[first]) first++;
        while (last > first && tail > first && oldLines[last - 1] === next[tail - 1]) {
          last--;
          tail--;
        }
        return header + eol + [...rawLines.slice(0, first), ...next.slice(first, tail).map((line) => "> " + line), ...rawLines.slice(last)].join(eol);
      }
      return header + (body ? eol + body.split("\n").map((line) => "> " + line).join(eol) : "");
    }
    function cleanContents(body) {
      return body.replace(/^(\s*(?:>\s*)+\[![\w-]+)\|([^\]]+)(\])/gm, (all, head, metadata, end) => {
        const kept = metadata.split(/\s+/).filter((token) => !identity.test(token) && !/^(at|origin|rev|n)=/.test(token)).join(" ");
        return head + (kept ? "|" + kept : "") + end;
      });
    }
    function presentationBody(text) {
      const headers = componentHeaders(text);
      let result = text;
      for (const h of headers.reverse()) result = result.slice(0, h.from) + "> [!component] " + h.title + result.slice(h.headerTo);
      return result;
    }
    module2.exports = { parseComponents, replaceComponent, cleanContents, identity, componentHeaders, presentationBody };
  }
});

// plugin/component-identity-model.js
var require_component_identity_model = __commonJS({
  "plugin/component-identity-model.js"(exports2, module2) {
    var { createHash, randomUUID } = require("node:crypto");
    var { componentHeaders, identity } = require_component_model();
    var uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    var privateToken = (t) => identity.test(t) || /^(at|origin|rev|n)=/.test(t);
    var hash = (s) => createHash("sha256").update(s).digest("hex");
    function metadata(header, values) {
      const tokens = header.metadata.split(/\s+/).filter(Boolean).filter((t) => !privateToken(t));
      if (values.id) tokens.push(values.id);
      if (values.at) tokens.push("at=" + values.at);
      if (values.origin) tokens.push("origin=" + values.origin);
      const end = header.header.indexOf("]");
      return header.header.slice(0, header.header.indexOf("[!")) + `[!${header.type}${tokens.length ? "|" + tokens.join(" ") : ""}]` + header.header.slice(end + 1);
    }
    function records(text) {
      return componentHeaders(text).map((h) => {
        const start = text.lastIndexOf("\n", h.from - 1) + 1, prefix = text.slice(start, h.from);
        const raw = text.slice(h.from, h.to).split("\n").map((line, i) => i && line.startsWith(prefix) ? line.slice(prefix.length) : line).join("\n");
        const legacy = raw.replace(/^(\s*(?:>\s*)+\[![\w-]+)(?:\|[^\]]+)?\]([+-]?)([^\n]*)/gm, (_, head, fold, title) => {
          const unnumbered = title.replace(/^(\s*(?:theorem|result|definition|vocabulary|note|lemma|corollary|proposition|equation|exercise|problem|example|figure|table)\s+)(?:[A-Z]\.)?\d+(?:\.\d+)*(?:\([a-z]\))?\s*[:.)]?\s*/i, "$1");
          return head + "]" + unnumbered;
        }).replace(/\r\n/g, "\n");
        const clean = raw.replace(/^(\s*(?:>\s*)+\[![\w-]+)(?:\|[^\]]+)?\]([+-]?)([^\n]*)/gm, (_, head, fold, title) => head + "]" + title.replace(/^\s*(?:theorem|result|definition|vocabulary|note|lemma|corollary|proposition|equation|exercise|problem|example|figure|table)\s+(?:[A-Z]\.)?\d+(?:\.\d+)*(?:\([a-z]\))?\s*[:.)]?\s*/i, " ")).replace(/\r\n/g, "\n");
        const tokens = h.metadata.split(/\s+/), at = tokens.find((t) => t.startsWith("at="))?.slice(3), origin = tokens.find((t) => t.startsWith("origin="))?.slice(7);
        return { ...h, at: uuid.test(at || "") ? at : null, origin: uuid.test(origin || "") ? origin : null, raw, hash: hash(legacy), hashVersion: 2, legacyContentHash: hash(legacy.replace(/^(\s*(?:>\s*)+\[!)[\w-]+/gm, "$1component")), contentHash: hash(clean.replace(/^(\s*(?:>\s*)+\[!)[\w-]+/gm, "$1component")) };
      });
    }
    function create({ type = "note", title = "", body = "", fold = "", id = randomUUID() + ".local", at = randomUUID() } = {}) {
      if (!/^[\w-]+$/.test(type) || /[\r\n]/.test(title) || !["", "+", "-"].includes(fold) || !identity.test(id) || !uuid.test(at)) throw Error("Invalid component fields");
      return `> [!${type}|${id} at=${at}]${fold}${title ? " " + title : ""}` + (body ? "\n" + body.split("\n").map((line) => "> " + line).join("\n") : "");
    }
    module2.exports = { records, metadata, create, privateToken, hash };
  }
});

// plugin/component-creation-model.js
var require_component_creation_model = __commonJS({
  "plugin/component-creation-model.js"(exports2, module2) {
    var { parser } = require_dist3();
    var { create } = require_component_identity_model();
    function escaped(text, at) {
      let n = 0;
      while (at > 0 && text[--at] === "\\") n++;
      return n % 2 === 1;
    }
    function excludedRanges(text) {
      const out = [];
      parser.parse(text).iterate({ enter: (n) => {
        if (["FencedCode", "CodeBlock", "InlineCode", "HTMLBlock"].includes(n.name)) {
          out.push([n.from, n.to]);
          return false;
        }
      } });
      return out;
    }
    function mathState(text, end, ranges = []) {
      let mode = null, r = 0;
      for (let i = 0; i < end; i++) {
        while (r < ranges.length && ranges[r][1] <= i) r++;
        if (ranges[r]?.[0] <= i) {
          i = ranges[r][1] - 1;
          continue;
        }
        if (escaped(text, i)) continue;
        if (text[i] === "$") {
          const token = text[i + 1] === "$" ? "$$" : "$";
          if (!mode) mode = token;
          else if (mode === token) mode = null;
          i += token.length - 1;
        } else if (text[i] === "\\" && ["(", ")", "[", "]"].includes(text[i + 1])) {
          const t = text.slice(i, i + 2);
          if (!mode && ["\\(", "\\["].includes(t)) mode = t;
          else if (mode === "\\(" && t === "\\)" || mode === "\\[" && t === "\\]") mode = null;
          i++;
        }
      }
      return mode;
    }
    function expansionAt(text, pos) {
      const ranges = excludedRanges(text), lineStart = text.lastIndexOf("\n", pos - 1) + 1, lineEnd = text.indexOf("\n", pos), end = lineEnd < 0 ? text.length : lineEnd;
      for (let start = text.indexOf("<<", lineStart); start >= 0 && start < end; start = text.indexOf("<<", start + 2)) {
        if (ranges.some(([a, b]) => start >= a && start < b) || mathState(text, start, ranges)) continue;
        const match = /^<<([A-Za-z][\w-]*?)([+-]?):[ \t]*/.exec(text.slice(start, end));
        if (!match) continue;
        const bodyStart = start + match[0].length;
        for (let i = bodyStart; i < end - 1; i++) if (text.slice(i, i + 2) === ">>" && !escaped(text, i) && !mathState(text.slice(bodyStart), i - bodyStart)) {
          if (pos >= start && pos <= i + 2) return { from: start, to: i + 2, type: match[1].toLowerCase(), fold: match[2], title: text.slice(bodyStart, i).trim() };
          break;
        }
      }
      return null;
    }
    function authoredSeries(text, type) {
      const aliases = { problem: "exercise", vocabulary: "definition", def: "definition", eq: "equation", fig: "figure" }, kind = aliases[type] || type;
      const numbers = require_component_model().componentHeaders(text).filter((h) => (aliases[h.type] || h.type) === kind).map((h) => /^\s*-?\s*[A-Za-z]+\.?\s+([A-Za-z\d]+(?:\.\d+)*)\.(\d+)(?=[:.\s]|$)/.exec(h.title)).filter(Boolean);
      const prefixes = new Set(numbers.map((m) => m[1]));
      if (prefixes.size > 1) throw Error("This note contains multiple authored chapter series. Insert in a single-chapter note, or select the numbering series explicitly before adding this type.");
      return prefixes.size === 1 ? { mode: "auto", counter: "authored:" + kind + ":" + [...prefixes][0] } : null;
    }
    function insertion(text, from, to = from, config = {}) {
      const ranges = excludedRanges(text);
      if (ranges.some(([a, b]) => from >= a && from < b) || mathState(text, from, ranges)) throw Error("Create callouts outside code and math.");
      const token = from === to ? expansionAt(text, from) : null, span = token || { from, to, type: "note", title: "", fold: "+" };
      let raw = create({ ...span, body: token ? "" : text.slice(from, to) });
      const series = config.titleMode === "source" ? null : authoredSeries(text, span.type);
      if (series) raw = raw.replace("]", " n=" + Buffer.from(JSON.stringify(series)).toString("hex") + "]");
      const prefix = span.from > 0 && !text.slice(0, span.from).endsWith("\n\n") ? text[span.from - 1] === "\n" ? "\n" : "\n\n" : "";
      const suffix = span.to < text.length && !text.slice(span.to).startsWith("\n\n") ? text[span.to] === "\n" ? "\n" : "\n\n" : "";
      return { from: span.from, to: span.to, insert: prefix + raw + suffix, componentFrom: span.from + prefix.length, id: /[0-9a-f-]{36}\.local/.exec(raw)[0], part: span.title ? "body" : "title" };
    }
    module2.exports = { authoredSeries, expansionAt, insertion, mathState };
  }
});

// plugin/component-reading-folds.js
var require_component_reading_folds = __commonJS({
  "plugin/component-reading-folds.js"(exports2, module2) {
    var states = /* @__PURE__ */ new WeakMap();
    function rootFor(node, container) {
      return node?.closest?.(".workspace-leaf") || container?.closest?.(".workspace-leaf") || node?.closest?.(".markdown-reading-view") || container?.closest?.(".markdown-reading-view") || null;
    }
    function state(root, path2) {
      let s = states.get(root);
      if (!s || s.path !== path2) {
        if (s && s.path !== path2) {
          root.classList.remove?.("kl-reading-fold-all", "kl-reading-unfold-all");
          delete root.dataset.klFoldPath;
        }
        s = { path: path2, all: root.classList.contains("kl-reading-fold-all") ? true : root.classList.contains("kl-reading-unfold-all") ? false : null, overrides: /* @__PURE__ */ new Map() };
        states.set(root, s);
      }
      return s;
    }
    function key(node) {
      return (node.dataset.calloutMetadata || "").split(/\s+/).find((t) => t.startsWith("at="))?.slice(3);
    }
    function effective(s, id, marker) {
      const row = s.overrides.get(id);
      return row ? row.folded : s.all ?? marker === "-";
    }
    function attach(node, root, path2) {
      if (!root) return;
      const s = state(root, path2), id = key(node);
      if (!id) return;
      const marker = node.dataset.calloutFold || "";
      const folded = effective(s, id, marker);
      node.dataset.klReadingFold = String(folded);
      node.classList.toggle("is-collapsed", folded);
      node.querySelector(":scope>.callout-title>.callout-fold")?.setAttribute("aria-expanded", String(!folded));
    }
    function refresh(root, path2) {
      for (const node of root?.querySelectorAll("[data-kl-component-reading]") || []) attach(node, root, path2);
    }
    function set(root, path2, id, folded) {
      if (!root) return;
      state(root, path2).overrides.set(id, { folded });
      refresh(root, path2);
    }
    function get(root, path2, id, marker) {
      return root ? effective(state(root, path2), id, marker) : marker === "-";
    }
    function all(root, path2, folded) {
      const s = state(root, path2);
      s.all = folded;
      s.overrides.clear();
      root.classList.toggle("kl-reading-fold-all", folded);
      root.classList.toggle("kl-reading-unfold-all", !folded);
      root.dataset.klFoldPath = path2;
      for (const node of root.querySelectorAll("[data-kl-view-fold]")) {
        node.dataset.klViewFold = String(folded);
        if (node._klState) {
          node._klState.folded = folded;
          node._klState.fold();
        }
      }
      refresh(root, path2);
    }
    function current(node, path2) {
      const root = rootFor(node);
      return root ? effective(state(root, path2), key(node), node.dataset.calloutFold || "") : node.classList.contains("is-collapsed");
    }
    module2.exports = { rootFor, attach, set, all, current, effective, get };
  }
});

// plugin/component-label-cache.js
var require_component_label_cache = __commonJS({
  "plugin/component-label-cache.js"(exports2, module2) {
    function labelCache(load) {
      let documents = /* @__PURE__ */ new WeakMap();
      return { clear() {
        documents = /* @__PURE__ */ new WeakMap();
      }, get(path2, doc) {
        let paths = documents.get(doc);
        if (!paths) {
          paths = /* @__PURE__ */ new Map();
          documents.set(doc, paths);
        }
        let value = paths.get(path2);
        if (!value) {
          value = Promise.resolve().then(() => load(path2, doc));
          paths.set(path2, value);
          value.catch(() => {
            if (paths.get(path2) === value) paths.delete(path2);
          });
        }
        return value;
      } };
    }
    module2.exports = { labelCache };
  }
});

// plugin/component-reference-drafts.js
var require_component_reference_drafts = __commonJS({
  "plugin/component-reference-drafts.js"(exports2, module2) {
    function applyIdentityDrafts(text, drafts) {
      const edits = [];
      for (const draft of drafts) {
        let left = 0, right = 0;
        while (left < text.length && left < draft.text.length && text[left] === draft.text[left]) left++;
        while (right < text.length - left && right < draft.text.length - left && text[text.length - 1 - right] === draft.text[draft.text.length - 1 - right]) right++;
        const oldEnd = draft.text.length - right, delta = text.length - draft.text.length;
        for (const e of draft.changes) {
          const id = e.insert.match(/([0-9a-f-]{36})\.local/);
          if (id && !new RegExp("(?:kl-[ntbc]-lib_|%%kl:[ntbc]:lib\\.)" + id[1]).test(text)) continue;
          let from = e.from, to = e.to;
          if (to <= left) {
          } else if (from >= oldEnd) {
            from += delta;
            to += delta;
          } else throw Error("The reference target changed inside this draft. Choose it again; your draft is retained.");
          if (text.slice(from, to) !== draft.text.slice(e.from, e.to)) throw Error("The reference target changed. Your draft is retained.");
          const prior = edits.find((x) => x.from === from && x.to === to);
          if (prior) {
            if (prior.insert !== e.insert) throw Error("Conflicting draft identities. Choose the target again.");
            continue;
          }
          edits.push({ from, to, insert: e.insert });
        }
      }
      edits.sort((a, b) => a.from - b.from);
      for (let n = 1; n < edits.length; n++) if (edits[n].from < edits[n - 1].to) throw Error("Overlapping identity changes. Your draft is retained.");
      for (const e of edits.reverse()) text = text.slice(0, e.from) + e.insert + text.slice(e.to);
      return text;
    }
    module2.exports = { applyIdentityDrafts };
  }
});

// plugin/component-file-ready.js
var require_component_file_ready = __commonJS({
  "plugin/component-file-ready.js"(exports2, module2) {
    async function componentFile(vault, path2, { attempts = 80, wait = () => new Promise((resolve) => setTimeout(resolve, 25)) } = {}) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const file = vault.getAbstractFileByPath(path2);
        if (file) return file;
        if (!await vault.adapter.exists(path2)) return null;
        await wait();
      }
      throw Error("The vault is still loading " + path2 + ". Its index update remains pending.");
    }
    function componentSaved(vault, path2, text, { timeoutMs = 2e3 } = {}) {
      return new Promise((resolve, reject) => {
        let done = false, reading = false, again = false, expired = false, ref, timer;
        const finish = (error) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (ref) vault.offref(ref);
          error ? reject(error) : resolve();
        };
        const check = async () => {
          if (done) return;
          if (reading) {
            again = true;
            return;
          }
          reading = true;
          try {
            if (await vault.adapter.read(path2) === text) {
              finish();
              return;
            }
            if (expired) {
              finish(Error("Waiting for " + path2 + " to finish saving. Its index update remains pending."));
              return;
            }
          } catch (error) {
            finish(error);
            return;
          } finally {
            reading = false;
          }
          if (again) {
            again = false;
            void check();
          }
        };
        ref = vault.on("modify", (file) => {
          if (file.path === path2) void check();
        });
        timer = setTimeout(() => {
          expired = true;
          void check();
        }, timeoutMs);
        void check();
      });
    }
    module2.exports = { componentFile, componentSaved };
  }
});

// plugin/component-write-scope.js
var require_component_write_scope = __commonJS({
  "plugin/component-write-scope.js"(exports2, module2) {
    function scope(plugin) {
      let ready, current = /* @__PURE__ */ new Set();
      const canWrite = async (path2) => {
        ready ||= (async () => {
          const adapter = plugin.app.vault.adapter;
          try {
            const pilot = await adapter.exists(".knowledge-library/pilot-required") || await adapter.exists(".knowledge-library/pilot.json");
            const config = pilot ? ".knowledge-library/pilot.json" : ".knowledge-library/vault.json";
            if (!await adapter.exists(config)) {
              if (pilot) throw Error("Pilot settings missing");
              return null;
            }
            const value = JSON.parse(await adapter.read(config));
            if (pilot && (!Object.hasOwn(value, "componentWritePaths") || value.numbering?.titleMode !== "source")) throw Error("Pilot settings incomplete");
            if (!Object.hasOwn(value, "componentWritePaths")) return null;
            const paths2 = value.componentWritePaths;
            if (!Array.isArray(paths2) || paths2.some((p) => typeof p !== "string" || !p.endsWith(".md") || p.startsWith("/") || p.split("/").some((s) => ["", ".", ".."].includes(s)))) return /* @__PURE__ */ new Set();
            return new Set(paths2);
          } catch {
            try {
              new (require("obsidian")).Notice("Pilot settings are unavailable; callout writes are disabled and source titles are preserved.");
            } catch {
            }
            return /* @__PURE__ */ new Set();
          }
        })();
        const paths = await ready;
        current = paths;
        return paths === null || paths.has(path2);
      };
      canWrite.peek = (path2) => current === null || current.has(path2);
      return canWrite;
    }
    function plainCallouts(text) {
      const rows = require_component_model().componentHeaders(text);
      for (const row of rows.reverse()) {
        if (!row.metadata) continue;
        const keep = row.metadata.split(/\s+/).filter((t) => t && !/^[0-9a-f-]{36}\.(local|library)$/i.test(t) && !/^(at|origin|rev)=/.test(t));
        const header = row.header, from = header.indexOf("|"), to = header.indexOf("]");
        text = text.slice(0, row.from + from) + (keep.length ? "|" + keep.join(" ") : "") + text.slice(row.from + to);
      }
      return text;
    }
    async function nativeCreateIfExcluded(plugin, path2) {
      if (await plugin.componentIdentities.canWrite(path2)) return false;
      plugin.app.commands.executeCommandById("editor:insert-callout");
      return true;
    }
    module2.exports = { scope, plainCallouts, nativeCreateIfExcluded };
  }
});

// plugin/component-external-observer.js
var require_component_external_observer = __commonJS({
  "plugin/component-external-observer.js"(exports2, module2) {
    function watch(plugin, { accepted, reconcile, onError, canWrite = async () => true, delay = 750 }) {
      const pending = /* @__PURE__ */ new Map();
      let closed = false;
      const schedule = (path2) => {
        if (closed) return;
        clearTimeout(pending.get(path2));
        pending.set(path2, setTimeout(() => {
          pending.delete(path2);
          void check(path2).catch(onError);
        }, delay));
      };
      async function check(path2) {
        if (closed || !await canWrite(path2)) return;
        const views = plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).filter((v) => v.file?.path === path2);
        if (!views.length && !accepted.has(path2)) return;
        if (views.some((v) => v.containerEl.querySelector(".kl-component-editing, .math-studio-host")) || plugin.admission.paused.has(path2)) {
          schedule(path2);
          return;
        }
        const file = plugin.app.vault.getAbstractFileByPath(path2);
        if (!file) return;
        const disk = await plugin.app.vault.read(file);
        if (closed || accepted.get(path2) === disk) return;
        if (views.some((v) => v.getMode() === "source" && v.editor?.getValue() !== disk)) {
          schedule(path2);
          return;
        }
        await reconcile(path2);
      }
      plugin.registerEvent(plugin.app.vault.on("modify", (file) => {
        if (file.path?.endsWith(".md")) schedule(file.path);
      }));
      plugin.register(() => {
        closed = true;
        for (const timer of pending.values()) clearTimeout(timer);
        pending.clear();
      });
      return { schedule };
    }
    module2.exports = { watch };
  }
});

// plugin/component-identities.js
var require_component_identities = __commonJS({
  "plugin/component-identities.js"(exports2, module2) {
    var { Notice: Notice2, editorLivePreviewField, editorInfoField } = require("obsidian");
    var { Transaction, StateField, EditorState } = require("@codemirror/state");
    var { EditorView, ViewPlugin, Decoration } = require("@codemirror/view");
    var { isolateHistory } = require("@codemirror/commands");
    var { componentHeaders } = require_component_model();
    var identityModel = require_component_identity_model();
    var { componentFile, componentSaved } = require_component_file_ready();
    function difference(before, after) {
      let from = 0, toA = before.length, toB = after.length;
      while (from < toA && from < toB && before[from] === after[from]) from++;
      while (toA > from && toB > from && before[toA - 1] === after[toB - 1]) {
        toA--;
        toB--;
      }
      return { from, to: toA, insert: after.slice(from, toB) };
    }
    function hiddenRanges(text) {
      const ranges = [];
      for (const row of componentHeaders(text)) {
        if (!row.metadata) continue;
        const begin = row.from + row.header.indexOf("|"), end = row.from + row.header.indexOf("]");
        const tokens = row.metadata.split(/\s+/).filter(Boolean);
        if (tokens.every(identityModel.privateToken)) ranges.push({ from: begin, to: end, owner: row });
        else {
          const re = /\S+/g;
          let match;
          while (match = re.exec(row.metadata)) if (identityModel.privateToken(match[0])) ranges.push({ from: begin + 1 + match.index, to: begin + 1 + match.index + match[0].length, owner: row });
        }
      }
      return ranges;
    }
    function registerComponentIdentities(plugin) {
      const canWrite = require_component_write_scope().scope(plugin);
      let queue = Promise.resolve(), closed = false;
      const states = /* @__PURE__ */ new Map(), accepted = /* @__PURE__ */ new Map(), timers = /* @__PURE__ */ new Map(), stateRequests = /* @__PURE__ */ new Map();
      const serialize = (fn) => {
        const result = queue.catch(() => {
        }).then(fn);
        queue = result.catch(() => {
        });
        return result;
      };
      const request = async (op, args) => {
        await plugin.admission.ready;
        return plugin.admission.request(op, args);
      };
      const pathOf = (view) => view.state.field(editorInfoField, false)?.file?.path;
      const report = (issues, path2) => {
        const saved = plugin.settings.componentIdentityNotices || [];
        const important = issues.filter((i) => ["ambiguous-erased-id", "home-promoted", "restored-id"].includes(i.kind)).filter((i) => {
          if (i.kind !== "ambiguous-erased-id") return true;
          const key = JSON.stringify([path2, i.kind, i.ids, i.line]);
          if (saved.includes(key)) return false;
          saved.push(key);
          return true;
        });
        if (important.length) {
          plugin.settings.componentIdentityNotices = saved.slice(-64);
          void plugin.persist().catch(() => {
          });
          plugin.componentIdentityIssues = important;
          new Notice2(important.map((i) => {
            if (i.kind !== "ambiguous-erased-id") return i.kind === "home-promoted" ? "The original callout was removed; a remaining copy is now its home." : "A removed callout identity was restored.";
            const refs = i.affectedReferences || [], locations = refs.slice(0, 3).map((r) => r.path + (r.line == null ? "" : `:${r.line + 1}`));
            return "A callout identity was erased and could not be restored safely. " + (refs.length ? `${refs.length} indexed references need review: ${locations.join(", ")}${refs.length > 3 ? "\u2026" : ""}` : "No affected references were found in the current vault index.");
          }).join("\n"), 1e4);
        }
      };
      const finish = async (path2, plan, text) => {
        const result = await request("live-component-finish", { token: plan.token, text });
        accepted.set(path2, text);
        states.set(path2, new Map(result.states.map((s) => [s.at, s])));
        report(result.issues, path2);
        const pending = plugin.settings.pendingComponentUpdates || {}, previous = pending[path2];
        if (previous) {
          const remaining = previous.filter((id) => result.states.some((s) => s.id.split(".")[0] === id && s.sourceChanged));
          if (remaining.length !== previous.length) {
            if (remaining.length) pending[path2] = remaining;
            else delete pending[path2];
            plugin.settings.pendingComponentUpdates = pending;
            await plugin.persist();
          }
        }
        const openPaths = /* @__PURE__ */ new Set();
        plugin.app.workspace.iterateAllLeaves((leaf) => {
          const p = leaf.view?.file?.path;
          if (p && p !== path2 && states.has(p)) openPaths.add(p);
        });
        await Promise.all([...openPaths].map(async (p) => {
          const rows = await request("live-component-state", { path: p });
          states.set(p, new Map(rows.map((s) => [s.at, s])));
        }));
        plugin.app.workspace.trigger("knowledge-library:component-identities-changed", path2);
        return result;
      };
      const transact = async (view, text, operation, history = true, syncAt = null, ancestor = null, effects = []) => {
        const path2 = pathOf(view);
        if (!path2 || closed) return;
        if (!await canWrite(path2)) throw Error("This note is outside the enabled callout pilot.");
        const original = view.state.doc.toString();
        const plan = await request("live-component-plan", { path: path2, text, operation, ...syncAt ? { syncAt } : {}, ...ancestor ? { ancestor } : {} });
        if (view.state.doc.toString() !== original) throw Error("The note changed while its callout identity was being checked. Try the edit again.");
        if (plan.text !== original) view.dispatch({ changes: difference(original, plan.text), annotations: [history ? isolateHistory.of("full") : Transaction.addToHistory.of(false)], userEvent: "input.callout-identity", effects });
        await finish(path2, plan, plan.text);
      };
      const observe = (view, operation = "observe") => serialize(async () => {
        const path2 = pathOf(view), text = view.state.doc.toString();
        if (!path2 || accepted.get(path2) === text || closed || plugin.admission.paused.has(path2) || !await canWrite(path2)) return;
        await transact(view, text, operation, false);
      });
      const schedule = (view, operation = "observe") => {
        clearTimeout(timers.get(view));
        timers.set(view, setTimeout(() => {
          timers.delete(view);
          observe(view, operation).catch((error) => new Notice2(error.message));
        }, 180));
      };
      let replayPending = null;
      const membershipNotice = (removals) => {
        if (!removals.size) return;
        const fragment = document.createDocumentFragment(), keys = [...new Set([...removals.values()].map((r) => r.key))];
        fragment.append(`${removals.size} index ${removals.size === 1 ? "entry was" : "entries were"} removed; their callouts are now local. `);
        const undo = document.createElement("a");
        undo.href = "#";
        undo.textContent = "Undo";
        fragment.append(undo);
        const notice = new Notice2(fragment, 15e3);
        undo.onclick = (event) => {
          event.preventDefault();
          undo.onclick = null;
          void (async () => {
            for (const target of keys.reverse()) await request("live-component-membership-undo", { target, key: require("node:crypto").randomUUID() });
            await replayMembership();
            notice.hide();
          })().catch((error) => new Notice2(error.message));
        };
      };
      const updatePath = async (path2, ids = [], undoToken = null) => {
        if (!await canWrite(path2)) return null;
        const file = await componentFile(plugin.app.vault, path2);
        if (!file) {
          const removed = await request("live-component-plan", { path: path2, text: "", operation: "observe" });
          await finish(path2, removed, removed.text);
          return null;
        }
        if (plugin.admission.paused.has(path2)) throw Error("An admission is finishing; index updates will retry.");
        const views = plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).filter((v) => v.file?.path === path2);
        if (views.some((v) => v.containerEl.querySelector(".kl-component-editing"))) throw Error("Finish the open callout edit to apply its index update.");
        const view = views.find((v) => v.getMode() === "source" && v.editor?.cm), text = view ? view.editor.getValue() : await plugin.app.vault.read(file);
        const receipts = [], pending = plugin.settings.pendingComponentWrites || {};
        let resumedPlan = null;
        for (const token of pending[path2] || []) {
          await componentSaved(plugin.app.vault, path2, text);
          const resumed = await request("live-component-propagation-resume", { token, text, ids });
          if (resumed.state === "rebase") {
            resumedPlan = resumed.plan;
            break;
          }
          if (resumed.state === "complete" && resumed.updates.length) receipts.push({ path: path2, token, count: resumed.updates.length });
        }
        const plan = resumedPlan || (undoToken ? await request("live-component-propagation-undo", { token: undoToken, text }) : ids.length ? await request("live-component-propagation-plan", { path: path2, text, ids }) : await request("live-component-plan", { path: path2, text, operation: "observe" }));
        if (plan.updates?.length) {
          pending[path2] = [plan.token];
          plugin.settings.pendingComponentWrites = pending;
          await plugin.persist();
        }
        if (view) {
          if (view.editor.getValue() !== text) throw Error("The note changed during its index update; it will be retried.");
          if (plan.text !== text) view.editor.cm.dispatch({ changes: difference(text, plan.text), annotations: Transaction.addToHistory.of(false), userEvent: "input.callout-identity" });
        } else if (plan.text !== text) await plugin.app.vault.process(file, (current) => {
          if (current !== text) throw Error("A note changed during its index update; it will be retried.");
          return plan.text;
        });
        await componentSaved(plugin.app.vault, path2, plan.text);
        if (view && view.editor.getValue() !== plan.text) throw Error("The note changed before its index update finished. The update receipt is preserved.");
        await finish(path2, plan, plan.text);
        if (plan.updates?.length) receipts.push({ path: path2, token: plan.token, count: plan.updates.length });
        return receipts;
      };
      const updatedNotice = (receipts) => {
        if (!receipts.length) return;
        const fragment = document.createDocumentFragment(), count = receipts.reduce((n, r) => n + r.count, 0);
        fragment.append(`${count} ${count === 1 ? "callout" : "callouts"} updated from the index. `);
        const undo = document.createElement("a");
        undo.href = "#";
        undo.textContent = "Undo";
        fragment.append(undo);
        const notice = new Notice2(fragment, 15e3);
        undo.onclick = (e) => {
          e.preventDefault();
          void serialize(async () => {
            for (const receipt of [...receipts].reverse()) await updatePath(receipt.path, [], receipt.token);
            notice.hide();
          }).catch((error) => new Notice2(error.message));
        };
      };
      const applyPending = () => serialize(async () => {
        const pending = plugin.settings.pendingComponentUpdates || {}, receipts = [];
        for (const [path2, ids] of Object.entries(pending)) {
          const result = await updatePath(path2, ids);
          if (result) receipts.push(...result);
          delete pending[path2];
          delete plugin.settings.pendingComponentWrites?.[path2];
          plugin.settings.pendingComponentUpdates = pending;
          await plugin.persist();
        }
        updatedNotice(receipts);
      });
      const applyEntryJobs = async () => {
        const jobs = await request("live-component-edit-pending", {});
        for (const job of jobs) {
          const file = plugin.app.vault.getAbstractFileByPath(job.path);
          if (!file) continue;
          const views = plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).filter((v) => v.file?.path === job.path);
          if (views.some((v) => v.containerEl.querySelector(".kl-component-editing,.math-studio-host")) || plugin.admission.paused.has(job.path)) continue;
          const view = views.find((v) => v.getMode() === "source" && v.editor?.cm), text = view ? view.editor.getValue() : await plugin.app.vault.read(file);
          try {
            let plan;
            try {
              plan = await request(job.agent ? "live-agent-prepare" : "live-component-edit-prepare", { key: job.key, text });
            } catch (error) {
              await request(job.agent ? "live-agent-fail" : "live-component-edit-fail", { key: job.key, message: error.message });
              continue;
            }
            if (view) {
              if (view.editor.getValue() !== text) continue;
              if (plan.text !== text) view.editor.cm.dispatch({ changes: difference(text, plan.text), annotations: isolateHistory.of("full"), userEvent: "input.callout-identity" });
            } else if (plan.text !== text) await plugin.app.vault.process(file, (current) => {
              if (current !== text) throw Error("The original changed while its index edit was pending.");
              return plan.text;
            });
            await componentSaved(plugin.app.vault, job.path, plan.text);
            await request(job.agent ? "live-agent-finish" : "live-component-edit-finish", { key: job.key, token: plan.token, text: plan.text });
            accepted.delete(job.path);
            const rows = await request("live-component-state", { path: job.path });
            states.set(job.path, new Map(rows.map((s) => [s.at, s])));
            plugin.app.workspace.trigger("knowledge-library:component-identities-changed", job.path);
          } catch (error) {
            plugin.componentEntryEditError = error.message;
          }
        }
      };
      const replayMembership = (audit = false) => {
        if (replayPending) return replayPending;
        replayPending = serialize(async () => {
          await applyEntryJobs();
          const removals = /* @__PURE__ */ new Map(), receipts = [];
          let more = true, queued = 0;
          while (more && !closed) {
            const page = await request("live-component-membership-replay", { cursor: plugin.settings.membershipCursor, audit });
            audit = false;
            const deferred = await request("live-component-closed-resolved", {});
            for (const [path2, job] of Object.entries(deferred)) {
              if (!page.paths.includes(path2)) page.paths.push(path2);
              page.updatePaths[path2] = [.../* @__PURE__ */ new Set([...page.updatePaths[path2] || [], ...job.ids])];
              if (job.token) {
                const pending = plugin.settings.pendingComponentWrites || {};
                pending[path2] = [.../* @__PURE__ */ new Set([...pending[path2] || [], job.token])];
                plugin.settings.pendingComponentWrites = pending;
              }
            }
            for (const path2 of page.paths) {
              const rows = await request("live-component-state", { path: path2 });
              states.set(path2, new Map(rows.map((s) => [s.at, s])));
              accepted.delete(path2);
            }
            if (page.paths.length) plugin.app.workspace.trigger("knowledge-library:component-identities-changed");
            const automatic = (plugin.settings.copyUpdates || "automatic") === "automatic";
            for (const path2 of page.paths) {
              if (closed) return;
              const updates = page.updatePaths[path2] || [];
              if (!automatic && updates.length) {
                const pending = plugin.settings.pendingComponentUpdates || {};
                pending[path2] = [.../* @__PURE__ */ new Set([...pending[path2] || [], ...updates])];
                plugin.settings.pendingComponentUpdates = pending;
                queued++;
              }
              try {
                const result = await updatePath(path2, automatic ? updates : []);
                if (result) receipts.push(...result);
                if (deferred[path2]) await request("live-component-closed-resolved", { paths: [path2] });
              } catch (error) {
                if (!deferred[path2]) throw error;
                new Notice2(`${path2}: ${error.message} The other index updates will continue.`);
              }
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
            for (const row of page.removals) removals.set(row.id, row);
            const changed = JSON.stringify(plugin.settings.membershipCursor) !== JSON.stringify(page.cursor) || page.paths.some((path2) => plugin.settings.pendingComponentWrites?.[path2]);
            for (const path2 of page.paths) delete plugin.settings.pendingComponentWrites?.[path2];
            if (changed) {
              plugin.settings.membershipCursor = page.cursor;
              await plugin.persist();
            }
            more = page.more;
          }
          const closedNotices = await request("live-component-closed-notices", {});
          for (const batch of closedNotices) {
            for (const row of batch.removals) removals.set(row.id, row);
            receipts.push(...batch.receipts);
          }
          membershipNotice(removals);
          updatedNotice(receipts);
          if (closedNotices.length) await request("live-component-closed-notices", { ack: closedNotices.map((r) => r.key) });
          if (queued) plugin.showPendingComponentUpdates?.((plugin.settings.copyUpdates || "automatic") === "ask");
        }).finally(() => {
          replayPending = null;
        });
        return replayPending;
      };
      plugin.componentIdentities = {
        acceptGrouped: (path2, text) => {
          accepted.set(path2, text);
        },
        replayMembership,
        applyPending,
        applyEntryJobs: () => serialize(applyEntryJobs),
        state: (path2, at) => states.get(path2)?.get(at),
        ensureState: (path2) => {
          if (states.has(path2)) return Promise.resolve();
          if (!stateRequests.has(path2)) stateRequests.set(path2, request("live-component-state", { path: path2 }).then((rows) => states.set(path2, new Map(rows.map((s) => [s.at, s])))).finally(() => stateRequests.delete(path2)));
          return stateRequests.get(path2);
        },
        commit: (view, expected, change, operation = "edit", reservedHeaders = false, effects = []) => serialize(async () => {
          if (view.state.doc.toString() !== expected) throw Error("The callout changed while its editor was open.");
          if (accepted.get(pathOf(view)) !== expected) {
            const p = await request("live-component-plan", { path: pathOf(view), text: expected, operation: "observe" });
            if (p.text !== expected) {
              if (!reservedHeaders) throw Error("Callout identity is initializing. Reopen the editor in a moment.");
            } else await finish(pathOf(view), p, expected);
          }
          const proposed = expected.slice(0, change.from) + change.insert + expected.slice(change.to);
          await transact(view, proposed, operation, true, null, null, effects);
        }),
        observe,
        canWrite,
        sync: (view, at, ancestor = null) => serialize(() => transact(view, view.state.doc.toString(), "sync", true, at, ancestor)),
        syncFile: (path2, at, ancestor = null) => serialize(async () => {
          const file = plugin.app.vault.getAbstractFileByPath(path2);
          if (!file) throw Error("The note is unavailable.");
          const text = await plugin.app.vault.read(file), plan = await request("live-component-plan", { path: path2, text, operation: "sync", syncAt: at, ancestor });
          await plugin.app.vault.process(file, (current) => {
            if (current !== text) throw Error("The note changed before synchronization. Try again.");
            return plan.text;
          });
          await finish(path2, plan, plan.text);
          if (plan.text !== text) {
            const fragment = document.createDocumentFragment();
            fragment.append("Callout synchronized. ");
            const undo = document.createElement("a");
            undo.textContent = "Undo";
            undo.href = "#";
            fragment.append(undo);
            const notice = new Notice2(fragment, 12e3);
            undo.onclick = (event) => {
              event.preventDefault();
              void serialize(async () => {
                const current = await plugin.app.vault.read(file);
                if (current !== plan.text) throw Error("The note changed after synchronization; Undo would overwrite that edit.");
                const reverse = await request("live-component-plan", { path: path2, text, operation: "undo" });
                await plugin.app.vault.process(file, (value) => {
                  if (value !== plan.text) throw Error("The note changed before Undo.");
                  return reverse.text;
                });
                await finish(path2, reverse, reverse.text);
                notice.hide();
              }).catch((error) => new Notice2(error.message));
            };
          }
        }),
        create: identityModel.create,
        insert: (view, change, expected) => serialize(async () => {
          const before = view.state.doc.toString();
          if (before !== expected) throw Error("The note changed before insertion. Try again.");
          await transact(view, before.slice(0, change.from) + change.insert + before.slice(change.to), "paste", true);
        }),
        flush: () => queue
      };
      plugin.componentMembershipReady = replayMembership(true);
      plugin.componentMembershipReady.catch((error) => new Notice2(error.message));
      plugin.registerInterval(setInterval(() => {
        void request("live-component-session", {}).catch(() => {
        });
      }, 3e4));
      plugin.registerInterval(setInterval(() => {
        void replayMembership().catch((error) => {
          plugin.componentMembershipError = error.message;
        });
      }, 3e3));
      const hidden = StateField.define({
        create: (s) => s.field(editorLivePreviewField, false) ? [] : hiddenRanges(s.doc.toString()),
        update: (old, tr) => tr.state.field(editorLivePreviewField, false) ? [] : tr.docChanged || tr.reconfigured || tr.startState.field(editorLivePreviewField, false) !== tr.state.field(editorLivePreviewField, false) ? hiddenRanges(tr.newDoc.toString()) : old,
        provide: (f) => [EditorView.decorations.from(f, (rows) => Decoration.set(rows.map((r) => Decoration.replace({}).range(r.from, r.to)), true)), EditorView.atomicRanges.of((v) => Decoration.set(v.state.field(f).map((r) => Decoration.replace({}).range(r.from, r.to)), true))]
      });
      plugin.registerEditorExtension([
        hidden,
        EditorState.transactionFilter.of((tr) => {
          if (!tr.docChanged || tr.isUserEvent("input.callout-identity") || tr.isUserEvent("knowledge-library-admission") || tr.isUserEvent("undo") || tr.isUserEvent("redo")) return tr;
          let protectedEdit = false;
          const ranges = tr.startState.field(hidden);
          tr.changes.iterChanges((from, to) => {
            for (const r of ranges) {
              const touches = from === to ? from > r.from && from < r.to : from < r.to && to > r.from;
              if (touches && !(from <= r.owner.from && to >= r.owner.to)) protectedEdit = true;
            }
          });
          if (protectedEdit) {
            queueMicrotask(() => new Notice2("The hidden callout identity stays with its component. Select the whole callout to move or delete it."));
            return [];
          }
          return tr;
        }),
        ViewPlugin.fromClass(class {
          constructor(view) {
            this.view = view;
            schedule(view);
            this.clipboard = (event) => {
              if (!canWrite.peek(pathOf(view)) || !view.hasFocus || view.dom.ownerDocument.activeElement !== view.contentDOM) return;
              const selection = view.state.selection.main;
              if (selection.empty || !event.clipboardData) return;
              const selected = view.state.doc.sliceString(selection.from, selection.to);
              if (!componentHeaders(selected).length) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              event.clipboardData.setData("text/plain", selected);
              if (event.type === "cut") {
                view.dispatch({ changes: { from: selection.from, to: selection.to, insert: "" }, selection: { anchor: selection.from }, annotations: isolateHistory.of("full"), userEvent: "delete.cut" });
                clearTimeout(timers.get(view));
                timers.delete(view);
                observe(view).catch((error) => new Notice2(error.message));
              }
            };
            for (const type of ["copy", "cut"]) view.dom.ownerDocument.addEventListener(type, this.clipboard, true);
          }
          update(update) {
            if (!update.docChanged) return;
            if (update.transactions.some((t) => t.isUserEvent("input.callout-identity"))) return;
            if (update.transactions.some((t) => t.isUserEvent("undo") || t.isUserEvent("redo"))) schedule(update.view, "undo");
            else if (update.transactions.some((t) => {
              if (!t.annotation(Transaction.userEvent) || t.isUserEvent("delete.cut")) return true;
              let erasedIdentity = false;
              t.changes.iterChanges((from, to) => {
                if (to > from && /[0-9a-f]{8}-[0-9a-f-]{27}\.(?:local|library)/i.test(t.startState.doc.sliceString(from, to))) erasedIdentity = true;
              });
              if (erasedIdentity) return true;
              if (!t.isUserEvent("delete")) return false;
              let removedComponent = false;
              t.changes.iterChanges((from, to) => {
                if (to > from && /\[![\w-]+/.test(t.startState.doc.sliceString(from, to))) removedComponent = true;
              });
              return removedComponent;
            })) schedule(update.view);
          }
          destroy() {
            clearTimeout(timers.get(this.view));
            timers.delete(this.view);
            for (const type of ["copy", "cut"]) this.view.dom.ownerDocument.removeEventListener(type, this.clipboard, true);
          }
        }),
        EditorView.domEventHandlers({ focus: (_event, view) => {
          const path2 = pathOf(view);
          if (path2) request("live-component-state", { path: path2 }).then((rows) => {
            states.set(path2, new Map(rows.map((s) => [s.at, s])));
            plugin.app.workspace.trigger("knowledge-library:component-identities-changed", path2);
          }).catch(() => {
          });
          return false;
        }, blur: (_event, view) => {
          schedule(view);
          return false;
        }, paste: (event, view) => {
          const text = event.clipboardData?.getData("text/plain");
          if (!text || !componentHeaders(text).length) return false;
          event.preventDefault();
          const expected = view.state.doc.toString(), selection = view.state.selection.main;
          serialize(async () => {
            if (view.state.doc.toString() !== expected) throw Error("The paste position changed. Paste again.");
            if (!await canWrite(pathOf(view))) {
              view.dispatch({ changes: { from: selection.from, to: selection.to, insert: require_component_write_scope().plainCallouts(text) }, annotations: isolateHistory.of("full"), userEvent: "input.paste" });
              return;
            }
            const proposed = expected.slice(0, selection.from) + text + expected.slice(selection.to);
            await transact(view, proposed, "paste", true);
          }).catch((error) => new Notice2(error.message));
          return true;
        } })
      ]);
      require_component_external_observer().watch(plugin, { accepted, canWrite, reconcile: (path2) => serialize(() => updatePath(path2)), onError: (error) => new Notice2(error.message) });
      plugin.registerEvent(plugin.app.workspace.on("file-open", () => {
        const view = plugin.app.workspace.activeLeaf?.view?.editor?.cm;
        if (view) schedule(view);
      }));
      plugin.register(() => {
        closed = true;
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
      });
    }
    module2.exports = { registerComponentIdentities, hiddenRanges, difference };
  }
});

// plugin/component-math-references.js
var require_component_math_references = __commonJS({
  "plugin/component-math-references.js"(exports2, module2) {
    var { randomUUID, createHash } = require("node:crypto");
    var hash = (s) => createHash("sha256").update(s).digest("hex");
    function projectedRange(project, value, from, to) {
      const a = "KLBEGIN" + randomUUID().replaceAll("-", ""), b = "KLEND" + randomUUID().replaceAll("-", "");
      const marked = project(value.slice(0, from) + a + value.slice(from, to) + b + value.slice(to)), start = marked.indexOf(a), end = marked.indexOf(b);
      if (start < 0 || end < start || marked.indexOf(a, start + 1) >= 0 || marked.indexOf(b, end + 1) >= 0) throw Error("The equation could not be mapped into its callout.");
      const source = marked.slice(0, start) + marked.slice(start + a.length, end) + marked.slice(end + b.length);
      if (source !== project(value)) throw Error("The callout changed while mapping its equation.");
      return { source, from: start, to: end - a.length };
    }
    function componentMathReferences(plugin, path2, project, input, q, stageIdentity) {
      const api = plugin.referenceApi;
      if (!api) return null;
      const original = input.value, range = projectedRange(project, original, q.from, q.to), text = range.source, doc = { toString: () => text, length: text.length };
      const editor = { cm: { state: { doc }, coordsAtPos: () => input.closest(".kl-component")?.getBoundingClientRect() }, posToOffset: () => 0, getValue: () => text, getCursor: () => ({ line: 0, ch: 0 }), getSelection: () => "", focus: () => input.focus() };
      const info = { file: { path: path2 } }, abort = new AbortController(), prepared = /* @__PURE__ */ new Map(), reservations = [], sessionId = randomUUID();
      const current = () => {
        if (abort.signal.aborted || input.value !== original || project(original) !== text) throw Error("The callout changed while editing. Your equation draft is retained.");
      };
      return { async request(type, data) {
        current();
        if (type === "discard-reference") {
          prepared.delete(data.token);
          return null;
        }
        if (type === "choose-reference") {
          const choice = await api.choose({ editor, info, expression: data.expression, mode: data.mode, currentTarget: data.currentTarget, purpose: data.purpose, componentsOnly: true, signal: abort.signal });
          if (!choice) return null;
          current();
          const value = await api.prepare({ path: path2, text, sourceHash: hash(text), sessionId, choice, expression: data.expression, reservations });
          current();
          if (value.reservation && !reservations.some((r) => r.reservation.blockId === value.reservation.reservation.blockId)) reservations.push(value.reservation);
          if (prepared.size >= 256) throw Error("Save the equation before adding more references.");
          const token = randomUUID();
          prepared.set(token, value);
          return { token, expression: value.expression, mode: value.mode, target: value.target };
        }
        if (type === "wrap-reference") {
          const value = prepared.get(data.token);
          if (!value) throw Error("Choose the reference again.");
          const result = await api.wrap({ mode: value.mode, target: value.target, body: data.body });
          current();
          prepared.delete(data.token);
          return result;
        }
        throw Error("Unsupported equation reference action");
      }, async validate(next) {
        current();
        const after = project(next), prefix = text.slice(0, range.from), suffix = text.slice(range.to);
        if (!after.startsWith(prefix) || !after.endsWith(suffix)) throw Error("The edit would change content outside this equation.");
        const replacement = after.slice(range.from, after.length - suffix.length);
        const plan = await api.planEquationSave({ path: path2, text, sourceHash: hash(text), sessionId, from: range.from, to: range.to, original: text.slice(range.from, range.to), replacement, reservations });
        current();
        const equation = plan.changes.find((e) => e.from === range.from && e.to === range.to && e.insert === replacement);
        if (!equation) throw Error("The equation save plan changed. Your draft is retained.");
        const extra = plan.changes.filter((e) => e !== equation);
        if ((extra.length || plan.foreignIdentities?.length) && !stageIdentity) throw Error("This editor cannot save the new identity together with the equation. Your draft is retained.");
        await api.verifyEquationSave(plan, text);
        current();
        if (extra.length || plan.foreignIdentities?.length) {
          const delta = replacement.length - (range.to - range.from);
          stageIdentity({ text: after, foreign: plan.foreignIdentities || [], changes: extra.map((e) => {
            if (e.to <= range.from) return e;
            if (e.from >= range.to) return { ...e, from: e.from + delta, to: e.to + delta };
            throw Error("Identity overlaps its equation. Your draft is retained.");
          }) });
        }
      }, dispose() {
        abort.abort();
        prepared.clear();
      } };
    }
    module2.exports = { componentMathReferences, projectedRange };
  }
});

// plugin/callout-component.js
var require_callout_component = __commonJS({
  "plugin/callout-component.js"(exports2, module2) {
    var { Component: Component2, MarkdownRenderChild, MarkdownRenderer: MarkdownRenderer2, Notice: Notice2, setIcon, setTooltip, MarkdownView: MarkdownView2, editorLivePreviewField, editorInfoField } = require("obsidian");
    var model = require_component_model();
    var readingFolds = require_component_reading_folds();
    function componentExtension(plugin, runtime, context = {}) {
      const { StateField, StateEffect, Prec } = runtime.state, { EditorView, Decoration, WidgetType } = runtime.view;
      const refresh = StateEffect.define();
      const owners = /* @__PURE__ */ new Set(), heights = /* @__PURE__ */ new Map();
      const labels = require_component_label_cache().labelCache((path2, doc) => plugin.calloutAPI.getCallouts({ file: plugin.app.vault.getAbstractFileByPath(path2), doc, text: () => doc.toString() }).then((r) => r.callouts));
      const labelRows = (path2, doc) => labels.get(path2, doc);
      class CalloutWidget extends WidgetType {
        constructor(item, path2, foldAll) {
          super();
          this.item = item;
          this.path = path2;
          this.foldAll = foldAll;
        }
        eq(other) {
          return this.item.raw === other.item.raw && this.item.from === other.item.from && this.path === other.path && this.foldAll === other.foldAll;
        }
        get estimatedHeight() {
          return heights.get(this.path + "|" + (this.item.id || this.item.from) + "|" + this.foldAll) ?? -1;
        }
        updateDOM(node) {
          if (node._klState?.path !== this.path) return false;
          return node._klReceive?.(this.item, this.foldAll) || false;
        }
        toDOM(view) {
          const item = view.state.field(field).parsed.byKey.get(this.item.key) || this.item, doc = view.dom.ownerDocument, node = doc.createElement("div");
          node.className = "callout kl-component";
          node.dataset.callout = item.type;
          node.dataset.klComponent = "";
          node.tabIndex = 0;
          if (item.id) node.dataset.klIdentity = item.id;
          const owner = new Component2();
          owner.load();
          let alive = true, editing = false, editingPart = null, control = null, busy = false, conflict = false, finishing = false;
          const referenceDrafts = context.referenceDrafts || [];
          const foldRoot = readingFolds.rootFor(view.dom) || view.dom, foldKey = item.metadata.split(/\s+/).find((t) => t.startsWith("at="))?.slice(3) || item.key;
          const state = { node, owner, view, path: this.path, item, finishAncestors: context.finishParent, folded: readingFolds.get(foldRoot, this.path, foldKey, item.fold), setFoldAll: (value) => view.dispatch({ effects: refresh.of(value) }), dispose: () => {
            alive = false;
            owner.unload();
          } };
          owners.add(state);
          node._klState = state;
          node._klDispose = () => {
            owners.delete(state);
            state.dispose();
          };
          const title = node.createDiv("callout-title"), icon = title.createDiv("callout-icon");
          const heading = title.createDiv("callout-title-inner");
          heading.tabIndex = 0;
          heading.setAttribute("role", "button");
          heading.setAttribute("aria-label", "Edit callout title");
          const arrow = title.createEl("button", { cls: "callout-fold kl-component-fold clickable-icon", attr: { "aria-label": "Toggle callout" } });
          setIcon(arrow, "chevron-down");
          const copy = title.createEl("button", { cls: "kl-component-copy clickable-icon", attr: { "aria-label": "Copy callout contents" } });
          setIcon(copy, "copy");
          const admission = title.createEl("span", { cls: "kl-component-admission" });
          admission.hidden = true;
          admission.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (context.nested || editing) return;
            const at = state.item.metadata.split(/\s+/).find((t) => t.startsWith("at="))?.slice(3);
            if (plugin.componentIdentities?.state(this.path, at)?.sourceChanged) {
              try {
                await plugin.componentActions.compareAt(this.path, at, view);
              } catch (error) {
                new Notice2(error.message);
              }
            }
          };
          const body = node.createDiv("callout-content markdown-rendered");
          const measure = () => {
            if (alive) view.requestMeasure({ key: node, read: () => node.getBoundingClientRect().height, write: (height) => heights.set(this.path + "|" + (state.item.id || state.item.from) + "|" + this.foldAll, height) });
          };
          node._klReceive = (next, foldAll) => {
            if (!editing) {
              if (next.raw === state.item.raw && foldAll === this.foldAll) {
                state.item = next;
                void renderHeading();
                return true;
              }
              return false;
            }
            if (next.raw !== state.item.raw && !finishing) {
              conflict = true;
              new Notice2("This callout changed elsewhere. Your open edit is preserved; copy it before reopening.");
            }
            state.item = next;
            return true;
          };
          const render = async (text, target) => {
            const stage = doc.createElement("div");
            await MarkdownRenderer2.render(plugin.app, text, stage, this.path, owner);
            if (alive) {
              target.replaceChildren(...stage.childNodes);
              if (target === body) {
                const nested = model.componentHeaders(text), elements = [...body.querySelectorAll(".callout")];
                const source = context.project?.(view.state.doc) || context.labelSource || { path: this.path, doc: view.state.doc, baseLine: 0 };
                const base = source.baseLine + view.state.doc.lineAt(state.item.from).number;
                void labelRows(source.path, source.doc).then((rows) => {
                  if (!alive || editing || state.item.body !== text) return;
                  for (let i = 0; i < Math.min(nested.length, elements.length); i++) {
                    const h = nested[i], el = elements[i], label = rows.find((r) => r.line === base + h.line)?.label;
                    if (label) void render(label, el.querySelector(":scope>.callout-title>.callout-title-inner"));
                  }
                }).catch(() => {
                });
                elements.forEach((el, i) => {
                  const h = nested[i], title2 = el.querySelector(":scope>.callout-title");
                  if (!h || !title2) return;
                  const id = h.metadata.split(/\s+/).find((t) => t.startsWith("at="))?.slice(3) || h;
                  const paint = () => {
                    const folded = readingFolds.get(foldRoot, this.path, id, h.fold);
                    el.dataset.klViewFold = String(folded);
                    el.classList.toggle("is-collapsed", folded);
                  };
                  paint();
                  if (!title2.querySelector(":scope>.callout-fold")) {
                    const a = title2.createDiv("callout-fold");
                    setIcon(a, "chevron-down");
                  }
                  title2.addEventListener("click", async (e) => {
                    if (e.target.closest("a,input,.kl-component-admission")) return;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    readingFolds.set(foldRoot, this.path, id, !readingFolds.get(foldRoot, this.path, id, h.fold));
                    paint();
                    measure();
                  }, true);
                });
              }
              measure();
            }
          };
          let headingGeneration = 0;
          const renderHeading = async () => {
            const generation = ++headingGeneration, c = state.item, stage = doc.createElement("div");
            let label = c.title || c.type;
            try {
              const source = context.project?.(view.state.doc) || context.labelSource || { path: this.path, doc: view.state.doc, baseLine: 0 };
              const line = source.baseLine + view.state.doc.lineAt(c.from).number - 1;
              const rows = await labelRows(source.path, source.doc);
              label = rows.find((r) => r.line === line)?.label || label;
            } catch {
            }
            const styleMetadata = c.metadata.split(/\s+/).filter((t) => !/^(?:[0-9a-f-]{36}\.(?:local|library)|at=|origin=|rev=|n=)/i.test(t)).join(" ");
            await MarkdownRenderer2.render(plugin.app, `> [!${c.type}${styleMetadata ? "|" + styleMetadata : ""}]+ ${label}`, stage, this.path, owner);
            if (!alive || editing && editingPart === "title" || generation !== headingGeneration) return;
            const nativeIcon = stage.querySelector(".callout-icon"), nativeHeading = stage.querySelector(".callout-title-inner");
            if (nativeIcon?.querySelector("svg path,svg use,svg polygon,svg circle")) icon.replaceChildren(...nativeIcon.childNodes);
            else setIcon(icon, "pencil");
            if (nativeHeading) heading.replaceChildren(...nativeHeading.childNodes);
            else heading.textContent = label;
            measure();
            const at = c.metadata.split(/\s+/).find((t) => t.startsWith("at="))?.slice(3), identityState = plugin.componentIdentities?.state(this.path, at);
            admission.hidden = !identityState?.admitted && !identityState?.sourceChanged && (!identityState || identityState.home);
            if (!admission.hidden) {
              setIcon(admission, identityState?.sourceChanged ? "refresh-cw" : identityState?.admitted ? "library-big" : "files");
              admission.title = identityState?.sourceChanged ? identityState.ancestorChanges?.length ? identityState.ancestorChanges.map((c2) => `${c2.title} changed \xB7 ${c2.levels} ${c2.levels === 1 ? "level" : "levels"} up`).join("; ") + " \u2014 Compare" : "Source changed \u2014 Compare" : identityState?.admitted ? identityState?.home ? "In index" : "Copy from index" : "Copy";
              setTooltip(admission, admission.title, { placement: "top" });
              admission.classList.toggle("kl-source-changed", !!identityState?.sourceChanged);
              admission.classList.toggle("kl-source-copy", !!identityState && !identityState.home);
            }
          };
          state.renderHeading = renderHeading;
          void renderHeading();
          void render(item.body, body);
          const fold = () => {
            node.dataset.klViewFold = String(state.folded);
            body.hidden = state.folded;
            node.classList.toggle("is-collapsed", state.folded);
            arrow.setAttribute("aria-expanded", String(!state.folded));
            measure();
          };
          state.fold = fold;
          state.toggleFold = () => {
            state.folded = !state.folded;
            readingFolds.set(foldRoot, this.path, foldKey, state.folded);
            fold();
          };
          fold();
          const current = () => {
            const from = view.posAtDOM(node);
            const found = view.state.field(field).parsed.items.find((c) => c.from === from);
            if (!found || found.raw !== state.item.raw || conflict) throw Error("This callout changed. Reopen its editor.");
            return found;
          };
          const commit = async (patch) => {
            const c = current(), insert = model.replaceComponent(c, patch);
            if (insert === c.raw) return;
            let annotations;
            try {
              const commands = context.commands || require("@codemirror/commands");
              if (view.state.field(commands.historyField, false) !== void 0) annotations = commands.isolateHistory.of("full");
            } catch {
            }
            const presentation = Object.hasOwn(patch, "type") || Object.hasOwn(patch, "body") && model.presentationBody(patch.body) === model.presentationBody(c.body);
            if (!context.nested && plugin.componentIdentities) {
              const before = view.state.doc.toString(), proposed = before.slice(0, c.from) + insert + before.slice(c.to), after = require_component_reference_drafts().applyIdentityDrafts(proposed, referenceDrafts);
              const save = (effects) => plugin.componentIdentities.commit(view, before, after === proposed ? { from: c.from, to: c.to, insert } : require_component_identities().difference(before, after), presentation ? "presentation" : "edit", referenceDrafts.length > 0, effects);
              const foreign = referenceDrafts.flatMap((d) => d.foreign || []);
              if (foreign.length) await plugin.componentReferenceWrites.run(view, this.path, before, after, foreign, save);
              else await save([]);
              referenceDrafts.length = 0;
            } else view.dispatch({ changes: { from: c.from, to: c.to, insert }, userEvent: "input.callout", ...annotations ? { annotations } : {} });
            if (!editing) {
              const updated = view.state.field(field).parsed.items.find((item2) => item2.from === c.from);
              if (updated) view.dispatch({ selection: { anchor: updated.from, head: updated.to } });
              view.focus();
            }
          };
          const close = (focus = true) => {
            control?.unload();
            control = null;
            editing = false;
            editingPart = null;
            node.classList.remove("kl-component-editing");
            void renderHeading();
            void render(state.item.body, body);
            fold();
            if (focus) node.focus();
          };
          const edit = (part, point = null) => {
            if (editing) return;
            const selected = current();
            view.dispatch({ selection: { anchor: selected.from, head: selected.to } });
            plugin.componentCommandTarget = state;
            editing = true;
            editingPart = part;
            state.folded = false;
            fold();
            node.classList.add("kl-component-editing");
            const target = part === "title" ? heading : body;
            target.empty();
            control = owner.addChild(new Component2());
            const host = target.createDiv("kl-component-editor");
            let value = part === "title" ? state.item.title : state.item.body, editor;
            const studio = plugin.app.plugins.getPlugin("study-studio");
            if (!studio?.createWrittenEditor) {
              editing = false;
              new Notice2("Enable the updated Study Studio editor to edit callouts.");
              close();
              return;
            }
            const projectionCache = /* @__PURE__ */ new WeakMap();
            const project = (localDoc) => {
              if (projectionCache.has(localDoc)) return projectionCache.get(localDoc);
              const c = current(), parentText = view.state.doc.toString(), replacement = model.replaceComponent(c, { [part]: localDoc.toString() });
              const text = parentText.slice(0, c.from) + replacement + parentText.slice(c.to), snapshot = { toString: () => text };
              const source = context.project?.(snapshot) || { path: this.path, doc: snapshot, baseLine: 0 };
              const result = { ...source, baseLine: source.baseLine + view.state.doc.lineAt(c.from).number };
              projectionCache.set(localDoc, result);
              return result;
            };
            const nestedContext = { path: this.path, nested: true, part, referenceDrafts, commands: studio.writtenEditorCommands, project, finishParent: async () => {
              await apply(false);
              if (editing) throw Error("Resolve this callout draft before continuing.");
              await context.finishParent?.();
            } };
            editor = studio.createWrittenEditor(plugin.app, host, this.path, value, control, (next) => {
              value = next;
            }, (active) => {
              busy = active;
            }, part === "title" ? "Callout title" : "Callout body", {
              lists: true,
              toolbar: true,
              rich: true,
              keepMathRendered: true,
              compactBlocks: true,
              componentRanges: (source) => model.parseComponents(source).items,
              mathReferences: (input, q) => require_component_math_references().componentMathReferences(plugin, this.path, (value2) => project({ toString: () => value2 }).doc.toString(), input, q, (draft) => referenceDrafts.push(draft)),
              extensionsFactory: (cm) => componentExtension(plugin, cm, nestedContext)
            });
            const apply = async (focus = true) => {
              if (busy || finishing || !editing) return;
              try {
                finishing = true;
                await commit({ [part]: value });
                if (alive) {
                  if (focus) {
                    const updated = current();
                    view.dispatch({ selection: { anchor: updated.from, head: updated.to } });
                  }
                  close(focus);
                }
                if (focus) view.focus();
              } catch (error) {
                new Notice2(error.message);
              } finally {
                finishing = false;
              }
            };
            state.finishDraft = async () => {
              await apply(false);
              if (editing) throw Error("Resolve this callout draft before continuing.");
            };
            control.registerDomEvent(node, "focusout", (e) => {
              const destination = e.relatedTarget;
              if (destination && !node.contains(destination) && !destination.closest?.(".menu,.modal-container,.suggestion-container")) queueMicrotask(() => {
                if (alive && editing && !busy && !node.contains(doc.activeElement) && !doc.activeElement?.closest?.(".menu,.modal-container,.suggestion-container")) apply(false);
              });
            });
            control.registerDomEvent(doc, "pointerdown", (e) => {
              if (node.checkVisibility() && !node.contains(e.target) && !e.target.closest?.(".menu,.modal-container,.suggestion-container")) apply(false);
            }, true);
            control.registerDomEvent(host, "keydown", (e) => {
              if (e.target.closest?.(".kl-component-editor") !== host) return;
              if (e.key === "Tab" && part === "title" && !busy) {
                e.preventDefault();
                e.stopPropagation();
                void apply(false).then(() => {
                  if (alive && !editing && !conflict) edit("body");
                });
              } else if (e.key === "Enter" && (part === "title" || e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
                apply();
              } else if (e.key === "Escape" && !busy) {
                e.preventDefault();
                e.stopPropagation();
                apply();
              }
            }, true);
            if (point?.sourceOffset !== void 0) {
              editor.setValue(value, point.sourceOffset);
              editor.focus();
            } else if (point) editor.focusAt(point);
            else editor.focus();
            measure();
          };
          heading.onclick = (e) => {
            if (!editing) {
              e.stopPropagation();
              edit("title");
            }
          };
          node.addEventListener("mousedown", (e) => {
            if (editing || e.button !== 0 || e.target.closest("a,button,input,.callout-title-inner")) return;
            const c = current();
            e.preventDefault();
            view.dispatch({ selection: { anchor: c.from, head: c.to } });
            plugin.componentCommandTarget = state;
            view.focus();
          });
          body.ondblclick = (e) => {
            if (!editing && !e.target.closest("a,button,input")) {
              const point = { x: e.clientX, y: e.clientY }, walker = doc.createTreeWalker(e.target, 4), range = doc.createRange();
              let hit = null, best = Infinity;
              for (let t = walker.nextNode(); t; t = walker.nextNode()) {
                if (!t.textContent.trim() || t.parentElement?.closest("mjx-container")) continue;
                range.selectNodeContents(t);
                for (const rect of range.getClientRects()) {
                  const distance = Math.max(rect.left - point.x, 0, point.x - rect.right) + Math.max(rect.top - point.y, 0, point.y - rect.bottom) * 4;
                  if (distance < best) {
                    best = distance;
                    hit = t;
                  }
                }
              }
              if (hit) {
                const text = hit.textContent, source = state.item.body, first = source.indexOf(text);
                if (text.trim().length >= 1 && first >= 0 && source.indexOf(text, first + text.length) === -1) {
                  let offset = 0, distance = Infinity;
                  for (let i = 0; i < text.length; i++) {
                    range.setStart(hit, i);
                    range.setEnd(hit, i + 1);
                    for (const r of range.getClientRects()) {
                      const d = Math.max(r.left - point.x, 0, point.x - r.right) + Math.max(r.top - point.y, 0, point.y - r.bottom) * 4;
                      if (d < distance) {
                        distance = d;
                        offset = i + (point.x > (r.left + r.right) / 2 ? 1 : 0);
                      }
                    }
                  }
                  point.sourceOffset = first + offset;
                }
              }
              e.preventDefault();
              e.stopPropagation();
              edit("body", point);
            }
          };
          arrow.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (editing) return;
            state.toggleFold();
          };
          copy.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await doc.defaultView.navigator.clipboard.writeText(model.cleanContents(state.item.body));
          };
          node.addEventListener("keydown", (e) => {
            if (e.target === node && e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              edit(e.shiftKey ? "title" : "body");
            }
          });
          Object.assign(state, { edit, commit, current, copy: () => doc.defaultView.navigator.clipboard.writeText(model.cleanContents(state.item.body)) });
          node.addEventListener("contextmenu", (e) => {
            if (e.target.closest(".kl-component") !== node || editing) return;
            e.preventDefault();
            e.stopPropagation();
            const nested = e.target.closest(".callout");
            if (nested && nested !== node) {
              const identity = nested.dataset.calloutMetadata?.match(/[0-9a-f-]{36}\.(?:local|library)/i)?.[0];
              edit("body");
              doc.defaultView.requestAnimationFrame(() => {
                const child = [...node.querySelectorAll(".kl-component")].find((el) => el.dataset.klIdentity === identity)?._klState;
                if (child) plugin.componentActions?.menu(e, child);
              });
              return;
            }
            plugin.componentActions?.menu(e, state);
          });
          return node;
        }
        destroy(node) {
          node._klDispose?.();
        }
        ignoreEvent() {
          return true;
        }
      }
      const build = (parsed, state, foldOverride = null) => {
        if (!context.nested && !state.field(editorLivePreviewField, false)) return Decoration.none;
        const path2 = context.path || state.field(editorInfoField, false)?.file?.path || "";
        return Decoration.set(parsed.items.map((item) => Decoration.replace({ widget: new CalloutWidget(item, path2, foldOverride), block: true }).range(item.from, item.to)), true);
      };
      const field = StateField.define({
        create: (state) => {
          const parsed = model.parseComponents(state.doc);
          return { parsed, path: context.path || state.field(editorInfoField, false)?.file?.path || "", foldAll: null, decorations: build(parsed, state) };
        },
        update: (old, tr) => {
          const foldEffect = tr.effects.find((e) => e.is(refresh));
          const path2 = context.path || tr.state.field(editorInfoField, false)?.file?.path || "";
          const samePath = path2 === old.path;
          if (samePath && !tr.docChanged && !tr.reconfigured && !foldEffect && (context.nested || tr.startState.field(editorLivePreviewField, false) === tr.state.field(editorLivePreviewField, false))) return old;
          const changes = [];
          tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => changes.push({ fromA, toA, fromB, toB }));
          const measured = plugin.recordComponentTiming, start = measured ? performance.now() : 0;
          const parsed = tr.docChanged ? model.parseComponents(tr.newDoc, old.parsed, changes) : old.parsed;
          if (measured) measured("component-parse", performance.now() - start);
          const foldAll = foldEffect ? foldEffect.value : old.foldAll;
          const sameMode = context.nested || tr.startState.field(editorLivePreviewField, false) === tr.state.field(editorLivePreviewField, false);
          const mapped = samePath && tr.docChanged && parsed.unchanged && !tr.reconfigured && !foldEffect && sameMode;
          const decorations = mapped ? old.decorations.map(tr.changes) : build(parsed, tr.state, foldAll);
          if (measured) measured("component-state-total", performance.now() - start);
          return { parsed, path: path2, foldAll, decorations };
        },
        provide: (f) => [EditorView.decorations.from(f, (s) => s.decorations), EditorView.atomicRanges.of((v) => v.state.field(f).decorations)]
      });
      if (!context.nested) {
        plugin.registerEvent(plugin.app.vault.on("rename", (file, oldPath) => {
          labels.clear();
          const views = new Set([...owners].filter((s) => s.path === oldPath).map((s) => s.view));
          for (const view of views) {
            const value = view.state.field(field, false);
            if (value) view.dispatch({ effects: refresh.of(value.foldAll) });
          }
        }));
        plugin.foldComponentView = (view, value) => {
          const data = view?.state.field(field, false);
          if (data) {
            readingFolds.all(readingFolds.rootFor(view.dom) || view.dom, data.path, value);
            view.dispatch({ effects: refresh.of(value) });
            for (const owner of owners) if (owner.view === view) {
              owner.folded = value;
              owner.fold();
            }
          }
        };
        plugin.registerEvent(plugin.app.workspace.on("knowledge-library:callouts-changed", () => {
          labels.clear();
          for (const s of owners) s.renderHeading?.();
        }));
        plugin.registerEvent(plugin.app.workspace.on("knowledge-library:component-identities-changed", () => {
          labels.clear();
          for (const s of owners) s.renderHeading?.();
        }));
        plugin.componentOwners ??= /* @__PURE__ */ new Set();
        plugin.componentOwners.add(owners);
        plugin.register(() => {
          plugin.componentOwners.delete(owners);
          for (const s of owners) s.dispose();
          owners.clear();
        });
      }
      plugin.componentEditors ??= /* @__PURE__ */ new Map();
      const lifecycle = runtime.view.ViewPlugin.fromClass(class {
        constructor(view) {
          this.view = view;
          plugin.componentEditors.set(view.dom, { view, context, owners });
        }
        update(update) {
          if (update.docChanged) {
            const parsed = update.state.field(field).parsed;
            for (const owner of owners) if (owner.view === update.view) {
              const item = parsed.byKey.get(owner.item.key);
              if (item && item.raw === owner.item.raw) owner.item = item;
            }
          }
        }
        destroy() {
          plugin.componentEditors.delete(this.view.dom);
        }
      });
      return Prec.highest([field, lifecycle, EditorView.domEventHandlers({ keydown(event, view) {
        if (view.dom.ownerDocument.activeElement !== view.contentDOM || event.metaKey || event.ctrlKey || event.altKey) return false;
        const data = view.state.field(field), selection = view.state.selection.main, items = data.parsed.items;
        const selected = items.find((c) => c.from === selection.from && c.to === selection.to && !selection.empty);
        if (selected && event.key === "Enter") {
          const owner = [...owners].find((s) => s.view === view && s.item.from === selected.from);
          if (owner) {
            event.preventDefault();
            owner.edit(event.shiftKey ? "title" : "body");
            return true;
          }
        }
        if (selected && ["Backspace", "Delete"].includes(event.key)) {
          event.preventDefault();
          view.dispatch({ changes: { from: selected.from, to: selected.to, insert: "" }, selection: { anchor: selected.from }, userEvent: "delete.callout", annotations: (context.commands || require("@codemirror/commands")).isolateHistory.of("full") });
          return true;
        }
        if (selection.empty && !event.shiftKey) {
          const pos = selection.head, line = view.state.doc.lineAt(pos), forward = ["ArrowDown", "ArrowRight"].includes(event.key), backward = ["ArrowUp", "ArrowLeft"].includes(event.key);
          const item = forward ? items.find((c) => c.from === pos || event.key === "ArrowDown" && c.from === line.to + 1) : backward ? [...items].reverse().find((c) => c.to === pos || event.key === "ArrowUp" && c.to === line.from - 1) : null;
          if (item) {
            event.preventDefault();
            view.dispatch({ selection: { anchor: item.from, head: item.to }, scrollIntoView: true });
            plugin.componentCommandTarget = [...owners].find((s) => s.view === view && s.item.from === item.from) || null;
            return true;
          }
        }
        return false;
      } })]);
    }
    function registerCalloutComponent(plugin) {
      plugin.registerMarkdownPostProcessor((el, ctx) => {
        const callouts = [...el.matches?.(".callout") ? [el] : [], ...el.querySelectorAll(".callout")].filter((c) => !c.classList.contains("kl-component") && c.dataset.calloutMetadata?.match(/[0-9a-f-]{36}\.(local|library)/i));
        if (!callouts.length) return;
        const owner = new MarkdownRenderChild(el);
        ctx.addChild(owner);
        let alive = true;
        owner.register(() => {
          alive = false;
        });
        for (const c of callouts) {
          const title = c.querySelector(":scope>.callout-title"), occurrence = (c.dataset.calloutMetadata || "").split(/\s+/).find((t) => t.startsWith("at="))?.slice(3);
          if (title && occurrence) {
            c.classList.add("is-collapsible");
            c.dataset.klComponentReading = "true";
            let arrow = title.querySelector(":scope>.callout-fold");
            if (!arrow) {
              arrow = title.createDiv("callout-fold");
              setIcon(arrow, "chevron-down");
            }
            arrow.setAttribute("aria-label", "Toggle callout");
            arrow.setAttribute("role", "button");
            readingFolds.attach(c, readingFolds.rootFor(c, ctx.containerEl), ctx.sourcePath);
            owner.registerDomEvent(title, "click", (event) => {
              if (!c.closest(".markdown-preview-view") || event.target.closest("a,input,textarea,.kl-component-admission")) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              void plugin.componentActions?.foldReading(ctx.sourcePath, occurrence, c).catch((error) => new Notice2(error.message));
            }, true);
          }
          owner.registerDomEvent(c, "contextmenu", (event) => {
            if (event.target.closest?.(".callout") !== c || !c.closest(".markdown-preview-view")) return;
            const occurrence2 = (c.dataset.calloutMetadata || "").split(/\s+/).find((t) => t.startsWith("at="))?.slice(3);
            if (!occurrence2) return;
            event.preventDefault();
            event.stopPropagation();
            plugin.componentActions?.readingMenu(event, ctx.sourcePath, occurrence2, c);
          });
        }
        const refresh = async () => {
          await plugin.componentIdentities?.ensureState(ctx.sourcePath);
          if (!alive) return;
          for (const c of callouts) {
            const metadata = c.dataset.calloutMetadata || "", at = metadata.split(/\s+/).find((t) => t.startsWith("at="))?.slice(3), state = plugin.componentIdentities?.state(ctx.sourcePath, at), title = c.querySelector(":scope>.callout-title");
            if (!title) continue;
            let badge = title.querySelector(":scope>.kl-component-admission");
            if (!badge) {
              badge = title.createEl("span", { cls: "kl-component-admission" });
              owner.registerDomEvent(badge, "click", async (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (!plugin.componentIdentities?.state(ctx.sourcePath, at)?.sourceChanged) return;
                if (c.closest(".kl-component-editing")) {
                  new Notice2("Finish this callout edit before syncing its source.");
                  return;
                }
                const view = plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).find((v) => v.file?.path === ctx.sourcePath && v.editor?.cm);
                if (!view) {
                  new Notice2("Open this note to sync its callout.");
                  return;
                }
                try {
                  await plugin.componentActions.compareAt(ctx.sourcePath, at, view.getMode() === "preview" ? null : view.editor.cm);
                } catch (error) {
                  new Notice2(error.message);
                }
              }, true);
            }
            badge.hidden = !state?.admitted && !state?.sourceChanged && (!state || state.home);
            if (!badge.hidden) {
              setIcon(badge, state?.sourceChanged ? "refresh-cw" : state?.admitted ? "library-big" : "files");
              badge.title = state?.sourceChanged ? state.ancestorChanges?.length ? state.ancestorChanges.map((c2) => `${c2.title} changed \xB7 ${c2.levels} ${c2.levels === 1 ? "level" : "levels"} up`).join("; ") + " \u2014 Compare" : "Source changed \u2014 Compare" : state?.admitted ? state?.home ? "In index" : "Copy from index" : "Copy";
              setTooltip(badge, badge.title, { placement: "top" });
              badge.classList.toggle("kl-source-changed", !!state?.sourceChanged);
              badge.classList.toggle("kl-source-copy", !!state && !state.home);
            }
          }
        };
        owner.registerEvent(plugin.app.workspace.on("knowledge-library:component-identities-changed", () => {
          void refresh();
        }));
        void refresh();
      });
      const readingRoots = /* @__PURE__ */ new WeakSet();
      const prepareReadingRoot = (root) => {
        if (readingRoots.has(root)) return;
        readingRoots.add(root);
        plugin.registerDomEvent(root, "click", (event) => {
          if (!root.classList.contains("kl-reading-fold-all") && !root.classList.contains("kl-reading-unfold-all")) return;
          const title = event.target.closest?.(".callout-title");
          if (!title || event.target.closest("a,input,textarea,.kl-component-admission") || !root.contains(title)) return;
          const callout = title.closest(".callout");
          if (!callout?.classList.contains("is-collapsible")) return;
          if (callout.dataset.klComponentReading) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const folded = callout.dataset.klReadingFold === void 0 ? root.classList.contains("kl-reading-fold-all") : callout.dataset.klReadingFold === "true";
          callout.dataset.klReadingFold = String(!folded);
          callout.classList.toggle("is-collapsed", !folded);
        }, true);
      };
      plugin.registerEvent(plugin.app.workspace.on("file-open", () => {
        for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
          const view = leaf.view, root = readingFolds.rootFor(view.containerEl) || view.previewMode?.containerEl;
          if (root?.dataset.klFoldPath && root.dataset.klFoldPath !== view.file?.path) {
            root.classList.remove("kl-reading-fold-all", "kl-reading-unfold-all");
            delete root.dataset.klFoldPath;
          }
        }
      }));
      plugin.registerEditorExtension(componentExtension(plugin, { state: require("@codemirror/state"), view: require("@codemirror/view") }));
      for (const [id, name, folded, key] of [["fold-all", "Fold all callouts", true, "["], ["unfold-all", "Unfold all callouts", false, "]"]]) plugin.addCommand({ id, name, hotkeys: [{ modifiers: ["Mod", "Alt"], key }], callback: () => {
        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView2);
        if (!view) return;
        if (view.getMode() === "preview") {
          const root = readingFolds.rootFor(view.previewMode.containerEl) || view.previewMode.containerEl;
          prepareReadingRoot(root);
          for (const c of root.querySelectorAll("[data-kl-reading-fold]:not([data-kl-component-reading])")) delete c.dataset.klReadingFold;
          readingFolds.all(root, view.file?.path || "", folded);
        } else plugin.foldComponentView?.(view.editor?.cm, folded);
      } });
    }
    module2.exports = { componentExtension, registerCalloutComponent };
  }
});

// plugin/component-entry-editor.js
var require_component_entry_editor = __commonJS({
  "plugin/component-entry-editor.js"(exports2, module2) {
    var { Modal: Modal2, Component: Component2, MarkdownRenderer: MarkdownRenderer2, setIcon } = require("obsidian");
    var { randomUUID } = require("node:crypto");
    var { componentExtension } = require_callout_component();
    var model = require_component_model();
    var EntryEditor = class extends Modal2 {
      constructor(plugin, id) {
        super(plugin.app);
        this.plugin = plugin;
        this.identity = id;
        this.saving = null;
        this.ready = false;
        this.busy = false;
      }
      async request(op, args) {
        await this.plugin.admission.ready;
        return this.plugin.admission.request(op, args);
      }
      async onOpen() {
        this.titleEl.setText("Edit index entry");
        this.modalEl.addClass("kl-entry-editor");
        this.closeResize = require_resize_modal().attachResize(this.modalEl, this.plugin.settings.entryEditorWindow, (size) => {
          this.plugin.settings.entryEditorWindow = size;
          void this.plugin.persist();
        });
        this.status = this.contentEl.createDiv({ cls: "kl-status", text: "Opening original\u2026" });
        try {
          const data = await this.request("live-component-edit-context", { id: this.identity });
          this.base = data;
          this.title = data.title;
          this.body = data.body;
          this.saved = JSON.stringify([this.title, this.body]);
          const studio = this.app.plugins.getPlugin("study-studio");
          if (!studio?.createWrittenEditor) throw Error("Enable Study Studio to edit this entry.");
          this.status.setText("Changes save to the original and update untouched copies.");
          this.owner = new Component2();
          this.owner.load();
          const preview = this.contentEl.createDiv("kl-preview kl-entry-editor-preview");
          preview.style.setProperty("--kl-color", require_entry_palette()[data.kind] || "175,180,194");
          const card = preview.createDiv("callout kl-component kl-entry-editor-card");
          card.dataset.callout = data.kind;
          const header = card.createDiv("callout-title"), icon = header.createDiv("callout-icon");
          const stage = this.contentEl.ownerDocument.createElement("div");
          await MarkdownRenderer2.render(this.app, `> [!${data.kind}] ${data.title}`, stage, data.path, this.owner);
          const nativeIcon = stage.querySelector(".callout-icon");
          if (nativeIcon?.querySelector("svg path,svg use,svg polygon,svg circle")) icon.replaceChildren(...nativeIcon.childNodes);
          else setIcon(icon, "pencil");
          const heading = header.createDiv("callout-title-inner kl-entry-editor-heading");
          const typeWord = require_filter_model().labelKind(data.kind).replaceAll("-", " ");
          const typeLabel2 = heading.createSpan({ text: typeWord + (this.title.trim() ? ":" : "") });
          const titleHost = heading.createDiv("kl-component-editor kl-entry-editor-title");
          const bodyHost = card.createDiv("callout-content markdown-rendered kl-component-editor kl-entry-editor-body");
          const source = this.contentEl.createDiv({ cls: "kl-entry-editor-source", text: data.path });
          source.title = data.path;
          this.contentEl.append(this.status);
          this.titleEditor = studio.createWrittenEditor(this.app, titleHost, data.path, this.title, this.owner, (next) => {
            this.title = next;
            typeLabel2.setText(typeWord + (next.trim() ? ":" : ""));
            this.changed();
          }, (busy) => {
            this.busy = busy;
          }, "Entry title", { rich: true, keepMathRendered: true, compactBlocks: true, toolbar: false });
          const context = { path: data.path, nested: true, commands: studio.writtenEditorCommands };
          this.bodyEditor = studio.createWrittenEditor(this.app, bodyHost, data.path, this.body, this.owner, (next) => {
            this.body = next;
            this.changed();
          }, (busy) => {
            this.busy = busy;
          }, "Entry body", {
            lists: true,
            toolbar: false,
            rich: true,
            keepMathRendered: true,
            compactBlocks: true,
            componentRanges: (source2) => model.parseComponents(source2).items,
            extensionsFactory: (cm) => componentExtension(this.plugin, cm, context)
          });
          titleHost.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              this.bodyEditor.focus();
            } else if (e.key === "Tab") {
              e.preventDefault();
              this.bodyEditor.focus();
            }
          }, true);
          this.contentEl.addEventListener("focusout", () => {
            if (this.ready) void this.save().catch((e) => this.failure(e));
          });
          this.ready = true;
          this.bodyEditor.focus();
        } catch (error) {
          this.status.setText(error.message);
        }
      }
      changed() {
        if (!this.ready) return;
        clearTimeout(this.timer);
        this.status.setText("Editing\u2026");
        this.timer = setTimeout(() => {
          void this.save().catch((e) => this.failure(e));
        }, 700);
      }
      failure(error) {
        this.status.setText(error.message + " Your draft is kept here.");
      }
      async save() {
        clearTimeout(this.timer);
        if (!this.ready || this.busy) return;
        if (this.saving) {
          await this.saving;
          return this.save();
        }
        const value = JSON.stringify([this.title, this.body]);
        if (value === this.saved) {
          this.status.setText("Saved");
          return;
        }
        if (/[\r\n]/.test(this.title)) throw Error("The title must be one line.");
        const title = this.title, body = this.body;
        this.saving = (async () => {
          this.status.setText("Saving to original\u2026");
          const job = this.pendingJob || await this.request("live-component-edit-enqueue", { id: this.identity, revision: this.base.revision, sourceHash: this.base.sourceHash, title, body, key: randomUUID() });
          job.value ??= value;
          this.pendingJob = job;
          let result = job;
          if (result.waiting) this.status.setText(result.waiting);
          for (let attempt = 0; result.state !== "complete" && attempt < 30; attempt++) {
            await this.plugin.componentIdentities.applyEntryJobs();
            await new Promise((resolve) => setTimeout(resolve, 300));
            result = await this.request("live-component-edit-status", { key: job.key });
            if (result.waiting) this.status.setText(result.waiting);
            if (result.state === "conflict") {
              this.pendingJob = null;
              throw Error(result.error);
            }
          }
          if (result.state !== "complete") throw Error(result.waiting || "The original is waiting to finish saving.");
          this.pendingJob = null;
          this.base = { ...this.base, revision: result.resultRevision, sourceHash: result.resultHash };
          this.saved = job.value;
          this.status.setText("Saved");
          await this.plugin.componentIdentities.replayMembership();
        })();
        try {
          await this.saving;
        } finally {
          this.saving = null;
        }
        if (JSON.stringify([this.title, this.body]) !== this.saved) return this.save();
      }
      close() {
        if (this.closing) return;
        if (!this.ready) {
          super.close();
          return;
        }
        this.closing = true;
        void this.save().then(() => {
          if (this.busy) {
            this.closing = false;
            return;
          }
          super.close();
        }).catch((error) => {
          this.closing = false;
          this.failure(error);
        });
      }
      onClose() {
        clearTimeout(this.timer);
        this.owner?.unload();
        this.closeResize?.();
      }
    };
    module2.exports = { EntryEditor };
  }
});

// plugin/shortcut-slots.js
var require_shortcut_slots = __commonJS({
  "plugin/shortcut-slots.js"(exports2, module2) {
    var ShortcutSlots = class {
      constructor(scope) {
        this.scope = scope;
        this.slots = /* @__PURE__ */ new Map();
      }
      bind(owner, modifiers, key, callback) {
        const id = JSON.stringify([[...modifiers].sort(), key]);
        let slot = this.slots.get(id);
        if (!slot) {
          slot = { owner: null, callback: null };
          slot.handler = this.scope.register(modifiers, key, (event) => {
            const fn = slot.callback;
            if (!fn) return true;
            if (event?.repeat) return false;
            return fn(event);
          });
          this.slots.set(id, slot);
        }
        slot.owner = owner;
        slot.callback = callback;
      }
      release(owner) {
        for (const slot of this.slots.values()) if (slot.owner === owner) {
          slot.owner = null;
          slot.callback = null;
        }
      }
      close() {
        for (const slot of this.slots.values()) this.scope.unregister(slot.handler);
        this.slots.clear();
      }
    };
    module2.exports = ShortcutSlots;
  }
});

// plugin/typing-latency.js
var require_typing_latency = __commonJS({
  "plugin/typing-latency.js"(exports2, module2) {
    var fs2 = require("fs");
    var path2 = require("path");
    function stats(values) {
      const a = values.filter(Number.isFinite).sort((x, y) => x - y);
      return { count: a.length, p50: a.length ? a[Math.ceil(a.length * 0.5) - 1] : null, p95: a.length ? a[Math.ceil(a.length * 0.95) - 1] : null, max: a.length ? a[a.length - 1] : null };
    }
    function summarize(events, frames, tasks) {
      return { eventTiming: { inputLatency: stats(events.map((e) => e.duration)), processing: stats(events.map((e) => e.processingEnd - e.processingStart)), inputDelay: stats(events.map((e) => e.processingStart - e.startTime)), presentationDelay: stats(events.map((e) => Math.max(0, e.startTime + e.duration - e.processingEnd))) }, frameEstimate: { inputLatency: stats(frames.map((e) => e.delay)), keydown: stats(frames.filter((e) => e.type === "keydown").map((e) => e.delay)), input: stats(frames.filter((e) => e.type === "input").map((e) => e.delay)) }, longestTask: tasks.length ? Math.max(...tasks.map((e) => e.duration)) : 0, tasksOver50ms: tasks.filter((e) => e.duration > 50).length };
    }
    function isLabVault(root) {
      if (typeof root !== "string") return false;
      const home = require("os").homedir(), allowed = [path2.join(home, "ObsidianVaults", "knowledge_library_lab"), path2.join(home, "Projects", "cross-vault-library-lab", "identity-replica", "knowledge_library_lab")];
      try {
        return allowed.includes(fs2.realpathSync(root));
      } catch {
        return false;
      }
    }
    function register(plugin, Notice2, MarkdownView2, output) {
      if (plugin.production || !isLabVault(plugin.app?.vault?.adapter?.getBasePath?.())) return;
      let session = null;
      const active = () => plugin.app.workspace.getActiveViewOfType(MarkdownView2);
      const stop = async () => {
        if (!session) {
          new Notice2("No typing measurement is running.");
          return;
        }
        const s = session;
        session = null;
        delete plugin.recordComponentTiming;
        s.detach();
        const report = { schema: 1, note: s.note, started: s.started, ended: (/* @__PURE__ */ new Date()).toISOString(), elapsedMs: s.win.performance.now() - s.start, supported: s.supported, ...summarize(s.events, s.frames, s.tasks), componentWork: Object.fromEntries(Object.entries(s.componentWork).map(([key, values]) => [key, stats(values)])), samples: { events: s.events, frames: s.frames, tasks: s.tasks }, limitations: "Event Timing is thresholded at 16 ms and durations quantized by Chromium. Frame estimates include every captured keydown/input through the next animation frame; they are not exact presentation timings. Compare matched baseline and component runs; do not use thresholded-only p95 as proof of sub-5 ms overhead.", dropped: s.dropped };
        const filename = "acceptance-latency-" + path2.basename(s.note, ".md").replace(/[^A-Za-z0-9_-]+/g, "-") + ".json";
        try {
          await fs2.promises.mkdir(output, { recursive: true });
          const dest = path2.join(output, filename);
          await fs2.promises.writeFile(dest + ".tmp", JSON.stringify(report, null, 2));
          await fs2.promises.rename(dest + ".tmp", dest);
          const st = report.frameEstimate.inputLatency;
          new Notice2("Typing frame estimate: p50 " + fmt(st.p50) + ", p95 " + fmt(st.p95) + ", max " + fmt(st.max) + "; longest task " + fmt(report.longestTask) + ", >50 ms: " + report.tasksOver50ms + ". Saved " + filename, 15e3);
        } catch (e) {
          new Notice2("Typing report could not be saved: " + e.message, 15e3);
        }
      };
      plugin.addCommand({ id: "measure-typing-latency", name: "Knowledge Library: Measure typing latency", callback: () => {
        if (session) {
          new Notice2("Typing measurement is already running. Use Stop typing latency measurement.");
          return;
        }
        const view = active();
        if (!view?.file) {
          new Notice2("Open the test note first.");
          return;
        }
        const win = view.containerEl.ownerDocument.defaultView;
        const s = { win, note: view.file.path, started: (/* @__PURE__ */ new Date()).toISOString(), start: win.performance.now(), events: [], frames: [], tasks: [], observers: [], raf: /* @__PURE__ */ new Set(), supported: win.PerformanceObserver?.supportedEntryTypes || [], dropped: 0, componentWork: {} };
        const add = (a, v) => {
          if (a.length < 1e4) a.push(v);
          else s.dropped++;
        };
        const targetOK = (t) => !!t?.closest?.(".cm-editor, .math-studio-host") && active()?.file?.path === s.note;
        const record = (e) => {
          if (!e.isTrusted || !targetOK(e.target)) return;
          const at = win.performance.now(), stamp = e.timeStamp > 1e12 ? e.timeStamp - win.performance.timeOrigin : e.timeStamp, start = Number.isFinite(stamp) && stamp <= at && at - stamp < 6e4 ? stamp : at;
          const id = win.requestAnimationFrame(() => {
            s.raf.delete(id);
            add(s.frames, { type: e.type, delay: win.performance.now() - start, dispatchDelay: at - start });
          });
          s.raf.add(id);
        };
        const observe = (type, receive, extra = {}) => {
          if (!s.supported.includes(type)) return;
          const ob = new win.PerformanceObserver((list) => list.getEntries().forEach(receive));
          ob.observe({ type, buffered: false, ...extra });
          s.observers.push(ob);
        };
        observe("event", (e) => {
          if ((e.name === "keydown" || e.name === "input") && e.startTime >= s.start && targetOK(e.target)) add(s.events, { name: e.name, startTime: e.startTime, processingStart: e.processingStart, processingEnd: e.processingEnd, duration: e.duration, interactionId: e.interactionId });
        }, { durationThreshold: 16 });
        observe("longtask", (e) => {
          if (e.startTime >= s.start) add(s.tasks, { startTime: e.startTime, duration: e.duration });
        });
        plugin.recordComponentTiming = (name, ms) => add(s.componentWork[name] ??= [], ms);
        win.document.addEventListener("keydown", record, true);
        win.document.addEventListener("input", record, true);
        s.detach = () => {
          win.document.removeEventListener("keydown", record, true);
          win.document.removeEventListener("input", record, true);
          for (const ob of s.observers) ob.disconnect();
          for (const id of s.raf) win.cancelAnimationFrame(id);
        };
        session = s;
        new Notice2("Measuring typing in " + path2.basename(s.note) + ". Type normally, then run Stop typing latency measurement.", 8e3);
      } });
      plugin.addCommand({ id: "stop-typing-latency", name: "Knowledge Library: Stop typing latency measurement", callback: stop });
      plugin.register(() => {
        delete plugin.recordComponentTiming;
        if (session) {
          session.detach();
          session = null;
        }
      });
    }
    var fmt = (n) => n == null ? "n/a" : n.toFixed(2) + " ms";
    module2.exports = { register, stats, summarize, isLabVault };
  }
});

// plugin/document-claim.js
var require_document_claim = __commonJS({
  "plugin/document-claim.js"(exports2, module2) {
    function readClaim(doc) {
      const first = doc.line(1), opening = first.text.replace(/^\uFEFF/, "");
      if (opening !== "---") return { documentId: null, valid: true, end: first.to };
      const keys = [];
      let end = first.to, closed = false;
      for (let i = 2; i <= Math.min(doc.lines, 200); i++) {
        const line = doc.line(i);
        end = line.to;
        if (/^(---|\.\.\.)[ \t]*$/.test(line.text)) {
          closed = true;
          break;
        }
        if (/^kl-doc:/.test(line.text)) keys.push(line.text);
      }
      if (!closed) return { valid: false, end, reason: "Finish note properties before linking (up to 200 lines)." };
      if (!keys.length) return { documentId: null, valid: true, end };
      const match = /^kl-doc:[ \t]*['"]?([A-Za-z0-9-]{1,80})['"]?[ \t]*$/.exec(keys[0]);
      return keys.length === 1 && match && match[1] !== "lib" ? { documentId: match[1], valid: true, end } : { valid: false, end, reason: "Document identity property is invalid or duplicated." };
    }
    function readTextClaim(text) {
      const lines = [];
      let from = 0;
      for (let n = 0; n < 200; n++) {
        const next = text.indexOf("\n", from), to = next < 0 ? text.length : next;
        lines.push({ text: text.slice(from, to).replace(/\r$/, ""), to });
        if (next < 0 || n === 0 && lines[0].text.replace(/^\uFEFF/, "") !== "---" || n > 0 && /^(---|\.\.\.)[ \t]*$/.test(lines[n].text)) break;
        from = next + 1;
      }
      return readClaim({ lines: lines.length, line: (n) => lines[n - 1] });
    }
    module2.exports = { readClaim, readTextClaim };
  }
});

// plugin/editor-claims.js
var require_editor_claims = __commonJS({
  "plugin/editor-claims.js"(exports2, module2) {
    var { StateField } = require("@codemirror/state");
    var { ViewPlugin } = require("@codemirror/view");
    var { editorInfoField } = require("obsidian");
    var { readClaim } = require_document_claim();
    function updateClaim(value, tr) {
      if (!tr.docChanged) return value;
      let touched = false;
      tr.changes.iterChangedRanges((from, to) => {
        if (from <= value.end) touched = true;
      });
      return touched ? readClaim(tr.newDoc) : value;
    }
    function registerEditorClaims(plugin) {
      const views = /* @__PURE__ */ new Map(), timers = /* @__PURE__ */ new Map();
      plugin.editorClaimViews = views;
      const announce = (file, immediate = true) => {
        clearTimeout(timers.get(file.path));
        timers.delete(file.path);
        if (immediate) plugin.documentFeed?.changed(file);
        else timers.set(file.path, setTimeout(() => {
          timers.delete(file.path);
          plugin.documentFeed?.changed(file);
        }, 300));
      };
      const field = StateField.define({ create: (state) => readClaim(state.doc), update: updateClaim });
      const publish = (view, immediate = true) => {
        const file = view.state.field(editorInfoField, false)?.file, old = views.get(view);
        const claim = view.state.field(field, false);
        if (!file || !claim) {
          if (old) {
            views.delete(view);
            announce({ path: old.path });
          }
          return;
        }
        const next = { path: file.path, ...claim };
        views.set(view, next);
        if (!old || old.path !== next.path || old.documentId !== next.documentId || old.valid !== next.valid) {
          if (old && old.path !== next.path) announce({ path: old.path });
          announce(file, immediate);
        }
      };
      const observer = ViewPlugin.fromClass(class {
        constructor(view) {
          this.view = view;
          publish(view);
        }
        update(update) {
          if (update.docChanged || views.get(this.view)?.path !== update.state.field(editorInfoField, false)?.file?.path) publish(this.view, update.transactions.some((tr) => tr.isUserEvent("undo") || tr.isUserEvent("redo") || tr.isUserEvent("input.reference")));
        }
        destroy() {
          const old = views.get(this.view);
          views.delete(this.view);
          if (old) announce({ path: old.path });
        }
      });
      plugin.editorClaim = (path2) => {
        let result;
        for (const [view, row] of views) if (view.state.field(editorInfoField, false)?.file?.path === path2) {
          if (!row.valid) return row;
          if (result && result.documentId !== row.documentId) return { valid: false, reason: "Open editors disagree about this document identity." };
          result = row;
        }
        return result;
      };
      plugin.registerEditorExtension([field, observer]);
      plugin.register(() => {
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
        views.clear();
      });
    }
    module2.exports = { registerEditorClaims, readClaim, updateClaim };
  }
});

// plugin/reference-resolver.js
var require_reference_resolver = __commonJS({
  "plugin/reference-resolver.js"(exports2, module2) {
    var ReferenceResolver = class {
      constructor(request, { delay = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id), onIssue = () => {
      } } = {}) {
        this.request = request;
        this.delay = delay;
        this.cancel = cancel;
        this.onIssue = onIssue;
        this.failures = 0;
        this.listeners = /* @__PURE__ */ new Set();
        this.cache = /* @__PURE__ */ new Map();
        this.editors = /* @__PURE__ */ new WeakMap();
        this.editorRows = /* @__PURE__ */ new Map();
        this.state = null;
        this.epoch = 0;
        this.closed = false;
        this.dirty = false;
      }
      subscribe(listener) {
        this.listeners.add(listener);
        if (this.state) listener(this.state, this.epoch);
        this.poke();
        return () => this.listeners.delete(listener);
      }
      invalidate() {
        this.cache.clear();
        this.epoch++;
        this.dirty = true;
        this.poke();
      }
      poke(backlog = false) {
        if (this.closed || !this.listeners.size) return;
        this.again = true;
        const wait = backlog ? 1e3 : 150;
        if (this.timer && wait < this.timerWait) {
          this.cancel(this.timer);
          this.timer = null;
        }
        if (this.timer || this.running) return;
        this.timerWait = wait;
        this.timer = this.delay(() => {
          this.timer = null;
          this.check();
        }, wait);
      }
      async check() {
        if (this.closed || this.running || !this.listeners.size) return;
        this.running = true;
        this.again = false;
        try {
          const state = await this.request("live-reference-state", {});
          if (this.closed) return;
          const changed = JSON.stringify(state) !== JSON.stringify(this.state);
          if (changed) {
            this.state = state;
            this.cache.clear();
            this.epoch++;
          }
          if (changed || this.dirty) {
            this.dirty = false;
            for (const listener of this.listeners) listener(state, this.epoch);
          }
          this.failures = 0;
          this.onIssue(null);
        } catch (error) {
          this.failed(error);
        } finally {
          this.running = false;
          if (this.again) this.poke(true);
        }
      }
      failed(error) {
        if (this.closed || !this.listeners.size) return;
        this.dirty = true;
        this.failures++;
        if (this.failures > 1) this.onIssue(error.message);
        if (!this.retryTimer) this.retryTimer = this.delay(() => {
          this.retryTimer = null;
          this.poke();
        }, [1e3, 5e3, 3e4][Math.min(this.failures - 1, 2)]);
      }
      resetEditors() {
        this.editors = /* @__PURE__ */ new WeakMap();
        this.editorRows.clear();
        this.editorGeneration = (this.editorGeneration || 0) + 1;
      }
      touchEditor(row, doc) {
        this.editorRows.delete(row);
        this.editorRows.set(row, new WeakRef(doc));
        const siblings = [...this.editorRows].filter(([other]) => other.path === row.path);
        for (const [old, ref] of siblings.slice(0, -2)) {
          this.editorRows.delete(old);
          const source = ref.deref();
          if (source && this.editors.get(source) === old) this.editors.delete(source);
        }
        while (this.editorRows.size > 8) {
          const [old, ref] = this.editorRows.entries().next().value;
          this.editorRows.delete(old);
          const source = ref.deref();
          if (source && this.editors.get(source) === old) this.editors.delete(source);
        }
      }
      editorKey(snapshot) {
        return JSON.stringify([snapshot.path, this.state?.policy, this.state?.registry, this.editorGeneration]);
      }
      peekEditor(snapshot) {
        const row = this.editors.get(snapshot.doc);
        if (row?.key !== this.editorKey(snapshot)) return null;
        this.touchEditor(row, snapshot.doc);
        return row;
      }
      async editor(snapshot, targets = [], calloutLines = [], outline = false) {
        if (this.closed) throw Error("Reference provider is closed");
        const key = this.editorKey(snapshot);
        let row = this.editors.get(snapshot.doc);
        if (!row || row.key !== key) {
          row = { key, path: snapshot.path, targets: {}, callouts: {}, full: false };
          this.editors.set(snapshot.doc, row);
        }
        this.touchEditor(row, snapshot.doc);
        while (row.running) await row.running.catch(() => {
        });
        if (this.closed) throw Error("Reference provider is closed");
        if (row.limit) throw row.limit;
        const missing = targets.filter((t) => !(t in row.targets)), lines = calloutLines.filter((n) => !row.full && !(n in row.callouts));
        const fetch = async () => {
          let response, reuploaded = false;
          for (; ; ) {
            let source;
            if (!row.token) {
              const failLimit = () => {
                row.limit = Object.assign(new Error("This note exceeds the 8 MiB UTF-8 editor snapshot limit."), { code: "projection-limit", retryable: false });
                throw row.limit;
              };
              if (snapshot.doc.length > 8 * 1024 * 1024) failLimit();
              const value = snapshot.text();
              source = value && typeof value.then === "function" ? await value : value;
              if (typeof source !== "string") throw Object.assign(new Error("The editor text callback must return a string."), { retryable: false });
              if (source.length > 8 * 1024 * 1024 || source.length > 8 * 1024 * 1024 / 3 && new TextEncoder().encode(source).length > 8 * 1024 * 1024) failLimit();
            }
            response = await this.request("live-editor-reference-targets", {
              path: snapshot.path,
              targets: missing,
              ...lines.length ? { calloutLines: lines } : {},
              ...row.token ? { snapshotToken: row.token } : { text: source },
              ...outline && !row.full ? { includeCallouts: true } : {}
            });
            if (!response.issueCode) break;
            if (row.token && !reuploaded && ["snapshot-evicted", "policy-changed", "identity-changed"].includes(response.issueCode)) {
              reuploaded = true;
              row.token = null;
              continue;
            }
            row.token = null;
            const error = Object.assign(new Error(response.issue || "Editor projection unavailable"), { code: response.issueCode, retryable: false });
            if (response.issueCode === "projection-limit") row.limit = error;
            throw error;
          }
          row.token = response.snapshotToken;
          row.sourceHash = response.sourceHash;
          row.outlineIssue = response.outlineIssue;
          Object.assign(row.targets, response.targets);
          if (response.callouts) Object.assign(row.callouts, response.callouts);
          if (response.calloutList) {
            row.full = true;
            row.calloutList = response.calloutList;
            row.callouts = Object.fromEntries(response.calloutList.map((o) => [o.line, o]));
          }
          for (const [values, active, bound] of [[row.targets, targets, 2048], [row.callouts, calloutLines.map(String), row.full ? 1e4 : 2048]]) {
            const keep = new Set(active);
            let extra = Object.keys(values).length - bound;
            for (const k of Object.keys(values)) if (extra > 0 && !keep.has(k)) {
              delete values[k];
              extra--;
            }
          }
        };
        if (missing.length || lines.length || outline && !row.full && !row.outlineIssue) {
          const pending = row.running = fetch();
          try {
            await pending;
          } finally {
            if (row.running === pending) row.running = null;
          }
        }
        return {
          targets: Object.fromEntries(targets.map((t) => [t, row.targets[t]])),
          callouts: Object.fromEntries(calloutLines.map((n) => [n, row.callouts[n] || null])),
          calloutList: row.calloutList,
          outlineIssue: row.outlineIssue,
          sourceHash: row.sourceHash
        };
      }
      async resolve(path2, targets) {
        if (this.closed) return {};
        if (targets.length > 256) throw Error("At most 256 visible targets per request");
        const epoch = this.epoch, result = {}, missing = [];
        for (const target of new Set(targets)) {
          const key = JSON.stringify([path2, target]);
          if (this.cache.has(key)) {
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            result[target] = value;
          } else missing.push(target);
        }
        if (missing.length) {
          const response = await this.request("live-reference-targets", { path: path2, targets: missing });
          for (const target of missing) {
            result[target] = response.targets[target];
            if (!this.closed && epoch === this.epoch && !result[target]?.issue) {
              this.cache.set(JSON.stringify([path2, target]), result[target]);
              while (this.cache.size > 2048) this.cache.delete(this.cache.keys().next().value);
            }
          }
        }
        return result;
      }
      close() {
        this.closed = true;
        this.cancel(this.timer);
        this.cancel(this.retryTimer);
        this.listeners.clear();
        this.cache.clear();
        this.editors = /* @__PURE__ */ new WeakMap();
        this.editorRows.clear();
      }
    };
    var ReferenceConsumer = class {
      constructor(resolver, onResult, { delay = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id) } = {}) {
        this.resolver = resolver;
        this.onResult = onResult;
        this.delay = delay;
        this.cancel = cancel;
        this.serial = 0;
        this.closed = false;
        this.overlay = null;
        this.unsubscribe = resolver.subscribe((state, epoch, error) => {
          this.state = state;
          if (error) {
            this.onResult(null, error);
            return;
          }
          this.schedule();
        });
      }
      update(snapshot) {
        this.snapshot = snapshot;
        this.serial++;
        this.schedule();
      }
      schedule() {
        if (this.closed || !this.snapshot) return;
        this.cancel(this.timer);
        this.timer = this.delay(() => {
          this.timer = null;
          this.run();
        }, 150);
      }
      async run() {
        if (this.closed || this.running || !this.snapshot) return;
        this.running = true;
        const snapshot = this.snapshot, ticket = this.serial, epoch = this.resolver.epoch;
        try {
          if (new Set(snapshot.targets).size > 256) this.resolver.onIssue("More than 256 references are visible; narrow the viewport to update the remaining labels.");
          const targets = [...new Set(snapshot.targets)].slice(0, 256), key = [snapshot.path, this.state?.policy, this.state?.registry, this.resolver.editorGeneration].join("\n");
          if (!this.overlay || this.overlay.doc !== snapshot.doc || this.overlay.key !== key) this.overlay = { doc: snapshot.doc, key, targets: {}, callouts: {} };
          if (this.overlay.failure) throw this.overlay.failure;
          const overlay = this.overlay, own = targets.filter((t) => (t.startsWith("lib.") || !t.includes(".") || snapshot.documentId && t.startsWith(snapshot.documentId + ".") && !t.startsWith("lib.")) && !(t in overlay.targets));
          const lines = [...new Set(snapshot.calloutLines || [])].slice(0, 256), missingLines = lines.filter((n) => !(n in overlay.callouts));
          if ((own.length || missingLines.length) && snapshot.text) {
            const response = await this.resolver.editor(snapshot, own, missingLines);
            Object.assign(overlay.targets, response.targets);
            if (response.callouts) for (const line of missingLines) overlay.callouts[line] = response.callouts[line] || null;
            for (const [values, active] of [[overlay.targets, targets], [overlay.callouts, lines.map(String)]]) {
              const keep = new Set(active), keys = Object.keys(values);
              let extra = keys.length - 2048;
              for (const key2 of keys) if (extra > 0 && !keep.has(key2)) {
                delete values[key2];
                extra--;
              }
            }
          }
          const foreign = targets.filter((t) => !overlay.targets[t] || ["not-own-target", "identity-unavailable"].includes(overlay.targets[t].issueCode));
          const saved = await this.resolver.resolve(snapshot.path, foreign);
          const resolved = Object.fromEntries(targets.map((t) => [t, saved[t] || overlay.targets[t]]));
          const currentKey = [this.snapshot?.path, this.state?.policy, this.state?.registry, this.resolver.editorGeneration].join("\n");
          if (!this.closed && ticket === this.serial && currentKey === key) this.onResult(resolved, null, Object.fromEntries(lines.map((n) => [n, overlay.callouts[n]])), snapshot.doc);
        } catch (error) {
          if (!this.closed && ticket === this.serial) {
            if (error.retryable === false) {
              if (this.overlay?.doc === snapshot.doc) this.overlay.failure = error;
              this.onResult(null, error);
            } else this.resolver.failed(error);
          }
        } finally {
          this.running = false;
          if (!this.closed && (ticket !== this.serial || epoch !== this.resolver.epoch)) this.schedule();
        }
      }
      close() {
        this.closed = true;
        this.cancel(this.timer);
        this.unsubscribe();
        this.overlay = null;
        this.snapshot = null;
      }
    };
    module2.exports = { ReferenceResolver, ReferenceConsumer };
  }
});

// plugin/reference-navigation.js
var require_reference_navigation = __commonJS({
  "plugin/reference-navigation.js"(exports2, module2) {
    function navigationIntent(event, { math = false, editor = false } = {}) {
      if (event.type === "keydown" && event.key !== "Enter") return null;
      if (event.type === "click" && event.button !== 0 || event.type === "auxclick" && event.button !== 1) return null;
      const modified = !!(event.metaKey || event.ctrlKey), middle = event.type === "auxclick";
      if (math && editor && !modified && !middle) return null;
      return { newTab: math && editor ? middle || modified && !!event.shiftKey : middle || modified };
    }
    module2.exports = { navigationIntent };
  }
});

// plugin/reference-model.js
var require_reference_model = __commonJS({
  "plugin/reference-model.js"(exports2, module2) {
    var { createHash } = require("crypto");
    var ID = "[A-Za-z0-9-]{1,80}";
    var TARGET = `(?:${ID}\\.)?${ID}`;
    var prose = new RegExp(`(?<!!)\\[\\[([^\\]\\n]+)\\]\\]%%kl:([ntbc]):(${TARGET})(?::([0-9a-f]{16}))?%%`, "g");
    var library = new RegExp(`(?<!!)\\[([^\\]\\n]+)\\]\\((obsidian://knowledge-library\\?entry=(${ID}))\\)%%kl:([ntbc]):lib\\.(${ID})(?::([0-9a-f]{16}))?%%`, "g");
    function labelDigest(label) {
      return createHash("sha256").update(label, "utf8").digest("hex").slice(0, 16);
    }
    function lineReferences(text, limit = 256) {
      const refs = [];
      for (const kind of ["prose", "library"]) {
        const pattern = new RegExp((kind === "prose" ? prose : library).source, "g");
        let m;
        while (refs.length < limit && (m = pattern.exec(text))) {
          let label, link, mode, target, baseline, labelFrom;
          if (kind === "prose") {
            const split = /(\\?\|)/.exec(m[1]);
            if (!split) continue;
            link = m[1].slice(0, split.index);
            label = m[1].slice(split.index + split[0].length);
            mode = m[2];
            target = m[3];
            baseline = m[4] || null;
            labelFrom = m.index + 2 + split.index + split[0].length;
          } else {
            if (m[3] !== m[5]) continue;
            label = m[1];
            link = m[2];
            mode = m[4];
            target = "lib." + m[5];
            baseline = m[6] || null;
            labelFrom = m.index + 1;
          }
          refs.push({ kind, from: m.index, to: pattern.lastIndex, labelFrom, labelTo: labelFrom + label.length, label, link, mode, target, baseline, tokenFrom: m.index + m[0].lastIndexOf("%%kl:") });
        }
      }
      return refs.sort((a, b) => a.from - b.from);
    }
    function labelState(ref, target) {
      const original = { label: ref.label, changed: false };
      if (!target || target.issue) return { ...original, issueCode: target?.issueCode || "unavailable", issue: target?.issue || "Reference is unavailable" };
      if (ref.mode === "c") return original;
      const current = { n: target.numberLabel, t: target.title, b: target.bothLabel ?? [target.numberLabel, target.title].filter(Boolean).join(": ") }[ref.mode];
      if (!current) return { ...original, issueCode: "label-unavailable", issue: "Requested label is unavailable" };
      if (ref.baseline && labelDigest(ref.label) !== ref.baseline) return { ...original, issueCode: "edited-label", issue: "Your edited reference wording is preserved" };
      if (!ref.baseline && ref.label !== current) return { ...original, issueCode: "unknown-label", issue: "Choose whether to refresh this older reference label" };
      return { label: current, changed: current !== ref.label, warningCode: target.warningCode, warning: target.warning, provisional: !!target.provisional };
    }
    module2.exports = { labelDigest, lineReferences, labelState };
  }
});

// plugin/reference-popout.js
var require_reference_popout = __commonJS({
  "plugin/reference-popout.js"(exports2, module2) {
    function openPersistent(plugin, reference) {
      const doc = reference.element?.ownerDocument || document, win = doc.defaultView;
      const card = doc.createElement("div");
      card.className = "kl-entry-hover kl-persistent-reference";
      const rect = reference.element?.getBoundingClientRect() || { left: win.innerWidth / 2 - 220, bottom: 100 };
      Object.assign(card.style, { left: Math.max(12, Math.min(rect.left, win.innerWidth - 480)) + "px", top: Math.max(12, Math.min(rect.bottom + 8, win.innerHeight - 320)) + "px" });
      const label = reference.label || (reference.element?.matches("a,.cm-link,.kl-math-reference") ? reference.element.textContent?.trim() : "");
      const bar = card.createDiv({ cls: "kl-reference-dragbar" });
      const caption = bar.createSpan({ text: label || "Reference" });
      const close = bar.createEl("button", { attr: { "aria-label": "Close reference" }, text: "\xD7" });
      doc.body.append(card);
      let browser, closed = false, drag = null;
      const finish = () => {
        drag = null;
        win.removeEventListener("pointermove", move);
        win.removeEventListener("pointerup", finish);
        win.removeEventListener("pointercancel", finish);
        win.removeEventListener("blur", finish);
      };
      const move = (e) => {
        if (!drag) return;
        card.style.left = Math.max(0, Math.min(win.innerWidth - 80, drag.left + e.clientX - drag.x)) + "px";
        card.style.top = Math.max(0, Math.min(win.innerHeight - 40, drag.top + e.clientY - drag.y)) + "px";
      };
      bar.onpointerdown = (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        e.preventDefault();
        const r = card.getBoundingClientRect();
        drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
        win.addEventListener("pointermove", move);
        win.addEventListener("pointerup", finish);
        win.addEventListener("pointercancel", finish);
        win.addEventListener("blur", finish);
      };
      const hide = () => {
        if (closed) return;
        closed = true;
        finish();
        browser?.onClose();
        card.remove();
        plugin.persistentReferences?.delete(hide);
      };
      close.onclick = hide;
      card.onkeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          hide();
        }
      };
      browser = plugin.createEntryHover({ hoverEl: card, position() {
      }, hide }, reference);
      browser.persistent = true;
      browser.onEntryLoaded = (data) => {
        if (!label) caption.textContent = data.title + (data.panel ? " (" + data.panel + ")" : "");
      };
      (plugin.persistentReferences ??= /* @__PURE__ */ new Set()).add(hide);
      card.tabIndex = -1;
      card.focus({ preventScroll: true });
      return browser;
    }
    module2.exports = { openPersistent };
  }
});

// plugin/reference-hover.js
var require_reference_hover = __commonJS({
  "plugin/reference-hover.js"(exports2, module2) {
    var { HoverPopover, Platform: Platform2 } = require("obsidian");
    var { EditorView } = require("@codemirror/view");
    function attachReferenceHover(plugin, doc, eventReference) {
      const parent = { hoverPopover: null };
      let active = null, candidate = null, disposed = false;
      const cancel = () => {
        candidate = null;
        active?.hide();
        active = null;
      };
      const allowed = (ref, event) => {
        if (!ref || event.buttons || event.pointerType === "touch" || doc.querySelector(".modal-container")) return false;
        if (ref.editor) {
          if (!(Platform2.isMacOS ? event.metaKey : event.ctrlKey)) return false;
          const root = ref.element.closest(".cm-editor");
          const view = root ? EditorView.findFromDOM(root) : null;
          if (view?.state.selection.ranges.some((range) => !range.empty)) return false;
        }
        return true;
      };
      class EntryHover extends HoverPopover {
        hide() {
          if (active === this) active = null;
          super.hide();
        }
        onload() {
          if (disposed || this !== active || !this.reference.element.isConnected) {
            this.hide();
            return;
          }
          this.browser = plugin.createEntryHover(this, this.reference);
        }
        onunload() {
          if (active === this) active = null;
          this.browser?.onClose();
          super.onunload();
        }
      }
      const enter = (event) => {
        const ref = eventReference(event.target);
        if (active?.hoverEl.contains(event.target) || !ref) return;
        if (active && ref.element === active.reference.element) {
          if (event.buttons) cancel();
          return;
        }
        cancel();
        candidate = ref;
        if (!allowed(ref, event)) return;
        active = new EntryHover(parent, ref.element, 300);
        active.reference = ref;
        active.hoverEl.addClass("kl-entry-hover");
      };
      const leave = (event) => {
        if (!candidate || candidate.element.contains(event.relatedTarget)) return;
        if (candidate.element.contains(event.target)) candidate = null;
      };
      const key = (event) => {
        if (active?.hoverEl.contains(event.target) && event.key !== "Escape") return;
        if (event.key === (Platform2.isMacOS ? "Meta" : "Control") && candidate && !active) {
          const ref = candidate;
          candidate = null;
          enter({ ...event, target: ref.element, metaKey: event.key === "Meta", ctrlKey: event.key === "Control" });
          return;
        }
        if (event.key !== "Meta" && event.key !== "Control") cancel();
      };
      const scroll = (event) => {
        if (!active?.hoverEl.contains(event.target)) cancel();
      };
      const down = (event) => {
        if (!active?.hoverEl.contains(event.target)) cancel();
      };
      const win = doc.defaultView;
      const bindings = [["pointerover", enter], ["pointerout", leave], ["pointerdown", down], ["keydown", key], ["scroll", scroll], ["wheel", scroll]];
      for (const [type, fn] of bindings) doc.addEventListener(type, fn, { capture: true, passive: type === "scroll" || type === "wheel" });
      win.addEventListener("blur", cancel);
      const changed = plugin.app.workspace.on("active-leaf-change", cancel);
      return () => {
        disposed = true;
        cancel();
        for (const [type, fn] of bindings) doc.removeEventListener(type, fn, true);
        win.removeEventListener("blur", cancel);
        plugin.app.workspace.offref(changed);
      };
    }
    module2.exports = { attachReferenceHover };
  }
});

// plugin/reference-links.js
var require_reference_links = __commonJS({
  "plugin/reference-links.js"(exports2, module2) {
    var { EditorView, ViewPlugin, Decoration } = require("@codemirror/view");
    var { syntaxTree } = require("@codemirror/language");
    var { editorLivePreviewField, Notice: Notice2, Menu: Menu2 } = require("obsidian");
    var { EditorState, EditorSelection, Transaction } = require("@codemirror/state");
    var { navigationIntent } = require_reference_navigation();
    var ENTRY = /^obsidian:\/\/knowledge-library\?entry=([A-Za-z0-9-]{1,80})$/;
    var LINK = /\[([^\[\]\r\n]+)\]\(obsidian:\/\/knowledge-library\?entry=([A-Za-z0-9-]{1,80})\)%%kl:([ntbc]):lib\.([A-Za-z0-9-]{1,80})(?::[0-9a-f]{16})?%%/g;
    function entryFromHref(href) {
      return ENTRY.exec(href || "")?.[1] || null;
    }
    function lineReferences(text) {
      const result = [];
      const pattern = new RegExp(LINK.source, "g");
      let match;
      while (match = pattern.exec(text)) if (match[2] === match[4]) result.push({ from: match.index + 1, to: match.index + 1 + match[1].length, entry: match[2], urlFrom: match.index + match[0].indexOf("(obsidian:") + 1, urlTo: match.index + match[0].indexOf(")%%kl:"), tokenFrom: match.index + match[0].indexOf("%%kl:"), tokenTo: pattern.lastIndex });
      return result;
    }
    function editReferences(text) {
      const refs = lineReferences(text).map((r) => ({ ...r, kind: "library", referenceFrom: r.from - 1, protectedRanges: [[r.from - 1, r.from], [r.to, r.tokenTo]] }));
      for (const r of require_reference_model().lineReferences(text)) if (r.kind === "prose") refs.push({
        kind: "prose",
        from: r.labelFrom,
        to: r.labelTo,
        referenceFrom: r.from,
        tokenFrom: r.tokenFrom,
        tokenTo: r.to,
        protectedRanges: [[r.from, r.labelFrom], [r.labelTo, r.to]]
      });
      return refs.sort((a, b) => a.referenceFrom - b.referenceFrom);
    }
    function protectedChange(change, ref, offset = 0) {
      if (change.from <= offset + ref.referenceFrom && change.to >= offset + ref.tokenTo) return false;
      return ref.protectedRanges.some(([a, b]) => change.from === change.to ? change.from > offset + a && change.from < offset + b : change.from < offset + b && change.to > offset + a);
    }
    function decorations(view) {
      const ranges = [], atomic = [], seen = /* @__PURE__ */ new Set();
      for (const visible of view.visibleRanges) {
        for (let pos = visible.from; pos <= visible.to; ) {
          const line = view.state.doc.lineAt(pos);
          if (!seen.has(line.number)) {
            seen.add(line.number);
            for (const link of editReferences(line.text)) {
              const start = line.from + link.from, end = line.from + link.to;
              const node = syntaxTree(view.state).resolveInner(start, 1);
              if (!/link/i.test(node.name) || /code|comment/i.test(node.name)) continue;
              if (link.kind === "library") ranges.push(Decoration.mark({ class: "kl-knowledge-reference", attributes: { "data-kl-entry": link.entry } }).range(start, end));
              const tokenFrom = line.from + link.tokenFrom, tokenTo = line.from + link.tokenTo;
              if (view.state.field(editorLivePreviewField, false)) atomic.push(Decoration.replace({}).range(line.from + link.referenceFrom, tokenTo));
              const selected = view.state.selection.ranges.some((r) => revealsToken(r, tokenFrom, tokenTo));
              if (view.state.field(editorLivePreviewField, false) && !selected) ranges.push(Decoration.replace({}).range(tokenFrom, tokenTo));
            }
          }
          if (line.to >= visible.to) break;
          pos = line.to + 1;
        }
      }
      return { decorations: Decoration.set(ranges, true), atomic: Decoration.set(atomic, true) };
    }
    function eventReference(target) {
      const element = target?.nodeType === 3 ? target.parentElement : target;
      const math = element?.closest?.('.kl-math-reference[data-kl-kind="math"]'), mathEntry = math?.dataset?.klTarget?.match(/^lib\.([A-Za-z0-9-]{1,80})$/)?.[1];
      if (mathEntry) return { entry: mathEntry, element: math, math: true, editor: !!math.closest(".markdown-source-view") };
      const anchor = element?.closest?.("a[href]");
      if (anchor) {
        const entry2 = entryFromHref(anchor.getAttribute("href"));
        if (entry2) return { entry: entry2, element: anchor, editor: !!anchor.closest?.(".markdown-source-view") };
      }
      const native = element?.closest?.(".cm-link");
      if (!native) return null;
      const mark = element.closest(".kl-knowledge-reference") || native.closest(".kl-knowledge-reference") || native.querySelector(".kl-knowledge-reference");
      if (!mark) return null;
      const entry = mark.getAttribute("data-kl-entry");
      return /^[A-Za-z0-9-]{1,80}$/.test(entry || "") ? { entry, element: native, editor: true } : null;
    }
    function partialTokenChange(from, to, tokenFrom, tokenTo, referenceFrom = tokenFrom) {
      return from === to ? from > tokenFrom && from < tokenTo : from < tokenTo && to > tokenFrom && !(from <= referenceFrom && to >= tokenTo);
    }
    function referenceCaret(head, previous, start, end, pointer = false) {
      if (head <= start || head >= end) return head;
      return !pointer && previous !== void 0 && head < previous ? start : end;
    }
    function boundaryCaret(previous, tokenEnd, labelInside) {
      return previous?.head === tokenEnd ? labelInside : tokenEnd;
    }
    function revealsToken(range, from, to) {
      return range.empty ? range.from > from && range.from < to : range.from < to && range.to > from;
    }
    function registerReferenceLinks(plugin) {
      plugin.addCommand({ id: "persistent-reference", name: "Open persistent reference at cursor", editorCheckCallback: (checking, editor, view) => {
        const cursor = editor.getCursor(), line = editor.getLine(cursor.line), hit = lineReferences(line).find((r) => cursor.ch >= r.from - 1 && cursor.ch <= r.tokenTo);
        if (!hit) return false;
        if (!checking) require_reference_popout().openPersistent(plugin, { entry: hit.entry, element: view.containerEl });
        return true;
      } });
      plugin.registerMarkdownPostProcessor((element) => {
        for (const anchor of element.querySelectorAll('a[href^="obsidian://knowledge-library?entry="]')) {
          const href = anchor.getAttribute("href");
          if (!entryFromHref(href)) continue;
          for (const attribute of ["aria-label", "title"]) if (anchor.getAttribute(attribute) === href) anchor.removeAttribute(attribute);
        }
      });
      plugin.registerEditorExtension(EditorState.transactionFilter.of((tr) => {
        if (tr.docChanged || !tr.selection || !tr.startState.field(editorLivePreviewField, false)) return tr;
        let changed = false;
        const ranges = tr.newSelection.ranges.map((range, index) => {
          const line = tr.startState.doc.lineAt(range.head);
          for (const ref of editReferences(line.text)) {
            const start = line.from + ref.referenceFrom, end = line.from + ref.tokenTo;
            if (range.head <= start || range.head >= end) continue;
            const name = syntaxTree(tr.startState).resolveInner(line.from + ref.from, 1).name;
            if (!/link/i.test(name) || /code|comment/i.test(name)) continue;
            const previous = tr.startState.selection.ranges[index];
            const head = referenceCaret(range.head, previous?.head, start, end, tr.isUserEvent("select.pointer"));
            changed = true;
            return range.empty ? EditorSelection.cursor(head) : EditorSelection.range(range.anchor, head);
          }
          return range;
        });
        return changed ? [tr, { selection: EditorSelection.create(ranges, tr.newSelection.mainIndex), sequential: true }] : tr;
      }));
      let lastNotice = 0;
      plugin.registerEditorExtension(EditorState.transactionFilter.of((tr) => {
        if (!tr.docChanged || !["input", "delete", "move"].some((event) => tr.isUserEvent(event))) return tr;
        const changes = [];
        tr.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => changes.push({ from, to, inserted }));
        const single = changes.length === 1 && tr.startState.selection.ranges.length === 1 && tr.startState.selection.main.empty;
        let blocked = false;
        for (const change of changes) {
          const { from, to, inserted } = change;
          const first = tr.startState.doc.lineAt(from), last = tr.startState.doc.lineAt(to);
          for (const line of first.number === last.number ? [first] : [first, last]) for (const ref of editReferences(line.text)) {
            const start = line.from + ref.referenceFrom, tokenFrom = line.from + ref.tokenFrom, end = line.from + ref.tokenTo;
            const name = syntaxTree(tr.startState).resolveInner(line.from + ref.from, 1).name;
            if (!/link/i.test(name) || /code|comment/i.test(name)) continue;
            if (single && from === to && /[\r\n]/.test(inserted.toString()) && from >= line.from + ref.to && from < end)
              return { changes: { from: end, to: end, insert: inserted }, selection: { anchor: end + inserted.length }, userEvent: tr.annotation(Transaction.userEvent) || "input", scrollIntoView: true };
            if (single && inserted.length === 0 && (tr.isUserEvent("delete.backward") && to === end || tr.isUserEvent("delete.forward") && from === start)) return { selection: { anchor: start, head: end }, scrollIntoView: true };
            if (protectedChange(change, ref, line.from)) blocked = true;
          }
        }
        if (!blocked) return tr;
        if (Date.now() - lastNotice > 2e3) {
          lastNotice = Date.now();
          new Notice2("Reference target stays attached to its label. Select the whole reference to remove it.");
        }
        return [];
      }));
      plugin.registerEditorExtension(ViewPlugin.fromClass(class {
        constructor(view) {
          this.view = view;
          Object.assign(this, decorations(view));
          this.markIcons();
        }
        update(update) {
          if (update.docChanged || update.viewportChanged || update.selectionSet || syntaxTree(update.startState) !== syntaxTree(update.state)) {
            Object.assign(this, decorations(update.view));
            this.markIcons();
          }
        }
        markIcons() {
          const view = this.view;
          view.requestMeasure({ key: this, read: () => this.disposed ? [] : [...view.contentDOM.querySelectorAll(".cm-url.external-link")].map((icon) => {
            try {
              const pos = view.posAtDOM(icon), line = view.state.doc.lineAt(pos);
              return { icon, reference: lineReferences(line.text).some((r) => pos >= line.from + r.urlFrom && pos <= line.from + r.tokenFrom) };
            } catch {
              return { icon, reference: false };
            }
          }), write: (items) => {
            if (this.disposed) return;
            for (const { icon, reference } of items) icon.classList.toggle("kl-reference-icon", reference);
          } });
        }
        destroy() {
          this.disposed = true;
          for (const icon of this.view.contentDOM.querySelectorAll(".kl-reference-icon")) icon.classList.remove("kl-reference-icon");
        }
      }, { decorations: (value) => value.decorations, provide: (extension) => EditorView.atomicRanges.of((view) => view.plugin(extension)?.atomic || Decoration.none) }));
      const documents = /* @__PURE__ */ new Map();
      let alive = true;
      const attach = (doc) => {
        if (!alive || documents.has(doc)) return;
        const handler = (event) => {
          if (event.type === "keydown" && event.key !== "Enter") return;
          if (event.type === "click" && event.button !== 0 || event.type === "auxclick" && event.button !== 1) return;
          const reference = eventReference(event.target);
          if (!reference) return;
          const intent = navigationIntent(event, reference);
          if (!intent) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          plugin.openLibraryEntry(reference.entry, intent.newTab, reference.element);
        };
        for (const type of ["click", "auxclick", "keydown"]) doc.addEventListener(type, handler, true);
        const persistent = (ref) => require_reference_popout().openPersistent(plugin, ref);
        const context = (event) => {
          const ref = eventReference(event.target);
          if (!ref) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          Menu2.forEvent(event).addItem((item) => item.setTitle("Open persistent reference").setIcon("pin").onClick(() => persistent(ref))).addItem((item) => item.setTitle("Open in Index").setIcon("library").onClick(() => plugin.openLibraryEntry(ref.entry, false, ref.element))).showAtMouseEvent(event);
        };
        const popKey = (event) => {
          if (event.key.toLowerCase() !== "h" || !event.altKey || event.metaKey || event.ctrlKey) return;
          let ref = eventReference(event.target);
          if (!ref) {
            const root = event.target.closest?.(".cm-editor"), view = root && EditorView.findFromDOM(root);
            if (view) {
              const pos = view.state.selection.main.head, line = view.state.doc.lineAt(pos), hit = lineReferences(line.text).find((r) => pos >= line.from + r.from - 1 && pos <= line.from + r.tokenTo);
              if (hit) ref = { entry: hit.entry, element: root };
            }
          }
          if (!ref) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          persistent(ref);
        };
        doc.defaultView.addEventListener("contextmenu", context, true);
        doc.addEventListener("keydown", popKey, true);
        const closeHover = require_reference_hover().attachReferenceHover(plugin, doc, eventReference);
        documents.set(doc, () => {
          doc.defaultView.removeEventListener("contextmenu", context, true);
          doc.removeEventListener("keydown", popKey, true);
          closeHover();
          for (const type of ["click", "auxclick", "keydown"]) doc.removeEventListener(type, handler, true);
        });
      };
      plugin.app.workspace.onLayoutReady(() => {
        attach(document);
        plugin.app.workspace.iterateAllLeaves((leaf) => attach(leaf.view.containerEl.ownerDocument));
      });
      plugin.registerEvent(plugin.app.workspace.on("window-open", (_container, win) => attach(win.document)));
      plugin.registerEvent(plugin.app.workspace.on("window-close", (_container, win) => {
        documents.get(win.document)?.();
        documents.delete(win.document);
      }));
      plugin.register(() => {
        for (const close of plugin.persistentReferences || []) close();
        alive = false;
        for (const dispose of documents.values()) dispose();
        documents.clear();
      });
    }
    module2.exports = { referenceCaret, editReferences, protectedChange, entryFromHref, lineReferences, eventReference, partialTokenChange, boundaryCaret, revealsToken, registerReferenceLinks };
  }
});

// plugin/reference-presentation.js
var require_reference_presentation = __commonJS({
  "plugin/reference-presentation.js"(exports2, module2) {
    var { presentation } = require_callout_presentation();
    function referencePresentation(owner) {
      const targets = [.../* @__PURE__ */ new Set([...(owner.refs || []).map((r) => r.target), ...owner.fragments?.targets || []])].sort().slice(0, 256);
      const lines = [...new Set(owner.fragments?.calloutLines || [])].sort((a, b) => a - b).slice(0, 256);
      return JSON.stringify([owner.issue || null, targets.map((id) => {
        const t = owner.results[id];
        return [id, t ? [t.title, t.numberLabel, t.bothLabel, t.link, t.issueCode, t.issue, t.warningCode, t.warning, !!t.provisional] : null];
      }), lines.map((line) => {
        const row = owner.callouts?.[line];
        return [line, row ? [row.title, row.sourceStyle, presentation(row)] : null];
      })]);
    }
    module2.exports = { referencePresentation };
  }
});

// plugin/markdown-structure.js
var require_markdown_structure = __commonJS({
  "plugin/markdown-structure.js"(exports2, module2) {
    var { parser, GFM } = require_dist3();
    var escaped = (text, pos) => {
      let n = 0;
      while (pos > 0 && text[--pos] === "\\") n++;
      return n % 2 === 1;
    };
    function closing(text, token, start) {
      let pos = start;
      while ((pos = text.indexOf(token, pos)) >= 0) {
        if (!escaped(text, pos)) return pos;
        pos += token.length;
      }
      return -1;
    }
    function openDisplay(text) {
      let open = false;
      for (let pos = 0; pos < text.length; pos++) {
        if (escaped(text, pos)) continue;
        if (!open && text[pos] === "`") {
          let end = pos + 1;
          while (text[end] === "`") end++;
          const run = text.slice(pos, end);
          let close = end;
          while ((close = text.indexOf(run, close)) >= 0) {
            if (text[close - 1] !== "`" && text[close + run.length] !== "`") break;
            close += run.length;
          }
          if (close >= 0) pos = close + run.length - 1;
          else pos = end - 1;
        } else if (text.startsWith("$$", pos)) {
          open = !open;
          pos++;
        }
      }
      return open;
    }
    var markdown = parser.configure([GFM, {
      defineNodes: ["KLMath", "KLMathBlock"],
      parseInline: [{ name: "KLMath", before: "Escape", parse(cx, next, pos) {
        if (next !== 36 || escaped(cx.text, pos - cx.offset)) return -1;
        const token = cx.char(pos + 1) === 36 ? "$$" : "$", end = closing(cx.text, token, pos - cx.offset + token.length);
        if (end < 0) return -1;
        if (token === "$" && (/\s/.test(cx.char(pos + 1) ? String.fromCharCode(cx.char(pos + 1)) : "") || /\s/.test(cx.text[end - 1] || "") || /\d/.test(cx.text[end + 1] || "") || cx.text.slice(pos - cx.offset, end).includes("\n"))) return -1;
        return cx.addElement(cx.elt("KLMath", pos, cx.offset + end + token.length));
      } }],
      parseBlock: [{
        name: "KLMathBlock",
        before: "FencedCode",
        endLeaf: (cx, line, leaf) => line.text.startsWith("$$", line.pos) && !openDisplay(leaf.content),
        parse(cx, line) {
          if (!line.text.startsWith("$$", line.pos)) return false;
          const from = cx.lineStart + line.pos;
          let end = cx.lineStart + line.text.length;
          let close = closing(line.text, "$$", line.pos + 2), closed = close >= 0;
          if (closed) end = cx.lineStart + close + 2;
          if (!closed) {
            while (cx.nextLine()) {
              if (line.depth < cx.depth) break;
              end = cx.lineStart + line.text.length;
              close = closing(line.text, "$$", line.pos);
              if (close >= 0) {
                end = cx.lineStart + close + 2;
                closed = true;
                break;
              }
            }
          }
          cx.addElement(cx.elt("KLMathBlock", from, end));
          if (closed) cx.nextLine();
          return true;
        }
      }]
    }]);
    function merge(spans) {
      const out = [];
      for (const s of spans.sort((a, b) => a[0] - b[0])) {
        const last = out[out.length - 1];
        if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
        else out.push([...s]);
      }
      return out;
    }
    function scan(text) {
      const frontmatter = /^\uFEFF?---\r?\n(?:[^\n]*\n)*?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
      const code = frontmatter ? [[0, frontmatter[0].length]] : [], math = [], links = [], structure = [];
      const masked = frontmatter ? frontmatter[0].replace(/[^\r\n]/g, " ") + text.slice(frontmatter[0].length) : text;
      const tree = markdown.parse(masked);
      tree.iterate({ enter(node) {
        const span = [node.from, node.to];
        if (["FencedCode", "CodeBlock", "InlineCode", "HTMLBlock", "Comment", "CommentBlock"].includes(node.name)) {
          code.push(span);
          return false;
        }
        if (["Link", "Image", "Autolink", "URL"].includes(node.name)) links.push(span);
        if (node.name === "KLMath" || node.name === "KLMathBlock") {
          math.push(span);
          return false;
        }
        if (["ListItem", "Blockquote", "ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "SetextHeading1", "SetextHeading2"].includes(node.name)) structure.push({ type: node.name, from: node.from, to: node.to });
      } });
      const excluded = merge([...code, ...math]), comments = [];
      let cursor = 0, at = 0;
      while ((cursor = text.indexOf("%%", cursor)) >= 0) {
        while (at < excluded.length && excluded[at][1] <= cursor) at++;
        if (at < excluded.length && excluded[at][0] <= cursor) {
          cursor = excluded[at][1];
          continue;
        }
        if (escaped(text, cursor)) {
          cursor += 2;
          continue;
        }
        const end = text.indexOf("%%", cursor + 2);
        if (text.startsWith("%%kl:", cursor) && end >= 0) {
          cursor = end + 2;
          continue;
        }
        const to = end < 0 ? text.length : end + 2;
        comments.push([cursor, to]);
        cursor = to;
      }
      const wiki = /!?\[\[[^\]\r\n]*\]\]/g;
      let match;
      while (match = wiki.exec(text)) if (!escaped(text, match.index)) links.push([match.index, match.index + match[0].length]);
      return { offsetUnit: "utf16", protected: merge([...code, ...comments]), math, links: merge(links), structure };
    }
    module2.exports = { scan };
  }
});

// plugin/reference-reading-model.js
var require_reference_reading_model = __commonJS({
  "plugin/reference-reading-model.js"(exports2, module2) {
    var { scan } = require_markdown_structure();
    var { lineReferences } = require_reference_model();
    function sectionReferences(text, parsed = scan(text)) {
      const protectedSpans = parsed.protected, refs = [];
      let offset = 0, at = 0;
      for (const line of text.split("\n")) {
        for (const ref of lineReferences(line)) {
          const pos = offset + ref.from;
          while (at < protectedSpans.length && protectedSpans[at][1] <= pos) at++;
          if (at < protectedSpans.length && protectedSpans[at][0] <= pos) continue;
          refs.push({ ...ref, from: pos, to: offset + ref.to });
        }
        offset += line.length + 1;
      }
      return refs;
    }
    function sectionHeadings(text, element, parsed = scan(text)) {
      const headers = [];
      let at = 0, lineOffset = 0, lineCursor = 0;
      for (const node of parsed.structure) {
        if (node.type !== "Blockquote") continue;
        while (at < parsed.protected.length && parsed.protected[at][1] <= node.from) at++;
        if (at < parsed.protected.length && parsed.protected[at][0] <= node.from) continue;
        const header = /^>\s*\[!([\w-]+)(?:\|[^\]\n]*)?\][+-]?[ \t]*([^\n]*)/.exec(text.slice(node.from, node.to));
        if (header) {
          for (let next; (next = text.indexOf("\n", lineCursor)) >= 0 && next < node.from; lineCursor = next + 1) lineOffset++;
          headers.push({ type: header[1].toLowerCase(), title: header[2].trim(), lineOffset });
        }
      }
      const callouts = [...element.matches?.(".callout") ? [element] : [], ...element.querySelectorAll(".callout")];
      if (callouts.length !== headers.length || callouts.some((el, i) => el.getAttribute("data-callout") !== headers[i].type)) return [];
      return headers.map((header, i) => ({ ...header, element: callouts[i].querySelector(":scope > .callout-title > .callout-title-inner") })).filter((h) => h.element);
    }
    function normalize(link) {
      try {
        return decodeURIComponent(link);
      } catch {
        return link;
      }
    }
    function matchAnchors(refs, anchors) {
      const wanted = new Set(refs.map((r) => normalize(r.link)));
      const matching = anchors.filter((a) => wanted.has(normalize(a.getAttribute("data-href") || a.getAttribute("href") || "")));
      if (matching.length !== refs.length) return null;
      if (matching.some((a, i) => normalize(a.getAttribute("data-href") || a.getAttribute("href") || "") !== normalize(refs[i].link))) return null;
      return refs.map((ref, i) => ({ ref, anchor: matching[i] }));
    }
    var SectionSources = class {
      constructor() {
        this.entries = /* @__PURE__ */ new Map();
      }
      section(path2, info) {
        let row = this.entries.get(path2);
        if (!row || row.text !== info.text) {
          const starts = [0];
          for (let i = 0; (i = info.text.indexOf("\n", i)) >= 0; i++) starts.push(i + 1);
          row = { text: info.text, starts };
          this.entries.delete(path2);
          this.entries.set(path2, row);
          while (this.entries.size > 3) this.entries.delete(this.entries.keys().next().value);
        }
        return row.text.slice(row.starts[info.lineStart] ?? 0, row.starts[info.lineEnd + 1] ?? row.text.length);
      }
      clear() {
        this.entries.clear();
      }
    };
    function captureAnchor(anchor) {
      return { nodes: [...anchor.childNodes].map((n) => n.cloneNode(true)), title: anchor.getAttribute("title"), classed: anchor.classList.contains("kl-dynamic-reference"), target: anchor.getAttribute("data-kl-target"), source: anchor.getAttribute("data-kl-source") };
    }
    function restoreAnchor(anchor, original) {
      anchor.replaceChildren(...original.nodes.map((n) => n.cloneNode(true)));
      anchor.classList.toggle("kl-dynamic-reference", original.classed);
      for (const [name, value] of [["title", original.title], ["data-kl-target", original.target], ["data-kl-source", original.source]]) {
        if (value === null) anchor.removeAttribute(name);
        else anchor.setAttribute(name, value);
      }
      delete anchor._klDisplayed;
    }
    module2.exports = { sectionReferences, sectionHeadings, matchAnchors, SectionSources, captureAnchor, restoreAnchor };
  }
});

// plugin/math-label.js
var require_math_label = __commonJS({
  "plugin/math-label.js"(exports2, module2) {
    var ERROR = "This title needs special text formatting. Choose Number or Keep selected expression.";
    function mathLabel(label) {
      if (typeof label !== "string" || !label || [...label].length > 4e3) throw Error("Invalid or oversized math reference label");
      let out = "", plain = "", i = 0;
      const flush = () => {
        if (!plain) return;
        if (/[\\{}%#&~^_$\r\n]/.test(plain)) throw Error(ERROR);
        out += "\\text{" + plain + "}";
        plain = "";
      };
      while (i < label.length) {
        const opener = ["$$", "\\(", "\\[", "$"].find((x) => label.startsWith(x, i));
        if (!opener) {
          plain += label[i++];
          continue;
        }
        flush();
        const closer = { "\\(": "\\)", "\\[": "\\]" }[opener] || opener;
        let end = i + opener.length;
        while (end < label.length) {
          if (label.startsWith(closer, end) && label[end - 1] !== "\\") break;
          end++;
        }
        if (end === label.length) throw Error(ERROR);
        const body = label.slice(i + opener.length, end);
        if (!body.trim() || /[$%\r\n]/.test(body) || /\\class\{(?:mjx-)?klref\b/.test(body)) throw Error(ERROR);
        let depth = 0;
        for (let p = 0; p < body.length; p++) {
          if (body[p] === "\\") {
            p++;
            continue;
          }
          if (body[p] === "{") depth++;
          if (body[p] === "}" && --depth < 0) throw Error(ERROR);
        }
        if (depth) throw Error(ERROR);
        out += body;
        i = end + closer.length;
      }
      flush();
      return out;
    }
    module2.exports = { mathLabel };
  }
});

// plugin/math-reference-model.js
var require_math_reference_model = __commonJS({
  "plugin/math-reference-model.js"(exports2, module2) {
    var { labelDigest } = require_reference_model();
    var { mathLabel } = require_math_label();
    var { scan } = require_markdown_structure();
    var ID = "[A-Za-z0-9-]{1,80}";
    var CLASS = new RegExp(`^klref kl-([ntbc])-(${ID}(?:_${ID})?)(?: kl-label-([0-9a-f]{16}))?$`);
    var SAFE_CLASS = new RegExp(`^mjx-klref mjx-kl-([ntbc])-(${ID}(?:_${ID})?)(?: mjx-kl-label-([0-9a-f]{16}))?$`);
    var normalize = (tex) => tex.replace(/\r\n/g, "\n").trim();
    function group(source, at) {
      if (source[at] !== "{") return null;
      let depth = 1, i = at + 1;
      for (; i < source.length; i++) {
        if (source[i] === "\\") {
          i++;
          continue;
        }
        if (source[i] === "%") {
          const end = source.indexOf("\n", i);
          if (end < 0) return null;
          i = end;
          continue;
        }
        if (source[i] === "{") depth++;
        if (source[i] === "}" && !--depth) return { body: source.slice(at + 1, i), from: at + 1, to: i + 1 };
      }
      return null;
    }
    function mathReferences(source) {
      const out = [];
      let i = 0, symbolEnd = 0;
      while (i < source.length) {
        if (source[i] === "%") {
          const end = source.indexOf("\n", i);
          if (end < 0) break;
          i = end + 1;
          continue;
        }
        if (source[i] !== "\\") {
          i++;
          continue;
        }
        if (!source.startsWith("\\class{", i)) {
          i += 2;
          continue;
        }
        const cls = group(source, i + 6);
        if (!cls) {
          i += 6;
          continue;
        }
        const body = group(source, cls.to), isRef = /(?:^|\s)(?:mjx-)?klref(?:\s|$)/.test(cls.body);
        if (isRef) {
          const fields = CLASS.exec(cls.body) || SAFE_CLASS.exec(cls.body);
          if (!fields || !body) throw Error("Malformed knowledge reference");
          if (i < (out.at(-1)?.to || 0) || i < symbolEnd) throw Error("Nested knowledge reference");
          out.push({ from: i, to: body.to, bodyFrom: body.from, bodyTo: body.to - 1, body: body.body, raw: source.slice(i, body.to), mode: fields[1], target: fields[2].replace("_", "."), baseline: fields[3] });
        } else if (body && /^mjx-ss mjx-ss-o-[0-9a-z]{10}$/.test(cls.body)) symbolEnd = Math.max(symbolEnd, body.to);
        i = cls.to + 1;
      }
      return out;
    }
    function mathLabelState(ref, target) {
      const original = { label: ref.body, changed: false };
      if (!target) return { ...original, pending: true };
      if (target.issue) return { ...original, issue: target.issue };
      if (ref.mode === "c") return original;
      const label = { n: target.numberLabel, t: target.title, b: target.bothLabel ?? [target.numberLabel, target.title].filter(Boolean).join(": ") }[ref.mode];
      if (!label) return { ...original, issue: "Requested label is unavailable" };
      if (ref.baseline && labelDigest(ref.body) !== ref.baseline) return { ...original, issue: "Your edited reference wording is preserved" };
      let next;
      try {
        next = mathLabel(label);
      } catch (error) {
        return { ...original, issue: error.message };
      }
      if (!ref.baseline && ref.body !== next) return { ...original, issue: "Choose whether to refresh this older reference label" };
      return { label: next, changed: next !== ref.body };
    }
    function projectMath(source, targets, refs = mathReferences(source)) {
      let latex = "", cursor = 0;
      const projected = [];
      for (const ref of refs) {
        const state = mathLabelState(ref, targets[ref.target]), from = latex.length + ref.from - cursor;
        latex += source.slice(cursor, ref.bodyFrom) + state.label + source.slice(ref.bodyTo, ref.to);
        cursor = ref.to;
        projected.push({ ...ref, from, to: latex.length, raw: latex.slice(from), body: state.label, state });
      }
      latex += source.slice(cursor);
      return { latex, refs: projected, changed: latex !== source };
    }
    function sectionMath(text, parsed = scan(text)) {
      const out = [];
      for (const [from, to] of parsed.math) {
        if (parsed.protected.some(([a, b]) => a <= from && from < b) || parsed.links.some(([a, b]) => a <= from && from < b)) continue;
        const raw = text.slice(from, to), display = raw.startsWith("$$"), size = display ? 2 : 1;
        if (!raw.endsWith("$".repeat(size)) || raw.length < size * 2) continue;
        let body = raw.slice(size, -size);
        if (display) {
          const opening = text.slice(text.lastIndexOf("\n", from - 1) + 1, from), prefix = /^[ \t]*(?:>[ \t]*)+/.exec(opening)?.[0] || "", depth = (prefix.match(/>/g) || []).length;
          let valid = true;
          body = body.split(/\r?\n/).map((line, i) => {
            if (!i || !depth) return line;
            const p = /^[ \t]*(?:>[ \t]*)+/.exec(line)?.[0] || "";
            if ((p.match(/>/g) || []).length !== depth) {
              valid = false;
              return line;
            }
            return line.slice(p.length);
          }).join("\n");
          if (!valid) continue;
        }
        out.push({ from, to, body, display });
      }
      return out;
    }
    function matchMathNodes(container, source, refs = mathReferences(source)) {
      const root = container.querySelector("mjx-math");
      if (!root || normalize(root.getAttribute("data-latex") || "") !== normalize(source)) return null;
      if (refs.every((ref) => ref.raw.startsWith("\\class{mjx-klref "))) {
        const nodes = [...root.classList?.contains("mjx-klref") ? [root] : [], ...root.querySelectorAll(".mjx-klref")];
        if (nodes.length !== refs.length) return null;
        for (let i = 0; i < refs.length; i++) {
          const expected = refs[i].raw.slice(7, refs[i].raw.indexOf("}")).split(" ").sort().join(" ");
          const actual = [...nodes[i].classList].filter((c) => c === "mjx-klref" || c.startsWith("mjx-kl-")).sort().join(" ");
          if (actual !== expected) return null;
        }
        return refs.map((ref, i) => ({ ref, node: nodes[i] }));
      }
      const byRaw = /* @__PURE__ */ new Map();
      for (const node of [root, ...root.querySelectorAll("[data-latex]")]) {
        const raw = node.getAttribute("data-latex");
        if (!raw) continue;
        const list = byRaw.get(raw) || [];
        list.push(node);
        byRaw.set(raw, list);
      }
      const groups = /* @__PURE__ */ new Map();
      for (const ref of refs) {
        const list = groups.get(ref.raw) || [];
        list.push(ref);
        groups.set(ref.raw, list);
      }
      const matched = /* @__PURE__ */ new Map();
      for (const [raw, groupRefs] of groups) {
        const candidates = byRaw.get(raw) || [];
        const nodes = candidates.filter((node, i) => !candidates[i + 1] || !node.contains(candidates[i + 1]));
        if (nodes.length !== groupRefs.length) return null;
        groupRefs.forEach((ref, i) => matched.set(ref, nodes[i]));
      }
      return refs.map((ref) => ({ ref, node: matched.get(ref) }));
    }
    function markedProjection(projection, base) {
      let latex = "", cursor = 0;
      projection.refs.forEach((ref, i) => {
        latex += projection.latex.slice(cursor, ref.from) + ref.raw.replace("\\class{", "\\class{" + base + "-" + i + " ");
        cursor = ref.to;
      });
      return latex + projection.latex.slice(cursor);
    }
    function matchMarkedNodes(container, latex, refs, base) {
      const root = container.querySelector("mjx-math");
      if (!root || normalize(root.getAttribute("data-latex") || "") !== normalize(latex)) return null;
      const pairs = [];
      for (let i = 0; i < refs.length; i++) {
        const nodes = [...container.querySelectorAll("." + base + "-" + i)];
        if (nodes.length !== 1) return null;
        pairs.push({ ref: refs[i], node: nodes[0] });
      }
      return pairs;
    }
    function sectionMathPairs(text, element, parsed) {
      if (!/\\class\{(?:mjx-)?klref /.test(text)) return [];
      const equations = sectionMath(text, parsed).filter((q) => /\\class\{(?:mjx-)?klref /.test(q.body));
      const roots = [...element.matches(".math") ? [element] : [], ...element.querySelectorAll(".math")].filter((root) => !root.closest("a,.internal-embed,.math-studio-special,.math-studio-host"));
      const candidates = roots.map((root) => ({ root, body: root.getAttribute("data-kl-source-latex") || root.querySelector("mjx-math")?.getAttribute("data-latex") || "" })).filter((r) => /\\class\{(?:mjx-)?klref /.test(r.body));
      if (equations.length !== candidates.length) return [];
      if (equations.some((q, i) => normalize(q.body) !== normalize(candidates[i].body) || q.display !== candidates[i].root.classList.contains("math-block"))) return [];
      try {
        return equations.map((q, i) => ({ root: candidates[i].root, equation: q, refs: mathReferences(q.body) }));
      } catch {
        return [];
      }
    }
    module2.exports = { mathReferences, mathLabelState, projectMath, sectionMath, matchMathNodes, sectionMathPairs, normalize, markedProjection, matchMarkedNodes };
  }
});

// plugin/math-reference-renderer.js
var require_math_reference_renderer = __commonJS({
  "plugin/math-reference-renderer.js"(exports2, module2) {
    var { mathReferences, projectMath, matchMathNodes, markedProjection, matchMarkedNodes, normalize } = require_math_reference_model();
    var owners = /* @__PURE__ */ new WeakMap();
    var PAINT = ".study-math-mark,.study-math-lines,[data-study-math-ids]";
    var MathReferenceRenderer = class {
      constructor(document2, api = null) {
        this.document = document2;
        this.api = api;
        this.rows = /* @__PURE__ */ new Map();
        this.suspended = /* @__PURE__ */ new Map();
        this.queue = /* @__PURE__ */ new Set();
        this.closed = false;
        this.timer = null;
        this.busy = false;
      }
      claim(root, equation, path2, current) {
        if (this.closed || !root?.isConnected || !equation.body.includes("klref") || root.closest(".internal-embed,.math-studio-special,.math-studio-host,a")) return null;
        if (owners.has(root) && owners.get(root) !== this) return null;
        const old = this.rows.get(root);
        if (old && old.container.parentNode === root && old.equation.body === equation.body && old.equation.display === equation.display && old.path === path2) {
          old.current = current;
          old.suspended = false;
          this.suspended.delete(root);
          return old;
        }
        if (old) this.release(root);
        const original = root.querySelector(":scope > mjx-container");
        if (!original) return null;
        let refs, pairs;
        try {
          refs = mathReferences(equation.body);
          pairs = matchMathNodes(original, equation.body, refs);
        } catch {
          return null;
        }
        const exact = normalize(original.querySelector("mjx-math")?.getAttribute("data-latex") || "") === normalize(equation.body);
        if (!refs.length || !exact) {
          if (root.hasAttribute("data-kl-source-latex")) root.title = "Reference display from an earlier session; reopen the note.";
          return null;
        }
        const row = { root, equation, path: path2, current, refs, original, originalPairs: pairs, marker: "mjx-klref-" + require("crypto").randomBytes(8).toString("hex"), container: original, latex: equation.body, desired: equation.body, pairs, bindings: [], ticket: 0, rootTitle: root.getAttribute("title"), sourceStamp: root.getAttribute("data-kl-source-latex") };
        this.rows.set(root, row);
        owners.set(root, this);
        return row;
      }
      valid(row) {
        return !this.closed && !row.suspended && this.rows.get(row.root) === row && row.root.isConnected && row.current() && row.container.parentNode === row.root;
      }
      suspend(root) {
        const row = this.rows.get(root);
        if (!row) return;
        row.suspended = true;
        row.ticket++;
        this.queue.delete(row);
        this.suspended.delete(root);
        this.suspended.set(root, row);
        while (this.suspended.size > 64) this.release(this.suspended.keys().next().value);
      }
      painted(row) {
        return row.root.matches(".study-math-underlined") || !!row.root.querySelector(PAINT);
      }
      update(row, targets) {
        if (!this.valid(row)) {
          this.release(row.root);
          return;
        }
        const resolved = row.refs.map((ref) => targets[ref.target]);
        if (row.lastTargets && resolved.every((target, i) => target === row.lastTargets[i]) && row.latex === row.desired && row.pairs && row.boundSignature !== null && row.boundSignature !== void 0 && !row.issue) return;
        const next = projectMath(row.equation.body, targets, row.refs);
        if (next.refs.some((ref) => ref.state.pending)) return;
        row.lastTargets = resolved;
        row.next = next;
        if (row.desired !== next.latex) {
          row.desired = next.latex;
          row.ticket++;
          this.queue.delete(row);
        }
        if (next.latex === row.latex && row.pairs) {
          this.bind(row);
          return;
        }
        if (this.painted(row)) {
          row.root.title = "Reference label update deferred to preserve the annotations on this equation.";
          row.issue = "annotation-projection-pending";
          return;
        }
        if (this.queue.has(row) || row.rendering?.latex === next.latex && row.rendering.ticket === row.ticket) return;
        this.queue.add(row);
        this.schedule();
      }
      schedule() {
        if (this.closed || this.timer || this.busy || !this.queue.size) return;
        this.timer = this.document.defaultView.setTimeout(() => {
          this.timer = null;
          void this.pump();
        }, 0);
      }
      async pump() {
        if (this.closed || this.busy) return;
        this.busy = true;
        const row = this.queue.values().next().value;
        this.queue.delete(row);
        if (!row) {
          this.busy = false;
          return;
        }
        const ticket = row.ticket, latex = row.desired;
        row.rendering = { latex, ticket };
        try {
          if (!this.valid(row) || this.painted(row)) return;
          this.api ||= require("obsidian");
          await this.api.loadMathJax();
          if (!this.valid(row) || row.ticket !== ticket) return;
          let replacement, renderDocument, pairs;
          if (latex === row.equation.body && row.originalPairs) {
            replacement = row.original;
            pairs = row.originalPairs;
          } else {
            const rendered = markedProjection(row.next, row.marker);
            replacement = this.api.renderMath(rendered, row.equation.display);
            renderDocument = replacement.ownerDocument;
            await this.api.finishRenderMath();
            pairs = matchMarkedNodes(replacement, rendered, row.next.refs, row.marker);
          }
          if (!this.valid(row) || row.ticket !== ticket || this.painted(row)) return;
          if (!pairs) {
            row.issue = "render-projection-mismatch";
            row.root.title = "This reference could not be mapped to rendered math. Its original equation is preserved.";
            return;
          }
          this.unbind(row);
          row.container.replaceWith(this.document.adoptNode(replacement));
          row.container = replacement;
          row.pairs = pairs;
          row.latex = latex;
          row.root.dataset.klSourceLatex = row.equation.body;
          if (replacement !== row.original) replacement.dataset.klSourceLatex = row.equation.body;
          for (const tag of replacement.querySelectorAll(".mjx-ss")) tag.dataset.studySymbolPath = row.path;
          this.syncStyles(renderDocument);
          this.bind(row);
        } catch (error) {
          if (this.valid(row)) {
            row.issue = "render-failed";
            row.root.title = "Reference display failed: " + error.message;
          }
        } finally {
          row.rendering = null;
          this.busy = false;
          this.schedule();
        }
      }
      bind(row) {
        const signature = JSON.stringify(row.next?.refs.map((r) => r.state.issue || ""));
        if (row.boundSignature === signature) return;
        this.unbind(row);
        delete row.issue;
        row.boundSignature = signature;
        if (row.rootTitle === null) row.root.removeAttribute("title");
        else row.root.title = row.rootTitle;
        row.pairs?.forEach(({ node, ref }, i) => {
          const state = row.next?.refs[i]?.state, attrs = { "data-kl-target": ref.target, "data-kl-source": row.path, "data-kl-kind": "math", "title": state?.issue || (row.root.closest(".markdown-source-view") ? "Click to edit \xB7 Cmd/Ctrl-click to open \xB7 Shift-Cmd/Ctrl-click in new tab" : "Open reference \xB7 Cmd/Ctrl-click in new tab") };
          const saved = Object.keys(attrs).map((key) => [key, node.getAttribute(key)]), had = node.classList.contains("kl-math-reference");
          for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
          node.classList.add("kl-math-reference");
          row.bindings.push(() => {
            if (!had) node.classList.remove("kl-math-reference");
            for (const [key, value] of saved) {
              if (value === null) node.removeAttribute(key);
              else node.setAttribute(key, value);
            }
          });
        });
      }
      unbind(row) {
        row.boundSignature = null;
        for (const restore of row.bindings.splice(0)) restore();
      }
      release(root) {
        const row = this.rows.get(root);
        if (!row) return;
        row.ticket++;
        this.queue.delete(row);
        this.unbind(row);
        if (row.container !== row.original && row.container.parentNode === root) row.container.replaceWith(row.original);
        if (root.getAttribute("data-kl-source-latex") === row.equation.body) {
          if (row.sourceStamp === null) root.removeAttribute("data-kl-source-latex");
          else root.setAttribute("data-kl-source-latex", row.sourceStamp);
        }
        if (row.rootTitle === null) root.removeAttribute("title");
        else root.title = row.rootTitle;
        this.rows.delete(root);
        this.suspended.delete(root);
        if (owners.get(root) === this) owners.delete(root);
      }
      syncStyles(sourceDocument) {
        if (!sourceDocument || sourceDocument === this.document) return;
        const source = sourceDocument.getElementById("MJX-CHTML-styles");
        if (!source) return;
        let target = this.document.getElementById("MJX-CHTML-styles");
        if (!target) {
          target = this.document.createElement("style");
          target.id = source.id;
          this.document.head.append(target);
        }
        const css = source.sheet ? Array.from(source.sheet.cssRules, (r) => r.cssText).join("\n") : source.textContent;
        if (target.textContent !== css) target.textContent = css;
      }
      close() {
        this.closed = true;
        this.document.defaultView.clearTimeout(this.timer);
        this.timer = null;
        for (const root of [...this.rows.keys()]) this.release(root);
        this.queue.clear();
      }
    };
    module2.exports = { MathReferenceRenderer };
  }
});

// plugin/callout-locations.js
var require_callout_locations = __commonJS({
  "plugin/callout-locations.js"(exports2, module2) {
    var locations = /* @__PURE__ */ new WeakMap();
    function remember(element, read) {
      if (element) locations.set(element, read);
    }
    function locate(element) {
      const read = locations.get(element);
      return read ? read() : null;
    }
    module2.exports = { remember, locate };
  }
});

// plugin/reference-fragments.js
var require_reference_fragments = __commonJS({
  "plugin/reference-fragments.js"(exports2, module2) {
    var { EditorView } = require("@codemirror/view");
    var { MarkdownRenderChild, editorInfoField } = require("obsidian");
    var { sectionReferences, sectionHeadings, matchAnchors, captureAnchor, restoreAnchor } = require_reference_reading_model();
    var { scan } = require_markdown_structure();
    var { labelState } = require_reference_model();
    var { sectionMathPairs } = require_math_reference_model();
    var { MathReferenceRenderer } = require_math_reference_renderer();
    var MAX_FRAGMENT = 65536;
    function mathNeedsSeed(update, rows, retained = [], linkedDisplay = () => false) {
      const spans = [...rows.values()].filter((row) => row.equations?.length).concat(retained);
      const touches = (from, to) => spans.some((row) => (!row.doc || row.doc === update.startState?.doc || row.doc === update.state?.doc) && from <= row.to && to >= row.from);
      if (update.docChanged) {
        let needed = false;
        update.changes?.iterChanges((a, b, _c, _d, inserted) => {
          if (touches(a, b) || inserted.length > MAX_FRAGMENT || /klref/.test(inserted.toString())) needed = true;
        });
        if (needed) return true;
      }
      if (update.selectionSet) for (const state of [update.startState, update.state]) {
        const head = state.selection?.main?.head;
        if (head == null) continue;
        if (touches(head, head)) return true;
        const line = state.doc.lineAt(head);
        if (line.length > MAX_FRAGMENT || /klref/.test(line.text)) return true;
        if (linkedDisplay(state, head)) return true;
      }
      return false;
    }
    function fragmentSource(view, element) {
      if (!element.isConnected || element.closest(".cm-editor") !== view.dom) return null;
      const callout = element.closest(".cm-callout"), widget = callout || (element.matches(".math") ? element : null), parent = widget?.parentNode;
      if (!parent) return null;
      if (!callout && element.closest("a,.internal-embed,.math-studio-special,.math-studio-host,.kl-dynamic-reference")) return null;
      const index = Array.prototype.indexOf.call(parent.childNodes, widget);
      let from, to;
      try {
        from = view.posAtDOM(parent, index);
        to = view.posAtDOM(parent, index + 1);
      } catch {
        return null;
      }
      const doc = view.state.doc;
      if (from < 0 || to <= from || to > doc.length || to - from > MAX_FRAGMENT) return null;
      const text = doc.sliceString(from, to);
      if (callout) {
        if (doc.lineAt(from).from !== from || !(to === doc.length || doc.lineAt(to).from === to || doc.lineAt(to).to === to)) return null;
        if (!/^\s*>\s*\[!/.test(text)) return null;
      } else {
        if (element.classList.contains("math-block") ? !/^\$\$[\s\S]*\$\$(?:\r?\n)?$/.test(text) : !/^\$(?!\$)[^\n]*\$$/.test(text)) return null;
      }
      return { from, to, text };
    }
    var EditorFragments = class {
      constructor(owner) {
        this.owner = owner;
        this.rows = /* @__PURE__ */ new Map();
        this.serial = 0;
        this.parseCount = 0;
        this.originals = /* @__PURE__ */ new WeakMap();
        this.cleanups = [];
        this.closed = false;
        this.math = new MathReferenceRenderer(owner.view.dom.ownerDocument);
      }
      add(element, release = () => {
      }, schedule = true) {
        const key = element.closest(".cm-callout") || element;
        let row = this.rows.get(key);
        if (!row) {
          row = { id: ++this.serial, pairs: [], headers: [], equations: [], text: null, releases: /* @__PURE__ */ new Set() };
          this.rows.set(key, row);
        }
        const changed = !row.releases.has(release);
        row.releases.add(release);
        if (schedule && changed) this.schedule();
        return key;
      }
      remove(element, release) {
        if (this.closed) return;
        const key = element.closest(".cm-callout") || element, row = this.rows.get(key);
        if (!row) return;
        if (release) row.releases.delete(release);
        if (release && row.releases.size) return;
        this.cleanups.push({ pairs: row.pairs, headers: row.headers, equations: row.equations, suspend: true });
        this.rows.delete(key);
        this.schedule();
      }
      schedule() {
        if (this.closed) return;
        const view = this.owner.view;
        view.requestMeasure({ key: this, read: () => this.read(), write: (result) => this.write(result) });
      }
      read() {
        if (this.closed) return null;
        if (this.seedPending) {
          this.seedPending = false;
          this.seed?.();
        }
        const view = this.owner.view, doc = view.state.doc, rows = [];
        for (const [element, row] of this.rows) {
          if (!element.isConnected || element.closest(".cm-editor") !== view.dom) {
            this.cleanups.push({ pairs: row.pairs, headers: row.headers, equations: row.equations, suspend: true });
            this.rows.delete(element);
            for (const release of row.releases) release();
            continue;
          }
          if (this.owner.livePreview === false || view.inView === false) continue;
          const source = fragmentSource(view, element);
          if (!source) continue;
          const rendered = element.matches(".math") ? element.querySelector(":scope > mjx-container") : element.querySelector(".callout");
          if (row.rendered && (row.rendered !== rendered && this.math.rows.get(element)?.container !== rendered || row.path !== this.owner.path)) {
            this.cleanups.push({ pairs: row.pairs, headers: row.headers, equations: row.equations });
            row.pairs = [];
            row.headers = [];
            row.equations = [];
            row.text = null;
          }
          row.rendered = rendered;
          if (row.text !== null && row.text !== source.text) {
            this.cleanups.push({ pairs: [], headers: row.headers, equations: row.equations });
            row.pairs = [];
            row.headers = [];
            row.equations = [];
            continue;
          }
          if (row.text === null) {
            row.text = source.text;
            this.parseCount++;
            row.path = this.owner.path;
            const parsed = scan(source.text), refs = sectionReferences(source.text, parsed);
            row.headers = sectionHeadings(source.text, element, parsed);
            row.equations = sectionMathPairs(source.text, element, parsed);
            row.current = () => !this.closed && row.path === this.owner.path && this.owner.livePreview !== false && this.owner.view.inView !== false && this.rows.get(element) === row && fragmentSource(this.owner.view, element)?.text === row.text;
            for (const header of row.headers) require_callout_locations().remember(header.element, () => {
              if (this.closed || !this.rows.has(element) || !row.headers.includes(header)) return null;
              const current = fragmentSource(this.owner.view, element);
              if (!current || current.text !== row.text) return null;
              const doc2 = this.owner.view.state.doc;
              return { path: this.owner.path, text: doc2.toString(), line: doc2.lineAt(current.from).number + header.lineOffset };
            });
            let pairs = matchAnchors(refs, [...element.querySelectorAll("a[href],a[data-href]")]);
            if (pairs?.some((p) => p.anchor.hasAttribute("data-kl-target") && !this.originals.has(p.anchor))) pairs = null;
            row.pairs = (pairs || []).map((pair) => {
              if (!this.originals.has(pair.anchor)) this.originals.set(pair.anchor, captureAnchor(pair.anchor));
              const presentation = this.originals.get(pair.anchor);
              return { ...pair, presentation, original: presentation.nodes, displayed: null };
            });
          }
          row.line = view.state.doc.lineAt(source.from).number;
          row.from = source.from;
          row.to = source.to;
          row.doc = doc;
          rows.push(row);
        }
        return { doc, rows };
      }
      restorePending() {
        for (const row of this.cleanups.splice(0)) {
          for (const pair of row.pairs) restoreAnchor(pair.anchor, pair.presentation);
          for (const header of row.headers) this.owner.headings?.remove(header.element);
          for (const item of row.equations || []) row.suspend ? this.math.suspend(item.root) : this.math.release(item.root);
        }
      }
      write(measured) {
        if (this.closed) return;
        this.restorePending();
        if (!measured || measured.doc !== this.owner.view.state.doc) return;
        this.targets = measured.rows.flatMap((row) => [...row.pairs.map((pair) => pair.ref.target), ...row.equations.flatMap((item) => item.refs.map((ref) => ref.target))]);
        this.calloutLines = measured.rows.flatMap((row) => row.headers.map((header) => row.line + header.lineOffset));
        this.owner.publish();
        this.calloutsWaitingForDoc = this.owner.calloutsDoc !== measured.doc && measured.rows.some((row) => row.headers.length) ? measured.doc : null;
        for (const row of measured.rows) for (const header of row.headers) {
          if (this.owner.calloutsDoc !== measured.doc) continue;
          const occurrence = this.owner.callouts?.[row.line + header.lineOffset];
          if (occurrence?.title === header.title && occurrence?.sourceStyle?.toLowerCase() === header.type) this.owner.headings?.render(header.element, occurrence);
          else this.owner.headings?.remove(header.element);
        }
        for (const row of measured.rows) for (const pair of row.pairs) {
          const { anchor, ref } = pair, state = labelState(ref, this.owner.results[ref.target]);
          anchor.classList.add("kl-dynamic-reference");
          anchor.dataset.klTarget = ref.target;
          anchor.dataset.klSource = this.owner.path;
          if (state.issue) anchor.title = state.issue;
          else anchor.removeAttribute("title");
          const next = state.changed ? state.label : null;
          if (next === pair.displayed) continue;
          pair.displayed = next;
          anchor.replaceChildren();
          if (next !== null) this.owner.titles.render(anchor, "fragment:" + row.id + ":" + ref.from, next, { inline: true });
          else for (const node of pair.original) anchor.appendChild(node.cloneNode(true));
        }
        this.owner.titles.flush();
        for (const fragment of measured.rows) for (const item of fragment.equations) {
          const row = this.math.claim(item.root, item.equation, this.owner.path, fragment.current);
          if (row) {
            row.span = { from: fragment.from, to: fragment.to, doc: measured.doc, path: this.owner.path };
            this.math.update(row, this.owner.results);
          }
        }
      }
      invalidate() {
        this.schedule();
      }
      retainedSpans() {
        return [...this.math.rows.values()].map((row) => row.span).filter((span) => span && span.path === this.owner.path);
      }
      mapSpans(update) {
        if (!update.docChanged) return;
        for (const span of [...this.rows.values(), ...this.retainedSpans()]) if (span.doc === update.startState.doc) {
          span.from = update.changes.mapPos(span.from, -1);
          span.to = update.changes.mapPos(span.to, 1);
          span.doc = update.state.doc;
        }
      }
      close() {
        this.closed = true;
        this.restorePending();
        this.math.close();
        for (const row of this.rows.values()) {
          for (const pair of row.pairs) restoreAnchor(pair.anchor, pair.presentation);
          for (const header of row.headers) this.owner.headings?.remove(header.element);
          for (const release of row.releases) release();
        }
        this.rows.clear();
        this.targets = [];
        this.calloutLines = [];
      }
    };
    function registerEditorFragments(plugin, owners) {
      const windows = /* @__PURE__ */ new Map();
      let closed = false, mathReady = null;
      function windowState(doc) {
        if (windows.has(doc)) return windows.get(doc);
        const records = /* @__PURE__ */ new Map();
        const observer = new doc.defaultView.IntersectionObserver((entries) => {
          for (const entry of entries) {
            const record = records.get(entry.target);
            if (!record) continue;
            if (!entry.target.isConnected && record.wasConnected) {
              record.release();
              continue;
            }
            record.wasConnected = entry.target.isConnected;
            const root = entry.target.closest(".cm-editor");
            const view = root ? EditorView.findFromDOM(root) : null;
            const owner = view && view.inView !== false && view.state.field(editorInfoField, false)?.file?.path === record.path ? owners.get(view) : null;
            if (record.owner && record.owner !== owner) record.owner.fragments.remove(record.key || entry.target, record.release);
            record.owner = owner;
            if (owner) record.key = owner.fragments.add(entry.target, record.release);
          }
        }, { root: null, rootMargin: "100px" });
        const value = { records, observer, close() {
          observer.disconnect();
          for (const [el, r] of records) r.owner?.fragments.remove(r.key || el, r.release);
          records.clear();
        } };
        windows.set(doc, value);
        return value;
      }
      function track(element, path2, owner = null, schedule = true) {
        const state = windowState(element.ownerDocument);
        let record = state.records.get(element);
        if (!record) {
          record = { path: path2, owner: null };
          record.release = () => {
            state.observer.unobserve(element);
            state.records.delete(element);
            record.owner?.fragments.remove(record.key || element, record.release);
            record.owner = null;
          };
          state.records.set(element, record);
          state.observer.observe(element);
        }
        if (owner) {
          const key = element.closest(".cm-callout") || element;
          if (record.owner && (record.owner !== owner || record.key !== key)) record.owner.fragments.remove(record.key || element, record.release);
          record.path = path2;
          record.owner = owner;
          record.wasConnected = element.isConnected;
          record.key = owner.fragments.add(element, record.release, schedule);
        }
        return record.release;
      }
      plugin.registerMarkdownPostProcessor((element, ctx) => {
        if (closed || ctx.getSectionInfo(element) || !(element.matches(".callout,.math") || element.querySelector(".callout"))) return;
        const release = track(element, ctx.sourcePath);
        const child = new MarkdownRenderChild(element);
        child.onunload = release;
        ctx.addChild(child);
      });
      plugin.registerEvent(plugin.app.workspace.on("window-close", (_c, win) => {
        windows.get(win.document)?.close();
        windows.delete(win.document);
      }));
      plugin.register(() => {
        closed = true;
        for (const state of windows.values()) state.close();
        windows.clear();
      });
      return (owner) => {
        owner.fragments.seed ||= () => {
          if (closed || owner.closed || owner.view.inView === false || owner.livePreview === false) return;
          for (const element of owner.view.contentDOM.querySelectorAll(".cm-callout > .markdown-rendered"))
            if (element.isConnected && element.closest(".cm-editor") === owner.view.dom && (element.querySelector(".callout") || element.querySelector("a[href],a[data-href]")))
              track(element, owner.path, owner, false);
          let pendingMath = false;
          for (const element of owner.view.contentDOM.querySelectorAll(".math")) {
            if (element.closest(".cm-callout,a,.internal-embed,.math-studio-special,.math-studio-host,.kl-dynamic-reference")) continue;
            if (element.querySelector('.mjx-klref,[data-latex*="klref"]')) track(element, owner.path, owner, false);
            else if (!element.querySelector("mjx-container") && fragmentSource(owner.view, element)?.text.includes("klref")) pendingMath = true;
          }
          if (pendingMath && !owner.fragments.mathReadyRequested) {
            owner.fragments.mathReadyRequested = true;
            const api = require("obsidian");
            mathReady ||= Promise.resolve().then(() => api.loadMathJax()).then(() => api.finishRenderMath());
            void mathReady.then(() => {
              if (!closed && !owner.closed) {
                owner.fragments.seedPending = true;
                owner.fragments.schedule();
              }
            }, () => {
            });
          }
        };
        owner.fragments.seedPending = true;
        owner.fragments.schedule();
      };
    }
    module2.exports = { fragmentSource, EditorFragments, registerEditorFragments, MAX_FRAGMENT, mathNeedsSeed };
  }
});

// plugin/math-seed.js
var require_math_seed = __commonJS({
  "plugin/math-seed.js"(exports2, module2) {
    var MAX_BYTES = 65536;
    var MAX_NODES = 256;
    function linkedDisplayAt(state, head, tree) {
      const seen = /* @__PURE__ */ new Set();
      for (const side of [-1, 1]) {
        let node = tree.resolveInner(head, side);
        while (node && node.name !== "HyperMD-math") node = node.parent;
        if (!node || seen.has(node.from)) continue;
        seen.add(node.from);
        if (linkedLine(state, node)) return true;
      }
      return false;
    }
    function linkedLine(state, node) {
      let first = node, last = node, count = 1;
      const marker = (n, kind) => [n.firstChild, n.lastChild].some((c) => c?.name.includes("formatting-math-" + kind));
      const adjacent = (left, right) => left?.name === "HyperMD-math" && right?.name === "HyperMD-math" && right.from - left.to <= 2 && /^[\r\n]*$/.test(state.doc.sliceString(left.to, right.from));
      let complete = true;
      while (!marker(first, "begin")) {
        const prior = first.prevSibling;
        if (!adjacent(prior, first) || marker(prior, "end") || ++count > MAX_NODES || last.to - prior.from > MAX_BYTES) {
          complete = false;
          break;
        }
        first = prior;
      }
      if (complete) while (!marker(last, "end")) {
        const next = last.nextSibling;
        if (!adjacent(last, next) || marker(next, "begin") || ++count > MAX_NODES || next.to - first.from > MAX_BYTES) {
          complete = false;
          break;
        }
        last = next;
      }
      const linked = complete && last.to - first.from <= MAX_BYTES && state.doc.sliceString(first.from, last.to).includes("klref");
      return linked;
    }
    module2.exports = { linkedDisplayAt };
  }
});

// plugin/reference-display.js
var require_reference_display = __commonJS({
  "plugin/reference-display.js"(exports2, module2) {
    var { ViewPlugin, Decoration, WidgetType } = require("@codemirror/view");
    var { StateEffect } = require("@codemirror/state");
    var { syntaxTree } = require("@codemirror/language");
    var { editorInfoField, editorLivePreviewField, Notice: Notice2 } = require("obsidian");
    var { lineReferences, labelState } = require_reference_model();
    var { ReferenceConsumer } = require_reference_resolver();
    var { referencePresentation } = require_reference_presentation();
    var { TitleRenderer: TitleRenderer2 } = require_title_renderer();
    var { CalloutHeadings } = require_callout_presentation();
    var { EditorFragments, registerEditorFragments, mathNeedsSeed } = require_reference_fragments();
    var { navigationIntent } = require_reference_navigation();
    var { linkedDisplayAt } = require_math_seed();
    var refresh = StateEffect.define();
    function isLink(state, pos) {
      let node = syntaxTree(state).resolveInner(pos, 1), link = false;
      for (; node; node = node.parent) {
        if (/code|comment/i.test(node.name)) return false;
        if (/link/i.test(node.name)) link = true;
      }
      return link;
    }
    function touches(selection, ref) {
      return selection.ranges.some((r) => r.from <= ref.to && r.to >= ref.from);
    }
    function visibleReferences(view) {
      const refs = [], seen = /* @__PURE__ */ new Set();
      for (const range of view.visibleRanges) for (let pos = range.from; pos <= range.to && refs.length < 257; ) {
        const line = view.state.doc.lineAt(pos);
        if (!seen.has(line.number)) {
          seen.add(line.number);
          for (const item of lineReferences(line.text, 257 - refs.length)) {
            if (!isLink(view.state, line.from + item.labelFrom)) continue;
            const ref = { ...item };
            for (const key of ["from", "to", "labelFrom", "labelTo", "tokenFrom"]) ref[key] += line.from;
            refs.push(ref);
          }
        }
        if (line.to >= range.to) break;
        pos = line.to + 1;
      }
      return refs;
    }
    var LabelWidget = class extends WidgetType {
      constructor(owner, ref, state, path2, target) {
        super();
        this.owner = owner;
        this.ref = ref;
        this.label = state.label;
        this.path = path2;
        this.link = target?.link || ref.link;
        this.renderKey = ++owner.renderSerial;
      }
      eq(other) {
        return this.owner === other.owner && this.ref.kind === other.ref.kind && this.ref.target === other.ref.target && this.label === other.label && this.path === other.path && this.link === other.link;
      }
      toDOM(view) {
        const a = view.dom.ownerDocument.createElement("a");
        a.className = "kl-dynamic-reference";
        a.dataset.klTarget = this.ref.target;
        a.dataset.klSource = this.path;
        if (this.ref.kind === "library") a.href = this.ref.link;
        else {
          a.classList.add("internal-link");
          a.dataset.href = this.link;
          a.href = this.link;
        }
        this.owner.titles.render(a, String(this.renderKey), this.label, { inline: true });
        this.owner.titles.flush();
        return a;
      }
      ignoreEvent(event) {
        return event.type === "mousedown" || event.type === "click";
      }
    };
    function registerReferenceDisplay(plugin) {
      const liveOwners = /* @__PURE__ */ new Set(), owners = /* @__PURE__ */ new WeakMap(), seedFragments = registerEditorFragments(plugin, owners);
      plugin.registerEditorExtension(ViewPlugin.fromClass(class {
        constructor(view) {
          this.view = view;
          this.closed = false;
          this.renderSerial = 0;
          this.results = {};
          this.decorations = Decoration.none;
          this.titles = new TitleRenderer2(view.dom.ownerDocument, () => this.redraw());
          this.headings = new CalloutHeadings();
          this.callouts = {};
          this.consumer = new ReferenceConsumer(plugin.referenceResolver, (results, error, callouts, resultDoc) => {
            if (this.closed) return;
            const before = referencePresentation(this);
            this.issue = error?.message;
            if (results) Object.assign(this.results, results);
            if (callouts) {
              this.callouts = callouts;
              this.calloutsDoc = resultDoc;
            }
            if (before !== referencePresentation(this)) this.redraw();
            else if (resultDoc && this.fragments?.calloutsWaitingForDoc === resultDoc) this.fragments.schedule();
          });
          this.fragments = new EditorFragments(this);
          owners.set(view, this);
          liveOwners.add(this);
          this.visibilityKey = {};
          this.snapshot();
          seedFragments(this);
        }
        redraw() {
          if (!this.closed) {
            this.view.dispatch({ effects: refresh.of(null) });
            this.fragments.schedule();
          }
        }
        snapshot() {
          const view = this.view, path2 = view.state.field(editorInfoField, false)?.file?.path;
          if (this.path !== path2) {
            this.results = {};
            this.callouts = {};
            this.calloutsDoc = null;
          }
          this.inView = view.inView;
          this.livePreview = view.state.field(editorLivePreviewField, false);
          this.refs = this.inView && this.livePreview ? visibleReferences(view) : [];
          this.path = path2;
          this.publish();
          this.fragments.schedule();
          this.build();
        }
        publish() {
          if (!this.path || this.closed) return;
          const doc = this.view.state.doc, targets = [.../* @__PURE__ */ new Set([...this.refs.map((r) => r.target), ...this.fragments.targets || []])].sort();
          const calloutLines = [...new Set(this.fragments.calloutLines || [])].sort((a, b) => a - b);
          const ready = plugin.referenceResolver.peekEditor?.({ path: this.path, doc });
          if (ready?.full) {
            this.callouts = ready.callouts;
            this.calloutsDoc = doc;
          }
          const key = JSON.stringify([this.path, targets, calloutLines]);
          if (this.publishedDoc === doc && this.publishedKey === key) return;
          this.publishedDoc = doc;
          this.publishedKey = key;
          this.consumer.update({ path: this.path, doc, documentId: plugin.editorClaimViews?.get(this.view)?.documentId, text: () => doc.toString(), targets, calloutLines });
        }
        build() {
          const view = this.view;
          if (!view.state.field(editorLivePreviewField, false)) {
            this.decorations = Decoration.none;
            return;
          }
          const ranges = [];
          for (const ref of this.refs || []) {
            const state = labelState(ref, this.results[ref.target]);
            const touch = touches(view.state.selection, ref);
            const attributes = { "data-kl-target": ref.target, "data-kl-source": this.path || "" };
            if (this.issue || state.issue) attributes["title"] = this.issue || state.issue;
            if (state.changed && !touch) ranges.push(Decoration.replace({ widget: new LabelWidget(this, ref, state, this.path, this.results[ref.target]) }).range(ref.labelFrom, ref.labelTo));
            else ranges.push(Decoration.mark({ class: "kl-dynamic-reference" + (state.issue ? " kl-reference-pending" : ""), attributes }).range(ref.labelFrom, ref.labelTo));
          }
          this.decorations = Decoration.set(ranges, true);
        }
        update(update) {
          const visibilityChanged = this.inView !== this.view.inView || this.livePreview !== update.state.field(editorLivePreviewField, false);
          if (update.docChanged || update.viewportChanged) this.fragments.invalidate();
          if (update.docChanged || update.viewportChanged || visibilityChanged || this.path !== update.state.field(editorInfoField, false)?.file?.path || syntaxTree(update.startState) !== syntaxTree(update.state)) this.snapshot();
          else if (update.selectionSet || update.transactions.some((t) => t.effects.some((e) => e.is(refresh)))) this.build();
          if ((visibilityChanged || update.viewportChanged || mathNeedsSeed(update, this.fragments.rows, this.fragments.retainedSpans(), (state, head) => linkedDisplayAt(state, head, syntaxTree(state)))) && this.inView && this.livePreview) seedFragments(this);
          this.fragments.mapSpans(update);
        }
        destroy() {
          this.closed = true;
          this.consumer.close();
          this.fragments.close();
          this.titles.close();
          this.headings.close();
          owners.delete(this.view);
          liveOwners.delete(this);
        }
      }, { decorations: (v) => v.decorations }));
      const checkVisibility = () => {
        for (const owner of liveOwners) owner.view.requestMeasure({
          key: owner.visibilityKey,
          read: () => !owner.closed && (owner.inView !== owner.view.inView || owner.livePreview !== owner.view.state.field(editorLivePreviewField, false)),
          // CM forbids dispatch during its measurement cycle. A microtask also
          // allows restored opaque callout widgets to settle before re-seeding.
          write: (changed) => {
            if (changed && !owner.closed && !owner.visibilityPending) {
              owner.visibilityPending = true;
              queueMicrotask(() => {
                owner.visibilityPending = false;
                if (owner.closed) return;
                owner.redraw();
                seedFragments(owner);
              });
            }
          }
        });
      };
      plugin.registerEvent(plugin.app.workspace.on("layout-change", checkVisibility));
      plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", checkVisibility));
      const documents = /* @__PURE__ */ new Map();
      const attach = (doc) => {
        if (documents.has(doc)) return;
        const click = async (event) => {
          if (event.type === "keydown" && event.key !== "Enter") return;
          if (event.type === "click" && event.button !== 0 || event.type === "auxclick" && event.button !== 1) return;
          const el = (event.target?.nodeType === 3 ? event.target.parentElement : event.target)?.closest?.(".kl-dynamic-reference[data-kl-target],.kl-math-reference[data-kl-target]");
          const target = el?.dataset.klTarget, path2 = el?.dataset.klSource;
          if (!target || target.startsWith("lib.") || !path2) return;
          const intent = navigationIntent(event, { math: el.dataset.klKind === "math", editor: !!el.closest(".markdown-source-view") });
          if (!intent) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          try {
            const root = el.closest(".cm-editor"), view = root ? require("@codemirror/view").EditorView.findFromDOM(root) : null;
            let result;
            if (view) {
              const claim = plugin.editorClaimViews?.get(view);
              if (!target.includes(".") || claim?.documentId && target.startsWith(claim.documentId + ".")) {
                const snapshot = view.state.doc;
                const overlay = await plugin.referenceResolver.editor({ path: path2, doc: snapshot, text: () => snapshot.toString() }, [target]);
                if (view.state.doc !== snapshot) return;
                result = overlay.targets[target];
              }
            }
            if (!result || ["not-own-target", "identity-unavailable"].includes(result.issueCode)) result = (await plugin.referenceResolver.resolve(path2, [target]))[target];
            if (!result || result.issue) throw Error(result?.issue || "Reference is unavailable");
            await plugin.app.workspace.openLinkText(result.link, path2, intent.newTab);
          } catch (error) {
            new Notice2(error.message);
          }
        };
        const down = (event) => {
          if (event.button !== 0 && event.button !== 1) return;
          const el = (event.target?.nodeType === 3 ? event.target.parentElement : event.target)?.closest?.(".kl-math-reference[data-kl-target]");
          if (!el?.closest(".markdown-source-view") || !(event.metaKey || event.ctrlKey || event.button === 1)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        doc.addEventListener("mousedown", down, true);
        for (const type of ["click", "auxclick", "keydown"]) doc.addEventListener(type, click, true);
        documents.set(doc, () => {
          doc.removeEventListener("mousedown", down, true);
          for (const type of ["click", "auxclick", "keydown"]) doc.removeEventListener(type, click, true);
        });
      };
      plugin.app.workspace.onLayoutReady(() => {
        attach(document);
        plugin.app.workspace.iterateAllLeaves((leaf) => attach(leaf.view.containerEl.ownerDocument));
      });
      plugin.registerEvent(plugin.app.workspace.on("window-open", (_container, win) => attach(win.document)));
      plugin.registerEvent(plugin.app.workspace.on("window-close", (_container, win) => {
        documents.get(win.document)?.();
        documents.delete(win.document);
      }));
      plugin.register(() => {
        for (const close of documents.values()) close();
        documents.clear();
      });
    }
    module2.exports = { registerReferenceDisplay, visibleReferences, touches, isLink };
  }
});

// plugin/reference-print.js
var require_reference_print = __commonJS({
  "plugin/reference-print.js"(exports2, module2) {
    var { MarkdownRenderer: MarkdownRenderer2, MarkdownRenderChild, loadMathJax, renderMath, finishRenderMath } = require("obsidian");
    var { componentHeaders } = require_component_model();
    var { sectionReferences, matchAnchors } = require_reference_reading_model();
    var { sectionMathPairs, projectMath } = require_math_reference_model();
    var { scan } = require_markdown_structure();
    var { labelState } = require_reference_model();
    async function inline(plugin, text, target, path2, child) {
      const stage = target.ownerDocument.createElement("div");
      await MarkdownRenderer2.render(plugin.app, text, stage, path2, child);
      const only = stage.childNodes.length === 1 && stage.firstChild.nodeName === "P" ? stage.firstChild : stage;
      target.replaceChildren(...only.childNodes);
    }
    function registerPrintReferences(plugin) {
      plugin.registerMarkdownPostProcessor(async (el, ctx) => {
        if (!el.closest(".print") || ctx.getSectionInfo(el)) return;
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!file) return;
        const text = await plugin.app.vault.cachedRead(file), doc = { text }, parsed = scan(text), refs = sectionReferences(text, parsed), equations = sectionMathPairs(text, el, parsed);
        const targets = [.../* @__PURE__ */ new Set([...refs.map((r) => r.target), ...equations.flatMap((e) => e.refs.map((r) => r.target))])];
        const result = await plugin.referenceResolver.editor({ path: ctx.sourcePath, doc, text: () => text }, targets, [], true);
        const rows = new Map((result.calloutList || []).map((r) => [r.line - 1, r]));
        const headers = componentHeaders(text), byAt = new Map(headers.map((h) => [(h.metadata || "").split(/\s+/).find((t) => t.startsWith("at="))?.slice(3), h]));
        const child = new MarkdownRenderChild(el);
        ctx.addChild(child);
        for (const c of el.querySelectorAll(".callout")) {
          const at = (c.dataset.calloutMetadata || "").split(/\s+/).find((t) => t.startsWith("at="))?.slice(3), header = at && byAt.get(at), row = header && rows.get(header.line), title = c.querySelector(":scope>.callout-title>.callout-title-inner");
          if (!row || !title) continue;
          const label = require_callout_presentation().presentation(row).label;
          await inline(plugin, label, title, ctx.sourcePath, child);
        }
        for (const { ref, anchor } of matchAnchors(refs, [...el.querySelectorAll("a[href],a[data-href]")]) || []) {
          const state = labelState(ref, result.targets[ref.target]);
          anchor.classList.add("kl-dynamic-reference");
          if (state.changed) {
            await inline(plugin, state.label, anchor, ctx.sourcePath, child);
          }
        }
        if (equations.length) {
          await loadMathJax();
          for (const item of equations) {
            const projected = projectMath(item.equation.body, result.targets, item.refs);
            if (projected.latex !== item.equation.body && !projected.refs.some((r) => r.state.pending)) {
              const rendered = renderMath(projected.latex, item.equation.display);
              await finishRenderMath();
              item.root.replaceChildren(rendered);
            }
          }
        }
      });
    }
    module2.exports = { registerPrintReferences };
  }
});

// plugin/reference-reading.js
var require_reference_reading = __commonJS({
  "plugin/reference-reading.js"(exports2, module2) {
    var { MarkdownRenderChild } = require("obsidian");
    var { ReferenceConsumer } = require_reference_resolver();
    var { labelState } = require_reference_model();
    var { sectionReferences, sectionHeadings, matchAnchors, SectionSources, captureAnchor, restoreAnchor } = require_reference_reading_model();
    var { scan } = require_markdown_structure();
    var { readTextClaim } = require_document_claim();
    var { CalloutHeadings } = require_callout_presentation();
    var { TitleRenderer: TitleRenderer2 } = require_title_renderer();
    var { sectionMathPairs } = require_math_reference_model();
    var { MathReferenceRenderer } = require_math_reference_renderer();
    function registerReadingReferences(plugin) {
      require_reference_print().registerPrintReferences(plugin);
      const sources = new SectionSources(), sessions = /* @__PURE__ */ new Set(), documents = /* @__PURE__ */ new WeakMap();
      let closed = false;
      class ReadingSession {
        constructor(doc, key, map, path2, sourceText) {
          this.document = doc;
          this.key = key;
          this.map = map;
          this.path = path2;
          this.sections = /* @__PURE__ */ new Map();
          this.results = {};
          this.serial = 0;
          this.closed = false;
          this.titles = new TitleRenderer2(doc, () => this.draw());
          this.math = new MathReferenceRenderer(doc);
          this.sourceText = null;
          this.claim = null;
          this.snapshot = null;
          this.setSource(sourceText);
          this.headings = new CalloutHeadings();
          this.callouts = {};
          this.consumer = new ReferenceConsumer(plugin.referenceResolver, (result, error, callouts, resultDoc) => {
            if (!result || this.closed || resultDoc && resultDoc !== this.snapshot) return;
            this.results = result;
            if (callouts) {
              this.callouts = callouts;
              this.calloutsSnapshot = resultDoc;
            }
            this.draw();
          });
          const win = doc.defaultView;
          this.observer = new win.IntersectionObserver((entries) => {
            for (const entry of entries) {
              const section = this.sections.get(entry.target);
              if (section) section.visible = entry.isIntersecting;
            }
            this.collect();
          }, { root: null, rootMargin: "100px" });
          this.unsubscribe = plugin.referenceResolver.subscribe(() => {
            if (!this.closed) this.collect();
          });
        }
        setSource(text) {
          if (typeof text !== "string" || !text || this.sourceText === text) return;
          for (const root of this.math.rows.keys()) this.math.release(root);
          this.sourceText = text;
          this.claim = readTextClaim(text);
          this.snapshot = { text };
        }
        pendingVisible() {
          for (const section of this.sections.values()) if (section.visible && section.text === null) return true;
          return false;
        }
        add(element, pairs, headers, equations, ctx, text) {
          this.sections.set(element, { pairs, headers, equations, ctx, text, visible: false, valid: false });
          this.observer.observe(element);
          if (text !== null && this.adoptCached()) this.drawHeading(element, this.sections.get(element));
        }
        locate(element, section, info) {
          if (section.text === null && info?.text) {
            const parsed = readSection(element, section.ctx, info);
            section.text = parsed.text;
            section.pairs = parsed.pairs;
            section.headers = parsed.headers;
            section.equations = parsed.equations;
            if (!section.pairs.length && !section.headers.length && !section.equations.length) {
              this.remove(element, false);
              return false;
            }
            capturePairs(section.pairs);
          }
          section.valid = !!info && !!info.text && info.text === this.sourceText && sources.section(this.path, info) === section.text;
          if (section.valid) for (const header of section.headers) {
            header.line = info.lineStart + 1 + header.lineOffset;
            if (!header.locationRegistered) {
              header.locationRegistered = true;
              require_callout_locations().remember(header.element, () => {
                if (this.closed || !this.sections.has(element) || !element.isConnected) return null;
                const current = section.ctx.getSectionInfo(element);
                if (!current?.text || current.text !== this.sourceText || sources.section(this.path, current) !== section.text) return null;
                return { path: this.path, text: current.text, line: current.lineStart + 1 + header.lineOffset };
              });
            }
          }
          else for (const header of section.headers) this.headings.remove(header.element);
          return section.valid;
        }
        remove(element, recollect = true) {
          if (this.closed) return;
          this.observer.unobserve(element);
          for (const pair of this.sections.get(element)?.pairs || []) restoreAnchor(pair.anchor, pair.presentation);
          for (const header of this.sections.get(element)?.headers || []) this.headings.remove(header.element);
          for (const item of this.sections.get(element)?.equations || []) this.math.release(item.root);
          this.sections.delete(element);
          if (!this.sections.size) {
            this.close();
            if (this.map.get(this.key) === this) this.map.delete(this.key);
            sessions.delete(this);
          } else if (recollect) this.collect();
        }
        collect() {
          const targets = /* @__PURE__ */ new Set(), lines = /* @__PURE__ */ new Set(), current = [];
          for (const [element, section] of this.sections) if (section.visible) current.push([element, section, section.ctx.getSectionInfo(element)]);
          const texts = new Set(current.map(([_e, _s, info]) => info?.text).filter((t) => typeof t === "string" && t.length > 0));
          if (texts.size === 1) this.setSource(texts.values().next().value);
          for (const [element, section, info] of current) if (this.locate(element, section, info)) {
            for (const pair of section.pairs) targets.add(pair.ref.target);
            for (const item of section.equations) for (const ref of item.refs) targets.add(ref.target);
            for (const header of section.headers) lines.add(header.line);
          }
          if (this.closed || !this.snapshot) return;
          this.consumer.update({ path: this.path, documentId: this.claim.documentId, doc: this.snapshot, text: () => this.sourceText, targets: [...targets], calloutLines: [...lines] });
          this.draw();
        }
        adoptCached() {
          if (!this.snapshot) return false;
          const ready = plugin.referenceResolver.peekEditor?.({ path: this.path, doc: this.snapshot });
          if (!ready?.full) return false;
          this.callouts = ready.callouts;
          this.calloutsSnapshot = this.snapshot;
          if (this.drawnRows !== ready.callouts || this.drawnSnapshot !== this.snapshot) {
            this.drawnRows = ready.callouts;
            this.drawnSnapshot = this.snapshot;
            for (const [element, section] of this.sections) if (section.text !== null) this.drawHeading(element, section);
          }
          return true;
        }
        drawHeading(element, section) {
          if (!this.locate(element, section, section.ctx.getSectionInfo(element)) || this.calloutsSnapshot !== this.snapshot) return;
          for (const header of section.headers) {
            const occurrence = this.callouts[header.line];
            if (occurrence?.title === header.title && occurrence?.sourceStyle?.toLowerCase() === header.type) this.headings.render(header.element, occurrence);
            else this.headings.remove(header.element);
          }
        }
        draw() {
          this.adoptCached();
          for (const [element, section] of this.sections) if (section.visible) this.drawHeading(element, section);
          for (const section of this.sections.values()) if (section.visible && section.valid) for (const { ref, anchor, original } of section.pairs) {
            const state = labelState(ref, this.results[ref.target]);
            anchor.classList.add("kl-dynamic-reference");
            anchor.dataset.klTarget = ref.target;
            anchor.dataset.klSource = this.path;
            if (state.issue) anchor.setAttribute("title", state.issue);
            else anchor.removeAttribute("title");
            const next = state.changed ? state.label : null;
            if (anchor._klDisplayed === next) continue;
            anchor._klDisplayed = next;
            anchor.replaceChildren();
            if (next !== null) this.titles.render(anchor, String(ref.from) + ":" + section.id, next, { inline: true });
            else for (const node of original) anchor.appendChild(node.cloneNode(true));
          }
          for (const section of this.sections.values()) for (const item of section.equations) {
            if (!section.valid) {
              this.math.release(item.root);
              continue;
            }
            if (!section.visible) continue;
            const snapshot = this.snapshot, row = this.math.claim(item.root, item.equation, this.path, () => !this.closed && section.valid && this.snapshot === snapshot);
            if (row) this.math.update(row, this.results);
          }
          this.titles.flush();
        }
        close() {
          if (this.closed) return;
          this.closed = true;
          this.unsubscribe?.();
          this.consumer.close();
          this.observer.disconnect();
          this.titles.close();
          this.headings.close();
          this.math.close();
          for (const section of this.sections.values()) for (const pair of section.pairs) restoreAnchor(pair.anchor, pair.presentation);
          this.sections.clear();
        }
      }
      function readSection(element, ctx, info) {
        const text = sources.section(ctx.sourcePath, info), parsed = scan(text), refs = sectionReferences(text, parsed), headers = sectionHeadings(text, element, parsed);
        let pairs = matchAnchors(refs, [...element.querySelectorAll("a[href],a[data-href]")]);
        if (!pairs || pairs.some((p) => p.anchor.hasAttribute("data-kl-target"))) pairs = [];
        return { text, pairs, headers, equations: sectionMathPairs(text, element, parsed) };
      }
      function capturePairs(pairs) {
        for (const pair of pairs) {
          pair.presentation = captureAnchor(pair.anchor);
          pair.original = pair.presentation.nodes;
          pair.anchor._klDisplayed = null;
        }
      }
      plugin.registerMarkdownPostProcessor((element, ctx) => {
        if (closed || !(element.matches(".callout") || element.querySelector(".callout,a[href],a[data-href],.math") || element.matches(".math"))) return;
        const info = ctx.getSectionInfo(element);
        if (!info) return;
        const { text, pairs, headers, equations } = info?.text ? readSection(element, ctx, info) : { text: null, pairs: [], headers: [], equations: [] };
        if (text !== null && !pairs.length && !headers.length && !equations.length) return;
        if (ctx.docId == null) return;
        const doc = element.ownerDocument;
        let map = documents.get(doc);
        if (!map) {
          map = /* @__PURE__ */ new Map();
          documents.set(doc, map);
        }
        let session = map.get(ctx.docId);
        if (session && session.path !== ctx.sourcePath) {
          session.close();
          map.delete(ctx.docId);
          sessions.delete(session);
          session = null;
        }
        if (!session) {
          session = new ReadingSession(doc, ctx.docId, map, ctx.sourcePath, info?.text);
          map.set(ctx.docId, session);
          sessions.add(session);
        } else session.setSource(info?.text);
        capturePairs(pairs);
        const child = new MarkdownRenderChild(element);
        child.onunload = () => session.remove(element);
        ctx.addChild(child);
        session.add(element, pairs, headers, equations, ctx, text);
        session.sections.get(element).id = ++session.serial;
        if (info?.text && session.pendingVisible()) session.collect();
      });
      plugin.registerEvent(plugin.app.workspace.on("layout-change", () => {
        for (const session of sessions) if (!session.closed && session.pendingVisible()) session.collect();
      }));
      plugin.register(() => {
        closed = true;
        for (const session of sessions) session.close();
        sessions.clear();
        sources.clear();
      });
    }
    module2.exports = { registerReadingReferences };
  }
});

// plugin/reference-picker.js
var require_reference_picker = __commonJS({
  "plugin/reference-picker.js"(exports2, module2) {
    var { Modal: Modal2, Scope: Scope2, Component: Component2, MarkdownRenderer: MarkdownRenderer2, Notice: Notice2, MarkdownView: MarkdownView2 } = require("obsidian");
    var hash = (text) => require("crypto").createHash("sha256").update(text).digest("hex");
    var ReferencePicker = class extends Modal2 {
      constructor(plugin, editor, info) {
        super(plugin.app);
        this.scope = new Scope2(this.scope);
        this.plugin = plugin;
        this.editor = editor;
        this.info = info;
        this.path = info.file.path;
        this.text = editor.getValue();
        this.snapshot = editor.cm?.state.doc;
        this.referenceSelection = [editor.getCursor("from"), editor.getCursor("to")];
        this.rows = [];
        this.selected = 0;
        this.closed = false;
        this.selectedWords = editor.getSelection();
        this.caret = editor.cm?.coordsAtPos(editor.posToOffset(editor.getCursor("to")));
        this.hasSelection = this.selectedWords.length > 0;
        this.mode = this.hasSelection ? "c" : "auto";
      }
      onOpen() {
        this.modalEl.addClass("kl-reference-modal");
        this.titleEl.setText("Insert reference");
        this.input = this.contentEl.createEl("input", { cls: "kl-reference-search", attr: { type: "search", placeholder: "Find a result in this note\u2026", "aria-label": "Find a result" } });
        this.status = this.contentEl.createDiv({ cls: "kl-reference-status", text: "Loading this note\u2026" });
        const panes = this.panes = this.contentEl.createDiv({ cls: "kl-reference-panes" });
        this.list = panes.createDiv({ cls: "kl-reference-list" });
        this.preview = panes.createDiv({ cls: "kl-reference-preview" });
        const foot = this.contentEl.createDiv({ cls: "kl-reference-footer" });
        this.choice = foot.createSpan({ cls: "kl-reference-choice" });
        this.select = foot.createEl("select", { attr: { "aria-label": "Reference label" } });
        for (const [value, label] of [["auto", "Number or title"], ["n", "Number"], ["t", "Title"], ["b", "Number and title"], ...this.hasSelection ? [["c", "Keep selected words"]] : []]) this.select.createEl("option", { value, text: label });
        this.select.value = this.mode;
        this.select.onchange = () => {
          this.mode = this.select.value;
          this.updateChoice();
        };
        this.insert = foot.createEl("button", { text: "Insert", cls: "mod-cta" });
        this.insert.disabled = true;
        this.insert.onclick = () => this.apply();
        this.contentEl.createDiv({ cls: "kl-reference-hints", text: "\u21B5 insert \xB7 Esc close" });
        this.input.oninput = () => this.filter();
        for (const [key, delta] of [["ArrowDown", 1], ["ArrowUp", -1]]) this.scope.register([], key, () => {
          if (this.select === this.contentEl.ownerDocument.activeElement) return true;
          if (this.rows.length) {
            this.selected = (this.selected + delta + this.rows.length) % this.rows.length;
            this.draw();
          }
          return false;
        });
        this.scope.register([], "Enter", (event) => {
          if (event.isComposing || this.select === this.contentEl.ownerDocument.activeElement) return true;
          this.apply();
          return false;
        });
        this.input.focus();
        this.load();
      }
      async load() {
        try {
          await this.plugin.admission.ready;
          await this.plugin.documentFeed.flush().catch(() => {
          });
          const result = await this.plugin.admission.request("live-editor-reference-preview", { path: this.path, text: this.text, sourceHash: hash(this.text) });
          if (this.closed) return;
          this.catalog = result;
          this.filter();
          if (result.identityContext.status === "uninitialized") {
            this.status.setText("Still reading note metadata; try again in a moment.");
            this.insert.disabled = true;
          }
        } catch (error) {
          if (!this.closed) this.status.setText(error.message);
        }
      }
      filter() {
        if (!this.catalog) return;
        const query = this.input.value.trim().toLocaleLowerCase();
        this.rows = this.catalog.occurrences.filter((o) => !query || (o.title + " " + o.kind + " " + (o.display?.numberLabel || "")).toLocaleLowerCase().includes(query));
        this.selected = 0;
        this.draw();
      }
      draw() {
        this.list.empty();
        const all = this.rows.length, start = Math.max(0, this.selected - 20), end = Math.min(all, start + 60);
        this.panes.style.height = Math.min(300, Math.max(220, all * 48)) + "px";
        this.status.setText(all ? `${all} ${all === 1 ? "result" : "results"} \xB7 This note` : "No matching results in this note");
        for (let i = start; i < end; i++) {
          const row = this.rows[i], button = this.list.createEl("button", { cls: "kl-reference-row" + (i === this.selected ? " is-selected" : "") });
          button.createSpan({ cls: "kl-reference-label", text: row.display?.numberLabel ? row.display.numberLabel : row.kind.charAt(0).toUpperCase() + row.kind.slice(1) });
          button.createSpan({ cls: "kl-reference-title", text: row.display?.title || row.title });
          button.onclick = () => {
            this.selected = i;
            this.draw();
          };
          if (i === this.selected) button.scrollIntoView({ block: "nearest" });
        }
        const current = this.rows[this.selected];
        if (current !== this.previewRow) {
          this.previewRow = current;
          clearTimeout(this.previewTimer);
          this.previewOwner?.unload();
          this.preview.empty();
          if (current) this.previewTimer = setTimeout(() => {
            if (this.closed || this.previewRow !== current) return;
            this.previewOwner = new Component2();
            this.previewOwner.load();
            MarkdownRenderer2.render(this.app, this.text.slice(current.from, current.to), this.preview.createDiv(), this.path, this.previewOwner).catch(() => {
              if (!this.closed) this.status.setText("Preview could not be rendered.");
            });
          }, 100);
        }
        this.updateChoice();
        this.positionNearCaret();
      }
      positionNearCaret() {
        if (!this.caret) return;
        const win = this.contentEl.ownerDocument.defaultView, rect = this.modalEl.getBoundingClientRect();
        const below = win.innerHeight - this.caret.bottom - 20, above = this.caret.top - 20;
        const top = below >= rect.height ? this.caret.bottom + 8 : above >= rect.height ? this.caret.top - rect.height - 8 : Math.max(20, (win.innerHeight - rect.height) / 2);
        Object.assign(this.modalEl.style, { position: "fixed", margin: "0", top: top + "px", left: Math.max(20, Math.min(this.caret.left, win.innerWidth - rect.width - 20)) + "px" });
      }
      updateChoice() {
        const row = this.rows[this.selected], d = row?.display;
        const numbered = !!d?.numberLabel && !d?.issue;
        for (const option of this.select.options) if (option.value === "n" || option.value === "b") option.disabled = !numbered;
        if (!numbered && (this.mode === "n" || this.mode === "b")) {
          this.mode = "auto";
          this.select.value = "auto";
        }
        const label = this.mode === "c" ? this.selectedWords : this.mode === "b" ? d?.bothLabel : this.mode === "t" ? d?.title : this.mode === "n" ? d?.numberLabel : numbered ? d?.numberLabel : d?.title;
        const target = numbered ? d.bothLabel : d?.title;
        this.choice.setText(label ? `${this.mode === "c" ? "Link" : "Insert"} \u201C${label}\u201D \u2192 ${target || ""}` : "");
        this.insert.disabled = this.busy || !row || row.nested || !!d?.issue || !label;
        if (row?.nested) this.status.setText("Nested callout linking is not ready in this pilot.");
        else if (d?.issue || d?.warning) this.status.setText(d.issue || d.warning);
      }
      async apply() {
        if (this.closed || this.insert.disabled || this.busy) return;
        const row = this.rows[this.selected];
        this.busy = true;
        this.updateChoice();
        try {
          if (this.editor.getValue() !== this.text || this.info.file?.path !== this.path) throw Error("The note changed. Close and reopen Insert reference.");
          const plan = await this.plugin.admission.request("live-editor-reference-plan", { path: this.path, text: this.text, sourceHash: hash(this.text), at: row.from, selection: this.referenceSelection, mode: this.mode });
          await this.plugin.admission.request("live-editor-reference-verify", { plan, text: this.text });
          if (this.closed) return;
          const cm = this.editor.cm;
          if (!cm || cm.state.doc !== this.snapshot || this.info.file?.path !== this.path) throw Error("The note changed. Close and reopen Insert reference.");
          const changes = plan.editorChanges.map((e) => ({ from: this.editor.posToOffset(e.from), to: this.editor.posToOffset(e.to), insert: e.text }));
          cm.dispatch({ changes, userEvent: "input.reference" });
          if (cm.state.doc === this.snapshot) throw Error("Another editor extension blocked the insertion; nothing changed.");
          if (hash(this.editor.getValue()) !== plan.afterHash) throw Error("The editor changed the insertion. Please undo it; the source was not written separately.");
          this.close();
          this.editor.focus();
        } catch (error) {
          if (!this.closed) this.status.setText(error.message);
        } finally {
          this.busy = false;
          if (!this.closed) this.updateChoice();
        }
      }
      onClose() {
        this.closed = true;
        clearTimeout(this.previewTimer);
        this.previewOwner?.unload();
        this.contentEl.empty();
      }
    };
    module2.exports = function registerReferences(plugin, sharedOpen = null) {
      const open = (editor, info) => {
        if (info.file) {
          if (sharedOpen) sharedOpen(editor, info);
          else new ReferencePicker(plugin, editor, info).open();
        }
      };
      plugin.addCommand({ id: "insert-reference", name: "Insert reference\u2026", editorCallback: open });
      const justify = (editor, info) => {
        const cm = editor.cm, math = plugin.app.plugins.getPlugin("math-studio");
        if (!cm || !math?.start) {
          new Notice2("Enable Math Studio and place the caret in the equation to justify.");
          return;
        }
        math.start(cm, cm.state.selection.main.head, true);
      };
      plugin.addCommand({ id: "justify-step", name: "Justify this step\u2026", hotkeys: [{ modifiers: ["Mod"], key: "j" }], editorCallback: justify });
      plugin.registerEvent(plugin.app.workspace.on("editor-menu", (menu, editor, info) => {
        if (info.file) {
          menu.addItem((item) => item.setTitle("Insert reference\u2026").setIcon("link").onClick(() => open(editor, info)));
          menu.addItem((item) => item.setTitle("Justify this step\u2026").setIcon("list-checks").onClick(() => justify(editor, info)));
        }
      }));
    };
  }
});

// plugin/component-reference-session.js
var require_component_reference_session = __commonJS({
  "plugin/component-reference-session.js"(exports2, module2) {
    var { ReferenceSession } = require_reference_session();
    var { projectedRange } = require_component_math_references();
    var { insertion } = require_component_creation_model();
    var hash = (s) => require("crypto").createHash("sha256").update(s).digest("hex");
    function position(text, at) {
      const before = text.slice(0, at), line = before.split("\n").length - 1;
      return { line, ch: at - (before.lastIndexOf("\n") + 1) };
    }
    function offset(text, p) {
      let at = 0;
      for (let n = 0; n < p.line; n++) {
        at = text.indexOf("\n", at) + 1;
        if (!at) throw Error("Invalid reference position");
      }
      return at + p.ch;
    }
    function focused(plugin, info) {
      const doc = info.containerEl?.ownerDocument || document, entry = plugin.componentEditors?.get(doc.activeElement?.closest?.(".cm-editor"));
      return entry?.context.nested ? entry : null;
    }
    function sessionFor(plugin, editor, info) {
      const embedded = focused(plugin, info);
      return embedded ? new ComponentReferenceSession(plugin, embedded, info) : new ReferenceSession(plugin, editor, info);
    }
    var ComponentReferenceSession = class extends ReferenceSession {
      constructor(plugin, embedded, info) {
        if (embedded.context.part !== "body") throw Error("Insert references in the callout body.");
        const cm = embedded.view, original = cm.state.doc, body = original.toString(), selection = cm.state.selection.main, project = (value) => embedded.context.project({ toString: () => value }).doc.toString();
        const range = projectedRange(project, body, selection.from, selection.to), text = range.source, snapshot = { toString: () => text };
        const adapter = { cm: { state: { doc: snapshot }, coordsAtPos: () => cm.coordsAtPos(selection.head) }, getValue: () => project(cm.state.doc.toString()), getSelection: () => body.slice(selection.from, selection.to), getCursor: (which) => position(text, which === "from" ? range.from : range.to), posToOffset: (p) => offset(text, p), focus: () => cm.focus() };
        super(plugin, adapter, info);
        Object.assign(this, { embedded, body, original, selection, project, range, componentsOnly: true });
      }
      check() {
        if (this.closed || this.embedded.view.state.doc !== this.original || this.project(this.body) !== this.text) throw Error("The callout changed; reopen the picker.");
      }
      async apply(row) {
        this.check();
        const reason = this.reason(row);
        if (reason) throw Error(reason);
        const op = row.local && !row.entityId ? "live-editor-reference" : "live-editor-library-reference";
        const plan = await this.plugin.admission.request(op + "-plan", { path: this.path, text: this.text, sourceHash: hash(this.text), at: row.from, entryId: require_figure_panels().target(row, this.panel), selection: this.positions, mode: this.mode });
        await this.plugin.admission.request(op + "-verify", { plan, text: this.text });
        this.check();
        const edits = plan.editorChanges.map((e) => ({ from: offset(this.text, e.from), to: offset(this.text, e.to), insert: e.text })), link = edits.find((e) => e.from === this.range.from && e.to === this.range.to);
        if (!link || link.insert.includes("\n")) throw Error("Select words on one line for this reference.");
        const next = this.body.slice(0, this.selection.from) + link.insert + this.body.slice(this.selection.to), after = this.project(next), delta = link.insert.length - (this.range.to - this.range.from), extra = edits.filter((e) => e !== link);
        const staged = extra.map((e) => {
          if (e.to <= this.range.from) return e;
          if (e.from >= this.range.to) return { ...e, from: e.from + delta, to: e.to + delta };
          throw Error("The identity overlaps the linked words.");
        });
        this.embedded.view.dispatch({ changes: { from: this.selection.from, to: this.selection.to, insert: link.insert }, userEvent: "input.reference" });
        if (this.embedded.view.state.doc.toString() !== next) throw Error("The body editor refused the reference.");
        if (staged.length) this.embedded.context.referenceDrafts.push({ text: after, changes: staged });
        return true;
      }
      async insertCopy(body) {
        this.check();
        insertion(this.body, this.selection.from, this.selection.to);
        const cm = this.embedded.view, s = this.selection, prefix = s.from && !this.body.slice(0, s.from).endsWith("\n\n") ? "\n\n" : "", suffix = s.to < this.body.length && !this.body.slice(s.to).startsWith("\n\n") ? "\n\n" : "";
        cm.dispatch({ changes: { from: s.from, to: s.to, insert: prefix + body + suffix }, userEvent: "input.callout-copy" });
      }
    };
    module2.exports = { sessionFor, ComponentReferenceSession, position, offset };
  }
});

// plugin/reference-choice.js
var require_reference_choice = __commonJS({
  "plugin/reference-choice.js"(exports2, module2) {
    var { ReferenceSession } = require_reference_session();
    var hash = (text) => require("crypto").createHash("sha256").update(text).digest("hex");
    var ReferenceChoice = class extends ReferenceSession {
      constructor(plugin, options, settle) {
        super(plugin, options.editor, options.info);
        this.purpose = options.purpose;
        this.componentsOnly = !!options.componentsOnly;
        this.chooseOnly = true;
        this.words = options.expression || "";
        this.mode = options.mode ?? (this.words ? "c" : "auto");
        this.currentTarget = options.currentTarget || null;
        this.anchorRect = options.anchorRect;
        this.settle = settle;
        this.buttonLabel = "Link";
        this.title = this.currentTarget ? "Change reference" : "Choose reference";
      }
      current() {
        return !this.closed && !this.plugin.unloading && this.info.file?.path === this.path;
      }
      reason(row) {
        if (!this.current()) return "The note changed. Reopen the reference picker.";
        if (row?.local && !row.blockId && (this.editor.cm?.state.doc !== this.snapshot || this.editor.getValue() !== this.text)) return "The note changed. Reopen the picker to link this unanchored result.";
        return super.reason(this.componentsOnly && row?.local ? { ...row, entityId: row.entityId || "draft-reservation" } : row);
      }
      async apply(row) {
        const reason = this.reason(row);
        if (reason) throw Error(reason);
        const choice = {
          version: 1,
          path: this.path,
          sourceHash: hash(this.text),
          mode: this.mode,
          label: this.label(row),
          target: row.entityId ? { kind: "library", entryId: require_figure_panels().target(row, this.panel) } : row.local ? { kind: "local", component: true, at: row.from, title: row.title, sourceStyle: row.sourceStyle, blockId: row.blockId || null } : { kind: "library", entryId: require_figure_panels().target(row, this.panel) }
        };
        this.settle(choice);
        return true;
      }
      cancel() {
        this.closed = true;
        this.settle(null);
      }
    };
    function registerReferenceChoice(plugin, openBrowser) {
      const pending = /* @__PURE__ */ new Set();
      const request = async (op, args) => {
        if (plugin.unloading) throw Error("Reference tools were unloaded; reopen the equation.");
        await plugin.admission.ready;
        const result = await plugin.admission.request(op, args);
        if (plugin.unloading) throw Error("Reference tools were unloaded; reopen the equation.");
        return result;
      };
      const api = {
        version: 1,
        wrap(options) {
          return request("live-math-reference-wrap", options);
        },
        prepare(options) {
          return request("live-math-reference-choice", options);
        },
        planEquationSave(options) {
          return request("live-math-reference-save", options);
        },
        commitEquationSave({ view, path: path2, before, after, identities }, commit) {
          if (!plugin.componentReferenceWrites) throw Error("Reference save coordinator is unavailable; the equation draft is retained.");
          return plugin.componentReferenceWrites.run(view, path2, before, after, identities, commit);
        },
        verifyEquationSave(plan, text) {
          return request("live-math-reference-verify", { plan, text });
        },
        choose(options) {
          if (!options?.editor?.cm || !options.info?.file || typeof options.editor.getValue !== "function") return Promise.reject(Error("Choose a reference from an open Markdown editor."));
          if (options.mode !== void 0 && !["auto", "n", "t", "b", "c"].includes(options.mode)) return Promise.reject(Error("Invalid reference label mode"));
          if (options.currentTarget !== void 0 && (typeof options.currentTarget !== "string" || options.currentTarget.length > 165)) return Promise.reject(Error("Invalid current reference target"));
          if (options.expression !== void 0 && (typeof options.expression !== "string" || options.expression.length > 2e5)) return Promise.reject(Error("Invalid reference expression."));
          if (plugin.unloading || options.signal?.aborted) return Promise.resolve(null);
          return new Promise((resolve, reject) => {
            let browser, done = false;
            const abort = () => {
              session.cancel();
              browser?.close();
            };
            const settle = (value) => {
              if (done) return;
              done = true;
              pending.delete(abort);
              options.signal?.removeEventListener("abort", abort);
              resolve(value);
            };
            const session = new ReferenceChoice(plugin, options, settle);
            pending.add(abort);
            options.signal?.addEventListener("abort", abort, { once: true });
            try {
              browser = openBrowser(session);
              if (done) browser?.close();
            } catch (error) {
              pending.delete(abort);
              options.signal?.removeEventListener("abort", abort);
              done = true;
              browser?.close();
              reject(error);
            }
          });
        }
      };
      plugin.referenceApi = api;
      plugin.register(() => {
        for (const abort of [...pending]) abort();
        if (plugin.referenceApi === api) delete plugin.referenceApi;
      });
      return api;
    }
    module2.exports = { ReferenceChoice, registerReferenceChoice };
  }
});

// plugin/callout-api.js
var require_callout_api = __commonJS({
  "plugin/callout-api.js"(exports2, module2) {
    var { presentation } = require_callout_presentation();
    var EVENT = "knowledge-library:callouts-changed";
    function registerCalloutAPI(plugin) {
      let closed = false, readyFor = null, last;
      const announce = () => {
        if (!closed) plugin.app.workspace.trigger(EVENT);
      };
      const accepts = (file) => !!file && file.path?.endsWith(".md") && plugin.app.vault.getAbstractFileByPath(file.path) === file;
      const api = {
        version: 1,
        decoratesTitles(subject) {
          const file = subject?.file || subject;
          return closed || !accepts(file) ? "no" : readyFor === plugin.admission ? "yes" : "pending";
        },
        revision() {
          const s = plugin.referenceResolver.state;
          return JSON.stringify([readyFor === plugin.admission, s?.policy, s?.registry, plugin.referenceResolver.editorGeneration]);
        },
        serviceChanged() {
          const adapter = plugin.admission;
          readyFor = null;
          announce();
          adapter.ready.then(() => {
            if (!closed && plugin.admission === adapter) {
              readyFor = adapter;
              announce();
            }
          }, () => {
            if (!closed && plugin.admission === adapter) {
              readyFor = adapter;
              announce();
            }
          });
        },
        async getCallouts({ file, doc, text }) {
          if (!accepts(file) || closed) throw Error("This reference provider does not own the note.");
          if (!doc || typeof doc !== "object" || typeof text !== "function") throw Error("Provide an immutable document snapshot and a text callback.");
          await plugin.admission.ready;
          if (closed) throw Error("Reference provider was unloaded.");
          const result = await plugin.referenceResolver.editor({ path: file.path, doc, text }, [], [], true);
          if (closed) throw Error("Reference provider was unloaded.");
          if (result.outlineIssue) throw Object.assign(new Error(result.outlineIssue), { retryable: false });
          if (!result.calloutList) throw Error("Callout projection is not available yet.");
          return { sourceHash: result.sourceHash, callouts: result.calloutList.map((o) => {
            const d = o.display, p = presentation(o), type = o.sourceStyle.toLowerCase();
            return {
              type,
              rawType: o.sourceStyle,
              displayType: d?.displayType || type,
              title: o.title,
              rawTitle: o.title,
              line: o.line - 1,
              nesting: Math.max(0, (o.depth || 1) - 1),
              collapsed: !!o.collapsed,
              number: d?.number,
              label: p.label,
              issue: p.issue || "",
              isManual: !d?.numberLabel,
              titleMismatch: false,
              authoredNumber: !!d?.authoredNumber
            };
          }) };
        }
      };
      plugin.calloutAPI = api;
      const unsubscribe = plugin.referenceResolver.subscribe(() => {
        const revision = api.revision();
        if (revision !== last) {
          last = revision;
          announce();
        }
      });
      api.serviceChanged();
      plugin.register(() => {
        closed = true;
        unsubscribe();
        if (plugin.calloutAPI === api) plugin.calloutAPI = null;
        plugin.app.workspace.trigger(EVENT);
      });
      return api;
    }
    module2.exports = { registerCalloutAPI, EVENT };
  }
});

// plugin/numbering-controls-model.js
var require_numbering_controls_model = __commonJS({
  "plugin/numbering-controls-model.js"(exports2, module2) {
    var clone = (value) => JSON.parse(JSON.stringify(value));
    var FORMATS = { document: "{n}", chapter: "{chapter}.{n}", section: "{section}.{n}" };
    function effectiveRule(settings, inherited, type, aliases = {}) {
      const own = settings.types || {}, base = inherited.types || {}, key = Object.hasOwn(own, type) || Object.hasOwn(base, type) ? type : aliases[type] || type;
      return { ...base[key], ...own[key] };
    }
    function changeField(settings, inherited, key, value, type = null, aliases = {}) {
      const next = clone(settings), base = type ? inherited.types?.[type] || {} : inherited;
      if (type && !Object.hasOwn(next.types || {}, type) && !Object.hasOwn(inherited.types || {}, type) && aliases[type]) {
        const rule = effectiveRule(settings, inherited, type, aliases);
        if (value === rule[key]) return next;
        (next.types ??= {})[type] = rule;
      }
      const target = type ? (next.types ??= {})[type] ??= {} : next;
      const baseline = base[key] ?? (type && key === "format" ? "{n}" : type && key === "style" ? "decimal" : void 0);
      const equal = ["chapter", "section"].includes(key) && baseline !== void 0 ? String(value) === String(baseline) : JSON.stringify(value) === JSON.stringify(baseline);
      if (value === void 0 || equal) delete target[key];
      else target[key] = value;
      if (type && !Object.keys(target).length) delete next.types[type];
      if (next.types && !Object.keys(next.types).length) delete next.types;
      return next;
    }
    function preset(settings, inherited, types, name, aliases = {}) {
      if (name === "inherit") return {};
      if (name === "custom") return clone(settings);
      let next = clone(settings);
      for (const type of types) {
        if (name === "off") next = changeField(next, inherited, "mode", "off", type, aliases);
        else {
          if (!FORMATS[name]) throw Error("Unknown numbering preset");
          next = changeField(next, inherited, "format", FORMATS[name], type, aliases);
        }
      }
      return next;
    }
    function currentPreset(settings, inherited, types, aliases = {}) {
      if (!Object.keys(settings).length) return "inherit";
      const rules = types.map((t) => effectiveRule(settings, inherited, t, aliases));
      if (rules.length && rules.every((r) => r.mode === "off")) return "off";
      if (rules.some((r) => r.mode === "off" || r.mode === "fixed" || r.style && r.style !== "decimal")) return "custom";
      for (const [name, format] of Object.entries(FORMATS)) if (rules.length && rules.every((r) => (r.format || "{n}") === format)) return name;
      return "custom";
    }
    module2.exports = { changeField, effectiveRule, preset, currentPreset, FORMATS };
  }
});

// plugin/callout-controls.js
var require_callout_controls = __commonJS({
  "plugin/callout-controls.js"(exports2, module2) {
    var { Modal: Modal2, Notice: Notice2, MarkdownView: MarkdownView2, Menu: Menu2 } = require("obsidian");
    var model = require_numbering_controls_model();
    function historyIsolation(cm) {
      try {
        const commands = require("@codemirror/commands");
        return cm.state.field(commands.historyField, false) !== void 0 ? commands.isolateHistory.of("full") : null;
      } catch {
        return null;
      }
    }
    var hash = (text) => require("crypto").createHash("sha256").update(text).digest("hex");
    var NumberingControls = class extends Modal2 {
      constructor(plugin, view) {
        super(plugin.app);
        this.plugin = plugin;
        this.view = view;
        this.path = view.file.path;
        plugin.numberingControls?.add(this);
        this.text = view.getViewData();
        this.snapshot = view.getMode() === "source" ? view.editor?.cm?.state.doc : null;
        this.sourceHash = hash(this.text);
        this.closed = false;
        this.ticket = 0;
      }
      current() {
        return !this.closed && !this.plugin.unloading && this.view.file?.path === this.path && this.view.getViewData() === this.text && (!this.snapshot || this.view.editor?.cm?.state.doc === this.snapshot);
      }
      async request(op, args) {
        await this.plugin.admission.ready;
        return this.plugin.admission.request(op, args);
      }
      onOpen() {
        this.titles = new (require_title_renderer()).TitleRenderer(this.contentEl.ownerDocument, () => {
        });
        this.modalEl.addClass("kl-numbering-modal");
        this.titleEl.setText("Callout numbering");
        this.contentEl.createDiv({ cls: "kl-numbering-note", text: this.view.file.basename });
        this.form = this.contentEl.createDiv();
        this.status = this.contentEl.createDiv({ cls: "kl-numbering-status", text: "Reading this note\u2026" });
        this.preview = this.contentEl.createDiv({ cls: "kl-numbering-preview" });
        const foot = this.contentEl.createDiv({ cls: "kl-numbering-footer" });
        foot.createEl("button", { text: "Cancel" }).onclick = () => this.close();
        this.applyButton = foot.createEl("button", { text: "Apply", cls: "mod-cta" });
        this.applyButton.disabled = true;
        this.applyButton.onclick = () => this.apply();
        this.load();
      }
      async load() {
        try {
          const context = await this.request("live-callout-controls-context", { path: this.path, text: this.text, sourceHash: this.sourceHash });
          if (!this.current()) throw Error("The note changed. Reopen numbering settings.");
          this.context = context;
          this.settings = JSON.parse(JSON.stringify(context.settings || {}));
          if (context.issue) {
            this.showRecovery(context.issue);
            return;
          }
          this.drawForm();
          this.form.querySelector("select")?.focus();
          this.queuePreview();
        } catch (error) {
          if (!this.closed) this.status.setText(error.message);
        }
      }
      showRecovery(issue) {
        this.status.setText("Invalid note numbering: " + issue);
        this.form.empty();
        this.form.createEl("button", { text: "Reset to inherited settings" }).onclick = () => {
          this.drawForm();
          this.queuePreview();
        };
        this.form.createEl("button", { text: "Edit properties in source" }).onclick = () => this.editSource();
      }
      async editSource() {
        try {
          if (!this.current()) throw Error("The note changed. Reopen numbering settings.");
          await this.view.setState({ ...this.view.getState(), mode: "source", source: true }, { history: false });
          this.view.editor?.setCursor({ line: 0, ch: 0 });
          this.close();
        } catch (error) {
          new Notice2(error.message);
        }
      }
      select(parent, label, value, options, change) {
        const row = parent.createEl("label", { cls: "kl-numbering-field" });
        row.createSpan({ text: label });
        const input = row.createEl("select");
        for (const [v, title] of options) input.createEl("option", { value: v, text: title });
        input.value = value;
        input.onchange = () => change(input.value);
        return input;
      }
      input(parent, label, value, change) {
        const row = parent.createEl("label", { cls: "kl-numbering-field" });
        row.createSpan({ text: label });
        const input = row.createEl("input", { type: "text", value: String(value ?? "") });
        input.oninput = () => change(input.value);
        return input;
      }
      change(key, value, type = null) {
        const c = this.context;
        this.settings = model.changeField(this.settings, c.inherited, key, value, type, c.aliases);
        this.queuePreview();
      }
      drawForm() {
        this.form.empty();
        const c = this.context, s = this.settings, types = [.../* @__PURE__ */ new Set([...c.types, ...Object.keys(s.types || {})])];
        this.form.createDiv({ cls: "kl-numbering-inherited", text: c.bookKey ? "Inherited from " + c.bookKey : "Inherited from vault defaults" });
        this.select(this.form, "Titles", s.titleMode ?? c.inherited.titleMode ?? "numbered", [["source", "Keep source titles \xB7 no automatic numbers by default"], ["numbered", "Numbered titles"]], (value) => {
          this.change("titleMode", value);
          this.drawForm();
        });
        this.select(this.form, "Style", model.currentPreset(s, c.inherited, types, c.aliases), [
          ["inherit", "Use inherited settings"],
          ["document", "Document \xB7 1, 2, 3"],
          ["chapter", "Chapter \xB7 2.1, 2.2"],
          ["section", "Section \xB7 2.3.1, 2.3.2"],
          ["off", "No automatic numbers"],
          ["custom", "Custom rules"]
        ], (value) => {
          this.settings = model.preset(this.settings, c.inherited, types, value, c.aliases);
          this.drawForm();
          this.queuePreview();
        });
        this.form.createDiv({ cls: "kl-numbering-hint", text: "Applies to " + (types.join(", ") || "no callout types yet") + ". Other types follow inherited settings." });
        if (s.authoredGroups) this.form.createDiv({ cls: "kl-numbering-hint", text: "Also kept: additional callouts " + (s.authoredGroups === "number" ? "retain automatic numbers" : "are unnumbered") });
        const scope = this.form.createDiv({ cls: "kl-numbering-scopes" });
        for (const key of ["chapter", "section"]) this.input(scope, key[0].toUpperCase() + key.slice(1), s[key] ?? c.inherited[key], (value) => this.change(key, value || void 0));
        const details = this.form.createEl("details", { cls: "kl-numbering-rules" });
        details.createEl("summary", { text: "Type rules" });
        if (types.length) {
          const choices = [...types, ...c.series || []];
          this.activeType = choices.includes(this.activeType) ? this.activeType : types[0];
          this.select(details, "Callout type", this.activeType, choices.map((t2) => [t2, t2.startsWith("user:") ? "Series \xB7 " + t2.split(":").slice(2).join(":") : t2]), (value) => {
            this.activeType = value;
            this.drawForm();
            this.form.querySelector("details").open = true;
          });
          if (this.activeType.startsWith("user:")) {
            const key = this.activeType, r2 = { series: key.split(":").slice(2).join(":"), prefix: "A", format: "{type} {chapter}.{prefix}{n}", ...c.inherited.series?.[key], ...s.series?.[key] };
            const change = (field, value) => {
              ((this.settings.series ??= {})[key] ??= {})[field] = value;
              this.queuePreview();
            };
            this.input(details, "Series name", r2.series, (v) => change("series", v));
            this.input(details, "Short prefix", r2.prefix, (v) => change("prefix", v));
            const format = this.input(details, "Number format", r2.format, (v) => change("format", v));
            format.setAttribute("list", "kl-series-formats");
            const presets = details.createEl("datalist", { attr: { id: "kl-series-formats" } });
            for (const [label, value] of [["Prefix", "{type} {chapter}.{prefix}{n}"], ["Series name", "{type} ({series}) {n}"]]) presets.createEl("option", { value, text: label });
            details.createDiv({ cls: "kl-numbering-hint", text: "Choose Prefix or Series name, or type a template using {type}, {chapter}, {n}, {prefix}, {series}. Chapter is optional for the Prefix preset." });
            return;
          }
          const t = this.activeType, r = model.effectiveRule(s, c.inherited, t, c.aliases);
          const kept = Object.keys(r).filter((k) => !["mode", "format", "style", "label"].includes(k));
          if (kept.length) details.createDiv({ cls: "kl-numbering-hint", text: "Also kept: " + kept.join(", ") });
          if (c.aliases[t] && s.types?.[t] && !c.inherited.types?.[t]) details.createDiv({ cls: "kl-numbering-hint", text: "Separate " + t + " rule: changes to inherited " + c.aliases[t] + " rules do not apply here." });
          this.select(details, "Numbering", r.mode || "", [["", "Default for this type"], ["auto", "Automatic"], ["fixed", "Fixed label"], ["off", "No automatic number"]], (value) => this.change("mode", value || void 0, t));
          this.input(details, "Number format", r.format || "{n}", (value) => this.change("format", value || void 0, t));
          this.select(details, "Numerals", r.style || "decimal", [["decimal", "1, 2, 3"], ["alpha", "a, b, c"], ["ALPHA", "A, B, C"], ["roman", "i, ii, iii"], ["ROMAN", "I, II, III"]], (value) => this.change("style", value, t));
          this.input(details, "Fixed label", r.label || "", (value) => this.change("label", value || void 0, t));
          details.createDiv({ cls: "kl-numbering-hint", text: "Formats use {type}, {n}, {chapter}, {section}, {prefix}, and {series}. Existing shared counters, restart rules and authored titles are preserved." });
        }
      }
      queuePreview() {
        clearTimeout(this.timer);
        const ticket = ++this.ticket;
        this.plan = null;
        this.applyButton.disabled = true;
        this.status.setText("Updating preview\u2026");
        this.timer = setTimeout(() => this.loadPreview(ticket), 180);
      }
      async loadPreview(ticket) {
        try {
          if (!this.current()) throw Error("The note changed. Reopen numbering settings.");
          const plan = await this.request("live-callout-numbering-plan", { path: this.path, text: this.text, sourceHash: this.sourceHash, settings: this.settings });
          if (this.closed || ticket !== this.ticket) return;
          if (!this.current()) throw Error("The note changed. Reopen numbering settings.");
          this.plan = plan;
          this.preview.empty();
          this.status.setText(!plan.edits.length ? "No changes" : `${plan.changed} of ${plan.count} callouts change` + (plan.authoredKept ? ` \xB7 ${plan.authoredKept} authored labels preserved` : ""));
          const removed = (this.context.issue || Object.keys(this.context.settings || {}).length) && !Object.keys(this.settings).length;
          if (removed) this.preview.createDiv({ cls: "kl-numbering-hint", text: "Apply removes this note\u2019s numbering overrides and restores inherited settings." });
          for (const row of plan.preview.filter((row2) => row2.changed || row2.newIssue)) {
            const item = this.preview.createDiv({ cls: "kl-numbering-example" }), before = item.createSpan(), after = item.createSpan();
            this.titles.render(before, "before:" + row.line, row.before, { inline: true });
            this.titles.render(after, "after:" + row.line, "\u2192 " + row.after, { inline: true });
            if (row.issue) item.createDiv({ text: row.issue, cls: "kl-numbering-error" });
          }
          if (plan.count > plan.changed) this.preview.createDiv({ cls: "kl-numbering-summary", text: plan.count - plan.changed + " unchanged" });
          this.titles.flush();
          for (const issue of plan.diagnostics || []) this.preview.createDiv({ text: issue.reason || issue.message || issue.code, cls: "kl-numbering-error" });
          this.applyButton.disabled = this.applying || !plan.valid || !plan.edits.length;
        } catch (error) {
          if (!this.closed && ticket === this.ticket) {
            this.status.setText(error.message);
            this.applyButton.disabled = true;
            this.form.querySelector(".kl-numbering-recovery")?.remove();
            if (error.code === "numbering-edit") {
              const button = this.form.createEl("button", { text: "Edit properties in source", cls: "kl-numbering-recovery" });
              button.onclick = () => this.editSource();
            }
          }
        }
      }
      async apply() {
        if (this.applying) return;
        const plan = this.plan;
        if (!plan?.valid || this.applyButton.disabled) return;
        this.applying = true;
        this.applyButton.disabled = true;
        const ticket = this.ticket, originalState = this.view.getState(), originalPosition = this.view.getEphemeralState?.(), wasReading = this.view.getMode() === "preview";
        let switched = false, changed = false, restored = false;
        try {
          if (!this.current()) throw Error("The note changed. Reopen numbering settings.");
          await this.request("live-callout-numbering-verify", { plan, text: this.text });
          if (!this.current() || ticket !== this.ticket) throw Error("The preview changed. Review it before applying.");
          if (originalState.mode !== "source" || !originalState.source) {
            switched = true;
            await this.view.setState({ ...originalState, mode: "source", source: true }, { history: false });
          }
          if (!this.current()) throw Error("The note changed while opening its editor. Nothing was applied.");
          const editor = this.view.editor, cm = editor?.cm;
          if (!cm || editor.getValue() !== this.text) throw Error("The current editor is not ready. Nothing was applied.");
          const changes = plan.editorChanges.map((e) => ({ from: editor.posToOffset(e.from), to: editor.posToOffset(e.to), insert: e.text }));
          const isolation = historyIsolation(cm);
          this.historyIsolation = isolation ? "host" : "selection-boundary";
          cm.dispatch({ changes, userEvent: "input.numbering", ...isolation ? { annotations: isolation } : {} });
          if (!isolation) cm.dispatch({ selection: cm.state.selection, userEvent: "select.numbering" });
          changed = editor.getValue() !== this.text;
          if (!changed) throw Error("Obsidian refused the numbering edit. Nothing changed.");
          if (hash(editor.getValue()) !== plan.afterHash) throw Error("Another editor extension changed the edit. Undo it before continuing.");
          if (switched) {
            await this.view.setState(originalState, { history: false });
            restored = true;
          }
          if (originalPosition) this.view.setEphemeralState(originalPosition);
          this.close();
          if (wasReading) this.offerUndo(plan, originalState, originalPosition);
        } catch (error) {
          if (!this.closed) {
            this.status.setText(error.message);
            this.applyButton.disabled = !this.plan?.valid || !this.plan?.edits.length;
          }
        } finally {
          this.applying = false;
          if (switched && !changed && !restored && this.view.file?.path === this.path) {
            await this.view.setState(originalState, { history: false });
            if (originalPosition) this.view.setEphemeralState(originalPosition);
          }
        }
      }
      offerUndo(plan, readingState, position) {
        const fragment = this.view.containerEl.ownerDocument.createDocumentFragment();
        fragment.append("Numbering applied \xB7 ");
        const button = this.view.containerEl.ownerDocument.createElement("button");
        button.textContent = "Undo";
        button.className = "kl-numbering-undo";
        fragment.appendChild(button);
        const notice = new Notice2(fragment, 12e3);
        let busy = false;
        button.onclick = async () => {
          if (busy) return;
          busy = true;
          try {
            if (this.plugin.unloading || this.view.file?.path !== this.path || hash(this.view.getViewData()) !== plan.afterHash) throw Error("The note changed. Use Undo in the editor.");
            await this.view.setState({ ...readingState, mode: "source", source: true }, { history: false });
            if (this.view.file?.path !== this.path || hash(this.view.editor.getValue()) !== plan.afterHash) throw Error("The note changed. Use Undo in the editor.");
            this.view.editor.undo();
            if (hash(this.view.editor.getValue()) !== plan.sourceHash) {
              this.view.editor.redo();
              if (hash(this.view.editor.getValue()) !== plan.afterHash) throw Error("The editor history changed. Review the note before continuing.");
              await this.view.setState(readingState, { history: false });
              throw Error("Use Undo in the editor; the numbering change remains applied.");
            }
            await this.view.setState(readingState, { history: false });
            if (position) this.view.setEphemeralState(position);
            notice.hide();
          } catch (error) {
            new Notice2(error.message);
          } finally {
            busy = false;
          }
        };
      }
      onClose() {
        this.plugin.numberingControls?.delete(this);
        this.closed = true;
        ++this.ticket;
        clearTimeout(this.timer);
        this.titles?.close();
        this.contentEl.empty();
      }
    };
    function registerCalloutControls(plugin) {
      plugin.numberingControls = /* @__PURE__ */ new Set();
      plugin.register(() => {
        for (const modal of [...plugin.numberingControls]) modal.close();
        plugin.numberingControls.clear();
      });
      const open = (view) => {
        if (view?.file && typeof view.getViewData === "function") new NumberingControls(plugin, view).open();
      };
      const copy = async (view, text, at) => {
        try {
          const path2 = view.file?.path;
          await plugin.admission.ready;
          const result = await plugin.admission.request("live-callout-contents", { path: path2, text, sourceHash: hash(text), at: [...text.slice(0, at)].length });
          if (view.file?.path !== path2 || view.getViewData() !== text) throw Error("The note changed; copy again.");
          await view.containerEl.ownerDocument.defaultView.navigator.clipboard.writeText(result.contents);
          new Notice2("Callout contents copied");
        } catch (error) {
          new Notice2(error.message);
        }
      };
      const menuItems = (menu, view, text, at) => {
        if (at !== null) menu.addItem((item) => item.setTitle("Copy contents").setIcon("copy").onClick(() => copy(view, text, at)));
        menu.addItem((item) => item.setTitle("Numbering settings\u2026").setIcon("list-ordered").onClick(() => open(view)));
      };
      plugin.addCommand({ id: "callout-numbering", name: "Callout numbering settings", checkCallback: (checking) => {
        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView2);
        if (!view?.file) return false;
        if (!checking) open(view);
        return true;
      } });
      plugin.registerEvent(plugin.app.workspace.on("editor-menu", (menu, editor, info) => {
        if (!(info instanceof MarkdownView2) || !info.file) return;
        const cursor = editor.getCursor(), text = editor.getValue();
        menuItems(menu, info, text, /^\s*>/.test(editor.getLine(cursor.line)) ? editor.posToOffset(cursor) : null);
      }));
      const attached = /* @__PURE__ */ new WeakSet();
      const attach = (doc) => {
        if (attached.has(doc)) return;
        attached.add(doc);
        plugin.registerDomEvent(doc, "contextmenu", (event) => {
          const title = event.target?.closest?.(".callout-title");
          if (!title) return;
          if (title.closest(".kl-component")) return;
          const component = title.closest(".callout"), occurrence = component?.dataset.calloutMetadata?.split(/\s+/).find((t) => t.startsWith("at="))?.slice(3);
          if (occurrence && component.closest(".markdown-preview-view") && plugin.componentActions?.readingMenu) {
            const view2 = plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).find((v) => v.file && v.containerEl.contains(component));
            if (view2) {
              event.preventDefault();
              event.stopImmediatePropagation();
              plugin.componentActions.readingMenu(event, view2.file.path, occurrence, component);
              return;
            }
          }
          const label = title.querySelector(":scope > .callout-title-inner");
          const location = require_callout_locations().locate(label);
          if (!location) return;
          const view = plugin.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((v) => v.file?.path === location.path && v.containerEl.contains(title));
          if (!view || view.getViewData() !== location.text) return;
          let at = 0;
          for (let line = 1; line < location.line; line++) {
            at = location.text.indexOf("\n", at) + 1;
            if (!at) return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          const menu = new Menu2();
          menuItems(menu, view, location.text, at);
          menu.showAtMouseEvent(event);
        }, { capture: true });
      };
      attach(document);
      plugin.app.workspace.iterateAllLeaves((leaf) => attach(leaf.view.containerEl.ownerDocument));
      plugin.registerEvent(plugin.app.workspace.on("window-open", (_container, win) => attach(win.document)));
    }
    module2.exports = { NumberingControls, registerCalloutControls };
  }
});

// plugin/component-update-settings.js
var require_component_update_settings = __commonJS({
  "plugin/component-update-settings.js"(exports2, module2) {
    var { PluginSettingTab, Setting, Modal: Modal2, Notice: Notice2 } = require("obsidian");
    var PendingUpdates = class extends Modal2 {
      constructor(plugin) {
        super(plugin.app);
        this.plugin = plugin;
      }
      onOpen() {
        this.titleEl.setText("Updates from the index");
        const pending = this.plugin.settings.pendingComponentUpdates || {}, paths = Object.keys(pending);
        this.contentEl.createEl("p", { text: paths.length ? "Updates are ready for these notes. Edited versions keep their own content." : "All copies are up to date." });
        const list = this.contentEl.createDiv("kl-removal-copies");
        for (const path2 of paths) list.createDiv({ text: path2 });
        if (paths.length) {
          const button = this.contentEl.createEl("button", { text: "Apply all updates", cls: "mod-cta" });
          button.onclick = async () => {
            button.disabled = true;
            try {
              await this.plugin.componentIdentities.applyPending();
              this.close();
            } catch (error) {
              new Notice2(error.message);
              button.disabled = false;
            }
          };
        }
      }
    };
    var UpdatesSettings = class extends PluginSettingTab {
      constructor(plugin) {
        super(plugin.app, plugin);
        this.plugin = plugin;
      }
      display() {
        this.containerEl.empty();
        new Setting(this.containerEl).setName("Untouched copies").setDesc("Choose how this vault receives corrections from the index. Edited versions are never replaced automatically.").addDropdown((drop) => drop.addOption("automatic", "Automatic").addOption("ask", "Ask first").addOption("notify", "Notify only").setValue(this.plugin.settings.copyUpdates || "automatic").onChange(async (value) => {
          this.plugin.settings.copyUpdates = value;
          await this.plugin.persist();
          if (value === "automatic") await this.plugin.componentIdentities.applyPending();
        }));
        new Setting(this.containerEl).setName("Pending updates").setDesc("Review the affected notes and apply their updates together.").addButton((button) => button.setButtonText("Review").onClick(() => new PendingUpdates(this.plugin).open()));
      }
    };
    function registerComponentUpdateSettings(plugin) {
      plugin.addSettingTab(new UpdatesSettings(plugin));
      plugin.addCommand({ id: "pending-component-updates", name: "Review pending callout updates", callback: () => new PendingUpdates(plugin).open() });
      plugin.showPendingComponentUpdates = (ask) => {
        const count = Object.keys(plugin.settings.pendingComponentUpdates || {}).length;
        if (!count) return;
        if (ask) {
          new PendingUpdates(plugin).open();
          return;
        }
        new Notice2(`Index corrections are available in ${count} ${count === 1 ? "note" : "notes"}. Use \u201CReview pending callout updates\u201D to apply them.`, 1e4);
      };
      plugin.app.workspace.onLayoutReady(() => {
        if (Object.keys(plugin.settings.pendingComponentUpdates || {}).length) plugin.showPendingComponentUpdates(plugin.settings.copyUpdates === "ask");
      });
    }
    module2.exports = { registerComponentUpdateSettings };
  }
});

// plugin/component-reference-writes.js
var require_component_reference_writes = __commonJS({
  "plugin/component-reference-writes.js"(exports2, module2) {
    var { StateEffect, StateField, Transaction } = require("@codemirror/state");
    var { invertedEffects } = require("@codemirror/commands");
    var { EditorView } = require("@codemirror/view");
    var { Notice: Notice2 } = require("obsidian");
    var { difference } = require_component_identities();
    var { componentSaved } = require_component_file_ready();
    var grouped = StateEffect.define();
    function registerComponentReferenceWrites(plugin) {
      const request = async (op, args) => {
        await plugin.admission.ready;
        return plugin.admission.request(op, args);
      };
      const active = StateField.define({ create: () => /* @__PURE__ */ new Set(), update: (prior, tr) => {
        let next = prior;
        for (const e of tr.effects) if (e.is(grouped)) {
          if (next === prior) next = new Set(prior);
          e.value.applied ? next.add(e.value.job.key) : next.delete(e.value.job.key);
        }
        return next;
      } });
      let queue = Promise.resolve();
      const serial = (fn) => {
        const run = queue.catch(() => {
        }).then(fn);
        queue = run.catch(() => {
        });
        return run;
      };
      const views = (path2) => plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).filter((v) => v.file?.path === path2);
      const read = async (path2) => {
        const open = views(path2).find((v) => v.getMode() === "source" && v.editor?.cm);
        return open ? open.editor.getValue() : plugin.app.vault.read(plugin.app.vault.getAbstractFileByPath(path2));
      };
      const write = async (path2, before, after) => {
        const matches = views(path2);
        if (matches.some((v) => v.containerEl.querySelector(".kl-component-editing,.math-studio-host"))) throw Error("Finish the open source draft before linking this result.");
        const open = matches.find((v) => v.getMode() === "source" && v.editor?.cm);
        if (open) {
          if (open.editor.getValue() !== before) throw Error("Source note changed; the equation draft is retained.");
          open.editor.cm.dispatch({ changes: difference(before, after), annotations: Transaction.addToHistory.of(false), userEvent: "input.callout-identity" });
          if (open.editor.getValue() !== after) throw Error("The source editor refused its identity update.");
          open.requestSave?.();
        } else {
          const file = plugin.app.vault.getAbstractFileByPath(path2);
          if (!file) throw Error("Source note is unavailable");
          await plugin.app.vault.process(file, (current) => {
            if (current !== before) throw Error("Source note changed; the equation draft is retained.");
            return after;
          });
        }
      };
      const applySources = async (job, forward) => {
        const changed = [];
        try {
          for (const source of job.sources) {
            const before = forward ? source.before : source.after, after = forward ? source.after : source.before, current = await read(source.path);
            if (current === after) continue;
            if (current !== before) throw Error("Source note changed since this grouped edit; it was not overwritten.");
            plugin.admission.paused.add(source.path);
            try {
              await write(source.path, before, after);
              changed.push({ path: source.path, before, after });
              await componentSaved(plugin.app.vault, source.path, after, { timeoutMs: 8e3 });
              plugin.componentIdentities.acceptGrouped(source.path, after);
            } finally {
              plugin.admission.paused.delete(source.path);
            }
          }
        } catch (error) {
          for (const change of changed.reverse()) try {
            await write(change.path, change.after, change.before);
            plugin.componentIdentities.acceptGrouped(change.path, change.before);
          } catch {
            new Notice2("A reference save needs recovery; its guarded receipt has been retained.");
          }
          throw error;
        }
      };
      plugin.registerEditorExtension([active, invertedEffects.of((tr) => tr.effects.filter((e) => e.is(grouped)).map((e) => grouped.of({ ...e.value, applied: !e.value.applied }))), EditorView.updateListener.of((update) => {
        for (const tr of update.transactions) if (tr.isUserEvent("undo") || tr.isUserEvent("redo")) {
          for (const e of tr.effects) if (e.is(grouped)) void serial(async () => {
            try {
              await applySources(e.value.job, e.value.applied);
              await request("live-reference-write-record", { key: e.value.job.key, state: e.value.applied ? "complete" : "undone" });
            } catch (error) {
              await request("live-reference-write-record", { key: e.value.job.key, state: "conflict" });
              new Notice2(error.message, 12e3);
            }
          });
        }
      })]);
      plugin.componentReferenceWrites = { run: (view, path2, before, after, rows, commit) => serial(async () => {
        const used = rows.filter((r) => new RegExp("kl-[ntbc]-lib_" + r.identity).test(after));
        if (!used.length) return commit([]);
        const job = await request("live-reference-write-begin", { key: require("crypto").randomUUID(), path: path2, before, after, rows: used });
        if (view.state.doc.toString() !== before) throw Error("The destination changed; your draft is retained.");
        await applySources(job, true);
        try {
          if (view.state.doc.toString() !== before) throw Error("The destination changed; your draft is retained.");
          await commit([grouped.of({ job, applied: true })]);
          await componentSaved(plugin.app.vault, path2, view.state.doc.toString(), { timeoutMs: 8e3 });
          await request("live-reference-write-record", { key: job.key, state: "complete" });
        } catch (error) {
          if (view.state.field(active, false)?.has(job.key)) {
            await request("live-reference-write-record", { key: job.key, state: "complete" });
            new Notice2("The reference was saved; its identity bookkeeping will retry.");
            return;
          }
          await applySources(job, false);
          await request("live-reference-write-record", { key: job.key, state: "rolled-back" });
          throw error;
        }
      }) };
      let stopped = false, retrying = false;
      plugin.register(() => {
        stopped = true;
      });
      const recover = () => serial(async () => {
        if (stopped) return;
        const jobs = await request("live-reference-write-pending", {});
        for (const job of jobs) {
          try {
            const current = await read(job.path);
            if (current !== job.before && current !== job.after) {
              await request("live-reference-write-record", { key: job.key, state: "conflict" });
              new Notice2("An interrupted reference save changed independently. Both notes were preserved; review " + job.path + ".", 12e3);
              continue;
            }
            const forward = current === job.after;
            await applySources(job, forward);
            await request("live-reference-write-record", { key: job.key, state: forward ? "complete" : "rolled-back" });
          } catch (error) {
            plugin.componentReferenceRecoveryError = error.message;
            retrying = true;
          }
        }
      });
      plugin.componentReferenceWrites.recover = recover;
      plugin.app.workspace.onLayoutReady(() => void recover());
      plugin.registerEvent(plugin.app.vault.on("modify", () => {
        if (retrying) {
          retrying = false;
          void recover();
        }
      }));
      plugin.registerInterval(setInterval(() => {
        if (retrying && !stopped) {
          retrying = false;
          void recover();
        }
      }, 3e3));
    }
    module2.exports = { registerComponentReferenceWrites };
  }
});

// plugin/component-word-diff.js
var require_component_word_diff = __commonJS({
  "plugin/component-word-diff.js"(exports2, module2) {
    function addedWords(before, after) {
      const tokenize = (s) => [...s.matchAll(/[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)].map((m) => ({ text: m[0], from: m.index, to: m.index + m[0].length }));
      const a = tokenize(before), b = tokenize(after);
      let start = 0, ae = a.length, be = b.length;
      while (start < ae && start < be && a[start].text === b[start].text) start++;
      while (ae > start && be > start && a[ae - 1].text === b[be - 1].text) {
        ae--;
        be--;
      }
      if (be === start) return [];
      if ((ae - start + 1) * (be - start + 1) > 2e5) return [{ from: b[start].from, to: b[be - 1].to }];
      const width = be - start + 1, rows = ae - start + 1, dp = new Uint32Array(width * rows);
      for (let i2 = rows - 2; i2 >= 0; i2--) for (let j2 = width - 2; j2 >= 0; j2--) dp[i2 * width + j2] = a[start + i2].text === b[start + j2].text ? 1 + dp[(i2 + 1) * width + j2 + 1] : Math.max(dp[(i2 + 1) * width + j2], dp[i2 * width + j2 + 1]);
      const ranges = [];
      let i = 0, j = 0;
      while (j < width - 1) {
        if (i < rows - 1 && a[start + i].text === b[start + j].text) {
          i++;
          j++;
        } else if (i < rows - 1 && dp[(i + 1) * width + j] > dp[i * width + j + 1]) i++;
        else {
          const word = b[start + j++];
          ranges.push({ from: word.from, to: word.to });
        }
      }
      return ranges;
    }
    function textNodes(root) {
      const nodes = [], walk = root.ownerDocument.createTreeWalker(root, 4);
      let node;
      while (node = walk.nextNode()) if (!node.parentElement.closest("mjx-container,math,script,style,.callout-icon,.kl-component-admission")) nodes.push(node);
      return nodes;
    }
    function highlightChanges(previous, current) {
      const before = textNodes(previous).map((n) => n.data).join(""), nodes = textNodes(current), after = nodes.map((n) => n.data).join(""), ranges = addedWords(before, after);
      let offset = 0, index = 0;
      for (const node of nodes) {
        const end = offset + node.length;
        while (index < ranges.length && ranges[index].to <= offset) index++;
        let cursor = 0;
        const fragment = node.ownerDocument.createDocumentFragment();
        for (let i = index; i < ranges.length && ranges[i].from < end; i++) {
          const from = Math.max(0, ranges[i].from - offset), to = Math.min(node.length, ranges[i].to - offset);
          if (from > cursor) fragment.append(node.ownerDocument.createTextNode(node.data.slice(cursor, from)));
          const mark = node.ownerDocument.createElement("mark");
          mark.className = "kl-component-diff-added";
          mark.textContent = node.data.slice(from, to);
          fragment.append(mark);
          cursor = to;
        }
        if (cursor) {
          fragment.append(node.ownerDocument.createTextNode(node.data.slice(cursor)));
          node.replaceWith(fragment);
        }
        offset = end;
      }
      return ranges.length;
    }
    module2.exports = { addedWords, highlightChanges };
  }
});

// plugin/component-actions.js
var require_component_actions = __commonJS({
  "plugin/component-actions.js"(exports2, module2) {
    var { MarkdownView: MarkdownView2, Menu: Menu2, Modal: Modal2, FuzzySuggestModal, Notice: Notice2, Component: Component2, MarkdownRenderer: MarkdownRenderer2 } = require("obsidian");
    var { randomUUID } = require("node:crypto");
    var { insertion, expansionAt } = require_component_creation_model();
    var { NumberingControls } = require_callout_controls();
    var TYPES = ["note", "definition", "notation", "theorem", "result", "lemma", "corollary", "proposition", "equation", "exercise", "example", "figure", "table", "proof", "warning", "tip"];
    var ChooseType = class extends FuzzySuggestModal {
      constructor(plugin, choose) {
        super(plugin.app);
        this.choose = choose;
        this.setPlaceholder("Callout type\u2026");
      }
      getItems() {
        return TYPES;
      }
      getItemText(type) {
        return type[0].toUpperCase() + type.slice(1);
      }
      onChooseItem(type) {
        void this.choose(type);
      }
    };
    var TextChoice = class extends Modal2 {
      constructor(plugin, title, value, apply) {
        super(plugin.app);
        Object.assign(this, { label: title, value, apply });
      }
      onOpen() {
        this.titleEl.setText(this.label);
        const input = this.contentEl.createEl("input", { type: "text", value: this.value, cls: "kl-component-choice-input" });
        input.setAttribute("aria-label", this.label);
        input.onkeydown = async (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          try {
            await this.apply(input.value);
            this.close();
          } catch (error) {
            new Notice2(error.message);
          }
        };
        input.focus();
        input.select();
      }
    };
    var Tags = class extends Modal2 {
      constructor(plugin, state) {
        super(plugin.app);
        this.plugin = plugin;
        this.state = state;
        this.values = [];
        this.available = [];
      }
      async request(op, args) {
        await this.plugin.admission.ready;
        return this.plugin.admission.request(op, args);
      }
      async onOpen() {
        this.titleEl.setText("Tags");
        this.modalEl.addClass("kl-component-tags-modal");
        const field = this.contentEl.createDiv("kl-component-tags-field");
        this.chips = field.createDiv("kl-component-tags-chips");
        this.input = field.createEl("input", { type: "text", attr: { "aria-label": "Add tags", placeholder: "Add a tag\u2026", list: "kl-component-tag-options" } });
        this.options = field.createEl("datalist", { attr: { id: "kl-component-tag-options" } });
        this.contentEl.createDiv({ cls: "kl-component-tags-hint", text: "Comma adds a tag \xB7 Enter applies" });
        this.input.oninput = () => {
          if (this.input.value.includes(",")) {
            this.add(this.input.value);
            this.input.value = "";
          }
          this.suggest();
        };
        this.input.onkeydown = async (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          this.add(this.input.value);
          try {
            await this.request("live-component-set-tags", { id: this.state.item.id, tags: this.values, key: randomUUID() });
            this.close();
          } catch (error) {
            new Notice2(error.message);
          }
        };
        try {
          const [current, all] = await Promise.all([this.request("live-component-tags", { id: this.state.item.id }), this.request("live-component-tags", {})]);
          if (!this.modalEl.isConnected) return;
          this.values = current.tags;
          this.available = all.tags;
          for (const tag of all.tags) this.options.createEl("option", { value: tag });
          this.draw();
          this.input.focus();
        } catch (error) {
          new Notice2(error.message);
        }
      }
      suggest() {
        clearTimeout(this.timer);
        const query = this.input.value;
        this.timer = setTimeout(async () => {
          try {
            const result = await this.request("live-component-tags", { query });
            if (!this.modalEl.isConnected || this.input.value !== query) return;
            this.options.empty();
            for (const tag of result.tags) this.options.createEl("option", { value: tag });
          } catch {
          }
        }, 150);
      }
      onClose() {
        clearTimeout(this.timer);
      }
      add(text) {
        for (const t of text.split(",")) {
          const value = t.trim().replace(/^#/, "").toLocaleLowerCase();
          if (value && !this.values.includes(value)) this.values.push(value);
        }
        this.draw();
      }
      draw() {
        this.chips.empty();
        for (const tag of this.values) {
          const chip = this.chips.createEl("button", { text: tag + " \xD7", cls: "kl-component-tag", attr: { "aria-label": "Remove " + tag } });
          chip.onclick = () => {
            this.values = this.values.filter((t) => t !== tag);
            this.draw();
            this.input.focus();
          };
        }
      }
    };
    function registerComponentActions(plugin) {
      const active = () => plugin.app.workspace.getActiveViewOfType(MarkdownView2);
      const owners = () => [...plugin.componentOwners || []].flatMap((set) => [...set]);
      const selected = () => {
        const view = active(), cm = view?.editor?.cm;
        if (!cm) return null;
        const focused = cm.dom.ownerDocument.activeElement?.closest?.(".kl-component")?._klState;
        if (focused) return focused;
        const last = plugin.componentCommandTarget;
        if (last?.node.isConnected && last.path === view.file?.path && cm.dom.contains(last.view.dom)) {
          const s2 = last.view.state.selection.main;
          if (s2.from === last.item.from && s2.to === last.item.to) return last;
        }
        const s = cm.state.selection.main;
        return owners().find((o) => o.view === cm && s.from >= o.item.from && s.to <= o.item.to) || null;
      };
      const safe = (fn) => async () => {
        try {
          await fn();
        } catch (error) {
          new Notice2(error.message);
        }
      };
      const create = async (view = active(), menuSelection = null, menuText = null) => {
        if (view?.file && await require_component_write_scope().nativeCreateIfExcluded(plugin, view.file.path)) return;
        const doc = view?.containerEl?.ownerDocument || document, focused = plugin.componentEditors?.get(doc.activeElement?.closest?.(".cm-editor"));
        const cm = menuSelection ? view?.editor?.cm : focused?.view || view?.editor?.cm;
        const embedded = plugin.componentEditors?.get(cm?.dom);
        if (embedded?.context?.part === "title") throw Error("Insert nested callouts in the body, not the title.");
        if (!view?.file || !cm || view.getMode() === "preview") throw Error("Open the note in editing mode to insert a callout.");
        const expected = cm.state.doc.toString();
        if (menuText !== null && menuText !== expected) throw Error("The note changed while the menu was open. Reopen it.");
        const selection = menuSelection || cm.state.selection.main;
        await plugin.admission.ready;
        const context = await plugin.admission.request("live-callout-controls-context", { path: view.file.path, text: expected, sourceHash: require("crypto").createHash("sha256").update(expected).digest("hex") });
        if (cm.state.doc.toString() !== expected) throw Error("The note changed. Insert the callout again.");
        const change = insertion(expected, selection.from, selection.to, context.effective);
        if (embedded?.context.nested) cm.dispatch({ changes: { from: change.from, to: change.to, insert: change.insert }, annotations: embedded.context.commands.isolateHistory.of("full"), userEvent: "input.callout" });
        else await plugin.componentIdentities.insert(cm, change, expected);
        const item = require_component_model().parseComponents(cm.state.doc).items.find((i) => i.id === change.id);
        if (!item) throw Error("The inserted callout could not be located.");
        cm.dispatch({ selection: { anchor: item.from, head: item.to }, scrollIntoView: true });
        for (let n = 0; n < 5; n++) {
          await new Promise((resolve) => cm.dom.ownerDocument.defaultView.requestAnimationFrame(resolve));
          const owner = [...embedded?.owners || owners()].find((o) => o.view === cm && o.item.id === change.id);
          if (owner) {
            owner.edit(change.part);
            return;
          }
        }
        throw Error("Callout inserted; press Enter to edit it.");
      };
      const requireState = () => {
        const state = selected();
        if (!state) throw Error("Select a callout first.");
        return state;
      };
      const openIndex = (state) => {
        const s = plugin.componentIdentities.state(state.path, state.item.metadata.match(/(?:^|\s)at=([^\s]+)/)?.[1]);
        if (!s?.admitted) throw Error("Admit this callout to the index first.");
        plugin.openLibraryEntry(state.item.id.split(".")[0]);
      };
      const type = (state) => new ChooseType(plugin, (value) => state.commit({ type: value }).catch((e) => new Notice2(e.message))).open();
      const persisted = async (state) => {
        const occurrence = at(state);
        await state.finishDraft?.();
        await state.finishAncestors?.();
        const view = active();
        if (view?.file?.path !== state.path) throw Error("Return to this callout before continuing.");
        const item = require_component_model().componentHeaders(view.editor.getValue()).find((h) => h.metadata.split(/\s+/).includes("at=" + occurrence));
        if (!item) throw Error("This callout changed before the action. Reopen it.");
        return { ...state, item: { ...state.item, ...item } };
      };
      const tags = async (state) => new Tags(plugin, await persisted(state)).open();
      const admit = async (state) => plugin.admission.review(at(await persisted(state)));
      const remove = async (state) => {
        state = await persisted(state);
        const id = state.item.id.split(".")[0], preview = await plugin.admission.request("live-component-remove-preview", { id });
        const modal = new Modal2(plugin.app);
        modal.titleEl.setText("Remove from index");
        modal.open();
        modal.contentEl.createEl("p", { text: `Remove \u201C${preview.title}\u201D from the shared index? Its callouts and references stay in your notes.` });
        if (preview.copies.length) {
          modal.contentEl.createEl("p", { text: "Occurrences that will become local:" });
          const list = modal.contentEl.createDiv({ cls: "kl-removal-copies" });
          for (const copy of preview.copies) list.createDiv({ text: `${copy.vaultLabel} \xB7 ${copy.path}` });
        }
        const footer = modal.contentEl.createDiv({ cls: "kl-footer" });
        footer.createEl("button", { text: "Cancel" }).onclick = () => modal.close();
        const button = footer.createEl("button", { text: "Remove from index", cls: "mod-warning" });
        button.onclick = safe(async () => {
          button.disabled = true;
          try {
            await plugin.admission.request("live-component-remove", { id, revision: preview.revision, key: randomUUID() });
            modal.close();
            await plugin.componentIdentities.replayMembership();
          } finally {
            button.disabled = false;
          }
        });
      };
      const number = (state, mode) => {
        const apply = (value) => {
          const tokens = state.item.metadata.split(/\s+/).filter((t) => !t.startsWith("n="));
          tokens.push("n=" + Buffer.from(JSON.stringify(value)).toString("hex"));
          return state.commit({ metadata: tokens.join(" ") });
        };
        if (mode === "auto") return apply({ mode: "auto", overrideAuthored: true });
        if (mode === "fixed") new TextChoice(plugin, "Author's number", "", (label) => {
          if (!label.trim()) throw Error("Enter the number to keep.");
          return apply({ mode: "fixed", label: label.trim(), overrideAuthored: true });
        }).open();
        else new TextChoice(plugin, "Separate series", "Personal", (name) => {
          if (!name.trim()) throw Error("Name the series.");
          return apply({ mode: "auto", counter: "user:" + state.item.type + ":" + name.trim(), overrideAuthored: true });
        }).open();
      };
      const menu = (event, state) => {
        const menu2 = Menu2.forEvent(event), add = (title, icon, fn) => menu2.addItem((i) => i.setTitle(title).setIcon(icon).onClick(safe(fn)));
        add("Edit title", "pencil", () => state.edit("title"));
        add("Edit body", "text", () => state.edit("body"));
        add("Change type\u2026", "shapes", () => type(state));
        add("Tags\u2026", "tags", () => tags(state));
        menu2.addItem((i) => {
          i.setTitle("Numbering mode").setIcon("list-ordered");
          const sub = i.setSubmenu();
          for (const [value, label] of [["auto", "Auto"], ["fixed", "Keep author's number\u2026"], ["series", "Separate series\u2026"]]) sub.addItem((j) => j.setTitle(label).onClick(safe(() => number(state, value))));
        });
        add("Note numbering settings\u2026", "settings", () => new NumberingControls(plugin, active()).open());
        menu2.addSeparator();
        add("Copy contents", "copy", () => state.copy());
        add("Copy link", "link", () => copyLink(state));
        add(state.folded ? "Unfold" : "Fold", "chevron-down", () => state.toggleFold());
        menu2.addSeparator();
        const admitted = plugin.componentIdentities.state(state.path, at(state))?.admitted;
        add(admitted ? "Open index entry" : "Admit to index\u2026", "library", () => admitted ? openIndex(state) : admit(state));
        if (admitted) add("Remove from index\u2026", "library", () => remove(state));
        const identityState = plugin.componentIdentities.state(state.path, at(state));
        if (admitted || identityState?.sourceChanged || identityState && !identityState.home) {
          add("Compare with source", "columns-2", () => compare(state));
          add("Sync from source", "refresh-cw", () => identityState?.ancestorChanges?.length ? compare(state) : plugin.componentIdentities.sync(state.view, at(state)));
          add("Detach as new callout", "unlink", () => detach(state));
        }
        menu2.showAtMouseEvent(event);
      };
      const at = (state) => state.item.metadata.match(/(?:^|\s)at=([^\s]+)/)?.[1];
      const copyLink = async (state) => {
        const label = (state.item.title || state.item.type).replace(/(?<!\\)\[/g, "\\[").replace(/(?<!\\)\]/g, "\\]");
        const id = state.item.id.split(".")[0];
        await state.node.ownerDocument.defaultView.navigator.clipboard.writeText(`[${label}](obsidian://knowledge-library?entry=${id})%%kl:t:lib.${id}%%`);
      };
      const compare = async (state) => {
        await plugin.admission.ready;
        const id = state.item.id.split(".")[0];
        const changes = await plugin.admission.request("live-component-ancestor-changes", { id });
        const modal = new Modal2(plugin.app), owner = new Component2();
        owner.load();
        modal.titleEl.setText(changes.length ? "Changes in source versions" : "Compare with source");
        modal.modalEl.addClass("kl-component-compare");
        modal.onClose = () => owner.unload();
        modal.open();
        const renderPair = async (pairs) => {
          const panes = modal.contentEl.createDiv("kl-component-compare-panes"), rendered = [];
          for (const [label, text, path2] of pairs) {
            const pane = panes.createDiv();
            pane.createEl("h3", { text: label });
            const body = pane.createDiv("markdown-rendered");
            rendered.push(body);
            await MarkdownRenderer2.render(plugin.app, require_component_model().cleanContents(text), body, path2 || state.path, owner);
          }
          if (rendered.length === 2) require_component_word_diff().highlightChanges(...rendered);
        };
        if (changes.length) {
          modal.contentEl.createEl("p", { text: "Your specialized version has not been changed. Compare the source revisions, then carry over the correction or explicitly replace this version." });
          for (const change of changes) {
            modal.contentEl.createEl("h3", { text: `${change.title} \xB7 ${change.levels} ${change.levels === 1 ? "level" : "levels"} up` });
            await renderPair([["Previous source \xB7 revision " + change.before.revision, change.before.raw], ["Current source \xB7 revision " + change.after.revision, change.after.raw]]);
            const button = modal.contentEl.createEl("button", { text: "Replace this version from this source" });
            button.onclick = safe(async () => {
              const confirmation = new Modal2(plugin.app);
              confirmation.titleEl.setText("Replace this specialized version?");
              confirmation.contentEl.createEl("p", { text: "Its title and body will take the selected source revision. Its identity and local numbering stay intact. Undo is available." });
              confirmation.contentEl.createEl("button", { text: "Replace", cls: "mod-warning" }).onclick = safe(async () => {
                if (state.reading) await plugin.componentIdentities.syncFile(state.path, at(state), change.id);
                else await plugin.componentIdentities.sync(state.view, at(state), change.id);
                confirmation.close();
                modal.close();
              });
              confirmation.open();
            });
          }
          return;
        }
        const source = await plugin.admission.request("live-component-detail", { id });
        if (source.kind !== state.item.type) modal.contentEl.createEl("p", { text: `Source type: ${source.kind}; this copy: ${state.item.type}` });
        await renderPair([["This copy", state.current().raw, state.path], ["Source", source.body, source.sourcePath]]);
        if (plugin.componentIdentities.state(state.path, at(state))?.sourceChanged) {
          const button = modal.contentEl.createEl("button", { text: "Sync from source", cls: "mod-cta" });
          button.onclick = safe(async () => {
            button.disabled = true;
            try {
              if (state.reading) await plugin.componentIdentities.syncFile(state.path, at(state));
              else await plugin.componentIdentities.sync(state.view, at(state));
              modal.close();
            } finally {
              button.disabled = false;
            }
          });
        }
      };
      const compareAt = async (path2, occurrence, view = null) => {
        const file = plugin.app.vault.getAbstractFileByPath(path2);
        if (!file) throw Error("The note is unavailable.");
        const text = view?.state.doc.toString() ?? await plugin.app.vault.read(file);
        const headers = require_component_model().componentHeaders(text), h = headers.find((r) => r.metadata.split(/\s+/).includes("at=" + occurrence));
        if (!h) throw Error("The callout moved; reopen its comparison.");
        return compare({ path: path2, item: h, current: () => ({ ...h, raw: text.slice(h.from, h.to) }), view, reading: !view });
      };
      const foldReading = async (path2, occurrence, node) => {
        const folds = require_component_reading_folds(), root = folds.rootFor(node);
        folds.set(root, path2, occurrence, !folds.current(node, path2));
      };
      const readingMenu = (event, path2, occurrence, node) => {
        const load = async () => {
          const file = plugin.app.vault.getAbstractFileByPath(path2);
          if (!file) throw Error("The note is unavailable.");
          const text = await plugin.app.vault.read(file), model = require_component_model(), h = model.componentHeaders(text).find((r) => r.metadata.split(/\s+/).includes("at=" + occurrence));
          if (!h) throw Error("The callout moved; reopen its menu.");
          const raw = text.slice(h.from, h.to), depth = (text.slice(text.lastIndexOf("\n", h.from - 1) + 1, h.from).match(/>/g) || []).length;
          const body = raw.slice(raw.indexOf("\n") < 0 ? raw.length : raw.indexOf("\n") + 1).split("\n").map((line) => {
            for (let n = 0; n <= depth; n++) line = line.replace(/^\s*>[ \t]?/, "");
            return line;
          }).join("\n");
          return { path: path2, item: h, node, reading: true, current: () => ({ ...h, raw }), copy: () => node.ownerDocument.defaultView.navigator.clipboard.writeText(model.cleanContents(body)) };
        };
        const menu2 = Menu2.forEvent(event), add = (title, icon, fn) => menu2.addItem((i) => i.setTitle(title).setIcon(icon).onClick(safe(fn)));
        add("Copy contents", "copy", async () => {
          const state2 = await load();
          await state2.copy();
        });
        add("Copy link", "link", async () => copyLink(await load()));
        add(require_component_reading_folds().current(node, path2) ? "Unfold" : "Fold", "chevron-down", () => foldReading(path2, occurrence, node));
        const state = plugin.componentIdentities.state(path2, occurrence);
        if (state?.admitted) add("Open index entry", "library", async () => openIndex(await load()));
        if (state?.admitted || state?.sourceChanged || state && !state.home) add("Compare with source", "columns-2", () => compareAt(path2, occurrence));
        menu2.showAtMouseEvent(event);
      };
      const detach = (state) => {
        const metadata = state.item.metadata.split(/\s+/).filter((t) => t.startsWith("n=") || !require_component_identity_model().privateToken(t));
        metadata.push(randomUUID() + ".local", "at=" + randomUUID(), "origin=" + state.item.id.split(".")[0]);
        return state.commit({ metadata: metadata.join(" ") });
      };
      const actions = [["remove-callout-from-index", "Remove callout from index\u2026", null, null, () => remove(requireState())], ["create-callout", "Insert or expand callout", ["Mod", "Shift"], "1", () => create()], ["edit-callout-title", "Edit callout title", null, null, () => requireState().edit("title")], ["edit-callout-body", "Edit callout body", null, null, () => requireState().edit("body")], ["change-callout-type", "Change callout type\u2026", null, null, () => type(requireState())], ["callout-tags", "Edit callout tags\u2026", null, null, () => tags(requireState())], ["toggle-callout", "Toggle callout fold", ["Mod", "Alt"], ".", () => {
        const s = requireState();
        return s.toggleFold();
      }], ["copy-callout", "Copy callout contents", ["Mod", "Alt"], "c", () => requireState().copy()], ["admit-callout", "Admit callout to index", ["Mod", "Alt"], "a", () => admit(requireState())], ["callout-source", "Go to callout in index", ["Mod", "Alt"], "l", () => openIndex(requireState())], ["copy-callout-link", "Copy callout link", null, null, () => copyLink(requireState())], ["sync-callout", "Sync callout from source", null, null, () => {
        const s = requireState();
        return plugin.componentIdentities.sync(s.view, at(s));
      }], ["compare-callout", "Compare callout with source", null, null, () => compare(requireState())], ["detach-callout", "Detach callout as new", null, null, () => detach(requireState())]];
      for (const [id, name, modifiers, key, callback] of actions) plugin.addCommand({ id, name, ...modifiers ? { hotkeys: [{ modifiers, key: key.toUpperCase() }] } : {}, callback: safe(callback) });
      for (const [mode, label] of [["auto", "Auto"], ["fixed", "Keep author's number"], ["series", "Separate series"]]) plugin.addCommand({ id: "callout-number-" + mode, name: "Callout numbering: " + label, callback: safe(() => number(requireState(), mode)) });
      const addEditorMenu = (menu2, editor, view, selection = null) => {
        if (!view.file || menu2.__klCreation) return;
        menu2.__klCreation = true;
        const cm = editor.cm, sel = selection || cm?.state.selection.main, text = editor.getValue();
        const token = sel && expansionAt(text, sel.head ?? sel.from);
        let destination = sel;
        if (selection && sel.from === sel.to && !token) {
          let end = text.indexOf("\n", sel.from);
          if (end < 0) end = text.length;
          while (end < text.length && text[end + 1] && text[end + 1] !== "\n") {
            const next = text.indexOf("\n", end + 1);
            end = next < 0 ? text.length : next;
          }
          destination = { from: end, to: end, head: end };
        }
        menu2.addItem((item) => item.setTitle(token ? "Expand callout" : "Insert callout").setIcon("square-plus").onClick(safe(() => create(view, destination, text))));
      };
      plugin.registerEvent(plugin.app.workspace.on("editor-menu", addEditorMenu));
      const documents = /* @__PURE__ */ new WeakSet();
      const attach = (doc) => {
        if (documents.has(doc)) return;
        documents.add(doc);
        plugin.registerDomEvent(doc, "contextmenu", (event) => {
          const target = event.target;
          if (!target.closest?.(".markdown-source-view") || target.closest(".kl-component") && !target.closest(".kl-component-editor")) return;
          let view = plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).find((v) => v.editor?.cm?.dom === target.closest(".cm-editor"));
          const embedded = plugin.componentEditors?.get(target.closest(".cm-editor"));
          if (!view && embedded?.context.nested) {
            const host = active();
            view = { file: host?.file, editor: { cm: embedded.view, getValue: () => embedded.view.state.doc.toString() }, getMode: () => "source" };
          }
          if (!view?.file) return;
          const cm = view.editor.cm, pos = cm.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos === null) return;
          const selected2 = cm.state.selection.main, selection = pos >= selected2.from && pos <= selected2.to ? selected2 : { from: pos, to: pos, head: pos };
          addEditorMenu(Menu2.forEvent(event), view.editor, view, selection);
        }, true);
      };
      attach(document);
      plugin.app.workspace.iterateAllLeaves((l) => attach(l.view.containerEl.ownerDocument));
      plugin.registerEvent(plugin.app.workspace.on("window-open", (_window, win) => attach(win.document)));
      plugin.componentActions = { menu, readingMenu, foldReading, create, selected, compare, compareAt };
      plugin.register(() => {
        plugin.componentActions = null;
      });
    }
    module2.exports = { registerComponentActions };
  }
});

// plugin/reference-label-writer.js
var require_reference_label_writer = __commonJS({
  "plugin/reference-label-writer.js"(exports2, module2) {
    var { Transaction } = require("@codemirror/state");
    var { componentSaved, componentFile } = require_component_file_ready();
    function registerLabelWriter(plugin) {
      let closed = false, running = false, timer = null;
      const request = async (op, args) => {
        await plugin.admission.ready;
        return plugin.admission.request(op, args);
      };
      let requested = false;
      const kick = (delay = 20) => {
        requested = true;
        if (!closed && !timer && !running) timer = setTimeout(() => {
          timer = null;
          void step();
        }, delay);
      };
      const update = async (path2) => {
        if (plugin.admission.paused.has(path2)) return false;
        const views = plugin.app.workspace.getLeavesOfType("markdown").map((l) => l.view).filter((v) => v.file?.path === path2);
        if (views.some((v) => v.containerEl.querySelector(".kl-component-editing,.math-studio-host"))) return false;
        const file = await componentFile(plugin.app.vault, path2);
        if (!file) return false;
        const view = views.find((v) => v.getMode() === "source" && v.editor?.cm), text = view ? view.editor.getValue() : await plugin.app.vault.read(file);
        const plan = await request("live-reference-label-plan", { path: path2, text });
        if (closed) return false;
        if (view) {
          if (view.editor.getValue() !== text) return false;
          const changes = plan.editorChanges.map((e) => ({ from: view.editor.posToOffset(e.from), to: view.editor.posToOffset(e.to), insert: e.text }));
          if (changes.length) view.editor.cm.dispatch({ changes, annotations: Transaction.addToHistory.of(false), userEvent: "input.reference-label" });
        } else if (plan.edits.length) await plugin.app.vault.process(file, (current) => {
          if (current !== text) throw Error("Note changed during reference refresh");
          return plan.text;
        });
        await componentSaved(plugin.app.vault, path2, plan.text);
        await request("live-reference-label-finish", { plan, text: plan.text });
        return true;
      };
      async function step() {
        if (closed || running) return;
        running = true;
        requested = false;
        let more = false;
        try {
          const pending = await request("live-reference-pending", { limit: 20, labelsFirst: true });
          more = pending.length > 0;
          for (const row of pending) {
            if (closed) break;
            try {
              await update(row.path);
            } catch (error) {
              plugin.referenceLabelIssue = error.message;
            }
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        } catch (error) {
          plugin.referenceLabelIssue = error.message;
        } finally {
          running = false;
          if (more || requested) kick(more ? 250 : 20);
        }
      }
      plugin.registerEvent(plugin.app.vault.on("modify", () => kick()));
      plugin.registerEvent(plugin.app.workspace.on("knowledge-library:component-identities-changed", () => kick()));
      plugin.referenceLabelWriter = { update, kick };
      plugin.register(() => {
        closed = true;
        clearTimeout(timer);
        delete plugin.referenceLabelWriter;
      });
      kick();
    }
    module2.exports = { registerLabelWriter };
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
var { DocumentFeed } = require_document_feed();
var TEST_DATA_ROOT = path.join(require("os").homedir(), "Projects", "cross-vault-library-lab");
var CORPUS = path.join(TEST_DATA_ROOT, "test-corpus-20261020-v4");
var PALETTE = require_entry_palette();
function revealSource(editor, line, endLine) {
  const after = Number.isInteger(endLine) && endLine < editor.lineCount() ? endLine : Math.max(0, line - 1);
  editor.setCursor({ line: after, ch: 0 });
  editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
  editor.focus();
}
var Client = class {
  constructor(vaultRoot = null, production = false, libraryRoot = null, runtimeRoot = null) {
    if (!runtimeRoot) throw new Error("Index backend location is unavailable.");
    this.serial = 0;
    this.pending = /* @__PURE__ */ new Map();
    this.buffer = "";
    this.capability = require("crypto").randomBytes(32).toString("hex");
    const args = vaultRoot ? ["-u", path.join(runtimeRoot, "reviewed_service.py"), "--root", libraryRoot || path.join(TEST_DATA_ROOT, "reviewed-library-test"), "--vault", vaultRoot, ...production ? ["--production", "--enroll"] : []] : ["-u", path.join(runtimeRoot, "query_service.py"), "--corpus", CORPUS];
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
            result.error ? wait.reject(Object.assign(new Error(result.error), { retryable: result.retryable !== false, code: result.code })) : wait.resolve(result);
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
        reject(new Error("The local index request took too long. Try again."));
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
  constructor(plugin, reviewed = false, reference = null, captureDestination = true) {
    super(plugin.app);
    this.scope = new Scope(this.scope);
    this.plugin = plugin;
    this.reference = reference;
    this.reviewed = reviewed;
    this.settings = reference ? plugin.settings.referenceFilters : reviewed ? plugin.settings.reviewed : plugin.settings;
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
    this.destination = captureDestination ? this.app.workspace.getActiveViewOfType(MarkdownView) : null;
    if (this.destination?.file) {
      this.destinationPath = this.destination.file.path;
      this.destinationLine = this.destination.editor.getCursor().line;
      this.destinationHash = require("crypto").createHash("sha256").update(this.destination.editor.getValue().replace(/\r\n?/g, "\n")).digest("hex");
    }
  }
  registerShortcut(modifiers, key, callback) {
    if (this.hoverPopover) return;
    if (this.shortcutSlots) {
      this.shortcutSlots.bind(this, modifiers, key, callback);
      return;
    }
    const handler = this.scope.register(modifiers, key, callback);
    (this.shortcuts ??= []).push(handler);
  }
  onOpen() {
    this.client = this.reviewed ? this.plugin.admission.client : new Client(null, false, null, this.plugin.runtimeRoot);
    this.owner = new Component();
    this.owner.load();
    this.monitor = this.plugin.production || this.hoverPopover ? null : startMonitor(this.app, path.join(TEST_DATA_ROOT, "outputs"), this.contentEl.ownerDocument.defaultView);
    if (this.initialEntryId) return this.openEntryView();
    this.modalEl.addClass("kl-modal");
    if (this.reference) this.modalEl.addClass("kl-reference-browser");
    this.titleEl.setText(this.reference ? this.reference.title || "Insert reference" : "Index");
    if (!this.hostLeaf) this.closeResize = require_resize_modal().attachResize(this.modalEl, this.plugin.settings[this.reference ? "referenceWindow" : "browserWindow"], (size) => {
      this.plugin.settings[this.reference ? "referenceWindow" : "browserWindow"] = size;
      this.plugin.persist().catch(() => new Notice("Window size could not be saved."));
    });
    const head = this.contentEl.createDiv({ cls: "kl-head" });
    this.scopeChip = head.createDiv({ cls: "kl-scope-summary", attr: { "aria-label": "Active search filters" } });
    head.createSpan({ text: this.plugin.production ? "REVIEWED" : this.reviewed ? "REVIEWED \xB7 TEST" : "CORPUS \xB7 TEST", cls: "kl-test" });
    this.titleRenderer = new TitleRenderer(this.contentEl.ownerDocument, () => this.draw());
    this.filterBar = new FilterBar(this, this.contentEl, this.scopeChip);
    this.input = this.filterBar.input;
    this.status = this.contentEl.createDiv({ cls: "kl-status", attr: { role: "status", "aria-live": "polite" } });
    const panes = this.contentEl.createDiv({ cls: "kl-panes" });
    this.list = panes.createDiv({ cls: "kl-list", attr: { role: "listbox", id: this.uid + "-list", "aria-labelledby": this.uid + "-list-label" } });
    this.layer = this.list.createDiv({ cls: "kl-layer" });
    this.preview = panes.createDiv({ cls: "kl-preview", attr: { tabindex: "0", "aria-labelledby": this.uid + "-preview-label" } });
    this.contentEl.createSpan({ cls: "kl-visually-hidden", text: "Search results", attr: { id: this.uid + "-list-label" } });
    this.contentEl.createSpan({ cls: "kl-visually-hidden", text: "Entry preview", attr: { id: this.uid + "-preview-label" } });
    const foot = this.contentEl.createDiv({ cls: "kl-footer" });
    foot.createSpan({ text: this.reference ? `\u2191 \u2193 browse \xB7 Enter ${this.reference.chooseOnly ? "link" : "insert"} \xB7 \u2318\u21E7A all sources \xB7 Esc equation \xB7 \u2318Enter source` : "\u2191 \u2193 browse \xB7 Enter read \xB7 \u2318Enter source \xB7 \u2318. actions" });
    this.pages = foot.createSpan({ cls: "kl-page-status" });
    if (this.reference) this.buildReferenceFooter();
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
    const shortcuts = { ".": () => this.actions(), k: () => {
      this.input.focus();
      this.input.select();
    }, f: () => {
      this.input.focus();
      this.input.select();
    }, e: () => this.chooseScope(), "shift+a": () => this.filterBar.clear() };
    for (const [key, fn] of Object.entries(shortcuts)) this.registerShortcut(key.startsWith("shift+") ? ["Mod", "Shift"] : ["Mod"], key.split("+").pop(), () => {
      fn();
      return false;
    });
    this.registerShortcut(["Mod", "Shift"], "h", () => {
      this.showHistory();
      return false;
    });
    this.registerShortcut(["Mod", "Shift"], "Enter", () => {
      if (!this.filterBar.blocked()) this.reuseSelected();
      return false;
    });
    this.loadCatalog();
    this.input.focus();
    if (this.reference) {
      this.positionReferencePicker();
      const win = this.contentEl.ownerDocument.defaultView;
      this.releaseReferenceFocus = require_reference_focus().holdReferenceFocus(this.modalEl, this.input);
    }
    this.plugin.active = this;
    this.plugin.browsers.add(this);
    this.contentEl.addEventListener("focusin", () => {
      this.plugin.active = this;
    });
  }
  async openEntryView() {
    this.entryMode = true;
    this.modalEl.addClass(this.hoverPopover ? "kl-entry-hover" : this.hostLeaf ? "kl-entry-pane" : "kl-entry-modal");
    this.titleEl.setText("");
    this.titleEl.hidden = true;
    this.contentEl.createSpan({ text: "Referenced entry", cls: "kl-visually-hidden", attr: { id: this.uid + "-entry-label" } });
    this.status = this.contentEl.createDiv({ cls: "kl-status", text: "Loading reference\u2026", attr: { role: "status" } });
    this.preview = this.contentEl.createDiv({ cls: "kl-entry-preview", attr: { tabindex: "0", role: "region", "aria-labelledby": this.uid + "-entry-label" } });
    const footer = this.contentEl.createDiv({ cls: "kl-entry-footer" });
    this.entrySource = footer.createEl("button", { text: "Open source" });
    this.entrySource.disabled = true;
    this.entrySource.onclick = () => this.openSource();
    footer.createEl("button", { text: this.hostLeaf ? "Search index" : "Open in Index" }).onclick = () => this.expandEntry();
    this.registerShortcut(["Mod"], "Enter", () => {
      this.openSource();
      return false;
    });
    this.registerShortcut(["Mod", "Shift"], "Enter", () => {
      this.expandEntry();
      return false;
    });
    if (this.hostLeaf) this.registerShortcut(["Mod"], "k", () => {
      this.expandEntry();
      return false;
    });
    if (!this.hoverPopover) this.plugin.active = this;
    this.plugin.browsers.add(this);
    this.contentEl.addEventListener("focusin", () => {
      this.plugin.active = this;
    });
    this.positionEntry();
    await this.loadEntry();
  }
  async loadEntry() {
    const ticket = ++this.ticket;
    this.pendingSearch = true;
    this.entrySource.disabled = true;
    try {
      await this.plugin.admission.ready;
      const data = (await this.client.request({ op: "detail", id: this.initialEntryId })).data;
      if (this.closed || ticket !== this.ticket) return;
      this.rows = [data];
      this.selected = 0;
      this.cache.set(data.id, data);
      const previous = this.slots?.[0];
      this.feedGeneration = (this.feedGeneration || 0) + 1;
      const slot = { entry: { ...data, index: 0 }, el: previous?.el || this.preview.createDiv(), generation: this.feedGeneration, visible: true, owner: previous?.owner };
      if (previous) {
        previous.invalidated = true;
        previous.owner = null;
      }
      this.slots = [slot];
      await this.renderSlot(slot);
      if (this.closed || ticket !== this.ticket) return;
      this.pendingSearch = false;
      this.entrySource.disabled = false;
      this.entrySource.title = data.path + " \xB7 line " + data.line_start;
      this.status.hidden = !!slot.rendered;
      if (slot.rendered) {
        this.entryData = data;
        this.onEntryLoaded?.(data);
        this.hostLeaf?.view?.refreshTitle?.();
      }
      this.positionEntry();
    } catch (error) {
      if (!this.closed && ticket === this.ticket) {
        this.pendingSearch = false;
        this.status.hidden = false;
        this.status.setText(error.message);
      }
    }
  }
  positionEntry() {
    if (this.hoverPopover) {
      if (this.hoverPopover.hoverEl.isConnected && typeof this.hoverPopover.position === "function") this.hoverPopover.position();
      return;
    }
    if (this.hostLeaf || !this.entryAnchor) return;
    const win = this.contentEl.ownerDocument.defaultView;
    const placement = require_entry_layout().placement(this.entryAnchor, { width: win.innerWidth, height: win.innerHeight });
    Object.assign(this.modalEl.style, placement);
  }
  expandEntry() {
    if (this.hostLeaf) return this.hostLeaf.setViewState({ type: "knowledge-library", active: true, state: { reviewed: true } });
    const id = this.initialEntryId;
    this.leavingEntry = true;
    this.close();
    return this.plugin.openPane(false, { entryId: id });
  }
  async loadCatalog() {
    this.pendingSearch = true;
    try {
      if (this.reference) await this.plugin.admission.ready;
      const [response] = await Promise.all([this.client.request({ op: "catalog", previousProfile: this.settings.profile, ...this.reference ? { referencePath: this.reference.path } : {} }), this.reference && !this.reference.local ? this.reference.load() : Promise.resolve()]);
      if (this.closed) return;
      this.configurationDiagnostics = response.data.configurationDiagnostics || [];
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
      const filterCatalog = { vaults: this.catalog, types: this.typeCatalog, sources: this.sourceCatalog };
      if (this.reference) {
        this.referenceContext = response.data.referenceContext;
        if (!this.filterBar.model) this.restoredState = require_reference_session().defaultFilters(this.settings, filterCatalog, this.referenceContext, this.reference.purpose);
      }
      this.filterBar.load(filterCatalog, this.settings, this.restoredState);
      this.restoredState = null;
      this.search();
    } catch (e) {
      if (!this.closed) {
        this.pendingSearch = false;
        this.status.setText(e.message);
      }
    }
  }
  positionReferencePicker() {
    const cm = this.reference.editor.cm, position = this.reference.editor.posToOffset?.(this.reference.positions[1]) ?? 0, caret = this.reference.anchorRect || cm?.coordsAtPos?.(position);
    if (!caret) return;
    const win = this.contentEl.ownerDocument.defaultView, rect = this.modalEl.getBoundingClientRect();
    const below = win.innerHeight - caret.bottom - 20, above = caret.top - 20;
    const top = below >= rect.height ? caret.bottom + 8 : above >= rect.height ? caret.top - rect.height - 8 : Math.max(20, (win.innerHeight - rect.height) / 2);
    Object.assign(this.modalEl.style, { position: "fixed", margin: "0", top: top + "px", left: Math.max(20, Math.min(caret.left, win.innerWidth - rect.width - 20)) + "px" });
  }
  buildReferenceFooter() {
    const foot = this.contentEl.createDiv({ cls: "kl-reference-footer" });
    this.referenceChoice = foot.createSpan({ cls: "kl-reference-choice" });
    this.referenceSelect = foot.createEl("select", { attr: { "aria-label": "Reference label" } });
    for (const [value, label] of [["auto", "Number or title"], ["n", "Number"], ["t", "Title"], ["b", "Number and title"], ...this.reference.words ? [["c", this.reference.chooseOnly ? "Keep selected expression" : "Keep selected words"]] : []]) this.referenceSelect.createEl("option", { value, text: label });
    this.registerShortcut([], "Escape", () => {
      this.close();
      return false;
    });
    this.registerShortcut([], "Tab", () => {
      if (this.filterBar.blocked() || this.contentEl.ownerDocument.activeElement === this.referenceSelect) return true;
      const modes = [...this.referenceSelect.options].filter((o) => !o.disabled && ["n", "t", "b"].includes(o.value)).map((o) => o.value);
      if (!modes.length) return true;
      this.reference.mode = modes[(modes.indexOf(this.reference.mode) + 1) % modes.length];
      this.referenceSelect.value = this.reference.mode;
      this.updateReferenceChoice();
      return false;
    });
    this.referenceSelect.value = this.reference.mode;
    this.referenceSelect.onchange = () => {
      this.reference.mode = this.referenceSelect.value;
      this.updateReferenceChoice();
    };
    this.panelSelect = foot.createEl("select", { attr: { "aria-label": "Figure panel" } });
    this.panelSelect.hidden = true;
    this.panelSelect.onchange = () => {
      this.reference.panel = this.panelSelect.value;
      this.updateReferenceChoice();
    };
    this.referenceInsert = foot.createEl("button", { text: this.reference.buttonLabel || "Insert", cls: "mod-cta" });
    this.referenceInsert.disabled = true;
    this.referenceInsert.onclick = () => this.insertReference();
    this.referenceWarning = this.contentEl.createDiv({ cls: "kl-reference-status" });
    this.referenceWarning.hidden = true;
  }
  updateReferenceChoice() {
    if (!this.reference) return;
    const row = this.rows[this.selected], d = row?.display;
    const figure = row?.kind === "figure", available = figure ? require_figure_panels().panels(row.body || this.cache.get(row.id)?.body || "") : [];
    const panelKey = (row?.id || "") + available.join(",");
    if (this.panelKey !== panelKey) {
      this.panelKey = panelKey;
      this.reference.panel = "";
      this.panelSelect.empty();
      this.panelSelect.createEl("option", { value: "", text: "Whole figure" });
      for (const panel of available) this.panelSelect.createEl("option", { value: panel, text: "Panel (" + panel + ")" });
    }
    this.panelSelect.hidden = !available.length;
    const numbered = !!d?.numberLabel && !d?.issue;
    if (row && !row.local && !row.referenceResolved && !row.referenceResolving) {
      row.referenceResolving = true;
      this.plugin.referenceResolver.editor({ path: this.reference.path, doc: this.reference.snapshot, text: () => this.reference.text }, ["lib." + row.id]).then(async (result) => {
        const target = "lib." + row.id;
        row.display = result.targets[target];
        if (["not-own-target", "identity-unavailable"].includes(row.display?.issueCode)) row.display = (await this.plugin.referenceResolver.resolve(this.reference.path, [target]))[target];
        row.referenceResolved = true;
      }).catch((error) => {
        row.referenceResolved = true;
        row.display = { issue: error.message };
      }).finally(() => {
        row.referenceResolving = false;
        if (!this.closed && this.rows[this.selected] === row) this.updateReferenceChoice();
      });
    }
    for (const option of this.referenceSelect.options) if (option.value === "n" || option.value === "b") option.disabled = !numbered;
    if (!numbered && ["n", "b"].includes(this.reference.mode)) {
      this.reference.mode = "auto";
      this.referenceSelect.value = "auto";
    }
    const label = this.reference.label(row), reason = this.reference.reason(row);
    if (this.reference.chooseOnly && !reason) {
      const shown = this.reference.mode === "c" ? label.length <= 1e3 ? "$" + label + "$" : "Selected expression" : label;
      this.referenceChoice.empty();
      this.titleRenderer.render(this.referenceChoice, "choice", this.reference.currentTarget ? this.reference.mode === "c" ? "Keeps the linked expression" : `Replaces the linked expression with \u201C${label}\u201D` : `Link \u201C${shown}\u201D \u2192 ${numbered ? d.bothLabel : row?.title || ""}`, { inline: true });
      this.titleRenderer.flush();
    } else this.referenceChoice.setText(reason || `${this.reference.mode === "c" ? "Link" : "Insert"} \u201C${label}\u201D \u2192 ${numbered ? d.bothLabel : row?.title || ""}`);
    this.referenceWarning.hidden = !d?.warning;
    this.referenceWarning.setText(d?.warning || "");
    this.referenceInsert.disabled = this.pendingSearch || this.inserting || !!row?.referenceResolving || !!reason;
  }
  async insertReference() {
    if (!this.reference || this.referenceInsert.disabled) return;
    this.inserting = true;
    this.updateReferenceChoice();
    try {
      if (await this.reference.apply(this.rows[this.selected])) {
        this.close();
        if (!this.reference.chooseOnly) this.reference.editor.focus();
      }
    } catch (e) {
      this.status.setText(e.message);
    } finally {
      this.inserting = false;
      if (!this.closed) this.updateReferenceChoice();
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
      this.initialEntryId = null;
      this.inputAt = performance.now();
      this.searchTimer = setTimeout(() => this.search(), 40);
    }
  }
  async applyScope(ids, groupId = null, types = null, sources = null) {
    if (ids === null && types === null && sources === null) this.filterBar.clear();
  }
  scopeRequest() {
    if (this.entryMode) return {};
    if (this.filterBar?.model) {
      const { vaultIds, types, sourceIds } = this.filterBar.request();
      return { vaultIds, types, sourceIds, drafts: this.drafts, profile: this.profile, ...this.reference ? { referencePath: this.reference.path } : {} };
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
      this.reference ? this.insertReference() : this.preview.focus();
    }
  }
  async search() {
    if (this.filterBar?.blocked()) return;
    clearTimeout(this.indexRetryTimer);
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
      const response = await this.client.request(this.initialEntryId ? { op: "detail", id: this.initialEntryId } : { query: this.filterBar.query(), offsets: this.offsets, ...this.scopeRequest() });
      if (this.initialEntryId) response.data = { groups: [{ term: "Library entry", rows: [response.data], more: false, offset: 0 }] };
      if (this.closed || ticket !== this.ticket) return;
      this.pendingSearch = false;
      this.shownSearchKey = searchKey;
      this.profile = response.profile;
      this.groups = response.data.groups;
      this.warning = response.warning;
      this.groups.forEach((g, i) => {
        g.queryIndex = g.queryKey ?? i;
      });
      if (this.reference) {
        const rows = this.reference.localGroup(this.filterBar.query(), this.scopeRequest(), this.sourceCatalog, this.referenceContext);
        if (rows.length) this.groups = [{ term: "This note", rows, more: false, offset: 0, local: true }, ...this.groups.filter((g) => g.rows.length || g.more || g.offset)];
      }
      if (response.pendingSequence != null) this.indexRetryTimer = setTimeout(() => {
        if (!this.closed) this.search();
      }, 500);
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
      if (this.reference?.currentTarget && !this.reference.initialTargetSelected) {
        const target = this.reference.currentTarget, index = this.rows.findIndex((r) => r.local ? r.blockId === target : "lib." + r.id === target);
        if (index >= 0) {
          this.selected = index;
          this.reference.initialTargetSelected = true;
        }
      }
      if (this.pageTarget != null) {
        const target = this.rows.findIndex((x) => x.groupIndex === this.pageTarget);
        if (target >= 0) this.selected = target;
        this.pageTarget = null;
      }
      this.list.scrollTop = 0;
      this.status.setText(this.reference ? `${this.rows.length} ${this.rows.length === 1 ? "result" : "results"}${this.groups.some((g) => g.more) ? " \xB7 more available" : ""}` : this.groups.length > 1 ? `${this.groups.length} separate searches \xB7 ${this.rows.length} results on this page` : `${this.rows.length} ${this.rows.length === 1 ? "result" : "results"} on this page${this.groups.some((g) => g.more) ? " \xB7 more available" : ""}`);
      if (this.warning) this.status.setText(this.warning + " \xB7 " + this.rows.length + " results");
      if (this.configurationDiagnostics?.length) this.status.setText("Book configuration needs attention: " + this.configurationDiagnostics.map((d) => d.message).join(" \xB7 "));
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
      const shown = require_callout_presentation().pickerPresentation(item);
      row.setAttribute("aria-label", `${shown.title}. ${item.vault}.`);
      row.toggleClass("is-selected", item.index === this.selected);
      this.titleRenderer.render(row, item.index + ":" + item.id, shown.title);
      const label = row.createDiv({ cls: "kl-row-meta" });
      label.createSpan({ text: shown.kind, cls: "kl-kind" });
      if (item.copies > 1) label.createSpan({ text: "\xD7" + item.copies, cls: "kl-copies" });
      label.createSpan({ text: item.local ? "This note \xB7 line " + item.line_start : item.vault.replaceAll("_", " ") + " \xB7 " + this.shortSource(item.path) });
      row.title = item.path;
      row.onclick = () => {
        if (this.pendingSearch) return;
        this.selected = item.index;
        this.draw();
        this.schedulePreview();
        this.input.focus();
      };
      row.ondblclick = () => this.reference ? this.insertReference() : this.openSource();
    }
    this.titleRenderer.flush();
    this.updateReferenceChoice();
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
      for (const item of this.items) {
        if (item.header || !this.changedEntries?.has(item.id)) continue;
        const previous = this.slots[item.index];
        if (!previous) continue;
        previous.invalidated = true;
        const slot = { el: previous.el, entry: item, generation: this.feedGeneration, visible: previous.visible, rendered: false, queued: false, owner: previous.owner };
        previous.owner = null;
        this.slots[item.index] = slot;
        if (slot.visible) this.enqueue(slot);
      }
      this.changedEntries = null;
      return;
    }
    this.changedEntries = null;
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
        else if (slot.rendered || slot.owner) {
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
      if (slot.invalidated || slot.generation !== this.feedGeneration || this.slots[slot.entry.index] !== slot || !slot.visible) {
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
    const alive = () => !this.closed && !slot.invalidated && slot.generation === this.feedGeneration && this.slots[entry.index] === slot && slot.visible;
    let owner;
    try {
      let data = entry.local ? entry : this.cache.get(entry.id);
      if (!data) {
        data = (await this.client.request({ op: "detail", id: entry.id, ...this.scopeRequest() })).data;
        if (!alive()) return;
        this.cache.set(entry.id, data);
        if (this.cache.size > 20) this.cache.delete(this.cache.keys().next().value);
      }
      if (!alive()) return;
      if (this.reference && this.rows[this.selected] === entry) this.updateReferenceChoice();
      owner = new Component();
      owner.load();
      const staging = this.contentEl.ownerDocument.createElement("div");
      const meta = staging.createDiv({ cls: "kl-preview-meta" });
      if (this.entryMode) meta.createSpan({ cls: "kl-entry-source-label", text: data.kind + " \xB7 " + data.path.split("/").at(-1).replace(/\.md$/, "") + " \xB7 line " + data.line_start, attr: { title: data.path + " \xB7 line " + data.line_start } });
      else meta.createSpan({ text: require_callout_presentation().pickerPresentation(data).kind + " \xB7 " + (entry.local ? "This note \xB7 line " + data.line_start : data.vault.replaceAll("_", " ")) });
      if (!entry.local && (!this.entryMode || !this.plugin.production)) meta.createSpan({ text: this.plugin.production ? "r" + data.revision : "TEST COPY" });
      if (data.panel) meta.createSpan({ text: "Panel (" + data.panel + ")" });
      const body = staging.createDiv({ cls: "kl-body markdown-rendered" });
      const sourcePath = data.sourcePath || "Sources/" + data.vault + "/" + data.path;
      if (data.status && data.status !== "current") meta.createSpan({ text: "Saved version \xB7 source " + data.status });
      let renderBody = data.body;
      if (this.reviewed && !entry.local) {
        const portable = await this.plugin.admission.request("live-portable", { id: data.id, preview: true });
        renderBody = portable.body;
        for (const asset of portable.assets) renderBody = renderBody.replace(asset.key, Platform.resourcePathPrefix + asset.source);
      }
      await MarkdownRenderer.render(this.app, renderBody.replace(/^(\s*>\s*\[![^\]]+\])[-+]/gm, "$1"), body, sourcePath, owner);
      if (data.panel) require_figure_panels().emphasize(body, data.panel);
      if (!alive()) {
        owner.unload();
        return;
      }
      if (entry.local) {
        const heading = body.querySelector(".callout > .callout-title > .callout-title-inner");
        if (heading) {
          const headings = new (require_callout_presentation()).CalloutHeadings();
          headings.render(heading, data);
          owner.register(() => headings.close());
        }
      }
      if (!this.entryMode) {
        const source = staging.createEl("a", { cls: "kl-provenance kl-copy-source", href: "#", text: data.path + " \xB7 line " + data.line_start });
        source.onclick = (e) => {
          e.preventDefault();
          if (!this.pendingSearch) this.openOccurrence(data);
        };
      }
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
            for (const source of response.data.rows) {
              const link = holder.createEl("a", { text: source.vault.replaceAll("_", " ") + " \xB7 " + source.path + " \xB7 line " + source.line_start, cls: "kl-copy-source", href: "#" });
              link.onclick = (e) => {
                e.preventDefault();
                if (!this.pendingSearch) this.openOccurrence(source);
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
      const previousOwner = slot.owner;
      slot.owner = owner;
      slot.el.replaceChildren(staging);
      previousOwner?.unload();
      slot.el.style.minHeight = "";
      slot.rendered = true;
      requestAnimationFrame(() => {
        if (alive()) this.metrics.push({ type: "feed-preview-render", ms: performance.now() - begin, entryId: entry.id, characters: data.body.length, mathNodes: body.querySelectorAll("mjx-container").length, livePreviews: this.slots.filter((x) => x.rendered).length });
      });
    } catch (e) {
      owner?.unload();
      if (alive()) {
        if (slot.owner) this.status.setText("Preview refresh pending: " + e.message);
        else {
          slot.el.empty();
          slot.el.createEl("p", { text: "Preview unavailable: " + e.message });
        }
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
      let line = row.line_start - 1, endLine = row.line_end, sourcePath = row.sourcePath || "Sources/" + row.vault + "/" + row.path, mode = "preview";
      if (this.reviewed && !row.local) {
        const located = await this.plugin.admission.request("live-locate", { id: row.id });
        line = located.line - 1;
        endLine = located.endLine;
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
      if (!this.hostLeaf) {
        this.leavingEntry = true;
        this.close();
      }
      if (this.hostLeaf && this.plugin.lastEditor?.leaf) this.app.workspace.setActiveLeaf(this.plugin.lastEditor.leaf, { focus: false });
      const leaf = this.hostLeaf && !this.plugin.lastEditor?.leaf ? this.app.workspace.getLeaf("split", "vertical") : this.app.workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode }, eState: { line } });
      if (mode === "source" && leaf.view.editor) revealSource(leaf.view.editor, line, endLine);
    } catch (e) {
      new Notice(e.message);
    }
  }
  async reuseSelected(admitCopy = true) {
    if (this.reference?.chooseOnly || this.pendingSearch || !this.reviewed || this.reusing) return;
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
      if (row.local) throw new Error("This result is already in the destination note.");
      const data = (await this.client.request({ op: "detail", id: row.id, ...this.scopeRequest() })).data;
      await this.plugin.portableBody(data);
      const result = await this.plugin.admission.request("live-component-copy-body", { id: data.id, revision: data.revision });
      if (this.reference?.insertCopy) await this.reference.insertCopy(result.body);
      else {
        const cm = this.destination.editor.cm, before = this.destination.editor.getValue();
        if (!cm || require("crypto").createHash("sha256").update(before.replace(/\r\n?/g, "\n")).digest("hex") !== this.destinationHash) throw Error("The destination changed. Reopen the picker.");
        const selected = this.reference?.positions, from = selected ? this.destination.editor.posToOffset(selected[0]) : cm.state.selection.main.from, to = selected ? this.destination.editor.posToOffset(selected[1]) : cm.state.selection.main.to;
        require_component_creation_model().insertion(before, from, to);
        const insert = (from && !before.slice(0, from).endsWith("\n\n") ? "\n\n" : "") + result.body + (to < before.length && !before.slice(to).startsWith("\n\n") ? "\n\n" : "");
        await this.plugin.componentIdentities.commit(cm, before, { from, to, insert }, "paste");
      }
      if (!this.hostLeaf) this.close();
      this.reference?.editor.focus();
    } catch (e) {
      new Notice(e.message, 8e3);
    } finally {
      this.reusing = false;
    }
  }
  async showHistory() {
    if (this.pendingSearch || !this.reviewed) return;
    const row = this.rows[this.selected];
    if (!row || row.local) return;
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
      const data = row.local ? row : (await this.client.request({ op: "detail", id: row.id, ...this.scopeRequest() })).data;
      await this.contentEl.ownerDocument.defaultView.navigator.clipboard.writeText(data.body);
      new Notice("Entry copied as Markdown.");
    } catch (e) {
      new Notice(e.message);
    }
  }
  page(delta) {
    if (this.pendingSearch) return;
    const groupIndex = this.rows[this.selected]?.groupIndex ?? 0, group = this.groups?.[groupIndex];
    if (group?.local) return;
    if (!group || delta < 0 && !group.offset || delta > 0 && !group.more) return;
    this.offsets[String(group.queryIndex ?? groupIndex)] = Math.max(0, (group.offset || 0) + delta * 16);
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
    if (this.reviewed && !this.reference?.chooseOnly && !this.rows[this.selected]?.local) {
      menu.addItem((i) => i.setTitle("Edit index entry\u2026").setIcon("pencil").onClick(() => new (require_component_entry_editor()).EntryEditor(this.plugin, this.rows[this.selected].id).open()));
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
  refreshReviewed(change = null) {
    if (!this.reviewed || this.closed) return;
    if (this.entryMode) {
      if (!change || change.reset || change.changedIds?.includes(this.initialEntryId)) {
        this.cache.delete(this.initialEntryId);
        this.loadEntry();
      }
      return;
    }
    this.refreshScroll = { preview: this.preview.scrollTop, list: this.list.scrollTop };
    if (!change || change.reset) {
      this.cache.clear();
      this.feedSignature = null;
      this.changedEntries = null;
    } else {
      this.changedEntries ??= /* @__PURE__ */ new Set();
      for (const id of change.changedIds) {
        this.cache.delete(id);
        this.changedEntries.add(id);
      }
      for (const slot of this.slots || []) if (this.changedEntries.has(slot.entry.id)) slot.invalidated = true;
    }
    if (!change || change.catalogChanged || change.reset) this.loadCatalog();
    else this.search();
  }
  onClose() {
    clearTimeout(this.searchFocusTimer);
    this.releaseReferenceFocus?.();
    this.releaseReferenceFocus = null;
    this.shortcutSlots?.release(this);
    for (const handler of this.shortcuts || []) this.scope.unregister(handler);
    this.shortcuts = [];
    if (this.reference) {
      this.reference.cancel?.();
      this.reference.closed = true;
    }
    this.closeResize?.();
    clearTimeout(this.indexRetryTimer);
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
    if (!this.plugin.production && !this.hoverPopover) fs.promises.writeFile(path.join(TEST_DATA_ROOT, "outputs", "ui-" + Date.now() + ".json"), JSON.stringify(data, null, 2)).catch(() => {
    });
    clearTimeout(this.persistTimer);
    if (!this.hoverPopover) this.plugin.persist().catch(() => {
    });
    this.filterBar?.close();
    this.cache.clear();
    this.contentEl.empty();
    this.plugin.browsers.delete(this);
    if (this.plugin.active === this) this.plugin.active = null;
    if (this.entryMode && !this.hostLeaf && !this.leavingEntry && this.returnFocus?.isConnected) {
      const target = this.returnFocus, doc = target.ownerDocument, leaf = this.returnLeaf;
      doc.defaultView.requestAnimationFrame(() => {
        if (!this.plugin.unloading && target.isConnected && this.app.workspace.activeLeaf === leaf && require_entry_layout().canRestoreFocus(target, this.returnAnchor, doc.activeElement) && ![...doc.querySelectorAll(".modal-container")].some((container) => container !== this.containerEl)) target.focus({ preventScroll: true });
      });
    }
  }
};
var LibraryView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.scope = new Scope(this.app.scope);
    this.shortcutSlots = new (require_shortcut_slots())(this.scope);
    this.navigation = true;
  }
  getViewType() {
    return "knowledge-library";
  }
  getDisplayText() {
    return this.browser?.entryMode ? this.browser.entryData?.title || "Reference" : "Index";
  }
  refreshTitle() {
    this.leaf.updateHeader?.();
    this.containerEl?.querySelector(".view-header-title")?.setText(this.getDisplayText());
  }
  getIcon() {
    return "library";
  }
  async onOpen() {
  }
  // setState chooses entry/search mode before any catalog request.
  async initialize(reviewed, state = {}) {
    this.contentEl.empty();
    this.contentEl.removeClass("kl-entry-pane", "kl-modal");
    this.contentEl.addClass("kl-pane");
    this.browser = new LibraryBrowser(this.plugin, reviewed, null, !state.entryId);
    this.browser.hostLeaf = this.leaf;
    this.browser.scope = this.scope;
    this.browser.shortcutSlots = this.shortcutSlots;
    this.browser.initialEntryId = state.entryId || null;
    this.browser.restoredState = state;
    this.browser.modalEl = this.contentEl;
    this.browser.titleEl = this.contentEl.createEl("h2");
    this.browser.contentEl = this.contentEl.createDiv({ cls: "kl-pane-content" });
    this.browser.close = () => this.leaf.detach();
    await this.browser.onOpen();
  }
  async setState(state, result) {
    await super.setState(state, result);
    const reviewed = this.plugin.production || state.reviewed !== false;
    if (result && this.browser && ((state.entryId || null) !== (this.browser.initialEntryId || null) || reviewed !== this.browser.reviewed)) result.history = true;
    if (!this.browser || reviewed !== this.browser.reviewed || (state.entryId || null) !== (this.browser.initialEntryId || null)) {
      this.browser?.onClose();
      await this.initialize(reviewed, state);
    } else if (this.browser.filterBar?.model) this.browser.filterBar.restore(state);
    else if (this.browser.input) {
      this.browser.restoredState = state;
      this.browser.input.value = state.query || "";
    }
    this.refreshTitle();
  }
  getState() {
    return { ...this.browser?.filterBar?.snapshot() || { query: "" }, reviewed: this.browser?.reviewed !== false, ...this.browser?.initialEntryId ? { entryId: this.browser.initialEntryId } : {} };
  }
  async onClose() {
    this.browser?.onClose();
    this.shortcutSlots.close();
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
    this.referenceLayoutReady = false;
    this.referenceStatus = this.addStatusBarItem();
    this.referenceStatus.hidden = true;
    this.registerDomEvent(window, "focus", () => {
      this.documentFeed?.references?.probe();
      this.referenceResolver?.poke();
    });
    this.runtimeRoot = path.join(this.app.vault.adapter.getBasePath(), this.manifest.dir, "backend");
    const stored = await this.loadData();
    this.settings = { profile: null, vaultIds: null, typeIds: null, scopeGroupId: null, groups: [], ...stored };
    this.settings.reviewed = { profile: null, vaultIds: null, typeIds: null, scopeGroupId: null, groups: [], ...this.settings.reviewed };
    this.settings.referenceFilters = { profile: null, vaultIds: null, typeIds: null, sourceIds: null, scopeGroupId: null, ...this.settings.referenceFilters };
    Object.defineProperty(this.settings.referenceFilters, "groups", { configurable: true, enumerable: false, get: () => this.settings.reviewed.groups, set: (value) => {
      this.settings.reviewed.groups = value;
    } });
    if (!Array.isArray(this.settings.groups)) this.settings.groups = [];
    this.production = this.app.vault.getName() !== "knowledge_library_lab";
    require_typing_latency().register(this, Notice, MarkdownView, path.join(TEST_DATA_ROOT, ".worktrees", "linked-references", "verification", "callout-components"));
    this.libraryRoot = this.settings.libraryRoot || path.join(require("os").homedir(), "Library", "Application Support", "Knowledge Library", "library");
    if (this.production && !this.settings.enrolled) {
      new Notice("Index is not enrolled for this vault.");
      return;
    }
    require_editor_claims().registerEditorClaims(this);
    registerTracking(this);
    this.referenceResolver = new (require_reference_resolver()).ReferenceResolver(async (op, args) => {
      await this.admission.ready;
      return this.admission.request(op, args);
    }, { onIssue: (message) => {
      this.referenceDisplayError = message;
      this.renderReferenceStatus();
    } });
    this.register(() => this.referenceResolver.close());
    require_reference_links().registerReferenceLinks(this);
    require_reference_display().registerReferenceDisplay(this);
    require_reference_reading().registerReadingReferences(this);
    require_reference_picker()(this, (editor, info) => {
      const { sessionFor } = require_component_reference_session();
      new LibraryBrowser(this, true, sessionFor(this, editor, info)).open();
    });
    require_reference_choice().registerReferenceChoice(this, (session) => {
      const browser = new LibraryBrowser(this, true, session, false);
      browser.open();
      return browser;
    });
    this.startService();
    require_callout_api().registerCalloutAPI(this);
    require_callout_controls().registerCalloutControls(this);
    require_component_identities().registerComponentIdentities(this);
    require_component_update_settings().registerComponentUpdateSettings(this);
    require_component_reference_writes().registerComponentReferenceWrites(this);
    await this.componentMembershipReady.catch(() => {
    });
    require_callout_component().registerCalloutComponent(this);
    require_component_actions().registerComponentActions(this);
    require_reference_label_writer().registerLabelWriter(this);
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      this.documentFeed?.changed(file);
      this.referenceResolver?.poke();
    }));
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.documentFeed?.wake()));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      this.documentFeed?.deleted(file);
      this.referenceResolver?.poke();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.documentFeed?.renamed(file, oldPath);
      this.referenceResolver?.poke();
    }));
    this.app.workspace.onLayoutReady(() => {
      this.referenceLayoutReady = true;
      this.documentFeed?.wake();
    });
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(file.path)) this.admission.schedule(file.path);
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => this.admission.schedule(file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.admission.schedule(file.path)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.admission.rename(file, oldPath)));
    this.registerView("knowledge-library", (leaf) => new LibraryView(leaf, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf?.view instanceof MarkdownView) this.lastEditor = leaf.view;
    }));
    this.registerInterval(setInterval(() => {
      if (this.browsers.size) this.refreshBrowsers();
    }, 3e3));
    this.addCommand({ id: "browse-tab", name: "Open index in new tab", callback: () => this.openPane(false) });
    this.addCommand({ id: "browse-window", name: "Search and insert from index", hotkeys: [{ modifiers: ["Mod"], key: "k" }], callback: () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view?.file && view.getMode() !== "preview") {
        const { sessionFor } = require_component_reference_session();
        new LibraryBrowser(this, true, sessionFor(this, view.editor, view)).open();
      } else this.openPane(true);
    } });
    this.addCommand({ id: "review-note", name: "Review current note for index", callback: () => this.admission.review() });
    this.addCommand({ id: "browse-reviewed", name: "Browse reviewed entries", callback: () => this.open(true) });
    this.addCommand({ id: "browse", name: "Browse index", hotkeys: [{ modifiers: ["Mod", "Shift"], key: "l" }], callback: () => this.open() });
    this.addCommand({ id: "actions", name: "Index actions", callback: () => {
      if (this.active) this.active.actions();
      else this.open();
    } });
    this.registerObsidianProtocolHandler("knowledge-library-lab", () => this.open());
    this.registerObsidianProtocolHandler("knowledge-library", (params) => params.entry ? this.openLibraryEntry(params.entry) : this.openPane(params.window === "true", params.query || ""));
    this.registerObsidianProtocolHandler("knowledge-library-source", async (params) => {
      try {
        await this.admission.ready;
        const located = await this.admission.request("live-locate", { id: params.entry });
        if (located.vaultRoot !== this.app.vault.adapter.getBasePath()) return;
        const file = this.app.vault.getAbstractFileByPath(located.path);
        if (!file) throw new Error("Source note unavailable.");
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.openFile(file, { state: { mode: located.mode === "snapshot" ? "preview" : "source" }, eState: { line: located.line - 1 } });
        if (located.mode !== "snapshot" && leaf.view.editor) revealSource(leaf.view.editor, located.line - 1, located.endLine);
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
  updateReferenceProgress(state) {
    this.lastReferenceProgress = state;
    this.referenceResolver?.poke(state.checking + state.refreshing + state.removing > 0);
    this.renderReferenceStatus();
  }
  renderReferenceStatus() {
    const state = this.lastReferenceProgress || { checking: 0, refreshing: 0, removing: 0, issues: 0 };
    const pending = state.checking + state.refreshing + state.removing;
    const label = pending ? `References: ${pending} pending` : state.reconciling ? "References: checking settings" : state.issues ? `References: ${state.issues} issues` : this.referenceDisplayError ? "References: update pending" : "";
    if (label !== this.referenceStatus.textContent) this.referenceStatus.setText(label);
    this.referenceStatus.hidden = !label;
    if (this.referenceDisplayError) this.referenceStatus.setAttribute("title", this.referenceDisplayError);
    else this.referenceStatus.removeAttribute("title");
  }
  startService() {
    this.documentFeed?.close();
    this.admission?.close();
    this.referenceResolver?.resetEditors();
    this.referenceResolver?.invalidate();
    this.admission = new AdmissionAdapter(this, new Client(this.app.vault.adapter.getBasePath(), this.production, this.production ? this.libraryRoot : null, this.runtimeRoot));
    this.admission.ready = this.admission.start();
    this.admission.ready.catch((e) => new Notice("Index service: " + e.message));
    this.calloutAPI?.serviceChanged();
    const adapter = this.admission;
    const excludedFolders = [...this.settings.referenceTemplateFolders || []];
    const coreFolder = this.app.internalPlugins?.getPluginById?.("templates")?.instance?.options?.folder;
    const templaterFolder = this.app.plugins?.plugins?.["templater-obsidian"]?.settings?.templates_folder;
    for (const folder of [coreFolder, templaterFolder]) if (typeof folder === "string" && folder.trim()) excludedFolders.push(folder.replace(/\/$/, ""));
    this.documentFeed = new DocumentFeed(this.app, async (op, args) => {
      await adapter.ready;
      const response = await adapter.request(op, args);
      this.referenceIndexError = null;
      if (op === "live-reference-refresh-note" && response.changed || op === "live-reference-index-remove" || op === "live-reference-policy-reconcile" && response.indexedPaths?.length) this.referenceLabelWriter?.kick();
      return response;
    }, { references: true, onReferenceProgress: (state) => this.updateReferenceProgress(state), excludedFolders, editorClaim: (path2) => this.editorClaim?.(path2), canInitialize: () => this.referenceLayoutReady, onError: (error) => {
      this.referenceIndexError = error.message;
    } });
    adapter.ready.then(() => {
      if (this.admission === adapter) this.documentFeed.wake();
    }).catch(() => {
    });
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
      if (this.active.reviewed === reviewed && this.active.input) {
        this.active.input.focus();
        return;
      }
      if (!this.active.hostLeaf) this.active.close();
    }
    new LibraryBrowser(this, reviewed).open();
  }
  openLibraryEntry(id, newTab = false, anchor = null) {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) {
      new Notice("Invalid library entry link.");
      return;
    }
    for (const browser2 of [...this.browsers]) if (browser2.hoverPopover && !browser2.persistent) browser2.close();
    if (this.admission?.client.dead) this.startService();
    if (newTab) return this.openPane(false, { entryId: id });
    const browser = new LibraryBrowser(this, true, null, false);
    browser.settings = { ...this.settings.reviewed, filters: { version: 2, state: { query: "", tokens: [], cursor: [0, 0], draft: null } } };
    browser.initialEntryId = id;
    browser.entryAnchor = anchor?.getBoundingClientRect();
    browser.returnAnchor = anchor;
    browser.returnLeaf = this.app.workspace.activeLeaf;
    const editorRoot = anchor?.closest(".cm-editor");
    const editor = editorRoot ? require("@codemirror/view").EditorView.findFromDOM(editorRoot) : null;
    browser.returnFocus = editor?.contentDOM || anchor?.ownerDocument.activeElement;
    browser.open();
  }
  createEntryHover(popover, reference) {
    const browser = new LibraryBrowser(this, true, null, false);
    browser.hoverPopover = popover;
    browser.initialEntryId = reference.entry;
    browser.modalEl = popover.hoverEl;
    browser.titleEl = popover.hoverEl.createEl("h2");
    browser.contentEl = popover.hoverEl.createDiv({ cls: "kl-entry-hover-content" });
    browser.close = () => popover.hide();
    browser.onOpen();
    return browser;
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
    if (this.refreshingBrowsers) {
      this.refreshAgain = true;
      return this.refreshingBrowsers;
    }
    const adapter = this.admission;
    this.refreshingBrowsers = (async () => {
      do {
        this.refreshAgain = false;
        const pathsVersion = adapter.pathsVersion;
        const status = await adapter.request("live-status", { since: this.lastSequence });
        if (adapter !== this.admission || adapter.closed) return;
        adapter.acceptStatus(status, pathsVersion);
        if (status.sequence !== this.lastSequence) for (const browser of this.browsers) browser.refreshReviewed(status);
        if (status.sequence !== this.lastSequence) this.referenceResolver?.invalidate();
        this.lastSequence = status.sequence;
        this.lastRefreshError = null;
      } while (this.refreshAgain);
    })().catch((error) => {
      if (this.lastRefreshError !== error.message) for (const browser of this.browsers) browser.status.setText("Index refresh pending: " + error.message);
      this.lastRefreshError = error.message;
    }).finally(() => {
      this.refreshingBrowsers = null;
    });
    return this.refreshingBrowsers;
  }
  onunload() {
    this.unloading = true;
    this.documentFeed?.close();
    for (const browser of [...this.browsers]) {
      if (browser.hostLeaf) browser.onClose();
      else browser.close();
    }
    this.admission?.close();
  }
};
