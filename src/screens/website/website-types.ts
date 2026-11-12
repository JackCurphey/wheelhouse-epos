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

/** A tracking tool, as server/website-tracking.js `trackingList` sends it. */
export type Tool = {
  tool: string;
  name: string;
  kind: 'Statistics' | 'Marketing';
  idHelp: string;
  id: string;
  on: boolean;
  /** On, but its ID is missing or wrong: nothing loads until it is right. */
  waiting: boolean;
  idProblem: string | null;
};

/** The link to the shop's own Shopify shop, as server/shopify/link.js `linkState` sends it. */
export type ShopifyLink = {
  address: string;
  state: 'idle' | 'sending' | 'paused';
  total: number;
  sentCount: number;
  lastSentAt: string | null;
  products: number;
  problems: { productId: number | null; sku: string; name: string; kind: string; reason: string }[];
};

export type WebsiteState = {
  kind: 'wheelhouse' | 'shopify' | null;
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
  tracking: Tool[];
  productCounts: { goOnline: number; noPhoto: number; noPrice: number };
  /** Before set-up: what "Every product online" would give. */
  startCounts?: { goOnline: number; noPhoto: number; noPrice: number };
  address: string;
  /** Taking payments: the same state as Settings › Front desk › Online orders (design 6). */
  payments: { state: 'none' | 'failed' | 'connected' | 'tested' | 'more'; providerName: string | null; needsDetailsBy: string | null };
  /** Connected to Shopify (design 7), or null. */
  shopify?: ShopifyLink | null;
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
