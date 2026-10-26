// Review requests (openspec/changes/review-requests; account and reminders
// decisions 5 and 8): set up when a bike is collected, for a customer who said
// yes to review requests, when the shop has switched them on with its review
// page; at the shop's days after collection, when the shop opens; checked
// again and written afresh when it goes, as the service reminder is. Inside
// the shop's runWithShop throughout.
import { prepare } from '../db.js';
import { channelFor, queueMessage, whyNotQueued } from './engine.js';
import { render, templateFor } from './templates.js';
import { dueAt, stopLine, STOP_LINE } from './service-reminders.js';
import { stopLink } from './stop-codes.js';
import { messageLink } from '../workshop/job-messages.js';

const KEY = 'review_request';

async function reviewPage() {
  return (await prepare('SELECT review_page_url, review_request_days FROM workshop_settings LIMIT 1').get()) ?? {};
}

async function reviewVars(jobId, shopId, page) {
  const job = await prepare(
    'SELECT c.name AS customer_name FROM workshop_jobs w LEFT JOIN customers c ON c.id = w.customer_id WHERE w.id = ?'
  ).get(jobId);
  // On the shop's own connection, never a second one from the pool while this
  // one is held (openspec/changes/server-stays-up-when-busy).
  const shop = await prepare('SELECT name FROM shops WHERE id = ?').get(shopId);
  return {
    'Customer’s first name': (job?.customer_name ?? '').trim().split(/\s+/)[0],
    'Shop name': shop.name,
    // The shop's own page, so it's real even while sending is pretend.
    'Link to review': page,
  };
}

/** Sets up the review request for a job just collected; returns it, or null. */
export async function queueReviewRequest(jobId, shopId, base) {
  const job = await prepare(
    `SELECT w.customer_id, c.review_requests FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id
      WHERE w.id = ? AND w.custody_state = 'collected' AND w.collected_at IS NOT NULL`
  ).get(jobId);
  if (!job?.review_requests) return null;
  const { review_page_url: page, review_request_days: days } = await reviewPage();
  if (!page) return null;
  // Off, or no way to reach them: nothing, and no stop code made for it.
  if (await whyNotQueued(KEY, job.customer_id)) return null;
  await prepare("UPDATE customer_messages SET intent_state = 'undone', status = 'undone' WHERE template_key = 'review_request' AND intent_state = 'intended' AND job_id = ?").run(jobId);
  const at = await dueAt(jobId, { days });
  const link = await messageLink(async () => {
    const shop = await prepare('SELECT slug FROM shops WHERE id = ?').get(shopId);
    return stopLink(base, shop.slug, job.customer_id, 'review_requests');
  });
  const queued = await queueMessage({ customerId: job.customer_id, jobId, key: KEY, vars: await reviewVars(jobId, shopId, page), at, ending: stopLine(link) });
  return queued.skipped ? null : queued;
}

/** When it comes due: whether it still goes, and its words written now; null to undo it. */
export async function reviewRequestNow(m, shopId) {
  if (!m.job_id) return null;
  const job = await prepare(
    `SELECT w.id, w.customer_id, c.review_requests, c.phone, c.email, c.update_channel
       FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id
      WHERE w.id = ? AND w.custody_state = 'collected'`
  ).get(m.job_id);
  if (!job?.review_requests) return null;
  const template = await templateFor(KEY);
  const { review_page_url: page } = await reviewPage();
  const how = channelFor(job);
  if (!template.enabled || !page || !how) return null;
  const vars = await reviewVars(job.id, shopId, page);
  return {
    customerId: job.customer_id,
    body: `${render(template.wording, vars)} ${m.ending ?? STOP_LINE}`,
    subject: how.channel === 'email' ? render(template.subject, vars) : null,
    channel: how.channel,
    to: how.to,
  };
}
