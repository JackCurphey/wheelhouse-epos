// What the server says when an app has not been built.
//
// public/dist is untracked (23 Sep), so a fresh checkout has no bundle until
// `npm run build`. /workshop or /book then answers 500, and the server log is
// the only place anyone learns why - so the logged error must say what to
// run, not a bare ENOENT on a manifest path.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { writeFile, mkdtemp } from 'node:fs/promises';
import '../server/load-env.js';
import { appEntryTags } from '../server/server.js';

test('with no build, the error says to run npm run build', async () => {
  const missing = path.join(os.tmpdir(), `no-such-dir-${process.pid}`, 'manifest.json');
  await assert.rejects(appEntryTags('src/staff/main.tsx', missing), /run npm run build/);
});

test('a manifest that exists but cannot be read still fails with its own error', async () => {
  // A directory where the file should be: not "missing", so not the build hint.
  await assert.rejects(appEntryTags('src/staff/main.tsx', os.tmpdir()), (err) => !/run npm run build/.test(err.message));
});

test('a build without the customer entry names the missing entry', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'manifest-'));
  const file = path.join(dir, 'manifest.json');
  await writeFile(file, JSON.stringify({ 'src/staff/main.tsx': { file: 'assets/staff.js' } }));
  await assert.rejects(appEntryTags('src/customer/main.tsx', file), /src\/customer\/main\.tsx/);
});
