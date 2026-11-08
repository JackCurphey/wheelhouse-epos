import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Count } from './new-order.tsx';
import { Back, Card, Page, Row, linkClass, orderHref } from './deliveries-bits.tsx';

/**
 * The restock list (rs-restock, rs-restock-customers in receiving.mjs; receiving decision 2,
 * audit M6 and H2, walk-through 3 M1; openspec/changes/restock-list design 5): what's running
 * low, selling fast or waited for by a job, a group per supplier (a basket file is per
 * supplier), every line ticked with its count, then Add to an order or Download for that
 * supplier's basket. The Owner's until roles, as orders are.
 */
export type RestockJob = { jobId: number; ref: string | null; customer: string | null; promised: string; qty: number };
export type RestockLine = { productId: number; name: string; sku: string; barcode: string; stock: number; sold: number; low: boolean; fast: boolean; suggested: number; jobs: RestockJob[] };
export type RestockGroup = { supplier: string; supplierId: number | null; lines: RestockLine[] };
export type Restock = { days: number; groups: RestockGroup[]; counts: { low: number; fast: number; customers: number }; newCount: number; newForJobs: number };

export const restockHref = (show?: Show) => `${ROUTES['rs-restock']}${show && show !== 'all' ? `?show=${show}` : ''}`;
export const useRestock = (enabled: boolean) => useQuery({ queryKey: ['restock'], queryFn: () => apiGet<Restock>('/api/restock'), enabled });

type Show = 'all' | 'low' | 'fast' | 'customers';
const PILLS: { value: Show; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'low', label: 'Running low' }, { value: 'fast', label: 'Selling fast' }, { value: 'customers', label: 'For customers' },
];
// One row on screen: a product (All, Running low, Selling fast), or one job's need (For customers).
type Shown = { key: string; line: RestockLine; job: RestockJob | null; count: number };
const totalFor = (l: RestockLine) => l.suggested + l.jobs.reduce((n, j) => n + j.qty, 0);

// "Sat 19 Sep", the job's day as the drawing writes it (three letters for the month).
const promisedDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', ...o });
  return `${p({ weekday: 'short' })} ${p({ day: 'numeric' })} ${p({ month: 'short' }).slice(0, 3)}`;
};
const jobWords = (j: RestockJob) => [`for job ${j.ref ?? ''}`.trim(), j.customer, `promised ${promisedDay(j.promised)}`].filter(Boolean).join(' · ');

function rowsFor(group: RestockGroup, show: Show): Shown[] {
  if (show === 'customers') return group.lines.flatMap((l) => l.jobs.map((j) => ({ key: `job:${j.jobId}:${l.productId}`, line: l, job: j, count: j.qty })));
  return group.lines
    .filter((l) => (show === 'low' ? l.low : show === 'fast' ? l.fast : true))
    .map((l) => ({ key: `p:${l.productId}`, line: l, job: null, count: totalFor(l) }));
}

// What Add to an order sends for a row at its count: a job's line takes the job's shortfall first,
// with its job; the rest is a plain line (design 5).
function orderLines(rows: Shown[], counts: Map<string, number>) {
  const out: { productId: number; qty: number; forJobId?: number }[] = [];
  for (const r of rows) {
    let left = counts.get(r.key) ?? r.count;
    const jobs = r.job ? [r.job] : r.line.jobs;
    for (const j of jobs) {
      const qty = Math.min(left, j.qty);
      if (qty > 0) out.push({ productId: r.line.productId, qty, forJobId: j.jobId });
      left -= qty;
    }
    if (left > 0) out.push({ productId: r.line.productId, qty: left });
  }
  return out;
}

// On a phone, stock and sales sit under the name with the count beneath (decision 11).
const COLS = 'md:grid-cols-[44px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]';
const muted = 'text-[var(--wh-muted)]';

function Tick({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="inline-flex size-11 shrink-0 items-center justify-center">
      <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} className="m-0 size-5 accent-[var(--wh-accent)]" />
    </label>
  );
}

function SupplierGroup({ group, show }: { group: RestockGroup; show: Show }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rows = rowsFor(group, show);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (rows.length === 0) return null;

  const ticked = rows.filter((r) => !off.has(r.key));
  const allTicked = ticked.length === rows.length;
  const id = `g-${group.supplier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const toggle = (key: string) => setOff((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleAll = () => setOff(allTicked ? new Set(rows.map((r) => r.key)) : new Set());
  const fail = (err: unknown, what: string) => setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : `Wheelhouse couldn’t ${what}. Try again in a moment.`);

  async function addToOrder() {
    if (ticked.length === 0 || group.supplierId === null) return;
    setBusy(true);
    setProblem(null);
    try {
      const made = await apiMutate<{ orderId: number }>('/api/restock/add-to-order', { supplierId: group.supplierId, lines: orderLines(ticked, counts) });
      void queryClient.invalidateQueries({ queryKey: ['restock'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      navigate(orderHref(made.orderId));
    } catch (err) {
      fail(err, 'add them to an order');
      setBusy(false);
    }
  }

  async function download() {
    if (ticked.length === 0) return;
    setBusy(true);
    setProblem(null);
    try {
      // The ticked rows, one line per product at its count.
      const lines = new Map<number, number>();
      for (const r of ticked) lines.set(r.line.productId, (lines.get(r.line.productId) ?? 0) + (counts.get(r.key) ?? r.count));
      const res = await fetch('/api/restock/download', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ supplier: group.supplier, lines: [...lines].map(([productId, qty]) => ({ productId, qty })) }),
      });
      if (!res.ok) throw new Error(`restock download: ${res.status}`);
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'restock.csv';
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      void queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
    } catch (err) {
      fail(err, 'make the file');
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby={id} className="flex flex-col gap-1 pt-1.5">
      <div className="flex items-center gap-3">
        <Tick label={`Include everything from ${group.supplier}`} checked={allTicked} onChange={toggleAll} />
        <h3 id={id} className="m-0 text-base font-bold">{group.supplier}</h3>
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((r) => {
          const { line: l, job } = r;
          const reorder = `Reorder ${l.name}`;
          const stock = `${l.stock}${l.low ? ' · low' : ''}`;
          const sold = `${l.sold}${l.fast ? ' · fast' : ''}`;
          const count = <Count name={reorder} value={counts.get(r.key) ?? r.count} onChange={(n) => setCounts((m) => new Map(m).set(r.key, n))} />;
          const code = job
            ? <>{l.sku ? `${l.sku} · ` : ''}<strong className="text-[var(--wh-ink)]">{jobWords(job)}</strong></>
            : [l.sku, l.jobs.length ? l.jobs.map((j) => `for job ${j.ref ?? ''}`.trim()).join(', ') : ''].filter(Boolean).join(' · ');
          return (
            <li key={r.key} className={`grid min-h-14 grid-cols-[44px_1fr] items-center gap-x-3 border-t border-[var(--wh-border)] ${COLS}`}>
              <Tick label={`Include ${l.name}`} checked={!off.has(r.key)} onChange={() => toggle(r.key)} />
              <span className="flex min-w-0 flex-col gap-0.5 py-1.5">
                <span className="text-size-15 font-semibold">{l.name}</span>
                <span className={`text-size-13 ${muted}`}>{code}<span className="md:hidden">{` · in stock ${stock} · sold ${sold}`}</span></span>
              </span>
              <span className="hidden text-sm md:inline"><span className="sr-only">In stock: </span>{stock}</span>
              <span className="hidden text-sm md:inline"><span className="sr-only">Sold, last 28 days: </span>{sold}</span>
              <span className="col-start-2 pb-2 md:col-start-auto md:pb-0">{count}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
        <span className={`text-sm ${muted}`}>{`${ticked.length} ticked`}</span>
        <span className="flex flex-wrap items-center gap-2">
          {group.supplierId === null
            ? <span className={`text-sm ${muted}`}>{`${group.supplier} isn’t in your suppliers yet`}</span>
            : <Button variant="default" disabled={busy || ticked.length === 0} onClick={() => void addToOrder()}>Add to an order</Button>}
          <Button variant="default" disabled={busy || ticked.length === 0} onClick={() => void download()}>{`Download for ${group.supplier}’s basket`}</Button>
        </span>
      </div>
      {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
    </section>
  );
}

export function RestockPage() {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const [params] = useSearchParams();
  const asked = params.get('show');
  const [show, setShow] = useState<Show>(PILLS.some((p) => p.value === asked) ? (asked as Show) : 'all');
  const list = useRestock(owner);
  const queryClient = useQueryClient();
  // Opening the list clears Today's restock line (audit M11): said once the list is open.
  useEffect(() => {
    if (!owner) return;
    void apiMutate('/api/restock/seen', {}).then(() => queryClient.invalidateQueries({ queryKey: ['needs-attention'] }), () => {});
  }, [owner, queryClient]);
  const groups = useMemo(() => list.data?.groups ?? [], [list.data]);

  if (session.status !== 'signed-in') return null;
  if (!owner) return <Page><Back /><p className="m-0 text-sm text-[var(--wh-muted)]">The restock list is for the shop’s owner for now.</p></Page>;
  const anything = groups.some((g) => rowsFor(g, show).length > 0);
  return (
    <Page>
      <Back />
      <Card id="t-tick-what-to-reorder" title="Tick what to reorder">
        <p className="m-0 text-sm text-[var(--wh-muted)]">Running low, selling faster than usual, or waited for by a job or an online order. Tick what to reorder, then download it for that supplier’s website basket — or add it to an order.</p>
        <PillGroup legend="Show" value={show} onChange={(v) => setShow(v as Show)} options={PILLS} />
        {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the restock list. Try again in a moment.</p>
          : !list.data ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
          : !anything ? <p className="m-0 text-sm text-[var(--wh-muted)]">Nothing to reorder.</p>
          : (
            <>
              <div aria-hidden="true" className={`hidden gap-3 text-size-13 font-bold md:grid ${muted} ${COLS}`}>
                <span /><span>Product</span><span>In stock</span><span>{`Sold, last ${list.data.days} days`}</span><span className="w-[140px]">Reorder</span>
              </div>
              {/* A group's ticks and counts are its own, kept while the pill changes (keyed by pill). */}
              {groups.map((g) => <SupplierGroup key={`${show}:${g.supplierId ?? g.supplier}`} group={g} show={show} />)}
              {show === 'customers' ? <p className="m-0 text-sm text-[var(--wh-muted)]">“Add to an order” keeps who each line is for on the order line — “for job WH-1042”.</p> : null}
            </>
          )}
        <p className="m-0 text-sm text-[var(--wh-muted)]">Downloads a CSV file: supplier code, quantity, product and barcode, a line each — check it suits each supplier’s basket upload.</p>
      </Card>
    </Page>
  );
}

/** Deliveries and orders' Restock list section (rs-hub; audit M1: after To return, before Orders). */
export function RestockSection() {
  const list = useRestock(true);
  const n = (k: keyof Restock['counts']) => list.data?.counts[k] ?? 0;
  const products = (k: keyof Restock['counts']) => `${n(k)} ${n(k) === 1 ? 'product' : 'products'}`;
  const row = (title: string, sub: string, show: Show, label: string) => (
    <Row title={title} sub={list.data ? sub : 'Loading…'}>
      <Link to={restockHref(show)} className={linkClass} aria-label={label}>See the list</Link>
    </Row>
  );
  return (
    <Card id="t-restock-list" title="Restock list">
      {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the restock list. Try again in a moment.</p> : (
        <ul aria-labelledby="t-restock-list" className="m-0 list-none p-0">
          {row('Running low', `${products('low')} at or under their low-stock level`, 'low', 'See the list of products running low')}
          {row('Selling fast', `${products('fast')} sold more than usual in the last ${list.data?.days ?? 28} days`, 'fast', 'See the list of products selling fast')}
          {row('For customers', `${products('customers')} a job is waiting for, or an online order is ordering in`, 'customers', 'See the list of products for customers')}
        </ul>
      )}
    </Card>
  );
}
