import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { RowSwitch } from './row-switch.tsx';

/**
 * Settings › Workshop › Services (openspec/changes/services-room; drawn as
 * set-workshop-services, ac-services and ac-service-edit): the shop's services
 * by group, each one's box, adding and removing. Built as Checklists is.
 */
type Kind = 'full' | 'individual';
type Service = { id: number; name: string; price: number; minutes: number | null; active: boolean; bookableOnline: boolean; kind: Kind; reminderMonths: number | null };
type Editing = { id: number | null; name: string; kind: Kind; minutes: string; price: string; bookableOnline: boolean; reminderMonths: string };

const KEY = ['workshop-services'];
const GROUPS = [{ value: 'full', label: 'Full service' }, { value: 'individual', label: 'Individual service' }];
const groupName = (kind: Kind) => (kind === 'full' ? 'Full service' : 'Individual service');
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const words = (err: unknown) => (err instanceof ApiError && (err.status === 400 || err.status === 404) ? err.message : SAVE_FAILED);
const money = (n: number) => `£${n.toFixed(2)}`;
const timeLine = (minutes: number | null) => (minutes ? `${minutes} min in the diary` : '');
// The row's line, as drawn: "60 min in the diary · reminder after [n] months".
const rowLine = (s: Service) => [timeLine(s.minutes), s.reminderMonths ? `reminder after ${s.reminderMonths} months` : ''].filter(Boolean).join(' · ');
const asNumber = (text: string) => (text.trim() === '' ? null : Number.isFinite(Number(text)) ? Number(text) : text);
const INPUT = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm';

/** The fold's summary: the two groups, as drawn. */
export const SERVICES_SUMMARY = 'Full service, Individual service';

export function ServicesSettings() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: () => apiGet<Service[]>('/api/workshop-services') });
  const [kind, setKind] = useState<Kind>('full');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      // New job, Checklists and the booking page read the same list.
      await queryClient.invalidateQueries({ queryKey: KEY });
      return true;
    } catch (err) {
      setError(words(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: Editing) {
    // An empty price is refused here in the shop's own words: sent, it would
    // be read as £0.00. Anything else the box doesn't show is left out, so
    // the shop keeps it (design 4).
    if (e.price.trim() === '') { setError('A service needs a price of zero or more'); return; }
    // A number that isn't one goes as typed, so the shop refuses it in its own words.
    const price = Number.isFinite(Number(e.price)) ? Number(e.price) : e.price;
    const body = { name: e.name, kind: e.kind, minutes: asNumber(e.minutes), price, bookableOnline: e.bookableOnline, reminderMonths: asNumber(e.reminderMonths) };
    const ok = await run(() => (e.id === null
      ? apiMutate('/api/workshop-services', body)
      : apiMutate(`/api/workshop-services/${e.id}`, body, { method: 'PUT' })));
    if (ok) setEditing(null);
  }

  const edit = (s: Service) => {
    setError(null);
    setEditing({ id: s.id, name: s.name, kind: s.kind, minutes: s.minutes ? String(s.minutes) : '', price: s.price.toFixed(2), bookableOnline: s.bookableOnline, reminderMonths: s.reminderMonths ? String(s.reminderMonths) : '' });
  };
  // A new service is on for online booking, as the box's line says (design 3).
  const startNew = () => { setError(null); setEditing({ id: null, name: '', kind, minutes: '', price: '', bookableOnline: true, reminderMonths: '' }); };
  const rows = (list.data ?? []).filter((s) => s.active && s.kind === kind);
  return (
    <div className="flex flex-col gap-2.5">
      {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the services. Try again in a moment.</p> : null}
      <PillGroup legend={<span className="sr-only">Service groups</span>} options={GROUPS} value={kind} onChange={(v) => setKind(v as Kind)} />
      <div className="flex flex-col gap-2">
        {rows.map((s) => (
          <div key={s.id} className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-2 pr-2 pl-3 md:flex-nowrap md:py-0">
            <span className="flex min-w-0 grow flex-col gap-px">
              <span className="text-size-15 font-semibold">{s.name}</span>
              {rowLine(s) ? <span className="text-xs text-[var(--wh-muted)]">{rowLine(s)}</span> : null}
            </span>
            <span className="font-[family-name:var(--wh-font-mono)] text-sm">{money(s.price)}</span>
            <span className="ml-auto inline-flex items-center gap-2">
              <button type="button" aria-label={`Edit ${s.name}`} onClick={() => edit(s)} className="min-h-11 px-3 text-sm font-semibold">Edit</button>
              <Button variant="danger" aria-label={`Remove ${s.name}`} disabled={busy} onClick={() => void run(() => apiMutate(`/api/workshop-services/${s.id}`, {}, { method: 'DELETE' }))}>Remove</Button>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <Button variant="default" onClick={startNew}>+ Add a service</Button>
        <p className="m-0 text-sm text-[var(--wh-muted)]">Groups and services show as pills, in this order, when a job is booked.</p>
      </div>
      {error && !editing ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      {editing ? (
        <EditService start={editing} busy={busy} error={error} onSave={(e) => void save(e)} onClose={() => { setEditing(null); setError(null); }} />
      ) : null}
    </div>
  );
}

function EditService({ start, busy, error, onSave, onClose }: {
  start: Editing; busy: boolean; error: string | null; onSave: (e: Editing) => void; onClose: () => void;
}) {
  const [e, setE] = useState(start);
  const set = (patch: Partial<Editing>) => setE({ ...e, ...patch });
  const title = start.id === null ? 'New service' : start.name;
  // As drawn under the title: "Individual service · 60 min in the diary · [£ price]".
  const line = start.id === null ? null
    : [groupName(start.kind), timeLine(start.minutes ? Number(start.minutes) : null), money(Number(start.price))].filter(Boolean).join(' · ');
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="service-title" className="md:max-w-[520px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="service-title">{title}</DialogTitle>
          {line ? <span className="text-size-13 text-[var(--wh-muted)]">{line}</span> : null}
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="svc-name" className="text-size-15 font-semibold">Name</label>
          <input id="svc-name" value={e.name} maxLength={200} onChange={(ev) => set({ name: ev.target.value })} className={INPUT} />
        </div>
        <PillGroup legend={<span className="text-size-15 font-semibold text-[var(--wh-ink)]">Group</span>} options={GROUPS} value={e.kind} onChange={(v) => set({ kind: v as Kind })} />
        <div className="flex flex-col gap-2">
          <label htmlFor="svc-time" className="text-size-15 font-semibold">Time in the diary</label>
          <span className="inline-flex items-center gap-2 text-size-15">
            <input id="svc-time" inputMode="numeric" value={e.minutes} onChange={(ev) => set({ minutes: ev.target.value })} className={`${INPUT} w-[72px] text-center`} />min
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="svc-price" className="text-size-15 font-semibold">Price</label>
          <span className="inline-flex items-center gap-2 text-size-15">
            <input id="svc-price" inputMode="decimal" value={e.price} onChange={(ev) => set({ price: ev.target.value })} className={`${INPUT} w-[120px] font-[family-name:var(--wh-font-mono)]`} />
          </span>
        </div>
        {/* When its reminder is due (ac-service-edit; account and reminders decision 2).
            The drawn line about the wording waits for the Service reminder message. */}
        <div className="flex flex-col gap-2">
          <label htmlFor="svc-rem" className="text-size-15 font-semibold">Remind customers it’s due after</label>
          <span className="inline-flex items-center gap-2 text-size-15">
            <input id="svc-rem" inputMode="numeric" value={e.reminderMonths} onChange={(ev) => set({ reminderMonths: ev.target.value })} className={`${INPUT} w-16 text-center`} />months
          </span>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Counted from when the bike is collected. Only customers who said yes get it. Leave empty for no reminder — for a puncture, say.</p>
        </div>
        {/* The walk-through's line for the box (coverage 7: on unless switched off). */}
        <RowSwitch label="Customers can book this online" on={e.bookableOnline} disabled={busy} onChange={(on) => set({ bookableOnline: on })} />
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => onSave(e)}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}
