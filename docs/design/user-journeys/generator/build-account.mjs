// Builds the journey 7 canvas (out-account-sand/project/*) from account.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './account.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'account',
  title: 'Account, history and reminders — journey 7',
  blurb: 'The customer’s account on the shop’s website — bikes with their warranty, store credit, details, how the shop contacts them, and one history of repairs and purchases — plus talking to the shop from a job’s page or the account, the staff Messages inbox, service reminders customers say yes to once, review requests, a one-click stop in every optional message, and a copy or deletion of their data. Designed in the Soft sand look, for review. Figures not already in the designs, and what people write, are bracketed placeholders.',
  screens, ROWS, TITLES,
});
