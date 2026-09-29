// Journey B — Signing in and access, redrawn in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-29-signing-in-review.md
//
// WorkOS hosts the sign-in, password and invitation pages (decision 2): one
// board shows roughly how they will look, labelled as an approximation.
// Everything else here is Wheelhouse's own. Example data is only what the
// generator already has: North Street Cycles, Bolton, Till B1, Jack Lewis
// (Manager), Jo Taylor (Staff), Alex Morgan (Mechanic), Sam Reid; unknown
// facts are bracketed placeholders.
import { C, MONO, esc, icon, button, field, card, badge, logoSlot } from './ui.mjs';
import { DW, DH } from './stage1.mjs';
import { shellDesktop } from './diary.mjs';
import { tillBar, siteDesktop } from './app-map.mjs';

const SHOP = 'North Street Cycles';
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const h1 = (t, size = 26) => `<h1 style="margin: 0; font-size: ${size}px; line-height: 1.2; font-weight: 700; letter-spacing: -0.3px">${t}</h1>`;
const p = (t, size = 15) => `<p style="margin: 0; font-size: ${size}px; line-height: 1.5; color: ${C.muted}">${t}</p>`;
const stack = (inner, gap = 18) => `<div style="display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`;
const roundIcon = (name, bg, ink) => `<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 999px; align-items: center; justify-content: center; background: ${bg}; color: ${ink}">${icon(name, 24)}</span>`;

// A centred card on the sand ground — Wheelhouse's own full-page messages.
function centred(inner, { w = 440, brand = 'Wheelhouse' } = {}) {
  return `<div style="width: ${DW}px; height: ${DH}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; background: ${C.bg}">
<div style="display: flex; align-items: center; gap: 10px">${logoSlot(brand + ' logo')}<span style="font-size: 20px; font-weight: 700">${esc(brand)}</span></div>
${card(`<div style="padding: 32px; display: flex; flex-direction: column; gap: 18px">${inner}</div>`, `width: ${w}px`)}
</div>`;
}

export const screens = {};

// ---------- Staff: WorkOS's page (approximation) ----------
// Decision 2: WorkOS AuthKit, branded with what its settings allow — logo,
// colours, corner radius, a Google font (Public Sans), centred layout.
screens['workos-signin'] = {
  desktop: `<div style="position: relative; width: ${DW}px; height: ${DH}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; background: ${C.bg}">
<div style="display: flex; align-items: center; gap: 10px">${logoSlot('Wheelhouse logo')}<span style="font-size: 20px; font-weight: 700">Wheelhouse</span></div>
${card(`<div style="padding: 32px; display: flex; flex-direction: column; gap: 18px">
${h1('Sign in to Wheelhouse', 24)}
${field('Email', { type: 'email', value: 'jo@northstreetcycles.example' })}
${button('Continue', { block: true })}
<div style="display: flex; justify-content: center"><a href="#" style="font-size: 14px; font-weight: 600; color: ${C.ink}">Forgot your password?</a></div>
</div>`, 'width: 400px')}
<p style="position: absolute; left: 0; right: 0; bottom: 20px; margin: 0; text-align: center; font-size: 13px; color: ${C.muted}">Approximate look — this page is hosted by WorkOS and styled through its branding settings</p>
</div>`,
};

// ---------- Staff: Wheelhouse's own pages ----------
// Choose where you're working — tapping a site goes straight in (decision 6
// of journey A: fewer clicks; no Continue button).
const siteCard = (name, sub, last) => `<a href="#" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 64px; box-sizing: border-box; padding: 14px 16px; border-radius: 10px; border: 1px solid ${last ? C.ink : C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span><span style="display: inline-flex; align-items: center; gap: 8px">${last ? `<span style="font-size: 12px; font-weight: 600; color: ${C.muted}">Last time</span>` : ''}<span style="display: inline-flex; transform: rotate(-90deg)">${icon('chevron', 18)}</span></span></a>`;
screens['auth-site'] = {
  desktop: centred(stack(`${h1('Where are you working today?')}${p(`You work at more than one ${SHOP} site. Switch any time from the sidebar.`)}
${siteCard('Bolton', `${SHOP} · Till B1`, true)}
${siteCard('[Second site]', `${SHOP}`, false)}`, 14)),
};
screens['auth-signedout'] = {
  desktop: centred(stack(`${h1('You’ve signed out')}${p('Close this window, or sign in again.')}${button('Sign in again', { block: true })}`, 16)),
};
screens['auth-expired'] = {
  desktop: centred(stack(`${roundIcon('lock', C.warnBg, C.warnInk)}${h1('Please sign in again')}${p('You were signed out after a while without activity. Sign in and you’ll be back where you were.')}${button('Sign in again', { block: true })}`, 16)),
};
screens['auth-noaccess'] = {
  desktop: shellDesktop('today', 'Reports', `<div style="max-width: 520px">${card(`<div style="padding: 28px; display: flex; flex-direction: column; gap: 14px">${roundIcon('lock', C.mutedBg, C.muted)}${h1('Reports aren’t part of your role', 22)}${p('Your role is Staff. Reports are for owners and managers. Ask one of them if you need access.')}<div>${button('Go to Today', { variant: 'default' })}</div></div>`)}</div>`, { role: 'S', person: 'Jo Taylor', roleName: 'Staff' }),
};

// ---------- Till ----------
const tillFrame = (content, opts = {}) => `<div style="width: ${DW}px; height: ${DH}px; display: flex; flex-direction: column; background: ${C.bg}">${tillBar({ serving: null, ...opts })}<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 28px">${content}</main></div>`;

// Set up this till — a manager, signed in, turns this computer into a till.
// Site and till number as pills (Workshop day decisions 62, 66).
const pill = (t, on) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : 'transparent'}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`;
const pillGroup = (label, items) => `<div role="group" aria-label="${esc(label)}" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">${esc(label)}</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${items}</div></div>`;
screens['till-setup'] = {
  desktop: centred(stack(`${h1('Set up this till')}${p('Signed in as Jack Lewis (Manager). This computer becomes a till: it stays signed in, works offline, and staff check in with their PIN.')}
${pillGroup('Site', pill('Bolton', true) + pill('[Second site]', false))}
${pillGroup('Till number', pill('B1', true) + pill('B2', false) + pill('B3', false))}
${field('Name (optional)', { value: 'Front counter', hint: 'Receipts from this till are numbered B1-0001, B1-0002 and so on.' })}
${button('Make this computer Till B1', { block: true })}`, 16), { w: 480 }),
};

// Decision 4: PIN only — it says who you are. It checks the 4th digit at
// once (no OK button), and works without the internet (decision 3).
const key = (k, label = k) => `<button type="button"${label !== k ? ` aria-label="${label}"` : ''} style="min-height: 68px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; font-size: ${/^\d$/.test(k) ? 26 : 16}px; font-weight: 600; color: ${C.ink}">${k}</button>`;
const pinPad = `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => key(k)).join('')}${key('Clear')}${key('0')}${key('Delete', 'Delete the last digit')}</div>`;
const dots = (n) => `<div role="status" aria-label="${n} of 4 digits entered" style="display: flex; gap: 16px; justify-content: center">${[0, 1, 2, 3].map((i) => `<span style="width: 18px; height: 18px; border-radius: 999px; border: 2px solid ${C.ink}; background: ${i < n ? C.ink : 'transparent'}"></span>`).join('')}</div>`;
const checkedIn = (names) => `<div style="display: flex; flex-direction: column; gap: 10px"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">Checked in today</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${names.map((n) => `<span style="display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 12px 0 4px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.panel}; font-size: 14px; font-weight: 600"><span style="display: inline-flex; width: 28px; height: 28px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}; font-size: 12px; font-weight: 700">${n.split(' ').map((x) => x[0]).join('')}</span>${n}</span>`).join('')}</div></div>`;
screens['till-checkin'] = {
  desktop: tillFrame(`<div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px">
<div style="width: 360px; display: flex; flex-direction: column; gap: 20px; text-align: center">${h1('Enter your PIN', 28)}${p('Your PIN checks you in and puts your name on sales. It works even when the internet is down.')}${dots(2)}${pinPad}</div>
<div style="width: 360px">${checkedIn(['Alex Morgan'])}</div>
</div>`),
};

// ---------- Customers (decision 5) ----------
// On the shop's own website, in its theme: Wheelhouse's own "email me a
// code" screens; WorkOS sends and checks the six-digit code (valid 10
// minutes) behind the scenes. The booking-link pages (no sign-in) are the
// Release 1 designs and stay as they are.
const custCard = (inner) => `<div style="display: flex; justify-content: center; padding-top: 32px">${card(`<div style="padding: 32px; display: flex; flex-direction: column; gap: 18px">${inner}</div>`, 'width: 440px')}</div>`;
screens['cust-signin'] = {
  desktop: siteDesktop('sand', 'Account', custCard(`${h1('Sign in to your account')}${p('See your bookings, your bikes and past work. We’ll email you a code — no password needed.')}
${field('Email', { type: 'email', value: 'maya@example.com' })}
${button('Email me a code', { block: true })}
<div style="padding-top: 14px; border-top: 1px solid ${C.border}">${p('Just checking a booking? Open the link in your text or email — no sign-in needed.', 14)}</div>`)),
};
// Fewer clicks (journey A decision 6): the code checks itself when the 6th
// digit goes in, and a code pasted from the email fills all six boxes.
const codeBox = (d, i) => `<input aria-label="Digit ${i + 1} of 6" inputmode="numeric" maxlength="1" value="${d}" style="width: 48px; height: 56px; box-sizing: border-box; text-align: center; border-radius: 8px; border: 1px solid ${d === '' && i === 3 ? C.ink : C.input}; background: #ffffff; font-family: ${MONO}; font-size: 24px; color: ${C.ink}">`;
screens['cust-code'] = {
  desktop: siteDesktop('sand', 'Account', custCard(`${h1('Enter your code')}${p('We sent a 6-digit code to <strong style="color: ' + C.ink + '">maya@example.com</strong>. It works for 10 minutes. It signs you in as soon as the last digit goes in.')}
<div role="group" aria-label="Your 6-digit code" style="display: flex; gap: 8px">${['4', '8', '1', '', '', ''].map(codeBox).join('')}</div>
<div style="display: flex; justify-content: space-between; gap: 12px"><a href="#" style="font-size: 14px; font-weight: 600; color: ${C.ink}">Send a new code</a><a href="#" style="font-size: 14px; font-weight: 600; color: ${C.ink}">Use a different email</a></div>`)),
};

export const TITLES = {
  'workos-signin': 'Sign in — WorkOS’s page, approximate look',
  'auth-site': 'Where are you working today? (tap a site to go straight in)',
  'auth-signedout': 'Signed out',
  'auth-expired': 'Signed out after a while — sign in again',
  'auth-noaccess': 'Not part of your role',
  'till-setup': 'Set up this till (manager)',
  'till-checkin': 'Till check-in — PIN only',
  'cust-signin': 'Customer sign-in on the shop’s website — email me a code',
  'cust-code': 'Customer sign-in — enter the code (checks itself on the 6th digit)',
};

export const ROWS = [
  { label: 'Staff sign-in (WorkOS)', screens: ['workos-signin'] },
  { label: 'Staff access', screens: ['auth-site', 'auth-signedout', 'auth-expired', 'auth-noaccess'] },
  { label: 'Till', screens: ['till-setup', 'till-checkin'] },
  { label: 'Customers', screens: ['cust-signin', 'cust-code'] },
];
