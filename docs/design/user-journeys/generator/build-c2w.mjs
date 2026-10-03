// Builds the journey 6 canvas (out-c2w-sand/project/*) from c2w.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './c2w.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'c2w',
  title: 'Cycle to Work — journey 6',
  blurb: 'Not a scheme: the shop’s side of a bike sold through one. Front desk › Cycle to Work lists every order by stage, from the quote to the provider’s payment; bikes in stock are held from the quote, bikes to order follow the shop’s rule; the certificate, the hand-over at the till, and what each provider owes. Designed in the Soft sand look, desktop first, for review. Providers, bikes, prices, dates and references are bracketed placeholders.',
  screens, ROWS, TITLES,
});
