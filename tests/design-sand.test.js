// tests/design-sand.test.js
//
// Soft sand is the Wheelhouse look (Jack, 28 Sep 2026: "Soft sand, dark
// rail", sans-serif throughout; decisions 48 and 53 in
// docs/decisions/2026-09-27-workshop-day-review.md). It replaced Fjell
// (docs/decisions/2026-09-27-fjell-theme.md). The values are the drawings'
// own (SAND in docs/design/user-journeys/generator/ui.mjs), so the app
// matches what Jack approved. public/tokens.css is the source
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

// The approved Soft sand values, by tokens.css name (ui.mjs SAND).
const SAND = {
  '--bg': '#f4eee1',
  '--panel': '#fffdf7',
  '--ink': '#2a2822',
  '--muted': '#6e6752',
  '--surface-muted': '#f0eadc',
  '--border': '#e6dfcb',
  '--input-border': '#6e6752',
  '--brand': '#2a2822',
  '--brand-dark': '#262420',
  '--accent': '#2a2822',
  '--accent-dark': '#262420',
  '--on-brand': '#ffffff',
  '--on-accent': '#f4eee1',
  '--highlight': '#d9a441',
  '--on-highlight': '#2a2822',
  '--danger': '#9c3b2c',
  '--danger-bg': '#f6e3de',
  '--warn-bg': '#f7eac2',
  '--warn-ink': '#7a5a10',
  '--ok-bg': '#e1eedd',
  '--hover-bg': '#efe8d6',
  '--modal-bg': '#fffdf7',
  '--radius': '10px',
  '--radius-sm': '6px',
};

test('tokens.css holds the approved Soft sand values', () => {
  const wrong = Object.entries(SAND)
    .filter(([name, value]) => (tokens.get(name) || '').toLowerCase() !== value)
    .map(([name, value]) => `${name} is ${tokens.get(name)}, Soft sand says ${value}`);
  assert.deepEqual(wrong, []);
});

test('the font tokens lead with the self-hosted Soft sand fonts and fall back to system fonts', () => {
  assert.match(tokens.get('--font-sans') || '', /^"Public Sans",.*\bsans-serif$/);
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
  // status colours are out of scope for the look and stay exactly as they are.
  '--status-complete-paid-ink': 'status colours unchanged by Fjell or Soft sand',
};

test('theme.css carries the same values as tokens.css', () => {
  const drift = Object.entries(MIRROR)
    .filter(([from]) => !(from in KNOWN_DIFFERENCES))
    .filter(([from, to]) => (tokens.get(from) || 'MISSING').toLowerCase() !== (theme.get(to) || 'MISSING').toLowerCase())
    .map(([from, to]) => `${from} ${tokens.get(from)} vs ${to} ${theme.get(to)}`);
  assert.deepEqual(drift, []);
});

test('theme.css radius is 6px, so rounded-xl is the 10px card radius', () => {
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
  ['sidebar active text on the active item', '--wh-highlight', '--wh-sidebar-active', AA],
  ['dark text on highlight', '--wh-on-highlight', '--wh-highlight', AA],
  ['input border on panel', '--wh-input-border', '--wh-panel', UI],
  ['input border on the page', '--wh-input-border', '--wh-bg', UI],
  ['input border on a grey panel', '--wh-input-border', '--wh-surface-muted', UI],
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

// Soft sand outlines its delete buttons (decision 53), so the danger colour is
// text on the panel. Light mode only: nothing switches the dark palette on.
test('theme.css light: danger text on panel (outlined delete button) clears 4.5:1', () => {
  const ratio = contrast(theme.get('--wh-danger'), theme.get('--wh-panel'));
  assert.ok(ratio >= AA, `danger on panel is ${ratio}, needs >= ${AA}`);
});

test('--input is the input border, not the decorative border', () => {
  assert.match(themeCss, /--input:\s*var\(--wh-input-border\);/);
});

// Soft sand's dark rail: the selected sidebar item is a lighter charcoal with
// amber text (look-4 in docs/design/user-journeys/generator/looks.mjs).
test("the sidebar's selected item is the lighter charcoal with amber text", () => {
  assert.equal((theme.get('--wh-sidebar-active') || '').toLowerCase(), '#39352e');
  assert.match(themeCss, /--sidebar-primary:\s*var\(--wh-sidebar-active\);/);
  assert.match(themeCss, /--sidebar-primary-foreground:\s*var\(--wh-highlight\);/);
});

// Soft sand cards sit on a hairline border with no shadow (ui.mjs SAND).
test('cards have no shadow in Soft sand', () => {
  assert.equal(theme.get('--wh-shadow'), 'none');
});
