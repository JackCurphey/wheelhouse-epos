// Builds the journey 16 canvas (out-cashup-sand/project/*) from cashup.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './cashup.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'cashup',
  title: 'End-of-day cash-up — journey 16',
  blurb: 'Closing the till’s day on one page: sales sent, anything flagged, the cash count, banking, the card check and the day’s report — designed in the Soft sand look, for review. Takings figures are bracketed placeholders.',
  screens, ROWS, TITLES,
});
