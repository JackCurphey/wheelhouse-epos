// A customer or bike row from Citrus Lime (openspec/changes/citrus-import-customers,
// design 4 to 8). Inside bringBatch's transaction.
import { prepare } from '../db.js';

export const NO_CUSTOMER = 'The customer on this bike isn’t in the customers file';
const look = (why) => ({ state: 'look', why });
const YES = /^(yes|true|y|1)$/i;
// The same index expression as migration 112.
const DIGITS = "regexp_replace(coalesce(phone, ''), '\\D', '', 'g')";
const LIVE = 'deleted_at IS NULL AND merged_into_id IS NULL';

// A number however it's written, as customers may hold it: 07700…, +44 7700…, 0044 7700….
function phoneForms(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  if (digits.length < 7) return [];
  const national = digits.startsWith('0044') ? digits.slice(4) : digits.startsWith('44') && digits.length === 12 ? digits.slice(2) : digits.startsWith('0') ? digits.slice(1) : digits;
  return [`0${national}`, `44${national}`, `0044${national}`, national];
}
const cleanEmail = (text) => String(text ?? '').trim().toLowerCase();
const realDay = (y, m, d) => {
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d ? at.toISOString().slice(0, 10) : null;
};
// Excel's day number, dd/mm/yyyy or yyyy-mm-dd, with or without a time; null otherwise.
export function consentDay(text) {
  const t = String(text ?? '').trim();
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const days = Math.floor(Number(t));
    return days >= 20000 && days < 80000 ? new Date(Date.UTC(1899, 11, 30 + days)).toISOString().slice(0, 10) : null;
  }
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(\s|$)/.exec(t);
  if (uk) return realDay(Number(uk[3]), Number(uk[2]), Number(uk[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})(\D|$)/.exec(t);
  return iso ? realDay(Number(iso[1]), Number(iso[2]), Number(iso[3])) : null;
}

async function liveByEmail(email, suffix = '') {
  return email ? prepare(`SELECT id, name FROM customers WHERE lower(trim(email)) = ? AND email <> '' AND ${LIVE} ORDER BY id LIMIT 1${suffix}`).get(email) : undefined;
}
async function liveByPhone(forms, suffix = '') {
  return forms.length ? prepare(`SELECT id, name FROM customers WHERE ${DIGITS} = ANY(?) AND phone <> '' AND ${LIVE} ORDER BY id LIMIT 1${suffix}`).get(forms) : undefined;
}

export async function customerRow(d) {
  const account = d['Account Number'] || null;
  const name = [d['First Name'], d['Last Name']].filter(Boolean).join(' ');
  if (!name) return look('No name');
  // Deleted or merged included: they've come across, and stay as they are (design 5).
  if (account && (await prepare('SELECT id FROM customers WHERE citrus_account = ?').get(account))) return { state: 'in' };
  const email = (d.Email ?? '').trim();
  const phone = (d.Phone ?? '').trim();
  const same = (await liveByEmail(cleanEmail(email))) ?? (await liveByPhone(phoneForms(phone)));
  if (same) return look(`Looks like the same person as ${same.name}`);
  const address = [d.Address, d['Address 2'], d.City, d.County, d.Country].filter(Boolean).join(', ') || null;
  const yes = YES.test(d['GDPR Consent'] ?? '');
  await prepare(
    `INSERT INTO customers (name, email, phone, address, postcode, marketing_permission, marketing_consent_on, citrus_account, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?::date, ?, now())
     ON CONFLICT (shop_id, citrus_account) WHERE citrus_account IS NOT NULL DO NOTHING RETURNING id`
  ).get(name, email, phone, address, d.Postcode ?? null, yes, yes ? consentDay(d['GDPR Consent Date']) : null, account);
  return { state: 'in' };
}

// Whose bike, by email, mobile, phone, then the exact name (design 7).
async function bikeOwner(d, suffix = '') {
  const found = (await liveByEmail(cleanEmail(d['Email Address']), suffix))
    ?? (await liveByPhone(phoneForms(d['Mobile Number']), suffix))
    ?? (await liveByPhone(phoneForms(d['Phone Number']), suffix));
  if (found) return found;
  const name = (d['Customer Name'] ?? '').trim();
  if (!name) return null;
  const named = await prepare(`SELECT id, name FROM customers WHERE lower(trim(name)) = lower(?) AND ${LIVE} ORDER BY id LIMIT 2`).all(name);
  if (named.length > 1) return { several: true };
  if (!named[0]) return null;
  return suffix ? prepare(`SELECT id, name FROM customers WHERE id = ? AND ${LIVE}${suffix}`).get(named[0].id) : named[0];
}

// The batch's customers, locked in id order before any row is written (design 7).
export async function lockBikeOwners(rows) {
  const ids = new Set();
  for (const { data } of rows) {
    const owner = await bikeOwner(data);
    if (owner?.id) ids.add(owner.id);
  }
  await prepare('SELECT id FROM customers WHERE id = ANY(?::int[]) ORDER BY id FOR SHARE').all([...ids]);
}

export async function bikeRow(d) {
  if (!d.Description) return look('No description');
  const owner = await bikeOwner(d, ' FOR SHARE');
  if (owner?.several) return look('More than one customer has this name');
  if (!owner) return look(NO_CUSTOMER);
  const serial = d['Serial Number'] ?? '';
  const had = await prepare('SELECT id FROM customer_bikes WHERE customer_id = ? AND model = ? AND serial_number = ?').get(owner.id, d.Description, serial);
  if (had) return { state: 'in' };
  await prepare('INSERT INTO customer_bikes (customer_id, model, serial_number) VALUES (?, ?, ?)').run(owner.id, d.Description, serial);
  return { state: 'in' };
}

/**
 * Deleting someone's details (design 8): rows still waiting in a file with their
 * email, phone or account number go. Inside the deletion's transaction, with
 * their customer records locked and not yet blanked.
 */
export async function forgetMoveRows(customerIds, emails) {
  const people = await prepare(`SELECT ${DIGITS} AS digits, citrus_account FROM customers WHERE id = ANY(?::int[])`).all(customerIds);
  const phones = people.flatMap((p) => phoneForms(p.digits));
  const accounts = people.map((p) => p.citrus_account).filter(Boolean);
  const gone = await prepare(
    `DELETE FROM move_rows WHERE state <> 'in' AND (
       lower(trim(coalesce(data->>'Email', data->>'Email Address', ''))) = ANY(?::text[])
       OR regexp_replace(coalesce(data->>'Phone', ''), '\\D', '', 'g') = ANY(?::text[])
       OR regexp_replace(coalesce(data->>'Mobile Number', ''), '\\D', '', 'g') = ANY(?::text[])
       OR regexp_replace(coalesce(data->>'Phone Number', ''), '\\D', '', 'g') = ANY(?::text[])
       OR data->>'Account Number' = ANY(?::text[])
     ) RETURNING file_id, state`
  ).all(emails, phones, phones, phones, accounts);
  const perFile = new Map();
  for (const { file_id: id, state } of gone) {
    const was = perFile.get(id) ?? { total: 0, look: 0 };
    was.total += 1;
    if (state === 'look') was.look += 1;
    perFile.set(id, was);
  }
  for (const [id, { total, look: looks }] of [...perFile].sort(([a], [b]) => a - b)) {
    await prepare('UPDATE move_files SET rows_total = rows_total - ?, rows_look = rows_look - ? WHERE id = ?').run(total, looks, id);
  }
}
