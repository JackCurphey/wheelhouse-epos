import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { Pill } from './change-details-dialog.tsx';

/**
 * Storage slots (Workshop day 27; openspec/changes/storage-slots): where a bike
 * in the shop is kept, from the shop's own list in Settings › Workshop ›
 * Storage slots. The pills are the drawn "Where the bike is kept" (new-job,
 * till-book-in); none is chosen to start, and choosing one is optional.
 */
export type StorageSlot = { id: number; name: string };

/**
 * Whether the shop's slots are on, and its slots (undefined while they load).
 * `ask` is whether Book in should ask where the bike is kept: slots on, and
 * not known to be none, so a quick tap before the list arrives still asks.
 */
export function useStorageSlots(): { on: boolean; slots: StorageSlot[]; ask: boolean } {
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<{ storageSlotsOn?: boolean }>('/api/workshop-settings') });
  const on = Boolean(settings.data?.storageSlotsOn);
  const slots = useQuery({ queryKey: ['storage-slots'], queryFn: () => apiGet<StorageSlot[]>('/api/storage-slots'), enabled: on });
  return { on, slots: on ? slots.data ?? [] : [], ask: on && (slots.data === undefined || slots.data.length > 0) };
}

export function SlotPills({ slots, value, onChange, id }: { slots: StorageSlot[]; value: number | null; onChange: (id: number | null) => void; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-sm font-semibold">Where the bike is kept</span>
      <RadioPillGroup pickOnMove={false} aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {/* A second tap on the chosen slot takes the bike off it. */}
        {slots.map((s) => <Pill key={s.id} on={value === s.id} onClick={() => onChange(value === s.id ? null : s.id)}>{s.name}</Pill>)}
      </RadioPillGroup>
    </div>
  );
}

/**
 * The drawn till-book-in box, for Book in (title "Book in · job WH-1042")
 * and for moving a bike already in ("Where the bike is kept"). Not now
 * closes it with nothing changed.
 */
export function SlotDialog({ job, slots, title, busy, onDone, onClose }: {
  job: WorkshopJob; slots: StorageSlot[]; title: string; busy: boolean; onDone: (slotId: number | null) => void; onClose: () => void;
}) {
  const [slot, setSlot] = useState<number | null>(job.storageSlotId);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="slot-title" className="md:max-w-[560px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="slot-title">{title}</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">{[job.customerName, job.bikeLabel, job.title].filter(Boolean).join(' · ')}</span>
        </div>
      </DialogHeader>
      <DialogBody>
        <SlotPills id="slot-pills" slots={slots} value={slot} onChange={setSlot} />
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>Not now</Button>
        <Button variant="accent" disabled={busy} onClick={() => onDone(slot)}>Done</Button>
      </DialogFooter>
    </Dialog>
  );
}
