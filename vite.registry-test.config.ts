import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { globSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

/**
 * The registry's component-test build, run by `pretest` after
 * vite.test.config.ts (which empties .test-build/ and builds src/).
 *
 * registry/ sits outside src/, so it gets its own SSR build into
 * .test-build/registry/, one output file per source file
 * (registry/patterns/day-diary.tsx -> .test-build/registry/patterns/day-diary.js).
 * Registry files import siblings as "@/registry/..." and cn as "@/lib/utils",
 * so both aliases are mapped here, "@/registry/" first.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export default defineConfig({
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/registry\//, replacement: fileURLToPath(new URL('./registry/', import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
    ],
  },
  build: {
    ssr: true,
    outDir: '.test-build/registry',
    emptyOutDir: true,
    minify: false,
    rolldownOptions: {
      input: globSync('registry/**/*.tsx'),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'registry',
        entryFileNames: '[name].js',
      },
    },
  },
});
