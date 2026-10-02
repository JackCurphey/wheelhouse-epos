// Builds the journey 21 canvas (out-lightspeed-sand/project/*) from lightspeed.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './lightspeed.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'lightspeed',
  title: 'Lightspeed shops — journey 21',
  blurb: 'A shop that keeps Lightspeed as its till: Wheelhouse runs the workshop and Lightspeed does the money. The owner connects Lightspeed in Settings with a checklist; quote parts come from Lightspeed’s products; an approved job becomes a Lightspeed work order by itself; Wheelhouse shows when it’s paid; when Lightspeed can’t be reached the workshop carries on. Designed in the Soft sand look, desktop first, for review. Lightspeed’s own names and numbers are bracketed placeholders.',
  screens, ROWS, TITLES,
});
