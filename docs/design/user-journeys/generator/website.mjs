// Journey 18 — Website management, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-02-website-management-review.md
// UI audit: docs/design/user-journeys/website-ui-audit.md (decision 12: every
// recommendation taken)
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
// three-step start, then the editor. 12: the UI audit, every recommendation.
//
// Real example data only: North Street Cycles, Bolton, "[Second site]",
// Jack Lewis (Owner), Jo Taylor (Staff). The pages in the preview are journey
// 1's. Colours shown are examples of a shop's choice (the app map's "Ocean"
// example); addresses, IDs, dates, counts and the payment provider are
// bracketed placeholders.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, settingsPage, onlineFolds, ONLINE_INTRO, withOnlineArea, rowSwitch } from './settings-frame.mjs';
import { withRooms } from './diary.mjs';
import { today } from './opening.mjs';
import { screens as browseScreens } from './browse.mjs';
import { screens as onlineScreens } from './online.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const sr = (t) => `<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap">${t}</span>`;
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
// The website's own pages are drawn at desktop size and scaled into the
// editor's preview; the editor itself is drawn at each size.
const W = 1280, H = 800;
const DIMS = { desktop: [1280, 800], tablet: [1180, 820], phone: [390, 844] };
const isP = () => SIZE === 'phone';
const isT = () => SIZE === 'tablet';
const panelW = () => (isT() ? 300 : 340);
// The preview's scale: what's left beside the panel (or the whole width
// with Bigger).
const pScale = (big = false) => (big ? DIMS[SIZE][0] - 60 : DIMS[SIZE][0] - panelW() - 56) / W;
const FREE = '[shop-name].wheelhouseepos.com';
const OWN = '[your-shop].co.uk';
const OCEAN = '#1A3F66';
const tall = 'display: inline-flex; align-items: center; min-height: 44px';
// UX walk-through 4 M6: what goes online is counted before it does. A product
// with no photo shows as a tile with its name; one with no price stays off.
// "See them" opens Stock filtered to those products.
const COUNTS = [['[n] products go online', ''], ['[n] have no photo (shown with their name)', 'no photo'], ['[n] have no price (stay off until priced)', 'no price']];
const seeThem = (what, px = 14) => `<a href="#" aria-label="See the products with ${what}, in Stock" style="${tall}; font-size: ${px}px; font-weight: 600; color: ${C.ink}">See them</a>`;
const productCounts = (px = 15) => `<ul aria-label="Your products online" style="margin: 0; padding: 0; display: flex; flex-direction: column">${COUNTS.map(([t, what]) => `<li style="list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 0 12px; min-height: ${what ? 44 : 32}px; font-size: ${px}px">${t}${what ? seeThem(what, px === 15 ? 14 : px) : ''}</li>`).join('')}</ul>`;
const countsBox = (bg = C.panel) => `<div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 16px; border-radius: 10px; border: 1px solid ${C.border}; background: ${bg}"><span style="font-size: 14px; font-weight: 700; padding-top: 4px">With every product online</span>${productCounts()}</div>`;

const h2 = (t, id = '') => `<h2${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 20px; font-weight: 700">${t}</h2>`;
const h3 = (t, id = '') => `<h3${id ? ` id="${id}"` : ''} style="margin: 0; font-size: 16px; font-weight: 700">${t}</h3>`;
const box = (inner, extra = '') => card(`<div style="padding: 20px; display: flex; flex-direction: column; gap: 14px">${inner}</div>`, `flex-shrink: 0; ${extra}`);
// Audit L2: a spoken status only where the text appears after an action.
const msg = (t, tone = 'ok', live = false) => `<p${live ? ` role="${tone === 'bad' ? 'alert' : 'status'}"` : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' || tone === 'bad' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' || tone === 'bad' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' || tone === 'bad' ? 'alert' : tone === 'ok' ? 'check' : 'website', 18)}<span>${t}</span></p>`;
const linkBtn = (t, label = '') => `<button type="button"${label ? ` aria-label="${esc(label)}"` : ''} style="min-height: 44px; padding: 0; border: 0; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: underline">${t}</button>`;
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${tall}; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const off = (html, why = '') => html.replace('<button', `<button aria-disabled="true"${why ? ` title="${esc(why)}"` : ''}`).replace('style="', 'style="opacity: 0.45; ');
const back = (t) => `<a href="#" style="${tall}; align-self: flex-start; gap: 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const slot = (html) => `<div>${html}</div>`;
const toastBtn = (t) => `<button type="button" style="min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.14); color: #ffffff; font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap">${t}</button>`;
const toast = (t, actions = ['Undo'], place = '') => `<div role="status" style="position: absolute; ${place || (isP() ? 'left: 12px; right: 12px; bottom: 12px' : 'left: 50%; bottom: 24px; transform: translateX(-50%)')}; z-index: 6; display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 16px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; white-space: ${isP() ? 'normal' : 'nowrap'}; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}<span style="padding-right: 6px; flex-grow: 1">${t}</span>${actions.map(toastBtn).join('')}</div>`;
const withToast = (html, t) => html.replace('<main style="', '<main style="position: relative; ').replace('</main>', `${t}</main>`);
// A radio card (journey 2's shopOption).
const option = (name, on, sub, group = 'pick') => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 16px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="radio" name="${group}"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span></span></label>`;
const radios = (legend, items, group) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 4px"><legend style="font-size: 14px; font-weight: 600; padding: 0 0 6px">${legend}</legend>${items.map(([t, on, sub]) => `<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer"><input type="radio" name="${group}"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="font-size: 15px">${t}${sub ? ` <span style="color: ${C.muted}; font-size: 13px">${sub}</span>` : ''}</span></label>`).join('')}</fieldset>`;
// Audit L1, L5: every swatch has a visible name as well as its code.
const swatch = (hex, on, name) => `<label style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 96px; cursor: pointer; text-align: center"><input type="radio" name="colour"${on ? ' checked' : ''} aria-label="${esc(name)}, ${hex}" style="position: absolute; opacity: 0; width: 1px; height: 1px"><span aria-hidden="true" style="width: 52px; height: 52px; border-radius: 10px; background: ${hex}; box-shadow: ${on ? `0 0 0 3px ${C.panel}, 0 0 0 5px ${C.ink}` : 'inset 0 0 0 1px rgba(0,0,0,0.12)'}"></span><span style="font-size: 13px; font-weight: 600; line-height: 1.3">${name}</span>${mono(hex, 'font-size: 12px; color: ' + C.muted)}</label>`;

// ---------- Office › Website (decision 5; audit H2, H5, M4, L2) ----------
const websitePage = (content, who = OWNER) => page('website', 'Website', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`, who);
const chevron = `<span style="display: inline-flex; color: ${C.muted}; transform: rotate(-90deg)">${icon('chevron', 16)}</span>`;
const row = (title, sub, end = '') => `<a href="#" style="display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 10px 18px; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1; min-width: 0"><span style="font-size: 16px; font-weight: 700">${title}</span><span style="font-size: 14px; color: ${C.muted}">${sub}</span></span>${end}${chevron}</a>`;
const rows = (...r) => card(r.join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden; flex-shrink: 0');
// The list of unpublished changes (audit M4, M6).
const CHANGES = [['Home page', 'Headline, Book a repair moved'], ['Theme', 'Main colour'], ['Collection and returns', 'Returns text']];
const changeList = () => `<div role="region" aria-label="Unpublished changes" style="display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.bg}">${h3('4 unpublished changes')}<ul style="margin: 0; padding: 0; display: flex; flex-direction: column">${CHANGES.map(([w, what]) => `<li style="list-style: none; display: flex; flex-direction: ${isP() ? 'column' : 'row'}; gap: ${isP() ? 2 : 12}px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px"><strong style="min-width: ${isP() ? 0 : 200}px">${w}</strong><span>${what}</span></li>`).join('')}</ul>${msg('1 photo has no description. <a href="#" style="color: inherit; font-weight: 700">Add it</a>', 'grey')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Publish')}${button('Discard changes', { variant: 'ghost' })}${button('Review in the editor', { variant: 'ghost' })}</div></div>`;
const PAY_ROW = {
  none: ['Taking payments', 'Not connected · customers can look but not buy · open to connect [payment provider]', badge('Not connected', 'amber')],
  untested: ['Taking payments', 'Connected · make a test payment before customers use it', badge('Not tested', 'amber')],
  ok: ['Taking payments', 'Connected to [payment provider] · test payment done', ''],
  more: ['Taking payments', '[payment provider] needs more details by [date], or online payments stop', badge('Needs details', 'amber')],
};
const payRow = (k) => { const [t, s, end] = PAY_ROW[k]; return row(t, `${s} · in Settings › Online orders`, end); };
// UX walk-through 4 H2: during a move from Citrus Lime the website is made
// ready while running alongside and turned on during switch-over morning, so
// it never takes orders or bookings that Citrus Lime doesn't see. moving:
// 'ready' (running alongside) or 'morning' (switch-over morning).
const READY_ITEMS = (done) => [['Set up: the three steps', true], ['Payments connected, and the test payment worked', true], [done ? 'Starting wording checked' : '2 pages still have starting wording: <a href="#" style="color: inherit; font-weight: 700">Collection and returns</a>, <a href="#" style="color: inherit; font-weight: 700">Privacy</a>', done]];
const readyList = (done) => `<div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.bg}"><span style="font-size: 15px; font-weight: 700">Ready for switch-over · ${done ? '3' : '2'} of 3 <span style="font-weight: 500; color: ${C.muted}">· also on the switch-over checklist</span></span><ul style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px">${READY_ITEMS(done).map(([t, ok]) => `<li style="list-style: none; display: flex; align-items: flex-start; gap: 8px; font-size: 15px; line-height: 1.45"><span style="display: inline-flex; padding-top: 2px; color: ${ok ? C.successInk : C.warnInk}">${icon(ok ? 'check' : 'alert', 16)}</span>${sr(ok ? 'Done: ' : 'To do: ')}<span>${t}</span></li>`).join('')}</ul></div>`;
const overview = ({ on = false, published = true, changes = false, open = false, pay = 'none', tracking = false, moving = '' } = {}) => {
  // Audit L2: while the website has never been on, turning it on is the main job.
  const first = !on && !published;
  const waits = moving === 'ready';
  const turn = on ? button('Turn off', { variant: 'default' }) : waits ? off(button('Turn it on', { variant: 'default' }), 'It goes on during switch-over morning') : button('Turn it on', { variant: first ? 'accent' : 'default' });
  // UX walk-through 4 M6: the counts sit beside "Turn it on".
  const turnLines = on ? '' : moving
    ? `<div style="display: flex; flex-direction: column; gap: 10px">${waits
      ? msg('<strong>You’re moving from Citrus Lime.</strong> Your website goes on during switch-over morning, from the switch-over checklist. Until then Citrus Lime’s website keeps selling, so no order or booking reaches a shop that’s still running on Citrus Lime. <a href="#" style="color: inherit; font-weight: 700">Open the switch-over checklist</a>', 'grey')
      : msg(`<strong>Switch-over morning: turn your website on now.</strong> This also publishes it as it is now. If you use your own address, point it here next — this can take up to a day. <a href="#" style="color: inherit; font-weight: 700">Web address</a>`, 'ok')}${readyList(!waits)}${countsBox(C.bg)}</div>`
    : `<div style="display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: ${C.muted}; text-align: ${isP() ? 'left' : 'right'}">${first ? '<span>This also publishes your website as it is now.</span>' : ''}${pay === 'none' ? '<span>Customers can look but not buy until you connect payments.</span>' : ''}<span>2 pages still have starting wording: <a href="#" style="color: ${C.ink}">Collection and returns</a>, <a href="#" style="color: ${C.ink}">Privacy</a></span>${first ? COUNTS.map(([t, what]) => `<span style="display: flex; justify-content: ${isP() ? 'flex-start' : 'flex-end'}; align-items: center; gap: 10px; min-height: ${what ? 36 : 24}px">${t}${what ? seeThem(what, 13) : ''}</span>`).join('') : ''}</div>`;
  const status = box(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
<span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${on ? C.okBg : C.mutedBg}; color: ${on ? C.successInk : C.ink}">${icon(on ? 'check' : 'lock', 22)}</span>
<div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; min-width: 0">${h2(on ? 'Your website is on' : moving === 'morning' ? 'Your website is ready' : 'Your website is off', 'ws-status')}<span style="font-size: 15px; color: ${C.muted}">${on ? 'Customers can see it at' : 'Only your staff can see it. Customers will find it at'} <a href="#" style="color: ${C.ink}; font-weight: 600">${FREE}</a></span></div>
<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px">${turn}</div>
</div>${turnLines}
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-top: 14px; border-top: 1px solid ${C.border}">${button('Edit website', { iconName: 'website', variant: first ? 'default' : 'accent' })}${changes
    ? `<button type="button" aria-expanded="${open}" style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 999px; border: 1px solid ${C.warnInk}; background: ${C.warnBg}; color: ${C.warnInk}; font-family: inherit; font-size: 14px; font-weight: 700">4 unpublished changes<span style="display: inline-flex; transform: rotate(${open ? 180 : 0}deg)">${icon('chevron', 14)}</span></button><span style="font-size: 14px; color: ${C.muted}">Saved by Jack Lewis [time] · customers see them when you publish</span>`
    : `<span style="font-size: 14px; color: ${C.muted}">${published ? 'Last published by Jack Lewis on [date]' : 'Not published yet'}</span>`}</div>${open ? changeList() : ''}`);
  return websitePage(`${status}${rows(
    payRow(pay),
    // UX walk-through 4 H2: on switch-over morning the wording has been checked.
    row('Pages', 'Home, About us, Contact us, Collection and returns, Privacy, Cookies', moving === 'morning' ? '' : badge('2 to check', 'amber')),
    row('Tracking tools', tracking ? 'Google Analytics · cookie choice on' : 'None — so there’s no cookie choice'),
    row('Web address', FREE),
    row('Wheelhouse’s website or Shopify', 'Wheelhouse’s website'),
  )}
${card(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 18px"><span style="flex-grow: 1; font-size: 15px">What the website sells, “Show on website” and online payments are in <strong>Settings › Front desk › Online orders</strong>.</span><a href="#" style="${tall}; font-size: 15px; font-weight: 600; color: ${C.ink}">Open Online orders settings</a></div>`, 'flex-shrink: 0')}`);
};

// ---------- Without "Can edit the website" (audit H6) ----------
const noAccess = () => page('', 'Website', `<div style="max-width: 640px; display: flex; flex-direction: column; gap: 14px; padding-top: 8px">${box(`<span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${C.mutedBg}">${icon('lock', 22)}</span>${h2('Only some people can change the website')}<p style="margin: 0; font-size: 15px; line-height: 1.5">People with “Can edit the website” can change it: <strong>Jack Lewis</strong>. Ask them if something needs changing.</p><div>${button('Back to Today', { variant: 'default' })}</div>`)}</div>`, STAFF);
// Jo with "Can edit the website" but not "Can change settings": the
// payments row says who to ask instead of linking into Settings.
const noSettings = () => withRooms(['website'], () => websitePage(`${box(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px"><span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 22)}</span><div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1">${h2('Your website is on')}<span style="font-size: 15px; color: ${C.muted}">Customers can see it at <a href="#" style="color: ${C.ink}; font-weight: 600">${FREE}</a></span></div>${button('Turn off', { variant: 'default' })}</div><div style="padding-top: 14px; border-top: 1px solid ${C.border}">${button('Edit website', { iconName: 'website' })}</div>`)}
${rows(row('Taking payments', 'Connected to [payment provider] · test payment done'), row('Pages', 'Home, About us, Contact us, Collection and returns, Privacy, Cookies'), row('Tracking tools', 'None — so there’s no cookie choice'))}
${card(`<p style="margin: 0; padding: 14px 18px; font-size: 15px; line-height: 1.5">What the website sells and online payments are in Settings, which you can’t change. Ask <strong>Jack Lewis</strong>. Connecting Shopify needs “Can change settings” too.</p>`, 'flex-shrink: 0')}`, STAFF));

// ---------- First visit: three steps, then the editor (decision 11) ----------
const steps = (n, title, sub, body, next, backBtn = true, of = 3) => websitePage(`<div style="max-width: 720px; width: 100%; align-self: center; display: flex; flex-direction: column; gap: 18px; padding-top: 8px">
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 700; letter-spacing: 1px; color: ${C.muted}">SET UP YOUR WEBSITE · STEP ${n} OF ${of}</span><div role="progressbar" aria-label="Step ${n} of ${of}" aria-valuemin="1" aria-valuemax="${of}" aria-valuenow="${n}" style="display: grid; grid-template-columns: repeat(${of}, 1fr); gap: 6px">${Array.from({ length: of }, (_, i) => `<span style="height: 6px; border-radius: 999px; background: ${i < n ? C.ink : C.border}"></span>`).join('')}</div></div>
<div style="display: flex; flex-direction: column; gap: 6px"><h2 style="margin: 0; font-size: 26px; font-weight: 700">${title}</h2><p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${C.muted}">${sub}</p></div>
${body}
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; padding-top: 4px">${backBtn ? button('Back', { variant: 'ghost' }) : `<span style="display: flex; align-items: center; gap: 10px">${button('Not now', { variant: 'ghost' })}<span style="font-size: 13px; color: ${C.muted}">The Website page will say “Not set up yet”</span></span>`}${next}</div></div>`);
const startWhich = (shopify = false) => steps(1, 'Wheelhouse’s website, or your Shopify shop?', 'You can change this later.', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Which website</legend>
${option('Wheelhouse’s website', !shopify, 'Made from your shop’s details, in your colours. Products, stock, booking repairs and click and collect all built in.')}
${option('Connect your Shopify shop', shopify, 'Keep your Shopify look and checkout. Wheelhouse sends Shopify your products, prices and stock, and Shopify orders come into Online orders.')}</fieldset>`, button('Next'), false);
const startLook = () => steps(2, 'Your logo and colour', 'Wheelhouse suggests colours from your logo. You can change anything later under Theme.', `<div style="display: grid; grid-template-columns: ${isP() ? 'minmax(0, 1fr)' : '220px minmax(0, 1fr)'}; gap: 24px; align-items: start">
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Logo</span><div role="img" aria-label="Your logo, uploaded" style="height: 140px; display: flex; align-items: center; justify-content: center; border-radius: 10px; border: 2px dashed ${C.border}; background: ${C.panel}; color: ${C.muted}; font-size: 14px">[Your logo]</div>${linkBtn('Change logo')}<span style="font-size: 13px; color: ${C.muted}; line-height: 1.4">No logo yet? Skip it — your shop’s name is shown instead, and you can add one later.</span></div>
<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 12px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 8px">Main colour — for buttons and links</legend><div style="display: flex; flex-wrap: wrap; gap: ${isP() ? 12 : 24}px; align-items: flex-start"><div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; color: ${C.muted}">From your logo</span><div style="display: flex; gap: 8px">${swatch(OCEAN, true, 'Dark blue')}${swatch('#2F6B4F', false, 'Green')}</div></div><div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; color: ${C.muted}">Wheelhouse’s own</span>${swatch('#2A2822', false, 'Soft sand charcoal')}</div></div>${linkBtn('Choose another colour')}${note('Every colour is checked so text on it stays easy to read.')}</fieldset></div>`, button('Next'));
// UX walk-through 4 M6: the counts under the choice. M7: the question is
// asked once, wherever Jack meets it first. If turning on buying online
// asked it already, step 3 shows the answer with Change.
const startProducts = (answered = false) => (answered
  ? steps(3, 'Your products online', 'You chose this when you turned on buying online. Every category and product has its own “Show on website” switch.', `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0 12px; padding: 6px 16px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 15px"><span>Started with every product online on [date]</span>${linkBtn('Change', 'Change what your website started with')}</div>${countsBox()}${note('Your website stays off until you turn it on.')}`, button('Make my website'))
  : steps(3, 'Start with every product online, or nothing?', 'Either way, every category and product has its own “Show on website” switch afterwards.', `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 10px"><legend style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Start with</legend>
${option('Every product online', true, 'Everything with a price shows. Switch off what you don’t want online.', 'start')}
${option('Nothing online', false, 'Add categories and products as you go.', 'start')}</fieldset>${countsBox()}${note('Your website stays off until you turn it on.')}`, button('Make my website')));

// ---------- The preview (decision 1; audit H1, M5, M12) ----------
// Journey 1's home page, cut into its six sections so the editor can
// reorder, outline and scroll to them. Offsets (in page pixels) were
// measured from the rendered page: hero 0, categories 352, products 622,
// repairs 931, shops 1122, words 1604; 1850 tall, 571 showing.
const PART_IDS = { 'Big photo and headline': 'hero', 'Shop by category': 'cats', 'Featured products': 'prods', 'Book a repair': 'rep', 'Our shops': 'shops', 'Words and a picture': 'words' };
const HOME_SECTIONS = Object.keys(PART_IDS);
const TOPS = { hero: 0, cats: 352, prods: 622, rep: 931, shops: 1122, words: 1604 };
const HEIGHTS = { hero: 330, cats: 248, prods: 287, rep: 169, shops: 460, words: 246 };
const PAGE_H = 1850, VIEW_H = 571;
function splitHome(html) {
  const at = (s, from = 0) => { const i = html.indexOf(s, from); if (i < 0) throw new Error('website.mjs: home page changed — ' + s); return i; };
  const inner = at('<div style="display: flex; flex-direction: column; gap: 22px">', at('<div data-scroll')) + '<div style="display: flex; flex-direction: column; gap: 22px">'.length;
  const sHero = at('<section aria-labelledby="hero-h"'), sCats = at('<section aria-labelledby="h-cats"'), sProds = at('<section aria-labelledby="h-prods"');
  const sRep = at('</section>', sProds) + '</section>'.length;
  const sShops = at('<section aria-labelledby="h-shops"');
  const sWords = at('</section>', sShops) + '</section>'.length;
  const end = html.lastIndexOf('</div></div>', at('</main>'));
  if (inner !== sHero || end < sWords) throw new Error('website.mjs: home page layout changed');
  return { pre: html.slice(0, sHero), post: html.slice(end), parts: { hero: html.slice(sHero, sCats), cats: html.slice(sCats, sProds), prods: html.slice(sProds, sRep), rep: html.slice(sRep, sShops), shops: html.slice(sShops, sWords), words: html.slice(sWords, end) } };
}
const ring = (inner, name, hover = false) => `<div style="position: relative; flex-shrink: 0; margin: 36px 4px 4px; padding: 6px; border-radius: 14px; border: 4px ${hover ? 'dashed' : 'solid'} ${C.ink}">${inner}<span style="position: absolute; top: -36px; left: 12px; padding: 4px 12px; border-radius: 999px; background: ${C.ink}; color: #ffffff; font-size: 18px; font-weight: 700">${name}${hover ? ' — click to change' : ''}</span></div>`;
const recolour = (html, hex) => html.replaceAll(`border: 1px solid ${C.accent}; background: ${C.accent}; color: #ffffff`, `border: 1px solid ${hex}; background: ${hex}; color: #ffffff`);
// The page scrolled to a pixel offset (journey 2's scroll trick).
const scrollPage = (html, px) => (px ? html.replace('<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto;', '<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: hidden;').replace('<div style="display: flex; flex-direction: column; gap: 22px">', `<div style="display: flex; flex-direction: column; gap: 22px; position: relative; top: -${px}px">`) : html);
const homeHtml = ({ order = HOME_SECTIONS, part = '', hover = '', colour = OCEAN } = {}) => {
  const { pre, post, parts } = splitHome(browseScreens['wb-home'].desktop);
  const body = order.map((n) => { const k = PART_IDS[n]; return n === part ? ring(parts[k], n) : n === hover ? ring(parts[k], n, true) : parts[k]; }).join('');
  return recolour(pre + body + post, colour);
};
// Where a section sits once the order has changed.
const topOf = (name, order = HOME_SECTIONS) => order.slice(0, order.indexOf(name)).reduce((y, n) => y + HEIGHTS[PART_IDS[n]] + 22, 0);
const scrollFor = (name, order) => (name ? Math.max(0, Math.min(PAGE_H - VIEW_H, topOf(name, order) - 30)) : 0);
// The preview: scaled, scrollable, nothing inside it usable (decision 1);
// a scrollbar shows where it is (audit H1).
const scaled = (html, w, h, s, label, { px = 0, total = PAGE_H, view = VIEW_H } = {}) => {
  const sw = Math.round(w * s), sh = Math.round(h * s);
  const thumbH = Math.round(sh * view / total), thumbY = Math.round((sh - thumbH) * (px / Math.max(1, total - view)));
  return `<div role="region" aria-label="${esc(label)}" style="position: relative; flex-shrink: 0; width: ${sw + 14}px; height: ${sh}px; display: flex; gap: 4px"><div style="width: ${sw}px; height: ${sh}px; overflow: hidden; border-radius: 8px; border: 1px solid ${C.border}; box-shadow: 0 6px 24px rgba(38,36,32,0.12); background: #ffffff"><div inert style="width: ${w}px; height: ${h}px; transform: scale(${s}); transform-origin: 0 0">${html}</div></div><div aria-hidden="true" style="position: relative; width: 10px; height: ${sh}px; border-radius: 999px; background: ${C.border}"><span style="position: absolute; left: 0; right: 0; top: ${thumbY}px; height: ${thumbH}px; border-radius: 999px; background: ${C.muted}"></span></div></div>`;
};
const desktopPreview = (opts = {}, label = 'Preview of Home. It can’t be used; pick a part from the list or click it') => {
  const px = opts.scroll ?? scrollFor(opts.part || opts.hover, opts.order);
  return scaled(scrollPage(homeHtml(opts), px), W, H, pScale(opts.big), label, { px });
};
// Any other page in the shop's website frame (audit M12): journey 1's
// header and footer, with this page's content in its main area.
const sitePage = (content, colour = OCEAN) => recolour(browseScreens['wb-home'].desktop.replace(/(<main id="main-content"[^>]*>)[\s\S]*(<\/main>)/, `$1${content}$2`), colour);

// ---------- The editor (decisions 1, 2, 3; audit H1–H4, M1–M5, M13, L2, L3, L8) ----------
// On a tablet the size buttons are icons with their names spoken.
const seg = (items) => `<div role="group" aria-label="Preview size" style="display: inline-flex; padding: 2px; border-radius: 10px; background: ${C.mutedBg}">${items.map(([t, on, ic]) => `<button type="button" aria-pressed="${on}"${isT() ? ` aria-label="${t}"` : ''} style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 44px; min-height: 44px; padding: 0 ${isT() ? 0 : 12}px; border: 0; border-radius: 8px; background: ${on ? C.panel : 'transparent'}; box-shadow: ${on ? '0 1px 3px rgba(38,36,32,0.15)' : 'none'}; font-family: inherit; font-size: 14px; font-weight: ${on ? 700 : 500}; color: ${C.ink}">${icon(ic, 16)}${isT() ? '' : t}</button>`).join('')}</div>`;
const SIZE_BTNS = (size) => [['Computer', size === 'Computer', 'till'], ['Tablet', size === 'Tablet', 'card'], ['Phone', size === 'Phone', 'phone']];
const dot = `<span style="width: 8px; height: 8px; border-radius: 999px; background: ${C.warnInk}"></span>`;
const STATES = {
  changes: `<span style="display: inline-flex; flex-direction: column; font-size: 13px; line-height: 1.3"><span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700">${dot}Unpublished changes</span><span style="color: ${C.muted}">Saved just now</span></span>`,
  saving: `<span style="display: inline-flex; flex-direction: column; font-size: 13px; line-height: 1.3"><span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700">${dot}Unpublished changes</span><span role="status" style="color: ${C.warnInk}; font-weight: 600">Couldn’t save — trying again</span></span>`,
  published: `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${C.successInk}; font-weight: 700">${icon('check', 16)}All changes published</span>`,
  first: `<span style="font-size: 13px; color: ${C.muted}">Not published yet</span>`,
  view: `<span style="font-size: 13px; color: ${C.muted}">View only</span>`,
};
const pubBtn = (state) => (state === 'view' ? '' : ['changes', 'first', 'saving'].includes(state) ? button('Publish') : off(button('Publish'), 'All changes are published'));
const histBtn = (state) => (state === 'first' || state === 'view' ? off(button('History', { variant: 'ghost' }), 'Nothing published yet') : button('History', { variant: 'ghost' }));
const chipLink = () => `<a href="#" style="${tall}; padding: 0 10px; border-radius: 999px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap">${icon('alert', 14)}&nbsp;Hard to read colour · Fix</a>`;
const pagePicker = (pageName, menu) => `<button type="button" aria-haspopup="listbox" aria-expanded="${menu}" aria-label="Page you’re editing: ${esc(pageName)}" style="display: inline-flex; align-items: center; gap: 8px; min-width: 0; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}; white-space: nowrap; overflow: hidden"><span style="color: ${C.muted}">Page:</span><strong style="overflow: hidden; text-overflow: ellipsis">${pageName}</strong>${icon('chevron', 14)}</button>`;
// UX walk-through 4 L2: the orders link shows only when orders are waiting —
// never on a website that has never been on.
const topBar = ({ state = 'changes', pageName = 'Home', size = 'Computer', menu = false, chip = false, big = false, orders = true }) => `<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 12px; display: flex; align-items: center; gap: 10px; background: ${C.panel}; border-bottom: 1px solid ${C.border}">
${back('Website')}<span aria-hidden="true" style="width: 1px; height: 28px; background: ${C.border}"></span>
${pagePicker(pageName, menu)}
${seg(SIZE_BTNS(size))}
${button(big ? 'Show the panel' : 'Bigger', { variant: 'ghost' })}
<span style="flex-grow: 1"></span>
${orders ? `<a href="#" style="${tall}; font-size: 13px; font-weight: 600; color: ${C.ink}; white-space: nowrap">${isT() ? '3 orders waiting' : '3 online orders waiting'}</a>` : ''}
${STATES[state]}${chip ? chipLink() : ''}
${histBtn(state)}${pubBtn(state)}
</header>`;
// Audit H2: with the website off, "Turn it on" the first time also
// publishes. Not a spoken status: it never changes (L2).
// UX walk-through 4 H2: during a move the strip says when it goes on, and
// Turn it on waits for switch-over morning.
const offStrip = (first = true, moving = false) => moving ? `<div style="flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: ${isP() ? '8px 12px' : '10px 16px'}; background: ${C.warnBg}; color: ${C.warnInk}; font-size: ${isP() ? 13 : 14}px; line-height: 1.4">${icon('lock', 16)}<span style="flex: 1 1 260px"><strong>Your website is off until switch-over morning.</strong> Only your staff can see it. It goes on from the switch-over checklist. 2 pages still have starting wording: <a href="#" style="color: inherit; font-weight: 700">check them</a>.</span></div>` : `<div style="flex-shrink: 0; display: flex; flex-wrap: ${isP() ? 'wrap' : 'nowrap'}; align-items: center; gap: ${isP() ? 6 : 12}px ${isP() ? 10 : 12}px; padding: ${isP() ? '8px 12px' : '4px 16px'}; background: ${C.warnBg}; color: ${C.warnInk}; font-size: ${isP() ? 13 : 14}px; line-height: 1.4">${icon('lock', 16)}<span style="flex: 1 1 ${isP() ? '260px' : 'auto'}"><strong>Your website is off.</strong> Only your staff can see it.${first ? ' Turning it on also publishes it as it is now.' : ''} 2 pages still have starting wording: <a href="#" style="color: inherit; font-weight: 700">check them</a>.</span>${button('Turn it on', { variant: 'default' })}</div>`;
const TAB_SET = () => (isP() ? [['Sections', 'sections'], ['Theme', 'theme'], ['Preview', 'preview']] : [['Sections', 'sections'], ['Theme', 'theme']]);
const tabs = (on) => `<div role="tablist" aria-label="Edit" style="flex-shrink: 0; display: grid; grid-template-columns: repeat(${TAB_SET().length}, 1fr); border-bottom: 1px solid ${C.border}; background: ${C.panel}">${TAB_SET().map(([t, k]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${k === on}" style="min-height: 48px; border: 0; border-bottom: 3px solid ${k === on ? C.ink : 'transparent'}; background: transparent; font-family: inherit; font-size: 15px; font-weight: ${k === on ? 700 : 500}; color: ${C.ink}">${t}</button>`).join('')}</div>`;
// Audit H2: the caption says whether this is the draft or what customers see.
const CAPTIONS = {
  changes: (p) => `Your draft of ${p} · customers see the last published version`,
  saving: (p) => `Your draft of ${p} · customers see the last published version`,
  published: (p) => `${p} · as customers see it`,
  first: (p) => `Your ready-made ${p} · not published yet`,
  view: (p) => `${p} · Jack Lewis’s draft, view only`,
};
const sizeWords = (size) => (size === 'Computer' ? ' on a computer' : size === 'Phone' ? ' on a phone' : ' on a tablet');
// On a phone (decision 1): edit, then preview. Sections, Theme and Preview
// are tabs; Publish stays at the top; the save state sits under it.
const phoneEditor = ({ panel, tab, state, siteOff, pageName, extra, chip, phonePreview, caption, moving }) => {
  const [PWd, PHt] = DIMS.phone;
  const body = tab === 'preview'
    ? `<div role="tabpanel" id="panel-preview" aria-labelledby="tab-preview" style="flex-grow: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 12px; background: ${C.mutedBg}; overflow: hidden">${seg(SIZE_BTNS('Phone'))}<span style="align-self: flex-start; font-size: 13px; color: ${C.muted}">${caption || CAPTIONS[state](pageName)} on a phone</span>${phonePreview || scaled(recolour(browseScreens['wb-home'].phone, OCEAN), 390, 844, 0.7, 'Preview of Home on a phone. It can’t be used', { px: 0, total: 2600, view: 844 })}</div>`
    : `<div role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}" data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px; background: ${C.panel}">${panel}</div>`;
  return `<div style="position: relative; width: ${PWd}px; height: ${PHt}px; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">
<header style="flex-shrink: 0; display: flex; flex-direction: column; background: ${C.panel}; border-bottom: 1px solid ${C.border}"><div style="height: 56px; box-sizing: border-box; padding: 0 8px; display: flex; align-items: center; gap: 6px"><a href="#" aria-label="Back to Website" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; color: ${C.ink}">${icon('back', 20)}</a>${pagePicker(pageName, false).replace('display: inline-flex; align-items: center; gap: 8px; min-width: 0;', 'display: inline-flex; align-items: center; gap: 8px; min-width: 0; flex-grow: 1;')}${pubBtn(state)}</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 0 8px 0 14px; min-height: 44px; border-top: 1px solid ${C.border}">${STATES[state]}<span style="flex-grow: 1"></span>${chip ? chipLink().replace('Hard to read colour · Fix', 'Colour · Fix') : ''}${histBtn(state)}</div></header>
${siteOff ? offStrip(state === 'first', moving) : ''}
<main style="flex-grow: 1; min-height: 0; display: flex; flex-direction: column">${sr(`<h1>Editing ${esc(pageName)} · website for North Street Cycles</h1>`)}${tabs(tab)}${body}</main>${extra}</div>`;
};
const editor = (o) => {
  const { panel, tab = 'sections', preview, state = 'changes', siteOff = false, pageName = 'Home', size = 'Computer', extra = '', caption = '', menu = false, chip = false, big = false, banner = '', phoneTab = '', phonePreview = '', moving = false, orders = !siteOff } = o;
  if (isP()) return phoneEditor({ panel, tab: phoneTab || tab, state, siteOff, pageName, extra, chip, phonePreview, caption, moving });
  const [EW, EH] = DIMS[SIZE];
  return `<div style="position: relative; width: ${EW}px; height: ${EH}px; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">
<a href="#ws-panel" style="position: absolute; left: -9999px">Skip to the sections list</a>
${topBar({ state, pageName, size, menu, chip, big, orders })}${siteOff ? offStrip(state === 'first', moving) : ''}${banner}
<main style="flex-grow: 1; min-height: 0; display: flex">${sr(`<h1>Editing ${esc(pageName)} · website for North Street Cycles</h1>`)}
${big ? '' : `<aside id="ws-panel" aria-label="Edit ${esc(pageName)}" style="width: ${panelW()}px; flex-shrink: 0; display: flex; flex-direction: column; background: ${C.panel}; border-right: 1px solid ${C.border}">${tabs(tab)}<div role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}" data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px">${panel}</div></aside>`}
<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 20px; background: ${C.mutedBg}; overflow: hidden"><span style="align-self: flex-start; font-size: 13px; color: ${C.muted}">${caption || CAPTIONS[state](pageName)}${sizeWords(size)}</span>${preview}</div>
</main>${menu ? pageMenu() : ''}${extra}</div>`;
};

// The sections list (audit M2, M13): the header and footer stay put; the
// rest move by dragging the 44px handle, by the arrows, or by Alt + arrow
// keys on a section's name. The ends' arrows are greyed with the reason.
const grip = `<span aria-hidden="true" style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; cursor: grab; color: ${C.muted}"><svg width="14" height="20" viewBox="0 0 14 20"><g fill="currentColor"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></g></svg></span>`;
const arrow = (dir, name, endWhy = '') => `<button type="button" aria-label="Move ${esc(name)} ${dir}"${endWhy ? ` aria-disabled="true" title="${esc(endWhy)}"` : ''} style="width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 6px; background: transparent; color: ${C.ink}; ${endWhy ? 'opacity: 0.35; ' : ''}"><span style="display: inline-flex; transform: rotate(${dir === 'up' ? 180 : 0}deg)">${icon('chevron', 15)}</span></button>`;
const secRow = (name, { on = false, fixed = false, lifted = false, first = false, last = false } = {}) => `<li style="display: flex; align-items: center; gap: 0; min-height: 52px; padding: 0 2px 0 0; border-radius: 8px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${on ? C.mutedBg : C.panel}; ${lifted ? 'box-shadow: 0 10px 28px rgba(38,36,32,0.25); transform: translate(10px, -6px) rotate(-1deg); ' : ''}list-style: none">
${fixed ? '<span style="width: 14px; flex-shrink: 0"></span>' : grip}<button type="button" aria-current="${on}"${fixed ? '' : ' aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"'} style="flex-grow: 1; min-width: 0; min-height: 44px; padding: 0 4px; border: 0; background: transparent; font-family: inherit; text-align: left; font-size: 15px; font-weight: ${on ? 700 : 600}; color: ${C.ink}">${name}</button>${fixed ? `<span style="padding-right: 10px; font-size: 13px; color: ${C.muted}">Always ${name === 'Header' ? 'at the top' : 'at the bottom'}</span>` : `${arrow('up', name, first ? 'Already first' : '')}${arrow('down', name, last ? 'Already last' : '')}`}</li>`;
const sectionList = ({ on = '', order = HOME_SECTIONS, lifted = '', gapAt = -1, label = 'Home' } = {}) => `<div style="display: flex; flex-direction: column; gap: 4px">${h2('Sections on this page')}${note('Click one — here or on the page — to change it. Drag the dots, use the arrows, or press Alt + ↑ or ↓ on a name.')}</div>
<ol aria-label="Sections on ${label}" style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px">${secRow('Header', { fixed: true, on: on === 'Header' })}${order.map((n, i) => (i === gapAt ? `<li aria-hidden="true" style="list-style: none; height: 48px; border-radius: 8px; border: 2px dashed ${C.input}"></li>` : '') + secRow(n, { on: n === on, lifted: n === lifted, first: i === 0, last: i === order.length - 1 })).join('')}${secRow('Footer', { fixed: true })}</ol>
${button('+ Add section', { variant: 'default', block: true })}`;
const panelHead = (t, sub = '') => `${back('All sections')}<div style="display: flex; flex-direction: column; gap: 4px">${h2(t)}${sub ? note(sub) : ''}</div>`;
const saved = () => note('Saved as you go. Customers see it when you publish.');
const sectionEnd = () => `<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid ${C.border}">${rowSwitch('Show this section', true)}<div>${button('Remove this section', { variant: 'danger' })}</div>${note('You can undo removing it.')}</div>`;
const select = (label, value, sub = '') => `<div style="display: flex; flex-direction: column; gap: 6px"><label style="font-size: 14px; font-weight: 600">${label}</label><button type="button" aria-haspopup="listbox" style="display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${value}${icon('chevron', 14)}</button>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</div>`;
// Audit M6: the photo's description is a visible box, or "only decoration".
const describe = (decor = false) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="f-alt" style="font-size: 14px; font-weight: 600">Describe the photo for people who can’t see it</label><textarea id="f-alt" rows="2" aria-describedby="f-alt-hint" placeholder="For example: the shop front on North Street, with bikes outside" style="box-sizing: border-box; width: 100%; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}; resize: vertical"></textarea><span id="f-alt-hint" style="font-size: 13px; color: ${C.muted}">Read out by screen readers, for blind and partially sighted customers.</span><label style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox"${decor ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="font-size: 14px">This photo is only decoration</span></label></div>`;
const heroPanel = () => `${panelHead('Big photo and headline')}
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">Photo</span><div role="img" aria-label="The big photo" style="height: 110px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 2px dashed ${C.border}; background: ${C.bg}; color: ${C.muted}; font-size: 14px">[Big photo of the shop]</div>${linkBtn('Change photo')}</div>
${describe()}
${field('Headline', { value: '[Headline]' })}${field('Line under it', { value: '[A line about the shop]' })}
${select('First button', 'Book a repair', 'Any page, category or Book a repair')}${select('Second button', 'Shop')}
${saved()}${sectionEnd()}`;
const KINDS = [
  ['Big photo and headline', 'A wide photo with your words and up to two buttons'],
  ['Shop by category', 'Categories you choose, with photos'],
  // UX walk-through 4 M6: Featured products picks only products with a photo.
  ['Featured products', 'Up to 8 products with a photo — you pick, or your newest'],
  ['Book a repair', 'Your words, your main services and prices'],
  ['Our shops', 'Each shop’s address, hours and phone'],
  ['Words and a picture', 'Anything — the team, a club ride, a sale'],
  ['Text', 'Headings and paragraphs'],
  ['Photos', 'A row or grid of photos'],
  ['Opening hours', 'From Settings, kept up to date'],
  ['Contact details', 'Phone, email and address, from Settings'],
];
// Audit L4: it goes below the chosen section and its settings open at once.
const addPanel = () => `${back('All sections')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Add a section')}${note('It goes below Featured products, the section you chose, and its settings open straight away. You can move it after.')}</div>
<ul style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px">${KINDS.map(([t, s]) => `<li style="list-style: none"><button type="button" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; min-height: 56px; padding: 8px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="font-size: 15px; font-weight: 700">${t}</span><span style="font-size: 13px; color: ${C.muted}">${s}</span></button></li>`).join('')}</ul>`;
// App map 10: each shop chooses which header link stands out as a button;
// the default highlights none. Audit L4: the options follow the shop.
const headerPanel = () => `${panelHead('Header', 'At the top of every page.')}
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">Logo</span><div style="display: flex; align-items: center; gap: 12px"><div role="img" aria-label="Your logo" style="width: 64px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 2px dashed ${C.border}; color: ${C.muted}; font-size: 12px">[Logo]</div>${linkBtn('Change logo')}</div></div>
${radios('Make one link stand out as a button', [['None', true], ['Shop', false], ['Book a repair', false], ['Our shops', false, '(“Find us” with one shop)'], ['Bike fitting', false, '(a page you added)']], 'hdr')}
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: 600">Links in the header</span><span style="font-size: 14px; color: ${C.muted}">Shop, Book a repair, Our shops, and pages you put in the header — up to [n]. Change them in each page’s settings.</span></div>${saved()}`;
// Audit M5: the Page menu holds the shop's own pages and Wheelhouse's.
const menuItems = () => `<span style="padding: 6px 10px 2px; font-size: 12px; font-weight: 700; letter-spacing: 1px; color: ${C.muted}">YOUR PAGES</span>
${['Home', 'About us', 'Contact us', 'Collection and returns', 'Privacy', 'Cookies'].map((p, i) => `<div role="option" aria-selected="${i === 0}" style="display: flex; align-items: center; min-height: 44px; padding: 0 10px; border-radius: 8px; background: ${i === 0 ? C.mutedBg : 'transparent'}; font-size: 15px; font-weight: ${i === 0 ? 700 : 500}">${p}</div>`).join('')}
<span style="padding: 10px 10px 2px; font-size: 12px; font-weight: 700; letter-spacing: 1px; color: ${C.muted}; border-top: 1px solid ${C.border}">SHOP PAGES · PREVIEW ONLY</span>
<span style="padding: 0 10px 4px; font-size: 13px; color: ${C.muted}; line-height: 1.4">Wheelhouse makes these from your products. Colours, fonts and buttons come from Theme.</span>
${['A category', 'A product', 'Basket', 'Checkout', 'Signing in', 'Cookie choice'].map((p) => `<div role="option" aria-selected="false" style="display: flex; align-items: center; min-height: 44px; padding: 0 10px; border-radius: 8px; font-size: 15px">${p}</div>`).join('')}`;
const pageMenu = () => `<div role="listbox" aria-label="Page to edit or preview" style="position: absolute; left: 140px; top: 58px; z-index: 5; width: 340px; box-sizing: border-box; padding: 8px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; box-shadow: 0 12px 32px rgba(28,30,25,0.28); display: flex; flex-direction: column; gap: 2px">${menuItems()}</div>`;
// On a phone the Page menu fills the screen.
const pageMenuPhone = () => popup('pm-title', 'Choose a page', 'To edit, or to preview in your theme', `<div role="listbox" aria-labelledby="pm-title" style="display: flex; flex-direction: column; gap: 2px">${menuItems()}</div>`, button('Close', { variant: 'ghost' }), 400);

// ---------- Theme (decision 3; audit H4) ----------
const colourField = (label, hex, sub, after = '', bad = false) => `<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">${label}</span><div style="display: flex; align-items: center; gap: 10px"><button type="button" aria-label="Pick ${esc(label.toLowerCase())}" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 8px; border: 1px solid ${C.input}; background: ${hex}"></button><input aria-label="${esc(label)} code"${bad ? ' aria-invalid="true" aria-describedby="contrast-msg"' : ''} value="${hex}" style="flex-grow: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 1px solid ${bad ? C.danger : C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 14px; color: ${C.ink}"></div>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}${after}</div>`;
const pair = (label, a, b, on) => `<div role="group" aria-label="${label}" style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">${label}</span><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">${[[a, on === a], [b, on === b]].map(([t, x]) => `<button type="button" aria-pressed="${x}" style="min-height: 44px; border-radius: 8px; border: ${x ? 2 : 1}px solid ${x ? C.ink : C.border}; background: ${C.panel}; font-family: inherit; font-size: 14px; font-weight: ${x ? 700 : 500}; color: ${C.ink}">${t}</button>`).join('')}</div></div>`;
const fontRow = (name, sub, on) => `<label style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 12px; border-radius: 8px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; cursor: pointer"><input type="radio" name="font"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span></label>`;
// The guard checks all three pairs; the spoken message is given when the
// owner leaves the box or picks a colour, not on every letter typed.
const check = (t, ok) => `<li style="list-style: none; display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${C.ink}">${ok ? `<span style="color: ${C.successInk}; display: inline-flex">${icon('check', 16)}</span>` : `<span style="color: ${C.warnInk}; display: inline-flex">${icon('alert', 16)}</span>`}<span>${t} · <strong>${ok ? 'easy to read' : 'hard to read'}</strong></span></li>`;
const contrastBox = () => `<div id="contrast-msg" role="status" style="display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 14px; line-height: 1.45"><strong style="display: flex; gap: 8px">${icon('alert', 16)}This colour is hard to read in 2 places</strong><ul style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px">${check('White words on buttons', false)}${check('Links on the page', false)}${check('Words on your background', true)}</ul><span style="color: ${C.ink}">Choose a fix:</span><div style="display: flex; flex-direction: column; gap: 8px"><button type="button" style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 12px; border-radius: 8px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-align: left"><span aria-hidden="true" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 6px; background: #E8C547; color: #2A2822; display: inline-flex; align-items: center; justify-content: center; font-weight: 700">Aa</span>Keep your yellow, use dark words on it</button><button type="button" style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 12px; border-radius: 8px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-align: left"><span aria-hidden="true" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 6px; background: #946F0F"></span>Darken to ${mono('#946F0F')}, the nearest that works</button></div><span style="color: ${C.ink}">Or keep it — Publish will ask once.</span></div>`;
const themePanel = ({ colour = OCEAN, warn = false, fonts = false } = {}) => (fonts
  ? `${back('Theme')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Fonts')}${note('Each pair is tested to read well on screens. Shown in its own font.')}</div>
<div role="radiogroup" aria-label="Fonts" style="display: flex; flex-direction: column; gap: 6px">${fontRow('Public Sans', 'Headings and text · Wheelhouse’s own', true)}${['[Font pair]', '[Font pair]', '[Font pair]', '[Font pair]', '[Font pair]'].map((f) => fontRow(f, '[Heading font] with [text font]', false)).join('')}</div>${note('About a dozen pairs. More can be added to the list later.')}`
  : `<div style="display: flex; flex-direction: column; gap: 4px">${h2('Your colours, fonts and style')}${note('Used on every page, and on the pages Wheelhouse makes: products, basket, checkout.')}</div>
${colourField('Main colour', colour, warn ? '' : 'Buttons and links', warn ? contrastBox() : '', warn)}
${colourField('Background', '#F4EEE1', 'Soft sand, Wheelhouse’s own')}
${select('Fonts', 'Public Sans · headings and text')}
${pair('Corners', 'Rounded', 'Square', 'Rounded')}${pair('Buttons', 'Filled', 'Outlined', 'Filled')}
${saved()}${linkBtn('Go back to Soft sand')}`);
const publishAsk = () => popup('pa-title', 'Publish with a hard-to-read colour?', 'Your main colour, #E8C547', `<p style="margin: 0; font-size: 15px; line-height: 1.5">White words on your buttons, and links on the page, will be hard for many customers to read.</p>`, `${button('Publish anyway', { variant: 'ghost' })}${button('Fix it')}`, 500);

// ---------- Publishing and keeping work (decision 2; audit H2, H3, M3, L3, L6) ----------
const discard = () => popup('dc-title', 'Discard your 4 unpublished changes?', 'Changes saved since you last published, on [date]', `<ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 15px">${CHANGES.map(([w, what]) => `<li><strong>${w}</strong> — ${what}</li>`).join('')}</ul><p style="margin: 0; font-size: 15px; line-height: 1.5">Your website goes back to the last published version. The changes are kept in History for [n] days, in case you want them back.</p>`, `${button('Keep editing', { variant: 'ghost' })}${button('Discard changes', { variant: 'danger' })}`, 540);
const version = (when, who, what, { now = false, draft = false } = {}) => `<li style="display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 8px 0; border-top: 1px solid ${C.border}; list-style: none"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 700">${draft ? `Unpublished draft · ${when}` : when}</span><span style="font-size: 13px; color: ${C.muted}">${draft ? `Discarded by ${who}` : `Published by ${who}`} · ${what}</span></span>${now ? badge('What customers see now', 'green') : `${button('View', { variant: 'ghost' })}${button('Go back to this', { variant: 'default' })}`}</li>`;
const history = () => popup('hi-title', 'Earlier versions', 'Published versions, and drafts you discarded in the last [n] days', `${msg('You have 4 unpublished changes. Going back replaces them — they’re kept here, so you can come back to them.', 'grey')}<ul style="margin: 0; padding: 0">${version('[date], [time]', 'Jack Lewis', 'Home page, Theme colour', { now: true })}${version('[date], [time]', 'Jack Lewis', 'Book a repair text', { draft: true })}${version('[date], [time]', 'Jack Lewis', 'Opening hours section added')}${version('[date], [time]', 'Jack Lewis', 'First published')}</ul>${note('Going back puts that version in the editor as unpublished changes. Check it, then press Publish.')}`, button('Close', { variant: 'ghost' }), 640);
const takeover = () => popup('to-title', 'Jack Lewis is editing Home', 'One person edits at a time, so nobody’s work is overwritten', `<p style="margin: 0; font-size: 15px; line-height: 1.5">You can look at their draft while they work, or take over. If you take over, they’re told, and everything they’ve done so far is kept.</p>`, `${button('View only', { variant: 'ghost' })}${button('Take over')}`, 520);

// ---------- Pages (decision 4; audit M8, M12, L1) ----------
const PAGES = [
  ['Home', 'The first page', '—', ''],
  ['About us', 'Footer', '[date]', ''],
  ['Contact us', 'Footer', '[date]', ''],
  ['Collection and returns', 'Footer · always', 'Not changed yet', 'check'],
  ['Privacy', 'Footer · always', 'Not changed yet', 'check'],
  ['Cookies', 'Footer · always', 'Not changed yet', ''],
];
const pagesList = () => websitePage(`${back('Website')}
<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 16px"><div style="display: flex; flex-direction: column; gap: 4px">${h2('Pages', 'pg-h')}${note('Each page is made of sections, like the home page. Your address, phone and opening hours come from Settings.')}</div>${button('+ Add page')}</div>
${isP() ? card(PAGES.map(([n, where, when, flag]) => `<div style="display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><strong style="font-size: 16px">${n}</strong>${flag ? badge('Starting wording · check it', 'amber') : ''}</span><span style="font-size: 14px; color: ${C.muted}">${where} · ${when === '—' ? 'the home page' : `last changed: ${when}`}</span><span style="display: flex; gap: 18px">${link('Edit', `Edit ${n}`)}${link('Page settings', `Page settings for ${n}`)}</span></div>`).join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden; flex-shrink: 0') : card(`<table aria-labelledby="pg-h" style="width: 100%; border-collapse: collapse; font-size: 15px"><thead><tr style="text-align: left; color: ${C.muted}; font-size: 13px"><th style="padding: 12px 18px; font-weight: 600">Page</th><th style="padding: 12px; font-weight: 600">Linked from</th><th style="padding: 12px; font-weight: 600">Last changed</th><th style="padding: 12px 18px">${sr('Actions')}</th></tr></thead><tbody>${PAGES.map(([n, where, when, flag]) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 8px 18px"><span style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px"><strong>${n}</strong>${flag ? badge('Starting wording · check it', 'amber') : ''}</span></td><td style="padding: 8px 12px">${where}</td><td style="padding: 8px 12px; color: ${C.muted}">${when}</td><td style="padding: 4px 18px; text-align: right; white-space: nowrap">${link('Edit', `Edit ${n}`)}&nbsp;&nbsp;&nbsp;${link('Page settings', `Page settings for ${n}`)}</td></tr>`).join('')}</tbody></table>`, 'overflow: hidden; flex-shrink: 0')}
${note('Collection and returns and Privacy start with wording for you to check — ideally with a solicitor. Each shop is responsible for its own policies. They, and Cookies while you use a tracking tool, always stay in the footer.')}`);
const newPage = () => popup('np-title', 'Add a page', 'It starts with a heading and a block of text', `${field('Page name', { value: 'Bike fitting', hint: 'Also its web address: ' + FREE + '/bike-fitting' })}${radios('Where it’s linked from', [['The footer', true], ['The header', false, '(up to [n] pages)'], ['Nowhere — only by its address', false]], 'where')}`, `${button('Cancel', { variant: 'ghost' })}${button('Add page')}`, 520);
const pageSettings = () => popup('ps-title', 'Page settings', 'Collection and returns', `${field('Page name', { value: 'Collection and returns', hint: 'Also its web address: ' + FREE + '/collection-and-returns' })}<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600">Where it’s linked from</span><p style="margin: 0; display: flex; gap: 8px; font-size: 15px; line-height: 1.45">${icon('lock', 16)}<span>Always the footer — customers need to find how collection and returns work. You can add it to the header too.</span></p><label style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer"><input type="checkbox" style="width: 20px; height: 20px; margin: 0; accent-color: ${C.ink}"><span style="font-size: 15px">Also in the header</span></label></div>${note('Pages you add can also be deleted here.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 520);
const returnsSite = (outline = true) => {
  const sec = (id, title, text) => `<section aria-labelledby="${id}" style="display: flex; flex-direction: column; gap: 8px"><h2 id="${id}" style="margin: 0; font-size: 20px; font-weight: 700">${title}</h2><p style="margin: 0; font-size: 15px; line-height: 1.6">${text}</p></section>`;
  const collect = sec('pg-collect', 'Collecting your order', '[Starting wording: how click and collect works, how long orders are kept, what to bring]');
  return sitePage(`<div style="display: flex; flex-direction: column; gap: 18px; max-width: 760px"><h1 id="pg-h1" style="margin: 0; font-size: 30px; font-weight: 700">Collection and returns</h1>
${outline ? ring(collect, 'Text · Collecting your order') : collect}
${sec('pg-returns', 'Returns', '[Starting wording: returning something bought online or in the shop, and refunds]')}
<section aria-labelledby="pg-contact" style="display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}"><h2 id="pg-contact" style="margin: 0; font-size: 18px; font-weight: 700">Questions?</h2><span style="font-size: 15px">North Street Cycles, Bolton · [shop phone] · [shop email]</span></section></div>`);
};
const returnsPanel = () => `${msg('<strong>Starting wording — check it before you publish.</strong> Ideally with a solicitor. You’re responsible for your own policies.', 'warn')}
${h2('Sections on this page')}
<ol aria-label="Sections on Collection and returns" style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px">${secRow('Header', { fixed: true })}${['Page heading', 'Text · Collecting your order', 'Text · Returns', 'Contact details'].map((n, i, a) => secRow(n, { on: i === 1, first: i === 0, last: i === a.length - 1 })).join('')}${secRow('Footer', { fixed: true })}</ol>${button('+ Add section', { variant: 'default', block: true })}`;

// ---------- Tracking tools (decision 6; audit M7, L7) ----------
const TOOLS = [['Google Analytics', 'Statistics', 'From your Google Analytics account. It starts with G-'], ['Microsoft Clarity', 'Statistics', '[Where to find it in Clarity]'], ['Meta (Facebook) Pixel', 'Marketing', '[Where to find it in Meta]'], ['TikTok Pixel', 'Marketing', '[Where to find it in TikTok]']];
const toolRow = ([name, kind, hint], { on = false, id = '', error = '' } = {}) => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 18px; border-top: 1px solid ${C.border}"><div style="display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1"><span style="font-size: 16px; font-weight: 700">${name}</span><span>${badge(kind, kind === 'Marketing' ? 'purple' : 'blue')}</span></span><span style="width: ${isP() ? 110 : 180}px; flex-shrink: 0">${rowSwitch(sr(esc(name)), on)}</span></div>${on ? `<div style="max-width: 440px">${field(`Your ${name} ID`, { value: id, placeholder: '[ID from the tool]', hint: error ? '' : hint, error, linked: true })}</div>${error ? note('Waiting for a correct ID — until then, no cookie choice and nothing loads.') : ''}` : ''}</div>`;
const tracking = ({ on = false, error = false } = {}) => {
  const top = !on ? msg('With no tools on, your website only uses the cookies it needs to work — so customers get no cookie choice.', 'grey')
    : error ? msg('Google Analytics needs a correct ID before it can be used.', 'warn')
      : `${msg('<strong>When you publish, your website will ask customers about cookies.</strong> Google Analytics only loads for customers who say yes to “Statistics”. Every page’s footer gains “Cookie choices”.', 'ok')}${msg('Check your <a href="#" style="color: inherit; font-weight: 700">Cookies</a> and <a href="#" style="color: inherit; font-weight: 700">Privacy</a> pages — they should name Google Analytics.', 'warn')}`;
  const html = websitePage(`${back('Website')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Tracking tools', 'tt-h')}${note('Tools that show how people use your website, or help with adverts. Like everything else, they go live when you publish.')}</div>
${top}
${card(TOOLS.map((t, i) => toolRow(t, i === 0 && on ? { on: true, id: error ? 'UA-[number]' : 'G-[ID]', error: error ? 'That doesn’t look like a Google Analytics ID. It starts with G- and is in your Google Analytics settings.' : '' } : {})).join('').replace('border-top: 1px solid', 'border-top: 0 solid'), 'overflow: hidden; flex-shrink: 0')}
${note('Each tool is marked Statistics or Marketing, so the cookie choice asks customers the right question. No tool loads until a customer agrees. Switching a tool off keeps its ID.')}`);
  return on && !error ? withToast(html, toast('Google Analytics on · goes live when you publish')) : html;
};

// ---------- Web address (decision 7; audit M9) — waiting on the business plan ----------
const RECORDS = [['[Record type]', '[Name]', '[Value]'], ['[Record type]', '[Name]', '[Value]']];
const copyBtn = (label, done = false) => `<button type="button" aria-label="${esc(label)}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 13px; font-weight: 600; color: ${C.ink}">${done ? `${icon('check', 14)}Copied` : 'Copy'}</button>`;
const address = (stage = 'start', moving = false) => {
  const free = box(`${h3(stage === 'done' ? 'Your address' : 'Your free address')}<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px"><a href="#" style="font-size: 17px; font-weight: 700; color: ${C.ink}">${stage === 'done' ? OWN : FREE}</a>${copyBtn('Copy your address')}</div>${stage === 'done' ? note(`${FREE} still works, and sends people to ${OWN}.`) : ''}`);
  // UX walk-through 4 H2: while moving from Citrus Lime, the address is
  // pointed here on switch-over morning, after the website goes on.
  const warning = moving
    ? msg(`<strong>You’re moving from Citrus Lime.</strong> Once connected, ${OWN} shows your Wheelhouse website, and your Citrus Lime website stops showing on it. So add these records during switch-over morning, after you turn your website on — it can take up to a day. Leave any email records as they are.`, 'warn')
    : msg(`Once connected, ${OWN} shows your Wheelhouse website, and your old website stops showing on it. Turn your website on first. Leave any email records as they are.`, 'grey');
  const own = {
    start: box(`${h3('Use your own address')}${note('If you already have one — for example from your old website — customers can keep using it.')}<div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0 12px; max-width: 560px"><div style="flex: 1 1 220px">${field('Your address', { placeholder: OWN, linked: true })}</div><div style="padding-top: 26px">${button('Next')}</div></div>`),
    typo: box(`${h3('Use your own address')}${note('If you already have one — for example from your old website — customers can keep using it.')}<div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0 12px; max-width: 560px"><div style="flex: 1 1 220px">${field('Your address', { value: 'your-shop', error: 'Check the address — it needs an ending, like .co.uk or .com', linked: true })}</div><div style="padding-top: 26px">${button('Next')}</div></div>`),
    steps: box(`${h3(`Connect ${OWN}`)}${warning}<p style="margin: 0; font-size: 15px; line-height: 1.5">Sign in where you bought your address and find its <strong>DNS settings</strong> — the part of your address account that says where the address points. Add these 2 lines, called records.</p>
${isP() ? RECORDS.map(([t, n, v], i) => `<div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid ${C.border}; font-size: 14px"><strong>Record ${i + 1}</strong><span>Type: ${mono(t)}</span><span>Name: ${mono(n)}</span><span>Value: ${mono(v)}</span><div>${copyBtn(`Copy record ${i + 1} value`, i === 0)}</div></div>`).join('') : `<table style="width: 100%; border-collapse: collapse; font-size: 14px"><thead><tr style="text-align: left; color: ${C.muted}; font-size: 13px"><th style="padding: 8px 0; font-weight: 600">Type</th><th style="padding: 8px; font-weight: 600">Name</th><th style="padding: 8px; font-weight: 600">Value</th><th>${sr('Copy')}</th></tr></thead><tbody>${RECORDS.map(([t, n, v], i) => `<tr style="border-top: 1px solid ${C.border}"><td style="padding: 8px 0">${mono(t)}</td><td style="padding: 8px">${mono(n)}</td><td style="padding: 8px">${mono(v)}</td><td style="text-align: right">${copyBtn(`Copy record ${i + 1} value`, i === 0)}</td></tr>`).join('')}</tbody></table>`}
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; font-size: 14px"><span style="color: ${C.muted}">Step-by-step for:</span>${['[Registrar]', '[Registrar]', '[Registrar]', 'Somewhere else'].map((r) => link(r)).join('')}</div>
<div style="display: flex; gap: 12px">${button('Check connection')}${button('Cancel', { variant: 'ghost' })}</div>`),
    waiting: box(`${h3(`Connect ${OWN}`)}${msg('<strong>Not connected yet</strong> — this can take up to a day after you add the records. We’ll keep checking and email you when it works.', 'grey', true)}<div style="display: flex; flex-wrap: wrap; gap: 12px">${button('Check again', { variant: 'default' })}${button('See the 2 records', { variant: 'ghost' })}</div>${note('Last checked [time]. If it still isn’t working after a day, check the records match exactly.')}`),
    done: box(`${h3('Your own address')}${msg(`<strong>Connected.</strong> ${OWN} shows your website, with the padlock that keeps it secure.`, 'ok', true)}<div>${button('Stop using this address…', { variant: 'ghost' })}</div>${note(`Asks first: your website goes back to ${FREE}, and ${OWN} stops showing it.`)}`),
  }[stage];
  return websitePage(`${back('Website')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Web address')}${note('Where customers find your website.')}</div>${free}${own}`);
};

// ---------- Online payments setup (decision 8; audit H5, M10, M11) ----------
const master = (on = true, why = '') => card(`<div style="padding: 4px 18px">${on ? rowSwitch('Buying online', true) : `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px"><span style="font-size: 15px; font-weight: 700">Buying online</span><span style="font-size: 14px; font-weight: 600; color: ${C.muted}">Off until you connect [payment provider]</span></div>`}<p style="margin: 0 0 12px; font-size: 14px; color: ${C.muted}">${on ? 'Customers can buy from your website and collect from the shop.' : why || 'Customers can look at products, but the website says “Not taking online orders right now”.'}</p></div>`, 'flex-shrink: 0');
const wallets = (on) => `${rowSwitch('Apple Pay and Google Pay', on)}${rowSwitch('Gift cards', on)}${rowSwitch('Store credit (for signed-in customers)', on)}`;
const PAY = {
  none: [false, `${msg('<strong>Not connected.</strong> Customers can’t buy online, and “Pay now” for repairs is hidden, until you connect [payment provider].', 'warn')}
${slot(button('Connect [payment provider]'))}
${note('Opens [payment provider]’s own page to sign up or sign in, then brings you back here. Your shop has its own account with them: card details, payouts and fees ([fees]) are between you and [payment provider].')}`],
  connected: [true, `${msg('Connected to [payment provider] by Jack Lewis just now', 'ok', true)}
<div style="display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 10px; border: 1px solid ${C.warnInk}; background: ${C.warnBg}">${h3('Make a test payment before customers use it')}<p style="margin: 0; font-size: 15px; line-height: 1.5">Pay £1.00 with your own card to check everything works. It’s refunded; [what the provider charges on a refund].</p>${slot(button('Make a test payment', { variant: 'default' }))}</div>
${wallets(true)}`],
  tested: [true, `${msg('Connected to [payment provider] by Jack Lewis on [date]')}
${msg('<strong>Test payment worked.</strong> £1.00 taken and refunded. Payouts go to the account ending [last 4 digits], [payout timing].', 'ok', true)}
${wallets(true)}`],
  failed: [false, `${msg('<strong>Not connected.</strong> [payment provider] didn’t finish connecting, so nothing has changed. Try again — if it keeps happening, [payment provider]’s support can see why.', 'bad', true)}
${slot(button('Try again'))}`],
  more: [true, `${msg('<strong>[payment provider] needs more details from you by [date]</strong>, or online payments will stop. It’s usually [what they need]. This also shows on Today and the Website page.', 'warn')}
${slot(button('Add the details at [payment provider]', { variant: 'default' }))}
${msg('Connected to [payment provider] by Jack Lewis on [date]', 'grey')}
${wallets(true)}`],
  shopify: [true, `${msg('<strong>Shopify takes the payment</strong> for orders on your Shopify shop. Wheelhouse’s payments are only for “Pay now” on repairs.', 'grey')}
${msg('Connected to [payment provider] by Jack Lewis on [date] · for “Pay now” on repairs', 'ok')}
${rowSwitch('Gift cards and store credit on repairs', true)}`],
};
// UX walk-through 4 H2: during a move, a working test payment counts towards
// "The website is ready"; customers can buy once the website goes on.
const PAY_MOVING = msg('<strong>You’re moving from Citrus Lime.</strong> Customers can buy once your website goes on, during switch-over morning. This counts towards “The website is ready” on the switch-over checklist.', 'grey');
const paySettings = (k, moving = false) => {
  const [on, body0] = PAY[k];
  const at = body0.lastIndexOf('</p>') + 4;
  const body = moving ? `${body0.slice(0, at)}\n${PAY_MOVING}${body0.slice(at)}` : body0;
  const summary = k === 'none' || k === 'failed' ? 'Not connected' : k === 'shopify' ? 'Shopify for website orders · [Payment provider] for repairs' : '[Payment provider] · gift cards and store credit';
  return withOnlineArea(() => settingsPage('online', 'Online orders', ONLINE_INTRO, onlineFolds({ pay: body }), { who: OWNER }))
    .replace(/(<section aria-labelledby="set-online"[^>]*><div[^>]*>[\s\S]*?<\/div>)/, `$1${master(on)}`)
    .replace(/(>Paying online<\/span><span style="font-size: 13px; color: [^"]*">)[^<]*/, `$1${summary}`);
};

// ---------- Shopify (decisions 9, 10; audit H7, M11) ----------
// UX walk-through 5 M4: the stock sent leaves held bikes out, as Wheelhouse's
// own website does (browse.mjs wb-product-held).
const WHAT_HAPPENS = `<ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.5"><li><strong>Wheelhouse will replace the prices, photos and stock of the products in your Shopify shop with Wheelhouse’s.</strong> You’ll see how many will change before anything is sent.</li><li>Products in Shopify that aren’t in Wheelhouse: [what happens to them].</li><li>From then on, change products, prices and stock in Wheelhouse — changes to them made in Shopify are replaced. “Show on website” decides what’s sent.</li><li>Shopify orders come into <strong>Front desk › Online orders</strong>, with your other orders, and take the stock off straight away.</li><li>Stock sent to Shopify leaves out bikes held for Cycle to Work orders, so a held bike shows as sold out.</li><li>Shopify’s checkout takes the payment for those orders.</li></ul>`;
const connectBox = (error = '') => box(`<div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0 12px; max-width: 600px"><div style="flex: 1 1 220px">${field('Your Shopify address', error ? { value: '[your-shop].myshopify.com', error, linked: true } : { placeholder: '[your-shop].myshopify.com', linked: true })}</div><div style="padding-top: 26px">${button('Connect')}</div></div>${note('Opens Shopify to approve the connection, then brings you back here. Nothing is sent until you say so.')}`);
const shopifyConnect = (error = '') => websitePage(`${back('Website')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Connect your Shopify shop')}${note('Keep your Shopify look, theme and checkout. Wheelhouse looks after what’s for sale.')}</div>
${box(`${h3('What happens')}${WHAT_HAPPENS}`)}${error ? msg(error, 'bad', true) : ''}${connectBox()}`);
const startShopify = () => steps(2, 'Connect your Shopify shop', 'Then choose which products to send. Your Shopify look stays as it is.', `${box(`${h3('What happens')}${WHAT_HAPPENS}`)}${connectBox()}`, off(button('Next'), 'Connect first'));
const shopifyCheck = () => websitePage(`${back('Website')}<div style="display: flex; flex-direction: column; gap: 4px">${h2('Ready to send to Shopify')}${note('Connected to [your-shop].myshopify.com. Nothing has been sent yet.')}</div>
${box(`${h3('[n] products will change in your Shopify shop')}<ul style="margin: 0; padding: 0; display: flex; flex-direction: column">${[['New prices', '[n] products'], ['New photos', '[n] products'], ['New stock levels', '[n] products'], ['Added', '[n] products not in Shopify yet'], ['Only in Shopify', '[n] products — [what happens to them]']].map(([k, v]) => `<li style="list-style: none; display: flex; flex-direction: ${isP() ? 'column' : 'row'}; gap: ${isP() ? 2 : 12}px; padding: 10px 0; border-top: 1px solid ${C.border}; font-size: 15px"><strong style="min-width: ${isP() ? 0 : 180}px">${k}</strong><span>${v}</span></li>`).join('')}</ul>${linkBtn('See the list of products')}<div style="display: flex; gap: 12px">${button('Send [n] products')}${button('Not now', { variant: 'ghost' })}</div>`)}`);
const shopifySending = () => websitePage(`${box(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px"><span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${C.mutedBg}">${icon('website', 22)}</span><div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1">${h2('Sending to your Shopify shop')}<span style="font-size: 15px; color: ${C.muted}">[your-shop].myshopify.com</span></div></div><div role="progressbar" aria-label="Products sent" aria-valuemin="0" aria-valuemax="100" aria-valuenow="40" style="height: 10px; border-radius: 999px; background: ${C.border}; overflow: hidden"><span style="display: block; width: 40%; height: 100%; background: ${C.ink}"></span></div><span role="status" style="font-size: 15px">[n] of [n] products sent. You can leave this page — it carries on.</span>`)}`);
const shopify = (stage = 'on') => {
  const problem = stage === 'problem';
  return websitePage(`${box(`<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px"><span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${problem ? C.warnBg : C.okBg}; color: ${problem ? C.warnInk : C.successInk}">${icon(problem ? 'alert' : 'check', 22)}</span><div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1">${h2('Connected to your Shopify shop')}<span style="font-size: 15px; color: ${C.muted}">[your-shop].myshopify.com · last sent [time] · [n] products · sent as you change them in Wheelhouse</span></div>${button('Pause sending', { variant: 'ghost' })}${button('Open Shopify', { variant: 'default' })}</div>
${problem ? `<div role="alert" style="display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}"><strong style="display: flex; gap: 8px; font-size: 15px">${icon('alert', 18)}3 products couldn’t be sent to Shopify</strong><ul style="margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; color: ${C.ink}">${[['[Product]', 'No price yet'], ['[Product]', 'No photo — Shopify needs one for this category'], ['[Product]', '[Shopify’s reason]']].map(([p, r]) => `<li style="list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 15px"><strong>${p}</strong><span>${r}</span><a href="#" aria-label="Fix ${esc(p)} in Stock" style="${tall}; font-weight: 600; color: ${C.ink}">Fix in Stock</a></li>`).join('')}</ul><div>${button('Try sending again', { variant: 'default' })}</div></div>` : ''}`)}
${rows(row('Orders from Shopify', 'In Front desk › Online orders, with your other orders'), row('What’s sent to Shopify', '“Show on website” on each category and product, in Stock'), row('Taking payments', 'Shopify’s checkout · Wheelhouse’s for “Pay now” on repairs'), row('Wheelhouse’s website or Shopify', 'Your Shopify shop · switch to Wheelhouse’s website'))}
${note('Change products, prices and stock here in Wheelhouse — changes to them made in Shopify are replaced. Your Shopify theme, pages, cookies and tracking are set in Shopify.')}`);
};
const switchAsk = () => popup('sw-title', 'Switch to Wheelhouse’s website?', 'From your Shopify shop', `<ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 15px; line-height: 1.5"><li>Wheelhouse stops sending to Shopify. Your Shopify shop stays as it is — close it in Shopify when you’re ready.</li><li>Wheelhouse’s website is made from your shop’s details, switched off, for you to check and turn on.</li><li>Your web address, orders and “Show on website” switches stay as they are.</li><li>Orders already placed on Shopify stay in Online orders.</li></ul>`, `${button('Cancel', { variant: 'ghost' })}${button('Switch')}`, 580);
const shopifyOrder = () => {
  let n = 0;
  return onlineScreens['on-orders'][SIZE].replace(/paid \[time\]/g, (m) => (++n === 2 ? `${m} · ${badge('From Shopify', 'blue')}` : m));
};

// ---------- The boards ----------
const ed = (o) => editor({ preview: desktopPreview(o.view || {}), panel: sectionList(o.list || {}), ...o });
def('ws-start-which', () => startWhich());
def('ws-start-look', () => startLook());
def('ws-start-products', () => startProducts());
// UX walk-through 4 M7.
def('ws-start-products-answered', () => startProducts(true));
def('ws-editor-first', () => ed({ state: 'first', siteOff: true, panel: `${msg('<strong>Here’s your website</strong>, made from your shop’s details. Click any part to change it.', 'ok')}${sectionList()}` }));
def('ws-page', () => overview({ published: false }));
def('ws-page-on', () => overview({ on: true, changes: true, pay: 'ok' }));
// UX walk-through 4 H2.
def('ws-page-moving', () => overview({ published: false, pay: 'ok', moving: 'ready' }));
def('ws-page-switch-over', () => overview({ published: false, pay: 'ok', moving: 'morning' }));
def('ws-editor-moving', () => ed({ state: 'first', siteOff: true, moving: true }));
def('ws-page-changes', () => overview({ on: true, changes: true, open: true, pay: 'ok' }));
def('ws-no-access', () => noAccess());
def('ws-no-settings', () => noSettings());
def('ws-editor', () => ed({ view: { hover: 'Featured products' } }));
def('ws-editor-section', () => ed({ view: { part: 'Big photo and headline' }, panel: heroPanel() }));
def('ws-editor-add', () => ed({ view: { part: 'Featured products' }, panel: addPanel() }));
def('ws-editor-drag', () => ed({ list: { lifted: 'Book a repair', gapAt: 2 }, view: { scroll: scrollFor('Featured products') } }));
const MOVED = ['Big photo and headline', 'Shop by category', 'Book a repair', 'Featured products', 'Our shops', 'Words and a picture'];
def('ws-editor-moved', () => ed({ list: { on: 'Book a repair', order: MOVED }, view: { order: MOVED, part: 'Book a repair' }, extra: `${sr('<span role="status">Book a repair moved to position 3 of 6</span>')}${toast('Book a repair moved above Featured products', ['Undo · Ctrl+Z'])}` }));
def('ws-editor-removed', () => ed({ list: { order: HOME_SECTIONS.filter((n) => n !== 'Words and a picture') }, view: { order: HOME_SECTIONS.filter((n) => n !== 'Words and a picture'), scroll: PAGE_H - VIEW_H - 246 } , extra: toast('Removed Words and a picture', ['Undo']) }));
def('ws-editor-header', () => ed({ phoneTab: 'sections', view: { scroll: 0 }, panel: headerPanel(), preview: scaled(recolour(browseScreens['wb-home'].desktop, OCEAN).replace('<header style="', `<header style="outline: 4px solid ${C.ink}; outline-offset: -4px; `), W, H, pScale(), 'Preview of Home. It can’t be used; pick a part from the list or click it', { px: 0 }) }));
def('ws-editor-on-phone', () => ed({ size: 'Phone', phoneTab: 'preview', preview: scaled(recolour(browseScreens['wb-home'].phone, OCEAN), 390, 844, 0.78, 'Preview of Home on a phone. It can’t be used', { px: 0, total: 2600, view: 844 }) }));
def('ws-editor-bigger', () => ed({ big: true, phoneTab: 'preview', view: { big: true } }));
def('ws-editor-pages-menu', () => (isP() ? overlay(ed({}), pageMenuPhone()) : ed({ menu: true })));
def('ws-editor-saving', () => ed({ state: 'saving', view: { part: 'Big photo and headline' }, panel: heroPanel() }));
def('ws-editor-taken', () => overlay(ed({ state: 'view' }), takeover()));
def('ws-theme', () => ed({ tab: 'theme', panel: themePanel() }));
def('ws-theme-contrast', () => ed({ tab: 'theme', chip: true, view: { colour: '#E8C547' }, panel: themePanel({ colour: '#E8C547', warn: true }) }));
def('ws-theme-publish', () => overlay(ed({ tab: 'theme', chip: true, view: { colour: '#E8C547' }, panel: themePanel({ colour: '#E8C547', warn: true }) }), publishAsk()));
def('ws-theme-product', () => ed({ tab: 'theme', phoneTab: 'preview', phonePreview: scaled(recolour(browseScreens['wb-product'].phone, OCEAN), 390, 844, 0.7, 'Preview of a product page. It can’t be used', { px: 0, total: 1700, view: 844 }), pageName: 'A product', caption: 'A product · made by Wheelhouse, preview only, in your draft theme', panel: themePanel(), preview: scaled(recolour(browseScreens['wb-product'].desktop, OCEAN), W, H, pScale(), 'Preview of a product page. It can’t be used', { px: 0, total: 1300 }) }));
def('ws-theme-fonts', () => ed({ tab: 'theme', panel: themePanel({ fonts: true }) }));
def('ws-published', () => ed({ state: 'published', extra: toast('Published — customers see it now', ['View website']) }));
def('ws-published-off', () => ed({ state: 'published', siteOff: true, extra: toast('Published. Customers will see it once you turn the website on', ['View it']) }));
def('ws-discard', () => overlay(ed({}), discard()));
def('ws-history', () => overlay(ed({}), history()));
def('ws-pages', () => pagesList());
def('ws-pages-new', () => overlay(pagesList(), newPage()));
def('ws-page-settings', () => overlay(pagesList(), pageSettings()));
def('ws-page-returns', () => editor({ pageName: 'Collection and returns', preview: scaled(recolour(returnsSite(), OCEAN), W, H, pScale(), 'Preview of Collection and returns. It can’t be used; pick a part from the list or click it', { px: 0, total: 800, view: 800 }), panel: returnsPanel() }));
def('ws-tracking', () => tracking());
def('ws-tracking-on', () => tracking({ on: true }));
def('ws-tracking-error', () => tracking({ on: true, error: true }));
def('ws-address', () => address('start'));
def('ws-address-typo', () => address('typo'));
def('ws-address-steps', () => address('steps'));
// UX walk-through 4 H2.
def('ws-address-moving', () => address('steps', true));
def('ws-address-waiting', () => address('waiting'));
def('ws-address-done', () => address('done'));
def('ws-pay-none', () => paySettings('none'));
def('ws-pay-connected', () => paySettings('connected'));
def('ws-pay-tested', () => paySettings('tested'));
// UX walk-through 4 H2.
def('ws-pay-tested-moving', () => paySettings('tested', true));
def('ws-pay-failed', () => paySettings('failed'));
def('ws-pay-more', () => paySettings('more'));
def('ws-today-pay-more', () => today({ payMore: true }));
def('ws-start-shopify', () => startShopify());
def('ws-shopify-connect', () => shopifyConnect());
def('ws-shopify-failed', () => shopifyConnect('Couldn’t connect. Shopify didn’t find [your-shop].myshopify.com, or the approval was cancelled. Nothing has changed.'));
def('ws-shopify-check', () => shopifyCheck());
def('ws-shopify-sending', () => shopifySending());
def('ws-shopify-on', () => shopify('on'));
def('ws-shopify-problem', () => shopify('problem'));
def('ws-shopify-switch', () => overlay(shopify('on'), switchAsk()));
def('ws-pay-shopify', () => paySettings('shopify'));
def('ws-shopify-order', () => shopifyOrder());

// Desktop, tablet and phone (tablet and phone drawn after the UI audit).
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ws-start-which': 'Set up, step 1: Wheelhouse’s website or your Shopify shop?',
  'ws-start-look': 'Step 2: logo and main colour, suggested from the logo',
  'ws-start-products': 'Step 3: start with every product online, or nothing — with how many have no photo or price',
  'ws-start-products-answered': 'Step 3 when buying online asked first: the answer, with Change',
  'ws-editor-first': 'The editor opens on a ready-made home page, still off',
  'ws-page': 'Office › Website: off and never published — Turn it on also publishes',
  'ws-page-on': 'On, with unpublished changes and payments connected',
  'ws-page-moving': 'Moving from Citrus Lime: ready for switch-over, Turn it on waits',
  'ws-page-switch-over': 'Switch-over morning: the website is ready — Turn it on',
  'ws-editor-moving': 'The editor while moving: off until switch-over morning',
  'ws-page-changes': 'The unpublished changes, with Publish and Discard',
  'ws-no-access': 'Without “Can edit the website”: who to ask',
  'ws-no-settings': 'Can edit the website, but not change settings',
  'ws-editor': 'The editor: sections down the side; pointing at a part of the page',
  'ws-editor-section': 'A section chosen: its settings, and the photo’s description',
  'ws-editor-add': '+ Add section: below the chosen section',
  'ws-editor-drag': 'Dragging a section (or its arrows, or Alt + arrow keys)',
  'ws-editor-moved': 'Moved: the page shows the new order, with Undo',
  'ws-editor-removed': 'A section removed, with Undo',
  'ws-editor-header': 'The header: logo, and one link as a button',
  'ws-editor-on-phone': 'Preview on a phone',
  'ws-editor-bigger': 'Bigger: the preview without the panel',
  'ws-editor-pages-menu': 'The Page menu: your pages, and Wheelhouse’s shop pages',
  'ws-editor-saving': 'Couldn’t save — trying again',
  'ws-editor-taken': 'Someone else is editing: view only, or take over',
  'ws-theme': 'Theme: main colour, background, fonts, corners, buttons',
  'ws-theme-contrast': 'A colour that’s hard to read: where, and two fixes',
  'ws-theme-publish': 'Publishing with a hard-to-read colour asks once',
  'ws-theme-product': 'The theme on a product page (preview only)',
  'ws-theme-fonts': 'Fonts: a chosen list of tested pairs',
  'ws-published': 'Published, with View website',
  'ws-published-off': 'Published while the website is off',
  'ws-discard': 'Discard unpublished changes? Kept in History',
  'ws-history': 'Earlier versions and discarded drafts',
  'ws-pages': 'Pages: ready-made, two with wording to check',
  'ws-pages-new': 'Add a page: linked from the footer by default',
  'ws-page-settings': 'Page settings: a page that always stays in the footer',
  'ws-page-returns': 'Editing Collection and returns: starting wording to check',
  'ws-tracking': 'Tracking tools: none on, so no cookie choice',
  'ws-tracking-on': 'Google Analytics on: goes live when you publish',
  'ws-tracking-error': 'An ID that doesn’t look right: no cookie choice yet',
  'ws-address': 'Web address: the free one, or use your own',
  'ws-address-typo': 'An address that needs an ending',
  'ws-address-steps': 'Your own address: the 2 records, and what it changes',
  'ws-address-moving': 'While moving: point your address here on switch-over morning',
  'ws-address-waiting': 'Not connected yet — up to a day',
  'ws-address-done': 'Your own address connected',
  'ws-pay-none': 'Online orders › Paying online: not connected, Buying online off',
  'ws-pay-connected': 'Back from [payment provider]: make a test payment',
  'ws-pay-tested': 'The test payment worked',
  'ws-pay-tested-moving': 'The test payment worked, while moving from Citrus Lime',
  'ws-pay-failed': 'Connecting didn’t finish: nothing changed',
  'ws-pay-more': '[payment provider] needs more details',
  'ws-today-pay-more': 'The same warning on Today',
  'ws-start-shopify': 'Set up with Shopify, step 2: connect',
  'ws-shopify-connect': 'Connect your Shopify shop: what happens first',
  'ws-shopify-failed': 'Couldn’t connect to Shopify',
  'ws-shopify-check': 'Before sending: how many products will change',
  'ws-shopify-sending': 'Sending to Shopify',
  'ws-shopify-on': 'Connected to Shopify: the Website page',
  'ws-shopify-problem': 'Products that couldn’t be sent to Shopify',
  'ws-shopify-switch': 'Switching to Wheelhouse’s website: what changes',
  'ws-pay-shopify': 'Online orders with Shopify: Shopify takes website payments',
  'ws-shopify-order': 'A Shopify order in Online orders',
};
export const ROWS = [
  { label: 'Setting it up', screens: ['ws-start-which', 'ws-start-look', 'ws-start-products', 'ws-start-products-answered', 'ws-editor-first'] },
  { label: 'The Website page', screens: ['ws-page', 'ws-page-on', 'ws-page-changes', 'ws-no-access', 'ws-no-settings'] },
  // UX walk-through 4 H2.
  { label: 'While moving from Citrus Lime', screens: ['ws-page-moving', 'ws-editor-moving', 'ws-pay-tested-moving', 'ws-address-moving', 'ws-page-switch-over'] },
  { label: 'Editing the home page', screens: ['ws-editor', 'ws-editor-section', 'ws-editor-add', 'ws-editor-drag', 'ws-editor-moved', 'ws-editor-removed', 'ws-editor-header', 'ws-editor-on-phone', 'ws-editor-bigger', 'ws-editor-pages-menu', 'ws-editor-saving', 'ws-editor-taken'] },
  { label: 'Theme', screens: ['ws-theme', 'ws-theme-contrast', 'ws-theme-publish', 'ws-theme-product', 'ws-theme-fonts'] },
  { label: 'Publishing', screens: ['ws-published', 'ws-published-off', 'ws-discard', 'ws-history'] },
  { label: 'Pages', screens: ['ws-pages', 'ws-pages-new', 'ws-page-settings', 'ws-page-returns'] },
  { label: 'Tracking tools', screens: ['ws-tracking', 'ws-tracking-on', 'ws-tracking-error'] },
  { label: 'Web address (waiting on the business plan decision)', screens: ['ws-address', 'ws-address-typo', 'ws-address-steps', 'ws-address-waiting', 'ws-address-done'] },
  { label: 'Online payments setup', screens: ['ws-pay-none', 'ws-pay-connected', 'ws-pay-tested', 'ws-pay-failed', 'ws-pay-more', 'ws-today-pay-more'] },
  { label: 'Shopify', screens: ['ws-start-shopify', 'ws-shopify-connect', 'ws-shopify-failed', 'ws-shopify-check', 'ws-shopify-sending', 'ws-shopify-on', 'ws-shopify-problem', 'ws-shopify-switch', 'ws-pay-shopify', 'ws-shopify-order'] },
];
