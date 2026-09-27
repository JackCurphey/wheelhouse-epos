import test from 'node:test';
import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
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
  // A shop's preset still recolours its public website (storefront.js
  // applyTheme() overrides --accent and --accent-dark there), so the
  // contrast guarantee in design-contrast.test.js, which covers only Fjell,
  // says nothing about them. This is the regression guard for all five.
  // (Since 27 Sep 2026 the staff app always uses Fjell.)
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

// The React apps take every colour from a token (src/styles/theme.css), read
// either as var(--...) in an arbitrary value or as a Tailwind utility named
// after a token (bg-primary, text-wh-muted). A colour written out in the code
// - hex, rgb()/hsl() and friends, a Tailwind palette class like bg-white or
// text-slate-500, or white/black inside an arbitrary value - skips Fjell and
// the dark palette. Added with Fjell, 27 Sep 2026.
const REACT_SOURCES = globSync('{src/components/ui,registry,src/screens,src/staff,src/customer}/**/*.{ts,tsx,css}');
// No \b: in an arbitrary value the function follows `_` (a word character).
const COLOUR_FUNCTION = /(?<![a-zA-Z-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;
const PALETTE_CLASS = /\b(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|shadow|accent|caret|decoration|divide|placeholder)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/g;
const NAMED_IN_ARBITRARY = /[[(_,](?:white|black)(?=[\])_,])/g;
// Genuine exceptions, each with its reason: 'file:literal' -> reason. None yet.
const ALLOWED_REACT_COLOURS = new Map([]);

function rawColoursIn(file, source) {
  const found = [];
  source.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    for (const h of findHexLiterals(line)) found.push(`${at} ${h.hex}`);
    for (const re of [COLOUR_FUNCTION, PALETTE_CLASS, NAMED_IN_ARBITRARY]) {
      for (const m of line.matchAll(re)) found.push(`${at} ${m[0]}`);
    }
  });
  return found.filter((f) => !ALLOWED_REACT_COLOURS.has(`${file}:${f.split(' ')[1]}`));
}

test('the React code has sources to check', () => {
  assert.ok(REACT_SOURCES.length >= 40, `only ${REACT_SOURCES.length} files matched`);
});

test('the colour guard recognises each kind of raw colour', () => {
  const sample = [
    "'bg-[#3f4d33]'", "'shadow-[0_1px_rgba(0,0,0,0.2)]'", "'text-white'", "'hover:bg-slate-100'",
    "'bg-[color-mix(in_srgb,var(--accent)_7%,white)]'", "'bg-[hsl(0_0%_100%)]'",
  ].join('\n');
  assert.equal(rawColoursIn('sample.tsx', sample).length, 6);
  assert.deepEqual(rawColoursIn('ok.tsx', "'bg-[var(--wh-panel)] text-primary-foreground whitespace-nowrap'"), []);
});

test('the React code has no raw colours - every colour is a token', () => {
  const stray = REACT_SOURCES.flatMap((file) => rawColoursIn(file, readFile(file)));
  assert.deepEqual(stray, [], 'use a token from src/styles/theme.css instead');
});

test('tokens.css defines every token that styles.css references', () => {
  const defined = new Set(parseRootTokens(readFile('public/tokens.css')).keys());
  const css = readFile('public/styles.css') + readFile('public-portal/portal.css');
  const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((t) => !defined.has(t));
  assert.deepEqual(missing, [], 'referenced but undefined tokens');
});
