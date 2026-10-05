// Which situations are the same screen drawn for another person or shop: the
// only ones the mockup's Person and Shop boxes move between (issue #123,
// Codex review points 2 and 3; docs/superpowers/specs/2026-10-04-mockup-review-fixes.md).
// Every other situation is a moment (an error, a later state, a message) and
// the boxes leave it where it is.
//
// kept screen id → [{ id, shop?, person? }]
//   shop: the one shop the view is drawn for ('All shops' or '[Second site]');
//         without it the view is for any one shop (drawn at Bolton).
//   person: who it is drawn for, where the drawing's role doesn't say it.
//
// Written by hand, 4 Oct, from the ids ending -staff/-mechanic/-manager/-owner/-all
// and the situations whose titles name a person or shop. Left out as moments:
// ac-inbox-all ("All conversations"), set-staff-person-all, rs-receive-staff,
// rs-receive-staff-left, op-today-staff-lightspeed (a Lightspeed shop),
// rs-booked-staff, ms-request-from-shop, ms-switched. Taken out after the
// fresh review (4 Oct): ops-log-manager (the same role as ops-log, so never
// picked) and ms-one-shop (about how many shops someone has, not a person).
export const VIEWS = {
  'staff-app': [{ id: 'staff-app-mechanic' }],
  'op-today': [{ id: 'op-today-staff' }, { id: 'ms-today-all', shop: 'All shops' }],
  diary: [{ id: 'diary-mechanic' }, { id: 'ms-pick-shop', shop: 'All shops' }],
  'cw-list': [{ id: 'cw-list-owner' }],
  'rs-hub': [{ id: 'rs-hub-staff' }],
  'rs-delivery': [{ id: 'rs-delivery-staff' }],
  'st-list': [{ id: 'st-list-staff' }],
  'st-product': [{ id: 'st-product-staff' }],
  'tk-hub': [{ id: 'tk-hub-staff' }],
  'rp-home': [{ id: 'rp-home-all', shop: 'All shops' }, { id: 'rp-home-staff' }],
  'rp-sales': [{ id: 'rp-sales-all', shop: 'All shops' }],
  'rp-takings': [{ id: 'rp-takings-all', shop: 'All shops' }],
  'rp-vat': [{ id: 'rp-vat-all', shop: 'All shops' }],
  'rp-workshop': [{ id: 'rp-workshop-all', shop: 'All shops' }],
  'rp-discounts': [{ id: 'rp-discounts-staff' }],
  'ops-log': [{ id: 'ops-log-all', shop: 'All shops' }],
  'on-orders': [{ id: 'on-orders-second', shop: '[Second site]' }],
  'set-workshop-services': [{ id: 'ms-services-differs', shop: '[Second site]' }],
  'till-setup': [{ id: 'ms-till-setup', shop: '[Second site]' }],
};
