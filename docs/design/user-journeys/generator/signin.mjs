// Journey B — Signing in and access, redrawn in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-29-signing-in-review.md
//
// WorkOS hosts the sign-in, password and invitation pages (decision 2): one
// board shows roughly how they will look, labelled as an approximation.
// Everything else here is Wheelhouse's own. Example data is only what the
// generator already has: North Street Cycles, Bolton, Till B1, Jack Lewis
// (Owner — UX walk-through 2 (decision 6)), Jo Taylor (Staff), Alex Morgan (Mechanic); unknown facts are
// bracketed placeholders. Every screen is drawn at desktop, tablet and phone
// (1280×800, 1180×820, 390×844).
import { C, MONO, esc, icon, button, field, card, logoSlot } from './ui.mjs';
import { DW, DH, PW, PH } from './stage1.mjs';
import { shellDesktop, shellTablet, shellPhone, screens as diaryScreens, TW, TH } from './diary.mjs';
import { tillBar, tillPhoneBar, siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { practiceBandFor } from './till.mjs';

const SHOP = 'North Street Cycles';
const SIZE = { desktop: [DW, DH], tablet: [TW, TH], phone: [PW, PH] };
const SIZES = Object.keys(SIZE);
const h1 = (t, size = 26) => `<h1 style="margin: 0; font-size: ${size}px; line-height: 1.2; font-weight: 700; letter-spacing: -0.3px">${t}</h1>`;
const p = (t, size = 15) => `<p style="margin: 0; font-size: ${size}px; line-height: 1.5; color: ${C.muted}">${t}</p>`;
const stack = (inner, gap = 18) => `<div style="display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`;
const roundIcon = (name, bg, ink) => `<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${bg}; color: ${ink}">${icon(name, 24)}</span>`;
const errorLine = (t) => `<p role="alert" style="margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; font-weight: 600; color: ${C.dangerInk}">${icon('alert', 18)}${t}</p>`;
const each = (fn) => Object.fromEntries(SIZES.map((s) => [s, fn(s)]));

// Wheelhouse's own full-page messages: a centred card on the sand ground;
// on a phone the card falls away and the content fills the screen.
function centred(size, inner, { w = 440, brand = 'Wheelhouse', foot = '' } = {}) {
  const [W, H] = SIZE[size];
  const brandRow = `<div style="display: flex; align-items: center; gap: 10px">${logoSlot(brand + ' logo')}<span style="font-size: ${size === 'phone' ? 18 : 20}px; font-weight: 700">${esc(brand)}</span></div>`;
  if (size === 'phone') return `<div style="position: relative; width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 28px 20px; display: flex; flex-direction: column; gap: 28px; background: ${C.panel}">${brandRow}<div style="display: flex; flex-direction: column; gap: 18px">${inner}</div>${foot}</div>`;
  return `<div style="position: relative; width: ${W}px; height: ${H}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; background: ${C.bg}">
${brandRow}
${card(`<div style="padding: 32px; display: flex; flex-direction: column; gap: 18px">${inner}</div>`, `width: ${w}px`)}
${foot}
</div>`;
}

export const screens = {};

// ---------- Staff: WorkOS's page (approximation) ----------
// Decision 2: WorkOS AuthKit, branded with what its settings allow — logo,
// colours, corner radius, a Google font (Public Sans), centred layout.
screens['workos-signin'] = each((size) => centred(size, `${h1('Sign in to Wheelhouse', 24)}
${field('Email', { type: 'email', value: 'jo@northstreetcycles.example' })}
${button('Continue', { block: true })}
<div style="display: flex; justify-content: center"><a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Forgot your password?</a></div>`, {
  w: 400,
  foot: `<p style="position: absolute; left: 16px; right: 16px; bottom: 20px; margin: 0; text-align: center; font-size: 13px; color: ${C.muted}">Approximate look — this page is hosted by WorkOS and styled through its branding settings</p>`,
}));

// ---------- Staff: Wheelhouse's own pages ----------
// Where are you working today? — only for people with more than one site
// (decision 9); tapping a site goes straight in (journey A decision 6).
// UX walk-through 7 H1: a shop with something waiting says "[n] need
// attention", and the owner (or a manager at two or more shops) also gets
// "All shops". L1: "shop", not "site", where staff read it.
const siteCard = (name, sub, last, alert = '') => `<a href="#" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 64px; box-sizing: border-box; padding: 14px 16px; border-radius: 10px; border: 1px solid ${last ? C.ink : C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span>${alert ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: ${C.warnInk}">${icon('alert', 14)}${alert}</span>` : ''}</span><span style="display: inline-flex; align-items: center; gap: 8px">${last ? `<span style="font-size: 12px; font-weight: 600; color: ${C.muted}">Last time</span>` : ''}<span style="display: inline-flex; transform: rotate(-90deg)">${icon('chevron', 18)}</span></span></a>`;
screens['auth-site'] = each((size) => centred(size, stack(`${h1('Where are you working today?')}${p(`You work at more than one ${SHOP} shop. Switch any time from the ${size === 'phone' ? 'menu' : 'sidebar'}.`)}
${siteCard('Bolton', `${SHOP} · Till B1`, true)}
${siteCard('[Second site]', SHOP, false, '3 need attention')}
${siteCard('All shops', 'Owners, and managers at two or more shops', false)}`, 14)));
screens['auth-signedout'] = each((size) => centred(size, stack(`${h1('You’ve signed out')}${p('Close this window, or sign in again.')}${button('Sign in again', { block: true })}`, 16)));
screens['auth-expired'] = each((size) => centred(size, stack(`${roundIcon('lock', C.warnBg, C.warnInk)}${h1('Please sign in again')}${p('You were signed out after a while without activity. Sign in and you’ll be back where you were.')}${button('Sign in again', { block: true })}`, 16)));
const noAccess = (size) => card(`<div style="padding: ${size === 'phone' ? 22 : 28}px; display: flex; flex-direction: column; gap: 14px">${roundIcon('lock', C.mutedBg, C.muted)}${h1('Reports aren’t part of your role', size === 'phone' ? 20 : 22)}${p('Your role is Staff. Reports are for owners and managers. Ask one of them if you need access.')}<div>${button('Go to Today', { variant: 'default', block: size === 'phone' })}</div></div>`);
const JO = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
screens['auth-noaccess'] = {
  desktop: shellDesktop('today', 'Reports', `<div style="max-width: 520px">${noAccess('desktop')}</div>`, JO),
  tablet: shellTablet('today', 'Reports', `<div style="max-width: 520px">${noAccess('tablet')}</div>`, JO),
  phone: shellPhone('Reports', noAccess('phone'), { ...JO, active: 'today' }),
};

// ---------- Till ----------
// Till screens before anyone is serving: the till bar says so (decision 9).
function tillFrame(size, content, offline = false) {
  const [W, H] = SIZE[size];
  const bar = size === 'phone' ? tillPhoneBar(null, offline) : tillBar({ serving: null, offline: offline ? '[n] sales' : null });
  return `<div style="width: ${W}px; height: ${H}px; display: flex; flex-direction: column; background: ${C.bg}">${bar}<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: ${size === 'phone' ? '16px' : '28px'}">${content}</main></div>`;
}

// Set up this till — a manager, signed in, turns this computer into a till.
// Site and till number as pills (Workshop day decisions 62, 66).
// UX walk-through 7 M2: the numbers are the chosen shop's, and taken ones
// say "In use" — drawn with [Second site] chosen ([code]1–[code]2 are its
// tills on ms-tills, so [code]3 is next). L1: "Shop", not "Site".
const inUse = (t) => `<button type="button" disabled aria-label="${esc(t)}, in use" style="min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px dashed ${C.border}; background: transparent; color: ${C.muted}; font-family: inherit; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px">${t}<span style="font-size: 12px; font-weight: 500">In use</span></button>`;
const pill = (t, on) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : 'transparent'}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`;
const pillGroup = (label, items) => `<div role="group" aria-label="${esc(label)}" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">${esc(label)}</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${items}</div></div>`;
// UX walk-through 2 (decision 6): Jack Lewis signs in as the Owner.
// UX walk-through 7 M2: journey B's first till is Bolton's B1; the
// multiple-sites journey draws the same screen with [Second site] chosen and
// its taken numbers marked "In use" (tillSetupAt(size, { second: true })).
export const tillSetupAt = (size, { second = false } = {}) => centred(size, stack(`${h1('Set up this till')}${p(`Signed in as Jack Lewis (Owner). This ${size === 'desktop' ? 'computer' : 'device'} becomes a till: it stays signed in, works offline, and staff check in with their PIN.`)}
${pillGroup('Shop', pill('Bolton', !second) + pill('[Second site]', second))}
${second ? pillGroup('Till number', inUse('[code]1') + inUse('[code]2') + pill('[code]3', true)) : pillGroup('Till number', pill('B1', true) + pill('B2', false) + pill('B3', false))}
${second ? field('Name (optional)', { hint: 'Receipts from this till are numbered [code]3-0001, [code]3-0002 and so on.' }) : field('Name (optional)', { value: 'Front counter', hint: 'Receipts from this till are numbered B1-0001, B1-0002 and so on.' })}
${button(`Make this ${size === 'desktop' ? 'computer' : 'device'} Till ${second ? '[code]3' : 'B1'}`, { block: true })}`, 16), { w: 480 });
screens['till-setup'] = each((size) => tillSetupAt(size));

// Decision 4: PIN only — it says who you are. It checks the 4th digit at
// once (no OK button), and works without the internet (decision 3). A wrong
// PIN clears the dots and says so — no lock (decisions 8, 9).
const key = (k, label = k, h = 68) => `<button type="button"${label !== k ? ` aria-label="${label}"` : ''} style="min-height: ${h}px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; font-size: ${/^\d$/.test(k) ? 26 : 16}px; font-weight: 600; color: ${C.ink}">${k}</button>`;
const pinPad = (h = 68) => `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => key(k, k, h)).join('')}${key('Clear', 'Clear', h)}${key('0', '0', h)}${key('Delete', 'Delete the last digit', h)}</div>`;
const dots = (n) => `<div role="status" aria-label="${n} of 4 digits entered" style="display: flex; gap: 16px; justify-content: center">${[0, 1, 2, 3].map((i) => `<span style="width: 18px; height: 18px; border-radius: 999px; border: 2px solid ${C.ink}; background: ${i < n ? C.ink : 'transparent'}"></span>`).join('')}</div>`;
const checkedIn = (names) => `<div style="display: flex; flex-direction: column; gap: 10px"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">Checked in today</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${names.map((n) => `<span style="display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 12px 0 4px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 14px; font-weight: 600"><span style="display: inline-flex; width: 28px; height: 28px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}; font-size: 12px; font-weight: 700">${n.split(' ').map((x) => x[0]).join('')}</span>${n}</span>`).join('')}</div></div>`;
// Leftover screens decision 4 (2 Oct): the till's start-up status is one
// line on the PIN screen — amber when something's wrong.
// Leftover audit M4: the line says what is up to date (prices and stock,
// and sales sent) and leaves the till's name to the bar. Amber when offline
// with sales waiting, or online but not updated for [n] minutes.
const STATUS = {
  online: [false, 'check', 'Online · prices and stock updated [time]'],
  offline: [true, 'wifi', 'Offline · [n] sales waiting to send · prices and stock last updated [time]'],
  stale: [true, 'alert', 'Online · prices and stock last updated [time] · [n] sales still sending'],
};
const tillStatus = (size, state) => { const [warn, ic, t] = STATUS[state]; return `<p role="status" style="margin: 0; display: inline-flex; align-self: center; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 10px; background: ${warn ? C.warnBg : C.okBg}; color: ${warn ? C.warnInk : C.successInk}; font-size: ${size === 'phone' ? 13 : 14}px; font-weight: 600; text-align: left">${icon(ic, 15)}<span>${t}</span></p>`; };
// UX walk-through 4 H1: one line under the pad for someone who has no PIN
// yet — the till can't give one, it stays signed in as the till.
const noPinLine = (size) => `<p style="margin: 0; font-size: ${size === 'phone' ? 13 : 14}px; line-height: 1.45; color: ${C.muted}"><strong style="color: ${C.ink}">No PIN yet?</strong> Sign in to Wheelhouse on a phone or computer — it gives you one. No email? Ask the owner or a manager.</p>`;
// UX walk-through 4 M4: while the shop runs alongside its old system, the
// PIN screen already shows the practice band, before anyone checks in — the
// till's own band (till.mjs, journey 9 decision 6).
function checkin(size, { wrong = false, state = 'online', practice = false } = {}) {
  const offline = state === 'offline';
  const P = size === 'phone';
  const w = P ? 'auto' : '360px';
  const html = tillFrame(size, `<div style="height: 100%; display: flex; flex-direction: column; align-items: ${P ? 'stretch' : 'center'}; justify-content: center; gap: ${P ? 14 : 18}px">
<div style="width: ${w}; display: flex; flex-direction: column; gap: ${P ? 14 : 18}px; text-align: center">${tillStatus(size, state)}${h1('Enter your PIN', P ? 24 : 28)}${p('Your PIN checks you in and puts your name on sales. It works even when the internet is down.', P ? 14 : 15)}${dots(wrong ? 0 : 2)}${wrong ? errorLine('That PIN isn’t anyone’s — try again') : ''}${pinPad(P ? 56 : 64)}${noPinLine(size)}</div>
<div style="width: ${w}">${checkedIn(['Alex Morgan'])}</div>
</div>`, offline);
  // The band sits straight under the till bar.
  return practice ? html.replace('</header>', `</header>${practiceBandFor(size)}`) : html;
}
screens['till-checkin'] = each((size) => checkin(size));
screens['till-pin-wrong'] = each((size) => checkin(size, { wrong: true }));
screens['till-checkin-offline'] = each((size) => checkin(size, { state: 'offline' }));
screens['till-checkin-stale'] = each((size) => checkin(size, { state: 'stale' }));
screens['till-checkin-practice'] = each((size) => checkin(size, { practice: true })); // UX walk-through 4 M4

// Decisions 6 and 7: change your PIN from Your settings. Wheelhouse picks a
// new random PIN nobody else has (so choosing can't reveal a colleague's);
// "Give me a different one" rolls another. The digits shown are an example.
const pinDigit = (d) => `<span style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 72px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: ${MONO}; font-size: 34px; color: ${C.ink}">${d}</span>`;
// UX walk-through 4 H1 (option 1): the same pop-up in a first-time version —
// on a person's first sign-in (after WorkOS's page) and on the first sign-in
// after their PIN was cleared (Owner setup audit M20's rule, now drawn).
// No "old PIN" line; "Skip for now" for someone who never uses the till.
// Then they land in their room.
// UX walk-through 4 M2 (option 1): `give` is the till's version for someone
// with no email ("Till only"): the Owner or a manager opens it after checking
// in and turns the screen to the person; it goes back to the PIN screen.
const PIN_TEXT = {
  change: ['Your new till PIN', 'Wheelhouse picked this for you — nobody else at the shop has it. Learn it before you close this.', 'Your old PIN stops working when you keep this one.'],
  first: ['Your till PIN', 'Welcome to North Street Cycles, Jo. This PIN checks you in at the till and puts your name on sales. Wheelhouse picked it — nobody else at the shop has it, and only you see it. Learn it before you close this.', 'Not using the till? Skip it — you can get a PIN later in Your settings.'],
  cleared: ['Your till PIN', 'Your old PIN was cleared, so here’s a new one. Wheelhouse picked it — nobody else at the shop has it, and only you see it. Learn it before you close this.', 'Not using the till? Skip it — you can get a PIN later in Your settings.'],
  give: ['[Name]’s till PIN', 'Turn the screen to [Name]. Wheelhouse picked this PIN — nobody else at the shop has it. [Name] learns it now; only they should see it.', 'Then the till goes back to the PIN screen, ready for [Name] to check in.'],
};
function pinDialog(size, mode = 'change') {
  const P = size === 'phone';
  const [title, intro, foot] = PIN_TEXT[mode];
  const later = mode === 'first' || mode === 'cleared';
  const close = mode === 'give'
    ? `<button type="button" aria-label="Close without giving a PIN" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: ${C.ink}">${icon('close', 20)}</button>`
    : later ? '' : `<a href="your-settings-${size}.dc.html" aria-label="Close without changing your PIN" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a>`;
  return `<div role="dialog" aria-modal="true" aria-labelledby="pin-title-${size}" style="${P ? 'width: 100%; height: 100%;' : `width: 440px; border: 1px solid ${C.border}; border-radius: 12px; box-shadow: 0 18px 48px rgba(38,36,32,0.28);`} box-sizing: border-box; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">
<div style="display: flex; align-items: center; gap: 12px; min-height: 72px; box-sizing: border-box; padding: 14px 14px 14px 22px; background: ${C.panel}; border-bottom: 1px solid ${C.border}"><h2 id="pin-title-${size}" style="margin: 0; font-size: 20px; font-weight: 700; flex-grow: 1">${title}</h2>${close}</div>
<div style="padding: 24px ${P ? 20 : 28}px 28px; display: flex; flex-direction: column; gap: 20px; align-items: center; text-align: center">
${p(intro, 14)}
<div aria-label="${mode === 'give' ? '[Name]’s' : 'New'} PIN 7 3 0 5" style="display: flex; gap: 10px">${['7', '3', '0', '5'].map(pinDigit).join('')}</div>
<div style="width: 100%; display: flex; flex-direction: column; gap: 10px">${button('Keep this PIN', { block: true })}${button('Give me a different one', { variant: 'default', block: true })}${later ? button('Skip for now', { variant: 'ghost', block: true }) : ''}</div>
<span style="font-size: 13px; color: ${C.muted}">${foot}</span>
</div>
</div>`;
}
const pinBoard = (mode, behind) => each((size) => {
  const [W, H] = SIZE[size];
  if (size === 'phone') return `<div style="width: ${W}px; height: ${H}px; display: flex">${pinDialog(size, mode)}</div>`;
  return `<div style="position: relative; width: ${W}px; height: ${H}px; overflow: hidden">${behind(size)}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center">${pinDialog(size, mode)}</div></div>`;
});
screens['pin-change'] = pinBoard('change', (size) => diaryScreens.diary[size]);
// UX walk-through 4 H1: Jo's first sign-in, over the staff app she lands in.
screens['pin-first'] = pinBoard('first', (size) => diaryScreens.diary[size]);
screens['pin-cleared'] = pinBoard('cleared', (size) => diaryScreens.diary[size]);
// UX walk-through 4 M2: given at the till by the Owner, Jack Lewis, who has
// checked in (the till behind is his; the sale screen itself isn't redrawn).
screens['till-give-pin'] = pinBoard('give', (size) => { const [W, H] = SIZE[size]; return `<div style="width: ${W}px; height: ${H}px; display: flex; flex-direction: column; background: ${C.bg}">${tillBar({ serving: 'Jack Lewis' })}<main style="flex-grow: 1"></main></div>`; });

// ---------- Customers (decision 5) ----------
// On the shop's own website, in its theme: Wheelhouse's own "email me a
// code" screens; WorkOS sends and checks the six-digit code (valid 10
// minutes) behind the scenes. The booking-link pages (no sign-in) are the
// Release 1 designs and stay as they are.
function custPage(size, inner) {
  if (size === 'phone') return sitePhone('sand', { content: `<div style="flex-grow: 1; box-sizing: border-box; padding: 8px 4px; display: flex; flex-direction: column; gap: 18px">${inner}</div>` });
  const box = `<div style="flex-grow: 1; display: flex; justify-content: center; padding-top: ${size === 'desktop' ? 32 : 24}px">${card(`<div style="padding: 32px; display: flex; flex-direction: column; gap: 18px">${inner}</div>`, 'width: 440px; align-self: flex-start')}</div>`;
  return size === 'desktop' ? siteDesktop('sand', 'Account', box) : siteTablet('sand', box);
}
screens['cust-signin'] = each((size) => custPage(size, `${h1('Sign in to your account', size === 'phone' ? 24 : 26)}${p('See your bookings, your bikes and past work. We’ll email you a code — no password needed.')}
${field('Email', { type: 'email', value: 'maya@example.com' })}
${button('Email me a code', { block: true })}
<div style="padding-top: 14px; border-top: 1px solid ${C.border}">${p('Just checking a booking? Open the link in your text or email — no sign-in needed.', 14)}</div>`));
// Fewer clicks (journey A decision 6): the code checks itself when the 6th
// digit goes in, and a code pasted from the email fills all six boxes.
// Decision 9: a wrong or expired code says so under the boxes.
const codeBox = (d, i, { focus = -1, bad = false, w = 48 } = {}) => `<input aria-label="Digit ${i + 1} of 6" inputmode="numeric" maxlength="1" value="${d}" style="width: ${w}px; height: 56px; box-sizing: border-box; text-align: center; border-radius: 8px; border: ${bad ? `2px solid ${C.danger}` : `1px solid ${i === focus ? C.ink : C.input}`}; background: #ffffff; font-family: ${MONO}; font-size: 24px; color: ${C.ink}">`;
const codeLinks = (strong = false) => `<div style="display: flex; justify-content: space-between; gap: 12px"><a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: ${strong ? 700 : 600}; color: ${C.ink}">Send a new code</a><a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Use a different email</a></div>`;
function codePage(size, { expired = false } = {}) {
  const w = size === 'phone' ? 46 : 48;
  const digits = expired ? ['4', '8', '1', '2', '9', '6'] : ['4', '8', '1', '', '', ''];
  return custPage(size, `${h1('Enter your code', size === 'phone' ? 24 : 26)}${p(`We sent a 6-digit code to <strong style="color: ${C.ink}">maya@example.com</strong>. It works for 10 minutes and signs you in as soon as the last digit goes in.`)}
<div role="group" aria-label="Your 6-digit code" style="display: flex; gap: 8px">${digits.map((d, i) => codeBox(d, i, { focus: expired ? -1 : 3, bad: expired, w })).join('')}</div>
${expired ? `<div style="text-align: left">${errorLine('That code has expired — send a new one')}</div>` : ''}
${codeLinks(expired)}`);
}
screens['cust-code'] = each((size) => codePage(size));
screens['cust-code-expired'] = each((size) => codePage(size, { expired: true }));

export const TITLES = {
  'workos-signin': 'Sign in — WorkOS’s page, approximate look',
  'auth-site': 'Where are you working today? (more than one shop; tap to go straight in)',
  'auth-signedout': 'Signed out',
  'auth-expired': 'Signed out after a while — sign in again',
  'auth-noaccess': 'Not part of your role',
  'till-setup': 'Set up this till (manager)',
  'till-checkin': 'Till check-in — PIN only',
  'till-checkin-offline': 'Till start-up: offline, sales waiting to send',
  'till-checkin-stale': 'Till start-up: online, but not up to date',
  'till-pin-wrong': 'Till check-in — wrong PIN',
  'pin-change': 'Your new till PIN — Wheelhouse picks it',
  // UX walk-through 4 H1, M2, M4
  'pin-first': 'First sign-in — Your till PIN opens straight away (Skip for now if you never use the till)',
  'pin-cleared': 'First sign-in after a PIN was cleared — a new PIN, the same way',
  'till-give-pin': 'Till only (no email) — the Owner or a manager gives the PIN at the till, screen turned to the person',
  'till-checkin-practice': 'Till check-in while running alongside — the practice band before anyone checks in',
  'cust-signin': 'Customer sign-in on the shop’s website — email me a code',
  'cust-code': 'Customer sign-in — enter the code (checks itself on the 6th digit)',
  'cust-code-expired': 'Customer sign-in — code expired',
};

export const ROWS = [
  { label: 'Staff sign-in (WorkOS)', screens: ['workos-signin'] },
  { label: 'Staff access', screens: ['auth-site', 'auth-signedout', 'auth-expired', 'auth-noaccess'] },
  { label: 'Till', screens: ['till-setup', 'till-checkin', 'till-checkin-offline', 'till-checkin-stale', 'till-pin-wrong', 'pin-change'] },
  // UX walk-through 4 H1, M2, M4: a new person's first PIN, and the till in practice.
  { label: 'A new person’s first PIN', screens: ['pin-first', 'pin-cleared', 'till-give-pin', 'till-checkin-practice'] },
  { label: 'Customers', screens: ['cust-signin', 'cust-code', 'cust-code-expired'] },
];
