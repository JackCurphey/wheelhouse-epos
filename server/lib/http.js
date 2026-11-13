// Request and response helpers every route area uses (split plan §4.1,
// WP-0.4). Moved out of server.js unchanged; server.js and the route files
// in server/routes/ import them from here.

export function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeCookieValue(value);
  }
  return cookies;
}

// A cookie that is not a valid escape (another app on the same domain may set
// `promo=50%off`) keeps its raw value, as the `cookie` package does, rather
// than failing every request from that browser
// (openspec/changes/server-stays-up-when-busy).
function decodeCookieValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function makeRateLimiter(max, windowMs) {
  const hits = new Map(); // key -> { count, resetAt }
  return {
    check(key) {
      const now = Date.now();
      // A public route meets many addresses once each: past a size, forget
      // the ones whose minute is over, so the map doesn't grow for ever.
      if (hits.size > 10000) for (const [k, e] of hits) if (e.resetAt < now) hits.delete(k);
      const entry = hits.get(key);
      if (!entry || entry.resetAt < now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= max) return false;
      entry.count++;
      return true;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

// A client that has gone can't be answered, so nothing is written. Only before
// anything is sent: a second answer after a finished one is still the error it
// always was.
function clientHasGone(res) {
  return !res.headersSent && res.destroyed;
}

export function sendJson(res, status, data) {
  if (clientHasGone(res)) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function notFound(res, msg = 'Not found') {
  sendJson(res, 404, { error: msg });
}

export function badRequest(res, msg = 'Bad request') {
  sendJson(res, 400, { error: msg });
}

// Both helpers below accumulate raw Buffers and only convert to a string
// ONCE, after every chunk has arrived (via Buffer.concat(...).toString()).
// Converting per-chunk instead (the previous `data += chunk` pattern, which
// implicitly calls chunk.toString('utf8') on every chunk as it arrives) would
// corrupt any multi-byte UTF-8 character that happens to land on a TCP chunk
// boundary - turning it into replacement characters and breaking anything
// that depends on the exact bytes (notably readRawBody's caller, which HMAC-
// verifies the raw body against Shopify's signature).
export async function readJsonBody(req, maxBytes = 2_000_000, { answerOverflow = false } = {}) {
  const body = await readBody(req, maxBytes, answerOverflow);
  return body.length === 0 ? {} : JSON.parse(body.toString('utf8'));
}

export function readRawBody(req, maxBytes = 2_000_000) {
  return readBody(req, maxBytes, false);
}

// The client went away before the whole request was read: a phone losing signal,
// a till switched off. Nobody's fault and nobody to answer. It passes up through
// runWithShop like any failure, so a transaction rolls back and the connection
// goes back to the pool; the dispatcher then stays quiet about it.
export class ClientGoneError extends Error {
  name = 'ClientGoneError';
  constructor(cause) {
    super('The client went away before its request was read', cause ? { cause } : undefined);
  }
}

// A body already read off the wire by readBodyFirst (server/lib/read-body-first.js),
// which the readers then use instead of the stream. The route's own limit still
// decides: too large is refused, and destroying the request cuts the connection if
// more of it is still to come. If it has all arrived, the route can still answer.
const heldBodies = new WeakMap();

export function holdRequestBody(req, held) {
  heldBodies.set(req, held);
}

function takeHeldBody(req, held, maxBytes, resolve, reject) {
  if (held.taken) return reject(new Error('Request body already read'));
  held.taken = true;
  if (held.overflowed || held.bytes > maxBytes) {
    reject(new Error('Payload too large'));
    req.destroy();
    return;
  }
  const body = Buffer.concat(held.chunks);
  held.chunks = []; // Its memory, while the route does its work.
  resolve(body);
}

// Always ends (openspec/changes/dropped-request-releases). Waiting for 'end' alone
// is not enough: a request destroyed before anyone listens never says so again, so
// the wait would go on for good, holding the request's database connection.
function readBody(req, maxBytes, answerOverflow) {
  return new Promise((resolve, reject) => {
    const held = heldBodies.get(req);
    if (held) return takeHeldBody(req, held, maxBytes, resolve, reject);
    // Node destroys an IncomingMessage only once it is finished with, or when the
    // connection fails, so which of the two this is depends on whether it ended.
    if (req.readableEnded) return reject(new Error('Request body already read'));
    if (req.destroyed) return reject(new ClientGoneError());
    const chunks = [];
    let bytes = 0;
    let overflowed = false;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (overflowed) {
        // Still reading so the client can be answered; stop at twice the cap.
        if (bytes > maxBytes * 2) { reject(new Error('Payload too large')); req.destroy(); }
        return;
      }
      if (bytes > maxBytes) {
        if (answerOverflow) { overflowed = true; chunks.length = 0; return; }
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (overflowed) return reject(new Error('Payload too large'));
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => reject(new ClientGoneError(err)));
    // After 'end' or a refusal above, the promise has settled and this does nothing.
    req.on('close', () => reject(new ClientGoneError()));
  });
}

export function nowIso() {
  return new Date().toISOString();
}

// A request the caller got wrong, thrown deep inside a write (a sale's or a
// purchase order's lines) and answered as a 400 with its message by the route
// that catches it. Moved out of server.js (WP-0.4).
export class ValidationError extends Error {}
