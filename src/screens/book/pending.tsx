import * as React from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client.ts';
import { BookFrame } from './frame.tsx';
import { useBookingLink, type BookingLink } from './pending-query.ts';
import {
  COPIED_MS, EXPIRED, LOAD_FAILED, NOT_FOUND, answerLines, contactLine, serviceLines, statusText, totalLine, whenLine,
} from './pending-rules.ts';

/**
 * The pending screen (atlas `pending`): where the booking is up to, as its
 * heading, and a summary of what was booked. The private link the server
 * issues opens it cold, so it reads everything from the link, never the
 * draft. No step, no back link, no action; changing or cancelling online
 * comes with d6, so until then it says to contact the shop.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export function PendingScreen() {
  const { shopSlug = '', code = '' } = useParams();
  const link = useBookingLink(shopSlug, code);
  if (link.data) return <BookingView link={link.data} />;
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

function BookingView({ link }: { link: BookingLink }) {
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
  // An unrecognised stage (statusText returns undefined) must not break the
  // screen: the heading is left empty rather than crashing BookFrame, which
  // requires a string title, and the rest of the summary still renders.
  return (
    <BookFrame title={statusText(link.stage) ?? ''}>
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
        {answers.length > 0 && (
          <dl className="m-0 mt-2">
            {answers.map((a, i) => (
              <div key={i} className="mb-1">
                <dt className="text-xs text-[var(--wh-muted)]">{a.wording}</dt>
                <dd className="m-0">{a.answer}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <p className="m-0 mb-2">Keep this link to check your booking</p>
      <Button className="mb-4" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
      <p className="m-0">{contactLine(link.shopName)}</p>
    </BookFrame>
  );
}
