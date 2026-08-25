// Always-up gateway that sits between the Cloudflare Tunnel and the real
// EPOS server (server.js). It proxies straight through while the app is
// reachable, and serves a friendly offline page instead of a raw connection
// error when it isn't - which only works because this is a separate,
// deliberately tiny process: if the offline page lived inside server.js
// itself, it couldn't say anything once that process crashed or wasn't
// started. Point the Cloudflare Tunnel's ingress at this process's port
// (GATEWAY_PORT), not at the app's port directly.
import { createServer, request as httpRequest } from 'node:http';

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

const server = createServer((req, res) => {
  const proxyReq = httpRequest(
    { host: APP_HOST, port: APP_PORT, path: req.url, method: req.method, headers: req.headers, timeout: PROXY_TIMEOUT_MS },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('timeout', () => proxyReq.destroy());
  proxyReq.on('error', () => sendOffline(res));
  req.pipe(proxyReq);
});

server.listen(GATEWAY_PORT, () => {
  console.log(`\n  Gateway listening on http://localhost:${GATEWAY_PORT}, proxying to http://${APP_HOST}:${APP_PORT}\n`);
});
