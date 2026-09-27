// Five Wheelhouse theme options. Each is a full token set that maps onto the
// shadcn/Tailwind variables in src/styles/theme.css (background, foreground,
// card, muted, border, input, primary, accent, destructive, sidebar, radius, fonts).
// Inspired by the named brand's mood only: no logos, names or proprietary faces.
export const THEMES = [
  {
    id: 'chapter', name: 'Chapter', inspired: 'Rapha', mood: 'Understated, literary, premium',
    note: 'Black and white with one rare pink accent. A serif for headings gives it a considered, magazine feel; the app itself stays calm and plain.',
    fonts: { display: 'Source Serif 4', body: 'Public Sans', mono: 'IBM Plex Mono' },
    css: 'family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500',
    heading: { weight: 600, transform: 'none', tracking: '-0.3px' },
    radius: 2,
    c: { background: '#ffffff', foreground: '#141414', card: '#ffffff', muted: '#f5f4f2', mutedForeground: '#5c5a57', border: '#e5e3df', input: '#8f8b85', primary: '#141414', primaryForeground: '#ffffff', secondary: '#f5f4f2', secondaryForeground: '#141414', accent: '#c4265f', accentForeground: '#ffffff', destructive: '#b42318', sidebar: '#141414', sidebarForeground: '#ffffff', sidebarActive: '#2c2c2c', ring: '#c4265f' },
  },
  {
    id: 'hilltop', name: 'Hilltop', inspired: 'Trek', mood: 'Confident, friendly, retail-ready',
    note: 'Bold red actions on clean white with a black frame. Sentence-case headings in a sturdy grotesk; rounder corners make it approachable for new staff.',
    fonts: { display: 'Archivo', body: 'Archivo', mono: 'Archivo' },
    css: 'family=Archivo:wght@400;500;600;700;800',
    heading: { weight: 800, transform: 'none', tracking: '-0.4px' },
    radius: 8,
    c: { background: '#ffffff', foreground: '#111111', card: '#ffffff', muted: '#f3f3f3', mutedForeground: '#595959', border: '#e1e1e1', input: '#8a8a8a', primary: '#c8102e', primaryForeground: '#ffffff', secondary: '#111111', secondaryForeground: '#ffffff', accent: '#111111', accentForeground: '#ffffff', destructive: '#9f1d20', sidebar: '#111111', sidebarForeground: '#ffffff', sidebarActive: '#c8102e', ring: '#c8102e' },
  },
  {
    id: 'sprint', name: 'Sprint', inspired: 'Specialized', mood: 'Technical, fast, precise',
    note: 'Cool greys, sharp corners and condensed capitals for headings. Black actions; a signal red used only to mark where you are and what needs you.',
    fonts: { display: 'Barlow Condensed', body: 'Barlow', mono: 'IBM Plex Mono' },
    css: 'family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500',
    heading: { weight: 700, transform: 'uppercase', tracking: '0.5px' },
    radius: 0,
    c: { background: '#f4f5f6', foreground: '#0d0f12', card: '#ffffff', muted: '#eceef0', mutedForeground: '#4f5660', border: '#d9dde2', input: '#848c96', primary: '#0d0f12', primaryForeground: '#ffffff', secondary: '#ffffff', secondaryForeground: '#0d0f12', accent: '#d7191f', accentForeground: '#ffffff', destructive: '#a3161b', sidebar: '#1b1f24', sidebarForeground: '#ffffff', sidebarActive: '#2b3139', ring: '#d7191f' },
  },
  {
    id: 'studio', name: 'Studio', inspired: 'MAAP', mood: 'Modern, editorial, exact',
    note: 'A crisp grotesk with a monospaced face for prices, SKUs and receipt numbers. Steel blue actions and a deep merlot accent on white.',
    fonts: { display: 'Schibsted Grotesk', body: 'Schibsted Grotesk', mono: 'JetBrains Mono' },
    css: 'family=Schibsted+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600',
    heading: { weight: 600, transform: 'none', tracking: '-0.5px' },
    radius: 4,
    c: { background: '#ffffff', foreground: '#0b0b0b', card: '#ffffff', muted: '#f2f2ef', mutedForeground: '#56564f', border: '#e3e3de', input: '#8c8c84', primary: '#2c4a63', primaryForeground: '#ffffff', secondary: '#f2f2ef', secondaryForeground: '#0b0b0b', accent: '#7b1e2e', accentForeground: '#ffffff', destructive: '#b42318', sidebar: '#1c2a36', sidebarForeground: '#ffffff', sidebarActive: '#2c4a63', ring: '#2c4a63' },
  },
  {
    id: 'fjell', name: 'Fjell', inspired: 'Pas Normal Studios', mood: 'Quiet, earthy, Scandinavian',
    note: 'Warm stone ground, deep olive actions and a dark-lime highlight. Light-weight sentence-case headings and soft shadows instead of hard lines.',
    fonts: { display: 'Work Sans', body: 'Work Sans', mono: 'DM Mono' },
    css: 'family=Work+Sans:wght@400;500;600;700&family=DM+Mono:wght@500',
    heading: { weight: 600, transform: 'none', tracking: '-0.4px' },
    radius: 6,
    c: { background: '#f3f2ee', foreground: '#1c1e19', card: '#fbfbf9', muted: '#e8e7e1', mutedForeground: '#56594f', border: '#dcdbd3', input: '#8e9185', primary: '#3f4d33', primaryForeground: '#ffffff', secondary: '#e8e7e1', secondaryForeground: '#1c1e19', accent: '#c5cf3e', accentForeground: '#1c1e19', destructive: '#a8321f', sidebar: '#2a3024', sidebarForeground: '#f3f2ee', sidebarActive: '#3f4d33', ring: '#3f4d33' },
  },
];

// Semantic status colours stay the same in every theme (they carry meaning).
export const STATUS = {
  pending: ['#f1e8fb', '#6a3ea1'], scheduled: ['#eaf1fb', '#2c5289'], waiting: ['#fff0e3', '#a8420f'],
  hold: ['#fff7e0', '#8a6100'], complete: ['#e8f5ec', '#164f42'],
};

// WCAG contrast
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

export function checks(t) {
  const c = t.c;
  return [
    ['Text on background', c.foreground, c.background, 4.5],
    ['Muted text on background', c.mutedForeground, c.background, 4.5],
    ['Muted text on muted panel', c.mutedForeground, c.muted, 4.5],
    ['Text on card', c.foreground, c.card, 4.5],
    ['Button text on primary', c.primaryForeground, c.primary, 4.5],
    ['Text on accent', c.accentForeground, c.accent, 4.5],
    ['Sidebar text', c.sidebarForeground, c.sidebar, 4.5],
    ['Sidebar text on active item', c.sidebarForeground, c.sidebarActive, 4.5],
    ['Input border on card', c.input, c.card, 3],
    ['Destructive on card', c.destructive, c.card, 4.5],
  ].map(([label, fg, bg, min]) => ({ label, fg, bg, min, r: ratio(fg, bg) }));
}
