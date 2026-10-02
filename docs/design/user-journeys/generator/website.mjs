// Journey 18 — Website management, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-02-website-management-review.md
//
// Decision 1: the website is edited on a live preview — sections listed down
// the side, click one to change it, "+ Add section", a Theme tab. 2: changes
// wait until Publish; Discard changes; a short history. 3: theme — any
// colour, a chosen list of fonts, readability guarded; corners and buttons.
// 4: ready-made pages built from sections, and new pages. 5: Office ›
// Website holds the website itself; selling rules and payments stay in
// Settings › Front desk › Online orders. 6: tracking tools picked from a
// list, with the tool's ID. 7: "Use your own address" drawn, waiting on the
// business plan's freeze (ECOM-03). 8: online payments setup for any
// provider, with a test payment. 9, 10: Shopify stays as a choice —
// Wheelhouse in charge, Shopify orders come into Online orders. 11: a
// three-step start, then the editor.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Jack Lewis (Owner). The home page in the preview is journey 1's. Colours
// shown are examples of a shop's choice (the app map's "Ocean" example);
// addresses, IDs, dates, counts and the payment provider are bracketed
// placeholders.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, settingsPage, onlineFolds, ONLINE_INTRO, withOnlineArea, rowSwitch } from './settings-frame.mjs';
import { siteDesktop } from './app-map.mjs';
import { screens as browseScreens } from './browse.mjs';
import { screens as onlineScreens } from './online.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const W = 1280, H = 800;
const FREE = '[shop-name].wheelhouseepos.com';
const OWN = '[your-shop].co.uk';
const OCEAN = '#1A3F66';
const tall = 'display: inline-flex; align-items: center; min-height: 44px';

const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 20px; font-weight: 700">${t}</h2>`;
const h3 = (t) => `<h3 style="margin: 0; font-size: 16px; font-weight: 700">${t}</h3>`;
const box = (inner, extra = '') => card(`<div style="padding: 20px; display: flex; flex-direction: column; gap: 14px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
const msg = (t, tone = 'ok', live = false) => `<p${live ? ` role="${tone === 'bad' ? 'alert' : 'status'}"` : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' || tone === 'bad' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' || tone === 'bad' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' || tone === 'bad' ? 'alert' : tone === 'ok' ? 'check' : 'website', 18)}<span>${t}</span></p>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${t}</button>`;
const off = (html) => html.replace('<button', '<button aria-disabled="true"').replace('style="', 'style="opacity: 0.45; ');
const back = (t) => `<a href="#" style="${tall}; align-self: flex-start; gap: 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const toast = (t, action = 'Undo', place = 'left: 50%; bottom: 24px; transform: translateX(-50%)') => `<div role="status" style="position: absolute; ${place}; display: flex; align-items: center; gap: 12px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; white-space: nowrap; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}<span>${t}</span>${action ? `<button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700">${action}</button>` : ''}</div>`;
// A radio card (journey 2's shopOption).
const option = (name, on, sub, group = 'pick') => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 16px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="radio" name="${group}"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span></span></label>`;
const swatch = (hex, on, label) => `<label style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer"><input type="radio" name="colour"${on ? ' checked' : ''} aria-label="${esc(label)}" style="position: absolute; opacity: 0; width: 1px; height: 1px"><span aria-hidden="true" style="width: 52px; height: 52px; border-radius: 10px; background: ${hex}; box-shadow: ${on ? `0 0 0 3px ${C.panel}, 0 0 0 5px ${C.ink}` : `inset 0 0 0 1px rgba(0,0,0,0.12)`}"></span>${mono(hex, 'font-size: 12px')}</label>`;

// ---------- Office › Website (decision 5) ----------
const websitePage = (content) => page('website', 'Website', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`, OWNER);
const row = (title, sub, end = '') => `<a href="#" style="display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 10px 18px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1; min-width: 0"><span style="font-size: 16px; font-weight: 700">${title}</span><span style="font-size: 14px; color: ${C.muted}">${sub}</span></span>${end}<span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span></a>`;
const rows = (...r) => card(r.join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden; flex-shrink: 0');
const overview = ({ on = false, changes = false, toastHtml = '' } = {}) => {
  const status = box(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
<span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${on ? C.okBg : C.mutedBg}; color: ${on ? C.successInk : C.ink}">${icon(on ? 'check' : 'lock', 22)}</span>
<div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; min-width: 0">${h2(on ? 'Your website is on' : 'Your website is off', 'ws-status')}<span style="font-size: 15px; color: ${C.muted}">${on ? 'Customers can see it at' : 'Only your staff can see it. Customers will find it at'} <a href="#" style="color: ${C.ink}; font-weight: 600">${FREE}</a></span></div>
${on ? button('Turn off', { variant: 'default' }) : button('Turn it on', { variant: 'default' })}
</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-top: 14px; border-top: 1px solid ${C.border}">${button('Edit website', { iconName: 'website' })}${changes ? badge('Unpublished changes', 'amber') + `<span style="font-size: 14px; color: ${C.muted}">Saved by Jack Lewis [time] · customers see them when you publish</span>` : `<span style="font-size: 14px; color: ${C.muted}">Last published by Jack Lewis on [date]</span>`}</div>`);
  const content = `${status}${rows(
    row('Pages', 'Home, About us, Contact us, Collection and returns, Privacy, Cookies', badge('2 to check', 'amber')),
    row('Tracking tools', 'None — so there’s no cookie pop-up'),
    row('Web address', FREE),
    row('Wheelhouse’s website or Shopify', 'Wheelhouse’s website'),
  )}
${card(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 18px"><span style="flex-grow: 1; font-size: 15px">What the website sells, “Show on website” and online payments are in <strong>Settings › Front desk › Online orders</strong>.</span><a href="#" style="${tall}; font-size: 15px; font-weight: 600; color: ${C.ink}">Open Online orders settings</a></div>`, 'flex-shrink: 0')}`;
  return toastHtml ? websitePage(content).replace('<main style="', '<main style="position: relative; ').replace('</main>', `${toastHtml}</main>`) : websitePage(content);
};

// ---------- First visit: three steps, then the editor (decision 11) ----------
const steps = (n, title, sub, body, next, backBtn = true) => websitePage(`<div style="max-width: 720px; width: 100%; align-self: center; display: flex; flex-direction: column; gap: 18px; padding-top: 8px">
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 700; letter-spacing: 1px; color: ${C.muted}">SET UP YOUR WEBSITE · STEP ${n} OF 3</span><div role="progressbar" aria-label="Step ${n} of 3" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${n}" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px">${[1, 2, 3].map((i) => `<span style="height: 6px; border-radius: 999px; background: ${i <= n ? C.ink : C.border}"></span>`).join('')}</div></div>
<div style="display: flex; flex-direction: column; gap: 6px"><h2 style="margin: 0; font-size: 26px; font-weight: 700">${title}</h2><p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${C.muted}">${sub}</p></div>
${body}
<div style="display: flex; justify-content: space-between; gap: 12px; padding-top: 4px">${backBtn ? button('Back', { variant: 'ghost' }) : button('Not now', { variant: 'ghost' })}${next}</div></div>`);
const startWhich = () => steps(1, 'Wheelhouse’s website, or your Shopify shop?', 'You can change this later.', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Which website</legend>
${option('Wheelhouse’s website', true, 'Made from your shop’s details, in your colours. Products, stock, booking repairs and click and collect all built in.')}
${option('Connect your Shopify shop', false, 'Keep your Shopify look and checkout. Wheelhouse sends Shopify your products, prices and stock, and Shopify orders come into Online orders.')}</fieldset>`, button('Next'), false);
const startLook = () => steps(2, 'Your logo and colour', 'Wheelhouse suggests colours from your logo. You can change anything later under Theme.', `<div style="display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; align-items: start">
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Logo</span><div role="img" aria-label="Your logo, uploaded" style="height: 140px; display: flex; align-items: center; justify-content: center; border-radius: 10px; border: 2px dashed ${C.border}; background: ${C.panel}; color: ${C.muted}; font-size: 14px">[Your logo]</div>${linkBtn('Change logo')}</div>
<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 12px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 8px">Main colour — for buttons and links</legend><span style="font-size: 14px; color: ${C.muted}">From your logo</span><div style="display: flex; gap: 18px">${swatch(OCEAN, true, 'Colour from your logo, 1')}${swatch('#2F6B4F', false, 'Colour from your logo, 2')}${swatch('#2A2822', false, 'Soft sand, Wheelhouse’s own')}</div>${linkBtn('Choose another colour')}${note('Every colour is checked so text on it stays easy to read.')}</fieldset></div>`, button('Next'));
const startProducts = () => steps(3, 'Start with every product online, or nothing?', 'Either way, every category and product has its own “Show on website” switch afterwards.', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Start with</legend>
${option('Every product online', true, 'Everything with a price shows. Switch off what you don’t want online.', 'start')}
${option('Nothing online', false, 'Add categories and products as you go.', 'start')}</fieldset>${note('Your website stays off until you turn it on.')}`, button('Make my website'));

// ---------- The editor (decisions 1, 2, 3) ----------
// The website as customers see it, scaled down, beside a panel. The preview
// can't be clicked through to the shop's links; clicking a part selects it.
const PREVIEW_W = 884;
const scaled = (html, w, h, s, label) => `<div role="region" aria-label="${esc(label)}" style="flex-shrink: 0; width: ${Math.round(w * s)}px; height: ${Math.round(h * s)}px; overflow: hidden; border-radius: 8px; border: 1px solid ${C.border}; box-shadow: 0 6px 24px rgba(38,36,32,0.12); background: #ffffff"><div inert style="width: ${w}px; height: ${h}px; transform: scale(${s}); transform-origin: 0 0">${html}</div></div>`;
// Outline the part being edited (ink, not amber — amber is only "you are here").
const pick = (html, part) => {
  const ring = `outline: 4px solid ${C.ink}; outline-offset: -4px; `;
  if (part === 'header') return html.replace('<header style="', `<header style="outline: 4px solid ${C.ink}; outline-offset: -4px; `);
  return html.replace(`aria-labelledby="${part}" style="`, `aria-labelledby="${part}" style="${ring}`);
};
const recolour = (html, hex) => html.replaceAll(`border: 1px solid ${C.accent}; background: ${C.accent}; color: #ffffff`, `border: 1px solid ${hex}; background: ${hex}; color: #ffffff`);
const homeDesktop = () => browseScreens['wb-home'].desktop;
const homePhone = () => browseScreens['wb-home'].phone;
const previewArea = (inner, caption) => `<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 28px; background: ${C.mutedBg}; overflow: hidden"><span style="align-self: flex-start; font-size: 13px; color: ${C.muted}">${caption}</span>${inner}</div>`;
const desktopPreview = ({ part = '', colour = '' } = {}, html = homeDesktop()) => {
  let h = part ? pick(html, part) : html;
  if (colour) h = recolour(h, colour);
  return scaled(h, W, H, PREVIEW_W / W, 'Preview of your website on a computer');
};
const seg = (items) => `<div role="group" aria-label="Preview size" style="display: inline-flex; padding: 3px; border-radius: 10px; background: ${C.mutedBg}">${items.map(([t, on, ic]) => `<button type="button" aria-pressed="${on}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border: 0; border-radius: 8px; background: ${on ? C.panel : 'transparent'}; box-shadow: ${on ? '0 1px 3px rgba(38,36,32,0.15)' : 'none'}; font-family: inherit; font-size: 14px; font-weight: ${on ? 700 : 500}; color: ${C.ink}">${icon(ic, 16)}${t}</button>`).join('')}</div>`;
const STATES = {
  changes: [`<span style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600"><span style="width: 8px; height: 8px; border-radius: 999px; background: ${C.warnInk}"></span>Unpublished changes</span>`, true],
  published: [`<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: ${C.successInk}; font-weight: 600">${icon('check', 16)}All changes published</span>`, false],
  first: [`<span style="font-size: 14px; color: ${C.muted}">Not published yet</span>`, true],
};
const topBar = ({ state = 'changes', pageName = 'Home', phone = false }) => {
  const [label, canPublish] = STATES[state];
  return `<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 16px; display: flex; align-items: center; gap: 14px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
${back('Website')}<span aria-hidden="true" style="width: 1px; height: 28px; background: ${C.border}"></span>
<button type="button" aria-haspopup="listbox" aria-label="Page you’re editing: ${esc(pageName)}" style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"><span style="color: ${C.muted}">Page:</span><strong>${pageName}</strong>${icon('chevron', 14)}</button>
${seg([['Computer', !phone, 'till'], ['Phone', phone, 'phone']])}
<span style="flex-grow: 1"></span>
${label}
${button('History', { variant: 'ghost' })}${canPublish && state !== 'first' ? button('Discard changes', { variant: 'ghost' }) : ''}${canPublish ? button('Publish') : off(button('Publish'))}
</header>`;
};
const offStrip = () => `<div role="status" style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 6px 16px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 14px">${icon('lock', 16)}<span style="flex-grow: 1"><strong>Your website is off.</strong> Only your staff can see it — publishing gets it ready, and customers see it once it’s on.</span>${button('Turn it on', { variant: 'default', size: 'sm' }).replace('padding: 5px 10px; font-size: 13px', 'padding: 0 12px; min-height: 36px; font-size: 13px')}</div>`;
const tabs = (on) => `<div role="tablist" aria-label="Edit" style="flex-shrink: 0; display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid ${C.border}">${[['Sections', 'sections'], ['Theme', 'theme']].map(([t, k]) => `<button type="button" role="tab" aria-selected="${k === on}" style="min-height: 48px; border: 0; border-bottom: 3px solid ${k === on ? C.ink : 'transparent'}; background: transparent; font-family: inherit; font-size: 15px; font-weight: ${k === on ? 700 : 500}; color: ${C.ink}">${t}</button>`).join('')}</div>`;
const editor = ({ panel, tab = 'sections', preview, caption = 'Home · as customers see it on a computer', state = 'changes', siteOff = false, pageName = 'Home', phone = false, extra = '' }) => `<div style="position: relative; width: ${W}px; height: ${H}px; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">
${topBar({ state, pageName, phone })}${siteOff ? offStrip() : ''}
<div style="flex-grow: 1; min-height: 0; display: flex">
<aside aria-label="Edit ${esc(pageName)}" style="width: 340px; flex-shrink: 0; display: flex; flex-direction: column; background: ${C.panel}; border-right: 1px solid ${C.border}">${tabs(tab)}<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px">${panel}</div></aside>
${previewArea(preview, caption)}
</div>${extra}</div>`;

// The sections list: the header and footer stay put; the rest can be moved
// by dragging, or with Move up / Move down (keyboard and touch).
const grip = `<svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true" style="flex-shrink: 0; color: ${C.muted}"><g fill="currentColor"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></g></svg>`;
const arrow = (dir, name) => `<button type="button" aria-label="Move ${esc(name)} ${dir}" style="width: 36px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 6px; background: transparent; color: ${C.ink}"><span style="display: inline-flex; transform: rotate(${dir === 'up' ? 180 : 0}deg)">${icon('chevron', 15)}</span></button>`;
const HOME_SECTIONS = ['Big photo and headline', 'Shop by category', 'Featured products', 'Book a repair', 'Our shops', 'Words and a picture'];
const secRow = (name, { on = false, fixed = false, hidden = false, lifted = false } = {}) => `<li style="display: flex; align-items: center; gap: 6px; min-height: 52px; padding: 0 4px 0 10px; border-radius: 8px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${lifted ? C.panel : on ? C.mutedBg : C.panel}; ${lifted ? `box-shadow: 0 10px 28px rgba(38,36,32,0.25); transform: translate(10px, -6px) rotate(-1deg); ` : ''}list-style: none">
${fixed ? `<span style="width: 14px"></span>` : grip}<button type="button" aria-current="${on}" style="flex-grow: 1; min-width: 0; min-height: 44px; padding: 0 4px; border: 0; background: transparent; font-family: inherit; text-align: left; font-size: 15px; font-weight: ${on ? 700 : 600}; color: ${hidden ? C.muted : C.ink}">${name}${hidden ? ' · hidden' : ''}</button>${fixed ? `<span style="padding-right: 10px; font-size: 13px; color: ${C.muted}">Always ${name === 'Header' ? 'at the top' : 'at the bottom'}</span>` : `${arrow('up', name)}${arrow('down', name)}`}</li>`;
const sectionList = ({ on = '', order = HOME_SECTIONS, lifted = '', gapAt = -1 } = {}) => `<div style="display: flex; flex-direction: column; gap: 4px">${h3('Sections on this page')}${note('Click one — here or on the page — to change it. Drag to move, or use the arrows.')}</div>
<ol aria-label="Sections on Home" style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px">${secRow('Header', { fixed: true, on: on === 'Header' })}${order.map((n, i) => (i === gapAt ? `<li aria-hidden="true" style="list-style: none; height: 48px; border-radius: 8px; border: 2px dashed ${C.input}"></li>` : '') + secRow(n, { on: n === on, lifted: n === lifted })).join('')}${secRow('Footer', { fixed: true })}</ol>
${button('+ Add section', { variant: 'default', block: true })}`;
const panelHead = (t, sub = '') => `${back('All sections')}<div style="display: flex; flex-direction: column; gap: 4px">${h2(t)}${sub ? note(sub) : ''}</div>`;
const saved = () => note('Saved as you go. Customers see it when you publish.');
const sectionHide = (name) => `<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid ${C.border}">${rowSwitch('Show this section', true)}${button(`Remove ${name.toLowerCase()}`, { variant: 'danger' })}</div>`;
const select = (label, value) => `<div style="display: flex; flex-direction: column; gap: 6px"><label style="font-size: 14px; font-weight: 600">${label}</label><button type="button" aria-haspopup="listbox" style="display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${value}${icon('chevron', 14)}</button></div>`;
const heroPanel = () => `${panelHead('Big photo and headline')}
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">Photo</span><div role="img" aria-label="The big photo" style="height: 120px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 2px dashed ${C.border}; background: ${C.bg}; color: ${C.muted}; font-size: 14px">[Big photo of the shop]</div><div style="display: flex; gap: 14px">${linkBtn('Change photo')}${linkBtn('Describe it for screen readers')}</div></div>
${field('Headline', { value: '[Headline]' })}${field('Line under it', { value: '[A line about the shop]' })}
${select('First button', 'Book a repair')}${select('Second button', 'Shop')}
${saved()}${sectionHide('Big photo')}`;
const KINDS = [
  ['Big photo and headline', 'A wide photo with your words and up to two buttons'],
  ['Shop by category', 'Categories you choose, with photos'],
  ['Featured products', 'Up to 8 products you pick, or your newest'],
  ['Book a repair', 'Your words, your main services and prices'],
  ['Our shops', 'Each shop’s address, hours and phone'],
  ['Words and a picture', 'Anything — the team, a club ride, a sale'],
  ['Text', 'Headings and paragraphs'],
  ['Photos', 'A row or grid of photos'],
  ['Opening hours', 'From Settings, kept up to date'],
  ['Contact details', 'Phone, email and address, from Settings'],
];
const addPanel = () => `${back('All sections')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Add a section')}${note('It goes below Featured products. You can move it after.')}</div>
<ul style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px">${KINDS.map(([t, s]) => `<li style="list-style: none"><button type="button" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; min-height: 56px; padding: 8px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="font-size: 15px; font-weight: 700">${t}</span><span style="font-size: 13px; color: ${C.muted}">${s}</span></button></li>`).join('')}</ul>`;
// App map 10: each shop chooses which header link stands out as a button;
// the default highlights none.
const headerPanel = () => `${panelHead('Header', 'At the top of every page.')}
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">Logo</span><div style="display: flex; align-items: center; gap: 12px"><div role="img" aria-label="Your logo" style="width: 64px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 2px dashed ${C.border}; color: ${C.muted}; font-size: 12px">[Logo]</div>${linkBtn('Change logo')}</div></div>
<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 14px; font-weight: 600; padding: 0 0 6px">Make one link stand out as a button</legend>${[['None', true], ['Shop', false], ['Book a repair', false], ['Our shops', false]].map(([t, on]) => `<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer"><input type="radio" name="hdr"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="font-size: 15px">${t}</span></label>`).join('')}</fieldset>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: 600">Links in the header</span><span style="font-size: 14px; color: ${C.muted}">Shop, Book a repair, Our shops — and any page you add to the header, in Pages.</span></div>${saved()}`;

// ---------- Theme (decision 3) ----------
const colourField = (label, hex, sub, error = '') => `<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">${label}</span><div style="display: flex; align-items: center; gap: 10px"><button type="button" aria-label="Pick ${esc(label.toLowerCase())}" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 8px; border: 1px solid ${C.input}; background: ${hex}"></button><input aria-label="${esc(label)} code" value="${hex}" style="flex-grow: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${error ? C.danger : C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 14px; color: ${C.ink}"></div>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}${error}</div>`;
const pair = (label, a, b, on) => `<div role="group" aria-label="${label}" style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">${label}</span><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">${[[a, on === a], [b, on === b]].map(([t, x]) => `<button type="button" aria-pressed="${x}" style="min-height: 44px; border-radius: 8px; border: ${x ? 2 : 1}px solid ${x ? C.ink : C.border}; background: ${C.panel}; font-family: inherit; font-size: 14px; font-weight: ${x ? 700 : 500}; color: ${C.ink}">${t}</button>`).join('')}</div></div>`;
const fontRow = (name, sub, on) => `<label style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 12px; border-radius: 8px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; cursor: pointer"><input type="radio" name="font"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span></label>`;
const themePanel = ({ colour = OCEAN, warn = false, fonts = false } = {}) => {
  const contrast = warn ? `<div role="alert" style="display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 14px; line-height: 1.45"><span style="display: flex; gap: 8px">${icon('alert', 16)}<span><strong>White text on this colour is hard to read.</strong> Buttons and links would be hard to see for many customers.</span></span><span style="display: flex; align-items: center; gap: 10px"><span aria-hidden="true" style="width: 28px; height: 28px; border-radius: 6px; background: #7A5A10"></span>${button('Use #7A5A10 instead', { variant: 'default' })}</span><span style="color: ${C.ink}">The nearest colour to yours that stays easy to read.</span></div>` : '';
  return fonts
    ? `${back('Theme')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Fonts')}${note('Each pair is tested to read well on screens. Shown in its own font.')}</div>
<div role="radiogroup" aria-label="Fonts" style="display: flex; flex-direction: column; gap: 6px">${fontRow('Public Sans', 'Headings and text · Wheelhouse’s own', true)}${['[Font pair]', '[Font pair]', '[Font pair]', '[Font pair]', '[Font pair]'].map((f) => fontRow(f, '[Heading font] with [text font]', false)).join('')}</div>${note('About a dozen pairs. More can be added to the list later.')}`
    : `<div style="display: flex; flex-direction: column; gap: 4px">${h3('Your colours, fonts and style')}${note('Used on every page.')}</div>
${colourField('Main colour', colour, 'Buttons and links', contrast)}
${colourField('Background', '#F4EEE1', 'Soft sand, Wheelhouse’s own')}
${select('Fonts', 'Public Sans · headings and text')}
${pair('Corners', 'Rounded', 'Square', 'Rounded')}${pair('Buttons', 'Filled', 'Outlined', 'Filled')}
${saved()}${linkBtn('Go back to Soft sand')}`;
};

// ---------- Publishing (decision 2) ----------
const discard = () => popup('dc-title', 'Discard your unpublished changes?', 'Changes saved since you last published, on [date]', `<p style="margin: 0; font-size: 15px; line-height: 1.5">[n] changes go. Your website stays exactly as customers see it now.</p>`, `${button('Keep editing', { variant: 'ghost' })}${button('Discard changes', { variant: 'danger' })}`, 500);
const version = (who, when, now = false, label = '') => `<li style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 0; border-top: 1px solid ${C.border}; list-style: none"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${when}${label ? ` · ${label}` : ''}</span><span style="font-size: 13px; color: ${C.muted}">Published by ${who}</span></span>${now ? badge('What customers see now', 'green') : button('Go back to this version', { variant: 'default' })}</li>`;
const history = () => popup('hi-title', 'Earlier versions', 'The last [n] times the website was published', `<ul style="margin: 0; padding: 0">${version('Jack Lewis', '[date], [time]', true)}${version('Jo Taylor', '[date], [time]')}${version('Jack Lewis', '[date], [time]')}${version('Jack Lewis', '[date], [time]', false, 'first published')}</ul>${note('Going back puts that version in the editor as unpublished changes. Check it, then press Publish.')}`, button('Close', { variant: 'ghost' }), 600);

// ---------- Pages (decision 4) ----------
const PAGES = [
  ['Home', 'The first page', '—', ''],
  ['About us', 'Footer', '[date]', ''],
  ['Contact us', 'Footer', '[date]', ''],
  ['Collection and returns', 'Footer', 'Never', 'check'],
  ['Privacy', 'Footer', 'Never', 'check'],
  ['Cookies', 'Footer', 'Never', ''],
];
const pagesList = () => websitePage(`${back('Website')}
<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Pages', 'pg-h')}${note('Each page is made of sections, like the home page. Your address, phone and opening hours come from Settings.')}</div>${button('+ New page')}</div>
${card(`<table aria-labelledby="pg-h" style="width: 100%; border-collapse: collapse; font-size: 15px"><thead><tr style="text-align: left; color: ${C.muted}; font-size: 13px"><th style="padding: 12px 18px; font-weight: 600">Page</th><th style="padding: 12px; font-weight: 600">Shown in</th><th style="padding: 12px; font-weight: 600">Last changed</th><th style="padding: 12px 18px"><span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Edit</span></th></tr></thead><tbody>${PAGES.map(([n, where, when, flag]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 10px 18px"><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px"><strong>${n}</strong>${flag ? badge('Starting wording · check it', 'amber') : ''}</span></td><td style="padding: 10px 12px">${where}</td><td style="padding: 10px 12px; color: ${C.muted}">${when}</td><td style="padding: 6px 18px; text-align: right"><a href="#" aria-label="Edit ${esc(n)}" style="${tall}; font-weight: 600; color: ${C.ink}">Edit</a></td></tr>`).join('')}</tbody></table>`, 'overflow: hidden; flex-shrink: 0')}
${note('Collection and returns and Privacy start with wording for you to check — ideally with a solicitor. Each shop is responsible for its own policies.')}`);
const newPage = () => popup('np-title', 'New page', 'It starts with a heading and a block of text', `${field('Page name', { value: 'Bike fitting', hint: 'Also its web address: ' + FREE + '/bike-fitting' })}<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 14px; font-weight: 600; padding: 0 0 6px">Where it’s linked from</legend>${[['The header', true], ['The footer', false], ['Nowhere — only by its address', false]].map(([t, on]) => `<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer"><input type="radio" name="where"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="font-size: 15px">${t}</span></label>`).join('')}</fieldset>`, `${button('Cancel', { variant: 'ghost' })}${button('Make the page')}`, 520);
const returnsSite = () => siteDesktop('sand', '', `<div style="display: flex; flex-direction: column; gap: 18px; max-width: 760px"><h1 id="pg-h1" style="margin: 0; font-size: 30px; font-weight: 700">Collection and returns</h1>
<section aria-labelledby="pg-collect" style="display: flex; flex-direction: column; gap: 8px"><h2 id="pg-collect" style="margin: 0; font-size: 20px; font-weight: 700">Collecting your order</h2><p style="margin: 0; font-size: 15px; line-height: 1.6">[Starting wording: how click and collect works, how long orders are kept, what to bring]</p></section>
<section aria-labelledby="pg-returns" style="display: flex; flex-direction: column; gap: 8px"><h2 id="pg-returns" style="margin: 0; font-size: 20px; font-weight: 700">Returns</h2><p style="margin: 0; font-size: 15px; line-height: 1.6">[Starting wording: returning something bought online or in the shop, and refunds]</p></section>
<section aria-labelledby="pg-contact" style="display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}"><h2 id="pg-contact" style="margin: 0; font-size: 18px; font-weight: 700">Questions?</h2><span style="font-size: 15px">North Street Cycles, Bolton · [shop phone] · [shop email]</span></section></div>`);
const returnsPanel = () => `${msg('<strong>Starting wording — check it before you publish.</strong> Ideally with a solicitor. You’re responsible for your own policies.', 'warn')}
<div style="display: flex; flex-direction: column; gap: 4px">${h3('Sections on this page')}</div>
<ol aria-label="Sections on Collection and returns" style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px">${secRow('Header', { fixed: true })}${['Page heading', 'Text · Collecting your order', 'Text · Returns', 'Contact details'].map((n, i) => secRow(n, { on: i === 1 })).join('')}${secRow('Footer', { fixed: true })}</ol>${button('+ Add section', { variant: 'default', block: true })}`;

// ---------- Tracking tools (decision 6) ----------
const TOOLS = [['Google Analytics', 'Statistics'], ['Microsoft Clarity', 'Statistics'], ['Meta (Facebook) Pixel', 'Marketing'], ['TikTok Pixel', 'Marketing']];
const toolRow = (name, kind, { on = false, id = '', error = '' } = {}) => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 18px; border-top: 1px solid ${C.border}"><div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1"><span style="font-size: 16px; font-weight: 700">${name}</span><span>${badge(kind, kind === 'Marketing' ? 'purple' : 'blue')}</span></span><span style="width: 180px">${rowSwitch(`<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">${esc(name)}</span>`, on)}</span></div>${on ? `<div style="max-width: 440px">${field(`Your ${name} ID`, { value: id, placeholder: '[ID from the tool]', hint: error ? '' : 'From your Google Analytics account. It starts with G-', error, linked: true })}</div>` : ''}</div>`;
const tracking = ({ on = false, error = false, toastHtml = '' } = {}) => {
  const content = `${back('Website')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Tracking tools', 'tt-h')}${note('Tools that show how people use your website, or help with adverts.')}</div>
${msg(on ? '<strong>Your website now asks customers about cookies.</strong> Google Analytics only loads for customers who say yes to “Statistics”.' : 'With no tools on, your website only uses the cookies it needs to work — so customers get no cookie pop-up.', on ? 'ok' : 'grey', on && !error)}
${card(TOOLS.map(([n, k], i) => toolRow(n, k, i === 0 && on ? { on: true, id: error ? 'UA-[number]' : 'G-[ID]', error: error ? 'That doesn’t look like a Google Analytics ID. It starts with G- and is in your Google Analytics settings.' : '' } : {})).join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden; flex-shrink: 0')}
${note('Each tool is marked Statistics or Marketing, so the cookie choice asks customers the right question. No tool loads until a customer agrees. Missing a tool? Ask us to add it.')}`;
  return toastHtml ? websitePage(content).replace('<main style="', '<main style="position: relative; ').replace('</main>', `${toastHtml}</main>`) : websitePage(content);
};

// ---------- Web address (decision 7) — waiting on the business plan ----------
const RECORDS = [['[Record type]', '[Name]', '[Value]'], ['[Record type]', '[Name]', '[Value]']];
const address = (stage = 'start') => {
  const free = box(`${h3(stage === 'done' ? 'Your address' : 'Your free address')}<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px"><a href="#" style="font-size: 17px; font-weight: 700; color: ${C.ink}">${stage === 'done' ? OWN : FREE}</a>${button('Copy', { variant: 'default' })}</div>${stage === 'done' ? note(`${FREE} still works, and sends people to ${OWN}.`) : ''}`);
  const own = {
    start: box(`${h3('Use your own address')}${note('If you already have one — for example from your old website — customers can keep using it.')}<div style="display: flex; align-items: flex-end; gap: 12px; max-width: 560px"><div style="flex-grow: 1">${field('Your address', { placeholder: OWN })}</div>${button('Next')}</div>`),
    steps: box(`${h3(`Connect ${OWN}`)}<p style="margin: 0; font-size: 15px; line-height: 1.5">Sign in where you bought your address, find its <strong>DNS settings</strong>, and add these 2 records.</p>
<table style="width: 100%; border-collapse: collapse; font-size: 14px"><thead><tr style="text-align: left; color: ${C.muted}; font-size: 13px"><th style="padding: 8px 0; font-weight: 600">Type</th><th style="padding: 8px; font-weight: 600">Name</th><th style="padding: 8px; font-weight: 600">Value</th><th></th></tr></thead><tbody>${RECORDS.map(([t, n, v]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 8px 0">${mono(t)}</td><td style="padding: 8px">${mono(n)}</td><td style="padding: 8px">${mono(v)}</td><td style="text-align: right">${button('Copy', { variant: 'default', size: 'sm' }).replace('padding: 5px 10px', 'padding: 0 12px; min-height: 44px')}</td></tr>`).join('')}</tbody></table>
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; font-size: 14px"><span style="color: ${C.muted}">Step-by-step for:</span>${['[Registrar]', '[Registrar]', '[Registrar]', 'Somewhere else'].map((r) => `<a href="#" style="${tall}; font-weight: 600; color: ${C.ink}">${r}</a>`).join('')}</div>
<div style="display: flex; gap: 12px">${button('Check connection')}${button('Cancel', { variant: 'ghost' })}</div>`),
    waiting: box(`${h3(`Connect ${OWN}`)}${msg('<strong>Not connected yet</strong> — this can take up to a day after you add the records. We’ll keep checking and email you when it works.', 'grey', true)}<div style="display: flex; flex-wrap: wrap; gap: 12px">${button('Check again', { variant: 'default' })}${button('See the 2 records', { variant: 'ghost' })}</div>${note('Last checked [time]. If it still isn’t working after a day, check the records match exactly.')}`),
    done: box(`${h3('Your own address')}${msg(`<strong>Connected.</strong> ${OWN} shows your website, with the padlock that keeps it secure.`, 'ok', true)}${linkBtn('Stop using this address')}`),
  }[stage];
  return websitePage(`${back('Website')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Web address')}${note('Where customers find your website.')}</div>${free}${own}`);
};

// ---------- Online payments setup (decision 8) — Settings › Online orders ----------
const master = () => card(`<div style="padding: 4px 18px">${rowSwitch('Buying online', true)}<p style="margin: 0 0 12px; font-size: 14px; color: ${C.muted}">Customers can buy from your website and collect from the shop.</p></div>`, 'flex-shrink: 0');
const wallets = (on) => `${rowSwitch('Apple Pay and Google Pay', on)}${rowSwitch('Gift cards', on)}${rowSwitch('Store credit (for signed-in customers)', on)}`;
const PAY = {
  none: `${msg('<strong>Not connected.</strong> Customers can’t pay online, and “Pay now” for repairs is hidden, until you connect [payment provider].', 'grey')}
<div>${button('Connect [payment provider]')}</div>
${note('Opens [payment provider]’s own page to sign up or sign in, then brings you back here. Your shop has its own account with them: card details, payouts and fees ([fees]) are between you and [payment provider].')}`,
  connected: `${msg('Connected to [payment provider] by Jack Lewis just now', 'ok', true)}
<div style="display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 10px; border: 1px solid ${C.border}">${h3('Make a test payment')}<p style="margin: 0; font-size: 15px; line-height: 1.5">Pay £1.00 with your own card to check everything works. It’s refunded straight away.</p><div>${button('Make a test payment', { variant: 'default' })}</div></div>
${wallets(true)}`,
  tested: `${msg('Connected to [payment provider] by Jack Lewis on [date]')}
${msg('<strong>Test payment worked.</strong> £1.00 taken and refunded. Payouts go to the account ending [last 4 digits], [payout timing].', 'ok', true)}
${wallets(true)}`,
  failed: `${msg('<strong>Not connected.</strong> [payment provider] didn’t finish connecting, so nothing has changed. Try again — if it keeps happening, [payment provider]’s support can see why.', 'bad', true)}
<div>${button('Try again')}</div>`,
  more: `${msg('<strong>[payment provider] needs more details from you by [date]</strong>, or online payments will stop. It’s usually [what they need].', 'warn')}
<div>${button('Add the details at [payment provider]', { variant: 'default' })}</div>
${msg('Connected to [payment provider] by Jack Lewis on [date]', 'grey')}
${wallets(true)}`,
};
const paySettings = (k) => withOnlineArea(() => settingsPage('online', 'Online orders', ONLINE_INTRO, onlineFolds({ pay: PAY[k] }), { who: OWNER })).replace(/(<section aria-labelledby="set-online"[^>]*><div[^>]*>[\s\S]*?<\/div>)/, `$1${master()}`).replace(/(Paying online<\/span><span style="font-size: 13px; color: [^;]+; text-align: right">)[^<]*/, `$1${k === 'none' || k === 'failed' ? 'Not connected' : '[Payment provider] · gift cards and store credit'}`);

// ---------- Shopify (decisions 9, 10) ----------
const shopify = (stage = 'connect') => {
  if (stage === 'connect') return websitePage(`${back('Website')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Connect your Shopify shop')}${note('Keep your Shopify look, theme and checkout. Wheelhouse looks after what’s for sale.')}</div>
${box(`<div style="display: flex; align-items: flex-end; gap: 12px; max-width: 600px"><div style="flex-grow: 1">${field('Your Shopify address', { placeholder: '[your-shop].myshopify.com' })}</div>${button('Connect')}</div>${note('Opens Shopify to approve the connection, then brings you back here.')}`)}
${box(`${h3('What happens')}<ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.5"><li>Your products, prices, photos and stock go to Shopify, and keep in step. “Show on website” decides which.</li><li>Shopify orders come into <strong>Front desk › Online orders</strong>, with your other orders, and take the stock off straight away.</li><li><strong>Change products, prices and stock in Wheelhouse.</strong> Changes made to them in Shopify are replaced.</li><li>Payments for Shopify orders go through Shopify’s own checkout.</li></ul>`)}`);
  const problem = stage === 'problem';
  return websitePage(`${box(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px"><span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${problem ? C.warnBg : C.okBg}; color: ${problem ? C.warnInk : C.successInk}">${icon(problem ? 'alert' : 'check', 22)}</span><div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1">${h2('Connected to your Shopify shop')}<span style="font-size: 15px; color: ${C.muted}">[your-shop].myshopify.com · last sent [time] · [n] products</span></div>${button('Open Shopify', { variant: 'default' })}</div>
${problem ? `<div role="alert" style="display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}"><strong style="display: flex; gap: 8px; font-size: 15px">${icon('alert', 18)}3 products couldn’t be sent to Shopify</strong><ul style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; color: ${C.ink}">${[['[Product]', 'No price yet'], ['[Product]', 'No photo — Shopify needs one for this category'], ['[Product]', '[Shopify’s reason]']].map(([p, r]) => `<li style="list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 15px"><strong>${p}</strong><span>${r}</span><a href="#" aria-label="Fix ${esc(p)} in Stock" style="${tall}; font-weight: 600; color: ${C.ink}">Fix in Stock</a></li>`).join('')}</ul><span>${button('Try sending again', { variant: 'default' })}</span></div>` : ''}`)}
${rows(row('Orders from Shopify', 'In Front desk › Online orders, with your other orders'), row('What’s sent to Shopify', '“Show on website” on each category and product, in Stock'), row('Wheelhouse’s website or Shopify', 'Your Shopify shop · switch to Wheelhouse’s website'))}
${note('Change products, prices and stock here in Wheelhouse — changes to them made in Shopify are replaced. Your Shopify theme and pages are edited in Shopify.')}`);
};
const shopifyOrder = () => {
  let n = 0;
  return onlineScreens['on-orders'].desktop.replace(/paid \[time\]/g, (m) => (++n === 2 ? `${m} · ${badge('From Shopify', 'blue')}` : m));
};

// ---------- The boards ----------
def('ws-start-which', () => startWhich());
def('ws-start-look', () => startLook());
def('ws-start-products', () => startProducts());
def('ws-editor-first', () => editor({ state: 'first', siteOff: true, preview: desktopPreview({ colour: OCEAN }), panel: `${msg('<strong>Here’s your website</strong>, made from your shop’s details. Click any part to change it.', 'ok')}${sectionList()}` }));
def('ws-page', () => overview());
def('ws-page-on', () => overview({ on: true, changes: true }));
def('ws-editor', () => editor({ siteOff: false, preview: desktopPreview({ colour: OCEAN }), panel: sectionList() }));
def('ws-editor-section', () => editor({ preview: desktopPreview({ part: 'hero-h', colour: OCEAN }), panel: heroPanel() }));
def('ws-editor-add', () => editor({ preview: desktopPreview({ part: 'h-prods', colour: OCEAN }), panel: addPanel() }));
def('ws-editor-drag', () => editor({ preview: desktopPreview({ colour: OCEAN }), panel: sectionList({ lifted: 'Book a repair', gapAt: 2 }) }));
def('ws-editor-moved', () => editor({ preview: desktopPreview({ colour: OCEAN }), panel: sectionList({ on: 'Book a repair', order: ['Big photo and headline', 'Shop by category', 'Book a repair', 'Featured products', 'Our shops', 'Words and a picture'] }), extra: toast('Book a repair moved above Featured products', 'Undo') }));
def('ws-editor-header', () => editor({ preview: desktopPreview({ part: 'header', colour: OCEAN }), panel: headerPanel() }));
def('ws-editor-phone', () => editor({ phone: true, caption: 'Home · as customers see it on a phone', preview: scaled(recolour(homePhone(), OCEAN), 390, 844, 0.8, 'Preview of your website on a phone'), panel: sectionList() }));
def('ws-theme', () => editor({ tab: 'theme', preview: desktopPreview({ colour: OCEAN }), panel: themePanel() }));
def('ws-theme-contrast', () => editor({ tab: 'theme', preview: desktopPreview({ colour: '#E8C547' }), panel: themePanel({ colour: '#E8C547', warn: true }) }));
def('ws-theme-fonts', () => editor({ tab: 'theme', preview: desktopPreview({ colour: OCEAN }), panel: themePanel({ fonts: true }) }));
def('ws-published', () => editor({ state: 'published', preview: desktopPreview({ colour: OCEAN }), panel: sectionList(), extra: toast('Published — customers see it now', '') }));
def('ws-discard', () => overlay(editor({ preview: desktopPreview({ colour: OCEAN }), panel: sectionList() }), discard()));
def('ws-history', () => overlay(editor({ preview: desktopPreview({ colour: OCEAN }), panel: sectionList() }), history()));
def('ws-pages', () => pagesList());
def('ws-pages-new', () => overlay(pagesList(), newPage()));
def('ws-page-returns', () => editor({ pageName: 'Collection and returns', caption: 'Collection and returns · as customers see it on a computer', preview: desktopPreview({ part: 'pg-collect' }, recolour(returnsSite(), OCEAN)), panel: returnsPanel() }));
def('ws-tracking', () => tracking());
def('ws-tracking-on', () => tracking({ on: true, toastHtml: toast('Google Analytics on', 'Undo') }));
def('ws-tracking-error', () => tracking({ on: true, error: true }));
def('ws-address', () => address('start'));
def('ws-address-steps', () => address('steps'));
def('ws-address-waiting', () => address('waiting'));
def('ws-address-done', () => address('done'));
def('ws-pay-none', () => paySettings('none'));
def('ws-pay-connected', () => paySettings('connected'));
def('ws-pay-tested', () => paySettings('tested'));
def('ws-pay-failed', () => paySettings('failed'));
def('ws-pay-more', () => paySettings('more'));
def('ws-shopify-connect', () => shopify('connect'));
def('ws-shopify-on', () => shopify('on'));
def('ws-shopify-problem', () => shopify('problem'));
def('ws-shopify-order', () => shopifyOrder());

// Desktop first (tablet and phone after the UI audit).
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ws-start-which': 'Set up, step 1: Wheelhouse’s website or your Shopify shop?',
  'ws-start-look': 'Step 2: logo and main colour, suggested from the logo',
  'ws-start-products': 'Step 3: start with every product online, or nothing',
  'ws-editor-first': 'The editor opens on a ready-made home page, still off',
  'ws-page': 'Office › Website: off, Edit website, pages, tracking, address',
  'ws-page-on': 'On, with unpublished changes',
  'ws-editor': 'The editor: sections down the side, the page as customers see it',
  'ws-editor-section': 'A section chosen: its settings in the panel, outlined on the page',
  'ws-editor-add': '+ Add section: the kinds of section',
  'ws-editor-drag': 'Dragging a section to a new place (or use its arrows)',
  'ws-editor-moved': 'Moved, with Undo',
  'ws-editor-header': 'The header: logo, and one link as a button',
  'ws-editor-phone': 'Preview on a phone',
  'ws-theme': 'Theme: main colour, background, fonts, corners, buttons',
  'ws-theme-contrast': 'A colour that’s hard to read: the nearest one that works',
  'ws-theme-fonts': 'Fonts: a chosen list of tested pairs',
  'ws-published': 'Published: customers see it now',
  'ws-discard': 'Discard unpublished changes?',
  'ws-history': 'Earlier versions: go back to one',
  'ws-pages': 'Pages: ready-made, two with wording to check',
  'ws-pages-new': 'A new page, and where it’s linked from',
  'ws-page-returns': 'Editing Collection and returns: starting wording to check',
  'ws-tracking': 'Tracking tools: none on, so no cookie pop-up',
  'ws-tracking-on': 'Google Analytics on: the website now asks about cookies',
  'ws-tracking-error': 'An ID that doesn’t look right',
  'ws-address': 'Web address: the free one, or use your own (waiting on a decision)',
  'ws-address-steps': 'Your own address: the 2 records to add',
  'ws-address-waiting': 'Not connected yet — up to a day',
  'ws-address-done': 'Your own address connected',
  'ws-pay-none': 'Online orders › Paying online: not connected',
  'ws-pay-connected': 'Back from [payment provider]: connected, make a test payment',
  'ws-pay-tested': 'The test payment worked',
  'ws-pay-failed': 'Connecting didn’t finish: nothing changed',
  'ws-pay-more': '[payment provider] needs more details',
  'ws-shopify-connect': 'Connect your Shopify shop: what happens',
  'ws-shopify-on': 'Connected to Shopify: the Website page',
  'ws-shopify-problem': 'Products that couldn’t be sent to Shopify',
  'ws-shopify-order': 'A Shopify order in Online orders',
};
export const ROWS = [
  { label: 'Setting it up', screens: ['ws-start-which', 'ws-start-look', 'ws-start-products', 'ws-editor-first'] },
  { label: 'The Website page', screens: ['ws-page', 'ws-page-on'] },
  { label: 'Editing the home page', screens: ['ws-editor', 'ws-editor-section', 'ws-editor-add', 'ws-editor-drag', 'ws-editor-moved', 'ws-editor-header', 'ws-editor-phone'] },
  { label: 'Theme', screens: ['ws-theme', 'ws-theme-contrast', 'ws-theme-fonts'] },
  { label: 'Publishing', screens: ['ws-published', 'ws-discard', 'ws-history'] },
  { label: 'Pages', screens: ['ws-pages', 'ws-pages-new', 'ws-page-returns'] },
  { label: 'Tracking tools', screens: ['ws-tracking', 'ws-tracking-on', 'ws-tracking-error'] },
  { label: 'Web address (waiting on the business plan decision)', screens: ['ws-address', 'ws-address-steps', 'ws-address-waiting', 'ws-address-done'] },
  { label: 'Online payments setup', screens: ['ws-pay-none', 'ws-pay-connected', 'ws-pay-tested', 'ws-pay-failed', 'ws-pay-more'] },
  { label: 'Shopify', screens: ['ws-shopify-connect', 'ws-shopify-on', 'ws-shopify-problem', 'ws-shopify-order'] },
];
