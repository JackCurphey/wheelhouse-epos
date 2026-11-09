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
import {
  AMOUNT_WORDS, MAX_REASON, changeAmount, creditEntries, creditOf, lockCustomer, paymentSettings, pounds,
  serializePaymentSettings, writeCreditEntry,
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
}
