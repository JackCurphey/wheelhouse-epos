// Settings › Front desk › Online orders › Showing products (openspec/changes/
// website-buy-online, specs/settings "Showing products is switched on each
// category" and "Showing products says how the website started"; design 15; the
// drawing on-settings-show). A switch on each category sets every product in it
// and in the categories inside it; a product can then be set differently on its
// own page in Stock. Change asks set-up step 3's question again, with set-up's
// own rule for products. Every function runs inside the request's shop
// (runWithShop), so row-level security keeps each shop to its own rows.
import { prepare } from './db.js';
import { getOrCreateWebsite, inTransaction, WebsiteError } from './website.js';
import { JOIN } from './lib/categories.js';

export const START_CHOICES = ['every', 'nothing'];

// Set-up step 3's answer, at set-up and from Change: every product online means
// active ones with a price (one with no price stays off until priced); nothing
// online means every product off, inactive ones too. Every category follows, so
// new products follow the answer, and the answer and its date are kept for the
// "Started with" line. Runs inside the caller's transaction, website row locked.
export async function startProducts(startWith) {
  const every = startWith === 'every';
  await prepare('UPDATE products SET show_online = (? AND price > 0 AND active = 1)').run(every);
  await prepare('UPDATE product_categories SET show_online = ?').run(every);
  await prepare('UPDATE website SET started_with = ?, started_with_at = now(), updated_at = now()').run(startWith);
}

// The fold: how the website started, each category's switch (parents before the
// categories inside them, as paths sort), and how many products on sale are set
// differently from their category, for "[n] products are set differently…".
// Priced and active only, as set-up's rule leaves unpriced ones off.
export async function showing() {
  const website = await getOrCreateWebsite();
  const categories = await prepare('SELECT id, path, show_online FROM product_categories ORDER BY path, id').all();
  const { n } = await prepare(
    `SELECT count(*)::int AS n FROM products p JOIN product_categories c ON c.path = p.category
     WHERE p.active = 1 AND p.price > 0 AND p.show_online <> c.show_online`
  ).get();
  return {
    startedWith: website.started_with ?? null,
    startedAt: website.started_with_at ? new Date(website.started_with_at).toISOString() : null,
    categories: categories.map((c) => ({ id: c.id, path: c.path, showOnline: c.show_online })),
    differentCount: n,
  };
}

// One category's switch: it, the categories inside it and every product in any
// of them. Compared by the path's start, not LIKE, so a "%" or "_" in a name
// matches only itself.
export async function setCategoryShown(id, body) {
  if (typeof body?.showOnline !== 'boolean') throw new WebsiteError(400, 'Say whether the category shows on the website');
  const categoryId = Number(id);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) throw new WebsiteError(404, 'There is no such category');
  await inTransaction(async () => {
    const category = await prepare('SELECT path FROM product_categories WHERE id = ? FOR UPDATE').get(categoryId);
    if (!category) throw new WebsiteError(404, 'There is no such category');
    const inside = `${category.path}${JOIN}`;
    const within = '(path = ? OR left(path, length(?)) = ?)';
    await prepare(`UPDATE product_categories SET show_online = ? WHERE ${within}`).run(body.showOnline, category.path, inside, inside);
    await prepare(
      `UPDATE products SET show_online = ?
       WHERE show_online <> ? AND (category = ? OR left(category, length(?)) = ?)`
    ).run(body.showOnline, body.showOnline, category.path, inside, inside);
  });
  return showing();
}

// Change: set-up step 3's question again, once the website is set up.
export async function startAgain(body) {
  if (!START_CHOICES.includes(body?.startWith)) throw new WebsiteError(400, 'Choose every product online, or nothing');
  await getOrCreateWebsite();
  await inTransaction(async () => {
    const website = await prepare('SELECT kind FROM website FOR UPDATE').get();
    if (!website.kind) throw new WebsiteError(409, 'Set up the website first');
    await startProducts(body.startWith);
  });
  return showing();
}
