// A customer or bike row from Citrus Lime (openspec/changes/citrus-import-customers,
// design 4 to 8 and 10 to 16). Inside bringBatch's transaction.
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { prepare } from '../db.js';

export const NO_CUSTOMER = 'The customer on this bike isn’t in the customers file';
// The customer's name is looked up when it's shown (lookRows), never stored in the row.
export const SAME_PERSON = 'Looks like the same person as';
// Only their email or phone: someone else may share it, so it's for a person to
// decide (Jack, 4 Nov, "Needs a look"). No name and no customer: nothing to show who.
export const SHARED_CONTACT = 'Shares contact details with a customer who was deleted';
const SEVERAL_CONTACT = 'More than one customer has this email or phone';
const SEVERAL_NAME = 'More than one customer has this name';
const NAME_DIFFERS = 'The name on this bike isn’t the name of the customer with this email or phone';
const look = (why, customerId) => ({ state: 'look', why, customerId });
const YES = /^(yes|true|y|1)$/i;
// The same index expression as migration 112.
const DIGITS = "regexp_replace(coalesce(phone, ''), '\\D', '', 'g')";
const LIVE = 'deleted_at IS NULL AND merged_into_id IS NULL';

// A UK number however it's written, without its country code or leading 0:
// 07700…, +44 7700…, 0044 7700…, +44 (0)7700…. Empty when it's too short to be one.
function nationalNumber(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  if (digits.length < 7) return '';
  const rest = digits.startsWith('0044') ? digits.slice(4) : digits.startsWith('44') && digits.length >= 12 ? digits.slice(2) : digits;
  return rest.replace(/^0/, '');
}
// Every way it may be held, as digits: for finding a customer, a bike's owner, and waiting rows.
export function phoneForms(text) {
  const national = nationalNumber(text);
  return national ? [national, `0${national}`, `44${national}`, `0044${national}`, `440${national}`, `00440${national}`] : [];
}
// An account number is the same in any case, with or without spaces around it (the
// review, 4 Nov). So A1 and a1 are one account.
const accountKey = (text) => String(text ?? '').trim().toLowerCase();
export const cleanEmail = (text) => String(text ?? '').trim().toLowerCase();
export const cleanName = (text) => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
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

// One-way codes of what a deleted person leaves behind (Jack, 3 Nov,
// docs/decisions/2026-11-03-answers.md): keyed with the shop's own random salt, so
// the same details give different codes in another shop, and linked to nothing
// else. They're used only to spot that person on import. They aren't proof against
// someone with access to this database: the salt is stored beside the codes, so
// that person could test a guessed email or phone against them.
const codeOf = (salt, kind, value) => createHmac('sha256', salt).update(`${kind}:${value}`).digest('hex');
const codesFor = (salt, { accounts = [], emails = [], phones = [] }) => [
  ...accounts.filter(Boolean).map((v) => ['account', v]),
  ...emails.map(cleanEmail).filter(Boolean).map((v) => ['email', v]),
  ...phones.map(nationalNumber).filter(Boolean).map((v) => ['phone', v]),
].map(([kind, value]) => [kind, codeOf(salt, kind, value)]);

/** The shop's salt, for a batch; null when nobody has been deleted here yet. */
export async function moveSalt() {
  return (await prepare('SELECT salt FROM move_deleted_salt').get())?.salt ?? null;
}
// Which of a person's details a deleted customer left a code for: 'account', 'contact', or null.
// A code made before the review of 4 Nov kept the number's own case, so that form is tried as well.
async function deletedMatch(context, { account, ...person }) {
  if (!context.salt) return null;
  const accounts = account ? [...new Set([accountKey(account), String(account).trim()])] : [];
  const codes = codesFor(context.salt, { ...person, accounts });
  if (codes.length === 0) return null;
  const hits = await prepare('SELECT kind FROM move_deleted_codes WHERE code = ANY(?)').all(codes.map(([, code]) => code));
  if (hits.some((h) => h.kind === 'account')) return 'account';
  return hits.length ? 'contact' : null;
}

// Those it fits, leaving out anyone a person has said it isn't.
const liveMatches = (email, forms, notThem = []) => prepare(
  `SELECT id, name FROM customers
    WHERE ${LIVE} AND ((? <> '' AND email <> '' AND lower(trim(email)) = ?) OR (phone <> '' AND ${DIGITS} = ANY(?))) AND id <> ALL(?::int[])
    ORDER BY id LIMIT 2`
).all(email, email, forms, notThem);

export async function customerRow(d, file, context) {
  const account = (d['Account Number'] ?? '').trim();
  const email = (d.Email ?? '').trim();
  const phone = (d.Phone ?? '').trim();
  const match = await deletedMatch(context, { account, emails: [email], phones: [phone] });
  // Their own account number: someone who asked to be deleted never comes back.
  if (match === 'account') return { state: 'skipped' };
  // Merged included: they've come across, and stay as they are (design 5).
  if (account && (await prepare('SELECT id FROM customers WHERE lower(trim(citrus_account)) = ?').get(accountKey(account)))) return { state: 'same' };
  // Only a person, on this one row, gets past this (mv-fix; answer 6). A batch never does.
  if ((match === 'contact' || context.storedShared) && !context.decided?.shared) return look(SHARED_CONTACT);
  const name = [d['First Name'], d['Last Name']].filter(Boolean).join(' ');
  if (!name) return look('No name');
  // With no account number a resent file couldn't tell them from themselves.
  if (!account) return look('No account number');
  // Each person it looks like needs their own tick: the next is asked about in turn.
  const [same] = await liveMatches(cleanEmail(email), phoneForms(phone), context.decided?.notSameAs ?? []);
  if (same) return look(SAME_PERSON, same.id);
  const address = [d.Address, d['Address 2'], d.City, d.County, d.Country].filter(Boolean).join(', ') || null;
  const yes = YES.test(d['GDPR Consent'] ?? '');
  const made = await prepare(
    `INSERT INTO customers (name, email, phone, address, postcode, marketing_permission, marketing_consent_on, citrus_account, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?::date, ?, now())
     ON CONFLICT (shop_id, citrus_account) WHERE citrus_account IS NOT NULL DO NOTHING RETURNING id`
  ).get(name, email, phone, address, d.Postcode ?? null, yes, yes ? consentDay(d['GDPR Consent Date']) : null, account);
  return { state: made ? 'in' : 'same' };
}

// Whose bike: everyone its email or phones fit, then the exact name (design 7 and 12).
async function bikeOwner(d) {
  const forms = [...phoneForms(d['Mobile Number']), ...phoneForms(d['Phone Number'])];
  const contacts = await liveMatches(cleanEmail(d['Email Address']), forms);
  const name = cleanName(d['Customer Name']);
  if (contacts.length > 1) return { why: SEVERAL_CONTACT };
  if (contacts.length === 1) {
    if (name && cleanName(contacts[0].name) !== name) return { why: NAME_DIFFERS, customerId: contacts[0].id };
    return { id: contacts[0].id };
  }
  if (!name) return { why: NO_CUSTOMER };
  const named = await prepare(`SELECT id FROM customers WHERE lower(trim(name)) = ? AND ${LIVE} ORDER BY id LIMIT 2`).all(name);
  if (named.length > 1) return { why: SEVERAL_NAME };
  return named[0] ? { id: named[0].id } : { why: NO_CUSTOMER };
}

// The batch's customers, locked in id order before any row is written (design 7).
export async function lockBikeOwners(rows) {
  const ids = new Set();
  for (const { data } of rows) {
    const owner = await bikeOwner(data);
    if (owner.id) ids.add(owner.id);
  }
  await prepare('SELECT id FROM customers WHERE id = ANY(?::int[]) ORDER BY id FOR SHARE').all([...ids]);
}

export async function bikeRow(d, file, context) {
  // A bike has no account number, so only ever a contact match.
  if (!context.decided?.shared && (context.storedShared || await deletedMatch(context, { emails: [d['Email Address']], phones: [d['Mobile Number'], d['Phone Number']] }))) return look(SHARED_CONTACT);
  if (!d.Description) return look('No description');
  const owner = await bikeOwner(d);
  if (!owner.id) return look(owner.why, owner.customerId);
  // Read again under lock: a deletion that got there first is seen.
  const live = await prepare(`SELECT id FROM customers WHERE id = ? AND ${LIVE} FOR SHARE`).get(owner.id);
  if (!live) return look(NO_CUSTOMER);
  const serial = d['Serial Number'] ?? '';
  // This row of Citrus Lime's, however the bike's been corrected since (design 16).
  const ref = createHash('sha256').update(JSON.stringify([d.Description, serial, cleanName(d['Customer Name']), cleanEmail(d['Email Address'])])).digest('hex');
  const had = await prepare(
    `SELECT id FROM customer_bikes WHERE citrus_ref = ? OR (customer_id = ? AND ((? <> '' AND serial_number = ?) OR (model = ? AND serial_number = ?))) LIMIT 1`
  ).get(ref, live.id, serial, serial, d.Description, serial);
  if (had) return { state: 'same' };
  await prepare('INSERT INTO customer_bikes (customer_id, model, serial_number, citrus_ref) VALUES (?, ?, ?, ?)').run(live.id, d.Description, serial, ref);
  return { state: 'in' };
}

/** A file's rows needing a look, each reason with the customer's name as it is now. */
export async function lookRows(fileId) {
  const rows = await prepare(
    `SELECT r.id, r.why, c.name FROM move_rows r LEFT JOIN customers c ON c.id = r.customer_id
      WHERE r.file_id = ? AND r.state = 'look' ORDER BY r.id`
  ).all(fileId);
  return rows.map((r) => ({ id: r.id, why: r.why === SAME_PERSON ? `${r.why} ${r.name}` : r.why }));
}

// The name a row holds, whichever report it's from.
const rowName = (d) => cleanName(d['Customer Name'] ?? [d['First Name'], d['Last Name']].filter(Boolean).join(' '));

// Whether a help request holds this person's exact email, phone or name, in any case
// (Jack, 4 Nov, answers 2 and 4). A name counts only if it's at least two words, as whole
// words, and a phone only as the whole number: spaces and punctuation may sit in it, but
// a run of digits with anything more isn't theirs. So a misspelt or one-word name, or a
// phone straight after another number, gets through. The card comes from this page's own
// headings, so only an email is looked for there, as the server takes it as text.
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const holdsEmail = (text, emails) => emails.some((e) => new RegExp(`(?<![a-z0-9._%+-])${escaped(e)}(?!\\.?[a-z0-9_-])`).test(cleanName(text)));
function holdsNameOrPhone(text, { phones, names }) {
  const flat = cleanName(text);
  if (names.some((n) => n.includes(' ') && new RegExp(`(?<![\\p{L}\\p{N}])${escaped(n)}(?![\\p{L}\\p{N}])`, 'u').test(flat))) return true;
  return (text.match(/\d[\d \t().-]*\d/g) ?? []).some((run) => phones.includes(nationalNumber(run)));
}
// The whole request goes: nothing identifying may stay, and it has no use without its text.
async function forgetHelpRequests(person) {
  const asked = await prepare('SELECT id, what_looks_wrong, card FROM move_help_requests ORDER BY id').all();
  for (const { id, what_looks_wrong: text, card } of asked) {
    if (holdsEmail(`${text}\n${card}`, person.emails) || holdsNameOrPhone(text, person)) await prepare('DELETE FROM move_help_requests WHERE id = ? RETURNING id').get(id);
  }
}

/**
 * Deleting someone's details (Jack, 3 and 4 Nov; design 8, 10, 22 and 23): one-way
 * codes of their account number, emails and phones are kept, with nothing else.
 * Rows not yet in, or left out, go if they're the person's own: their account number, or their
 * exact name with their email or phone (or, for a row needing a look, a link to
 * them). The file's counts follow. Other rows sharing their email or phone may be
 * someone else's, so they stay, with their own details, the shared email or phone
 * included: one needing a look takes answer 3's reason and loses its link now, and
 * one still waiting is left to take that reason from the codes when it's looked at.
 * A request for help holding their details goes too.
 * Inside the deletion's transaction, with every move file locked first and their
 * customer records not yet blanked.
 */
export async function forgetForMove(customerIds, emails) {
  const people = await prepare('SELECT name, phone, citrus_account FROM customers WHERE id = ANY(?::int[])').all(customerIds);
  await prepare('INSERT INTO move_deleted_salt (salt) VALUES (?) ON CONFLICT (shop_id) DO NOTHING RETURNING shop_id').get(randomBytes(32).toString('hex'));
  const salt = await moveSalt();
  const codes = people.flatMap((p) => codesFor(salt, { accounts: [accountKey(p.citrus_account)], phones: [p.phone] }));
  codes.push(...codesFor(salt, { emails }));
  for (const [kind, code] of codes) {
    await prepare('INSERT INTO move_deleted_codes (kind, code) VALUES (?, ?) ON CONFLICT (shop_id, code) DO NOTHING RETURNING id').get(kind, code);
  }
  const phones = people.flatMap((p) => phoneForms(p.phone));
  const accounts = people.map((p) => accountKey(p.citrus_account)).filter(Boolean);
  // With the names of anyone merged into them: a hidden record removed after its 30 days
  // leaves only its name on the merge, and a row moved to the kept record still has that name.
  const mergedNames = await prepare('SELECT other_name FROM customer_merges WHERE kept_id = ANY(?::int[]) AND undone_at IS NULL').all(customerIds);
  const names = new Set([...people.map((p) => p.name), ...mergedNames.map((m) => m.other_name)].map(cleanName).filter(Boolean));
  await forgetHelpRequests({
    emails: emails.map(cleanEmail).filter(Boolean),
    phones: [...new Set(people.map((p) => nationalNumber(p.phone)).filter(Boolean))],
    names: [...names],
  });
  const rows = await prepare(
    `SELECT id, file_id, state, data, (lower(trim(data->>'Account Number')) = ANY(?::text[])) AS by_account FROM move_rows
      WHERE state IN ('waiting', 'look', 'left_out') AND (
        lower(trim(data->>'Account Number')) = ANY(?::text[])
        OR customer_id = ANY(?::int[])
        OR lower(trim(coalesce(data->>'Email', data->>'Email Address', ''))) = ANY(?::text[])
        OR regexp_replace(coalesce(data->>'Phone', ''), '\\D', '', 'g') = ANY(?::text[])
        OR regexp_replace(coalesce(data->>'Mobile Number', ''), '\\D', '', 'g') = ANY(?::text[])
        OR regexp_replace(coalesce(data->>'Phone Number', ''), '\\D', '', 'g') = ANY(?::text[])
      ) ORDER BY id`
  ).all(accounts, accounts, customerIds, emails, phones, phones, phones);
  const own = rows.filter((r) => r.by_account || names.has(rowName(r.data)));
  const shares = rows.filter((r) => !own.includes(r) && r.state !== 'waiting');
  const perFile = new Map();
  for (const { id, file_id: fileId, state } of own) {
    await prepare('DELETE FROM move_rows WHERE id = ? RETURNING id').get(id);
    const was = perFile.get(fileId) ?? { total: 0, look: 0, leftOut: 0 };
    was.total += 1;
    if (state === 'look') was.look += 1;
    if (state === 'left_out') was.leftOut += 1;
    perFile.set(fileId, was);
  }
  for (const [id, { total, look: looks, leftOut }] of [...perFile].sort(([a], [b]) => a - b)) {
    await prepare('UPDATE move_files SET rows_total = rows_total - ?, rows_look = rows_look - ?, rows_left_out = rows_left_out - ? WHERE id = ?').run(total, looks, leftOut, id);
  }
  for (const { id } of shares) {
    await prepare('UPDATE move_rows SET why = ?, customer_id = NULL WHERE id = ?').run(SHARED_CONTACT, id);
  }
}
