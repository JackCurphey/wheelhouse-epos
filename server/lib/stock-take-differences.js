// A stock take's differences (tk-diff; openspec/changes/stock-take design 8).
// Expected is measured for each product at the moment of its last count:
// whatever was sold, booked in, used, sent or adjusted after that is allowed
// for, and whatever moved before it is already in what was counted (decided
// here for Jack to overrule, 28 Oct). So:
//   expected   = stock now - what moved after the product's last count
//   difference = counted - expected
// and applying adds the difference to stock as it is then. Run inside the
// caller's transaction; applying locks the products first, so what this reads
// can't move under it.
import { prepare } from '../db.js';

// How a movement after the count reads on its line ("[n] sold during the count").
const KIND = { sale: 'sold', till_sale: 'sold', return: 'returned', po_receipt: 'booked in', intake: 'booked in', adjustment: 'adjusted' };

const label = (t) => (t.kind === 'whole_shop' ? 'Whole shop' : t.kind === 'below_zero' ? 'Below zero' : t.target);
export { label as takeLabel };

// The products this count covers that nobody has counted (Count them as
// none). An area count covers only what was scanned (decision 5's "only
// what's scanned in this area is compared"), so it has none.
export async function notCountedOf(take) {
  if (take.kind === 'area') return null;
  const scope = take.kind === 'whole_shop' ? 'p.active = 1'
    : take.kind === 'category' ? 'p.active = 1 AND p.category = ?'
      : 'p.id = ANY(?)';
  const args = take.kind === 'category' ? [take.target] : take.kind === 'below_zero' ? [take.product_ids] : [];
  return prepare(
    `SELECT p.id, p.name, p.sku, p.stock_qty FROM products p WHERE ${scope}
       AND NOT EXISTS (SELECT 1 FROM stock_take_counts c WHERE c.stock_take_id = ? AND c.product_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM stock_take_recounts r WHERE r.stock_take_id = ? AND r.product_id = p.id)
     ORDER BY p.name, p.id`
  ).all(...args, take.id, take.id);
}

// Every counted product, in product-id order, with what it was expected,
// counted and differs by, its value at cost in pence, who counted what, and
// what moved after its last count.
export async function differencesOf(take) {
  const counted = await prepare(
    `SELECT c.product_id, SUM(c.qty)::int AS counted, p.name, p.sku, p.stock_qty, ROUND(p.cost * 100)::int AS cost_pence
       FROM stock_take_counts c JOIN products p ON p.id = c.product_id
      WHERE c.stock_take_id = ? GROUP BY c.product_id, p.name, p.sku, p.stock_qty, p.cost ORDER BY c.product_id`
  ).all(take.id);
  if (counted.length === 0) return [];
  const moved = await prepare(
    `SELECT m.product_id, m.type, SUM(m.change_qty)::int AS change FROM stock_movements m
       JOIN (SELECT product_id, MAX(last_counted_at) AS last_at FROM stock_take_counts WHERE stock_take_id = ? GROUP BY product_id) l
         ON l.product_id = m.product_id
      WHERE m.created_at > l.last_at GROUP BY m.product_id, m.type ORDER BY m.product_id, m.type`
  ).all(take.id);
  const by = await prepare(
    `SELECT c.product_id, l.name, c.qty FROM stock_take_counts c JOIN logins l ON l.id = c.login_id
      WHERE c.stock_take_id = ? ORDER BY c.first_counted_at, c.id`
  ).all(take.id);
  return counted.map((r) => {
    const after = moved.filter((m) => m.product_id === r.product_id);
    const expected = r.stock_qty - after.reduce((n, m) => n + m.change, 0);
    const difference = r.counted - expected;
    // What moved after the count, by kind; a count applied and undone nets to nothing.
    const kinds = new Map();
    for (const m of after) {
      const kind = KIND[m.type];
      if (kind) kinds.set(kind, (kinds.get(kind) ?? 0) + m.change);
    }
    return {
      productId: r.product_id,
      name: r.name,
      sku: r.sku,
      expected,
      counted: r.counted,
      difference,
      costPence: r.cost_pence,
      valuePence: difference * r.cost_pence,
      byCounter: by.filter((b) => b.product_id === r.product_id).map((b) => ({ name: b.name, qty: b.qty })),
      allowedFor: [...kinds].filter(([, change]) => change !== 0).map(([kind, change]) => ({ kind, change })),
    };
  });
}

// Lines asked to be recounted that nobody has counted again since.
export function recountsAskedOf(take) {
  return prepare(
    `SELECT r.product_id, p.name, p.sku, l.name AS asked_by FROM stock_take_recounts r
       JOIN products p ON p.id = r.product_id JOIN logins l ON l.id = r.asked_by_login_id
      WHERE r.stock_take_id = ? AND NOT EXISTS (SELECT 1 FROM stock_take_counts c WHERE c.stock_take_id = r.stock_take_id AND c.product_id = r.product_id)
      ORDER BY p.name, p.id`
  ).all(take.id);
}

// The count as checked: live while counting, as applied once applied.
export async function checkOf(take) {
  let rows;
  if (take.status === 'applied') {
    rows = (await prepare(
      `SELECT r.*, p.name, p.sku FROM stock_take_results r JOIN products p ON p.id = r.product_id WHERE r.stock_take_id = ? ORDER BY r.product_id`
    ).all(take.id)).map((r) => ({
      productId: r.product_id, name: r.name, sku: r.sku, expected: r.expected, counted: r.counted, difference: r.difference,
      costPence: r.cost_pence, valuePence: r.difference * r.cost_pence, byCounter: [], allowedFor: [],
    }));
  } else {
    rows = await differencesOf(take);
  }
  const differ = rows.filter((r) => r.difference !== 0);
  const notCounted = take.status === 'applied' ? null : await notCountedOf(take);
  return {
    productsCounted: rows.length,
    productsMatching: rows.length - differ.length,
    productsDiffering: differ.length,
    valuePence: differ.reduce((n, r) => n + r.valuePence, 0),
    // Largest value first, either way (drawn: "Differences, largest value first").
    rows: differ.sort((a, b) => Math.abs(b.valuePence) - Math.abs(a.valuePence) || Math.abs(b.difference) - Math.abs(a.difference) || a.productId - b.productId),
    all: rows,
    recountAsked: take.status === 'applied' ? [] : (await recountsAskedOf(take)).map((r) => ({ productId: r.product_id, name: r.name, sku: r.sku, askedBy: r.asked_by })),
    notCounted: notCounted && {
      products: notCounted.length,
      expected: notCounted.reduce((n, p) => n + p.stock_qty, 0),
      list: notCounted.slice(0, 200).map((p) => ({ productId: p.id, name: p.name, sku: p.sku })),
    },
  };
}
