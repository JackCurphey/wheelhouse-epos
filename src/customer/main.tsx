import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/theme.css';
import { CustomerAppShell } from './app-shell.tsx';

/**
 * Customer entry point. Mounts only where #wh-book-root exists, which is
 * public/book.html - served at /book and /book/* (server/server.js).
 */
const container = document.getElementById('wh-book-root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <CustomerAppShell />
    </StrictMode>,
  );
}
