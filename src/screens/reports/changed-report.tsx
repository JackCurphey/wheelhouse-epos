import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { useShowGraphs } from '@/lib/your-settings.ts';
import { Box, BackToReports, DownloadButton, Note, Page, PeriodChips, Refusal } from './reports-bits.tsx';
import { count, money } from './reports-format.ts';
import { ReportGraph } from './report-graph.tsx';
import { PickDates } from './pick-dates.tsx';
import { ChangeWhatsShown } from './change-panel.tsx';
import { SaveReportDialog } from './save-report-dialog.tsx';
import { Button } from '@/components/ui/button';
import { PERIODS } from './sales-report.tsx';
import { BASE_LABEL, BASE_PATH, type ChangedReport } from './changed-format.ts';

/**
 * A changed report (rp-changed in generator/reports.mjs; openspec/changes/reports-your-own,
 * decisions 5 and 6): the title from what's chosen, the line under it saying what it was
 * changed from, what it's limited to and the period, a bar saying it has been changed, the
 * period chips, a graph that follows Your settings' "Show graphs", and a table of the split,
 * the measure and (for Items sold) Takings, with a total row. Its choices and period are in
 * its address, so Back and a bookmark work.
 */
const KEY_NOW: Record<string, string> = {
  today: 'Today so far', 'this-week': 'This week so far', 'this-month': 'This month so far', 'last-month': 'Last month',
  'last-12-months': 'Last 12 months', dates: 'These dates',
};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The graph and table are named by what they show, as the drawing has it ("Items sold by product"), without the report's name.
const shortTitle = (report: ChangedReport) => report.title.replace(/^[^:]+: /, '').replace(/^./, (c) => c.toUpperCase());

const spokenFor = (report: ChangedReport): string => {
  const reached = report.rows.filter((r) => !r.notReached && r.value !== null);
  const top = reached.reduce<(typeof reached)[number] | null>((best, r) => (best === null || (r.value ?? 0) > (best.value ?? 0) ? r : best), null);
  const parts: string[] = [];
  if (top && (top.value ?? 0) > 0) {
    parts.push(report.measure === 'items' ? `most sold ${top.label}` : report.split === 'day' || report.split === 'week' ? `busiest ${report.split} ${top.label}` : `biggest ${top.label}`);
  }
  const diff = report.figures.diffValue;
  if (diff !== null) {
    const size = report.measure === 'items' ? String(Math.abs(diff)) : money(Math.abs(diff));
    parts.push(diff === 0 ? `no change on ${report.period.against}` : `${diff > 0 ? 'up' : 'down'} ${size} on ${report.period.against}`);
  }
  return `${shortTitle(report)}: ${parts.join('; ') || 'nothing sold'}. The figures are in the table below.`;
};

function ChangedTable({ report }: { report: ChangedReport }) {
  const cell = 'border-b border-[var(--wh-border)] px-2 py-2.5 max-md:px-1 max-md:text-size-13';
  const head = 'border-b-2 border-[var(--wh-border)] px-2 py-2 text-size-13-5 font-semibold max-md:whitespace-normal max-md:px-1';
  const money_ = report.measure === 'takings' || report.measure === 'margin';
  const show = (v: number | null) => (v === null ? '—' : money_ ? money(v) : count(v));
  const items = report.measure !== 'takings'; // Takings sits beside any other measure
  return (
    <div className="overflow-x-auto">
      <table aria-label={shortTitle(report)} className="w-full border-collapse text-sm max-md:text-size-13">
        <thead><tr>
          {report.columns.map((c, i) => <th key={c} scope="col" className={`${head} ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>)}
        </tr></thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className={`${cell} text-left font-semibold`}>{r.label}</th>
              <td className={`${cell} text-right`}>{show(r.value)}</td>
              {items ? <td className={`${cell} text-right`}>{money(r.takingsPence)}</td> : null}
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="font-bold">
          <th scope="row" className="px-2 py-2.5 text-left max-md:px-1">{report.total.label}</th>
          <td className="px-2 py-2.5 text-right max-md:px-1">{show(report.total.value)}</td>
          {items ? <td className="px-2 py-2.5 text-right max-md:px-1">{money(report.total.takingsPence)}</td> : null}
        </tr></tfoot>
      </table>
    </div>
  );
}

export function ChangedReportPage() {
  const [params, setParams] = useSearchParams();
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ name: string; query: string } | null>(null);
  const base = params.get('base') === 'takings' ? 'takings' : 'sales';
  const period = params.get('period') ?? 'this-week';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const periodParams = new URLSearchParams({ period, ...(period === 'dates' ? { from, to } : {}) });
  const query = params.toString();
  // The bar says it is saved only while the report on screen is the one that was saved.
  const savedAs = saved && saved.query === query ? saved.name : null;
  const answer = useQuery({ queryKey: ['reports-changed', query], queryFn: () => apiGet<ChangedReport>(`/api/reports/changed?${query}`), retry: false });
  const report = answer.data;

  // A new period keeps everything else chosen; Day is too many bars for a year or a long range, so it becomes Week.
  function showPeriod(next: URLSearchParams) {
    const p = next.get('period');
    const days = p === 'dates' ? (Date.parse(next.get('to') ?? '') - Date.parse(next.get('from') ?? '')) / 86400000 + 1 : 0;
    if (next.get('split') === 'day' && (p === 'last-12-months' || days > 62)) next.set('split', 'week');
    setParams(next);
  }
  const withPeriod = (next: Record<string, string>) => {
    const out = new URLSearchParams(params);
    for (const k of ['period', 'from', 'to']) out.delete(k);
    for (const [k, v] of Object.entries(next)) out.set(k, v);
    showPeriod(out);
  };
  function choose(value: string) {
    if (value === 'dates') { setPicking(true); return; }
    withPeriod({ period: value });
  }
  const showGraphs = useShowGraphs();
  const own = { measure: params.get('measure') ?? undefined, split: params.get('split') ?? undefined, only: params.getAll('only'), supplier: params.get('supplier') ?? '' };

  return (
    <Page>
      <BackToReports />
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">{report?.title ?? 'Changed report'}</h2>
          {report ? <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{report.line}</p> : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ChangeWhatsShown base={base} period={periodParams} initial={own} />
          <DownloadButton path={`/api/reports/changed.csv?${query}`} />
        </div>
      </div>
      <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--wh-surface-muted)] px-3.5 py-2.5 text-size-15 leading-snug">
        <Check size={18} aria-hidden="true" />
        <span className="min-w-[260px] flex-1">{savedAs ? `Saved as “${savedAs}”. It is in Your reports on the Reports page.` : 'You’ve changed this report. Save it to come back to it.'}</span>
        {savedAs ? null : <Button variant="primary" className="min-h-11" onClick={() => setSaving(true)} disabled={!report}>Save as my report</Button>}
        <Link to={`${BASE_PATH[base]}?${periodParams.toString()}`} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-[var(--wh-ink)] underline">Back to {BASE_LABEL[base]}</Link>
      </div>
      <PeriodChips value={picking ? 'dates' : period} onChange={choose} options={PERIODS} />
      {answer.isError ? <Refusal error={answer.error} /> : null}
      {report ? (
        report.empty ? (
          <Box><div className="flex flex-col items-center gap-2 px-3 py-9 text-center"><span className="text-size-17 font-bold">Nothing sold in this period</span><Note>Nothing matches what you chose for these dates.</Note></div></Box>
        ) : (
          <Box>
            {showGraphs ? (
              <ReportGraph
                title={shortTitle(report)} kind="bars" scale={report.measure === 'items' ? 'count' : 'money'} spoken={spokenFor(report)} showBefore={report.showBefore}
                keyNow={KEY_NOW[period] ?? 'This period'} keyBefore={period === 'last-12-months' ? 'The 12 months before' : capital(report.period.against.replace(/^the /, ''))}
                rows={report.rows.map((r) => ({ key: r.key, label: r.label, notReached: Boolean(r.notReached), takingsPence: r.value, beforeTakingsPence: r.beforeValue ?? 0 }))}
              />
            ) : null}
            <ChangedTable report={report} />
          </Box>
        )
      ) : answer.isError ? null : <Note>Loading…</Note>}
      {saving && report ? (
        <SaveReportDialog
          what={[report.title, ...(report.line.split(' · ').slice(1, -1))].join(' · ')}
          report={{ base: report.base, measure: report.measure, split: report.split, only: report.only, supplier: report.supplier, period }}
          onClose={() => setSaving(false)} onSaved={(s) => { setSaving(false); setSaved({ name: s.name, query }); }}
        />
      ) : null}
      {picking ? (
        <PickDates subtitle={`${BASE_LABEL[base]} · ${report?.shopLine ?? ''}`} today={report?.today ?? ''} from={from || report?.today || ''} to={to || report?.today || ''}
          onClose={() => setPicking(false)} onShow={(a, b) => { setPicking(false); withPeriod({ period: 'dates', from: a, to: b }); }} />
      ) : null}
    </Page>
  );
}
