// What the screen tests of the rows and Ask us to help share
// (openspec/changes/citrus-import-fix). Names and reasons are the drawings'; the rest
// is placeholder.
import { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from './dom.js';

export const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
export const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
export const FILE = (over) => ({ id: 1, report: 'customers', fileName: '[file name]', state: 'done', rowsTotal: 9, rowsIn: 7, rowsSame: 0, rowsSkipped: 0, rowsLook: 2, rowsLeftOut: 0, rowsFixed: 0, stockIn: 0, stockLook: 0, stockLeftOut: 0, ...over });
export const NO_NAME = { id: 11, report: 'customers', why: 'No name', seen: 'seen-11', fields: { 'Account Number': 'A11', Email: 'row@example.test' } };
export const SAME = { id: 12, report: 'customers', why: 'Looks like the same person as Maya Patel', seen: 'seen-12', fields: { 'First Name': 'Sam', 'Last Name': 'Patel', 'Account Number': 'A12', Email: 'maya@example.test' }, sameAs: { id: 5, name: 'Maya Patel' } };
export const SHARED = { id: 13, report: 'customers', why: 'Shares contact details with a customer who was deleted', seen: 'seen-13', fields: { 'First Name': '[Customer', 'Last Name': 'name]', 'Account Number': 'A13', Email: 'gone@example.test' } };
export const PADS = { id: 14, report: 'price_list', why: 'No price', seen: 'seen-14', fields: { 'Item Lookup Code': 'B05S-RX', Description: 'Shimano brake pads', 'Qty On Hand': '6' } };
export const BIKE = { id: 15, report: 'bikes', why: 'The customer on this bike isn’t in the customers file', seen: 'seen-15', fields: { Description: '[Bike]', 'Customer Name': '[Customer name]' } };
export const BARCODE = { id: 16, report: 'barcodes', why: 'The product isn’t in the products file', seen: 'seen-16', fields: { ILC: '[Product code]', Alias: '[Barcode]' } };
export const SORTED_NOTE = 'Everything that fitted is in. The ones you left out are kept, and will be listed under Settings › Office › Your data, to add by hand when you like.';

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current.shell?.queryClient.clear();
  current.uninstall?.();
  globalThis.fetch = current.realFetch;
  current = undefined;
});

// `answer` decides what a fix, leave-out or help says; by default each works, and the row goes.
export async function open({ files = [FILE()], rows = [NO_NAME, SAME], total, answer } = {}) {
  const uninstall = installDom('http://localhost/workshop/moving');
  const realFetch = globalThis.fetch;
  current = { uninstall, realFetch };
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const state = { files, rows, calls: [], fileSends: [] };
  const json = (status, body) => ({ status, ok: status < 300, json: async () => body });
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url, 'http://localhost').pathname;
    if (path === '/api/auth/me') return json(200, OWNER);
    if (path === '/api/move') return json(200, { files: state.files });
    if (path === '/api/move/look') return json(200, { rows: state.rows, total: total ?? state.rows.length });
    if (path === '/api/move/files') {
      state.fileSends.push(JSON.parse(options.body));
      state.whenSent?.(state);
      return json(202, FILE({ state: 'bringing' }));
    }
    if (path.startsWith('/api/move/')) {
      const body = JSON.parse(options.body);
      state.calls.push({ path, body });
      const said = answer ? await answer(path, body, json, state) : undefined;
      if (said) return said;
      const left = path.endsWith('leave-out');
      const fixed = path.endsWith('/fix');
      if (left || fixed) {
        const id = Number(path.split('/')[4]);
        state.rows = state.rows.filter((r) => r.id !== id);
        state.files = state.files.map((f, i) => (i === 0 ? { ...f, rowsLook: f.rowsLook - 1, rowsLeftOut: f.rowsLeftOut + (left ? 1 : 0), rowsFixed: f.rowsFixed + (fixed ? 1 : 0) } : f));
        return json(200, { id, state: left ? 'left_out' : 'in' });
      }
      return json(200, { ok: true });
    }
    if (path.startsWith('/api/')) return json(200, []);
    return json(404, { error: 'Not found' });
  };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  current.shell = await importFresh(SHELL);
  const view = rtl.render(createElement(current.shell.AppShell));
  return { ...view, state, rtl };
}
export const see = (view, wanted) => view.rtl.waitFor(() => assert.match(document.body.textContent, wanted));
export const click = (view, name) => view.rtl.fireEvent.click(view.getByRole('button', { name }));
export const findAndClick = async (view, name) => view.rtl.fireEvent.click(await view.findByRole('button', { name }));
export const toList = async (view, name = 'Look at the 2') => { await findAndClick(view, name); await view.findByRole('button', { name: 'Done for now' }); await view.findAllByRole('button', { name: /^Fix / }); };
export const openFix = async (view, name) => { await findAndClick(view, `Fix ${name}`); return view.findByRole('dialog', { name: `Fix ${name}` }); };
export const type = (view, label, value) => view.rtl.fireEvent.change(view.getByLabelText(label), { target: { value } });

