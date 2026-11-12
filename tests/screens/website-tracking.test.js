// Tracking tools, the screen (openspec/changes/website-management, task 4.3;
// the drawings ws-tracking, ws-tracking-on and ws-tracking-error in
// docs/design/user-journeys/generator/website.mjs, lines 399-411).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openWebsite, closeWebsite, calls, ON_CLEAN, HISTORY, tools } from '../helpers/website-screen.js';

afterEach(closeWebsite);
const PAGE = '/workshop/website';
const GA = 'google_analytics';

// The server's answer to each tool change: the saved list with that tool changed.
function served(start) {
  let state = start;
  const toolChange = (key) => (_q, _m, body) => {
    const { on, id } = body;
    const now = Object.fromEntries(state.tracking.map((t) => [t.tool, { id: t.id, on: t.on, wrong: Boolean(t.idProblem) }]));
    const nextId = id ?? now[key].id;
    now[key] = { id: nextId, on, wrong: Boolean(nextId) && !/^G-[A-Za-z0-9]+$/.test(nextId) && key === GA };
    state = { ...state, tracking: tools(now) };
    return [200, state];
  };
  return {
    '/api/website': () => [200, state],
    '/api/website/history': () => [200, HISTORY],
    ...Object.fromEntries(tools().map((t) => [`/api/website/tracking/${t.tool}`, toolChange(t.tool)])),
  };
}
const sent = (key) => calls.filter((c) => c.path === `/api/website/tracking/${key}` && c.method === 'PUT').map((c) => c.body);

async function openTracking(state = ON_CLEAN) {
  const opened = await openWebsite(PAGE, { answers: served(state) });
  opened.fireEvent.click(await opened.ui.findByRole('button', { name: /Tracking tools/ }));
  await opened.ui.findByRole('heading', { name: 'Tracking tools' });
  return opened;
}

test('ws-tracking: the four tools with their kinds, all off, the no-cookie-choice line and the note', async () => {
  const { ui, within } = await openTracking();
  assert.ok(ui.getByText('Tools that show how people use your website, or help with adverts. Like everything else, they go live when you publish.'));
  assert.ok(ui.getByText('With no tools on, your website only uses the cookies it needs to work — so customers get no cookie choice.'));
  const list = ui.getByRole('list', { name: 'Tracking tools' });
  const rows = within(list).getAllByRole('listitem');
  assert.deepEqual(rows.map((r) => [r.querySelector('.font-bold').textContent, within(r).getByText(/^(Statistics|Marketing)$/).textContent]), [
    ['Google Analytics', 'Statistics'], ['Microsoft Clarity', 'Statistics'], ['Meta (Facebook) Pixel', 'Marketing'], ['TikTok Pixel', 'Marketing'],
  ]);
  for (const name of ['Google Analytics', 'Microsoft Clarity', 'Meta (Facebook) Pixel', 'TikTok Pixel']) {
    assert.equal(ui.getByRole('switch', { name }).getAttribute('aria-checked'), 'false');
  }
  assert.ok(ui.queryByLabelText('Your Google Analytics ID') === null);
  assert.ok(ui.getByText('Each tool is marked Statistics or Marketing, so the cookie choice asks customers the right question. No tool loads until a customer agrees. Switching a tool off keeps its ID.'));
});

test('ws-tracking-on: switching Google Analytics on saves it, shows its ID box, the cookie lines and the toast; Undo switches it off', async () => {
  const { ui, fireEvent, waitFor } = await openTracking();
  fireEvent.click(ui.getByRole('switch', { name: 'Google Analytics' }));
  await waitFor(() => assert.deepEqual(sent(GA), [{ on: true }]));
  const toast = await ui.findByText('Google Analytics on · goes live when you publish');
  assert.ok(toast.closest('[role="status"]'));
  const box = ui.getByLabelText('Your Google Analytics ID');
  assert.equal(box.getAttribute('placeholder'), '[ID from the tool]');
  assert.equal(document.getElementById(box.getAttribute('aria-describedby')).textContent, 'From your Google Analytics account. It starts with G-');
  fireEvent.change(box, { target: { value: 'G-PSW1MY7HB4' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(sent(GA).at(-1), { on: true, id: 'G-PSW1MY7HB4' }));
  assert.ok(await ui.findByText('When you publish, your website will ask customers about cookies.'));
  assert.ok(ui.getByText(/Google Analytics only loads for customers who say yes to “Statistics”\. Every page’s footer gains “Cookie choices”\./));
  assert.ok(ui.getByText(/they should name Google Analytics\./));
  assert.ok(ui.getByText('Cookies', { selector: 'strong' }));
  assert.ok(ui.getByRole('button', { name: 'Privacy' }));
  fireEvent.click(ui.getByRole('button', { name: 'Undo' }));
  await waitFor(() => assert.deepEqual(sent(GA).at(-1), { on: false }));
  await waitFor(() => assert.equal(ui.getByRole('switch', { name: 'Google Analytics' }).getAttribute('aria-checked'), 'false'));
});

test('ws-tracking-error: a wrong ID shows the problem in place of the hint, and the tool waits', async () => {
  const state = { ...ON_CLEAN, tracking: tools({ [GA]: { id: 'UA-[number]', on: true, wrong: true } }) };
  const { ui } = await openTracking(state);
  assert.ok(ui.getByText('Google Analytics needs a correct ID before it can be used.'));
  const box = ui.getByLabelText('Your Google Analytics ID');
  assert.equal(box.value, 'UA-[number]');
  assert.equal(box.getAttribute('aria-invalid'), 'true');
  assert.equal(document.getElementById(box.getAttribute('aria-describedby')).textContent, 'That doesn’t look like a Google Analytics ID. It starts with G- and is in your Google Analytics settings.');
  assert.ok(ui.queryByText('From your Google Analytics account. It starts with G-') === null);
  assert.ok(ui.getByText('Waiting for a correct ID — until then, no cookie choice and nothing loads.'));
  assert.ok(ui.queryByText(/ask customers about cookies/) === null);
});

test('switching a tool off keeps its ID, with no toast; Back to Website returns to the page', async () => {
  const state = { ...ON_CLEAN, tracking: tools({ meta_pixel: { id: '123456789012345', on: true } }) };
  const { ui, fireEvent, waitFor } = await openTracking(state);
  fireEvent.click(ui.getByRole('switch', { name: 'Meta (Facebook) Pixel' }));
  await waitFor(() => assert.deepEqual(sent('meta_pixel'), [{ on: false }]));
  await waitFor(() => assert.ok(ui.queryByLabelText('Your Meta (Facebook) Pixel ID') === null));
  assert.ok(ui.queryByText(/goes live when you publish/) === null);
  fireEvent.click(ui.getByRole('button', { name: 'Website' }));
  assert.ok(await ui.findByRole('heading', { name: 'Your website is on' }));
  assert.ok(ui.getByText('None — so there’s no cookie choice'));
});

test('leaving the ID box by pressing the switch saves the ID first, then the switch', async () => {
  const state = { ...ON_CLEAN, tracking: tools({ [GA]: { id: '', on: true } }) };
  const { ui, fireEvent, waitFor } = await openTracking(state);
  const box = ui.getByLabelText('Your Google Analytics ID');
  fireEvent.change(box, { target: { value: 'G-PSW1MY7HB4' } });
  fireEvent.blur(box);
  fireEvent.click(ui.getByRole('switch', { name: 'Google Analytics' }));
  await waitFor(() => assert.deepEqual(sent(GA), [{ on: true, id: 'G-PSW1MY7HB4' }, { on: false }]));
  await waitFor(() => assert.equal(ui.getByRole('switch', { name: 'Google Analytics' }).getAttribute('aria-checked'), 'false'));
});

test('Enter then leaving the box saves the ID once', async () => {
  const state = { ...ON_CLEAN, tracking: tools({ [GA]: { id: '', on: true } }) };
  const { ui, fireEvent, waitFor } = await openTracking(state);
  const box = ui.getByLabelText('Your Google Analytics ID');
  fireEvent.change(box, { target: { value: 'G-PSW1MY7HB4' } });
  fireEvent.keyDown(box, { key: 'Enter' });
  fireEvent.blur(box);
  await waitFor(() => assert.equal(ui.getByLabelText('Your Google Analytics ID').value, 'G-PSW1MY7HB4'));
  await waitFor(() => assert.ok(ui.getByText('When you publish, your website will ask customers about cookies.')));
  assert.deepEqual(sent(GA), [{ on: true, id: 'G-PSW1MY7HB4' }]);
});

test('an ID that couldn’t be saved stays in the box, with the problem said', async () => {
  const state = { ...ON_CLEAN, tracking: tools({ [GA]: { id: '', on: true } }) };
  const opened = await openWebsite(PAGE, { answers: { ...served(state), [`/api/website/tracking/${GA}`]: () => [500, { error: 'Internal server error' }] } });
  const { ui, fireEvent, waitFor } = opened;
  fireEvent.click(await ui.findByRole('button', { name: /Tracking tools/ }));
  const box = await ui.findByLabelText('Your Google Analytics ID');
  fireEvent.change(box, { target: { value: 'G-PSW1MY7HB4' } });
  fireEvent.blur(box);
  await ui.findByRole('alert');
  await waitFor(() => assert.equal(sent(GA).length, 1));
  assert.equal(ui.getByLabelText('Your Google Analytics ID').value, 'G-PSW1MY7HB4');
});

test('one tool live and another waiting for a correct ID: the warning, then the cookie lines for the live one', async () => {
  const state = { ...ON_CLEAN, tracking: tools({ [GA]: { id: 'G-PSW1MY7HB4', on: true }, meta_pixel: { id: 'pixel!', on: true, wrong: true } }) };
  const { ui } = await openTracking(state);
  assert.ok(ui.getByText('Meta (Facebook) Pixel needs a correct ID before it can be used.'));
  assert.ok(ui.getByText('When you publish, your website will ask customers about cookies.'));
  assert.ok(ui.getByText(/they should name Google Analytics\./));
  assert.ok(ui.queryByText(/no cookie choice\.$/) === null);
});

test('a tool on with no ID yet loads nothing, so the no-cookie-choice line stays', async () => {
  const state = { ...ON_CLEAN, tracking: tools({ [GA]: { id: '', on: true } }) };
  const { ui } = await openTracking(state);
  assert.ok(ui.getByText('With no tools on, your website only uses the cookies it needs to work — so customers get no cookie choice.'));
  assert.ok(ui.queryByText(/needs a correct ID/) === null);
});
