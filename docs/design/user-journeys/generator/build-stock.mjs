// Builds the journey 14 canvas (out-stock-sand/project/*) from stock.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './stock.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'stock',
  title: 'Stock take and stock control — journey 14',
  blurb: 'The rest of the Stockroom: finding stock (by name, barcode, supplier code or a measurement), a product’s page, sizes and colours, bikes by frame number, counting stock, and correcting it. Designed in the Soft sand look, for review. Every product except Shimano brake pads B05S-RX and the Trek Domane AL 3 is a bracketed placeholder.',
  screens, ROWS, TITLES,
});
