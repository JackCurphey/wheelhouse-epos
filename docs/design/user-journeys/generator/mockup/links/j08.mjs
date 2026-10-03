// Journey 8, Owner setup and onboarding — where each button goes in the mockup.
// Sources: Owner setup decisions 16–23 (docs/decisions/2026-09-30-owner-setup-review.md),
// consolidate/j08.mjs, walk-through 4 (second walk) M2.
import { go, STAY, outside, notDrawn } from '../controls.mjs';

// Every automatic message's "Edit the wording of …" opens the wording box.
const messages = ['Bike ready', 'Bike still waiting', 'Booking cancelled', 'Booking confirmed', 'Certificate received',
  'Date change answered', 'Item we couldn’t supply', 'New ready date', 'New time offered', 'Order cancelled',
  'Order confirmation', 'Order not ready after all', 'Order ready to collect', 'Order still waiting', 'Quote reminder',
  'Quote to approve', 'Ready to collect', 'Request declined', 'Request received', 'Review request', 'Service reminder',
  'Work added within your limit', 'Your answers', 'Your bike is no longer put aside', 'Your bike is put aside',
  'Your hold ends on [date]', 'Your order is cancelled'];
const editWording = Object.fromEntries(messages.map((m) => [`Edit the wording of ${m}`, go('set-msg-edit')]));

// Getting started: each step opens the right Settings section (Owner setup 16).
const steps = {
  card: go('fr-step'), staff: go('set-staff-invite'), services: go('set-workshop-services'),
  quick: go('set-till-empty'), float: go('set-eod'), messages: go('set-msg-list'),
  // A new shop's first visit to Website is the three-step start (Website 11).
  website: go('ws-start-which'),
};

export default {
  '*': {
    ...editWording,
    // Settings areas (Receiving stock 7: one page per room, areas as pills).
    Payments: go('set-pay-ways'),
    'End of day': go('set-eod'),
    'Shop and sites': go('set-shop-details'),
    'Staff and roles': go('set-staff'),
    'Your data': go('set-data-export'),
    // Reordering and removing act in place, then "Saved · Undo" (Owner setup 17).
    'Move Standard service — drag, or use the arrow keys': STAY,
    'Move Fit & adjust brakes — drag, or use the arrow keys': STAY,
    'Move Replace gear cable — drag, or use the arrow keys': STAY,
    'Move Shimano brake pads B05S-RX — drag, or use the arrow keys': STAY,
    'Move Safety check — drag, or use the arrow keys': STAY,
    'Move Gear adjustment — drag, or use the arrow keys': STAY,
    'Move Brake service — drag, or use the arrow keys': STAY,
    'Move — drag, or use the arrow keys': STAY,
    Remove: STAY,
    Rename: STAY,
    '+ Add a button': go('set-till-quick-add'),
    '+ Add your own message': go('set-msg-new'),
    '+ Invite someone': go('set-staff-invite'),
    // The tap-in placeholders in the wording box (Owner setup 23).
    '+ Amount to pay': STAY, '+ Bike': STAY, '+ Customer’s first name': STAY, '+ Job number': STAY,
    '+ Link to the job': STAY, '+ Opening hours': STAY, '+ Shop name': STAY,
    'Send again': STAY,
    'Clear a forgotten PIN': go('set-staff-clear-pin'),
    'Make this computer a till': go('till-setup'),
  },
  'fr-today': {
    'Moving from another system?': go('mv-start'),
    'Start: Connect the card machine': steps.card,
    'Set up: Invite your staff': steps.staff,
    'Set up: Workshop services and prices': steps.services,
    'Set up: Quick buttons for the till': steps.quick,
    'Set up: Float and closing up': steps.float,
    'Set up: Check the messages customers get': steps.messages,
    'Set up: Set up your website': steps.website,
    // On a phone each step is a whole tappable row (Owner setup 21).
    '3 Connect the card machine Ticks when a card machine answers': steps.card,
    '4 Invite your staff Ticks when someone accepts an invite': steps.staff,
    '5 Workshop services and prices Ticks when a service has a price': steps.services,
    '6 Quick buttons for the till Ticks when the first button is added': steps.quick,
    '7 Float and closing up Ticks when a float is set': steps.float,
    '8 Check the messages customers get Ticks when you’ve looked at Messages': steps.messages,
    '9 Set up your website Ticks when no Words and photos row says Check this': steps.website,
  },
  // Getting started while moving: one checklist (third walk, answer 10).
  'fr-today-moving': {
    'Moving from Citrus Lime: Run alongside, ready to switch over 3 of 4. Open the move': go('mv-progress'),
    'Start: Invite your staff': steps.staff,
    '4 Invite your staff Ticks when someone accepts an invite · [n] invited, waiting to join': steps.staff,
    '8 Check the messages customers get Ticks when you’ve looked at Messages · none go to customers until switch-over': steps.messages,
    '9 Set up your website Ticks when no Words and photos row says Check this · needed to switch over': steps.website,
  },
  'fr-step': { 'Connect a card machine': go('set-pay-card'), 'Next: Invite your staff': steps.staff },
  'set-list': {
    'Front desk Till, payments, messages, end of day': go('set-till-quick'),
    'Workshop Services, mechanics, diary, storage, collection': go('set-workshop-services'),
    'Stockroom Stock adjustments, categories': go('st-categories'),
    'Office Shop and sites, staff and roles, your data': go('set-shop-details'),
  },
  // Settings' room links open that room's page, as on a phone (set-list).
  'set-till-quick': { Edit: go('set-till-quick-add'), Office: go('set-shop-details') },
  'set-till-quick-add': { 'Add the button': go('set-till-quick-saved') },
  'set-till-quick-saved': { Undo: go('set-till-quick') },
  'set-till-reasons': { 'Remove this reason': STAY, Add: STAY },
  'set-till-printer': { 'Print a test receipt': outside('The receipt printer prints a test receipt'), 'Open the drawer': outside('The cash drawer opens') },
  'set-till-tills-owner': { Remove: go('set-till-remove') },
  'set-till-remove': { 'Keep the till': go('set-till-tills-owner'), 'Remove the till': notDrawn('Settings › Till › Tills after Till B1 is removed') },
  'set-eod-close': { 'Change opening hours': go('set-shop-hours') },
  'set-save-failed': { 'Try again': go('set-eod') },
  'set-pay-other': {
    'Remove Finance': STAY, 'Remove Cycle to Work': STAY, 'Remove Payment link': STAY,
    Add: notDrawn('Adding another way to pay, under Payments › Other ways to pay'),
  },
  'set-pay-card': { 'Connect a card machine': outside('The card machine, pairing with the till') },
  // The mockup has two shops (its shop menu), so a person opens with "Works at"
  // (Multiple sites 4; third walk, walk-through 7 M1).
  'set-staff': { Open: go('ms-person') },
  'set-staff-person': { 'Give everything a Manager can do': go('set-staff-person-all') },
  'set-staff-clear-pin': { 'Keep the PIN': go('set-staff-person'), 'Clear the PIN': go('set-staff-person') },
  'set-staff-invite': { 'Send the invite': go('set-staff-invited') },
  'set-staff-invite-till-only': { 'Add them': go('set-staff-invited') },
  // Every page opened from Getting started keeps its bar (Owner setup 17; third walk, walk-through 4 M3).
  'set-staff-invited': { Checklist: go('fr-today'), 'Next: Workshop services and prices': steps.services, 'Cancel the invite': STAY, Workshop: go('set-workshop-services') },
  // Opening Sites shows each shop and + Add a shop (Multiple sites 7).
  'set-shop-details': { 'Sites Bolton': go('ms-sites') },
  'set-workshop-services': {
    Edit: go('ac-service-edit'),
    '+ Add a service': notDrawn('Adding a workshop service: the service box, empty'),
  },
  'set-workshop-mechanics': { 'Change in Staff and roles': go('set-staff') },
  'set-workshop-diary': {
    'Remove Hook 1': STAY, 'Remove Hook 2': STAY, 'Remove Hook 3': STAY, 'Remove Hook 4': STAY,
    'Remove Hook 5': STAY, 'Remove Hook 6': STAY, 'Remove Workshop floor': STAY, 'Remove Front window': STAY,
    '+ Add a slot': STAY,
  },
  'set-msg-edit': { 'Go back to Wheelhouse’s wording': STAY },
  'set-msg-new': { 'Add the message': go('set-msg-list') },
  'set-data-export': { 'Download everything': outside('The download: spreadsheets of customers, sales, stock and jobs') },
};
