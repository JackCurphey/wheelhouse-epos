// The test shop for the hosted copy (WP-0.5, openspec/changes/add-hosted-copy,
// tasks group 1): scripts/dev/load-test-shop.mjs loads North Street Cycles
// from the drawings onto an empty database, and refuses anywhere else.
//
// Each test gets a throwaway database of its own (scripts/dev/new-db.mjs),
// migrated from empty, because the shared dev database always holds the
// suite's own test shops and the loader must refuse there. Making one needs a
// superuser: ADMIN_DATABASE_URL, or POSTGRES_SUPERUSER_PASSWORD from .env. CI
// sets one, so there the tests run; they are only skipped on a machine with
// neither (as in tests/migration-checks.test.js).
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';
import { JOBS } from '../docs/design/user-journeys/generator/diary.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOADER = path.join(ROOT, 'scripts/dev/load-test-shop.mjs');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');

function adminUrlOrSkip(t) {
  try {
    return adminUrlFrom(process.env);
  } catch (err) {
    if (process.env.CI) throw err;
    t.skip('no superuser connection configured');
    return null;
  }
}

let seq = 0;
// A migrated, empty database for one test, dropped afterwards.
async function scratch(t) {
  const admin = adminUrlOrSkip(t);
  if (!admin) return null;
  const name = `epos_testshop_${process.pid}_${++seq}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  execFileSync('node', [MIGRATE], { env, stdio: 'pipe' });
  const adminDb = new URL(admin);
  adminDb.pathname = `/${name}`;
  return { env, appUrl: url.href, adminUrl: adminDb.href };
}

// Runs the loader; returns { ok, out } rather than throwing on a refusal.
function load(env) {
  try {
    return { ok: true, out: execFileSync('node', [LOADER], { env, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

// Queries as the app's own role with one shop bound, so row-level security
// applies exactly as it does to the server.
async function asShop(url, shopId, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shopId)]);
    return await fn((sql, params) => client.query(sql, params).then((r) => r.rows));
  } finally {
    await client.end();
  }
}

async function shops(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try { return (await client.query('SELECT id, slug, name FROM shops ORDER BY id')).rows; } finally { await client.end(); }
}

async function counts(url, shopId) {
  return asShop(url, shopId, async (q) => {
    const n = async (table) => (await q(`SELECT COUNT(*)::int AS n FROM ${table}`))[0].n;
    return {
      employees: await n('employees'), customers: await n('customers'), bikes: await n('customer_bikes'),
      services: await n('workshop_services'), products: await n('products'), jobs: await n('workshop_jobs'),
    };
  });
}

test('loads North Street Cycles from the drawings onto an empty database', async (t) => {
  const db = await scratch(t);
  if (!db) return;
  const res = load(db.env);
  assert.ok(res.ok, res.out);

  const all = await shops(db.appUrl);
  assert.deepEqual(all.map((s) => s.name), ['North Street Cycles']);
  const shopId = all[0].id;

  // The drawings' example week, plus Sam Reed's pending request and WH-1046
  // with no time.
  assert.deepEqual(await counts(db.appUrl, shopId), {
    employees: 3, customers: 5, bikes: 5, services: 5, products: 1, jobs: JOBS.length + 2,
  });

  await asShop(db.appUrl, shopId, async (q) => {
    const [maya] = await q(
      `SELECT w.job_date, w.start_time, w.end_time, w.booking_state, w.work_state, w.custody_state,
              c.name AS customer, c.phone, c.email, trim(b.make || ' ' || b.model) AS bike, b.colour, e.name AS mechanic
         FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id JOIN customer_bikes b ON b.id = w.bike_id
         JOIN employees e ON e.id = w.mechanic_id WHERE w.reference = 'WH-1042'`);
    assert.deepEqual({ ...maya }, {
      job_date: '2026-09-17', start_time: '11:30', end_time: '13:00',
      booking_state: 'scheduled', work_state: 'in_progress', custody_state: 'in_shop',
      customer: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test',
      bike: 'Trek Domane AL 3', colour: 'green', mechanic: 'Alex Morgan',
    });
    const [service] = await q(
      `SELECT s.name, s.price::text FROM workshop_job_services j JOIN workshop_services s ON s.id = j.service_id
         JOIN workshop_jobs w ON w.id = j.workshop_job_id WHERE w.reference = 'WH-1042'`);
    assert.deepEqual({ ...service }, { name: 'Standard service', price: '65.00' });

    const [change] = await q(
      "SELECT booking_state, requested_job_date, requested_start_time, requested_end_time FROM workshop_jobs WHERE reference = 'WH-1052'");
    assert.deepEqual({ ...change }, {
      booking_state: 'reschedule_requested', requested_job_date: '2026-09-14', requested_start_time: '14:00', requested_end_time: '15:00',
    });
    const [cancelled] = await q("SELECT booking_state, cancelled_by FROM workshop_jobs WHERE reference = 'WH-1058'");
    assert.deepEqual({ ...cancelled }, { booking_state: 'cancelled', cancelled_by: 'customer' });
    const [waiting] = await q("SELECT work_state, custody_state FROM workshop_jobs WHERE reference = 'WH-1069'");
    assert.deepEqual({ ...waiting }, { work_state: 'waiting_parts', custody_state: 'in_shop' });
    const [pending] = await q(
      `SELECT w.booking_state, w.mechanic_id, w.job_date, w.start_time, w.end_time, c.name AS customer
         FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id WHERE w.title = 'Brake service'`);
    assert.deepEqual({ ...pending }, {
      booking_state: 'pending', mechanic_id: null, job_date: '2026-09-18', start_time: '10:00', end_time: '10:45', customer: 'Sam Reed',
    });
    // A customer's request accepts the booking terms, which is what puts it in
    // Waiting for you, as drawn there with the change request and the
    // cancellation (diary.mjs, WAITING).
    // In the drawn order, by when each arrived, as /api/workshop-waiting sorts
    // them (server/routes/workshop.js, waitingItem): a missing time counts as
    // the earliest, as new Date(null) does there.
    const waitingForYou = await q(
      `SELECT c.name FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id
        WHERE (w.booking_state = 'pending' AND w.terms_accepted_at IS NOT NULL)
           OR (w.booking_state = 'reschedule_requested' AND w.requested_job_date IS NOT NULL)
           OR (w.booking_state = 'cancelled' AND w.cancelled_by = 'customer' AND w.cancellation_seen_at IS NULL)
        ORDER BY COALESCE(CASE w.booking_state WHEN 'pending' THEN w.created_at
                   WHEN 'reschedule_requested' THEN w.requested_at ELSE w.cancelled_at END, 'epoch'), w.id`);
    assert.deepEqual(waitingForYou.map((r) => r.name), ['Sam Reed', 'Oliver Chen', 'Aisha Khan']);

    // The two jobs whose drawn title names no customer have one all the same
    // (diary.mjs, CUSTOMER_OVERRIDE): WH-1040 is booked in, on Hook 1.
    const owners = await q(
      `SELECT w.reference, c.name, trim(b.make || ' ' || b.model) AS bike FROM workshop_jobs w
         JOIN customers c ON c.id = w.customer_id JOIN customer_bikes b ON b.id = w.bike_id
        WHERE w.reference IN ('WH-1038', 'WH-1040') ORDER BY w.reference`);
    assert.deepEqual(owners.map((r) => ({ ...r })), [
      { reference: 'WH-1038', name: 'Jamie Brooks', bike: 'Giant Escape 2' },
      { reference: 'WH-1040', name: 'Aisha Khan', bike: 'Cannondale Quick' },
    ]);

    // WH-1046 sits in the no-time row, in the shared queue (diary.mjs, UNSCHEDULED).
    const [untimed] = await q(
      `SELECT w.title, w.mechanic_id, w.start_time, w.planned_minutes, w.job_date FROM workshop_jobs w WHERE w.reference = 'WH-1046'`);
    assert.deepEqual({ ...untimed }, { title: 'Standard service', mechanic_id: null, start_time: null, planned_minutes: 60, job_date: '2026-09-17' });
    const [pads] = await q('SELECT name, sku, price::text FROM products');
    assert.deepEqual({ ...pads }, { name: 'Shimano brake pads', sku: 'B05S-RX', price: '28.00' });

    // Every drawn number is used as drawn. The pending request, which has
    // none, takes the next one, and new jobs carry on after it.
    const highest = Math.max(...JOBS.map((j) => Number(j.job.slice(3))));
    const refs = (await q('SELECT reference FROM workshop_jobs')).map((r) => r.reference).sort();
    assert.deepEqual(refs, [...JOBS.map((j) => j.job), 'WH-1046', `WH-${highest + 1}`].sort());
    const [{ reference }] = await q("SELECT reference FROM workshop_jobs WHERE title = 'Brake service'");
    assert.equal(reference, `WH-${highest + 1}`);
    const [{ next_job_number: next }] = await q('SELECT next_job_number FROM shops WHERE id = $1', [shopId]);
    assert.equal(next, highest + 2);

    // What createShop() gives every new shop (server/auth.js), so the test
    // shop behaves like one made through sign-up.
    assert.deepEqual((await q('SELECT name FROM customer_groups ORDER BY name')).map((r) => r.name), ['ACC', 'Blue Light']);
    assert.equal((await q('SELECT full_day_threshold_minutes FROM workshop_settings'))[0].full_day_threshold_minutes, 0);
    assert.equal((await q('SELECT COUNT(*)::int AS n FROM label_settings'))[0].n, 1);
    assert.equal((await q('SELECT COUNT(*)::int AS n FROM shop_theme'))[0].n, 1);
    assert.deepEqual((await q('SELECT name FROM suppliers')).map((r) => r.name), ['Madison (mock)']);
  });

  // No login: Jack's is given to him privately (spec, "Jack can sign in").
  const client = new pg.Client({ connectionString: db.appUrl });
  await client.connect();
  try { assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM logins')).rows[0].n, 0); } finally { await client.end(); }
});

test('loading it twice is refused, and nothing is duplicated or changed', async (t) => {
  const db = await scratch(t);
  if (!db) return;
  assert.ok(load(db.env).ok);
  const [shop] = await shops(db.appUrl);
  const before = await counts(db.appUrl, shop.id);

  const again = load(db.env);
  assert.equal(again.ok, false);
  assert.match(again.out, /North Street Cycles is already loaded/);
  assert.equal((await shops(db.appUrl)).length, 1);
  assert.deepEqual(await counts(db.appUrl, shop.id), before);
});

test('it refuses a database that has any other shop, changing nothing', async (t) => {
  const db = await scratch(t);
  if (!db) return;
  const admin = new pg.Client({ connectionString: db.adminUrl });
  await admin.connect();
  try { await admin.query("INSERT INTO shops (slug, name) VALUES ('another-shop', 'Another shop')"); } finally { await admin.end(); }

  const res = load(db.env);
  assert.equal(res.ok, false);
  assert.match(res.out, /another-shop/);
  assert.deepEqual((await shops(db.appUrl)).map((s) => s.slug), ['another-shop']);
});

test("another shop can't see the test shop's rows", async (t) => {
  const db = await scratch(t);
  if (!db) return;
  assert.ok(load(db.env).ok);
  const admin = new pg.Client({ connectionString: db.adminUrl });
  await admin.connect();
  let otherId;
  try {
    otherId = (await admin.query("INSERT INTO shops (slug, name) VALUES ('another-shop', 'Another shop') RETURNING id")).rows[0].id;
  } finally { await admin.end(); }

  assert.deepEqual(await counts(db.appUrl, otherId), {
    employees: 0, customers: 0, bikes: 0, services: 0, products: 0, jobs: 0,
  });
});
