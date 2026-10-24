// Writes scripts/dev/test-shop-drawings.json: the test shop's data from the
// drawings, for scripts/dev/load-test-shop.mjs (WP-0.5 task 3.6). The loader
// runs inside the app's image on the hosted copy, which doesn't carry the
// drawings' generator, so it reads this small file instead.
// tests/test-shop-snapshot.test.js fails when it no longer matches the
// drawings; then run:
//
//   node scripts/dev/snapshot-test-shop.mjs
import { writeFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SNAPSHOT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-shop-drawings.json');

// The week, the jobs, the pending booking, the change request and the services
// (diary.mjs), each job with its customer and bike as diary.mjs's own
// customerBikeOf() gives them.
export async function drawingsSnapshot() {
  const d = await import('../../docs/design/user-journeys/generator/diary.mjs');
  return JSON.parse(JSON.stringify({
    TODAY: d.TODAY,
    JOBS: d.JOBS.map((j) => ({ ...j, customerBike: d.customerBikeOf(j) })),
    UNSCHEDULED: d.UNSCHEDULED,
    PENDING_DIARY: d.PENDING_DIARY,
    REQUEST_OUTLINE: d.REQUEST_OUTLINE,
    SERVICE_OPTIONS: d.SERVICE_OPTIONS,
    SERVICE_GROUPS: d.SERVICE_GROUPS,
  }));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(await drawingsSnapshot(), null, 2)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), SNAPSHOT_FILE)}`);
}
