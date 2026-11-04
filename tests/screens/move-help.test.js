// Ask us to help (openspec/changes/citrus-import-fix; mv-help, mv-help-sent in moving.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FILE, click, findAndClick, open, see, toList, type } from '../helpers/move-screen.js';

for (const [board, files, rows, card] of [
  ['mv-start', [], [], 'Bring your data from Citrus Lime'],
  ['mv-progress', [FILE({ state: 'bringing' })], [], 'Bringing your data across'],
  ['mv-summary', [FILE({ rowsLook: 0 })], [], 'Here’s what came across'],
  ['mv-sorted', [FILE({ rowsLook: 0, rowsFixed: 1 })], [], 'Everything’s sorted'],
]) {
  test(`Ask us to help is on ${board}, and names its card`, async () => {
    const view = await open({ files, rows });
    await findAndClick(view, 'Ask us to help');
    await view.findByRole('dialog', { name: 'Ask us to help' });
    assert.match(document.body.textContent, /With moving from Citrus Lime · to the Wheelhouse team/);
    assert.ok(document.body.textContent.includes(`We’ll see you asked from ${card}, and that you’re Jack Lewis at North Street Cycles.`), document.body.textContent);
  });
}

test('Ask us to help on the rows names that card too', async () => {
  const view = await open();
  await toList(view);
  await findAndClick(view, 'Ask us to help');
  await see(view, /We’ll see you asked from 2 need a look, and that you’re Jack Lewis at North Street Cycles\./);
});

test('Send waits for something written, sends it with its card, and thanks them; the thanks stays until closed (mv-help-sent)', async () => {
  const view = await open({ files: [FILE({ rowsLook: 0 })], rows: [] });
  await findAndClick(view, 'Ask us to help');
  const send = await view.findByRole('button', { name: 'Send' });
  assert.equal(send.getAttribute('aria-disabled'), 'true');
  view.rtl.fireEvent.click(send);
  assert.equal(view.state.calls.length, 0, 'nothing written');
  type(view, 'What looks wrong?', '[What Jack wrote]');
  assert.equal(send.getAttribute('aria-disabled'), null);
  view.rtl.fireEvent.click(send);
  await see(view, /Thanks — we’ve got it\. Any reply comes to your email\./);
  const [{ path, body }] = view.state.calls;
  assert.equal(path, '/api/move/help');
  assert.equal(body.text, '[What Jack wrote]');
  assert.equal(body.card, 'Here’s what came across');
  assert.ok(body.requestKey.length >= 32);
  assert.deepEqual(Object.keys(body).sort(), ['card', 'requestKey', 'text'], 'nothing from the rows');
  assert.ok(view.queryByRole('dialog') === null);
  await new Promise((r) => { setTimeout(r, 50); });
  click(view, 'Close the message');
  assert.ok(!document.body.textContent.includes('Thanks — we’ve got it'));
});

test('Cancel sends nothing', async () => {
  const view = await open({ files: [FILE({ rowsLook: 0 })], rows: [] });
  await findAndClick(view, 'Ask us to help');
  await view.findByLabelText('What looks wrong?');
  click(view, 'Cancel');
  await view.rtl.waitFor(() => assert.ok(view.queryByRole('dialog') === null));
  assert.equal(view.state.calls.length, 0);
});

test('a send that fails keeps what was written, says so, and tries again with the same key', async () => {
  let tries = 0;
  const view = await open({
    files: [FILE({ rowsLook: 0 })], rows: [],
    answer: (path, body, json) => { tries += 1; return tries === 1 ? json(502, { error: 'Couldn’t send. What you wrote is kept here. Try again.', code: 'not_sent' }) : undefined; },
  });
  await findAndClick(view, 'Ask us to help');
  await view.findByLabelText('What looks wrong?');
  type(view, 'What looks wrong?', '[What Jack wrote]');
  click(view, 'Send');
  await see(view, /Couldn’t send\. What you wrote is kept here\. Try again\./);
  assert.equal(view.getByLabelText('What looks wrong?').value, '[What Jack wrote]');
  click(view, 'Try again');
  await see(view, /Thanks — we’ve got it/);
  assert.equal(view.state.calls[0].body.requestKey, view.state.calls[1].body.requestKey);
});

test('the form asks people not to include customers\' details', async () => {
  const view = await open({ files: [FILE({ rowsLook: 0 })], rows: [] });
  await findAndClick(view, 'Ask us to help');
  await see(view, /Please don’t include customers’ details\./);
});

for (const [why, helpOffered] of [['the server says there\'s no inbox', false], ['the server doesn\'t say', null]]) {
  test(`when ${why}, Ask us to help isn't on the page`, async () => {
    const view = await open({ files: [FILE({ rowsLook: 2 })], helpOffered });
    await see(view, /Here’s what came across/);
    assert.ok(view.queryByRole('button', { name: 'Ask us to help' }) === null);
    await toList(view);
    assert.ok(view.queryByRole('button', { name: 'Ask us to help' }) === null, 'nor on the rows');
  });
}

test('changing the message after a failed send sends it as new, and the button is Send again', async () => {
  let tries = 0;
  const view = await open({
    files: [FILE({ rowsLook: 0 })], rows: [],
    answer: (path, body, json) => {
      tries += 1;
      if (tries === 1) return json(502, { error: 'Couldn’t send. What you wrote is kept here. Try again.', code: 'not_sent' });
      return undefined;
    },
  });
  await findAndClick(view, 'Ask us to help');
  await view.findByLabelText('What looks wrong?');
  type(view, 'What looks wrong?', '[What Jack wrote]');
  click(view, 'Send');
  await view.findByRole('button', { name: 'Try again' });
  type(view, 'What looks wrong?', '[What Jack wrote, changed]');
  assert.ok(view.getByRole('button', { name: 'Send' }));
  assert.ok(view.queryByRole('alert') === null);
  click(view, 'Send');
  await see(view, /Thanks — we’ve got it/);
  assert.notEqual(view.state.calls[0].body.requestKey, view.state.calls[1].body.requestKey);
  assert.equal(view.state.calls[1].body.text, '[What Jack wrote, changed]');
});

test('told to check in first, it says that, and keeps what was written', async () => {
  const view = await open({ files: [FILE({ rowsLook: 0 })], rows: [], answer: (path, body, json) => json(409, { error: 'Check in with your PIN first', code: 'check_in_first' }) });
  await findAndClick(view, 'Ask us to help');
  await view.findByLabelText('What looks wrong?');
  type(view, 'What looks wrong?', '[What Jack wrote]');
  click(view, 'Send');
  const alert = await view.findByRole('alert');
  assert.equal(alert.textContent, 'Check in with your PIN first');
  assert.equal(view.getByLabelText('What looks wrong?').value, '[What Jack wrote]');
});

test('a send with no answer says it couldn\'t send, and keeps the key for trying again', async () => {
  let tries = 0;
  const view = await open({
    files: [FILE({ rowsLook: 0 })], rows: [],
    answer: () => { tries += 1; if (tries === 1) throw new TypeError('no connection'); return undefined; },
  });
  await findAndClick(view, 'Ask us to help');
  await view.findByLabelText('What looks wrong?');
  type(view, 'What looks wrong?', '[What Jack wrote]');
  click(view, 'Send');
  const alert = await view.findByRole('alert');
  assert.match(alert.textContent, /Couldn’t send\. What you wrote is kept here\. Try again\./);
  click(view, 'Try again');
  await see(view, /Thanks — we’ve got it/);
  assert.equal(new Set(view.state.calls.map((c) => c.body.requestKey)).size, 1);
});
