// The "More for [name]" menu on Your reports, Rename, and Delete with Undo (openspec/changes/
// reports-your-own, group 3; drawn as rp-report-menu and rp-report-deleted in generator/reports.mjs;
// decisions 9 to 11). The answers are the shapes server/lib/saved-reports.js sends.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, HOME, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);

const TAKEN = 'You already have a report with this name. Choose another name.';
const NO_MANAGERS = 'there are no managers until staff roles are set up';
const BOTTLES = { id: 1, name: 'Bottles', base: 'sales', measure: 'items', split: 'product', only: ['Accessories'], supplier: '', period: 'this-week', opensOn: 'this-week', shared: false, what: 'Sales: items sold by product · Accessories only' };
const STAFF_REPORT = { ...BOTTLES, id: 2, name: 'Staff takings', measure: 'takings', split: 'staff', only: [], what: 'Sales: takings by staff member' };
const saved = (path) => calls.filter((c) => c.path.startsWith('/api/reports/saved/') && (!path || c.path.endsWith(path)));

// A tiny server for the saved reports: it keeps what was changed, so the lists after each change are true.
function server({ refuseUndo = false } = {}) {
  let rows = [BOTTLES, STAFF_REPORT];
  let deleted = [];
  return {
    '/api/reports/home': () => [200, HOME],
    '/api/reports/saved': () => [200, { reports: rows }],
    ...Object.fromEntries([1, 2].flatMap((id) => [
      [`/api/reports/saved/${id}`, (q, method, body) => {
        if (method === 'DELETE') { const r = rows.find((x) => x.id === id); rows = rows.filter((x) => x.id !== id); deleted.push(r); return [200, { id, name: r.name }]; }
        if (body.name === 'Bottles') return [400, { error: TAKEN }];
        if (!String(body.name).trim()) return [400, { error: 'Type its name' }];
        rows = rows.map((x) => (x.id === id ? { ...x, name: body.name.trim() } : x));
        return [200, rows.find((x) => x.id === id)];
      }],
      [`/api/reports/saved/${id}/undo`, (q, method, body) => {
        if (refuseUndo && !body?.name) return [400, { error: TAKEN }];
        const r = deleted.find((x) => x.id === id);
        rows = [...rows, { ...r, name: body?.name?.trim() || r.name }].sort((a, b) => a.id - b.id);
        return [200, r];
      }],
    ])),
  };
}

async function open(extra) {
  const opened = await openReports('/workshop/reports', { answers: server(extra) });
  const { ui, within } = opened;
  const box = within(await ui.findByRole('region', { name: 'Your reports' }));
  await box.findByRole('link', { name: /Bottles/ });
  return { ...opened, box };
}

test('each report has a "More for [name]" menu with Rename, Share with managers (greyed, with its reason) and Delete', async () => {
  const { ui, box, within, fireEvent } = await open();
  const more = box.getByRole('button', { name: 'More for Bottles' });
  assert.equal(more.getAttribute('aria-haspopup'), 'menu');
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  fireEvent.click(more);
  const menu = within(await ui.findByRole('menu', { name: 'Bottles' }));
  assert.deepEqual(menu.getAllByRole('menuitem').map((m) => m.textContent), ['Rename', 'Share with managers', 'Delete']);
  const share = menu.getByRole('menuitem', { name: 'Share with managers' });
  assert.equal(share.getAttribute('aria-disabled'), 'true');
  assert.equal(share.getAttribute('aria-description'), NO_MANAGERS);
  assert.ok(menu.queryByText(NO_MANAGERS) !== null);
  assert.equal(box.getByRole('button', { name: 'More for Bottles' }).getAttribute('aria-expanded'), 'true');
  // Escape closes it and puts the focus back on the button.
  fireEvent.keyDown(menu.getByRole('menuitem', { name: 'Rename' }), { key: 'Escape' });
  assert.ok(ui.queryByRole('menu') === null);
  assert.equal(document.activeElement, box.getByRole('button', { name: 'More for Bottles' }));
  assert.ok(box.getByRole('link', { name: /Bottles/ }) !== null);
});

test('Share with managers does nothing while there are no managers', async () => {
  const { ui, box, within, fireEvent } = await open();
  fireEvent.click(box.getByRole('button', { name: 'More for Bottles' }));
  const menu = within(await ui.findByRole('menu', { name: 'Bottles' }));
  fireEvent.click(menu.getByRole('menuitem', { name: 'Share with managers' }));
  assert.ok(ui.queryByRole('menu') !== null, 'the menu stays');
  assert.equal(saved().length, 0);
});

test('Rename opens the save popup with only the name, and saves the new name', async () => {
  const { ui, box, within, fireEvent } = await open();
  fireEvent.click(box.getByRole('button', { name: 'More for Bottles' }));
  fireEvent.click(within(await ui.findByRole('menu', { name: 'Bottles' })).getByRole('menuitem', { name: 'Rename' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Rename' }));
  assert.equal(dialog.getByLabelText('Name (needed)').value, 'Bottles');
  assert.ok(dialog.queryByRole('radio', { name: 'Just me' }) === null, 'only the name');
  fireEvent.change(dialog.getByLabelText('Name (needed)'), { target: { value: '  Water bottles  ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await within(await ui.findByRole('region', { name: 'Your reports' })).findByRole('link', { name: /Water bottles/ });
  assert.deepEqual(saved()[0].body, { name: 'Water bottles' });
  assert.equal(saved()[0].method, 'PATCH');
  assert.ok(ui.queryByRole('dialog', { name: 'Rename' }) === null);
});

test('Rename refuses no name and a name already used, beside the field, and stays open', async () => {
  const { ui, box, within, fireEvent } = await open();
  fireEvent.click(box.getByRole('button', { name: 'More for Staff takings' }));
  fireEvent.click(within(await ui.findByRole('menu', { name: 'Staff takings' })).getByRole('menuitem', { name: 'Rename' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Rename' }));
  fireEvent.change(dialog.getByLabelText('Name (needed)'), { target: { value: ' ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  assert.ok(dialog.queryByText('Type its name') !== null);
  assert.equal(saved().length, 0);
  fireEvent.change(dialog.getByLabelText('Name (needed)'), { target: { value: 'Bottles' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  assert.ok(await dialog.findByText(TAKEN) !== null);
  assert.ok(ui.queryByRole('dialog', { name: 'Rename' }) !== null);
});

test('Delete takes the report from the list at once, with the bar “[name]” deleted and Undo', async () => {
  const { ui, box, within, fireEvent } = await open();
  fireEvent.click(box.getByRole('button', { name: 'More for Bottles' }));
  fireEvent.click(within(await ui.findByRole('menu', { name: 'Bottles' })).getByRole('menuitem', { name: 'Delete' }));
  const bar = await ui.findByText('“Bottles” deleted.');
  assert.equal(bar.closest('[role="status"]') !== null, true);
  assert.equal(saved()[0].method, 'DELETE');
  const list = within(ui.getByRole('region', { name: 'Your reports' }));
  assert.ok(list.queryByRole('link', { name: /Bottles/ }) === null);
  assert.ok(list.queryByRole('link', { name: /Staff takings/ }) !== null);
  assert.ok(ui.getByRole('button', { name: 'Undo' }) !== null);
});

test('Undo brings it back as it was, and the bar goes for good', async () => {
  const { ui, box, within, fireEvent } = await open();
  fireEvent.click(box.getByRole('button', { name: 'More for Bottles' }));
  fireEvent.click(within(await ui.findByRole('menu', { name: 'Bottles' })).getByRole('menuitem', { name: 'Delete' }));
  await ui.findByText('“Bottles” deleted.');
  fireEvent.click(ui.getByRole('button', { name: 'Undo' }));
  await within(ui.getByRole('region', { name: 'Your reports' })).findByRole('link', { name: /Bottles/ });
  assert.ok(ui.queryByText('“Bottles” deleted.') === null);
  assert.ok(ui.queryByRole('button', { name: 'Undo' }) === null);
  assert.equal(saved('/undo')[0].method, 'POST');
});

test('Undo after the name is used again says so and asks for a new name, then brings it back under it', async () => {
  const { ui, box, within, fireEvent } = await open({ refuseUndo: true });
  fireEvent.click(box.getByRole('button', { name: 'More for Bottles' }));
  fireEvent.click(within(await ui.findByRole('menu', { name: 'Bottles' })).getByRole('menuitem', { name: 'Delete' }));
  await ui.findByText('“Bottles” deleted.');
  fireEvent.click(ui.getByRole('button', { name: 'Undo' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Rename' }));
  assert.ok(await dialog.findByText(TAKEN) !== null);
  fireEvent.change(dialog.getByLabelText('Name (needed)'), { target: { value: 'Bottles two' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await within(ui.getByRole('region', { name: 'Your reports' })).findByRole('link', { name: /Bottles two/ });
  assert.deepEqual(saved('/undo').at(-1).body, { name: 'Bottles two' });
  assert.ok(ui.queryByText('“Bottles” deleted.') === null);
});

test('deleting another report replaces the bar, and the old one can no longer be undone', async () => {
  const { ui, box, within, fireEvent } = await open();
  fireEvent.click(box.getByRole('button', { name: 'More for Bottles' }));
  fireEvent.click(within(await ui.findByRole('menu', { name: 'Bottles' })).getByRole('menuitem', { name: 'Delete' }));
  await ui.findByText('“Bottles” deleted.');
  fireEvent.click(box.getByRole('button', { name: 'More for Staff takings' }));
  fireEvent.click(within(await ui.findByRole('menu', { name: 'Staff takings' })).getByRole('menuitem', { name: 'Delete' }));
  await ui.findByText('“Staff takings” deleted.');
  assert.ok(ui.queryByText('“Bottles” deleted.') === null);
  assert.equal(ui.getAllByRole('button', { name: 'Undo' }).length, 1);
});
