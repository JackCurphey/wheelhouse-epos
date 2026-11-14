// Online money, not the till's (Jack's answer 7, 27 Oct): the old record's
// tender for a Shopify order (server.js), a deposit paid online
// (workshop/counted-deposit.js) and an online order's card part (online-orders/pay.js).
// One list, for close of day's online line and the accounts summary's online bucket.
import { DEPOSIT_TENDER } from '../workshop/counted-deposit.js';

export const ORDER_TENDER = 'Paid online';
export const ONLINE_TENDERS = ['Shopify', DEPOSIT_TENDER, ORDER_TENDER];
