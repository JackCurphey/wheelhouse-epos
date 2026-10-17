// Loads the hosted copy's test shop, North Street Cycles, from the drawings
// (WP-0.5, openspec/changes/add-hosted-copy: design decision 7, tasks group 1).
// Run it by hand, once, on an empty database:
//
//   node scripts/dev/load-test-shop.mjs
//
// Every value comes from the drawings (docs/design/user-journeys/generator/),
// listed with its source in the change's design.md; where they give none the
// shop has a bracketed placeholder or nothing. The jobs, the week, the pending
// booking, the change request and the services are read from diary.mjs itself,
// so they can't drift from what is drawn. No login: Jack's is given to him
// privately (spec, "Jack can sign in").
//
// It refuses, changing nothing, when the test shop is already loaded or when
// the database has any other shop. It writes through the server's own
// database helpers inside one transaction, with the shop bound, so row-level
// security applies as it does to the server.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../../server/load-env.js';

const { pool, prepare, dbExec, runWithShop } = await import('../../server/db.js');
const { createWorkshopJob, syncJobHold } = await import('../../server/workshop/jobs.js');
const { nowIso } = await import('../../server/lib/http.js');
const { shopToday } = await import('../../server/clock.js');
const { TODAY, JOBS, UNSCHEDULED, PENDING_DIARY, REQUEST_OUTLINE, SERVICE_OPTIONS, SERVICE_GROUPS, customerBikeOf } =
  await import('../../docs/design/user-journeys/generator/diary.mjs');

const SHOP = { slug: 'north-street-cycles', name: 'North Street Cycles' }; // app-map.mjs:17
const SITE = { name: 'Bolton', code: 'B' }; // book.mjs:224, sites.mjs:17
// setup.mjs:208. Jo and Alex each have a diary column; Alex can use the till.
const STAFF = [
  { name: 'Jack Lewis', mechanic: 0, cashier: 0 },
  { name: 'Jo Taylor', mechanic: 1, cashier: 0 },
  { name: 'Alex Morgan', mechanic: 1, cashier: 1 },
];
const MECHANIC = { Alex: 'Alex Morgan', Jo: 'Jo Taylor' };
// customer.mjs:151, :21; Oliver's colour diary.mjs:1929. The other phones are
// drawn as "[phone]".
const CUSTOMERS = [
  { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: ['Trek', 'Domane AL 3'], colour: 'green', notes: 'black mudguards' },
  { name: 'Oliver Chen', phone: '[phone]', bike: ['Brompton', 'C Line'], colour: 'black' },
  { name: 'Sam Reed', phone: '[phone]', bike: ['Specialized', 'Sirrus'] },
  { name: 'Jamie Brooks', phone: '[phone]', bike: ['Giant', 'Escape 2'] },
  { name: 'Aisha Khan', phone: '[phone]', bike: ['Cannondale', 'Quick'] },
];
// Only the Standard service has a price in the drawings (diary.mjs:341); the
// rest are drawn "[£ price]" (browse.mjs:80), and a price can't hold a
// placeholder, so they are £0.00 (Jack, 16 Oct, docs/decisions/2026-10-16-test-shop-defaults.md).
const PRICES = { 'Standard service': '65.00' };
const PRODUCT = { name: 'Shimano brake pads', sku: 'B05S-RX', price: '28.00' }; // diary.mjs:342

// The drawn week is Mon 14 to Sun 20 September 2026 (diary.mjs:388). It moves
// to the week the shop is loaded, each job on its own weekday, so the diary
// opens on it (Jack, 16 Oct, docs/decisions/2026-10-16-test-shop-defaults.md).
// The shop's today is read in its time zone, the default Europe/London (033).
const today = new Date(`${shopToday('Europe/London')}T00:00:00Z`);
const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 86_400_000);
const dateOf = (day) => new Date(monday.getTime() + day * 86_400_000).toISOString().slice(0, 10);
const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// A drawn job's colour sets its states (diary.mjs:57); "Booked in" and "In
// the workshop" are the Expected colour with the bike here (diary.mjs:485).
function statesOf(job) {
  const s = { bookingState: 'scheduled', workState: 'not_started', custodyState: 'expected' };
  if (job.key === 'waiting') return { ...s, workState: 'waiting_parts', custodyState: 'in_shop' };
  if (job.key === 'ready') return { ...s, workState: 'complete', custodyState: 'in_shop' };
  if (job.key === 'hold') return { ...s, bookingState: 'reschedule_requested' };
  if (job.key === 'cancelled') return { ...s, bookingState: 'cancelled' };
  if (job.stage === 'Booked in') return { ...s, custodyState: 'in_shop' };
  if (job.stage === 'In the workshop') return { ...s, workState: 'in_progress', custodyState: 'in_shop' };
  return s;
}

// Why the database isn't one to load onto, or null.
async function refusal() {
  const { rows } = await pool.query('SELECT slug FROM shops ORDER BY id');
  if (rows.some((r) => r.slug === SHOP.slug)) return `${SHOP.name} is already loaded. Nothing was changed.`;
  if (rows.length) {
    return `This database already has other shops (${rows.map((r) => r.slug).join(', ')}). `
      + 'The test shop only loads onto an empty one. Nothing was changed.';
  }
  return null;
}

async function loadShop(shopId) {
  const run = (sql, ...params) => prepare(sql).run(...params);
  // Waiting for you lists by when each item arrived (server/routes/workshop.js,
  // waitingItem). The drawings give no times, only an order (diary.mjs,
  // WAITING): Sam Reed's request, Oliver Chen's change, Aisha Khan's
  // cancellation. So they arrive a second apart, in that order, at loading.
  const loadedAt = Date.parse(nowIso());
  const arrived = (n) => new Date(loadedAt + n * 1000).toISOString();
  const id = async (sql, ...params) => (await prepare(sql).run(...params)).lastInsertRowid;

  await run('INSERT INTO shops (id, slug, name) VALUES (?, ?, ?)', shopId, SHOP.slug, SHOP.name);
  // What createShop() gives every new shop (server/auth.js), less the login.
  await run("INSERT INTO customer_groups (name) VALUES ('Blue Light'), ('ACC')");
  await run('INSERT INTO workshop_settings (full_day_threshold_minutes) VALUES (0)');
  await run('INSERT INTO label_settings DEFAULT VALUES');
  await run('INSERT INTO shop_theme DEFAULT VALUES');
  await run("INSERT INTO suppliers (name, adapter_type, config) VALUES ('Madison (mock)', 'mock_csv', '{}'::jsonb)");

  await run('INSERT INTO sites (name, code) VALUES (?, ?)', SITE.name, SITE.code);
  const staff = {};
  for (const s of STAFF) {
    staff[s.name] = await id('INSERT INTO employees (name, is_mechanic, is_cashier) VALUES (?, ?, ?)', s.name, s.mechanic, s.cashier);
  }
  const customers = {};
  for (const c of CUSTOMERS) {
    const customerId = await id('INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)', c.name, c.phone, c.email ?? '');
    const bikeId = await id(
      'INSERT INTO customer_bikes (customer_id, make, model, colour, notes) VALUES (?, ?, ?, ?, ?)',
      customerId, c.bike[0], c.bike[1], c.colour ?? '', c.notes ?? '',
    );
    customers[c.name] = { customerId, bikeId };
  }

  // The four drawn in New job (diary.mjs:329), in their groups (:336), and
  // the Gear service the week uses at 90 minutes (:402).
  const lengths = new Map(SERVICE_OPTIONS);
  for (const j of JOBS) if (!lengths.has(j.svc)) lengths.set(j.svc, j.dur);
  const services = {};
  for (const [position, [group, kind]] of [['Full service', 'full'], ['Individual service', 'individual']].entries()) {
    const categoryId = await id('INSERT INTO workshop_service_categories (name, position) VALUES (?, ?)', group, position);
    for (const [i, name] of SERVICE_GROUPS[group].entries()) {
      services[name] = await id(
        'INSERT INTO workshop_services (name, price, minutes, kind, category_id, position) VALUES (?, ?, ?, ?, ?, ?)',
        name, PRICES[name] ?? '0.00', lengths.get(name), kind, categoryId, i,
      );
    }
  }
  for (const [name, minutes] of lengths) {
    if (!services[name]) {
      services[name] = await id('INSERT INTO workshop_services (name, price, minutes) VALUES (?, ?, ?)', name, PRICES[name] ?? '0.00', minutes);
    }
  }
  await run('INSERT INTO products (name, sku, price) VALUES (?, ?, ?)', PRODUCT.name, PRODUCT.sku, PRODUCT.price);

  // The week's jobs, each with its drawn WH number and customer: the drawings'
  // own customerBikeOf(), which also gives WH-1038 and WH-1040 theirs.
  for (const j of JOBS) {
    const customer = customers[customerBikeOf(j)[0]] ?? { customerId: null, bikeId: null };
    const jobId = await createWorkshopJob({
      title: customer.customerId ? j.svc : j.title,
      customerId: customer.customerId, bikeId: customer.bikeId, mechanicId: staff[MECHANIC[j.mech]],
      jobDate: dateOf(j.day), startTime: hhmm(j.start), endTime: hhmm(j.start + j.dur),
      ...statesOf(j), serviceIds: [services[j.svc]],
    });
    await run('UPDATE workshop_jobs SET reference = ? WHERE id = ?', j.job, jobId);
    if (j.key === 'cancelled') {
      // Cancelled by the customer (diary.mjs:414).
      await run("UPDATE workshop_jobs SET cancelled_by = 'customer', cancelled_at = ? WHERE id = ?", arrived(2), jobId);
    }
    if (j.key === 'hold') {
      // The customer asked for 14:00 the same day (diary.mjs:516), with the
      // same mechanic: the drawing names no other.
      const r = REQUEST_OUTLINE;
      await run(
        `UPDATE workshop_jobs SET requested_job_date = ?, requested_start_time = ?, requested_end_time = ?, requested_mechanic_id = mechanic_id,
           requested_at = ? WHERE id = ?`,
        dateOf(r.day), hhmm(r.start), hhmm(r.start + r.dur), arrived(1), jobId,
      );
      await syncJobHold(jobId);
    }
  }
  // WH-1046, the Standard service with no time, in the shared queue
  // (diary.mjs, UNSCHEDULED). It is drawn on every week's no-time row, so it
  // goes on the drawings' "today".
  for (const u of UNSCHEDULED) {
    const jobId = await createWorkshopJob({
      title: u.title, customerId: null, bikeId: null, mechanicId: null,
      jobDate: dateOf(TODAY), startTime: null, endTime: null,
      bookingState: 'scheduled', workState: 'not_started', custodyState: 'expected',
      plannedMinutes: lengths.get(u.title), serviceIds: [services[u.title]],
    });
    await run('UPDATE workshop_jobs SET reference = ? WHERE id = ?', u.job, jobId);
  }
  // New jobs carry on after the highest drawn number.
  const highest = Math.max(...JOBS.map((j) => Number(j.job.slice(3))));
  await run('UPDATE shops SET next_job_number = ? WHERE id = ?', highest + 1, shopId);
  // Sam Reed's request, waiting for staff, with no mechanic (diary.mjs:511).
  // The drawing gives it no number, so it takes the next one, as a booking
  // would. Made online, it accepted the booking terms, which is what puts it
  // in Waiting for you.
  const p = PENDING_DIARY;
  const sam = customers[p.customer];
  const samJob = await createWorkshopJob({
    title: p.jobTitle, customerId: sam.customerId, bikeId: sam.bikeId, mechanicId: null,
    jobDate: dateOf(p.day), startTime: hhmm(p.start), endTime: hhmm(p.start + p.dur),
    bookingState: 'pending', workState: 'not_started', custodyState: 'expected', serviceIds: [services[p.jobTitle]],
    termsAcceptedAt: arrived(0),
  });
  await run('UPDATE workshop_jobs SET created_at = ? WHERE id = ?', arrived(0), samJob);
}

export async function main() {
  const why = await refusal();
  if (why) {
    console.error(`Refused: ${why}`);
    return 1;
  }
  const { rows: [{ id: shopId }] } = await pool.query("SELECT nextval('shops_id_seq')::int AS id");
  await runWithShop(shopId, async () => {
    await dbExec('BEGIN');
    try {
      await loadShop(shopId);
      await dbExec('COMMIT');
    } catch (err) {
      await dbExec('ROLLBACK');
      throw err;
    }
  });
  console.log(`Loaded ${SHOP.name}: ${JOBS.length + 1} workshop jobs from the drawings' week.`);
  return 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let code = 1;
  try {
    code = await main();
  } finally {
    await pool.end();
  }
  process.exit(code);
}
