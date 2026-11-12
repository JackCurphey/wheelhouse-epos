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

/** Settings' Showing products: each category's switch, and how many products differ. */
export async function showingProducts() {
  const categories = (await prepare('SELECT id, path, show_online FROM product_categories').all())
    .sort(byPath)
    .map((c) => ({ id: c.id, path: c.path, showOnline: c.show_online }));
  return { categories, setDifferently: (await setDifferentlyIds()).size };
}

/** What a new product in this category starts as. No category: off, as products always started. */
export async function categoryShowsOnline(path) {
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
