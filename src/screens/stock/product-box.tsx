import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { detailsFor, useCategoryList, type Detail } from './stock-list-bits.tsx';
import { mono, type Product } from './stock-bits.tsx';

/**
 * The product box (openspec/changes/product-page-sizes, design 2): adds a product and edits
 * one, with the fields rs-add-product draws (Name and Supplier code; Cost, Price and Low-stock
 * level; Category and its details; stock control decision 10), and Barcode and Supplier, which
 * a product's page shows. Money is typed in pounds and sent in whole pence. The product is
 * saved first, then its details, so a changed category's details apply; the box stays open
 * with the server's words until both are saved. The Owner's only (decision 11).
 */
export type Answer = { id: number; value: number | string | null };
export type Editing = Product & { details?: Answer[] };
const NONE = 'Uncategorised';
const field = 'min-h-11 w-full min-w-0 rounded-md border border-[var(--input)] bg-[var(--wh-panel)] px-2.5 text-size-15 text-[var(--wh-ink)]';
const label = 'text-sm font-semibold';
// "28", "28.5", "£28.00": pounds to whole pence, or null when it isn't money.
export function pence(text: string): number | null {
  const t = text.trim().replace(/^£/, '').replace(/,/g, '');
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(t)) return null;
  const [whole, part = ''] = t.split('.');
  return Number(whole) * 100 + Number(part.padEnd(2, '0'));
}
const pounds = (p: number | null | undefined) => (p === null || p === undefined ? '' : (p / 100).toFixed(2));
const words = (err: unknown) => (serverSaid(err) ? err.message : 'Wheelhouse couldn’t save the product. Try again in a moment.');

function Field({ id, name, value, onChange, unit, mono: isMono, inputRef }: {
  id: string; name: string; value: string; onChange: (v: string) => void; unit?: string | null; mono?: boolean; inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={label}>{name}</label>
      <span className="flex items-center gap-1.5">
        <input id={id} ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} ${isMono ? mono : ''}`} />
        {unit ? <span className="text-sm text-[var(--wh-muted)]">{unit}</span> : null}
      </span>
    </div>
  );
}

function DetailInput({ d, value, onChange }: { d: Detail; value: string; onChange: (v: string) => void }) {
  const id = `pb-d${d.id}`;
  if (d.kind === 'choice') {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={id} className={label}>{d.name}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={field}>
          <option value="">—</option>
          {d.choices.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    );
  }
  return <Field id={id} name={d.name} value={value} onChange={onChange} unit={d.kind === 'number' ? d.unit : null} mono={d.kind === 'number'} />;
}

export function ProductBox({ product, title, subtitle, saveLabel, start, focus = 'name', onSaved, onClose }: {
  product?: Editing; title: string; subtitle?: string; saveLabel: string;
  start?: { name?: string; barcode?: string }; focus?: 'name' | 'details';
  onSaved: (p: Product) => void | Promise<void>; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const categories = useCategoryList();
  const all = categories.data ?? [];
  const [name, setName] = useState(product?.name ?? start?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? start?.barcode ?? '');
  const [supplier, setSupplier] = useState(product?.supplier ?? '');
  const [cost, setCost] = useState(pounds(product?.costPence));
  const [price, setPrice] = useState(pounds(product?.pricePence));
  const [low, setLow] = useState(String(product?.lowStockThreshold ?? 3));
  const [category, setCategory] = useState(product?.category ?? NONE);
  const was = Object.fromEntries((product?.details ?? []).map((a) => [a.id, a.value === null ? '' : String(a.value)]));
  const [answers, setAnswers] = useState<Record<number, string>>(was);
  const [made, setMade] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus === 'details') detailsRef.current?.querySelector<HTMLElement>('input, select')?.focus();
    else nameRef.current?.focus();
  }, [focus, categories.isSuccess]);

  const details = category === NONE ? [] : detailsFor(all, category);
  const paths = all.map((c) => c.path);
  if (category !== NONE && !paths.includes(category)) paths.unshift(category);
  const pricePence = pence(price);
  const costPence = cost.trim() ? pence(cost) : null;
  const lowLevel = /^\d{1,6}$/.test(low.trim()) ? Number(low.trim()) : null;
  const why = !name.trim() ? 'Type its name'
    : pricePence === null ? 'Type a price in pounds, like 28.00'
    : cost.trim() && costPence === null ? 'Type the cost in pounds, like 14.00, or leave it blank'
    : lowLevel === null ? 'The low-stock level is a whole number'
    : null;

  async function save() {
    if (why || busy) return;
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(), sku: sku.trim(), barcode: barcode.trim(), supplier: supplier.trim(),
      pricePence, lowStockThreshold: lowLevel, category,
      ...(costPence === null ? {} : { costPence }),
    };
    try {
      const id = product?.id ?? made?.id;
      const saved = id
        ? await apiMutate<Product>(`/api/products/${id}`, body, { method: 'PUT' })
        : await apiMutate<Product>('/api/products', body);
      setMade(saved);
      const changed = details.filter((d) => (answers[d.id] ?? '') !== (was[d.id] ?? ''));
      if (changed.length) {
        await apiMutate(`/api/products/${saved.id}/details`, { answers: changed.map((d) => ({ detailId: d.id, value: (answers[d.id] ?? '').trim() })) }, { method: 'PUT' });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['product', saved.id] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
      await onSaved(saved);
    } catch (err) {
      setError(words(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="pb-title" className="md:max-w-[680px]">
      <DialogHeader className="flex-col items-start gap-1">
        <DialogTitle id="pb-title">{title}</DialogTitle>
        {subtitle ? <p className="m-0 text-sm text-[var(--wh-muted)]">{subtitle}</p> : null}
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 max-md:grid-cols-1">
          <Field id="pb-name" name="Name" value={name} onChange={setName} inputRef={nameRef} />
          <Field id="pb-code" name="Supplier code" value={sku} onChange={setSku} mono />
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 max-md:grid-cols-1">
          <Field id="pb-supplier" name="Supplier" value={supplier} onChange={setSupplier} />
          <Field id="pb-barcode" name="Barcode" value={barcode} onChange={setBarcode} mono />
        </div>
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2">
          <Field id="pb-cost" name="Cost" value={cost} onChange={setCost} mono />
          <Field id="pb-price" name="Price" value={price} onChange={setPrice} mono />
          <Field id="pb-low" name="Low-stock level" value={low} onChange={setLow} mono />
        </div>
        <div ref={detailsRef} className="flex flex-col gap-2 border-t border-[var(--wh-border)] pt-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pb-cat" className={label}>Category</label>
            <select id="pb-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
              <option value={NONE}>No category</option>
              {paths.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {details.length ? (
            <>
              <span className="text-size-15 font-bold">{category.split(' › ').pop()} details</span>
              <span className="text-size-13 text-[var(--wh-muted)]">Set for every product in {category} in Settings › Stockroom › Categories. Staff can find it by these.</span>
              <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                {details.map((d) => <DetailInput key={d.id} d={d} value={answers[d.id] ?? ''} onChange={(v) => setAnswers((a) => ({ ...a, [d.id]: v }))} />)}
              </div>
            </>
          ) : null}
        </div>
        {product ? <p className="m-0 text-size-13 text-[var(--wh-muted)]">A new price or cost goes into its history with your name. A blank cost leaves the cost as it is.</p> : null}
        {error ? <p role="alert" className="m-0 text-sm">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="items-start justify-between">
        <Button onClick={onClose}>Cancel</Button>
        <span className="flex flex-col items-end gap-1">
          <Button variant="primary" aria-disabled={why || busy ? true : undefined} aria-describedby={why ? 'pb-why' : undefined}
            className={why ? 'opacity-45' : undefined} onClick={save}>{saveLabel}</Button>
          {why ? <span id="pb-why" className="text-size-13 text-[var(--wh-muted)]">{why}</span> : null}
        </span>
      </DialogFooter>
    </Dialog>
  );
}
