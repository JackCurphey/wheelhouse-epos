/**
 * Where the customer website is (openspec/changes/website-browse, design 1).
 *
 * The same app answers at /store/<slug>/… and on the shop's own address,
 * <slug>.<base domain>/…. `base` is '/store/<slug>' in the first case and ''
 * in the second: the router's basename, and the start of every /api/site
 * address. `slug` names the shop for the booking app's links (/book/<slug>),
 * which live outside the website. On the shop's own address the slug is the
 * first part of the host name, or ?storefrontSlug= where the server reads it
 * in its place (server/storefront.js).
 */
export type SiteAddress = { base: string; slug: string; storefrontSlug: string | null };

/** The slug as written, when its escapes don't decode: no shop has it, and the page says so (wb-off). */
function decoded(part: string): string {
  try { return decodeURIComponent(part); } catch { return part; }
}

export function siteAddress(location: { pathname: string; search: string; hostname: string } = window.location): SiteAddress {
  const store = /^\/store\/([^/]+)/.exec(location.pathname);
  if (store) return { base: `/store/${store[1]}`, slug: decoded(store[1]), storefrontSlug: null };
  const storefrontSlug = new URLSearchParams(location.search).get('storefrontSlug');
  return { base: '', slug: storefrontSlug ?? location.hostname.split('.')[0] ?? '', storefrontSlug };
}

/**
 * An /api/site address for this shop, e.g. apiPath(address, '/api/site/home', { shop: '1' }).
 * URLSearchParams carry a key more than once (several ticks of one filter).
 */
export function apiPath(address: SiteAddress, path: string, params: Record<string, string | null | undefined> | URLSearchParams = {}): string {
  const search = new URLSearchParams();
  const entries = params instanceof URLSearchParams ? [...params] : Object.entries(params);
  for (const [key, value] of entries) if (value != null && value !== '') search.append(key, value);
  if (address.storefrontSlug) search.set('storefrontSlug', address.storefrontSlug);
  const query = search.toString();
  return `${address.base}${path}${query ? `?${query}` : ''}`;
}

/** The booking app for this shop, with the chosen shop when there are several (design 1). */
export function bookPath(address: SiteAddress, siteId: number | null): string {
  return `/book/${encodeURIComponent(address.slug)}${siteId != null ? `?site=${siteId}` : ''}`;
}

/**
 * The shop the visitor collects from: the `wh_shop` cookie (design 4), a
 * site id, or null when there is none. The caller ignores an id the business
 * has no shop for. The chip's "Which shop will you collect from?" and a
 * shop's Collect from here set it (rememberChosenShop).
 */
export function chosenShopCookie(cookie: string = document.cookie): number | null {
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== 'wh_shop') continue;
    const id = Number(rest.join('='));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  return null;
}

/** A year, in seconds: how long the chosen shop is remembered (design 4). */
const YEAR = 365 * 24 * 60 * 60;

/**
 * The wh_shop cookie as written: the site id for a year, SameSite=Lax, for
 * this shop's address only (its /store/<slug> path, or the whole of its own
 * address), Secure over https. Not HttpOnly: the page reads it itself. It is
 * needed to show stock, so it asks no consent (design 4).
 */
export function chosenShopCookieText(id: number, address: SiteAddress, secure: boolean): string {
  return `wh_shop=${id}; Max-Age=${YEAR}; Path=${address.base || '/'}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function rememberChosenShop(id: number, address: SiteAddress): void {
  document.cookie = chosenShopCookieText(id, address, window.location.protocol === 'https:');
}
