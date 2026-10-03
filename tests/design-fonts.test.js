// tests/design-fonts.test.js
//
// The app's fonts are stored with it (Jack, 27 Sep 2026): the offline till
// must keep them with no internet, and a customer's visit must not reach
// Google. Record: docs/decisions/2026-09-27-fjell-theme.md.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, globSync } from 'node:fs';
import '../server/load-env.js';
import { readFile, parseRootTokens, findDeclarations } from './helpers/css.js';
import { startLiveServer } from './helpers/liveServer.js';

const FONT_FILES = {
  'Public Sans': 'public/fonts/public-sans/public-sans-latin-wght.woff2',
  'DM Mono': 'public/fonts/dm-mono/dm-mono-latin-500.woff2',
};

test('each font file is a real woff2 with the SIL Open Font License beside it', () => {
  for (const file of Object.values(FONT_FILES)) {
    assert.ok(existsSync(file), `${file} is missing`);
    assert.equal(readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2', `${file} is not woff2`);
    const licence = file.replace(/[^/]+$/, 'OFL.txt');
    assert.match(readFileSync(licence, 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/, `${licence} missing`);
  }
});

for (const sheet of ['public/tokens.css', 'src/styles/theme.css']) {
  test(`${sheet} declares both fonts from the app's own files, with swap`, () => {
    const css = readFile(sheet);
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    for (const [family, file] of Object.entries(FONT_FILES)) {
      const face = faces.find((f) => f.includes(`"${family}"`));
      assert.ok(face, `${sheet} has no @font-face for ${family}`);
      assert.ok(face.includes(`url("${file.replace(/^public/, '')}")`), `${family} does not load ${file}`);
      assert.match(face, /font-display:\s*swap/, `${family} needs font-display: swap`);
    }
  });
}

test('no page, stylesheet or script asks Google for fonts', () => {
  const files = globSync('{public,public-portal,public-storefront,src}/**/*.{html,css,js,ts,tsx}')
    .filter((f) => !f.startsWith('public/dist/'));
  const offenders = files.filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('the staff app sets its text in --font-sans and its numbers in --font-mono', () => {
  const styles = readFile('public/styles.css');
  const body = findDeclarations(styles, 'font-family').find((d) => d.selector === 'html, body');
  assert.equal(body?.value, 'var(--font-sans)');
  const mono = new Set(findDeclarations(styles, 'font-family')
    .filter((d) => d.value === 'var(--font-mono)')
    .flatMap((d) => d.selector.split(',').map((s) => s.trim())));
  for (const sel of ['.sdi-sku', '.sdi-price', '.price-input', '.line-total', '.totals-table td:last-child']) {
    assert.ok(mono.has(sel), `${sel} should use var(--font-mono)`);
  }
  assert.ok(parseRootTokens(readFile('public/tokens.css')).get('--font-mono'));
});

let server;
before(async () => { server = await startLiveServer(); });
after(async () => { if (server) await server.stop(); });

test('the server sends the font files as font/woff2', async () => {
  for (const file of Object.values(FONT_FILES)) {
    const res = await fetch(`${server.baseUrl}${file.replace(/^public/, '')}`);
    await res.arrayBuffer();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'font/woff2');
  }
});
