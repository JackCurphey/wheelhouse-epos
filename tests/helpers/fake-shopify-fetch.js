// Loaded into a spawned server with NODE_OPTIONS=--import=<this file>, so a
// test can see what the server sends to Shopify without a real shop.
//
// Only requests to a host ending in FAKE_SHOPIFY_SUFFIX are faked: each is
// written to stderr as one line, `FAKE_SHOPIFY <json>` (method, host, path,
// body), and answered 200 with `{}`. Every other request goes to the real
// fetch. Use it with startLiveServer's `env` and read `server.stderr`.
export const FAKE_SHOPIFY_SUFFIX = '.fake-shopify.invalid';

const realFetch = globalThis.fetch;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!url.hostname.endsWith(FAKE_SHOPIFY_SUFFIX)) return realFetch(input, init);
  let body = null;
  if (typeof init.body === 'string') {
    try { body = JSON.parse(init.body); } catch { body = init.body; }
  }
  process.stderr.write(`FAKE_SHOPIFY ${JSON.stringify({ method: init.method || 'GET', host: url.hostname, path: url.pathname, body })}\n`);
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};
