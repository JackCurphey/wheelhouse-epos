// Bringing a file across in the background, so the owner can leave the page
// (mv-progress; openspec/changes/citrus-import-products, design 5 to 13). A file
// is read off the request, in a worker, then its rows come across a batch at a
// time. A row and what it wrote commit together, so a restart picks up what's
// still waiting and nothing comes across twice.
import { pool, prepare, dbExec, runWithShop } from '../db.js';
import { readInWorker, ReadBusy } from '../lib/read-in-worker.js';
import { priceTooBig } from '../lib/pence.js';
import { categoryFor, tidyCategory } from '../lib/categories.js';
import { moveStock, oldestSite } from '../lib/stock.js';
import { NO_CUSTOMER, bikeRow, customerRow, lockBikeOwners, moveSalt } from './bring-customers.js';

// A batch holds every move file, so it's short: well under the 800ms a deletion waits,
// so a deletion isn't told to try again (citrus-import-fix, design 21). It stops at
// whichever comes first, a time or a number of rows, in lots of a few rows so a slow
// row can't overrun by much, and what it didn't reach waits for the next batch.
export const BATCH_MS = 250;
const BATCH = 100;
const BATCH_LOT = 10;
const BATCHES_A_ROUND = 20;
// A moment between batches, for anyone waiting on the files.
export const BATCH_BREATH_MS = 25;
// Holding the files, a batch never waits long on anything else: a stuck product or
// customer would hold up everything behind the files. It gives up and tries next tick.
const BATCH_LOCK_WAIT = '500ms';
// Rows sent back to waiting in one go when a file finishes.
const RETRY_LOT = 500;
const INSERT_CHUNK = 500;
export const NO_PRODUCT = 'The product isn’t in the products file';
const STOCK_NOTE = 'Brought across from Citrus Lime';
export const ROW_FAILED = 'Wheelhouse couldn’t bring this row across';
const MAX_MONEY = 99_999_999.99; // NUMERIC(10,2)
const MAX_QTY = 100_000; // as an adjustment's limit
// Worth trying again rather than blaming the row: a deadlock, a lock wait, a clash.
export const TRY_AGAIN = new Set(['40P01', '40001', '55P03']);

// A plain number, with commas only where thousands go. Nothing else: not £ or a
// lone comma (Number would read those as 0 once removed), not 12,50, 0x10 or 1e3.
const PLAIN_NUMBER = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
function numberOf(text) {
  const t = String(text).trim();
  return PLAIN_NUMBER.test(t) ? Number(t.replaceAll(',', '')) : null;
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
  const n = numberOf(String(text).replace(/%$/, ''));
  if (n === null) return null;
  const percent = n > 0 && n < 1 ? Math.round(n * 10000) / 100 : n;
  return [0, 5, 20].includes(percent) ? percent * 100 : null;
}
const look = (why) => ({ state: 'look', why });
// Stock that didn't come across, so Stock levels can't say All in (design 12).
export const holdsStock = (d) => numberOf(d['Qty On Hand'] ?? '0') !== 0;

// Design 7 to 10. Everything is read and checked before anything is written.
async function priceListRow(d, file, context) {
  if (context.firstStore && d.Store && d.Store !== context.firstStore) return look(`Stock at ${d.Store}: one shop’s stock comes across for now`);
  const sku = d['Item Lookup Code'];
  if (!sku) return look('No product code');
  if (!d.Description) return look('No description');
  if (d.Price === undefined) return look('No price');
  const price = moneyOf(d.Price);
  if (price === null || priceTooBig(price)) return look('The price isn’t a number Wheelhouse can use');
  const cost = d['Store Cost'] === undefined ? 0 : moneyOf(d['Store Cost']);
  if (cost === null) return look('The cost isn’t a number Wheelhouse can use');
  const vat = d['Tax Rate'] === undefined ? 2000 : vatOf(d['Tax Rate']);
  if (vat === null) return look('The VAT rate isn’t 0, 5 or 20%');
  const qty = wholeOf(d['Qty On Hand'] ?? '0');
  if (qty === null) return look('The stock isn’t a whole number');
  const min = d['Min (Reorder Point)'] === undefined ? 3 : wholeOf(d['Min (Reorder Point)']);
  if (min === null || min < 0) return look('The reorder level isn’t a whole number');

  const category = tidyCategory([d.Department, d.Category].filter(Boolean).join(' › '));
  const active = /^(no|false|0)$/i.test(d.Active ?? '') ? 0 : 1;
  // Never overwrites (design 9): a code already here stays as it is.
  const made = await prepare(
    `INSERT INTO products (sku, name, category, price, cost, vat_rate_bp, low_stock_threshold, supplier, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())
     ON CONFLICT (shop_id, sku) WHERE sku IS NOT NULL DO NOTHING RETURNING id`
  ).get(sku, d.Description, category, price, cost, vat, min, d.Supplier ?? '', active);
  if (!made) return { state: 'same' };
  // Its category's path found or made (category-tree), under the batch's own wait: only
  // for a row that came across, so a file sent again after a rename brings back nothing.
  await categoryFor(category);
  if (qty !== 0) {
    // Made just now, so nothing else can hold it: no lock to take, and the batch's own
    // wait stands. The shop was read once for the batch.
    await moveStock(
      [{ productId: made.id, change: qty, type: 'intake', note: STOCK_NOTE }],
      { siteId: context.siteId, ...(file.moved_by ?? { loginId: file.sent_by_login_id }) },
      { wait: false, held: [{ id: made.id, name: d.Description, stock_qty: 0 }] }
    );
    return { state: 'in', stock: 1 };
  }
  return { state: 'in' };
}

// Design 11.
async function barcodeRow(d) {
  if (!d.Alias) return look('No barcode');
  const product = await prepare('SELECT id, barcode FROM products WHERE sku = ?').get(d.ILC ?? '');
  if (!product) return look(NO_PRODUCT);
  if (product.barcode === d.Alias) return { state: 'same' };
  if (product.barcode) return look('This product already has a different barcode');
  const taken = await prepare('SELECT id FROM products WHERE barcode = ?').get(d.Alias);
  if (taken) return look('Another product has this barcode');
  await prepare('UPDATE products SET barcode = ?, updated_at = now() WHERE id = ?').run(d.Alias, product.id);
  return { state: 'in' };
}

export const ROW_APPLIERS = { price_list: priceListRow, barcodes: barcodeRow, customers: customerRow, bikes: bikeRow };
// Those that wait for another file: when it finishes, they try again.
const WAITS_FOR = { price_list: ['barcodes', NO_PRODUCT], customers: ['bikes', NO_CUSTOMER] };

// A lot of the rows waiting for this file, sent back to try again. True if there may be
// more: the file stays coming across until there aren't, so the files are never held
// for tens of thousands of rows at once, and the rows sent back wait behind it.
async function retryAfter(file, lot) {
  const waiting = WAITS_FOR[file.report];
  if (!waiting) return false;
  const again = await prepare(
    `UPDATE move_rows SET state = 'waiting', why = NULL WHERE id IN (
       SELECT r.id FROM move_rows r JOIN move_files f ON f.id = r.file_id
        WHERE f.report = ? AND r.state = 'look' AND r.why = ? ORDER BY r.id LIMIT ?
     ) RETURNING file_id`
  ).all(waiting[0], waiting[1], lot);
  await backToWaiting(again);
  return again.length === lot;
}

// Rows just sent back to waiting: their files' counts follow, and those files carry on.
export async function backToWaiting(again) {
  const perFile = new Map();
  for (const { file_id: id } of again) perFile.set(id, (perFile.get(id) ?? 0) + 1);
  for (const [id, count] of [...perFile].sort(([a], [b]) => a - b)) {
    await prepare(`UPDATE move_files SET state = 'bringing', rows_look = rows_look - ?, finished_at = NULL WHERE id = ?`).run(count, id);
  }
  return perFile.size > 0;
}

// The batch's locks, taken before any row is written: every file of the shop in
// id order, as deleting someone's details does, then the batch's products in the
// order sales use.
export const lockFiles = () => prepare('SELECT id FROM move_files ORDER BY id FOR UPDATE').all();
const waitNoLonger = (howLong) => prepare(`SET LOCAL lock_timeout = '${howLong}'`).run();
export async function lockForBatch(file, rows) {
  if (file.report === 'barcodes') {
    await prepare('SELECT id FROM products WHERE sku = ANY(?) ORDER BY id FOR UPDATE').all(rows.map((r) => r.data.ILC).filter(Boolean));
  }
  if (file.report === 'bikes') await lockBikeOwners(rows);
}
export async function batchContext(file) {
  if (file.report === 'customers' || file.report === 'bikes') return { salt: await moveSalt() };
  if (file.report !== 'price_list') return {};
  const first = await prepare(`SELECT store_name FROM move_files WHERE report = 'price_list' AND store_name <> '' ORDER BY id LIMIT 1`).get();
  return { firstStore: first?.store_name ?? '', siteId: await oldestSite() };
}

// A row's outcome, then the file's counts: added up once per batch, not per row.
export async function settle(row, done, file, totals) {
  if (done.state === 'look') await prepare(`UPDATE move_rows SET state = 'look', why = ?, customer_id = ? WHERE id = ?`).run(done.why, done.customerId ?? null, row.id);
  else await prepare(`UPDATE move_rows SET state = ?, why = NULL, customer_id = NULL, data = '{}' WHERE id = ?`).run(done.state, row.id);
  totals[done.state] = (totals[done.state] ?? 0) + 1;
  totals.stock = (totals.stock ?? 0) + (done.stock ?? 0);
  if (done.state === 'look' && file.report === 'price_list' && holdsStock(row.data)) totals.stockLook = (totals.stockLook ?? 0) + 1;
}
export const addCounts = (file, t) => prepare(
  `UPDATE move_files SET rows_in = rows_in + ?, rows_same = rows_same + ?, rows_skipped = rows_skipped + ?, rows_look = rows_look + ?,
          stock_in = stock_in + ?, stock_look = stock_look + ? WHERE id = ?`
).run(t.in ?? 0, t.same ?? 0, t.skipped ?? 0, t.look ?? 0, t.stock ?? 0, t.stockLook ?? 0, file.id);

class RowFailed extends Error {}

// After a batch failed: each row in its own transaction, so a savepoint per row
// is never needed (server/db.js warns against them) and one odd row can't stop a
// file. A deadlock or a lock wait isn't the row's fault: it stays waiting for the next round.
async function oneByOne(file, ids, beforeRow) {
  for (const id of ids) {
    await dbExec('BEGIN');
    try {
      await waitNoLonger(BATCH_LOCK_WAIT);
      await lockFiles();
      const row = await prepare(`SELECT id, data FROM move_rows WHERE id = ? AND state = 'waiting' FOR UPDATE`).get(id);
      if (row) {
        await lockForBatch(file, [row]);
        await beforeRow(row);
        const totals = {};
        await settle(row, await ROW_APPLIERS[file.report](row.data, file, await batchContext(file)), file, totals);
        await addCounts(file, totals);
      }
      await dbExec('COMMIT');
    } catch (err) {
      await dbExec('ROLLBACK');
      if (TRY_AGAIN.has(err.code)) return 'busy';
      // The code only: a database error's other fields can quote the row.
      console.error(`Move: row ${id} couldn't come across`, err.code ?? err.name);
      await dbExec('BEGIN');
      try {
        await waitNoLonger(BATCH_LOCK_WAIT);
        await lockFiles();
        const row = await prepare(`SELECT id, data FROM move_rows WHERE id = ? AND state = 'waiting' FOR UPDATE`).get(id);
        if (row) {
          const totals = {};
          await settle(row, look(ROW_FAILED), file, totals);
          await addCounts(file, totals);
        }
        await dbExec('COMMIT');
      } catch (again) {
        await dbExec('ROLLBACK');
        if (TRY_AGAIN.has(again.code)) return 'busy';
        throw again;
      }
    }
  }
  return true;
}

/**
 * One batch for the current shop, inside its runWithShop. Returns whether there was
 * anything to do, or 'busy' if it gave up waiting for a lock, with nothing changed.
 * `beforeRow` and `afterRows` are for a test failing it part-way; `now`, `limitMs` and
 * `retryLot` for a test choosing where it stops.
 */
export async function bringBatch({ beforeRow = () => {}, afterRows = () => {}, now = Date.now, limitMs = BATCH_MS, retryLot = RETRY_LOT } = {}) {
  const file = await prepare(
    `SELECT * FROM move_files WHERE state = 'bringing' ORDER BY array_position(ARRAY['price_list', 'customers', 'barcodes', 'bikes'], report), id LIMIT 1`
  ).get();
  if (!file) return false;
  const ids = [];
  await dbExec('BEGIN');
  try {
    await waitNoLonger(BATCH_LOCK_WAIT);
    await lockFiles();
    const started = now();
    const context = await batchContext(file);
    const totals = {};
    let timeUp = false;
    while (!timeUp && ids.length < BATCH) {
      const rows = await prepare(`SELECT id, data FROM move_rows WHERE file_id = ? AND state = 'waiting' ORDER BY id LIMIT ? FOR UPDATE`).all(file.id, BATCH_LOT);
      if (rows.length === 0) break;
      ids.push(...rows.map((r) => r.id));
      await lockForBatch(file, rows);
      for (const row of rows) {
        try {
          await beforeRow(row);
          await settle(row, await ROW_APPLIERS[file.report](row.data, file, context), file, totals);
        } catch (err) {
          // A lock wait is nobody's fault: the batch gives back, and the next one starts over.
          if (err.code === '55P03') throw err;
          throw new RowFailed(err.code ?? err.name);
        }
        timeUp = now() - started >= limitMs;
        if (timeUp) break;
      }
    }
    if (ids.length === 0) {
      if (!(await retryAfter(file, retryLot))) await prepare(`UPDATE move_files SET state = 'done', finished_at = now() WHERE id = ?`).run(file.id);
      await dbExec('COMMIT');
      return true;
    }
    await addCounts(file, totals);
    await afterRows();
    await dbExec('COMMIT');
    return true;
  } catch (err) {
    await dbExec('ROLLBACK');
    if (err.code === '55P03') return 'busy';
    if (!(err instanceof RowFailed) && !TRY_AGAIN.has(err.code)) throw err;
    return ids.length ? oneByOne(file, ids, beforeRow) : 'busy';
  }
}

/**
 * Reads the shop's next waiting file, outside any database connection, then
 * stores its rows, or marks it can't-read. The rows go in small transactions that
 * hold no lock on the move files, so a deletion waiting on those is never turned
 * away by a large file, and only the last step, which takes the file's lock, makes
 * them count. Stopped part-way, it starts again from the file: leftovers go first.
 * The bytes go at the end. Returns whether there was one. `afterChunk` is for a test.
 */
export async function readNextFile(shopId, { afterChunk = () => {} } = {}) {
  const next = await runWithShop(shopId, async () => {
    const file = await prepare(`SELECT id, file_name FROM move_files WHERE state = 'reading' ORDER BY id LIMIT 1`).get();
    if (!file) return null;
    const held = await prepare('SELECT bytes FROM move_file_bytes WHERE file_id = ?').get(file.id);
    return { ...file, bytes: held?.bytes ?? Buffer.alloc(0) };
  });
  if (!next) return false;
  const found = await readInWorker(next.bytes, next.file_name);
  // Leftovers from a store that stopped part-way go whichever way this read went,
  // so a file that now can't be read keeps nobody's details.
  await runWithShop(shopId, () => prepare('DELETE FROM move_rows WHERE file_id = ?').run(next.id));
  if (found) {
    for (let at = 0; at < found.rows.length; at += INSERT_CHUNK) {
      const chunk = found.rows.slice(at, at + INSERT_CHUNK);
      // A new row checks its file exists, so this waits while a batch holds the files.
      await runWithShop(shopId, async () => {
        await dbExec('BEGIN');
        try {
          await waitNoLonger(BATCH_LOCK_WAIT);
          await prepare('INSERT INTO move_rows (file_id, data) SELECT ?, unnest(?::jsonb[]) RETURNING id').all(next.id, chunk);
          await dbExec('COMMIT');
        } catch (err) {
          await dbExec('ROLLBACK');
          throw err;
        }
      });
      await afterChunk();
    }
  }
  await runWithShop(shopId, async () => {
    await dbExec('BEGIN');
    try {
      await waitNoLonger(BATCH_LOCK_WAIT);
      const file = await prepare(`SELECT id FROM move_files WHERE id = ? AND state = 'reading' FOR UPDATE`).get(next.id);
      if (file) {
        await prepare('DELETE FROM move_file_bytes WHERE file_id = ?').run(next.id);
        if (found) {
          // Counted, not taken from the file: a deletion may have removed some since.
          const { n } = await prepare('SELECT count(*)::int AS n FROM move_rows WHERE file_id = ?').get(next.id);
          await prepare(`UPDATE move_files SET report = ?, store_name = ?, rows_total = ?, state = 'bringing' WHERE id = ?`).run(found.report, found.storeName, n, next.id);
        } else {
          await prepare(`UPDATE move_files SET state = 'cant_read', finished_at = now() WHERE id = ?`).run(next.id);
        }
      }
      await dbExec('COMMIT');
    } catch (err) {
      await dbExec('ROLLBACK');
      throw err;
    }
  });
  return true;
}

/**
 * One run of the timer: each shop's waiting files read, then a few batches, each
 * with its own connection. `onlyShops` limits it to those; null is every shop.
 * Returns the shops that may have more to do.
 */
export async function bringAcrossRound(stopping = () => false, onlyShops = null, { breathe = () => new Promise((r) => { setTimeout(r, BATCH_BREATH_MS); }) } = {}) {
  const more = new Set();
  const shops = onlyShops ? [...onlyShops] : (await pool.query('SELECT id FROM shops')).rows.map((s) => s.id);
  for (const shopId of shops) {
    try {
      while (!stopping() && (await readNextFile(shopId))) more.add(shopId);
      for (let i = 0; i < BATCHES_A_ROUND; i += 1) {
        if (stopping()) { more.add(shopId); break; }
        const did = await runWithShop(shopId, () => bringBatch());
        if (!did) break;
        // Something's stuck: the next tick tries again, rather than twenty times now.
        if (did === 'busy' || i === BATCHES_A_ROUND - 1) { more.add(shopId); break; }
        await breathe();
      }
    } catch (err) {
      more.add(shopId);
      if (!(err instanceof ReadBusy) && !TRY_AGAIN.has(err.code)) console.error(`Move: bringing across failed for shop ${shopId} this round`, err.code ?? err.name);
    }
  }
  return more;
}

// Nothing is looked for until there's a reason: every shop once at the start, for
// anything a restart left waiting, then only a shop that's sent a file or has more
// to do (design 5). A quiet server doesn't open a connection per shop every few
// seconds, and a server only touches other shops' files at the start.
const wantedShops = new Set();
export function wakeBringingAcross(shopId) { wantedShops.add(shopId); }

/**
 * Starts the timer; returns stop(), which waits for a round in flight. As the
 * messages sender. Test servers share a database, so they don't look at every shop
 * at the start (WH_MOVE_SCAN_AT_START, set off in tests/helpers/liveServer.js).
 */
export function startBringingAcross(intervalMs = Number(process.env.WH_MOVE_TICK_MS ?? 2000), {
  round: runRound = bringAcrossRound,
  scanAtStart = process.env.WH_MOVE_SCAN_AT_START !== 'off',
} = {}) {
  let round = null;
  let stopped = false;
  let wantAll = scanAtStart;
  const timer = setInterval(() => {
    if (round || (!wantAll && wantedShops.size === 0)) return;
    const only = wantAll ? null : new Set(wantedShops);
    wantAll = false;
    wantedShops.clear();
    round = runRound(() => stopped, only)
      .then((more) => { for (const shopId of more) wantedShops.add(shopId); })
      .catch((err) => {
        if (only) for (const shopId of only) wantedShops.add(shopId);
        else wantAll = true;
        console.error('Move: bringing across failed this round', err.code ?? err.name);
      })
      .finally(() => { round = null; });
  }, intervalMs);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
    return round ?? Promise.resolve();
  };
}
