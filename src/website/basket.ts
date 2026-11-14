import type { SiteAddress } from './address.ts';

/**
 * The basket the browser keeps (openspec/changes/website-buy-online, design
 * 2, task 11.5): only which products and how many, in the wh_basket cookie,
 * written "101:2.102:1" for this shop's address. Every name, price and stock
 * line comes from POST /api/site/basket each time.
 */
export type BasketLine = { productId: number; qty: number };

// The server's own limits (server/online-orders/basket.js): a cookie past them isn't a customer's basket.
export const MOST_LINES = 50;
export const MOST_OF_ONE = 99;
const NAME = 'wh_basket';

/** The lines in wh_basket; a broken entry is skipped, so the rest still count. */
export function readBasket(cookie: string = document.cookie): BasketLine[] {
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== NAME) continue;
    const lines: BasketLine[] = [];
    for (const entry of rest.join('=').trim().split('.')) {
      const m = /^([1-9]\d{0,8}):([1-9]\d?)$/.exec(entry);
      if (!m || lines.some((l) => l.productId === Number(m[1]))) continue;
      lines.push({ productId: Number(m[1]), qty: Number(m[2]) });
      if (lines.length === MOST_LINES) break;
    }
    return lines;
  }
  return [];
}

/**
 * The cookie as written: for this shop's address only, kept until the
 * browser closes while its length is Jack's "[n] days" (decided while
 * building); an empty basket clears it.
 */
export function basketCookieText(lines: BasketLine[], address: Pick<SiteAddress, 'base'>, secure: boolean): string {
  const path = `Path=${address.base || '/'}; SameSite=Lax${secure ? '; Secure' : ''}`;
  if (!lines.length) return `${NAME}=; Max-Age=0; ${path}`;
  return `${NAME}=${lines.map((l) => `${l.productId}:${l.qty}`).join('.')}; ${path}`;
}

export function writeBasket(lines: BasketLine[], address: Pick<SiteAddress, 'base'>): void {
  document.cookie = basketCookieText(lines, address, window.location.protocol === 'https:');
}

/** `lines` with `qty` more of `productId` (up to 99), a new product at the end. */
export function addTo(lines: BasketLine[], productId: number, qty: number): BasketLine[] {
  const had = lines.find((l) => l.productId === productId);
  if (had) return lines.map((l) => (l === had ? { productId, qty: Math.min(MOST_OF_ONE, l.qty + qty) } : l));
  return lines.length >= MOST_LINES ? lines : [...lines, { productId, qty: Math.min(MOST_OF_ONE, qty) }];
}

/**
 * How many of `productId` adding `qty` really added: fewer at 99 of one
 * thing, none when the basket already holds 50 different things.
 */
export const addedBy = (before: BasketLine[], after: BasketLine[], productId: number) =>
  (after.find((l) => l.productId === productId)?.qty ?? 0) - (before.find((l) => l.productId === productId)?.qty ?? 0);

export const basketCount = (lines: BasketLine[]) => lines.reduce((n, l) => n + l.qty, 0);
