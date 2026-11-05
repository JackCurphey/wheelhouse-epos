// A Shopify order's push to Shopify is queued before the order's own COMMIT
// (openspec/changes/stock-movements-say-who, design 4). If that COMMIT fails, the queued
// slot has to be settled, or stopping the server waits for a push that will never run.
// On a database of its own, as it adds a trigger that fails one made-up product's sale.
import '../server/load-env.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEBHOOK_SECRET = 'push-slot-test-secret';
const FAKE_SHOPIFY = new URL('./helpers/fake-shopify-fetch.js', import.meta.url).href;
const name = `epos_push_slot_${process.pid}`;
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${name}`;
let admin = null;
let server;
let shopId;
let c;

before(async () => {
  try {
    admin = adminUrlFrom(process.env);
  } catch (err) {
    if (process.env.CI) throw err;
    return;
  }
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  const env = { ...process.env, DATABASE_URL: url.href };
  execFileSync('node', [path.join(ROOT, 'server/migrations/run-migrations.js')], { env, stdio: 'pipe' });
  // Set before these load: db.js connects once, to whatever it finds.
  process.env.DATABASE_URL = url.href;
  const { encryptSecret } = await import('../server/shopify.js');
  const { startLiveServer } = await import('./helpers/liveServer.js');
  c = new pg.Client({ connectionString: url.href });
  await c.connect();
  shopId = (await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id")).rows[0].id;
  await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shopId)]);
  await c.query(
    "INSERT INTO shopify_connections (shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status) VALUES ($1, $2, $3, $4, $5, '1', 'connected')",
    [shopId, `slot-${shopId}.fake-shopify.invalid`, encryptSecret('fake-access-token'), encryptSecret('fake-storefront-token'), encryptSecret(WEBHOOK_SECRET)]
  );
  // Fails only at COMMIT, so everything in the order has already happened by then.
  await c.query(`CREATE FUNCTION fail_at_commit() RETURNS trigger AS $$ BEGIN
    IF NEW.name = '[Fails at commit]' THEN RAISE EXCEPTION 'failing at commit'; END IF; RETURN NULL; END $$ LANGUAGE plpgsql`);
  await c.query('CREATE CONSTRAINT TRIGGER fail_at_commit AFTER INSERT ON sale_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_at_commit()');
  server = await startLiveServer({ env: { DATABASE_URL: url.href, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${FAKE_SHOPIFY}`.trim() } });
});
after(async () => {
  if (server) await server.stop();
  if (c) await c.end();
  if (admin) await dropDatabase(admin, name);
  const { pool } = await import('../server/db.js');
  await pool.end();
});

function shopify(payload) {
  const body = JSON.stringify(payload);
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(body, 'utf8').digest('base64');
  return fetch(`${server.baseUrl}/webhooks/shopify/${shopId}/orders`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-shopify-hmac-sha256': hmac }, body });
}
const variant = () => 10_000_000 + Math.floor(Math.random() * 1e9);
const product = async (productName, variantId) => (await c.query(
  'INSERT INTO products (sku, name, price, stock_qty, shopify_variant_id, shopify_inventory_item_id) VALUES ($1, $2, 28, 6, $3, $3) RETURNING id',
  [`CODE-${variantId}`, productName, String(variantId)]
)).rows[0].id;
const orderOf = (variantId) => ({ id: Number(randomBytes(4).readUInt32BE(0)), order_number: 1001, total_discounts: '0', line_items: [{ variant_id: variantId, quantity: 1, price: '28.00' }] });
const pushedFor = (variantId) => server.stderr.split('\n').some((l) => l.startsWith('FAKE_SHOPIFY') && l.includes('inventory') && l.includes(String(variantId)));
const stockOf = async (id) => (await c.query('SELECT stock_qty FROM products WHERE id = $1', [id])).rows[0].stock_qty;

test('an ordinary order queues its push inside the cleanup, and says nothing about a slot', async (t) => {
  if (!server) return t.skip('no superuser connection configured');
  const v = variant();
  const id = await product('Shimano brake pads', v);
  assert.equal((await shopify(orderOf(v))).status, 200);
  assert.equal(await stockOf(id), 5);
  assert.ok(!server.stderr.includes('registerPendingShopifyPushSlot'), server.stderr.slice(-400));
  // Shopify is told, once the order is in.
  const deadline = Date.now() + 5000;
  while (!pushedFor(v) && Date.now() < deadline) await new Promise((resolve) => { setTimeout(resolve, 25); });
  assert.ok(pushedFor(v), server.stderr.slice(-400));
});

test('an order whose own COMMIT fails leaves nothing behind, and the server still stops at once', async (t) => {
  if (!server) return t.skip('no superuser connection configured');
  const v = variant();
  const id = await product('[Fails at commit]', v);
  assert.equal((await shopify(orderOf(v))).status, 500);
  assert.equal(await stockOf(id), 6);
  // Rolled back, so Shopify is told nothing.
  await new Promise((resolve) => { setTimeout(resolve, 200); });
  assert.ok(!pushedFor(v), 'no push for an order that didn’t go in');
  const started = Date.now();
  await server.stop();
  const stoppedIn = Date.now() - started;
  assert.ok(stoppedIn < 3000, `took ${stoppedIn}ms to stop`);
});
