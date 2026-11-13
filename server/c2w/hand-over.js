// Handing a Cycle to Work bike over at the till (openspec/changes/cycle-to-work
// design 5; drawings cw-hand-over and till-c2w-* in c2w.mjs and till.mjs).
//
// POST /api/sales with `c2wOrderId` sells the order: the server, inside the
// sale's transaction and with the order row locked, puts the order's bike and
// accessories on the sale at their quoted prices, ahead of anything added at the
// counter, and adds the provider's share as its own payment, as it adds a deposit
// paid online (DEPOSIT_TENDER). The till never decides that share: a sale that
// claims a different one is refused, and the order stays ready.
import { prepare } from '../db.js';
import { ValidationError } from '../lib/http.js';
import { computeOrderTotals, loadDocumentLine, poundsToPence } from '../lib/sales.js';
import { oldestSite } from '../lib/stock.js';
import { bikeSoldTo } from '../lib/bike-warranty.js';
import { ORDER_SELECT, NOT_HELD, Refused, WRONG_STAGE, addDays, addEvent, providerPays, quoteItems, shopDay } from './orders.js';

// The payment's kind: "Cycle to Work · [Provider]" (till-c2w-pay). Like every
// payment that isn't cash, close the day leaves it out of the drawer.
export const C2W_TENDER = 'Cycle to Work · ';
export const SHARE_REFUSED = {
  error: 'The Cycle to Work payment doesn’t match what the provider pays for this order. Refresh to see the order as it is now.',
  code: 'c2w_share',
};

const BIKE_TWICE = {
  error: 'The bike is already on this sale from the Cycle to Work order. Take it off the counter’s lines.',
  code: 'c2w_bike_twice',
};

// However it is written, so a differently capitalised one can't slip onto another sale.
const isC2w = (p) => String(p?.tenderType ?? '').trim().toLowerCase().startsWith(C2W_TENDER.toLowerCase());
/** Whether a sale's payments claim a Cycle to Work share (only a hand-over may). */
export const claimsC2w = (payments) => (Array.isArray(payments) ? payments : []).some(isC2w);

/** The order id a sale names, or throws for one that isn't a whole number. */
export function readOrderId(raw) {
  if (!Number.isInteger(raw) || raw < 1) throw new ValidationError('The Cycle to Work order must be a number');
  return raw;
}

// The checks ticked at hand-over (cw-hand-over): each one of the provider's own
// lines from Settings, which go in the order's history. None ticked is allowed.
function readChecks(raw, note) {
  if (raw === undefined || raw === null) return [];
  const lines = note.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!Array.isArray(raw) || raw.some((c) => typeof c !== 'string' || !lines.includes(c.trim()))) {
    throw new ValidationError('The ticked checks must be the provider’s checks from Settings');
  }
  return [...new Set(raw.map((c) => c.trim()))];
}

// What the provider is expected to pay: its share less its commission (pence
// when in pounds, hundredths of a percent when a percentage; none until filled in).
function expectedPence(sharePence, terms) {
  if (terms.commission_value === null) return sharePence;
  const commission = terms.commission_kind === 'pounds'
    ? terms.commission_value
    : Math.round((sharePence * terms.commission_value) / 10000);
  return Math.max(0, sharePence - commission);
}

/**
 * Before the sale, in its transaction: locks the order, checks it is at Ready to
 * collect, and returns the sale's customer, lines and payments, with `finish`
 * to run once the sale is made. Throws Refused (404, 409 wrong_stage, 400
 * c2w_share, 409 c2w_other_site) or ValidationError, with nothing changed.
 * `tillSite` is the till's own site (null when it has none set).
 */
export async function startHandOver(orderId, { items, payments, discount, checks, tillSite = null }) {
  const locked = await prepare('SELECT id, stage FROM c2w_orders WHERE id = ? FOR UPDATE').get(orderId);
  if (!locked) throw new Refused(404, { error: 'Not found' });
  if (locked.stage !== 'ready') throw new Refused(409, WRONG_STAGE);
  const row = await prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(orderId);
  const terms = await prepare('SELECT commission_kind, commission_value, pays_in_days, handover_note FROM c2w_providers WHERE id = ?').get(row.provider_id);
  const ticked = readChecks(checks, terms.handover_note);

  // The bike leaves stock at the till's site, so it is handed over at the shop
  // that holds it (default taken overnight 12 Nov; Jack can overrule).
  const heldAt = row.site_id ?? (row.frame_id ? (await prepare('SELECT site_id FROM stock_frames WHERE id = ?').get(row.frame_id))?.site_id ?? null : null);
  if (heldAt !== null && heldAt !== (tillSite ?? await oldestSite())) {
    const site = row.site_name ?? (await prepare('SELECT name FROM sites WHERE id = ?').get(heldAt))?.name ?? 'another shop';
    throw new Refused(409, { error: `${row.bike_name ?? 'The bike'} is held at ${site}. Hand it over at that shop’s till.`, code: 'c2w_other_site' });
  }

  // The order's lines first, at the prices quoted, then the counter's. The
  // order already carries its bike, so the counter can't add it again (review, 13 Nov).
  if (items.some((it) => Number(it?.productId) === row.product_id)) throw new Refused(400, BIKE_TWICE);
  const lines = [...quoteItems(row).map((it) => ({ productId: it.productId, qty: 1, unitPrice: it.pricePence / 100 })), ...items];
  const loaded = [];
  for (const it of lines) loaded.push(await loadDocumentLine(it, { checkStock: false }));
  // The provider pays up to the certificate, and never more than the order's
  // part of the sale comes to: a discount (or the customer's group discount) can
  // bring it lower, and what the customer adds at the counter is theirs to pay.
  const { total } = await computeOrderTotals({ items: loaded, discount, customerId: row.customer_id });
  const counterPence = loaded.slice(lines.length - items.length).reduce((sum, l) => sum + l.lineTotalPence, 0);
  const sharePence = Math.max(0, Math.min(providerPays(row), poundsToPence(total) - counterPence));
  const tender = `${C2W_TENDER}${row.provider_name}`;
  const claimed = payments.filter(isC2w);
  if (claimed.length > 1 || claimed.some((p) => String(p.tenderType).trim() !== tender || poundsToPence(p.amount) !== sharePence)) {
    throw new Refused(400, SHARE_REFUSED);
  }
  const rest = payments.filter((p) => !isC2w(p));

  async function finish(saleId, cashierId) {
    const today = await shopDay();
    // The bike held for the order is sold onto the customer's bike record.
    if (row.frame_id) {
      const frame = await prepare('SELECT state, c2w_order_id FROM stock_frames WHERE id = ? FOR UPDATE').get(row.frame_id);
      if (!frame || frame.state !== 'held' || frame.c2w_order_id !== orderId) throw new Refused(409, NOT_HELD);
      const sold = await bikeSoldTo(row.customer_id, row.frame_id, today);
      if (sold.error) throw new Refused(409, NOT_HELD);
    }
    await prepare("UPDATE c2w_orders SET stage = 'collected', sale_id = ?, collected_at = now(), expected_pence = ?, expected_by = ? WHERE id = ?")
      .run(saleId, expectedPence(sharePence, terms), terms.pays_in_days === null ? null : addDays(today, terms.pays_in_days), orderId);
    const cashier = await prepare('SELECT name FROM employees WHERE id = ?').get(cashierId);
    await addEvent(orderId, 'collected', { employeeId: cashierId, name: cashier?.name ?? null }, { detail: { saleId, providerPence: sharePence, checks: ticked } });
  }

  return {
    customerId: row.customer_id,
    items: lines,
    payments: sharePence > 0 ? [...rest, { tenderType: tender, amount: sharePence / 100 }] : rest,
    finish,
  };
}
