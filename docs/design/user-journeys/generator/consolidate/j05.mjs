// Journey 5, Collect the bike and pay — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-3-4-5.md merge table.
import { keep, into, later } from './plan.mjs';

export default {
  // The customer's link: the one customer job page, ready to collect
  'cp-summary': keep(37), // Quote 7 H4 keeps the two-column ready page as a drawing
  'cp-summary-said-yes': into('cp-summary', 'Quote 1', "'You’ll get a reminder when the next service is due. Change' — no tick box"),
  'cp-summary-deposit': into('cp-summary', 'Quote 1', "'Deposit paid £[deposit] · [date], when you booked'; 'Pay £[rest] now'"),
  'cp-pay': keep(39),
  'cp-pay-failed': into('cp-pay', 'Collect 2, 5 H1', "'The card didn’t go through.' Nothing was taken; 'Try again'"),
  'cp-pay-balance': into('cp-pay', 'Collect 2, 5 H1', "'Pay £[rest]'; 'Your £[deposit] deposit is already taken off.'"),
  'cp-paid': into('cp-pay', 'Collect 2, 5 H1', "'Paid — thank you, Maya': £111.00 paid, receipt by email; no card form"),
  'cp-paid-balance': into('cp-pay', 'Collect 2, 5 H1', "'£[rest] paid … with your £[deposit] deposit: £111.00 in all'"),
  'cp-summary-paid': into('cp-summary', 'Quote 1', "'Paid' card: '£111.00 paid on [date]', 'Nothing more to pay'; no Pay now"),
  'cp-summary-counter': into('cp-summary', 'Quote 1', "'This is being paid at the counter right now'; no Pay now"),
  'cp-summary-inshop': into('cp-summary', 'Quote 1', "'To pay when you collect': 'Pay at the counter by card or cash'; no Pay now"),
  'cp-expired': into('cp-summary', 'Walk-through 1 M5', "'This link has expired' — the job was collected; shop details only"),
  // A Lightspeed shop
  'cp-summary-ls': into('cp-summary', 'Quote 1', "'Agreed price £111.00 — pay at the till'; no Pay now, no Basket"),
  'cp-summary-ls-paid': into('cp-summary', 'Quote 1', "'Paid at the till · [date], [time]' — 'Nothing more to pay.'"),
  // At the counter: journey 12's job page and journey 11's till
  'cp-ready-unpaid': into('job-overview', 'Workshop day 20', "'Finished', 'Not paid yet' £111.00 to pay; 'Take payment'"),
  'cp-ready-deposit': into('job-overview', 'Workshop day 20', "'Not paid yet': the rest to pay, 'Deposit paid' with its date; 'Take payment'"),
  'cp-till': into('till-sale', '', "basket of the job’s lines 'agreed on the job', 'Bike collected when paid' on"),
  'cp-ready-paid': into('job-overview', 'Workshop day 20', "'Finished', 'Paid £111.00 · Paid online'; 'Hand over'"),
  'cp-ready-ticks': into('job-overview', 'Workshop day 20', "two ticks above 'Hand over': bike handed over, 'Lock key and rear light returned'"),
  'cp-collected': into('job-overview', 'Workshop day 20', "grey 'Collected', 'handed over by Jo Taylor'; 'Collected · the job is closed' with 'Undo'"),
  // Not collected
  'cp-today-uncollected': into('op-today', '', "'WH-1050 · Aisha Khan — ready since Mon 14 Sep' with 'Contacted'"),
  // Settings
  'cp-setting': into('bk-settings', 'Receiving 7', "'Collection' open: 'Remind the customer after', 'Show it on Today after', 'Hand-back reminders'"), // inferred — Settings › Workshop › Collection has no journey 8 owner; same Settings › Workshop page as bk-settings
  'cp-messages': into('set-msg-list', 'Receiving 7', "same page; the 'Bike still waiting' row, after [n] days"),
  'cp-message-wording': into('set-msg-list', 'Receiving 7', "'Bike still waiting' wording pop-up, previews unpaid and 'Paid — nothing more to pay'"),
  // The receipt
  'cp-receipt-email': keep(41),
  'cp-receipt-email-guest': into('cp-receipt-email', 'Leftover screens 1, 6 H1', "to '[email address]'; no 'See it in your account'; 'give the receipt number'"),
  'cp-invoice-email': into('cp-receipt-email', 'Leftover screens 1, 6 H1', "headed 'VAT invoice', 'Invoice to [Company name]', sent to '[accounts email]'"),
  'cp-receipt-email-till': into('cp-receipt-email', 'Leftover screens 1, 6 H1', "'Till sale': 2 × brake pads, 'Discount · [reason]', £20.00 cash plus card"),
  'cp-receipt-email-deposit': into('cp-receipt-email', 'Leftover screens 1, 6 H1', "two payments: 'Deposit paid online · [date]' and 'Paid by card · [card ending]'"),
  'cp-receipt-text': keep(41),
  'cp-receipt-text-email': into('cp-receipt-text', 'Leftover screens 2', "'Email the receipt' pop-up over the receipt page: 'Used for this receipt only.'"),
  'cp-receipt-address': keep(9),
  'cp-receipt-address-error': into('cp-receipt-address', 'Leftover screens 3', "red 'That doesn’t look like an email address — check it'"),
  'cp-receipt-address-save': into('cp-receipt-address', 'Leftover screens 3', "'Add a customer' pop-up: name, email filled, phone, offers; 'Not now'"),
  'cp-receipt-address-text': into('cp-receipt-address', 'Leftover screens 3', "'Text the receipt' with a 'Mobile number' box"),
  'cp-receipt-address-customer': into('cp-receipt-address', 'Leftover screens 3', "'maya@example.test' filled in, 'From Maya’s customer record'; no save tick"),
  'cp-receipt-address-offline': into('cp-receipt-address', 'Leftover screens 3', "'The till is offline…' bar; button 'Send when back online'"),
  // Also at collection: old Release 1 picture
  'ready': into('cp-summary', 'Collect and pay 6; 3 Oct (walk-through 1 L6)', "older Release 1 picture of this page, 'Customer is invited to collect'; nothing it shows is missing here"), // 3 Oct: leaves the canvas as a board (README rule 5); changes Collect 6, which kept it
};
