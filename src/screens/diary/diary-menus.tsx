import type { RefObject } from 'react';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { Dialog, DialogBody, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { requestMinutes } from './offer-dialog.tsx';
import { CHIP } from './diary-model.ts';
import { waitingCard, type WaitingItem } from './rules.ts';

/** The floating bar while a time is being chosen: for New job, or for offering a customer another time. */
export function PickBar({ offering, isPhone, enterInsteadRef, cancelRef, onEnterInstead, onCancel }: {
  offering: WorkshopJob | null; isPhone: boolean;
  enterInsteadRef: RefObject<HTMLButtonElement | null>; cancelRef: RefObject<HTMLButtonElement | null>;
  onEnterInstead: () => void; onCancel: () => void;
}) {
  return (
    <div role="status" className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-lg border border-[var(--wh-highlight)] bg-[var(--wh-accent-soft)] px-3 py-2 text-sm text-[var(--wh-accent-soft-ink)] shadow-[0_8px_24px_var(--wh-backdrop)]">
      {offering ? (
        // Drawn as request-offer-pick; Cancel goes back to the request.
        <span className="grow font-semibold">{`${isPhone ? 'Tap a free time' : 'Click a free time in the diary'} to offer ${offering.customerName || 'the customer'} · ${requestMinutes(offering)} minutes.`}</span>
      ) : (
        <>
          <span className="grow font-semibold">Choose a time for the new job.</span>
          <button ref={enterInsteadRef} type="button" onClick={onEnterInstead} className="min-h-11 rounded-md px-3 font-semibold underline">Enter a time instead</button>
        </>
      )}
      <button ref={cancelRef} type="button" onClick={onCancel} className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 font-semibold text-[var(--wh-ink)]">Cancel</button>
    </div>
  );
}

/** A move or length change that couldn't be saved. */
export function MoveErrorBox({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div role="alert" className="pointer-events-auto flex items-center gap-2 rounded-md bg-[var(--wh-danger-bg)] py-1 pr-1 pl-3 text-sm text-[var(--wh-danger-hover)] shadow-[0_8px_24px_var(--wh-backdrop)]">
      <span className="grow py-1">{message}</span>
      <button type="button" aria-label="Close the message" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-[var(--wh-hover)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

/** Drawn as diary-no-message: the floating message, in the panel's colours. */
export function NoticeBox({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-1 pr-1 pl-3.5 text-sm shadow-[0_8px_24px_var(--wh-backdrop)]">
      <span className="grow py-1.5 leading-snug">{message}</span>
      <button type="button" aria-label="Close the message" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-[var(--wh-hover)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

/** The chosen card with Open, at the foot of a phone or an upright tablet, where there's no Waiting column to show it in. */
export function ChosenBar({ item, onOpen }: { item: WaitingItem; onOpen: () => void }) {
  return (
    <div role="status" aria-label="Chosen from Waiting for you" className="flex flex-col gap-1.5 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 pt-2.5 pb-3 shadow-[0_-6px_18px_var(--wh-backdrop)]">
      <div className="flex items-center gap-2.5">
        <div className="flex min-w-0 grow flex-col gap-[3px]">
          <span className={`self-start rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[waitingCard(item).tone]}`}>{waitingCard(item).label}</span>
          <span className="text-[15px] font-bold">{waitingCard(item).customer}</span>
          <span className="text-sm">{waitingCard(item).detail}</span>
        </div>
        <button
          type="button"
          aria-label={`Open ${waitingCard(item).customer}'s request`}
          onClick={onOpen}
          className="inline-flex min-h-11 min-w-[72px] items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-[15px] font-bold text-[var(--wh-on-brand)]"
        >
          Open
        </button>
      </div>
      <span className="text-xs text-[var(--wh-muted)]">Tap the card again to open it.</span>
    </div>
  );
}

/** The Waiting list as a sheet: on a phone, and on an upright tablet where there's no room for its column. */
export function WaitingSheet({ open, onOpenChange, count, items, chosen, onChoose }: {
  open: boolean; onOpenChange: (open: boolean) => void; count: number; items: WaitingItem[]; chosen: number | null; onChoose: (item: WaitingItem) => void;
}) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby="waiting-sheet-title">
        <DialogHeader>
          <DialogTitle id="waiting-sheet-title">{`Waiting for you (${count})`}</DialogTitle>
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="inline-flex size-11 items-center justify-center rounded-lg">
            <NavIcon name="close" size={20} />
          </button>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          {items.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">Nothing waiting.</p> : null}
          {items.map((item) => {
            const card = waitingCard(item);
            const on = chosen === item.jobId;
            return (
              <button
                key={`${item.kind}-${item.jobId}`}
                type="button"
                aria-pressed={on}
                onClick={() => onChoose(item)}
                className={`flex min-h-11 flex-col gap-1 rounded-lg bg-[var(--wh-panel)] px-3 py-2.5 text-left ${on ? 'border-2 border-[var(--accent)]' : 'border border-[var(--wh-border)]'}`}
              >
                <span className={`self-start rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[card.tone]}`}>{card.label}</span>
                <span className="text-[15px] font-bold">{card.customer}</span>
                {card.bike ? <span className="text-[13px] text-[var(--wh-muted)]">{card.bike}</span> : null}
                <span className="text-sm">{card.detail}</span>
              </button>
            );
          })}
        </DialogBody>
      </Dialog>
  );
}
