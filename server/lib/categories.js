// The category tree (openspec/changes/category-tree; stock control decision 10). A
// product's text category is always a category's whole path, "Drivetrain › Derailleurs",
// so every old reader keeps working and the text is the link. Migration 119 tidies text
// the same way.
import { prepare } from '../db.js';

export const NONE = 'Uncategorised';
export const JOIN = ' › ';

// Split on "›", each part trimmed of every kind of space trim() knows, empty parts and
// "Uncategorised" in any case dropped: it isn't a category, so "Uncategorised › Tyres" is
// Tyres. Nothing left is Uncategorised. Letters keep their case, as the shop wrote them.
// Migration 119 does exactly this in SQL; tests/migration-119.test.js holds the two alike.
export const isNone = (part) => part.toLowerCase() === NONE.toLowerCase();
export function partsOf(text) {
  return String(text ?? '').split('›').map((p) => p.trim()).filter((p) => p && !isNone(p));
}
export function tidyCategory(text) {
  const parts = partsOf(text);
  return parts.length === 0 ? NONE : parts.join(JOIN);
}

// A new category shows on the website as the one it's inside does; a new top-level
// one shows unless the website started with nothing online (openspec/changes/
// website-buy-online, Showing products: new products follow their category).
// Takes the parent's id as its one parameter; Stock › Categories uses it too.
// The parent is read FOR SHARE, so a switch on it at the same moment finishes
// first (and this follows it) or waits until this is saved.
export const SHOWS_LIKE_PARENT = `COALESCE(
  (SELECT show_online FROM product_categories WHERE id = ? FOR SHARE),
  (SELECT started_with IS DISTINCT FROM 'nothing' FROM website),
  true)`;

/**
 * The tidied path, with every category in it found or made, in the caller's transaction
 * and under its lock limit. Each one found is held against renaming (KEY SHARE), so a
 * rename at the same moment either finishes first, and this makes the old path afresh,
 * or waits for this. Two making the same at once: the second finds the first's.
 */
export async function categoryFor(text) {
  const path = tidyCategory(text);
  if (path === NONE) return path;
  const parts = partsOf(path);
  let parent = null;
  for (let i = 1; i <= parts.length; i += 1) {
    const here = parts.slice(0, i).join(JOIN);
    const find = () => prepare('SELECT id FROM product_categories WHERE path = ? FOR KEY SHARE').get(here);
    let found = await find();
    if (!found) {
      found = await prepare(
        `INSERT INTO product_categories (parent_id, name, path, show_online)
         VALUES (?, ?, ?, ${SHOWS_LIKE_PARENT}) ON CONFLICT (shop_id, path) DO NOTHING RETURNING id`
      ).get(parent, parts[i - 1], here, parent) ?? await find();
    }
    parent = found.id;
  }
  return path;
}

// True while the shop is still on the old Shopify connection (server/shopify.js),
// whose products are sent to Shopify one at a time from their own page in Stock.
export const OLD_SHOPIFY = "EXISTS (SELECT 1 FROM shopify_connections WHERE status <> 'not_connected')";

// A new product with no switch of its own follows its category, on Wheelhouse's
// own website once set up with a start answer. Otherwise (no website yet, a
// Shopify website or the old Shopify connection, or one set up before the answer
// was kept), and with no category (Uncategorised), it stays off until switched
// on, as before. The category is read FOR SHARE, so a switch on it at the same
// moment finishes first (and this follows it) or waits until this is saved.
export async function categoryShows(path) {
  const row = await prepare(
    `SELECT c.show_online AND w.kind = 'wheelhouse' AND w.started_with IS NOT NULL AND NOT ${OLD_SHOPIFY} AS shows
     FROM product_categories c CROSS JOIN website w WHERE c.path = ? FOR SHARE OF c`
  ).get(path);
  return row?.shows === true;
}
