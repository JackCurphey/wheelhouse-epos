// Renders the customer website (src/website/, openspec/changes/website-browse)
// in jsdom, the way the website app mounts it: its routes (`websiteRoutes`
// from the app shell, test build) in a memory router whose basename is
// /store/north, with a query client that never retries unless `retry` says
// how many times (a number, or the app's own rule), with no wait between. `url` is the page's
// path under the shop, e.g. '/' or '/shop'.
//
// Every fetch is answered at once and recorded in `requests` ({url, method}).
// `site`, `categories`, `home`, `products`, `product`, `search` and `suggest`
// answer GET /api/site, /api/site/categories, /api/site/home,
// /api/site/products, /api/site/products/<id>, /api/site/search and
// /api/site/suggest; each is a
// body (sent with 200) or a function (url) => ({ status, body }). Anything
// else answers 404. The native dialog's showModal and close, missing in
// jsdom, are stubbed.
//
// `media(query)` says which media queries match, as a phone or tablet would
// answer them; left out, nothing matches (a computer). `cookie` is set on
// the page before it renders (the chosen shop, `wh_shop=<id>`).
//
// Example data comes from the drawings (browse.mjs): North Street Cycles,
// Bolton, "[Second site]", Shimano brake pads B05S-RX at £28.00, Bearings and
// Drivetrain › Derailleurs, Standard service £65.00, Brake service and Gear
// adjustment. Everything else is a bracketed placeholder.
import { installDom, importFresh } from './dom.js';

const BUILD = new URL('../../.test-build/', import.meta.url);
export const BASE = '/store/north';

const BOLTON = {
  id: 1, name: 'Bolton', address: '[Shop address]', phone: '[shop phone]', email: '[shop email]',
  hours: [], today: { open: '[open]', close: '[close]' }, nextOpening: null, closures: [],
};
const SECOND = { id: 2, name: '[Second site]' };

export const PARTS = {
  headline: '[Headline]',
  aboutLine: '[A line about the shop]',
  shopWords: '[The shop’s own words — about the shop, the team, a club ride]',
  bigPhoto: { url: '/uploads/big.jpg', description: '[Big photo of the shop]' },
  shopPhoto: { url: '/uploads/words.jpg', description: '[A photo the shop adds]' },
  workshopWords: '[The shop’s words about its workshop]',
  collectionReturns: '[The shop’s collection and returns words]',
  privacy: '[The shop’s privacy words]',
};

/** The site answer for a two-shop business (the drawings' example). */
export const TWO_SHOPS = {
  name: 'North Street Cycles', logo: null, mainColour: null, parts: PARTS,
  shops: [BOLTON, SECOND], tracking: [], preview: false, canTurnOn: false,
};
/** The same business with one shop (wb-home-one-shop, wb-find-us). */
export const ONE_SHOP = { ...TWO_SHOPS, shops: [BOLTON] };

export const CATEGORIES = [
  { id: 10, name: 'Bearings', parentId: null, path: 'Bearings', products: 12 },
  { id: 20, name: 'Drivetrain', parentId: null, path: 'Drivetrain', products: 7 },
  { id: 21, name: 'Derailleurs', parentId: 20, path: 'Drivetrain › Derailleurs', products: 4 },
  { id: 22, name: '[Category]', parentId: 20, path: 'Drivetrain › [Category]', products: 3 },
];

const card = (id, name, pricePence, photo, stock) => ({ id, name, brand: null, photo, pricePence, priceHighPence: null, details: [], stock });
export const PADS = (stock = { line: 'ready', shop: 'Bolton' }) => card(101, 'Shimano brake pads B05S-RX', 2800, '/uploads/pads.jpg', stock);
export const HOME = (stock) => ({
  featured: [PADS(stock), card(102, '[Product]', 1000, '/uploads/p2.jpg', stock ?? { line: 'ready', shop: 'Bolton' })],
  repairs: [
    { id: 1, name: 'Brake service', pricePence: null },
    { id: 2, name: 'Gear adjustment', pricePence: null },
    { id: 3, name: 'Standard service', pricePence: 6500 },
  ],
});

const NOT_FOUND = () => ({ status: 404, body: { error: 'We can’t find that page' } });

export async function renderWebsite({ url = '/', site = TWO_SHOPS, categories = CATEGORIES, home = HOME(), products = NOT_FOUND, product = NOT_FOUND, search = NOT_FOUND, suggest = NOT_FOUND, media, cookie, strict = false, retry = false } = {}) {
  const uninstall = installDom(`http://localhost${BASE}${url}`);
  // `setMedia(fn)` changes which queries match, as turning a tablet or widening a window does.
  let matching = media;
  const listeners = new Set();
  if (media) window.matchMedia = (q) => ({ get matches() { return matching(q); }, media: q, addEventListener(_, f) { listeners.add(f); }, removeEventListener(_, f) { listeners.delete(f); } });
  const setMedia = (fn) => { matching = fn; for (const f of [...listeners]) f(); };
  if (cookie) document.cookie = cookie;
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; this.dispatchEvent(new window.Event('close')); };
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const address = String(input);
    requests.push({ url: address, method: init?.method ?? 'GET' });
    const { pathname } = new URL(address, 'http://localhost');
    const source = pathname === `${BASE}/api/site` ? site
      : pathname === `${BASE}/api/site/categories` ? categories
        : pathname === `${BASE}/api/site/home` ? home
          : pathname === `${BASE}/api/site/products` ? products
            : pathname.startsWith(`${BASE}/api/site/products/`) ? product
              : pathname === `${BASE}/api/site/search` ? search
                : pathname === `${BASE}/api/site/suggest` ? suggest
                  : NOT_FOUND;
    const answer = typeof source === 'function' ? await source(address) : { status: 200, body: source };
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'content-type': 'application/json' } });
  };

  const { render } = await import('@testing-library/react');
  const { createElement: h, StrictMode } = await import('react');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { websiteRoutes } = await importFresh(new URL('website/app-shell.js', BUILD).href);
  const router = createMemoryRouter(websiteRoutes, { initialEntries: [`${BASE}${url}`], basename: BASE });
  const client = new QueryClient({ defaultOptions: { queries: { retry, retryDelay: 0, gcTime: Infinity } } });
  const tree = h(QueryClientProvider, { client }, h(RouterProvider, { router }));
  const ui = render(strict ? h(StrictMode, null, tree) : tree);
  return { ui, client, router, uninstall, requests, setMedia };
}

/** A phone (under 768px wide) or a tablet (768 to 1023px), as matchMedia answers. */
export const PHONE = (q) => /max-width:\s*767px/.test(q) || /max-width:\s*1023px/.test(q);
export const TABLET = (q) => /max-width:\s*1023px/.test(q);
