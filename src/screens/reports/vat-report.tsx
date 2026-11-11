import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { Box, BackToReports, BoxHeading, DownloadButton, Note, Page, Refusal } from './reports-bits.tsx';
import { money } from './reports-format.ts';
import { PickDates } from './pick-dates.tsx';

/**
 * VAT (rp-vat and rp-vat-first in generator/reports.mjs; decision 3;
 * openspec/changes/reports-ready-made, design 4 and 5): the till's sales by
 * VAT rate for the shop's VAT quarter against the quarter before, the old
 * record's sales on their own as "VAT not recorded", and a Stock purchases
 * box with no figure. No graph and no "Change what's shown". The first time,
 * it asks when the shop's VAT quarters start; Not now shows calendar quarters
 * for this visit and asks again next time.
 */
type Row = { rateBp: number; label: string; salesPence: number; vatPence: number; beforeVatPence: number };
export type VatReport = {
  period: { period: string; from: string; to: string; through: string; soFar: boolean; label: string; against: string };
  quarterStartMonth: 1 | 2 | 3 | null; needsQuarter: boolean;
  rows: Row[];
  total: { label: string; salesPence: number; vatPence: number; beforeVatPence: number };
  notRecorded: { label: string; takingsPence: number; beforeTakingsPence: number };
  shopLine: string; today: string;
};

const PERIODS = [
  { value: 'this-vat-quarter', label: 'This VAT quarter' },
  { value: 'last-vat-quarter', label: 'Last VAT quarter' },
  { value: 'dates', label: 'Pick dates' },
];
const PERIOD_WORDS: Record<string, string> = { 'this-vat-quarter': 'this VAT quarter, ', 'last-vat-quarter': 'last VAT quarter, ' };
const STARTS = ['January, April, July, October', 'February, May, August, November', 'March, June, September, December'];
const CHIP = 'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap max-md:whitespace-normal';
const ON = 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]';
const OFF = 'border-[var(--wh-border)] bg-[var(--wh-panel)]';

export function VatReportPage() {
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? 'this-vat-quarter';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [picking, setPicking] = useState(false);
  // Not now holds for this visit only, so the question comes back next time.
  const [notNow, setNotNow] = useState(false);
  const [saved, setSaved] = useState(false);
  const query = new URLSearchParams({ period, ...(period === 'dates' ? { from, to } : {}) }).toString();
  const vat = useQuery({ queryKey: ['reports-vat', query], queryFn: () => apiGet<VatReport>(`/api/reports/vat?${query}`), retry: false });
  const report = vat.data;

  function choose(value: string) {
    if (value === 'dates') { setPicking(true); return; }
    setParams({ period: value });
  }

  return (
    <Page>
      <BackToReports />
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">VAT</h2>
          {report ? <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{report.shopLine} · {PERIOD_WORDS[report.period.period] ?? ''}{report.period.label}, against {report.period.against}</p> : null}
        </div>
        <DownloadButton path={`/api/reports/vat.csv?${query}`} />
      </div>
      <PillGroup legend="Period" name="period" value={picking ? 'dates' : period} onChange={choose} options={PERIODS} />
      {vat.isError ? <Refusal error={vat.error} /> : null}
      {report && report.needsQuarter && notNow
        ? <Note>Showing calendar quarters (January, April, July, October) until you say when your VAT quarter starts.</Note> : null}
      {report ? <Body report={report} /> : vat.isError ? null : <Note>Loading…</Note>}
      {picking && report ? (
        <PickDates subtitle={`VAT · ${report.shopLine}`} today={report.today} from={from || report.today} to={to || report.today}
          onClose={() => setPicking(false)} onShow={(a, b) => { setPicking(false); setParams({ period: 'dates', from: a, to: b }); }} />
      ) : null}
      {report && report.needsQuarter && !notNow && !saved ? <QuarterQuestion onNotNow={() => setNotNow(true)} onSaved={() => setSaved(true)} /> : null}
    </Page>
  );
}

// rp-vat-first: asked once; Save keeps it on Shop details.
function QuarterQuestion({ onNotNow, onSaved }: { onNotNow: () => void; onSaved: () => void }) {
  const client = useQueryClient();
  const [month, setMonth] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  async function save() {
    setBusy(true); setFailed(null);
    try {
      await apiMutate('/api/shop-details', { vatQuarterStartMonth: month }, { method: 'PUT' });
      await Promise.all([client.invalidateQueries({ queryKey: ['reports-vat'] }), client.invalidateQueries({ queryKey: ['shop-details'] })]);
      onSaved();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'That didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onNotNow(); }} aria-labelledby="vq-title" className="md:max-w-[560px]">
      <DialogHeader>
        <div><DialogTitle id="vq-title">When does your VAT quarter start?</DialogTitle><DialogDescription>Asked once. Change it later in Settings › Shop and sites.</DialogDescription></div>
        <DialogClose onClick={onNotNow} />
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <RadioPillGroup aria-label="Months your VAT quarters start" className="flex flex-col items-start gap-1.5">
          {STARTS.map((words, i) => {
            const value = (i + 1) as 1 | 2 | 3;
            return <button key={words} type="button" role="radio" aria-checked={month === value} onClick={() => setMonth(value)} className={`${CHIP} ${month === value ? ON : OFF}`}>{words}</button>;
          })}
        </RadioPillGroup>
        <Note>It’s on your VAT registration, or ask your accountant.</Note>
        {failed ? <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-sm font-semibold">{failed}</p> : null}
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button variant="ghost" onClick={onNotNow}>Not now</Button>
        <Button variant="primary" onClick={save} disabled={busy}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}

const HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-xs font-bold text-[var(--wh-muted)] max-md:whitespace-normal max-md:px-1';
const CELL = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-right whitespace-nowrap max-md:px-1';
const ROW_HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-left font-semibold whitespace-nowrap max-md:px-1';
const TOTAL = 'px-1.5 py-2.5 max-md:px-1';

function Table({ label, columns, rows, total }: { label: string; columns: string[]; rows: string[][]; total?: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-sm max-md:text-size-13">
        <thead><tr>{columns.map((c, i) => <th key={c} scope="col" className={`${HEAD} ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map(([name, ...cells]) => (
            <tr key={name}><th scope="row" className={ROW_HEAD}>{name}</th>{cells.map((c, i) => <td key={i} className={CELL}>{c}</td>)}</tr>
          ))}
          {total ? (
            <tr className="font-bold"><th scope="row" className={`${TOTAL} text-left`}>{total[0]}</th>{total.slice(1).map((c, i) => <td key={i} className={`${TOTAL} text-right`}>{c}</td>)}</tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Body({ report }: { report: VatReport }) {
  const { total: t, notRecorded: n } = report;
  return (
    <>
      <Box label="Sales">
        <BoxHeading>Sales</BoxHeading>
        <Table label="VAT on sales by rate" columns={['Rate', 'Sales before VAT', 'VAT charged', 'Quarter before']}
          rows={report.rows.map((r) => [r.label, money(r.salesPence), money(r.vatPence), money(r.beforeVatPence)])}
          total={[t.label, money(t.salesPence), money(t.vatPence), money(t.beforeVatPence)]} />
        <Table label="Sales without their VAT" columns={['Sales', 'Takings including VAT', 'Quarter before']}
          rows={[[n.label, money(n.takingsPence), money(n.beforeTakingsPence)]]} />
        <Note>These sales were made before Wheelhouse kept VAT on each sale. Take their VAT from your accounts software or ask your accountant.</Note>
      </Box>
      <Box label="Stock purchases">
        <BoxHeading>Stock purchases</BoxHeading>
        <p role="note" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3 py-2.5 text-sm text-[var(--wh-warn-ink)]"><strong>Stock purchases only — not your full VAT reclaim.</strong> Rent, bills and other costs don’t go through Wheelhouse.</p>
        <p className="m-0 text-size-15 max-md:text-sm">Supplier invoices are checked in your accounts software — take this figure from there.</p>
      </Box>
      <Note>No graph here: these are the exact figures your accountant needs. Wheelhouse doesn’t file your VAT return — file it from your accounts software, or send this to your accountant.</Note>
    </>
  );
}
