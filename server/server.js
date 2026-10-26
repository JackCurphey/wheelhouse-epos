// Wheelhouse - local server, PostgreSQL-backed.
import './load-env.js';
import { hostedCopyRefusal } from './hosted-copy-guard.js';
import { devAutologinRefusal } from './lib/dev-autologin.js';
import { startSender } from './messaging/engine.js';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepare, dbExec, runWithShop, pool, assertPoolerModeSafe } from './db.js';
import { clientIp } from './proxy-trust.js';
import { runMigrations } from './migrations/run-migrations.js';
import { sendJson, notFound, badRequest, readRawBody, nowIso, ValidationError } from './lib/http.js';
import { UPLOADS_DIR, MAX_SERIAL } from './lib/uploads.js';
import {
  loadDocumentLine, createSale,
  pendingShopifyPushes, runRequestWithPushSlotCleanup, firePendingShopifyPushes,
} from './lib/sales.js';
// Tests import these from server.js; it keeps re-exporting them (split plan §4.1).
export { loadDocumentLine, createSale, pendingShopifyPushes, runRequestWithPushSlotCleanup, firePendingShopifyPushes };
import { currentSession, rememberSession, rememberCustomerSession } from './lib/session.js';
import { ROUTE_AREAS } from './routes/index.js';
// tests/portal-copy.test.js reads the job statuses from here.
export { JOB_STATUSES } from './routes/workshop.js';
export { serializeWorkshopService } from './routes/workshop-settings.js';
import { parseStorefrontSlugCandidate, resolveStorefrontShop, getStorefrontInfo, listStorefrontProducts } from './storefront.js';
import { hashLinkCode } from './booking-link.js';
import { makeFailureLimiter } from './till/failure-limiter.js';
import { pushInventoryLevel } from './shopify.js';
import {
  getShopifyConnectionByShopId,
  decryptSecret,
  verifyShopifyWebhookHmac,
  matchOrderLineItemsToProducts,
  matchRefundLineItemsToProducts,
  claimShopifyEvent,
  markShopifyEventError,
} from './shopify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STOREFRONT_DIR = path.join(__dirname, '..', 'public-storefront');
const WORKSHOP_HTML = path.join(PUBLIC_DIR, 'workshop.html');
const BOOK_HTML = path.join(PUBLIC_DIR, 'book.html');
const VITE_MANIFEST = path.join(PUBLIC_DIR, 'dist', '.vite', 'manifest.json');
const DEMO_FILE = path.join(__dirname, '..', 'public-demo', 'sdbdemo.html');
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Every request that touches shop data runs inside `runWithShop(shopId, ...)`
// (see the request handler at the bottom of this file), which checks out a
// dedicated Postgres client for the request and sets the RLS session
// variable on it. `db` below is just `prepare`/`exec` from db.js under their
// old node:sqlite-shaped names, so the ~70 route handlers in this file keep
// using the plain `db.prepare(...)` calls they always have - each one reads
// whichever client is current for the request via AsyncLocalStorage
// internally, and RLS transparently scopes every query to that request's
// shop, so no call site here needs a shop_id filter added by hand.
const db = { prepare, exec: dbExec };

const tillAuthFailures = makeFailureLimiter(20, 60 * 1000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  // Self-hosted fonts (public/fonts/).
  '.woff2': 'font/woff2',
};

// ---------- Route handlers ----------

const routes = [];
function route(method, pattern, handler) {
  // pattern like '/api/products/:id'
  const paramNames = [];
  const regex = new RegExp(
    '^' +
      pattern
        .split('/')
        .map((seg) => {
          if (seg.startsWith(':')) {
            paramNames.push(seg.slice(1));
            return '([^/]+)';
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/') +
      '$'
  );
  routes.push({ method, pattern, regex, paramNames, handler });
}

// The table as "METHOD pattern", in registration order: what
// tests/route-list.test.js compares with its snapshot (split plan §4.1).
export function listRoutes() {
  return routes.map((r) => `${r.method} ${r.pattern}`);
}

// URL params that name a row by its SERIAL id. A malformed one - "abc", "NaN",
// "1.5", or past int4's 2147483647 - would reach Postgres and come back as a
// 500 carrying the database's own message. It names no row, so it is a 404,
// answered before any handler runs. Phase 4 screens build URLs from route
// params, where a missing param arrives as "undefined".
// :shopSlug and :deviceId are not ids and are not checked.
const ID_PARAMS = new Set(['id', 'jobId', 'lineId', 'loginId']);

function idParamsWellFormed(params) {
  for (const [name, value] of Object.entries(params)) {
    if (!ID_PARAMS.has(name)) continue;
    if (!/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > MAX_SERIAL) return false;
  }
  return true;
}

// ---------- Shopify order and refund webhooks (the dispatcher calls these) ----------

async function processShopifyOrderWebhook(shopId, order) {
  return runWithShop(shopId, async () => {
    const claimed = await claimShopifyEvent(order.id, 'order');
    if (!claimed) return;

    const items = await matchOrderLineItemsToProducts(order);
    if (items.length === 0) return;

    try {
      // Shopify's undiscounted line-item sum. order.total_discounts (a
      // string) is the total discount Shopify already applied to the order -
      // ignoring it here would record a discounted order at its full,
      // pre-discount value in EPOS's sales history/dashboards. createSale
      // computes its own total as subtotal - discount - groupDiscount.amount
      // (groupDiscount is 0 here since customerId is null for Shopify
      // orders), so mirror that same math for the payment amount, or
      // createSale's "payments must sum to the total" validation would fail.
      const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
      const discount = Number.parseFloat(order.total_discounts) || 0;
      const payableTotal = Math.max(0, subtotal - discount);
      await createSale({
        customerId: null,
        cashierId: null,
        items,
        discount,
        cashAmount: 0,
        cardAmount: 0,
        cashTendered: null,
        payments: [{ tenderType: 'Shopify', amount: payableTotal }],
        note: `Shopify order #${order.order_number || order.id}`,
      });
    } catch (err) {
      // claimShopifyEvent above commits immediately, standalone - it isn't
      // part of a transaction with createSale. If createSale throws
      // something unexpected (not a ValidationError - a DB blip, a bug),
      // that error still needs to propagate so the outer webhook handler
      // returns a 500 and Shopify retries, but the event is already
      // irreversibly marked claimed - claimShopifyEvent would report the
      // retry as already-claimed and return without ever calling createSale
      // again, permanently dropping the order. Marking the claim as an error
      // here (regardless of which kind of failure this was) at least leaves
      // an honest, investigable record instead of the misleading default
      // status='ok' a claimed-but-never-actually-processed row would
      // otherwise carry.
      await markShopifyEventError(order.id, 'order', err.message);
      if (err instanceof ValidationError) {
        return;
      }
      throw err;
    }
  });
}

async function processShopifyRefundWebhook(shopId, refund) {
  return runWithShop(shopId, async () => {
    const claimed = await claimShopifyEvent(refund.id, 'refund');
    if (!claimed) return;

    try {
      const items = await matchRefundLineItemsToProducts(refund);
      for (const { product, qty } of items) {
        const newQty = product.stock_qty + qty;
        await db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowIso(), product.id);
        await db.prepare(
          `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'return', ?)`
        ).run(product.id, qty, `Shopify refund #${refund.id}`);
        if (product.shopify_inventory_item_id) {
          await pushInventoryLevel(product, newQty).catch((err) => console.error('Shopify inventory push failed', err));
        }
      }
    } catch (err) {
      // Same claim-before-work reasoning as processShopifyOrderWebhook above -
      // an unexpected failure here (e.g. a DB blip) must still leave an
      // honest status='error' record, not the misleading default 'ok'.
      await markShopifyEventError(refund.id, 'refund', err.message);
      throw err;
    }
  });
}

// ---------- Uploaded images, served to anyone ----------

// The upload routes are in server/routes/products.js (a product's photo) and
// server/routes/website.js (the shop's logo and hero image); they share
// readUploadedImage in server/lib/uploads.js.

// Deliberately NOT registered via route() into the shared routes table -
// every route reached that way requires a signed-in staff session (see the
// dispatcher below), but these images (product photos, shop logo, hero
// image) need to be viewable by anonymous public-storefront visitors whose
// <img> tags carry no session cookie at all. It's served from its own
// unauthenticated branch in the dispatcher instead. Safe to leave
// unauthenticated: the storage key is a randomBytes(24) hex token (192 bits
// of entropy) - unguessable, so knowing it is the only "access control" an
// image URL like this needs, the same way most image/CDN URLs work.
async function serveUploadedImage(req, res, key) {
  const filePath = path.join(UPLOADS_DIR, key);
  if (!filePath.startsWith(UPLOADS_DIR) || !existsSync(filePath)) {
    return notFound(res, 'Image not found');
  }
  const typeRow = await pool.query('SELECT content_type FROM uploaded_image_types WHERE storage_key = $1', [key]);
  const contentType = typeRow.rows[0]?.content_type || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
  createReadStream(filePath).pipe(res);
}

// Every route, from server/routes/ (split plan §4.1, WP-0.4), in the fixed
// order of server/routes/index.js.
for (const area of ROUTE_AREAS) area.register(route);

// ---------- Static file serving ----------

async function serveStatic(req, res, pathname, baseDir) {
  let filePath = path.join(baseDir, pathname === '/' ? 'index.html' : pathname);
  // Prevent path traversal outside the given static directory.
  if (!filePath.startsWith(baseDir)) {
    return notFound(res);
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(baseDir, 'index.html');
  }
  // The fallback above assumes baseDir itself has an index.html - if the
  // whole directory is missing (a deploy/packaging gap, e.g. a static
  // bundle never copied into the image) that assumption fails too. Without
  // this check, createReadStream() below fails asynchronously and - since
  // nothing else on this stream listens for 'error' - Node's default
  // behavior for an unhandled 'error' event is to crash the entire
  // process, taking down every shop, not just this one request.
  if (!existsSync(filePath)) {
    return notFound(res);
  }
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  // Without an explicit header here, any CDN or caching proxy in front of
  // this app falls back to its own default caching for static-looking
  // extensions (a 4-hour TTL was observed in practice) - fine for a
  // CDN-fronted site with a build/version pipeline, but most of what this app
  // serves deploys straight from source with no cache-busted filenames, so a
  // cached JS/CSS bundle can silently outlive the code it's stale against.
  // Those files stay 'no-store': correctness beats any caching win.
  //
  // The one exception is /dist/assets/, which holds Vite's build output.
  // Every filename there carries a hash of the file's own contents, so a
  // change produces a new URL and a cached copy can never be stale - the
  // exact reason 'no-store' exists doesn't apply. Scoped to assets/
  // specifically: anything else under dist (the manifest, or a stray unhashed
  // file) must not be pinned in browsers for a year.
  //
  // Decided on the RESOLVED filePath, not the request path: the index.html
  // fallback above can turn a /dist/... request into index.html, which is not
  // hashed and must not be cached.
  const distRoot = path.join(baseDir, 'dist') + path.sep;
  const isHashedBuildOutput = filePath.startsWith(path.join(distRoot, 'assets'));
  const cacheControl = isHashedBuildOutput
    ? 'public, max-age=31536000, immutable'
    : 'no-store';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
  const stream = createReadStream(filePath);
  // Defense in depth beyond the existsSync check above (e.g. a permissions
  // error, or the file disappearing between the check and the read) -
  // same reasoning: an unhandled stream 'error' event crashes the process.
  stream.on('error', (err) => {
    console.error('serveStatic stream error', err);
    res.destroy();
  });
  stream.pipe(res);
}

// Either React app's entry tags. Vite content-hashes its output, so the
// entry filename is not knowable at author time - it is read from the manifest
// Vite writes into the bundle. Read per request rather than cached: the file is
// small, no shop is live on this page yet, and a cache would serve a deleted
// filename after a rebuild until the process restarts.
//
// public/dist is untracked, so a fresh checkout has no manifest until a build.
// The request answers 500 either way; this error is what the server log shows,
// so a missing file says what to run rather than a bare ENOENT.
export async function appEntryTags(entryKey, manifestPath = VITE_MANIFEST) {
  let raw;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`no app build at ${manifestPath} - run npm run build`, { cause: err });
    }
    throw err;
  }
  const manifest = JSON.parse(raw);
  const entry = manifest[entryKey];
  if (!entry) throw new Error(`vite manifest has no ${entryKey} entry - run npm run build`);
  // Vite hoists shared CSS onto a shared chunk once there is more than one
  // entry point, so the entry's own `css` list can be empty while a chunk it
  // `imports` carries the stylesheet - so every chunk reachable via `imports`
  // has to be walked (depth-first, dependencies' css before the entry's own,
  // matching Vite's own HTML output), not just the entry itself. `imports`
  // are keys back into this same manifest (Vite's documented shape); a key
  // that isn't present, or a cycle, is skipped rather than throwing, since a
  // manifest is generated output and this is a display concern, not a build
  // integrity check.
  const cssHrefs = [];
  const seenHrefs = new Set();
  const visitedKeys = new Set();
  const visit = (key) => {
    if (visitedKeys.has(key)) return;
    visitedKeys.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    for (const importKey of chunk.imports || []) visit(importKey);
    for (const href of chunk.css || []) {
      if (seenHrefs.has(href)) continue;
      seenHrefs.add(href);
      cssHrefs.push(href);
    }
  };
  visit(entryKey);
  const css = cssHrefs.map((href) => `<link rel="stylesheet" href="/dist/${href}" />`).join('\n  ');
  return `${css}\n  <script type="module" src="/dist/${entry.file}"></script>`;
}

// One of the React apps' pages: its HTML with the entry's tags put in. Every
// address the app's router owns gets this same page, so a link opened cold
// reaches its screen. No build means a 500 that says so, not a blank page.
// The response body is a fixed string - the real error (which can include an
// absolute manifest path) goes to the server log only, never to the visitor.
async function serveAppPage(res, htmlPath, entryKey, label) {
  try {
    const [html, tags] = await Promise.all([readFile(htmlPath, 'utf8'), appEntryTags(entryKey)]);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html.replace('<!--WH_ENTRY-->', tags));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`${label} bundle not built - see the server log`);
  }
}

async function handleStorefrontRequest(req, res, pathname, shop) {
  if (pathname === '/api/storefront/info' && req.method === 'GET') {
    return sendJson(res, 200, await getStorefrontInfo(shop));
  }
  if (pathname === '/api/storefront/products' && req.method === 'GET') {
    return sendJson(res, 200, await listStorefrontProducts());
  }
  // On a subdomain-hosted website (<slug>.wheelhouseepos.com),
  // parseStorefrontSlugCandidate matches every path on that host, not just
  // storefront-specific ones - so requests for uploaded images and the
  // customer booking app have to be forwarded to their real handlers here
  // instead of falling through to the website's own static bundle below
  // (whose serveStatic fallback would otherwise return the website's
  // index.html for these paths instead of the actual image or booking app
  // page). The caller (the request dispatcher) already wraps this whole
  // call in a try/catch, so errors from these forwarded calls propagate up
  // to that handler.
  if (pathname.startsWith('/api/uploaded-images/')) {
    return serveUploadedImage(req, res, pathname.slice('/api/uploaded-images/'.length));
  }
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    // A website books for its own shop only. Another shop's slug gets the
    // same answer as an unknown website, so it says nothing about that shop.
    const bookSlug = pathname.split('/')[2];
    if (bookSlug && bookSlug !== shop.slug) return notFound(res, 'Storefront not found');
    return serveAppPage(res, BOOK_HTML, 'src/customer/main.tsx', 'book');
  }
  const storePrefix = `/store/${shop.slug}`;
  // The website's HTML references its CSS/JS with relative hrefs, which
  // the browser resolves against the current URL's directory. Without a
  // trailing slash here, "/store/<slug>" has no directory segment of its
  // own, so the browser drops the slug entirely (e.g. requests
  // "/store/storefront.css" instead of "/store/<slug>/storefront.css").
  // Redirecting to the trailing-slash form fixes relative resolution for
  // every asset without needing per-request URL rewriting.
  if (pathname === storePrefix) {
    const queryIndex = req.url.indexOf('?');
    const search = queryIndex === -1 ? '' : req.url.slice(queryIndex);
    res.writeHead(302, { Location: `${storePrefix}/${search}` });
    return res.end();
  }
  const relative = pathname.startsWith(storePrefix) ? (pathname.slice(storePrefix.length) || '/') : pathname;
  return serveStatic(req, res, relative, STOREFRONT_DIR);
}

// Steady-state health, not boot health: the boot chain already runs
// runMigrations() then assertPoolerModeSafe() before the server ever starts
// listening, so a container that reports "up" has already proven the
// database was reachable once. That says nothing about a minute later - a
// dropped connection, a full pool, or Postgres going away after boot leaves
// the process listening and accepting connections while every real request
// fails. Takes a fresh query on every call (never cached) so /healthz always
// reflects the database's condition right now, not at startup.
export async function checkDatabaseHealth(targetPool = pool) {
  try {
    await targetPool.query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// The dispatcher's own steps (reading the address, finding an online shop or
// a website's shop, the staff sign-in lookup) sit outside each route's try.
// One that fails, a refused value or a pool whose 5-second wait ran out,
// fails this one request, as a route's own error does, rather than reaching
// the crash guard and stopping every shop (openspec/changes/
// server-stays-up-when-busy). Nothing is held at that point: runWithShop
// releases its connection in its own finally before an error gets here.
const server = createServer((req, res) => {
  dispatch(req, res).catch((err) => {
    console.error('Request failed in the dispatcher', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
    else if (!res.writableEnded) res.destroy();
  });
});

async function dispatch(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // Deliberately ahead of every other branch: an orchestrator's health probe
  // must never be mistaken for a shop/storefront route (and must never wait
  // on shop resolution), and must never be satisfied by the generic static
  // fallback at the bottom of this dispatcher - that's exactly the docker-
  // compose bug this replaces (GETting `/`, which serves index.html off disk
  // and passes with Postgres completely down).
  if (pathname === '/healthz') {
    const health = await checkDatabaseHealth();
    // The commit it runs, passed in by the deploy (add-hosted-copy design,
    // "The commit it runs"), on the 200 and the 503 alike; left out when unset.
    const commit = process.env.WHEELHOUSE_COMMIT;
    const withCommit = (body) => (commit ? { ...body, commit } : body);
    if (health.ok) return sendJson(res, 200, withCommit({ status: 'ok' }));
    console.error('Health check failed: database unreachable', health.error);
    return sendJson(res, 503, withCommit({ status: 'error', error: 'Database unreachable' }));
  }

  if (parseStorefrontSlugCandidate(req, url)) {
    const storefrontShop = await resolveStorefrontShop(req, url);
    if (!storefrontShop) {
      return notFound(res, 'Storefront not found');
    }
    try {
      await runWithShop(storefrontShop.id, () => handleStorefrontRequest(req, res, pathname, storefrontShop));
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  if (pathname.startsWith('/webhooks/shopify/')) {
    const match = pathname.match(/^\/webhooks\/shopify\/(\d+)\/(orders|refunds)$/);
    if (!match) return notFound(res, 'Unknown webhook route');
    const shopId = Number(match[1]);
    const kind = match[2];

    // The whole branch - including the connection lookup and signature
    // verification, not just order/refund processing at the bottom - is
    // wrapped in one try/catch, matching every other branch in this
    // dispatcher (see the website and /api/uploaded-images/ branches
    // above). Without this, an unhandled rejection from e.g. a DB blip on
    // getShopifyConnectionByShopId, or a GCM auth failure from decryptSecret,
    // would propagate out of this async dispatcher callback uncaught -
    // there's no process.on('unhandledRejection') handler anywhere in this
    // codebase, so on Node's default behavior that crashes the entire
    // process, taking down every shop, for a route reachable by an
    // unauthenticated caller with a guessable shopId.
    try {
      let rawBody;
      try {
        rawBody = await readRawBody(req);
      } catch (err) {
        return badRequest(res, 'Invalid request body');
      }

      // shopify_connections has FORCE ROW LEVEL SECURITY, so it can only be
      // read correctly from inside a runWithShop context for the exact shop
      // being queried (the website framework plan's final review found
      // this same bug class in resolveStorefrontShop - a bare pool/prepare
      // call against an RLS-protected table outside runWithShop either
      // throws on a connection that's never set app.current_shop_id, or
      // reads a stale different shop's session value). Unlike that case,
      // shopId is already known here from the URL, so there's no chicken-
      // and-egg problem - just enter the context immediately.
      const connection = await runWithShop(shopId, () => getShopifyConnectionByShopId(shopId));
      if (!connection) return notFound(res, 'Unknown shop');

      const hmacHeader = req.headers['x-shopify-hmac-sha256'];
      if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, decryptSecret(connection.webhook_secret))) {
        return sendJson(res, 401, { error: 'Invalid signature' });
      }

      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (err) {
        return badRequest(res, 'Invalid JSON body');
      }

      if (kind === 'orders') {
        await processShopifyOrderWebhook(shopId, payload);
      } else {
        await processShopifyRefundWebhook(shopId, payload);
      }
      sendJson(res, 200, { ok: true });
    } catch (err) {
      console.error('Shopify webhook processing failed', err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // Deliberately handled here, before the generic /api/ branch below would
  // otherwise swallow it and demand a staff session - these images need to
  // be fetchable by anonymous public-storefront visitors (see
  // serveUploadedImage's comment for why that's safe).
  if (pathname.startsWith('/api/uploaded-images/')) {
    try {
      await serveUploadedImage(req, res, pathname.slice('/api/uploaded-images/'.length));
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // Tills authenticate with a bearer token, not a cookie: a till is a
  // registered device that must keep working across an outage, so its
  // credential never expires (switching the till off withdraws it). The shop
  // comes from :shopSlug, as for portal routes; the token is then looked up
  // inside that shop's RLS scope, so another shop's token reads as unknown.
  if (pathname.startsWith('/api/till/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));
      if (!idParamsWellFormed(params)) return notFound(res);

      // The token is checked FIRST. A till presenting a valid, active token
      // is always served - even while its address + shop key is blocked - so
      // a guesser (or a dead neighbouring till with a stale token) sharing
      // its address can never lock a working till out. The limiter
      // (server/till/failure-limiter.js, keyed on address + shop slug) is
      // consulted only when the lookup fails: missing or malformed token,
      // unknown shop, or no active till with that token. Then a blocked key
      // gets 429 (and the failure is not counted again), otherwise the
      // failure is counted and the answer is 401. A good token clears the
      // count only when the key is not already blocked, so a till's own
      // traffic cannot lift a block that guessers earned.
      const key = `${clientIp(req)}|${params.shopSlug}`;
      const refuse = () => {
        if (tillAuthFailures.isBlocked(key)) return sendJson(res, 429, { error: 'Too many attempts - try again in a minute' });
        tillAuthFailures.recordFailure(key);
        sendJson(res, 401, { error: 'Till not recognised' });
      };
      const header = req.headers.authorization || '';
      const token = /^Bearer ([0-9a-f]{64})$/.exec(header)?.[1];
      if (!token) return refuse();

      try {
        const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [params.shopSlug]);
        if (!shop) return refuse();

        await runWithShop(shop.id, async () => {
          const till = await db.prepare('SELECT * FROM tills WHERE token_hash = ? AND active = true').get(hashLinkCode(token));
          if (!till) return refuse();
          if (!tillAuthFailures.isBlocked(key)) tillAuthFailures.clear(key);
          await r.handler(req, res, params, url.searchParams, till);
        });
      } catch (err) {
        console.error(err);
        if (!res.headersSent) sendJson(res, 500, { error: err.message || 'Internal server error' });
      }
      return;
    }
    return notFound(res, 'Unknown till route');
  }

  if (pathname.startsWith('/api/portal/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));
      if (!idParamsWellFormed(params)) return notFound(res);

      // signup/login/logout resolve their own shop (or need none at all, for
      // logout) and never touch RLS-protected tables directly, same as
      // /api/auth/* does for staff. Every other portal route needs the
      // shop's RLS context, resolved here from :shopSlug, to read/write
      // customers/employees/workshop_jobs/etc through the normal db
      // shim - customer identity (if the route needs it) is then checked
      // inside the handler itself via currentCustomerSession().
      if (/\/(signup|login|logout)$/.test(pathname)) {
        try {
          await r.handler(req, res, params, url.searchParams);
        } catch (err) {
          console.error(err);
          sendJson(res, 500, { error: err.message || 'Internal server error' });
        }
        return;
      }

      const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [params.shopSlug]);
      if (!shop) return notFound(res, 'Shop not found');

      try {
        // Which customer is asking, looked up before runWithShop takes this
        // request's connection, so a route asking again needs no second one.
        await rememberCustomerSession(req);
        await runWithShop(shop.id, () => r.handler(req, res, params, url.searchParams, shop));
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: err.message || 'Internal server error' });
      }
      return;
    }
    return notFound(res, 'Unknown portal route');
  }

  if (pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));
      if (!idParamsWellFormed(params)) return notFound(res);

      // Auth routes manage the session cookie themselves and never touch shop
      // data, so they run outside runWithShop. Every other /api/ route needs
      // a signed-in shop first - a client scoped (via RLS) to that shop
      // becomes `db` for the duration of this one request.
      if (pathname.startsWith('/api/auth/')) {
        try {
          await r.handler(req, res, params, url.searchParams);
        } catch (err) {
          console.error(err);
          sendJson(res, 500, { error: err.message || 'Internal server error' });
        }
        return;
      }

      const ctx = await currentSession(req);
      if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
      // Looked up before runWithShop takes this request's connection; a
      // handler asking again gets this answer, not a second connection.
      rememberSession(req, ctx);

      // A handler that needs work done AFTER its pooled client goes back to
      // the pool (currently: firing Shopify inventory pushes queued by
      // createSale's deferShopifyPushesTo - see the comment there) pushes a
      // callback onto this array instead of running that work itself while
      // still inside runWithShop. It is only read below once the
      // `runWithShop` call has fully resolved, which cannot happen until its
      // `finally` has already released the client back to the pool - so
      // anything queued here is guaranteed to run without holding one of the
      // ten pooled connections across it.
      const afterRelease = [];
      try {
        // runRequestWithPushSlotCleanup (see registerPendingShopifyPushSlot's
        // comment) settles any pendingShopifyPushes slot this request
        // registered at commit time if the request itself fails anywhere in
        // its own tail, before ever reaching the afterRelease loop below.
        await runRequestWithPushSlotCleanup(() =>
          runWithShop(ctx.shop.id, () => r.handler(req, res, params, url.searchParams, afterRelease, ctx.shop.id))
        );
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: err.message || 'Internal server error' });
        return;
      }
      for (const work of afterRelease) {
        try {
          work();
        } catch (err) {
          console.error('Post-release work failed', err);
        }
      }
      return;
    }
    return notFound(res, 'Unknown API route');
  }

  // A standalone, self-contained sales-demo page - fixed content, not a
  // directory to fall back through like /book or / below, so it's served
  // directly with an explicit content type rather than via serveStatic
  // (which would guess the MIME type from a file extension the URL
  // deliberately doesn't have).
  if (pathname === '/sdbdemo' || pathname === '/sdbdemo/') {
    try {
      const html = await readFile(DEMO_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // The React workshop app. Every path under /workshop gets the same page,
  // because the client-side router owns those URLs: a browser opening
  // /workshop/<anything> directly must get this page, not the old app's
  // index.html that the static fallback below would hand it.
  if (pathname === '/workshop' || pathname.startsWith('/workshop/')) {
    await serveAppPage(res, WORKSHOP_HTML, 'src/staff/main.tsx', 'workshop');
    return;
  }

  // The React customer app (src/customer/). Every path under /book gets the
  // same page because its router owns those addresses, including the private
  // link /book/<slug>/booking/<code>. The old public-portal/ page is no longer
  // served (J1, changed 25 Sep).
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    await serveAppPage(res, BOOK_HTML, 'src/customer/main.tsx', 'book');
    return;
  }

  try {
    await serveStatic(req, res, pathname, PUBLIC_DIR);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

// ---------- Graceful shutdown ----------

// How long a rolling deploy's SIGTERM waits for requests already in flight
// (a till mid-transaction, a slow Shopify push-with-retry) to finish on their
// own before the process gives up and exits anyway. Bounded deliberately: an
// orchestrator's own "give up and SIGKILL" timeout is typically 10-30s, and
// exiting cleanly one second before that beats being SIGKILLed mid-write.
const SHUTDOWN_GRACE_MS = 10_000;

// Printed once, as soon as the signal handlers are installed. Exported so the
// lifecycle test matches on the same string this prints rather than a copy of
// it that can drift.
export const SIGNALS_READY = 'Boot: signal handlers installed';

let shuttingDown = false;

// Critical 2: signal handlers are installed before server.listen (see the
// isMainModule block below), so a SIGTERM/SIGINT can land while the boot
// chain (runMigrations, assertPoolerModeSafe) is still running and the HTTP
// server has never listened. Without this flag, gracefulShutdown would call
// httpServer.close() on a server that was never started (a synchronous
// ERR_SERVER_NOT_RUNNING from Node, logged as "Error while closing the HTTP
// server") AND set shuttingDown before the still-running boot chain's own
// pool.end()-adjacent work runs - so a pooler probe mid-flight on the same
// pool then fails with "Cannot use a pool after calling end on the pool",
// and the boot chain's catch block logs a false "Database startup checks
// failed", even though nothing about the database ever failed. This matters
// most for a rolling deploy scaling a replica down while it's still waiting
// on another replica's migration advisory lock - exactly the multi-replica
// cold start that lock exists to make safe.
let serverListening = false;

// Waits for every currently-tracked deferred Shopify push to settle
// (success or failure - either way it's done with the pool). Re-checks the
// set after each round rather than snapshotting once, in case a push that
// was itself still in the middle of starting adds a sibling before this
// resolves. Deliberately has no timeout of its own: the caller's own
// forceExit timer already bounds the ENTIRE shutdown (this wait included),
// so a wedged push cannot hold the process open past that - it just means
// the process exits via the force-exit path instead of the clean one.
async function waitForPendingShopifyPushes(pendingPushes) {
  while (pendingPushes.size > 0) {
    await Promise.allSettled([...pendingPushes]);
  }
}

// The messages engine's timer, stopped first on shutdown.
let stopMessageSender = null;

// Exported so tests can drive it directly against a fake server/pool without
// spawning a real process for every assertion; production only ever calls it
// through the SIGTERM/SIGINT listeners below.
export function gracefulShutdown(signal, {
  httpServer = server,
  dbPool = pool,
  graceMs = SHUTDOWN_GRACE_MS,
  exit = process.exit,
  pendingPushes = pendingShopifyPushes,
  // Stops the messages timer; resolves once a sending round in flight is done.
  stopSender = () => stopMessageSender?.(),
  // Only the real production httpServer (the default) is gated on the
  // module-level serverListening flag - tests inject their own fake
  // httpServer objects to drive the drain/force-exit paths directly and
  // don't model a pre-listen state at all, so a fake httpServer is always
  // treated as already listening.
  isListening = () => (httpServer === server ? serverListening : true),
} = {}) {
  if (shuttingDown) return;
  shuttingDown = true;
  const senderStopped = Promise.resolve(stopSender());

  // A signal landing before server.listen()'s callback has fired means
  // there is no HTTP server to close and no pool activity belonging to
  // this shutdown path - the boot chain (runMigrations,
  // assertPoolerModeSafe) is still using the pool itself. Exit clean and
  // immediately, touching neither the HTTP server nor the pool: setting
  // `shuttingDown` above is what keeps the still-running boot chain's own
  // failure path quiet (see the isMainModule .catch below), and returning
  // here rather than falling through avoids the false
  // ERR_SERVER_NOT_RUNNING / "Cannot use a pool after calling end" pair a
  // real run of this scenario produced.
  if (!isListening()) {
    console.log(`${signal} received before the server started listening - exiting cleanly`);
    exit(0);
    return;
  }

  console.log(`${signal} received - closing the HTTP server, waiting up to ${graceMs}ms for in-flight requests to finish`);

  const forceExit = setTimeout(() => {
    console.error(`Shutdown grace period (${graceMs}ms) elapsed with requests still in flight - forcing exit`);
    exit(1);
  }, graceMs);
  // The force-exit timer must never be the reason the process stays alive -
  // only in-flight work should do that.
  forceExit.unref();

  httpServer.close((err) => {
    if (err) console.error('Error while closing the HTTP server', err);
    // A sale that completed just as the signal landed can still have a
    // deferred Shopify push in flight, opened on its OWN pooled client after
    // the sale's own client was already released (see
    // firePendingShopifyPushes in lib/sales.js) - draining HTTP connections says
    // nothing about that. Wait for it before ending the pool, or pg refuses
    // its connect() with the pool already ended and the push dies silently.
    // Likewise a messages sending round still using the pool.
    Promise.all([waitForPendingShopifyPushes(pendingPushes), senderStopped])
      .then(() => dbPool.end())
      .catch((poolErr) => console.error('Error while closing the database pool', poolErr))
      .finally(() => {
        clearTimeout(forceExit);
        exit(err ? 1 : 0);
      });
  });

  // A keep-alive socket sitting idle (no request in flight on it) would
  // otherwise hold server.close()'s callback open indefinitely, since Node
  // only fires it once every connection - including idle ones - has closed.
  // Idle connections have nothing to drain, so cut them immediately; a
  // connection with a request actually in flight is untouched by this call
  // and is left to finish within the grace period above.
  httpServer.closeIdleConnections?.();
}

// ---------- Crash guard ----------

// Several comments elsewhere in this file (the Shopify webhook branch, the
// website branch, etc.) individually wrap their own async work in
// try/catch specifically because, until now, nothing caught a rejection that
// slipped past all of them - Node's default behaviour for an unhandled
// rejection or an uncaught synchronous throw is to crash the whole process
// immediately, taking every shop down with it, with no log line explaining
// why. This does not try to keep serving after either kind of error: a
// process whose state is unknown (a client that may never have been
// released, an in-flight transaction of uncertain status) is worse than one
// that exits and lets the orchestrator start a clean one.
//
// Deliberately NOT coordinated with gracefulShutdown's `shuttingDown` flag:
// an uncaught error that lands while a drain is already in progress (a bug
// in some OTHER, unrelated in-flight request, say) exits immediately here
// rather than letting the rest of the grace period run out first, which
// truncates it for every other still-draining request. That is an accepted
// cost under the same reasoning as above, not an oversight - a process that
// has just proven its own state is unknown by throwing uncaught is not one
// this codebase trusts to finish draining correctly either.
export function installCrashGuard({ exit = process.exit } = {}) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Fatal: unhandled promise rejection - exiting so the process supervisor can restart clean', {
      reason,
      promise,
    });
    exit(1);
  });
  process.on('uncaughtException', (err, origin) => {
    console.error(`Fatal: uncaught exception (${origin}) - exiting so the process supervisor can restart clean`, err);
    exit(1);
  });
}

// This module exports functions (serializeX, etc.) that test files import
// directly. Without this guard, every test file that imports server.js would
// also run this migrate-and-listen chain and boot a real HTTP server -
// one listener per test file, all fighting over the same port and holding
// the event loop open forever. Only start the server when this file is the
// entry point actually being run (node server/server.js / npm start), not
// when it's merely imported for its exports.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  installCrashGuard();
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  // Announced because "this process can now shut down cleanly" is a real thing
  // to know during a rolling deploy: before this line the process dies on
  // SIGTERM with the default disposition, and nothing else says when that
  // window closes. It cannot be closed entirely - ES module evaluation runs
  // before any code here - so the honest answer is to say when it ended rather
  // than to pretend it does not exist. tests/server-lifecycle.test.js waits for
  // this instead of guessing a delay; it used to sleep 120ms, which sat in a
  // ~78ms gap between module evaluation finishing and the server listening, and
  // lost the race on a slower machine.
  // Same treatment as SIGTERM so Ctrl+C locally behaves consistently with a
  // real rolling deploy rather than Node's raw default (immediate exit).
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  console.log(SIGNALS_READY);

  // The hosted test copy refuses anything unsafe before any migration runs.
  // The dev sign-in switch must never be on where anyone else can reach the server.
  const devRefusal = devAutologinRefusal(process.env);
  if (devRefusal) {
    console.error(devRefusal);
    process.exit(1);
  }
  const hostedRefusal = hostedCopyRefusal(process.env);
  if (hostedRefusal) {
    console.error(hostedRefusal);
    process.exit(1);
  }

  runMigrations()
    // Session-scoped tenancy (the DB_TENANT_SCOPE default) is only safe on a
    // direct connection or a session-mode pooler. Put a transaction-mode
    // pooler in front of this and one shop's request can be served on a
    // connection still carrying another shop's tenant - so check once, here,
    // rather than discover it in production. See server/db.js.
    .then(() => assertPoolerModeSafe())
    .then(() => mkdir(UPLOADS_DIR, { recursive: true }))
    .then(() => {
      server.listen(PORT, () => {
        serverListening = true;
        // The messages engine's timer (pretend senders for now).
        stopMessageSender = startSender();
        console.log(`\n  Wheelhouse running at http://localhost:${PORT}\n`);
      });
    })
    .catch((err) => {
      // A signal that landed pre-listen already called gracefulShutdown's
      // own clean exit(0) path above (see the `!isListening()` branch) and
      // set `shuttingDown` before this boot chain's own pool use (e.g.
      // probePoolerMode) could fail as a side effect of that shutdown. Stay
      // quiet here in that case - the real cause is an intentional
      // shutdown, not a database failure, and process.exit(0) has already
      // been called or is about to win the race.
      if (shuttingDown) return;
      console.error('Database startup checks failed - server not started.');
      console.error(err);
      process.exit(1);
    });
}
