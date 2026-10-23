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
// unanswered, server/workshop/jobs.js). Waiting longest first.
async function quotesWithNoAnswer() {
  const rows = await prepare(`${WORKSHOP_JOB_SELECT} WHERE qr.at IS NOT NULL ORDER BY qr.at, w.id`).all();
  const items = [];
  for (const r of rows) {
    const customer = r.customer_id ? await prepare('SELECT phone FROM customers WHERE id = ?').get(r.customer_id) : null;
    items.push({
      kind: 'quote_no_answer', jobId: r.id, reference: r.reference, customerName: r.customer_name ?? null,
      phone: customer?.phone || null, sentAt: iso(r.quote_sent_at), reminderSentAt: iso(r.quote_reminder_sent_at),
    });
  }
  return items;
}

// Customers' messages waiting for a reply: one line, how many and the oldest
// (ac-today), as Front desk › Messages counts them.
async function replies() {
  const { items, count } = await conversations('needs-reply');
  if (!count) return [];
  const oldest = items.reduce((a, b) => (a.lastAt <= b.lastAt ? a : b));
  return [{ kind: 'replies', count, oldestName: oldest.customerName, oldestAt: oldest.lastAt }];
}

export function register(route) {
  // Owner only until roles (decision 4: Tills and Needs attention are for
  // owners, managers and anyone who can close the day; WP-1.1 opens it to them).
  route('GET', '/api/needs-attention', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, { error: "Only the shop's owner sees what needs attention", code: 'owner_only' });
    sendJson(res, 200, { items: [...(await quotesWithNoAnswer()), ...(await replies())] });
  });
}
