// Cycle to Work outside its own pages (openspec/changes/cycle-to-work, task
// 10.4, pull request 10a): the hold line on Today (op-today-c2w and
// cw-today-choose in opening.mjs and c2w.mjs, after Hold longer cw-today-held),
// the header search (cs-search-c2w) and the customer's page (cs-page-c2w,
// cs-page-c2w-collected) in customer.mjs. Example data from the drawings:
// North Street Cycles, Maya Patel (07700 900 142); bikes, providers, quote and
// certificate numbers stay bracketed; dates are visibly test values.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MAYA = { id: 5, name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', notes: null, address: null, postcode: null, marketingPermission: false, groups: [] };
// A test day (after the pinned 1 Sep 2026), and days from it.
const TODAY = '2026-09-14';
const day = (n) => { const d = new Date(`${TODAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const long = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const LABEL = 'Search jobs, customers, bikes and orders';
const HOLD = { kind: 'c2w_hold_ended', orderId: 31, customerName: 'Maya Patel', bike: '[Bike] · [Size]', holdUntil: day(-6) };
const NO_CERT = { kind: 'c2w_no_certificate', orderId: 31, customerName: 'Maya Patel', bike: '[Bike] · [Size]', quotedDays: 9, holdUntil: day(7) };
const LATE = { kind: 'c2w_payment_late', orderId: 31, providerName: '[Provider]', customerName: 'Maya Patel', collectedOn: day(-20), expectedPence: 90000, expectedBy: day(-12), lateDays: 12 };
const FOUND = { id: 31, customerName: 'Maya Patel', customerId: 5, bike: '[Bike] · [Size]', stage: 'waiting', quoteRef: 'CW-[n]', holdUntil: day(1), holdEnded: false, certificateNumber: null };
const OPEN = { kind: 'c2w_order', id: 31, stage: 'waiting', open: true, quoteRef: 'CW-[n]', bike: '[Bike] · [Size]', providerName: '[Provider]', holdUntil: day(1), holdEnded: false, certificateNumber: null, collectedAt: null, at: `${day(-13)}T10:00:00.000Z` };
const COLLECTED = { kind: 'c2w_order', id: 32, stage: 'collected', open: false, quoteRef: 'CW-[m]', bike: '[Bike] · [Size]', providerName: '[Provider]', holdUntil: null, holdEnded: false, certificateNumber: '[certificate number]', collectedAt: `${day(-10)}T10:00:00.000Z`, at: `${day(-10)}T10:00:00.000Z` };
const SEARCHED = { timeout: 5000 };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open(path, { items = [HOLD], history = [OPEN, COLLECTED], refuse = null, slow = false, found = [FOUND] } = {}) {
  calls = [];
  let attention = items;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url: String(url), method });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    const p = u.pathname;
    if (p === '/api/auth/me') return reply(200, OWNER);
    if (p === '/api/needs-attention') return reply(200, { items: attention });
    if (method === 'POST' && (p === '/api/c2w/orders/31/hold-longer' || p === '/api/c2w/orders/31/release')) {
      if (slow) await new Promise((r) => setTimeout(r, 50));
      if (refuse) return reply(409, refuse);
      attention = attention.filter((i) => i.orderId !== 31);
      return reply(200, { order: { id: 31, holdUntil: p.endsWith('hold-longer') ? day(7) : null } });
    }
    if (p === '/api/search') return reply(200, { jobs: [], customers: [{ id: 5, name: 'Maya Patel', phone: '07700 900 142', email: null, c2wOrders: 1 }], bikes: [], c2wOrders: found });
    if (p === '/api/customers/5') return reply(200, MAYA);
    if (p === '/api/customers/5/history') return reply(200, { items: history });
    if (p === '/api/your-settings') return reply(200, { accessibility: { statusSymbols: false, reduceMotion: false, noAutoClose: false, largerText: false, foldedSidebar: false } });
    if (p.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 1 });
  return { ...rtl, ui };
}
const posts = (end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(end));
const noteText = () => document.querySelector('[data-saved-note]')?.textContent ?? '';

// ---------- Today ----------

test('op-today-c2w: a hold that ended with nobody choosing asks the Owner to choose, Hold longer or Release the bike', async () => {
  const { ui, within } = await open('/workshop/today');
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  assert.ok(box.getByText(`Maya Patel · Cycle to Work hold ended ${long(day(-6))} — choose`) !== null);
  assert.ok(box.getByText('[Bike] · [Size] · still held · no certificate yet') !== null);
  assert.ok(box.getByRole('button', { name: 'Hold Maya Patel’s bike longer' }).textContent === 'Hold longer');
  assert.ok(box.getByRole('button', { name: 'Release Maya Patel’s bike' }).textContent === 'Release the bike');
});

test('cw-today-held: Hold longer holds the bike in one press; the line goes and the note says until when', async () => {
  const { ui, within, fireEvent, waitFor } = await open('/workshop/today', { slow: true });
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  const longer = box.getByRole('button', { name: 'Hold Maya Patel’s bike longer' });
  shell.queryClient.setQueryData(['c2w-orders'], { groups: {} });
  fireEvent.click(longer);
  assert.equal(longer.disabled, true, 'off while it saves');
  assert.equal(box.getByRole('button', { name: 'Release Maya Patel’s bike' }).disabled, true);
  fireEvent.click(longer);
  await waitFor(() => assert.ok(ui.queryByText(/hold ended/) === null));
  assert.equal(posts('/api/c2w/orders/31/hold-longer').length, 1, 'one press, one hold');
  await waitFor(() => assert.equal(noteText(), `Maya Patel’s bike is held until ${long(day(7))}.`));
  await waitFor(() => assert.ok(document.activeElement === ui.getByRole('heading', { name: 'Needs attention' })));
  assert.equal(shell.queryClient.getQueryState(['c2w-orders'])?.isInvalidated, true, 'the Cycle to Work list is read again');
});

test('Release the bike on Today lets it go; the note says the order stays open', async () => {
  const { ui, within, fireEvent, waitFor } = await open('/workshop/today');
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  fireEvent.click(box.getByRole('button', { name: 'Release Maya Patel’s bike' }));
  await waitFor(() => assert.equal(noteText(), 'Maya Patel’s bike is back on sale. The order stays open.'));
  assert.equal(posts('/api/c2w/orders/31/release').length, 1);
  assert.ok(ui.queryByText(/hold ended/) === null);
});

test('a refused Hold longer shows the server’s words and keeps the line', async () => {
  const words = 'Check in on this till first: holding a bike says who did it.';
  const { ui, within, fireEvent } = await open('/workshop/today', { refuse: { error: words, code: 'check_in_first' } });
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  fireEvent.click(box.getByRole('button', { name: 'Hold Maya Patel’s bike longer' }));
  assert.equal((await box.findByRole('alert')).textContent, words);
  assert.ok(box.getByText(`Maya Patel · Cycle to Work hold ended ${long(day(-6))} — choose`) !== null);
  assert.equal(noteText(), '');
});

test('cw-today: a quote with no certificate yet says how long ago it was given and until when it is held, with Hold longer and Open the order', async () => {
  const { ui, within } = await open('/workshop/today', { items: [NO_CERT] });
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  assert.ok(box.getByText('Maya Patel · Cycle to Work quote, no certificate yet') !== null);
  assert.ok(box.getByText(`[Bike] · [Size] · quoted 9 days ago · held until ${long(day(7))}`) !== null);
  assert.ok(box.getByRole('button', { name: 'Hold Maya Patel’s bike longer' }).textContent === 'Hold longer');
  const openIt = box.getByRole('link', { name: 'Open Maya Patel’s order' });
  assert.equal(openIt.textContent, 'Open the order');
  assert.equal(openIt.getAttribute('href'), '/workshop/c2w/31');
  // The drawing draws the two as the same button: the link takes the small button's look.
  const hold = box.getByRole('button', { name: 'Hold Maya Patel’s bike longer' });
  for (const look of ['text-size-13', 'py-[5px]', 'px-2.5']) {
    assert.ok(hold.className.includes(look), `Hold longer has ${look}`);
    assert.ok(openIt.className.includes(look), `Open the order has ${look}`);
  }
});

test('cw-today: a quote with no bike held has no hold to lengthen, only Open the order; one day reads “1 day”', async () => {
  const { ui, within } = await open('/workshop/today', { items: [{ ...NO_CERT, quotedDays: 1, holdUntil: null }] });
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  assert.ok(box.getByText('[Bike] · [Size] · quoted 1 day ago') !== null);
  assert.ok(box.queryByRole('button', { name: 'Hold Maya Patel’s bike longer' }) === null);
  assert.ok(box.getByRole('link', { name: 'Open Maya Patel’s order' }) !== null);
});

test('op-today-c2w: a late payment says which provider, how late, whose bike and what was expected by when, and opens the order', async () => {
  const { ui, within } = await open('/workshop/today', { items: [LATE] });
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  assert.ok(box.getByText('[Provider] payment is 12 days late') !== null);
  assert.ok(box.getByText(`Maya Patel · collected ${long(day(-20))} · expected £900.00 by ${long(day(-12))}`) !== null);
  const openIt = box.getByRole('link', { name: 'Open [Provider]’s late payment' });
  assert.equal(openIt.textContent, 'Open the order');
  assert.equal(openIt.getAttribute('href'), '/workshop/c2w/31');
});

test('op-today-c2w: a payment one day late reads “1 day late”', async () => {
  const { ui, within } = await open('/workshop/today', { items: [{ ...LATE, lateDays: 1 }] });
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  assert.ok(box.getByText('[Provider] payment is 1 day late') !== null);
});

test('cw-today-held: Hold longer on a quote with no certificate holds it in one press; the line goes and the note says until when', async () => {
  const { ui, within, fireEvent, waitFor } = await open('/workshop/today', { items: [NO_CERT] });
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  fireEvent.click(box.getByRole('button', { name: 'Hold Maya Patel’s bike longer' }));
  await waitFor(() => assert.ok(ui.queryByText(/no certificate yet/) === null));
  assert.equal(posts('/api/c2w/orders/31/hold-longer').length, 1);
  await waitFor(() => assert.equal(noteText(), `Maya Patel’s bike is held until ${long(day(7))}.`));
});

// ---------- Search ----------

test('cs-search-c2w: the header search finds the order, opening it, and says how many orders the customer has', async () => {
  const { ui, within, fireEvent } = await open('/workshop/today', { items: [] });
  fireEvent.change(ui.getByRole('searchbox', { name: LABEL }), { target: { value: 'CW-[n]' } });
  const results = within(await ui.findByRole('region', { name: 'Search results' }, SEARCHED));
  const groups = results.getAllByRole('group').map((g) => g.getAttribute('aria-label'));
  assert.deepEqual(groups, ['Cycle to Work orders', 'Customers'], 'the orders first, as drawn');
  const orders = within(results.getByRole('group', { name: 'Cycle to Work orders' }));
  assert.equal(orders.getByRole('link', { name: 'Maya Patel · Cycle to Work · [Bike] · [Size]' }).getAttribute('href'), '/workshop/c2w/31');
    const line = orders.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === `Quote CW-[n] · Waiting for the certificate · held until ${long(day(1))}`);
  assert.ok(within(line).getByText('CW-[n]').className.includes('font-[family-name:var(--wh-font-mono)]'), 'the quote number in the fixed-width font');
  assert.ok(within(results.getByRole('group', { name: 'Customers' })).getByText('Customer · 07700 900 142 · 1 Cycle to Work order') !== null);
  assert.ok(results.getByText('Cycle to Work orders are found by name, quote number or certificate number.') !== null);
  assert.equal(document.querySelector('[data-search-status]').textContent, '2 results', 'the order and the customer');
});

// ---------- The customer's page ----------

test('cs-page-c2w and -collected: the customer’s orders in their history, open now and earlier, each opening the order', async () => {
  const { ui, within } = await open('/workshop/customers/5');
  const hist = within(await ui.findByRole('region', { name: 'History' }));
  const openNow = within(await hist.findByRole('list', { name: 'Open now' }));
  const now = openNow.getByRole('link', { name: /Cycle to Work · \[Bike\] · \[Size\] · Waiting for the certificate/ });
  assert.equal(now.getAttribute('href'), '/workshop/c2w/31');
  assert.ok(now.textContent.startsWith('Order'), 'tagged Order');
  const sub = openNow.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === `Quote CW-[n] · [Provider] · held until ${long(day(1))}`);
  assert.ok(within(sub).getByText('CW-[n]').className.includes('font-[family-name:var(--wh-font-mono)]'), 'the quote number in the fixed-width font');
  const earlier = within(hist.getByRole('list', { name: 'Earlier, newest first' }));
  const done = earlier.getByRole('link', { name: /Cycle to Work · \[Bike\] · \[Size\] · Collected/ });
  assert.equal(done.getAttribute('href'), '/workshop/c2w/32');
  const was = earlier.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === `Quote CW-[m] · certificate [certificate number] · collected ${long(day(-10))}`);
  assert.ok(within(was).getByText('[certificate number]').className.includes('font-[family-name:var(--wh-font-mono)]'), 'the certificate number too');
});

test('cs-search-c2w and cs-page-c2w: once a hold has ended, the order says so in the list’s words, not “held until”', async () => {
  const ended = { holdUntil: day(-2), holdEnded: true };
  const { ui, within, fireEvent } = await open('/workshop/customers/5', { items: [], found: [{ ...FOUND, ...ended }], history: [{ ...OPEN, ...ended }] });
  const hist = within(await ui.findByRole('region', { name: 'History' }));
  const openNow = within(await hist.findByRole('list', { name: 'Open now' }));
  assert.ok(openNow.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === `Quote CW-[n] · [Provider] · hold ended ${long(day(-2))} — choose`) !== null);
  fireEvent.change(ui.getByRole('searchbox', { name: LABEL }), { target: { value: 'CW-[n]' } });
  const results = within(await ui.findByRole('region', { name: 'Search results' }, SEARCHED));
  assert.ok(results.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === `Quote CW-[n] · Waiting for the certificate · hold ended ${long(day(-2))} — choose`) !== null);
  assert.ok(results.queryByText(/held until/) === null);
});
