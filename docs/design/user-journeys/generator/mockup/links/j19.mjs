// Journey 19, Multiple sites — where each button goes in the mockup.
// From the Multiple sites decisions (1 Oct): the shop menu sets the shop for
// every page, with "All shops" (1, 9); a price or service can differ at one
// shop, set on the product or service (2, 3); "Works at" on the person (4);
// "Which shop?" first in booking (5); Today's shop rows (6); "+ Add a shop"
// then a checklist on Today (7); every till by shop (8).
import { go, STAY, notDrawn } from '../controls.mjs';

export default {
  '*': {
    // Settings pages these boards sit in
    'Shop and sites': go('set-shop-details'),
    'Staff and roles': go('set-staff'),
    'Your data': go('set-data-export'),
    'End of day': go('set-eod'),
    Payments: go('set-pay-ways'),
    // Shop and sites
    '+ Add a shop': go('ms-add-shop'),
    'Edit Bolton': go('set-shop-details'),
    'Edit [Second site]': notDrawn('[Second site]’s own shop details (Settings › Office › Shop and sites)'),
    // Tills, by shop
    'Add a till at Bolton': go('till-setup'),
    'Add a till at [Second site]': go('ms-till-setup'),
    'Move to [Second site]…': go('ms-till-move'),
    'Stop using this till…': go('set-till-remove'),
    'Bolton tills: see every till': go('ms-tills'),
    '[Second site] tills: see every till': go('ms-tills'),
    'See tills at [Second site]': go('ms-tills'),
    // Today, with All shops: the shop's name and its tills are separate targets (9, H3)
    'Work in Bolton': go('op-today'),
    'Work in [Second site]': go('ms-switched'),
    'See the 3 things that need attention at [Second site]': go('ms-switched'),
    'Seen: [Second site], Till [code]1 float short': STAY,
    'Contacted: [Second site], [Job number] ready since [date]': STAY,
    'Book in': go('till-book-in'),
    'Open the diary': go('diary'),
    // A new shop's checklist on Today (7)
    'Count it at [Second site]': go('tk-start'),
    'How to set up a till at [Second site]': go('ms-till-setup'),
    'Open Staff and roles at [Second site]': go('set-staff'),
    'Send from Bolton at [Second site]': go('tr-send'),
    'Show [Second site] to customers': go('ms-sites'),
    // Booking: Which shop? (5)
    'Sign in to use your saved bikes and details': go('cust-signin'),
    // A service's price at each shop (3)
    '+ Add a service': notDrawn('Add a service (Settings › Workshop › Services)'),
    'Move Standard service — drag, or use the arrow keys': STAY,
    Remove: STAY,
    'Same as all shops at [Second site]': STAY,
    // A product's page (journey 14's screens)
    'Adjust stock': go('st-adjust'),
    'Edit details': notDrawn('Edit a product’s details: its category’s measurements and specifications (Stock take and stock control 10)'),
    'Open job WH-1042': go('job-overview'),
    'Open sale B1-[0000]': go('till-sale-detail'),
    'Open transfer T-[0000]': go('tr-incoming'),
    'Send to another shop': go('tr-send'),
    // A person: workshop days at each shop — a day taken at the other shop is greyed (9, H5)
    'Tue: Jo is at Bolton': STAY,
    'Wed: Jo is at Bolton': STAY,
    'Sat: Jo is at Bolton': STAY,
    'Clear a forgotten PIN': go('set-staff-clear-pin'),
    'Give everything a Manager can do': go('set-staff-person-all'),
  },
  'ms-add-shop': { '+ Add a shop': STAY, 'Add the shop': go('ms-today-new'), 'Copy hours from Bolton': STAY },
  'ms-add-shop-error': { '+ Add a shop': STAY, 'Add the shop': STAY, 'Copy hours from Bolton': STAY },
  'ms-book-shop-chosen': { Change: go('ms-book-shop-change'), 'Next: your bike': go('bk-bike') },
  'ms-pick-shop': { Bolton: go('diary'), '[Second site]': go('diary') },
  // The menu is open over Today: All shops shows Today for every shop (9).
  'ms-switch-open': { 'All shops Today, reports and stock for every shop': go('ms-today-all') },
  'ms-product-price': { Edit: STAY, Save: go('st-product') },
  'ms-service-price': { Edit: STAY, Save: go('ms-services-differs') },
  'ms-service-not-offered': { Edit: STAY, Save: go('ms-services-differs') },
  'ms-services-differs': { Edit: go('ms-service-price') },
  'ms-job-other-shop': {
    '+ Add a bike': STAY,
    '+ New customer': go('cs-add'),
    'Add note': STAY,
    'Search services': STAY,
    'Send request to [Second site]': go('ms-request-from-shop'),
  },
  'ms-request-from-shop': { Accept: go('ms-request-answered'), 'Offer another time': go('request-change'), 'Another time': go('request-change'), Decline: go('request-decline') },
  'ms-request-answered': { 'Showing Everyone. Change whose jobs are shown': STAY },
  'ms-till-other': { 'Open the basket': STAY, 'Take payment · £111.00': go('till-pay') },
  'ms-till-move': { 'Move Till B3 to [Second site]': go('ms-tills') },
  'ms-till-setup': { 'Make this computer Till [code]3': go('till-checkin'), 'Make this device Till [code]3': go('till-checkin'), '[code]1, in use': STAY, '[code]2, in use': STAY },
};
