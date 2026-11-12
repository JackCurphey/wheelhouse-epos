// A delivery, once it's booked in (openspec/changes/delivery-booked-in; rs-booked,
// rs-booked-staff, rs-delivery, rs-delivery-staff and hubBoard's Recent
// deliveries in receiving.mjs; receiving decisions 4, 9 and 10). Example data
// from the drawing: Shimano brake pads B05S-RX; everything else stays a
// bracketed placeholder.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };

const AT = '2026-09-01T10:00:00.000Z';
const FOR_STAFF = {
  id: 77, supplierId: 1, supplierName: '[Supplier]', items: 3, bookedInAt: AT, bookedBy: 'Jack Lewis',
  lines: [
    { id: 1, productId: 11, name: 'Shimano brake pads', sku: 'B05S-RX', qty: 2 },
    { id: 2, productId: 12, name: '[Product]', sku: null, qty: 1 },
  ],
  setAside: [{ id: 5, name: '[Product]', kind: 'damaged', qty: 1, returned: false }],
  stillToCome: [{ orderId: 7, supplierName: '[Supplier]', orderedAt: AT, qty: 4 }],
};
const FOR_OWNER = {
  ...FOR_STAFF,
  bookedCost: 57.1,
  lines: [{ ...FOR_STAFF.lines[0], unitCost: 28, lineCost: 56 }, { ...FOR_STAFF.lines[1], unitCost: 1.1, lineCost: 1.1 }],
  setAside: [{ ...FOR_STAFF.setAside[0], cost: 1.1 }],
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let rendered = false;
afterEach(async () => {
  if (!rendered) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  rendered = false;
});

// Each test's first wait follows opening the page, which loads the signed-in check, the page and
// its delivery first. Testing Library's default 1 s ran out on a busy machine (test-files-exit runs
// this file with four others at once; 2 in 160 here under load). A passing run still goes on the
// moment it shows.
const OPENED = { timeout: 5000 };

async function open(path, { me = OWNER, delivery, deliveries = [], status = 200 } = {}) {
  globalThis.fetch = async (url) => {
    const reply = (s, b) => ({ status: s, ok: s < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (/^\/api\/deliveries\/booked-in\/\d+$/.test(u.pathname)) return status === 200 ? reply(200, delivery) : reply(status, { error: 'Delivery not found' });
    if (u.pathname === '/api/deliveries') return status === 200 ? reply(200, { deliveries }) : reply(status, { error: 'No' });
    if (u.pathname === '/api/deliveries/to-return') return reply(200, { suppliers: [] });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const BOOKED = '/workshop/deliveries/delivery/77/booked';
const PAGE = '/workshop/deliveries/delivery/77';

// The independent review, 3 Nov (design 7): the Owner's costs don't stay on the
// computer when the person changes, whichever way it changes.
for (const [how, act] of [['checks in', (a) => a.checkIn('1234')], ['ends a check-in', (a) => a.switchServing()], ['taps in', (a) => a.tapIn(2)]]) {
  test(`when someone ${how}, what the last person was sent about deliveries and orders goes`, async () => {
    uninstall = installDom('http://localhost/workshop');
    rendered = true;
    globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => ({ serving: null, checkedInToday: [], deliveries: [] }) });
    const rtl = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const { useCheckinActions } = await importFresh(new URL('../../.test-build/lib/till-checkin.js', import.meta.url).href);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const secret = { bookedCost: 57.1, totalCost: 57.1 };
    const KEYS = [['deliveries', 77], ['deliveries', 'recent'], ['purchase-orders'], ['purchase-order', 7], ['po-products', 'pads'],
      ['product', 1], ['products', 'pads'], ['stock', ''], ['stock-takes'], ['stock-take-check', 5], ['needs-attention']];
    for (const key of KEYS) client.setQueryData(key, secret);
    client.setQueryData(['suppliers'], ['[Supplier]']);
    let actions;
    const Grab = () => { actions = useCheckinActions(); return null; };
    rtl.render(createElement(QueryClientProvider, { client }, createElement(Grab)));
    try {
      await rtl.act(async () => { await act(actions); });
      for (const key of KEYS) assert.ok(client.getQueryData(key) === undefined, JSON.stringify(key));
      assert.deepEqual(client.getQueryData(['suppliers']), ['[Supplier]'], 'what isn’t about costs stays');
    } finally {
      // Its own client: a query left in it keeps the test file running for 5 minutes.
      client.clear();
    }
  });
}

// On a till signed in as the Owner with Jo checked in, the session still says
// Owner; what the server sends decides.
test('Delivery booked in with no costs sent shows no Owner’s links, whatever the sign-in says', async () => {
  const { ui } = await open(BOOKED, { me: OWNER, delivery: FOR_STAFF });
  await ui.findByRole('heading', { level: 2, name: 'Booked in' }, OPENED);
  assert.ok(ui.getByText('1 set aside as damaged — the owner will return it'));
  assert.ok(ui.queryByRole('link', { name: 'Open the order from [Supplier]' }) === null);
});

test('Delivery booked in, as the Owner: what happened, what was set aside and still to come, with their links', async () => {
  const { ui, within } = await open(BOOKED, { delivery: FOR_OWNER });
  await ui.findByRole('heading', { level: 2, name: 'Booked in' }, OPENED);
  assert.equal(within(ui.getByRole('main')).getByRole('status').textContent, '3 items booked in · stock updated');
  const rows = within(ui.getByRole('list', { name: 'Booked in' })).getAllByRole('listitem');
  assert.ok(rows[0].textContent.includes('1 set aside as damaged'), rows[0].textContent);
  assert.ok(rows[0].textContent.includes('On To return to [Supplier]'));
  assert.ok(rows[1].textContent.includes('4 still to come on the order'), rows[1].textContent);
  assert.ok(rows[1].textContent.includes('[Supplier] · ordered Tue 1 Sep'));
  assert.equal(ui.getByRole('link', { name: 'See what’s to return to [Supplier]' }).getAttribute('href'), '/workshop/deliveries');
  assert.equal(ui.getByRole('link', { name: 'Open the order from [Supplier]' }).getAttribute('href'), '/workshop/deliveries/orders/7');
  assert.equal(ui.getByRole('link', { name: 'Receive another delivery' }).getAttribute('href'), '/workshop/deliveries/receive');
});

test('Delivery booked in, as Staff: the owner will return it, and no links they can’t use', async () => {
  const { ui } = await open(BOOKED, { me: JO, delivery: FOR_STAFF });
  await ui.findByRole('heading', { level: 2, name: 'Booked in' }, OPENED);
  assert.ok(ui.getByText('1 set aside as damaged — the owner will return it'));
  assert.ok(ui.getByText('It isn’t in stock'));
  assert.ok(ui.getByRole('list', { name: 'Booked in' }).textContent.includes('4 still to come on the order'));
  assert.ok(ui.queryByRole('link', { name: 'See what’s to return to [Supplier]' }) === null);
  assert.ok(ui.queryByRole('link', { name: 'Open the order from [Supplier]' }) === null);
  assert.ok(ui.getByRole('link', { name: 'Receive another delivery' }));
});

test('Delivery booked in: one item says item; with nothing in stock it doesn’t say stock updated; nothing set aside or to come lists nothing', async () => {
  const one = await open(BOOKED, { delivery: { ...FOR_OWNER, items: 1, setAside: [], stillToCome: [] } });
  await one.ui.findByRole('heading', { level: 2, name: 'Booked in' }, OPENED);
  assert.equal(one.within(one.ui.getByRole('main')).getByRole('status').textContent, '1 item booked in · stock updated');
  assert.ok(one.ui.queryByRole('list', { name: 'Booked in' }) === null);
  one.cleanup();
  shell.queryClient.clear();
  uninstall();
  const none = await open(BOOKED, { delivery: { ...FOR_OWNER, items: 0, lines: [], setAside: [{ ...FOR_OWNER.setAside[0], kind: 'wrong_item', qty: 2 }], stillToCome: [] } });
  await none.ui.findByRole('heading', { level: 2, name: 'Booked in' }, OPENED);
  assert.equal(none.within(none.ui.getByRole('main')).getByRole('status').textContent, 'Nothing booked in');
  assert.ok(none.ui.getByText('2 set aside as a wrong item'));
});

test('a delivery with no supplier: its name and To return say none', async () => {
  const { ui } = await open(BOOKED, { delivery: { ...FOR_OWNER, supplierId: null, supplierName: null, stillToCome: [] } });
  await ui.findByRole('heading', { level: 2, name: 'Booked in' }, OPENED);
  assert.ok(ui.getByText('On To return'));
  assert.ok(ui.getByRole('link', { name: 'See what’s to return' }));
});

test('a delivery’s page, as the Owner: lines with costs, the booked-in cost, what was set aside', async () => {
  const { ui, within } = await open(PAGE, { delivery: FOR_OWNER });
  await ui.findByRole('heading', { level: 2, name: '[Supplier] · 3 items' }, OPENED);
  assert.ok(ui.getByText('Booked in Tue 1 Sep by Jack Lewis'));
  const items = within(ui.getByRole('list', { name: 'Items in this delivery' })).getAllByRole('listitem');
  assert.ok(items[0].textContent.includes('Shimano brake pads'));
  assert.ok(items[0].textContent.includes('B05S-RX · 2 × £28.00'), items[0].textContent);
  // Then the Owner's Change cost (product-page-sizes, design 5).
  assert.ok(items[0].textContent.endsWith('£56.00Change cost'), items[0].textContent);
  assert.ok(items[1].textContent.includes('1 × £1.10'), items[1].textContent);
  assert.ok(ui.getByText('Booked-in cost, before VAT'));
  assert.ok(ui.getByText('£57.10'));
  assert.ok(ui.getByRole('heading', { level: 3, name: 'Set aside as problems' }));
  const aside = within(ui.getByRole('list', { name: 'Set aside as problems' })).getAllByRole('listitem');
  assert.ok(aside[0].textContent.includes('Damaged · 1 · £1.10'), aside[0].textContent);
  assert.ok(aside[0].textContent.includes('On To return'));
  assert.ok(ui.queryByText('Costs are for people who can order stock.') === null);
  assert.equal(within(ui.getByRole('main')).getByRole('link', { name: 'Deliveries and orders' }).getAttribute('href'), '/workshop/deliveries');
});

test('a delivery’s page, as Staff: no costs anywhere, and the note says why', async () => {
  const { ui, within } = await open(PAGE, { me: JO, delivery: FOR_STAFF });
  await ui.findByRole('heading', { level: 2, name: '[Supplier] · 3 items' }, OPENED);
  const items = within(ui.getByRole('list', { name: 'Items in this delivery' })).getAllByRole('listitem');
  assert.ok(items[0].textContent.includes('B05S-RX · 2'), items[0].textContent);
  const main = ui.getByRole('main').textContent;
  assert.ok(!main.includes('£'), main);
  assert.ok(ui.queryByText('Booked-in cost, before VAT') === null);
  assert.ok(ui.getByText('Costs are for people who can order stock.'));
  const aside = within(ui.getByRole('list', { name: 'Set aside as problems' })).getAllByRole('listitem');
  assert.ok(aside[0].textContent.includes('Damaged · 1'), aside[0].textContent);
});

test('a delivery’s page: an item sent back says Returned; none set aside shows no list; with no supplier or name it says less', async () => {
  const back = await open(PAGE, { delivery: { ...FOR_OWNER, setAside: [{ ...FOR_OWNER.setAside[0], returned: true, kind: 'wrong_item' }] } });
  const aside = await back.ui.findByRole('list', { name: 'Set aside as problems' }, OPENED);
  assert.ok(aside.textContent.includes('Wrong item · 1'), aside.textContent);
  assert.ok(aside.textContent.includes('Returned'));
  assert.ok(!aside.textContent.includes('On To return'));
  back.cleanup();
  shell.queryClient.clear();
  uninstall();
  const bare = await open(PAGE, { delivery: { ...FOR_OWNER, items: 1, supplierId: null, supplierName: null, bookedBy: null, setAside: [] } });
  await bare.ui.findByRole('heading', { level: 2, name: 'Delivery · 1 item' }, OPENED);
  assert.ok(bare.ui.getByText('Booked in Tue 1 Sep'));
  assert.ok(bare.ui.queryByRole('list', { name: 'Set aside as problems' }) === null);
});

for (const [name, path] of [['Delivery booked in', BOOKED], ['a delivery’s page', PAGE]]) {
  test(`${name}: not found says so, a failed load says try again, each with the way back`, async () => {
    const gone = await open(path, { status: 404 });
    assert.equal((await gone.within(await gone.ui.findByRole('main', {}, OPENED)).findByRole('alert')).textContent, 'Delivery not found');
    assert.ok(gone.within(gone.ui.getByRole('main')).getByRole('link', { name: 'Deliveries and orders' }));
    gone.cleanup();
    shell.queryClient.clear();
    uninstall();
    const down = await open(path, { status: 500 });
    assert.equal((await down.within(await down.ui.findByRole('main', {}, OPENED)).findByRole('alert', {}, { timeout: 15000 })).textContent, 'Wheelhouse couldn’t load this delivery. Try again in a moment.');
  });
}

const RECENT = [
  { id: 78, supplierName: '[Supplier 2]', items: 1, bookedInAt: AT, bookedBy: 'Jo Taylor' },
  { id: 77, supplierName: '[Supplier]', items: 3, bookedInAt: AT, bookedBy: 'Jack Lewis' },
  { id: 76, supplierName: null, items: 2, bookedInAt: AT, bookedBy: null },
];

for (const [who, me] of [['the Owner', OWNER], ['Staff', JO]]) {
  test(`Recent deliveries on the hub, for ${who}: each with Open, last before any note`, async () => {
    const { ui, within } = await open('/workshop/deliveries', { me, deliveries: RECENT });
    const list = await ui.findByRole('list', { name: 'Recent deliveries' }, OPENED);
    const rows = within(list).getAllByRole('listitem');
    assert.ok(rows[0].textContent.includes('[Supplier 2] · 1 item'), rows[0].textContent);
    assert.ok(rows[0].textContent.includes('Booked in Tue 1 Sep by Jo Taylor'));
    assert.ok(rows[2].textContent.includes('Delivery · 2 items'), rows[2].textContent);
    assert.equal(within(list).getByRole('link', { name: 'Open the delivery from [Supplier], Tue 1 Sep' }).getAttribute('href'), '/workshop/deliveries/delivery/77');
    assert.ok(within(list).getByRole('link', { name: 'Open the delivery, Tue 1 Sep' }));
    const headings = ui.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    assert.equal(headings.at(-1), 'Recent deliveries');
  });
}

test('with no deliveries there’s no Recent deliveries section; a failed load says so', async () => {
  const none = await open('/workshop/deliveries', { deliveries: [] });
  await none.ui.findByRole('heading', { level: 2, name: 'Orders' }, OPENED);
  await none.waitFor(() => assert.ok(none.ui.queryByText('Loading…') === null));
  assert.ok(none.ui.queryByRole('heading', { level: 2, name: 'Recent deliveries' }) === null);
  none.cleanup();
  shell.queryClient.clear();
  uninstall();
  const down = await open('/workshop/deliveries', { status: 500 });
  const section = await down.ui.findByRole('region', { name: 'Recent deliveries' }, { timeout: 15000 });
  assert.equal(down.within(section).getByRole('alert').textContent, 'Wheelhouse couldn’t load the recent deliveries. Try again in a moment.');
});

// UX walk-through 5 M2 (rs-booked-c2w): the bike put aside for Maya, her order moving on.
const C2W = { orderId: 31, customerName: 'Maya Patel', name: 'Trek Domane AL 3', frameNumber: '[frame number]', ready: true };
test('a Cycle to Work bike booked in is put aside for Maya, as drawn, with a link to her order', async () => {
  const r = await open(BOOKED, { me: JO, delivery: { ...FOR_STAFF, c2w: [C2W] } });
  const title = await r.ui.findByText('Maya Patel · Cycle to Work', {}, OPENED);
  const row = title.closest('li');
  assert.equal(row.textContent.includes('Trek Domane AL 3 · frame [frame number] · put it aside for Maya Patel — not for sale · their order moves to Ready to collect'), true, row.textContent);
  assert.equal(r.within(row).getByText('put it aside for Maya Patel — not for sale').tagName, 'STRONG');
  const link = r.within(row).getByRole('link', { name: 'Open Maya Patel’s Cycle to Work order' });
  assert.equal(link.textContent, 'Open the order');
  assert.equal(link.getAttribute('href'), '/workshop/c2w/31');
});

test('a Cycle to Work bike booked in before the certificate doesn’t say the order moves on', async () => {
  const r = await open(BOOKED, { me: JO, delivery: { ...FOR_STAFF, c2w: [{ ...C2W, ready: false }] } });
  const row = (await r.ui.findByText('Maya Patel · Cycle to Work', {}, OPENED)).closest('li');
  assert.ok(!row.textContent.includes('Ready to collect'), row.textContent);
  assert.ok(row.textContent.includes('put it aside for Maya Patel — not for sale'));
});
