// Fix and Leave it out, one row at a time (mv-fix; openspec/changes/citrus-import-fix).
// Everything happens under the same locks in the same order as a batch and a
// deletion: every move file in id order, then the row, then what the batch takes for
// that report. A row is applied by the file's own rules, so a fix can't do what a row
// in a file couldn't, except for what a person has ticked on this one row (design 5).
import { createHash } from 'node:crypto';
import { dbExec, prepare } from '../db.js';
import { NO_PRODUCT, ROW_APPLIERS, ROW_FAILED, TRY_AGAIN, addCounts, backToWaiting, batchContext, holdsStock, lockFiles, lockForBatch, settle } from './bring-across.js';
import { NO_CUSTOMER, SAME_PERSON, SHARED_CONTACT, cleanEmail, cleanName, phoneForms } from './bring-customers.js';

// What Fix asks for each report (second walk 4d: left for the build, logged for Jack).
export const FIELDS = {
  price_list: ['Item Lookup Code', 'Description', 'Price', 'Store Cost', 'Tax Rate', 'Qty On Hand', 'Min (Reorder Point)'],
  barcodes: ['ILC', 'Alias'],
  customers: ['First Name', 'Last Name', 'Account Number', 'Email', 'Phone'],
  bikes: ['Description', 'Serial Number', 'Customer Name', 'Email Address', 'Mobile Number', 'Phone Number'],
};
const MAX_FIELD = 500;
const LIST_LIMIT = 200;
const LOCK_WAIT = '2s';
const seenOf = (row) => createHash('sha256').update(JSON.stringify([row.why, row.customer_id, row.data])).digest('hex');
const refusal = (status, body) => ({ status, body });
const GONE = refusal(409, { error: 'That row has gone. Look at the list again.', code: 'row_gone' });
const CHANGED = refusal(409, { error: 'That row has changed since you opened it. Look at it again.', code: 'row_changed' });
const REUSED = refusal(409, { error: 'That was sent before with something else. Try again.', code: 'reused_key' });
const BUSY = refusal(503, { error: 'Wheelhouse is busy with your files just now. Try again in a moment.', code: 'busy' });

/** The rows needing a look, oldest first, up to the limit, and how many there are in all. */
export async function lookList() {
  const rows = await prepare(
    `SELECT r.id, r.why, r.data, r.customer_id, f.report, c.name AS same_as FROM move_rows r
       JOIN move_files f ON f.id = r.file_id LEFT JOIN customers c ON c.id = r.customer_id
      WHERE r.state = 'look' ORDER BY r.id LIMIT ?`
  ).all(LIST_LIMIT);
  const { n } = await prepare(`SELECT count(*)::int AS n FROM move_rows WHERE state = 'look'`).get();
  return {
    total: n,
    rows: rows.map((r) => {
      const same = r.why === SAME_PERSON && r.customer_id !== null;
      return {
        id: r.id,
        report: r.report,
        why: same ? `${r.why} ${r.same_as}` : r.why,
        seen: seenOf(r),
        fields: Object.fromEntries(FIELDS[r.report].filter((k) => r.data[k] !== undefined).map((k) => [k, String(r.data[k])])),
        ...(same ? { sameAs: { id: r.customer_id, name: r.same_as } } : {}),
      };
    }),
  };
}

/** Whatever was sent for a fix's boxes, checked; null if it isn't only text in that report's boxes. */
function corrected(report, data, fields) {
  if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) return null;
  const out = { ...data };
  for (const [name, value] of Object.entries(fields)) {
    if (!FIELDS[report].includes(name) || typeof value !== 'string' || value.length > MAX_FIELD) return null;
    const clean = value.replaceAll('\u0000', '').toWellFormed().trim();
    if (clean) out[name] = clean;
    else delete out[name];
  }
  return out;
}

// Only the rows this new product or customer could let in, so the list doesn't jump (design 9).
async function bringAlong(report, d) {
  if (report === 'price_list') {
    return backToWaiting(await prepare(
      `UPDATE move_rows r SET state = 'waiting', why = NULL FROM move_files f
        WHERE r.file_id = f.id AND f.report = 'barcodes' AND r.state = 'look' AND r.why = ? AND r.data->>'ILC' = ? RETURNING r.file_id`
    ).all(NO_PRODUCT, d['Item Lookup Code']));
  }
  if (report === 'customers') {
    const forms = phoneForms(d.Phone);
    return backToWaiting(await prepare(
      `UPDATE move_rows r SET state = 'waiting', why = NULL FROM move_files f
        WHERE r.file_id = f.id AND f.report = 'bikes' AND r.state = 'look' AND r.why = ? AND (
          lower(trim(coalesce(r.data->>'Customer Name', ''))) = ?
          OR (? <> '' AND lower(trim(coalesce(r.data->>'Email Address', ''))) = ?)
          OR regexp_replace(coalesce(r.data->>'Mobile Number', ''), '\\D', '', 'g') = ANY(?)
          OR regexp_replace(coalesce(r.data->>'Phone Number', ''), '\\D', '', 'g') = ANY(?)
        ) RETURNING r.file_id`
    ).all(NO_CUSTOMER, cleanName([d['First Name'], d['Last Name']].filter(Boolean).join(' ')), cleanEmail(d.Email), cleanEmail(d.Email), forms, forms));
  }
  return false;
}

const markSorted = (row, who, key) => prepare(
  `UPDATE move_rows SET sorted_by_login_id = ?, sorted_by_employee_id = ?, sorted_at = now(), request_key_hash = ?, request_body_hash = ? WHERE id = ?`
).run(who.loginId, who.employeeId, key.keyHash, key.bodyHash, row.id);

class Refused extends Error {
  constructor(reply) { super('refused'); this.reply = reply; }
}

// BEGIN, the locks, what `act` does to the row, COMMIT. `act` returns the reply's
// body, or throws Refused, which leaves nothing changed. The caller replies after this.
async function onOneRow(rowId, { seen, key }, act) {
  await dbExec('BEGIN');
  try {
    await prepare(`SET LOCAL lock_timeout = '${LOCK_WAIT}'`).run();
    await lockFiles();
    // Sent before: its outcome, and nothing again. The lock above makes a second at the same moment wait for the first.
    const earlier = await prepare('SELECT id, state, request_body_hash FROM move_rows WHERE request_key_hash = ?').get(key.keyHash);
    if (earlier) {
      if (earlier.id !== rowId || earlier.request_body_hash !== key.bodyHash) throw new Refused(REUSED);
      await dbExec('ROLLBACK');
      return { status: 200, body: { id: rowId, state: earlier.state } };
    }
    const row = await prepare(
      `SELECT r.id, r.file_id, r.state, r.why, r.data, r.customer_id FROM move_rows r WHERE r.id = ? FOR UPDATE`
    ).get(rowId);
    if (!row) throw new Refused(GONE);
    // Under the lock, so a deletion that got here first can't be undone by this save.
    if (row.state !== 'look' || seenOf(row) !== seen) throw new Refused(CHANGED);
    const file = await prepare('SELECT * FROM move_files WHERE id = ?').get(row.file_id);
    const body = await act(row, file);
    await dbExec('COMMIT');
    return { status: 200, body };
  } catch (err) {
    await dbExec('ROLLBACK');
    if (err instanceof Refused) return err.reply;
    if (TRY_AGAIN.has(err.code)) return BUSY;
    throw err;
  }
}

/** Fix one row. `decided` is what a person ticked, on this row only. Returns { status, body }. */
export function fixRow(rowId, { seen, fields, decided, key, who }) {
  return onOneRow(rowId, { seen, key }, async (row, file) => {
    const data = corrected(file.report, row.data, fields);
    if (!data) throw new Refused(refusal(400, { error: 'Those details can’t be saved on this row' }));
    let done;
    try {
      await lockForBatch(file, [{ data }]);
      // The deleted customers' codes are read here, under the lock, whatever was shown.
      // The person is whoever's fixing it; the stock is the file's, so the shop is the
      // rest of the file's, wherever the Fix is pressed (stock-per-shop, design 3).
      const context = { ...(await batchContext(file)), decided, storedShared: row.why === SHARED_CONTACT };
      done = await ROW_APPLIERS[file.report](data, { ...file, sent_by_login_id: who.loginId, moved_by: { ...who, siteId: context.siteId } }, context);
    } catch (err) {
      // A value the database won't take, or a clash it found first: only this row's problem.
      if (/^2[23]/.test(err.code ?? '')) throw new Refused(refusal(422, { error: ROW_FAILED, why: ROW_FAILED, code: 'still_needs_a_look' }));
      throw err;
    }
    if (done.state === 'look') {
      const named = done.why === SAME_PERSON ? await prepare('SELECT id, name FROM customers WHERE id = ?').get(done.customerId) : null;
      const why = named ? `${done.why} ${named.name}` : done.why;
      throw new Refused(refusal(422, {
        error: why, why, code: 'still_needs_a_look',
        ...(done.why === SHARED_CONTACT ? { decide: 'shared' } : {}),
        ...(named ? { decide: 'same_person', sameAs: { id: named.id, name: named.name } } : {}),
      }));
    }
    const totals = { look: -1, stockLook: file.report === 'price_list' && holdsStock(row.data) ? -1 : 0 };
    await settle({ ...row, data }, done, file, totals);
    await addCounts(file, totals);
    await prepare('UPDATE move_files SET rows_fixed = rows_fixed + 1 WHERE id = ?').run(file.id);
    await markSorted(row, who, key);
    const more = done.state === 'in' ? await bringAlong(file.report, data) : false;
    return { id: row.id, state: done.state, more };
  });
}

/**
 * Leave one row out: kept, with its details and its link, for Your data; nothing is
 * made. The link stays so that deleting that customer still finds their own row, even
 * if they've changed their email and phone since (forgetForMove).
 */
export function leaveOutRow(rowId, { seen, key, who }) {
  return onOneRow(rowId, { seen, key }, async (row, file) => {
    await prepare(`UPDATE move_rows SET state = 'left_out' WHERE id = ?`).run(row.id);
    const held = file.report === 'price_list' && holdsStock(row.data) ? 1 : 0;
    await addCounts(file, { look: -1, stockLook: -held });
    await prepare('UPDATE move_files SET rows_left_out = rows_left_out + 1, stock_left_out = stock_left_out + ? WHERE id = ?').run(held, file.id);
    await markSorted(row, who, key);
    return { id: row.id, state: 'left_out' };
  });
}
