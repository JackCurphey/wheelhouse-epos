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

test('every machine declares where it comes to rest', () => {
  // A machine with no rest state describes a process that never settles, which
  // is not a thing a bike shop does. Rest is not the same as having no way out:
  // a collected bike can come back and a complete job can be reopened, but
  // neither happens on its own.
  for (const machine of MACHINES) {
    assert.ok(machine.rest.length > 0, `${machine.name} declares no rest state`);
  }
});

test('leaving a rest state always takes a deliberate act', () => {
  // The events that leave a rest state are ones a person chooses: reopen a job,
  // bring a bike back, retry a failed message. None fires by itself, so nothing
  // times out or calls back its way out of rest.
  const deliberate = new Set(['reopen', 'retry']);
  for (const machine of MACHINES) {
    for (const state of machine.rest) {
      for (const event of machine.events(state)) {
        assert.ok(deliberate.has(event),
          `${machine.name} leaves rest state ${state} via ${event}, which is not a deliberate act`);
      }
    }
  }
});
