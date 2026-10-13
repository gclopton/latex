# Research Outline

Private fork of Quiet Outline 0.3.24, upstream commit 9310fd3ca272f58a41484a1916c71491c3fafd4f. The original MIT license and attribution are retained. Upstream remote is read-only reference; there is no publishing remote configured.

Plugin ID and view type are `research-outline`. Community Quiet Outline updates cannot replace this plugin. Keep the original installed but disabled for rollback; do not enable both outlines together. Copy the original data.json once at migration; settings thereafter are independent. Migrate custom hotkey command prefixes from obsidian-quiet-outline to research-outline, retaining command suffixes.

Note heading colors are included from our Math Studio integration snippet. Existing math rendering remains upstream's renderer. The separate Math Studio plugin retains its math enhancements.

External views can expose `getResearchOutline()` returning `{version:1, key, entries:[{heading,level}], active, jump(index)}`. The key identifies the document; active is the flattened entry index. Notify the workspace with `research-outline:changed` after rendering or navigation. The provider must preserve draft saves and handle unavailable targets. No note heading cache is altered. External outlines disable the vendor's Markdown drag mutation and note hover actions. Search and collapse work in both modes.

Build: npm ci --ignore-scripts; npm run build. Installed main.js, styles.css and manifest.json must match the build. Test in code_links_lab before docs. Never commit personal data.json, hotkeys, vault content, or credentials.
