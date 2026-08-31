# Design Remediation Implementation Plan

> **PARTLY SUPERSEDED — 2026-08-31.** See `.agents/DECISIONS.md` D-005.
> Wheelhouse is adopting shadcn/ui + Tailwind. Eleven of the nineteen tasks below
> are retired because Radix and Tailwind provide them directly: **1, 3, 4, 5, 7,
> 8, 9, 10, 12, 13, 19**. Eight remain in scope: **2, 6, 11, 14, 15, 16, 17, 18**.
> Task 2's contrast gate is retargeted at the Tailwind `@theme` tokens rather
> than `styles.css`. D-001's `--brand` correction to `#b8460f` still stands and
> carries into `@theme`. Do not execute a retired task.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Wheelhouse's four front-ends one shared, accessible, contrast-safe design layer, and close the 19 Phase 1 and Phase 2 findings from the 2026-08-31 design audit.

**Architecture:** A new `public/tokens.css` becomes the single source of truth for colour, spacing, type and focus tokens; `styles.css`, `portal.css` and `storefront.css` all link it and are rewritten to consume it rather than redeclare values. No existing selector is renamed, so the staff app's markup is untouched by the token work. Behavioural fixes (modal chrome, toast variants, `confirm()` replacement, storefront cart state, booking URL state) are made in the existing vanilla-JS render functions, following the repo's no-build-step, no-framework pattern. Verification is a new class of `node --test` suites that parse the stylesheets and the render source as text, compute contrast ratios, and assert structural invariants — so every fix has a check that runs in the existing `npm test` gate.

**Tech Stack:** Node.js (>=22.5), no new runtime or dev dependencies (the repo's only dependency stays `pg`), Node's built-in `node:test` / `node:assert`, vanilla CSS custom properties, vanilla DOM.

**Spec:** [docs/design/2026-08-31-design-audit-findings.md](../../design/2026-08-31-design-audit-findings.md)

## Global Constraints

- **No new dependencies.** Runtime dependencies stay `{"pg": "^8.13.0"}`. Tests use `node:test` / `node:assert/strict` only. Browser-driven verification is deferred (`DEFER-001`).
- **No build step.** All front-ends stay plain `<link>` + `<script>` static files. No bundler, no preprocessor, no CSS nesting that needs compiling.
- **No selector renames in `styles.css`.** Class names are referenced from 6,933 lines of `app.js` template strings. Token work changes *values*, never *selector names*. Adding new selectors is fine.
- **Every colour must be a `var(--token)`.** After WP-001, a raw hex outside `tokens.css` is a test failure. The two documented exceptions are the print stylesheet (`styles.css:1292-1321`) and the barcode SVG fill, both of which must be tokenised anyway.
- **Contrast floor is WCAG 2.1 AA:** 4.5:1 for text under 18.66px or under 14px bold; 3:1 for larger. Assert against the smaller figure unless the type size is proven larger.
- **Touch target floor is 24×24px** (WCAG 2.5.8 AA), targeting 44×44px where layout allows. Do not shrink any control below 24px.
- **Preserve the four things that already work** (findings §5): every list keeps its empty state, the six-state status token set keeps its semantics, interactive elements stay real `<button>`s, and errors keep funnelling through one `showToast` path.
- **`applyShopTheme()` overrides `--brand`, `--accent` and `--modal-bg` at runtime.** Any contrast guarantee must hold for every preset in `THEME_PRESETS`, not just the default. Task 4 makes that testable.
- Tests run against the same Postgres as local dev via `DATABASE_URL`; the new design tests are pure text/CSS parsing and need no database.

## Approved decisions

Recorded here because they were user decisions, not defaults. Full entries in `.agents/DECISIONS.md`.

| ID | Decision |
|---|---|
| D-001 | Fix the `--brand` contrast failure by **darkening the token**, not by changing button text colour. |
| D-002 | Unify by **extracting a shared `tokens.css`** that all three front-ends link; each keeps its own component CSS. |
| D-003 | Verify with **`node --test` suites that parse the CSS and render source**. No Playwright this pass. |
| D-004 | Scope is **Phase 1 (11 findings) + Phase 2 (8 findings)**. Phase 3 is deferred as `DEFER-002`. |

### Exact token values (computed, not estimated)

Every ratio below was computed with the WCAG 2.1 relative-luminance formula
against the stated background. These are the values to use verbatim.

| Token | Current | New | Ratio (new) | Against |
|---|---|---|---|---|
| `--brand` | `#d9581e` (3.91 ✗) | `#b8460f` | **5.36** | white text |
| `--brand-dark` (hover) | `#b8460f` | `#93380b` | **7.47** | white text |
| `--muted` | `#6b7570` (4.36 ✗ on `--bg`) | `#5f6a64` | **5.14** / 5.63 | `--bg` / `--panel` |
| `--status-complete-paid-ink` | `#6b9484` (3.21 ✗) | `#4d7364` | **5.03** / 4.86 | own bg / `--bg` |

> **Note on `--status-complete-paid-ink`:** `styles.css:31-34` documents that this
> state is *meant* to recede. Darkening the ink to 5.03 works against that intent.
> The resolution in this plan is to keep the receding signal in the **background**
> (`--status-complete-paid-bg` stays `#f5faf6`, the palest of the six) and stop using
> pale ink to carry it. **This is a visual change and needs sign-off before Task 3 is
> merged** — flag it, do not apply it silently.

---

## Work package map

| WP | Tasks | Closes |
|---|---|---|
| WP-001 Foundations | 1-5 | C3, R1, R2, R3, R6 |
| WP-002 Accessibility | 6-8 | C1, C2, R4 |
| WP-003 Responsive & touch | 9-11 | C4, C5, C6 |
| WP-004 Feedback & hierarchy | 12-14 | C9, C10, C11 |
| WP-005 Customer surfaces | 15-18 | C7, C8, R5, R7 |
| WP-006 Cleanup | 19 | R4 (inline styles) |

R8 (emoji logo) is flagged only — it needs a real brand asset and is not a task.

---

# WP-001 — Foundations

## Task 1: CSS and markup test helpers

Everything downstream asserts against these. Build them first.

**Files:**
- Create: `tests/helpers/css.js`
- Create: `tests/helpers/css.test.js`

**Interfaces:**
- Produces:
  - `readFile(relPath): string` — repo-root-relative file read.
  - `parseRootTokens(css: string): Map<string, string>` — every `--name: value` inside the first `:root { }` block.
  - `relativeLuminance(hex: string): number`
  - `contrast(hexA: string, hexB: string): number` — rounded to 2dp.
  - `findDeclarations(css: string, prop: string): Array<{selector: string, value: string, line: number}>`
  - `findHexLiterals(source: string): Array<{hex: string, line: number}>`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/helpers/css.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRootTokens, contrast, findDeclarations, findHexLiterals,
} from './css.js';

test('parseRootTokens reads custom properties from the :root block', () => {
  const css = ':root {\n  --bg: #f4f5f3;\n  --radius: 10px;\n}\n.x { color: red; }';
  const tokens = parseRootTokens(css);
  assert.equal(tokens.get('--bg'), '#f4f5f3');
  assert.equal(tokens.get('--radius'), '10px');
  assert.equal(tokens.has('color'), false);
});

test('parseRootTokens ignores comments inside :root', () => {
  const css = ':root {\n  /* --fake: #000; */\n  --real: #fff;\n}';
  const tokens = parseRootTokens(css);
  assert.equal(tokens.has('--fake'), false);
  assert.equal(tokens.get('--real'), '#fff');
});

test('contrast matches known WCAG reference pairs', () => {
  assert.equal(contrast('#ffffff', '#000000'), 21);
  assert.equal(contrast('#ffffff', '#ffffff'), 1);
  // Regression guard: the exact failing pair this whole plan exists to fix.
  assert.equal(contrast('#ffffff', '#d9581e'), 3.91);
});

test('contrast is symmetric and accepts shorthand hex', () => {
  assert.equal(contrast('#000', '#fff'), contrast('#fff', '#000'));
});

test('findDeclarations reports selector, value and 1-indexed line', () => {
  const css = '.a {\n  padding: 4px;\n}\n.b {\n  padding: 8px 16px;\n}';
  const found = findDeclarations(css, 'padding');
  assert.equal(found.length, 2);
  assert.deepEqual(found[0], { selector: '.a', value: '4px', line: 2 });
  assert.equal(found[1].selector, '.b');
  assert.equal(found[1].line, 5);
});

test('findHexLiterals finds hex colours and skips non-colour hashes', () => {
  const src = 'const a = "#ff0000";\nel.id = "#not-a-colour";\nconst b = "#abc";';
  const hits = findHexLiterals(src);
  assert.deepEqual(hits.map(h => h.hex), ['#ff0000', '#abc']);
  assert.equal(hits[0].line, 1);
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test tests/helpers/css.test.js`
Expected: FAIL — `Cannot find module './css.js'`.

- [ ] **Step 3: Write the helper**

```javascript
// tests/helpers/css.js
//
// Text-level parsing helpers for the design-system test suites. These
// deliberately do NOT use a real CSS parser - the repo has one runtime
// dependency (pg) and we are not adding a second for tests. Everything here
// operates on the stylesheet as text, which is enough to assert token
// presence, contrast and structural invariants.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readFile(relPath) {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function stripComments(css) {
  // Replace comment bodies with equal-length whitespace so line numbers survive.
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

export function parseRootTokens(css) {
  const clean = stripComments(css);
  const start = clean.indexOf(':root');
  if (start === -1) return new Map();
  const open = clean.indexOf('{', start);
  const close = clean.indexOf('}', open);
  const body = clean.slice(open + 1, close);
  const tokens = new Map();
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (m) tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

function expandHex(hex) {
  const h = hex.replace('#', '');
  return h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
}

export function relativeLuminance(hex) {
  const h = expandHex(hex);
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrast(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Number(ratio.toFixed(2));
}

export function findDeclarations(css, prop) {
  const clean = stripComments(css);
  const lines = clean.split('\n');
  const out = [];
  let selector = '';
  lines.forEach((line, i) => {
    const sel = line.match(/^\s*([^{}]+?)\s*\{/);
    if (sel) selector = sel[1].trim();
    const decl = new RegExp(`(?:^|[{;\\s])${prop}\\s*:\\s*([^;}]+)`).exec(line);
    if (decl) out.push({ selector, value: decl[1].trim(), line: i + 1 });
  });
  return out;
}

export function findHexLiterals(source) {
  const lines = source.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) {
      out.push({ hex: m[0], line: i + 1 });
    }
  });
  return out;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test tests/helpers/css.test.js`
Expected: PASS, 6/6.

- [ ] **Step 5: Prove the test can fail (mutation check)**

Temporarily change `0.2126` to `0.5` in `relativeLuminance`. Re-run.
Expected: the reference-pair test FAILS. Restore the value and confirm PASS again.
Do not skip this — a contrast helper that cannot go red is worthless as a gate.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/css.js tests/helpers/css.test.js
git commit -m "test: add CSS parsing and contrast helpers for design audits"
```

---

## Task 2: Contrast gate — write the failing suite against the current tokens

This task deliberately ends **red**. Task 3 turns it green. Do not fix the CSS here.

**Files:**
- Create: `tests/design-contrast.test.js`

**Interfaces:**
- Consumes: `tests/helpers/css.js` (`readFile`, `parseRootTokens`, `contrast`).
- Produces: the contrast gate every later task must keep green.

- [ ] **Step 1: Write the test**

```javascript
// tests/design-contrast.test.js
//
// Every text/background token pair the product actually renders must clear
// WCAG 2.1 AA (4.5:1) for body text. These pairs come from the 2026-08-31
// design audit, findings C3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, contrast } from './helpers/css.js';

const tokens = parseRootTokens(readFile('public/tokens.css'));
const AA = 4.5;

function tok(name) {
  const v = tokens.get(name);
  assert.ok(v, `token ${name} is not defined in public/tokens.css`);
  return v;
}

const PAIRS = [
  ['white on --brand (.btn-primary)',        '#ffffff',  '--brand'],
  ['white on --brand-dark (hover)',          '#ffffff',  '--brand-dark'],
  ['white on --accent (.btn-accent)',        '#ffffff',  '--accent'],
  ['white on --accent-dark (topbar)',        '#ffffff',  '--accent-dark'],
  ['white on --danger (.btn-danger)',        '#ffffff',  '--danger'],
  ['--muted on --bg (secondary text)',       '--muted',  '--bg'],
  ['--muted on --panel (text in cards)',     '--muted',  '--panel'],
  ['--ink on --bg',                          '--ink',    '--bg'],
  ['--ink on --panel',                       '--ink',    '--panel'],
  ['--warn-ink on --warn-bg',                '--warn-ink', '--warn-bg'],
];

for (const [label, fg, bg] of PAIRS) {
  test(`contrast: ${label} clears AA`, () => {
    const f = fg.startsWith('--') ? tok(fg) : fg;
    const b = bg.startsWith('--') ? tok(bg) : bg;
    const ratio = contrast(f, b);
    assert.ok(ratio >= AA, `${label} is ${ratio}, needs >= ${AA}`);
  });
}

// The six job-status badges each pair their own ink against their own bg.
const STATUSES = ['pending', 'scheduled', 'waiting_parts', 'on_hold', 'complete', 'complete-paid'];

for (const s of STATUSES) {
  test(`contrast: status badge "${s}" ink on its own background clears AA`, () => {
    const ratio = contrast(tok(`--status-${s}-ink`), tok(`--status-${s}-bg`));
    assert.ok(ratio >= AA, `status ${s} is ${ratio}, needs >= ${AA}`);
  });

  test(`contrast: status badge "${s}" ink on the page ground clears AA`, () => {
    const ratio = contrast(tok(`--status-${s}-ink`), tok('--bg'));
    assert.ok(ratio >= AA, `status ${s} on --bg is ${ratio}, needs >= ${AA}`);
  });
}
```

- [ ] **Step 2: Run it and record exactly which assertions fail**

Run: `node --test tests/design-contrast.test.js`
Expected: FAIL. First on `Cannot find module` / missing file for `public/tokens.css`
(it does not exist yet). This is the correct red — Task 3 creates the file.

- [ ] **Step 3: Commit the red test**

```bash
git add tests/design-contrast.test.js
git commit -m "test: add failing WCAG AA contrast gate for design tokens"
```

---

## Task 3: Extract `tokens.css` and fix the three contrast failures

**Files:**
- Create: `public/tokens.css`
- Modify: `public/styles.css:1-44` (delete the `:root` block, keep everything else)
- Modify: `public/index.html:9` (add the `tokens.css` link before `styles.css`)
- Modify: `public-portal/index.html:9` (same)
- Test: `tests/design-contrast.test.js` (already written, currently red)

**Interfaces:**
- Produces: `public/tokens.css`, served at `/tokens.css`, containing the single
  `:root` block for all front-ends. Token names are **unchanged** from
  `styles.css` so no selector in `styles.css` needs editing.

- [ ] **Step 1: Create `public/tokens.css`**

```css
/* public/tokens.css
 *
 * The single source of truth for design tokens across all Wheelhouse
 * front-ends: the staff EPOS (/), the booking portal (/book) and the public
 * storefront (shop subdomains). Every one of them links this file first.
 *
 * Colour values here are contrast-checked by tests/design-contrast.test.js
 * against WCAG 2.1 AA (4.5:1 for body text). Do not change a colour without
 * running `npm test` - the gate will catch a regression, but only if you run it.
 */
:root {
  /* ---------- Surfaces and text ---------- */
  --bg: #f4f5f3;
  --panel: #ffffff;
  --ink: #1c231f;
  /* Darkened from #6b7570, which measured 4.36 on --bg (WCAG AA fail).
     #5f6a64 measures 5.14 on --bg and 5.63 on --panel. */
  --muted: #5f6a64;
  --border: #e0e2dd;

  /* ---------- Brand and action ---------- */
  /* Darkened from #d9581e, which measured 3.91 with white text (AA fail).
     #b8460f measures 5.36. The old --brand-dark value was #b8460f, so the
     hover step moves down to #93380b (7.47). */
  --brand: #b8460f;
  --brand-dark: #93380b;
  --accent: #1f6f5c;
  --accent-dark: #164f42;
  --danger: #c0392b;
  --danger-hover: #a5301f;
  --danger-bg: #fdecea;
  --warn-bg: #fff7e0;
  --warn-ink: #8a6100;
  --ok-bg: #e8f5ec;

  /* ---------- Job status (six states) ---------- */
  --status-pending-bg: #f1e8fb;
  --status-pending-border: #6a3ea1;
  --status-pending-ink: #6a3ea1;
  --status-scheduled-bg: #eaf1fb;
  --status-scheduled-border: #4d7fc4;
  --status-scheduled-ink: #2c5289;
  --status-waiting_parts-bg: #fff0e3;
  --status-waiting_parts-border: #d9581e;
  --status-waiting_parts-ink: #a8420f;
  --status-on_hold-bg: #fff7e0;
  --status-on_hold-border: #c99a1e;
  --status-on_hold-ink: #8a6100;
  --status-complete-bg: #e8f5ec;
  --status-complete-border: #1f6f5c;
  --status-complete-ink: #164f42;
  /* A job goes 'complete' the moment work is done, but stays this same status
     once it's also been paid for and collected. That fully-resolved state still
     needs to recede - but the recede signal now lives in the BACKGROUND (the
     palest of the six) rather than in pale ink, because the old ink (#6b9484)
     measured 3.21 and was unreadable at the 9.5px this badge renders at. */
  --status-complete-paid-bg: #f5faf6;
  --status-complete-paid-border: #a9cdbf;
  --status-complete-paid-ink: #4d7364;

  /* ---------- Badges (previously untokenised hex) ---------- */
  --badge-card-bg: #e8eefb;
  --badge-card-ink: #2255a4;
  --badge-other-bg: #f1e8fb;
  --badge-other-ink: #6a3ea1;

  /* Overridden at runtime by applyShopTheme() (public/app.js) per the shop's
     chosen colour scheme - this default matches the 'forest' preset so there's
     no flash of a different colour before that JS runs. */
  --modal-bg: #DDF7DF;

  /* ---------- Shape ---------- */
  --radius: 10px;
  --radius-sm: 6px;
  --radius-pill: 999px;
  --shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
}
```

- [ ] **Step 2: Delete the `:root` block from `styles.css`**

Remove `public/styles.css` lines 1-44 entirely (the whole `:root { … }` block
including its comments — they have been moved into `tokens.css`). The file now
starts at what was line 46, `* { box-sizing: border-box; }`.

- [ ] **Step 3: Link `tokens.css` from both HTML entry points**

In `public/index.html`, before the existing `styles.css` link:

```html
  <link rel="stylesheet" href="/tokens.css" />
  <link rel="stylesheet" href="/styles.css" />
```

In `public-portal/index.html`, before the existing links:

```html
  <link rel="stylesheet" href="/tokens.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/book/portal.css" />
```

- [ ] **Step 4: Run the contrast gate and watch it go green**

Run: `node --test tests/design-contrast.test.js`
Expected: PASS on all 22 assertions (10 pairs + 6 statuses × 2).

- [ ] **Step 5: Prove the gate is real (mutation check)**

Set `--brand` back to `#d9581e` in `tokens.css`. Re-run.
Expected: FAIL with `white on --brand (.btn-primary) is 3.91, needs >= 4.5`.
Restore `#b8460f` and confirm PASS. A gate you have not seen go red is not a gate.

- [ ] **Step 6: Confirm the server serves the new file**

On the main host, `serveStatic` already resolves against `PUBLIC_DIR`, so
`/tokens.css` is served with no route change. Verify — note the port is **4000**
(`server/server.js:101`), not 3000:

```bash
npm run docker:up && npm start &
sleep 3 && curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:4000/tokens.css
```

Expected: `200 text/css`. If the content type comes back `text/html`, you have
hit `serveStatic`'s index.html fallback (`:3344-3346`) — the file is not where
you think it is. **Do not read a 200 alone as success here**: that fallback
returns 200 for a missing file, so the status code proves nothing on its own.

The portal and storefront hosts need an explicit route — added in Task 15.

- [ ] **Step 7: Commit**

```bash
git add public/tokens.css public/styles.css public/index.html public-portal/index.html
git commit -m "feat(design): extract shared tokens.css and fix three WCAG AA contrast failures

--brand    #d9581e -> #b8460f  (white text 3.91 -> 5.36)
--brand-dark #b8460f -> #93380b (hover step, 7.47)
--muted    #6b7570 -> #5f6a64  (on --bg 4.36 -> 5.14)
--status-complete-paid-ink #6b9484 -> #4d7364 (3.21 -> 5.03)

Closes C3."
```

---

## Task 4: Lock out untokenised colour

Closes R3. Prevents the two-colour-systems problem from coming back.

**Files:**
- Create: `tests/design-tokens.test.js`
- Modify: `public/styles.css` (`.badge.card`, `.badge.other`, `.btn-danger:hover`)
- Modify: `public/app.js:2535` (barcode SVG fill), `public/app.js:6892-6896` (`THEME_PRESETS`)

**Interfaces:**
- Consumes: `tests/helpers/css.js`.
- Produces: `THEME_PRESETS` entries keyed to token names; the invariant that
  every preset's `brand` value clears AA against white.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/design-tokens.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, findHexLiterals, contrast } from './helpers/css.js';

const ALLOWED_BARE_HEX = new Set([
  // Alpha-blended overlays that are deliberately not tokens - they sit on top
  // of whatever the theme sets and have no fixed background to check against.
]);

test('styles.css contains no raw hex colours - every colour is a token', () => {
  const css = readFile('public/styles.css');
  const stray = findHexLiterals(css).filter((h) => !ALLOWED_BARE_HEX.has(h.hex));
  assert.deepEqual(
    stray.map((h) => `${h.hex} at styles.css:${h.line}`),
    [],
    'raw hex found outside tokens.css',
  );
});

test('portal.css contains no raw hex colours', () => {
  const stray = findHexLiterals(readFile('public-portal/portal.css'));
  assert.deepEqual(stray.map((h) => `${h.hex}:${h.line}`), []);
});

test('app.js contains no raw hex colours outside THEME_PRESETS', () => {
  const src = readFile('public/app.js');
  const presetStart = src.indexOf('const THEME_PRESETS');
  const presetEnd = src.indexOf('};', presetStart);
  const stray = findHexLiterals(src).filter((h) => {
    const offset = src.split('\n').slice(0, h.line - 1).join('\n').length;
    return offset < presetStart || offset > presetEnd;
  });
  assert.deepEqual(stray.map((h) => `${h.hex}:${h.line}`), []);
});

test('every THEME_PRESETS colour clears AA against white text', () => {
  // applyShopTheme() overrides --accent and --accent-dark per shop, so the
  // contrast guarantee in design-contrast.test.js only covers the default
  // preset. This is the regression guard for the other four.
  //
  // All 10 values (5 presets x topbar + accent) pass as of 2026-08-31 -
  // lowest is sunset's accent #a8501e at 5.48. This test exists so a future
  // preset cannot be added below the floor, not to fix a present failure.
  const src = readFile('public/app.js');
  const block = src.slice(src.indexOf('const THEME_PRESETS'),
                          src.indexOf('};', src.indexOf('const THEME_PRESETS')));
  const colours = [...block.matchAll(/(topbar|accent):\s*'(#[0-9a-fA-F]{6})'/g)]
    .map((m) => ({ role: m[1], hex: m[2] }));
  assert.equal(colours.length, 10, `expected 10 preset colours, found ${colours.length}`);
  for (const { role, hex } of colours) {
    const ratio = contrast('#ffffff', hex);
    assert.ok(ratio >= 4.5, `preset ${role} ${hex} is ${ratio}, needs >= 4.5`);
  }
});

test('tokens.css defines every token that styles.css references', () => {
  const defined = new Set(parseRootTokens(readFile('public/tokens.css')).keys());
  const css = readFile('public/styles.css') + readFile('public-portal/portal.css');
  const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((t) => !defined.has(t));
  assert.deepEqual(missing, [], 'referenced but undefined tokens');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/design-tokens.test.js`
Expected: FAIL on at least `#e8eefb` / `#2255a4` (styles.css:707), `#f1e8fb` /
`#6a3ea1` (:709), `#a5301f` (:189), `#000` (app.js:2535), and on preset brand
colours that do not clear 4.5.

- [ ] **Step 3: Replace the stray hex in `styles.css`**

```css
/* was: .badge.card { background:#e8eefb; color:#2255a4 } */
.badge.card  { background: var(--badge-card-bg);  color: var(--badge-card-ink); }
.badge.other { background: var(--badge-other-bg); color: var(--badge-other-ink); }

/* was: .btn-danger:hover { background: #a5301f } */
.btn-danger:hover { background: var(--danger-hover); }
```

- [ ] **Step 4: Tokenise the barcode fill**

`public/app.js:2535` — change `fill="#000"` to `fill="currentColor"` and set the
colour on the wrapping element via CSS (`.barcode-svg { color: var(--ink); }` in
`styles.css`). `currentColor` keeps the print stylesheet working unchanged.

- [ ] **Step 5: Confirm the presets need no change**

All 10 `THEME_PRESETS` colours already clear AA against white — verified
2026-08-31, lowest is sunset's accent `#a8501e` at 5.48:

| Preset | topbar | ratio | accent | ratio |
|---|---|---|---|---|
| forest | `#164f42` | 9.41 | `#1f6f5c` | 6.02 |
| ocean | `#1a3f66` | 10.79 | `#2f5f96` | 6.57 |
| sunset | `#7a3410` | 9.03 | `#a8501e` | 5.48 |
| slate | `#2c333a` | 12.79 | `#4a5560` | 7.61 |
| plum | `#4a2258` | 12.64 | `#7a4a94` | 6.49 |

No values change in this step. The test added in Step 1 is a forward guard so a
future preset cannot be added below the floor. If it fails here, the preset
block has been edited since this plan was written — darken the offender, holding
hue and dropping lightness, and record the before/after in the commit message.

- [ ] **Step 6: Run both design suites**

Run: `node --test tests/design-tokens.test.js tests/design-contrast.test.js`
Expected: PASS.

- [ ] **Step 7: Mutation check**

Re-introduce `background:#e8eefb` on `.badge.card`. Re-run.
Expected: FAIL naming `#e8eefb at styles.css:<line>`. Revert and confirm PASS.

- [ ] **Step 8: Commit**

```bash
git add tests/design-tokens.test.js public/styles.css public/app.js
git commit -m "feat(design): tokenise all remaining raw hex and gate against regressions

Closes R3."
```

---

## Task 5: Spacing scale, type scale, and the global focus ring

Closes R1, R2, R6.

**Files:**
- Modify: `public/tokens.css` (append three token groups)
- Modify: `public/styles.css` (add the global `:focus-visible` rule)
- Create: `tests/design-scale.test.js`

**Interfaces:**
- Produces: `--space-1` … `--space-8`, `--text-xs` … `--text-3xl` with paired
  `--leading-*`, `--focus-ring`. Existing literals are migrated
  opportunistically, not in a big-bang rewrite — the test enforces the ceiling,
  not immediate perfection.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/design-scale.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, findDeclarations } from './helpers/css.js';

const tokens = parseRootTokens(readFile('public/tokens.css'));
const styles = readFile('public/styles.css');

test('a spacing scale exists with 8 steps on a 4px grid', () => {
  const steps = [2, 4, 8, 12, 16, 24, 32, 48];
  steps.forEach((px, i) => {
    assert.equal(tokens.get(`--space-${i + 1}`), `${px}px`);
  });
});

test('a type scale exists with paired line-heights', () => {
  const scale = {
    '--text-xs': '11px', '--text-sm': '13px', '--text-base': '15px',
    '--text-lg': '17px', '--text-xl': '20px', '--text-2xl': '24px', '--text-3xl': '30px',
  };
  for (const [name, value] of Object.entries(scale)) {
    assert.equal(tokens.get(name), value, `${name} should be ${value}`);
  }
  assert.ok(tokens.get('--leading-tight'));
  assert.ok(tokens.get('--leading-body'));
});

test('a focus ring token exists', () => {
  assert.ok(tokens.get('--focus-ring'), '--focus-ring must be defined');
});

test('a global :focus-visible rule exists in styles.css', () => {
  assert.match(styles, /:focus-visible\s*\{/, 'no global :focus-visible rule found');
});

test('no font-size uses a half-pixel value', () => {
  const half = findDeclarations(styles, 'font-size')
    .filter((d) => /\d+\.\d+px/.test(d.value));
  assert.deepEqual(
    half.map((d) => `${d.selector} { font-size: ${d.value} } at :${d.line}`),
    [],
    'half-pixel font sizes are a sign of eyeballed type, not a scale',
  );
});

test('the number of distinct font-size values is capped at the scale size', () => {
  const values = new Set(
    findDeclarations(styles, 'font-size').map((d) => d.value.trim()),
  );
  // 7 scale tokens, plus var() references. Anything above this means new
  // one-off sizes are creeping back in.
  assert.ok(values.size <= 10, `${values.size} distinct font-size values: ${[...values].join(', ')}`);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/design-scale.test.js`
Expected: FAIL on all six — no scale tokens, no focus ring, no `:focus-visible`,
19 distinct font sizes including half-pixel values.

- [ ] **Step 3: Append the scales to `tokens.css`**

```css
  /* ---------- Spacing (4px grid) ---------- */
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 8px;
  --space-4: 12px;
  --space-5: 16px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;

  /* ---------- Type scale ----------
     Seven steps replacing the 19 hand-tuned values the audit found. The
     8.5-11px tier collapses into --text-xs: nothing in this product needs to
     be smaller than 11px, and the status badges that were at 8.5px were the
     hardest-to-read text in the app. */
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-lg: 17px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --leading-tight: 1.25;
  --leading-body: 1.55;

  /* ---------- Focus ---------- */
  --focus-ring: 0 0 0 2px var(--panel), 0 0 0 4px var(--accent);
```

- [ ] **Step 4: Add the global focus rule to `styles.css`**

Place immediately after the `* { box-sizing: border-box; }` reset:

```css
/* Every interactive element gets a visible keyboard focus state. Before this
   rule, only three selectors in the whole product styled focus, all of them
   text inputs - buttons, pills, nav tabs and job cards had none. */
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 5: Migrate every `font-size` in `styles.css` to the scale**

Map each of the 19 existing values to its nearest scale step:

| Was | Becomes |
|---|---|
| 8.5, 9, 9.5, 10, 10.5, 11, 11.5 | `var(--text-xs)` |
| 12, 12.5, 13, 13.5 | `var(--text-sm)` |
| 14, 15 | `var(--text-base)` |
| 16, 17 | `var(--text-lg)` |
| 18, 20 | `var(--text-xl)` |
| 22 | `var(--text-2xl)` |
| 28 | `var(--text-3xl)` |

Then set a body default so the missing `line-height` is fixed once:

```css
html, body {
  font-size: var(--text-base);
  line-height: var(--leading-body);
}
```

- [ ] **Step 6: Run the suite**

Run: `node --test tests/design-scale.test.js`
Expected: PASS, 6/6.

- [ ] **Step 7: Mutation check**

Add `.x { font-size: 12.5px; }` to `styles.css`. Re-run.
Expected: FAIL on the half-pixel test. Remove it and confirm PASS.

- [ ] **Step 8: Run the full gate**

Run: `npm test`
Expected: PASS. The existing 12 suites must be unaffected — this task touched no
server code.

- [ ] **Step 9: Commit**

```bash
git add public/tokens.css public/styles.css tests/design-scale.test.js
git commit -m "feat(design): add spacing and type scales, and a global focus ring

19 hand-tuned font sizes collapse to a 7-step scale. Adds the first
:focus-visible rule in the product.

Closes R1, R2, R6."
```

---

# WP-002 — Accessibility

## Task 6: Live regions for every status message

Closes C1.

**Files:**
- Modify: `public/index.html`, `public-portal/index.html`, `public-storefront/index.html`
- Modify: `public/app.js:147-159` (`showToast`), `public/app.js:375` (route loading)
- Modify: `public-portal/portal.js:197-210` (`showToast`)
- Modify: `public/styles.css:1440` (`.toast`)
- Create: `tests/a11y-markup.test.js`

**Interfaces:**
- Produces: `#app` carries `aria-live="polite"` and `aria-busy` toggling; the
  toast container carries `role="status"` for success and `role="alert"` for
  errors (paired with Task 12's variant work).

- [ ] **Step 1: Write the failing test**

```javascript
// tests/a11y-markup.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const ENTRY_POINTS = [
  'public/index.html',
  'public-portal/index.html',
  'public-storefront/index.html',
];

for (const file of ENTRY_POINTS) {
  test(`${file}: #app is a polite live region`, () => {
    const html = readFile(file);
    const appTag = html.match(/<div id="app"[^>]*>/);
    assert.ok(appTag, 'no #app element found');
    assert.match(appTag[0], /aria-live="polite"/, `${file} #app needs aria-live`);
  });
}

test('the staff toast carries a live-region role', () => {
  const src = readFile('public/app.js');
  const fn = src.slice(src.indexOf('function showToast'), src.indexOf('function showToast') + 900);
  assert.match(fn, /role\s*=\s*['"](status|alert)['"]|setAttribute\(\s*['"]role['"]/,
    'showToast must set role="status" or role="alert"');
});

test('the portal toast carries a live-region role', () => {
  const src = readFile('public-portal/portal.js');
  const fn = src.slice(src.indexOf('function showToast'), src.indexOf('function showToast') + 900);
  assert.match(fn, /role\s*=\s*['"](status|alert)['"]|setAttribute\(\s*['"]role['"]/);
});

test('no bare <label> tags remain in the staff app', () => {
  const src = readFile('public/app.js');
  const bare = [...src.matchAll(/<label>/g)];
  assert.equal(bare.length, 0, `${bare.length} bare <label> tags - each needs for="..."`);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/a11y-markup.test.js`
Expected: FAIL on all six — 0 aria attributes exist anywhere, and 18 bare
`<label>` tags remain.

- [ ] **Step 3: Make `#app` a live region in all three entry points**

```html
<div id="app" aria-live="polite" aria-busy="true">Loading…</div>
```

Set `aria-busy="false"` once the first render completes — in `app.js` at the end
of `renderRoute()`, in `portal.js` at the end of `boot()`, in `storefront.js`
after `render()`.

- [ ] **Step 4: Give the toasts a role**

In `public/app.js`, inside `showToast`, before showing:

```javascript
// role="status" is announced politely; errors are upgraded to role="alert" by
// showToast's variant argument (see Task 12). Without a role the toast is
// completely silent to screen readers, which is how ~90 error messages in this
// app went unannounced.
el.setAttribute('role', 'status');
```

Apply the identical change in `public-portal/portal.js:197-210`.

- [ ] **Step 5: Fix the 18 bare labels**

Find them: `grep -n '<label>' public/app.js`. For each, give the following input
an `id` and the label a matching `for`. Use the pattern already used by the
other 83 — a stable, field-scoped id, not an index.

- [ ] **Step 6: Run the suite**

Run: `node --test tests/a11y-markup.test.js`
Expected: PASS, 6/6.

- [ ] **Step 7: Mutation check**

Remove `aria-live="polite"` from `public/index.html`. Re-run.
Expected: FAIL naming that file. Restore and confirm PASS.

- [ ] **Step 8: Commit**

```bash
git add public/index.html public-portal/index.html public-storefront/index.html \
        public/app.js public-portal/portal.js tests/a11y-markup.test.js
git commit -m "feat(a11y): add live regions to all three front-ends and label 18 orphan fields

Closes C1, P5."
```

---

## Task 7: One modal shell, built once

Closes R4 (modal half) and sets up Task 8.

**Files:**
- Modify: `public/app.js` — add `modalShell()` near `renderModal()` (`:4616`)
- Modify: `public/app.js` — the 21 call sites listed in findings R4
- Create: `tests/modal-shell.test.js`

**Interfaces:**
- Produces:
  ```javascript
  modalShell({ id, title, body, footer, size })
  // -> string of HTML: backdrop > modal > header(h2 + close) > body > footer
  // size: 'sm' | 'md' | 'lg' | 'job' (maps to existing .modal / .modal.job-modal)
  ```
  Every later task that adds a modal uses this and nothing else.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/modal-shell.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const src = readFile('public/app.js');

test('a single modalShell helper exists', () => {
  assert.match(src, /function modalShell\s*\(/, 'no modalShell() helper found');
});

test('modal-backdrop markup is written in exactly one place', () => {
  const occurrences = [...src.matchAll(/class="modal-backdrop"/g)];
  assert.equal(
    occurrences.length, 1,
    `modal-backdrop appears ${occurrences.length} times - it must only appear inside modalShell()`,
  );
});

test('the modal shell sets the dialog role and modal semantics', () => {
  const fn = src.slice(src.indexOf('function modalShell'), src.indexOf('function modalShell') + 1200);
  assert.match(fn, /role="dialog"/);
  assert.match(fn, /aria-modal="true"/);
  assert.match(fn, /aria-labelledby=/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/modal-shell.test.js`
Expected: FAIL — no helper, and `modal-backdrop` appears 21 times.

- [ ] **Step 3: Write `modalShell()`**

```javascript
// Every modal in the app is built from this one function. Before it existed,
// the backdrop/chrome/header/close markup was copy-pasted into 21 separate
// render functions, so any change to modal chrome was a 21-site edit.
function modalShell({ id, title, body, footer = '', size = 'md' }) {
  const titleId = `${id}-title`;
  const sizeClass = size === 'job' ? 'modal job-modal' : `modal modal-${size}`;
  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="${sizeClass}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="modal-header">
          <h2 id="${titleId}">${esc(title)}</h2>
          <button type="button" class="modal-close" data-modal-close aria-label="Close ${esc(title)}">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>`;
}
```

- [ ] **Step 4: Migrate all 21 call sites**

Work through the list in findings R4, one modal per commit is acceptable but one
commit for the batch is fine if the tests stay green throughout. For each: delete
the hand-written backdrop/header/close markup, pass `title` and `body` to
`modalShell()`. Do not change any body content in this task — chrome only.

- [ ] **Step 5: Run the suite plus a smoke check**

Run: `node --test tests/modal-shell.test.js && npm test`
Expected: PASS. Then open the app and open three different modals (product form,
sticker print, job form) to confirm they still render.

- [ ] **Step 6: Commit**

```bash
git add public/app.js tests/modal-shell.test.js
git commit -m "refactor(ui): build all 21 modals from one modalShell() helper

Adds role=dialog, aria-modal and aria-labelledby to every modal as a side
effect of having one place to add them.

Closes R4 (modal chrome)."
```

---

## Task 8: Escape to close, and a working focus trap

Closes C2. Depends on Task 7 — there is now one place to wire this.

**Files:**
- Modify: `public/app.js:6791-6795` (`wireModalDismiss`)
- Create: `tests/modal-focus.test.js`

**Interfaces:**
- Consumes: `modalShell()` from Task 7.
- Produces: `wireModalDismiss()` additionally binds Escape, moves focus into the
  dialog on open, cycles Tab within it, and restores focus to the previously
  focused element on close.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/modal-focus.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const src = readFile('public/app.js');
const fn = src.slice(src.indexOf('function wireModalDismiss'),
                     src.indexOf('function wireModalDismiss') + 2500);

test('wireModalDismiss binds the Escape key', () => {
  assert.match(fn, /['"]Escape['"]/, 'modals must close on Escape');
});

test('wireModalDismiss moves focus into the dialog on open', () => {
  assert.match(fn, /\.focus\(\)/, 'modals must take focus when they open');
});

test('wireModalDismiss traps Tab inside the dialog', () => {
  assert.match(fn, /['"]Tab['"]/, 'Tab must cycle within the open modal');
});

test('wireModalDismiss restores focus to the trigger on close', () => {
  assert.match(fn, /previouslyFocused|activeElement/,
    'closing a modal must return focus to where it came from');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/modal-focus.test.js`
Expected: FAIL on all four.

- [ ] **Step 3: Rewrite `wireModalDismiss()`**

```javascript
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
                  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function wireModalDismiss() {
  const backdrop = document.getElementById('modal-backdrop');
  if (!backdrop) return;
  const dialog = backdrop.querySelector('[role="dialog"]');
  const previouslyFocused = document.activeElement;

  function close() {
    document.removeEventListener('keydown', onKeydown, true);
    closeModal();
    // Send focus back where the user left it, so a keyboard user isn't
    // dumped at the top of the document every time they dismiss a dialog.
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  dialog.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', onKeydown, true);

  // Focus the first real control, not the close button - the close button is
  // a dead end for someone who opened the dialog to do something.
  const target = dialog.querySelector(FOCUSABLE + ':not([data-modal-close])') || dialog;
  target.focus();
}
```

- [ ] **Step 4: Run the suite**

Run: `node --test tests/modal-focus.test.js`
Expected: PASS, 4/4.

- [ ] **Step 5: Verify by hand — this one cannot be proven statically**

Open the app, open the product-form modal. Confirm: focus lands in the first
field; Tab cycles and does not escape to the page behind; Shift+Tab from the
first control wraps to the last; Escape closes; focus returns to the button that
opened it. Record the result in `.agents/work-plans/wp-002-*/phase-log.md`.
The static test proves the code exists, not that it works — say which you did.

- [ ] **Step 6: Commit**

```bash
git add public/app.js tests/modal-focus.test.js
git commit -m "feat(a11y): Escape-to-close and focus trap for all modals

Closes C2."
```

---

# WP-003 — Responsive and touch

## Task 9: Touch target floor

Closes C6.

**Files:**
- Modify: `public/tokens.css` (add `--tap-min`)
- Modify: `public/styles.css` — `.btn-sm`, `.qty-control button`, `.remove-btn`,
  `.icon-btn`, `.month-more-btn`, `.weekday-check`, `.modal-close`
- Create: `tests/design-touch.test.js`

**Interfaces:**
- Produces: `--tap-min: 24px`, `--tap-comfortable: 44px`; every interactive
  selector declares a `min-height` of at least `--tap-min`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/design-touch.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, findDeclarations } from './helpers/css.js';

const styles = readFile('public/styles.css');

// Every selector the audit measured under the 24px WCAG 2.5.8 AA floor.
const MUST_DECLARE_MIN_HEIGHT = [
  '.btn-sm', '.qty-control button', '.remove-btn',
  '.icon-btn', '.month-more-btn', '.weekday-check', '.modal-close',
];

test('every previously-undersized control declares a minimum tap height', () => {
  const declared = new Set(
    findDeclarations(styles, 'min-height').map((d) => d.selector),
  );
  const missing = MUST_DECLARE_MIN_HEIGHT.filter((s) => !declared.has(s));
  assert.deepEqual(missing, [], 'selectors still without a min-height');
});

test('no min-height on an interactive control is below 24px', () => {
  const tooSmall = findDeclarations(styles, 'min-height')
    .filter((d) => {
      const px = /^(\d+)px$/.exec(d.value.trim());
      return px && Number(px[1]) < 24;
    });
  assert.deepEqual(tooSmall.map((d) => `${d.selector}: ${d.value}`), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/design-touch.test.js`
Expected: FAIL listing all seven selectors.

- [ ] **Step 3: Add the tokens and apply them**

```css
/* tokens.css */
  --tap-min: 24px;          /* WCAG 2.5.8 AA floor */
  --tap-comfortable: 44px;  /* target where layout allows */
```

```css
/* styles.css - add min-height to each, keeping existing padding */
.btn-sm            { min-height: var(--tap-min); }
.qty-control button{ min-height: var(--tap-comfortable); min-width: var(--tap-comfortable); width: auto; height: auto; }
.remove-btn        { min-height: var(--tap-min); min-width: var(--tap-min); }
.icon-btn          { min-height: var(--tap-min); }
.month-more-btn    { min-height: var(--tap-min); }
.weekday-check     { min-height: var(--tap-min); }
.modal-close       { min-height: var(--tap-comfortable); min-width: var(--tap-comfortable); }
```

Note `.qty-control button` had fixed `width: 26px; height: 26px` — those must be
removed, not just overridden, or the fixed values win by specificity.

- [ ] **Step 4: Run the suite**

Run: `node --test tests/design-touch.test.js`
Expected: PASS.

- [ ] **Step 5: Mutation check**

Set `.btn-sm { min-height: 20px; }`. Re-run.
Expected: FAIL on the second test. Restore and confirm PASS.

- [ ] **Step 6: Commit**

```bash
git add public/tokens.css public/styles.css tests/design-touch.test.js
git commit -m "feat(a11y): raise seven controls above the 24px tap floor

Closes C6."
```

---

## Task 10: A real breakpoint system for the staff app

Closes C5.

**Files:**
- Modify: `public/tokens.css` (document the breakpoints as comments — custom
  properties cannot be used in media queries)
- Modify: `public/styles.css` — consolidate `:306`, `:753`, `:813`; add topbar,
  data-table and modal handling
- Create: `public/table-scroll.css` — or add `.table-scroll` to `styles.css`
- Modify: `public/app.js` — replace the 8 inline `overflow-x:auto` wrappers
- Create: `tests/design-responsive.test.js`

**Interfaces:**
- Produces: three named breakpoints used consistently — `560px` (phone),
  `860px` (tablet portrait), `1120px` (tablet landscape); a `.table-scroll`
  class replacing the inline wrappers.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/design-responsive.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const styles = readFile('public/styles.css');
const portal = readFile('public-portal/portal.css');
const app = readFile('public/app.js');

function breakpoints(css) {
  return [...css.matchAll(/@media[^{]*?(\d+)px/g)].map((m) => Number(m[1]));
}

test('the staff app uses only the three agreed breakpoints', () => {
  const allowed = new Set([560, 860, 1120]);
  const stray = [...new Set(breakpoints(styles))].filter((b) => !allowed.has(b));
  assert.deepEqual(stray, [], 'ad-hoc breakpoints found');
});

test('a phone breakpoint exists at all', () => {
  assert.ok(breakpoints(styles).includes(560), 'nothing below 700px existed before this task');
});

test('the topbar has narrow-viewport handling', () => {
  const phoneBlock = styles.slice(styles.indexOf('@media (max-width: 560px)'));
  assert.match(phoneBlock, /\.topbar|\.nav/, 'topbar/nav must adapt below 560px');
});

test('data tables use a .table-scroll class, not inline styles', () => {
  assert.match(styles, /\.table-scroll\s*\{/, 'no .table-scroll class defined');
  const inline = [...app.matchAll(/style="overflow-x:\s*auto/g)];
  assert.equal(inline.length, 0, `${inline.length} inline overflow wrappers remain`);
});

test('the portal has its own responsive handling', () => {
  assert.ok(breakpoints(portal).length > 0, 'portal.css still has zero media queries');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/design-responsive.test.js`
Expected: FAIL — breakpoints are 700/900/980, no 560, no `.table-scroll`, 8
inline wrappers, portal has zero queries.

- [ ] **Step 3: Consolidate the existing breakpoints**

Move `.cart-split` (was 700px), `.two-col` (was 900px) and `.workshop-layout`
(was 980px) into the three named blocks. `.cart-split` and `.two-col` collapse at
`860px`; `.workshop-layout` at `1120px`.

- [ ] **Step 4: Add the phone block**

```css
/* Below 560px the topbar's brand + nav + clock + shop-info row cannot hold a
   single line. Stack it and let the nav scroll horizontally rather than wrap
   into three ragged rows. */
@media (max-width: 560px) {
  .topbar { flex-direction: column; align-items: stretch; gap: var(--space-3); }
  .nav { flex-wrap: nowrap; overflow-x: auto; }
  .clock, .shop-info { display: none; }
  main { padding: var(--space-4); }
  .modal, .modal.job-modal { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
}
```

- [ ] **Step 5: Add `.table-scroll` and replace the inline wrappers**

```css
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
```

Replace each of the 8 sites (`app.js:2585, 2810, 2973, 3292, 3515, 3599, 3773,
3790`) — `style="overflow-x:auto;"` becomes `class="table-scroll"`.

- [ ] **Step 6: Run the suite**

Run: `node --test tests/design-responsive.test.js`
Expected: 4 of 5 PASS. The portal test still fails — Task 11 closes it.

- [ ] **Step 7: Commit**

```bash
git add public/styles.css public/app.js tests/design-responsive.test.js
git commit -m "feat(responsive): consolidate to three named breakpoints, add a phone tier

Closes C5. Portal responsive handling follows in the next task."
```

---

## Task 11: A booking picker that works on a phone

Closes C4. The highest-value fix in the plan — this is the conversion flow.

**Files:**
- Modify: `public-portal/portal.css` (add the phone block)
- Modify: `public-portal/portal.js:442-467` (single-day view below 560px)
- Test: `tests/design-responsive.test.js` (already written, one assertion red)

**Interfaces:**
- Consumes: the 560px breakpoint from Task 10.
- Produces: `renderDayPicker(dateStr)` — a single-day column view rendered
  instead of `renderWeekGrid` when the viewport is under 560px, with prev/next
  day controls at `--tap-comfortable`.

- [ ] **Step 1: Confirm the failing assertion**

Run: `node --test tests/design-responsive.test.js`
Expected: FAIL on `the portal has its own responsive handling`.

- [ ] **Step 2: Add a phone block to `portal.css`**

```css
/* The week grid is min-width:760px with a horizontal scroller. On a phone that
   made the entire booking flow - the only thing this page exists to do - a
   sideways-scrolling seven-column table. Below 560px we swap to one day at a
   time with day-stepper controls instead. */
@media (max-width: 560px) {
  .week-grid-scroll { display: none; }
  .day-picker { display: block; }
  .day-picker .day-step { min-height: var(--tap-comfortable); min-width: var(--tap-comfortable); }
  .portal-header { flex-direction: column; align-items: stretch; gap: var(--space-3); }
}
.day-picker { display: none; }
```

- [ ] **Step 3: Add `slotsForDay()`, built from the existing primitives**

`portal.js` has no slot-enumeration function — the week grid positions blocks
geometrically via `minutesToGridPx()` rather than walking a list. The day view
needs a list, so build one from the primitives that already exist:
`gridMinMinutes` / `gridMaxMinutes` (set by `applyGridHours()`),
`DEFAULT_JOB_DURATION_MIN`, `minutesToTime()`, `isDayOff()`, `isDayFull()`,
`isSlotBusy()`, and the module-level `mechanics` and `selectedMechanicIds`.

```javascript
// The week grid never needed a flat list of slots - it positions blocks by
// pixel offset. The day view does, so this walks the opening hours in the same
// 30-minute steps timeFromGridY() snaps to, and applies the same
// DEFAULT_JOB_DURATION_MIN free/busy test the grid click uses.
function slotsForDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const out = [];
  const lastStart = gridMaxMinutes - DEFAULT_JOB_DURATION_MIN;
  for (const mechanicId of selectedMechanicIds) {
    if (isDayOff(d, mechanicId) || isDayFull(d, mechanicId)) continue;
    const mech = mechanics.find((m) => m.id === mechanicId);
    for (let mins = gridMinMinutes; mins <= lastStart; mins += 30) {
      const time = minutesToTime(mins);
      if (isSlotBusy(dateStr, time, mechanicId)) continue;
      out.push({ time, mechanicId, mechanicName: mech ? mech.name : '' });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
```

- [ ] **Step 4: Render both views, let CSS choose between them**

Rendering both and hiding one in CSS avoids a resize listener and a second
render path to keep in sync. `renderPickerView()` is at `portal.js:416`; add the
day view into the same container alongside the week grid.

```javascript
function renderDayPicker(dateStr) {
  const slots = slotsForDay(dateStr);
  return `
    <div class="day-picker">
      <div class="day-step-row">
        <button type="button" class="btn btn-sm day-step" data-day-step="-1"
                aria-label="Previous day">‹</button>
        <span class="day-step-label">${esc(fmtDateLabel(dateStr))}</span>
        <button type="button" class="btn btn-sm day-step" data-day-step="1"
                aria-label="Next day">›</button>
      </div>
      ${slots.length === 0
        ? '<div class="empty-state">No slots free on this day. Try the next one.</div>'
        : slots.map((s) => `
            <button type="button" class="day-slot"
                    data-date="${dateStr}" data-slot="${s.time}" data-mechanic="${s.mechanicId}">
              <span class="day-slot-time">${esc(s.time)}</span>
              <span class="day-slot-mech">${esc(s.mechanicName)}</span>
            </button>`).join('')}
    </div>`;
}
```

`fmtDateLabel()` already exists at `portal.js:98` — do not write a new one.

- [ ] **Step 5: Wire the day-step buttons**

They shift `pendingDate` by ±1 day and re-render the picker. Reuse the existing
slot click handler for `.day-slot` — the `data-date` / `data-slot` attributes
match what the week grid already emits, so no new selection path is needed.

- [ ] **Step 6: Run the suite**

Run: `node --test tests/design-responsive.test.js`
Expected: PASS, 5/5.

- [ ] **Step 7: Verify by hand at three widths**

Load `/book` at 375px, 768px and 1280px. Confirm the day picker shows only at
375px, the week grid at the other two, and that picking a slot from the day view
lands in the same booking form. Record the result in the phase log — this is a
layout change and the static test only proves the code exists.

- [ ] **Step 8: Commit**

```bash
git add public-portal/portal.css public-portal/portal.js
git commit -m "feat(portal): single-day picker below 560px

The week grid is min-width:760px, which made the booking flow a
sideways-scrolling table on every phone.

Closes C4."
```

---

# WP-004 — Feedback and hierarchy

## Task 12: Toasts that distinguish success from failure

Closes C10.

**Files:**
- Modify: `public/tokens.css` (feedback tokens)
- Modify: `public/styles.css:1440-1452` (`.toast` variants)
- Modify: `public/app.js:147-159` (`showToast` signature)
- Modify: `public-portal/portal.js:197-210` (same)
- Create: `tests/toast-variants.test.js`

**Interfaces:**
- Produces: `showToast(message, variant = 'info')` where `variant` is
  `'success' | 'error' | 'info'`. `'error'` sets `role="alert"` and does not
  auto-dismiss; the other two keep the existing 2.6s timeout and `role="status"`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/toast-variants.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, contrast } from './helpers/css.js';

const app = readFile('public/app.js');
const styles = readFile('public/styles.css');
const tokens = parseRootTokens(readFile('public/tokens.css'));

test('showToast accepts a variant argument', () => {
  assert.match(app, /function showToast\s*\(\s*\w+\s*,\s*variant/,
    'showToast must take a variant');
});

test('toast variant styles exist for success and error', () => {
  assert.match(styles, /\.toast\.toast-success\s*\{/);
  assert.match(styles, /\.toast\.toast-error\s*\{/);
});

test('error toasts use role="alert" and do not auto-dismiss', () => {
  const fn = app.slice(app.indexOf('function showToast'), app.indexOf('function showToast') + 1400);
  assert.match(fn, /role['"\s,]*[:=][^\n]*alert/, 'error variant must set role="alert"');
  assert.match(fn, /variant\s*!==\s*['"]error['"]|variant\s*===\s*['"]error['"]/,
    'the dismiss timer must be conditional on variant');
});

test('toast variant colours clear AA', () => {
  for (const v of ['success', 'error']) {
    const ratio = contrast(tokens.get(`--toast-${v}-ink`), tokens.get(`--toast-${v}-bg`));
    assert.ok(ratio >= 4.5, `toast-${v} is ${ratio}, needs >= 4.5`);
  }
});

test('every error call site passes the error variant', () => {
  // Any showToast inside a catch block that does not name a variant is a bug -
  // it will render as a success-coloured pill.
  const catchToasts = [...app.matchAll(/catch\s*\([^)]*\)\s*\{[^}]*showToast\(([^)]*)\)/g)];
  const untyped = catchToasts.filter((m) => !/['"]error['"]/.test(m[1]));
  assert.deepEqual(untyped.map((m) => m[1].slice(0, 60)), [],
    'showToast calls in catch blocks missing the error variant');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/toast-variants.test.js`
Expected: FAIL on all five.

- [ ] **Step 3: Add the feedback tokens**

```css
/* tokens.css - semantic feedback, separate from brand and status colour */
  --toast-info-bg: #1c231f;
  --toast-info-ink: #ffffff;
  --toast-success-bg: #164f42;
  --toast-success-ink: #ffffff;
  --toast-error-bg: #8e2a1d;
  --toast-error-ink: #ffffff;
```

Verify each pair before committing — the test in Step 1 checks them, but compute
them first rather than guessing and letting the test tell you.

- [ ] **Step 4: Add the variant styles**

```css
.toast { background: var(--toast-info-bg);    color: var(--toast-info-ink); }
.toast.toast-success { background: var(--toast-success-bg); color: var(--toast-success-ink); }
.toast.toast-error   { background: var(--toast-error-bg);   color: var(--toast-error-ink); }
```

- [ ] **Step 5: Rewrite `showToast`**

The existing implementation creates the element lazily on first call — keep
that, it is why no entry point needs a `#toast` div in its HTML.

```javascript
// An error and a completed sale used to render as the identical dark pill with
// the identical 2.6s timeout. Errors now announce assertively and stay until
// dismissed - a message you might have missed is not a message.
function showToast(msg, variant = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast toast-${variant}`;
  el.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  el.style.display = 'block';
  clearTimeout(toastTimer);
  if (variant !== 'error') {
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2600);
  }
}
```

- [ ] **Step 6: Apply the same change to the portal**

`public-portal/portal.js:197-210` has a parallel `showToast` using
`#portal-toast`, `showToast._t` as its timer, and — relevant to Task 19 — an
inline `style.cssText` block that hardcodes `background:var(--ink)`,
`color:#fff`, `font-size:13.5px` and a `border-radius`. Move that block into
`portal.css` as `.portal-toast` using the tokens, then give the function the
same `variant` parameter and `role` handling as above.

- [ ] **Step 7: Pass the variant at every call site**

`grep -n 'showToast(' public/app.js` — 129 sites. Every one inside a `catch`
takes `'error'`; every one following a successful mutation takes `'success'`.
The test in Step 1 catches the catch-block cases automatically.

- [ ] **Step 8: Run the suite, then the full gate**

Run: `node --test tests/toast-variants.test.js && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add public/tokens.css public/styles.css public/app.js public-portal/portal.js \
        tests/toast-variants.test.js
git commit -m "feat(ui): distinguish success from error in toasts

Errors announce assertively and stay until dismissed.

Closes C10."
```

---

## Task 13: Replace native `confirm()` with an in-app dialog

Closes C11. Depends on Tasks 7 and 8 — reuses the shell and the focus trap.

**Files:**
- Modify: `public/app.js` — add `confirmDialog()`, replace the 14 `confirm()` sites
- Create: `tests/no-native-dialogs.test.js`

**Interfaces:**
- Consumes: `modalShell()` (Task 7), `wireModalDismiss()` (Task 8).
- Produces: `confirmDialog({ title, message, confirmLabel, danger }) => Promise<boolean>`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/no-native-dialogs.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const FRONTENDS = ['public/app.js', 'public-portal/portal.js', 'public-storefront/storefront.js'];

for (const file of FRONTENDS) {
  test(`${file} calls no native confirm()`, () => {
    const hits = [...readFile(file).matchAll(/(?<![.\w])confirm\s*\(/g)];
    assert.equal(hits.length, 0, `${hits.length} native confirm() calls remain`);
  });

  test(`${file} calls no native alert()`, () => {
    const hits = [...readFile(file).matchAll(/(?<![.\w])alert\s*\(/g)];
    assert.equal(hits.length, 0, `${hits.length} native alert() calls remain`);
  });
}

test('a confirmDialog helper exists and returns a promise', () => {
  const src = readFile('public/app.js');
  assert.match(src, /(async\s+)?function confirmDialog\s*\(/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/no-native-dialogs.test.js`
Expected: FAIL — 14 `confirm()` in `app.js`, 1 `alert()` in `storefront.js`.

- [ ] **Step 3: Write `confirmDialog()`**

```javascript
// Deleting a customer used to be a browser-chrome confirm() box, in a product
// with 21 styled modals available. Returns a promise so call sites read the
// same way the old confirm() did: `if (!await confirmDialog({...})) return;`
function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const holder = document.getElementById('modal-holder');
    holder.innerHTML = modalShell({
      id: 'confirm-dialog',
      title,
      size: 'sm',
      body: `<p class="confirm-message">${esc(message)}</p>`,
      footer: `
        <button type="button" class="btn" data-confirm-cancel>Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}"
                data-confirm-ok>${esc(confirmLabel)}</button>`,
    });
    wireModalDismiss();
    const finish = (result) => { closeModal(); resolve(result); };
    holder.querySelector('[data-confirm-ok]').addEventListener('click', () => finish(true));
    holder.querySelector('[data-confirm-cancel]').addEventListener('click', () => finish(false));
    holder.querySelector('[data-modal-close]').addEventListener('click', () => finish(false));
  });
}
```

- [ ] **Step 4: Replace the 14 call sites**

Each site listed in findings C11. The enclosing function must become `async`
where it is not already. Give each a real title and message — "Are you sure?" is
not one. Example:

```javascript
// was: if (!confirm('Delete this product?')) return;
if (!await confirmDialog({
  title: 'Delete product',
  message: `"${product.name}" will be removed from the stockroom. Sales history keeps its record of past sales.`,
  confirmLabel: 'Delete product',
  danger: true,
})) return;
```

- [ ] **Step 5: Replace the storefront `alert()`**

`storefront.js:130` — the storefront has no modal system. Render an inline error
next to the button instead (this pairs with Task 16):

```javascript
} catch (err) {
  btn.textContent = 'Add to cart';
  showCartError(card, `Couldn't add this to your cart: ${err.message}`);
}
```

- [ ] **Step 6: Run the suite**

Run: `node --test tests/no-native-dialogs.test.js && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/app.js public-storefront/storefront.js tests/no-native-dialogs.test.js
git commit -m "feat(ui): replace 14 native confirm() calls and 1 alert() with in-app dialogs

Closes C11."
```

---

## Task 14: Give the Front Desk a primary action

Closes C9.

**Files:**
- Modify: `public/app.js:410-411` (Front Desk actions)
- Modify: `public/app.js:5309, 5510, 5794, 6782` (dismissive buttons)
- Create: `tests/button-hierarchy.test.js`

**Interfaces:**
- Produces: the invariant that `.btn-primary` never labels a dismissive action.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/button-hierarchy.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const src = readFile('public/app.js');
const DISMISSIVE = ['Close', 'Done', 'Cancel', 'Back', 'Dismiss'];

test('btn-primary never labels a dismissive action', () => {
  const offenders = [];
  src.split('\n').forEach((line, i) => {
    if (!/btn-primary/.test(line)) return;
    for (const word of DISMISSIVE) {
      if (new RegExp(`>\\s*${word}\\s*<`).test(line)) offenders.push(`${word} at app.js:${i + 1}`);
    }
  });
  assert.deepEqual(offenders, [], 'primary styling on dismissive buttons inverts its meaning');
});

test('the Front Desk renders exactly one primary action', () => {
  const fn = src.slice(src.indexOf('async function renderTill'), src.indexOf('function renderTillPills'));
  const primaries = [...fn.matchAll(/btn-primary/g)];
  assert.equal(primaries.length, 1, `renderTill has ${primaries.length} primary actions, expected 1`);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/button-hierarchy.test.js`
Expected: FAIL — four dismissive primaries, zero primaries in `renderTill`.

- [ ] **Step 3: Promote "New sale" and demote the dismissals**

`app.js:410` — `New sale` becomes `.btn .btn-primary`. `Orders` stays plain
`.btn`. At `:5309`, `:5510`, `:5794` and `:6782`, `Close` and `Done` drop
`btn-primary` for plain `.btn`.

- [ ] **Step 4: Run the suite**

Run: `node --test tests/button-hierarchy.test.js`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add public/app.js tests/button-hierarchy.test.js
git commit -m "fix(ui): one primary action on the Front Desk, none on dismissals

Closes C9."
```

---

# WP-005 — Customer surfaces

## Task 15: Rebuild the storefront on the shared tokens

Closes R5.

**Files:**
- Modify: `public-storefront/index.html` (link `/tokens.css`)
- Rewrite: `public-storefront/storefront.css`
- Modify: `server/server.js` — serve `/tokens.css` on the storefront host
- Create: `tests/storefront-design.test.js`

**Interfaces:**
- Consumes: `public/tokens.css`.
- Produces: a storefront that shares the app's palette, radii, type scale and
  focus ring, keeping only genuinely storefront-specific components.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/storefront-design.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, findHexLiterals } from './helpers/css.js';

const css = readFile('public-storefront/storefront.css');
const html = readFile('public-storefront/index.html');
const shared = parseRootTokens(readFile('public/tokens.css'));

test('the storefront links the shared token sheet', () => {
  assert.match(html, /href="\/tokens\.css"/, 'storefront must load the shared tokens');
});

test('the storefront declares no colour tokens of its own', () => {
  const own = parseRootTokens(css);
  const colourish = [...own.keys()].filter((k) => !/space|text|radius|leading/.test(k));
  assert.deepEqual(colourish, [], 'storefront must not redeclare colour tokens');
});

test('the storefront contains no raw hex colours', () => {
  assert.deepEqual(findHexLiterals(css).map((h) => `${h.hex}:${h.line}`), []);
});

test('the storefront uses the shared radius tokens', () => {
  assert.doesNotMatch(css, /border-radius:\s*\d+px/, 'radii must come from tokens');
});

test('the storefront defines a focus state', () => {
  assert.match(css + readFile('public/styles.css'), /:focus-visible/);
});

test('every token the storefront references is defined in tokens.css', () => {
  const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((t) => !shared.has(t));
  assert.deepEqual(missing, []);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/storefront-design.test.js`
Expected: FAIL on all six — no token link, 3 own tokens, ~10 raw hex, `4px` and
`8px` literal radii, no focus rule.

- [ ] **Step 3: Serve `/tokens.css` from the storefront host**

`serveStatic(req, res, pathname, baseDir)` (`server/server.js:3339`) resolves
against `baseDir`, which is `STOREFRONT_DIR` for a storefront request and
`PORTAL_DIR` for `/book`. Neither directory contains `tokens.css`.

**This will not fail loudly.** `serveStatic` falls back to `baseDir/index.html`
for any missing file (`:3344-3346`), so an unrouted `/tokens.css` would return
the storefront's HTML with a 200, the browser would reject it as a stylesheet,
and the page would render entirely unstyled with no server-side error. Add the
branch before both static handlers:

```javascript
// tokens.css is shared by all three front-ends but lives in public/. Without
// this branch, serveStatic's index.html fallback would answer the request with
// HTML and a 200, and the page would silently render with no tokens at all.
if (pathname === '/tokens.css') {
  return serveStatic(req, res, '/tokens.css', PUBLIC_DIR);
}
```

Place it above the `/book` branch at `:3397` so it applies on every host.

- [ ] **Step 4: Rewrite `storefront.css` against the tokens**

Replace every value: `#1a1a1a` → `var(--ink)`, `#e0e0e0` → `var(--border)`,
`#666` → `var(--muted)`, `#fff` → `var(--panel)`, the amber preview banner trio
→ `var(--warn-bg)` / `var(--warn-ink)`. `border-radius: 4px` → `var(--radius-sm)`,
`8px` → `var(--radius)`. The `rem` spacing scale maps to `--space-*`. Adopt the
app's font stack rather than bare `system-ui`.

- [ ] **Step 5: Fix the heading order**

`storefront.js:107` — product card titles become `<h2>`, not `<h3>`. The page
then reads h1 → h2 with no skipped level.

- [ ] **Step 6: Run the suite**

Run: `node --test tests/storefront-design.test.js && npm test`
Expected: PASS. Existing `storefront-public.test.js` and
`storefront-settings.test.js` must stay green — this task touched one server
route, so run them specifically.

- [ ] **Step 7: Commit**

```bash
git add public-storefront/ server/server.js tests/storefront-design.test.js
git commit -m "feat(storefront): rebuild on the shared token sheet

3 local tokens and ~10 raw hex values replaced by the shared palette.

Closes R5."
```

---

## Task 16: Fix the buy button's state machine

Closes C7.

**Files:**
- Modify: `public-storefront/storefront.js:121-135`
- Modify: `public-storefront/storefront.css` (add `.cart-error`)
- Create: `tests/storefront-cart-ui.test.js`

**Interfaces:**
- Consumes: `showCartError()` introduced in Task 13 Step 5.
- Produces: a button that reverts to `Add to cart` after a success confirmation,
  and reports quantity honestly.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/storefront-cart-ui.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const src = readFile('public-storefront/storefront.js');
const handler = src.slice(src.indexOf(".querySelectorAll('.buy-button')"));

test('the Added state reverts rather than sticking forever', () => {
  assert.match(handler, /setTimeout/, 'the "Added" label must revert');
});

test('the button is not re-enabled while still labelled Added', () => {
  // The bug: `finally { btn.disabled = false }` runs on the success path too,
  // so a second click silently adds another unit under an "Added" label.
  assert.doesNotMatch(handler, /finally\s*\{\s*btn\.disabled\s*=\s*false;?\s*\}/,
    'unconditional re-enable in finally is the double-add bug');
});

test('cart failures render inline, not through alert()', () => {
  assert.doesNotMatch(handler, /(?<![.\w])alert\s*\(/);
  assert.match(src, /showCartError/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/storefront-cart-ui.test.js`
Expected: FAIL on the first two.

- [ ] **Step 3: Rewrite the handler**

```javascript
btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Adding…';
  clearCartError(card);
  try {
    await addToShopifyCart(info.shopifyDomain, info.shopifyStorefrontToken, btn.dataset.variantId);
    btn.textContent = 'Added';
    updateCartBadge();
    // Revert after the confirmation has been read. Leaving the label at
    // "Added" while re-enabling the button let a second click add another
    // unit with no visible change - the button lied about what it would do.
    setTimeout(() => {
      btn.textContent = 'Add to cart';
      btn.disabled = false;
    }, 1600);
  } catch (err) {
    btn.textContent = 'Add to cart';
    btn.disabled = false;
    showCartError(card, `Couldn't add this to your cart: ${err.message}`);
  }
});
```

- [ ] **Step 4: Run the suite**

Run: `node --test tests/storefront-cart-ui.test.js`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add public-storefront/storefront.js public-storefront/storefront.css \
        tests/storefront-cart-ui.test.js
git commit -m "fix(storefront): stop the buy button lying about cart state

Closes C7."
```

---

## Task 17: Put the booking selection in the URL

Closes C8.

**Files:**
- Modify: `public-portal/portal.js:31-33, 529, 678-684`
- Create: `tests/portal-url-state.test.js`

**Interfaces:**
- Produces: `readStateFromUrl(): {date, slot, mechanicId, step}` and
  `writeStateToUrl(state)` using `history.replaceState` and `URLSearchParams`.
  A refresh at any step restores the selection.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/portal-url-state.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const src = readFile('public-portal/portal.js');

test('booking state is read from and written to the URL', () => {
  assert.match(src, /function readStateFromUrl/);
  assert.match(src, /function writeStateToUrl/);
  assert.match(src, /URLSearchParams/);
});

test('selecting a slot updates the URL', () => {
  assert.match(src, /replaceState|pushState/, 'slot selection must be reflected in history');
});

test('boot() restores state from the URL rather than starting blank', () => {
  const boot = src.slice(src.indexOf('async function boot'), src.indexOf('async function boot') + 1200);
  assert.match(boot, /readStateFromUrl/);
});

test('cancelling a booking confirms before discarding the slot', () => {
  const cancel = src.slice(src.indexOf('data-cancel-booking'));
  assert.match(cancel.slice(0, 1500), /confirmDiscard|window\.confirm|confirmDialog/,
    'one click must not silently discard a chosen slot');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/portal-url-state.test.js`
Expected: FAIL on all four.

- [ ] **Step 3: Add the URL state functions**

```javascript
// The chosen date, slot and mechanic used to live only in module-level
// variables, so a refresh - or a shared link - lost the selection with no way
// back. They now round-trip through the query string.
function readStateFromUrl() {
  const p = new URLSearchParams(location.search);
  return {
    date: p.get('date') || null,
    slot: p.get('slot') || null,
    mechanicId: p.get('mechanic') ? Number(p.get('mechanic')) : null,
    step: p.get('step') || 'picker',
  };
}

function writeStateToUrl({ date, slot, mechanicId, step }) {
  const p = new URLSearchParams();
  if (date) p.set('date', date);
  if (slot) p.set('slot', slot);
  if (mechanicId) p.set('mechanic', String(mechanicId));
  if (step && step !== 'picker') p.set('step', step);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
}
```

- [ ] **Step 4: Call them**

Set `pendingDate` / `pendingSlot` / `pendingMechanicId` from `readStateFromUrl()`
at the top of `boot()`. Call `writeStateToUrl()` on every slot selection, on
entering the auth step, and on entering the booking form.

- [ ] **Step 5: Confirm before discarding**

At `portal.js:678-684`, gate the cancel on a confirmation. The portal has no
modal system; use an inline two-button confirmation row inside the form rather
than a native `confirm()` — Task 13's test bans native dialogs in this file too.

- [ ] **Step 6: Run the suite**

Run: `node --test tests/portal-url-state.test.js && npm test`
Expected: PASS.

- [ ] **Step 7: Verify by hand**

Pick a slot, refresh the page, confirm the slot is still selected. Copy the URL
into a new tab and confirm it lands on the same step.

- [ ] **Step 8: Commit**

```bash
git add public-portal/portal.js tests/portal-url-state.test.js
git commit -m "feat(portal): keep booking selection in the URL

A refresh no longer discards the chosen slot.

Closes C8."
```

---

## Task 18: Real metadata on the public pages

Closes R7.

**Files:**
- Modify: `public-storefront/index.html`, `public-portal/index.html`
- Modify: `public-storefront/storefront.js`, `public-portal/portal.js`
- Create: `tests/public-page-meta.test.js`

**Interfaces:**
- Produces: `setPageMeta({ title, description, image })` in each customer
  front-end, called once the shop info resolves.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/public-page-meta.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

const PAGES = [
  ['public-storefront/index.html', 'public-storefront/storefront.js'],
  ['public-portal/index.html', 'public-portal/portal.js'],
];

for (const [html, js] of PAGES) {
  test(`${html} has a meta description placeholder`, () => {
    assert.match(readFile(html), /<meta name="description"/);
  });

  test(`${html} has Open Graph tags`, () => {
    const src = readFile(html);
    assert.match(src, /property="og:title"/);
    assert.match(src, /property="og:description"/);
  });

  test(`${html} declares a favicon`, () => {
    assert.match(readFile(html), /rel="icon"/);
  });

  test(`${js} sets document.title from the real shop name`, () => {
    assert.match(readFile(js), /document\.title\s*=/,
      'the page title must reflect the shop, not a placeholder');
  });
}

test('the storefront title is no longer the literal string "Shop"', () => {
  assert.doesNotMatch(readFile('public-storefront/index.html'), /<title>Shop<\/title>/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/public-page-meta.test.js`
Expected: FAIL on 9 of 9 for the storefront, most for the portal.

- [ ] **Step 3: Add the static meta to both entry points**

```html
  <title>Book a workshop slot</title>
  <meta name="description" content="Check live workshop availability and book your bike in online." />
  <meta property="og:title" content="Book a workshop slot" />
  <meta property="og:description" content="Check live workshop availability and book your bike in online." />
  <meta property="og:type" content="website" />
  <meta name="theme-color" content="#164f42" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚲</text></svg>" />
```

The storefront gets the equivalent with its own copy. These are the fallback
values shown before JS runs and to any crawler that does not execute scripts.

- [ ] **Step 4: Set the real values once the shop resolves**

```javascript
// The shop's real name is fetched on load but was never used for the page
// title - every shop's storefront tab read "Shop", and shared links had no
// preview card at all.
function setPageMeta({ title, description, image }) {
  document.title = title;
  const set = (sel, attr, value) => {
    const el = document.querySelector(sel);
    if (el && value) el.setAttribute(attr, value);
  };
  set('meta[name="description"]', 'content', description);
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', description);
  if (image) set('meta[property="og:image"]', 'content', image);
}
```

Call it from `storefront.js` after `info` resolves, with the shop name, tagline
and logo URL; and from `portal.js` with the shop name.

- [ ] **Step 5: Run the suite**

Run: `node --test tests/public-page-meta.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public-storefront/ public-portal/ tests/public-page-meta.test.js
git commit -m "feat(public): real titles, descriptions and OG tags on customer pages

Closes R7."
```

---

# WP-006 — Cleanup

## Task 19: Retire the inline styles

Closes R4 (the remaining half).

**Files:**
- Modify: `public/styles.css` (utility classes)
- Modify: `public/app.js` (106 inline `style=` attributes)
- Create: `tests/no-inline-styles.test.js`

**Interfaces:**
- Produces: `.stack`, `.row`, `.row-tight`, `.w-narrow` utilities replacing the
  repeated one-off declarations.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/no-inline-styles.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from './helpers/css.js';

// Inline styles that legitimately carry a runtime-computed value - grid
// positions for calendar blocks, progress widths. These are data, not design.
const RUNTIME_COMPUTED = /style="[^"]*\$\{/;

test('no static inline styles remain in app.js', () => {
  const src = readFile('public/app.js');
  const offenders = [];
  src.split('\n').forEach((line, i) => {
    const m = line.match(/style="[^"]*"/);
    if (m && !RUNTIME_COMPUTED.test(m[0])) offenders.push(`app.js:${i + 1} ${m[0].slice(0, 50)}`);
  });
  assert.deepEqual(offenders, [], 'static inline styles belong in a class');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/no-inline-styles.test.js`
Expected: FAIL listing the static subset of the 106 inline styles.

- [ ] **Step 3: Add the utilities**

```css
/* Replaces "flex row, gap 8" hand-typed at eight call sites, and the
   margin-top:14px that separated stacked panels at a dozen more. */
.stack     { display: flex; flex-direction: column; gap: var(--space-5); }
.row       { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.row-tight { display: flex; align-items: center; gap: var(--space-2); }
.panel + .panel { margin-top: var(--space-5); }
```

- [ ] **Step 4: Replace the static inline styles**

Work through the offender list the test prints. Leave the runtime-computed ones
(calendar block positioning) alone — those carry data, not design.

- [ ] **Step 5: Run the suite and the full gate**

Run: `node --test tests/no-inline-styles.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/styles.css public/app.js tests/no-inline-styles.test.js
git commit -m "refactor(ui): replace static inline styles with utility classes

Closes R4."
```

---

# Definition of done

The plan is complete when all of the following produce the stated output:

```bash
npm test
```

Expected: all suites pass, including the 13 new design suites. The full list of
gates this plan installs:

| Suite | Guards |
|---|---|
| `tests/helpers/css.test.js` | the helpers themselves |
| `tests/design-contrast.test.js` | 22 contrast pairs at AA |
| `tests/design-tokens.test.js` | no raw hex; all presets clear AA |
| `tests/design-scale.test.js` | spacing + type scale, focus ring |
| `tests/design-touch.test.js` | 24px tap floor |
| `tests/design-responsive.test.js` | three named breakpoints, no inline scrollers |
| `tests/a11y-markup.test.js` | live regions, no orphan labels |
| `tests/modal-shell.test.js` | one modal shell |
| `tests/modal-focus.test.js` | Escape, trap, restore |
| `tests/toast-variants.test.js` | success ≠ error |
| `tests/no-native-dialogs.test.js` | no `confirm()` / `alert()` |
| `tests/button-hierarchy.test.js` | primary means commit |
| `tests/storefront-design.test.js` | storefront on shared tokens |
| `tests/storefront-cart-ui.test.js` | honest cart state |
| `tests/portal-url-state.test.js` | booking survives refresh |
| `tests/public-page-meta.test.js` | real titles and OG tags |
| `tests/no-inline-styles.test.js` | no static inline styles |

**Three things the test suite cannot prove**, which must be checked by hand and
recorded in the phase log before this plan is called done:

1. The modal focus trap actually traps (Task 8, Step 5).
2. The phone booking picker actually appears at 375px and the slot selection
   flows through (Task 11, Step 6).
3. Nothing in the staff app visually broke from the token extraction — walk the
   Front Desk, Workshop week and month grids, and three modals.

Static tests prove the code exists. They do not prove it renders. Say which you
did.

# Deferred

| ID | Deferred | Reason | Revisit trigger |
|---|---|---|---|
| DEFER-001 | Browser-driven verification (Playwright) | Would add a large dev dependency to a one-dependency repo; decision kept separate from remediation | First visual regression that the static gates miss |
| DEFER-002 | Phase 3 polish — motion tokens, loading skeletons, dark mode, 9px status legibility | Scoped out by D-004 | After Phase 1 + 2 ship and hold |
| DEFER-003 | R8 — replacing the emoji logo | Needs a real brand asset; must not be improvised | When a logo file exists |
