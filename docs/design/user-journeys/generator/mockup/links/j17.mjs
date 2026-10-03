// Journey 17, Reports and accounts — where each button goes in the mockup.
// From the Reports and accounts decisions (1 Oct): ready-made reports, each
// with "Change what's shown" and "Save as my report"; a closed day reopens
// with a reason; Xero connected from Settings › Your data › Accounts software.
import { go, STAY, outside, notDrawn } from '../controls.mjs';

const SHEET = outside('A spreadsheet download');
const XERO = outside('Xero’s own sign-in page');
const WRITTEN_OFF = notDrawn('The products behind a line of Margin and stock value (stock written off, counted over or under, no cost) — a filtered list');
const SAVED_WORKSHOP = notDrawn('A saved report: Workshop, jobs by service');

export default {
  '*': {
    // Every report
    'All reports': go('rp-home'),
    'Change what’s shown': go('rp-change'),
    'Download as spreadsheet': SHEET,
    Download: SHEET,
    'Back to Sales': go('rp-sales'),
    'Save as my report': go('rp-save'),
    // The Reports page: ready-made reports, and your own
    'Sales › Takings, number of sales and the average sale': go('rp-sales'),
    'Takings and cash-ups › Each closed day and till, and any cash difference': go('rp-takings'),
    'Workshop › Jobs, labour and parts, how full each mechanic was': go('rp-workshop'),
    'Discounts and refunds › Every discount and refund, with its reason': go('rp-discounts'),
    'Returning customers › Who comes back, and who hasn’t been in for a while': go('rp-returning'),
    'Margin and stock value › What you made on what you sold, what’s on the shelves, and stock written off': go('rp-margin'),
    'VAT › VAT by rate for your VAT quarter, for your accountant': go('rp-vat'),
    'Activity log › What was done, when and by whom: prices, voids, refunds, discounts, jobs, stock': go('ops-log'),
    'Cycle to Work: owed and paid › What each provider owes, has paid, and kept as commission': go('rp-c2w'),
    'Shop North Street Cycles, Bolton ›': go('rp-sales'),
    'More for [Report name]': go('rp-report-menu'),
    '[Report name] Sales: items sold by product · Accessories only Shared with managers': go('rp-changed'),
    '[Report name] Sales: items sold by product · Accessories only Just you': go('rp-changed'),
    '[Report name] Workshop: jobs by service Just you': SAVED_WORKSHOP,
    '[Report name] Workshop: jobs by service Shared by Jack Lewis': SAVED_WORKSHOP,
    // Each closed day opens its end-of-day report
    'Mon 14 Sep · B1 ›': go('rp-day'),
    'Tue 15 Sep · B1 ›': go('rp-day'),
    'Wed 16 Sep · B1 ›': go('rp-day'),
    'Wed 16 Sep · B2 ›': go('rp-day'),
    // Settings pages these boards sit in
    'Shop and sites': go('set-shop-details'),
    'Staff and roles': go('set-staff'),
    'Your data': go('set-data-export'),
    // Accounts software
    'Connect Xero': XERO,
    'Reconnect Xero': XERO,
    'Connect QuickBooks': outside('QuickBooks’s own sign-in page'),
    'Disconnect Xero': go('rp-accounts-disconnect'),
    'Choose an account for [Category]': go('rp-accounts-missing'),
    // Today's card
    'Book in': go('till-book-in'),
    'Open the diary': go('diary'),
    // A person's page
    'Clear a forgotten PIN': go('set-staff-clear-pin'),
    'Give everything a Manager can do': go('set-staff-person-all'),
  },
  'rp-report-menu': { Rename: STAY, 'Share with managers': STAY, Delete: go('rp-report-deleted') },
  'rp-report-deleted': { Undo: go('rp-home') },
  'rp-change': { 'Show report': go('rp-changed') },
  'rp-pick-dates': { 'Show report': go('rp-sales') },
  'rp-save': { Save: go('rp-home') },
  'rp-save-taken': { Save: STAY },
  'rp-day': { 'Reopen this day': go('rp-reopen') },
  'rp-reopen': { 'Keep it closed': go('rp-day'), 'Reopen the day': go('rp-takings-reopened') },
  'rp-takings-reopened': { 'Close the day': go('eod-finish') },
  'rp-vat-first': { Save: go('rp-vat') },
  'rp-c2w': { 'See what Cycle to Work providers owe now': go('cw-owed-reports') },
  'rp-returning': { 'Message [Customer]': go('ac-inbox'), '[Customer]': go('cs-page') },
  'rp-margin': {
    'See the products adjusted as damaged': WRITTEN_OFF,
    'See the products adjusted as faulty, to return to the supplier': WRITTEN_OFF,
    'See the products adjusted as found': WRITTEN_OFF,
    'See the products adjusted as lost or stolen': WRITTEN_OFF,
    'See the products adjusted as used in the workshop': WRITTEN_OFF,
    'See the products adjusted for another reason': WRITTEN_OFF,
    'See the stock takes counted over': WRITTEN_OFF,
    'See the stock takes counted under': WRITTEN_OFF,
    'See them and add a cost': WRITTEN_OFF,
  },
  'rp-accounts-disconnect': { Disconnect: go('rp-accounts-connect'), 'Keep connected': go('rp-accounts-map') },
};
