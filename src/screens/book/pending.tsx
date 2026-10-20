import * as React from 'react';
import { Link, useParams } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants } from '@/components/ui/button';
import { ApiError, apiMutate } from '@/lib/api/client.ts';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookFrame } from './frame.tsx';
import { QuoteCard } from './quote-card.tsx';
import { ChangeDate } from './change-date.tsx';
import { bookingLinkPath, useBookingLink, type BookingLink } from './pending-query.ts';
import {
  COPIED_MS, EXPIRED, LOAD_FAILED, NOT_FOUND, answerLines, bikeRow, cancelSubline, cancelledLine, changeLine, contactLine, declinedLine, dropOffLine, pageHeading, requestedLine, serviceLines, statusText, totalLine, whenLine,
} from './pending-rules.ts';

/**
 * The pending screen (screen design `pending`): where the booking is up to, as its
 * heading, and a summary of what was booked. The booking link the server
 * issues opens it cold, so it reads everything from the link, never the
 * draft. No step, no back link, no action; changing or cancelling online
 * comes with d6, so until then it says to contact the shop.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export function PendingScreen() {
  const { shopSlug = '', code = '' } = useParams();
  const link = useBookingLink(shopSlug, code);
  if (link.data) return <BookingView link={link.data} shopSlug={shopSlug} code={code} />;
  if (link.isError) {
    const status = link.error instanceof ApiError ? link.error.status : 0;
    if (status === 404) return <BookFrame title={NOT_FOUND}>{null}</BookFrame>;
    if (status === 410) return <BookFrame title={EXPIRED}>{null}</BookFrame>;
    return (
      <BookFrame title={LOAD_FAILED}>
        <Button variant="accent" onClick={() => void link.refetch()}>Try again</Button>
      </BookFrame>
    );
  }
  return <BookFrame title="Loading…">{null}</BookFrame>;
}

function BookingView({ link, shopSlug, code }: { link: BookingLink; shopSlug: string; code: string }) {
  const [copied, setCopied] = React.useState(false);
  // Change the date's strip, open in place of the buttons (drawn as bk-change).
  const [changing, setChanging] = React.useState(false);
  // "Copied" for a moment, then back. The state is set in the timer's
  // callback, not in the effect itself.
  React.useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // No clipboard, or it was refused: the address bar still has the link.
    }
  };

  const total = totalLine(link);
  const answers = answerLines(link);
  const arrival = [dropOffLine(link), link.confirmationNote].filter(Boolean).join(' ');
  // A booking still waiting for the shop opens as a request (bk-page-request).
  const request = link.stage === 'awaiting_confirmation';
  const standing = link.stage === 'confirmed' || link.stage === 'change_requested' || request;
  const keep = (
    <>
      <p className="m-0 mb-2">Keep this link to check your booking</p>
      <Button className="mb-4" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
      {/* The button's own text already changes for a sighted customer; a screen
          reader user focused elsewhere needs the change announced. */}
      <span role="status" aria-live="polite" className="sr-only">{copied ? 'Copied' : ''}</span>
      {/* Once the page offers both, no contact line; with Cancel only, it's about the date. */}
      {!(standing && link.canChange) && <p className="m-0">{standing && link.canCancel ? changeLine(link.shopName) : contactLine(link.shopName)}</p>}
    </>
  );
  const answerList = answers.length > 0 && (
    <dl className="m-0 mt-2">
      {answers.map((a, i) => (
        <div key={i} className="mb-1">
          <dt className="text-xs text-[var(--wh-muted)]">{a.wording}</dt>
          <dd className="m-0">{a.answer}</dd>
        </div>
      ))}
    </dl>
  );

  // A confirmed booking, to its drawing (Jack, 19 Oct; drawn as bk-page):
  // "Your repair · [reference]" over the bike and the work, then a card with
  // the badge, when to drop off and the note, the rows and the shop's name.
  // Changing and cancelling online come later, so the link and contact lines stay.
  // A cancelled booking (drawn as bk-cancelled). No texts are sent yet, so
  // the drawing's "We've sent you a text to confirm." is left out.
  if (link.stage === 'cancelled') {
    return (
      <BookFrame title="Your booking is cancelled" eyebrow="Cancelled">
        <div className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[var(--wh-border)] p-4">
          <p className="m-0 text-[15px] leading-normal">{cancelledLine(link)}</p>
          <div>
            <Link to={`/book/${shopSlug}`} className={buttonVariants({ variant: 'default' })}>Book another time</Link>
          </div>
          <p data-shop-line className="m-0 border-t border-[var(--wh-border)] pt-2.5 text-sm"><strong>{link.shopName}</strong></p>
        </div>
      </BookFrame>
    );
  }

  // A confirmed booking, or one with a change waiting (bk-change-pending), on
  // the drawn page; a change the shop declined says so at the top (bk-change-declined).
  if (standing) {
    const waiting = link.stage === 'change_requested';
    const bike = bikeRow(link);
    const row = (label: string, value: React.ReactNode) => (
      <div className="flex justify-between gap-3 border-t border-[var(--wh-border)] py-2 text-[15px]">
        <span data-row="label" className="text-[var(--wh-muted)]">{label}</span>{' '}
        <span className="text-right font-semibold">{value}</span>
      </div>
    );
    return (
      <BookFrame title={request ? 'Your booking request' : pageHeading(link)} eyebrow={`Your repair · ${link.reference}`}>
        <QuoteCard shopSlug={shopSlug} code={code} agreedTotal={typeof link.totalPrice === 'number' ? link.totalPrice : null} />
        <div className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[var(--wh-border)] p-4">
          {link.stage === 'confirmed' && link.changeDeclined && (
            <p role="status" className="m-0 flex gap-2.5 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-3 text-[15px] leading-snug text-[var(--wh-warn-ink)]"><TriangleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" /><span>{declinedLine(link)}</span></p>
          )}
          {/* Shown on arrival, not news, so not announced (bk-page's plain badge; fresh review). */}
          <div>
            {request
              ? <span className="inline-block rounded-full bg-[var(--wh-status-pending-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--wh-status-pending-ink)]">Waiting for the shop to confirm</span>
              : waiting
              ? <span className="inline-block rounded-full bg-[var(--wh-status-pending-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--wh-status-pending-ink)]">New date waiting for the shop</span>
              : <span className="inline-block rounded-full bg-[var(--wh-status-complete-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--wh-status-complete-ink)]">Booking confirmed</span>}
          </div>
          {waiting && requestedLine(link) && <p className="m-0 text-[15px] leading-normal">{requestedLine(link)}</p>}
          {/* No texts are sent yet, so the drawing's "We'll send you a text" becomes this page. */}
          {request && <p className="m-0 text-[15px] leading-normal">Please wait for the shop to confirm before bringing your bike in. Check this page to see when it does.</p>}
          {arrival && <p className="m-0 text-[15px] leading-normal">{arrival}</p>}
          <div>
            {row('Service', serviceLines(link).map((sv, i) => <span key={i} className="block">{sv.price ? `${sv.name} · ${sv.price}` : sv.name}</span>))}
            {total && <p className="m-0 pb-2 text-right text-sm font-semibold">{total}</p>}
            {bike && row('Bike', bike)}
            {row('When', whenLine(link))}
            {row('Your repair', <span className="font-[family-name:var(--wh-font-mono)]">{link.reference}</span>)}
          </div>
          {(link.description || answerList) && (
            <div className="text-sm">
              {link.description && <p className="m-0">{link.description}</p>}
              {answerList}
            </div>
          )}
          <p data-shop-line className="m-0 border-t border-[var(--wh-border)] pt-2.5 text-sm"><strong>{link.shopName}</strong></p>
        </div>
        {changing ? <ChangeDate link={link} shopSlug={shopSlug} code={code} request={request} onClose={() => setChanging(false)} /> : (
          <div className="mb-4 flex flex-wrap gap-2.5">
            {waiting && <WithdrawChange shopSlug={shopSlug} code={code} />}
            {!waiting && link.canChange && <Button onClick={() => setChanging(true)}>Change the date</Button>}
            {link.canCancel && <CancelBooking link={link} shopSlug={shopSlug} code={code} request={request} />}
          </div>
        )}
        {keep}
      </BookFrame>
    );
  }

  // An unrecognised stage (statusText returns undefined) must not break the
  // screen: the heading is left empty rather than crashing BookFrame, which
  // requires a string title, and the rest of the summary still renders.
  return (
    <BookFrame title={statusText(link.stage) ?? ''}>
      {/* A quote waiting for the customer's answer comes first (journey 4). */}
      <QuoteCard shopSlug={shopSlug} code={code} agreedTotal={typeof link.totalPrice === 'number' ? link.totalPrice : null} />
      {/* When to drop the bike off, then the shop's additional note, once the
          booking stands (Jack, 19 Oct; drawn in bk-confirmed as one paragraph). */}
      {arrival && <p className="m-0 mb-3 text-[15px] leading-normal">{arrival}</p>}
      <div className="mb-4 rounded-md border border-[var(--wh-border)] p-3 text-sm">
        <p className="m-0 mb-2 flex justify-between gap-3">
          {/* The {' '} spaces keep the words apart for a screen reader, as ChoiceCard does. */}
          <span className="text-[var(--wh-muted)]">Reference</span>{' '}<strong>{link.reference}</strong>
        </p>
        <ul className="m-0 mb-2 list-none p-0">
          {serviceLines(link).map((s, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{s.name}</span>
              {s.price && <>{' '}<span>{s.price}</span></>}
            </li>
          ))}
        </ul>
        {total && <p className="m-0 mb-2 font-semibold">{total}</p>}
        <p className="m-0">{whenLine(link)}</p>
        {link.bikeNote && <p className="m-0">{link.bikeNote}</p>}
        {link.description && <p className="m-0">{link.description}</p>}
        {/* Who checked it, once ready, if the shop shows it (Jack, 18 Oct; drawn as cp-summary-checked). */}
        {link.checkedBy && <p className="m-0" data-checked-by="true">Checked by <strong>{link.checkedBy}</strong></p>}
        {answerList}
      </div>
      {keep}
    </BookFrame>
  );
}

/**
 * Cancel booking (Jack, 1 Oct, decision 10; 19 Oct; drawn as bk-cancel, with
 * bk-cancel-ls's words since no shop takes deposits yet): asked once; the
 * reply replaces the cached link, so the page becomes the cancelled page.
 */
function CancelBooking({ link, shopSlug, code, request = false }: { link: BookingLink; shopSlug: string; code: string; request?: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const close = () => { setOpen(false); setError(null); };

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const reply = await apiMutate<BookingLink>(`${bookingLinkPath(shopSlug, code)}/cancel`, {}, { method: 'POST' });
      queryClient.setQueryData(['portal', shopSlug, 'booking-link', code], reply);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t cancel that. Try again in a moment.');
      // A refusal means the booking changed (the bike came in, or it can't be
      // cancelled online now): read it again so the page stops offering it.
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: ['portal', shopSlug, 'booking-link', code] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => { setError(null); setOpen(true); }}>{request ? 'Cancel request' : 'Cancel booking'}</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }} aria-labelledby="cancel-title" aria-describedby="cancel-sub">
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle id="cancel-title">{request ? 'Cancel this request?' : 'Cancel this booking?'}</DialogTitle>
            <span id="cancel-sub" className="text-[13px] text-[var(--wh-muted)]">{cancelSubline(link)}</span>
          </div>
          <DialogClose onClick={close} />
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="m-0 text-[15px] leading-normal">There’s nothing to pay or refund.</p>
          {error && <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p>}
        </DialogBody>
        <DialogFooter className="flex justify-between gap-2.5">
          <Button variant="ghost" onClick={close}>{request ? 'Keep my request' : 'Keep my booking'}</Button>
          <Button variant="danger" disabled={busy} onClick={() => void cancel()}>{request ? 'Cancel request' : 'Cancel booking'}</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

/** Cancel my date change (bk-change-pending): the booking goes back to its own date. */
function WithdrawChange({ shopSlug, code }: { shopSlug: string; code: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      const reply = await apiMutate<BookingLink>(`${bookingLinkPath(shopSlug, code)}/withdraw-change`, {}, { method: 'POST' });
      queryClient.setQueryData(['portal', shopSlug, 'booking-link', code], reply);
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t do that. Try again in a moment.');
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: ['portal', shopSlug, 'booking-link', code] });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button disabled={busy} onClick={() => void withdraw()}>Cancel my date change</Button>
      {error && <p role="alert" className="m-0 basis-full text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p>}
    </>
  );
}
