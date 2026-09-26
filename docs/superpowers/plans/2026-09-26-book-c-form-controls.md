# Book piece (c): form controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seven registry controls (choice-card, pill-group, checkbox, textarea, photo-picker, month-calendar, day-diary) drawn as Jack approved, plus the registry colour fix, each covered by jsdom tests.

**Architecture:** Each control is a shadcn-format registry item under `registry/` built on native elements and styled only with `src/styles/theme.css` custom properties. A second test build compiles `registry/` into `.test-build/registry/` so node:test + Testing Library can render the items. `npm run registry:build` regenerates `public/r/`, which CI compares byte-for-byte.

**Tech Stack:** React 19, Tailwind 4 (arbitrary `[var(--token)]` classes), Vite/rolldown SSR test build, `node:test`, jsdom, `@testing-library/react` (`render`, `fireEvent`), shadcn CLI 4.19 (`registry:build`, `registry:validate`).

**Spec:** `docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md`

## Global Constraints

- No new dependency. Native elements only; the calendar and diary are hand-built.
- Colours only from `src/styles/theme.css` custom properties, as `[var(--name)]` classes or inline styles; no hex (lint gate 2). Text/ink `--wh-ink`, muted text `--wh-muted`, borders `--wh-border` (or `--border`), error `--wh-danger`, error ground `--wh-danger-bg`, brand `--wh-brand` / `--wh-brand-dark`, hover grounds `--wh-hover` / `--wh-hover-subtle`, shop colour `--accent` (focus rings) and `--accent-dark` (selected state). Never `--muted` (a background shade in theme.css), `--ink`, `--danger`, `--danger-bg`, `--brand`, `--brand-dark` (undefined in theme.css).
- Selected state everywhere: `border-2 border-[var(--accent-dark)]` plus pale fill `bg-[color-mix(in_srgb,var(--accent-dark)_7%,white)]`; calendar selected day and diary picked time are solid `bg-[var(--accent-dark)] text-white`.
- Touch targets at least 44px tall (`min-h-11`).
- Photos: `accept="image/jpeg,image/png,image/webp"`, max 5, max 10 MB (10 * 1024 * 1024 bytes) each.
- Dates are `YYYY-MM-DD` strings and months `YYYY-MM`; all date arithmetic via `Date.UTC` / `T00:00:00Z` and `toISOString().slice`, never local time. Weeks start Monday.
- Busy diary blocks show the text `Unavailable` and nothing else.
- The controls never call the server and never format or total money (`price` is a preformatted string).
- Registry imports use `@/registry/...` for siblings and `@/lib/utils` for `cn`, as existing items do. App code (`src/`) must not import them (lint rule); only tests and the registry itself do.
- After changing any registry item or `registry/**/registry.json`, run `npm run registry:build` and commit `public/r/`; `node scripts/ci/check-registry-drift.mjs` must pass.
- Every new test is watched failing before the code, and has a named break step whose edit is confirmed landed (grep) before running.
- Compose Postgres must be up for `npm test` (port 5433). Commit on `feat/book-c-form-controls`, never main; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Leave untracked `.claude/launch.json` alone.

## File map

| File | Task | Responsibility |
|---|---|---|
| `vite.registry-test.config.ts`, `package.json` (`pretest`) | 1 | Build `registry/` for tests |
| `tests/registry/colours.test.js` | 1 | Every `var(--x)` in the registry exists in theme.css; no `--muted` |
| `registry/primitives/{button,dialog,input,label,table}.tsx`, `registry/patterns/{confirm-dialog,data-table}.tsx` | 1 | Colour names fixed |
| `registry/primitives/{checkbox,textarea,choice-card,pill-group}.tsx` + tests | 2 | Simple controls |
| `registry/patterns/photo-picker.tsx` + test | 3 | Photo picker |
| `registry/patterns/month-calendar.tsx` + test | 4 | Month calendar |
| `registry/patterns/day-diary.tsx` + test | 5 | Day diary |
| `registry/primitives/registry.json`, `registry/patterns/registry.json`, `public/r/*` | 2-5 | Registry entries and build output |

Test helper pattern used by every component test in this plan:

```js
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

const ITEM = new URL('../../.test-build/registry/primitives/<name>.js', import.meta.url).href;

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
});

async function setup() {
  uninstall = installDom('http://localhost/');
  const rtl = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await import(ITEM);
  return { ...rtl, h, mod };
}
```

(`render(...)` returns queries bound to that render; use them rather than `screen`, which binds to the first document ever created.)

---

### Task 1: Registry test build and the colour fix

**Files:**
- Create: `vite.registry-test.config.ts`, `tests/registry/colours.test.js`
- Modify: `package.json` (`pretest`), `registry/primitives/button.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `table.tsx`, `registry/patterns/confirm-dialog.tsx`, `data-table.tsx`; `public/r/*` (rebuilt)

**Interfaces:**
- Produces: `.test-build/registry/<primitives|patterns>/<name>.js` for every registry `.tsx`, built by `npm run pretest`. Later tasks' tests import from there.

- [ ] **Step 1: Write the colour test** — `tests/registry/colours.test.js`

```js
// Every colour name a registry item reads must exist in the React app's
// stylesheet. On 26 Sep the input read --ink and --danger (undefined in
// src/styles/theme.css) and --muted (a background shade there), so its text
// and error colours fell back to defaults and placeholders were near-invisible.
// Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, globSync } from 'node:fs';

const css = readFileSync('src/styles/theme.css', 'utf8');
const DEFINED = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
// Defined in theme.css, but as shadcn's muted SURFACE - wrong for text.
const WRONG_MEANING = new Set(['--muted']);

const files = globSync('registry/**/*.tsx');

test('the registry has items to check', () => {
  assert.ok(files.length >= 8, `only ${files.length} registry files found`);
});

for (const file of files) {
  test(`${file} reads only colour names theme.css defines for that purpose`, () => {
    const src = readFileSync(file, 'utf8');
    const used = [...new Set([...src.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))];
    const undefinedNames = used.filter((name) => !DEFINED.has(name));
    const wrong = used.filter((name) => WRONG_MEANING.has(name));
    assert.deepEqual(undefinedNames, [], `${file} reads names theme.css does not define`);
    assert.deepEqual(wrong, [], `${file} reads --muted, a background shade; use --wh-muted for text`);
  });
}
```

- [ ] **Step 2: Run it and watch it fail for the right reason**

Run: `node --test tests/registry/colours.test.js`
Expected: `button.tsx` fails listing `--ink --brand --brand-dark --danger`; `dialog.tsx`, `table.tsx`, `confirm-dialog.tsx` fail on `--ink`; `input.tsx` on `--ink --danger` and `--muted`; `label.tsx` on `--danger` and `--muted`; `data-table.tsx` on `--danger-bg --danger`. `money-input.tsx` passes.

- [ ] **Step 3: Fix the colour names** in those seven files, replacing inside `var(...)` only:

| Old | New |
|---|---|
| `--ink` | `--wh-ink` |
| `--danger-bg` | `--wh-danger-bg` |
| `--danger` | `--wh-danger` |
| `--brand-dark` | `--wh-brand-dark` |
| `--brand` | `--wh-brand` |
| `--muted` | `--wh-muted` |

Replace `--danger-bg` before `--danger` and `--brand-dark` before `--brand`. A one-shot, reviewable way:

```bash
for f in registry/primitives/{button,dialog,input,label,table}.tsx registry/patterns/{confirm-dialog,data-table}.tsx; do
  perl -pi -e 's/var\(--danger-bg\)/var(--wh-danger-bg)/g; s/var\(--danger\)/var(--wh-danger)/g; s/var\(--brand-dark\)/var(--wh-brand-dark)/g; s/var\(--brand\)/var(--wh-brand)/g; s/var\(--ink\)/var(--wh-ink)/g; s/var\(--muted\)/var(--wh-muted)/g' "$f"
done
git diff --stat registry
```

Update doc comments in those files that name the old tokens (e.g. label.tsx's "`.field label` ... --muted") to the new names. Do not change `--border`, `--accent`, `--accent-dark`, `--modal-bg`.

- [ ] **Step 4: Run and see it pass**

Run: `node --test tests/registry/colours.test.js` — all pass.
Run: `npx tsc -p registry --noEmit` — no errors.

- [ ] **Step 5: Registry test build** — create `vite.registry-test.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { globSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

/**
 * The registry's component-test build, run by `pretest` after
 * vite.test.config.ts (which empties .test-build/ and builds src/).
 *
 * registry/ sits outside src/, so it gets its own SSR build into
 * .test-build/registry/, one output file per source file
 * (registry/patterns/day-diary.tsx -> .test-build/registry/patterns/day-diary.js).
 * Registry files import siblings as "@/registry/..." and cn as "@/lib/utils",
 * so both aliases are mapped here, "@/registry/" first.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export default defineConfig({
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/registry\//, replacement: fileURLToPath(new URL('./registry/', import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
    ],
  },
  build: {
    ssr: true,
    outDir: '.test-build/registry',
    emptyOutDir: true,
    minify: false,
    rolldownOptions: {
      input: globSync('registry/**/*.tsx'),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'registry',
        entryFileNames: '[name].js',
      },
    },
  },
});
```

`package.json` `pretest` becomes:

```json
"pretest": "vite build --config vite.test.config.ts --logLevel warn && vite build --config vite.registry-test.config.ts --logLevel warn",
```

Run: `npm run pretest && ls .test-build/registry/primitives .test-build/registry/patterns`
Expected: `input.js`, `button.js`, ... and `money-input.js`, ... listed. If rolldown places the shared `src/lib/utils` module somewhere unexpected (e.g. under `_virtual/` or a `src/` subfolder), that is fine as long as `node -e "import('./.test-build/registry/patterns/money-input.js').then(m=>console.log(Object.keys(m)))"` prints the exports; if it fails to resolve, adjust `preserveModulesRoot` / `entryFileNames` until it does and say what you changed. Also confirm `.test-build/staff/app-shell.js` still exists (the src build is untouched).

- [ ] **Step 6: Break step (record output)**

Put `var(--ink)` back in `registry/primitives/input.tsx` (one occurrence); confirm with `grep -c "var(--ink)" registry/primitives/input.tsx` printing `1`. Run the colour test: `input.tsx` fails naming `--ink`. Restore; re-run: all pass.

- [ ] **Step 7: Rebuild registry output and check**

Run: `npm run registry:build && npm run registry:validate && node scripts/ci/check-registry-drift.mjs && npm run lint && npm run typecheck`
Expected: all succeed; `git status` shows changed `public/r/*.json` for the seven items.

- [ ] **Step 8: Commit**

```bash
git add vite.registry-test.config.ts package.json tests/registry/colours.test.js registry public/r
git commit -m "fix: registry reads the React app's real colour names; build registry for tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: checkbox, textarea, choice-card, pill-group

**Files:**
- Create: `registry/primitives/checkbox.tsx`, `textarea.tsx`, `choice-card.tsx`, `pill-group.tsx`
- Create: `tests/registry/checkbox.test.js`, `textarea.test.js`, `choice-card.test.js`, `pill-group.test.js`
- Modify: `registry/primitives/registry.json`; `public/r/*`

**Interfaces:**
- Consumes: the registry test build from Task 1.
- Produces: `Checkbox({label, ...inputProps})`, `Textarea(textareaProps)`, `ChoiceCard({title, detail?, price?, selected?, ...buttonProps})`, `PillGroup(props)` with `PillOption = {value: string; label: React.ReactNode; disabled?: boolean}` and props `{legend, options, name?, className?}` plus either `{multiple?: false; value: string | null; onChange(value: string)}` or `{multiple: true; value: string[]; onChange(value: string[])}`. Task 5's screen use (piece (d)) relies on `PillGroup`'s `multiple` form.

- [ ] **Step 1: Write the four tests** (each file starts with the helper pattern from the top of this plan, `ITEM` pointing at `.test-build/registry/primitives/<name>.js`)

`tests/registry/checkbox.test.js`:

```js
test('the label names the tick box and a click reports the change', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const ui = render(h(mod.Checkbox, { label: 'I accept the terms', onChange: (e) => seen.push(e.target.checked) }));
  const box = ui.getByRole('checkbox', { name: 'I accept the terms' });
  fireEvent.click(box);
  assert.deepEqual(seen, [true]);
});
```

`tests/registry/textarea.test.js`:

```js
test('a labelled text box reports what is typed', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const ui = render(h('label', null, 'Describe the problem',
    h(mod.Textarea, { onChange: (e) => seen.push(e.target.value) })));
  fireEvent.change(ui.getByRole('textbox', { name: 'Describe the problem' }), { target: { value: 'Squeaky brakes' } });
  assert.deepEqual(seen, ['Squeaky brakes']);
});
```

`tests/registry/choice-card.test.js`:

```js
test('a selected card says so, an unselected one does not, and a tap reports', async () => {
  const { render, fireEvent, h, mod } = await setup();
  let taps = 0;
  const ui = render(h('div', null,
    h(mod.ChoiceCard, { title: 'Full service', detail: 'Everything checked', price: '£65', selected: true }),
    h(mod.ChoiceCard, { title: 'Individual services', selected: false, onClick: () => taps++ })));
  assert.equal(ui.getByRole('button', { name: /Full service/ }).getAttribute('aria-pressed'), 'true');
  assert.ok(ui.getByText('£65'));
  const other = ui.getByRole('button', { name: /Individual services/ });
  assert.equal(other.getAttribute('aria-pressed'), 'false');
  fireEvent.click(other);
  assert.equal(taps, 1);
});

test('a card used to navigate, with no selected prop, is a plain button', async () => {
  const { render, h, mod } = await setup();
  const ui = render(h(mod.ChoiceCard, { title: 'Not sure' }));
  assert.equal(ui.getByRole('button', { name: /Not sure/ }).hasAttribute('aria-pressed'), false);
});
```

`tests/registry/pill-group.test.js`:

```js
const OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text' },
  { value: 'whatsapp', label: 'WhatsApp', disabled: true },
];

test('single choice is a labelled radio group that reports one value', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const ui = render(h(mod.PillGroup, { legend: 'How should we update you?', options: OPTIONS, value: 'email', onChange: (v) => seen.push(v) }));
  assert.ok(ui.getByRole('group', { name: 'How should we update you?' }));
  assert.equal(ui.getByRole('radio', { name: 'Email' }).checked, true);
  fireEvent.click(ui.getByRole('radio', { name: 'Text' }));
  assert.deepEqual(seen, ['sms']);
});

test('a disabled option cannot be picked', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const ui = render(h(mod.PillGroup, { legend: 'Channel', options: OPTIONS, value: 'email', onChange: (v) => seen.push(v) }));
  const off = ui.getByRole('radio', { name: 'WhatsApp' });
  assert.equal(off.disabled, true);
  fireEvent.click(off);
  assert.deepEqual(seen, []);
});

test('multiple choice reports the whole set, adding and removing', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const mechs = [{ value: '1', label: 'Sam' }, { value: '2', label: 'Alex' }];
  const ui = render(h(mod.PillGroup, { legend: 'Mechanics', options: mechs, multiple: true, value: ['1'], onChange: (v) => seen.push(v) }));
  fireEvent.click(ui.getByRole('checkbox', { name: 'Alex' }));
  fireEvent.click(ui.getByRole('checkbox', { name: 'Sam' }));
  assert.deepEqual(seen, [['1', '2'], []]);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm run pretest && node --test tests/registry/checkbox.test.js tests/registry/textarea.test.js tests/registry/choice-card.test.js tests/registry/pill-group.test.js`
Expected: each fails on `ERR_MODULE_NOT_FOUND` for its `.test-build/registry/primitives/<name>.js`.

- [ ] **Step 3: Implement** — `registry/primitives/checkbox.tsx`

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse tick box: the phone's own checkbox, coloured with the shop
 * colour, with its label beside it. The whole row is the tap target (at
 * least 44px tall).
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export type CheckboxProps = Omit<React.ComponentProps<'input'>, 'type'> & { label: React.ReactNode };

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn('flex min-h-11 cursor-pointer items-center gap-[9px] text-sm text-[var(--wh-ink)]', className)}
    >
      <input id={inputId} type="checkbox" className="size-[18px] shrink-0 accent-[var(--accent-dark)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
```

`registry/primitives/textarea.tsx`

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse multi-line text box: the input's look, at least 80px tall, and
 * the customer can drag it taller.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-20 w-full resize-y rounded-[7px] border border-[var(--border)] bg-white px-2.5 py-[9px]',
        'text-sm text-[var(--wh-ink)] placeholder:text-[var(--wh-muted)]',
        'focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--accent)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-[var(--wh-danger)]',
        className,
      )}
      {...props}
    />
  );
}
```

`registry/primitives/choice-card.tsx`

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A big tappable option card: title, optional detail line, optional price.
 * Selected = 2px shop-colour border and a pale shop-colour fill (Jack, 26 Sep:
 * the atlas card style). Pass `selected` only when the card is one of a set
 * the customer picks between; a card that just navigates leaves it out and
 * gets no aria-pressed. `price` is shown as given - never formatted here.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export type ChoiceCardProps = Omit<React.ComponentProps<'button'>, 'title'> & {
  title: React.ReactNode;
  detail?: React.ReactNode;
  price?: string;
  selected?: boolean;
};

export function ChoiceCard({ title, detail, price, selected, className, type = 'button', ...props }: ChoiceCardProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-[var(--wh-border)] bg-white px-3.5 py-4 text-left text-[var(--wh-ink)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected && 'border-2 border-[var(--accent-dark)] bg-[color-mix(in_srgb,var(--accent-dark)_7%,white)]',
        className,
      )}
      {...props}
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        {detail && <span className="text-[13px] text-[var(--wh-muted)]">{detail}</span>}
      </span>
      {price && <span className="whitespace-nowrap font-semibold">{price}</span>}
    </button>
  );
}
```

`registry/primitives/pill-group.tsx`

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Short options as tappable pills, one choice (native radios) or several
 * (native checkboxes, `multiple`). The inputs are visually hidden inside
 * each pill's label, so arrow keys, screen readers and disabled options
 * behave natively. A disabled option is greyed and cannot be picked (the
 * drop-off mechanic choice greys mechanics who cannot take the job).
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export type PillOption = { value: string; label: React.ReactNode; disabled?: boolean };

type Common = { legend: React.ReactNode; options: PillOption[]; name?: string; className?: string };
export type PillGroupProps = Common &
  (
    | { multiple?: false; value: string | null; onChange: (value: string) => void }
    | { multiple: true; value: string[]; onChange: (value: string[]) => void }
  );

export function PillGroup(props: PillGroupProps) {
  const autoName = React.useId();
  const name = props.name ?? autoName;
  const isOn = (v: string) => (props.multiple ? props.value.includes(v) : props.value === v);

  function pick(v: string) {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
    }
  }

  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0', props.className)}>
      <legend className="mb-1.5 text-xs font-semibold text-[var(--wh-muted)]">{props.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[var(--wh-border)] bg-white px-3.5 text-sm text-[var(--wh-ink)]',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]',
              isOn(o.value) && 'border-2 border-[var(--accent-dark)] bg-[color-mix(in_srgb,var(--accent-dark)_7%,white)]',
              o.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type={props.multiple ? 'checkbox' : 'radio'}
              name={name}
              value={o.value}
              checked={isOn(o.value)}
              disabled={o.disabled}
              onChange={() => pick(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 4: Registry entries** — append to `items` in `registry/primitives/registry.json`, same shape as `input`:

```json
{
  "name": "checkbox", "type": "registry:ui", "title": "Checkbox", "author": "Wheelhouse EPOS",
  "description": "The phone's own tick box coloured with the shop colour (--accent-dark), label beside it, whole row at least 44px tall.",
  "dependencies": [], "registryDependencies": [],
  "files": [{ "path": "checkbox.tsx", "type": "registry:ui" }]
},
{
  "name": "textarea", "type": "registry:ui", "title": "Textarea", "author": "Wheelhouse EPOS",
  "description": "Multi-line text box with the input's look, at least 80px tall, resizable vertically.",
  "dependencies": [], "registryDependencies": [],
  "files": [{ "path": "textarea.tsx", "type": "registry:ui" }]
},
{
  "name": "choice-card", "type": "registry:ui", "title": "Choice Card", "author": "Wheelhouse EPOS",
  "description": "Big tappable option card with title, detail and a preformatted price. Selected is a 2px shop-colour border with a pale shop-colour fill; aria-pressed only when it is one of a set to pick from.",
  "dependencies": [], "registryDependencies": [],
  "files": [{ "path": "choice-card.tsx", "type": "registry:ui" }]
},
{
  "name": "pill-group", "type": "registry:ui", "title": "Pill Group", "author": "Wheelhouse EPOS",
  "description": "Short options as pills over native radios (one choice) or checkboxes (multiple), in a labelled fieldset. Disabled options are greyed and cannot be picked.",
  "dependencies": [], "registryDependencies": [],
  "files": [{ "path": "pill-group.tsx", "type": "registry:ui" }]
}
```

- [ ] **Step 5: Run and see them pass**

Run: `npm run pretest && node --test tests/registry/*.test.js` — all pass.

- [ ] **Step 6: Break steps (record output)**

1. In `choice-card.tsx` change `aria-pressed={selected}` to `aria-pressed={selected ?? false}`; confirm with `grep -n "selected ?? false" registry/primitives/choice-card.tsx`. Rebuild and run the choice-card test: `a card used to navigate...` fails. Restore.
2. In `pill-group.tsx` delete `disabled={o.disabled}`; confirm with `grep -c "disabled={o.disabled}" registry/primitives/pill-group.tsx` printing `0`. Rebuild and run the pill-group test: `a disabled option cannot be picked` fails. Restore.
3. In `pill-group.tsx` change `props.value.filter((x) => x !== v)` to `props.value`; confirm with grep. Run: `multiple choice reports the whole set...` fails. Restore; re-run all four files: pass.

- [ ] **Step 7: Build registry output and check**

Run: `npm run registry:build && npm run registry:validate && node scripts/ci/check-registry-drift.mjs && npx tsc -p registry --noEmit && npm run lint && npm run typecheck`

- [ ] **Step 8: Commit**

```bash
git add registry/primitives tests/registry public/r
git commit -m "feat: checkbox, textarea, choice card and pill group registry controls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: photo-picker

**Files:**
- Create: `registry/patterns/photo-picker.tsx`, `tests/registry/photo-picker.test.js`
- Modify: `registry/patterns/registry.json`; `public/r/*`

**Interfaces:**
- Consumes: registry test build (Task 1).
- Produces: `PhotoPicker({value: File[], onChange(files: File[]), max = 5, maxBytes = 10 * 1024 * 1024, label = 'Add photos', className?})`, `PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']`.

- [ ] **Step 1: Write the test** (helper pattern; `ITEM` = `.test-build/registry/patterns/photo-picker.js`)

```js
const MB = 1024 * 1024;
const photo = (name, size = 1000, type = 'image/jpeg') => new File([new Uint8Array(size)], name, { type });

// A stateful wrapper so the picker sees its own onChange results, as a screen would.
async function renderPicker(initial = []) {
  const { render, fireEvent, h, mod } = await setup();
  const { useState } = await import('react');
  const changes = [];
  function Host() {
    const [files, setFiles] = useState(initial);
    return h(mod.PhotoPicker, { value: files, onChange: (f) => { changes.push(f.map((x) => x.name)); setFiles(f); } });
  }
  const ui = render(h(Host));
  const input = ui.container.querySelector('input[type="file"]');
  return { ui, fireEvent, input, changes };
}

test('the chooser asks the phone for photos only, several at once', async () => {
  const { input } = await renderPicker();
  assert.equal(input.getAttribute('accept'), 'image/jpeg,image/png,image/webp');
  assert.equal(input.multiple, true);
});

test('a JPEG is added and shown with a remove button and the count', async () => {
  const { ui, fireEvent, input, changes } = await renderPicker();
  fireEvent.change(input, { target: { files: [photo('wheel.jpg')] } });
  assert.deepEqual(changes, [['wheel.jpg']]);
  assert.ok(ui.getByRole('button', { name: 'Remove wheel.jpg' }));
  assert.ok(ui.getByText(/1 of 5 added/));
});

test('a PDF, an 11 MB photo and a sixth photo are refused with a message each', async () => {
  const four = ['a', 'b', 'c', 'd'].map((n) => photo(`${n}.jpg`));
  const { ui, fireEvent, input, changes } = await renderPicker(four);
  fireEvent.change(input, { target: { files: [photo('notes.pdf', 1000, 'application/pdf'), photo('huge.jpg', 11 * MB), photo('e.jpg'), photo('f.jpg')] } });
  assert.deepEqual(changes, [['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']]);
  const alert = ui.getByRole('alert').textContent;
  assert.match(alert, /notes\.pdf/);
  assert.match(alert, /huge\.jpg/);
  assert.match(alert, /f\.jpg/);
});

test('remove drops only that photo', async () => {
  const { ui, fireEvent, changes } = await renderPicker([photo('a.jpg'), photo('b.jpg')]);
  fireEvent.click(ui.getByRole('button', { name: 'Remove a.jpg' }));
  assert.deepEqual(changes, [['b.jpg']]);
});
```

- [ ] **Step 2: Run and watch it fail** (`ERR_MODULE_NOT_FOUND`)

Run: `npm run pretest && node --test tests/registry/photo-picker.test.js`

- [ ] **Step 3: Implement** — `registry/patterns/photo-picker.tsx`

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Photo picker for a booking: "Add photos" opens the phone's own chooser
 * (camera or library). Photos only - JPEG, PNG or WebP, the types the booking
 * server accepts - up to `max`, each up to `maxBytes`. Anything else is refused
 * here with a message naming the file and the rule, and the accepted files are
 * kept. Chosen photos show as thumbnails with a remove button each.
 * Turning files into the base64 the server wants is the screen's job.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type PhotoPickerProps = {
  value: File[];
  onChange: (files: File[]) => void;
  max?: number;
  maxBytes?: number;
  label?: React.ReactNode;
  className?: string;
};

export function PhotoPicker({ value, onChange, max = 5, maxBytes = 10 * 1024 * 1024, label = 'Add photos', className }: PhotoPickerProps) {
  const inputId = React.useId();
  const [refused, setRefused] = React.useState<string[]>([]);
  const urls = React.useMemo(() => value.map((f) => URL.createObjectURL(f)), [value]);
  React.useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function add(list: FileList | File[] | null) {
    const kept = [...value];
    const why: string[] = [];
    for (const f of Array.from(list ?? [])) {
      if (!PHOTO_TYPES.includes(f.type)) why.push(`${f.name} isn't a JPEG, PNG or WebP photo.`);
      else if (f.size > maxBytes) why.push(`${f.name} is over ${Math.round(maxBytes / (1024 * 1024))} MB.`);
      else if (kept.length >= max) why.push(`${f.name} wasn't added: ${max} photos is the most.`);
      else kept.push(f);
    }
    setRefused(why);
    if (kept.length !== value.length) onChange(kept);
  }

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {value.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
          {value.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative size-[58px]">
              <img src={urls[i]} alt={f.name} className="size-full rounded-md object-cover" />
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-[var(--wh-ink)] text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        htmlFor={inputId}
        className={cn(
          'flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-[7px] border border-dashed border-[var(--wh-muted)] p-3.5 text-center text-sm text-[var(--wh-ink)]',
          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]',
          value.length >= max && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-[var(--wh-muted)]">
          Optional · {value.length} of {max} added · up to {Math.round(maxBytes / (1024 * 1024))} MB each
        </span>
        <input
          id={inputId}
          type="file"
          accept={PHOTO_TYPES.join(',')}
          multiple
          disabled={value.length >= max}
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = ''; // choosing the same file again still fires
          }}
        />
      </label>
      {refused.length > 0 && (
        <ul role="alert" className="m-0 list-none rounded-md bg-[var(--wh-danger-bg)] p-2.5 text-[12.5px] text-[var(--wh-danger)]">
          {refused.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

If jsdom lacks `URL.createObjectURL` in the test, add at the top of the test file: `globalThis.URL.createObjectURL ??= () => 'blob:test'; globalThis.URL.revokeObjectURL ??= () => {};` and say so in the report.

- [ ] **Step 4: Registry entry** — append to `items` in `registry/patterns/registry.json`:

```json
{
  "name": "photo-picker", "type": "registry:ui", "title": "Photo Picker", "author": "Wheelhouse EPOS",
  "description": "Opens the phone's chooser for JPEG, PNG or WebP photos, up to 5 of up to 10 MB each by default. Refuses anything else with a message naming the file; shows thumbnails with a remove button each. Converting to base64 for the server is left to the screen.",
  "dependencies": [], "registryDependencies": [],
  "files": [{ "path": "photo-picker.tsx", "type": "registry:ui" }]
}
```

- [ ] **Step 5: Run and see it pass** — `npm run pretest && node --test tests/registry/photo-picker.test.js`

- [ ] **Step 6: Break steps (record output)**

1. Change `else if (f.size > maxBytes)` to `else if (f.size > maxBytes * 2)`; confirm with grep. Run: the refusal test fails (`huge.jpg` kept). Restore.
2. Change `else if (kept.length >= max)` to `else if (kept.length > max)`; confirm with grep. Run: the refusal test fails (`f.jpg` kept). Restore; re-run: pass.

- [ ] **Step 7: Build registry output and check** — same command as Task 2 Step 7.

- [ ] **Step 8: Commit**

```bash
git add registry/patterns tests/registry/photo-picker.test.js public/r
git commit -m "feat: photo picker registry control

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: month-calendar

**Files:**
- Create: `registry/patterns/month-calendar.tsx`, `tests/registry/month-calendar.test.js`
- Modify: `registry/patterns/registry.json`; `public/r/*`

**Interfaces:**
- Consumes: registry test build (Task 1).
- Produces: `MonthCalendar({month: string /* YYYY-MM */, onMonthChange(month), available: ReadonlySet<string>, value?: string | null, onChange(date), className?})`; helpers `monthDays(month): string[]`, `leadingBlanks(month): number` (Monday-first), `addDays(date, n): string`, `addMonths(month, n): string`.

- [ ] **Step 1: Write the test** (helper pattern; `ITEM` = `.test-build/registry/patterns/month-calendar.js`)

```js
async function renderCal({ month = '2026-10', available = ['2026-10-08', '2026-10-09'], value = null } = {}) {
  const { render, fireEvent, h, mod } = await setup();
  const picked = [];
  const months = [];
  const ui = render(h(mod.MonthCalendar, {
    month, available: new Set(available), value,
    onChange: (d) => picked.push(d), onMonthChange: (m) => months.push(m),
  }));
  const day = (d) => ui.container.querySelector(`[data-date="${d}"]`);
  return { ui, fireEvent, picked, months, day, mod };
}

test('the date helpers work in UTC and weeks start on Monday', async () => {
  const { mod } = await renderCal();
  assert.equal(mod.monthDays('2026-02').length, 28);
  assert.equal(mod.leadingBlanks('2026-10'), 3); // 1 Oct 2026 is a Thursday
  assert.equal(mod.leadingBlanks('2026-11'), 6); // 1 Nov 2026 is a Sunday
  assert.equal(mod.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(mod.addMonths('2026-12', 1), '2027-01');
});

test('a month starting on Sunday lays out six blanks before day 1', async () => {
  const { ui } = await renderCal({ month: '2026-11', available: [] });
  const cells = [...ui.container.querySelectorAll('[data-cell]')];
  assert.equal(cells.slice(0, 6).every((c) => c.getAttribute('data-cell') === 'blank'), true);
  assert.equal(cells[6].getAttribute('data-date'), '2026-11-01');
});

test('an available day reports its date; an unavailable one does nothing', async () => {
  const { fireEvent, picked, day } = await renderCal();
  assert.match(day('2026-10-08').getAttribute('aria-label'), /8 October 2026/);
  fireEvent.click(day('2026-10-08'));
  assert.equal(day('2026-10-07').getAttribute('aria-disabled'), 'true');
  fireEvent.click(day('2026-10-07'));
  assert.deepEqual(picked, ['2026-10-08']);
});

test('the picked day is marked', async () => {
  const { day } = await renderCal({ value: '2026-10-09' });
  assert.equal(day('2026-10-09').getAttribute('aria-pressed'), 'true');
  assert.equal(day('2026-10-08').getAttribute('aria-pressed'), 'false');
});

test('arrow keys move between days, and past the month end ask for the next month', async () => {
  const { fireEvent, months, day } = await renderCal({ value: '2026-10-08' });
  const start = day('2026-10-08');
  assert.equal(start.tabIndex, 0);
  assert.equal(day('2026-10-09').tabIndex, -1);
  fireEvent.keyDown(start, { key: 'ArrowRight' });
  assert.equal(document.activeElement.getAttribute('data-date'), '2026-10-09');
  fireEvent.keyDown(day('2026-10-09'), { key: 'ArrowDown' });
  fireEvent.keyDown(day('2026-10-16'), { key: 'ArrowDown' });
  fireEvent.keyDown(day('2026-10-23'), { key: 'ArrowDown' });
  fireEvent.keyDown(day('2026-10-30'), { key: 'ArrowDown' });
  assert.deepEqual(months, ['2026-11']);
});

test('the month buttons ask for the previous and next month', async () => {
  const { ui, fireEvent, months } = await renderCal();
  fireEvent.click(ui.getByRole('button', { name: 'Previous month' }));
  fireEvent.click(ui.getByRole('button', { name: 'Next month' }));
  assert.deepEqual(months, ['2026-09', '2026-11']);
  assert.ok(ui.getByText('October 2026'));
});
```

- [ ] **Step 2: Run and watch it fail** (`ERR_MODULE_NOT_FOUND`)

Run: `npm run pretest && node --test tests/registry/month-calendar.test.js`

- [ ] **Step 3: Implement** — `registry/patterns/month-calendar.tsx`

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * One month for picking a booking day (Jack, 26 Sep: the atlas month grid).
 * Weeks start Monday. A date not in `available` is greyed, struck through,
 * aria-disabled and does nothing - no "Full"/"Closed" label, because the
 * server never says why a day is unavailable. Arrow keys move between days
 * (one focusable day at a time); leaving the month asks for the next or
 * previous one. Dates are YYYY-MM-DD strings worked in UTC, so no time zone
 * can shift a day.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export function monthDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** Blank cells before day 1 in a Monday-first week. */
export function leadingBlanks(month: string): number {
  return (utc(`${month}-01`).getUTCDay() + 6) % 7;
}

export function addDays(date: string, n: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const TITLE = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_NAME = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export type MonthCalendarProps = {
  month: string;
  onMonthChange: (month: string) => void;
  available: ReadonlySet<string>;
  value?: string | null;
  onChange: (date: string) => void;
  className?: string;
};

function firstFocus(days: string[], available: ReadonlySet<string>, value: string | null) {
  if (value && days.includes(value)) return value;
  return days.find((d) => available.has(d)) ?? days[0];
}

export function MonthCalendar({ month, onMonthChange, available, value = null, onChange, className }: MonthCalendarProps) {
  const days = monthDays(month);
  const [focusDate, setFocusDate] = React.useState(() => firstFocus(days, available, value));
  const current = days.includes(focusDate) ? focusDate : firstFocus(days, available, value);
  const moved = React.useRef(false);
  const gridRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${current}"]`)?.focus();
  }, [current]);

  function onKeyDown(e: React.KeyboardEvent, date: string) {
    const step = STEP[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = addDays(date, step);
    moved.current = true;
    setFocusDate(next);
    if (next.slice(0, 7) !== month) onMonthChange(next.slice(0, 7));
  }

  const title = TITLE.format(utc(`${month}-01`));
  const arrow =
    'flex size-11 items-center justify-center rounded-md text-lg text-[var(--wh-ink)] hover:bg-[var(--wh-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]';

  return (
    <div className={cn('flex flex-col gap-2 text-[var(--wh-ink)]', className)}>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" className={arrow} onClick={() => onMonthChange(addMonths(month, -1))}>‹</button>
        <h2 className="m-0 text-base font-semibold" aria-live="polite">{title}</h2>
        <button type="button" aria-label="Next month" className={arrow} onClick={() => onMonthChange(addMonths(month, 1))}>›</button>
      </div>
      <div ref={gridRef} role="group" aria-label={title} className="grid grid-cols-7 gap-[5px] text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} aria-hidden="true" className="text-[11px] text-[var(--wh-muted)]">{w}</span>
        ))}
        {Array.from({ length: leadingBlanks(month) }, (_, i) => (
          <span key={`b${i}`} data-cell="blank" />
        ))}
        {days.map((d) => {
          const open = available.has(d);
          const picked = d === value;
          return (
            <button
              key={d}
              type="button"
              data-cell="day"
              data-date={d}
              aria-label={DAY_NAME.format(utc(d))}
              aria-disabled={open ? undefined : true}
              aria-pressed={picked}
              tabIndex={d === current ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, d)}
              onClick={() => { if (open) onChange(d); }}
              className={cn(
                'min-h-11 rounded-md border-0 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]',
                open ? 'bg-[var(--wh-hover)] text-[var(--wh-ink)]' : 'cursor-not-allowed bg-white text-[var(--wh-muted)] line-through',
                picked && 'bg-[var(--accent-dark)] font-semibold text-white',
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Registry entry** — append to `registry/patterns/registry.json` `items`:

```json
{
  "name": "month-calendar", "type": "registry:ui", "title": "Month Calendar", "author": "Wheelhouse EPOS",
  "description": "One Monday-first month for picking a booking day. Days not in `available` are greyed, struck through and aria-disabled. Arrow keys move between days and across months; dates are YYYY-MM-DD strings handled in UTC.",
  "dependencies": [], "registryDependencies": [],
  "files": [{ "path": "month-calendar.tsx", "type": "registry:ui" }]
}
```

- [ ] **Step 5: Run and see it pass** — `npm run pretest && node --test tests/registry/month-calendar.test.js`

- [ ] **Step 6: Break steps (record output)**

1. Change `onClick={() => { if (open) onChange(d); }}` to `onClick={() => onChange(d)}`; confirm with grep. Run: `an available day reports...` fails (`2026-10-07` reported). Restore.
2. Change `(utc(`${month}-01`).getUTCDay() + 6) % 7` to `utc(`${month}-01`).getUTCDay()`; confirm with grep. Run: the helpers test and the Sunday layout test fail. Restore; re-run: pass.

- [ ] **Step 7: Build registry output and check** — same command as Task 2 Step 7.

- [ ] **Step 8: Commit**

```bash
git add registry/patterns tests/registry/month-calendar.test.js public/r
git commit -m "feat: month calendar registry control

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: day-diary

**Files:**
- Create: `registry/patterns/day-diary.tsx`, `tests/registry/day-diary.test.js`
- Modify: `registry/patterns/registry.json`; `public/r/*`

**Interfaces:**
- Consumes: registry test build (Task 1).
- Produces: `DayDiary({open: string, close: string /* HH:MM */, columns: DiaryColumn[], value?: {columnId: string; time: string} | null, onChange(value), className?})`, `DiaryColumn = {id: string; name: string; busy: {start: string; end: string}[]; startTimes: string[]}`, helpers `toMinutes(time): number`, `pxPerMinute(columns): number`.

- [ ] **Step 1: Write the test** (helper pattern; `ITEM` = `.test-build/registry/patterns/day-diary.js`)

```js
const COLUMNS = [
  { id: '1', name: 'Sam', busy: [{ start: '09:00', end: '10:00' }], startTimes: ['10:00', '10:30', '11:00'] },
  { id: '2', name: 'Alex', busy: [{ start: '09:30', end: '11:00' }], startTimes: ['11:00'] },
];

async function renderDiary(value = null) {
  const { render, fireEvent, h, mod } = await setup();
  const picked = [];
  const ui = render(h(mod.DayDiary, { open: '09:00', close: '12:00', columns: COLUMNS, value, onChange: (v) => picked.push(v) }));
  return { ui, fireEvent, picked, mod };
}

test('one labelled column per mechanic', async () => {
  const { ui } = await renderDiary();
  assert.ok(ui.getByRole('group', { name: 'Sam' }));
  assert.ok(ui.getByRole('group', { name: 'Alex' }));
});

test('booked time says Unavailable and nothing else', async () => {
  const { ui } = await renderDiary();
  const blocks = [...ui.container.querySelectorAll('[data-busy]')];
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map((b) => b.textContent), ['Unavailable', 'Unavailable']);
});

test('each allowed start time is a button, and pressing one reports it', async () => {
  const { ui, fireEvent, picked } = await renderDiary();
  fireEvent.click(ui.getByRole('button', { name: 'Sam, 10:30' }));
  assert.deepEqual(picked, [{ columnId: '1', time: '10:30' }]);
});

test('a time the server did not offer has no button', async () => {
  const { ui } = await renderDiary();
  assert.equal(ui.queryByRole('button', { name: 'Alex, 10:00' }), null);
  assert.equal(ui.queryByRole('button', { name: 'Sam, 09:30' }), null);
});

test('the picked time is marked', async () => {
  const { ui } = await renderDiary({ columnId: '2', time: '11:00' });
  assert.equal(ui.getByRole('button', { name: 'Alex, 11:00' }).getAttribute('aria-pressed'), 'true');
  assert.equal(ui.getByRole('button', { name: 'Sam, 11:00' }).getAttribute('aria-pressed'), 'false');
});

test('start times 30 minutes apart get at least 44px each', async () => {
  const { mod } = await renderDiary();
  assert.ok(mod.pxPerMinute(COLUMNS) * 30 >= 44);
  const fifteen = [{ id: '1', name: 'Sam', busy: [], startTimes: ['09:00', '09:15'] }];
  assert.ok(mod.pxPerMinute(fifteen) * 15 >= 44);
});
```

- [ ] **Step 2: Run and watch it fail** (`ERR_MODULE_NOT_FOUND`)

Run: `npm run pretest && node --test tests/registry/day-diary.test.js`

- [ ] **Step 3: Implement** — `registry/patterns/day-diary.tsx`

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * One day's diary for picking a start time (Jack, 26 Sep: brought over from
 * the pre-31-Aug booking page's mechanic diary, one day at a time for
 * phones). One column per mechanic, hours down the side. Booked time is a
 * grey "Unavailable" block with no other detail. Open time is made of one
 * button per start time the server allows, so every tap lands on a real
 * time and a keyboard or screen reader can reach each one. The scale is set
 * so the closest two start times are still 44px apart.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */

export type DiaryColumn = { id: string; name: string; busy: { start: string; end: string }[]; startTimes: string[] };
export type DiaryValue = { columnId: string; time: string };
export type DayDiaryProps = {
  open: string;
  close: string;
  columns: DiaryColumn[];
  value?: DiaryValue | null;
  onChange: (value: DiaryValue) => void;
  className?: string;
};

const MIN_TARGET_PX = 44;

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Pixels per minute so the smallest gap between start times is 44px (30 minutes if none are closer). */
export function pxPerMinute(columns: DiaryColumn[]): number {
  let gap = 30;
  for (const c of columns) {
    const ts = c.startTimes.map(toMinutes).sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) {
      const g = ts[i] - ts[i - 1];
      if (g > 0 && g < gap) gap = g;
    }
  }
  return MIN_TARGET_PX / gap;
}

export function DayDiary({ open, close, columns, value = null, onChange, className }: DayDiaryProps) {
  const start = toMinutes(open);
  const end = toMinutes(close);
  const ppm = pxPerMinute(columns);
  const height = (end - start) * ppm;
  const y = (t: number) => (Math.min(Math.max(t, start), end) - start) * ppm;

  const hours: number[] = [];
  for (let t = Math.ceil(start / 60) * 60; t < end; t += 60) hours.push(t);

  return (
    <div
      className={cn('grid gap-x-1.5 text-[var(--wh-ink)]', className)}
      style={{ gridTemplateColumns: `40px repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      <div />
      {columns.map((c) => (
        <div key={c.id} className="mb-1 text-center text-sm font-semibold">{c.name}</div>
      ))}
      <div className="relative" style={{ height }} aria-hidden="true">
        {hours.map((t) => (
          <span key={t} className="absolute left-0 text-[11px] text-[var(--wh-muted)]" style={{ top: y(t) }}>
            {`${String(t / 60).padStart(2, '0')}:00`}
          </span>
        ))}
      </div>
      {columns.map((c) => {
        const times = c.startTimes.map(toMinutes).sort((a, b) => a - b);
        return (
          <div key={c.id} role="group" aria-label={c.name} className="relative rounded-md bg-[var(--wh-hover-subtle)]" style={{ height }}>
            {c.busy.map((b, i) => {
              const top = y(toMinutes(b.start));
              const h = y(toMinutes(b.end)) - top;
              if (h <= 0) return null;
              return (
                <div
                  key={`busy-${i}`}
                  data-busy=""
                  className="absolute inset-x-[3px] flex items-center justify-center overflow-hidden rounded-[5px] bg-[var(--wh-hover)] bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--wh-border)_5px_7px)] text-[11px] text-[var(--wh-muted)]"
                  style={{ top, height: h }}
                >
                  Unavailable
                </div>
              );
            })}
            {times.map((t, i) => {
              const label = c.startTimes.find((s) => toMinutes(s) === t) as string;
              const nextStart = times[i + 1] ?? end;
              const nextBusy = Math.min(end, ...c.busy.map((b) => toMinutes(b.start)).filter((b) => b > t));
              const span = Math.max(1, Math.min(nextStart, nextBusy) - t);
              const picked = value?.columnId === c.id && value.time === label;
              return (
                <button
                  key={label}
                  type="button"
                  aria-label={`${c.name}, ${label}`}
                  aria-pressed={picked}
                  onClick={() => onChange({ columnId: c.id, time: label })}
                  className={cn(
                    'absolute inset-x-[3px] flex items-start justify-start rounded-[5px] px-1.5 pt-0.5 text-[11px] text-[var(--wh-muted)]',
                    'hover:bg-[color-mix(in_srgb,var(--accent-dark)_7%,white)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                    picked && 'bg-[var(--accent-dark)] font-semibold text-white hover:bg-[var(--accent-dark)]',
                  )}
                  style={{ top: y(t), height: span * ppm }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Registry entry** — append to `registry/patterns/registry.json` `items`:

```json
{
  "name": "day-diary", "type": "registry:ui", "title": "Day Diary", "author": "Wheelhouse EPOS",
  "description": "One day's diary for picking a start time: a column per mechanic, hours down the side, booked time as grey 'Unavailable' blocks with no detail, and one button per start time the server allows. Scaled so start times are at least 44px apart.",
  "dependencies": [], "registryDependencies": [],
  "files": [{ "path": "day-diary.tsx", "type": "registry:ui" }]
}
```

- [ ] **Step 5: Run and see it pass** — `npm run pretest && node --test tests/registry/day-diary.test.js`

- [ ] **Step 6: Break steps (record output)**

1. Change the busy block's text `Unavailable` to `{b.start}-{b.end}`; confirm with `grep -n "{b.start}-{b.end}" registry/patterns/day-diary.tsx`. Run: `booked time says Unavailable...` fails. Restore.
2. Change `let gap = 30;` to `let gap = 60;` and `return MIN_TARGET_PX / gap;` to `return 44 / 60;`; confirm with grep. Run: the 44px test fails. Restore; re-run: pass.

- [ ] **Step 7: Build registry output and full checks**

Run: `npm run registry:build && npm run registry:validate && node scripts/ci/check-registry-drift.mjs && npx tsc -p registry --noEmit && npm run lint && npm run typecheck && npm test`
Expected: all succeed; report `npm test` counts.

- [ ] **Step 8: Commit**

```bash
git add registry/patterns tests/registry/day-diary.test.js public/r
git commit -m "feat: day diary registry control

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
