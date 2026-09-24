import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { globSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

/**
 * The component-test build, run by `pretest` - not the bundle the app ships.
 *
 * `node --test` cannot parse JSX or resolve the `@/` alias, so this compiles
 * src/ into .test-build/ as plain ESM that tests import directly. preserveModules
 * keeps one output file per source file at the same relative path
 * (src/staff/app-shell.tsx -> .test-build/staff/app-shell.js). As an SSR build,
 * packages stay external, so a test and the built code share one React.
 * Spec: docs/superpowers/specs/2026-09-23-component-test-build-step.md
 */

// Everything but the browser entry, which mounts into a page and imports CSS.
// Filtered here rather than with globSync's `exclude`, whose array form is
// newer than the Node 22 CI runs.
const input = globSync('src/**/*.{ts,tsx}').filter(
  (file) => !file.endsWith('.d.ts') && file !== 'src/staff/main.tsx',
);

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    ssr: true,
    outDir: '.test-build',
    emptyOutDir: true,
    minify: false,
    rolldownOptions: {
      input,
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
});
