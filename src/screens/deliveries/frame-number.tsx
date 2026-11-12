import { useState } from 'react';
import { apiGet } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { c2wFor, mono, type OrderItem } from './deliveries-bits.tsx';

/**
 * Frame number (drawn as rs-frame and rs-frame-dup in receiving.mjs; receiving decision 5 and its
 * audit; openspec/changes/frame-numbers, design 5): a bike in a delivery asks for its frame number
 * before it counts. A scanner presses Enter, so Enter counts it as Count this bike does. A frame
 * already in stock, or already in this delivery, is said and not counted. A bike ordered for a
 * Cycle to Work order says whose it is, and that its frame becomes the order's (rs-frame-c2w).
 */
// What's compared, as the server compares it: capitals, no spaces (server/lib/bikes.js frameKey).
export const frameKey = (f: string) => f.replace(/\s+/g, '').toUpperCase();
// "1 Sep 2026": three letters for the month, as the drawings write it.
const part = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/London', ...o });
export const dateText = (iso: string) => `${part(iso, { day: 'numeric' })} ${part(iso, { month: 'short' }).slice(0, 3)} ${part(iso, { year: 'numeric' })}`;

export function FrameNumber({ bike, n, taken, c2w, onCancel, onCount }: { bike: string; n: number; taken: string[]; c2w?: OrderItem['forC2w']; onCancel: () => void; onCount: (frame: string) => void }) {
  const customer = c2w ? c2w.customerName ?? '[Customer]' : null;
  const [text, setText] = useState('');
  // What's wrong with the frame typed: in stock (with when), or in this delivery.
  const [said, setSaid] = useState<{ strong: string; rest: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function count() {
    const frame = text.trim().replace(/\s+/g, ' ');
    if (!frame || busy) return;
    if (taken.map(frameKey).includes(frameKey(frame))) { setSaid({ strong: 'This frame number is already in this delivery.', rest: '' }); return; }
    setBusy(true);
    try {
      const { inStock } = await apiGet<{ inStock: { bookedInAt: string } | null }>(`/api/stock-frames/check?${new URLSearchParams({ number: frame })}`);
      if (inStock) { setSaid({ strong: 'This frame number is already in stock', rest: ` — booked in ${dateText(inStock.bookedInAt)}. Check the sticker, or scan the next bike.` }); setBusy(false); return; }
    } catch {
      // Booking in checks it again; a lost check doesn't stop the count.
    }
    onCount(frame);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }} aria-labelledby="frame-title" className="md:max-w-[560px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="frame-title">Frame number</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">{customer !== null ? `${bike} · ${c2wFor(c2w!.customerName)}` : `${bike} · bike ${n} in this delivery`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <label className={`flex min-h-[52px] items-center gap-2.5 rounded-lg border-2 bg-[var(--wh-panel)] px-3.5 text-[var(--wh-muted)] ${said ? 'border-[var(--wh-warn-ink)]' : 'border-[var(--wh-ink)]'}`}>
          <NavIcon name="search" size={18} />
          {/* Focused as it opens, for the scanner. */}
          <input autoFocus aria-label="Frame number" placeholder="Scan the sticker on the frame, or type it" value={text}
            onChange={(e) => { setText(e.target.value); setSaid(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void count(); } }}
            className={`min-w-0 grow border-0 bg-transparent text-base text-[var(--wh-ink)] placeholder:text-[var(--wh-muted)] focus:outline-none ${mono}`} />
        </label>
        {said ? (
          <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3 py-2.5 text-size-15 text-[var(--wh-warn-ink)]">{<><strong>{said.strong}</strong>{said.rest}</>}</p>
        ) : <p className="m-0 text-sm text-[var(--wh-muted)]">Scanning the sticker counts the bike straight away. A typed number needs “Count this bike”.</p>}
        <p className="m-0 text-sm text-[var(--wh-muted)]">{customer !== null
          ? `This frame becomes the frame on ${customer}’s Cycle to Work order. It’s held for them — not for sale — and the till picks it when they collect.`
          : 'Each bike is then known by its frame number — the till picks it at the sale, and its warranty starts from the right bike.'}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="default" onClick={onCancel}>Cancel</Button>
        <Button variant="accent" disabled={busy || !text.trim()} onClick={() => void count()}>Count this bike</Button>
      </DialogFooter>
    </Dialog>
  );
}
