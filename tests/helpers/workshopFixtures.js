// Seeds workshop rows directly, for tests whose subject is a read path
// rather than the booking flow that creates them.
//
// Deliberately mirrors createWorkshopJob() in server/server.js - a job plus
// its linked order in one transaction - because the linked order is exactly
// what the portal must not leak back to a customer.
import { runWithShop, prepare } from '../../server/db.js';

export async function seedWorkshopJob({
  shopId,
  customerId,
  title = 'Test job',
  jobDate = '2026-09-07',
  startTime = '10:00',
  endTime = '11:00',
  status = 'scheduled',
  notes = '',
  orderTotal = 0,
}) {
  return runWithShop(shopId, async () => {
    const { lastInsertRowid: jobId } = await prepare(
      `INSERT INTO workshop_jobs (title, customer_id, job_date, start_time, end_time, status, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, now())`
    ).run(title, customerId, jobDate, startTime, endTime, status, notes);

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
