// Bringing a file's rows across in the background, a batch at a time, so the
// owner can leave the page (mv-progress; openspec/changes/citrus-import-products,
// design 5 to 11). A row and what it wrote commit together, so a restart picks
// up what's still waiting and nothing comes across twice.
import { pool, prepare, dbExec, runWithShop } from '../db.js';
import { NO_CUSTOMER, bikeRow, customerRow, lockBikeOwners } from './bring-customers.js';

const BATCH = 500;
const BATCHES_A_ROUND = 20;
export const NO_PRODUCT = 'The product isn’t in the products file';
const STOCK_NOTE = 'Brought across from Citrus Lime';
const MAX_MONEY = 99_999_999.99; // NUMERIC(10,2)
const MAX_QTY = 100_000; // as an adjustment's limit

// A number from a cell: Excel's own, or typed with a £ and commas. Null if it's neither.
function numberOf(text) {
  const n = Number(String(text).replace(/[£,\s]/g, ''));
  return String(text).trim() !== '' && Number.isFinite(n) ? n : null;
}
const moneyOf = (text) => {
  const n = numberOf(text);
  return n === null || n < 0 || n > MAX_MONEY ? null : Math.round(n * 100) / 100;
};
const wholeOf = (text) => {
  const n = numberOf(text);
  return n === null || !Number.isInteger(n) || Math.abs(n) > MAX_QTY ? null : n;
};
// 20, "20%" or Excel's 0.2, in hundredths of a percent, for the three UK rates.
function vatOf(text) {
  const n = numberOf(String(text).replace('%', ''));
  if (n === null) return null;
  const percent = n > 0 && n < 1 ? Math.round(n * 10000) / 100 : n;
  return [0, 5, 20].includes(percent) ? percent * 100 : null;
}
const look = (why) => ({ state: 'look', why });

// Design 7 to 10. Everything is read and checked before anything is written.
async function priceListRow(d, file) {
  if (file.store_name && d.Store && d.Store !== file.store_name) return look(`Stock at ${d.Store}: one shop’s stock comes across for now`);
  const sku = d['Item Lookup Code'];
  if (!sku) return look('No product code');
  if (!d.Description) return look('No description');
  if (d.Price === undefined) return look('No price');
  const price = moneyOf(d.Price);
  if (price === null) return look('The price isn’t a number Wheelhouse can use');
  const cost = d['Store Cost'] === undefined ? 0 : moneyOf(d['Store Cost']);
  if (cost === null) return look('The cost isn’t a number Wheelhouse can use');
  const vat = d['Tax Rate'] === undefined ? 2000 : vatOf(d['Tax Rate']);
  if (vat === null) return look('The VAT rate isn’t 0, 5 or 20%');
  const qty = wholeOf(d['Qty On Hand'] ?? '0');
  if (qty === null) return look('The stock isn’t a whole number');
  const min = d['Min (Reorder Point)'] === undefined ? 3 : wholeOf(d['Min (Reorder Point)']);
  if (min === null || min < 0) return look('The reorder level isn’t a whole number');

  const category = [d.Department, d.Category].filter(Boolean).join(' › ') || 'Uncategorised';
  const active = /^(no|false|0)$/i.test(d.Active ?? '') ? 0 : 1;
  // Never overwrites (design 9): a code already here stays as it is.
  const made = await prepare(
    `INSERT INTO products (sku, name, category, price, cost, vat_rate_bp, stock_qty, low_stock_threshold, supplier, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
     ON CONFLICT (shop_id, sku) WHERE sku IS NOT NULL DO NOTHING RETURNING id`
  ).get(sku, d.Description, category, price, cost, vat, qty, min, d.Supplier ?? '', active);
  if (!made) return { state: 'in' };
  if (qty !== 0) {
    await prepare(`INSERT INTO stock_movements (product_id, change_qty, type, note, login_id) VALUES (?, ?, 'intake', ?, ?)`).run(made.id, qty, STOCK_NOTE, file.sent_by_login_id);
    return { state: 'in', stock: 1 };
  }
  return { state: 'in' };
}

// Design 11.
async function barcodeRow(d) {
  if (!d.Alias) return look('No barcode');
  const product = await prepare('SELECT id, barcode FROM products WHERE sku = ?').get(d.ILC ?? '');
  if (!product) return look(NO_PRODUCT);
  if (product.barcode === d.Alias) return { state: 'in' };
  if (product.barcode) return look('This product already has a different barcode');
  const taken = await prepare('SELECT id FROM products WHERE barcode = ?').get(d.Alias);
  if (taken) return look('Another product has this barcode');
  await prepare('UPDATE products SET barcode = ?, updated_at = now() WHERE id = ?').run(d.Alias, product.id);
  return { state: 'in' };
}

const ROW_APPLIERS = { price_list: priceListRow, barcodes: barcodeRow, customers: customerRow, bikes: bikeRow };
// Those that wait for another file: when it finishes, they try again.
const WAITS_FOR = { price_list: ['barcodes', NO_PRODUCT], customers: ['bikes', NO_CUSTOMER] };

// A price list finishing lets barcodes that found no product try again, and
// customers finishing lets bikes that found no customer.
async function retryAfter(file) {
  const waiting = WAITS_FOR[file.report];
  if (!waiting) return;
  const again = await prepare(
    `UPDATE move_rows r SET state = 'waiting', why = NULL FROM move_files f
      WHERE r.file_id = f.id AND f.report = ? AND r.state = 'look' AND r.why = ? RETURNING r.file_id`
  ).all(waiting[0], waiting[1]);
  const perFile = new Map();
  for (const { file_id: id } of again) perFile.set(id, (perFile.get(id) ?? 0) + 1);
  for (const [id, count] of [...perFile].sort(([a], [b]) => a - b)) {
    await prepare(`UPDATE move_files SET state = 'bringing', rows_look = rows_look - ?, finished_at = NULL WHERE id = ?`).run(count, id);
  }
}

/**
 * One batch for the current shop, inside its runWithShop. Returns whether there
 * was anything to do. `beforeRow` and `afterRows` are for a test failing it part-way.
 */
export async function bringBatch({ beforeRow = () => {}, afterRows = () => {} } = {}) {
  const file = await prepare(
    `SELECT * FROM move_files WHERE state = 'bringing' ORDER BY array_position(ARRAY['price_list', 'customers', 'barcodes', 'bikes'], report), id LIMIT 1`
  ).get();
  if (!file) return false;
  await dbExec('BEGIN');
  try {
    const locked = await prepare('SELECT id FROM move_files WHERE id = ? FOR UPDATE').get(file.id);
    const rows = await prepare(
      `SELECT id, data FROM move_rows WHERE file_id = ? AND state = 'waiting' ORDER BY id LIMIT ? FOR UPDATE SKIP LOCKED`
    ).all(locked.id, BATCH);
    if (rows.length === 0) {
      await prepare(`UPDATE move_files SET state = 'done', finished_at = now() WHERE id = ?`).run(file.id);
      await retryAfter(file);
      await dbExec('COMMIT');
      return true;
    }
    if (file.report === 'barcodes') {
      // The order sales lock products in (design 11).
      const codes = rows.map((r) => r.data.ILC).filter(Boolean);
      await prepare('SELECT id FROM products WHERE sku = ANY(?) ORDER BY id FOR UPDATE').all(codes);
    }
    if (file.report === 'bikes') await lockBikeOwners(rows);
    let rowsIn = 0;
    let rowsLook = 0;
    let stockIn = 0;
    for (const row of rows) {
      let done;
      await dbExec('BEGIN');
      try {
        await beforeRow(row);
        done = await ROW_APPLIERS[file.report](row.data, file);
        await dbExec('COMMIT');
      } catch (err) {
        await dbExec('ROLLBACK');
        // Design 6: one odd row can't stop a file.
        console.error(`Move: row ${row.id} couldn't come across`, err.code ?? err.message);
        done = look('Wheelhouse couldn’t bring this row across');
      }
      if (done.state === 'in') {
        rowsIn += 1;
        stockIn += done.stock ?? 0;
        await prepare(`UPDATE move_rows SET state = 'in', why = NULL, data = '{}' WHERE id = ?`).run(row.id);
      } else {
        rowsLook += 1;
        await prepare(`UPDATE move_rows SET state = 'look', why = ? WHERE id = ?`).run(done.why, row.id);
      }
    }
    await prepare('UPDATE move_files SET rows_in = rows_in + ?, rows_look = rows_look + ?, stock_in = stock_in + ? WHERE id = ?').run(rowsIn, rowsLook, stockIn, file.id);
    await afterRows();
    await dbExec('COMMIT');
    return true;
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}

/**
 * One run of the timer: each shop, a few batches, each with its own connection.
 * Returns whether any shop may have more to do.
 */
export async function bringAcrossRound(stopping = () => false) {
  let more = false;
  const { rows: shops } = await pool.query('SELECT id FROM shops');
  for (const { id: shopId } of shops) {
    try {
      for (let i = 0; i < BATCHES_A_ROUND; i += 1) {
        if (stopping()) return true;
        if (!(await runWithShop(shopId, () => bringBatch()))) break;
        if (i === BATCHES_A_ROUND - 1) more = true;
      }
    } catch (err) {
      more = true;
      console.error(`Move: bringing across failed for shop ${shopId} this round`, err);
    }
  }
  return more;
}

// Nothing is looked for until there's a reason: once at the start, for anything
// a restart left waiting, and after a file is sent (design 5). A quiet server
// doesn't open a connection per shop every few seconds.
let wanted = true;
export function wakeBringingAcross() { wanted = true; }

/** Starts the timer; returns stop(), which waits for a round in flight. As the messages sender. */
export function startBringingAcross(intervalMs = Number(process.env.WH_MOVE_TICK_MS ?? 2000)) {
  let round = null;
  let stopped = false;
  const timer = setInterval(() => {
    if (round || !wanted) return;
    wanted = false;
    round = bringAcrossRound(() => stopped)
      .then((more) => { if (more) wanted = true; })
      .catch((err) => { wanted = true; console.error('Move: bringing across failed this round', err); })
      .finally(() => { round = null; });
  }, intervalMs);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
    return round ?? Promise.resolve();
  };
}
