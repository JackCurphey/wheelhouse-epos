// The zip writer for a customer's copy of their data
// (openspec/changes/your-data-copy, design 4), read back by `unzip`, an
// implementation of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipFiles } from '../server/lib/zip.js';

function readBack(buffer, t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'wh-zip-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'copy.zip');
  writeFileSync(file, buffer);
  return {
    test: () => execFileSync('unzip', ['-t', file], { encoding: 'utf8' }),
    list: () => execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).trim().split('\n'),
    read: (name) => execFileSync('unzip', ['-p', file, name], { encoding: 'utf8' }),
  };
}

test('the files come back as written, names and words in UTF-8', (t) => {
  const zip = zipFiles([
    { name: 'your-details.csv', content: 'Name,Email\r\nMaya Patel,maya@example.test\r\n' },
    { name: 'what-you-agreed-to.csv', content: 'Job updates by,Text\r\nNote,café ✓\r\n' },
  ], new Date('2026-09-01T10:00:00Z'));
  assert.ok(Buffer.isBuffer(zip));
  const back = readBack(zip, t);
  assert.match(back.test(), /No errors detected/);
  assert.deepEqual(back.list(), ['your-details.csv', 'what-you-agreed-to.csv']);
  assert.equal(back.read('your-details.csv'), 'Name,Email\r\nMaya Patel,maya@example.test\r\n');
  assert.equal(back.read('what-you-agreed-to.csv'), 'Job updates by,Text\r\nNote,café ✓\r\n');
});

test('an empty file is still a file', (t) => {
  const back = readBack(zipFiles([{ name: 'your-bikes.csv', content: '' }], new Date('2026-09-01T10:00:00Z')), t);
  assert.match(back.test(), /No errors detected/);
  assert.deepEqual(back.list(), ['your-bikes.csv']);
});
