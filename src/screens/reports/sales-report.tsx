import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { useShowGraphs } from '@/lib/your-settings.ts';
import { Box, BackToReports, BoxHeading, DownloadButton, Note, Page, PeriodChips, Refusal } from './reports-bits.tsx';
import { compareWords, count, longDate, money, type SalesReport } from './reports-format.ts';
import { ReportGraph, graphWords } from './report-graph.tsx';
import { PickDates } from './pick-dates.tsx';

/**
 * Sales (rp-sales, rp-sales-year, rp-sales-empty and rp-pick-dates in
 * generator/reports.mjs; decisions 1 and 7; Jack's answers 3, 7 and 8 of
 * 10 Nov; openspec/changes/reports-sales-and-takings): the period choices,
 * Takings, Number of sales and Average sale compared with the period before
 * in words, a graph and the table below it. The period is in the address
 * (?period=, and from and to for Pick dates), so Back and a bookmark work.
 */
export const PERIODS = [
  { value: 'today', label: 'Today' }, { value: 'this-week', label: 'This week' }, { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' }, { value: 'last-12-months', label: 'Last 12 months' }, { value: 'dates', label: 'Pick dates' },
];
// The graph key's name for the period shown, as the drawing words it ("This week so far").
const KEY_NOW: Record<string, string> = {
  today: 'Today so far', 'this-week': 'This week so far', 'this-month': 'This month so far', 'last-month': 'Last month',
  'last-12-months': 'Last 12 months', dates: 'These dates',
};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const UNIT_WORD = { day: 'day', month: 'month', hour: 'hour' } as const;
const COLUMN = { day: 'Day', month: 'Month', hour: 'Hour' } as const;
const TABLE_TITLE = { day: 'Sales by day', month: 'Takings by month', hour: 'Sales by hour' } as const;

export function Figure({ name, value, words }: { name: string; value: ReactNode; words: string | null }) {
  return (
    <div role="group" aria-label={name} className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3">
      <span className="text-size-13-5 text-[var(--wh-muted)]">{name}</span>
      <span className="text-size-17 font-bold">{value}</span>
      {words ? <span className="text-size-13-5">{words}</span> : null}
    </div>
  );
}

export function SalesTable({ report }: { report: SalesReport }) {
  const { unit } = report.period;
  const cell = 'border-b border-[var(--wh-border)] px-2 py-2.5 max-md:px-1 max-md:text-size-13';
  const head = 'border-b-2 border-[var(--wh-border)] px-2 py-2 text-size-13-5 font-semibold max-md:whitespace-normal max-md:px-1';
  return (
    <div className="overflow-x-auto">
      <table aria-label={TABLE_TITLE[unit]} className="w-full border-collapse text-sm max-md:text-size-13">
        <thead><tr>
          <th scope="col" className={`${head} text-left`}>{COLUMN[unit]}</th>
          <th scope="col" className={`${head} text-right`}>Takings</th><th scope="col" className={`${head} text-right`}>Sales</th><th scope="col" className={`${head} text-right`}>Average</th>
        </tr></thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={String(r.key)}>
              <th scope="row" className={`${cell} text-left font-semibold whitespace-nowrap`}>{r.label}</th>
              <td className={`${cell} text-right`}>{money(r.takingsPence)}</td><td className={`${cell} text-right`}>{count(r.sales)}</td><td className={`${cell} text-right`}>{money(r.averagePence)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="font-bold">
          <th scope="row" className="px-2 py-2.5 text-left max-md:px-1">{report.total.label}</th>
          <td className="px-2 py-2.5 text-right max-md:px-1">{money(report.total.takingsPence)}</td>
          <td className="px-2 py-2.5 text-right max-md:px-1">{count(report.total.sales)}</td>
          <td className="px-2 py-2.5 text-right max-md:px-1">{money(report.total.averagePence)}</td>
        </tr></tfoot>
      </table>
    </div>
  );
}

export function SalesReportPage() {
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? 'this-week';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [picking, setPicking] = useState(false);
  const query = new URLSearchParams({ period, ...(period === 'dates' ? { from, to } : {}) }).toString();
  const sales = useQuery({ queryKey: ['reports-sales', query], queryFn: () => apiGet<SalesReport>(`/api/reports/sales?${query}`), retry: false });
  const report = sales.data;

  function choose(value: string) {
    if (value === 'dates') { setPicking(true); return; }
    setParams({ period: value });
  }

  return (
    <Page>
      <BackToReports />
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">Sales</h2>
          {report ? <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{report.shopLine} · {report.period.label}, against {report.period.against}</p> : null}
        </div>
        <DownloadButton path={`/api/reports/sales.csv?${query}`} />
      </div>
      <PeriodChips value={picking ? 'dates' : period} onChange={choose} options={PERIODS} />
      {sales.isError ? <Refusal error={sales.error} /> : null}
      {report ? <Body report={report} period={period} /> : sales.isError ? null : <Note>Loading…</Note>}
      {picking && report ? (
        <PickDates subtitle={`Sales · ${report.shopLine}`} today={report.today} from={from || report.today} to={to || report.today}
          onClose={() => setPicking(false)} onShow={(a, b) => { setPicking(false); setParams({ period: 'dates', from: a, to: b }); }} />
      ) : null}
    </Page>
  );
}

function Body({ report, period }: { report: SalesReport; period: string }) {
  const showGraphs = useShowGraphs();
  const { figures, period: p } = report;
  const words = (diff: number | null, kind: 'money' | 'count') => compareWords(diff, p.against, kind);
  if (report.empty) {
    return (
      <>
        <Box>
          <div className="flex flex-col items-center gap-2 px-3 py-9 text-center">
            <span className="text-size-17 font-bold">{period === 'today' ? 'Nothing sold yet today' : 'Nothing sold in this period'}</span>
            <Note>Sales show here as soon as the first one goes through a till.</Note>
          </div>
        </Box>
        {report.nothingBefore ? <NothingToCompare report={report} /> : null}
      </>
    );
  }
  const title = p.unit === 'month' ? 'Takings by month' : p.unit === 'hour' ? 'Takings by hour' : 'Takings by day';
  const spoken = graphWords({ title, rows: report.rows, unitWord: UNIT_WORD[p.unit], diffPence: figures.takings.diffPence, against: p.against });
  return (
    <>
      <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-2">
        <Figure name="Takings" value={money(figures.takings.pence)} words={words(figures.takings.diffPence, 'money')} />
        <Figure name="Number of sales" value={count(figures.sales.count)} words={words(figures.sales.diff, 'count')} />
        <Figure name="Average sale" value={money(figures.average.pence)} words={words(figures.average.diffPence, 'money')} />
      </div>
      <Box>
        {showGraphs ? <ReportGraph title={title} rows={report.rows} kind={p.unit === 'month' ? 'line' : 'bars'} spoken={spoken}
          keyNow={KEY_NOW[period] ?? 'This period'} keyBefore={period === 'last-12-months' ? 'The 12 months before' : capital(p.against.replace(/^the /, ''))} showBefore={!report.nothingBefore} /> : null}
        <SalesTable report={report} />
      </Box>
      <Note>Takings include VAT, take refunds off, and count online and Cycle to Work money; today counts so far.</Note>
      {report.nothingBefore ? <NothingToCompare report={report} /> : null}
    </>
  );
}

function NothingToCompare({ report }: { report: SalesReport }) {
  return (
    <Box>
      <BoxHeading>Nothing to compare with yet</BoxHeading>
      <Note>{`The shop started on Wheelhouse on ${longDate(report.firstSaleOn ?? report.startedOn)}, so there’s no period before this one. Comparisons start once there is.`}</Note>
    </Box>
  );
}
