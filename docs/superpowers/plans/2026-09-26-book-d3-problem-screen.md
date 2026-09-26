# Book (d3): the problem screen - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second customer booking screen, `problem` (`/book/:shopSlug/problem`). It has a bike box, each ticked service's questions (quick-answer pills plus a words box), a description, and photos. Continue checks the answers and goes to `/book/:shopSlug/date`.

**Architecture:**
- The rules are pure functions in `src/screens/book/problem-rules.ts`: which questions show, how a tap or words change an answer, what Continue checks, and when to say photos were cleared.
- The screen, `src/screens/book/problem.tsx`, only calls those rules. It renders in d2's `BookFrame`, is guarded by `RequireDraft` with `hasService`, and reads and writes the booking through `useDraft()`.
- The draft gains `bikeNote` and `hadPhotos` and loses `bike`.
- `hasProblem(draft, services)` is added to `require-draft.tsx` and tested here. d4 applies it.
- d3 is client-only. It never POSTs (d5 sends the booking), so the tests answer `/services` only.

**Tech Stack:**
- React 19, TypeScript, react-router 7, @tanstack/react-query
- Registry controls already installed in `src/components/ui/`: `Input`, `Textarea`, `PillGroup`, `PhotoPicker`, and `Field` / `FieldError` / `Label`
- Tailwind classes using only existing `--wh-*` / `--accent*` variables
- Tests: `node:test` + jsdom + @testing-library/react against `.test-build/` (built by `npm run pretest`), and Playwright (`npm run test:browser`)

**Spec:** `docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md`. It relies on server piece 9 (PR #81; spec `docs/superpowers/specs/2026-09-26-book-server-9-bike-note-design.md` on branch `feat/book-server-9-bike-note`). Piece 9 is the authority for the booking POST. d3 doesn't call the POST.

## Global Constraints

- Branch `feat/book-d3-problem-screen`, at `d0e1290` (origin/main with #80 merged in). Never commit to `main`.
- **Server piece 9 (PR #81) must merge before the d3 PR is merged** (spec: "which must merge first"). The tasks don't depend on it at runtime, since d3 sends nothing. Task 6 checks the PR's state and reports it.
- Customer component tests run against the build. After changing anything in `src/`, run `npm run pretest` before `node --test tests/customer/<file>.test.js`. `npm test` does both.
- Postgres (compose, port 5433) must be running for `npm test` and Playwright.
- Create no files in the repo other than those this plan names. Don't commit `.claude/launch.json` (untracked; always `git add` named paths). No scratch or debug files in the repo; use `/tmp`.
- Every new test is watched failing for the right reason before the code that passes it. Each task has a mutation step that proves a test bites. Show the mutation in `git diff` before running, run, confirm the named test fails, restore it, and re-run to PASS.
- jsdom tests:
  - Compare DOM nodes with `assert.ok(a === b)`, never `assert.equal`.
  - Clear the React Query client in `afterEach`.
  - A test that renders twice must call `ui.unmount()` before `client.clear()` and `uninstall()`.
  - Every test file must exit within seconds. Never leave a fetch pending; the helper answers every fetch at once. Time each new file: `time node --test <file>` should report under 10 s.
  - BookFrame calls `window.scrollTo`, which jsdom lacks. `tests/helpers/book-screen.js` already stubs it.
- Never hand-edit `src/components/ui/`. No control changes are needed. The controls' real props:
  - `Input` / `Textarea` take any `<input>` / `<textarea>` props.
  - `PillGroup` takes `{ legend, options: {value, label}[], value: string | null, onChange(value: string), name? }` (single choice; radios, so a pick can be changed but not cleared).
  - `PhotoPicker` takes `{ value: File[], onChange(files), max?, maxBytes?, label? }`.
  - `Field` is a `div`, `FieldError` a `p` and `Label` a `label`, each taking their element's props.
- Colours: only existing variables from `src/styles/theme.css`: `--wh-danger`, `--wh-muted`, `--wh-warn-bg`, `--wh-warn-ink` (and `--accent-dark` via the frame). Lint bans hex fallbacks inside `var()`.
- Copy is verbatim from the spec:
  - "Tell us about your bike" (h1), "Continue" (action), step 2
  - "Your bike (optional)", placeholder "Blue Trek road bike"
  - A question's wording as the shop typed it, plus " (optional)" when the shop didn't mark it required
  - "I'm not sure" (pill, when the shop allows it)
  - "Or tell us in your own words"
  - "What's wrong with it?" ("Not sure")
  - "Anything else we should know? (optional)" (services ticked)
  - "Add photos (optional)"
  - "You can also show us at drop-off."
  - "Your photos were cleared - please add them again"
  - "Please answer: <wording>" (the server's wording)
  - "Tell us what's wrong"
  - "Please check the answers marked above"
- Limits:
  - bike box at most **200** characters
  - each question's words box at most **1,000** characters
  - the description has no limit
  - at most **5** photos, **10 MB** each, JPEG, PNG or WebP (`PhotoPicker` already refuses other types)
- Navigation:
  - Continue goes to `/book/:shopSlug/date`, which is still a placeholder.
  - Back goes to `/book/:shopSlug/services` when services are ticked, and to `/book/:shopSlug` for "Not sure".
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No dependency, CI or server changes. Don't edit the atlas mock-up (`docs/design/release-1-journey/screens.js`). The spec's "Changes" list records where it departs from the mock-up; d2 treated its list the same way.

## Files

- Create `src/screens/book/problem-rules.ts`: the rules.
- Create `tests/customer/problem-rules.test.js`.
- Modify `src/screens/book/draft.tsx`: `BookingDraft` types and doc comment only.
- Modify `tests/customer/draft.test.js`: the new shape round-trips.
- Modify `src/screens/book/require-draft.tsx`: `hasProblem`.
- Modify `tests/customer/require-draft.test.js`: `hasProblem`.
- Modify `tests/helpers/book-screen.js`: add a `date` route and record requests.
- Create `src/screens/book/problem.tsx` and `tests/customer/problem-screen.test.js`.
- Modify `src/customer/app-shell.tsx`: `SCREENS`.
- Create `tests/browser/book-problem.spec.ts`: the on-screen keyboard check.
- Modify `.agents/STATUS.md`.
- Modify this plan: the decision log and the spec walk at the end.

---

### Task 1: The draft's new shape and the problem rules

**Files:**
- Create: `src/screens/book/problem-rules.ts`
- Modify: `src/screens/book/draft.tsx` (`BookingDraft`, doc comment)
- Test: `tests/customer/problem-rules.test.js`, `tests/customer/draft.test.js`

**Interfaces:**
- Consumes:
  - `ServicesResponse`, `PortalService`, `PortalQuestion` from `./services-query.ts`
  - `chosenServices(data, ticked): PortalService[]` from `./service-selection.ts`
  - `Answer`, `BookingDraft` from `./draft.tsx`. `Answer` is unchanged: `{ serviceId: number; questionId: string; text?: string; choice?: string; notSure?: true }`.
- Produces:
  - `BookingDraft.bikeNote?: string` and `BookingDraft.hadPhotos?: boolean`. `bike` is removed.
  - From `problem-rules.ts` (all exported):
    - `BIKE_NOTE_MAX = 200`, `ANSWER_TEXT_MAX = 1000`, `MAX_PHOTOS = 5`, `MAX_PHOTO_BYTES = 10 * 1024 * 1024`
    - `type ChoiceQuestion = Extract<PortalQuestion, { kind: 'choice' }>`
    - `type QuestionGroup = { service: PortalService; questions: PortalQuestion[] }`
    - `type Missing = { serviceId: number; questionId: string; message: string }`
    - `type AnswerChange = { choice: string } | { notSure: true } | { text: string }`
    - `questionGroups(data, draft): QuestionGroup[]`
    - `questionLabel(q: PortalQuestion): string`
    - `pillOptions(q: ChoiceQuestion): { value: string; label: string }[]`
    - `pillValue(answer: Answer | undefined): string | null`
    - `pillChange(value: string): AnswerChange`
    - `findAnswer(answers: Answer[] | undefined, serviceId: number, questionId: string): Answer | undefined`
    - `setAnswer(answers: Answer[] | undefined, serviceId: number, questionId: string, change: AnswerChange): Answer[]`
    - `missingAnswers(data, draft): Missing[]`
    - `descriptionError(draft): string | null`
    - `photosCleared(draft, photoCount: number): boolean`

- [ ] **Step 1: Write the failing rules test** `tests/customer/problem-rules.test.js`

```js
// The problem screen's rules: which questions show, how a tap or words change
// an answer, what Continue checks, and when to say photos were cleared.
// Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const RULES = new URL('../../.test-build/screens/book/problem-rules.js', import.meta.url).href;
const r = await import(RULES);

const choiceQ = (id, wording, choices, { required = true, allowNotSure = true } = {}) =>
  ({ id, wording, kind: 'choice', required, choices, allowNotSure });
const textQ = (id, wording, required = true) => ({ id, wording, kind: 'text', required });
const svc = (id, name, questions = []) => ({ id, name, price: 20, minutes: 30, questions });

// Test data in the style the spec asks shops to use (decision 5): one overall
// question per service with short common answers.
const BRAKES = choiceQ('b1', "What's wrong with the brakes?", ['Squeaking', 'Not stopping well']);
const WHICH = textQ('w1', 'Which wheel needs truing?');
const TUBELESS = choiceQ('w2', 'Tubeless?', ['Yes', 'No'], { required: false, allowNotSure: false });
const DATA = {
  shopName: 'North Street Cycles', showPrices: true,
  full: [{ ...svc(1, 'General service', [textQ('g1', 'When was its last service?', false)]), includes: [] }],
  categories: [
    { id: 5, name: 'Brakes', services: [svc(11, 'Brake service', [BRAKES])] },
    { id: 6, name: 'Wheels', services: [svc(13, 'Wheel true', [WHICH, TUBELESS])] },
  ],
  uncategorised: [svc(12, 'Gear service')],
};
const A = (extra) => ({ serviceId: 11, questionId: 'b1', ...extra });

test('question groups follow the list order and skip services with no questions', () => {
  const groups = r.questionGroups(DATA, { serviceIds: [12, 13, 11, 1] });
  assert.deepEqual(groups.map((g) => g.service.name), ['General service', 'Brake service', 'Wheel true']);
  assert.deepEqual(groups[2].questions.map((q) => q.id), ['w1', 'w2']);
});

test('ids no longer on the list, no services, and Not sure give no questions', () => {
  assert.deepEqual(r.questionGroups(DATA, { serviceIds: [999] }), []);
  assert.deepEqual(r.questionGroups(DATA, {}), []);
  assert.deepEqual(r.questionGroups(DATA, { notSure: true, serviceIds: [11] }), []);
});

test("an optional question says so; a required one is the shop's wording as typed", () => {
  assert.equal(r.questionLabel(BRAKES), "What's wrong with the brakes?");
  assert.equal(r.questionLabel(TUBELESS), 'Tubeless? (optional)');
  assert.equal(r.questionLabel(WHICH), 'Which wheel needs truing?');
});

test('pills are the shop\'s choices, then "I\'m not sure" when the shop allows it', () => {
  assert.deepEqual(r.pillOptions(BRAKES).map((o) => o.label), ['Squeaking', 'Not stopping well', "I'm not sure"]);
  assert.deepEqual(r.pillOptions(TUBELESS).map((o) => o.label), ['Yes', 'No']);
  const shopNotSure = choiceQ('x', 'X?', ["I'm not sure"]);
  const values = r.pillOptions(shopNotSure).map((o) => o.value);
  assert.equal(new Set(values).size, 2, 'a shop choice worded like the pill must not share its value');
});

test('a pill maps to a choice or to notSure, and an answer maps back to its pill', () => {
  const [squeak, , notSure] = r.pillOptions(BRAKES);
  assert.deepEqual(r.pillChange(squeak.value), { choice: 'Squeaking' });
  assert.deepEqual(r.pillChange(notSure.value), { notSure: true });
  assert.equal(r.pillValue(undefined), null);
  assert.equal(r.pillValue(A({ text: 'Grinding' })), null);
  assert.equal(r.pillValue(A({ choice: 'Squeaking' })), squeak.value);
  assert.equal(r.pillValue(A({ notSure: true })), notSure.value);
});

test('findAnswer matches on both the service and the question', () => {
  const answers = [{ serviceId: 13, questionId: 'b1', text: 'x' }, A({ choice: 'Squeaking' })];
  assert.ok(r.findAnswer(answers, 11, 'b1') === answers[1]);
  assert.equal(r.findAnswer(answers, 11, 'w1'), undefined);
  assert.equal(r.findAnswer(undefined, 11, 'b1'), undefined);
});

test('a tap, words, or both make one answer', () => {
  const tapped = r.setAnswer(undefined, 11, 'b1', { choice: 'Squeaking' });
  assert.deepEqual(tapped, [A({ choice: 'Squeaking' })]);
  assert.deepEqual(r.setAnswer(tapped, 11, 'b1', { text: 'Only when wet' }), [A({ choice: 'Squeaking', text: 'Only when wet' })]);
  assert.deepEqual(r.setAnswer([], 11, 'b1', { text: 'Grinding' }), [A({ text: 'Grinding' })]);
});

test('a tapped pill can be changed; "I\'m not sure" takes the place of the choice', () => {
  let a = r.setAnswer([A({ choice: 'Squeaking', text: 'x' })], 11, 'b1', { notSure: true });
  assert.deepEqual(a, [A({ notSure: true, text: 'x' })]);
  a = r.setAnswer(a, 11, 'b1', { choice: 'Not stopping well' });
  assert.deepEqual(a, [A({ choice: 'Not stopping well', text: 'x' })]);
});

test('clearing the words keeps a tapped pill, and removes an answer left with nothing', () => {
  assert.deepEqual(r.setAnswer([A({ choice: 'Squeaking', text: 'x' })], 11, 'b1', { text: '' }), [A({ choice: 'Squeaking' })]);
  assert.deepEqual(r.setAnswer([A({ text: 'x' })], 11, 'b1', { text: '' }), []);
});

test('other answers are left alone, in their order', () => {
  const other = { serviceId: 13, questionId: 'w1', text: 'Front' };
  assert.deepEqual(r.setAnswer([A({ choice: 'Squeaking' }), other], 11, 'b1', { choice: 'Not stopping well' }),
    [A({ choice: 'Not stopping well' }), other]);
  assert.deepEqual(r.setAnswer([other], 11, 'b1', { text: 'Grinding' }), [other, A({ text: 'Grinding' })]);
});

test("missing answers are the required questions with nothing, in screen order, in the server's words", () => {
  assert.deepEqual(r.missingAnswers(DATA, { serviceIds: [11, 13] }), [
    { serviceId: 11, questionId: 'b1', message: "Please answer: What's wrong with the brakes?" },
    { serviceId: 13, questionId: 'w1', message: 'Please answer: Which wheel needs truing?' },
  ]);
});

test('a pill alone, words alone, or "I\'m not sure" answers a required choice question', () => {
  for (const extra of [{ choice: 'Squeaking' }, { text: 'Grinding' }, { notSure: true }]) {
    assert.deepEqual(r.missingAnswers(DATA, { serviceIds: [11], answers: [A(extra)] }), [], JSON.stringify(extra));
  }
});

test('words that are only spaces are no answer', () => {
  assert.equal(r.missingAnswers(DATA, { serviceIds: [11], answers: [A({ text: '   ' })] }).length, 1);
  assert.equal(r.missingAnswers(DATA, { serviceIds: [13], answers: [{ serviceId: 13, questionId: 'w1', text: ' ' }] }).length, 1);
});

test('an answer filed under another service does not count', () => {
  assert.equal(r.missingAnswers(DATA, { serviceIds: [11], answers: [{ serviceId: 12, questionId: 'b1', choice: 'Squeaking' }] }).length, 1);
});

test('the description is required only for Not sure', () => {
  assert.equal(r.descriptionError({ notSure: true }), "Tell us what's wrong");
  assert.equal(r.descriptionError({ notSure: true, description: '  ' }), "Tell us what's wrong");
  assert.equal(r.descriptionError({ notSure: true, description: 'Clicks when pedalling' }), null);
  assert.equal(r.descriptionError({ serviceIds: [11] }), null);
});

test('photos were cleared when the draft had some and none are held', () => {
  assert.equal(r.photosCleared({ hadPhotos: true }, 0), true);
  assert.equal(r.photosCleared({ hadPhotos: true }, 2), false);
  assert.equal(r.photosCleared({}, 0), false);
});

test('the limits match the server', () => {
  assert.equal(r.BIKE_NOTE_MAX, 200);
  assert.equal(r.ANSWER_TEXT_MAX, 1000);
  assert.equal(r.MAX_PHOTOS, 5);
  assert.equal(r.MAX_PHOTO_BYTES, 10 * 1024 * 1024);
});
```

- [ ] **Step 2: Add the draft shape test.** Append to `tests/customer/draft.test.js`:

```js
test('the d3 fields are saved and read back: bike note, photos flag, a choice with words', async () => {
  const first = await mount('north');
  const draft = {
    serviceIds: [11], bikeNote: 'Green Brompton', hadPhotos: true, description: 'Clicks',
    answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking', text: 'Only when wet' }],
  };
  await first.act(() => first.api.update(draft));
  first.ui.unmount();
  const second = await mount('north');
  assert.deepEqual(second.api.draft, draft);
});
```

- [ ] **Step 3: Run them and watch the rules fail**

Run: `npm run pretest && node --test tests/customer/problem-rules.test.js tests/customer/draft.test.js`

Expected:
- `problem-rules.test.js` FAILS. The import rejects with `ERR_MODULE_NOT_FOUND` for `problem-rules.js`.
- The new draft test PASSES. The change is to types only, which don't exist at runtime. Step 5 shows the type red, and Step 8 proves this test bites.

- [ ] **Step 4: Implement** `src/screens/book/problem-rules.ts`

```ts
import type { PortalQuestion, PortalService, ServicesResponse } from './services-query.ts';
import type { Answer, BookingDraft } from './draft.tsx';
import { chosenServices } from './service-selection.ts';

/**
 * The problem screen's rules, kept apart from the screen so they can be tested
 * directly and reused (d4's guard, hasProblem, calls missingAnswers and
 * descriptionError). A choice question is answered by a tapped pill, by the
 * customer's own words, or both; "I'm not sure" takes the place of a choice
 * (Jack, 26 Sep, decision 4). The description is required only for "Not sure"
 * (decision 7). The server applies the same rules (piece 9).
 * Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
 */

// The server's limits (piece 9 and piece 6).
export const BIKE_NOTE_MAX = 200;
export const ANSWER_TEXT_MAX = 1000;
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type ChoiceQuestion = Extract<PortalQuestion, { kind: 'choice' }>;
export type QuestionGroup = { service: PortalService; questions: PortalQuestion[] };
export type Missing = { serviceId: number; questionId: string; message: string };
export type AnswerChange = { choice: string } | { notSure: true } | { text: string };

// Pill values are prefixed so a shop choice worded "I'm not sure" can't be
// mistaken for the built-in "I'm not sure" pill.
const NOT_SURE_VALUE = 'not-sure';
const CHOICE_PREFIX = 'choice:';

/** The ticked services that have questions, in list order, each with its questions in the shop's order. */
export function questionGroups(data: ServicesResponse, draft: BookingDraft): QuestionGroup[] {
  if (draft.notSure) return [];
  return chosenServices(data, draft.serviceIds ?? [])
    .filter((s) => s.questions.length > 0)
    .map((s) => ({ service: s, questions: s.questions }));
}

/** The shop's wording, with " (optional)" when the shop did not mark it required. */
export function questionLabel(q: PortalQuestion): string {
  return q.required ? q.wording : `${q.wording} (optional)`;
}

export function pillOptions(q: ChoiceQuestion): { value: string; label: string }[] {
  const options = q.choices.map((c) => ({ value: `${CHOICE_PREFIX}${c}`, label: c }));
  return q.allowNotSure ? [...options, { value: NOT_SURE_VALUE, label: "I'm not sure" }] : options;
}

export function pillValue(answer: Answer | undefined): string | null {
  if (answer?.notSure) return NOT_SURE_VALUE;
  if (answer?.choice !== undefined) return `${CHOICE_PREFIX}${answer.choice}`;
  return null;
}

export function pillChange(value: string): AnswerChange {
  return value === NOT_SURE_VALUE ? { notSure: true } : { choice: value.slice(CHOICE_PREFIX.length) };
}

export function findAnswer(answers: Answer[] | undefined, serviceId: number, questionId: string): Answer | undefined {
  return answers?.find((a) => a.serviceId === serviceId && a.questionId === questionId);
}

/**
 * The answers with one question's pill or words changed. A pill replaces the
 * other pill ("I'm not sure" replaces a choice and the other way round); the
 * words are kept as typed (trimming happens on the server) and are
 * independent of the pill. An answer left with no pill and no words is
 * removed. Other answers keep their order.
 */
export function setAnswer(answers: Answer[] | undefined, serviceId: number, questionId: string, change: AnswerChange): Answer[] {
  const list = answers ?? [];
  const index = list.findIndex((a) => a.serviceId === serviceId && a.questionId === questionId);
  const old: Partial<Answer> = index === -1 ? {} : list[index];
  const next: Answer = { serviceId, questionId };
  if ('choice' in change) next.choice = change.choice;
  else if ('notSure' in change) next.notSure = true;
  else if (old.notSure) next.notSure = true;
  else if (old.choice !== undefined) next.choice = old.choice;
  const text = 'text' in change ? change.text : old.text;
  if (text) next.text = text;
  const empty = next.choice === undefined && next.notSure === undefined && next.text === undefined;
  if (index === -1) return empty ? list : [...list, next];
  return empty ? list.filter((_, i) => i !== index) : list.map((a, i) => (i === index ? next : a));
}

function answered(q: PortalQuestion, a: Answer | undefined): boolean {
  const words = (a?.text ?? '').trim() !== '';
  if (q.kind === 'text') return words;
  return words || a?.choice !== undefined || a?.notSure === true;
}

/** The required questions with no answer, in screen order, with the server's message. */
export function missingAnswers(data: ServicesResponse, draft: BookingDraft): Missing[] {
  return questionGroups(data, draft).flatMap(({ service, questions }) =>
    questions
      .filter((q) => q.required && !answered(q, findAnswer(draft.answers, service.id, q.id)))
      .map((q) => ({ serviceId: service.id, questionId: q.id, message: `Please answer: ${q.wording}` })),
  );
}

export function descriptionError(draft: BookingDraft): string | null {
  return draft.notSure === true && (draft.description ?? '').trim() === '' ? "Tell us what's wrong" : null;
}

/** Photos were added in this tab but none are held now (they live in memory only, so a refresh loses them). */
export function photosCleared(draft: BookingDraft, photoCount: number): boolean {
  return draft.hadPhotos === true && photoCount === 0;
}
```

- [ ] **Step 5: Watch the type red.** Run `npm run typecheck`.
Expected: FAIL in `problem-rules.ts` with `Property 'hadPhotos' does not exist on type 'BookingDraft'`.

- [ ] **Step 6: Change the draft type.** In `src/screens/book/draft.tsx`:
  - Replace the line `  bike?: { make: string; model: string; colour: string };` with:

```ts
  // The bike in the customer's own words, sent as a note on the booking, not
  // a bike record: staff create the real bike at check-in (d3; server piece 9).
  bikeNote?: string;
```

  - After `  description?: string;`, add:

```ts
  // Photos were added in this tab. They live in memory only, so after a
  // refresh the problem screen says they were cleared (d3).
  hadPhotos?: boolean;
```

  - In the file's doc comment, add a line after the existing `Spec:` line:

```ts
 * d3 (bikeNote, hadPhotos): docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
```

Nothing in `src/` reads `bike`. `grep -rn "bike?" src/screens src/customer` showed only this line when this plan was written. If typecheck names a reader, report it and don't paper over it.

- [ ] **Step 7: Run and watch them pass**

Run: `npm run pretest && node --test tests/customer/problem-rules.test.js tests/customer/draft.test.js && npm run typecheck && npm run lint`
Expected: all PASS; typecheck and lint clean.

- [ ] **Step 8: Prove the tests bite.** Each time, confirm the mutation in `git diff`, run, and restore.
  1. In `setAnswer`, change `if (text) next.text = text;` to `if (text !== undefined) next.text = text;`. "clearing the words keeps a tapped pill, and removes an answer left with nothing" must FAIL.
  2. In `draft.tsx` `writeStored`, change `JSON.stringify(draft)` to `JSON.stringify(draft, (k, v) => (k === 'bikeNote' ? undefined : v))`. "the d3 fields are saved and read back" must FAIL on `bikeNote`.

- [ ] **Step 9: Commit**

```bash
git add src/screens/book/problem-rules.ts src/screens/book/draft.tsx tests/customer/problem-rules.test.js tests/customer/draft.test.js
git commit -m "feat: the problem screen's rules; the draft holds a bike note and a photos flag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The `hasProblem` guard (added here, applied by d4)

**Files:**
- Modify: `src/screens/book/require-draft.tsx`
- Test: `tests/customer/require-draft.test.js`

**Interfaces:**
- Consumes: `missingAnswers(data, draft)` and `descriptionError(draft)` from Task 1, and `ServicesResponse`.
- Produces: `hasProblem(draft: BookingDraft, services: ServicesResponse): boolean`. It is true when `hasService(draft)` is true, every required question is answered, and (for "Not sure") the description isn't blank. d4 wraps the `date` screen as `<RequireDraft has={(d) => hasProblem(d, data)}>`. d4 will need the redirect to go to `problem`, not the first screen. d3 doesn't change `RequireDraft`'s redirect target.

- [ ] **Step 1: Write the failing test.** Append to `tests/customer/require-draft.test.js`:

```js
// hasProblem: the date screen's guard (d3 adds it; d4 applies it).
// Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
const PROBLEM_SERVICES = {
  shopName: 'North Street Cycles', showPrices: false, full: [], categories: [],
  uncategorised: [
    { id: 11, name: 'Brake service', price: null, minutes: 30, questions: [
      { id: 'b1', wording: "What's wrong with the brakes?", kind: 'choice', required: true, choices: ['Squeaking', 'Not stopping well'], allowNotSure: true },
      { id: 'b2', wording: 'Anything else about the brakes?', kind: 'text', required: false },
    ] },
    { id: 12, name: 'Gear service', price: null, minutes: 30, questions: [] },
  ],
};

test('hasProblem needs a service first', async () => {
  const { hasProblem } = await import(GUARD);
  assert.equal(hasProblem({}, PROBLEM_SERVICES), false);
  assert.equal(hasProblem({ serviceIds: [] }, PROBLEM_SERVICES), false);
});

test('hasProblem needs every required question answered, by a pill or by words', async () => {
  const { hasProblem } = await import(GUARD);
  assert.equal(hasProblem({ serviceIds: [11] }, PROBLEM_SERVICES), false);
  assert.equal(hasProblem({ serviceIds: [11], answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking' }] }, PROBLEM_SERVICES), true);
  assert.equal(hasProblem({ serviceIds: [11], answers: [{ serviceId: 11, questionId: 'b1', text: 'Grinding' }] }, PROBLEM_SERVICES), true);
  assert.equal(hasProblem({ serviceIds: [12] }, PROBLEM_SERVICES), true, 'a service with no questions needs nothing more');
});

test('hasProblem needs a description for Not sure', async () => {
  const { hasProblem } = await import(GUARD);
  assert.equal(hasProblem({ notSure: true }, PROBLEM_SERVICES), false);
  assert.equal(hasProblem({ notSure: true, description: '  ' }, PROBLEM_SERVICES), false);
  assert.equal(hasProblem({ notSure: true, description: 'Clicks when pedalling' }, PROBLEM_SERVICES), true);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/require-draft.test.js`
Expected: the three new tests FAIL with `TypeError: hasProblem is not a function`. The four existing tests PASS.

- [ ] **Step 3: Implement.** In `src/screens/book/require-draft.tsx`:
  - Add imports:

```ts
import type { ServicesResponse } from './services-query.ts';
import { descriptionError, missingAnswers } from './problem-rules.ts';
```

  - After `hasService`, add:

```ts
/**
 * The date screen's guard (d3 adds it; d4 applies it): a service chosen, every
 * required question answered and, for "Not sure", a description.
 * Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
 */
export const hasProblem = (draft: BookingDraft, services: ServicesResponse) =>
  hasService(draft) && missingAnswers(services, draft).length === 0 && descriptionError(draft) === null;
```

- [ ] **Step 4: Run and watch it pass**

Run: `npm run pretest && node --test tests/customer/require-draft.test.js && npm run typecheck && npm run lint`
Expected: all 7 PASS; typecheck and lint clean.

- [ ] **Step 5: Prove it bites.** Remove `&& descriptionError(draft) === null` from `hasProblem`. Confirm it in `git diff`, then run. "hasProblem needs a description for Not sure" must FAIL. Restore it and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/require-draft.tsx tests/customer/require-draft.test.js
git commit -m "feat: hasProblem guard for the date screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The screen, `problem`: fields, answers, and Continue

**Files:**
- Modify: `tests/helpers/book-screen.js` (add a `date` route and record requests)
- Create: `src/screens/book/problem.tsx`
- Modify: `src/customer/app-shell.tsx` (`SCREENS`)
- Test: `tests/customer/problem-screen.test.js`

**Interfaces:**
- Consumes:
  - everything in Task 1
  - `RequireDraft`, `hasService` from `./require-draft.tsx`
  - `BookFrame` with `step`, `title`, `back`, `action`, `actionNote`. Its pinned area carries `data-book-pinned`. It focuses its `h1` and calls `window.scrollTo`.
  - `useDraft()` (`{ draft, update, photos, setPhotos }`) and `useServices`
- Produces:
  - `export function ProblemScreen()`. Task 4 adds photos to it, and Task 5's browser test uses it.
  - `renderBookScreen` gains a `date` route (renders "At /book/north/date") and returns `requests: { url: string; method: string }[]`.

- [ ] **Step 1: Update the helper.** Replace `tests/helpers/book-screen.js` with:

```js
// Renders one book screen in jsdom, the way the customer app mounts it: inside
// /book/:shopSlug with the booking-in-progress provider, a query client, and
// /services answered from `services`. Every other book address renders
// "At <path><search>", so a test can see where a screen navigated to.
// Shop slug is always "north". scrollIntoView (missing in jsdom) is recorded
// in `scrolled`. Every fetch is answered at once and recorded in `requests`
// ({url, method}), so a test can prove a screen sent nothing (d3).
import { installDom, importFresh } from './dom.js';

const BUILD = new URL('../../.test-build/', import.meta.url);

export async function renderBookScreen({ file, exportName, at, url, services, draft }) {
  const uninstall = installDom(`http://localhost${url}`);
  if (draft) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(draft));
  const scrolled = [];
  // Both the frame's scroll-to-top and a screen's own ?start scrollIntoView
  // land here in call order, so a test can prove the frame's runs first (and
  // the screen's own scroll still wins the final position).
  const scrollCalls = [];
  window.scrollTo = (...args) => scrollCalls.push({ type: 'top', args });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrollCalls.push({ type: 'start', el: this });
    scrolled.push(this);
  };
  const requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET' });
    return new Response(JSON.stringify(services), { status: 200, headers: { 'content-type': 'application/json' } });
  };

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
  const routes = ['', 'services', 'problem', 'date'].map((p) => ({ ...child(p), Component: p === at ? Screen : Where }));
  const router = createMemoryRouter([{ path: '/book/:shopSlug', Component: Layout, children: routes }], { initialEntries: [url] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(h(QueryClientProvider, { client }, h(RouterProvider, { router })));
  const readDraft = () => JSON.parse(window.sessionStorage.getItem('wh-book-draft:north') ?? '{}');
  return { ui, client, uninstall, scrolled, scrollCalls, requests, readDraft };
}
```

Then run `npm run pretest && node --test tests/customer/service-screen.test.js tests/customer/service-list-screen.test.js` to confirm the helper change broke nothing (all PASS).

- [ ] **Step 2: Write the failing test** `tests/customer/problem-screen.test.js`

```js
// The problem screen: bike box, each ticked service's questions (pills plus
// the customer's own words), the description, and Continue.
// Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
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

const choiceQ = (id, wording, choices, { required = true, allowNotSure = true } = {}) =>
  ({ id, wording, kind: 'choice', required, choices, allowNotSure });
const textQ = (id, wording, required = true) => ({ id, wording, kind: 'text', required });
const svc = (id, name, questions = []) => ({ id, name, price: 20, minutes: 30, questions });
const DATA = {
  shopName: 'North Street Cycles', showPrices: true, full: [],
  categories: [
    { id: 5, name: 'Brakes', services: [svc(11, 'Brake service', [choiceQ('b1', "What's wrong with the brakes?", ['Squeaking', 'Not stopping well'])])] },
    { id: 6, name: 'Wheels', services: [svc(13, 'Wheel true', [
      textQ('w1', 'Which wheel needs truing?'),
      choiceQ('w2', 'Tubeless?', ['Yes', 'No'], { required: false, allowNotSure: false }),
    ])] },
  ],
  uncategorised: [svc(12, 'Gear service')],
};
const BRAKE_WORDS = "What's wrong with the brakes? Or tell us in your own words";

const open = async (draft = { serviceIds: [11, 12, 13] }, services = DATA) => {
  current = await renderBookScreen({
    file: 'screens/book/problem.js', exportName: 'ProblemScreen', at: 'problem', url: '/book/north/problem', services, draft,
  });
  await current.ui.findByRole('heading', { level: 1, name: 'Tell us about your bike' });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => (await rtl()).fireEvent.click(el);
const type = async (el, value) => (await rtl()).fireEvent.change(el, { target: { value } });
const pillLabels = async (ui, name) => {
  const { within } = await rtl();
  return within(ui.getByRole('group', { name })).getAllByRole('radio').map((r) => r.closest('label').textContent);
};

test('a heading per ticked service with questions, in list order; none for a service without', async () => {
  const { ui } = await open();
  assert.deepEqual(ui.getAllByRole('heading', { level: 2 }).map((h) => h.textContent), ['Brake service', 'Wheel true']);
});

test('a choice question shows its pills, "I\'m not sure" when allowed, and a words box', async () => {
  const { ui } = await open();
  assert.deepEqual(await pillLabels(ui, "What's wrong with the brakes?"), ['Squeaking', 'Not stopping well', "I'm not sure"]);
  assert.deepEqual(await pillLabels(ui, 'Tubeless? (optional)'), ['Yes', 'No']);
  assert.ok(ui.getByText("What's wrong with the brakes?").closest('fieldset'));
  assert.equal(ui.getAllByText('Or tell us in your own words').length, 2);
  const words = ui.getByRole('textbox', { name: BRAKE_WORDS });
  assert.equal(words.tagName, 'TEXTAREA');
  assert.equal(words.maxLength, 1000);
  assert.ok(ui.getByRole('textbox', { name: 'Tubeless? (optional) Or tell us in your own words' }));
});

test('the bike box, a text question, and the optional description', async () => {
  const { ui } = await open();
  const bike = ui.getByRole('textbox', { name: 'Your bike (optional)' });
  assert.equal(bike.tagName, 'INPUT');
  assert.equal(bike.getAttribute('placeholder'), 'Blue Trek road bike');
  assert.equal(bike.maxLength, 200);
  const which = ui.getByRole('textbox', { name: 'Which wheel needs truing?' });
  assert.equal(which.tagName, 'TEXTAREA');
  assert.equal(which.maxLength, 1000);
  const description = ui.getByRole('textbox', { name: 'Anything else we should know? (optional)' });
  assert.equal(description.hasAttribute('maxlength'), false, 'the description has no length limit');
});

test('services ticked but no questions: the bike box and the optional description only', async () => {
  const { ui } = await open({ serviceIds: [12] });
  assert.equal(ui.queryAllByRole('heading', { level: 2 }).length, 0);
  assert.equal(ui.getAllByRole('textbox').length, 2);
  assert.ok(ui.getByRole('textbox', { name: 'Your bike (optional)' }));
  assert.ok(ui.getByRole('textbox', { name: 'Anything else we should know? (optional)' }));
});

test('Not sure: no questions, a required description, and Back goes to the first screen', async () => {
  const { ui } = await open({ notSure: true, serviceIds: [], answers: [] });
  assert.equal(ui.queryAllByRole('heading', { level: 2 }).length, 0);
  assert.equal(ui.queryByRole('radio'), null);
  assert.ok(ui.getByRole('textbox', { name: "What's wrong with it?" }));
  assert.equal(ui.queryByText('Anything else we should know? (optional)'), null);
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north'));
});

test('with services ticked, Back goes to the service list', async () => {
  const { ui } = await open();
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north/services'));
});

test('opened with no service chosen, it goes back to the first screen', async () => {
  current = await renderBookScreen({
    file: 'screens/book/problem.js', exportName: 'ProblemScreen', at: 'problem', url: '/book/north/problem', services: DATA,
  });
  assert.ok(await current.ui.findByText('At /book/north'));
});

test('a tap, words, or both are saved to the draft as they change', async () => {
  const { ui, readDraft } = await open();
  const answer = () => readDraft().answers.find((a) => a.questionId === 'b1');
  await type(ui.getByRole('textbox', { name: BRAKE_WORDS }), 'Grinding');
  assert.deepEqual(answer(), { serviceId: 11, questionId: 'b1', text: 'Grinding' });
  await click(ui.getByRole('radio', { name: 'Squeaking' }));
  assert.deepEqual(answer(), { serviceId: 11, questionId: 'b1', choice: 'Squeaking', text: 'Grinding' });
  assert.equal(ui.getByRole('radio', { name: 'Squeaking' }).checked, true);
  await click(ui.getByRole('radio', { name: "I'm not sure" }));
  assert.deepEqual(answer(), { serviceId: 11, questionId: 'b1', notSure: true, text: 'Grinding' });
  await type(ui.getByRole('textbox', { name: BRAKE_WORDS }), '');
  assert.deepEqual(answer(), { serviceId: 11, questionId: 'b1', notSure: true });
  await type(ui.getByRole('textbox', { name: 'Which wheel needs truing?' }), 'Front');
  assert.deepEqual(readDraft().answers.find((a) => a.questionId === 'w1'), { serviceId: 13, questionId: 'w1', text: 'Front' });
});

test('the bike box, description and words survive a remount', async () => {
  const first = await open({ serviceIds: [11] });
  await type(first.ui.getByRole('textbox', { name: 'Your bike (optional)' }), 'Green Brompton');
  await type(first.ui.getByRole('textbox', { name: 'Anything else we should know? (optional)' }), 'Rattles over bumps');
  await type(first.ui.getByRole('textbox', { name: BRAKE_WORDS }), 'Grinding');
  const stored = first.readDraft();
  assert.equal(stored.bikeNote, 'Green Brompton');
  assert.equal(stored.description, 'Rattles over bumps');
  first.ui.unmount();
  current.client.clear();
  current.uninstall();
  current = undefined;

  const second = await open(stored);
  assert.equal(second.ui.getByRole('textbox', { name: 'Your bike (optional)' }).value, 'Green Brompton');
  assert.equal(second.ui.getByRole('textbox', { name: 'Anything else we should know? (optional)' }).value, 'Rattles over bumps');
  assert.equal(second.ui.getByRole('textbox', { name: BRAKE_WORDS }).value, 'Grinding');
});

test('Continue with required questions unanswered: a message under each, the pinned summary, focus on the first', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  const brakes = ui.getByText("Please answer: What's wrong with the brakes?");
  assert.ok(brakes.parentElement.contains(ui.getByRole('radio', { name: 'Squeaking' })), 'message is not under its question');
  assert.ok(ui.getByText('Please answer: Which wheel needs truing?'));
  assert.equal(ui.queryByText(/Please answer: Tubeless/), null, 'an optional question needs no answer');
  const words = ui.getByRole('textbox', { name: BRAKE_WORDS });
  assert.equal(words.getAttribute('aria-invalid'), 'true');
  assert.equal(words.getAttribute('aria-describedby'), brakes.id);
  const alert = ui.getByRole('alert');
  assert.equal(alert.textContent, 'Please check the answers marked above');
  assert.ok(document.querySelector('[data-book-pinned]').contains(alert));
  assert.ok(document.activeElement === ui.getByRole('radio', { name: 'Squeaking' }), 'focus is not on the first question');
  assert.equal(ui.queryByText(/^At /), null);
});

test('a message goes as soon as its question is answered', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  await type(ui.getByRole('textbox', { name: BRAKE_WORDS }), 'Grinding');
  assert.equal(ui.queryByText("Please answer: What's wrong with the brakes?"), null);
  assert.ok(ui.getByText('Please answer: Which wheel needs truing?'));
  assert.ok(ui.getByRole('alert'));
});

test('pressing Continue twice with the same problem re-announces a fresh alert', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  const first = ui.getByRole('alert');
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert') !== first, 'the alert node was not replaced on the second press');
});

test('Not sure with no description: a message under it, and focus on it', async () => {
  const { ui } = await open({ notSure: true, serviceIds: [], answers: [] });
  await click(ui.getByRole('button', { name: 'Continue' }));
  const box = ui.getByRole('textbox', { name: "What's wrong with it?" });
  const message = ui.getByText("Tell us what's wrong");
  assert.equal(box.getAttribute('aria-describedby'), message.id);
  assert.ok(ui.getByRole('alert').textContent === 'Please check the answers marked above');
  assert.ok(document.activeElement === box, 'focus is not on the description');
  assert.equal(ui.queryByText(/^At /), null);
});

test('a good Continue goes to the date screen and sends nothing', async () => {
  const { ui, requests } = await open();
  await type(ui.getByRole('textbox', { name: BRAKE_WORDS }), 'Grinding');
  await type(ui.getByRole('textbox', { name: 'Which wheel needs truing?' }), 'Front');
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/date'));
  assert.ok(requests.length > 0);
  assert.ok(requests.every((r) => r.method === 'GET' && r.url.endsWith('/api/portal/north/services')), JSON.stringify(requests));
});

test('Not sure with a description continues to the date screen', async () => {
  const { ui } = await open({ notSure: true, serviceIds: [], answers: [] });
  await type(ui.getByRole('textbox', { name: "What's wrong with it?" }), 'Clicks when pedalling');
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/date'));
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/problem-screen.test.js`
Expected: FAIL. `screens/book/problem.js` isn't found.

- [ ] **Step 4: Implement** `src/screens/book/problem.tsx`

```tsx
import * as React from 'react';
import { useNavigate, useParams } from 'react-router';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { PillGroup } from '@/components/ui/pill-group';
import { Textarea } from '@/components/ui/textarea';
import { BookFrame } from './frame.tsx';
import { useDraft, type Answer } from './draft.tsx';
import { RequireDraft, hasService } from './require-draft.tsx';
import { useServices, type PortalQuestion } from './services-query.ts';
import {
  ANSWER_TEXT_MAX, BIKE_NOTE_MAX, descriptionError, findAnswer, missingAnswers, pillChange, pillOptions, pillValue,
  questionGroups, questionLabel, setAnswer, type AnswerChange,
} from './problem-rules.ts';

/**
 * The problem screen (atlas `problem`, step 2): the bike in the customer's own
 * words, each ticked service's questions (quick-answer pills plus "Or tell us
 * in your own words"), a description (required only for "Not sure"), and
 * photos. Everything but photos is written to the draft as it changes, so it
 * survives a refresh. Continue checks the answers and goes to the date screen;
 * nothing is sent until d5.
 * Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
 */
export function ProblemScreen() {
  return (
    <RequireDraft has={hasService}>
      <ProblemForm />
    </RequireDraft>
  );
}

// A DOM id for one question's block; Continue moves focus into it.
const blockId = (base: string, serviceId: number, questionId: string) =>
  `${base}-q-${serviceId}-${encodeURIComponent(questionId)}`;

function ProblemForm() {
  const { shopSlug = '' } = useParams();
  const navigate = useNavigate();
  const { data } = useServices(shopSlug);
  const { draft, update } = useDraft();
  // Messages show only after a Continue press, then follow the draft, so each
  // goes as soon as it is fixed.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed Continue so the pinned alert is a new node and is
  // announced again (as on the service list).
  const [attempt, setAttempt] = React.useState(0);
  const base = React.useId();
  const title = 'Tell us about your bike';
  const back = draft.notSure ? `/book/${shopSlug}` : `/book/${shopSlug}/services`;

  if (!data) return <BookFrame step={2} title={title} back={back}>{null}</BookFrame>;

  const groups = questionGroups(data, draft);
  const missing = checked ? missingAnswers(data, draft) : [];
  const descError = checked ? descriptionError(draft) : null;
  const failed = missing.length > 0 || descError !== null;
  const descId = `${base}-description`;

  const answer = (serviceId: number, questionId: string, change: AnswerChange) =>
    update({ answers: setAnswer(draft.answers, serviceId, questionId, change) });

  const onContinue = () => {
    const nowMissing = missingAnswers(data, draft);
    const nowDescError = descriptionError(draft);
    if (nowMissing.length > 0 || nowDescError !== null) {
      setChecked(true);
      setAttempt((a) => a + 1);
      // Questions come before the description on screen, so the first
      // missing question, if any, is the first problem.
      const first = nowMissing[0];
      const target = first
        ? document.getElementById(blockId(base, first.serviceId, first.questionId))?.querySelector<HTMLElement>('input, textarea')
        : document.getElementById(descId);
      target?.focus();
      return;
    }
    navigate(`/book/${shopSlug}/date`);
  };

  return (
    <BookFrame
      step={2}
      title={title}
      back={back}
      action={{ label: 'Continue', onClick: onContinue }}
      actionNote={
        failed ? (
          <p key={attempt} role="alert" className="m-0 text-[var(--wh-danger)]">
            Please check the answers marked above
          </p>
        ) : undefined
      }
    >
      <Field>
        <Label htmlFor={`${base}-bike`}>Your bike (optional)</Label>
        <Input
          id={`${base}-bike`}
          value={draft.bikeNote ?? ''}
          maxLength={BIKE_NOTE_MAX}
          placeholder="Blue Trek road bike"
          onChange={(e) => update({ bikeNote: e.target.value || undefined })}
        />
      </Field>
      {groups.map(({ service, questions }) => (
        <section key={service.id} className="mb-4">
          <h2 className="m-0 mb-2 text-base font-semibold">{service.name}</h2>
          {questions.map((q) => (
            <QuestionField
              key={q.id}
              id={blockId(base, service.id, q.id)}
              question={q}
              answer={findAnswer(draft.answers, service.id, q.id)}
              error={missing.find((m) => m.serviceId === service.id && m.questionId === q.id)?.message ?? null}
              onChange={(change) => answer(service.id, q.id, change)}
            />
          ))}
        </section>
      ))}
      <Field>
        <Label htmlFor={descId}>{draft.notSure ? "What's wrong with it?" : 'Anything else we should know? (optional)'}</Label>
        <Textarea
          id={descId}
          value={draft.description ?? ''}
          aria-required={draft.notSure ? true : undefined}
          aria-invalid={descError ? true : undefined}
          aria-describedby={descError ? `${descId}-error` : undefined}
          onChange={(e) => update({ description: e.target.value || undefined })}
        />
        {descError && <FieldError id={`${descId}-error`}>{descError}</FieldError>}
      </Field>
    </BookFrame>
  );
}

type QuestionFieldProps = {
  id: string;
  question: PortalQuestion;
  answer: Answer | undefined;
  error: string | null;
  onChange: (change: AnswerChange) => void;
};

function QuestionField({ id, question, answer, error, onChange }: QuestionFieldProps) {
  const label = questionLabel(question);
  const errorId = `${id}-error`;
  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;

  if (question.kind === 'text') {
    return (
      <Field id={id}>
        <Label htmlFor={`${id}-box`}>{label}</Label>
        <Textarea
          id={`${id}-box`}
          maxLength={ANSWER_TEXT_MAX}
          value={answer?.text ?? ''}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </Field>
    );
  }

  // The words box is named by the question as well as its own label, so a
  // screen reader user knows which question the box belongs to.
  return (
    <Field id={id}>
      <PillGroup
        legend={<span id={`${id}-wording`}>{label}</span>}
        options={pillOptions(question)}
        value={pillValue(answer)}
        onChange={(value) => onChange(pillChange(value))}
      />
      <Label id={`${id}-words`} htmlFor={`${id}-box`} className="mt-2">
        Or tell us in your own words
      </Label>
      <Textarea
        id={`${id}-box`}
        maxLength={ANSWER_TEXT_MAX}
        value={answer?.text ?? ''}
        aria-labelledby={`${id}-wording ${id}-words`}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
```

Notes for the implementer:
- `Field` spreads its props onto a `div`, so `id` works. `useId` values contain characters like `«»` or `:`. They work with `getElementById`; don't use them in `querySelector` selectors.
- The pinned alert's colour is `--wh-danger`, as on the service list.

In `src/customer/app-shell.tsx`, add `import { ProblemScreen } from '@/screens/book/problem.tsx';` and `problem: ProblemScreen,` to `SCREENS` after `'service-list'`. When this plan was written, `grep -rn "Not built yet: problem" tests/` found nothing, so no shell test asserts the problem placeholder. Step 5 runs the shell test to confirm.

- [ ] **Step 5: Run and watch it pass**

Run: `npm run pretest && time node --test tests/customer/problem-screen.test.js tests/customer/service-screen.test.js tests/customer/service-list-screen.test.js tests/screens/customer-app-shell.test.js && npm run typecheck && npm run lint`

Expected: all PASS and `problem-screen.test.js` exits in seconds. Typecheck and lint are clean. If `customer-app-shell.test.js` fails on a problem placeholder, change that assertion to the real screen: at `/book/demo/problem` with an empty draft, the screen redirects to `/book/demo` and shows "What do you need?". Report the change.

- [ ] **Step 6: Prove two tests bite.** Each time, confirm the mutation in `git diff`, run, and restore.
  1. Delete the line `target?.focus();`. "Continue with required questions unanswered … focus on the first" must FAIL on the focus assertion.
  2. Change `if (nowMissing.length > 0 || nowDescError !== null) {` to `if (nowMissing.length > 0) {`. "Not sure with no description" must FAIL, because it navigates to `date`.

- [ ] **Step 7: Commit**

```bash
git add tests/helpers/book-screen.js src/screens/book/problem.tsx src/customer/app-shell.tsx tests/customer/problem-screen.test.js
git commit -m "feat: the problem screen - bike note, question pills with the customer's own words, description, Continue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Photos, and the message after a refresh

**Files:**
- Modify: `src/screens/book/problem.tsx`
- Test: `tests/customer/problem-screen.test.js`

**Interfaces:**
- Consumes: `photosCleared`, `MAX_PHOTOS`, `MAX_PHOTO_BYTES` (Task 1). `PhotoPicker` from `@/components/ui/photo-picker` (`value: File[]`, `onChange(files)`, `max`, `maxBytes`, `label`). `photos` / `setPhotos` from `useDraft()`, which are held in memory only.
- Produces: `draft.hadPhotos` is `true` while photos are held and cleared when none are. A successful Continue sets it to match the photos held.

- [ ] **Step 1: Write the failing tests.** Append to `tests/customer/problem-screen.test.js`:

```js
const photo = (name) => new File([new Uint8Array(1000)], name, { type: 'image/jpeg' });
const addPhotos = async (ui, files) =>
  (await rtl()).fireEvent.change(ui.container.querySelector('input[type="file"]'), { target: { files } });

test('photos: the picker, its label and the drop-off line', async () => {
  const { ui } = await open({ serviceIds: [12] });
  assert.ok(ui.getByText('Add photos (optional)'));
  assert.ok(ui.getByText('You can also show us at drop-off.'));
  assert.equal(ui.container.querySelector('input[type="file"]').getAttribute('accept'), 'image/jpeg,image/png,image/webp');
  assert.equal(ui.queryByText('Your photos were cleared - please add them again'), null);
});

test('adding photos records it in the draft, never the photos themselves', async () => {
  const { ui, readDraft } = await open({ serviceIds: [12] });
  await addPhotos(ui, [photo('wheel.jpg')]);
  assert.ok(ui.getByRole('button', { name: 'Remove wheel.jpg' }));
  assert.equal(readDraft().hadPhotos, true);
  assert.doesNotMatch(JSON.stringify(readDraft()), /wheel\.jpg/);
  await click(ui.getByRole('button', { name: 'Remove wheel.jpg' }));
  assert.equal(readDraft().hadPhotos, undefined);
});

test('after a remount, photos added before are reported cleared, above the picker, until added again', async () => {
  const first = await open({ serviceIds: [12] });
  await addPhotos(first.ui, [photo('wheel.jpg')]);
  const stored = first.readDraft();
  first.ui.unmount();
  current.client.clear();
  current.uninstall();
  current = undefined;

  const { ui } = await open(stored);
  const message = ui.getByText('Your photos were cleared - please add them again');
  assert.ok(message.compareDocumentPosition(ui.getByText('Add photos (optional)')) & Node.DOCUMENT_POSITION_FOLLOWING, 'the message is not above the picker');
  await addPhotos(ui, [photo('wheel.jpg')]);
  assert.equal(ui.queryByText('Your photos were cleared - please add them again'), null);
});

test('continuing without re-adding photos drops the cleared message', async () => {
  const { ui, readDraft } = await open({ serviceIds: [12], hadPhotos: true });
  assert.ok(ui.getByText('Your photos were cleared - please add them again'));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/date'));
  assert.equal(readDraft().hadPhotos, undefined);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run pretest && node --test tests/customer/problem-screen.test.js`
Expected: the four new tests FAIL. "Add photos (optional)" isn't found, there's no file input, and no cleared message shows. The earlier tests PASS.

- [ ] **Step 3: Implement** in `src/screens/book/problem.tsx`.
  - After the line `import { PillGroup } from '@/components/ui/pill-group';`, add:

```tsx
import { PhotoPicker } from '@/components/ui/photo-picker';
```

  - Replace the `./problem-rules.ts` import block with:

```tsx
import {
  ANSWER_TEXT_MAX, BIKE_NOTE_MAX, MAX_PHOTOS, MAX_PHOTO_BYTES, descriptionError, findAnswer, missingAnswers, photosCleared,
  pillChange, pillOptions, pillValue, questionGroups, questionLabel, setAnswer, type AnswerChange,
} from './problem-rules.ts';
```

  - Replace `  const { draft, update } = useDraft();` with:

```tsx
  const { draft, update, photos, setPhotos } = useDraft();
```

  - In `onContinue`, replace `    navigate(\`/book/${shopSlug}/date\`);` with:

```tsx
    // Continuing ends the "photos were cleared" message (spec): the flag now
    // matches the photos actually held.
    update({ hadPhotos: photos.length > 0 ? true : undefined });
    navigate(`/book/${shopSlug}/date`);
```

  - Replace the closing lines of `ProblemForm`'s JSX, `      </Field>\n    </BookFrame>`, with:

```tsx
      </Field>
      <section className="mb-4">
        {photosCleared(draft, photos.length) && (
          <p role="status" className="m-0 mb-2 rounded-md bg-[var(--wh-warn-bg)] p-2.5 text-sm text-[var(--wh-warn-ink)]">
            Your photos were cleared - please add them again
          </p>
        )}
        <PhotoPicker
          label="Add photos (optional)"
          value={photos}
          max={MAX_PHOTOS}
          maxBytes={MAX_PHOTO_BYTES}
          onChange={(files) => {
            setPhotos(files);
            update({ hadPhotos: files.length > 0 ? true : undefined });
          }}
        />
        <p className="m-0 mt-2 text-sm text-[var(--wh-muted)]">You can also show us at drop-off.</p>
      </section>
    </BookFrame>
```

- [ ] **Step 4: Run and watch them pass**

Run: `npm run pretest && time node --test tests/customer/problem-screen.test.js && npm run typecheck && npm run lint`
Expected: all PASS; the file exits in seconds; typecheck and lint are clean.

- [ ] **Step 5: Prove two tests bite.** Each time, confirm the mutation in `git diff`, run, and restore.
  1. In the picker's `onChange`, delete `update({ hadPhotos: files.length > 0 ? true : undefined });`. "adding photos records it in the draft" must FAIL.
  2. In `onContinue`, delete the `update({ hadPhotos: ... })` line. "continuing without re-adding photos drops the cleared message" must FAIL.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/problem.tsx tests/customer/problem-screen.test.js
git commit -m "feat: photos on the problem screen, and a cleared message after a refresh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The on-screen keyboard check (moved here from d2)

**Files:**
- Create: `tests/browser/book-problem.spec.ts`

**Interfaces:**
- Consumes:
  - the served app at `/book/:shopSlug/problem` (Task 3)
  - `data-book-pinned` on BookFrame's pinned area
  - the frame's `scroll-padding-bottom` (`7rem` with no note), set on `document.documentElement` while the action shows
  - the draft key `wh-book-draft:<shopSlug>` in sessionStorage

- [ ] **Step 1: Write the check** `tests/browser/book-problem.spec.ts`

```ts
import { test, expect } from '@playwright/test';

// d2 moved this check to d3: with a phone's on-screen keyboard open, the box
// being typed in must sit entirely above the pinned Continue.
//
// Playwright cannot open a real on-screen keyboard. What a keyboard does to
// the page is shrink the visible height and then scroll the focused box into
// view, and the frame's scroll-padding-bottom keeps that scroll clear of the
// pinned area. This test imitates both: it cuts a 320x568 phone's viewport to
// 320x300 (about what shows above a keyboard), then scrolls the focused box
// into view the way the browser does. It is not a real keyboard.
//
// /services is answered here and the draft seeded, so no seeded shop is needed.
// Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
const question = (id: string, wording: string) =>
  ({ id, wording, kind: 'choice', required: true, choices: ['Squeaking', 'Not stopping well'], allowNotSure: true });

test('with the keyboard open, the focused box is entirely above the pinned Continue', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({
      json: {
        shopName: 'Test shop', showPrices: true, full: [], categories: [],
        uncategorised: [{
          id: 1, name: 'Brake service', price: 20, minutes: 30,
          questions: [question('b1', "What's wrong with the front brake?"), question('b2', "What's wrong with the rear brake?")],
        }],
      },
    }));
  // The problem screen needs a chosen service (RequireDraft), read from the tab's draft.
  await page.addInitScript(() => window.sessionStorage.setItem('wh-book-draft:any-shop', JSON.stringify({ serviceIds: [1] })));
  await page.goto('/book/any-shop/problem');

  const box = page.getByRole('textbox', { name: 'Anything else we should know? (optional)' });
  await box.focus();
  // The keyboard opens: the visible height drops (imitated; see above) and the
  // browser brings the focused box into view.
  await page.setViewportSize({ width: 320, height: 300 });
  await box.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));

  const field = await box.boundingBox();
  const pinned = await page.locator('[data-book-pinned]').boundingBox();
  expect(field).not.toBeNull();
  expect(pinned).not.toBeNull();
  expect(field!.y).toBeGreaterThanOrEqual(0);
  expect(field!.y + field!.height).toBeLessThanOrEqual(pinned!.y);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/browser/book-problem.spec.ts`
Expected: PASS.

- [ ] **Step 3: Prove it bites.** In `src/screens/book/frame.tsx`, delete the line `root.style.scrollPaddingBottom = actionNote ? '9rem' : '7rem';`. Confirm it in `git diff`. Run `npx playwright test tests/browser/book-problem.spec.ts`. It must FAIL on the last assertion: the box's bottom sits at the viewport's bottom, behind the pinned area.

  **If it still passes**, the box was already clear of the pinned area before the scroll, so the test isn't exercising the padding. Add `await page.evaluate(() => window.scrollTo(0, 0));` just before `box.evaluate(...)`, so the browser has to bring the box up from below. Re-run with the mutation (must FAIL) and without it (must PASS), keep that line, and say in the report which version you used.

  Restore `frame.tsx` and re-run to PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/browser/book-problem.spec.ts
git commit -m "test: with the on-screen keyboard open, the focused box stays above the pinned Continue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Everything CI runs, STATUS, and the spec walk

**Files:**
- Modify: `.agents/STATUS.md`
- Modify: `docs/superpowers/plans/2026-09-26-book-d3-problem-screen.md` (this plan: the decision log and spec walk)

- [ ] **Step 1: Run everything CI runs.** Run each command and read its exit code and output. Report the test counts.

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run registry:validate
node scripts/ci/check-registry-drift.mjs
node scripts/ci/assert-screen-trace.mjs
node scripts/ci/assert-rls-coverage.mjs
npm run test:browser
```

Expected: every command exits 0. `npm test` includes the new `problem-rules`, `problem-screen`, `require-draft` and `draft` tests. `test:browser` runs `smoke`, `book-service-list` and `book-problem`. Confirm each new test name appears in the output. A suite that didn't run isn't a pass. `npm run build` dirties `public/dist` locally (see STATUS); don't commit it.

- [ ] **Step 2: Check piece 9.** Run `gh pr view 81 --json state,mergedAt`. Report the state. If it isn't `MERGED`, the d3 PR must wait for it (spec). Don't merge anything yourself.

- [ ] **Step 3: STATUS.** Edit `.agents/STATUS.md`:
  1. In the d2 entry, replace the sentences from "For d3:" through "moves to d3." with:

     > **(d3) built on `feat/book-d3-problem-screen`** (26 Sep; spec `docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md`, plan `docs/superpowers/plans/2026-09-26-book-d3-problem-screen.md`, which carries the decision log and the spec walk; needs server piece 9, PR #81, merged first). Built: the `problem` screen (a bike box, each ticked service's questions as pills plus "Or tell us in your own words", a description required only for "Not sure", and up to 5 photos with a "cleared" message after a refresh); `bikeNote` and `hadPhotos` on the draft (`bike` removed); the rules in `src/screens/book/problem-rules.ts`; and `hasProblem(draft, services)` in `require-draft.tsx`, tested but not applied. **For d4:** wrap `date` in `RequireDraft` with `(d) => hasProblem(d, data)`. The spec sends the customer back to `problem`, but `RequireDraft` redirects to the first screen, so d4 needs a redirect target. Draft answers are `{serviceId, questionId, choice?, text?, notSure?}`, matching piece 9. **For d5:** send `bikeNote` and each answer's `text`; photos are `useDraft().photos` (memory only) and must go as bare base64 (piece 6 note below). The on-screen keyboard check is `tests/browser/book-problem.spec.ts`: an imitation (viewport cut to 320x300), not a real keyboard. Jack to confirm the look of the "photos were cleared" note (`--wh-warn-bg` / `--wh-warn-ink`).

  2. In the "**Deferred for d2 (and later):**" list, delete "where the pinned button sits with the on-screen keyboard open (moves to d3);".
  3. In the `**Branch:**` line at the top, after "d2 on `feat/book-d2-service-screens`", add "; d3 on `feat/book-d3-problem-screen`". If that phrase has already been updated to say d2 merged, add the d3 clause at the end of the line's first sentence instead.

- [ ] **Step 4: Walk the build against the spec.** Go through the spec's sections: Decisions 1-7, The screen, Draft changes, Rules, and Tests. Under "Spec walk" at the end of this plan, record each requirement as **met** (name the test that proves it), **dropped**, or **changed**, with the reason. Also add any decision taken during the build to the "Decision log", with what caused it.

- [ ] **Step 5: Commit**

```bash
git add .agents/STATUS.md docs/superpowers/plans/2026-09-26-book-d3-problem-screen.md
git commit -m "docs: STATUS - d3 built; plan decision log and spec walk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decision log

Decisions taken while writing this plan, where the spec left room. Each has the reason. Add any decision taken during the build below them.

1. **Messages follow the draft after the first failed Continue.** Each message disappears as soon as its question is answered, and the pinned summary goes when nothing is left. The spec says what Continue checks, not when messages clear. Clearing them live saves a second press and matches d2, where an error cleared on the next tap.
2. **Focus for a choice question goes to its first pill (a radio).** For a text question it goes to the box, and for the description to the description. The spec says "the first question or field with a message". A radio receives focus without opening the phone keyboard, and a screen reader reads the question from its fieldset's legend.
3. **The choice words box is named by the question and its own label** (`aria-labelledby`), so several "Or tell us in your own words" boxes can be told apart. Its visible label is unchanged (spec copy).
4. **"Add photos (optional)" is the `PhotoPicker`'s own `label`**, not a separate heading. The spec names the item that way, and a separate heading would say "Add photos" twice. The picker's own "Optional · n of 5 added" line stays; the control isn't editable here.
5. **The cleared message ends on a successful Continue**, not on a failed one. The spec says "until photos are added or the customer continues". A failed Continue doesn't continue.
6. **The problem screen is guarded by `RequireDraft` with `hasService`.** Opened with no service chosen, it goes to the first screen. The d3 spec doesn't say so; d1's rule is that a screen needing earlier answers declares them.
7. **Pill values are prefixed** (`choice:<text>`, `not-sure`), so a shop choice worded "I'm not sure" can't collide with the built-in pill.
8. **Words are stored as typed.** Only an empty box removes them, while whitespace-only words count as no answer. The server trims (piece 9). Trimming while typing would eat the space before the next word.
9. **The draft shape test can't fail before the change**, because the change is to types only. Its red is `npm run typecheck` (Task 1 Step 5), and a mutation proves the round-trip test bites (Task 1 Step 8).
10. **The atlas mock-up isn't edited.** The spec's "Changes" list records where it departs from the mock-up; d2 treated its list the same way.
11. **`hasProblem` doesn't change `RequireDraft`'s redirect target.** The spec sends a customer failing it "back to `problem`". That's d4's to build, since d4 applies the guard. STATUS records it for d4.
12. **The keyboard check focuses the description** (the last box above the photos) on a screen with two questions, so the box starts below the shrunken viewport. Task 5 Step 3 has the fallback if the mutation doesn't bite.
13. **A choice answer counts as answered only if its `choice` is still one of the question's current `choices`.** A shop may reword or remove a choice after the customer tapped it; treating a stale value as answered would let a required question through with an answer the shop no longer offers. Words or `notSure` still count on their own. Added to `answered()` in `problem-rules.ts`, tested by `missingAnswers`/`hasProblem`'s "stale choice" cases.

## Spec walk

Walked against `docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md`.

**Decisions 1-7** (Jack, 26 Sep):
1. One free-text bike box — **met**. `problem.tsx`'s single `Input` bound to `draft.bikeNote`, no saved-bike picking. Proven by `problem-screen.test.js`'s bike-box cases.
2. The bike words are a note, not a bike record — **met**. `bikeNote` is a plain string on the draft; no bike-record creation exists in this piece (that's server piece 9's contract, out of scope here).
3. The bike box is optional — **met**. No required attribute, no Continue check on it; `draft.test.js` and `problem-screen.test.js` both leave it empty without failing Continue.
4. Choice questions are pills plus "Or tell us in your own words" — **met**. `PillGroup` plus a `Textarea`; `pillChange`/`pillValue`/`setAnswer` in `problem-rules.ts` treat a tap, words, or both as an answer, tested by `problem-rules.test.js`'s `setAnswer` cases and `problem-screen.test.js`'s "a tap, words, or both are saved" case.
5. Question wording is the shop's — **met**. `questionLabel` returns `q.wording` verbatim, appending " (optional)" only when not required, tested by `problem-rules.test.js`. The demo-data note ("test and demo data use that style") is **not applicable**: no demo data with questions exists in this repo to update, so there was nothing to change; only test fixtures carry question wording, and they already follow the one-question-per-service style.
6. Photos only, optional, up to 5, memory only — **met**. `PhotoPicker` wired to `useDraft().photos` (never written to the draft itself); `hadPhotos` flag and `photosCleared` cover the refresh message, tested by `problem-screen.test.js`'s photo cases and `problem-rules.test.js`'s `photosCleared` cases.
7. Description required only for "Not sure" — **met**. `descriptionError` in `problem-rules.ts`, tested directly and via `problem-screen.test.js`'s "Not sure with no description" case.

**The screen** (`problem`, `/book/:shopSlug/problem`) — **met**: step 2, back link (`services` when ticked, first screen for "Not sure"), heading "Tell us about your bike", "Continue" action; bike box, question groups in list order with per-service headings, choice/text question layout, description label switching on `notSure`, photo picker with the drop-off line, in the spec's order. Proven by `problem-screen.test.js`'s layout tests ("a heading per ticked service...", "Not sure: no questions...", "services ticked but no questions..."). Continue's checks (missing-answer messages, description message, pinned summary, focus movement, navigation to `date` on success) are **met**, proven by the "Continue with required questions unanswered", "Not sure with no description", "a good Continue goes to the date screen" and "pressing Continue twice" cases. "A service with no questions shows no heading" is **met** (the `questionGroups` filter), proven by the same heading-per-service test.

**Draft changes** — **met**. `BookingDraft.bikeNote?: string` replaces `bike`; `hadPhotos?: boolean` added; `Answer` is `{serviceId, questionId, choice?, text?, notSure?}`, proven by `draft.test.js`'s shape/round-trip tests (decision 9: red was `npm run typecheck`, not a failing assertion, since the change is type-only). `hasProblem(draft, services)` is **met and tested but not applied** as the spec says — it exists in `require-draft.tsx`, exported, tested by `require-draft.test.js`'s four `hasProblem` cases, and is not yet wrapped around any screen (that's d4's task, per decision 11 and the amended STATUS note on ordering `RequireDraft` after `/services` loads).

**Rules** (`src/screens/book/problem-rules.ts`) — **met**. All five pure functions listed in the spec exist with matching names and behaviour (`questionGroups`, `setAnswer`, `missingAnswers`, `descriptionError`, `photosCleared`), each covered by its own `problem-rules.test.js` cases, and `problem.tsx` calls only these plus small local helpers (`findAnswer`, `pillOptions`, `pillValue`, `pillChange`, `questionLabel`) that wrap them for display — the screen holds no independent logic of its own.

**Tests** — **met**. All five files named in the spec exist and run: `problem-rules.test.js`, `problem-screen.test.js`, `require-draft.test.js` (the `hasProblem` cases), `draft.test.js` (the new shape), `tests/browser/book-problem.spec.ts` (the on-screen-keyboard imitation, moved here from d2 per decision log entry in d2's own plan). `npm test` reports 980 passed, 0 failed; `npm run test:browser` reports 5 passed, 0 failed, including `book-problem.spec.ts`.

**Changed:** the choice-answer rule gained the "stale choice" clause (decision 13 above) — not in the original spec text, added during the build because the spec's `answered()` semantics were silent on a shop editing choices after the customer answers.

**Dropped:** none.

**Known follow-ups, not required by the spec but noted for later:** a pill question's "Please answer" message is not linked to the `PillGroup` for screen readers (would need a `PillGroup` prop to accept `aria-describedby`/an error id); required text questions' `Textarea` carries `aria-invalid` but not `aria-required`.
