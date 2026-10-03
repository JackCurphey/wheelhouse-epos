// Builds the journey 11 canvas (out-till-sand/project/*) from till.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './till.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'till',
  title: 'Selling at the till — journey 11',
  blurb: 'Ringing up a sale, taking payment, the other till jobs and working offline — designed in the Soft sand look, for review. Names and prices shown are examples; bracketed items are placeholders.',
  screens, ROWS, TITLES,
});
