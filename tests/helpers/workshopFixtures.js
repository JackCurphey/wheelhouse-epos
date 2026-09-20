// Seeds workshop rows directly, for tests whose subject is a read path
// rather than the booking flow that creates them.
//
// Deliberately mirrors createWorkshopJob() in server/server.js - a job plus
// its linked order in one transaction - because the linked order is exactly
// what the portal must not leak back to a customer.
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runWithShop, prepare } from '../../server/db.js';
import { readLegacyStatus } from '../../server/workshop/state-machines.js';

// Mirrors server.js's UPLOADS_DIR.
export const UPLOADS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');

export async function seedWorkshopJob({
  shopId,
  customerId,
  mechanicId = null,
  title = 'Test job',
  jobDate = '2026-09-07',
  startTime = '10:00',
  endTime = '11:00',
  // Was `status = 'scheduled'`. The old column is derived now (migration 021)
  // and Postgres refuses a direct write, so callers that used to name a legacy
  // value name the facts instead. readLegacyStatus() turns the old vocabulary
  // into the new one, so `legacyStatus: 'waiting_parts'` still reads naturally
  // at the call site and lands as the right three states.
  legacyStatus = 'scheduled',
  notes = '',
  orderTotal = 0,
}) {
  const { booking, work, custody } = readLegacyStatus(legacyStatus);
  return runWithShop(shopId, async () => {
    const { lastInsertRowid: jobId } = await prepare(
      `INSERT INTO workshop_jobs (title, customer_id, mechanic_id, job_date, start_time, end_time, booking_state, work_state, custody_state, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())`
    ).run(
      title,
      customerId,
      mechanicId,
      jobDate,
      startTime,
      endTime,
      booking,
      work,
      // readLegacyStatus('complete') returns custody: null on purpose - the old
      // column never said whether the bike left. 'expected' is the column
      // default and the honest choice for a row that never recorded it.
      custody ?? 'expected',
      notes
    );

    const { lastInsertRowid: orderId } = await prepare(
      `INSERT INTO sale_documents (kind, customer_id, subtotal, discount, total, note, title, workshop_job_id, updated_at)
       VALUES ('order', ?, ?, 0, ?, ?, ?, ?, now())`
    ).run(customerId, orderTotal, orderTotal, notes, title, jobId);

    return { jobId, orderId };
  });
}

// The customers row a portal login resolves to. Portal signup creates it;
// tests that seed jobs need its id.
export async function customerIdForLogin(shopId, loginId) {
  return runWithShop(shopId, async () => {
    const row = await prepare('SELECT customer_id FROM customer_logins WHERE id = ?').get(loginId);
    return row?.customer_id ?? null;
  });
}

// The minimum a shop needs before the portal will accept a booking: a
// mechanic to assign it to, and a workshop_settings row for opening hours
// and the full-day threshold. Both tables default every other column.
export async function seedBookableShop(shopId, { mechanicName = 'Test Mechanic', workingDays = null } = {}) {
  return runWithShop(shopId, async () => {
    const { lastInsertRowid: mechanicId } = workingDays
      ? await prepare('INSERT INTO employees (name, is_mechanic, working_days) VALUES (?, 1, ?)')
          .run(mechanicName, JSON.stringify(workingDays))
      : await prepare('INSERT INTO employees (name, is_mechanic) VALUES (?, 1)').run(mechanicName);
    await prepare('INSERT INTO workshop_settings (opening_time) VALUES (?)').run('09:00');
    return { mechanicId };
  });
}

// Attachment uploads land on disk as well as in the database, and
// deleteTestShop() only clears rows. Without this, every test run leaves
// files behind in the repo's uploads/ directory.
export async function purgeAttachmentFiles(shopId) {
  const keys = await runWithShop(shopId, () =>
    prepare('SELECT storage_key FROM workshop_job_attachments').all()
  );
  await Promise.all(
    keys.map((k) => unlink(path.join(UPLOADS_DIR, k.storage_key)).catch(() => {}))
  );
}
