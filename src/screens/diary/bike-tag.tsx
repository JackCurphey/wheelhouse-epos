import { useLayoutEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { printPaper } from '@/screens/till/receipt.tsx';

/**
 * The bike tag (Jack, 21 Oct, docs/decisions/2026-10-21-bike-tag.md; drawn as
 * job-bike-tag): the job number large, its Code 128 barcode (Workshop day 4),
 * the customer and the bike, printed through the browser as receipts are. A
 * stand-in until a template builder for receipts and tags exists (answer 2).
 */
type TagJob = { reference: string; customerName: string | null; bikeLabel: string | null };

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height: 44, width: 1.6, margin: 0 });
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`Barcode for job ${value}`} />;
}

export function BikeTagPaper({ reference, customerName, bikeLabel }: TagJob) {
  return (
    <article aria-label="Bike tag" className="flex w-[62mm] flex-col items-center gap-1.5 p-3 text-center">
      <strong className="font-[family-name:var(--wh-font-mono)] text-[26px] tracking-[1px]">{reference}</strong>
      <Barcode value={reference} />
      {customerName ? <span className="text-[15px] font-bold">{customerName}</span> : null}
      {bikeLabel ? <span className="text-[13px]">{bikeLabel}</span> : null}
    </article>
  );
}

export function printBikeTag(job: TagJob) {
  printPaper(<BikeTagPaper {...job} />);
}
