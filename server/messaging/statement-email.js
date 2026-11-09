// A customer's account statement by email (openspec/changes/finish-customers, design 5; cs-account's
// "Email the statement"). Not drawn: it follows the receipt email's frame (not-drawn pages row 44's
// pattern; design question 10): the shop, "Your account with [shop]", each entry newest first with
// its date and amount, "You owe [£]", and how to pay. Plain text, as every message.
import { prepare } from '../db.js';
import { MONTHS } from '../workshop/job-messages.js';
import { accountEntries, owedOf, pounds } from '../lib/customer-money.js';

const row = (left, right) => `${left}  ${right}`;
const signed = (pence) => `${pence < 0 ? '−' : '+'}${pounds(Math.abs(pence))}`;
// "1 Sep 2026", from a date or a moment, in the shop's day.
function day(dateOrIso) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateOrIso) ? new Date(`${dateOrIso}T12:00:00Z`) : new Date(dateOrIso);
  const part = (o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...o }).format(d);
  return `${part({ day: 'numeric' })} ${MONTHS[Number(part({ month: 'numeric' })) - 1]} ${part({ year: 'numeric' })}`;
}

/** What a statement line says (the drawing's "Sale on account · B1-[0000]", "Paid by bank transfer · [reference]"). */
export function statementWords(e) {
  if (e.kind === 'opening') return 'Owed from before Wheelhouse';
  if (e.kind === 'bank_transfer') return ['Paid by bank transfer', e.reference].filter(Boolean).join(' · ');
  if (e.kind === 'sale_on_account') return ['Sale on account', e.tillSaleId ?? e.saleId].filter(Boolean).join(' · ');
  if (e.kind === 'till_payment') return 'Paid at the till';
  return ['Put right', e.reason].filter(Boolean).join(' · ');
}

/** The statement email as { to, subject, body }, to the company's invoice address or their email; null `to` when neither. */
export async function statementEmail(customerId, shopId) {
  const c = await prepare('SELECT name, email, is_company, invoice_email FROM customers WHERE id = ?').get(customerId);
  const shop = await prepare('SELECT name, address, phone FROM shops WHERE id = ?').get(shopId);
  const to = (c.is_company && c.invoice_email?.trim()) || c.email?.trim() || null;
  const entries = await accountEntries(customerId);
  const owed = await owedOf(customerId);
  const lines = [
    `Your account with ${shop.name}`,
    '',
    shop.name,
    ...[shop.address, shop.phone].filter(Boolean),
    '',
    c.name,
    '',
    ...entries.map((e) => row(`${day(e.receivedOn ?? e.at)} · ${statementWords(e)}`, signed(e.changePence))),
    '',
    `You owe ${pounds(Math.max(owed, 0))}`,
    '',
    shop.phone ? `To pay, or with any questions, call ${shop.phone}.` : 'To pay, or with any questions, ask the shop.',
  ];
  return { to, subject: `Your account with ${shop.name}`, body: lines.join('\n') };
}
