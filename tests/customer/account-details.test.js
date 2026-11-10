// Edit your details on the account (openspec/changes/finish-account design 6;
// "Edit" on ac-account; Jack, 9 Nov, answer 3): Edit opens Name, Mobile and
// Email; a changed name or mobile saves at once and shows; the server's
// refusal is shown in the box and nothing changes.
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
const BAD = 'That doesn’t look like a mobile number — check it';
const server = (puts) => {
  let me = ME;
  return (url, init) => {
    const { pathname } = new URL(url, 'http://localhost');
    if (pathname.endsWith('/me') && init?.method === 'PUT') {
      const body = JSON.parse(init.body);
      puts.push(body);
      if (body.phone === '0770') return { status: 400, body: { error: BAD } };
      me = { ...me, ...body };
      return { status: 200, body: { name: me.name, phone: me.phone } };
    }
    if (pathname.endsWith('/me')) return { status: 200, body: me };
    return { status: 200, body: [] };
  };
};
const rtl = () => import('@testing-library/react');
const open = async () => {
  const puts = [];
  current = await renderBookScreen({ file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES, account: server(puts) });
  const { within } = await rtl();
  const details = within(await current.ui.findByRole('region', { name: 'Your details' }));
  return { ...current, puts, details, within };
};

test('Edit opens Name, Mobile and Email, filled with hers', async () => {
  const { ui, details, within } = await open();
  const { fireEvent } = await rtl();
  fireEvent.click(details.getByRole('button', { name: 'Edit your details' }));
  const box = within(await ui.findByRole('dialog', { name: 'Edit your details' }));
  assert.equal(box.getByLabelText('Name').value, 'Maya Patel');
  assert.equal(box.getByLabelText('Mobile').value, '07700 900142');
  assert.equal(box.getByLabelText('Email').value, 'maya@example.test');
  assert.ok(box.getByRole('button', { name: 'Cancel' }) !== null);
});

test('a changed name and mobile save at once and show on the account', async () => {
  const { ui, details, within, puts } = await open();
  const { fireEvent } = await rtl();
  fireEvent.click(details.getByRole('button', { name: 'Edit your details' }));
  const box = within(await ui.findByRole('dialog', { name: 'Edit your details' }));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Maya Patel-Shah' } });
  fireEvent.change(box.getByLabelText('Mobile'), { target: { value: '07700 900199' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok((await details.findByText('Maya Patel-Shah')) !== null);
  assert.ok(details.queryByText('07700 900199') !== null);
  assert.ok(ui.queryByRole('dialog', { name: 'Edit your details' }) === null);
  assert.deepEqual(puts, [{ name: 'Maya Patel-Shah', phone: '07700 900199' }]);
});

test('a refused mobile says why in the box, and nothing changes', async () => {
  const { ui, details, within } = await open();
  const { fireEvent } = await rtl();
  fireEvent.click(details.getByRole('button', { name: 'Edit your details' }));
  const box = within(await ui.findByRole('dialog', { name: 'Edit your details' }));
  fireEvent.change(box.getByLabelText('Mobile'), { target: { value: '0770' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.equal((await box.findByRole('alert')).textContent, BAD);
  assert.ok(details.queryByText('07700 900142') !== null);
});
