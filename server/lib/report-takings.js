// Takings and cash-ups (openspec/changes/reports-sales-and-takings, design 4):
// each closed day as it was saved at the close, never recounted from the
// sales, for a period and for the period before it. Closes are one per shop
// per day (Jack's answer 4, 10 Nov), so there is one row per closed day and
// no till. Today with no close is "Not closed yet". Each closed day has its
// online money as a row of its own (answer 5). Beyond 62 days the rows are
// months, their closed days added up (answer 9).
import { prepare } from '../db.js';
import { periodFor, addDays } from './report-periods.js';
import { providerName } from '../accounts/index.js';
import { onlineSoFar, daysWaiting, takingsSoFarFor, reopenedOn } from '../routes/close-the-day.js';

const CLOSES = `SELECT c.id, to_char(c.day, 'YYYY-MM-DD') AS day, c.closed_at, COALESCE(l.name, 'Unknown') AS closed_by_name,
    c.takings_pence, c.card_pence, c.cash_pence, c.other_pence, c.c2w_pence, c.online_pence,
    c.counted_pence - c.expected_pence AS difference_pence, c.banked_pence
  FROM day_closes c LEFT JOIN logins l ON l.id = c.login_id
  WHERE c.reopened_at IS NULL AND c.day BETWEEN ?::date AND ?::date ORDER BY c.day`;

const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const reopenedLabel = (iso) => `${DAY3[new Date(`${iso}T00:00:00Z`).getUTCDay()]} ${Number(iso.slice(8))} ${MON3[Number(iso.slice(5, 7)) - 1]}`;

const sum = (list, k) => list.reduce((n, c) => n + c[k], 0);

export async function takingsReport(choice, today) {
  let period = periodFor({ ...choice, today });
  let buckets = period.buckets;
  let unit = period.unit;
  if (unit === 'hour') {
    // Closes are by day: Today is the one day, against the same day last week.
    const one = periodFor({ period: 'dates', from: today, to: today, today });
    buckets = one.buckets.map((b) => ({ ...b, beforeKey: period.before.from }));
    unit = 'day';
  }
  const closes = await prepare(CLOSES).all(period.from, period.through);
  // Today's close doesn't exist until the day is closed, so "the same days last
  // week" stops a day short while it's open, or last Thursday's close would be
  // compared with nothing (review). Today on its own is one day against one day.
  const todayOpen = period.period !== 'today' && unit === 'day' && period.through === today && !closes.some((c) => c.day === today);
  const beforeTo = todayOpen && period.before.to > period.before.from ? addDays(period.before.to, -1) : period.before.to;
  period = { ...period, before: { from: period.before.from, to: beforeTo } };
  const before = await prepare(CLOSES).all(period.before.from, period.before.to);
  const { first } = await prepare("SELECT to_char(min(day), 'YYYY-MM-DD') AS first FROM day_closes WHERE reopened_at IS NULL").get();
  const nothingBefore = !first || first >= period.from;

  const keyOf = (c) => (unit === 'month' ? c.day.slice(0, 7) : c.day);
  const group = (list) => {
    const m = new Map();
    for (const c of list) m.set(keyOf(c), [...(m.get(keyOf(c)) ?? []), c]);
    return m;
  };
  const now = group(closes);
  const prev = group(before);

  // Days nobody closed that were counted with a later morning's float: Close the day can still close them.
  const waiting = new Set((await daysWaiting()).map((w) => w.for_day));
  // The reopened day, if it falls in this period.
  const reopenedAny = await reopenedOn();
  const reopened = reopenedAny && reopenedAny.day >= period.from && reopenedAny.day <= period.through ? reopenedAny : null;
  const reopenedRow = reopened && unit === 'day' ? (await prepare(CLOSES.replace('c.reopened_at IS NULL', 'c.reopened_at IS NOT NULL')).all(reopened.day, reopened.day))[0] : null;
  // Where accounts software is connected (or was lost), each day says whether it went (reports-accounts-and-reopen).
  const conn = await prepare('SELECT provider, status FROM accounts_connections').get();
  const sendBy = new Map((await prepare("SELECT to_char(day, 'YYYY-MM-DD') AS day, status FROM accounts_sends").all()).map((r) => [r.day, r.status]));
  const sentOf = (day, { reopened = false, open = false } = {}) => (reopened ? 'reopened' : open ? 'open' : sendBy.get(day) ?? null);
  const rows = [];
  for (const b of [...buckets].reverse()) {
    if (b.notReached) continue;
    const list = now.get(String(b.key)) ?? [];
    if (unit === 'month') {
      if (list.length) {
        rows.push({
          kind: 'month', key: b.key, label: b.label, closed: true, closedDays: list.length,
          takingsPence: sum(list, 'takings_pence'), bankedPence: sum(list, 'banked_pence'), differencePence: sum(list, 'difference_pence'),
        });
      }
      continue;
    }
    const c = list[0];
    if (c) {
      rows.push({
        kind: 'day', key: b.key, label: b.label, closed: true, closeId: c.id, takingsPence: c.takings_pence, bankedPence: c.banked_pence,
        differencePence: c.difference_pence, closedByName: c.closed_by_name, closedAt: c.closed_at, sent: sentOf(b.key),
      });
      rows.push({ kind: 'online', key: b.key, label: `${b.label} · Online`, onlinePence: c.online_pence, sent: sentOf(b.key) });
    } else if (reopenedRow?.day === b.key) {
      // A reopened day (reports-accounts-and-reopen; Jack, 12 Nov): its row keeps the figures it was closed with and opens
      // its report, and its Online row stays; only the headline figures, the graph and the months leave it out.
      rows.push({
        kind: 'day', key: b.key, label: b.label, closed: true, reopened: true, closeId: reopenedRow.id, takingsPence: reopenedRow.takings_pence,
        bankedPence: reopenedRow.banked_pence, differencePence: reopenedRow.difference_pence, closedByName: reopenedRow.closed_by_name, closedAt: reopenedRow.closed_at, sent: 'reopened',
      });
      rows.push({ kind: 'online', key: b.key, label: `${b.label} · Online`, onlinePence: reopenedRow.online_pence, sent: 'reopened' });
    } else if (b.key === today) {
      rows.push({ kind: 'day', key: b.key, label: b.label, closed: false, sent: sentOf(b.key, { open: true }) });
      // Today's online money so far, as drawn ("[£] so far"): not yet in any close.
      rows.push({ kind: 'online', key: b.key, label: `${b.label} · Online`, onlinePence: await onlineSoFar(today), soFar: true, sent: sentOf(b.key, { open: true }) });
    } else if (waiting.has(b.key)) {
      // A past day nobody closed (Jack, 11 Nov): its own row, "Not closed", with its takings so far and where to close it.
      rows.push({ kind: 'day', key: b.key, label: b.label, closed: false, past: true, takingsPence: await takingsSoFarFor(b.key), closeDay: b.key });
    }
  }

  const bars = buckets.map((b) => ({
    key: b.key, label: b.label, notReached: b.notReached,
    takingsPence: b.notReached ? null : sum(now.get(String(b.key)) ?? [], 'takings_pence'),
    sales: null, averagePence: null,
    beforeTakingsPence: sum(prev.get(String(b.beforeKey)) ?? [], 'takings_pence'), beforeSales: 0,
  }));

  const figure = (key) => {
    const pence = sum(closes, key);
    const beforePence = sum(before, key);
    return { pence, beforePence, diffPence: nothingBefore ? null : pence - beforePence };
  };
  return {
    period: { period: period.period, from: period.from, to: period.to, through: period.through, soFar: period.soFar, unit, label: period.label, against: period.against },
    before: period.before,
    figures: {
      takings: figure('takings_pence'), card: figure('card_pence'), cash: figure('cash_pence'), other: figure('other_pence'),
      // Owed by the Cycle to Work providers, not in the drawer (UX walk-through 5 H3).
      c2w: figure('c2w_pence'), online: figure('online_pence'), cashDifference: figure('difference_pence'),
    },
    rows, bars, empty: rows.length === 0, nothingBefore, firstCloseOn: first ?? null,
    accounts: conn && conn.status !== 'disconnected' ? { providerName: providerName(conn.provider), status: conn.status } : null,
    reopened: reopened ? { day: reopened.day, label: reopenedLabel(reopened.day), reason: reopened.reason, reopenedByName: reopened.reopenedByName } : null,
  };
}
