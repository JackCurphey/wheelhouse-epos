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
 * With no customer on the sale, "Save to a customer record" (unticked)
 * opens a quick "Add a customer" once it's sent, the address filled in
 * (decision 3, 2 Oct: "Nobody joins the customer list without agreeing";
 * cp-receipt-address-save; openspec/changes/till-save-customer).
 *
 * Not here yet: sending once back online.
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
  const [save, setSave] = useState(false);
  // Sent with the tick: the address it went to, for Add a customer.
  const [sentTo, setSentTo] = useState<string | null>(null);
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
      const to = sent?.to ?? address.trim();
      if (save && !customer) setSentTo(to);
      else onSent(to);
    } catch (err) {
      // The route's only 400 is a bad address (server/routes/receipt-email.js).
      if (err instanceof ApiError && err.status === 400 && err.hasServerMessage) setBadAddress(err.message);
      else setError(refusalText(err));
      box.current?.focus();
    } finally {
      setSending(false);
    }
  }

  if (sentTo !== null) return <AddCustomer to={sentTo} onDone={() => onSent(sentTo)} />;

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
          {!customer ? (
            // The drawn tick (collect.mjs:233): unticked to start.
            <label className="mt-1 flex min-h-11 cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} aria-describedby="email-receipt-save-hint" className="mt-0.5 size-5 shrink-0 accent-[var(--accent-dark)]" />
              <span className="flex flex-col gap-0.5">
                <span className="text-size-15 font-semibold">Save to a customer record</span>
                <span id="email-receipt-save-hint" className="text-size-13 text-[var(--wh-muted)]">Leave this unticked and we’ll use the address for this receipt only.</span>
              </span>
            </label>
          ) : null}
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

/**
 * "Add a customer" after a receipt went with Save to a customer record ticked
 * (cp-receipt-address-save, collect.mjs:247-249): what's typed is saved, and
 * offers only if they said yes. "Not now" keeps the receipt sent and adds no one.
 */
function AddCustomer({ to, onDone }: { to: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(to);
  const [phone, setPhone] = useState('');
  const [offers, setOffers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameBox = useRef<HTMLInputElement>(null);
  useEffect(() => { nameBox.current?.focus(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiMutate('/api/customers', { name: name.trim(), email: email.trim(), phone: phone.trim(), marketingPermission: offers });
      onDone();
    } catch (err) {
      setError(refusalText(err));
      nameBox.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  const field = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-base';
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onDone(); }} aria-labelledby="add-customer-title" className="md:max-w-[560px]">
      <form onSubmit={add} noValidate>
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle id="add-customer-title">Add a customer</DialogTitle>
            <span className="text-size-13 text-[var(--wh-muted)]">{`Receipt sent to ${to}`}</span>
          </div>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-customer-name" className="text-sm font-semibold">Name</label>
            <input ref={nameBox} id="add-customer-name" type="text" autoComplete="name" placeholder="First and last name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-customer-email" className="text-sm font-semibold">Email</label>
            <input id="add-customer-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-customer-phone" className="text-sm font-semibold">Phone (optional)</label>
            <input id="add-customer-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <span className="flex grow flex-col gap-0.5">
              <span className="text-size-15 font-semibold">Happy to hear about offers</span>
              <span className="text-size-13 text-[var(--wh-muted)]">Only if they say yes. Off to start.</span>
            </span>
            <input type="checkbox" aria-label="Happy to hear about offers" checked={offers} onChange={(e) => setOffers(e.target.checked)} className="size-5 shrink-0 accent-[var(--accent-dark)]" />
          </label>
          <p className="m-0 text-size-13 text-[var(--wh-muted)]">“Not now” keeps the receipt sent and adds no one.</p>
          {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
        </DialogBody>
        <DialogFooter className="flex justify-end gap-2">
          <Button type="button" className="min-h-11" disabled={saving} onClick={onDone}>Not now</Button>
          <Button type="submit" variant="primary" className="min-h-11" disabled={saving}>{saving ? 'Adding…' : 'Add the customer'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

