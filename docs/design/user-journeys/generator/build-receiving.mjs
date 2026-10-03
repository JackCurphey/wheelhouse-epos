// Builds the journey 13 canvas (out-receiving-sand/project/*) from receiving.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './receiving.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'receiving',
  title: 'Receiving stock and purchase orders — journey 13',
  blurb: 'How stock gets into the shop: scanning a delivery in, adding a product Wheelhouse doesn’t know (with its measurements), flagging a job whose part arrived, a purchase order built by hand, and a restock list that downloads for a supplier’s basket. Designed in the Soft sand look, for review. Every product except Shimano brake pads B05S-RX is a bracketed placeholder.',
  screens, ROWS, TITLES,
});
