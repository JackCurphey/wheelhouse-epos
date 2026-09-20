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
