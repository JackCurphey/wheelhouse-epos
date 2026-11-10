// Changing the email from Edit your details (openspec/changes/finish-account
// design 6; Jack, 9 Nov, answer 3): Save with a new email sends a code to it
// and asks for the code, as the sign-in does; Confirm changes it and says so;
// a refused code says why; nothing about the email changes before.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const ME = { id: 5, email: 'maya@example.test', name: 'Maya Patel', phone: '07700 900142', shopName: 'North Street Cycles', shopSlug: 'north', updateChannel: 'sms', serviceReminders: true, reviewRequests: true, marketingPermission: false };
const NEXT = 'm.patel@example.test';
const WRONG = 'That code isn’t right. Check it, or send a new one';
const TAKEN = 'That email is already used for another account at North Street Cycles. Ask North Street Cycles to help.';
const server = (posts) => {
  let me = ME;
  return (url, init) => {
    const { pathname } = new URL(url, 'http://localhost');
    if (init?.method === 'POST' && pathname.endsWith('/me/email')) {
      const body = JSON.parse(init.body);
      posts.push(['ask', body]);
      if (body.email === 'taken@example.test') return { status: 400, body: { error: TAKEN } };
      return { status: 200, body: { pendingEmail: body.email } };
    }
    if (init?.method === 'POST' && pathname.endsWith('/me/email/confirm')) {
      const body = JSON.parse(init.body);
      posts.push(['confirm', body]);
      if (body.code !== '246810') return { status: 400, body: { error: WRONG, reason: 'wrong' } };
      me = { ...me, email: NEXT };
      return { status: 200, body: { email: NEXT, said: `Your email is now ${NEXT}. Use it to sign in from now on.` } };
    }
    if (pathname.endsWith('/me')) return { status: 200, body: me };
    return { status: 200, body: [] };
  };
};
const rtl = () => import('@testing-library/react');
async function openEdit() {
  const posts = [];
  current = await renderBookScreen({ file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES, account: server(posts) });
  const { within, fireEvent } = await rtl();
  const details = within(await current.ui.findByRole('region', { name: 'Your details' }));
  fireEvent.click(details.getByRole('button', { name: 'Edit your details' }));
  const box = within(await current.ui.findByRole('dialog', { name: 'Edit your details' }));
  return { ...current, posts, details, box, fireEvent };
}

test('a new email sends a code to it and asks for the code; the account still shows the old one', async () => {
  const { box, details, posts, fireEvent } = await openEdit();
  fireEvent.change(box.getByLabelText('Email'), { target: { value: NEXT } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok((await box.findByText((_, el) => el?.tagName === 'P' && el.textContent === `We sent a code to ${NEXT}. It works for 10 minutes.`)) !== null);
  assert.ok(box.getByLabelText('Your 6-digit code') !== null);
  assert.ok(box.getByRole('button', { name: 'Send a new code' }) !== null);
  assert.deepEqual(posts, [['ask', { email: NEXT }]]);
  assert.ok(details.queryByText('maya@example.test') !== null);
});

test('the right code changes it and says so; the account shows the new email', async () => {
  const { box, details, posts, fireEvent } = await openEdit();
  fireEvent.change(box.getByLabelText('Email'), { target: { value: NEXT } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  fireEvent.change(await box.findByLabelText('Your 6-digit code'), { target: { value: '246 810' } });
  fireEvent.click(box.getByRole('button', { name: 'Confirm' }));
  assert.equal((await box.findByRole('status')).textContent, `Your email is now ${NEXT}. Use it to sign in from now on.`);
  assert.ok((await details.findByText(NEXT)) !== null);
  assert.deepEqual(posts.at(-1), ['confirm', { code: '246810' }]);
});

test('a wrong code says so with the sign-in’s words, and Send a new code sends another', async () => {
  const { box, posts, fireEvent } = await openEdit();
  fireEvent.change(box.getByLabelText('Email'), { target: { value: NEXT } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  fireEvent.change(await box.findByLabelText('Your 6-digit code'), { target: { value: '111111' } });
  fireEvent.click(box.getByRole('button', { name: 'Confirm' }));
  assert.equal((await box.findByRole('alert')).textContent, WRONG);
  fireEvent.click(box.getByRole('button', { name: 'Send a new code' }));
  assert.equal((await box.findByRole('status')).textContent, `We sent a new code to ${NEXT}`);
  assert.deepEqual(posts.filter(([k]) => k === 'ask').length, 2);
});

test('an email another account uses is refused in the box before any code', async () => {
  const { box, fireEvent } = await openEdit();
  fireEvent.change(box.getByLabelText('Email'), { target: { value: 'taken@example.test' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.equal((await box.findByRole('alert')).textContent, TAKEN);
  assert.ok(box.queryByLabelText('Your 6-digit code') === null);
});
