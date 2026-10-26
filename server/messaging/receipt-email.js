// The receipt email's words (drawn as receiptEmail on cp-receipt-email,
// collect.mjs; openspec/changes/receipt-email design 3-5), laid out as the
// printed receipt (print receipt answer 2): no VAT line and "Sale [n]" until
// the sale records VAT and receipt numbers; the no-account footer. Plain text,
// as every message. Reads the sale as GET /api/sales/:id does, in pounds.
import { prepare } from '../db.js';
import { MONTHS, money } from '../workshop/job-messages.js';
const row = (left, right) => `${left}  ${right}`;

// "23 Oct 2026 · 10:15" in the shop's time, as the printed receipt says it.
function when(iso) {
  const part = (o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...o }).format(new Date(iso));
  return `${part({ day: 'numeric' })} ${MONTHS[Number(part({ month: 'numeric' })) - 1]} ${part({ year: 'numeric' })} · ${part({ hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** The sale's receipt as { subject, body, customerId }, or null when there's no such sale here. Inside runWithShop. */
export async function receiptEmail(saleId, shopId) {
  const sale = await prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!sale) return null;
  const items = await prepare('SELECT name, qty, unit_price, line_total FROM sale_items WHERE sale_id = ? ORDER BY id').all(saleId);
  const extra = await prepare('SELECT tender_type, amount FROM sale_payments WHERE sale_id = ? ORDER BY id').all(saleId);
  const shop = await prepare('SELECT name, address, phone, vat_number, receipt_footer FROM shops WHERE id = ?').get(shopId);
  // A company or club's receipt is a VAT invoice, with an "Invoice to" block
  // from its record, a blank line left out (openspec/changes/company-customers
  // design 4; collect.mjs receiptBody with invoice; leftover screens H2).
  const company = sale.customer_id
    ? await prepare('SELECT name, address, postcode, vat_number FROM customers WHERE id = ? AND is_company').get(sale.customer_id)
    : null;
  const heading = company ? 'VAT invoice' : 'Your receipt';
  const invoiceTo = company
    ? ['Invoice to', [company.name, [company.address, company.postcode].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
      ...(company.vat_number ? [`VAT number ${company.vat_number}`] : []), '']
    : [];
  const lines = [
    heading,
    '',
    shop.name,
    ...[shop.address, shop.phone, shop.vat_number ? `VAT number ${shop.vat_number}` : null].filter(Boolean),
    '',
    ...invoiceTo,
    `Sale ${sale.id}`,
    when(sale.created_at),
    '',
    ...items.map((it) => row(Number(it.qty) > 1 ? `${it.name} ${it.qty} × ${money(it.unit_price)}` : it.name, money(it.line_total))),
    ...(Number(sale.discount) > 0 ? [row('Discount', `−${money(sale.discount)}`)] : []),
    ...(Number(sale.group_discount_amount) > 0 ? [row(sale.group_discount_name || 'Customer discount', `−${money(sale.group_discount_amount)}`)] : []),
    '',
    row('Total', money(sale.total)),
    ...(Number(sale.cash_amount) > 0 ? [row('Paid by cash', money(sale.cash_amount))] : []),
    ...(Number(sale.card_amount) > 0 ? [row('Paid by card', money(sale.card_amount))] : []),
    ...extra.map((p) => row(`Paid by ${p.tender_type}`, money(p.amount))),
    '',
    ...(shop.receipt_footer ? [shop.receipt_footer, ''] : []),
    ...(shop.phone ? [`Questions? Call ${shop.phone}.`] : []),
    'Keep this for returns. Show this email or give the sale number.',
  ];
  return { subject: `${heading} — ${shop.name}`, body: lines.join('\n'), customerId: sale.customer_id ?? null };
}
