import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/theme.css';
import { AppShell } from './app-shell.tsx';

/**
 * Staff entry point.
 *
 * Mounts only where #wh-root exists, which is public/workshop.html - served at
 * /workshop and /workshop/* (server/server.js). The old vanilla app
 * (public/app.js) has no #wh-root, so if this bundle ever loads there it
 * still does nothing.
 */
const container = document.getElementById('wh-root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <AppShell />
    </StrictMode>,
  );
}
