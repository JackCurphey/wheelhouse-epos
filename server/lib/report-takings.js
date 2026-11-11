// Takings and cash-ups (openspec/changes/reports-sales-and-takings, design 4):
// each closed day as it was saved at the close, never recounted from the
// sales, for a period and for the period before it. Closes are one per shop
// per day (Jack's answer 4, 10 Nov), so there is one row per closed day and
// no till. Today with no close is "Not closed yet". Each closed day has its
// online money as a row of its own (answer 5). Beyond 62 days the rows are
// months, their closed days added up (answer 9).
import { prepare } from '../db.js';
import { periodFor, addDays } from './report-periods.js';
import { onlineSoFar } from '../routes/close-the-day.js';

const CLOSES = `SELECT c.id, to_char(c.day, 'YYYY-MM-DD') AS day, c.closed_at, COALESCE(l.name, 'Unknown') AS closed_by_name,
    c.takings_pence, c.card_pence, c.cash_pence, c.other_pence, c.online_pence,
    c.counted_pence - c.expected_pence AS difference_pence, c.banked_pence
  FROM day_closes c LEFT JOIN logins l ON l.id = c.login_id
  WHERE c.day BETWEEN ?::date AND ?::date ORDER BY c.day`;

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
  const { first } = await prepare("SELECT to_char(min(day), 'YYYY-MM-DD') AS first FROM day_closes").get();
  const nothingBefore = !first || first >= period.from;

  const keyOf = (c) => (unit === 'month' ? c.day.slice(0, 7) : c.day);
  const group = (list) => {
    const m = new Map();
    for (const c of list) m.set(keyOf(c), [...(m.get(keyOf(c)) ?? []), c]);
    return m;
  };
  const now = group(closes);
  const prev = group(before);

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
        differencePence: c.difference_pence, closedByName: c.closed_by_name, closedAt: c.closed_at,
      });
      rows.push({ kind: 'online', key: b.key, label: `${b.label} · Online`, onlinePence: c.online_pence });
    } else if (b.key === today) {
      rows.push({ kind: 'day', key: b.key, label: b.label, closed: false });
      // Today's online money so far, as drawn ("[£] so far"): not yet in any close.
      rows.push({ kind: 'online', key: b.key, label: `${b.label} · Online`, onlinePence: await onlineSoFar(today), soFar: true });
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
      online: figure('online_pence'), cashDifference: figure('difference_pence'),
    },
    rows, bars, empty: rows.length === 0, nothingBefore, firstCloseOn: first ?? null,
  };
}
