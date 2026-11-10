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
const JOBS_HEADER = ['Job', 'Customer', 'Bike', 'Services', 'Booked in', 'Due', 'Where it’s up to', 'Mechanic',
  'Quoted (£)', 'Final (£)', 'Deposit (£)', 'Collected', 'Staff notes'];

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
      { name: 'Sales and refunds.csv', content: csvOf([SALES_HEADER]) },
      { name: 'Stock.csv', content: await stockFile() },
      { name: 'Workshop jobs.csv', content: csvOf([JOBS_HEADER]) },
    ],
  };
}
