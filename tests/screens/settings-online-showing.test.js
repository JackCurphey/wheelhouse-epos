// Settings › Front desk › Online orders › Showing products (openspec/changes/
// website-buy-online, task 2.5; the drawing on-settings-show, online.mjs
// showOpen, and the fold's title and summary in settings-frame.mjs onlineFolds):
// how the website started with Change, a switch on each category, the count of
// products set differently with See them, and the note.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openWebsite as openScreen, closeWebsite, calls } from '../helpers/website-screen.js';

afterEach(closeWebsite);
const PAGE = '/workshop/settings?room=front-desk&fold=online-show';
const WEEK = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '09:00', close: '17:00' }));

// GET /api/website/showing, as server/website-showing.js sends it.
const showing = (over = {}) => ({
  startedWith: 'every', startedAt: '2026-09-10T10:00:00Z', differentCount: 2,
  categories: [{ id: 1, path: 'Bearings', showOnline: true }, { id: 2, path: 'Drivetrain', showOnline: true }, { id: 3, path: 'Drivetrain › Derailleurs', showOnline: false }],
  ...over,
});

async function openShowing(start, { refuse = null } = {}) {
  let body = start;
  const t = await openScreen(PAGE, {
    answers: {
      '/api/workshop-settings': () => [200, { openingHours: WEEK }],
      '/api/shop-details': () => [200, { name: 'North Street Cycles', receiptFooter: null }],
      '/api/website': () => [200, { kind: 'wheelhouse' }],
      '/api/website/showing': () => [200, body],
      '/api/website/start-with': (_q, _m, sent) => {
        if (refuse) return refuse;
        body = { ...body, startedWith: sent.startWith, startedAt: '2026-09-12T10:00:00Z' };
        return [200, body];
      },
      ...Object.fromEntries(body.categories.map((c) => [`/api/website/categories/${c.id}`, (_q, _m, sent) => {
        if (refuse) return refuse;
        body = { ...body, categories: body.categories.map((x) => (x.id === c.id || x.path.startsWith(`${c.path} › `) ? { ...x, showOnline: sent.showOnline } : x)) };
        return [200, body];
      }])),
    },
  });
  await t.ui.findByRole('heading', { level: 3, name: 'Online orders' });
  return t;
}
const area = (t) => t.within(t.ui.getByRole('region', { name: 'Online orders' }));
const fold = (t) => t.ui.getByRole('button', { name: /^Showing products/ });
const sent = (path) => calls.filter((c) => c.path === path && c.method !== 'GET').map((c) => c.body);

test('on-settings-show: the start line, a switch on each category, the count with See them, and the note, second of the folds', async () => {
  const t = await openShowing(showing());
  const box = area(t);
  assert.ok(await box.findByText('Started with every product online on Thu 10 Sep.'));
  assert.ok(box.getByRole('button', { name: 'Change what your website started with' }));
  assert.ok(fold(t).textContent.includes('Set on each category and product'));
  assert.equal(fold(t).getAttribute('aria-expanded'), 'true');
  assert.deepEqual(box.getAllByRole('switch').map((s) => [s.getAttribute('aria-label') ?? s.textContent, s.getAttribute('aria-checked')]).map(([, on]) => on), ['true', 'true', 'false']);
  assert.ok(box.getByRole('switch', { name: 'Drivetrain › Derailleurs' }));
  assert.ok(box.getByText('2 products are set differently from their category.'));
  const see = box.getByRole('link', { name: 'See the products set differently from their category, in Stock' });
  assert.ok(see.getAttribute('href').endsWith('/stock?show=online-differs'), see.getAttribute('href'));
  assert.ok(box.getByText('New products follow their category. Each product’s page in Stock has its own “Show on website” switch.'));
  const titles = t.ui.getAllByRole('button', { name: /^(What the website sells|Showing products|Paying online)/ }).map((b) => b.textContent.match(/^(What the website sells|Showing products|Paying online)/)[1]);
  assert.deepEqual(titles, ['What the website sells', 'Showing products', 'Paying online'], 'in the drawn order');
});

test('a category’s switch saves, and the categories inside it follow', async () => {
  const t = await openShowing(showing({ categories: showing().categories.map((c) => ({ ...c, showOnline: true })) }));
  const box = area(t);
  t.fireEvent.click(await box.findByRole('switch', { name: 'Drivetrain' }));
  await t.waitFor(() => assert.deepEqual(sent('/api/website/categories/2'), [{ showOnline: false }]));
  await t.waitFor(() => assert.equal(box.getByRole('switch', { name: 'Drivetrain › Derailleurs' }).getAttribute('aria-checked'), 'false'));
  assert.equal(box.getByRole('switch', { name: 'Bearings' }).getAttribute('aria-checked'), 'true');
});

test('none set differently, or a website set up before the start was kept, says nothing about either', async () => {
  const t = await openShowing(showing({ startedWith: null, startedAt: null, differentCount: 0 }));
  const box = area(t);
  await box.findByRole('switch', { name: 'Bearings' });
  assert.ok(box.queryByText(/^Started with/) === null);
  assert.ok(box.queryByRole('button', { name: 'Change what your website started with' }) === null);
  assert.ok(box.queryByText(/set differently from their category/) === null);
});

test('Change asks set-up step 3’s question again; Save sends the answer and the line follows', async () => {
  const t = await openShowing(showing({ startedWith: 'nothing' }));
  const box = area(t);
  assert.ok(await box.findByText('Started with nothing online on Thu 10 Sep.'));
  t.fireEvent.click(box.getByRole('button', { name: 'Change what your website started with' }));
  const dialog = await t.ui.findByRole('dialog', { name: 'Start with every product online, or nothing?' });
  const inside = t.within(dialog);
  assert.ok(inside.getByText('Either way, every category and product has its own “Show on website” switch afterwards.'));
  assert.equal(inside.getByRole('radio', { name: /Nothing online/ }).checked, true, 'the answer given before');
  assert.ok(inside.getByText('Everything with a price shows. Switch off what you don’t want online.'));
  t.fireEvent.click(inside.getByRole('radio', { name: /Every product online/ }));
  t.fireEvent.click(inside.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.deepEqual(sent('/api/website/start-with'), [{ startWith: 'every' }]));
  assert.ok(await box.findByText('Started with every product online on Sat 12 Sep.'));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
});

test('Change refused by the server says so in the dialog and keeps it open', async () => {
  const t = await openShowing(showing(), { refuse: [409, { error: 'Set up the website first' }] });
  const box = area(t);
  t.fireEvent.click(await box.findByRole('button', { name: 'Change what your website started with' }));
  const dialog = await t.ui.findByRole('dialog');
  t.fireEvent.click(t.within(dialog).getByRole('button', { name: 'Save' }));
  assert.ok(await t.within(dialog).findByText('Set up the website first'));
  assert.ok(t.ui.getByRole('dialog'));
});

test('a category switch the server refuses says so and stays as it was', async () => {
  const t = await openShowing(showing(), { refuse: [500, { error: 'boom' }] });
  const box = area(t);
  t.fireEvent.click(await box.findByRole('switch', { name: 'Bearings' }));
  const said = await box.findByRole('alert');
  assert.ok(said.textContent.length > 0);
  assert.equal(box.getByRole('switch', { name: 'Bearings' }).getAttribute('aria-checked'), 'true');
});
