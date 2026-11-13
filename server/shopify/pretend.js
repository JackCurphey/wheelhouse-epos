// The pretend Shopify (openspec/changes/website-management design 7): it keeps
// its own records in pretend_shopify, as Shopify would on its side. A shop is
// "found" when its address looks like a Shopify one; it asks for a photo for
// the categories in needs_photo and refuses the SKUs in refuses with its own
// reason, so the tests can make each problem the drawings show. No account is
// made and nothing leaves Wheelhouse.
import { prepare } from '../db.js';

const SHOPIFY_ADDRESS = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const q = encodeURIComponent;
const page = (title, words, links) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>
<body><main><h1>${title}</h1><p>${words}</p>
${links.map(([href, label]) => `<p><a href="${href.replaceAll('&', '&amp;')}">${label}</a></p>`).join('\n')}</main></body></html>`;
const back = (state, outcome) => `/api/shopify/return?state=${q(state)}&outcome=${outcome}`;

export const pretendShopify = {
  name: 'pretend',
  connectAddress: (state) => `/api/shopify/pretend-approve?state=${q(state)}`,
  /** Shopify's page asking the Owner to approve Wheelhouse; `address` is null for an unknown trip. */
  approvePage(state, address) {
    if (address !== null && !SHOPIFY_ADDRESS.test(address)) {
      return page('Shop not found', 'The pretend Shopify has no shop at that address.', [[back(state, 'not_found'), 'Back to Wheelhouse']]);
    }
    return page('Approve Wheelhouse', 'The pretend Shopify: no account is made and nothing is sent.', [
      [back(state, 'approved'), 'Approve'],
      [back(state, 'cancelled'), 'Cancel'],
    ]);
  },
  async connectFinish(query, address) {
    if (query.get('outcome') !== 'approved' || !SHOPIFY_ADDRESS.test(address)) return { connected: false };
    await prepare('INSERT INTO pretend_shopify (address) VALUES (?) ON CONFLICT DO NOTHING RETURNING address').run(address);
    return { connected: true };
  },
  /** What is in the Shopify shop: [{ id, wheelhouseId, sku, title, pricePence, photoUrl, stock }]. */
  async listProducts(address) {
    return (await prepare('SELECT products FROM pretend_shopify WHERE address = ?').get(address))?.products ?? [];
  },
  /** Adds or updates one product, matched on Wheelhouse's id then SKU. */
  async send(address, product) {
    const shop = await prepare('SELECT needs_photo, refuses FROM pretend_shopify WHERE address = ?').get(address);
    if (!shop) return { ok: false, kind: 'shopify', reason: 'Shopify couldn’t find the shop.' };
    if (!product.photoUrl && shop.needs_photo.includes(product.category)) return { ok: false, kind: 'no_photo' };
    if (shop.refuses[product.sku]) return { ok: false, kind: 'shopify', reason: shop.refuses[product.sku] };
    const id = String(product.wheelhouseId);
    const before = (await this.listProducts(address)).some((p) => String(p.wheelhouseId) === id || (product.sku && p.sku === product.sku));
    // Shopify keeps the product without Wheelhouse's category.
    const record = { ...product };
    delete record.category;
    // One statement, so two sends at once can't lose each other's product.
    await prepare(
      `UPDATE pretend_shopify s SET products = (
         SELECT COALESCE(jsonb_agg(p ORDER BY n), '[]'::jsonb) FROM jsonb_array_elements(s.products) WITH ORDINALITY e(p, n)
          WHERE (p->>'wheelhouseId' = ? OR p->>'sku' = ?) IS NOT TRUE
       ) || jsonb_build_array(?::jsonb || jsonb_build_object('id', COALESCE(
         (SELECT p->>'id' FROM jsonb_array_elements(s.products) p WHERE p->>'wheelhouseId' = ? OR p->>'sku' = ? LIMIT 1), ?)))
       WHERE address = ? RETURNING address`
    ).run(id, product.sku, JSON.stringify(record), id, product.sku, `pretend-${id}`, address);
    // added: a product Shopify didn't have before, for the connected page's count.
    return { ok: true, added: !before };
  },
};
