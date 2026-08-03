const { MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } = require("obsidian");
const { Decoration, EditorView, ViewPlugin, WidgetType } = require("@codemirror/view");
const { RangeSetBuilder } = require("@codemirror/state");

const SUPPORTED_COUNTS = [3, 4, 5, 6, 7, 8];
// Keep native Markdown --- rules untouched. This plugin only customizes:
// - +++ and longer plus separators
// - ---- and longer dash separators
const RULE_RE = /^\s*((?:-{4,})|(?:\+{3,}))\s*$/;
const DEFAULT_SETTINGS = {
  colors: {
    "3": "#f4f7fb",
    "4": "#ffd60a",
    "5": "#ff9f0a",
    "6": "#ff453a",
    "7": "#32d74b",
    "8": "#64d2ff",
  },
};

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function getRuleSpec(text) {
  const match = String(text || "").match(RULE_RE);
  if (!match) {
    return null;
  }

  const marker = match[1];
  return {
    marker,
    char: marker[0],
    count: marker.length,
  };
}

class HorizontalRuleWidget extends WidgetType {
  constructor(count, lineFrom) {
    super();
    this.count = count;
    this.lineFrom = lineFrom;
  }

  eq(other) {
    return other.count === this.count && other.lineFrom === this.lineFrom;
  }

  toDOM(view) {
    const wrapper = document.createElement("div");
    wrapper.className = [
      "colored-horizontal-rule-widget",
      `colored-horizontal-rule-widget-${this.count}`,
    ].join(" ");
    wrapper.dataset.dashCount = String(this.count);
    wrapper.setAttribute("aria-hidden", "true");

    wrapper.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({
        selection: { anchor: this.lineFrom },
        scrollIntoView: true,
      });
      view.focus();
    });

    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

function lineIsActive(view, line) {
  return view.state.selection.ranges.some((range) => range.from <= line.to && range.to >= line.from);
}

function buildEditorDecorations(view) {
  const builder = new RangeSetBuilder();

  for (const range of view.visibleRanges) {
    let line = view.state.doc.lineAt(range.from);

    while (true) {
      const spec = getRuleSpec(line.text);
      if (spec) {
        const { count, char } = spec;
        const useWidget = char === "-" && !lineIsActive(view, line);
        if (!useWidget) {
          const classes = [
            "colored-horizontal-rule-source",
            `colored-horizontal-rule-source-${char === "+" ? "plus" : "dash"}`,
            `colored-horizontal-rule-source-${count}`,
          ];

          builder.add(
            line.from,
            line.from,
            Decoration.line({
              attributes: {
                class: classes.join(" "),
                "data-dash-count": String(count),
                "data-rule-char": char,
              },
            })
          );

          if (line.from < line.to) {
            builder.add(
              line.from,
              line.to,
              Decoration.mark({
                class: [
                  "colored-horizontal-rule-source-text",
                  "colored-horizontal-rule-source-token",
                  `colored-horizontal-rule-source-token-${char === "+" ? "plus" : "dash"}`,
                  `colored-horizontal-rule-source-token-${count}`,
                ].join(" "),
              })
            );
          }
        } else {
          builder.add(
            line.from,
            line.to,
            Decoration.replace({
              block: true,
              widget: new HorizontalRuleWidget(count, line.from),
            })
          );
          builder.add(
            line.from,
            line.from,
            Decoration.line({
              attributes: {
                class: [
                  "colored-horizontal-rule-widget-line",
                  `colored-horizontal-rule-widget-line-${char === "+" ? "plus" : "dash"}`,
                  `colored-horizontal-rule-widget-line-${count}`,
                ].join(" "),
                "data-dash-count": String(count),
                "data-rule-char": char,
              },
            })
          );
        }
      }

      if (line.to >= range.to || line.number >= view.state.doc.lines) {
        break;
      }
      line = view.state.doc.line(line.number + 1);
    }
  }

  return builder.finish();
}

function createEditorExtension() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildEditorDecorations(view);
      }

      update(update) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.geometryChanged ||
          update.selectionSet ||
          update.focusChanged
        ) {
          this.decorations = buildEditorDecorations(update.view);
        }
      }
    },
    {
      decorations: (value) => value.decorations,
    }
  );
}

class ColoredHorizontalRulesSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Colored Horizontal Rules" });
    containerEl.createEl("p", {
      text:
        "`---` keeps the normal Obsidian rule. `+++` and longer custom separators can be colored independently in both the editor and rendered Markdown.",
    });

    for (const count of SUPPORTED_COUNTS) {
      const isThree = count === 3;
      new Setting(containerEl)
        .setName(isThree ? "3 pluses" : `${count} markers`)
        .setDesc(
          isThree
            ? "Color used when the source line is exactly 3 plus signs."
            : `Color used when the source line is exactly ${count} hyphens or plus signs.`
        )
        .addColorPicker((picker) => {
          picker.setValue(this.plugin.settings.colors[String(count)] || DEFAULT_SETTINGS.colors[String(count)]);
          picker.onChange(async (value) => {
            this.plugin.settings.colors[String(count)] = value;
            await this.plugin.saveSettings();
          });
        });
    }

    new Setting(containerEl)
      .setName("Reset defaults")
      .setDesc("Restore the default color palette for three through eight markers.")
      .addButton((button) => {
        button.setButtonText("Reset");
        button.onClick(async () => {
          this.plugin.settings = cloneDefaultSettings();
          await this.plugin.saveSettings();
          this.display();
        });
      });
  }
}

module.exports = class ColoredHorizontalRulesPlugin extends Plugin {
  async onload() {
    this.sourceCache = new Map();
    this.settings = Object.assign(cloneDefaultSettings(), await this.loadData());
    this.normalizeSettings();
    this.applyCssVariables();

    this.addSettingTab(new ColoredHorizontalRulesSettingTab(this.app, this));

    this.registerEvent(this.app.vault.on("modify", (file) => this.clearFileCache(file)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.clearFileCache(file)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.sourceCache.delete(oldPath);
      this.clearFileCache(file);
    }));

    this.registerMarkdownPostProcessor(async (el, ctx) => {
      await this.decorateHorizontalRules(el, ctx);
    });

    this.registerEditorExtension(createEditorExtension());
    this.addCommand({
      id: "debug-current-horizontal-rule",
      name: "Debug Current Horizontal Rule",
      callback: () => this.debugCurrentHorizontalRule(),
    });

    this.refreshMarkdownViews();
  }

  onunload() {
    this.refreshMarkdownViews();
  }

  normalizeSettings() {
    if (!this.settings || typeof this.settings !== "object") {
      this.settings = cloneDefaultSettings();
      return;
    }

    if (!this.settings.colors || typeof this.settings.colors !== "object") {
      this.settings.colors = {};
    }

    for (const count of SUPPORTED_COUNTS) {
      const key = String(count);
      if (!this.settings.colors[key]) {
        this.settings.colors[key] = DEFAULT_SETTINGS.colors[key];
      }
    }
  }

  async saveSettings() {
    this.normalizeSettings();
    await this.saveData(this.settings);
    this.applyCssVariables();
    this.refreshMarkdownViews();
  }

  applyCssVariables() {
    const style = document.body && document.body.style;
    if (!style) {
      return;
    }

    for (const count of SUPPORTED_COUNTS) {
      const key = String(count);
      style.setProperty(`--colored-horizontal-rule-${key}`, this.settings.colors[key]);
    }
  }

  clearFileCache(file) {
    if (file instanceof TFile) {
      this.sourceCache.delete(file.path);
    }
  }

  async getSourceLines(sourcePath) {
    if (!sourcePath) {
      return null;
    }
    if (this.sourceCache.has(sourcePath)) {
      return this.sourceCache.get(sourcePath);
    }

    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
      return null;
    }

    const lines = (await this.app.vault.cachedRead(file)).split(/\r?\n/);
    this.sourceCache.set(sourcePath, lines);
    return lines;
  }

  decorateParagraphRules(el) {
    const paragraphs = Array.from(el.querySelectorAll("p"));

    for (const paragraph of paragraphs) {
      const spec = getRuleSpec(paragraph.textContent);
      if (!spec || spec.char !== "+") {
        continue;
      }

      const replacement = document.createElement("div");
      replacement.className = [
        "colored-horizontal-rule",
        "colored-horizontal-rule-block",
        `colored-horizontal-rule-${spec.count}`,
      ].join(" ");
      replacement.dataset.dashCount = String(spec.count);
      replacement.dataset.ruleChar = spec.char;
      paragraph.replaceWith(replacement);
    }
  }

  async decorateHorizontalRules(el, ctx) {
    this.decorateParagraphRules(el);

    const rules = Array.from(el.querySelectorAll("hr"));
    if (!rules.length || typeof ctx.getSectionInfo !== "function") {
      return;
    }

    const info = ctx.getSectionInfo(el);
    if (!info) {
      return;
    }

    const lines = await this.getSourceLines(ctx.sourcePath);
    if (!lines) {
      return;
    }

    const lineStart = typeof info.lineStart === "number" ? info.lineStart : 0;
    const lineEnd = typeof info.lineEnd === "number" ? info.lineEnd : lineStart;
    const sectionLines = lines.slice(lineStart, Math.min(lines.length, lineEnd + 1));
    const dashCounts = [];

    for (const line of sectionLines) {
      const spec = getRuleSpec(line);
      if (spec && spec.char === "-") {
        dashCounts.push(spec.count);
      }
    }

    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      const count = dashCounts[index];
      if (!count) {
        continue;
      }

      rule.classList.add("colored-horizontal-rule");
      rule.dataset.dashCount = String(count);

      if (SUPPORTED_COUNTS.includes(count)) {
        rule.classList.add(`colored-horizontal-rule-${count}`);
      }
    }
  }

  debugCurrentHorizontalRule() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!(view instanceof MarkdownView) || !view.editor || !view.editor.cm) {
      new Notice("No active markdown editor found.");
      return;
    }

    const editorView = view.editor.cm;
    const cursor = view.editor.getCursor();
    const line = editorView.state.doc.line(cursor.line + 1);
    const lineText = String(line.text || "");

    const domInfo = editorView.domAtPos(line.from);
    const targetNode = domInfo && domInfo.node ? domInfo.node : null;
    const element =
      targetNode && targetNode.nodeType === Node.ELEMENT_NODE
        ? targetNode
        : targetNode && targetNode.parentElement
          ? targetNode.parentElement
          : null;
    const lineEl = element && typeof element.closest === "function" ? element.closest(".cm-line") : null;

    const payload = {
      cursor,
      lineNumber: cursor.line + 1,
      lineText,
      lineClasses: lineEl ? lineEl.className : null,
      lineHtml: lineEl ? lineEl.outerHTML : null,
      tokenClasses: lineEl
        ? Array.from(lineEl.querySelectorAll("[class]")).map((node) => node.className)
        : [],
    };

    console.group("Colored Horizontal Rules Debug");
    console.log(payload);
    console.groupEnd();

    new Notice("Horizontal rule debug info written to the devtools console.");
  }

  refreshMarkdownViews() {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const previewMode = leaf.view && leaf.view.previewMode;
      if (previewMode && typeof previewMode.rerender === "function") {
        previewMode.rerender(true);
      }
    }
  }
};
