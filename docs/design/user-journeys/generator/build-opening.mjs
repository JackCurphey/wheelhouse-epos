// Builds the journey 10 canvas (out-opening-sand/project/*) from opening.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './opening.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'opening',
  title: 'Opening the shop — journey 10',
  blurb: 'The start of the day: checking in at the till, a quick look at the float, and Office › Today for owners and managers. Designed in the Soft sand look, for review. Figures not already in the designs are bracketed placeholders.',
  screens, ROWS, TITLES,
});
