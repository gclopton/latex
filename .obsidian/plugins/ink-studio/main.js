"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => InkStudio
});
module.exports = __toCommonJS(main_exports);

// src/menu-groups.ts
var import_obsidian = require("obsidian");
function menuGroup(menu, key, title, icon, section = key === "insert" ? "insert" : key === "annotation-visibility" ? "view" : key.startsWith("mark-") ? "selection" : "action") {
  menu.setUseNativeMenu(false);
  const symbol = Symbol.for("research-studio.menu." + key), host = menu;
  if (host[symbol]) return host[symbol];
  let child;
  menu.addItem((item) => {
    item.setTitle(title).setIcon(icon).setSection(section);
    const native = item;
    if (typeof native.setSubmenu === "function") child = native.setSubmenu();
    else {
      child = new import_obsidian.Menu();
      item.onClick((event) => {
        const target = event.target, box = target?.getBoundingClientRect();
        child.showAtPosition({ x: box?.right ?? 100, y: box?.top ?? 100 });
      });
    }
  });
  host[symbol] = child;
  return child;
}

// src/annotation.ts
var import_obsidian2 = require("obsidian");

// node_modules/html-to-image/es/util.js
function resolveUrl(url, baseUrl) {
  if (url.match(/^[a-z]+:\/\//i)) {
    return url;
  }
  if (url.match(/^\/\//)) {
    return window.location.protocol + url;
  }
  if (url.match(/^[a-z]+:/i)) {
    return url;
  }
  const doc = document.implementation.createHTMLDocument();
  const base = doc.createElement("base");
  const a = doc.createElement("a");
  doc.head.appendChild(base);
  doc.body.appendChild(a);
  if (baseUrl) {
    base.href = baseUrl;
  }
  a.href = url;
  return a.href;
}
var uuid = /* @__PURE__ */ (() => {
  let counter = 0;
  const random = () => (
    // eslint-disable-next-line no-bitwise
    `0000${(Math.random() * 36 ** 4 << 0).toString(36)}`.slice(-4)
  );
  return () => {
    counter += 1;
    return `u${random()}${counter}`;
  };
})();
function toArray(arrayLike) {
  const arr = [];
  for (let i = 0, l = arrayLike.length; i < l; i++) {
    arr.push(arrayLike[i]);
  }
  return arr;
}
var styleProps = null;
function getStyleProperties(options = {}) {
  if (styleProps) {
    return styleProps;
  }
  if (options.includeStyleProperties) {
    styleProps = options.includeStyleProperties;
    return styleProps;
  }
  styleProps = toArray(window.getComputedStyle(document.documentElement));
  return styleProps;
}
function px(node, styleProperty) {
  const win = node.ownerDocument.defaultView || window;
  const val = win.getComputedStyle(node).getPropertyValue(styleProperty);
  return val ? parseFloat(val.replace("px", "")) : 0;
}
function getNodeWidth(node) {
  const leftBorder = px(node, "border-left-width");
  const rightBorder = px(node, "border-right-width");
  return node.clientWidth + leftBorder + rightBorder;
}
function getNodeHeight(node) {
  const topBorder = px(node, "border-top-width");
  const bottomBorder = px(node, "border-bottom-width");
  return node.clientHeight + topBorder + bottomBorder;
}
function getImageSize(targetNode, options = {}) {
  const width = options.width || getNodeWidth(targetNode);
  const height = options.height || getNodeHeight(targetNode);
  return { width, height };
}
function getPixelRatio() {
  let ratio;
  let FINAL_PROCESS;
  try {
    FINAL_PROCESS = process;
  } catch (e) {
  }
  const val = FINAL_PROCESS && FINAL_PROCESS.env ? FINAL_PROCESS.env.devicePixelRatio : null;
  if (val) {
    ratio = parseInt(val, 10);
    if (Number.isNaN(ratio)) {
      ratio = 1;
    }
  }
  return ratio || window.devicePixelRatio || 1;
}
var canvasDimensionLimit = 16384;
function checkCanvasDimensions(canvas) {
  if (canvas.width > canvasDimensionLimit || canvas.height > canvasDimensionLimit) {
    if (canvas.width > canvasDimensionLimit && canvas.height > canvasDimensionLimit) {
      if (canvas.width > canvas.height) {
        canvas.height *= canvasDimensionLimit / canvas.width;
        canvas.width = canvasDimensionLimit;
      } else {
        canvas.width *= canvasDimensionLimit / canvas.height;
        canvas.height = canvasDimensionLimit;
      }
    } else if (canvas.width > canvasDimensionLimit) {
      canvas.height *= canvasDimensionLimit / canvas.width;
      canvas.width = canvasDimensionLimit;
    } else {
      canvas.width *= canvasDimensionLimit / canvas.height;
      canvas.height = canvasDimensionLimit;
    }
  }
}
function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      img.decode().then(() => {
        requestAnimationFrame(() => resolve(img));
      });
    };
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
  });
}
async function svgToDataURL(svg) {
  return Promise.resolve().then(() => new XMLSerializer().serializeToString(svg)).then(encodeURIComponent).then((html) => `data:image/svg+xml;charset=utf-8,${html}`);
}
async function nodeToDataURL(node, width, height) {
  const xmlns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(xmlns, "svg");
  const foreignObject = document.createElementNS(xmlns, "foreignObject");
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  foreignObject.setAttribute("width", "100%");
  foreignObject.setAttribute("height", "100%");
  foreignObject.setAttribute("x", "0");
  foreignObject.setAttribute("y", "0");
  foreignObject.setAttribute("externalResourcesRequired", "true");
  svg.appendChild(foreignObject);
  foreignObject.appendChild(node);
  return svgToDataURL(svg);
}
var isInstanceOfElement = (node, instance) => {
  if (node instanceof instance)
    return true;
  const nodePrototype = Object.getPrototypeOf(node);
  if (nodePrototype === null)
    return false;
  return nodePrototype.constructor.name === instance.name || isInstanceOfElement(nodePrototype, instance);
};

// node_modules/html-to-image/es/clone-pseudos.js
function formatCSSText(style) {
  const content = style.getPropertyValue("content");
  return `${style.cssText} content: '${content.replace(/'|"/g, "")}';`;
}
function formatCSSProperties(style, options) {
  return getStyleProperties(options).map((name) => {
    const value = style.getPropertyValue(name);
    const priority = style.getPropertyPriority(name);
    return `${name}: ${value}${priority ? " !important" : ""};`;
  }).join(" ");
}
function getPseudoElementStyle(className, pseudo, style, options) {
  const selector = `.${className}:${pseudo}`;
  const cssText = style.cssText ? formatCSSText(style) : formatCSSProperties(style, options);
  return document.createTextNode(`${selector}{${cssText}}`);
}
function clonePseudoElement(nativeNode, clonedNode, pseudo, options) {
  const style = window.getComputedStyle(nativeNode, pseudo);
  const content = style.getPropertyValue("content");
  if (content === "" || content === "none") {
    return;
  }
  const className = uuid();
  try {
    clonedNode.className = `${clonedNode.className} ${className}`;
  } catch (err) {
    return;
  }
  const styleElement = document.createElement("style");
  styleElement.appendChild(getPseudoElementStyle(className, pseudo, style, options));
  clonedNode.appendChild(styleElement);
}
function clonePseudoElements(nativeNode, clonedNode, options) {
  clonePseudoElement(nativeNode, clonedNode, ":before", options);
  clonePseudoElement(nativeNode, clonedNode, ":after", options);
}

// node_modules/html-to-image/es/mimes.js
var WOFF = "application/font-woff";
var JPEG = "image/jpeg";
var mimes = {
  woff: WOFF,
  woff2: WOFF,
  ttf: "application/font-truetype",
  eot: "application/vnd.ms-fontobject",
  png: "image/png",
  jpg: JPEG,
  jpeg: JPEG,
  gif: "image/gif",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  webp: "image/webp"
};
function getExtension(url) {
  const match = /\.([^./]*?)$/g.exec(url);
  return match ? match[1] : "";
}
function getMimeType(url) {
  const extension = getExtension(url).toLowerCase();
  return mimes[extension] || "";
}

// node_modules/html-to-image/es/dataurl.js
function getContentFromDataUrl(dataURL) {
  return dataURL.split(/,/)[1];
}
function isDataUrl(url) {
  return url.search(/^(data:)/) !== -1;
}
function makeDataUrl(content, mimeType) {
  return `data:${mimeType};base64,${content}`;
}
async function fetchAsDataURL(url, init, process2) {
  const res = await fetch(url, init);
  if (res.status === 404) {
    throw new Error(`Resource "${res.url}" not found`);
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
      try {
        resolve(process2({ res, result: reader.result }));
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsDataURL(blob);
  });
}
var cache = {};
function getCacheKey(url, contentType, includeQueryParams) {
  let key = url.replace(/\?.*/, "");
  if (includeQueryParams) {
    key = url;
  }
  if (/ttf|otf|eot|woff2?/i.test(key)) {
    key = key.replace(/.*\//, "");
  }
  return contentType ? `[${contentType}]${key}` : key;
}
async function resourceToDataURL(resourceUrl, contentType, options) {
  const cacheKey = getCacheKey(resourceUrl, contentType, options.includeQueryParams);
  if (cache[cacheKey] != null) {
    return cache[cacheKey];
  }
  if (options.cacheBust) {
    resourceUrl += (/\?/.test(resourceUrl) ? "&" : "?") + (/* @__PURE__ */ new Date()).getTime();
  }
  let dataURL;
  try {
    const content = await fetchAsDataURL(resourceUrl, options.fetchRequestInit, ({ res, result }) => {
      if (!contentType) {
        contentType = res.headers.get("Content-Type") || "";
      }
      return getContentFromDataUrl(result);
    });
    dataURL = makeDataUrl(content, contentType);
  } catch (error) {
    dataURL = options.imagePlaceholder || "";
    let msg = `Failed to fetch resource: ${resourceUrl}`;
    if (error) {
      msg = typeof error === "string" ? error : error.message;
    }
    if (msg) {
      console.warn(msg);
    }
  }
  cache[cacheKey] = dataURL;
  return dataURL;
}

// node_modules/html-to-image/es/clone-node.js
async function cloneCanvasElement(canvas) {
  const dataURL = canvas.toDataURL();
  if (dataURL === "data:,") {
    return canvas.cloneNode(false);
  }
  return createImage(dataURL);
}
async function cloneVideoElement(video, options) {
  if (video.currentSrc) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx === null || ctx === void 0 ? void 0 : ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataURL2 = canvas.toDataURL();
    return createImage(dataURL2);
  }
  const poster = video.poster;
  const contentType = getMimeType(poster);
  const dataURL = await resourceToDataURL(poster, contentType, options);
  return createImage(dataURL);
}
async function cloneIFrameElement(iframe, options) {
  var _a;
  try {
    if ((_a = iframe === null || iframe === void 0 ? void 0 : iframe.contentDocument) === null || _a === void 0 ? void 0 : _a.body) {
      return await cloneNode(iframe.contentDocument.body, options, true);
    }
  } catch (_b) {
  }
  return iframe.cloneNode(false);
}
async function cloneSingleNode(node, options) {
  if (isInstanceOfElement(node, HTMLCanvasElement)) {
    return cloneCanvasElement(node);
  }
  if (isInstanceOfElement(node, HTMLVideoElement)) {
    return cloneVideoElement(node, options);
  }
  if (isInstanceOfElement(node, HTMLIFrameElement)) {
    return cloneIFrameElement(node, options);
  }
  return node.cloneNode(isSVGElement(node));
}
var isSlotElement = (node) => node.tagName != null && node.tagName.toUpperCase() === "SLOT";
var isSVGElement = (node) => node.tagName != null && node.tagName.toUpperCase() === "SVG";
async function cloneChildren(nativeNode, clonedNode, options) {
  var _a, _b;
  if (isSVGElement(clonedNode)) {
    return clonedNode;
  }
  let children = [];
  if (isSlotElement(nativeNode) && nativeNode.assignedNodes) {
    children = toArray(nativeNode.assignedNodes());
  } else if (isInstanceOfElement(nativeNode, HTMLIFrameElement) && ((_a = nativeNode.contentDocument) === null || _a === void 0 ? void 0 : _a.body)) {
    children = toArray(nativeNode.contentDocument.body.childNodes);
  } else {
    children = toArray(((_b = nativeNode.shadowRoot) !== null && _b !== void 0 ? _b : nativeNode).childNodes);
  }
  if (children.length === 0 || isInstanceOfElement(nativeNode, HTMLVideoElement)) {
    return clonedNode;
  }
  await children.reduce((deferred, child) => deferred.then(() => cloneNode(child, options)).then((clonedChild) => {
    if (clonedChild) {
      clonedNode.appendChild(clonedChild);
    }
  }), Promise.resolve());
  return clonedNode;
}
function cloneCSSStyle(nativeNode, clonedNode, options) {
  const targetStyle = clonedNode.style;
  if (!targetStyle) {
    return;
  }
  const sourceStyle = window.getComputedStyle(nativeNode);
  if (sourceStyle.cssText) {
    targetStyle.cssText = sourceStyle.cssText;
    targetStyle.transformOrigin = sourceStyle.transformOrigin;
  } else {
    getStyleProperties(options).forEach((name) => {
      let value = sourceStyle.getPropertyValue(name);
      if (name === "font-size" && value.endsWith("px")) {
        const reducedFont = Math.floor(parseFloat(value.substring(0, value.length - 2))) - 0.1;
        value = `${reducedFont}px`;
      }
      if (isInstanceOfElement(nativeNode, HTMLIFrameElement) && name === "display" && value === "inline") {
        value = "block";
      }
      if (name === "d" && clonedNode.getAttribute("d")) {
        value = `path(${clonedNode.getAttribute("d")})`;
      }
      targetStyle.setProperty(name, value, sourceStyle.getPropertyPriority(name));
    });
  }
}
function cloneInputValue(nativeNode, clonedNode) {
  if (isInstanceOfElement(nativeNode, HTMLTextAreaElement)) {
    clonedNode.innerHTML = nativeNode.value;
  }
  if (isInstanceOfElement(nativeNode, HTMLInputElement)) {
    clonedNode.setAttribute("value", nativeNode.value);
  }
}
function cloneSelectValue(nativeNode, clonedNode) {
  if (isInstanceOfElement(nativeNode, HTMLSelectElement)) {
    const clonedSelect = clonedNode;
    const selectedOption = Array.from(clonedSelect.children).find((child) => nativeNode.value === child.getAttribute("value"));
    if (selectedOption) {
      selectedOption.setAttribute("selected", "");
    }
  }
}
function decorate(nativeNode, clonedNode, options) {
  if (isInstanceOfElement(clonedNode, Element)) {
    cloneCSSStyle(nativeNode, clonedNode, options);
    clonePseudoElements(nativeNode, clonedNode, options);
    cloneInputValue(nativeNode, clonedNode);
    cloneSelectValue(nativeNode, clonedNode);
  }
  return clonedNode;
}
async function ensureSVGSymbols(clone, options) {
  const uses = clone.querySelectorAll ? clone.querySelectorAll("use") : [];
  if (uses.length === 0) {
    return clone;
  }
  const processedDefs = {};
  for (let i = 0; i < uses.length; i++) {
    const use = uses[i];
    const id = use.getAttribute("xlink:href");
    if (id) {
      const exist = clone.querySelector(id);
      const definition = document.querySelector(id);
      if (!exist && definition && !processedDefs[id]) {
        processedDefs[id] = await cloneNode(definition, options, true);
      }
    }
  }
  const nodes = Object.values(processedDefs);
  if (nodes.length) {
    const ns = "http://www.w3.org/1999/xhtml";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("xmlns", ns);
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.overflow = "hidden";
    svg.style.display = "none";
    const defs = document.createElementNS(ns, "defs");
    svg.appendChild(defs);
    for (let i = 0; i < nodes.length; i++) {
      defs.appendChild(nodes[i]);
    }
    clone.appendChild(svg);
  }
  return clone;
}
async function cloneNode(node, options, isRoot) {
  if (!isRoot && options.filter && !options.filter(node)) {
    return null;
  }
  return Promise.resolve(node).then((clonedNode) => cloneSingleNode(clonedNode, options)).then((clonedNode) => cloneChildren(node, clonedNode, options)).then((clonedNode) => decorate(node, clonedNode, options)).then((clonedNode) => ensureSVGSymbols(clonedNode, options));
}

// node_modules/html-to-image/es/embed-resources.js
var URL_REGEX = /url\((['"]?)([^'"]+?)\1\)/g;
var URL_WITH_FORMAT_REGEX = /url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g;
var FONT_SRC_REGEX = /src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;
function toRegex(url) {
  const escaped = url.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
  return new RegExp(`(url\\(['"]?)(${escaped})(['"]?\\))`, "g");
}
function parseURLs(cssText) {
  const urls = [];
  cssText.replace(URL_REGEX, (raw, quotation, url) => {
    urls.push(url);
    return raw;
  });
  return urls.filter((url) => !isDataUrl(url));
}
async function embed(cssText, resourceURL, baseURL, options, getContentFromUrl) {
  try {
    const resolvedURL = baseURL ? resolveUrl(resourceURL, baseURL) : resourceURL;
    const contentType = getMimeType(resourceURL);
    let dataURL;
    if (getContentFromUrl) {
      const content = await getContentFromUrl(resolvedURL);
      dataURL = makeDataUrl(content, contentType);
    } else {
      dataURL = await resourceToDataURL(resolvedURL, contentType, options);
    }
    return cssText.replace(toRegex(resourceURL), `$1${dataURL}$3`);
  } catch (error) {
  }
  return cssText;
}
function filterPreferredFontFormat(str, { preferredFontFormat }) {
  return !preferredFontFormat ? str : str.replace(FONT_SRC_REGEX, (match) => {
    while (true) {
      const [src, , format] = URL_WITH_FORMAT_REGEX.exec(match) || [];
      if (!format) {
        return "";
      }
      if (format === preferredFontFormat) {
        return `src: ${src};`;
      }
    }
  });
}
function shouldEmbed(url) {
  return url.search(URL_REGEX) !== -1;
}
async function embedResources(cssText, baseUrl, options) {
  if (!shouldEmbed(cssText)) {
    return cssText;
  }
  const filteredCSSText = filterPreferredFontFormat(cssText, options);
  const urls = parseURLs(filteredCSSText);
  return urls.reduce((deferred, url) => deferred.then((css) => embed(css, url, baseUrl, options)), Promise.resolve(filteredCSSText));
}

// node_modules/html-to-image/es/embed-images.js
async function embedProp(propName, node, options) {
  var _a;
  const propValue = (_a = node.style) === null || _a === void 0 ? void 0 : _a.getPropertyValue(propName);
  if (propValue) {
    const cssString = await embedResources(propValue, null, options);
    node.style.setProperty(propName, cssString, node.style.getPropertyPriority(propName));
    return true;
  }
  return false;
}
async function embedBackground(clonedNode, options) {
  ;
  await embedProp("background", clonedNode, options) || await embedProp("background-image", clonedNode, options);
  await embedProp("mask", clonedNode, options) || await embedProp("-webkit-mask", clonedNode, options) || await embedProp("mask-image", clonedNode, options) || await embedProp("-webkit-mask-image", clonedNode, options);
}
async function embedImageNode(clonedNode, options) {
  const isImageElement = isInstanceOfElement(clonedNode, HTMLImageElement);
  if (!(isImageElement && !isDataUrl(clonedNode.src)) && !(isInstanceOfElement(clonedNode, SVGImageElement) && !isDataUrl(clonedNode.href.baseVal))) {
    return;
  }
  const url = isImageElement ? clonedNode.src : clonedNode.href.baseVal;
  const dataURL = await resourceToDataURL(url, getMimeType(url), options);
  await new Promise((resolve, reject) => {
    clonedNode.onload = resolve;
    clonedNode.onerror = options.onImageErrorHandler ? (...attributes) => {
      try {
        resolve(options.onImageErrorHandler(...attributes));
      } catch (error) {
        reject(error);
      }
    } : reject;
    const image = clonedNode;
    if (image.decode) {
      image.decode = resolve;
    }
    if (image.loading === "lazy") {
      image.loading = "eager";
    }
    if (isImageElement) {
      clonedNode.srcset = "";
      clonedNode.src = dataURL;
    } else {
      clonedNode.href.baseVal = dataURL;
    }
  });
}
async function embedChildren(clonedNode, options) {
  const children = toArray(clonedNode.childNodes);
  const deferreds = children.map((child) => embedImages(child, options));
  await Promise.all(deferreds).then(() => clonedNode);
}
async function embedImages(clonedNode, options) {
  if (isInstanceOfElement(clonedNode, Element)) {
    await embedBackground(clonedNode, options);
    await embedImageNode(clonedNode, options);
    await embedChildren(clonedNode, options);
  }
}

// node_modules/html-to-image/es/apply-style.js
function applyStyle(node, options) {
  const { style } = node;
  if (options.backgroundColor) {
    style.backgroundColor = options.backgroundColor;
  }
  if (options.width) {
    style.width = `${options.width}px`;
  }
  if (options.height) {
    style.height = `${options.height}px`;
  }
  const manual = options.style;
  if (manual != null) {
    Object.keys(manual).forEach((key) => {
      style[key] = manual[key];
    });
  }
  return node;
}

// node_modules/html-to-image/es/embed-webfonts.js
var cssFetchCache = {};
async function fetchCSS(url) {
  let cache2 = cssFetchCache[url];
  if (cache2 != null) {
    return cache2;
  }
  const res = await fetch(url);
  const cssText = await res.text();
  cache2 = { url, cssText };
  cssFetchCache[url] = cache2;
  return cache2;
}
async function embedFonts(data, options) {
  let cssText = data.cssText;
  const regexUrl = /url\(["']?([^"')]+)["']?\)/g;
  const fontLocs = cssText.match(/url\([^)]+\)/g) || [];
  const loadFonts = fontLocs.map(async (loc) => {
    let url = loc.replace(regexUrl, "$1");
    if (!url.startsWith("https://")) {
      url = new URL(url, data.url).href;
    }
    return fetchAsDataURL(url, options.fetchRequestInit, ({ result }) => {
      cssText = cssText.replace(loc, `url(${result})`);
      return [loc, result];
    });
  });
  return Promise.all(loadFonts).then(() => cssText);
}
function parseCSS(source) {
  if (source == null) {
    return [];
  }
  const result = [];
  const commentsRegex = /(\/\*[\s\S]*?\*\/)/gi;
  let cssText = source.replace(commentsRegex, "");
  const keyframesRegex = new RegExp("((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})", "gi");
  while (true) {
    const matches = keyframesRegex.exec(cssText);
    if (matches === null) {
      break;
    }
    result.push(matches[0]);
  }
  cssText = cssText.replace(keyframesRegex, "");
  const importRegex = /@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi;
  const combinedCSSRegex = "((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})";
  const unifiedRegex = new RegExp(combinedCSSRegex, "gi");
  while (true) {
    let matches = importRegex.exec(cssText);
    if (matches === null) {
      matches = unifiedRegex.exec(cssText);
      if (matches === null) {
        break;
      } else {
        importRegex.lastIndex = unifiedRegex.lastIndex;
      }
    } else {
      unifiedRegex.lastIndex = importRegex.lastIndex;
    }
    result.push(matches[0]);
  }
  return result;
}
async function getCSSRules(styleSheets, options) {
  const ret = [];
  const deferreds = [];
  styleSheets.forEach((sheet) => {
    if ("cssRules" in sheet) {
      try {
        toArray(sheet.cssRules || []).forEach((item, index) => {
          if (item.type === CSSRule.IMPORT_RULE) {
            let importIndex = index + 1;
            const url = item.href;
            const deferred = fetchCSS(url).then((metadata) => embedFonts(metadata, options)).then((cssText) => parseCSS(cssText).forEach((rule) => {
              try {
                sheet.insertRule(rule, rule.startsWith("@import") ? importIndex += 1 : sheet.cssRules.length);
              } catch (error) {
                console.error("Error inserting rule from remote css", {
                  rule,
                  error
                });
              }
            })).catch((e) => {
              console.error("Error loading remote css", e.toString());
            });
            deferreds.push(deferred);
          }
        });
      } catch (e) {
        const inline = styleSheets.find((a) => a.href == null) || document.styleSheets[0];
        if (sheet.href != null) {
          deferreds.push(fetchCSS(sheet.href).then((metadata) => embedFonts(metadata, options)).then((cssText) => parseCSS(cssText).forEach((rule) => {
            inline.insertRule(rule, inline.cssRules.length);
          })).catch((err) => {
            console.error("Error loading remote stylesheet", err);
          }));
        }
        console.error("Error inlining remote css file", e);
      }
    }
  });
  return Promise.all(deferreds).then(() => {
    styleSheets.forEach((sheet) => {
      if ("cssRules" in sheet) {
        try {
          toArray(sheet.cssRules || []).forEach((item) => {
            ret.push(item);
          });
        } catch (e) {
          console.error(`Error while reading CSS rules from ${sheet.href}`, e);
        }
      }
    });
    return ret;
  });
}
function getWebFontRules(cssRules) {
  return cssRules.filter((rule) => rule.type === CSSRule.FONT_FACE_RULE).filter((rule) => shouldEmbed(rule.style.getPropertyValue("src")));
}
async function parseWebFontRules(node, options) {
  if (node.ownerDocument == null) {
    throw new Error("Provided element is not within a Document");
  }
  const styleSheets = toArray(node.ownerDocument.styleSheets);
  const cssRules = await getCSSRules(styleSheets, options);
  return getWebFontRules(cssRules);
}
function normalizeFontFamily(font) {
  return font.trim().replace(/["']/g, "");
}
function getUsedFonts(node) {
  const fonts = /* @__PURE__ */ new Set();
  function traverse(node2) {
    const fontFamily = node2.style.fontFamily || getComputedStyle(node2).fontFamily;
    fontFamily.split(",").forEach((font) => {
      fonts.add(normalizeFontFamily(font));
    });
    Array.from(node2.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        traverse(child);
      }
    });
  }
  traverse(node);
  return fonts;
}
async function getWebFontCSS(node, options) {
  const rules = await parseWebFontRules(node, options);
  const usedFonts = getUsedFonts(node);
  const cssTexts = await Promise.all(rules.filter((rule) => usedFonts.has(normalizeFontFamily(rule.style.fontFamily))).map((rule) => {
    const baseUrl = rule.parentStyleSheet ? rule.parentStyleSheet.href : null;
    return embedResources(rule.cssText, baseUrl, options);
  }));
  return cssTexts.join("\n");
}
async function embedWebFonts(clonedNode, options) {
  const cssText = options.fontEmbedCSS != null ? options.fontEmbedCSS : options.skipFonts ? null : await getWebFontCSS(clonedNode, options);
  if (cssText) {
    const styleNode = document.createElement("style");
    const sytleContent = document.createTextNode(cssText);
    styleNode.appendChild(sytleContent);
    if (clonedNode.firstChild) {
      clonedNode.insertBefore(styleNode, clonedNode.firstChild);
    } else {
      clonedNode.appendChild(styleNode);
    }
  }
}

// node_modules/html-to-image/es/index.js
async function toSvg(node, options = {}) {
  const { width, height } = getImageSize(node, options);
  const clonedNode = await cloneNode(node, options, true);
  await embedWebFonts(clonedNode, options);
  await embedImages(clonedNode, options);
  applyStyle(clonedNode, options);
  const datauri = await nodeToDataURL(clonedNode, width, height);
  return datauri;
}
async function toCanvas(node, options = {}) {
  const { width, height } = getImageSize(node, options);
  const svg = await toSvg(node, options);
  const img = await createImage(svg);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const ratio = options.pixelRatio || getPixelRatio();
  const canvasWidth = options.canvasWidth || width;
  const canvasHeight = options.canvasHeight || height;
  canvas.width = canvasWidth * ratio;
  canvas.height = canvasHeight * ratio;
  if (!options.skipAutoScale) {
    checkCanvasDimensions(canvas);
  }
  canvas.style.width = `${canvasWidth}`;
  canvas.style.height = `${canvasHeight}`;
  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function toPng(node, options = {}) {
  const canvas = await toCanvas(node, options);
  return canvas.toDataURL();
}

// src/annotation.ts
async function capturePassage(app, doc, path, excerpt) {
  const owner = new import_obsidian2.Component();
  owner.load();
  const shell = doc.createElement("div");
  shell.style.cssText = "position:fixed;left:-20000px;top:0;width:900px;pointer-events:none;";
  const box = shell.createDiv({
    cls: "markdown-preview-view markdown-rendered"
  });
  box.style.cssText = "width:900px;height:auto;min-height:0;padding:32px;box-sizing:border-box;overflow:visible;";
  doc.body.append(shell);
  try {
    const background = doc.defaultView.getComputedStyle(doc.body).getPropertyValue("--background-primary").trim() || "#fff";
    box.style.background = background;
    await import_obsidian2.MarkdownRenderer.render(app, excerpt, box, path, owner);
    await (0, import_obsidian2.finishRenderMath)();
    await doc.fonts.ready;
    if (box.querySelector("iframe,video,canvas"))
      throw new Error(
        "This passage contains an interactive embed. Select text, equations or static content instead."
      );
    if (Array.from(box.querySelectorAll("img")).some(
      (img) => /^https?:/.test(img.src)
    ))
      throw new Error(
        "Remote images are not captured. Use a local attachment first."
      );
    await Promise.all(
      Array.from(box.querySelectorAll("img")).map((img) => img.decode())
    );
    const height = Math.ceil(box.getBoundingClientRect().height);
    if (height > 6e3)
      throw new Error(
        "Select a shorter passage (snapshot height exceeds 6000 pixels)."
      );
    const dataURL = await toPng(box, {
      pixelRatio: 2,
      backgroundColor: background,
      cacheBust: false
    });
    return { dataURL, width: 900, height, background };
  } finally {
    owner.unload();
    shell.remove();
  }
}

// src/source-status.ts
function sourceStatus(text, source) {
  if (text === null) return "Source note is missing";
  if (text.slice(source.from, source.to) === source.excerpt)
    return "Source unchanged";
  const first = text.indexOf(source.excerpt);
  if (first >= 0 && text.indexOf(source.excerpt, first + 1) < 0)
    return "Source unchanged (moved)";
  return "Earlier snapshot \u2014 source changed or location is ambiguous";
}

// src/image-alignment.ts
function alignImage(source, alignment) {
  const wiki = source.startsWith("![[") && source.endsWith("]]");
  const match = wiki ? null : source.match(/^!\[((?:\\.|[^\]\\])*)\](\([\s\S]*\))$/);
  if (!wiki && !match)
    throw new Error(
      "This image format is not supported by the alignment menu."
    );
  const parts = (wiki ? source.slice(3, -2) : match[1]).split("|");
  const path = wiki ? parts.shift() : null;
  const clean = parts.filter(
    (x) => !["left", "center", "right"].includes(x.trim())
  );
  const size = clean.length && /^\d+(?:x\d+)?$/.test(clean[clean.length - 1].trim()) ? clean.pop() : void 0;
  if (alignment !== "default") clean.push(alignment);
  if (size !== void 0) clean.push(size);
  return wiki ? "![[" + [path, ...clean].join("|") + "]]" : "![" + clean.join("|") + "]" + match[2];
}

// src/main.ts
var import_obsidian3 = require("obsidian");
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");

// src/model.ts
var blankSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="480" viewBox="0 0 960 480"><rect width="960" height="480" fill="white"/><text x="480" y="240" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#686868">Double-click to draw \xB7 Ink Studio</text></svg>';
function blankScene(id) {
  return {
    format: "ink-studio",
    version: 1,
    id,
    elements: [],
    appState: { viewBackgroundColor: "#ffffff", currentItemStrokeWidth: 0.5 },
    files: {},
    updated: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function readScene(text) {
  const s = JSON.parse(text);
  if (s?.format !== "ink-studio" || s.version !== 1 || typeof s.id !== "string" || !Array.isArray(s.elements) || !s.appState || typeof s.appState !== "object" || !s.files || typeof s.files !== "object")
    throw new Error(
      "This is not a supported Ink Studio scene. The file has not been changed."
    );
  return s;
}
function scenePath(preview) {
  if (!preview.endsWith(".ink.svg"))
    throw new Error("Not an Ink Studio preview.");
  return preview.slice(0, -4) + ".json";
}
function assertUnchanged(current, expected) {
  if (current !== expected)
    throw new Error(
      "The drawing changed outside this editor. Your draft is retained; finish in the other editor first or recover this draft separately."
    );
}
var SaveQueue = class {
  tail = Promise.resolve();
  run(work) {
    const result = this.tail.then(work);
    this.tail = result.catch(() => {
    });
    return result;
  }
};

// src/main.ts
var active = import_state.StateEffect.define();
var plugin;
var InkWidget = class extends import_view.WidgetType {
  constructor(session) {
    super();
    this.session = session;
  }
  eq(other) {
    return other.session.id === this.session.id;
  }
  toDOM(view) {
    return plugin.mount(
      this.session,
      view.dom.ownerDocument,
      (returnFocus = true) => {
        const s = view.state.field(field, false);
        if (s?.id === this.session.id) {
          view.dispatch({
            effects: active.of(null),
            ...returnFocus ? {
              selection: import_state.EditorSelection.cursor(
                Math.min(s.pos + 1, view.state.doc.length)
              )
            } : {}
          });
          if (returnFocus) view.focus();
        }
      },
      () => view.requestMeasure()
    );
  }
  ignoreEvent() {
    return true;
  }
  destroy(dom) {
    dom.inkDispose?.();
  }
};
var field = import_state.StateField.define({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(active)) return e.value;
    if (value && tr.docChanged) {
      let removed = false;
      tr.changes.iterChangedRanges((from, to) => {
        if (from < value.pos && to > value.from) removed = true;
      });
      if (removed) return null;
    }
    return value ? {
      ...value,
      from: tr.changes.mapPos(value.from),
      pos: tr.changes.mapPos(value.pos)
    } : null;
  },
  provide: (f) => import_view.EditorView.decorations.from(
    f,
    (value) => value ? import_view.Decoration.set([
      import_view.Decoration.replace({
        widget: new InkWidget(value),
        block: true
      }).range(value.from, value.pos)
    ]) : import_view.Decoration.none
  )
});
var InkStudio = class extends import_obsidian3.Plugin {
  code = "";
  css = "";
  locks = /* @__PURE__ */ new Set();
  disposals = /* @__PURE__ */ new Set();
  async onload() {
    plugin = this;
    this.code = await this.app.vault.adapter.read(
      `${this.manifest.dir}/frame.js`
    );
    this.css = await this.app.vault.adapter.read(
      `${this.manifest.dir}/vendor/excalidraw.css`
    );
    this.registerEditorExtension([
      import_state.Prec.highest(field),
      import_view.ViewPlugin.fromClass(
        class {
          constructor(view) {
            this.view = view;
            for (const name of ["mousedown", "click", "dblclick"])
              view.dom.ownerDocument.addEventListener(name, this.click, true);
          }
          click = (e) => {
            if (e.button !== 0) return;
            const image = e.target.closest?.("img");
            if (!image || !this.view.dom.contains(image) || !plugin.imageFile(image))
              return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.type === "dblclick") {
              let pos = this.view.state.selection.main.head;
              try {
                pos = this.view.state.doc.lineAt(this.view.posAtDOM(image)).to;
              } catch {
              }
              void plugin.open(this.view, plugin.imageFile(image), pos);
            }
          };
          destroy() {
            for (const name of ["mousedown", "click", "dblclick"])
              this.view.dom.ownerDocument.removeEventListener(
                name,
                this.click,
                true
              );
          }
        }
      )
    ]);
    this.addCommand({
      id: "insert-drawing",
      name: "Insert drawing here",
      editorCallback: (editor, context) => {
        const cm = editor.cm;
        const file = context.file;
        if (cm && file) void this.insert(cm, file);
      }
    });
    this.addCommand({
      id: "edit-drawing",
      name: "Edit drawing on current line",
      editorCallback: (editor, context) => {
        const cm = editor.cm;
        if (!cm || !context.file) return;
        const line = cm.state.doc.lineAt(cm.state.selection.main.head);
        const match = line.text.match(
          /!\[\[([^\]|]+\.ink\.svg)(?:\|[^\]]*)?\]\]/
        );
        const file = match ? this.app.metadataCache.getFirstLinkpathDest(
          match[1],
          context.file.path
        ) : null;
        if (file instanceof import_obsidian3.TFile) void this.open(cm, file, line.to);
        else
          new import_obsidian3.Notice(
            "Place the cursor on an Ink Studio image embed, or double-click its preview."
          );
      }
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (rootMenu, editor, context) => {
        const menu = menuGroup(rootMenu, "insert", "Embed or link", "plus");
        if (editor.getSelection().trim())
          menu.addItem(
            (i) => i.setTitle("Drawing on selection\u2026").setIcon("pen-tool").onClick(() => {
              if (context.file)
                void this.annotate(editor.cm, context.file);
            })
          );
        menu.addItem(
          (i) => i.setTitle("Drawing\u2026").setIcon("pencil").onClick(() => {
            const cm = editor.cm;
            if (cm && context.file) void this.insert(cm, context.file);
          })
        );
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian3.TFile && file.path.endsWith(".ink.svg")) {
          for (const doc of this.readingDocs) this.refreshPreviews(doc);
        }
      })
    );
    this.addCommand({
      id: "annotate-selection",
      name: "Annotate selected passage",
      editorCallback: (editor, context) => {
        if (context.file) void this.annotate(editor.cm, context.file);
      }
    });
    this.app.workspace.onLayoutReady(() => this.bindReading());
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.bindReading())
    );
  }
  onunload() {
    for (const dispose of [...this.disposals]) dispose();
  }
  readingDocs = /* @__PURE__ */ new Set();
  refreshPreviews(doc) {
    for (const image of Array.from(
      doc.querySelectorAll('img[src*=".ink.svg"]')
    )) {
      const file = this.imageFile(image);
      if (!file) continue;
      const src = this.app.vault.getResourcePath(file).split("?")[0] + "?ink-studio=" + file.stat.mtime;
      if (image.getAttribute("src") !== src) image.setAttribute("src", src);
    }
  }
  bindReading() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const doc = leaf.view.containerEl.ownerDocument;
      if (this.readingDocs.has(doc)) return;
      this.readingDocs.add(doc);
      const observer = new doc.defaultView.MutationObserver(
        (records) => {
          const hasPreview = records.some(
            (record) => Array.from(record.addedNodes).some((node) => {
              if (node.nodeType !== 1) return false;
              const element = node;
              return element.matches('img[src*=".ink.svg"]') || !!element.querySelector('img[src*=".ink.svg"]');
            })
          );
          if (hasPreview) this.refreshPreviews(doc);
        }
      );
      observer.observe(doc.body, { childList: true, subtree: true });
      this.register(() => observer.disconnect());
      this.refreshPreviews(doc);
      this.registerDomEvent(doc, "contextmenu", (e) => this.imageMenu(e), true);
      const handler = (e) => {
        if (e.button !== 0) return;
        const image = e.target.closest?.("img");
        if (!image?.closest(".markdown-preview-view")) return;
        const file = this.imageFile(image);
        if (!file) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.type === "dblclick") {
          const view = this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
          if (!view?.file) return;
          const path = view.file.path;
          void view.leaf.setViewState({
            type: "markdown",
            state: { file: path, mode: "source" }
          }).then(() => {
            const cm = view.editor.cm;
            if (!cm) return;
            const text = cm.state.doc.toString();
            const at = text.indexOf(file.name);
            if (at >= 0) void this.open(cm, file, cm.state.doc.lineAt(at).to);
          });
        }
      };
      for (const name of ["mousedown", "click", "dblclick"])
        this.registerDomEvent(doc, name, handler, true);
    });
  }
  imageMenu(event) {
    const image = event.target.closest?.("img");
    if (!image || image.closest(".ink-studio-host,.markdown-embed")) return;
    let view;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof import_obsidian3.MarkdownView && leaf.view.containerEl.contains(image))
        view = leaf.view;
    });
    if (!view?.file) return;
    const owner = view;
    const file = view.file;
    const cm = owner.editor.cm;
    const editing = owner.getMode() === "source";
    const source = owner.editor.getValue();
    const cache2 = this.app.metadataCache.getFileCache(file);
    const embeds = (cache2?.embeds ?? []).filter(
      (e) => e.original.startsWith("!") && source.slice(e.position.start.offset, e.position.end.offset) === e.original
    );
    const matches = embeds.filter((e) => {
      const target = this.app.metadataCache.getFirstLinkpathDest(
        e.link,
        file.path
      );
      const src = image.getAttribute("src") ?? "";
      return target ? src.split("?")[0] === this.app.vault.getResourcePath(target).split("?")[0] : src === e.link || src === encodeURI(e.link);
    });
    let chosen;
    if (editing && cm) {
      try {
        const at = cm.posAtDOM(image);
        const line = cm.state.doc.lineAt(at);
        const local = matches.filter(
          (e) => e.position.start.offset >= line.from && e.position.start.offset <= line.to
        );
        chosen = local.find(
          (e) => at >= e.position.start.offset && at <= e.position.end.offset
        ) ?? (local.length === 1 ? local[0] : void 0);
      } catch {
      }
    } else {
      const images = Array.from(
        owner.containerEl.querySelectorAll(
          ".markdown-preview-view img"
        )
      ).filter((x) => !x.closest(".markdown-embed") && x.src === image.src);
      if (images.length === matches.length)
        chosen = matches[images.indexOf(image)];
    }
    if (!chosen) return;
    const selected = chosen;
    try {
      alignImage(selected.original, "default");
    } catch {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const menu = new import_obsidian3.Menu();
    for (const [label, alignment, icon] of [
      ["Align image left", "left", "align-left"],
      ["Center image", "center", "align-center"],
      ["Align image right", "right", "align-right"],
      ["Use default (center)", "default", "rotate-ccw"]
    ]) {
      menu.addItem(
        (item) => item.setTitle(label).setIcon(icon).onClick(async () => {
          const replacement = alignImage(selected.original, alignment);
          try {
            if (editing) {
              if (owner.file?.path !== file.path || owner.editor.getValue() !== source)
                throw new Error(
                  "The note changed while the menu was open. Right-click the image again."
                );
              owner.editor.replaceRange(
                replacement,
                owner.editor.offsetToPos(selected.position.start.offset),
                owner.editor.offsetToPos(selected.position.end.offset)
              );
            } else
              await this.app.vault.process(file, (current) => {
                if (current !== source)
                  throw new Error(
                    "The note changed while the menu was open. Right-click again."
                  );
                return current.slice(0, selected.position.start.offset) + replacement + current.slice(selected.position.end.offset);
              });
          } catch (e) {
            new import_obsidian3.Notice(String(e));
          }
        })
      );
    }
    menu.showAtMouseEvent(event);
  }
  imageFile(image) {
    const src = image.getAttribute("src") || "";
    if (!src.includes(".ink.svg")) return null;
    return this.app.vault.getFiles().find(
      (f) => f.path.endsWith(".ink.svg") && (src.split("?")[0] === this.app.vault.getResourcePath(f).split("?")[0] || decodeURI(src).includes("/" + f.path))
    ) ?? null;
  }
  async annotate(view, note) {
    if (view.state.field(field, false)) {
      new import_obsidian3.Notice("Finish the current drawing first.");
      return;
    }
    const original = view.state.doc.toString();
    const { from, to } = view.state.selection.main;
    const excerpt = original.slice(from, to);
    if (!excerpt.trim()) {
      new import_obsidian3.Notice("Select the passage to annotate first.");
      return;
    }
    new import_obsidian3.Notice("Capturing passage\u2026");
    try {
      const captured = await capturePassage(
        this.app,
        view.dom.ownerDocument,
        note.path,
        excerpt
      );
      if (view.state.doc.toString() !== original)
        throw new Error(
          "The note changed during capture. Please select the passage again."
        );
      const id = crypto.randomUUID();
      const data = blankScene(id);
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(excerpt)
      );
      const fingerprint = Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
      data.annotation = {
        fingerprint,
        path: note.path,
        excerpt,
        from,
        to,
        captured: (/* @__PURE__ */ new Date()).toISOString(),
        ...captured
      };
      data.appState = {
        ...data.appState,
        viewBackgroundColor: captured.background,
        currentItemStrokeColor: "#e03131"
      };
      const path = await this.app.fileManager.getAvailablePathForAttachment(
        `Annotation-${id}.ink.svg`,
        note.path
      );
      const initial = `<svg xmlns="http://www.w3.org/2000/svg" width="${captured.width}" height="${captured.height}"><image width="100%" height="100%" href="${captured.dataURL}"/></svg>`;
      const preview = await this.app.vault.create(path, initial);
      await this.app.vault.create(scenePath(path), JSON.stringify(data));
      if (view.state.doc.toString() !== original)
        throw new Error(
          "The note changed. Captured files are retained in attachments."
        );
      const link = this.app.fileManager.generateMarkdownLink(
        preview,
        note.path
      );
      const source = this.app.fileManager.generateMarkdownLink(
        note,
        note.path,
        void 0,
        "Annotation source"
      );
      const text = "\n\n> [!note]+ Annotation \u2014 frozen passage\n> " + source + " \xB7 Double-click the image to edit ink\n> " + (link.startsWith("!") ? link : "!" + link) + "\n";
      const at = view.state.doc.lineAt(to).to;
      view.dispatch({
        changes: { from: at, insert: text },
        selection: import_state.EditorSelection.cursor(at + text.length)
      });
      await this.open(view, preview, at + text.length - 1);
    } catch (e) {
      new import_obsidian3.Notice(`Annotation capture failed: ${String(e)}`);
    }
  }
  async insert(view, note) {
    if (view.state.field(field, false)) {
      new import_obsidian3.Notice("Finish the current drawing first.");
      return;
    }
    const original = view.state.doc.toString();
    const at = view.state.selection.main.head;
    try {
      const id = crypto.randomUUID();
      const path = await this.app.fileManager.getAvailablePathForAttachment(
        `Drawing-${id}.ink.svg`,
        note.path
      );
      const preview = await this.app.vault.create(path, blankSVG);
      const data = blankScene(id);
      const scene = await this.app.vault.create(
        scenePath(path),
        JSON.stringify(data)
      );
      if (view.state.doc.toString() !== original || view.state.field(import_obsidian3.editorInfoField, false)?.file?.path !== note.path) {
        new import_obsidian3.Notice(
          "The note changed during creation. Drawing files are saved in the attachment folder; insert their link when ready."
        );
        return;
      }
      const link = this.app.fileManager.generateMarkdownLink(
        preview,
        note.path
      );
      const text = "\n" + (link.startsWith("!") ? link : "!" + link) + "\n";
      view.dispatch({
        changes: { from: at, insert: text },
        selection: import_state.EditorSelection.cursor(at + text.length)
      });
      await this.open(view, preview, at + text.length - 1);
    } catch (e) {
      new import_obsidian3.Notice(`Could not insert drawing: ${String(e)}`);
    }
  }
  async session(preview, pos, note) {
    if (this.locks.has(preview.path))
      throw new Error(
        "This drawing is already being edited. Finish that editor first."
      );
    const scene = this.app.vault.getAbstractFileByPath(scenePath(preview.path));
    if (!(scene instanceof import_obsidian3.TFile))
      throw new Error(
        "Editable .ink.json is missing. Keep it beside the .ink.svg preview; the preview is preserved."
      );
    const expected = await this.app.vault.read(scene);
    return {
      id: crypto.randomUUID(),
      preview,
      scene,
      expected,
      data: readScene(expected),
      from: pos,
      pos,
      note
    };
  }
  async open(view, preview, pos) {
    if (view.state.field(field, false)) {
      new import_obsidian3.Notice("Finish the current drawing first.");
      return;
    }
    try {
      const note = view.state.field(import_obsidian3.editorInfoField, false)?.file?.path ?? "";
      const document2 = view.state.doc;
      const candidates = Array.from(
        { length: document2.lines },
        (_, i) => document2.line(i + 1)
      ).filter((line2) => line2.text.includes(preview.name));
      const line = candidates.sort(
        (a, b) => Math.abs(a.from - pos) - Math.abs(b.from - pos)
      )[0];
      if (!line)
        throw new Error("The drawing embed could not be located in this note.");
      let first = line.number, last = line.number;
      if (/^\s*>/.test(line.text)) {
        while (first > 1 && /^\s*>/.test(document2.line(first - 1).text))
          first--;
        while (last < document2.lines && /^\s*>/.test(document2.line(last + 1).text))
          last++;
      }
      const s = await this.session(preview, document2.line(last).to, note);
      s.from = document2.line(first).from;
      if (view.state.field(import_obsidian3.editorInfoField, false)?.file?.path !== note || view.state.field(field, false))
        return;
      view.dispatch({
        effects: active.of(s),
        selection: import_state.EditorSelection.cursor(s.from)
      });
    } catch (e) {
      new import_obsidian3.Notice(String(e));
    }
  }
  mount(s, doc, close, measure = () => {
  }) {
    const host = doc.createElement("div");
    host.className = "ink-studio-host";
    const iframe = doc.createElement("iframe");
    iframe.className = "ink-studio-frame";
    iframe.title = "Ink Studio drawing editor";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    if (s.data.annotation) {
      const banner = host.createDiv({ cls: "ink-annotation-source" });
      const link = banner.createEl("a", {
        text: "Open source passage",
        href: "#"
      });
      const state = banner.createSpan({ text: " \xB7 Checking source\u2026" });
      const source = s.data.annotation;
      link.onclick = async (e) => {
        e.preventDefault();
        const file2 = this.app.vault.getAbstractFileByPath(source.path);
        if (!(file2 instanceof import_obsidian3.TFile)) {
          new import_obsidian3.Notice("Source note is missing.");
          return;
        }
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.openFile(file2, { state: { mode: "source" } });
        if (leaf.view instanceof import_obsidian3.MarkdownView) {
          const editor = leaf.view.editor;
          const text = editor.getValue();
          const exact = text.slice(source.from, source.to) === source.excerpt;
          const first = text.indexOf(source.excerpt);
          const at = exact ? source.from : first >= 0 && text.indexOf(source.excerpt, first + 1) < 0 ? first : -1;
          if (at >= 0) {
            editor.setSelection(
              editor.offsetToPos(at),
              editor.offsetToPos(at + source.excerpt.length)
            );
            editor.scrollIntoView(
              { from: editor.offsetToPos(at), to: editor.offsetToPos(at) },
              true
            );
          } else
            new import_obsidian3.Notice(
              "The source changed; the frozen passage is retained in the annotation."
            );
        }
      };
      const file = this.app.vault.getAbstractFileByPath(source.path);
      const read = file instanceof import_obsidian3.TFile ? this.app.vault.read(file) : Promise.resolve(null);
      void read.then((text) => {
        state.textContent = " \xB7 " + sourceStatus(text, source) + " \xB7 Frozen " + source.captured.slice(0, 10);
      });
    }
    host.append(iframe);
    this.locks.add(s.preview.path);
    const queue = new SaveQueue();
    let returnFocus = true;
    let warned = false;
    let disposed = false;
    let latest = s.data;
    let lastRevision = -1;
    const reply = (type, extra = {}) => iframe.contentWindow?.postMessage(
      { inkStudio: s.id, type, ...extra },
      "*"
    );
    const persist = async (data) => {
      readScene(JSON.stringify(data));
      if (data.id !== s.data.id) throw new Error("Drawing identity mismatch.");
      assertUnchanged(await this.app.vault.read(s.scene), s.expected);
      const value = JSON.stringify(data);
      await this.app.vault.modify(s.scene, value);
      s.expected = value;
    };
    const receive = (event) => {
      if (event.source !== iframe.contentWindow || event.data?.inkStudio !== s.id)
        return;
      const d = event.data;
      if (d.type === "ready") {
        measure();
        return;
      }
      if (d.type === "preview-error") {
        new import_obsidian3.Notice(
          "Drawing strokes are saved, but its image preview could not be updated."
        );
        return;
      }
      if (d.type === "recover") {
        void this.app.fileManager.getAvailablePathForAttachment(
          `Recovered-${s.data.id}.ink.json`,
          s.note
        ).then((p) => this.app.vault.create(p, JSON.stringify(d.scene))).then(
          () => new import_obsidian3.Notice("Draft recovered as a separate .ink.json attachment.")
        ).catch((e) => reply("error", { message: String(e) }));
        return;
      }
      if (d.type !== "draft" && d.type !== "preview") return;
      try {
        latest = readScene(JSON.stringify(d.scene));
      } catch (e) {
        reply("error", { message: String(e) });
        return;
      }
      if (typeof d.revision !== "number" || d.revision < lastRevision) return;
      lastRevision = d.revision;
      const data = latest;
      void queue.run(async () => {
        if (d.revision < lastRevision) return;
        await persist(data);
        if (d.type === "preview") {
          if (typeof d.svg !== "string" || !d.svg.startsWith("<svg"))
            throw new Error("Invalid drawing preview. Strokes remain saved.");
          await this.app.vault.modify(s.preview, d.svg);
          reply("saved", { revision: d.revision });
          if (d.finish && !disposed) close(returnFocus);
        }
      }).catch((e) => {
        reply("error", { message: String(e) });
        if (!warned) {
          warned = true;
          new import_obsidian3.Notice(`Ink Studio: ${String(e)}`);
        }
      });
    };
    const outside = (event) => {
      const target = event.target;
      if (event.button !== 0 || host.contains(target)) return;
      const note = host.closest(".markdown-source-view");
      if (!note?.contains(target)) return;
      returnFocus = false;
      reply("finish");
    };
    doc.addEventListener("pointerdown", outside, true);
    doc.defaultView.addEventListener("message", receive);
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      doc.removeEventListener("pointerdown", outside, true);
      doc.defaultView?.removeEventListener("message", receive);
      void queue.run(async () => {
        this.locks.delete(s.preview.path);
      });
      this.disposals.delete(dispose);
    };
    host.inkDispose = dispose;
    this.disposals.add(dispose);
    const config = {
      session: s.id,
      scene: s.data,
      dark: doc.body.classList.contains("theme-dark")
    };
    const asset = this.app.vault.adapter.getResourcePath(`${this.manifest.dir}/vendor/`).replace(/\?.*$/, "");
    iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; font-src app: data: blob:; img-src app: data: blob:; connect-src app: data: blob:; worker-src blob:"><style>${this.css}</style><style>html,body{margin:0;height:100%;overflow:hidden}body{font:13px system-ui;background:${config.dark ? "#232329" : "#fff"};color:${config.dark ? "#eee" : "#222"}}header{height:42px;display:flex;align-items:center;gap:12px;padding:0 12px}button{font:inherit;padding:5px 10px;cursor:pointer;border:1px solid #7775;border-radius:5px;background:transparent;color:inherit}#done{background:#6960cb;color:white}#retry,#recover{display:none}#status{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#editor{height:calc(100% - 42px)}.excalidraw{--default-font:system-ui}</style></head><body><header><strong>Ink Studio</strong><label title="Width for new strokes; existing ink is unchanged">Pen width <input id="pen-slider" type="range" min="0.1" max="4" step="0.1" style="width:90px;vertical-align:middle" aria-label="Adjust pen width"><input id="pen-width" type="number" min="0.1" max="8" step="0.1" style="width:54px" aria-label="Pen width"></label><label>Preview <select id="preview-appearance" aria-label="Preview appearance"><option value="editor">Match editor</option><option value="light">Light</option></select></label><span id="status">Opening\u2026</span><button id="retry">Retry save</button><button id="recover" title="Save a separate recovery copy">Recover draft</button><button id="done">Done \xB7 \u2318/Ctrl+Enter</button></header><div id="editor"></div><script>window.inkConfig=${JSON.stringify(config).replace(/</g, "\\u003c")};window.EXCALIDRAW_ASSET_PATH=${JSON.stringify(asset)};<\/script><script>${this.code.replace(/<\/script/gi, "<\\/script")}<\/script></body></html>`;
    return host;
  }
};
