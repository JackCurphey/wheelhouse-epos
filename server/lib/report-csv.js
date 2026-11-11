// Each report's table as a spreadsheet (openspec/changes/reports-sales-and-takings,
// design 7; Jack's answer 10 of 10 Nov): built from the same report the screen's
// table is built from, so the file and the screen can't disagree. Amounts are
// pounds and pence ("12.50"), a day to come is "—" as on screen, and the cells go
// through the shared spreadsheet helper (server/lib/csv.js: the UTF-8 mark, and a
// name that looks like a formula written as text).
import { csvOf } from './csv.js';

const pounds = (pence) => (pence === null || pence === undefined ? '—' : (pence / 100).toFixed(2));
const COLUMN = { day: 'Day', month: 'Month', hour: 'Hour' };

export function salesCsv(report) {
  const unit = report.period.unit;
  return csvOf([
    [COLUMN[unit], 'Takings', 'Sales', 'Average'],
    ...report.rows.map((r) => [r.label, pounds(r.takingsPence), r.sales === null ? '—' : r.sales, pounds(r.averagePence)]),
    [report.total.label, pounds(report.total.takingsPence), report.total.sales, pounds(report.total.averagePence)],
  ]);
}

export function takingsCsv(report) {
  return csvOf([
    ['Day', 'Takings', 'Cash banked', 'Cash difference', 'Closed by'],
    ...report.rows.map((r) => {
      if (r.kind === 'online') return [r.label, `${pounds(r.onlinePence)}${r.soFar ? ' so far' : ''}`, '—', '—', 'Not a till'];
      if (!r.closed) return [r.label, '—', '—', '—', 'Not closed yet'];
      return [r.label, pounds(r.takingsPence), pounds(r.bankedPence), pounds(r.differencePence), r.kind === 'month' ? `${r.closedDays} closed days` : r.closedByName];
    }),
  ]);
}

// One closed day's report, the rows Close the day's report shows.
export function dayCsv(close) {
  return csvOf([
    ['Item', 'Amount'],
    ['Day', close.day],
    ['Closed by', close.closedByName],
    ['Takings', pounds(close.takingsPence)],
    ['Card', pounds(close.cardPence)],
    ['Cash', pounds(close.cashPence)],
    ['Gift cards, store credit, customer accounts, other', pounds(close.otherPence)],
    ['Float at the start', pounds(close.floatStart.pence)],
    ['Cash difference', pounds(close.differencePence)],
    ['Banked', pounds(close.bankedPence)],
    ['Online', pounds(close.onlinePence)],
  ]);
}

