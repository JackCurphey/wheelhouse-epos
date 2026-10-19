// Shop settings: sticker labels (/api/label-settings) and the colour scheme (/api/shop-theme).
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare } from '../db.js';
import { badRequest, nowIso, readJsonBody, sendJson } from '../lib/http.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// The physical size of the label roll a shop's dedicated label printer
// takes. One row per shop, same singleton-per-shop pattern as
// workshop_settings; createShop() seeds a default row for new shops, but a
// shop created before this table existed won't have one - GET creates it
// lazily on first touch rather than needing a migration-time backfill
// (which would fight RLS, since a migration runs with no shop context set).

function serializeLabelSettings(row) {
  return { widthMm: Number(row.width_mm), heightMm: Number(row.height_mm), updatedAt: row.updated_at };
}

async function getOrCreateLabelSettings() {
  let row = await db.prepare('SELECT * FROM label_settings LIMIT 1').get();
  if (!row) {
    await db.prepare('INSERT INTO label_settings DEFAULT VALUES').run();
    row = await db.prepare('SELECT * FROM label_settings LIMIT 1').get();
  }
  return row;
}

// Which preset a shop has chosen (see public/app.js's THEME_PRESETS for what
// each key actually renders as - only the key is stored server-side). Same
// singleton-per-shop, lazy-create-on-GET pattern as label_settings above.
//
// Since 27 Sep 2026 the staff app always uses one look (Fjell, then Soft sand
// from 3 Oct) and no longer reads or writes this
// (docs/decisions/2026-09-27-fjell-theme.md). Kept, with its
// table, for the customer surfaces until the Release 2 website theme system
// decides what replaces it; the public website reads its own
// storefront_settings.theme_preset.

const SHOP_THEME_PRESETS = ['forest', 'ocean', 'sunset', 'slate', 'plum'];

function serializeShopTheme(row) {
  return { preset: row.preset, updatedAt: row.updated_at };
}

async function getOrCreateShopTheme() {
  let row = await db.prepare('SELECT * FROM shop_theme LIMIT 1').get();
  if (!row) {
    await db.prepare('INSERT INTO shop_theme DEFAULT VALUES').run();
    row = await db.prepare('SELECT * FROM shop_theme LIMIT 1').get();
  }
  return row;
}

// Shop details (Jack, 18 Oct, docs/decisions/2026-10-18-shop-details.md): one
// set for the whole business, for now, on the shops row (migration 042).
// shops is the tenant table, with no row security, so these read and write
// the session's own row by its id.
const SHOP_DETAIL_FIELDS = [
  ['name', 'name', 'Shop name', 120],
  ['address', 'address', 'Address', 300],
  ['phone', 'phone', 'Phone', 40],
  ['email', 'email', 'Email', 200],
  ['vatNumber', 'vat_number', 'VAT number', 30],
  // Words at the bottom of receipts (Jack, 19 Oct); line breaks kept.
  ['receiptFooter', 'receipt_footer', 'Words at the bottom', 500],
];
function serializeShopDetails(row) {
  return { name: row.name, address: row.address ?? null, phone: row.phone ?? null, email: row.email ?? null, vatNumber: row.vat_number ?? null, receiptFooter: row.receipt_footer ?? null };
}
const SHOP_DETAILS_SELECT = 'SELECT name, address, phone, email, vat_number, receipt_footer FROM shops WHERE id = ?';

export function register(route) {
  route('GET', '/api/shop-details', async (req, res, params, query, afterRelease, shopId) => {
    sendJson(res, 200, serializeShopDetails(await db.prepare(SHOP_DETAILS_SELECT).get(shopId)));
  });

  route('PUT', '/api/shop-details', async (req, res, params, query, afterRelease, shopId) => {
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(res, 'Send the shop’s details');
    const sets = [];
    const values = [];
    for (const [key, column, label, max] of SHOP_DETAIL_FIELDS) {
      if (body[key] === undefined) continue;
      if (body[key] !== null && typeof body[key] !== 'string') return badRequest(res, `${label} must be text`);
      const text = (body[key] ?? '').trim();
      if (key === 'name' && text === '') return badRequest(res, 'The shop needs a name');
      if (text.length > max) return badRequest(res, `${label} can be up to ${max} characters`);
      sets.push(`${column} = ?`);
      values.push(text === '' ? null : text);
    }
    // The column names come from SHOP_DETAIL_FIELDS above, never from the request.
    if (sets.length) await db.prepare(`UPDATE shops SET ${sets.join(', ')} WHERE id = ?`).run(...values, shopId);
    sendJson(res, 200, serializeShopDetails(await db.prepare(SHOP_DETAILS_SELECT).get(shopId)));
  });

  route('GET', '/api/label-settings', async (req, res) => {
    sendJson(res, 200, serializeLabelSettings(await getOrCreateLabelSettings()));
  });

  route('PUT', '/api/label-settings', async (req, res) => {
    const existing = await getOrCreateLabelSettings();
    const body = await readJsonBody(req);
    const widthMm = body.widthMm !== undefined ? Number(body.widthMm) : Number(existing.width_mm);
    const heightMm = body.heightMm !== undefined ? Number(body.heightMm) : Number(existing.height_mm);
    if (!Number.isFinite(widthMm) || widthMm < 10 || widthMm > 150 || !Number.isFinite(heightMm) || heightMm < 10 || heightMm > 150) {
      return badRequest(res, 'Label width and height must both be between 10mm and 150mm');
    }
    await db.prepare('UPDATE label_settings SET width_mm = ?, height_mm = ?, updated_at = ? WHERE id = ?').run(
      widthMm,
      heightMm,
      nowIso(),
      existing.id
    );
    sendJson(res, 200, serializeLabelSettings(await db.prepare('SELECT * FROM label_settings LIMIT 1').get()));
  });

  route('GET', '/api/shop-theme', async (req, res) => {
    sendJson(res, 200, serializeShopTheme(await getOrCreateShopTheme()));
  });

  route('PUT', '/api/shop-theme', async (req, res) => {
    const existing = await getOrCreateShopTheme();
    const body = await readJsonBody(req);
    const preset = String(body.preset || '');
    if (!SHOP_THEME_PRESETS.includes(preset)) {
      return badRequest(res, `preset must be one of: ${SHOP_THEME_PRESETS.join(', ')}`);
    }
    await db.prepare('UPDATE shop_theme SET preset = ?, updated_at = ? WHERE id = ?').run(preset, nowIso(), existing.id);
    sendJson(res, 200, serializeShopTheme(await db.prepare('SELECT * FROM shop_theme LIMIT 1').get()));
  });
}
