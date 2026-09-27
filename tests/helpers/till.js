import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../../server/db.js';
import { hashPassword, createSession, SESSION_COOKIE } from '../../server/auth.js';
import { staffRequest } from './staff.js';

// A non-owner login in the given shop, for 403 checks.
export async function staffLogin(shopId) {
  const email = `staff-${randomUUID().slice(0, 8)}@example.test`;
  const { rows: [login] } = await pool.query(
    `INSERT INTO logins (shop_id, name, email, password_hash, is_owner, active)
     VALUES ($1, 'Staff', $2, $3, false, true) RETURNING id`,
    [shopId, email, hashPassword('not-used-in-tests')]
  );
  const token = await createSession(login.id);
  return { cookie: `${SESSION_COOKIE}=${token}` };
}

export async function registerTill(baseUrl, owner, { siteCode = 'B', number = 1 } = {}) {
  const sites = (await staffRequest(baseUrl, owner.cookie, '/api/sites')).body;
  let site = sites.find((s) => s.code === siteCode);
  if (!site) {
    site = (await staffRequest(baseUrl, owner.cookie, '/api/sites', {
      method: 'POST', body: { name: `Site ${siteCode}`, code: siteCode },
    })).body;
  }
  const res = await staffRequest(baseUrl, owner.cookie, '/api/tills', {
    method: 'POST', body: { siteId: site.id, number, name: `Till ${number}` },
  });
  if (res.status !== 201) throw new Error(`registerTill: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, site };
}

// A request as a till: bearer token, under /api/till/:shopSlug.
export async function tillRequest(baseUrl, shopSlug, token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${baseUrl}/api/till/${shopSlug}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export async function seedProduct(shopId, { name = 'Inner tube', price = '6.99', stock = 5, vatRateBp = 2000 } = {}) {
  return runWithShop(shopId, async () => (await prepare(
    'INSERT INTO products (sku, name, price, cost, stock_qty, vat_rate_bp) VALUES (?, ?, ?, 0, ?, ?)'
  ).run(`SKU-${randomUUID().slice(0, 8)}`, name, price, stock, vatRateBp)).lastInsertRowid);
}
