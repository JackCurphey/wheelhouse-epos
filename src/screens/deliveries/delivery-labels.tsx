import { useLayoutEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { printPaper } from '@/screens/till/receipt.tsx';
import { Row, day, money } from './deliveries-bits.tsx';
import { Count } from './new-order.tsx';

/**
 * Print labels (rs-labels in receiving.mjs; receiving decision 8;
 * openspec/changes/delivery-labels): what was booked in, each starting at one
 * label per item received when it has no barcode of its own, otherwise 0. Any
 * count can be changed. Printed through the browser (Jack's 26 Oct answer 5),
 * so its print window picks the printer, not a line here. "New in this
 * delivery" waits for Add this product. A stand-in, as the bike tag is, until
 * shops can design their own printouts.
 */
export type LabelLine = { id: number; name: string; sku: string | null; barcode: string | null; price: number; qty: number };
type Size = { widthMm: number; heightMm: number };

const COUNT = 'Labels for';
// What Code 128 can hold; any other code still prints in words.
const CAN_DRAW = /^[\x20-\x7E]+$/;

// The narrowest bar, in the drawing's units and at its best printed size; the
// clear space each side a scanner needs is 10 of them.
const NARROW_UNITS = 2;
const NARROW_MM = 0.33;
const QUIET_NARROW_BARS = 10;

/**
 * A Code 128 barcode with its quiet zone, at its best size, or narrower when
 * that wouldn't fit the label: bars are scaled together, not cut off.
 */
function Barcode({ value, widthMm, heightMm }: { value: string; widthMm: number; heightMm: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    JsBarcode(svg, value, { format: 'CODE128', displayValue: false, height: 60, width: NARROW_UNITS, margin: QUIET_NARROW_BARS * NARROW_UNITS });
    const units = Number(svg.getAttribute('viewBox')?.split(' ')[2] ?? 0);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = `${Math.min((units / NARROW_UNITS) * NARROW_MM, widthMm)}mm`;
    svg.style.height = `${heightMm}mm`;
  }, [value, widthMm, heightMm]);
  return <svg ref={ref} role="img" aria-label={`Barcode ${value}`} />;
}

/** One label a page, at the shop's size, as the old app's sticker: name, price, barcode, code. */
function LabelsPaper({ labels, size }: { labels: LabelLine[]; size: Size }) {
  return (
    <>
      <style>{`@media print { @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; } }`}</style>
      {labels.map((l, i) => {
        const code = (l.barcode || l.sku || '').trim();
        return (
          <article key={i} aria-label="Label" style={{ width: `${size.widthMm}mm`, height: `${size.heightMm}mm` }}
            className="flex flex-col items-center justify-center overflow-hidden break-after-page text-center">
            <span className="max-w-full truncate text-size-13 font-bold">{l.name}</span>
            <span className="text-size-13">{money(l.price)}</span>
            {code ? <>{CAN_DRAW.test(code) ? <Barcode value={code} widthMm={size.widthMm} heightMm={size.heightMm * 0.4} /> : null}<span className="max-w-full truncate text-xs">{code}</span></> : null}
          </article>
        );
      })}
    </>
  );
}

// Most labels for a line: about ten times what came, for spares, 500 at most,
// so a slip of the keyboard can't print thousands.
const mostLabels = (received: number) => Math.min(500, Math.max(10, received * 10));
// "Just now" only just after booking in; a reload later says the day.
const JUST_NOW_MS = 5 * 60_000;
const whenBooked = (iso: string) => (Date.now() - new Date(iso).getTime() < JUST_NOW_MS ? 'just now' : day(iso));

export function PrintLabels({ supplierName, bookedInAt, lines, onClose }: { supplierName: string | null; bookedInAt: string; lines: LabelLine[]; onClose: () => void }) {
  const size = useQuery({ queryKey: ['label-settings'], queryFn: () => apiGet<Size>('/api/label-settings') });
  const [counts, setCounts] = useState<Record<number, number>>(() => Object.fromEntries(lines.map((l) => [l.id, l.barcode ? 0 : l.qty])));
  const total = lines.reduce((n, l) => n + counts[l.id], 0);
  function print() {
    if (!size.data) return;
    printPaper(<LabelsPaper size={size.data} labels={lines.flatMap((l) => Array.from({ length: counts[l.id] }, () => l))} />);
    onClose();
  }
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }} aria-labelledby="lb-title">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="lb-title">Print labels</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">{supplierName ? `${supplierName} · booked in ${whenBooked(bookedInAt)}` : `Booked in ${whenBooked(bookedInAt)}`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <p className="m-0 text-sm text-[var(--wh-muted)]">Set for what needs a label: products without their own barcode. Change any count.</p>
        <ul aria-label="What needs a label" className="m-0 list-none p-0">
          {lines.map((l) => (
            <Row key={l.id} title={l.name} sub={`${l.barcode ? 'Has its own barcode' : 'No barcode of its own'} · ${l.qty} received`}>
              <Count name={`${COUNT} ${l.name}`} value={counts[l.id]} min={0} max={mostLabels(l.qty)} onChange={(n) => setCounts((c) => ({ ...c, [l.id]: n }))} />
            </Row>
          ))}
        </ul>
        {size.isError ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t load the label size. Try again in a moment.</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={total === 0 || !size.data} onClick={print}>{`Print ${total} ${total === 1 ? 'label' : 'labels'}`}</Button>
      </DialogFooter>
    </Dialog>
  );
}
