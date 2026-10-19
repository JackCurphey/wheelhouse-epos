import * as React from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client.ts';
import { BookFrame } from './frame.tsx';
import { QuoteCard } from './quote-card.tsx';
import { useBookingLink, type BookingLink } from './pending-query.ts';
import {
  COPIED_MS, EXPIRED, LOAD_FAILED, NOT_FOUND, answerLines, bikeRow, contactLine, dropOffLine, pageHeading, serviceLines, statusText, totalLine, whenLine,
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
  const keep = (
    <>
      <p className="m-0 mb-2">Keep this link to check your booking</p>
      <Button className="mb-4" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
      {/* The button's own text already changes for a sighted customer; a screen
          reader user focused elsewhere needs the change announced. */}
      <span role="status" aria-live="polite" className="sr-only">{copied ? 'Copied' : ''}</span>
      <p className="m-0">{contactLine(link.shopName)}</p>
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
  if (link.stage === 'confirmed') {
    const bike = bikeRow(link);
    const row = (label: string, value: React.ReactNode) => (
      <div className="flex justify-between gap-3 border-t border-[var(--wh-border)] py-2 text-[15px]">
        <span data-row="label" className="text-[var(--wh-muted)]">{label}</span>{' '}
        <span className="text-right font-semibold">{value}</span>
      </div>
    );
    return (
      <BookFrame title={pageHeading(link)} eyebrow={`Your repair · ${link.reference}`}>
        <QuoteCard shopSlug={shopSlug} code={code} agreedTotal={typeof link.totalPrice === 'number' ? link.totalPrice : null} />
        <div className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[var(--wh-border)] p-4">
          <div role="status">
            <span className="inline-block rounded-full bg-[var(--wh-status-complete-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--wh-status-complete-ink)]">Booking confirmed</span>
          </div>
          {arrival && <p className="m-0 text-[15px] leading-normal">{arrival}</p>}
          <div>
            {row('Service', serviceLines(link).map((sv, i) => <span key={i} className="block">{sv.price ? `${sv.name} · ${sv.price}` : sv.name}</span>))}
            {total && <p className="m-0 pb-2 text-right text-sm font-semibold">{total}</p>}
            {bike && row('Bike', bike)}
            {row('When', whenLine(link))}
            {row('Your repair', link.reference)}
          </div>
          {(link.description || answerList) && (
            <div className="text-sm">
              {link.description && <p className="m-0">{link.description}</p>}
              {answerList}
            </div>
          )}
          <p data-shop-line className="m-0 border-t border-[var(--wh-border)] pt-2.5 text-sm"><strong>{link.shopName}</strong></p>
        </div>
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
