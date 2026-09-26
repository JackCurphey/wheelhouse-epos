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

// Real-world shape (verified in public/dist/.vite/manifest.json after a
// build): Vite hoists shared CSS onto the shared chunk once there are two
// entries, so the entry itself has no `css` - only the chunk it imports does.
// appEntryTags has to follow `imports` to find it, or /book and /workshop
// serve with no stylesheet at all.
test('css on an imported chunk still produces a stylesheet link', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'manifest-'));
  const file = path.join(dir, 'manifest.json');
  await writeFile(
    file,
    JSON.stringify({
      '_client-XXXX.js': { file: 'assets/client-XXXX.js', css: ['assets/client-YYYY.css'] },
      'src/customer/main.tsx': { file: 'assets/book-ZZZZ.js', imports: ['_client-XXXX.js'] },
    }),
  );
  const tags = await appEntryTags('src/customer/main.tsx', file);
  const stylesheetLinks = tags.match(/<link rel="stylesheet"[^>]*>/g) || [];
  assert.deepEqual(stylesheetLinks, ['<link rel="stylesheet" href="/dist/assets/client-YYYY.css" />']);
  assert.match(tags, /<script type="module" src="\/dist\/assets\/book-ZZZZ\.js"><\/script>/);
});

// Existing behaviour (css directly on the entry, no imports) must still work.
test('css on the entry itself still produces its link', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'manifest-'));
  const file = path.join(dir, 'manifest.json');
  await writeFile(
    file,
    JSON.stringify({
      'src/staff/main.tsx': { file: 'assets/staff-AAAA.js', css: ['assets/staff-BBBB.css'] },
    }),
  );
  const tags = await appEntryTags('src/staff/main.tsx', file);
  assert.match(tags, /<link rel="stylesheet" href="\/dist\/assets\/staff-BBBB\.css" \/>/);
});

// A css file reachable via two import paths (e.g. both the entry and a
// chunk it imports depend on a common chunk) must appear exactly once.
test('a css file reachable by two import paths appears once', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'manifest-'));
  const file = path.join(dir, 'manifest.json');
  await writeFile(
    file,
    JSON.stringify({
      '_shared-common.js': { file: 'assets/shared-common.js', css: ['assets/shared-common.css'] },
      '_shared-a.js': { file: 'assets/shared-a.js', imports: ['_shared-common.js'] },
      '_shared-b.js': { file: 'assets/shared-b.js', imports: ['_shared-common.js'] },
      'src/staff/main.tsx': {
        file: 'assets/staff-CCCC.js',
        imports: ['_shared-a.js', '_shared-b.js'],
      },
    }),
  );
  const tags = await appEntryTags('src/staff/main.tsx', file);
  const stylesheetLinks = tags.match(/<link rel="stylesheet"[^>]*>/g) || [];
  assert.deepEqual(stylesheetLinks, ['<link rel="stylesheet" href="/dist/assets/shared-common.css" />']);
});
