// tests/design-fjell.test.js
//
// Fjell is the Wheelhouse design system (Jack, 27 Sep 2026; decision record
// docs/decisions/2026-09-27-fjell-theme.md). public/tokens.css is the source
// of truth for the vanilla staff app; src/styles/theme.css carries the same
// values for the React apps. Nothing links the two files, so this test is
// what keeps them from drifting apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, parseBlockTokens, contrast } from './helpers/css.js';

const tokens = parseRootTokens(readFile('public/tokens.css'));
const themeCss = readFile('src/styles/theme.css');
const theme = parseRootTokens(themeCss);
const dark = new Map([...theme, ...parseBlockTokens(themeCss, '.dark')]);

// The owner-approved Fjell values, by tokens.css name.
const FJELL = {
  '--bg': '#f3f2ee',
  '--panel': '#fbfbf9',
  '--ink': '#1c1e19',
  '--muted': '#56594f',
  '--surface-muted': '#e8e7e1',
  '--border': '#dcdbd3',
  '--input-border': '#8e9185',
  '--brand': '#3f4d33',
  '--brand-dark': '#2a3024',
  '--accent': '#3f4d33',
  '--accent-dark': '#2a3024',
  '--on-brand': '#ffffff',
  '--on-accent': '#f3f2ee',
  '--highlight': '#c5cf3e',
  '--on-highlight': '#1c1e19',
  '--danger': '#a8321f',
  '--radius': '10px',
  '--radius-sm': '6px',
};

test('tokens.css holds the approved Fjell values', () => {
  const wrong = Object.entries(FJELL)
    .filter(([name, value]) => (tokens.get(name) || '').toLowerCase() !== value)
    .map(([name, value]) => `${name} is ${tokens.get(name)}, Fjell says ${value}`);
  assert.deepEqual(wrong, []);
});

test('the font tokens lead with the self-hosted Fjell fonts and fall back to system fonts', () => {
  assert.match(tokens.get('--font-sans') || '', /^"Work Sans",.*\bsans-serif$/);
  assert.match(tokens.get('--font-mono') || '', /^"DM Mono",.*\bmonospace$/);
});

// tokens.css name -> theme.css name, for every value both files carry.
const MIRROR = {
  '--bg': '--wh-bg',
  '--panel': '--wh-panel',
  '--ink': '--wh-ink',
  '--muted': '--wh-muted',
  '--surface-muted': '--wh-surface-muted',
  '--border': '--wh-border',
  '--input-border': '--wh-input-border',
  '--brand': '--wh-brand',
  '--brand-dark': '--wh-brand-dark',
  '--accent': '--accent',
  '--accent-dark': '--accent-dark',
  '--on-brand': '--wh-on-brand',
  '--on-accent': '--wh-on-accent',
  '--highlight': '--wh-highlight',
  '--on-highlight': '--wh-on-highlight',
  '--danger': '--wh-danger',
  '--danger-hover': '--wh-danger-hover',
  '--danger-bg': '--wh-danger-bg',
  '--warn-bg': '--wh-warn-bg',
  '--warn-ink': '--wh-warn-ink',
  '--ok-bg': '--wh-ok-bg',
  '--hover-bg': '--wh-hover',
  '--hover-subtle': '--wh-hover-subtle',
  '--modal-bg': '--modal-bg',
  '--font-sans': '--wh-font-sans',
  '--font-mono': '--wh-font-mono',
};
for (const state of ['pending', 'scheduled', 'waiting_parts', 'on_hold', 'complete', 'complete-paid']) {
  for (const part of ['bg', 'border', 'ink']) {
    MIRROR[`--status-${state}-${part}`] = `--wh-status-${state.replace('_', '-')}-${part}`;
  }
}

// Genuine differences, each with its reason. Nothing else may differ.
const KNOWN_DIFFERENCES = {
  // theme.css kept the old paler ink pending Jack's sign-off (see its comment);
  // status colours are out of scope for Fjell and stay exactly as they are.
  '--status-complete-paid-ink': 'status colours unchanged by Fjell',
};

test('theme.css carries the same values as tokens.css', () => {
  const drift = Object.entries(MIRROR)
    .filter(([from]) => !(from in KNOWN_DIFFERENCES))
    .filter(([from, to]) => (tokens.get(from) || 'MISSING').toLowerCase() !== (theme.get(to) || 'MISSING').toLowerCase())
    .map(([from, to]) => `${from} ${tokens.get(from)} vs ${to} ${theme.get(to)}`);
  assert.deepEqual(drift, []);
});

test('theme.css radius is the Fjell 6px, so rounded-xl is the 10px card radius', () => {
  assert.equal(theme.get('--radius'), '6px');
  assert.match(themeCss, /--radius-xl:\s*calc\(var\(--radius\) \+ 4px\)/);
});

const AA = 4.5;
const UI = 3; // WCAG 1.4.11: borders that identify a control

// [label, foreground, background, minimum], names as theme.css spells them.
const THEME_PAIRS = [
  ['ink on page', '--wh-ink', '--wh-bg', AA],
  ['ink on panel', '--wh-ink', '--wh-panel', AA],
  ['muted text on page', '--wh-muted', '--wh-bg', AA],
  ['muted text on panel', '--wh-muted', '--wh-panel', AA],
  ['white on primary', '--wh-on-brand', '--accent', AA],
  ['white on primary hover', '--wh-on-brand', '--accent-dark', AA],
  ['white on danger', '--wh-on-brand', '--wh-danger', AA],
  ['sidebar text on sidebar', '--wh-on-accent', '--accent-dark', AA],
  ['dark text on highlight', '--wh-on-highlight', '--wh-highlight', AA],
  ['input border on panel', '--wh-input-border', '--wh-panel', UI],
];

for (const [mode, map] of [['light', theme], ['dark', dark]]) {
  for (const [label, fg, bg, min] of THEME_PAIRS) {
    test(`theme.css ${mode}: ${label} clears ${min}:1`, () => {
      assert.ok(map.get(fg), `${fg} missing in ${mode}`);
      assert.ok(map.get(bg), `${bg} missing in ${mode}`);
      const ratio = contrast(map.get(fg), map.get(bg));
      assert.ok(ratio >= min, `${label} (${mode}) is ${ratio}, needs >= ${min}`);
    });
  }
}

test('--input is the input border, not the decorative border', () => {
  assert.match(themeCss, /--input:\s*var\(--wh-input-border\);/);
});
