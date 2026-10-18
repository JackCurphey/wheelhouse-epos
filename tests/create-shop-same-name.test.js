// Two sign-ups with the same shop name at the same moment. uniqueSlug() used
// to look for a free address and then insert, so both sign-ups could see the
// same address as free and the second failed on shops_slug_key (23505)
// instead of getting "name-2". Each round uses its own name so rounds, and
// other test files running at the same time, don't share addresses.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { createShop } from '../server/auth.js';
import { pool } from '../server/db.js';
import { deleteTestShop } from './helpers/testShop.js';

const shopIds = [];

after(async () => {
  for (const id of shopIds) await deleteTestShop(id);
  await pool.end();
});

function signUp(shopName) {
  return createShop({
    shopName,
    ownerName: 'Owner',
    email: `owner-${randomUUID()}@example.test`,
    password: 'correct horse battery',
  });
}

test('two shops with the same name signing up at once both get an address', async () => {
  for (let round = 0; round < 10; round++) {
    const shopName = `Same Name ${randomUUID().slice(0, 8)}`;
    const results = await Promise.allSettled([signUp(shopName), signUp(shopName), signUp(shopName)]);
    for (const r of results) if (r.status === 'fulfilled') shopIds.push(r.value.shop.id);
    const failures = results.filter((r) => r.status === 'rejected').map((r) => `${r.reason.code}: ${r.reason.message}`);
    assert.deepEqual(failures, [], `round ${round}`);

    const base = shopName.toLowerCase().replace(/ /g, '-');
    const slugs = results.map((r) => r.value.shop.slug).sort();
    assert.deepEqual(slugs, [base, `${base}-2`, `${base}-3`], `round ${round}`);
  }
});
