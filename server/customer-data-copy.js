// A customer's copy of their data (openspec/changes/your-data-copy, design
// 3; account and reminders decision 4): their details, bikes, repairs,
// purchases, messages and what they agreed to, a spreadsheet each. Runs in
// the request's shop, so row-level security keeps it to that shop; every
// query is also by the customer. Times are written in the shop's time zone,
// formatted by the database.
import { prepare } from './db.js';
import { csvOf } from './lib/csv.js';
import { customerConversation } from './workshop/job-notes.js';

// The account's words for where a repair is up to (STAGE_TEXT in src/screens/book/pending-rules.ts).
const STAGE_WORDS = {
  awaiting_confirmation: 'Awaiting shop confirmation', time_offered: 'Another time suggested', confirmed: 'Confirmed',
  in_workshop: 'In the workshop', ready_to_collect: 'Ready to collect', collected: 'Collected',
  change_requested: 'Change requested', declined: 'Declined', cancelled: 'Cancelled', request_expired: 'Request expired',
};
const WAYS = { sms: 'Text', whatsapp: 'WhatsApp', email: 'Email' };
const YES_VIA = { booking: 'at booking', collection: 'at collection', account: 'from your account' };
const yesNo = (on) => (on ? 'Yes' : 'No');
const money = (pence) => (pence == null ? '' : (pence / 100).toFixed(2));
const WHEN = "'YYYY-MM-DD HH24:MI'";
// A purchase's day in the shop's time zone, for display only (the history gives its moment).
const dayIn = (zone, iso) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/**
 * The copy's files for a customer. `history` is the account's history
 * (repairs and purchases, as GET /history gives them); `email` the one they
 * sign in with.
 */
export async function dataCopyFiles({ customerId, email, zone, history }) {
  const c = await prepare(
    `SELECT name, email, phone, address, postcode, is_company, contact_name, vat_number, invoice_email,
            update_channel, service_reminders, review_requests, marketing_permission, reminders_said_yes_via,
            to_char(reminders_said_yes_at AT TIME ZONE ?, ${WHEN}) AS said_yes_at
       FROM customers WHERE id = ?`
  ).get(zone, customerId);
  const details = [['What', 'Yours'], ['Name', c.name], ['Email', c.email], ['Mobile', c.phone], ['Address', c.address], ['Postcode', c.postcode]];
  if (c.is_company) details.push(['Contact name', c.contact_name], ['VAT number', c.vat_number], ['Send invoices to', c.invoice_email]);
  details.push(['Email you sign in with', email]);

  const bikes = await prepare(
    `SELECT make, model, colour, serial_number, to_char(created_at AT TIME ZONE ?, 'YYYY-MM-DD') AS added
       FROM customer_bikes WHERE customer_id = ? AND active = 1 ORDER BY id`
  ).all(zone, customerId);

  const terms = new Map((await prepare(
    `SELECT id, to_char(terms_accepted_at AT TIME ZONE ?, ${WHEN}) AS at FROM workshop_jobs WHERE customer_id = ? AND terms_accepted_at IS NOT NULL`
  ).all(zone, customerId)).map((r) => [r.id, r.at]));
  const repairs = history.filter((h) => h.kind === 'repair');
  const purchases = history.filter((h) => h.kind === 'purchase');

  const conversation = await customerConversation(customerId, { forCustomer: true });
  const conversationAt = await prepare(
    `SELECT id, to_char(created_at AT TIME ZONE ?, ${WHEN}) AS at FROM job_notes WHERE id = ANY(?::int[])`
  ).all(zone, conversation.items.map((i) => i.id));
  const noteAt = new Map(conversationAt.map((r) => [r.id, r.at]));
  // Messages the shop sent that went (design 3): not ones undone, failed or waiting.
  const sent = await prepare(
    `SELECT to_char(coalesce(sent_at, created_at) AT TIME ZONE ?, ${WHEN}) AS at, channel, subject, body
       FROM customer_messages WHERE customer_id = ? AND intent_state = 'delivered'
      ORDER BY coalesce(sent_at, created_at), id`
  ).all(zone, customerId);

  return [
    { name: 'your-details.csv', content: csvOf(details) },
    { name: 'your-bikes.csv', content: csvOf([['Make', 'Model', 'Colour', 'Frame number', 'Added'],
      ...bikes.map((b) => [b.make, b.model, b.colour, b.serial_number, b.added])]) },
    { name: 'your-repairs.csv', content: csvOf([['Reference', 'Date', 'Bike', 'Work', 'Where it’s up to', 'Total (£)', 'Booking terms agreed'],
      ...repairs.map((r) => [r.reference, r.jobDate, r.bikeLabel, r.title, STAGE_WORDS[r.stage] ?? r.stage, money(r.totalPence), terms.get(r.jobId)])]) },
    { name: 'your-purchases.csv', content: csvOf([['Receipt', 'Date', 'What', 'Total (£)'],
      ...purchases.map((p) => [p.receiptNumber ?? `No. ${p.id}`, dayIn(zone, p.at), p.what, money(p.totalPence)])]) },
    { name: 'your-messages.csv', content: csvOf([['When', 'From', 'How', 'About', 'Subject', 'Message'],
      ...conversation.items.map((i) => [noteAt.get(i.id), i.from, 'On your account', i.about?.reference, '', i.text]),
      ...sent.map((m) => [m.at, conversation.shopName, WAYS[m.channel] ?? '', '', m.subject, m.body])]) },
    { name: 'what-you-agreed-to.csv', content: csvOf([['What', 'Your answer'],
      ['Job updates by', WAYS[c.update_channel] ?? WAYS.sms],
      ['Service reminders', yesNo(c.service_reminders)],
      ['Review requests', yesNo(c.review_requests)],
      ['Offers and news', yesNo(c.marketing_permission)],
      ...(c.said_yes_at ? [['Said yes to reminders', `${c.said_yes_at}, ${YES_VIA[c.reminders_said_yes_via] ?? ''}`.replace(/, $/, '')]] : [])]) },
  ];
}
