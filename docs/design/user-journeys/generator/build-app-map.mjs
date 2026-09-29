// Builds the journey A canvas (out-app-map-sand/project/*) from app-map.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES, MAP_W, MAP_H } from './app-map.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'app-map',
  title: 'App map and navigation — journey A',
  blurb: 'The frame around every page — staff app, till and customer website — redrawn in the Soft sand look, for review. Names, bikes and prices shown are examples.',
  screens, ROWS, TITLES, singleSize: [MAP_W, MAP_H],
});
