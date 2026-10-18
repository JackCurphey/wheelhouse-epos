import { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { money } from './rules.ts';

/**
 * The printed receipt (Jack, 18 Oct, docs/decisions/2026-10-18-print-receipt.md;
 * drawn as till-receipt-paper in docs/design/user-journeys/generator/till.mjs).
 * The shop's name, "Sale [n]" and its barcode, when, the job and bike, the
 * lines, any discounts, the total and how it was paid. No VAT line and no B1
 * receipt number until the sale records them (answer 2); no address until
 * Shop details holds one.
 * Spec: openspec/changes/print-receipt (design.md).
 */

export type ReceiptSale = {
  id: number;
  createdAt: string;
  items: { id: number; name: string; qty: number; unitPrice: number; lineTotal: number }[];
  discount: number;
  groupDiscountAmount: number;
  groupDiscountName: string | null;
  total: number;
  cashAmount: number;
  cardAmount: number;
};
export type ReceiptJob = { reference: string; bikeLabel: string | null };
export type ReceiptProps = { sale: ReceiptSale; shopName: string; job?: ReceiptJob };

const when = (iso: string) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${day} · ${time}`;
};

function Row({ left, right, strong = false }: { left: string; right: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'text-[15px] font-bold' : ''}`}>
      <span>{left}</span>
      <span className="font-mono">{right}</span>
    </div>
  );
}

// Code 128 of the sale number, so a refund can scan it later (selling at the
// till decision 13).
function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height: 34, width: 1.6, margin: 0 });
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`Barcode for sale ${value}`} />;
}

export function ReceiptPaper({ sale, shopName, job }: ReceiptProps) {
  return (
    <article aria-label="Receipt" className="flex w-[72mm] flex-col gap-2.5 bg-white p-4 text-[13px] leading-snug text-black">
      <strong className="text-center text-[17px]">{shopName}</strong>
      <div className="flex flex-col items-center gap-1 text-center">
        <span>{`Sale ${sale.id}`}</span>
        <span>{when(sale.createdAt)}</span>
        <Barcode value={String(sale.id)} />
      </div>
      <div className="flex flex-col gap-1 border-t border-dashed border-black pt-2">
        {job ? <span className="font-bold">{job.bikeLabel ? `${job.reference} · ${job.bikeLabel}` : job.reference}</span> : null}
        {sale.items.map((it) => (
          <Row key={it.id} left={it.qty > 1 ? `${it.name} ${it.qty} × ${money(it.unitPrice)}` : it.name} right={money(it.lineTotal)} />
        ))}
        {sale.discount > 0 ? <Row left="Discount" right={`−${money(sale.discount)}`} /> : null}
        {sale.groupDiscountAmount > 0 ? <Row left={sale.groupDiscountName || 'Customer discount'} right={`−${money(sale.groupDiscountAmount)}`} /> : null}
      </div>
      <div className="flex flex-col gap-1 border-t border-dashed border-black pt-2">
        <Row left="Total" right={money(sale.total)} strong />
        {sale.cashAmount > 0 ? <Row left="Paid by cash" right={money(sale.cashAmount)} /> : null}
        {sale.cardAmount > 0 ? <Row left="Paid by card" right={money(sale.cardAmount)} /> : null}
      </div>
    </article>
  );
}

/**
 * Prints the receipt on the computer's own printer: drawn into #wh-print,
 * which the print styles (theme.css) make the only thing on the page, then
 * the browser's print box, then cleared.
 */
export function printReceipt(props: ReceiptProps) {
  let host = document.getElementById('wh-print');
  if (!host) {
    host = document.createElement('div');
    host.id = 'wh-print';
    document.body.appendChild(host);
  }
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<ReceiptPaper {...props} />));
    window.print();
  } finally {
    root.unmount();
    host.textContent = '';
  }
}
