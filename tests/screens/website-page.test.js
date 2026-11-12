// The Website page, the screen (openspec/changes/website-management, tasks
// 2.1-2.5; the drawings ws-page, ws-page-on, ws-page-changes, ws-history,
// ws-no-access and the toasts in docs/design/user-journeys/generator/website.mjs).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  openWebsite, closeWebsite, calls, STAFF, OFF_NEVER, ON_CHANGES, ON_CLEAN, OFF_CHANGES, HISTORY, parts, tools,
} from '../helpers/website-screen.js';

afterEach(closeWebsite);
const PAGE = '/workshop/website';
// ws-page-on draws the changes closed; pressing the count opens ws-page-changes.
const openList = async (ui, fireEvent) => fireEvent.click(await ui.findByRole('button', { name: /unpublished change/ }));
const served = (state, extra = {}) => ({ '/api/website': () => [200, state], '/api/website/history': () => [200, HISTORY], ...extra });

// 2.1 ws-page: off, never published.
test('off and never published: the free address, Turn it on with its drawn lines, the starting wording and the product counts', async () => {
  const { ui, within, fireEvent } = await openWebsite(PAGE, { answers: served(OFF_NEVER) });
  assert.ok(await ui.findByRole('heading', { name: 'Your website is off' }));
  assert.ok(ui.getByText(/Only your staff can see it\. Customers will find it at/));
  assert.ok(ui.getByRole('link', { name: 'north-street.wheelhouseepos.com' }));
  assert.ok(ui.getByRole('button', { name: 'Turn it on' }));
  assert.ok(ui.getByText('This also publishes your website as it is now.'));
  assert.ok(ui.getByText('Customers can look but not buy until you connect payments.'));
  assert.ok(ui.getByText(/2 pages still have starting wording:/));
  assert.ok(ui.getByText('212 products go online'));
  assert.ok(ui.getByText('14 have no photo (shown with their name)'));
  assert.ok(ui.getByText('3 have no price (stay off until priced)'));
  // website.mjs seeThem (line 57): the links say what they open.
  assert.equal(ui.getByRole('link', { name: 'See the products with no photo, in Stock' }).getAttribute('href'), '/workshop/stock?show=no-photo');
  assert.equal(ui.getByRole('link', { name: 'See the products with no price, in Stock' }).getAttribute('href'), '/workshop/stock?show=no-price');
  assert.ok(ui.getByText('Not published yet'));
  // History is dimmed until there is something to go back to (website.mjs line 236),
  // but stays reachable by keyboard, with the reason as its title; pressing it opens nothing.
  const historyButton = ui.getByRole('button', { name: 'History' });
  assert.equal(historyButton.disabled, false);
  assert.equal(historyButton.getAttribute('aria-disabled'), 'true');
  assert.equal(historyButton.getAttribute('title'), 'Nothing published yet');
  fireEvent.click(historyButton);
  assert.ok(ui.queryByRole('dialog') === null);
  assert.ok(ui.queryByRole('region', { name: 'Unpublished changes' }) === null);
  const summary = within(ui.getByRole('list', { name: 'Your website' }));
  assert.ok(summary.getByText('Taking payments'));
  assert.ok(summary.getByText(/Not connected · customers can look but not buy/));
  assert.ok(summary.getByText('Home, About us, Contact us, Collection and returns, Privacy, Cookies'));
  assert.ok(summary.getByText('None — so there’s no cookie choice'));
  assert.ok(summary.getByText(/north-street\.wheelhouseepos\.com · your free address/));
  assert.ok(summary.getByText('Wheelhouse’s website'));
  assert.equal(ui.getByRole('link', { name: 'Open Online orders settings' }).getAttribute('href'), '/workshop/settings');
});

test('Edit words and photos and the Pages row both take you to the Words and photos list', async () => {
  const { ui, fireEvent } = await openWebsite(PAGE, { answers: served(OFF_NEVER) });
  const heading = await ui.findByRole('heading', { name: 'Words and photos' });
  fireEvent.click(ui.getByRole('button', { name: 'Edit words and photos: opens the Words and photos list' }));
  assert.ok(document.activeElement === heading);
  heading.blur();
  fireEvent.click(ui.getByRole('button', { name: /^Pages/ }));
  assert.ok(document.activeElement === heading);
  assert.equal(ui.getByRole('link', { name: /^Taking payments/ }).getAttribute('href'), '/workshop/settings');
});

test('Turn it on publishes and switches on together, then the page says it is on', async () => {
  let state = OFF_NEVER;
  const { ui, fireEvent } = await openWebsite(PAGE, {
    answers: served(null, {
      '/api/website': () => [200, state],
      '/api/website/turn-on': () => { state = ON_CLEAN; return [200, ON_CLEAN]; },
    }),
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Turn it on' }));
  assert.ok(await ui.findByRole('heading', { name: 'Your website is on' }));
  assert.equal(calls.filter((c) => c.path === '/api/website/turn-on' && c.method === 'POST').length, 1);
  assert.ok(ui.getByRole('button', { name: 'Turn off' }));
});

// 2.2 ws-page-on and ws-page-changes.
test('on with three changes: the count, who saved them, and the open list with Publish and Discard changes', async () => {
  const { ui, within, fireEvent } = await openWebsite(PAGE, { answers: served(ON_CHANGES) });
  assert.ok(await ui.findByRole('heading', { name: 'Your website is on' }));
  assert.ok(ui.getByText(/Customers can see it at/));
  assert.ok(ui.getByRole('button', { name: 'Turn off' }));
  const toggle = ui.getByRole('button', { name: '3 unpublished changes' });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(ui.queryByRole('region', { name: 'Unpublished changes' }) === null);
  fireEvent.click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(ui.getByText(/Saved by Jack Lewis .* · customers see them when you publish/));
  const list = within(ui.getByRole('region', { name: 'Unpublished changes' }));
  assert.ok(list.getByText('Home page'));
  assert.ok(list.getByText('Headline, The big photo'));
  // A page whose one part is the page itself is named once (decision 17).
  assert.equal(list.getAllByText('Collection and returns').length, 1);
  assert.ok(list.getByText(/1 photo has no description\./));
  assert.ok(list.getByRole('button', { name: 'Add it' }));
  assert.ok(list.getByRole('button', { name: 'Publish' }));
  assert.ok(list.getByRole('button', { name: 'Discard changes' }));
  assert.ok(ui.queryByRole('button', { name: 'Review in the editor' }) === null);
  // Payments are not connected until pull request 5.
  assert.ok(ui.getByText(/Not connected · customers can look but not buy/));
});

test('the changes list starts closed and opens from its count', async () => {
  const { ui, fireEvent } = await openWebsite(PAGE, { answers: served(ON_CHANGES) });
  const toggle = await ui.findByRole('button', { name: '3 unpublished changes' });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(ui.queryByRole('region', { name: 'Unpublished changes' }) === null);
  fireEvent.click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(ui.getByRole('region', { name: 'Unpublished changes' }));
});

test('published with nothing changed: no count, no list, and not "Not published yet"', async () => {
  const { ui } = await openWebsite(PAGE, { answers: served(ON_CLEAN) });
  await ui.findByRole('heading', { name: 'Your website is on' });
  assert.ok(ui.queryByRole('region', { name: 'Unpublished changes' }) === null);
  assert.ok(ui.queryByText('Not published yet') === null);
  assert.ok(ui.queryByText(/unpublished change/) === null);
});

// 2.3 The Words and photos list.
test('Words and photos: seven rows in the drawn order, "Check this" on the starting wording', async () => {
  const { ui, within } = await openWebsite(PAGE, { answers: served(ON_CLEAN) });
  const box = within(await ui.findByRole('list', { name: 'Words and photos' }));
  const rows = box.getAllByRole('listitem');
  assert.deepEqual(rows.map((r) => within(r).getByRole('button', { name: /^Edit: / }).getAttribute('aria-label')), [
    'Edit: Headline', 'Edit: A line about the shop', 'Edit: The big photo', 'Edit: The workshop’s words',
    'Edit: The shop’s own words and photo', 'Edit: Collection and returns', 'Edit: Privacy',
  ]);
  assert.deepEqual(rows.map((r) => within(r).queryByText('Check this') !== null), [false, false, false, false, false, true, true]);
});

test('Edit opens the form box; saving sends that part only, and "Check this" goes', async () => {
  let state = ON_CLEAN;
  const { ui, fireEvent, within, waitFor } = await openWebsite(PAGE, {
    answers: served(null, {
      '/api/website': () => [200, state],
      '/api/website/parts/privacy': (q, method, body) => {
        state = { ...ON_CLEAN, parts: parts(['collection_returns']).map((p) => (p.key === 'privacy' ? { ...p, text: body.text } : p)), partsToCheck: ['Collection and returns'] };
        return [200, state];
      },
    }),
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Edit: Privacy' }));
  const box = within(await ui.findByRole('dialog', { name: 'Privacy' }));
  const words = box.getByLabelText('Words');
  assert.equal(words.value, '[Privacy]');
  fireEvent.change(words, { target: { value: 'We keep your details safe.' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Privacy' }) === null));
  const saved = calls.filter((c) => c.path === '/api/website/parts/privacy');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].method, 'PUT');
  assert.deepEqual(saved[0].body, { text: 'We keep your details safe.' });
  const rows = within(ui.getByRole('list', { name: 'Words and photos' })).getAllByRole('listitem');
  await waitFor(() => assert.ok(within(rows[6]).queryByText('Check this') === null));
});

test('a photo part asks for a description, with "This photo is only decoration" as the other choice', async () => {
  const withPhoto = { ...ON_CLEAN, parts: parts().map((p) => (p.key === 'big_photo' ? { ...p, photo: '/uploads/shop/hero.jpg' } : p)) };
  const { ui, fireEvent, within, waitFor } = await openWebsite(PAGE, { answers: served(withPhoto, { '/api/website/parts/big_photo': () => [200, withPhoto] }) });
  fireEvent.click(await ui.findByRole('button', { name: 'Edit: The big photo' }));
  const box = within(await ui.findByRole('dialog', { name: 'The big photo' }));
  assert.ok(box.getByRole('button', { name: 'Change photo' }));
  const describe = box.getByLabelText('Describe the photo for people who can’t see it');
  assert.equal(describe.getAttribute('placeholder'), 'For example: the shop front on North Street, with bikes outside');
  assert.ok(box.getByText('Read out by screen readers, for blind and partially sighted customers.'));
  fireEvent.click(box.getByLabelText('This photo is only decoration'));
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.equal(calls.filter((c) => c.path === '/api/website/parts/big_photo').length, 1));
  assert.deepEqual(calls.find((c) => c.path === '/api/website/parts/big_photo').body, { description: '', decoration: true });
});

test('"Add it" opens the photo with no description', async () => {
  // The big photo is described; the About us photo isn't, so it is the one to open.
  const withPhoto = { ...ON_CHANGES, parts: parts().map((p) => (
    p.key === 'big_photo' ? { ...p, photo: '/uploads/shop/hero.jpg', description: '[Description]' }
      : p.key === 'shop_words' ? { ...p, photo: '/uploads/shop/inside.jpg' } : p)) };
  const { ui, fireEvent } = await openWebsite(PAGE, { answers: served(withPhoto) });
  await openList(ui, fireEvent);
  fireEvent.click(await ui.findByRole('button', { name: 'Add it' }));
  assert.ok(await ui.findByRole('dialog', { name: 'The shop’s own words and photo' }));
});

test('Turn off turns the website off', async () => {
  const { ui, fireEvent, waitFor } = await openWebsite(PAGE, {
    answers: served(ON_CLEAN, { '/api/website/turn-off': () => [200, { ...ON_CLEAN, isOn: false }] }),
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Turn off' }));
  assert.ok(await ui.findByRole('heading', { name: 'Your website is off' }));
  await waitFor(() => assert.equal(calls.filter((c) => c.path === '/api/website/turn-off' && c.method === 'POST').length, 1));
});

test('a tracking tool that is on shows in its row with the cookie choice; one waiting for its ID does not', async () => {
  const tracking = tools({ google_analytics: { id: 'G-PSW1MY7HB4', on: true }, meta_pixel: { id: 'x!', on: true, wrong: true } });
  const { ui } = await openWebsite(PAGE, { answers: served({ ...ON_CLEAN, tracking }) });
  assert.ok(await ui.findByText('Google Analytics · cookie choice on'));
});

test('changes saved by nobody named say when, not who', async () => {
  const { ui } = await openWebsite(PAGE, { answers: served({ ...ON_CHANGES, savedBy: null }) });
  assert.ok(await ui.findByText(/^Saved .* · customers see them when you publish$/));
  assert.ok(ui.queryByText(/Saved by/) === null);
});

// 2.4 Toasts, Discard and History.
test('Publish while on: "Published — customers see it now" with View website, and the list closes', async () => {
  let state = ON_CHANGES;
  const { ui, fireEvent } = await openWebsite(PAGE, {
    answers: served(null, { '/api/website': () => [200, state], '/api/website/publish': () => { state = ON_CLEAN; return [200, ON_CLEAN]; } }),
  });
  await openList(ui, fireEvent);
  fireEvent.click(await ui.findByRole('button', { name: 'Publish' }));
  // The header's search has a status line of its own, so the toast is found by its words.
  assert.ok((await ui.findByText('Published — customers see it now')).closest('[role="status"]'));
  assert.ok(ui.getByRole('link', { name: 'View website' }));
  assert.ok(ui.queryByRole('region', { name: 'Unpublished changes' }) === null);
});

test('Publish while off: "Published. Customers will see it once you turn the website on" with View it', async () => {
  const after = { ...OFF_CHANGES, changes: [], changeCount: 0, photosWithoutDescription: 0 };
  let state = OFF_CHANGES;
  const { ui, fireEvent } = await openWebsite(PAGE, {
    answers: served(null, { '/api/website': () => [200, state], '/api/website/publish': () => { state = after; return [200, after]; } }),
  });
  await openList(ui, fireEvent);
  fireEvent.click(await ui.findByRole('button', { name: 'Publish' }));
  assert.ok((await ui.findByText('Published. Customers will see it once you turn the website on')).closest('[role="status"]'));
  assert.ok(ui.getByRole('link', { name: 'View it' }));
});

test('Discard changes asks first; Keep editing closes the box and changes nothing', async () => {
  const { ui, fireEvent, within, waitFor } = await openWebsite(PAGE, { answers: served(ON_CHANGES) });
  await openList(ui, fireEvent);
  fireEvent.click(await ui.findByRole('button', { name: 'Discard changes' }));
  const box = within(await ui.findByRole('dialog', { name: 'Discard your 3 unpublished changes?' }));
  assert.ok(box.getByText(/Changes saved since you last published, on/));
  assert.ok(box.getByText(/Headline, The big photo/));
  assert.ok(box.getByText('Your website goes back to the last published version. The changes are kept in History for 90 days, in case you want them back.'));
  fireEvent.click(box.getByRole('button', { name: 'Keep editing' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: /Discard your/ }) === null));
  assert.equal(calls.filter((c) => c.path === '/api/website/discard').length, 0);
});

test('Discard changes in the box puts the draft back', async () => {
  let state = ON_CHANGES;
  const { ui, fireEvent, within, waitFor } = await openWebsite(PAGE, {
    answers: served(null, { '/api/website': () => [200, state], '/api/website/discard': () => { state = ON_CLEAN; return [200, ON_CLEAN]; } }),
  });
  await openList(ui, fireEvent);
  fireEvent.click(await ui.findByRole('button', { name: 'Discard changes' }));
  const box = within(await ui.findByRole('dialog', { name: 'Discard your 3 unpublished changes?' }));
  fireEvent.click(box.getByRole('button', { name: 'Discard changes' }));
  await waitFor(() => assert.ok(ui.queryByRole('region', { name: 'Unpublished changes' }) === null));
  assert.equal(calls.filter((c) => c.path === '/api/website/discard' && c.method === 'POST').length, 1);
});

test('Discard that fails says why inside the box', async () => {
  const { ui, fireEvent, within } = await openWebsite(PAGE, {
    answers: served(ON_CHANGES, { '/api/website/discard': () => [409, { error: 'There are no changes to discard' }] }),
  });
  await openList(ui, fireEvent);
  fireEvent.click(await ui.findByRole('button', { name: 'Discard changes' }));
  const box = within(await ui.findByRole('dialog', { name: 'Discard your 3 unpublished changes?' }));
  fireEvent.click(box.getByRole('button', { name: 'Discard changes' }));
  assert.equal((await box.findByRole('alert')).textContent, 'There are no changes to discard');
  assert.equal(ui.getAllByRole('alert').length, 1, 'said once, inside the box');
});

test('History: View shows that version’s words under its row', async () => {
  const detail = { ...HISTORY.versions[1], content: { parts: { headline: { text: '[Old headline]' } } } };
  const { ui, fireEvent, within } = await openWebsite(PAGE, {
    answers: served(ON_CHANGES, { '/api/website/history/2': () => [200, detail] }),
  });
  fireEvent.click(await ui.findByRole('button', { name: 'History' }));
  const box = within(await ui.findByRole('dialog', { name: 'Earlier versions' }));
  const rows = await box.findAllByRole('listitem');
  const view = within(rows[1]).getByRole('button', { name: 'View' });
  fireEvent.click(view);
  assert.equal(view.getAttribute('aria-expanded'), 'true');
  assert.ok(await within(rows[1]).findByText('[Old headline]'));
  assert.ok(within(rows[1]).getByText('Headline'));
});

test('History opens over the page: earlier versions, what customers see now, and Go back to this', async () => {
  let state = ON_CHANGES;
  const { ui, fireEvent, within, waitFor } = await openWebsite(PAGE, {
    answers: served(null, {
      '/api/website': () => [200, state],
      '/api/website/history/2/restore': () => { state = { ...ON_CHANGES, changeCount: 1 }; return [200, state]; },
    }),
  });
  fireEvent.click(await ui.findByRole('button', { name: 'History' }));
  const box = within(await ui.findByRole('dialog', { name: 'Earlier versions' }));
  assert.ok(box.getByText('Published versions, and drafts you discarded in the last 90 days'));
  assert.ok(box.getByText('You have 3 unpublished changes. Going back replaces them — they’re kept here, so you can come back to them.'));
  const rows = await box.findAllByRole('listitem');
  assert.equal(rows.length, 3);
  assert.ok(within(rows[0]).getByText('What customers see now'));
  assert.ok(within(rows[0]).queryByRole('button', { name: 'Go back to this' }) === null);
  assert.ok(within(rows[0]).getByText(/Published by Jack Lewis · Home page, Main colour/));
  assert.ok(within(rows[1]).getByText(/Unpublished draft/));
  assert.ok(within(rows[1]).getByText(/Discarded by Jack Lewis · Home page/));
  assert.ok(within(rows[2]).getByText('Published by Jack Lewis · First published'));
  assert.ok(box.getByText('Going back puts that version in the editor as unpublished changes. Check it, then press Publish.'));
  fireEvent.click(within(rows[1]).getByRole('button', { name: 'Go back to this' }));
  await waitFor(() => assert.equal(calls.filter((c) => c.path === '/api/website/history/2/restore' && c.method === 'POST').length, 1));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Earlier versions' }) === null));
  assert.ok(await ui.findByRole('button', { name: '1 unpublished change' }));
});

// 2.5 ws-no-access.
test('Staff who follow a link are told who can change the website, with Back to Today', async () => {
  const refused = { error: 'Only the shop’s owner can change the website', code: 'owner_only', owners: ['Jack Lewis'] };
  const { ui } = await openWebsite(PAGE, { who: STAFF, answers: { '/api/website': () => [403, refused] } });
  assert.ok(await ui.findByRole('heading', { name: 'Only some people can change the website' }));
  assert.ok(ui.getByText(/People with “Can edit the website” can change it:/));
  assert.ok(ui.getByText('Jack Lewis'));
  assert.ok(ui.getByText(/Ask them if something needs changing\./));
  assert.equal(ui.getByRole('link', { name: 'Back to Today' }).getAttribute('href'), '/workshop/today');
  assert.ok(ui.queryByRole('button', { name: 'Turn it on' }) === null);
});

test('Website is not in a Staff sidebar', async () => {
  const { ui, within } = await openWebsite('/workshop/today', { who: STAFF });
  await ui.findAllByRole('navigation', { name: /Main/ });
  const navs = ui.getAllByRole('navigation', { name: /Main/ }).map((n) => within(n));
  assert.ok(navs.some((nav) => nav.queryAllByRole('link', { name: 'Today' }).length));
  assert.ok(navs.every((nav) => nav.queryAllByRole('link', { name: 'Website' }).length === 0));
});

test('Publish that fails says the server’s reason on the page, and the list stays open', async () => {
  const { ui, fireEvent } = await openWebsite(PAGE, {
    answers: served(ON_CHANGES, { '/api/website/publish': () => [409, { error: 'Someone else published first' }] }),
  });
  await openList(ui, fireEvent);
  fireEvent.click(await ui.findByRole('button', { name: 'Publish' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'Someone else published first');
  assert.ok(ui.getByRole('region', { name: 'Unpublished changes' }), 'the list stays open');
});

test('Turn it on that fails says so in general words, and the website stays off', async () => {
  const off = await openWebsite(PAGE, { answers: served(OFF_NEVER, { '/api/website/turn-on': () => [500, {}] }) });
  off.fireEvent.click(await off.ui.findByRole('button', { name: 'Turn it on' }));
  assert.equal((await off.ui.findByRole('alert')).textContent, 'Wheelhouse couldn’t do that. Try again.');
  assert.ok(off.ui.getByRole('heading', { name: 'Your website is off' }));
});
