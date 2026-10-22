var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.mjs
var main_exports = {};
__export(main_exports, {
  default: () => ExplorerIndicators
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/store.mjs
var VERSION = 1;
var DEFAULTS = [
  { id: "dirty", label: "OCR: dirty", color: "#e05252", group: "ocr", order: 0 },
  { id: "clean", label: "OCR: clean", color: "#409cff", group: "ocr", order: 1, hidden: true }
];
var clone = (value) => structuredClone(value);
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var validPath = (path2) => typeof path2 === "string" && path2.length > 0 && !path2.startsWith("/") && !path2.includes("\0") && path2.split("/").every((part) => part !== "" && part !== "." && part !== "..");
function color(value) {
  if (typeof value !== "string" || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) throw new Error("Use #RRGGBB or #RRGGBBAA.");
  return value.toLowerCase();
}
function definition(d) {
  if (!object(d) || typeof d.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(d.id) || typeof d.label !== "string" || !d.label.trim() || !Number.isFinite(d.order) || d.group !== void 0 && (typeof d.group !== "string" || !/^[a-z][a-z0-9-]*$/.test(d.group))) throw new Error("Invalid definition.");
  if (Object.keys(d).some((k) => !["id", "label", "color", "group", "order", "hidden"].includes(k))) throw new Error("Unknown definition field: " + d.id);
  if (d.hidden !== void 0 && typeof d.hidden !== "boolean") throw new Error("Invalid hidden flag");
  return { id: d.id, label: d.label.trim(), color: color(d.color), order: d.order, ...d.hidden === void 0 ? {} : { hidden: d.hidden }, ...d.group === void 0 ? {} : { group: d.group } };
}
var StatusStore = class {
  constructor(raw = null) {
    this.errors = [];
    this.listeners = /* @__PURE__ */ new Set();
    this.undoState = null;
    this.definitions = [];
    this.assignments = /* @__PURE__ */ new Map();
    this.pathIndex = /* @__PURE__ */ new Map();
    this.readOnly = false;
    if (raw == null) {
      this.definitions = clone(DEFAULTS);
      return;
    }
    if (!object(raw)) {
      this.errors.push("Invalid data object");
      this.readOnly = true;
      return;
    }
    if (Object.keys(raw).some((k) => !["version", "definitions", "assignments"].includes(k))) this.errors.push("Unknown data field");
    if (raw.version !== VERSION) this.errors.push("Unsupported data version");
    const seen = /* @__PURE__ */ new Set();
    if (!Array.isArray(raw.definitions)) this.errors.push("Invalid definitions");
    else for (const input of raw.definitions) {
      try {
        const d = definition(input);
        if (seen.has(d.id)) throw new Error("Duplicate definition");
        seen.add(d.id);
        this.definitions.push(d);
      } catch (e) {
        this.errors.push(e.message);
      }
    }
    if (!object(raw.assignments)) this.errors.push("Invalid assignments");
    else for (const [path2, ids] of Object.entries(raw.assignments)) {
      if (!validPath(path2) || !Array.isArray(ids) || ids.some((id) => !seen.has(id)) || new Set(ids).size !== ids.length) {
        this.errors.push("Invalid assignment: " + path2);
        continue;
      }
      const groups = ids.map((id) => this.definitions.find((d) => d.id === id).group).filter(Boolean);
      if (new Set(groups).size !== groups.length) {
        this.errors.push("Conflicting groups: " + path2);
        continue;
      }
      if (ids.length) this.writePath(path2, [...ids]);
    }
    this.readOnly = this.errors.length > 0;
  }
  writePath(path2, ids) {
    const had = this.assignments.has(path2), has = !!ids?.length;
    if (has) this.assignments.set(path2, ids);
    else this.assignments.delete(path2);
    if (had === has) return;
    const parts = path2.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const parent = parts.slice(0, i).join("/");
      if (has) {
        if (!this.pathIndex.has(parent)) this.pathIndex.set(parent, /* @__PURE__ */ new Set());
        this.pathIndex.get(parent).add(path2);
      } else {
        const set = this.pathIndex.get(parent);
        set?.delete(path2);
        if (!set?.size) this.pathIndex.delete(parent);
      }
    }
  }
  assertWritable() {
    if (this.readOnly) throw new Error("Data requires repair or a compatible plugin version; no changes allowed.");
  }
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        this.listenerErrors ??= [];
        this.listenerErrors.push(String(error));
        if (this.listenerErrors.length > 20) this.listenerErrors.shift();
      }
    }
  }
  getIndicators(path2) {
    const ids = this.assignments.get(path2) || [];
    return this.definitions.filter((d) => ids.includes(d.id)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((d) => d.id);
  }
  getVisibleIndicators(path2) {
    return this.getIndicators(path2).filter((id) => !this.definitions.find((d) => d.id === id)?.hidden);
  }
  snapshot() {
    return { version: VERSION, definitions: clone(this.definitions), assignments: Object.fromEntries([...this.assignments].map(([p, ids]) => [p, [...ids]])) };
  }
  serialize() {
    this.assertWritable();
    return this.snapshot();
  }
  transaction(change, undo = false, event = false) {
    if (!event) this.assertWritable();
    const journal = /* @__PURE__ */ new Map();
    const set = (path2, ids) => {
      const old = this.assignments.get(path2);
      if (!old && (!ids || !ids.length) || old && ids && old.length === ids.length && old.every((id) => ids.includes(id))) return;
      if (!journal.has(path2)) journal.set(path2, old);
      this.writePath(path2, ids);
    };
    try {
      change(set);
    } catch (error) {
      for (const [path2, ids] of journal) {
        this.writePath(path2, ids);
      }
      throw error;
    }
    if (!journal.size) return false;
    this.undoState = undo ? journal : null;
    if (event && this.readOnly) this.diverged = true;
    this.emit();
    return true;
  }
  assign(paths, id, { undo = false } = {}) {
    return this.transaction((set) => {
      const d = this.definitions.find((d2) => d2.id === id);
      if (!d) throw new Error("Unknown indicator");
      for (const path2 of paths) {
        if (!validPath(path2)) throw new Error("Invalid vault-relative path");
        const ids = (this.assignments.get(path2) || []).filter((other) => other !== id && (!d.group || this.definitions.find((def) => def.id === other).group !== d.group));
        set(path2, [...ids, id]);
      }
    }, undo);
  }
  clear(paths, id, { undo = false } = {}) {
    return this.transaction((set) => {
      for (const path2 of paths) {
        if (!validPath(path2)) throw new Error("Invalid vault-relative path");
        const ids = id === void 0 ? [] : (this.assignments.get(path2) || []).filter((x) => x !== id);
        set(path2, ids);
      }
    }, undo);
  }
  rename(oldPath, newPath) {
    return this.applyRenames([[oldPath, newPath]], { completeBatch: false });
  }
  applyRenames(pairs, { completeBatch = false } = {}) {
    for (const pair of pairs) if (!Array.isArray(pair) || pair.length !== 2 || pair.some((p) => typeof p !== "string")) throw new Error("Invalid rename event");
    const moves = [];
    const recent = /* @__PURE__ */ new Map();
    for (const [old, dest] of pairs) {
      if (old === dest) continue;
      let redundant = false, parent = old;
      if (completeBatch) while (parent.includes("/")) {
        parent = parent.slice(0, parent.lastIndexOf("/"));
        if (recent.get(parent) === dest.slice(0, dest.length - (old.length - parent.length)) && dest === recent.get(parent) + old.slice(parent.length)) {
          redundant = true;
          break;
        }
      }
      if (redundant) continue;
      moves.push([old, dest]);
      recent.set(old, dest);
    }
    const displaced = [], staleDescendants = [], movedDestinations = /* @__PURE__ */ new Set();
    const changed = this.transaction((set) => {
      for (const [old, dest] of moves) {
        const keys = [...this.pathIndex.get(old) || []];
        const targets = completeBatch ? [...this.pathIndex.get(dest) || []].filter((p) => !movedDestinations.has(p)) : keys.length && this.assignments.has(dest) ? [dest] : [];
        if (!completeBatch && !keys.length) {
          for (const p of this.pathIndex.get(dest) || []) if (!movedDestinations.has(p)) staleDescendants.push(p);
        }
        if (!keys.length && !targets.length) continue;
        const moving = keys.map((path2) => [dest + path2.slice(old.length), this.assignments.get(path2)]);
        for (const path2 of targets) {
          displaced.push({ path: path2, indicators: [...this.assignments.get(path2)] });
          set(path2, []);
        }
        if (!completeBatch) {
          for (const path2 of this.pathIndex.get(dest) || []) if (path2 !== dest) staleDescendants.push(path2);
        }
        for (const path2 of keys) set(path2, []);
        for (const [path2, ids] of moving) {
          if (this.assignments.has(path2)) displaced.push({ path: path2, indicators: [...this.assignments.get(path2)] });
          set(path2, ids);
          movedDestinations.add(path2);
        }
      }
    }, false, true);
    return { changed, displaced, staleDescendants };
  }
  delete(path2) {
    if (typeof path2 !== "string") throw new Error("Invalid delete event");
    const keys = [...this.pathIndex.get(path2) || []];
    if (!keys.length) return false;
    return this.transaction((set) => {
      for (const key of keys) set(key, []);
    }, false, true);
  }
  created(path2, layoutReady) {
    if (!layoutReady) return false;
    if (typeof path2 !== "string") throw new Error("Invalid create event");
    if (!this.assignments.has(path2)) return false;
    return this.transaction((set) => set(path2, []), false, true);
  }
  orphans(exists) {
    return [...this.assignments.keys()].filter((path2) => !exists(path2));
  }
  undo() {
    this.assertWritable();
    if (!this.undoState) return false;
    const journal = this.undoState;
    this.undoState = null;
    return this.transaction((set) => {
      for (const [path2, ids] of journal) set(path2, ids);
    });
  }
  putDefinition(input) {
    this.assertWritable();
    const d = definition(input), index = this.definitions.findIndex((x) => x.id === d.id);
    if (d.group) for (const [path2, ids] of this.assignments) {
      if (ids.includes(d.id) && ids.some((id) => id !== d.id && this.definitions.find((x) => x.id === id)?.group === d.group)) throw new Error("Group conflict at " + path2);
    }
    if (index >= 0 && JSON.stringify(this.definitions[index]) === JSON.stringify(d)) return false;
    if (index < 0) this.definitions.push(d);
    else this.definitions[index] = d;
    this.undoState = null;
    this.emit();
    return true;
  }
  removeDefinition(id, confirmedCount = 0) {
    this.assertWritable();
    const paths = [...this.assignments].filter(([, ids]) => ids.includes(id)).map(([path2]) => path2);
    if (paths.length !== confirmedCount) throw new Error("Confirm the current assignment count: " + paths.length);
    if (!this.definitions.some((d) => d.id === id)) return false;
    this.definitions = this.definitions.filter((d) => d.id !== id);
    for (const path2 of paths) {
      const ids = this.assignments.get(path2).filter((x) => x !== id);
      this.writePath(path2, ids);
    }
    this.undoState = null;
    this.emit();
    return true;
  }
};

// src/config.mjs
var defaults = { gitEnabled: true, gitBinary: "/opt/homebrew/bin/git" };
var object2 = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
function readConfig(raw, error) {
  const store = new StatusStore(raw?.status ?? (raw == null ? null : { version: -1 }));
  const valid = raw == null || object2(raw) && raw.schema === 1 && Object.keys(raw).every((k) => ["schema", "status", "settings"].includes(k)) && object2(raw.settings) && Object.keys(raw.settings).every((k) => k in defaults) && typeof raw.settings.gitEnabled === "boolean" && typeof raw.settings.gitBinary === "string";
  if (error || !valid) {
    store.readOnly = true;
    store.errors.push(error || "Unrecognized settings envelope; validated statuses retained.");
  }
  const settings = object2(raw?.settings) ? raw.settings : {};
  return { store, options: { gitEnabled: typeof settings.gitEnabled === "boolean" ? settings.gitEnabled : defaults.gitEnabled, gitBinary: typeof settings.gitBinary === "string" ? settings.gitBinary : defaults.gitBinary } };
}

// src/vault-events.mjs
var VaultEvents = class {
  constructor(store, { delay = 2e3, onDiagnostic = () => {
  } } = {}) {
    this.store = store;
    this.delay = delay;
    this.onDiagnostic = onDiagnostic;
    this.pendingDeletes = /* @__PURE__ */ new Map();
    this.replacements = /* @__PURE__ */ new Map();
    this.renames = [];
  }
  flushRenames() {
    if (!this.renames.length) return;
    const pairs = this.renames;
    this.renames = [];
    const result = this.store.applyRenames(pairs, { completeBatch: false });
    if (result.displaced.length) this.onDiagnostic(JSON.stringify(result));
  }
  ancestors(path2) {
    const parts = path2.split("/");
    return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  }
  cancelReplacement(path2) {
    let found = false;
    for (const p of this.ancestors(path2)) {
      if (this.pendingDeletes.has(p)) {
        clearTimeout(this.pendingDeletes.get(p));
        this.pendingDeletes.delete(p);
        clearTimeout(this.replacements.get(p));
        this.replacements.set(p, setTimeout(() => this.replacements.delete(p), this.delay));
        found = true;
      }
      if (this.replacements.has(p)) found = true;
    }
    return found;
  }
  rename(old, path2) {
    this.flushDeletesFor(old);
    this.cancelReplacement(path2);
    this.renames.push([old, path2]);
    if (this.renames.length === 1) queueMicrotask(() => this.flushRenames());
  }
  deleted(path2) {
    this.flushRenames();
    clearTimeout(this.pendingDeletes.get(path2));
    this.pendingDeletes.set(path2, setTimeout(() => {
      this.pendingDeletes.delete(path2);
      this.store.delete(path2);
    }, this.delay));
  }
  created(path2, ready) {
    this.flushRenames();
    if (this.cancelReplacement(path2)) return;
    this.store.created(path2, ready);
  }
  flushDeletesFor(path2) {
    if (this.pendingDeletes.has(path2)) {
      clearTimeout(this.pendingDeletes.get(path2));
      this.pendingDeletes.delete(path2);
      this.store.delete(path2);
    }
  }
  close() {
    this.flushRenames();
    for (const timer of [...this.pendingDeletes.values(), ...this.replacements.values()]) clearTimeout(timer);
    this.pendingDeletes.clear();
    this.replacements.clear();
  }
};

// src/save-queue.mjs
var SaveQueue = class {
  constructor({ snapshot, write, onError = () => {
  }, delay = 100, maxRetries = 3 }) {
    Object.assign(this, { snapshot, write, onError, delay, maxRetries });
    this.revision = 0;
    this.saved = 0;
    this.failures = 0;
    this.timer = null;
    this.running = null;
    this.closed = false;
  }
  mark() {
    if (this.closed) return;
    this.revision++;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delay);
  }
  async flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.running) return this.running;
    if (this.saved === this.revision) return true;
    this.running = Promise.resolve().then(async () => {
      while (this.saved !== this.revision) {
        const revision = this.revision;
        try {
          const payload = this.snapshot();
          await this.write(payload);
          this.saved = revision;
          this.failures = 0;
        } catch (error) {
          this.failures++;
          try {
            this.onError(error);
          } catch {
          }
          if (!this.closed && this.failures <= this.maxRetries) {
            this.timer = setTimeout(() => {
              this.timer = null;
              void this.flush();
            }, Math.min(1e3 * 2 ** (this.failures - 1), 4e3));
          }
          return false;
        }
      }
      return true;
    }).finally(() => {
      this.running = null;
    });
    return this.running;
  }
  get unsaved() {
    return this.saved !== this.revision;
  }
  close() {
    this.closed = true;
    clearTimeout(this.timer);
    this.timer = null;
    return this.flush();
  }
};

// src/git-provider.mjs
var import_node_child_process = require("node:child_process");
var import_promises = require("node:fs/promises");
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"), 1);
var decoder = new TextDecoder("utf-8", { fatal: true });
var canonical = (p) => p.normalize("NFC");
function ancestors(file) {
  const parts = file.replace(/\/$/, "").split("/"), result = [];
  for (let i = 1; i <= parts.length; i++) result.push(parts.slice(0, i).join("/"));
  return result;
}
function afterFields(text, count) {
  let pos = 0;
  for (let i = 0; i < count; i++) {
    pos = text.indexOf(" ", pos);
    if (pos < 0) throw Error("Malformed Git status record");
    pos++;
  }
  return text.slice(pos);
}
function parseStatus(buffer) {
  const records = decoder.decode(buffer).split("\0"), files = /* @__PURE__ */ new Set(), directories = /* @__PURE__ */ new Set(), branch = {};
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r) continue;
    if (r.startsWith("# ")) {
      const space = r.indexOf(" ", 2);
      if (space > 0) branch[r.slice(2, space)] = r.slice(space + 1);
      continue;
    }
    let name;
    if (r.startsWith("1 ")) name = afterFields(r, 8);
    else if (r.startsWith("2 ")) {
      name = afterFields(r, 9);
      const old = records[++i];
      if (!old) throw Error("Missing rename origin");
      files.add(canonical(old));
    } else if (r.startsWith("u ")) name = afterFields(r, 10);
    else if (r.startsWith("? ")) {
      name = r.slice(2);
      if (name.endsWith("/")) {
        directories.add(canonical(name.slice(0, -1)));
        continue;
      }
    } else if (r.startsWith("! ")) continue;
    else throw Error("Unknown Git status record");
    if (!name) throw Error("Empty Git path");
    files.add(canonical(name));
  }
  return { files, directories, branch };
}
function buildGitView(status, yellowPaths) {
  const green = /* @__PURE__ */ new Set(), yellow = /* @__PURE__ */ new Set();
  for (const p of [...status.files, ...status.directories]) for (const a of ancestors(p)) green.add(a);
  for (const p of yellowPaths) for (const a of ancestors(p)) yellow.add(canonical(a));
  return { green, yellow, directories: status.directories };
}
function indicatorAt(view, file) {
  const key = canonical(file);
  if (view.green.has(key) || ancestors(key).some((p) => view.directories.has(p))) return "git-uncommitted";
  return view.yellow.has(key) ? "git-unpushed" : null;
}
function viewDelta(before, after) {
  const changed = /* @__PURE__ */ new Set();
  for (const p of /* @__PURE__ */ new Set([...before.green, ...before.yellow, ...after.green, ...after.yellow])) if (indicatorAt(before, p) !== indicatorAt(after, p)) changed.add(p);
  const prefixChanges = new Set([...before.directories, ...after.directories].filter((p) => before.directories.has(p) !== after.directories.has(p)));
  return { changed, prefixChanges };
}
var empty = () => ({ green: /* @__PURE__ */ new Set(), yellow: /* @__PURE__ */ new Set(), directories: /* @__PURE__ */ new Set() });
var GitProvider = class {
  constructor({ root, git = "/opt/homebrew/bin/git", onChange = () => {
  }, onDiagnostic = () => {
  }, quiet = 1500, maxWait = 5e3, minInterval = 2e3 }) {
    Object.assign(this, { root, git, onChange, onDiagnostic, quiet, maxWait, minInterval });
    this.view = empty();
    this.generation = 0;
    this.lastStart = 0;
    this.disposed = false;
    this.running = null;
    this.child = null;
    this.timer = null;
    this.firstTrigger = 0;
    this.watchers = /* @__PURE__ */ new Map();
    this.cache = null;
    this.metrics = { scans: 0, processes: 0 };
  }
  async run(args) {
    if (this.disposed) throw Error("Disposed");
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (k.startsWith("GIT_")) delete env[k];
    Object.assign(env, { GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat", LC_ALL: "C" });
    this.metrics.processes++;
    return new Promise((resolve, reject) => {
      const child = (0, import_node_child_process.execFile)(this.git, ["--no-optional-locks", "-c", "color.ui=false", ...args], { cwd: this.root, env, encoding: "buffer", timeout: 15e3, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
        if (this.child === child) this.child = null;
        if (error) reject(Error((stderr || Buffer.alloc(0)).toString("utf8").trim() || error.message));
        else resolve(stdout);
      });
      this.child = child;
    });
  }
  async text(args) {
    return decoder.decode(await this.run(args)).trim();
  }
  async initialize() {
    await this.text(["--version"]);
    const root = await this.text(["rev-parse", "--show-toplevel"]);
    if (await (0, import_promises.realpath)(root) !== await (0, import_promises.realpath)(this.root)) throw Error("Vault is not the repository root");
    this.gitDir = import_node_path.default.resolve(this.root, await this.text(["rev-parse", "--git-dir"]));
    this.commonDir = import_node_path.default.resolve(this.root, await this.text(["rev-parse", "--git-common-dir"]));
    this.initialized = true;
  }
  trigger() {
    if (this.disposed) return;
    this.generation++;
    const now = Date.now();
    if (!this.firstTrigger) this.firstTrigger = now;
    clearTimeout(this.timer);
    const at = Math.max(this.lastStart + this.minInterval, Math.min(now + this.quiet, this.firstTrigger + this.maxWait));
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, Math.max(0, at - now));
  }
  async refresh() {
    if (this.disposed) return;
    if (this.running) {
      this.generation++;
      return this.running;
    }
    clearTimeout(this.timer);
    this.timer = null;
    this.firstTrigger = 0;
    const generation = this.generation;
    this.lastStart = Date.now();
    this.running = this.scan().finally(() => {
      this.running = null;
      if (!this.disposed && this.generation !== generation) this.trigger();
    });
    return this.running;
  }
  async scan() {
    this.metrics.scans++;
    try {
      if (!this.initialized) await this.initialize();
      const status = parseStatus(await this.run(["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all"]));
      const head = status.branch["branch.oid"];
      let target = null, targetName = null, yellow = [], unknown = null;
      if (status.branch["branch.head"] === "(detached)" || head === "(initial)") unknown = "Yellow unavailable: detached or unborn HEAD";
      else {
        for (const ref of ["@{push}", "@{upstream}"]) {
          if (ref === "@{upstream}") {
            const read = async (key) => {
              try {
                return await this.text(["config", "--get", key]);
              } catch {
                return null;
              }
            };
            const name = status.branch["branch.head"];
            const branchRemote = await read("branch." + name + ".remote");
            const pushRemote = await read("branch." + name + ".pushRemote") || await read("remote.pushDefault");
            if (pushRemote && pushRemote !== branchRemote) {
              unknown = "Yellow unavailable: push remote " + pushRemote + " differs from upstream " + branchRemote;
              break;
            }
          }
          try {
            target = await this.text(["rev-parse", "--verify", ref]);
            targetName = await this.text(["rev-parse", "--symbolic-full-name", ref]);
            break;
          } catch {
          }
        }
        if (!target) unknown ??= "Yellow unavailable: no configured push target or upstream";
        else {
          const key = head + " " + target;
          if (this.cache?.key === key) yellow = this.cache.paths;
          else {
            yellow = head === target ? [] : decoder.decode(await this.run(["diff", "--name-only", "-z", "--no-renames", target + "..." + head])).split("\0").filter(Boolean);
            this.cache = { key, paths: yellow };
          }
        }
      }
      if (this.disposed) return;
      this.failures = 0;
      const next = buildGitView(status, yellow), delta = viewDelta(this.view, next);
      this.view = next;
      this.diagnostic = { state: "ready", message: unknown || "Git status uses local remote-tracking refs; no fetch is performed.", branch: status.branch, target: targetName, greenPaths: status.files.size, yellowPaths: yellow.length };
      this.onDiagnostic(this.diagnostic);
      if (delta.changed.size || delta.prefixChanges.size) this.onChange(delta);
      await this.rewatch(status.branch["branch.head"], targetName);
    } catch (error) {
      if (this.disposed) return;
      this.failures = (this.failures || 0) + 1;
      this.diagnostic = { state: this.initialized && this.failures === 1 ? "stale" : "unavailable", message: String(error.message) };
      this.onDiagnostic(this.diagnostic);
      if (this.failures > 1) {
        const next = empty(), delta = viewDelta(this.view, next);
        this.view = next;
        if (delta.changed.size || delta.prefixChanges.size) this.onChange(delta);
      }
    }
  }
  async rewatch(branch, target) {
    const dirs = /* @__PURE__ */ new Set([this.gitDir, this.commonDir]);
    for (const ref of [branch && branch !== "(detached)" ? "refs/heads/" + branch : null, target]) if (ref) {
      let dir = import_node_path.default.dirname(import_node_path.default.join(this.commonDir, ref));
      while (dir.startsWith(this.commonDir)) {
        try {
          await (0, import_promises.access)(dir);
          dirs.add(dir);
          break;
        } catch {
          dir = import_node_path.default.dirname(dir);
        }
      }
    }
    if (this.disposed) return;
    for (const [dir, w] of this.watchers) if (!dirs.has(dir)) {
      w.close();
      this.watchers.delete(dir);
    }
    for (const dir of dirs) if (!this.watchers.has(dir)) {
      try {
        const w = (0, import_node_fs.watch)(dir, { persistent: false }, (_event, name) => {
          if (name?.toString().endsWith(".lock")) return;
          this.trigger();
        });
        w.on("error", () => {
          w.close();
          this.watchers.delete(dir);
        });
        this.watchers.set(dir, w);
      } catch {
      }
    }
  }
  getIndicator(file) {
    return indicatorAt(this.view, file);
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.child?.kill();
    for (const w of this.watchers.values()) w.close();
    this.watchers.clear();
  }
};

// src/explorer-adapter.mjs
var ROW = ".nav-file-title[data-path],.nav-folder-title[data-path]";
var LABEL = ".nav-file-title-content,.nav-folder-title-content";
var OWN = "gc-explorer-indicators";
var ExplorerAdapter = class {
  constructor(root, indicators) {
    this.root = root;
    this.indicators = indicators;
    this.win = root.ownerDocument.defaultView;
    this.rows = /* @__PURE__ */ new Map();
    this.paths = /* @__PURE__ */ new WeakMap();
    this.pending = /* @__PURE__ */ new Set();
    this.frame = null;
    this.closed = false;
    this.metrics = { reconciles: 0, writes: 0, frames: 0 };
    this.displacements = /* @__PURE__ */ new WeakMap();
    this.hover = (e) => {
      const row = e.target.closest?.(ROW);
      if (!row || !this.root.contains(row) || e.metaKey || e.ctrlKey) {
        this.hideTooltip();
        return;
      }
      if (this.hoverRow === row) return;
      this.hideTooltip();
      this.hoverRow = row;
      this.tooltipTimer = this.win.setTimeout(() => {
        const labels = this.indicators(row.dataset.path);
        if (!labels.length || !row.isConnected || this.editing(row.querySelector(LABEL))) return;
        const box = row.getBoundingClientRect(), tip = root.ownerDocument.createElement("div");
        tip.className = "gc-explorer-tooltip";
        tip.setAttribute("role", "tooltip");
        tip.textContent = labels.map((d) => d.label).join(" \xB7 ");
        tip.style.cssText = `position:fixed;left:${Math.max(8, Math.min(box.left, this.win.innerWidth - 330))}px;top:${Math.max(8, Math.min(box.bottom + 6, this.win.innerHeight - 90))}px;`;
        root.ownerDocument.body.append(tip);
        this.tooltip = tip;
      }, 500);
    };
    this.leave = (e) => {
      if (!root.contains(e.relatedTarget)) this.hideTooltip();
    };
    this.cancel = () => this.hideTooltip();
    root.addEventListener("mouseover", this.hover);
    root.addEventListener("mouseup", this.hover);
    root.addEventListener("mouseout", this.leave);
    root.addEventListener("mousedown", this.cancel);
    root.addEventListener("dragstart", this.cancel);
    this.win.addEventListener("keydown", this.cancel);
    this.observer = new this.win.MutationObserver((records) => this.mutations(records));
    this.observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-path", "contenteditable", "class"] });
    this.discover(root);
  }
  hideTooltip() {
    this.win.clearTimeout(this.tooltipTimer);
    this.tooltip?.remove();
    this.tooltip = null;
    this.hoverRow = null;
  }
  discover(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(ROW)) this.register(node);
    for (const row of node.querySelectorAll(ROW)) this.register(row);
  }
  register(row) {
    const path2 = row.getAttribute("data-path"), old = this.paths.get(row);
    if (old !== path2) {
      this.unregister(row);
      if (!this.rows.has(path2)) this.rows.set(path2, /* @__PURE__ */ new Set());
      this.rows.get(path2).add(row);
      this.paths.set(row, path2);
    }
    this.schedule(row);
  }
  unregister(row) {
    const old = this.paths.get(row);
    if (old !== void 0) {
      const set = this.rows.get(old);
      set?.delete(row);
      if (!set?.size) this.rows.delete(old);
      this.paths.delete(row);
    }
    this.pending.delete(row);
  }
  owned(node) {
    return node.nodeType === 1 && (node.classList.contains(OWN) || !!node.closest("." + OWN));
  }
  mutations(records) {
    for (const r of records) {
      if (this.owned(r.target)) continue;
      if (r.type === "childList") {
        const nodes = [...r.addedNodes, ...r.removedNodes];
        if (nodes.length && nodes.every((n) => this.owned(n))) continue;
        for (const n of r.removedNodes) if (n.nodeType === 1) {
          if (this.paths.has(n) && !this.root.contains(n)) this.unregister(n);
          for (const row2 of n.querySelectorAll(ROW)) if (!this.root.contains(row2)) this.unregister(row2);
        }
        for (const n of r.addedNodes) this.discover(n);
      }
      const row = r.target.nodeType === 1 ? r.target.closest(ROW) : r.target.parentElement?.closest(ROW);
      if (!row || !this.root.contains(row)) continue;
      if (r.type === "attributes" && r.attributeName === "class" && r.target === row) continue;
      if (r.attributeName === "data-path") this.register(row);
      else this.schedule(row);
      const label = row.querySelector(LABEL);
      if (this.editing(label)) this.remove(label);
    }
  }
  editing(label) {
    return !!label && (label.isContentEditable || label.getAttribute("contenteditable") === "true" || label.closest('[contenteditable="true"]'));
  }
  schedule(row) {
    if (this.closed) return;
    this.pending.add(row);
    if (this.frame === null) this.frame = this.win.requestAnimationFrame(() => {
      this.frame = null;
      this.metrics.frames++;
      const rows = [...this.pending];
      this.pending.clear();
      for (const row2 of rows) this.reconcile(row2);
    });
  }
  update(delta) {
    for (const [path2, rows] of this.rows) {
      const key = path2.normalize("NFC");
      if (!delta || delta.changed.has(key) || [...delta.prefixChanges].some((p) => key === p || key.startsWith(p + "/"))) for (const row of rows) this.schedule(row);
    }
  }
  remove(label) {
    const span = label?.querySelector(":scope > ." + OWN);
    if (span) {
      span.remove();
      this.metrics.writes++;
    }
  }
  reconcile(row) {
    if (!this.root.contains(row)) {
      this.unregister(row);
      return;
    }
    this.metrics.reconciles++;
    const label = row.querySelector(LABEL);
    if (!label) return;
    if (this.editing(label)) {
      this.remove(label);
      return;
    }
    const dots = this.indicators(row.getAttribute("data-path"));
    let span = label.querySelector(":scope > ." + OWN);
    if (!dots.length) {
      this.remove(label);
      return;
    }
    const signature = JSON.stringify(dots);
    if (span?.dataset.signature === signature) {
      if (label.firstChild === span) return;
      const count = (this.displacements.get(row) || 0) + 1;
      this.displacements.set(row, count);
      if (count > 3) {
        this.metrics.positionConflicts = (this.metrics.positionConflicts || 0) + 1;
        return;
      }
    }
    if (!span) {
      span = label.ownerDocument.createElement("span");
      span.className = OWN;
      span.setAttribute("role", "img");
      span.setAttribute("contenteditable", "false");
    }
    span.replaceChildren();
    span.dataset.signature = signature;
    span.setAttribute("aria-label", dots.map((d) => d.label).join("; "));
    span.setAttribute("title", dots.map((d) => d.label).join("; "));
    for (const d of dots) {
      const dot = label.ownerDocument.createElement("span");
      dot.className = "gc-explorer-indicator";
      dot.style.backgroundColor = d.color;
      dot.setAttribute("aria-hidden", "true");
      span.append(dot);
    }
    label.insertBefore(span, label.firstChild);
    this.metrics.writes++;
  }
  dispose() {
    this.closed = true;
    this.hideTooltip();
    this.root.removeEventListener("mouseover", this.hover);
    this.root.removeEventListener("mouseup", this.hover);
    this.root.removeEventListener("mouseout", this.leave);
    this.root.removeEventListener("mousedown", this.cancel);
    this.root.removeEventListener("dragstart", this.cancel);
    this.win.removeEventListener("keydown", this.cancel);
    this.observer.disconnect();
    if (this.frame !== null) this.win.cancelAnimationFrame(this.frame);
    for (const span of this.root.querySelectorAll("." + OWN)) span.remove();
    this.rows.clear();
    this.pending.clear();
  }
};

// src/main.mjs
var ExplorerIndicators = class extends import_obsidian.Plugin {
  async onload() {
    this.adapters = /* @__PURE__ */ new Map();
    this.diagnostics = [];
    this.ready = false;
    this.renames = [];
    this.ending = false;
    let raw;
    try {
      raw = await this.loadData();
    } catch (error) {
      this.loadError = String(error);
    }
    const config = readConfig(raw, this.loadError);
    this.store = config.store;
    this.options = config.options;
    this.events = new VaultEvents(this.store, { onDiagnostic: (m) => this.record("Move diagnostic: " + m) });
    this.saver = new SaveQueue({ snapshot: () => ({ schema: 1, status: this.store.serialize(), settings: { ...this.options } }), write: async (data) => {
      this.lastWritten = JSON.stringify(data);
      await this.saveData(data);
    }, onError: (e) => {
      this.record("Save failed: " + e.message);
      new import_obsidian.Notice("Explorer Indicators: status could not be saved. See settings.");
    } });
    this.bindStore();
    this.addSettingTab(new IndicatorSettings(this.app, this));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => this.menu(menu, [file])));
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => this.menu(menu, files)));
    this.addCommand({ id: "mark-active-dirty", name: "Mark active note OCR dirty", callback: () => this.active("dirty") });
    this.addCommand({ id: "mark-active-clean", name: "Mark active note OCR clean (no dot)", callback: () => this.active("clean") });
    this.addCommand({ id: "undo-status", name: "Undo last bulk status change", callback: () => this.safe(() => this.store.undo()) });
    this.addCommand({ id: "refresh-git", name: "Refresh automatic Git status", callback: () => this.git?.trigger() });
    const vault = this.app.vault;
    this.registerEvent(vault.on("rename", (file, old) => {
      this.events.rename(old, file.path);
      this.git?.trigger();
    }));
    this.registerEvent(vault.on("delete", (file) => {
      this.safe(() => this.events.deleted(file.path));
      this.git?.trigger();
    }));
    this.registerEvent(vault.on("create", (file) => {
      this.safe(() => this.events.created(file.path, this.ready));
      if (this.ready) this.git?.trigger();
    }));
    this.registerEvent(vault.on("modify", () => {
      if (this.ready) this.git?.trigger();
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncLeaves()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncLeaves()));
    this.app.workspace.onLayoutReady(() => {
      if (this.ending) return;
      this.ready = true;
      this.syncLeaves();
      this.startGit();
    });
    if (this.store.readOnly) new import_obsidian.Notice("Explorer Indicators loaded read-only to protect unrecognized or unreadable saved data. See settings.");
  }
  bindStore() {
    this.unbindStore?.();
    this.unbindStore = this.store.onChange(() => {
      for (const a of this.adapters.values()) a.update();
      if (!this.store.readOnly) this.saver.mark();
    });
  }
  async preserveConflict(raw) {
    this.store.readOnly = true;
    this.events.flushRenames();
    const folder = this.manifest?.dir || `${this.app.vault.configDir || ".obsidian"}/plugins/gc-explorer-indicators`;
    const stamp = Date.now() + "-" + Math.random().toString(16).slice(2, 8);
    const file = folder + "/data.conflict-" + stamp + ".json";
    try {
      const payload = { schema: 1, status: this.store.snapshot(), settings: { ...this.options } };
      await this.app.vault.adapter.write(file, JSON.stringify(payload, null, 2));
      await this.app.vault.adapter.write(folder + "/data.external-" + stamp + ".json", JSON.stringify(raw, null, 2));
      this.record("External settings conflict. Local edits saved to " + file + "; external version also preserved. Reload after resolving.");
      new import_obsidian.Notice("Explorer Indicators: conflicting settings preserved in " + file);
    } catch (e) {
      this.record("Conflict backup failed: " + e.message + ". Keep this vault open to retain local edits.");
      new import_obsidian.Notice("Explorer Indicators: conflict backup failed. Keep vault open; see settings.");
    }
  }
  async onExternalSettingsChange() {
    try {
      const raw = await this.loadData();
      if (this.ending || JSON.stringify(raw) === this.lastWritten) return;
      if (this.saver.unsaved || this.saver.running || this.events.renames.length || this.events.pendingDeletes.size) {
        await this.preserveConflict(raw);
        return;
      }
      this.events.close();
      const config = readConfig(raw);
      this.store = config.store;
      this.options = config.options;
      this.events = new VaultEvents(this.store, { onDiagnostic: (m) => this.record(m) });
      this.bindStore();
      this.startGit();
      for (const a of this.adapters.values()) a.update();
    } catch (e) {
      this.store.readOnly = true;
      this.record("External settings read failed: " + e.message);
    }
  }
  record(message) {
    this.diagnostics.push((/* @__PURE__ */ new Date()).toISOString() + " " + message);
    if (this.diagnostics.length > 20) this.diagnostics.shift();
  }
  safe(action) {
    try {
      return action();
    } catch (e) {
      this.record(e.message);
      new import_obsidian.Notice("Explorer Indicators: " + e.message);
    }
  }
  active(id) {
    const file = this.app.workspace.getActiveFile();
    if (file) this.safe(() => this.store.assign([file.path], id));
  }
  indicators(path2) {
    const dots = this.store.getVisibleIndicators(path2).map((id) => this.store.definitions.find((d) => d.id === id)).map((d) => ({ label: d.label, color: d.color }));
    const git = this.git?.getIndicator(path2);
    if (git) dots.push({ label: (git === "git-uncommitted" ? "Git: uncommitted changes" : "Git: committed changes not pushed") + (this.git.diagnostic?.state === "stale" ? " (last scan stale)" : "") + ". Local tracking refs; no fetch.", color: git === "git-uncommitted" ? "#42c978" : "#f1c84a" });
    return dots;
  }
  syncLeaves() {
    if (!this.ready || this.ending) return;
    const live = /* @__PURE__ */ new Set();
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const root = leaf.view.containerEl.querySelector(".nav-files-container");
      if (!root) continue;
      live.add(root);
      const old = this.adapters.get(root);
      if (old && old.win !== root.ownerDocument.defaultView) {
        old.removeFocus();
        old.dispose();
        this.adapters.delete(root);
      }
      if (!this.adapters.has(root)) {
        const adapter = new ExplorerAdapter(root, (path2) => this.indicators(path2));
        this.adapters.set(root, adapter);
        const win = root.ownerDocument.defaultView;
        const focus = () => this.git?.trigger();
        win.addEventListener("focus", focus);
        adapter.removeFocus = () => win.removeEventListener("focus", focus);
      }
    }
    for (const [root, adapter] of this.adapters) if (!live.has(root)) {
      adapter.removeFocus();
      adapter.dispose();
      this.adapters.delete(root);
    }
  }
  startGit() {
    this.git?.dispose();
    this.git = null;
    for (const a of this.adapters.values()) a.update();
    if (!this.options.gitEnabled) return;
    const root = this.app.vault.adapter.getBasePath?.();
    if (!root) {
      this.record("Automatic Git requires a local filesystem vault.");
      return;
    }
    this.git = new GitProvider({ root, git: this.options.gitBinary, onChange: (delta) => {
      for (const a of this.adapters.values()) a.update(delta);
    }, onDiagnostic: (d) => {
      if (this.lastGitState !== d.state) {
        this.lastGitState = d.state;
        for (const a of this.adapters.values()) a.update();
      }
    } });
    void this.git.refresh();
  }
  menu(menu, files) {
    if (!files.length) return;
    for (const d of this.store.definitions) menu.addItem((item) => item.setTitle("Indicator: " + d.label + (d.hidden ? " (no dot)" : "")).setIcon("circle").setDisabled(this.store.readOnly).onClick(() => {
      if (files.length === 1) this.safe(() => this.store.assign([files[0].path], d.id));
      else new BulkModal(this, files, d.id).open();
    }));
    menu.addItem((item) => item.setTitle("Clear manual indicators").setIcon("circle-off").setDisabled(this.store.readOnly).onClick(() => {
      if (files.length === 1) this.safe(() => this.store.clear([files[0].path]));
      else new BulkModal(this, files, null).open();
    }));
    if (files.some((f) => f instanceof import_obsidian.TFolder)) menu.addItem((item) => item.setTitle("Bulk chapter/file indicators\u2026").setIcon("list-checks").setDisabled(this.store.readOnly).onClick(() => new BulkModal(this, files, "dirty").open()));
  }
  onunload() {
    this.events.close();
    this.ending = true;
    this.unbindStore?.();
    this.git?.dispose();
    for (const a of this.adapters.values()) {
      a.removeFocus();
      a.dispose();
    }
    this.adapters.clear();
    void this.saver.close();
  }
};
var BulkModal = class extends import_obsidian.Modal {
  constructor(plugin, files, id) {
    super(plugin.app);
    this.plugin = plugin;
    this.files = files;
    this.id = id;
    this.recursive = files.every((f) => f instanceof import_obsidian.TFolder);
    this.includeFolders = false;
    this.otherFiles = false;
  }
  paths() {
    const result = /* @__PURE__ */ new Set();
    const visit = (f) => {
      if (f instanceof import_obsidian.TFolder) {
        if (this.includeFolders) result.add(f.path);
        if (this.recursive) for (const child of f.children) visit(child);
      } else if (this.otherFiles || f.extension === "md") result.add(f.path);
    };
    for (const f of this.files) visit(f);
    return [...result];
  }
  onOpen() {
    this.draw();
  }
  draw() {
    const e = this.contentEl;
    e.empty();
    e.createEl("h2", { text: "Preview manual indicator change" });
    new import_obsidian.Setting(e).setName("Indicator").addDropdown((d) => {
      d.addOption("", "Clear manual indicators");
      for (const def of this.plugin.store.definitions) d.addOption(def.id, def.label);
      d.setValue(this.id || "").onChange((v) => {
        this.id = v || null;
        this.draw();
      });
    });
    for (const [key, label] of [["recursive", "Include descendants"], ["includeFolders", "Include folders"], ["otherFiles", "Include non-Markdown files"]]) new import_obsidian.Setting(e).setName(label).addToggle((t) => t.setValue(this[key]).onChange((v) => {
      this[key] = v;
      this.draw();
    }));
    const paths = this.paths();
    e.createEl("p", { text: `${paths.length} explicit paths will change. This does not create inherited status. Git indicators are automatic and unaffected.` });
    e.createEl("pre", { text: paths.slice(0, 20).join("\n") + (paths.length > 20 ? "\n\u2026" : "") });
    new import_obsidian.Setting(e).addButton((b) => b.setButtonText("Apply to " + paths.length + " paths").setCta().setDisabled(!paths.length).onClick(() => {
      this.plugin.safe(() => this.id ? this.plugin.store.assign(paths, this.id, { undo: true }) : this.plugin.store.clear(paths, void 0, { undo: true }));
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var IndicatorSettings = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const p = this.plugin, e = this.containerEl;
    e.empty();
    e.createEl("h2", { text: "Explorer Indicators" });
    e.createEl("p", { text: "Red means OCR dirty. Clean has no dot; absence of a dot is not proof of review. Green and yellow come automatically from Git. If both Git states affect a row, green takes precedence. Names and search are unchanged. Status assignments stay local to this vault configuration." });
    if (p.store.readOnly) e.createEl("p", { text: "READ ONLY: " + [p.loadError, ...p.store.errors].filter(Boolean).join("; ") });
    new import_obsidian.Setting(e).setName("Automatic Git indicators").addToggle((t) => t.setValue(p.options.gitEnabled).setDisabled(p.store.readOnly).onChange((v) => {
      p.options.gitEnabled = v;
      p.saver.mark();
      p.startGit();
    }));
    let binary = p.options.gitBinary;
    new import_obsidian.Setting(e).setName("Git executable").setDesc("Explicit absolute executable path. No fetch, commit or push is performed.").addText((t) => t.setValue(binary).onChange((v) => binary = v)).addButton((b) => b.setButtonText("Apply").setDisabled(p.store.readOnly).onClick(() => {
      if (!binary.startsWith("/")) {
        new import_obsidian.Notice("Enter an absolute Git executable path.");
        return;
      }
      p.options.gitBinary = binary;
      p.saver.mark();
      p.startGit();
      this.display();
    }));
    e.createEl("p", { text: "Git: " + (p.git?.diagnostic?.message || "disabled or initializing") });
    new import_obsidian.Setting(e).setName("Refresh diagnostics").addButton((b) => b.setButtonText("Refresh").onClick(() => this.display()));
    for (const def of p.store.definitions) {
      let label2 = def.label, hex2 = def.color;
      new import_obsidian.Setting(e).setName(def.id + (def.hidden ? " (hidden)" : "")).addText((t) => t.setValue(label2).onChange((v) => label2 = v)).addText((t) => t.setValue(hex2).onChange((v) => hex2 = v)).addButton((b) => b.setButtonText("Save").setDisabled(p.store.readOnly).onClick(() => p.safe(() => {
        p.store.putDefinition({ ...def, label: label2, color: hex2 });
        this.display();
      })));
    }
    let id = "", label = "", hex = "#a78bfa";
    new import_obsidian.Setting(e).setName("Add custom indicator").setDesc("Lowercase ID, label, and hex color. Custom indicators can coexist.").addText((t) => t.setPlaceholder("custom-id").onChange((v) => id = v)).addText((t) => t.setPlaceholder("Label").onChange((v) => label = v)).addText((t) => t.setValue(hex).onChange((v) => hex = v)).addButton((b) => b.setButtonText("Add").setDisabled(p.store.readOnly).onClick(() => p.safe(() => {
      if (p.store.definitions.some((d) => d.id === id)) throw Error("That ID already exists");
      p.store.putDefinition({ id, label, color: hex, order: p.store.definitions.length });
      this.display();
    })));
    const orphans = p.store.orphans((path2) => !!p.app.vault.getAbstractFileByPath(path2));
    e.createEl("p", { text: `${p.store.assignments.size} assigned paths; ${orphans.length} missing paths (retained for inspection). ${p.saver.unsaved ? "Unsaved changes pending." : ""}` });
    if (orphans.length) e.createEl("pre", { text: orphans.slice(0, 30).join("\n") });
    if (p.diagnostics.length) e.createEl("pre", { text: p.diagnostics.join("\n") });
    e.createEl("p", { text: `Git scans: ${p.git?.metrics.scans || 0}. Git processes: ${p.git?.metrics.processes || 0}. Mounted explorer rows: ${[...p.adapters.values()].reduce((n, a) => n + [...a.rows.values()].reduce((x, s) => x + s.size, 0), 0)}.` });
  }
};
