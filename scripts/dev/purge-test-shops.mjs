// One-off dev cleanup: removes leaked test shops from the development database.
//
// Every shop in a dev DB created by the test suite is disposable - the suite
// creates its own and is now (since the try/finally fix) meant to delete them
// again. This clears the backlog left by runs that failed before that fix,
// including the deliberate mutation runs the implementation plan requires.
//
// Uses the same deleteTestShop() the tests use, so child rows go in the right
// order, plus purgeAttachmentFiles() so uploaded files do not outlive their
// rows on disk.
//
// Refuses to run against anything that does not look like a development
// database - check the printed summary before answering the prompt.
import { createInterface } from 'node:readline/promises';
import '../../server/load-env.js';

const { pool, runWithShop, prepare } = await import('../../server/db.js');
const { deleteTestShop } = await import('../../tests/helpers/testShop.js');
const { purgeAttachmentFiles } = await import('../../tests/helpers/workshopFixtures.js');

const { rows: shops } = await pool.query('SELECT id, slug FROM shops ORDER BY id');

// A shop the test suite created. A real shop would not be named like this,
// so anything that fails to match is the signal to stop.
const TEST_SLUG = /^(test|reserve|probe|demo|workshop-api-test)[-_]/;

// Products alone do not mean real use - the Shopify sync tests seed a
// "Trail Bike" fixture. Sales do: a sale means money was recorded against
// this database, which no test suite should be doing to something you care
// about losing.
let products = 0, sales = 0;
for (const s of shops) {
  const n = await runWithShop(s.id, async () => ({
    p: (await prepare('SELECT COUNT(*)::int AS n FROM products').get()).n,
    s: (await prepare('SELECT COUNT(*)::int AS n FROM sales').get()).n,
  }));
  products += n.p;
  sales += n.s;
}
const notTestShaped = shops.filter((s) => !TEST_SLUG.test(s.slug));

console.log(`shops:    ${shops.length} (${notTestShaped.length} not test-shaped)`);
console.log(`products: ${products}`);
console.log(`sales:    ${sales}`);
console.log(`database: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') ?? '(DATABASE_URL unset)'}`);

if (sales > 0) {
  console.error('\nREFUSING: this database records sales, so it is not disposable test data.');
  await pool.end();
  process.exit(1);
}
if (notTestShaped.length > 0) {
  console.error('\nREFUSING: these shops are not named like test shops, so this may not be a test database:');
  for (const s of notTestShaped.slice(0, 20)) console.error(`  ${s.slug}`);
  if (notTestShaped.length > 20) console.error(`  ...and ${notTestShaped.length - 20} more`);
  await pool.end();
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`\nDelete all ${shops.length} shops and everything under them? Type 'delete' to confirm: `);
rl.close();
if (answer.trim() !== 'delete') {
  console.log('Aborted - nothing was deleted.');
  await pool.end();
  process.exit(0);
}

let ok = 0;
const failed = [];
for (const s of shops) {
  try {
    await purgeAttachmentFiles(s.id);
    await deleteTestShop(s.id);
    ok++;
  } catch (err) {
    failed.push(`${s.slug}: ${err.message.slice(0, 100)}`);
  }
}

const { rows: after } = await pool.query('SELECT COUNT(*)::int AS n FROM shops');
console.log(`\ndeleted ${ok}, failed ${failed.length}, shops remaining ${after[0].n}`);
for (const f of failed) console.log('  FAILED', f);
await pool.end();
