// Service checklists (Jack, 22 Oct, docs/decisions/2026-10-22-service-checklists.md;
// openspec/changes/service-checklists/design.md): a shop's own checklists,
// the services that have each, and each job's checklist.
//
// A job's checklist is its first service's (the online booking's services
// in order, then its order's service lines). Until something is ticked or
// noted it follows Settings; the first change copies it onto the job
// (workshop_job_checklists), and from then the job keeps that copy.
import { prepare, dbExec } from '../db.js';

const db = { prepare, exec: dbExec };

// The full service template: the ten items drawn on job-checklist.
export const TEMPLATE_NAME = 'Full service checklist';
export const TEMPLATE_ITEMS = ['Frame & fork', 'Wheels & tyres', 'Tyre pressure', 'Brakes bled & adjusted', 'Gears indexed',
  'Chain & drivetrain', 'Bottom bracket', 'Headset', 'Cables & housing', 'Bolts torqued'];

const NAME_MAX = 80;
const ITEMS_MAX = 50;
const ITEM_MAX = 120;
const NOTE_MAX = 500;

export class ChecklistError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const refuse = (message) => new ChecklistError(400, message);

function cleanName(name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) throw refuse('Give the checklist a name.');
  if (n.length > NAME_MAX) throw refuse(`A checklist’s name can be up to ${NAME_MAX} letters.`);
  return n;
}

function cleanItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw refuse('A checklist needs at least one item.');
  if (items.length > ITEMS_MAX) throw refuse(`A checklist can have up to ${ITEMS_MAX} items.`);
  return items.map((it) => {
    const t = typeof it === 'string' ? it.trim() : '';
    if (!t) throw refuse('Every item needs some words, or remove it.');
    if (t.length > ITEM_MAX) throw refuse(`An item can be up to ${ITEM_MAX} letters.`);
    return t;
  });
}

async function cleanServiceIds(ids) {
  if (!Array.isArray(ids)) throw refuse('Choose the services as a list.');
  if (!ids.every(Number.isInteger)) throw refuse('One of those services doesn’t exist.');
  const unique = [...new Set(ids)];
  for (const id of unique) {
    if (!(await db.prepare('SELECT 1 FROM workshop_services WHERE id = ?').get(id))) throw refuse('One of those services doesn’t exist.');
  }
  return unique;
}

async function serialize(row) {
  const services = await db.prepare('SELECT id FROM workshop_services WHERE checklist_id = ? ORDER BY id').all(row.id);
  return { id: row.id, name: row.name, items: row.items, serviceIds: services.map((s) => s.id) };
}

export async function listChecklists() {
  const rows = await db.prepare('SELECT * FROM workshop_checklists ORDER BY id').all();
  return Promise.all(rows.map(serialize));
}

// The whole service list: those services move here (a service has one
// checklist at most), and any that had this one and aren't listed lose it.
async function setServices(checklistId, serviceIds) {
  await db.prepare('UPDATE workshop_services SET checklist_id = NULL WHERE checklist_id = ?').run(checklistId);
  for (const id of serviceIds) {
    await db.prepare('UPDATE workshop_services SET checklist_id = ? WHERE id = ?').run(checklistId, id);
  }
}

async function inTransaction(fn) {
  await db.exec('BEGIN');
  try {
    const out = await fn();
    await db.exec('COMMIT');
    return out;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

export async function createChecklist(body) {
  const name = body.template ? TEMPLATE_NAME : cleanName(body.name);
  const items = body.template ? TEMPLATE_ITEMS : cleanItems(body.items);
  const serviceIds = body.template || body.serviceIds === undefined ? [] : await cleanServiceIds(body.serviceIds);
  return inTransaction(async () => {
    const { lastInsertRowid: id } = await db.prepare('INSERT INTO workshop_checklists (name, items) VALUES (?, CAST(? AS jsonb))')
      .run(name, JSON.stringify(items));
    await setServices(id, serviceIds);
    return serialize(await db.prepare('SELECT * FROM workshop_checklists WHERE id = ?').get(id));
  });
}

export async function updateChecklist(id, body) {
  const name = body.name === undefined ? undefined : cleanName(body.name);
  const items = body.items === undefined ? undefined : cleanItems(body.items);
  const serviceIds = body.serviceIds === undefined ? null : await cleanServiceIds(body.serviceIds);
  return inTransaction(async () => {
    // Read and locked inside the transaction, so a removal at the same moment
    // gives "no longer exists", not a failed write (fresh review).
    const existing = await db.prepare('SELECT * FROM workshop_checklists WHERE id = ? FOR UPDATE').get(id);
    if (!existing) throw new ChecklistError(404, 'That checklist no longer exists.');
    await db.prepare('UPDATE workshop_checklists SET name = ?, items = CAST(? AS jsonb), updated_at = now() WHERE id = ?')
      .run(name ?? existing.name, JSON.stringify(items ?? existing.items), id);
    if (serviceIds) await setServices(id, serviceIds);
    return serialize(await db.prepare('SELECT * FROM workshop_checklists WHERE id = ?').get(id));
  });
}

// Services lose it (ON DELETE SET NULL); jobs already begun keep their copy.
export async function deleteChecklist(id) {
  const gone = await db.prepare('DELETE FROM workshop_checklists WHERE id = ?').run(id);
  if (!gone.changes) throw new ChecklistError(404, 'That checklist no longer exists.');
}

// The checklist a job's service has in Settings now, or undefined.
async function serviceChecklist(jobId) {
  return db.prepare(
    `SELECT c.* FROM (
        SELECT js.service_id, 0 AS source, js.position AS seq FROM workshop_job_services js WHERE js.workshop_job_id = ?
        UNION ALL
        SELECT i.service_id, 1 AS source, i.id AS seq FROM sale_document_items i
          JOIN sale_documents d ON d.id = i.document_id
         WHERE d.workshop_job_id = ? AND d.kind = 'order' AND d.status <> 'cancelled' AND i.service_id IS NOT NULL
      ) s
      JOIN workshop_services ws ON ws.id = s.service_id
      JOIN workshop_checklists c ON c.id = ws.checklist_id
     ORDER BY s.source, s.seq
     LIMIT 1`
  ).get(jobId, jobId);
}

function summary(name, items) {
  return {
    name,
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
    notes: items.filter((i) => i.note).length,
  };
}

// The job's own copy only, made by its first tick or note, or null: what the
// customer is shown, so it's fixed and never "0 of 10" for a list nobody
// used (customer-checklist, fresh review 22 Oct).
export async function jobChecklistCopy(jobId) {
  const copy = await db.prepare('SELECT name, items FROM workshop_job_checklists WHERE workshop_job_id = ?').get(jobId);
  return copy ? summary(copy.name, copy.items) : null;
}

// The job's checklist as the job page shows it, or null when it has none.
export async function jobChecklist(jobId) {
  const copy = await db.prepare('SELECT name, items FROM workshop_job_checklists WHERE workshop_job_id = ?').get(jobId);
  if (copy) return summary(copy.name, copy.items);
  const found = await serviceChecklist(jobId);
  return found ? summary(found.name, found.items.map((label) => ({ label, done: false, note: null }))) : null;
}

// Ticks or notes one item (`index` from 0). The first change copies the
// service's checklist onto the job; each change then sets only its own item's
// field in the database, so two people ticking different items don't undo
// each other. Refused once the work is finished, as the job's other details.
export async function setJobChecklistItem(jobId, index, body) {
  const job = await db.prepare('SELECT work_state FROM workshop_jobs WHERE id = ?').get(jobId);
  if (!job) throw new ChecklistError(404, 'Job not found');
  if (body.done !== undefined && typeof body.done !== 'boolean') throw refuse('Say whether the item is done.');
  let note;
  if (body.note !== undefined) {
    if (body.note !== null && typeof body.note !== 'string') throw refuse('A note is some words.');
    note = typeof body.note === 'string' ? body.note.trim() || null : null;
    if (note && note.length > NOTE_MAX) throw refuse(`A note can be up to ${NOTE_MAX} letters.`);
  }
  if (body.done === undefined && note === undefined) throw refuse('Say what changes: done, or a note.');
  if (job.work_state === 'complete') {
    throw new ChecklistError(409, 'This work is finished, so its checklist can’t change. Reopen the work first.', 'illegal');
  }
  const copy = await db.prepare('SELECT jsonb_array_length(items) AS n FROM workshop_job_checklists WHERE workshop_job_id = ?').get(jobId);
  if (!copy) {
    const found = await serviceChecklist(jobId);
    if (!found) throw new ChecklistError(404, 'This job has no checklist.');
    // A refused change copies nothing: the job keeps following Settings (fresh review).
    if (!Number.isInteger(index) || index < 0 || index >= found.items.length) throw new ChecklistError(404, 'That item isn’t on this checklist.');
    // Two first ticks at once: the second finds the copy the first made.
    await db.prepare(
      `INSERT INTO workshop_job_checklists (workshop_job_id, checklist_id, name, items)
       VALUES (?, ?, ?, CAST(? AS jsonb)) ON CONFLICT (workshop_job_id) DO NOTHING`
    ).run(jobId, found.id, found.name, JSON.stringify(found.items.map((label) => ({ label, done: false, note: null }))));
  } else if (!Number.isInteger(index) || index < 0 || index >= copy.n) {
    throw new ChecklistError(404, 'That item isn’t on this checklist.');
  }
  // Each write re-checks the work isn't finished, so a tick racing Finish
  // can't land after it (fresh review).
  const notFinished = 'AND EXISTS (SELECT 1 FROM workshop_jobs WHERE id = ? AND work_state <> \'complete\')';
  const done = body.done === undefined ? { changes: 1 } : await db.prepare(
    `UPDATE workshop_job_checklists SET items = jsonb_set(items, ARRAY[?::text, 'done'], to_jsonb(CAST(? AS boolean))), updated_at = now()
      WHERE workshop_job_id = ? ${notFinished}`
  ).run(String(index), body.done, jobId, jobId);
  const noted = note === undefined ? { changes: 1 } : await db.prepare(
    `UPDATE workshop_job_checklists SET items = jsonb_set(items, ARRAY[?::text, 'note'], COALESCE(to_jsonb(CAST(? AS text)), 'null'::jsonb)), updated_at = now()
      WHERE workshop_job_id = ? ${notFinished}`
  ).run(String(index), note, jobId, jobId);
  if (!done.changes || !noted.changes) {
    throw new ChecklistError(409, 'This work is finished, so its checklist can’t change. Reopen the work first.', 'illegal');
  }
  return jobChecklist(jobId);
}
