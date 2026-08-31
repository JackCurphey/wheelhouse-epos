// Always-up gateway that sits in front of the real EPOS server
// (server.js). It proxies straight through while the app is reachable, and
// serves a friendly offline page instead of a raw connection error when it
// isn't - which only works because this is a separate, deliberately tiny
// process: if the offline page lived inside server.js itself, it couldn't
// say anything once that process crashed or wasn't started.
//
// Whatever reaches this app from outside the machine should point at this
// process's port (GATEWAY_PORT), not the app's port directly. Under Docker
// Compose that is the published 8080; there is deliberately no opinion
// here about what, if anything, sits further out.
import { createServer, request as httpRequest } from 'node:http';
import { pathToFileURL } from 'node:url';

const GATEWAY_PORT = process.env.GATEWAY_PORT ? Number(process.env.GATEWAY_PORT) : 8080;
const APP_PORT = process.env.APP_PORT ? Number(process.env.APP_PORT) : 4000;
// Overridable so this can reach the app by its Docker Compose service name
// (e.g. "app") when the two run as separate containers on the same
// network, rather than always assuming they share localhost.
const APP_HOST = process.env.APP_HOST || '127.0.0.1';
const PROXY_TIMEOUT_MS = 5000;

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Wheelhouse EPOS - Offline</title>
<meta http-equiv="refresh" content="15" />
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #f4f5f3; color: #1c231f;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 20px;
  }
  .card {
    max-width: 420px; width: 100%; background: #fff; border: 1px solid #e0e2dd; border-radius: 14px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    padding: 32px; text-align: center;
  }
  .logo { font-size: 40px; margin-bottom: 8px; }
  h1 { font-size: 19px; margin: 0 0 10px; color: #164f42; }
  p { font-size: 14px; line-height: 1.5; color: #6b7570; margin: 0 0 6px; }
  .retry { font-size: 12px; color: #6b7570; margin-top: 18px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🚲</div>
    <h1>Wheelhouse EPOS is offline</h1>
    <p>The till system isn't running on the shop PC right now.</p>
    <p>This page will refresh automatically once it's back.</p>
    <div class="retry">Checking again every 15 seconds…</div>
  </div>
</body>
</html>
`;

function sendOffline(res) {
  if (res.headersSent) return res.end();
  res.writeHead(503, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(OFFLINE_HTML),
    'Retry-After': '15',
  });
  res.end(OFFLINE_HTML);
}


// Forwarding metadata the app is allowed to believe has to be set here, by
// us, from the actual socket - never passed through from the caller. The
// app's rate limiter keys on the client IP, so a client that could set its
// own x-forwarded-for could hand itself a fresh key on every request and
// defeat the limit entirely. Anything a client sends in one of these is
// dropped on the floor first.
//
// The Cloudflare-shaped names are in here because the app used to sit
// behind a Cloudflare Tunnel, which set cf-connecting-ip authoritatively.
// It no longer does, so the header now carries no authority at all and is
// removed rather than forwarded.
const CLIENT_CONTROLLED_FORWARDING_HEADERS = [
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'true-client-ip',
  'x-real-ip',
  'forwarded',
];

export function buildProxyHeaders(headers, remoteAddress) {
  const out = { ...headers };
  for (const name of CLIENT_CONTROLLED_FORWARDING_HEADERS) delete out[name];
  out['x-forwarded-for'] = remoteAddress || '';
  // This hop is always plain http on the loopback/compose network. If TLS
  // is terminated in front of the gateway one day, that terminator is what
  // should set this - and the gateway would need to trust it explicitly,
  // the same way the app trusts the gateway via TRUST_PROXY.
  out['x-forwarded-proto'] = 'http';
  return out;
}

const server = createServer((req, res) => {
  const proxyReq = httpRequest(
    {
      host: APP_HOST,
      port: APP_PORT,
      path: req.url,
      method: req.method,
      headers: buildProxyHeaders(req.headers, req.socket.remoteAddress),
      timeout: PROXY_TIMEOUT_MS,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('timeout', () => proxyReq.destroy());
  proxyReq.on('error', () => sendOffline(res));
  req.pipe(proxyReq);
});

// Only bind a port when started directly (`node server/gateway.js`), so the
// helpers above can be imported by tests without standing up a server.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(GATEWAY_PORT, () => {
    console.log(`\n  Gateway listening on http://localhost:${GATEWAY_PORT}, proxying to http://${APP_HOST}:${APP_PORT}\n`);
  });
}
