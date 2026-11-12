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

/**
 * A new category's "show on website" switch, for its INSERT, with the parent's id as its
 * one parameter (website-buy-online, Showing products): as the category above it; a
 * top-level one on only if any of the shop's categories is on, so a shop that chose
 * "Nothing online" ("Add categories and products as you go") isn't put online by a new
 * category; on when the shop has no categories yet, as migration 154 starts them.
 */
export const NEW_CATEGORY_SHOWS = `COALESCE((SELECT show_online FROM product_categories WHERE id = ?),
  (SELECT bool_or(show_online) FROM product_categories), true)`;

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
         VALUES (?, ?, ?, ${NEW_CATEGORY_SHOWS})
         ON CONFLICT (shop_id, path) DO NOTHING RETURNING id`
      ).get(parent, parts[i - 1], here, parent) ?? await find();
    }
    parent = found.id;
  }
  return path;
}
