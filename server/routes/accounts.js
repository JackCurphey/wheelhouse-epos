// Accounts software (openspec/changes/reports-accounts-and-reopen, accounts-software spec): connect Xero or
// QuickBooks (a pretend service until Jack says yes to a real account), choose the account each line of a day's
// summary goes to, and disconnect, keeping the choices. Owner only until roles (WP-1.1). Every handler asks
// ownerOnly first and reads through the request's shop (row-level security).
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { sendJson, readJsonBody } from '../lib/http.js';
import { prepare } from '../db.js';
import { accounts, isProvider, providerName, PROVIDERS } from '../accounts/index.js';
import { accountLines } from '../accounts/lines.js';

const OWNER_ONLY = "Only the shop's owner can connect accounts software";
const iso = (v) => new Date(v).toISOString();

async function connection() {
  return prepare(
    `SELECT c.provider, c.status, c.connected_at, c.disconnected_at, l.name AS connected_by_name
       FROM accounts_connections c JOIN logins l ON l.id = c.connected_by`
  ).get();
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
  const offered = await accounts().listAccounts(live.provider);
  const chosen = new Map((await prepare('SELECT line_key, account_id, account_name FROM accounts_choices').all()).map((r) => [r.line_key, r]));
  const groups = (await accountLines()).map((g) => ({
    ...g,
    lines: g.lines.map((l) => ({ ...l, accountId: chosen.get(l.key)?.account_id ?? null, accountName: chosen.get(l.key)?.account_name ?? null })),
  }));
  const missing = groups.flatMap((g) => g.lines).filter((l) => l.recorded && l.accountId === null).length;
  return {
    status: live.status,
    connection: { provider: live.provider, providerName: name, connectedByName: live.connected_by_name, connectedAt: iso(live.connected_at) },
    // The pretend service says so: nothing leaves Wheelhouse until a real account is set up.
    practice: true,
    accounts: offered, groups, missing,
    summary: `Connected to ${name}${missing ? ` · ${plural(missing)}` : ''}`,
  };
}

export function register(route) {
  // screens: rp-accounts-connect, rp-accounts-map, rp-accounts-missing
  route('GET', '/api/accounts', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    sendJson(res, 200, await state());
  });

  // Connect Xero or QuickBooks. A shop that disconnected, or lost its connection, connects again (its choices
  // are kept; a different service doesn't offer the same accounts, so they start empty).
  // screens: rp-accounts-connect
  route('POST', '/api/accounts/connect', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    const body = await readJsonBody(req);
    const provider = body && typeof body === 'object' ? body.provider : undefined;
    if (!isProvider(provider)) return sendJson(res, 400, { error: 'Choose Xero or QuickBooks' });
    const existing = await connection();
    if (existing?.status === 'connected') return sendJson(res, 409, { error: 'Already connected' });
    await accounts().connect(provider);
    if (existing && existing.provider !== provider) await prepare('DELETE FROM accounts_choices').run();
    await prepare(
      `INSERT INTO accounts_connections (provider, status, connected_by, connected_at, disconnected_at) VALUES (?, 'connected', ?, now(), NULL)
       ON CONFLICT (shop_id) DO UPDATE SET provider = EXCLUDED.provider, status = 'connected', connected_by = EXCLUDED.connected_by, connected_at = now(), disconnected_at = NULL`
    ).run(provider, ctx.login.id);
    sendJson(res, 200, await state());
  });

  // Choose, or clear (accountId null), the account for one line.
  // screens: rp-accounts-map, rp-accounts-missing
  route('PUT', '/api/accounts/choices', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'Send the line and its account' });
    const conn = await connection();
    if (!conn || conn.status === 'disconnected') return sendJson(res, 409, { error: 'Connect accounts software first' });
    const known = (await accountLines()).flatMap((g) => g.lines).some((l) => l.key === body.line);
    if (!known) return sendJson(res, 400, { error: 'That isn’t one of the lines' });
    if (body.accountId === null) {
      await prepare('DELETE FROM accounts_choices WHERE line_key = ?').run(body.line);
      return sendJson(res, 200, await state());
    }
    const offered = (await accounts().listAccounts(conn.provider)).find((a) => a.id === body.accountId);
    if (!offered) return sendJson(res, 400, { error: `That account isn’t one ${providerName(conn.provider)} offers` });
    await prepare(
      `INSERT INTO accounts_choices (line_key, account_id, account_name) VALUES (?, ?, ?)
       ON CONFLICT (shop_id, line_key) DO UPDATE SET account_id = EXCLUDED.account_id, account_name = EXCLUDED.account_name, updated_at = now()`
    ).run(body.line, offered.id, offered.name);
    sendJson(res, 200, await state());
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
