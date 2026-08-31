import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, parseRootTokens, findDeclarations } from './helpers/css.js';

const tokens = parseRootTokens(readFile('public/tokens.css'));
const styles = readFile('public/styles.css');

test('a spacing scale exists with 8 steps on a 4px grid', () => {
  const steps = [2, 4, 8, 12, 16, 24, 32, 48];
  steps.forEach((px, i) => {
    assert.equal(tokens.get(`--space-${i + 1}`), `${px}px`);
  });
});

test('a type scale exists with paired line-heights', () => {
  const scale = {
    '--text-2xs': '9.5px', '--text-xs': '11px', '--text-sm': '13px', '--text-base': '15px',
    '--text-lg': '17px', '--text-xl': '20px', '--text-2xl': '24px', '--text-3xl': '30px',
  };
  for (const [name, value] of Object.entries(scale)) {
    assert.equal(tokens.get(name), value, `${name} should be ${value}`);
  }
  assert.ok(tokens.get('--leading-tight'));
  assert.ok(tokens.get('--leading-body'));
});

test('dense components pin a tight line-height so the grids do not grow', () => {
  // body gets --leading-body (1.55) for running text. The calendar chips, job
  // blocks and badges live in fixed-height boxes - a 30-minute week-grid slot
  // is 24px tall - so they must opt out or they overflow.
  for (const sel of ['.wk-job-block', '.job-card', '.badge']) {
    const rules = findDeclarations(styles, 'line-height').filter((d) => d.selector.includes(sel));
    assert.ok(rules.length > 0, `${sel} must pin a line-height, not inherit --leading-body`);
  }
});

test('a focus ring token exists', () => {
  assert.ok(tokens.get('--focus-ring'), '--focus-ring must be defined');
});

test('a global :focus-visible rule exists in styles.css', () => {
  assert.match(styles, /:focus-visible\s*\{/, 'no global :focus-visible rule found');
});

test('no font-size uses a half-pixel value', () => {
  const half = findDeclarations(styles, 'font-size')
    .filter((d) => /\d+\.\d+px/.test(d.value));
  assert.deepEqual(
    half.map((d) => `${d.selector} { font-size: ${d.value} } at :${d.line}`),
    [],
    'half-pixel font sizes are a sign of eyeballed type, not a scale',
  );
});

test('the number of distinct font-size values is capped at the scale size', () => {
  const values = new Set(
    findDeclarations(styles, 'font-size').map((d) => d.value.trim()),
  );
  // 7 scale tokens, plus var() references. Anything above this means new
  // one-off sizes are creeping back in.
  assert.ok(values.size <= 10, `${values.size} distinct font-size values: ${[...values].join(', ')}`);
});
