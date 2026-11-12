import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/theme.css';
import { WebsiteApp } from './app-shell.tsx';

/**
 * The customer website's entry point (openspec/changes/website-browse,
 * design 1). Mounts only where #wh-site-root exists, which is
 * public/website.html - served at /store/<slug>/ and on the shop's own
 * address (server/server.js).
 */
const container = document.getElementById('wh-site-root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <WebsiteApp />
    </StrictMode>,
  );
}
