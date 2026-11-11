// A shop's first Other ways to pay (openspec/changes/owner-setup-till-payments-eod,
// design 4): the three drawn rows and their lines (setup.mjs payOther, set-pay-other).
// Run with the business set, in a transaction of the caller's. Migration 133 does the
// same for businesses already there.
export const SEED_OTHER_WAYS = `INSERT INTO payment_ways_other (shop_id, name, note, position)
  SELECT current_setting('app.current_shop_id')::int, w.name, w.note, w.position FROM (VALUES
    ('Finance', 'Recorded at the till; the finance company pays the shop', 0),
    ('Cycle to Work', 'Recorded at the till against a Cycle to Work order', 1),
    ('Payment link', 'Needs setting up with [payment provider] first', 2)) AS w (name, note, position)`;
