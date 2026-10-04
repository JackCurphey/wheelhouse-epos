// Journey 15, Customer service — where each button goes in the mockup.
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

// Her page: details, bikes, history (customer.mjs). The rows read with
// "· Bolton" on cs-page and without it on the boards drawn over her page.
const BIKE = notDrawn('A customer’s bike: its details, warranty and jobs');
const PAGE = {
  'New job': go('new-job'),
  'Edit': go('cs-edit'),
  '+ Add': notDrawn('Adding a bike to a customer’s page'),
  'Trek Domane AL 3 Green · black mudguards · bought here [date] Under warranty · [n] months left': BIKE,
  '[Bike] · [Size] Frame [frame number] · bought here on Cycle to Work [date] Under warranty · [n] months left': BIKE,
  'WH-1077 Standard service Sat 19 Sep · 13:00 · Alex Morgan Expected': go('job-overview'),
  'WH-1077 Standard service Sat 19 Sep · 13:00 · Alex Morgan · Bolton Expected': go('job-overview'),
  'WH-1062 Standard service Wed 16 Sep · 11:00 · Alex Morgan Expected': go('job-overview'),
  'WH-1062 Standard service Wed 16 Sep · 11:00 · Alex Morgan · Bolton Expected': go('job-overview'),
  'WH-1042 Standard service Thu 17 Sep · 11:30 · Alex Morgan In the workshop': go('job-mechanic'),
  'WH-1042 Standard service Thu 17 Sep · 11:30 · Alex Morgan · Bolton In the workshop': go('job-mechanic'),
  'WH-1056 Standard service Tue 15 Sep · 13:00 · Alex Morgan Finished': go('job-finished'),
  'WH-1056 Standard service Tue 15 Sep · 13:00 · Alex Morgan · Bolton Finished': go('job-finished'),
  'Refund Refund · Till B1 [date] · [what came back] −[£]': notDrawn('A past refund, opened from her history'),
  'Refund Refund · Till B1 [date] · [what came back] · Bolton −[£]': notDrawn('A past refund, opened from her history'),
  'Text Bike ready [date] · sent to 07700 900 142': go('ac-inbox'),
  'Credit Store credit added [date] · [reason] · by [name] +[£]': notDrawn('A store credit entry, opened from her history'),
  'Show all ([n])': STAY,
  'Order Cycle to Work · [Bike] · Waiting for the certificate Quote [quote number] · [Provider] · held until [date]': go('cw-order-held'),
  'Order Cycle to Work · [Bike] · Collected Quote [quote number] · certificate [certificate number] · collected [date] · Sale B1-[0000]': go('cw-order-owed'),
};

// The customer list (behind the Add box and in the staff search).
const LIST = {
  '+ Add a customer': go('cs-add'),
  'AK Aisha Khan Cannondale Quick [phone]': go('cs-page'),
  'AK Aisha Khan Cannondale Quick': go('cs-page'),
  'JB Jamie Brooks Giant Escape 2 [phone]': go('cs-page'),
  'JB Jamie Brooks Giant Escape 2': go('cs-page'),
  'MP Maya Patel Trek Domane AL 3 Owes [£ owed] 07700 900 142': go('cs-page'),
  'MP Maya Patel Trek Domane AL 3 Owes [£ owed]': go('cs-page'),
  'OC Oliver Chen Brompton C Line [phone]': go('cs-page'),
  'OC Oliver Chen Brompton C Line': go('cs-page'),
  'SR Sam Reed Specialized Sirrus [phone]': go('cs-page'),
  'SR Sam Reed Specialized Sirrus': go('cs-page'),
};

export default {
  '*': { ...PAGE, ...LIST },
  'cs-page': PAGE,
  'cs-list': LIST,
  'cs-page-dup': { 'Check': go('cs-merge') },
  // Adding and editing
  'cs-add': { '+ Add a customer': STAY, 'Add the customer': go('cs-page-new') },
  'cs-add-match': { 'Use Maya Patel': go('cs-page') },
  'cs-edit': { 'Save changes': go('cs-page') },
  'cs-credit': { 'Add the credit': go('cs-page') },
  'cs-merge': { 'Check': STAY, 'Merge into one': go('cs-page'), 'They’re different people': go('cs-page') },
  'cs-sale': { 'Print the receipt': outside('The receipt printer'), 'Refund at the till': go('till-refund') },
  // Accounts (pay later)
  'cs-account': {
    'Email the statement': notDrawn('Her statement, as the email she gets'),
    'Record a bank transfer': go('cs-transfer'),
    'Take a payment at the till': notDrawn('The till taking a payment off her account'),
  },
  'cs-transfer': { 'Record it': go('cs-account') },
  // Customer groups
  'cs-groups': {
    '+ Add a group': notDrawn('Adding a customer group'),
    'Edit': notDrawn('Editing a customer group'),
    'Payments': go('set-pay-ways'),
    'End of day': go('set-eod'),
  },
  // Privacy requests
  'cs-privacy': {
    '+ Log a request': notDrawn('Logging a privacy request by hand'),
    // Coverage walk 12 M3: the story goes through this row, as Maya's once WH-1042 is collected.
    'Delete their details': go('cs-privacy-delete', 'Maya Patel’s request, once WH-1042 is collected (a line under Privacy requests).'),
    'Send the copy': notDrawn('The copy of someone’s details, as sent to them'),
  },
  'cs-privacy-delete': { 'Delete their details': go('cs-privacy', 'Deleted: the request’s row now reads Done [date], and Maya is told (lines under Privacy requests).'), 'Keep their details': BACK },
};
