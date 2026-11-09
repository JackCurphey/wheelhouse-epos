// Store credit, pay-later accounts and Ways to pay (openspec/changes/finish-customers, design
// 1, 2 and 4; cs-credit, cs-account, cs-transfer, set-pay-ways; customer service decisions 6
// and 10). Staff routes in the shop's row-level security, so another business's customer or
// entry is a 404. Amounts in whole pence. Any staff member adds or takes credit, "like a
// discount"; the Owner changes Ways to pay and undoes a mistaken entry (until roles).
import { prepare, dbExec } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { whoIsBooking } from './purchase-orders.js';
import { SAVE_LOCK_WAIT } from './products.js';
import { shopToday } from '../clock.js';
import { sendEmailTo } from '../messaging/engine.js';
import { statementEmail } from '../messaging/statement-email.js';
import {
  AMOUNT_WORDS, MAX_REASON, accountEntries, accountFigures, changeAmount, creditEntries, creditOf, lockCustomer, owedOf, owingInAll,
  paymentSettings, pounds, serializePaymentSettings, writeAccountEntry, writeCreditEntry,
} from '../lib/customer-money.js';

const db = { prepare, exec: dbExec };
const validId = (v) => Number.isInteger(v) && v > 0 && v <= 2_147_483_647;
const BUSY = { error: 'Someone else is changing this customer just now. Try again in a moment.', code: 'busy' };
const DELETED = 'This customer’s details were deleted at their request, so their money can’t be changed.';

// Who made the change: the person checked in at the till, else the sign-in's own name.
async function whoChanged(req) {
  const who = await whoIsBooking(req);
  if (who) return who;
  const ctx = await currentSession(req);
  return { loginId: ctx?.login.id ?? null, name: ctx?.login.name ?? null };
}

// Runs fn in a transaction that waits at most SAVE_LOCK_WAIT for the customer; fn returns
// [status, body], and anything but a success rolls back having written nothing.
async function inTransaction(res, fn) {
  await db.exec('BEGIN');
  try {
    await db.prepare(`SET LOCAL lock_timeout = '${SAVE_LOCK_WAIT}'`).run();
    const [status, body] = await fn();
    await db.exec(status < 300 ? 'COMMIT' : 'ROLLBACK');
    return sendJson(res, status, body);
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {});
    if (err.code === '55P03') return sendJson(res, 503, BUSY);
    throw err;
  }
}

const reasonOf = (v) => (typeof v === 'string' ? v.trim() : '');
const MAX_REFERENCE = 100;
// So the shop's sending can't mail a customer over and over (the receipt email's rule).
const STATEMENTS_PER_HOUR = 5;
const ACCOUNTS_OFF = 'Customer accounts are switched off in Settings › Payments.';
const shopZone = async () => (await db.prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';
// A real calendar day written YYYY-MM-DD.
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

// The customer's account as the Account pop-up shows it (cs-account).
async function accountOf(customerId, settings) {
  const c = await db.prepare('SELECT account_limit_pence, account_opened_at FROM customers WHERE id = ?').get(customerId);
  const figures = await accountFigures(customerId, settings);
  const statement = await accountEntries(customerId);
  return { ...figures, ownLimit: c.account_limit_pence ?? null, openedAt: c.account_opened_at ? new Date(c.account_opened_at).toISOString() : null, hasOpening: statement.some((e) => e.kind === 'opening' && !e.undone), statement,
    // The shop's day, for "Date it arrived" (cs-transfer starts at today and can't go past it).
    today: shopToday(await shopZone()) };
}

export function register(route) {
  // screens: set-pay-ways
  route('GET', '/api/payment-settings', async (req, res) => {
    sendJson(res, 200, serializePaymentSettings(await paymentSettings()));
  });

  // Each field saves on its own, as he goes. The row is read FOR UPDATE in a transaction, as
  // the other settings saves are (settings-saves-dont-clash).
  route('PUT', '/api/payment-settings', async (req, res) => {
    if (await ownerOnly(req, res)) return;
    const body = (await readJsonBody(req)) ?? {};
    const sets = [];
    const args = [];
    for (const [key, column] of [['storeCreditOn', 'store_credit_on'], ['accountsOn', 'accounts_on']]) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== 'boolean') return badRequest(res, 'Switch it on or off');
      sets.push(`${column} = ?`);
      args.push(body[key]);
    }
    if (body.accountLimitPence !== undefined) {
      const v = body.accountLimitPence;
      if (v !== null && !(Number.isSafeInteger(v) && v >= 0 && v <= 2_147_483_647)) return badRequest(res, AMOUNT_WORDS);
      sets.push('account_limit_pence = ?');
      args.push(v);
    }
    await paymentSettings();
    return inTransaction(res, async () => {
      const row = await db.prepare('SELECT id FROM payment_settings LIMIT 1 FOR UPDATE').get();
      // Not switched off while anyone owes (question 11): it stays on, saying who and how much.
      if (body.accountsOn === false) {
        const owing = await owingInAll();
        if (owing.customers > 0) {
          return [409, { error: `Customer accounts stay on while ${owing.customers === 1 ? '1 customer owes' : `${owing.customers} customers owe`} ${pounds(owing.pence)} in all.`, code: 'still_owed', ...owing }];
        }
      }
      if (sets.length) await db.prepare(`UPDATE payment_settings SET ${sets.join(', ')}, updated_at = now() WHERE id = ?`).run(...args, row.id);
      return [200, serializePaymentSettings(await db.prepare('SELECT * FROM payment_settings WHERE id = ?').get(row.id))];
    });
  });

  // screens: cs-credit
  route('GET', '/api/customers/:id/store-credit', async (req, res, params) => {
    const id = Number(params.id);
    const customer = validId(id) ? await db.prepare('SELECT id FROM customers WHERE id = ?').get(id) : null;
    if (!customer) return notFound(res, 'Customer not found');
    sendJson(res, 200, { credit: await creditOf(id), entries: await creditEntries(id) });
  });

  // Add credit or Take some away, with a reason (cs-credit). Never below nothing (design 2).
  route('POST', '/api/customers/:id/store-credit', async (req, res, params) => {
    const id = Number(params.id);
    if (!validId(id)) return notFound(res, 'Customer not found');
    const body = (await readJsonBody(req)) ?? {};
    if (!['add', 'take'].includes(body.change)) return badRequest(res, 'Add credit or take some away');
    if (!changeAmount(body.pence)) return badRequest(res, AMOUNT_WORDS);
    const reason = reasonOf(body.reason);
    if (!reason) return badRequest(res, 'Give a reason for the change');
    if (reason.length > MAX_REASON) return badRequest(res, `A reason can be up to ${MAX_REASON} characters`);
    const who = await whoChanged(req);
    const settings = await paymentSettings();
    return inTransaction(res, async () => {
      const customer = await lockCustomer(id);
      if (!customer) return [404, { error: 'Customer not found' }];
      if (customer.deleted_at) return [409, { error: DELETED, code: 'deleted' }];
      if (!settings.store_credit_on) return [409, { error: 'Store credit is switched off in Settings › Payments.', code: 'off' }];
      const credit = await creditOf(id);
      if (body.change === 'take' && body.pence > credit) return [409, { error: `${customer.name} has only ${pounds(credit)}`, code: 'not_enough', credit }];
      const changePence = body.change === 'add' ? body.pence : -body.pence;
      const entry = await writeCreditEntry(id, { changePence, kind: body.change === 'add' ? 'added' : 'taken', reason }, who);
      return [201, { entry, credit: credit + changePence }];
    });
  });

  // The Owner puts a mistaken change right, with a reason (design question 14): its own
  // entry, both staying visible. Once only; never below nothing.
  // screens: cs-credit
  route('POST', '/api/store-credit-entries/:id/undo', async (req, res, params) => {
    if (await ownerOnly(req, res, 'Only the shop’s owner can undo a change')) return;
    const entryId = Number(params.id);
    if (!validId(entryId)) return notFound(res, 'Entry not found');
    const body = (await readJsonBody(req)) ?? {};
    const reason = reasonOf(body.reason);
    if (!reason) return badRequest(res, 'Give a reason for undoing it');
    if (reason.length > MAX_REASON) return badRequest(res, `A reason can be up to ${MAX_REASON} characters`);
    const who = await whoChanged(req);
    const found = await db.prepare('SELECT customer_id FROM store_credit_entries WHERE id = ?').get(entryId);
    if (!found) return notFound(res, 'Entry not found');
    return inTransaction(res, async () => {
      const customer = await lockCustomer(found.customer_id);
      // Read again under the lock: a merge may have moved it since.
      const entry = await db.prepare('SELECT * FROM store_credit_entries WHERE id = ?').get(entryId);
      if (!customer || !entry || entry.customer_id !== customer.id) return [409, { error: 'That change has moved. Open the customer again.', code: 'moved' }];
      if (customer.deleted_at) return [409, { error: DELETED, code: 'deleted' }];
      if (entry.kind === 'undo' || entry.kind === 'lost_on_deletion') return [409, { error: 'That can’t be undone.', code: 'not_undoable' }];
      if (await db.prepare('SELECT 1 FROM store_credit_entries WHERE undoes_entry_id = ?').get(entryId)) return [409, { error: 'That change has already been undone.', code: 'undone' }];
      const credit = await creditOf(customer.id);
      if (credit - entry.change_pence < 0) return [409, { error: `${customer.name} has only ${pounds(credit)}, so this can’t be undone.`, code: 'not_enough', credit }];
      const undo = await writeCreditEntry(customer.id, { changePence: -entry.change_pence, kind: 'undo', reason, undoesEntryId: entryId }, who);
      return [201, { entry: undo, credit: credit - entry.change_pence }];
    });
  });

  // ---------- Accounts (cs-account, cs-transfer; Jack's 9 Nov answers 2 and 5) ----------

  // screens: cs-account
  route('GET', '/api/customers/:id/account', async (req, res, params) => {
    const id = Number(params.id);
    const customer = validId(id) ? await db.prepare('SELECT id FROM customers WHERE id = ?').get(id) : null;
    if (!customer) return notFound(res, 'Customer not found');
    sendJson(res, 200, await accountOf(id, await paymentSettings()));
  });

  // Only customers the Owner gives an account can owe (answer 2), at the shop's limit.
  // screens: cs-account
  route('POST', '/api/customers/:id/account/open', async (req, res, params) => {
    if (await ownerOnly(req, res, 'Only the shop’s owner can give someone an account')) return;
    const id = Number(params.id);
    if (!validId(id)) return notFound(res, 'Customer not found');
    const settings = await paymentSettings();
    return inTransaction(res, async () => {
      const customer = await lockCustomer(id);
      if (!customer) return [404, { error: 'Customer not found' }];
      if (customer.deleted_at) return [409, { error: DELETED, code: 'deleted' }];
      if (!settings.accounts_on) return [409, { error: ACCOUNTS_OFF, code: 'off' }];
      if (customer.account_opened_at) return [409, { error: `${customer.name} already has an account.`, code: 'already' }];
      await db.prepare('UPDATE customers SET account_opened_at = now(), updated_at = now() WHERE id = ?').run(id);
      return [200, await accountOf(id, settings)];
    });
  });

  // Her own limit, or null for the shop's again. The Owner's, the drawing's "a manager" until roles.
  // screens: cs-account
  route('PUT', '/api/customers/:id/account/limit', async (req, res, params) => {
    if (await ownerOnly(req, res, 'Only the shop’s owner can change what a customer can owe')) return;
    const id = Number(params.id);
    if (!validId(id)) return notFound(res, 'Customer not found');
    const body = (await readJsonBody(req)) ?? {};
    const pence = body.pence;
    if (pence !== null && !(Number.isSafeInteger(pence) && pence >= 0 && pence <= 2_147_483_647)) return badRequest(res, AMOUNT_WORDS);
    const settings = await paymentSettings();
    return inTransaction(res, async () => {
      const customer = await lockCustomer(id);
      if (!customer) return [404, { error: 'Customer not found' }];
      if (customer.deleted_at) return [409, { error: DELETED, code: 'deleted' }];
      await db.prepare('UPDATE customers SET account_limit_pence = ?, updated_at = now() WHERE id = ?').run(pence, id);
      return [200, await accountOf(id, settings)];
    });
  });

  // What they owed when the shop started with Wheelhouse, typed once by the Owner (answer 5).
  // screens: cs-account
  route('POST', '/api/customers/:id/account/opening', async (req, res, params) => {
    if (await ownerOnly(req, res, 'Only the shop’s owner can enter what was owed before Wheelhouse')) return;
    const id = Number(params.id);
    if (!validId(id)) return notFound(res, 'Customer not found');
    const body = (await readJsonBody(req)) ?? {};
    if (!changeAmount(body.pence)) return badRequest(res, AMOUNT_WORDS);
    const who = await whoChanged(req);
    const settings = await paymentSettings();
    return inTransaction(res, async () => {
      const customer = await lockCustomer(id);
      if (!customer) return [404, { error: 'Customer not found' }];
      if (customer.deleted_at) return [409, { error: DELETED, code: 'deleted' }];
      if (!settings.accounts_on) return [409, { error: ACCOUNTS_OFF, code: 'off' }];
      if (!customer.account_opened_at) return [409, { error: `Give ${customer.name} an account first.`, code: 'no_account' }];
      // One that stands: an opening the Owner undid (mistyped) can be entered again.
      if (await db.prepare("SELECT 1 FROM account_entries o WHERE o.customer_id = ? AND o.kind = 'opening' AND NOT EXISTS (SELECT 1 FROM account_entries u WHERE u.undoes_entry_id = o.id)").get(id)) {
        return [409, { error: 'What was owed before Wheelhouse has already been entered.', code: 'already' }];
      }
      const entry = await writeAccountEntry(id, { changePence: body.pence, kind: 'opening' }, who);
      return [201, { entry, owed: await owedOf(id) }];
    });
  });

  // A bank transfer: never more than is owed (question 14), never in the future, and never in
  // the till's takings (design 3: only account_entries, so close the day can't see it).
  // screens: cs-transfer
  route('POST', '/api/customers/:id/account/transfers', async (req, res, params) => {
    const id = Number(params.id);
    if (!validId(id)) return notFound(res, 'Customer not found');
    const body = (await readJsonBody(req)) ?? {};
    if (!changeAmount(body.pence)) return badRequest(res, AMOUNT_WORDS);
    if (!isDay(body.receivedOn)) return badRequest(res, 'Say the day it arrived');
    if (body.receivedOn > shopToday(await shopZone())) return badRequest(res, 'The day it arrived can’t be after today');
    const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
    if (reference.length > MAX_REFERENCE) return badRequest(res, `A reference can be up to ${MAX_REFERENCE} characters`);
    const who = await whoChanged(req);
    const settings = await paymentSettings();
    return inTransaction(res, async () => {
      const customer = await lockCustomer(id);
      if (!customer) return [404, { error: 'Customer not found' }];
      if (customer.deleted_at) return [409, { error: DELETED, code: 'deleted' }];
      if (!settings.accounts_on) return [409, { error: ACCOUNTS_OFF, code: 'off' }];
      const owed = await owedOf(id);
      if (body.pence > owed) return [409, { error: `${customer.name} owes only ${pounds(owed)}`, code: 'more_than_owed', owed }];
      const entry = await writeAccountEntry(id, { changePence: -body.pence, kind: 'bank_transfer', reference: reference || null, receivedOn: body.receivedOn }, who);
      return [201, { entry, owed: owed - body.pence }];
    });
  });

  // The Owner puts a mistaken entry right with a reason (question 14); both stay on the statement.
  // screens: cs-account
  route('POST', '/api/account-entries/:id/undo', async (req, res, params) => {
    if (await ownerOnly(req, res, 'Only the shop’s owner can undo a change')) return;
    const entryId = Number(params.id);
    if (!validId(entryId)) return notFound(res, 'Entry not found');
    const body = (await readJsonBody(req)) ?? {};
    const reason = reasonOf(body.reason);
    if (!reason) return badRequest(res, 'Give a reason for undoing it');
    if (reason.length > MAX_REASON) return badRequest(res, `A reason can be up to ${MAX_REASON} characters`);
    const who = await whoChanged(req);
    const found = await db.prepare('SELECT customer_id FROM account_entries WHERE id = ?').get(entryId);
    if (!found) return notFound(res, 'Entry not found');
    return inTransaction(res, async () => {
      const customer = await lockCustomer(found.customer_id);
      const entry = await db.prepare('SELECT * FROM account_entries WHERE id = ?').get(entryId);
      if (!customer || !entry || entry.customer_id !== customer.id) return [409, { error: 'That entry has moved. Open the customer again.', code: 'moved' }];
      if (customer.deleted_at) return [409, { error: DELETED, code: 'deleted' }];
      if (entry.kind === 'undo') return [409, { error: 'That can’t be undone.', code: 'not_undoable' }];
      if (await db.prepare('SELECT 1 FROM account_entries WHERE undoes_entry_id = ?').get(entryId)) return [409, { error: 'That has already been undone.', code: 'undone' }];
      const owed = await owedOf(customer.id);
      if (owed - entry.change_pence < 0) return [409, { error: `${customer.name} owes only ${pounds(owed)}, so this can’t be undone.`, code: 'below_nothing', owed }];
      const undo = await writeAccountEntry(customer.id, { changePence: -entry.change_pence, kind: 'undo', reason, undoesEntryId: entryId }, who);
      return [201, { entry: undo, owed: owed - entry.change_pence }];
    });
  });

  // Email the statement (cs-account): to a company's "Send invoices to" address, else their
  // email; at most five an hour for one customer, as receipts are.
  // screens: cs-account
  route('POST', '/api/customers/:id/account/email-statement', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    const id = Number(params.id);
    const customer = validId(id) ? await db.prepare('SELECT id, deleted_at FROM customers WHERE id = ? AND merged_into_id IS NULL').get(id) : null;
    if (!customer) return notFound(res, 'Customer not found');
    if (customer.deleted_at) return sendJson(res, 409, { error: DELETED, code: 'deleted' });
    const email = await statementEmail(id, shopId);
    if (!email.to) return sendJson(res, 409, { error: 'There’s no email address to send it to. Add one in their details.', code: 'no_email' });
    const { n } = await db.prepare("SELECT count(*)::int AS n FROM customer_messages WHERE customer_id = ? AND template_key = 'statement' AND created_at > now() - interval '1 hour'").get(id);
    if (n >= STATEMENTS_PER_HOUR) return sendJson(res, 429, { error: 'The statement has been sent five times in the last hour. Try again later.', code: 'too_many' });
    const messageId = await sendEmailTo({ to: email.to, subject: email.subject, body: email.body, customerId: id, loginId: ctx?.login.id ?? null, templateKey: 'statement' });
    sendJson(res, 200, { id: messageId, to: email.to });
  });
}
