// WP-0.4's proof that moving the routes out of server.js changes nothing
// (split plan §4.1 step 4). Written before anything moves.
//
// 1. The route table holds exactly the routes in tests/fixtures/route-list.txt,
//    compared as a set: grouping routes by area changes their order.
// 2. No route shadows another. The dispatcher takes the first entry whose
//    method and pattern match, so order only matters if two patterns can
//    answer the same path. Checking that none can is what makes the order
//    safe to change, now and as routes are added.
//
// A pull request that adds, removes or renames a route updates the snapshot
// in the same pull request (node scripts/print-route-list.mjs), so every route
// change shows up in review.
// Spec: docs/superpowers/plans/2026-10-04-release-2-two-person-split.md §4.1
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../server/load-env.js';
import { listRoutes } from '../server/server.js';
import { routesOverlap } from '../scripts/print-route-list.mjs';

const snapshot = readFileSync(new URL('./fixtures/route-list.txt', import.meta.url), 'utf8')
  .split('\n').filter(Boolean);

test('the snapshot is the 161 routes it was taken with, each once', () => {
  assert.equal(snapshot.length, 161);
  assert.equal(new Set(snapshot).size, snapshot.length);
});

test('the route table holds exactly the snapshot\'s routes', () => {
  const live = listRoutes();
  assert.equal(new Set(live).size, live.length, 'a method and path is registered twice');
  const missing = snapshot.filter((r) => !live.includes(r));
  const added = live.filter((r) => !snapshot.includes(r));
  assert.deepEqual({ missing, added }, { missing: [], added: [] });
});

test('no route shadows another', () => {
  const live = listRoutes().map((r) => r.split(' '));
  const clashes = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const [ma, pa] = live[i];
      const [mb, pb] = live[j];
      if (ma === mb && routesOverlap(pa, pb)) clashes.push(`${ma} ${pa}  <->  ${pb}`);
    }
  }
  assert.deepEqual(clashes, []);
});

test('the overlap check itself tells overlapping patterns from separate ones', () => {
  assert.equal(routesOverlap('/api/jobs/:id', '/api/jobs/waiting'), true);
  assert.equal(routesOverlap('/api/jobs/:id', '/api/jobs/:jobId'), true);
  assert.equal(routesOverlap('/api/:area/list', '/api/jobs/:id'), true);
  assert.equal(routesOverlap('/api/jobs/:id', '/api/jobs/:id/start'), false);
  assert.equal(routesOverlap('/api/jobs/:id/start', '/api/jobs/:id/finish'), false);
  assert.equal(routesOverlap('/api/jobs', '/api/sales'), false);
  // A :param matches one non-empty segment, so it never meets an empty one.
  assert.equal(routesOverlap('/api/x/', '/api/x/:id'), false);
  assert.equal(routesOverlap('/api/x//y', '/api/x/:id/y'), false);
});
