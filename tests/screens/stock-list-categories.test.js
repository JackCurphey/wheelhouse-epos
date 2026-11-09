// Stock › a category picked and its details (openspec/changes/stock-list-categories-sizes;
// drawn as st-filter-bearings, st-filter-derailleurs and st-search-measure in stock.mjs; stock
// control decisions 10 and 11; audit M11 and M12). Bearings with Inner diameter, Outer diameter
// and Height in mm, Drivetrain › Derailleurs with Number of gears, Outer diameter 30 and
// "bearing 30 mm", as drawn; the rest placeholders or numbers only the test needs.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

const MM = (id, name) => ({ id, name, kind: 'number', unit: 'mm', choices: [], answered: 0 });
const CATEGORIES = [
  { id: 1, name: 'Bearings', parentId: null, path: 'Bearings', products: 2, details: [MM(11, 'Inner diameter'), MM(12, 'Outer diameter'), MM(13, 'Height')] },
  { id: 2, name: 'Drivetrain', parentId: null, path: 'Drivetrain', products: 1, details: [{ id: 21, name: '[Detail]', kind: 'text', unit: null, choices: [], answered: 1 }] },
  { id: 3, name: 'Derailleurs', parentId: 2, path: 'Drivetrain › Derailleurs', products: 1, details: [{ id: 31, name: 'Number of gears', kind: 'choice', unit: null, choices: ['[11]', '[12]'], answered: 1 }] },
  { id: 5, name: '[Sealed]', parentId: 1, path: 'Bearings › [Sealed]', products: 0, details: [] },
];
const row = (id, name, category, over = {}) => ({ kind: 'product', id, name, sku: '[Supplier code]', barcode: null, category, supplier: '[Supplier]', stockQty: 4, lowStockThreshold: 0, pricePence: 1000, costPence: 500, active: true, vatRateBp: 2000, ...over });
// Costs only to give each a different margin from its name's order (A lowest, then C, then B).
const BEARING_A = row(1, '[Bearing A]', 'Bearings', { costPence: 800, details: { 11: 10, 12: 30, 13: 9 } });
const BEARING_B = row(2, '[Bearing B]', 'Bearings', { costPence: 100, stockQty: 1, lowStockThreshold: 3, details: { 11: 12, 12: 30, 13: 8 } });
const BEARING_C = row(4, '[Bearing C]', 'Bearings', { details: { 11: 15, 12: 32 } });
const DERAILLEUR = row(3, '[Rear derailleur]', 'Drivetrain › Derailleurs', { details: { 31: '[12]', 21: '[Brand]' } });

async function openStock() {
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/product-categories') return reply(200, { categories: CATEGORIES });
    if (u.pathname === '/api/stock-list') {
      const q = u.searchParams;
      const strip = (r) => { const { details, ...rest } = r; return rest; };
      if (q.get('search') === 'bearing 30 mm') return reply(200, { rows: [BEARING_A, BEARING_B] });
      // A number found in a name: the server may still send answers; none of them is 99.
      if (q.get('search') === 'bearing 99') return reply(200, { rows: [BEARING_A] });
      if (q.get('category') === 'Bearings') {
        const want = q.get('d12');
        return reply(200, { rows: [BEARING_A, BEARING_B, BEARING_C].filter((r) => !want || String(r.details[12]) === want) });
      }
      if (q.get('category') === 'Drivetrain › Derailleurs') return reply(200, { rows: !q.get('d31') || q.get('d31') === '[12]' ? [DERAILLEUR] : [] });
      return reply(200, { rows: [BEARING_A, BEARING_B, BEARING_C, DERAILLEUR].map(strip) });
    }
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/stock');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('link', { name: /\[Bearing A\]/ });
  return { ...rtl, ui };
}
async function pick(t, typed, keys) {
  const box = t.ui.getByRole('combobox', { name: 'Category' });
  t.fireEvent.change(box, { target: { value: typed } });
  await t.ui.findAllByRole('option');
  for (const k of keys) t.fireEvent.keyDown(box, { key: k });
}
const listCalls = () => calls.filter((c) => c.startsWith('/api/stock-list')).map((c) => decodeURIComponent(c.replace(/\+/g, ' ')));

test('the Category pill: typed, picked with the arrow keys and Enter, shown dark with ✕; All isn’t pressed, and ✕ takes it off', async () => {
  const t = await openStock();
  assert.equal(t.ui.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'), 'true');
  await pick(t, 'bear', ['ArrowDown', 'Enter']);
  const off = await t.ui.findByRole('button', { name: 'Remove the Bearings filter' });
  assert.ok(off.closest('span').textContent.includes('Bearings'));
  assert.equal(t.ui.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'), 'false');
  await t.ui.findByText('3 in Bearings');
  assert.ok(listCalls().some((c) => c.includes('category=Bearings')), listCalls().join('\n'));
  t.fireEvent.click(off);
  // Focus goes back to the box, not lost with the ✕.
  assert.ok(document.activeElement === t.ui.getByRole('combobox', { name: 'Category' }), 'focus is in the Category box');
  assert.equal(t.ui.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'), 'true');
  await t.ui.findByRole('link', { name: /\[Rear derailleur\]/ });
});

test('Bearings’ details become columns, Margin making room, and the line keeps the code and supplier', async () => {
  const t = await openStock();
  await pick(t, 'bear', ['ArrowDown', 'Enter']);
  await t.ui.findByText('3 in Bearings');
  const heads = t.ui.getAllByRole('columnheader').map((h) => h.textContent.replace(/[▴▾]/g, ''));
  // The first is the Owner's Tick all (st-list-ticked).
  assert.deepEqual(heads, ['', 'Product', 'Inner diameter', 'Outer diameter', 'Height', 'In stock', 'Price']);
  const a = t.within(t.ui.getByRole('link', { name: /\[Bearing A\]/ }).closest('[role="row"]'));
  assert.ok(a.getByRole('link').textContent.endsWith('[Supplier code] · [Supplier]'));
  const cells = a.getAllByRole('cell').map((c) => c.textContent);
  assert.deepEqual(cells.slice(2, 5), ['Inner diameter: 10 mm', 'Outer diameter: 30 mm', 'Height: 9 mm']);
  const c = t.within(t.ui.getByRole('link', { name: /\[Bearing C\]/ }).closest('[role="row"]'));
  assert.equal(c.getAllByRole('cell')[4].textContent, 'Height: —');
});

test('a number detail’s box asks the server for that detail, and the summary says what’s shown', async () => {
  const t = await openStock();
  await pick(t, 'bear', ['ArrowDown', 'Enter']);
  const group = t.within(await t.ui.findByRole('group', { name: 'Bearings details' }));
  const outer = group.getByRole('textbox', { name: 'Outer diameter' });
  assert.equal(outer.getAttribute('placeholder'), 'Any');
  assert.ok(group.getAllByText('mm').length === 3);
  t.fireEvent.change(outer, { target: { value: '30' } });
  await t.ui.findByText('2 in Bearings with Outer diameter 30 mm');
  assert.ok(listCalls().some((c) => c.includes('category=Bearings') && c.includes('d12=30')), listCalls().join('\n'));
  assert.ok(t.ui.queryByRole('link', { name: /\[Bearing C\]/ }) === null);
  // Nothing matching says so in the same words.
  t.fireEvent.change(outer, { target: { value: '40' } });
  await t.ui.findByRole('heading', { name: 'Nothing in Bearings with Outer diameter 40 mm' });
});

test('Derailleurs has its own details and Drivetrain’s; a choice filters by its pills', async () => {
  const t = await openStock();
  await pick(t, 'derail', ['ArrowDown', 'Enter']);
  await t.ui.findByRole('button', { name: 'Remove the Drivetrain › Derailleurs filter' });
  const group = t.within(await t.ui.findByRole('group', { name: 'Derailleurs details' }));
  assert.ok(group.getByRole('textbox', { name: '[Detail]' }));
  const gears = t.within(group.getByRole('radiogroup', { name: 'Number of gears' }));
  assert.deepEqual(gears.getAllByRole('radio').map((r) => r.textContent), ['Any', '[11]', '[12]']);
  assert.equal(gears.getByRole('radio', { name: 'Any' }).getAttribute('aria-checked'), 'true');
  const heads = t.ui.getAllByRole('columnheader').map((h) => h.textContent.replace(/[▴▾]/g, ''));
  assert.deepEqual(heads, ['', 'Product', '[Detail]', 'Number of gears', 'In stock', 'Price']);
  t.fireEvent.click(gears.getByRole('radio', { name: '[12]' }));
  await t.ui.findByText('1 in Drivetrain › Derailleurs with Number of gears [12]');
  assert.ok(listCalls().some((c) => c.includes('d31=[12]')), listCalls().join('\n'));
});

test('“bearing 30 mm”: each row’s details on its line, the one matched in bold, the unit once', async () => {
  const t = await openStock();
  t.fireEvent.change(t.ui.getByRole('searchbox', { name: 'Search stock' }), { target: { value: 'bearing 30 mm' } });
  await t.ui.findByText('2 products');
  const a = t.ui.getByRole('link', { name: /\[Bearing A\]/ });
  assert.ok(a.textContent.endsWith('Inner diameter 10 · Outer diameter 30 · Height 9 mm'), a.textContent);
  assert.equal(a.querySelector('strong').textContent, 'Outer diameter 30');
});

test('Running low narrows a picked category; All takes the category off', async () => {
  const t = await openStock();
  await pick(t, 'bear', ['ArrowDown', 'Enter']);
  await t.ui.findByText('3 in Bearings');
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Running low' }));
  assert.ok(t.ui.getByRole('link', { name: /\[Bearing B\]/ }));
  assert.ok(t.ui.queryByRole('link', { name: /\[Bearing A\]/ }) === null);
  assert.ok(t.ui.getByText('1 in Bearings'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'All' }));
  assert.ok(t.ui.queryByRole('button', { name: 'Remove the Bearings filter' }) === null);
  await t.ui.findByRole('link', { name: /\[Rear derailleur\]/ });
});

test('a number searched that no answer matches leaves the line as it was', async () => {
  const t = await openStock();
  t.fireEvent.change(t.ui.getByRole('searchbox', { name: 'Search stock' }), { target: { value: 'bearing 99' } });
  await t.ui.findByText('1 product');
  assert.ok(t.ui.getByRole('link', { name: /\[Bearing A\]/ }).textContent.endsWith('[Supplier code] · Bearings · [Supplier]'));
});

test('a unit typed in a number box is the box’s own: “30 mm” asks for 30', async () => {
  const t = await openStock();
  await pick(t, 'bear', ['ArrowDown', 'Enter']);
  const outer = (await t.ui.findByRole('group', { name: 'Bearings details' })).querySelector('input[aria-label="Outer diameter"]');
  t.fireEvent.change(outer, { target: { value: '30 mm' } });
  await t.ui.findByText('2 in Bearings with Outer diameter 30 mm');
  assert.ok(listCalls().some((c) => c.includes('d12=30') && !c.includes('d12=30 ')), listCalls().join('\n'));
});

test('sorted by Margin, then a category picked: Margin goes, and the list goes back to name order', async () => {
  const t = await openStock();
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Margin' }));
  const names = () => t.ui.getAllByRole('link').map((a) => a.textContent).filter((x) => x.startsWith('[Bearing')).map((x) => x.slice(0, 11));
  assert.deepEqual(names(), ['[Bearing A]', '[Bearing C]', '[Bearing B]']);
  await pick(t, 'bear', ['ArrowDown', 'Enter']);
  await t.ui.findByText('3 in Bearings');
  assert.deepEqual(names(), ['[Bearing A]', '[Bearing B]', '[Bearing C]']);
});

test('a filter set on one category is never sent with the next, even one that has the same detail', async () => {
  const t = await openStock();
  await pick(t, 'bear', ['ArrowDown', 'Enter']);
  const outer = (await t.ui.findByRole('group', { name: 'Bearings details' })).querySelector('input[aria-label="Outer diameter"]');
  t.fireEvent.change(outer, { target: { value: '30' } });
  await t.ui.findByText('2 in Bearings with Outer diameter 30 mm');
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Remove the Bearings filter' }));
  await pick(t, 'sealed', ['ArrowDown', 'Enter']);
  await t.ui.findByRole('button', { name: 'Remove the Bearings › [Sealed] filter' });
  await new Promise((r) => setTimeout(r, 450));
  const sealed = listCalls().filter((c) => c.includes('category=Bearings › [Sealed]'));
  assert.ok(sealed.length > 0, listCalls().join('\n'));
  assert.ok(sealed.every((c) => !c.includes('d12')), sealed.join('\n'));
});
