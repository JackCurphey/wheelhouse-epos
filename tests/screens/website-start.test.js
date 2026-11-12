// The Website start: three steps before the Website page
// (openspec/changes/website-management, tasks 3.3 and 3.4; the drawings
// ws-start-which, ws-start-look and ws-start-products in
// docs/design/user-journeys/generator/website.mjs, lines 155-172).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openWebsite, closeWebsite, calls, NOT_SET_UP, OFF_NEVER } from '../helpers/website-screen.js';

afterEach(closeWebsite);
const PAGE = '/workshop/website';

async function start(extra = {}) {
  let state = NOT_SET_UP;
  const opened = await openWebsite(PAGE, {
    answers: {
      '/api/website': () => [200, state],
      '/api/website/set-up': () => { state = OFF_NEVER; return [200, OFF_NEVER]; },
      ...extra,
    },
  });
  await opened.ui.findByRole('heading', { name: 'Wheelhouse’s website, or your Shopify shop?' });
  return opened;
}
const next = (ui, fireEvent) => fireEvent.click(ui.getByRole('button', { name: 'Next' }));

test('step 1: Wheelhouse’s website or Shopify, with Not now and its note', async () => {
  const { ui, fireEvent } = await start();
  assert.ok(ui.getByRole('heading', { level: 1, name: 'Website' }));
  const bar = ui.getByRole('progressbar', { name: 'Step 1 of 3' });
  assert.equal(bar.getAttribute('aria-valuenow'), '1');
  assert.ok(ui.getByText('SET UP YOUR WEBSITE · STEP 1 OF 3'));
  assert.ok(ui.getByText('You can change this later.'));
  assert.ok(ui.getByRole('group', { name: 'Which website' }));
  assert.ok(ui.getByRole('radio', { name: /Wheelhouse’s website/ }).checked);
  assert.equal(ui.getByRole('radio', { name: /Connect your Shopify shop/ }).checked, false);
  assert.ok(ui.getByText('The Website page will say “Not set up yet”'));
  fireEvent.click(ui.getByRole('button', { name: 'Not now' }));
  assert.ok(await ui.findByRole('heading', { name: 'Not set up yet' }));
  fireEvent.click(ui.getByRole('button', { name: 'Set up your website' }));
  assert.ok(await ui.findByRole('heading', { name: 'Wheelhouse’s website, or your Shopify shop?' }));
});

test('step 2: the logo, the skip line, Wheelhouse’s own colour, and another colour checked for reading', async () => {
  const { ui, fireEvent } = await start();
  next(ui, fireEvent);
  assert.ok(await ui.findByRole('heading', { name: 'Your logo and colour' }));
  assert.ok(ui.getByRole('progressbar', { name: 'Step 2 of 3' }));
  assert.ok(ui.getByRole('button', { name: 'Add a logo' }));
  assert.ok(ui.getByText('No logo yet? Skip it — your shop’s name is shown instead, and you can add one later.'));
  assert.ok(ui.getByRole('group', { name: 'Main colour — for buttons and links' }));
  assert.ok(ui.getByRole('radio', { name: 'Soft sand charcoal, #2A2822' }).checked);
  assert.ok(ui.getByText('Every colour is checked so text on it stays easy to read.'));
  fireEvent.click(ui.getByRole('button', { name: 'Choose another colour' }));
  const another = ui.getByLabelText('Another colour');
  fireEvent.change(another, { target: { value: '#f5d90a' } });
  assert.match((await ui.findByRole('alert')).textContent, /hard to read/);
  assert.ok(ui.getByRole('radio', { name: 'Soft sand charcoal, #2A2822' }).checked);
  fireEvent.change(another, { target: { value: '#1a3f66' } });
  assert.ok((await ui.findByRole('radio', { name: 'Dark blue, #1A3F66' })).checked);
  assert.ok(ui.queryByRole('alert') === null);
});

test('step 2: adding a logo uploads it and shows it', async () => {
  const withLogo = { ...NOT_SET_UP, logo: '/uploads/logo.png' };
  const { ui, fireEvent, waitFor } = await start({ '/api/website/logo': () => [200, withLogo] });
  next(ui, fireEvent);
  await ui.findByRole('heading', { name: 'Your logo and colour' });
  const file = new window.File(['png'], 'logo.png', { type: 'image/png' });
  fireEvent.change(ui.getByLabelText('Logo file'), { target: { files: [file] } });
  await waitFor(() => assert.equal(calls.filter((c) => c.path === '/api/website/logo').length, 1));
  assert.equal(calls.find((c) => c.path === '/api/website/logo').body.contentType, 'image/png');
  assert.ok(await ui.findByRole('img', { name: 'Your logo, uploaded' }));
  assert.ok(ui.getByRole('button', { name: 'Change logo' }));
});

test('step 3: every product or nothing, the counts with See them, and Make my website sets it up', async () => {
  const { ui, fireEvent, within, waitFor } = await start();
  next(ui, fireEvent);
  await ui.findByRole('heading', { name: 'Your logo and colour' });
  fireEvent.click(ui.getByRole('button', { name: 'Choose another colour' }));
  fireEvent.change(ui.getByLabelText('Another colour'), { target: { value: '#1a3f66' } });
  await ui.findByRole('radio', { name: 'Dark blue, #1A3F66' });
  next(ui, fireEvent);
  assert.ok(await ui.findByRole('heading', { name: 'Start with every product online, or nothing?' }));
  assert.ok(ui.getByRole('progressbar', { name: 'Step 3 of 3' }));
  assert.ok(ui.getByRole('group', { name: 'Start with' }));
  assert.ok(ui.getByRole('radio', { name: /Every product online/ }).checked);
  assert.ok(ui.getByRole('radio', { name: /Nothing online/ }));
  assert.ok(ui.getByText('With every product online'));
  const counts = within(ui.getByRole('list', { name: 'Your products online' }));
  assert.ok(counts.getByText('212 products go online'));
  assert.ok(counts.getByRole('link', { name: 'See the products with no photo, in Stock' }));
  assert.ok(counts.getByRole('link', { name: 'See the products with no price, in Stock' }));
  assert.ok(ui.getByText('Your website stays off until you turn it on.'));
  fireEvent.click(ui.getByRole('button', { name: 'Make my website' }));
  assert.ok(await ui.findByRole('heading', { name: 'Your website is off' }));
  await waitFor(() => assert.equal(calls.filter((c) => c.path === '/api/website/set-up').length, 1));
  assert.deepEqual(calls.find((c) => c.path === '/api/website/set-up').body, { kind: 'wheelhouse', startWith: 'every', mainColour: '#1A3F66' });
});

test('Back keeps each step’s choice, and Nothing online is sent when chosen', async () => {
  const { ui, fireEvent, waitFor } = await start();
  next(ui, fireEvent);
  await ui.findByRole('heading', { name: 'Your logo and colour' });
  next(ui, fireEvent);
  await ui.findByRole('heading', { name: 'Start with every product online, or nothing?' });
  fireEvent.click(ui.getByRole('radio', { name: /Nothing online/ }));
  fireEvent.click(ui.getByRole('button', { name: 'Back' }));
  assert.ok(ui.getByRole('radio', { name: 'Soft sand charcoal, #2A2822' }).checked);
  fireEvent.click(ui.getByRole('button', { name: 'Choose another colour' }));
  fireEvent.change(ui.getByLabelText('Another colour'), { target: { value: '#2f6b4f' } });
  await ui.findByRole('radio', { name: 'Green, #2F6B4F' });
  next(ui, fireEvent);
  assert.ok(ui.getByRole('radio', { name: /Nothing online/ }).checked);
  fireEvent.click(ui.getByRole('button', { name: 'Back' }));
  assert.ok(ui.getByRole('radio', { name: 'Green, #2F6B4F' }).checked, 'your own colour is still shown, and chosen');
  next(ui, fireEvent);
  fireEvent.click(ui.getByRole('button', { name: 'Make my website' }));
  await waitFor(() => assert.equal(calls.filter((c) => c.path === '/api/website/set-up').length, 1));
  assert.deepEqual(calls.find((c) => c.path === '/api/website/set-up').body, { kind: 'wheelhouse', startWith: 'nothing', mainColour: '#2F6B4F' });
});

// jsdom has no canvas: a pretend picture and canvas give every pixel one colour.
function pretendLogoReading(rgb) {
  const OldImage = window.Image;
  const oldContext = window.HTMLCanvasElement.prototype.getContext;
  window.Image = class { set src(_v) { setTimeout(() => this.onload?.(), 0); } };
  const data = new Uint8ClampedArray(64 * 64 * 4).map((_, i) => (i % 4 === 3 ? 255 : rgb[i % 4]));
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {}, getImageData: () => ({ data }) });
  return () => { window.Image = OldImage; window.HTMLCanvasElement.prototype.getContext = oldContext; };
}

test('step 2: with a logo, its colour is suggested first and chosen', async (t) => {
  let state = { ...NOT_SET_UP, logo: '/uploads/logo.png' };
  const { ui, fireEvent, waitFor } = await openWebsite(PAGE, {
    answers: { '/api/website': () => [200, state], '/api/website/set-up': () => { state = OFF_NEVER; return [200, OFF_NEVER]; } },
  });
  t.after(pretendLogoReading([0x1a, 0x3f, 0x66]));
  await ui.findByRole('heading', { name: 'Wheelhouse’s website, or your Shopify shop?' });
  next(ui, fireEvent);
  assert.ok(await ui.findByText('From your logo'));
  assert.ok((await ui.findByRole('radio', { name: 'Dark blue, #1A3F66' })).checked);
  assert.equal(ui.getByRole('radio', { name: 'Soft sand charcoal, #2A2822' }).checked, false);
  next(ui, fireEvent);
  fireEvent.click(ui.getByRole('button', { name: 'Make my website' }));
  await waitFor(() => assert.equal(calls.filter((c) => c.path === '/api/website/set-up').length, 1));
  assert.equal(calls.find((c) => c.path === '/api/website/set-up').body.mainColour, '#1A3F66');
});

test('set up in another tab meanwhile: Make my website shows the Website page as it now is', async () => {
  let state = NOT_SET_UP;
  const { ui, fireEvent } = await openWebsite(PAGE, {
    answers: {
      '/api/website': () => [200, state],
      '/api/website/set-up': () => { state = OFF_NEVER; return [409, { error: 'The website is already set up' }]; },
    },
  });
  await ui.findByRole('heading', { name: 'Wheelhouse’s website, or your Shopify shop?' });
  next(ui, fireEvent);
  await ui.findByRole('heading', { name: 'Your logo and colour' });
  next(ui, fireEvent);
  fireEvent.click(await ui.findByRole('button', { name: 'Make my website' }));
  assert.ok(await ui.findByRole('heading', { name: 'Your website is off' }));
});

test('choosing Shopify says connecting it comes later, and sets nothing up', async () => {
  const { ui, fireEvent } = await start();
  fireEvent.click(ui.getByRole('radio', { name: /Connect your Shopify shop/ }));
  next(ui, fireEvent);
  assert.ok(await ui.findByRole('heading', { name: 'Connect your Shopify shop' }));
  assert.ok(ui.queryByRole('button', { name: 'Make my website' }) === null);
  fireEvent.click(ui.getByRole('button', { name: 'Back' }));
  assert.ok(ui.getByRole('radio', { name: /Connect your Shopify shop/ }).checked);
  assert.equal(calls.filter((c) => c.path === '/api/website/set-up').length, 0);
});
