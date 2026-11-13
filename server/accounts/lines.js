// The lines of a day's summary, each with an account chosen for it (reports-accounts-and-reopen design 6; the
// drawing's "Which Xero account each line goes to"): Sales go to (the shop's Stockroom categories, Labour, and
// sales with no category), Money taken goes to (how it was paid, with the online money apart), and Everything else
// goes to. `recorded` is false for a line Wheelhouse doesn't record yet (refunds and discounts given, WP-3.1): it
// can be chosen now but never holds a day up (Jack's answer 2 of 12 Nov).
import { onlyChoices } from '../lib/report-changed.js';

export const OTHER_SALES = 'Other sales';

const MONEY = [
  ['money:cash', 'Cash'], ['money:card', 'Card'], ['money:accounts', 'Customer accounts'], ['money:gift', 'Gift cards'],
  ['money:online', 'Online sales (paid on the website)'],
];
const ELSE = [
  ['other:cash_difference', 'Cash differences', true], ['other:refunds', 'Refunds', false], ['other:discounts', 'Discounts given', false], ['other:vat', 'VAT on sales', true],
];

export async function accountLines() {
  // One line for each name: Labour (added by onlyChoices) and Other sales are lines of their own, so a shop's own
  // category with the same name shares them; a key is capped to what the database holds.
  const categories = [...new Set([...(await onlyChoices()), OTHER_SALES])].filter((name) => `sales:${name}`.length <= 400);
  return [
    { key: 'sales', title: 'Sales go to', lines: categories.map((name) => ({ key: `sales:${name}`, label: name, recorded: true })) },
    { key: 'money', title: 'Money taken goes to', lines: MONEY.map(([key, label]) => ({ key, label, recorded: true })) },
    { key: 'other', title: 'Everything else goes to', lines: ELSE.map(([key, label, recorded]) => ({ key, label, recorded })) },
  ];
}
