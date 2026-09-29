// Journey 16 — End-of-day cash-up, designed in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-09-29-cash-up-review.md
//
// One "Close the day" page for the till, its six steps as sections that fold
// (Workshop day decision 30: one page, sections may fold). Built inside the
// till frame (app-map.mjs: foldedRail, tillBar, tillPhoneBar). Drawn at
// desktop, tablet and phone from one recipe per screen (the journey 11
// pattern: def() + CUR). Real example data: North Street Cycles, Bolton,
// Till B1, Jack Lewis (Manager), Maya Patel's card sale of £74.00. Every
// takings figure is a bracketed placeholder — there is no real day's data.
import { C, MONO, esc, icon, button, card, field } from './ui.mjs';
import { DW, DH, PW, PH } from './stage1.mjs';
import { TW, TH } from './diary.mjs';
import { foldedRail, tillBar, tillPhoneBar } from './app-map.mjs';

let CUR = 'desktop';
const WH = () => ({ desktop: [DW, DH], tablet: [TW, TH], phone: [PW, PH] })[CUR];
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
const P = () => CUR === 'phone';

// ---------- The page ----------
function page(content) {
  const [W, H] = WH();
  const head = `<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap"><h1 style="margin: 0; font-size: ${P() ? 22 : 26}px; font-weight: 700">Close the day</h1><span style="font-size: 14px; color: ${C.muted}">Till B1 · Bolton · [today’s date]</span></div>`;
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; overflow-y: auto; box-sizing: border-box; padding: ${P() ? '14px' : '22px 28px'}; display: flex; flex-direction: column; gap: 12px"><div style="width: 100%; max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px">${head}${content}</div></div>`;
  if (P()) return `<div style="width: ${W}px; height: ${H}px; display: flex; flex-direction: column; background: ${C.bg}; overflow: hidden">${tillPhoneBar('Jack Lewis')}${body}</div>`;
  return `<div style="position: relative; width: ${W}px; height: ${H}px; display: flex; background: ${C.bg}">${foldedRail('till')}<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">${tillBar({ serving: 'Jack Lewis' })}${body}</div></div>`;
}

// A step: number, title, a status on the right; open steps show their content.
const STATUS = {
  done: [C.okBg, C.successInk, 'check'],
  todo: [C.mutedBg, C.ink, null],
  wait: [C.warnBg, C.warnInk, 'alert'],
};
function step(n, title, status, statusText, content = '') {
  const [bg, ink, ic] = STATUS[status];
  const open = !!content;
  return card(`<div style="display: flex; flex-direction: column">
<button type="button" aria-expanded="${open}" style="display: flex; align-items: center; gap: 14px; width: 100%; min-height: 60px; box-sizing: border-box; padding: 10px 18px; border: 0; background: transparent; font-family: inherit; text-align: left; color: ${C.ink}">
<span style="display: inline-flex; width: 30px; height: 30px; flex-shrink: 0; border-radius: 999px; align-items: center; justify-content: center; background: ${bg}; color: ${ink}; font-size: 14px; font-weight: 700">${ic ? icon(ic, 16) : n}</span>
<span style="font-size: 17px; font-weight: 700; flex-grow: 1">${title}</span>
<span style="font-size: 13px; font-weight: 600; color: ${status === 'todo' ? C.muted : ink}; text-align: right">${statusText}</span>
<span style="display: inline-flex; transform: rotate(${open ? 180 : 0}deg); color: ${C.muted}">${icon('chevron', 16)}</span>
</button>
${open ? `<div style="padding: 4px 18px 18px; display: flex; flex-direction: column; gap: 14px; border-top: 1px solid ${C.border}"><div style="height: 10px"></div>${content}</div>` : ''}
</div>`);
}
const note = (t) => `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${C.muted}">${t}</p>`;
const row = (k, v, strong = false) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 0; border-top: 1px solid ${C.border}"><span style="font-size: 15px; ${strong ? 'font-weight: 700' : ''}">${k}</span>${mono(v, `font-size: ${strong ? 20 : 15}px`)}</div>`;

// ---------- Step content ----------
// 1. Every till has sent its sales (offline spec §8).
const stepTills = (waiting) => step(1, 'Every till has sent its sales', waiting ? 'wait' : 'done', waiting ? '[n] sales waiting' : 'All sent',
  waiting ? `${note('Till B1 still has [n] sales waiting to send. The day can’t close until they’ve gone — they send by themselves when the internet is back.')}<div>${button('Check again', { variant: 'default' })}</div>` : '');
// 2. Anything flagged.
const stepAttention = (open) => step(2, 'Needs attention', open ? 'wait' : 'done', open ? '[n] to check' : 'Nothing flagged', open ? `
${['[Unknown product on a sale]', '[A payment that doesn’t add up]'].map((t) => `<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">${t}</span><span style="font-size: 13px; color: ${C.muted}">${mono('B1-[0000]')} · [time]</span></span>${button('Check', { variant: 'default' })}</div>`).join('')}` : '');

// 3. Cash count (decisions 2, 3): a box for every note and coin, adding up to
// a total that can be typed over. Blind: the expected amount is shown only
// after counting — unless the shop turns blind counting off.
const DENOMS = [['£50', 50], ['£20', 20], ['£10', 10], ['£5', 5], ['£2', 2], ['£1', 1], ['50p', 0.5], ['20p', 0.2], ['10p', 0.1], ['5p', 0.05], ['2p', 0.02], ['1p', 0.01]];
const EXAMPLE_COUNT = { '£20': 6, '£10': 5, '£5': 4, '£2': 3, '£1': 8, '50p': 6, '20p': 5, '10p': 7 }; // example counts typed by staff
const countTotal = DENOMS.reduce((s, [d, v]) => s + (EXAMPLE_COUNT[d] || 0) * v, 0);
function denomGrid(filled) {
  const cols = P() ? 2 : CUR === 'tablet' ? 3 : 4;
  return `<div role="group" aria-label="Count each note and coin" style="display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 10px">${DENOMS.map(([d, v]) => {
    const n = filled ? EXAMPLE_COUNT[d] || 0 : '';
    return `<label style="display: flex; align-items: center; gap: 10px; min-height: 52px; box-sizing: border-box; padding: 6px 10px; border: 1px solid ${C.border}; border-radius: 10px; background: ${C.panel}"><span style="min-width: 36px; font-size: 15px; font-weight: 700">${d}</span><span style="font-size: 13px; color: ${C.muted}">×</span><input inputmode="numeric" aria-label="Number of ${d}" value="${n}" style="width: 52px; min-height: 40px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 15px; color: ${C.ink}">${P() ? '' : `<span style="flex-grow: 1; text-align: right; font-family: ${MONO}; font-size: 13px; color: ${C.muted}">${filled && n ? `£${(n * v).toFixed(2)}` : ''}</span>`}</label>`;
  }).join('')}</div>`;
}
const totalBox = (value) => `<label style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 1px solid ${C.ink}; background: ${C.panel}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">Cash counted</span><span style="font-size: 13px; color: ${C.muted}">Adds up from the boxes — or type the total</span></span><input aria-label="Cash counted, total" value="${value}" style="width: 140px; min-height: 48px; box-sizing: border-box; text-align: right; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.input}; background: #ffffff; font-family: ${MONO}; font-size: 22px; color: ${C.ink}"></label>`;
function stepCount(mode) {
  const total = `£${countTotal.toFixed(2)}`;
  if (mode === 'blind') return step(3, 'Count the cash', 'todo', 'To do', `${note('Count the drawer and fill in how many of each. The till shows what it expected once you’ve finished.')}${denomGrid(true)}${totalBox(total)}<div style="display: flex; justify-content: flex-end">${button('Done counting — show the difference')}</div>`);
  if (mode === 'shown') return step(3, 'Count the cash', 'todo', 'To do', `${note('Count the drawer and fill in how many of each.')}<div style="display: flex; justify-content: space-between; align-items: baseline; padding: 10px 14px; border-radius: 8px; background: ${C.mutedBg}"><span style="font-size: 15px">The till expects</span>${mono('[£ expected]', 'font-size: 18px')}</div>${denomGrid(true)}${totalBox(total)}<div style="display: flex; justify-content: flex-end">${button('Done counting')}</div>`);
  // result
  return step(3, 'Count the cash', 'done', 'Counted', `${row('Counted', total)}${row('The till expected', '[£ expected]')}${row('Difference', '[£ over or short]', true)}
<div role="group" aria-label="Reason for a difference" style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 14px; font-weight: 600">If there’s a difference, why? <span style="font-weight: 400; color: ${C.muted}">(optional)</span></span><input aria-label="Reason for the difference" placeholder="e.g. change given wrongly" style="min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 14px; color: ${C.ink}"></div>
<div style="display: flex; justify-content: space-between; gap: 10px">${button('Count again', { variant: 'ghost' })}${button('Keep this count')}</div>`);
}

// 4. Paid-outs and banking (decision 4): leave the standard float, bank the rest.
function stepBanking(open) {
  if (!open) return step(4, 'Paid-outs and banking', 'todo', 'To do');
  return step(4, 'Paid-outs and banking', 'todo', 'To do', `
<div style="display: flex; flex-direction: column"><span style="font-size: 14px; font-weight: 700; padding-bottom: 6px">Cash taken out today</span>
<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">[What it was for]</span><span style="font-size: 13px; color: ${C.muted}">[time] · [name]</span></span>${mono('[£ amount]', 'font-size: 15px')}</div>
<div style="padding-top: 6px">${button('Add a paid-out', { variant: 'default' })}</div></div>
<div style="display: flex; flex-direction: column; padding: 6px 16px 10px; border-radius: 10px; border: 1px solid ${C.ink}; background: ${C.panel}">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 0"><span style="font-size: 16px; font-weight: 700">Leave in the drawer</span>${mono('[£ float]', 'font-size: 20px')}</div>
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="font-size: 16px; font-weight: 700">Bank</span>${mono('[£ counted − float]', 'font-size: 20px')}</div>
</div>
${note('The float is the shop’s standard amount, so tomorrow starts the same. Bag the rest for the bank.')}
<div style="display: flex; justify-content: flex-end">${button('Banking bagged')}</div>`);
}

// 5. Card check: the connected card machine (journey 11 decision 6) sends its
// own total, so matching is usually automatic.
function stepCard(state) {
  if (state === 'matched') return step(5, 'Card sales match the card machine', 'done', 'Matched');
  return step(5, 'Card sales match the card machine', 'wait', 'Doesn’t match', `${row('Card sales in Wheelhouse', '[£ Wheelhouse total]')}${row('Card machine’s own total', '[£ machine total]')}${row('Difference', '[£ difference]', true)}
${note('Usually a payment keyed in on the machine by hand and not recorded on the till, or one recorded twice. The list below shows payments that don’t pair up.')}
<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><span style="font-size: 15px; font-weight: 600">On the card machine only</span><span style="font-size: 13px; color: ${C.muted}">[time] · [£ amount] · card ending [0000]</span></span>${button('Match to a sale', { variant: 'default' })}</div>`);
}

// 6. Finish: the end-of-day report.
const stepFinish = (open) => step(6, 'End-of-day report', 'todo', open ? 'Ready' : 'After the steps above', open ? `${note('Everything above is done. Closing the day saves the report and starts tomorrow with the float.')}<div style="display: flex; justify-content: flex-end">${button('Close the day and show the report')}</div>` : '');

// The report itself (a pop-up over the page on desktop and tablet).
function reportDialog() {
  const body = `${row('Sales', '[£ total]', true)}${row('Card', '[£]')}${row('Cash', '[£]')}${row('Gift cards, credit, accounts, other', '[£]')}${row('Refunds', '[£]')}${row('Voids', '[n] · [£]')}${row('Discounts given', '[n] · [£]')}${row('VAT in today’s sales', '[£]')}${row('Cash difference', '[£ over or short]')}${row('Banked', '[£]')}`;
  if (P()) return `<div role="dialog" aria-modal="true" aria-labelledby="z-title" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: ${C.bg}"><div style="display: flex; align-items: center; gap: 10px; padding: 12px 8px 12px 16px; background: ${C.panel}; border-bottom: 1px solid ${C.border}"><h2 id="z-title" style="margin: 0; font-size: 18px; font-weight: 700; flex-grow: 1">Day closed · Till B1</h2><a href="#" aria-label="Close" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; color: ${C.ink}">${icon('close', 20)}</a></div><div data-scroll style="flex-grow: 1; overflow-y: auto; padding: 8px 16px">${body}</div><div style="display: flex; justify-content: space-between; gap: 10px; padding: 12px 16px 16px; border-top: 1px solid ${C.border}; background: ${C.panel}">${button('Email', { variant: 'default' })}${button('Print')}</div></div>`;
  return `<div role="dialog" aria-modal="true" aria-labelledby="z-title" style="width: 560px; max-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 12px; box-shadow: 0 18px 48px rgba(38,36,32,0.28); overflow: hidden">
<div style="display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 22px; background: ${C.panel}; border-bottom: 1px solid ${C.border}"><div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1"><h2 id="z-title" style="margin: 0; font-size: 20px; font-weight: 700">Day closed · Till B1</h2><span style="font-size: 13px; color: ${C.muted}">[today’s date] · closed by Jack Lewis · saved to Reports</span></div><a href="#" aria-label="Close" style="width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: ${C.ink}">${icon('close', 20)}</a></div>
<div style="padding: 8px 22px 16px">${body}</div>
<div style="display: flex; justify-content: space-between; gap: 10px; padding: 14px 22px; border-top: 1px solid ${C.border}; background: ${C.panel}">${button('Email it', { variant: 'ghost' })}${button('Print')}</div>
</div>`;
}
function overlay(base, d) {
  const [W, H] = WH();
  if (P()) return `<div style="width: ${W}px; height: ${H}px; display: flex">${d}</div>`;
  return `<div style="position: relative; width: ${W}px; height: ${H}px; overflow: hidden">${base}<div style="position: absolute; inset: 0; background: rgba(38,36,32,0.45); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box">${d}</div></div>`;
}

// ---------- Screens ----------
export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
def('eod-waiting', () => page(`${stepTills(true)}${stepAttention(false)}${step(3, 'Count the cash', 'todo', 'To do')}${stepBanking(false)}${stepCard('matched')}${stepFinish(false)}`));
def('eod-attention', () => page(`${stepTills(false)}${stepAttention(true)}${step(3, 'Count the cash', 'todo', 'To do')}${stepBanking(false)}${stepCard('matched')}${stepFinish(false)}`));
def('eod-count', () => page(`${stepTills(false)}${stepAttention(false)}${stepCount('blind')}${stepBanking(false)}${stepCard('matched')}${stepFinish(false)}`));
def('eod-count-shown', () => page(`${stepTills(false)}${stepAttention(false)}${stepCount('shown')}${stepBanking(false)}${stepCard('matched')}${stepFinish(false)}`));
def('eod-count-result', () => page(`${stepTills(false)}${stepAttention(false)}${stepCount('result')}${stepBanking(false)}${stepCard('matched')}${stepFinish(false)}`));
def('eod-banking', () => page(`${stepTills(false)}${stepAttention(false)}${step(3, 'Count the cash', 'done', 'Counted')}${stepBanking(true)}${stepCard('matched')}${stepFinish(false)}`));
def('eod-card', () => page(`${stepTills(false)}${stepAttention(false)}${step(3, 'Count the cash', 'done', 'Counted')}${step(4, 'Paid-outs and banking', 'done', 'Bagged')}${stepCard('mismatch')}${stepFinish(false)}`));
def('eod-finish', () => page(`${stepTills(false)}${stepAttention(false)}${step(3, 'Count the cash', 'done', 'Counted')}${step(4, 'Paid-outs and banking', 'done', 'Bagged')}${stepCard('matched')}${stepFinish(true)}`));
def('eod-z', () => overlay(page(`${stepTills(false)}${stepAttention(false)}${step(3, 'Count the cash', 'done', 'Counted')}${step(4, 'Paid-outs and banking', 'done', 'Bagged')}${stepCard('matched')}${step(6, 'End-of-day report', 'done', 'Closed')}`), reportDialog()));

for (const size of ['desktop', 'tablet', 'phone']) {
  CUR = size;
  for (const [id, fn] of recipes) (screens[id] ??= {})[size] = fn();
}
CUR = 'desktop';

export const TITLES = {
  'eod-waiting': 'Close the day — a till still has sales waiting',
  'eod-attention': 'Close the day — sales that need checking',
  'eod-count': 'Count the cash — note by note (blind)',
  'eod-count-shown': 'Count the cash — with the expected amount shown (shop setting)',
  'eod-count-result': 'Count the cash — the difference',
  'eod-banking': 'Paid-outs and banking — leave the float, bank the rest',
  'eod-card': 'Card sales don’t match the card machine',
  'eod-finish': 'Ready to close the day',
  'eod-z': 'Day closed — the end-of-day report',
};
export const ROWS = [
  { label: 'Close the day', screens: ['eod-waiting', 'eod-attention', 'eod-count', 'eod-count-shown', 'eod-count-result', 'eod-banking', 'eod-card', 'eod-finish', 'eod-z'] },
];
