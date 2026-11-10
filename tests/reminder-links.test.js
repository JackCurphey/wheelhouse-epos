// A service reminder's booking link (openspec/changes/finish-account design 4;
// ac-reminder-landing; Jack, 9 Nov, answer 4; question 10): a code made with
// the reminder, only its hash kept, that fills the booking with the service,
// the bike and the customer's details partly hidden, and books for them when
// nothing is typed. Sending is pretend in every channel for now (isPretend), so
// a queued reminder still reads "[link]"; the link itself is made and checked
// through reminderBookLink, as the stop page's was (reminder-stop.test.js).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { reminderBookLink, maskedName, maskedPhone } from '../server/messaging/reminder-links.js';
import { serviceReminderNow, queueServiceReminder } from '../server/messaging/service-reminders.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let other;
let sam;
let types;

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
const inShop = (fn, who = owner) => runWithShop(who.shop.id, fn);
let ip = 0;
async function portal(path, { method = 'GET', body, shop = owner } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    method, headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${(++ip % 250) + 1}` }, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

// Maya Patel and her Trek, from the drawings; a code for her bike and the service.
async function mayaWithCode({ who = owner, serviceId = types.service } = {}) {
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.test' } }, who)).body;
  const bikeId = await inShop(async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model, colour) VALUES (?, 'Trek', 'Domane AL 3', 'green · black mudguards') RETURNING id").get(maya.id)).id, who);
  const link = await inShop(() => reminderBookLink('https://wh.test', who.shop.slug, { customerId: maya.id, bikeId, serviceId }), who);
  return { maya, bikeId, link, code: link.split('/').at(-1) };
}

test('reminderBookLink: /book/<shop>/from-reminder/<code>, only the code’s hash kept', async () => {
  const { maya, link, code } = await mayaWithCode();
  assert.match(link, new RegExp(`^https://wh\\.test/book/${owner.shop.slug}/from-reminder/[0-9a-f]{64}$`));
  const rows = await inShop(() => prepare('SELECT * FROM reminder_book_codes WHERE customer_id = ?').all(maya.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code_hash, createHash('sha256').update(code).digest('hex'));
  assert.ok(!JSON.stringify(rows).includes(code), 'the code itself is kept nowhere');
});

test('the masks: “Maya P.” and “07700 ••• 142”', () => {
  assert.equal(maskedName('Maya Patel'), 'Maya P.');
  assert.equal(maskedName('  maya   de souza '), 'maya S.');
  assert.equal(maskedName('Maya'), 'Maya');
  assert.equal(maskedName(''), null);
  assert.equal(maskedPhone('07700 900142'), '07700 ••• 142');
  assert.equal(maskedPhone('+44 7700 900142'), '44770 ••• 142');
  assert.equal(maskedPhone(null), null);
});

test('GET reminder-links/:code gives the service, the bike and the details partly hidden; nothing else of hers', async () => {
  const { bikeId, code } = await mayaWithCode();
  const res = await portal(`/reminder-links/${code}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    serviceId: types.service, serviceName: 'Test service', bikeId, bikeLabel: 'Trek Domane AL 3 · green · black mudguards',
    details: { name: 'Maya P.', phone: '07700 ••• 142' },
  });
  assert.ok(!JSON.stringify(res.body).includes('maya@example.test'));
});

test('a made-up code, or another shop’s, is not found', async () => {
  const elsewhere = await mayaWithCode({ who: other, serviceId: null });
  for (const path of [`/reminder-links/${'0'.repeat(64)}`, '/reminder-links/nope', `/reminder-links/${elsewhere.code}`]) {
    assert.equal((await portal(path)).status, 404, path);
  }
  assert.equal((await portal(`/reminder-links/${elsewhere.code}`, { shop: other })).status, 200);
});

test('a removed bike, or a service no longer booked online, comes back empty for that part (question 10)', async () => {
  const { bikeId, code } = await mayaWithCode({ serviceId: types.quick });
  await inShop(() => prepare('UPDATE customer_bikes SET active = 0 WHERE id = ?').run(bikeId));
  await inShop(() => prepare('UPDATE workshop_services SET bookable_online = 0 WHERE id = ?').run(types.quick));
  try {
    const res = await portal(`/reminder-links/${code}`);
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.serviceId, res.body.serviceName, res.body.bikeId, res.body.bikeLabel], [null, null, null, null]);
    assert.equal(res.body.details.name, 'Maya P.');
  } finally {
    await inShop(() => prepare('UPDATE workshop_services SET bookable_online = 1 WHERE id = ?').run(types.quick));
  }
});

let day = 0;
const nextDate = () => {
  const d = new Date(`${futureDate(1 + (day % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(day++ / 5));
  return d.toISOString().slice(0, 10);
};
const book = (body) => portal('/bookings', {
  method: 'POST',
  body: { mechanicId: sam, jobDate: nextDate(), startTime: '10:00', serviceIds: [types.service], ...BOOKING_CONTACT, ...body },
});

test('a booking with the reminder’s code and no details typed is made for her, with her bike', async () => {
  const { maya, bikeId, code } = await mayaWithCode();
  const res = await book({ reminderCode: code, bikeId });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const job = await inShop(() => prepare('SELECT customer_id, bike_id FROM workshop_jobs WHERE reference = ?').get(res.body.reference));
  assert.deepEqual([job.customer_id, job.bike_id], [maya.id, bikeId]);
});

test('a booking from the reminder keeps her record’s details: an email or choice typed in doesn’t change them (design 4)', async () => {
  const { maya, bikeId, code } = await mayaWithCode();
  const before = await inShop(() => prepare('SELECT email, email_from_customer, marketing_permission, update_channel FROM customers WHERE id = ?').get(maya.id));
  const res = await book({ reminderCode: code, bikeId, email: 'someone.else@example.test', marketingPermission: !before.marketing_permission });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const after = await inShop(() => prepare('SELECT email, email_from_customer, marketing_permission, update_channel FROM customers WHERE id = ?').get(maya.id));
  // Only a missing choice is filled in: she had no update channel yet.
  assert.deepEqual(after, { ...before, update_channel: before.update_channel ?? 'email' });
});

test('with details typed, the booking uses those, not the code’s customer', async () => {
  const { maya, code } = await mayaWithCode();
  const res = await book({ reminderCode: code, guestName: 'Sam Lee', guestPhone: '07700 900555', newBike: { make: 'Cube', model: 'Attain' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const job = await inShop(() => prepare('SELECT c.id, c.name FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id WHERE w.reference = ?').get(res.body.reference));
  assert.notEqual(job.id, maya.id);
  assert.equal(job.name, 'Sam Lee');
});

test('a code that doesn’t work is refused with the reminder’s words, and nothing is booked', async () => {
  const before = await inShop(async () => (await prepare('SELECT count(*)::int AS n FROM workshop_jobs').get()).n);
  const res = await book({ reminderCode: '0'.repeat(64) });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'This reminder’s link has expired. Choose your bike and service to book.');
  assert.equal(res.body.code, 'reminder_expired');
  assert.equal(await inShop(async () => (await prepare('SELECT count(*)::int AS n FROM workshop_jobs').get()).n), before);
});

test('merging records moves the codes with the customer', async () => {
  const { maya, code } = await mayaWithCode();
  const kept = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900143' } })).body;
  const merged = await staff(`/api/customers/${kept.id}/merge`, { method: 'POST', body: { otherId: maya.id, keep: { name: 'this' } } });
  assert.equal(merged.status, 200, JSON.stringify(merged.body));
  const res = await portal(`/reminder-links/${code}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.details.phone, '07700 ••• 143', 'the kept record’s details');
});

test('a reminder set up while sending is pretend reads [link] and makes no code', async () => {
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  const svc = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65, minutes: 60, kind: 'full', reminderMonths: 6 } })).body.id;
  const jobId = await inShop(async () => {
    await prepare("UPDATE customers SET service_reminders = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'booking' WHERE id = ?").run(maya.id);
    const bike = (await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Trek', 'Domane AL 3') RETURNING id").get(maya.id)).id;
    const job = (await prepare("INSERT INTO workshop_jobs (title, job_date, customer_id, bike_id, custody_state, collected_at, updated_at) VALUES ('Service', ?, ?, ?, 'collected', now(), now()) RETURNING id").get(futureDate(1), maya.id, bike)).id;
    await prepare('INSERT INTO workshop_job_services (workshop_job_id, service_id, position) VALUES (?, ?, 0)').run(job, svc);
    return job;
  });
  const queued = await inShop(() => queueServiceReminder(jobId, owner.shop.id, 'https://wh.test'));
  assert.ok(queued, 'queued');
  const msg = await inShop(() => prepare("SELECT body FROM customer_messages WHERE job_id = ? AND template_key = 'service_reminder'").get(jobId));
  assert.doesNotMatch(msg.body, /from-reminder/);
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM reminder_book_codes WHERE customer_id = ?').get(maya.id))).n, 0);

  // When it goes, the link made with it stays in its words (the words are written afresh then).
  const { link } = await (async () => ({ link: await inShop(() => reminderBookLink('https://wh.test', owner.shop.slug, { customerId: maya.id, jobId })) }))();
  const now = await inShop(() => serviceReminderNow({ job_id: jobId, body: `Hi Maya, book here:(${link}) Stop these: [link].`, ending: 'Stop these: [link].' }, owner.shop.id));
  assert.ok(now, 'still goes');
  assert.ok(now.body.includes(link), now.body);
  assert.ok(!now.body.includes(`(${link}`), 'only the link is carried, not what it was joined to');
});
