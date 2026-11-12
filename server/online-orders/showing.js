// Showing products on the website: a switch on each category, which sets every
// product in it, and each product's own switch, which can differ from its
// category; new products follow their category (Buy online decision 3;
// openspec/changes/website-buy-online design, decided while planning 15;
// drawing on-settings-show). A category's products are those whose text
// category is its path or a path under it ("Drivetrain › Derailleurs" is in
// Drivetrain), as server/lib/categories.js links them.
import { dbExec, prepare } from '../db.js';
import { JOIN, partsOf } from '../lib/categories.js';

// The column is the path, or starts with the path and " › ".
const inOrUnder = (column) => `(${column} = ? OR left(${column}, char_length(?::text) + ${JOIN.length}) = ?::text || '${JOIN}')`;
const under = (path) => [path, path, path];

// In the order of their paths, each part compared as the shop's words.
const byPath = (a, b) => {
  const x = partsOf(a.path);
  const y = partsOf(b.path);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const c = x[i].localeCompare(y[i], 'en-GB', { sensitivity: 'base' });
    if (c) return c;
  }
  return x.length - y.length;
};

/**
 * The products set differently from their category: on sale, with a category,
 * and switched the other way. One with no price that is off isn't counted: it
 * stays off until priced (the website set-up's rule, server/website.js).
 */
export async function setDifferentlyIds() {
  const rows = await prepare(
    `SELECT p.id FROM products p JOIN product_categories c ON c.path = p.category
      WHERE p.active = 1 AND p.show_online <> c.show_online AND (p.show_online OR p.price > 0)`
  ).all();
  return new Set(rows.map((r) => r.id));
}

/** The shop's website: Wheelhouse's and set up, Shopify's, or neither (not set up yet). */
export async function websiteKind() {
  const row = await prepare('SELECT kind, set_up_at FROM website').get();
  if (!row?.kind || !row.set_up_at) return null;
  return row.kind;
}

/**
 * Settings' Showing products: each category's switch, and how many products
 * differ. The count only once a Wheelhouse website is set up: before that,
 * every priced product would count. `shopify`: the fold isn't shown, as
 * Shopify's shop is sent what Stock says.
 */
export async function showingProducts() {
  const kind = await websiteKind();
  const categories = (await prepare('SELECT id, path, show_online FROM product_categories').all())
    .sort(byPath)
    .map((c) => ({ id: c.id, path: c.path, showOnline: c.show_online }));
  return { categories, setDifferently: kind === 'wheelhouse' ? (await setDifferentlyIds()).size : null, shopify: kind === 'shopify' };
}

/**
 * What a new product in this category starts as: its category's switch, but
 * only on a Wheelhouse website that has been set up. Otherwise off, as products
 * always started, so nothing reaches a Shopify shop (its product sync and Send
 * read this switch) or a website not set up, unasked. No category: off.
 */
export async function categoryShowsOnline(path) {
  if ((await websiteKind()) !== 'wheelhouse') return false;
  const row = await prepare('SELECT show_online FROM product_categories WHERE path = ?').get(path);
  return row ? row.show_online : false;
}

/**
 * A category's switch: it, the categories under it, and every product in them.
 * False when the category isn't the shop's.
 */
export async function setCategoryShowing(id, on) {
  await dbExec('BEGIN');
  try {
    const category = await prepare('SELECT id, path FROM product_categories WHERE id = ? FOR UPDATE').get(id);
    if (!category) {
      await dbExec('ROLLBACK');
      return false;
    }
    await prepare(`UPDATE product_categories SET show_online = ? WHERE ${inOrUnder('path')}`).run(on, ...under(category.path));
    await prepare(`UPDATE products SET show_online = ? WHERE show_online <> ? AND ${inOrUnder('category')}`).run(on, on, ...under(category.path));
    await dbExec('COMMIT');
    return true;
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
}

/**
 * The website set-up's step 3, in the caller's transaction: every product
 * online (on sale with a price; one with no price stays off until priced), or
 * nothing online. Every category is switched the same way, so new products
 * follow the answer.
 */
export async function startWith(every) {
  await prepare('UPDATE product_categories SET show_online = ?').run(every);
  await prepare('UPDATE products SET show_online = (? AND price > 0 AND active = 1)').run(every);
}
