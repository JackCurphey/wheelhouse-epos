// The Website page's answers, in the shapes server/website.js sends
// (websiteState, history). tests/website.test.js proves the server sends
// them; the screen tests prove the screen reads them
// (openspec/changes/website-management, pull request 2).
export { OWNER, STAFF, openReports as openWebsite, closeReports as closeWebsite, calls } from './reports-screen.js';

const PART_LIST = [
  ['headline', 'Headline', 'Home page', { text: '[Headline]' }],
  ['about_line', 'A line about the shop', 'Home page', { text: '[A line about the shop]' }],
  ['big_photo', 'The big photo', 'Home page', { photo: null, description: '', decoration: false }],
  ['workshop_words', 'The workshop’s words', 'About us', { text: '[The workshop’s words]' }],
  ['shop_words', 'The shop’s own words and photo', 'About us', { text: '[The shop’s own words]', photo: null, description: '', decoration: false }],
  ['collection_returns', 'Collection and returns', 'Collection and returns', { text: '[Collection and returns]' }],
  ['privacy', 'Privacy', 'Privacy', { text: '[Privacy]' }],
];

/** The seven parts; the ones named in `unchecked` still hold their starting wording. */
export const parts = (unchecked = ['collection_returns', 'privacy']) =>
  PART_LIST.map(([key, name, page, fields]) => ({ key, name, page, ...fields, checked: !unchecked.includes(key) }));

// Set up, off, never published: ws-page.
export const OFF_NEVER = {
  kind: 'wheelhouse', setUp: true, isOn: false, neverPublished: true,
  publishedAt: null, publishedBy: null, keepDays: 90,
  changes: [], changeCount: 0, photosWithoutDescription: 0,
  savedBy: 'Jack Lewis', savedAt: '2026-09-17T09:12:00Z',
  parts: parts(), partsToCheck: ['Collection and returns', 'Privacy'], ready: false,
  logo: null, mainColour: '#2b2b2b', tracking: [],
  productCounts: { goOnline: 212, noPhoto: 14, noPrice: 3 },
  address: 'north-street.wheelhouseepos.com',
};

// On, with three unpublished changes: ws-page-on and ws-page-changes.
export const ON_CHANGES = {
  ...OFF_NEVER, isOn: true, neverPublished: false,
  publishedAt: '2026-09-14T16:00:00Z', publishedBy: 'Jack Lewis',
  changes: [{ page: 'Home page', parts: ['Headline', 'The big photo'] }, { page: 'Collection and returns', parts: ['Collection and returns'] }],
  changeCount: 3, photosWithoutDescription: 1,
};

// On, published, nothing changed since.
export const ON_CLEAN = { ...ON_CHANGES, changes: [], changeCount: 0, photosWithoutDescription: 0 };

// Off, published before, with changes: publishing keeps it off.
export const OFF_CHANGES = { ...ON_CHANGES, isOn: false };

export const HISTORY = {
  keepDays: 90, changeCount: 3,
  versions: [
    { id: 3, kind: 'published', changed: ['Home page', 'Main colour'], by: 'Jack Lewis', at: '2026-09-14T16:00:00Z', current: true, firstPublished: false },
    { id: 2, kind: 'discarded', changed: ['Home page'], by: 'Jack Lewis', at: '2026-09-12T11:30:00Z', current: false, firstPublished: false },
    { id: 1, kind: 'published', changed: [], by: 'Jack Lewis', at: '2026-09-10T10:00:00Z', current: false, firstPublished: true },
  ],
};

// Not set up yet: the three-step start (ws-start-which, ws-start-look,
// ws-start-products). startCounts are what "Every product online" would give.
export const NOT_SET_UP = {
  ...OFF_NEVER, kind: null, setUp: false, mainColour: null, savedBy: null, savedAt: null,
  startCounts: { goOnline: 212, noPhoto: 14, noPrice: 3 },
};
