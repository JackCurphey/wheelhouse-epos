import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { useShowGraphs } from '@/lib/your-settings.ts';
import { ROUTES } from '@/staff/routes.ts';
import { Box, BackToReports, BoxHeading, DownloadButton, Note, Page, Refusal } from './reports-bits.tsx';
import { compareWords, count, longDate, money } from './reports-format.ts';
import { StackedGraph } from './report-graph.tsx';
import { PickDates } from './pick-dates.tsx';
import { Figure } from './sales-report.tsx';

/**
 * Returning customers (rp-returning in generator/reports.mjs; leftover
 * screens decision 5; openspec/changes/reports-ready-made, design 3): how many
 * customers came in, how many were new and the share back within 12 months,
 * each compared in words with the period before; new and returning customers
 * by month; and the customers not seen for [n] months. No Message button
 * (Jack's answer 4). The period and the months are in the address.
 */
type Figure = { count: number; beforeCount: number; diff: number };
type Lapsed = { id: number; name: string; lastVisit: string; spentPence: number; happyToHear: boolean };
export type ReturningReport = {
  period: { period: string; from: string; to: string; through: string; soFar: boolean; unit: 'month'; label: string; against: string };
  figures: { customers: Figure; new: Figure; cameBack: { percent: number | null; beforePercent: number | null; diff: number | null } };
  rows: { key: string; label: string; notReached: boolean; returning: number; new: number; all: number }[];
  total: { label: string; returning: number; new: number; all: number };
  notSeen: { months: number; column: string; customers: Lapsed[] };
  shopLine: string; today: string;
};

const PERIODS = [{ value: 'last-12-months', label: 'Last 12 months' }, { value: 'last-24-months', label: 'Last 24 months' }, { value: 'dates', label: 'Pick dates' }];
const TITLE = 'New and returning customers by month';
const points = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

// "most returning in Feb, most new in Mar": the month with the most of each.
function spokenFor(report: ReturningReport): string {
  const most = (k: 'returning' | 'new') => report.rows.reduce<ReturningReport['rows'][number] | null>((best, r) => (r[k] > (best?.[k] ?? 0) ? r : best), null);
  const parts = [most('returning') ? `most returning in ${most('returning')!.label}` : null, most('new') ? `most new in ${most('new')!.label}` : null].filter(Boolean);
  return `${TITLE}: ${parts.join(', ') || 'no customers'}. The figures are in the table below.`;
}

export function ReturningReportPage() {
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? 'last-12-months';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const months = params.get('months') ?? '';
  const [picking, setPicking] = useState(false);
  const query = new URLSearchParams({ period, ...(period === 'dates' ? { from, to } : {}), ...(months ? { months } : {}) }).toString();
  const returning = useQuery({ queryKey: ['reports-returning', query], queryFn: () => apiGet<ReturningReport>(`/api/reports/returning?${query}`), retry: false, placeholderData: (last) => last });
  const report = returning.data;
  const keep: Record<string, string> = months ? { months } : {};

  function choose(value: string) {
    if (value === 'dates') { setPicking(true); return; }
    setParams({ period: value, ...keep });
  }
  function setMonths(n: string) {
    setParams({ period, ...(period === 'dates' ? { from, to } : {}), months: n });
  }

  return (
    <Page>
      <BackToReports />
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">Returning customers</h2>
          {report ? <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{report.shopLine} · {report.period.label}</p> : null}
        </div>
        <DownloadButton path={`/api/reports/returning.csv?${query}`} />
      </div>
      <PillGroup legend="Period" name="period" value={picking ? 'dates' : period} onChange={choose} options={PERIODS} />
      {returning.isError ? <Refusal error={returning.error} /> : null}
      {report ? <Body report={report} onMonths={setMonths} /> : returning.isError ? null : <Note>Loading…</Note>}
      {picking && report ? (
        <PickDates subtitle={`Returning customers · ${report.shopLine}`} today={report.today} from={from || report.today} to={to || report.today}
          onClose={() => setPicking(false)} onShow={(a, b) => { setPicking(false); setParams({ period: 'dates', from: a, to: b, ...keep }); }} />
      ) : null}
    </Page>
  );
}

const HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-xs font-bold text-[var(--wh-muted)] max-md:whitespace-normal max-md:px-1';
const CELL = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-right whitespace-nowrap max-md:px-1';
const ROW_HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-left font-semibold whitespace-nowrap max-md:px-1';
const TOTAL = 'px-1.5 py-2.5 max-md:px-1';

// "Not seen for [n] months": the address changes once the box holds a whole number of months, 1 or more.
function MonthsBox({ months, onMonths }: { months: number; onMonths: (n: string) => void }) {
  const [text, setText] = useState(String(months));
  return (
    <label className="inline-flex items-center gap-2 text-sm font-semibold">
      Not seen for
      <input type="text" inputMode="numeric" aria-label="Months not seen" value={text}
        onChange={(e) => { setText(e.target.value); if (/^\d+$/.test(e.target.value) && Number(e.target.value) >= 1) onMonths(e.target.value); }}
        className="min-h-11 w-16 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 font-mono text-size-15 text-[var(--wh-ink)]" />
      months
    </label>
  );
}

function Body({ report, onMonths }: { report: ReturningReport; onMonths: (n: string) => void }) {
  const showGraphs = useShowGraphs();
  const { figures: f, period: p, total, notSeen } = report;
  const words = (diff: number) => compareWords(diff, p.against, 'count');
  const back = f.cameBack;
  const backWords = back.diff === null ? null
    : back.diff === 0 ? `No change on ${p.against}`
    : `${back.diff > 0 ? 'Up' : 'Down'} ${points(Math.abs(back.diff))} on ${p.against}`;
  const graphRows = report.rows.map((r) => ({ key: r.key, label: r.label, notReached: r.notReached, lower: r.returning, upper: r.new }));
  return (
    <>
      <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
        <Figure name="Customers" value={count(f.customers.count)} words={words(f.customers.diff)} />
        <Figure name="New" value={count(f.new.count)} words={words(f.new.diff)} />
        <Figure name="Came back within 12 months" value={back.percent === null ? '—' : `${back.percent}%`} words={backWords} />
      </div>
      <Box>
        {showGraphs ? <StackedGraph title={TITLE} rows={graphRows} keyLower="Returning" keyUpper="New" spoken={spokenFor(report)} /> : null}
        <Note>A customer counts when they buy something or a repair is collected — in the shop or online. Sales with no customer on them are not counted.</Note>
        <div className="overflow-x-auto">
          <table aria-label={TITLE} className="w-full border-collapse text-sm max-md:text-size-13">
            <thead><tr>
              <th scope="col" className={`${HEAD} text-left`}>Month</th>
              {['Returning', 'New', 'All'].map((h) => <th key={h} scope="col" className={`${HEAD} text-right`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className={ROW_HEAD}>{r.label}</th>
                  {r.notReached ? <td colSpan={3} className={`${CELL} text-[var(--wh-muted)]`}>Not yet</td>
                    : [r.returning, r.new, r.all].map((n, i) => <td key={i} className={CELL}>{count(n)}</td>)}
                </tr>
              ))}
              <tr className="font-bold">
                <th scope="row" className={`${TOTAL} text-left`}>{total.label}</th>
                {[total.returning, total.new, total.all].map((n, i) => <td key={i} className={`${TOTAL} text-right`}>{count(n)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Box>
      <Box>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <BoxHeading>Not seen lately</BoxHeading>
          <MonthsBox months={notSeen.months} onMonths={onMonths} />
        </div>
        <Note>Customers who used to come in. “Happy to hear about offers” is what they said yes or no to.</Note>
        {notSeen.customers.length ? (
          <div className="overflow-x-auto">
            <table aria-label="Not seen lately" className="w-full border-collapse text-sm max-md:text-size-13">
              <thead><tr>
                <th scope="col" className={`${HEAD} text-left`}>Customer</th>
                <th scope="col" className={`${HEAD} text-right`}>Last bought or collected</th>
                <th scope="col" className={`${HEAD} text-right`}>{notSeen.column}</th>
                <th scope="col" className={`${HEAD} text-left`}>Happy to hear about offers</th>
              </tr></thead>
              <tbody>
                {notSeen.customers.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className={ROW_HEAD}>
                      <Link to={ROUTES['cs-page'].replace(':id', String(c.id))} className="inline-flex min-h-11 items-center font-bold text-[var(--wh-ink)]">{c.name}</Link>
                    </th>
                    <td className={CELL}>{longDate(c.lastVisit)}</td>
                    <td className={CELL}>{money(c.spentPence)}</td>
                    <td className={`${CELL} text-left`}>{c.happyToHear ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Note>No one who used to come in has been away that long.</Note>}
      </Box>
    </>
  );
}
