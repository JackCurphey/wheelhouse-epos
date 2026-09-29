// Journey 11 — Selling at the till, designed in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-29-selling-at-the-till-review.md
//
// Built inside journey A's till frame (app-map.mjs: foldedRail, tillBar).
// Example data is only what the generator already has: North Street Cycles,
// Bolton, Till B1, Jo Taylor, Maya Patel, and the work lines from job WH-1042
// (Standard service £65, Shimano brake pads B05S-RX £28, Fit & adjust brakes
// £18, Replace gear cable £12). Every other product is a bracketed
// placeholder until Jack supplies real items.
import { C, MONO, esc, icon, button, card, field } from './ui.mjs';
import { DW, DH } from './stage1.mjs';
import { foldedRail, tillBar } from './app-map.mjs';

const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const money = (n) => `£${n.toFixed(2)}`;
const label = (t) => `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">${t}</div>`;

// The till page: folded rail, till bar, then the left side and the basket.
function tillPage(left, right) {
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; display: flex; background: ${C.bg}">${foldedRail('till')}<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">${tillBar()}<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 20px; display: flex; gap: 20px">${left}${right}</main></div></div>`;
}

// ---------- Left side (decision 2): search, group pills, quick buttons ----------
const searchBox = `<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid ${C.input}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('search', 20)}<input type="search" aria-label="Search or scan: products, customers, jobs" placeholder="Search or scan: products, customers, jobs" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>`;
const groupPill = (t, on) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 18px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 15px; font-weight: 600">${t}</button>`;
const quick = (name, sub, price) => `<button type="button" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 8px; min-height: 104px; box-sizing: border-box; padding: 14px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; text-align: left; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700; line-height: 1.25">${esc(name)}</span><span style="font-size: 12px; color: ${C.muted}">${esc(sub)}</span></span>${mono(price, 'font-size: 16px')}</button>`;
const quickPlaceholder = (t) => `<div style="min-height: 104px; box-sizing: border-box; padding: 14px; border-radius: 12px; border: 2px dashed ${C.border}; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 13px; color: ${C.muted}">${esc(t)}</div>`;
function leftSide({ group = 'Workshop' } = {}) {
  const groups = ['Workshop', 'Parts', 'Accessories', '[Group]'];
  const buttons = [
    quick('Standard service', 'Labour · 60 min', money(65)),
    quick('Fit & adjust brakes', 'Labour · 30 min', money(18)),
    quick('Replace gear cable', 'Labour', money(12)),
    ...Array.from({ length: 9 }, () => quickPlaceholder('[Quick button · £ price]')),
  ];
  return `<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px">
${searchBox}
<div role="group" aria-label="Quick button groups" style="display: flex; flex-wrap: wrap; gap: 8px">${groups.map((g) => groupPill(g, g === group)).join('')}</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px">${buttons.join('')}</div>
</div>`;
}

// ---------- Right side: the basket ----------
const stepper = (qty, name) => `<div role="group" aria-label="Quantity of ${esc(name)}" style="display: inline-flex; align-items: center; border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden"><button type="button" aria-label="One fewer" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">−</button><span style="min-width: 28px; text-align: center; font-family: ${MONO}; font-size: 15px">${qty}</span><button type="button" aria-label="One more" style="width: 44px; height: 44px; border: 0; background: ${C.panel}; font-family: inherit; font-size: 20px; color: ${C.ink}">+</button></div>`;
const line = (l) => `<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-top: 1px solid ${C.border}">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px"><a href="#" style="display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: ${C.ink}"><span style="font-size: 15px; font-weight: 600">${esc(l.name)}</span><span style="font-size: 13px; color: ${C.muted}">${esc(l.sub)}</span></a>${mono(money(l.price * l.qty), 'font-size: 16px')}</div>
<div style="display: flex; align-items: center; justify-content: space-between">${stepper(l.qty, l.name)}<span style="font-size: 13px; color: ${C.muted}">${l.qty > 1 ? `${money(l.price)} each` : ''}</span></div>
</div>`;
function basket(lines, { customer = null } = {}) {
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const vat = total / 6; // UK prices include 20% VAT: VAT is one sixth of the price
  return card(`<div style="height: 100%; box-sizing: border-box; padding: 18px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><h2 style="margin: 0; font-size: 17px; font-weight: 700">Sale</h2><span style="display: flex; gap: 4px">${button('Park', { variant: 'ghost' })}${button('Clear', { variant: 'ghost' })}</span></div>
${customer ? `<a href="#" style="display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid ${C.border}; border-radius: 8px; text-decoration: none; color: ${C.ink}"><span style="font-size: 14px; font-weight: 600">${esc(customer)}</span></a>` : `<button type="button" style="display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px dashed ${C.input}; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">${icon('user', 16)}Add a customer <span style="font-weight: 400; color: ${C.muted}">(optional)</span></button>`}
<div style="display: flex; flex-direction: column">${lines.map(line).join('')}</div>
<div style="flex-grow: 1"></div>
<a href="#" style="align-self: flex-start; display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Add a discount</a>
<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 12px; border-top: 1px solid ${C.border}">
<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 16px; font-weight: 700">Total</span>${mono(money(total), 'font-size: 26px')}</div>
<div style="display: flex; justify-content: space-between; font-size: 13px; color: ${C.muted}"><span>Includes VAT</span>${mono(money(vat))}</div>
</div>
${button(`Take payment · ${money(total)}`, { block: true })}
</div>`, 'width: 380px; flex-shrink: 0; height: 100%');
}

const PADS = { name: 'Shimano brake pads', sub: 'Part · B05S-RX', price: 28, qty: 2 };
const BRAKES = { name: 'Fit & adjust brakes', sub: 'Labour · 30 min', price: 18, qty: 1 };

export const screens = {};
screens['till-sale'] = { desktop: tillPage(leftSide(), basket([PADS, BRAKES])) };

// Decision 3: tap a basket line → a pop-up in the middle with price,
// discount (amount or percent, with a reason), a note, and Remove.
const seg = (items, on, label) => `<div role="group" aria-label="${esc(label)}" style="display: inline-flex; border: 1px solid ${C.input}; border-radius: 8px; overflow: hidden">${items.map((t, i) => `<button type="button" aria-pressed="${i === on}" style="min-width: 52px; min-height: 44px; border: 0; ${i ? `border-left: 1px solid ${C.input};` : ''} background: ${i === on ? C.ink : C.panel}; color: ${i === on ? C.panel : C.ink}; font-family: inherit; font-size: 15px; font-weight: 600">${t}</button>`).join('')}</div>`;
const reasonPill = (t, on = false) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`;
function lineDialog() {
  return `<div role="dialog" aria-modal="true" aria-labelledby="line-title" style="width: 520px; box-sizing: border-box; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 12px; box-shadow: 0 18px 48px rgba(38,36,32,0.28); overflow: hidden">
<div style="display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 22px; background: ${C.panel}; border-bottom: 1px solid ${C.border}"><div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><h2 id="line-title" style="margin: 0; font-size: 20px; font-weight: 700">Shimano brake pads</h2><span style="font-size: 13px; color: ${C.muted}">Part · ${mono('B05S-RX')} · 2 in the sale</span></div><a href="till-sale-desktop.dc.html" aria-label="Close" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a></div>
<div style="padding: 20px 22px; display: flex; flex-direction: column; gap: 18px">
${field('Price each', { value: '£28.00', hint: 'The usual price is £28.00.' })}
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Discount</span><div style="display: flex; gap: 10px; align-items: center">${seg(['£', '%'], 1, 'Discount as pounds or percent')}<input aria-label="Discount amount" value="10" style="width: 110px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"><span style="font-size: 14px; color: ${C.muted}">= ${mono('£5.60')} off, ${mono('£50.40')} for 2</span></div></div>
<div role="group" aria-label="Reason for the discount" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Reason</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${reasonPill('[Shop’s reason]', true)}${reasonPill('[Shop’s reason]')}${reasonPill('Other…')}</div></div>
${field('Note (optional)', { placeholder: 'e.g. a serial number', hint: 'Shows on the receipt.' })}
</div>
<div style="display: flex; justify-content: space-between; gap: 10px; padding: 14px 22px; border-top: 1px solid ${C.border}; background: ${C.panel}">${button('Remove from sale', { variant: 'danger' })}${button('Done')}</div>
</div>`;
}
screens['till-line'] = {
  desktop: `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">${tillPage(leftSide(), basket([PADS, BRAKES]))}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center">${lineDialog()}</div></div>`,
};

// ---------- Pop-ups over the till ----------
function dialog(id, title, sub, body, footer, w = 520) {
  return `<div role="dialog" aria-modal="true" aria-labelledby="${id}" style="width: ${w}px; max-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 12px; box-shadow: 0 18px 48px rgba(38,36,32,0.28); overflow: hidden">
<div style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 22px; background: ${C.panel}; border-bottom: 1px solid ${C.border}"><div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><h2 id="${id}" style="margin: 0; font-size: 20px; font-weight: 700">${title}</h2>${sub ? `<span style="font-size: 13px; color: ${C.muted}">${sub}</span>` : ''}</div><a href="till-sale-desktop.dc.html" aria-label="Close" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a></div>
<div style="padding: 20px 22px; display: flex; flex-direction: column; gap: 16px">${body}</div>
${footer ? `<div style="flex-shrink: 0; display: flex; justify-content: space-between; gap: 10px; padding: 14px 22px; border-top: 1px solid ${C.border}; background: ${C.panel}">${footer}</div>` : ''}
</div>`;
}
const overTill = (d, lines = [PADS, BRAKES]) => `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">${tillPage(leftSide(), basket(lines))}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box">${d}</div></div>`;

// Add a customer (works offline): search, or add someone new with just a
// name and one way to reach them. Tapping a result adds them at once.
const custRow = (name, sub) => `<a href="#" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 8px 12px; border-radius: 8px; border: 1px solid ${C.border}; background: ${C.panel}; text-decoration: none; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span><span style="font-size: 13px; font-weight: 600">Add to sale</span></a>`;
screens['till-customer'] = {
  desktop: overTill(dialog('cust-title', 'Add a customer', 'Optional — for a receipt by email, an account, or their bike history', `
<label style="display: flex; align-items: center; gap: 10px; min-height: 48px; box-sizing: border-box; padding: 0 12px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('search', 18)}<input type="search" aria-label="Search customers by name, phone or email" value="maya" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></label>
${custRow('Maya Patel', 'maya@example.com · Trek Domane AL 3')}
<div style="padding-top: 14px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 12px"><span style="font-size: 14px; font-weight: 700">Or add someone new</span>
<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px">${field('Name', { placeholder: 'First and last name' })}${field('Phone or email', { placeholder: 'Either is fine' })}</div>
${button('Add new customer to sale', { variant: 'default', block: true })}</div>`, '')),
};

// Choose size and colour: products that come in sizes and colours open this
// first (INV-06). One tap on an in-stock option adds it.
const opt = (t, stock, on = false, out = false) => `<button type="button" aria-pressed="${on}"${out ? ' aria-disabled="true"' : ''} style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 64px; border-radius: 10px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : out ? C.mutedBg : C.panel}; color: ${on ? C.panel : out ? C.muted : C.ink}; font-family: inherit"><span style="font-size: 16px; font-weight: 700">${t}</span><span style="font-size: 12px; ${on ? '' : `color: ${C.muted}`}">${stock}</span></button>`;
screens['till-variant'] = {
  desktop: overTill(dialog('var-title', '[Product with sizes and colours]', 'Pick one — tap an option to add it', `
<div role="group" aria-label="Colour" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Colour</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${reasonPill('[Colour]', true)}${reasonPill('[Colour]')}</div></div>
<div role="group" aria-label="Size" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Size</span><div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px">${opt('[Size]', '[n] in stock')}${opt('[Size]', '[n] in stock')}${opt('[Size]', '[n] in stock')}${opt('[Size]', 'None in stock', false, true)}</div></div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">An option with none in stock can still be sold; the stock goes below zero and shows in Stock.</p>`, '')),
};

// Record a serial number: selling a bike (or anything the shop tracks by
// serial) asks for its frame number straight away (INV-07).
screens['till-serial'] = {
  desktop: overTill(dialog('serial-title', 'Frame number', '[Bike name] · this product is tracked by serial number', `
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('check', 18)}<input aria-label="Frame number" placeholder="Scan the frame barcode or type the number" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: ${MONO}; font-size: 16px; color: ${C.ink}"></label>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">It goes on the receipt and the customer’s bike record, so the bike can be traced for warranty or if it’s stolen.</p>`, `${button('Skip for now', { variant: 'ghost' })}${button('Add to sale')}`)),
};

// A discount on the whole sale — "Add a discount" in the basket. Same
// controls as a line (decision 3); anyone can give it (decision 4).
screens['till-discount'] = {
  desktop: overTill(dialog('disc-title', 'Discount the whole sale', 'Sale total £74.00 · 3 items', `
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Discount</span><div style="display: flex; gap: 10px; align-items: center">${seg(['£', '%'], 0, 'Discount as pounds or percent')}<input aria-label="Discount amount" value="4.00" style="width: 110px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"><span style="font-size: 14px; color: ${C.muted}">New total ${mono('£70.00')}</span></div></div>
<div role="group" aria-label="Reason for the discount" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Reason</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${reasonPill('[Shop’s reason]', true)}${reasonPill('[Shop’s reason]')}${reasonPill('Other…')}</div></div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">The reason is kept with the sale and shows in the discounts report.</p>`, `${button('Remove discount', { variant: 'danger' })}${button('Done')}`)),
};

export const TITLES = {
  'till-sale': 'Sale — quick buttons by group, basket on the right',
  'till-line': 'Change a line — price, discount with a reason, note, remove',
  'till-discount': 'Discount the whole sale',
  'till-customer': 'Add a customer — search, or add someone new',
  'till-variant': 'Choose size and colour',
  'till-serial': 'Record a frame number',
};
export const ROWS = [
  { label: 'A sale', screens: ['till-sale', 'till-line', 'till-discount', 'till-customer', 'till-variant', 'till-serial'] },
];
