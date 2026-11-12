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
      // A new category shows on the website as the one above it does (website-buy-online, Showing products).
      found = await prepare(
        `INSERT INTO product_categories (parent_id, name, path, show_online)
         VALUES (?, ?, ?, COALESCE((SELECT show_online FROM product_categories WHERE id = ?), true))
         ON CONFLICT (shop_id, path) DO NOTHING RETURNING id`
      ).get(parent, parts[i - 1], here, parent) ?? await find();
    }
    parent = found.id;
  }
  return path;
}
