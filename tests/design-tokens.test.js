import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, findHexLiterals, contrast } from './helpers/css.js';

const ALLOWED_BARE_HEX = new Set([
  // Alpha-blended overlays that are deliberately not tokens - they sit on top
  // of whatever the theme sets and have no fixed background to check against.
]);

test('styles.css contains no raw hex colours - every colour is a token', () => {
  const css = readFile('public/styles.css');
  const stray = findHexLiterals(css).filter((h) => !ALLOWED_BARE_HEX.has(h.hex));
  assert.deepEqual(
    stray.map((h) => `${h.hex} at styles.css:${h.line}`),
    [],
    'raw hex found outside tokens.css',
  );
});

test('portal.css contains no raw hex colours', () => {
  const stray = findHexLiterals(readFile('public-portal/portal.css'));
  assert.deepEqual(stray.map((h) => `${h.hex}:${h.line}`), []);
});

test('app.js contains no raw hex colours outside THEME_PRESETS', () => {
  const src = readFile('public/app.js');
  const presetStart = src.indexOf('const THEME_PRESETS');
  const presetEnd = src.indexOf('};', presetStart);
  const stray = findHexLiterals(src).filter((h) => {
    const offset = src.split('\n').slice(0, h.line - 1).join('\n').length;
    return offset < presetStart || offset > presetEnd;
  });
  assert.deepEqual(stray.map((h) => `${h.hex}:${h.line}`), []);
});

test('every THEME_PRESETS colour clears AA against white text', () => {
  // applyShopTheme() overrides --accent and --accent-dark per shop, so the
  // contrast guarantee in design-contrast.test.js only covers the default
  // preset. This is the regression guard for the other four.
  //
  // All 10 values (5 presets x topbar + accent) pass as of 2026-08-31 -
  // lowest is sunset's accent #a8501e at 5.48. This test exists so a future
  // preset cannot be added below the floor, not to fix a present failure.
  const src = readFile('public/app.js');
  const block = src.slice(src.indexOf('const THEME_PRESETS'),
                          src.indexOf('};', src.indexOf('const THEME_PRESETS')));
  const colours = [...block.matchAll(/(topbar|accent):\s*'(#[0-9a-fA-F]{6})'/g)]
    .map((m) => ({ role: m[1], hex: m[2] }));
  assert.equal(colours.length, 10, `expected 10 preset colours, found ${colours.length}`);
  for (const { role, hex } of colours) {
    const ratio = contrast('#ffffff', hex);
    assert.ok(ratio >= 4.5, `preset ${role} ${hex} is ${ratio}, needs >= 4.5`);
  }
});

test('tokens.css defines every token that styles.css references', () => {
  const defined = new Set(parseRootTokens(readFile('public/tokens.css')).keys());
  const css = readFile('public/styles.css') + readFile('public-portal/portal.css');
  const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((t) => !defined.has(t));
  assert.deepEqual(missing, [], 'referenced but undefined tokens');
});
