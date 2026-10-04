// Journey 3, Book a repair — where each button goes in the mockup.
// From the Book a repair decisions (1 Oct): one page, a step at a time
// (decision 2), sign-in offered never required (6), Earliest goes straight to
// the details (12, "Take it"), nothing typed is lost (9), and changing or
// cancelling on the booking's own page (10, 12).
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

const NOTE = notDrawn('Add a note for the shop: the note box on the booking’s page (Book a repair 10)');
const TERMS = notDrawn('The shop’s booking terms page');
const PRIVACY = notDrawn('The shop’s Privacy page (Words and photos, Website 3 Oct)');

const map = {
  '*': {
    'Sign in to use your saved bikes and details': go('cust-signin'),
    'Next: your bike': go('bk-bike'),
    'Next: when': go('bk-when'),
    'Next: your details': go('bk-details'),
    'Change service': go('bk-service'),
    'Change bike': go('bk-bike'),
    'Change when': go('bk-when'),
    // The contact details step opens again in place
    Change: STAY,
    'Add photos or a short video · optional': outside('The phone or computer’s photo and video picker'),
    'booking terms': TERMS,
    'privacy notice': PRIVACY,
    'Later weeks ›': STAY,
    'Book this time': go('bk-details'),
    'Not you?': go('bk-details'),
    // The booking's own page
    'Add a note for the shop': NOTE,
    'Change the date': go('bk-change'),
    'Cancel booking': go('bk-cancel'),
    'Cancel request': go('bk-cancel'),
    'Keep my booking': go('bk-page'),
    'Book another time': go('bk-service'),
  },
  'bk-service-many': { 'Show all [n] individual services': STAY },
  'bk-bike-signed-in': { 'Not you?': go('bk-bike') },
  'bk-details': { 'Send booking request': go('bk-request') },
  'bk-resume': { 'Send booking request': go('bk-request'), 'Carry on': go('bk-details'), 'Start again': go('bk-service') },
  'bk-sending': { 'Sending…': go('bk-request') },
  'bk-not-sent': { 'Try again': go('bk-request') },
  'bk-details-deposit': { 'Pay £[deposit] and send request': go('bk-request-deposit') },
  'bk-card-failed': { 'Try again': go('bk-request-deposit') },
  'bk-checking-payment': { 'Check again': go('bk-request-deposit') },
  'bk-bookings': { Open: go('bk-page') },
  'bk-offered': { 'Accept this time': go('bk-page'), 'Cancel my request': go('bk-cancel') },
  'bk-declined': { 'Choose another date — we’ve kept your details': go('bk-when') },
  'bk-change': { 'Ask for this date': go('bk-change-pending'), 'Keep Thursday': go('bk-page') },
  'bk-change-pending': { 'Cancel my date change': go('bk-page') },
  // The cancel box: the page behind it keeps its own buttons
  'bk-cancel': { 'Cancel booking': go('bk-cancelled') },
  'bk-cancel-late': { 'Cancel booking': STAY, 'Cancel and lose the deposit': go('bk-cancelled-late') },
  'bk-cancel-ls': { 'Cancel booking': go('bk-cancelled'), 'Keep my booking': go('bk-page-ls') },
  // Staff side: the request in the diary (Workshop day 7, 12, 15)
  'bk-staff-request': { Accept: go('diary'), 'Offer another time': go('request-change'), 'Another time': go('request-change') },
  'bk-staff-decline': { 'Decline & notify customer': go('diary'), 'Keep request': go('bk-staff-request') },
  // Settings
  // Coverage walk 7 M1: the Services and Mechanics rows open their sections.
  'bk-settings': { 'Services Full service, Individual service': go('set-workshop-services'), 'Mechanics Alex Morgan, Jo Taylor, Shared queue': go('set-workshop-mechanics'), 'See your booking page ↗': go('bk-service'), 'Use your own': notDrawn('Your own booking terms: adding them (Settings › Workshop › Online booking)') },
  'bk-settings-deposits': { 'See your booking page ↗': go('bk-service'), 'Use your own': notDrawn('Your own booking terms: adding them (Settings › Workshop › Online booking)') },
  'bk-messages': {
    '+ Add your own message': go('set-msg-new'),
    'End of day': go('set-eod'),
    Payments: go('set-pay-ways'),
  },
};

// Every "Edit the wording of …" row in Messages opens the same editor.
for (const k of ['Bike ready', 'Bike still waiting', 'Booking cancelled', 'Booking confirmed', 'Certificate received', 'Date change answered', 'Item we couldn’t supply', 'New ready date', 'New time offered', 'Order cancelled', 'Order confirmation', 'Order not ready after all', 'Order ready to collect', 'Order still waiting', 'Quote reminder', 'Quote to approve', 'Ready to collect', 'Request declined', 'Request received', 'Review request', 'Service reminder', 'Work added within your limit', 'Your answers', 'Your bike is no longer put aside', 'Your bike is put aside', 'Your hold ends on [date]', 'Your order is cancelled']) map['bk-messages'][`Edit the wording of ${k}`] = go('set-msg-edit');

export default map;
