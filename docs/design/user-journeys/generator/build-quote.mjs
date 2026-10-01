// Builds the journey 4 canvas (out-quote-sand/project/*) from quote.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './quote.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'quote',
  title: 'Drop off and approve the quote — journey 4',
  blurb: 'The bike’s time in the shop from the customer’s side: one page for the job from booking to ready, a tracker with the expected ready time, and a quote to answer with ticks set the way the mechanic recommends and a photo of what was found — plus the shop sending the quote in one click, chasing an unanswered one, and recording an answer given on the phone. Designed in the Soft sand look, for review. Figures not already in the designs are bracketed placeholders.',
  screens, ROWS, TITLES,
});
