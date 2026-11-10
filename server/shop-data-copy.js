// The shop's own copy of its data (openspec/changes/your-data-download;
// set-data-export; Jack's 10 Nov answers): every customer, sale and refund,
// product and workshop job, a spreadsheet each, in one zip. Runs in the
// request's shop, so row-level security keeps it to that shop. Times are
// written in the shop's time zone, formatted by the database; money in pounds
// with two decimals, as the customer's copy (server/customer-data-copy.js).
// Reads only: nothing is written.
import { prepare } from './db.js';
import { csvOf } from './lib/csv.js';
import { shopZone } from './privacy-requests.js';
import { currentMoment } from './clock.js';
import { receiptLabel } from './till/money.js';
import { linePence } from './workshop/quotes.js';

const WAYS = { sms: 'Text', whatsapp: 'WhatsApp', email: 'Email' };
const YES_VIA = { booking: 'at booking', collection: 'at collection', account: 'from their account', stop_page: 'on the reminders page' };
const yesNo = (on) => (on ? 'Yes' : 'No');
const money = (pence) => (pence == null ? '' : (Number(pence) / 100).toFixed(2));
// Store credit and what's owed show only when there is any (0 is left empty).
const moneyIfAny = (pence) => (Number(pence) ? money(pence) : '');
const WHEN = "'YYYY-MM-DD HH24:MI'";
const DAY = "'YYYY-MM-DD'";

/**
 * Customers.csv: one row per customer not deleted and not merged into another
 * record (design 6), nor removed from the list (active = 0), as Customers shows them. Store credit and what's owed include any record merged in.
 */
async function customersFile(zone) {
  const rows = await prepare(
    `WITH RECURSIVE kept AS (
       SELECT id, id AS root FROM customers WHERE merged_into_id IS NULL AND deleted_at IS NULL AND active = 1
       UNION SELECT c.id, kept.root FROM customers c JOIN kept ON c.merged_into_id = kept.id
     ),
     credit AS (SELECT k.root, sum(e.change_pence) AS pence FROM store_credit_entries e JOIN kept k ON k.id = e.customer_id GROUP BY k.root),
     owed AS (SELECT k.root, sum(e.change_pence) AS pence FROM account_entries e JOIN kept k ON k.id = e.customer_id GROUP BY k.root),
     groups AS (SELECT m.customer_id, string_agg(g.name, '; ' ORDER BY g.name) AS names
                  FROM customer_group_members m JOIN customer_groups g ON g.id = m.group_id GROUP BY m.customer_id)
     SELECT c.name, c.email, c.phone, c.address, c.postcode, c.is_company, c.contact_name, c.vat_number, c.invoice_email,
            groups.names AS group_names, c.update_channel, c.service_reminders, c.review_requests, c.marketing_permission,
            c.reminders_said_yes_via, to_char(c.reminders_said_yes_at AT TIME ZONE ?, ${WHEN}) AS said_yes_at,
            credit.pence AS credit_pence, owed.pence AS owed_pence, c.notes,
            to_char(c.created_at AT TIME ZONE ?, ${DAY}) AS added
       FROM customers c
       LEFT JOIN groups ON groups.customer_id = c.id
       LEFT JOIN credit ON credit.root = c.id
       LEFT JOIN owed ON owed.root = c.id
      WHERE c.merged_into_id IS NULL AND c.deleted_at IS NULL AND c.active = 1
      ORDER BY c.name, c.id`
  ).all(zone, zone);
  return csvOf([
    ['Name', 'Email', 'Mobile', 'Address', 'Postcode', 'Company', 'Contact name', 'VAT number', 'Send invoices to',
      'Customer groups', 'Job updates by', 'Service reminders', 'Review requests', 'Offers and news', 'Said yes to reminders',
      'Store credit (£)', 'Owed on account (£)', 'Notes', 'Added'],
    ...rows.map((c) => [
      c.name, c.email, c.phone, c.address, c.postcode, yesNo(c.is_company), c.contact_name, c.vat_number, c.invoice_email,
      c.group_names, WAYS[c.update_channel] ?? '', yesNo(c.service_reminders), yesNo(c.review_requests), yesNo(c.marketing_permission),
      c.said_yes_at ? `${c.said_yes_at}, ${YES_VIA[c.reminders_said_yes_via] ?? ''}`.replace(/, $/, '') : '',
      moneyIfAny(c.credit_pence), moneyIfAny(c.owed_pence), c.notes, c.added,
    ]),
  ]);
}

/** Stock.csv: one row per active product at each of the shop's sites (small ones 9 and 12). */
async function stockFile() {
  const rows = await prepare(
    `SELECT p.name, p.size, p.colour, p.brand, p.sku, p.barcode, p.category, p.supplier, s.name AS site,
            p.price_pence, p.cost_pence, p.vat_rate_bp, coalesce(ps.qty, 0) AS qty, p.low_stock_threshold
       FROM products p CROSS JOIN sites s
       LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.site_id = s.id
      WHERE p.active = 1
      ORDER BY p.name, p.id, s.id`
  ).all();
  return csvOf([
    ['Product', 'Size', 'Colour', 'Brand', 'SKU', 'Barcode', 'Category', 'Supplier', 'Shop',
      'Price (£)', 'Cost (£)', 'VAT rate (%)', 'Quantity', 'Reorder level'],
    ...rows.map((p) => [
      p.name, p.size, p.colour, p.brand, p.sku, p.barcode, p.category, p.supplier, p.site,
      money(p.price_pence), money(p.cost_pence), p.vat_rate_bp == null ? '' : String(p.vat_rate_bp / 100),
      p.qty, p.low_stock_threshold,
    ]),
  ]);
}

const SALES_HEADER = ['Date', 'Kind', 'Receipt', 'Shop', 'Till', 'Served by', 'Customer', 'Item', 'Quantity',
  'Price each (£)', 'Line total (£)', 'VAT (£)', 'Sale total (£)', 'Paid by', 'Refunded'];
const PAID_BY = { cash: 'Cash', card: 'Card' };

/**
 * Sales and refunds.csv (design 3 and 4; answers 3 and 4): every sale from both records, one
 * row per item sold with the sale's details on each row, and the refunds Wheelhouse records
 * today as minus rows: online deposits refunded, and Shopify refunds (which record what came
 * back, not an amount). Oldest first. Older-record cells never stored (VAT, receipt, shop,
 * till) stay empty. Till refunds join here when step C records them (tasks 5.2).
 */
async function salesFile(zone) {
  const who = "CASE WHEN c.deleted_at IS NULL THEN c.name END";
  const rows = await prepare(
    // Each till sale's ways of paying gathered once, not looked up per line (timed in the pull request).
    `WITH paid AS (SELECT till_sale_id, string_agg(method, ', ' ORDER BY id) AS methods FROM till_sale_payments GROUP BY till_sale_id)
     SELECT r.*, to_char(r.at AT TIME ZONE ?, ${WHEN}) AS shown FROM (
       SELECT a.made_at AS at, 1 AS part, a.id AS sale_id, l.id AS line_id, 'Sale' AS kind,
              t.code AS till, a.receipt_number, si.name AS shop, e.name AS served_by, ${who} AS customer,
              l.description AS item, l.qty, l.unit_price_pence AS each_pence, l.line_total_pence AS line_pence,
              l.vat_pence, a.total_pence,
              paid.methods AS paid_by,
              NULL AS refunded
         FROM all_sales a
         JOIN till_sales ts ON a.source = 'till' AND ts.id = a.id
         JOIN till_sale_lines l ON l.till_sale_id = a.id
         LEFT JOIN paid ON paid.till_sale_id = a.id
         LEFT JOIN tills t ON t.id = ts.till_id
         LEFT JOIN sites si ON si.id = ts.site_id
         LEFT JOIN employees e ON e.id = a.employee_id
         LEFT JOIN customers c ON c.id = a.customer_id
       UNION ALL
       SELECT a.made_at, 0, a.id, l.id, 'Sale', NULL, NULL, NULL, e.name, ${who},
              l.name, l.qty, ROUND(l.unit_price * 100)::int, ROUND(l.line_total * 100)::int,
              NULL, a.total_pence, s.payment_method, NULL
         FROM all_sales a
         JOIN sales s ON a.source = 'old' AND s.id = a.id
         JOIN sale_items l ON l.sale_id = a.id
         LEFT JOIN employees e ON e.id = a.employee_id
         LEFT JOIN customers c ON c.id = a.customer_id
       UNION ALL
       SELECT p.refunded_at, 2, p.id, 0, 'Refund', NULL, NULL, NULL, NULL, ${who},
              'Deposit paid online', 1, -p.amount_pence, -p.amount_pence, NULL, -p.amount_pence,
              'Deposit paid online', 'Online deposit for job ' || coalesce(j.reference, '[job removed]')
         FROM online_payments p
         LEFT JOIN workshop_jobs j ON j.id = p.job_id
         LEFT JOIN customers c ON c.id = j.customer_id
        WHERE p.status = 'refunded'
       UNION ALL
       SELECT m.created_at, 3, m.id, 0, 'Refund', NULL, NULL, NULL, NULL, NULL,
              pr.name, -m.change_qty, NULL, NULL, NULL, NULL, 'Shopify', 'Shopify refund #' || m.shopify_refund_id
         FROM stock_movements m JOIN products pr ON pr.id = m.product_id
        WHERE m.type = 'return' AND m.shopify_refund_id IS NOT NULL
     ) r
     ORDER BY r.at, r.part, r.sale_id, r.line_id`
  ).all(zone);
  return csvOf([SALES_HEADER, ...rows.map((r) => [
    r.shown, r.kind, r.receipt_number == null ? '' : receiptLabel(r.till, r.receipt_number),
    r.shop, r.till, r.served_by, r.customer, r.item, r.qty, money(r.each_pence), money(r.line_pence), money(r.vat_pence),
    money(r.total_pence), r.paid_by == null ? '' : r.paid_by.split(', ').map((m) => PAID_BY[m] ?? m).join(', '), r.refunded,
  ])]);
}

const JOBS_HEADER = ['Job', 'Customer', 'Bike', 'Services', 'Booked in', 'Due', 'Where it’s up to', 'Mechanic',
  'Quoted (£)', 'Final (£)', 'Deposit (£)', 'Collected', 'Staff notes'];

// The job page's word for where a job is up to (jobStage in src/screens/diary/job-dialog.tsx).
function jobStage(j) {
  if (j.booking_state === 'pending') return 'Booking request';
  if (j.booking_state === 'offered') return 'Time offered';
  if (j.booking_state === 'reschedule_requested' && j.requested_job_date) return 'Change requested';
  if (j.booking_state === 'cancelled') return 'Cancelled';
  if (j.booking_state === 'declined') return 'Declined';
  if (j.booking_state === 'expired') return 'Expired';
  if (j.custody_state === 'collected') return 'Collected';
  if (j.work_state === 'complete') return 'Finished';
  if (j.work_state === 'waiting_parts') return 'Waiting for parts';
  if (j.quote_state === 'sent') return 'Quoting';
  if (j.work_state === 'on_hold') return 'On hold';
  if (j.custody_state === 'in_shop') return 'In the workshop';
  if (j.no_show_at) return 'Didn’t come';
  return 'Expected';
}

/**
 * Workshop jobs.csv (answer 6): one row per job. Due is the day it's booked for; Quoted the
 * latest quote's lines; Final what the job was paid at the till (its order turned into a
 * sale); Deposit an online deposit held or taken; staff notes as on the job page.
 */
async function jobsFile(zone) {
  const rows = await prepare(
    // Each job's paid order found once (sale_documents has no index on the job).
    `WITH paid AS (
       SELECT DISTINCT ON (d.workshop_job_id) d.workshop_job_id, ROUND(s.total * 100) AS pence
         FROM sale_documents d JOIN sales s ON s.id = d.converted_sale_id
        WHERE d.workshop_job_id IS NOT NULL AND d.kind = 'order'
        ORDER BY d.workshop_job_id, d.id DESC
     )
     SELECT w.reference, CASE WHEN c.deleted_at IS NULL THEN c.name END AS customer,
            NULLIF(trim(concat_ws(' ', b.make, b.model)), '') AS bike,
            (SELECT string_agg(sv.name, '; ' ORDER BY js.position, js.service_id) FROM workshop_job_services js
               JOIN workshop_services sv ON sv.id = js.service_id WHERE js.workshop_job_id = w.id) AS services,
            to_char(w.booked_in_at AT TIME ZONE ?, ${WHEN}) AS booked_in, w.job_date AS due,
            w.booking_state, w.requested_job_date, w.custody_state, w.work_state, w.no_show_at, lq.state AS quote_state, m.name AS mechanic,
            (SELECT sum(${linePence('l.')}) FROM workshop_quote_lines l WHERE l.workshop_quote_id = lq.id) AS quoted_pence,
            paid.pence AS final_pence,
            (SELECT p.amount_pence FROM online_payments p WHERE p.job_id = w.id AND p.status IN ('held', 'taken', 'refunded')
              ORDER BY p.id DESC LIMIT 1) AS deposit_pence,
            to_char(w.collected_at AT TIME ZONE ?, ${WHEN}) AS collected, w.notes
       FROM workshop_jobs w
       LEFT JOIN customers c ON c.id = w.customer_id
       LEFT JOIN customer_bikes b ON b.id = w.bike_id
       LEFT JOIN employees m ON m.id = w.mechanic_id
       LEFT JOIN paid ON paid.workshop_job_id = w.id
       LEFT JOIN LATERAL (SELECT q.id, q.state FROM workshop_quotes q WHERE q.workshop_job_id = w.id ORDER BY q.revision DESC LIMIT 1) lq ON true
      ORDER BY w.id`
  ).all(zone, zone);
  return csvOf([JOBS_HEADER, ...rows.map((j) => [
    j.reference, j.customer, j.bike, j.services, j.booked_in, j.due, jobStage(j), j.mechanic,
    money(j.quoted_pence), money(j.final_pence), money(j.deposit_pence), j.collected, j.notes,
  ])]);
}

/** The zip's name and files, for GET /api/settings/your-data/download. */
export async function shopDataCopy() {
  const zone = await shopZone();
  const { name, day } = await prepare(
    `SELECT name, to_char((?::timestamptz AT TIME ZONE ?)::date, ${DAY}) AS day FROM shops WHERE id = current_setting('app.current_shop_id')::int`
  ).get(currentMoment().toISOString(), zone);
  return {
    name: `${name} data ${day}.zip`,
    files: [
      { name: 'Customers.csv', content: await customersFile(zone) },
      { name: 'Sales and refunds.csv', content: await salesFile(zone) },
      { name: 'Stock.csv', content: await stockFile() },
      { name: 'Workshop jobs.csv', content: await jobsFile(zone) },
    ],
  };
}
