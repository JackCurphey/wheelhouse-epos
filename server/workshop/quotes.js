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
import { prepare } from '../db.js';
import { quote as quoteMachine, canApprove } from './state-machines.js';

async function insertLines(quoteId, lines) {
  for (const line of lines) {
    await prepare(
      `INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, product_id, quantity, unit_amount)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(quoteId, line.kind, line.description, line.productId ?? null, line.quantity ?? 1, line.unitAmount);
  }
}

// Creates the next revision for a job, superseding the current one. A quote
// still in draft has not been seen by anyone, so its lines are replaced in
// place rather than spending a revision number on a proposal nobody read.
export async function createRevision({ jobId, lines }) {
  if (!lines?.length) return { ok: false, code: 'illegal', message: 'a quote needs at least one line' };
  for (const line of lines) {
    if (!['labour', 'part'].includes(line.kind)) {
      return { ok: false, code: 'illegal', message: "each line's kind must be 'labour' or 'part'" };
    }
    if (!Number.isFinite(Number(line.unitAmount))) {
      return { ok: false, code: 'illegal', message: 'each line needs a unitAmount' };
    }
  }

  const job = await prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
  if (!job) return { ok: false, code: 'not_found', message: 'Job not found' };

  const current = await prepare(
    'SELECT * FROM workshop_quotes WHERE workshop_job_id = ? ORDER BY revision DESC LIMIT 1'
  ).get(jobId);

  if (current?.state === 'draft') {
    await prepare('DELETE FROM workshop_quote_lines WHERE workshop_quote_id = ?').run(current.id);
    await insertLines(current.id, lines);
    return { ok: true, quote: current };
  }

  if (current && !quoteMachine.can(current.state, 'revise')) {
    // declined, superseded and expired are rest states with no way out. What a
    // shop does when a customer declines and then changes their mind is a real
    // question, and the machines do not answer it - so this refuses rather than
    // inventing a transition. Raised for Phase 4.
    return { ok: false, code: 'illegal', message: `a quote that is ${current.state} cannot be revised` };
  }

  if (current) {
    await prepare('UPDATE workshop_quotes SET state = ? WHERE id = ?')
      .run(quoteMachine.next(current.state, 'revise'), current.id);
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
  await prepare('UPDATE workshop_quotes SET state = ? WHERE id = ?')
    .run(quoteMachine.next(row.state, 'send'), quoteId);
  return { ok: true, quote: await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId) };
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
  const { changes } = await prepare(
    'UPDATE workshop_quote_lines SET decision = ? WHERE id = ? AND workshop_quote_id = ?'
  ).run(decision, lineId, quoteId);
  if (changes === 0) return { ok: false, code: 'not_found', message: 'Quote line not found' };
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

  return { ok: true, quote: await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId) };
}

export function serializeQuote(row) {
  return {
    id: row.id,
    workshopJobId: row.workshop_job_id,
    revision: row.revision,
    state: row.state,
    createdAt: row.created_at,
  };
}

// Totals are summed by Postgres, never in JavaScript. Money is a JS float in
// this codebase (decided 20 Sep) and the mitigation that makes that safe is
// that JS never does the arithmetic - it carries a number the database
// computed. A reduce() over these lines would reintroduce exactly the drift
// the decision was taken to avoid.
const LINE_TOTALS = `
  SELECT
    id, kind, description, product_id, quantity, unit_amount, decision,
    (quantity * unit_amount) AS line_total
  FROM workshop_quote_lines
  WHERE workshop_quote_id = ?
  ORDER BY id
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
    })),
    totals: {
      all: Number(totals.all_total),
      approved: Number(totals.approved_total),
      pending: Number(totals.pending_total),
      declined: Number(totals.declined_total),
    },
  };
}
