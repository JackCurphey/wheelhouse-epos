import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { useShowGraphs } from '@/lib/your-settings.ts';
import { Box, BackToReports, BoxHeading, DownloadButton, Note, Page, Refusal } from './reports-bits.tsx';
import { compareWords, count, money } from './reports-format.ts';
import { ReportGraph } from './report-graph.tsx';
import { PickDates } from './pick-dates.tsx';
import { Figure, PERIODS } from './sales-report.tsx';

/**
 * Workshop (rp-workshop in generator/reports.mjs; decision 6;
 * openspec/changes/reports-ready-made, design 2): jobs booked in, finished,
 * collected and the average days from booked in to ready, each compared in
 * words with the period before; jobs finished by day; workshop takings and
 * quotes against the period before; and how full each mechanic was. The
 * period is in the address, as Sales has it.
 */
type Figure = { count: number; beforeCount: number; diff: number };
type Pair = { pence: number; beforePence: number };
type Count = { count: number; beforeCount: number };
type Mechanic = { id: number; name: string; bookedHours: number; availableHours: number; percent: number | null; noSetHours: boolean };
export type WorkshopReport = {
  period: { period: string; from: string; to: string; through: string; soFar: boolean; unit: 'day' | 'month' | 'hour'; label: string; against: string };
  columns: { now: string; before: string };
  figures: { bookedIn: Figure; finished: Figure; collected: Figure; bookedInToReady: { days: number | null; beforeDays: number | null; diff: number | null } };
  rows: { key: string | number; label: string; notReached: boolean; finished: number | null; beforeFinished: number }[];
  takings: { labour: Pair; parts: Pair; total: Pair };
  quotes: { approved: Count; declined: Count; noAnswer: Count };
  mechanics: Mechanic[];
  sharedQueue: { bookedHours: number };
  shopLine: string; today: string;
};

const UNIT_WORD = { day: 'day', month: 'month', hour: 'hour' } as const;
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const hours = (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'}`;

// The graph's description. No table of jobs by day sits under it, so it ends with the figures themselves.
function spokenFor(title: string, report: WorkshopReport): string {
  const unit = UNIT_WORD[report.period.unit];
  const reached = report.rows.filter((r) => !r.notReached);
  const busiest = reached.reduce<WorkshopReport['rows'][number] | null>((best, r) => (best === null || (r.finished ?? 0) > (best.finished ?? 0) ? r : best), null);
  const diff = report.figures.finished.diff;
  const parts: string[] = [];
  if (busiest && (busiest.finished ?? 0) > 0) parts.push(`busiest ${unit} ${busiest.label}`);
  parts.push(diff === 0 ? `no change on ${report.period.against}` : `${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} on ${report.period.against}`);
  const each = reached.map((r) => `${r.label} ${r.finished ?? 0}`).join(', ');
  return `${title}: ${parts.join('; ')}. Each ${unit}: ${each}.`;
}

export function WorkshopReportPage() {
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? 'this-week';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [picking, setPicking] = useState(false);
  const query = new URLSearchParams({ period, ...(period === 'dates' ? { from, to } : {}) }).toString();
  const workshop = useQuery({ queryKey: ['reports-workshop', query], queryFn: () => apiGet<WorkshopReport>(`/api/reports/workshop?${query}`), retry: false });
  const report = workshop.data;

  function choose(value: string) {
    if (value === 'dates') { setPicking(true); return; }
    setParams({ period: value });
  }

  return (
    <Page>
      <BackToReports />
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">Workshop</h2>
          {report ? <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{report.shopLine} · {report.period.label}, against {report.period.against}</p> : null}
        </div>
        <DownloadButton path={`/api/reports/workshop.csv?${query}`} />
      </div>
      <PillGroup legend="Period" name="period" value={picking ? 'dates' : period} onChange={choose} options={PERIODS} />
      {workshop.isError ? <Refusal error={workshop.error} /> : null}
      {report ? <Body report={report} /> : workshop.isError ? null : <Note>Loading…</Note>}
      {picking && report ? (
        <PickDates subtitle={`Workshop · ${report.shopLine}`} today={report.today} from={from || report.today} to={to || report.today}
          onClose={() => setPicking(false)} onShow={(a, b) => { setPicking(false); setParams({ period: 'dates', from: a, to: b }); }} />
      ) : null}
    </Page>
  );
}

const HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-xs font-bold text-[var(--wh-muted)] max-md:whitespace-normal max-md:px-1';
const CELL = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-right whitespace-nowrap max-md:px-1';
const ROW_HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-left font-semibold whitespace-nowrap max-md:px-1';

function AgainstTable({ label, first, columns, rows, total }: {
  label: string; first: string; columns: { now: string; before: string }; rows: [string, string, string][]; total?: [string, string, string];
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-sm max-md:text-size-13">
        <thead><tr>
          <th scope="col" className={`${HEAD} text-left`}>{first}</th>
          <th scope="col" className={`${HEAD} text-right`}>{columns.now}</th><th scope="col" className={`${HEAD} text-right`}>{columns.before}</th>
        </tr></thead>
        <tbody>
          {rows.map(([name, now, before]) => (
            <tr key={name}><th scope="row" className={ROW_HEAD}>{name}</th><td className={CELL}>{now}</td><td className={CELL}>{before}</td></tr>
          ))}
          {total ? (
            <tr className="font-bold"><th scope="row" className="px-1.5 py-2.5 text-left max-md:px-1">{total[0]}</th><td className="px-1.5 py-2.5 text-right max-md:px-1">{total[1]}</td><td className="px-1.5 py-2.5 text-right max-md:px-1">{total[2]}</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// A mechanic with no set hours has no percent, so no bar.
function Full({ name, booked, available, percent }: { name: string; booked: number; available: number; percent: number | null }) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-[var(--wh-border)] py-2.5">
      <div className="flex justify-between gap-3 text-size-15 max-md:text-sm">
        <span className="font-bold">{name}</span>
        <span className="text-right">{percent !== null
          ? <>{booked} of {hours(available)} booked · <strong>{percent}% full</strong></>
          : <>{hours(booked)} booked · no set hours</>}</span>
      </div>
      {percent !== null ? (
        <div data-bar aria-hidden="true" className="h-2.5 overflow-hidden rounded-full border border-[var(--wh-border)] bg-[var(--wh-muted-bg)]">
          <div className="h-full rounded-full bg-[var(--wh-ink)]" style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
      ) : null}
    </li>
  );
}

function Body({ report }: { report: WorkshopReport }) {
  const showGraphs = useShowGraphs();
  const { figures: f, period: p, columns, takings: t, quotes: q } = report;
  const words = (diff: number | null) => compareWords(diff, p.against, 'count');
  const ready = f.bookedInToReady;
  const readyWords = ready.diff === null ? 'Average'
    : ready.diff === 0 ? `Average · No change on ${p.against}`
    : `Average · ${ready.diff > 0 ? 'Up' : 'Down'} ${days(Math.abs(ready.diff))} on ${p.against}`;
  const title = p.unit === 'month' ? 'Jobs finished by month' : p.unit === 'hour' ? 'Jobs finished by hour' : 'Jobs finished by day';
  const graphRows = report.rows.map((r) => ({ key: r.key, label: r.label, notReached: r.notReached, takingsPence: r.finished, beforeTakingsPence: r.beforeFinished }));
  return (
    <>
      <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
        <Figure name="Jobs booked in" value={count(f.bookedIn.count)} words={words(f.bookedIn.diff)} />
        <Figure name="Finished" value={count(f.finished.count)} words={words(f.finished.diff)} />
        <Figure name="Collected" value={count(f.collected.count)} words={words(f.collected.diff)} />
        <Figure name="Booked in to ready" value={ready.days === null ? '—' : days(ready.days)} words={readyWords} />
      </div>
      {showGraphs ? (
        <Box>
          <ReportGraph title={title} rows={graphRows} kind={p.unit === 'month' ? 'line' : 'bars'} scale="count" spoken={spokenFor(title, report)}
            keyNow={columns.now} keyBefore={columns.before} showBefore />
        </Box>
      ) : null}
      <div className="grid grid-cols-2 items-start gap-3.5 max-md:grid-cols-1">
        <Box>
          <BoxHeading>Workshop takings</BoxHeading>
          <AgainstTable label="Workshop takings" first="Money" columns={columns}
            rows={[['Labour', money(t.labour.pence), money(t.labour.beforePence)], ['Parts', money(t.parts.pence), money(t.parts.beforePence)]]}
            total={['Total', money(t.total.pence), money(t.total.beforePence)]} />
          <BoxHeading>Quotes</BoxHeading>
          <AgainstTable label="Quotes" first="Quote" columns={columns}
            rows={[['Approved', count(q.approved.count), count(q.approved.beforeCount)], ['Declined', count(q.declined.count), count(q.declined.beforeCount)], ['No answer', count(q.noAnswer.count), count(q.noAnswer.beforeCount)]]} />
        </Box>
        <Box label="How full each mechanic was">
          <BoxHeading>How full each mechanic was</BoxHeading>
          <ul className="m-0 list-none p-0">
            {report.mechanics.map((m) => (
              <Full key={m.id} name={m.name} booked={m.bookedHours} available={m.availableHours} percent={m.percent} />
            ))}
            <Full name="Shared queue" booked={report.sharedQueue.bookedHours} available={0} percent={null} />
          </ul>
          <Note>Hours booked in the diary against the hours each mechanic is in, from their working days.</Note>
        </Box>
      </div>
    </>
  );
}
