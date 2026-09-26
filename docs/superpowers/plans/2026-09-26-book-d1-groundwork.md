# Book piece (d1): groundwork — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Screens can be built on installed registry controls, one shared booking-in-progress that survives a refresh, one screen frame, and a guard — with the shop's name available from `/services`.

**Architecture:** `/services` gains `shopName`. Ten registry items are installed into `src/components/ui/` with the shadcn CLI and pinned to their sources by a test. `src/screens/book/` holds the draft context (sessionStorage per shop, photos in memory), the frame, the guard, and a `useServices` query hook. The customer router nests the six book routes under a `/book/:shopSlug` layout route that provides the draft.

**Tech Stack:** Node server (`server/server.js`), React 19, react-router 8 (`createBrowserRouter`, `createMemoryRouter`, `Outlet`, `Navigate`, `Link`, `useParams`), @tanstack/react-query 5, shadcn CLI 4.19.1, `node:test` + jsdom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md`

## Global Constraints

- `/services` adds exactly one field, `shopName` (the shop's `name`); nothing else in its response changes.
- Installed controls: `button`, `input`, `label`, `checkbox`, `textarea`, `choice-card`, `pill-group`, `photo-picker`, `month-calendar`, `day-diary`, via `npx shadcn add ./public/r/<name>.json --yes`, into `src/components/ui/<name>.tsx`, byte-identical to `registry/<primitives|patterns>/<name>.tsx`. App code imports them only as `@/components/ui/<name>` (lint rule bans `@/registry` in `src/`).
- Draft storage key `wh-book-draft:<shopSlug>` in `window.sessionStorage`; photos (`File[]`) never written to storage; a throwing storage leaves the draft working in memory; `clear()` removes the stored copy.
- Frame: shop's name at top; back link when `back` given; `Step n of 4` and a progress bar when `step` given; `title` as the `h1`; `action` as a full-width button pinned to the bottom of the viewport, with bottom padding so it never covers content. Theme tokens only (`--wh-*`, `--border`, `--accent`, `--accent-dark`); no hex (lint gate).
- Guard: missing prerequisites redirect (replace) to `/book/<shopSlug>`.
- No screen is registered in `SCREENS` in d1; the six addresses keep their "Not built yet: <id>" placeholders.
- Every new test is watched failing before the code, and has a named break step whose edit is confirmed landed (grep) before running.
- Compose Postgres must be up for `npm test` (port 5433). Commit on `feat/book-d-screens`, never main; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Leave untracked `.claude/launch.json` alone.

## File map

| File | Task | Responsibility |
|---|---|---|
| `server/server.js` (`/services` route), `tests/portal-service-list.test.js` | 1 | `shopName` |
| `src/components/ui/*.tsx`, `tests/customer/installed-controls.test.js` | 2 | Installed controls pinned to sources |
| `src/screens/book/draft.tsx`, `tests/customer/draft.test.js` | 3 | Booking in progress |
| `src/screens/book/services-query.ts`, `src/screens/book/frame.tsx`, `src/screens/book/require-draft.tsx`, `src/customer/app-shell.tsx`, `tests/customer/frame.test.js`, `tests/customer/require-draft.test.js` | 4 | Frame, guard, layout route |

jsdom test pattern for Tasks 3-4 (component tests import the test build, `.test-build/<path under src>.js`):

```js
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
  uninstall = undefined; // Task 3's tests reuse one DOM within a test via `uninstall ??=`
});
```

Use `render(...)`'s returned queries, not `screen`. Compare DOM nodes with `assert.ok(a === b)`, never `assert.equal(node, ...)` (a failing equal on a React-owned node serialises the fiber graph and can hang the run).

---

### Task 1: `shopName` on `/services`

**Files:**
- Modify: `server/server.js` (`route('GET', '/api/portal/:shopSlug/services', ...)`, ~:4464)
- Test: `tests/portal-service-list.test.js`

**Interfaces:**
- Produces: `GET /api/portal/:shopSlug/services` → `{ shopName: string, showPrices, full, categories, uncategorised }`. Task 4's `useServices` reads `shopName`.

- [ ] **Step 1: Write the failing test** — append to `tests/portal-service-list.test.js`:

```js
test('the list carries the shop\'s own name, for the booking screens\' header', async () => {
  const a = await publicList(shopA);
  const b = await publicList(shopB);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.shopName, shopA.shop.name);
  assert.equal(b.body.shopName, shopB.shop.name);
  assert.notEqual(shopA.shop.name, shopB.shop.name, 'test shops share a name, so this proves nothing');
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/portal-service-list.test.js`
Expected: the new test fails with `undefined !== '<shop A name>'`; others pass.

- [ ] **Step 3: Implement.** Change the route's handler signature to receive the shop (the dispatcher already passes it, as `/booking-links` uses) and add the field first in the body:

```js
route('GET', '/api/portal/:shopSlug/services', async (req, res, params, query, shop) => {
```

```js
  sendJson(res, 200, {
    shopName: shop.name,
    showPrices,
```

Add one line to the route's comment block: `// shopName: the booking screens' header (d1 spec).`

- [ ] **Step 4: Run and see it pass** — `node --test tests/portal-service-list.test.js` (all pass).

- [ ] **Step 5: Break step.** Change `shopName: shop.name,` to `shopName: 'Wheelhouse',`; confirm with `grep -n "shopName: 'Wheelhouse'" server/server.js`. Run: the new test fails. Restore; re-run: pass.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/portal-service-list.test.js
git commit -m "feat: service list carries the shop's name for the booking screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Install the controls and pin them to their sources

**Files:**
- Create: `src/components/ui/{button,input,label,checkbox,textarea,choice-card,pill-group,photo-picker,month-calendar,day-diary}.tsx` (by the CLI); `tests/customer/installed-controls.test.js`
- Delete: `src/components/ui/.gitkeep` (the folder is no longer empty)

**Interfaces:**
- Produces: `@/components/ui/<name>` modules with the registry items' exports (`Button`, `Input`, `Label`/`Field`/`FieldError`, `Checkbox`, `Textarea`, `ChoiceCard`, `PillGroup`, `PhotoPicker`/`PHOTO_TYPES`, `MonthCalendar` + date helpers, `DayDiary` + `toMinutes`/`pxPerMinute`). Task 4 imports `Button`.

- [ ] **Step 1: Write the failing test** — `tests/customer/installed-controls.test.js`

```js
// The booking screens use installed copies of the registry controls
// (src/components/ui/, the lint rule bans importing registry/ from src/).
// An installed copy that drifts from its registry source would ship the old
// behaviour, so each must match byte for byte. After changing a registry item,
// re-install it: npx shadcn add ./public/r/<name>.json --yes --overwrite
// Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const INSTALLED = {
  button: 'primitives', input: 'primitives', label: 'primitives', checkbox: 'primitives',
  textarea: 'primitives', 'choice-card': 'primitives', 'pill-group': 'primitives',
  'photo-picker': 'patterns', 'month-calendar': 'patterns', 'day-diary': 'patterns',
};

for (const [name, kind] of Object.entries(INSTALLED)) {
  test(`${name} is installed and matches registry/${kind}/${name}.tsx`, () => {
    const installed = `src/components/ui/${name}.tsx`;
    assert.ok(existsSync(installed), `${installed} is not installed`);
    assert.equal(readFileSync(installed, 'utf8'), readFileSync(`registry/${kind}/${name}.tsx`, 'utf8'),
      `${installed} differs from its registry source - re-install it`);
  });
}
```

- [ ] **Step 2: Run and watch it fail** — `node --test tests/customer/installed-controls.test.js`: all ten fail on `is not installed`.

- [ ] **Step 3: Install**

```bash
for n in button input label checkbox textarea choice-card pill-group photo-picker month-calendar day-diary; do
  npx shadcn add ./public/r/$n.json --yes || exit 1
done
git rm -q src/components/ui/.gitkeep
git status --short
```

Expected: ten new files under `src/components/ui/`, and no other file changed. If the CLI changes anything else (e.g. `components.json`, `package.json`, `src/styles/theme.css`, adds dependencies), revert those changes with `git checkout -- <file>` and report exactly what it tried to change.

- [ ] **Step 4: Run and see it pass** — `node --test tests/customer/installed-controls.test.js` (10 pass). Then `npm run pretest && npm run typecheck && npm run lint` — clean (the test build and typecheck now include the installed files).

- [ ] **Step 5: Break step.** Append `// drift` to `src/components/ui/checkbox.tsx`; confirm with `tail -1 src/components/ui/checkbox.tsx`. Run the test: `checkbox is installed and matches...` fails. Restore with `git checkout -- src/components/ui/checkbox.tsx` (after it is committed) or by removing the line; re-run: pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui tests/customer/installed-controls.test.js
git commit -m "feat: install the booking controls into the app, pinned to their registry sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The booking in progress

**Files:**
- Create: `src/screens/book/draft.tsx`, `tests/customer/draft.test.js`

**Interfaces:**
- Produces (from `src/screens/book/draft.tsx`):
  - `type Answer = { questionId: string; text?: string; choice?: string; notSure?: true }`
  - `type BookingDraft = { serviceId?: number; notSure?: boolean; serviceName?: string; serviceMinutes?: number; answers?: Answer[]; bike?: { make: string; model: string; colour: string }; description?: string; date?: string; mechanicId?: number; startTime?: string; name?: string; phone?: string; email?: string; updateChannel?: 'email' | 'sms' | 'whatsapp'; termsAccepted?: boolean; marketingPermission?: boolean }`
  - `draftKey(shopSlug: string): string` → `wh-book-draft:<shopSlug>`
  - `DraftProvider({ shopSlug, children })`
  - `useDraft(): { draft: BookingDraft; photos: File[]; update(patch: Partial<BookingDraft>): void; setPhotos(files: File[]): void; clear(): void }` (throws outside a provider)
- Task 4 wraps routes in `DraftProvider` and the guard reads `useDraft().draft`.

- [ ] **Step 1: Write the failing test** — `tests/customer/draft.test.js` (starts with the jsdom pattern above)

```js
const DRAFT = new URL('../../.test-build/screens/book/draft.js', import.meta.url).href;

// Renders a provider with a probe that exposes the context to the test.
async function mount(shopSlug, { storage } = {}) {
  uninstall ??= installDom('http://localhost/book/' + shopSlug);
  if (storage) Object.defineProperty(window, 'sessionStorage', { value: storage, configurable: true });
  const { render, act } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await importFresh(DRAFT);
  let api;
  function Probe() { api = mod.useDraft(); return null; }
  const ui = render(h(mod.DraftProvider, { shopSlug }, h(Probe)));
  return { ui, act, mod, get api() { return api; } };
}

test('an update is saved for this shop and read back by a new provider', async () => {
  const first = await mount('north');
  await first.act(() => first.api.update({ serviceId: 7, description: 'Squeaky brakes' }));
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem('wh-book-draft:north')), { serviceId: 7, description: 'Squeaky brakes' });
  first.ui.unmount();
  const second = await mount('north');
  assert.deepEqual(second.api.draft, { serviceId: 7, description: 'Squeaky brakes' });
});

test('photos are kept in memory and never written to storage', async () => {
  const m = await mount('north');
  const photo = new File([new Uint8Array(10)], 'wheel.jpg', { type: 'image/jpeg' });
  await m.act(() => { m.api.setPhotos([photo]); m.api.update({ description: 'x' }); });
  assert.equal(m.api.photos.length, 1);
  assert.doesNotMatch(window.sessionStorage.getItem('wh-book-draft:north'), /wheel\.jpg|photo/i);
});

test('clear empties the draft and removes the stored copy', async () => {
  const m = await mount('north');
  await m.act(() => m.api.update({ serviceId: 7 }));
  await m.act(() => m.api.clear());
  assert.deepEqual(m.api.draft, {});
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), null);
});

test('two shops keep separate drafts', async () => {
  const a = await mount('north');
  await a.act(() => a.api.update({ serviceId: 1 }));
  a.ui.unmount();
  const b = await mount('south');
  assert.deepEqual(b.api.draft, {});
});

test('a storage that throws still lets the draft work in memory', async () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const m = await mount('north', { storage: broken });
  await m.act(() => m.api.update({ serviceId: 3 }));
  assert.deepEqual(m.api.draft, { serviceId: 3 });
});

test('useDraft outside a provider says so', async () => {
  uninstall ??= installDom('http://localhost/book/north');
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await importFresh(DRAFT);
  function Probe() { mod.useDraft(); return null; }
  assert.throws(() => render(h(Probe)), /DraftProvider/);
});
```

Each test gets a fresh DOM (and so a fresh `sessionStorage`) via the `afterEach` uninstall; within a test, `uninstall ??=` reuses one DOM so a second provider sees the first's storage. React logs the thrown error in the last test to the console; that is expected.

- [ ] **Step 2: Run and watch it fail** — `npm run pretest && node --test tests/customer/draft.test.js`: module not found.

- [ ] **Step 3: Implement** — `src/screens/book/draft.tsx`

```tsx
import * as React from 'react';

/**
 * The booking in progress, shared by the six book screens (Jack, 26 Sep: it
 * survives a refresh in that tab). Everything but photos is kept in the tab's
 * sessionStorage under wh-book-draft:<shopSlug> until the booking is sent or
 * the tab closes. Photos are too large to store, so they live in memory only
 * and must be re-added after a reload. If the browser refuses storage, the
 * draft still works for the life of the page.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */

export type Answer = { questionId: string; text?: string; choice?: string; notSure?: true };

export type BookingDraft = {
  serviceId?: number;
  notSure?: boolean;
  serviceName?: string;
  serviceMinutes?: number;
  answers?: Answer[];
  bike?: { make: string; model: string; colour: string };
  description?: string;
  date?: string;
  mechanicId?: number;
  startTime?: string;
  name?: string;
  phone?: string;
  email?: string;
  updateChannel?: 'email' | 'sms' | 'whatsapp';
  termsAccepted?: boolean;
  marketingPermission?: boolean;
};

type DraftApi = {
  draft: BookingDraft;
  photos: File[];
  update: (patch: Partial<BookingDraft>) => void;
  setPhotos: (files: File[]) => void;
  clear: () => void;
};

export const draftKey = (shopSlug: string) => `wh-book-draft:${shopSlug}`;

function readStored(shopSlug: string): BookingDraft {
  try {
    const raw = window.sessionStorage.getItem(draftKey(shopSlug));
    return raw ? (JSON.parse(raw) as BookingDraft) : {};
  } catch {
    return {};
  }
}

function writeStored(shopSlug: string, draft: BookingDraft) {
  try {
    if (Object.keys(draft).length === 0) window.sessionStorage.removeItem(draftKey(shopSlug));
    else window.sessionStorage.setItem(draftKey(shopSlug), JSON.stringify(draft));
  } catch {
    // Storage refused (e.g. some private modes): the draft lives in memory only.
  }
}

const DraftContext = React.createContext<DraftApi | null>(null);

export function DraftProvider({ shopSlug, children }: { shopSlug: string; children: React.ReactNode }) {
  const [draft, setDraft] = React.useState<BookingDraft>(() => readStored(shopSlug));
  const [photos, setPhotos] = React.useState<File[]>([]);

  React.useEffect(() => {
    writeStored(shopSlug, draft);
  }, [shopSlug, draft]);

  const api = React.useMemo<DraftApi>(
    () => ({
      draft,
      photos,
      update: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      setPhotos,
      clear: () => {
        setDraft({});
        setPhotos([]);
      },
    }),
    [draft, photos],
  );

  return <DraftContext.Provider value={api}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftApi {
  const api = React.useContext(DraftContext);
  if (!api) throw new Error('useDraft must be used inside a DraftProvider');
  return api;
}
```

- [ ] **Step 4: Run and see it pass** — `npm run pretest && node --test tests/customer/draft.test.js`

- [ ] **Step 5: Break steps**
  1. In `writeStored`, change `JSON.stringify(draft)` to `JSON.stringify({ ...draft, photos: 'wheel.jpg' })`; confirm with grep. Run: the photos test fails. Restore.
  2. Change `window.sessionStorage.removeItem(draftKey(shopSlug))` to `window.sessionStorage.setItem(draftKey(shopSlug), '{}')`; confirm with grep. Run: the clear test fails. Restore; re-run: pass.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npm run typecheck && npm run lint
git add src/screens/book/draft.tsx tests/customer/draft.test.js
git commit -m "feat: booking in progress kept per shop for the tab, photos in memory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Frame, guard and the book layout route

**Files:**
- Create: `src/screens/book/services-query.ts`, `src/screens/book/frame.tsx`, `src/screens/book/require-draft.tsx`, `tests/customer/frame.test.js`, `tests/customer/require-draft.test.js`
- Modify: `src/customer/app-shell.tsx`

**Interfaces:**
- Consumes: `DraftProvider`, `useDraft`, `BookingDraft` (Task 3); `Button` from `@/components/ui/button` (Task 2); `shopName` on `/services` (Task 1).
- Produces:
  - `services-query.ts`: `type PortalQuestion`, `type PortalService`, `type ServicesResponse`, `servicesPath(shopSlug)`, `useServices(shopSlug)` (React Query, key `['portal', shopSlug, 'services']`).
  - `frame.tsx`: `BookFrame({ step?: 1 | 2 | 3 | 4; title: string; back?: string; action?: { label: string; onClick: () => void; disabled?: boolean }; children: React.ReactNode })`.
  - `require-draft.tsx`: `RequireDraft({ has: (draft: BookingDraft) => boolean; children })`, `hasService(draft): boolean`.
  - `app-shell.tsx`: book routes nested under a `/book/:shopSlug` layout that renders `<DraftProvider key={shopSlug} shopSlug={shopSlug}><Outlet /></DraftProvider>`.

- [ ] **Step 1: Write the failing tests** (each starts with the jsdom pattern above)

`tests/customer/frame.test.js`:

```js
const FRAME = new URL('../../.test-build/screens/book/frame.js', import.meta.url).href;

const SERVICES = { shopName: 'North Street Cycles', showPrices: false, full: [], categories: [], uncategorised: [] };

async function renderFrame(props, path = '/book/north/problem') {
  uninstall = installDom(`http://localhost${path}`);
  globalThis.fetch = async () => new Response(JSON.stringify(SERVICES), { status: 200, headers: { 'content-type': 'application/json' } });
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { BookFrame } = await importFresh(FRAME);
  const router = createMemoryRouter([
    { path: '/book/:shopSlug/problem', Component: () => h(BookFrame, props, h('p', null, 'Screen body')) },
    { path: '/book/:shopSlug', Component: () => h('p', null, 'First screen') },
  ], { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(h(QueryClientProvider, { client }, h(RouterProvider, { router })));
}

test('shows the shop name, step, title and body', async () => {
  const ui = await renderFrame({ step: 2, title: 'Tell us about your bike' });
  assert.ok(await ui.findByText('North Street Cycles'));
  assert.ok(ui.getByText('Step 2 of 4'));
  assert.equal(ui.getByRole('progressbar').getAttribute('aria-valuenow'), '2');
  assert.ok(ui.getByRole('heading', { level: 1, name: 'Tell us about your bike' }));
  assert.ok(ui.getByText('Screen body'));
});

test('without a step there is no step count', async () => {
  const ui = await renderFrame({ title: 'Your request is with us' });
  await ui.findByText('North Street Cycles');
  assert.equal(ui.queryByText(/Step \d of 4/), null);
  assert.equal(ui.queryByRole('progressbar'), null);
});

test('the back link goes where it is told', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const ui = await renderFrame({ step: 2, title: 'T', back: '/book/north' });
  fireEvent.click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('First screen'));
});

test('the action button calls its handler, and can be disabled', async () => {
  const { fireEvent } = await import('@testing-library/react');
  let taps = 0;
  const ui = await renderFrame({ step: 2, title: 'T', action: { label: 'Choose a day', onClick: () => taps++ } });
  fireEvent.click(ui.getByRole('button', { name: 'Choose a day' }));
  assert.equal(taps, 1);
  ui.unmount();
  uninstall();
  const off = await renderFrame({ step: 2, title: 'T', action: { label: 'Choose a day', onClick: () => taps++, disabled: true } });
  assert.equal(off.getByRole('button', { name: 'Choose a day' }).disabled, true);
});
```

`tests/customer/require-draft.test.js`:

```js
const GUARD = new URL('../../.test-build/screens/book/require-draft.js', import.meta.url).href;
const DRAFT = new URL('../../.test-build/screens/book/draft.js', import.meta.url).href;

async function renderAt(stored) {
  uninstall = installDom('http://localhost/book/north/date');
  if (stored) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(stored));
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { RequireDraft, hasService } = await importFresh(GUARD);
  const { DraftProvider } = await import(DRAFT);
  const router = createMemoryRouter([
    { path: '/book/:shopSlug/date', Component: () => h(RequireDraft, { has: hasService }, h('p', null, 'Date screen')) },
    { path: '/book/:shopSlug', Component: () => h('p', null, 'First screen') },
  ], { initialEntries: ['/book/north/date'] });
  return render(h(DraftProvider, { shopSlug: 'north' }, h(RouterProvider, { router })));
}

test('a screen that needs a service, opened with none, goes back to the first screen', async () => {
  const ui = await renderAt(null);
  assert.ok(await ui.findByText('First screen'));
  assert.equal(ui.queryByText('Date screen'), null);
});

test('with a service chosen, the screen shows', async () => {
  const ui = await renderAt({ serviceId: 7 });
  assert.ok(await ui.findByText('Date screen'));
});

test('not sure counts as a chosen service', async () => {
  const ui = await renderAt({ notSure: true });
  assert.ok(await ui.findByText('Date screen'));
});
```

Note: the guard test imports the SAME built `draft.js` module the guard imports (plain `import`, not `importFresh`), so the context object matches.

- [ ] **Step 2: Run and watch them fail** — `npm run pretest && node --test tests/customer/frame.test.js tests/customer/require-draft.test.js`: module not found.

- [ ] **Step 3: Implement** `src/screens/book/services-query.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The shop's bookable services (GET /api/portal/:shopSlug/services), shared
 * through React Query: the frame reads shopName from it and the service
 * screens read the lists. Shapes match server/server.js and
 * server/service-questions.js.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */
export type PortalQuestion =
  | { id: string; wording: string; kind: 'text'; required: boolean }
  | { id: string; wording: string; kind: 'choice'; required: boolean; choices: string[]; allowNotSure: boolean };

export type PortalService = { id: number; name: string; price: number | null; minutes: number; questions: PortalQuestion[] };

export type ServicesResponse = {
  shopName: string;
  showPrices: boolean;
  full: PortalService[];
  categories: { id: number; name: string; services: PortalService[] }[];
  uncategorised: PortalService[];
};

export const servicesPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/services`;

export function useServices(shopSlug: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'services'],
    queryFn: () => apiGet<ServicesResponse>(servicesPath(shopSlug)),
  });
}
```

`src/screens/book/frame.tsx`

```tsx
import * as React from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useServices } from './services-query.ts';

/**
 * The frame around every book screen (Jack, 26 Sep: pinned button). Shop's
 * name at the top, an optional back link, "Step n of 4" with a progress bar,
 * the screen's title as its h1, then the screen. The main action is pinned to
 * the bottom of the viewport so it stays under the thumb on long screens; the
 * page gets bottom padding so the button never covers the last field.
 * `pending` passes no step and no back link.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */
export type BookFrameProps = {
  step?: 1 | 2 | 3 | 4;
  title: string;
  back?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  children: React.ReactNode;
};

export function BookFrame({ step, title, back, action, children }: BookFrameProps) {
  const { shopSlug = '' } = useParams();
  const services = useServices(shopSlug);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white px-4 text-[var(--wh-ink)]">
      <header className="flex min-h-11 items-center border-b border-[var(--wh-border)] py-2 font-semibold">
        {services.data?.shopName ?? ''}
      </header>
      <main className={cn('flex-1 py-3', action && 'pb-28')}>
        {back && (
          <Link to={back} className="mb-1 inline-flex min-h-11 items-center text-sm text-[var(--accent-dark)]">
            ← Back
          </Link>
        )}
        {step && (
          <div className="mb-3">
            <p className="m-0 mb-1 text-xs text-[var(--wh-muted)]">Step {step} of 4</p>
            <div
              role="progressbar"
              aria-label="Booking progress"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={step}
              className="h-1 rounded-sm bg-[var(--wh-border)]"
            >
              <div className="h-1 rounded-sm bg-[var(--accent-dark)]" style={{ width: `${step * 25}%` }} />
            </div>
          </div>
        )}
        <h1 className="m-0 mb-3 text-xl font-semibold">{title}</h1>
        {children}
      </main>
      {action && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[var(--wh-border)] bg-white px-4 py-3">
          <div className="mx-auto max-w-md">
            <Button variant="accent" block className="min-h-12" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

`src/screens/book/require-draft.tsx`

```tsx
import * as React from 'react';
import { Navigate, useParams } from 'react-router';
import { useDraft, type BookingDraft } from './draft.tsx';

/**
 * A screen that needs earlier answers, opened without them (an old link, a
 * cleared tab), goes back to the first book screen instead of breaking.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */
export const hasService = (draft: BookingDraft) => draft.serviceId !== undefined || draft.notSure === true;

export function RequireDraft({ has, children }: { has: (draft: BookingDraft) => boolean; children: React.ReactNode }) {
  const { draft } = useDraft();
  const { shopSlug = '' } = useParams();
  if (!has(draft)) return <Navigate to={`/book/${shopSlug}`} replace />;
  return <>{children}</>;
}
```

`src/customer/app-shell.tsx` — import `Outlet`, `useParams` from `react-router` and `DraftProvider` from `@/screens/book/draft.tsx`; add:

```tsx
const BOOK_BASE = '/book/:shopSlug';

// Every book screen shares one booking in progress for its shop, so the
// screens sit under one layout route that provides it. Keyed by shop, so
// moving to another shop's address starts that shop's own draft.
function BookLayout() {
  const { shopSlug = '' } = useParams();
  return (
    <DraftProvider key={shopSlug} shopSlug={shopSlug}>
      <Outlet />
    </DraftProvider>
  );
}
```

and replace the router's children with:

```tsx
    children: [
      {
        path: BOOK_BASE,
        Component: BookLayout,
        children: (Object.entries(CUSTOMER_ROUTES) as [CustomerScreenId, string][]).map(([id, path]) => {
          const rest = path.slice(BOOK_BASE.length).replace(/^\//, '');
          const Component = SCREENS[id] ?? notBuilt(id);
          return rest ? { path: rest, Component } : { index: true, Component };
        }),
      },
      { path: '/book/*', Component: NoSuchScreen },
    ],
```

Add a line to the header comment: `Book screens nest under a /book/:shopSlug layout that provides the booking in progress (d1).` `tests/screens/customer-routes.test.js` checks every `CUSTOMER_ROUTES` path starts with `/book/` (not `/book/:shopSlug`); the rest of the requirement — that each path sits under this layout's `/book/:shopSlug` base — is covered by the runtime throw in app-shell, not that test. If a path ever didn't start with `/book/:shopSlug`, `rest` would be wrong — add `if (!path.startsWith(BOOK_BASE)) throw new Error(\`\${id} is not under \${BOOK_BASE}\`);` at the top of the map callback.

- [ ] **Step 4: Run and see them pass**

Run: `npm run pretest && node --test tests/customer/frame.test.js tests/customer/require-draft.test.js tests/screens/customer-app-shell.test.js tests/screens/customer-routes.test.js`
Expected: all pass — the existing shell tests (placeholders at each address, "no screen" for unknown and bare `/book`) must still pass unchanged.

- [ ] **Step 5: Break steps**
  1. In `require-draft.tsx` change `if (!has(draft))` to `if (false && !has(draft))`; confirm with grep. Run the guard test: the first test fails. Restore.
  2. In `frame.tsx` change `{step && (` to `{step && step > 4 && (`; confirm with grep. Run the frame test: the first test fails. Restore.
  3. In `app-shell.tsx` change `return rest ? { path: rest, Component } : { index: true, Component };` to `return { path: rest || 'x', Component };`; confirm with grep. Run the shell test: `the first book screen renders its placeholder at /book/<shop>` fails. Restore; re-run all four files: pass.

- [ ] **Step 6: Full checks and commit**

Run: `npm run typecheck && npm run lint && npm run build && npm test && npm run test:browser`
Expected: clean; report `npm test` and Playwright counts.

```bash
git add src/screens/book src/customer/app-shell.tsx tests/customer
git commit -m "feat: book screen frame, draft guard and the /book/:shopSlug layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
