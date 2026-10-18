import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { jobRefusalText } from './refusal-words.ts';

/**
 * "Change details" on the job page (Jack, 18 Oct,
 * docs/decisions/2026-10-18-old-diary-features.md answer 3, drawn on
 * job-change-details and its tablet and phone boards): the job's title,
 * customer, bike, date, times and mechanic, changed after it is made. The
 * mechanic is pills in the booking pop-up's style (decision 62). This
 * changes Workshop day decision 32: the page itself still shows the mechanic
 * as plain text, and dragging in the Day view still works.
 *
 * Saving sends every field and the version the page saw. The bike always
 * goes too (null when there is none): the server keeps a field that isn't
 * sent, so a new customer would otherwise keep the old customer's bike.
 */
type Person = { id: number; name: string; active?: boolean };
type Customer = { id: number; name: string; email?: string | null; phone?: string | null };
type Bike = { id: number; make: string | null; model: string | null; colour: string | null };

const bikeName = (b: Bike) => [b.make, b.model].filter(Boolean).join(' ') + (b.colour ? ` · ${b.colour}` : '');
const LABEL = 'text-sm font-semibold';
const INPUT = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm';

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap ${on ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}
    >
      {children}
    </button>
  );
}

export function ChangeDetailsDialog({ job, onClose }: { job: WorkshopJob; onClose: () => void }) {
  const queryClient = useQueryClient();
  // A job over several days has each day's date and time; those change in the diary.
  const manyDays = (job.parts?.length ?? 0) > 1;
  const [title, setTitle] = useState(job.title);
  const [customer, setCustomer] = useState<Customer | null>(job.customerId ? { id: job.customerId, name: job.customerName ?? 'Customer' } : null);
  const [finding, setFinding] = useState(false);
  const [search, setSearch] = useState('');
  const [bikeId, setBikeId] = useState<number | null>(job.bikeId ?? null);
  const [date, setDate] = useState(job.jobDate);
  const [start, setStart] = useState(job.startTime ?? '');
  const [end, setEnd] = useState(job.endTime ?? '');
  const [mech, setMech] = useState<number | null>(job.mechanicId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mechanics = useQuery({ queryKey: ['mechanics'], queryFn: () => apiGet<Person[]>('/api/employees?role=mechanic') });
  const people = (mechanics.data ?? []).filter((m) => m.active !== false);
  const term = search.trim();
  const found = useQuery({
    queryKey: ['customers', term],
    queryFn: () => apiGet<Customer[]>(`/api/customers?search=${encodeURIComponent(term)}`),
    enabled: finding && term.length >= 2,
  });
  const bikes = useQuery({
    queryKey: ['customer-bikes', customer?.id],
    queryFn: () => apiGet<Bike[]>(`/api/customers/${customer?.id}/bikes`),
    enabled: Boolean(customer),
  });
  const bikeList = bikes.data ?? [];

  function chooseCustomer(c: Customer) {
    setCustomer(c);
    setFinding(false);
    setSearch('');
    // A new customer's only bike is chosen for them once their bikes arrive (as New job).
    setBikeId(null);
    void queryClient.fetchQuery({
      queryKey: ['customer-bikes', c.id],
      queryFn: () => apiGet<Bike[]>(`/api/customers/${c.id}/bikes`),
    }).then((list) => { if (list.length === 1) setBikeId(list[0].id); }).catch(() => {});
  }

  async function save() {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      title: title.trim(),
      customerId: customer?.id ?? null,
      bikeId: customer ? bikeId : null,
      ...(manyDays ? {} : { jobDate: date, startTime: start || null, endTime: start ? end || null : null }),
      mechanicId: mech,
      version: job.version,
    };
    try {
      await apiMutate(`/api/workshop-jobs/${job.id}`, body, { method: 'PUT' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop-job', job.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-waiting'] }),
      ]);
      onClose();
    } catch (err) {
      setError(jobRefusalText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="change-details-title" className="max-md:h-full max-md:max-h-none max-md:max-w-none max-md:rounded-none md:max-w-[760px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="change-details-title">Change details</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">{`${job.title} · ${job.reference}`}</span>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </DialogHeader>
      <DialogBody className="grid gap-6 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-title" className={LABEL}>Job title</label>
            <input id="cd-title" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} aria-describedby="cd-title-hint" />
            <span id="cd-title-hint" className="text-[13px] text-[var(--wh-muted)]">Shown on the diary block.</span>
          </div>
          {customer && !finding ? (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>Customer</span>
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5">
                <span className="truncate text-sm">{customer.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setFinding(true)}>Change customer</Button>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col gap-1.5">
              <label htmlFor="cd-find" className={LABEL}>Find customer by name, phone or email</label>
              <input id="cd-find" type="search" value={search} autoComplete="off" onChange={(e) => { setSearch(e.target.value); setFinding(true); }} placeholder="Search by name, phone or email" className={INPUT} />
              <span role="status" className="sr-only">{found.isSuccess ? `${found.data.length} customer${found.data.length === 1 ? '' : 's'} found.` : ''}</span>
              {found.isSuccess ? (
                <div className="absolute top-full right-0 left-0 z-20 mt-1 flex max-h-60 flex-col gap-1 overflow-y-auto rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1 shadow-[0_8px_24px_var(--wh-backdrop)]">
                  {found.data.map((c) => (
                    // Pressing keeps the focus in the search (Safari, iPad), as New job.
                    <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseCustomer(c)} className="flex min-h-11 flex-col justify-center rounded-md px-3 py-1.5 text-left hover:bg-[var(--wh-hover)]">
                      <span className="text-sm font-bold">{c.name}</span>
                      <span className="text-[13px] text-[var(--wh-muted)]">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                  {found.data.length === 0 ? <span className="px-3 py-1.5 text-[13px] text-[var(--wh-muted)]">No customer matches “{term}”.</span> : null}
                </div>
              ) : null}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-bike" className={LABEL}>Bike</label>
            <select id="cd-bike" className={INPUT} disabled={!customer} value={bikeId ?? ''} onChange={(e) => setBikeId(e.target.value ? Number(e.target.value) : null)}>
              {!customer ? <option value="">Select a customer first</option> : <option value="">No bike</option>}
              {bikeList.map((b) => <option key={b.id} value={b.id}>{bikeName(b)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          {manyDays ? (
            <p className="m-0 text-sm text-[var(--wh-muted)]">Each day’s date and time are changed in the diary.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cd-date" className={LABEL}>Date</label>
                <input id="cd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cd-start" className={LABEL}>Start time</label>
                  <input id="cd-start" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cd-end" className={LABEL}>End time</label>
                  <input id="cd-end" type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT} />
                </div>
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <span id="cd-mech" className={LABEL}>Mechanic</span>
            <div role="radiogroup" aria-labelledby="cd-mech" className="flex flex-wrap gap-1.5">
              {people.map((p) => <Pill key={p.id} on={mech === p.id} onClick={() => setMech(p.id)}>{p.name}</Pill>)}
              <Pill on={mech === null} onClick={() => setMech(null)}>Shared queue</Pill>
            </div>
          </div>
        </div>
        {error ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)] md:col-span-2">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !title.trim()} onClick={save}>Save changes</Button>
      </DialogFooter>
    </Dialog>
  );
}
