// Journey 19, Multiple sites — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-back-office.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  'ms-switch-open': keep(13),
  'ms-switched': into('ms-switch-open', '', "Switched: toast 'Now working in [Second site]'; Today shows that shop's day"),
  'ms-today-all': into('op-today', '', "All shops: a 'Shops' table, a row per shop; one 'Needs attention' list, each line naming its shop"),
  'ms-pick-shop': into('diary', '', "'Which shop’s diary?' — choose one; 'This switches the whole app to that shop'"),
  'ms-till-other': into('till-sale', '', "Bar: 'This till is Bolton’s. Sales here are Bolton’s, whichever shop you chose in the menu'"),
  'ms-one-shop': into('ms-switch-open', '', "One shop: its name only, no switcher"),
  'ms-service-price': keep(28),
  'ms-service-not-offered': into('ms-service-price', '', "'Not offered here' at one shop; its bookings 'stay booked — call those customers'"),
  'ms-services-differs': into('set-workshop-services', '', "At [Second site]: 'Price differs · £[price] here · £65.00 all shops'"),
  'ms-product-price': keep(28),
  'ms-person': into('set-staff-person', '', "'Works at' shop ticks; 'In the workshop on' days for each shop — a day at one shop only"),
  'ms-book-shop': into('bk-service', '', "'Which shop?' first: each shop with address and hours; 'Choose a shop to carry on'"), // journey 3's booking, first step
  'ms-book-shop-chosen': into('bk-service', '', "Shop already chosen: 'North Street Cycles, Bolton' with 'Change'"), // as above
  'ms-book-shop-change': into('bk-service', '', "'Changing shop clears your time. Your service stays if [Second site] offers it'"), // as above
  'ms-job-other-shop': into('new-job', '', "New job with 'Workshop at [Second site]': 'Goes to [Second site] as a request'; 'Send request to [Second site]'"), // inferred: drawn from diary.mjs
  'ms-request-from-shop': into('request-new', '', "At [Second site], Waiting for you: 'Request from Bolton' with 'Accept', 'Offer another time', 'Decline'"), // inferred: drawn from diary.mjs
  'ms-request-answered': into('diary', '', "At Bolton, Waiting for you: 'Answered by [Second site]' — 'accepted for [day] [time]'"), // inferred: the diary's Waiting for you
  'ms-sites': into('set-shop-details', '', "Each shop listed with address, phone, tills and hours, 'Edit'; '+ Add a shop'"),
  'ms-sites-manager': into('set-shop-details', '', "Manager: shops listed, no 'Edit' or 'Add a shop'; 'Only the owner can add or change shops.'"),
  'ms-add-shop': keep(9),
  'ms-add-shop-error': into('ms-add-shop', '', "Code error: 'B is Bolton’s code. Choose another letter.'"),
  'ms-today-new': into('op-today', '', "'[Second site] added': 'Getting [Second site] ready' checklist of five steps"),
  'ms-tills': into('set-till-quick', '', "Tills page: every till grouped by shop, each with '…' — 'Move to [Second site]…', 'Stop using this till…'"),
  'ms-till-move': keep(9),
  'ms-till-setup': into('till-setup', '', "At [Second site]: numbers '[code]1 In use', '[code]2 In use'; 'Make this computer Till [code]3'"), // journey B's till setup
};

// "Draw the decisions" SI1: a decision drawn as a line (spec B0). It goes on
// ms-switch-open, not op-today, because op-today stays a one-shop board.
export const lines = [
  { on: 'ms-switch-open', text: 'While [Second site] is being set up: [Second site] · [n] steps to get it ready', who: 'Owner', decision: 'Walk-through 7 H1 (as taken)' },
  // "Draw the answers" SI2
  { on: 'ms-switch-open', text: 'On tablet and phone, at a business with more than one shop: North Street Cycles · Bolton (or All shops) under each page’s title, 14px', who: 'Staff', decision: 'Multiple sites 11; walk-through 7 L2, L3' },
];
