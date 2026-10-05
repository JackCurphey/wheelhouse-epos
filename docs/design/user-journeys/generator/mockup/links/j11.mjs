// Journey 11, Selling at the till — where each button goes in the mockup.
// Sources: Selling at the till decisions 2, 3, 6–9, 11–13, 15 and the later
// changes (store credit; a job's agreed lines locked); Cycle to Work 7.
import { go, STAY, BACK, outside, notDrawn } from '../controls.mjs';

const REFUNDED = notDrawn('Refunded: what the till shows once a refund is done');
const DEPOSIT_PAID = notDrawn('Taking the deposit: how it’s paid, and the paid box for a deposit');

export default {
  // Trust PIN on (Roles and switches, answer 10): tap your pill to be serving.
  'till-serving-pills': { 'Jo Taylor': STAY, 'Jack Lewis': STAY, 'Someone else': go('till-checkin') },
  '*': {
    // The quick buttons add to the sale (decision 2)
    'Standard service Labour · 60 min £65.00': STAY,
    'Fit & adjust brakes Labour · 30 min £18.00': STAY,
    'Replace gear cable Labour £12.00': STAY,
    // Tapping a basket line opens its pop-up (decision 3)
    'Shimano brake pads Part · B05S-RX': go('till-line'),
    'Fit & adjust brakes Labour · 30 min': go('till-line'),
    '[Accessory] Accessory · added at the counter': go('till-line'),
    'Discount · [reason] · minus £4.00 — change or remove': go('till-discount'),
    // A job's or an order's lines are locked (later change, Collect and pay 5)
    'Standard service Labour · 60 min · agreed on the job': STAY,
    'Shimano brake pads Part · B05S-RX · agreed on the job': STAY,
    'Fit & adjust brakes Labour · 30 min · agreed on the job': STAY,
    'Deposit paid [date] · card': STAY,
    '[Bike] · [Size] Frame [frame number] · the one held · on the order': STAY,
    '[Accessory] Accessory · on the order': STAY,
    'Deposit · Maya Patel’s Cycle to Work order Quote [quote number] · goes on the order when paid': STAY,
    // The basket's customer row
    'Add a customer (optional)': go('till-customer'),
    'Maya Patel': go('cs-page'),
    'Maya Patel · workshop job WH-1042': go('job-collection'),
    'Maya Patel · Cycle to Work · quote [quote number]': go('cw-order-ready'),
    'Use it': go('till-giftcard'),
    // Take payment
    'Take payment': STAY, // empty basket: off
    'Take payment · £74.00': go('till-pay'),
    'Take payment · £70.00': go('till-pay-discounted'),
    'Take payment · £111.00': go('till-pay'),
    'Take payment · £83.25': go('till-pay'),
    'Take payment · £[£]': go('till-c2w-pay'),
    'Open the sale': notDrawn('The whole sale opened from the bar along the bottom on a phone (drawn only with a warning, a discount or a customer)'),
    // The payment box
    'Card · £74.00 Sends £74.00 to the card machine': go('till-card'),
    'Card · £70.00 Sends £70.00 to the card machine': go('till-card-discounted'),
    'Card · £54.00 Sends £54.00 to the card machine': go('till-card'),
    'Card · £50.00 Sends £50.00 to the card machine': go('till-card-discounted'),
    'Cash Enter what the customer hands you; the till works out the change': go('till-pay-cash'),
    Cash: go('till-pay-cash'),
    Split: go('till-pay-split'),
    'Gift card or credit': go('till-giftcard'),
    'On account': go('till-account'),
    Deposit: go('till-deposit'),
    'Another amount': STAY,
    // Other ways to pay (decision 15)
    'Finance [Finance provider] — the customer applies, the shop is paid by the lender': outside('[Finance provider]: the customer’s finance application'),
    'Cycle to Work For a bike on a Cycle to Work order': go('till-c2w-pick'),
    'Payment link Text or email the customer a link to pay — once set up': notDrawn('Payment link: texting or emailing the customer a link to pay'),
    '[Shop’s own] Added by the shop in till settings': go('till-receipt'),
    // The card machine (decision 6)
    'Machine not answering? Key it in on the machine instead': outside('The card machine: key the amount in on it'),
    'Try the card again': go('till-card'),
    'Pay another way': go('till-pay'),
    'Cash taken · open the drawer': go('till-receipt'),
    'Use gift card': go('till-receipt'),
    'Put £74.00 on Maya’s account': go('till-receipt'),
    'Take £18.50 now': DEPOSIT_PAID,
    'Take £27.75 now': DEPOSIT_PAID,
    // Paid (decision 7); no customer on the sale
    Email: go('cp-receipt-address'),
    Text: go('cp-receipt-address-text'),
    'No receipt': go('till-empty'),
    // Line, discount, customer, frame number
    'Remove from sale': go('till-sale'),
    'Remove discount': go('till-sale'),
    'Maya Patel maya@example.test · Trek Domane AL 3 Add to sale': go('till-loyalty'),
    'Add new customer to sale': notDrawn('The sale with a new customer just added (only Maya Patel’s row is drawn)'),
    'Add to sale': go('till-sale'),
    'Sell anyway · add to sale': go('till-sale'),
    'Skip for now': go('till-sale'),
    Resume: go('till-sale'),
    // Past sales (decision 13), refunds (9) and voids (10)
    Open: go('till-sale-detail'),
    'Older sale? Find the customer': go('till-find-customer'),
    'Back to today’s sales': go('till-find'),
    Refund: go('till-refund'),
    'Reprint receipt': outside('The printer'),
    Void: go('till-void'),
    'Keep the sale': BACK,
    'Void sale': go('till-find'),
    // The card machine refunds; what the till shows after is the Refunded gap (walk 3, walk-through 2 M3).
    'Refund £28.00 to the card': REFUNDED,
    'Refund £28.00 · open the drawer': REFUNDED,
    'Add [£] to store credit': REFUNDED,
    // Hand-overs
    'Hand over': go('till-empty'),
    'Open Maya Patel’s order at the till': go('till-c2w'),
    'Open [Customer]’s order at the till': go('till-c2w'),
    // Offline
    OK: go('till-offline'),
    'Note it for later': go('till-noted'),
    Fix: notDrawn('A sale that didn’t send, opened with its problem shown'),
  },
  // Done applies the discount: the basket with its Discount line and new total (decisions 3, 4).
  'till-discount': { Done: go('till-discounted') },
  // Book-in is drawn over the empty till: Done closes it there (walk-through 8, decision 8).
  'till-book-in': { Done: go('till-empty') },
  'till-pay-discounted': { Split: go('till-split-discounted') },
  // After paying, Close goes to the empty till, as No receipt does (third walk, walk-through 5 L2).
  'till-receipt': { Close: go('till-empty') },
  'till-receipt-split': { Close: go('till-empty') },
  'till-find-customer': { Refund: go('till-refund-older'), Change: STAY },
  'till-account': { Change: go('till-customer') },
  // Paying with only the certificate: the paid box with nothing from Maya
  // (third walk, answer 4). Close goes back to the sale (walk-through 5 L2).
  'till-c2w-pay': {
    'Cycle to Work · [Provider] · £[£] The certificate · owed by [Provider], not in the drawer · certificate [certificate number]': go('till-c2w-paid-cert'),
    Card: go('till-card'),
    Close: BACK,
  },
  'till-c2w-extra': { 'Card · £[£] Sends £[£] to the card machine': go('till-c2w-paid'), Close: BACK },
  'till-c2w-paid': { Email: go('cp-receipt-address-customer'), Close: go('till-empty') },
  'till-c2w-paid-cert': { Email: go('cp-receipt-address-customer'), Close: go('till-empty') },
};
