import * as React from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { BookFrame } from './frame.tsx';

/**
 * "Ask the shop a question": the customer's one conversation with the shop
 * (openspec/changes/ask-the-shop-screens design 1; drawn as conversationPage in
 * account.mjs: ac-ask, ac-account-question-sent, ac-question; Jack's day
 * answers of 26 Oct, 2 and 8). Her messages, her notes on each repair (marked
 * "About WH-…", opening that repair) and the shop's replies, oldest first;
 * hers on the right, the shop's on the left, as the repair page's notes
 * (notes-card.tsx). By her sign-in: signed out, it goes to sign-in and back.
 * No live updates yet (WP-1.9), so it reads again every 30 seconds.
 */
type Message = {
  id: number; fromCustomer: boolean; from: string; text: string; at: string;
  about: { jobId: number; reference: string | null } | null;
};
type Conversation = { shopName: string; items: Message[] };

// In London's time, as the repair page's notes.
const part = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...o }).format(new Date(iso));
const when = (iso: string) => `${part(iso, { weekday: 'short' })} ${part(iso, { day: 'numeric' })} ${part(iso, { month: 'short' })}, ${part(iso, { hour: '2-digit', minute: '2-digit', hour12: false })}`;

const BOX_ID = 'conv-reply';

export function ConversationScreen() {
  const { shopSlug = '' } = useParams();
  const home = `/book/${shopSlug}`;
  const url = `/api/portal/${encodeURIComponent(shopSlug)}/messages`;
  const key = ['account', shopSlug, 'messages'];
  const queryClient = useQueryClient();
  const thread = useQuery({ queryKey: key, queryFn: () => apiGet<Conversation>(url), retry: false, refetchOnWindowFocus: false, refetchInterval: 30_000 });
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Filled after a send, in a region already on the page, so it's announced (audit M10).
  const [said, setSaid] = React.useState('');

  if (thread.error instanceof ApiError && thread.error.status === 401) {
    return <Navigate replace to={`${home}/sign-in?from=${encodeURIComponent(`${home}/messages`)}`} />;
  }
  if (thread.isPending) return <BookFrame title="Loading…">{null}</BookFrame>;
  if (!thread.data) {
    return (
      <BookFrame title="We couldn’t load your messages" back={`${home}/account`} backLabel="Your account">
        <Button variant="accent" onClick={() => void thread.refetch()}>Try again</Button>
      </BookFrame>
    );
  }
  const { shopName, items } = thread.data;
  const letYouKnow = `We’ll let you know when ${shopName} replies.`;
  const title = `Messages with ${shopName}`;

  async function send() {
    const words = text.trim();
    if (!words) return;
    setSending(true);
    setError(null);
    setSaid('');
    try {
      const saved = await apiMutate<Conversation>(url, { text: words }, { method: 'POST' });
      queryClient.setQueryData(key, saved);
      queryClient.invalidateQueries({ queryKey: ['account', shopSlug, 'history'] }).catch(() => {});
      setText('');
      setSaid(`Sent. ${letYouKnow}`);
    } catch (err) {
      // Too long, or too many at once: the shop's own words. Anything else, a general line.
      setError(err instanceof ApiError && err.status === 401 ? 'Please sign in again to send this.'
        : err instanceof ApiError && (err.status === 400 || err.status === 429) && err.hasServerMessage ? err.message
          : 'Wheelhouse couldn’t send that. Try again in a moment.');
    } finally {
      setSending(false);
    }
  }

  return (
    <BookFrame title={title} back={`${home}/account`} backLabel="Your account" wide="medium">
      <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--wh-border)] p-4 lg:p-5">
        {items.length ? (
          <ol aria-label={title} className="m-0 flex list-none flex-col gap-3 p-0">
            {items.map((m) => (
              <li key={m.id} data-from={m.fromCustomer ? 'customer' : 'shop'} className={`flex flex-col gap-1 ${m.fromCustomer ? 'items-end' : 'items-start'}`}>
                <span className="text-size-13 text-[var(--wh-muted)]"><strong className="text-[var(--wh-ink)]">{m.fromCustomer ? 'You' : m.from}</strong>{` · ${when(m.at)}`}</span>
                <span className={`max-w-[82%] px-3.5 py-2.5 text-size-15 leading-normal whitespace-pre-wrap [overflow-wrap:anywhere] ${m.fromCustomer
                  ? 'rounded-[14px_14px_4px_14px] border border-[var(--wh-border)] bg-[var(--wh-surface-muted)]'
                  : 'rounded-[14px_14px_14px_4px] border border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{m.text}</span>
                {/* A note on a repair, marked with it and opening it (day answers 2.5). */}
                {m.about?.reference ? (
                  <Link to={`${home}/booking/job-${m.about.jobId}`} className="inline-flex min-h-8 items-center gap-1 text-size-13 font-semibold text-[var(--wh-ink)]">
                    About <span className="font-[family-name:var(--wh-font-mono)]">{m.about.reference}</span><span aria-hidden="true">›</span>
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
        <p role="status" className="m-0 text-sm text-[var(--wh-muted)] empty:hidden">{said}</p>
        <div className="flex flex-col gap-2">
          <label htmlFor={BOX_ID} className="text-size-15 font-semibold">{items.length ? 'Your message' : 'Ask the shop a question'}</label>
          <Textarea id={BOX_ID} rows={3} placeholder="Type here" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <p className="m-0 text-sm text-[var(--wh-muted)]">{letYouKnow}</p>
            <Button variant="accent" className="min-h-11" disabled={sending} onClick={() => void send()}>Send</Button>
          </div>
          {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
        </div>
      </div>
    </BookFrame>
  );
}
