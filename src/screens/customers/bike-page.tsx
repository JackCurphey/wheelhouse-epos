import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Field } from './customers-page.tsx';
import { HistoryRow, Section, type Item } from './customer-page.tsx';

/**
 * A bike's own page (openspec/changes/bike-page; drawn as cs-bike,
 * customer.mjs:150-183; Jack's answer of 15 Oct, not-drawn pages #7 and #8),
 * laid out as a customer's page is: back to the owner, the bike's name with
 * "[Customer]’s bike" and New job; Details with Edit and Belongs to on the
 * left, its jobs on the right. The Warranty block waits until a bike can be
 * bought here (nothing records it yet, so no made-up date).
 */
type Job = Omit<Extract<Item, { kind: 'job' }>, 'kind'>;
type Bike = {
  id: number; make: string; model: string; colour: string; serialNumber: string; notes: string; active: boolean;
  customer: { id: number; name: string; phone: string | null };
  jobs: Job[];
};
const SHOWN = 8;
const mono = 'font-[family-name:var(--wh-font-mono)]';
const nameOf = (b: { make: string; model: string }) => [b.make, b.model].filter(Boolean).join(' ') || 'A bike';

export function BikePage() {
  const id = Number(useParams().id ?? '');
  const known = Number.isInteger(id);
  const isPhone = useMedia('(max-width: 767px)');
  const bike = useQuery({ queryKey: ['bike', id], queryFn: () => apiGet<Bike>(`/api/bikes/${id}`), retry: false, enabled: known });
  const [editing, setEditing] = useState(false);
  const [all, setAll] = useState(false);
  if (!known || bike.isError) {
    return <p role="alert" className="m-0 text-sm">{!known || (bike.error instanceof ApiError && bike.error.status === 404) ? 'Bike not found' : 'Wheelhouse couldn’t load this bike. Try again in a moment.'}</p>;
  }
  const b = bike.data;
  if (!b) return <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>;
  const owner = ROUTES['cs-page'].replace(':id', String(b.customer.id));
  const open = b.jobs.filter((j) => j.open);
  const rest = b.jobs.filter((j) => !j.open);
  const earlier = all ? rest : rest.slice(0, Math.max(0, SHOWN - open.length));
  const row = (j: Job) => <HistoryRow key={j.id} item={{ kind: 'job', ...j }} />;
  const head = (t: string, listId: string) => <span id={listId} className="pt-2.5 pb-1 text-size-13 font-bold text-[var(--wh-muted)]">{t}</span>;
  const fact = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--wh-border)] py-2">
      <span className="text-size-13 text-[var(--wh-muted)]">{label}</span>
      <span className="text-right text-size-15 font-semibold">{value}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-2.5">
      <Link to={owner} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline"><span aria-hidden="true">‹</span>{b.customer.name}</Link>
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex grow flex-col gap-[3px]">
          <h2 className="m-0 text-size-22 font-bold">{nameOf(b)}</h2>
          <span className="text-sm text-[var(--wh-muted)]">{`${b.customer.name}’s bike`}</span>
        </span>
        <Link to={`${ROUTES.diary}?customer=${b.customer.id}&bike=${b.id}`} className="inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--wh-on-brand)] no-underline">New job</Link>
      </div>
      <div className={`flex gap-4 ${isPhone ? 'flex-col' : 'flex-row items-start'}`}>
        <div className={`flex shrink-0 flex-col rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] pt-1 pb-3.5 ${isPhone ? '' : 'w-80'}`}>
          <Section id="h-bike-details" title="Details" action={<button type="button" onClick={() => setEditing(true)} className="min-h-11 px-2 text-sm font-semibold underline">Edit</button>}>
            {b.colour ? fact('Colour', b.colour) : null}
            {b.serialNumber ? fact('Frame number', <span className={mono}>{b.serialNumber}</span>) : null}
            {b.notes ? (
              <div className="flex flex-col gap-1 rounded-lg bg-[var(--wh-surface-muted)] px-3 py-2.5">
                <span className="text-size-13 font-bold">Note</span>
                <span className="text-sm leading-[1.45]">{b.notes}</span>
              </div>
            ) : null}
          </Section>
          <Section id="h-belongs" title="Belongs to">
            <Link to={owner} className="flex min-h-11 items-center justify-between gap-3 border-t border-[var(--wh-border)] py-2 text-[var(--wh-ink)] no-underline">
              <span className="text-size-15 font-semibold underline">{b.customer.name}</span>
              {b.customer.phone ? <span className={`text-sm ${mono}`}>{b.customer.phone}</span> : null}
            </Link>
          </Section>
        </div>
        <section aria-labelledby="h-bike-jobs" className="flex min-w-0 grow flex-col gap-1.5 self-start rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5 max-md:self-stretch">
          <h3 id="h-bike-jobs" className="m-0 text-size-17 font-bold">Jobs on this bike</h3>
          {b.jobs.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No jobs on this bike yet.</p> : (
            <div className="flex flex-col">
              {open.length ? <>{head('Open now', 'h-bike-open')}<ul aria-labelledby="h-bike-open" className="m-0 list-none p-0">{open.map(row)}</ul></> : null}
              {earlier.length ? <>{head('Earlier, newest first', 'h-bike-earlier')}<ul aria-labelledby="h-bike-earlier" className="m-0 list-none p-0">{earlier.map(row)}</ul></> : null}
              {!all && open.length + earlier.length < b.jobs.length ? (
                <button type="button" onClick={() => setAll(true)} className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline">{`Show all (${b.jobs.length})`}</button>
              ) : null}
            </div>
          )}
        </section>
      </div>
      {editing ? <EditBike bike={b} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

/**
 * The bike's Edit box: not drawn (not-drawn-pages.md:121), so as the customer
 * page's Edit is, with the bike's fields.
 */
function EditBike({ bike, onClose }: { bike: Bike; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ make: bike.make, model: bike.model, colour: bike.colour, serialNumber: bike.serialNumber, notes: bike.notes });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  async function save() {
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/bikes/${bike.id}`, form, { method: 'PUT' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bike', bike.id] }),
        queryClient.invalidateQueries({ queryKey: ['customer-bikes', bike.customer.id] }),
      ]);
      onClose();
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="edit-bike-title" className="md:max-w-[520px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="edit-bike-title">Edit bike</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">Nothing changes until you save</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field id="bike-make" label="Make" value={form.make} onChange={set('make')} />
          <Field id="bike-model" label="Model" value={form.model} onChange={set('model')} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field id="bike-colour" label="Colour" value={form.colour} onChange={set('colour')} />
          <Field id="bike-frame" label="Frame number" value={form.serialNumber} onChange={set('serialNumber')} />
        </div>
        <Field id="bike-note" label="Note" value={form.notes} onChange={set('notes')} />
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}
