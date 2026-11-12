// A sale's receipt for the customer's account (openspec/changes/finish-account
// design 1; ac-receipt, ac-receipt-sent). Only a till sale, which has a receipt
// number ("B1-0000"), has one for now: older in-shop sales, recorded without a
// number, wait for step C (Jack, 9 Nov, answer 1), which adds 'old' here. A
// receipt always shows what was paid, whatever "Show prices online" says
// (answer 5); no barcode (question 7), no refunds (question 13). Pence
// throughout. Inside the shop's runWithShop.
import { prepare } from './db.js';
import { receiptLabel } from './till/money.js';
import { MONTHS } from './workshop/job-messages.js';
import { penceText } from './lib/money-text.js';

// A line break typed into a detail stays on its line (company customers' review 3).
const oneLine = (v) => (v ? String(v).replace(/\s*[\r\n]+\s*/g, ' ').trim() : v);

/**
 * `{ heading, number, at, shop, invoiceTo, lines, totalPence, vatLines, payments, customerId }`
 * for a till sale, or null when there's no such sale here (or it's from a
 * record that has no receipts yet).
 */
export async function receiptFor({ source, id }) {
  if (source !== 'till' || !Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return null;
  const sale = await prepare(
    `SELECT s.id, s.receipt_number, s.till_clock_at, s.total_pence, s.vat_pence, s.customer_id, t.code AS till_code
       FROM till_sales s JOIN tills t ON t.id = s.till_id WHERE s.id = ?`
  ).get(id);
  if (!sale) return null;
  const lines = await prepare(
    'SELECT description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence FROM till_sale_lines WHERE till_sale_id = ? ORDER BY id'
  ).all(id);
  const payments = await prepare('SELECT method, amount_pence FROM till_sale_payments WHERE till_sale_id = ? ORDER BY id').all(id);
  const shop = await prepare("SELECT name, address, phone, vat_number FROM shops WHERE id = current_setting('app.current_shop_id')::int").get();
  // A company or club's receipt is an invoice, with an "Invoice to" block from
  // its record, as the receipt email does it (day answers 26 Oct, 10).
  const company = sale.customer_id
    ? await prepare('SELECT name, address, postcode, vat_number FROM customers WHERE id = ? AND is_company').get(sale.customer_id)
    : null;
  // VAT at each rate, only when the sale has VAT at all.
  const byRate = new Map();
  if (sale.vat_pence > 0) {
    for (const l of lines) if (l.vat_pence) byRate.set(l.vat_rate_bp, (byRate.get(l.vat_rate_bp) ?? 0) + l.vat_pence);
  }
  return {
    heading: company ? 'Invoice' : 'Receipt',
    number: receiptLabel(sale.till_code, sale.receipt_number),
    at: new Date(sale.till_clock_at).toISOString(),
    shop: { name: shop.name, address: shop.address || null, phone: shop.phone || null, vatNumber: shop.vat_number || null },
    invoiceTo: company
      ? {
        name: oneLine(company.name),
        address: [oneLine(company.address), oneLine(company.postcode)].filter(Boolean).join(', ') || null,
        vatNumber: oneLine(company.vat_number) || null,
      }
      : null,
    lines: lines.map((l) => ({ name: l.description, qty: l.qty, unitPence: l.unit_price_pence, totalPence: l.line_total_pence })),
    totalPence: sale.total_pence,
    vatLines: [...byRate].sort((a, b) => b[0] - a[0]).map(([bp, pence]) => ({ ratePercent: bp / 100, pence })),
    payments: payments.map((p) => ({ how: p.method, pence: p.amount_pence })),
    customerId: sale.customer_id ?? null,
  };
}

const pounds = penceText;
const row = (left, right) => `${left}  ${right}`;

// "25 Aug 2026 · 10:05" in the shop's time, as the printed receipt says it.
export function receiptWhen(iso) {
  const part = (o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...o }).format(new Date(iso));
  return `${part({ day: 'numeric' })} ${MONTHS[Number(part({ month: 'numeric' })) - 1]} ${part({ year: 'numeric' })} · ${part({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
}

/** The receipt as plain text, in the receipt email's frame (server/messaging/receipt-email.js), for "Email it to me". */
export function receiptText(r) {
  const invoiceTo = r.invoiceTo
    ? ['Invoice to', [r.invoiceTo.name, r.invoiceTo.address].filter(Boolean).join(' · '), ...(r.invoiceTo.vatNumber ? [`VAT number ${r.invoiceTo.vatNumber}`] : []), '']
    : [];
  return [
    r.heading === 'Invoice' ? 'Invoice' : 'Your receipt',
    '',
    r.shop.name,
    ...[r.shop.address, r.shop.phone, r.shop.vatNumber ? `VAT number ${r.shop.vatNumber}` : null].filter(Boolean),
    '',
    ...invoiceTo,
    `${r.heading} ${r.number}`,
    receiptWhen(r.at),
    '',
    ...r.lines.map((l) => row(l.qty > 1 ? `${l.name} ${l.qty} × ${pounds(l.unitPence)}` : l.name, pounds(l.totalPence))),
    '',
    row(r.vatLines.length ? 'Total (includes VAT)' : 'Total', pounds(r.totalPence)),
    ...r.vatLines.map((v) => row(`VAT at ${v.ratePercent}%`, pounds(v.pence))),
    ...r.payments.map((p) => row(`Paid by ${p.how}`, pounds(p.pence))),
    '',
    ...(r.shop.phone ? [`Questions? Call ${r.shop.phone}.`] : []),
    'Keep this for returns. Show this email or give the receipt number.',
  ].join('\n');
}
