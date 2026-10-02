// Builds the journey 18 canvas (out-website-sand/project/*) from website.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './website.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'website',
  title: 'Website management — journey 18',
  blurb: 'How the owner sets up and changes the shop’s website: a three-step start, the Website page, editing on a live preview with sections and a Theme tab, publishing and earlier versions, pages, tracking tools, the shop’s own web address, connecting online payments, and connecting a Shopify shop instead. Designed in the Soft sand look, desktop first, for review. Addresses, IDs, dates and the payment provider are bracketed placeholders.',
  screens, ROWS, TITLES,
});
