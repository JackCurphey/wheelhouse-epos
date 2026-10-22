import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { Dialog, DialogBody, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { channelWord } from './channel-word.ts';
import { signedOffWhen } from './sign-off-dialog.tsx';

/**
 * The job's messages, the outbox (Jack, 20 Oct,
 * docs/decisions/2026-10-20-messages-engine.md answer 2; drawn as
 * job-messages): the job page's "Message [customer]" button opens
 * "Messages", a conversation like a messaging app's. The shop's messages sit
 * on the right in dark bubbles, each with its name and state above and how
 * and when below; the customer's on the left; oldest at the top. Messages are
 * pretend for now, which the pop-up says.
 */
export type JobMessage = {
  id: number; key: string | null; name: string; channel: string; to: string | null; body: string;
  state: 'intended' | 'sending' | 'delivered' | 'failed' | 'unknown' | 'undone';
  pretend: boolean; sendAfter: string | null; sentAt: string | null; error: string | null; createdAt: string;
  direction?: 'outbound' | 'inbound';
};

export const jobMessagesKey = (jobId: number) => ['job-messages', jobId];

const TONE = {
  amber: 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]',
  grey: 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]',
  green: 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]',
  red: 'bg-[var(--wh-danger-bg)] text-[var(--wh-danger-hover)]',
};

const londonDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
// "goes at 10:15" today; a message waiting longer (the quote reminder) says its day.
const goesAt = (iso: string) => (londonDay(iso) === londonDay(new Date().toISOString()) ? `goes at ${clock(iso)}` : `goes ${signedOffWhen(iso)}`);
const clock = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

// The state's word and colour, and what follows "By text to …".
function describe(m: JobMessage): { word: string; tone: keyof typeof TONE; when: string } {
  switch (m.state) {
    // Past its time and not yet claimed by the sender's next round.
    case 'intended': return { word: 'Waiting', tone: 'amber', when: m.sendAfter && Date.parse(m.sendAfter) > Date.now() ? goesAt(m.sendAfter) : 'going now' };
    case 'sending': return { word: 'Sending', tone: 'amber', when: 'going now' };
    case 'delivered': return { word: m.pretend ? 'Pretend' : 'Sent', tone: m.pretend ? 'grey' : 'green', when: signedOffWhen(m.sentAt ?? m.createdAt) };
    case 'undone': return { word: 'Undone', tone: 'grey', when: 'stopped with Undo' };
    case 'failed': return { word: 'Not sent', tone: 'red', when: m.error ?? 'it couldn’t go' };
    case 'unknown':
    default: return { word: 'Not sure it went', tone: 'red', when: 'the server stopped while sending it' };
  }
}

export function JobMessagesButton({ jobId, customerName, title, reference }: { jobId: number; customerName: string; title: string; reference: string | null }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // Back to the button when Messages closes, however it closes.
  function close() {
    setOpen(false);
    setTimeout(() => button.current?.focus(), 0);
  }
  return (
    <>
      <button
        ref={button} type="button" aria-label={`Message ${customerName}`} title={`Message ${customerName}`} onClick={() => setOpen(true)}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] hover:bg-[var(--wh-hover)]"
      >
        {/* The drawing's inbox icon (job-page.mjs). */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </button>
      {open ? <MessagesDialog jobId={jobId} customerName={customerName} title={title} reference={reference} onClose={close} /> : null}
    </>
  );
}

function MessagesDialog({ jobId, customerName, title, reference, onClose }: { jobId: number; customerName: string; title: string; reference: string | null; onClose: () => void }) {
  const messages = useQuery({
    queryKey: jobMessagesKey(jobId),
    queryFn: () => apiGet<JobMessage[]>(`/api/messages?jobId=${jobId}&limit=200`),
    // While one waits its minute, look again so it shows when it's gone.
    // Checked again while one is about to go; a reminder a day away isn't.
    refetchInterval: (q) => (q.state.data?.some((m) => m.state === 'sending' || (m.state === 'intended' && (!m.sendAfter || Date.parse(m.sendAfter) - Date.now() < 120_000))) ? 5000 : false),
  });
  const first = customerName.trim().split(/\s+/)[0] || 'the customer';
  // The server lists newest first; a conversation reads oldest first.
  // A quote reminder stopped because the quote was answered, withdrawn or
  // replaced (or the job moved on) isn't news, so it isn't listed.
  const thread = [...(messages.data ?? [])].filter((m) => !(m.key === 'quote_reminder' && m.state === 'undone')).reverse();
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="job-msgs-title"
      // Full screen on a phone, as drawn (job-messages-phone).
      className="md:max-w-[600px] max-md:open:flex max-md:h-full max-md:max-h-none max-md:max-w-none max-md:flex-col max-md:rounded-none">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="job-msgs-title">Messages</DialogTitle>
          <span className="text-xs text-[var(--wh-muted)]">{[customerName, title, reference].filter(Boolean).join(' · ')}</span>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5 max-md:min-h-0 max-md:grow max-md:overflow-y-auto">
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`Pretend for now: each shows what ${first} would get. Nothing is really sent.`}</p>
        {messages.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the messages. Try again in a moment.</p> : null}
        {messages.data && !thread.length ? <p className="m-0 text-sm">No messages yet.</p> : null}
        {thread.length ? <ol aria-label={`Messages with ${customerName}`} className="m-0 flex list-none flex-col gap-3.5 p-0">
          {thread.map((m) => (m.direction === 'inbound' ? (
            <li key={m.id} data-from="customer" className="flex flex-col items-start gap-1">
              <span className="text-[13px] font-bold">{first}</span>
              <span className="max-w-[85%] rounded-[16px_16px_16px_4px] bg-[var(--wh-surface-muted)] px-3.5 py-2.5 text-sm leading-[1.45] whitespace-pre-wrap [overflow-wrap:anywhere] md:max-w-[78%]">{m.body}</span>
              <span className="text-xs text-[var(--wh-muted)]">{signedOffWhen(m.sentAt ?? m.createdAt)}</span>
            </li>
          ) : (
            <ShopMessage key={m.id} m={m} />
          )))}
        </ol> : null}
      </DialogBody>
    </Dialog>
  );
}

function ShopMessage({ m }: { m: JobMessage }) {
  const d = describe(m);
  return (
    <li data-from="shop" className="flex flex-col items-end gap-1 text-right">
      <span className="flex items-center gap-2">
        <span className="text-[13px] font-bold">{m.name}</span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap ${TONE[d.tone]}`}>{d.word}</span>
      </span>
      <span className="max-w-[85%] rounded-[16px_16px_4px_16px] bg-[var(--wh-ink)] px-3.5 py-2.5 text-left text-sm leading-[1.45] whitespace-pre-wrap [overflow-wrap:anywhere] text-[var(--wh-panel)] md:max-w-[78%]">{m.body}</span>
      <span className="text-xs text-[var(--wh-muted)]">{`By ${channelWord(m.channel)} to ${m.to ?? 'the customer'} · ${d.when}`}</span>
    </li>
  );
}
