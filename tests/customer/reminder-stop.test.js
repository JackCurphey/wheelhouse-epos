// "Stop these" for service reminders, the customer's page (openspec/changes/stop-reminders;
// drawn as ac-stopped and ac-stopped-on; Jack's answer 5 of 25 Oct): opening
// the link asks first, and nothing stops until the button is pressed; then the
// drawn "stopped" page with Turn them back on, and "on again". A code that
// doesn't work says so and nothing more.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';
import { STOP_ROUTE } from '../../src/customer/routes.ts';
import { stopPath } from '../../server/messaging/stop-codes.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const CODE = 'd'.repeat(64);
const GONE = { status: 404, body: { error: 'This link doesn’t work' } };
const open = async (stopCode) => {
  current = await renderBookScreen({
    file: 'screens/book/reminder-stop.js', exportName: 'ReminderStopScreen', at: 'stop/:code',
    url: `/book/north/stop/${CODE}`, services: SERVICES, stopCode,
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const posts = (requests) => requests.filter((r) => r.method === 'POST').map((r) => JSON.stringify(r.body));
// The pretend server: reminders on until a press says otherwise.
const server = () => {
  let on = true;
  return (url, init) => {
    if (init?.method === 'POST') on = !JSON.parse(init.body).stop;
    return { status: 200, body: { shopName: 'North Street Cycles', on } };
  };
};

test('the page lives where the server’s link sends the customer', () => {
  assert.equal(STOP_ROUTE, stopPath(':shopSlug', ':code'));
});

test('opening the link asks first: nothing is stopped until the button is pressed', async () => {
  const { ui, requests } = await open(server());
  assert.ok((await ui.findByRole('heading', { name: 'Stop service reminders?' })) !== null);
  assert.ok(ui.queryByText('We’ll stop sending you service reminders from North Street Cycles. Job updates about a bike that’s with us still come as usual.') !== null);
  assert.deepEqual(posts(requests), []);
});

test('pressing it stops them: the drawn page, with Turn them back on; that turns them on again', async () => {
  const { ui, requests } = await open(server());
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Stop service reminders' }));
  assert.ok((await ui.findByRole('heading', { name: 'Service reminders stopped' })) !== null);
  assert.ok(ui.queryByText('We won’t send you service reminders any more. Job updates about a bike that’s with us still come as usual.') !== null);
  assert.deepEqual(posts(requests), ['{"stop":true}']);
  fireEvent.click(ui.getByRole('button', { name: 'Turn them back on' }));
  assert.ok((await ui.findByRole('heading', { name: 'Service reminders are on again' })) !== null);
  assert.ok(ui.queryByText('We’ll remind you when your bike is due its next service. Stop them any time with the link at the end of each one.') !== null);
  assert.deepEqual(posts(requests), ['{"stop":true}', '{"stop":false}']);
});

test('already stopped: it says so, with Turn them back on, without asking again', async () => {
  const { ui } = await open(() => ({ status: 200, body: { shopName: 'North Street Cycles', on: false } }));
  assert.ok((await ui.findByRole('heading', { name: 'Service reminders stopped' })) !== null);
  assert.ok(ui.queryByRole('button', { name: 'Turn them back on' }) !== null);
});

test('a code that doesn’t work says so, and nothing else', async () => {
  const { ui } = await open(() => GONE);
  assert.ok((await ui.findByRole('heading', { name: 'This link doesn’t work' })) !== null);
  assert.ok(ui.queryByRole('button') === null || ui.queryByRole('button', { name: /Stop|Turn/ }) === null);
});

// Review requests (review-requests design 6; audit M5): the same page with
// review requests' own name.
test('a review request’s link: the same page, with review requests’ own name', async () => {
  let on = true;
  const { ui, requests } = await open((url, init) => {
    if (init?.method === 'POST') on = !JSON.parse(init.body).stop;
    return { status: 200, body: { shopName: 'North Street Cycles', kind: 'review_requests', on } };
  });
  assert.ok((await ui.findByRole('heading', { name: 'Stop review requests?' })) !== null);
  assert.ok(ui.queryByText('We’ll stop asking you for reviews from North Street Cycles. Job updates about a bike that’s with us still come as usual.') !== null);
  const { fireEvent } = await rtl();
  fireEvent.click(ui.getByRole('button', { name: 'Stop review requests' }));
  assert.ok((await ui.findByRole('heading', { name: 'Review requests stopped' })) !== null);
  assert.ok(ui.queryByText('We won’t ask you for reviews any more. Job updates about a bike that’s with us still come as usual.') !== null);
  fireEvent.click(ui.getByRole('button', { name: 'Turn them back on' }));
  assert.ok((await ui.findByRole('heading', { name: 'Review requests are on again' })) !== null);
  assert.ok(ui.queryByText('We’ll ask for a review after you collect your bike. Stop them any time with the link at the end of each one.') !== null);
  assert.deepEqual(posts(requests), ['{"stop":true}', '{"stop":false}']);
});

// A shop's own message (openspec/changes/own-messages-server design 7; Jack's
// answer 2 of 26 Oct): the same page, stopping just that message, by its name.
test('a shop’s own message’s link: the same page, stopping just that one, by its name', async () => {
  let on = true;
  const { ui, requests } = await open((url, init) => {
    if (init?.method === 'POST') on = !JSON.parse(init.body).stop;
    return { status: 200, body: { shopName: 'North Street Cycles', kind: 'own_message', name: 'Spring check', on } };
  });
  assert.ok((await ui.findByRole('heading', { name: 'Stop “Spring check”?' })) !== null);
  assert.ok(ui.queryByText('We’ll stop sending you “Spring check” from North Street Cycles. Job updates about a bike that’s with us still come as usual.') !== null);
  const { fireEvent } = await rtl();
  fireEvent.click(ui.getByRole('button', { name: 'Stop “Spring check”' }));
  assert.ok((await ui.findByRole('heading', { name: '“Spring check” stopped' })) !== null);
  fireEvent.click(ui.getByRole('button', { name: 'Turn it back on' }));
  assert.ok((await ui.findByRole('heading', { name: '“Spring check” is on again' })) !== null);
  assert.deepEqual(posts(requests), ['{"stop":true}', '{"stop":false}']);
});
