// Sales and the quotes and orders that become them: /api/sales and
// /api/sale-documents (convert included). Staff routes: they run under the
// dispatcher's /api/ branch (server.js), so a handler gets (req, res, params,
// query, afterRelease, shopId) with the shop's row-level security already
// bound, and needs a staff session. Mark's file. The shared sale helpers are
// in server/lib/sales.js; the Shopify webhooks stay in server.js, where the
// dispatcher calls them. Moved out of server.js unchanged (split plan §4.1,
// WP-0.4).
import { prepare, dbExec } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import {
  serializeSale, SALE_SELECT, resolveCashierId, loadDocumentLine, createSale, firePendingShopifyPushes, shopDayWindow, computeOrderTotals,
  poundsToPence, documentTotalsPence,
} from '../lib/sales.js';
import { currentShopToday } from '../workshop/jobs.js';
import { work } from '../workshop/state-machines.js';
import { applyEvent } from '../workshop/transitions.js';
import { signOffMechanic, recordSignOff } from '../workshop/sign-off.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// ---------- Quotes & orders (sale documents) ----------
// Both share one shape: a not-yet-completed set of items for a customer that
// can later be turned into a real sale via the /convert endpoint. "Quotes"
// are a price estimate the customer hasn't committed to; "orders" are items
// (often out of stock) the customer has committed to but not paid/collected
// yet. Neither affects stock until converted.

function serializeSaleDocument(row, items) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title || '',
    customerId: row.customer_id,
    customerName: row.customer_name !== undefined ? row.customer_name : undefined,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name !== undefined ? row.cashier_name : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    subtotalPence: row.subtotal_pence,
    discountPence: row.discount_pence,
    totalPence: row.total_pence,
    paidPence: row.paid_pence,
    note: row.note,
    convertedSaleId: row.converted_sale_id,
    workshopJobId: row.workshop_job_id,
    items: items
      ? items.map((it) => ({
          id: it.id,
          productId: it.product_id,
          name: it.name,
          sku: it.sku,
          unitPrice: it.unit_price,
          qty: it.qty,
          lineTotal: it.line_total,
          unitPricePence: it.unit_price_pence,
          lineTotalPence: it.line_total_pence,
          vatRateBp: it.vat_rate_bp,
          lineType: it.line_type,
          serviceId: it.service_id,
          minutes: it.minutes,
        }))
      : undefined,
  };
}

const DOC_SELECT = `SELECT d.*, c.name AS customer_name, ca.name AS cashier_name FROM sale_documents d LEFT JOIN customers c ON c.id = d.customer_id LEFT JOIN employees ca ON ca.id = d.cashier_id`;
const DOC_KINDS = ['quote', 'order'];

// Writes one loaded line in pence and, worked out from it, in pounds, in the
// same statement (sales in pence, step A; design.md Decision 2: pence is the
// authority, the pounds stay for the old app).
async function insertDocumentLine(docId, line) {
  await db.prepare(
    `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total, line_type, service_id, minutes,
                                      unit_price_pence, line_total_pence, vat_rate_bp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    docId,
    line.product ? line.product.id : null,
    line.name,
    line.sku,
    line.unitPricePence / 100,
    line.qty,
    line.lineTotalPence / 100,
    line.lineType,
    line.serviceId,
    line.minutes,
    line.unitPricePence,
    line.lineTotalPence,
    line.vatRateBp
  );
}

export function register(route) {
  // ---------- Sales ----------

  route('GET', '/api/sales', async (req, res, params, query) => {
    const dateFilter = query.get('date'); // 'today' or 'YYYY-MM-DD'
    const customerId = query.get('customerId');
    const cashierId = query.get('cashierId');
    let sql = SALE_SELECT + ' WHERE 1=1';
    const args = [];
    let dateStr = null;
    if (dateFilter === 'today') dateStr = await currentShopToday();
    else if (dateFilter) dateStr = dateFilter;
    if (dateStr) {
      const day = await shopDayWindow('s.created_at', dateStr);
      sql += ` AND ${day.sql}`;
      args.push(...day.args);
    }
    if (customerId) {
      sql += ' AND s.customer_id = ?';
      args.push(Number(customerId));
    }
    if (cashierId) {
      sql += ' AND s.cashier_id = ?';
      args.push(Number(cashierId));
    }
    sql += ' ORDER BY s.id DESC LIMIT 500';
    const rows = await db.prepare(sql).all(...args);
    sendJson(
      res,
      200,
      rows.map((r) => serializeSale(r))
    );
  });

  route('GET', '/api/sales/:id', async (req, res, params) => {
    const id = Number(params.id);
    const sale = await db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(id);
    if (!sale) return notFound(res, 'Sale not found');
    const items = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    const payments = await db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(id);
    sendJson(res, 200, serializeSale(sale, items, payments));
  });

  route('POST', '/api/sales', async (req, res, params, searchParams, afterRelease, shopId) => {
    const body = await readJsonBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return badRequest(res, 'Sale must include at least one item');
    const cashAmount = Math.max(0, Number(body.cashAmount) || 0);
    const cardAmount = Math.max(0, Number(body.cardAmount) || 0);
    const payments = Array.isArray(body.payments) ? body.payments : [];
    const discount = Math.max(0, Number(body.discount) || 0);
    const cashTendered = body.cashTendered !== undefined && body.cashTendered !== null && body.cashTendered !== ''
      ? Number(body.cashTendered)
      : null;
    const note = (body.note || '').trim();

    let customerId = null;
    if (body.customerId !== undefined && body.customerId !== null && body.customerId !== '') {
      customerId = Number(body.customerId);
      const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
      if (!customer) return badRequest(res, 'Customer not found or inactive');
    }

    const cashierResolved = await resolveCashierId(body.cashierId);
    if (!cashierResolved.ok) return badRequest(res, 'Staff member not found or inactive');
    if (cashierResolved.cashierId === null) return badRequest(res, 'Select a staff member before completing the sale');

    let saleId;
    const shopifyPushes = [];
    try {
      saleId = await createSale(
        { customerId, cashierId: cashierResolved.cashierId, items, discount, cashAmount, cardAmount, cashTendered, payments, note, sellPastStock: body.sellPastStock === true },
        { deferShopifyPushesTo: shopifyPushes }
      );
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }

    const sale = await db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(saleId);
    const savedItems = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    const savedPayments = await db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId);
    sendJson(res, 201, serializeSale(sale, savedItems, savedPayments));
    if (afterRelease && shopifyPushes.length) {
      afterRelease.push(() => firePendingShopifyPushes(shopId, shopifyPushes));
    }
  });

  route('GET', '/api/sale-documents', async (req, res, params, query) => {
    const kind = query.get('kind');
    if (!DOC_KINDS.includes(kind)) return badRequest(res, 'A valid "kind" query param (quote or order) is required');
    const status = query.get('status');
    let sql = DOC_SELECT + ' WHERE d.kind = ?';
    const args = [kind];
    if (status) {
      sql += ' AND d.status = ?';
      args.push(status);
    }
    sql += ' ORDER BY d.id DESC LIMIT 500';
    const rows = await db.prepare(sql).all(...args);
    sendJson(res, 200, rows.map((r) => serializeSaleDocument(r)));
  });

  route('GET', '/api/sale-documents/:id', async (req, res, params) => {
    const id = Number(params.id);
    const row = await db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
    if (!row) return notFound(res, 'Not found');
    const items = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
    sendJson(res, 200, serializeSaleDocument(row, items));
  });

  route('POST', '/api/sale-documents', async (req, res) => {
    const body = await readJsonBody(req);
    const kind = body.kind;
    if (!DOC_KINDS.includes(kind)) return badRequest(res, 'kind must be "quote" or "order"');
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return badRequest(res, `A ${kind} must include at least one item`);
    const discount = Math.max(0, Number(body.discount) || 0);
    const note = (body.note || '').trim();
    const title = (body.title || '').trim();

    let customerId = null;
    if (body.customerId !== undefined && body.customerId !== null && body.customerId !== '') {
      customerId = Number(body.customerId);
      const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
      if (!customer) return badRequest(res, 'Customer not found or inactive');
    }

    const cashierResolved = await resolveCashierId(body.cashierId);
    if (!cashierResolved.ok) return badRequest(res, 'Staff member not found or inactive');

    // Snapshot product name/sku/price only - no stock check, since a quote or
    // order can reference items that are currently out of stock.
    const loaded = [];
    for (const it of items) {
      try {
        loaded.push(await loadDocumentLine(it, { checkStock: false }));
      } catch (err) {
        if (err instanceof ValidationError) return badRequest(res, err.message);
        throw err;
      }
    }

    const { subtotalPence, discountPence, totalPence } = documentTotalsPence(loaded, discount);

    await db.exec('BEGIN');
    try {
      const info = await db
        .prepare(
          `INSERT INTO sale_documents (kind, customer_id, cashier_id, subtotal, discount, total, note, title, updated_at,
                                       subtotal_pence, discount_pence, total_pence)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(kind, customerId, cashierResolved.cashierId, subtotalPence / 100, discountPence / 100, totalPence / 100, note, title, nowIso(),
          subtotalPence, discountPence, totalPence);
      const docId = info.lastInsertRowid;
      for (const line of loaded) await insertDocumentLine(docId, line);
      await db.exec('COMMIT');
      const row = await db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(docId);
      const savedItems = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(docId);
      sendJson(res, 201, serializeSaleDocument(row, savedItems));
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  });

  route('PUT', '/api/sale-documents/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Not found');
    if (existing.status !== 'open') return badRequest(res, `This ${existing.kind} is already ${existing.status}`);
    const body = await readJsonBody(req);
    const status = body.status !== undefined ? String(body.status) : existing.status;
    if (!['open', 'cancelled'].includes(status)) return badRequest(res, 'Invalid status');

    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    const note = body.note !== undefined ? String(body.note).trim() : existing.note;

    let customerId = existing.customer_id;
    if (body.customerId !== undefined) {
      if (body.customerId === null || body.customerId === '') {
        customerId = null;
      } else {
        customerId = Number(body.customerId);
        const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
        if (!customer) return badRequest(res, 'Customer not found or inactive');
      }
    }

    let workshopJobId = existing.workshop_job_id;
    if (body.workshopJobId !== undefined) {
      if (body.workshopJobId === null) {
        workshopJobId = null;
      } else {
        const jobId = Number(body.workshopJobId);
        const job = await db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
        if (!job) return badRequest(res, 'Workshop job not found');
        workshopJobId = jobId;
      }
    }

    await db.prepare(
      'UPDATE sale_documents SET status = ?, title = ?, customer_id = ?, note = ?, workshop_job_id = ?, updated_at = ? WHERE id = ?'
    ).run(status, title, customerId, note, workshopJobId, nowIso(), id);
    const row = await db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
    const items = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
    sendJson(res, 200, serializeSaleDocument(row, items));
  });

  // Replaces the full item list on an existing quote/order (e.g. adding parts
  // to the placeholder order behind a workshop job). Items snapshot product
  // name/sku/price like creation does - no stock check, same reasoning as
  // POST /api/sale-documents.
  route('PUT', '/api/sale-documents/:id/items', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Not found');
    if (existing.status !== 'open') return badRequest(res, `This ${existing.kind} is already ${existing.status}`);
    const body = await readJsonBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    const discount = Math.max(0, Number(body.discount) || 0);

    const loaded = [];
    for (const it of items) {
      try {
        loaded.push(await loadDocumentLine(it, { checkStock: false }));
      } catch (err) {
        if (err instanceof ValidationError) return badRequest(res, err.message);
        throw err;
      }
    }

    const { subtotalPence, discountPence, totalPence } = documentTotalsPence(loaded, discount);

    await db.exec('BEGIN');
    try {
      await db.prepare('DELETE FROM sale_document_items WHERE document_id = ?').run(id);
      for (const line of loaded) await insertDocumentLine(id, line);
      await db.prepare(
        `UPDATE sale_documents SET subtotal = ?, discount = ?, total = ?, subtotal_pence = ?, discount_pence = ?, total_pence = ?, updated_at = ?
         WHERE id = ?`
      ).run(subtotalPence / 100, discountPence / 100, totalPence / 100, subtotalPence, discountPence, totalPence, nowIso(), id);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }

    const row = await db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
    const savedItems = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
    sendJson(res, 200, serializeSaleDocument(row, savedItems));
  });

  // What paying an order takes now (Jack, 18 Oct, docs/decisions/2026-10-18-till-job-payment.md):
  // the till asks before the card machine is keyed, since the order's own
  // discount and the customer's group discount come off here, as in createSale.
  // Also each part's stock, so the till can say "sold anyway".
  route('GET', '/api/sale-documents/:id/due', async (req, res, params) => {
    const id = Number(params.id);
    const doc = await db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
    if (!doc) return notFound(res, 'Not found');
    // Nothing is due on an order already paid or cancelled (the wording convert uses).
    if (doc.status !== 'open') return badRequest(res, `This ${doc.kind} is already ${doc.status}`);
    const items = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
    // Paying re-checks every line (a retired service or product is refused),
    // so the same check here keeps the till from taking a card payment for a
    // sale the server would then refuse.
    for (const it of items) {
      try {
        await loadDocumentLine({
          lineType: it.line_type, productId: it.product_id, qty: it.qty, unitPrice: it.unit_price,
          name: it.name, serviceId: it.service_id, minutes: it.minutes,
        }, { checkStock: false });
      } catch (err) {
        if (err instanceof ValidationError) return badRequest(res, err.message);
        throw err;
      }
    }
    const { subtotal, discount, groupDiscount: group, total } = await computeOrderTotals({
      items: items.map((it) => ({ unitPrice: it.unit_price, qty: it.qty })), discount: doc.discount, customerId: doc.customer_id,
    });
    const stock = {};
    for (const it of items) {
      if (!it.product_id) continue;
      const product = await db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(it.product_id);
      if (product) stock[it.product_id] = product.stock_qty;
    }
    sendJson(res, 200, {
      subtotal, discount, groupDiscount: group.amount, groupName: group.name, total, stock,
      subtotalPence: poundsToPence(subtotal),
      discountPence: poundsToPence(discount),
      groupDiscountPence: poundsToPence(group.amount),
      totalPence: poundsToPence(total),
    });
  });

  // Paying an order. The order's row is locked first and held until the sale and
  // the order's new status commit together, so a second tap, or a second till,
  // waits and then finds the order already converted: one order, one payment.
  // (Found in the 21 Oct review: the check, the sale and the status write were
  // separate, so two quick requests both paid.) createSale's own BEGIN becomes a
  // savepoint inside this transaction. The reply is sent from afterRelease, which
  // the dispatcher runs once runWithShop has committed (with DB_TENANT_SCOPE=
  // transaction that is a later commit than this one), so nobody is told "paid"
  // about a payment that can still roll back. The job's row is deliberately not
  // locked here: a reopen during payment is a decided case (the sale stands and
  // the reply warns; docs/decisions/2026-10-08-paying-for-finished-work.md).
  route('POST', '/api/sale-documents/:id/convert', async (req, res, params, searchParams, afterRelease, shopId) => {
    await db.exec('BEGIN');
    let reply;
    try {
      await db.prepare('SELECT id FROM sale_documents WHERE id = ? FOR UPDATE').get(Number(params.id));
      reply = await convertOrder(req, res, params);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      throw err;
    }
    if (!reply) return;
    afterRelease.push(() => sendJson(res, 201, reply.payload));
    if (reply.shopifyPushes.length) {
      afterRelease.push(() => firePendingShopifyPushes(shopId, reply.shopifyPushes));
    }
  });

  // Answers a refusal straight away (nothing was written, so nothing to wait
  // for) and otherwise returns {payload, shopifyPushes} for the route to send
  // once the payment has committed.
  async function convertOrder(req, res, params) {
    const id = Number(params.id);
    const doc = await db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
    if (!doc) return notFound(res, 'Not found');
    if (doc.status !== 'open') return badRequest(res, `This ${doc.kind} is already ${doc.status}`);

    // Tendering the order for a job is the shop saying the work is done, so the
    // work must already be finished or be a legal 'finish' on the work machine
    // (Jack, 8 Oct, docs/decisions/2026-10-08-paying-for-finished-work.md). If
    // it is neither, the tender is refused (Jack's decision, 20 Sep, reaffirmed
    // after a day on the other behaviour): the job record governs, and the shop
    // marks the job's real state before taking the money.
    //
    // Note the breadth. 'finish' is legal only from in_progress, so this refuses a
    // job that never started AND one that is on hold or waiting for parts. The
    // shop's way through is to move the job to where it actually is first -
    // resume, or parts-arrived - which is the point: the refusal is telling them
    // the record disagrees with what they are about to do.
    //
    // Checked HERE, before the sale is created. Refusing further down would leave
    // a real sale on the books and the job untouched, which is worse than either
    // outcome.
    let jobToFinish = null;
    let jobAlreadyFinished = null;
    if (doc.workshop_job_id) {
      jobToFinish = await db.prepare('SELECT id, work_state, version FROM workshop_jobs WHERE id = ?')
        .get(doc.workshop_job_id);
      // Work already finished ("Mark ready for collection") already says the
      // work is done, which is what the decision asks of the record: the
      // customer pays and the job is left as it is (Jack, 8 Oct). It is checked
      // again after the sale, below, in case someone reopens it in between.
      if (jobToFinish && jobToFinish.work_state === 'complete') {
        jobAlreadyFinished = jobToFinish;
        jobToFinish = null;
      }
      if (jobToFinish && !work.can(jobToFinish.work_state, 'finish')) {
        return sendJson(res, 409, {
          error: `cannot finish a job that is ${jobToFinish.work_state}; from here you can ${work.events(jobToFinish.work_state).join(', ') || 'do nothing'}`,
          code: 'illegal',
        });
      }
    }

    const body = await readJsonBody(req);
    // A workshop job is paid at the till, which always answers who signed the
    // work off (null when it didn't ask). A payment with no answer comes only
    // from the old app, which never takes a job's payment (Jack, 21 Oct,
    // docs/decisions/2026-10-21-old-app-placeholder.md; working agreement 3.11).
    if (doc.workshop_job_id && body.signedOffBy === undefined) {
      return sendJson(res, 400, { error: 'Take payment for a workshop job at the till, where it asks who signed the work off.', code: 'use_till' });
    }
    const cashAmount = Math.max(0, Number(body.cashAmount) || 0);
    const cardAmount = Math.max(0, Number(body.cardAmount) || 0);
    const payments = Array.isArray(body.payments) ? body.payments : [];
    const cashTendered =
      body.cashTendered !== undefined && body.cashTendered !== null && body.cashTendered !== ''
        ? Number(body.cashTendered)
        : null;

    const cashierResolved = await resolveCashierId(body.cashierId);
    if (!cashierResolved.ok) return badRequest(res, 'Staff member not found or inactive');
    if (cashierResolved.cashierId === null) return badRequest(res, 'Select a staff member before completing the sale');

    const items = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
    // An order with nothing on it is not a sale. A job's order is the exception:
    // work given free is finished by taking £0 for it (the work-action tests do).
    if (items.length === 0 && !doc.workshop_job_id) return badRequest(res, 'There is nothing on this order to pay for');
    // A stored labour line has product_id NULL. Dropping line_type here (as a
    // bare {productId, qty, unitPrice} mapping used to) sends it into
    // loadDocumentLine looking like an incomplete product line, which rejects
    // it - a job with labour on its order could never be converted into a
    // sale. Carry the fields loadDocumentLine actually branches on, for both
    // line types, so a labour line survives the round trip.
    const saleItems = items.map((it) => ({
      lineType: it.line_type,
      productId: it.product_id,
      qty: it.qty,
      unitPrice: it.unit_price,
      name: it.name,
      serviceId: it.service_id,
      minutes: it.minutes,
    }));

    let saleId;
    const shopifyPushes = [];
    try {
      saleId = await createSale(
        {
          customerId: doc.customer_id,
          cashierId: cashierResolved.cashierId,
          items: saleItems,
          discount: doc.discount,
          cashAmount,
          cardAmount,
          cashTendered,
          payments,
          // The till paying a workshop job sells past zero stock, as it does
          // any sale (journey 11 decision 5; Jack, 18 Oct).
          sellPastStock: body.sellPastStock === true,
          note: `Converted from ${doc.kind} #${doc.id}`,
        },
        { deferShopifyPushesTo: shopifyPushes }
      );
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }

    // What was paid is the sale's total, in pence, as the 055 backfill has it
    // (design.md Decisions 1 and 8: from step A, convert sets paid_pence).
    await db.prepare(
      `UPDATE sale_documents SET status = ?, converted_sale_id = ?, updated_at = ?,
              paid_pence = (SELECT ROUND(s.total * 100)::int FROM sales s WHERE s.id = ?)
       WHERE id = ?`
    ).run('converted', saleId, nowIso(), saleId, id);
    // An order tied to a workshop job (the "Show in workshop diary" link) is
    // the customer paying for and collecting that job - being tendered off is
    // the real-world signal the job itself is done, so it auto-completes here
    // rather than needing a separate manual step in the diary.
    let jobWarning = null;
    if (jobToFinish) {
      const finished = await applyEvent({
        jobId: jobToFinish.id,
        machine: work,
        event: 'finish',
        expectedVersion: jobToFinish.version,
      });
      // The pre-flight check above passed, so reaching here means someone moved
      // the job in between. The sale is already real and cannot be undone, so the
      // payment stands and the response says the job did not move - a silently
      // uncompleted job is exactly the ambiguity the state machines exist to
      // remove.
      if (!finished.ok) jobWarning = finished.message;
      // The till asks who is signing the job off before the card is taken
      // (Jack, 16 Oct, docs/decisions/2026-10-16-mechanic-sign-off.md answer 5).
      // The payment already stands, so a sign-off that is no longer valid only
      // leaves the work unsigned, and the reply says so.
      // The new till always sends the key: null means it didn't ask because the
      // work read as finished, so finishing it here means it was reopened in
      // between (answer 8: finishing again asks again). A payment with no key is
      // refused above.
      else if (body.signedOffBy === null) {
        jobWarning = 'Paid and finished, but not signed off: the work was reopened while the till was open.';
      } else if (body.signedOffBy !== undefined) {
        const signer = await signOffMechanic(body.signedOffBy);
        if (signer === null) jobWarning = 'Paid and finished, but not signed off: that mechanic isn’t active any more.';
        else {
          // A fault here must not turn a taken payment into an error (fresh review).
          try {
            await recordSignOff(jobToFinish.id, signer);
          } catch (err) {
            console.error('sign-off after payment failed', err);
            jobWarning = 'Paid and finished, but not signed off: the sign-off couldn’t be saved.';
          }
        }
      }
    }
    // The same race for work that was already finished at the check: if someone
    // reopened it before the sale was made, the record no longer says the work
    // is done (docs/decisions/2026-10-08-paying-for-finished-work.md). The sale
    // stands, the job is left where they put it, and the reply says so.
    if (jobAlreadyFinished) {
      const now = await db.prepare('SELECT work_state FROM workshop_jobs WHERE id = ?').get(jobAlreadyFinished.id);
      if (!now) jobWarning = 'Job not found';
      else if (now.work_state !== 'complete') {
        jobWarning = `This job changed while the payment went through: its work is now ${now.work_state}, not finished. The payment stands; check the job.`;
      }
    }

    const sale = await db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(saleId);
    const savedItems = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    const savedPayments = await db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId);
    const payload = serializeSale(sale, savedItems, savedPayments);
    return { payload: jobWarning ? { ...payload, jobWarning } : payload, shopifyPushes };
  }
}
