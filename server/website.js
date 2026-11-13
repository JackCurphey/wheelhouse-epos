// The shop's website (openspec/changes/website-management, design 1 and 2):
// one row per shop with a draft (what the Owner is working on) and a published
// version (what customers see), History, Publish, Discard, and Turn it on or
// off. Every function runs inside the request's shop (runWithShop), so
// row-level security keeps each shop to its own row.
//
// The old website settings (storefront_settings) stay as they are and follow
// what is published, so the old customer site keeps working unchanged until
// it is replaced (design 1).
import { payments } from './payments/index.js';
import { paymentAccount, paymentsState } from './payments/provider.js';
import { dbExec, prepare } from './db.js';
import { getOrCreateStorefrontSettings, STOREFRONT_BASE_DOMAIN } from './storefront.js';
import { linkState } from './shopify/link.js';
import { liveTracking, savedTool, TOOL_BY_KEY, TRACKING_TOOLS, trackingList } from './website-tracking.js';

// History keeps 90 days (spec question 3, default taken:
// docs/decisions/2026-11-12-website-defaults-taken.md).
export const HISTORY_KEEP_DAYS = 90;
export const SOFT_SAND_CHARCOAL = '#2A2822';
const MAX_TEXT = 20000;
const MAX_SHORT = 500;

// The Words and photos rows on the Website page, in the drawing's order
// (website.mjs WORDS), and the page each one is on, for "Changes waiting".
export const PARTS = [
  { key: 'headline', name: 'Headline', page: 'Home page', fields: ['text'] },
  { key: 'about_line', name: 'A line about the shop', page: 'Home page', fields: ['text'] },
  { key: 'big_photo', name: 'The big photo', page: 'Home page', fields: ['photo', 'description', 'decoration'] },
  { key: 'workshop_words', name: 'The workshop’s words', page: 'About us', fields: ['text'] },
  { key: 'shop_words', name: 'The shop’s own words and photo', page: 'About us', fields: ['text', 'photo', 'description', 'decoration'] },
  { key: 'collection_returns', name: 'Collection and returns', page: 'Collection and returns', fields: ['text'] },
  { key: 'privacy', name: 'Privacy', page: 'Privacy', fields: ['text'] },
];
const PART_BY_KEY = new Map(PARTS.map((p) => [p.key, p]));
const PAGE_ORDER = ['Home page', 'About us', 'Collection and returns', 'Privacy', 'Every page', 'Tracking tools'];
export const PHOTO_PARTS = PARTS.filter((p) => p.fields.includes('photo')).map((p) => p.key);

// Starting wording is headings and bracketed gaps, so nothing invented goes
// out under a shop's name (spec question 1, default taken). Both start
// unchecked: the Website page says "Check this" until each is saved once.
const COLLECTION_RETURNS_START = [
  'Collecting your order',
  '[How long customers have to collect an order]',
  '[What customers need to bring]',
  '',
  'Returns',
  '[How many days customers have to return something]',
  '[What can and can’t be returned]',
  '[How refunds are paid]',
].join('\n');
const PRIVACY_START = [
  'Who we are',
  '[The shop’s name and address]',
  '',
  'What we keep about you and why',
  '[What the shop keeps, for example your name, email and bike details]',
  '',
  'How long we keep it',
  '[How long the shop keeps it]',
  '',
  'Your rights',
  '[How to ask for a copy of your details, or for them to be removed]',
].join('\n');

export class WebsiteError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function seedContent(shopName, settings) {
  return {
    parts: {
      headline: { text: shopName || '', checked: true },
      about_line: { text: settings?.tagline || '', checked: true },
      big_photo: { photo: settings?.hero_image_url || null, description: '', decoration: false, checked: true },
      workshop_words: { text: '', checked: true },
      shop_words: { text: settings?.description || '', photo: null, description: '', decoration: false, checked: true },
      collection_returns: { text: COLLECTION_RETURNS_START, checked: false },
      privacy: { text: PRIVACY_START, checked: false },
    },
    logo: settings?.logo_url || null,
    main_colour: SOFT_SAND_CHARCOAL,
    tracking: [],
  };
}

const currentShop = () => prepare("SELECT id, name, slug FROM shops WHERE id = current_setting('app.current_shop_id')::int").get();

// The shop's website row, made the first time it is asked for. A shop whose
// old website is already on starts on and published with the same words, so
// its customers see no change (design 1).
export async function getOrCreateWebsite() {
  const row = await prepare('SELECT * FROM website').get();
  if (row) return row;
  const shop = await currentShop();
  const settings = await prepare('SELECT * FROM storefront_settings LIMIT 1').get();
  const content = seedContent(shop?.name, settings);
  const live = !!settings?.enabled;
  await dbExec('BEGIN');
  try {
    const made = await prepare(
      `INSERT INTO website (draft, kind, set_up_at, is_on, published, published_at)
       VALUES (?::jsonb, ?, ?, ?, ?::jsonb, ?)
       ON CONFLICT (shop_id) DO NOTHING RETURNING shop_id`
    ).get(JSON.stringify(content), live ? 'wheelhouse' : null, live ? new Date().toISOString() : null, live,
      live ? JSON.stringify(content) : null, live ? new Date().toISOString() : null);
    if (made && live) {
      const version = await prepare(
        "INSERT INTO website_versions (kind, content, changed, first_published) VALUES ('published', ?::jsonb, '{}', true)"
      ).run(JSON.stringify(content));
      await prepare('UPDATE website SET live_version_id = ?').run(version.lastInsertRowid);
    }
    await dbExec('COMMIT');
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
  return prepare('SELECT * FROM website').get();
}

const lockWebsite = async () => {
  await getOrCreateWebsite();
  return prepare('SELECT * FROM website FOR UPDATE').get();
};

async function inTransaction(fn) {
  await dbExec('BEGIN');
  try {
    const result = await fn();
    await dbExec('COMMIT');
    return result;
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}

// What a part says, without its "checked" mark: saving the same words again
// isn't a change customers would see.
function partValue(content, key) {
  const { checked, ...rest } = content?.parts?.[key] || {};
  void checked;
  return JSON.stringify(PART_BY_KEY.get(key).fields.map((f) => rest[f] ?? null));
}

// Only what customers' browsers would load counts as a change: a tool
// waiting for a right ID changes nothing they see.
function validTracking(content) {
  return JSON.stringify(liveTracking(content));
}

// The changes saved since the last publish, part by part, grouped by page in
// the order the Website page lists them. Before the first publish there is
// nothing to compare with, so there are none (design 2).
export function changesBetween(draft, published) {
  if (!published) return [];
  const byPage = new Map();
  const add = (page, name) => byPage.set(page, [...(byPage.get(page) || []), name]);
  for (const part of PARTS) if (partValue(draft, part.key) !== partValue(published, part.key)) add(part.page, part.name);
  if ((draft.logo ?? null) !== (published.logo ?? null)) add('Every page', 'Logo');
  if ((draft.main_colour ?? null) !== (published.main_colour ?? null)) add('Every page', 'Main colour');
  if (validTracking(draft) !== validTracking(published)) add('Tracking tools', 'Tracking tools');
  return PAGE_ORDER.filter((p) => byPage.has(p)).map((page) => ({ page, parts: byPage.get(page) }));
}
const changedNames = (changes) => changes.flatMap((c) => c.parts);
// What a History row names (ws-history: "Home page, Theme colour"): the page
// for a part on one page, and the part itself for one on every page.
const historyNames = (changes) => [...new Set(changes.flatMap((c) => (c.page === 'Every page' || c.page === 'Tracking tools' ? c.parts : [c.page])))];

export function photosWithoutDescription(content) {
  return PHOTO_PARTS.filter((key) => {
    const part = content?.parts?.[key];
    return part?.photo && !String(part.description || '').trim() && !part.decoration;
  }).length;
}

async function loginNames(ids) {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (!wanted.length) return new Map();
  const rows = await prepare('SELECT id, name FROM logins WHERE id = ANY(?::int[])').all(wanted);
  return new Map(rows.map((r) => [r.id, r.name]));
}

// Step 3's counts (ws-start-products): what "Every product online" would
// give, whatever each product's switch says now.
async function startCounts() {
  const row = await prepare(
    `SELECT count(*) FILTER (WHERE price > 0) AS go_online,
            count(*) FILTER (WHERE price > 0 AND (photo_url IS NULL OR photo_url = '')) AS no_photo,
            count(*) FILTER (WHERE price = 0) AS no_price
     FROM products WHERE active = 1`
  ).get();
  return { goOnline: Number(row.go_online), noPhoto: Number(row.no_photo), noPrice: Number(row.no_price) };
}

async function productCounts() {
  const row = await prepare(
    // ws-page counts: an unpriced product "stays off until priced", so it is
    // counted as having no price, not as going online.
    `SELECT count(*) FILTER (WHERE show_online AND price > 0) AS go_online,
            count(*) FILTER (WHERE show_online AND price > 0 AND (photo_url IS NULL OR photo_url = '')) AS no_photo,
            count(*) FILTER (WHERE show_online AND price = 0) AS no_price
     FROM products WHERE active = 1`
  ).get();
  return { goOnline: Number(row.go_online), noPhoto: Number(row.no_photo), noPrice: Number(row.no_price) };
}

// Everything the Website page shows (design 2).
export async function websiteState(row = null) {
  const website = row || await getOrCreateWebsite();
  const shop = await currentShop();
  const draft = website.draft;
  const changes = changesBetween(draft, website.published);
  const names = await loginNames([website.draft_saved_by, website.published_by]);
  const parts = PARTS.map((p) => ({ key: p.key, name: p.name, page: p.page, ...draft.parts?.[p.key], checked: !!draft.parts?.[p.key]?.checked }));
  const partsToCheck = parts.filter((p) => !p.checked).map((p) => p.name);
  const account = await paymentAccount();
  return {
    kind: website.kind,
    setUp: !!website.kind,
    isOn: website.is_on,
    neverPublished: !website.published,
    publishedAt: website.published_at,
    // null for a site that was already live on the old website (decision 14).
    publishedBy: names.get(website.published_by) || null,
    keepDays: HISTORY_KEEP_DAYS,
    changes,
    changeCount: changedNames(changes).length,
    photosWithoutDescription: photosWithoutDescription(draft),
    savedBy: names.get(website.draft_saved_by) || null,
    savedAt: website.draft_saved_at,
    parts,
    partsToCheck,
    ready: !!website.kind && partsToCheck.length === 0,
    logo: draft.logo ?? null,
    mainColour: draft.main_colour || SOFT_SAND_CHARCOAL,
    tracking: trackingList(draft),
    productCounts: await productCounts(),
    ...(website.kind ? {} : { startCounts: await startCounts() }),
    address: `${shop.slug}.${STOREFRONT_BASE_DOMAIN}`,
    // The Taking payments row: the same state as Settings › Online orders (design 6).
    payments: { state: paymentsState(account), providerName: payments()?.displayName ?? null, needsDetailsBy: account?.status === 'needs_details' ? account.needs_details_by ?? null : null },
    // Connected to the shop's own Shopify (design 7), or null.
    shopify: await linkState(),
  };
}

function cleanPartPatch(key, body, uploaded) {
  const part = PART_BY_KEY.get(key);
  if (!part) throw new WebsiteError(404, 'There is no such part of the website');
  if (!body || typeof body !== 'object') throw new WebsiteError(400, 'Nothing to save');
  const patch = {};
  for (const field of part.fields) {
    if (body[field] === undefined) continue;
    const value = body[field];
    if (field === 'decoration') {
      if (typeof value !== 'boolean') throw new WebsiteError(400, 'Decoration is yes or no');
      patch.decoration = value;
    } else if (field === 'photo') {
      // A photo is set only by uploading it; saving the part can only take it away.
      if (value !== null && !uploaded) throw new WebsiteError(400, 'Add a photo by uploading it');
      if (value !== null && (typeof value !== 'string' || value.length > MAX_SHORT)) throw new WebsiteError(400, 'That photo can’t be used');
      patch.photo = value || null;
    } else {
      const max = field === 'description' ? MAX_SHORT : MAX_TEXT;
      if (typeof value !== 'string') throw new WebsiteError(400, 'Words must be text');
      if (value.length > max) throw new WebsiteError(400, `That’s too long: up to ${max} characters`);
      patch[field] = value;
    }
  }
  return patch;
}

// Saving one part changes the draft only and marks the part checked. One
// statement merges the part in, so two parts saved at once both stay (design 1).
export async function savePart(key, body, loginId, uploaded = false) {
  const patch = cleanPartPatch(key, body, uploaded);
  await getOrCreateWebsite();
  await prepare(
    `UPDATE website SET draft = jsonb_set(draft, ARRAY['parts', ?::text], coalesce(draft->'parts'->?::text, '{}'::jsonb) || ?::jsonb),
       draft_saved_by = ?, draft_saved_at = now(), updated_at = now()`
  ).run(key, key, JSON.stringify({ ...patch, checked: true }), loginId);
  return websiteState();
}

// A new photo for the big photo or the shop's own photo. Its description and
// decoration tick start again, because they were about the old photo.
export async function savePartPhoto(key, url, loginId) {
  if (!PHOTO_PARTS.includes(key)) throw new WebsiteError(404, 'That part has no photo');
  return savePart(key, { photo: url, description: '', decoration: false }, loginId, true);
}

export async function saveLogo(url, loginId) {
  await getOrCreateWebsite();
  await prepare(
    "UPDATE website SET draft = jsonb_set(draft, '{logo}', to_jsonb(?::text)), draft_saved_by = ?, draft_saved_at = now(), updated_at = now()"
  ).run(url, loginId);
  return websiteState();
}

// The old website settings follow what is published, so the old customer
// site and anything else reading them sees the published words.
async function mirrorToOldSettings(content, isOn) {
  await getOrCreateStorefrontSettings();
  await prepare(
    `UPDATE storefront_settings SET enabled = ?, tagline = ?, description = ?, logo_url = ?, hero_image_url = ?, updated_at = now()`
  ).run(isOn, content.parts.about_line?.text || null, content.parts.shop_words?.text || null, content.logo || null, content.parts.big_photo?.photo || null);
}

async function publishLocked(website, loginId) {
  const first = !website.published;
  const changes = changesBetween(website.draft, website.published);
  if (!first && !changes.length) throw new WebsiteError(409, 'There are no changes to publish');
  const version = await prepare(
    "INSERT INTO website_versions (kind, content, changed, made_by, first_published) VALUES ('published', ?::jsonb, ?::text[], ?, ?)"
  ).run(JSON.stringify(website.draft), historyNames(changes), loginId, first);
  await prepare(
    'UPDATE website SET published = draft, published_at = now(), published_by = ?, live_version_id = ?, updated_at = now()'
  ).run(loginId, version.lastInsertRowid);
  await mirrorToOldSettings(website.draft, website.is_on);
}

async function cleanUpHistory() {
  await prepare(
    `DELETE FROM website_versions WHERE made_at < now() - make_interval(days => ?)
       AND id IS DISTINCT FROM (SELECT live_version_id FROM website)`
  ).run(HISTORY_KEEP_DAYS);
}

export async function publish(loginId) {
  await inTransaction(async () => publishLocked(await lockWebsite(), loginId));
  await cleanUpHistory();
  return websiteState();
}

// The first Turn it on also publishes the website as it is (design 2).
export async function turnOn(loginId) {
  // Made first: making it commits on its own, which would end this transaction
  // early. The staff banner can turn on a shop that has no row yet.
  await getOrCreateWebsite();
  await inTransaction(async () => {
    const website = await lockWebsite();
    if (website.kind === 'shopify') throw new WebsiteError(409, 'Your website is your Shopify shop');
    if (!website.published) await publishLocked(website, loginId);
    await prepare('UPDATE website SET is_on = true, updated_at = now()').run();
    await getOrCreateStorefrontSettings();
    await prepare('UPDATE storefront_settings SET enabled = true, updated_at = now()').run();
  });
  return websiteState();
}

export async function turnOff() {
  await getOrCreateWebsite();
  await inTransaction(async () => {
    await lockWebsite();
    await prepare('UPDATE website SET is_on = false, updated_at = now()').run();
    await getOrCreateStorefrontSettings();
    await prepare('UPDATE storefront_settings SET enabled = false, updated_at = now()').run();
  });
  return websiteState();
}

// Shopify connected, or Wheelhouse's website instead (design 7): either way
// Wheelhouse's own website is off until the Owner turns it on. `alongside`
// saves the Shopify link in the same transaction.
export async function chooseWebsiteKind(kind, alongside) {
  // Made first: making it commits on its own, which would end this transaction early.
  await getOrCreateWebsite();
  await inTransaction(async () => {
    await lockWebsite();
    await prepare('UPDATE website SET kind = ?, set_up_at = COALESCE(set_up_at, now()), is_on = false, updated_at = now()').run(kind);
    await getOrCreateStorefrontSettings();
    await prepare('UPDATE storefront_settings SET enabled = false, updated_at = now()').run();
    await alongside();
  });
}

async function keepDraftInHistory(website, loginId) {
  const changes = changesBetween(website.draft, website.published);
  if (!changes.length) return false;
  await prepare(
    "INSERT INTO website_versions (kind, content, changed, made_by) VALUES ('discarded', ?::jsonb, ?::text[], ?)"
  ).run(JSON.stringify(website.draft), historyNames(changes), loginId);
  return true;
}

// The published version with the "checked" marks of parts the draft has the
// same words for: a page checked without changing it stays checked.
function keepChecked(published, draft) {
  const parts = { ...published.parts };
  for (const { key } of PARTS) {
    if (draft.parts?.[key]?.checked && parts[key] && partValue(draft, key) === partValue(published, key)) parts[key] = { ...parts[key], checked: true };
  }
  return { ...published, parts };
}

// Discard keeps the draft in History and puts the published version back.
export async function discard(loginId) {
  await inTransaction(async () => {
    const website = await lockWebsite();
    if (!website.published) throw new WebsiteError(409, 'Nothing has been published yet, so there is nothing to go back to');
    if (!await keepDraftInHistory(website, loginId)) throw new WebsiteError(409, 'There are no changes to discard');
    await prepare('UPDATE website SET draft = ?::jsonb, draft_saved_by = ?, draft_saved_at = now(), updated_at = now()')
      .run(JSON.stringify(keepChecked(website.published, website.draft)), loginId);
  });
  await cleanUpHistory();
  return websiteState();
}

// Going back puts that version in the editor as unpublished changes. Any
// changes not yet published are kept in History first (design 2).
export async function restore(versionId, loginId) {
  if (!Number.isInteger(versionId) || versionId < 1) throw new WebsiteError(404, 'That version isn’t in History');
  await inTransaction(async () => {
    const website = await lockWebsite();
    const version = await prepare('SELECT content FROM website_versions WHERE id = ?').get(versionId);
    if (!version) throw new WebsiteError(404, 'That version isn’t in History');
    await keepDraftInHistory(website, loginId);
    await prepare('UPDATE website SET draft = ?::jsonb, draft_saved_by = ?, draft_saved_at = now(), updated_at = now()')
      .run(JSON.stringify(version.content), loginId);
  });
  await cleanUpHistory();
  return websiteState();
}

export async function history() {
  await cleanUpHistory();
  const website = await getOrCreateWebsite();
  const rows = await prepare('SELECT id, kind, changed, made_by, made_at, first_published FROM website_versions ORDER BY made_at DESC, id DESC').all();
  const names = await loginNames(rows.map((r) => r.made_by));
  return {
    keepDays: HISTORY_KEEP_DAYS,
    changeCount: changedNames(changesBetween(website.draft, website.published)).length,
    versions: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      changed: r.changed,
      by: names.get(r.made_by) || null,
      at: r.made_at,
      current: r.id === website.live_version_id,
      firstPublished: r.first_published,
    })),
  };
}

// One version, for History's View (ws-history).
export async function historyVersion(versionId) {
  const row = Number.isInteger(versionId) && versionId > 0
    ? await prepare('SELECT id, kind, content, changed, made_by, made_at, first_published FROM website_versions WHERE id = ?').get(versionId)
    : null;
  if (!row) throw new WebsiteError(404, 'That version isn’t in History');
  const names = await loginNames([row.made_by]);
  return {
    id: row.id, kind: row.kind, content: row.content, changed: row.changed,
    by: names.get(row.made_by) || null, at: row.made_at, firstPublished: row.first_published,
  };
}

// The names of the shop's Owners, for "Ask [Owner]" when someone else opens
// the Website page (ws-no-access). logins has no row-level security, so the
// shop is named here, as in server/team.js.
export async function ownerNames(shopId) {
  return (await prepare('SELECT name FROM logins WHERE is_owner AND active AND shop_id = ? ORDER BY id').all(shopId)).map((r) => r.name);
}

// Once the Website page is in use, the old Settings route and uploads are
// refused: they could neither turn the site off nor change what customers see.
export async function websiteInUse() {
  return !!(await prepare('SELECT 1 AS yes FROM website').get());
}

// ---------- Set-up and the main colour (design 4) ----------

const HEX = /^#[0-9a-f]{6}$/i;
const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

/** The standard contrast of white text on a colour, from 1 to 21. */
export function contrastWithWhite(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/** Why a main colour can't be used, or null when white text on it is easy to read (at least 4.5 to 1). */
export function colourProblem(colour) {
  if (typeof colour !== 'string' || !HEX.test(colour)) return 'Choose a colour';
  return contrastWithWhite(colour) >= 4.5 ? null : 'That colour would make text hard to read. Choose a darker one.';
}

function checkColour(colour) {
  const problem = colourProblem(colour);
  if (problem) throw new WebsiteError(400, problem);
  return colour.toUpperCase();
}

// The three steps' answers, once only (ws-start-which, -look, -products).
// Shopify is set up by connecting it (pull request 6b).
export async function setUp(body, loginId) {
  if (body?.kind !== 'wheelhouse') throw new WebsiteError(400, 'Choose Wheelhouse’s website');
  if (!['every', 'nothing'].includes(body.startWith)) throw new WebsiteError(400, 'Choose every product online, or nothing');
  const colour = checkColour(body.mainColour);
  await getOrCreateWebsite();
  return inTransaction(async () => {
    const website = await prepare('SELECT * FROM website FOR UPDATE').get();
    if (website.kind) throw new WebsiteError(409, 'The website is already set up');
    // Every product online: active ones with a price; one with no price stays
    // off until priced. Nothing online: every product off, inactive ones too.
    await prepare('UPDATE products SET show_online = (? AND price > 0 AND active = 1)').run(body.startWith === 'every');
    await prepare(
      `UPDATE website SET kind = 'wheelhouse', set_up_at = now(), draft = jsonb_set(draft, '{main_colour}', to_jsonb(?::text)),
              draft_saved_by = ?, draft_saved_at = now(), updated_at = now()`
    ).run(colour, loginId);
    return websiteState(await prepare('SELECT * FROM website').get());
  });
}

export async function saveColour(colour, loginId) {
  const checked = checkColour(colour);
  await getOrCreateWebsite();
  const saved = await prepare(
    "UPDATE website SET draft = jsonb_set(draft, '{main_colour}', to_jsonb(?::text)), draft_saved_by = ?, draft_saved_at = now(), updated_at = now() WHERE kind IS NOT NULL"
  ).run(checked, loginId);
  // Before set-up the colour is chosen in the three steps, and sent with them.
  if (!saved.changes) throw new WebsiteError(409, 'Set up the website first');
  return websiteState();
}

const MAX_TRACKING_ID = 64;

// Switching a tool on or off, or changing its ID, changes the draft only. A
// wrong ID is kept so the shop can correct it; off keeps the ID (design 5).
export async function saveTracking(key, body, loginId) {
  const tool = TOOL_BY_KEY.get(key);
  if (!tool) throw new WebsiteError(404, 'There is no such tracking tool');
  if (typeof body?.on !== 'boolean') throw new WebsiteError(400, 'Say whether the tool is on or off');
  if (body.id !== undefined && typeof body.id !== 'string') throw new WebsiteError(400, 'The ID must be text');
  const id = body.id === undefined ? undefined : body.id.trim();
  if (id !== undefined && id.length > MAX_TRACKING_ID) throw new WebsiteError(400, `That’s too long for an ID: up to ${MAX_TRACKING_ID} characters`);
  return inTransaction(async () => {
    const website = await lockWebsite();
    if (!website.kind) throw new WebsiteError(409, 'Set up the website first');
    const others = (website.draft.tracking || []).filter((t) => t.tool !== key);
    const entry = { tool: key, id: id ?? savedTool(website.draft, key)?.id ?? '', on: body.on };
    const tracking = TRACKING_TOOLS.map((t) => (t.key === key ? entry : others.find((o) => o.tool === t.key))).filter(Boolean);
    await prepare(
      "UPDATE website SET draft = jsonb_set(draft, '{tracking}', ?::jsonb), draft_saved_by = ?, draft_saved_at = now(), updated_at = now()"
    ).run(JSON.stringify(tracking), loginId);
    return websiteState(await prepare('SELECT * FROM website').get());
  });
}
