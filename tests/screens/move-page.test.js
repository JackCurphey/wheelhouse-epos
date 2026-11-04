// Moving from Citrus Lime, Bring your data (openspec/changes/citrus-import-screens;
// mv-start, mv-progress, mv-progress-failed, mv-summary in moving.mjs; decisions
// 2, 4 and 9). Files are named as placeholders; no real export goes in the repo.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const FILE = (over) => ({ id: 1, report: 'price_list', fileName: '[file name]', state: 'done', rowsTotal: 9, rowsIn: 9, rowsSame: 0, rowsSkipped: 0, rowsLook: 0, rowsLeftOut: 0, rowsFixed: 0, stockIn: 7, stockLook: 0, stockLeftOut: 0, ...over });

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

async function open({ user = OWNER, files = [], post } = {}) {
  const uninstall = installDom('http://localhost/workshop/moving');
  const realFetch = globalThis.fetch;
  current = { uninstall, realFetch };
  const state = { files, sent: [], deleted: [] };
  const json = (status, body) => ({ status, ok: status < 300, json: async () => body });
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url, 'http://localhost').pathname;
    if (path === '/api/auth/me') return json(200, user);
    if (path === '/api/move') return json(200, { files: state.files });
    if (path === '/api/move/files') {
      const body = JSON.parse(options.body);
      state.sent.push(body);
      return post ? post(body, json, state) : json(202, FILE({ fileName: body.fileName, state: 'reading', report: null, rowsIn: 0, stockIn: 0 }));
    }
    if (path.startsWith('/api/move/files/')) {
      state.deleted.push(path);
      state.files = state.files.filter((f) => `/api/move/files/${f.id}` !== path);
      return json(200, { ok: true });
    }
    if (path.startsWith('/api/')) return json(200, []);
    return json(404, { error: 'Not found' });
  };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  current.shell = await importFresh(SHELL);
  const view = rtl.render(createElement(current.shell.AppShell));
  return { ...view, state };
}
const text = async (view, wanted) => {
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.match(document.body.textContent, wanted));
};
const drop = async (view, name, content = 'x') => {
  const { fireEvent } = await import('@testing-library/react');
  const file = new window.File([content], name);
  fireEvent.change(view.getByLabelText('Choose files'), { target: { files: [file] } });
};
const rowOf = (title) => [...document.querySelectorAll('li')].find((li) => li.textContent.startsWith(title));

test('Bring your data: the stages, which files to download, and the drop zone (mv-start)', async () => {
  const view = await open();
  await text(view, /Bring your data from Citrus Lime/);
  assert.match(document.body.textContent, /Download these from Citrus Lime, then drop them in together\. Nothing in Citrus Lime changes\./);
  assert.match(rowOf('Products').textContent, /Price List - Store Level and Barcode\/Alias List, in Cloud Reports.*Not added yet/);
  assert.match(rowOf('Stock levels').textContent, /Not added yet/);
  assert.match(document.body.textContent, /Drop all the files here/);
  assert.match(document.body.textContent, /Wheelhouse works out which file is which/);
  const stages = document.querySelector('nav[aria-label="Stages of the move"]');
  assert.deepEqual([...stages.querySelectorAll('li')].map((li) => li.textContent), ['1Bring your dataNow', '2Run alongsideLater', '3Switch overLater']);
  assert.ok(stages.querySelector('[aria-current="step"]').textContent.includes('Bring your data'));
  assert.ok(![...document.querySelectorAll('button')].some((b) => /^Import/.test(b.textContent)), 'it starts by itself');
});

test('dropping a file sends it with a key, and it starts by itself, with leaving allowed (mv-progress)', async () => {
  const view = await open({ post: (body, json, state) => { state.files = [FILE({ fileName: body.fileName, state: 'bringing', rowsIn: 2, rowsSame: 1, stockIn: 2 })]; return json(202, state.files[0]); } });
  await text(view, /Drop all the files here/);
  await drop(view, 'Price List.xlsx', 'made up');
  await text(view, /Bringing your data across/);
  await text(view, /Price List\.xlsx · 3 of 9/);
  assert.equal(view.state.sent[0].fileName, 'Price List.xlsx');
  assert.equal(view.state.sent[0].dataBase64, Buffer.from('made up').toString('base64'));
  assert.ok(view.state.sent[0].requestKey.length >= 32);
  assert.match(document.body.textContent, /You can leave this page — Wheelhouse carries on and shows the result here\./);
  assert.match(rowOf('Products').textContent, /Bringing across/);
  assert.ok(document.querySelector('[role="status"][aria-live="polite"]'), 'progress announces itself');
});

test('a file Wheelhouse can\'t read says so, even after leaving, and asks for another (mv-progress-failed)', async () => {
  const refused = FILE({ id: 7, report: null, fileName: '[file name].xlsx', state: 'cant_read', rowsTotal: 0, rowsIn: 0, stockIn: 0 });
  const view = await open({ files: [refused], post: (body, json, state) => { state.files = [...state.files, FILE({ id: 8, fileName: body.fileName })]; return json(202, state.files.at(-1)); } });
  await text(view, /Wheelhouse couldn’t read this file/);
  assert.match(document.body.textContent, /Couldn’t read it/);
  const { fireEvent, waitFor } = await import('@testing-library/react');
  fireEvent.click(view.getByRole('button', { name: 'Choose another file for [file name].xlsx' }));
  assert.match(document.body.textContent, /Wheelhouse couldn’t read this file/, 'it stays while the owner chooses');
  assert.deepEqual(view.state.deleted, []);
  const good = new window.File(['y'], 'Price List.xlsx');
  fireEvent.change(view.getByLabelText('Choose another file'), { target: { files: [good] } });
  await waitFor(() => assert.deepEqual(view.state.deleted, ['/api/move/files/7']));
  await waitFor(() => assert.equal(view.state.sent.at(-1).fileName, 'Price List.xlsx'));
  await text(view, /Here’s what came across/);
  assert.ok(!document.body.textContent.includes('[file name].xlsx'), 'the refused one has gone');
});

test('a file being read shows, by name, while it\'s read', async () => {
  const view = await open({ files: [FILE({ report: null, fileName: 'Price List.xlsx', state: 'reading', rowsTotal: 0, rowsIn: 0, stockIn: 0 })] });
  await text(view, /Bringing your data across/);
  assert.match(rowOf('Price List.xlsx').textContent, /Bringing across/);
});

test('told the server is busy with another file, it waits and sends again with the same key', async () => {
  let tries = 0;
  const view = await open({ post: (body, json, state) => { tries += 1; if (tries === 1) return json(429, { error: 'x', code: 'busy' }); state.files = [FILE()]; return json(202, state.files[0]); } });
  await text(view, /Drop all the files here/);
  await drop(view, 'a.xlsx');
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.equal(view.state.sent.length, 2), { timeout: 5000 });
  assert.equal(view.state.sent[0].requestKey, view.state.sent[1].requestKey);
  await text(view, /Here’s what came across/);
});

test('a file too large isn\'t sent, and says it can\'t be read', async () => {
  const view = await open();
  await text(view, /Drop all the files here/);
  const { fireEvent } = await import('@testing-library/react');
  const big = new window.File(['x'], 'big.xlsx');
  Object.defineProperty(big, 'size', { value: 31 * 1024 * 1024 });
  fireEvent.change(view.getByLabelText('Choose files'), { target: { files: [big] } });
  await text(view, /Wheelhouse couldn’t read this file/);
  assert.equal(view.state.sent.length, 0);
});

test('a send that got no answer goes once more with the same key', async () => {
  let tries = 0;
  const view = await open({ post: (body, json, state) => { tries += 1; if (tries === 1) throw new TypeError('network'); state.files = [FILE({ state: 'done' })]; return json(202, state.files[0]); } });
  await text(view, /Drop all the files here/);
  await drop(view, 'a.xlsx');
  await text(view, /Here’s what came across/);
  assert.equal(view.state.sent.length, 2);
  assert.equal(view.state.sent[0].requestKey, view.state.sent[1].requestKey);
});

test('a send the server failed says it wasn\'t sent, not that it can\'t be read', async () => {
  const view = await open({ post: (body, json) => json(500, { error: 'x' }) });
  await text(view, /Drop all the files here/);
  await drop(view, 'a.xlsx');
  await text(view, /Wheelhouse couldn’t send this file\. Try again in a moment\./);
  assert.match(document.body.textContent, /Not sent/);
  assert.ok(!document.body.textContent.includes('couldn’t read'));
});

test('here\'s what came across: counts, All in, and how many need a look, with more files welcome (mv-summary)', async () => {
  const view = await open({ files: [FILE({ rowsIn: 8, rowsLook: 1, stockIn: 6 }), FILE({ id: 2, report: 'barcodes', rowsIn: 4, rowsLook: 2, stockIn: 0 })] });
  await text(view, /Here’s what came across/);
  assert.match(rowOf('Products').textContent, /8 brought across/);
  assert.match(rowOf('Products').textContent, /3 need a look/);
  assert.match(rowOf('Stock levels').textContent, /6 brought across.*All in/);
  assert.match(document.body.textContent, /Drop more files here/);
});

test('all in says so', async () => {
  const view = await open({ files: [FILE()] });
  await text(view, /Here’s what came across/);
  assert.match(rowOf('Products').textContent, /9 brought across.*All in/);
  assert.ok(!rowOf('Products').textContent.includes('already here'));
});

test('a file sent again says what was already here, not that it came across twice', async () => {
  const view = await open({ files: [FILE(), FILE({ id: 2, rowsIn: 0, rowsSame: 9, stockIn: 0 })] });
  await text(view, /Here’s what came across/);
  assert.match(rowOf('Products').textContent, /9 brought across · 9 already here.*All in/);
  assert.match(rowOf('Stock levels').textContent, /7 brought across.*All in/);
});

test('stock that didn\'t come across means Stock levels isn\'t All in', async () => {
  const view = await open({ files: [FILE({ rowsIn: 5, rowsLook: 4, stockIn: 5, stockLook: 3 })] });
  await text(view, /Here’s what came across/);
  assert.match(rowOf('Stock levels').textContent, /5 brought across.*3 need a look/);
  assert.ok(!rowOf('Stock levels').textContent.includes('All in'));
});

test('it\'s in the Owner\'s sidebar under Office, after Today, and not for anyone else', async () => {
  const view = await open();
  await text(view, /Bring your data from Citrus Lime/);
  const links = [...document.querySelectorAll('nav[aria-label="Main"] a')].map((a) => a.textContent);
  assert.equal(links[links.indexOf('Today') + 1], 'Moving from Citrus Lime');
  assert.equal(document.querySelector('h1')?.textContent, 'Moving from Citrus Lime');
});

test('anyone else is told it\'s for the owner, and has no sidebar link', async () => {
  const view = await open({ user: JO });
  await text(view, /Moving from Citrus Lime is for the shop’s owner\./);
  const links = [...document.querySelectorAll('nav[aria-label="Main"] a')].map((a) => a.textContent);
  assert.ok(!links.includes('Moving from Citrus Lime'));
});

test('customers: where to find them, how many, the bikes beside them, and any that need a look', async () => {
  const view = await open({ files: [FILE({ report: 'customers', rowsIn: 12, rowsLook: 2, stockIn: 0 }), FILE({ id: 2, report: 'bikes', rowsIn: 5, rowsLook: 1, stockIn: 0 })] });
  await text(view, /Here’s what came across/);
  assert.match(rowOf('Customers').textContent, /12 brought across · 5 bikes/);
  assert.ok(!rowOf('Customers').textContent.includes('already here'));
  assert.match(rowOf('Customers').textContent, /3 need a look/);
  assert.match(rowOf('Products').textContent, /Not added yet/);
  assert.match(rowOf('Sales').textContent, /Later/);
});

test('customers already here, and those left out as they asked, are said, not counted as brought across', async () => {
  const view = await open({ files: [FILE({ report: 'customers', rowsIn: 0, rowsSame: 4, rowsSkipped: 2, stockIn: 0 })] });
  await text(view, /Here’s what came across/);
  assert.match(rowOf('Customers').textContent, /0 brought across · 4 already here · 2 left out, as they asked · 0 bikes.*All in/);
});

test('the customers row says which reports to download', async () => {
  const view = await open();
  await text(view, /Bring your data from Citrus Lime/);
  assert.match(rowOf('Customers').textContent, /Top Customers and Service Items Report \(tick “include items never serviced”\), in Cloud Reports.*Not added yet/);
  view.unmount();
});
