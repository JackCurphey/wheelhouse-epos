// What the server says when the staff app has not been built.
//
// public/dist is untracked (23 Sep), so a fresh checkout has no bundle until
// `npm run build`. /workshop then answers 500, and the server log is the only
// place anyone learns why - so the logged error must say what to run, not a
// bare ENOENT on a manifest path.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import '../server/load-env.js';
import { workshopEntryTags } from '../server/server.js';

test('with no build, the error says to run npm run build', async () => {
  const missing = path.join(os.tmpdir(), `no-such-dir-${process.pid}`, 'manifest.json');
  await assert.rejects(workshopEntryTags(missing), /run npm run build/);
});

test('a manifest that exists but cannot be read still fails with its own error', async () => {
  // A directory where the file should be: not "missing", so not the build hint.
  await assert.rejects(workshopEntryTags(os.tmpdir()), (err) => !/run npm run build/.test(err.message));
});
