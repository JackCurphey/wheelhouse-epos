import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { marginText, money, mono, type ListRow } from './stock-bits.tsx';

/**
 * Change prices (drawn as st-prices in stock.mjs; stock control decisions 7, 11 and 12;
 * openspec/changes/bulk-price-change, design 5): a new price for each, up or down by a
 * percentage, or a target margin, rounded to an ending; each ticked product (each size of a
 * product with sizes) with Now, New and Margin before → after, as the server works them out;
 * nothing changes until Change. On a phone each product stacks.
 */
type How = 'each' | 'percent' | 'margin';
type Ending = 'leave' | '99' | '00';
type Preview = { id: number; name: string; sku: string | null; size: string | null; colour: string | null; nowPence: number; newPence: number; costPence: number | null; vatRateBp: number | null; belowCost: boolean; noCost: boolean };
export type Changed = { batchId: number; changed: number };

const HOWS: [How, string][] = [['each', 'A new price for each'], ['percent', 'Up or down by a percentage'], ['margin', 'A target margin']];
const ENDINGS: [Ending, string][] = [['leave', 'Leave as they are'], ['99', '.99'], ['00', '.00']];
const pillClass = (on: boolean) =>
  `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--input)] bg-[var(--wh-panel)]'}`;
const field = 'min-h-11 rounded-md border border-[var(--input)] bg-[var(--wh-panel)] px-2.5 text-size-15 text-[var(--wh-ink)]';
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 ? err.message : 'Wheelhouse couldn’t change the prices. Try again in a moment.');

// "+10", "10", "−5" or "12.5": a number to two places, or null.
function figure(text: string): number | null {
  const t = text.trim().replace('−', '-').replace(/^\+/, '');
  return /^-?\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null;
}
// Pounds as typed, "25" or "25.00", in whole pence; or null.
function pence(text: string): number | null {
  const t = text.trim().replace(/^£/, '');
  return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null;
}
const lineOf = (p: Preview) => [p.size ? `Size ${p.size}` : null, p.colour].filter(Boolean).join(' · ') || p.sku || '';
const after = (p: Preview) => marginText({ pricePence: p.newPence, costPence: p.costPence, vatRateBp: p.vatRateBp });
const before = (p: Preview) => marginText({ pricePence: p.nowPence, costPence: p.costPence, vatRateBp: p.vatRateBp });

/** "3 products", or "3 products from [Supplier]" when every ticked one shares a supplier (as drawn). */
function tickedText(rows: ListRow[]) {
  const n = `${rows.length} ${rows.length === 1 ? 'product' : 'products'}`;
  const suppliers = new Set(rows.map((r) => (r.kind === 'group' ? null : r.supplier)));
  const [only] = [...suppliers];
  return suppliers.size === 1 && only ? `${n} from ${only}` : n;
}

export function ChangePrices({ rows, onClose, onChanged }: { rows: ListRow[]; onClose: () => void; onChanged: (c: Changed) => void }) {
  const isPhone = useMedia('(max-width: 767px)');
  const [how, setHow] = useState<How>('percent');
  const [valueText, setValueText] = useState('');
  const [ending, setEnding] = useState<Ending>('99');
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ids = {
    productIds: rows.flatMap((r) => (r.kind === 'group' ? [] : [r.id])),
    groupIds: rows.flatMap((r) => (r.kind === 'group' ? [r.groupId] : [])),
  };
  const value = figure(valueText);
  const prices = Object.fromEntries(Object.entries(typed).map(([id, t]) => [id, pence(t)]).filter(([, p]) => p !== null));
  // The rule as it stands; until it's whole, the products as they are, to list them.
  const rule = how === 'each' ? { how, prices } : value === null ? { how: 'each' as const, prices: {} } : { how, value, ending };
  // Asked for once typing settles, as the search box is.
  const [settled, setSettled] = useState(JSON.stringify(rule));
  useEffect(() => {
    const t = setTimeout(() => setSettled(JSON.stringify(rule)), 300);
    return () => clearTimeout(t);
  });
  const preview = useQuery({
    queryKey: ['price-preview', ids, settled],
    queryFn: async () => (await apiMutate<{ products: Preview[] }>('/api/stock/prices/preview', { ...ids, ...JSON.parse(settled) })).products,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const ready = settled === JSON.stringify(rule) && !preview.isFetching && !preview.isError;
  const products = preview.data ?? [];
  const n = products.filter((p) => p.newPence !== p.nowPence).length;
  const why = how !== 'each' && value === null
    ? (how === 'percent' ? 'Type the percentage' : 'Type the target margin')
    : !ready ? null : n === 0 ? 'Nothing would change' : null;

  async function change() {
    if (why || busy || !ready) return;
    setBusy(true);
    setError('');
    try {
      onChanged(await apiMutate<Changed>('/api/stock/prices', { ...ids, ...rule }));
    } catch (err) {
      setError(words(err));
      setBusy(false);
    }
  }

  const newCell = (p: Preview) => (how === 'each' ? (
    <input inputMode="decimal" aria-label={`New price for ${p.name}${p.size || p.colour ? `, ${lineOf(p)}` : ''}`} placeholder={money(p.nowPence)}
      value={typed[p.id] ?? ''} onChange={(e) => setTyped({ ...typed, [p.id]: e.target.value })} className={`${field} w-[100px] text-right ${mono}`} />
  ) : <span className={`${mono} font-bold`}>{p.noCost ? money(p.nowPence) : money(p.newPence)}</span>);
  const tags = (p: Preview) => (
    <>
      {p.belowCost ? <span className="inline-flex min-h-[26px] items-center rounded-full bg-[var(--wh-warn-bg)] px-2.5 text-xs font-bold whitespace-nowrap text-[var(--wh-warn-ink)]">Below cost</span> : null}
      {p.noCost && how === 'margin' ? <span className="text-size-13 text-[var(--wh-muted)]">No cost recorded</span> : null}
    </>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="pr-title" className="md:max-w-[760px]">
      <DialogHeader className="flex-col items-start gap-1">
        <DialogTitle id="pr-title">Change prices</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{tickedText(rows)}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <RadioPillGroup aria-label="How" className="flex flex-wrap items-center gap-2">
          {HOWS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={how === k} onClick={() => setHow(k)} className={pillClass(how === k)}>{label}</button>)}
        </RadioPillGroup>
        {how === 'each' ? null : (
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-size-15 font-semibold">
              {how === 'percent' ? 'Change by' : 'Target margin'}
              <input inputMode="decimal" aria-label={how === 'percent' ? 'Percentage change' : 'Target margin'} placeholder={how === 'percent' ? '+10' : '40'}
                value={valueText} onChange={(e) => setValueText(e.target.value)} className={`${field} w-[90px] ${mono}`} />
              %
            </label>
            <RadioPillGroup aria-label="Prices end in" className="flex flex-wrap items-center gap-2">
              <span aria-hidden="true" className="mr-1 text-size-15 font-semibold">Prices end in</span>
              {ENDINGS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={ending === k} onClick={() => setEnding(k)} className={pillClass(ending === k)}>{label}</button>)}
            </RadioPillGroup>
          </div>
        )}
        {preview.isError ? <p role="alert" className="m-0 text-sm">{words(preview.error)}</p> : null}
        {products.length === 0 ? null : isPhone ? (
          <ul aria-label="Prices before and after" className="m-0 list-none p-0">
            {products.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 border-t border-[var(--wh-border)] py-2.5">
                <span className="text-size-15 font-semibold">{p.name}<span className="block text-size-13 font-normal text-[var(--wh-muted)]">{lineOf(p)}</span></span>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[var(--wh-muted)]">Now <span className={mono}>{money(p.nowPence)}</span></span>
                  <span aria-hidden="true" className="text-[var(--wh-muted)]">→</span>
                  <span>New {newCell(p)}</span>{tags(p)}
                </span>
                <span className="text-sm text-[var(--wh-muted)]">Margin {before(p)} → <strong className="text-[var(--wh-ink)]">{after(p)}</strong></span>
              </li>
            ))}
          </ul>
        ) : (
          <table aria-label="Prices before and after" className="w-full border-collapse">
            <thead>
              <tr className="text-size-13 text-[var(--wh-muted)]">
                <th scope="col" className="pb-1.5 text-left">Product</th><th scope="col" className="text-right">Now</th><th scope="col" className="text-right">New</th><th scope="col" className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="border-t border-[var(--wh-border)] py-2.5 text-left text-size-15 font-semibold">{p.name}<span className="block text-size-13 font-normal text-[var(--wh-muted)]">{lineOf(p)}</span></th>
                  <td className={`border-t border-[var(--wh-border)] py-2.5 text-right text-[var(--wh-muted)] ${mono}`}>{money(p.nowPence)}</td>
                  <td className="border-t border-[var(--wh-border)] py-2.5 text-right"><span className="inline-flex items-center gap-2">{tags(p)}{newCell(p)}</span></td>
                  <td className="border-t border-[var(--wh-border)] py-2.5 text-right text-sm text-[var(--wh-muted)]">{before(p)} → <strong className="text-[var(--wh-ink)]">{after(p)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">Nothing changes until you press Change. You can undo it straight after; each change goes into the product’s history.</p>
        {error ? <p role="alert" className="m-0 text-sm">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="items-start justify-between">
        <Button onClick={onClose}>Cancel</Button>
        <span className="flex flex-col items-end gap-1">
          <Button variant="primary" aria-disabled={why || busy || !ready ? true : undefined} aria-describedby={why ? 'pr-why' : undefined}
            className={why ? 'opacity-45' : undefined} onClick={change}>{`Change ${n} ${n === 1 ? 'price' : 'prices'}`}</Button>
          {why ? <span id="pr-why" className="text-size-13 text-[var(--wh-muted)]">{why}</span> : null}
        </span>
      </DialogFooter>
    </Dialog>
  );
}
