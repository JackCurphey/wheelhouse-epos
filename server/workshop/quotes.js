// Quotes supersede rather than mutate. The amounts a customer saw when they
// agreed stay readable afterwards, which is what makes "you approved this" a
// statement the shop can stand behind rather than a claim about a row that has
// since changed.
//
// Line decisions and the quote's own state are recorded in two steps on
// purpose. The customer ticks each line while the quote is 'sent' (screen 21),
// and the quote moves exactly once, when they submit - which is the only shape
// the machine allows, since 'partly_approved' has no further decision events.
// Recording a line and moving the quote in the same call would need a
// transition the machine does not declare.
import { open } from 'node:fs/promises';
import path from 'node:path';
import { prepare, dbExec } from '../db.js';
import { UPLOADS_DIR } from '../lib/uploads.js';
import { sniffImage } from '../booking-photos.js';
import { quote as quoteMachine, canApprove } from './state-machines.js';
import { undoWaiting } from '../messaging/engine.js';

// A quote answered, withdrawn or replaced needs no reminder: one still
// waiting stops (Jack, 22 Oct; openspec/changes/quote-reminder).
const stopReminder = (jobId) => undoWaiting(jobId, 'quote_reminder');

const WITHOUT_MAX = 300;
const withoutText = (w) => (typeof w === 'string' ? w.trim() || null : null);

// A line's partner is named by its index in the same list (`goesWith`), since
// a draft's lines get new ids on every save; the ids are filled in once every
// line is in.
async function insertLines(quoteId, lines) {
  const ids = [];
  for (const line of lines) {
    const { lastInsertRowid } = await prepare(
      // Pence beside the pounds, from the same value (sales in pence, step A′).
      `INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, product_id, quantity, unit_amount, unit_amount_pence, need, reason, without_text, photo_attachment_id)
       VALUES (?, ?, ?, ?, ?, ?, ROUND(CAST(? AS numeric) * 100)::int, ?, ?, ?, ?)`
    ).run(quoteId, line.kind, line.description, line.productId ?? null, line.quantity ?? 1, line.unitAmount, line.unitAmount,
      line.need === 'optional' ? 'optional' : 'needed', line.reason ? String(line.reason).trim() || null : null, withoutText(line.without),
      line.photoId ?? null);
    ids.push(lastInsertRowid);
  }
  for (const [i, line] of lines.entries()) {
    if (line.goesWith !== undefined && line.goesWith !== null) {
      await prepare('UPDATE workshop_quote_lines SET goes_with_line_id = ? WHERE id = ?').run(ids[line.goesWith], ids[i]);
    }
  }
}

// The first bytes of a stored file, enough to tell a picture.
async function fileHead(storageKey) {
  const file = await open(path.join(UPLOADS_DIR, storageKey)).catch(() => null);
  if (!file) return Buffer.alloc(0);
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(16), 0, 16, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

// A line's photo (Jack, 1 Oct; one per line, as drawn): one of this job's
// files, and a JPEG, PNG or WebP picture by its bytes.
async function photoProblem(jobId, lines) {
  for (const line of lines) {
    if (line.photoId === undefined || line.photoId === null) continue;
    const file = Number.isInteger(line.photoId) && line.photoId > 0 && line.photoId <= 2147483647
      ? await prepare('SELECT storage_key FROM workshop_job_attachments WHERE id = ? AND workshop_job_id = ?').get(line.photoId, jobId)
      : null;
    if (!file || !sniffImage(await fileHead(file.storage_key))) return 'a quote line’s photo is a JPEG, PNG or WebP picture of this job';
  }
  return null;
}

// Goes with (decision 7, M2): only a labour line, and only with a part in the
// same list, so a pair never chains and no line goes with itself.
function pairProblem(lines) {
  for (const line of lines) {
    if (line.goesWith === undefined || line.goesWith === null) continue;
    const partner = Number.isInteger(line.goesWith) ? lines[line.goesWith] : undefined;
    if (line.kind !== 'labour' || !partner || partner.kind !== 'part') {
      return 'a labour line can go with one of the quote’s parts only';
    }
  }
  for (const line of lines) {
    if (line.without !== undefined && line.without !== null && typeof line.without !== 'string') {
      return 'what happens without it is some words';
    }
    if (withoutText(line.without)?.length > WITHOUT_MAX) {
      return `what happens without it can be up to ${WITHOUT_MAX} letters`;
    }
  }
  return null;
}

// Creates the next revision for a job, superseding the current one. A quote
// still in draft has not been seen by anyone, so its lines are replaced in
// place rather than spending a revision number on a proposal nobody read.
// In one transaction, so a refusal part-way (a file removed at the same
// moment, say) can't leave a draft with its lines half replaced (fresh review).
export async function createRevision(args) {
  await dbExec('BEGIN');
  try {
    const result = await createRevisionInTransaction(args);
    await dbExec('COMMIT');
    return result;
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
}

async function createRevisionInTransaction({ jobId, lines }) {
  if (!lines?.length) return { ok: false, code: 'illegal', message: 'a quote needs at least one line' };
  for (const line of lines) {
    if (!['labour', 'part'].includes(line.kind)) {
      return { ok: false, code: 'illegal', message: "each line's kind must be 'labour' or 'part'" };
    }
    if (!Number.isFinite(Number(line.unitAmount))) {
      return { ok: false, code: 'illegal', message: 'each line needs a unitAmount' };
    }
    if (line.need !== undefined && !['needed', 'optional'].includes(line.need)) {
      return { ok: false, code: 'illegal', message: "each line's need must be 'needed' or 'optional'" };
    }
  }

  const problem = pairProblem(lines);
  if (problem) return { ok: false, code: 'illegal', message: problem };

  const job = await prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
  if (!job) return { ok: false, code: 'not_found', message: 'Job not found' };
  const photo = await photoProblem(jobId, lines);
  if (photo) return { ok: false, code: 'illegal', message: photo };

  const current = await prepare(
    'SELECT * FROM workshop_quotes WHERE workshop_job_id = ? ORDER BY revision DESC LIMIT 1'
  ).get(jobId);

  if (current?.state === 'draft') {
    await prepare('DELETE FROM workshop_quote_lines WHERE workshop_quote_id = ?').run(current.id);
    await insertLines(current.id, lines);
    return { ok: true, quote: current };
  }

  // A withdrawn quote is finished with; a new quote is simply the next
  // revision, with nothing to supersede (journey 4 decision 7).
  if (current?.state === 'withdrawn') {
    const { lastInsertRowid: quoteId } = await prepare(
      "INSERT INTO workshop_quotes (workshop_job_id, revision, state) VALUES (?, ?, 'draft')"
    ).run(jobId, current.revision + 1);
    await insertLines(quoteId, lines);
    return { ok: true, quote: await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId) };
  }

  if (current && !quoteMachine.can(current.state, 'revise')) {
    // superseded and expired are rest states with no way out. A declined
    // quote can be revised (Jack, 22 Oct: the customer changed their mind).
    return { ok: false, code: 'illegal', message: `a quote that is ${current.state} cannot be revised` };
  }

  if (current) {
    await prepare('UPDATE workshop_quotes SET state = ? WHERE id = ?')
      .run(quoteMachine.next(current.state, 'revise'), current.id);
    await stopReminder(jobId);
  }

  const revision = current ? current.revision + 1 : 1;
  const { lastInsertRowid: quoteId } = await prepare(
    "INSERT INTO workshop_quotes (workshop_job_id, revision, state) VALUES (?, ?, 'draft')"
  ).run(jobId, revision);
  await insertLines(quoteId, lines);

  return { ok: true, quote: await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId) };
}

// Moves a draft to sent. Separate from createRevision because building a quote
// and showing it to a customer are different acts, and the shop does the second
// deliberately (screen 20).
export async function send({ quoteId }) {
  const row = await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId);
  if (!row) return { ok: false, code: 'not_found', message: 'Quote not found' };
  if (!quoteMachine.can(row.state, 'send')) {
    return { ok: false, code: 'illegal', message: `a quote that is ${row.state} cannot be sent` };
  }
  await prepare('UPDATE workshop_quotes SET state = ?, sent_at = now() WHERE id = ?')
    .run(quoteMachine.next(row.state, 'send'), quoteId);
  return { ok: true, quote: await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId) };
}

// The shop takes back a quote the customer hasn't answered (journey 4
// decision 7). Final; a new quote is the next revision (createRevision).
export async function withdraw({ quoteId }) {
  const row = await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId);
  if (!row) return { ok: false, code: 'not_found', message: 'Quote not found' };
  if (!quoteMachine.can(row.state, 'withdraw')) {
    return { ok: false, code: 'illegal', message: `a quote that is ${row.state} cannot be withdrawn` };
  }
  await prepare('UPDATE workshop_quotes SET state = ? WHERE id = ?').run(quoteMachine.next(row.state, 'withdraw'), quoteId);
  await stopReminder(row.workshop_job_id);
  return { ok: true, quote: await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId) };
}

// The whole answer at once - every line's yes or no, then the quote moves -
// for the customer on their booking link (via 'online') and for staff after a
// phone call or a chat in the shop (via 'phone' / 'in_shop', with who took it;
// journey 4 decision 4). Every line must be decided. `linkRevision`, when
// given (the booking link), must be the job's current revision, as approve()
// requires. Decisions stay final: a line already decided is refused.
// The caller runs this in a transaction.
export async function answerAll({ quoteId, jobId = null, decisions, via, loginId = null, linkRevision = undefined }) {
  if (!['online', 'phone', 'in_shop'].includes(via)) return { ok: false, code: 'illegal', message: "via must be 'online', 'phone' or 'in_shop'" };
  const row = await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId);
  if (!row || (jobId !== null && row.workshop_job_id !== jobId)) return { ok: false, code: 'not_found', message: 'Quote not found' };
  if (linkRevision !== undefined) {
    const { revision: currentRevision } = await prepare(
      'SELECT MAX(revision) AS revision FROM workshop_quotes WHERE workshop_job_id = ?'
    ).get(row.workshop_job_id);
    const verdict = canApprove({ quoteState: row.state, linkRevision, currentRevision });
    if (!verdict.allowed) return { ok: false, code: 'illegal', message: verdict.reason };
  } else if (row.state !== 'sent') {
    return { ok: false, code: 'illegal', message: `a quote that is ${row.state} is not open for an answer` };
  }
  const lines = await prepare('SELECT id, decision, description, goes_with_line_id FROM workshop_quote_lines WHERE workshop_quote_id = ?').all(quoteId);
  const given = new Map((Array.isArray(decisions) ? decisions : []).map((d) => [Number(d.lineId), d.decision]));
  if (lines.some((l) => !['approved', 'declined'].includes(given.get(l.id)))) {
    return { ok: false, code: 'illegal', message: 'every line needs a yes or a no before the answer can be saved' };
  }
  // Lines that go together are answered together (decision 2).
  for (const l of lines) {
    const partner = l.goes_with_line_id ? lines.find((p) => p.id === l.goes_with_line_id) : null;
    if (partner && given.get(l.id) !== given.get(partner.id)) {
      return { ok: false, code: 'pair', message: `Lines that go together need the same answer: ${l.description} goes with ${partner.description}.` };
    }
  }
  if (lines.some((l) => l.decision !== 'pending')) {
    return { ok: false, code: 'illegal', message: 'this quote has already been answered' };
  }
  for (const l of lines) {
    await prepare(
      `UPDATE workshop_quote_lines SET decision = ?, decided_via = ?, decided_by_login_id = ?, decided_at = now()
       WHERE id = ? AND decision = 'pending'`
    ).run(given.get(l.id), via, loginId, l.id);
  }
  const approved = lines.filter((l) => given.get(l.id) === 'approved').length;
  const event = approved === lines.length ? 'approve_all' : approved === 0 ? 'decline_all' : 'approve_some';
  await prepare('UPDATE workshop_quotes SET state = ? WHERE id = ?').run(quoteMachine.next(row.state, event), quoteId);
  await stopReminder(row.workshop_job_id);
  return { ok: true, quote: await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId) };
}

// What the customer answered on the job's quotes below a revision: only
// quotes answered in full (one changed before it was answered left no
// answers), and each line's latest answer, by its words, so pads said no to
// and then yes to are agreed (Jack, 22 Oct; fresh review). Oldest first.
const LATEST_ANSWERS = `
  WITH answered AS (
    SELECT DISTINCT ON (l.description) l.description, l.decision, (l.unit_amount * l.quantity) AS line_total, q.revision, l.id
      FROM workshop_quote_lines l JOIN workshop_quotes q ON q.id = l.workshop_quote_id
     WHERE q.workshop_job_id = ? AND q.revision < ? AND q.state <> 'draft' AND l.decision IN ('approved', 'declined')
       AND NOT EXISTS (SELECT 1 FROM workshop_quote_lines p WHERE p.workshop_quote_id = q.id AND p.decision = 'pending')
     ORDER BY l.description, q.revision DESC, l.id DESC
  )`;

export async function latestAnswers(jobId, belowRevision = 2147483647) {
  return prepare(`${LATEST_ANSWERS} SELECT description, decision, line_total FROM answered ORDER BY revision, id`).all(jobId, belowRevision);
}

// The new quote's "Already agreed" and "You said no thanks" (dq-quote-newer).
export async function earlierAnswers(quote) {
  const rows = await latestAnswers(quote.workshop_job_id, quote.revision);
  return {
    agreed: rows.filter((r) => r.decision === 'approved').map((r) => r.description),
    declined: rows.filter((r) => r.decision === 'declined').map((r) => r.description),
  };
}

// What the customer has agreed before this quote: the booked services (when
// their prices show online, as the booking page's total) and the earlier yeses,
// summed by the database. Null when nothing is agreed, or a booked price is
// unknown or hidden.
export async function agreedBefore(quote, showPrices) {
  const row = await prepare(
    `${LATEST_ANSWERS}
     SELECT (SELECT count(*) FROM workshop_job_services WHERE workshop_job_id = ?) AS services,
            (SELECT CASE WHEN count(*) = count(booked_price) THEN COALESCE(sum(booked_price), 0) END FROM workshop_job_services WHERE workshop_job_id = ?) AS booked,
            (SELECT count(*) FROM answered WHERE decision = 'approved') AS yeses,
            (SELECT COALESCE(sum(line_total), 0) FROM answered WHERE decision = 'approved') AS approved,
            ((SELECT CASE WHEN count(*) = count(booked_price) THEN COALESCE(sum(booked_price), 0) END FROM workshop_job_services WHERE workshop_job_id = ?)
              + (SELECT COALESCE(sum(line_total), 0) FROM answered WHERE decision = 'approved')) AS total`
  ).get(quote.workshop_job_id, quote.revision, quote.workshop_job_id, quote.workshop_job_id, quote.workshop_job_id);
  const services = Number(row.services);
  if (services === 0 && Number(row.yeses) === 0) return null;
  if (services > 0 && (!showPrices || row.booked === null)) return null;
  return services > 0 ? Number(row.total) : Number(row.approved);
}

// The job's quote a customer may see on their booking link: its latest
// revision, if that is customer-readable (a draft being written is not).
export async function currentQuoteForJob(jobId) {
  const quote = await prepare(
    'SELECT * FROM workshop_quotes WHERE workshop_job_id = ? ORDER BY revision DESC LIMIT 1'
  ).get(jobId);
  if (!quote || !CUSTOMER_READABLE_STATES.has(quote.state)) return { ok: false, reason: 'not_found' };
  const lines = await prepare(LINE_TOTALS).all(quote.id);
  const totals = await prepare(QUOTE_TOTALS).get(quote.id);
  return { ok: true, quote, lines, totals };
}

// The quote belongs to this customer, or it does not exist as far as they are
// concerned. RLS already hides another shop's rows; this is the check within a
// shop, customer to customer.
async function quoteForCustomer(quoteId, customerId) {
  return prepare(
    `SELECT q.* FROM workshop_quotes q
     JOIN workshop_jobs j ON j.id = q.workshop_job_id
     WHERE q.id = ? AND j.customer_id = ?`
  ).get(quoteId, customerId);
}

// One line's decision. Does not move the quote - see the header.
export async function recordLineDecision({ quoteId, lineId, decision, customerId }) {
  if (!['approved', 'declined'].includes(decision)) {
    return { ok: false, code: 'illegal', message: "decision must be 'approved' or 'declined'" };
  }
  const row = await quoteForCustomer(quoteId, customerId);
  if (!row) return { ok: false, code: 'not_found', message: 'Quote not found' };
  if (row.state !== 'sent') {
    return { ok: false, code: 'illegal', message: `a quote that is ${row.state} is not open for decisions` };
  }
  // A line in a pair can't be answered alone (decision 2): the whole answer
  // (answerAll) decides both together.
  const paired = await prepare(
    `SELECT 1 FROM workshop_quote_lines WHERE workshop_quote_id = ? AND id = ? AND (goes_with_line_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM workshop_quote_lines o WHERE o.goes_with_line_id = workshop_quote_lines.id))`
  ).get(quoteId, lineId);
  if (paired) return { ok: false, code: 'illegal', message: 'This line goes with another; answer the whole quote.' };
  // A decision is final (docs/decisions/2026-09-23-quote-line-decisions-are-final.md).
  // The UPDATE is constrained to a still-pending line rather than checked
  // first and written second: two taps on a slow phone would both pass a
  // prior read and the second would overwrite the first. Postgres decides,
  // once, and `changes === 0` then means the line is missing OR already
  // decided - so the two are told apart afterwards, by reading it back.
  const { changes } = await prepare(
    "UPDATE workshop_quote_lines SET decision = ? WHERE id = ? AND workshop_quote_id = ? AND decision = 'pending'"
  ).run(decision, lineId, quoteId);
  if (changes === 0) {
    const line = await prepare(
      'SELECT decision FROM workshop_quote_lines WHERE id = ? AND workshop_quote_id = ?'
    ).get(lineId, quoteId);
    if (!line) return { ok: false, code: 'not_found', message: 'Quote line not found' };
    return {
      ok: false,
      code: 'illegal',
      message: `that line is already ${line.decision} - to change it, the shop issues a new quote revision`,
    };
  }
  return { ok: true, quote: row };
}

// The guarded submit. canApprove() is asked before anything is written, and it
// checks two independent reasons to refuse: the link is for an older revision,
// or the quote is no longer live. Matching revision numbers do not make a
// superseded or expired quote approvable.
export async function approve({ quoteId, linkRevision, customerId }) {
  const row = await quoteForCustomer(quoteId, customerId);
  if (!row) return { ok: false, code: 'not_found', message: 'Quote not found' };

  const { revision: currentRevision } = await prepare(
    'SELECT MAX(revision) AS revision FROM workshop_quotes WHERE workshop_job_id = ?'
  ).get(row.workshop_job_id);

  const verdict = canApprove({ quoteState: row.state, linkRevision, currentRevision });
  if (!verdict.allowed) return { ok: false, code: 'illegal', message: verdict.reason };

  const lines = await prepare(
    'SELECT decision FROM workshop_quote_lines WHERE workshop_quote_id = ?'
  ).all(quoteId);
  if (lines.some((l) => l.decision === 'pending')) {
    return {
      ok: false,
      code: 'illegal',
      message: 'every line needs a decision before the quote can be approved',
    };
  }

  const approved = lines.filter((l) => l.decision === 'approved').length;
  const event = approved === lines.length ? 'approve_all' : approved === 0 ? 'decline_all' : 'approve_some';
  await prepare('UPDATE workshop_quotes SET state = ? WHERE id = ?')
    .run(quoteMachine.next(row.state, event), quoteId);
  await stopReminder(row.workshop_job_id);

  return { ok: true, quote: await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId) };
}

// Newest first. Every revision stays readable: Phase 3 supersedes rather than
// mutates, and screen 23 (approved) has to show what was agreed even after a
// later revision exists.
export async function listRevisions({ jobId }) {
  return prepare(
    'SELECT * FROM workshop_quotes WHERE workshop_job_id = ? ORDER BY revision DESC'
  ).all(jobId);
}

export function serializeQuote(row) {
  return {
    id: row.id,
    workshopJobId: row.workshop_job_id,
    revision: row.revision,
    state: row.state,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? null,
  };
}

// Totals are summed by Postgres, never in JavaScript. Money is a JS float in
// this codebase (decided 20 Sep) and the mitigation that makes that safe is
// that JS never does the arithmetic - it carries a number the database
// computed. A reduce() over these lines would reintroduce exactly the drift
// the decision was taken to avoid.
const LINE_TOTALS = `
  SELECT
    l.id, l.kind, l.description, l.product_id, l.quantity, l.unit_amount, l.decision,
    l.need, l.reason, l.decided_via, l.decided_at, l.added_to_order_at, who.name AS decided_by_name,
    l.goes_with_line_id, l.without_text, l.photo_attachment_id,
    (l.quantity * l.unit_amount) AS line_total
  FROM workshop_quote_lines l
  LEFT JOIN logins who ON who.id = l.decided_by_login_id
  WHERE l.workshop_quote_id = ?
  ORDER BY l.id
`;

const QUOTE_TOTALS = `
  SELECT
    COALESCE(SUM(quantity * unit_amount), 0) AS all_total,
    COALESCE(SUM(quantity * unit_amount) FILTER (WHERE decision = 'approved'), 0) AS approved_total,
    COALESCE(SUM(quantity * unit_amount) FILTER (WHERE decision = 'pending'), 0) AS pending_total,
    COALESCE(SUM(quantity * unit_amount) FILTER (WHERE decision = 'declined'), 0) AS declined_total
  FROM workshop_quote_lines
  WHERE workshop_quote_id = ?
`;

export async function readQuote({ quoteId }) {
  const quote = await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId);
  if (!quote) return { ok: false, reason: 'not_found' };
  const lines = await prepare(LINE_TOTALS).all(quoteId);
  const totals = await prepare(QUOTE_TOTALS).get(quoteId);
  return { ok: true, quote, lines, totals };
}

// States a customer may read over the portal. Named explicitly, rather than
// excluding 'draft' alone, so that a state added to the quote machine later
// (state-machines.js) stays hidden from customers by default until someone
// lists it here deliberately - an oversight then fails closed (404) instead
// of silently exposing a new state nobody reviewed for customer visibility.
export const CUSTOMER_READABLE_STATES = new Set([
  'sent',
  'partly_approved',
  'approved',
  'declined',
  'superseded',
  'expired',
  // The customer's page says the shop withdrew it (journey 4 decision 7).
  'withdrawn',
]);

// The complement, kept explicit so a test can assert every declared quote
// state is classified as exactly one of readable or hidden.
export const CUSTOMER_HIDDEN_STATES = new Set(['draft']);

// The portal's read of readQuote(). Scoped through quoteForCustomer - the same
// ownership check recordLineDecision() and approve() use - so a quote that
// belongs to another customer in the same shop comes back identical to one
// that does not exist at all: `reason: 'not_found'` either way. Anything else
// (a 403, a different message) would let a customer learn which quote ids are
// real by trying them.
//
// A draft is refused the same way, via CUSTOMER_READABLE_STATES above. This
// read does not show a draft or its prices - a nonexistent quote and a draft
// come back as the identical 404. send() documents showing a quote to a
// customer as a deliberate staff act (screen 20) - a draft is still being
// composed, so a customer must not be able to read one even if it is their
// own, by trying ids nearby the one they were sent. The portal WRITE routes
// (recordLineDecision, approve) are a separate path with their own state
// check, and they do distinguish a draft: their 409 message names the
// quote's state, which reveals that the draft exists (though never its
// prices or lines). This check stays here, on the customer-scoped read, not
// in readQuote() above: staff read drafts constantly (that is the whole
// point of the draft state) and this must not touch that path.
export async function readQuoteForCustomer({ quoteId, customerId }) {
  const quote = await quoteForCustomer(quoteId, customerId);
  if (!quote || !CUSTOMER_READABLE_STATES.has(quote.state)) return { ok: false, reason: 'not_found' };
  const lines = await prepare(LINE_TOTALS).all(quoteId);
  const totals = await prepare(QUOTE_TOTALS).get(quoteId);
  return { ok: true, quote, lines, totals };
}

export function serializeQuoteWithLines(quote, lines, totals) {
  return {
    ...serializeQuote(quote),
    lines: lines.map((l) => ({
      id: l.id,
      kind: l.kind,
      description: l.description,
      productId: l.product_id,
      quantity: Number(l.quantity),
      unitAmount: Number(l.unit_amount),
      decision: l.decision,
      lineTotal: Number(l.line_total),
      need: l.need,
      reason: l.reason ?? null,
      decidedVia: l.decided_via ?? null,
      decidedAt: l.decided_at ?? null,
      decidedByName: l.decided_by_name ?? null,
      addedToOrderAt: l.added_to_order_at ?? null,
      goesWithLineId: l.goes_with_line_id ?? null,
      without: l.without_text ?? null,
      photoId: l.photo_attachment_id ?? null,
    })),
    totals: {
      all: Number(totals.all_total),
      approved: Number(totals.approved_total),
      pending: Number(totals.pending_total),
      declined: Number(totals.declined_total),
    },
  };
}
