import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/staff/routes.ts';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { dayLabel } from '@/screens/diary/rules.ts';
import { clock } from '@/screens/diary/when.ts';
import { Report, type Close } from '@/screens/till/close-the-day.tsx';
import { useShowGraphs } from '@/lib/your-settings.ts';
import { Box, BackToReports, DownloadButton, Note, Page, PeriodChips, Refusal } from './reports-bits.tsx';
import { compareWords, differenceText, money, type SalesRow } from './reports-format.ts';
import { ReportGraph, graphWords } from './report-graph.tsx';
import { PickDates } from './pick-dates.tsx';
import { ReopenDialog } from './reopen-dialog.tsx';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { ChangeWhatsShown } from './change-panel.tsx';
import { Figure, PERIODS } from './sales-report.tsx';

/**
 * Takings and cash-ups (rp-takings and rp-day in generator/reports.mjs; Cash-up
 * 6, audit H1, M12, M17, L3; Jack's answers 4, 5 and 9 of 10 Nov;
 * openspec/changes/reports-sales-and-takings): the closed days of a period as
 * they were saved at each close, one row per closed day (no till), today as
 * "Not closed yet", each day's online money as a row of its own, and each closed
 * day opening its end-of-day report. The period is in the address, as Sales'
 * is, and so is the open day (?day=).
 */
type Row =
  | { kind: 'day'; key: string; label: string; closed: false; past?: boolean; takingsPence?: number; closeDay?: string; sent?: SentState }
  | { kind: 'day'; key: string; label: string; closed: true; reopened?: boolean; sent?: SentState; closeId: number; takingsPence: number; bankedPence: number; differencePence: number; closedByName: string; closedAt: string }
  | { kind: 'online'; key: string; label: string; onlinePence: number; soFar?: boolean; sent?: SentState }
  | { kind: 'month'; key: string; label: string; closed: true; closedDays: number; takingsPence: number; bankedPence: number; differencePence: number };
/** Where a day stands with the accounts software (null: it was closed before that was connected). */
type SentState = 'sent' | 'waiting' | 'failed' | 'reopened' | 'open' | null;
const SENT_WORDS = { sent: 'Sent', waiting: 'Waiting', failed: 'Not sent', reopened: 'Reopened', open: 'Not closed yet' } as const;
const SENT_TONE = {
  sent: 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]', waiting: 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]', open: 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]',
  failed: 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]', reopened: 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]',
} as const;
type Figures = { pence: number; beforePence: number; diffPence: number | null };
type Takings = {
  period: { period: string; from: string; to: string; through: string; soFar: boolean; unit: 'day' | 'month'; label: string; against: string };
  figures: { takings: Figures; card: Figures; cash: Figures; other: Figures; online: Figures; cashDifference: Figures };
  rows: Row[]; bars: SalesRow[]; empty: boolean; nothingBefore: boolean; shopLine: string; today: string;
  // A reopened day in this period: left out of every figure until it is closed again (reports-accounts-and-reopen).
  reopened?: { day: string; label: string; reason: string; reopenedByName: string } | null;
  // Connected (or lost): the table has a Sent to [service] column.
  accounts?: { providerName: string; status: string } | null;
};

const KEY_NOW: Record<string, string> = { 'this-week': 'Closed days this week', 'this-month': 'Closed days this month', 'last-month': 'Closed days last month' };
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A cash difference in the warning colour with a minus sign when short, and in words for a screen reader.
function Difference({ pence }: { pence: number }) {
  if (pence < 0) return <span className="font-bold text-[var(--wh-warn-ink)]">{differenceText(pence)}<span className="sr-only"> short</span></span>;
  return <span>{differenceText(pence)}{pence > 0 ? <span className="sr-only"> over</span> : null}</span>;
}

const CELL = 'border-b border-[var(--wh-border)] px-2 py-2.5 text-right max-md:px-1 max-md:text-size-13';
const HEAD = 'border-b-2 border-[var(--wh-border)] px-2 py-2 text-size-13-5 font-semibold max-md:whitespace-normal max-md:px-1';
// A row's day: left-aligned and kept on one line, so a phone's table scrolls sideways rather than breaking the date.
const DAY = 'border-b border-[var(--wh-border)] px-2 py-2.5 text-left whitespace-nowrap max-md:px-1 max-md:text-size-13';

/** Close the day for a day: today's own page, or an earlier day's by its date. */
const closeDayPath = (day: string, today: string) => (day === today ? ROUTES['eod-count'] : `${ROUTES['eod-count']}?day=${day}`);

function ClosedDays({ rows, onOpen, accounts }: { rows: Row[]; onOpen: (id: number) => void; accounts?: Takings['accounts'] }) {
  // The Sent to [service] column, only while accounts software is connected or lost.
  const sentCell = (r: Row) => {
    if (!accounts) return null;
    const sent = (r as { sent?: SentState }).sent;
    return <td className={CELL}>{sent ? <span className={`inline-flex rounded-full px-2.5 py-0.5 text-size-13-5 font-semibold ${SENT_TONE[sent]}`}>{SENT_WORDS[sent]}</span> : '—'}</td>;
  };
  return (
    <div className="overflow-x-auto">
      <table aria-label="Closed days" className="w-full border-collapse text-sm max-md:text-size-13">
        <thead><tr>
          <th scope="col" className={`${HEAD} text-left`}>Day</th><th scope="col" className={`${HEAD} text-right`}>Takings</th>
          <th scope="col" className={`${HEAD} text-right`}>Cash banked</th><th scope="col" className={`${HEAD} text-right`}>Cash difference</th><th scope="col" className={`${HEAD} text-right`}>Closed by</th>{accounts ? <th scope="col" className={`${HEAD} text-right`}>{`Sent to ${accounts.providerName}`}</th> : null}
        </tr></thead>
        <tbody>
          {rows.map((r) => {
            if (r.kind === 'online') {
              return (
                <tr key={`o${r.key}`}>
                  <th scope="row" className={`${DAY} font-normal`}>{r.label}</th>
                  <td className={CELL}>{money(r.onlinePence)}{r.soFar ? ' so far' : ''}</td><td className={CELL}>—</td><td className={CELL}>—</td><td className={CELL}>Not a till</td>
                  {sentCell(r)}
                </tr>
              );
            }
            if (r.kind === 'day' && !r.closed) {
              // A past day nobody closed (Jack, 11 Nov): its takings so far and a link to Close the day for it, as Today's "Close it".
              const past = r.past && r.closeDay;
              return (
                <tr key={`d${r.key}`}>
                  <th scope="row" className={`${DAY} font-semibold`}>{r.label}</th>
                  <td className={CELL}>{past ? `${money(r.takingsPence ?? 0)} so far` : '—'}</td><td className={CELL}>—</td><td className={CELL}>—</td>
                  <td className={CELL}>
                    {past ? (
                      <span className="inline-flex flex-wrap items-center justify-end gap-x-2">
                        Not closed
                        <Link to={`${ROUTES['eod-count']}?day=${r.closeDay}`} aria-label={`Close ${dayLabel(r.closeDay!)}`} className="inline-flex min-h-11 items-center font-semibold text-[var(--wh-ink)] underline">Close it</Link>
                      </span>
                    ) : 'Not closed yet'}
                  </td>
                  {sentCell(r)}
                </tr>
              );
            }
            const open = r.kind === 'day'
              ? <button type="button" onClick={() => onOpen(r.closeId)} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[var(--wh-ink)]">{r.label}<span aria-hidden="true" className="text-[var(--wh-muted)]">›</span></button>
              : <span className="font-semibold">{r.label}</span>;
            return (
              <tr key={`${r.kind}${r.key}`}>
                <th scope="row" className={DAY}>{open}</th>
                <td className={CELL}>{money(r.takingsPence)}</td><td className={CELL}>{money(r.bankedPence)}</td>
                <td className={CELL}><Difference pence={r.differencePence} /></td>
                <td className={CELL}>{r.kind === 'day' ? (r.reopened ? `${r.closedByName} · Reopened` : r.closedByName) : `${r.closedDays} closed days`}</td>
                {sentCell(r)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DayReport({ id, onClose }: { id: number; onClose: () => void }) {
  const [reopening, setReopening] = useState(false);
  const day = useQuery({ queryKey: ['reports-day', id], queryFn: () => apiGet<{ close: Close & { reopened?: { reason: string; byName: string; at: string } | null }; canReopen?: boolean }>(`/api/reports/days/${id}`), retry: false });
  if (day.isError) return <Refusal error={day.error} />;
  if (!day.data) return null;
  const { close, canReopen } = day.data;
  if (reopening) return <ReopenDialog id={id} day={close.day} onClose={() => setReopening(false)} onDone={() => { setReopening(false); onClose(); }} />;
  return <Report close={close} onClose={onClose} title={dayLabel(close.day).replace(/^(\w{3})\w*/, '$1')} sub={`Closed by ${close.closedByName} at ${clock(close.closedAt)}${close.reopened ? ` · reopened by ${close.reopened.byName}: “${close.reopened.reason}”` : ''}`} onDay actions={<span className="flex flex-wrap items-center gap-2">{canReopen ? <Button variant="default" className="min-h-11" onClick={() => setReopening(true)}>Reopen this day</Button> : null}<DownloadButton path={`/api/reports/days/${id}/csv`} /></span>} />;
}

export function TakingsReportPage() {
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? 'this-week';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const openDay = Number(params.get('day')) || null;
  const [picking, setPicking] = useState(false);
  const query = new URLSearchParams({ period, ...(period === 'dates' ? { from, to } : {}) }).toString();
  const takings = useQuery({ queryKey: ['reports-takings', query], queryFn: () => apiGet<Takings>(`/api/reports/takings?${query}`), retry: false });
  const report = takings.data;
  const keep = () => { const next: Record<string, string> = { period }; if (period === 'dates') { next.from = from; next.to = to; } return next; };

  return (
    <Page>
      <BackToReports />
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">Takings and cash-ups</h2>
          {report ? <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{report.shopLine} · {report.period.label}, against {report.period.against}</p> : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ChangeWhatsShown base="takings" period={new URLSearchParams(query)} />
          <DownloadButton path={`/api/reports/takings.csv?${query}`} />
        </div>
      </div>
      <PeriodChips value={picking ? 'dates' : period} onChange={(v) => (v === 'dates' ? setPicking(true) : setParams({ period: v }))} options={PERIODS} />
      {takings.isError ? <Refusal error={takings.error} /> : null}
      {report ? <Body report={report} onOpen={(id) => setParams({ ...keep(), day: String(id) })} period={period} /> : takings.isError ? null : <Note>Loading…</Note>}
      {picking && report ? (
        <PickDates subtitle={`Takings and cash-ups · ${report.shopLine}`} today={report.today} from={from || report.today} to={to || report.today}
          onClose={() => setPicking(false)} onShow={(a, b) => { setPicking(false); setParams({ period: 'dates', from: a, to: b }); }} />
      ) : null}
      {openDay ? <DayReport id={openDay} onClose={() => setParams(keep())} /> : null}
    </Page>
  );
}

function Body({ report, onOpen, period }: { report: Takings; onOpen: (id: number) => void; period: string }) {
  const showGraphs = useShowGraphs();
  const { figures: f, period: p } = report;
  const words = (g: Figures) => compareWords(g.diffPence, p.against, 'money');
  const title = 'Takings by closed day';
  const spoken = graphWords({ title, rows: report.bars, unitWord: p.unit === 'month' ? 'month' : 'day', diffPence: f.takings.diffPence, against: p.against });
  return (
    <>
      {report.reopened ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-size-15 leading-snug text-[var(--wh-warn-ink)]">
          <AlertCircle size={18} aria-hidden="true" />
          <span className="min-w-[260px] flex-1">{`${report.reopened.label} is reopened — its figures are left out until it’s closed again`}</span>
          <Link to={closeDayPath(report.reopened.day, report.today)} className="inline-flex min-h-11 items-center rounded-md border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3.5 text-sm font-semibold text-[var(--wh-ink)] no-underline">Close the day</Link>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-2">
        <Figure name="Closed days’ takings" value={money(f.takings.pence)} words={words(f.takings)} />
        <Figure name="Card" value={money(f.card.pence)} words={words(f.card)} />
        <Figure name="Cash" value={money(f.cash.pence)} words={words(f.cash)} />
        <Figure name="Other" value={money(f.other.pence)} words="Gift cards, store credit and customer accounts" />
        <Figure name="Online" value={money(f.online.pence)} words="Paid on the website · separate from the tills" />
        <Figure name="Cash differences" value={<Difference pence={f.cashDifference.pence} />} words={words(f.cashDifference)} />
      </div>
      {report.empty ? (
        <Box><div className="flex flex-col items-center gap-2 px-3 py-9 text-center"><span className="text-size-17 font-bold">No days closed in this period</span></div></Box>
      ) : (
        <Box>
          {showGraphs ? <ReportGraph title={title} rows={report.bars} kind={p.unit === 'month' ? 'line' : 'bars'} spoken={spoken}
            keyNow={KEY_NOW[period] ?? 'Closed days'} keyBefore={period === 'last-12-months' ? 'The 12 months before' : capital(p.against.replace(/^the /, ''))} showBefore={!report.nothingBefore} /> : null}
          <ClosedDays rows={report.rows} onOpen={onOpen} accounts={report.accounts} />
        </Box>
      )}
      <Note>Online is what customers paid on the website, from your payment provider. It’s separate from the tills: no till counts it, and it’s in no till’s close.</Note>
      <Note>Open a closed day for its end-of-day report. The owner can reopen the latest closed day from there, with a reason.</Note>
    </>
  );
}
