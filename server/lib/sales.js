// Sales: the helpers the till, orders, customers, the Shopify webhook, the
// dispatcher and shutdown all call. Moved out of server.js unchanged (split
// plan §4.1, WP-0.4); sales.js imports nothing from server.js. Reads and
// writes run through the request's shop context (row-level security), as
// they did in server.js.
import { AsyncLocalStorage } from 'node:async_hooks';
import { prepare, dbExec, runWithShop } from '../db.js';
import { nowIso, ValidationError } from './http.js';
import { pushInventoryLevel } from '../shopify.js';
import { currentShopTimeZone } from '../workshop/jobs.js';

const db = { prepare, exec: dbExec };

// ---------- Shopify inventory pushes after a sale ----------
// Fires createSale's deferred Shopify inventory pushes (see
// deferShopifyPushesTo on createSale). Called only once the request's own
// pooled client has already gone back to the pool - `product` here is a row
// createSale read earlier in the same request, before COMMIT, so nothing
// about firing this late depends on that original client.
//
// pushInventoryLevel (server/shopify.js) is not a pure HTTP call, though:
// getShopifyConnection() and the post-push status update both go through
// prepare(), which reads the current request-scoped client out of
// AsyncLocalStorage (server/db.js) and throws "No database client in scope"
// with none active. Firing this with no scope at all would crash every
// deferred push. runWithShop(shopId, ...) here checks out a NEW client from
// the pool - not the one that was just released - and, as of the fix below,
// holds it only for ONE push at a time (see firePendingShopifyPushes' own
// comment for why a single scope wrapping every queued push was unbounded,
// not "small"), each starting strictly after the original request has
// already sent its response. The two never overlap for this request, so the
// property the brief asks for holds: the
// connection a real till sale's own reads/writes needed is free again
// before any Shopify HTTP round-trip (with its retries/backoff) begins.
//
// This is fire-and-forget from the caller's point of view - the HTTP
// response has already been sent - but graceful shutdown still needs to know
// it happened. `pendingShopifyPushes` tracks every push started this way so
// gracefulShutdown() can wait for them before calling dbPool.end(): pg
// rejects connect() once end() has been called, so a push that opens its
// runWithShop(shopId, ...) scope after the pool has already ended gets a
// connection refused mid-push. The .catch() below already means that
// wouldn't fail a till sale, but it would fail the push itself silently -
// tracking it here means shutdown drains it first instead.
// Exported (read-only use in tests) so tests/sale-shopify-push-release.test.js
// can assert this set is non-empty at QUEUE time (right after createSale
// commits), not just at fire time - see registerPendingShopifyPushSlot below
// for why that distinction matters.
export const pendingShopifyPushes = new Set();

// Important 4: without this, the tracking entry above was only added inside
// firePendingShopifyPushes - i.e. at FIRE time, from the afterRelease
// callback, which runs after res.end() and after runWithShop/releaseClient's
// own round-trips (commit 26034ae closed the same seam one layer earlier: a
// signal landing in that ~1ms gap between the sale committing and
// afterRelease actually firing found pendingShopifyPushes still empty, so
// gracefulShutdown's drain saw nothing to wait for, closeIdleConnections()
// could cut the idle client's socket, and pool.end() could beat the push's
// own connect(). Registering a promise the moment createSale knows it has
// pushes to fire - immediately after COMMIT, well before the HTTP response
// is even sent - closes that gap: the set is non-empty from the moment the
// sale commits, and stays that way (via `slot.settle`) until the push
// actually runs, however late that turns out to be.
// Regression fix (fix round 2): the ONLY code that ever calls the resolver
// this returns is firePendingShopifyPushes, which is ONLY ever reached from
// a route's own `afterRelease.push(...)` call at the very end of the
// handler - after several more db.prepare calls and sendJson(). If anything
// in that tail throws (a transient DB error, a bug in serializeSale,
// anything), the dispatcher's catch sends the 500 and returns without ever
// reaching afterRelease - so the slot registered right above at COMMIT time
// would otherwise sit in pendingShopifyPushes forever, and every later
// gracefulShutdown() call would hit the 10s force-exit path (exit 1)
// instead of draining cleanly. `pendingPushSlotRequestStorage` (an
// AsyncLocalStorage set up per-request by runRequestWithPushSlotCleanup,
// which the dispatcher wraps every route handler in) makes this structural
// rather than remembered: whichever request is currently running when a
// slot is registered gets a reference to this exact resolver added to its
// own request-scoped set, and runRequestWithPushSlotCleanup's catch settles
// every slot still in that set the moment the request fails - whatever
// throws, wherever, on any current or future route. A slot that DOES fire
// normally removes itself from the request-scoped set too (the
// `slot.finally` above), so a request that succeeds never touches this at
// all - it's purely a backstop for the failure path.
function registerPendingShopifyPushSlot() {
  let settle;
  const slot = new Promise((resolve) => { settle = resolve; });
  pendingShopifyPushes.add(slot);
  slot.finally(() => pendingShopifyPushes.delete(slot));

  const requestSlots = pendingPushSlotRequestStorage.getStore();
  if (requestSlots) {
    requestSlots.add(settle);
    slot.finally(() => requestSlots.delete(settle));
  } else {
    // No request-scoped store means this call is NOT covered by
    // runRequestWithPushSlotCleanup - see the comment on
    // pendingPushSlotRequestStorage below for exactly which dispatcher
    // branches that is true of today. That is precisely the condition
    // under which a later throw in this same call's tail cannot settle
    // the slot above, and it would sit in pendingShopifyPushes forever,
    // degrading every later gracefulShutdown() to its 10s force-exit
    // path. This does not throw: the failure it guards against is a
    // degraded shutdown, not lost data or a lost sale, and server.js's
    // own uncaughtException/unhandledRejection handlers exit the
    // whole process on an unhandled error - turning an
    // unwrapped-but-otherwise-working route into a hard outage is worse
    // than the problem it would be catching. Logging makes the gap
    // visible the moment it is first exercised, so it gets wired up
    // before it ever reaches production shutdown behaviour.
    console.error(
      'registerPendingShopifyPushSlot: slot registered with no active request-scoped store (pendingPushSlotRequestStorage.getStore() ' +
        'returned undefined) - if this call\'s tail throws before the push fires, the slot will be orphaned in pendingShopifyPushes ' +
        'forever and every later gracefulShutdown() will hit its 10s force-exit path. Wrap this code path in runRequestWithPushSlotCleanup.'
    );
  }
  return settle;
}

// registerPendingShopifyPushSlot's slot is only cleaned up on a request
// tail's failure if that call happened inside runRequestWithPushSlotCleanup.
// Today that is true of exactly ONE branch: the generic non-auth `/api/*`
// loop in server.js's dispatcher (the one that wraps its route call in
// runRequestWithPushSlotCleanup). It is NOT true of the /api/auth/* branch
// inside that same loop, the /api/portal/* branch, the website branch, or
// the Shopify webhook branch - a deferred push registered from any of those
// would not be settled by a request-tail throw and would orphan the slot.
// No branch does that today (processShopifyOrderWebhook, the only webhook
// caller of createSale, never passes deferShopifyPushesTo, so it always
// takes the immediate-push path and never reaches here without a store) -
// but nothing stops a future change to one of those four branches from
// doing so. The guard in registerPendingShopifyPushSlot's `else` branch
// above is what will tell you if that ever happens; it is not structural
// coverage, only a loud signal that coverage is missing.
const pendingPushSlotRequestStorage = new AsyncLocalStorage();

export async function runRequestWithPushSlotCleanup(fn) {
  const requestSlots = new Set();
  try {
    return await pendingPushSlotRequestStorage.run(requestSlots, fn);
  } catch (err) {
    for (const settle of requestSlots) settle();
    throw err;
  }
}

// Exported (read-only use in tests) so a test can drive it directly with a
// slow stubbed Shopify call and observe the pool's active-client count
// dipping back to baseline BETWEEN items - proving each push opens and
// releases its own connection instead of one scope holding a client for the
// whole batch (Important 1).
export function firePendingShopifyPushes(shopId, pushes) {
  if (!pushes.length) return;
  const settleQueuedSlot = pushes._pendingPushSettle;
  const pending = (async () => {
    // ONE runWithShop scope per push, not one scope wrapping the whole
    // `for` loop - a single wrapping scope held one of only ten pooled
    // Postgres connections for the ENTIRE batch (each item up to ~15.15s
    // under withRetry - see server/shopify.js), which for a sale with many
    // line items could pin a connection for minutes during a Shopify
    // outage; a few concurrent sales like that exhausts the pool and stalls
    // every till in every shop. There is no bound on how many items a
    // single sale can queue here, so "this shop's small batch" was never a
    // safe assumption - opening a fresh scope per item bounds the
    // connection-hold to one push's worth of time, however many items are
    // queued.
    for (const { product, newQty } of pushes) {
      await runWithShop(shopId, () => pushInventoryLevel(product, newQty))
        // Never let a Shopify hiccup fail a real till sale - log and move on.
        .catch((err) => console.error('Shopify inventory push failed', err));
    }
  })().catch((err) => console.error('Shopify inventory push scope failed', err));
  if (settleQueuedSlot) {
    // The tracking entry already exists (added at queue time, in
    // createSale) - settle it once this actual work finishes instead of
    // adding a second, redundant entry.
    pending.finally(settleQueuedSlot);
  } else {
    // Defensive fallback only - every real caller goes through createSale's
    // deferShopifyPushesTo path above, which always registers a slot when
    // pushes.length > 0.
    pendingShopifyPushes.add(pending);
    pending.finally(() => pendingShopifyPushes.delete(pending));
  }
}

// For a stock change outside a sale (a product's stock adjustment, booking in
// a purchase order): the same as createSale's deferShopifyPushesTo path. The
// pushes are registered for graceful shutdown now, and fired from a fresh
// connection once the request has released its own, so a slow or failing
// Shopify never holds a pooled connection (#151 follow-up, Jack, 7 Oct).
export function deferShopifyPushes(afterRelease, shopId, pushes) {
  if (!pushes.length) return;
  pushes._pendingPushSettle = registerPendingShopifyPushSlot();
  afterRelease.push(() => firePendingShopifyPushes(shopId, pushes));
}

// ---------- The shop's day ----------

// Used by the sales list and the dashboard (moved out of server.js, WP-0.4).
// A timestamp column's rows on one of the shop's days (YYYY-MM-DD): midnight
// to midnight on the shop's clock, summer time included, not UTC midnight.
// Returns the SQL condition and its four arguments.
export async function shopDayWindow(column, date) {
  const timeZone = await currentShopTimeZone();
  return {
    sql: `${column} >= (?::date)::timestamp AT TIME ZONE ? AND ${column} < (?::date + 1)::timestamp AT TIME ZONE ?`,
    args: [date, timeZone, date, timeZone],
  };
}

// ---------- Sales ----------

export function serializeSale(row, items, payments) {
  return {
    id: row.id,
    createdAt: row.created_at,
    customerId: row.customer_id,
    customerName: row.customer_name !== undefined ? row.customer_name : undefined,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name !== undefined ? row.cashier_name : undefined,
    subtotal: row.subtotal,
    discount: row.discount,
    groupDiscountAmount: row.group_discount_amount,
    groupDiscountName: row.group_discount_name,
    total: row.total,
    paymentMethod: row.payment_method,
    cashAmount: row.cash_amount,
    cardAmount: row.card_amount,
    cashTendered: row.cash_tendered,
    extraPayments: payments ? payments.map((p) => ({ tenderType: p.tender_type, amount: p.amount })) : undefined,
    note: row.note,
    items: items
      ? items.map((it) => ({
          id: it.id,
          productId: it.product_id,
          name: it.name,
          sku: it.sku,
          unitPrice: it.unit_price,
          qty: it.qty,
          lineTotal: it.line_total,
        }))
      : undefined,
  };
}

export const SALE_SELECT = `SELECT s.*, c.name AS customer_name, ca.name AS cashier_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id LEFT JOIN employees ca ON ca.id = s.cashier_id`;

// ---------- Both records at once (step B of sales in pence) ----------
// The all_sales view gives one row per sale from the old record and from the
// new till (migration 079). A row is told apart by `source` ('old' or
// 'till') and its own id; an id with no source means 'old' so old links keep
// working (openspec/changes/wp-1-6-sales-in-pence, design.md Decision 3).
export const SALE_SOURCES = ['old', 'till'];

export const ALL_SALES_SELECT = `SELECT v.source, v.id, v.made_at, v.customer_id, v.employee_id AS cashier_id, v.total_pence, v.vat_pence, v.receipt_number,
       c.name AS customer_name, ca.name AS cashier_name,
       s.subtotal, s.discount, s.total, s.group_discount_amount, s.group_discount_name, s.payment_method,
       s.cash_amount, s.card_amount, s.cash_tendered, s.note,
       (SELECT string_agg(DISTINCT p.method, ',' ORDER BY p.method) FROM till_sale_payments p WHERE v.source = 'till' AND p.till_sale_id = v.id) AS till_methods
  FROM all_sales v
  LEFT JOIN sales s ON v.source = 'old' AND s.id = v.id
  LEFT JOIN customers c ON c.id = v.customer_id
  LEFT JOIN employees ca ON ca.id = v.employee_id`;

// What the old app's badge shows for a till sale: Cash, Card, or Split.
function tillPaymentLabel(methods) {
  if (!methods) return null;
  const list = methods.split(',');
  if (list.length > 1) return 'Split';
  return list[0].charAt(0).toUpperCase() + list[0].slice(1);
}

// A row of ALL_SALES_SELECT, as the API sends it. Old sales keep every pound
// field the old app reads (serializeSale) and gain `source` and `totalPence`;
// a till sale is sent in pence with the pound total beside it.
export function serializeAnySale(row, items, payments) {
  if (row.source === 'till') {
    return {
      id: row.id,
      source: 'till',
      createdAt: row.made_at,
      customerId: row.customer_id,
      customerName: row.customer_name,
      cashierId: row.cashier_id,
      cashierName: row.cashier_name,
      // Pound fields the old app's receipt window reads. A till sale has no
      // discount (its lines add up to its total); cash and card come from its
      // payments, any other method is listed as an extra payment.
      subtotal: row.total_pence / 100,
      discount: 0,
      total: row.total_pence / 100,
      totalPence: row.total_pence,
      cashAmount: (payments || []).filter((p) => p.method === 'cash').reduce((n, p) => n + p.amountPence, 0) / 100,
      cardAmount: (payments || []).filter((p) => p.method === 'card').reduce((n, p) => n + p.amountPence, 0) / 100,
      extraPayments: payments ? payments.filter((p) => p.method !== 'cash' && p.method !== 'card').map((p) => ({ tenderType: p.method, amount: p.amountPence / 100 })) : undefined,
      vatPence: row.vat_pence,
      receiptNumber: row.receipt_number,
      paymentMethod: tillPaymentLabel(row.till_methods),
      items,
      payments,
    };
  }
  return {
    ...serializeSale({ ...row, created_at: row.made_at }, items, payments),
    source: 'old',
    totalPence: row.total_pence,
  };
}

export async function resolveCashierId(rawId) {
  if (rawId === undefined || rawId === null || rawId === '') return { ok: true, cashierId: null };
  const cashierId = Number(rawId);
  const cashier = await db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1 AND is_cashier = 1').get(cashierId);
  if (!cashier) return { ok: false };
  return { ok: true, cashierId };
}

// Computed server-side (never trusts a client-sent amount) from whichever of
// the customer's groups carries the highest discount_percent, so a sale's
// group discount can't be tampered with via the API. Applies to the same net
// subtotal (after any per-line price overrides) that the flat discount does.
export async function resolveGroupDiscount(customerId, subtotal) {
  if (!customerId) return { amount: 0, name: '' };
  const top = await db
    .prepare(
      `SELECT g.name, g.discount_percent FROM customer_groups g
       JOIN customer_group_members m ON m.group_id = g.id
       WHERE m.customer_id = ? AND g.discount_percent > 0
       ORDER BY g.discount_percent DESC, g.name ASC LIMIT 1`
    )
    .get(customerId);
  if (!top) return { amount: 0, name: '' };
  const amount = Math.round(subtotal * (top.discount_percent / 100) * 100) / 100;
  return { amount, name: `${top.name} (${top.discount_percent}%)` };
}

const toPence = (n) => Math.round(n * 100) / 100;

// A pounds amount as whole pence: the money contract's ROUND(x * 100)
// (openspec/changes/wp-1-6-sales-in-pence/design.md Decision 6).
export const poundsToPence = (n) => Math.round(Number(n) * 100);

// An order's totals worked out in whole pence from its loaded lines: the
// lines added up, less the discount, never below 0 (design.md Decision 1).
export function documentTotalsPence(lines, discount) {
  const subtotalPence = lines.reduce((sum, line) => sum + line.lineTotalPence, 0);
  const discountPence = poundsToPence(discount);
  return { subtotalPence, discountPence, totalPence: Math.max(0, subtotalPence - discountPence) };
}

// The one amount-due calculation: createSale charges it, GET
// /api/sale-documents/:id/due shows it and the Bike ready message quotes it, so
// all three always agree. Each part is rounded to pence once and the total is
// worked from the rounded parts (never below zero).
export async function computeOrderTotals({ items, discount, customerId }) {
  const subtotal = toPence(items.reduce((sum, { unitPrice, qty }) => sum + Number(unitPrice) * qty, 0));
  const group = await resolveGroupDiscount(customerId, subtotal);
  const groupDiscount = { amount: toPence(group.amount), name: group.name };
  const flat = toPence(Number(discount) || 0);
  return { subtotal, discount: flat, groupDiscount, total: Math.max(0, toPence(subtotal - flat - groupDiscount.amount)) };
}

// The one place a request line becomes a stored line. Extracted from the three
// near-identical blocks in createSale, POST /api/sale-documents and PUT
// /api/sale-documents/:id/items, so the rules cannot drift between them.
// checkStock is true only at tender - a quote or an open order may reference
// something that is currently out of stock.
export async function loadDocumentLine(it, { checkStock }) {
  // A labour line is a typed price with an optional recorded duration. It
  // carries no product, so nothing downstream may treat it as stock.
  if (it.lineType === 'labour') {
    let name = String(it.name || '').trim();
    let unitPrice = it.unitPrice;
    let minutes = it.minutes;
    let serviceId = null;

    // Picking a saved service snapshots its name, price and duration onto the
    // line. Repricing the service later must never rewrite a past job, which
    // is why these are copied rather than read through service_id.
    if (it.serviceId !== undefined && it.serviceId !== null && it.serviceId !== '') {
      serviceId = Number(it.serviceId);
      const service = await db.prepare('SELECT * FROM workshop_services WHERE id = ? AND active = 1').get(serviceId);
      if (!service) throw new ValidationError(`Service ${serviceId} not found or inactive`);
      if (!name) name = service.name;
      // From the pence (sales in pence, step A′).
      if (unitPrice === undefined || unitPrice === null || unitPrice === '') unitPrice = service.price_pence / 100;
      if (minutes === undefined || minutes === null || minutes === '') minutes = service.minutes;
    }

    if (!name) throw new ValidationError('A labour line needs a description');
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      throw new ValidationError('A labour line needs a price of zero or more');
    }
    let mins = null;
    if (minutes !== undefined && minutes !== null && minutes !== '') {
      mins = Math.trunc(Number(minutes));
      if (!Number.isFinite(mins) || mins <= 0) {
        throw new ValidationError('Duration must be a positive number of minutes');
      }
    }
    return {
      lineType: 'labour',
      product: null,
      serviceId,
      name,
      sku: null,
      qty: 1,
      unitPrice: price,
      minutes: mins,
      lineTotal: price,
      // Pence beside pounds (sales in pence, step A). Labour's VAT rate is
      // Jack's call (#134), so none is assumed.
      unitPricePence: poundsToPence(price),
      lineTotalPence: poundsToPence(price),
      vatRateBp: null,
    };
  }

  const productId = Number(it.productId);
  const qty = Math.trunc(Number(it.qty));
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    throw new ValidationError('Each item needs a valid productId and positive qty');
  }
  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
  if (!product) throw new ValidationError(`Product ${productId} not found or inactive`);
  if (checkStock && product.stock_qty < qty) {
    throw new ValidationError(`Not enough stock for "${product.name}" (have ${product.stock_qty}, need ${qty})`);
  }
  let unitPrice = product.price;
  if (it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== '') {
    const overridden = Number(it.unitPrice);
    if (!Number.isFinite(overridden) || overridden < 0) {
      throw new ValidationError(`Invalid price for "${product.name}"`);
    }
    unitPrice = overridden;
  }
  return {
    lineType: 'product',
    product,
    serviceId: null,
    name: product.name,
    sku: product.sku,
    qty,
    unitPrice,
    minutes: null,
    lineTotal: unitPrice * qty,
    // The line's pence is its rounded unit price times the quantity, so a
    // line never carries a fraction of a penny.
    unitPricePence: poundsToPence(unitPrice),
    lineTotalPence: poundsToPence(unitPrice) * qty,
    vatRateBp: product.vat_rate_bp,
  };
}

// Validates items against live stock, inserts the sale + sale_items, and
// deducts stock. Shared by direct checkout and quote/order -> sale conversion.
//
// `deferShopifyPushesTo`, if given an array, makes this function record the
// {product, newQty} pairs onto it instead of firing pushInventoryLevel
// itself - the caller is then responsible for firing them once it is safe to
// (see the comment above the shopifyPushes collection below, and the HTTP
// route handlers that pass this in). Left undefined, the old inline
// behaviour runs unchanged, which is what every direct createSale() caller
// that doesn't care about pool-connection lifetime (tests, the Shopify
// webhook handlers) keeps getting for free.
export async function createSale({ customerId, cashierId, items, discount, cashAmount, cardAmount, cashTendered, payments, note, sellPastStock = false }, { deferShopifyPushesTo } = {}) {
  // sellPastStock: the new till sells past zero stock and says so on the
  // line (journey 11 decision 5); everything else still refuses.
  const loaded = [];
  for (const it of items) {
    loaded.push(await loadDocumentLine(it, { checkStock: !sellPastStock }));
  }

  const { subtotal, discount: flatDiscount, groupDiscount, total } = await computeOrderTotals({ items: loaded, discount, customerId });

  const cash = Math.max(0, Number(cashAmount) || 0);
  const card = Math.max(0, Number(cardAmount) || 0);
  const extraPayments = (Array.isArray(payments) ? payments : [])
    .map((p) => ({ tenderType: String(p.tenderType || '').trim(), amount: Math.max(0, Number(p.amount) || 0) }))
    .filter((p) => p.tenderType && p.amount > 0);
  const extraTotal = extraPayments.reduce((sum, p) => sum + p.amount, 0);
  if (Math.abs(cash + card + extraTotal - total) > 0.01) {
    throw new ValidationError('Payment amounts must add up to the total');
  }
  const methodsUsed = [];
  if (cash > 0) methodsUsed.push('Cash');
  if (card > 0) methodsUsed.push('Card');
  for (const p of extraPayments) methodsUsed.push(p.tenderType);
  const paymentMethod = methodsUsed.length > 1 ? 'Split' : methodsUsed[0] || 'Cash';

  // Shopify inventory pushes for items with a mapped inventory_item_id are
  // collected here and only fired AFTER the transaction commits (see below) -
  // pushInventoryLevel makes an HTTP call with up to 3 retries and backoff,
  // and firing it while the transaction is still open would hold this sale's
  // row locks and tie up a pool connection (10 max) for however long that
  // HTTP round-trip takes. A rollback would also have discarded any
  // sync_error status write a failed push made, hiding the failure.
  const shopifyPushes = [];

  await db.exec('BEGIN');
  try {
    // Product rows are locked in id order up front, so two sales with the same
    // products in a different order wait for each other instead of deadlocking.
    // NO KEY UPDATE, not UPDATE: a foreign-key check on a product (an order line
    // or an offline till's sync saved at the same moment) takes KEY SHARE, which
    // FOR UPDATE would wait on, and lines saved in another order could then
    // deadlock with this sale (Jack's check, 21 Oct).
    const productIds = [...new Set(loaded.filter((l) => l.product).map((l) => l.product.id))].sort((a, b) => a - b);
    if (productIds.length) {
      await db.prepare(`SELECT id FROM products WHERE id IN (${productIds.map(() => '?').join(', ')}) ORDER BY id FOR NO KEY UPDATE`).all(...productIds);
    }
    const saleInfo = await db
      .prepare(
        `INSERT INTO sales (customer_id, cashier_id, subtotal, discount, total, payment_method, cash_amount, card_amount, cash_tendered, note, group_discount_amount, group_discount_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(customerId, cashierId, subtotal, flatDiscount, total, paymentMethod, cash, card, cashTendered, note, groupDiscount.amount, groupDiscount.name);
    const saleId = saleInfo.lastInsertRowid;

    for (const p of extraPayments) {
      await db.prepare('INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, ?, ?)').run(
        saleId,
        p.tenderType,
        p.amount
      );
    }

    for (const line of loaded) {
      await db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, name, sku, unit_price, qty, line_total, line_type, service_id, minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        saleId,
        line.product ? line.product.id : null,
        line.name,
        line.sku,
        line.unitPrice,
        line.qty,
        line.lineTotal,
        line.lineType,
        line.serviceId,
        line.minutes
      );

      // Labour is not stock. stock_movements.product_id is NOT NULL, so a
      // labour line reaching this block is a constraint violation, not a
      // cosmetic bug.
      if (line.lineType === 'product') {
        // Counted down from what the row holds now, in one statement: the
        // quantity loadDocumentLine read earlier may be out of date by now, and
        // writing "that minus qty" back lost a sale when two tills sold at once.
        // The stock check repeats here for the same reason; the row lock makes a
        // second till wait, then see what the first left.
        const updated = await db.prepare(
          `UPDATE products SET stock_qty = stock_qty - ?, updated_at = ?
            WHERE id = ? AND (? OR stock_qty >= ?) RETURNING stock_qty`
        ).get(line.qty, nowIso(), line.product.id, sellPastStock, line.qty);
        if (!updated) {
          throw new ValidationError(`Not enough stock for "${line.product.name}" (need ${line.qty})`);
        }
        const newQty = updated.stock_qty;
        await db.prepare(
          `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'sale', ?)`
        ).run(line.product.id, -line.qty, `Sale #${saleId}`);
        if (line.product.shopify_inventory_item_id) {
          shopifyPushes.push({ product: line.product, newQty });
        }
      }
    }
    await db.exec('COMMIT');

    if (deferShopifyPushesTo) {
      // The caller (an HTTP route handler releasing its pooled client before
      // firing these - see the dispatcher's afterRelease handling in server.js)
      // owns firing these now. `product` is the row this function already
      // read earlier in the request, captured in the closure - nothing here
      // depends on the database client remaining checked out.
      deferShopifyPushesTo.push(...shopifyPushes);
      if (shopifyPushes.length && !deferShopifyPushesTo._pendingPushSettle) {
        // Registered at QUEUE time, right after COMMIT - see
        // registerPendingShopifyPushSlot's comment. The whole point is for
        // gracefulShutdown's drain to see this sale's push as pending from
        // this line onward, well before the HTTP response is sent or
        // firePendingShopifyPushes ever runs.
        deferShopifyPushesTo._pendingPushSettle = registerPendingShopifyPushSlot();
      }
    } else {
      for (const { product, newQty } of shopifyPushes) {
        // Never let a Shopify hiccup fail a real till sale - log and move on.
        await pushInventoryLevel(product, newQty).catch((err) => console.error('Shopify inventory push failed', err));
      }
    }
    return saleId;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}
