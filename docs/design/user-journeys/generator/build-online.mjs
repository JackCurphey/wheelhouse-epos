// Builds the journey 2 canvas (out-online-sand/project/*) from online.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './online.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'online',
  title: 'Buy online and click and collect — journey 2',
  blurb: 'Buying from the shop’s website and collecting from a shop: what a product says about when it’s ready, choosing the shop once, the basket, a one-page checkout (no account needed; card, Apple Pay, Google Pay, gift cards and store credit), the order’s own page from ordered to ready, cancelling and refunds — and the shop’s side: Online orders in three groups, marking an order ready, an item the shop can’t supply, Today, and the settings for what the website sells. Designed in the Soft sand look, for review. Products other than the example brake pads, order numbers, totals and times are bracketed placeholders.',
  screens, ROWS, TITLES,
});
