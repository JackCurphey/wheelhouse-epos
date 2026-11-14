// "Change what's shown" and the changed report (openspec/changes/reports-your-own,
// design 2 to 6; rp-change, rp-changed). Sales, and Takings and cash-ups, can be
// changed to another measure (Takings, Items sold), split another way (Day, Week,
// Category, Product, Staff member, Payment type) and limited (Only a category or
// Labour, or one supplier). Every figure is read from the sale lines of both
// records, with a sale-level discount shared between its lines in proportion, so
// Takings across every row adds up to the Sales report's Takings for the same
// period. What fits with what is one table (`fitFor`), used by the panel and by
// the server to refuse a combination that doesn't fit, so the two can't disagree.
import { prepare } from '../db.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { periodFor, addDays } from './report-periods.js';
import { ValidationError } from './http.js';
import { csvOf } from './csv.js';
import { workshopRead, serviceCategoryNames } from './report-changed-workshop.js';
import { c2wRead, providerNames, firstC2wDay } from './report-changed-c2w.js';

const BASES = {
  sales: { label: 'Sales', split: 'day', file: 'sales' },
  takings: { label: 'Takings and cash-ups', split: 'payment', file: 'takings' },
  workshop: { label: 'Workshop', split: 'day', file: 'workshop', measure: 'jobs' },
  c2w: { label: 'Cycle to Work', split: 'provider', file: 'c2w', measure: 'paid' },
};
const MEASURES = [['takings', 'Takings'], ['items', 'Items sold'], ['margin', 'Margin'], ['jobs', 'Jobs'], ['hours', 'Hours'], ['bikes', 'Bikes collected'], ['paid', 'Paid'], ['commission', 'Commission']];
const SPLITS = [['day', 'Day'], ['week', 'Week'], ['category', 'Category'], ['product', 'Product'], ['staff', 'Staff member'], ['service', 'Service'], ['provider', 'Provider'], ['shop', 'Shop'], ['payment', 'Payment type']];
// Cycle to Work's own choices: the figures rp-c2w counts for a period, and its grouping. They are offered on
// Cycle to Work only, and it offers nothing else but Day, Week and Shop (as Service is offered on Workshop only).
const C2W_MEASURES = ['bikes', 'paid', 'commission'];
const C2W_SPLITS = ['day', 'week', 'provider', 'shop'];
const NOT_A_BASE = 'Choose Sales, Takings and cash-ups, Workshop or Cycle to Work';
const measureRefused = (base) => (base === 'c2w' ? 'Choose Bikes collected, Paid or Commission' : 'Choose Takings or Items sold');
const splitRefused = (base, split) => (base === 'c2w' ? 'Choose Day, Week or Provider' : split === 'provider' ? 'Cycle to Work only' : 'workshop only');
// A report with no supplier to limit it to.
const noSupplier = (base) => base === 'workshop' || base === 'c2w';
const WORKSHOP_ONLY = 'workshop only — choose it from the Workshop report';
const NOT_BY_ITEM = 'payments aren’t split by item';
const TOO_MANY_DAYS = 'too many days — choose Week';
const ONE_SHOP = 'one shop until a second one is added';
const SALES_ONLY = 'sales only — choose it from the Sales report';
const NO_COSTS = 'costs aren’t kept on sales yet';
// Part 2's PR 5 keeps each sale line's cost; until it has merged, Margin is greyed.
const COSTS_KEPT = false;

// What fits with what, for one selection: every choice in Measure and Split by,
// with `why` set on a greyed one. Margin is not offered at all to someone who
// can't see costs.
export function fitFor(sel, { canSeeCosts }) {
  if (sel.base === 'c2w') return c2wFit(sel);
  const workshop = sel.base === 'workshop';
  const byItem = sel.measure === 'items' || sel.measure === 'margin';
  const limited = sel.only.length > 0 || Boolean(sel.supplier);
  const tooManyDays = sel.period === 'last-12-months' || (sel.period === 'dates' && sel.days > 62);
  const measure = MEASURES.filter(([value]) => (value !== 'margin' || canSeeCosts) && !C2W_MEASURES.includes(value)).map(([value, label]) => {
    let why;
    if (workshop) why = ['takings', 'items', 'margin'].includes(value) ? SALES_ONLY : undefined;
    else why = value === 'jobs' ? WORKSHOP_ONLY : value === 'hours' ? 'workshop only' : value === 'margin' && !COSTS_KEPT ? NO_COSTS : undefined;
    return why ? { value, label, why } : { value, label };
  });
  // Service is a Workshop split: it is not one of the chips on Sales, and asking for it there is refused (`changedReport`).
  const split = SPLITS.filter(([value]) => (value !== 'service' || workshop) && value !== 'provider').map(([value, label]) => {
    let why;
    if (value === 'day' && tooManyDays) why = TOO_MANY_DAYS;
    else if (value === 'shop') why = ONE_SHOP;
    else if (value === 'payment') why = workshop ? SALES_ONLY : byItem || limited ? NOT_BY_ITEM : undefined;
    else if ((value === 'category' || value === 'product') && (workshop || sel.measure === 'jobs' || sel.measure === 'hours')) why = 'jobs aren’t split by product';
    return why ? { value, label, why } : { value, label };
  });
  return { measure, split };
}

// Cycle to Work's table: its three figures, by Day (not over too many days), Week or Provider, and one shop.
function c2wFit(sel) {
  const tooManyDays = sel.period === 'last-12-months' || (sel.period === 'dates' && sel.days > 62);
  const measure = MEASURES.filter(([value]) => C2W_MEASURES.includes(value)).map(([value, label]) => ({ value, label }));
  const split = SPLITS.filter(([value]) => C2W_SPLITS.includes(value)).map(([value, label]) => {
    const why = value === 'day' && tooManyDays ? TOO_MANY_DAYS : value === 'shop' ? ONE_SHOP : undefined;
    return why ? { value, label, why } : { value, label };
  });
  return { measure, split };
}

// The choices in the address, or a 400 saying what to fix.
function parse(query) {
  const base = query.get('base') || 'sales';
  if (!BASES[base]) throw new ValidationError(NOT_A_BASE);
  const measure = query.get('measure') || BASES[base].measure || 'takings';
  if (!MEASURES.some(([v]) => v === measure)) throw new ValidationError('Choose Takings or Items sold');
  const split = query.get('split') || BASES[base].split;
  if (!SPLITS.some(([v]) => v === split)) throw new ValidationError('Choose how to split it');
  return {
    base, measure, split, splitAsked: Boolean(query.get('split')),
    only: [...new Set(query.getAll('only'))], supplier: (query.get('supplier') || '').trim(),
    period: query.get('period') || 'this-week', from: query.get('from'), to: query.get('to'),
  };
}

export const PERIOD_KINDS = ['today', 'this-week', 'this-month', 'last-month', 'last-12-months', 'dates'];

// A report's title and what it is limited to, as the title, the line under it and a saved report's
// description say them: "Sales: items sold by product" and ["Accessories only"].
export function describeChoice(sel) {
  const measureLabel = MEASURES.find(([v]) => v === sel.measure)[1];
  const splitLabel = SPLITS.find(([v]) => v === sel.split)[1];
  const limitParts = [sel.only.length ? `${list(sel.only)} only` : null, sel.supplier ? `${sel.supplier} only` : null].filter(Boolean);
  return { title: `${BASES[sel.base].label}: ${lower(measureLabel)} by ${lower(splitLabel)}`, limitParts, measureLabel, splitLabel, baseLabel: BASES[sel.base].label };
}

// What a saved report may be made of: the same choices the panel offers, refused for the same reasons
// as a typed address. The period is only its kind (a Pick dates report is not checked for days).
export function checkSaved(raw) {
  const text = (v) => typeof v === 'string';
  if (!text(raw.base) || !BASES[raw.base]) throw new ValidationError(NOT_A_BASE);
  if (!text(raw.period) || !PERIOD_KINDS.includes(raw.period)) throw new ValidationError('Choose Today, This week, This month, Last month, Last 12 months or Pick dates');
  if (!text(raw.measure) || !MEASURES.some(([v]) => v === raw.measure)) throw new ValidationError('Choose Takings or Items sold');
  if (!text(raw.split) || !SPLITS.some(([v]) => v === raw.split)) throw new ValidationError('Choose how to split it');
  const again = 'Choose what to limit it to again';
  if (raw.only !== undefined && (!Array.isArray(raw.only) || !raw.only.every(text))) throw new ValidationError(again);
  if (raw.supplier !== undefined && raw.supplier !== null && !text(raw.supplier)) throw new ValidationError(again);
  // Bounded, and no NUL (Postgres can't store one): a report is a few short choices.
  const bad = (v) => v.length > 200 || v.includes('\u0000');
  if ((raw.only ?? []).length > 50 || (raw.only ?? []).some(bad) || bad(raw.supplier ?? '')) throw new ValidationError(again);
  const sel = { base: raw.base, measure: raw.measure, split: raw.split, only: [...new Set(raw.only ?? [])], supplier: (raw.supplier ?? '').trim(), period: raw.period };
  const fit = fitFor({ ...sel, days: 1 }, { canSeeCosts: true });
  if (!fit.measure.some((c) => c.value === sel.measure)) throw new ValidationError(measureRefused(sel.base));
  if (!fit.split.some((c) => c.value === sel.split)) throw new ValidationError(splitRefused(sel.base, sel.split));
  const why = fit.measure.find((c) => c.value === sel.measure)?.why || fit.split.find((c) => c.value === sel.split)?.why;
  if (why) throw new ValidationError(why);
  if (noSupplier(sel.base)) sel.supplier = ''; // a supplier means nothing to the workshop or Cycle to Work
  return sel;
}

const daysIn = (period) => Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) + 1;
const lower = (label) => label.toLowerCase();
const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

const rangeSql = (col) => `${col} >= (?::date)::timestamp AT TIME ZONE ? AND ${col} < (?::date + 1)::timestamp AT TIME ZONE ?`;

// The shop's top-level Stockroom categories, and Labour.
export async function onlyChoices() {
  const rows = await prepare('SELECT name FROM product_categories WHERE parent_id IS NULL ORDER BY lower(name), name').all();
  return [...rows.map((r) => r.name), 'Labour'];
}

// What Only lists for a report: the Stockroom categories and Labour for sales, the service categories for the
// workshop, the providers for Cycle to Work.
export const onlyChoicesFor = (base) => (base === 'workshop' ? serviceCategoryNames() : base === 'c2w' ? providerNames() : onlyChoices());

// The suppliers typed on products that sold between two shop days.
async function suppliersSold(from, to, tz) {
  const rows = await prepare(
    `SELECT DISTINCT trim(p.supplier) AS supplier FROM products p
      WHERE trim(COALESCE(p.supplier, '')) <> '' AND p.id IN (
        SELECT si.product_id FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE ${rangeSql('s.created_at')}
        UNION
        SELECT tl.product_id FROM till_sale_lines tl JOIN till_sales t ON t.id = tl.till_sale_id WHERE ${rangeSql('t.till_clock_at')})
      ORDER BY 1`
  ).all(from, tz, to, tz, from, tz, to, tz);
  return rows.map((r) => r.supplier);
}

// Sale lines from both records, each with its share of the whole sale's total:
// a sale-level discount is spread in proportion, the last line taking what
// rounding leaves, so a sale's lines add up to its total to the penny. A sale
// with no lines kept counts as one line of no product (the LEFT JOIN's empty side), so
// nothing goes missing.
function linesSql(from, to, tz) {
  const args = [from, tz, to, tz];
  const sql = `
    WITH l AS (
      SELECT 'old' AS source, s.id AS sale_id, COALESCE(si.id, 0) AS line_id, s.created_at AS made_at, s.cashier_id AS employee_id,
             si.product_id, COALESCE(si.line_type, 'product') AS line_type, COALESCE(si.qty, 0) AS qty,
             COALESCE(ROUND(si.line_total * 100)::bigint, ROUND(s.total * 100)::bigint) AS gross, ROUND(s.total * 100)::bigint AS sale_total
        FROM sales s LEFT JOIN sale_items si ON si.shop_id = s.shop_id AND si.sale_id = s.id WHERE ${rangeSql('s.created_at')}
      UNION ALL
      SELECT 'till', t.id, COALESCE(tl.id, 0), t.till_clock_at, t.employee_id, tl.product_id, 'product', COALESCE(tl.qty, 0),
             COALESCE(tl.line_total_pence::bigint, t.total_pence::bigint), t.total_pence::bigint
        FROM till_sales t LEFT JOIN till_sale_lines tl ON tl.till_sale_id = t.id WHERE ${rangeSql('t.till_clock_at')}
    ), w AS (
      SELECT l.*, sum(gross) OVER (PARTITION BY source, sale_id ORDER BY line_id) AS cum,
             sum(gross) OVER (PARTITION BY source, sale_id) AS whole,
             row_number() OVER (PARTITION BY source, sale_id ORDER BY line_id) AS rn
        FROM l
    ), n AS (
      SELECT w.*,
             CASE WHEN whole = 0 THEN CASE WHEN rn = 1 THEN sale_total ELSE 0 END
                  ELSE ROUND(cum::numeric * sale_total / whole) - ROUND((cum - gross)::numeric * sale_total / whole) END AS net,
             to_char(made_at AT TIME ZONE ?, 'YYYY-MM-DD') AS day_key,
             to_char(date_trunc('week', made_at AT TIME ZONE ?), 'YYYY-MM-DD') AS week_key
        FROM w
    )`;
  return { sql, params: [...args, ...args, tz, tz] };
}

const NO_PRODUCT = "CASE WHEN n.line_type = 'labour' THEN 'Labour' WHEN n.product_id IS NULL THEN 'No product' END";
const KEYS = {
  day: ['n.day_key', 'n.day_key'],
  week: ['n.week_key', 'n.week_key'],
  category: [`COALESCE(${NO_PRODUCT}, split_part(p.category, ' › ', 1))`, `COALESCE(${NO_PRODUCT}, split_part(p.category, ' › ', 1))`],
  product: [`COALESCE(${NO_PRODUCT}, 'p' || p.id)`, `COALESCE(${NO_PRODUCT}, p.name)`],
  staff: ["COALESCE(n.employee_id::text, 'none')", "COALESCE(e.name, 'Not recorded')"],
};

// Takings and items for each key between two shop days, limited as asked.
async function grouped(split, from, to, tz, { only, supplier }) {
  const lines = linesSql(from, to, tz);
  const [key, label] = KEYS[split];
  const where = [];
  const params = [...lines.params];
  if (only.length) {
    const terms = only.map((o) => {
      if (o === 'Labour') return "n.line_type = 'labour'";
      params.push(o, o);
      return "(n.line_type <> 'labour' AND (p.category = ? OR starts_with(p.category, ? || ' › ')))";
    });
    where.push(`(${terms.join(' OR ')})`);
  }
  if (supplier) {
    where.push('trim(p.supplier) = ?');
    params.push(supplier);
  }
  const rows = await prepare(
    `${lines.sql}
     SELECT ${key} AS key, ${label} AS label, sum(n.net)::bigint::float8 AS pence, sum(n.qty)::bigint::float8 AS qty
       FROM n LEFT JOIN products p ON p.id = n.product_id LEFT JOIN employees e ON e.id = n.employee_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY 1, 2`
  ).all(...params);
  return new Map(rows.map((r) => [String(r.key), { label: r.label, pence: r.pence, qty: r.qty }]));
}

// Takings by how each sale was paid. A Split sale counts its cash under Cash and
// its card under Card; a till payment is whatever method it names; money a till
// sale's payments don't account for is "Other", so the rows still add up.
async function paymentsGrouped(from, to, tz) {
  const args = [from, tz, to, tz];
  const rows = await prepare(
    `SELECT key, sum(pence)::bigint::float8 AS pence FROM (
       SELECT 'cash' AS key, ROUND((CASE s.payment_method WHEN 'Split' THEN s.cash_amount WHEN 'Cash' THEN s.total ELSE 0 END) * 100)::bigint AS pence
         FROM sales s WHERE ${rangeSql('s.created_at')}
       UNION ALL
       SELECT 'card', ROUND((CASE s.payment_method WHEN 'Split' THEN s.card_amount WHEN 'Card' THEN s.total ELSE 0 END) * 100)::bigint
         FROM sales s WHERE ${rangeSql('s.created_at')}
       UNION ALL
       SELECT lower(s.payment_method), ROUND(s.total * 100)::bigint
         FROM sales s WHERE s.payment_method NOT IN ('Cash', 'Card', 'Split') AND ${rangeSql('s.created_at')}
       UNION ALL
       SELECT lower(p.method), p.amount_pence::bigint
         FROM till_sale_payments p JOIN till_sales t ON t.id = p.till_sale_id WHERE ${rangeSql('t.till_clock_at')}
       UNION ALL
       SELECT 'other', t.total_pence - COALESCE((SELECT sum(x.amount_pence) FROM till_sale_payments x WHERE x.till_sale_id = t.id), 0)
         FROM till_sales t WHERE ${rangeSql('t.till_clock_at')}
     ) paid GROUP BY key HAVING sum(pence) <> 0`
  ).all(...args, ...args, ...args, ...args, ...args);
  const word = (k) => (k === 'cash' ? 'Cash' : k === 'card' ? 'Card' : k === 'other' ? 'Other' : k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '));
  return new Map(rows.map((r) => [r.key, { label: word(r.key), pence: r.pence, qty: 0 }]));
}

const readGroups = (split, from, to, tz, limits) => (split === 'payment' ? paymentsGrouped(from, to, tz) : grouped(split, from, to, tz, limits));

async function firstSaleDay(tz) {
  const row = await prepare("SELECT to_char(min(made_at) AT TIME ZONE ?, 'YYYY-MM-DD') AS day FROM all_sales").get(tz);
  return row?.day ?? null;
}

// The day the workshop's own history starts: its first finished job or diary block, so Workshop compares with
// the period before from its own records and not from the first sale.
async function firstWorkshopDay(tz) {
  const row = await prepare(
    `SELECT least(
       (SELECT to_char(min(signed_off_at) AT TIME ZONE ?, 'YYYY-MM-DD') FROM workshop_jobs),
       (SELECT min(part_date) FROM workshop_job_parts)) AS day`
  ).get(tz);
  return row?.day ?? null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekLabel = (monday) => `Week of ${Number(monday.slice(8))} ${MONTHS[Number(monday.slice(5, 7)) - 1]}`;
const mondayOf = (iso) => {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((day + 6) % 7));
};

// A group's figure for the measure: pence for Takings and Margin, a count for Items sold and Jobs, hours (to a
// tenth) for Hours.
const COUNTED = new Set(['items', 'jobs', 'hours', 'bikes']);
const tenth = (n) => Math.round(n * 10) / 10;
const measureValue = (measure, g) => (g === undefined ? 0 : measure === 'hours' ? tenth(g.qty) : COUNTED.has(measure) ? g.qty : g.pence);

// The rows of the graph and table for the split chosen, with the period before beside each.
function rowsFor(sel, period, now, before) {
  const value = (g) => measureValue(sel.measure, g);
  const make = (key, label, g, beforeG, extra = {}) => ({
    key, label, value: value(g), takingsPence: g?.pence ?? 0, beforeValue: beforeG === undefined ? 0 : value(beforeG), ...extra,
  });
  if (sel.split === 'day') {
    if (period.unit === 'hour') return [make(period.from, 'Today', now.get(period.from), before.get(period.before.from))];
    return period.buckets.map((b) => (b.notReached
      ? { key: b.key, label: b.label, notReached: true, value: null, takingsPence: null, beforeValue: value(before.get(String(b.beforeKey))) }
      : make(b.key, b.label, now.get(String(b.key)), before.get(String(b.beforeKey)))));
  }
  if (sel.split === 'week') {
    const out = [];
    for (let monday = mondayOf(period.from); monday <= period.to; monday = addDays(monday, 7)) {
      out.push(monday > period.through
        ? { key: monday, label: weekLabel(monday), notReached: true, value: null, takingsPence: null, beforeValue: null }
        : make(monday, weekLabel(monday), now.get(monday), undefined, { beforeValue: null }));
    }
    return out;
  }
  return [...now.entries()]
    .map(([key, g]) => make(key, g.label, g, before.get(key)))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

// Fall back to a split that fits what else is chosen.
function settle(sel, fit) {
  const greyed = (group, value) => fit[group].find((c) => c.value === value)?.why;
  const measure = greyed('measure', sel.measure) || !fit.measure.some((c) => c.value === sel.measure) ? BASES[sel.base].measure || 'takings' : sel.measure;
  let split = sel.split;
  if (greyed('split', split) || !fit.split.some((c) => c.value === split)) split = measure === 'items' ? 'product' : fit.split.find((c) => c.value === 'day' && !c.why) ? 'day' : 'week';
  return { measure, split };
}

async function choicesFor(sel, period, tz, ctx) {
  const fit = fitFor({ ...sel, days: daysIn(period) }, ctx);
  const workshop = noSupplier(sel.base);
  const only = await onlyChoicesFor(sel.base);
  // The workshop and Cycle to Work have no supplier: no chips, and the panel leaves the group out.
  const suppliers = workshop ? [] : await suppliersSold(period.from, period.to, tz);
  return {
    ...fit,
    only: only.map((value) => ({ value, label: value })),
    // The supplier already chosen stays a chip even when it sold nothing in this period.
    suppliers: workshop ? [] : [{ value: '', label: 'Any supplier' }, ...[...new Set([...suppliers, ...(sel.supplier ? [sel.supplier] : [])])].sort().map((value) => ({ value, label: value }))],
  };
}

async function setUp(query, today, ctx) {
  const sel = parse(query);
  const tz = await currentShopTimeZone();
  const period = periodFor({ period: sel.period, today, from: sel.from, to: sel.to });
  const everyOnly = await onlyChoicesFor(sel.base);
  if (noSupplier(sel.base)) sel.supplier = '';
  sel.only = everyOnly.filter((o) => sel.only.includes(o)); // what's left, in the panel's order
  return { sel, tz, period, everyOnly, ctx };
}

// The choices for any selection, moved to one that fits: the panel asks this on each click.
export async function changedChoices(query, today, ctx) {
  const { sel, tz, period } = await setUp(query, today, ctx);
  const fit = fitFor({ ...sel, days: daysIn(period) }, ctx);
  const { measure, split } = settle(sel, fit);
  const settled = { ...sel, measure, split };
  return {
    base: sel.base, selection: { measure, split, only: sel.only, supplier: sel.supplier },
    choices: await choicesFor(settled, period, tz, ctx),
  };
}

export async function changedReport(query, today, ctx) {
  const { sel, tz, period } = await setUp(query, today, ctx);
  let fit = fitFor({ ...sel, days: daysIn(period) }, ctx);
  // A split nobody asked for moves to one that fits (Week, for a year); one asked for is refused.
  if (!sel.splitAsked && fit.split.find((c) => c.value === sel.split)?.why) {
    sel.split = settle(sel, fit).split;
    fit = fitFor({ ...sel, days: daysIn(period) }, ctx);
  }
  const refused = (group, value) => fit[group].find((c) => c.value === value)?.why;
  if (!fit.measure.some((c) => c.value === sel.measure)) throw new ValidationError(measureRefused(sel.base));
  const measureWhy = refused('measure', sel.measure);
  if (measureWhy) throw new ValidationError(measureWhy);
  if (!fit.split.some((c) => c.value === sel.split)) throw new ValidationError(splitRefused(sel.base, sel.split));
  const splitWhy = refused('split', sel.split);
  if (splitWhy) throw new ValidationError(splitWhy);

  const limits = { only: sel.only, supplier: sel.supplier };
  const asked = (from, to) => ({ measure: sel.measure, split: sel.split, from, to, tz, only: sel.only });
  const read = async (from, to) => (sel.base === 'workshop' ? workshopRead(asked(from, to))
    : sel.base === 'c2w' ? c2wRead(asked(from, to))
      : { groups: await readGroups(sel.split, from, to, tz, limits) });
  const nowRead = await read(period.from, period.through);
  const beforeRead = await read(period.before.from, period.before.to);
  const now = nowRead.groups;
  const rows = rowsFor(sel, period, now, beforeRead.groups);
  const key = COUNTED.has(sel.measure) ? 'qty' : 'pence';
  const sum = (groups, k) => [...groups.values()].reduce((n, g) => n + g[k], 0);
  // A job under several services is one job: the workshop's own total counts it once.
  const figure = (r) => measureValue(sel.measure, { qty: r.total ?? sum(r.groups, 'qty'), pence: sum(r.groups, 'pence') });
  const value = key === 'qty' ? figure(nowRead) : sum(now, 'pence');
  const takingsPence = sum(now, 'pence');
  const beforeValue = key === 'qty' ? figure(beforeRead) : sum(beforeRead.groups, 'pence');

  const firstSaleOn = sel.base === 'workshop' ? await firstWorkshopDay(tz) : sel.base === 'c2w' ? await firstC2wDay(tz) : await firstSaleDay(tz);
  const nothingBefore = !firstSaleOn || firstSaleOn >= period.from;
  const baseLabel = BASES[sel.base].label;
  const measureLabel = MEASURES.find(([v]) => v === sel.measure)[1];
  const splitLabel = SPLITS.find(([v]) => v === sel.split)[1];
  const limitParts = [sel.only.length ? `${list(sel.only)} only` : null, sel.supplier ? `${sel.supplier} only` : null].filter(Boolean);

  return {
    base: sel.base, baseLabel, measure: sel.measure, split: sel.split, only: sel.only, supplier: sel.supplier,
    title: `${baseLabel}: ${lower(measureLabel)} by ${lower(splitLabel)}`,
    // What the report is, as a saved report and the save popup say it.
    what: [`${baseLabel}: ${lower(measureLabel)} by ${lower(splitLabel)}`, ...limitParts].join(' · '),
    line: ['Changed from ' + baseLabel, ...limitParts, `${period.label}, against ${period.against}`].join(' · '),
    period: {
      period: period.period, from: period.from, to: period.to, through: period.through, soFar: period.soFar,
      unit: period.unit, label: period.label, against: period.against,
    },
    columns: [splitLabel, measureLabel, ...(sel.measure === 'items' || sel.measure === 'margin' ? ['Takings'] : [])],
    rows,
    total: { label: limitParts.length ? `Total, ${limitParts.join(', ')}` : 'Total', value, takingsPence },
    figures: { value, beforeValue, diffValue: nothingBefore ? null : tenth(value - beforeValue) },
    showBefore: !nothingBefore && sel.split !== 'week',
    empty: now.size === 0 || (value === 0 && takingsPence === 0),
    nothingBefore, firstSaleOn,
    choices: await choicesFor(sel, period, tz, ctx),
    fileName: `${BASES[sel.base].file}-changed`,
  };
}

// The table as shown, for the spreadsheet: pounds and pence, a day to come is "—".
const MONEY = new Set(['takings', 'margin', 'paid', 'commission']);
const pounds = (pence) => (pence === null || pence === undefined ? '—' : (pence / 100).toFixed(2));
export function changedCsv(report) {
  const money = MONEY.has(report.measure);
  const withTakings = report.measure === 'items' || report.measure === 'margin';
  const cell = (value) => (value === null ? '—' : money ? pounds(value) : value);
  const line = (label, value, takings) => [label, cell(value), ...(withTakings ? [pounds(takings)] : [])];
  return csvOf([
    report.columns,
    ...report.rows.map((r) => line(r.label, r.value, r.takingsPence)),
    line(report.total.label, report.total.value, report.total.takingsPence),
  ]);
}
