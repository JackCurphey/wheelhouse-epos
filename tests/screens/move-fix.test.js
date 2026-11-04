// The rows that need a look, Fix and Leave it out (openspec/changes/citrus-import-fix;
// mv-fix, mv-sorted in moving.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BARCODE, BIKE, FILE, NO_NAME, PADS, SAME, SHARED, SORTED_NOTE, click, open, openFix, see, toList, type } from '../helpers/move-screen.js';

test('Look at the [n] opens the rows, each saying why, with its buttons named after it (mv-fix)', async () => {
  const view = await open({ files: [FILE({ rowsLook: 2 }), FILE({ id: 2, report: 'price_list', rowsLook: 1 })], rows: [NO_NAME, SAME, PADS] });
  await toList(view, 'Look at the 3');
  await view.findByRole('heading', { level: 2, name: '3 need a look' });
  assert.match(document.body.textContent, /Everything else is in\. These didn’t fit, so they’re waiting for you — leave any out and add it by hand later\./);
  assert.ok(view.getByRole('heading', { level: 3, name: 'Customers · 2' }));
  assert.ok(view.getByRole('heading', { level: 3, name: 'Products · 1' }));
  assert.ok(view.getByRole('button', { name: 'Fix Shimano brake pads' }));
  assert.ok(view.getByRole('button', { name: 'Leave out Shimano brake pads' }));
  assert.ok(view.getByRole('button', { name: 'Fix Sam Patel' }));
  assert.match(document.body.textContent, /Looks like the same person as Maya Patel/);
  assert.ok(view.getByRole('button', { name: 'Fix A11' }), 'a row with no name goes by what it has');
  assert.ok(view.getByRole('button', { name: 'Done for now' }));
});

test('Done for now goes back to the summary, still saying how many need a look', async () => {
  const view = await open();
  await toList(view);
  click(view, 'Done for now');
  await see(view, /Here’s what came across/);
  assert.ok(view.getByRole('button', { name: 'Look at the 2' }));
  assert.ok(!document.body.textContent.includes('Everything’s sorted'));
});

test('nothing needing a look: no Look at the button', async () => {
  const view = await open({ files: [FILE({ rowsLook: 0 })], rows: [] });
  await see(view, /Here’s what came across/);
  assert.ok(view.queryByRole('button', { name: /^Look at the/ }) === null);
  assert.ok(!document.body.textContent.includes('Everything’s sorted'), 'nothing was sorted: the summary');
});

test('more rows than the list holds says so', async () => {
  const view = await open({ total: 250, files: [FILE({ rowsLook: 250 })] });
  await toList(view, 'Look at the 250');
  await see(view, /Showing the first 2 of 250\. The rest show as these are sorted\./);
});

test('Fix asks for that row\'s details, by the kind of row, and saves them with what was seen and a key', async () => {
  const view = await open({ rows: [PADS], files: [FILE({ report: 'price_list', rowsLook: 1 })] });
  await toList(view, 'Look at the 1');
  await openFix(view, 'Shimano brake pads');
  assert.ok(view.getByRole('heading', { name: 'Fix Shimano brake pads' }));
  assert.equal(view.getByLabelText('Product code').value, 'B05S-RX');
  assert.equal(view.getByLabelText('Stock').value, '6');
  for (const label of ['Description', 'Price', 'Cost', 'VAT rate', 'Reorder level']) assert.ok(view.getByLabelText(label), label);
  type(view, 'Price', '28.00');
  click(view, 'Save');
  await view.rtl.waitFor(() => assert.equal(view.state.calls.length, 1));
  const { path, body } = view.state.calls[0];
  assert.equal(path, '/api/move/rows/14/fix');
  assert.equal(body.seen, 'seen-14');
  assert.equal(body.fields.Price, '28.00');
  assert.equal(body.fields['Item Lookup Code'], 'B05S-RX');
  assert.ok(body.requestKey.length >= 32);
  assert.deepEqual(body.decided, { shared: false, notSameAs: [] }, 'nothing ticked');
  await see(view, /Everything’s sorted/);
});

test('each kind of row asks for its own details', async () => {
  const view = await open({ rows: [BIKE, BARCODE, NO_NAME], files: [FILE({ rowsLook: 3 })] });
  await toList(view, 'Look at the 3');
  await openFix(view, '[Bike]');
  for (const label of ['Description', 'Frame number', 'Customer name', 'Email', 'Mobile', 'Phone']) assert.ok(view.getByLabelText(label), label);
  click(view, 'Cancel');
  await openFix(view, '[Barcode]');
  for (const label of ['Product code', 'Barcode']) assert.ok(view.getByLabelText(label), label);
  click(view, 'Cancel');
  await openFix(view, 'A11');
  for (const label of ['First name', 'Last name', 'Account number', 'Email', 'Phone']) assert.ok(view.getByLabelText(label), label);
  assert.equal(view.state.calls.length, 0, 'Cancel saves nothing');
});

test('a fix that still doesn\'t fit says why and keeps what was typed', async () => {
  const view = await open({ rows: [PADS], files: [FILE({ rowsLook: 1 })], answer: (path, body, json) => json(422, { error: 'x', why: 'The price isn’t a number Wheelhouse can use', code: 'still_needs_a_look' }) });
  await toList(view, 'Look at the 1');
  await openFix(view, 'Shimano brake pads');
  type(view, 'Price', '£12.50');
  click(view, 'Save');
  const alert = await view.findByRole('alert');
  assert.match(alert.textContent, /The price isn’t a number Wheelhouse can use/);
  assert.equal(view.getByLabelText('Price').value, '£12.50');
});

test('a row sharing a deleted customer\'s details: the tick is there from the start, not ticked, and only sends when ticked', async () => {
  const view = await open({
    rows: [SHARED], files: [FILE({ rowsLook: 1 })],
    answer: (path, body, json) => (body.decided?.shared ? undefined : json(422, { error: 'x', why: SHARED.why, code: 'still_needs_a_look', decide: 'shared' })),
  });
  await toList(view, 'Look at the 1');
  await openFix(view, '[Customer name]');
  const tick = view.getByRole('checkbox', { name: 'I’ve checked: this is someone else, not the customer who was deleted' });
  assert.equal(tick.checked, false);
  click(view, 'Save');
  await view.findByRole('alert');
  assert.equal(view.state.calls[0].body.decided?.shared ?? false, false);
  view.rtl.fireEvent.click(tick);
  click(view, 'Save');
  await see(view, /Everything’s sorted/);
  assert.equal(view.state.calls[1].body.decided.shared, true);
});

test('the tick isn\'t carried over a change of email, phone or account number', async () => {
  const view = await open({ rows: [SHARED], files: [FILE({ rowsLook: 1 })] });
  await toList(view, 'Look at the 1');
  await openFix(view, '[Customer name]');
  const name = 'I’ve checked: this is someone else, not the customer who was deleted';
  for (const label of ['Email', 'Phone', 'Account number']) {
    view.rtl.fireEvent.click(view.getByRole('checkbox', { name }));
    assert.equal(view.getByRole('checkbox', { name }).checked, true);
    type(view, label, 'other');
    assert.equal(view.getByRole('checkbox', { name }).checked, false, label);
  }
});

test('a fix typed to a deleted customer\'s email is asked about, once the server says so', async () => {
  const view = await open({
    rows: [NO_NAME], files: [FILE({ rowsLook: 1 })],
    answer: (path, body, json) => (body.decided?.shared ? undefined : json(422, { error: 'x', why: SHARED.why, code: 'still_needs_a_look', decide: 'shared' })),
  });
  await toList(view, 'Look at the 1');
  await openFix(view, 'A11');
  assert.ok(view.queryByRole('checkbox') === null, 'nothing to tick yet');
  click(view, 'Save');
  const tick = await view.findByRole('checkbox', { name: /not the customer who was deleted/ });
  view.rtl.fireEvent.click(tick);
  click(view, 'Save');
  await see(view, /Everything’s sorted/);
});

test('a row like someone here asks about that person, and sends who it isn\'t', async () => {
  const view = await open({ rows: [SAME], files: [FILE({ rowsLook: 1 })] });
  await toList(view, 'Look at the 1');
  await openFix(view, 'Sam Patel');
  view.rtl.fireEvent.click(view.getByRole('checkbox', { name: 'This is someone else, not Maya Patel' }));
  click(view, 'Save');
  await see(view, /Everything’s sorted/);
  assert.deepEqual(view.state.calls[0].body.decided.notSameAs, [5]);
});

test('a save with no answer goes again with the same key; a refused one takes a new key', async () => {
  let tries = 0;
  const view = await open({
    rows: [PADS], files: [FILE({ rowsLook: 1 })],
    answer: (path, body, json) => {
      tries += 1;
      if (tries <= 2) throw new TypeError('no connection');
      if (tries === 3) return json(422, { error: 'x', why: 'No price', code: 'still_needs_a_look' });
      return undefined;
    },
  });
  await toList(view, 'Look at the 1');
  await openFix(view, 'Shimano brake pads');
  click(view, 'Save');
  await view.rtl.waitFor(() => assert.equal(view.state.calls.length, 2));
  await view.findByRole('alert');
  assert.equal(view.state.calls[0].body.requestKey, view.state.calls[1].body.requestKey);
  click(view, 'Save');
  await view.rtl.waitFor(() => assert.equal(view.state.calls.length, 3));
  assert.equal(view.state.calls[2].body.requestKey, view.state.calls[0].body.requestKey, 'never answered: it may have gone through');
  await see(view, /No price/);
  click(view, 'Save');
  await see(view, /Everything’s sorted/);
  assert.notEqual(view.state.calls[3].body.requestKey, view.state.calls[0].body.requestKey);
});

test('a row that changed while open: the pop-up closes, it says so, and the list is read again', async () => {
  const changed = { ...SAME, why: SHARED.why, seen: 'seen-new', sameAs: undefined };
  const view = await open({
    rows: [SAME], files: [FILE({ rowsLook: 1 })],
    answer: (path, body, json, state) => { state.rows = [changed]; return json(409, { error: 'That row has changed since you opened it. Look at it again.', code: 'row_changed' }); },
  });
  await toList(view, 'Look at the 1');
  await openFix(view, 'Sam Patel');
  click(view, 'Save');
  await see(view, /That row has changed since you opened it\. Look at it again\./);
  await see(view, /Shares contact details with a customer who was deleted/);
  await view.rtl.waitFor(() => assert.ok(view.queryByRole('dialog') === null));
});

test('asked to check in first, the pop-up says so and keeps what was typed', async () => {
  const view = await open({ rows: [PADS], files: [FILE({ rowsLook: 1 })], answer: (path, body, json) => json(409, { error: 'Check in with your PIN first', code: 'check_in_first' }) });
  await toList(view, 'Look at the 1');
  await openFix(view, 'Shimano brake pads');
  type(view, 'Price', '28');
  click(view, 'Save');
  await see(view, /Check in with your PIN first/);
  assert.equal(view.getByLabelText('Price').value, '28');
});

test('Leave it out sends what was seen and a key, the row goes, and it says so; the rest stay', async () => {
  const view = await open();
  await toList(view);
  click(view, 'Leave out A11');
  await view.rtl.waitFor(() => assert.equal(view.state.calls.length, 1));
  assert.equal(view.state.calls[0].path, '/api/move/rows/11/leave-out');
  assert.equal(view.state.calls[0].body.seen, 'seen-11');
  assert.ok(view.state.calls[0].body.requestKey.length >= 32);
  await view.rtl.waitFor(() => assert.ok(view.queryByRole('button', { name: 'Fix A11' }) === null));
  await see(view, /A11 left out/);
  assert.ok(view.getByRole('button', { name: 'Fix Sam Patel' }));
  await view.findByRole('heading', { level: 2, name: '1 need a look' });
});

test('a fix that finds the row already here, or a deleted customer\'s account number, says so', async () => {
  const view = await open({
    rows: [NO_NAME, SAME], files: [FILE({ rowsLook: 2 })],
    answer: (path, body, json, state) => {
      const id = Number(path.split('/')[4]);
      state.rows = state.rows.filter((r) => r.id !== id);
      state.files = [FILE({ rowsLook: state.rows.length, rowsFixed: 2 - state.rows.length })];
      return json(200, { id, state: id === 11 ? 'same' : 'skipped' });
    },
  });
  await toList(view);
  await openFix(view, 'Sam Patel');
  click(view, 'Save');
  await see(view, /Sam Patel is left out, as they asked/);
  await openFix(view, 'A11');
  click(view, 'Save');
  await see(view, /Everything’s sorted/);
});

test('every row sorted: Everything\'s sorted, with the rows left out and no link to a page that isn\'t there (mv-sorted)', async () => {
  const view = await open({ rows: [NO_NAME], files: [FILE({ rowsLook: 1 })] });
  await toList(view, 'Look at the 1');
  click(view, 'Leave out A11');
  await view.findByRole('heading', { level: 2, name: 'Everything’s sorted' });
  assert.ok(document.body.textContent.includes(SORTED_NOTE));
  const row = [...document.querySelectorAll('li')].find((li) => li.textContent.startsWith('Left out'));
  assert.match(row.textContent, /1 row$/);
  assert.ok(view.queryByRole('link', { name: 'See them' }) === null);
  assert.ok(view.queryByRole('button', { name: 'See them' }) === null);
  assert.ok(view.queryByRole('button', { name: /Next: run alongside/ }) === null);
});

test('coming back after everything was sorted shows it again; a new file then shows what came across', async () => {
  const view = await open({ rows: [], files: [FILE({ rowsLook: 0, rowsLeftOut: 2, rowsFixed: 1 })] });
  await view.findByRole('heading', { level: 2, name: 'Everything’s sorted' });
  const row = [...document.querySelectorAll('li')].find((li) => li.textContent.startsWith('Left out'));
  assert.match(row.textContent, /2 rows/);
  view.rtl.fireEvent.change(view.getByLabelText('Choose files'), { target: { files: [new window.File(['x'], 'more.xlsx')] } });
  await view.rtl.waitFor(() => assert.equal(view.state.fileSends.length, 1));
  await view.findByRole('heading', { level: 2, name: 'Here’s what came across' });
  assert.match([...document.querySelectorAll('li')].find((li) => li.textContent.startsWith('Customers')).textContent, /· 2 left out/, 'not All in without saying so');
});

test('some rows sorted and some still waiting: not Everything\'s sorted', async () => {
  const view = await open({ rows: [NO_NAME], files: [FILE({ rowsLook: 1, rowsLeftOut: 1, rowsFixed: 1 })] });
  await view.findByRole('heading', { level: 2, name: 'Here’s what came across' });
  assert.ok(view.getByRole('button', { name: 'Look at the 1' }));
  assert.ok(!document.body.textContent.includes('Everything’s sorted'));
});

test('a row left out counts as dealt with while a file is still coming across', async () => {
  const view = await open({ rows: [], files: [FILE({ state: 'bringing', rowsTotal: 9, rowsIn: 2, rowsLook: 0, rowsLeftOut: 1 })] });
  await see(view, /\[file name\] · 3 of 9/);
});

test('a row like two people asks about each with a tick of their own, and sends both', async () => {
  const view = await open({
    rows: [SAME], files: [FILE({ rowsLook: 1 })],
    answer: (path, body, json) => (body.decided?.notSameAs?.includes(6) ? undefined : json(422, { error: 'x', why: 'Looks like the same person as [customer name]', code: 'still_needs_a_look', decide: 'same_person', sameAs: { id: 6, name: '[customer name]' } })),
  });
  await toList(view, 'Look at the 1');
  await openFix(view, 'Sam Patel');
  const first = view.getByRole('checkbox', { name: 'This is someone else, not Maya Patel' });
  view.rtl.fireEvent.click(first);
  click(view, 'Save');
  const next = await view.findByRole('checkbox', { name: 'This is someone else, not [customer name]' });
  assert.equal(next.checked, false, 'nobody has said it isn\'t them');
  assert.equal(view.getByRole('checkbox', { name: 'This is someone else, not Maya Patel' }).checked, true, 'that one stands');
  assert.deepEqual(view.state.calls[0].body.decided.notSameAs, [5]);
  click(view, 'Save');
  await view.rtl.waitFor(() => assert.equal(view.state.calls.length, 2));
  assert.deepEqual(view.state.calls[1].body.decided.notSameAs, [5]);
  view.rtl.fireEvent.click(next);
  click(view, 'Save');
  await see(view, /Everything’s sorted/);
  assert.deepEqual(view.state.calls[2].body.decided.notSameAs, [5, 6]);
});

test('sorting the last row, then sending another file: what came across, then its rows, then sorted again', async () => {
  const view = await open({ rows: [NO_NAME], files: [FILE({ rowsLook: 1 })] });
  await toList(view, 'Look at the 1');
  click(view, 'Leave out A11');
  await view.findByRole('heading', { level: 2, name: 'Everything’s sorted' });
  view.state.whenSent = (state) => {
    state.rows = [PADS];
    state.files = [FILE({ rowsLook: 0, rowsLeftOut: 1 }), FILE({ id: 2, report: 'price_list', rowsLook: 1 })];
  };
  view.rtl.fireEvent.change(view.getByLabelText('Choose files'), { target: { files: [new window.File(['x'], 'more.xlsx')] } });
  await view.findByRole('heading', { level: 2, name: 'Here’s what came across' });
  assert.ok(view.queryByRole('heading', { level: 2, name: '1 need a look' }) === null, 'not straight to the rows');
  await toList(view, 'Look at the 1');
  await view.findByRole('heading', { level: 2, name: '1 need a look' });
  click(view, 'Leave out Shimano brake pads');
  await view.findByRole('heading', { level: 2, name: 'Everything’s sorted' });
});

test('Stock levels isn\'t All in with stock left out, and says how many', async () => {
  const view = await open({ rows: [], files: [FILE({ report: 'price_list', rowsLook: 0, rowsLeftOut: 2, stockLeftOut: 1, stockIn: 7 }), FILE({ id: 2, report: 'customers', rowsLook: 0 })] });
  await view.findByRole('heading', { level: 2, name: 'Everything’s sorted' });
  view.state.whenSent = () => {};
  view.rtl.fireEvent.change(view.getByLabelText('Choose files'), { target: { files: [new window.File(['x'], 'more.xlsx')] } });
  await view.findByRole('heading', { level: 2, name: 'Here’s what came across' });
  const row = (title) => [...document.querySelectorAll('li')].find((li) => li.textContent.startsWith(title)).textContent;
  assert.match(row('Stock levels'), /7 brought across · 1 left out/);
  assert.ok(!row('Stock levels').includes('All in'));
  assert.ok(!row('Products').includes('All in'), 'nor Products with rows left out');
  assert.ok(row('Customers').includes('All in'), 'nothing of theirs left out');
});

test('the last row left out: its line shows on Everything\'s sorted and takes the focus', async () => {
  const view = await open({ rows: [NO_NAME], files: [FILE({ rowsLook: 1 })] });
  await toList(view, 'Look at the 1');
  click(view, 'Leave out A11');
  await view.findByRole('heading', { level: 2, name: 'Everything’s sorted' });
  const line = await view.findByText('A11 left out');
  assert.equal(line.getAttribute('role'), 'status');
  await view.rtl.waitFor(() => assert.ok(document.activeElement === line));
});

test('Cancel on Fix gives the focus back to its button', async () => {
  const view = await open();
  await toList(view);
  const button = view.getByRole('button', { name: 'Fix A11' });
  button.focus();
  view.rtl.fireEvent.click(button);
  await view.findByRole('dialog', { name: 'Fix A11' });
  click(view, 'Cancel');
  await view.rtl.waitFor(() => assert.ok(document.activeElement === button));
});

test('Look at the [n] and Done for now move the focus to the new board\'s heading', async () => {
  const view = await open();
  await toList(view);
  const rowsHeading = view.getByRole('heading', { level: 2, name: '2 need a look' });
  await view.rtl.waitFor(() => assert.ok(document.activeElement === rowsHeading));
  click(view, 'Done for now');
  const summary = await view.findByRole('heading', { level: 2, name: 'Here’s what came across' });
  await view.rtl.waitFor(() => assert.ok(document.activeElement === summary));
});

test('Leave it out pressed twice goes once', async () => {
  const view = await open();
  await toList(view);
  const button = view.getByRole('button', { name: 'Leave out A11' });
  view.rtl.fireEvent.click(button);
  view.rtl.fireEvent.click(button);
  await see(view, /A11 left out/);
  assert.equal(view.state.calls.length, 1);
  assert.ok(!document.body.textContent.includes('changed since'));
});

test('a row coming back from going round joins the list by itself', async () => {
  const view = await open({ rows: [NO_NAME], files: [FILE({ rowsLook: 2 })] });
  await toList(view, 'Look at the 2');
  assert.ok(view.queryByRole('button', { name: 'Fix [Bike]' }) === null);
  view.state.rows = [NO_NAME, BIKE];
  await view.findByRole('button', { name: 'Fix [Bike]' }, { timeout: 5000 });
});
