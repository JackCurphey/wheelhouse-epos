// Store credit and pay-later accounts (openspec/changes/finish-customers, design 1 and 2).
// Every change is its own entry in whole pence, never edited; a balance is the sum of a
// customer's entries. Every write runs in the caller's transaction after lockCustomer, so two
// tills at once queue rather than overdraw, and a deletion or merge at the same moment waits.
// Runs in the request's shop, so row-level security keeps it to that business.
import { prepare } from '../db.js';
import { penceText } from './money-text.js';

// The most one change can be: £1,000,000.00, well inside an INTEGER column.
export const MAX_CHANGE_PENCE = 100_000_000;
export const AMOUNT_WORDS = 'Pounds and pence, like 5.00';
export const MAX_REASON = 200;
export const pounds = (pence) => penceText(pence);
// A whole number of pence above nothing; a JSON number only.
export const changeAmount = (v) => Number.isSafeInteger(v) && v > 0 && v <= MAX_CHANGE_PENCE;

// Ways to pay (set-pay-ways): the shop's row, made the first time it's read, as label
// settings are. Both start off (design question 11).
export async function paymentSettings() {
  let row = await prepare('SELECT * FROM payment_settings LIMIT 1').get();
  if (!row) {
    await prepare('INSERT INTO payment_settings DEFAULT VALUES ON CONFLICT (shop_id) DO NOTHING').run();
    row = await prepare('SELECT * FROM payment_settings LIMIT 1').get();
  }
  return row;
}
export const serializePaymentSettings = (row) => ({
  storeCreditOn: row.store_credit_on,
  accountsOn: row.accounts_on,
  accountLimitPence: row.account_limit_pence,
});

// The customer's row, locked until the caller's transaction ends; null when it isn't this
// business's or was merged into another.
export const lockCustomer = (customerId) => prepare(
  'SELECT id, name, deleted_at, merged_into_id, account_opened_at, account_limit_pence FROM customers WHERE id = ? AND merged_into_id IS NULL FOR UPDATE'
).get(customerId);

export const creditOf = async (customerId) => Number((await prepare(
  'SELECT COALESCE(sum(change_pence), 0) AS s FROM store_credit_entries WHERE customer_id = ?'
).get(customerId)).s);
export const owedOf = async (customerId) => Number((await prepare(
  'SELECT COALESCE(sum(change_pence), 0) AS s FROM account_entries WHERE customer_id = ?'
).get(customerId)).s);

/** The customer page's money, with only the switched-on ways to pay (design 4). */
export async function moneyFor(customerId, settings) {
  const money = { storeCreditOn: settings.store_credit_on, accountsOn: settings.accounts_on };
  if (settings.store_credit_on) money.credit = await creditOf(customerId);
  if (settings.accounts_on) Object.assign(money, await accountFigures(customerId, settings));
  return money;
}

/**
 * What a customer owes on account and the most they can owe (cs-account, cs-page-over): their
 * own limit, else the shop's; overBy is how far over it they are, 0 within it or with no limit.
 */
export async function accountFigures(customerId, settings) {
  const c = await prepare('SELECT account_opened_at, account_limit_pence FROM customers WHERE id = ?').get(customerId);
  const owed = await owedOf(customerId);
  const shopLimit = settings.account_limit_pence ?? null;
  const limit = c?.account_limit_pence ?? shopLimit;
  return { owed, hasAccount: Boolean(c?.account_opened_at), limit, shopLimit, overBy: limit !== null && owed > limit ? owed - limit : 0 };
}

/** A customer's account entries, newest first (the statement, question 12). */
export async function accountEntries(customerId) {
  const rows = await prepare(
    `SELECT e.id, e.change_pence, e.kind, e.reference, to_char(e.received_on, 'YYYY-MM-DD') AS received_on, e.sale_id, e.till_sale_id,
            e.reason, e.who_name, e.created_at, e.undoes_entry_id,
            EXISTS (SELECT 1 FROM account_entries u WHERE u.undoes_entry_id = e.id) AS undone,
            (SELECT k.kind FROM account_entries k WHERE k.id = e.undoes_entry_id) AS undoes_kind
       FROM account_entries e WHERE e.customer_id = ? ORDER BY e.created_at DESC, e.id DESC`
  ).all(customerId);
  return rows.map(serializeAccountEntry);
}
export const serializeAccountEntry = (r) => ({
  id: r.id,
  kind: r.kind,
  changePence: r.change_pence,
  reference: r.reference ?? null,
  receivedOn: r.received_on ?? null,
  saleId: r.sale_id ?? null,
  tillSaleId: r.till_sale_id ?? null,
  reason: r.reason ?? null,
  by: r.who_name ?? null,
  at: new Date(r.created_at).toISOString(),
  undoesEntryId: r.undoes_entry_id ?? null,
  undoesKind: r.undoes_kind ?? null,
  undone: Boolean(r.undone),
});

/** Writes one account entry; the caller has locked the customer and checked what's owed. */
export async function writeAccountEntry(customerId, { changePence, kind, reference = null, receivedOn = null, reason = null, undoesEntryId = null }, who = {}) {
  const { id } = await prepare(
    `INSERT INTO account_entries (customer_id, change_pence, kind, reference, received_on, reason, undoes_entry_id, login_id, who_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).get(customerId, changePence, kind, reference, receivedOn, reason, undoesEntryId, who.loginId ?? null, who.name ?? null);
  return (await accountEntries(customerId)).find((e) => e.id === id);
}

/** The history's transfer rows (design 4): bank transfers and their undoings. */
export async function accountHistory(customerId) {
  return (await accountEntries(customerId))
    .filter((e) => e.kind === 'bank_transfer' || (e.kind === 'undo' && e.undoesKind === 'bank_transfer'))
    .map((e) => ({ kind: 'account', id: e.id, change: e.kind, changePence: e.changePence, reference: e.reference, receivedOn: e.receivedOn, reason: e.reason, by: e.by, undone: e.undone, at: e.at }));
}

/** How many customers owe on account, and how much in all (question 11). */
export async function owingInAll() {
  const r = await prepare(
    'SELECT count(*)::int AS n, COALESCE(sum(s), 0)::bigint AS total FROM (SELECT sum(change_pence) AS s FROM account_entries GROUP BY customer_id HAVING sum(change_pence) > 0) t'
  ).get();
  return { customers: r.n, pence: Number(r.total) };
}

/** A customer's store credit entries, newest first, each saying whether it was undone. */
export async function creditEntries(customerId) {
  const rows = await prepare(
    `SELECT e.id, e.change_pence, e.kind, e.reason, e.who_name, e.created_at, e.undoes_entry_id,
            EXISTS (SELECT 1 FROM store_credit_entries u WHERE u.undoes_entry_id = e.id) AS undone
       FROM store_credit_entries e WHERE e.customer_id = ? ORDER BY e.created_at DESC, e.id DESC`
  ).all(customerId);
  return rows.map(serializeCreditEntry);
}
export const serializeCreditEntry = (r) => ({
  id: r.id,
  kind: r.kind,
  changePence: r.change_pence,
  reason: r.reason ?? null,
  by: r.who_name ?? null,
  at: new Date(r.created_at).toISOString(),
  undoesEntryId: r.undoes_entry_id ?? null,
  undone: Boolean(r.undone),
});

/** Writes one store credit entry; the caller has locked the customer and checked the balance. */
export async function writeCreditEntry(customerId, { changePence, kind, reason = null, undoesEntryId = null }, who = {}) {
  const row = await prepare(
    `INSERT INTO store_credit_entries (customer_id, change_pence, kind, reason, undoes_entry_id, login_id, who_name)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, change_pence, kind, reason, who_name, created_at, undoes_entry_id`
  ).get(customerId, changePence, kind, reason, undoesEntryId, who.loginId ?? null, who.name ?? null);
  return serializeCreditEntry({ ...row, undone: false });
}

/** The history's store credit rows (design 4), newest first is the caller's sort. */
export async function creditHistory(customerId) {
  return (await creditEntries(customerId)).map((e) => ({
    kind: 'store_credit', id: e.id, change: e.kind, changePence: e.changePence, reason: e.reason, by: e.by, undone: e.undone, at: e.at,
  }));
}
