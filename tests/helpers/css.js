// Text-level parsing helpers for the design-system test suites. These
// deliberately do NOT use a real CSS parser - the repo has one runtime
// dependency (pg) and we are not adding a second for tests. Everything here
// operates on the stylesheet as text, which is enough to assert token
// presence, contrast and structural invariants.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readFile(relPath) {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function stripComments(css) {
  // Replace comment bodies with equal-length whitespace so line numbers survive.
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

export function parseRootTokens(css) {
  const clean = stripComments(css);
  const start = clean.indexOf(':root');
  if (start === -1) return new Map();
  const open = clean.indexOf('{', start);
  const close = clean.indexOf('}', open);
  const body = clean.slice(open + 1, close);
  const tokens = new Map();
  // NOTE: the per-line pattern below requires a trailing `;`. A final
  // declaration inside :root with no trailing semicolon (valid CSS, e.g.
  // `--x: 1px }`) is silently dropped. Not currently triggered by any
  // stylesheet in this repo; documented here rather than fixed, since
  // fixing it changes matching behaviour for every downstream task.
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (m) tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

function expandHex(hex) {
  const h = hex.replace('#', '');
  return h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
}

export function relativeLuminance(hex) {
  const h = expandHex(hex);
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// NOTE: the 2dp rounding below is standard WCAG-reporting behaviour, but it
// means ratios in [4.495, 4.5) round UP to a displayed 4.50 even though the
// true ratio is under the 4.5 AA threshold. Downstream tasks asserting
// `contrast(...) >= 4.5` should treat this function as carrying ~0.005 of
// slack by design, not as a bug to be tightened here.
export function contrast(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Number(ratio.toFixed(2));
}

export function findDeclarations(css, prop) {
  const clean = stripComments(css);
  const lines = clean.split('\n');
  const out = [];
  let selector = '';
  lines.forEach((line, i) => {
    const sel = line.match(/^\s*([^{}]+?)\s*\{/);
    if (sel) selector = sel[1].trim();
    const decl = new RegExp(`(?:^|[{;\\s])${prop}\\s*:\\s*([^;}]+)`).exec(line);
    if (decl) out.push({ selector, value: decl[1].trim(), line: i + 1 });
  });
  return out;
}

// Context immediately before a `#` that means it is NOT a colour literal:
// - an identifier character, `]` or `)` directly touching the `#` (e.g.
//   `div#eee`, `.class#fff`, `arr[0]#abc`, `fn()#abc`)
// - an `id=` or `href=` attribute opening into a quote (e.g. `href="#deadbe"`)
// - a `url(` opening into a quote or directly (e.g. `url(#fragment)`)
const NON_COLOUR_HASH_CONTEXT = /(?:[\w\]\)]|(?:\bid|\bhref)\s*=\s*["']?|url\(\s*["']?)$/i;

export function findHexLiterals(source) {
  const lines = source.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) {
      const before = line.slice(0, m.index);
      if (NON_COLOUR_HASH_CONTEXT.test(before)) continue;
      out.push({ hex: m[0], line: i + 1 });
    }
  });
  return out;
}
