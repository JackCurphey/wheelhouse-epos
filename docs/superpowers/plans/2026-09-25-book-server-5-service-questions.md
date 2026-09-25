# Book server piece 5: service questions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff can give each workshop service a list of questions; the customer service list carries them; an online booking stores a frozen copy of the answers, shown on the staff job view and the private link.

**Architecture:** One pure module, `server/service-questions.js`, does both checks: the staff list (`readServiceQuestions`) and the customer's answers (`checkAnswers`). The routes in `server/server.js` call it and store JSONB: `workshop_services.questions` (the live list) and `workshop_jobs.question_answers` (the frozen copy), added by migration 028.

**Tech Stack:** Node (ES modules), plain `node:test`, Postgres via `server/db.js` (`db.prepare(sql).get/all/run` with `?` placeholders; `pg` returns JSONB already parsed).

**Spec:** `docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md`

## Global Constraints

- Two kinds only: `'text'` and `'choice'`. Yes/no is a two-choice list.
- `required` defaults to false. `allowNotSure` exists only on choice questions and defaults to true.
- Limits: up to 10 questions per service; wording up to 200 characters; a choice question has 2 to 10 choices, each up to 100 characters; a text answer up to 1,000 characters.
- A question's id is given by the server. An id sent by staff is kept only if it already belongs to that service's stored list.
- Stored question: `{ id, wording, kind, required, choices?, allowNotSure? }`. Frozen answer: `{ id, wording, kind, answer }`, where `answer` is the text, the chosen option's wording, `{ notSure: true }`, or `null`.
- `question_answers` is null for "not sure" bookings, staff-made jobs and older bookings.
- "Questions changed" message, exact: `The questions for this service have changed — please check them and try again` (with an em dash).
- Answers are checked before any database write: after the service lookup, before the guest branch.
- The private-link test file must stay under 30 lookups (it has 13 today). Guest bookings are limited to 5 per hour per IP, so successful bookings in tests are made signed in. Refused guest bookings stop before the limiter, so they don't count against it.
- The `/api/workshop-services` routes keep their `// screens: services, service-edit` line directly above each `route(`.
- Test command: `npm test` (it runs `vite build` first). A single file: `node --test tests/<file>.test.js`. Postgres must be up on 5433.
- Commit to branch `feat/book-server-5-service-questions` only. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Files

- Create `server/migrations/028_service_questions.sql`, with test `tests/migration-028.test.js`.
- Create `server/service-questions.js` (pure; imports only `node:crypto`), with test `tests/service-questions.test.js`.
- Modify `server/server.js`:
  - `serializeWorkshopService` (~3933)
  - the POST and PUT service routes (~4008, ~4028)
  - the portal service list (~4432)
  - the booking route (~4565)
  - `createWorkshopJob` (~2655)
  - `serializeWorkshopJob` (~2366)
  - the private-link read-back (~4749)
- Create `tests/service-questions-api.test.js` (staff routes) and `tests/portal-booking-answers.test.js` (booking and staff job view).
- Modify tests whose exact-shape checks gain a field: `tests/workshopServices.test.js:63`, `tests/portal-service-list.test.js:109`, and the first test in `tests/portal-booking-link.test.js`.

---

### Task 1: Migration 028

**Files:**
- Create: `server/migrations/028_service_questions.sql`
- Test: `tests/migration-028.test.js`

**Interfaces:**
- Produces: `workshop_services.questions JSONB NOT NULL DEFAULT '[]'` and `workshop_jobs.question_answers JSONB` (nullable).

- [ ] **Step 1: Write the failing test** — `tests/migration-028.test.js`:

```js
// Migration 028: a service's questions, and the frozen answers on a booking.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const column = async (table, name) => (await pool.query(
  'SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
  [table, name]
)).rows[0];

test('workshop_services.questions is jsonb, not null, defaulting to an empty list', async () => {
  const c = await column('workshop_services', 'questions');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'jsonb');
  assert.equal(c.is_nullable, 'NO');
  assert.match(c.column_default, /'\[\]'::jsonb/);
});

test('workshop_jobs.question_answers is nullable jsonb', async () => {
  const c = await column('workshop_jobs', 'question_answers');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'jsonb');
  assert.equal(c.is_nullable, 'YES');
});

test('a service inserted without questions has an empty list', async () => {
  const row = await runWithShop(owner.shop.id, async () => {
    const { lastInsertRowid } = await prepare(
      "INSERT INTO workshop_services (name, price, updated_at) VALUES ('Plain', 10, now())"
    ).run();
    return prepare('SELECT questions FROM workshop_services WHERE id = ?').get(lastInsertRowid);
  });
  assert.deepEqual(row.questions, []);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/migration-028.test.js`
Expected: FAIL with `column missing` on both column tests. The insert test fails with `column "questions" does not exist`.

- [ ] **Step 3: Write the migration** — `server/migrations/028_service_questions.sql`:

```sql
-- Service questions (piece 5). A service's questions are one ordered list, saved
-- whole by staff. A booking keeps a frozen copy of each question's wording as
-- asked, plus the answer, so later edits to the service never change it (as
-- booked_price, 026). Null on "not sure" bookings, staff jobs and older bookings.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
ALTER TABLE workshop_services
  ADD COLUMN questions JSONB NOT NULL DEFAULT '[]';

ALTER TABLE workshop_jobs
  ADD COLUMN question_answers JSONB;
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/migration-028.test.js`
Expected: 3 pass. (Migrations run when the live server starts; confirm this in `server/migrations/run-migrations.js` if the columns are still missing.)

- [ ] **Step 5: Commit**

```bash
git add server/migrations/028_service_questions.sql tests/migration-028.test.js
git commit -m "feat: migration 028 - service questions and frozen booking answers"
```

---

### Task 2: `readServiceQuestions` — checking a staff question list

**Files:**
- Create: `server/service-questions.js`
- Test: `tests/service-questions.test.js`

**Interfaces:**
- Produces: `readServiceQuestions(input: unknown, stored: Question[] = []) => { value: Question[] } | { error: string }`, where `Question = { id: string, wording: string, kind: 'text'|'choice', required: boolean, choices?: string[], allowNotSure?: boolean }`. A new id matches `/^q_[0-9a-f]{12}$/`. Also exports `MAX_ANSWER = 1000`.

- [ ] **Step 1: Write the failing tests** — `tests/service-questions.test.js`:

```js
// Service questions, checked without a server: the staff list and the
// customer's answers.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readServiceQuestions } from '../server/service-questions.js';

const ID = /^q_[0-9a-f]{12}$/;
const text = (over = {}) => ({ wording: 'What is wrong?', kind: 'text', ...over });
const choice = (over = {}) => ({ wording: 'E-bike?', kind: 'choice', choices: ['Yes', 'No'], ...over });

test('a list is kept in order, trimmed, with new ids and defaults', () => {
  const r = readServiceQuestions([text({ wording: '  What is wrong?  ' }), choice()]);
  assert.ok(r.value, r.error);
  assert.equal(r.value.length, 2);
  assert.match(r.value[0].id, ID);
  assert.match(r.value[1].id, ID);
  assert.notEqual(r.value[0].id, r.value[1].id);
  assert.deepEqual({ ...r.value[0], id: 'x' }, { id: 'x', wording: 'What is wrong?', kind: 'text', required: false });
  assert.deepEqual({ ...r.value[1], id: 'x' },
    { id: 'x', wording: 'E-bike?', kind: 'choice', required: false, choices: ['Yes', 'No'], allowNotSure: true });
});

test('required and allowNotSure are taken when given', () => {
  const r = readServiceQuestions([choice({ required: true, allowNotSure: false })]);
  assert.equal(r.value[0].required, true);
  assert.equal(r.value[0].allowNotSure, false);
});

test('a text question drops choices and allowNotSure', () => {
  const r = readServiceQuestions([text({ choices: ['a', 'b'], allowNotSure: true })]);
  assert.deepEqual(Object.keys(r.value[0]).sort(), ['id', 'kind', 'required', 'wording']);
});

test('an id already stored on this service is kept; any other id is replaced', () => {
  const stored = [{ id: 'q_aaaaaaaaaaaa', wording: 'Old', kind: 'text', required: false }];
  const r = readServiceQuestions([text({ id: 'q_aaaaaaaaaaaa', wording: 'Reworded' }), text({ id: 'q_bbbbbbbbbbbb' })], stored);
  assert.equal(r.value[0].id, 'q_aaaaaaaaaaaa');
  assert.equal(r.value[0].wording, 'Reworded');
  assert.notEqual(r.value[1].id, 'q_bbbbbbbbbbbb');
  assert.match(r.value[1].id, ID);
});

test('a stored id sent twice is kept only once', () => {
  const stored = [{ id: 'q_aaaaaaaaaaaa', wording: 'Old', kind: 'text', required: false }];
  const r = readServiceQuestions([text({ id: 'q_aaaaaaaaaaaa' }), text({ id: 'q_aaaaaaaaaaaa' })], stored);
  assert.equal(r.value[0].id, 'q_aaaaaaaaaaaa');
  assert.notEqual(r.value[1].id, 'q_aaaaaaaaaaaa');
});

test('an empty list is allowed', () => {
  assert.deepEqual(readServiceQuestions([]), { value: [] });
});

const refuses = (input, pattern) => {
  const r = readServiceQuestions(input);
  assert.ok(r.error, `expected a refusal, got ${JSON.stringify(r)}`);
  assert.match(r.error, pattern);
};

test('not a list is refused', () => refuses({}, /must be a list/));
test('more than 10 questions is refused', () =>
  refuses(Array.from({ length: 11 }, () => text()), /up to 10 questions/));
test('10 questions are allowed', () =>
  assert.ok(readServiceQuestions(Array.from({ length: 10 }, () => text())).value));
test('missing wording is refused', () => refuses([text({ wording: '   ' })], /needs wording/));
test('wording over 200 characters is refused', () => refuses([text({ wording: 'x'.repeat(201) })], /200 characters/));
test('wording of exactly 200 characters is allowed', () =>
  assert.ok(readServiceQuestions([text({ wording: 'x'.repeat(200) })]).value));
test('an unknown kind is refused', () => refuses([text({ kind: 'photo' })], /free text or a choice/));
test('a choice question with one choice is refused', () => refuses([choice({ choices: ['Yes'] })], /2 to 10 choices/));
test('a choice question with 11 choices is refused', () =>
  refuses([choice({ choices: Array.from({ length: 11 }, (_, i) => `c${i}`) })], /2 to 10 choices/));
test('a choice question without a choices list is refused', () => refuses([choice({ choices: undefined })], /2 to 10 choices/));
test('an empty choice is refused', () => refuses([choice({ choices: ['Yes', ' '] })], /100 characters/));
test('a choice over 100 characters is refused', () => refuses([choice({ choices: ['Yes', 'x'.repeat(101)] })], /100 characters/));
test('duplicate choices are refused, ignoring case and spaces', () =>
  refuses([choice({ choices: ['Yes', ' yes '] })], /repeat a choice/));
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/service-questions.test.js`
Expected: FAIL with `Cannot find module '.../server/service-questions.js'`.

- [ ] **Step 3: Write the module** — `server/service-questions.js`:

```js
// Service questions (book screen 03, staff screen 66). Pure: no database, no
// request object. Staff save a service's whole list at once through
// readServiceQuestions; a booking's answers go through checkAnswers, which
// returns the frozen copy the booking stores.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import { randomBytes } from 'node:crypto';

export const MAX_QUESTIONS = 10;
export const MAX_WORDING = 200;
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 10;
export const MAX_CHOICE = 100;
export const MAX_ANSWER = 1000;

const newQuestionId = () => `q_${randomBytes(6).toString('hex')}`;
const trimmed = (v) => (typeof v === 'string' ? v.trim() : '');

// `stored` is the service's current list ([] for a new service). An id the
// caller sends is kept only when it is already one of this service's, so a
// reworded question stays the same question and nobody can pick their own ids.
export function readServiceQuestions(input, stored = []) {
  if (!Array.isArray(input)) return { error: 'Questions must be a list' };
  if (input.length > MAX_QUESTIONS) return { error: `A service can have up to ${MAX_QUESTIONS} questions` };
  const storedIds = new Set(stored.map((q) => q.id));
  const used = new Set();
  const value = [];
  for (const q of input) {
    const wording = trimmed(q?.wording);
    if (!wording) return { error: 'Every question needs wording' };
    if (wording.length > MAX_WORDING) return { error: `A question can be up to ${MAX_WORDING} characters` };
    if (q.kind !== 'text' && q.kind !== 'choice') return { error: 'A question must be free text or a choice from a list' };
    const id = typeof q.id === 'string' && storedIds.has(q.id) && !used.has(q.id) ? q.id : newQuestionId();
    used.add(id);
    const item = { id, wording, kind: q.kind, required: q.required === true };
    if (q.kind === 'choice') {
      if (!Array.isArray(q.choices) || q.choices.length < MIN_CHOICES || q.choices.length > MAX_CHOICES) {
        return { error: `A list question needs ${MIN_CHOICES} to ${MAX_CHOICES} choices` };
      }
      const choices = q.choices.map(trimmed);
      if (choices.some((c) => !c || c.length > MAX_CHOICE)) {
        return { error: `Each choice needs wording, up to ${MAX_CHOICE} characters` };
      }
      if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) {
        return { error: 'A list question cannot repeat a choice' };
      }
      item.choices = choices;
      // "I'm not sure" is on unless the shop switches it off.
      item.allowNotSure = q.allowNotSure !== false;
    }
    value.push(item);
  }
  return { value };
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `node --test tests/service-questions.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/service-questions.js tests/service-questions.test.js
git commit -m "feat: check a service's question list"
```

---

### Task 3: `checkAnswers` — checking a booking's answers

**Files:**
- Modify: `server/service-questions.js`
- Test: `tests/service-questions.test.js`

**Interfaces:**
- Consumes: the `Question` shape from Task 2.
- Produces:
  - `checkAnswers(questions: Question[], answers: unknown) => { value: FrozenAnswer[] } | { error: string }`, where `FrozenAnswer = { id, wording, kind, answer: string | { notSure: true } | null }`, in the service's question order.
  - `QUESTIONS_CHANGED` (the exact message string).

- [ ] **Step 1: Add the failing tests** — append to `tests/service-questions.test.js`. Also add `checkAnswers, QUESTIONS_CHANGED` to its import line:

```js
const Q = [
  { id: 'q_000000000001', wording: 'What is wrong?', kind: 'text', required: true },
  { id: 'q_000000000002', wording: 'E-bike?', kind: 'choice', required: false, choices: ['Yes', 'No'], allowNotSure: true },
  { id: 'q_000000000003', wording: 'Tubeless?', kind: 'choice', required: true, choices: ['Yes', 'No'], allowNotSure: false },
];
const good = [
  { questionId: 'q_000000000001', text: '  Squeaks  ' },
  { questionId: 'q_000000000003', choice: 'No' },
];

test('answers become a frozen copy in question order, skipped optional as null', () => {
  assert.deepEqual(checkAnswers(Q, [...good].reverse()), {
    value: [
      { id: 'q_000000000001', wording: 'What is wrong?', kind: 'text', answer: 'Squeaks' },
      { id: 'q_000000000002', wording: 'E-bike?', kind: 'choice', answer: null },
      { id: 'q_000000000003', wording: 'Tubeless?', kind: 'choice', answer: 'No' },
    ],
  });
});

test('not sure is stored as { notSure: true } and answers a required question', () => {
  const qs = [{ ...Q[1], required: true }];
  assert.deepEqual(checkAnswers(qs, [{ questionId: 'q_000000000002', notSure: true }]).value[0].answer, { notSure: true });
});

test('a service with no questions and no answers gives an empty copy', () => {
  assert.deepEqual(checkAnswers([], undefined), { value: [] });
});

test('a blank text answer to an optional question is stored as null', () => {
  const qs = [{ ...Q[0], required: false }];
  assert.equal(checkAnswers(qs, [{ questionId: 'q_000000000001', text: '   ' }]).value[0].answer, null);
});

const refused = (answers, pattern, qs = Q) => {
  const r = checkAnswers(qs, answers);
  assert.ok(r.error, `expected a refusal, got ${JSON.stringify(r)}`);
  assert.match(r.error, pattern);
};

test('the changed message is exact', () =>
  assert.equal(QUESTIONS_CHANGED, 'The questions for this service have changed — please check them and try again'));
test('answers that are not a list are refused', () => refused({}, /must be a list/));
test('a missing required answer is refused, naming the question', () =>
  refused([good[1]], /^Please answer: What is wrong\?$/));
test('a blank answer to a required text question is refused', () =>
  refused([{ questionId: 'q_000000000001', text: ' ' }, good[1]], /Please answer: What is wrong/));
test('an unknown question id is refused as changed', () =>
  refused([...good, { questionId: 'q_gone00000000', text: 'x' }], /questions for this service have changed/));
test('a choice not on the list is refused as changed', () =>
  refused([good[0], { questionId: 'q_000000000003', choice: 'Maybe' }], /have changed/));
test('not sure where it is switched off is refused as changed', () =>
  refused([good[0], { questionId: 'q_000000000003', notSure: true }], /have changed/));
test('not sure on a text question is refused as changed', () =>
  refused([{ questionId: 'q_000000000001', notSure: true }, good[1]], /have changed/));
test('text sent for a choice question is refused as changed', () =>
  refused([good[0], { questionId: 'q_000000000003', text: 'No' }], /have changed/));
test('a text answer over 1,000 characters is refused', () =>
  refused([{ questionId: 'q_000000000001', text: 'x'.repeat(1001) }, good[1]], /1,000 characters/));
test('a text answer of exactly 1,000 characters is allowed', () =>
  assert.ok(checkAnswers(Q, [{ questionId: 'q_000000000001', text: 'x'.repeat(1000) }, good[1]]).value));
test('the same question answered twice is refused', () =>
  refused([...good, good[0]], /answered only once/));
test('an answer without a question id is refused', () => refused([{ text: 'x' }], /needs a question/));
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/service-questions.test.js`
Expected: the new tests fail with `checkAnswers is not a function` (or an import error about `checkAnswers`). Task 2's tests still pass.

- [ ] **Step 3: Implement** — append to `server/service-questions.js`:

```js
export const QUESTIONS_CHANGED = 'The questions for this service have changed — please check them and try again';

// `questions` is the service's current list; `answers` is what the customer
// sent: [{ questionId, text } | { questionId, choice } | { questionId, notSure: true }].
// Answers are matched by id. An answer the current list cannot take (the
// question is gone, a choice was reworded, not sure was switched off) means
// the customer answered an older version, so the booking is refused as changed.
// Returns the frozen copy: every question in order, wording as asked, the
// answer or null.
export function checkAnswers(questions, answers) {
  const list = answers === undefined || answers === null ? [] : answers;
  if (!Array.isArray(list)) return { error: 'Answers must be a list' };
  const byId = new Map(questions.map((q) => [q.id, q]));
  const given = new Map();
  for (const a of list) {
    if (typeof a?.questionId !== 'string') return { error: 'Each answer needs a question' };
    const q = byId.get(a.questionId);
    if (!q) return { error: QUESTIONS_CHANGED };
    if (given.has(q.id)) return { error: 'Each question can be answered only once' };
    let answer;
    if (a.notSure === true) {
      if (q.kind !== 'choice' || !q.allowNotSure) return { error: QUESTIONS_CHANGED };
      answer = { notSure: true };
    } else if (q.kind === 'text') {
      if (typeof a.text !== 'string') return { error: QUESTIONS_CHANGED };
      const text = a.text.trim();
      if (text.length > MAX_ANSWER) return { error: 'An answer can be up to 1,000 characters' };
      answer = text || null;
    } else {
      if (typeof a.choice !== 'string' || !q.choices.includes(a.choice)) return { error: QUESTIONS_CHANGED };
      answer = a.choice;
    }
    given.set(q.id, answer);
  }
  const value = [];
  for (const q of questions) {
    const answer = given.has(q.id) ? given.get(q.id) : null;
    if (q.required && answer === null) return { error: `Please answer: ${q.wording}` };
    value.push({ id: q.id, wording: q.wording, kind: q.kind, answer });
  }
  return { value };
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `node --test tests/service-questions.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/service-questions.js tests/service-questions.test.js
git commit -m "feat: check a booking's answers against the service's questions"
```

---

### Task 4: Staff service routes take and return questions

**Files:**
- Modify: `server/server.js` — import near the `booking-request.js` import; `serializeWorkshopService` (~3933); POST (~4008) and PUT (~4028) `/api/workshop-services`.
- Create: `tests/service-questions-api.test.js`
- Modify: `tests/workshopServices.test.js:63` (the `deepEqual` gains `questions: []`).

**Interfaces:**
- Consumes: `readServiceQuestions` (Task 2).
- Produces: `serializeWorkshopService(row).questions: Question[]`, plus a local helper `readQuestionsOrKeep(body, stored)` in server.js.

- [ ] **Step 1: Write the failing tests** — `tests/service-questions-api.test.js`:

```js
// Staff set a service's questions through the service routes.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const BASE = { name: 'Brake bleed', price: 30, minutes: 45 };
const create = (body) => as('/api/workshop-services', { method: 'POST', body: { ...BASE, ...body } });
const update = (id, body) => as(`/api/workshop-services/${id}`, { method: 'PUT', body: { ...BASE, ...body } });
const listed = async (id) => (await as('/api/workshop-services')).body.find((s) => s.id === id);

const Q = [
  { wording: 'Which brakes?', kind: 'choice', choices: ['Front', 'Rear', 'Both'], required: true },
  { wording: 'Anything else?', kind: 'text' },
];

test('a new service without questions has an empty list', async () => {
  const res = await create({});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.questions, []);
});

test('questions save in order with ids and come back from the list', async () => {
  const res = await create({ questions: Q });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.questions.map((q) => q.wording), ['Which brakes?', 'Anything else?']);
  for (const q of res.body.questions) assert.match(q.id, /^q_[0-9a-f]{12}$/);
  assert.equal(res.body.questions[0].allowNotSure, true);
  assert.deepEqual((await listed(res.body.id)).questions, res.body.questions);
});

test('rewording a question keeps its id; a new question gets a new one', async () => {
  const made = (await create({ questions: Q })).body;
  const [first] = made.questions;
  const res = await update(made.id, { questions: [{ ...first, wording: 'Which brake?' }, { wording: 'New', kind: 'text' }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.questions[0].id, first.id);
  assert.equal(res.body.questions[0].wording, 'Which brake?');
  assert.ok(!made.questions.some((q) => q.id === res.body.questions[1].id));
});

test('an id from another service is not taken', async () => {
  const a = (await create({ questions: Q })).body;
  const b = (await create({})).body;
  const res = await update(b.id, { questions: [{ ...a.questions[1] }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.notEqual(res.body.questions[0].id, a.questions[1].id);
});

test('a PUT without questions keeps the stored list', async () => {
  const made = (await create({ questions: Q })).body;
  const res = await update(made.id, { name: 'Renamed' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.questions, made.questions);
});

test('a PUT with an empty list removes every question', async () => {
  const made = (await create({ questions: Q })).body;
  const res = await update(made.id, { questions: [] });
  assert.deepEqual(res.body.questions, []);
});

test('a bad list is refused with a plain message and nothing changes', async () => {
  const made = (await create({ questions: Q })).body;
  const res = await update(made.id, { name: 'Changed', questions: [{ wording: 'Only one', kind: 'choice', choices: ['Yes'] }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /2 to 10 choices/);
  const after = await listed(made.id);
  assert.equal(after.name, 'Brake bleed');
  assert.deepEqual(after.questions, made.questions);
});

test('a bad list on a new service is refused', async () => {
  const res = await create({ questions: [{ wording: '', kind: 'text' }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /needs wording/);
});
```

The complete list of refusal rules is covered in `tests/service-questions.test.js`. These two cases prove the route passes a refusal through.

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/service-questions-api.test.js`
Expected: FAIL. `res.body.questions` is `undefined`, and the bad-list PUT returns 200.

- [ ] **Step 3: Implement** in `server/server.js`:

Next to the existing `import { parseBookingRequest } ...` line:

```js
import { readServiceQuestions, checkAnswers } from './service-questions.js';
```

In `serializeWorkshopService`, after `position: row.position,`:

```js
    // Ordered; each { id, wording, kind, required, choices?, allowNotSure? }.
    // See server/service-questions.js and migration 028.
    questions: row.questions ?? [],
```

After `readServicePlacement`:

```js
// A service's questions, saved as one whole list. Omitted on PUT keeps the
// stored list, like the placement fields above.
function readQuestionsOrKeep(body, stored) {
  if (body.questions === undefined) return stored;
  const r = readServiceQuestions(body.questions, stored);
  if (r.error) throw new ValidationError(r.error);
  return r.value;
}
```

POST route: declare `let questions;`. Inside the `try`, add `questions = readQuestionsOrKeep(body, []);`. Change the insert to:

```js
  const info = await db.prepare(
    'INSERT INTO workshop_services (name, price, minutes, bookable_online, kind, category_id, position, questions) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb))'
  ).run(fields.name, fields.price, fields.minutes, bookableOnline, placement.kind, placement.categoryId, placement.position, JSON.stringify(questions));
```

PUT route: declare `let questions;`. Inside the `try`, add `questions = readQuestionsOrKeep(body, existing.questions ?? []);`. Change the update to:

```js
  await db.prepare(
    'UPDATE workshop_services SET name = ?, price = ?, minutes = ?, active = ?, bookable_online = ?, kind = ?, category_id = ?, position = ?, questions = CAST(? AS jsonb), updated_at = ? WHERE id = ?'
  ).run(fields.name, fields.price, fields.minutes, active, bookableOnline,
    placement.kind, placement.categoryId, placement.position, JSON.stringify(questions), nowIso(), id);
```

Leave every `// screens: services, service-edit` line as it is, directly above its `route(`.

In `tests/workshopServices.test.js` around line 63, add `questions: []` to the expected object. If the fake `row` there has no `questions` field, `?? []` supplies it.

- [ ] **Step 4: Run them and watch them pass**

Run: `node --test tests/service-questions-api.test.js tests/workshopServices.test.js tests/workshopServicesApi.test.js tests/workshop-service-placement.test.js && node scripts/ci/assert-screen-trace.mjs`
Expected: all pass, and screen-trace exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/server.js tests/service-questions-api.test.js tests/workshopServices.test.js
git commit -m "feat: staff service routes take and return questions"
```

---

### Task 5: The customer service list carries questions

**Files:**
- Modify: `server/server.js`, `GET /api/portal/:shopSlug/services` (~4432)
- Modify: `tests/portal-service-list.test.js` (new test, plus the keys assertion at :109)

**Interfaces:**
- Consumes: the stored `workshop_services.questions` (Task 4 writes it).
- Produces: each public service is `{ id, name, price, minutes, questions }`.

- [ ] **Step 1: Write the failing test** — add to `tests/portal-service-list.test.js`. At line 109, also change the expected keys to `['id', 'minutes', 'name', 'price', 'questions']`:

```js
test('each service carries its questions; a staff-only service stays hidden', async () => {
  const shop = await staffSignup(server.baseUrl);
  try {
    const q = [{ wording: 'Which brakes?', kind: 'choice', choices: ['Front', 'Rear'], required: true }];
    const shown = await service(shop, { name: 'Bleed', questions: q });
    const hidden = await service(shop, { name: 'Staff bleed', bookableOnline: false, questions: q });
    const res = await publicList(shop);
    const found = [...res.body.full, ...res.body.uncategorised, ...res.body.categories.flatMap((c) => c.services)];
    assert.deepEqual(found.find((s) => s.id === shown.id).questions, shown.questions);
    assert.equal(found.find((s) => s.id === hidden.id), undefined);
  } finally {
    await deleteTestShop(shop.shop.id);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/portal-service-list.test.js`
Expected: the new test fails (`undefined` questions), and so does the keys test (the `questions` key is missing).

- [ ] **Step 3: Implement** — in the portal services route, add `questions` to the SELECT column list (`SELECT id, name, price, minutes, kind, category_id, questions FROM workshop_services ...`) and change `toPublic` to:

```js
  const toPublic = (s) => ({ id: s.id, name: s.name, price: showPrices ? s.price : null, minutes: s.minutes, questions: s.questions });
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/portal-service-list.test.js && node scripts/ci/assert-screen-trace.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/server.js tests/portal-service-list.test.js
git commit -m "feat: the customer service list carries each service's questions"
```

---

### Task 6: A booking checks its answers and stores the frozen copy

**Files:**
- Modify: `server/server.js`:
  - the booking route (~4565): add `questions` to the service SELECT, add the answers check, pass the result through
  - `createWorkshopJob` (~2655): a new `questionAnswers` parameter and column
- Create: `tests/portal-booking-answers.test.js`

**Interfaces:**
- Consumes: `checkAnswers`, `QUESTIONS_CHANGED` (Task 3); staff routes that save questions (Task 4).
- Produces: `workshop_jobs.question_answers`, written by `createWorkshopJob({ ..., questionAnswers })`. `questionAnswers` is a `FrozenAnswer[]`, or undefined/null, which stores NULL.

- [ ] **Step 1: Write the failing tests** — `tests/portal-booking-answers.test.js`:

```js
// A booking's answers to its service's questions: checked before anything is
// written, stored as a frozen copy.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
// Successful bookings are signed in; guest bookings are rate-limited per IP.
// Refused guest bookings stop before the limiter, so they don't count.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let customer;
let svc;

const QUESTIONS = [
  { wording: 'What is wrong?', kind: 'text', required: true },
  { wording: 'E-bike?', kind: 'choice', choices: ['Yes', 'No'] },
  { wording: 'Tubeless?', kind: 'choice', choices: ['Yes', 'No'], required: true, allowNotSure: false },
];

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const makeService = async (questions = QUESTIONS) => (await staff('/api/workshop-services', {
  method: 'POST', body: { name: 'Brake check', price: 20, minutes: 60, bookableOnline: true, questions },
})).body;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  svc = await makeService();
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

let day = 0;
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};
const GUEST = { guestName: 'Gina Guestname', guestPhone: '07700 900123', email: 'gina@example.com' };
const book = (body, { guest = false } = {}) => portalRequest(server.baseUrl, guest ? null : customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: {
    mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Brakes rub',
    newBike: { make: 'Dawes', model: 'Galaxy' }, serviceId: svc.id,
    ...BOOKING_CONTACT, ...(guest ? GUEST : {}), ...body,
  },
});
const idOf = (service, wording) => service.questions.find((q) => q.wording === wording).id;
const goodAnswers = (service = svc) => [
  { questionId: idOf(service, 'What is wrong?'), text: 'Rubs at the back' },
  { questionId: idOf(service, 'Tubeless?'), choice: 'No' },
];
const stored = async (jobId) => (await runWithShop(owner.shop.id, () => prepare(
  'SELECT question_answers FROM workshop_jobs WHERE id = ?'
).get(jobId))).question_answers;
const counts = () => runWithShop(owner.shop.id, () => prepare(
  'SELECT (SELECT count(*)::int FROM workshop_jobs) AS jobs, (SELECT count(*)::int FROM customers) AS customers'
).get());

test('good answers store a frozen copy in question order', async () => {
  const res = await book({ answers: goodAnswers() });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await stored(res.body.id), [
    { id: idOf(svc, 'What is wrong?'), wording: 'What is wrong?', kind: 'text', answer: 'Rubs at the back' },
    { id: idOf(svc, 'E-bike?'), wording: 'E-bike?', kind: 'choice', answer: null },
    { id: idOf(svc, 'Tubeless?'), wording: 'Tubeless?', kind: 'choice', answer: 'No' },
  ]);
});

test('not sure is stored as { notSure: true }', async () => {
  const res = await book({ answers: [...goodAnswers(), { questionId: idOf(svc, 'E-bike?'), notSure: true }] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual((await stored(res.body.id))[1].answer, { notSure: true });
});

test('rewording and then deleting the questions leaves the booking unchanged', async () => {
  const own = await makeService();
  const res = await book({ serviceId: own.id, answers: goodAnswers(own) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const before = await stored(res.body.id);
  const reworded = own.questions.map((q) => ({ ...q, wording: `${q.wording} (new)` }));
  const put = (questions) => staff(`/api/workshop-services/${own.id}`, {
    method: 'PUT', body: { name: own.name, price: 20, minutes: 60, questions },
  });
  assert.equal((await put(reworded)).status, 200);
  assert.deepEqual(await stored(res.body.id), before);
  assert.equal((await put([])).status, 200);
  assert.deepEqual(await stored(res.body.id), before);
});

test('a service with no questions stores an empty copy', async () => {
  const plain = await makeService([]);
  const res = await book({ serviceId: plain.id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await stored(res.body.id), []);
});

test('a not sure booking stores no answers', async () => {
  const res = await book({ serviceId: undefined, notSure: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(await stored(res.body.id), null);
});

// Each refusal is sent as a guest, so it would create a customer row if the
// check came too late. Refusals stop before the guest limiter.
const refusedAsGuest = async (body, pattern) => {
  const before = await counts();
  const res = await book(body, { guest: true });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, pattern);
  assert.deepEqual(await counts(), before);
};

test('a missing required answer is refused, leaving nothing behind', () =>
  refusedAsGuest({ answers: [goodAnswers()[1]] }, /^Please answer: What is wrong\?$/));
test('a choice not on the list is refused', () =>
  refusedAsGuest({ answers: [goodAnswers()[0], { questionId: idOf(svc, 'Tubeless?'), choice: 'Maybe' }] }, /have changed/));
test('not sure where it is switched off is refused', () =>
  refusedAsGuest({ answers: [goodAnswers()[0], { questionId: idOf(svc, 'Tubeless?'), notSure: true }] }, /have changed/));
test('a text answer over 1,000 characters is refused', () =>
  refusedAsGuest({ answers: [{ questionId: idOf(svc, 'What is wrong?'), text: 'x'.repeat(1001) }, goodAnswers()[1]] }, /1,000 characters/));
test('an unknown question id is refused with the changed message', () =>
  refusedAsGuest({ answers: [...goodAnswers(), { questionId: 'q_gone00000000', text: 'x' }] },
    /^The questions for this service have changed — please check them and try again$/));
test('answers on a not sure booking are refused', () =>
  refusedAsGuest({ serviceId: undefined, notSure: true, answers: goodAnswers() }, /chosen service/));
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/portal-booking-answers.test.js`
Expected:
- The storage tests fail because `question_answers` is `null`.
- The refusal tests fail with status 201 instead of 400.
- The not-sure-no-answers test passes already (null). That's expected: it guards against the change breaking not-sure bookings.

- [ ] **Step 3: Implement** in `server/server.js`.

In `createWorkshopJob`:
- Add `questionAnswers` to the destructured parameters.
- Add `question_answers` to the column list, after `customer_description`.
- Add `CAST(? AS jsonb)` to the VALUES, after the `customer_description` `?`.
- Add this argument after `customerDescription ?? null`:

```js
        questionAnswers ? JSON.stringify(questionAnswers) : null,
```

In the booking route:

1. Right after `const request = parsed.value;` and before the `jobDate` check:

```js
  // Answers belong to a chosen service's questions; "not sure" has none.
  if (request.notSure && Array.isArray(body.answers) && body.answers.length > 0) {
    return badRequest(res, 'Answers can only be given for a chosen service');
  }
```

2. Change the service lookup SELECT to `'SELECT id, name, minutes, questions FROM workshop_services WHERE id = ? AND active = 1 AND bookable_online = 1'`.

3. Right after the `chosen` block (after `if (!chosen) return badRequest(...)` and the closing `}`), before the guest-branch comment:

```js
  // The customer's answers, checked against the service's questions as they are
  // now, before the guest customer row - the first write. A frozen copy goes on
  // the job so later edits to the questions never change this booking.
  let questionAnswers = null;
  if (!request.notSure) {
    const checked = checkAnswers(chosen.questions ?? [], body.answers);
    if (checked.error) return badRequest(res, checked.error);
    questionAnswers = checked.value;
  }
```

4. In the `createWorkshopJob({...})` call, after `customerDescription: description,` add `questionAnswers,`.

- [ ] **Step 4: Run them and watch them pass**

Run: `node --test tests/portal-booking-answers.test.js tests/portal-booking-request.test.js tests/portal-guest-customer.test.js tests/portal-dropoff-booking.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/server.js tests/portal-booking-answers.test.js
git commit -m "feat: a booking checks its answers and stores a frozen copy"
```

---

### Task 7: The staff job view and the private link show the answers

**Files:**
- Modify: `server/server.js`: `serializeWorkshopJob` (~2366) and the private-link read-back (~4749)
- Modify: `tests/portal-booking-answers.test.js` (a staff-view test), `tests/portal-booking-link.test.js` (add `answers: []` to the first test's `deepEqual`, plus one new test with one lookup, bringing the file to 14)

**Interfaces:**
- Consumes: `workshop_jobs.question_answers` (Task 6).
- Produces:
  - `serializeWorkshopJob(row).questionAnswers: FrozenAnswer[] | null`
  - The private-link response gains `answers: { wording, answer }[]` (`[]` when none).

- [ ] **Step 1: Write the failing tests**

Append to `tests/portal-booking-answers.test.js`:

```js
test('the staff job view shows the answers', async () => {
  const res = await book({ answers: goodAnswers() });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const job = await staff(`/api/workshop-jobs/${res.body.id}`);
  assert.equal(job.status, 200, JSON.stringify(job.body));
  assert.deepEqual(job.body.questionAnswers, await stored(res.body.id));
});
```

In `tests/portal-booking-link.test.js`, add `answers: [],` to the expected object in the first test ('a booking returns a private link...'). Its booking uses `types.service`, which has no questions. Then append:

```js
test('the link shows the questions as asked and the answers', async () => {
  const svc = (await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-services', {
    method: 'POST',
    body: {
      name: 'Asks', price: 10, minutes: 60, bookableOnline: true,
      questions: [{ wording: 'E-bike?', kind: 'choice', choices: ['Yes', 'No'] }, { wording: 'Notes?', kind: 'text' }],
    },
  })).body;
  const booked = await book({ serviceId: svc.id, answers: [{ questionId: svc.questions[0].id, notSure: true }] });
  const res = await read(codeOf(booked.privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.answers, [
    { wording: 'E-bike?', answer: { notSure: true } },
    { wording: 'Notes?', answer: null },
  ]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/portal-booking-answers.test.js tests/portal-booking-link.test.js`
Expected:
- The staff-view test fails because `questionAnswers` is `undefined`.
- The link tests fail because `answers` is missing.

Then count the private-link lookups: `grep -c "read(" tests/portal-booking-link.test.js` should print 14. It must stay under 30.

- [ ] **Step 3: Implement**

In `serializeWorkshopJob`, after `notes: row.notes,`, add:

```js
    // The customer's answers to the service's questions, frozen at booking
    // (migration 028). Null for staff jobs, "not sure" and older bookings.
    questionAnswers: row.question_answers ?? null,
```

In the private-link route:
- Add `w.question_answers` to the SELECT column list, after `w.customer_description`.
- Add to the response object, after `description`:

```js
    // As asked at booking, from the frozen copy - never the service's current wording.
    answers: (row.question_answers ?? []).map(({ wording, answer }) => ({ wording, answer })),
```

- [ ] **Step 4: Run them and watch them pass**

Run: `node --test tests/portal-booking-answers.test.js tests/portal-booking-link.test.js tests/booking-link-rate-limit.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/server.js tests/portal-booking-answers.test.js tests/portal-booking-link.test.js
git commit -m "feat: staff job view and private link show the booking's answers"
```

---

### Task 8: Full check, spec walk and STATUS

**Files:**
- Modify: `.agents/STATUS.md`, and this plan (a decision log and spec walk at the bottom)

- [ ] **Step 1: Run every gate against the current state**

```bash
npm test
npm run lint
npm run typecheck
node scripts/ci/assert-screen-trace.mjs
```

Expected: every command exits 0. Record the pass/fail counts from `npm test`. If anything fails, fix it (test first) before going on.

- [ ] **Step 2: Watch-it-fail check on the key guard.** Temporarily move the answers check in the booking route to after `resolveGuestCustomer`. Confirm with `git diff` that the move actually happened. Run `node --test tests/portal-booking-answers.test.js` and confirm the refusal tests fail on the `counts` assertion (a stray customer). Then restore with `git checkout server/server.js` and re-run the file to green.

- [ ] **Step 3: Append the decision log and spec walk to this plan.** Walk each spec section (decisions 1-10, storage, staff routes, customer list, booking, where answers appear, tests, out of scope). For each, say met / dropped / changed, with the task that did it.

- [ ] **Step 4: Update `.agents/STATUS.md`.** Piece 5 is built on this branch; migration 028; PR number once it's open; merging is Jack's call.

- [ ] **Step 5: Commit**

```bash
git add .agents/STATUS.md docs/superpowers/plans/2026-09-25-book-server-5-service-questions.md
git commit -m "docs: STATUS for piece 5; plan decision log and spec walk"
```

---

## Decision log (planning)

- **Missing required answer → `Please answer: <wording>`**, not the "questions changed" message. Decision 10 gives the changed message for "a new required one appeared". The server can't tell that apart from a skipped answer, and naming the question tells the customer what to do either way. Every other mismatch (unknown id, choice not on the list, not sure switched off, wrong kind) uses the exact decision-10 message. **Confirmed by Jack, 25 Sep (option 1).**
- **A service with no questions stores `[]`** on its bookings; `null` is kept for "not sure", staff jobs and older bookings, as the spec says.
- **Duplicate choices are compared ignoring case and surrounding spaces.**
- **"Not sure" with an empty `answers: []` is accepted.** Only a non-empty list is refused.
- **Question ids are `q_` plus 12 random hex characters.**

---

## Decision log (build)

- Ruling: T4 imports only `readServiceQuestions`; T6 adds `checkAnswers` to the same import line — avoids an unused import failing lint between tasks. Cost if wrong: none (one-line import change).
- Task 1: Ruling: reviewer flagged commit c59d495's `Co-Authored-By` naming Claude Haiku 4.5, not Opus 5.5 — kept as-is: it names the model that actually wrote the commit; fixing it means rewriting history. Cost if wrong: one trailer line differs on one commit.
- Ruling: Tasks 2 and 3 dispatched to one implementer and reviewed as one unit — same pure file and test file, complete code in the plan, no DB involved. Cost if wrong: one larger review diff.
- Task 6: Ruling: the plan-mandated rewording test passed vacuously (never asserted `before` was non-empty) — fixed to assert `before` equals the expected 3-item copy and that each PUT actually changed the stored questions; watched it fail with storage disabled first.

Deferred minors (not fixed in this piece):

- Task 2-3: `'An answer can be up to 1,000 characters'` is hardcoded in the message text, not interpolated from `MAX_ANSWER` (`server/service-questions.js`).
- Task 5: the new portal-service-list test compares against the staff route's echoed questions, not the literal input sent — an indirect check.
- Task 6: a "not sure" booking with malformed non-list `answers` (e.g. `"x"`, `{}`) is accepted and silently ignored (`server/server.js` ~4599).
- Task 6: `chosen.questions ?? []` is dead code — the `questions` column is `NOT NULL`, so the row always has a value.
- Task 6: no route-level test for a "not sure" customer answering a required choice, or a blank required text answer — covered only in the `checkAnswers` unit tests.
- Task 7: the private-link route's `(row.question_answers ?? []).map(...)` would throw on a non-array legacy value; none exist today because the column is new to this piece.

## Spec walk (2026-09-25-book-server-5-service-questions-design.md)

**Decision 1 — server side of both halves, no screens.** Met. Tasks 1-7 build storage, staff routes, the customer list and the booking route; no screen code was touched.

**Decision 2 — two kinds of question, yes/no as a two-choice list.** Met. `server/service-questions.js` (Task 2) defines `'text'` and `'choice'` only; there is no separate yes/no kind, as the spec asked.

**Decision 3 — required switch, off by default.** Met. Task 2's `readServiceQuestions` defaults `required` to `false`; Task 3/6's `checkAnswers` refuses a missing answer to a required question.

**Decision 4 — "I'm not sure" switch on choice questions, on by default.** Met. Task 2 defaults `allowNotSure` to `true` on choice questions only; Task 3 accepts `{ notSure: true }` as satisfying a required question when the switch is on.

**Decision 5 — the private link shows the questions and the customer's answers.** Met, Task 7: the private-link read-back gains `answers`.

**Decision 6 — one ordered list stored on the service; staff save the whole list at once.** Met. Task 1 adds `workshop_services.questions JSONB`; Task 4's staff `PUT`/`POST` take and return the whole ordered list.

**Decision 7 — frozen copy of answers on the booking.** Met, Task 6: `question_answers` is written in the same insert as the job, through `createWorkshopJob`, and is untouched by later edits to the service's questions (tested).

**Decision 8 — limits (10 questions, 200-char wording, 2-10 choices of up to 100 chars, 1,000-char text answer).** Met. Enforced in `readServiceQuestions` (Task 2) and `checkAnswers` (Task 3); every limit has a refusal test.

**Decision 9 — permanent hidden id, given by the server, kept across a reword.** Met. Task 2 assigns `q_` + 12 random hex characters; Task 4's staff routes keep a caller-sent id only if it already belongs to that service's stored list. Reword-keeps-id and delete-and-readd-gets-new-id are both tested.

**Decision 10 — mid-booking question changes matched by id, refused with the exact "changed" message.** Met, with one confirmed change: a *missing required answer* is refused with `Please answer: <wording>` rather than the "questions changed" copy, because the server cannot distinguish that case from a skipped answer, and naming the question is more useful to the customer either way. Every other mismatch (unknown id, choice not on the current list, `notSure` where switched off, wrong kind) uses the exact decision-10 message, confirmed by Jack 25 Sep (see decision log above). The required-answer message and the changed-message wording are both under test.

**Storage (migration 028).** Met, Task 1. `workshop_services.questions JSONB NOT NULL DEFAULT '[]'`; `workshop_jobs.question_answers JSONB` nullable. `question_answers` is `null` for "not sure" bookings, staff-made jobs and bookings made before this piece — confirmed directly: staff `questionAnswers` is `null` for jobs with no copy (Task 7), and a service with no questions stores `[]` (not `null`) on its own bookings, per the build decision log.

**Staff: `POST`/`PUT /api/workshop-services`, `GET` the service.** Met, Task 4. `questions` is taken and returned via `serializeWorkshopService`; a `PUT` omitting `questions` keeps the stored list. Validation refuses missing wording, unknown kind, out-of-range choice counts, duplicate choices, over 10 questions, and any length over its limit, each with its own test. The `// screens: services, service-edit` lines needed no change, as the spec predicted and Task 4 confirmed.

**Customer service list: `GET /api/portal/:shopSlug/services`.** Met, Task 5. Each service gains `questions` (`id`, `wording`, `kind`, `required`, `choices`, `allowNotSure`); the existing `active = 1 AND bookable_online = 1` filter is unchanged, so staff-only and retired services stay excluded (tested).

**Booking: `POST /api/portal/:shopSlug/bookings`.** Met, Task 6. `answers` is optional; the check runs right after the service lookup and before `resolveGuestCustomer` (the first write) — confirmed both by the code and by the Task 8 mutation test, which moved the check after `resolveGuestCustomer` and watched the refusal tests fail on a stray customer row, then restored to green. Every listed refusal (missing required answer, choice not on the list, `notSure` without the switch, text over the limit, unknown question id, answers on a `notSure` booking) is refused and leaves no job and no stray customer.

**Where answers appear.** Met, Task 7. `serializeWorkshopJob` gains `questionAnswers`; the private-link read-back gains `answers` as `{ wording, answer }` in order — confirmed directly: it shows `answers: []` when there are none, rather than omitting the field or returning `null`.

**Tests.** Met. Each task wrote its tests first (migration, staff validation and id assignment, `checkAnswers`/`readServiceQuestions` unit tests, customer-list inclusion, booking success/refusal/round-trip, staff job view and private link). `npm test` is 691/691 passing at the end of Task 8, including all of this piece's files.

**Out of scope.** Respected. No screen code (question editor, booking-page questions, staff answer display) was built; conditional questions and photo answers were not attempted; no reporting on answers was added.

**Constraint check.** The private-link test file stayed under the 30-lookup ceiling (grew from 13 to 14, per the ledger); guest booking tests that expect success sign in first so they don't count against the 5/hour/IP guest limiter; refused guest bookings stop before the limiter runs, so they don't count either.
