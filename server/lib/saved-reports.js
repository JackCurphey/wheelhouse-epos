// Saved reports (openspec/changes/reports-your-own, design 7 to 9): a changed report kept under a name
// by the person who saved it. Every read and write is for one login (`loginId`), so one person's reports
// are never another's, and runs in the request's shop (row-level security). A saved report keeps the
// kind of period, never dates, and opens on the latest one of that kind; one saved on Pick dates opens
// on the report's first period (This week).
import { prepare } from '../db.js';
import { ValidationError } from './http.js';
import { checkSaved, describeChoice, onlyChoicesFor } from './report-changed.js';

export const TAKEN = 'You already have a report with this name. Choose another name.';
export const NO_MANAGERS = 'there are no managers until staff roles are set up';
const MAX_NAME = 80;

// The categories that still exist for each kind of report the rows are of (Stockroom's for sales, the workshop's services').
async function existingFor(bases) {
  const out = {};
  for (const base of new Set(bases)) out[base] = await onlyChoicesFor(base);
  return out;
}

// A saved report as the screens read it. `only` lists the categories that still exist, so a removed
// category is left out of what it says and of what it shows.
function shape(row, existingByBase) {
  const only = row.only_categories.filter((o) => (existingByBase[row.base] ?? []).includes(o));
  const sel = { base: row.base, measure: row.measure, split: row.split, only, supplier: row.supplier ?? '' };
  // One report that no longer makes sense (a measure since retired) must not stop the rest being listed.
  let what = 'This report can’t be shown any more';
  try {
    const { title, limitParts } = describeChoice(sel);
    what = [title, ...limitParts].join(' · ');
  } catch { /* keep the plain words above */ }
  return {
    id: row.id, name: row.name, base: row.base, measure: row.measure, split: row.split, only, supplier: sel.supplier,
    period: row.period, opensOn: row.period === 'dates' ? 'this-week' : row.period, shared: row.shared, what,
  };
}

export async function listSaved(loginId) {
  const rows = await prepare('SELECT * FROM saved_reports WHERE login_id = ? AND deleted_at IS NULL ORDER BY created_at, id').all(loginId);
  const existing = await existingFor(rows.map((r) => r.base));
  return rows.map((r) => shape(r, existing));
}

// A name that is acceptable, trimmed, or a ValidationError saying what to fix.
export function cleanName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) throw new ValidationError('Type its name');
  if (name.includes('\u0000')) throw new ValidationError('A report’s name can’t have that character in it');
  if (name.length > MAX_NAME) throw new ValidationError(`A report’s name can be up to ${MAX_NAME} characters`);
  return name;
}

export async function nameIsTaken(loginId, name, exceptId = null) {
  const row = await prepare('SELECT id FROM saved_reports WHERE login_id = ? AND lower(name) = lower(?) AND deleted_at IS NULL AND id <> ?').get(loginId, name, exceptId ?? 0);
  return Boolean(row);
}

export async function createSaved(loginId, body) {
  if (body.shared === true) throw new ValidationError(NO_MANAGERS);
  const name = cleanName(body.name);
  const sel = checkSaved(body);
  if (await nameIsTaken(loginId, name)) throw new ValidationError(TAKEN);
  let row;
  try {
    row = await prepare(
      `INSERT INTO saved_reports (login_id, base, measure, split, only_categories, supplier, period, name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).get(loginId, sel.base, sel.measure, sel.split, sel.only, sel.supplier || null, sel.period, name);
  } catch (err) {
    // Two saves of one name at once: the unique index is the last word, and says the same as the check above.
    if (err.code === '23505') throw new ValidationError(TAKEN);
    throw err;
  }
  return shape(row, await existingFor([row.base]));
}

// A saved report that isn't the person's own, is in another shop, or isn't in the state asked for
// (not deleted to rename it, deleted to undo it) is simply not there.
export class SavedNotFound extends Error {
  name = 'SavedNotFound';
  constructor() { super('That report isn’t there'); }
}

const own = (loginId, id, deleted) => prepare(
  `SELECT * FROM saved_reports WHERE id = ? AND login_id = ? AND deleted_at IS ${deleted ? 'NOT NULL' : 'NULL'}`
).get(id, loginId);

async function setName(id, name) {
  try {
    // Still live: a delete that got in between leaves it deleted, and the rename is "not there".
    const row = await prepare('UPDATE saved_reports SET name = ?, updated_at = now() WHERE id = ? AND deleted_at IS NULL RETURNING *').get(name, id);
    if (!row) throw new SavedNotFound();
    return row;
  } catch (err) {
    if (err.code === '23505') throw new ValidationError(TAKEN);
    throw err;
  }
}

// Rename keeps everything else. The same name in other capitals, or the name it already has, is fine for itself.
export async function renameSaved(loginId, id, rawName, body = {}) {
  const found = await own(loginId, id, false);
  if (!found) throw new SavedNotFound();
  if (body.shared === true) throw new ValidationError(NO_MANAGERS);
  const name = cleanName(rawName);
  if (await nameIsTaken(loginId, name, id)) throw new ValidationError(TAKEN);
  const row = await setName(id, name);
  return shape(row, await existingFor([row.base]));
}

// Delete keeps the row, with when, so Undo can bring it back as it was.
export async function deleteSaved(loginId, id) {
  const found = await own(loginId, id, false);
  if (!found) throw new SavedNotFound();
  const done = await prepare('UPDATE saved_reports SET deleted_at = now(), updated_at = now() WHERE id = ? AND deleted_at IS NULL RETURNING id').get(id);
  if (!done) throw new SavedNotFound();
  return { id, name: found.name };
}

// Undo puts it back, unless its name has been used again since: then it says so, and Undo can be sent again
// with a new name to bring it back under that one.
export async function undoSaved(loginId, id, body = {}) {
  const found = await own(loginId, id, true);
  if (!found) throw new SavedNotFound();
  const name = body.name === undefined ? found.name : cleanName(body.name);
  if (await nameIsTaken(loginId, name)) throw new ValidationError(TAKEN);
  try {
    const row = await prepare('UPDATE saved_reports SET name = ?, deleted_at = NULL, updated_at = now() WHERE id = ? AND deleted_at IS NOT NULL RETURNING *').get(name, id);
    if (!row) throw new SavedNotFound();
    return shape(row, await existingFor([row.base]));
  } catch (err) {
    if (err.code === '23505') throw new ValidationError(TAKEN);
    throw err;
  }
}
