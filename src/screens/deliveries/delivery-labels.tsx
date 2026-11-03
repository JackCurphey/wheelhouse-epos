import { useLayoutEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { printPaper } from '@/screens/till/receipt.tsx';
import { Row, money } from './deliveries-bits.tsx';
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

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height: 28, width: 1.2, margin: 0 });
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`Barcode ${value}`} className="max-w-full" />;
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
            {code ? <>{CAN_DRAW.test(code) ? <Barcode value={code} /> : null}<span className="max-w-full truncate text-xs">{code}</span></> : null}
          </article>
        );
      })}
    </>
  );
}

export function PrintLabels({ supplierName, lines, onClose }: { supplierName: string | null; lines: LabelLine[]; onClose: () => void }) {
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
          <span className="text-size-13 text-[var(--wh-muted)]">{supplierName ? `${supplierName} · booked in just now` : 'Booked in just now'}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <p className="m-0 text-sm text-[var(--wh-muted)]">Set for what needs a label: products without their own barcode. Change any count.</p>
        <ul aria-label="What needs a label" className="m-0 list-none p-0">
          {lines.map((l) => (
            <Row key={l.id} title={l.name} sub={`${l.barcode ? 'Has its own barcode' : 'No barcode of its own'} · ${l.qty} received`}>
              <Count name={`${COUNT} ${l.name}`} value={counts[l.id]} min={0} onChange={(n) => setCounts((c) => ({ ...c, [l.id]: n }))} />
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
