import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { pounds } from './money.ts';

/**
 * "Your receipt" from the account's history (openspec/changes/finish-account
 * design 3; drawn as ac-receipt and ac-receipt-sent in account.mjs, its body
 * as collect.mjs's receiptBody): the shop's details, the receipt's number and
 * time, its lines, total, VAT and how it was paid, then one button, "Email it
 * to me", which sends it to her own address. No PDF (Jack, 9 Nov, answer 6),
 * no barcode (question 7). Only a till sale has one for now (answer 1).
 */
export type ReceiptRef = { source: string; id: number };
export type Receipt = {
  heading: 'Receipt' | 'Invoice'; number: string; at: string;
  shop: { name: string; address: string | null; phone: string | null; vatNumber: string | null };
  invoiceTo: { name: string; address: string | null; vatNumber: string | null } | null;
  lines: { name: string; qty: number; unitPence: number; totalPence: number }[];
  totalPence: number; vatLines: { ratePercent: number; pence: number }[]; payments: { how: string; pence: number }[];
};

export const NOT_FOUND = 'We can’t find that receipt';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// The shop's own day and time, as the printed receipt says them.
function london(iso: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const [y, m, d] = [Number(p.year), Number(p.month), Number(p.day)];
  return { y, m, d, weekday: DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], time: `${p.hour}:${p.minute}` };
}
// "Tue 25 Aug 2026", under the title.
const dayLine = (iso: string) => { const t = london(iso); return `${t.weekday} ${t.d} ${MONTHS[t.m - 1]} ${t.y}`; };
// "25 Aug 2026 · 10:05", in the body.
const whenLine = (iso: string) => { const t = london(iso); return `${t.d} ${MONTHS[t.m - 1]} ${t.y} · ${t.time}`; };

const cell = 'border-t border-[var(--wh-border)] py-1.5';
const mono = 'font-[family-name:var(--wh-font-mono)]';

export function ReceiptDialog({ base, of, email, onNotFound, onClose }: {
  base: string; of: ReceiptRef; email: string; onNotFound: () => void; onClose: () => void;
}) {
  const path = `${base}/receipts/${encodeURIComponent(of.source)}/${of.id}`;
  const receipt = useQuery({ queryKey: ['account', base, 'receipt', of.source, of.id], queryFn: () => apiGet<Receipt>(path), retry: false, refetchOnWindowFocus: false });
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const gone = receipt.error instanceof ApiError && receipt.error.status === 404;
  React.useEffect(() => { if (gone) onNotFound(); }, [gone, onNotFound]);
  if (gone) return null;

  async function send() {
    setSending(true);
    setFailed(false);
    try {
      const { sentTo } = await apiMutate<{ sentTo: string }>(`${path}/email`, {}, { method: 'POST' });
      setSent(sentTo);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  const r = receipt.data;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="rc-title" className="md:max-w-[560px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="rc-title">Your receipt</DialogTitle>
          {r ? <span className="text-size-13 text-[var(--wh-muted)]">{`${r.number} · ${dayLine(r.at)} · ${r.shop.name}`}</span> : null}
        </div>
        <DialogClose className="inline-flex min-h-11 min-w-11 items-center justify-center" onClick={onClose} />
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {!r ? (
          receipt.isPending ? <p className="m-0 text-size-15">Loading…</p>
            : <p role="alert" className="m-0 text-size-15">That didn’t load. Close this and try again.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
              <div className="flex flex-col gap-[3px]">
                <strong className="text-base">{r.shop.name}</strong>
                {r.shop.address || r.shop.phone ? <span>{[r.shop.address, r.shop.phone].filter(Boolean).join(' · ')}</span> : null}
                {r.shop.vatNumber ? <span>{`VAT number ${r.shop.vatNumber}`}</span> : null}
              </div>
              <div className="flex flex-col gap-[3px] sm:items-end">
                <span>{`${r.heading} ${r.number}`}</span>
                <span>{whenLine(r.at)}</span>
              </div>
            </div>
            {r.invoiceTo ? (
              <div className="rounded-md bg-[var(--wh-bg)] px-3 py-2.5 text-sm leading-normal">
                <strong className="block">Invoice to</strong>
                <span className="block">{[r.invoiceTo.name, r.invoiceTo.address].filter(Boolean).join(' · ')}</span>
                {r.invoiceTo.vatNumber ? <span className="block">{`VAT number ${r.invoiceTo.vatNumber}`}</span> : null}
              </div>
            ) : null}
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{r.heading === 'Invoice' ? 'Items on this invoice' : 'Items on this receipt'}</caption>
              <thead>
                <tr className="text-left text-xs text-[var(--wh-muted)]">
                  <th scope="col" className="py-1.5 font-semibold">Till sale</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l, i) => (
                  <tr key={i}>
                    <td className={cell}>
                      <span className="block">{l.name}</span>
                      {l.qty > 1 ? <span className="block text-size-13 text-[var(--wh-muted)]">{`${l.qty} × ${pounds(l.unitPence)}`}</span> : null}
                    </td>
                    <td className={`${cell} text-right ${mono}`}>{pounds(l.totalPence)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={cell}>{r.vatLines.length ? 'Total (includes VAT)' : 'Total'}</td>
                  <td className={`${cell} text-right ${mono}`}>{pounds(r.totalPence)}</td>
                </tr>
                {r.vatLines.map((v) => (
                  <tr key={`v${v.ratePercent}`}><td className={cell}>{`VAT at ${v.ratePercent}%`}</td><td className={`${cell} text-right ${mono}`}>{pounds(v.pence)}</td></tr>
                ))}
                {r.payments.map((p, i) => (
                  <tr key={`p${i}`}><td className={cell}>{`Paid by ${p.how}`}</td><td className={`${cell} text-right ${mono}`}>{pounds(p.pence)}</td></tr>
                ))}
              </tbody>
            </table>
            {sent ? (
              <p role="status" className="m-0 flex items-start gap-2.5 rounded-lg bg-[var(--wh-status-complete-bg)] px-3.5 py-3 text-size-15 font-semibold leading-snug text-[var(--wh-status-complete-ink)]">
                <Check aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" /><span>{`Sent to ${sent}`}</span>
              </p>
            ) : <p className="m-0 text-sm text-[var(--wh-muted)]">{`“Email it to me” sends it to ${email}.`}</p>}
            {failed ? (
              <p role="alert" className="m-0 flex items-center gap-2.5 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-3 text-size-15 leading-snug text-[var(--wh-warn-ink)]">
                <TriangleAlert aria-hidden="true" className="size-[18px] shrink-0" /><span>That didn’t go through. Try again.</span>
              </p>
            ) : null}
          </>
        )}
      </DialogBody>
      {r ? (
        <DialogFooter className="flex justify-end">
          <Button disabled={sending} onClick={() => void send()}>Email it to me</Button>
        </DialogFooter>
      ) : null}
    </Dialog>
  );
}
