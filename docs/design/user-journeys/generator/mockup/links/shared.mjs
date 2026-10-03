// Labels that go to the same place on every board: the staff sidebar and the
// till's rail (rooms: Front desk, Workshop, Stockroom, Office — App map 1, 2),
// the shop menu, Your settings, and the website's header.
import { go, STAY, notDrawn, outside } from '../controls.mjs';

export default {
  // Front desk
  Today: go('op-today'),
  Till: go('till-sale'),
  'Online orders': go('on-orders'),
  'Cycle to Work': go('cw-list'),
  Customers: go('cs-list'),
  Messages: go('ac-inbox'),
  // Workshop
  Diary: go('diary'),
  Overview: go('overview'),
  // Stockroom
  Stock: go('st-list'),
  'Deliveries and orders': go('rs-hub'),
  'Stock take': go('tk-hub'),
  // Office
  Reports: go('rp-home'),
  Website: go('ws-page'),
  Settings: go('set-till-quick'),
  // The shop menu, Your settings, signing out and checking out
  'Shop: Bolton. Choose a shop': go('ms-switch-open'),
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
  Shop: go('wb-category'),
  'Basket, 0 items': go('on-basket'),
  Cookies: go('wb-cookies-page'),
  Privacy: notDrawn('The shop’s Privacy page (Words and photos, Website 3 Oct)'),
  'Collection and returns': notDrawn('The shop’s Collection and returns page (Words and photos, Website 3 Oct)'),
  'Contact us': notDrawn('The shop’s Contact us page'),
  'Skip to the main content': STAY,
  // Staff header and rail
  'Search jobs, customers, orders, products': go('till-search'),
  'Open menu': go('staff-app-menu'),
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
};
