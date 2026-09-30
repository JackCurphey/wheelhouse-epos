// Builds the journey 9 canvas (out-moving-sand/project/*) from moving.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './moving.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'moving',
  title: 'Moving from Citrus Lime — journey 9',
  blurb: 'Bringing a shop across from Citrus Lime: dropping in the export files, a plain summary of what came across, the few rows that need a look, and the weekly refresh while running alongside. Designed in the Soft sand look, for review. What Citrus Lime exports is not yet known, so file names and counts are bracketed placeholders.',
  screens, ROWS, TITLES,
});
