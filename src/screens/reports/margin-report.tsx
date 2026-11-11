import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Box, BackToReports, BoxHeading, DownloadButton, Note, Page, Refusal } from './reports-bits.tsx';
import { count, money } from './reports-format.ts';
import { PickDates } from './pick-dates.tsx';
import { PERIODS } from './sales-report.tsx';

/**
 * Margin and stock value (rp-margin in generator/reports.mjs; decision 5;
 * openspec/changes/reports-ready-made, design 6), its stock half: what's on
 * the shelves today at what it cost, by the top of its Stockroom category,
 * and the stock written off in the period by stock takes and each adjustment
 * reason. The margin figures, graph and labour line come with PR 5.
 */
type Row = { label: string; items: number; valuePence: number };
type Written = Row & { key: string };
export type StockReport = {
  period: { period: string; from: string; to: string; through: string; soFar: boolean; label: string };
  stock: { rows: Row[]; all: { items: number; valuePence: number }; noCostProducts: number };
  writtenOff: { rows: Written[]; all: { items: number; valuePence: number } };
  shopLine: string; today: string;
};

// The written-off note names the period chosen (the drawing words it for This week).
const PERIOD_WORDS: Record<string, string> = {
  today: 'today', 'this-week': 'this week', 'this-month': 'this month', 'last-month': 'last month',
  'last-12-months': 'in the last 12 months', dates: 'on these dates',
};
// Stock takes open the Stock take page; "See the products" waits for a stock
// history filtered by reason, so those rows have no link yet.
const COUNTS: Record<string, string> = { 'counted-under': 'See the stock takes counted under', 'counted-over': 'See the stock takes counted over' };
// −£ when stock went, +£ when it came back, as the drawing signs them.
const signed = (pence: number) => (pence < 0 ? `−${money(-pence)}` : pence > 0 ? `+${money(pence)}` : money(0));
const noCostLine = (n: number) => (n === 1
  ? '1 product on the shelves has no cost, so it isn’t in this'
  : `${n} products on the shelves have no cost, so they aren’t in this`);

const HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-xs font-bold text-[var(--wh-muted)] max-md:whitespace-normal max-md:px-1';
const CELL = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-right whitespace-nowrap max-md:px-1';
const ROW_HEAD = 'border-b border-[var(--wh-border)] px-1.5 py-2 text-left font-semibold max-md:px-1';
const TOTAL = 'px-1.5 py-2.5 whitespace-nowrap max-md:px-1';

// left: columns set as text, as the drawing's table() marks them (the links column).
function Table({ label, columns, rows, total, left = [] }: { label: string; columns: string[]; rows: React.ReactNode[][]; total: string[]; left?: number[] }) {
  const align = (i: number) => (i === 0 || left.includes(i) ? 'text-left' : 'text-right');
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-sm max-md:text-size-13">
        <thead><tr>{columns.map((c, i) => <th key={i} scope="col" className={`${HEAD} ${align(i)}`}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map(([name, ...cells], r) => (
            <tr key={r}><th scope="row" className={ROW_HEAD}>{name}</th>{cells.map((c, i) => <td key={i} className={`${CELL} ${align(i + 1)}`}>{c}</td>)}</tr>
          ))}
          <tr className="font-bold"><th scope="row" className={`${TOTAL} text-left`}>{total[0]}</th>{total.slice(1).map((c, i) => <td key={i} className={`${TOTAL} ${align(i + 1)}`}>{c}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

export function MarginReportPage() {
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? 'this-week';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [picking, setPicking] = useState(false);
  const query = new URLSearchParams({ period, ...(period === 'dates' ? { from, to } : {}) }).toString();
  const stock = useQuery({ queryKey: ['reports-margin', query], queryFn: () => apiGet<StockReport>(`/api/reports/margin?${query}`), retry: false });
  const report = stock.data;

  function choose(value: string) {
    if (value === 'dates') { setPicking(true); return; }
    setParams({ period: value });
  }

  return (
    <Page>
      <BackToReports />
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">Margin and stock value</h2>
          {report ? <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{report.shopLine} · {report.period.label}</p> : null}
        </div>
        <DownloadButton path={`/api/reports/margin.csv?${query}`} />
      </div>
      <PillGroup legend="Period" name="period" value={picking ? 'dates' : period} onChange={choose} options={PERIODS} />
      {stock.isError ? <Refusal error={stock.error} /> : null}
      {report ? <Body report={report} /> : stock.isError ? null : <Note>Loading…</Note>}
      {picking && report ? (
        <PickDates subtitle={`Margin and stock value · ${report.shopLine}`} today={report.today} from={from || report.today} to={to || report.today}
          onClose={() => setPicking(false)} onShow={(a, b) => { setPicking(false); setParams({ period: 'dates', from: a, to: b }); }} />
      ) : null}
    </Page>
  );
}

function Body({ report }: { report: StockReport }) {
  const { stock, writtenOff } = report;
  return (
    <>
      <Box label="On the shelves today">
        <BoxHeading>On the shelves today</BoxHeading>
        <p className="m-0 text-size-15">Stock value, at what it cost you: <span className="font-mono font-bold">{money(stock.all.valuePence)}</span></p>
        {stock.noCostProducts > 0 ? <Note>{noCostLine(stock.noCostProducts)}</Note> : null}
        <Table label="Stock value by category" columns={['Category', 'Items', 'What it cost you']}
          rows={stock.rows.map((r) => [r.label, count(r.items), money(r.valuePence)])}
          total={['All', count(stock.all.items), money(stock.all.valuePence)]} />
      </Box>
      <Box label="Stock written off">
        <BoxHeading>Stock written off</BoxHeading>
        <Note>Stock takes and adjustments {PERIOD_WORDS[report.period.period] ?? 'in this period'}, at what it cost you.</Note>
        <Table label="Stock written off" columns={['Why', 'Items', 'At cost', '']}
          rows={writtenOff.rows.map((r) => [r.label, count(r.items), signed(r.valuePence), COUNTS[r.key]
            ? <Link to={ROUTES.stocktake} aria-label={COUNTS[r.key]} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-[var(--wh-ink)] underline">See the counts</Link>
            : null])}
          total={['All', count(writtenOff.all.items), signed(writtenOff.all.valuePence), '']} left={[3]} />
      </Box>
    </>
  );
}
