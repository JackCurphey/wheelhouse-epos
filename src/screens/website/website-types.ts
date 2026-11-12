/** The Website page's state, as server/website.js `websiteState` sends it. */
export type Part = {
  key: string;
  name: string;
  page: string;
  text?: string;
  photo?: string | null;
  description?: string;
  decoration?: boolean;
  checked: boolean;
};

export type WebsiteState = {
  kind: 'wheelhouse' | 'shopify';
  setUp: boolean;
  isOn: boolean;
  neverPublished: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
  keepDays: number;
  changes: { page: string; parts: string[] }[];
  changeCount: number;
  photosWithoutDescription: number;
  savedBy: string | null;
  savedAt: string | null;
  parts: Part[];
  partsToCheck: string[];
  ready: boolean;
  logo: string | null;
  mainColour: string | null;
  tracking: { name: string }[];
  productCounts: { goOnline: number; noPhoto: number; noPrice: number };
  address: string;
};

export type Version = {
  id: number;
  kind: 'published' | 'discarded';
  changed: string[];
  by: string | null;
  at: string;
  current: boolean;
  firstPublished: boolean;
};

export type History = { keepDays: number; changeCount: number; versions: Version[] };

export type VersionDetail = Version & { content: Record<string, { text?: string; description?: string }> };

/** "3 unpublished changes", "1 photo". */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A change row's parts, leaving out a part named the same as its page (decision 17). */
export const changeWords = (c: { page: string; parts: string[] }) => c.parts.filter((p) => p !== c.page).join(', ');

/** The customer site until Wheelhouse's own website is built: the old
 * storefront at /store/<shop>/ (decided while building, 12 Nov). */
export const customerSite = (address: string) => `/store/${encodeURIComponent(address.split('.')[0])}/`;

/** "17 Sept, 10:12", in the shop's own time. */
export function when(iso: string | null) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));
}
