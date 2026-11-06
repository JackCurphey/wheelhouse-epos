// A product's details (openspec/changes/product-editing; stock control decision 10): the
// details of its category and of every category above it, read up the tree, and its answer
// to each. A number answer is kept as written and as value_key, ten-thousandths in a whole
// number, which is what searching compares (migration 121).
import { prepare } from '../db.js';
import { JOIN, NONE, partsOf } from './categories.js';

// Its category and those above it, top first: each a prefix of its path.
export async function chainOf(categoryPath) {
  if (!categoryPath || categoryPath === NONE) return [];
  const parts = partsOf(categoryPath);
  const paths = parts.map((_, i) => parts.slice(0, i + 1).join(JOIN));
  const rows = await prepare('SELECT id, name, path FROM product_categories WHERE path = ANY(?::text[])').all(paths);
  return paths.map((path) => rows.find((r) => r.path === path)).filter(Boolean);
}

// Each detail it has, top of the tree first, with its answer (null for none).
export async function detailsOf(product) {
  const chain = await chainOf(product.category);
  if (chain.length === 0) return [];
  const details = await prepare(
    `SELECT d.id, d.category_id, d.name, d.kind, d.unit, d.choices, a.value_number, a.value_text
       FROM category_details d LEFT JOIN product_details a ON a.detail_id = d.id AND a.product_id = ?
      WHERE d.category_id = ANY(?::int[]) ORDER BY d.position, d.id`
  ).all(product.id, chain.map((c) => c.id));
  return chain.flatMap((c) => details.filter((d) => d.category_id === c.id).map((d) => ({
    id: d.id, name: d.name, kind: d.kind, unit: d.unit, choices: d.choices, from: c.name,
    value: d.kind === 'number' ? (d.value_number === null ? null : Number(d.value_number)) : d.value_text,
  })));
}

// "30", 30, "9.5": up to nine whole digits and four places. Anything else isn't a number here.
export const NUMBER = /^-?\d{1,9}(\.\d{1,4})?$/;
export function numberOf(value) {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  return NUMBER.test(text) ? text : null;
}

/**
 * Check each answer against the product's details, in the caller's transaction, then save.
 * `answers`: [{ detailId, value }]; an empty value takes the answer off. Returns a refusal's
 * words, or null once saved.
 */
export async function saveAnswers(product, answers) {
  const details = await detailsOf(product);
  const checked = [];
  for (const a of answers) {
    const detail = details.find((x) => x.id === a?.detailId);
    if (!detail) return 'That isn’t one of this product’s details';
    const blank = a.value === null || a.value === undefined || (typeof a.value === 'string' && !a.value.trim());
    if (blank) { checked.push({ detail, gone: true }); continue; }
    if (detail.kind === 'number') {
      const n = numberOf(a.value);
      if (n === null) return `${detail.name} takes a number, up to four decimal places`;
      checked.push({ detail, number: n });
    } else if (detail.kind === 'choice') {
      const choice = typeof a.value === 'string' ? detail.choices.find((c) => c.toLocaleLowerCase('en-GB') === a.value.trim().toLocaleLowerCase('en-GB')) : null;
      if (!choice) return `${detail.name} is one of ${detail.choices.join(', ')}`;
      checked.push({ detail, text: choice });
    } else {
      const text = typeof a.value === 'string' ? a.value.trim() : '';
      if (!text || text.length > 200) return `${detail.name} is text, up to 200 characters`;
      checked.push({ detail, text });
    }
  }
  for (const c of checked) {
    if (c.gone) {
      await prepare('DELETE FROM product_details WHERE product_id = ? AND detail_id = ?').run(product.id, c.detail.id);
      continue;
    }
    await prepare(
      `INSERT INTO product_details (product_id, detail_id, value_number, value_key, value_text)
       VALUES (?, ?, ?::numeric, (?::numeric * 10000)::bigint, ?)
       ON CONFLICT (shop_id, detail_id, product_id) DO UPDATE
         SET value_number = EXCLUDED.value_number, value_key = EXCLUDED.value_key, value_text = EXCLUDED.value_text
       RETURNING product_id`
    ).get(product.id, c.detail.id, c.number ?? null, c.number ?? null, c.text ?? null);
  }
  return null;
}
