// Settings › Stockroom › Bike warranties (openspec/changes/finish-customers, design 6; Jack's
// 9 Nov answer 3). Not drawn: the fold follows Categories' pattern, after Categories (logged).
// Trek and Cube with their lines, as the plan's scenarios name them; the rest placeholders.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let brands;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

const TREK = { id: 1, brand: 'Trek', lines: [{ part: 'frame', years: null }, { part: 'components', years: 2 }, { part: 'electronics', years: 2 }] };
const CUBE = { id: 2, brand: 'Cube', lines: [{ part: 'frame', years: 10 }, { part: 'components', years: 2 }] };

async function openWarranties({ start = [CUBE, TREK], refuse = null } = {}) {
  calls = [];
  brands = start;
  let next = 50;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/stockroom-settings') return reply(200, { adjustTodayOverPence: null });
    if (u.pathname === '/api/product-categories') return reply(200, { categories: [] });
    if (u.pathname === '/api/bike-warranties' && method === 'GET') return reply(200, { brands });
    if (refuse && method !== 'GET') return reply(refuse.status, { error: refuse.error });
    if (u.pathname === '/api/bike-warranties' && method === 'POST') {
      const made = { id: next++, brand: body.brand, lines: body.lines };
      brands = [...brands, made];
      return reply(201, made);
    }
    const one = u.pathname.match(/^\/api\/bike-warranties\/(\d+)$/);
    if (one && method === 'PUT') {
      brands = brands.map((b) => (b.id === Number(one[1]) ? { id: b.id, brand: body.brand, lines: body.lines } : b));
      return reply(200, brands.find((b) => b.id === Number(one[1])));
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
  const fold = await ui.findByRole('button', { name: /^Bike warranties/ });
  if (fold.getAttribute('aria-expanded') !== 'true') rtl.fireEvent.click(fold);
  await ui.findByRole('button', { name: '+ Add a brand' });
  return { ...rtl, ui, fold };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body]);

test('Bike warranties follows Categories, summarised by brand; each brand with its lines and Edit', async () => {
  const t = await openWarranties();
  const categories = t.ui.getByRole('button', { name: /^Categories/ });
  assert.ok(categories.compareDocumentPosition(t.fold) & Node.DOCUMENT_POSITION_FOLLOWING);
  assert.match(t.fold.textContent, /Cube, Trek/);
  const rows = t.within(t.ui.getByRole('list', { name: 'Bike brands' })).getAllByRole('listitem').map((li) => li.textContent);
  assert.deepEqual(rows, ['CubeFrame 10 years · Components 2 yearsEdit', 'TrekFrame lifetime · Components 2 years · Electronics 2 yearsEdit']);
  assert.ok(t.ui.getByText('A bike sold, or recorded as bought here, keeps the warranty it had then.'));
});

test('no brands yet', async () => {
  const t = await openWarranties({ start: [] });
  assert.match(t.fold.textContent, /None yet/);
  assert.ok(t.ui.getByText('No brands yet.'));
});

test('+ Add a brand: its name and each line as years, Lifetime or not covered; Electronics for e-bikes only', async () => {
  const t = await openWarranties({ start: [] });
  t.fireEvent.click(t.ui.getByRole('button', { name: '+ Add a brand' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Add a brand' }));
  t.fireEvent.change(box.getByLabelText('Brand'), { target: { value: 'Trek' } });
  for (const part of ['Frame', 'Components', 'Electronics']) {
    assert.equal(t.within(box.getByRole('radiogroup', { name: part })).getByRole('radio', { name: 'Not covered' }).getAttribute('aria-checked'), 'true');
  }
  assert.ok(box.getByText('E-bikes only'));
  t.fireEvent.click(t.within(box.getByRole('radiogroup', { name: 'Frame' })).getByRole('radio', { name: 'Lifetime' }));
  t.fireEvent.click(t.within(box.getByRole('radiogroup', { name: 'Components' })).getByRole('radio', { name: 'Years' }));
  t.fireEvent.change(box.getByLabelText('Components, years'), { target: { value: '2' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.equal(writes().length, 1));
  assert.deepEqual(writes()[0], ['POST', '/api/bike-warranties', { brand: 'Trek', lines: [{ part: 'frame', years: null }, { part: 'components', years: 2 }] }]);
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.ok(await t.ui.findByText('Frame lifetime · Components 2 years'));
});

test('Edit Trek starts at its lines; a line typed as a fraction is refused before saving; the server’s refusal shows', async () => {
  const t = await openWarranties({ refuse: { status: 409, error: 'Cube is already listed' } });
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Edit Trek' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Trek' }));
  assert.equal(box.getByLabelText('Brand').value, 'Trek');
  assert.equal(t.within(box.getByRole('radiogroup', { name: 'Frame' })).getByRole('radio', { name: 'Lifetime' }).getAttribute('aria-checked'), 'true');
  assert.equal(box.getByLabelText('Components, years').value, '2');
  t.fireEvent.change(box.getByLabelText('Components, years'), { target: { value: '1.5' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText('Type whole years, from 1 to 50, or choose Lifetime'));
  assert.equal(writes().length, 0);
  t.fireEvent.change(box.getByLabelText('Components, years'), { target: { value: '3' } });
  t.fireEvent.change(box.getByLabelText('Brand'), { target: { value: 'cube' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText('Cube is already listed'));
  assert.deepEqual(writes()[0].slice(0, 2), ['PUT', '/api/bike-warranties/1']);
});
