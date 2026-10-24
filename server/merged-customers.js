// A customer since merged into another, as the rest of the server finds them
// (openspec/changes/customer-merge design 8). A till that was offline may name
// a hidden record, by its number or the till's own id for it, before or after
// the record is removed for good; it means the record kept.
import { prepare } from './db.js';

const byId = (id) => prepare('SELECT id, merged_into_id FROM customers WHERE id = ?').get(id);
// The record a removed one was merged into, by its old number or till id.
const removedInto = async (column, value) => (await prepare(
  `SELECT kept_id FROM customer_merges WHERE ${column} = ? AND other_id IS NULL AND undone_at IS NULL AND kept_id IS NOT NULL
    ORDER BY merged_at DESC LIMIT 1`
).get(value))?.kept_id ?? null;

/**
 * The customer meant now, following merges one after another, with the merges
 * still undoable that it passed through (so a row given to it can be put back
 * by Undo); null when there's none.
 */
export async function liveCustomer({ id, clientId }) {
  let c = id != null
    ? await byId(id)
    : await prepare('SELECT id, merged_into_id FROM customers WHERE client_id = ?').get(clientId);
  if (!c) {
    const kept = id != null ? await removedInto('other_was_id', id) : await removedInto('other_client_id', clientId);
    c = kept ? await byId(kept) : null;
  }
  const through = [];
  for (let hops = 0; c && hops < 20; hops += 1) {
    if (!c.merged_into_id) return { id: c.id, through };
    const m = await prepare(
      'SELECT id FROM customer_merges WHERE other_id = ? AND kept_id = ? AND undone_at IS NULL ORDER BY merged_at DESC LIMIT 1'
    ).get(c.id, c.merged_into_id);
    if (m) through.push(m.id);
    c = await byId(c.merged_into_id);
  }
  return null;
}

/** Notes a row given to the record kept, so each merge's Undo moves it back a step. */
export async function noteMoved(mergeIds, table, rowId) {
  if (!mergeIds.length) return;
  await prepare(
    `UPDATE customer_merges SET moved = jsonb_set(moved, ARRAY['rows', ?::text], COALESCE(moved->'rows'->?::text, '[]'::jsonb) || to_jsonb(?::int))
      WHERE id = ANY(?::int[])`
  ).run(table, table, rowId, mergeIds);
}

/** A till id once given to a customer, even one since merged away and removed. */
export async function clientIdKnown(clientId) {
  return Boolean(await prepare('SELECT 1 FROM customers WHERE client_id = ?').get(clientId)
    ?? await prepare('SELECT 1 FROM customer_merges WHERE other_client_id = ? AND undone_at IS NULL').get(clientId));
}
