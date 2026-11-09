import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { todayIso } from '@/screens/diary/rules.ts';

/**
 * "+ Log a request" (openspec/changes/finish-customers design 7; cs-privacy's button; question 7):
 * a request made in person, by phone, email or letter. Not drawn as a box: the Form box pattern,
 * with the customer found as the header search finds them, what they asked for, how they asked
 * and the day they asked (today or earlier). The answer is due one month on.
 */
type Customer = { id: number; name: string; phone: string | null };
const KINDS = [['copy', 'Copy of their data'], ['delete', 'Delete their details']] as const;
export const HOWS = [['in_person', 'In person'], ['phone', 'Phone'], ['email', 'Email'], ['letter', 'Letter']] as const;
const LABEL = 'text-size-15 font-semibold';
const INPUT = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-size-15';

function Pills<K extends string>({ id, label, choices, value, onChange }: { id: string; label: string; choices: readonly (readonly [K, string])[]; value: K | null; onChange: (k: K) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className={LABEL}>{label}</span>
      <RadioPillGroup aria-labelledby={id} className="flex flex-wrap gap-2">
        {choices.map(([k, w]) => {
          const on = value === k;
          return <button key={k} type="button" role="radio" aria-checked={on} onClick={() => onChange(k)}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{w}</button>;
        })}
      </RadioPillGroup>
    </div>
  );
}

export function LogRequestDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const today = todayIso();
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [kind, setKind] = useState<'copy' | 'delete' | null>(null);
  const [how, setHow] = useState<(typeof HOWS)[number][0] | null>(null);
  const [askedOn, setAskedOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = search.trim();
  const found = useQuery({
    queryKey: ['search', q],
    queryFn: () => apiGet<{ customers: Customer[] }>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: !customer && q.length >= 2,
  });

  async function save() {
    const missing = !customer ? 'Find the customer' : !kind ? 'Choose what they asked for' : !how ? 'Choose how they asked' : !askedOn ? 'Give the day they asked' : null;
    if (missing) { setError(missing); return; }
    setBusy(true);
    setError(null);
    try {
      await apiMutate('/api/privacy-requests', { customerId: customer?.id, kind, askedOn, how }, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['privacy-requests'] });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t log that. Try again in a moment.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="lr-title" className="md:max-w-[560px]">
      <DialogHeader><DialogTitle id="lr-title">Log a request</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lr-customer" className={LABEL}>Customer</label>
          {customer ? (
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-size-15 font-bold">{customer.name}</span>
              <Button variant="ghost" onClick={() => { setCustomer(null); setSearch(''); }}>Change</Button>
            </div>
          ) : (
            <>
              <input id="lr-customer" className={INPUT} placeholder="Name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
              {found.data ? (
                found.data.customers.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No customers match.</p>
                  : <ul aria-label="Customers found" className="m-0 flex list-none flex-col p-0">{found.data.customers.map((c) => (
                    <li key={c.id}><button type="button" onClick={() => setCustomer(c)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-size-15 hover:bg-[var(--wh-hover)]">
                      <span className="font-semibold">{c.name}</span>{c.phone ? <span className="text-sm text-[var(--wh-muted)]">{c.phone}</span> : null}
                    </button></li>
                  ))}</ul>
              ) : null}
            </>
          )}
        </div>
        <Pills id="lr-kind" label="What they asked for" choices={KINDS} value={kind} onChange={setKind} />
        <Pills id="lr-how" label="How they asked" choices={HOWS} value={how} onChange={setHow} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lr-day" className={LABEL}>Day they asked</label>
          <input id="lr-day" type="date" max={today} className={INPUT} value={askedOn} onChange={(e) => setAskedOn(e.target.value)} />
          <span className="text-size-13 text-[var(--wh-muted)]">The answer is due one month from this day.</span>
        </div>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>Log it</Button>
      </DialogFooter>
    </Dialog>
  );
}
