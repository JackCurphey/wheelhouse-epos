// Times the customer website's search suggestions against a large catalogue
// (openspec/changes/website-browse, task 6.5 and design "Risks": the
// suggestions route is asked for at every key press). Run it by hand, on a
// database of your own made for it (scripts/new-db.sh, then npm run migrate
// with DATABASE_URL pointing at it), never on a shared one:
//
//   DATABASE_URL=<your own database> node scripts/dev/time-site-suggest.mjs 20000
//
// It makes one shop with two sites, then fills it with that many online
// products, a fifth of them sizes of a product with sizes, each with stock at
// both sites. Every name is a bracketed placeholder (no product data is
// invented); the words searched for are placed in some of them so the search
// has something to find ("zz" finds nothing; "[product" is in every name, the
// slowest case). It prints how long suggestAnswer takes, as the route calls
// it, inside the shop. Drop the database afterwards.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../../server/load-env.js';

const { pool, prepare, runWithShop } = await import('../../server/db.js');
const { createShop } = await import('../../server/auth.js');
const { suggestAnswer } = await import('../../server/site-products.js');

const ROUNDS = 20;
// What a customer types, a letter at a time, as the page asks after 250 ms.
const TYPED = ['br', 'bra', 'brak', 'brake', 'brake pad', 'zz', '[product'];

async function fill(count) {
  const { shop } = await createShop({ shopName: `[Timing ${count}]`, ownerName: '[Owner]', email: `timing-${count}-${Date.now()}@example.test`, password: 'timing-only-password' });
  await runWithShop(shop.id, async () => {
    await prepare("INSERT INTO sites (name, code) VALUES ('[Site 2]', 'BY')").run();
    const categories = ['[Stoppers]', '[Tyres]', '[Drivetrain]', '[Bearings]', '[Clothing]'];
    for (const name of categories) await prepare('INSERT INTO product_categories (name, path) VALUES (?, ?)').run(name, name);
    const groups = Math.floor(count / 25);
    await prepare(`INSERT INTO product_groups (name, category) SELECT '[Group ' || g || ']', '[Clothing]' FROM generate_series(1, ?) g`).run(groups);
    // One product in ten has "brake" in its name, one in fifty "brake pad".
    await prepare(
      `INSERT INTO products (sku, name, brand, category, price, cost, show_online, active, group_id, size, created_at, updated_at)
       SELECT '[sku ' || g || ']',
              '[Product ' || g || ']' || CASE WHEN g % 50 = 0 THEN ' brake pad' WHEN g % 10 = 0 THEN ' brake' ELSE '' END,
              '[Maker ' || (g % 40) || ']',
              (ARRAY['[Stoppers]','[Tyres]','[Drivetrain]','[Bearings]','[Clothing]'])[1 + g % 5],
              1 + (g % 200), 1, true, 1,
              CASE WHEN g % 5 = 0 THEN (SELECT id FROM product_groups ORDER BY id OFFSET (g / 25) % ? LIMIT 1) END,
              CASE WHEN g % 5 = 0 THEN '[Size ' || ((g / 5) % 5) || ']' END,
              now(), now()
         FROM generate_series(1, ?) g`
    ).run(Math.max(groups, 1), count);
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) SELECT s.id, p.id, p.id % 4 FROM sites s CROSS JOIN products p RETURNING product_id').run();
  });
  return shop;
}

async function time(shop, q) {
  const query = new URLSearchParams({ q });
  const took = [];
  for (let i = 0; i < ROUNDS; i += 1) {
    const start = performance.now();
    await runWithShop(shop.id, () => suggestAnswer({ query }));
    took.push(performance.now() - start);
  }
  took.sort((a, b) => a - b);
  return { median: took[Math.floor(ROUNDS / 2)], slowest: took[ROUNDS - 1] };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = Number(process.argv[2] ?? 5000);
  try {
    const shop = await fill(count);
    const online = await runWithShop(shop.id, () => prepare('SELECT count(*)::int AS n FROM products').get());
    console.log(`${online.n} online products, ${ROUNDS} rounds each`);
    for (const q of TYPED) {
      const { median, slowest } = await time(shop, q);
      console.log(`  "${q}": median ${median.toFixed(1)} ms, slowest ${slowest.toFixed(1)} ms`);
    }
  } finally {
    await pool.end();
  }
}
