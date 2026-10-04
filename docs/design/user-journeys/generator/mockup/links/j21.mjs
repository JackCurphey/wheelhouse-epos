// Journey 21, Lightspeed shops — where each button goes in the mockup.
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

// The job page's own controls at a Lightspeed shop (job-page.mjs).
const JOB = {
  'Add item': go('ls-part-search'),
  'Scan barcode': STAY,
  'Notes': STAY,
  'Message Maya Patel': go('ac-inbox'),
  'Email Maya Patel': outside('An email to Maya Patel, from the shop’s email app'),
  'Full service checklist 0 of 10 done · 0 notes': go('job-checklist'),
  'Full service checklist 8 of 10 done · 1 note': go('job-checklist'),
  'Mark ready for collection': go('ls-job-unpaid'),
};

// Settings › Office's own tabs.
const OFFICE = {
  'Shop and sites': go('set-shop-details'),
  'Staff and roles': go('set-staff'),
  'Lightspeed': STAY,
  'Your data': go('ls-office-data'),
};

// Ready with no work order in Lightspeed yet: the strip keeps its cause.
const READY_NO_WO = { 'Mark ready for collection': go('ls-job-ready-no-wo') };

// Adding a part from Lightspeed's products.
const PARTS = {
  'Add Shimano brake pads B05S-RX to the quote': STAY,
  'Add [Product] to the quote': STAY,
  '1 photo — view or add for Shimano brake pads': STAY,
  'Add photo for Fit & adjust brakes': STAY,
  'Add photo for Replace gear cable': STAY,
  'Send quote': go('dq-job-sent'),
};

export default {
  '*': { ...JOB, ...OFFICE, 'Open the diary': go('diary') },
  // Connecting Lightspeed
  'ls-settings-off': { 'Connect Lightspeed': go('ls-connect-signin') },
  'ls-settings-on': { 'Check now': STAY, 'Disconnect…': go('ls-disconnect') },
  'ls-disconnect': { 'Disconnect': go('ls-settings-off'), 'Keep connected': BACK },
  'ls-reconnect': { 'Reconnect Lightspeed': go('ls-connect-signin') },
  'ls-connect-signin': { 'Connect Lightspeed': STAY, 'Continue to Lightspeed': go('ls-connect-shops') },
  'ls-connect-shops': { 'Alex doesn’t use Lightspeed': STAY, 'Next': go('ls-connect-checks') },
  'ls-connect-shops-two': { 'Alex doesn’t use Lightspeed': STAY, 'Next': go('ls-connect-checks'), '[Lightspeed shop 1]': STAY, '[Lightspeed shop 2]': STAY },
  'ls-connect-checks': { 'Check again': STAY, 'Done': go('ls-settings-on') },
  'ls-office-data': { 'Lightspeed': go('ls-settings-on'), 'Open the activity log': go('ops-log') },
  'ls-messages': {
    '+ Add your own message': go('set-msg-new'),
    ...Object.fromEntries(['Bike ready', 'Bike still waiting', 'Booking cancelled', 'Booking confirmed', 'Date change answered', 'New ready date', 'New time offered', 'Quote reminder', 'Quote to approve', 'Request declined', 'Request received', 'Review request', 'Service reminder', 'Work added within your limit', 'Your answers'].map((m) => [`Edit the wording of ${m}`, go('set-msg-edit')])),
  },
  // Today
  'ls-today-down': { 'See the jobs': notDrawn('The jobs waiting to send to Lightspeed, as a list') },
  'ls-today-person': { 'See the jobs that need someone to look at Lightspeed': notDrawn('The jobs that need someone to look at Lightspeed, as a list') },
  'ls-today-unpaid': { 'Open WH-1042': go('ls-job-collected-unpaid') },
  // Quote and approval
  'ls-book-in': { 'Link and book in': go('job-book-in') },
  'ls-customer-pick': { 'Choose the customer in Lightspeed for WH-1042': STAY, 'Link and send': go('ls-job-sent') },
  'ls-job-pick': { ...READY_NO_WO, 'Choose the customer in Lightspeed for WH-1042': go('ls-customer-pick') },
  'ls-part-search': PARTS,
  'ls-job-price-changed': {
    'Ask Maya to approve the new price': go('ls-job-price-asked'),
    'Keep the agreed price of £28.00 for Shimano brake pads': go('ls-job-sent'),
  },
  // When Lightspeed can't be reached
  'ls-job-waiting': READY_NO_WO,
  'ls-job-unsure': { ...READY_NO_WO, 'Check WH-1042’s work order in Lightspeed': go('ls-job-check') },
  'ls-job-check': {
    ...READY_NO_WO,
    'Check WH-1042’s work order in Lightspeed': STAY,
    'It isn’t there — send it': go('ls-job-sent'),
    'Link this work order': go('ls-job-sent'),
  },
  // Payment and collection
  'ls-job-ready-no-wo': { 'Hand over': go('ls-hand-over-no-wo') },
  'ls-hand-over-no-wo': { 'Hand over': go('ls-job-collected-unpaid'), 'Not yet': BACK },
  'ls-job-unpaid': { 'Hand over': go('ls-hand-over-unpaid') },
  'ls-hand-over-unpaid': { 'Hand over': STAY, 'Check Lightspeed now': go('ls-hand-over-found'), 'Hand over anyway': go('ls-job-collected-unpaid'), 'Not yet': BACK },
  'ls-hand-over-found': { 'Hand over': go('cp-collected') },
  'ls-job-paid': { 'Hand over': go('cp-collected') },
  'ls-job-fallback': { 'Hand over': go('ls-hand-over-unchecked') },
  'ls-hand-over-unchecked': { 'Yes, she paid': go('cp-collected') },
  'ls-job-collected-unpaid': { 'Mark it sorted…': go('ls-job-sorted') },
  'ls-job-sorted': { 'Mark it sorted…': STAY, 'Mark it sorted': notDrawn('The job once marked sorted: Collected, the mark and Today’s line cleared') },
  // The customer's ready page
  'ls-customer-ready': {
    'Add a note for the shop': go('ac-job-note'),
    'Photo of Shimano brake pads: rear pads worn — open larger photo': go('dq-quote-photo'),
  },
};
