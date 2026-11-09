// A customer's bike bought here and its warranty (openspec/changes/finish-customers, design 6;
// Jack, 9 Nov, answers 3 and 4; questions 15 and 19). Each line's end is worked out and written
// when the bike becomes bought here (sold, or "Bought here on" saved in Edit) and never again
// when a brand's or model's lines change, so a sold bike keeps the warranty it was sold with.
import { prepare } from '../db.js';
import { bikeKindOf, bikeKinds, frameKey } from './bikes.js';
import { PARTS, brandKey } from './warranties.js';

// A date years on, as YYYY-MM-DD; 29 Feb in a year without one is the 28th.
export function yearsOn(day, years) {
  const [y, m, d] = day.split('-').map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${String(y + years).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

// Whole calendar months from today to a day, rounded down.
export function monthsTo(today, day) {
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = day.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

// The lines a bike bought here gets: its model's own if it has any (question 17), else its
// brand's from the list; Electronics only for an e-bike. [{ part, years }].
async function linesFor({ brand, productId, isEbike }) {
  let rows = productId ? await prepare('SELECT part, years FROM warranty_lines WHERE product_id = ?').all(productId) : [];
  if (rows.length === 0 && brand) {
    rows = await prepare(
      'SELECT l.part, l.years FROM warranty_lines l JOIN bike_brand_warranties b ON b.id = l.brand_warranty_id WHERE b.brand_key = ?'
    ).all(brandKey(brand));
  }
  return rows.filter((l) => isEbike || l.part !== 'electronics');
}

// Writes a bike's lines again from what it is now; none unless bought here. In the caller's transaction.
export async function writeBikeLines(bikeId) {
  const bike = await prepare(
    "SELECT to_char(bought_here_on, 'YYYY-MM-DD') AS bought, is_ebike, warranty_brand, warranty_product_id FROM customer_bikes WHERE id = ?"
  ).get(bikeId);
  await prepare('DELETE FROM bike_warranty_lines WHERE customer_bike_id = ?').run(bikeId);
  if (!bike?.bought) return;
  for (const l of await linesFor({ brand: bike.warranty_brand, productId: bike.warranty_product_id, isEbike: bike.is_ebike })) {
    await prepare('INSERT INTO bike_warranty_lines (customer_bike_id, part, ends_on) VALUES (?, ?, ?)')
      .run(bikeId, l.part, l.years === null ? null : yearsOn(bike.bought, l.years));
  }
}

// A frame booked in, sold to a customer: their bike with that frame number (capitals and spaces
// ignored) or a new one from the product, the frame marked sold to them, and the bike's lines.
// { bikeId } or { error }. In the caller's transaction. Not called from any sale in this change:
// the till picking which frame it sells is the till's half (Jack, 9 Nov, answer 1).
export async function bikeSoldTo(customerId, stockFrameId, soldOn) {
  const frame = await prepare(
    `SELECT f.id, f.frame_number, f.frame_key, f.state, p.id AS product_id, p.name, p.brand, p.category
       FROM stock_frames f JOIN products p ON p.id = f.product_id WHERE f.id = ? FOR UPDATE OF f`
  ).get(stockFrameId);
  if (!frame) return { error: 'Frame not found' };
  if (frame.state === 'sold') return { error: `Frame ${frame.frame_number} is already sold` };
  const isEbike = bikeKindOf(frame.category, await bikeKinds()) === 'ebikes';
  const bikes = await prepare('SELECT id, serial_number FROM customer_bikes WHERE customer_id = ? AND active = 1 ORDER BY id FOR UPDATE').all(customerId);
  let bikeId = bikes.find((b) => frameKey(b.serial_number) === frame.frame_key)?.id;
  if (bikeId) {
    await prepare('UPDATE customer_bikes SET bought_here_on = ?, is_ebike = ?, warranty_brand = ?, warranty_product_id = ?, updated_at = now() WHERE id = ?')
      .run(soldOn, isEbike, frame.brand, frame.product_id, bikeId);
  } else {
    bikeId = (await prepare(
      `INSERT INTO customer_bikes (customer_id, make, model, serial_number, bought_here_on, is_ebike, warranty_brand, warranty_product_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, now()) RETURNING id`
    ).get(customerId, frame.brand ?? '', frame.name, frame.frame_number, soldOn, isEbike, frame.brand, frame.product_id)).id;
  }
  await prepare("UPDATE stock_frames SET state = 'sold', sold_at = now(), customer_id = ?, customer_bike_id = ? WHERE id = ?").run(customerId, bikeId, frame.id);
  await writeBikeLines(bikeId);
  return { bikeId };
}

// Each bike's warranty for its answer, by id: null unless bought here (question 19).
export async function warrantiesOf(bikes, today) {
  const bought = bikes.filter((b) => b.bought_here_on);
  if (bought.length === 0) return new Map(bikes.map((b) => [b.id, null]));
  const lines = await prepare(
    "SELECT customer_bike_id, part, to_char(ends_on, 'YYYY-MM-DD') AS ends_on FROM bike_warranty_lines WHERE customer_bike_id = ANY(?::int[])"
  ).all(bought.map((b) => b.id));
  const listed = new Map((await prepare('SELECT brand_key, brand FROM bike_brand_warranties').all()).map((b) => [b.brand_key, b.brand]));
  return new Map(bikes.map((b) => {
    if (!b.bought_here_on) return [b.id, null];
    const own = lines.filter((l) => l.customer_bike_id === b.id)
      .sort((x, y) => PARTS.indexOf(x.part) - PARTS.indexOf(y.part))
      .map((l) => {
        const ended = l.ends_on !== null && l.ends_on < today;
        return { part: l.part, endsOn: l.ends_on, monthsLeft: l.ends_on === null || ended ? null : monthsTo(today, l.ends_on), ended };
      });
    const running = own.some((l) => !l.ended);
    return [b.id, {
      boughtHereOn: dayOf(b.bought_here_on),
      brand: b.warranty_brand ? listed.get(brandKey(b.warranty_brand)) ?? null : null,
      running,
      endedOn: own.length && !running ? own.map((l) => l.endsOn).sort().at(-1) : null,
      lines: own,
    }];
  }));
}

// A DATE column read back as a Date at local midnight (node-postgres) or a string, as YYYY-MM-DD.
export const dayOf = (v) => (v instanceof Date
  ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  : String(v).slice(0, 10));

// Bikes as answered, each with its warranty (customers.js and portal.js share it).
export async function bikesWithWarranty(rows, today, serialize) {
  const warranties = await warrantiesOf(rows, today);
  return rows.map((r) => ({ ...serialize(r), warranty: warranties.get(r.id) }));
}
