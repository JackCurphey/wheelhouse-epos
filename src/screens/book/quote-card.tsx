import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';

/**
 * The quote on the customer's booking link (journey 4; drawn by quoteCard,
 * answered and withdrawn in docs/design/user-journeys/generator/quote.mjs).
 * No sign-in: the link's code is the key. The customer ticks what they want
 * (Needed lines start ticked, Optional ones not - the mechanic's
 * recommendation), sees the new total, and sends the whole answer once.
 * Spec: docs/superpowers/specs/2026-10-03-quote-stage-design.md (piece 3)
 */

type QuoteLine = {
  id: number; description: string; lineTotal: number; decision: 'pending' | 'approved' | 'declined';
  need: 'needed' | 'optional'; reason: string | null; decidedVia: string | null; decidedAt?: string | null; decidedByName: string | null;
  goesWithLineId?: number | null; without?: string | null;
};
// mechanicName and each line's decidedByName come only with the shop's "Show
// who signed off to customers" switch on; without them the card says "we"
// (Jack, 22 Oct).
type Quote = {
  id: number; revision: number; state: string; sentAt: string | null; lines: QuoteLine[];
  mechanicName?: string | null; customerFirstName?: string | null;
};

const money = (n: number) => `£${Number(n).toFixed(2)}`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function sentLine(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `Sent ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${hhmm(d)}`;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const firstName = (name: string | null | undefined) => (name ? name.trim().split(/\s+/)[0] : null);

/** The drawn "Call [shop phone]" link, or the words "the shop" with no phone. */
function Phone({ phone }: { phone: string | null }) {
  return phone ? <a href={`tel:${phone}`} className="font-semibold text-[var(--wh-ink)]">{phone}</a> : <>the shop</>;
}

const CARD = 'mb-4 flex flex-col gap-3 rounded-md border-2 border-[var(--wh-ink)] p-4';
const BADGE = 'inline-flex self-start rounded-full px-2.5 py-0.5 text-xs font-bold';

export function QuoteCard({ shopSlug, code, agreedTotal, shopPhone = null, done = false, hideAnswered = false }: {
  shopSlug: string; code: string; agreedTotal: number | null; shopPhone?: string | null; done?: boolean; hideAnswered?: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ['booking-quote', shopSlug, code];
  const quote = useQuery({
    queryKey: key,
    queryFn: () => apiGet<Quote>(`/api/portal/${shopSlug}/booking-links/${code}/quote`),
    retry: false,
  });
  const q = quote.data;
  const [ticks, setTicks] = React.useState<Record<number, boolean> | null>(null);
  const [sending, setSending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  // Said to screen readers when a tick also changed the line's partner.
  const [pairNote, setPairNote] = React.useState('');
  // Nothing to show without a quote (a 404 means the booking has none).
  if (!q || !Array.isArray(q.lines)) return null;

  // Lines that go together (decision 2): a part and every labour line that
  // goes with it tick and untick as one, starting ticked if any is Needed.
  const groupOf = (l: QuoteLine) => {
    const part = l.goesWithLineId ?? (q.lines.some((o) => o.goesWithLineId === l.id) ? l.id : null);
    return part === null ? [l] : q.lines.filter((o) => o.id === part || o.goesWithLineId === part);
  };
  const tick = ticks ?? Object.fromEntries(q.lines.map((l) => [l.id, groupOf(l).some((o) => o.need === 'needed')]));
  const agreed = agreedTotal ?? 0;
  const mechanic = firstName(q.mechanicName);
  const thanks = q.customerFirstName ? `Thanks, ${q.customerFirstName}` : 'Thanks';

  if (q.state === 'withdrawn') {
    return (
      <section className={CARD} aria-labelledby="quote-heading">
        <span className={`${BADGE} bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]`}>Quote withdrawn</span>
        <h2 id="quote-heading" className="m-0 text-xl font-bold">{mechanic ? `${mechanic} has withdrawn this quote` : 'We’ve withdrawn this quote'}</h2>
        <p className="m-0">Nothing to answer. Call <Phone phone={shopPhone} /> if you have a question.</p>
      </section>
    );
  }

  if (q.state === 'approved' || q.state === 'partly_approved' || q.state === 'declined') {
    // Where the page lists the agreed work itself (Work agreed), the answer isn't listed twice (fresh review).
    if (hideAnswered) return null;
    const yes = q.lines.filter((l) => l.decision === 'approved');
    const no = q.lines.filter((l) => l.decision === 'declined');
    const phone = q.lines.find((l) => l.decidedVia === 'phone' || l.decidedVia === 'in_shop');
    return (
      <section className={CARD} aria-labelledby="quote-heading">
        {/* Once the work is done, the answer is the drawings' "What we did"
            (cp-summary; booking page stages, 21 Oct). */}
        {!done && <span className={`${BADGE} bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]`}>Answered</span>}
        <h2 id="quote-heading" className="m-0 text-xl font-bold">
          {done ? 'What we did'
            : phone ? `Your answers, from your ${phone.decidedVia === 'phone' ? 'call' : 'visit'}`
            : yes.length ? `${thanks} — ${mechanic ? `${mechanic} is carrying on` : 'we’re carrying on'}`
            : `${thanks} — ${mechanic ? `${mechanic} will` : 'we’ll'} carry on with the service`}
        </h2>
        {done ? null : phone ? (
          <p className="m-0">{`You answered ${phone.decidedVia === 'phone' ? 'by phone' : 'in the shop'}${phone.decidedByName ? ` with ${phone.decidedByName}` : ''}${phone.decidedAt ? ` at ${hhmm(new Date(phone.decidedAt))}` : ''}. Here’s what was agreed.`}</p>
        ) : (
          <p className="m-0">{yes.length ? 'We’ve saved your answers. The work you agreed is going ahead.' : 'You didn’t add any extra work. We’ve saved your answers.'}</p>
        )}
        <ul className="m-0 list-none p-0 text-sm">
          {yes.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 border-t border-[var(--wh-border)] py-2">
              <span>{l.description}</span>
              <span>{money(l.lineTotal)}</span>
            </li>
          ))}
          {no.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 border-t border-[var(--wh-border)] py-2 text-[var(--wh-muted)]">
              <span>{`${l.description} · no thanks`}</span>
              <span className="line-through">{money(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (q.state !== 'sent') return null;
  const ticked = q.lines.filter((l) => tick[l.id]);
  const partners = (l: QuoteLine) => groupOf(l).filter((o) => o.id !== l.id);
  function setTick(l: QuoteLine, on: boolean) {
    const others = partners(l).filter((o) => Boolean(tick[o.id]) !== on);
    setTicks({ ...tick, [l.id]: on, ...Object.fromEntries(others.map((o) => [o.id, on])) });
    setPairNote(others.map((o) => `${o.description} ${on ? 'ticked' : 'unticked'} too.`).join(' '));
  }
  const total = agreed + ticked.reduce((s, l) => s + Number(l.lineTotal), 0);
  const label = ticked.length ? `Approve ${money(total)}` : 'Decline the extra work';

  async function send() {
    if (!q) return;
    setSending(true);
    setMessage(null);
    try {
      const decisions = q.lines.map((l) => ({ lineId: l.id, decision: tick[l.id] ? 'approved' as const : 'declined' as const }));
      const saved = await apiMutate<{ state: string }>(`/api/portal/${shopSlug}/booking-links/${code}/quote/answer`, { revision: q.revision, decisions });
      // Show what was just saved, from the server's answer.
      queryClient.setQueryData<Quote>(key, {
        ...q,
        state: saved.state,
        lines: q.lines.map((l) => ({ ...l, decision: tick[l.id] ? 'approved' : 'declined', decidedVia: 'online' })),
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'pair') {
        // A split pair: the shop's words, and the ticks stay as they were.
        setMessage(err.message);
      } else if (err instanceof ApiError && err.status === 409) {
        setMessage('The quote has changed since you opened it. Please look at it again.');
        setTicks(null);
        void quote.refetch();
      } else {
        setMessage(err instanceof ApiError ? err.message : "We couldn't send your answer. Check your connection and try again.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={CARD} aria-labelledby="quote-heading">
      <span className={`${BADGE} bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]`}>Waiting for your answer</span>
      <h2 id="quote-heading" className="m-0 text-xl font-bold">{mechanic ? `${mechanic} recommends more work` : 'We recommend more work'}</h2>
      {sentLine(q.sentAt) ? <p className="m-0 text-sm text-[var(--wh-muted)]">{sentLine(q.sentAt)}</p> : null}
      <p className="m-0 font-semibold">Untick anything you don&apos;t want.</p>
      <ul className="m-0 list-none p-0" aria-labelledby="quote-heading">
        {q.lines.map((l) => (
          <li key={l.id} className="flex flex-col gap-1.5 border-t border-[var(--wh-border)] py-3">
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-[22px] shrink-0 accent-[var(--wh-ink)]"
                checked={Boolean(tick[l.id])}
                onChange={(e) => setTick(l, e.target.checked)}
                aria-label={`${l.description}, ${l.need}, ${money(l.lineTotal)}`}
              />
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{l.description}</span>
                  <span className={`${BADGE} ${l.need === 'needed' ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]'}`}>
                    {l.need === 'needed' ? 'Needed' : 'Optional'}
                  </span>
                  <span className="ml-auto">{money(l.lineTotal)}</span>
                </span>
                {l.reason ? <span className="text-sm">{l.reason}</span> : null}
              </span>
            </label>
            {/* Drawn only when the mechanic wrote what happens without it (dq-quote-decline). */}
            {l.need === 'needed' && !tick[l.id] && l.without ? (
              <p className="m-0 ml-[34px] rounded-md bg-[var(--wh-warn-bg)] px-3 py-2 text-sm text-[var(--wh-warn-ink)]">
                <strong>{mechanic ? `${mechanic} recommends this.` : 'We recommend this.'}</strong> <span>{l.without}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {agreedTotal !== null ? (
        <p className="m-0 flex justify-between gap-3 border-t border-[var(--wh-border)] pt-2 text-sm">
          <span className="text-[var(--wh-muted)]">Already agreed</span><span>{money(agreedTotal)}</span>
        </p>
      ) : null}
      <p aria-live="polite" className="m-0 flex justify-between gap-3 border-t border-[var(--wh-border)] pt-2">
        <strong>New total</strong><strong>{money(total)}</strong>
        {pairNote ? <span className="sr-only">{pairNote}</span> : null}
      </p>
      <p className="m-0 text-sm font-semibold">Your answers are final once sent.</p>
      <p className="m-0 text-sm text-[var(--wh-muted)]">Prices include VAT. Nothing to pay today.</p>
      {message ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{message}</p> : null}
      <Button variant="accent" className="self-end" disabled={sending} onClick={() => void send()}>{label}</Button>
      <p className="m-0 border-t border-[var(--wh-border)] pt-2.5 text-sm">Not sure? Call <Phone phone={shopPhone} />.</p>
    </section>
  );
}
