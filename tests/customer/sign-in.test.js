// The sign-in screens (openspec/changes/customer-signin-screens; drawn as
// cust-signin, cust-code and cust-code-expired, signin.mjs:256-285; signing-in
// decisions 5 and 9): an email, then a code that checks itself on the sixth
// digit, and back to the page the link came from, only ever this shop's own.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';
import { SIGNIN_ROUTE } from '../../src/customer/routes.ts';

let current;
afterEach(async () => {
  // Only after a render: React loaded with no page set up listens for typing the old way.
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const BOOKING = `/book/north/booking/${'a'.repeat(64)}`;
const SIGNED_IN = { status: 200, body: { id: 1, email: 'maya@example.test', name: '', shopName: 'North Street Cycles', shopSlug: 'north' } };
// The pretend server: any ask is sent; 481296 is right, 000000 wrong, 111111 expired.
const server = (refuseAsk) => (url, init) => {
  const body = JSON.parse(init.body);
  if (url.endsWith('/sign-in/code')) return refuseAsk ?? { status: 200, body: { ok: true } };
  if (body.code === '481296') return SIGNED_IN;
  if (body.code === '111111') return { status: 401, body: { error: 'That code has expired — send a new one', reason: 'expired' } };
  return { status: 401, body: { error: 'That code isn’t right. Check it, or send a new one', reason: 'wrong' } };
};
const open = async ({ from, signIn = server() } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/sign-in.js', exportName: 'SignInScreen', at: 'sign-in',
    url: `/book/north/sign-in${from === undefined ? '' : `?from=${encodeURIComponent(from)}`}`, services: SERVICES, signIn,
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const posts = (requests) => requests.filter((r) => r.method === 'POST').map((r) => [new URL(r.url, 'http://localhost').pathname, r.body]);
async function toCode(ui) {
  const { fireEvent } = await rtl();
  fireEvent.change(await ui.findByLabelText('Email'), { target: { value: 'maya@example.test' } });
  fireEvent.click(ui.getByRole('button', { name: 'Email me a code' }));
  return ui.findByRole('textbox', { name: 'Your 6-digit code' });
}

test('the page lives under the shop’s booking pages', () => {
  assert.equal(SIGNIN_ROUTE, '/book/:shopSlug/sign-in');
});

test('the email step is as drawn, and Email me a code asks for one', async () => {
  const { ui, requests } = await open();
  assert.ok((await ui.findByRole('heading', { level: 1, name: 'Sign in to your account' })) !== null);
  assert.ok(ui.queryByText('See your bookings, your bikes and past work. We’ll email you a code — no password needed.') !== null);
  const email = ui.getByLabelText('Email');
  assert.equal(email.getAttribute('type'), 'email');
  assert.equal(email.getAttribute('autocomplete'), 'email');
  assert.ok(ui.queryByText('Just checking a booking? Open the link in your text or email — no sign-in needed.') !== null);
  await toCode(ui);
  assert.deepEqual(posts(requests), [['/api/portal/north/sign-in/code', { email: 'maya@example.test' }]]);
});

test('a refused ask shows the server’s words and stays on the email step', async () => {
  const { ui } = await open({ signIn: server({ status: 503, body: { error: 'Signing in by email isn’t switched on yet' } }) });
  const { fireEvent } = await rtl();
  fireEvent.change(await ui.findByLabelText('Email'), { target: { value: 'maya@example.test' } });
  fireEvent.click(ui.getByRole('button', { name: 'Email me a code' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'Signing in by email isn’t switched on yet');
  assert.ok(ui.queryByRole('textbox', { name: 'Your 6-digit code' }) === null);
});

test('the code step is as drawn: one box for six digits, made for codes from email', async () => {
  const { ui } = await open();
  const box = await toCode(ui);
  assert.ok(ui.queryByRole('heading', { level: 1, name: 'Enter your code' }) !== null);
  assert.ok(ui.queryByText((_, el) => el?.tagName === 'P' && el.textContent === 'We sent a 6-digit code to maya@example.test. It works for 10 minutes and signs you in as soon as the last digit goes in.') !== null);
  assert.equal(box.getAttribute('autocomplete'), 'one-time-code');
  assert.equal(box.getAttribute('inputmode'), 'numeric');
  assert.equal(box.getAttribute('maxlength'), '6');
  assert.ok(ui.getByRole('button', { name: 'Send a new code' }) !== null);
  assert.ok(ui.getByRole('button', { name: 'Use a different email' }) !== null);
});

test('the sixth digit checks it, a pasted code with a space included; then the booking it came from opens', async () => {
  const { ui, requests } = await open({ from: BOOKING });
  const { fireEvent } = await rtl();
  const box = await toCode(ui);
  fireEvent.change(box, { target: { value: '48129' } });
  assert.equal(posts(requests).length, 1, 'five digits don’t check');
  fireEvent.change(box, { target: { value: '481 296' } });
  assert.ok((await ui.findByText(`At ${BOOKING}`)) !== null);
  assert.deepEqual(posts(requests)[1], ['/api/portal/north/sign-in/check', { email: 'maya@example.test', code: '481296' }]);
});

test('a wrong code says so under the boxes; an expired one too, with Send a new code standing out', async () => {
  const { ui } = await open();
  const { fireEvent } = await rtl();
  const box = await toCode(ui);
  fireEvent.change(box, { target: { value: '000000' } });
  assert.equal((await ui.findByRole('alert')).textContent, 'That code isn’t right. Check it, or send a new one');
  assert.equal(box.getAttribute('aria-invalid'), 'true');
  assert.equal(document.getElementById(box.getAttribute('aria-describedby'))?.textContent, 'That code isn’t right. Check it, or send a new one');
  assert.equal(ui.getByRole('button', { name: 'Send a new code' }).className.includes('font-bold'), false, 'only an expired code makes it stand out');
  fireEvent.change(box, { target: { value: '111111' } });
  await ui.findByText('That code has expired — send a new one');
  assert.equal(ui.getByRole('button', { name: 'Send a new code' }).className.includes('font-bold'), true);
});

test('Send a new code asks again and empties the boxes; Use a different email goes back with the email kept', async () => {
  const { ui, requests } = await open();
  const { fireEvent } = await rtl();
  const box = await toCode(ui);
  fireEvent.change(box, { target: { value: '000000' } });
  await ui.findByRole('alert');
  fireEvent.click(ui.getByRole('button', { name: 'Send a new code' }));
  assert.ok((await ui.findByText('We sent a new code to maya@example.test')) !== null);
  assert.equal(box.value, '');
  assert.equal(box.getAttribute('aria-invalid'), null);
  assert.equal(posts(requests).filter(([path]) => path.endsWith('/sign-in/code')).length, 2);
  fireEvent.click(ui.getByRole('button', { name: 'Use a different email' }));
  assert.equal((await ui.findByLabelText('Email')).value, 'maya@example.test');
});

for (const [why, from] of [['another site', 'https://example.com/book/north'], ['another shop', '/book/elsewhere/booking/x'], ['a look-alike shop', '/book/northern'], ['nothing given', undefined]]) {
  test(`after the code, ${why} goes to the shop’s own booking page instead`, async () => {
    const { ui } = await open({ from });
    const { fireEvent } = await rtl();
    fireEvent.change(await toCode(ui), { target: { value: '481296' } });
    assert.ok((await ui.findByText('At /book/north')) !== null);
  });
}
