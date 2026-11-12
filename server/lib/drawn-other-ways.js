// A shop's first Other ways to pay (openspec/changes/owner-setup-till-payments-eod,
// design 4): the three drawn rows and their lines (setup.mjs payOther, set-pay-other).
// Only these rows have a line; a shop's own rows have none.
export const DRAWN_OTHER_WAYS = [
  { name: 'Finance', note: 'Recorded at the till; the finance company pays the shop' },
  { name: 'Cycle to Work', note: 'Recorded at the till against a Cycle to Work order' },
  { name: 'Payment link', note: 'Needs setting up with [payment provider] first' },
];

const literal = (s) => `'${s.replace(/'/g, "''")}'`;
// Run with the business set, in a transaction of the caller's. Migration 140 does the
// same for businesses already there.
export const SEED_OTHER_WAYS = `INSERT INTO payment_ways_other (shop_id, name, note, position)
  SELECT current_setting('app.current_shop_id')::int, w.name, w.note, w.position FROM (VALUES
    ${DRAWN_OTHER_WAYS.map((w, i) => `(${literal(w.name)}, ${literal(w.note)}, ${i})`).join(',\n    ')}) AS w (name, note, position)`;
