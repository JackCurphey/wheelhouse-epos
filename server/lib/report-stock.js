// The Margin and stock value report's stock half (openspec/changes/reports-ready-made,
// design 6; rp-margin): what is on the shelves today at what it cost, by the
// top level of each product's Stockroom category, and the stock written off
// in the period, from stock takes applied in it and adjustments by reason.
// Everything is read through the request's shop (row-level security).
import { prepare } from '../db.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { periodFor } from './report-periods.js';
import { csvOf } from './csv.js';

const inRange = (col) => `${col} >= (?::date)::timestamp AT TIME ZONE ? AND ${col} < (?::date + 1)::timestamp AT TIME ZONE ?`;
const TOP = "COALESCE(NULLIF(trim(split_part(category, '›', 1)), ''), 'Uncategorised')";

// The eight rows, in the drawing's order.
const ROWS = [
  ['counted-under', 'Stock takes · counted under'],
  ['counted-over', 'Stock takes · counted over'],
  ['damaged', 'Adjusted · Damaged'],
  ['lost_stolen', 'Adjusted · Lost or stolen'],
  ['used_workshop', 'Adjusted · Used in the workshop'],
  ['faulty_return', 'Adjusted · Faulty — to return to supplier'],
  ['found', 'Adjusted · Found'],
  ['other', 'Adjusted · Other'],
];

// Products in stock, at today's cost; one with no cost is counted apart.
async function onTheShelves() {
  const rows = await prepare(
    `SELECT ${TOP} AS label, sum(stock_qty)::int AS items, sum(stock_qty * abs(cost_pence))::bigint AS value
       FROM products WHERE stock_qty > 0 AND cost_pence <> 0 GROUP BY 1 ORDER BY 1`
  ).all();
  const none = await prepare('SELECT count(*)::int AS n FROM products WHERE stock_qty > 0 AND cost_pence = 0').get();
  const shaped = rows.map((r) => ({ label: r.label, items: r.items, valuePence: Number(r.value) }));
  return {
    rows: shaped,
    all: { items: shaped.reduce((n, r) => n + r.items, 0), valuePence: shaped.reduce((n, r) => n + r.valuePence, 0) },
    noCostProducts: none.n,
  };
}

// Items moved and their value at cost, signed by the change: a loss is
// negative, a gain positive.
async function writtenOff(from, through, timeZone) {
  const counted = await prepare(
    `SELECT CASE WHEN r.difference < 0 THEN 'counted-under' ELSE 'counted-over' END AS key,
            sum(abs(r.difference))::int AS items, sum(r.difference * abs(r.cost_pence))::bigint AS value
       FROM stock_take_results r JOIN stock_takes t ON t.id = r.stock_take_id
      WHERE t.status = 'applied' AND r.difference <> 0 AND ${inRange('t.applied_at')} GROUP BY 1`
  ).all(from, timeZone, through, timeZone);
  const adjusted = await prepare(
    `SELECT reason AS key, sum(abs(change_qty))::int AS items, sum(sign(change_qty) * value_pence)::bigint AS value
       FROM stock_movements WHERE type = 'adjustment' AND reason IS NOT NULL AND ${inRange('created_at')} GROUP BY 1`
  ).all(from, timeZone, through, timeZone);
  const found = new Map([...counted, ...adjusted].map((r) => [r.key, r]));
  const rows = ROWS.map(([key, label]) => ({ key, label, items: found.get(key)?.items ?? 0, valuePence: Number(found.get(key)?.value ?? 0) }));
  return {
    rows,
    all: { items: rows.reduce((n, r) => n + r.items, 0), valuePence: rows.reduce((n, r) => n + r.valuePence, 0) },
  };
}

export async function stockReport(choice, today) {
  const timeZone = await currentShopTimeZone();
  const period = periodFor({ ...choice, today });
  const { from, through } = period;
  return {
    period: { period: period.period, from, to: period.to, through, soFar: period.soFar, label: period.label },
    stock: await onTheShelves(),
    writtenOff: await writtenOff(from, through, timeZone),
  };
}

// "[n] products on the shelves have no cost, so they aren't in this".
export const noCostLine = (n) => (n === 1
  ? '1 product on the shelves has no cost, so it isn’t in this'
  : `${n} products on the shelves have no cost, so they aren’t in this`);

// The spreadsheet: both tables as shown, each under its title (design 9).
const pounds = (pence) => (pence / 100).toFixed(2);
export function stockCsv(report) {
  const { stock, writtenOff: w } = report;
  return csvOf([
    ['Stock value by category'],
    ['Category', 'Items', 'What it cost you'],
    ...stock.rows.map((r) => [r.label, r.items, pounds(r.valuePence)]),
    ['All', stock.all.items, pounds(stock.all.valuePence)],
    ...(stock.noCostProducts ? [[noCostLine(stock.noCostProducts)]] : []),
    [],
    ['Stock written off'],
    ['Why', 'Items', 'At cost'],
    ...w.rows.map((r) => [r.label, r.items, pounds(r.valuePence)]),
    ['All', w.all.items, pounds(w.all.valuePence)],
  ]);
}
