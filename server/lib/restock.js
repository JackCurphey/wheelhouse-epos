// The restock list (openspec/changes/restock-list, design 2; receiving decision 2; walk-through
// 3 M1 and M7): what's running low, selling fast, or waited for by a job, grouped by supplier,
// each with a suggested count. Read in the business's own rows (row-level security); stock is
// each product's total, as Stock's Running low reads it.
//
// The numbers below settle the details Jack's 27 Oct answer 2 left open, as defaults for him to
// overrule (decided-while-building.md, Jack's lane, 8 Nov): one line each to change.
import { prepare } from '../db.js';

// "Sold, last [n] days" and what selling fast is measured over.
export const DAYS = 28;
// Usual: what sold in the 24 weeks before those 28 days, per 28 days.
const USUAL_PERIODS = 6;
// Selling fast: at least this many in the 28 days ...
const FAST_AT_LEAST = 3;
// ... and at least this many times the usual.
const FAST_TIMES = 2;
export const NO_SUPPLIER = 'No supplier';

// A supplier's name as typed, compared ignoring capitals and spaces at either end (Jack's
// 4 Nov answer 10: matched by name).
export const nameKey = (s) => String(s ?? '').trim().toLocaleLowerCase('en-GB');

// Sales at the till and online: stock lines of type sale and till_sale (every sale moves stock
// through moveStock, so this is the one place they all are).
async function salesByProduct() {
  const rows = await prepare(
    `SELECT product_id,
            COALESCE(SUM(-change_qty) FILTER (WHERE created_at >= now() - make_interval(days => ?)), 0)::int AS sold,
            COALESCE(SUM(-change_qty) FILTER (WHERE created_at < now() - make_interval(days => ?)), 0)::int AS before
     FROM stock_movements
     WHERE type IN ('sale', 'till_sale') AND product_id IS NOT NULL
       AND created_at >= now() - make_interval(days => ?)
     GROUP BY product_id`
  ).all(DAYS, DAYS, DAYS * (USUAL_PERIODS + 1));
  return new Map(rows.map((r) => [r.product_id, r]));
}

// Still to come on draft, ordered and partly delivered orders: per product, those for a job
// (by job) and the rest. Damaged and wrong items set aside count as come, as an order's page
// says (purchase-orders.js loadPurchaseOrderItems).
async function onOrder() {
  const rows = await prepare(
    `SELECT poi.product_id, poi.workshop_job_id,
            SUM(GREATEST(poi.qty_ordered - poi.qty_received
              - COALESCE((SELECT SUM(dp.qty) FROM delivery_problems dp
                          WHERE dp.purchase_order_id = poi.purchase_order_id AND dp.purchase_order_item_id = poi.id
                            AND dp.kind IN ('damaged', 'wrong_item')), 0), 0))::int AS qty
     FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.purchase_order_id
     WHERE po.status IN ('draft', 'ordered', 'partially_received') AND poi.product_id IS NOT NULL
     GROUP BY poi.product_id, poi.workshop_job_id`
  ).all();
  const plain = new Map();
  const forJob = new Map();
  for (const r of rows) {
    if (r.workshop_job_id === null) plain.set(r.product_id, (plain.get(r.product_id) ?? 0) + r.qty);
    else forJob.set(`${r.workshop_job_id}:${r.product_id}`, r.qty);
  }
  return { plain, forJob };
}

// What open jobs' orders need, per product, in the order the stock goes to them: the job's
// day, then the order the jobs were made. Finished and cancelled jobs (status complete) and
// requests not yet accepted (pending) don't count.
async function jobNeeds() {
  const rows = await prepare(
    `SELECT w.id AS job_id, w.reference, w.job_date, c.name AS customer, i.product_id, SUM(i.qty)::int AS qty
     FROM sale_document_items i
     JOIN sale_documents d ON d.id = i.document_id
     JOIN workshop_jobs w ON w.id = d.workshop_job_id
     LEFT JOIN customers c ON c.id = w.customer_id
     WHERE d.kind = 'order' AND d.status = 'open' AND w.status NOT IN ('complete', 'pending') AND i.product_id IS NOT NULL
     GROUP BY w.id, w.reference, w.job_date, c.name, i.product_id
     HAVING SUM(i.qty) > 0
     ORDER BY w.job_date, w.id`
  ).all();
  const byProduct = new Map();
  for (const r of rows) {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []);
    byProduct.get(r.product_id).push(r);
  }
  return byProduct;
}

// The list, and the keys of its lines for "new since last opened" (low:[product],
// fast:[product], job:[job]:[product]).
export async function restockList() {
  // One after another: a request has one connection, which takes one query at a time.
  const sales = await salesByProduct();
  const ordered = await onOrder();
  const needs = await jobNeeds();
  const suppliers = await prepare('SELECT id, name FROM suppliers ORDER BY name').all();
  const fastIds = [...sales.values()]
    .filter((s) => s.sold >= FAST_AT_LEAST && s.sold >= FAST_TIMES * (s.before / USUAL_PERIODS))
    .map((s) => s.product_id);
  const products = await prepare(
    `SELECT id, name, sku, barcode, stock_qty, low_stock_threshold, supplier, active FROM products
     WHERE (active = 1 AND ((low_stock_threshold > 0 AND stock_qty <= low_stock_threshold) OR id = ANY(?::int[])))
        OR id = ANY(?::int[])
     ORDER BY name, id`
  ).all(fastIds, [...needs.keys()]);

  const fastSet = new Set(fastIds);
  const supplierByName = new Map(suppliers.map((s) => [nameKey(s.name), s]));
  const groups = new Map();
  const keys = [];
  for (const p of products) {
    const sold = sales.get(p.id)?.sold ?? 0;
    // The stock goes to jobs in turn, then what's still to come on orders not for a job; what
    // neither covers is each job's shortfall, less what's to come on an order for that job.
    let free = Math.max(p.stock_qty, 0);
    let coming = ordered.plain.get(p.id) ?? 0;
    let covered = 0;
    const jobs = [];
    for (const n of needs.get(p.id) ?? []) {
      let short = Math.max(0, n.qty - (ordered.forJob.get(`${n.job_id}:${p.id}`) ?? 0));
      const take = Math.min(free, short);
      free -= take;
      covered += take;
      short -= take;
      const fromOrder = Math.min(coming, short);
      coming -= fromOrder;
      short -= fromOrder;
      if (short > 0) jobs.push({ jobId: n.job_id, ref: n.reference ?? null, customer: n.customer ?? null, promised: n.job_date, qty: short });
    }
    // An off-sale product is listed only for the jobs still waiting for it.
    let low = p.active === 1 && p.low_stock_threshold > 0 && p.stock_qty <= p.low_stock_threshold;
    let fast = p.active === 1 && fastSet.has(p.id);
    // The shop's own stock and orders are what's left once the jobs take theirs, so nothing
    // counts twice.
    const rule = p.low_stock_threshold + sold - (p.stock_qty - covered) - coming;
    // Already ordered enough: not low or fast here.
    if (rule <= 0) { low = false; fast = false; }
    if (!low && !fast && jobs.length === 0) continue;
    if (low) keys.push(`low:${p.id}`);
    if (fast) keys.push(`fast:${p.id}`);
    for (const j of jobs) keys.push(`job:${j.jobId}:${p.id}`);

    const matched = supplierByName.get(nameKey(p.supplier));
    const typed = String(p.supplier ?? '').trim();
    const groupName = matched ? matched.name : typed || NO_SUPPLIER;
    const groupKey = matched ? `s${matched.id}` : `t${nameKey(groupName)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { supplier: groupName, supplierId: matched ? matched.id : null, lines: [] });
    groups.get(groupKey).lines.push({
      productId: p.id, name: p.name, sku: p.sku ?? '', barcode: p.barcode ?? '', stock: p.stock_qty, sold, low, fast,
      suggested: low || fast ? Math.max(1, rule) : 0, jobs,
    });
  }
  const sorted = [...groups.values()].sort((a, b) => {
    if (a.supplier === NO_SUPPLIER && a.supplierId === null) return 1;
    if (b.supplier === NO_SUPPLIER && b.supplierId === null) return -1;
    return a.supplier.localeCompare(b.supplier, 'en-GB');
  });
  const lines = sorted.flatMap((g) => g.lines);
  return {
    days: DAYS,
    groups: sorted,
    counts: { low: lines.filter((l) => l.low).length, fast: lines.filter((l) => l.fast).length, customers: lines.filter((l) => l.jobs.length).length },
    keys,
  };
}

// What's come onto the list since this person last opened it: how many products, and how
// many of those are for jobs.
export async function newSince(loginId, keys) {
  const row = await prepare('SELECT seen_keys FROM restock_seen WHERE login_id = ?').get(loginId);
  const seen = new Set(row?.seen_keys ?? []);
  const fresh = keys.filter((k) => !seen.has(k));
  const product = (k) => k.split(':').at(-1);
  const forJobs = new Set(fresh.filter((k) => k.startsWith('job:')).map(product));
  return { newCount: new Set(fresh.map(product)).size, newForJobs: forJobs.size };
}

export async function markSeen(loginId, keys) {
  await prepare(
    `INSERT INTO restock_seen (login_id, seen_keys, seen_at) VALUES (?, ?::text[], now())
     ON CONFLICT (login_id) DO UPDATE SET seen_keys = EXCLUDED.seen_keys, seen_at = now()
     RETURNING login_id`
  ).run(loginId, keys);
}
