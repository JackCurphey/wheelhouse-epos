import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';

/**
 * Notes with the shop on the customer's booking page (decision 3; drawn by
 * jobThread in docs/design/user-journeys/generator/account.mjs: ac-job-note,
 * -sent, -answered). The customer's notes on the right, the shop's on the
 * left; "Add a note for the shop" until there is one, then "Reply". The link's
 * code is the key. The thread is read once, not on a timer: the link's guess
 * limit counts every read (decided-while-building, notes with the shop 12).
 */
type Note = { id: number; fromCustomer: boolean; from: string | null; text: string; at: string };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function when(iso: string) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function NotesCard({ shopSlug, code, shopName }: { shopSlug: string; code: string; shopName: string }) {
  const queryClient = useQueryClient();
  const key = ['booking-notes', shopSlug, code];
  const url = `/api/portal/${shopSlug}/booking-links/${code}/notes`;
  const notes = useQuery({ queryKey: key, queryFn: () => apiGet<Note[]>(url), retry: false, refetchOnWindowFocus: false });
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!Array.isArray(notes.data)) return null;
  const list = notes.data;
  const waiting = list.length > 0 && list[list.length - 1].fromCustomer;
  const first = list.length === 0;
  const boxId = 'job-note';

  async function send() {
    const words = text.trim();
    if (!words) return;
    setSending(true);
    setError(null);
    try {
      const saved = await apiMutate<Note[]>(url, { text: words }, { method: 'POST' });
      queryClient.setQueryData(key, saved);
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't send your note. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={`mb-4 flex flex-col gap-3 rounded-md border-2 p-4 ${first ? 'border-[var(--wh-ink)]' : 'border-[var(--wh-border)]'}`} aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="m-0 text-xl font-bold">Notes with the shop</h2>
      {list.length ? (
        <ol aria-label="Notes with the shop" className="m-0 flex list-none flex-col gap-3 p-0">
          {list.map((n) => (
            <li key={n.id} data-from={n.fromCustomer ? 'customer' : 'shop'} className={`flex flex-col gap-1 ${n.fromCustomer ? 'items-end' : 'items-start'}`}>
              <span className="text-[13px] text-[var(--wh-muted)]"><strong className="text-[var(--wh-ink)]">{n.fromCustomer ? 'You' : n.from}</strong>{` · ${when(n.at)}`}</span>
              <span className={`max-w-[82%] px-3.5 py-2.5 text-[15px] leading-normal whitespace-pre-wrap [overflow-wrap:anywhere] ${n.fromCustomer
                ? 'rounded-[14px_14px_4px_14px] bg-[var(--wh-ink)] text-[var(--wh-panel)]'
                : 'rounded-[14px_14px_14px_4px] border border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{n.text}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {waiting ? <p role="status" className="m-0 text-sm text-[var(--wh-muted)]">{`Sent. ${shopName} will reply here, and we’ll text you when they do.`}</p> : null}
      <div className="flex flex-col gap-2">
        <label htmlFor={boxId} className="text-[15px] font-semibold">{first ? 'Add a note for the shop' : 'Reply'}</label>
        <Textarea id={boxId} rows={3} placeholder="Type here" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="m-0 text-sm text-[var(--wh-muted)]">We’ll reply here and text you when we do.</p>
          <Button variant="accent" disabled={sending} onClick={() => void send()}>{first ? 'Send note' : 'Send'}</Button>
        </div>
        {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
      </div>
    </section>
  );
}
