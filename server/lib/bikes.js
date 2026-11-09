// Bikes and their frame numbers (openspec/changes/frame-numbers, design 1 and 2; receiving
// decision 5). Which products are bikes isn't drawn: a product whose category, or a category it
// sits in, is named as bikes ("Bikes", "Road bikes", "Bikes › E-bikes"), decided while building
// for Jack to overrule. One place, so the receive screen asks by the rule booking in checks.
import { prepare } from '../db.js';

// Any part of the path ending in the word bike or bikes: "Kids’ bikes" and "E-bikes" are;
// "Bike parts", "Bike lights" and "Bikesheds" aren't.
export function isBike(category) {
  return String(category ?? '').split('›').some((part) => /(^|[\s\-‐’'])bikes?$/i.test(part.trim()));
}

// What's compared: capitals, no spaces, so " wtu 123 " and "WTU123" are one frame.
export const frameKey = (number) => String(number ?? '').replace(/\s+/g, '').toUpperCase();
export const MAX_FRAME = 60;

// The frame with this number in stock (or held) in this business, or null.
export async function frameInStock(number) {
  return (await prepare(
    `SELECT f.frame_number, f.received_at, p.name AS product_name,
            to_char(f.received_at AT TIME ZONE COALESCE((SELECT time_zone FROM workshop_settings LIMIT 1), 'Europe/London'), 'FMDD Mon YYYY') AS booked_in
       FROM stock_frames f JOIN products p ON p.id = f.product_id
      WHERE f.frame_key = ? AND f.state <> 'sold'`
  ).get(frameKey(number))) ?? null;
}
export const alreadyInStock = (found) => `Frame ${found.frame_number} is already in stock — booked in ${found.booked_in}`;
