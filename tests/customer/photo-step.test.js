// Use my phone, the phone's side (openspec/changes/use-my-phone; drawn as
// phone-photo-ready, -check, -done and -expired, approved 23 Oct,
// docs/decisions/2026-10-23-use-my-phone.md): the page a code opens, with no
// sign-in. It shows the shop, the job and the line, takes or chooses one
// photo, checks it, sends it; a spent code says so and nothing more.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';
import { PHOTO_STEP_ROUTE } from '../../src/customer/routes.ts';

let current;
// The test browser can't make a preview address for its pretend files; a
// phone's browser can.
const realObjectUrl = [URL.createObjectURL, URL.revokeObjectURL];
URL.createObjectURL = () => 'blob:the-photo';
URL.revokeObjectURL = () => {};
process.on('exit', () => { [URL.createObjectURL, URL.revokeObjectURL] = realObjectUrl; });
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const CODE = 'c'.repeat(64);
const VIEW = { shopName: 'North Street Cycles', reference: 'WH-1042', bike: 'Trek Domane AL 3', line: 'Shimano brake pads', reason: 'Rear pads worn — replacing' };
const GONE = { status: 410, body: { error: 'This code has expired or has already been used' } };

const open = async (photoCode) => {
  current = await renderBookScreen({
    file: 'screens/book/photo-step.js', exportName: 'PhotoStepScreen', at: 'photo/:code',
    url: `/book/north/photo/${CODE}`, services: SERVICES, photoCode,
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const photo = (type = 'image/jpeg', size = 4) => new window.File([new Uint8Array(size)], 'pads.jpg', { type });

test('the page lives where the server sends the phone', () => {
  assert.equal(PHOTO_STEP_ROUTE, '/book/:shopSlug/photo/:code');
});

test('the code opens the photo step: the line, the job and bike, the reason, and the two ways to add a photo', async () => {
  const { ui } = await open(() => ({ status: 200, body: VIEW }));
  assert.ok((await ui.findByRole('heading', { name: 'Add a photo for Shimano brake pads' })) !== null);
  assert.ok(ui.queryByText('WH-1042 · Trek Domane AL 3') !== null);
  assert.ok(ui.queryByText('Rear pads worn — replacing') !== null);
  const take = ui.getByLabelText('Take a photo');
  assert.equal(take.getAttribute('capture'), 'environment');
  assert.equal(take.getAttribute('accept'), 'image/jpeg,image/png,image/webp');
  const choose = ui.getByLabelText('Choose from your photos');
  assert.equal(choose.getAttribute('capture'), null);
});

test('a photo is checked before it\'s sent; Use this photo sends it, then Photo added', async () => {
  const { ui, requests } = await open((url, init) => (init?.method === 'POST' ? { status: 201, body: { reference: 'WH-1042', line: 'Shimano brake pads' } } : { status: 200, body: VIEW }));
  const { fireEvent } = await rtl();
  fireEvent.change(await ui.findByLabelText('Take a photo'), { target: { files: [photo()] } });
  assert.ok((await ui.findByRole('heading', { name: 'Check the photo' })) !== null);
  assert.ok(ui.queryByText('For Shimano brake pads on WH-1042.') !== null);
  assert.ok(ui.queryByRole('img', { name: 'The photo you just took' }) !== null);
  fireEvent.click(ui.getByRole('button', { name: 'Use this photo' }));
  assert.ok((await ui.findByRole('heading', { name: 'Photo added to WH-1042' })) !== null);
  assert.ok(ui.queryByText('It’s on the computer now, under Shimano brake pads. You can close this page.') !== null);
  const sent = requests.filter((r) => r.method === 'POST');
  assert.equal(sent.length, 1);
  assert.match(sent[0].url, new RegExp(`/api/portal/north/photo-codes/${CODE}$`));
  assert.equal(sent[0].body.dataBase64, Buffer.from(new Uint8Array(4)).toString('base64'));
});

test('Take another goes back to the photo step without sending anything', async () => {
  const { ui, requests } = await open(() => ({ status: 200, body: VIEW }));
  const { fireEvent } = await rtl();
  fireEvent.change(await ui.findByLabelText('Choose from your photos'), { target: { files: [photo()] } });
  fireEvent.click(await ui.findByRole('button', { name: 'Take another' }));
  assert.ok((await ui.findByRole('heading', { name: 'Add a photo for Shimano brake pads' })) !== null);
  assert.equal(requests.filter((r) => r.method === 'POST').length, 0);
});

test('a code that has run out or been used says so, and nothing about the job', async () => {
  const { ui } = await open(() => GONE);
  assert.ok((await ui.findByRole('heading', { name: 'This code has expired or has already been used' })) !== null);
  assert.ok(ui.queryByText('Make a new one on the computer.') !== null);
  assert.ok(ui.queryByLabelText('Take a photo') === null);
});

test('a code that runs out while the photo is being checked says so when it\'s sent', async () => {
  const { ui } = await open((url, init) => (init?.method === 'POST' ? GONE : { status: 200, body: VIEW }));
  const { fireEvent } = await rtl();
  fireEvent.change(await ui.findByLabelText('Take a photo'), { target: { files: [photo()] } });
  fireEvent.click(await ui.findByRole('button', { name: 'Use this photo' }));
  assert.ok((await ui.findByRole('heading', { name: 'This code has expired or has already been used' })) !== null);
});

test('a photo over 10 MB, or not a photo, is refused on the phone in plain words', async () => {
  const { ui, requests } = await open(() => ({ status: 200, body: VIEW }));
  const { fireEvent } = await rtl();
  fireEvent.change(await ui.findByLabelText('Take a photo'), { target: { files: [photo('image/jpeg', 10 * 1024 * 1024 + 1)] } });
  assert.ok((await ui.findByText('pads.jpg is over 10 MB.')) !== null);
  fireEvent.change(ui.getByLabelText('Choose from your photos'), { target: { files: [photo('application/pdf')] } });
  assert.ok((await ui.findByText('pads.jpg isn\'t a JPEG, PNG or WebP photo.')) !== null);
  assert.equal(requests.filter((r) => r.method === 'POST').length, 0);
});
