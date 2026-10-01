// Shared markup in the style of the app's shadcn components (registry/primitives).
// Two themes live here: Fjell (the original, still the default everywhere)
// and Sand (decision 48, 28 Sep 2026 — "Soft sand, dark rail" / look-4 in
// looks.mjs, now Wheelhouse's standard look). Theme choice is read straight
// off process.argv/process.env at module-evaluation time (see THEME below)
// so it works regardless of ESM import order — process.argv is populated by
// Node before any module code runs, unlike a setTheme() call from another
// module, which would depend on which file imports ui.mjs first.
//
// Callers pick the theme with `--theme sand` on the command line (or
// WH_THEME=sand in the environment); no flag/env var means Fjell, so every
// existing build (build.mjs, build-job-options.mjs) is completely unaffected.
const argIdx = process.argv.indexOf('--theme');
export const THEME = (argIdx !== -1 ? process.argv[argIdx + 1] : process.env.WH_THEME) === 'sand' ? 'sand' : 'fjell';

// Fjell theme tokens (chosen by Jack, 27 Sep 2026). Names follow the shadcn variables:
// accent = primary action, accentDark = sidebar, brand = highlight.
// Unchanged from before the theme switch was added — kept byte-for-byte so
// every default (non --theme) build stays identical.
const FJELL = {
  accent: '#3f4d33', accentDark: '#2a3024', ink: '#1c1e19', muted: '#56594f', border: '#dcdbd3', bg: '#f3f2ee', panel: '#fbfbf9', brand: '#3f4d33',
  highlight: '#c5cf3e', highlightRgb: '197,207,62', input: '#83867a', hover: '#e8e7e1',
  danger: '#a8321f', dangerInk: '#a5301f', dangerBg: '#f8e7e3',
  warnBg: '#fff7e0', warnInk: '#8a6100', okBg: '#e8f5ec', successInk: '#2a3024',
  blueBg: '#eaf1fb', blueInk: '#2c5289', purpleBg: '#f1e8fb', purpleInk: '#6a3ea1',
  mutedBg: '#e8e7e1', sidebarActive: '#3f4d33', sidebarInk: '#f3f2ee',
  // accentSoft/accentSoftInk: a tint of Fjell's own olive accent, for the
  // diary toolbar's selected people chips (decision 60) — same role as
  // Sand's accentSoft above.
  accentSoft: '#e4e8d2', accentSoftInk: '#3f4d33',
  cardShadow: '0 1px 2px rgba(28,30,25,0.06), 0 6px 18px rgba(28,30,25,0.06)',
};
// Sand theme tokens (decision 48, 28 Sep 2026 — look-4 "Soft sand, dark
// rail" in looks.mjs). Every value below is look-4's own palette/status
// object, or (for the generic badge tones blue/purple/hover/dangerInk/
// successInk that Fjell has but look-4's four-look board never drew) the
// nearest equivalent tuned to look-4's ink/paper so nothing reads as
// leftover olive/lime.
// muted/mutedBg are darkened/lightened slightly from a first pass at
// look-4's own muted (#79725E) so the "Cancelled" status badge and other
// grey-tone badges/text clear 4.5:1 against their pill background as well
// as against the page and card backgrounds (see the fit-check contrast
// report — this was the lowest-contrast pair before the adjustment, at
// 3.92:1).
const SAND = {
  accent: '#2A2822', accentDark: '#262420', ink: '#2A2822', muted: '#6E6752', border: '#E6DFCB', bg: '#F4EEE1', panel: '#FFFDF7', brand: '#2A2822',
  highlight: '#D9A441', highlightRgb: '217,164,65', input: '#6E6752', hover: '#EFE8D6',
  danger: '#9C3B2C', dangerInk: '#7A2C20', dangerBg: '#F6E3DE',
  warnBg: '#F7EAC2', warnInk: '#7A5A10', okBg: '#E1EEDD', successInk: '#295C39',
  blueBg: '#E4EAF3', blueInk: '#294872', purpleBg: '#ECE3F2', purpleInk: '#5C3E87',
  mutedBg: '#F0EADC', sidebarActive: '#39352E', sidebarInk: '#F4EEE1',
  // accentSoft/accentSoftInk: look-4's own tint (looks.mjs) — used for the
  // diary toolbar's selected people chips (decision 60), so a selected
  // filter reads as tinted, never as the same solid ink as a primary button.
  accentSoft: '#F1E3BE', accentSoftInk: '#7A5A10',
  cardShadow: 'none',
};
export const C = THEME === 'sand' ? SAND : FJELL;
export const FONT = THEME === 'sand' ? `'Public Sans', ui-sans-serif, system-ui, sans-serif` : `'Work Sans', ui-sans-serif, system-ui, sans-serif`;
// Headings (page titles, dialog titles, section headings) use a serif face
// under Sand (decision 48/47: "a characterful heading face over a plain
// body face"). Everything already routed through FONT stays Public Sans;
// callers that draw headings (h1() in stage1.mjs, h2() in diary.mjs/
// job-page.mjs) switch to FONT_DISPLAY explicitly.
// Jack, 28 Sep: sans-serif throughout — headings use the body face too.
export const FONT_DISPLAY = FONT;
// DM Mono, same as Fjell, for job numbers/prices in both themes — it already
// sits well against a warm paper background and keeping one mono face avoids
// a second font-loading round trip on every board.
export const MONO = `'DM Mono', ui-monospace, monospace`;
export const FONT_LINK = THEME === 'sand'
  ? 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap'
  : 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap';
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Lucide-style stroke icons (24-unit grid), drawn inline.
const P = {
  today: '<path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/>',
  till: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4"/>',
  workshop: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  orders: '<path d="M6 2l-2 4v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4z"/><path d="M4 6h16M16 10a4 4 0 0 1-8 0"/>',
  stock: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  purchasing: '<path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  customers: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15.1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.2V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M2 9a15 15 0 0 1 20 0"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  basket: '<path d="M5 8h14l-1.5 11h-11z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10 8v8M14 8v8M17 8v8"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
};
export const icon = (name, size = 18, color = 'currentColor') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0">${P[name]}</svg>`;

// Button, as registry/primitives/button.tsx
export function button(text, { variant = 'accent', block = false, size = 'default', href = null, iconName = null } = {}) {
  const v = {
    accent: `border: 1px solid ${C.accent}; background: ${C.accent}; color: #ffffff`,
    primary: `border: 1px solid ${C.brand}; background: ${C.brand}; color: #ffffff`,
    default: `border: 1px solid ${C.input}; background: ${C.panel}; color: ${C.ink}`,
    ghost: `border: 1px solid transparent; background: transparent; color: ${C.ink}`,
    danger: THEME === 'sand' ? `border: 1px solid ${C.danger}; background: transparent; color: ${C.danger}` : `border: 1px solid ${C.danger}; background: ${C.danger}; color: #ffffff`,
  }[variant];
  const pad = size === 'sm' ? 'padding: 5px 10px; font-size: 13px; border-radius: 6px' : 'padding: 11px 16px; font-size: 15px; border-radius: 6px; min-height: 44px';
  const style = `display: ${block ? 'flex' : 'inline-flex'}; ${block ? 'width: 100%;' : ''} box-sizing: border-box; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-family: inherit; text-decoration: none; ${pad}; ${v}`;
  const inner = `${iconName ? icon(iconName, 16) : ''}${esc(text)}`;
  return href ? `<a href="${href}" style="${style}">${inner}</a>` : `<button type="button" style="${style}">${inner}</button>`;
}

// Field = Label + Input, as registry/primitives/label.tsx + input.tsx
// autocomplete and linked (Buy online audit M10, opt-in for now): autofill,
// and the hint and error tied to the box for screen readers.
export function field(label, { value = '', placeholder = '', type = 'text', hint = '', error = '', id, autocomplete = '', linked = false } = {}) {
  const fid = id || 'f-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const desc = linked ? [hint && `${fid}-hint`, error && `${fid}-err`].filter(Boolean).join(' ') : '';
  const extra = `${autocomplete ? ` autocomplete="${autocomplete}"` : ''}${desc ? ` aria-describedby="${desc}"` : ''}${linked && error ? ' aria-invalid="true"' : ''}`;
  return `<div style="display: flex; flex-direction: column; gap: 6px">
<label for="${fid}" style="font-size: 14px; font-weight: 600; color: ${C.ink}">${esc(label)}</label>
<input id="${fid}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"${extra} style="width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid ${error ? C.danger : C.input}; background: ${C.panel}; padding: 11px 10px; min-height: 44px; font-size: 14px; font-family: inherit; color: ${C.ink}">
${hint ? `<div${linked ? ` id="${fid}-hint"` : ''} style="font-size: 13px; color: ${C.muted}; line-height: 1.4">${esc(hint)}</div>` : ''}
${error ? `<div${linked ? ` id="${fid}-err"` : ''} style="font-size: 13px; color: ${C.danger}; line-height: 1.4">${esc(error)}</div>` : ''}
</div>`;
}

// Card shadows off, hairline border only, under Sand (decision 48: "hairline
// rules and space rather than boxes and shadows") — C.cardShadow is 'none'
// there and the original two-layer drop shadow under Fjell.
export const card = (inner, extra = '') => `<div style="box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: ${C.cardShadow}; ${extra}">${inner}</div>`;

export const badge = (text, tone = 'grey') => {
  const t = { grey: [C.mutedBg, C.muted], green: [C.okBg, C.successInk], amber: [C.warnBg, C.warnInk], red: [C.dangerBg, C.dangerInk], blue: [C.blueBg, C.blueInk], purple: [C.purpleBg, C.purpleInk] }[tone];
  return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: ${t[0]}; color: ${t[1]}; font-size: 12px; font-weight: 600; white-space: nowrap">${esc(text)}</span>`;
};

export const logoSlot = (label = 'Wheelhouse logo', dark = false) =>
  `<span title="No official logo file exists yet" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px dashed ${dark ? 'rgba(255,255,255,0.5)' : '#9aa5a0'}; color: ${dark ? 'rgba(255,255,255,0.75)' : C.muted}; font-size: 9px; font-weight: 700; flex-shrink: 0" aria-label="${esc(label)} goes here">LOGO</span>`;
