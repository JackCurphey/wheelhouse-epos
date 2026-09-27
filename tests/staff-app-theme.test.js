// tests/staff-app-theme.test.js
//
// The staff app always uses Fjell (Jack, 27 Sep 2026): a shop's colour scheme
// no longer recolours it. The scheme keeps reaching the public website.
// Record: docs/decisions/2026-09-27-fjell-theme.md.
//
// Both apps are plain browser scripts with no exports, so each test runs the
// real script in jsdom against a stubbed fetch that answers as a shop whose
// chosen scheme is 'plum' - if anything applies the scheme, --accent becomes
// plum's #7a4a94.
//
// The React booking app (/book) is not tested here because it has never
// applied a shop scheme - book.html does not load app.js, and nothing under
// src/ reads /api/shop-theme - so it renders Fjell from src/styles/theme.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from './helpers/css.js';

const PLUM_ACCENT = '#7a4a94';

function runScript({ html, script, url, answers }) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const requested = [];
  const errors = [];
  dom.window.fetch = async (path) => {
    const p = String(path).split('?')[0];
    requested.push(p);
    const body = p in answers ? answers[p] : [];
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) };
  };
  dom.window.addEventListener('error', (e) => errors.push(e.message));
  dom.window.addEventListener('unhandledrejection', (e) => { e.preventDefault(); errors.push(String(e.reason)); });
  dom.window.eval(script);
  return { dom, requested, errors };
}

async function waitFor(check, what) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for ${what}`);
}

function bodyOf(file) {
  return readFile(file).replace(/<script[\s\S]*?<\/script>/g, '');
}

function staffApp(hash) {
  return runScript({
    html: bodyOf('public/index.html'),
    script: readFile('public/app.js'),
    url: `http://localhost/${hash}`,
    answers: {
      '/api/auth/me': { id: 1, name: 'Owner', email: 'o@example.test', isOwner: true, shopName: 'Test Cycles' },
      '/api/shop-theme': { preset: 'plum' },
      '/api/storefront-settings': { enabled: false, themePreset: 'plum', tagline: '', description: '' },
    },
  });
}

test('the staff app does not ask for or apply the shop colour scheme on start-up', async (t) => {
  const { dom, requested } = staffApp('#till');
  t.after(() => dom.window.close());
  await waitFor(() => requested.includes('/api/auth/me') && dom.window.document.querySelector('.topbar'), 'the staff app to render');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(requested.includes('/api/shop-theme'), false, 'the staff app fetched /api/shop-theme');
  assert.equal(dom.window.document.documentElement.style.getPropertyValue('--accent'), '');
  assert.equal(dom.window.document.documentElement.style.getPropertyValue('--accent-dark'), '');
  assert.equal(dom.window.document.documentElement.style.getPropertyValue('--modal-bg'), '');
});

test('Edit Shop > Office has no colour scheme panel, but the website keeps its scheme choice', async (t) => {
  const { dom } = staffApp('#office/edit-shop/office');
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  await waitFor(() => doc.getElementById('storefront-theme-preset'), 'the storefront settings to render');
  const headings = [...doc.querySelectorAll('#office-content h2')].map((h) => h.textContent.trim());
  assert.ok(headings.includes('Storefront'), `Office page headings: ${headings.join(', ')}`);
  assert.equal(headings.includes('Colour scheme'), false, 'the Colour scheme panel is still on the Office page');
  assert.equal(doc.getElementById('theme-swatch-grid'), null);
  const presets = [...doc.querySelectorAll('#storefront-theme-preset option')].map((o) => o.value);
  assert.deepEqual(presets, ['forest', 'ocean', 'sunset', 'slate', 'plum']);
});

test('the public website still applies the shop colour scheme', async (t) => {
  const { dom } = runScript({
    html: bodyOf('public-storefront/index.html'),
    script: readFile('public-storefront/storefront.js'),
    url: 'http://localhost/store/test-cycles',
    answers: {
      '/api/storefront/info': { shopName: 'Test Cycles', themePreset: 'plum', tagline: '', description: '' },
      '/api/storefront/products': [],
    },
  });
  t.after(() => dom.window.close());
  const root = dom.window.document.documentElement;
  await waitFor(() => root.style.getPropertyValue('--accent'), 'the storefront to apply a theme');
  assert.equal(root.style.getPropertyValue('--accent'), PLUM_ACCENT);
});
