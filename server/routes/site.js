// The customer website's read routes (openspec/changes/website-browse,
// design 2). Each runs inside the shop the address names: server.js finds it
// with resolveStorefrontShop and calls handleSiteRequest inside runWithShop.
// Not in ROUTE_AREAS: these are public, found from the address, never from a
// staff session.
import { prepare } from '../db.js';
import { sendJson, makeRateLimiter, parseCookies } from '../lib/http.js';
import { clientIp } from '../proxy-trust.js';
import { currentSession } from '../lib/session.js';
import { shopToday } from '../clock.js';
import { effectiveHours, openingHoursFor, weekdayOf } from '../capacity.js';
import { toCapacitySettings } from '../workshop/jobs.js';
import { addDays } from '../lib/report-periods.js';
import { liveTracking, TOOL_BY_KEY } from '../website-tracking.js';
import { ownerNames, turnOn, turnOff, WebsiteError } from '../website.js';
import { JOIN } from '../lib/categories.js';
import { NotFound, homeAnswer, productsAnswer, productAnswer, searchAnswer, suggestAnswer } from '../site-products.js';

export const SITE_OFF = 'This website isn’t available';
export const SITE_FAILED = 'Something went wrong — try again';
export const SITE_NOT_FOUND = 'We can’t find that page';

// One limit per visitor address for every /api/site route (design 2). The
// number suits a customer browsing: a page asks for two or three answers, so
// 300 a minute is a page every second or so (decided while building, Jack's
// November file). Suggestions ask as the customer types, so they have their
// own limit and don't use up the page's (design 2).
const siteLimiter = makeRateLimiter(300, 60 * 1000);
const suggestLimiter = makeRateLimiter(120, 60 * 1000);
const SUGGEST = '/api/site/suggest';

// The path after /store/<slug> when the website is reached that way, or the
// path as asked on the shop's own address.
export function sitePath(pathname, slug) {
  const prefix = `/store/${slug}`;
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

export function isSiteApi(path) {
  return path === '/api/site' || path.startsWith('/api/site/');
}

/** Turns a visitor away past the limit; true when it answered. Run before any database work. */
export function siteRateLimited(req, res, path) {
  if ((path === SUGGEST ? suggestLimiter : siteLimiter).check(clientIp(req))) return false;
  sendJson(res, 429, { error: 'Too many requests — try again in a minute' });
  return true;
}

/**
 * Answers an /api/site request for `shop`; false when the path isn't one.
 * `staff` is the signed-in staff session server.js found for this shop at
 * /store/<slug>/ (Jack's answer 4), or null.
 */
export async function handleSiteRequest(req, res, path, shop, staff) {
  if (req.method !== 'GET') return siteActionRequest(req, res, path, shop, staff);
  const found = readFor(path);
  if (!found) return false;
  const { handler, params } = found;
  // Staff and customers ask at the same address, and a preview can carry the
  // draft: nothing in between may keep an answer, a 404 or 503 included.
  res.setHeader('Cache-Control', 'no-store');
  try {
    const website = await prepare('SELECT kind, is_on, published, draft FROM website').get();
    // A shop whose website is its Shopify shop has no Wheelhouse website (design 2).
    if (website?.kind === 'shopify') return sendJson(res, 404, { error: SITE_OFF }), true;
    // resolveStorefrontShop let a switched-off website through only for this
    // shop's own staff; checking the shop again here keeps a website switched
    // off a moment later from previewing for another shop's staff.
    const preview = staff?.shop.id === shop.id && !(await isOn(website));
    const query = new URL(req.url, 'http://site').searchParams;
    const answer = await handler({ req, shop, website, preview, query, params });
    sendJson(res, 200, answer);
  } catch (err) {
    if (err instanceof NotFound) return sendJson(res, 404, { error: SITE_NOT_FOUND }), true;
    // A failed read never stops the server, and the page says so (design 2).
    console.error(err);
    sendJson(res, 503, { error: SITE_FAILED });
  }
  return true;
}

// A shop that hasn't opened the Website page yet has the old switch (as resolveStorefrontShop reads it).
const isOn = async (website) => (website ? website.is_on : !!(await prepare('SELECT enabled FROM storefront_settings LIMIT 1').get())?.enabled);

const READS = {
  // screens: wb-home, wb-home-lower, wb-home-one-shop, wb-first-visit, wb-off-preview, wb-off-preview-ask, wb-cookies-banner, wb-shops, wb-shop-page, wb-find-us
  '/api/site': siteAnswer,
  // screens: wb-home, wb-home-lower, wb-home-one-shop, wb-first-visit
  '/api/site/home': homeAnswer,
  // screens: wb-shop, wb-home
  '/api/site/categories': categoriesAnswer,
  // screens: wb-category, wb-category-filtered, wb-category-empty, wb-category-no-shop, wb-category-parent, wb-category-child
  '/api/site/products': productsAnswer,
  // screens: wb-search-typing, wb-search-no-suggestions
  [SUGGEST]: suggestAnswer,
  // screens: wb-search-results, wb-search-measure, wb-search-none
  '/api/site/search': searchAnswer,
};

// screens: wb-product, wb-product-photos, wb-product-sizes, wb-product-size-other, wb-product-held
const PRODUCT = /^\/api\/site\/products\/([^/]+)$/;

function readFor(path) {
  if (Object.hasOwn(READS, path)) return { handler: READS[path], params: {} };
  const product = PRODUCT.exec(path);
  return product ? { handler: productAnswer, params: { id: product[1] } } : null;
}

async function siteAnswer({ req, shop, website, preview }) {
  // Customers see only what is published. Staff previewing a website that has
  // never been published see what Turn it on would publish: the draft
  // (decided while building, Jack's November file).
  const content = website?.published ?? (preview ? website?.draft : null);
  const answer = {
    name: shop.name,
    logo: content?.logo || null,
    mainColour: content?.main_colour || null,
    parts: publishedParts(content),
    shops: await shopsAnswer(),
    // Kind and name only, until the visitor's wh_cookies choice turns the
    // tool's kind on: only then does its ID reach the page (design 4).
    tracking: content ? trackingAnswer(liveTracking(content), cookieChoices(req)) : [],
    preview,
    canTurnOn: false,
  };
  if (preview) {
    const ctx = await currentSession(req);
    answer.canTurnOn = !!ctx?.login.is_owner;
    // wb-off-preview-ask names who can turn it on.
    if (!answer.canTurnOn) answer.ownerNames = await ownerNames(shop.id);
  }
  return answer;
}

function publishedParts(content) {
  const part = (key) => content?.parts?.[key] || {};
  const photo = (key) => (part(key).photo ? { url: part(key).photo, description: part(key).decoration ? '' : part(key).description || '' } : null);
  return {
    headline: part('headline').text || '',
    aboutLine: part('about_line').text || '',
    shopWords: part('shop_words').text || '',
    bigPhoto: photo('big_photo'),
    shopPhoto: photo('shop_words'),
    workshopWords: part('workshop_words').text || '',
    collectionReturns: part('collection_returns').text || '',
    privacy: part('privacy').text || '',
  };
}

// The business's shops. Until Multiple sites (WP-5.2) gives each shop its own
// address, phone and hours, the shared ones sit on the first shop only and the
// others show their name (Jack's answer 1).
async function shopsAnswer() {
  const sites = await prepare('SELECT id, name FROM sites ORDER BY id').all();
  if (sites.length === 0) return [];
  const details = await prepare(
    "SELECT address, phone, email FROM shops WHERE id = current_setting('app.current_shop_id')::int"
  ).get();
  const first = { id: sites[0].id, name: sites[0].name, address: details?.address || null, phone: details?.phone || null, email: details?.email || null, ...(await openingAnswer()) };
  return [first, ...sites.slice(1).map((s) => ({ id: s.id, name: s.name }))];
}

const LOOK_AHEAD_DAYS = 62;

// The week's hours, today's in the shop's own time zone or the next opening
// within LOOK_AHEAD_DAYS, and the closures in that time. A closure is a
// block with no mechanic, always whole days (the shop_all_day check); a
// mechanic's day off isn't one, and a closure's reason is for staff only.
async function openingAnswer() {
  const settings = toCapacitySettings(await prepare('SELECT * FROM workshop_settings LIMIT 1').get());
  const today = shopToday(settings.timeZone);
  const closures = (await prepare(
    `SELECT start_date, end_date FROM workshop_unavailability
      WHERE kind = 'dates' AND employee_id IS NULL AND end_date >= ? AND start_date <= ?
      ORDER BY start_date, end_date`
  ).all(today, addDays(today, LOOK_AHEAD_DAYS))).map((c) => ({ from: c.start_date, to: c.end_date }));
  const hoursOn = (date) => (closures.some((c) => c.from <= date && date <= c.to) ? null : effectiveHours(settings, weekdayOf(date)));
  const todays = hoursOn(today);
  let nextOpening = null;
  if (!todays) {
    for (let n = 1; n <= LOOK_AHEAD_DAYS && !nextOpening; n++) {
      const date = addDays(today, n);
      const hours = hoursOn(date);
      if (hours) nextOpening = { date, open: hours.open };
    }
  }
  return { hours: openingHoursFor(settings), today: todays, nextOpening, closures };
}

// Every category, with how many products a customer can see in it and beneath
// it. A flat list in path order; parentId gives each category's types (its
// subcategories), from which the screen builds the tree.
async function categoriesAnswer() {
  const rows = await prepare('SELECT id, name, parent_id, path FROM product_categories ORDER BY path').all();
  const counts = await prepare(
    // A product with sizes and colours counts once, as the category page shows it.
    "SELECT category, count(DISTINCT COALESCE('g' || group_id, 'p' || id))::int AS n FROM products WHERE show_online AND active = 1 AND price > 0 AND category IS NOT NULL GROUP BY category"
  ).all();
  return rows.map((r) => ({
    id: r.id, name: r.name, parentId: r.parent_id, path: r.path,
    products: counts.filter((c) => c.category === r.path || c.category.startsWith(`${r.path}${JOIN}`)).reduce((sum, c) => sum + c.n, 0),
  }));
}

// ---- Cookie choices (website-browse PR 8, design 4) -----------------------

// The cookie the visitor's choices are kept in; the page sets it (cookies.tsx).
export const COOKIE_CHOICES = 'wh_cookies';
// Which choice each kind of tool needs: the Choose cookies rows.
export const CHOICE_FOR_KIND = { Statistics: 'measuring', Marketing: 'advertising' };

/** The kinds the visitor said yes to, from `measuring-on.advertising-off`; anything else is no. */
export function cookieChoices(req) {
  const value = parseCookies(req)[COOKIE_CHOICES] || '';
  return new Set(value.split('.').filter((part) => /^[a-z]+-on$/.test(part)).map((part) => part.slice(0, -3)));
}

function trackingAnswer(tools, yes) {
  return tools.map((t) => {
    const named = { kind: t.kind, name: TOOL_BY_KEY.get(t.tool).name };
    return yes.has(CHOICE_FOR_KIND[t.kind]) ? { ...named, tool: t.tool, id: t.id } : named;
  });
}

// ---- The staff banner's switch (website-browse PR 8, design 5) ------------

export const SITE_TURN_REFUSED = 'Only the shop’s owner can turn the website on';
const ACTIONS = { '/api/site/turn-on': 'on', '/api/site/turn-off': 'off' };

// Turn it on and Turn off on the staff banner, at /store/<slug>/ only (server.js
// finds `staff` there alone). The Owner only, until roles (WP-1.1), using the
// Website page's own code; everyone else gets what a customer would.
async function siteActionRequest(req, res, path, shop, staff) {
  if (req.method !== 'POST' || !Object.hasOwn(ACTIONS, path)) return false;
  res.setHeader('Cache-Control', 'no-store');
  if (staff?.shop.id !== shop.id) return sendJson(res, 404, { error: SITE_OFF }), true;
  // Another site's page can't make a signed-in Owner's browser press it.
  const from = req.headers['sec-fetch-site'];
  if (from && from !== 'same-origin' && from !== 'none') return sendJson(res, 403, { error: 'This can only be done from the shop’s own pages' }), true;
  const ctx = await currentSession(req);
  if (!ctx?.login.is_owner) return sendJson(res, 403, { error: SITE_TURN_REFUSED, owners: await ownerNames(shop.id) }), true;
  try {
    if (ACTIONS[path] === 'on') await turnOn(ctx.login.id);
    else await turnOff();
    sendJson(res, 200, { on: ACTIONS[path] === 'on' });
  } catch (err) {
    if (!(err instanceof WebsiteError)) throw err;
    sendJson(res, err.status, { error: err.message });
  }
  return true;
}
