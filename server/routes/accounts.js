// Accounts software (openspec/changes/reports-accounts-and-reopen, accounts-software spec): connect Xero or
// QuickBooks (a pretend service until Jack says yes to a real account), choose the account each line of a day's
// summary goes to, and disconnect, keeping the choices. Owner only until roles (WP-1.1). Every handler asks
// ownerOnly first and reads through the request's shop (row-level security).
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { sendJson, readJsonBody } from '../lib/http.js';
import { prepare } from '../db.js';
import { closeEntryNow } from '../lib/close-entry.js';
import { accounts, isProvider, providerName, PROVIDERS } from '../accounts/index.js';
import { accountLines } from '../accounts/lines.js';
import { sendWaitingDays } from '../accounts/send.js';

const OWNER_ONLY = "Only the shop's owner can connect accounts software";
const iso = (v) => new Date(v).toISOString();

async function connection() {
  return prepare(
    `SELECT c.provider, c.status, c.connected_at, c.disconnected_at, l.name AS connected_by_name
       FROM accounts_connections c LEFT JOIN logins l ON l.id = c.connected_by`
  ).get();
}

// The body as an object, or a 400 for a body that isn't JSON (undefined: already answered).
async function bodyOf(req, res) {
  try {
    return await readJsonBody(req);
  } catch (err) {
    if (err instanceof SyntaxError) { sendJson(res, 400, { error: 'Send the choice as JSON' }); return undefined; }
    throw err;
  }
}

const plural = (n) => `${n} ${n === 1 ? 'account' : 'accounts'} to choose`;

// What Settings › Your data › Accounts software shows: the connection, the accounts the service offers, each
// line with its choice, and how many recorded lines still need one.
async function state() {
  const conn = await connection();
  const live = conn && conn.status !== 'disconnected' ? conn : null;
  if (!live) {
    return { status: 'not_connected', connection: null, providers: PROVIDERS, summary: 'Not connected' };
  }
  const name = providerName(live.provider);
  const lost = live.status === 'lost';
  const offered = await accounts().listAccounts(live.provider);
  const chosen = new Map((await prepare('SELECT line_key, account_id, account_name FROM accounts_choices WHERE provider = ?').all(live.provider)).map((r) => [r.line_key, r]));
  const groups = (await accountLines()).map((g) => ({
    ...g,
    lines: g.lines.map((l) => ({ ...l, accountId: chosen.get(l.key)?.account_id ?? null, accountName: chosen.get(l.key)?.account_name ?? null })),
  }));
  const missing = groups.flatMap((g) => g.lines).filter((l) => l.recorded && l.accountId === null).length;
  // Days that couldn't go (not waiting: those wait for a connection, which says so itself).
  const needLook = (await prepare("SELECT count(*)::int AS n FROM accounts_sends a JOIN day_closes c ON c.id = a.close_id WHERE a.status = 'failed' AND c.reopened_at IS NULL").get()).n;
  return {
    status: live.status,
    connection: { provider: live.provider, providerName: name, connectedByName: live.connected_by_name ?? null, connectedAt: iso(live.connected_at) },
    // The pretend service says so: nothing leaves Wheelhouse until a real account is set up.
    practice: true,
    accounts: offered, groups, missing,
    lostOn: lost ? iso(live.disconnected_at) : null,
    needLook,
    summary: lost ? `${name} disconnected` : `Connected to ${name}${missing ? ` · ${plural(missing)}` : ''}${needLook ? ` · ${needLook} ${needLook === 1 ? 'day needs' : 'days need'} a look` : ''}`,
  };
}

export function register(route) {
  // screens: rp-accounts-connect, rp-accounts-map, rp-accounts-missing
  route('GET', '/api/accounts', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    sendJson(res, 200, await state());
  });

  // Connect Xero or QuickBooks. A shop that disconnected, or lost its connection, connects again (its choices
  // are kept, per service: a different service offers different accounts, so it starts with its own).
  // screens: rp-accounts-connect
  route('POST', '/api/accounts/connect', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    const body = await bodyOf(req, res);
    if (body === undefined) return;
    const provider = body && typeof body === 'object' ? body.provider : undefined;
    if (!isProvider(provider)) return sendJson(res, 400, { error: 'Choose Xero or QuickBooks' });
    const existing = await connection();
    if (existing?.status === 'connected') return sendJson(res, 409, { error: 'Already connected' });
    await accounts().connect(provider);
    await prepare(
      `INSERT INTO accounts_connections (provider, status, connected_by, connected_at, disconnected_at) VALUES (?, 'connected', ?, now(), NULL)
       ON CONFLICT (shop_id) DO UPDATE SET provider = EXCLUDED.provider, status = 'connected', connected_by = EXCLUDED.connected_by, connected_at = now(), disconnected_at = NULL`
    ).run(provider, ctx.login.id);
    // A day that waited goes now, oldest first.
    await sendWaitingDays();
    sendJson(res, 200, await state());
  });

  // Choose, or clear (accountId null), the account for one line.
  // screens: rp-accounts-map, rp-accounts-missing
  route('PUT', '/api/accounts/choices', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const body = await bodyOf(req, res);
    if (body === undefined) return;
    if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'Send the line and its account' });
    const conn = await connection();
    if (!conn || conn.status === 'disconnected') return sendJson(res, 409, { error: 'Connect accounts software first' });
    const known = (await accountLines()).flatMap((g) => g.lines).some((l) => l.key === body.line);
    if (!known) return sendJson(res, 400, { error: 'That isn’t one of the lines' });
    if (body.accountId === null) {
      await prepare('DELETE FROM accounts_choices WHERE provider = ? AND line_key = ?').run(conn.provider, body.line);
      return sendJson(res, 200, await state());
    }
    const offered = (await accounts().listAccounts(conn.provider)).find((a) => a.id === body.accountId);
    if (!offered) return sendJson(res, 400, { error: `That account isn’t one ${providerName(conn.provider)} offers` });
    await prepare(
      `INSERT INTO accounts_choices (provider, line_key, account_id, account_name) VALUES (?, ?, ?, ?)
       ON CONFLICT (shop_id, provider, line_key) DO UPDATE SET account_id = EXCLUDED.account_id, account_name = EXCLUDED.account_name, updated_at = now()`
    ).run(conn.provider, body.line, offered.id, offered.name);
    // A day that couldn't go for want of this account goes now.
    await sendWaitingDays();
    sendJson(res, 200, await state());
  });

  // What each day sent: newest first, the days that went, waited, couldn't go or are reopened, and today while open.
  // screens: rp-accounts-log, rp-accounts-lost
  route('GET', '/api/accounts/log', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const conn = await connection();
    if (!conn) return sendJson(res, 200, { connected: false, days: [] });
    const name = providerName(conn.provider);
    const labels = new Map((await accountLines()).flatMap((g) => g.lines).map((l) => [l.key, l.label]));
    const rows = await prepare(
      `SELECT to_char(a.day, 'YYYY-MM-DD') AS day, a.close_id, a.status, a.reason, a.failed_line, a.amount_pence, a.sent_at, a.not_recorded,
              c.closed_at, (c.reopened_at IS NOT NULL) AS reopened
         FROM accounts_sends a LEFT JOIN day_closes c ON c.id = a.close_id ORDER BY a.day DESC LIMIT 60`
    ).all();
    const days = rows.map((r) => ({
      day: r.day, closeId: r.close_id, closedAt: r.closed_at ? iso(r.closed_at) : null, amountPence: r.amount_pence, sentAt: r.sent_at ? iso(r.sent_at) : null,
      status: r.reopened ? 'reopened' : r.status, reason: r.reason, line: r.failed_line, missingLine: r.failed_line ? labels.get(r.failed_line) ?? r.failed_line : null,
      notRecorded: r.not_recorded,
      text: r.reopened ? 'Reopened: sent again when it is closed' : r.status === 'waiting' ? `sends when ${name} is reconnected` : r.status === 'failed' ? r.reason : null,
    }));
    const today = (await closeEntryNow()).day;
    if (!days.some((d) => d.day === today)) days.unshift({ day: today, closeId: null, closedAt: null, amountPence: null, sentAt: null, status: 'open', reason: null, line: null, missingLine: null, notRecorded: [], text: 'Not closed yet' });
    sendJson(res, 200, { connected: true, providerName: name, status: conn.status, days });
  });

  // Disconnect: nothing more is sent, what was sent stays, and the choices are kept in case they reconnect.
  // screens: rp-accounts-disconnect
  route('POST', '/api/accounts/disconnect', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const conn = await connection();
    if (!conn || conn.status === 'disconnected') return sendJson(res, 409, { error: 'Not connected' });
    await accounts().disconnect(conn.provider);
    await prepare("UPDATE accounts_connections SET status = 'disconnected', disconnected_at = now()").run();
    sendJson(res, 200, await state());
  });
}
