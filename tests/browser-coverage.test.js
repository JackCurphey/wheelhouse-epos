// Every screen the staff app builds is opened in a real browser, against the
// real server, by at least one Playwright spec. The screens' node tests answer
// with hand-written replies, so only a browser spec notices when a server
// reply changes shape (21 Oct review). The gap list below may only shrink: a
// screen on it that has gained a spec fails here until it is taken off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ROUTES } from '../src/staff/routes.ts';

// Screens built but with no browser spec yet. Remove each one when its spec lands
// (the Overview's landed in #353, 21 Oct).
const GAPS = [];

const shell = readFileSync(new URL('../src/staff/app-shell.tsx', import.meta.url), 'utf8');
const screens = shell.match(/const SCREENS[^=]*=\s*\{([^}]*)\}/)?.[1];
assert.ok(screens, 'could not find the SCREENS table in src/staff/app-shell.tsx');
const built = [...screens.matchAll(/(['\w-]+):\s*\w+/g)].map((m) => m[1].replace(/'/g, ''));

const specDir = new URL('./browser/', import.meta.url);
const specs = readdirSync(specDir).filter((f) => f.endsWith('.spec.ts')).map((f) => readFileSync(new URL(f, specDir), 'utf8'));
// A path with a slot (/workshop/customers/:id) counts when a spec opens it
// with any id there, written or filled in (`/workshop/customers/${id}`).
const opened = (path) => {
  const slot = path.split(/:[a-zA-Z]+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:[^/?\'"`]+|\\$\\{[^}]+\\})');
  const re = new RegExp(`${slot}[?'"\`]`);
  return specs.some((src) => re.test(src));
};

test('the table of built screens was read', () => {
  assert.ok(built.length >= 4, `read ${JSON.stringify(built)}`);
  for (const id of built) assert.ok(id in ROUTES, `${id} is built but has no URL in ROUTES`);
});

for (const id of built) {
  // The staff landing page only redirects, so it needs no spec of its own.
  if (id === 'desk') continue;
  if (GAPS.includes(id)) {
    test(`${id} is a known gap: it still has no browser spec`, () => {
      assert.ok(!opened(ROUTES[id]), `${ROUTES[id]} is now opened by a browser spec: take '${id}' off GAPS in tests/browser-coverage.test.js`);
    });
  } else {
    test(`${id} is opened by a browser spec`, () => {
      assert.ok(opened(ROUTES[id]), `no tests/browser spec opens ${ROUTES[id]}: add one, or (only with Mark or Jack agreeing) list '${id}' in GAPS`);
    });
  }
}
