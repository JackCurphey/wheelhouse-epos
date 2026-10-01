// Builds the journey 17 canvas (out-reports-sand/project/*) from reports.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './reports.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'reports',
  title: 'Reports and accounts — journey 17',
  blurb: 'How an owner or manager sees how the business is doing and gets the figures to the accountant: ready-made reports (sales, takings and cash-ups, workshop, discounts and refunds, margin and stock value, VAT), reports you build and save yourself, past cash-ups and reopening a day, Xero or QuickBooks with one summary per shop per closed day, and who sees costs and margin. Designed in the Soft sand look, for review. No real figures exist yet, so every amount is a bracketed placeholder.',
  screens, ROWS, TITLES,
});
