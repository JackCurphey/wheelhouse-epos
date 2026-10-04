// Journey 7 — Account, history and reminders, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-account-and-reminders-review.md
// UI audit: docs/design/user-journeys/account-ui-audit.md (decision 8: every
// recommendation taken)
//
// Decision 1: one account page, the same shape as the staff customer page.
// 2: a reminder time per service; customers say yes once. 3: conversations
// live on the website (a job's page, and "Ask the shop a question"). 4: "Your
// data" — an instant copy, and deletion as a request. 5: a review request
// after collection, off by default. 6: one "How we contact you" section and a
// one-click stop in every optional message. 7: the staff Messages page is an
// inbox with two panes.
//
// Real example data only: Maya Patel, 07700 900 142, maya@example.test, Trek
// Domane AL 3 · green · black mudguards (bought here, under warranty), WH-1042
// and its Standard service (£65.00), Jo Taylor, Alex Morgan, North Street
// Cycles, Bolton, and the customers on journey 15's list. What people write to
// each other, past jobs and purchases, dates and amounts are bracketed
// placeholders — nothing here is invented as if real.
import { C, MONO, esc, icon, button, card, badge, field } from './ui.mjs';
import { page, pill, note, popup, overlay, withSize, isPhone, settingsPage, workshopFolds, WORKSHOP_INTRO, rowSwitch, choice } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { today } from './opening.mjs';
import { msgPage, msgListOpen, servicesOpen, wordingBox, bubble } from './setup.mjs';
import { inShopAt } from './quote.mjs';
import { detailsRemindAt, whenFromReminderAt } from './book.mjs';
import { summaryRemindAt, receiptBodyAt } from './collect.mjs';
import { privacyPageAt, customerPageWith } from './customer.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const MAYA = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3', bikeLong: 'Trek Domane AL 3 · green · black mudguards' };
// Audit M1: the customer is told they'll hear back the way they chose —
// Maya chose text at booking (Book a repair 6).
const HEAR = 'text you';

// ---------- The customer's website ----------
const site = (content) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Account', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Account') : sitePhone('sand', { content: body });
};
const cardBox = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 10px">${inner}</div>`, extra);
const h2 = (t, id) => `<h2 id="${id}" style="margin: 0; font-size: 18px; font-weight: 700">${t}</h2>`;
const h3 = (t, id) => `<h3 id="${id}" style="margin: 0; font-size: 16px; font-weight: 700">${t}</h3>`;
const p = (t, extra = '') => `<p style="margin: 0; font-size: 15px; line-height: 1.5; ${extra}">${t}</p>`;
const linkStyle = `display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; justify-content: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}`;
// Audit M9: a link says which part it changes; an action is a button.
const link = (t, label = '') => `<a href="#"${label ? ` aria-label="${esc(label)}"` : ''} style="${linkStyle}">${t}</a>`;
const actBtn = (t) => `<button type="button" style="${linkStyle}; padding: 0; border: 0; background: transparent; font-family: inherit; text-decoration: underline; text-align: left">${t}</button>`;
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px"><span style="color: ${C.muted}">${k}</span><span style="text-align: right; font-weight: 600">${v}</span></div>`;
const backTo = (t) => `<a href="#" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;
const statusBar = (t) => `<p role="status" style="margin: 0; display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px; font-weight: 600; line-height: 1.45"><span style="flex-shrink: 0; display: inline-flex; padding-top: 2px">${icon('check', 18)}</span><span style="flex: 1 1 0; min-width: 0">${t}</span></p>`;
const warnBar = (t, action = '') => `<div role="status" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">${icon('alert', 18)}<span style="flex-grow: 1">${t}</span>${action}</div>`;

// ---------- The account page (decision 1; audit M2) ----------
// Left: bikes (warranty, next service, Book a repair — UX walk-through 1 L1), store credit, and one
// card for details and how we contact you. Right: one history, newest first,
// then Your data.
const warranty = `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${C.successInk}">${icon('check', 14)}Bought here · under warranty, [n] months left</span>`;
// UX walk-through 5 M5: after collection, the Cycle to Work bike joins her
// bikes, with its frame number.
const c2wBike = () => `<div style="display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 16px; font-weight: 700">[Bike] · [Size]</span><span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${C.successInk}">${icon('check', 14)}Bought here on Cycle to Work · under warranty, [n] months left</span><span style="font-size: 13px; color: ${C.muted}">Frame ${mono('[frame number]')}</span>
<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px">${button('Book a repair', { variant: 'default' }).replace('<button', '<button aria-label="Book a repair for your [Bike]"')}</div></div>`;
function bikes(empty, reminders, c2w = '') {
  if (empty) return cardBox(`${h2('Your bikes', 'a-bikes')}${p('No bikes yet. Add one to book it in faster.', `color: ${C.muted}`)}<div>${button('+ Add a bike', { variant: 'default' })}</div>`);
  // Audit L10: when the reminder is due — only while reminders are on.
  return cardBox(`${h2('Your bikes', 'a-bikes')}
<div style="display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 16px; font-weight: 700">${MAYA.bikeLong}</span>${warranty}<span style="font-size: 13px; color: ${C.muted}">In the shop now · ${mono('WH-1042')}${reminders ? ' · next service due [date]' : ''}</span>
<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px">${button('Book a repair', { variant: 'default' })}</div></div>${c2w === 'collected' ? c2wBike() : ''}
<div>${link('+ Add a bike')}</div>`);
}
const credit = () => cardBox(`${h2('Store credit', 'a-credit')}<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px">${mono('£[credit]', 'font-size: 24px')}<span style="font-size: 13px; color: ${C.muted}">Use it in the shop or online</span></div>`);
// Decision 6 and audit M2: details and how we contact you, one card.
const CONTACT_ON = { channel: 'Text', reminders: true, reviews: true, offers: false };
const CONTACT_NEW = { channel: 'Text', reminders: false, reviews: false, offers: false };
const aboutYou = (c) => cardBox(`<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">${h2('Your details', 'a-details')}${link('Edit', 'Edit your details')}</div><div>${kv('Name', MAYA.name)}${kv('Mobile', mono(MAYA.phone))}${kv('Email', MAYA.email)}</div>
<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 8px">${h3('How we contact you', 'a-contact')}${link('Change', 'Change how we contact you')}</div>
<div>${kv('Job updates', `By ${c.channel.toLowerCase()}`)}${kv('Service reminders', c.reminders ? 'On' : 'Off')}${kv('Review requests', c.reviews ? 'On' : 'Off')}${kv('Offers and news', c.offers ? 'On' : 'Off')}</div>`);
// Decision 4; audit H3: a request waiting shows here, and can be cancelled.
const yourData = (pending) => cardBox(`${h2('Your data', 'a-data')}
<div style="display: flex; flex-direction: column; align-items: flex-start">${actBtn('Download a copy of your data')}${pending ? `<p style="margin: 6px 0; font-size: 15px; line-height: 1.5">You asked us to delete your account on [date]. We’ll finish by [date].</p>${button('Cancel my request', { variant: 'default' })}` : actBtn('Ask us to delete your account')}${link('Privacy notice')}</div>`);

// History rows: a kind, what it was, when, and what's on the right.
// Walk-through 12 M5: the line under each title at body size (15px).
const kind = (t) => `<span style="flex-shrink: 0; width: 76px; font-size: 13px; font-weight: 700; color: ${C.muted}">${t}</span>`;
// On a phone the kind joins the line under the title, so the title has room.
const hRow = (k, title, sub, right = '') => `<a href="#" style="display: flex; align-items: center; gap: ${isPhone() ? 8 : 12}px; min-height: 60px; padding: 6px 0; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">${isPhone() ? '' : kind(k)}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600; ${isPhone() ? 'line-height: 1.35' : 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis'}">${title}</span><span style="font-size: 15px; color: ${C.muted}">${isPhone() ? `${k} · ` : ''}${sub}</span></span>${right}<span aria-hidden="true" style="color: ${C.muted}">›</span></a>`;
const subHead = (t) => `<h3 style="margin: 0; padding: 12px 0 4px; font-size: 13px; font-weight: 700; color: ${C.muted}">${t}</h3>`;
// Audit M4: the chip is the tracker's current step.
const repairNow = () => hRow('Repair', `${mono('WH-1042')} · ${MAYA.bike} · Standard service`, 'Booked in Thu 17 Sep · expected ready Thu 17 Sep', badge('In the shop', 'blue'));
// Audit M3: job notes and questions each get a row, titled by their first line.
const noteRow = () => hRow('Message', `Note on ${mono('WH-1042')}`, '[date] · North Street Cycles replied', badge('Replied', 'green'));
const questionRow = (sent) => hRow('Message', '[The first line of Maya’s question]', `[date] · ${sent ? 'waiting for a reply' : 'North Street Cycles replied'}`, badge(sent ? 'Sent' : 'Replied', sent ? 'grey' : 'green'));
// Audit L1: every past row has a receipt.
const pastRepair = () => hRow('Repair', `${mono('WH-[0000]')} · ${MAYA.bike} · [Work done]`, '[date] · collected · receipt', mono('£[total]', 'font-size: 15px'));
const purchase = () => hRow('Purchase', `${mono('B1-[0000]')} · [Items bought]`, '[date] · in the shop · receipt', mono('£[total]', 'font-size: 15px'));
const onlineOrder = () => hRow('Purchase', `Order ${mono('[order number]')} · [Items bought]`, '[date] · online · receipt', mono('£[total]', 'font-size: 15px'));
// UX walk-through 5 M5: her Cycle to Work order has a row, opening the
// order's page (cw-customer-view). UX walk-through 5 H4: while it's open,
// the row says what she pays at collection, from the order's "Who pays what".
const c2wNow = () => `<a href="cw-customer-view-${SIZE}.dc.html" style="display: flex; align-items: center; gap: ${isPhone() ? 8 : 12}px; min-height: 60px; padding: 6px 0; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">${isPhone() ? '' : kind('Cycle to Work')}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600; line-height: 1.35">[Bike] · Waiting for the certificate</span><span style="font-size: 15px; color: ${C.muted}">${isPhone() ? 'Cycle to Work · ' : ''}Quote ${mono('[quote number]')} · put aside until [date]</span><span style="font-size: 14px">What you pay at collection: <strong>${mono('£[£]')}</strong></span></span>${badge('Put aside', 'blue')}<span aria-hidden="true" style="color: ${C.muted}">›</span></a>`;
const c2wPast = () => hRow('Cycle to Work', '[Bike] · Collected', `Quote ${mono('[quote number]')} · collected [date] · receipt`);
function history(filter = 'Everything', { empty = false, talk = '', c2w = '' } = {}) {
  const pills = `<div role="group" aria-label="Show" style="display: flex; gap: 6px; flex-wrap: wrap">${['Everything', 'Repairs', 'Purchases'].map((t) => pill(t, t === filter)).join('')}</div>`;
  const top = `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap">${h2('History', 'a-history')}${pills}</div>`;
  if (empty) return cardBox(`${top}<div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 36px 12px; text-align: center">${p('Nothing here yet. Your repairs and purchases with North Street Cycles show here.', `color: ${C.muted}; max-width: 360px`)}${button('Book a repair')}</div>`);
  const all = filter === 'Everything', repairs = filter !== 'Purchases', buys = filter !== 'Repairs';
  // "Now" holds what's open or waiting; answered messages move to "Earlier".
  const now = [all && c2w === 'open' && c2wNow(), repairs && repairNow(), all && talk === 'answered' && noteRow(), all && talk === 'sent' && questionRow(true)].filter(Boolean).join('');
  const earlier = [buys && c2w === 'collected' && c2wPast(), all && talk === 'answered' && questionRow(false), buys && purchase(), repairs && pastRepair(), buys && onlineOrder(), repairs && pastRepair()].filter(Boolean).join('');
  return cardBox(`${top}<div style="display: flex; flex-direction: column">${now ? `${subHead('Now')}${now}` : ''}${subHead('Earlier, newest first')}${earlier}</div>${link('Show more')}`);
}
function accountPage({ filter = 'Everything', empty = false, talk = '', contact = CONTACT_ON, banner = '', pending = false, c2w = '' } = {}) {
  const c = empty ? CONTACT_NEW : contact;
  const head = `<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap"><div style="display: flex; flex-direction: column; gap: 4px"><h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Your account</h1><span style="font-size: 14px; color: ${C.muted}">${MAYA.name} · ${MAYA.email} · <a href="#" style="color: ${C.ink}; font-weight: 600">Sign out</a></span></div>
<div style="display: flex; flex-wrap: wrap; gap: 8px">${button('Ask the shop a question', { variant: 'default' })}${button('Book a repair')}</div></div>`;
  const left = `<div style="display: flex; flex-direction: column; gap: 16px; width: ${isPhone() ? 'auto' : '360px'}; flex-shrink: 0">${bikes(empty, c.reminders, c2w)}${empty ? '' : credit()}${aboutYou(c)}</div>`;
  const right = `<div style="display: flex; flex-direction: column; gap: 16px; flex-grow: 1; min-width: 0">${history(filter, { empty, talk, c2w })}${yourData(pending)}</div>`;
  const body = isPhone() ? `${bikes(empty, c.reminders, c2w)}${history(filter, { empty, talk, c2w })}${empty ? '' : credit()}${aboutYou(c)}${yourData(pending)}` : `<div style="display: flex; gap: 16px; align-items: flex-start">${left}${right}</div>`;
  return site(`<div style="width: 100%; max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${banner}${head}${body}</div>`);
}

// A receipt from the history (decision 1; audit L1, M6).
// UX walk-through 1 L3: the same receipt as the email and the text link
// (barcode, VAT, how it was paid), here for Maya's repair.
const receiptDialog = (sent = false) => popup('rc-title', 'Your receipt', `${mono('B1-[0000]')} · [date] · North Street Cycles, Bolton`, `${receiptBodyAt(isPhone() ? 'phone' : 'desktop')}
${sent ? statusBar(`Sent to ${MAYA.email}`) : note(`“Email it to me” sends it to ${MAYA.email}.`)}`, `${button('Email it to me', { variant: 'default' })}${button('Download receipt (PDF)')}`, 560);

// ---------- Conversations (decisions 3 and 7) ----------
// A message in a thread: who, when, what — the shop's on the left, the
// customer's own on the right, as in any messaging app.
const msg = (mine, who, when, text) => `<li style="display: flex; flex-direction: column; align-items: ${mine ? 'flex-end' : 'flex-start'}; gap: 4px"><span style="font-size: 13px; color: ${C.muted}"><strong style="color: ${C.ink}">${who}</strong> · ${when}</span><span style="max-width: 82%; box-sizing: border-box; padding: 10px 14px; border-radius: ${mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px'}; background: ${mine ? C.mutedBg : C.panel}; border: 1px solid ${C.border}; font-size: 15px; line-height: 1.5">${text}</span></li>`;
const thread = (items, label) => `<ol aria-label="${esc(label)}" style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px">${items.join('')}</ol>`;
const writeBox = (id, label, value, btn, hint) => `<div style="display: flex; flex-direction: column; gap: 8px"><label for="${id}" style="font-size: 15px; font-weight: 600">${label}</label><textarea id="${id}" rows="3" placeholder="Type here" style="box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; line-height: 1.5; color: ${C.ink}; resize: none">${value}</textarea>
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">${note(hint)}${button(btn)}</div></div>`;
const MAYA_NOTE = msg(true, 'You', '[day, time]', '[Maya’s note to the shop]');
const JO_REPLY = msg(false, 'Jo Taylor, North Street Cycles', '[day, time]', '[Jo’s reply]');
// On the job's page (decision 3): "Add a note for the shop" opens this.
// Audit M10: "Sent" is announced.
function jobThread(state) {
  const items = state === 'writing' ? [] : state === 'sent' ? [MAYA_NOTE] : [MAYA_NOTE, JO_REPLY];
  const hint = `We’ll reply here and ${HEAR} when we do.`;
  const box = state === 'writing' ? writeBox('job-note', 'Add a note for the shop', '[What Maya types]', 'Send note', hint) : writeBox('job-note', 'Reply', '', 'Send', hint);
  const sentLine = state === 'sent' ? `<p role="status" style="margin: 0; font-size: 14px; color: ${C.muted}">Sent. North Street Cycles will reply here, and we’ll ${HEAR} when they do.</p>` : '';
  return cardBox(`${h2('Notes with the shop', 'jt')}${items.length ? thread(items, 'Notes with the shop') : ''}${sentLine}${box}`, `border: 2px solid ${state === 'writing' ? C.ink : C.border}`);
}
// "Ask the shop a question" from the account (decision 3).
const askDialog = () => popup('ask-title', 'Ask the shop a question', 'North Street Cycles, Bolton', `${writeBox('ask', 'Your question', '[What Maya types]', 'Send question', `The answer comes to your account, and we’ll ${HEAR} when it does.`)}`, '', 560);
// The question's own page, once answered.
const questionPage = () => site(`<div style="width: 100%; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${backTo('Your account')}<h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Your question</h1>
${cardBox(`${thread([msg(true, 'You', '[day, time]', '[Maya’s question]'), msg(false, 'Jo Taylor, North Street Cycles', '[day, time]', '[Jo’s answer]')], 'Your question and the answer')}${writeBox('q-reply', 'Reply', '', 'Send', `We’ll ${HEAR} when the shop replies.`)}`)}</div>`);
// What arrives on Maya's phone (decision 3): the reply's text, linking back.
const phoneText = (body) => `<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}">TEXT TO ${MAYA.name.toUpperCase()}</span><div style="align-self: flex-start; max-width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 14px 14px 14px 4px; background: ${C.mutedBg}; font-size: 14px; line-height: 1.5">${body}</div></div>`;

// ---------- The staff Messages inbox (decision 7) ----------
// Left: conversations, "Needs a reply" first. Right: the open one, and a
// reply box that says how the reply goes. Audit M7: "Needs a reply" in words.
// Coverage walk 10 M1: a row may add what it is to its name (`kind`), so
// Maya's job note and her account question aren't both just "Maya Patel".
const convRow = ({ who, about, last, when, open = false, waiting = false, kind = '' }) => `<a href="#"${open ? ' aria-current="true"' : ''} aria-label="${waiting ? 'Needs a reply: ' : ''}${esc(who)}${kind ? ` · ${esc(kind)}` : ''}" style="display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 8px; border: 1px solid ${open ? C.ink : 'transparent'}; background: ${open ? C.mutedBg : 'transparent'}; text-decoration: none; color: ${C.ink}"><span style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><span style="font-size: 15px; font-weight: 700">${who}</span><span style="font-size: 12px; color: ${C.muted}; white-space: nowrap">${when}</span></span><span style="font-size: 13px; color: ${C.muted}">${about}</span><span style="display: flex; align-items: center; gap: 6px; font-size: 14px">${waiting ? `<span style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: ${C.purpleInk}; white-space: nowrap"><span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 999px; background: ${C.purpleInk}"></span>Needs a reply</span>` : ''}<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${last}</span></span></a>`;
const CONVS = {
  maya: { who: MAYA.name, about: `${MAYA.bike} · ${mono('WH-1042')}`, last: '[Maya’s note to the shop]', when: '[time]' },
  // Coverage walks, answer 3 (Jack, 4 Oct): Maya's question from her account.
  q: { who: MAYA.name, about: 'Question from her account', kind: 'Question from her account', last: '[Maya’s question]', when: '[time]' },
  done1: { who: 'Oliver Chen', about: `Brompton C Line · ${mono('WH-1068')}`, last: 'You: [the last reply]', when: '[day]' },
  done2: { who: '[Customer name]', about: 'Question from their account', last: 'You: [the last reply]', when: '[day]' },
};
const SENT_HOW = 'Sent to Maya by text, with a link to reply on the job’s page.';
const INBOX_NOTE = 'Messages from customers — from a job’s page, or their account. Replies go the way each customer chose, with a link back.';
function inbox({ sent = false, filter = 'Needs a reply', empty = false, listOnly = false } = {}) {
  const maya = convRow({ ...CONVS.maya, last: sent ? 'You: [Jo’s reply]' : CONVS.maya.last, waiting: !sent, open: !empty });
  const q = convRow({ ...CONVS.q, waiting: true });
  const done = [convRow(CONVS.done1), convRow(CONVS.done2)];
  const rows = empty ? [] : filter === 'All' ? [sent ? q : maya, sent ? maya : q, ...done] : sent ? [q] : [maya, q];
  const count = empty ? 0 : sent ? 1 : 2;
  // Audit M6: nothing waiting — how staff will see it most days.
  const listBody = rows.length ? rows.join('') : `<p style="margin: 0; padding: 18px 12px; font-size: 15px; line-height: 1.5; color: ${C.muted}">Nothing needs a reply. Every conversation is under All.</p>`;
  const list = `<div style="display: flex; flex-direction: column; gap: 10px; width: ${isPhone() ? 'auto' : '340px'}; flex-shrink: 0">
<div role="group" aria-label="Show" style="display: flex; gap: 6px">${pill(`Needs a reply · ${count}`, filter === 'Needs a reply')}${pill('All', filter === 'All')}</div>
${card(`<nav aria-label="Conversations" style="padding: 6px; display: flex; flex-direction: column; gap: 2px">${listBody}</nav>`)}</div>`;
  const wrap = (inner) => page('messages', 'Messages', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note(INBOX_NOTE)}${inner}</div>`, STAFF);
  if (empty || (listOnly && isPhone())) return isPhone() ? wrap(list) : wrap(`<div style="display: flex; gap: 16px; align-items: flex-start">${list}${card(`<p style="margin: 0; padding: 40px 20px; text-align: center; font-size: 15px; color: ${C.muted}">Choose a conversation to read it.</p>`, 'flex-grow: 1; min-width: 0')}</div>`);
  const items = sent ? [msg(false, 'Maya Patel', '[day, time]', '[Maya’s note to the shop]'), msg(true, 'You (Jo Taylor)', 'just now', '[Jo’s reply]')] : [msg(false, 'Maya Patel', '[day, time]', '[Maya’s note to the shop]')];
  // Audit L7: after sending, "See the text Maya gets", and a box to reply again.
  const after = sent ? `${statusBar(`${SENT_HOW} <a href="#" style="color: inherit">See the text Maya gets</a>`)}${writeBox('reply', 'Reply again', '', 'Send reply', SENT_HOW)}` : writeBox('reply', 'Reply', '[Jo’s reply]', 'Send reply', SENT_HOW);
  const conv = card(`<div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 18px; font-weight: 700">${MAYA.name}</span><span style="font-size: 13px; color: ${C.muted}">${MAYA.bikeLong} · ${mono('WH-1042')} · <a href="tel:07700900142" style="color: inherit">${mono(MAYA.phone)}</a></span></span><span style="display: flex; gap: 16px">${link('Open the job')}${link('Customer page')}</span></div>
${p('On the job’s page · started by Maya', `font-size: 13px; color: ${C.muted}`)}
${thread(items, 'Conversation with Maya Patel')}${after}</div>`, 'flex-grow: 1; min-width: 0');
  // Decision 7: on a phone, the list, then the conversation with a way back.
  if (isPhone()) return wrap(`${backTo(`Messages · needs a reply ${count}`)}${conv}`);
  return wrap(`<div style="display: flex; gap: 16px; align-items: flex-start">${list}${conv}</div>`);
}

// ---------- Service reminders (decision 2) ----------
// Third walk (walk-through 4 M2; Owner setup 16; Account 2): Edit on the
// "Gear adjustment" row of Settings › Workshop › services opens the service
// box, headed with the service clicked: its name, group, time in the diary
// and price (unset, so "[£ price]", as the list shows), and the reminder.
// Group, time and price are the set-workshop-services row's (setup.mjs).
const svcInput = (id, value, w, mono = false) => `<input id="${id}"${w ? ' inputmode="numeric"' : ''} value="${esc(value)}" style="width: ${w ? `${w}px` : '100%'}; min-height: 44px; box-sizing: border-box; ${w ? 'text-align: center; ' : 'padding: 0 10px; '}border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: ${mono ? MONO : 'inherit'}; font-size: 15px; color: ${C.ink}">`;
const svcLabel = (id, t) => `<label for="${id}" style="font-size: 15px; font-weight: 600">${t}</label>`;
const svcRow = (inner) => `<div style="display: flex; flex-direction: column; gap: 8px">${inner}</div>`;
const serviceDialog = () => popup('svc-title', 'Gear adjustment', 'Individual service · 60 min in the diary · [£ price]', `
${svcRow(`${svcLabel('svc-name', 'Name')}${svcInput('svc-name', 'Gear adjustment')}`)}
${choice('Group', [['Full service', false], ['Individual service', true]])}
${svcRow(`${svcLabel('svc-time', 'Time in the diary')}<span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px">${svcInput('svc-time', '60', 72)}min</span>`)}
${svcRow(`${svcLabel('svc-price', 'Price')}<span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px">${svcInput('svc-price', '[£ price]', 120, true)}</span>`)}
<div style="display: flex; flex-direction: column; gap: 8px"><label for="svc-rem" style="font-size: 15px; font-weight: 600">Remind customers it’s due after</label><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px"><input id="svc-rem" inputmode="numeric" value="[n]" style="width: 64px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}">months</span>
${note('Counted from when the bike is collected. Only customers who said yes get it. Leave empty for no reminder — for a puncture, say.')}</div>
${note('The wording is in Settings › Messages › Service reminder.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 520);
const servicesBoard = ({ reminders = true } = {}) => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ services: servicesOpen({ reminders }) }));
// Audit M8: "Stop these" is a fixed line, not part of the editable wording,
// and the insert buttons are only the ones this message can use.
const stopFixed = `<p style="margin: 0; padding: 8px 10px; border-radius: 6px; background: ${C.mutedBg}; font-size: 14px; color: ${C.ink}">Always added at the end: “Stop these: [link]”. It can’t be taken off.</p>`;
const REMINDER_WORDS = 'Hi [Customer’s first name], your [Bike] is due its [Service] at [Shop name]. Book a repair here — it’s ready to go: [Link to book].';
const REMINDER_PREVIEW = 'Hi Maya, your Trek Domane AL 3 is due its Standard service at North Street Cycles. Book a repair here — it’s ready to go: [link]. Stop these: [link].';
const reminderDialog = () => popup('srem-title', 'Service reminder', 'Sent when a bike is due its next service — set on each service in Settings › Workshop', `
<p style="margin: 0; font-size: 15px">Sent the way each customer chose: text, WhatsApp or email.</p>
${wordingBox('srem-words', REMINDER_WORDS, 3, ['Customer’s first name', 'Bike', 'Service', 'Shop name', 'Link to book'], stopFixed)}${bubble(REMINDER_PREVIEW)}`, `${button('Go back to Wheelhouse’s wording', { variant: 'ghost' })}${button('Cancel', { variant: 'default' })}${button('Save')}`, 640);
// The reminder's link: booking with the bike and service already chosen
// (audit L4: and saying why). UX walk-through 1 M7: and Maya's details,
// part-hidden, with no sign-in.
const reminderLanding = () => whenFromReminderAt(SIZE, `<p style="margin: 0 0 12px; padding: 10px 12px; border-radius: 8px; background: ${C.mutedBg}; font-size: 15px; line-height: 1.5">From your reminder: booking the next <strong>Standard service</strong> for your <strong>${MAYA.bikeLong}</strong>. Change either above.<br>Your details are filled in from your reminder: <strong>Maya P.</strong> · ${mono('07700 ••• 142')} · <a href="#" style="color: ${C.ink}; font-weight: 600">Change</a></p>`);

// ---------- Review requests (decision 5) ----------
const REVIEW_WORDS = 'Thanks for coming to [Shop name], [Customer’s first name]. If you have a minute, we’d love a review: [Link to review].';
const REVIEW_PREVIEW = 'Thanks for coming to North Street Cycles, Maya. If you have a minute, we’d love a review: [link]. Stop these: [link].';
const daysBox = (value) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="rev-days" style="font-size: 15px; font-weight: 600">Send it</label><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px"><input id="rev-days" inputmode="numeric" value="${value}" style="width: 64px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}">days after collection</span></div>`;
// Audit M6: the first time — off, with no review page yet, so it can't go on.
const reviewDialog = (first = false) => popup('rev-title', 'Review request', 'Sent after a bike is collected', `
${first ? `${rowSwitch('Send review requests', false).replace('<button', '<button disabled aria-describedby="rev-first"')}<p id="rev-first" style="margin: 0; font-size: 14px; color: ${C.warnInk}; font-weight: 600">Add your review page first, then switch this on.</p>` : rowSwitch('Send review requests', true)}
${field('Your review page', { value: first ? '' : '[Link to the shop’s Google page]', placeholder: 'Paste the link to your review page', hint: 'Where the link goes — your Google page, say.' })}
${daysBox('[n]')}
${wordingBox('rev-words', REVIEW_WORDS, 3, ['Customer’s first name', 'Shop name', 'Link to review'], stopFixed)}${bubble(REVIEW_PREVIEW)}
${note('Everyone gets the same link — Google doesn’t allow asking only happy customers. Only customers who said yes get it.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 640);

// ---------- How we contact you (decision 6; audit H2) ----------
const radio = (t, on) => `<button type="button" role="radio" aria-checked="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.mutedBg : 'transparent'}; font-family: inherit; font-size: 15px; font-weight: 600; color: ${C.ink}; display: inline-flex; align-items: center; gap: 6px">${on ? icon('check', 14) : ''}${t}</button>`;
// A named switch: the whole row is the control, and says On or Off in words.
const switchRow = (id, label, sub, on) => `<button type="button" role="switch" aria-checked="${on}" aria-labelledby="${id}" aria-describedby="${id}-sub" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 60px; padding: 0; border: 0; border-top: 1px solid ${C.border}; background: transparent; font-family: inherit; text-align: left; color: ${C.ink}"><span style="display: flex; flex-direction: column; gap: 2px"><span id="${id}" style="font-size: 15px; font-weight: 600">${label}</span><span id="${id}-sub" style="font-size: 13px; color: ${C.muted}">${sub}</span></span><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600"><span>${on ? 'On' : 'Off'}</span><span aria-hidden="true" style="position: relative; width: 40px; height: 24px; border-radius: 999px; background: ${on ? C.ink : C.input}"><span style="position: absolute; top: 3px; left: ${on ? 19 : 3}px; width: 18px; height: 18px; border-radius: 999px; background: #ffffff"></span></span></span></button>`;
const contactDialog = (changed = false) => popup('ct-title', 'How we contact you', 'Changes save straight away', `
${changed ? `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 14px; font-weight: 600">${icon('check', 16)}Service reminders are off</p>` : ''}
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Job updates</span>${note('Bookings, quotes, and when your bike is ready. You can change how — they can’t be switched off while a bike is with us.')}<div role="radiogroup" aria-label="Job updates by" style="display: flex; flex-wrap: wrap; gap: 8px">${radio('Text', true)}${radio('WhatsApp', false)}${radio('Email', false)}</div></div>
<div style="display: flex; flex-direction: column; padding-top: 6px">${switchRow('sw-rem', 'Service reminders', 'When your bike is due its next service', !changed)}${switchRow('sw-rev', 'Review requests', 'After you collect your bike', true)}${switchRow('sw-off', 'Offers and news', 'Only if you say yes', false)}</div>
${note('Each of these ends with “Stop these”, which switches that one off without signing in.')}`, button('Done'), 560);
// The "Stop these" link: one click, no signing in, and it says what happened.
// Each kind reads the same with its own name. Audit M5: signing in is a
// link, and turning it back on has its own result.
const stopped = (back = false) => site(`<div style="width: 100%; max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${cardBox(`<span style="display: inline-flex; width: 44px; height: 44px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 22)}</span>
<h1 role="status" style="margin: 0; font-size: 24px; font-weight: 700">${back ? 'Service reminders are on again' : 'Service reminders stopped'}</h1>
${back ? p('We’ll remind you when your bike is due its next service. Stop them any time with the link at the end of each one.') : p('We won’t send you service reminders any more. Job updates about a bike that’s with us still come as usual.')}
${back ? '' : `<div style="display: flex; flex-wrap: wrap; gap: 8px">${button('Turn them back on', { variant: 'default' })}</div>`}
<p style="margin: 0; font-size: 14px; color: ${C.muted}">Want to change anything else? <a href="#" style="display: inline-flex; align-items: center; min-height: 44px; color: ${C.ink}; font-weight: 600">Sign in to your account</a> and go to “How we contact you”.</p>`)}</div>`);

// ---------- Your data (decision 4; audit H3, M12, L3, L9) ----------
const credLost = `<p style="margin: 0; padding: 10px 12px; border-radius: 8px; background: ${C.warnBg}; color: ${C.warnInk}; font-size: 15px; line-height: 1.45">You have <strong>${mono('£[credit]')}</strong> of store credit. It will be lost when your account is deleted — use it first, or ask for it back.</p>`;
const dataDialog = (state = 'ask') => {
  // Coverage walks, answer 4 (Jack, 4 Oct): with the bike still in, Maya can
  // still ask; the request waits until the bike is collected.
  if (state === 'blocked') return popup('del-title', 'Ask us to delete your account', '', `${p('We’ll delete your account once your bike has been collected.')}
<div>${kv('Bike with us', `${MAYA.bike} · ${mono('WH-1042')}`)}</div>
${note('Call [shop phone] if you need to talk it through.')}`, `${button('Keep my account', { variant: 'ghost' })}${button('Ask to delete', { variant: 'danger' })}`, 520);
  if (state === 'sent') return popup('del-title', 'Request sent', '', `<p role="status" style="margin: 0; font-size: 15px; line-height: 1.5">North Street Cycles will delete your account and tell you when it’s done — by [date] at the latest.</p>
${note('Changed your mind? “Cancel my request” is on your account until the shop has done it.')}`, button('OK'), 520);
  return popup('del-title', 'Ask us to delete your account', '', `${p('North Street Cycles will delete your account within one month, and tell you when it’s done.')}
${note('Your details, bikes and messages are deleted. Sales stay in the shop’s books without your name, because the shop must keep them for tax.')}
${credLost}
${note('Want a copy first? <a href="#" style="color: inherit; font-weight: 600">Download a copy of your data</a>.')}
<p style="margin: 0; font-size: 15px; font-weight: 700; color: ${C.ink}">This can’t be undone.</p>`, `${button('Keep my account', { variant: 'ghost' })}${button('Ask to delete', { variant: 'danger' })}`, 520);
};
const pendingBanner = warnBar('You asked us to delete your account on [date]. We’ll finish by [date].', button('Cancel my request', { variant: 'default' }));
const downloaded = (failed = false) => accountPage({ banner: failed
  ? warnBar('The download didn’t start.', button('Try again', { variant: 'default' }))
  : statusBar('Your data is downloading as one file, [file name].zip — details, bikes, jobs, purchases, messages and what you agreed to. <a href="#" style="color: inherit">Not started? Download it again</a>') });

// A board scrolled part-way down a long page (as journey 3's Messages board).
const scrolled = (html, px) => `<style>.ac-scrolled > * { position: relative; top: -${px}px }</style>${html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;/, '<div data-scroll class="ac-scrolled" style="$1overflow-y: hidden;')}`;

// ---------- The boards ----------
// Walk-through 12 L3 (third walk, 3 Oct): at phone size the "In the shop"
// tag is body size (15px). The build fails if the tag's words move.
const bigTag = (html, t, tone) => { const from = badge(t, tone); if (!html.includes(from)) throw new Error(`account.mjs: tag "${t}" not found`); return html.split(from).join(from.replace('font-size: 12px', 'font-size: 15px')); };
def('ac-account', () => (isPhone() ? bigTag(accountPage(), 'In the shop', 'blue') : accountPage()));
def('ac-account-lower', () => scrolled(accountPage(), { desktop: 380, tablet: 380, phone: 1150 }[SIZE]));
def('ac-account-repairs', () => accountPage({ filter: 'Repairs' }));
def('ac-account-new', () => accountPage({ empty: true }));
// UX walk-through 5 M5, H4: her Cycle to Work order in her history, with what
// she pays at collection; after collection the bike joins her bikes.
def('ac-account-c2w', () => accountPage({ c2w: 'open' }));
def('ac-account-c2w-collected', () => accountPage({ c2w: 'collected' }));
def('ac-receipt', () => overlay(accountPage({ filter: 'Repairs' }), receiptDialog()));
def('ac-receipt-sent', () => overlay(accountPage({ filter: 'Repairs' }), receiptDialog(true)));
def('ac-job-note', () => inShopAt(SIZE, () => jobThread('writing')));
def('ac-job-note-sent', () => inShopAt(SIZE, () => jobThread('sent')));
def('ac-job-note-answered', () => inShopAt(SIZE, () => jobThread('answered')));
def('ac-ask', () => overlay(accountPage(), askDialog()));
def('ac-account-question-sent', () => accountPage({ talk: 'sent', banner: statusBar(`Question sent. We’ll ${HEAR} when North Street Cycles replies.`) }));
def('ac-question', () => questionPage());
def('ac-account-asked', () => accountPage({ talk: 'answered' }));
def('ac-inbox', () => inbox());
def('ac-inbox-sent', () => inbox({ sent: true }));
def('ac-inbox-all', () => inbox({ sent: true, filter: 'All', listOnly: true }));
def('ac-inbox-list', () => inbox({ listOnly: true }));
def('ac-inbox-empty', () => inbox({ empty: true }));
def('ac-reply-text', () => overlay(inbox({ sent: true }), popup('txt-title', 'What Maya gets', 'A text, because Maya chose text', phoneText('North Street Cycles replied about your Trek Domane AL 3 (WH-1042): [Jo’s reply]. Replies to this number aren’t read — reply on your page: [link]'), button('Close', { variant: 'default' }), 480)));
def('ac-today', () => today({ replies: true, deleteRequest: true, arrived: true }));
def('ac-book-remind', () => detailsRemindAt(SIZE));
def('ac-collect-remind', () => summaryRemindAt(SIZE));
def('ac-services', () => servicesBoard());
// Behind the box: the Individual service list it was opened from.
def('ac-service-edit', () => overlay(servicesBoard({ reminders: false }), serviceDialog()));
def('ac-messages', () => scrolled(msgPage({ list: msgListOpen({ bringBack: true }) }), { desktop: 760, tablet: 760, phone: 1300 }[SIZE]));
def('ac-reminder-wording', () => overlay(msgPage({ list: msgListOpen({ bringBack: true }) }), reminderDialog()));
def('ac-reminder-landing', () => reminderLanding());
def('ac-review-first', () => overlay(msgPage({ list: msgListOpen({ bringBack: true }) }), reviewDialog(true)));
def('ac-review-setting', () => overlay(msgPage({ list: msgListOpen({ bringBack: true }) }), reviewDialog()));
def('ac-contact', () => overlay(accountPage(), contactDialog()));
def('ac-contact-changed', () => overlay(accountPage({ contact: { ...CONTACT_ON, reminders: false } }), contactDialog(true)));
def('ac-stopped', () => stopped());
def('ac-stopped-on', () => stopped(true));
def('ac-download', () => downloaded());
def('ac-download-failed', () => downloaded(true));
def('ac-delete', () => overlay(accountPage(), dataDialog('ask')));
def('ac-delete-blocked', () => overlay(accountPage(), dataDialog('blocked')));
def('ac-delete-sent', () => overlay(accountPage({ pending: true }), dataDialog('sent')));
def('ac-account-delete-pending', () => accountPage({ pending: true, banner: pendingBanner }));
def('ac-account-delete-cancelled', () => accountPage({ banner: statusBar('Request cancelled — your account stays as it is.') }));
def('ac-privacy-requests', () => privacyPageAt(SIZE, true));
def('ac-customer-delete', () => customerPageWith(SIZE, { deleteRequest: true }));

// Every board at desktop, tablet and phone; the inbox's list on its own is
// a phone screen only (on wider screens it sits beside the conversation).
const PHONE_ONLY = new Set(['ac-inbox-list']);
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of PHONE_ONLY.has(id) ? ['phone'] : ['desktop', 'tablet', 'phone']) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ac-account': 'Your account: bikes, details and how we contact you; one history',
  'ac-account-lower': 'Further down: how we contact you, and your data',
  'ac-account-repairs': 'History showing repairs only',
  'ac-account-new': 'A new account, with nothing in it yet',
  // UX walk-through 5 M5, H4.
  'ac-account-c2w': 'Her Cycle to Work order in her history, with what she pays at collection',
  'ac-account-c2w-collected': 'After collection: the Cycle to Work bike in her bikes, with its frame number',
  'ac-receipt': 'A receipt, from the history',
  'ac-receipt-sent': 'The receipt emailed',
  'ac-job-note': 'A job’s page: “Add a note for the shop”',
  'ac-job-note-sent': 'The note sent, waiting for a reply',
  'ac-job-note-answered': 'The shop’s reply, on the job’s page',
  'ac-ask': 'Ask the shop a question, from the account',
  'ac-account-question-sent': 'The question sent: in the history, waiting',
  'ac-question': 'The question and its answer',
  'ac-account-asked': 'The history once answered: the note and the question',
  'ac-inbox': 'Staff Messages: needs a reply, and the open conversation',
  'ac-inbox-sent': 'Reply sent the way Maya chose; reply again',
  'ac-inbox-all': 'All conversations, “Needs a reply” in words',
  'ac-inbox-list': 'On a phone: the list first',
  'ac-inbox-empty': 'Nothing needs a reply',
  'ac-reply-text': 'The text Maya gets, linking back',
  'ac-today': 'Today: messages needing a reply, and a request to delete an account',
  'ac-book-remind': 'Booking: “Remind me…”, unticked, with a review request',
  'ac-collect-remind': 'Ready to collect: the same tick',
  'ac-services': 'Settings › Workshop › Services: each service’s reminder',
  'ac-service-edit': 'A service’s reminder time',
  'ac-messages': 'Settings › Messages: service reminders and review requests',
  'ac-reminder-wording': 'The service reminder’s wording; “Stop these” always added',
  'ac-reminder-landing': 'The reminder’s link: booking, bike and service chosen, saying why',
  'ac-review-first': 'Review requests the first time: add a review page, then switch on',
  'ac-review-setting': 'Review requests: the review page, when, the wording',
  'ac-contact': 'How we contact you',
  'ac-contact-changed': 'A switch changed, and said so',
  'ac-stopped': '“Stop these”: stopped in one click, no signing in',
  'ac-stopped-on': 'Turned back on',
  'ac-download': 'Download a copy of your data: straight away',
  'ac-download-failed': 'The download didn’t start',
  'ac-delete': 'Ask us to delete your account: store credit will be lost',
  'ac-delete-blocked': 'Can’t delete yet: the bike is still with us',
  'ac-delete-sent': 'Deletion request sent',
  'ac-account-delete-pending': 'The request on the account, with Cancel my request',
  'ac-account-delete-cancelled': 'Request cancelled',
  'ac-privacy-requests': 'The shop’s Privacy requests: from the website, and what’s in the way',
  'ac-customer-delete': 'The staff customer page: the request, and what’s in the way',
};
export const ROWS = [
  { label: 'Your account', screens: ['ac-account', 'ac-account-lower', 'ac-account-repairs', 'ac-account-new', 'ac-receipt', 'ac-receipt-sent'] },
  // UX walk-through 5 M5, H4.
  { label: 'A Cycle to Work bike on her account', screens: ['ac-account-c2w', 'ac-account-c2w-collected'] },
  { label: 'Talking to the shop', screens: ['ac-job-note', 'ac-job-note-sent', 'ac-job-note-answered', 'ac-ask', 'ac-account-question-sent', 'ac-question', 'ac-account-asked'] },
  { label: 'The shop’s side of messages', screens: ['ac-inbox-list', 'ac-inbox', 'ac-inbox-sent', 'ac-inbox-all', 'ac-inbox-empty', 'ac-reply-text', 'ac-today'] },
  { label: 'Service reminders', screens: ['ac-book-remind', 'ac-collect-remind', 'ac-services', 'ac-service-edit', 'ac-messages', 'ac-reminder-wording', 'ac-reminder-landing'] },
  { label: 'Reviews and how we contact you', screens: ['ac-review-first', 'ac-review-setting', 'ac-contact', 'ac-contact-changed', 'ac-stopped', 'ac-stopped-on'] },
  { label: 'Your data', screens: ['ac-download', 'ac-download-failed', 'ac-delete', 'ac-delete-blocked', 'ac-delete-sent', 'ac-account-delete-pending', 'ac-account-delete-cancelled', 'ac-privacy-requests', 'ac-customer-delete'] },
];
