import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.tsx';
import { ItemSearch, type Picked, type Service } from '@/screens/diary/item-search.tsx';
import { PayDialog } from './pay-dialog.tsx';
import { lineSub, lineTotal, money, saleTotal, stockWarning, type TillLine } from './rules.ts';

/**
 * The till (journey 11, piece 1; drawn by
 * docs/design/user-journeys/generator/till.mjs): search or scan, the
 * Workshop quick buttons, the Sale basket, and Take payment.
 * Spec: docs/superpowers/specs/2026-10-03-till-sale-design.md
 *
 * Not here yet: discounts with a reason, notes, Park, a customer, quick
 * button groups the shop sets up, the VAT line, and receipts.
 */

let nextKey = 1;

/** `?job=` opens a workshop job's order to pay (Jack, 18 Oct). */
export function TillPage() {
  const [params, setParams] = useSearchParams();
  const jobId = Number(params.get('job')) || null;
  return jobId ? <JobTill key={jobId} jobId={jobId} onDone={() => setParams({})} /> : <SaleTill />;
}

function SaleTill() {
  const services = useQuery({ queryKey: ['workshop-services'], queryFn: () => apiGet<Service[]>('/api/workshop-services') });
  const [lines, setLines] = useState<TillLine[]>([]);
  const [editing, setEditing] = useState<TillLine | null>(null);
  const [paying, setPaying] = useState(false);
  const total = saleTotal(lines);

  function add(p: Picked) {
    if (p.type === 'service') {
      const s = p.service;
      setLines((ls) => [...ls, { key: nextKey++, kind: 'labour', name: s.name, unitPrice: s.price, usualPrice: s.price, qty: 1, serviceId: s.id, minutes: s.minutes }]);
      return;
    }
    const pr = p.product;
    setLines((ls) => {
      const same = ls.find((l) => l.kind === 'part' && l.productId === pr.id);
      if (same) return ls.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: nextKey++, kind: 'part', name: pr.name, unitPrice: pr.price, usualPrice: pr.price, qty: 1, productId: pr.id, sku: pr.sku, stockQty: pr.stockQty }];
    });
  }
  const change = (key: number, over: Partial<TillLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...over } : l)));
  const remove = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));
  const quick = (services.data ?? []).filter((s) => s.active);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="flex min-w-0 grow flex-col gap-3.5">
        <ItemSearch id="till-search" onPick={add} />
        <h2 className="m-0 text-xs font-bold tracking-[0.8px] text-[var(--wh-muted)] uppercase">Workshop</h2>
        <div role="group" aria-label="Workshop quick buttons" className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
          {quick.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => add({ type: 'service', service: s })}
              className="flex min-h-[104px] flex-col items-start justify-between gap-2 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-3.5 text-left hover:bg-[var(--wh-hover)]"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{s.name}</span>
                <span className="text-[13px] text-[var(--wh-muted)]">{s.minutes ? `Labour · ${s.minutes} min` : 'Labour'}</span>
              </span>
              <span className="font-mono text-base">{money(s.price)}</span>
            </button>
          ))}
          {services.isSuccess && quick.length === 0 ? (
            <p className="col-span-full m-0 text-sm text-[var(--wh-muted)]">No workshop services yet. Add them in Settings.</p>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="sale-title" className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] md:w-[380px]">
        <div className="flex items-center justify-between gap-2">
          <h2 id="sale-title" className="m-0 text-[17px] font-bold">Sale</h2>
          {lines.length ? <Button variant="ghost" size="sm" onClick={() => setLines([])}>Clear</Button> : null}
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center text-[var(--wh-muted)]">
            <span className="text-[15px] font-semibold text-[var(--wh-ink)]">Nothing in the sale yet</span>
            <span className="text-sm">Tap a quick button, search, or scan a barcode.</span>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {lines.map((l) => {
              const warn = stockWarning(l);
              return (
                <li key={l.key} className="flex flex-col gap-1.5 border-t border-[var(--wh-border)] py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <button type="button" onClick={() => setEditing(l)} className="flex min-h-11 flex-col items-start gap-0.5 text-left">
                      <span className="text-[15px] font-semibold">{l.name}</span>
                      <span className="text-[13px] text-[var(--wh-muted)]">{lineSub(l)}</span>
                    </button>
                    <span className="font-mono text-base">{money(lineTotal(l))}</span>
                  </div>
                  {l.kind === 'part' ? (
                    <div className="flex items-center justify-between">
                      <div role="group" aria-label={`Quantity of ${l.name}`} className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--wh-border)]">
                        <button type="button" aria-label={`One fewer ${l.name}`} disabled={l.qty <= 1} onClick={() => change(l.key, { qty: l.qty - 1 })} className="size-11 text-xl disabled:text-[var(--wh-muted)]">−</button>
                        <span className="min-w-9 text-center font-mono tabular-nums">{l.qty}</span>
                        <button type="button" aria-label={`One more ${l.name}`} onClick={() => change(l.key, { qty: l.qty + 1 })} className="size-11 text-xl">+</button>
                      </div>
                      {l.qty > 1 ? <span className="text-[13px] text-[var(--wh-muted)]">{`${money(l.unitPrice)} each`}</span> : null}
                    </div>
                  ) : null}
                  {warn ? (
                    <span className="self-start rounded-md bg-[var(--wh-warn-bg)] px-2 py-1 text-[13px] font-semibold text-[var(--wh-warn-ink)]">{warn}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-baseline justify-between border-t border-[var(--wh-border)] pt-3">
          <span className="text-base font-bold">Total</span>
          <span className="font-mono text-[26px]">{money(total)}</span>
        </div>
        <Button variant="primary" block disabled={lines.length === 0} onClick={() => setPaying(true)}>
          {lines.length ? `Take payment · ${money(total)}` : 'Take payment'}
        </Button>
      </section>

      {editing ? (
        <LineDialog
          line={editing}
          onClose={() => setEditing(null)}
          onSave={(unitPrice) => { change(editing.key, { unitPrice }); setEditing(null); }}
          onRemove={() => { remove(editing.key); setEditing(null); }}
        />
      ) : null}
      {paying ? (
        <PayDialog
          lines={lines}
          onClose={() => setPaying(false)}
          onNextSale={() => { setLines([]); setPaying(false); }}
        />
      ) : null}
    </div>
  );
}

/** Decision 3: tap a line for its price, or to take it out. */
function LineDialog({ line, onClose, onSave, onRemove }: { line: TillLine; onClose: () => void; onSave: (price: number) => void; onRemove: () => void }) {
  const [price, setPrice] = useState(line.unitPrice.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  function done() {
    const n = Number(price.replace('£', ''));
    if (price.trim() === '' || !Number.isFinite(n) || n < 0) { setError('Enter a price of £0.00 or more.'); return; }
    onSave(Math.round(n * 100) / 100);
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} aria-labelledby="line-title" aria-describedby="line-sub">
      <DialogHeader>
        <div className="min-w-0 grow">
          <DialogTitle id="line-title">{line.name}</DialogTitle>
          <DialogDescription id="line-sub">{lineSub(line)}</DialogDescription>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="line-price" className="text-sm font-semibold">Price each</label>
          <input
            id="line-price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') done(); }}
            aria-describedby="line-price-hint"
            className="min-h-11 w-40 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 font-mono"
          />
          <span id="line-price-hint" className="text-[13px] text-[var(--wh-muted)]">{`The usual price is ${money(line.usualPrice)}.`}</span>
          {error ? <span role="alert" className="text-[13px] text-[var(--wh-danger)]">{error}</span> : null}
        </div>
        <div><Button variant="danger" onClick={onRemove}>Remove from sale</Button></div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={done}>Done</Button>
      </DialogFooter>
    </Dialog>
  );
}

type OrderItem = { id: number; productId: number | null; name: string; sku?: string | null; unitPrice: number; qty: number; lineType: string | null; serviceId: number | null; minutes: number | null };
type Order = { id: number; status: string; items: OrderItem[] };
// The work can be paid for once it's under way or finished; paying work in
// progress finishes it (2026-10-08-paying-for-finished-work.md).
const PAYABLE = new Set(['in_progress', 'complete']);

/**
 * Paying a workshop job's order (Jack, 18 Oct, docs/decisions/2026-10-18-till-job-payment.md;
 * drawn as till-job): the job's agreed lines, locked, and "Bike collected
 * when paid", on by default (Workshop day decision 63). Paying converts the
 * order, then records the bike as collected unless the pill is off. Deposits,
 * the sign-off question and the job-changed warning come later; extras are
 * added on the job's Work and parts, since paying the order charges its lines.
 */
function JobTill({ jobId, onDone }: { jobId: number; onDone: () => void }) {
  const queryClient = useQueryClient();
  const jobQuery = useQuery({ queryKey: ['workshop-job', jobId], queryFn: () => apiGet<WorkshopJob>(`/api/workshop-jobs/${jobId}`) });
  const job = jobQuery.data;
  const orderQuery = useQuery({
    queryKey: ['sale-document', job?.orderId],
    queryFn: () => apiGet<Order>(`/api/sale-documents/${job?.orderId}`),
    enabled: Boolean(job?.orderId),
  });
  const order = orderQuery.data;
  const [collect, setCollect] = useState(true);
  const [paying, setPaying] = useState(false);
  const lines: TillLine[] = (order?.items ?? []).map((it, i) => ({
    key: i + 1,
    kind: it.lineType === 'labour' ? 'labour' : 'part',
    name: it.name,
    unitPrice: it.unitPrice,
    usualPrice: it.unitPrice,
    qty: it.qty,
    serviceId: it.serviceId ?? undefined,
    minutes: it.minutes,
    productId: it.productId ?? undefined,
    sku: it.sku ?? null,
  }));
  const total = saleTotal(lines);
  const inShop = job?.custodyState === 'in_shop';
  const paid = order ? order.status !== 'open' : false;
  const payable = job ? PAYABLE.has(job.workState) : false;

  // After paying: the bike goes out with the customer, unless the pill says it stays.
  async function afterPaid(): Promise<string | null> {
    await queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] });
    if (!collect || !inShop) return null;
    try {
      const fresh = await apiGet<WorkshopJob>(`/api/workshop-jobs/${jobId}`);
      if (fresh.custodyState !== 'in_shop') return null;
      await apiMutate(`/api/workshop-jobs/${jobId}/collect`, { version: fresh.version });
      await queryClient.invalidateQueries({ queryKey: ['workshop-job', jobId] });
      return null;
    } catch (err) {
      return `Paid, but the bike couldn’t be recorded as collected${err instanceof ApiError ? `: ${err.message}` : ''}. Hand it over from the job.`;
    }
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="flex min-w-0 grow flex-col gap-2 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] text-sm">
        <h2 className="m-0 text-[17px] font-bold">{job ? `Workshop job ${job.reference}` : 'Workshop job'}</h2>
        <p className="m-0 text-[var(--wh-muted)]">To add anything to this job, add it in the job’s Work and parts. Paying here pays the job’s order.</p>
        <div><Button variant="ghost" onClick={onDone}>Start a new sale instead</Button></div>
      </div>

      <section aria-labelledby="sale-title" className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] md:w-[380px]">
        <h2 id="sale-title" className="m-0 text-[17px] font-bold">Sale</h2>
        {jobQuery.isError || orderQuery.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this job. Try again in a moment.</p> : null}
        {job ? <span className="text-sm font-semibold">{`${job.customerName ?? 'No customer'} · workshop job ${job.reference}`}</span> : null}
        {job && !job.orderId ? <p className="m-0 text-sm">This job has no order to pay.</p> : null}
        {order ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {lines.map((l) => (
              <li key={l.key} className="flex items-baseline justify-between gap-3 border-t border-[var(--wh-border)] py-2.5">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{l.name}</span>
                  <span className="text-[13px] text-[var(--wh-muted)]">{`${lineSub(l)}${l.qty > 1 ? ` · ${l.qty} × ${money(l.unitPrice)}` : ''} · agreed on the job`}</span>
                </span>
                <span className="font-mono text-base">{money(lineTotal(l))}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {paid ? <p className="m-0 text-sm font-semibold">This job’s order is already paid.</p> : null}
        {order && !paid && !payable ? <p className="m-0 rounded-md bg-[var(--wh-warn-bg)] px-2 py-1 text-[13px] font-semibold text-[var(--wh-warn-ink)]">The work isn’t finished, so this job can’t be paid yet.</p> : null}
        {order && !paid && inShop ? (
          <button
            type="button"
            aria-pressed={collect}
            onClick={() => setCollect((c) => !c)}
            className={`inline-flex min-h-11 items-center gap-1.5 self-end rounded-full border px-4 text-sm font-semibold ${collect ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}
          >
            Bike collected when paid
          </button>
        ) : null}
        <div className="flex items-baseline justify-between border-t border-[var(--wh-border)] pt-3">
          <span className="text-base font-bold">Total</span>
          <span className="font-mono text-[26px]">{money(total)}</span>
        </div>
        {order && !paid ? (
          <Button variant="primary" block disabled={!payable || lines.length === 0} onClick={() => setPaying(true)}>{`Take payment · ${money(total)}`}</Button>
        ) : null}
      </section>
      {paying && job?.orderId ? (
        <PayDialog
          lines={lines}
          job={{ orderId: job.orderId, afterPaid }}
          onClose={() => setPaying(false)}
          onNextSale={() => { setPaying(false); onDone(); }}
        />
      ) : null}
    </div>
  );
}
