// What the customer sees of their Cycle to Work order (cw-customer-view,
// -released, -cancelled; ac-account-c2w, -collected; openspec/changes/cycle-to-work
// design 8): built from a list of allowed fields, so no commission, cost, frame,
// supplier or staff name ever reaches the customer. Read through the order's
// private link (its code) or the signed-in customer's own account.
// Inside the shop's runWithShop, so another shop's order is never found.
import { prepare } from '../db.js';
import { ORDER_SELECT, quoteRef, providerPays } from './orders.js';

export const CODE_SHAPE = /^[0-9a-f]{64}$/;
// The customer's link to their order (the messages' "See your Cycle to Work bike: [link]").
export const c2wLinkPath = (shopSlug, code) => `/book/${shopSlug}/cycle-to-work/${code}`;

// The stages the customer sees: the staff's six without "Paid by the provider",
// which is between the shop and the provider (cw-customer-view shows five).
export const CUSTOMER_STAGES = ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected'];
const STAGE_AT = { quote: 0, waiting: 1, certificate: 2, ready: 3, collected: 4, paid: 4 };
const LIVE = ['quote', 'waiting', 'certificate'];

const LIVE_CUSTOMER = 'c.active = 1 AND c.deleted_at IS NULL AND c.merged_into_id IS NULL';

// A shop with one site is just its name; with several, the site says which shop.
async function shopPlace(siteId) {
  const sites = await prepare('SELECT id, name FROM sites ORDER BY id').all();
  if (sites.length < 2) return null;
  return sites.find((s) => s.id === siteId)?.name ?? null;
}

/** The allowed fields of one order, for the customer. */
export async function customerView(r, shopName) {
  const settings = await prepare('SELECT how_to_apply FROM c2w_settings LIMIT 1').get();
  const cancelled = r.stage === 'cancelled';
  // Before the certificate's bike is ready, the bike is put aside, or was and isn't
  // any more; nothing is said of a bike that was never held (one being ordered in).
  const live = LIVE.includes(r.stage);
  const state = cancelled ? 'cancelled'
    : live && r.held_at ? 'held'
      : live && r.released_at ? 'released' : null;
  return {
    quoteRef: quoteRef(r.quote_number),
    shopName,
    place: await shopPlace(r.site_id),
    providerName: r.provider_name,
    stage: r.stage,
    stageIndex: STAGE_AT[r.stage] ?? null,
    stages: CUSTOMER_STAGES,
    state,
    holdUntil: state === 'held' ? r.hold_until_day : null,
    bike: r.bike_name,
    accessories: r.accessories.map((a) => a.name),
    totalPence: r.total_pence,
    customerPaysPence: r.certificate_pence === null ? null : r.total_pence - providerPays(r),
    collectedAt: r.collected_at ? new Date(r.collected_at).toISOString() : null,
    saleId: r.sale_id ?? null,
    howToApply: cancelled ? null : (settings?.how_to_apply || null),
  };
}

/** The order a link's code opens, while its customer is still a live record here; null otherwise. */
export async function orderByCode(code) {
  if (typeof code !== 'string' || !CODE_SHAPE.test(code)) return null;
  return prepare(`${ORDER_SELECT} WHERE o.customer_code = ? AND ${LIVE_CUSTOMER}`).get(code);
}

/** The signed-in customer's own orders, newest first. */
export async function ordersOfCustomer(customerId) {
  return prepare(`${ORDER_SELECT} WHERE o.customer_id = ? AND ${LIVE_CUSTOMER} ORDER BY o.quote_given_at DESC, o.id DESC`).all(customerId);
}
