// Prints the route table, one "METHOD pattern" a line, in table order: the
// snapshot tests/route-list.test.js compares against. Run it and commit the
// result when a pull request adds, removes or renames a route:
//   node scripts/print-route-list.mjs > tests/fixtures/route-list.txt
// Spec: docs/superpowers/plans/2026-10-04-release-2-two-person-split.md §4.1
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Two route patterns can answer the same path when they have as many segments
// and every pair of segments is the same text or has a :param on either side
// (a :param matches any one non-empty segment, server.js route()).
export function routesOverlap(a, b) {
  const sa = a.split('/');
  const sb = b.split('/');
  if (sa.length !== sb.length) return false;
  const param = (seg) => seg.startsWith(':');
  return sa.every((seg, i) => seg === sb[i] || (param(seg) && sb[i] !== '') || (param(sb[i]) && seg !== ''));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await import('../server/load-env.js');
  const { listRoutes } = await import('../server/server.js');
  process.stdout.write(`${listRoutes().join('\n')}\n`);
}
