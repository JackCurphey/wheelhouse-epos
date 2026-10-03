// Builds the journey B canvas (out-signin-sand/project/*) from signin.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './signin.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'signin',
  title: 'Signing in and access — journey B',
  blurb: 'Staff sign-in and access, the till’s set-up and PIN check-in, and customer sign-in — redrawn in the Soft sand look, for review. Names shown are examples.',
  screens, ROWS, TITLES,
});
