import * as React from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { BookFrame } from './frame.tsx';

/**
 * "Stop these" for service reminders (openspec/changes/stop-reminders; drawn
 * as ac-stopped and ac-stopped-on; account and reminders decision 6; Jack's
 * answer 5 of 25 Oct). The page a reminder's link opens, with no sign-in.
 * Opening it asks first, so a phone or email app checking the link can't stop
 * them; the press stops them. Then the drawn pages: stopped, with Turn them
 * back on, and on again. A code that doesn't work says so and nothing more.
 * The drawn "Sign in to your account" line waits for the customer's account.
 */
type View = { shopName: string; on: boolean };

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
        <RoundIcon tone="warn"><TriangleAlert size={24} aria-hidden="true" /></RoundIcon>
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
  const oops = failed ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">That didn’t go through. Check your connection and try again.</p> : null;

  if (done === 'on') {
    return (
      <BookFrame title="Service reminders are on again">
        <RoundIcon tone="ok"><Check size={22} aria-hidden="true" /></RoundIcon>
        <p role="status" className="m-0">We’ll remind you when your bike is due its next service. Stop them any time with the link at the end of each one.</p>
      </BookFrame>
    );
  }
  if (done === 'stopped' || !view.data.on) {
    return (
      <BookFrame title="Service reminders stopped">
        <RoundIcon tone="ok"><Check size={22} aria-hidden="true" /></RoundIcon>
        <p role="status" className="m-0">We won’t send you service reminders any more. Job updates about a bike that’s with us still come as usual.</p>
        {oops}
        <div><Button disabled={busy} onClick={() => void press(false)}>Turn them back on</Button></div>
      </BookFrame>
    );
  }
  // The press, before anything stops (answer 5; not drawn, so as the stopped page).
  return (
    <BookFrame title="Stop service reminders?">
      <p className="m-0">{`We’ll stop sending you service reminders from ${view.data.shopName}. Job updates about a bike that’s with us still come as usual.`}</p>
      {oops}
      <div><Button variant="accent" disabled={busy} onClick={() => void press(true)}>Stop service reminders</Button></div>
    </BookFrame>
  );
}

/** The drawn round icon on the stopped pages, as the photo step's (roundIcon). */
function RoundIcon({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const look = tone === 'ok' ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-state-ready-ink)]' : 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]';
  return <span className={`mb-3 inline-flex size-11 items-center justify-center rounded-full ${look}`}>{children}</span>;
}
