// Bikes and their frame numbers (openspec/changes/frame-numbers, design 1 and 2; receiving
// decision 5). Which products are bikes: those in a category marked "Bikes" or "E-bikes" in
// Settings › Stockroom › Categories, or sitting inside one, unless marked itself (Jack's 9 Nov
// answer to finish-customers' bike question, his option 3; migration 127 marked every category
// the old name rule matched). One place, so the receive screen asks by the rule booking in checks.
import { prepare } from '../db.js';

/**
 * The business's bike categories: each category's path to 'bikes' or 'ebikes', its own mark or
 * the nearest one above it. Read once a request and handed to isBike and bikeKindOf.
 */
export async function bikeKinds() {
  const rows = await prepare('SELECT id, parent_id, path, bike_kind FROM product_categories').all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const kinds = new Map();
  for (const row of rows) {
    let at = row;
    // A tree, but a loop in old data mustn't hang a request.
    for (let up = 0; at && !at.bike_kind && up < 100; up += 1) at = at.parent_id === null ? null : byId.get(at.parent_id);
    if (at?.bike_kind) kinds.set(row.path, at.bike_kind);
  }
  return kinds;
}
// A product's category (its whole path, as products.category holds it) to 'bikes', 'ebikes' or null.
export const bikeKindOf = (category, kinds) => kinds.get(String(category ?? '').trim()) ?? null;
export const isBike = (category, kinds) => bikeKindOf(category, kinds) !== null;

// What's compared: capitals, no spaces, so " wtu 123 " and "WTU123" are one frame.
export const frameKey = (number) => String(number ?? '').replace(/\s+/g, '').toUpperCase();
export const MAX_FRAME = 60;

// The frames with these numbers in stock (or held) in this business, in one query.
export function framesInStock(numbers) {
  return prepare(
    `SELECT f.frame_number, f.received_at, p.name AS product_name,
            to_char(f.received_at AT TIME ZONE COALESCE((SELECT time_zone FROM workshop_settings LIMIT 1), 'Europe/London'), 'FMDD Mon YYYY') AS booked_in
       FROM stock_frames f JOIN products p ON p.id = f.product_id
      WHERE f.frame_key = ANY(?::text[]) AND f.state <> 'sold' ORDER BY f.id`
  ).all(numbers.map(frameKey));
}
// The frame with this number in stock (or held) in this business, or null.
export const frameInStock = async (number) => (await framesInStock([number]))[0] ?? null;
export const alreadyInStock = (found) => `Frame ${found.frame_number} is already in stock — booked in ${found.booked_in}`;
