/**
 * Every cookie the customer website sets, in one list (openspec/changes/
 * website-browse, design 4): the Cookies page shows this list, and the code
 * that sets each cookie uses its name and length from here, so the page and
 * what is really set can't drift apart. A test checks it against the
 * server's own constants (tests/screens/site-cookies.test.js).
 *
 * The basket's cookie joins this list with WP-6.3 (Buy online).
 */
export type CookieLine = { name: string; purpose: string; seconds: number; length: string };

const DAY = 24 * 60 * 60;

/** Customer accounts' sign-in cookie (server/customer-auth.js). */
export const SIGNED_IN: CookieLine = { name: 'wh_customer_session', purpose: 'Keeps you signed in', seconds: 30 * DAY, length: '30 days' };
/** The chosen shop (design 4: the site id, 1 year). */
export const CHOSEN_SHOP: CookieLine = { name: 'wh_shop', purpose: 'Remembers the shop you collect from', seconds: 365 * DAY, length: '1 year' };
/** The visitor's cookie choices (design 4: 6 months), only for a shop with a tracking tool. */
export const COOKIE_CHOICES: CookieLine = { name: 'wh_cookies', purpose: 'Remembers your cookie choices', seconds: 180 * DAY, length: '6 months' };

export const COOKIES: CookieLine[] = [SIGNED_IN, CHOSEN_SHOP, COOKIE_CHOICES];

/** What this shop's website sets: the choices cookie only where there is something to choose. */
export const cookiesFor = (hasTools: boolean): CookieLine[] => (hasTools ? COOKIES : COOKIES.filter((c) => c !== COOKIE_CHOICES));
