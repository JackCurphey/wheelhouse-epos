import { useLayoutEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
  /** Tenders the shop added (the old app's extra payments), each by its own name. */
  extraPayments?: { tenderType: string; amount: number }[];
};
/** checkedBy: who signed the job off, only when the shop shows it (mechanic sign-off piece 3). */
export type ReceiptJob = { reference: string; bikeLabel: string | null; checkedBy?: string | null };
/** The shop's details from Settings › Shop details (Jack, 18 Oct); each left out when blank. */
export type ShopDetails = { address?: string | null; phone?: string | null; vatNumber?: string | null; receiptFooter?: string | null };
export type ReceiptProps = { sale: ReceiptSale; shopName: string; job?: ReceiptJob; details?: ShopDetails };

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

export function ReceiptPaper({ sale, shopName, job, details }: ReceiptProps) {
  return (
    <article aria-label="Receipt" className="flex w-[72mm] flex-col gap-2.5 p-4 text-[13px] leading-snug">
      {/* The shop's name at the top; its details and the barcode at the bottom (shop details answer 2). */}
      <div className="flex flex-col items-center gap-1 text-center">
        <strong className="text-[17px]">{shopName}</strong>
        <span>{`Sale ${sale.id}`}</span>
        <span>{when(sale.createdAt)}</span>
      </div>
      <div className="flex flex-col gap-1 border-t border-dashed border-current pt-2">
        {job ? <span className="font-bold">{job.bikeLabel ? `${job.reference} · ${job.bikeLabel}` : job.reference}</span> : null}
        {job?.checkedBy ? <span>{`Checked by ${job.checkedBy}`}</span> : null}
        {sale.items.map((it) => (
          <Row key={it.id} left={it.qty > 1 ? `${it.name} ${it.qty} × ${money(it.unitPrice)}` : it.name} right={money(it.lineTotal)} />
        ))}
        {sale.discount > 0 ? <Row left="Discount" right={`−${money(sale.discount)}`} /> : null}
        {sale.groupDiscountAmount > 0 ? <Row left={sale.groupDiscountName || 'Customer discount'} right={`−${money(sale.groupDiscountAmount)}`} /> : null}
      </div>
      <div className="flex flex-col gap-1 border-t border-dashed border-current pt-2">
        <Row left="Total" right={money(sale.total)} strong />
        {sale.cashAmount > 0 ? <Row left="Paid by cash" right={money(sale.cashAmount)} /> : null}
        {sale.cardAmount > 0 ? <Row left="Paid by card" right={money(sale.cardAmount)} /> : null}
        {(sale.extraPayments ?? []).map((p, i) => <Row key={i} left={`Paid by ${p.tenderType}`} right={money(p.amount)} />)}
      </div>
      <div className="flex flex-col items-center gap-0.5 border-t border-dashed border-current pt-2.5 text-center">
        {details?.address ? <span className="break-words">{details.address}</span> : null}
        {details?.phone ? <span>{details.phone}</span> : null}
        {details?.vatNumber ? <span>{`VAT number ${details.vatNumber}`}</span> : null}
        {/* The shop's words at the bottom, just above the barcode (Jack, 19 Oct; set-till-receipts' preview). */}
        {details?.receiptFooter ? <span className="mt-1.5 break-words whitespace-pre-line">{details.receiptFooter}</span> : null}
        <span className={details?.address || details?.phone || details?.vatNumber || details?.receiptFooter ? 'mt-2' : ''}><Barcode value={String(sale.id)} /></span>
      </div>
    </article>
  );
}

let printRoot: Root | null = null;
let printHost: HTMLElement | null = null;

/**
 * Prints the receipt on the computer's own printer: drawn into #wh-print,
 * which the print styles (theme.css) make the only thing on the page, then
 * the browser's print box. It stays there, hidden on screen, until the next
 * print replaces it: a browser that prints after print() returns would
 * otherwise get a blank page (fresh review).
 */
export function printReceipt(props: ReceiptProps) {
  let host = document.getElementById('wh-print');
  if (!host) {
    host = document.createElement('div');
    host.id = 'wh-print';
    document.body.appendChild(host);
  }
  // One root per #wh-print: a fresh page (or test) gets a fresh one.
  if (!printRoot || printHost !== host) {
    printRoot = createRoot(host);
    printHost = host;
  }
  const root = printRoot;
  flushSync(() => root.render(<ReceiptPaper {...props} />));
  window.print();
}
