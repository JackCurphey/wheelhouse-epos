// Journey 20, Management oversight — where each button goes in the mockup.
// Later screens (issue #116 question 5) are listed as not drawn.
import { go, STAY, outside, notDrawn } from '../controls.mjs';

const LATER = (what) => notDrawn(`${what} — later (issue #116 question 5)`);

const LOG = {
  'All reports': go('rp-home'),
  'Download as spreadsheet': outside('A spreadsheet of the activity log, downloaded'),
  Download: outside('A spreadsheet of the activity log, downloaded'),
  'Open Sale [sale number]': go('till-sale-detail'),
  'Open Shimano brake pads B05S-RX': go('st-product'),
  'Open [Product]': go('st-product'),
  'Open job WH-1045': go('job-overview'),
  'Open the float setting': go('set-eod'),
  'Open the refund': go('till-sale-detail'),
  'Open the voided sale': go('till-sale-detail'),
  'Open the website’s history': go('ws-history'),
  // Filters act in place
  'Person: Everyone': STAY,
  'Person: Alex Morgan': STAY,
  'Type of action: Everything': STAY,
  'Type of action: Refund': STAY,
  'Shop: All shops': STAY,
  'Show only Alex Morgan': STAY,
  'Show only Jack Lewis': STAY,
  'Show only Jo Taylor': STAY,
};

const REPORTS = {
  'Shop North Street Cycles, Bolton ›': go('ms-switch-open'),
  'Sales › Takings, number of sales and the average sale': go('rp-sales'),
  'Takings and cash-ups › Each closed day and till, and any cash difference': go('rp-takings'),
  'Workshop › Jobs, labour and parts, how full each mechanic was': go('rp-workshop'),
  'Discounts and refunds › Every discount and refund, with its reason': go('rp-discounts'),
  'Returning customers › Who comes back, and who hasn’t been in for a while': go('rp-returning'),
  'Margin and stock value › What you made on what you sold, what’s on the shelves, and stock written off': go('rp-margin'),
  'VAT › VAT by rate for your VAT quarter, for your accountant': go('rp-vat'),
  'Activity log › What was done, when and by whom: prices, voids, refunds, discounts, jobs, stock': go('ops-log'),
  'Cycle to Work: owed and paid › What each provider owes, has paid, and kept as commission': go('rp-c2w'),
  'More for [Report name]': go('rp-report-menu'),
  '[Report name] Sales: items sold by product · Accessories only Shared with managers': go('rp-sales'),
  '[Report name] Sales: items sold by product · Accessories only Just you': go('rp-sales'),
  '[Report name] Workshop: jobs by service Just you': go('rp-workshop'),
  '[Report name] Workshop: jobs by service Shared by Jack Lewis': go('rp-workshop'),
};

export default {
  'ops-reports-home': REPORTS,
  'ops-reports-staff': { ...REPORTS, 'Discounts and refunds › Every discount and refund, with its reason': go('rp-discounts-staff') },
  'ops-log': LOG,
  'ops-log-manager': LOG,
  'ops-log-all': LOG,
  'ops-log-empty': { ...LOG, 'Clear the filters': go('ops-log') },
  'ops-log-refused': {
    'Back to Today': go('op-today-staff'),
    'See my own activity': LATER('Your activity: a person’s own lines'),
  },
  // Settings › Office, with the check-out box open
  'ops-till-checkout': {
    'Shop and sites': STAY, 'Staff and roles': STAY, 'Your data': STAY, // jumps within this page
    'Settings › Front desk › Till': go('set-till-tills-owner'),
    'Check out Jo Taylor — Till B1': go('ops-till-checkout'),
    'Check out Jo Taylor': notDrawn('Settings › Office after checking Jo Taylor out: Till B1 with nobody checked in'),
    'Sign out — [Computer] · [browser]': LATER('Sign a computer out'),
    'Sign out — [Phone model] · [browser]': LATER('Sign a computer out'),
  },
};
