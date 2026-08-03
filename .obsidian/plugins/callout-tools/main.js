const { Plugin, Notice, MarkdownView } = require("obsidian");

const HEADER_RE = /^(\s*)((?:>\s*)+)\[!([^\]\s]+)\]([+-])?(?:\s+(.*))?$/;
const QUOTE_PREFIX_RE = /^(\s*)((?:>\s*)+)(.*)$/;
const FENCE_RE = /^(?:```+|~~~+)/;
const FIGURE_PREFIX_RE = /^Figure\s+(\d+)(?:(?:\(([A-Za-z])\))|(?:\.([A-Za-z]))|(?:([A-Za-z])))?(?:\s*[:.-]\s*(.*)|\s+(.*)|$)/i;

function quoteDepth(prefix) {
  return (prefix.match(/>/g) || []).length;
}

function normalizeType(type) {
  return String(type || "").trim().toLowerCase();
}

function collapseWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function buildQuotePrefix(indent, depth) {
  if (depth <= 0) {
    return indent;
  }
  return indent + "> ".repeat(depth);
}

function unwrapOneQuoteLevel(line) {
  const match = line.match(QUOTE_PREFIX_RE);
  if (!match) {
    return line;
  }

  const [, indent, prefix, rest] = match;
  const depth = quoteDepth(prefix);
  if (depth <= 0) {
    return line;
  }

  return buildQuotePrefix(indent, depth - 1) + rest;
}

function findCalloutAtLine(editor, lineNumber) {
  if (lineNumber < 0 || lineNumber >= editor.lineCount()) {
    return null;
  }

  const line = editor.getLine(lineNumber);
  if (!QUOTE_PREFIX_RE.test(line)) {
    return null;
  }

  let regionStart = lineNumber;
  let regionEnd = lineNumber;

  while (regionStart > 0 && QUOTE_PREFIX_RE.test(editor.getLine(regionStart - 1))) {
    regionStart -= 1;
  }
  while (regionEnd + 1 < editor.lineCount() && QUOTE_PREFIX_RE.test(editor.getLine(regionEnd + 1))) {
    regionEnd += 1;
  }

  let headerLine = -1;
  let headerDepth = -1;
  let headerMatch = null;

  for (let lineIndex = lineNumber; lineIndex >= regionStart; lineIndex -= 1) {
    const match = editor.getLine(lineIndex).match(HEADER_RE);
    if (!match) {
      continue;
    }

    headerLine = lineIndex;
    headerDepth = quoteDepth(match[2]);
    headerMatch = match;
    break;
  }

  if (headerLine === -1 || !headerMatch) {
    return null;
  }

  let endLine = headerLine;
  while (endLine + 1 < editor.lineCount()) {
    const nextLine = editor.getLine(endLine + 1);
    const quoteMatch = nextLine.match(QUOTE_PREFIX_RE);
    if (!quoteMatch) {
      break;
    }

    if (quoteDepth(quoteMatch[2]) < headerDepth) {
      break;
    }

    endLine += 1;
  }

  return { headerLine, endLine, headerDepth, headerMatch };
}

function normalizeUnwrappedHeader(headerMatch) {
  const indent = headerMatch[1];
  const depth = quoteDepth(headerMatch[2]);
  const title = headerMatch[5] || "";
  const remainingPrefix = buildQuotePrefix(indent, depth - 1);

  if (!title) {
    return null;
  }

  return remainingPrefix + title;
}

function unwrapCalloutLines(lines) {
  if (lines.length === 0) {
    return lines;
  }

  const headerMatch = lines[0].match(HEADER_RE);
  if (!headerMatch) {
    return lines;
  }

  const out = [];
  const newHeader = normalizeUnwrappedHeader(headerMatch);
  if (newHeader !== null) {
    out.push(newHeader);
  }

  for (let i = 1; i < lines.length; i += 1) {
    out.push(unwrapOneQuoteLevel(lines[i]));
  }

  return out;
}

function rewriteHeaderWithTitle(headerMatch, title) {
  const indent = headerMatch[1];
  const prefix = headerMatch[2];
  const type = headerMatch[3];
  const fold = headerMatch[4] || "";
  return `${indent}${prefix}[!${type}]${fold} ${title}`;
}

function parseFigureTitle(title) {
  const cleanTitle = collapseWhitespace(title);
  if (!cleanTitle) {
    return { numberedSuffix: "", suffixText: "" };
  }

  const match = cleanTitle.match(FIGURE_PREFIX_RE);
  if (!match) {
    return { numberedSuffix: "", suffixText: cleanTitle };
  }

  const letter = match[2] || match[3] || match[4] || "";
  return {
    numberedSuffix: letter ? `(${letter})` : "",
    suffixText: collapseWhitespace(match[5] || match[6] || ""),
  };
}

function buildFigureHeader(headerMatch, number) {
  const figureInfo = parseFigureTitle(headerMatch[5] || "");
  const label = `Figure ${number}${figureInfo.numberedSuffix}`;
  const title = figureInfo.suffixText ? `${label}: ${figureInfo.suffixText}` : label;
  return rewriteHeaderWithTitle(headerMatch, title);
}

function renumberFigureCalloutHeaders(lines) {
  const out = [...lines];
  const fenceDepths = [];
  let figureCount = 0;
  let changedCount = 0;

  for (let lineNumber = 0; lineNumber < out.length; lineNumber += 1) {
    const line = out[lineNumber];
    const quoteMatch = line.match(QUOTE_PREFIX_RE);
    const depth = quoteMatch ? quoteDepth(quoteMatch[2]) : 0;

    while (fenceDepths.length && fenceDepths[fenceDepths.length - 1] > depth) {
      fenceDepths.pop();
    }

    if (!quoteMatch) {
      continue;
    }

    const body = quoteMatch[3].replace(/^\s+/, "");
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
    if (!headerMatch || normalizeType(headerMatch[3]) !== "figure") {
      continue;
    }

    figureCount += 1;
    const rewritten = buildFigureHeader(headerMatch, figureCount);
    if (rewritten !== line) {
      out[lineNumber] = rewritten;
      changedCount += 1;
    }
  }

  return {
    lines: out,
    figureCount,
    changedCount,
  };
}

function promoteFirstLineToTitle(lines) {
  if (lines.length === 0) {
    return { ok: false, reason: "Empty callout." };
  }

  const headerMatch = lines[0].match(HEADER_RE);
  if (!headerMatch) {
    return { ok: false, reason: "No callout header found." };
  }

  const existingTitle = (headerMatch[5] || "").trim();
  if (existingTitle) {
    return { ok: false, reason: "Callout already has a title." };
  }

  let titleIndex = -1;
  let promotedTitle = "";

  for (let i = 1; i < lines.length; i += 1) {
    const unwrapped = unwrapOneQuoteLevel(lines[i]);
    const trimmed = unwrapped.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith(">") || FENCE_RE.test(trimmed) || trimmed === "$$") {
      return { ok: false, reason: "First non-empty content line is not suitable for a title." };
    }

    titleIndex = i;
    promotedTitle = trimmed;
    break;
  }

  if (titleIndex === -1) {
    return { ok: false, reason: "No non-empty content line found to promote." };
  }

  const out = [];
  out.push(rewriteHeaderWithTitle(headerMatch, promotedTitle));

  const remaining = lines.slice(1, titleIndex).concat(lines.slice(titleIndex + 1));
  if (remaining.length > 0) {
    const firstRemaining = unwrapOneQuoteLevel(remaining[0]).trim();
    if (firstRemaining !== "") {
      out.push(buildQuotePrefix(headerMatch[1], quoteDepth(headerMatch[2])));
    }
  }

  out.push(...remaining);
  return { ok: true, lines: out };
}

function getLineIndent(editor, lineNumber) {
  const line = editor.getLine(lineNumber) || "";
  const match = line.match(/^\s*/);
  return match ? match[0] : "";
}

function buildCalloutLines(type, text, indent = "") {
  const header = `${indent}> [!${type}]`;
  const normalizedText = String(text || "").replace(/\r\n/g, "\n");

  if (!normalizedText) {
    return [header, `${indent}> `];
  }

  const bodyLines = normalizedText.split("\n").map((line) => `${indent}> ${line}`);
  return [header, ...bodyLines];
}

module.exports = class CalloutToolsPlugin extends Plugin {
  onload() {
    this.addCommand({
      id: "insert-exercise-callout",
      name: "Insert exercise callout",
      editorCallback: (editor, view) => this.insertExerciseCallout(editor, view),
    });

    this.addCommand({
      id: "unwrap-current-callout",
      name: "Remove current callout wrapper",
      editorCallback: (editor, view) => this.unwrapCurrentCallout(editor, view),
    });

    this.addCommand({
      id: "promote-callout-first-line-to-title",
      name: "Move first callout line to title",
      editorCallback: (editor, view) => this.promoteCalloutFirstLineToTitle(editor, view),
    });

    this.addCommand({
      id: "number-figure-callouts",
      name: "Number figure callouts",
      editorCallback: (editor, view) => this.numberFigureCallouts(editor, view),
    });
  }

  unwrapCurrentCallout(editor, view) {
    if (!(view instanceof MarkdownView)) {
      new Notice("Open a Markdown note to use this command.");
      return;
    }

    const from = editor.getCursor("from").line;
    const to = editor.getCursor("to").line;

    let callout = null;
    for (let line = from; line <= to; line += 1) {
      callout = findCalloutAtLine(editor, line);
      if (callout) {
        break;
      }
    }

    if (!callout) {
      callout = findCalloutAtLine(editor, from);
    }

    if (!callout) {
      new Notice("No callout found at the cursor.");
      return;
    }

    const originalLines = [];
    for (let line = callout.headerLine; line <= callout.endLine; line += 1) {
      originalLines.push(editor.getLine(line));
    }

    const unwrappedLines = unwrapCalloutLines(originalLines);
    const replacement = unwrappedLines.join("\n");

    editor.replaceRange(
      replacement,
      { line: callout.headerLine, ch: 0 },
      { line: callout.endLine, ch: editor.getLine(callout.endLine).length }
    );

    new Notice("Callout wrapper removed.");
  }

  getCurrentCallout(editor, view) {
    if (!(view instanceof MarkdownView)) {
      new Notice("Open a Markdown note to use this command.");
      return null;
    }

    const from = editor.getCursor("from").line;
    const to = editor.getCursor("to").line;

    let callout = null;
    for (let line = from; line <= to; line += 1) {
      callout = findCalloutAtLine(editor, line);
      if (callout) {
        break;
      }
    }

    if (!callout) {
      callout = findCalloutAtLine(editor, from);
    }

    if (!callout) {
      new Notice("No callout found at the cursor.");
      return null;
    }

    return callout;
  }

  replaceCallout(editor, callout, replacementLines) {
    const replacement = replacementLines.join("\n");
    editor.replaceRange(
      replacement,
      { line: callout.headerLine, ch: 0 },
      { line: callout.endLine, ch: editor.getLine(callout.endLine).length }
    );
  }

  insertExerciseCallout(editor, view) {
    if (!(view instanceof MarkdownView)) {
      new Notice("Open a Markdown note to use this command.");
      return;
    }

    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const indent = getLineIndent(editor, from.line);
    const selectedText = editor.getSelection();
    const lineEnding = editor.getValue().includes("\r\n") ? "\r\n" : "\n";

    if (selectedText) {
      const replacement = buildCalloutLines("exercise", selectedText, indent).join(lineEnding);
      editor.replaceSelection(replacement);
      new Notice("Exercise callout inserted.");
      return;
    }

    const replacementLines = buildCalloutLines("exercise", "", indent);
    const replacement = replacementLines.join(lineEnding);
    editor.replaceRange(replacement, from, to);
    editor.setCursor({ line: from.line + 1, ch: indent.length + 2 });
    new Notice("Exercise callout inserted.");
  }

  promoteCalloutFirstLineToTitle(editor, view) {
    const callout = this.getCurrentCallout(editor, view);
    if (!callout) {
      return;
    }

    const originalLines = [];
    for (let line = callout.headerLine; line <= callout.endLine; line += 1) {
      originalLines.push(editor.getLine(line));
    }

    const result = promoteFirstLineToTitle(originalLines);
    if (!result.ok) {
      new Notice(result.reason);
      return;
    }

    this.replaceCallout(editor, callout, result.lines);
    new Notice("Callout title updated.");
  }

  numberFigureCallouts(editor, view) {
    if (!(view instanceof MarkdownView)) {
      new Notice("Open a Markdown note to use this command.");
      return;
    }

    const originalText = editor.getValue();
    const lineEnding = originalText.includes("\r\n") ? "\r\n" : "\n";
    const lines = originalText.split(/\r?\n/);
    const result = renumberFigureCalloutHeaders(lines);

    if (result.figureCount === 0) {
      new Notice("No figure callouts found in this note.");
      return;
    }

    if (result.changedCount === 0) {
      new Notice(`Figure callouts already numbered (found ${result.figureCount}).`);
      return;
    }

    editor.setValue(result.lines.join(lineEnding));
    new Notice(`Renumbered ${result.figureCount} figure callouts.`);
  }
};
