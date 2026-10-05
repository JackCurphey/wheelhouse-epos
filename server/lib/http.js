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
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function makeRateLimiter(max, windowMs) {
  const hits = new Map(); // key -> { count, resetAt }
  return {
    check(key) {
      const now = Date.now();
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

export function sendJson(res, status, data) {
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
  return new Promise((resolve, reject) => {
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
      if (bytes === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function readRawBody(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function nowIso() {
  return new Date().toISOString();
}
