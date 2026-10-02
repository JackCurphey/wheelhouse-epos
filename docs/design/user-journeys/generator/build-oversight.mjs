// Builds the journey 20 canvas (out-oversight-sand/project/*) from oversight.mjs.
// Run with --theme sand. Does not touch out/ or the user journeys canvas.
import { screens, ROWS, TITLES } from './oversight.mjs';
import { buildSandCanvas } from './sand-canvas.mjs';

buildSandCanvas({
  name: 'oversight',
  title: 'Management oversight — journey 20',
  blurb: 'How an owner or manager keeps an eye on the shop without slowing staff down: one activity log in Reports, a few alerts on Today above amounts the shop sets, where people are signed in with “Sign out everywhere”, and “Send feedback” to the Wheelhouse team for everyone. Designed in the Soft sand look, desktop first, for review. Times, amounts, sale numbers, reasons and devices are bracketed placeholders.',
  screens, ROWS, TITLES,
});
