import * as React from 'react';
import { Link, useParams } from 'react-router';
import { Bike, Check, TriangleAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client.ts';
import { penceText } from '@/lib/money.ts';
import { cn } from '@/lib/utils';
import { BookFrame } from './frame.tsx';
import { RoundIcon } from './round-icon.tsx';
import { useC2wLink, type C2wView } from './c2w-query.ts';

/**
 * The customer's Cycle to Work page (cw-customer-view, cw-customer-released,
 * cw-customer-cancelled; openspec/changes/cycle-to-work design 8, PR 9b),
 * opened from the private link in the messages, with no sign-in. Where the
 * order is up to, whether the bike is put aside, what's in the order and how
 * to apply. A link that doesn't work says so and nothing more.
 *
 * Left out while building (decided-while-building, 12 Nov, PR 9b): "See your
 * quote", as the customer has no quote page yet (the quote comes by email);
 * the deposit sentence when cancelled, as deposits aren't built (question 1);
 * each stage's date, as the link doesn't carry them.
 */
export function C2wScreen() {
  const { shopSlug = '', code = '' } = useParams();
  const view = useC2wLink(shopSlug, code);
  if (view.data) return <OrderView view={view.data} shopSlug={shopSlug} />;
  if (view.isError && view.error instanceof ApiError && view.error.status === 404) {
    return (
      <BookFrame title="This link doesn’t work">
        <RoundIcon tone="warn" size="size-11"><TriangleAlert size={24} aria-hidden="true" /></RoundIcon>
        <p className="m-0">Check you opened the whole link from your message.</p>
      </BookFrame>
    );
  }
  if (view.isError) {
    return (
      <BookFrame title="We couldn’t open this link">
        <Button variant="accent" onClick={() => void view.refetch()}>Try again</Button>
      </BookFrame>
    );
  }
  return <BookFrame title="Loading…">{null}</BookFrame>;
}

// "8 September 2026", as the quote and its messages print a date (server/c2w/orders.js longDate).
const longDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// The drawn line at the top of the order's box, by whether the bike is put aside.
function TopLine({ view }: { view: C2wView }) {
  const line = view.state === 'held' && view.holdUntil
    ? { tone: 'grey', strong: `Your bike is put aside until ${longDate(view.holdUntil)}.`, rest: 'We’ll let you know when your certificate reaches us.' }
    : view.state === 'released'
      ? { tone: 'warn', strong: 'Your bike is no longer put aside.', rest: 'We’ll still get you one when your certificate comes.' }
      : view.state === 'cancelled'
        ? { tone: 'grey', strong: 'This order is cancelled.', rest: '' }
        : null;
  if (!line) return null;
  const warn = line.tone === 'warn';
  return (
    <p className={cn('m-0 flex items-start gap-2 rounded-lg px-3 py-2.5 text-size-15 leading-snug', warn ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-ink)]')}>
      {warn ? <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" /> : <Bike size={18} aria-hidden="true" className="mt-0.5 shrink-0" />}
      <span><strong>{line.strong}</strong>{line.rest ? ` ${line.rest}` : ''}</span>
    </p>
  );
}

function Stages({ labels, at }: { labels: string[]; at: number }) {
  return (
    <ol aria-label="Stages" className="m-0 grid list-none grid-cols-2 gap-1.5 p-0 sm:grid-cols-5">
      {labels.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li key={s} aria-current={now ? 'step' : undefined}
            className={cn('flex flex-col gap-1 rounded-lg px-2.5 py-2 text-size-13', now ? 'border-2 border-[var(--wh-ink)]' : 'border border-[var(--wh-border)]', done ? 'bg-[var(--wh-surface-muted)]' : 'bg-[var(--wh-panel)]')}>
            <span className={cn('inline-flex items-center gap-1.5 font-bold', done || now ? 'text-[var(--wh-ink)]' : 'text-[var(--wh-muted)]')}>
              {done ? <Check size={14} aria-hidden="true" /> : <span className="w-3.5 text-center">{i + 1}</span>}
              {s}
            </span>
            <span className="text-[var(--wh-muted)]">{done ? 'Done' : now ? 'Now' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t border-[var(--wh-border)] py-1.5 text-size-15">
      <dt className="text-[var(--wh-muted)]">{label}</dt>
      <dd className="m-0 text-right">{children}</dd>
    </div>
  );
}

function OrderView({ view, shopSlug }: { view: C2wView; shopSlug: string }) {
  const home = `/book/${shopSlug}`;
  const where = view.place ? `${view.shopName}, ${view.place}` : view.shopName;
  return (
    <BookFrame title="Your Cycle to Work bike" back={`${home}/account`} backLabel="Your account" wide="medium">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`Quote ${view.quoteRef} · ${where} · ${view.providerName}`}</p>
        {/* No stage once cancelled: the server sends none. */}
        {view.stageIndex !== null && <Stages labels={view.stages} at={view.stageIndex} />}
        <section aria-label="Your order" className="flex flex-col gap-2.5 rounded-[10px] border border-[var(--wh-border)] p-4">
          <TopLine view={view} />
          <dl className="m-0">
            <Row label="Bike">{view.bike}</Row>
            {view.accessories.length > 0 && <Row label="Accessories">{view.accessories.join(' · ')}</Row>}
            <Row label="Total (includes VAT)"><span className="font-mono">{penceText(view.totalPence)}</span></Row>
          </dl>
          <div className="flex flex-wrap gap-2.5">
            <Link to={`${home}/messages`} className={cn(buttonVariants({ variant: 'default' }), 'no-underline')}>Ask the shop a question</Link>
          </div>
        </section>
        {view.howToApply && (
          <section aria-labelledby="c2w-how" className="flex flex-col gap-2.5 rounded-[10px] border border-[var(--wh-border)] p-4">
            <h2 id="c2w-how" className="m-0 text-size-15 font-bold">How to apply</h2>
            <p className="m-0 whitespace-pre-line text-size-15 leading-normal">{view.howToApply}</p>
          </section>
        )}
      </div>
    </BookFrame>
  );
}
