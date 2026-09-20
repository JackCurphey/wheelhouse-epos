# Phase 1 — Workshop State Machines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single free-for-all `workshop_jobs.status` with a set of small, independent state machines that name every legal transition — including the failure and race outcomes no screen shows — so Phase 2's schema is derived from an agreed model rather than from pictures.

**Architecture:** One plain-JS module declares each machine as data (`states`, `transitions`, `terminal`) and a tiny `defineMachine` helper turns that data into `can`, `next`, `events` and `describe`. The declarations are the single source of truth: Phase 2 generates its `CHECK` constraints from them, Phase 3 guards its endpoints with them, and a generator renders them to Markdown for humans, so the documentation cannot drift from the code. No state machine library — the whole helper is about forty lines, and `server/` has exactly one runtime dependency (`pg`) that this plan does not touch.

**Tech Stack:** Node ESM, `node:test`, `node:assert/strict`. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`](../specs/2026-09-20-release-1-screen-build-design.md) — Phase 1.

**Preceding phase:** [Phase 0](2026-09-20-phase-0-atlas-revision.md), merged as PR #54. The revised atlas is the behaviour these machines must support.

## Global Constraints

- **No new dependencies.** `server/` runs on `pg` alone. Do not add a state machine library, a schema validator or a diagram package.
- **`server/` is plain JavaScript ESM.** It is excluded from ESLint (`eslint.config.js` ignores `server/**`) and from `tsc`. Match the surrounding style: named exports, no build step, no TypeScript.
- **Test style matches the repo.** Every test file opens with a comment saying *why* the test exists and what would break without it, as `tests/db-transaction-scope.test.js` does. Tests are `node:test` with `node:assert/strict`.
- **These machines are pure.** No database, no network, no clock. A transition takes a state and an event and returns a state. Expiry is modelled as an *event* (`expire`), not as a machine that reads the time — so it can be tested without waiting and driven by a scheduler later.
- **Independence is the point.** Approval, physical custody, work completion and collection are separate facts, per the [scope decision](../../decisions/2026-09-10-release-1-scope-reduction.md). No machine may encode another's state. A cross-machine rule belongs in Task 7's invariants, not inside a machine.
- **Existing status names survive where they are still honest** (Jack's decision, 20 Sep): `pending` and `scheduled` become booking-request states; `waiting_parts` and `on_hold` become work states; `complete` **splits** into work `complete` and custody `collected`, which is the conflation this phase exists to break. Keep snake_case to match the database.
- **Phase 1 changes no schema and no endpoint.** It adds a module and its tests. `workshop_jobs.status` keeps working exactly as it does today; the mapping in Task 3 is a reading of the old column, not a migration of it. Migrations are Phase 2.
- **Canonical commands** (the suite needs the compose Postgres up — `npm run docker:up` — or it hangs with no output):

```sh
node --test tests/workshop-states.test.js
npm test && npm run typecheck && npm run lint && npm run build
node server/workshop/render-states.mjs
```

## File Structure

| File | Responsibility | This plan |
|---|---|---|
| `server/workshop/state-machines.js` | `defineMachine`, and every machine declaration. The single source of truth. | **Create** |
| `server/workshop/render-states.mjs` | Renders the declarations to Markdown. Generated output, never hand-edited. | **Create** (Task 8) |
| `docs/design/workshop-states.md` | The generated human-readable reference. | **Generated** (Task 8) |
| `tests/workshop-states.test.js` | Table-driven transition tests, one section per machine. | **Create** |
| `tests/workshop-state-invariants.test.js` | Cross-machine rules: the facts that must stay independent. | **Create** (Task 7) |
| `server/server.js` | Existing `JOB_STATUSES` at line 2330. | **Read only this phase** |

---

### Task 1: `defineMachine`, and custody as the first machine

Custody first because it is the smallest honest machine and it carries the split that matters: a bike being finished and a bike being collected are different facts.

**Files:**
- Create: `server/workshop/state-machines.js`
- Create: `tests/workshop-states.test.js`

**Interfaces:**
- Produces: `defineMachine({name, initial, states, transitions, terminal})` returning `{name, initial, states, terminal, can(from, event), next(from, event), events(from), describe()}`. `next` throws on an illegal transition. Every later task adds a machine using this helper and relies on those exact method names.
- Produces: `custody`, with states `expected`, `in_shop`, `collected`.

- [ ] **Step 1: Write the failing test**

Create `tests/workshop-states.test.js`:

```js
// tests/workshop-states.test.js
//
// The workshop's state machines. These exist because workshop_jobs.status is
// one TEXT column with five values and no transition rules, so today any value
// can become any other and "complete" means four different things: work done,
// bike collected, quote agreed, or the job closed. Phase 2 derives its schema
// from these declarations, so an illegal transition that passes here becomes an
// illegal row later.
//
// Every machine is pure: a state plus an event gives a state. Expiry is an
// event, not a clock, so these tests never wait.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defineMachine, custody } from '../server/workshop/state-machines.js';

test('defineMachine rejects a transition to a state it does not declare', () => {
  assert.throws(
    () => defineMachine({
      name: 'broken',
      initial: 'a',
      states: ['a', 'b'],
      transitions: { a: { go: 'c' } },
    }),
    /broken: transition a --go--> c names an undeclared state/,
  );
});

test('defineMachine rejects an initial state it does not declare', () => {
  assert.throws(
    () => defineMachine({ name: 'broken', initial: 'z', states: ['a'], transitions: {} }),
    /broken: initial state z is not declared/,
  );
});

test('a legal custody transition returns the next state', () => {
  assert.equal(custody.next('expected', 'book_in'), 'in_shop');
  assert.equal(custody.next('in_shop', 'collect'), 'collected');
});

test('an illegal custody transition throws, naming machine, state and event', () => {
  assert.throws(
    () => custody.next('expected', 'collect'),
    /custody: cannot collect from expected/,
  );
});

test('a bike can come back after collection, because shops reopen jobs', () => {
  assert.equal(custody.next('collected', 'reopen'), 'in_shop');
});

test('can() answers without throwing', () => {
  assert.equal(custody.can('expected', 'book_in'), true);
  assert.equal(custody.can('expected', 'collect'), false);
});

test('events() lists what is possible from a state', () => {
  assert.deepEqual(custody.events('in_shop').sort(), ['collect']);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/workshop-states.test.js
```

Expected: `Cannot find module '../server/workshop/state-machines.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/workshop/state-machines.js`:

```js
// server/workshop/state-machines.js
//
// Every legal state change in the workshop, declared as data. This is the
// single source of truth: Phase 2 generates CHECK constraints from these
// declarations and Phase 3 guards its endpoints with them, so nothing here may
// describe a transition the product does not actually allow.
//
// The machines are deliberately separate. Approval, custody, work and
// collection are independent facts - a bike can be finished but uncollected,
// approved but not started, in the shop with nothing agreed yet. Encoding one
// machine's state inside another is what produced the ambiguous single status
// column these replace. Cross-machine rules live in the invariants test.

export function defineMachine({ name, initial, states, transitions, terminal = [] }) {
  const known = new Set(states);
  if (!known.has(initial)) {
    throw new Error(`${name}: initial state ${initial} is not declared`);
  }
  for (const [from, events] of Object.entries(transitions)) {
    if (!known.has(from)) {
      throw new Error(`${name}: transitions declared from undeclared state ${from}`);
    }
    for (const [event, to] of Object.entries(events)) {
      if (!known.has(to)) {
        throw new Error(`${name}: transition ${from} --${event}--> ${to} names an undeclared state`);
      }
    }
  }
  for (const state of terminal) {
    if (!known.has(state)) throw new Error(`${name}: terminal state ${state} is not declared`);
  }

  return {
    name,
    initial,
    states,
    terminal,
    transitions,
    can: (from, event) => Boolean(transitions[from]?.[event]),
    events: from => Object.keys(transitions[from] ?? {}),
    next(from, event) {
      const to = transitions[from]?.[event];
      if (!to) throw new Error(`${name}: cannot ${event} from ${from}`);
      return to;
    },
  };
}

// Where the physical bike is. Independent of whether the work is done.
export const custody = defineMachine({
  name: 'custody',
  initial: 'expected',
  states: ['expected', 'in_shop', 'collected'],
  transitions: {
    expected: { book_in: 'in_shop' },
    in_shop: { collect: 'collected' },
    // Shops reopen jobs - a customer returns the next day with the same
    // complaint. Collection is not the end of the record.
    collected: { reopen: 'in_shop' },
  },
});
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
node --test tests/workshop-states.test.js
```

Expected: 7 pass, 0 fail.

- [ ] **Step 5: Prove the tests can still fail**

Temporarily add `collect: 'collected'` to the `expected` transitions, re-run, and confirm the "illegal custody transition throws" test fails. Remove it again. A machine that permits everything passes a test that only checks the happy path.

- [ ] **Step 6: Commit**

```bash
git add server/workshop/state-machines.js tests/workshop-states.test.js
git commit -m "feat(workshop): state machine helper, and custody as the first machine"
```

---

### Task 2: The booking request machine

What happens between a customer asking and the shop agreeing. This is where `pending` and `scheduled` go.

**Files:**
- Modify: `server/workshop/state-machines.js`
- Modify: `tests/workshop-states.test.js`

**Interfaces:**
- Consumes: `defineMachine`.
- Produces: `bookingRequest`, states `pending`, `scheduled`, `declined`, `expired`, `cancelled`, `reschedule_requested`.

- [ ] **Step 1: Write the failing test**

Append to `tests/workshop-states.test.js`, and add `bookingRequest` to the import:

```js
test('a request the shop accepts becomes scheduled', () => {
  assert.equal(bookingRequest.next('pending', 'accept'), 'scheduled');
});

test('a request can be declined, expire, or be withdrawn by the customer', () => {
  assert.equal(bookingRequest.next('pending', 'decline'), 'declined');
  assert.equal(bookingRequest.next('pending', 'expire'), 'expired');
  assert.equal(bookingRequest.next('pending', 'cancel'), 'cancelled');
});

test('an expired request cannot be accepted afterwards', () => {
  // The four-hour hold released its capacity. Accepting now would promise
  // space that another booking may already have taken.
  assert.throws(() => bookingRequest.next('expired', 'accept'),
    /bookingRequest: cannot accept from expired/);
});

test('a declined request is terminal - a shop that changes its mind starts a new one', () => {
  assert.deepEqual(bookingRequest.events('declined'), []);
  assert.ok(bookingRequest.terminal.includes('declined'));
});

test('asking to move a confirmed booking keeps the original until the shop agrees', () => {
  // The old date must still be held. A failed move that had already released
  // the original slot would lose the customer their booking.
  assert.equal(bookingRequest.next('scheduled', 'request_reschedule'), 'reschedule_requested');
  assert.equal(bookingRequest.next('reschedule_requested', 'accept'), 'scheduled');
  assert.equal(bookingRequest.next('reschedule_requested', 'decline'), 'scheduled');
});

test('a scheduled booking can still be cancelled by either side', () => {
  assert.equal(bookingRequest.next('scheduled', 'cancel'), 'cancelled');
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/workshop-states.test.js
```

Expected: `SyntaxError` or `bookingRequest is not defined` — the export does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Append to `server/workshop/state-machines.js`:

```js
// The conversation about whether and when the shop will do the work. Ends
// before the bike arrives; custody takes over from there.
export const bookingRequest = defineMachine({
  name: 'bookingRequest',
  initial: 'pending',
  states: ['pending', 'scheduled', 'reschedule_requested', 'declined', 'expired', 'cancelled'],
  transitions: {
    pending: { accept: 'scheduled', decline: 'declined', expire: 'expired', cancel: 'cancelled' },
    // A reschedule keeps the original allocation until the shop answers, so a
    // refused move leaves the customer with the booking they already had.
    scheduled: { request_reschedule: 'reschedule_requested', cancel: 'cancelled' },
    reschedule_requested: { accept: 'scheduled', decline: 'scheduled', cancel: 'cancelled' },
  },
  terminal: ['declined', 'expired', 'cancelled'],
});
```

- [ ] **Step 4: Run and confirm pass**

```bash
node --test tests/workshop-states.test.js
```

- [ ] **Step 5: Prove the tests can still fail**

Temporarily add `accept: 'scheduled'` to `expired`, re-run, confirm the expired-request test fails, remove it.

- [ ] **Step 6: Commit**

```bash
git add server/workshop/state-machines.js tests/workshop-states.test.js
git commit -m "feat(workshop): booking request machine, with reschedule keeping the original hold"
```

---

### Task 3: The work machine, and reading the old column

Where `waiting_parts` and `on_hold` keep their names, and where `complete` stops meaning "collected".

**Files:**
- Modify: `server/workshop/state-machines.js`
- Modify: `tests/workshop-states.test.js`

**Interfaces:**
- Produces: `work`, states `not_started`, `in_progress`, `waiting_parts`, `on_hold`, `complete`.
- Produces: `readLegacyStatus(status)` returning `{booking, work, custody}` — how a row written under the old five-value column should be read. **A reading, not a migration.** Phase 2 decides what to write.

- [ ] **Step 1: Write the failing test**

```js
test('work moves through the states a mechanic actually works in', () => {
  assert.equal(work.next('not_started', 'start'), 'in_progress');
  assert.equal(work.next('in_progress', 'await_parts'), 'waiting_parts');
  assert.equal(work.next('waiting_parts', 'parts_arrived'), 'in_progress');
  assert.equal(work.next('in_progress', 'finish'), 'complete');
});

test('a job can be put on hold from anywhere it is live, and resumed', () => {
  assert.equal(work.next('in_progress', 'hold'), 'on_hold');
  assert.equal(work.next('waiting_parts', 'hold'), 'on_hold');
  assert.equal(work.next('on_hold', 'resume'), 'in_progress');
});

test('finished work can be reopened, because final checks fail', () => {
  assert.equal(work.next('complete', 'reopen'), 'in_progress');
});

test('work completion says nothing about collection', () => {
  // The whole reason this phase exists: "complete" used to mean both.
  assert.equal(work.states.includes('collected'), false);
  assert.deepEqual(work.events('complete'), ['reopen']);
});

test('the old single status is read as three independent facts', () => {
  assert.deepEqual(readLegacyStatus('pending'),
    { booking: 'pending', work: 'not_started', custody: 'expected' });
  assert.deepEqual(readLegacyStatus('scheduled'),
    { booking: 'scheduled', work: 'not_started', custody: 'expected' });
  assert.deepEqual(readLegacyStatus('waiting_parts'),
    { booking: 'scheduled', work: 'waiting_parts', custody: 'in_shop' });
  assert.deepEqual(readLegacyStatus('on_hold'),
    { booking: 'scheduled', work: 'on_hold', custody: 'in_shop' });
});

test('the old "complete" cannot say whether the bike went home', () => {
  // This is the ambiguity being broken, and it cannot be resolved by reading
  // the old column - the information was never recorded. Phase 2 must decide
  // what to backfill; it must not guess silently here.
  assert.deepEqual(readLegacyStatus('complete'),
    { booking: 'scheduled', work: 'complete', custody: null });
});

test('an unrecognised legacy status is refused rather than guessed', () => {
  assert.throws(() => readLegacyStatus('nonsense'), /unknown legacy status: nonsense/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/workshop-states.test.js
```

- [ ] **Step 3: Write the minimal implementation**

```js
// What the mechanic is doing. Independent of custody: a finished bike is still
// in the shop until someone collects it.
export const work = defineMachine({
  name: 'work',
  initial: 'not_started',
  states: ['not_started', 'in_progress', 'waiting_parts', 'on_hold', 'complete'],
  transitions: {
    not_started: { start: 'in_progress', hold: 'on_hold' },
    in_progress: { await_parts: 'waiting_parts', hold: 'on_hold', finish: 'complete' },
    waiting_parts: { parts_arrived: 'in_progress', hold: 'on_hold' },
    on_hold: { resume: 'in_progress' },
    // Final checks fail, or the customer rides away and comes straight back.
    complete: { reopen: 'in_progress' },
  },
});

// How a row written under the old five-value workshop_jobs.status should be
// READ. This is not a migration: Phase 2 decides what to write and what to
// backfill. custody is null for 'complete' because the old column never
// recorded whether the bike left - the information does not exist, and
// inventing it here would be fabricating history.
const LEGACY = {
  pending: { booking: 'pending', work: 'not_started', custody: 'expected' },
  scheduled: { booking: 'scheduled', work: 'not_started', custody: 'expected' },
  waiting_parts: { booking: 'scheduled', work: 'waiting_parts', custody: 'in_shop' },
  on_hold: { booking: 'scheduled', work: 'on_hold', custody: 'in_shop' },
  complete: { booking: 'scheduled', work: 'complete', custody: null },
};

export function readLegacyStatus(status) {
  const mapped = LEGACY[status];
  if (!mapped) throw new Error(`unknown legacy status: ${status}`);
  return { ...mapped };
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Prove the tests can still fail**

Temporarily change `complete`'s legacy custody from `null` to `'collected'`, re-run, confirm the ambiguity test fails, restore. That test is the one guarding against a silent guess about history, so it must be seen to work.

- [ ] **Step 6: Commit**

```bash
git add server/workshop/state-machines.js tests/workshop-states.test.js
git commit -m "feat(workshop): work machine, and a reading of the old status column"
```

---

### Task 4: Quote revision and approval

The contract the scope decision is strictest about: a stale link cannot approve a changed price.

**Files:**
- Modify: `server/workshop/state-machines.js`
- Modify: `tests/workshop-states.test.js`

**Interfaces:**
- Produces: `quote`, states `draft`, `sent`, `partly_approved`, `approved`, `declined`, `superseded`, `expired`.
- Produces: `canApprove({quoteState, linkRevision, currentRevision})` returning `{allowed, reason}`. Phase 3's approval endpoint calls exactly this.

- [ ] **Step 1: Write the failing test**

```js
test('a quote is sent, and the customer decides line by line', () => {
  assert.equal(quote.next('draft', 'send'), 'sent');
  assert.equal(quote.next('sent', 'approve_all'), 'approved');
  assert.equal(quote.next('sent', 'approve_some'), 'partly_approved');
  assert.equal(quote.next('sent', 'decline_all'), 'declined');
});

test('revising a sent quote supersedes it rather than editing it', () => {
  // The amounts the customer saw must survive. A new revision is a new
  // proposal; the old one becomes history.
  assert.equal(quote.next('sent', 'revise'), 'superseded');
  assert.equal(quote.next('partly_approved', 'revise'), 'superseded');
});

test('a superseded quote can never be approved', () => {
  assert.throws(() => quote.next('superseded', 'approve_all'),
    /quote: cannot approve_all from superseded/);
});

test('a stale approval link is refused, naming why', () => {
  const result = canApprove({ quoteState: 'sent', linkRevision: 1, currentRevision: 2 });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /revision 1.*revision 2/);
});

test('an approval link for the current revision is allowed', () => {
  assert.deepEqual(canApprove({ quoteState: 'sent', linkRevision: 2, currentRevision: 2 }),
    { allowed: true, reason: null });
});

test('a current link against a superseded quote is still refused', () => {
  // Both checks must hold. Matching revision numbers are not enough if the
  // quote itself is no longer the live one.
  const result = canApprove({ quoteState: 'superseded', linkRevision: 2, currentRevision: 2 });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /superseded/);
});

test('approving twice is refused rather than silently repeated', () => {
  const result = canApprove({ quoteState: 'approved', linkRevision: 1, currentRevision: 1 });
  assert.equal(result.allowed, false);
});
```

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Write the minimal implementation**

```js
// What the customer has agreed to. Revisions supersede rather than mutate, so
// the amounts a customer saw when they agreed remain recoverable.
export const quote = defineMachine({
  name: 'quote',
  initial: 'draft',
  states: ['draft', 'sent', 'partly_approved', 'approved', 'declined', 'superseded', 'expired'],
  transitions: {
    draft: { send: 'sent' },
    sent: {
      approve_all: 'approved',
      approve_some: 'partly_approved',
      decline_all: 'declined',
      revise: 'superseded',
      expire: 'expired',
    },
    // Already-decided lines stay decided; changing the rest means a new
    // proposal for the changed work.
    partly_approved: { revise: 'superseded' },
    approved: { revise: 'superseded' },
  },
  terminal: ['declined', 'superseded', 'expired'],
});

const APPROVABLE = new Set(['sent']);

// The guard Phase 3's approval endpoint calls. Two independent reasons to
// refuse: the link is for an older revision, or the quote is no longer live.
// Both are checked, because matching revision numbers do not make a superseded
// quote approvable.
export function canApprove({ quoteState, linkRevision, currentRevision }) {
  if (linkRevision !== currentRevision) {
    return {
      allowed: false,
      reason: `this link is for revision ${linkRevision}; the current quote is revision ${currentRevision}`,
    };
  }
  if (!APPROVABLE.has(quoteState)) {
    return { allowed: false, reason: `a quote that is ${quoteState} cannot be approved` };
  }
  return { allowed: true, reason: null };
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Prove the tests can still fail**

Temporarily return `{allowed: true, reason: null}` from `canApprove` before the revision check. Confirm the stale-link test fails. Restore. This is the single most important guard in the phase; it must be seen to go red.

- [ ] **Step 6: Commit**

```bash
git add server/workshop/state-machines.js tests/workshop-states.test.js
git commit -m "feat(workshop): quote revision machine and the stale-approval guard"
```

---

### Task 5: Capacity holds

Where the one-winner race lives.

**Files:**
- Modify: `server/workshop/state-machines.js`
- Modify: `tests/workshop-states.test.js`

**Interfaces:**
- Produces: `capacityHold`, states `held`, `confirmed`, `expired`, `released`.
- Produces: `settleRace(holdStates)` — given the states of competing holds on the last slot, returns which one wins. Phase 2's atomic booking test uses it as its oracle.

- [ ] **Step 1: Write the failing test**

```js
test('a hold is taken, then confirmed or let go', () => {
  assert.equal(capacityHold.next('held', 'confirm'), 'confirmed');
  assert.equal(capacityHold.next('held', 'expire'), 'expired');
  assert.equal(capacityHold.next('held', 'release'), 'released');
});

test('an expired or released hold stops consuming capacity and cannot return', () => {
  // A hold that still counted after expiry would make the diary lie about
  // available space.
  assert.throws(() => capacityHold.next('expired', 'confirm'),
    /capacityHold: cannot confirm from expired/);
  assert.throws(() => capacityHold.next('released', 'confirm'),
    /capacityHold: cannot confirm from released/);
});

test('a confirmed hold can be released when the booking is cancelled', () => {
  assert.equal(capacityHold.next('confirmed', 'release'), 'released');
});

test('two requests for the last slot produce exactly one winner', () => {
  const result = settleRace([
    { id: 'a', state: 'held' },
    { id: 'b', state: 'held' },
  ]);
  assert.equal(result.winner, 'a');
  assert.deepEqual(result.losers, ['b']);
});

test('an expired hold does not win, even if it asked first', () => {
  const result = settleRace([
    { id: 'a', state: 'expired' },
    { id: 'b', state: 'held' },
  ]);
  assert.equal(result.winner, 'b');
});

test('no live holds means no winner, not an arbitrary one', () => {
  assert.deepEqual(settleRace([{ id: 'a', state: 'expired' }]),
    { winner: null, losers: ['a'] });
});
```

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Write the minimal implementation**

```js
// A claim on workshop capacity. Only 'held' and 'confirmed' consume space; an
// expired or released hold must stop counting immediately, or the diary
// promises room it does not have.
export const capacityHold = defineMachine({
  name: 'capacityHold',
  initial: 'held',
  states: ['held', 'confirmed', 'expired', 'released'],
  transitions: {
    held: { confirm: 'confirmed', expire: 'expired', release: 'released' },
    confirmed: { release: 'released' },
  },
  terminal: ['expired', 'released'],
});

export const CONSUMES_CAPACITY = new Set(['held', 'confirmed']);

// The oracle for "two customers requested the last slot". First live hold in
// the given order wins; everything else loses. Order is the caller's - in
// production it comes from the database's own serialisation, not from here.
export function settleRace(holds) {
  const winner = holds.find(h => h.state === 'held') ?? null;
  return {
    winner: winner ? winner.id : null,
    losers: holds.filter(h => h !== winner).map(h => h.id),
  };
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Prove the tests can still fail**

Temporarily change `settleRace` to `holds[0]` regardless of state. Confirm the expired-hold test fails. Restore.

- [ ] **Step 6: Commit**

```bash
git add server/workshop/state-machines.js tests/workshop-states.test.js
git commit -m "feat(workshop): capacity hold machine and the one-winner race oracle"
```

---

### Task 6: Print tasks and message intentions

Both talk to something outside the database, so both need the state the screens never show: **unknown**.

**Files:**
- Modify: `server/workshop/state-machines.js`
- Modify: `tests/workshop-states.test.js`

**Interfaces:**
- Produces: `printTask` and `messageIntent`, each with states `queued`, `claimed`/`sending`, the success state, `failed` and `unknown`.

- [ ] **Step 1: Write the failing test**

```js
test('a print task is queued, claimed by an agent, then acknowledged', () => {
  assert.equal(printTask.next('queued', 'claim'), 'claimed');
  assert.equal(printTask.next('claimed', 'acknowledge'), 'acknowledged');
});

test('a lost acknowledgement leaves the task unknown, not assumed printed', () => {
  // The agent may have printed the tag and died before saying so. Asserting
  // "printed" would tell a shop a label exists that nobody can find.
  assert.equal(printTask.next('claimed', 'lose_contact'), 'unknown');
});

test('an unknown print task is reconciled by a human, either way', () => {
  assert.equal(printTask.next('unknown', 'confirm_printed'), 'acknowledged');
  assert.equal(printTask.next('unknown', 'confirm_missing'), 'failed');
});

test('an unknown print task cannot be silently retried', () => {
  // Retrying blind is how a shop ends up with two tags on one bike.
  assert.equal(printTask.can('unknown', 'claim'), false);
});

test('a message is sent, then confirmed delivered or failed', () => {
  assert.equal(messageIntent.next('intended', 'send'), 'sending');
  assert.equal(messageIntent.next('sending', 'delivered'), 'delivered');
  assert.equal(messageIntent.next('sending', 'reject'), 'failed');
});

test('a provider timeout leaves the message unknown, never re-sent blind', () => {
  // The SMS may have gone. Re-sending on a timeout is how a customer gets the
  // same message three times.
  assert.equal(messageIntent.next('sending', 'timeout'), 'unknown');
  assert.equal(messageIntent.can('unknown', 'send'), false);
  assert.equal(messageIntent.next('unknown', 'confirm_delivered'), 'delivered');
  assert.equal(messageIntent.next('unknown', 'confirm_not_sent'), 'failed');
});

test('a failed message can be deliberately re-sent', () => {
  // Known-failed is different from unknown. A shop may try again.
  assert.equal(messageIntent.next('failed', 'retry'), 'sending');
});
```

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Write the minimal implementation**

```js
// A tag waiting to come out of a printer. 'unknown' exists because an agent can
// print and then die before acknowledging: the honest state is "we do not
// know", and a person resolves it. Never retried automatically from unknown.
export const printTask = defineMachine({
  name: 'printTask',
  initial: 'queued',
  states: ['queued', 'claimed', 'acknowledged', 'failed', 'unknown'],
  transitions: {
    queued: { claim: 'claimed', cancel: 'failed' },
    claimed: { acknowledge: 'acknowledged', fail: 'failed', lose_contact: 'unknown' },
    unknown: { confirm_printed: 'acknowledged', confirm_missing: 'failed' },
  },
  terminal: ['acknowledged'],
});

// An intention to tell the customer something. Same shape as printTask and for
// the same reason: a provider timeout is not a failure, and treating it as one
// sends the message twice.
export const messageIntent = defineMachine({
  name: 'messageIntent',
  initial: 'intended',
  states: ['intended', 'sending', 'delivered', 'failed', 'unknown'],
  transitions: {
    intended: { send: 'sending', cancel: 'failed' },
    sending: { delivered: 'delivered', reject: 'failed', timeout: 'unknown' },
    // Known-failed may be retried deliberately; unknown may not.
    failed: { retry: 'sending' },
    unknown: { confirm_delivered: 'delivered', confirm_not_sent: 'failed' },
  },
  terminal: ['delivered'],
});
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Prove the tests can still fail**

Temporarily add `claim: 'claimed'` to `printTask`'s `unknown`, re-run, confirm the silent-retry test fails, remove it.

- [ ] **Step 6: Commit**

```bash
git add server/workshop/state-machines.js tests/workshop-states.test.js
git commit -m "feat(workshop): print and message machines, both with an honest unknown state"
```

---

### Task 7: The cross-machine invariants

Each machine is correct alone. This task pins down what must remain true *between* them — the independence the scope decision requires, which no single machine can enforce.

**Files:**
- Create: `tests/workshop-state-invariants.test.js`
- Modify: `server/workshop/state-machines.js`

**Interfaces:**
- Produces: `MACHINES`, an array of every machine, so the invariants can be checked generically and a new machine cannot be added without appearing here.

- [ ] **Step 1: Write the failing test**

Create `tests/workshop-state-invariants.test.js`:

```js
// tests/workshop-state-invariants.test.js
//
// Rules that hold BETWEEN the machines. Each machine is correct on its own;
// these are the properties that break when someone later "simplifies" two of
// them back into one column. Every failure here is the ambiguity this phase
// was created to remove, coming back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MACHINES, work, custody, quote } from '../server/workshop/state-machines.js';

test('the three job facts share no state name', () => {
  // custody, work and quote are the facts the old single status column
  // conflated, so these three must stay pairwise disjoint: the day 'collected'
  // appears in work, or 'complete' in custody, the ambiguity is back.
  //
  // This deliberately does NOT apply to every machine. printTask and
  // messageIntent both have 'failed' and 'unknown'; quote and bookingRequest
  // both have 'declined' and 'expired'. Those are the same English word for
  // genuinely different machines, not a leaked concept, and a blanket
  // disjointness rule would fail on them for no good reason.
  const facts = [custody, work, quote];
  for (const a of facts) {
    for (const b of facts) {
      if (a.name === b.name) continue;
      const shared = a.states.filter(s => b.states.includes(s));
      assert.deepEqual(shared, [],
        `${a.name} and ${b.name} both declare ${shared.join(', ')}`);
    }
  }
});

test('finishing the work does not move the bike', () => {
  assert.equal(work.can('complete', 'collect'), false);
  assert.equal(custody.can('in_shop', 'finish'), false);
});

test('collecting the bike does not finish the work', () => {
  // A customer can take an unfinished bike away. Recording collection must not
  // silently claim the work was done.
  assert.equal(custody.can('in_shop', 'collect'), true);
  assert.equal(work.can('in_progress', 'collect'), false);
});

test('approval does not start the work', () => {
  assert.equal(quote.can('approved', 'start'), false);
  assert.equal(work.initial, 'not_started');
});

test('every machine can reach every one of its declared states', () => {
  // An unreachable state is either a missing transition or a state nobody
  // needs; both are bugs, and both are invisible without this check.
  for (const machine of MACHINES) {
    const reachable = new Set([machine.initial]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const from of [...reachable]) {
        for (const event of machine.events(from)) {
          const to = machine.next(from, event);
          if (!reachable.has(to)) { reachable.add(to); grew = true; }
        }
      }
    }
    const unreachable = machine.states.filter(s => !reachable.has(s));
    assert.deepEqual(unreachable, [],
      `${machine.name} declares unreachable states: ${unreachable.join(', ')}`);
  }
});

test('every machine can stop somewhere', () => {
  // A machine with no terminal state and no dead end describes a process that
  // never ends, which is not a thing a bike shop does.
  for (const machine of MACHINES) {
    const settles = machine.terminal.length > 0
      || machine.states.some(s => machine.events(s).length === 0);
    assert.ok(settles, `${machine.name} never settles`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/workshop-state-invariants.test.js
```

Expected: `MACHINES is not defined`. Once `MACHINES` exists, expect the reachability test to fail if any machine has a state nothing reaches — fix the machine, not the test.

- [ ] **Step 3: Write the minimal implementation**

Append to `server/workshop/state-machines.js`:

```js
// Every machine, so the invariants can check them generically. A new machine
// that is not added here is invisible to the invariant tests, so add it.
export const MACHINES = [bookingRequest, custody, work, quote, capacityHold, printTask, messageIntent];
```

- [ ] **Step 4: Run both test files and confirm they pass**

```bash
node --test tests/workshop-states.test.js tests/workshop-state-invariants.test.js
```

- [ ] **Step 5: Prove the tests can still fail**

Temporarily add `'collected'` to `work`'s states and a `collect` transition from `complete`. Re-run. Two tests should fail: the job-facts disjointness check (custody already declares `collected`) and "finishing the work does not move the bike". Remove it. This mutation is the exact regression the phase exists to prevent, so watching it fail is the point of the task.

- [ ] **Step 6: Commit**

```bash
git add server/workshop/state-machines.js tests/workshop-state-invariants.test.js
git commit -m "test(workshop): cross-machine invariants, including mechanical independence"
```

---

### Task 8: Generate the human-readable reference

**Files:**
- Create: `server/workshop/render-states.mjs`
- Create: `docs/design/workshop-states.md` (generated)

- [ ] **Step 1: Write the generator**

```js
// server/workshop/render-states.mjs
//
// Renders the machines to Markdown. The declarations are the source of truth;
// this file exists so a human can read them without reading JavaScript. Run it
// after changing any machine:  node server/workshop/render-states.mjs
import { writeFile } from 'node:fs/promises';
import { MACHINES } from './state-machines.js';

const lines = [
  '# Workshop state machines',
  '',
  '**Generated by `server/workshop/render-states.mjs` — do not edit by hand.**',
  'Change `server/workshop/state-machines.js` and re-run it.',
  '',
  'These are independent on purpose: approval, custody, work and collection are',
  'separate facts. A bike can be finished but uncollected, or approved and not',
  'started. Cross-machine rules are enforced in',
  '`tests/workshop-state-invariants.test.js`.',
  '',
];

for (const m of MACHINES) {
  lines.push(`## ${m.name}`, '');
  lines.push(`Starts at \`${m.initial}\`.`
    + (m.terminal.length ? ` Ends at ${m.terminal.map(s => `\`${s}\``).join(', ')}.` : ''), '');
  lines.push('| From | Event | To |', '|---|---|---|');
  for (const [from, events] of Object.entries(m.transitions)) {
    for (const [event, to] of Object.entries(events)) {
      lines.push(`| \`${from}\` | \`${event}\` | \`${to}\` |`);
    }
  }
  lines.push('');
}

await writeFile(new URL('../../docs/design/workshop-states.md', import.meta.url), lines.join('\n') + '\n');
console.log(`Rendered ${MACHINES.length} machines`);
```

- [ ] **Step 2: Run it**

```bash
node server/workshop/render-states.mjs
```

Expected: `Rendered 7 machines`, and `docs/design/workshop-states.md` exists.

- [ ] **Step 3: Confirm the generated file matches the code**

Read `docs/design/workshop-states.md` and check one machine's table against its declaration by eye. Then change a transition in `state-machines.js`, re-run, confirm the document changed, and revert both. A generator whose output does not track its input is worse than no generator.

- [ ] **Step 4: Commit**

```bash
git add server/workshop/render-states.mjs docs/design/workshop-states.md
git commit -m "docs(workshop): generate the state machine reference from the declarations"
```

---

### Task 9: Close Phase 1

- [ ] **Step 1: Run everything**

```bash
npm run docker:up
npm test && npm run typecheck && npm run lint && npm run build
node server/workshop/render-states.mjs
```

Expected: the suite's previous count **plus** the new tests, 0 fail. Record the real number. `npm run build` rewrites tracked files under `public/dist` with no source change — revert that churn with `git checkout -- public/dist` rather than committing it.

- [ ] **Step 2: Check the phase against the spec**

The spec's Phase 1 names six things: job lifecycle, custody, quote revision and approval, capacity holds and expiry, print task lifecycle, message send intention. Confirm each has a machine and tests. Job lifecycle is covered by `bookingRequest` plus `work` — two machines, because the spec's single phrase conflated them; say so rather than claiming one-to-one coverage.

- [ ] **Step 3: Update `.agents/STATUS.md`**

Record that Phase 1 landed, what the machines are, and that `workshop_jobs.status` is **unchanged** — Phase 1 added a model, it did not migrate anything. Keep under the 8,000-byte cap: check the byte count **before** committing, not after.

- [ ] **Step 4: Open the pull request**

```bash
git push -u origin <branch>
gh pr create --title "Phase 1: workshop state machines" --body "..."
```

Say plainly in the body that no schema or endpoint changed, and that `readLegacyStatus` is a reading of the old column rather than a migration of it.

---

## What this plan does not cover

- **No schema changes.** `workshop_jobs.status` is untouched. Phase 2 decides what to write, what to constrain and what to backfill — including the one thing this phase proves cannot be recovered: whether an old `complete` job's bike was ever collected.
- **No endpoint changes.** `server.js`'s `JOB_STATUSES` still governs the API. Phase 3 replaces it with these machines.
- **No expiry scheduler.** Expiry is an event here, not a clock. Whatever fires it is Phase 2 or 3's problem.
