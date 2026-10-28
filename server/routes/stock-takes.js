// Stock take, the counting half: /api/stock-takes (openspec/changes/stock-take;
// tk-hub, tk-start, tk-count, tk-count-below; stock control decisions 5, 9
// and 11). The Owner starts a count of the whole shop, a category, an area or
// the products below zero (until roles bring "Can order stock", the 5 Oct
// later change); anyone signed in joins and counts, blind. Counting never
// touches products or stock_movements, so it can't hold up the till. Checking
// the count and applying it wait for Jack (design.md).
// Staff routes: they run with the shop's row-level security already bound.
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { currentSession } from '../lib/session.js';

const db = { prepare, exec: dbExec };

const KINDS = ['whole_shop', 'category', 'area', 'below_zero'];
const MAX_TARGET = 60; // as migration 098
const MAX_QTY = 100000;
const AREAS_OFFERED = 5;
const START_COUNT = "Only the shop's owner can start a count";

const label = (t) => (t.kind === 'whole_shop' ? 'Whole shop' : t.kind === 'below_zero' ? 'Below zero' : t.target);
const TAKE_SELECT = 'SELECT t.*, l.name AS started_by FROM stock_takes t JOIN logins l ON l.id = t.started_by_login_id';
const takeOf = (id) => (Number.isSafeInteger(id) && id > 0 ? db.prepare(`${TAKE_SELECT} WHERE t.id = ?`).get(id) : null);

function serializeTake(t) {
  return { id: t.id, kind: t.kind, target: t.target, label: label(t), startedAt: new Date(t.started_at).toISOString(), startedBy: t.started_by };
}

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

export function register(route) {
  // The counts in progress, newest first, with who is counting and who has
  // finished; and the areas used before (decision 11). No stock figures.
  route('GET', '/api/stock-takes', async (req, res) => {
    const ctx = await currentSession(req);
    const takes = await db.prepare(`${TAKE_SELECT} WHERE t.status = 'counting' ORDER BY t.id DESC`).all();
    const ids = takes.map((t) => t.id);
    const counters = ids.length ? await db.prepare(
      'SELECT c.stock_take_id, c.finished_at, l.name FROM stock_take_counters c JOIN logins l ON l.id = c.login_id WHERE c.stock_take_id = ANY(?) ORDER BY c.joined_at, l.name'
    ).all(ids) : [];
    const items = ids.length ? await db.prepare('SELECT stock_take_id, SUM(qty)::int AS n FROM stock_take_counts WHERE stock_take_id = ANY(?) GROUP BY stock_take_id').all(ids) : [];
    const areas = await db.prepare(`SELECT target FROM stock_takes WHERE kind = 'area' GROUP BY target ORDER BY MAX(id) DESC LIMIT ${AREAS_OFFERED}`).all();
    sendJson(res, 200, {
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
    });
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

  // The counting page (tk-count): this person's own lines, who else is
  // counting, and for below zero what nobody has found yet. Blind (design 5).
  route('GET', '/api/stock-takes/:id', async (req, res, params) => {
    const ctx = await currentSession(req);
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    const mine = await db.prepare(
      `SELECT c.product_id, c.qty, p.name, p.sku FROM stock_take_counts c JOIN products p ON p.id = c.product_id
        WHERE c.stock_take_id = ? AND c.login_id = ? ORDER BY c.first_counted_at DESC, c.id DESC`
    ).all(take.id, ctx.login.id);
    const others = await db.prepare(
      'SELECT l.name FROM stock_take_counters c JOIN logins l ON l.id = c.login_id WHERE c.stock_take_id = ? AND c.login_id <> ? AND c.finished_at IS NULL ORDER BY c.joined_at, l.name'
    ).all(take.id, ctx.login.id);
    const stillToFind = take.kind !== 'below_zero' ? null : (await db.prepare(
      `SELECT p.id, p.name, p.sku FROM products p WHERE p.id = ANY(?)
         AND NOT EXISTS (SELECT 1 FROM stock_take_counts c WHERE c.stock_take_id = ? AND c.product_id = p.id) ORDER BY p.name, p.id`
    ).all(take.product_ids, take.id)).map((p) => ({ productId: p.id, name: p.name, sku: p.sku }));
    sendJson(res, 200, {
      ...serializeTake(take),
      mine: mine.map((l) => ({ productId: l.product_id, name: l.name, sku: l.sku, qty: l.qty })),
      myItems: mine.reduce((n, l) => n + l.qty, 0),
      othersCounting: others.map((o) => o.name),
      stillToFind,
    });
  });

  // Join (tk-hub-staff's Join), or come back to counting.
  route('POST', '/api/stock-takes/:id/join', async (req, res, params) => {
    const ctx = await currentSession(req);
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    await counting(take.id, ctx.login.id);
    sendJson(res, 200, { ok: true });
  });

  // A scan adds one; a typed number sets this person's count; 0 takes their
  // line off. One statement each, so two at once both count (design 4). The
  // take is read FOR SHARE, so applying, when it is built, waits for a count
  // in flight rather than missing it.
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

    await db.exec('BEGIN');
    let line;
    try {
      const take = await db.prepare('SELECT * FROM stock_takes WHERE id = ? FOR SHARE').get(id);
      const outside = outsideCount(take, product);
      if (outside) {
        await db.exec('ROLLBACK');
        return badRequest(res, outside);
      }
      if (setting && body.qty === 0) {
        await db.prepare('DELETE FROM stock_take_counts WHERE stock_take_id = ? AND product_id = ? AND login_id = ?').run(id, productId, ctx.login.id);
        line = { qty: 0 };
      } else {
        line = await db.prepare(
          `INSERT INTO stock_take_counts (stock_take_id, product_id, login_id, qty) VALUES (?, ?, ?, ?)
           ON CONFLICT (stock_take_id, product_id, login_id) DO UPDATE
             SET qty = ${adding ? 'stock_take_counts.qty + 1' : 'EXCLUDED.qty'}, last_counted_at = now()
             WHERE ${adding ? `stock_take_counts.qty < ${MAX_QTY}` : 'true'}
           RETURNING qty`
        ).get(id, productId, ctx.login.id, adding ? 1 : body.qty);
        if (!line) {
          await db.exec('ROLLBACK');
          return badRequest(res, `A count holds up to ${MAX_QTY.toLocaleString('en-GB')}`);
        }
      }
      await counting(id, ctx.login.id);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      throw err;
    }
    sendJson(res, 200, { productId, name: product.name, sku: product.sku, qty: line.qty });
  });

  // I've finished my part (tk-count).
  route('POST', '/api/stock-takes/:id/finish', async (req, res, params) => {
    const ctx = await currentSession(req);
    const take = await takeOf(Number(params.id));
    if (!take) return notFound(res, 'Count not found');
    await db.prepare(
      'INSERT INTO stock_take_counters (stock_take_id, login_id, finished_at) VALUES (?, ?, now()) ON CONFLICT (stock_take_id, login_id) DO UPDATE SET finished_at = now() RETURNING login_id'
    ).run(take.id, ctx.login.id);
    sendJson(res, 200, { ok: true });
  });
}
