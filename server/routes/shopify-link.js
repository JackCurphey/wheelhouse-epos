// Connecting the shop's own Shopify shop and sending products to it
// (openspec/changes/website-management design 7; drawings ws-shopify-*). The
// Owner is sent to Shopify's page to approve Wheelhouse and brought back to
// the Website page; nothing is sent until they press Send. Owner only, until
// roles are built (server/lib/owner-only.js). The older token-based
// /api/shopify/connection routes (routes/website.js) are separate.
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { currentSession } from '../lib/session.js';
import { endTrip, html, peekTrip, redirect, startTrip } from '../lib/trips.js';
import { cleanAddress, shopify } from '../shopify/index.js';
import { linkState, pause, preview, resume, saveLink, ShopifyError, startSending, stopLink } from '../shopify/link.js';
import { wakeShopifySending } from '../shopify/sending.js';
import { chooseWebsiteKind, websiteState } from '../website.js';

const WEBSITE_PAGE = '/workshop/website';

// Owner only, with this server's Shopify; then the answer, or the refusal a ShopifyError carries.
async function owner(req, res, fn) {
  if (await ownerOnly(req, res)) return;
  try {
    await fn();
  } catch (err) {
    if (!(err instanceof ShopifyError)) throw err;
    sendJson(res, err.status, { error: err.message, code: err.code });
  }
}
const sendState = async (res, status = 200) => sendJson(res, status, { shopify: await linkState() });

export function register(route) {
  // ws-shopify-connect: Connect, off to Shopify's page.
  route('POST', '/api/shopify/connect', (req, res, params, query, afterRelease, shopId) => owner(req, res, async () => {
    const provider = shopify();
    if (!provider) return sendJson(res, 409, { error: 'Shopify isn’t set up for Wheelhouse yet.', code: 'no_shopify' });
    const body = (await readJsonBody(req)) ?? {};
    if (typeof body.address !== 'string' || !body.address.trim()) return badRequest(res, 'Type your Shopify address');
    const ctx = await currentSession(req);
    const state = startTrip({ shopId, loginId: ctx.login.id, kind: 'shopify', address: cleanAddress(body.address) });
    sendJson(res, 200, { address: provider.connectAddress(state) });
  }));

  // The pretend Shopify's own page, only while it is the one this server uses.
  route('GET', '/api/shopify/pretend-approve', async (req, res, params, query) => {
    if (shopify()?.name !== 'pretend') return notFound(res);
    const state = query.get('state') || '';
    html(res, shopify().approvePage(state, peekTrip(state)?.address ?? null));
  });

  // Back from Shopify: connected, or ws-shopify-failed with nothing changed.
  route('GET', '/api/shopify/return', (req, res, params, query, afterRelease, shopId) => owner(req, res, async () => {
    const provider = shopify();
    const trip = provider && endTrip(query.get('state'), shopId, 'shopify');
    if (!trip) return badRequest(res, 'That link has expired. Press Connect again.');
    const answer = await provider.connectFinish(query, trip.address);
    if (!answer.connected) return redirect(res, `${WEBSITE_PAGE}?shopify=failed&address=${encodeURIComponent(trip.address)}`);
    // Shopify is now the shop's website: Wheelhouse's own is turned off (decided-while-building).
    await chooseWebsiteKind('shopify', () => saveLink(provider.name, trip.address, trip.loginId));
    redirect(res, `${WEBSITE_PAGE}?shopify=connected`);
  }));

  // ws-shopify-check: what Send would change.
  route('GET', '/api/shopify/preview', (req, res) => owner(req, res, async () => sendJson(res, 200, await preview())));

  // Send [n] products, and Try sending again: carries on in the background.
  route('POST', '/api/shopify/send', (req, res, params, query, afterRelease, shopId) => owner(req, res, async () => {
    if (await startSending()) wakeShopifySending(shopId);
    await sendState(res, 202);
  }));

  route('POST', '/api/shopify/pause', (req, res) => owner(req, res, async () => {
    await pause();
    await sendState(res);
  }));

  route('POST', '/api/shopify/resume', (req, res, params, query, afterRelease, shopId) => owner(req, res, async () => {
    if (await resume()) wakeShopifySending(shopId);
    await sendState(res);
  }));

  // ws-shopify-switch: Wheelhouse's website instead. Off until the Owner turns
  // it on; what is shown online and the orders stay as they are.
  route('POST', '/api/shopify/switch-to-wheelhouse', (req, res) => owner(req, res, async () => {
    if (!(await linkState())) throw new ShopifyError(409, 'Connect Shopify first.', 'shopify_not_connected');
    await chooseWebsiteKind('wheelhouse', stopLink);
    sendJson(res, 200, await websiteState());
  }));
}
