// Settings › Stockroom › Categories (openspec/changes/categories-screens; drawn as
// st-categories and st-category-edit in stock.mjs; stock control decision 10). Bearings with
// Inner diameter, Outer diameter and Height in mm, Drivetrain with [Detail], Drivetrain ›
// Derailleurs with Number of gears as a choice, as drawn; [Category] and the rest placeholders.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let cats;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

const MM = (id, name) => ({ id, name, kind: 'number', unit: 'mm', choices: [], answered: 0 });
const START = () => [
  { id: 1, name: 'Bearings', parentId: null, path: 'Bearings', products: 4, details: [MM(11, 'Inner diameter'), MM(12, 'Outer diameter'), MM(13, 'Height')] },
  { id: 2, name: 'Drivetrain', parentId: null, path: 'Drivetrain', products: 1, details: [{ id: 21, name: '[Detail]', kind: 'text', unit: null, choices: [], answered: 0 }] },
  { id: 3, name: 'Derailleurs', parentId: 2, path: 'Drivetrain › Derailleurs', products: 2, details: [{ id: 31, name: 'Number of gears', kind: 'choice', unit: null, choices: ['[n]', '[m]'], answered: 3 }] },
  { id: 4, name: '[Category]', parentId: null, path: '[Category]', products: 0, details: [] },
];

async function openCategories({ start = START(), refuse = null, listReply = null } = {}) {
  calls = [];
  cats = start;
  let next = 50;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/stockroom-settings') return reply(200, { adjustTodayOverPence: null });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/product-categories' && method === 'GET') return reply(200, listReply ?? { categories: cats });
    if (refuse && method !== 'GET') return reply(refuse.status, { error: refuse.error });
    if (u.pathname === '/api/product-categories' && method === 'POST') {
      const parent = cats.find((c) => c.id === body.parentId);
      const made = { id: next++, name: body.name, parentId: body.parentId ?? null, path: parent ? `${parent.path} › ${body.name}` : body.name, products: 0, details: [] };
      cats = [...cats, made];
      return reply(201, made);
    }
    const one = u.pathname.match(/^\/api\/product-categories\/(\d+)$/);
    if (one && method === 'PUT') {
      cats = cats.map((c) => (c.id === Number(one[1]) ? { ...c, parentId: body.parentId ?? c.parentId, details: (body.details ?? c.details).map((d, i) => ({ id: d.id ?? 90 + i, unit: null, choices: [], answered: 0, ...d })) } : c));
      return reply(200, cats.find((c) => c.id === Number(one[1])));
    }
    return reply(200, []);
  };
  uninstall = installDom('http://localhost/workshop/settings?room=stockroom');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const fold = await ui.findByRole('button', { name: /^Categories/ });
  if (fold.getAttribute('aria-expanded') !== 'true') rtl.fireEvent.click(fold);
  await ui.findByRole('button', { name: '+ Add a category' });
  return { ...rtl, ui, fold };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body]);
async function edit(t, name) {
  t.fireEvent.click(t.ui.getByRole('button', { name: `Edit ${name}` }));
  return t.within(await t.ui.findByRole('dialog'));
}

test('Stockroom says what it holds, and Categories follows Stock adjustments with the drawn summary', async () => {
  const { ui, fold } = await openCategories();
  assert.ok(ui.getByText('Stock adjustments, and each category’s details.'));
  assert.match(fold.textContent, /Bearings, Drivetrain › Derailleurs and 1 more/);
  const adjust = ui.getByRole('button', { name: /^Stock adjustments/ });
  assert.ok(adjust.compareDocumentPosition(fold) & Node.DOCUMENT_POSITION_FOLLOWING);
});

test('each category with its details on one line, one inside another set in, Edit, the note, + Add a category', async () => {
  const t = await openCategories();
  const rows = t.ui.getAllByRole('listitem').map((li) => li.textContent);
  assert.deepEqual(rows, [
    'BearingsInner diameter (mm) · Outer diameter (mm) · Height (mm)Edit',
    'Drivetrain[Detail] · passed down to its sub-categoriesEdit',
    '↳ Inside Drivetrain: DerailleursNumber of gears (a choice) · and Drivetrain’s detailsEdit',
    '[Category]No details yetEdit',
  ]);
  assert.ok(t.ui.getByText('A product shows its category’s details to fill in, and Stock can filter by them.'));
  const indents = t.ui.getAllByRole('listitem').map((li) => li.style.paddingLeft);
  assert.deepEqual(indents, ['0px', '0px', '24px', '0px']);
});

test('the edit box as drawn: where it sits, what it has from above, its own details and choices', async () => {
  const t = await openCategories();
  const box = await edit(t, 'Derailleurs');
  assert.ok(box.getByRole('heading', { name: 'Derailleurs' }));
  assert.ok(box.getByText('A sub-category of Drivetrain'));
  assert.equal(box.getByRole('combobox', { name: 'Sits inside' }).value, 'Drivetrain');
  assert.ok(box.getByText('From Drivetrain'));
  assert.ok(box.getByText('[Detail]'));
  assert.ok(box.getByRole('button', { name: 'Change it on Drivetrain' }));
  assert.ok(box.getByText('Derailleurs’ own details'));
  assert.equal(box.getByRole('textbox', { name: 'Detail name' }).value, 'Number of gears');
  assert.match(box.getByRole('textbox', { name: 'Detail name' }).closest('[role="listitem"]').textContent, /A choice from a list/);
  const choices = box.getByRole('group', { name: 'Choices for Number of gears' });
  assert.ok(t.within(choices).getByRole('button', { name: 'Remove the choice [n]' }));
  assert.ok(box.getByText('Every product in Derailleurs — already in stock or added later — gets these details.'));
});

test('a choice taken off and one added with Enter, a detail renamed: Save sends the whole list', async () => {
  const t = await openCategories();
  const box = await edit(t, 'Derailleurs');
  t.fireEvent.click(box.getByRole('button', { name: 'Remove the choice [n]' }));
  const add = box.getByRole('textbox', { name: 'Add a choice' });
  t.fireEvent.change(add, { target: { value: '[p]' } });
  t.fireEvent.keyDown(add, { key: 'Enter' });
  t.fireEvent.change(box.getByRole('textbox', { name: 'Detail name' }), { target: { value: 'Gears' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(writes(), [['PUT', '/api/product-categories/3', { parentId: 2, details: [{ id: 31, name: 'Gears', kind: 'choice', choices: ['[m]', '[p]'] }] }]]);
});

test('a detail removed can be undone until Save, and Save says how many products lose it', async () => {
  const t = await openCategories();
  const box = await edit(t, 'Derailleurs');
  t.fireEvent.click(box.getByRole('button', { name: 'Remove Number of gears' }));
  assert.ok(box.getByText('· removed'));
  assert.ok(box.getByText('Every product in Derailleurs — already in stock or added later — gets these details. Saving removes Number of gears from 3 products.'));
  t.fireEvent.click(box.getByRole('button', { name: 'Undo removing Number of gears' }));
  assert.equal(box.getByRole('textbox', { name: 'Detail name' }).value, 'Number of gears');
  t.fireEvent.click(box.getByRole('button', { name: 'Remove Number of gears' }));
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(writes()[0][2].details, []);
});

test('Add a detail asks for what each kind needs: a unit, or its choices; text needs nothing', async () => {
  const t = await openCategories();
  const box = await edit(t, 'Bearings');
  const name = box.getByRole('textbox', { name: 'New detail name' });
  assert.ok(box.getByRole('textbox', { name: 'Unit' }), 'a number asks for a unit');
  t.fireEvent.click(box.getByRole('radio', { name: 'A choice from a list' }));
  assert.ok(box.queryByRole('textbox', { name: 'Unit' }) === null);
  assert.ok(box.getByRole('textbox', { name: 'Choices for the new detail' }));
  t.fireEvent.click(box.getByRole('radio', { name: 'Text' }));
  assert.ok(box.queryByRole('textbox', { name: 'Unit' }) === null && box.queryByRole('textbox', { name: 'Choices for the new detail' }) === null);
  t.fireEvent.click(box.getByRole('radio', { name: 'A number with a unit' }));
  t.fireEvent.change(name, { target: { value: 'Width' } });
  t.fireEvent.change(box.getByRole('textbox', { name: 'Unit' }), { target: { value: 'mm' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Add this detail' }));
  assert.equal(name.value, '', 'the box is ready for the next');
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(writes()[0][2].details.at(-1), { name: 'Width', kind: 'number', unit: 'mm' });
});

test('+ Add a category: a name, where it sits picked with the arrow keys, its details; made then saved', async () => {
  const t = await openCategories();
  t.fireEvent.click(t.ui.getByRole('button', { name: '+ Add a category' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  assert.ok(box.getByRole('heading', { name: 'Add a category' }));
  t.fireEvent.change(box.getByRole('textbox', { name: 'Name' }), { target: { value: '[Rear]' } });
  const inside = box.getByRole('combobox', { name: 'Sits inside' });
  t.fireEvent.change(inside, { target: { value: 'der' } });
  t.fireEvent.keyDown(inside, { key: 'ArrowDown' });
  t.fireEvent.keyDown(inside, { key: 'Enter' });
  assert.equal(inside.value, 'Drivetrain › Derailleurs');
  t.fireEvent.change(box.getByRole('textbox', { name: 'New detail name' }), { target: { value: '[Cage]' } });
  t.fireEvent.change(box.getByRole('textbox', { name: 'Unit' }), { target: { value: 'mm' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Add this detail' }));
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(writes(), [
    ['POST', '/api/product-categories', { name: '[Rear]', parentId: 3 }],
    ['PUT', '/api/product-categories/50', { parentId: 3, details: [{ name: '[Cage]', kind: 'number', unit: 'mm' }] }],
  ]);
});

test('a category can’t be put inside itself or inside one of its own sub-categories', async () => {
  const t = await openCategories();
  const box = await edit(t, 'Drivetrain');
  t.fireEvent.change(box.getByRole('combobox', { name: 'Sits inside' }), { target: { value: 'r' } });
  const offered = box.getAllByRole('option').map((o) => o.textContent);
  assert.deepEqual(offered, ['Bearings', '[Category]']);
});

test('Change it on Drivetrain opens Drivetrain', async () => {
  const t = await openCategories();
  const box = await edit(t, 'Derailleurs');
  t.fireEvent.click(box.getByRole('button', { name: 'Change it on Drivetrain' }));
  await t.waitFor(() => assert.ok(t.within(t.ui.getByRole('dialog')).queryByRole('heading', { name: 'Drivetrain' })));
});

test('a refusal is said in the server’s words, and the box stays', async () => {
  const t = await openCategories({ refuse: { status: 409, error: 'Drivetrain › Derailleurs is being counted. Apply that count first.' } });
  const box = await edit(t, 'Derailleurs');
  t.fireEvent.change(box.getByRole('combobox', { name: 'Sits inside' }), { target: { value: '' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Drivetrain › Derailleurs is being counted. Apply that count first.');
  assert.ok(t.ui.getByRole('dialog'));
});

test('an answer without the categories leaves the rest of Settings working', async () => {
  const t = await openCategories({ listReply: [] });
  assert.ok(t.ui.getByRole('button', { name: /^Stock adjustments/ }));
  assert.ok(t.ui.getByText('No categories yet.'));
});

test('no categories yet says so, with + Add a category', async () => {
  const { ui, fold } = await openCategories({ start: [] });
  assert.match(fold.textContent, /None yet/);
  assert.ok(ui.getByText('No categories yet.'));
});
