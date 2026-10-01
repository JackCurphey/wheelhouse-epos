// Journey 7 — Account, history and reminders, in Soft sand on its own canvas.
// Decisions: docs/decisions/2026-10-01-account-and-reminders-review.md
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
import { page, pill, offer, note, popup, overlay, withSize, isPhone, settingsPage, workshopFolds, WORKSHOP_INTRO, rowSwitch } from './settings-frame.mjs';
import { siteDesktop, siteTablet, sitePhone } from './app-map.mjs';
import { today } from './opening.mjs';
import { msgPage, msgListOpen, servicesOpen, wordingBox, bubble } from './setup.mjs';
import { inShopAt } from './quote.mjs';
import { detailsRemindAt, screens as bookScreens } from './book.mjs';
import { summaryRemindAt } from './collect.mjs';
import { screens as customerScreens } from './customer.mjs';

export const screens = {};
const recipes = [];
const def = (id, fn) => recipes.push([id, fn]);
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${t}</span>`;
let SIZE = 'desktop';
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const MAYA = { name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test', bike: 'Trek Domane AL 3', bikeLong: 'Trek Domane AL 3 · green · black mudguards' };

// ---------- The customer's website ----------
const site = (content) => {
  const body = `<div data-scroll style="flex-grow: 1; min-height: 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px">${content}</div>`;
  return SIZE === 'desktop' ? siteDesktop('sand', 'Account', body) : SIZE === 'tablet' ? siteTablet('sand', body, 'Account') : sitePhone('sand', { content: body });
};
const cardBox = (inner, extra = '') => card(`<div style="padding: ${isPhone() ? 16 : 20}px; display: flex; flex-direction: column; gap: 10px">${inner}</div>`, extra);
const h2 = (t, id) => `<h2 id="${id}" style="margin: 0; font-size: 18px; font-weight: 700">${t}</h2>`;
const p = (t, extra = '') => `<p style="margin: 0; font-size: 15px; line-height: 1.5; ${extra}">${t}</p>`;
const link = (t, href = '#') => `<a href="${href}" style="display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 600; color: ${C.ink}">${t}</a>`;
const kv = (k, v) => `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 8px 0; border-top: 1px solid ${C.border}; font-size: 15px"><span style="color: ${C.muted}">${k}</span><span style="text-align: right; font-weight: 600">${v}</span></div>`;
const backTo = (t) => `<a href="#" style="display: inline-flex; align-items: center; gap: 4px; min-height: 44px; align-self: flex-start; font-size: 14px; font-weight: 600; color: ${C.ink}; text-decoration: none">${icon('back', 16)}${t}</a>`;

// ---------- The account page (decision 1) ----------
// Left: bikes (warranty, Book a service), store credit, details, how we
// contact you, your data. Right: one history, newest first.
const warranty = `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${C.successInk}">${icon('check', 14)}Bought here · under warranty, [n] months left</span>`;
function bikes(empty) {
  if (empty) return cardBox(`${h2('Your bikes', 'a-bikes')}${p('No bikes yet. Add one to book it in faster.', `color: ${C.muted}`)}<div>${button('+ Add a bike', { variant: 'default' })}</div>`);
  return cardBox(`${h2('Your bikes', 'a-bikes')}
<div style="display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid ${C.border}"><span style="font-size: 16px; font-weight: 700">${MAYA.bikeLong}</span>${warranty}<span style="font-size: 13px; color: ${C.muted}">In the shop now · ${mono('WH-1042')}</span>
<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px">${button('Book a service', { variant: 'default' })}</div></div>
<div>${link('+ Add a bike')}</div>`);
}
const credit = () => cardBox(`${h2('Store credit', 'a-credit')}<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px">${mono('£[credit]', 'font-size: 24px')}<span style="font-size: 13px; color: ${C.muted}">Use it in the shop or online</span></div>`);
const details = () => cardBox(`<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">${h2('Your details', 'a-details')}${link('Edit')}</div><div>${kv('Name', MAYA.name)}${kv('Mobile', mono(MAYA.phone))}${kv('Email', MAYA.email)}</div>`);
// Decision 6: one section. Job updates can change way but not switch off.
const CONTACT_DEFAULT = { channel: 'Text', reminders: true, reviews: true, offers: false };
const contactSummary = (c = CONTACT_DEFAULT) => cardBox(`<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">${h2('How we contact you', 'a-contact')}${link('Change')}</div>
<div>${kv('Job updates', `By ${c.channel.toLowerCase()}`)}${kv('Service reminders', c.reminders ? 'On' : 'Off')}${kv('Review requests', c.reviews ? 'On' : 'Off')}${kv('Offers and news', c.offers ? 'On' : 'Off')}</div>`);
// Decision 4.
const yourData = () => cardBox(`${h2('Your data', 'a-data')}
<div style="display: flex; flex-direction: column">${link('Download a copy of your data')}${link('Ask us to delete your account')}${link('Privacy notice')}</div>`);

// History rows: a kind, what it was, when, and what's on the right.
const kind = (t) => `<span style="flex-shrink: 0; width: 76px; font-size: 13px; font-weight: 700; color: ${C.muted}">${t}</span>`;
const hRow = (k, title, sub, right = '') => `<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 6px 0; border-top: 1px solid ${C.border}; text-decoration: none; color: ${C.ink}">${kind(k)}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">${title}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${right}<span aria-hidden="true" style="color: ${C.muted}">›</span></a>`;
const subHead = (t) => `<h3 style="margin: 0; padding: 12px 0 4px; font-size: 13px; font-weight: 700; color: ${C.muted}">${t}</h3>`;
const ROWS_NOW = {
  repair: hRow('Repair', `${mono('WH-1042')} · ${MAYA.bike} · Standard service`, 'Booked in Thu 17 Sep · expected ready Thu 17 Sep', badge('In the workshop', 'blue')),
  message: (answered) => hRow('Message', 'Your question', `[date] · ${answered ? 'North Street Cycles replied' : 'waiting for a reply'}`, badge(answered ? 'Replied' : 'Sent', answered ? 'green' : 'grey')),
};
const pastRepair = () => hRow('Repair', `${mono('WH-[0000]')} · ${MAYA.bike} · [Work done]`, `[date] · collected`, mono('£[total]', 'font-size: 15px'));
const purchase = () => hRow('Purchase', `${mono('B1-[0000]')} · [Items bought]`, '[date] · in the shop · receipt', mono('£[total]', 'font-size: 15px'));
const onlineOrder = () => hRow('Purchase', `Order ${mono('[order number]')} · [Items bought]`, '[date] · online · receipt', mono('£[total]', 'font-size: 15px'));
function history(filter = 'Everything', { empty = false, answered = false, asked = false } = {}) {
  const pills = `<div role="group" aria-label="Show" style="display: flex; gap: 6px; flex-wrap: wrap">${['Everything', 'Repairs', 'Purchases'].map((t) => pill(t, t === filter)).join('')}</div>`;
  const top = `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap">${h2('History', 'a-history')}${pills}</div>`;
  if (empty) return cardBox(`${top}<div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 36px 12px; text-align: center">${p('Nothing here yet. Your repairs and purchases with North Street Cycles show here.', `color: ${C.muted}; max-width: 360px`)}${button('Book a repair')}</div>`, 'flex-grow: 1; min-width: 0');
  const repairs = filter !== 'Purchases', buys = filter !== 'Repairs';
  const now = [repairs && ROWS_NOW.repair, filter === 'Everything' && (asked || answered) && ROWS_NOW.message(answered)].filter(Boolean).join('');
  const earlier = [buys && purchase(), repairs && pastRepair(), buys && onlineOrder(), repairs && pastRepair()].filter(Boolean).join('');
  return cardBox(`${top}<div style="display: flex; flex-direction: column">${now ? `${subHead('Now')}${now}` : ''}${subHead('Earlier, newest first')}${earlier}</div>${link('Show more')}`, 'flex-grow: 1; min-width: 0');
}
function accountPage({ filter = 'Everything', empty = false, answered = false, asked = false, contact = CONTACT_DEFAULT, credit: hasCredit = true, banner = '' } = {}) {
  const head = `<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap"><div style="display: flex; flex-direction: column; gap: 4px"><h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Your account</h1><span style="font-size: 14px; color: ${C.muted}">${MAYA.name} · ${MAYA.email} · <a href="#" style="color: ${C.ink}; font-weight: 600">Sign out</a></span></div>
<div style="display: flex; flex-wrap: wrap; gap: 8px">${button('Ask the shop a question', { variant: 'default' })}${button('Book a repair')}</div></div>`;
  const left = `<div style="display: flex; flex-direction: column; gap: 16px; width: ${isPhone() ? 'auto' : '360px'}; flex-shrink: 0">${bikes(empty)}${hasCredit && !empty ? credit() : ''}${details()}${contactSummary(empty ? { channel: 'Text', reminders: false, reviews: false, offers: false } : contact)}${yourData()}</div>`;
  const right = history(filter, { empty, answered, asked });
  const body = isPhone() ? `${right}${left}` : `<div style="display: flex; gap: 16px; align-items: flex-start">${left}${right}</div>`;
  return site(`<div style="width: 100%; max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${banner}${head}${body}</div>`);
}
const statusBar = (t) => `<p role="status" style="margin: 0; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; background: ${C.okBg}; color: ${C.successInk}; font-size: 15px; font-weight: 600">${icon('check', 18)}<span>${t}</span></p>`;

// A receipt from the history (decision 1).
const receiptDialog = () => popup('rc-title', 'Receipt', `${mono('B1-[0000]')} · [date] · North Street Cycles, Bolton`, `<div>${kv('[Item]', mono('£[price]'))}${kv('[Item]', mono('£[price]'))}${kv(`<strong style="color: ${C.ink}">Total</strong>`, mono('£[total]', 'font-size: 17px'))}${kv('Paid by', '[card or cash]')}${kv('Includes VAT', mono('£[VAT]'))}</div>
${note('VAT number [VAT number]. Bring this, or just give your name, if you need to return something.')}`, `${button('Email it to me', { variant: 'default' })}${button('Download (PDF)')}`, 520);

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
function jobThread(state) {
  const items = state === 'writing' ? [] : state === 'sent' ? [MAYA_NOTE] : [MAYA_NOTE, JO_REPLY];
  const box = state === 'writing' ? writeBox('job-note', 'Add a note for the shop', '[What Maya types]', 'Send note', 'We’ll reply here and text you when we do.')
    : writeBox('job-note', 'Reply', '', 'Send', 'We’ll reply here and text you when we do.');
  const sentLine = state === 'sent' ? p('Sent. North Street Cycles will reply here, and we’ll text you when they do.', `font-size: 14px; color: ${C.muted}`) : '';
  return cardBox(`${h2('Notes with the shop', 'jt')}${items.length ? thread(items, 'Notes with the shop') : ''}${sentLine}${box}`, `border: 2px solid ${state === 'writing' ? C.ink : C.border}`);
}
// "Ask the shop a question" from the account (decision 3).
const askDialog = () => popup('ask-title', 'Ask the shop a question', 'North Street Cycles, Bolton', `${writeBox('ask', 'Your question', '[What Maya types]', 'Send question', 'The answer comes to your account, and we’ll text you when it does.')}`, '', 560);
// The question's own page, once answered.
const questionPage = () => site(`<div style="width: 100%; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${backTo('Your account')}<h1 style="margin: 0; font-size: ${isPhone() ? 24 : 28}px; font-weight: 700">Your question</h1>
${cardBox(`${thread([msg(true, 'You', '[day, time]', '[Maya’s question]'), msg(false, 'Jo Taylor, North Street Cycles', '[day, time]', '[Jo’s answer]')], 'Your question and the answer')}${writeBox('q-reply', 'Reply', '', 'Send', 'We’ll text you when the shop replies.')}`)}</div>`);
// What arrives on Maya's phone (decision 3): the reply's text, linking back.
const phoneText = (body) => `<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 700; color: ${C.muted}">TEXT TO ${MAYA.name.toUpperCase()}</span><div style="align-self: flex-start; max-width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 14px 14px 14px 4px; background: ${C.mutedBg}; font-size: 14px; line-height: 1.5">${body}</div></div>`;

// ---------- The staff Messages inbox (decision 7) ----------
// Left: conversations, "Needs a reply" first. Right: the open one, and a
// reply box that says how the reply goes.
const convRow = ({ who, about, last, when, open = false, waiting = false }) => `<a href="#"${open ? ' aria-current="true"' : ''} style="display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 8px; border: 1px solid ${open ? C.ink : 'transparent'}; background: ${open ? C.mutedBg : 'transparent'}; text-decoration: none; color: ${C.ink}"><span style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><span style="font-size: 15px; font-weight: 700">${who}</span><span style="font-size: 12px; color: ${C.muted}; white-space: nowrap">${when}</span></span><span style="font-size: 13px; color: ${C.muted}">${about}</span><span style="display: flex; align-items: center; gap: 6px; font-size: 14px">${waiting ? `<span aria-hidden="true" style="flex-shrink: 0; width: 8px; height: 8px; border-radius: 999px; background: ${C.purpleInk}"></span>` : ''}<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${last}</span></span></a>`;
const CONVS = {
  maya: { who: MAYA.name, about: `${MAYA.bike} · ${mono('WH-1042')}`, last: '[Maya’s note to the shop]', when: '[time]' },
  q: { who: '[Customer name]', about: 'Question from their account', last: '[Their question]', when: '[time]' },
  done1: { who: 'Oliver Chen', about: `Brompton C Line · ${mono('WH-1068')}`, last: 'You: [the last reply]', when: '[day]' },
  done2: { who: '[Customer name]', about: 'Question from their account', last: 'You: [the last reply]', when: '[day]' },
};
function inbox({ sent = false, filter = 'Needs a reply' } = {}) {
  const maya = convRow({ ...CONVS.maya, last: sent ? 'You: [Jo’s reply]' : CONVS.maya.last, waiting: !sent, open: true });
  const q = convRow({ ...CONVS.q, waiting: true });
  const rows = filter === 'All' ? [sent ? q : maya, sent ? maya : q, convRow(CONVS.done1), convRow(CONVS.done2)] : sent ? [q] : [maya, q];
  const list = `<div style="display: flex; flex-direction: column; gap: 10px; width: ${isPhone() ? 'auto' : '340px'}; flex-shrink: 0">
<div role="group" aria-label="Show" style="display: flex; gap: 6px">${pill(`Needs a reply · ${sent ? 1 : 2}`, filter === 'Needs a reply')}${pill('All', filter === 'All')}</div>
${card(`<nav aria-label="Conversations" style="padding: 6px; display: flex; flex-direction: column; gap: 2px">${rows.join('')}</nav>`)}</div>`;
  const items = sent ? [msg(false, 'Maya Patel', '[day, time]', '[Maya’s note to the shop]'), msg(true, 'You (Jo Taylor)', 'just now', '[Jo’s reply]')] : [msg(false, 'Maya Patel', '[day, time]', '[Maya’s note to the shop]')];
  const conv = card(`<div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 18px; font-weight: 700">${MAYA.name}</span><span style="font-size: 13px; color: ${C.muted}">${MAYA.bikeLong} · ${mono('WH-1042')} · <a href="tel:07700900142" style="color: inherit">${mono(MAYA.phone)}</a></span></span><span style="display: flex; gap: 16px">${link('Open the job')}${link('Customer page')}</span></div>
${p('On the job’s page · started by Maya', `font-size: 13px; color: ${C.muted}`)}
${thread(items, 'Conversation with Maya Patel')}
${sent ? statusBar('Sent to Maya by text, with a link to reply on the job’s page.') : writeBox('reply', 'Reply', '[Jo’s reply]', 'Send reply', 'Sent to Maya by text, with a link to reply on the job’s page.')}</div>`, 'flex-grow: 1; min-width: 0');
  const out = isPhone() ? `${list}` : `<div style="display: flex; gap: 16px; align-items: flex-start">${list}${conv}</div>`;
  return page('messages', 'Messages', `<div data-scroll style="height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px">${note('Messages from customers — from a job’s page, or their account. Replies go the way each customer chose, with a link back.')}${out}</div>`, STAFF);
}

// ---------- Service reminders (decision 2) ----------
const serviceDialog = () => popup('svc-title', 'Standard service', 'Full service · 60 min in the diary · £65.00', `
<div style="display: flex; flex-direction: column; gap: 8px"><label for="svc-rem" style="font-size: 15px; font-weight: 600">Remind customers it’s due after</label><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px"><input id="svc-rem" inputmode="numeric" value="[n]" style="width: 64px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}">months</span>
${note('Counted from when the bike is collected. Only customers who said yes get it. Leave empty for no reminder — for a puncture, say.')}</div>
${note('The wording is in Settings › Messages › Service reminder.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 520);
const servicesBoard = () => settingsPage('workshop', 'Workshop', WORKSHOP_INTRO, workshopFolds({ services: servicesOpen({ reminders: true }) }));
const REMINDER_WORDS = 'Hi [Customer’s first name], your [Bike] is due its [Service] at [Shop name]. Book in here — it’s ready to go: [Link to book]. Stop these: [Link to stop].';
const REMINDER_PREVIEW = 'Hi Maya, your Trek Domane AL 3 is due its Standard service at North Street Cycles. Book in here — it’s ready to go: [link]. Stop these: [link].';
const reminderDialog = () => popup('srem-title', 'Service reminder', 'Sent when a bike is due its next service — set on each service in Settings › Workshop', `
<p style="margin: 0; font-size: 15px">Sent the way each customer chose: text, WhatsApp or email.</p>
${wordingBox('srem-words', REMINDER_WORDS)}${bubble(REMINDER_PREVIEW)}
${note('“Stop these” is always added at the end, and can’t be taken off.')}`, `${button('Go back to Wheelhouse’s wording', { variant: 'ghost' })}${button('Done')}`, 640);
// The reminder's link: booking with the bike and service already chosen.
const reminderLanding = () => bookScreens['bk-when'][SIZE];

// ---------- Review requests (decision 5) ----------
const REVIEW_WORDS = 'Thanks for coming to [Shop name], [Customer’s first name]. If you have a minute, we’d love a review: [Link to review]. Stop these: [Link to stop].';
const REVIEW_PREVIEW = 'Thanks for coming to North Street Cycles, Maya. If you have a minute, we’d love a review: [link]. Stop these: [link].';
const reviewDialog = () => popup('rev-title', 'Review request', 'Sent after a bike is collected', `
${rowSwitch('Send review requests', true)}
${field('Your review page', { value: '[Link to the shop’s Google page]', hint: 'Where the link goes — your Google page, say.' })}
<div style="display: flex; flex-direction: column; gap: 6px"><label for="rev-days" style="font-size: 15px; font-weight: 600">Send it</label><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 15px"><input id="rev-days" inputmode="numeric" value="[n]" style="width: 64px; min-height: 44px; box-sizing: border-box; text-align: center; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; font-family: inherit; font-size: 15px; color: ${C.ink}">days after collection</span></div>
${wordingBox('rev-words', REVIEW_WORDS, 3)}${bubble(REVIEW_PREVIEW)}
${note('Everyone gets the same link — Google doesn’t allow asking only happy customers. Only customers who said yes get it.')}`, `${button('Cancel', { variant: 'ghost' })}${button('Save')}`, 640);

// ---------- How we contact you (decision 6) ----------
const radio = (t, on) => `<button type="button" role="radio" aria-checked="${on}" style="min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid ${on ? C.ink : C.border}; background: ${on ? C.mutedBg : 'transparent'}; font-family: inherit; font-size: 15px; font-weight: 600; color: ${C.ink}; display: inline-flex; align-items: center; gap: 6px">${on ? icon('check', 14) : ''}${t}</button>`;
const switchRow = (label, sub, on) => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; border-top: 1px solid ${C.border}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">${label}</span><span style="font-size: 13px; color: ${C.muted}">${sub}</span></span>${offer(on ? 'On' : 'Off', on)}</div>`;
const contactDialog = () => popup('ct-title', 'How we contact you', 'Changes save straight away', `
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15px; font-weight: 700">Job updates</span>${note('Bookings, quotes, and when your bike is ready. You can change how — they can’t be switched off while a bike is with us.')}<div role="radiogroup" aria-label="Job updates by" style="display: flex; flex-wrap: wrap; gap: 8px">${radio('Text', true)}${radio('WhatsApp', false)}${radio('Email', false)}</div></div>
<div style="display: flex; flex-direction: column; padding-top: 6px">${switchRow('Service reminders', 'When your bike is due its next service', true)}${switchRow('Review requests', 'After you collect your bike', true)}${switchRow('Offers and news', 'Only if you say yes', false)}</div>
${note('Each of these ends with “Stop these”, which switches that one off without signing in.')}`, button('Done'), 560);
// The "Stop these" link: one click, no signing in, and it says what happened.
const stopped = () => site(`<div style="width: 100%; max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px">${cardBox(`<span style="display: inline-flex; width: 44px; height: 44px; border-radius: 999px; align-items: center; justify-content: center; background: ${C.okBg}; color: ${C.successInk}">${icon('check', 22)}</span>
<h1 role="status" style="margin: 0; font-size: 24px; font-weight: 700">Service reminders stopped</h1>
${p('We won’t send you service reminders any more. Job updates about a bike that’s with us still come as usual.')}
<div style="display: flex; flex-wrap: wrap; gap: 8px">${button('Turn them back on', { variant: 'default' })}</div>
${note('Want to change anything else? Sign in to your account — “How we contact you”.')}`)}</div>`);

// ---------- Your data (decision 4) ----------
const dataDialog = (state = 'ask') => {
  if (state === 'blocked') return popup('del-title', 'Ask us to delete your account', '', `${p('We can delete your account once your bike has been collected.')}
<div>${kv('Bike with us', `${MAYA.bike} · ${mono('WH-1042')}`)}${kv('Store credit', `${mono('£[credit]')} — use it or ask for it back`)}</div>
${note('Ask again after that, or call [shop phone] if you need to talk it through.')}`, button('OK'), 520);
  if (state === 'sent') return popup('del-title', 'Request sent', '', `${p('North Street Cycles will delete your account and tell you when it’s done — by [date] at the latest.')}
${note('Your details, bikes and messages are deleted. Sales stay in the shop’s books without your name, because the shop must keep them for tax.')}`, button('OK'), 520);
  return popup('del-title', 'Ask us to delete your account', '', `${p('North Street Cycles will delete your account within one month, and tell you when it’s done.')}
${note('Your details, bikes and messages are deleted. Sales stay in the shop’s books without your name, because the shop must keep them for tax. This can’t be undone.')}
${note('Want a copy first? <a href="#" style="color: inherit; font-weight: 600">Download a copy of your data</a>.')}`, `${button('Keep my account', { variant: 'ghost' })}${button('Ask to delete', { variant: 'danger' })}`, 520);
};
// A board scrolled part-way down a long page (as journey 3's Messages board).
const scrolled = (html, px) => `<style>.ac-scrolled > * { position: relative; top: -${px}px }</style>${html.replace(/<div data-scroll style="([^"]*?)overflow-y: auto;/, '<div data-scroll class="ac-scrolled" style="$1overflow-y: hidden;')}`;
const downloaded = () => accountPage({ banner: statusBar('Your data is downloading — details, bikes, jobs, purchases, messages and what you agreed to.') });

// ---------- The boards ----------
def('ac-account', () => accountPage());
def('ac-account-lower', () => scrolled(accountPage(), 560));
def('ac-account-repairs', () => accountPage({ filter: 'Repairs' }));
def('ac-account-new', () => accountPage({ empty: true }));
def('ac-receipt', () => overlay(accountPage({ filter: 'Purchases' }), receiptDialog()));
def('ac-job-note', () => inShopAt(SIZE, () => jobThread('writing')));
def('ac-job-note-sent', () => inShopAt(SIZE, () => jobThread('sent')));
def('ac-job-note-answered', () => inShopAt(SIZE, () => jobThread('answered')));
def('ac-ask', () => overlay(accountPage(), askDialog()));
def('ac-question', () => questionPage());
def('ac-account-asked', () => accountPage({ answered: true }));
def('ac-inbox', () => inbox());
def('ac-inbox-sent', () => inbox({ sent: true }));
def('ac-inbox-all', () => inbox({ sent: true, filter: 'All' }));
def('ac-reply-text', () => overlay(inbox({ sent: true }), popup('txt-title', 'What Maya gets', 'A text, because Maya chose text', phoneText('North Street Cycles replied about your Trek Domane AL 3 (WH-1042): [Jo’s reply]. Replies to this number aren’t read — reply on your page: [link]'), button('Close', { variant: 'default' }), 480)));
def('ac-today', () => today({ replies: true, deleteRequest: true }));
def('ac-book-remind', () => detailsRemindAt(SIZE));
def('ac-collect-remind', () => summaryRemindAt(SIZE));
def('ac-services', () => servicesBoard());
def('ac-service-edit', () => overlay(servicesBoard(), serviceDialog()));
def('ac-messages', () => scrolled(msgPage({ list: msgListOpen({ bringBack: true, hoverReview: true }) }), { desktop: 760, tablet: 760, phone: 1300 }[SIZE]));
def('ac-reminder-wording', () => overlay(msgPage({ list: msgListOpen({ bringBack: true }) }), reminderDialog()));
def('ac-reminder-landing', () => reminderLanding());
def('ac-review-setting', () => overlay(msgPage({ list: msgListOpen({ bringBack: true }) }), reviewDialog()));
def('ac-contact', () => overlay(accountPage(), contactDialog()));
def('ac-stopped', () => stopped());
def('ac-download', () => downloaded());
def('ac-delete', () => overlay(accountPage(), dataDialog('ask')));
def('ac-delete-blocked', () => overlay(accountPage(), dataDialog('blocked')));
def('ac-delete-sent', () => overlay(accountPage(), dataDialog('sent')));
def('ac-privacy-requests', () => customerScreens['cs-privacy'][SIZE]);

// Desktop first (journey process); tablet and phone drawn after the UI audit.
const SIZES = ['desktop'];
for (const [id, fn] of recipes) {
  screens[id] = {};
  for (const sz of SIZES) screens[id][sz] = withSize(sz, () => { SIZE = sz; return fn(); });
}
SIZE = 'desktop';

export const TITLES = {
  'ac-account': 'Your account: bikes, details and how we contact you; one history',
  'ac-account-lower': 'Further down: details, how we contact you, your data',
  'ac-account-repairs': 'History showing repairs only',
  'ac-account-new': 'A new account, with nothing in it yet',
  'ac-receipt': 'A receipt, from the history',
  'ac-job-note': 'A job’s page: “Add a note for the shop”',
  'ac-job-note-sent': 'The note sent, waiting for a reply',
  'ac-job-note-answered': 'The shop’s reply, on the job’s page',
  'ac-ask': 'Ask the shop a question, from the account',
  'ac-question': 'The question and its answer',
  'ac-account-asked': 'The account history, with the answered question',
  'ac-inbox': 'Staff Messages: needs a reply, and the open conversation',
  'ac-inbox-sent': 'Reply sent the way Maya chose',
  'ac-inbox-all': 'All conversations',
  'ac-reply-text': 'The text Maya gets, linking back',
  'ac-today': 'Today: needs a reply, and a request to delete an account',
  'ac-book-remind': 'Booking: “Remind me when my bike is due its next service”',
  'ac-collect-remind': 'Ready to collect: the same tick',
  'ac-services': 'Settings › Workshop › Services: each service’s reminder',
  'ac-service-edit': 'A service’s reminder time',
  'ac-messages': 'Settings › Messages: service reminders and review requests',
  'ac-reminder-wording': 'The service reminder’s wording, with “Stop these”',
  'ac-reminder-landing': 'The reminder’s link: booking, bike and service chosen',
  'ac-review-setting': 'Review requests: the review page, when, the wording',
  'ac-contact': 'How we contact you',
  'ac-stopped': '“Stop these”: stopped in one click, no signing in',
  'ac-download': 'Download a copy of your data: straight away',
  'ac-delete': 'Ask us to delete your account',
  'ac-delete-blocked': 'Can’t delete yet: the bike is still with us',
  'ac-delete-sent': 'Deletion request sent',
  'ac-privacy-requests': 'The shop’s Privacy requests list (Customer service)',
};
export const ROWS = [
  { label: 'Your account', screens: ['ac-account', 'ac-account-lower', 'ac-account-repairs', 'ac-account-new', 'ac-receipt'] },
  { label: 'Talking to the shop', screens: ['ac-job-note', 'ac-job-note-sent', 'ac-job-note-answered', 'ac-ask', 'ac-question', 'ac-account-asked'] },
  { label: 'The shop’s side of messages', screens: ['ac-inbox', 'ac-inbox-sent', 'ac-inbox-all', 'ac-reply-text', 'ac-today'] },
  { label: 'Service reminders', screens: ['ac-book-remind', 'ac-collect-remind', 'ac-services', 'ac-service-edit', 'ac-messages', 'ac-reminder-wording', 'ac-reminder-landing'] },
  { label: 'Reviews and how we contact you', screens: ['ac-review-setting', 'ac-contact', 'ac-stopped'] },
  { label: 'Your data', screens: ['ac-download', 'ac-delete', 'ac-delete-blocked', 'ac-delete-sent', 'ac-privacy-requests'] },
];
