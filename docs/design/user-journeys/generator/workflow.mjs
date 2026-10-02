// The workflow chart: how every journey connects, in four lanes.
import { C, esc } from './ui.mjs';

export const WF_W = 3440, WF_H = 1700;
const NW = 250, NH = 86;
const colX = (c) => 270 + c * 312;

const LANES = [
  { id: 'cust', name: 'Customers', sub: 'The shop’s website', top: 150, bottom: 560, tint: '#e8e7e1' },
  { id: 'till', name: 'Till mode', sub: 'A registered till', top: 600, bottom: 800, tint: '#eceae4' },
  { id: 'staff', name: 'Staff app', sub: 'Sidebar navigation', top: 840, bottom: 1250, tint: '#e2e5d8' },
  { id: 'owner', name: 'Owner', sub: 'Setting up and moving', top: 1290, bottom: 1490, tint: '#eceae4' },
];

// [id, col, y, label, journey]
const N = [
  ['web', 0, 190, 'Website home', '01'], ['browse', 1, 190, 'Browse and product', '01'], ['checkout', 2, 190, 'Basket and checkout', '02'],
  ['ordered', 3, 190, 'Order confirmed', '02'], ['ready2collect', 4, 190, 'Ready to collect', '02'], ['account', 6, 190, 'Account and history', '07'], ['reminder', 7, 190, 'Service reminder', '07'],
  ['book', 0, 420, 'Book a repair', '03'], ['link', 1, 420, 'Booking link', 'B'], ['approve', 3, 420, 'Approve the quote', '04'],
  ['bikeready', 5, 420, 'Bike ready', '05'], ['collectpay', 6, 420, 'Collect and pay', '05'], ['c2w', 8, 420, 'Cycle to Work', '06'],
  ['tillsetup', 0, 655, 'Set up this till', 'B'], ['checkin', 1, 655, 'Check in with PIN', 'B'], ['sale', 2, 655, 'Sale', '11'], ['pay', 3, 655, 'Take payment', '11'],
  ['receipt', 4, 655, 'Receipt', '11'], ['refund', 5, 655, 'Refund or return', '11'], ['offline', 6, 655, 'Offline: keeps selling', '11'], ['cashup', 8, 655, 'End-of-day cash-up', '16'],
  ['signin', 0, 880, 'Sign in', 'B'], ['today', 1, 880, 'Today', 'A'], ['requests', 2, 880, 'Booking requests', '12'], ['bookin', 3, 880, 'Book the bike in', '12'],
  ['quote', 4, 880, 'Build and send quote', '12'], ['work', 5, 880, 'Do the work', '12'], ['handback', 6, 880, 'Ready and collection', '12'],
  ['orders', 2, 1110, 'Online orders', '18'], ['stock', 3, 1110, 'Stock and stock take', '14'], ['purchasing', 4, 1110, 'Purchasing', '13'],
  ['customers', 5, 1110, 'Customers', '15'], ['reports', 7, 1110, 'Reports and accounts', '17'], ['website', 8, 1110, 'Website management', '18'],
  ['create', 0, 1345, 'Create shop and set up', '08'], ['move', 1, 1345, 'Move from Citrus Lime', '09'], ['alongside', 2, 1345, 'Run alongside', '09'],
  ['switch', 3, 1345, 'Switch over', '09'], ['sites', 5, 1345, 'Multiple sites', '19'], ['oversight', 7, 1345, 'Oversight', '20'], ['lightspeed', 8, 1345, 'Lightspeed shops', '21'],
];
const node = Object.fromEntries(N.map(([id, c, y, label, j]) => [id, { id, x: colX(c), y, label, j }]));

// [from, to, label, handover?]  handover = crosses into another part of Wheelhouse
const E = [
  ['web', 'browse'], ['browse', 'checkout'], ['checkout', 'ordered'], ['ordered', 'ready2collect'], ['web', 'book'],
  ['book', 'link'], ['account', 'reminder'], ['reminder', 'book', 'Book again'],
  ['bikeready', 'collectpay'],
  ['tillsetup', 'checkin'], ['checkin', 'sale'], ['sale', 'pay'], ['pay', 'receipt'], ['receipt', 'refund'], ['receipt', 'cashup'],
  ['signin', 'today'], ['today', 'requests'], ['requests', 'bookin'], ['bookin', 'quote'], ['quote', 'work'], ['work', 'handback'],
  ['purchasing', 'stock', 'Deliveries'], ['create', 'move'], ['move', 'alongside'], ['alongside', 'switch'],
  // handovers between parts
  ['link', 'requests', 'Booking request', true],
  ['quote', 'approve', 'Quote sent', true],
  ['approve', 'work', 'Approved', true],
  ['handback', 'bikeready', 'Ready message', true],
  ['collectpay', 'pay', 'Pays at the till', true],
  ['ordered', 'orders', 'New order', true],
  ['orders', 'ready2collect', 'Ready message', true],
  ['ready2collect', 'sale', 'Collects in shop', true],
  ['pay', 'stock', 'Stock goes down', true],
  ['cashup', 'reports', 'Day’s takings', true],
  ['website', 'web', 'Publishes', true],
  ['create', 'signin', 'Staff invited', true],
  ['create', 'tillsetup', 'Tills registered', true],
  ['today', 'checkin', 'Open till', true],
];

function anchor(a, b) {
  // Same row: right edge -> left edge. Otherwise: bottom/top edge centres.
  if (Math.abs(a.y - b.y) < 10) {
    return a.x < b.x
      ? [a.x + NW, a.y + NH / 2, b.x, b.y + NH / 2, 'h']
      : [a.x, a.y + NH / 2, b.x + NW, b.y + NH / 2, 'h'];
  }
  return a.y < b.y
    ? [a.x + NW / 2, a.y + NH, b.x + NW / 2, b.y, 'v']
    : [a.x + NW / 2, a.y, b.x + NW / 2, b.y + NH, 'v'];
}

function edges() {
  let paths = '';
  let labels = '';
  for (const [f, t, label, hand] of E) {
    const a = node[f], b = node[t];
    const [x1, y1, x2, y2, dir] = anchor(a, b);
    const d = dir === 'h'
      ? `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`
      : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
    const color = hand ? C.brand : '#83867a';
    paths += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${hand ? 2.5 : 2}" ${hand ? 'stroke-dasharray="8 6"' : ''} marker-end="url(#${hand ? 'ah' : 'an'})"/>`;
    if (label) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      labels += `<div style="position: absolute; left: ${mx - 80}px; top: ${my - 14}px; width: 160px; display: flex; justify-content: center"><span style="padding: 3px 8px; border-radius: 6px; background: ${C.panel}; border: 1px solid ${hand ? C.input : C.border}; font-size: 13px; font-weight: 600; color: ${hand ? C.accent : C.muted}; white-space: nowrap">${esc(label)}</span></div>`;
    }
  }
  return { paths, labels };
}

export function workflow() {
  const { paths, labels } = edges();
  const lanes = LANES.map((l) => `<div style="position: absolute; left: 20px; top: ${l.top}px; width: ${WF_W - 40}px; height: ${l.bottom - l.top}px; border-radius: 16px; background: ${l.tint}"></div>
<div style="position: absolute; left: 44px; top: ${l.top + 20}px; width: 190px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 22px; font-weight: 700; color: ${C.ink}">${l.name}</span><span style="font-size: 14px; color: ${C.muted}">${l.sub}</span></div>`).join('\n');
  const nodes = N.map(([id]) => {
    const n = node[id];
    return `<div style="position: absolute; left: ${n.x}px; top: ${n.y}px; width: ${NW}px; height: ${NH}px; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; background: ${C.panel}; border: 1px solid ${C.border}; box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between">
<span style="font-size: 16px; font-weight: 700; line-height: 1.25; color: ${C.ink}">${esc(n.label)}</span>
<span style="align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: ${C.bg}; font-size: 12px; font-weight: 700; color: ${C.muted}">Journey ${n.j}</span>
</div>`;
  }).join('\n');
  return `<div style="position: relative; width: ${WF_W}px; height: ${WF_H}px; background: #f3f2ee; overflow: hidden">
<div style="position: absolute; left: 44px; top: 36px; display: flex; flex-direction: column; gap: 8px">
<h1 style="margin: 0; font-size: 40px; font-weight: 700; letter-spacing: -0.6px; color: ${C.ink}">How the journeys connect</h1>
<p style="margin: 0; font-size: 18px; color: ${C.muted}">Each box is a step; its journey number matches the rows below. Follow the arrows to see how people move through Wheelhouse.</p>
</div>
<div style="position: absolute; right: 44px; top: 52px; display: flex; gap: 28px; font-size: 15px; color: ${C.ink}">
<span style="display: flex; align-items: center; gap: 10px"><svg width="56" height="10" aria-hidden="true"><line x1="0" y1="5" x2="56" y2="5" stroke="#83867a" stroke-width="2"/></svg>Next step</span>
<span style="display: flex; align-items: center; gap: 10px"><svg width="56" height="10" aria-hidden="true"><line x1="0" y1="5" x2="56" y2="5" stroke="${C.brand}" stroke-width="2.5" stroke-dasharray="8 6"/></svg>Hands over to another part of Wheelhouse</span>
</div>
${lanes}
<svg width="${WF_W}" height="${WF_H}" style="position: absolute; left: 0; top: 0" aria-hidden="true">
<defs>
<marker id="an" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#83867a"/></marker>
<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.brand}"/></marker>
</defs>
${paths}
</svg>
${nodes}
${labels}
<div style="position: absolute; left: 44px; top: ${WF_H - 150}px; width: ${WF_W - 88}px; display: flex; flex-direction: column; gap: 6px; font-size: 15px; color: ${C.muted}; line-height: 1.5">
<span><strong style="color: ${C.ink}">Journey A</strong> is the app map and navigation; <strong style="color: ${C.ink}">Journey B</strong> is signing in. Numbered journeys match the overview table.</span>
<span>Cycle to Work and Lightspeed shops stand alone for now: Cycle to Work is its own kind of order, from the quote to the provider’s payment, and Lightspeed shops use Release 1 alongside Lightspeed.</span>
</div>
</div>`;
}
