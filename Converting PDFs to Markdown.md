# Converting PDFs to Markdown

Use this workflow when converting book PDFs into Obsidian-ready Markdown.

The default goal is not just to get a `.md` file. The goal is to produce a vault-friendly book structure with chapter folders, local images, Obsidian-compatible math, and cleaned heading levels so the outline sidebar is useful.

## Local toolchain

The standard local tools are:

- Mathpix helper docs: `/Users/gradyclopton/utils/mathpix/README.md`
- PDF splitter: `/Users/gradyclopton/ObsidianVaults/me_510/tools/pdf_process.py`
- Mathpix chapter converter: `/Users/gradyclopton/ObsidianVaults/me_510/tools/mathpix_chapters_to_obsidian.py`
- Margin-heavy chapter converter: `/Users/gradyclopton/utils/mathpix/mathpix_margin_heavy_book.py`

Mathpix credentials must be available in the shell environment:

- `MATHPIX_APP_ID`
- `MATHPIX_APP_KEY`

Use the chapter-based `md.zip` workflow by default. It preserves local `images/` folders and works offline inside Obsidian.

Use the margin-heavy workflow only when notes in the margins or side commentary are causing OCR to skip text, reorder text incorrectly, or replace main text with marginal notes.

Decision rule:

- if the chapter PDFs are clean, use `mathpix_chapters_to_obsidian.py`
- if the chapter PDFs are margin-heavy and reading order is breaking, use `mathpix_margin_heavy_book.py`

## Expected vault layout

Place converted books under:

```text
<vault>/Books/<Author>/
```

Inside each author folder, use one folder per front matter, chapter, or back matter section:

```text
<vault>/Books/<Author>/Front Matter/
<vault>/Books/<Author>/Chapter 01 - Title/
<vault>/Books/<Author>/Chapter 02 - Title/
...
<vault>/Books/<Author>/Back Matter/
```

Inside each section folder, keep:

- one Markdown file with the same name as the folder, and
- one `images/` folder for extracted figures.

Example:

```text
<vault>/Books/Zettili/Chapter 03 - Postulates of Quantum Mechanics/
  Chapter 03 - Postulates of Quantum Mechanics.md
  images/
```

Do not flatten all chapters into one folder. Each chapter must remain self-contained.

## Split manifest format

Before conversion, split the PDF into front matter, chapter PDFs, and back matter. Use a JSON file with one object per section:

```json
[
  { "title": "Front Matter", "start_page": 1 },
  { "title": "Chapter 01 - Fundamental Concepts", "start_page": 20 },
  { "title": "Chapter 02 - Quantum Dynamics", "start_page": 85 },
  { "title": "Back Matter", "start_page": 538 }
]
```

Rules:

- `start_page` is 1-based.
- Entries must be sorted by `start_page`.
- The first section must start on page `1`.
- Include `Front Matter` and `Back Matter` when useful.
- Use the real chapter titles in the `title` field because those names become folder and file names.

## Conversion workflow

### 1. Create or identify the destination vault

Use `ocreate` when starting a new vault. The shared Obsidian template already includes:

- the shared `.obsidian` configuration,
- the MathJax preamble file `preamble.sty`, and
- the `Extended MathJax` plugin needed for `\oiint` and `\oiiint`.

### 2. Build the split manifest

Create a `sections.json` file using the format above. Store it in a temporary work directory near the source PDF.

### 3. Split the PDF

Run:

```bash
python3 /Users/gradyclopton/ObsidianVaults/me_510/tools/pdf_process.py split \
  --src "/path/to/Book.pdf" \
  --sections-json "/path/to/sections.json"
```

This creates one PDF per section.

### 4. Convert the split PDFs with Mathpix

#### Standard workflow for clean chapter PDFs

Run:

```bash
python3 /Users/gradyclopton/ObsidianVaults/me_510/tools/mathpix_chapters_to_obsidian.py \
  --src-dir "/path/to/split_pdfs" \
  --out-dir "/path/to/vault/Books/<Author>"
```

Optional flags:

- `--include-regex`
- `--exclude-regex`
- `--force`

The converter:

- submits each split PDF to Mathpix,
- downloads `md.zip`,
- keeps local image files in `images/`,
- rewrites MathJax delimiters for Obsidian,
- and stores resume state in `<out-dir>/.mathpix_state.json`.

#### Margin-heavy workflow for scanned books with difficult marginalia

Run:

```bash
python3 /Users/gradyclopton/utils/mathpix/mathpix_margin_heavy_book.py \
  --src "/path/to/chapter.pdf" \
  --out-root "/path/to/vault/Books/<Author>" \
  --chapter-name "0 Preliminaries" \
  --chapter-number 0
```

Use this script chapter by chapter, not on the whole directory at once.

This workflow:

- performs page-wise OCR so margin notes do not corrupt the main text as often,
- keeps local figure files in `images/`,
- converts Mathpix `tabular` output into Obsidian markdown tables,
- stores the original PDF in `original copy/`,
- stores a full backup markdown file in `original copy/`,
- and splits the chapter into per-section Markdown files like `0.2 ...` or `4.5 ...`.

Do not use the margin-heavy script unless the layout actually requires it; the standard `md.zip` workflow remains the default.

### 5. Ensure every section folder has an `images/` folder

If Mathpix did not extract any figures for a section, create an empty `images/` folder anyway so the structure stays consistent.

## Heading normalization rules

After Mathpix conversion, clean the headings so the Obsidian outline reflects the actual book structure.

### General rule

Use numbered section depth to determine Markdown heading level.

For ordinary chapter numbering:

- `1.1` becomes level 1: `#`
- `1.1.1` becomes level 2: `##`
- `1.1.1.1` becomes level 3: `###`
- and so on

For appendix numbering:

- `A.1` becomes level 1: `#`
- `A.1.1` becomes level 2: `##`
- `A.1.1.1` becomes level 3: `###`

### Explicit numbered headings

If Mathpix already produced a numbered heading such as:

```md
## 2.4.5 Uncertainty Relation between Two Operators
```

keep it as a heading, but adjust the number of `#` markers to match the numbering depth.

Also normalize OCR punctuation in numbered headings:

- `1.7- WAVE FUNCTIONS ...` -> `1.7 WAVE FUNCTIONS ...`
- `2.7■ POTENTIALS ...` -> `2.7 POTENTIALS ...`
- `A. 1 COULOMB'S LAW ...` -> `A.1 COULOMB'S LAW ...`

### Inferred numbered subsections

Many books, especially Sakurai and Zettili, contain real subsection titles that Mathpix extracts as unnumbered headings.

If a heading-like line is a real content subtopic under the current explicit numbered section, promote it into an inferred numbered subsection.

Examples:

```md
## 1.2.1 Blackbody Radiation
### 1.2.1.1 Wien's energy density distribution
### 1.2.1.2 Rayleigh's energy density distribution
### 1.2.1.3 Planck's energy density distribution
```

and

```md
# 1.1 THE STERN-GERLACH EXPERIMENT
## 1.1.1 Description of the Experiment
## 1.1.2 Sequential Stern-Gerlach Experiments
## 1.1.3 Analogy with Polarization of Light
```

Use this rule:

- find the nearest preceding explicit numbered parent section,
- assign inferred children sequentially as `.1`, `.2`, `.3`, etc.,
- and set the Markdown heading level from the resulting numbering depth.

### Headings that should not stay in the outline

Demote these to bold text instead of headings unless there is a strong reason to keep them as part of the section structure:

- chapter banners like `CHAPTER 3`
- standalone chapter titles like `Theory of Angular Momentum`
- `Example ...`
- `Solution`
- `Problem ...`
- `Exercise ...`
- most `Remark` or `Remarks` labels
- raw image-only headings
- alphabetized index letters like `A`, `B`, `C`

Examples:

```md
**CHAPTER 7**
**Problems**
**Example 2.4**
**Solution**
```

### Judgment-call audit

After the first heading pass, manually review the deepest inferred headings.

This matters because a line may be a sibling topic rather than a child topic. For example, in Zettili, `Parity operator` belonged under `3.7.3` as `3.7.3.2`, not as a child of `3.7.3.1`.

So after automatic cleanup:

- review the deepest inferred headings,
- check them against the nearby section flow and table of contents,
- and manually adjust misnested cases.

## Verification checklist

Before rewriting headings, create a backup folder such as:

```text
<Author>/_backup_before_heading_fix_YYYY-MM-DD/
```

After rewriting:

- verify that every edited file has the same line count as its backup,
- verify that content changes are limited to heading formatting and inferred numbering,
- and spot-check representative chapters plus the deepest inferred headings.

Do not delete content during heading cleanup.

## Book-specific notes from prior conversions

### Zettili

- Mathpix often promoted `Example`, `Solution`, `Problem`, `Exercise`, and `Remark` lines into headings.
- Some unnumbered conceptual titles were real subsections and needed inferred numbering.
- Appendix numbering also needed cleanup.

### Sakurai

- Main numbered sections were usually present already.
- Most cleanup involved inferring numbered child subsections beneath those explicit section headings.
- `Problems` headings were better as bold text rather than numbered sections.
- OCR inserted stray characters like `■` and `-` into some numbered headings; normalize them.

## Default expectation

When asked to convert a book PDF into Obsidian Markdown, use this workflow unless the user explicitly asks for a different structure.
