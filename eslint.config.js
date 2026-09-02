import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Flat config. Scope is the NEW React source tree only - server/ and the
 * existing vanilla-JS frontends (public/, public-portal/, public-storefront/)
 * stay plain JavaScript and are deliberately not linted here.
 */

// Design-system enforcement gate #1.
// shadcn primitives are only ever imported from the "@/components/ui" barrel
// directory. Reaching around it - straight into Radix, or into a registry
// source path - bypasses our wrappers (and the theme tokens they carry).
const restrictedImports = {
  paths: [],
  patterns: [
    {
      group: ['radix-ui', 'radix-ui/*', '@radix-ui', '@radix-ui/*'],
      message:
        'Do not import Radix directly. Use the wrapped primitive from "@/components/ui".',
    },
    {
      group: ['@/registry', '@/registry/*', '**/registry/*'],
      message:
        'Do not import from the registry source. Use the installed component from "@/components/ui".',
    },
    {
      group: ['../components/ui/*', '../../components/ui/*', '../../../components/ui/*', './components/ui/*'],
      message: 'Import UI primitives via the "@/components/ui" alias, not a relative path.',
    },
  ],
};

// Design-system enforcement gate #2.
// Per-shop theming is applied at RUNTIME as CSS custom properties
// (public/app.js sets --accent, --accent-dark, --modal-bg per shop). Tailwind
// compiles at BUILD time and cannot emit classes for shops that do not exist
// yet, so any colour baked into a className - an arbitrary value like
// bg-[#123456] or a raw hex - is a shop-theming bug waiting to happen.
// Colour must come from @theme tokens, which resolve to those custom properties.
const noHardcodedColour = [
  // Deliberately NOT scoped to className JSX attributes. shadcn puts its
  // colours inside cva() variant maps, which are plain object literals - a
  // className-only selector misses exactly the place colour actually lives.
  // `[var(--token)]` is allowed: that is the runtime-themeable form we want.
  {
    selector: 'Literal[value=/\\[#|#[0-9a-fA-F]{3}\\b|#[0-9a-fA-F]{6}\\b/]',
    message:
      'No raw hex colours. Per-shop theming is runtime CSS custom properties, so colour must come from an @theme token (or an explicit [var(--token)] arbitrary value).',
  },
  {
    selector: 'TemplateElement[value.raw=/\\[#|#[0-9a-fA-F]{3}\\b|#[0-9a-fA-F]{6}\\b/]',
    message:
      'No raw hex colours. Per-shop theming is runtime CSS custom properties, so colour must come from an @theme token (or an explicit [var(--token)] arbitrary value).',
  },
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      // Claude Code workflow definitions, not application source. They are
      // fragments executed by the harness, so a top-level `return` is legal
      // there and a parse error to ESLint. Same reasoning as server/ and
      // tests/ below: this config lints src/ and registry/ only.
      '.claude/**',
      'public/**',
      'public-demo/**',
      'public-portal/**',
      'public-storefront/**',
      'print-agent/**',
      'server/**',
      'tests/**',
      'docker/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'registry/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': ['error', restrictedImports],
      'no-restricted-syntax': ['error', ...noHardcodedColour],
    },
  },
  {
    // Registry SOURCE is exempt from the @/registry import ban: a pattern
    // importing a primitive is exactly how shadcn registry authoring works,
    // and the CLI rewrites those specifiers on install. The ban exists to stop
    // APPLICATION code (src/) reaching around @/components/ui.
    files: ['registry/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    // The wrappers themselves are the one place allowed to touch Radix.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
);
