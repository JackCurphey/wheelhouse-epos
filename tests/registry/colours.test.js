// Every colour name a registry item reads must exist in the React app's
// stylesheet. On 26 Sep the input read --ink and --danger (undefined in
// src/styles/theme.css) and --muted (a background shade there), so its text
// and error colours fell back to defaults and placeholders were near-invisible.
// Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, globSync } from 'node:fs';

const css = readFileSync('src/styles/theme.css', 'utf8');
const DEFINED = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
// Defined in theme.css, but as shadcn's muted SURFACE - wrong for text.
const WRONG_MEANING = new Set(['--muted']);

const files = globSync('registry/**/*.tsx');

test('the registry has items to check', () => {
  assert.ok(files.length >= 8, `only ${files.length} registry files found`);
});

for (const file of files) {
  test(`${file} reads only colour names theme.css defines for that purpose`, () => {
    const src = readFileSync(file, 'utf8');
    const used = [...new Set([...src.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))];
    const undefinedNames = used.filter((name) => !DEFINED.has(name));
    const wrong = used.filter((name) => WRONG_MEANING.has(name));
    assert.deepEqual(undefinedNames, [], `${file} reads names theme.css does not define`);
    assert.deepEqual(wrong, [], `${file} reads --muted, a background shade; use --wh-muted for text`);
  });
}
