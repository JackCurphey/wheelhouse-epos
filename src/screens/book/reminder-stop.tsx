import * as React from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { BookFrame } from './frame.tsx';
import { RoundIcon } from './round-icon.tsx';

/**
 * "Stop these" for service reminders (openspec/changes/stop-reminders; drawn
 * as ac-stopped and ac-stopped-on; account and reminders decision 6; Jack's
 * answer 5 of 25 Oct). The page a reminder's link opens, with no sign-in.
 * Opening it asks first, so a phone or email app checking the link can't stop
 * them; the press stops them. Then the drawn pages: stopped, with Turn them
 * back on, and on again. A code that doesn't work says so and nothing more.
 * The drawn "Sign in to your account" line waits for the customer's account.
 */
type Kind = 'service_reminders' | 'review_requests' | 'own_message';
// An own message carries its name (openspec/changes/own-messages-server design 7).
type View = { shopName: string; kind?: Kind; name?: string; on: boolean };
type Words = { ask: string; askBody: (shop: string) => string; button: string; stopped: string; stoppedBody: string; on: string; onBody: string; again: string };

// The same page for each kind, with its own name (audit M5; review-requests design 6).
// Service reminders' words are drawn (ac-stopped, ac-stopped-on); review requests' follow them.
const WORDS: Record<Exclude<Kind, 'own_message'>, Words> = {
  service_reminders: {
    ask: 'Stop service reminders?',
    askBody: (shop) => `We’ll stop sending you service reminders from ${shop}. Job updates about a bike that’s with us still come as usual.`,
    button: 'Stop service reminders',
    stopped: 'Service reminders stopped',
    stoppedBody: 'We won’t send you service reminders any more. Job updates about a bike that’s with us still come as usual.',
    on: 'Service reminders are on again',
    onBody: 'We’ll remind you when your bike is due its next service. Stop them any time with the link at the end of each one.',
    again: 'Turn them back on',
  },
  review_requests: {
    ask: 'Stop review requests?',
    askBody: (shop) => `We’ll stop asking you for reviews from ${shop}. Job updates about a bike that’s with us still come as usual.`,
    button: 'Stop review requests',
    stopped: 'Review requests stopped',
    stoppedBody: 'We won’t ask you for reviews any more. Job updates about a bike that’s with us still come as usual.',
    on: 'Review requests are on again',
    onBody: 'We’ll ask for a review after you collect your bike. Stop them any time with the link at the end of each one.',
    again: 'Turn them back on',
  },
};

// One of the shop's own messages, by its name: stops just that one (Jack's
// answer 2 of 26 Oct). Not drawn; the same page as the review request's.
const ownWords = (name: string): Words => ({
  ask: `Stop “${name}”?`,
  askBody: (shop) => `We’ll stop sending you “${name}” from ${shop}. Job updates about a bike that’s with us still come as usual.`,
  button: `Stop “${name}”`,
  stopped: `“${name}” stopped`,
  stoppedBody: `We won’t send you “${name}” any more. Job updates about a bike that’s with us still come as usual.`,
  on: `“${name}” is on again`,
  onBody: `We’ll send you “${name}” again. Stop it any time with the link at the end of each one.`,
  again: 'Turn it back on',
});

const isGone = (err: unknown) => err instanceof ApiError && err.status === 404;

export function ReminderStopScreen() {
  const { shopSlug = '', code = '' } = useParams();
  const url = `/api/portal/${encodeURIComponent(shopSlug)}/reminder-stops/${encodeURIComponent(code)}`;
  const view = useQuery({ queryKey: ['reminder-stop', shopSlug, code], queryFn: () => apiGet<View>(url), retry: false, refetchOnWindowFocus: false });
  // What the customer last did here: nothing yet, stopped, or turned back on.
  const [done, setDone] = React.useState<'stopped' | 'on' | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function press(stop: boolean) {
    setBusy(true);
    setFailed(false);
    try {
      await apiMutate(url, { stop }, { method: 'POST' });
      setDone(stop ? 'stopped' : 'on');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (view.isPending) return <BookFrame title="Loading…">{null}</BookFrame>;
  if (view.isError && isGone(view.error)) {
    return (
      <BookFrame title="This link doesn’t work">
        <RoundIcon tone="warn" size="size-11"><TriangleAlert size={24} aria-hidden="true" /></RoundIcon>
        <p className="m-0">Check you opened the whole link from your message.</p>
      </BookFrame>
    );
  }
  if (view.isError || !view.data) {
    return (
      <BookFrame title="We couldn’t open this link">
        <Button variant="accent" onClick={() => view.refetch()}>Try again</Button>
      </BookFrame>
    );
  }
  const kind = view.data.kind ?? 'service_reminders';
  const w = kind === 'own_message' ? ownWords(view.data.name ?? 'these messages') : WORDS[kind];
  const oops = failed ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">That didn’t go through. Check your connection and try again.</p> : null;

  if (done === 'on') {
    return (
      <BookFrame title={w.on}>
        <RoundIcon tone="ok" size="size-11"><Check size={22} aria-hidden="true" /></RoundIcon>
        <p role="status" className="m-0">{w.onBody}</p>
      </BookFrame>
    );
  }
  if (done === 'stopped' || !view.data.on) {
    return (
      <BookFrame title={w.stopped}>
        <RoundIcon tone="ok" size="size-11"><Check size={22} aria-hidden="true" /></RoundIcon>
        <p role="status" className="m-0">{w.stoppedBody}</p>
        {oops}
        <div><Button disabled={busy} onClick={() => void press(false)}>{w.again}</Button></div>
        {/* The drawn way to everything else (ac-stopped; how-we-contact-you design 3). */}
        <p className="m-0 text-sm text-[var(--wh-muted)]">
          Want to change anything else?{' '}
          <Link to={`/book/${shopSlug}/sign-in?from=${encodeURIComponent(`/book/${shopSlug}/account`)}`} className="inline-flex min-h-11 items-center font-semibold text-[var(--wh-ink)]">Sign in to your account</Link>
          {' '}and go to “How we contact you”.
        </p>
      </BookFrame>
    );
  }
  // The press, before anything stops (answer 5; not drawn, so as the stopped page).
  return (
    <BookFrame title={w.ask}>
      <p className="m-0">{w.askBody(view.data.shopName)}</p>
      {oops}
      <div><Button variant="accent" disabled={busy} onClick={() => void press(true)}>{w.button}</Button></div>
    </BookFrame>
  );
}
