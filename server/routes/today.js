// Today's Needs attention (openspec/changes/today-page; op-today; Jack, 30 Sep,
// opening the shop decisions 3 and 4): one list of what's waiting on the
// shop, for the Owner. Each item has a `kind` and what its line shows; later
// packages add kinds here (a short float, stock below zero, online orders…),
// so Today grows a line per kind and nothing else changes.
import { prepare } from '../db.js';
import { currentSession } from '../lib/session.js';
import { sendJson } from '../lib/http.js';
import { WORKSHOP_JOB_SELECT } from '../workshop/jobs.js';
import { conversations } from '../workshop/job-notes.js';

const iso = (v) => (v ? new Date(v).toISOString() : null);

// Quotes sent and reminded with no answer: the job page's own rule (the
// reminder time is only there while the current quote is sent and
// unanswered, server/workshop/jobs.js), on a booking that hasn't ended
// (fresh review: a cancelled job's line could never be cleared). Waiting
// longest first; the customer's phone in the same query.
async function quotesWithNoAnswer() {
  const rows = await prepare(`SELECT j.*, cp.phone FROM (${WORKSHOP_JOB_SELECT}
    WHERE qr.at IS NOT NULL AND w.booking_state NOT IN ('cancelled', 'declined', 'expired')) j
    LEFT JOIN customers cp ON cp.id = j.customer_id
    ORDER BY j.quote_reminder_sent_at, j.id`).all();
  return rows.map((r) => ({
    kind: 'quote_no_answer', jobId: r.id, reference: r.reference, customerName: r.customer_name ?? null,
    phone: r.phone || null, sentAt: iso(r.quote_sent_at), reminderSentAt: iso(r.quote_reminder_sent_at),
  }));
}

// Customers' messages waiting for a reply: one line, how many and the oldest
// (ac-today), as Front desk › Messages counts them.
async function replies() {
  const { items, count } = await conversations('needs-reply');
  if (!count) return [];
  const oldest = items.reduce((a, b) => (a.lastAt <= b.lastAt ? a : b));
  return [{ kind: 'replies', count, oldestName: oldest.customerName, oldestAt: oldest.lastAt }];
}

// Bikes ready and still in the shop for longer than the shop's Today days,
// not contacted since they were marked ready (WP-4.3, cp-today-uncollected;
// collect and pay review item 4, H4, M5). Waiting longest first; each with
// when its Bike still waiting went, if it has.
async function uncollectedBikes() {
  const rows = await prepare(
    `SELECT w.id, w.reference, w.signed_off_at, c.name AS customer_name, c.phone,
            NULLIF(trim(coalesce(b.make, '') || ' ' || coalesce(b.model, '')), '') AS bike_label,
            (SELECT max(m.sent_at) FROM customer_messages m
              WHERE m.job_id = w.id AND m.template_key = 'bike_still_waiting' AND m.sent_at >= w.signed_off_at) AS reminder_sent_at
       FROM workshop_jobs w
       LEFT JOIN customers c ON c.id = w.customer_id
       LEFT JOIN customer_bikes b ON b.id = w.bike_id
      WHERE w.custody_state = 'in_shop' AND w.work_state = 'complete' AND w.signed_off_at IS NOT NULL
        AND w.signed_off_at <= now() - make_interval(days => COALESCE((SELECT collection_today_days FROM workshop_settings LIMIT 1), 7))
        AND (w.uncollected_contacted_at IS NULL OR w.uncollected_contacted_at < w.signed_off_at)
      ORDER BY w.signed_off_at, w.id`
  ).all();
  return rows.map((r) => ({
    kind: 'uncollected', jobId: r.id, reference: r.reference, customerName: r.customer_name ?? null, bikeLabel: r.bike_label ?? null,
    phone: r.phone || null, readySince: iso(r.signed_off_at), reminderSentAt: iso(r.reminder_sent_at),
  }));
}

export function register(route) {
  // Owner only until roles (decision 4: Tills and Needs attention are for
  // owners, managers and anyone who can close the day; WP-1.1 opens it to them).
  route('GET', '/api/needs-attention', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, { error: "Only the shop's owner sees what needs attention", code: 'owner_only' });
    sendJson(res, 200, { items: [...(await quotesWithNoAnswer()), ...(await uncollectedBikes()), ...(await replies())] });
  });

  // Contacted on an uncollected bike's line (cp-today-uncollected; H4): who and
  // when, which takes it off Today until it's marked ready again. Owner only,
  // as the list; refused for a bike that isn't on it.
  // screens: collection
  route('POST', '/api/workshop-jobs/:id/contacted', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, { error: "Only the shop's owner sees what needs attention", code: 'owner_only' });
    const id = Number(params.id);
    if (!Number.isInteger(id)) return sendJson(res, 404, { error: 'Job not found' });
    if (!(await uncollectedBikes()).some((b) => b.jobId === id)) {
      return sendJson(res, 409, { error: 'That bike isn’t waiting to be collected any more.', code: 'not_uncollected' });
    }
    await prepare('UPDATE workshop_jobs SET uncollected_contacted_at = now(), uncollected_contacted_by_login_id = ? WHERE id = ?').run(ctx.login.id, id);
    sendJson(res, 200, { ok: true });
  });
}
