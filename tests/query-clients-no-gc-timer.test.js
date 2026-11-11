// Every React Query client the tests use has its five-minute clean-up timer
// (gcTime) switched off, so no test file stays alive after its tests.
//
// tests/test-files-exit.test.js watches for the symptom, but whether a file
// actually lingers depends on timing, so it can miss a broken setup. This
// checks the setting itself, which doesn't depend on timing, and also
// catches a new test that makes its own client without it.
//
// Needs `npm run pretest` first, like the screen and customer tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installDom, importFresh } from './helpers/dom.js';

const SHELLS = {
  staff: new URL('../.test-build/staff/app-shell.js', import.meta.url).href,
  customer: new URL('../.test-build/customer/app-shell.js', import.meta.url).href,
};

for (const [name, path] of Object.entries(SHELLS)) {
  test(`the ${name} app shell's client, loaded through importFresh, has no clean-up timer`, async () => {
    const uninstall = installDom('http://localhost/');
    try {
      const shell = await importFresh(path);
      assert.equal(shell.queryClient.getDefaultOptions().queries.gcTime, Infinity);
    } finally {
      uninstall();
    }
  });
}

function testFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'browser' ? [] : testFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

test('every client a test makes or reconfigures switches the clean-up timer off', () => {
  const offenders = [];
  for (const file of testFiles(new URL('.', import.meta.url).pathname)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const makesOne = /new QueryClient\(|\.setDefaultOptions\(\{/.test(line);
      if (makesOne && !/gcTime: Infinity/.test(line) && !file.endsWith('helpers/dom.js')) {
        offenders.push(`${file}:${i + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, [], 'Give each of these `gcTime: Infinity` in its query defaults');
});
