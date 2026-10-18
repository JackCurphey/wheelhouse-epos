// Jack, 16 Oct (the diary layout review's item 6): every label on the diary is
// at least 12 pixels, on every screen. Spec: openspec/changes/diary-label-floor
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'screens', 'diary');

test('no diary label is smaller than 12 pixels', () => {
  const small = [];
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.tsx'))) {
    readFileSync(path.join(DIR, f), 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 12) small.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  assert.deepEqual(small, []);
});
