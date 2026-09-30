// The Settings frame for Owner setup (journey 8): the areas listed down the
// left (decision 3), each area's settings as folding sections, saved as you
// go with a "Saved · Undo" note (decision 4). Shared by setup.mjs and by
// diary.mjs, whose Diary & storage settings now sit in Settings › Workshop
// (journey 8 decision 12). Desktop only so far; drawn for Jack Lewis
// (Manager).
import { C, esc, icon, card } from './ui.mjs';
import { shellDesktop } from './diary.mjs';

export const note = (t) => `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">${t}</p>`;
export const shell = (content) => shellDesktop('settings', 'Settings', content, { role: 'M', person: 'Jack Lewis', roleName: 'Manager' });

// The areas of Settings, each with what it holds — every item is one an
// approved journey hands to Owner setup (see the decision file's background).
export const AREAS = [
  ['shop', 'Shop and sites', 'Name, address, VAT, opening hours, sites'],
  ['staff', 'Staff and roles', 'People, roles, clearing a forgotten PIN'],
  ['till', 'Till', 'Quick buttons, reasons, receipts, printers, tills'],
  ['payments', 'Payments', 'Card machine, other ways to pay, gift cards, accounts'],
  ['eod', 'End of day', 'Float, when Close the day appears, blind count'],
  ['workshop', 'Workshop', 'Services, mechanics, diary, storage slots'],
  ['messages', 'Messages', 'Texts and emails to customers'],
  ['data', 'Your data', 'Export everything'],
];

// A folding section: title, a one-line summary on the right, a chevron.
export function fold(title, summary, content = '') {
  const open = !!content;
  return `<div style="border-top: 1px solid ${C.border}">
<button type="button" aria-expanded="${open}" style="display: flex; align-items: center; gap: 14px; width: 100%; min-height: 56px; box-sizing: border-box; padding: 8px 18px; border: 0; background: transparent; font-family: inherit; text-align: left; color: ${C.ink}">
<span style="font-size: 16px; font-weight: 700; flex-grow: 1">${esc(title)}</span>
<span style="font-size: 13px; color: ${C.muted}; text-align: right">${summary}</span>
<span style="display: inline-flex; transform: rotate(${open ? 180 : 0}deg); color: ${C.muted}">${icon('chevron', 16)}</span>
</button>
${open ? `<div style="padding: 0 18px 18px; display: flex; flex-direction: column; gap: 12px">${content}</div>` : ''}
</div>`;
}

export const pill = (t, on = false) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`;

export const offer = (t, on) => `<button type="button" aria-pressed="${on}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : 'transparent'}; color: ${on ? C.panel : C.muted}; font-family: inherit; font-size: 14px; font-weight: 600">${on ? icon('check', 15, C.panel) : ''}${t}</button>`;

export const choice = (label, items) => `<div role="group" aria-label="${esc(label)}" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 600">${label}</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${items.map(([t, on]) => pill(t, on)).join('')}</div></div>`;

export function settingsPage(active, title, intro, sections, { toast = '', banner = '', who = null } = {}) {
  const list = `<nav aria-label="Settings areas" style="width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px">${AREAS.map(([k, t]) => {
    const on = k === active;
    return `<a href="#" aria-current="${on ? 'page' : 'false'}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: ${on ? 700 : 500}; color: ${C.ink}; background: ${on ? C.mutedBg : 'transparent'}">${on ? `<span style="width: 6px; height: 6px; border-radius: 999px; background: ${C.accent}"></span>` : `<span style="width: 6px"></span>`}${esc(t)}</a>`;
  }).join('')}</nav>`;
  const body = `<div data-scroll style="flex-grow: 1; min-width: 0; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px">${banner}
<div style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 22px; font-weight: 700">${esc(title)}</h2>${note(intro)}</div>
${card(sections, 'overflow: hidden; flex-shrink: 0')}
</div>`;
  // Decision 17 (H4): the same note after every change; a failed save says
  // so and offers Try again instead of Undo.
  const fail = toast && toast.fail;
  const text = toast && toast.text ? toast.text : toast;
  const t = toast ? `<div role="status" style="position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; padding: 6px 6px 6px 18px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)"><span style="display: inline-flex; align-items: center; gap: 8px">${icon(fail ? 'alert' : 'check', 16)}${text}</span><button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap">${fail ? 'Try again' : 'Undo'}</button></div>` : '';
  const inner = `<div style="position: relative; display: flex; gap: 28px; height: 100%">${list}${body}${t}</div>`;
  return who ? shellDesktop('settings', 'Settings', inner, who) : shell(inner);
}

// The Workshop area's sections (journey 8 decision 11 gives the mechanics
// list; decision 12 brings journey 12's diary block and storage settings).
export const workshopFolds = (open = {}) =>
  fold('Services', 'Full service, Individual service', open.services || '')
  + fold('Mechanics', 'Alex Morgan, Jo Taylor, Shared queue', open.mechanics || '')
  + fold('Diary blocks', 'Bike, then job title', open.diary || '')
  + fold('Storage slots', 'On · 8 slots', open.storage || '');
export const WORKSHOP_INTRO = 'Services, who works in the workshop, and how the diary looks.';
