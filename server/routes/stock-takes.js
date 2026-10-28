// Stock take: /api/stock-takes (openspec/changes/stock-take; tk-hub,
// tk-start, tk-count, tk-count-below, tk-diff, tk-applied; stock control
// decisions 5, 9 and 11). The Owner starts a count of the whole shop, a
// category, an area or the products below zero, checks it and applies it
// (until roles bring "Can order stock", the 5 Oct later change); anyone
// signed in joins and counts, blind. Counting never touches products or
// stock_movements, so it can't hold up the till. Applying locks the take,
// then its products in id order (as sales and the till do), and changes each
// product's stock by its difference with its "Counted" history line in the
// same transaction; Undo does the same the other way.
// Staff routes: they run with the shop's row-level security already bound.
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { currentSession } from '../lib/session.js';
import { deferShopifyPushes } from '../lib/sales.js';
import { checkOf, differencesOf, notCountedOf, recountsAskedOf, takeLabel as label } from '../lib/stock-take-differences.js';

const db = { prepare, exec: dbExec };

const KINDS = ['whole_shop', 'category', 'area', 'below_zero'];
const MAX_TARGET = 60; // as migration 099
const MAX_QTY = 100000;
const AREAS_OFFERED = 5;
const FINISHED_SHOWN = 20;
const START_COUNT = "Only the shop's owner can start a count";
const CHECK_COUNT = "Only the shop's owner can check and apply a count";
const APPLIED = 'This count has been applied';

const TAKE_SELECT = `SELECT t.*, l.name AS started_by, a.name AS applied_by FROM stock_takes t
  JOIN logins l ON l.id = t.started_by_login_id LEFT JOIN logins a ON a.id = t.applied_by_login_id`;
const takeOf = (id) => (Number.isSafeInteger(id) && id > 0 ? db.prepare(`${TAKE_SELECT} WHERE t.id = ?`).get(id) : null);
// The take, locked for applying, undoing, a recount or Count them as none.
const lockedTake = (id) => db.prepare('SELECT * FROM stock_takes WHERE id = ? FOR UPDATE').get(id);

function serializeTake(t) {
  return {
    id: t.id, kind: t.kind, target: t.target, label: label(t), status: t.status,
    startedAt: new Date(t.started_at).toISOString(), startedBy: t.started_by,
    appliedAt: t.applied_at ? new Date(t.applied_at).toISOString() : null, appliedBy: t.applied_by ?? null,
  };
}

// What an applied count changed, for the hub's Finished counts and the
// applied page: products changed and their value at cost, in pence.
async function appliedSummary(ids) {
  if (ids.length === 0) return [];
  return db.prepare(
    `SELECT stock_take_id, COUNT(*) FILTER (WHERE difference <> 0)::int AS changed, COALESCE(SUM(difference * cost_pence), 0)::int AS value
       FROM stock_take_results WHERE stock_take_id = ANY(?) GROUP BY stock_take_id`
  ).all(ids);
}
const withSummary = async (t) => {
  const [s] = await appliedSummary([t.id]);
  return { ...serializeTake(t), productsChanged: s?.changed ?? 0, valuePence: s?.value ?? 0 };
};

// Joining, or counting again after "I've finished my part", puts the person
// back to counting (design 7).
const counting = (takeId, loginId) => db
  .prepare('INSERT INTO stock_take_counters (stock_take_id, login_id) VALUES (?, ?) ON CONFLICT (stock_take_id, login_id) DO UPDATE SET finished_at = NULL RETURNING login_id')
  .run(takeId, loginId);

// Whether a product belongs to this count (design 6): its category, or the
// below-zero list taken when it started; the whole shop and an area take any.
function outsideCount(take, product) {
  if (take.kind === 'category' && product.category !== take.target) return `${product.name} isn’t in ${take.target}`;
  if (take.kind === 'below_zero' && !(take.product_ids || []).includes(product.id)) return `${product.name} isn’t below zero`;
  return null;
}

// One transaction around `work`, which returns [status, body] to send; a
// refusal (status 400 or more) rolls back.
async function inTransaction(res, work) {
  await db.exec('BEGIN');
  let out;
  try {
    out = await work();
    await db.exec(out[0] >= 400 ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {});
    throw err;
  }
  sendJson(res, out[0], out[0] >= 400 ? { error: out[1] } : out[1]);
  return out[0] < 400;
}

// Locks the products in id order, the order sales and the till take them in,
// so applying queues behind a sale (or a sale behind it) and never deadlocks.
const lockProducts = (ids) => (ids.length
  ? db.prepare('SELECT id FROM products WHERE id = ANY(?) ORDER BY id FOR NO KEY UPDATE').all(ids)
  : Promise.resolve([]));

const csvCell = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
// A name or code a spreadsheet would read as a formula is written as text
// (review, 28 Oct): a ' before =, +, -, @, a tab or a return. Numbers stay numbers.
const textCell = (v) => csvCell(/^[=+\-@\t\r]/.test(String(v)) ? `'${v}` : v);
const MATCHES = 20;
const pounds = (pence) => `${pence < 0 ? '-' : ''}${(Math.abs(pence) / 100).toFixed(2)}`;
const names = (ns) => (ns.length < 2 ? ns.join('') : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);

export function register(route) {
  // The counts in progress, newest first, with who is counting and who has
  // finished; the areas used before (decision 11); and, for the Owner, the
  // finished counts with what they changed at cost (Staff see no cost).
  route('GET', '/api/stock-takes', async (req, res) => {
    const ctx = await currentSession(req);
    const takes = await db.prepare(`${TAKE_SELECT} WHERE t.status = 'counting' ORDER BY t.id DESC`).all();
    const ids = takes.map((t) => t.id);
    const counters = ids.length ? await db.prepare(
      'SELECT c.stock_take_id, c.finished_at, l.name FROM stock_take_counters c JOIN logins l ON l.id = c.login_id WHERE c.stock_take_id = ANY(?) ORDER BY c.joined_at, l.name'
    ).all(ids) : [];
    const items = ids.length ? await db.prepare('SELECT stock_take_id, SUM(qty)::int AS n FROM stock_take_counts WHERE stock_take_id = ANY(?) GROUP BY stock_take_id').all(ids) : [];
    const areas = await db.prepare(`SELECT target FROM stock_takes WHERE kind = 'area' GROUP BY target ORDER BY MAX(id) DESC LIMIT ${AREAS_OFFERED}`).all();
    const body = {
      canStart: !!ctx.login.is_owner,
      areasUsed: areas.map((a) => a.target),
      inProgress: takes.map((t) => {
        const mine = counters.filter((c) => c.stock_take_id === t.id);
        return {
          ...serializeTake(t),
          counting: mine.filter((c) => !c.finished_at).map((c) => c.name),
          finished: mine.filter((c) => c.finished_at).map((c) => c.name),
          itemsCounted: items.find((i) => i.stock_take_id === t.id)?.n ?? 0,
          everyoneFinished: mine.length > 0 && mine.every((c) => c.finished_at),
        };
      }),
    };
    if (ctx.login.is_owner) {
      const done = await db.prepare(`${TAKE_SELECT} WHERE t.status = 'applied' ORDER BY t.applied_at DESC, t.id DESC LIMIT ${FINISHED_SHOWN}`).all();
      const sums = await appliedSummary(done.map((t) => t.id));
      body.finished = done.map((t) => {
        const s = sums.find((x) => x.stock_take_id === t.id);
        return { ...serializeTake(t), productsChanged: s?.changed ?? 0, valuePence: s?.value ?? 0 };
      });
    }
    sendJson(res, 200, body);
  });

  // Start a count (tk-start): the Owner, until "Can order stock".
  route('POST', '/api/stock-takes', async (req, res) => {
    if (await ownerOnly(req, res, START_COUNT)) return;
    const ctx = await currentSession(req);
    const body = await readJsonBody(req);
    const kind = body.kind;
    if (!KINDS.includes(kind)) return badRequest(res, 'Say what to count: the whole shop, a category, an area or below zero');
    const named = kind === 'category' || kind === 'area';
    const target = named ? String(body.target ?? '').trim() : '';
    if (named && !target) return badRequest(res, kind === 'area' ? 'Name the area' : 'Pick a category');
    if (target.length > MAX_TARGET) return badRequest(res, `Keep the name to ${MAX_TARGET} characters`);
    if (kind === 'category' && !(await db.prepare('SELECT 1 FROM products WHERE category = ? LIMIT 1').get(target))) {
      return badRequest(res, 'No products are in that category');
    }
    let productIds = null;
    if (kind === 'below_zero') {
      productIds = (await db.prepare('SELECT id FROM products WHERE stock_qty < 0 AND active = 1 ORDER BY id').all()).map((p) => p.id);
      if (productIds.length === 0) return badRequest(res, 'Nothing is below zero');
    }
    const { id } = await db.prepare('INSERT INTO stock_takes (kind, target, product_ids, started_by_login_id) VALUES (?, ?, ?, ?) RETURNING id')
      .get(kind, target, productIds, ctx.login.id);
    sendJson(res, 201, serializeTake(await takeOf(id)));
  });

  // The counting page (tk-count): this person's own lines, lines asked to be
  // recounted, who else is counting, and for below zero what nobody has
  // found yet. Blind (design 5).
  route('GET', '/api/stock-takes/:id', async (req, res, params) => {
    const ctx = await currentSession(req);
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    const mine = await db.prepare(
      `SELECT c.product_id, c.qty, p.name, p.sku FROM stock_take_counts c JOIN products p ON p.id = c.product_id
        WHERE c.stock_take_id = ? AND c.login_id = ? AND c.qty > 0 ORDER BY c.first_counted_at DESC, c.id DESC`
    ).all(take.id, ctx.login.id);
    const others = await db.prepare(
      'SELECT l.name FROM stock_take_counters c JOIN logins l ON l.id = c.login_id WHERE c.stock_take_id = ? AND c.login_id <> ? AND c.finished_at IS NULL ORDER BY c.joined_at, l.name'
    ).all(take.id, ctx.login.id);
    const stillToFind = take.kind !== 'below_zero' ? null : (await db.prepare(
      `SELECT p.id, p.name, p.sku FROM products p WHERE p.id = ANY(?)
         AND NOT EXISTS (SELECT 1 FROM stock_take_counts c WHERE c.stock_take_id = ? AND c.product_id = p.id) ORDER BY p.name, p.id`
    ).all(take.product_ids, take.id)).map((p) => ({ productId: p.id, name: p.name, sku: p.sku }));
    const recounts = await recountsAskedOf(take);
    sendJson(res, 200, {
      ...serializeTake(take),
      mine: mine.map((l) => ({ productId: l.product_id, name: l.name, sku: l.sku, qty: l.qty })),
      myItems: mine.reduce((n, l) => n + l.qty, 0),
      othersCounting: others.map((o) => o.name),
      recountAsked: recounts.map((r) => ({ productId: r.product_id, name: r.name, sku: r.sku, askedBy: r.asked_by })),
      stillToFind,
    });
  });

  // The counting page's search (tk-count; review, 28 Oct): names and codes
  // only, never stock or cost, so counting stays blind; within the take's
  // category or below-zero list. Anyone signed in, as counting is.
  route('GET', '/api/stock-takes/:id/products', async (req, res, params, query) => {
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    const search = String(query.get('search') ?? '').trim();
    if (!search) return sendJson(res, 200, []);
    const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const scope = take.kind === 'category' ? ' AND category = ?' : take.kind === 'below_zero' ? ' AND id = ANY(?)' : '';
    const args = take.kind === 'category' ? [take.target] : take.kind === 'below_zero' ? [take.product_ids] : [];
    const rows = await db.prepare(
      `SELECT id, name, sku, barcode FROM products WHERE active = 1${scope}
         AND (name ILIKE ? ESCAPE '\\' OR sku ILIKE ? ESCAPE '\\' OR barcode ILIKE ? ESCAPE '\\')
       ORDER BY COALESCE(lower(barcode) = lower(?) OR lower(sku) = lower(?), false) DESC, name, id LIMIT ${MATCHES}`
    ).all(...args, like, like, like, search, search);
    sendJson(res, 200, rows.map((p) => ({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode })));
  });

  // Join (tk-hub-staff's Join), or come back to counting.
  route('POST', '/api/stock-takes/:id/join', async (req, res, params) => {
    const ctx = await currentSession(req);
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    if (take.status !== 'counting') return sendJson(res, 409, { error: APPLIED });
    await counting(take.id, ctx.login.id);
    sendJson(res, 200, { ok: true });
  });

  // A scan adds one; a typed number sets this person's count; 0 takes their
  // line off. One statement each, so two at once both count (design 4). The
  // take is read FOR SHARE, so applying waits for a count in flight, and a
  // count after it is applied is refused.
  route('POST', '/api/stock-takes/:id/counts', async (req, res, params) => {
    const ctx = await currentSession(req);
    const body = await readJsonBody(req);
    const productId = body.productId;
    if (!Number.isSafeInteger(productId) || productId <= 0) return badRequest(res, 'Say which product was counted');
    const adding = body.add === 1 && body.qty === undefined;
    const setting = body.add === undefined && Number.isInteger(body.qty) && body.qty >= 0 && body.qty <= MAX_QTY;
    if (!adding && !setting) return badRequest(res, `Scan to add one, or type a count from 0 to ${MAX_QTY.toLocaleString('en-GB')}`);
    const id = Number(params.id);
    if (!(await takeOf(id))) return notFound(res, 'Count not found');
    const product = await db.prepare('SELECT id, name, sku, category FROM products WHERE id = ?').get(productId);
    if (!product) return notFound(res, 'Product not found');

    await inTransaction(res, async () => {
      const take = await db.prepare('SELECT * FROM stock_takes WHERE id = ? FOR SHARE').get(id);
      if (take.status !== 'counting') return [409, APPLIED];
      const outside = outsideCount(take, product);
      if (outside) return [400, outside];
      let qty = 0;
      if (setting && body.qty === 0) {
        await db.prepare('DELETE FROM stock_take_counts WHERE stock_take_id = ? AND product_id = ? AND login_id = ?').run(id, productId, ctx.login.id);
      } else {
        const line = await db.prepare(
          `INSERT INTO stock_take_counts (stock_take_id, product_id, login_id, qty) VALUES (?, ?, ?, ?)
           ON CONFLICT (stock_take_id, product_id, login_id) DO UPDATE
             SET qty = ${adding ? 'stock_take_counts.qty + 1' : 'EXCLUDED.qty'}, last_counted_at = now()
             WHERE ${adding ? `stock_take_counts.qty < ${MAX_QTY}` : 'true'}
           RETURNING qty`
        ).get(id, productId, ctx.login.id, adding ? 1 : body.qty);
        if (!line) return [400, `A count holds up to ${MAX_QTY.toLocaleString('en-GB')}`];
        qty = line.qty;
      }
      await counting(id, ctx.login.id);
      return [200, { productId, name: product.name, sku: product.sku, qty }];
    });
  });

  // I've finished my part (tk-count).
  route('POST', '/api/stock-takes/:id/finish', async (req, res, params) => {
    const ctx = await currentSession(req);
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    if (take.status !== 'counting') return sendJson(res, 409, { error: APPLIED });
    await db.prepare(
      'INSERT INTO stock_take_counters (stock_take_id, login_id, finished_at) VALUES (?, ?, now()) ON CONFLICT (stock_take_id, login_id) DO UPDATE SET finished_at = now() RETURNING login_id'
    ).run(take.id, ctx.login.id);
    sendJson(res, 200, { ok: true });
  });

  // Check the count (tk-diff): the differences, largest value first; lines
  // asked to be recounted; what nobody counted. For the Owner.
  route('GET', '/api/stock-takes/:id/check', async (req, res, params) => {
    if (await ownerOnly(req, res, CHECK_COUNT)) return;
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    const { all, ...checked } = await checkOf(take);
    void all;
    sendJson(res, 200, { ...serializeTake(take), ...checked });
  });

  // Recount (tk-diff): the line's counts go, it goes back to every counter
  // as "Recount asked by [Name]", and everyone is counting again.
  route('POST', '/api/stock-takes/:id/recount', async (req, res, params) => {
    if (await ownerOnly(req, res, CHECK_COUNT)) return;
    const ctx = await currentSession(req);
    const body = await readJsonBody(req);
    const id = Number(params.id);
    if (!(await takeOf(id))) return notFound(res, 'Count not found');
    const productId = body.productId;
    const product = Number.isSafeInteger(productId) && productId > 0 ? await db.prepare('SELECT id FROM products WHERE id = ?').get(productId) : null;
    if (!product) return notFound(res, 'Product not found');
    await inTransaction(res, async () => {
      const take = await lockedTake(id);
      if (take.status !== 'counting') return [409, APPLIED];
      await db.prepare('DELETE FROM stock_take_counts WHERE stock_take_id = ? AND product_id = ?').run(id, productId);
      await db.prepare(
        `INSERT INTO stock_take_recounts (stock_take_id, product_id, asked_by_login_id) VALUES (?, ?, ?)
         ON CONFLICT (stock_take_id, product_id) DO UPDATE SET asked_by_login_id = EXCLUDED.asked_by_login_id, asked_at = now() RETURNING product_id`
      ).run(id, productId, ctx.login.id);
      await db.prepare('UPDATE stock_take_counters SET finished_at = NULL WHERE stock_take_id = ?').run(id);
      return [200, { ok: true }];
    });
  });

  // Count them as none (tk-diff; decision 11): what this count covers and
  // nobody counted is counted as 0, by the Owner. An area count covers only
  // what was scanned, so it has nothing to count as none.
  route('POST', '/api/stock-takes/:id/none', async (req, res, params) => {
    if (await ownerOnly(req, res, CHECK_COUNT)) return;
    const ctx = await currentSession(req);
    const id = Number(params.id);
    if (!(await takeOf(id))) return notFound(res, 'Count not found');
    await inTransaction(res, async () => {
      const take = await lockedTake(id);
      if (take.status !== 'counting') return [409, APPLIED];
      const missed = await notCountedOf(take);
      if (missed === null) return [400, 'An area count leaves what nobody scanned as it is'];
      for (const p of missed) {
        await db.prepare('INSERT INTO stock_take_counts (stock_take_id, product_id, login_id, qty) VALUES (?, ?, ?, 0) ON CONFLICT DO NOTHING RETURNING id')
          .run(id, p.id, ctx.login.id);
      }
      return [200, { counted: missed.length }];
    });
  });

  // Apply (tk-diff's "Apply to [n] products"): the take locked, then its
  // products in id order; each difference added to stock as it is now, with
  // a "Counted" line saying who counted and who applied, in one transaction.
  // A line asked to be recounted and not counted again is left as it is.
  route('POST', '/api/stock-takes/:id/apply', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res, CHECK_COUNT)) return;
    const ctx = await currentSession(req);
    const id = Number(params.id);
    if (!(await takeOf(id))) return notFound(res, 'Count not found');
    const pushes = [];
    const ok = await inTransaction(res, async () => {
      const take = await lockedTake(id);
      if (take.status !== 'counting') return [409, APPLIED];
      const ids = (await db.prepare('SELECT DISTINCT product_id FROM stock_take_counts WHERE stock_take_id = ? ORDER BY product_id').all(id)).map((r) => r.product_id);
      if (ids.length === 0) return [400, 'Nothing has been counted yet'];
      await lockProducts(ids);
      const what = label(take);
      const rows = await differencesOf(take);
      const changed = rows.filter((r) => r.difference !== 0);
      // One statement each for the stock, the history lines and the results,
      // so the products' locks are held as briefly as can be (review, 28 Oct).
      const movementOf = new Map();
      if (changed.length > 0) {
        const updated = await db.prepare(
          `UPDATE products p SET stock_qty = p.stock_qty + v.d, updated_at = ? FROM unnest(?::int[], ?::int[]) AS v(id, d) WHERE p.id = v.id RETURNING p.*`
        ).all(nowIso(), changed.map((r) => r.productId), changed.map((r) => r.difference));
        for (const product of updated) if (product.shopify_inventory_item_id) pushes.push({ product, newQty: product.stock_qty });
        const notes = changed.map((r) => {
          const by = names([...new Set(r.byCounter.filter((b) => b.qty > 0).map((b) => b.name))]);
          return `Stock take of ${what} · counted ${r.counted}, expected ${r.expected}${by ? ` · counted by ${by}` : ''}`;
        });
        const lines = await db.prepare(
          `INSERT INTO stock_movements (product_id, change_qty, type, note, login_id, stock_take_id)
           SELECT v.p, v.d, 'count', v.n, ?, ? FROM unnest(?::int[], ?::int[], ?::text[]) AS v(p, d, n) RETURNING id, product_id`
        ).all(ctx.login.id, id, changed.map((r) => r.productId), changed.map((r) => r.difference), notes);
        for (const l of lines) movementOf.set(l.product_id, l.id);
      }
      await db.prepare(
        `INSERT INTO stock_take_results (stock_take_id, product_id, expected, counted, difference, cost_pence, stock_movement_id)
         SELECT ?, v.p, v.e, v.c, v.d, v.k, v.m FROM unnest(?::int[], ?::int[], ?::int[], ?::int[], ?::int[], ?::int[]) AS v(p, e, c, d, k, m) RETURNING product_id`
      ).all(id, rows.map((r) => r.productId), rows.map((r) => r.expected), rows.map((r) => r.counted), rows.map((r) => r.difference),
        rows.map((r) => r.costPence), rows.map((r) => movementOf.get(r.productId) ?? null));
      await db.prepare("UPDATE stock_takes SET status = 'applied', applied_at = now(), applied_by_login_id = ? WHERE id = ?").run(ctx.login.id, id);
      return [200, await withSummary(await takeOf(id))];
    });
    if (ok && pushes.length) deferShopifyPushes(afterRelease, shopId, pushes);
  });

  // Undo (tk-applied): each change taken off again, with its own line, and
  // the count back to counting so it can be checked and applied again.
  route('POST', '/api/stock-takes/:id/undo', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res, CHECK_COUNT)) return;
    const ctx = await currentSession(req);
    const id = Number(params.id);
    if (!(await takeOf(id))) return notFound(res, 'Count not found');
    const pushes = [];
    const ok = await inTransaction(res, async () => {
      const take = await lockedTake(id);
      if (take.status !== 'applied') return [409, 'This count isn’t applied'];
      const changed = await db.prepare('SELECT product_id, difference FROM stock_take_results WHERE stock_take_id = ? AND difference <> 0 ORDER BY product_id').all(id);
      await lockProducts(changed.map((r) => r.product_id));
      // A later count of the same product has measured stock that already
      // includes this one's change; taking it off now would leave stock wrong
      // (review, 28 Oct: 10, counted 7, then 8, Undo the first gave 11). A
      // later count that matched writes no history line, so it is found by
      // its results, written in order after this count's (second review:
      // 10, counted 7, then 7, Undo the first gave 10).
      const later = changed.length === 0 ? null : await db.prepare(
        `SELECT p.name FROM stock_take_results r JOIN products p ON p.id = r.product_id JOIN stock_takes t ON t.id = r.stock_take_id
          WHERE r.product_id = ANY(?) AND r.stock_take_id <> ? AND t.status = 'applied'
            AND r.id > (SELECT MAX(id) FROM stock_take_results WHERE stock_take_id = ?)
          ORDER BY r.id LIMIT 1`
      ).get(changed.map((r) => r.product_id), id, id);
      if (later) return [409, `A later count has corrected ${later.name}; undo that one first.`];
      for (const r of changed) {
        const product = await db.prepare('UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ? RETURNING *').get(r.difference, nowIso(), r.product_id);
        await db.prepare(
          "INSERT INTO stock_movements (product_id, change_qty, type, note, login_id, stock_take_id) VALUES (?, ?, 'count_undone', ?, ?, ?) RETURNING id"
        ).run(r.product_id, -r.difference, `Undid the stock take of ${label(take)}`, ctx.login.id, id);
        if (product.shopify_inventory_item_id) pushes.push({ product, newQty: product.stock_qty });
      }
      await db.prepare('DELETE FROM stock_take_results WHERE stock_take_id = ?').run(id);
      await db.prepare("UPDATE stock_takes SET status = 'counting', applied_at = NULL, applied_by_login_id = NULL WHERE id = ?").run(id);
      return [200, serializeTake(await takeOf(id))];
    });
    if (ok && pushes.length) deferShopifyPushes(afterRelease, shopId, pushes);
  });

  // Download the count (tk-applied): every counted product, as a spreadsheet.
  route('GET', '/api/stock-takes/:id/download', async (req, res, params) => {
    if (await ownerOnly(req, res, CHECK_COUNT)) return;
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    const { all } = await checkOf(take);
    const lines = [['Product', 'Supplier code', 'Expected', 'Counted', 'Difference', 'At cost'],
      ...all.map((r) => [textCell(r.name), textCell(r.sku ?? ''), r.expected, r.counted, r.difference, pounds(r.valuePence)])];
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="stock-take-${take.id}.csv"`,
    });
    // Text cells are made safe above; the headings and numbers need only quoting.
    res.end(`${lines.map((l, i) => l.map((v, j) => (i > 0 && j < 2 ? v : csvCell(v))).join(',')).join('\r\n')}\r\n`);
  });
}
