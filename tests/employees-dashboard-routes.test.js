// WP-0.4: the employee roster routes live with the team in
// server/routes/team.js, and the dashboard in server/routes/dashboard.js, both
// Mark's (split plan §4.1). Moved, not copied: server.js keeps neither.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('the employee routes and serializeEmployee are in server/routes/team.js', () => {
  const team = read('server/routes/team.js');
  assert.ok(team.includes("route('GET', '/api/employees'"));
  assert.ok(team.includes("route('PUT', '/api/employees/:id'"));
  assert.ok(defines(team, 'serializeEmployee'));
});

test('the dashboard is in server/routes/dashboard.js, registered, and imports nothing from server.js', () => {
  assert.ok(existsSync(path.join(ROOT, 'server/routes/dashboard.js')), 'server/routes/dashboard.js does not exist');
  const dashboard = read('server/routes/dashboard.js');
  assert.ok(dashboard.includes("route('GET', '/api/dashboard'"));
  assert.ok(!/['"]\.\.\/server\.js['"]/.test(dashboard));
  assert.match(read('server/routes/index.js'), /import \* as dashboard from '\.\/dashboard\.js'/);
});

test('server/server.js keeps neither', () => {
  const server = read('server/server.js');
  for (const r of ["'GET', '/api/employees'", "'PUT', '/api/employees/:id'", "'GET', '/api/dashboard'"]) {
    assert.ok(!server.includes(`route(${r}`), `server.js still registers ${r}`);
  }
  assert.ok(!defines(server, 'serializeEmployee'));
});
