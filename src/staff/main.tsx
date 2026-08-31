import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/theme.css';

/**
 * Phase-one staff entry point.
 *
 * This bundle is deliberately INERT. The existing vanilla-JS staff app
 * (public/app.js) renders the whole UI and has no #wh-root element, so when
 * this script loads it finds nothing to mount into and does nothing at all.
 * React screens are opted into later, one at a time, by adding #wh-root.
 */
const container = document.getElementById('wh-root');

if (container) {
  createRoot(container).render(<StrictMode />);
}
