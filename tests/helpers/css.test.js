import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRootTokens, contrast, findDeclarations, findHexLiterals, readFile,
} from './css.js';

test('parseRootTokens reads custom properties from the :root block', () => {
  const css = ':root {\n  --bg: #f4f5f3;\n  --radius: 10px;\n}\n.x { color: red; }';
  const tokens = parseRootTokens(css);
  assert.equal(tokens.get('--bg'), '#f4f5f3');
  assert.equal(tokens.get('--radius'), '10px');
  assert.equal(tokens.has('color'), false);
});

test('parseRootTokens ignores comments inside :root', () => {
  const css = ':root {\n  /* --fake: #000; */\n  --real: #fff;\n}';
  const tokens = parseRootTokens(css);
  assert.equal(tokens.has('--fake'), false);
  assert.equal(tokens.get('--real'), '#fff');
});

test('contrast matches known WCAG reference pairs', () => {
  assert.equal(contrast('#ffffff', '#000000'), 21);
  assert.equal(contrast('#ffffff', '#ffffff'), 1);
  // Regression guard: the exact failing pair this whole plan exists to fix.
  assert.equal(contrast('#ffffff', '#d9581e'), 3.91);
});

test('contrast is symmetric and accepts shorthand hex', () => {
  assert.equal(contrast('#000', '#fff'), contrast('#fff', '#000'));
});

test('findDeclarations reports selector, value and 1-indexed line', () => {
  const css = '.a {\n  padding: 4px;\n}\n.b {\n  padding: 8px 16px;\n}';
  const found = findDeclarations(css, 'padding');
  assert.equal(found.length, 2);
  assert.deepEqual(found[0], { selector: '.a', value: '4px', line: 2 });
  assert.equal(found[1].selector, '.b');
  assert.equal(found[1].line, 5);
});

test('findHexLiterals finds hex colours and skips non-colour hashes', () => {
  const src = 'const a = "#ff0000";\nel.id = "#not-a-colour";\nconst b = "#abc";';
  const hits = findHexLiterals(src);
  assert.deepEqual(hits.map(h => h.hex), ['#ff0000', '#abc']);
  assert.equal(hits[0].line, 1);
});

test('findHexLiterals ignores hex-shaped ids, href fragments and url() refs', () => {
  const src = 'div#eee { }\na[href="#deadbe"] {}\n.class#fff { }';
  const hits = findHexLiterals(src);
  assert.deepEqual(hits, []);
});

test('readFile reads a known repo file by repo-root-relative path', () => {
  const pkg = readFile('package.json');
  assert.match(pkg, /"type"\s*:\s*"module"/);
});
