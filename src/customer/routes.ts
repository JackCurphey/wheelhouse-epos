/**
 * Screen design id -> URL for the customer app, served at every /book address
 * (server/server.js). pending is also the booking link the server issues
 * (server/booking-link.js linkPath), so a customer opening it cold lands here.
 *
 * Each journey plan adds its customer screens here and nowhere else. Keys must
 * be book-group ids in screen-index.json and paths must sit under /book
 * (tests/screens/customer-routes.test.js checks both).
 *
 * A .ts file, not .tsx: the tests load it straight into Node.
 * Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
 */
export const CUSTOMER_ROUTES = {
  service: '/book/:shopSlug',
  'service-list': '/book/:shopSlug/services',
  problem: '/book/:shopSlug/problem',
  date: '/book/:shopSlug/date',
  details: '/book/:shopSlug/details',
  pending: '/book/:shopSlug/booking/:code',
} as const;

export type CustomerScreenId = keyof typeof CUSTOMER_ROUTES;

/**
 * Use my phone's photo step (openspec/changes/use-my-phone): the page a code
 * opens on a member of staff's phone, with no sign-in. Under /book for the
 * shop's slug and look, but not one of the booking steps above, so it sits
 * apart from their table. The server's photoCodePath (server/booking-link.js)
 * gives the same address.
 */
export const PHOTO_STEP_ROUTE = '/book/:shopSlug/photo/:code';

/**
 * "Stop these" for service reminders (openspec/changes/stop-reminders): the
 * page a reminder's link opens, with no sign-in. The server's stopPath
 * (server/messaging/stop-codes.js) gives the same address.
 */
export const STOP_ROUTE = '/book/:shopSlug/stop/:code';

/**
 * Signing in by a code sent by email (openspec/changes/customer-signin-screens;
 * cust-signin, cust-code): the shop's sign-in page. Apart from the booking
 * steps, as the photo and stop pages are. `?from=` is where it returns to.
 */
export const SIGNIN_ROUTE = '/book/:shopSlug/sign-in';

/**
 * The customer's account (openspec/changes/customer-account-screens;
 * ac-account): her bikes, details and history, by her sign-in. Apart from the
 * booking steps, as the sign-in page is.
 */
export const ACCOUNT_ROUTE = '/book/:shopSlug/account';

/**
 * "Ask the shop a question" (openspec/changes/ask-the-shop-screens; ac-ask,
 * ac-account-question-sent, ac-question): the customer's one conversation with
 * the shop, by her sign-in. The shop's "Reply to a message" links here.
 */
export const MESSAGES_ROUTE = '/book/:shopSlug/messages';

/**
 * A service reminder's booking link (openspec/changes/finish-account design 4;
 * ac-reminder-landing): fills a booking from the reminder, with no sign-in.
 * The server's reminderBookPath (server/messaging/reminder-links.js) gives the
 * same address.
 */
export const REMINDER_BOOK_ROUTE = '/book/:shopSlug/from-reminder/:code';

/**
 * The shop's privacy notice (openspec/changes/finish-account design 7): the
 * Owner's own words, opened from the account's Your data. Apart from the
 * booking steps, as the account is.
 */
export const PRIVACY_ROUTE = '/book/:shopSlug/privacy';

/**
 * The customer's Cycle to Work page (openspec/changes/cycle-to-work design 8;
 * cw-customer-view): the order's private link from the messages, with no
 * sign-in. The server's c2wLinkPath (server/c2w/customer-view.js) gives the
 * same address.
 */
export const C2W_ROUTE = '/book/:shopSlug/cycle-to-work/:code';
/**
 * The same Cycle to Work order page, by the customer's sign-in, from her
 * account's history (ac-account-c2w; cycle-to-work PR 9d).
 */
export const C2W_ACCOUNT_ROUTE = '/book/:shopSlug/account/cycle-to-work/:id';
