// Journey 21 — Lightspeed shops, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-02-lightspeed-shops-review.md
//
// A shop that keeps Lightspeed as its till. Decision 1: the workshop only,
// Lightspeed doing the money. 2: Wheelhouse shows when the linked work
// order is paid. 3: the work order is made automatically on approval. 4:
// customers linked by Wheelhouse where it's sure, by staff when it isn't.
// 5: quote parts come from Lightspeed's products. 6: when Lightspeed can't
// be reached the workshop carries on and Wheelhouse catches up by itself.
// 7: the owner connects Lightspeed in Settings with a checklist. 8: labour
// priced in Wheelhouse, sent as labour lines. 9: no money through
// Wheelhouse for these shops.
//
// Real example data only: North Street Cycles, Bolton, Jack Lewis (Owner),
// Jo Taylor (Staff), Alex Morgan (Mechanic), Maya Patel with WH-1042 (Trek
// Domane AL 3, Standard service, approved total £111.00), Shimano brake pads
// B05S-RX £28.00. Lightspeed's own names, numbers and products are
// bracketed placeholders; Lightspeed's sign-in page is not drawn (it is
// Lightspeed's, not ours).
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone, settingsPage, lsFolds, LS_INTRO, workshopFolds, WORKSHOP_INTRO } from './settings-frame.mjs';
import { today } from './opening.mjs';
import { jobVariant, quoteJobBoards, phoneStagePanel, footNote, handOverFooter } from './diary.mjs';
import { panel as jpPanel, row as jpRow, mono as jpMono } from './job-page.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { withLightspeedShop } from './shop-mode.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
let SIZE = 'desktop';
const OWNER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' };
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const tall = 'display: inline-flex; align-items: center; min-height: 44px';
const WO = 'work order [number]';
const msg = (t, tone = 'ok', live = false) => `<p${live ? ' role="status"' : ''} style="margin: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: ${tone === 'ok' ? C.okBg : tone === 'warn' ? C.warnBg : C.mutedBg}; color: ${tone === 'ok' ? C.successInk : tone === 'warn' ? C.warnInk : C.ink}; font-size: 15px; line-height: 1.45">${icon(tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'store', 18)}<span>${t}</span></p>`;
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 44px; border-top: 1px solid ${C.border}; font-size: 15px"><span>${k}</span><span style="text-align: right">${v}</span></div>`;
const radio = (name, on, sub, group) => `<label style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; border: ${on ? 2 : 1}px solid ${on ? C.ink : C.border}; background: ${C.panel}; cursor: pointer"><input type="radio" name="${group}"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">${name}</span>${sub ? `<span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span>` : ''}</span></label>`;
const group = (legend, inner) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 15px; font-weight: 700; padding: 0 0 6px">${legend}</legend>${inner}</fieldset>`;
const selectBox = (id, label, value) => `<div style="display: flex; flex-direction: column; gap: 6px"><label id="${id}-l" for="${id}" style="font-size: 14px; font-weight: 600">${label}</label><button id="${id}" type="button" aria-haspopup="listbox" aria-labelledby="${id}-l ${id}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}">${value}${icon('chevron', 14)}</button></div>`;
const steps = (at) => `<ol aria-label="Steps" style="margin: 0; padding: 0; display: flex; gap: 6px">${['Sign in to Lightspeed', 'Shops and staff', 'Check it works'].map((s, i) => `<li${i === at ? ' aria-current="step"' : ''} style="list-style: none; flex: 1; padding: 6px 10px; border-radius: 8px; border: ${i === at ? 2 : 1}px solid ${i === at ? C.ink : C.border}; background: ${i < at ? C.mutedBg : C.panel}; font-size: 13px; font-weight: 700; color: ${i <= at ? C.ink : C.muted}">${i < at ? '✓ ' : `${i + 1} · `}${s}</li>`).join('')}</ol>`;

// ---------- Settings › Office › Lightspeed (decision 7) ----------
const lsSettings = (open, opts = {}) => settingsPage('lightspeed', 'Lightspeed', LS_INTRO, lsFolds(open), { who: OWNER, ...opts });
const offOpen = () => `<p style="margin: 0; font-size: 15px; line-height: 1.5">Connect the Lightspeed till this shop uses. Wheelhouse then reads your products and stock, finds and adds customers, makes a work order for each approved job, and sees when it's paid. It never takes, refunds or changes money in Lightspeed.</p><div>${button('Connect Lightspeed')}</div>${note('Only the owner can connect or disconnect Lightspeed.')}`;
const connOpen = () => `${kv('Lightspeed account', '[Lightspeed account name]')}${kv('Connected by', 'Jack Lewis · [date]')}${kv('Last checked', '[n] seconds ago')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('Check now', { variant: 'default' })}${button('Disconnect…', { variant: 'ghost' })}</div>${note('Disconnecting stops sending to Lightspeed. Jobs, quotes and the diary stay in Wheelhouse.')}`;
const CHECKS = [
  ['Read products and stock', true, '[n] products · checked [n] seconds ago'],
  ['Find customers', true, ''],
  ['Add customers', true, 'For customers Lightspeed doesn’t have yet'],
  ['Make and update work orders', true, 'Tested with a practice work order, then removed'],
  ['See when a work order is paid', false, 'Not available on this Lightspeed account. Staff tick “Paid in Lightspeed” when they hand a bike over instead.'],
];
const checkList = () => `<ul style="margin: 0; padding: 0; display: flex; flex-direction: column">${CHECKS.map(([t, ok, sub]) => `<li style="list-style: none; display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="flex-shrink: 0; display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; border-radius: 999px; background: ${ok ? C.okBg : C.warnBg}; color: ${ok ? C.successInk : C.warnInk}">${icon(ok ? 'check' : 'alert', 15)}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">${t}${ok ? '' : ' — not working'}</span>${sub ? `<span style="font-size: 14px; color: ${C.muted}; line-height: 1.45">${sub}</span>` : ''}</span></li>`).join('')}</ul>`;
const shopsOpen = () => `${selectBox('ls-shop', 'Bolton in Wheelhouse is, in Lightspeed', '[Lightspeed shop]')}`;
const STAFF = [['Jack Lewis', '[Lightspeed employee]'], ['Jo Taylor', '[Lightspeed employee]'], ['Alex Morgan', '[Lightspeed employee]']];
const staffList = (unmatched = false) => `<div style="display: flex; flex-direction: column">${STAFF.map(([n, l], i) => { const miss = unmatched && i === 2; return `<div style="display: grid; grid-template-columns: ${isPhone() ? '1fr' : '160px 1fr'}; gap: 6px 12px; align-items: center; padding: 8px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; font-weight: 700">${n}</span>${miss ? `<span style="display: flex; flex-direction: column; gap: 4px">${selectBox(`ls-emp-${i}`, `${n} in Lightspeed`, 'Choose…')}<span style="font-size: 13px; color: ${C.warnInk}">No one in Lightspeed with this name</span></span>` : `<span style="font-size: 15px">${l} ${badge('Matched by name', 'green')}</span>`}</div>`; }).join('')}</div>`;

// The guided start: a pop-up over the settings page.
const startSignin = () => popup('ls1-title', 'Connect Lightspeed', 'North Street Cycles', `${steps(0)}<p style="margin: 0; font-size: 15px; line-height: 1.5">Lightspeed opens in a new tab. Sign in there as the account owner and allow Wheelhouse to:</p><ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.7"><li>read products and stock</li><li>find and add customers</li><li>make and update work orders</li><li>see when a work order is paid</li></ul>${msg('Wheelhouse never takes, refunds or changes money in Lightspeed.', 'grey')}`, `${button('Cancel', { variant: 'ghost' })}${button('Continue to Lightspeed')}`, 560);
const startShops = () => popup('ls2-title', 'Connect Lightspeed', 'Signed in as [Lightspeed account name]', `${steps(1)}${shopsOpen()}${group('Staff on work orders', `${note('So each work order shows who did the job.')}${staffList(true)}`)}`, `${button('Back', { variant: 'ghost' })}${button('Next')}`, 600);
const startChecks = () => popup('ls3-title', 'Connect Lightspeed', 'Checking what works', `${steps(2)}${checkList()}${msg('<strong>4 of 5 working.</strong> Everything else is ready — you can start using it now.', 'ok', true)}`, `${button('Check again', { variant: 'ghost' })}${button('Done')}`, 600);

// ---------- Jobs (decisions 2, 3, 4, 5, 6) ----------
// Lightspeed strips on the approved job, desktop / tablet and phone.
const strip = (b, main, side = '') => () => jpPanel(`${jpRow(`${b}<span style="font-size: 13px; font-weight: 700">${main}</span><span style="flex-grow: 1"></span>${side ? `<span style="font-size: 12px; color: ${C.muted}">${side}</span>` : ''}`, 8)}`, '', 6, 3);
const phoneTop = (b, main, side = '') => () => phoneStagePanel(`<div style="display: flex; align-items: center; gap: 8px">${b}<span style="font-size: 15px; font-weight: 700">${main}</span></div>${side ? `<span style="font-size: 13px; color: ${C.muted}">${side}</span>` : ''}`);
const JOBS = {
  sent: [badge('In Lightspeed', 'blue'), `${WO} · ${jpMono('£111.00')}`, 'Made when Maya approved · updated [time]'],
  waitReach: [badge('Waiting to reach Lightspeed', 'amber'), 'Not sent yet', 'Wheelhouse keeps trying by itself · since [time]'],
  unpaid: [badge('Waiting to be paid in Lightspeed', 'amber'), `${jpMono('£111.00')} · ${WO}`, 'Maya pays at the Lightspeed till'],
  paid: [badge('Paid in Lightspeed', 'green'), `${jpMono('£111.00')} · [time]`, WO],
  pick: [badge('Not sent yet', 'amber'), 'Which customer in Lightspeed?', 'Sends as soon as Maya is picked'],
  fallback: [badge('In Lightspeed', 'blue'), `${jpMono('£111.00')} · ${WO}`, 'Take payment at the Lightspeed till'],
};
const job = (status, tone, k, footer) => { const [b, m, s] = JOBS[k]; return jobVariant(status, tone, strip(b, m, s), phoneTop(b, m, s), footer); };
const plainFooter = (t, sub) => (size) => `${button(t, { variant: 'primary', block: true })}${footNote(sub, size)}`;
const fallbackFooter = (size) => `<label style="display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; flex-shrink: 0"><input type="checkbox" style="width: 20px; height: 20px; margin: 0; accent-color: ${C.accent}"><span style="font-size: 14px; font-weight: 600">Paid in Lightspeed</span></label>${handOverFooter(size)}`;
const jobAt = (k) => withLightspeedShop(() => ({
  sent: () => job('In the workshop', 'blue', 'sent', plainFooter('Mark ready for collection', 'Tells Maya her bike is ready.')),
  pick: () => job('In the workshop', 'blue', 'pick', plainFooter('Mark ready for collection', 'Tells Maya her bike is ready.')),
  waitReach: () => job('In the workshop', 'blue', 'waitReach', plainFooter('Mark ready for collection', 'Tells Maya her bike is ready.')),
  unpaid: () => job('Ready for collection', 'green', 'unpaid', (size) => handOverFooter(size)),
  paid: () => job('Ready for collection', 'green', 'paid', (size) => handOverFooter(size)),
  fallback: () => job('Ready for collection', 'green', 'fallback', fallbackFooter),
})[k]())[SIZE];

// Decision 5: the part search reads Lightspeed's products.
const PRODUCTS = [
  ['Shimano brake pads B05S-RX', '£28.00', '3 in stock'],
  ['[Product]', '£[£]', '0 in stock · [n] on order'],
  ['[Product]', '£[£]', '[n] in stock'],
];
const partSearch = () => popup('ps-title', 'Add a part', 'From Lightspeed’s products · checked 40 seconds ago', `<div style="display: flex; flex-direction: column; gap: 6px"><label for="ps-q" style="font-size: 14px; font-weight: 600">Search products</label><input id="ps-q" value="brake pads" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}"></div><ul aria-label="Products" style="margin: 0; padding: 0">${PRODUCTS.map(([n, p, s], i) => `<li style="list-style: none"><button type="button" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 12px; align-items: center; width: 100%; min-height: 52px; padding: 6px 4px; border: 0; border-top: 1px solid ${C.border}; background: ${i === 0 ? C.mutedBg : 'transparent'}; text-align: left; font-family: inherit; color: ${C.ink}"><span style="font-size: 15px; font-weight: 600">${n}</span>${mono(p, 'font-size: 14px')}<span style="font-size: 13px; color: ${C.muted}; white-space: nowrap">${s}</span></button></li>`).join('')}</ul>${note('Prices and stock come from Lightspeed. Labour is priced here, in Settings › Workshop.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Add to the quote')}`, 620);

// Decision 4: several possible matches — staff pick once.
const customerPick = () => popup('cp-title', 'Which Maya Patel in Lightspeed?', 'WH-1042 is ready to go to Lightspeed', `${note('Wheelhouse found more than one possible match. Pick once — the link stays for Maya’s next jobs.')}${group('Lightspeed customers', `${radio('Maya Patel', true, `${mono('07700 900 142')} · maya@example.test · customer since [date]`, 'cp')}${radio('M. Patel', false, `${mono('[phone]')} · no email`, 'cp')}${radio('None of these — add Maya to Lightspeed', false, '', 'cp')}`)}`, `${button('Not now', { variant: 'ghost' })}${button('Link and send')}`, 560);

// Decision 6: a send that may or may not have arrived.
const checkInLs = () => popup('ck-title', 'Check this in Lightspeed', 'WH-1042 · Maya Patel', `${msg('<strong>Not sure the work order arrived.</strong> Lightspeed stopped answering while it was being sent, and Wheelhouse couldn’t find it afterwards. It won’t send it again until you’ve looked.', 'warn', true)}${field('Work order number in Lightspeed', { value: '', placeholder: 'If you find it', hint: 'Look for WH-1042 · Maya Patel · £111.00 in Lightspeed’s work orders' })}`, `${button('It isn’t there — send it', { variant: 'ghost' })}${button('Link this work order')}`, 560);

// Decision 2: handing over a bike Lightspeed hasn't shown as paid.
const handOverUnpaid = () => popup('hu-title', 'Not paid in Lightspeed yet', 'WH-1042 · Maya Patel · £111.00', `<p style="margin: 0; font-size: 15px; line-height: 1.5">Lightspeed hasn’t shown ${WO} as paid. If Maya has just paid, it can take up to a minute to show here.</p><div>${button('Check Lightspeed now', { variant: 'default' })}</div>`, `${button('Not yet', { variant: 'ghost' })}${button('Hand over anyway')}`, 520);

// ---------- Settings › Workshop: no deposits (decision 9) ----------
const workshopNoMoney = () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({}), { who: OWNER, banner: msg('<strong>Deposits and paying online are off.</strong> With Lightspeed, customers pay at the Lightspeed till — Wheelhouse takes no money.', 'grey') });

// ---------- What the customer sees (decision 9) ----------
const back = (t) => `<a href="#" style="${tall}; align-self: flex-start; gap: 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const customerReady = () => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px"><div style="width: 100%; max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${back('Your account')}<h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Your bike is ready</h1>${note('WH-1042 · Trek Domane AL 3 · North Street Cycles, Bolton')}${card(`<div style="padding: 18px; display: flex; flex-direction: column; gap: 10px">${kv('Standard service, brake pads, brake fitting', mono('£111.00'))}${kv('<strong>To pay when you collect</strong>', `<strong>${mono('£111.00')}</strong>`)}${note('Pay in the shop when you collect. Open [opening hours].')}<div style="display: flex; flex-wrap: wrap; gap: 10px">${button('See what we did', { variant: 'default' })}${button('Ask the shop a question', { variant: 'default' })}</div></div>`)}</div></div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Account', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Account') : sitePhone('sand', { content: body });
};

// ---------- The boards ----------
const ls = (id, fn) => def(id, () => withLightspeedShop(fn));
ls('ls-settings-off', () => lsSettings({ off: true, connection: offOpen() }));
ls('ls-connect-signin', () => overlay(lsSettings({ off: true, connection: offOpen() }), startSignin()));
ls('ls-connect-shops', () => overlay(lsSettings({ off: true, connection: offOpen() }), startShops()));
ls('ls-connect-checks', () => overlay(lsSettings({ off: true, connection: offOpen() }), startChecks()));
ls('ls-settings-on', () => lsSettings({ connection: connOpen(), checks: checkList() }));
const asOwner = (h) => h.replace('Checked in at [time] · Manager', 'Checked in at [time] · Owner');
ls('ls-today', () => asOwner(today({ lightspeed: true, as: OWNER })));
ls('ls-part-search', () => overlay(quoteJobBoards('build')[SIZE], partSearch()));
ls('ls-job-sent', () => jobAt('sent'));
ls('ls-customer-pick', () => overlay(jobAt('pick'), customerPick()));
ls('ls-job-waiting', () => jobAt('waitReach'));
ls('ls-job-check', () => overlay(jobAt('waitReach'), checkInLs()));
ls('ls-today-down', () => asOwner(today({ lightspeed: true, lsDown: true, as: OWNER })));
ls('ls-job-unpaid', () => jobAt('unpaid'));
ls('ls-hand-over-unpaid', () => overlay(jobAt('unpaid'), handOverUnpaid()));
ls('ls-job-paid', () => jobAt('paid'));
ls('ls-job-fallback', () => jobAt('fallback'));
ls('ls-workshop-settings', () => workshopNoMoney());
ls('ls-customer-ready', () => customerReady());

const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ls-settings-off': 'Settings › Office › Lightspeed: not connected',
  'ls-connect-signin': 'Connect Lightspeed: sign in on Lightspeed’s page',
  'ls-connect-shops': 'Connect Lightspeed: which shop, and staff on work orders',
  'ls-connect-checks': 'Connect Lightspeed: what works',
  'ls-settings-on': 'Settings › Office › Lightspeed: connected',
  'ls-today': 'Today for a Lightspeed shop',
  'ls-part-search': 'Add a part: Lightspeed’s products, price and stock',
  'ls-job-sent': 'Approved: the work order made in Lightspeed',
  'ls-customer-pick': 'Which customer in Lightspeed? Picked once',
  'ls-job-waiting': 'Waiting to reach Lightspeed',
  'ls-job-check': 'Check this in Lightspeed',
  'ls-today-down': 'Today: can’t reach Lightspeed',
  'ls-job-unpaid': 'Ready: waiting to be paid in Lightspeed',
  'ls-hand-over-unpaid': 'Hand over before it’s paid in Lightspeed',
  'ls-job-paid': 'Paid in Lightspeed',
  'ls-job-fallback': 'If Lightspeed can’t show payment: tick “Paid in Lightspeed”',
  'ls-workshop-settings': 'Settings › Workshop: no deposits or paying online',
  'ls-customer-ready': 'The customer’s “Your bike is ready”: pay when you collect',
};
export const ROWS = [
  { label: 'Connecting Lightspeed', screens: ['ls-settings-off', 'ls-connect-signin', 'ls-connect-shops', 'ls-connect-checks', 'ls-settings-on'] },
  { label: 'Quote and approval', screens: ['ls-today', 'ls-part-search', 'ls-job-sent', 'ls-customer-pick'] },
  { label: 'When Lightspeed can’t be reached', screens: ['ls-job-waiting', 'ls-job-check', 'ls-today-down'] },
  { label: 'Payment and collection', screens: ['ls-job-unpaid', 'ls-hand-over-unpaid', 'ls-job-paid', 'ls-job-fallback', 'ls-workshop-settings', 'ls-customer-ready'] },
];
