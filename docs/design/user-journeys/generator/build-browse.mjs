// Builds the journey 1 canvas (out-browse-sand/project/*) from browse.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './browse.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'browse',
  title: 'Find the shop and browse the website — journey 1',
  blurb: 'The shop’s own website: a home page made of sections the shop arranges, category pages with filters from each category’s details, a product page with photos, sizes and colours and specifications, one search box for products, repairs and categories, Our shops with a page for each shop, page not found and a switched-off website, and cookie choices for shops that add a tracking tool. Designed in the Soft sand look, for review. Products, photos and the shop’s words are bracketed placeholders.',
  screens, ROWS, TITLES,
});
