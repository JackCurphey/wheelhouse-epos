// Labels that go to the same place on every board: the staff sidebar and the
// till's rail (rooms: Front desk, Workshop, Stockroom, Office — App map 1, 2),
// the shop menu, Your settings, and the website's header.
import { go, STAY, notDrawn, outside } from '../controls.mjs';

export default {
  // Front desk
  // Today, Stock and Stock take open the page drawn for the role of the
  // screen they're on (third walk, walk-throughs 1 L2, 3 M1, 9 M2).
  Today: ({ role }) => go(/^Staff/.test(role) ? 'op-today-staff' : 'op-today'),
  Till: go('till-sale'),
  'Online orders': go('on-orders'),
  'Cycle to Work': go('cw-list'),
  Customers: go('cs-list'),
  Messages: go('ac-inbox'),
  // Workshop
  Diary: go('diary'),
  Overview: go('overview'),
  // Stockroom
  Stock: ({ role }) => go(/^Staff/.test(role) ? 'st-list-staff' : 'st-list'),
  'Deliveries and orders': go('rs-hub'),
  'Stock take': ({ role }) => go(/^Staff/.test(role) ? 'tk-hub-staff' : 'tk-hub'),
  // Office
  Reports: go('rp-home'),
  Website: go('ws-page'),
  Settings: go('set-till-quick'),
  // The shop menu, Your settings, signing out and checking out
  'Shop: Bolton. Choose a shop': go('ms-switch-open'),
  // Every shop label opens the shop menu (third walk, walk-through 7 L1).
  'Shop: [Second site]. Choose a shop': go('ms-switch-open'),
  'Shop: All shops. Choose a shop': go('ms-switch-open'),
  'Your settings — Jo Taylor, Staff': go('your-settings'),
  'Your settings — Jack Lewis, Owner': go('your-settings'),
  'Sign out': go('auth-signedout'),
  'Check out': go('till-checkin'),
  // The shop's website header
  'Book a repair': go('bk-service'),
  'Our shops': go('wb-shops'),
  'Your account': go('ac-account'),
  'LOGO North Street Cycles': go('wb-home'),
  'Search the shop': go('wb-search-typing'),
  // The website header's Shop opens Shop: every category (Find the shop: header links).
  Shop: go('wb-shop'),
  'Basket, 0 items': go('on-basket'),
  Cookies: go('wb-cookies-page'),
  Privacy: notDrawn('The shop’s Privacy page (Words and photos, Website 3 Oct)'),
  'Collection and returns': notDrawn('The shop’s Collection and returns page (Words and photos, Website 3 Oct)'),
  'Contact us': notDrawn('The shop’s Contact us page'),
  'Skip to the main content': STAY,
  // Staff header and rail
  // The header search opens on the staff page, with no till buttons (third walk, answer 1).
  'Search jobs, customers, orders, products': go('staff-search'),
  // "Call us": the shop's number opens the phone app (walk-through 12 M2).
  '[shop phone]': outside('The phone app, calling the shop'),
  // The phone menu: the website's on a customer page, the staff app's otherwise.
  'Open menu': ({ role }) => go(/Customer/.test(role) ? 'site-menu' : 'staff-app-menu'),
  'Fold the menu': go('till-rail'),
  'Front desk': STAY, Workshop: STAY, Stockroom: STAY, Office: STAY,
  'Online orders [n] to get ready': go('on-orders'),
  // The till's own controls
  'Past sales — find, refund, void or reprint': go('till-find'),
  'Serving: Jo Taylor — switch who’s serving': STAY,
  Park: go('till-park'),
  'Add a discount': go('till-discount'),
  'One fewer': STAY, 'One more': STAY, Clear: STAY,
  'Previous week': STAY, 'Next week': STAY,
  Print: outside('The printer'),
  // Patterns, tried after a journey's own labels: the diary's job blocks. Only
  // WH-1042's pages are drawn; its "In the workshop" block opens that stage
  // (third walk, walk-throughs 8 M2 and 9 M1). Other jobs' blocks say so
  // instead of opening Maya's job (walk-through 1 M3).
  '~': [
    [/WH-1042, In the workshop\b/, go('job-mechanic', 'WH-1042 in the workshop, drawn as the mechanic sees it.')],
    [/^WH-1046 · /, notDrawn('WH-1046’s page (the shared queue’s “I’ll do this” is a line under the diary)')],
    [/^(?:[^,]+, ){2,3}WH-(?!1042)\d{4}, |^WH-(?!1042)\d{4} · |^\d+ jobs booked .*WH-\d{4}|^[^,]+, [^,]+, WH-(?!1042)\d{4}$/, notDrawn('This job’s page: only WH-1042’s pages are drawn')],
  ],
};
