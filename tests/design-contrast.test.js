// tests/design-contrast.test.js
//
// Every text/background token pair the product actually renders must clear
// WCAG 2.1 AA (4.5:1) for body text. These pairs come from the 2026-08-31
// design audit, findings C3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, contrast } from './helpers/css.js';

const tokens = parseRootTokens(readFile('public/tokens.css'));
const AA = 4.5;

function tok(name) {
  const v = tokens.get(name);
  assert.ok(v, `token ${name} is not defined in public/tokens.css`);
  return v;
}

const PAIRS = [
  ['white on --brand (.btn-primary)',        '#ffffff',  '--brand'],
  ['white on --brand-dark (hover)',          '#ffffff',  '--brand-dark'],
  ['white on --accent (.btn-accent)',        '#ffffff',  '--accent'],
  ['white on --accent-dark (topbar)',        '#ffffff',  '--accent-dark'],
  ['white on --danger (.btn-danger)',        '#ffffff',  '--danger'],
  ['--muted on --bg (secondary text)',       '--muted',  '--bg'],
  ['--muted on --panel (text in cards)',     '--muted',  '--panel'],
  ['--ink on --bg',                          '--ink',    '--bg'],
  ['--ink on --panel',                       '--ink',    '--panel'],
  ['--warn-ink on --warn-bg',                '--warn-ink', '--warn-bg'],
];

for (const [label, fg, bg] of PAIRS) {
  test(`contrast: ${label} clears AA`, () => {
    const f = fg.startsWith('--') ? tok(fg) : fg;
    const b = bg.startsWith('--') ? tok(bg) : bg;
    const ratio = contrast(f, b);
    assert.ok(ratio >= AA, `${label} is ${ratio}, needs >= ${AA}`);
  });
}

// The six job-status badges each pair their own ink against their own bg.
const STATUSES = ['pending', 'scheduled', 'waiting_parts', 'on_hold', 'complete', 'complete-paid'];

for (const s of STATUSES) {
  test(`contrast: status badge "${s}" ink on its own background clears AA`, () => {
    const ratio = contrast(tok(`--status-${s}-ink`), tok(`--status-${s}-bg`));
    assert.ok(ratio >= AA, `status ${s} is ${ratio}, needs >= ${AA}`);
  });

  test(`contrast: status badge "${s}" ink on the page ground clears AA`, () => {
    const ratio = contrast(tok(`--status-${s}-ink`), tok('--bg'));
    assert.ok(ratio >= AA, `status ${s} on --bg is ${ratio}, needs >= ${AA}`);
  });
}
