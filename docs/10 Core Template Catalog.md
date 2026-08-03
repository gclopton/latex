The hand-authored structural templates — the ones that carry placeholder/wrap tokens and define the editing feel. These are normative: Phase 1 materializes them as `core/templates/core-catalog.json` exactly as specified (ids, aliases, latex strings). The imported Formula Library catalog supplements these with plain formulas; it never overrides them.

Token conventions per [[07 Repo Conventions and Contracts]]: `#0` = wrap current selection; `\placeholder{}` = empty slot; first slot focuses on insert.

Part of [[00 Overview and Doc Map]].

# Structures

- `fraction` — aliases `frac, over` — `\frac{#0}{\placeholder{}}`
- `sqrt` — aliases `root` — `\sqrt{#0}`
- `nth-root` — aliases `nroot` — `\sqrt[\placeholder{}]{#0}`
- `superscript` — aliases `power, sup` — shortcut `^` — `{#0}^{\placeholder{}}`
- `subscript` — aliases `index, sub` — shortcut `_` — `{#0}_{\placeholder{}}`
- `subsup` — aliases `both` — `{#0}_{\placeholder{}}^{\placeholder{}}`
- `binom` — `\binom{\placeholder{}}{\placeholder{}}`

# Calculus

- `integral` — aliases `int` — `\int \placeholder{}\,\mathrm{d}\placeholder{}`
- `definite-integral` — aliases `dint, defint` — `\int_{\placeholder{}}^{\placeholder{}} \placeholder{}\,\mathrm{d}\placeholder{}`
- `closed-integral` — aliases `oint` — `\oint \placeholder{}\,\mathrm{d}\placeholder{}`
- `double-integral` — aliases `iint` — `\iint \placeholder{}\,\mathrm{d}\placeholder{}`
- `sum` — `\sum_{\placeholder{}}^{\placeholder{}} \placeholder{}`
- `product` — aliases `prod` — `\prod_{\placeholder{}}^{\placeholder{}} \placeholder{}`
- `limit` — aliases `lim` — `\lim_{\placeholder{} \to \placeholder{}} \placeholder{}`
- `derivative` — aliases `dd, ddx` — `\frac{\mathrm{d}\placeholder{}}{\mathrm{d}\placeholder{}}`
- `partial-derivative` — aliases `pd, pdx` — `\frac{\partial \placeholder{}}{\partial \placeholder{}}`
- `second-partial` — aliases `pd2` — `\frac{\partial^{2} \placeholder{}}{\partial \placeholder{}^{2}}`
- `evaluated-at` — aliases `evalat, bar` — `\left. #0 \right|_{\placeholder{}}^{\placeholder{}}`

# Accents and decorations

- `vector` — aliases `vec` — `\vec{#0}`
- `bold-vector` — aliases `bvec` — `\mathbf{#0}`
- `hat` — `\hat{#0}`
- `bar` — `\bar{#0}`
- `tilde` — `\tilde{#0}`
- `dot` — `\dot{#0}`  ·  `ddot` — `\ddot{#0}`
- `overline` — `\overline{#0}`
- `underbrace` — `\underbrace{#0}_{\placeholder{}}`

# Layouts

- `pmatrix` — aliases `matrix, pmat` — `\begin{pmatrix}\placeholder{} & \placeholder{} \\ \placeholder{} & \placeholder{}\end{pmatrix}`
- `bmatrix` — aliases `bmat` — `\begin{bmatrix}\placeholder{} & \placeholder{} \\ \placeholder{} & \placeholder{}\end{bmatrix}`
- `vmatrix` — aliases `det, vmat` — `\begin{vmatrix}\placeholder{} & \placeholder{} \\ \placeholder{} & \placeholder{}\end{vmatrix}`
- `cases` — `\begin{cases}\placeholder{} & \placeholder{} \\ \placeholder{} & \placeholder{}\end{cases}`
- `aligned` — aliases `align` — `\begin{aligned}\placeholder{} &= \placeholder{} \\ \placeholder{} &= \placeholder{}\end{aligned}`
- `gathered` — aliases `gather` — `\begin{gathered}\placeholder{} \\ \placeholder{}\end{gathered}`

# Brackets (auto-height pairs; all wrap)

- `paren-pair` — aliases `pair, parens` — `\left( #0 \right)`
- `bracket-pair` — aliases `brackets` — `\left[ #0 \right]`
- `brace-pair` — aliases `braces, set` — `\left\{ #0 \right\}`
- `vert-pair` — aliases `abs` — `\left| #0 \right|`
- `Vert-pair` — aliases `norm` — `\left\| #0 \right\|`
- `angle-pair` — aliases `angle` — `\left\langle #0 \right\rangle`
- `ceil-pair` — aliases `ceil` — `\left\lceil #0 \right\rceil`
- `floor-pair` — aliases `floor` — `\left\lfloor #0 \right\rfloor`
- `left-open` — aliases `leftdot` — `\left. #0 \right|`

# Arrows and relations

- `right-arrow` — aliases `to` — shortcut `->` — `\rightarrow`
- `left-arrow` — shortcut `<-` — `\leftarrow`
- `implies` — `\implies`  ·  `iff` — `\iff`
- `maps-to` — aliases `mapsto` — `\mapsto`
- `xrightarrow` — aliases `overarrow` — `\xrightarrow{\placeholder{}}`

# Text-mode entries (`mode: "text"`)

- `inline-math` — shortcut `$` — opens an active inline field (BS-02)
- `math-container` — aliases `display, block` — opens an active display field (BS-03)
- `align-block` — display field pre-filled with the `aligned` template
- `gather-block` — display field pre-filled with the `gathered` template

# Rules

- `wraps` is true exactly when the latex contains `#0` (linted, per [[07 Repo Conventions and Contracts]]).
- Every template here gets an engine round-trip test in Phase 1 (insert into empty field → serialize → expected string with `#0` empty and placeholders as `\placeholder{}`).
- Category names ("Structures", "Calculus", …) are the palette's category filter values; the Formula Library import maps its sections into these where sensible, new categories otherwise.
