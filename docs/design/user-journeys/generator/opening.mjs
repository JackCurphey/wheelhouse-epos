// Journey 10 — Opening the shop and checking in, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-30-opening-the-shop-review.md
// UI audit: docs/design/user-journeys/opening-ui-audit.md
//
// Decision 2: the first person to check in gets a one-tap float check;
// "Count it" opens the note-and-coin count from cash-up. Decision 3: Office ›
// Today is the start-of-day overview for owners and managers — Tills, Who's
// in, Workshop today, Needs attention. Real example data only: North Street
// Cycles, Bolton, Till B1, Jo Taylor, Alex Morgan, Jack Lewis, and the
// Workshop Overview's example day (Thursday 17 September: 8 bikes expected,
// 3 still to arrive, 4 ready to collect; WH-1042 Maya Patel, WH-1045 Jamie
// Brooks at 10:30, WH-1047 Aisha Khan dropping off). Everything else is a
// bracketed placeholder.
import { C, MONO, esc, icon, button, card } from './ui.mjs';
import { page, note, popup, overlay, withSize, isPhone } from './settings-frame.mjs';
import { screens as tillScreens } from './till.mjs';
import { closeUncounted } from './cashup.mjs';
import { withLightspeedShop } from './shop-mode.mjs'; // UX walk-through 6 M1

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const MANAGER = { role: 'O', person: 'Jack Lewis', roleName: 'Owner' }; // UX walk-through 2 (decision 6): Jack Lewis is the Owner

// The till just after Jo checks in: journey 11's empty sale screen, with Jo
// serving (journey B: PIN check-in).
const tillBase = () => tillScreens['till-empty'][SIZE];

// ---------- Decision 2: the one-tap float check ----------
// No ✕ (audit M1): both ways out are answers, so Today's "float checked by"
// is always true.
// UX walk-through 2 M1: it goes to the first person to check in whose role
// takes payments (Staff, Manager, Owner) — a mechanic checking in only
// records his time. H1(b): `unclosed` — nobody counted Wednesday, so the
// drawer should hold the float plus Wednesday's cash, and this count becomes
// Wednesday's count.
// UX walk-through 2 (decision 6): for a day nobody counted, "Count it" is the
// only way out — "Looks right" would make Wednesday's figure what the till
// expected rather than a real count.
// UX walk-through 4 M4: `first` — the first real morning after switch-over.
// Nothing has been counted in Wheelhouse before, so "Count it" is the only
// way out, as for a day nobody counted.
const floatCheck = (unclosed = false, first = false) => popup('fc-title', 'Hello, Jo', first ? 'Till B1 · first in on the first day on Wheelhouse' : 'Till B1 · first in today to take payments', first ? `
<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 0; text-align: center"><span style="font-size: 15px; color: ${C.muted}">The drawer should have</span>${mono('[£ float]', 'font-size: 30px')}<span style="font-size: 14px; color: ${C.muted}">The shop’s float</span></div>
${note('This is the first day the till takes real money, and nothing has been counted in Wheelhouse before. Count the float once, so today starts from a real figure.')}` : unclosed ? `
<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 0; text-align: center"><span style="font-size: 15px; color: ${C.muted}">The drawer should have</span>${mono('[£ float]', 'font-size: 30px')}<span style="font-size: 15px; color: ${C.muted}">plus Wednesday’s cash</span>${mono('[£]', 'font-size: 30px')}</div>
${note('Wednesday 16 September wasn’t counted, so its cash is still in the drawer. Count it now — your count becomes Wednesday’s count, so it needs real numbers, not a quick look.')}` : `
<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 0; text-align: center"><span style="font-size: 15px; color: ${C.muted}">The drawer should have</span>${mono('[£ float]', 'font-size: 30px')}<span style="font-size: 14px; color: ${C.muted}">The shop’s float</span></div>
${note('Have a quick look. If it doesn’t look right, count it — it only takes a minute.')}`, unclosed || first ? button('Count it') : `${button('Count it', { variant: 'default' })}${button('Looks right')}`, 480, { close: false });

// "Count it": the cash-up count (journey 16 decision 3) — a box for each note
// and coin, adding up to a total that can be typed over. Blind counting is on
// for a new shop (Owner setup decision 6), so the expected float isn't shown
// here; "Done counting" stays off until a box has a number (audit H1).
const DENOMS = ['£50', '£20', '£10', '£5', '£2', '£1', '50p', '20p', '10p', '5p', '2p', '1p'];
const denomGrid = () => `<div role="group" aria-label="Count each note and coin" style="display: grid; grid-template-columns: repeat(${isPhone() ? 2 : 4}, minmax(0, 1fr)); gap: 8px">${DENOMS.map((d) => `<label style="display: flex; align-items: center; gap: 8px; min-height: 52px; box-sizing: border-box; padding: 4px 10px; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}"><span style="min-width: 34px; font-size: 15px; font-weight: 700">${d}</span><span style="font-size: 13px; color: ${C.muted}">×</span><input inputmode="numeric" aria-label="Number of ${d}" style="width: 48px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"></label>`).join('')}</div>`;
const totalRow = (k, v, { strong = false, first = false, warn = false } = {}) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 8px 0; ${first ? '' : `border-top: 1px solid ${C.border}`}"><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px; ${strong ? 'font-weight: 700' : ''}; ${warn ? `color: ${C.warnInk}` : ''}">${warn ? icon('alert', 16) : ''}${k}</span>${mono(v, `font-size: ${strong ? 20 : 15}px`)}</div>`;
const offButton = (t) => button(t).replace(/^<(\w+)/, '<$1 disabled aria-disabled="true"').replace('style="', 'style="opacity: 0.45; cursor: not-allowed; ');
const floatCount = () => popup('cnt-title', 'Count the float', 'Till B1 · count every note and coin', `${denomGrid()}
${totalRow('Counted', '[£ counted]', { strong: true })}`, `${button('Back', { variant: 'default' })}${offButton('Done counting')}`, 720);

// The count matches: the pop-up closes, the till is ready, and a short
// "Float checked" message shows (audit H1).
const matched = () => `<div style="position: relative">${tillBase()}<div role="status" style="position: absolute; ${isPhone() ? 'left: 12px; right: 12px; bottom: 112px' : 'left: 50%; bottom: 24px; transform: translateX(-50%)'}; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 10px; background: ${C.ink}; color: #ffffff; font-size: 14px; box-shadow: 0 8px 24px rgba(38,36,32,0.25)">${icon('check', 16)}Float checked · Till B1 · counted by Jo Taylor</div></div>`;

// A difference: say so, ask why (optional). Short always goes to Needs
// attention; over only when yesterday was closed (audit H1 — otherwise
// "wasn't closed" already explains it).
const floatDiff = (over = false) => popup('diff-title', `The float is ${over ? 'over' : 'short'}`, 'Till B1 · counted by Jo Taylor', `
<div>${totalRow('Should have', '[£ float]', { first: true })}${totalRow('Counted', '[£ counted]')}${totalRow('Difference', `[£] ${over ? 'over' : 'short'}`, { strong: true, warn: true })}</div>
<div style="display: flex; flex-direction: column; gap: 6px"><label for="diff-why" style="font-size: 14px; font-weight: 600">Any idea why? <span style="font-weight: 400; color: ${C.muted}">(optional)</span></label><input id="diff-why" placeholder="[reason]" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"></div>
${note('A manager sees this on Today. The till starts with what you counted.')}`, `${button('Count again', { variant: 'default' })}${button('Start the day')}`, 520, { close: false }); // UX walk-through 2 L3: no ✕ — both ways out are answers

// ---------- Decision 3: Office › Today ----------
// Each card is a labelled section and its rows a list, so a screen reader
// can move between them (audit L4).
const slug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const section = (title, body, action = '', count = 0) => `<section aria-labelledby="t-${slug(title)}" style="display: flex; flex-direction: column; flex-shrink: 0">${card(`<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 8px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><h2 id="t-${slug(title)}" style="margin: 0; font-size: 17px; font-weight: 700">${title}${count ? ` · ${count}` : ''}</h2>${action}</div>${body}</div>`)}</section>`;
const list = (items) => `<div role="list">${items.join('')}</div>`;
const line = (left, sub, right = '', lead = '') => `<div role="listitem" style="display: flex; align-items: center; gap: 12px; min-height: 52px; box-sizing: border-box; padding: 8px 0; border-top: 1px solid ${C.border}">${lead}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${left}</span>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</span>${right}</div>`;
const warnLead = `<span style="display: inline-flex; color: ${C.warnInk}" aria-hidden="true">${icon('alert', 18)}</span>`;
const tag = (t, tone = 'ok') => { const [bg, ink] = tone === 'ok' ? [C.okBg, C.successInk] : tone === 'warn' ? [C.warnBg, C.warnInk] : [C.mutedBg, C.muted]; return `<span style="display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border-radius: 999px; background: ${bg}; color: ${ink}; font-size: 12px; font-weight: 700; white-space: nowrap">${tone === 'ok' ? icon('check', 13) : tone === 'warn' ? icon('alert', 13) : ''}${t}</span>`; };
const stat = (k, v, sub) => `<div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}"><span style="font-size: 13px; color: ${C.muted}">${k}</span><span style="font-size: 20px; font-weight: 700">${v}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></div>`;
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
// Decision 4: Staff see Who's in and Workshop today; Tills and Needs
// attention are for owners, managers and anyone with "Can close the day".
// Decision 6: someone due in who hasn't checked in just shows — "Not in yet",
// then "Late" once their start time has passed. No alert, no Needs attention.
// Decision 7: if last night's day was never closed, the till still opens with
// the usual float check; "Wednesday 16 September wasn't closed" goes to Needs
// attention. Audit H2: sales waiting to send go there too (after [n] minutes);
// H3: "Seen" clears a short float in one click.
// Journey 9 decision 3 (refresh): while a shop runs alongside Citrus Lime,
// the weekly "Time to refresh" reminder joins Needs attention for the owner.
// UX walk-through 4 M4: `practice` — while the shop runs alongside Citrus
// Lime, the till is in practice: no float check, no Close the day.
export function today({ practice = false, banked = false, short = false, seen = false, waiting = false, staff = false, late = false, unclosed = false, refresh = false, uncollected = false, restock = false, adjusted = false, below = false, transferShort = false, noAnswer = false, replies = false, deleteRequest = false, arrived = false, accounts = false, onlineNew = false, onlineUncollected = false, payMore = false, watch = false, c2w = false, c2wHoldEnded = false, c2wDeposit = false, lightspeed = false, lsDown = false, lsPerson = false, lsUnpaid = false, productToAdd = false, otherShops = false, as = null } = {}) {
  const tillTag = waiting ? tag('[n] sales waiting to send', 'warn') : seen ? tag('Float short · seen by Jack Lewis', 'grey') : short ? tag('Float short', 'warn') : tag('All sales sent');
  // UX walk-through 2 H1(a): Wednesday counted and banked at night while its
  // sales were still waiting; it closes by itself once they've sent.
  const tills = practice ? section('Tills', list([line('Till B1', 'Practice until switch-over · the drawer isn’t counted', tag('Practice', 'grey'))])) : section('Tills', list([line('Till B1', `Open · float checked by Jo Taylor at [time]`, banked ? tag('[n] sales waiting to send', 'warn') : tillTag), ...(banked ? [line('Wednesday counted and banked · waiting for [n] sales to send', 'Till B1 · Wednesday 16 September closes by itself once they’ve sent', tag('Closes by itself', 'grey'))] : [])]));
  // UX walk-through 2 M1: Alex checked in first (the PIN screen shows him);
  // as a Mechanic he wasn't asked about the float. `late` keeps the example
  // of someone due in who hasn't come.
  const who = section('Who’s in', list([line('Jo Taylor', 'Checked in at [time] · Staff', tag('In')), late ? line('Alex Morgan', 'Due in at [start time] · Mechanic', tag('Late', 'grey')) : line('Alex Morgan', 'Checked in at [time] · Mechanic', tag('In')), line('Jack Lewis', 'Checked in at [time] · Owner', /* UX walk-through 2 (decision 6) */ tag('In'))]));
  // UX walk-through 6 L5: on Lightspeed boards WH-1042 is past book-in (it
  // needs its customer chosen), so it isn't in "Still to arrive".
  const work = section('Workshop today', `<div style="display: grid; grid-template-columns: repeat(${isPhone() ? 1 : 2}, minmax(0, 1fr)); gap: 8px">${stat('Expected today', '8 bikes', noAnswer || arrived || lightspeed ? '2 still to arrive' : '3 still to arrive')}${stat('Repairs ready to collect', '4', 'In the workshop now')}</div>
<h3 style="margin: 6px 0 0; font-size: 14px; font-weight: 700">Still to arrive</h3>
${list([line('WH-1045 · Jamie Brooks', 'Giant Escape 2 · Gear adjustment', `<span style="font-size: 14px">${mono('10:30')} appointment</span>`), line('WH-1047 · Aisha Khan', 'Cannondale Quick · Safety check', '<span style="font-size: 14px">Drop-off</span>'), ...(noAnswer || arrived || lightspeed /* UX walk-through 6 L5 */ ? [] : [line('WH-1042 · Maya Patel', 'Trek Domane AL 3 · Standard service', `<span style="display: inline-flex; align-items: center; gap: 10px; white-space: nowrap"><span style="font-size: 14px">${mono('11:30')} appointment</span>${button('Book in', { variant: 'default' })}</span>`)])])}`, `<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Open the diary</a>`);
  const items = [
    short && !seen && line('Till B1’s float was [£] short this morning', 'Counted by Jo Taylor at [time] · “[their reason]”', button('Seen', { variant: 'default' }), warnLead),
    // UX walk-through 2 H1(b): the morning's float check counted Wednesday's
    // cash with the float, so what's left is banking.
    unclosed && line('Wednesday 16 September wasn’t closed', 'Till B1 · counted with this morning’s float by Jo Taylor · still to bank', button('Close it', { variant: 'default' }).replace('style="', 'style="white-space: nowrap; '), warnLead),
    // Journey 5 decision 4: a ready bike left too long.
    // WH-1050 is the diary's oldest ready job (Mon 14 Sep).
    // Journey 5 audit H4: the number is on the line; "Contacted" records it.
    // The line goes by itself when the bike is handed over.
    // Drop off and approve the quote decision 4: still no answer after the
    // reminder; "Record their answer" takes a phone answer.
    noAnswer && line('WH-1042 · Maya Patel — no answer to the quote yet', `Sent [time] · reminder sent [time] · <a href="tel:07700900142" style="color: inherit; white-space: nowrap">${mono('07700 900 142')}</a>`, button('Record their answer', { variant: 'default' }), warnLead),
    // Account, history and reminders decision 7: customers waiting for a
    // reply; decision 4: a request to delete an account, for staff to confirm.
    // Reports and accounts decision 4: a day that couldn't go to the accounts software.
    // Website management (journey 18, audit H5): the payment provider needs
    // more details from the shop, or online payments stop.
    // Management oversight (journey 20) decision 2: alerts above amounts the
    // shop sets; "Seen" clears them, and each opens the activity log.
    // Owners and managers only (journey 20 audit H4). At a till the name is
    // whoever's PIN was last typed (H1); buttons say what they open (M8).
    watch && line('£[£] discount on Sale [sale number] — Till B1, while Jo Taylor was checked in', '“[reason]” · over £[amount] · [n] of today’s [n] sales on Till B1 had a discount', `<span style="display: inline-flex; flex-direction: column; gap: 6px; white-space: nowrap">${button('Seen', { variant: 'default' }).replace('<button', '<button aria-label="Seen: discount on Sale [sale number]"')}${button('Open the sale', { variant: 'default' })}</span>`, warnLead),
    watch && line('[n] voids on Till B1 today — while Jo Taylor was checked in', 'More than [n] · last: “[reason]” at [time] · [n] sales on Till B1 today', `<span style="display: inline-flex; flex-direction: column; gap: 6px; white-space: nowrap">${button('Seen', { variant: 'default' }).replace('<button', '<button aria-label="Seen: voids on Till B1"')}${button('See the voids', { variant: 'default' })}</span>`, warnLead),
    // UX walk-through 7 M4: £28.00 is the price at every shop (Multiple sites
    // 2-3), so the change is tagged "All shops", this alert shows once on each
    // shop's Today, and one "Seen" clears it everywhere.
    watch && line(`Shimano brake pads B05S-RX now sell below cost ${tag('All shops', 'grey')}`, `Jack Lewis changed it at [time] · <span style="white-space: nowrap">£28.00 → £[£]</span> · <span style="white-space: nowrap">cost £[£]</span> · Seen clears it at every shop`, `<span style="display: inline-flex; flex-direction: column; gap: 6px; white-space: nowrap">${button('Seen', { variant: 'default' }).replace('<button', '<button aria-label="Seen: Shimano brake pads below cost, at every shop"')}${button('Open the product', { variant: 'default' })}</span>`, warnLead),
    // Cycle to Work decisions 1, 3 and 5: what needs chasing. c2w: 'held' is
    // after "Hold longer" (audit L7), with only the late payment left.
    c2w === true && line('Maya Patel · Cycle to Work quote, no certificate yet', '[Bike] · quoted [n] days ago · held until [date]', `<span style="display: inline-flex; flex-direction: column; gap: 6px; white-space: nowrap">${button('Hold longer', { variant: 'default' }).replace('<button', '<button aria-label="Hold Maya Patel’s bike longer"')}${button('Open the order', { variant: 'default' }).replace('<button', '<button aria-label="Open Maya Patel’s order"')}</span>`, warnLead),
    // UX walk-through 5 M3: a hold that reaches its date with nobody choosing
    // stays held, and asks someone to choose; it's never released silently.
    c2wHoldEnded && line('Maya Patel · Cycle to Work hold ended [date] — choose', '[Bike] · still held · no certificate yet', `<span style="display: inline-flex; flex-direction: column; gap: 6px; white-space: nowrap">${button('Hold longer', { variant: 'default' }).replace('<button', '<button aria-label="Hold Maya Patel’s bike longer"')}${button('Release the bike', { variant: 'default' }).replace('<button', '<button aria-label="Release Maya Patel’s bike"')}</span>`, warnLead),
    // UX walk-through 5 H2 (option 1): with the "Refund the deposit" rule, the
    // deposit waits on Today until it's refunded at the till.
    c2wDeposit && line('Deposit to refund · Maya Patel', 'Cycle to Work · certificate added [date] · £[£] back the way it was paid', button('Refund the deposit', { variant: 'default' }).replace('<button', '<button aria-label="Refund Maya Patel’s deposit"').replace('style="', 'style="white-space: nowrap; '), warnLead),
    c2w && line('[Provider] payment is [n] days late', '[Customer] · collected [date] · expected £[£] by [date]', button('Open the order', { variant: 'default' }).replace('<button', '<button aria-label="Open [Provider]’s late payment"'), warnLead),
    payMore && line('[payment provider] needs more details by [date]', 'Or online payments and “Pay now” for repairs stop · usually [what they need]', button('Add the details', { variant: 'default' }), warnLead),
    accounts && line('Wednesday 16 September didn’t go to Xero', 'Bolton · closed at [time] · [Category] has no Xero account chosen', button('Choose an account for [Category]', { variant: 'default' }), warnLead),
    // Buy online decisions 6 and 7: new online orders, and one left uncollected.
    onlineNew && line('[n] new online orders', 'To get ready · oldest from [time]', button('Open Online orders', { variant: 'default' }), `<span style="display: inline-flex; color: ${C.ink}" aria-hidden="true">${icon('orders', 18)}</span>`),
    onlineUncollected && line('Order [order number] · Maya Patel — not collected', `Ready since [date] · reminder sent [date] · <a href="tel:07700900142" style="color: inherit; white-space: nowrap">${mono('07700 900 142')}</a>`, `<span style="display: inline-flex; gap: 6px">${button('Contacted', { variant: 'default' })}${button('Open', { variant: 'default' })}</span>`, warnLead),
    replies && line('2 messages need a reply', 'From customers · oldest from Maya Patel at [time]', button('Open Messages', { variant: 'default' }), `<span style="display: inline-flex; color: ${C.ink}" aria-hidden="true">${icon('mail', 18)}</span>`),
    deleteRequest && line('[Customer name] asked us to delete their account', 'From their account on the website, [date] · answer by [date]', button('Open', { variant: 'default' }), warnLead),
    uncollected && line('WH-1050 · Aisha Khan — ready since Mon 14 Sep', `Cannondale Quick · reminder sent [date] · ${mono('[phone]')}`, button('Contacted', { variant: 'default' }), warnLead),
    // Journey 13 decision 2: the restock list, for owners, managers and
    // anyone who can order stock (audit L6). It counts what's new since the
    // list was last opened and clears when opened or downloaded (audit M11).
    // UX walk-through 3 M1: it counts what jobs and online orders are waiting
    // for too (the restock list's "For customers").
    restock && line('[n] new products running low, selling fast or for customers', 'Since the restock list was last opened · [n] for jobs or online orders', button('Open', { variant: 'default' }).replace('<button', '<button aria-label="Open the restock list"'), `<span style="display: inline-flex; color: ${C.ink}" aria-hidden="true">${icon('purchasing', 18)}</span>`),
    // UX walk-through 3 M3 (option 1): a new product Staff left on a delivery,
    // for people who can add products. It goes once the product is added.
    productToAdd && line('1 product to add from a delivery', `Left by Jo Taylor at [time] · barcode ${mono('[barcode]')} · from [Supplier 2] · not in stock until it’s added`, button('Add this product', { variant: 'default' }).replace('style="', 'style="white-space: nowrap; '), `<span style="display: inline-flex; color: ${C.ink}" aria-hidden="true">${icon('purchasing', 18)}</span>`),
    // Journey 14 decision 6: a stock adjustment worth more than the amount
    // set in Settings › Stockroom; "Seen" clears it.
    // Journey 14 decision 9: products sold below zero, counted quickly.
    // On phone the two actions sit under the words, so the words keep the width.
    below && (() => { const acts = `<span style="display: inline-flex; align-items: center; gap: 6px"><a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; white-space: nowrap">See them</a>${button('Count them', { variant: 'default' }).replace('style="', 'style="white-space: nowrap; ')}</span>`; const sub = 'Sold more than Wheelhouse thought were here · Count them starts a count straight away'; return isPhone() ? line('[n] products below zero', `${sub}<span style="display: flex; margin-top: 4px; color: ${C.ink}">${acts}</span>`, '', warnLead) : line('[n] products below zero', sub, acts, warnLead); })(),
    // Journey 14 audit M8: the product name opens its page.
    adjusted && line(`Stock adjusted: <a href="#" style="display: inline-flex; align-items: center; min-height: 44px; color: ${C.ink}">[Product]</a> −[n] · £[value]`, 'Damaged · by Jo Taylor at [time]', button('Seen', { variant: 'default' }), warnLead),
    // Journey 14 decision 8 (audit M13): a transfer that arrived short.
    // UX walk-through 3 L1: "1 missing", the delivery's word.
    // UX walk-through 7 M5: the other shop is "[Second site]", as everywhere.
    transferShort && line('Transfer T-[0000] from [Second site] arrived with 1 missing', 'Booked in by Jack Lewis at [time] · [Second site] has been told', button('Open', { variant: 'default' }), warnLead),
    refresh && line('Time to refresh from Citrus Lime', 'Every [day] · last refreshed [date]', button('Refresh now', { variant: 'default' }), `<span style="display: inline-flex; color: ${C.ink}" aria-hidden="true">${icon('inbox', 18)}</span>`),
    // Lightspeed shops (journey 21) decision 6: Lightspeed out of reach for
    // longer than the shop's [n] minutes; sends wait and retry by themselves.
    lsDown && line('Can’t reach Lightspeed since [time]', '2 jobs waiting to send · Wheelhouse keeps trying by itself', button('See the jobs', { variant: 'default' }), warnLead),
    // Lightspeed shops audit H2 and H3: jobs waiting on a person, and bikes
    // that left before payment showed in Lightspeed.
    lsPerson && line('2 jobs need someone to look at Lightspeed', 'WH-1042 · Maya Patel — choose the customer · [Job] — check the work order arrived', button('See the jobs', { variant: 'default' }).replace('<button', '<button aria-label="See the jobs that need someone to look at Lightspeed"'), warnLead),
    lsUnpaid && line('Handed over, not paid in Lightspeed · Maya Patel · WH-1042', 'Collected [n] days ago by Jo Taylor · agreed £111.00', button('Open the job', { variant: 'default' }).replace('<button', '<button aria-label="Open WH-1042"'), warnLead),
    // UX walk-through 2 L2: Today only knows what the till said when it was
    // last in touch; "Check again" refreshes this line.
    waiting && line('Till B1 last in touch at [time] · [n] sales waiting then', 'Waiting more than [n] minutes · they send by themselves when the internet is back', button('Check again', { variant: 'default' }).replace('style="', 'style="white-space: nowrap; '), warnLead),
    // UX walk-through 7 H1: for anyone who can see more than one shop, Needs
    // attention ends with one line for each other shop with something
    // waiting; "See them" switches to that shop. While a new shop's checklist
    // is unfinished the line counts its steps instead, so the checklist
    // reaches the owner from either shop. `otherShops`: true (things need
    // attention), 'setup' (steps left), or { shop, count, setup }.
    otherShops && (() => {
      const o = otherShops === true ? {} : otherShops === 'setup' ? { setup: true } : otherShops;
      // Four steps left: walk-through 7 M3 (option 1) adds "Show it to customers" to the checklist.
      const { shop = '[Second site]', setup = false, count = setup ? 4 : 3 } = o;
      const what = setup ? `${count} steps to get it ready` : `${count} things need attention`;
      const act = `<a href="#" aria-label="${setup ? `See the steps to get ${shop} ready` : `See the ${count} things that need attention at ${shop}`}" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; font-size: 14px; font-weight: 600; color: ${C.ink}; white-space: nowrap">${setup ? 'See the steps' : 'See them'}</a>`;
      return line(`${shop} · ${what}`, setup ? `Its checklist · “See the steps” switches to ${shop}` : `Not this shop · “See them” switches to ${shop}`, act, `<span style="display: inline-flex; color: ${setup ? C.ink : C.warnInk}" aria-hidden="true">${icon('store', 18)}</span>`);
    })(),
  ].filter(Boolean);
  const attention = section('Needs attention', items.length ? list(items)
    : `<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; border-top: 1px solid ${C.border}; font-size: 15px; color: ${C.muted}">${icon('check', 16)}Nothing needs you right now</div>`, '', items.length);
  // Lightspeed shops: no Wheelhouse tills; the Lightspeed line says how
  // fresh its figures are (decisions 1 and 5).
  // Audit M4: the line says what's true now; "payments" only when payment
  // is being checked. M3: no Who's in — there's no till check-in.
  const lsLine = section('Lightspeed', `<div role="status">${list([line(lsDown ? 'Can’t reach Lightspeed' : 'Up to date', lsDown ? 'Last reached at [time] · jobs wait and send by themselves' : 'Products, stock and payments checked [n] seconds ago', tag(lsDown ? 'Can’t reach' : 'Up to date', lsDown ? 'warn' : 'ok'))])}</div>`);
  // UX walk-through 6 M1 (option 1): at a Lightspeed shop Staff see Needs
  // attention (the pick and check lines) and the Lightspeed line, not Who's in.
  const left = lightspeed ? `${attention}${lsLine}` : staff ? who : `${attention}${tills}${who}`;
  const cols = isPhone() ? `${left}${work}` : `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start"><div style="display: flex; flex-direction: column; gap: 14px">${left}</div><div style="display: flex; flex-direction: column; gap: 14px">${work}</div></div>`;
  return page('today', 'Today', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Thursday 17 September · North Street Cycles, Bolton · open [opens]–[closes]')}${cols}</div>`, as || (staff ? STAFF : MANAGER));
}

// "Close it" lands on journey 16's close-the-day page, for yesterday (audit H3).
// UX walk-through 2 H1(b): it opens at banking — the morning's float check
// was Wednesday's count.
const closeYesterday = () => closeUncounted(SIZE);

def('op-float-check', () => overlay(tillBase(), floatCheck()));
def('op-float-check-unclosed', () => overlay(tillBase(), floatCheck(true))); // UX walk-through 2 H1(b)
def('op-float-check-first', () => overlay(tillBase(), floatCheck(false, true))); // UX walk-through 4 M4
def('op-float-count', () => overlay(tillBase(), floatCount()));
def('op-float-matched', () => matched());
def('op-float-short', () => overlay(tillBase(), floatDiff()));
def('op-float-over', () => overlay(tillBase(), floatDiff(true)));
def('op-today', () => today());
def('op-today-short', () => today({ short: true }));
def('op-today-seen', () => today({ short: true, seen: true }));
def('op-today-waiting', () => today({ waiting: true }));
def('op-today-banked', () => today({ banked: true })); // UX walk-through 2 H1(a)
def('op-today-unclosed', () => today({ unclosed: true }));
def('op-close-yesterday', () => closeYesterday());
def('op-today-two', () => today({ short: true, unclosed: true }));
def('op-today-staff', () => today({ staff: true }));
def('op-today-late', () => today({ late: true }));
def('op-today-practice', () => today({ practice: true })); // UX walk-through 4 M4
def('op-today-c2w', () => today({ c2wHoldEnded: true, c2wDeposit: true })); // UX walk-through 5 M3, H2
def('op-today-staff-lightspeed', () => withLightspeedShop(() => today({ lightspeed: true, lsPerson: true, staff: true }))); // UX walk-through 6 M1 (option 1)

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop', 'tablet', 'phone'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const size of SIZES) screens[id][size] = withSize(size, () => { SIZE = size; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'op-float-check': 'First in: a one-tap float check',
  'op-float-check-unclosed': 'First in, when yesterday wasn’t counted: the float plus Wednesday’s cash',
  'op-float-check-first': 'First in on the first real day: count the float', // UX walk-through 4 M4
  'op-float-count': 'Count it: note by note',
  'op-float-matched': 'The count matches: the till is ready',
  'op-float-short': 'The float is short',
  'op-float-over': 'The float is over',
  'op-today': 'Office › Today: the start of the day',
  'op-today-short': 'Today, with a short float to check',
  'op-today-seen': 'Today, after the short float is marked Seen',
  'op-today-waiting': 'Today, with sales waiting to send',
  'op-today-banked': 'Today, when yesterday was counted and banked but sales are still to send',
  'op-today-unclosed': 'Today, when yesterday wasn’t closed',
  'op-close-yesterday': '“Close it”: yesterday’s close the day, at banking',
  'op-today-two': 'Today, with two things to deal with',
  'op-today-staff': 'Today, as Staff see it',
  'op-today-late': 'Today, when someone due in is late',
  'op-today-practice': 'Today, while the tills are in practice: the drawer isn’t counted', // UX walk-through 4 M4
  'op-today-c2w': 'Today: a Cycle to Work hold that ended with nobody choosing, and a deposit to refund', // UX walk-through 5 M3, H2
  'op-today-staff-lightspeed': 'Today at a Lightspeed shop, as Staff see it: jobs that need someone to look', // UX walk-through 6 M1
};
export const ROWS = [
  { label: 'Opening the till', screens: ['op-float-check', 'op-float-check-unclosed', 'op-float-check-first', 'op-float-count', 'op-float-matched', 'op-float-short', 'op-float-over'] },
  { label: 'Office › Today', screens: ['op-today', 'op-today-short', 'op-today-seen', 'op-today-waiting', 'op-today-banked', 'op-today-unclosed', 'op-close-yesterday', 'op-today-two', 'op-today-staff', 'op-today-late', 'op-today-practice', 'op-today-c2w', 'op-today-staff-lightspeed'] },
];

// Multiple sites (journey 19): Today's parts, for the "All shops" Today.
export { section, list, line, tag, stat, warnLead };
