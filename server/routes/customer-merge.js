// Possible duplicates and Merge, with a 30-day undo (openspec/changes/customer-merge;
// drawn as cs-page-dup and cs-merge; customer service review 5 and 12; Jack,
// 24 Oct, answer 6). Staff routes, in the shop's row-level security, except
// customer_logins, which isn't, so it's filtered by shop here.
import { prepare, dbExec } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { UK_NUMBER_SQL, ukNumber } from './customers.js';

const UNDO_DAYS = 30;
// Every table that points at a customer, moved together (design 2).
// A reminder's stop link moves too, so it stops the kept record's reminders (stop-reminders, review).
const MOVED = ['customer_bikes', 'workshop_jobs', 'sales', 'sale_documents', 'customer_messages', 'till_sales', 'till_attention', 'reminder_stop_codes', 'job_notes'];
// The fields that may differ, and the columns each takes.
// A company's details travel with its name (company customers' review 1).
const FIELDS = { name: ['name', 'is_company', 'contact_name', 'vat_number', 'invoice_email'], phone: ['phone'], email: ['email'], address: ['address', 'postcode'], notes: ['notes'] };
// The customer's answers to reminders: not a choice, but kept in the merge's
// before and after so Undo puts them back (merge-keeps-yes).
const ANSWERS = ['service_reminders', 'review_requests', 'reminders_said_yes_at', 'reminders_said_yes_via'];

/**
 * If either record said yes, the kept one says yes (Jack's answer 9 of 25
 * Oct), with when and where it was given: from the record whose yes to
 * service reminders it is, else to review requests, so a yes always says
 * when and where (077's check).
 */
function answersAfterMerge(kept, other) {
  const service = Boolean(kept.service_reminders || other.service_reminders);
  const review = Boolean(kept.review_requests || other.review_requests);
  // The service-reminder yes first, from whichever record gave it; else the
  // review-request yes (review).
  const from = kept.service_reminders ? kept : other.service_reminders ? other : kept.review_requests ? kept : other;
  return {
    service_reminders: service,
    review_requests: review,
    reminders_said_yes_at: service || review ? from.reminders_said_yes_at : kept.reminders_said_yes_at,
    reminders_said_yes_via: service || review ? from.reminders_said_yes_via : kept.reminders_said_yes_via,
  };
}

const validId = (v) => Number.isInteger(v) && v > 0 && v <= 2_147_483_647;

/**
 * Removes, for good, merged records whose 30 days have gone (design 4). Anything
 * that has come to point at the hidden record since the merge (an offline till's
 * sale synced late, say) moves to the kept record first, so the removal can't fail.
 */
async function removeExpired() {
  const due = await prepare(
    `SELECT m.id, m.kept_id, m.other_id FROM customer_merges m
      WHERE m.other_id IS NOT NULL AND m.kept_id IS NOT NULL AND m.undone_at IS NULL
        AND m.merged_at < now() - make_interval(days => ${UNDO_DAYS})
      ORDER BY m.merged_at, m.id`
  ).all();
  if (!due.length) return;
  const shopId = (await prepare("SELECT current_setting('app.current_shop_id')::int AS id").get()).id;
  for (const m of due) {
    await dbExec('BEGIN');
    try {
      for (const table of MOVED) await prepare(`UPDATE ${table} SET customer_id = ? WHERE customer_id = ?`).run(m.kept_id, m.other_id);
      await prepare('UPDATE customer_logins SET customer_id = ? WHERE shop_id = ? AND customer_id = ?').run(m.kept_id, shopId, m.other_id);
      // Anything merged into it earlier now points at the record it went into.
      await prepare('UPDATE customers SET merged_into_id = ? WHERE merged_into_id = ?').run(m.kept_id, m.other_id);
      await prepare('UPDATE customer_merges SET kept_id = ? WHERE kept_id = ?').run(m.kept_id, m.other_id);
      await prepare('DELETE FROM customer_group_members WHERE customer_id = ?').run(m.other_id);
      await prepare('DELETE FROM customer_not_duplicates WHERE first_id = ? OR second_id = ?').run(m.other_id, m.other_id);
      await prepare('UPDATE customer_merges SET other_id = NULL WHERE id = ?').run(m.id);
      await prepare('DELETE FROM customers WHERE id = ? AND active = 0 AND merged_into_id IS NOT NULL').run(m.other_id);
      await dbExec('COMMIT');
    } catch (err) {
      await dbExec('ROLLBACK');
      console.error(`customer merge ${m.id}: the hidden record couldn’t be removed yet`, err);
    }
  }
}

export function register(route) {
  // screens: customers
  route('GET', '/api/customers/:id/possible-duplicates', async (req, res, params) => {
    const id = Number(params.id);
    const me = validId(id) ? await prepare('SELECT * FROM customers WHERE id = ?').get(id) : null;
    if (!me) return notFound(res, 'Customer not found');
    const phone = me.phone ? ukNumber(me.phone.replace(/\D/g, '')) : '';
    const email = (me.email ?? '').trim().toLowerCase();
    const rows = await prepare(
      `SELECT c.id, c.name, c.phone, c.email, c.address, c.postcode, c.notes, c.created_at,
              CASE WHEN ?::text <> '' AND ${UK_NUMBER_SQL} = ?::text THEN 'phone' ELSE 'email' END AS reason,
              (SELECT count(*)::int FROM workshop_jobs w WHERE w.customer_id = c.id) AS jobs,
              (SELECT count(*)::int FROM all_sales s WHERE s.customer_id = c.id) AS sales
         FROM customers c
        WHERE c.id <> ? AND c.active = 1
          AND ((?::text <> '' AND ${UK_NUMBER_SQL} = ?::text) OR (?::text <> '' AND lower(trim(coalesce(c.email, ''))) = ?::text))
          AND NOT EXISTS (SELECT 1 FROM customer_not_duplicates d WHERE d.first_id = least(c.id, ?) AND d.second_id = greatest(c.id, ?))
        ORDER BY c.id LIMIT 5`
    ).all(phone, phone, id, phone, phone, email, email, id, id);
    sendJson(res, 200, rows.map((r) => ({
      id: r.id, name: r.name, phone: r.phone || null, email: r.email || null, address: r.address ?? null, postcode: r.postcode ?? null, notes: r.notes || null,
      reason: r.reason, jobs: r.jobs, sales: r.sales, createdAt: new Date(r.created_at).toISOString(),
    })));
  });

  // They're different people: not flagged again, both ways.
  // screens: customers
  route('POST', '/api/customers/:id/not-duplicate', async (req, res, params) => {
    const ctx = await currentSession(req);
    const id = Number(params.id);
    const { otherId } = (await readJsonBody(req)) ?? {};
    if (!validId(id) || !validId(otherId) || id === otherId) return badRequest(res, 'Say which two customers');
    const found = await prepare('SELECT count(*)::int AS n FROM customers WHERE id IN (?, ?)').get(id, otherId);
    if (found.n !== 2) return notFound(res, 'Customer not found');
    await prepare(
      `INSERT INTO customer_not_duplicates (first_id, second_id, said_by_login_id) VALUES (least(?::int, ?::int), greatest(?::int, ?::int), ?)
       ON CONFLICT DO NOTHING RETURNING first_id`
    ).all(id, otherId, id, otherId, ctx?.login.id ?? null);
    sendJson(res, 200, { ok: true });
  });

  // Merge into one: this customer is kept, with the chosen value of each field
  // (keep: { name: 'this' | 'other', … }); everything of the other moves here.
  // screens: customers
  route('POST', '/api/customers/:id/merge', async (req, res, params) => {
    const ctx = await currentSession(req);
    const id = Number(params.id);
    const body = (await readJsonBody(req)) ?? {};
    const otherId = body.otherId;
    const keep = body.keep && typeof body.keep === 'object' ? body.keep : {};
    if (!validId(id) || !validId(otherId)) return badRequest(res, 'Say which two customers');
    if (id === otherId) return badRequest(res, 'A customer can’t be merged into themselves');
    for (const [k, v] of Object.entries(keep)) {
      if (!FIELDS[k] || !['this', 'other'].includes(v)) return badRequest(res, `Choose this or other for ${k}`);
    }
    const shopId = (await prepare("SELECT current_setting('app.current_shop_id')::int AS id").get()).id;
    await dbExec('BEGIN');
    try {
      // Both locked in one go, lowest id first, so two opposite merges can't deadlock.
      const both = await prepare('SELECT * FROM customers WHERE id IN (?, ?) AND active = 1 ORDER BY id FOR UPDATE').all(id, otherId);
      const kept = both.find((c) => c.id === id);
      const other = both.find((c) => c.id === otherId);
      if (!kept || !other) { await dbExec('ROLLBACK'); return notFound(res, 'Customer not found'); }
      const logins = await prepare('SELECT id, customer_id FROM customer_logins WHERE shop_id = ? AND customer_id IN (?, ?)').all(shopId, id, otherId);
      if (logins.some((l) => l.customer_id === id) && logins.some((l) => l.customer_id === otherId)) {
        await dbExec('ROLLBACK');
        return sendJson(res, 409, { error: 'Both have an online account, so they can’t be merged yet.', code: 'both_online' });
      }
      const moved = { before: {}, rows: {}, groups: [], logins: [] };
      for (const cols of Object.values(FIELDS)) for (const col of cols) moved.before[col] = kept[col] ?? null;
      for (const col of ANSWERS) moved.before[col] = kept[col] ?? null;
      // Taking the other record's email takes an email staff may have typed,
      // so it isn't the customer's own any more and a sign-in by code never
      // joins it (customer-account-server, review of 26 Oct); Undo restores it.
      const norm = (e) => String(e ?? '').trim().toLowerCase();
      const emailMoves = keep.email === 'other' && norm(other.email) !== norm(kept.email);
      moved.before.email_from_customer = kept.email_from_customer ?? false;
      for (const table of MOVED) {
        moved.rows[table] = (await prepare(`UPDATE ${table} SET customer_id = ? WHERE customer_id = ? RETURNING id`).all(id, otherId)).map((r) => r.id);
      }
      moved.logins = (await prepare('UPDATE customer_logins SET customer_id = ? WHERE shop_id = ? AND customer_id = ? RETURNING id').all(id, shopId, otherId)).map((r) => r.id);
      moved.groups = (await prepare(
        `INSERT INTO customer_group_members (group_id, customer_id)
           SELECT group_id, ? FROM customer_group_members WHERE customer_id = ? ON CONFLICT DO NOTHING RETURNING group_id`
      ).all(id, otherId)).map((r) => r.group_id);
      // Stops on the shop's own messages go with her (own-messages-server review 1).
      moved.ownStops = (await prepare(
        `INSERT INTO shop_message_stops (shop_message_id, customer_id)
           SELECT shop_message_id, ? FROM shop_message_stops WHERE customer_id = ? ON CONFLICT DO NOTHING RETURNING shop_message_id`
      ).all(id, otherId)).map((r) => r.shop_message_id);
      const sets = [];
      const args = [];
      for (const [field, cols] of Object.entries(FIELDS)) {
        if (keep[field] !== 'other') continue;
        for (const col of cols) { sets.push(`${col} = ?`); args.push(other[col] ?? null); }
      }
      if (sets.length) await prepare(`UPDATE customers SET ${sets.join(', ')}, updated_at = now() WHERE id = ?`).run(...args, id);
      // What the merge set, so Undo puts back only what nobody has changed since.
      moved.after = {};
      for (const [field, cols] of Object.entries(FIELDS)) for (const col of cols) moved.after[col] = keep[field] === 'other' ? other[col] ?? null : kept[col] ?? null;
      const answers = answersAfterMerge(kept, other);
      await prepare(
        'UPDATE customers SET service_reminders = ?, review_requests = ?, reminders_said_yes_at = ?, reminders_said_yes_via = ? WHERE id = ?'
      ).run(answers.service_reminders, answers.review_requests, answers.reminders_said_yes_at, answers.reminders_said_yes_via, id);
      for (const col of ANSWERS) moved.after[col] = answers[col] ?? null;
      if (emailMoves) await prepare('UPDATE customers SET email_from_customer = false WHERE id = ?').run(id);
      moved.after.email_from_customer = emailMoves ? false : (kept.email_from_customer ?? false);
      await prepare('UPDATE customers SET active = 0, merged_into_id = ?, updated_at = now() WHERE id = ?').run(id, otherId);
      const row = await prepare(
        'INSERT INTO customer_merges (kept_id, other_id, other_was_id, other_client_id, other_name, moved, merged_by_login_id) VALUES (?, ?, ?, ?, ?, ?::jsonb, ?) RETURNING id'
      ).get(id, otherId, otherId, other.client_id ?? null, other.name, JSON.stringify(moved), ctx?.login.id ?? null);
      await dbExec('COMMIT');
      sendJson(res, 200, { id: row.id });
    } catch (err) {
      await dbExec('ROLLBACK');
      throw err;
    }
  });

  // This customer's merges that can still be undone (the Undo line).
  // screens: customers
  route('GET', '/api/customers/:id/merges', async (req, res, params) => {
    const id = Number(params.id);
    if (!validId(id)) return notFound(res, 'Customer not found');
    await removeExpired();
    const rows = await prepare(
      `SELECT id, other_name, merged_at, merged_at + make_interval(days => ${UNDO_DAYS}) AS undo_until FROM customer_merges
        WHERE kept_id = ? AND undone_at IS NULL AND other_id IS NOT NULL
          AND merged_at >= now() - make_interval(days => ${UNDO_DAYS}) ORDER BY merged_at DESC`
    ).all(id);
    sendJson(res, 200, rows.map((r) => ({ id: r.id, otherName: r.other_name, mergedAt: new Date(r.merged_at).toISOString(), undoUntil: new Date(r.undo_until).toISOString() })));
  });

  // Undo the merge, within 30 days, once: what moved goes back where it's still
  // with the kept record; the fields as they were; the other back in the lists.
  // screens: customers
  route('POST', '/api/customer-merges/:id/undo', async (req, res, params) => {
    const mergeId = Number(params.id);
    if (!validId(mergeId)) return notFound(res, 'Merge not found');
    await removeExpired();
    const shopId = (await prepare("SELECT current_setting('app.current_shop_id')::int AS id").get()).id;
    await dbExec('BEGIN');
    try {
      // Past 30 days (expired), whether or not the removal has run yet.
      const m = await prepare(
        `SELECT *, merged_at < now() - make_interval(days => ${UNDO_DAYS}) AS expired FROM customer_merges WHERE id = ? FOR UPDATE`
      ).get(mergeId);
      if (!m) { await dbExec('ROLLBACK'); return notFound(res, 'Merge not found'); }
      if (m.undone_at || !m.other_id || m.expired) {
        await dbExec('ROLLBACK');
        return sendJson(res, 409, { error: 'That merge can’t be undone any more.', code: 'not_undoable' });
      }
      // Once the kept record has itself been merged into another, undo that merge first.
      const kept = m.kept_id ? await prepare('SELECT * FROM customers WHERE id = ? FOR UPDATE').get(m.kept_id) : null;
      if (kept?.merged_into_id) {
        await dbExec('ROLLBACK');
        return sendJson(res, 409, { error: 'That record has since been merged into another. Undo that merge first.', code: 'kept_merged' });
      }
      if (!kept?.active) {
        await dbExec('ROLLBACK');
        return sendJson(res, 409, { error: 'The record it was merged into has been switched off, so this can’t be undone.', code: 'kept_removed' });
      }
      // A later merge into the same record is undone first, so each puts back what it changed.
      const later = await prepare(
        'SELECT 1 FROM customer_merges WHERE kept_id = ? AND id <> ? AND undone_at IS NULL AND other_id IS NOT NULL AND (merged_at, id) > (?::timestamptz, ?::int)'
      ).get(m.kept_id, m.id, m.merged_at, m.id);
      if (later) {
        await dbExec('ROLLBACK');
        return sendJson(res, 409, { error: 'A later merge into this record needs undoing first.', code: 'later_merge' });
      }
      const hidden = await prepare('SELECT 1 FROM customers WHERE id = ? AND active = 0 AND merged_into_id = ? FOR UPDATE').get(m.other_id, m.kept_id);
      if (!hidden) {
        await dbExec('ROLLBACK');
        return sendJson(res, 409, { error: 'That merge can’t be undone any more.', code: 'not_undoable' });
      }
      const moved = m.moved;
      for (const table of MOVED) {
        const ids = moved.rows?.[table] ?? [];
        if (ids.length) await prepare(`UPDATE ${table} SET customer_id = ? WHERE customer_id = ? AND id = ANY(?::int[])`).run(m.other_id, m.kept_id, ids);
      }
      if (moved.logins?.length) await prepare('UPDATE customer_logins SET customer_id = ? WHERE shop_id = ? AND customer_id = ? AND id = ANY(?::int[])').run(m.other_id, shopId, m.kept_id, moved.logins);
      if (moved.groups?.length) await prepare('DELETE FROM customer_group_members WHERE customer_id = ? AND group_id = ANY(?::int[])').run(m.kept_id, moved.groups);
      if (moved.ownStops?.length) await prepare('DELETE FROM shop_message_stops WHERE customer_id = ? AND shop_message_id = ANY(?::int[])').run(m.kept_id, moved.ownStops);
      // Only what the merge changed, and only where nobody has changed it since.
      // A date read back is a Date; the merge's record keeps it as text (merge-keeps-yes).
      const plain = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
      const same = (a, b) => plain(a) === plain(b);
      // The reminder answers go back together or not at all, so a yes never
      // loses its date: if the customer has changed any since, all stay.
      const answersAsMerged = ANSWERS.every((c) => same(kept[c], moved.after?.[c]));
      const cols = Object.keys(moved.before ?? {}).filter((c) => (!ANSWERS.includes(c) || answersAsMerged)
        && !same(moved.before[c], moved.after?.[c]) && same(kept[c], moved.after?.[c]));
      if (cols.length) await prepare(`UPDATE customers SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = now() WHERE id = ?`).run(...cols.map((c) => moved.before[c]), m.kept_id);
      await prepare('UPDATE customers SET active = 1, merged_into_id = NULL, updated_at = now() WHERE id = ?').run(m.other_id);
      await prepare('UPDATE customer_merges SET undone_at = now() WHERE id = ?').run(m.id);
      await dbExec('COMMIT');
      sendJson(res, 200, { ok: true });
    } catch (err) {
      await dbExec('ROLLBACK');
      throw err;
    }
  });
}
