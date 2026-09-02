import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// The React bundle is served by the existing plain-Node server out of
// public/dist, so `base` must match the URL path the server exposes.
// Filenames stay content-hashed (Vite's default) because public/ is served
// with long-lived caching.
export default defineConfig({
  base: '/dist/',
  // outDir lives INSIDE the default publicDir (public/), so Vite would copy
  // the whole vanilla app - app.js, index.html, styles.css - into its own
  // bundle on every build. That is not just bloat: public/dist/app.js is an
  // unhashed stale copy that the immutable cache rule below would then pin
  // in browsers for a year. There is no static directory to copy here.
  publicDir: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      // Named entry points: later phases add e.g. `portal` here without
      // restructuring the build.
      input: {
        staff: fileURLToPath(new URL('./src/staff/main.tsx', import.meta.url)),
      },
    },
  },
});
