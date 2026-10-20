import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { channelWord } from './channel-word.ts';
import { signedOffWhen } from './sign-off-dialog.tsx';

/**
 * The job's messages, the outbox (Jack, 20 Oct,
 * docs/decisions/2026-10-20-messages-engine.md answer 2; drawn as
 * job-messages): under Notes, newest first, each with its name, its state,
 * how and when it goes, and the words. Messages are pretend for now, which
 * the panel says. A job with no messages shows nothing.
 */
export type JobMessage = {
  id: number; key: string | null; name: string; channel: string; to: string | null; body: string;
  state: 'intended' | 'sending' | 'delivered' | 'failed' | 'unknown' | 'undone';
  pretend: boolean; sendAfter: string | null; sentAt: string | null; error: string | null; createdAt: string;
};

export const jobMessagesKey = (jobId: number) => ['job-messages', jobId];

const TONE = {
  amber: 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]',
  grey: 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]',
  green: 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]',
  red: 'bg-[var(--wh-danger-bg)] text-[var(--wh-danger-hover)]',
};

const clock = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

// The state's word and colour, and what follows "By text to …".
function describe(m: JobMessage): { word: string; tone: keyof typeof TONE; when: string } {
  switch (m.state) {
    case 'intended': return { word: 'Waiting', tone: 'amber', when: m.sendAfter ? `goes at ${clock(m.sendAfter)}` : 'waiting' };
    case 'sending': return { word: 'Sending', tone: 'amber', when: 'going now' };
    case 'delivered': return { word: m.pretend ? 'Pretend' : 'Sent', tone: m.pretend ? 'grey' : 'green', when: signedOffWhen(m.sentAt ?? m.createdAt) };
    case 'undone': return { word: 'Undone', tone: 'grey', when: 'stopped with Undo' };
    case 'failed': return { word: 'Not sent', tone: 'red', when: m.error ?? 'it couldn’t go' };
    default: return { word: 'Not sure it went', tone: 'red', when: 'the server stopped while sending it' };
  }
}

export function JobMessages({ jobId, firstName }: { jobId: number; firstName: string }) {
  const messages = useQuery({
    queryKey: jobMessagesKey(jobId),
    queryFn: () => apiGet<JobMessage[]>(`/api/messages?jobId=${jobId}`),
    // While one waits its minute, look again so it shows when it's gone.
    refetchInterval: (q) => (q.state.data?.some((m) => m.state === 'intended' || m.state === 'sending') ? 5000 : false),
  });
  const list = messages.data ?? [];
  if (!list.length) return null;
  return (
    <section aria-labelledby="job-msgs" className="flex flex-col gap-1 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 pt-2.5 pb-1">
      <h3 id="job-msgs" className="m-0 text-sm font-bold">Messages</h3>
      <p className="m-0 mb-1 text-[13px] text-[var(--wh-muted)]">{`Pretend for now: each shows what ${firstName} would get. Nothing is really sent.`}</p>
      <ul className="m-0 list-none p-0">
        {list.map((m) => {
          const d = describe(m);
          return (
            <li key={m.id} className="flex flex-col gap-[3px] border-t border-[var(--wh-border)] py-2">
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold">{m.name}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap ${TONE[d.tone]}`}>{d.word}</span>
              </span>
              <span className="text-xs text-[var(--wh-muted)]">{`By ${channelWord(m.channel)} to ${m.to ?? 'the customer'} · ${d.when}`}</span>
              <span className="text-[13px] leading-[1.45] whitespace-pre-wrap">{m.body}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
