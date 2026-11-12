// Saved reports (openspec/changes/reports-your-own, design 7 to 9): a changed report kept under a name
// by the person who saved it. Every read and write is for one login (`loginId`), so one person's reports
// are never another's, and runs in the request's shop (row-level security). A saved report keeps the
// kind of period, never dates, and opens on the latest one of that kind; one saved on Pick dates opens
// on the report's first period (This week).
import { prepare } from '../db.js';
import { ValidationError } from './http.js';
import { checkSaved, describeChoice, onlyChoices } from './report-changed.js';

export const TAKEN = 'You already have a report with this name. Choose another name.';
export const NO_MANAGERS = 'there are no managers until staff roles are set up';
const MAX_NAME = 80;

// A saved report as the screens read it. `only` lists the categories that still exist, so a removed
// category is left out of what it says and of what it shows.
function shape(row, existing) {
  const only = row.only_categories.filter((o) => existing.includes(o));
  const sel = { base: row.base, measure: row.measure, split: row.split, only, supplier: row.supplier ?? '' };
  const { title, limitParts } = describeChoice(sel);
  return {
    id: row.id, name: row.name, base: row.base, measure: row.measure, split: row.split, only, supplier: sel.supplier,
    period: row.period, opensOn: row.period === 'dates' ? 'this-week' : row.period, shared: row.shared,
    what: [title, ...limitParts].join(' · '),
  };
}

export async function listSaved(loginId) {
  const rows = await prepare('SELECT * FROM saved_reports WHERE login_id = ? AND deleted_at IS NULL ORDER BY created_at, id').all(loginId);
  const existing = await onlyChoices();
  return rows.map((r) => shape(r, existing));
}

// A name that is acceptable, trimmed, or a ValidationError saying what to fix.
export function cleanName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) throw new ValidationError('Type its name');
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
  const row = await prepare(
    `INSERT INTO saved_reports (login_id, base, measure, split, only_categories, supplier, period, name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  ).get(loginId, sel.base, sel.measure, sel.split, sel.only, sel.supplier || null, sel.period, name);
  return shape(row, await onlyChoices());
}
