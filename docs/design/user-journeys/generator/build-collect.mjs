// Builds the journey 5 canvas (out-collect-sand/project/*) from collect.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './collect.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'collect',
  title: 'Collect the bike and pay — journey 5',
  blurb: "The end of a workshop job: the customer's Bike ready link with what was done and Pay now, paying online, and the counter's one main button — Take payment or Hand over. Designed in the Soft sand look, for review. Figures not already in the designs are bracketed placeholders.",
  screens, ROWS, TITLES,
});
