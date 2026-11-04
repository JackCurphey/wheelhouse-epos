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
    answer: (path, body, json) => { tries += 1; return tries === 1 ? json(502, { error: 'x', code: 'not_sent' }) : undefined; },
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
