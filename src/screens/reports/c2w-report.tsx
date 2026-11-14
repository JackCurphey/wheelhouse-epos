import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { useShowGraphs } from '@/lib/your-settings.ts';
import { ROUTES } from '@/staff/routes.ts';
import { Box, BackToReports, DownloadButton, Note, Page, Refusal } from './reports-bits.tsx';
import { compareWords, money } from './reports-format.ts';
import { ReportGraph } from './report-graph.tsx';
import { PickDates } from './pick-dates.tsx';
import { ChangeWhatsShown } from './change-panel.tsx';
import { Figure, PERIODS } from './sales-report.tsx';

/**
 * Cycle to Work: owed and paid (rp-c2w in generator/reports.mjs; UX
 * walk-through 5 H3, option 1; openspec/changes/cycle-to-work, task 10.3): by
 * provider, the bikes collected, what's owed now, what was paid and the
 * commission kept, and the late bikes. What's owed bike by bike stays on Cycle
 * to Work's own Owed page (cw-owed), which the line under the table links to.
 * The period is in the address, as Workshop has it. Defaults logged in
 * docs/decisions/decided-while-building/2026-11-jack.md.
 */
type Row = { bikesCollected: number; owedPence: number; paidPence: number; beforePaidPence: number; commissionPence: number; late: number };
type Against = { pence: number; beforePence: number; diffPence: number };
export type C2wReport = {
  period: { period: string; from: string; to: string; through: string; soFar: boolean; unit: 'day' | 'month' | 'hour'; label: string; against: string };
  columns: { now: string; before: string };
  figures: { owedNow: { pence: number; bikes: number; late: number }; paid: Against; commission: Against; shortfalls: { pence: number; orders: number } };
  providers: (Row & { id: number; name: string })[];
  total: Row & { label: string };
  shopLine: string; today: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The graph's description, as the drawing words it: who was paid most, then the change on the period before.
function spokenFor(title: string, report: C2wReport): string {
  const most = report.providers.reduce<C2wReport['providers'][number] | null>((best, p) => (best === null || p.paidPence > best.paidPence ? p : best), null);
  const parts: string[] = [];
  if (most && most.paidPence > 0) parts.push(`most paid by ${most.name}`);
  const words = compareWords(report.figures.paid.diffPence, report.period.against, 'money') ?? '';
  parts.push(words.charAt(0).toLowerCase() + words.slice(1));
  return `${title}: ${parts.join('; ')}.`;
}

export function C2wReportPage() {
  const [params, setParams] = useSearchParams();
  // The drawing opens on This month.
  const period = params.get('period') ?? 'this-month';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [picking, setPicking] = useState(false);
  const query = new URLSearchParams({ period, ...(period === 'dates' ? { from, to } : {}) }).toString();
  const c2w = useQuery({ queryKey: ['reports-c2w', query], queryFn: () => apiGet<C2wReport>(`/api/reports/c2w?${query}`), retry: false });
  const report = c2w.data;

  function choose(value: string) {
    if (value === 'dates') { setPicking(true); return; }
    setParams({ period: value });
  }

  return (
    <Page>
      <BackToReports />
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">Cycle to Work: owed and paid</h2>
          {report ? <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{report.shopLine} · {report.period.label}, against {report.period.against}</p> : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ChangeWhatsShown base="c2w" period={new URLSearchParams(query)} />
          <DownloadButton path={`/api/reports/c2w.csv?${query}`} />
        </div>
      </div>
      <PillGroup legend="Period" name="period" value={picking ? 'dates' : period} onChange={choose} options={PERIODS} />
      {c2w.isError ? <Refusal error={c2w.error} /> : null}
      {report ? <Body report={report} /> : c2w.isError ? null : <Note>Loading…</Note>}
      {picking && report ? (
        <PickDates subtitle={`Cycle to Work · ${report.shopLine}`} today={report.today} from={from || report.today} to={to || report.today}
          onClose={() => setPicking(false)} onShow={(a, b) => { setPicking(false); setParams({ period: 'dates', from: a, to: b }); }} />
      ) : null}
    </Page>
  );
}

const HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-xs font-bold text-[var(--wh-muted)] max-md:whitespace-normal max-md:px-1';
const CELL = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-right whitespace-nowrap max-md:px-1';
const ROW_HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-left font-semibold max-md:px-1';
const TOTAL = 'px-1.5 py-2.5 text-right max-md:px-1';
const COLS = ['Bikes collected', 'Owed now', 'Paid', 'Commission', 'Late'];
const cellsOf = (r: Row) => [String(r.bikesCollected), money(r.owedPence), money(r.paidPence), money(r.commissionPence), String(r.late)];

function Body({ report }: { report: C2wReport }) {
  const showGraphs = useShowGraphs();
  const { figures: f, period: p, columns } = report;
  // A shop with no providers has nothing to break down: one line, in the first-use screen's words (cw-first-use).
  const none = report.providers.length === 0;
  const title = 'Paid by provider';
  const graphRows = report.providers.map((r) => ({ key: r.id, label: r.name, notReached: false, takingsPence: r.paidPence, beforeTakingsPence: r.beforePaidPence }));
  return (
    <>
      <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
        <Figure name="Owed now" value={money(f.owedNow.pence)} words={`${plural(f.owedNow.bikes, 'bike', 'bikes')} · ${f.owedNow.late} late`} />
        <Figure name="Paid" value={money(f.paid.pence)} words={compareWords(f.paid.diffPence, p.against, 'money')} />
        <Figure name="Commission" value={money(f.commission.pence)} words={compareWords(f.commission.diffPence, p.against, 'money')} />
        <Figure name="Shortfalls closed" value={money(f.shortfalls.pence)} words={`${plural(f.shortfalls.orders, 'order', 'orders')} closed with a reason`} />
      </div>
      {none ? <Note>No scheme providers yet.</Note> : (
        <Box>
          {showGraphs ? (
            <ReportGraph title={title} rows={graphRows} kind="bars" spoken={spokenFor(title, report)}
              keyNow={`Paid ${columns.now.charAt(0).toLowerCase()}${columns.now.slice(1)}`} keyBefore={columns.before} showBefore />
          ) : null}
          <div className="overflow-x-auto">
            <table aria-label="Cycle to Work by provider" className="w-full border-collapse text-sm max-md:text-size-13">
              <thead><tr>
                <th scope="col" className={`${HEAD} text-left`}>Provider</th>
                {COLS.map((c) => <th key={c} scope="col" className={`${HEAD} text-right`}>{c}</th>)}
              </tr></thead>
              <tbody>
                {report.providers.map((r) => (
                  <tr key={r.id}><th scope="row" className={ROW_HEAD}>{r.name}</th>{cellsOf(r).map((c, i) => <td key={COLS[i]} className={CELL}>{c}</td>)}</tr>
                ))}
                <tr className="font-bold">
                  <th scope="row" className="px-1.5 py-2.5 text-left max-md:px-1">{report.total.label}</th>
                  {cellsOf(report.total).map((c, i) => <td key={COLS[i]} className={TOTAL}>{c}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </Box>
      )}
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-normal">
        <span>Each bike, and what’s owed on it right now, is on Cycle to Work’s Owed page.</span>
        <Link to={ROUTES['cw-owed']} aria-label="See what Cycle to Work providers owe now" className="inline-flex min-h-11 items-center px-1 font-semibold text-[var(--wh-ink)] underline">See what’s owed now</Link>
      </p>
      <Note>Paid and commission are counted on the day each order is marked paid. They go to Xero with that day’s summary.</Note>
    </>
  );
}
