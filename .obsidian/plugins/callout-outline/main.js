const {
  getIconIds,
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
const ICON_NAME = "list-tree";
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
  const lines = String(text || "").split(/\r?\n/), callouts = [], counts = new Map();
  let fences = [], stack = [], previousDepth = 0, blockStart = -1, blockEntries = [], comment = null, listIndent = 0;
  let frontmatter = lines[0]?.replace(/^\uFEFF/, "").trim() === "---" && lines.slice(1).some(line => /^(---|\.\.\.)\s*$/.test(line));
  const closeBlock = end => { for (const c of blockEntries) c.blockEndLine = end; blockEntries = []; blockStart = -1; };
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    let line = lines[lineNumber];
    if (frontmatter) { if (lineNumber > 0 && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false; continue; }
    const list = line.match(/^(\s*)(?:[-+*]|\d+[.)])\s+/);
    if (list) { listIndent = list[0].length; line = " ".repeat(listIndent) + line.slice(list[0].length); previousDepth = 0; closeBlock(lineNumber - 1); }
    else if (line.trim() && line.search(/\S/) < listIndent) listIndent = 0;
    const quote = getQuoteInfo(line), depth = quote?.depth || 0, body = quote ? quote.body : line;
    while (fences.length && fences.at(-1).depth > depth) fences.pop();
    const fence = fences.at(-1);
    if (fence) {
      const closing = body.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (depth === fence.depth && closing && closing[1][0] === fence.char && closing[1].length >= fence.length) fences.pop();
      continue;
    }
    if (comment) { const end = body.indexOf(comment); if (end >= 0) comment = null; continue; }
    const trimmed = body.trim();
    if (!OVERRIDE_RE.test(trimmed) && (trimmed.startsWith('%%') || trimmed.startsWith('<!--'))) {
      const token = trimmed.startsWith('%%') ? '%%' : '-->', from = token === '%%' ? 2 : 4;
      if (trimmed.indexOf(token, from) < 0) comment = token;
      continue;
    }
    const opening = body.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
      fences.push({depth, char: opening[1][0], length: opening[1].length});
      if (depth) previousDepth = depth;
      else { closeBlock(lineNumber - 1); previousDepth = 0; stack = []; }
      continue;
    }
    if (!quote || (quote.indent.replace(/\t/g, '    ').length >= 4 && !listIndent)) {
      closeBlock(lineNumber - 1); previousDepth = 0; stack = []; continue;
    }
    if (blockStart < 0) blockStart = lineNumber;
    const firstAtDepth = depth > previousDepth; previousDepth = depth;
    const match = line.match(HEADER_RE);
    if (!match || !firstAtDepth) continue;
    while (stack.length && stack.at(-1).depth >= depth) stack.pop();
    const type = normalizeType(match[3].split('|')[0]), title = collapseWhitespace(match[5] || "");
    const override = findCalloutOverride(lines, lineNumber, depth), isManualByDefault = MANUAL_BY_DEFAULT_TYPES.has(type);
    const isManual = isManualByDefault || override?.mode === "manual";
    if (!isManualByDefault && override?.mode === "start" && Number.isSafeInteger(override.start) && override.start >= 1) counts.set(type, override.start - 1);
    const number = isManual ? null : (counts.get(type) || 0) + 1;
    if (!isManual) counts.set(type, number);
    const displayType = toDisplayType(type), titlePrefixInfo = isManual ? null : getTitlePrefixInfo(title, displayType);
    const titleSuffix = isManual ? "" : titlePrefixInfo ? titlePrefixInfo.suffix : stripTitlePrefix(title, displayType);
    const generatedPrefix = number === null ? "" : `${displayType} ${number}`;
    const titleMismatch = Boolean(!isManual && titlePrefixInfo && collapseWhitespace(titlePrefixInfo.rawPrefix).toLowerCase() !== generatedPrefix.toLowerCase());
    const label = isManual ? (title || (isManualByDefault ? displayType : `${displayType} (manual)`)) : titleSuffix ? `${generatedPrefix}: ${titleSuffix}` : generatedPrefix;
    const c = {type, rawType:match[3], displayType, title, line:lineNumber, depth, nesting:stack.length,
      collapsed:match[4] === '-', number, label, titleMismatch, rawTitle:title, override, isManual, isManualByDefault,
      authoredNumber:Boolean(titlePrefixInfo), blockStartLine:blockStart, blockEndLine:lines.length - 1};
    callouts.push(c); blockEntries.push(c); stack.push({depth, line:lineNumber});
  }
  closeBlock(lines.length - 1);
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
      container.append(container.ownerDocument.createTextNode(value.slice(lastIndex, match.index)));
    }

    try {
      const rendered = renderMath(match[1].trim(), false);
      container.appendChild(rendered);
    } catch (_error) {
      container.append(container.ownerDocument.createTextNode(match[0]));
      if (typeof onMathError === "function") {
        onMathError();
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    container.append(container.ownerDocument.createTextNode(value.slice(lastIndex)));
  }
}

const DECORATION_ATTRIBUTES = ['data-callout-outline-prefix', 'data-callout-outline-suffix', 'data-callout-outline-mismatch'];
function restoreDecoratedCallouts(root) {
  if (!root) return;
  for (const el of root.querySelectorAll('.callout-title-inner')) {
    for (const attr of DECORATION_ATTRIBUTES) if (el.hasAttribute(attr)) el.removeAttribute(attr);
  }
}

function findCalloutForRenderedEntry(callouts, entry) {
  return callouts.find(c => c.line === entry?.line && (!entry.type || c.type === entry.type) &&
    (entry.nesting == null || c.nesting === entry.nesting)) || null;
}

function isLivePreview(view) {
  return view?.getMode?.() === 'source' && view.getState?.().source !== true;
}

const SOURCE_GROUPS = new WeakMap();
function getRenderedCalloutEntries(view, callouts) {
  const root = view?.contentEl?.querySelector('.cm-content'), cm = view?.editor?.cm;
  if (!root || !cm || !isLivePreview(view)) return [];
  let groups = SOURCE_GROUPS.get(callouts);
  if (!groups) {groups = new Map(); for (const c of callouts) {if (!groups.has(c.blockStartLine)) groups.set(c.blockStartLine, []); groups.get(c.blockStartLine).push(c);} SOURCE_GROUPS.set(callouts, groups);}
  const entries = [];
  const widgets = [...root.querySelectorAll('.cm-embed-block, .cm-callout')].filter(el => !el.parentElement?.closest('.cm-embed-block, .cm-callout'));
  for (const widget of widgets) {
    let line;
    try { line = cm.state.doc.lineAt(cm.posAtDOM(widget, 0)).number - 1; } catch { continue; }
    const group = groups.get(line);
    if (!group) continue;
    // An embedded note is a different source, even if it contains callouts.
    const els = [...widget.querySelectorAll('.callout')].filter(el => !el.closest('.internal-embed'));
    if (els.length !== group.length || els.some((el, i) => normalizeType(el.dataset.callout) !== group[i].type)) continue;
    const baseDepth = group[0].nesting;
    if (els.some((el, i) => { let depth = 0, parent = el.parentElement?.closest('.callout'); while (parent && widget.contains(parent)) {depth++; parent = parent.parentElement?.closest('.callout');} return depth !== group[i].nesting - baseDepth; })) continue;
    for (let i = 0; i < els.length; i++) {
      const titleEl = els[i].querySelector(':scope > .callout-title > .callout-title-inner');
      if (titleEl) entries.push({titleEl, callout:group[i]});
    }
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
    return this.plugin.iconName || ICON_NAME;
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("callout-outline-view");
    this.render();
  }

  async onClose() {
    if (this.renderFrame != null) this.contentEl.ownerDocument.defaultView.cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null; this.renderEpoch = (this.renderEpoch || 0) + 1;
    this.metaObserver?.disconnect(); this.metaObserver = null; this.rows?.clear();
  }

  updateRowMeta(row) {
    const c = row.callout;
    if (!c) return;
    if (row.item.dataset.calloutLine !== String(c.line)) row.item.dataset.calloutLine = String(c.line);
    const text = `Line ${c.line + 1}${c.collapsed ? ' • Collapsed' : ''}`;
    if (row.metaText !== text) {row.meta.textContent = text; row.metaText = text;}
  }

  setFilter(type) {
    this.filterType = type || "all";
    this.render();
  }

  render() {
    const container = this.contentEl || this.containerEl.children[1], state = this.plugin.currentState;
    if (!state || this.plugin.unloaded) return;
    if (!container.classList.contains('callout-outline-view')) container.addClass('callout-outline-view');
    if (!this.controls || !container.contains(this.controls)) {
      container.empty();
      this.controls = container.createDiv({cls:'callout-outline-controls'});
      this.fileEl = this.controls.createDiv({cls:'callout-outline-file'});
      const row = this.controls.createDiv({cls:'callout-outline-filter-row'});
      const label = row.createEl('label', {cls:'callout-outline-filter-label', text:'Type'});
      this.select = label.createEl('select', {cls:'callout-outline-select', attr:{'aria-label':'Callout type'}});
      this.select.addEventListener('change', () => this.setFilter(this.select.value));
      this.countEl = row.createEl('span', {cls:'callout-outline-count', attr:{'aria-live':'polite'}});
      this.list = container.createDiv({cls:'callout-outline-list'});
      this.metaObserver?.disconnect(); this.metaObserver = null;
      const win = container.ownerDocument.defaultView;
      if (typeof win.IntersectionObserver === 'function') {
        this.metaObserver = new win.IntersectionObserver(entries => {
          for (const entry of entries) {
            const row = entry.target.calloutOutlineRow;
            if (!row || this.rows?.get(entry.target.calloutRowKey) !== row) continue;
            row.nearViewport = entry.isIntersecting;
            if (row.nearViewport) this.updateRowMeta(row);
          }
        }, {root:this.list, rootMargin:`${Math.max(win.innerHeight, 600)}px 0px`});
      }
      this.signature = null;
    }
    const path = state.file?.path || '', basename = state.file?.basename || path.split('/').at(-1)?.replace(/\.md$/i, '') || 'Callouts';
    if (this.fileEl.textContent !== basename) this.fileEl.textContent = basename;
    const tooltip = path || 'Open a Markdown note to show callouts', fileLabel = path || 'No active Markdown note';
    if (this.fileEl.title !== tooltip) this.fileEl.title = tooltip;
    if (this.fileEl.getAttribute('aria-label') !== fileLabel) this.fileEl.setAttribute('aria-label', fileLabel);
    const counts = this.plugin.getCountsForCallouts(state.callouts), types = Object.keys(counts).sort();
    if (this.filterType !== 'all' && !Object.hasOwn(counts, this.filterType)) this.filterType = 'all';
    const options = JSON.stringify(counts);
    if (options !== this.optionSignature) {
      this.select.replaceChildren(); this.select.createEl('option', {text:'All types', attr:{value:'all'}});
      for (const type of types) this.select.createEl('option', {text:`${toDisplayType(type)} (${counts[type]})`, attr:{value:type}});
      this.optionSignature = options;
    }
    if (this.select.value !== this.filterType) this.select.value = this.filterType;
    if (this.select.disabled !== !state.file) this.select.disabled = !state.file;
    const visible = state.callouts.filter(c => this.filterType === 'all' || c.type === this.filterType);
    const countText = this.filterType === 'all' ? String(state.callouts.length) : `${visible.length} of ${state.callouts.length}`;
    const countLabel = `${visible.length} of ${state.callouts.length} callouts`;
    if (this.countEl.textContent !== countText) this.countEl.textContent = countText;
    if (this.countEl.getAttribute('aria-label') !== countLabel) this.countEl.setAttribute('aria-label', countLabel);
    const signature = JSON.stringify([path, this.filterType, this.plugin.colorVersion, this.plugin.mathStatus, state.issue, visible]);
    if (signature === this.signature) return;
    this.signature = signature;
    const focused = this.list.contains(container.ownerDocument.activeElement) ? container.ownerDocument.activeElement : null;
    this.list.querySelector('.callout-outline-empty')?.remove();
    const win = container.ownerDocument.defaultView, epoch = this.renderEpoch = (this.renderEpoch || 0) + 1;
    if (this.renderFrame != null) win.cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
    if (this.rowsPath !== path) {this.rows = new Map(); this.rowsPath = path;}
    this.rows ||= new Map();
    const occurrences = new Map(), keys = new Map();
    for (const c of state.callouts) {const base = `${c.type}\0${c.rawTitle}`; const n = occurrences.get(base) || 0; occurrences.set(base, n + 1); keys.set(c, `${base}\0${n}`);}
    const valid = new Set(keys.values()); for (const key of this.rows.keys()) if (!valid.has(key)) this.rows.delete(key);
    const visibleKeys = new Set(visible.map(c => keys.get(c)));
    for (const item of [...this.list.children]) if (!visibleKeys.has(item.calloutRowKey) || this.rows.get(item.calloutRowKey)?.item !== item) {this.metaObserver?.unobserve(item); item.remove();}
    if (!visible.length) this.list.createDiv({cls:'callout-outline-empty', text:state.issue || (state.file ? 'No matching callouts in this note.' : 'Open a Markdown note to show callouts.')});
    // Refresh every click target before any deferred label rendering.
    for (const c of visible) {const row = this.rows.get(keys.get(c)); if (row) row.callout = c;}
    let index = 0, cursor = this.list.firstChild;
    const paint = () => {
      this.renderFrame = null;
      if (this.plugin.unloaded || epoch !== this.renderEpoch) return;
      const start = win.performance.now(); let contentWork = 0, processed = 0, math = false;
      while (index < visible.length) {
        const callout = visible[index], key = keys.get(callout);
        let row = this.rows.get(key);
        const costly = !row || row.label !== callout.label || row.mathStatus !== this.plugin.mathStatus;
        if (costly && processed && (contentWork >= 50 || win.performance.now() - start >= 4)) break;
        if (costly) contentWork++;
        index++; processed++;
        if (!row) {
          const item = container.ownerDocument.createElement('div'); item.className = 'callout-outline-item';
          item.setAttribute('role', 'button'); item.setAttribute('tabindex', '0');
          row = {item, title:item.createDiv({cls:'callout-outline-item-title'}), meta:item.createDiv({cls:'callout-outline-item-meta'}), note:null};
          item.calloutOutlineRow = row;
          item.addEventListener('focusin', () => this.updateRowMeta(row));
          item.addEventListener('click', () => this.plugin.jumpToCallout(row.callout));
          item.addEventListener('keydown', event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); this.plugin.jumpToCallout(row.callout);}});
          this.rows.set(key, row);
        }
        row.callout = callout; row.item.calloutRowKey = key;
        const color = this.plugin.getTypeColor(callout.type, container.ownerDocument);
        if (row.color !== color) {row.item.style.setProperty('--callout-outline-accent', color); row.color = color;}
        if (row.nesting !== callout.nesting) {row.item.style.marginLeft = `${Math.min(callout.nesting, 6) * 12}px`; row.nesting = callout.nesting;}
        if (row.label !== callout.label || row.mathStatus !== this.plugin.mathStatus) {
          row.title.replaceChildren(); renderInlineMath(row.title, callout.label, () => this.plugin.scheduleMathReload()); math ||= callout.label.includes('$');
          row.label = callout.label; row.mathStatus = this.plugin.mathStatus;
        }
        if (!this.metaObserver || row.nearViewport || container.ownerDocument.activeElement === row.item || row.metaText == null) this.updateRowMeta(row);
        const note = callout.issue || (callout.titleMismatch ? callout.rawTitle : '');
        if (note && row.rawNote !== note) {
          row.note ||= row.item.createDiv({cls:'callout-outline-item-note'});
          row.note.replaceChildren(); renderInlineMath(row.note, note, () => this.plugin.scheduleMathReload()); math ||= note.includes('$');
        } else if (!note && row.note) {row.note.remove(); row.note = null;}
        row.rawNote = note;
        if (row.item !== cursor) {
          const entering = row.item.parentElement !== this.list;
          this.list.insertBefore(row.item, cursor);
          if (entering) {this.updateRowMeta(row); this.metaObserver?.observe(row.item);}
        }
        cursor = row.item.nextSibling;
        if (focused === row.item && container.ownerDocument.activeElement === container.ownerDocument.body) focused.focus({preventScroll:true});
      }
      if (math) finishRenderMath();
      if (index < visible.length) this.renderFrame = win.requestAnimationFrame(paint);

    };
    paint();

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
      text: "Color overrides are optional. Otherwise the outline uses rendered callout colors from your theme, snippets and enabled Callout Manager, with an automatic accent as the fallback.",
    });

    new Setting(containerEl)
      .setName("Inherit Callout Manager colors")
      .setDesc("Use rendered callout colors, including managed colors, themes and snippets.")
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
      .setDesc("Refresh rendered callout colors and enabled color-provider data.")
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
      text: "Known types come from enabled color providers, your current note, and saved overrides.",
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
        : this.plugin.settings.inheritCalloutManagerColors
          ? "Rendered callout color, then enabled provider or automatic fallback"
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

function validatedColor(value, doc) {
  const raw = String(value || '').trim();
  const triple = rgbStringToHex(raw);
  if (triple) return triple;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) return '#' + [...raw.slice(1)].map(c => c + c).join('');
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*1)?\s*\)$/i);
  if (rgb) return rgbStringToHex(rgb.slice(1).join(','));
  if (!doc || !raw || /[;{}]/.test(raw)) return null;
  const el = doc.createElement('span'); el.style.color = raw;
  if (!el.style.color) return null;
  el.hidden = true; doc.body.appendChild(el);
  const computed = doc.defaultView.getComputedStyle(el).color; el.remove();
  return computed !== raw ? validatedColor(computed) : null;
}

module.exports = class CalloutOutlinePlugin extends Plugin {
  async onload() {
    this.unloaded = false; this.refreshEpoch = 0; this.colorEpoch = 0; this.colorVersion = 0;
    this.currentState = {file:null, callouts:[], doc:null}; this.calloutManagerColors = Object.create(null);
    this.settings = {...DEFAULT_SETTINGS, colorOverrides:{}}; this.lastMarkdownView = null;
    this.currentObservedView = null; this.calloutMutationObserver = null; this.decorationFrame = null;
    this.decorateRetryTimer = null; this.mathStatus = 'cold'; this.colorCache = new WeakMap();
    const icons = typeof getIconIds === 'function' ? getIconIds() : null;
    this.iconName = icons && !icons.includes(ICON_NAME) && !icons.includes(`lucide-${ICON_NAME}`) ? 'list' : ICON_NAME;
    // Register synchronously so restored workspace leaves can resolve this type.
    this.registerView(VIEW_TYPE, leaf => new CalloutOutlineView(leaf, this));
    this.refreshView = debounce(this.refreshView.bind(this), 150, true);
    await this.loadSettings(); if (this.unloaded) return;
    await this.reloadCalloutManagerColors(); if (this.unloaded) return;
    this.addSettingTab(new CalloutOutlineSettingTab(this.app, this));
    this.addCommand({id:'open-callout-outline', name:'Open callout outline', callback:() => this.activateView()});
    this.addRibbonIcon(this.iconName, 'Open callout outline', () => this.activateView());
    const update = () => {
      if (this.unloaded) return;
      const view = this.getActiveMarkdownView(); this.observeMarkdownView(view); this.refreshView();
    };
    for (const event of ['active-leaf-change', 'file-open', 'layout-change']) this.registerEvent(this.app.workspace.on(event, update));
    this.registerEvent(this.app.workspace.on('knowledge-library:callouts-changed', () => {this.providerCache = null; update();}));
    this.registerEvent(this.app.workspace.on('editor-change', (_editor, info) => {if (info?.file?.path === this.getActiveMarkdownView()?.file?.path) this.refreshView();}));
    this.registerEvent(this.app.vault.on('modify', file => {if (file.path === this.currentState.file?.path) this.refreshView();}));
    this.registerEvent(this.app.workspace.on('css-change', async () => {await this.reloadCalloutManagerColors(); if (!this.unloaded) this.refreshView();}));
    this.app.workspace.onLayoutReady(update);
  }

  async onunload() {
    this.unloaded = true; this.refreshEpoch++; this.colorEpoch++;
    this.refreshView?.cancel?.(); this.stopObservingMarkdownView(); this.clearDecorateRetry();
    this.restoreAllRenderedCallouts();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.view?.onClose?.();
    this.lastMarkdownView = null; this.parseCache = null; this.providerCache = null; this.readingSnapshots = null;
    // Obsidian owns the leaf lifecycle; do not remove the user's sidebar tab.
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.colorOverrides = Object.fromEntries(Object.entries(this.settings.colorOverrides || {})
      .map(([type, color]) => [normalizeType(type), validatedColor(color)]).filter(([type, color]) => type && color));
  }
  async saveSettings() {await this.saveData(this.settings); this.colorVersion = (this.colorVersion || 0) + 1; this.colorCache = new WeakMap();}
  restoreAllRenderedCallouts() {for (const leaf of this.app.workspace.getLeavesOfType('markdown')) restoreDecoratedCallouts(leaf.view?.contentEl);}
  clearDecorateRetry() {if (this.decorateRetryTimer != null) window.clearTimeout(this.decorateRetryTimer); this.decorateRetryTimer = null;}
  stopObservingMarkdownView() {
    this.calloutMutationObserver?.disconnect(); this.calloutMutationObserver = null;
    if (this.decorationFrame) this.decorationFrame.win.cancelAnimationFrame(this.decorationFrame.id);
    this.decorationFrame = null; this.decorationWork = null; this.observedRoot = null;
    if (this.currentObservedView) restoreDecoratedCallouts(this.currentObservedView.contentEl);
    this.currentObservedView = null;
  }

  observeMarkdownView(view) {
    if (this.calloutProvider(view?.file)) {this.stopObservingMarkdownView(); return;}
    const root = isLivePreview(view) ? view.contentEl?.querySelector('.cm-content') : null;
    if (this.currentObservedView === view && this.observedRoot === root && this.calloutMutationObserver) return;
    this.stopObservingMarkdownView();
    if (this.unloaded || !root) return;
    this.currentObservedView = view; this.observedRoot = root;
    const win = root.ownerDocument.defaultView;
    this.calloutMutationObserver = new win.MutationObserver(records => {
      if (this.unloaded) return;
      const relevant = records.some(r => [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 &&
        (n.matches('.callout, .callout-title-inner') || n.querySelector('.callout-title-inner'))));
      if (relevant) {this.decorationWork = null; this.decorateRenderedCallouts();}
    });
    this.calloutMutationObserver.observe(root, {childList:true, subtree:true});
  }

  getActiveMarkdownView() {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active?.file) {this.lastMarkdownView = active; return active;}
    const live = this.app.workspace.getLeavesOfType('markdown').some(l => l.view === this.lastMarkdownView);
    if (live && this.lastMarkdownView?.file) return this.lastMarkdownView;
    const recent = this.app.workspace.getMostRecentLeaf?.()?.view;
    if (recent instanceof MarkdownView && recent.file) {this.lastMarkdownView = recent; return recent;}
    this.lastMarkdownView = null; return null;
  }

  calloutProvider(file) {
    if (!file) return null;
    for (const id of ['knowledge-library', 'knowledge-library-lab']) {
      const api = this.app.plugins?.plugins?.[id]?.calloutAPI;
      if (api?.version !== 1 || typeof api.decoratesTitles !== 'function' || typeof api.getCallouts !== 'function') continue;
      const capability = api.decoratesTitles(file);
      if (capability === 'yes' || capability === 'pending') return api;
    }
    return null;
  }

  async getActiveMarkdownState() {
    const view = this.getActiveMarkdownView();
    if (!view?.file) return {file:null, callouts:[], doc:null, view:null};
    const file = view.file, doc = view.getMode?.() === 'source' ? view.editor?.cm?.state.doc : null;
    const provider = this.calloutProvider(file), providerRevision = provider?.revision?.();
    let text;
    const readText = () => text ??= doc ? view.editor.getValue() :
      typeof view.getViewData === 'function' ? view.getViewData() : this.app.vault.cachedRead(file);
    if (provider) {
      this.stopObservingMarkdownView();
      if (provider.decoratesTitles(file) === 'pending') return {file,doc,view,provider,providerRevision,callouts:[],issue:'Waiting for reference numbering…'};
      const cached = this.providerCache;
      if (cached?.provider === provider && (!cached.expiresAt || cached.expiresAt > Date.now()) && cached.revision === providerRevision && cached.file === file &&
          (doc ? cached.doc === doc : cached.text === await readText())) {
        const state = await cached.promise;
        return state.view === view ? state : {...state,view};
      }
      this.readingSnapshots ||= new WeakMap();
      let snapshot = doc;
      if (!snapshot) {
        text = await readText();
        const last = this.readingSnapshots.get(view);
        snapshot = last?.text === text ? last.doc : {};
        this.readingSnapshots.set(view,{text,doc:snapshot});
      }
      const base = {file,doc,view,provider,providerRevision,readingText:doc ? undefined : text};
      const promise = provider.getCallouts({file,doc:snapshot,text:readText}).then(
        result => ({...base,callouts:result.callouts}),
        error => ({...base,callouts:[],retryable:error.retryable !== false,issue:`Callout references unavailable: ${error.message || error}`}));
      const record = {provider,revision:providerRevision,file,doc,text,promise};
      this.providerCache = record;
      const state = await promise;
      // Permanent failures stay until the snapshot/provider changes. Transient
      // errors may recover on a later interaction, without a background poller.
      if (state.issue && state.retryable) record.expiresAt = Date.now() + 3000;
      return state;
    }
    this.providerCache = null;
    text = await readText();
    if (this.parseCache?.path === file.path && this.parseCache.text === text) {
      const cached = this.parseCache.state;
      return this.parseCache.state = cached.view === view && cached.doc === doc ? cached : {...cached, view, doc};
    }
    const state = {file, doc, view, callouts:parseCallouts(text)};
    this.parseCache = {path:file.path, text, state}; return state;
  }

  async refreshView() {
    if (this.unloaded) return;
    const epoch = this.refreshEpoch = (this.refreshEpoch || 0) + 1, state = await this.getActiveMarkdownState();
    if (this.unloaded || epoch !== this.refreshEpoch || state.view?.file?.path !== state.file?.path ||
        (state.doc && state.doc !== state.view.editor?.cm?.state.doc) ||
        (state.provider || null) !== this.calloutProvider(state.file) ||
        (state.provider && state.providerRevision !== state.provider.revision?.()) ||
        (state.readingText !== undefined && typeof state.view.getViewData === 'function' && state.readingText !== state.view.getViewData())) return;
    if (this.currentState !== state) this.decorationWork = null;
    this.currentState = state;
    this.observeMarkdownView(state.view);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.view?.render?.();
    this.decorateRenderedCallouts();
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = existing || this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    if (!existing) await leaf.setViewState({type:VIEW_TYPE, active:true});
    this.app.workspace.revealLeaf(leaf); this.refreshView();
  }

  async reloadCalloutManagerColors() {
    const epoch = this.colorEpoch = (this.colorEpoch || 0) + 1;
    let colors = Object.create(null);
    for (const id of ['callout-manager-managed', 'callout-manager']) {
      const provider = this.app.plugins?.plugins?.[id];
      if (!provider) continue;
      try {
        const data = provider.settings || JSON.parse(await this.app.vault.adapter.read(`${this.app.vault.configDir}/plugins/${id}/data.json`));
        colors = parseCalloutManagerColors(data, document.body.classList.contains('theme-dark')); break;
      } catch (error) {console.warn('Callout Outline: color provider unavailable', error);}
    }
    if (this.unloaded || epoch !== this.colorEpoch) return;
    this.calloutManagerColors = colors; this.colorVersion = (this.colorVersion || 0) + 1; this.colorCache = new WeakMap();
  }

  getCountsForCallouts(callouts) {const counts = Object.create(null); for (const c of callouts) counts[c.type] = (counts[c.type] || 0) + 1; return counts;}
  getKnownCalloutTypes() {return [...new Set([...Object.keys(this.calloutManagerColors || {}), ...Object.keys(this.settings.colorOverrides || {}), ...this.currentState.callouts.map(c => c.type)])].sort();}
  getTypeColor(type, doc = document) {
    const normalized = normalizeType(type), override = validatedColor(this.settings.colorOverrides?.[normalized]);
    if (override) return override;
    if (!this.settings.inheritCalloutManagerColors) return fallbackColorForType(normalized);
    this.colorCache ||= new WeakMap(); let cache = this.colorCache.get(doc); if (!cache) {cache = new Map(); this.colorCache.set(doc, cache);}
    if (cache.has(normalized)) return cache.get(normalized);
    const wrapper = doc.createElement('div'); wrapper.className = 'markdown-rendered'; wrapper.hidden = true; wrapper.setAttribute('aria-hidden', 'true');
    const probe = doc.createElement('div'); probe.className = 'callout'; probe.dataset.callout = normalized; wrapper.appendChild(probe); doc.body.appendChild(wrapper);
    const raw = doc.defaultView.getComputedStyle(probe).getPropertyValue('--callout-color');
    const color = validatedColor(raw, doc) || this.calloutManagerColors?.[normalized] || fallbackColorForType(normalized); wrapper.remove();
    cache.set(normalized, color); return color;
  }

  scheduleMathReload() {
    if (this.unloaded || (this.mathStatus && this.mathStatus !== 'cold')) return;
    this.mathStatus = 'loading';
    Promise.resolve().then(() => loadMathJax()).then(() => {
      this.mathStatus = 'ready'; if (!this.unloaded) this.refreshView();
    }, () => {this.mathStatus = 'failed';});
  }

  decorateRenderedCallouts() {
    if (this.unloaded || this.decorationFrame) return;
    const view = this.getActiveMarkdownView(), state = this.currentState;
    if (this.calloutProvider(view?.file)) {this.stopObservingMarkdownView(); return;}
    if (!isLivePreview(view) || !view.contentEl?.querySelector('.cm-content') || view.file?.path !== state.file?.path || state.doc !== view.editor?.cm?.state.doc) return;
    const win = view.contentEl.ownerDocument.defaultView;
    this.decorationFrame = {win, id:win.requestAnimationFrame(() => {
      this.decorationFrame = null;
      if (this.unloaded || this.calloutProvider(view?.file)) return;
      if (!view.contentEl?.querySelector('.cm-content')) return;
      if (!isLivePreview(view) || this.getActiveMarkdownView() !== view || this.currentState !== state || state.doc !== view.editor?.cm?.state.doc) {
        this.decorateRenderedCallouts(); return;
      }
      let work = this.decorationWork;
      if (!work || work.view !== view || work.state !== state) {
        const entries = getRenderedCalloutEntries(view, state.callouts), mapped = new Set(entries.map(e => e.titleEl));
        for (const title of view.contentEl.querySelector('.cm-content').querySelectorAll('.callout-title-inner')) if (!mapped.has(title)) for (const attr of DECORATION_ATTRIBUTES) title.removeAttribute(attr);
        work = this.decorationWork = {view, state, entries, index:0};
      }
      const start = win.performance.now(); let processed = 0;
      while (work.index < work.entries.length && processed < 200 && win.performance.now() - start < 4) {
        const {titleEl, callout:c} = work.entries[work.index++]; processed++;
        const prefix = !this.settings.decorateRenderedCallouts || c.isManual || c.authoredNumber || !c.rawTitle ? '' : `${c.displayType} ${c.number}: `;
        const suffix = this.settings.decorateRenderedCallouts && !c.isManual && !c.rawTitle ? ` ${c.number}` : '';
        const mismatch = this.settings.decorateRenderedCallouts && c.titleMismatch ? `Outline number: ${c.displayType} ${c.number}. Authored title retained.` : '';
        for (const [attr, value] of [[DECORATION_ATTRIBUTES[0], prefix], [DECORATION_ATTRIBUTES[1], suffix], [DECORATION_ATTRIBUTES[2], mismatch]]) {
          if (value) {if (titleEl.getAttribute(attr) !== value) titleEl.setAttribute(attr, value);} else if (titleEl.hasAttribute(attr)) titleEl.removeAttribute(attr);
        }
      }
      if (work.index < work.entries.length) this.decorateRenderedCallouts(); else this.decorationWork = null;
    })};
  }

  jumpToCallout(callout) {
    const view = this.getActiveMarkdownView();
    if (!view?.file || view.file.path !== this.currentState.file?.path) {new Notice('Open the source note to jump to this callout.'); return;}
    if ((this.currentState.doc && this.currentState.doc !== view.editor?.cm?.state.doc) ||
        (this.currentState.provider && this.currentState.providerRevision !== this.currentState.provider.revision?.()) ||
        (this.currentState.readingText !== undefined && typeof view.getViewData === 'function' && this.currentState.readingText !== view.getViewData())) {
      this.refreshView(); new Notice('The callout outline is updating. Try this callout again in a moment.'); return;
    }
    view.setEphemeralState({line:callout.line});
  }
};
