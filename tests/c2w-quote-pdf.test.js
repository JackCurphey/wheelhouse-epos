// The Cycle to Work quote goes with its emails as a PDF
// (openspec/changes/message-attachments; cw-email and
// cw-email-certificate-revised draw "Attached: Quote [n]"). The PDF is the
// paper version of the printed quote (cw-quote, cw-quote-revised). The drawings
// leave prices bracketed, so the numbers here are made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedProduct } from './helpers/till.js';
import { quotePdf, logoFor, pdf, revisedQuoteFiles, LOGO_MAX_BYTES } from '../server/c2w/quote-pdf.js';
import { UPLOADS_DIR } from '../server/lib/uploads.js';

let server;
let owner;
let provider;
let maya;
let site;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);
const written = [];

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30, howToApply: '[How to apply]' } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
});
after(async () => {
  for (const f of written) await rm(f, { force: true });
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

/** The text a PDF shows, one line per text run, read from its (deflated) content streams. */
function pdfText(buf) {
  const raw = buf.toString('latin1');
  const lines = [];
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (let m = streams.exec(raw); m; m = streams.exec(raw)) {
    let body;
    try {
      body = inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    const runs = /\[((?:<[0-9a-fA-F]*>|[\s\d.-])*)\]\s*TJ/g;
    for (let r = runs.exec(body); r; r = runs.exec(body)) {
      const hex = [...r[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1]).join('');
      lines.push(new TextDecoder('windows-1252').decode(Buffer.from(hex, 'hex')));
    }
  }
  return lines.join(' ').replace(/\s+/g, ' ');
}
const hasImage = (buf) => /\/Subtype\s*\/Image/.test(buf.toString('latin1'));
// A 1×1 PNG: the smallest real logo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const QUOTE = {
  shop: { name: 'North Street Cycles', address: '[Shop address]', phone: '[Shop phone]', vatNumber: '[VAT number]', logoUrl: null },
  quoteRef: 'Q-1042', givenOn: '2026-09-01', revisedOn: null, validUntil: '2026-10-01', customerName: 'Maya Patel', providerName: '[Provider]',
  items: [{ productId: 1, name: '[Bike] · [Size]', pricePence: 100000 }, { productId: 2, name: '[Accessory]', pricePence: 5000 }],
  totalPence: 105000, closing: 'We’re holding your bike until 8 September 2026. This quote is valid until 1 October 2026. Once your certificate reaches us, it’s yours to collect.',
  howToApply: '[How to apply]',
};

test('the PDF lays out the printed quote: shop, title, number, dates, who it is for, items, total, closing and how to apply', async () => {
  const pdf = await quotePdf(QUOTE);
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from('%PDF-')), 'a PDF file');
  const text = pdfText(pdf);
  for (const line of [
    'North Street Cycles', '[Shop address] · [Shop phone]', 'VAT [VAT number]',
    'Cycle to Work quote', 'Quote number Q-1042', 'Given 1 September 2026', 'Valid until 1 October 2026',
    'For Maya Patel · scheme provider [Provider]', 'Item', 'Price', '[Bike] · [Size]', '£1,000.00', '[Accessory]', '£50.00',
    'Total (includes VAT)', '£1,050.00', QUOTE.closing, 'How to apply: [How to apply]',
  ]) assert.ok(text.includes(line), `shows “${line}” in: ${text}`);
  assert.ok(!text.includes('Revised'), 'not revised');
  assert.ok(!text.includes('LOGO'), 'no placeholder mark on a customer’s file');
  assert.equal(hasImage(pdf), false, 'no logo when the shop has none');
});

test('a revised quote says Revised and its date instead of Given; no address, phone, VAT or how-to-apply leaves those lines out', async () => {
  const text = pdfText(await quotePdf({ ...QUOTE, revisedOn: '2026-09-05', howToApply: null, shop: { ...QUOTE.shop, address: null, phone: null, vatNumber: null } }));
  assert.ok(text.includes('Revised 5 September 2026'), text);
  assert.ok(!text.includes('Given'), text);
  assert.ok(!text.includes('VAT ['), text);
  assert.ok(!text.includes('How to apply'), text);
  assert.ok(!text.includes(' · [Shop'), text);
});

test('the shop’s uploaded PNG or JPEG logo goes in; a WebP, a logo held elsewhere or a missing file leaves the space empty', async () => {
  const upload = async (bytes) => {
    const key = randomBytes(24).toString('hex');
    const file = path.join(UPLOADS_DIR, key);
    await writeFile(file, bytes);
    written.push(file);
    return `/api/uploaded-images/${key}`;
  };
  const png = await logoFor(await upload(PNG));
  assert.ok(png && png.equals(PNG), 'the PNG is read');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
  assert.ok((await logoFor(await upload(jpeg)))?.equals(jpeg), 'a JPEG is read');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
  assert.equal(await logoFor(await upload(webp)), null, 'pdfkit can’t hold a WebP');
  assert.equal(await logoFor('https://example.test/logo.png'), null, 'held elsewhere');
  assert.equal(await logoFor('/api/uploaded-images/../../package.json'), null, 'only an upload’s own name');
  assert.equal(await logoFor(`/api/uploaded-images/${randomBytes(24).toString('hex')}`), null, 'a missing file');
  assert.equal(await logoFor(null), null);
  const big = Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES)]);
  assert.ok((await logoFor(await upload(big))) === null, 'a logo too big for an email is left out');
  assert.equal(hasImage(await quotePdf(QUOTE, { logo: PNG })), true, 'the logo is drawn');
});

async function framedBike(price = '1000.00') {
  const id = await seedProduct(owner.shop.id, { name: `[Bike ${tag()}] · [Size]`, price, stock: 1 });
  await inShop(async () => {
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(site, id, 1);
    const key = `[FRAME-${tag()}]`;
    await prepare('INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, ?, ?) RETURNING id').get(id, site, key, key);
  });
  return id;
}
const accessory = (price) => seedProduct(owner.shop.id, { name: `[Accessory ${tag()}]`, price, stock: 5 });
const quote = async (productId, body = {}) => {
  const r = await own('/api/c2w/orders', { method: 'POST', body: { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [], ...body } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.order;
};
const certify = (id, body) => own(`/api/c2w/orders/${id}/certificate`, { method: 'POST', body: { number: '[certificate number]', ...body } });
const lastMessage = (customerId, keys) => inShop(async () => prepare(
  `SELECT id, channel, template_key FROM customer_messages WHERE customer_id = ? AND template_key = ANY(?::text[]) ORDER BY id DESC LIMIT 1`,
).get(customerId, keys));
const filesOf = (messageId) => inShop(async () => prepare(
  'SELECT filename, content_type, content FROM customer_message_attachments WHERE message_id = ? ORDER BY id',
).all(messageId));
const quoteSent = (orderId) => inShop(async () => (await prepare(
  "SELECT EXISTS (SELECT 1 FROM c2w_order_events WHERE order_id = ? AND kind = 'revised_quote_sent') AS sent",
).get(orderId)).sent);

test('Email the quote attaches “Quote [quote number].pdf”, the quote as the screen shows it', async () => {
  const o = await quote(await framedBike('1000.00'), { accessoryIds: [await accessory('50.00')] });
  const sent = await own(`/api/c2w/orders/${o.id}/email-quote`, { method: 'POST', body: {} });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const msg = await lastMessage(maya.id, ['c2w_quote']);
  const files = await filesOf(msg.id);
  assert.deepEqual(files.map((f) => [f.filename, f.content_type]), [[`Quote ${o.quoteRef}.pdf`, 'application/pdf']]);
  const text = pdfText(files[0].content);
  const shown = (await own(`/api/c2w/orders/${o.id}/quote`)).body.quote;
  for (const line of [`Quote number ${o.quoteRef}`, 'For Maya Patel · scheme provider [Provider]', shown.items[0].name, 'Total (includes VAT)', '£1,050.00', shown.closing, 'How to apply: [How to apply]']) {
    assert.ok(text.includes(line), `shows “${line}” in: ${text}`);
  }
});

test('“Certificate received” after a change to match carries “Revised quote [quote number].pdf” with the new total', async () => {
  const extra = await accessory('50.00');
  const o = await quote(await framedBike('1000.00'), { accessoryIds: [extra] });
  const r = await certify(o.id, { amountPence: 100000, difference: 'match', accessoryIds: [] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const msg = await lastMessage(maya.id, ['c2w_certificate', 'c2w_certificate_less', 'c2w_ready']);
  assert.equal(msg.channel, 'email');
  const files = await filesOf(msg.id);
  assert.deepEqual(files.map((f) => [f.filename, f.content_type]), [[`Revised quote ${o.quoteRef}.pdf`, 'application/pdf']]);
  const text = pdfText(files[0].content);
  assert.ok(text.includes('Revised 1 September 2026'), text);
  assert.ok(text.includes('£1,000.00') && !text.includes('£1,050.00'), `the new total only: ${text}`);
  assert.equal(await quoteSent(o.id), true, 'the revised quote went');
});

test('a certificate that matches, or one kept for more, sends no quote; a text customer gets no file', async () => {
  const exact = await quote(await framedBike('1000.00'));
  assert.equal((await certify(exact.id, { amountPence: 100000 })).status, 200);
  const m1 = await lastMessage(maya.id, ['c2w_certificate', 'c2w_certificate_less', 'c2w_ready']);
  assert.equal((await filesOf(m1.id)).length, 0, 'matches: nothing changed, no quote');

  const kept = await quote(await framedBike('1000.00'), { accessoryIds: [await accessory('50.00')] });
  assert.equal((await certify(kept.id, { amountPence: 100000, difference: 'keep' })).status, 200);
  const m2 = await lastMessage(maya.id, ['c2w_certificate', 'c2w_certificate_less', 'c2w_ready']);
  assert.notEqual(m2.id, m1.id);
  assert.equal((await filesOf(m2.id)).length, 0, 'kept: the quote didn’t change');

  const sam = (await own('/api/customers', { method: 'POST', body: { name: 'Sam Okafor', phone: '07700 900321' } })).body;
  const texted = await quote(await framedBike('1000.00'), { customerId: sam.id, accessoryIds: [await accessory('50.00')] });
  assert.equal((await certify(texted.id, { amountPence: 100000, difference: 'match', accessoryIds: [] })).status, 200);
  const m3 = await lastMessage(sam.id, ['c2w_certificate', 'c2w_certificate_less', 'c2w_ready']);
  assert.equal(m3.channel, 'sms');
  assert.equal((await filesOf(m3.id)).length, 0, 'a text carries no file');
  // No quote went, so none is recorded as sent (it would clear cw-quote-revised's grey message).
  assert.equal(await quoteSent(texted.id), false, 'a text sends no quote');
});

test('a revised quote PDF that can’t be made is left off, so the certificate still saves', async () => {
  const o = await quote(await framedBike('1000.00'));
  const fine = await inShop(() => revisedQuoteFiles(o.id));
  assert.deepEqual(fine.map((f) => f.filename), [`Revised quote ${o.quoteRef}.pdf`]);
  const make = mock.method(pdf, 'make', () => Promise.reject(new Error('[pdf failure]')));
  const quiet = mock.method(console, 'error', () => {});
  try {
    assert.deepEqual(await inShop(() => revisedQuoteFiles(o.id)), []);
    assert.ok(quiet.mock.calls.some((c) => String(c.arguments.join(' ')).includes('[pdf failure]')), 'the failure is logged');
  } finally {
    make.mock.restore();
    quiet.mock.restore();
  }
  assert.deepEqual(await inShop(() => revisedQuoteFiles(-1)), [], 'no such order, no file');
});
