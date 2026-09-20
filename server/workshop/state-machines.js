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
