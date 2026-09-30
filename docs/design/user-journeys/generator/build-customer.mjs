// Builds the journey 15 canvas (out-customer-sand/project/*) from customer.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './customer.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'customer',
  title: 'Customer service — journey 15',
  blurb: 'The staff side of customers: finding someone, their page — bikes, jobs, sales and refunds, account, loyalty and messages — and keeping the list tidy. Designed in the Soft sand look, for review. Figures not already in the designs are bracketed placeholders.',
  screens, ROWS, TITLES,
});
