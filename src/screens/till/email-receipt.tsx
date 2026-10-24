import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { refusalText } from '@/screens/diary/refusal-words.ts';

/**
 * "Email the receipt" (Jack, 23 Oct, docs/decisions/2026-10-23-overnight-questions.md
 * item 3; drawn as cp-receipt-address in collect.mjs; openspec/changes/till-email-receipt):
 * the till's Email button. The cursor starts in the box and Enter sends (2 Oct,
 * leftover screens M1). A workshop job's customer has their address filled in,
 * for this receipt only. The server (POST /api/sales/:id/email-receipt) checks
 * the address; sends are pretend for now.
 *
 * Not here yet: "Save to a customer record" and its Add a customer (a piece of
 * its own), and sending once back online.
 */
export type ReceiptCustomer = { id: number; name: string };

export function EmailReceiptDialog({ saleId, customer, onClose, onSent }: {
  saleId: number; customer: ReceiptCustomer | null; onClose: () => void; onSent: (to: string) => void;
}) {
  const record = useQuery({
    queryKey: ['customer', customer?.id],
    queryFn: () => apiGet<{ email: string | null }>(`/api/customers/${customer!.id}`),
    enabled: Boolean(customer),
  });
  const onFile = record.data?.email?.trim() || '';
  const [typed, setTyped] = useState<string | null>(null);
  const address = typed ?? onFile;
  const [sending, setSending] = useState(false);
  const [badAddress, setBadAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  const first = customer?.name.trim().split(/\s+/)[0] ?? '';

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setBadAddress(null);
    setError(null);
    try {
      const sent = await apiMutate<{ to: string }>(`/api/sales/${saleId}/email-receipt`, { email: address.trim() });
      onSent(sent?.to ?? address.trim());
    } catch (err) {
      // The route's only 400 is a bad address (server/routes/receipt-email.js).
      if (err instanceof ApiError && err.status === 400 && err.hasServerMessage) setBadAddress(err.message);
      else setError(refusalText(err));
      box.current?.focus();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !sending) onClose(); }} aria-labelledby="email-receipt-title" className="md:max-w-[480px]">
      {/* The server checks the address, so the drawn message shows, not the browser's own (noValidate). */}
      <form onSubmit={send} noValidate>
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle id="email-receipt-title">Email the receipt</DialogTitle>
            <span className="text-size-13 text-[var(--wh-muted)]">{`Sale ${saleId} · ${customer ? customer.name : 'no customer on this sale'}`}</span>
          </div>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-1.5">
          <label htmlFor="email-receipt-address" className="text-sm font-semibold">Email address</label>
          <input
            ref={box} id="email-receipt-address" type="email" inputMode="email" autoComplete="off" placeholder="name@example.com"
            value={address} onChange={(e) => { setTyped(e.target.value); setBadAddress(null); }}
            aria-invalid={badAddress ? true : undefined}
            aria-describedby={[badAddress ? 'email-receipt-bad' : '', customer && onFile ? 'email-receipt-from' : ''].filter(Boolean).join(' ') || undefined}
            className={`min-h-11 rounded-md border bg-[var(--wh-panel)] px-3 text-base ${badAddress ? 'border-[var(--wh-danger-hover)]' : 'border-[var(--wh-input-border)]'}`}
          />
          {badAddress ? <p id="email-receipt-bad" role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{badAddress}</p> : null}
          {customer && onFile ? <p id="email-receipt-from" className="m-0 text-size-13 text-[var(--wh-muted)]">{`From ${first}’s customer record. A change here is used for this receipt only.`}</p> : null}
          {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
        </DialogBody>
        <DialogFooter className="flex justify-end gap-2">
          {/* Not while it sends: a reply after Cancel would start the next sale anyway (review). */}
          <Button type="button" className="min-h-11" disabled={sending} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" className="min-h-11" disabled={sending || !address.trim()}>{sending ? 'Sending…' : 'Send receipt'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
