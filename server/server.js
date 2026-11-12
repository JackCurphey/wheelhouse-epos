// Wheelhouse - local server, PostgreSQL-backed.
import './load-env.js';
import { limitLockWait, moveStock } from './lib/stock.js';
import { hostedCopyRefusal } from './hosted-copy-guard.js';
import { devAutologinRefusal } from './lib/dev-autologin.js';
import { startSender } from './messaging/engine.js';
import { startBringingAcross } from './move/bring-across.js';
import { startShopifySending } from './shopify/sending.js';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepare, dbExec, runWithShop, pool, assertPoolerModeSafe } from './db.js';
import { clientIp } from './proxy-trust.js';
import { runMigrations } from './migrations/run-migrations.js';
import { sendJson, notFound, badRequest, readRawBody, ValidationError, parseCookies } from './lib/http.js';
import { UPLOADS_DIR, MAX_SERIAL } from './lib/uploads.js';
import { readBodyFirst, readGates } from './lib/read-body-first.js';
import {
  loadDocumentLine, createSale,
  pendingShopifyPushes, runRequestWithPushSlotCleanup, firePendingShopifyPushes,
} from './lib/sales.js';
// Tests import these from server.js; it keeps re-exporting them (split plan §4.1).
export { loadDocumentLine, createSale, pendingShopifyPushes, runRequestWithPushSlotCleanup, firePendingShopifyPushes };
import { currentSession, signedInSession, rememberSession, rememberCustomerSession } from './lib/session.js';
import { SESSION_COOKIE } from './auth.js';
import { SITE_OFF, SITE_FAILED, sitePath, isSiteApi, siteRateLimited, handleSiteRequest } from './routes/site.js';
import { ROUTE_AREAS } from './routes/index.js';
// tests/portal-copy.test.js reads the job statuses from here.
export { JOB_STATUSES } from './routes/workshop.js';
export { serializeWorkshopService } from './routes/workshop-settings.js';
import { parseStorefrontSlugCandidate, resolveStorefrontShop, getStorefrontInfo, listStorefrontProducts } from './storefront.js';
import { hashLinkCode } from './booking-link.js';
import { makeFailureLimiter } from './till/failure-limiter.js';
import {
  getShopifyConnectionByShopId,
  decryptSecret,
  verifyShopifyWebhookHmac,
  matchOrderLineItemsToProducts,
  matchRefundLineItemsToProducts,
  claimShopifyEventInTransaction,
  markShopifyEventError,
  recordFailedDelivery,
  pushStockToShopify,
} from './shopify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const WORKSHOP_HTML = path.join(PUBLIC_DIR, 'workshop.html');
const BOOK_HTML = path.join(PUBLIC_DIR, 'book.html');
const WEBSITE_HTML = path.join(PUBLIC_DIR, 'website.html');
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
// `body` is what the route needs of its request's body: see readBodyFirst.
function route(method, pattern, handler, body = {}) {
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
  routes.push({ method, pattern, regex, paramNames, handler, body });
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

// Three database scopes, as a refund's below: the claim and the sale in one transaction,
// so any failure takes the claim with it and Shopify's retry applies the order, counted
// once; then on failure its error record; then the push to Shopify. A duplicate waits on
// the claim, then finds it taken. A paid order sells past stock, as the till's offline
// sync does (Jack, 5 Nov): stock goes below zero and shows on Today. A product taken off
// sale here is sold too (answer 8). Only a refusal that would be the same next time
// (ValidationError: a bad figure) stays claimed, with its reason and logged as a fault,
// as a paid order has gone unrecorded.
async function processShopifyOrderWebhook(shopId, order) {
  const pushes = [];
  try {
    await runWithShop(shopId, async () => {
      const items = await matchOrderLineItemsToProducts(order);
      if (items.length < order.line_items.length) {
        console.error(`Shopify order ${order.id}: ${order.line_items.length - items.length} of ${order.line_items.length} lines match nothing here, so aren't recorded`);
      }
      await db.exec('BEGIN');
      try {
        await limitLockWait();
        if (!(await claimShopifyEventInTransaction(order.id, 'order'))) {
          await db.exec('ROLLBACK');
          return;
        }
        if (items.length > 0) {
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
          try {
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
              sellPastStock: true,
              evenIfOffSale: true,
            }, { deferShopifyPushesTo: pushes });
          } catch (err) {
            if (!(err instanceof ValidationError)) throw err;
            console.error(`Shopify order ${order.id} refused for good: ${err.message}`);
            await markShopifyEventError(order.id, 'order', err.message);
          }
        }
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK').catch(() => {});
        throw err;
      }
    });
  } catch (err) {
    // The claim rolled back, so this is a record for whoever investigates: the retry
    // still applies the order. Its own failure is logged and never hides the order's.
    await recordFailedDelivery(shopId, order.id, 'order', err.message);
    throw err;
  }
  // After COMMIT and with the connection back, so a slow Shopify never holds the row.
  firePendingShopifyPushes(shopId, pushes);
}

// Three database scopes, each committed or rolled back on its own in either
// tenant mode (shopify-refund-stock): the refund's work, then on failure its
// error record, then on success the push to Shopify.
async function processShopifyRefundWebhook(shopId, refund) {
  let pushes;
  try {
    pushes = await runWithShop(shopId, async () => {
      const items = await matchRefundLineItemsToProducts(refund);
      // Relative, in one transaction with its lines (lib/stock.js): `product` was
      // read without a lock, so writing `product.stock_qty + qty` back would undo a
      // sale or adjustment made in between. No person did this; its cause says what.
      let toPush = [];
      await db.exec('BEGIN');
      try {
        await limitLockWait();
        // The claim is the transaction's first statement, so a rollback takes
        // it too and Shopify's retry applies the refund. A duplicate arriving
        // meanwhile waits here on this claim, then finds it taken.
        if (!(await claimShopifyEventInTransaction(refund.id, 'refund'))) {
          await db.exec('ROLLBACK');
          return [];
        }
        toPush = (await moveStock(items.map(({ product, qty }) => ({
          productId: product.id, change: qty, type: 'return', note: `Shopify refund #${refund.id}`, shopifyRefundId: String(refund.id),
        })))).pushes;
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK').catch(() => {});
        throw err;
      }
      return toPush;
    });
  } catch (err) {
    // The claim rolled back, so this is a record for whoever investigates,
    // not a claim: the retry still applies the refund. Its own failure is
    // logged and never hides the refund's.
    await recordFailedDelivery(shopId, refund.id, 'refund', err.message);
    throw err;
  }
  // After COMMIT, so a slow Shopify never holds the product's row.
  await pushStockToShopify(shopId, pushes);
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
async function serveAppPage(res, htmlPath, entryKey, label, status = 200) {
  try {
    const [html, tags] = await Promise.all([readFile(htmlPath, 'utf8'), appEntryTags(entryKey)]);
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
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
  // The React apps' built files (Vite's /dist/): on the shop's own address
  // every path reaches here, the website app's own scripts included.
  if (pathname.startsWith('/dist/')) return serveStatic(req, res, pathname, PUBLIC_DIR);
  const storePrefix = `/store/${shop.slug}`;
  // The website app's router reads its addresses under /store/<slug>/, so
  // the bare store path goes to the slash form, keeping the query.
  if (pathname === storePrefix) {
    const queryIndex = req.url.indexOf('?');
    const search = queryIndex === -1 ? '' : req.url.slice(queryIndex);
    res.writeHead(302, { Location: `${storePrefix}/${search}` });
    return res.end();
  }
  // Every other address is one of the website app's pages
  // (openspec/changes/website-browse, design 1); its router says which.
  return serveWebsitePage(res);
}

// The customer website's page. A switched-off or unknown shop gets the same
// page with a 404, carrying nothing about the shop: the app asks /api/site
// and shows "This website isn't available" (wb-off).
function serveWebsitePage(res, status = 200) {
  return serveAppPage(res, WEBSITE_HTML, 'src/website/main.tsx', 'website', status);
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

// A signed-in staff route, its body already read: runs it on the shop's connection.
async function serveStaffRoute(req, res, r, params, url, ctx) {
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
    // A lock limit ran out, or a deadlock was broken: nothing was stored and
    // trying again can work (openspec/changes/stock-movements-say-who, design 4).
    if (err.code === '55P03' || err.code === '40P01') {
      sendJson(res, 503, { error: 'Wheelhouse is busy with this just now. Try again in a moment.', code: 'busy' });
      return;
    }
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
}

async function dispatch(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    // An address with a broken escape (/%ZZ) is the asker's mistake: 400, and
    // nothing worth a stack trace in the log.
    return badRequest(res);
  }

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

  const storefrontSlug = parseStorefrontSlugCandidate(req, url);
  if (storefrontSlug) {
    const sitePathname = sitePath(pathname, storefrontSlug);
    const siteApi = isSiteApi(sitePathname);
    // The website's own reads turn a visitor away past the limit before any
    // database work (openspec/changes/website-browse, design 2).
    if (siteApi && siteRateLimited(req, res, sitePathname)) return;
    // The shop's own staff see a switched-off website at /store/<slug>/ only,
    // where "View website" goes; on the shop's own address they see what
    // customers see (Jack's answer 4, 12 Nov). Looked up before runWithShop
    // takes this request's connection, and only when there is a staff cookie.
    // The whole branch is in one try/catch, the session lookup and the shop
    // lookup included: a failed read of the website's own answers says
    // "Something went wrong — try again" (design 2).
    try {
      let staff = null;
      const atStorePath = pathname === `/store/${storefrontSlug}` || pathname.startsWith(`/store/${storefrontSlug}/`);
      if (atStorePath && parseCookies(req)[SESSION_COOKIE]) {
        staff = await signedInSession(req);
        rememberSession(req, staff);
      }
      const storefrontShop = await resolveStorefrontShop(req, url, staff?.shop.id);
      if (!storefrontShop) {
        if (siteApi) return notFound(res, SITE_OFF);
        // A page of the website gets the website's own page with a 404; the
        // old JSON answer stays for the storefront API, the booking app and
        // the built files, which aren't pages of the website.
        const notAPage = pathname.startsWith('/api/') || pathname.startsWith('/dist/') || pathname === '/book' || pathname.startsWith('/book/');
        if (notAPage) return notFound(res, 'Storefront not found');
        return serveWebsitePage(res, 404);
      }
      if (siteApi) {
        const answered = await runWithShop(storefrontShop.id, () => handleSiteRequest(req, res, sitePathname, storefrontShop, staff));
        if (!answered) notFound(res, 'Unknown website route');
        return;
      }
      await runWithShop(storefrontShop.id, () => handleStorefrontRequest(req, res, pathname, storefrontShop));
    } catch (err) {
      console.error(err);
      if (res.headersSent) return;
      if (siteApi) sendJson(res, 503, { error: SITE_FAILED });
      else sendJson(res, 500, { error: 'Internal server error' });
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
      if (!(await readBodyFirst(req, res, {}, { gate: readGates.webhook }))) return;
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
        // An order queues its push before its own COMMIT: if that fails, this settles
        // the queued slot, so stopping the server doesn't wait for it.
        await runRequestWithPushSlotCleanup(() => processShopifyOrderWebhook(shopId, payload));
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

        const till = await runWithShop(shop.id, () =>
          db.prepare('SELECT * FROM tills WHERE token_hash = ? AND active = true').get(hashLinkCode(token)));
        if (!till) return refuse();
        if (!tillAuthFailures.isBlocked(key)) tillAuthFailures.clear(key);
        // Known to be a till, so it counts against its shop, not an address; its
        // body is in hand before it takes a connection to do the work.
        if (!(await readBodyFirst(req, res, r.body, { gate: readGates.signedIn, key: shop.id }))) return;
        await runWithShop(shop.id, () => r.handler(req, res, params, url.searchParams, till));
      } catch (err) {
        // The details go to the log; a till, a website visitor and someone
        // signing in get the same fixed words, never a database's message
        // (server-stays-up-when-busy). Signed-in staff routes below are as before.
        console.error(err);
        if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
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
          if (!(await readBodyFirst(req, res, r.body, { gate: readGates.website }))) return;
          await r.handler(req, res, params, url.searchParams);
        } catch (err) {
          console.error(err);
          sendJson(res, 500, { error: 'Internal server error' });
        }
        return;
      }

      const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [params.shopSlug]);
      if (!shop) return notFound(res, 'Shop not found');

      try {
        if (!(await readBodyFirst(req, res, r.body, { gate: readGates.website }))) return;
        // Which customer is asking, looked up before runWithShop takes this
        // request's connection, so a route asking again needs no second one.
        await rememberCustomerSession(req);
        await runWithShop(shop.id, () => r.handler(req, res, params, url.searchParams, shop));
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: 'Internal server error' });
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
          if (!(await readBodyFirst(req, res, r.body, { gate: readGates.staffAccounts }))) return;
          await r.handler(req, res, params, url.searchParams);
        } catch (err) {
          console.error(err);
          sendJson(res, 500, { error: 'Internal server error' });
        }
        return;
      }

      const ctx = await currentSession(req);
      if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
      // Looked up before runWithShop takes this request's connection; a
      // handler asking again gets this answer, not a second connection.
      rememberSession(req, ctx);

      // A route that must turn someone away before taking their body (the one
      // Citrus Lime file a shop can send at a time) does so on a connection it
      // gives straight back. What it takes, it has until this request is over.
      let letGo = null;
      if (r.body.beforeBody) {
        letGo = await runWithShop(ctx.shop.id, () => r.body.beforeBody(req, res, ctx.shop.id));
        if (!letGo) return;
      }
      try {
        if (await readBodyFirst(req, res, r.body, { gate: r.body.upload ? readGates.signedInUploads : readGates.signedIn, key: ctx.shop.id })) await serveStaffRoute(req, res, r, params, url, ctx);
      } finally {
        letGo?.();
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

// The messages engine's timer, stopped first on shutdown, and bringing a
// Citrus Lime file across (openspec/changes/citrus-import-products, design 5).
let stopMessageSender = null;
let stopBringingAcross = null;
let stopShopifySending = null;

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
  stopSender = () => Promise.all([stopMessageSender?.(), stopBringingAcross?.(), stopShopifySending?.()]),
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
        stopBringingAcross = startBringingAcross();
        // Products the Owner pressed Send for, to their Shopify shop (website-management design 7).
        stopShopifySending = startShopifySending();
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
