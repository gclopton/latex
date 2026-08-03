const {
  addIcon,
  finishRenderMath,
  ItemView,
  loadMathJax,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  renderMath,
  Setting,
  debounce,
} = require("obsidian");

const VIEW_TYPE = "callout-outline-view";
const ICON_NAME = "callout-outline";
const HEADER_RE = /^(\s*)((?:>\s*)+)\[!([^\]\s]+)\]([+-])?(?:\s+(.*?))?\s*$/;
const QUOTE_RE = /^(\s*)((?:>\s*)+)(.*)$/;
const FENCE_RE = /^(```+|~~~+)/;
const OVERRIDE_RE = /^%%\s*callout-outline\s*:\s*(.*?)\s*%%$/i;

const DEFAULT_SETTINGS = {
  inheritCalloutManagerColors: true,
  colorOverrides: {},
  decorateRenderedCallouts: true,
};
const MANUAL_BY_DEFAULT_TYPES = new Set(["figure"]);

addIcon(
  ICON_NAME,
  [
    '<rect x="3" y="4" width="18" height="16" rx="3" ry="3"></rect>',
    '<path d="M7 9h8"></path>',
    '<path d="M7 13h10"></path>',
    '<path d="M7 17h6"></path>',
    '<path d="M17 8.5l1.5 1.5l-1.5 1.5"></path>',
  ].join("")
);

function quoteDepth(prefix) {
  return (prefix.match(/>/g) || []).length;
}

function normalizeType(type) {
  return String(type || "").trim().toLowerCase();
}

function toDisplayType(type) {
  const normalized = normalizeType(type);
  if (!normalized) {
    return "Callout";
  }

  const words = normalized.split(/[-_\s]+/).filter(Boolean);
  return words.map((word) => {
    if (/^[a-z]+$/i.test(word) && word.length <= 3) {
      return word.toUpperCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

function collapseWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTitlePrefix(title, displayType) {
  const cleanTitle = collapseWhitespace(title);
  if (!cleanTitle) {
    return "";
  }

  const prefix = new RegExp(
    `^${escapeRegex(displayType)}\\s+\\d+(?:\\([A-Za-z]\\))?(?:\\s*[:.-]\\s*|\\s+)`,
    "i"
  );
  const barePrefix = new RegExp(
    `^${escapeRegex(displayType)}\\s+\\d+(?:\\([A-Za-z]\\))?$`,
    "i"
  );

  if (barePrefix.test(cleanTitle)) {
    return "";
  }

  return cleanTitle.replace(prefix, "").trim();
}

function getTitlePrefixInfo(title, displayType) {
  const cleanTitle = collapseWhitespace(title);
  if (!cleanTitle) {
    return null;
  }

  const prefix = new RegExp(
    `^(${escapeRegex(displayType)}\\s+\\d+(?:\\([A-Za-z]\\))?)(?:\\s*[:.-]\\s*(.*)|\\s+(.*)|$)`,
    "i"
  );
  const match = cleanTitle.match(prefix);
  if (!match) {
    return null;
  }

  return {
    rawPrefix: collapseWhitespace(match[1]),
    suffix: collapseWhitespace(match[2] || match[3] || ""),
    rawTitle: cleanTitle,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector >= 0 && sector < 1) {
    red = chroma;
    green = x;
  } else if (sector < 2) {
    red = x;
    green = chroma;
  } else if (sector < 3) {
    green = chroma;
    blue = x;
  } else if (sector < 4) {
    green = x;
    blue = chroma;
  } else if (sector < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = light - chroma / 2;
  const channels = [red, green, blue].map((channel) => {
    const value = Math.round((channel + match) * 255);
    return value.toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function rgbStringToHex(value) {
  const match = String(value || "").match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/);
  if (!match) {
    return null;
  }

  const channels = match.slice(1).map((part) => {
    const number = clamp(Number(part), 0, 255);
    return number.toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function fallbackColorForType(type) {
  const normalized = normalizeType(type);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }

  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 72, 58);
}

function extractCalloutManagerColor(rules, isDarkTheme) {
  if (!Array.isArray(rules)) {
    return null;
  }

  let fallback = null;
  let themed = null;

  for (const rule of rules) {
    const hex = rgbStringToHex(rule?.changes?.color);
    if (!hex) {
      continue;
    }

    const scheme = rule?.condition?.colorScheme;
    if (!scheme) {
      fallback = hex;
      continue;
    }

    if ((scheme === "dark" && isDarkTheme) || (scheme === "light" && !isDarkTheme)) {
      themed = hex;
    }
  }

  return themed || fallback;
}

function parseCalloutManagerColors(data, isDarkTheme) {
  const colors = {};
  const settings = data?.callouts?.settings;
  if (!settings || typeof settings !== "object") {
    return colors;
  }

  for (const [type, rules] of Object.entries(settings)) {
    const normalizedType = normalizeType(type);
    const hex = extractCalloutManagerColor(rules, isDarkTheme);
    if (normalizedType && hex) {
      colors[normalizedType] = hex;
    }
  }

  return colors;
}

function getQuoteInfo(line) {
  const match = line.match(QUOTE_RE);
  if (!match) {
    return null;
  }

  return {
    indent: match[1],
    prefix: match[2],
    depth: quoteDepth(match[2]),
    body: match[3],
  };
}

function parseCalloutOutlineOverride(text) {
  const match = String(text || "").trim().match(OVERRIDE_RE);
  if (!match) {
    return null;
  }

  const directive = match[1].trim();
  if (/^manual$/i.test(directive)) {
    return { mode: "manual" };
  }

  const startMatch = directive.match(/^start\s*=\s*(\d+)$/i);
  if (startMatch) {
    return {
      mode: "start",
      start: Number(startMatch[1]),
    };
  }

  return {
    mode: "unknown",
    raw: directive,
  };
}

function findCalloutOverride(lines, startIndex, headerDepth) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const quoteInfo = getQuoteInfo(lines[index]);
    if (!quoteInfo || quoteInfo.depth < headerDepth) {
      break;
    }

    if (quoteInfo.depth !== headerDepth) {
      continue;
    }

    const body = quoteInfo.body.replace(/^\s+/, "");
    if (!body.trim()) {
      continue;
    }

    return parseCalloutOutlineOverride(body);
  }

  return null;
}

function parseCallouts(text) {
  const lines = String(text || "").split(/\r?\n/);
  const callouts = [];
  const countsByType = {};
  const stack = [];
  const fenceDepths = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const quoteInfo = getQuoteInfo(line);
    const depth = quoteInfo ? quoteInfo.depth : 0;

    while (fenceDepths.length && fenceDepths[fenceDepths.length - 1] > depth) {
      fenceDepths.pop();
    }

    if (!quoteInfo) {
      stack.length = 0;
      continue;
    }

    const body = quoteInfo.body.replace(/^\s+/, "");
    const inFence = fenceDepths.length > 0 && depth >= fenceDepths[fenceDepths.length - 1];
    const isFenceMarker = FENCE_RE.test(body);

    if (inFence) {
      if (isFenceMarker && depth === fenceDepths[fenceDepths.length - 1]) {
        fenceDepths.pop();
      }
      continue;
    }

    if (isFenceMarker) {
      fenceDepths.push(depth);
      continue;
    }

    const headerMatch = line.match(HEADER_RE);
    if (!headerMatch) {
      continue;
    }

    while (stack.length && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const type = normalizeType(headerMatch[3]);
    const title = collapseWhitespace(headerMatch[5] || "");
    const override = findCalloutOverride(lines, lineNumber, depth);
    const isManualByDefault = MANUAL_BY_DEFAULT_TYPES.has(type);
    const isManual = isManualByDefault || override?.mode === "manual";
    if (!isManualByDefault && override?.mode === "start" && Number.isFinite(override.start) && override.start >= 1) {
      countsByType[type] = override.start - 1;
    }

    const number = isManual ? null : (countsByType[type] || 0) + 1;
    if (!isManual) {
      countsByType[type] = number;
    }

    const displayType = toDisplayType(type);
    const titlePrefixInfo = isManual ? null : getTitlePrefixInfo(title, displayType);
    const titleSuffix = isManual
      ? ""
      : titlePrefixInfo
        ? titlePrefixInfo.suffix
        : stripTitlePrefix(title, displayType);
    const generatedPrefix = number === null ? "" : `${displayType} ${number}`;
    const titleMismatch = Boolean(
      !isManual
      && titlePrefixInfo
      && collapseWhitespace(titlePrefixInfo.rawPrefix).toLowerCase() !== generatedPrefix.toLowerCase()
    );
    const label = isManual
      ? (title || (isManualByDefault ? displayType : `${displayType} (manual)`))
      : titleSuffix
        ? `${displayType} ${number}: ${titleSuffix}`
        : `${displayType} ${number}`;

    callouts.push({
      type,
      rawType: headerMatch[3],
      displayType,
      title,
      line: lineNumber,
      depth,
      nesting: stack.length,
      collapsed: Boolean(headerMatch[4]),
      number,
      label,
      titleMismatch,
      rawTitle: title,
      override,
      isManual,
      isManualByDefault,
    });

    stack.push({ depth, line: lineNumber });
  }

  return callouts;
}

function renderInlineMath(container, text, onMathError) {
  const value = String(text || "");
  if (!value) {
    return;
  }

  const pattern = /\$([^$]+)\$/g;
  let lastIndex = 0;
  let match = null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      container.append(document.createTextNode(value.slice(lastIndex, match.index)));
    }

    try {
      const rendered = renderMath(match[1].trim(), false);
      container.appendChild(rendered);
      finishRenderMath();
    } catch (_error) {
      container.append(document.createTextNode(match[0]));
      if (typeof onMathError === "function") {
        onMathError();
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    container.append(document.createTextNode(value.slice(lastIndex)));
  }
}

function restoreDecoratedCallouts(root) {
  if (!root) {
    return;
  }

  const titleEls = root.querySelectorAll(".callout .callout-title-inner[data-callout-outline-original-html]");
  for (const titleEl of titleEls) {
    const originalHtml = titleEl.dataset.calloutOutlineOriginalHtml;
    if (typeof originalHtml === "string") {
      titleEl.innerHTML = originalHtml;
    }
    delete titleEl.dataset.calloutOutlineOriginalHtml;
    titleEl.removeAttribute("title");
  }
}

function getRenderedCalloutTitleEls(root) {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll(".callout .callout-title-inner"));
}

function countRenderedCalloutNesting(calloutEl) {
  if (!calloutEl) {
    return null;
  }

  let nesting = 0;
  let current = calloutEl.parentElement;

  while (current) {
    const parentCallout = current.closest(".callout");
    if (!parentCallout) {
      break;
    }

    nesting += 1;
    current = parentCallout.parentElement;
  }

  return nesting;
}

function titleLooksLikeCallout(callout, titleText) {
  const cleanTitle = collapseWhitespace(titleText).toLowerCase();
  if (!cleanTitle || !callout) {
    return false;
  }

  const displayType = collapseWhitespace(callout.displayType).toLowerCase();
  const rawTitle = collapseWhitespace(callout.rawTitle).toLowerCase();

  if (displayType && (cleanTitle === displayType || cleanTitle.startsWith(`${displayType} `))) {
    return true;
  }

  if (rawTitle && (cleanTitle === rawTitle || cleanTitle.startsWith(`${rawTitle} `))) {
    return true;
  }

  return false;
}

function inferCalloutTypeFromTitle(titleText, callouts) {
  const cleanTitle = collapseWhitespace(titleText).toLowerCase();
  if (!cleanTitle || !Array.isArray(callouts)) {
    return "";
  }

  const seen = new Set();
  for (const callout of callouts) {
    const type = normalizeType(callout?.type);
    const displayType = collapseWhitespace(callout?.displayType).toLowerCase();
    if (!type || !displayType || seen.has(type)) {
      continue;
    }

    seen.add(type);
    if (cleanTitle === displayType || cleanTitle.startsWith(`${displayType} `)) {
      return type;
    }
  }

  return "";
}

function pickBestRenderedCalloutMatch(candidates, entry) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  let matched = candidates;

  if (entry?.titleText) {
    const titleMatched = matched.filter((callout) => titleLooksLikeCallout(callout, entry.titleText));
    if (titleMatched.length > 0) {
      matched = titleMatched;
    }
  }

  if (entry?.type) {
    const sameType = matched.filter((callout) => callout.type === entry.type);
    if (sameType.length > 0) {
      matched = sameType;
    }
  }

  if (typeof entry?.nesting === "number") {
    const sameNesting = matched.filter((callout) => callout.nesting === entry.nesting);
    if (sameNesting.length > 0) {
      matched = sameNesting;
    }
  }

  return matched[matched.length - 1] || null;
}

function findCalloutForRenderedEntry(callouts, entry) {
  if (!Array.isArray(callouts) || typeof entry?.line !== "number") {
    return null;
  }

  const preceding = [];
  for (const callout of callouts) {
    if (callout.line > entry.line) {
      break;
    }
    preceding.push(callout);
  }

  if (preceding.length === 0) {
    return null;
  }

  const exactLine = preceding.filter((callout) => callout.line === entry.line);
  return pickBestRenderedCalloutMatch(exactLine, entry)
    || pickBestRenderedCalloutMatch(preceding, entry);
}

function getRenderedCalloutEntries(view) {
  const root = view?.contentEl;
  const editorView = view?.editor?.cm;
  if (!root || !editorView || typeof editorView.posAtDOM !== "function") {
    return [];
  }

  const titleEls = getRenderedCalloutTitleEls(root);
  const entries = [];

  for (const titleEl of titleEls) {
    if (!titleEl.closest(".cm-editor")) {
      continue;
    }

    const calloutEl = titleEl.closest(".callout");
    const anchor = titleEl.closest(".cm-callout, .cm-embed-block, .callout") || titleEl;
    let position = null;
    let line = null;

    try {
      position = editorView.posAtDOM(anchor, 0);
      line = editorView.state.doc.lineAt(position).number - 1;
    } catch (_error) {
      continue;
    }

    if (typeof line !== "number" || line < 0) {
      continue;
    }

    entries.push({
      titleEl,
      line,
      titleText: collapseWhitespace(titleEl.textContent || ""),
      type: normalizeType(calloutEl?.dataset?.callout || ""),
      nesting: countRenderedCalloutNesting(calloutEl),
    });
  }

  return entries;
}

class CalloutOutlineView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.filterType = "all";
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Callout Outline";
  }

  getIcon() {
    return ICON_NAME;
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("callout-outline-view");
    this.render();
  }

  async onClose() {}

  setFilter(type) {
    this.filterType = type || "all";
    this.render();
  }

  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("callout-outline-view");

    const state = this.plugin.currentState;
    const controls = container.createDiv({ cls: "callout-outline-controls" });
    controls.createDiv({ cls: "callout-outline-label", text: "Current Note" });
    controls.createDiv({
      cls: "callout-outline-file",
      text: state.file ? state.file.path : "Open a Markdown note to show callouts.",
    });

    if (!state.file) {
      container.createDiv({
        cls: "callout-outline-empty",
        text: "The outline appears when a Markdown note is active.",
      });
      return;
    }

    const counts = this.plugin.getCountsForCallouts(state.callouts);
    const availableTypes = ["all", ...Object.keys(counts).sort()];
    if (!availableTypes.includes(this.filterType)) {
      this.filterType = "all";
    }

    const filterSetting = new Setting(controls)
      .setName("Filter")
      .setDesc("Limit the outline to a single callout type.");

    filterSetting.addDropdown((dropdown) => {
      dropdown.addOption("all", `All callouts (${state.callouts.length})`);
      for (const type of Object.keys(counts).sort()) {
        dropdown.addOption(type, `${toDisplayType(type)} (${counts[type]})`);
      }
      dropdown.setValue(this.filterType);
      dropdown.onChange((value) => this.setFilter(value));
      dropdown.selectEl.addClass("callout-outline-select");
    });

    const visibleCallouts = state.callouts.filter((callout) =>
      this.filterType === "all" || callout.type === this.filterType
    );

    controls.createDiv({
      cls: "callout-outline-summary",
      text: `${visibleCallouts.length} shown of ${state.callouts.length} callouts`,
    });

    if (visibleCallouts.length === 0) {
      container.createDiv({
        cls: "callout-outline-empty",
        text: "No matching callouts were found in the active note.",
      });
      return;
    }

    const list = container.createDiv({ cls: "callout-outline-list" });
    for (const callout of visibleCallouts) {
      const item = list.createDiv({
        cls: "callout-outline-item",
      });

      item.style.setProperty("--callout-outline-accent", this.plugin.getTypeColor(callout.type));
      item.style.marginLeft = `${callout.nesting * 12}px`;
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");

      const titleEl = item.createDiv({
        cls: "callout-outline-item-title",
      });
      renderInlineMath(titleEl, callout.label, () => this.plugin.scheduleMathReload());

      const metaParts = [
        `Line ${callout.line + 1}`,
        callout.collapsed ? "Collapsed" : null,
      ].filter(Boolean);

      item.createDiv({
        cls: "callout-outline-item-meta",
        text: metaParts.join(" • "),
      });

      if (callout.titleMismatch && callout.rawTitle) {
        const noteEl = item.createDiv({
          cls: "callout-outline-item-note",
        });
        renderInlineMath(noteEl, callout.rawTitle, () => this.plugin.scheduleMathReload());
      }

      const jump = () => {
        this.plugin.jumpToCallout(callout);
      };

      item.addEventListener("click", jump);
      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        jump();
      });
    }
  }
}

class CalloutOutlineSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Callout Outline" });
    containerEl.createEl("p", {
      text: "Color overrides are optional. If no override is set, the plugin uses Callout Manager colors when available and falls back to an automatic accent color for unknown callout types.",
    });

    new Setting(containerEl)
      .setName("Inherit Callout Manager colors")
      .setDesc("Use colors from the Callout Manager plugin before applying automatic fallback colors.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.inheritCalloutManagerColors);
        toggle.onChange(async (value) => {
          this.plugin.settings.inheritCalloutManagerColors = value;
          await this.plugin.saveSettings();
          await this.plugin.reloadCalloutManagerColors();
          this.display();
          this.plugin.refreshView();
        });
      });

    new Setting(containerEl)
      .setName("Decorate rendered callouts")
      .setDesc("Show the generated per-type numbering directly in rendered callout titles without changing the Markdown source.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.decorateRenderedCallouts);
        toggle.onChange(async (value) => {
          this.plugin.settings.decorateRenderedCallouts = value;
          await this.plugin.saveSettings();
          this.plugin.refreshView();
        });
      });

    new Setting(containerEl)
      .setName("Reload callout colors")
      .setDesc("Refresh the cached colors from Callout Manager and the current note.")
      .addButton((button) => {
        button.setButtonText("Reload");
        button.onClick(async () => {
          await this.plugin.reloadCalloutManagerColors();
          this.display();
          this.plugin.refreshView();
          new Notice("Callout Outline colors reloaded.");
        });
      });

    containerEl.createEl("h3", { text: "Per-Type Colors" });
    containerEl.createEl("p", {
      text: "Known types come from Callout Manager, your current note, and any saved overrides.",
    });

    const types = this.plugin.getKnownCalloutTypes();
    if (types.length === 0) {
      containerEl.createEl("p", {
        text: "No callout types are available yet.",
      });
      return;
    }

    for (const type of types) {
      const displayType = toDisplayType(type);
      const hasOverride = Object.prototype.hasOwnProperty.call(this.plugin.settings.colorOverrides, type);
      const effectiveSource = hasOverride
        ? "Custom override"
        : this.plugin.calloutManagerColors[type]
          ? "Callout Manager"
          : "Automatic fallback";

      new Setting(containerEl)
        .setName(displayType)
        .setDesc(effectiveSource)
        .addColorPicker((picker) => {
          picker.setValue(this.plugin.getTypeColor(type));
          picker.onChange(async (value) => {
            this.plugin.settings.colorOverrides[type] = value;
            await this.plugin.saveSettings();
            this.display();
            this.plugin.refreshView();
          });
        })
        .addExtraButton((button) => {
          button.setIcon("reset");
          button.setTooltip("Clear custom color override");
          button.setDisabled(!hasOverride);
          button.onClick(async () => {
            delete this.plugin.settings.colorOverrides[type];
            await this.plugin.saveSettings();
            this.display();
            this.plugin.refreshView();
          });
        });
    }
  }
}

module.exports = class CalloutOutlinePlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.currentState = {
      file: null,
      callouts: [],
    };
    this.calloutManagerColors = {};
    this.lastMarkdownView = null;
    this.mathReloadScheduled = false;
    this.currentObservedView = null;
    this.calloutMutationObserver = null;
    this.isDecoratingRenderedCallouts = false;
    this.decorateRetryTimer = null;

    await this.reloadCalloutManagerColors();

    this.registerView(VIEW_TYPE, (leaf) => new CalloutOutlineView(leaf, this));
    this.addSettingTab(new CalloutOutlineSettingTab(this.app, this));

    this.addCommand({
      id: "open-callout-outline",
      name: "Open callout outline",
      callback: async () => {
        await this.activateView();
      },
    });

    this.addRibbonIcon(ICON_NAME, "Open callout outline", async () => {
      await this.activateView();
    });

    this.refreshView = debounce(this.refreshView.bind(this), 150, true);

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf?.view instanceof MarkdownView && leaf.view.file) {
          this.lastMarkdownView = leaf.view;
          this.observeMarkdownView(leaf.view);
        }
        this.refreshView();
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeMarkdownView?.file) {
          this.lastMarkdownView = activeMarkdownView;
          this.observeMarkdownView(activeMarkdownView);
        }
        this.refreshView();
      })
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (_editor, info) => {
        if (!this.currentState.file || info?.file?.path !== this.currentState.file.path) {
          return;
        }
        this.refreshView();
      })
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!this.currentState.file || file.path !== this.currentState.file.path) {
          return;
        }
        this.refreshView();
      })
    );

    this.registerEvent(
      this.app.workspace.on("css-change", async () => {
        await this.reloadCalloutManagerColors();
        this.refreshView();
      })
    );

    this.app.workspace.onLayoutReady(() => {
      const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeMarkdownView?.file) {
        this.lastMarkdownView = activeMarkdownView;
        this.observeMarkdownView(activeMarkdownView);
      }
      this.refreshView();
    });
  }

  async onunload() {
    this.stopObservingMarkdownView();
    this.clearDecorateRetry();
    this.restoreAllRenderedCallouts();
    await this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.colorOverrides = Object.fromEntries(
      Object.entries(this.settings.colorOverrides || {}).map(([type, color]) => [normalizeType(type), color])
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  restoreAllRenderedCallouts() {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      restoreDecoratedCallouts(leaf.view?.contentEl);
    }
  }

  stopObservingMarkdownView() {
    if (this.calloutMutationObserver) {
      this.calloutMutationObserver.disconnect();
      this.calloutMutationObserver = null;
    }
    this.currentObservedView = null;
  }

  clearDecorateRetry() {
    if (this.decorateRetryTimer !== null) {
      window.clearTimeout(this.decorateRetryTimer);
      this.decorateRetryTimer = null;
    }
  }

  scheduleDecorateRetry() {
    if (this.decorateRetryTimer !== null) {
      return;
    }

    this.decorateRetryTimer = window.setTimeout(() => {
      this.decorateRetryTimer = null;
      this.decorateRenderedCallouts();
    }, 250);
  }

  observeMarkdownView(view) {
    if (!view?.contentEl) {
      return;
    }

    if (this.currentObservedView === view && this.calloutMutationObserver) {
      return;
    }

    this.stopObservingMarkdownView();
    this.currentObservedView = view;
    this.calloutMutationObserver = new MutationObserver(() => {
      if (this.isDecoratingRenderedCallouts) {
        return;
      }
      this.decorateRenderedCallouts();
    });
    this.calloutMutationObserver.observe(view.contentEl, {
      childList: true,
      subtree: true,
    });
  }

  getActiveMarkdownView() {
    const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeMarkdownView?.file) {
      this.lastMarkdownView = activeMarkdownView;
      return activeMarkdownView;
    }

    if (this.lastMarkdownView?.file) {
      return this.lastMarkdownView;
    }

    return null;
  }

  async getActiveMarkdownState() {
    const view = this.getActiveMarkdownView();
    if (!view || !view.file) {
      return {
        file: null,
        callouts: [],
      };
    }

    const text = view.editor ? view.editor.getValue() : await this.app.vault.cachedRead(view.file);
    return {
      file: view.file,
      callouts: parseCallouts(text),
    };
  }

  async refreshView() {
    this.currentState = await this.getActiveMarkdownState();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && typeof leaf.view.render === "function") {
        leaf.view.render();
      }
    }
    this.decorateRenderedCallouts();
  }

  async activateView() {
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({
      type: VIEW_TYPE,
      active: true,
    });
    this.app.workspace.revealLeaf(leaf);
    this.refreshView();
  }

  async reloadCalloutManagerColors() {
    const path = `${this.app.vault.configDir}/plugins/callout-manager/data.json`;
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) {
      this.calloutManagerColors = {};
      return;
    }

    try {
      const raw = await this.app.vault.adapter.read(path);
      const isDarkTheme = document.body.classList.contains("theme-dark");
      this.calloutManagerColors = parseCalloutManagerColors(JSON.parse(raw), isDarkTheme);
    } catch (error) {
      console.error("Callout Outline: failed to read Callout Manager data.", error);
      this.calloutManagerColors = {};
    }
  }

  getCountsForCallouts(callouts) {
    const counts = {};
    for (const callout of callouts) {
      counts[callout.type] = (counts[callout.type] || 0) + 1;
    }
    return counts;
  }

  getKnownCalloutTypes() {
    const types = new Set();
    Object.keys(this.calloutManagerColors || {}).forEach((type) => types.add(type));
    Object.keys(this.settings.colorOverrides || {}).forEach((type) => types.add(type));
    for (const callout of this.currentState.callouts || []) {
      types.add(callout.type);
    }
    return Array.from(types).sort();
  }

  getTypeColor(type) {
    const normalized = normalizeType(type);
    const override = this.settings.colorOverrides?.[normalized];
    if (override) {
      return override;
    }

    if (this.settings.inheritCalloutManagerColors && this.calloutManagerColors[normalized]) {
      return this.calloutManagerColors[normalized];
    }

    return fallbackColorForType(normalized);
  }

  scheduleMathReload() {
    if (this.mathReloadScheduled) {
      return;
    }

    this.mathReloadScheduled = true;
    loadMathJax()
      .catch(() => null)
      .finally(() => {
        this.mathReloadScheduled = false;
        this.refreshView();
      });
  }

  decorateRenderedCallouts() {
    window.requestAnimationFrame(() => {
      if (this.isDecoratingRenderedCallouts) {
        return;
      }

      this.isDecoratingRenderedCallouts = true;
      try {
      const view = this.getActiveMarkdownView();
      const root = view?.contentEl;
      if (!root) {
        return;
      }

      restoreDecoratedCallouts(root);

      if (!this.settings.decorateRenderedCallouts) {
        return;
      }

      const entries = getRenderedCalloutEntries(view);
      if (this.currentState.callouts.length === 0) {
        this.clearDecorateRetry();
        return;
      }

      if (entries.length === 0) {
        this.scheduleDecorateRetry();
        return;
      }

      this.clearDecorateRetry();

      for (const entry of entries) {
        const titleEl = entry.titleEl;
        const callout = findCalloutForRenderedEntry(this.currentState.callouts, entry);
      if (!titleEl || !callout) {
        continue;
      }

      const inferredType = inferCalloutTypeFromTitle(entry.titleText, this.currentState.callouts);
      if (inferredType && inferredType !== callout.type) {
        continue;
      }

      if (callout.isManual) {
        continue;
      }

      titleEl.dataset.calloutOutlineOriginalHtml = titleEl.innerHTML;
      titleEl.replaceChildren();
        renderInlineMath(titleEl, callout.label, () => this.scheduleMathReload());

        if (callout.titleMismatch && callout.rawTitle) {
          titleEl.setAttribute("title", callout.rawTitle);
        } else {
          titleEl.removeAttribute("title");
        }
      }
      } finally {
        this.isDecoratingRenderedCallouts = false;
      }
    });
  }

  jumpToCallout(callout) {
    const view = this.getActiveMarkdownView();
    if (!view || !view.file) {
      new Notice("Open a Markdown note to jump to a callout.");
      return;
    }

    view.setEphemeralState({
      line: callout.line,
    });
  }
};
