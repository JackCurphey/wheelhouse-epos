// GET/PUT /api/workshop-settings had no HTTP coverage at all before this
// file. The settings added here are the per-shop configuration the
// booking-mode work depends on; every one of them has a default chosen so
// that an existing shop behaves exactly as it did before the migration.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

test('a new shop defaults to timed booking, so nothing changes for existing shops', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings');
    assert.equal(status, 200);
    assert.equal(body.bookingMode, 'timed');
    assert.equal(body.unspecifiedJobMinutes, 60);
    assert.equal(body.timedLeadMinutes, 30);
    assert.equal(body.showPricesOnline, false);
    assert.equal(body.dropoffWindowStart, '09:00');
    assert.equal(body.dropoffWindowEnd, '10:00');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a shop can switch to drop-off mode and set its window', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { bookingMode: 'dropoff', dropoffWindowStart: '08:00', dropoffWindowEnd: '09:30' },
    });
    assert.equal(status, 200);
    assert.equal(body.bookingMode, 'dropoff');
    assert.equal(body.dropoffWindowStart, '08:00');
    assert.equal(body.dropoffWindowEnd, '09:30');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an unknown booking mode is refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { bookingMode: 'whenever' },
    });
    assert.equal(status, 400);
    assert.match(body.error, /timed|drop/i);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a drop-off window that ends before it starts is refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { dropoffWindowStart: '10:00', dropoffWindowEnd: '09:00' },
    });
    assert.equal(status, 400);
    assert.match(body.error, /after/i);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('price visibility can be turned on, and comes back as a boolean', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { showPricesOnline: true },
    });
    assert.equal(body.showPricesOnline, true, 'must be a boolean, not 1 - the client renders it directly');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the not-sure duration must be a sensible number of minutes', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { unspecifiedJobMinutes: 0 },
    });
    assert.equal(status, 400);
    assert.match(body.error, /minutes/i);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('settings not named in a PUT are left alone', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT', body: { bookingMode: 'dropoff' },
    });
    const { body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT', body: { showPricesOnline: true },
    });
    assert.equal(body.bookingMode, 'dropoff', 'a later PUT wiped an earlier setting');
    assert.equal(body.openingTime, '09:00', 'a later PUT wiped the opening time');
    assert.equal(body.dropoffWindowStart, '09:00', 'a later PUT wiped the drop-off window start');
    assert.equal(body.dropoffWindowEnd, '10:00', 'a later PUT wiped the drop-off window end');
    assert.equal(body.timedLeadMinutes, 30, 'a later PUT wiped the arrival lead time');
    assert.equal(body.unspecifiedJobMinutes, 60, 'a later PUT wiped the not-sure duration');
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Piece 10: minimum notice and the shop's time zone.
// Spec: docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md
const putSettings = (cookie, body) => staffRequest(server.baseUrl, cookie, '/api/workshop-settings', { method: 'PUT', body });

test('a new shop has two hours of minimum notice, on UK time', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings');
    assert.equal(body.minNoticeMinutes, 120);
    assert.equal(body.timeZone, 'Europe/London');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('minimum notice and time zone are saved, and kept when a PUT leaves them out', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const saved = await putSettings(cookie, { minNoticeMinutes: 10080, timeZone: 'America/New_York' });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.minNoticeMinutes, 10080);
    assert.equal(saved.body.timeZone, 'America/New_York');
    const text = await putSettings(cookie, { minNoticeMinutes: '120' });
    assert.equal(text.status, 200, JSON.stringify(text.body));
    assert.equal(text.body.minNoticeMinutes, 120, 'a number sent as text, as the neighbouring fields accept');
    const zero = await putSettings(cookie, { minNoticeMinutes: 0 });
    assert.equal(zero.body.minNoticeMinutes, 0);
    assert.equal(zero.body.timeZone, 'America/New_York', 'an omitted time zone was changed');
    const other = await putSettings(cookie, { showPricesOnline: true });
    assert.equal(other.body.minNoticeMinutes, 0, 'an omitted minimum notice was changed');
    assert.equal(other.body.timeZone, 'America/New_York');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('minimum notice outside 0 minutes to 7 days, or not whole, is refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    for (const minNoticeMinutes of [-1, 10081, 1.5, 'abc', null]) {
      const res = await putSettings(cookie, { minNoticeMinutes });
      assert.equal(res.status, 400, `${JSON.stringify(minNoticeMinutes)} was accepted`);
      assert.equal(res.body.error, 'Minimum notice must be between 0 minutes and 7 days');
    }
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a time zone the server does not recognise is refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    for (const timeZone of ['Mars/Olympus_Mons', '', 42, null]) {
      const res = await putSettings(cookie, { timeZone });
      assert.equal(res.status, 400, `${JSON.stringify(timeZone)} was accepted`);
      assert.equal(res.body.error, "That time zone isn't recognised");
    }
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Piece 11: booking terms.
// Spec: docs/superpowers/specs/2026-09-26-book-server-11-terms-design.md
test('a new shop has no terms of its own', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings');
    assert.equal(body.bookingTerms, null);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('booking terms are saved, kept when a PUT leaves them out, and reverted by null or blank', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const saved = await putSettings(cookie, { bookingTerms: '  Our own terms.  ' });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.bookingTerms, 'Our own terms.', 'not trimmed');

    const kept = await putSettings(cookie, { showPricesOnline: true });
    assert.equal(kept.body.bookingTerms, 'Our own terms.', 'an omitted bookingTerms was changed');

    const blanked = await putSettings(cookie, { bookingTerms: '   ' });
    assert.equal(blanked.status, 200, JSON.stringify(blanked.body));
    assert.equal(blanked.body.bookingTerms, null, 'a blank string did not revert to standard');

    await putSettings(cookie, { bookingTerms: 'Our own terms again.' });
    const nulled = await putSettings(cookie, { bookingTerms: null });
    assert.equal(nulled.status, 200, JSON.stringify(nulled.body));
    assert.equal(nulled.body.bookingTerms, null, 'null did not revert to standard');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('booking terms over 20,000 characters are refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const res = await putSettings(cookie, { bookingTerms: 'x'.repeat(20001) });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, 'Booking terms can be up to 20,000 characters');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('booking terms that are not text or null are refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    for (const bookingTerms of [42, true, ['a']]) {
      const res = await putSettings(cookie, { bookingTerms });
      assert.equal(res.status, 400, `${JSON.stringify(bookingTerms)} was accepted`);
      assert.equal(res.body.error, 'Booking terms must be text');
    }
  } finally {
    await deleteTestShop(shop.id);
  }
});
