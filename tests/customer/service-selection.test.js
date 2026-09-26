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

// The shop's includes can change while the tab is open, leaving a row both
// ticked and locked by a ticked full service; saving that pair is what the
// server refuses (piece 8). savedServices drops the now-locked id before
// Continue saves, keeping list order.
test('savedServices drops a ticked id that a ticked full service now locks', () => {
  assert.deepEqual(r.savedServices(DATA, [11, 1]).map((s) => s.id), [1]);
  assert.deepEqual(r.savedServices(DATA, [1, 13]).map((s) => s.id), [1, 13]);
  assert.deepEqual(r.savedServices(DATA, []).map((s) => s.id), []);
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

// Controller ruling (26 Sep): the takeoff notice must name the removed service
// from the full service's own `includes` list, not from the flattened
// listOrder - a ticked id that's stale (present in `includes` but no longer
// among the individual sections) must never print "undefined".
test('the notice names a ticked include no longer on the individual list, without "undefined"', () => {
  const stale = {
    ...DATA,
    full: [
      { ...DATA.full[0], includes: [...DATA.full[0].includes, { id: 999, name: 'Retired add-on' }] },
      DATA.full[1],
    ],
  };
  const out = r.toggle(stale, [999, 13], 1);
  assert.deepEqual(out.ticked, [1, 13]);
  assert.deepEqual(out.notices, [
    { id: 999, text: "Retired add-on is part of your General service, so we've taken it off" },
  ]);
});
