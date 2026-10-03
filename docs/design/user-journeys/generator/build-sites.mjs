// Builds the journey 19 canvas (out-sites-sand/project/*) from sites.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './sites.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'sites',
  title: 'Multiple sites — journey 19',
  blurb: 'A business with more than one shop: the shop switcher and “All shops” for owners and managers, Today across every shop, a price or a service that differs at one shop, where each person works, “Which shop?” when booking, adding a shop with a checklist, and every till at every shop. Designed in the Soft sand look, for review. The second shop has no real name yet, so it is [Second site]; figures not already in the designs are bracketed placeholders.',
  screens, ROWS, TITLES,
});
