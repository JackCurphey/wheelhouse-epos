import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';

/**
 * Settings › Workshop › Checklists (Jack, 22 Oct, docs/decisions/2026-10-22-service-checklists.md;
 * drawn as set-workshop-checklists, set-workshop-checklists-empty and
 * set-workshop-checklist-edit): the shop's own checklists, the services each
 * is used for, and the full service template to start from. A job shows its
 * service's checklist on the job page.
 */
type Checklist = { id: number; name: string; items: string[]; serviceIds: number[] };
type Service = { id: number; name: string; active?: number };
type Editing = { id: number | null; name: string; items: string[]; serviceIds: number[] };

const KEY = ['workshop-checklists'];
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const words = (err: unknown) => (err instanceof ApiError && err.status === 400 ? err.message : SAVE_FAILED);

/** The fold's summary: "None yet", one checklist's name and items, or the names. */
export function useChecklistsSummary(): string {
  const list = useQuery({ queryKey: KEY, queryFn: () => apiGet<Checklist[]>('/api/workshop-checklists') });
  if (!list.data) return '';
  if (list.data.length === 0) return 'None yet';
  if (list.data.length === 1) return `${list.data[0].name} · ${itemCount(list.data[0].items.length)}`;
  return list.data.map((c) => c.name).join(', ');
}

const itemCount = (n: number) => `${n} item${n === 1 ? '' : 's'}`;

export function ChecklistsSettings() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: () => apiGet<Checklist[]>('/api/workshop-checklists') });
  const services = useQuery({ queryKey: ['workshop-services'], queryFn: () => apiGet<Service[]>('/api/workshop-services') });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceName = (id: number) => services.data?.find((s) => s.id === id)?.name;
  const usedFor = (c: Checklist) => {
    const names = c.serviceIds.map(serviceName).filter(Boolean);
    return names.length ? `used for ${names.join(', ')}` : 'not used for a service yet';
  };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
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
    const body = { name: e.name, items: e.items, serviceIds: e.serviceIds };
    const ok = await run(() => (e.id === null
      ? apiMutate('/api/workshop-checklists', body)
      : apiMutate(`/api/workshop-checklists/${e.id}`, body, { method: 'PUT' })));
    if (ok) setEditing(null);
  }

  const startNew = () => { setError(null); setEditing({ id: null, name: '', items: [''], serviceIds: [] }); };
  const rows = list.data ?? [];
  return (
    <div className="flex flex-col gap-2.5">
      {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the checklists. Try again in a moment.</p> : null}
      {list.data && rows.length === 0 ? (
        <>
          <p className="m-0 text-sm text-[var(--wh-muted)]">No checklists yet. A checklist shows on the job page for the services you choose, for the mechanic to tick item by item.</p>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Button variant="primary" disabled={busy} onClick={() => void run(() => apiMutate('/api/workshop-checklists', { template: true }))}>Use the full service template</Button>
            <Button variant="default" disabled={busy} onClick={startNew}>+ Write your own</Button>
          </div>
          <p className="m-0 text-sm text-[var(--wh-muted)]">The template has 10 items, from Frame &amp; fork to Bolts torqued. You can change any of them after.</p>
        </>
      ) : null}
      {rows.length ? (
        <>
          <div className="flex flex-col gap-2">
            {rows.map((c) => (
              <div key={c.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-2 pr-2 pl-3 md:flex-nowrap md:py-0">
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{c.name}</span>
                  <span className="text-[13px] text-[var(--wh-muted)]">{`${itemCount(c.items.length)} · ${usedFor(c)}`}</span>
                </span>
                <span className="ml-auto inline-flex items-center gap-2">
                  <button type="button" aria-label={`Edit ${c.name}`} onClick={() => { setError(null); setEditing({ id: c.id, name: c.name, items: [...c.items], serviceIds: [...c.serviceIds] }); }} className="min-h-11 px-3 text-sm font-semibold">Edit</button>
                  <Button variant="danger" aria-label={`Remove ${c.name}`} disabled={busy} onClick={() => void run(() => apiMutate(`/api/workshop-checklists/${c.id}`, {}, { method: 'DELETE' }))}>Remove</Button>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
            <Button variant="default" onClick={startNew}>+ New checklist</Button>
            <p className="m-0 text-sm text-[var(--wh-muted)]">A job shows its service’s checklist on the job page, for the mechanic to tick.</p>
          </div>
        </>
      ) : null}
      {error && !editing ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      {editing ? (
        <EditChecklist
          start={editing}
          services={(services.data ?? []).filter((s) => s.active !== 0)}
          busy={busy}
          error={error}
          onSave={(e) => void save(e)}
          onClose={() => { setEditing(null); setError(null); }}
        />
      ) : null}
    </div>
  );
}

function EditChecklist({ start, services, busy, error, onSave, onClose }: {
  start: Editing; services: Service[]; busy: boolean; error: string | null; onSave: (e: Editing) => void; onClose: () => void;
}) {
  const [name, setName] = useState(start.name);
  // Each item keeps a key of its own, so moving or removing one keeps the
  // right box with the right words (and the cursor where it was).
  const nextKey = useRef(start.items.length);
  const [items, setItems] = useState(start.items.map((text, key) => ({ key, text })));
  const [serviceIds, setServiceIds] = useState(start.serviceIds);
  const dragging = useRef<number | null>(null);
  const list = useRef<HTMLDivElement>(null);

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setItems(next);
    // The handle keeps focus as its item moves, for the next arrow press.
    setTimeout(() => list.current?.querySelectorAll<HTMLButtonElement>('[data-move]')[to]?.focus(), 0);
  }
  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1); }
  };
  const onDrop = (i: number) => (e: DragEvent) => {
    e.preventDefault();
    if (dragging.current !== null) move(dragging.current, i);
    dragging.current = null;
  };
  function add() {
    setItems([...items, { key: nextKey.current++, text: '' }]);
    setTimeout(() => list.current?.querySelectorAll<HTMLInputElement>('input')[items.length]?.focus(), 0);
  }

  const title = start.id === null ? 'New checklist' : start.name;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="checklist-title" className="md:max-w-[640px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="checklist-title">{title}</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">Its items, in the order the mechanic ticks them</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="checklist-name" className="text-[15px] font-semibold">Name</label>
          <input id="checklist-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm" />
        </div>
        <div className="flex flex-col">
          <span className="pb-1 text-[15px] font-bold">Items</span>
          <div ref={list} className="flex flex-col">
            {items.map((it, i) => {
              const label = it.text.trim() || `item ${i + 1}`;
              return (
                <div key={it.key} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(i)} className="flex min-h-[52px] items-center gap-2 border-t border-[var(--wh-border)] first:border-t-0">
                  <button
                    type="button" data-move draggable
                    aria-label={`Move ${label} — drag, or use the arrow keys`}
                    onKeyDown={onKey(i)}
                    onDragStart={() => { dragging.current = i; }}
                    className="inline-flex size-11 shrink-0 cursor-grab items-center justify-center text-[var(--wh-muted)]"
                  >⋮⋮</button>
                  <input
                    aria-label={`Item ${i + 1}`} value={it.text} maxLength={120}
                    onChange={(e) => setItems(items.map((x) => (x.key === it.key ? { ...x, text: e.target.value } : x)))}
                    className="min-h-11 min-w-0 grow rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm"
                  />
                  <button type="button" aria-label={`Remove ${label}`} onClick={() => setItems(items.filter((x) => x.key !== it.key))} className="inline-flex size-11 shrink-0 items-center justify-center text-[var(--wh-muted)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div><Button variant="default" onClick={add}>+ Add an item</Button></div>
        <div className="flex flex-col gap-2">
          <PillGroup
            multiple legend={<span className="text-[15px] font-bold text-[var(--wh-ink)]">Used for</span>}
            options={services.map((s) => ({ value: String(s.id), label: s.name }))}
            value={serviceIds.map(String)}
            onChange={(v) => setServiceIds(v.map(Number))}
          />
          <p className="m-0 text-sm text-[var(--wh-muted)]">A service has one checklist at most. Jobs already started keep the checklist they began with.</p>
        </div>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => onSave({ id: start.id, name, items: items.map((x) => x.text), serviceIds })}>Save checklist</Button>
      </DialogFooter>
    </Dialog>
  );
}
