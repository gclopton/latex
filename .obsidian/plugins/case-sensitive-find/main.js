const {
  Decoration,
  MarkdownView,
  Notice,
  Plugin,
  RangeSetBuilder,
  TextComponent,
} = require("obsidian");

/* ---- CM6 module imports ---- */

let cmState = null;
let cmView = null;
try { cmState = require("@codemirror/state"); } catch (_e) {}
try { cmView = require("@codemirror/view"); } catch (_e) {}

const CmDecoration = Decoration || cmView?.Decoration || null;
const CmRangeSetBuilder = RangeSetBuilder || cmState?.RangeSetBuilder || null;
const CmViewPlugin = cmView?.ViewPlugin || null;

/* ---- decoration marks ---- */

const activeMatchMark = CmDecoration?.mark
  ? CmDecoration.mark({ class: "case-find-active-match" })
  : null;
const inactiveMatchMark = CmDecoration?.mark
  ? CmDecoration.mark({ class: "case-find-secondary-match" })
  : null;

/* ---- shared mutable state between CaseFindBar and ViewPlugin ---- */

const highlightState = { matches: [], activeIndex: -1 };

/* ---- ViewPlugin (same pattern as obsidian-keyword-highlighter) ---- */

let findHighlighterExt = null;
try {
  if (CmViewPlugin && CmDecoration && CmRangeSetBuilder && activeMatchMark && inactiveMatchMark) {
    class FindHighlighter {
      constructor(_view) {
        this.decorations = this.buildDecorations();
      }
      update(upd) {
        if (upd.docChanged || upd.viewportChanged) {
          this.decorations = this.buildDecorations();
        }
      }
      buildDecorations() {
        const { matches, activeIndex } = highlightState;
        if (!matches || matches.length === 0) return CmDecoration.none;
        const builder = new CmRangeSetBuilder();
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i];
          builder.add(m.from, m.to, i === activeIndex ? activeMatchMark : inactiveMatchMark);
        }
        return builder.finish();
      }
      destroy() {}
    }
    findHighlighterExt = CmViewPlugin.fromClass(FindHighlighter, {
      decorations: (v) => v.decorations,
    });
  }
} catch (_e) {
  findHighlighterExt = null;
}

/* ---- helpers ---- */

function toDisplayCount(index, total) {
  if (!total) return "0 / 0";
  return `${index + 1} / ${total}`;
}

function getEditorText(editor) {
  return editor ? editor.getValue() : "";
}

function posToOffset(editor, pos) {
  if (editor && typeof editor.posToOffset === "function") return editor.posToOffset(pos);
  let offset = 0;
  for (let line = 0; line < pos.line; line += 1) offset += editor.getLine(line).length + 1;
  return offset + pos.ch;
}

function offsetToPos(editor, offset) {
  if (editor && typeof editor.offsetToPos === "function") return editor.offsetToPos(offset);
  let remaining = offset;
  const lastLine = editor.lineCount() - 1;
  for (let line = 0; line <= lastLine; line += 1) {
    const text = editor.getLine(line);
    if (remaining <= text.length) return { line, ch: remaining };
    remaining -= text.length + 1;
  }
  return { line: lastLine, ch: editor.getLine(lastLine).length };
}

function getSelectionOffsets(editor) {
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  return { from: posToOffset(editor, from), to: posToOffset(editor, to) };
}

function findAllMatches(text, query, matchCase) {
  const source = String(text || "");
  const needle = String(query || "");
  if (!needle) return [];
  const haystack = matchCase ? source : source.toLocaleLowerCase();
  const searchNeedle = matchCase ? needle : needle.toLocaleLowerCase();
  const matches = [];
  let fromIndex = 0;
  while (fromIndex <= haystack.length - searchNeedle.length) {
    const found = haystack.indexOf(searchNeedle, fromIndex);
    if (found === -1) break;
    matches.push({ from: found, to: found + needle.length });
    fromIndex = found + Math.max(searchNeedle.length, 1);
  }
  return matches;
}

/* ---- force the ViewPlugin to rebuild decorations ---- */

function repaintHighlights(cmEditorView) {
  if (!cmEditorView || !findHighlighterExt) return;
  try {
    const pluginInstance = cmEditorView.plugin(findHighlighterExt);
    if (pluginInstance && typeof pluginInstance.buildDecorations === "function") {
      pluginInstance.decorations = pluginInstance.buildDecorations();
      cmEditorView.requestMeasure();
    }
  } catch (_e) { /* ignore */ }
}

/* ---- CaseFindBar ---- */

class CaseFindBar {
  constructor(plugin) {
    this.plugin = plugin;
    this.view = null;
    this.editor = null;
    this.matches = [];
    this.currentIndex = -1;
    this.query = "";
    this.matchCase = false;
    this.mode = "find";
    this.containerEl = null;
    this.inputComponent = null;
    this.replaceInputComponent = null;
    this.countEl = null;
    this.matchCaseButton = null;
    this.replaceRowEl = null;
    this.hasCommittedSelection = false;
    this.highlightRoots = [];
    this.lastCmView = null;
  }

  isOpen() {
    return Boolean(this.containerEl);
  }

  open(view, mode = "find") {
    if (!(view instanceof MarkdownView) || !view.editor) {
      new Notice("Open a Markdown note to search.");
      return;
    }
    if (this.view !== view) this.close();
    this.view = view;
    this.editor = view.editor;
    this.mode = mode === "replace" ? "replace" : "find";
    this.setHighlightScope(view);

    if (!this.containerEl) {
      this.build();
      this.view.contentEl.prepend(this.containerEl);
    }
    this.updateModeUi();

    const selection = this.editor.getSelection();
    if (selection && selection.indexOf("\n") === -1) {
      this.query = selection;
      this.inputComponent.setValue(selection);
    }
    this.refresh(true);
    window.setTimeout(() => {
      this.inputComponent.inputEl.focus();
      this.inputComponent.inputEl.select();
    }, 0);
  }

  close() {
    if (this.containerEl) {
      this.containerEl.detach();
      this.containerEl = null;
    }
    this.clearHighlights();
    this.clearHighlightScope();

    this.view = null;
    this.editor = null;
    this.matches = [];
    this.currentIndex = -1;
    this.query = "";
    this.mode = "find";
    this.inputComponent = null;
    this.replaceInputComponent = null;
    this.countEl = null;
    this.matchCaseButton = null;
    this.replaceRowEl = null;
    this.hasCommittedSelection = false;
    this.highlightRoots = [];
    this.lastCmView = null;
  }

  setHighlightScope(view) {
    this.clearHighlightScope();
    const roots = new Set();
    if (view?.containerEl) roots.add(view.containerEl);
    if (view?.contentEl) {
      roots.add(view.contentEl);
      view.contentEl
        .querySelectorAll(".markdown-source-view.mod-cm6, .cm-editor")
        .forEach((el) => roots.add(el));
    }
    this.highlightRoots = Array.from(roots);
    this.highlightRoots.forEach((el) => {
      el.addClass("case-find-active");
      el.style.setProperty("--text-selection", "rgba(255, 208, 0, 0.55)");
    });
  }

  clearHighlightScope() {
    this.highlightRoots.forEach((el) => {
      el.removeClass("case-find-active");
      el.style.removeProperty("--text-selection");
    });
    this.highlightRoots = [];
  }

  build() {
    const container = createDiv({ cls: "case-find-bar" });
    this.containerEl = container;
    const searchRow = container.createDiv({ cls: "case-find-row" });
    const inputWrapper = searchRow.createDiv({ cls: "case-find-input" });
    this.inputComponent = new TextComponent(inputWrapper);
    this.inputComponent.inputEl.placeholder = "Find in current note";
    this.inputComponent.onChange((value) => {
      this.query = value;
      this.refresh(true);
    });
    this.inputComponent.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.shiftKey ? this.previous() : this.next();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });

    this.countEl = searchRow.createDiv({ cls: "case-find-count", text: "0 / 0" });

    this.matchCaseButton = searchRow.createEl("button", {
      cls: "case-find-button", text: "Aa",
      attr: { type: "button", "aria-label": "Toggle match case" },
    });
    this.matchCaseButton.addEventListener("click", () => {
      this.matchCase = !this.matchCase;
      this.refresh(true);
    });

    searchRow.createEl("button", {
      cls: "case-find-button mod-icon", text: "\u2191",
      attr: { type: "button", "aria-label": "Previous match" },
    }).addEventListener("click", () => this.previous());

    searchRow.createEl("button", {
      cls: "case-find-button mod-icon", text: "\u2193",
      attr: { type: "button", "aria-label": "Next match" },
    }).addEventListener("click", () => this.next());

    searchRow.createEl("button", {
      cls: "case-find-button mod-icon", text: "\u00d7",
      attr: { type: "button", "aria-label": "Close find bar" },
    }).addEventListener("click", () => this.close());

    this.replaceRowEl = container.createDiv({ cls: "case-find-row case-find-row-replace" });
    const replaceWrapper = this.replaceRowEl.createDiv({ cls: "case-find-input" });
    this.replaceInputComponent = new TextComponent(replaceWrapper);
    this.replaceInputComponent.inputEl.placeholder = "Replace with";
    this.replaceInputComponent.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.shiftKey ? this.previous() : this.replaceCurrent();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });

    this.replaceRowEl.createEl("button", {
      cls: "case-find-button", text: "Replace",
      attr: { type: "button", "aria-label": "Replace current match" },
    }).addEventListener("click", () => this.replaceCurrent());

    this.replaceRowEl.createEl("button", {
      cls: "case-find-button", text: "Replace All",
      attr: { type: "button", "aria-label": "Replace all matches" },
    }).addEventListener("click", () => this.replaceAll());
  }

  updateModeUi() {
    if (!this.containerEl || !this.replaceRowEl) return;
    this.containerEl.toggleClass("mod-replace", this.mode === "replace");
    this.replaceRowEl.toggleClass("is-hidden", this.mode !== "replace");
  }

  refresh(fromQueryChange = false) {
    if (!this.editor || !this.inputComponent) return;
    this.query = this.inputComponent.getValue();
    this.matches = findAllMatches(getEditorText(this.editor), this.query, this.matchCase);
    this.matchCaseButton.toggleClass("is-active", this.matchCase);

    if (this.matches.length === 0) {
      this.currentIndex = -1;
      this.hasCommittedSelection = false;
      this.clearHighlights();
      this.countEl.setText("0 / 0");
      this.inputComponent.inputEl.parentElement.toggleClass("mod-no-match", Boolean(this.query));
      return;
    }
    this.inputComponent.inputEl.parentElement.removeClass("mod-no-match");
    if (fromQueryChange || this.currentIndex < 0 || this.currentIndex >= this.matches.length) {
      this.currentIndex = this.findNearestMatchIndex();
      this.hasCommittedSelection = false;
    }
    this.countEl.setText(toDisplayCount(this.currentIndex, this.matches.length));
    this.applyCurrentSelection(false, false);
  }

  applyCurrentSelection(focusEditor = false, scrollIntoView = false) {
    if (!this.editor || this.currentIndex < 0 || this.currentIndex >= this.matches.length) return;

    const cv = this.view?.editor?.cm;
    const match = this.matches[this.currentIndex];

    /* update shared state so the ViewPlugin can read it */
    highlightState.matches = this.matches;
    highlightState.activeIndex = this.currentIndex;

    if (cv && typeof cv.dispatch === "function") {
      /* set editor selection to active match */
      cv.dispatch({
        selection: { anchor: match.from, head: match.to },
        scrollIntoView,
      });
      if (focusEditor) cv.focus();
      this.lastCmView = cv;

      /* force ViewPlugin to rebuild decorations */
      repaintHighlights(cv);
    } else {
      const from = offsetToPos(this.editor, match.from);
      const to = offsetToPos(this.editor, match.to);
      this.editor.setSelection(from, to);
      if (focusEditor) this.editor.focus();
    }
  }

  clearHighlights() {
    highlightState.matches = [];
    highlightState.activeIndex = -1;
    const cv = this.view?.editor?.cm || this.lastCmView;
    if (cv) repaintHighlights(cv);
  }

  findNearestMatchIndex() {
    if (!this.editor || this.matches.length === 0) return -1;
    const sel = getSelectionOffsets(this.editor);
    const exact = this.matches.findIndex((m) => m.from === sel.from && m.to === sel.to);
    if (exact !== -1) return exact;
    const next = this.matches.findIndex((m) => m.from >= sel.to);
    return next !== -1 ? next : 0;
  }

  selectCurrentMatch() {
    if (!this.editor || this.currentIndex < 0 || this.currentIndex >= this.matches.length) return;
    this.applyCurrentSelection(true, true);
    this.countEl.setText(toDisplayCount(this.currentIndex, this.matches.length));
    this.hasCommittedSelection = true;
  }

  next() {
    if (this.matches.length === 0) { this.refresh(true); return; }
    if (!this.hasCommittedSelection) { this.selectCurrentMatch(); return; }
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    this.selectCurrentMatch();
  }

  previous() {
    if (this.matches.length === 0) { this.refresh(true); return; }
    if (!this.hasCommittedSelection) { this.selectCurrentMatch(); return; }
    this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    this.selectCurrentMatch();
  }

  replaceCurrent() {
    if (!this.editor || !this.replaceInputComponent) return;
    if (this.matches.length === 0) { this.refresh(true); return; }
    const index = this.currentIndex >= 0 ? this.currentIndex : this.findNearestMatchIndex();
    const match = this.matches[index];
    if (!match) { this.refresh(true); return; }
    const replacement = this.replaceInputComponent.getValue();
    const from = offsetToPos(this.editor, match.from);
    const to = offsetToPos(this.editor, match.to);
    this.editor.replaceRange(replacement, from, to);
    const nextOffset = match.from + replacement.length;
    const nextPos = offsetToPos(this.editor, nextOffset);
    this.editor.setSelection(nextPos, nextPos);
    this.refresh(true);
    if (this.matches.length > 0) this.selectCurrentMatch();
  }

  replaceAll() {
    if (!this.editor || !this.replaceInputComponent) return;
    if (this.matches.length === 0) { this.refresh(true); return; }
    const replacement = this.replaceInputComponent.getValue();
    const text = getEditorText(this.editor);
    const pieces = [];
    let cursor = 0;
    for (const match of this.matches) {
      pieces.push(text.slice(cursor, match.from));
      pieces.push(replacement);
      cursor = match.to;
    }
    pieces.push(text.slice(cursor));
    const replacedCount = this.matches.length;
    this.editor.setValue(pieces.join(""));
    this.refresh(true);
    new Notice(`Replaced ${replacedCount} match${replacedCount === 1 ? "" : "es"}.`);
  }
}

/* ---- Plugin ---- */

module.exports = class CaseSensitiveFindPlugin extends Plugin {
  async onload() {
    this.findBar = new CaseFindBar(this);
    this.originalOpenSearchCommand = null;
    this.originalOpenSearchReplaceCommand = null;
    this.originalExecuteCommandById = null;
    this.patchedShowSearchTargets = new Map();

    /* register the ViewPlugin — same pattern as obsidian-keyword-highlighter */
    try {
      if (findHighlighterExt) {
        this.registerEditorExtension(findHighlighterExt);
      }
    } catch (_e) {
      console.error("case-sensitive-find: registerEditorExtension failed", _e);
    }

    this.tryPatchShowSearchTargets();
    this.patchNativeOpenSearchCommand();
    this.patchNativeOpenSearchReplaceCommand();
    this.patchCommandExecution();
    this.registerHotkeyInterceptor();

    this.addCommand({
      id: "open-case-sensitive-find",
      name: "Open case-sensitive find",
      hotkeys: [{ modifiers: ["Mod"], key: "f" }],
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.editor) return false;
        if (!checking) this.findBar.open(view, "find");
        return true;
      },
    });

    this.addCommand({
      id: "open-case-sensitive-replace",
      name: "Open case-sensitive replace",
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "f" }],
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.editor) return false;
        if (!checking) this.findBar.open(view, "replace");
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (!(leaf?.view instanceof MarkdownView)) { this.findBar.close(); return; }
        this.tryPatchShowSearchTargets();
        if (this.findBar.isOpen()) this.findBar.open(leaf.view, this.findBar.mode);
      })
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (_editor, info) => {
        if (!this.findBar.isOpen()) return;
        if (info?.file?.path !== this.findBar.view?.file?.path) return;
        this.findBar.refresh(false);
      })
    );
  }

  patchNativeOpenSearchCommand() {
    const cmd = this.app?.commands?.commands?.["editor:open-search"];
    if (!cmd || typeof cmd.checkCallback !== "function") return;
    this.originalOpenSearchCommand = cmd.checkCallback;
    cmd.checkCallback = (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.editor) return this.originalOpenSearchCommand(checking);
      if (!checking) this.findBar.open(view, "find");
      return true;
    };
  }

  patchShowSearchTargets() {
    const patchTarget = (target, modeResolver) => {
      if (!target || typeof target.showSearch !== "function" || this.patchedShowSearchTargets.has(target)) return;
      const original = target.showSearch.bind(target);
      this.patchedShowSearchTargets.set(target, original);
      target.showSearch = (replaceMode) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.editor) { this.findBar.open(view, modeResolver(replaceMode)); return true; }
        return original(replaceMode);
      };
    };
    patchTarget(this.app?.workspace?.activeEditor, (r) => r ? "replace" : "find");
    patchTarget(this.app?.workspace?.activeLeaf?.view, (r) => r ? "replace" : "find");
  }

  tryPatchShowSearchTargets() { try { this.patchShowSearchTargets(); } catch (_e) {} }

  patchNativeOpenSearchReplaceCommand() {
    const cmd = this.app?.commands?.commands?.["editor:open-search-replace"];
    if (!cmd || typeof cmd.checkCallback !== "function") return;
    this.originalOpenSearchReplaceCommand = cmd.checkCallback;
    cmd.checkCallback = (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.editor) return this.originalOpenSearchReplaceCommand(checking);
      if (!checking) this.findBar.open(view, "replace");
      return true;
    };
  }

  patchCommandExecution() {
    const mgr = this.app?.commands;
    if (!mgr || typeof mgr.executeCommandById !== "function") return;
    this.originalExecuteCommandById = mgr.executeCommandById.bind(mgr);
    mgr.executeCommandById = (commandId, ...args) => {
      if (commandId === "editor:open-search" || commandId === "editor:open-search-replace") {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.editor) {
          this.findBar.open(view, commandId === "editor:open-search-replace" ? "replace" : "find");
          return true;
        }
      }
      return this.originalExecuteCommandById(commandId, ...args);
    };
  }

  registerHotkeyInterceptor() {
    this.registerDomEvent(document, "keydown", (event) => {
      if (!event || event.defaultPrevented) return;
      const key = String(event.key || "").toLowerCase();
      const isModF = (event.metaKey || event.ctrlKey) && !event.shiftKey && key === "f";
      const isModAltF = (event.metaKey || event.ctrlKey) && event.altKey && !event.shiftKey && key === "f";
      if (!isModF && !isModAltF) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest(".case-find-bar")) return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.editor) return;
      const contentEl = view.contentEl;
      const activeEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!((target && contentEl?.contains(target)) || (activeEl && contentEl?.contains(activeEl)))) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      this.findBar.open(view, isModAltF ? "replace" : "find");
    }, { capture: true });
  }

  onunload() {
    const cmds = this.app?.commands?.commands;
    if (cmds?.["editor:open-search"] && this.originalOpenSearchCommand) {
      cmds["editor:open-search"].checkCallback = this.originalOpenSearchCommand;
    }
    if (cmds?.["editor:open-search-replace"] && this.originalOpenSearchReplaceCommand) {
      cmds["editor:open-search-replace"].checkCallback = this.originalOpenSearchReplaceCommand;
    }
    const mgr = this.app?.commands;
    if (mgr && this.originalExecuteCommandById) mgr.executeCommandById = this.originalExecuteCommandById;
    for (const [target, original] of this.patchedShowSearchTargets.entries()) {
      if (!target) continue;
      try { target.showSearch = original; } catch (_e) {}
    }
    this.patchedShowSearchTargets.clear();
    this.findBar.close();
  }
};
