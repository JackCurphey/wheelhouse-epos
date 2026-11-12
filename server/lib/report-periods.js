// The report periods (openspec/changes/reports-sales-and-takings, design 2;
// Jack's answers 7 to 9 of 10 Nov): turns a choice (Today, This week, This
// month, Last month, Last 12 months, Pick dates) and the shop's today into
// the days it covers, the period before it to compare with, and the rows of
// the graph and table. Pure: dates are calendar days (YYYY-MM-DD) on the
// shop's own clock, so summer time never moves a day. Weeks start on Monday.
import { ValidationError } from './http.js';

const DAY = 86400000;
const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso, n) => fmt(parse(iso) + n * DAY);
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const addMonths = (iso, n) => {
  const [y, m] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
};
const monthEnd = (iso) => addDays(addMonths(monthStart(iso), 1), -1);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(parse(s)) === s;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayOf = (iso) => new Date(parse(iso)).getUTCDay();
const dom = (iso) => Number(iso.slice(8));
const monthName = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1];
const short = (iso) => `${WEEKDAYS[dayOf(iso)].slice(0, 3)} ${dom(iso)} ${monthName(iso).slice(0, 3)}`;
const monthLabel = (iso) => `${monthName(iso)} ${iso.slice(0, 4)}`;

// "14 – 17 September", "28 December – 1 January 2027", "17 September".
// `withWeekday` gives "Mon 14 – Thu 17 September" as the drawings have it.
function rangeLabel(from, to, withWeekday) {
  const w = (d) => (withWeekday ? `${WEEKDAYS[dayOf(d)].slice(0, 3)} ` : '');
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const year = (d) => ` ${d.slice(0, 4)}`;
  if (from === to) return `${w(from)}${dom(from)} ${monthName(from)}`;
  if (sameYear && from.slice(0, 7) === to.slice(0, 7)) return `${w(from)}${dom(from)} – ${w(to)}${dom(to)} ${monthName(to)}`;
  if (sameYear) return `${w(from)}${dom(from)} ${monthName(from)} – ${w(to)}${dom(to)} ${monthName(to)}`;
  return `${w(from)}${dom(from)} ${monthName(from)}${year(from)} – ${w(to)}${dom(to)} ${monthName(to)}${year(to)}`;
}
// A range whose end year differs from the start year puts the year on the end only.
const rangeLabelShort = (from, to, withWeekday) => {
  const label = rangeLabel(from, to, withWeekday);
  if (from.slice(0, 4) !== to.slice(0, 4)) {
    const w = (d) => (withWeekday ? `${WEEKDAYS[dayOf(d)].slice(0, 3)} ` : '');
    return `${w(from)}${dom(from)} ${monthName(from)} – ${w(to)}${dom(to)} ${monthName(to)} ${to.slice(0, 4)}`;
  }
  return label;
};

const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

function dayBuckets(from, to, through, beforeFrom) {
  const out = [];
  for (let i = 0, d = from; d <= to; i += 1, d = addDays(from, i)) {
    out.push({ key: d, label: short(d), notReached: d > through, beforeKey: addDays(beforeFrom, i) });
  }
  return out;
}
function monthBuckets(from, to, through, beforeFrom) {
  const out = [];
  for (let i = 0, m = monthStart(from); m <= to; i += 1, m = addMonths(monthStart(from), i)) {
    out.push({
      key: m.slice(0, 7), label: m.slice(0, 4) === through.slice(0, 4) ? monthName(m).slice(0, 3) : `${monthName(m).slice(0, 3)} ${m.slice(2, 4)}`,
      notReached: m > through, beforeKey: addMonths(monthStart(beforeFrom), i).slice(0, 7),
    });
  }
  return out;
}

export function periodFor({ period, today, from, to, openingHour = 9, closingHour = 18, quarterStartMonth = null }) {
  const monday = addDays(today, -((dayOf(today) + 6) % 7));
  let result;
  if (period === 'today') {
    const before = addDays(today, -7);
    const buckets = [];
    for (let h = openingHour; h < closingHour; h += 1) buckets.push({ key: h, label: hourLabel(h), notReached: false, beforeKey: h });
    result = {
      from: today, to: today, through: today, soFar: true, unit: 'hour',
      label: `${WEEKDAYS[dayOf(today)]} ${dom(today)} ${monthName(today)}, so far`,
      against: `last ${WEEKDAYS[dayOf(today)]}`, before: { from: before, to: before }, buckets,
    };
  } else if (period === 'this-week') {
    const end = addDays(monday, 6);
    const elapsed = daysBetween(monday, today);
    const soFar = today <= end; // today is still counting until it is over
    const beforeFrom = addDays(monday, -7);
    result = {
      from: monday, to: end, through: today, soFar, unit: 'day',
      label: `So far: ${rangeLabelShort(monday, today, true)}`,
      against: 'the same days last week',
      before: { from: beforeFrom, to: addDays(beforeFrom, elapsed) },
      buckets: dayBuckets(monday, end, today, beforeFrom),
    };
  } else if (period === 'this-month') {
    const first = monthStart(today);
    const end = monthEnd(today);
    const beforeFrom = addMonths(first, -1);
    const beforeEnd = monthEnd(beforeFrom);
    const soFar = today <= end;
    const same = addDays(beforeFrom, daysBetween(first, today));
    result = {
      from: first, to: end, through: today, soFar, unit: 'day',
      label: `So far: ${rangeLabelShort(first, today, false)}`,
      against: 'the same days last month',
      before: { from: beforeFrom, to: same > beforeEnd ? beforeEnd : same },
      buckets: dayBuckets(first, end, today, beforeFrom),
    };
  } else if (period === 'last-month') {
    const first = addMonths(monthStart(today), -1);
    const end = monthEnd(first);
    const beforeFrom = addMonths(first, -1);
    result = {
      from: first, to: end, through: end, soFar: false, unit: 'day', label: monthLabel(first),
      against: 'the month before', before: { from: beforeFrom, to: monthEnd(beforeFrom) },
      buckets: dayBuckets(first, end, end, beforeFrom),
    };
  } else if (period === 'last-12-months' || period === 'last-24-months') {
    // Last 24 months is Returning customers' own longer view (rp-returning).
    const months = period === 'last-12-months' ? 12 : 24;
    const first = addMonths(monthStart(today), 1 - months);
    const end = monthEnd(today);
    const beforeFrom = addMonths(first, -months);
    result = {
      from: first, to: end, through: today, soFar: today <= end, unit: 'month',
      label: `${monthLabel(first)} – ${monthLabel(today)}`,
      against: `the ${months} months before`, before: { from: beforeFrom, to: addDays(first, -1) },
      buckets: monthBuckets(first, end, today, beforeFrom),
    };
  } else if (period === 'this-vat-quarter' || period === 'last-vat-quarter') {
    // VAT quarters (openspec/changes/reports-ready-made, design 4 and 5): they
    // start in month 1, 2 or 3 and every three months on; calendar quarters
    // while the shop hasn't said. Always against the whole quarter before.
    const startMonth = quarterStartMonth ?? 1;
    const offset = (((Number(today.slice(5, 7)) - startMonth) % 3) + 3) % 3;
    const thisStart = addMonths(monthStart(today), -offset);
    const first = period === 'this-vat-quarter' ? thisStart : addMonths(thisStart, -3);
    const end = addDays(addMonths(first, 3), -1);
    const beforeFrom = addMonths(first, -3);
    const through = end < today ? end : today;
    result = {
      from: first, to: end, through, soFar: today <= end, unit: 'month',
      label: rangeLabel(first, end, false),
      against: 'the quarter before', before: { from: beforeFrom, to: addDays(first, -1) },
      buckets: monthBuckets(first, end, through, beforeFrom),
    };
  } else if (period === 'dates') {
    if (!isDate(from) || !isDate(to)) throw new ValidationError('Pick a From and a To date');
    if (to < from) throw new ValidationError('To is before From: pick a To on or after From');
    if (to > today) throw new ValidationError("To can't be after today");
    const length = daysBetween(from, to) + 1;
    const beforeFrom = addDays(from, -length);
    const byMonth = length > 62;
    result = {
      from, to, through: to, soFar: false, unit: byMonth ? 'month' : 'day', label: rangeLabelShort(from, to, false),
      against: 'the same number of days just before', before: { from: beforeFrom, to: addDays(from, -1) },
      buckets: byMonth ? monthBuckets(from, to, to, beforeFrom) : dayBuckets(from, to, to, beforeFrom),
    };
  } else {
    throw new ValidationError('Choose Today, This week, This month, Last month, Last 12 months or Pick dates');
  }
  return { period, ...result };
}

export { addDays, addMonths, monthStart, monthEnd, monthBuckets };
