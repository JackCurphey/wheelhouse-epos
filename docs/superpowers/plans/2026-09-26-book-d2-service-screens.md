# Book (d2): the service screens - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first two customer booking screens: `service` (three options) and `service-list` (multi-select with hint-and-lock, prices, running summary and Continue). This includes the draft change to `serviceIds[]` and the frame's loading, error and focus behaviour.

**Architecture:**
- The tick/lock/summary/limit rules are pure functions in `src/screens/book/service-selection.ts`.
- The two screens (`service.tsx`, `service-list.tsx`) render with d1's `BookFrame` and `ChoiceCard`, and read and write the booking through `useDraft()`.
- `BookFrame` gains the loading, unknown-shop and failed states, focus on its `h1`, and an `actionNote` slot in the pinned area.
- The screens are registered in `SCREENS` in `src/customer/app-shell.tsx`.

**Tech Stack:**
- React 19, TypeScript, react-router 7, @tanstack/react-query
- Tailwind classes using the `--wh-*` / `--accent*` variables already used in `frame.tsx`
- tests: `node:test` + jsdom + @testing-library/react against `.test-build/` (built by `npm run pretest`), and Playwright (`npm run test:browser`)

**Spec:** `docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md`

## Global Constraints

- Branch `feat/book-d2-service-screens`, on `main` after #77 (piece 8) merged at `4049fa9`. Never commit to `main`.
- Customer component tests run against the build. After changing anything in `src/`, run `npm run pretest` before `node --test tests/customer/<file>.test.js`. `npm test` does both.
- Postgres (compose, port 5433) must be running for `npm test` and Playwright.
- Create no files in the repo other than those this plan names. No scratch or debug files in the repo; use `/tmp`.
- Every new test is watched failing for the right reason before the code that passes it. Each task's mutation step proves one test bites. Show the mutation in `git diff` before running, then restore it.
- In jsdom tests, compare DOM nodes with `assert.ok(a === b)`, never `assert.equal`. Clear the React Query client in `afterEach`.
- Never hand-edit `src/components/ui/`. No control changes are needed.
- Copy is verbatim from the spec:
  - "What do you need?"
  - "Full services" / "Whole-bike services"
  - "Individual services" / "Single jobs, like brakes or gears"
  - "Not sure" / "Tell us what's wrong and we'll advise"
  - "This shop isn't taking bookings online at the moment - please contact them directly"
  - "Choose your services"
  - "Prices are for labour. Parts are quoted separately."
  - "Full services", "Other"
  - "From £X"
  - "Includes A, B, C and N more"
  - "Included in your <full>"
  - "<service> is part of your <full>, so we've taken it off"
  - "Not sure what you need? Describe the problem"
  - "1 service" / "N services" / " · from £T"
  - "Choose at least one service"
  - "You can book up to 10 services at once"
  - "That's too much work for one visit - please book the jobs separately"
  - "Continue"
  - "Loading…"
  - "We can't find this shop"
  - "We couldn't load this shop's services"
  - "Try again"
- Limits: at most **10** services, at most **720** summed minutes.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No dependency, CI or server changes.

## Files

- Create `src/screens/book/service-selection.ts`: the rules.
- Create `tests/customer/service-selection.test.js`.
- Modify `src/screens/book/draft.tsx`: types only.
- Modify `src/screens/book/require-draft.tsx`: `hasService`.
- Modify `tests/customer/draft.test.js`, `tests/customer/require-draft.test.js`, `tests/customer/book-layout.test.js`: `serviceId` becomes `serviceIds`.
- Modify `src/screens/book/frame.tsx` and `tests/customer/frame.test.js`.
- Create `tests/helpers/book-screen.js`: renders one book screen in jsdom.
- Create `src/screens/book/service.tsx` and `tests/customer/service-screen.test.js`.
- Create `src/screens/book/service-list.tsx` and `tests/customer/service-list-screen.test.js`.
- Modify `src/customer/app-shell.tsx`: `SCREENS`.
- Modify `tests/browser/smoke.spec.ts`: `/book/any-shop` is no longer a placeholder.
- Create `tests/browser/book-service-list.spec.ts`: the 320px check.
- Modify `.agents/STATUS.md`.

---

### Task 1: The selection rules

**Files:**
- Create: `src/screens/book/service-selection.ts`
- Test: `tests/customer/service-selection.test.js`

**Interfaces:**
- Consumes: `ServicesResponse`, `PortalService`, `PortalFullService` from `src/screens/book/services-query.ts`. `PortalFullService` is `PortalService & { includes: { id: number; name: string }[] }`.
- Produces (all exported):
  - `MAX_SERVICES = 10` and `MAX_MINUTES = 720`
  - `type Notice = { id: number; text: string }`
  - `listOrder(data): PortalService[]`
  - `chosenServices(data, ticked: number[]): PortalService[]`, in list order, dropping ids not in the list
  - `lockedBy(data, ticked, id): PortalFullService | null`
  - `toggle(data, ticked, id): { ticked: number[]; notices: Notice[] }`. It returns the same `ticked` array when a locked id is tapped.
  - `includesLine(full): string | null`
  - `formatMoney(amount: number): string`
  - `formatFrom(price: number): string`
  - `summary(data, ticked): string`
  - `totalMinutes(data, ticked): number`
  - `continueError(data, ticked): string | null`

- [ ] **Step 1: Write the failing test** `tests/customer/service-selection.test.js`

```js
// The service list's rules: hint-and-lock, the includes line, prices, the
// running summary and Continue's limits.
// Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const RULES = new URL('../../.test-build/screens/book/service-selection.js', import.meta.url).href;
const r = await import(RULES);

const svc = (id, name, price = 20, minutes = 30) => ({ id, name, price, minutes, questions: [] });
const DATA = {
  shopName: 'North Street Cycles',
  showPrices: true,
  full: [
    { ...svc(1, 'General service', 80, 90), includes: [{ id: 11, name: 'Brake service' }, { id: 12, name: 'Gear service' }] },
    { ...svc(2, 'Premium service', 120, 120), includes: [{ id: 11, name: 'Brake service' }] },
  ],
  categories: [
    { id: 5, name: 'Brakes', services: [svc(11, 'Brake service', 25)] },
    { id: 6, name: 'Wheels', services: [svc(13, 'Wheel true', 15)] },
  ],
  uncategorised: [svc(12, 'Gear service', 22.5)],
};

test('the list order is full services, then each category, then uncategorised', () => {
  assert.deepEqual(r.listOrder(DATA).map((s) => s.id), [1, 2, 11, 13, 12]);
});

test('a ticked full service locks what it includes; the first ticked by list order is named', () => {
  assert.equal(r.lockedBy(DATA, [], 11), null);
  assert.equal(r.lockedBy(DATA, [2], 11).name, 'Premium service');
  assert.equal(r.lockedBy(DATA, [2, 1], 11).name, 'General service');
  assert.equal(r.lockedBy(DATA, [1], 13), null);
});

test('ticking adds in list order; ticking again removes', () => {
  assert.deepEqual(r.toggle(DATA, [], 13), { ticked: [13], notices: [] });
  assert.deepEqual(r.toggle(DATA, [13], 12).ticked, [13, 12]);
  assert.deepEqual(r.toggle(DATA, [13, 1], 2).ticked, [1, 2, 13]);
  assert.deepEqual(r.toggle(DATA, [1, 13], 1), { ticked: [13], notices: [] });
});

test('tapping a locked service changes nothing', () => {
  const ticked = [1];
  const out = r.toggle(DATA, ticked, 12);
  assert.ok(out.ticked === ticked, 'expected the same array back');
  assert.deepEqual(out.notices, []);
});

test('ticking a full service takes off what it includes, with a notice for each', () => {
  const out = r.toggle(DATA, [11, 12, 13], 1);
  assert.deepEqual(out.ticked, [1, 13]);
  assert.deepEqual(out.notices, [
    { id: 11, text: "Brake service is part of your General service, so we've taken it off" },
    { id: 12, text: "Gear service is part of your General service, so we've taken it off" },
  ]);
});

test('unticking the full service unlocks without re-ticking', () => {
  const out = r.toggle(DATA, [1], 1);
  assert.deepEqual(out.ticked, []);
  assert.equal(r.lockedBy(DATA, out.ticked, 11), null);
});

test('the includes line names three, then counts the rest; names as typed', () => {
  const full = (names) => ({ ...svc(9, 'F'), includes: names.map((name, i) => ({ id: 100 + i, name })) });
  assert.equal(r.includesLine(full([])), null);
  assert.equal(r.includesLine(full(['Brake service', 'Shimano Di2 setup', 'Gear service'])),
    'Includes Brake service, Shimano Di2 setup, Gear service');
  assert.equal(r.includesLine(full(['A', 'B', 'C', 'D', 'E'])), 'Includes A, B, C and 2 more');
});

test('prices show pence only when there are any', () => {
  assert.equal(r.formatFrom(80), 'From £80');
  assert.equal(r.formatFrom(22.5), 'From £22.50');
  assert.equal(r.formatMoney(0.1 + 0.2), '£0.30');
});

test('the summary counts, and adds the total only when prices are shown', () => {
  assert.equal(r.summary(DATA, []), '');
  assert.equal(r.summary(DATA, [13]), '1 service · from £15');
  assert.equal(r.summary(DATA, [13, 12]), '2 services · from £37.50');
  const hidden = { ...DATA, showPrices: false, full: [], categories: [], uncategorised: [{ ...svc(12, 'Gear service'), price: null }, { ...svc(13, 'Wheel true'), price: null }] };
  assert.equal(r.summary(hidden, [12, 13]), '2 services');
});

test('ids no longer in the list are ignored', () => {
  assert.deepEqual(r.chosenServices(DATA, [999, 13]).map((s) => s.id), [13]);
  assert.equal(r.summary(DATA, [999]), '');
});

test('total minutes sum the ticked services', () => {
  assert.equal(r.totalMinutes(DATA, [1, 13]), 120);
});

test('Continue checks nothing ticked, then more than 10, then more than 12 hours', () => {
  assert.equal(r.continueError(DATA, []), 'Choose at least one service');
  assert.equal(r.continueError(DATA, [13]), null);
  const many = { ...DATA, full: [], categories: [], uncategorised: Array.from({ length: 11 }, (_, i) => svc(200 + i, `S${i}`, 10, 100)) };
  const ids = many.uncategorised.map((s) => s.id);
  assert.equal(r.continueError(many, ids), 'You can book up to 10 services at once');
  assert.equal(r.continueError(many, ids.slice(0, 7)), null);
  assert.equal(r.continueError(many, ids.slice(0, 8)), "That's too much work for one visit - please book the jobs separately");
  assert.equal(r.MAX_SERVICES, 10);
  assert.equal(r.MAX_MINUTES, 720);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/service-selection.test.js`
Expected: FAIL. The import rejects with `ERR_MODULE_NOT_FOUND` for `service-selection.js`.

- [ ] **Step 3: Implement** `src/screens/book/service-selection.ts`

```ts
import type { PortalFullService, PortalService, ServicesResponse } from './services-query.ts';

/**
 * The service list's rules, kept apart from the screens so they can be tested
 * directly and reused later (d4 needs the total minutes). Ticking a full
 * service locks the individual services it includes (Jack, 26 Sep: hint and
 * lock); the server refuses the pair too (piece 8, as changed by d2).
 * Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
 */

export const MAX_SERVICES = 10;
export const MAX_MINUTES = 720;

export type Notice = { id: number; text: string };

/** Every service in the order the list shows them: full, each category, then uncategorised. */
export function listOrder(data: ServicesResponse): PortalService[] {
  return [...data.full, ...data.categories.flatMap((c) => c.services), ...data.uncategorised];
}

/** The ticked services still on the list, in list order. */
export function chosenServices(data: ServicesResponse, ticked: number[]): PortalService[] {
  const set = new Set(ticked);
  return listOrder(data).filter((s) => set.has(s.id));
}

/** The first ticked full service, in list order, that includes `id`; null if none. */
export function lockedBy(data: ServicesResponse, ticked: number[], id: number): PortalFullService | null {
  return data.full.find((f) => ticked.includes(f.id) && f.includes.some((i) => i.id === id)) ?? null;
}

/**
 * Tap a service. A locked one is ignored (the same array comes back). Ticking
 * a full service takes off anything ticked that it includes, with a notice.
 */
export function toggle(data: ServicesResponse, ticked: number[], id: number): { ticked: number[]; notices: Notice[] } {
  if (ticked.includes(id)) return { ticked: ticked.filter((t) => t !== id), notices: [] };
  if (lockedBy(data, ticked, id)) return { ticked, notices: [] };
  const full = data.full.find((f) => f.id === id);
  const takenOff = full ? ticked.filter((t) => full.includes.some((i) => i.id === t)) : [];
  const next = new Set([...ticked.filter((t) => !takenOff.includes(t)), id]);
  const names = new Map(listOrder(data).map((s) => [s.id, s.name]));
  return {
    ticked: listOrder(data).map((s) => s.id).filter((s) => next.has(s)),
    notices: full
      ? takenOff.map((t) => ({ id: t, text: `${names.get(t)} is part of your ${full.name}, so we've taken it off` }))
      : [],
  };
}

/** "Includes A, B, C and N more", names as the shop typed them; null when it includes nothing. */
export function includesLine(full: PortalFullService): string | null {
  const names = full.includes.map((i) => i.name);
  if (names.length === 0) return null;
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `Includes ${shown} and ${names.length - 3} more` : `Includes ${shown}`;
}

/** Pounds, with pence only when there are any: £80, £22.50. Summed in pence to avoid float drift. */
export function formatMoney(amount: number): string {
  const pence = Math.round(amount * 100);
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

export const formatFrom = (price: number) => `From ${formatMoney(price)}`;

/** "2 services · from £95", or "2 services" when prices are hidden; "" when nothing is ticked. */
export function summary(data: ServicesResponse, ticked: number[]): string {
  const chosen = chosenServices(data, ticked);
  if (chosen.length === 0) return '';
  const count = chosen.length === 1 ? '1 service' : `${chosen.length} services`;
  if (!data.showPrices || chosen.some((s) => s.price === null)) return count;
  const pence = chosen.reduce((sum, s) => sum + Math.round((s.price as number) * 100), 0);
  return `${count} · from ${formatMoney(pence / 100)}`;
}

export function totalMinutes(data: ServicesResponse, ticked: number[]): number {
  return chosenServices(data, ticked).reduce((sum, s) => sum + (s.minutes ?? 0), 0);
}

/** Why Continue can't go on yet, checked in this order; null when it can. */
export function continueError(data: ServicesResponse, ticked: number[]): string | null {
  const chosen = chosenServices(data, ticked);
  if (chosen.length === 0) return 'Choose at least one service';
  if (chosen.length > MAX_SERVICES) return `You can book up to ${MAX_SERVICES} services at once`;
  if (totalMinutes(data, ticked) > MAX_MINUTES) return "That's too much work for one visit - please book the jobs separately";
  return null;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run pretest && node --test tests/customer/service-selection.test.js && npm run typecheck`
Expected: all PASS; typecheck clean.

- [ ] **Step 5: Prove a test bites.** In `toggle`, change `const takenOff = full ? ...` to `const takenOff: number[] = [];`. Confirm it in `git diff`, then run. "ticking a full service takes off what it includes" must FAIL. Restore it and re-run to PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/service-selection.ts tests/customer/service-selection.test.js
git commit -m "feat: the service list's selection rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The draft holds several services

**Files:**
- Modify: `src/screens/book/draft.tsx` (the `Answer` and `BookingDraft` types)
- Modify: `src/screens/book/require-draft.tsx` (`hasService`)
- Test: `tests/customer/require-draft.test.js`, `tests/customer/draft.test.js`, `tests/customer/book-layout.test.js`

**Interfaces:**
- Produces:
  - `Answer = { serviceId: number; questionId: string; text?: string; choice?: string; notSure?: true }`
  - `BookingDraft.serviceIds?: number[]` replaces `serviceId`, `serviceName` and `serviceMinutes`, which are removed
  - `hasService(draft)` is true when `(draft.serviceIds?.length ?? 0) > 0 || draft.notSure === true`

- [ ] **Step 1: Write the failing test.** In `tests/customer/require-draft.test.js`:
  - Change the passing case `renderAt({ serviceId: 7 })` to `renderAt({ serviceIds: [7] })`.
  - Add one test after it, which fails today because `hasService` reads `serviceId`:

```js
test('an empty service list counts as no service chosen', async () => {
  const { ui } = await renderAt({ serviceIds: [] });
  assert.ok(await ui.findByText('First screen'));
});
```

(The file's redirect target renders "First screen", as its existing redirect test asserts.)

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/require-draft.test.js`
Expected: the `serviceIds: [7]` case FAILS, because it is redirected, since `hasService` reads `serviceId`. The empty-list case passes by accident; that is expected.

- [ ] **Step 3: Implement.**

In `draft.tsx`, replace the `Answer` line and the first four `BookingDraft` fields:

```ts
// Each answer names its service (server piece 7).
export type Answer = { serviceId: number; questionId: string; text?: string; choice?: string; notSure?: true };

export type BookingDraft = {
  // The ticked services, in list order (d2). Minutes are derived from these
  // and /services when needed, never stored. A draft saved before d2 has no
  // serviceIds and so counts as no service chosen.
  serviceIds?: number[];
  notSure?: boolean;
  answers?: Answer[];
```

The rest of the type is unchanged.

In `require-draft.tsx`:

```ts
export const hasService = (draft: BookingDraft) => (draft.serviceIds?.length ?? 0) > 0 || draft.notSure === true;
```

In `tests/customer/draft.test.js` and `tests/customer/book-layout.test.js`, rename every `serviceId: <n>` value in the draft payloads to `serviceIds: [<n>]`. In `book-layout.test.js`, change the probes' text to `` `serviceIds:${(draft.serviceIds ?? []).join(',')}` `` and the matching `findByText` strings (`'serviceIds:'`, `'serviceIds:7'`, `'date-screen serviceIds:7'`). This is behaviour-neutral: those tests use the field only as sample data.

- [ ] **Step 4: Run and watch them pass**

Run: `npm run pretest && node --test tests/customer/require-draft.test.js tests/customer/draft.test.js tests/customer/book-layout.test.js && npm run typecheck`
Expected: all PASS. Typecheck is clean; nothing in `src/` read the removed fields. If typecheck names a reader, report it; don't paper over it.

- [ ] **Step 5: Prove the new test bites.** Change `hasService` to `(draft.serviceIds !== undefined) || ...`. "an empty service list counts as no service chosen" must FAIL. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/draft.tsx src/screens/book/require-draft.tsx tests/customer/require-draft.test.js tests/customer/draft.test.js tests/customer/book-layout.test.js
git commit -m "feat: the booking draft holds several services

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The frame's loading, error and focus behaviour, and a pinned note

**Files:**
- Modify: `src/screens/book/frame.tsx`
- Test: `tests/customer/frame.test.js`

**Interfaces:**
- Consumes: `useServices(shopSlug)` (React Query result) and `ApiError` from `@/lib/api/client.ts`. It has `.code === 'not_found'` for a 404.
- Produces:
  - `BookFrameProps` gains `actionNote?: React.ReactNode`, rendered in the pinned area above the action button.
  - The pinned container carries `data-book-pinned`, which Task 6's Playwright test uses.
  - While `/services` is pending, the frame renders "Loading…" and neither the screen's children nor its action.
  - On a 404, it renders the `h1` "We can't find this shop".
  - On any other failure, it renders the `h1` "We couldn't load this shop's services" and a "Try again" button.
  - When ready, it renders the title `h1` (`tabIndex={-1}`), which receives focus with `preventScroll`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/customer/frame.test.js`. First change `renderFrame` so the fetch reply can vary: add a third parameter `reply = () => new Response(JSON.stringify(SERVICES), { status: 200, headers: { 'content-type': 'application/json' } })` and set `globalThis.fetch = async () => reply();`.

```js
test('while the shop loads, only "Loading…" shows - no title, body or action', async () => {
  const ui = await renderFrame({ step: 1, title: 'T', action: { label: 'Continue', onClick: () => {} } }, undefined, () => new Promise(() => {}));
  assert.ok(await ui.findByText('Loading…'));
  assert.equal(ui.queryByText('Screen body'), null);
  assert.equal(ui.queryByRole('button', { name: 'Continue' }), null);
});

test('an unknown shop says so, with no shop name', async () => {
  const ui = await renderFrame({ step: 1, title: 'T' }, undefined,
    () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } }));
  assert.ok(await ui.findByRole('heading', { level: 1, name: "We can't find this shop" }));
  assert.equal(ui.queryByText('Screen body'), null);
});

test('a failed load offers Try again, which recovers', async () => {
  const { fireEvent } = await import('@testing-library/react');
  let fail = true;
  const ui = await renderFrame({ step: 1, title: 'Tell us about your bike' }, undefined, () => (fail
    ? new Response(JSON.stringify({ error: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify(SERVICES), { status: 200, headers: { 'content-type': 'application/json' } })));
  assert.ok(await ui.findByRole('heading', { level: 1, name: "We couldn't load this shop's services" }));
  fail = false;
  fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Tell us about your bike' }));
});

test('focus lands on the title once the screen is ready', async () => {
  const ui = await renderFrame({ step: 1, title: 'Tell us about your bike' });
  const h1 = await ui.findByRole('heading', { level: 1, name: 'Tell us about your bike' });
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.ok(document.activeElement === h1, 'focus is not on the h1'));
});

test('the action note sits in the pinned area above the button', async () => {
  const ui = await renderFrame({ step: 1, title: 'T', actionNote: 'Two services', action: { label: 'Continue', onClick: () => {} } });
  await ui.findByText('North Street Cycles');
  const pinned = document.querySelector('[data-book-pinned]');
  assert.ok(pinned, 'no pinned area');
  assert.ok(pinned.contains(ui.getByText('Two services')));
  assert.ok(pinned.contains(ui.getByRole('button', { name: 'Continue' })));
});
```

Also update one existing test. Once the back link only renders when the shop has loaded, `'the back link goes where it is told'` must wait for it: change its `ui.getByRole('link', { name: /Back/ })` to `await ui.findByRole('link', { name: /Back/ })`.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run pretest && node --test tests/customer/frame.test.js`
Expected: the five new tests FAIL. There's no "Loading…", the body renders during the error states, nothing receives focus, and there's no `data-book-pinned`. The six existing tests PASS.

- [ ] **Step 3: Implement** in `frame.tsx`.
  - Import `ApiError` from `@/lib/api/client.ts`.
  - Add `actionNote?: React.ReactNode;` to `BookFrameProps` and destructure it.
  - Update the doc comment: the frame now also shows loading, unknown-shop and failed states (d2), and focuses its h1 on each screen.
  - The body becomes:

```tsx
  const heading = React.useRef<HTMLHeadingElement>(null);
  const ready = services.isSuccess;
  const notFound = services.error instanceof ApiError && services.error.code === 'not_found';

  // Each screen mounts its own frame, so this runs on every screen change:
  // keyboard and screen-reader users land on the new heading (d2). No
  // scroll, so a screen that scrolls itself (the service list's ?start) keeps
  // its position.
  React.useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [services.status, title]);
```

  - Keep the existing scroll-padding effect, but run it only when `action && ready`, because the pinned area only shows then. Its dependency list becomes `[action, ready]`. With a note, the padding is `'9rem'`, otherwise `'7rem'`: add `actionNote` to the condition and dependencies.
  - Replace the `<main>` contents:

```tsx
      <main className={cn('flex-1 py-3', ready && action && (actionNote ? 'pb-36' : 'pb-28'))}>
        {services.isPending && <p role="status">Loading…</p>}
        {services.isError && (
          <>
            <h1 ref={heading} tabIndex={-1} className="m-0 mb-3 text-xl font-semibold">
              {notFound ? "We can't find this shop" : "We couldn't load this shop's services"}
            </h1>
            {!notFound && (
              <Button variant="accent" onClick={() => services.refetch()}>
                Try again
              </Button>
            )}
          </>
        )}
        {ready && (
          <>
            {/* the existing back link and step blocks, unchanged */}
            <h1 ref={heading} tabIndex={-1} className="m-0 mb-3 text-xl font-semibold focus:outline-none">{title}</h1>
            {children}
          </>
        )}
      </main>
      {ready && action && (
        <div data-book-pinned className="fixed inset-x-0 bottom-0 border-t border-[var(--wh-border)] bg-white px-4 py-3">
          <div className="mx-auto max-w-md">
            {actionNote && <div className="mb-2 text-center text-sm">{actionNote}</div>}
            <Button variant="accent" block className="min-h-12" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </Button>
          </div>
        </div>
      )}
```

Move the existing back-link and step JSX, unchanged, into the `ready` block where the comment shows. The header keeps `{services.data?.shopName ?? ''}`.

- [ ] **Step 4: Run and watch them pass**

Run: `npm run pretest && node --test tests/customer/frame.test.js && npm run typecheck && npm run lint`
Expected: all 11 PASS; typecheck and lint clean.

- [ ] **Step 5: Prove the focus test bites.** Delete the `heading.current?.focus(...)` line. "focus lands on the title" must FAIL. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/frame.tsx tests/customer/frame.test.js
git commit -m "feat: book frame shows loading and error states, focuses its heading, and takes a pinned note

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The first screen, `service`

**Files:**
- Create: `tests/helpers/book-screen.js`
- Create: `src/screens/book/service.tsx`
- Modify: `src/customer/app-shell.tsx` (`SCREENS`)
- Modify: `tests/browser/smoke.spec.ts`
- Test: `tests/customer/service-screen.test.js`

**Interfaces:**
- Consumes: `BookFrame` (Task 3), `useDraft` / `BookingDraft` (Task 2), `useServices`, and `ChoiceCard` from `@/components/ui/choice-card`.
- Produces:
  - `export function ServiceScreen()`
  - `tests/helpers/book-screen.js` exporting `renderBookScreen({ file, exportName, at, url, services, draft })`, which returns `{ ui, client, uninstall, scrolled, readDraft }`. Task 5 uses it.

- [ ] **Step 1: Write the helper** `tests/helpers/book-screen.js`

```js
// Renders one book screen in jsdom, the way the customer app mounts it: inside
// /book/:shopSlug with the booking-in-progress provider, a query client, and
// /services answered from `services`. Every other book address renders
// "At <path><search>", so a test can see where a screen navigated to.
// Shop slug is always "north". scrollIntoView (missing in jsdom) is recorded
// in `scrolled`.
import { installDom, importFresh } from './dom.js';

const BUILD = new URL('../../.test-build/', import.meta.url);

export async function renderBookScreen({ file, exportName, at, url, services, draft }) {
  const uninstall = installDom(`http://localhost${url}`);
  if (draft) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(draft));
  const scrolled = [];
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(this); };
  globalThis.fetch = async () =>
    new Response(JSON.stringify(services), { status: 200, headers: { 'content-type': 'application/json' } });

  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Outlet, useLocation, useParams } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const Screen = (await importFresh(new URL(file, BUILD).href))[exportName];
  const { DraftProvider } = await import(new URL('screens/book/draft.js', BUILD).href);

  function Layout() {
    const { shopSlug = '' } = useParams();
    return h(DraftProvider, { shopSlug }, h(Outlet));
  }
  function Where() {
    const l = useLocation();
    return h('p', null, `At ${l.pathname}${l.search}`);
  }
  const child = (path) => (path === '' ? { index: true } : { path });
  const routes = ['', 'services', 'problem'].map((p) => ({ ...child(p), Component: p === at ? Screen : Where }));
  const router = createMemoryRouter([{ path: '/book/:shopSlug', Component: Layout, children: routes }], { initialEntries: [url] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(h(QueryClientProvider, { client }, h(RouterProvider, { router })));
  const readDraft = () => JSON.parse(window.sessionStorage.getItem('wh-book-draft:north') ?? '{}');
  return { ui, client, uninstall, scrolled, readDraft };
}
```

- [ ] **Step 2: Write the failing test** `tests/customer/service-screen.test.js`

```js
// The first book screen: Full services / Individual services / Not sure.
// Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const svc = (id, name) => ({ id, name, price: null, minutes: 30, questions: [] });
const BOTH = {
  shopName: 'North Street Cycles', showPrices: false,
  full: [{ ...svc(1, 'General service'), includes: [] }],
  categories: [{ id: 5, name: 'Brakes', services: [svc(11, 'Brake service')] }],
  uncategorised: [],
};

const open = async (services = BOTH, draft) => {
  current = await renderBookScreen({ file: 'screens/book/service.js', exportName: 'ServiceScreen', at: '', url: '/book/north', services, draft });
  await current.ui.findByRole('heading', { level: 1, name: 'What do you need?' });
  return current;
};

test('Full services opens the list at the full section', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const { ui } = await open();
  fireEvent.click(ui.getByRole('button', { name: /^Full services/ }));
  assert.ok(await ui.findByText('At /book/north/services?start=full'));
});

test('Individual services opens the list at the individual sections', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const { ui } = await open();
  fireEvent.click(ui.getByRole('button', { name: /^Individual services/ }));
  assert.ok(await ui.findByText('At /book/north/services?start=individual'));
});

test('Not sure clears any ticks and answers and goes to the problem screen', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const { ui, readDraft } = await open(BOTH, { serviceIds: [11], answers: [{ serviceId: 11, questionId: 'q', text: 'x' }] });
  fireEvent.click(ui.getByRole('button', { name: /^Not sure/ }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  assert.deepEqual(readDraft(), { serviceIds: [], answers: [], notSure: true });
});

test('opening a list clears Not sure but keeps ticked services', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const { ui, readDraft } = await open(BOTH, { notSure: true, serviceIds: [11] });
  fireEvent.click(ui.getByRole('button', { name: /^Full services/ }));
  await ui.findByText('At /book/north/services?start=full');
  assert.deepEqual(readDraft(), { serviceIds: [11] });
});

test('a kind the shop does not offer hides its card', async () => {
  let { ui } = await open({ ...BOTH, full: [] });
  assert.equal(ui.queryByRole('button', { name: /^Full services/ }), null);
  assert.ok(ui.getByRole('button', { name: /^Individual services/ }));
  current.client.clear(); current.uninstall();
  ({ ui } = await open({ ...BOTH, categories: [], uncategorised: [svc(12, 'Gear service')] }));
  assert.ok(ui.getByRole('button', { name: /^Individual services/ }), 'uncategorised counts as individual');
});

test('a shop with nothing bookable says so and offers no options', async () => {
  const { ui } = await open({ ...BOTH, full: [], categories: [] });
  assert.ok(ui.getByText("This shop isn't taking bookings online at the moment - please contact them directly"));
  assert.equal(ui.queryAllByRole('button').length, 0);
});

test('the cards carry their detail lines', async () => {
  const { ui } = await open();
  for (const t of ['Whole-bike services', 'Single jobs, like brakes or gears', "Tell us what's wrong and we'll advise"]) {
    assert.ok(ui.getByText(t), t);
  }
});
```

The "hides its card" test renders twice. The second `open` overwrites `current`, and `afterEach` cleans up the last one.

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/service-screen.test.js`
Expected: FAIL. `screens/book/service.js` isn't found.

- [ ] **Step 4: Implement** `src/screens/book/service.tsx`

```tsx
import { useNavigate, useParams } from 'react-router';
import { ChoiceCard } from '@/components/ui/choice-card';
import { BookFrame } from './frame.tsx';
import { useDraft } from './draft.tsx';
import { useServices } from './services-query.ts';

/**
 * The first book screen (atlas `service`): three fixed options (Jack, 24 Sep),
 * each going straight on when tapped (26 Sep). Full and Individual open the
 * one shared list at their section; Not sure skips to describing the problem.
 * A kind the shop has no services of is hidden.
 * Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
 */
export function ServiceScreen() {
  const { shopSlug = '' } = useParams();
  const navigate = useNavigate();
  const { data } = useServices(shopSlug);
  const { update } = useDraft();
  const base = `/book/${shopSlug}`;
  const hasFull = (data?.full.length ?? 0) > 0;
  const hasIndividual = (data?.categories.length ?? 0) > 0 || (data?.uncategorised.length ?? 0) > 0;

  const openList = (start: 'full' | 'individual') => {
    update({ notSure: undefined });
    navigate(`${base}/services?start=${start}`);
  };
  const notSure = () => {
    update({ notSure: true, serviceIds: [], answers: [] });
    navigate(`${base}/problem`);
  };

  return (
    <BookFrame step={1} title="What do you need?">
      {!hasFull && !hasIndividual ? (
        <p>This shop isn't taking bookings online at the moment - please contact them directly</p>
      ) : (
        <div className="flex flex-col gap-2">
          {hasFull && <ChoiceCard title="Full services" detail="Whole-bike services" onClick={() => openList('full')} />}
          {hasIndividual && (
            <ChoiceCard title="Individual services" detail="Single jobs, like brakes or gears" onClick={() => openList('individual')} />
          )}
          <ChoiceCard title="Not sure" detail="Tell us what's wrong and we'll advise" onClick={notSure} />
        </div>
      )}
    </BookFrame>
  );
}
```

In `src/customer/app-shell.tsx`, import `ServiceScreen` from `@/screens/book/service.tsx` and set `const SCREENS: Partial<Record<CustomerScreenId, ComponentType>> = { service: ServiceScreen };`.

In `tests/browser/smoke.spec.ts`, the customer test's expectation changes. `/book/any-shop` is now a real screen for a shop that doesn't exist:

```ts
  await expect(page.locator('#wh-book-root')).toContainText("We can't find this shop");
```

- [ ] **Step 5: Run and watch it pass**

Run: `npm run pretest && node --test tests/customer/service-screen.test.js tests/customer/book-layout.test.js && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 6: Prove a test bites.** Remove `serviceIds: [], answers: []` from `notSure`'s `update`. "Not sure clears any ticks and answers" must FAIL. Restore it.

- [ ] **Step 7: Commit**

```bash
git add tests/helpers/book-screen.js src/screens/book/service.tsx src/customer/app-shell.tsx tests/customer/service-screen.test.js tests/browser/smoke.spec.ts
git commit -m "feat: the first book screen - full, individual or not sure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The list screen, `service-list`

**Files:**
- Create: `src/screens/book/service-list.tsx`
- Modify: `src/customer/app-shell.tsx` (`SCREENS`)
- Test: `tests/customer/service-list-screen.test.js`

**Interfaces:**
- Consumes: everything in Task 1, `BookFrame`'s `actionNote` (Task 3), `renderBookScreen` (Task 4), and `ChoiceCard`.
- Produces: `export function ServiceListScreen()`.

- [ ] **Step 1: Write the failing test** `tests/customer/service-list-screen.test.js`

```js
// The service list: sections, prices, hint-and-lock, the running summary and
// Continue.
// Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const svc = (id, name, price = 20, minutes = 30) => ({ id, name, price, minutes, questions: [] });
const DATA = {
  shopName: 'North Street Cycles', showPrices: true,
  full: [{ ...svc(1, 'General service', 80, 90), includes: [{ id: 11, name: 'Brake service' }, { id: 12, name: 'Gear service' }] }],
  categories: [
    { id: 5, name: 'Brakes', services: [svc(11, 'Brake service', 25)] },
    { id: 6, name: 'Wheels', services: [svc(13, 'Wheel true', 15)] },
  ],
  uncategorised: [svc(12, 'Gear service', 22.5)],
};

const open = async ({ services = DATA, draft, search = '' } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/service-list.js', exportName: 'ServiceListScreen', at: 'services',
    url: `/book/north/services${search}`, services, draft,
  });
  await current.ui.findByRole('heading', { level: 1, name: 'Choose your services' });
  return current;
};
const card = (ui, name) => ui.getByRole('button', { name: new RegExp(`^${name}`) });
const click = async (el) => (await import('@testing-library/react')).fireEvent.click(el);

test('sections in order: full, each category, then Other; empty ones hidden', async () => {
  let { ui } = await open();
  assert.deepEqual(ui.getAllByRole('heading', { level: 2 }).map((h) => h.textContent), ['Full services', 'Brakes', 'Wheels', 'Other']);
  current.client.clear(); current.uninstall();
  ({ ui } = await open({ services: { ...DATA, full: [], uncategorised: [] } }));
  assert.deepEqual(ui.getAllByRole('heading', { level: 2 }).map((h) => h.textContent), ['Brakes', 'Wheels']);
});

test('?start scrolls to its section; no start does not scroll', async () => {
  let s = await open({ search: '?start=individual' });
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.equal(s.scrolled.length, 1));
  assert.ok(s.scrolled[0] === s.ui.getByRole('heading', { level: 2, name: 'Brakes' }));
  current.client.clear(); current.uninstall();
  s = await open({ search: '?start=full' });
  await waitFor(() => assert.equal(s.scrolled.length, 1));
  assert.ok(s.scrolled[0] === s.ui.getByRole('heading', { level: 2, name: 'Full services' }));
  current.client.clear(); current.uninstall();
  s = await open();
  assert.equal(s.scrolled.length, 0);
});

test('prices read "From", with the parts note, and the includes line on the full service', async () => {
  const { ui } = await open();
  assert.ok(ui.getByText('Prices are for labour. Parts are quoted separately.'));
  assert.ok(ui.getByText('From £80'));
  assert.ok(ui.getByText('From £22.50'));
  assert.ok(ui.getByText('Includes Brake service, Gear service'));
});

test('ticking a full service locks what it includes and updates the summary', async () => {
  const { ui, readDraft } = await open();
  await click(card(ui, 'General service'));
  assert.equal(card(ui, 'General service').getAttribute('aria-pressed'), 'true');
  const brake = card(ui, 'Brake service');
  assert.equal(brake.getAttribute('aria-disabled'), 'true');
  assert.ok(brake.textContent.includes('Included in your General service'));
  assert.equal(card(ui, 'Wheel true').getAttribute('aria-disabled'), null);
  assert.ok(ui.getByText('1 service · from £80'));
  assert.deepEqual(readDraft().serviceIds, [1]);
});

test('a locked service ignores taps', async () => {
  const { ui, readDraft } = await open();
  await click(card(ui, 'General service'));
  await click(card(ui, 'Brake service'));
  assert.equal(card(ui, 'Brake service').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(readDraft().serviceIds, [1]);
});

test('ticking a full service takes off what it includes, and says so', async () => {
  const { ui, readDraft } = await open();
  await click(card(ui, 'Brake service'));
  await click(card(ui, 'General service'));
  assert.ok(ui.getByText("Brake service is part of your General service, so we've taken it off"));
  assert.deepEqual(readDraft().serviceIds, [1]);
  await click(card(ui, 'Wheel true'));
  assert.equal(ui.queryByText(/so we've taken it off/), null, 'the notice outlived the next tap');
});

test('unticking the full service unlocks without re-ticking', async () => {
  const { ui } = await open({ draft: { serviceIds: [1] } });
  await click(card(ui, 'General service'));
  assert.equal(card(ui, 'Brake service').getAttribute('aria-disabled'), null);
  assert.equal(card(ui, 'Brake service').getAttribute('aria-pressed'), 'false');
});

test('Continue with nothing ticked says so and stays', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert').textContent.includes('Choose at least one service'));
  assert.equal(ui.queryByText(/^At /), null);
});

test('Continue refuses more than 10 services and more than 12 hours', async () => {
  const many = Array.from({ length: 11 }, (_, i) => svc(100 + i, `Job ${i}`, 10, 10));
  let { ui } = await open({ services: { ...DATA, full: [], categories: [], uncategorised: many }, draft: { serviceIds: many.map((s) => s.id) } });
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert').textContent.includes('You can book up to 10 services at once'));
  current.client.clear(); current.uninstall();
  const long = [svc(200, 'Rebuild', 300, 400), svc(201, 'Respray', 300, 400)];
  ({ ui } = await open({ services: { ...DATA, full: [], categories: [], uncategorised: long }, draft: { serviceIds: [200, 201] } }));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert').textContent.includes("That's too much work for one visit - please book the jobs separately"));
});

test('a good Continue saves the services in list order, drops orphaned answers and moves on', async () => {
  const answers = [{ serviceId: 13, questionId: 'q1', text: 'Front' }, { serviceId: 12, questionId: 'q2', text: 'x' }];
  const { ui, readDraft } = await open({ draft: { answers } });
  await click(card(ui, 'Wheel true'));
  await click(card(ui, 'General service'));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  const saved = readDraft();
  assert.deepEqual(saved.serviceIds, [1, 13]);
  assert.deepEqual(saved.answers, [answers[0]]);
});

test('ticks survive a reload of the tab', async () => {
  const { ui } = await open({ draft: { serviceIds: [13] } });
  assert.equal(card(ui, 'Wheel true').getAttribute('aria-pressed'), 'true');
  assert.ok(ui.getByText('1 service · from £15'));
});

test('with prices hidden: no "From", no parts note, and a count-only summary', async () => {
  const hide = (s) => ({ ...s, price: null });
  const services = {
    ...DATA, showPrices: false,
    full: DATA.full.map(hide), categories: DATA.categories.map((c) => ({ ...c, services: c.services.map(hide) })), uncategorised: DATA.uncategorised.map(hide),
  };
  const { ui } = await open({ services, draft: { serviceIds: [13, 12] } });
  assert.equal(ui.queryByText(/From £/), null);
  assert.equal(ui.queryByText('Prices are for labour. Parts are quoted separately.'), null);
  assert.ok(ui.getByText('2 services'));
});

test('the Not sure link clears ticks and answers and goes to the problem screen', async () => {
  const { ui, readDraft } = await open({ draft: { serviceIds: [13], answers: [{ serviceId: 13, questionId: 'q', text: 'x' }] } });
  await click(ui.getByRole('button', { name: 'Not sure what you need? Describe the problem' }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  assert.deepEqual(readDraft(), { serviceIds: [], answers: [], notSure: true });
});

test('the back link returns to the first screen', async () => {
  const { ui } = await open();
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north'));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/service-list-screen.test.js`
Expected: FAIL. `screens/book/service-list.js` isn't found.

- [ ] **Step 3: Implement** `src/screens/book/service-list.tsx`

```tsx
import * as React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ChoiceCard } from '@/components/ui/choice-card';
import { cn } from '@/lib/utils';
import { BookFrame } from './frame.tsx';
import { useDraft } from './draft.tsx';
import { useServices, type PortalService, type PortalFullService } from './services-query.ts';
import {
  chosenServices, continueError, formatFrom, includesLine, lockedBy, summary, toggle, type Notice,
} from './service-selection.ts';

/**
 * The service list (atlas `service-list`): full services, each category, then
 * "Other", ticked with a Continue button (Jack, 26 Sep). A ticked full service
 * greys out and locks what it includes (hint and lock). Prices read "From £X"
 * under a parts note when the shop shows prices. ?start=full|individual
 * scrolls to that section on arrival.
 * Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
 */
type Section = { key: string; heading: string; services: (PortalService | PortalFullService)[]; individual: boolean };

export function ServiceListScreen() {
  const { shopSlug = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data } = useServices(shopSlug);
  const { draft, update } = useDraft();
  const ticked = draft.serviceIds ?? [];
  const [notices, setNotices] = React.useState<Notice[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const fullHeading = React.useRef<HTMLHeadingElement>(null);
  const individualHeading = React.useRef<HTMLHeadingElement>(null);
  const start = params.get('start');
  const loaded = data !== undefined;

  React.useEffect(() => {
    if (!loaded) return;
    const target = start === 'full' ? fullHeading.current : start === 'individual' ? individualHeading.current : null;
    target?.scrollIntoView({ block: 'start' });
  }, [loaded, start]);

  if (!data) return <BookFrame step={1} title="Choose your services" back={`/book/${shopSlug}`}>{null}</BookFrame>;

  const sections: Section[] = [
    { key: 'full', heading: 'Full services', services: data.full, individual: false },
    ...data.categories.map((c) => ({ key: `c${c.id}`, heading: c.name, services: c.services, individual: true })),
    { key: 'other', heading: 'Other', services: data.uncategorised, individual: true },
  ].filter((s) => s.services.length > 0);
  const firstIndividual = sections.find((s) => s.individual)?.key;

  const tap = (id: number) => {
    const out = toggle(data, ticked, id);
    if (out.ticked === ticked) return;
    setNotices(out.notices);
    setError(null);
    update({ serviceIds: out.ticked, notSure: undefined });
  };
  const onContinue = () => {
    const problem = continueError(data, ticked);
    if (problem) {
      setError(problem);
      return;
    }
    const ids = chosenServices(data, ticked).map((s) => s.id);
    update({ serviceIds: ids, answers: (draft.answers ?? []).filter((a) => ids.includes(a.serviceId)) });
    navigate(`/book/${shopSlug}/problem`);
  };
  const notSure = () => {
    update({ notSure: true, serviceIds: [], answers: [] });
    navigate(`/book/${shopSlug}/problem`);
  };

  const line = summary(data, ticked);
  return (
    <BookFrame
      step={1}
      title="Choose your services"
      back={`/book/${shopSlug}`}
      action={{ label: 'Continue', onClick: onContinue }}
      actionNote={
        <>
          <p className="m-0" aria-live="polite">{line}</p>
          {error && <p role="alert" className="m-0 mt-1 text-[var(--wh-danger,#b42318)]">{error}</p>}
        </>
      }
    >
      {data.showPrices && <p className="m-0 mb-3 text-sm text-[var(--wh-muted)]">Prices are for labour. Parts are quoted separately.</p>}
      {sections.map((section) => (
        <section key={section.key} className="mb-4">
          <h2
            ref={section.key === 'full' ? fullHeading : section.key === firstIndividual ? individualHeading : undefined}
            className="m-0 mb-2 scroll-mt-4 text-base font-semibold"
          >
            {section.heading}
          </h2>
          <div className="flex flex-col gap-2">
            {section.services.map((s) => {
              const lock = lockedBy(data, ticked, s.id);
              const notice = notices.find((n) => n.id === s.id);
              const includes = 'includes' in s ? includesLine(s) : null;
              // A "taken off" notice shows on its row until the next tap, even
              // though that row is now locked; after that the lock text shows.
              const detail = notice ? notice.text : lock ? `Included in your ${lock.name}` : includes;
              return (
                <ChoiceCard
                  key={s.id}
                  title={s.name}
                  detail={detail ?? undefined}
                  price={s.price === null ? undefined : formatFrom(s.price)}
                  selected={ticked.includes(s.id)}
                  aria-disabled={lock ? true : undefined}
                  className={cn(lock && 'cursor-not-allowed bg-[var(--wh-surface,#f5f5f4)] opacity-60')}
                  onClick={() => tap(s.id)}
                />
              );
            })}
          </div>
        </section>
      ))}
      <button type="button" className="min-h-11 text-sm text-[var(--accent-dark)] underline" onClick={notSure}>
        Not sure what you need? Describe the problem
      </button>
    </BookFrame>
  );
}
```

Notes for the implementer:
- A full service's includes line shows even when it is not ticked (spec: "each one says 'Includes …'"). A row's detail shows, in order of precedence: its "taken off" notice (until the next tap), then the lock text, then the includes line.
- Check that `--wh-danger` and `--wh-surface` exist in the customer CSS (`grep -rn "\-\-wh-" src/customer src/styles* public/*.css`). Use whichever error-red and pale-surface variables exist. If none exists, keep the fallback in the `var()` and say so in the report. Don't add CSS files.
- `toggle` returns the same array for a locked tap, so `tap` returns early and nothing re-renders.

In `src/customer/app-shell.tsx`, add `import { ServiceListScreen } from '@/screens/book/service-list.tsx';` and `'service-list': ServiceListScreen` to `SCREENS`.

- [ ] **Step 4: Run and watch it pass**

Run: `npm run pretest && node --test tests/customer/service-list-screen.test.js tests/customer/service-screen.test.js tests/customer/frame.test.js && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 5: Prove two tests bite.** Each time, confirm the mutation in `git diff`, run, and then restore.
  1. Remove `aria-disabled={lock ? true : undefined}`. "ticking a full service locks what it includes" must FAIL.
  2. In `onContinue`, drop the `.filter(...)` on answers (save `draft.answers ?? []`). "a good Continue … drops orphaned answers" must FAIL.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/service-list.tsx src/customer/app-shell.tsx tests/customer/service-list-screen.test.js
git commit -m "feat: the service list - tick several, hint and lock what a full service includes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The 320px pinned-area check, and the whole suite

**Files:**
- Create: `tests/browser/book-service-list.spec.ts`
- Modify: `.agents/STATUS.md`

**Interfaces:**
- Consumes: `data-book-pinned` (Task 3), and the served app at `/book/:shopSlug/services` (Task 5).

- [ ] **Step 1: Write the check** `tests/browser/book-service-list.spec.ts`

```ts
import { test, expect } from '@playwright/test';

// d1 deferred this check to the first long book screen (d2): on a 320px-wide
// phone, the pinned summary and Continue must not cover the last service.
// /services is answered here so the test needs no seeded shop.
// Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
test('at 320px the last service is fully above the pinned Continue', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const services = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Service ${i + 1}`, price: 20, minutes: 30, questions: [] }));
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({ json: { shopName: 'Test shop', showPrices: true, full: [], categories: [], uncategorised: services } }));
  await page.goto('/book/any-shop/services');
  await page.getByRole('button', { name: /^Service 1\b/ }).click();
  await expect(page.getByText('1 service · from £20')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = await page.getByRole('button', { name: /^Service 12\b/ }).boundingBox();
  const pinned = await page.locator('[data-book-pinned]').boundingBox();
  expect(last).not.toBeNull();
  expect(pinned).not.toBeNull();
  expect(last!.y + last!.height).toBeLessThanOrEqual(pinned!.y);
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:browser`
Expected: all PASS, including the updated smoke test from Task 4.

- [ ] **Step 3: Prove it bites.** In `frame.tsx`, change `actionNote ? 'pb-36' : 'pb-28'` to `actionNote ? 'pb-3' : 'pb-28'`. Run `npm run test:browser` and confirm the new test FAILS, because the last card sits under the pinned area. If it still passes, the "Not sure" link after the list is absorbing the overlap. In that case, also measure the Not sure link as the last element and report which one you used. Restore the change and re-run to PASS.

- [ ] **Step 4: Run everything CI runs**

Run: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run registry:validate`, `node scripts/ci/check-registry-drift.mjs`, `node scripts/ci/assert-screen-trace.mjs` and `node scripts/ci/assert-rls-coverage.mjs`.
Expected: all exit 0. Report the test counts.

- [ ] **Step 5: STATUS.** In `.agents/STATUS.md`, replace "d2 is being brainstormed." with a short d2 entry covering:
  - the branch and its PR
  - the spec and plan paths
  - what's built (the `service` and `service-list` screens, `serviceIds[]` in the draft, `Answer.serviceId`, and the frame's loading/unknown/failed/focus behaviour plus `actionNote`)
  - the carried-over items it closed: blank header, focus, and the 320px pinned check
  - for d3: `service-selection.ts` has `chosenServices`/`totalMinutes`, and answers need `serviceId`
  - that the on-screen keyboard check moves to d3

  In the "Deferred for d2" paragraph, remove the items d2 settled.

- [ ] **Step 6: Commit**

```bash
git add tests/browser/book-service-list.spec.ts .agents/STATUS.md
git commit -m "test: pinned Continue never covers the last service at 320px; STATUS - d2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
