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
import { LINES_APPROVED, WORK_TOTAL_APPROVED } from './diary.mjs';

const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const money = (n) => `£${n.toFixed(2)}`;
const label = (t) => `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">${t}</div>`;

// The till page: folded rail, till bar, then the left side and the basket.
function tillPage(left, right, { offline = null, offlineLong = false, notice = '' } = {}) {
  return `<div style="position: relative; width: ${DW}px; height: ${DH}px; display: flex; background: ${C.bg}">${foldedRail('till')}<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">${tillBar({ offline, offlineLong })}${notice}<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 20px; display: flex; gap: 20px">${left}${right}</main></div></div>`;
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
const signed = (n) => (n < 0 ? `−${money(-n)}` : money(n));
const line = (l) => `<div style="display: flex; flex-direction: column; gap: 6px; padding: 9px 0; border-top: 1px solid ${C.border}">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px"><a href="#" style="display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: ${C.ink}"><span style="font-size: 15px; font-weight: 600">${esc(l.name)}</span><span style="font-size: 13px; color: ${C.muted}">${esc(l.sub)}</span></a>${mono(signed(l.price * l.qty), 'font-size: 16px')}</div>
${l.fixed ? '' : `<div style="display: flex; align-items: center; justify-content: space-between">${stepper(l.qty, l.name)}<span style="font-size: 13px; color: ${C.muted}">${l.qty > 1 ? `${money(l.price)} each` : ''}</span></div>`}
</div>`;
function basket(lines, { customer = null, points = false } = {}) {
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const vat = total / 6; // UK prices include 20% VAT: VAT is one sixth of the price
  return card(`<div style="height: 100%; box-sizing: border-box; padding: 18px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><h2 style="margin: 0; font-size: 17px; font-weight: 700">Sale</h2><span style="display: flex; gap: 4px">${button('Park', { variant: 'ghost' })}${button('Clear', { variant: 'ghost' })}</span></div>
${customer ? `<div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid ${C.border}; border-radius: 8px"><a href="#" style="display: flex; align-items: center; gap: 8px; text-decoration: none; color: ${C.ink}">${icon('user', 16)}<span style="font-size: 14px; font-weight: 600">${esc(customer)}</span></a>${points ? `<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 8px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600">[n] loyalty points</span><span style="font-size: 13px; color: ${C.muted}">Worth [£ amount] off this sale</span></span>${button('Use points', { variant: 'default' })}</div>` : ''}</div>` : `<button type="button" style="display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px dashed ${C.input}; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">${icon('user', 16)}Add a customer <span style="font-weight: 400; color: ${C.muted}">(optional)</span></button>`}
${lines.length ? `<div style="display: flex; flex-direction: column">${lines.map(line).join('')}</div>` : `<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; color: ${C.muted}"><span style="font-size: 15px; font-weight: 600; color: ${C.ink}">Nothing in the sale yet</span><span style="font-size: 14px">Tap a quick button, search, or scan a barcode.</span></div>`}
<div style="flex-grow: 1"></div>
<a href="#" style="align-self: flex-start; display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Add a discount</a>
<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 12px; border-top: 1px solid ${C.border}">
<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 16px; font-weight: 700">Total</span>${mono(money(total), 'font-size: 26px')}</div>
<div style="display: flex; justify-content: space-between; font-size: 13px; color: ${C.muted}"><span>Includes VAT</span>${mono(money(vat))}</div>
</div>
${lines.length ? button(`Take payment · ${money(total)}`, { block: true }) : `<button type="button" disabled style="display: flex; width: 100%; align-items: center; justify-content: center; min-height: 44px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.mutedBg}; color: ${C.muted}; font-family: inherit; font-size: 15px; font-weight: 600">Take payment</button>`}
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
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Discount</span><div style="display: flex; gap: 10px; align-items: center">${seg(['£', '%'], 0, 'Discount as pounds or percent')}<input aria-label="Discount amount" value="5.60" style="width: 110px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"><span style="font-size: 14px; color: ${C.muted}">off the line · ${mono('£50.40')} for 2</span></div></div>
<div role="group" aria-label="Reason for the discount" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Reason</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${reasonPill('[Shop’s reason]', true)}${reasonPill('[Shop’s reason]')}${reasonPill('Other…')}</div></div>
${field('Note (optional)', { placeholder: 'e.g. a serial number', hint: 'Shows on the receipt.' })}
<div>${button('Remove from sale', { variant: 'danger' })}</div>
</div>
<div style="display: flex; justify-content: space-between; gap: 10px; padding: 14px 22px; border-top: 1px solid ${C.border}; background: ${C.panel}">${button('Cancel', { variant: 'ghost' })}${button('Done')}</div>
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
<p style="margin: 0; font-size: 13px; color: ${C.muted}">An option with none in stock can still be sold — its basket line then says “Stock says 0 — sold anyway” so the count can be checked (decision 5).</p>`, '')),
};

// Record a serial number: selling a bike (or anything the shop tracks by
// serial) asks for its frame number straight away (INV-07).
screens['till-serial'] = {
  desktop: overTill(dialog('serial-title', 'Frame number', '[Bike name] · this product is tracked by serial number', `
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 18)}<input aria-label="Frame number" placeholder="Scan the frame barcode or type the number" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: ${MONO}; font-size: 16px; color: ${C.ink}"></label>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">It goes on the receipt and the customer’s bike record, so the bike can be traced for warranty or if it’s stolen.</p>`, `${button('Skip for now', { variant: 'ghost' })}${button('Add to sale')}`)),
};

// A discount on the whole sale — "Add a discount" in the basket. Same
// controls as a line (decision 3); anyone can give it (decision 4).
screens['till-discount'] = {
  desktop: overTill(dialog('disc-title', 'Discount the whole sale', 'Sale total £74.00 · 3 items', `
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Discount</span><div style="display: flex; gap: 10px; align-items: center">${seg(['£', '%'], 0, 'Discount as pounds or percent')}<input aria-label="Discount amount" value="4.00" style="width: 110px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${MONO}; font-size: 15px; color: ${C.ink}"><span style="font-size: 14px; color: ${C.muted}">New total ${mono('£70.00')}</span></div></div>
<div role="group" aria-label="Reason for the discount" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Reason</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${reasonPill('[Shop’s reason]', true)}${reasonPill('[Shop’s reason]')}${reasonPill('Other…')}</div></div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">The reason is kept with the sale and shows in the discounts report.</p>
<div>${button('Remove discount', { variant: 'danger' })}</div>`, `${button('Cancel', { variant: 'ghost' })}${button('Done')}`)),
};

// ---------- Taking payment ----------
// Decision 6: the card machine is connected — choosing Card sends the amount
// to it; the till shows its progress. Card for the exact total is the usual
// case, so it is one tap after "Take payment" (journey A decision 6).
const TOTAL = 74;
const bigMethod = (title, sub, ic, primary = false) => `<button type="button" style="display: flex; align-items: center; gap: 16px; width: 100%; min-height: 84px; box-sizing: border-box; padding: 14px 18px; border-radius: 12px; border: 1px solid ${primary ? C.ink : C.border}; background: ${primary ? C.ink : C.panel}; color: ${primary ? C.panel : C.ink}; font-family: inherit; text-align: left">${icon(ic, 26)}<span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1"><span style="font-size: 18px; font-weight: 700">${title}</span><span style="font-size: 13px; ${primary ? 'opacity: 0.85' : `color: ${C.muted}`}">${sub}</span></span></button>`;
const payHead = (title, sub) => [`${title}`, sub];
screens['till-pay'] = {
  desktop: overTill(dialog('pay-title', `Take payment · ${money(TOTAL)}`, 'Jo Taylor serving · 3 items', `
${bigMethod(`Card · ${money(TOTAL)}`, `Sends ${money(TOTAL)} to the card machine`, 'card', true)}
${bigMethod('Cash', 'Enter what the customer hands you; the till works out the change', 'cash')}
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px">${['Split', 'Gift card or credit', 'On account', 'Deposit'].map((t) => `<button type="button" style="min-height: 56px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</button>`).join('')}</div>`, '', 560)),
};
// The card machine at work (decision 6): waiting for the card, then
// approved (straight on to the receipt) or declined. If the machine doesn't
// answer, staff can key the amount in on it by hand and say so here.
function cardDialog(state) {
  const body = {
    waiting: `<div style="display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 12px 0; text-align: center"><span style="display: inline-flex; width: 72px; height: 72px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.mutedBg}; color: ${C.ink}">${icon('card', 34)}</span><span style="font-size: 22px; font-weight: 700">Waiting for the card</span>${mono(money(TOTAL), 'font-size: 34px')}<span style="font-size: 15px; color: ${C.muted}">On the card machine now — the customer taps, inserts or swipes.</span></div>`,
    declined: `<div style="display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 12px 0; text-align: center"><span style="display: inline-flex; width: 72px; height: 72px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.dangerBg}; color: ${C.dangerInk}">${icon('alert', 34)}</span><span style="font-size: 22px; font-weight: 700">Card declined</span><span style="font-size: 15px; color: ${C.muted}">The card machine said no — nothing was taken. Try the card again, another card, or another way to pay.</span></div>`,
  }[state];
  const footer = state === 'waiting'
    ? `${button('Cancel', { variant: 'ghost' })}<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">Machine not answering? Key it in on the machine instead</a>`
    : `${button('Pay another way', { variant: 'default' })}${button('Try the card again')}`;
  return dialog('card-title', `Card · ${money(TOTAL)}`, 'Jo Taylor serving · 3 items', body, footer, 560);
}
screens['till-card'] = { desktop: overTill(cardDialog('waiting')) };
screens['till-card-declined'] = { desktop: overTill(cardDialog('declined')) };
const noteBtn = (t, on = false) => `<button type="button" aria-pressed="${on}" style="min-height: 60px; border-radius: 10px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: ${MONO}; font-size: 18px">${t}</button>`;
screens['till-pay-cash'] = {
  desktop: overTill(dialog('cash-title', `Cash · ${money(TOTAL)} to pay`, 'Tap what the customer handed you, or type it', `
<div role="group" aria-label="Amount handed over" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px">${noteBtn('£74.00')}${noteBtn('£75.00')}${noteBtn('£80.00', true)}${noteBtn('£100.00')}</div>
${field('Or type the amount', { value: '£80.00' })}
<div style="display: flex; justify-content: space-between; align-items: baseline; padding: 16px 18px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}"><span style="font-size: 18px; font-weight: 700">Change to give</span>${mono('£6.00', 'font-size: 34px')}</div>`, `${button('Back', { variant: 'ghost' })}${button('Cash taken · open the drawer')}`, 560)),
};
const paidRow = (method, amount) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600">${icon('check', 16, C.successInk)}${method}</span>${mono(amount, 'font-size: 16px')}</div>`;
screens['till-pay-split'] = {
  desktop: overTill(dialog('split-title', `Split payment · ${money(TOTAL)}`, 'Take it in parts — each part is recorded as it goes', `
<div style="display: flex; flex-direction: column">${paidRow('Cash', '£20.00')}</div>
<div style="display: flex; justify-content: space-between; align-items: baseline; padding: 16px 18px; border-radius: 10px; border: 1px solid ${C.ink}; background: ${C.panel}"><span style="font-size: 18px; font-weight: 700">Still to pay</span>${mono('£54.00', 'font-size: 34px')}</div>
${bigMethod('Card · £54.00', 'Sends £54.00 to the card machine', 'card', true)}
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">${['Cash', 'Gift card or credit', 'Another amount'].map((t) => `<button type="button" style="min-height: 56px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</button>`).join('')}</div>`, '', 560)),
};

// Decision 7: "Paid" — Print, Email, Text or No receipt; it closes by
// itself after a few seconds and the next sale starts. The receipt number
// format is from till set-up (B1-0001, B1-0002 …); the number is a placeholder.
const rcptBtn = (ic, t, primary = false) => `<button type="button" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 76px; border-radius: 10px; border: 1px solid ${primary ? C.ink : C.border}; background: ${primary ? C.ink : C.panel}; color: ${primary ? C.panel : C.ink}; font-family: inherit; font-size: 15px; font-weight: 600">${icon(ic, 22)}${t}</button>`;
screens['till-receipt'] = {
  desktop: overTill(dialog('paid-title', 'Paid', `Card · ${money(TOTAL)} · receipt ${mono('B1-[0000]')}`, `
<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 6px 0 4px; text-align: center"><span style="display: inline-flex; width: 64px; height: 64px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 32)}</span>${mono(money(TOTAL), 'font-size: 30px')}</div>
<div role="group" aria-label="Receipt" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px">${rcptBtn('printer', 'Print')}${rcptBtn('mail', 'Email')}${rcptBtn('phone', 'Text')}${rcptBtn('close', 'No receipt', true)}</div>
<p role="timer" style="margin: 0; text-align: center; font-size: 14px; color: ${C.muted}">Next sale starts in 5 seconds</p>`, '', 560)),
};

// ---------- Other ways to pay (decision 8) ----------
// Balances, limits and point values are placeholders — nothing real exists.
const infoRow = (k, v, strong = false) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; ${strong ? 'font-weight: 700' : ''}">${k}</span><span style="font-family: ${MONO}; font-size: ${strong ? 18 : 15}px">${v}</span></div>`;
screens['till-giftcard'] = {
  desktop: overTill(dialog('gift-title', 'Gift card or store credit', `${money(TOTAL)} to pay`, `
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('search', 18)}<input aria-label="Scan or type a gift card number, or find a customer’s credit" placeholder="Scan the card, or a customer’s name for credit" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 15px; color: ${C.ink}"></label>
<div style="display: flex; flex-direction: column; padding: 4px 16px 8px; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}">
<div style="padding: 10px 0 6px; font-size: 15px; font-weight: 700">Gift card ${mono('•••• [0000]')}</div>
${infoRow('Balance', '[£ balance]')}${infoRow('Use for this sale', '[£ up to the total]', true)}${infoRow('Left on the card after', '[£ left]')}
</div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">If the card doesn’t cover it all, the rest is taken another way — the same as a split payment. Selling or topping up a gift card is a quick button, like any product.</p>`, `${button('Back', { variant: 'ghost' })}${button('Use gift card')}`, 580)),
};
screens['till-account'] = {
  desktop: overTill(dialog('acct-title', `Put on account · ${money(TOTAL)}`, 'Pay later — the sale goes on the customer’s account', `
<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 12px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}">${icon('user', 18)}<span style="font-size: 15px; font-weight: 600; flex-grow: 1">Maya Patel</span><a href="#" style="font-size: 14px; font-weight: 600; color: ${C.ink}">Change</a></div>
<div style="display: flex; flex-direction: column; padding: 4px 16px 8px; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}">
${infoRow('Owed now', '[£ owed]')}${infoRow('This sale', money(TOTAL))}${infoRow('Owed after this sale', '[£ owed after]', true)}${infoRow('Account limit', '[£ limit]')}
</div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">Only customers with an account can pay this way; the shop sets each one up with a limit.</p>`, `${button('Back', { variant: 'ghost' })}${button(`Put ${money(TOTAL)} on Maya’s account`)}`, 580), [PADS, BRAKES]),
};
screens['till-loyalty'] = { desktop: tillPage(leftSide(), basket([PADS, BRAKES], { customer: 'Maya Patel', points: true })) };
const pctPill = (t, on = false) => `<button type="button" aria-pressed="${on}" style="min-height: 52px; border-radius: 10px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 16px; font-weight: 600">${t}</button>`;
screens['till-deposit'] = {
  desktop: overTill(dialog('dep-title', `Take a deposit · sale ${money(TOTAL)}`, 'Part now, the rest later — kept with the customer and the sale', `
<div role="group" aria-label="How much now" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px">${pctPill('10%')}${pctPill('25%', true)}${pctPill('50%')}${pctPill('Other')}</div>
<div style="display: flex; flex-direction: column; padding: 4px 16px 8px; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}">
${infoRow('Deposit now', money(TOTAL * 0.25), true)}${infoRow('Left to pay later', money(TOTAL * 0.75))}
</div>
<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 12px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}">${icon('user', 18)}<span style="font-size: 15px; font-weight: 600; flex-grow: 1">Maya Patel</span><span style="font-size: 13px; color: ${C.muted}">needed for a deposit</span></div>`, `${button('Back', { variant: 'ghost' })}${button(`Take ${money(TOTAL * 0.25)} now`)}`, 580)),
};

// ---------- Other till jobs ----------
const tickRow = (name, sub, amount, on) => `<label style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 4px; border-top: 1px solid ${C.border}"><input type="checkbox"${on ? ' checked' : ''} style="width: 22px; height: 22px; margin: 0; accent-color: ${C.ink}; flex-shrink: 0"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${mono(amount, 'font-size: 15px')}</label>`;
const listRow = (main, sub, right, action) => `<div style="display: flex; align-items: center; gap: 14px; min-height: 60px; padding: 8px 4px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${main}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${right ? mono(right, 'font-size: 15px') : ''}${action}</div>`;

// Park and resume: "Park" in the basket keeps the sale; a count appears by
// the basket's title and opens this list.
screens['till-park'] = {
  desktop: overTill(dialog('park-title', 'Parked sales', 'Kept on this till until someone resumes or clears them', `
<div>${listRow('Maya Patel · 3 items', 'Parked by Jo Taylor · [time]', money(TOTAL), button('Resume', { variant: 'default' }))}${listRow('[No customer] · [n] items', 'Parked by [name] · [time]', '[£ total]', button('Resume', { variant: 'default' }))}</div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">Resuming puts the parked sale back in the basket. Anything already in the basket is parked in its place.</p>`, '', 600)),
};

// Find a past sale — by receipt number, customer, card or date.
const datePill = (t, on = false) => `<button type="button" aria-pressed="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.ink : C.panel}; color: ${on ? C.panel : C.ink}; font-family: inherit; font-size: 14px; font-weight: 600">${t}</button>`;
// Decision 13: scan or type the receipt number; today's sales on this till
// underneath; older sales are found on the customer's page.
screens['till-find'] = {
  desktop: overTill(dialog('find-title', 'Past sales', 'Scan the receipt, or pick from today', `
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid ${C.ink}; border-radius: 8px; background: ${C.panel}; color: ${C.muted}">${icon('scan', 20)}<input aria-label="Scan or type the receipt number" placeholder="Scan or type the receipt number, e.g. B1-0001" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>
<div style="display: flex; flex-direction: column"><div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}; padding-bottom: 6px">Today on Till B1</div>
${listRow(`${mono('B1-[0000]')} · Maya Patel`, '[time] · 3 items · card · Jo Taylor', money(TOTAL), button('Open', { variant: 'default' }))}
${listRow(`${mono('B1-[0000]')} · [No customer]`, '[time] · [n] items · cash · [name]', '[£ total]', button('Open', { variant: 'default' }))}</div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">Older sale? Find the customer — their page shows every sale. No receipt and no customer: store credit only.</p>`, '', 640)),
};

// Refund (decision 9): from the original sale; money back the way it was paid.
screens['till-refund'] = {
  desktop: overTill(dialog('refund-title', `Refund from ${'B1-[0000]'}`, 'Maya Patel · today · paid by card', `
<div>${tickRow('Shimano brake pads', 'Part · B05S-RX · 1 of 2', '£28.00', true)}${tickRow('Shimano brake pads', 'Part · B05S-RX · 2 of 2', '£28.00', false)}${tickRow('Fit & adjust brakes', 'Labour · 30 min', '£18.00', false)}</div>
<div role="group" aria-label="Reason" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Reason</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${reasonPill('[Shop’s reason]', true)}${reasonPill('[Shop’s reason]')}${reasonPill('Other…')}</div></div>
<div style="display: flex; justify-content: space-between; align-items: baseline; padding: 14px 16px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">Refund to the card</span><span style="font-size: 13px; color: ${C.muted}">Sent to the card machine — the customer taps the same card</span></span>${mono('£28.00', 'font-size: 26px')}</div>`, `${button('Back', { variant: 'ghost' })}${button('Refund £28.00 to the card')}`, 600)),
};
screens['till-refund-noreceipt'] = {
  desktop: overTill(dialog('noreceipt-title', 'No receipt or record', 'Refunds without the original sale go on store credit', `
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${C.muted}">Scan or pick what’s coming back, and the value goes on the customer’s store credit to spend another time.</p>
<div>${tickRow('[Item coming back]', '[Part number]', '[£ price]', true)}</div>
<div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 12px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.panel}">${icon('user', 18)}<span style="font-size: 15px; font-weight: 600; flex-grow: 1">[Customer]</span><span style="font-size: 13px; color: ${C.muted}">needed for store credit</span></div>`, `${button('Back', { variant: 'ghost' })}${button('Add [£] to store credit')}`, 600)),
};

// Void a sale that shouldn't stand — with a reason.
screens['till-void'] = {
  desktop: overTill(dialog('void-title', 'Void this sale', `${'B1-[0000]'} · Maya Patel · ${money(TOTAL)} · card`, `
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${C.muted}">The sale is kept, marked void, and taken out of the day’s takings. Card money goes back through the card machine; stock goes back on the shelf.</p>
<div role="group" aria-label="Reason" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Reason</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${reasonPill('[Shop’s reason]', true)}${reasonPill('[Shop’s reason]')}${reasonPill('Other…')}</div></div>`, `${button('Keep the sale', { variant: 'ghost' })}${button('Void sale', { variant: 'danger' })}`, 560)),
};

// Pay for a workshop job: the job's approved work loads into the basket
// (journey A, decision 12). Paying also records collection by default,
// with a pill to say the bike stays (Workshop day decision 63).
const jobLines = LINES_APPROVED.filter((l) => l.approval === 'Approved').map((l) => ({ name: l.work, sub: l.sub, price: l.price, qty: 1 }));
function jobBasket(collected = true, extra = []) {
  const b = basket([...jobLines, ...extra], { customer: 'Maya Patel · workshop job WH-1042' });
  const pill = `<button type="button" aria-pressed="${collected}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${collected ? C.ink : C.border}; background: ${collected ? C.ink : 'transparent'}; color: ${collected ? C.panel : C.muted}; font-family: inherit; font-size: 14px; font-weight: 600">${collected ? icon('check', 15, C.panel) : ''}Bike collected when paid</button>`;
  const discount = /<a href="#" style="align-self: flex-start;[^>]*>Add a discount<\/a>/;
  const m = b.match(discount);
  if (!m) throw new Error('basket discount link not found');
  return b.replace(m[0], `<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">${m[0].replace('align-self: flex-start; ', '')}${pill}</div>`);
}
screens['till-job'] = { desktop: tillPage(leftSide(), jobBasket()) };

// Hand over a click and collect order.
screens['till-collect'] = {
  desktop: overTill(dialog('collect-title', 'Click and collect · order [number]', '[Customer] · paid online [date]', `
<div>${tickRow('[Item]', '[Size or colour] · from [shelf or storage spot]', '[£ price]', false)}${tickRow('[Item]', '[Size or colour]', '[£ price]', false)}</div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">Tick each item as you hand it over. Already paid online — nothing to take at the till.</p>`, `${button('Not now', { variant: 'ghost' })}${button('Mark collected')}`, 600)),
};

// ---------- When the internet drops (offline spec §3) ----------
// Selling carries on: sales are saved on this till and send themselves, in
// order, when the connection is back. No time limit; after four hours the
// notice grows, because prices and customer details may be out of date.
// Wheelhouse itself being unreachable counts the same. "[n]" = placeholder.
const notice = (strong) => `<div role="status" style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: ${strong ? '14px 20px' : '10px 20px'}; background: ${strong ? C.warnBg : C.mutedBg}; color: ${strong ? C.warnInk : C.ink}; border-bottom: 1px solid ${C.border}">${icon(strong ? 'alert' : 'wifi', strong ? 22 : 18)}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: ${strong ? 16 : 14}px; font-weight: 700">${strong ? 'Offline for over 4 hours — prices and customer details may be out of date' : 'No internet — keep selling. Sales are saved on this till and send themselves when it’s back.'}</span>${strong ? `<span style="font-size: 14px">Sales are still saved safely. Check prices on anything that changed recently.</span>` : ''}</span></div>`;
screens['till-offline'] = { desktop: tillPage(leftSide(), basket([PADS, BRAKES]), { offline: '[n]', notice: notice(false) }) };
screens['till-offline-long'] = { desktop: tillPage(leftSide(), basket([PADS, BRAKES]), { offline: '[n]', offlineLong: true, notice: notice(true) }) };
const overTillOffline = (d) => `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">${tillPage(leftSide(), basket([PADS, BRAKES]), { offline: '[n]', notice: notice(false) })}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box">${d}</div></div>`;
screens['till-needs-net'] = {
  desktop: overTillOffline(dialog('net-title', 'Refunds need the internet', 'The till is offline', `
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${C.muted}">A refund has to find the original sale, so it waits for the connection. The same goes for paying for a workshop job, changing products or prices, and reports.</p>
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${C.muted}">Sales, parking, customers, accounts and loyalty all carry on as normal.</p>`, `<span></span>${button('OK')}`, 520)),
};
screens['till-no-signout'] = {
  desktop: overTillOffline(dialog('signout-title', 'Can’t sign this till out yet', '[n] sales are still waiting to send', `
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${C.muted}">Signing out would wipe sales that only exist on this till. It works as soon as they’ve sent — they go by themselves when the internet is back.</p>`, `<span></span>${button('OK')}`, 520)),
};
screens['till-failed'] = {
  desktop: overTill(dialog('failed-title', 'Sales that didn’t send', 'Kept safely on this till — a manager checks each one', `
<div>${listRow(`${mono('B1-[0000]')} · [n] items`, '[Reason from Wheelhouse, in plain words]', '[£ total]', button('Fix', { variant: 'default' }))}${listRow(`${mono('B1-[0000]')} · [n] items`, '[Reason from Wheelhouse, in plain words]', '[£ total]', button('Fix', { variant: 'default' }))}</div>
<p style="margin: 0; font-size: 13px; color: ${C.muted}">Fixing opens the sale with the problem shown. Nothing is deleted.</p>`, '', 620)),
};

// ---------- Audit additions (decision 12) ----------
screens['till-empty'] = { desktop: tillPage(leftSide(), basket([])) };
function noResults() {
  return `<div style="position: relative; flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px">
<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid ${C.ink}; border-radius: 10px; background: ${C.panel}; color: ${C.muted}">${icon('search', 20)}<input type="search" aria-label="Search or scan: products, customers, jobs" value="[what was typed]" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: inherit; font-size: 16px; color: ${C.ink}"></label>
<div role="status" style="position: absolute; top: 60px; left: 0; right: 0; z-index: 3; box-sizing: border-box; padding: 18px 20px; display: flex; flex-direction: column; gap: 6px; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 12px 32px rgba(38,36,32,0.18)"><span style="font-size: 16px; font-weight: 700">Nothing matches “[what was typed]”</span><span style="font-size: 14px; color: ${C.muted}">Try part of the name, a part number, a phone number or a job number — or scan the barcode.</span></div>
</div>`;
}
screens['till-noresults'] = { desktop: tillPage(noResults(), basket([PADS, BRAKES])) };

// Past sales → a sale: Refund, Void, Reprint (decision 12).
screens['till-sale-detail'] = {
  desktop: overTill(dialog('detail-title', `Sale ${'B1-[0000]'}`, 'Today [time] · Maya Patel · Jo Taylor serving · card', `
<div>${listRow('Shimano brake pads × 2', 'Part · B05S-RX', '£56.00', '')}${listRow('Fit & adjust brakes', 'Labour · 30 min', '£18.00', '')}</div>
<div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 16px; font-weight: 700">Total · card</span>${mono(money(TOTAL), 'font-size: 22px')}</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">${button('Refund', { variant: 'default' })}${button('Reprint receipt', { variant: 'default' })}${button('Void', { variant: 'danger' })}</div>`, '', 600)),
};

// Refund a cash sale: money back in cash, the drawer opens.
screens['till-refund-cash'] = {
  desktop: overTill(dialog('refundcash-title', `Refund from ${'B1-[0000]'}`, 'Maya Patel · today · paid in cash', `
<div>${tickRow('Shimano brake pads', 'Part · B05S-RX · 1 of 2', '£28.00', true)}${tickRow('Shimano brake pads', 'Part · B05S-RX · 2 of 2', '£28.00', false)}${tickRow('Fit & adjust brakes', 'Labour · 30 min', '£18.00', false)}</div>
<div role="group" aria-label="Reason" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">Reason</span><div style="display: flex; flex-wrap: wrap; gap: 8px">${reasonPill('[Shop’s reason]', true)}${reasonPill('[Shop’s reason]')}${reasonPill('Other…')}</div></div>
<div style="display: flex; justify-content: space-between; align-items: baseline; padding: 14px 16px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.panel}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">Give back in cash</span><span style="font-size: 13px; color: ${C.muted}">The drawer opens when you confirm</span></span>${mono('£28.00', 'font-size: 26px')}</div>`, `${button('Back', { variant: 'ghost' })}${button('Refund £28.00 · open the drawer')}`, 600)),
};

// ---------- Deposits on a workshop job (decision 11) ----------
const JOB_DEPOSIT = WORK_TOTAL_APPROVED * 0.25; // 25% chosen in the example
screens['till-job-deposit'] = {
  desktop: `<div style="position: relative; width: ${DW}px; height: ${DH}px; overflow: hidden">${tillPage(leftSide(), jobBasket(false))}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box">${dialog('jobdep-title', `Take a deposit · job WH-1042 · ${money(WORK_TOTAL_APPROVED)}`, 'Maya Patel · Trek Domane AL 3', `
<div role="group" aria-label="How much now" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px">${pctPill('10%')}${pctPill('25%', true)}${pctPill('50%')}${pctPill('Other')}</div>
<div style="display: flex; flex-direction: column; padding: 4px 16px 8px; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}">${infoRow('Deposit now', money(JOB_DEPOSIT), true)}${infoRow('Paid at collection', money(WORK_TOTAL_APPROVED - JOB_DEPOSIT))}</div>
<div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.mutedBg}; font-size: 14px">${icon('workshop', 18)}<span><strong>Bike stays in.</strong> “Bike collected when paid” is switched off for now — it comes back on when the rest is paid.</span></div>`, `${button('Back', { variant: 'ghost' })}${button(`Take ${money(JOB_DEPOSIT)} now`)}`, 600)}</div></div>`,
};
screens['till-job-balance'] = {
  desktop: tillPage(leftSide(), jobBasket(true, [{ name: 'Deposit paid', sub: '[date] · card', price: -JOB_DEPOSIT, qty: 1, fixed: true }])),
};

export const TITLES = {
  'till-sale': 'Sale — quick buttons by group, basket on the right',
  'till-line': 'Change a line — price, discount with a reason, note, remove',
  'till-discount': 'Discount the whole sale',
  'till-customer': 'Add a customer — search, or add someone new',
  'till-variant': 'Choose size and colour',
  'till-serial': 'Record a frame number',
  'till-pay': 'Take payment — card is one tap',
  'till-card': 'Card — the amount is on the card machine, waiting for the card',
  'till-card-declined': 'Card declined',
  'till-pay-cash': 'Cash — notes to tap, change worked out',
  'till-pay-split': 'Split payment — part paid, the rest by card',
  'till-receipt': 'Paid — receipt choices, closes by itself',
  'till-giftcard': 'Gift card or store credit',
  'till-account': 'Put on account — pay later',
  'till-loyalty': 'Loyalty points — shown with the customer in the basket',
  'till-deposit': 'Take a deposit — part now, the rest later',
  'till-park': 'Parked sales — resume',
  'till-find': 'Past sales — scan the receipt, or today’s list',
  'till-refund': 'Refund from the original sale — back to the card',
  'till-refund-noreceipt': 'No receipt — store credit only',
  'till-void': 'Void a sale — with a reason',
  'till-job': 'Pay for a workshop job — bike collected when paid',
  'till-collect': 'Hand over a click and collect order',
  'till-empty': 'Empty basket',
  'till-noresults': 'Search with no results',
  'till-sale-detail': 'A past sale — refund, reprint, void',
  'till-refund-cash': 'Refund a cash sale — back in cash',
  'till-job-deposit': 'Deposit on a workshop job — bike stays in',
  'till-job-balance': 'Workshop job back for collection — deposit taken off, pay the rest',
  'till-offline': 'Offline — keep selling, sales wait to send',
  'till-offline-long': 'Offline for over four hours — the notice grows',
  'till-needs-net': 'Needs the internet — refunds and a few others wait',
  'till-no-signout': 'Can’t sign out while sales are waiting',
  'till-failed': 'Sales that didn’t send — for a manager',
};
export const ROWS = [
  { label: 'A sale', screens: ['till-sale', 'till-empty', 'till-noresults', 'till-line', 'till-discount', 'till-customer', 'till-variant', 'till-serial'] },
  { label: 'Taking payment', screens: ['till-pay', 'till-card', 'till-card-declined', 'till-pay-cash', 'till-pay-split', 'till-receipt'] },
  { label: 'Other ways to pay', screens: ['till-giftcard', 'till-account', 'till-loyalty', 'till-deposit'] },
  { label: 'Other till jobs', screens: ['till-park', 'till-find', 'till-sale-detail', 'till-refund', 'till-refund-cash', 'till-refund-noreceipt', 'till-void', 'till-job', 'till-job-deposit', 'till-job-balance', 'till-collect'] },
  { label: 'When the internet drops', screens: ['till-offline', 'till-offline-long', 'till-needs-net', 'till-no-signout', 'till-failed'] },
];
