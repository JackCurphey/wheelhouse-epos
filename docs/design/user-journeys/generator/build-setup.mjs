// Builds the journey 8 canvas (out-setup-sand/project/*) from setup.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './setup.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'setup',
  title: 'Owner setup — journey 8',
  blurb: 'Where the shop’s owner and managers set up the till, payments, end of day, staff and workshop — designed in the Soft sand look, for review. Figures and names not already in the designs are bracketed placeholders.',
  screens, ROWS, TITLES,
});
