"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/vendor/prism.cjs
var require_prism = __commonJS({
  "src/vendor/prism.cjs"(exports, module2) {
    "use strict";
    module2.exports = (function() {
      var window, self, global;
      var module3 = { exports: {} }, exports2 = module3.exports;
      var _self = typeof window !== "undefined" ? window : typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope ? self : {};
      var Prism2 = (function(_self2) {
        var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
        var uniqueId = 0;
        var plainTextGrammar = {};
        var _ = {
          /**
           * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
           * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
           * additional languages or plugins yourself.
           *
           * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
           *
           * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
           * empty Prism object into the global scope before loading the Prism script like this:
           *
           * ```js
           * window.Prism = window.Prism || {};
           * Prism.manual = true;
           * // add a new <script> to load Prism's script
           * ```
           *
           * @default false
           * @type {boolean}
           * @memberof Prism
           * @public
           */
          manual: _self2.Prism && _self2.Prism.manual,
          /**
           * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
           * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
           * own worker, you don't want it to do this.
           *
           * By setting this value to `true`, Prism will not add its own listeners to the worker.
           *
           * You obviously have to change this value before Prism executes. To do this, you can add an
           * empty Prism object into the global scope before loading the Prism script like this:
           *
           * ```js
           * window.Prism = window.Prism || {};
           * Prism.disableWorkerMessageHandler = true;
           * // Load Prism's script
           * ```
           *
           * @default false
           * @type {boolean}
           * @memberof Prism
           * @public
           */
          disableWorkerMessageHandler: _self2.Prism && _self2.Prism.disableWorkerMessageHandler,
          /**
           * A namespace for utility methods.
           *
           * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
           * change or disappear at any time.
           *
           * @namespace
           * @memberof Prism
           */
          util: {
            encode: function encode(tokens) {
              if (tokens instanceof Token) {
                return new Token(tokens.type, encode(tokens.content), tokens.alias);
              } else if (Array.isArray(tokens)) {
                return tokens.map(encode);
              } else {
                return tokens.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u00a0/g, " ");
              }
            },
            /**
             * Returns the name of the type of the given value.
             *
             * @param {any} o
             * @returns {string}
             * @example
             * type(null)      === 'Null'
             * type(undefined) === 'Undefined'
             * type(123)       === 'Number'
             * type('foo')     === 'String'
             * type(true)      === 'Boolean'
             * type([1, 2])    === 'Array'
             * type({})        === 'Object'
             * type(String)    === 'Function'
             * type(/abc+/)    === 'RegExp'
             */
            type: function(o) {
              return Object.prototype.toString.call(o).slice(8, -1);
            },
            /**
             * Returns a unique number for the given object. Later calls will still return the same number.
             *
             * @param {Object} obj
             * @returns {number}
             */
            objId: function(obj) {
              if (!obj["__id"]) {
                Object.defineProperty(obj, "__id", { value: ++uniqueId });
              }
              return obj["__id"];
            },
            /**
             * Creates a deep clone of the given object.
             *
             * The main intended use of this function is to clone language definitions.
             *
             * @param {T} o
             * @param {Record<number, any>} [visited]
             * @returns {T}
             * @template T
             */
            clone: function deepClone(o, visited) {
              visited = visited || {};
              var clone;
              var id;
              switch (_.util.type(o)) {
                case "Object":
                  id = _.util.objId(o);
                  if (visited[id]) {
                    return visited[id];
                  }
                  clone = /** @type {Record<string, any>} */
                  {};
                  visited[id] = clone;
                  for (var key2 in o) {
                    if (o.hasOwnProperty(key2)) {
                      clone[key2] = deepClone(o[key2], visited);
                    }
                  }
                  return (
                    /** @type {any} */
                    clone
                  );
                case "Array":
                  id = _.util.objId(o);
                  if (visited[id]) {
                    return visited[id];
                  }
                  clone = [];
                  visited[id] = clone;
                  /** @type {Array} */
                  /** @type {any} */
                  o.forEach(function(v, i) {
                    clone[i] = deepClone(v, visited);
                  });
                  return (
                    /** @type {any} */
                    clone
                  );
                default:
                  return o;
              }
            },
            /**
             * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
             *
             * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
             *
             * @param {Element} element
             * @returns {string}
             */
            getLanguage: function(element) {
              while (element) {
                var m = lang.exec(element.className);
                if (m) {
                  return m[1].toLowerCase();
                }
                element = element.parentElement;
              }
              return "none";
            },
            /**
             * Sets the Prism `language-xxxx` class of the given element.
             *
             * @param {Element} element
             * @param {string} language
             * @returns {void}
             */
            setLanguage: function(element, language) {
              element.className = element.className.replace(RegExp(lang, "gi"), "");
              element.classList.add("language-" + language);
            },
            /**
             * Returns the script element that is currently executing.
             *
             * This does __not__ work for line script element.
             *
             * @returns {HTMLScriptElement | null}
             */
            currentScript: function() {
              if (typeof document === "undefined") {
                return null;
              }
              if (document.currentScript && document.currentScript.tagName === "SCRIPT" && 1 < 2) {
                return (
                  /** @type {any} */
                  document.currentScript
                );
              }
              try {
                throw new Error();
              } catch (err) {
                var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
                if (src) {
                  var scripts = document.getElementsByTagName("script");
                  for (var i in scripts) {
                    if (scripts[i].src == src) {
                      return scripts[i];
                    }
                  }
                }
                return null;
              }
            },
            /**
             * Returns whether a given class is active for `element`.
             *
             * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
             * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
             * given class is just the given class with a `no-` prefix.
             *
             * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
             * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
             * ancestors have the given class or the negated version of it, then the default activation will be returned.
             *
             * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
             * version of it, the class is considered active.
             *
             * @param {Element} element
             * @param {string} className
             * @param {boolean} [defaultActivation=false]
             * @returns {boolean}
             */
            isActive: function(element, className, defaultActivation) {
              var no = "no-" + className;
              while (element) {
                var classList = element.classList;
                if (classList.contains(className)) {
                  return true;
                }
                if (classList.contains(no)) {
                  return false;
                }
                element = element.parentElement;
              }
              return !!defaultActivation;
            }
          },
          /**
           * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
           *
           * @namespace
           * @memberof Prism
           * @public
           */
          languages: {
            /**
             * The grammar for plain, unformatted text.
             */
            plain: plainTextGrammar,
            plaintext: plainTextGrammar,
            text: plainTextGrammar,
            txt: plainTextGrammar,
            /**
             * Creates a deep copy of the language with the given id and appends the given tokens.
             *
             * If a token in `redef` also appears in the copied language, then the existing token in the copied language
             * will be overwritten at its original position.
             *
             * ## Best practices
             *
             * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
             * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
             * understand the language definition because, normally, the order of tokens matters in Prism grammars.
             *
             * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
             * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
             *
             * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
             * @param {Grammar} redef The new tokens to append.
             * @returns {Grammar} The new language created.
             * @public
             * @example
             * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
             *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
             *     // at its original position
             *     'comment': { ... },
             *     // CSS doesn't have a 'color' token, so this token will be appended
             *     'color': /\b(?:red|green|blue)\b/
             * });
             */
            extend: function(id, redef) {
              var lang2 = _.util.clone(_.languages[id]);
              for (var key2 in redef) {
                lang2[key2] = redef[key2];
              }
              return lang2;
            },
            /**
             * Inserts tokens _before_ another token in a language definition or any other grammar.
             *
             * ## Usage
             *
             * This helper method makes it easy to modify existing languages. For example, the CSS language definition
             * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
             * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
             * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
             * this:
             *
             * ```js
             * Prism.languages.markup.style = {
             *     // token
             * };
             * ```
             *
             * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
             * before existing tokens. For the CSS example above, you would use it like this:
             *
             * ```js
             * Prism.languages.insertBefore('markup', 'cdata', {
             *     'style': {
             *         // token
             *     }
             * });
             * ```
             *
             * ## Special cases
             *
             * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
             * will be ignored.
             *
             * This behavior can be used to insert tokens after `before`:
             *
             * ```js
             * Prism.languages.insertBefore('markup', 'comment', {
             *     'comment': Prism.languages.markup.comment,
             *     // tokens after 'comment'
             * });
             * ```
             *
             * ## Limitations
             *
             * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
             * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
             * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
             * deleting properties which is necessary to insert at arbitrary positions.
             *
             * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
             * Instead, it will create a new object and replace all references to the target object with the new one. This
             * can be done without temporarily deleting properties, so the iteration order is well-defined.
             *
             * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
             * you hold the target object in a variable, then the value of the variable will not change.
             *
             * ```js
             * var oldMarkup = Prism.languages.markup;
             * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
             *
             * assert(oldMarkup !== Prism.languages.markup);
             * assert(newMarkup === Prism.languages.markup);
             * ```
             *
             * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
             * object to be modified.
             * @param {string} before The key to insert before.
             * @param {Grammar} insert An object containing the key-value pairs to be inserted.
             * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
             * object to be modified.
             *
             * Defaults to `Prism.languages`.
             * @returns {Grammar} The new grammar object.
             * @public
             */
            insertBefore: function(inside, before, insert, root) {
              root = root || /** @type {any} */
              _.languages;
              var grammar = root[inside];
              var ret = {};
              for (var token in grammar) {
                if (grammar.hasOwnProperty(token)) {
                  if (token == before) {
                    for (var newToken in insert) {
                      if (insert.hasOwnProperty(newToken)) {
                        ret[newToken] = insert[newToken];
                      }
                    }
                  }
                  if (!insert.hasOwnProperty(token)) {
                    ret[token] = grammar[token];
                  }
                }
              }
              var old = root[inside];
              root[inside] = ret;
              _.languages.DFS(_.languages, function(key2, value) {
                if (value === old && key2 != inside) {
                  this[key2] = ret;
                }
              });
              return ret;
            },
            // Traverse a language definition with Depth First Search
            DFS: function DFS(o, callback, type, visited) {
              visited = visited || {};
              var objId = _.util.objId;
              for (var i in o) {
                if (o.hasOwnProperty(i)) {
                  callback.call(o, i, o[i], type || i);
                  var property = o[i];
                  var propertyType = _.util.type(property);
                  if (propertyType === "Object" && !visited[objId(property)]) {
                    visited[objId(property)] = true;
                    DFS(property, callback, null, visited);
                  } else if (propertyType === "Array" && !visited[objId(property)]) {
                    visited[objId(property)] = true;
                    DFS(property, callback, i, visited);
                  }
                }
              }
            }
          },
          plugins: {},
          /**
           * This is the most high-level function in Prism’s API.
           * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
           * each one of them.
           *
           * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
           *
           * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
           * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
           * @memberof Prism
           * @public
           */
          highlightAll: function(async, callback) {
            _.highlightAllUnder(document, async, callback);
          },
          /**
           * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
           * {@link Prism.highlightElement} on each one of them.
           *
           * The following hooks will be run:
           * 1. `before-highlightall`
           * 2. `before-all-elements-highlight`
           * 3. All hooks of {@link Prism.highlightElement} for each element.
           *
           * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
           * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
           * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
           * @memberof Prism
           * @public
           */
          highlightAllUnder: function(container, async, callback) {
            var env = {
              callback,
              container,
              selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
            };
            _.hooks.run("before-highlightall", env);
            env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));
            _.hooks.run("before-all-elements-highlight", env);
            for (var i = 0, element; element = env.elements[i++]; ) {
              _.highlightElement(element, async === true, env.callback);
            }
          },
          /**
           * Highlights the code inside a single element.
           *
           * The following hooks will be run:
           * 1. `before-sanity-check`
           * 2. `before-highlight`
           * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
           * 4. `before-insert`
           * 5. `after-highlight`
           * 6. `complete`
           *
           * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
           * the element's language.
           *
           * @param {Element} element The element containing the code.
           * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
           * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
           * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
           * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
           *
           * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
           * asynchronous highlighting to work. You can build your own bundle on the
           * [Download page](https://prismjs.com/download.html).
           * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
           * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
           * @memberof Prism
           * @public
           */
          highlightElement: function(element, async, callback) {
            var language = _.util.getLanguage(element);
            var grammar = _.languages[language];
            _.util.setLanguage(element, language);
            var parent = element.parentElement;
            if (parent && parent.nodeName.toLowerCase() === "pre") {
              _.util.setLanguage(parent, language);
            }
            var code = element.textContent;
            var env = {
              element,
              language,
              grammar,
              code
            };
            function insertHighlightedCode(highlightedCode2) {
              env.highlightedCode = highlightedCode2;
              _.hooks.run("before-insert", env);
              env.element.innerHTML = env.highlightedCode;
              _.hooks.run("after-highlight", env);
              _.hooks.run("complete", env);
              callback && callback.call(env.element);
            }
            _.hooks.run("before-sanity-check", env);
            parent = env.element.parentElement;
            if (parent && parent.nodeName.toLowerCase() === "pre" && !parent.hasAttribute("tabindex")) {
              parent.setAttribute("tabindex", "0");
            }
            if (!env.code) {
              _.hooks.run("complete", env);
              callback && callback.call(env.element);
              return;
            }
            _.hooks.run("before-highlight", env);
            if (!env.grammar) {
              insertHighlightedCode(_.util.encode(env.code));
              return;
            }
            if (async && _self2.Worker) {
              var worker = new Worker(_.filename);
              worker.onmessage = function(evt) {
                insertHighlightedCode(evt.data);
              };
              worker.postMessage(JSON.stringify({
                language: env.language,
                code: env.code,
                immediateClose: true
              }));
            } else {
              insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
            }
          },
          /**
           * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
           * and the language definitions to use, and returns a string with the HTML produced.
           *
           * The following hooks will be run:
           * 1. `before-tokenize`
           * 2. `after-tokenize`
           * 3. `wrap`: On each {@link Token}.
           *
           * @param {string} text A string with the code to be highlighted.
           * @param {Grammar} grammar An object containing the tokens to use.
           *
           * Usually a language definition like `Prism.languages.markup`.
           * @param {string} language The name of the language definition passed to `grammar`.
           * @returns {string} The highlighted HTML.
           * @memberof Prism
           * @public
           * @example
           * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
           */
          highlight: function(text, grammar, language) {
            var env = {
              code: text,
              grammar,
              language
            };
            _.hooks.run("before-tokenize", env);
            if (!env.grammar) {
              throw new Error('The language "' + env.language + '" has no grammar.');
            }
            env.tokens = _.tokenize(env.code, env.grammar);
            _.hooks.run("after-tokenize", env);
            return Token.stringify(_.util.encode(env.tokens), env.language);
          },
          /**
           * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
           * and the language definitions to use, and returns an array with the tokenized code.
           *
           * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
           *
           * This method could be useful in other contexts as well, as a very crude parser.
           *
           * @param {string} text A string with the code to be highlighted.
           * @param {Grammar} grammar An object containing the tokens to use.
           *
           * Usually a language definition like `Prism.languages.markup`.
           * @returns {TokenStream} An array of strings and tokens, a token stream.
           * @memberof Prism
           * @public
           * @example
           * let code = `var foo = 0;`;
           * let tokens = Prism.tokenize(code, Prism.languages.javascript);
           * tokens.forEach(token => {
           *     if (token instanceof Prism.Token && token.type === 'number') {
           *         console.log(`Found numeric literal: ${token.content}`);
           *     }
           * });
           */
          tokenize: function(text, grammar) {
            var rest = grammar.rest;
            if (rest) {
              for (var token in rest) {
                grammar[token] = rest[token];
              }
              delete grammar.rest;
            }
            var tokenList = new LinkedList();
            addAfter(tokenList, tokenList.head, text);
            matchGrammar(text, tokenList, grammar, tokenList.head, 0);
            return toArray(tokenList);
          },
          /**
           * @namespace
           * @memberof Prism
           * @public
           */
          hooks: {
            all: {},
            /**
             * Adds the given callback to the list of callbacks for the given hook.
             *
             * The callback will be invoked when the hook it is registered for is run.
             * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
             *
             * One callback function can be registered to multiple hooks and the same hook multiple times.
             *
             * @param {string} name The name of the hook.
             * @param {HookCallback} callback The callback function which is given environment variables.
             * @public
             */
            add: function(name, callback) {
              var hooks = _.hooks.all;
              hooks[name] = hooks[name] || [];
              hooks[name].push(callback);
            },
            /**
             * Runs a hook invoking all registered callbacks with the given environment variables.
             *
             * Callbacks will be invoked synchronously and in the order in which they were registered.
             *
             * @param {string} name The name of the hook.
             * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
             * @public
             */
            run: function(name, env) {
              var callbacks = _.hooks.all[name];
              if (!callbacks || !callbacks.length) {
                return;
              }
              for (var i = 0, callback; callback = callbacks[i++]; ) {
                callback(env);
              }
            }
          },
          Token
        };
        _self2.Prism = _;
        function Token(type, content, alias, matchedStr) {
          this.type = type;
          this.content = content;
          this.alias = alias;
          this.length = (matchedStr || "").length | 0;
        }
        Token.stringify = function stringify(o, language) {
          if (typeof o == "string") {
            return o;
          }
          if (Array.isArray(o)) {
            var s = "";
            o.forEach(function(e) {
              s += stringify(e, language);
            });
            return s;
          }
          var env = {
            type: o.type,
            content: stringify(o.content, language),
            tag: "span",
            classes: ["token", o.type],
            attributes: {},
            language
          };
          var aliases = o.alias;
          if (aliases) {
            if (Array.isArray(aliases)) {
              Array.prototype.push.apply(env.classes, aliases);
            } else {
              env.classes.push(aliases);
            }
          }
          _.hooks.run("wrap", env);
          var attributes = "";
          for (var name in env.attributes) {
            attributes += " " + name + '="' + (env.attributes[name] || "").replace(/"/g, "&quot;") + '"';
          }
          return "<" + env.tag + ' class="' + env.classes.join(" ") + '"' + attributes + ">" + env.content + "</" + env.tag + ">";
        };
        function matchPattern(pattern, pos, text, lookbehind) {
          pattern.lastIndex = pos;
          var match = pattern.exec(text);
          if (match && lookbehind && match[1]) {
            var lookbehindLength = match[1].length;
            match.index += lookbehindLength;
            match[0] = match[0].slice(lookbehindLength);
          }
          return match;
        }
        function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
          for (var token in grammar) {
            if (!grammar.hasOwnProperty(token) || !grammar[token]) {
              continue;
            }
            var patterns = grammar[token];
            patterns = Array.isArray(patterns) ? patterns : [patterns];
            for (var j = 0; j < patterns.length; ++j) {
              if (rematch && rematch.cause == token + "," + j) {
                return;
              }
              var patternObj = patterns[j];
              var inside = patternObj.inside;
              var lookbehind = !!patternObj.lookbehind;
              var greedy = !!patternObj.greedy;
              var alias = patternObj.alias;
              if (greedy && !patternObj.pattern.global) {
                var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
                patternObj.pattern = RegExp(patternObj.pattern.source, flags + "g");
              }
              var pattern = patternObj.pattern || patternObj;
              for (var currentNode = startNode.next, pos = startPos; currentNode !== tokenList.tail; pos += currentNode.value.length, currentNode = currentNode.next) {
                if (rematch && pos >= rematch.reach) {
                  break;
                }
                var str = currentNode.value;
                if (tokenList.length > text.length) {
                  return;
                }
                if (str instanceof Token) {
                  continue;
                }
                var removeCount = 1;
                var match;
                if (greedy) {
                  match = matchPattern(pattern, pos, text, lookbehind);
                  if (!match || match.index >= text.length) {
                    break;
                  }
                  var from = match.index;
                  var to = match.index + match[0].length;
                  var p = pos;
                  p += currentNode.value.length;
                  while (from >= p) {
                    currentNode = currentNode.next;
                    p += currentNode.value.length;
                  }
                  p -= currentNode.value.length;
                  pos = p;
                  if (currentNode.value instanceof Token) {
                    continue;
                  }
                  for (var k = currentNode; k !== tokenList.tail && (p < to || typeof k.value === "string"); k = k.next) {
                    removeCount++;
                    p += k.value.length;
                  }
                  removeCount--;
                  str = text.slice(pos, p);
                  match.index -= pos;
                } else {
                  match = matchPattern(pattern, 0, str, lookbehind);
                  if (!match) {
                    continue;
                  }
                }
                var from = match.index;
                var matchStr = match[0];
                var before = str.slice(0, from);
                var after = str.slice(from + matchStr.length);
                var reach = pos + str.length;
                if (rematch && reach > rematch.reach) {
                  rematch.reach = reach;
                }
                var removeFrom = currentNode.prev;
                if (before) {
                  removeFrom = addAfter(tokenList, removeFrom, before);
                  pos += before.length;
                }
                removeRange(tokenList, removeFrom, removeCount);
                var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
                currentNode = addAfter(tokenList, removeFrom, wrapped);
                if (after) {
                  addAfter(tokenList, currentNode, after);
                }
                if (removeCount > 1) {
                  var nestedRematch = {
                    cause: token + "," + j,
                    reach
                  };
                  matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);
                  if (rematch && nestedRematch.reach > rematch.reach) {
                    rematch.reach = nestedRematch.reach;
                  }
                }
              }
            }
          }
        }
        function LinkedList() {
          var head = { value: null, prev: null, next: null };
          var tail = { value: null, prev: head, next: null };
          head.next = tail;
          this.head = head;
          this.tail = tail;
          this.length = 0;
        }
        function addAfter(list, node, value) {
          var next = node.next;
          var newNode = { value, prev: node, next };
          node.next = newNode;
          next.prev = newNode;
          list.length++;
          return newNode;
        }
        function removeRange(list, node, count) {
          var next = node.next;
          for (var i = 0; i < count && next !== list.tail; i++) {
            next = next.next;
          }
          node.next = next;
          next.prev = node;
          list.length -= i;
        }
        function toArray(list) {
          var array = [];
          var node = list.head.next;
          while (node !== list.tail) {
            array.push(node.value);
            node = node.next;
          }
          return array;
        }
        if (!_self2.document) {
          if (!_self2.addEventListener) {
            return _;
          }
          if (!_.disableWorkerMessageHandler) {
            _self2.addEventListener("message", function(evt) {
              var message = JSON.parse(evt.data);
              var lang2 = message.language;
              var code = message.code;
              var immediateClose = message.immediateClose;
              _self2.postMessage(_.highlight(code, _.languages[lang2], lang2));
              if (immediateClose) {
                _self2.close();
              }
            }, false);
          }
          return _;
        }
        var script = _.util.currentScript();
        if (script) {
          _.filename = script.src;
          if (script.hasAttribute("data-manual")) {
            _.manual = true;
          }
        }
        function highlightAutomaticallyCallback() {
          if (!_.manual) {
            _.highlightAll();
          }
        }
        if (!_.manual) {
          var readyState = document.readyState;
          if (readyState === "loading" || readyState === "interactive" && script && script.defer) {
            document.addEventListener("DOMContentLoaded", highlightAutomaticallyCallback);
          } else {
            if (window.requestAnimationFrame) {
              window.requestAnimationFrame(highlightAutomaticallyCallback);
            } else {
              window.setTimeout(highlightAutomaticallyCallback, 16);
            }
          }
        }
        return _;
      })(_self);
      if (typeof module3 !== "undefined" && module3.exports) {
        module3.exports = Prism2;
      }
      if (typeof global !== "undefined") {
        global.Prism = Prism2;
      }
      var Prism2 = module3.exports;
      Prism2.languages.clike = {
        "comment": [
          {
            pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
            lookbehind: true,
            greedy: true
          },
          {
            pattern: /(^|[^\\:])\/\/.*/,
            lookbehind: true,
            greedy: true
          }
        ],
        "string": {
          pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
          greedy: true
        },
        "class-name": {
          pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
          lookbehind: true,
          inside: {
            "punctuation": /[.\\]/
          }
        },
        "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
        "boolean": /\b(?:false|true)\b/,
        "function": /\b\w+(?=\()/,
        "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
        "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
        "punctuation": /[{}[\];(),.:]/
      };
      Prism2.languages.javascript = Prism2.languages.extend("clike", {
        "class-name": [
          Prism2.languages.clike["class-name"],
          {
            pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
            lookbehind: true
          }
        ],
        "keyword": [
          {
            pattern: /((?:^|\})\s*)catch\b/,
            lookbehind: true
          },
          {
            pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
            lookbehind: true
          }
        ],
        // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
        "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
        "number": {
          pattern: RegExp(
            /(^|[^\w$])/.source + "(?:" + // constant
            (/NaN|Infinity/.source + "|" + // binary integer
            /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
            /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
            /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
            /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
            /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
          ),
          lookbehind: true
        },
        "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
      });
      Prism2.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
      Prism2.languages.insertBefore("javascript", "keyword", {
        "regex": {
          pattern: RegExp(
            // lookbehind
            // eslint-disable-next-line regexp/no-dupe-characters-character-class
            /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
            // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
            // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
            // with the only syntax, so we have to define 2 different regex patterns.
            /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
            /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
            /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
          ),
          lookbehind: true,
          greedy: true,
          inside: {
            "regex-source": {
              pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
              lookbehind: true,
              alias: "language-regex",
              inside: Prism2.languages.regex
            },
            "regex-delimiter": /^\/|\/$/,
            "regex-flags": /^[a-z]+$/
          }
        },
        // This must be declared before keyword because we use "function" inside the look-forward
        "function-variable": {
          pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
          alias: "function"
        },
        "parameter": [
          {
            pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          }
        ],
        "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
      });
      Prism2.languages.insertBefore("javascript", "string", {
        "hashbang": {
          pattern: /^#!.*/,
          greedy: true,
          alias: "comment"
        },
        "template-string": {
          pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
          greedy: true,
          inside: {
            "template-punctuation": {
              pattern: /^`|`$/,
              alias: "string"
            },
            "interpolation": {
              pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
              lookbehind: true,
              inside: {
                "interpolation-punctuation": {
                  pattern: /^\$\{|\}$/,
                  alias: "punctuation"
                },
                rest: Prism2.languages.javascript
              }
            },
            "string": /[\s\S]+/
          }
        },
        "string-property": {
          pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
          lookbehind: true,
          greedy: true,
          alias: "property"
        }
      });
      Prism2.languages.insertBefore("javascript", "operator", {
        "literal-property": {
          pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
          lookbehind: true,
          alias: "property"
        }
      });
      if (Prism2.languages.markup) {
        Prism2.languages.markup.tag.addInlined("script", "javascript");
        Prism2.languages.markup.tag.addAttribute(
          /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
          "javascript"
        );
      }
      Prism2.languages.js = Prism2.languages.javascript;
      Prism2.languages.python = {
        "comment": {
          pattern: /(^|[^\\])#.*/,
          lookbehind: true,
          greedy: true
        },
        "string-interpolation": {
          pattern: /(?:f|fr|rf)(?:("""|''')[\s\S]*?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2)/i,
          greedy: true,
          inside: {
            "interpolation": {
              // "{" <expression> <optional "!s", "!r", or "!a"> <optional ":" format specifier> "}"
              pattern: /((?:^|[^{])(?:\{\{)*)\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}])+\})+\})+\}/,
              lookbehind: true,
              inside: {
                "format-spec": {
                  pattern: /(:)[^:(){}]+(?=\}$)/,
                  lookbehind: true
                },
                "conversion-option": {
                  pattern: /![sra](?=[:}]$)/,
                  alias: "punctuation"
                },
                rest: null
              }
            },
            "string": /[\s\S]+/
          }
        },
        "triple-quoted-string": {
          pattern: /(?:[rub]|br|rb)?("""|''')[\s\S]*?\1/i,
          greedy: true,
          alias: "string"
        },
        "string": {
          pattern: /(?:[rub]|br|rb)?("|')(?:\\.|(?!\1)[^\\\r\n])*\1/i,
          greedy: true
        },
        "function": {
          pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
          lookbehind: true
        },
        "class-name": {
          pattern: /(\bclass\s+)\w+/i,
          lookbehind: true
        },
        "decorator": {
          pattern: /(^[\t ]*)@\w+(?:\.\w+)*/m,
          lookbehind: true,
          alias: ["annotation", "punctuation"],
          inside: {
            "punctuation": /\./
          }
        },
        "keyword": /\b(?:_(?=\s*:)|and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
        "builtin": /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
        "boolean": /\b(?:False|None|True)\b/,
        "number": /\b0(?:b(?:_?[01])+|o(?:_?[0-7])+|x(?:_?[a-f0-9])+)\b|(?:\b\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\B\.\d+(?:_\d+)*)(?:e[+-]?\d+(?:_\d+)*)?j?(?!\w)/i,
        "operator": /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
        "punctuation": /[{}[\];(),.:]/
      };
      Prism2.languages.python["string-interpolation"].inside["interpolation"].inside.rest = Prism2.languages.python;
      Prism2.languages.py = Prism2.languages.python;
      Prism2.languages.wolfram = {
        "comment": (
          // Allow one level of nesting - note: regex taken from applescipt
          /\(\*(?:\(\*(?:[^*]|\*(?!\)))*\*\)|(?!\(\*)[\s\S])*?\*\)/
        ),
        "string": {
          pattern: /"(?:\\.|[^"\\\r\n])*"/,
          greedy: true
        },
        "keyword": /\b(?:Abs|AbsArg|Accuracy|Block|Do|For|Function|If|Manipulate|Module|Nest|NestList|None|Return|Switch|Table|Which|While)\b/,
        "context": {
          pattern: /\b\w+`+\w*/,
          alias: "class-name"
        },
        "blank": {
          pattern: /\b\w+_\b/,
          alias: "regex"
        },
        "global-variable": {
          pattern: /\$\w+/,
          alias: "variable"
        },
        "boolean": /\b(?:False|True)\b/,
        "number": /(?:\b(?=\d)|\B(?=\.))(?:0[bo])?(?:(?:\d|0x[\da-f])[\da-f]*(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?j?\b/i,
        "operator": /\/\.|;|=\.|\^=|\^:=|:=|<<|>>|<\||\|>|:>|\|->|->|<-|@@@|@@|@|\/@|=!=|===|==|=|\+|-|\[\/-+%=\]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
        "punctuation": /[{}[\];(),.:]/
      };
      Prism2.languages.mathematica = Prism2.languages.wolfram;
      Prism2.languages.wl = Prism2.languages.wolfram;
      Prism2.languages.nb = Prism2.languages.wolfram;
      (function(Prism3) {
        Prism3.languages.typescript = Prism3.languages.extend("javascript", {
          "class-name": {
            pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
            lookbehind: true,
            greedy: true,
            inside: null
            // see below
          },
          "builtin": /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
        });
        Prism3.languages.typescript.keyword.push(
          /\b(?:abstract|declare|is|keyof|readonly|require)\b/,
          // keywords that have to be followed by an identifier
          /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
          // This is for `import type *, {}`
          /\btype\b(?=\s*(?:[\{*]|$))/
        );
        delete Prism3.languages.typescript["parameter"];
        delete Prism3.languages.typescript["literal-property"];
        var typeInside = Prism3.languages.extend("typescript", {});
        delete typeInside["class-name"];
        Prism3.languages.typescript["class-name"].inside = typeInside;
        Prism3.languages.insertBefore("typescript", "function", {
          "decorator": {
            pattern: /@[$\w\xA0-\uFFFF]+/,
            inside: {
              "at": {
                pattern: /^@/,
                alias: "operator"
              },
              "function": /^[\s\S]+/
            }
          },
          "generic-function": {
            // e.g. foo<T extends "bar" | "baz">( ...
            pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
            greedy: true,
            inside: {
              "function": /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
              "generic": {
                pattern: /<[\s\S]+/,
                // everything after the first <
                alias: "class-name",
                inside: typeInside
              }
            }
          }
        });
        Prism3.languages.ts = Prism3.languages.typescript;
      })(Prism2);
      Prism2.languages.c = Prism2.languages.extend("clike", {
        "comment": {
          pattern: /\/\/(?:[^\r\n\\]|\\(?:\r\n?|\n|(?![\r\n])))*|\/\*[\s\S]*?(?:\*\/|$)/,
          greedy: true
        },
        "string": {
          // https://en.cppreference.com/w/c/language/string_literal
          pattern: /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
          greedy: true
        },
        "class-name": {
          pattern: /(\b(?:enum|struct)\s+(?:__attribute__\s*\(\([\s\S]*?\)\)\s*)?)\w+|\b[a-z]\w*_t\b/,
          lookbehind: true
        },
        "keyword": /\b(?:_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local|__attribute__|asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|typeof|union|unsigned|void|volatile|while)\b/,
        "function": /\b[a-z_]\w*(?=\s*\()/i,
        "number": /(?:\b0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?)[ful]{0,4}/i,
        "operator": />>=?|<<=?|->|([-+&|:])\1|[?:~]|[-+*/%&|^!=<>]=?/
      });
      Prism2.languages.insertBefore("c", "string", {
        "char": {
          // https://en.cppreference.com/w/c/language/character_constant
          pattern: /'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n]){0,32}'/,
          greedy: true
        }
      });
      Prism2.languages.insertBefore("c", "string", {
        "macro": {
          // allow for multiline macro definitions
          // spaces after the # character compile fine with gcc
          pattern: /(^[\t ]*)#\s*[a-z](?:[^\r\n\\/]|\/(?!\*)|\/\*(?:[^*]|\*(?!\/))*\*\/|\\(?:\r\n|[\s\S]))*/im,
          lookbehind: true,
          greedy: true,
          alias: "property",
          inside: {
            "string": [
              {
                // highlight the path of the include statement as a string
                pattern: /^(#\s*include\s*)<[^>]+>/,
                lookbehind: true
              },
              Prism2.languages.c["string"]
            ],
            "char": Prism2.languages.c["char"],
            "comment": Prism2.languages.c["comment"],
            "macro-name": [
              {
                pattern: /(^#\s*define\s+)\w+\b(?!\()/i,
                lookbehind: true
              },
              {
                pattern: /(^#\s*define\s+)\w+\b(?=\()/i,
                lookbehind: true,
                alias: "function"
              }
            ],
            // highlight macro directives as keywords
            "directive": {
              pattern: /^(#\s*)[a-z]+/,
              lookbehind: true,
              alias: "keyword"
            },
            "directive-hash": /^#/,
            "punctuation": /##|\\(?=[\r\n])/,
            "expression": {
              pattern: /\S[\s\S]*/,
              inside: Prism2.languages.c
            }
          }
        }
      });
      Prism2.languages.insertBefore("c", "function", {
        // highlight predefined macros as constants
        "constant": /\b(?:EOF|NULL|SEEK_CUR|SEEK_END|SEEK_SET|__DATE__|__FILE__|__LINE__|__TIMESTAMP__|__TIME__|__func__|stderr|stdin|stdout)\b/
      });
      delete Prism2.languages.c["boolean"];
      (function(Prism3) {
        var keyword = /\b(?:alignas|alignof|asm|auto|bool|break|case|catch|char|char16_t|char32_t|char8_t|class|co_await|co_return|co_yield|compl|concept|const|const_cast|consteval|constexpr|constinit|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|final|float|for|friend|goto|if|import|inline|int|int16_t|int32_t|int64_t|int8_t|long|module|mutable|namespace|new|noexcept|nullptr|operator|override|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|uint16_t|uint32_t|uint64_t|uint8_t|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/;
        var modName = /\b(?!<keyword>)\w+(?:\s*\.\s*\w+)*\b/.source.replace(/<keyword>/g, function() {
          return keyword.source;
        });
        Prism3.languages.cpp = Prism3.languages.extend("c", {
          "class-name": [
            {
              pattern: RegExp(/(\b(?:class|concept|enum|struct|typename)\s+)(?!<keyword>)\w+/.source.replace(/<keyword>/g, function() {
                return keyword.source;
              })),
              lookbehind: true
            },
            // This is intended to capture the class name of method implementations like:
            //   void foo::bar() const {}
            // However! The `foo` in the above example could also be a namespace, so we only capture the class name if
            // it starts with an uppercase letter. This approximation should give decent results.
            /\b[A-Z]\w*(?=\s*::\s*\w+\s*\()/,
            // This will capture the class name before destructors like:
            //   Foo::~Foo() {}
            /\b[A-Z_]\w*(?=\s*::\s*~\w+\s*\()/i,
            // This also intends to capture the class name of method implementations but here the class has template
            // parameters, so it can't be a namespace (until C++ adds generic namespaces).
            /\b\w+(?=\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>\s*::\s*\w+\s*\()/
          ],
          "keyword": keyword,
          "number": {
            pattern: /(?:\b0b[01']+|\b0x(?:[\da-f']+(?:\.[\da-f']*)?|\.[\da-f']+)(?:p[+-]?[\d']+)?|(?:\b[\d']+(?:\.[\d']*)?|\B\.[\d']+)(?:e[+-]?[\d']+)?)[ful]{0,4}/i,
            greedy: true
          },
          "operator": />>=?|<<=?|->|--|\+\+|&&|\|\||[?:~]|<=>|[-+*/%&|^!=<>]=?|\b(?:and|and_eq|bitand|bitor|not|not_eq|or|or_eq|xor|xor_eq)\b/,
          "boolean": /\b(?:false|true)\b/
        });
        Prism3.languages.insertBefore("cpp", "string", {
          "module": {
            // https://en.cppreference.com/w/cpp/language/modules
            pattern: RegExp(
              /(\b(?:import|module)\s+)/.source + "(?:" + // header-name
              /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|<[^<>\r\n]*>/.source + "|" + // module name or partition or both
              /<mod-name>(?:\s*:\s*<mod-name>)?|:\s*<mod-name>/.source.replace(/<mod-name>/g, function() {
                return modName;
              }) + ")"
            ),
            lookbehind: true,
            greedy: true,
            inside: {
              "string": /^[<"][\s\S]+/,
              "operator": /:/,
              "punctuation": /\./
            }
          },
          "raw-string": {
            pattern: /R"([^()\\ ]{0,16})\([\s\S]*?\)\1"/,
            alias: "string",
            greedy: true
          }
        });
        Prism3.languages.insertBefore("cpp", "keyword", {
          "generic-function": {
            pattern: /\b(?!operator\b)[a-z_]\w*\s*<(?:[^<>]|<[^<>]*>)*>(?=\s*\()/i,
            inside: {
              "function": /^\w+/,
              "generic": {
                pattern: /<[\s\S]+/,
                alias: "class-name",
                inside: Prism3.languages.cpp
              }
            }
          }
        });
        Prism3.languages.insertBefore("cpp", "operator", {
          "double-colon": {
            pattern: /::/,
            alias: "punctuation"
          }
        });
        Prism3.languages.insertBefore("cpp", "class-name", {
          // the base clause is an optional list of parent classes
          // https://en.cppreference.com/w/cpp/language/class
          "base-clause": {
            pattern: /(\b(?:class|struct)\s+\w+\s*:\s*)[^;{}"'\s]+(?:\s+[^;{}"'\s]+)*(?=\s*[;{])/,
            lookbehind: true,
            greedy: true,
            inside: Prism3.languages.extend("cpp", {})
          }
        });
        Prism3.languages.insertBefore("inside", "double-colon", {
          // All untokenized words that are not namespaces should be class names
          "class-name": /\b[a-z_]\w*\b(?!\s*::)/i
        }, Prism3.languages.cpp["base-clause"]);
      })(Prism2);
      (function(Prism3) {
        var envVars = "\\b(?:BASH|BASHOPTS|BASH_ALIASES|BASH_ARGC|BASH_ARGV|BASH_CMDS|BASH_COMPLETION_COMPAT_DIR|BASH_LINENO|BASH_REMATCH|BASH_SOURCE|BASH_VERSINFO|BASH_VERSION|COLORTERM|COLUMNS|COMP_WORDBREAKS|DBUS_SESSION_BUS_ADDRESS|DEFAULTS_PATH|DESKTOP_SESSION|DIRSTACK|DISPLAY|EUID|GDMSESSION|GDM_LANG|GNOME_KEYRING_CONTROL|GNOME_KEYRING_PID|GPG_AGENT_INFO|GROUPS|HISTCONTROL|HISTFILE|HISTFILESIZE|HISTSIZE|HOME|HOSTNAME|HOSTTYPE|IFS|INSTANCE|JOB|LANG|LANGUAGE|LC_ADDRESS|LC_ALL|LC_IDENTIFICATION|LC_MEASUREMENT|LC_MONETARY|LC_NAME|LC_NUMERIC|LC_PAPER|LC_TELEPHONE|LC_TIME|LESSCLOSE|LESSOPEN|LINES|LOGNAME|LS_COLORS|MACHTYPE|MAILCHECK|MANDATORY_PATH|NO_AT_BRIDGE|OLDPWD|OPTERR|OPTIND|ORBIT_SOCKETDIR|OSTYPE|PAPERSIZE|PATH|PIPESTATUS|PPID|PS1|PS2|PS3|PS4|PWD|RANDOM|REPLY|SECONDS|SELINUX_INIT|SESSION|SESSIONTYPE|SESSION_MANAGER|SHELL|SHELLOPTS|SHLVL|SSH_AUTH_SOCK|TERM|UID|UPSTART_EVENTS|UPSTART_INSTANCE|UPSTART_JOB|UPSTART_SESSION|USER|WINDOWID|XAUTHORITY|XDG_CONFIG_DIRS|XDG_CURRENT_DESKTOP|XDG_DATA_DIRS|XDG_GREETER_DATA_DIR|XDG_MENU_PREFIX|XDG_RUNTIME_DIR|XDG_SEAT|XDG_SEAT_PATH|XDG_SESSION_DESKTOP|XDG_SESSION_ID|XDG_SESSION_PATH|XDG_SESSION_TYPE|XDG_VTNR|XMODIFIERS)\\b";
        var commandAfterHeredoc = {
          pattern: /(^(["']?)\w+\2)[ \t]+\S.*/,
          lookbehind: true,
          alias: "punctuation",
          // this looks reasonably well in all themes
          inside: null
          // see below
        };
        var insideString = {
          "bash": commandAfterHeredoc,
          "environment": {
            pattern: RegExp("\\$" + envVars),
            alias: "constant"
          },
          "variable": [
            // [0]: Arithmetic Environment
            {
              pattern: /\$?\(\([\s\S]+?\)\)/,
              greedy: true,
              inside: {
                // If there is a $ sign at the beginning highlight $(( and )) as variable
                "variable": [
                  {
                    pattern: /(^\$\(\([\s\S]+)\)\)/,
                    lookbehind: true
                  },
                  /^\$\(\(/
                ],
                "number": /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee]-?\d+)?/,
                // Operators according to https://www.gnu.org/software/bash/manual/bashref.html#Shell-Arithmetic
                "operator": /--|\+\+|\*\*=?|<<=?|>>=?|&&|\|\||[=!+\-*/%<>^&|]=?|[?~:]/,
                // If there is no $ sign at the beginning highlight (( and )) as punctuation
                "punctuation": /\(\(?|\)\)?|,|;/
              }
            },
            // [1]: Command Substitution
            {
              pattern: /\$\((?:\([^)]+\)|[^()])+\)|`[^`]+`/,
              greedy: true,
              inside: {
                "variable": /^\$\(|^`|\)$|`$/
              }
            },
            // [2]: Brace expansion
            {
              pattern: /\$\{[^}]+\}/,
              greedy: true,
              inside: {
                "operator": /:[-=?+]?|[!\/]|##?|%%?|\^\^?|,,?/,
                "punctuation": /[\[\]]/,
                "environment": {
                  pattern: RegExp("(\\{)" + envVars),
                  lookbehind: true,
                  alias: "constant"
                }
              }
            },
            /\$(?:\w+|[#?*!@$])/
          ],
          // Escape sequences from echo and printf's manuals, and escaped quotes.
          "entity": /\\(?:[abceEfnrtv\\"]|O?[0-7]{1,3}|U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,2})/
        };
        Prism3.languages.bash = {
          "shebang": {
            pattern: /^#!\s*\/.*/,
            alias: "important"
          },
          "comment": {
            pattern: /(^|[^"{\\$])#.*/,
            lookbehind: true
          },
          "function-name": [
            // a) function foo {
            // b) foo() {
            // c) function foo() {
            // but not “foo {”
            {
              // a) and c)
              pattern: /(\bfunction\s+)[\w-]+(?=(?:\s*\(?:\s*\))?\s*\{)/,
              lookbehind: true,
              alias: "function"
            },
            {
              // b)
              pattern: /\b[\w-]+(?=\s*\(\s*\)\s*\{)/,
              alias: "function"
            }
          ],
          // Highlight variable names as variables in for and select beginnings.
          "for-or-select": {
            pattern: /(\b(?:for|select)\s+)\w+(?=\s+in\s)/,
            alias: "variable",
            lookbehind: true
          },
          // Highlight variable names as variables in the left-hand part
          // of assignments (“=” and “+=”).
          "assign-left": {
            pattern: /(^|[\s;|&]|[<>]\()\w+(?:\.\w+)*(?=\+?=)/,
            inside: {
              "environment": {
                pattern: RegExp("(^|[\\s;|&]|[<>]\\()" + envVars),
                lookbehind: true,
                alias: "constant"
              }
            },
            alias: "variable",
            lookbehind: true
          },
          // Highlight parameter names as variables
          "parameter": {
            pattern: /(^|\s)-{1,2}(?:\w+:[+-]?)?\w+(?:\.\w+)*(?=[=\s]|$)/,
            alias: "variable",
            lookbehind: true
          },
          "string": [
            // Support for Here-documents https://en.wikipedia.org/wiki/Here_document
            {
              pattern: /((?:^|[^<])<<-?\s*)(\w+)\s[\s\S]*?(?:\r?\n|\r)\2/,
              lookbehind: true,
              greedy: true,
              inside: insideString
            },
            // Here-document with quotes around the tag
            // → No expansion (so no “inside”).
            {
              pattern: /((?:^|[^<])<<-?\s*)(["'])(\w+)\2\s[\s\S]*?(?:\r?\n|\r)\3/,
              lookbehind: true,
              greedy: true,
              inside: {
                "bash": commandAfterHeredoc
              }
            },
            // “Normal” string
            {
              // https://www.gnu.org/software/bash/manual/html_node/Double-Quotes.html
              pattern: /(^|[^\\](?:\\\\)*)"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/,
              lookbehind: true,
              greedy: true,
              inside: insideString
            },
            {
              // https://www.gnu.org/software/bash/manual/html_node/Single-Quotes.html
              pattern: /(^|[^$\\])'[^']*'/,
              lookbehind: true,
              greedy: true
            },
            {
              // https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
              pattern: /\$'(?:[^'\\]|\\[\s\S])*'/,
              greedy: true,
              inside: {
                "entity": insideString.entity
              }
            }
          ],
          "environment": {
            pattern: RegExp("\\$?" + envVars),
            alias: "constant"
          },
          "variable": insideString.variable,
          "function": {
            pattern: /(^|[\s;|&]|[<>]\()(?:add|apropos|apt|apt-cache|apt-get|aptitude|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|bzip2|cal|cargo|cat|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|column|comm|composer|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|docker|docker-compose|du|egrep|eject|env|ethtool|expand|expect|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|head|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|java|jobs|join|kill|killall|less|link|ln|locate|logname|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|node|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|podman|podman-compose|popd|pr|printcap|printenv|ps|pushd|pv|quota|quotacheck|quotactl|ram|rar|rcp|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|sh|shellcheck|shuf|shutdown|sleep|slocate|sort|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|sysctl|tac|tail|tar|tee|time|timeout|top|touch|tr|traceroute|tsort|tty|umount|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|v|vcpkg|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zenity|zip|zsh|zypper)(?=$|[)\s;|&])/,
            lookbehind: true
          },
          "keyword": {
            pattern: /(^|[\s;|&]|[<>]\()(?:case|do|done|elif|else|esac|fi|for|function|if|in|select|then|until|while)(?=$|[)\s;|&])/,
            lookbehind: true
          },
          // https://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
          "builtin": {
            pattern: /(^|[\s;|&]|[<>]\()(?:\.|:|alias|bind|break|builtin|caller|cd|command|continue|declare|echo|enable|eval|exec|exit|export|getopts|hash|help|let|local|logout|mapfile|printf|pwd|read|readarray|readonly|return|set|shift|shopt|source|test|times|trap|type|typeset|ulimit|umask|unalias|unset)(?=$|[)\s;|&])/,
            lookbehind: true,
            // Alias added to make those easier to distinguish from strings.
            alias: "class-name"
          },
          "boolean": {
            pattern: /(^|[\s;|&]|[<>]\()(?:false|true)(?=$|[)\s;|&])/,
            lookbehind: true
          },
          "file-descriptor": {
            pattern: /\B&\d\b/,
            alias: "important"
          },
          "operator": {
            // Lots of redirections here, but not just that.
            pattern: /\d?<>|>\||\+=|=[=~]?|!=?|<<[<-]?|[&\d]?>>|\d[<>]&?|[<>][&=]?|&[>&]?|\|[&|]?/,
            inside: {
              "file-descriptor": {
                pattern: /^\d/,
                alias: "important"
              }
            }
          },
          "punctuation": /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
          "number": {
            pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
            lookbehind: true
          }
        };
        commandAfterHeredoc.inside = Prism3.languages.bash;
        var toBeCopied = [
          "comment",
          "function-name",
          "for-or-select",
          "assign-left",
          "parameter",
          "string",
          "environment",
          "function",
          "keyword",
          "builtin",
          "boolean",
          "file-descriptor",
          "operator",
          "punctuation",
          "number"
        ];
        var inside = insideString.variable[1].inside;
        for (var i = 0; i < toBeCopied.length; i++) {
          inside[toBeCopied[i]] = Prism3.languages.bash[toBeCopied[i]];
        }
        Prism3.languages.sh = Prism3.languages.bash;
        Prism3.languages.shell = Prism3.languages.bash;
      })(Prism2);
      Prism2.languages.lua = {
        "comment": /^#!.+|--(?:\[(=*)\[[\s\S]*?\]\1\]|.*)/m,
        // \z may be used to skip the following space
        "string": {
          pattern: /(["'])(?:(?!\1)[^\\\r\n]|\\z(?:\r\n|\s)|\\(?:\r\n|[^z]))*\1|\[(=*)\[[\s\S]*?\]\2\]/,
          greedy: true
        },
        "number": /\b0x[a-f\d]+(?:\.[a-f\d]*)?(?:p[+-]?\d+)?\b|\b\d+(?:\.\B|(?:\.\d*)?(?:e[+-]?\d+)?\b)|\B\.\d+(?:e[+-]?\d+)?\b/i,
        "keyword": /\b(?:and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b/,
        "function": /(?!\d)\w+(?=\s*(?:[({]))/,
        "operator": [
          /[-+*%^&|#]|\/\/?|<[<=]?|>[>=]?|[=~]=?/,
          {
            // Match ".." but don't break "..."
            pattern: /(^|[^.])\.\.(?!\.)/,
            lookbehind: true
          }
        ],
        "punctuation": /[\[\](){},;]|\.+|:+/
      };
      Prism2.languages.json = {
        "property": {
          pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
          lookbehind: true,
          greedy: true
        },
        "string": {
          pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
          lookbehind: true,
          greedy: true
        },
        "comment": {
          pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
          greedy: true
        },
        "number": /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
        "punctuation": /[{}[\],]/,
        "operator": /:/,
        "boolean": /\b(?:false|true)\b/,
        "null": {
          pattern: /\bnull\b/,
          alias: "keyword"
        }
      };
      Prism2.languages.webmanifest = Prism2.languages.json;
      (function(Prism3) {
        var anchorOrAlias = /[*&][^\s[\]{},]+/;
        var tag = /!(?:<[\w\-%#;/?:@&=+$,.!~*'()[\]]+>|(?:[a-zA-Z\d-]*!)?[\w\-%#;/?:@&=+$.~*'()]+)?/;
        var properties = "(?:" + tag.source + "(?:[ 	]+" + anchorOrAlias.source + ")?|" + anchorOrAlias.source + "(?:[ 	]+" + tag.source + ")?)";
        var plainKey = /(?:[^\s\x00-\x08\x0e-\x1f!"#%&'*,\-:>?@[\]`{|}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]|[?:-]<PLAIN>)(?:[ \t]*(?:(?![#:])<PLAIN>|:<PLAIN>))*/.source.replace(/<PLAIN>/g, function() {
          return /[^\s\x00-\x08\x0e-\x1f,[\]{}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]/.source;
        });
        var string = /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/.source;
        function createValuePattern(value, flags) {
          flags = (flags || "").replace(/m/g, "") + "m";
          var pattern = /([:\-,[{]\s*(?:\s<<prop>>[ \t]+)?)(?:<<value>>)(?=[ \t]*(?:$|,|\]|\}|(?:[\r\n]\s*)?#))/.source.replace(/<<prop>>/g, function() {
            return properties;
          }).replace(/<<value>>/g, function() {
            return value;
          });
          return RegExp(pattern, flags);
        }
        Prism3.languages.yaml = {
          "scalar": {
            pattern: RegExp(/([\-:]\s*(?:\s<<prop>>[ \t]+)?[|>])[ \t]*(?:((?:\r?\n|\r)[ \t]+)\S[^\r\n]*(?:\2[^\r\n]+)*)/.source.replace(/<<prop>>/g, function() {
              return properties;
            })),
            lookbehind: true,
            alias: "string"
          },
          "comment": /#.*/,
          "key": {
            pattern: RegExp(/((?:^|[:\-,[{\r\n?])[ \t]*(?:<<prop>>[ \t]+)?)<<key>>(?=\s*:\s)/.source.replace(/<<prop>>/g, function() {
              return properties;
            }).replace(/<<key>>/g, function() {
              return "(?:" + plainKey + "|" + string + ")";
            })),
            lookbehind: true,
            greedy: true,
            alias: "atrule"
          },
          "directive": {
            pattern: /(^[ \t]*)%.+/m,
            lookbehind: true,
            alias: "important"
          },
          "datetime": {
            pattern: createValuePattern(/\d{4}-\d\d?-\d\d?(?:[tT]|[ \t]+)\d\d?:\d{2}:\d{2}(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d{2})?))?|\d{4}-\d{2}-\d{2}|\d\d?:\d{2}(?::\d{2}(?:\.\d*)?)?/.source),
            lookbehind: true,
            alias: "number"
          },
          "boolean": {
            pattern: createValuePattern(/false|true/.source, "i"),
            lookbehind: true,
            alias: "important"
          },
          "null": {
            pattern: createValuePattern(/null|~/.source, "i"),
            lookbehind: true,
            alias: "important"
          },
          "string": {
            pattern: createValuePattern(string),
            lookbehind: true,
            greedy: true
          },
          "number": {
            pattern: createValuePattern(/[+-]?(?:0x[\da-f]+|0o[0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\.inf|\.nan)/.source, "i"),
            lookbehind: true
          },
          "tag": tag,
          "important": anchorOrAlias,
          "punctuation": /---|[:[\]{}\-,|>?]|\.\.\./
        };
        Prism3.languages.yml = Prism3.languages.yaml;
      })(Prism2);
      Prism2.languages.r = {
        "comment": /#.*/,
        "string": {
          pattern: /(['"])(?:\\.|(?!\1)[^\\\r\n])*\1/,
          greedy: true
        },
        "percent-operator": {
          // Includes user-defined operators
          // and %%, %*%, %/%, %in%, %o%, %x%
          pattern: /%[^%\s]*%/,
          alias: "operator"
        },
        "boolean": /\b(?:FALSE|TRUE)\b/,
        "ellipsis": /\.\.(?:\.|\d+)/,
        "number": [
          /\b(?:Inf|NaN)\b/,
          /(?:\b0x[\dA-Fa-f]+(?:\.\d*)?|\b\d+(?:\.\d*)?|\B\.\d+)(?:[EePp][+-]?\d+)?[iL]?/
        ],
        "keyword": /\b(?:NA|NA_character_|NA_complex_|NA_integer_|NA_real_|NULL|break|else|for|function|if|in|next|repeat|while)\b/,
        "operator": /->?>?|<(?:=|<?-)?|[>=!]=?|::?|&&?|\|\|?|[+*\/^$@~]/,
        "punctuation": /[(){}\[\],;]/
      };
      Prism2.languages.julia = {
        "comment": {
          // support one level of nested comments
          // https://github.com/JuliaLang/julia/pull/6128
          pattern: /(^|[^\\])(?:#=(?:[^#=]|=(?!#)|#(?!=)|#=(?:[^#=]|=(?!#)|#(?!=))*=#)*=#|#.*)/,
          lookbehind: true
        },
        "regex": {
          // https://docs.julialang.org/en/v1/manual/strings/#Regular-Expressions-1
          pattern: /r"(?:\\.|[^"\\\r\n])*"[imsx]{0,4}/,
          greedy: true
        },
        "string": {
          // https://docs.julialang.org/en/v1/manual/strings/#String-Basics-1
          // https://docs.julialang.org/en/v1/manual/strings/#non-standard-string-literals-1
          // https://docs.julialang.org/en/v1/manual/running-external-programs/#Running-External-Programs-1
          pattern: /"""[\s\S]+?"""|(?:\b\w+)?"(?:\\.|[^"\\\r\n])*"|`(?:[^\\`\r\n]|\\.)*`/,
          greedy: true
        },
        "char": {
          // https://docs.julialang.org/en/v1/manual/strings/#man-characters-1
          pattern: /(^|[^\w'])'(?:\\[^\r\n][^'\r\n]*|[^\\\r\n])'/,
          lookbehind: true,
          greedy: true
        },
        "keyword": /\b(?:abstract|baremodule|begin|bitstype|break|catch|ccall|const|continue|do|else|elseif|end|export|finally|for|function|global|if|immutable|import|importall|in|let|local|macro|module|print|println|quote|return|struct|try|type|typealias|using|while)\b/,
        "boolean": /\b(?:false|true)\b/,
        "number": /(?:\b(?=\d)|\B(?=\.))(?:0[box])?(?:[\da-f]+(?:_[\da-f]+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[efp][+-]?\d+(?:_\d+)*)?j?/i,
        // https://docs.julialang.org/en/v1/manual/mathematical-operations/
        // https://docs.julialang.org/en/v1/manual/mathematical-operations/#Operator-Precedence-and-Associativity-1
        "operator": /&&|\|\||[-+*^%÷⊻&$\\]=?|\/[\/=]?|!=?=?|\|[=>]?|<(?:<=?|[=:|])?|>(?:=|>>?=?)?|==?=?|[~≠≤≥'√∛]/,
        "punctuation": /::?|[{}[\]();,.?]/,
        // https://docs.julialang.org/en/v1/base/numbers/#Base.im
        "constant": /\b(?:(?:Inf|NaN)(?:16|32|64)?|im|pi)\b|[πℯ]/
      };
      (function(Prism3) {
        var multilineComment = /\/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|<self>)*\*\//.source;
        for (var i = 0; i < 2; i++) {
          multilineComment = multilineComment.replace(/<self>/g, function() {
            return multilineComment;
          });
        }
        multilineComment = multilineComment.replace(/<self>/g, function() {
          return /[^\s\S]/.source;
        });
        Prism3.languages.rust = {
          "comment": [
            {
              pattern: RegExp(/(^|[^\\])/.source + multilineComment),
              lookbehind: true,
              greedy: true
            },
            {
              pattern: /(^|[^\\:])\/\/.*/,
              lookbehind: true,
              greedy: true
            }
          ],
          "string": {
            pattern: /b?"(?:\\[\s\S]|[^\\"])*"|b?r(#*)"(?:[^"]|"(?!\1))*"\1/,
            greedy: true
          },
          "char": {
            pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u\{(?:[\da-fA-F]_*){1,6}\}|.)|[^\\\r\n\t'])'/,
            greedy: true
          },
          "attribute": {
            pattern: /#!?\[(?:[^\[\]"]|"(?:\\[\s\S]|[^\\"])*")*\]/,
            greedy: true,
            alias: "attr-name",
            inside: {
              "string": null
              // see below
            }
          },
          // Closure params should not be confused with bitwise OR |
          "closure-params": {
            pattern: /([=(,:]\s*|\bmove\s*)\|[^|]*\||\|[^|]*\|(?=\s*(?:\{|->))/,
            lookbehind: true,
            greedy: true,
            inside: {
              "closure-punctuation": {
                pattern: /^\||\|$/,
                alias: "punctuation"
              },
              rest: null
              // see below
            }
          },
          "lifetime-annotation": {
            pattern: /'\w+/,
            alias: "symbol"
          },
          "fragment-specifier": {
            pattern: /(\$\w+:)[a-z]+/,
            lookbehind: true,
            alias: "punctuation"
          },
          "variable": /\$\w+/,
          "function-definition": {
            pattern: /(\bfn\s+)\w+/,
            lookbehind: true,
            alias: "function"
          },
          "type-definition": {
            pattern: /(\b(?:enum|struct|trait|type|union)\s+)\w+/,
            lookbehind: true,
            alias: "class-name"
          },
          "module-declaration": [
            {
              pattern: /(\b(?:crate|mod)\s+)[a-z][a-z_\d]*/,
              lookbehind: true,
              alias: "namespace"
            },
            {
              pattern: /(\b(?:crate|self|super)\s*)::\s*[a-z][a-z_\d]*\b(?:\s*::(?:\s*[a-z][a-z_\d]*\s*::)*)?/,
              lookbehind: true,
              alias: "namespace",
              inside: {
                "punctuation": /::/
              }
            }
          ],
          "keyword": [
            // https://github.com/rust-lang/reference/blob/master/src/keywords.md
            /\b(?:Self|abstract|as|async|await|become|box|break|const|continue|crate|do|dyn|else|enum|extern|final|fn|for|if|impl|in|let|loop|macro|match|mod|move|mut|override|priv|pub|ref|return|self|static|struct|super|trait|try|type|typeof|union|unsafe|unsized|use|virtual|where|while|yield)\b/,
            // primitives and str
            // https://doc.rust-lang.org/stable/rust-by-example/primitives.html
            /\b(?:bool|char|f(?:32|64)|[ui](?:8|16|32|64|128|size)|str)\b/
          ],
          // functions can technically start with an upper-case letter, but this will introduce a lot of false positives
          // and Rust's naming conventions recommend snake_case anyway.
          // https://doc.rust-lang.org/1.0.0/style/style/naming/README.html
          "function": /\b[a-z_]\w*(?=\s*(?:::\s*<|\())/,
          "macro": {
            pattern: /\b\w+!/,
            alias: "property"
          },
          "constant": /\b[A-Z_][A-Z_\d]+\b/,
          "class-name": /\b[A-Z]\w*\b/,
          "namespace": {
            pattern: /(?:\b[a-z][a-z_\d]*\s*::\s*)*\b[a-z][a-z_\d]*\s*::(?!\s*<)/,
            inside: {
              "punctuation": /::/
            }
          },
          // Hex, oct, bin, dec numbers with visual separators and type suffix
          "number": /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(?:(?:\d(?:_?\d)*)?\.)?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:f32|f64|[iu](?:8|16|32|64|size)?))?\b/,
          "boolean": /\b(?:false|true)\b/,
          "punctuation": /->|\.\.=|\.{1,3}|::|[{}[\];(),:]/,
          "operator": /[-+*\/%!^]=?|=[=>]?|&[&=]?|\|[|=]?|<<?=?|>>?=?|[@?]/
        };
        Prism3.languages.rust["closure-params"].inside.rest = Prism3.languages.rust;
        Prism3.languages.rust["attribute"].inside["string"] = Prism3.languages.rust["string"];
      })(Prism2);
      Prism2.languages.go = Prism2.languages.extend("clike", {
        "string": {
          pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"|`[^`]*`/,
          lookbehind: true,
          greedy: true
        },
        "keyword": /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go(?:to)?|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/,
        "boolean": /\b(?:_|false|iota|nil|true)\b/,
        "number": [
          // binary and octal integers
          /\b0(?:b[01_]+|o[0-7_]+)i?\b/i,
          // hexadecimal integers and floats
          /\b0x(?:[a-f\d_]+(?:\.[a-f\d_]*)?|\.[a-f\d_]+)(?:p[+-]?\d+(?:_\d+)*)?i?(?!\w)/i,
          // decimal integers and floats
          /(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?[\d_]+)?i?(?!\w)/i
        ],
        "operator": /[*\/%^!=]=?|\+[=+]?|-[=-]?|\|[=|]?|&(?:=|&|\^=?)?|>(?:>=?|=)?|<(?:<=?|=|-)?|:=|\.\.\./,
        "builtin": /\b(?:append|bool|byte|cap|close|complex|complex(?:64|128)|copy|delete|error|float(?:32|64)|u?int(?:8|16|32|64)?|imag|len|make|new|panic|print(?:ln)?|real|recover|rune|string|uintptr)\b/
      });
      Prism2.languages.insertBefore("go", "string", {
        "char": {
          pattern: /'(?:\\.|[^'\\\r\n]){0,10}'/,
          greedy: true
        }
      });
      delete Prism2.languages.go["class-name"];
      Prism2.languages.matlab = {
        "comment": [
          /%\{[\s\S]*?\}%/,
          /%.+/
        ],
        "string": {
          pattern: /\B'(?:''|[^'\r\n])*'/,
          greedy: true
        },
        // FIXME We could handle imaginary numbers as a whole
        "number": /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[eE][+-]?\d+)?(?:[ij])?|\b[ij]\b/,
        "keyword": /\b(?:NaN|break|case|catch|continue|else|elseif|end|for|function|if|inf|otherwise|parfor|pause|pi|return|switch|try|while)\b/,
        "function": /\b(?!\d)\w+(?=\s*\()/,
        "operator": /\.?[*^\/\\']|[+\-:@]|[<>=~]=?|&&?|\|\|?/,
        "punctuation": /\.{3}|[.,;\[\](){}!]/
      };
      Prism2.languages.fortran = {
        "quoted-number": {
          pattern: /[BOZ](['"])[A-F0-9]+\1/i,
          alias: "number"
        },
        "string": {
          pattern: /(?:\b\w+_)?(['"])(?:\1\1|&(?:\r\n?|\n)(?:[ \t]*!.*(?:\r\n?|\n)|(?![ \t]*!))|(?!\1).)*(?:\1|&)/,
          inside: {
            "comment": {
              pattern: /(&(?:\r\n?|\n)\s*)!.*/,
              lookbehind: true
            }
          }
        },
        "comment": {
          pattern: /!.*/,
          greedy: true
        },
        "boolean": /\.(?:FALSE|TRUE)\.(?:_\w+)?/i,
        "number": /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[ED][+-]?\d+)?(?:_\w+)?/i,
        "keyword": [
          // Types
          /\b(?:CHARACTER|COMPLEX|DOUBLE ?PRECISION|INTEGER|LOGICAL|REAL)\b/i,
          // END statements
          /\b(?:END ?)?(?:BLOCK ?DATA|DO|FILE|FORALL|FUNCTION|IF|INTERFACE|MODULE(?! PROCEDURE)|PROGRAM|SELECT|SUBROUTINE|TYPE|WHERE)\b/i,
          // Statements
          /\b(?:ALLOCATABLE|ALLOCATE|BACKSPACE|CALL|CASE|CLOSE|COMMON|CONTAINS|CONTINUE|CYCLE|DATA|DEALLOCATE|DIMENSION|DO|END|EQUIVALENCE|EXIT|EXTERNAL|FORMAT|GO ?TO|IMPLICIT(?: NONE)?|INQUIRE|INTENT|INTRINSIC|MODULE PROCEDURE|NAMELIST|NULLIFY|OPEN|OPTIONAL|PARAMETER|POINTER|PRINT|PRIVATE|PUBLIC|READ|RETURN|REWIND|SAVE|SELECT|STOP|TARGET|WHILE|WRITE)\b/i,
          // Others
          /\b(?:ASSIGNMENT|DEFAULT|ELEMENTAL|ELSE|ELSEIF|ELSEWHERE|ENTRY|IN|INCLUDE|INOUT|KIND|NULL|ONLY|OPERATOR|OUT|PURE|RECURSIVE|RESULT|SEQUENCE|STAT|THEN|USE)\b/i
        ],
        "operator": [
          /\*\*|\/\/|=>|[=\/]=|[<>]=?|::|[+\-*=%]|\.[A-Z]+\./i,
          {
            // Use lookbehind to prevent confusion with (/ /)
            pattern: /(^|(?!\().)\/(?!\))/,
            lookbehind: true
          }
        ],
        "punctuation": /\(\/|\/\)|[(),;:&]/
      };
      (function(Prism3) {
        var funcPattern = /\\(?:[^a-z()[\]]|[a-z*]+)/i;
        var insideEqu = {
          "equation-command": {
            pattern: funcPattern,
            alias: "regex"
          }
        };
        Prism3.languages.latex = {
          "comment": /%.*/,
          // the verbatim environment prints whitespace to the document
          "cdata": {
            pattern: /(\\begin\{((?:lstlisting|verbatim)\*?)\})[\s\S]*?(?=\\end\{\2\})/,
            lookbehind: true
          },
          /*
           * equations can be between $$ $$ or $ $ or \( \) or \[ \]
           * (all are multiline)
           */
          "equation": [
            {
              pattern: /\$\$(?:\\[\s\S]|[^\\$])+\$\$|\$(?:\\[\s\S]|[^\\$])+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/,
              inside: insideEqu,
              alias: "string"
            },
            {
              pattern: /(\\begin\{((?:align|eqnarray|equation|gather|math|multline)\*?)\})[\s\S]*?(?=\\end\{\2\})/,
              lookbehind: true,
              inside: insideEqu,
              alias: "string"
            }
          ],
          /*
           * arguments which are keywords or references are highlighted
           * as keywords
           */
          "keyword": {
            pattern: /(\\(?:begin|cite|documentclass|end|label|ref|usepackage)(?:\[[^\]]+\])?\{)[^}]+(?=\})/,
            lookbehind: true
          },
          "url": {
            pattern: /(\\url\{)[^}]+(?=\})/,
            lookbehind: true
          },
          /*
           * section or chapter headlines are highlighted as bold so that
           * they stand out more
           */
          "headline": {
            pattern: /(\\(?:chapter|frametitle|paragraph|part|section|subparagraph|subsection|subsubparagraph|subsubsection|subsubsubparagraph)\*?(?:\[[^\]]+\])?\{)[^}]+(?=\})/,
            lookbehind: true,
            alias: "class-name"
          },
          "function": {
            pattern: funcPattern,
            alias: "selector"
          },
          "punctuation": /[[\]{}&]/
        };
        Prism3.languages.tex = Prism3.languages.latex;
        Prism3.languages.context = Prism3.languages.latex;
      })(Prism2);
      Prism2.languages.sql = {
        "comment": {
          pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
          lookbehind: true
        },
        "variable": [
          {
            pattern: /@(["'`])(?:\\[\s\S]|(?!\1)[^\\])+\1/,
            greedy: true
          },
          /@[\w.$]+/
        ],
        "string": {
          pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
          greedy: true,
          lookbehind: true
        },
        "identifier": {
          pattern: /(^|[^@\\])`(?:\\[\s\S]|[^`\\]|``)*`/,
          greedy: true,
          lookbehind: true,
          inside: {
            "punctuation": /^`|`$/
          }
        },
        "function": /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i,
        // Should we highlight user defined functions too?
        "keyword": /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?: EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:COL|_INSERT)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MIDDLEINT|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTI(?:LINESTRING|POINT|POLYGON)|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREPARE|PREV|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESIGNAL|RESTORE|RESTRICT|RETURN(?:ING|S)?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SCHEMA|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNLOCK|UNPIVOT|UNSIGNED|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VAR(?:BINARY|CHAR|CHARACTER|YING)|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH(?: ROLLUP|IN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
        "boolean": /\b(?:FALSE|NULL|TRUE)\b/i,
        "number": /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?|\B\.\d+\b/i,
        "operator": /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|DIV|ILIKE|IN|IS|LIKE|NOT|OR|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
        "punctuation": /[;[\]()`,.]/
      };
      (function(Prism3) {
        var key2 = /(?:[\w-]+|'[^'\n\r]*'|"(?:\\.|[^\\"\r\n])*")/.source;
        function insertKey(pattern) {
          return pattern.replace(/__/g, function() {
            return key2;
          });
        }
        Prism3.languages.toml = {
          "comment": {
            pattern: /#.*/,
            greedy: true
          },
          "table": {
            pattern: RegExp(insertKey(/(^[\t ]*\[\s*(?:\[\s*)?)__(?:\s*\.\s*__)*(?=\s*\])/.source), "m"),
            lookbehind: true,
            greedy: true,
            alias: "class-name"
          },
          "key": {
            pattern: RegExp(insertKey(/(^[\t ]*|[{,]\s*)__(?:\s*\.\s*__)*(?=\s*=)/.source), "m"),
            lookbehind: true,
            greedy: true,
            alias: "property"
          },
          "string": {
            pattern: /"""(?:\\[\s\S]|[^\\])*?"""|'''[\s\S]*?'''|'[^'\n\r]*'|"(?:\\.|[^\\"\r\n])*"/,
            greedy: true
          },
          "date": [
            {
              // Offset Date-Time, Local Date-Time, Local Date
              pattern: /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?\b/i,
              alias: "number"
            },
            {
              // Local Time
              pattern: /\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/,
              alias: "number"
            }
          ],
          "number": /(?:\b0(?:x[\da-zA-Z]+(?:_[\da-zA-Z]+)*|o[0-7]+(?:_[0-7]+)*|b[10]+(?:_[10]+)*))\b|[-+]?\b\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?\b|[-+]?\b(?:inf|nan)\b/,
          "boolean": /\b(?:false|true)\b/,
          "punctuation": /[.,=[\]{}]/
        };
      })(Prism2);
      return Prism2;
    })();
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ImageGallery
});
module.exports = __toCommonJS(main_exports);

// src/menu-groups.ts
var import_obsidian = require("obsidian");
function menuGroup(menu, key2, title, icon, section = key2 === "insert" ? "insert" : key2 === "annotation-visibility" ? "view" : key2.startsWith("mark-") ? "selection" : "action") {
  menu.setUseNativeMenu(false);
  const symbol = Symbol.for("research-studio.menu." + key2), host = menu;
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

// src/finder-resize.ts
function clampDimensions(width, height, viewportWidth, viewportHeight) {
  return { width: Math.min(Math.max(420, width), Math.max(240, viewportWidth - 32)), height: Math.min(Math.max(360, height), Math.max(200, viewportHeight - 32)) };
}
function resizeFinder(modal, owner, saved, save) {
  const el = modal.modalEl, win = el.ownerDocument.defaultView;
  let preferred = { ...saved }, frame = 0;
  let pending;
  let drag;
  const defaults = () => ({ width: Math.min(1480, win.innerWidth * 0.96), height: Math.min(920, win.innerHeight * 0.88) });
  const apply = (w, h) => {
    const size = clampDimensions(w, h, win.innerWidth, win.innerHeight);
    el.style.width = size.width + "px";
    el.style.height = size.height + "px";
  };
  const fit = () => {
    const d = defaults();
    apply(preferred.width ?? d.width, preferred.height ?? d.height);
  };
  const finish = (cancel = false) => {
    if (!drag) return;
    cancelAnimationFrame(frame);
    if (pending && !cancel) apply(pending.w, pending.h);
    pending = void 0;
    const d = drag;
    drag = void 0;
    if (cancel) apply(d.w, d.h);
    else {
      const r = el.getBoundingClientRect();
      preferred = { width: r.width, height: r.height };
      save(preferred);
    }
    if (d.handle.hasPointerCapture(d.id)) d.handle.releasePointerCapture(d.id);
  };
  for (const edge of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
    const handle = el.createDiv({ cls: "igf-resize igf-resize-" + edge, attr: { "aria-hidden": "true" } });
    owner.registerDomEvent(handle, "pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      drag = { handle, id: e.pointerId, x: e.clientX, y: e.clientY, w: r.width, h: r.height, edge };
      handle.setPointerCapture(e.pointerId);
    });
    owner.registerDomEvent(win, "pointermove", (e) => {
      if (!drag || drag.handle !== handle || drag.id !== e.pointerId) return;
      const d = drag;
      cancelAnimationFrame(frame);
      pending = { w: d.w + (d.edge.includes("e") ? 2 : d.edge.includes("w") ? -2 : 0) * (e.clientX - d.x), h: d.h + (d.edge.includes("s") ? 2 : d.edge.includes("n") ? -2 : 0) * (e.clientY - d.y) };
      frame = win.requestAnimationFrame(() => {
        if (pending) apply(pending.w, pending.h);
      });
    });
    owner.registerDomEvent(win, "pointerup", (e) => {
      if (drag?.handle !== handle) return;
      e.stopPropagation();
      finish();
    }, true);
    owner.registerDomEvent(win, "pointercancel", () => {
      if (drag?.handle === handle) finish(true);
    });
    owner.registerDomEvent(handle, "click", (e) => e.stopPropagation());
    owner.registerDomEvent(handle, "dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      reset();
    });
  }
  const reset = () => {
    preferred = {};
    save({});
    fit();
  };
  owner.registerDomEvent(win, "blur", () => finish(true));
  owner.registerDomEvent(win, "resize", fit);
  owner.register(() => {
    cancelAnimationFrame(frame);
    finish(true);
    el.querySelectorAll(".igf-resize").forEach((h) => h.remove());
  });
  fit();
  return { reset };
}

// src/file-finder.ts
var import_obsidian3 = require("obsidian");

// src/files.ts
var imagePath = (p) => /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(p);
var codePath = (p) => /\.(py|lua|js|ts|tsx|jsx|c|cc|cpp|h|hpp|rs|go|sh|bash|zsh|fish|r|jl|m|f|f90|wls|wl|nb|tex|json|yaml|yml|toml|ini|cfg|csv|tsv|log|out|txt|sql|ipynb|vesta|blend)$/i.test(
  p
) || /(^|\/)(OUTCAR|INCAR|POSCAR|CONTCAR|OSZICAR|KPOINTS|DOSCAR|EIGENVAL|XDATCAR|Makefile|Dockerfile)$/.test(
  p
);
function usefulFile(p) {
  return !/(^|\/)(\.git|\.obsidian|\.code-links|__pycache__|node_modules|\.venv|venv)(\/|$)/.test(
    p
  ) && !/\.(pyc|pyo|DS_Store)$/i.test(p);
}
function folderMatches(path, folder, category) {
  const clean = folder.trim().replace(/^\/+|\/+$/g, "");
  return (!clean || (clean.includes(":") ? path : path.replace(/^[^:]+:/, "")).startsWith(
    clean + "/"
  )) && (!category || path.split("/").slice(0, -1).some((p) => p.toLowerCase().replace(/^[^:]+:/, "") === category));
}
function kindMatches(path, kind) {
  return kind === "all" || (kind === "notes" ? /\.md$/i.test(path) : kind === "pdf" ? /\.pdf$/i.test(path) : kind === "images" ? imagePath(path) : codePath(path));
}
function linkAt(text, offset) {
  const start = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const tail = text.indexOf("\n", offset);
  const end = tail < 0 ? text.length : tail;
  const line = text.slice(start, end), at = offset - start;
  const re = /\[\[|\{\{/g;
  let m;
  while (m = re.exec(line)) {
    const code = m[0] === "{{", close = code ? "}}" : "]]";
    const found = line.indexOf(close, m.index + 2);
    const stop = found < 0 ? line.length : found + 2;
    if (at < m.index + 2 || at > stop || line.slice(m.index + 2, found < 0 ? line.length : found).includes(code ? "{{" : "[["))
      continue;
    const body = line.slice(m.index + 2, found < 0 ? line.length : found);
    if (code && /^\s*blank:/i.test(body)) continue;
    const split = body.search(/[|#]/);
    return {
      start: start + m.index,
      end: start + stop,
      query: split < 0 ? body : body.slice(0, split),
      suffix: split < 0 ? "" : body.slice(split),
      syntax: code ? "code" : "wiki",
      closed: found >= 0
    };
  }
}
function pickedLink(target, code, slot) {
  if (/[\n\r|#{}\[\]]/.test(target))
    throw Error("This filename cannot be represented safely in a link.");
  const suffix = slot?.syntax === (code ? "code" : "wiki") ? slot.suffix : "";
  return code ? "{{" + target + suffix + "}}" : "[[" + target + suffix + "]]";
}

// src/finder-model.ts
function finderQuery(query) {
  const extensions = [];
  const terms = query.trim().split(/\s+/).filter((t) => {
    if (/^\.[a-z][a-z0-9]*$/i.test(t)) {
      extensions.push(t.slice(1).toLowerCase());
      return false;
    }
    return !!t;
  });
  return { text: terms.join(" "), extensions };
}
function inScope(e, scope, extensions) {
  if (!usefulFile(e.path)) return false;
  if (extensions.length) return extensions.includes(e.extension);
  return scope === "all" || (scope === "images" ? imagePath(e.path) : ["md", "pdf"].includes(e.extension));
}
function rankFiles(entries, scope, extensions, query, fuzzy) {
  const found = [];
  for (const entry of entries) {
    if (!inScope(entry, scope, extensions)) continue;
    let match = { entry, nameRanges: [], pathRanges: [], tier: 0, score: 0 };
    if (fuzzy) {
      const name = fuzzy(entry.name), alias = entry.aliases.map((text) => ({ text, hit: fuzzy(text) })).filter((a) => a.hit).sort((a, b) => b.hit.score - a.hit.score)[0];
      if (name) {
        match.nameRanges = name.matches;
        match.score = name.score;
        match.tier = entry.name.toLowerCase().startsWith(query.toLowerCase()) ? 4 : 3;
      } else if (alias) {
        match.tier = 2;
        match.score = alias.hit.score;
        match.alias = alias.text;
        match.aliasRanges = alias.hit.matches;
      } else {
        const path = fuzzy(entry.path);
        if (!path) continue;
        match.tier = 1;
        match.score = path.score;
        match.pathRanges = path.matches;
        const start = entry.folder.length;
        match.nameRanges = path.matches.map(([a, b]) => [Math.max(0, a - start), Math.min(entry.name.length, b - start)]).filter(([a, b]) => b > a);
      }
    }
    found.push(match);
  }
  return found.sort(compareMatches);
}
function finderLayout(width, size) {
  const compact = width < 560;
  const columns = compact ? 1 : Math.max(1, Math.floor((width + 14) / (230 * size / 100 + 14)));
  const cardWidth = Math.max(1, (width - 14 * (columns - 1)) / columns);
  const height = compact ? 100 : Math.round(cardWidth * 0.64) + 118;
  return { compact, columns, cardWidth, height, stride: height + 14 };
}
function pathLabel(folder, max = 100) {
  const parts = folder.replace(/\/$/, "").split("/").filter(Boolean);
  if (!parts.length) return "Vault root";
  if (folder.length <= max) return folder;
  const head = parts.slice(0, 2).join("/");
  return parts.length > 2 ? (head.length + parts.at(-1).length + 4 <= max ? head : parts[0]) + "/\u2026/" + parts.at(-1) + "/" : parts.join("/") + "/";
}
function previewExcerpt(raw) {
  const lines = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").slice(0, 5e3).split("\n");
  let fence = "";
  const kept = [];
  for (const line of lines) {
    const mark = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (mark) {
      if (!fence) fence = mark[1];
      else if (mark[1][0] === fence[0] && mark[1].length >= fence.length) fence = "";
      continue;
    }
    if (!fence) kept.push(line);
  }
  return kept.join("\n").replace(/!\[\[[^\]]*\]\]/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").replace(/<\/?(?:iframe|img|video|audio|embed|object|script|style|link)\b[^>]*>/gi, "").slice(0, 1500);
}
function folderLabels(entries) {
  const groups = /* @__PURE__ */ new Map(), result = /* @__PURE__ */ new Map();
  for (const e of entries) {
    const group = groups.get(e.name) ?? [];
    group.push(e);
    groups.set(e.name, group);
  }
  for (const group of groups.values()) {
    const folders = group.map((e) => e.folder.replace(/\/$/, "").split("/"));
    let common = 0;
    if (group.length > 1) while (common < folders.reduce((n, p) => Math.min(n, p.length), Infinity) - 1 && folders.every((p) => p[common] === folders[0][common])) common++;
    group.forEach((e, i) => {
      let parts = folders[i].slice(common);
      if (parts.at(-1)?.toLowerCase() === e.name.toLowerCase()) parts.pop();
      result.set(e.path, parts.filter(Boolean).length ? (common ? "\u2026/" : "") + pathLabel(parts.join("/") + "/", 120) : "Vault root");
    });
  }
  return result;
}
function compareMatches(a, b) {
  return b.tier - a.tier || b.score - a.score || a.entry.recent - b.entry.recent || b.entry.mtime - a.entry.mtime || a.entry.path.length - b.entry.path.length || a.entry.path.localeCompare(b.entry.path);
}

// src/finder-preview.ts
var import_obsidian2 = require("obsidian");
var FinderPreviews = class {
  constructor(app, doc) {
    this.app = app;
    this.doc = doc;
  }
  cache = /* @__PURE__ */ new Map();
  pending = /* @__PURE__ */ new Map();
  queue = [];
  running = 0;
  closed = false;
  cancel = /* @__PURE__ */ new Set();
  get(file) {
    const key2 = file.path + ":" + file.stat.mtime;
    const cached = this.cache.get(key2);
    if (cached) {
      this.cache.delete(key2);
      this.cache.set(key2, cached);
      return Promise.resolve(cached);
    }
    const pending = this.pending.get(key2);
    if (pending) return pending;
    const promise = new Promise((resolve2) => this.queue.push({ key: key2, file, resolve: resolve2 }));
    this.pending.set(key2, promise);
    this.pump();
    return promise;
  }
  /** Drop obsolete queued work, retaining current jobs and cached results. */
  prioritize(paths) {
    const keep = [];
    for (const job of this.queue) {
      if (paths.has(job.file.path)) keep.push(job);
      else {
        this.pending.delete(job.key);
        job.resolve(null);
      }
    }
    this.queue = keep;
  }
  pump() {
    while (!this.closed && this.running < 2 && this.queue.length) {
      const job = this.queue.shift();
      this.running++;
      void this.make(job.file).then((preview) => {
        if (this.closed) {
          preview?.dispose();
          job.resolve(null);
          return;
        }
        if (preview) {
          this.cache.set(job.key, preview);
          while (this.cache.size > 48) {
            const first = [...this.cache.keys()].find((key2) => !this.cache.get(key2).el.isConnected);
            if (!first) break;
            this.cache.get(first).dispose();
            this.cache.delete(first);
          }
        }
        job.resolve(preview);
      }).catch(() => job.resolve(null)).finally(() => {
        this.pending.delete(job.key);
        this.running--;
        this.pump();
      });
    }
  }
  async make(file) {
    const el = this.doc.createElement("div");
    el.className = "igf-miniature";
    el.setAttribute("inert", "");
    let disposed = false;
    const disposers = [];
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      for (const d of disposers) d();
      el.remove();
    };
    const alive = () => !this.closed && !disposed;
    try {
      if (imagePath(file.path)) {
        if (file.stat.size > 24 * 1024 * 1024) {
          el.textContent = "Image";
          return { el, dispose };
        }
        if (file.extension.toLowerCase() === "svg") {
          const img = el.createEl("img");
          img.decoding = "async";
          img.src = this.app.vault.getResourcePath(file);
          disposers.push(() => img.removeAttribute("src"));
          await img.decode();
        } else {
          const bytes = await this.app.vault.readBinary(file);
          if (!alive()) {
            dispose();
            return null;
          }
          const bitmap = await createImageBitmap(new Blob([bytes]), { resizeWidth: 640, resizeQuality: "medium" });
          try {
            if (!alive()) {
              dispose();
              return null;
            }
            const scale = Math.min(1, 640 / bitmap.width, 640 / bitmap.height);
            const canvas = el.createEl("canvas", { cls: "igf-image-bitmap" });
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          } finally {
            bitmap.close();
          }
        }
      } else if (file.extension.toLowerCase() === "md") {
        if (file.stat.size > 2 * 1024 * 1024) {
          el.textContent = "Markdown document";
          return { el, dispose };
        }
        const raw = await this.app.vault.cachedRead(file);
        if (!alive()) {
          dispose();
          return null;
        }
        const owner = new import_obsidian2.Component();
        owner.load();
        disposers.push(() => owner.unload());
        const page = el.createDiv({ cls: "igf-mini-page markdown-rendered" });
        await import_obsidian2.MarkdownRenderer.render(this.app, previewExcerpt(raw), page, "", owner);
      } else if (file.extension.toLowerCase() === "pdf") {
        if (file.stat.size > 60 * 1024 * 1024) {
          el.textContent = "PDF document";
          return { el, dispose };
        }
        const bytes = await this.app.vault.readBinary(file);
        if (!alive()) {
          dispose();
          return null;
        }
        const lib = await (0, import_obsidian2.loadPdfJs)();
        if (!alive()) {
          dispose();
          return null;
        }
        const task = lib.getDocument({ data: new Uint8Array(bytes) });
        let render;
        const abort = () => {
          render?.cancel();
          void task.destroy().catch(() => {
          });
        };
        this.cancel.add(abort);
        try {
          const pdf = await task.promise;
          if (!alive()) return null;
          const page = await pdf.getPage(1);
          if (!alive()) return null;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: 640 / base.width });
          const canvas = el.createEl("canvas");
          canvas.width = 640;
          canvas.height = Math.ceil(Math.min(viewport.height, 500));
          render = page.render({ canvasContext: canvas.getContext("2d"), viewport });
          await render.promise;
        } finally {
          this.cancel.delete(abort);
          await task.destroy();
        }
      } else {
        el.createDiv({ cls: "igf-file-glyph", text: file.extension.toUpperCase() || "FILE" });
      }
      if (!alive()) {
        dispose();
        return null;
      }
      return { el, dispose };
    } catch {
      dispose();
      return null;
    }
  }
  close() {
    this.closed = true;
    for (const job of this.queue) job.resolve(null);
    this.queue = [];
    for (const abort of this.cancel) abort();
    this.cancel.clear();
    for (const p of this.cache.values()) p.dispose();
    this.cache.clear();
    this.pending.clear();
  }
};

// src/file-finder.ts
var nextFinder = 0;
var FileFinder = class extends import_obsidian3.Modal {
  constructor(app, size = 100, saveSize = () => {
  }, dimensions = {}, saveDimensions = () => {
  }) {
    super(app);
    this.saveSize = saveSize;
    this.dimensions = dimensions;
    this.saveDimensions = saveDimensions;
    this.size = Math.max(60, Math.min(200, size));
  }
  entries = [];
  matches = [];
  filter = "documents";
  search;
  status;
  count;
  grid;
  layer;
  paths = /* @__PURE__ */ new Map();
  selected = 0;
  closed = false;
  owner = new import_obsidian3.Component();
  previews;
  resize;
  pendingSearch = null;
  searchTicket = 0;
  frame = 0;
  queryFrame = 0;
  timer;
  revision = 0;
  cards = /* @__PURE__ */ new Map();
  sizing;
  menu;
  layout = finderLayout(1e3, 100);
  uid = "igf-" + ++nextFinder;
  size;
  onOpen() {
    this.owner.load();
    this.modalEl.addClass("igf-modal");
    this.sizing = resizeFinder(this, this.owner, this.dimensions, this.saveDimensions);
    this.titleEl.textContent = "Open a file";
    this.titleEl.id = this.uid + "-title";
    const tools = this.contentEl.createDiv({ cls: "igf-tools" });
    this.search = tools.createEl("input", { type: "search", attr: { placeholder: "Search files\u2026", "aria-label": "Search files", role: "combobox", "aria-autocomplete": "list", "aria-expanded": "true", "aria-controls": this.uid + "-results" } });
    const info = this.contentEl.createDiv({ cls: "igf-info" });
    this.status = info.createEl("button", { cls: "igf-scope", text: "Notes and PDFs", attr: { "aria-haspopup": "menu", title: "Choose file types" } });
    this.status.onclick = (e) => this.scopeMenu(e);
    this.count = info.createSpan({ attr: { role: "status", "aria-live": "polite" } });
    this.grid = this.contentEl.createDiv({ cls: "igf-grid", attr: { id: this.uid + "-results", role: "listbox", "aria-labelledby": this.uid + "-title", tabindex: "0" } });
    this.layer = this.grid.createDiv({ cls: "igf-layer" });
    this.previews = new FinderPreviews(this.app, this.contentEl.ownerDocument);
    this.search.oninput = () => {
      cancelAnimationFrame(this.queryFrame);
      this.queryFrame = requestAnimationFrame(() => {
        this.queryFrame = 0;
        this.apply();
      });
    };
    this.grid.onscroll = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.draw());
    };
    this.grid.oncontextmenu = (e) => {
      if (e.target === this.grid || e.target === this.layer) {
        e.preventDefault();
        this.scopeMenu(e);
      }
    };
    this.grid.onkeydown = (e) => {
      const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -this.layout.columns, ArrowDown: this.layout.columns };
      if (e.key in steps) {
        e.preventDefault();
        e.stopPropagation();
        this.move(steps[e.key]);
      }
    };
    this.scope.register([], "ArrowDown", () => {
      if (this.contentEl.ownerDocument.activeElement === this.status) return;
      this.move(this.contentEl.ownerDocument.activeElement === this.grid ? this.layout.columns : 1);
      return false;
    });
    this.scope.register([], "ArrowUp", () => {
      if (this.contentEl.ownerDocument.activeElement === this.status) return;
      this.move(this.contentEl.ownerDocument.activeElement === this.grid ? -this.layout.columns : -1);
      return false;
    });
    this.scope.register([], "PageDown", () => {
      this.move(Math.max(1, Math.floor(this.grid.clientHeight / this.layout.stride)) * this.layout.columns);
      return false;
    });
    this.scope.register([], "PageUp", () => {
      this.move(-Math.max(1, Math.floor(this.grid.clientHeight / this.layout.stride)) * this.layout.columns);
      return false;
    });
    this.scope.register([], "Enter", () => {
      if (this.contentEl.ownerDocument.activeElement === this.status) return;
      void this.openSelected("current");
      return false;
    });
    this.scope.register(["Mod"], "Enter", () => {
      void this.openSelected("tab");
      return false;
    });
    this.scope.register(["Mod", "Alt"], "Enter", () => {
      void this.openSelected("split");
      return false;
    });
    this.scope.register(["Mod", "Alt", "Shift"], "Enter", () => {
      void this.openSelected("window");
      return false;
    });
    this.scope.register(["Mod", "Shift"], "i", () => {
      this.setScope(this.filter === "images" ? "documents" : "images");
      return false;
    });
    this.scope.register(["Mod", "Shift"], "a", () => {
      this.setScope(this.filter === "all" ? "documents" : "all");
      return false;
    });
    this.scope.register(["Mod"], "=", () => {
      this.zoom(10);
      return false;
    });
    this.scope.register(["Mod", "Shift"], "=", () => {
      this.zoom(10);
      return false;
    });
    this.scope.register(["Mod"], "-", () => {
      this.zoom(-10);
      return false;
    });
    this.scope.register(["Mod"], "0", () => {
      this.zoom(100 - this.size);
      return false;
    });
    this.owner.registerDomEvent(this.grid, "wheel", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.grid.clientHeight : 1);
        this.zoom(this.size * (Math.exp(-Math.max(-100, Math.min(100, pixels)) * 5e-3) - 1));
      }
    }, { passive: false });
    this.resize = new ResizeObserver(() => {
      this.measure();
      this.draw();
    });
    this.resize.observe(this.grid);
    const update = () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.index();
        this.apply(true);
      }, 100);
    };
    this.owner.registerEvent(this.app.vault.on("create", update));
    this.owner.registerEvent(this.app.vault.on("delete", update));
    this.owner.registerEvent(this.app.vault.on("rename", update));
    this.owner.registerEvent(this.app.metadataCache.on("changed", update));
    this.index();
    this.apply();
    this.search.focus();
  }
  index() {
    const recent = new Map(this.app.workspace.getLastOpenFiles().map((p, i) => [p, i]));
    this.entries = this.app.vault.getFiles().map((f) => ({ path: f.path, name: f.basename, folder: f.parent?.path === "/" ? "" : f.path.slice(0, f.path.lastIndexOf("/") + 1), extension: f.extension.toLowerCase(), mtime: f.stat.mtime, recent: recent.get(f.path) ?? Number.MAX_SAFE_INTEGER, aliases: f.extension.toLowerCase() === "md" ? (0, import_obsidian3.parseFrontMatterAliases)(this.app.metadataCache.getFileCache(f)?.frontmatter) ?? [] : [] }));
    this.paths = folderLabels(this.entries);
  }
  apply(retain = false) {
    if (this.closed) return;
    const ticket = ++this.searchTicket, scroll = this.grid.scrollTop, path = retain ? this.matches[this.selected]?.entry.path : null;
    const query = finderQuery(this.search.value), scope = this.filter, fuzzy = query.text ? (0, import_obsidian3.prepareFuzzySearch)(query.text) : null;
    const finish = (matches) => {
      if (this.closed || ticket !== this.searchTicket) return;
      this.matches = matches;
      this.selected = path ? Math.max(0, this.matches.findIndex((m) => m.entry.path === path)) : 0;
      this.status.textContent = query.extensions.length ? query.extensions.map((e) => "." + e).join(", ") : { documents: "Notes and PDFs", images: "Images", all: "All files" }[scope];
      this.count.textContent = this.matches.length.toLocaleString() + " result" + (this.matches.length === 1 ? "" : "s");
      this.grid.removeAttribute("aria-busy");
      this.revision++;
      for (const card of this.cards.values()) card.remove();
      this.cards.clear();
      this.measure();
      this.grid.scrollTop = retain ? scroll : 0;
      this.draw();
    };
    const entries = this.entries.filter((e) => inScope(e, scope, query.extensions));
    if (entries.length <= 6e3) {
      this.pendingSearch = null;
      finish(rankFiles(entries, scope, query.extensions, query.text, fuzzy));
      return;
    }
    this.grid.setAttribute("aria-busy", "true");
    this.count.textContent = "Searching\u2026";
    const work = async () => {
      const result = [];
      let sliceStart = performance.now();
      for (let start = 0; start < entries.length; start += 500) {
        if (this.closed || ticket !== this.searchTicket) return;
        result.push(...rankFiles(entries.slice(start, start + 500), scope, query.extensions, query.text, fuzzy));
        if (performance.now() - sliceStart >= 8) {
          const scheduler = globalThis.scheduler;
          if (scheduler?.yield) await scheduler.yield();
          else await new Promise((resolve2) => {
            const ch = new MessageChannel();
            ch.port1.onmessage = () => {
              ch.port1.close();
              ch.port2.close();
              resolve2();
            };
            ch.port2.postMessage(null);
          });
          sliceStart = performance.now();
        }
      }
      if (this.closed || ticket !== this.searchTicket) return;
      result.sort(compareMatches);
      finish(result);
    };
    const task = work().finally(() => {
      if (this.pendingSearch === task) this.pendingSearch = null;
    });
    this.pendingSearch = task;
  }
  measure() {
    this.layout = finderLayout(Math.max(1, this.grid.clientWidth - 8), this.size);
    this.grid.toggleClass("igf-compact", this.layout.compact);
    this.layer.style.height = Math.ceil(this.matches.length / this.layout.columns) * this.layout.stride + "px";
  }
  draw() {
    if (this.closed) return;
    const { columns, stride, height, cardWidth } = this.layout;
    const first = Math.max(0, Math.floor(this.grid.scrollTop / stride) - 1) * columns;
    const last = Math.min(this.matches.length, (Math.ceil((this.grid.scrollTop + this.grid.clientHeight) / stride) + 1) * columns);
    const paths = new Set(this.matches.slice(first, last).map((m) => m.entry.path));
    this.previews.prioritize(paths);
    for (const [path, card] of this.cards) {
      if (!paths.has(path)) {
        card.remove();
        this.cards.delete(path);
      }
    }
    for (let i = first; i < last; i++) {
      const match = this.matches[i], e = match.entry;
      let card = this.cards.get(e.path);
      if (!card) {
        card = this.makeCard(match, i);
        this.cards.set(e.path, card);
        this.layer.append(card);
      }
      card.style.width = cardWidth + "px";
      card.style.height = height + "px";
      card.style.left = i % columns * (cardWidth + 14) + "px";
      card.style.top = Math.floor(i / columns) * stride + "px";
      card.style.setProperty("--igf-page-scale", String((this.layout.compact ? 64 : cardWidth - 20) / 640));
      card.toggleClass("is-selected", i === this.selected);
      card.setAttribute("aria-selected", String(i === this.selected));
    }
    this.search.setAttribute("aria-activedescendant", this.cards.has(this.matches[this.selected]?.entry.path) ? this.uid + "-" + this.selected : "");
    let empty = this.layer.querySelector(".igf-empty");
    if (!this.matches.length && !empty) this.layer.createDiv({ cls: "igf-empty", text: "No matching files. Change the file type or try another search." });
    else if (this.matches.length) empty?.remove();
  }
  makeCard(match, index) {
    const e = match.entry, card = this.contentEl.ownerDocument.createElement("div");
    card.className = "igf-card";
    card.id = this.uid + "-" + index;
    card.setAttribute("role", "option");
    card.setAttribute("aria-labelledby", card.id + "-name " + card.id + "-type " + card.id + "-fullpath");
    card.setAttribute("aria-posinset", String(index + 1));
    card.setAttribute("aria-setsize", String(this.matches.length));
    const preview = card.createDiv({ cls: "igf-thumbnail", attr: { "aria-hidden": "true" } });
    preview.setAttribute("inert", "");
    const text = card.createDiv({ cls: "igf-text" });
    const name = text.createDiv({ cls: "igf-name", attr: { id: card.id + "-name", title: e.name } });
    (0, import_obsidian3.renderMatches)(name, e.name, match.nameRanges);
    if (match.alias) {
      const alias = text.createDiv({ cls: "igf-alias" });
      alias.appendText("Alias: ");
      (0, import_obsidian3.renderMatches)(alias, match.alias, match.aliasRanges ?? []);
    }
    const meta = text.createDiv({ cls: "igf-meta" });
    meta.createSpan({ cls: "igf-type igf-type-" + e.extension, text: e.extension.toUpperCase() || "FILE", attr: { id: card.id + "-type" } });
    const path = meta.createDiv({ cls: "igf-path", attr: { id: card.id + "-path", title: e.path } });
    if (match.pathRanges.length) (0, import_obsidian3.renderMatches)(path, e.folder, match.pathRanges.map(([a, b]) => [a, Math.min(b, e.folder.length)]).filter(([a, b]) => b > a));
    else {
      const label = this.paths.get(e.path) ?? e.folder, parts = label.split("/").filter(Boolean);
      if (parts[0] === "\u2026") {
        path.createSpan({ text: "\u2026/", cls: "igf-path-prefix" });
        parts.shift();
      }
      path.createSpan({ cls: "igf-branch", text: parts.shift() ?? "Vault root" });
      if (parts.length) path.createSpan({ cls: "igf-path-tail", text: " / " + parts.join(" / ") });
    }
    card.createSpan({ cls: "igf-sr-only", text: e.path, attr: { id: card.id + "-fullpath" } });
    card.onclick = (ev) => {
      void this.openPath(e.path, ev.metaKey || ev.ctrlKey ? "tab" : "current");
    };
    card.oncontextmenu = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.selected = index;
      this.draw();
      this.fileMenu(ev, e.path);
    };
    const file = this.app.vault.getAbstractFileByPath(e.path), revision = this.revision;
    if (file instanceof import_obsidian3.TFile) void this.previews.get(file).then((result) => {
      if (this.closed || revision !== this.revision || !card.isConnected) return;
      if (result) preview.replaceChildren(result.el);
      else preview.textContent = e.extension.toUpperCase();
    });
    return card;
  }
  move(delta) {
    if (!this.matches.length) return;
    this.selected = Math.max(0, Math.min(this.matches.length - 1, this.selected + delta));
    const top = Math.floor(this.selected / this.layout.columns) * this.layout.stride;
    if (top < this.grid.scrollTop) this.grid.scrollTop = top;
    else if (top + this.layout.height > this.grid.scrollTop + this.grid.clientHeight) this.grid.scrollTop = top + this.layout.height - this.grid.clientHeight;
    this.draw();
  }
  async openSelected(target) {
    if (this.queryFrame) {
      cancelAnimationFrame(this.queryFrame);
      this.queryFrame = 0;
      this.apply();
    }
    while (this.pendingSearch) await this.pendingSearch;
    if (this.closed) return;
    const entry = this.matches[this.selected]?.entry;
    if (entry) await this.openPath(entry.path, target);
  }
  async openPath(path, target) {
    if (this.closed) return;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian3.TFile)) {
      new import_obsidian3.Notice("This file has moved. Search again.");
      this.index();
      this.apply();
      return;
    }
    this.close();
    try {
      await this.app.workspace.getLeaf(target === "current" ? false : target).openFile(file);
    } catch (error) {
      new import_obsidian3.Notice("Could not open file: " + String(error));
    }
  }
  setScope(scope) {
    this.filter = scope;
    this.search.value = finderQuery(this.search.value).text;
    this.apply();
    this.search.focus();
  }
  zoom(delta) {
    const old = this.layout.stride, anchor = Math.floor(this.grid.scrollTop / old) * this.layout.columns;
    this.size = Math.max(60, Math.min(200, this.size + delta));
    this.measure();
    this.grid.scrollTop = Math.floor(anchor / this.layout.columns) * this.layout.stride;
    this.draw();
  }
  addScope(menu) {
    for (const [scope, label] of [["documents", "Notes and PDFs"], ["images", "Images"], ["all", "All file types"]]) menu.addItem((item) => item.setTitle(label).setChecked(this.filter === scope && !finderQuery(this.search.value).extensions.length).onClick(() => this.setScope(scope)));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("Reset gallery size").onClick(() => this.sizing?.reset()));
    const mod = import_obsidian3.Platform.isMacOS ? "\u2318" : "Ctrl";
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(`Larger thumbnails (${mod} +)`).onClick(() => this.zoom(10)));
    menu.addItem((i) => i.setTitle(`Smaller thumbnails (${mod} \u2212)`).onClick(() => this.zoom(-10)));
    menu.addItem((i) => i.setTitle(`Reset thumbnail size (${mod} 0)`).onClick(() => this.zoom(100 - this.size)));
  }
  scopeMenu(event) {
    this.menu?.hide();
    this.menu = new import_obsidian3.Menu();
    this.addScope(this.menu);
    if (event.detail === 0) {
      const r = this.status.getBoundingClientRect();
      this.menu.showAtPosition({ x: r.left, y: r.bottom });
    } else this.menu.showAtMouseEvent(event);
  }
  fileMenu(event, path) {
    this.menu?.hide();
    const menu = this.menu = new import_obsidian3.Menu();
    for (const [target, label] of [["current", "Open"], ["tab", "Open in new tab"], ["split", "Open to the right"], ["window", "Open in new window"]]) menu.addItem((i) => i.setTitle(label).onClick(() => void this.openPath(path, target)));
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian3.TFile) {
      menu.addSeparator();
      menu.addItem((i) => i.setTitle("Copy path").onClick(() => void navigator.clipboard.writeText(file.path)));
      this.app.workspace.trigger("file-menu", menu, file, "file-finder");
    }
    menu.addSeparator();
    this.addScope(menu);
    menu.showAtMouseEvent(event);
  }
  focusSearch() {
    this.search.focus();
    this.search.select();
  }
  onClose() {
    this.searchTicket++;
    this.saveSize(Math.round(this.size));
    this.closed = true;
    this.menu?.hide();
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.queryFrame);
    this.resize?.disconnect();
    this.owner.unload();
    this.previews?.close();
    this.contentEl.empty();
  }
};

// src/folder-browser.ts
var import_obsidian4 = require("obsidian");

// src/folders.ts
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
function cleanFolder(folder) {
  const parts = folder.trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.some((p) => p === ".." || p === "." || /[\0\r\n]/.test(p)))
    throw Error("Choose a folder within the selected source.");
  return parts.join("/");
}
function withinFolder(path, folder, recursive) {
  const local = path.replace(/^[^:]+:/, "");
  const prefix = folder ? folder + "/" : "";
  return local.startsWith(prefix) && (recursive || !local.slice(prefix.length).includes("/"));
}
async function folderPath(base, folder) {
  const root = await (0, import_promises.realpath)(base);
  const dest = await (0, import_promises.realpath)((0, import_node_path.resolve)(root, cleanFolder(folder)));
  const rel = (0, import_node_path.relative)(root, dest);
  if (rel === ".." || rel.startsWith("../") || (0, import_node_path.isAbsolute)(rel))
    throw Error("Folder is outside the selected source.");
  return dest;
}
var visible = (name) => !name.startsWith(".") && !["node_modules", "__pycache__", "venv"].includes(name);
async function childFolders(base, folder) {
  const path = await folderPath(base, folder);
  const children = [];
  for await (const entry of await (0, import_promises.opendir)(path)) {
    if (entry.isDirectory() && visible(entry.name)) children.push(entry.name);
  }
  return children.sort((a, b) => a.localeCompare(b));
}
async function scanFolder(base, folder, recursive, keep, cancelled, limit = 5e4) {
  folder = cleanFolder(folder);
  const start = await folderPath(base, folder);
  const paths = [];
  let capped = false;
  let visited = 0;
  const walk = async (dir, prefix) => {
    for await (const entry of await (0, import_promises.opendir)(dir)) {
      if (cancelled() || capped) return;
      if (!visible(entry.name)) continue;
      const name = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isDirectory() && recursive) await walk((0, import_node_path.resolve)(dir, entry.name), name);
      else if (entry.isFile() && keep(name)) {
        paths.push(name);
        if (paths.length >= limit) capped = true;
      }
      if (++visited % 200 === 0) await new Promise((done) => setTimeout(done, 0));
    }
  };
  await walk(start, folder);
  return { paths, capped };
}

// src/folder-browser.ts
var FolderBrowser = class extends import_obsidian4.Modal {
  constructor(app, label, start, base, done, cancelled) {
    super(app);
    this.label = label;
    this.base = base;
    this.done = done;
    this.cancelled = cancelled;
    try {
      this.folder = cleanFolder(start);
    } catch {
      this.folder = "";
    }
  }
  folder;
  query = "";
  children = [];
  ticket = 0;
  limit = 150;
  closed = false;
  selected = false;
  crumbs;
  list;
  status;
  search;
  choose;
  onOpen() {
    this.modalEl.classList.add("ig-folder-browser");
    this.titleEl.setText("Choose a folder");
    this.crumbs = this.contentEl.createDiv({ cls: "ig-breadcrumbs" });
    this.search = this.contentEl.createEl("input", { type: "search", placeholder: "Filter these folders\u2026", attr: { "aria-label": "Filter child folders" } });
    this.search.oninput = () => {
      this.query = this.search.value;
      this.limit = 150;
      this.renderList();
    };
    this.status = this.contentEl.createDiv({ cls: "ig-count", attr: { "aria-live": "polite" } });
    this.list = this.contentEl.createDiv({ cls: "ig-folder-list" });
    const actions = this.contentEl.createDiv({ cls: "ig-controls" });
    this.choose = actions.createEl("button", { text: "Use this folder", cls: "mod-cta" });
    this.choose.onclick = () => {
      this.selected = true;
      this.done(this.folder);
      this.close();
    };
    actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    void this.navigate(this.folder);
  }
  async navigate(folder) {
    const ticket = ++this.ticket;
    this.folder = folder;
    this.query = "";
    this.search.value = "";
    this.limit = 150;
    this.crumbs.empty();
    const up = this.crumbs.createEl("button", { text: "\u2191 Up" });
    up.disabled = !folder;
    up.onclick = () => void this.navigate(folder.split("/").slice(0, -1).join("/"));
    this.crumbs.createEl("button", { text: this.label }).onclick = () => void this.navigate("");
    const parts = folder ? folder.split("/") : [];
    parts.forEach((part, i) => {
      this.crumbs.createSpan({ text: "/" });
      this.crumbs.createEl("button", { text: part }).onclick = () => void this.navigate(parts.slice(0, i + 1).join("/"));
    });
    this.children = [];
    this.list.empty();
    this.status.setText("Reading folders\u2026");
    this.choose.disabled = true;
    try {
      let children;
      if (this.base) children = await childFolders(this.base, folder);
      else {
        const parent = folder ? this.app.vault.getAbstractFileByPath(folder) : this.app.vault.getRoot();
        if (!(parent instanceof import_obsidian4.TFolder)) throw Error("Folder not found. Use the breadcrumbs to choose its parent.");
        children = parent.children.filter((f) => f instanceof import_obsidian4.TFolder && !f.name.startsWith(".")).map((f) => f.name).sort((a, b) => a.localeCompare(b));
      }
      if (this.closed || ticket !== this.ticket) return;
      this.children = children;
      this.choose.disabled = false;
      this.renderList();
    } catch (e) {
      if (ticket === this.ticket && !this.closed) this.status.setText(String(e));
    }
  }
  renderList() {
    this.list.empty();
    const children = this.children.filter((name) => name.toLowerCase().includes(this.query.toLowerCase()));
    this.status.setText(`${children.length} folder${children.length === 1 ? "" : "s"}${children.length > this.limit ? ` \xB7 showing ${this.limit}` : ""}`);
    for (const name of children.slice(0, this.limit)) {
      this.list.createEl("button", { text: "\u{1F4C1} " + name, attr: { "aria-label": "Open folder " + name } }).onclick = () => void this.navigate(this.folder ? this.folder + "/" + name : name);
    }
    if (!children.length) this.list.createEl("p", { text: "No subfolders here. You can use this folder or go up." });
    if (children.length > this.limit) this.list.createEl("button", { text: "Show more folders" }).onclick = () => {
      this.limit += 150;
      this.renderList();
    };
  }
  onClose() {
    if (!this.selected) this.cancelled?.();
    this.closed = true;
    ++this.ticket;
    this.contentEl.empty();
  }
};

// src/main.ts
var import_obsidian8 = require("obsidian");
var import_view = require("@codemirror/view");

// src/embeds.ts
var escaped = (s, i) => {
  let n = 0;
  while (i > 0 && s[--i] === "\\") n++;
  return n % 2 === 1;
};
function scanEmbeds(text) {
  const result = [];
  let fence = "", inline = 0, comment = "";
  let frontmatter = text.startsWith("---\n") || text.startsWith("---\r\n");
  for (let i = 0; i < text.length; i++) {
    if (i === 0 || text[i - 1] === "\n") {
      const line = text.slice(
        i,
        text.indexOf("\n", i) < 0 ? text.length : text.indexOf("\n", i)
      );
      if (frontmatter) {
        if (i > 0 && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false;
        i += line.length;
        continue;
      }
      const f = /^(?:\s*>\s*)*\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (f) {
        if (!fence) fence = f[1];
        else if (f[1][0] === fence[0] && f[1].length >= fence.length)
          fence = "";
        i += line.length;
        inline = 0;
        continue;
      }
      if (fence) {
        i += line.length;
        continue;
      }
    }
    if (comment) {
      if (text.startsWith(comment, i)) {
        i += comment.length - 1;
        comment = "";
      }
      continue;
    }
    if (!inline && (text.startsWith("<!--", i) || text.startsWith("%%", i))) {
      comment = text.startsWith("<!--", i) ? "-->" : "%%";
      i += text.startsWith("<!--", i) ? 3 : 1;
      continue;
    }
    if (text[i] === "`" && !escaped(text, i)) {
      let n = 1;
      while (text[i + n] === "`") n++;
      if (!inline) inline = n;
      else if (inline === n) inline = 0;
      i += n - 1;
      continue;
    }
    if (inline || text[i] !== "!" || text[i + 1] !== "[" || escaped(text, i))
      continue;
    if (text[i + 2] === "[") {
      let end2 = i + 3;
      while (end2 < text.length && !(text.slice(end2, end2 + 2) === "]]" && !escaped(text, end2)) && text[end2] !== "\n")
        end2++;
      if (text.slice(end2, end2 + 2) !== "]]") continue;
      let sep = i + 3;
      while (sep < end2 && (text[sep] !== "|" || escaped(text, sep))) sep++;
      const finish2 = end2 + 2;
      result.push({
        start: i,
        end: finish2,
        raw: text.slice(i, finish2),
        kind: "wiki",
        destination: text.slice(i + 3, sep),
        label: sep < end2 ? text.slice(sep + 1, end2) : "",
        pathStart: i + 3,
        pathEnd: sep,
        labelStart: sep < end2 ? sep + 1 : end2,
        labelEnd: end2
      });
      i = finish2 - 1;
      continue;
    }
    let close = i + 2, depth = 1;
    for (; close < text.length; close++) {
      if (escaped(text, close)) continue;
      if (text[close] === "[") depth++;
      if (text[close] === "]" && !--depth) break;
    }
    if (depth || text[close + 1] !== "(") continue;
    let p = close + 2;
    while (/[ \t]/.test(text[p] ?? "") && p < text.length) p++;
    const angled = text[p] === "<";
    const start = p + (angled ? 1 : 0);
    let end = start;
    if (angled) {
      while (end < text.length && (text[end] !== ">" || escaped(text, end)) && text[end] !== "\n")
        end++;
      if (text[end] !== ">") continue;
    } else {
      let nesting = 0;
      for (; end < text.length; end++) {
        const c = text[end];
        if (escaped(text, end)) continue;
        if (c === "(") nesting++;
        else if (c === ")") {
          if (!nesting) break;
          nesting--;
        } else if (/\s/.test(c) && !nesting) break;
      }
    }
    let finish = angled ? end + 1 : end;
    while (/[ \t\r\n]/.test(text[finish] ?? "") && finish < text.length)
      finish++;
    if (text[finish] === '"' || text[finish] === "'") {
      const q = text[finish++];
      while (finish < text.length && (text[finish] !== q || escaped(text, finish)))
        finish++;
      if (text[finish] !== q) continue;
      finish++;
      while (/[ \t\r\n]/.test(text[finish] ?? "") && finish < text.length)
        finish++;
    }
    if (text[finish] !== ")") continue;
    finish++;
    result.push({
      start: i,
      end: finish,
      raw: text.slice(i, finish),
      kind: "markdown",
      label: text.slice(i + 2, close),
      destination: text.slice(start, end),
      labelStart: i + 2,
      labelEnd: close,
      pathStart: start,
      pathEnd: end
    });
    i = finish - 1;
  }
  return result;
}
function layout(label) {
  const parts = label.split("|");
  let width, height, align;
  const last = parts.at(-1) ?? "";
  if (/^\d+(?:x\d+)?$/.test(last)) {
    const dims = parts.pop().split("x").map(Number);
    [width, height] = dims;
  }
  const kept = parts.filter((p) => {
    if (/^(left|center|right)$/.test(p)) {
      align = p;
      return false;
    }
    return true;
  });
  return { alt: kept.join("|"), width, height, align };
}
function changedEmbed(e, change) {
  let raw = e.raw;
  const edits = [];
  if (change.destination !== void 0) {
    const path = e.kind === "markdown" ? change.destination.replace(/%/g, "%25").replace(/#/g, "%23").replace(/\?/g, "%3F").replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/</g, "%3C").replace(/>/g, "%3E") : change.destination;
    if (/[\r\n]/.test(path) || e.kind === "wiki" && /[|\[\]]/.test(path))
      throw Error(
        "This filename cannot be represented safely as a wiki image."
      );
    edits.push({
      from: e.pathStart - e.start,
      to: e.pathEnd - e.start,
      value: path
    });
  }
  if (change.align !== void 0 || change.width !== void 0) {
    const l = layout(e.label);
    const width = change.width === void 0 ? l.width : change.width;
    if (width !== void 0 && width !== null && (!Number.isInteger(width) || width < 1 || width > 1e4))
      throw Error("Width must be a whole number from 1 to 10000 pixels.");
    const parts = [l.alt, change.align ?? l.align].filter(Boolean);
    if (width != null)
      parts.push(
        String(width) + (change.width === void 0 && l.height ? `x${l.height}` : "")
      );
    let value = parts.join("|");
    if (e.kind === "wiki" && e.labelStart === e.labelEnd && e.pathEnd === e.labelEnd && value)
      value = "|" + value;
    let from = e.labelStart - e.start;
    if (e.kind === "wiki" && !value && e.pathEnd < e.labelStart) from--;
    edits.push({ from, to: e.labelEnd - e.start, value });
  }
  for (const x of edits.sort((a, b) => b.from - a.from))
    raw = raw.slice(0, x.from) + x.value + raw.slice(x.to);
  return raw;
}
function replaceExact(current, snapshot, e, replacement) {
  if (current !== snapshot || current.slice(e.start, e.end) !== e.raw)
    throw Error(
      "The note changed while the image controls were open. Reopen them on the current image."
    );
  return current.slice(0, e.start) + replacement + current.slice(e.end);
}
function imageFile(path) {
  return /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(path);
}
function foldersFor(source, attachment, configured) {
  const parent = source.includes("/") ? source.slice(0, source.lastIndexOf("/")) : "";
  const join = (a, b) => [a, b].filter(Boolean).join("/").replace(/\/+/g, "/");
  return [
    ...new Set(
      [
        configured.trim().replace(/^\/+|\/+$/g, ""),
        attachment === "." ? parent : attachment.startsWith("./") ? join(parent, attachment.slice(2)) : attachment,
        parent ? join(parent, "images") : "images",
        parent ? join(parent, "attachments") : "attachments"
      ].filter((x) => x && x !== "/")
    )
  ];
}
function embedAtCursor(text, offset) {
  const all = scanEmbeds(text);
  const inside = all.find((e) => offset >= e.start && offset < e.end);
  if (inside) return inside;
  const start = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const next = text.indexOf("\n", offset);
  const end = next < 0 ? text.length : next;
  const line = all.filter((e) => e.start >= start && e.end <= end);
  return line.length === 1 ? line[0] : void 0;
}

// src/picker.ts
var import_obsidian6 = require("obsidian");

// src/favorites.ts
var import_obsidian5 = require("obsidian");
var key = (f) => f.root + "\n" + f.folder.replace(/^\/+|\/+$/g, "");
var FolderFavorites = class {
  constructor(parent, store, current, apply, allowExternal = true) {
    this.store = store;
    this.current = current;
    this.apply = apply;
    this.allowExternal = allowExternal;
    this.select = parent.createEl("select", {
      attr: { "aria-label": "Favorite folders" }
    });
    this.select.onchange = () => {
      const chosen = this.store.get().find((f) => key(f) === this.select.value);
      if (chosen) {
        this.apply(chosen);
        this.refresh();
      }
    };
    this.star = parent.createEl("button");
    this.star.onclick = () => void this.toggle();
    this.refresh();
  }
  select;
  star;
  refresh() {
    const current = this.current();
    this.select.empty();
    this.select.createEl("option", { value: "", text: "Favorite folders\u2026" });
    for (const f of this.store.get().filter((f2) => this.allowExternal || !f2.root)) {
      this.select.createEl("option", {
        value: key(f),
        text: (f.root ? f.root + ":" : "Vault: ") + (f.folder || "/")
      });
    }
    this.select.value = "";
    const exists = this.store.get().some((f) => key(f) === key(current));
    this.star.setText(exists ? "\u2605 Favorited" : "\u2606 Favorite folder");
    this.star.setAttribute(
      "aria-label",
      exists ? "Remove this folder from favorites" : "Favorite this folder"
    );
    this.star.setAttribute("aria-pressed", String(exists));
  }
  async toggle() {
    const current = this.current();
    if (!current.root && !current.folder) {
      new import_obsidian5.Notice("Choose a folder or enter a folder prefix first.");
      return;
    }
    const before = this.store.get();
    const exists = before.some((f) => key(f) === key(current));
    try {
      await this.store.set(
        exists ? before.filter((f) => key(f) !== key(current)) : [...before, { ...current }]
      );
      this.refresh();
    } catch (e) {
      new import_obsidian5.Notice("Could not save favorite: " + String(e));
    }
  }
};

// src/picker.ts
var GalleryModal = class extends import_obsidian6.Modal {
  constructor(app, configured, options, done, favoritesStore) {
    super(app);
    this.configured = configured;
    this.options = options;
    this.done = done;
    this.favoritesStore = favoritesStore;
  }
  query = "";
  images = [];
  recursive = true;
  timer;
  folder = "";
  category = "";
  limit = 80;
  favorites;
  resolved = false;
  grid;
  count;
  more;
  onOpen() {
    this.images = this.app.vault.getFiles().filter((f) => imageFile(f.path));
    this.modalEl.classList.add("ig-modal");
    this.titleEl.setText(this.options.title ?? "Choose an image");
    const controls = this.contentEl.createDiv({ cls: "ig-controls" });
    const search = controls.createEl("input", {
      type: "search",
      placeholder: "Search filenames or paths\u2026"
    });
    search.setAttribute("aria-label", "Search images");
    search.addEventListener("input", () => {
      this.query = search.value.toLocaleLowerCase();
      this.limit = 80;
      this.schedule();
    });
    const select = controls.createEl("select");
    select.setAttribute("aria-label", "Image folder");
    const attachment = this.app.vault.getConfig("attachmentFolderPath") ?? "";
    const current = this.options.currentPath?.split("/").slice(0, -1).join("/");
    const folders = [
      ...new Set(
        [
          current,
          ...foldersFor(
            this.options.sourcePath ?? "",
            attachment,
            this.configured
          )
        ].filter(Boolean)
      )
    ];
    folders.forEach((p) => select.createEl("option", { value: p, text: p }));
    select.createEl("option", { value: "", text: "All vault images" });
    this.folder = current ?? (this.configured && this.app.vault.getFiles().some(
      (f) => imageFile(f.path) && f.path.startsWith(this.configured + "/")
    ) ? this.configured : "");
    select.value = this.folder;
    select.addEventListener("change", () => {
      this.folder = select.value;
      root.value = this.folder;
      this.limit = 80;
      this.draw();
    });
    const category = controls.createEl("select");
    category.setAttribute("aria-label", "Image folder category");
    for (const [value, text] of [
      ["", "All image locations"],
      ["images", "Images folders"],
      ["assets", "Assets folders"],
      ["figures", "Figures folders"]
    ])
      category.createEl("option", { value, text });
    category.onchange = () => {
      this.category = category.value;
      this.limit = 80;
      this.draw();
    };
    const root = controls.createEl("input", {
      type: "text",
      placeholder: "Optional folder prefix (includes subfolders)"
    });
    root.setAttribute("aria-label", "Search under folder");
    root.value = this.folder;
    root.oninput = () => {
      this.folder = root.value.trim().replace(/\/$/, "");
      select.value = "";
      this.limit = 80;
      this.schedule();
    };
    controls.createEl("button", { text: "Browse folders\u2026" }).onclick = () => {
      new FolderBrowser(this.app, "This vault", this.folder, void 0, (folder) => {
        this.folder = folder;
        root.value = folder;
        if (!Array.from(select.options).some((o) => o.value === folder)) select.createEl("option", { value: folder, text: folder || "All vault images" });
        select.value = folder;
        this.query = "";
        search.value = "";
        this.limit = 80;
        this.draw();
      }).open();
    };
    const recursion = controls.createEl("label", { cls: "ig-recursion" });
    const recursive = recursion.createEl("input", { type: "checkbox", attr: { "aria-label": "Include subfolders" } });
    recursive.checked = true;
    recursion.createSpan({ text: "Include subfolders" });
    recursive.onchange = () => {
      this.recursive = recursive.checked;
      this.limit = 80;
      this.draw();
    };
    if (this.favoritesStore)
      this.favorites = new FolderFavorites(
        controls,
        this.favoritesStore,
        () => ({ root: "", folder: this.folder }),
        (favorite) => {
          this.query = "";
          search.value = "";
          this.category = "";
          category.value = "";
          this.folder = favorite.folder;
          root.value = this.folder;
          if (!Array.from(select.options).some((o) => o.value === this.folder))
            select.createEl("option", {
              value: this.folder,
              text: this.folder
            });
          select.value = this.folder;
          this.limit = 80;
          this.draw();
        },
        false
      );
    this.count = this.contentEl.createDiv({
      cls: "ig-count",
      attr: { "aria-live": "polite" }
    });
    this.grid = this.contentEl.createDiv({ cls: "ig-grid" });
    this.more = this.contentEl.createEl("button", { text: "Show more images" });
    this.more.onclick = () => {
      this.limit += 80;
      this.draw();
    };
    this.draw();
    search.focus();
  }
  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.draw(), 250);
  }
  draw() {
    clearTimeout(this.timer);
    this.favorites?.refresh();
    const fuzzy = this.query ? (0, import_obsidian6.prepareFuzzySearch)(this.query) : null;
    const files = this.images.filter((f) => folderMatches(f.path, this.folder, this.category) && withinFolder(f.path, this.folder, this.recursive)).map((f) => ({ f, score: fuzzy ? fuzzy(f.path)?.score : 0 })).filter((x) => x.score !== void 0).sort((a, b) => b.score - a.score || a.f.path.localeCompare(b.f.path)).map((x) => x.f);
    this.count.setText(
      `${files.length} image${files.length === 1 ? "" : "s"}${files.length > this.limit ? ` \xB7 showing ${this.limit}` : ""}`
    );
    this.grid.empty();
    if (!files.length)
      this.grid.createEl("p", {
        text: "No images here. Choose All vault images or change the search."
      });
    for (const file of files.slice(0, this.limit)) {
      const b = this.grid.createEl("button", {
        cls: "ig-thumbnail",
        attr: { "aria-label": file.path, title: file.path }
      });
      if (file.path === this.options.currentPath) b.classList.add("is-current");
      const img = b.createEl("img", {
        attr: {
          src: this.app.vault.getResourcePath(file),
          alt: file.basename,
          loading: "lazy"
        }
      });
      img.onerror = () => {
        img.remove();
        b.createSpan({ text: "Preview unavailable", cls: "ig-unavailable" });
      };
      b.createSpan({ text: file.name, cls: "ig-name" });
      b.createSpan({ text: file.parent?.path ?? "/", cls: "ig-path" });
      b.onclick = () => {
        this.resolved = true;
        this.done(file);
        this.close();
      };
    }
    this.more.hidden = files.length <= this.limit;
  }
  onClose() {
    clearTimeout(this.timer);
    this.contentEl.empty();
    if (!this.resolved) this.done(null);
  }
};

// src/file-picker.ts
var import_obsidian7 = require("obsidian");

// src/languages.ts
var Prism = require_prism();
var languages = {
  py: ["python", "Python"],
  wl: ["wolfram", "Wolfram Language"],
  wls: ["wolfram", "Wolfram Language"],
  nb: ["wolfram", "Mathematica notebook source"],
  js: ["javascript", "JavaScript"],
  ts: ["typescript", "TypeScript"],
  c: ["c", "C"],
  h: ["c", "C header"],
  cc: ["cpp", "C++"],
  cpp: ["cpp", "C++"],
  hpp: ["cpp", "C++ header"],
  sh: ["bash", "Shell"],
  bash: ["bash", "Bash"],
  zsh: ["bash", "Zsh"],
  lua: ["lua", "Lua"],
  json: ["json", "JSON"],
  ipynb: ["json", "Jupyter notebook source"],
  yaml: ["yaml", "YAML"],
  yml: ["yaml", "YAML"],
  toml: ["toml", "TOML"],
  r: ["r", "R"],
  jl: ["julia", "Julia"],
  rs: ["rust", "Rust"],
  go: ["go", "Go"],
  m: ["matlab", "MATLAB / Octave"],
  f: ["fortran", "Fortran"],
  f90: ["fortran", "Fortran"],
  tex: ["latex", "LaTeX"],
  sql: ["sql", "SQL"],
  blend: ["", "Blender scene"],
  vesta: ["", "VESTA structure"],
  csv: ["", "CSV data"],
  tsv: ["", "TSV data"],
  log: ["", "Log"],
  out: ["", "Text output"],
  txt: ["", "Plain text"],
  md: ["markdown", "Markdown"],
  pdf: ["", "PDF"]
};
function languageFor(path) {
  const name = path.split("/").pop();
  if (/^(OUTCAR|INCAR|POSCAR|CONTCAR|OSZICAR|KPOINTS|DOSCAR|EIGENVAL|XDATCAR)$/.test(
    name
  ))
    return { id: "", label: "VASP \xB7 " + name };
  const [id, label] = languages[name.split(".").pop().toLowerCase()] ?? [
    "",
    "Plain text"
  ];
  return { id, label };
}
function highlightedCode(text, path) {
  const { id } = languageFor(path);
  return id && Prism.languages[id] ? Prism.highlight(text, Prism.languages[id], id) : Prism.util.encode(text);
}

// src/file-picker.ts
var FileGalleryModal = class extends import_obsidian7.Modal {
  constructor(app, options, done, favoritesStore) {
    super(app);
    this.options = options;
    this.done = done;
    this.favoritesStore = favoritesStore;
  }
  favorites;
  query = "";
  folder = "";
  category = "";
  kind = "all";
  page = 0;
  recursive = true;
  refreshTimer;
  matchCache;
  scopeNote = "";
  pendingScan = false;
  entries = [];
  grid;
  count;
  generation = 0;
  cleanup = [];
  resolved = false;
  selectedRoot = "";
  roots = [];
  rootSelect;
  scan = 0;
  indexedRoot = "";
  bridge() {
    return this.app.plugins?.getPlugin("code-links");
  }
  onOpen() {
    this.modalEl.classList.add("ig-modal", "ig-file-modal");
    this.titleEl.setText(this.options.title ?? "Browse files to link");
    this.query = this.options.query ?? "";
    this.kind = this.options.kind ?? "all";
    this.entries = this.app.vault.getFiles().filter((f) => usefulFile(f.path)).map((file) => ({ path: file.path, file }));
    const controls = this.contentEl.createDiv({ cls: "ig-controls" });
    this.rootSelect = controls.createEl("select", {
      attr: { "aria-label": "Source folder" }
    });
    this.rootSelect.createEl("option", { value: "", text: "This vault" });
    this.rootSelect.disabled = this.kind !== "code";
    this.rootSelect.onchange = () => {
      this.selectedRoot = this.rootSelect.value;
      this.folder = "";
      this.recursive = !this.selectedRoot;
      const recursive2 = this.contentEl.querySelector('[aria-label="Include subfolders"]');
      if (recursive2) recursive2.checked = this.recursive;
      const field = this.contentEl.querySelector(
        '[aria-label="File folder prefix"]'
      );
      if (field) field.value = "";
      this.page = 0;
      void this.loadExternal();
    };
    void this.loadRoots();
    const search = controls.createEl("input", {
      type: "search",
      placeholder: "Search filenames or paths\u2026",
      attr: { "aria-label": "Search files" }
    });
    search.value = this.query;
    search.oninput = () => {
      this.query = search.value;
      this.page = 0;
      this.queueRefresh(false);
    };
    const kind = controls.createEl("select", {
      attr: { "aria-label": "File type" }
    });
    for (const [value, text] of [
      ["all", "All files"],
      ["notes", "Notes"],
      ["pdf", "PDFs"],
      ["images", "Images"],
      ["code", "Code and data"]
    ])
      kind.createEl("option", { value, text });
    kind.value = this.kind;
    kind.onchange = () => {
      this.kind = kind.value;
      this.rootSelect.disabled = this.kind !== "code";
      if (this.kind !== "code") {
        this.selectedRoot = "";
        this.rootSelect.value = "";
      }
      this.page = 0;
      void this.loadExternal();
    };
    const category = controls.createEl("select", {
      attr: { "aria-label": "Folder category" }
    });
    for (const [value, text] of [
      ["", "All folders"],
      ["scripts", "Scripts folders"],
      ["images", "Images folders"],
      ["assets", "Assets folders"],
      ["figures", "Figures folders"]
    ])
      category.createEl("option", { value, text });
    category.onchange = () => {
      this.category = category.value;
      this.page = 0;
      void this.draw();
    };
    const folder = controls.createEl("input", {
      placeholder: "Folder prefix, including subfolders",
      attr: { "aria-label": "File folder prefix" }
    });
    folder.oninput = () => {
      this.folder = folder.value;
      this.page = 0;
      this.queueRefresh(true);
    };
    controls.createEl("button", { text: "Browse folders\u2026" }).onclick = () => {
      const external = this.roots.find((r) => r.name === this.selectedRoot);
      new FolderBrowser(this.app, external ? external.name + ":" : "This vault", this.folder, external?.path, (selected) => {
        this.folder = selected;
        folder.value = selected;
        this.page = 0;
        this.query = "";
        search.value = "";
        this.queueRefresh(true, 0);
      }).open();
    };
    const recursion = controls.createEl("label", { cls: "ig-recursion" });
    const recursive = recursion.createEl("input", { type: "checkbox", attr: { "aria-label": "Include subfolders" } });
    recursive.checked = this.recursive;
    recursion.createSpan({ text: "Include subfolders" });
    recursive.onchange = () => {
      this.recursive = recursive.checked;
      this.page = 0;
      this.queueRefresh(true, 0);
    };
    if (this.favoritesStore)
      this.favorites = new FolderFavorites(
        controls,
        this.favoritesStore,
        () => ({ root: this.selectedRoot, folder: this.folder }),
        (favorite) => {
          this.query = "";
          search.value = "";
          this.category = "";
          category.value = "";
          this.selectedRoot = favorite.root;
          this.selectRoot(favorite.root);
          this.folder = favorite.folder;
          folder.value = this.folder;
          if (favorite.root) {
            this.kind = "code";
            kind.value = "code";
            this.rootSelect.disabled = false;
          }
          this.page = 0;
          this.queueRefresh(true, 0);
        }
      );
    this.count = this.contentEl.createDiv({
      cls: "ig-count",
      attr: { "aria-live": "polite" }
    });
    this.grid = this.contentEl.createDiv({ cls: "ig-file-grid" });
    const nav = this.contentEl.createDiv({ cls: "ig-controls" });
    nav.createEl("button", { text: "Previous page" }).onclick = () => {
      if (this.page) {
        this.page--;
        void this.draw();
      }
    };
    nav.createEl("button", { text: "Next page" }).onclick = () => {
      if ((this.page + 1) * 6 < this.matches().length) {
        this.page++;
        void this.draw();
      }
    };
    void this.loadExternal();
    search.focus();
  }
  async loadRoots() {
    const bridge = this.bridge();
    if (!bridge?.call) return;
    try {
      this.roots = (await bridge.call("roots")).items.filter(
        (r) => r.exists
      );
      if (!this.contentEl.isConnected) return;
      for (const root of this.roots.filter((r) => !r.retired && !r.redirect))
        this.rootSelect.createEl("option", {
          value: root.name,
          text: root.name + ": \u2014 " + root.path
        });
      if (this.selectedRoot) {
        this.selectRoot(this.selectedRoot);
        await this.loadExternal();
      }
      const prefix = this.query.match(/^([A-Za-z][\w-]*):/)?.[1];
      if (prefix && this.roots.some((r) => r.name === prefix)) {
        this.selectedRoot = prefix;
        this.selectRoot(prefix);
        this.kind = "code";
        this.rootSelect.disabled = false;
        const type = this.contentEl.querySelector('[aria-label="File type"]');
        if (type) type.value = "code";
        const target = this.query.slice(prefix.length + 1);
        this.folder = target.includes("/") ? target.slice(0, target.lastIndexOf("/")) : "";
        const field = this.contentEl.querySelector('[aria-label="File folder prefix"]');
        if (field) field.value = this.folder;
        this.recursive = false;
        const check = this.contentEl.querySelector('[aria-label="Include subfolders"]');
        if (check) check.checked = false;
        await this.loadExternal();
      }
    } catch {
    }
  }
  selectRoot(name) {
    const root = this.roots.find((r) => r.name === name);
    if (root && !Array.from(this.rootSelect.options).some((o) => o.value === name))
      this.rootSelect.createEl("option", { value: name, text: name + ": \u2014 " + root.path + " (saved link)" });
    this.rootSelect.value = name;
  }
  queueRefresh(scan, delay = 250) {
    clearTimeout(this.refreshTimer);
    ++this.generation;
    if (scan) ++this.scan;
    this.pendingScan ||= scan;
    this.refreshTimer = setTimeout(() => {
      if (!this.contentEl.isConnected) return;
      const scan2 = this.pendingScan;
      this.pendingScan = false;
      if (scan2) void this.loadExternal();
      else void this.draw();
    }, delay);
  }
  async loadExternal() {
    const root = this.roots.find((r) => r.name === this.selectedRoot);
    const ticket = ++this.scan;
    if (!root) {
      this.entries = this.entries.filter((e) => !e.external);
      this.indexedRoot = "";
      this.scopeNote = "";
      void this.draw();
      return;
    }
    let folder;
    try {
      folder = cleanFolder(this.folder);
    } catch (e) {
      this.count.setText(String(e));
      return;
    }
    const key2 = JSON.stringify([root.name, folder, this.recursive]);
    if (this.indexedRoot === key2) {
      void this.draw();
      return;
    }
    this.entries = this.entries.filter((e) => !e.external);
    ++this.generation;
    this.previewCleanup();
    this.grid.empty();
    this.count.setText("Reading " + root.name + ":" + folder + " \u2026");
    try {
      const result = await scanFolder(
        root.path,
        folder,
        this.recursive,
        (name) => usefulFile(name) && !/[\n\r|#{}\[\]]/.test(name),
        () => ticket !== this.scan || !this.contentEl.isConnected
      );
      if (ticket !== this.scan || !this.contentEl.isConnected) return;
      this.entries = this.entries.filter((e) => !e.external).concat(result.paths.map((path) => ({ path: root.name + ":" + path, external: true })));
      this.indexedRoot = key2;
      this.scopeNote = result.capped ? " \xB7 first 50,000 files; choose a subfolder to narrow the scan" : "";
      void this.draw();
    } catch (e) {
      if (ticket === this.scan && this.contentEl.isConnected) this.count.setText("Cannot read this folder: " + String(e));
    }
  }
  matches() {
    const key2 = JSON.stringify([this.query, this.folder, this.category, this.kind, this.selectedRoot, this.recursive]);
    if (this.matchCache?.key === key2 && this.matchCache.entries === this.entries) return this.matchCache.result;
    const fuzzy = this.query.trim() ? (0, import_obsidian7.prepareFuzzySearch)(this.query.trim()) : null;
    const result = this.entries.filter(
      (e) => (this.selectedRoot ? e.external && e.path.startsWith(this.selectedRoot + ":") : !e.external) && kindMatches(e.path, this.kind) && folderMatches(e.path, this.folder, this.category) && withinFolder(e.path, this.folder.trim().replace(/^\/+|\/+$/g, ""), this.recursive)
    ).map((e) => ({ e, score: fuzzy ? fuzzy(e.path)?.score : 0 })).filter((x) => x.score !== void 0).sort((a, b) => b.score - a.score || a.e.path.localeCompare(b.e.path)).map((x) => x.e);
    this.matchCache = { key: key2, entries: this.entries, result };
    return result;
  }
  async draw() {
    this.favorites?.refresh();
    const gen = ++this.generation;
    this.previewCleanup();
    this.grid.empty();
    const matches = this.matches();
    this.page = Math.min(
      this.page,
      Math.max(0, Math.ceil(matches.length / 6) - 1)
    );
    this.count.setText(
      `${matches.length} file${matches.length === 1 ? "" : "s"} \xB7 page ${this.page + 1} of ${Math.max(1, Math.ceil(matches.length / 6))}${this.scopeNote}`
    );
    if (!matches.length)
      this.grid.createEl("p", {
        text: "No matching files. Try another type, folder or search."
      });
    for (const e of matches.slice(this.page * 6, this.page * 6 + 6)) {
      const card = this.grid.createDiv({ cls: "ig-file-card" });
      card.createDiv({ cls: "ig-file-title", text: e.path.split("/").pop() });
      card.createDiv({ cls: "ig-path", text: e.path, attr: { title: e.path } });
      card.createSpan({
        cls: "ig-language",
        text: imagePath(e.path) ? "Image" : languageFor(e.path).label
      });
      const body = card.createDiv({
        cls: "ig-file-preview",
        attr: { tabindex: "0", "aria-label": `Preview ${e.path}` }
      });
      body.setText("Loading preview\u2026");
      card.createEl("button", { text: "Insert link" }).onclick = () => {
        try {
          const code = e.external || this.kind === "code" || codePath(e.path);
          const path = e.path;
          const link = pickedLink(path, !!code);
          this.resolved = true;
          this.done({ path, link, code: !!code });
          this.close();
        } catch (error) {
          body.setText(String(error));
        }
      };
      void this.preview(e, body, gen).catch((error) => {
        if (gen === this.generation)
          body.setText(`Preview unavailable: ${String(error)}`);
      });
    }
  }
  previewDisposers = [];
  previewCleanup() {
    for (const fn of this.previewDisposers.splice(0)) fn();
  }
  async preview(e, body, gen) {
    const alive = () => gen === this.generation && body.isConnected;
    await new Promise((done) => setTimeout(done, 100));
    if (!alive()) return;
    if (e.file && imagePath(e.path)) {
      body.empty();
      body.createEl("img", {
        attr: {
          src: this.app.vault.getResourcePath(e.file),
          alt: e.file.basename
        }
      });
      return;
    }
    if (e.file && e.file.extension === "pdf") {
      if (e.file.stat.size > 60 * 1024 * 1024) {
        body.setText(
          "PDF exceeds the 60 MB preview limit. Open the original file to inspect it."
        );
        return;
      }
      const lib = await (0, import_obsidian7.loadPdfJs)();
      if (!alive()) return;
      const bytes = await this.app.vault.readBinary(e.file);
      if (!alive()) return;
      const task = lib.getDocument({ data: new Uint8Array(bytes) });
      this.previewDisposers.push(() => void task.destroy());
      const pdf = await task.promise;
      if (!alive()) return;
      body.empty();
      let page = 1, busy = false;
      const next = body.createEl("button", {
        text: `Load page 1 of ${pdf.numPages}`
      });
      const load = async () => {
        if (busy || page > pdf.numPages || !alive()) return;
        busy = true;
        try {
          const p = await pdf.getPage(page);
          if (!alive()) return;
          const viewport = p.getViewport({ scale: 1 });
          const scaled = p.getViewport({
            scale: Math.min(1.5, 650 / viewport.width)
          });
          const canvas = body.ownerDocument.createElement("canvas");
          canvas.width = scaled.width;
          canvas.height = scaled.height;
          body.insertBefore(canvas, next);
          const render = p.render({
            canvasContext: canvas.getContext("2d"),
            viewport: scaled
          });
          await render.promise;
          page++;
          next.setText(`Load page ${page} of ${pdf.numPages}`);
          next.hidden = page > pdf.numPages;
        } finally {
          busy = false;
        }
      };
      next.onclick = () => void load().catch(() => {
        next.setText("Cannot render this page");
      });
      await load();
      return;
    }
    let text;
    if (e.external) {
      const bridge = this.bridge();
      const result = await bridge.call("read", { raw: "{{" + e.path + "}}" });
      if (!alive()) return;
      if (typeof result.text === "string") text = result.text;
      else {
        const fs = require("fs/promises");
        const handle = await fs.open(result.path, "r");
        try {
          const data = Buffer.alloc(256 * 1024);
          const read = await handle.read(data, 0, data.length, 0);
          text = data.subarray(0, read.bytesRead).toString("utf8");
        } finally {
          await handle.close();
        }
      }
    } else if (e.file && (e.file.extension === "md" || codePath(e.path)) && !/\.(blend)$/i.test(e.path)) {
      if (e.file.stat.size > 2 * 1024 * 1024 && this.app.vault.adapter instanceof import_obsidian7.FileSystemAdapter) {
        const fs = require("fs/promises");
        const handle = await fs.open(
          this.app.vault.adapter.getFullPath(e.path),
          "r"
        );
        try {
          const data = Buffer.alloc(256 * 1024);
          const read = await handle.read(data, 0, data.length, 0);
          text = data.subarray(0, read.bytesRead).toString("utf8");
        } finally {
          await handle.close();
        }
      } else text = await this.app.vault.cachedRead(e.file);
    } else {
      body.setText(
        "No inline preview for this file type. You can still insert its link."
      );
      return;
    }
    if (!alive()) return;
    body.empty();
    if (text.includes("\0")) {
      body.setText("Binary file; no text preview.");
      return;
    }
    if (e.file?.extension === "md") {
      const component = new import_obsidian7.Component();
      component.load();
      this.previewDisposers.push(() => component.unload());
      const bridge = this.bridge();
      if (bridge?.renderInHost) body.dataset.codeLinksHost = "gallery";
      body.classList.add("markdown-rendered");
      const excerpt = text.slice(0, 4e4);
      await import_obsidian7.MarkdownRenderer.render(
        this.app,
        excerpt,
        body,
        e.file.path,
        component
      );
      if (!alive()) return;
      if (bridge?.renderInHost)
        await bridge.renderInHost(body, excerpt, e.file.path, component, null);
      if (text.length > excerpt.length)
        body.createEl("p", {
          text: "Preview shows the first 40,000 characters."
        });
    } else {
      const pre = body.createEl("pre", { cls: "ig-code" });
      const code = pre.createEl("code");
      code.className = "language-" + (languageFor(e.path).id || "text");
      let shown = 0;
      const append = () => {
        if (!alive()) return;
        const end = Math.min(shown + 24 * 1024, text.length, 256 * 1024);
        const fragment = body.ownerDocument.createElement("span");
        fragment.innerHTML = highlightedCode(text.slice(shown, end), e.path);
        code.append(fragment);
        shown = end;
      };
      append();
      if (shown < Math.min(text.length, 256 * 1024)) {
        const more = body.createEl("button", { text: "Load more code" });
        more.onclick = () => {
          append();
          more.hidden = shown >= Math.min(text.length, 256 * 1024);
        };
      }
      if (text.length >= 256 * 1024)
        body.createEl("p", { text: "Preview limited to the first 256 KB." });
    }
  }
  onClose() {
    clearTimeout(this.refreshTimer);
    ++this.generation;
    ++this.scan;
    this.previewCleanup();
    this.cleanup.forEach((fn) => fn());
    this.contentEl.empty();
    if (!this.resolved) this.done(null);
  }
};

// src/main.ts
var ImageOptions = class extends import_obsidian8.Modal {
  constructor(app, target, done) {
    super(app);
    this.target = target;
    this.done = done;
  }
  onOpen() {
    this.titleEl.setText("Image layout");
    const l = layout(this.target.embed.label);
    let align = l.align ?? "left";
    let width = void 0;
    const row = new import_obsidian8.Setting(this.contentEl).setName("Alignment");
    row.addDropdown(
      (d) => d.addOptions({ left: "Left", center: "Center", right: "Right" }).setValue(align).onChange((v) => align = v)
    );
    let field;
    new import_obsidian8.Setting(this.contentEl).setName("Width (pixels)").setDesc(
      "Leave blank for natural size. Height follows the image aspect ratio."
    ).addText((t) => {
      field = t.inputEl;
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.max = "10000";
      t.setValue(l.width ? String(l.width) : "");
    });
    new import_obsidian8.Setting(this.contentEl).addButton(
      (b) => b.setButtonText("Reset to natural size").onClick(() => {
        field.value = "";
        width = null;
      })
    ).addButton(
      (b) => b.setButtonText("Apply").setCta().onClick(() => {
        width = field.value.trim() ? Number(field.value) : null;
        if (width !== null && (!Number.isInteger(width) || width < 1 || width > 1e4)) {
          new import_obsidian8.Notice("Enter a whole-number width from 1 to 10000.");
          return;
        }
        this.done({ align, width });
        this.close();
      })
    ).addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ImageGallery = class extends import_obsidian8.Plugin {
  settings = { finderSize: 100, finderWidth: 0, finderHeight: 0, folder: "", favorites: [] };
  favoritesStore = {
    get: () => this.settings.favorites,
    set: async (value) => {
      this.settings.favorites = value;
      await this.saveData(this.settings);
    }
  };
  api;
  activeMenu;
  finder;
  targets = /* @__PURE__ */ new WeakMap();
  async onload() {
    this.settings = { ...this.settings, ...await this.loadData() };
    this.api = {
      version: 1,
      pickFolder: (options = {}) => new Promise((resolve2) => new FolderBrowser(this.app, options.label ?? "This vault", options.start ?? "", options.base, resolve2, () => resolve2(null)).open()),
      pickFile: (options) => new Promise(
        (resolve2) => new FileGalleryModal(
          this.app,
          options ?? {},
          resolve2,
          this.favoritesStore
        ).open()
      ),
      pickImage: (options) => new Promise(
        (resolve2) => new GalleryModal(
          this.app,
          this.settings.folder,
          options ?? {},
          resolve2,
          this.favoritesStore
        ).open()
      )
    };
    this.register(() => this.activeMenu?.hide());
    this.register(() => this.finder?.close());
    this.addSettingTab(new GallerySettings(this.app, this));
    this.addCommand({ id: "open-file-gallery", name: "Open file gallery", callback: () => {
      if (this.finder?.modalEl.isConnected) {
        this.finder.focusSearch();
        return;
      }
      this.finder = new FileFinder(this.app, this.settings.finderSize, (size) => {
        this.settings.finderSize = size;
        void this.saveData(this.settings);
      }, { width: this.settings.finderWidth || void 0, height: this.settings.finderHeight || void 0 }, (dimensions) => {
        this.settings.finderWidth = dimensions.width ?? 0;
        this.settings.finderHeight = dimensions.height ?? 0;
        void this.saveData(this.settings);
      });
      this.finder.open();
    } });
    this.addCommand({
      id: "insert-image",
      name: "Insert image from gallery",
      editorCallback: (editor, view) => void this.insertImage(editor, view)
    });
    this.addCommand({
      id: "browse-files",
      name: "Browse files to link",
      editorCallback: (editor, view) => void this.insertFile(editor, view)
    });
    this.addCommand({
      id: "browse-code",
      name: "Browse code to link",
      editorCallback: (editor, view) => void this.insertFile(editor, view, true)
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (rootMenu, editor, view) => {
        const menu = menuGroup(rootMenu, "insert", "Embed or link", "plus");
        menu.addItem(
          (i) => i.setTitle("Insert image from gallery\u2026").setIcon("images").onClick(() => void this.insertImage(editor, view))
        );
        const slot = linkAt(
          editor.getValue(),
          editor.posToOffset(editor.getCursor())
        );
        menu.addItem(
          (i) => i.setTitle(
            slot ? "Browse this link in gallery\u2026" : "Browse files to link\u2026"
          ).setIcon("gallery-horizontal").onClick(() => void this.insertFile(editor, view))
        );
        menu.addItem(
          (i) => i.setTitle("Browse code to link\u2026").setIcon("code").onClick(() => void this.insertFile(editor, view, true))
        );
      })
    );
    this.addCommand({
      id: "image-controls-at-cursor",
      name: "Open image controls at cursor",
      editorCallback: (editor, view) => {
        if (!view.file) return;
        const snapshot = editor.getValue();
        const embed = embedAtCursor(
          snapshot,
          editor.posToOffset(editor.getCursor())
        );
        if (!embed) {
          new import_obsidian8.Notice(
            "Place the cursor inside an image link, or on a line with one image."
          );
          return;
        }
        this.menu(void 0, { file: view.file, snapshot, embed });
      }
    });
    this.registerMarkdownPostProcessor(
      (el, ctx) => this.bindReading(el, ctx),
      1e3
    );
    const listen = (doc) => {
      let pressed;
      const imageAt = (target) => target.closest("img") ?? target.closest(".image-embed")?.querySelector("img");
      this.registerDomEvent(
        doc,
        "mousedown",
        (event) => {
          const img = imageAt(event.target);
          pressed = event.button === 2 && img ? { img, x: event.clientX, y: event.clientY, time: Date.now() } : void 0;
        },
        true
      );
      this.registerDomEvent(
        doc,
        "contextmenu",
        (event) => {
          const target = event.target;
          if (target.closest(".ss-stage, .ig-modal")) return;
          const held = pressed;
          pressed = void 0;
          const img = imageAt(target) ?? (held && Date.now() - held.time < 1500 && Math.abs(held.x - event.clientX) < 3 && Math.abs(held.y - event.clientY) < 3 ? held.img : null);
          if (!img || !img.isConnected) return;
          let found = this.targets.get(img);
          const cm = img.closest(".cm-editor");
          if (cm) {
            const view = import_view.EditorView.findFromDOM(cm);
            if (!view) return;
            const file = view.state.field(import_obsidian8.editorInfoField, false)?.file;
            if (!file) return;
            const snapshot = view.state.doc.toString();
            const widget = img.closest(".cm-embed-block") ?? img;
            let pos;
            try {
              pos = view.posAtDOM(widget);
            } catch {
              return;
            }
            const line = view.state.doc.lineAt(Math.min(pos, snapshot.length));
            let end = line.to;
            if (/^\s*>/.test(line.text)) {
              for (let n = line.number + 1; n <= view.state.doc.lines; n++) {
                const next = view.state.doc.line(n);
                if (!/^\s*>/.test(next.text)) break;
                end = next.to;
              }
            }
            const embeds = scanEmbeds(snapshot).filter(
              (e) => e.start >= line.from && e.end <= end
            );
            const imgs = widget === img ? [img] : Array.from(widget.querySelectorAll("img"));
            const index = imgs.indexOf(img);
            if (index >= 0 && embeds.length === imgs.length && embeds.every((e, i) => this.matches(imgs[i], e, file.path)))
              found = { file, snapshot, embed: embeds[index], editor: view };
            else {
              event.preventDefault();
              event.stopImmediatePropagation();
              new import_obsidian8.Notice(
                "This image cannot be mapped safely in Live Preview. Use Reading view."
              );
              return;
            }
          }
          if (found) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.menu(event, found);
          }
        },
        true
      );
    };
    listen(this.app.workspace.containerEl.ownerDocument);
    this.registerEvent(
      this.app.workspace.on(
        "window-open",
        (_leaf, win) => listen(win.document)
      )
    );
  }
  insertImage(editor, view) {
    if (!view.file) return;
    const file = view.file;
    const snapshot = editor.getValue();
    const pos = editor.getCursor();
    void this.api.pickImage({ sourcePath: file.path, title: "Insert image" }).then((f) => {
      if (!f) return;
      if (editor.getValue() !== snapshot || view.file !== file) {
        new import_obsidian8.Notice(
          "Note changed. Run Insert image again at the desired position."
        );
        return;
      }
      const link = this.app.fileManager.generateMarkdownLink(f, file.path);
      const made = scanEmbeds("!" + link)[0];
      if (!made) {
        new import_obsidian8.Notice("Cannot create an image link for this filename.");
        return;
      }
      editor.replaceRange(
        changedEmbed(made, { align: "center", width: 600 }),
        pos
      );
    }).catch((e) => this.error(e));
  }
  async insertFile(editor, view, code = false) {
    if (!view.file) return;
    const file = view.file, snapshot = editor.getValue(), cursor = editor.getCursor();
    const slot = linkAt(snapshot, editor.posToOffset(cursor));
    const from = slot ? editor.offsetToPos(slot.start) : editor.getCursor("from");
    const to = slot ? editor.offsetToPos(slot.end) : editor.getCursor("to");
    try {
      const choice = await this.api.pickFile({
        sourcePath: file.path,
        query: slot?.query,
        kind: code || slot?.syntax === "code" ? "code" : "all"
      });
      if (!choice) return;
      if (editor.getValue() !== snapshot || view.file !== file) {
        new import_obsidian8.Notice(
          "The text changed. Reopen the gallery at the intended link."
        );
        return;
      }
      editor.replaceRange(pickedLink(choice.path, choice.code, slot), from, to);
      editor.focus();
    } catch (e) {
      this.error(e);
    }
  }
  source(e, path) {
    let dest = e.destination.split("#")[0];
    try {
      if (e.kind === "markdown") dest = decodeURIComponent(dest);
    } catch {
    }
    dest = dest.replace(/\\([\\()[\] ])/g, "$1");
    return this.app.metadataCache.getFirstLinkpathDest(dest, path);
  }
  matches(img, e, path) {
    const file = this.source(e, path);
    if (file) {
      const expected = this.app.vault.getResourcePath(file).split("?")[0];
      return img.src.split("?")[0] === expected;
    }
    try {
      return new URL(e.destination, img.ownerDocument.baseURI).href === img.src;
    } catch {
      return false;
    }
  }
  async bindReading(el, ctx) {
    if (el.closest(".ss-stage, .ig-modal")) return;
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof import_obsidian8.TFile) || file.extension !== "md") return;
    const section = ctx.getSectionInfo(el);
    if (!section) return;
    const snapshot = await this.app.vault.cachedRead(file);
    const offsets = [0];
    for (let i = 0; i < snapshot.length; i++)
      if (snapshot[i] === "\n") offsets.push(i + 1);
    const start = offsets[section.lineStart];
    const end = offsets[section.lineEnd + 1] ?? snapshot.length;
    if (start === void 0) return;
    const embeds = scanEmbeds(snapshot).filter(
      (e) => e.start >= start && e.end <= end
    );
    const imgs = Array.from(
      el.querySelectorAll("img")
    ).filter((i) => !i.closest(".callout-title"));
    if (embeds.length !== imgs.length || !embeds.every((e, i) => this.matches(imgs[i], e, file.path)))
      return;
    const cleanup = [];
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i], embed = embeds[i], l = layout(embed.label);
      this.style(img, l.align, l.width, l.height);
      this.targets.set(img, { file, snapshot, embed });
      cleanup.push(() => {
        this.targets.delete(img);
        img.removeAttribute("data-ig-align");
        img.classList.remove("ig-sized");
        img.style.removeProperty("--ig-width");
      });
    }
    const child = new import_obsidian8.MarkdownRenderChild(el);
    child.register(() => cleanup.forEach((f) => f()));
    ctx.addChild(child);
  }
  style(img, align, width, height) {
    if (align) img.dataset.igAlign = align;
    if (width && !height) {
      img.style.setProperty("--ig-width", `${width}px`);
      img.classList.add("ig-sized");
    }
  }
  menu(event, target) {
    this.activeMenu?.hide();
    const menu = new import_obsidian8.Menu().setUseNativeMenu(false);
    this.activeMenu = menu;
    const actions = [
      [
        "Replace image from gallery\u2026",
        "images",
        () => void this.replace(target)
      ],
      [
        "Image alignment and width\u2026",
        "scaling",
        () => new ImageOptions(
          this.app,
          target,
          (c) => void this.apply(target, c)
        ).open()
      ],
      ...["left", "center", "right"].map(
        (align) => [
          `Align image ${align}`,
          `align-${align}`,
          () => void this.apply(target, { align })
        ]
      ),
      [
        "Reset image to natural size",
        "maximize",
        () => void this.apply(target, { width: null })
      ]
    ];
    actions.forEach(
      ([title, icon, run], n) => menu.addItem(
        (i) => i.setTitle(`${n + 1}. ${title}`).setIcon(icon).onClick(run)
      )
    );
    const doc = event ? event.target.ownerDocument : this.app.workspace.containerEl.ownerDocument;
    const key2 = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return;
      const n = Number(e.key) - 1;
      if (!/^[1-6]$/.test(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      menu.hide();
      actions[n][2]();
    };
    doc.addEventListener("keydown", key2, true);
    menu.onHide(() => doc.removeEventListener("keydown", key2, true));
    if (event) menu.showAtMouseEvent(event);
    else {
      const box = this.app.workspace.containerEl.getBoundingClientRect();
      menu.showAtPosition({ x: box.x + box.width / 2, y: box.y + 160 }, doc);
    }
  }
  async replace(target) {
    try {
      const f = await this.api.pickImage({
        sourcePath: target.file.path,
        currentPath: this.source(target.embed, target.file.path)?.path,
        title: "Replace selected image"
      });
      if (!f) return;
      const parts = target.file.path.split("/");
      parts.pop();
      const to = f.path.split("/");
      while (parts.length && to.length && parts[0] === to[0]) {
        parts.shift();
        to.shift();
      }
      const destination = target.embed.kind === "wiki" ? f.path : [...parts.map(() => ".."), ...to].join("/");
      await this.apply(target, { destination });
    } catch (e) {
      this.error(e);
    }
  }
  async apply(target, change) {
    try {
      const replacement = changedEmbed(target.embed, change);
      if (target.editor) {
        const view = target.editor;
        replaceExact(
          view.state.doc.toString(),
          target.snapshot,
          target.embed,
          replacement
        );
        view.dispatch({
          changes: {
            from: target.embed.start,
            to: target.embed.end,
            insert: replacement
          }
        });
        return;
      }
      const views = this.app.workspace.getLeavesOfType("markdown").map((l) => l.view).filter(
        (v) => v instanceof import_obsidian8.MarkdownView && v.file?.path === target.file.path
      );
      if (views.some((v) => v.getMode() === "source")) {
        const v = views.find((v2) => v2.getMode() === "source");
        const current = v.editor.getValue();
        replaceExact(current, target.snapshot, target.embed, replacement);
        v.editor.replaceRange(
          replacement,
          v.editor.offsetToPos(target.embed.start),
          v.editor.offsetToPos(target.embed.end)
        );
      } else
        await this.app.vault.process(
          target.file,
          (current) => replaceExact(current, target.snapshot, target.embed, replacement)
        );
    } catch (e) {
      this.error(e);
    }
  }
  error(e) {
    new import_obsidian8.Notice(e.message ?? String(e), 8e3);
  }
};
var GallerySettings = class extends import_obsidian8.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.containerEl.empty();
    new import_obsidian8.Setting(this.containerEl).setName("Images folder").setDesc(
      "Optional vault-relative folder. The picker also offers the note attachment folder and all vault images."
    ).addText(
      (t) => t.setPlaceholder("Attachments").setValue(this.plugin.settings.folder).onChange(async (v) => {
        this.plugin.settings.folder = v;
        await this.plugin.saveData(this.plugin.settings);
      })
    );
  }
};
/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 *
 * @license MIT <https://opensource.org/licenses/MIT>
 * @author Lea Verou <https://lea.verou.me>
 * @namespace
 * @public
 */
