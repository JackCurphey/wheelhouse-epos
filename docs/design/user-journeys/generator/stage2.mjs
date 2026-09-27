// Stage 2 drawings: the Workshop day, redrawn from the Release 1 screen designs
// in the Fjell theme, inside the room-sidebar shells from stage 1.
// Each screen returns { desktop, phone } inner markup at 1280x800 and 390x844.
import { C, MONO, esc, icon, button, field, card, badge } from './ui.mjs';
import { staffDesktop, staffPhone, p, link, stack } from './stage1.mjs';

// ---------- Small helpers ----------
const MECH = { role: 'K', person: 'Alex Morgan', roleName: 'Mechanic' };
// Front-desk screens are drawn as a Staff user (Jo Taylor), matching the 'Staff' role in the journey rows.
const STAFF = { role: 'S', person: 'Jo Taylor', roleName: 'Staff' };
const sd = (active, title, content, opts = {}) => staffDesktop(active, title, content, { ...STAFF, ...opts });
const sp = (title, content, opts = {}) => staffPhone(title, content, { role: 'S', ...opts });
const mono = (t, extra = '') => `<span style="font-family: ${MONO}; ${extra}">${esc(t)}</span>`;
const h2 = (t, size = 16) => `<h2 style="margin: 0; font-size: ${size}px; line-height: 1.3; font-weight: 700">${esc(t)}</h2>`;
const txt = (t, size = 14, extra = '') => `<p style="margin: 0; font-size: ${size}px; line-height: 1.45; color: ${C.ink}; ${extra}">${t}</p>`;
const note = (t, size = 13) => p(t, size);
const eyebrow = (t) => `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${C.muted}">${t}</div>`;
const panel = (inner, extra = '', pad = 18, gap = 12) => card(`<div style="padding: ${pad}px; display: flex; flex-direction: column; gap: ${gap}px">${inner}</div>`, extra);
const row = (inner, gap = 12, extra = '') => `<div style="display: flex; align-items: center; gap: ${gap}px; ${extra}">${inner}</div>`;
const grid = (cols, inner, gap = 16, extra = '') => `<div style="display: grid; grid-template-columns: ${cols}; gap: ${gap}px; align-items: start; ${extra}">${inner}</div>`;
const banner = (t, tone = 'ok') => {
  const [bg, fg, ic] = { ok: [C.okBg, C.accentDark, 'check'], warn: [C.warnBg, C.warnInk, 'alert'], info: [C.mutedBg, C.ink, 'alert'] }[tone];
  return `<div role="status" style="display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; border-radius: 8px; background: ${bg}; color: ${fg}; font-size: 14px; line-height: 1.45; font-weight: 500">${icon(ic, 18)}<span>${t}</span></div>`;
};
const check = (label, checked, id) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 28px"><input id="${id}" type="checkbox"${checked ? ' checked' : ''} style="width: 18px; height: 18px; margin: 0; accent-color: ${C.accent}; flex-shrink: 0"><label for="${id}" style="font-size: 14px; color: ${C.ink}">${esc(label)}</label></div>`;
const area = (label, value, id, rows = 3) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><textarea id="${id}" rows="${rows}" style="width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; padding: 9px 10px; font-size: 14px; line-height: 1.4; font-family: inherit; color: ${C.ink}; resize: none">${esc(value)}</textarea></div>`;
const select = (label, options, id) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600; color: ${C.ink}">${esc(label)}</label><select id="${id}" style="width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid ${C.input}; background: ${C.panel}; padding: 0 10px; min-height: 44px; font-size: 14px; font-family: inherit; color: ${C.ink}">${options.map((o, i) => `<option${i === 0 ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
const btnRow = (inner, extra = '') => `<div style="display: flex; flex-wrap: wrap; gap: 10px; ${extra}">${inner}</div>`;
const ticked = (t) => row(`${icon('check', 16, C.accentDark)}<span style="font-size: 14px">${esc(t)}</span>`, 8);
const segmented = (items, activeIdx, label) => `<div role="group" aria-label="${esc(label)}" style="display: inline-flex; gap: 6px; flex-wrap: wrap">${items.map((t, i) => `<button type="button" aria-pressed="${i === activeIdx}" style="min-height: 36px; padding: 0 12px; border-radius: 6px; font-family: inherit; font-size: 14px; font-weight: 600; border: 1px solid ${i === activeIdx ? C.accent : C.input}; background: ${i === activeIdx ? C.accent : C.panel}; color: ${i === activeIdx ? '#ffffff' : C.ink}">${esc(t)}</button>`).join('')}</div>`;
const quote = (t) => `<blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid ${C.border}; font-size: 14px; line-height: 1.5; color: ${C.ink}">${esc(t)}</blockquote>`;

// Desktop table with real <th> headers. cols: [label, align]; cells are markup.
const table = (cols, rows, { size = 14, pad = '9px 12px' } = {}) => `<table style="width: 100%; border-collapse: collapse; font-size: ${size}px">
<thead><tr>${cols.map(([c, a]) => `<th scope="col" style="text-align: ${a || 'left'}; padding: 8px 12px; font-size: 12px; font-weight: 600; color: ${C.muted}; background: ${C.mutedBg}; border-bottom: 1px solid ${C.border}">${c ? esc(c) : '<span style="position: absolute; width: 1px; height: 1px; overflow: hidden">Action</span>'}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((cell, i) => `<td style="text-align: ${cols[i][1] || 'left'}; padding: 9px 12px; border-bottom: 1px solid ${C.border}; vertical-align: middle; padding: ${pad}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const two = (a, b) => `<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600">${a}</span><span style="font-size: 13px; color: ${C.muted}">${b}</span></div>`;
// Phone: one card per table row.
const rowCard = (left, right = '', extra = '', pad = '10px 12px') => card(`<div style="padding: ${pad}; display: flex; align-items: center; justify-content: space-between; gap: 10px">${left}${right ? `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0">${right}</div>` : ''}</div>`, `box-shadow: none; ${extra}`);
const showAll = (t = 'Show all') => `<div style="display: flex; justify-content: center">${link(t)}</div>`;

// Phone body: content at the top, main action full width at the bottom.
const phoneBody = (top, bottom = '', gap = 12) => `<div style="height: 100%; display: flex; flex-direction: column; gap: ${gap}px"><div data-fit style="flex-grow: 1; min-height: 0; display: flex; flex-direction: column; gap: ${gap}px">${top}</div>${bottom ? `<div style="display: flex; flex-direction: column; gap: 8px">${bottom}</div>` : ''}</div>`;

// ---------- Example data (from the Release 1 designs) ----------
const LINES = [
  ['Standard service', 'Labour · 60 min', '£65.00'],
  ['Shimano brake pads', `Part · ${mono('B05S-RX')}`, '£28.00'],
  ['Fit &amp; adjust brakes', 'Labour · 30 min', '£18.00'],
  ['Replace gear cable', 'Optional · cable still serviceable', '£12.00'],
];
const QUOTE_TONES = [['Agreed', 'green'], ['New', 'blue'], ['New', 'blue'], ['Optional', 'grey']];
const DECISIONS = [['Approved', 'green'], ['Approved', 'green'], ['Approved', 'green'], ['Declined', 'red']];
const linesTable = (tags, cols = ['Work', 'Qty', 'Amount', '']) => table([[cols[0]], [cols[1], 'center'], [cols[2], 'right'], [cols[3]]], LINES.map(([w, s, a], i) => [two(w, s), '1', mono(a), badge(...tags[i])]));
const linesCards = (tags, pad) => LINES.map(([w, s, a], i) => rowCard(two(w, s), `${mono(a, 'font-size: 14px')}${badge(...tags[i])}`, '', pad)).join('');
const CONCERN = '“My rear brake squeals and feels weak. The gears could use a tune-up too.”';

// ---------- Shared job header (job workspace screens) ----------
const TABS = ['Overview', 'Quote', 'Checklist', 'Messages', 'History'];
const STATS = [['Booking', 'Thu 17 Sep · drop-off'], ['Target ready', `Fri 18 Sep · ${mono('16:00')}`], ['Allocated effort', '90 min · shared queue']];
const crumbs = (size) => `<nav aria-label="Breadcrumb" style="font-size: ${size}px; color: ${C.muted}; display: flex; gap: 6px; align-items: center"><a href="#" style="color: ${C.muted}">Workshop</a><span aria-hidden="true">›</span><a href="#" style="color: ${C.muted}">Jobs</a><span aria-hidden="true">›</span><span aria-current="page" style="font-family: ${MONO}; color: ${C.ink}">WH-1042</span></nav>`;
const tabBar = (active, phone) => `<nav aria-label="Job sections" style="display: flex; gap: ${phone ? 0 : 4}px; border-bottom: 1px solid ${C.border}">${TABS.map((t) => `<a href="#" aria-current="${t === active ? 'page' : 'false'}" style="padding: ${phone ? '8px 7px' : '9px 14px'}; font-size: ${phone ? 13 : 14}px; font-weight: ${t === active ? 700 : 500}; color: ${t === active ? C.ink : C.muted}; text-decoration: none; border-bottom: 2px solid ${t === active ? C.accent : 'transparent'}; margin-bottom: -1px">${t}</a>`).join('')}</nav>`;
function jobHead(status, tone, tab, { phone = false, tabs = true, crumb = true } = {}) {
  if (phone) {
    return `<div style="display: flex; flex-direction: column; gap: 6px">
${crumb ? crumbs(12) : ''}
<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; color: ${C.muted}">${mono('WH-1042')} · Maya Patel</span>${h2('Trek Domane AL 3', 18)}</div>${badge(status, tone)}</div>
<dl style="margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 1px 10px; font-size: 13px">${STATS.map(([k, v]) => `<dt style="color: ${C.muted}">${k}</dt><dd style="margin: 0; font-weight: 600">${v}</dd>`).join('')}</dl>
${tabs ? tabBar(tab, true) : ''}
</div>`;
  }
  return `<div style="display: flex; flex-direction: column; gap: 10px">
${crumb ? crumbs(13) : ''}
<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; color: ${C.muted}">${mono('WH-1042')} · Maya Patel</span>${h2('Trek Domane AL 3', 22)}</div>
<dl style="margin: 0; display: flex; gap: 28px; font-size: 13px">${STATS.map(([k, v]) => `<div style="display: flex; flex-direction: column; gap: 2px"><dt style="color: ${C.muted}">${k}</dt><dd style="margin: 0; font-weight: 600; font-size: 14px">${v}</dd></div>`).join('')}</dl>
${badge(status, tone)}
</div>
${tabs ? tabBar(tab, false) : ''}
</div>`;
}
const jobDesktop = (status, tone, tab, content, opts = {}) => sd('jobs', 'Job workspace', stack(`${jobHead(status, tone, tab)}${content}`, 16), opts);
const jobPhone = (status, tone, tab, top, bottom, { gap = 12, ...opts } = {}) => sp('Job workspace', phoneBody(`${jobHead(status, tone, tab, { phone: true })}${top}`, bottom, gap), { active: 'jobs', ...opts });

// ---------- Screens ----------
export const screens = {};

// Requests
const REQ = [
  ['Maya Patel', 'Trek Domane AL 3 · green', 'Standard service', 'Rear brake squeal', 'Thu 17 Sep', '60 min', button('Review', { variant: 'accent', size: 'sm' })],
  ['Oliver Chen', 'Brompton C Line · black', 'Not sure / diagnosis', '', 'Fri 18 Sep', 'To assess', button('Review diagnosis', { variant: 'default', size: 'sm' })],
  ['Sam Reed', 'Specialized Sirrus · grey', 'Brake service', '', 'Fri 18 Sep', '45 min', badge('Needs review', 'purple')],
];
const reqFilters = segmented(['Needs review · 3', 'Confirmed today · 6'], 0, 'Show requests');
const reqNote = 'Requests awaiting a decision are shown separately from confirmed work. Reservation expiry is visible on each request.';
screens.requests = {
  desktop: sd('requests', 'Booking requests', stack(`${txt('3 requests need a decision. Confirm the work before the customer travels.', 15)}
${reqFilters}
${card(table([['Customer / bike'], ['Requested work'], ['Requested day'], ['Effort'], ['', 'right']], REQ.map(([n, b, w, w2, d, e, a]) => [two(esc(n), esc(b)), w2 ? two(esc(w), esc(w2)) : esc(w), esc(d), esc(e), a])), 'overflow: hidden')}
${note(reqNote)}`, 16)),
  phone: sp('Booking requests', phoneBody(`${txt('3 requests need a decision. Confirm the work before the customer travels.')}
${reqFilters}
${REQ.map(([n, b, w, w2, d, e, a]) => card(`<div style="padding: 12px; display: flex; flex-direction: column; gap: 8px">${row(`${two(esc(n), esc(b))}`, 8, 'justify-content: space-between')}<div style="font-size: 14px">${esc(w)}${w2 ? ` · <span style="color: ${C.muted}">${esc(w2)}</span>` : ''}</div>${row(`<span style="font-size: 13px; color: ${C.muted}">${esc(d)} · ${esc(e)}</span>${a}`, 8, 'justify-content: space-between')}</div>`, 'box-shadow: none')).join('')}
${note(reqNote)}`), { active: 'requests' }),
};

// Review a request
const reviewLeft = (compact) => `${eyebrow(`${mono('WH-1042')} · received today at ${mono('08:42')}`)}
${row(`${h2('Maya Patel', compact ? 18 : 20)}${badge('Needs review', 'purple')}`, 10, 'justify-content: space-between')}
${txt('Trek Domane AL 3 · green · black mudguards', 14, `color: ${C.muted}`)}
<div style="display: flex; flex-direction: column; gap: 6px">${h2('What the customer told us', 14)}${quote(CONCERN)}</div>
<div style="display: flex; flex-direction: column; gap: 4px">${txt(`<strong>Standard service · ${mono('£65.00')}</strong>`)}${note('60 minutes planned. Parts and additional work require agreement.')}</div>
${`<div style="display: flex; flex-direction: column; gap: 4px">${h2('Customer communication', 14)}${note('Confirmation by email and SMS. The booking link shows the same booking.')}</div>`}`;
const reviewForm = (sfx) => `${h2('Reserve the work')}
${field('Drop-off day', { type: 'date', value: '2026-09-17', id: 'dropoff-' + sfx })}
${select('Allocation', ['Shared workshop queue', 'Alex Morgan', 'Jo Taylor'], 'alloc-' + sfx)}
${note('2 hours available after this booking.')}
${banner(`Request reservation expires today at ${mono('12:00')}. Confirming keeps the allocation.`, 'warn')}`;
screens.review = {
  desktop: sd('requests', 'Booking requests', stack(`<nav aria-label="Breadcrumb" style="font-size: 13px; color: ${C.muted}"><a href="#" style="color: ${C.muted}">Booking requests</a> › Review booking request</nav>
${grid('minmax(0, 1fr) 400px', `${panel(reviewLeft(false), '', 22, 14)}${panel(`${reviewForm('d')}${stack(`${button('Confirm booking', { block: true })}${btnRow(`${button('Offer another date', { variant: 'default' })}${button('Decline with a message', { variant: 'ghost' })}`)}`, 10)}`, '', 22, 14)}`, 20)}`, 14)),
  phone: sp('Review request', phoneBody(`${panel(reviewLeft(true), 'box-shadow: none', 14, 8)}${panel(reviewForm('p'), 'box-shadow: none', 14, 8)}`,
    `${button('Confirm booking', { block: true })}${grid('1fr 1fr', `${button('Another date', { variant: 'default', block: true })}${button('Decline', { variant: 'default', block: true })}`, 8)}`, 10), { active: 'requests' }),
};

// Decline
const rejectBody = (sfx) => `${h2('Decline booking request', 20)}
${txt(`${mono('WH-1042')} · Maya Patel`, 14, `color: ${C.muted}`)}
${txt('<strong>Explain what the customer can do next</strong>')}
${area('Message to Maya', 'Sorry, we can’t fit this service in on Thursday. Please try Friday, or call us and we’ll help find another day.', 'decline-msg-' + sfx, 4)}
${note('Declining releases the request’s reservation. The customer is told not to travel for this request.')}`;
screens.reject = {
  desktop: sd('requests', 'Booking requests', `<div style="max-width: 620px">${panel(`${rejectBody('d')}${btnRow(`${button('Keep request', { variant: 'default' })}${button('Decline & notify customer', { variant: 'danger' })}`, 'justify-content: flex-end')}`, '', 24, 14)}</div>`),
  phone: sp('Decline request', phoneBody(stack(rejectBody('p'), 14), `${button('Decline & notify customer', { variant: 'danger', block: true })}${button('Keep request', { variant: 'default', block: true })}`), { active: 'requests' }),
};

// Workshop desk
const STATS_DESK = [['Expected today', '8 bikes', '3 still to arrive'], ['In the workshop', '12', '4 ready to collect'], ['Planned effort', '6h / 8h', 'Shared and assigned, counted once']];
const deskTabs = segmented(['Arrivals · 3', 'Shared queue · 4', 'Needs attention · 2', 'Ready · 4'], 0, 'Show jobs');
const ARRIVALS = [['WH-1042', 'Maya Patel', 'Trek Domane AL 3', 'Standard service', button('Book in', { size: 'sm' })], ['WH-1045', 'Jamie Brooks', 'Giant Escape 2', 'Gear adjustment', `<span style="font-size: 13px">${mono('10:30')} appointment</span>`], ['WH-1047', 'Aisha Khan', 'Cannondale Quick', 'Safety check', '<span style="font-size: 13px">Drop-off</span>']];
screens.desk = {
  desktop: sd('jobs', 'Today’s workshop', stack(`${txt('Thursday 17 September · one shop, one view of the work', 15, `color: ${C.muted}`)}
${grid('repeat(3, minmax(0, 1fr))', STATS_DESK.map(([k, v, s]) => panel(`${eyebrow(k)}<div style="font-size: 26px; font-weight: 700">${esc(v)}</div>${note(s)}`, '', 18, 6)).join(''))}
${deskTabs}
${card(table([['Job / customer'], ['Bike'], ['Work'], ['Custody'], ['', 'right']], ARRIVALS.map(([j, n, b, w, a]) => [`${mono(j)} · ${esc(n)}`, esc(b), esc(w), badge('Expected', 'blue'), a])), 'overflow: hidden')}`, 16), { actions: button('New job') }),
  phone: sp('Today’s workshop', phoneBody(`${txt('Thursday 17 September · one shop, one view of the work', 14, `color: ${C.muted}`)}
${STATS_DESK.map(([k, v, s]) => rowCard(`<div style="display: flex; flex-direction: column; gap: 2px">${eyebrow(k)}<span style="font-size: 13px; color: ${C.muted}">${esc(s)}</span></div>`, `<span style="font-size: 20px; font-weight: 700">${esc(v)}</span>`)).join('')}
${deskTabs}
${ARRIVALS.map(([j, n, b, w, a]) => rowCard(two(`${mono(j)} · ${esc(n)}`, `${esc(b)} · ${esc(w)}`), `${badge('Expected', 'blue')}${a}`)).join('')}`, button('New job', { block: true }), 10), { active: 'jobs' }),
};

// Walk-in job
const custResult = `<div style="padding: 10px 12px; border-radius: 8px; border: 2px solid ${C.accent}; background: ${C.mutedBg}; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Maya Patel</span><span style="font-size: 13px; color: ${C.muted}">07700 900 142 · maya@example.test</span><span style="font-size: 13px">Trek Domane AL 3 · green</span></div>`;
const custBike = (s) => `${h2('Customer & bike')}${field('Find customer by name, phone or email', { value: 'Maya Patel', id: 'find-' + s })}${custResult}${field('Work requested', { value: 'Standard service; inspect rear brake', id: 'work-' + s })}${check('Bike is here now', true, 'here-' + s)}`;
const planWork = (s) => `${h2('Plan the work')}${field('Planned effort', { value: '60 minutes', id: 'effort-' + s })}${field('Drop-off day', { type: 'date', value: '2026-09-17', id: 'nj-drop-' + s })}${select('Queue / technician', ['Shared workshop queue', 'Alex Morgan'], 'queue-' + s)}`;
const newJobNote = 'New customers and bikes can be added at the counter. No sale or invoice is created by this action.';
screens['new-job'] = {
  desktop: sd('jobs', 'New workshop job', stack(`${txt('Use the same workflow for a customer at the counter.', 15, `color: ${C.muted}`)}
${grid('minmax(0, 1fr) minmax(0, 1fr)', `${panel(custBike('d'), '', 22, 14)}${panel(`${planWork('d')}${button('Create job & book in', { block: true })}${note(newJobNote)}`, '', 22, 14)}`, 20)}`, 16)),
  phone: sp('New workshop job', phoneBody(`${panel(custBike('p'), 'box-shadow: none', 14, 10)}${panel(planWork('p'), 'box-shadow: none', 14, 10)}`, `${button('Create job & book in', { block: true })}`, 10), { active: 'jobs' }),
};

// Intake
const arrived = (s, rows) => `${h2('Confirm what arrived')}${field('Bike identification', { value: 'Green · black mudguards', id: 'ident-' + s })}${field('Accessories received', { value: 'Rear light, lock key', id: 'acc-' + s })}${area('Condition / handover note', 'Scuff on left bar end. Customer reports rear brake noise.', 'cond-' + s, rows)}`;
const bookInChecks = (s) => `${h2('Book-in checklist')}${check('Bike is physically in the shop', true, 'in-' + s)}${check('Identity and accessories checked', true, 'idc-' + s)}${check('Print bike tag on Front desk Zebra', true, 'tag-' + s)}${note('A tag prints when you confirm book-in. Pending requests do not print tags.')}`;
screens.intake = {
  desktop: jobDesktop('Expected', 'blue', 'Overview', grid('minmax(0, 1fr) minmax(0, 1fr)', `${panel(arrived('d', 2), '', 20, 12)}${panel(`${bookInChecks('d')}${button('Confirm book-in & print tag', { block: true })}`, '', 20, 12)}`, 20)),
  phone: jobPhone('Expected', 'blue', 'Overview', `${panel(arrived('p', 2), 'box-shadow: none', 12, 8)}${panel(bookInChecks('p'), 'box-shadow: none', 12, 6)}`, button('Confirm book-in & print tag', { block: true })),
};

// Print the tag
const tagPreview = (compact) => `<figure aria-label="Bike tag preview" style="margin: 0; box-sizing: border-box; padding: ${compact ? 12 : 18}px; border-radius: 8px; border: 1px solid ${C.ink}; background: #ffffff; display: flex; flex-direction: column; gap: ${compact ? 4 : 6}px">
<div style="font-size: 11px; font-weight: 700; letter-spacing: 1px">NORTH STREET CYCLES</div>
<div style="font-family: ${MONO}; font-size: ${compact ? 26 : 34}px; line-height: 1.1">WH-1042</div>
<div style="font-size: 13px; font-weight: 700">TREK DOMANE AL 3</div>
<div style="font-size: 13px">Green · black mudguards</div>
<div style="height: ${compact ? 40 : 64}px; box-sizing: border-box; border: 2px dashed ${C.input}; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: ${C.muted}">Code 128 barcode goes here</div>
<div style="text-align: center; font-family: ${MONO}; font-size: 13px">WH-1042</div>
<div style="font-size: 12px; color: ${C.muted}">Scan the barcode to open the staff job</div>
<div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding-top: 6px; border-top: 1px solid ${C.border}"><span>IN: <span style="font-family: ${MONO}">17 SEP 2026</span></span><span>JOB CARD · KEEP WITH BIKE</span></div>
</figure>`;
const printStatus = `${row(`${h2('Bike tag sent')}${badge('Acknowledged', 'green')}`, 10, 'justify-content: space-between')}${txt('Front desk Zebra · 1 copy')}${note(`${mono('09:12')} · printed by Jack Lewis`)}${note('Attach the tag where it can be scanned without removing it from the bike.')}`;
const reprint = `${h2('Need another copy?', 15)}${note('Check the printer output before reprinting.')}`;
screens.print = {
  desktop: jobDesktop('In workshop', 'blue', 'Overview', grid('360px minmax(0, 1fr)', `${tagPreview(false)}${stack(`${panel(`${printStatus}${btnRow(button('Scan / look up the job'))}`, '', 20, 10)}${panel(`${reprint}${btnRow(`${button('Review print status', { variant: 'default' })}${button('Full job card', { variant: 'default' })}`)}`, '', 20, 10)}`, 16)}`, 20)),
  phone: jobPhone('In workshop', 'blue', 'Overview', `${tagPreview(true)}${panel(printStatus, 'box-shadow: none', 12, 6)}${row(`${link('Review print status')}${link('Full job card')}`, 16, 'justify-content: center')}`, button('Scan / look up the job', { block: true })),
};

// Scan (mechanic)
const scanForm = (s) => `${eyebrow('Find a bike')}${h2('Scan it. Find the job.', 24)}${note('Use your phone camera on the tag’s QR code, or scan the job number into search.', 14)}
<div style="display: flex; align-items: flex-end; gap: 10px"><div style="flex-grow: 1">${field('Job number / scanner input', { value: 'WH-1042', id: 'scan-' + s })}</div>${s === 'd' ? button('Open job') : ''}</div>`;
const scanResult = rowCard(`<div style="display: flex; flex-direction: column; gap: 2px">${mono('WH-1042', 'font-size: 15px')}<span style="font-size: 14px; font-weight: 600">Trek Domane AL 3</span><span style="font-size: 13px; color: ${C.muted}">Green · black mudguards</span></div>`, badge('In workshop', 'blue'));
const scanNote = 'You’re signed in to North Street Cycles. Scanning opens the job; it doesn’t change its status.';
screens.scan = {
  desktop: sd('jobs', 'Find a bike', `<div style="max-width: 560px">${panel(`${scanForm('d')}${scanResult}${note(scanNote)}<div>${link('See signed-out scan')}</div>`, '', 24, 14)}</div>`, MECH),
  phone: sp('Find a bike', phoneBody(`${scanForm('p')}${scanResult}${note(scanNote)}<div>${link('See signed-out scan')}</div>`, button('Open job', { block: true })), { role: 'K', active: 'jobs' }),
};

// Complete job workspace
const jobCards = {
  cust: `${h2('Customer & bike', 15)}${txt('Maya Patel · 07700 900 142')}${note('Trek Domane AL 3 · green · black mudguards', 14)}`,
  concern: `${h2('Customer’s concern', 15)}${txt('Rear brake squeals and feels weak. Gears need a tune-up.')}`,
  custody: `${h2('Bike in shop', 15)}${ticked('Lock key received')}${ticked('Rear light received')}`,
  next: `${h2('Next action', 15)}${txt('Inspect the brake and agree any additional work before starting it.')}`,
  planned: `${h2('Planned work', 15)}${txt('Standard service · 60 minutes')}${txt(`${mono('£65.00')} agreed`)}`,
  tag: `${h2('Bike tag', 15)}${txt(`${mono('WH-1042')} · attached at intake`)}`,
};
screens.job = {
  desktop: jobDesktop('In workshop', 'blue', 'Overview', grid('repeat(3, minmax(0, 1fr))', [
    panel(jobCards.cust, '', 18, 8), panel(jobCards.concern, '', 18, 8), panel(jobCards.custody, '', 18, 8),
    panel(`${jobCards.next}<div>${button('Open inspection', { size: 'sm' })}</div>`, '', 18, 8), panel(`${jobCards.planned}<div>${button('Edit quote', { variant: 'default', size: 'sm' })}</div>`, '', 18, 8), panel(`${jobCards.tag}<div>${button('Print / scan', { variant: 'default', size: 'sm' })}</div>`, '', 18, 8),
  ].join(''), 16)),
  phone: jobPhone('In workshop', 'blue', 'Overview', `${panel(jobCards.cust, 'box-shadow: none', 12, 4)}${panel(jobCards.concern, 'box-shadow: none', 12, 4)}${panel(jobCards.next, 'box-shadow: none', 12, 4)}
${card(`<div style="padding: 4px 12px">${[['Bike in shop', 'Lock key, rear light received', ''], ['Planned work', `Standard service · ${mono('£65.00')} agreed`, 'Edit quote'], ['Bike tag', `${mono('WH-1042')} · attached at intake`, 'Print / scan']].map(([k, v, a], i) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 0; ${i ? `border-top: 1px solid ${C.border}` : ''}">${two(k, v)}${a ? link(a) : ''}</div>`).join('')}</div>`, 'box-shadow: none')}`, button('Open inspection', { block: true })),
};

// History
const HIST = [['Inspection recorded', 'Alex Morgan', '10:42', 'rear pads worn, cable optional'], ['Bike received', 'Jack Lewis', '09:12', 'lock key + rear light'], ['Booking confirmed', 'Jack Lewis', '09:01', 'shared queue, 60 minutes'], ['Booking requested', 'Maya Patel', '08:42', 'standard service, requested Thursday']];
const timeline = (items) => `<ol style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column">${items.map(([t, who, at, what], i) => `<li style="display: flex; gap: 12px; padding: 10px 0; ${i ? `border-top: 1px solid ${C.border}` : ''}"><span style="width: 10px; height: 10px; margin-top: 5px; border-radius: 999px; background: ${i ? C.input : C.accent}; flex-shrink: 0"></span><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600">${esc(t)}</span><span style="font-size: 13px; color: ${C.muted}">${[who, at ? mono(at) : '', what].filter(Boolean).map((x, j) => j === 1 ? x : esc(x)).join(' · ')}</span></div></li>`).join('')}</ol>`;
screens.history = {
  desktop: jobDesktop('In workshop', 'blue', 'History', `<div style="max-width: 680px">${panel(`${h2('Activity & decisions')}${timeline(HIST)}`, '', 20, 6)}</div>`),
  phone: jobPhone('In workshop', 'blue', 'History', panel(`${h2('Activity & decisions')}${timeline(HIST)}`, 'box-shadow: none', 14, 4), ''),
};

// Quote editor
const quoteSummary = (compact) => `${row(`${h2('Quote revision 2', 15)}`, 8)}${note('£65 service already agreed.<br>Additional work needs a decision.')}
<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding-top: ${compact ? 4 : 8}px; border-top: 1px solid ${C.border}"><span style="font-size: 14px; font-weight: 600">All proposed work</span>${mono('£123.00', `font-size: ${compact ? 20 : 24}px`)}</div>
${note('Includes £20.50 VAT. Final amount depends on selected lines.')}`;
const quoteMsg = (s, rows) => area('Message to Maya', 'We found worn rear pads. The gear cable is optional; it can wait.', 'qmsg-' + s, rows);
screens['quote-editor'] = {
  desktop: jobDesktop('Awaiting approval', 'purple', 'Quote', grid('minmax(0, 1fr) 340px', `${stack(`${card(linesTable(QUOTE_TONES), 'overflow: hidden')}<div>${button('Add service, SKU or scanned part', { variant: 'default' })}</div>`, 12)}${panel(`${quoteSummary(false)}${quoteMsg('d', 2)}${button('Preview & send for approval', { block: true })}${note('Parts prices are snapshots. A catalogue update won’t change agreed work.', 12)}`, '', 18, 10)}`, 20)),
  phone: jobPhone('Awaiting approval', 'purple', 'Quote', `<div style="display: flex; flex-direction: column; gap: 4px">${linesCards(QUOTE_TONES, '7px 12px')}</div>${link('Add service, SKU or scanned part')}${panel(quoteSummary(true), 'box-shadow: none', 10, 2)}${quoteMsg('p', 2)}`, button('Preview & send for approval', { block: true }), { gap: 10 }),
};

// Send for approval
const channels = (s) => `<fieldset style="margin: 0; padding: 0; border: 0; display: flex; gap: 18px; flex-wrap: wrap"><legend style="font-size: 14px; font-weight: 600; margin-bottom: 6px">Send by</legend>${check('Email', true, 'ch-email-' + s)}${check('SMS', true, 'ch-sms-' + s)}${check('WhatsApp (off)', false, 'ch-wa-' + s)}</fieldset>`;
const sendMsg = 'Hi Maya, we’ve inspected your Trek. The rear pads need replacing. Please review each item using your booking link. The cable replacement is optional.';
const included = `<div style="display: flex; flex-direction: column; gap: 2px">${txt('<strong>Included with this request</strong>', 14)}${note('Inspection finding · quote revision 2 · individual line decisions')}</div>`;
const linkCard = `${h2('Booking link', 15)}${note('The customer can review on any device. The link only approves the quote they are shown.')}`;
const noProvider = `${h2('No messaging provider connected?', 14)}${note('Copying the booking link remains available so work can be agreed independently of delivery setup.')}`;
screens['quote-send'] = {
  desktop: jobDesktop('Awaiting approval', 'purple', 'Quote', grid('minmax(0, 1fr) 340px', `${panel(`${h2('Ask Maya to approve the extra work', 18)}${channels('d')}${area('Message', sendMsg, 'send-msg-d', 3)}${included}<div>${button('Send approval request')}</div>`, '', 20, 12)}${panel(`${linkCard}<div>${button('Preview booking link', { variant: 'default' })}</div><div style="padding-top: 10px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 6px">${noProvider}</div>`, '', 20, 10)}`, 20)),
  phone: jobPhone('Awaiting approval', 'purple', 'Quote', `${h2('Ask Maya to approve the extra work', 16)}${channels('p')}${area('Message', sendMsg, 'send-msg-p', 4)}${included}${row(link('Preview booking link'), 0)}`, button('Send approval request', { block: true })),
};

// Approved
const approvedBanner = `Maya responded at ${mono('11:18')}. Quote 2: ${mono('£111.00')} approved; optional gear cable declined.`;
const readyAlloc = `${h2('Ready to allocate', 15)}${txt('Approved effort: 90 minutes.')}${banner('Recheck capacity for the extra 30 minutes before committing the work.', 'warn')}`;
const agreedTotal = `<div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 2px"><span style="font-size: 15px; font-weight: 700">Agreed total</span>${mono('£111.00', 'font-size: 18px')}</div>`;
screens.approved = {
  desktop: jobDesktop('Approved', 'green', 'Quote', stack(`${banner(approvedBanner)}${grid('minmax(0, 1fr) 320px', `${stack(`${card(linesTable(DECISIONS, ['Work', 'Qty', 'Amount', 'Decision']), 'overflow: hidden')}${note('Changing an approved line creates a new proposal. Original decisions stay in the history.')}`, 10)}${panel(`${readyAlloc}${button('Allocate approved work', { block: true })}`, '', 18, 10)}`, 20)}`, 14)),
  phone: jobPhone('Approved', 'green', 'Quote', `${banner(approvedBanner)}<div style="display: flex; flex-direction: column; gap: 6px">${linesCards(DECISIONS)}</div>${agreedTotal}${banner('Approved effort: 90 minutes. Recheck capacity for the extra 30 minutes before committing the work.', 'warn')}`, button('Allocate approved work', { block: true })),
};

// Diary
const BLUE = ['#eaf1fb', '#2c5289'], GREEN = [C.okBg, C.accentDark], AMBER = [C.warnBg, C.warnInk];
const block = ([bg, edge], title, sub, extra = '', style = '') => `<div style="box-sizing: border-box; padding: 6px 10px; border-radius: 6px; background: ${bg}; border-left: 3px solid ${edge}; display: flex; flex-direction: column; gap: 1px; font-size: 13px; line-height: 1.35; ${style}"><span style="font-weight: 600">${title}</span>${sub ? `<span>${sub}</span>` : ''}${extra ? `<span>${extra}</span>` : ''}</div>`;
const COLS = [
  ['Alex Morgan', '4h available', [[0, 2, BLUE, `${mono('WH-1038')} · Safety check`, `${mono('09:00–10:00')} · 60 min`], [5, 3, GREEN, `${mono('WH-1042')} · Maya Patel`, 'Trek Domane · 90 min', `${mono('11:30–13:00')} · approved ${mono('£111')}`]]],
  ['Jo Taylor', '4h available', [[0, 3, BLUE, `${mono('WH-1040')} · Gear service`, `${mono('09:00–10:30')} · 90 min`], [6, 1, AMBER, 'Lunch / unavailable', mono('12:00–12:30')]]],
  ['Shared queue', 'Unassigned effort', [[0, 2, BLUE, `${mono('WH-1046')} · Standard service`, '60 min · drop-off']]],
];
const SLOT = 40, SLOTS = 10; // 09:00 to 14:00 in 30-minute slots
const diaryGrid = `<div role="grid" aria-label="Thursday 17 September, day view" style="display: grid; grid-template-columns: 64px repeat(3, minmax(0, 1fr)); border: 1px solid ${C.border}; border-radius: 10px; overflow: hidden; background: ${C.panel}">
<div style="background: ${C.mutedBg}"></div>${COLS.map(([n, s]) => `<div role="columnheader" style="padding: 8px 12px; background: ${C.mutedBg}; border-left: 1px solid ${C.border}; display: flex; flex-direction: column"><span style="font-size: 14px; font-weight: 700">${n}</span><span style="font-size: 12px; color: ${C.muted}">${s}</span></div>`).join('')}
<div style="position: relative; height: ${SLOT * SLOTS}px">${['09:00', '10:00', '11:00', '12:00', '13:00'].map((t, i) => `<span style="position: absolute; top: ${i * 2 * SLOT + 4}px; left: 10px; font-family: ${MONO}; font-size: 12px; color: ${C.muted}">${t}</span>`).join('')}</div>
${COLS.map(([, , blocks]) => `<div style="position: relative; height: ${SLOT * SLOTS}px; border-left: 1px solid ${C.border}; background: repeating-linear-gradient(to bottom, transparent 0, transparent ${SLOT * 2 - 1}px, ${C.border} ${SLOT * 2 - 1}px, ${C.border} ${SLOT * 2}px)">${blocks.map(([at, len, tone, t, s, x]) => len === 1 ? block(tone, `${t} · <span style="font-weight: 400">${s}</span>`, '', '', `position: absolute; left: 6px; right: 6px; top: ${at * SLOT + 2}px; height: ${len * SLOT - 4}px; overflow: hidden; justify-content: center`) : block(tone, t, s, x, `position: absolute; left: 6px; right: 6px; top: ${at * SLOT + 2}px; height: ${len * SLOT - 4}px; overflow: hidden`)).join('')}</div>`).join('')}
</div>`;
const diaryBadges = row(`${badge('8h available', 'grey')}${badge('6h allocated', 'green')}${badge('1h shared', 'blue')}`, 6);
const diaryNote = 'Drop-off allocations consume effort without promising a start time.';
screens.diary = {
  desktop: sd('diary', 'Workshop diary', stack(`${txt('Thursday 17 September · 30-minute grid', 15, `color: ${C.muted}`)}
${row(`${segmented(['Day', 'Week', 'Month'], 0, 'Diary view')}${diaryBadges}`, 12, 'justify-content: space-between')}
${diaryGrid}
${row(`${note(diaryNote, 14)}${button('Save allocation')}`, 12, 'justify-content: space-between')}`, 14)),
  phone: sp('Workshop diary', phoneBody(`${txt('Thursday 17 September · 30-minute grid', 14, `color: ${C.muted}`)}
${segmented(['Day', 'Week', 'Month'], 0, 'Diary view')}${diaryBadges}
${COLS.map(([n, s, blocks]) => `<section style="display: flex; flex-direction: column; gap: 6px"><div style="display: flex; justify-content: space-between; align-items: baseline">${h2(n, 14)}<span style="font-size: 12px; color: ${C.muted}">${s}</span></div>${blocks.map(([, , tone, t, sub, x]) => block(tone, t, sub, x)).join('')}</section>`).join('')}
${note(diaryNote)}`, button('Save allocation', { block: true }), 10), { active: 'diary' }),
};

// Shared queue (mechanic)
const queueHead = (size) => `<div style="display: flex; flex-direction: column; gap: 2px">${h2('Ready to work.', size)}${note('Thursday 17 September', 14)}</div>`;
const qTabs = segmented(['Shared · 4', 'My work · 2'], 0, 'Show jobs');
const q1 = (phone) => panel(`${row(`${mono('WH-1042', 'font-size: 16px')}${badge('Approved', 'green')}`, 8, 'justify-content: space-between')}
${h2('Trek Domane AL 3', 17)}${txt('Standard service + rear brakes')}${note(`90 min · target Fri 18 Sep, ${mono('16:00')}`)}
<div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: 8px; border-top: 1px solid ${C.border}"><span style="font-size: 14px">Agreed work</span>${mono('£111.00', 'font-size: 18px')}</div>
${button('Take this job & start work', { block: true })}`, phone ? 'box-shadow: none' : '', 16, 8);
const q2 = (phone) => panel(`${row(`${mono('WH-1046', 'font-size: 16px')}${badge('Scheduled', 'blue')}`, 8, 'justify-content: space-between')}${h2('Specialized Allez', 17)}${txt('Standard service · 60 min')}`, phone ? 'box-shadow: none' : '', 16, 8);
screens.queue = {
  desktop: sd('jobs', 'Jobs', stack(`${row(`${queueHead(24)}${qTabs}`, 12, 'justify-content: space-between')}${grid('repeat(2, minmax(0, 1fr))', `${q1(false)}${q2(false)}`, 16)}`, 18), MECH),
  phone: sp('Jobs', phoneBody(`${queueHead(20)}${qTabs}${q1(true)}${q2(true)}`), { role: 'K', active: 'jobs' }),
};

// Mechanic job page: agreement left, work right, nothing behind a tab
const checklistItems = (s) => [['Frame & fork', true], ['Wheels & tyres', true], ['Gears indexed', true], ['Brakes bled & adjusted', false]].map(([t, c], i) => check(t, c, `cl${i}-${s}`)).join('');
const finding = (s, rows) => area('Finding for the customer', 'The rear pads are worn. We recommend replacing the pads and adjusting the brake. The gear cable can wait.', 'finding-' + s, rows);
const finishChecks = (s) => `${check('Approved work completed', true, 'fin1-' + s)}${check('Brakes & gears tested', true, 'fin2-' + s)}${check('Accessories accounted for', true, 'fin3-' + s)}`;
const collNote = (s, rows) => area('Collection note for Maya', 'Rear pads replaced and brakes adjusted. Gears tuned. The existing gear cable is still serviceable.', 'cnote-' + s, rows);
const agreedTableCompact = table([['Work'], ['Qty', 'center'], ['Amount', 'right'], ['Decision']], LINES.map(([w, s, a], i) => [two(w, s), '1', mono(a), badge(...DECISIONS[i])]), { size: 13, pad: '6px 8px' });
screens['job-page'] = {
  desktop: sd('jobs', 'Jobs', stack(`${jobHead('In workshop', 'blue', null, { tabs: false })}
${grid('minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', `
${stack(`${panel(`${h2('What the customer agreed', 15)}${agreedTableCompact}${agreedTotal}${note('Gear cable declined. Anything beyond these lines needs a new approval.', 12)}`, '', 14, 8)}
${panel(`${h2('Customer’s concern', 15)}${quote(CONCERN)}<div>${button('Job conversation', { variant: 'default', size: 'sm', iconName: 'mail' })}</div>`, '', 14, 8)}`, 12)}
${stack(`${panel(`${h2('Standard service checklist', 15)}${note('From this service’s template, so the customer can be shown everything that was checked without the mechanic writing it out.', 12)}${checklistItems('d')}${finding('d', 4)}`, '', 14, 6)}
${panel(`${h2('Parts used', 15)}${field('Scan or type a part', { value: 'B05S-RX', id: 'part-d' })}${note('Scanning adds the part to this job. It never changes the agreed price on its own.', 12)}`, '', 14, 6)}`, 12)}
${panel(`${h2('Finish & mark ready', 15)}${finishChecks('d')}${collNote('d', 4)}${note('The bike stays in the shop until collection is recorded.', 12)}${button('Mark ready for collection', { block: true })}`, '', 14, 8)}`, 12)}`, 14), MECH),
  phone: sp('Jobs', phoneBody(`${jobHead('In workshop', 'blue', null, { phone: true, tabs: false })}
${card(`<div style="padding: 10px 12px; display: flex; flex-direction: column; gap: 4px">${h2('What the customer agreed', 14)}${LINES.map(([w, , a], i) => `<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; padding: 3px 0"><span>${w}</span><span style="display: flex; gap: 6px; align-items: center">${mono(a)}${badge(...DECISIONS[i])}</span></div>`).join('')}<div style="display: flex; justify-content: space-between; padding-top: 4px; border-top: 1px solid ${C.border}; font-size: 14px; font-weight: 700"><span>Agreed total</span>${mono('£111.00')}</div></div>`, 'box-shadow: none')}
${card(`<div style="padding: 10px 12px; display: flex; flex-direction: column; gap: 2px">${h2('Standard service checklist', 14)}${checklistItems('p')}</div>`, 'box-shadow: none')}
${card(`<div style="padding: 0 12px">${['Customer’s concern', 'Finding for the customer', 'Parts used', 'Finish checks and collection note'].map((t, i) => `<button type="button" aria-expanded="false" style="display: flex; width: 100%; justify-content: space-between; align-items: center; min-height: 44px; padding: 0; border: 0; ${i ? `border-top: 1px solid ${C.border};` : ''} background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.ink}; text-align: left">${esc(t)}${icon('chevron', 16)}</button>`).join('')}</div>`, 'box-shadow: none')}`,
    `${note('The bike stays in the shop until collection is recorded.', 12)}${button('Mark ready for collection', { block: true })}`, 10), { role: 'K', active: 'jobs' }),
};

// Parts delay
const delayForm = (s, rows) => `${h2('Waiting for parts')}${field('Part / reason', { value: 'Replacement rear brake pads delayed', id: 'reason-' + s })}${field('Revised target ready', { type: 'datetime-local', value: '2026-09-19T16:00', id: 'revised-' + s })}${area('Customer update', 'The brake pads are arriving later than expected. We’re aiming for Saturday at 16:00 and will confirm as soon as your bike is ready.', 'update-' + s, rows)}${note('Target dates are estimates. This update does not mark the bike ready.')}`;
const stillRequired = `${h2('Work still required', 15)}${txt('30 minutes for pads and adjustment.')}${note('Keep unfinished effort visible when replanning. Custody stays “In shop”.')}`;
screens.waiting = {
  desktop: jobDesktop('Waiting for parts', 'amber', 'Overview', grid('minmax(0, 1fr) 320px', `${panel(`${delayForm('d', 3)}<div>${button('Save delay & send update')}</div>`, '', 20, 10)}${panel(`${stillRequired}<div>${button('Replan remaining effort', { variant: 'default' })}</div>`, '', 20, 10)}`, 20)),
  phone: jobPhone('Waiting for parts', 'amber', 'Overview', `${panel(delayForm('p', 3), 'box-shadow: none', 12, 8)}${row(`<span style="font-size: 13px">Still required: 30 minutes for pads and adjustment.</span>${link('Replan')}`, 8, 'justify-content: space-between')}`, button('Save delay & send update', { block: true })),
};

// Messages
const THREADS = [['Maya Patel', 'WH-1042', 'Trek Domane', 'Thanks. Can I collect after work?', true], ['Oliver Chen', 'WH-1048', 'Brompton', 'It clicks under load.', false]];
const bubble = (t, meta, out) => `<div style="display: flex; flex-direction: column; gap: 4px; align-items: ${out ? 'flex-end' : 'flex-start'}"><div style="max-width: 80%; padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height: 1.45; background: ${out ? C.accent : C.mutedBg}; color: ${out ? '#ffffff' : C.ink}">${esc(t)}</div><span style="font-size: 12px; color: ${C.muted}">${meta}</span></div>`;
const convo = `${bubble('Hi Maya, your bike is ready to collect. We’re open until 18:00.', `SMS · delivered ${mono('15:42')}`, true)}${bubble('Thanks. Can I collect after work?', `SMS · received ${mono('15:46')}`, false)}`;
const reply = (s, rows) => `${select('Reply via', ['SMS · customer selected', 'Email · customer selected', 'WhatsApp · not selected'], 'via-' + s)}${area('Message', 'Of course. We’re here until 18:00. See you later!', 'reply-' + s, rows)}${note('Replies remain attached to this job.')}`;
screens.inbox = {
  desktop: sd('messages', 'Messages', stack(`${txt('Conversations attached to the job, across email, SMS and WhatsApp.', 15, `color: ${C.muted}`)}
${grid('300px minmax(0, 1fr)', `${stack(`${segmented(['Needs a reply · 2'], 0, 'Show conversations')}${THREADS.map(([n, j, b, m, on]) => `<a href="#" aria-current="${on}" style="display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border-radius: 8px; text-decoration: none; color: ${C.ink}; background: ${on ? C.panel : 'transparent'}; border: 1px solid ${on ? C.accent : C.border}"><span style="font-size: 14px; font-weight: 700">${n}</span><span style="font-size: 13px; color: ${C.muted}">${mono(j)} · ${b}</span><span style="font-size: 13px">${esc(m)}</span></a>`).join('')}`, 10)}
${panel(`${row(`${h2('Maya Patel', 16)}<span style="font-size: 14px; color: ${C.muted}">${mono('WH-1042')}</span><span style="flex-grow: 1"></span>${badge('SMS', 'grey')}`, 8)}<div style="display: flex; flex-direction: column; gap: 12px; padding: 12px 0; border-top: 1px solid ${C.border}; border-bottom: 1px solid ${C.border}">${convo}</div>${reply('d', 2)}<div style="display: flex; justify-content: flex-end">${button('Send reply')}</div>`, '', 18, 12)}`, 20)}`, 14)),
  phone: sp('Messages', phoneBody(`<div>${link('‹ All messages · 2 need a reply')}</div>
${row(`<div style="display: flex; flex-direction: column; gap: 2px">${h2('Maya Patel', 17)}<span style="font-size: 13px; color: ${C.muted}">${mono('WH-1042')} · Trek Domane</span></div>${badge('SMS', 'grey')}`, 8, 'justify-content: space-between')}
<div style="display: flex; flex-direction: column; gap: 12px; padding: 12px 0; border-top: 1px solid ${C.border}; border-bottom: 1px solid ${C.border}">${convo}</div>
${reply('p', 3)}`, button('Send reply', { block: true })), { active: 'messages' }),
};

// Till link (replaces the Lightspeed handoff)
const tillCard = (withBtn) => `${h2('Payment', 15)}<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 14px">Agreed work</span>${mono('£111.00', 'font-size: 18px')}</div>${note('Opens Front desk › Till with this job’s agreed £111.00 loaded.')}${withBtn ? `<div>${button('Take payment at the till', { variant: 'default', iconName: 'till' })}</div>` : ''}${note('Collection records who took the bike and when. It does not record payment.', 12)}`;

// Work finished
const finishedBanner = `Alex finished the work and final checks at ${mono('15:30')}. The bike is still in the shop.`;
const finalChecks = `${h2('Final checks complete', 15)}${txt('Service, pads and fitting completed. Brakes tested, gears tuned, accessories accounted for.')}`;
const handover = (s, rows) => area('Customer handover note', 'Rear pads replaced and brakes adjusted. Gears tuned. The existing gear cable is still serviceable.', 'handover-' + s, rows);
screens.finished = {
  desktop: jobDesktop('Work finished', 'grey', 'Overview', stack(`${banner(finishedBanner)}${grid('minmax(0, 1fr) 340px', `${panel(`${finalChecks}${handover('d', 3)}<div>${button('Mark ready & notify customer')}</div>`, '', 20, 10)}${panel(tillCard(true), '', 20, 10)}`, 20)}`, 14)),
  phone: jobPhone('Work finished', 'grey', 'Overview', `${banner(finishedBanner)}${panel(`${finalChecks}${handover('p', 3)}`, 'box-shadow: none', 12, 8)}`, `${button('Mark ready & notify customer', { block: true })}${button(`Take payment at the till · £111.00`, { variant: 'default', block: true, iconName: 'till' })}`),
};

// Collection
const handBack = (s, rows) => `${h2('Hand the bike back', 16)}${note('Maya Patel · Trek Domane AL 3', 14)}${check('Bike handed to the customer or authorised collector', true, 'hb1-' + s)}${check('Lock key and rear light returned', true, 'hb2-' + s)}${field('Collected by', { value: 'Maya Patel', id: 'by-' + s })}${area('Handover note', 'Explained the brake work and optional gear cable. Customer happy with the test ride.', 'hnote-' + s, rows)}`;
screens.collection = {
  desktop: jobDesktop('Ready for collection', 'green', 'Overview', grid('minmax(0, 1fr) 340px', `${panel(`${handBack('d', 2)}<div>${button('Record collection')}</div>`, '', 20, 10)}${panel(tillCard(true), '', 20, 10)}`, 20)),
  phone: jobPhone('Ready for collection', 'green', 'Overview', `${panel(handBack('p', 2), 'box-shadow: none', 12, 6)}${note('Collection records who took the bike and when. It does not record payment.', 12)}`, `${button('Record collection', { block: true })}${button('Take payment at the till · £111.00', { variant: 'default', block: true, iconName: 'till' })}`),
};

// Closed
const closedBanner = `Collected by Maya Patel today at ${mono('17:24')}. Recorded by Jack Lewis.`;
const CLOSED = [['Bike collected', 'Jack Lewis', '17:24', 'accessories returned'], ['Ready for collection', 'Alex Morgan', '15:42', 'customer notified'], ['Quote approved: £111.00', 'Maya Patel', '11:18', 'gear cable declined'], ['Bike received & tag printed', 'Jack Lewis', '09:12', '']];
const timeline2 = (items) => `<ol style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column">${items.map(([t, who, at, what], i) => `<li style="display: flex; gap: 12px; padding: 9px 0; ${i ? `border-top: 1px solid ${C.border}` : ''}"><span style="width: 10px; height: 10px; margin-top: 5px; border-radius: 999px; background: ${i ? C.input : C.accent}; flex-shrink: 0"></span><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600">${esc(t)}</span><span style="font-size: 13px; color: ${C.muted}">${[mono(at), esc(who), what ? esc(what) : ''].filter(Boolean).join(' · ')}</span></div></li>`).join('')}</ol>`;
const locked = `${row(`${icon('lock', 18)}${h2('Job locked', 15)}`, 8)}${note('The completed record and approval history remain available.')}`;
const reopen = `${h2('Need to correct or continue the job?', 14)}`;
screens.closed = {
  desktop: jobDesktop('Collected', 'green', 'History', stack(`${banner(closedBanner)}${grid('minmax(0, 1fr) 320px', `${panel(`${h2('Job history')}${timeline2(CLOSED)}`, '', 20, 6)}${panel(`${locked}<div style="padding-top: 10px; border-top: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 10px">${reopen}<div>${button('Reopen with a reason', { variant: 'default' })}</div></div>`, '', 20, 10)}`, 20)}`, 14)),
  phone: jobPhone('Collected', 'green', 'History', `${banner(closedBanner)}${panel(`${h2('Job history', 15)}${timeline2(CLOSED)}`, 'box-shadow: none', 12, 2)}${panel(locked, 'box-shadow: none', 12, 4)}`, `${note('Need to correct or continue the job?', 13)}${button('Reopen with a reason', { variant: 'default', block: true })}`),
};

// ---------- Journey map rows ----------
const T = { requests: 'Review incoming requests', review: 'Confirm the request', reject: 'Decline with an explanation', desk: 'The workshop at a glance', 'new-job': 'Create a walk-in job', intake: 'Book the bike into the shop', print: 'Print & attach the bike tag', scan: 'Scan → authenticated job', job: 'The complete job workspace', history: 'Audit changes to the job', 'quote-editor': 'Build the itemised quote', 'quote-send': 'Send the approval request', approved: 'Shop sees the exact agreement', diary: 'Allocate work in the diary', queue: 'Take work from the shared queue', 'job-page': 'The mechanic’s job page', waiting: 'Handle a parts delay', inbox: 'One job conversation', finished: 'Work finished; prepare the handover', collection: 'Record physical collection', closed: 'Collected, with a durable history' };
const MECHANIC = new Set(['scan', 'queue', 'job-page']);
const r = (ids) => ids.map((id) => [id, T[id], MECHANIC.has(id) ? 'Mechanic' : 'Staff']);
export const WORKSHOP_ROWS = [
  { label: 'Requests', screens: r(['requests', 'review', 'reject']) },
  { label: 'Book the bike in', screens: r(['desk', 'new-job', 'intake', 'print', 'scan', 'job', 'history']) },
  { label: 'Quote', screens: r(['quote-editor', 'quote-send', 'approved']) },
  { label: 'Do the work', screens: r(['diary', 'queue', 'job-page', 'waiting', 'inbox', 'finished']) },
  { label: 'Hand back', screens: r(['collection', 'closed']) },
];

// Keep the agreed screen order.
const ORDER = ['requests', 'review', 'reject', 'desk', 'new-job', 'intake', 'print', 'scan', 'job', 'history', 'quote-editor', 'quote-send', 'approved', 'diary', 'queue', 'job-page', 'waiting', 'inbox', 'finished', 'collection', 'closed'];
const ordered = Object.fromEntries(ORDER.map((k) => [k, screens[k]]));
for (const k of Object.keys(screens)) delete screens[k];
Object.assign(screens, ordered);
