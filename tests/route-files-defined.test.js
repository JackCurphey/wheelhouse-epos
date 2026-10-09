// WP-0.4: every name a moved route file uses must be defined or imported in
// it. Moving code out of server.js can leave a reference to something still
// private there (a helper, a constant, a class); nothing fails until that
// line runs, often only on an error path that no other test reaches. ESLint's
// no-undef catches it statically, on every file in server/routes/,
// server/lib/ and server/workshop/ (the workshop helpers other areas call).
// Split plan §4.1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import globals from 'globals';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['server/routes', 'server/lib', 'server/workshop'].flatMap((dir) =>
  readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, dir, f)));

test('the moved route and helper files are read', () => {
  assert.ok(files.some((f) => f.endsWith(path.join('server', 'routes', 'index.js'))), 'server/routes/index.js not found');
  assert.ok(files.length >= 3, `only ${files.length} files`);
});

test('every name used in server/routes/, server/lib/ and server/workshop/ is defined there or imported', async () => {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ['**/*.js'],
      languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
      rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { args: 'none' }] },
    }],
  });
  const results = await eslint.lintFiles(files);
  const problems = results.flatMap((r) => r.messages.map((m) => `${path.relative(ROOT, r.filePath)}:${m.line} ${m.message}`));
  assert.deepEqual(problems, []);
});

// server.js too: each move also drops the imports server.js no longer needs.
// Dropping one it still uses would only fail when that line ran; leaving one
// it doesn't is clutter the next move trips over.
test('server/server.js defines or imports every name it uses, and imports nothing it doesn\'t', async () => {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ['**/*.js'],
      languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
      rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] },
    }],
  });
  const [result] = await eslint.lintFiles([path.join(ROOT, 'server', 'server.js')]);
  assert.deepEqual(result.messages.map((m) => `server/server.js:${m.line} ${m.message}`), []);
});
