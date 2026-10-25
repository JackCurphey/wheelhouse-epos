// Removes a shop and everything in it (add-hosted-copy design 7, task 3.6c):
// on the hosted copy, the shop made at sign-up, so the drawings' test shop can
// be loaded (the loader only loads onto a copy with no shops). On the server
// (docs/runbooks/hosted-copy.md, "Loading the test shop"):
//
//   docker compose exec app node server/scripts/remove-shop.mjs --shop <address> --confirm <address>
//
// The address is typed twice on purpose: without the second, or with it
// different, it only says what it would remove. There is no undo.
import '../load-env.js';
import { parseArgs } from 'node:util';
import { pool } from '../db.js';
import { removeShop, shopSummary } from '../remove-shop.js';

const USAGE = 'Usage: node server/scripts/remove-shop.mjs --shop <address> --confirm <address>';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

let code = 1;
try {
  const { values } = parseArgs({ options: { shop: { type: 'string' }, confirm: { type: 'string' } } });
  if (!values.shop) {
    console.error(USAGE);
  } else {
    const { rows: [shop] } = await pool.query('SELECT id, name, slug FROM shops WHERE slug = $1', [values.shop]);
    if (!shop) {
      console.error(`Refused: no shop at ${values.shop}. Nothing was removed.`);
    } else if (values.confirm !== shop.slug) {
      const s = await shopSummary(shop.id);
      console.error(`Refused: nothing was removed. This would remove ${shop.name} (${shop.slug}): ${plural(s.logins, 'login')}, ${plural(s.jobs, 'workshop job')}, ${plural(s.customers, 'customer')}, and everything else in it. There is no undo.`);
      console.error(`To remove it, type its address a second time: --shop ${shop.slug} --confirm ${shop.slug}`);
    } else {
      await removeShop(shop.id);
      console.log(`Removed ${shop.name} (${shop.slug}) and everything in it.`);
      code = 0;
    }
  }
} catch (err) {
  // A typing slip is a refusal, not a stack trace.
  if (!String(err.code ?? '').startsWith('ERR_PARSE_ARGS_')) throw err;
  console.error(`Refused: the command wasn’t typed as expected. Nothing was removed.\n${USAGE}`);
} finally {
  await pool.end();
}
process.exitCode = code;
