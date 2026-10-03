// Look options for the job page (decision 47, 28 Sep 2026): four themed
// takes on the SAME settled job page (job-mechanic / "in the workshop" —
// decision 40) open over the dimmed diary, so Jack can choose the app's
// overall look. Content is identical in every look (job-page.mjs's fixed
// example data, reused here as plain values — not imported, since every
// look needs its own theme-parameterised markup, not job-page.mjs's fixed
// Fjell tokens). Only ui.mjs's icon()/esc() are reused (plain stroke icons,
// currentColor — no hardcoded colour baked in) plus DW/DH from stage1.mjs.
import { icon, esc } from './ui.mjs';
import { DW, DH } from './stage1.mjs';

// ---------- shared content (identical across every look; brief's fixed data) ----------
const CUSTOMER = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3 · green · black mudguards', storageSlot: 'Hook 3', mechanic: 'Alex Morgan' };
const JOB = { num: 'WH-1042', created: 'Created Thu 17 Sep · by Jo Taylor', limit: 'Customer OK up to £200', readyBy: 'Ready by Fri 18 Sep', approvedTag: 'Approved £111.00' };
const DIARY_TIME = 'Thu 17 Sep · 11:30–13:00';
const READY_BY = 'Fri 18 Sep';
const CUSTOMER_NOTE = 'My rear brake squeals and feels weak. The gears could use a tune-up too.';
const STAFF_NOTES = ['Bike booked in, tag printed.', 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.'];
const CHECKLIST_SUMMARY = '8 of 10 done · 1 note';
const LINES = [
  { work: 'Standard service', sub: 'Labour · 60 min', code: '—', note: '—', qty: '1', stock: '—', price: 65.0, approval: 'Approved' },
  { work: 'Fit & adjust brakes', sub: 'Labour · 30 min', code: '—', note: '—', qty: '1', stock: '—', price: 18.0, approval: 'Approved' },
  { work: 'Shimano brake pads', sub: 'Part · B05S-RX', code: 'B05S-RX', note: 'Rear pads worn — replacing', qty: '1', stock: '—', price: 28.0, approval: 'Approved' },
  { work: 'Replace gear cable', sub: 'Optional · cable still serviceable', code: '—', note: '—', qty: '1', stock: '—', price: 12.0, approval: 'Declined' },
];
const APPROVED_TOTAL = 111.0;

// Rooms for the sidebar (matches diary.mjs's ROOMS_DIARY exactly — Front
// desk / Workshop / Stockroom / Office; Diary is the active item).
const ROOMS = [
  ['Front desk', [['till', 'Till'], ['orders', 'Online orders'], ['customers', 'Customers'], ['mail', 'Messages']]],
  ['Workshop', [['today', 'Diary'], ['workshop', 'Overview']]],
  ['Stockroom', [['stock', 'Stock'], ['purchasing', 'Deliveries and orders'], ['check', 'Stock take']]],
  ['Office', [['reports', 'Today'], ['reports', 'Reports'], ['website', 'Website'], ['settings', 'Settings']]],
];

// Sample diary blocks behind the dialog — enough of a week to show every
// status colour, tuned per theme, at a glance (not a faithful re-draw of
// diary.mjs's real week; this file owns its own small dataset for that).
const SAMPLE_BLOCKS = [
  { day: 0, top: 18, h: 54, key: 'scheduled', bike: 'Giant Escape 2', title: 'Gear adjustment' },
  { day: 0, top: 128, h: 40, key: 'ready', bike: 'Cannondale Quick', title: 'Safety check' },
  { day: 1, top: 40, h: 40, key: 'cancelled', bike: 'Cannondale Quick', title: 'Safety check' },
  { day: 1, top: 96, h: 54, key: 'waiting', bike: 'Brompton C Line', title: 'Safety check' },
  { day: 2, top: 18, h: 54, key: 'scheduled', bike: 'Trek Domane AL 3', title: 'Standard service' },
  { day: 3, top: 60, h: 80, key: 'scheduled', bike: 'Trek Domane AL 3', title: 'Standard service' },
  { day: 4, top: 24, h: 40, key: 'hold', bike: 'Brompton C Line', title: 'Requested 14:00' },
  { day: 4, top: 90, h: 40, key: 'pending', bike: 'Specialized Sirrus', title: 'Brake service' },
  { day: 5, top: 30, h: 40, key: 'ready', bike: 'Giant Escape 2', title: 'Safety check' },
  { day: 6, top: 54, h: 40, key: 'scheduled', bike: 'Cannondale Quick', title: 'Gear adjustment' },
];
const DAY_LABELS = ['Mon 14', 'Tue 15', 'Wed 16', 'Thu 17', 'Fri 18', 'Sat 19', 'Sun 20'];

// ============================================================================
// Four themes (decision 47). Palettes are Wheelhouse's own — none of
// Anthropic's fonts or exact colours are used. Status colours are tuned per
// palette but keep the same hue meaning everywhere (scheduled=blue,
// pending=purple, waiting for parts=orange, change requested=gold,
// ready=green, cancelled=grey) so the six stay legible and distinguishable
// by lightness as well as hue within each look.
// ============================================================================
export const LOOKS = [
  {
    id: 'look-1',
    title: 'Warm editorial',
    idea: 'Closest to the brief: warm paper, an open serif for titles over a plain sans body, hairlines instead of boxes, a light sidebar, one earthy clay accent.',
    best: 'Best for a calm, trustworthy, human feel — the look Jack asked for most directly.',
    worst: 'Weakest where density matters (a very busy Everyone diary) — serif titles want a little more line height than a cramped grid gives.',
    fontDisplay: `'Fraunces', Georgia, serif`,
    fontBody: `'Instrument Sans', ui-sans-serif, system-ui, sans-serif`,
    fontLink: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600;700&display=swap',
    swatches: [['Paper', '#F7F2E7'], ['Ink', '#2B2620'], ['Clay accent', '#A6572E'], ['Hairline', '#E4DCC9']],
    c: {
      pageBg: '#F7F2E7', paper: '#FFFDF7', ink: '#2B2620', muted: '#786E5E', border: '#E4DCC9',
      accent: '#A6572E', accentInk: '#FFFFFF', accentSoft: '#F3E1D2', accentSoftInk: '#7C3E1D',
      sidebarBg: '#EFE7D6', sidebarInk: '#2B2620', sidebarMuted: '#8A8071', sidebarActiveBg: '#E4D2BE', sidebarActiveInk: '#7C3E1D',
      danger: '#9C3B2C', dangerBg: '#F6E3DE', dangerInk: '#7A2C20',
    },
    status: {
      scheduled: ['#E7EEF6', '#2C5289', 'Scheduled'],
      pending: ['#EFE6F5', '#6A3EA1', 'Pending'],
      waiting: ['#F7E6D5', '#96481A', 'Waiting for parts'],
      hold: ['#FBF0CF', '#8A6100', 'Change requested'],
      ready: ['#E4EFE1', '#2E5C3A', 'Ready'],
      cancelled: ['#EAE6DC', '#786E5E', 'Cancelled'],
    },
  },
  {
    id: 'look-2',
    title: 'Quiet white',
    idea: 'Crisp near-white with warm-grey neutrals, one sans family throughout at a refined scale, hairlines, a single deep ink-blue accent.',
    best: 'Best for a tool that should disappear behind the work — the most neutral, most "just software" option.',
    worst: 'Weakest at expressing character — nothing marks it as Wheelhouse rather than any other clean SaaS product.',
    fontDisplay: `'Geist', ui-sans-serif, system-ui, sans-serif`,
    fontBody: `'Geist', ui-sans-serif, system-ui, sans-serif`,
    fontLink: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
    swatches: [['White', '#FCFCFA'], ['Warm grey ink', '#22221E'], ['Ink-blue accent', '#1E3A5F'], ['Hairline', '#E4E2DB']],
    c: {
      pageBg: '#F6F5F1', paper: '#FCFCFA', ink: '#22221E', muted: '#6D6C64', border: '#E4E2DB',
      accent: '#1E3A5F', accentInk: '#FFFFFF', accentSoft: '#E4EAF1', accentSoftInk: '#1E3A5F',
      sidebarBg: '#F1F0EA', sidebarInk: '#22221E', sidebarMuted: '#7A796F', sidebarActiveBg: '#E4EAF1', sidebarActiveInk: '#1E3A5F',
      danger: '#8E3428', dangerBg: '#F3E2DE', dangerInk: '#8E3428',
    },
    status: {
      scheduled: ['#E4EAF3', '#1E3A5F', 'Scheduled'],
      pending: ['#ECE6F3', '#5B3E88', 'Pending'],
      waiting: ['#F5E6D6', '#8B4A16', 'Waiting for parts'],
      hold: ['#F7EFCE', '#7C5D00', 'Change requested'],
      ready: ['#E0EEE3', '#245C3B', 'Ready'],
      cancelled: ['#E9E8E3', '#6D6C64', 'Cancelled'],
    },
  },
  {
    id: 'look-3',
    title: 'Fjell, lightened',
    idea: 'The current olive/stone palette made airy: a light sidebar instead of the dark one, boxes dropped for rules and space, more whitespace throughout — the current system under the new principles.',
    best: 'Best for continuity — least disruptive if the shop is already used to Fjell’s colours and just wants it lighter.',
    worst: 'Weakest at feeling genuinely new — it reads as a lightened version of what exists, not a fresh look.',
    fontDisplay: `'Newsreader', Georgia, serif`,
    fontBody: `'DM Sans', ui-sans-serif, system-ui, sans-serif`,
    fontLink: 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap',
    swatches: [['Light stone', '#F3F1E8'], ['Olive-black ink', '#262B20'], ['Olive accent', '#4C5B3B'], ['Hairline', '#E1E0D3']],
    c: {
      pageBg: '#F3F1E8', paper: '#FBFBF7', ink: '#262B20', muted: '#6B6F5D', border: '#E1E0D3',
      accent: '#4C5B3B', accentInk: '#FFFFFF', accentSoft: '#E7EEDD', accentSoftInk: '#3F4D2F',
      sidebarBg: '#EFEEE1', sidebarInk: '#262B20', sidebarMuted: '#7B7B67', sidebarActiveBg: '#DEE7CB', sidebarActiveInk: '#3F4D2F',
      danger: '#96351F', dangerBg: '#F3E1D8', dangerInk: '#96351F',
    },
    status: {
      scheduled: ['#E4EBF5', '#2C5289', 'Scheduled'],
      pending: ['#EEE5F4', '#6A3EA1', 'Pending'],
      waiting: ['#F6E4D2', '#93451A', 'Waiting for parts'],
      hold: ['#F8EFCC', '#836000', 'Change requested'],
      ready: ['#E2EEDD', '#3D5C2C', 'Ready'],
      cancelled: ['#E8E7DA', '#6B6F5D', 'Cancelled'],
    },
  },
  {
    id: 'look-4',
    title: 'Soft sand, dark rail',
    idea: 'Soft sand paper with a charcoal sidebar (the one dark surface in the app) and a small, bright amber highlight used sparingly — for active states and the odd accent, never for whole surfaces.',
    best: 'Best where the sidebar needs to read as a distinct control surface (a busy multi-role shop) while the work area stays warm and quiet.',
    worst: 'Weakest for strict minimalism purists — the dark rail is one more visual idea than the other three looks carry.',
    fontDisplay: `'Source Serif 4', Georgia, serif`,
    fontBody: `'Public Sans', ui-sans-serif, system-ui, sans-serif`,
    fontLink: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Public+Sans:wght@400;500;600;700&display=swap',
    swatches: [['Soft sand', '#F4EEE1'], ['Charcoal rail', '#262420'], ['Amber highlight', '#D9A441'], ['Hairline', '#E6DFCB']],
    c: {
      pageBg: '#F4EEE1', paper: '#FFFDF7', ink: '#2A2822', muted: '#79725E', border: '#E6DFCB',
      accent: '#2A2822', accentInk: '#FFFFFF', accentSoft: '#F1E3BE', accentSoftInk: '#7A5A10',
      sidebarBg: '#262420', sidebarInk: '#F4EEE1', sidebarMuted: 'rgba(244,238,225,0.65)', sidebarActiveBg: '#39352E', sidebarActiveInk: '#D9A441',
      danger: '#9C3B2C', dangerBg: '#F6E3DE', dangerInk: '#7A2C20',
      highlight: '#D9A441',
    },
    status: {
      scheduled: ['#E4EAF3', '#294872', 'Scheduled'],
      pending: ['#ECE3F2', '#5C3E87', 'Pending'],
      waiting: ['#F5E3D0', '#8B4715', 'Waiting for parts'],
      hold: ['#F7EAC2', '#7A5A10', 'Change requested'],
      ready: ['#E1EEDD', '#295C39', 'Ready'],
      cancelled: ['#E9E5D9', '#79725E', 'Cancelled'],
    },
  },
];

// ---------- generic (theme-parameterised) building blocks ----------
const badge = (c, text, [bg, ink]) => `<span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 600; white-space: nowrap">${esc(text)}</span>`;
const softTag = (c, text) => `<span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: ${c.accentSoft}; color: ${c.accentSoftInk}; font-size: 12px; font-weight: 600; white-space: nowrap">${esc(text)}</span>`;
const btn = (c, text, { variant = 'default', iconName = null, minW = 44 } = {}) => {
  const styles = {
    primary: `background: ${c.accent}; color: ${c.accentInk}; border: 1px solid ${c.accent};`,
    danger: `background: transparent; color: ${c.danger}; border: 1px solid ${c.danger};`,
    default: `background: ${c.paper}; color: ${c.ink}; border: 1px solid ${c.border};`,
  }[variant];
  return `<button type="button" style="display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; min-width: ${minW}px; padding: 0 16px; border-radius: 8px; font-family: ${c.fontBody || 'inherit'}; font-size: 14px; font-weight: 600; ${styles}">${iconName ? icon(iconName, 16) : ''}${esc(text)}</button>`;
};
const iconBtn = (c, name, label) => `<button type="button" aria-label="${esc(label)}" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid ${c.border}; background: ${c.paper}; color: ${c.ink}">${icon(name, 18)}</button>`;

// ---------- sidebar (Front desk / Workshop / Stockroom / Office — brief) ----------
function sidebarItem(c, [ic, label], active) {
  return `<div aria-current="${active ? 'page' : 'false'}" style="display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0 12px; border-radius: 8px; font-size: 14px; font-weight: ${active ? 700 : 500}; color: ${active ? c.sidebarActiveInk : c.sidebarInk}; background: ${active ? c.sidebarActiveBg : 'transparent'}">${icon(ic, 18)}<span>${esc(label)}</span></div>`;
}
function sidebar(c) {
  const groups = ROOMS.map(([room, items]) => `<div style="display: flex; flex-direction: column; gap: 3px">
<div style="padding: 4px 12px 2px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${c.sidebarMuted}">${esc(room)}</div>
${items.map((it) => sidebarItem(c, it, room === 'Workshop' && it[1] === 'Diary')).join('')}
</div>`).join('');
  return `<nav aria-label="Main" style="width: 248px; flex-shrink: 0; box-sizing: border-box; padding: 16px 12px; display: flex; flex-direction: column; gap: 16px; background: ${c.sidebarBg}; border-right: 1px solid ${c.border}">
<div style="display: flex; align-items: center; gap: 10px; padding: 4px 6px">
<span title="No official logo file exists yet" aria-label="Wheelhouse logo goes here" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px dashed ${c.sidebarMuted}; color: ${c.sidebarMuted}; font-size: 9px; font-weight: 700; flex-shrink: 0">LOGO</span>
<span style="font-family: ${c.fontDisplay}; font-size: 18px; font-weight: 600; color: ${c.sidebarInk}">Wheelhouse</span>
</div>
<div style="display: flex; flex-direction: column; gap: 12px">${groups}</div>
</nav>`;
}

// ---------- dimmed diary backdrop (shows every status colour, tuned) ----------
function diaryBackdrop(c, status) {
  const cols = DAY_LABELS.map((label, i) => {
    const blocks = SAMPLE_BLOCKS.filter((b) => b.day === i).map((b) => {
      const [bg, ink] = status[b.key];
      return `<div style="position: absolute; left: 2px; right: 2px; top: ${b.top}px; height: ${b.h}px; box-sizing: border-box; border-radius: 6px; border: 1.5px solid ${ink}; background: ${bg}; padding: 4px 6px; overflow: hidden">
<div style="font-size: 10px; font-weight: 700; color: ${ink}">${esc(b.bike)}</div>
<div style="font-size: 10px; color: ${ink}">${esc(b.title)}</div>
</div>`;
    }).join('');
    return `<div style="position: relative; flex: 1 1 0; min-width: 0; height: 220px; border-left: 1px solid ${c.border}">
<div style="text-align: center; font-size: 11px; font-weight: 700; color: ${c.muted}; padding: 4px 0">${esc(label)}</div>
${blocks}
</div>`;
  }).join('');
  // A small status-colour key sits in the header itself (rather than only
  // in the week grid below, which a near-fullscreen job dialog mostly
  // covers) so every look's tuned status colours stay visible behind the
  // dialog, not just in markup nobody sees rendered.
  const legend = Object.entries(status).map(([, [bg, ink, label]]) => `<span style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; background: ${bg}; border: 1px solid ${ink}; color: ${ink}; font-size: 11px; font-weight: 700; white-space: nowrap">${esc(label)}</span>`).join('');
  return `<div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0; background: ${c.pageBg}">
<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: ${c.paper}; border-bottom: 1px solid ${c.border}">
<h1 style="margin: 0; font-family: ${c.fontDisplay}; font-size: 21px; font-weight: 600; color: ${c.ink}">Workshop diary</h1>
<div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end">${legend}</div>
</header>
<main style="flex-grow: 1; box-sizing: border-box; padding: 20px 28px; overflow: hidden">
<div style="display: flex; align-items: stretch; border: 1px solid ${c.border}; border-radius: 10px; overflow: hidden; background: ${c.paper}">${cols}</div>
</main>
</div>`;
}

// ---------- the job dialog (identical content, themed markup) ----------
function jobDialog(c, status) {
  const titleBar = `<header style="flex-shrink: 0; box-sizing: border-box; padding: 9px 26px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid ${c.border}">
<div style="display: flex; align-items: baseline; gap: 12px; min-width: 0"><h2 style="margin: 0; font-family: ${c.fontDisplay}; font-size: 22px; font-weight: 600; color: ${c.ink}">Standard service</h2>${badge(c, 'In workshop', c.status.scheduled)}</div>
<button type="button" aria-label="Close, back to the diary" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: none; background: transparent; color: ${c.ink}">${icon('close', 20)}</button>
</header>`;

  const custStrip = `<div style="flex-shrink: 0; box-sizing: border-box; padding: 6px 26px; display: flex; align-items: center; justify-content: space-between; gap: 14px; background: ${c.pageBg}; border-bottom: 1px solid ${c.border}">
<div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; font-size: 13px; color: ${c.ink}">
<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 700; color: ${c.accent}; text-decoration: underline; text-underline-offset: 3px">${esc(CUSTOMER.name)}</a>
<span>${esc(CUSTOMER.phone)}</span><span>${esc(CUSTOMER.email)}</span><span>${esc(CUSTOMER.bike)}</span>
<span style="color: ${c.muted}">Kept on ${esc(CUSTOMER.storageSlot)}</span>
<span>Mechanic: <strong>${esc(CUSTOMER.mechanic)}</strong></span>
</div>
<div style="display: flex; gap: 8px; flex-shrink: 0">${iconBtn(c, 'inbox', `Message ${esc(CUSTOMER.name)}`)}${iconBtn(c, 'mail', `Email ${esc(CUSTOMER.name)}`)}${iconBtn(c, 'menu', 'Notes')}</div>
</div>`;

  const metaRow = `<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
<span style="font-family: ${c.fontBody}; font-size: 13px; font-weight: 700; color: ${c.ink}">${esc(JOB.num)}</span>
<span style="font-size: 13px; color: ${c.muted}">${esc(JOB.created)}</span>
<span style="flex-grow: 1"></span>
${softTag(c, JOB.limit)}${badge(c, JOB.readyBy, [c.pageBg, c.muted])}${badge(c, JOB.approvedTag, c.status ? c.status.ready : ['#E4EFE1', '#2E5C3A'])}
</div>`;

  const field = (label, valueHtml) => `<div style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 12px; font-weight: 600; color: ${c.muted}">${esc(label)}</span>${valueHtml}</div>`;
  const staticVal = (v) => `<div style="min-height: 20px; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; border: 1px solid ${c.border}; background: ${c.pageBg}; font-size: 13px; color: ${c.ink}">${esc(v)}</div>`;
  const statusSelect = `<select aria-label="Status" style="width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid ${c.border}; background: ${c.paper}; font-family: inherit; font-size: 14px; color: ${c.ink}"><option>In workshop</option></select>`;
  const tick = (label, checked) => `<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox" ${checked ? 'checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${c.accent}; flex-shrink: 0"><span style="font-size: 14px; color: ${c.ink}">${esc(label)}</span></label>`;

  const leftCol = `<div style="display: flex; flex-direction: column; gap: 10px; min-width: 0">
${field('Status', statusSelect)}
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">${field('Diary time', staticVal(DIARY_TIME))}${field('Ready by', staticVal(READY_BY))}</div>
<div style="display: flex; gap: 20px; flex-wrap: wrap">${tick('Bike is here', true)}${tick('New bike build', false)}</div>
</div>`;

  const checklistBar = `<button type="button" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box; min-height: 44px; padding: 8px 14px; border-radius: 8px; border: 1px solid ${c.border}; background: ${c.paper}; font-family: inherit; text-align: left">
<span style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: ${c.ink}"><span style="display: inline-flex; transform: rotate(-90deg); color: ${c.muted}">${icon('chevron', 16)}</span>Full service checklist</span>
<span style="font-size: 12px; color: ${c.muted}">${esc(CHECKLIST_SUMMARY)}</span>
</button>`;

  const notesCol = `<div style="min-width: 0; display: flex; flex-direction: column; gap: 8px">
<h3 style="margin: 0; font-family: ${c.fontDisplay}; font-size: 16px; font-weight: 600; color: ${c.ink}">Notes</h3>
<div style="flex-grow: 1; box-sizing: border-box; border: 1px solid ${c.border}; border-radius: 10px; background: ${c.paper}; padding: 7px 12px; display: flex; flex-direction: column; gap: 4px">
<div style="display: flex; flex-direction: column; gap: 4px; padding-bottom: 10px; border-bottom: 1.5px solid ${c.border}">
<span style="font-size: 12px; font-weight: 700; color: ${c.accent}">From the customer</span>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${c.ink}">${esc(CUSTOMER_NOTE)}</p>
</div>
${STAFF_NOTES.map((t) => `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${c.ink}">${esc(t)}</p>`).join('')}
</div>
${checklistBar}
</div>`;

  const jobSection = `<div style="flex-shrink: 0; box-sizing: border-box; padding: 8px 26px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid ${c.border}">
${metaRow}
<div style="display: grid; grid-template-columns: 360px 1fr; gap: 20px; align-items: start">${leftCol}${notesCol}</div>
</div>`;

  // ---- work and parts table ----
  const toolbar = `<div style="display: flex; gap: 8px">${btn(c, 'Add item', { iconName: 'plus' })}${btn(c, 'Scan barcode', { iconName: 'search' })}${btn(c, 'Print', { iconName: 'reports' })}</div>`;
  const th = (t, extra = '') => `<th style="text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: ${c.muted}; padding: 3px 8px; border-bottom: 1px solid ${c.border}; ${extra}">${esc(t)}</th>`;
  const td = (inner, extra = '') => `<td style="padding: 3px 8px; font-size: 13px; color: ${c.ink}; border-bottom: 1px solid ${c.border}; vertical-align: middle; line-height: 1.15; ${extra}">${inner}</td>`;
  const approvalBadge = (a) => {
    const tone = a === 'Approved' ? (c.status ? c.status.ready : ['#E4EFE1', '#2E5C3A']) : (c.status ? c.status.cancelled : ['#EAE6DC', '#786E5E']);
    return badge(c, a, a === 'Declined' ? [c.dangerBg, c.dangerInk] : tone);
  };
  const rows = LINES.map((l) => {
    const declined = l.approval === 'Declined';
    const strike = declined ? `text-decoration: line-through; color: ${c.muted};` : '';
    return `<tr>
${td(`<span style="font-family: ${c.fontBody}">${esc(l.code)}</span>`)}
${td(`<span style="font-weight: 600">${esc(l.work)}</span><span style="font-size: 12px; color: ${c.muted}"> · ${esc(l.sub)}</span>`)}
${td(`<input type="checkbox" ${l.approval === 'Approved' ? 'checked' : ''} aria-label="${esc(l.work)} done" style="width: 18px; height: 18px; accent-color: ${c.accent}">`, 'text-align: center')}
${td(l.note, `color: ${c.muted}; font-size: 12px`)}
${td(`<span style="font-family: ${c.fontBody}">${esc(l.qty)}</span>`)}
${td(l.stock, `color: ${c.muted}; font-size: 12px`)}
${td(`<span style="font-family: ${c.fontBody}">£${l.price.toFixed(2)}</span>`)}
${td(`<span style="font-family: ${c.fontBody}; font-weight: 600; ${strike}">£${l.price.toFixed(2)}</span>`)}
${td(approvalBadge(l.approval))}
</tr>`;
  }).join('');
  const totalRow = `<tr><td colspan="7" style="padding: 6px 10px; text-align: right; font-size: 14px; font-weight: 700; color: ${c.ink}">Approved total</td><td style="padding: 6px 10px"><span style="font-family: ${c.fontBody}; font-weight: 700; font-size: 15px; color: ${c.ink}">£${APPROVED_TOTAL.toFixed(2)}</span></td><td></td></tr>`;
  const table = `<table style="width: 100%; border-collapse: collapse">
<thead><tr>${th('Code')}${th('Work / part')}${th('Done', 'text-align: center')}${th('Note')}${th('Qty')}${th('In stock')}${th('Price')}${th('Total')}${th('Customer approval')}</tr></thead>
<tbody>${rows}${totalRow}</tbody>
</table>`;

  const workSection = `<div style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 8px 26px 0; display: flex; flex-direction: column; gap: 4px; overflow: hidden">
<h3 style="margin: 0; font-family: ${c.fontDisplay}; font-size: 16px; font-weight: 600; color: ${c.ink}">Work and parts</h3>
${toolbar}
${table}
</div>`;

  const footer = `<div style="flex-shrink: 0; box-sizing: border-box; padding: 8px 26px; border-top: 1px solid ${c.border}; display: flex; align-items: center; gap: 12px">
${btn(c, 'Unschedule', { variant: 'danger' })}
<span style="flex-grow: 1"></span>
${btn(c, 'Mark ready for collection', { variant: 'primary' })}
</div>`;

  return `<div role="dialog" aria-modal="true" aria-label="Standard service, in workshop" style="width: 100%; height: 100%; box-sizing: border-box; background: ${c.paper}; border-radius: 16px; box-shadow: 0 28px 72px rgba(20,18,14,0.28); display: flex; flex-direction: column; overflow: hidden; font-family: ${c.fontBody}">
${titleBar}${custStrip}${jobSection}${workSection}${footer}
</div>`;
}

// ---------- one look board: dimmed diary + sidebar behind, dialog on top ----------
export function buildLook(theme) {
  const c = { ...theme.c, fontDisplay: theme.fontDisplay, fontBody: theme.fontBody, status: theme.status };
  const shell = `<div style="width: ${DW}px; height: ${DH}px; display: flex; background: ${c.pageBg}; font-family: ${c.fontBody}">
${sidebar(c)}
${diaryBackdrop(c, theme.status)}
</div>`;
  const overlay = `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">
${shell}
<div style="position: absolute; inset: 0; background: rgba(20,18,14,0.42); display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 60px">
${jobDialog(c, theme.status)}
</div>
</div>`;
  return { id: theme.id, title: `Look ${theme.id.split('-')[1]} · ${theme.title}`, w: DW, h: DH, html: overlay, fontLink: theme.fontLink };
}

// ---------- looks-intro board: name, idea, swatches, fonts, best/worst per look ----------
const introCard = (theme) => {
  const c = theme.c;
  const swatches = theme.swatches.map(([label, hex]) => `<div style="display: flex; align-items: center; gap: 8px">
<span style="width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.12); background: ${hex}; flex-shrink: 0"></span>
<span style="font-size: 12px; color: #4A473F">${esc(label)}</span>
<span style="font-family: ui-monospace, monospace; font-size: 12px; color: #6D6A60">${hex}</span>
</div>`).join('');
  return `<div style="box-sizing: border-box; border: 1px solid #E1DFD3; border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; background: #FFFFFF">
<div style="display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #8A8677">Look ${theme.id.split('-')[1]}</span>
<h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #262420">${esc(theme.title)}</h2>
</div>
<p style="margin: 0; font-size: 13px; line-height: 1.5; color: #4A473F">${esc(theme.idea)}</p>
<div style="display: flex; flex-direction: column; gap: 6px">${swatches}</div>
<div style="font-size: 12px; color: #4A473F"><strong>Fonts:</strong> ${esc(theme.fontDisplay.split(',')[0].replace(/'/g, ''))} (headings) + ${esc(theme.fontBody.split(',')[0].replace(/'/g, ''))} (body)</div>
<div style="font-size: 12px; line-height: 1.5; color: #4A473F"><strong>Best at:</strong> ${esc(theme.best)}</div>
<div style="font-size: 12px; line-height: 1.5; color: #4A473F"><strong>Worst at:</strong> ${esc(theme.worst)}</div>
</div>`;
};
export function buildIntro() {
  const html = `<div style="width: ${DW}px; height: ${DH}px; box-sizing: border-box; padding: 28px 32px; display: flex; flex-direction: column; gap: 16px; background: #F5F3EC; font-family: ui-sans-serif, system-ui, sans-serif">
<div style="display: flex; flex-direction: column; gap: 2px">
<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #262420">Look options — the same job page, four ways</h1>
<p style="margin: 0; font-size: 13px; color: #6D6A60">Each look renders decision 40's settled job page (in the workshop / job-mechanic) over the dimmed diary. Content is identical in every look — only the theme changes.</p>
</div>
<div style="flex-grow: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; min-height: 0">${LOOKS.map(introCard).join('')}</div>
</div>`;
  const fontLink = LOOKS.map((t) => t.fontLink.replace(/^https:\/\/fonts\.googleapis\.com\/css2\?/, '').split('&display=swap')[0]).join('&');
  return { id: 'looks-intro', title: 'Look options — overview', w: DW, h: DH, html, fontLink: `https://fonts.googleapis.com/css2?${fontLink}&display=swap` };
}
