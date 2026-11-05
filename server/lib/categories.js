// The category tree (openspec/changes/category-tree; stock control decision 10). A
// product's text category is always a category's whole path, "Drivetrain › Derailleurs",
// so every old reader keeps working and the text is the link. Migration 119 tidies text
// the same way.
import { prepare } from '../db.js';

export const NONE = 'Uncategorised';
export const JOIN = ' › ';

// Split on "›", each part trimmed, empty parts dropped. Nothing left is Uncategorised,
// which isn't a category. Letters keep their case, as the shop wrote them.
export function partsOf(text) {
  return String(text ?? '').split('›').map((p) => p.trim()).filter(Boolean);
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
      found = await prepare(
        'INSERT INTO product_categories (parent_id, name, path) VALUES (?, ?, ?) ON CONFLICT (shop_id, path) DO NOTHING RETURNING id'
      ).get(parent, parts[i - 1], here) ?? await find();
    }
    parent = found.id;
  }
  return path;
}
