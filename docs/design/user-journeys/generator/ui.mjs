// Shared markup in the style of the app's shadcn components (registry/primitives),
// drawn with the Fjell theme tokens.
// Fjell theme tokens (chosen by Jack, 27 Sep 2026). Names follow the shadcn variables:
// accent = primary action, accentDark = sidebar, brand = highlight.
export const C = { accent: '#3f4d33', accentDark: '#2a3024', ink: '#1c1e19', muted: '#56594f', border: '#dcdbd3', bg: '#f3f2ee', panel: '#fbfbf9', brand: '#3f4d33', lime: '#c5cf3e', input: '#83867a', hover: '#e8e7e1', danger: '#a8321f', dangerBg: '#f8e7e3', warnBg: '#fff7e0', warnInk: '#8a6100', okBg: '#e8f5ec', mutedBg: '#e8e7e1', sidebarActive: '#3f4d33' };
export const FONT = `'Work Sans', ui-sans-serif, system-ui, sans-serif`;
export const MONO = `'DM Mono', ui-monospace, monospace`;
export const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap';
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
    danger: `border: 1px solid ${C.danger}; background: ${C.danger}; color: #ffffff`,
  }[variant];
  const pad = size === 'sm' ? 'padding: 5px 10px; font-size: 13px; border-radius: 6px' : 'padding: 11px 16px; font-size: 15px; border-radius: 6px; min-height: 44px';
  const style = `display: ${block ? 'flex' : 'inline-flex'}; ${block ? 'width: 100%;' : ''} box-sizing: border-box; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-family: inherit; text-decoration: none; ${pad}; ${v}`;
  const inner = `${iconName ? icon(iconName, 16) : ''}${esc(text)}`;
  return href ? `<a href="${href}" style="${style}">${inner}</a>` : `<button type="button" style="${style}">${inner}</button>`;
}

// Field = Label + Input, as registry/primitives/label.tsx + input.tsx
export function field(label, { value = '', placeholder = '', type = 'text', hint = '', error = '', id } = {}) {
  const fid = id || 'f-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `<div style="display: flex; flex-direction: column; gap: 6px">
<label for="${fid}" style="font-size: 14px; font-weight: 600; color: ${C.ink}">${esc(label)}</label>
<input id="${fid}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" style="width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid ${error ? C.danger : C.input}; background: ${C.panel}; padding: 11px 10px; min-height: 44px; font-size: 14px; font-family: inherit; color: ${C.ink}">
${hint ? `<div style="font-size: 13px; color: ${C.muted}; line-height: 1.4">${esc(hint)}</div>` : ''}
${error ? `<div style="font-size: 13px; color: ${C.danger}; line-height: 1.4">${esc(error)}</div>` : ''}
</div>`;
}

export const card = (inner, extra = '') => `<div style="box-sizing: border-box; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 1px 2px rgba(28,30,25,0.06), 0 6px 18px rgba(28,30,25,0.06); ${extra}">${inner}</div>`;

export const badge = (text, tone = 'grey') => {
  const t = { grey: [C.mutedBg, C.muted], green: [C.okBg, C.accentDark], amber: [C.warnBg, C.warnInk], red: [C.dangerBg, '#a5301f'], blue: ['#eaf1fb', '#2c5289'], purple: ['#f1e8fb', '#6a3ea1'] }[tone];
  return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: ${t[0]}; color: ${t[1]}; font-size: 12px; font-weight: 600; white-space: nowrap">${esc(text)}</span>`;
};

export const logoSlot = (label = 'Wheelhouse logo', dark = false) =>
  `<span title="No official logo file exists yet" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px dashed ${dark ? 'rgba(255,255,255,0.5)' : '#9aa5a0'}; color: ${dark ? 'rgba(255,255,255,0.75)' : C.muted}; font-size: 9px; font-weight: 700; flex-shrink: 0" aria-label="${esc(label)} goes here">LOGO</span>`;
