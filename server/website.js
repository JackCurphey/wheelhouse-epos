// The shop's website (openspec/changes/website-management, design 1 and 2):
// one row per shop with a draft (what the Owner is working on) and a published
// version (what customers see), History, Publish, Discard, and Turn it on or
// off. Every function runs inside the request's shop (runWithShop), so
// row-level security keeps each shop to its own row.
//
// The old website settings (storefront_settings) stay as they are and follow
// what is published, so the old customer site keeps working unchanged until
// it is replaced (design 1).
import { dbExec, prepare } from './db.js';
import { getOrCreateStorefrontSettings, STOREFRONT_BASE_DOMAIN } from './storefront.js';

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

function validTracking(content) {
  return JSON.stringify((content?.tracking || []).map((t) => [t.tool, t.id, !!t.on]));
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

async function productCounts() {
  const row = await prepare(
    `SELECT count(*) FILTER (WHERE show_online) AS go_online,
            count(*) FILTER (WHERE show_online AND (photo_url IS NULL OR photo_url = '')) AS no_photo,
            count(*) FILTER (WHERE price = 0) AS no_price
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
  const names = await loginNames([website.draft_saved_by]);
  const parts = PARTS.map((p) => ({ key: p.key, name: p.name, page: p.page, ...draft.parts?.[p.key], checked: !!draft.parts?.[p.key]?.checked }));
  const partsToCheck = parts.filter((p) => !p.checked).map((p) => p.name);
  return {
    kind: website.kind,
    setUp: !!website.kind,
    isOn: website.is_on,
    neverPublished: !website.published,
    publishedAt: website.published_at,
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
    tracking: draft.tracking || [],
    productCounts: await productCounts(),
    address: `${shop.slug}.${STOREFRONT_BASE_DOMAIN}`,
  };
}

function cleanPartPatch(key, body) {
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
export async function savePart(key, body, loginId) {
  const patch = cleanPartPatch(key, body);
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
  return savePart(key, { photo: url, description: '', decoration: false }, loginId);
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
  ).run(JSON.stringify(website.draft), changedNames(changes), loginId, first);
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
  await inTransaction(async () => {
    const website = await lockWebsite();
    if (!website.published) await publishLocked(website, loginId);
    await prepare('UPDATE website SET is_on = true, updated_at = now()').run();
    await getOrCreateStorefrontSettings();
    await prepare('UPDATE storefront_settings SET enabled = true, updated_at = now()').run();
  });
  return websiteState();
}

export async function turnOff() {
  await inTransaction(async () => {
    await lockWebsite();
    await prepare('UPDATE website SET is_on = false, updated_at = now()').run();
    await getOrCreateStorefrontSettings();
    await prepare('UPDATE storefront_settings SET enabled = false, updated_at = now()').run();
  });
  return websiteState();
}

async function keepDraftInHistory(website, loginId) {
  const changes = changesBetween(website.draft, website.published);
  if (!changes.length) return false;
  await prepare(
    "INSERT INTO website_versions (kind, content, changed, made_by) VALUES ('discarded', ?::jsonb, ?::text[], ?)"
  ).run(JSON.stringify(website.draft), changedNames(changes), loginId);
  return true;
}

// Discard keeps the draft in History and puts the published version back.
export async function discard(loginId) {
  await inTransaction(async () => {
    const website = await lockWebsite();
    if (!website.published) throw new WebsiteError(409, 'Nothing has been published yet, so there is nothing to go back to');
    if (!await keepDraftInHistory(website, loginId)) throw new WebsiteError(409, 'There are no changes to discard');
    await prepare('UPDATE website SET draft = published, draft_saved_by = ?, draft_saved_at = now(), updated_at = now()').run(loginId);
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

// The names of the shop's Owners, for "Ask [Owner]" when someone else opens
// the Website page (ws-no-access).
export async function ownerNames() {
  return (await prepare('SELECT name FROM logins WHERE is_owner AND active ORDER BY id').all()).map((r) => r.name);
}

// What the customer site shows: the published version only (design 1).
// null when the shop has no website row yet (the old settings still apply).
export async function publishedWebsite() {
  return prepare('SELECT is_on, published FROM website').get();
}
