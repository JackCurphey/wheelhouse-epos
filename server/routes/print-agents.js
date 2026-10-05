// Print agents: the shop's label printers and their print jobs (/api/print-agents).
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { badRequest, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { randomBytes } from 'node:crypto';

// Relays sticker print jobs from a browser tab to a print-agent process
// (print-agent/agent.js) running on any shop PC - possibly a different one
// than whichever machine the browser is on, so a printer physically wired
// to a stockroom PC can be reached from the till's browser too. Which
// devices are currently online and what's queued for each is inherently
// live/ephemeral state, not history worth a table for - an agent
// re-registers within one check-in interval of a server restart anyway, so
// this is plain in-memory state, keyed by shop id. Fine for this app's
// single-process deployment (see docker-compose.yml - one `app` service,
// no horizontal scaling to worry about).
//
// Every route here re-resolves the session itself via currentSession(req)
// (the same thing the dispatcher already calls before runWithShop) to get
// the shop id these maps are keyed by - the same pattern the customer
// portal's routes already use to get their own shop context inside a
// handler.

const printAgentsByShop = new Map(); // shopId -> Map<deviceId, {deviceName, printers, lastSeen}>
const printJobsByDevice = new Map(); // deviceId -> pending job array
const printJobStatus = new Map(); // jobId -> {status, error} - not surfaced in the UI yet, kept for a future job-history view
const PRINT_AGENT_STALE_MS = 25000; // ~2-3 missed check-ins before a device drops off the list

function liveAgentsForShop(shopId) {
  const byDevice = printAgentsByShop.get(shopId);
  if (!byDevice) return [];
  const now = Date.now();
  const live = [];
  for (const [deviceId, info] of byDevice) {
    if (now - info.lastSeen > PRINT_AGENT_STALE_MS) {
      byDevice.delete(deviceId);
      continue;
    }
    live.push({ deviceId, deviceName: info.deviceName, printers: info.printers });
  }
  return live;
}

export function register(route) {
  route('POST', '/api/print-agents/checkin', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    const deviceId = String(body.deviceId || '').trim();
    if (!deviceId) return badRequest(res, 'deviceId is required');
    const deviceName = String(body.deviceName || deviceId).trim().slice(0, 100) || deviceId;
    const printers = Array.isArray(body.printers) ? body.printers.filter((p) => typeof p === 'string' && p).slice(0, 50) : [];

    if (!printAgentsByShop.has(ctx.shop.id)) printAgentsByShop.set(ctx.shop.id, new Map());
    printAgentsByShop.get(ctx.shop.id).set(deviceId, { deviceName, printers, lastSeen: Date.now() });

    const jobs = printJobsByDevice.get(deviceId) || [];
    printJobsByDevice.set(deviceId, []);
    sendJson(res, 200, { jobs });
  });

  // What the sticker-print modal's printer dropdown reads.
  route('GET', '/api/print-agents', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    sendJson(res, 200, { agents: liveAgentsForShop(ctx.shop.id) });
  });

  route('POST', '/api/print-agents/:deviceId/jobs', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    // Only ever queue a job for a device this shop can currently see - stops
    // a stale or guessed deviceId (or one belonging to a different shop, by
    // construction, since it just wouldn't appear here) from ever receiving
    // a job.
    const known = liveAgentsForShop(ctx.shop.id).find((a) => a.deviceId === params.deviceId);
    if (!known) return badRequest(res, 'That device is not currently online for this shop');
    const body = await readJsonBody(req);
    const { printerName, widthMm, heightMm, pages } = body;
    if (!printerName || !known.printers.includes(printerName)) return badRequest(res, 'Unknown printer for that device');
    if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return badRequest(res, 'A valid label width and height are required');
    if (!Array.isArray(pages) || !pages.length) return badRequest(res, 'At least one label page is required');

    const jobId = randomBytes(8).toString('hex');
    if (!printJobsByDevice.has(params.deviceId)) printJobsByDevice.set(params.deviceId, []);
    printJobsByDevice.get(params.deviceId).push({ jobId, printerName, widthMm, heightMm, pages });
    printJobStatus.set(jobId, { status: 'queued' });
    sendJson(res, 201, { jobId });
  });

  // :printJobId, not :jobId - it is the hex id minted above, not a workshop
  // job's SERIAL id, and :jobId is checked as one (ID_PARAMS).
  route('POST', '/api/print-agents/jobs/:printJobId/complete', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    printJobStatus.set(params.printJobId, { status: body.ok ? 'done' : 'error', error: body.error });
    if (!body.ok) console.error(`Print job ${params.printJobId} failed: ${body.error}`);
    sendJson(res, 200, { ok: true });
  });
}
