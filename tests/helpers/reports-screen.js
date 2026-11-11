// Opens the staff app on a Reports page with the server's answers stubbed
// (openspec/changes/reports-sales-and-takings). The answers are the shapes
// server/lib/report-sales.js sends; the tests of that file prove the server
// sends them, these prove the screen reads them.
import { installDom, importFresh } from './dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
export const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
export const STAFF = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street' };

export const HOME = {
  today: '2026-09-17', dateLine: 'Thursday 17 September', shopLine: 'North Street Cycles, Bolton',
  strip: { heading: 'So far: Mon 14 – Thu 17 September', takingsPence: 8800 },
};

const DAYS = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];
const LABELS = ['Mon 14 Sep', 'Tue 15 Sep', 'Wed 16 Sep', 'Thu 17 Sep', 'Fri 18 Sep', 'Sat 19 Sep', 'Sun 20 Sep'];
const TAKINGS = [0, 4500, 300, 4000];
const SALES = [0, 4, 1, 1];
const BEFORE = [10000, 5000, 0, 3000];
const BEFORE_SALES = [1, 1, 0, 2];
const avg = (p, n) => (n ? Math.round(p / n) : null);

// This week on Thursday 17 September, as the server gives it.
export const THIS_WEEK = {
  period: { period: 'this-week', from: '2026-09-14', to: '2026-09-20', through: '2026-09-17', soFar: true, unit: 'day', label: 'So far: Mon 14 – Thu 17 September', against: 'the same days last week' },
  before: { from: '2026-09-07', to: '2026-09-10' },
  figures: {
    takings: { pence: 8800, beforePence: 18000, diffPence: -9200 },
    sales: { count: 6, beforeCount: 4, diff: 2 },
    average: { pence: 1467, beforePence: 4500, diffPence: -3033 },
  },
  rows: DAYS.map((key, i) => ({
    key, label: LABELS[i], notReached: i > 3,
    takingsPence: i > 3 ? null : TAKINGS[i], sales: i > 3 ? null : SALES[i], averagePence: i > 3 ? null : avg(TAKINGS[i], SALES[i]),
    beforeTakingsPence: BEFORE[i] ?? 0, beforeSales: BEFORE_SALES[i] ?? 0,
  })),
  total: { label: 'So far', takingsPence: 8800, sales: 6, averagePence: 1467 },
  empty: false, nothingBefore: false, firstSaleOn: '2026-08-20', shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
};

const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const MONTH_LABELS = ['Oct 25', 'Nov 25', 'Dec 25', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
export const LAST_12 = {
  ...THIS_WEEK,
  period: { period: 'last-12-months', from: '2025-10-01', to: '2026-09-30', through: '2026-09-17', soFar: true, unit: 'month', label: 'October 2025 – September 2026', against: 'the 12 months before' },
  before: { from: '2024-10-01', to: '2025-09-30' },
  figures: {
    takings: { pence: 120000, beforePence: 100000, diffPence: 20000 },
    sales: { count: 40, beforeCount: 40, diff: 0 },
    average: { pence: 3000, beforePence: 2500, diffPence: 500 },
  },
  rows: MONTHS.map((key, i) => ({ key, label: MONTH_LABELS[i], notReached: false, takingsPence: 10000, sales: 4, averagePence: 2500, beforeTakingsPence: 8000, beforeSales: 4 })),
  total: { label: '12 months', takingsPence: 120000, sales: 48, averagePence: 2500 },
};

// A report's answer for the period in the address, from a fixture per period.
export const salesFor = (query, fixtures = {}) => {
  const period = query.get('period') || 'this-week';
  if (fixtures[period]) return fixtures[period](query);
  if (period === 'last-12-months') return LAST_12;
  return THIS_WEEK;
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
export const calls = [];

export async function closeReports() {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
}

// `answers` maps a path to a function of (query, method, body) returning
// [status, body]; /api/auth/me and the other paths the frame asks for are
// answered here. `phone` makes the screen a phone's.
export async function openReports(path, { who = OWNER, answers = {}, phone = false, accessibility = {} } = {}) {
  calls.length = 0;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    const u = new URL(url, 'http://localhost');
    calls.push({ path: u.pathname, search: u.search, query: u.searchParams, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b, headers: new Headers(), blob: async () => new Blob([b]) });
    if (u.pathname === '/api/auth/me') return reply(200, who);
    if (answers[u.pathname]) {
      const [status, b] = await answers[u.pathname](u.searchParams, method, body);
      return reply(status, b);
    }
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: { showLegend: true, showGraphs: true, ...accessibility } });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  if (phone) window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}

// Takings and cash-ups on Thursday 17 September: Monday to Wednesday closed, today not yet.
const bar = (key, label, takings, before, notReached = false) => ({
  key, label, notReached, takingsPence: notReached ? null : takings, sales: null, averagePence: null, beforeTakingsPence: before, beforeSales: 0,
});
export const TAKINGS_WEEK = {
  period: { period: 'this-week', from: '2026-09-14', to: '2026-09-20', through: '2026-09-17', soFar: true, unit: 'day', label: 'So far: Mon 14 – Thu 17 September', against: 'the same days last week' },
  before: { from: '2026-09-07', to: '2026-09-09' },
  figures: {
    takings: { pence: 60000, beforePence: 40000, diffPence: 20000 },
    card: { pence: 33000, beforePence: 23000, diffPence: 10000 },
    cash: { pence: 24500, beforePence: 15000, diffPence: 9500 },
    other: { pence: 2500, beforePence: 2000, diffPence: 500 },
    online: { pence: 5500, beforePence: 2000, diffPence: 3500 },
    cashDifference: { pence: -500, beforePence: -200, diffPence: -300 },
  },
  rows: [
    { kind: 'day', key: '2026-09-17', label: 'Thu 17 Sep', closed: false },
    { kind: 'day', key: '2026-09-16', label: 'Wed 16 Sep', closed: true, closeId: 31, takingsPence: 10000, bankedPence: 2500, differencePence: 0, closedByName: 'Jo Taylor', closedAt: '2026-09-16T16:30:00Z' },
    { kind: 'online', key: '2026-09-16', label: 'Wed 16 Sep · Online', onlinePence: 0 },
    { kind: 'day', key: '2026-09-15', label: 'Tue 15 Sep', closed: true, closeId: 30, takingsPence: 30000, bankedPence: 11500, differencePence: -500, closedByName: 'Jack Lewis', closedAt: '2026-09-15T16:30:00Z' },
    { kind: 'online', key: '2026-09-15', label: 'Tue 15 Sep · Online', onlinePence: 2500 },
    { kind: 'day', key: '2026-09-14', label: 'Mon 14 Sep', closed: true, closeId: 29, takingsPence: 20000, bankedPence: 5000, differencePence: 0, closedByName: 'Jo Taylor', closedAt: '2026-09-14T16:30:00Z' },
    { kind: 'online', key: '2026-09-14', label: 'Mon 14 Sep · Online', onlinePence: 3000 },
  ],
  bars: [
    bar('2026-09-14', 'Mon 14 Sep', 20000, 15000), bar('2026-09-15', 'Tue 15 Sep', 30000, 25000), bar('2026-09-16', 'Wed 16 Sep', 10000, 0),
    bar('2026-09-17', 'Thu 17 Sep', 0, 5000), bar('2026-09-18', 'Fri 18 Sep', 0, 0, true), bar('2026-09-19', 'Sat 19 Sep', 0, 0, true), bar('2026-09-20', 'Sun 20 Sep', 0, 0, true),
  ],
  empty: false, nothingBefore: false, firstCloseOn: '2026-09-07', shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
};

// Tuesday's close, as /api/reports/days/30 gives it (the Close shape of close-the-day).
export const TUESDAY_CLOSE = {
  close: {
    id: 30, day: '2026-09-15', closedByName: 'Jack Lewis', closedAt: '2026-09-15T16:30:00Z',
    floatStart: { pence: 15000, how: 'counted', expectedPence: 15000, byName: 'Jo Taylor', at: '2026-09-15T07:30:00Z' },
    cashPence: 14000, drawerCashPence: 14000, paidOutsPence: 0, expectedPence: 14000, countedPence: 13500, differencePence: -500, reason: '',
    floatPence: 15000, bankedPence: 11500, leftPence: 15000, topUpPence: 1500, takingsPence: 30000, cardPence: 15000, otherPence: 1000, onlinePence: 2500, countedBy: null,
  },
};
