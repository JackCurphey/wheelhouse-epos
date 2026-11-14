// A closed day's summary for the accounts software (reports-accounts-and-reopen design 6; Jack's answers 1 to 3 of
// 12 Nov): worked out from exactly the sales that close counted (never by the clock), as the close's own figures
// are, so it can't differ from the report. Sales by category before VAT, the VAT, the money taken by how it was
// paid (the online money apart), and the cash difference. A sale-level discount is shared between a sale's lines in
// proportion, the last line taking what rounding leaves, so a sale's lines add up to its total to the penny, as the
// changed Sales report does. Where Wheelhouse doesn't record a line yet (refunds, discounts given, the VAT of sales in
// the old record, which keeps none) the summary says so in `notRecorded`; it never guesses.
import { prepare } from '../db.js';
import { accountLines, OTHER_SALES } from './lines.js';
import { ONLINE_TENDERS } from './online-tenders.js';
import { C2W_TENDER } from '../c2w/hand-over.js';

const MONEY = { cash: 'Cash', card: 'Card', accounts: 'Customer accounts', gift: 'Gift cards', c2w: 'Cycle to Work (owed by providers)', online: 'Online sales (paid on the website)' };

// How a payment other than cash and card is booked: online money has its own line; so does a Cycle to Work
// hand-over's provider share ("Cycle to Work · [provider]"), owed by the provider (Jack, 14 Nov, merge-c2w Q1
// option 2), checked before accounts so a provider's name never moves it; a customer account is Customer
// accounts; store credit and gift cards go to Gift cards. A way to pay Wheelhouse can't place goes to Gift cards
// too, as the report's "Other" tile words it ("Gift cards, store credit and customer accounts").
export function moneyBucket(tender) {
  const t = String(tender ?? '').trim().toLowerCase();
  if (t === 'cash') return 'cash';
  if (t === 'card') return 'card';
  if (ONLINE_TENDERS.some((o) => o.toLowerCase() === t)) return 'online';
  if (t.startsWith(C2W_TENDER.toLowerCase())) return 'c2w';
  if (t.includes('account')) return 'accounts';
  return 'gift';
}

const LINES = `
  WITH l AS (
    SELECT 'old' AS source, s.id AS sale_id, COALESCE(si.id, 0) AS line_id, si.product_id, COALESCE(si.line_type, 'product') AS line_type,
           COALESCE(ROUND(si.line_total * 100)::bigint, ROUND(s.total * 100)::bigint) AS gross, 0::bigint AS vat, ROUND(s.total * 100)::bigint AS sale_total
      FROM sales s LEFT JOIN sale_items si ON si.shop_id = s.shop_id AND si.sale_id = s.id WHERE s.day_close_id = ?
    UNION ALL
    SELECT 'till', t.id, COALESCE(tl.id, 0), tl.product_id, 'product', COALESCE(tl.line_total_pence::bigint, t.total_pence::bigint),
           COALESCE(tl.vat_pence::bigint, 0), t.total_pence::bigint
      FROM till_sales t LEFT JOIN till_sale_lines tl ON tl.till_sale_id = t.id WHERE t.day_close_id = ?
  ), w AS (
    SELECT l.*, sum(gross) OVER (PARTITION BY source, sale_id ORDER BY line_id) AS cum,
           sum(gross) OVER (PARTITION BY source, sale_id) AS whole,
           sum(vat) OVER (PARTITION BY source, sale_id ORDER BY line_id) AS vcum,
           row_number() OVER (PARTITION BY source, sale_id ORDER BY line_id) AS rn
      FROM l
  ), n AS (
    SELECT w.*,
           CASE WHEN whole = 0 THEN CASE WHEN rn = 1 THEN sale_total ELSE 0 END
                ELSE ROUND(cum::numeric * sale_total / whole) - ROUND((cum - gross)::numeric * sale_total / whole) END AS share,
           CASE WHEN whole = 0 THEN 0
                ELSE ROUND(vcum::numeric * sale_total / whole) - ROUND((vcum - vat)::numeric * sale_total / whole) END AS vshare
      FROM w
  )
  SELECT CASE WHEN n.line_type = 'labour' THEN 'Labour' WHEN n.product_id IS NULL THEN ? ELSE split_part(p.category, ' › ', 1) END AS category,
         sum(n.share)::bigint::float8 AS gross, sum(n.vshare)::bigint::float8 AS vat
    FROM n LEFT JOIN products p ON p.id = n.product_id GROUP BY 1`;

export async function buildSummary(closeId) {
  const close = await prepare("SELECT to_char(day, 'YYYY-MM-DD') AS day, counted_pence, expected_pence FROM day_closes WHERE id = ?").get(closeId);
  if (!close) return null;
  const known = new Set((await accountLines())[0].lines.map((l) => l.label));
  const rows = await prepare(LINES).all(closeId, closeId, OTHER_SALES);
  const sales = new Map();
  let vatPence = 0;
  let grossPence = 0;
  for (const r of rows) {
    const name = known.has(r.category) ? r.category : OTHER_SALES;
    sales.set(name, (sales.get(name) ?? 0) + (r.gross - r.vat));
    vatPence += r.vat;
    grossPence += r.gross;
  }

  const money = { cash: 0, card: 0, accounts: 0, gift: 0, c2w: 0, online: 0 };
  const add = (tender, pence) => { money[moneyBucket(tender)] += Number(pence); };
  // A hand-over is saved in the old record, never the till's: close-the-day counts a till payment that isn't cash
  // or card as Other, whatever it is called, so it goes to Gift cards here too and Xero matches the report.
  const addTill = (tender, pence) => { const b = moneyBucket(tender); money[b === 'c2w' ? 'gift' : b] += Number(pence); };
  const old = await prepare('SELECT COALESCE(SUM(ROUND(cash_amount * 100)), 0)::bigint::float8 AS cash, COALESCE(SUM(ROUND(card_amount * 100)), 0)::bigint::float8 AS card FROM sales WHERE day_close_id = ?').get(closeId);
  money.cash += old.cash;
  money.card += old.card;
  for (const r of await prepare('SELECT p.tender_type AS tender, SUM(ROUND(p.amount * 100))::bigint::float8 AS pence FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE s.day_close_id = ? GROUP BY 1').all(closeId)) add(r.tender, r.pence);
  for (const r of await prepare('SELECT p.method AS tender, SUM(p.amount_pence)::bigint::float8 AS pence FROM till_sale_payments p JOIN till_sales t ON t.id = p.till_sale_id WHERE t.day_close_id = ? GROUP BY 1').all(closeId)) addTill(r.tender, r.pence);
  const totalPence = Object.values(money).reduce((n, v) => n + v, 0);

  const lines = [
    ...[...sales.entries()].filter(([, v]) => v !== 0).map(([name, v]) => ({ key: `sales:${name}`, label: name, amountPence: v, group: 'sales' })),
    ...(vatPence !== 0 ? [{ key: 'other:vat', label: 'VAT on sales', amountPence: vatPence, group: 'other' }] : []),
    ...Object.entries(money).filter(([, v]) => v !== 0).map(([k, v]) => ({ key: `money:${k}`, label: MONEY[k], amountPence: v, group: 'money' })),
  ];
  const cashDifferencePence = close.counted_pence - close.expected_pence;
  if (cashDifferencePence !== 0) lines.push({ key: 'other:cash_difference', label: 'Cash differences', amountPence: cashDifferencePence, group: 'other' });

  const hasOld = (await prepare('SELECT 1 FROM sales WHERE day_close_id = ? LIMIT 1').get(closeId)) !== undefined;
  return {
    closeId, day: close.day, lines, totalPence, salesPence: grossPence - vatPence, vatPence, cashDifferencePence,
    // What the money taken must equal: the day's sales and VAT.
    balanced: totalPence === grossPence, imbalancePence: totalPence - grossPence,
    notRecorded: ['Refunds', 'Discounts given', ...(hasOld ? ['VAT on old-record sales'] : [])],
  };
}
