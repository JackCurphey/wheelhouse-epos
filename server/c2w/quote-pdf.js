// The Cycle to Work quote, as the screen shows it and as a PDF to go with its
// emails (openspec/changes/message-attachments, design 4–7; cw-quote,
// cw-quote-revised, cw-email, cw-email-certificate-revised). The PDF is the
// paper version of QuoteDoc (src/screens/c2w/quote-page.tsx): black on white,
// A4 and Helvetica (neither is drawn; logged as defaults). Made with pdfkit.
// Inside the shop's runWithShop.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { prepare } from '../db.js';
import { UPLOADS_DIR } from '../lib/uploads.js';
import { pounds } from '../lib/customer-money.js';
import { ORDER_SELECT, longDate, quoteClosing, quoteItems, quoteRef } from './orders.js';

/** What the printed quote shows (cw-quote), or null when there's no such order. */
export async function quoteFor(orderId) {
  if (!Number.isInteger(orderId)) return null;
  const row = await prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(orderId);
  if (!row) return null;
  const shop = await prepare(`SELECT s.name, s.address, s.phone, s.email, s.vat_number, ss.logo_url
    FROM shops s LEFT JOIN storefront_settings ss ON ss.shop_id = s.id WHERE s.id = current_setting('app.current_shop_id')::int`).get();
  const settings = (await prepare('SELECT order_rule, how_to_apply FROM c2w_settings').get()) ?? {};
  const tz = (await prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';
  const day = (t) => (t ? new Date(t).toLocaleDateString('en-CA', { timeZone: tz }) : null);
  // cw-quote-revised: the latest change, and whether the quote has been emailed since,
  // on its own or with the certificate that changed the order to match (cw-certificate:
  // "The revised quote goes to Maya with the “Certificate received” email").
  const change = await prepare(`SELECT e.detail->>'what' AS what, e.detail->>'at' AS at, EXISTS (SELECT 1 FROM c2w_order_events m
    WHERE m.order_id = e.order_id AND m.id > e.id
      AND m.kind IN ('quote_emailed', 'revised_quote_sent')) AS sent
    FROM c2w_order_events e WHERE e.order_id = ? AND e.kind = 'changed' ORDER BY e.id DESC LIMIT 1`).get(row.id);
  return {
    shop: { name: shop.name, address: shop.address, phone: shop.phone, email: shop.email, vatNumber: shop.vat_number, logoUrl: shop.logo_url ?? null },
    quoteRef: quoteRef(row.quote_number), givenOn: day(row.quote_given_at), revisedOn: day(row.quote_revised_at), validUntil: row.valid_until_day,
    customerName: row.customer_name, providerName: row.provider_name,
    revision: change ? { what: change.what, on: day(change.at), sent: change.sent } : null,
    items: quoteItems(row), totalPence: row.total_pence, closing: quoteClosing(row, settings.order_rule), howToApply: settings.how_to_apply ?? null,
  };
}

const UPLOADED = /^\/api\/uploaded-images\/([0-9a-f]{48})$/;
const isPng = (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * The shop's logo for the PDF: its own upload when that is a PNG or JPEG
 * (pdfkit can't hold a WebP). Anything else, or no file, gives null, and the
 * space is left empty: the screen's "LOGO" box would read as a missing mark on
 * a customer's file, and a made-up mark is never drawn.
 */
// A logo bigger than this is left out: the PDF goes in an email, and a shop's
// upload can be up to 5 MB (logged as a default).
export const LOGO_MAX_BYTES = 1024 * 1024;

export async function logoFor(url) {
  const key = typeof url === 'string' ? UPLOADED.exec(url)?.[1] : null;
  if (!key) return null;
  let bytes;
  try {
    bytes = await readFile(path.join(UPLOADS_DIR, key));
  } catch {
    return null;
  }
  if (bytes.length > LOGO_MAX_BYTES) return null;
  return isPng(bytes) || isJpeg(bytes) ? bytes : null;
}

const REGULAR = 'Helvetica';
const BOLD = 'Helvetica-Bold';

/** The quote as a PDF (a Buffer), laid out as the printed quote is. */
export function quotePdf(q, { logo = null } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `Cycle to Work quote ${q.quoteRef}`, Author: q.shop.name } });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const half = width / 2;
  const right = left + width;
  const top = doc.page.margins.top;

  // The shop, top left: logo, name, address · phone, VAT.
  let y = top;
  if (logo) {
    try {
      doc.image(logo, left, y, { fit: [40, 40] });
      y += 46;
    } catch {
      // A logo pdfkit can't read leaves the space empty.
    }
  }
  doc.font(BOLD).fontSize(13).text(q.shop.name, left, y, { width: half - 8 });
  doc.font(REGULAR).fontSize(10);
  const reach = [q.shop.address, q.shop.phone].filter(Boolean).join(' · ');
  if (reach) doc.text(reach, { width: half - 8 });
  if (q.shop.vatNumber) doc.text(`VAT ${q.shop.vatNumber}`, { width: half - 8 });
  const leftEnd = doc.y;

  // The quote, top right: title, number, given or revised, valid until.
  const box = { width: half, align: 'right' };
  doc.font(BOLD).fontSize(15).text('Cycle to Work quote', left + half, top, box);
  doc.font(REGULAR).fontSize(10).text(`Quote number ${q.quoteRef}`, box);
  if (q.revisedOn) doc.font(BOLD).text(`Revised ${longDate(q.revisedOn)}`, box);
  else doc.font(REGULAR).text(`Given ${longDate(q.givenOn)}`, box);
  doc.font(BOLD).text(`Valid until ${longDate(q.validUntil)}`, box);
  y = Math.max(leftEnd, doc.y) + 20;

  // Who it's for.
  doc.font(REGULAR).fontSize(10).text('For ', left, y, { continued: true, width });
  doc.font(BOLD).text(q.customerName, { continued: true });
  doc.font(REGULAR).text(' · scheme provider ', { continued: true });
  doc.font(BOLD).text(q.providerName);
  y = doc.y + 16;

  // The items, each with its price, then the total.
  const priceWidth = 110;
  const nameWidth = width - priceWidth - 12;
  doc.font(REGULAR).fontSize(9).text('Item', left, y, { width: nameWidth });
  doc.text('Price', right - priceWidth, y, { width: priceWidth, align: 'right' });
  y = doc.y + 6;
  const row = (name, pence, bold, rule) => {
    if (y > doc.page.height - doc.page.margins.bottom - 60) {
      doc.addPage();
      y = top;
    }
    doc.moveTo(left, y).lineTo(right, y).lineWidth(rule).stroke();
    y += 7;
    doc.font(bold ? BOLD : REGULAR).fontSize(10);
    const h = doc.heightOfString(name, { width: nameWidth });
    doc.text(name, left, y, { width: nameWidth });
    doc.text(pounds(pence), right - priceWidth, y, { width: priceWidth, align: 'right' });
    y += h + 7;
  };
  for (const it of q.items) row(it.name, it.pricePence, false, 0.5);
  row('Total (includes VAT)', q.totalPence, true, 1.5);
  y += 12;

  // The closing paragraph, and how to apply.
  doc.font(REGULAR).fontSize(10).text(q.closing, left, y, { width, lineGap: 2 });
  if (q.howToApply) {
    doc.moveDown(0.8);
    doc.font(BOLD).text('How to apply:', left, doc.y, { width, lineGap: 2, continued: true });
    doc.font(REGULAR).text(` ${q.howToApply}`);
  }
  doc.end();
  return done;
}

/**
 * The quote as an email attachment: "Quote [quote number].pdf", or "Revised
 * quote [quote number].pdf" (the drawn chips). Made now, so the customer gets
 * the quote as it was when it was sent (design 6). Null when there's no order.
 */
export async function quoteAttachment(orderId, { revised = false } = {}) {
  const q = await quoteFor(orderId);
  return q ? quoteFile(q, { revised }) : null;
}

// Made through this, so a test can make it fail.
export const pdf = { make: quotePdf };

/** quoteAttachment for a quote already read (quoteFor); no database work. */
export async function quoteFile(q, { revised = false } = {}) {
  const content = await pdf.make(q, { logo: await logoFor(q.shop.logoUrl) });
  return { filename: `${revised ? 'Revised quote' : 'Quote'} ${q.quoteRef}.pdf`, contentType: 'application/pdf', content };
}

/**
 * The revised quote for the certificate's message (design 7): one file, or none
 * when there's no such order or the PDF can't be made. The order is read
 * outside the try, so a database error still fails the save; a PDF that can't
 * be made is logged and left off, and the certificate saves.
 */
export async function revisedQuoteFiles(orderId) {
  const q = await quoteFor(orderId);
  if (!q) return [];
  try {
    return [await quoteFile(q, { revised: true })];
  } catch (err) {
    console.error(`Cycle to Work: order ${orderId}'s revised quote PDF couldn't be made, so it went without one:`, err.message);
    return [];
  }
}
