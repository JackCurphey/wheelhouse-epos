// What a job's messages are filled in with (the messages engine, Jack 20 Oct:
// pretend for now; openspec/changes/messages-engine/design.md "Triggers").
// Inside the shop's runWithShop.
import { prepare, pool } from '../db.js';
import { openingHoursFor } from '../capacity.js';
import { toCapacitySettings } from './jobs.js';
import { formatOpeningHours } from '../messaging/templates.js';

const money = (amount) => `£${Number(amount).toFixed(2)}`;

/** The job's customer, and its tap-ins, given the link issued for it. */
export async function jobMessageVars(jobId, shopId, link) {
  const job = await prepare(
    `SELECT w.reference, w.customer_id, c.name AS customer_name, trim(b.make || ' ' || b.model) AS bike_label,
            d.total AS order_total, d.status AS order_status
       FROM workshop_jobs w LEFT JOIN customers c ON c.id = w.customer_id
       LEFT JOIN customer_bikes b ON b.id = w.bike_id
       LEFT JOIN sale_documents d ON d.workshop_job_id = w.id AND d.kind = 'order' AND d.status <> 'cancelled'
      WHERE w.id = ? ORDER BY d.id DESC LIMIT 1`
  ).get(jobId);
  const { rows: [shop] } = await pool.query('SELECT name FROM shops WHERE id = $1', [shopId]);
  const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  // Paid already, or nothing on the order: "Nothing to pay on collection".
  const owed = job.order_status === 'converted' || !(Number(job.order_total) > 0) ? 'Nothing' : money(job.order_total);
  return {
    customerId: job.customer_id,
    customerName: job.customer_name,
    vars: {
      'Customer’s first name': (job.customer_name ?? '').trim().split(/\s+/)[0],
      Bike: job.bike_label || null,
      'Shop name': shop.name,
      'Job number': job.reference,
      'Link to the quote': link,
      'Link to the job': link,
      'Amount to pay': owed,
      'Opening hours': settings ? formatOpeningHours(openingHoursFor(toCapacitySettings(settings))) : null,
    },
  };
}
