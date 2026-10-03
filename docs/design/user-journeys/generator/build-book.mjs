// Builds the journey 3 canvas (out-book-sand/project/*) from book.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './book.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'book',
  title: 'Book a repair — journey 3',
  blurb: 'A customer booking a repair on the shop’s website: every service at once, their bike, a day and time, their details and an optional deposit — on one page, a step at a time, with Your booking down the side. Then the booking’s own page to change or cancel it, and the shop’s Online booking settings. Designed in the Soft sand look, for review. Figures not already in the designs are bracketed placeholders.',
  screens, ROWS, TITLES,
});
