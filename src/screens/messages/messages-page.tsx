import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft } from 'lucide-react';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { channelWord } from '@/screens/diary/channel-word.ts';

/**
 * Front desk › Messages: the staff inbox (decision 7, docs/decisions/2026-10-01-account-and-reminders-review.md;
 * drawn as inbox() in docs/design/user-journeys/generator/account.mjs:
 * ac-inbox, ac-inbox-sent, ac-inbox-all, ac-inbox-list, ac-inbox-empty,
 * ac-reply-text). One conversation per customer (Jack, 26 Oct, day answers
 * 8.2; openspec/changes/ask-the-shop-screens design 3): their general messages
 * and their notes on each repair, each marked with it. Conversations on the
 * left, "Needs a reply" first; the open one on the right (on a phone, on its
 * own with a way back). The open customer is in the address (?customer=).
 * There are no live updates yet (WP-1.9), so the list is read again every 30
 * seconds while it's open.
 */
type About = { jobId: number; reference: string | null; bikeLabel?: string | null };
type Row = { customerId: number; customerName: string; lastText: string; lastAt: string; needsReply: boolean; about: About | null };
type Note = { id: number; fromCustomer: boolean; from: string | null; text: string; at: string; about: About | null };
type Thread = { customerId: number; customerName: string; phone: string | null; items: Note[] };
type Told = { status: 'sent' | 'not_sent'; channel?: string; reason?: string };

// A row's second line when its newest message is a general one (the redrawn ac-inbox).
const FROM_ACCOUNT = 'From their account';
const ref = (a: About) => a.reference ?? `job ${a.jobId}`;

const NOTE = 'Messages from customers — from a job’s page, or their account. Replies go the way each customer chose, with a link back.';
const part = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...o }).format(new Date(iso));
const time = (iso: string) => part(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
const dayTime = (iso: string) => `${part(iso, { weekday: 'short' })} ${part(iso, { day: 'numeric' })} ${part(iso, { month: 'short' })}, ${time(iso)}`;
const withinWeek = (iso: string) => Date.now() - Date.parse(iso) < 6 * 86_400_000;
const sameDay = (a: string, b: Date) => part(a, { year: 'numeric', month: '2-digit', day: '2-digit' }) === part(b.toISOString(), { year: 'numeric', month: '2-digit', day: '2-digit' });
const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || 'the customer';

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
      mq?.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
  );
}

export function MessagesPage() {
  const isPhone = useMedia('(max-width: 767px)');
  const [params, setParams] = useSearchParams();
  const open = Number(params.get('customer')) || null;
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState<'needs-reply' | 'all'>('needs-reply');
  // Replies half typed, kept per conversation while Messages is open (fresh review).
  const [drafts] = useState(() => new Map<number, string>());
  const list = useQuery({
    queryKey: ['customer-conversations', 'list', filter],
    queryFn: () => apiGet<{ items: Row[]; count: number }>(`/api/customer-conversations?filter=${filter}`),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
  const count = list.data?.count;
  const waitingWord = count === undefined ? 'Needs a reply' : `Needs a reply · ${count}`;
  // On a phone, back to the list goes back, so the phone's own Back doesn't reopen it (fresh review).
  const backToList = () => (location.key !== 'default' ? navigate(-1) : setParams({}, { replace: true }));

  const listPane = (
    <div className={`flex flex-col gap-2.5 ${isPhone ? '' : 'w-[340px] shrink-0'}`}>
      <div role="group" aria-label="Show" className="flex gap-1.5">
        {([['needs-reply', waitingWord], ['all', 'All']] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
            className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-semibold ${filter === key ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
        <nav aria-label="Conversations" className="flex flex-col gap-0.5 p-1.5">
          {list.isError ? <p className="m-0 px-3 py-4 text-size-15">Wheelhouse couldn’t load the messages. Try again in a moment.</p> : null}
          {list.data && list.data.items.length === 0 ? (
            <p className="m-0 px-3 py-4 text-size-15 leading-normal text-[var(--wh-muted)]">{filter === 'needs-reply' ? 'Nothing needs a reply. Every conversation is under All.' : 'No conversations yet.'}</p>
          ) : null}
          {list.data?.items.map((r) => (
            <Link key={r.customerId} to={`?customer=${r.customerId}`} aria-current={open === r.customerId ? 'true' : undefined}
              aria-label={`${r.needsReply ? 'Needs a reply: ' : ''}${r.customerName}`}
              className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-[var(--wh-ink)] no-underline ${open === r.customerId ? 'border-[var(--wh-ink)] bg-[var(--wh-surface-muted)]' : 'border-transparent'}`}>
              <span className="flex items-center justify-between gap-2"><span className="text-size-15 font-bold">{r.customerName}</span>
                <span className="text-xs whitespace-nowrap text-[var(--wh-muted)]">{sameDay(r.lastAt, new Date()) ? time(r.lastAt) : withinWeek(r.lastAt) ? part(r.lastAt, { weekday: 'short' }) : `${part(r.lastAt, { day: 'numeric' })} ${part(r.lastAt, { month: 'short' })}`}</span></span>
              <span className="text-size-13 text-[var(--wh-muted)]">{r.about ? [r.about.bikeLabel, r.about.reference].filter(Boolean).join(' · ') : FROM_ACCOUNT}</span>
              <span className="flex items-center gap-1.5 text-sm">
                {r.needsReply ? <><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--wh-state-answer-ink)]" /><span className="shrink-0 font-semibold text-[var(--wh-state-answer-ink)]">Needs a reply</span><span aria-hidden="true">·</span></> : null}
                {/* Who wrote last, as drawn: "You: …" once the shop has answered. */}
                <span className="truncate">{r.needsReply ? r.lastText : `You: ${r.lastText}`}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );

  const convPane = open ? <Conversation key={open} customerId={open} drafts={drafts} focusOnOpen={isPhone} /> : (
    <div className="grow rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-5 py-10 text-center text-size-15 text-[var(--wh-muted)]">Choose a conversation to read it.</div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3.5 p-5 max-md:p-4">
      <p className="m-0 text-sm text-[var(--wh-muted)]">{NOTE}</p>
      {isPhone ? (open ? (
        <>
          <button type="button" onClick={backToList} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold">
            <ChevronLeft aria-hidden="true" className="size-4" />{`Messages · needs a reply${count === undefined ? '' : ` ${count}`}`}
          </button>
          {convPane}
        </>
      ) : listPane) : (
        <div className="flex items-start gap-4">{listPane}{convPane}</div>
      )}
    </div>
  );
}

function Conversation({ customerId, drafts, focusOnOpen }: { customerId: number; drafts: Map<number, string>; focusOnOpen: boolean }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const me = session.status === 'signed-in' ? session.user.name : null;
  // A failure says so at once, with Try again, rather than retrying out of sight.
  // Read again as the list is, so a new message from the customer shows (fresh review).
  const conv = useQuery({ queryKey: ['customer-conversations', 'thread', customerId], queryFn: () => apiGet<Thread>(`/api/customer-conversations/${customerId}`), refetchInterval: 30_000, retry: false });
  const [text, setTextState] = useState(() => drafts.get(customerId) ?? '');
  const setText = (v: string) => { setTextState(v); if (v) drafts.set(customerId, v); else drafts.delete(customerId); };
  const heading = useRef<HTMLHeadingElement>(null);
  // On a phone the list goes away, so focus comes to the conversation (fresh review).
  useEffect(() => { if (focusOnOpen) heading.current?.focus(); }, [focusOnOpen]);
  const [sending, setSending] = useState(false);
  // How the last reply went, and what it was about (null: general), for "See the text".
  const [told, setTold] = useState<(Told & { about: About | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const name = conv.data?.customerName ?? 'the customer';
  const first = firstName(conv.data?.customerName ?? null);
  const phone = conv.data?.phone ?? null;
  const thread = conv.data?.items ?? [];
  // The reply is about the repair of the customer's newest message, or general
  // when that was general (ask-the-shop-server design 5); with nothing from the
  // customer, the newest message's.
  const theirs = [...thread].reverse().find((n) => n.fromCustomer) ?? thread.at(-1);
  const about = theirs?.about ?? null;

  async function send() {
    const words = text.trim();
    if (!words) return;
    setSending(true);
    setError(null);
    try {
      const body = about ? { text: words, jobId: about.jobId } : { text: words };
      const saved = await apiMutate<{ items: Note[]; message: Told }>(`/api/customer-conversations/${customerId}/messages`, body, { method: 'POST' });
      queryClient.setQueryData<Thread>(['customer-conversations', 'thread', customerId], (old) => (old ? { ...old, items: saved.items } : old));
      await queryClient.invalidateQueries({ queryKey: ['customer-conversations', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
      setTold({ ...saved.message, about });
      setText('');
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t send that. Try again in a moment.');
    } finally {
      setSending(false);
    }
  }

  const linkBack = (a: About | null) => (a ? 'with a link to reply on the job’s page' : 'with a link to their messages');
  const sentHow = told?.status === 'sent'
    ? `Sent to ${first} by ${channelWord(told.channel)}, ${linkBack(told.about)}.`
    : told ? `${told.about ? 'Saved on the job' : 'Saved in the conversation'}, but no text went: ${told.reason ?? ''}` : null;

  // A customer who's gone, or a thread that won't load: say so, and offer no reply (fresh review).
  if (conv.isError) {
    return (
      <section aria-label="Conversation" className="flex min-w-0 grow flex-col items-start gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-5 py-4">
        <p className="m-0 text-size-15">Wheelhouse couldn’t load this conversation.</p>
        <Button className="min-h-11" onClick={() => { void conv.refetch(); }}>Try again</Button>
      </section>
    );
  }
  return (
    <section aria-label={name} className="flex min-w-0 grow flex-col gap-3.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--wh-border)] pb-3">
        <span className="flex flex-col gap-0.5">
          <h2 ref={heading} tabIndex={-1} className="m-0 text-lg font-bold outline-none">{name}</h2>
          {phone ? <span className="text-size-13 text-[var(--wh-muted)]"><a href={`tel:${phone.replace(/\s+/g, '')}`} className="text-inherit">{phone}</a></span> : null}
        </span>
        <Link to={ROUTES['cs-page'].replace(':id', String(customerId))} className="min-h-11 content-center text-sm font-semibold text-[var(--wh-ink)] underline">Customer page</Link>
      </div>
      <ol aria-label={`Conversation with ${name}`} className="m-0 flex list-none flex-col gap-3 p-0">
        {thread.map((n) => {
          const mine = !n.fromCustomer;
          const who = n.fromCustomer ? name : n.from && me && n.from === me ? `You (${me})` : n.from ?? 'The shop';
          return (
            <li key={n.id} className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
              <span className="text-size-13 text-[var(--wh-muted)]"><strong className="text-[var(--wh-ink)]">{who}</strong>{` · ${dayTime(n.at)}`}</span>
              <span className={`max-w-[82%] px-3.5 py-2.5 text-size-15 leading-normal whitespace-pre-wrap [overflow-wrap:anywhere] ${mine
                ? 'rounded-[14px_14px_4px_14px] border border-[var(--wh-border)] bg-[var(--wh-surface-muted)]'
                : 'rounded-[14px_14px_14px_4px] border border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{n.text}</span>
              {/* A note on a repair, marked with it (day answers 8.2), opening the job. */}
              {n.about ? (
                <Link to={`${ROUTES.diary}?job=${n.about.jobId}`} className="inline-flex min-h-8 items-center gap-1 text-size-13 font-semibold text-[var(--wh-ink)]">
                  About <span className="font-[family-name:var(--wh-font-mono)]">{ref(n.about)}</span><span aria-hidden="true">›</span>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
      {/* The drawn bar after sending (statusBar): green with a tick when the text went; amber when it didn't. */}
      <p role="status" className={`m-0 flex items-start gap-2 rounded-md text-size-15 font-semibold ${told ? 'px-3 py-2.5' : ''} ${told?.status === 'sent' ? 'bg-[var(--wh-state-ready-bg)] text-[var(--wh-state-ready-ink)]' : told ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : ''}`}>
        {told?.status === 'sent' ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
        {sentHow ? <span>{sentHow}{told?.status === 'sent' ? <> <button type="button" onClick={() => setShowText(true)} className="font-semibold text-inherit underline">{`See the text ${first} gets`}</button></> : null}</span> : null}
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor="reply" className="text-size-15 font-semibold">{told ? 'Reply again' : 'Reply'}</label>
        <Textarea id="reply" rows={3} placeholder="Type here" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Which the reply is about, so staff know where it lands (not drawn; decided-while-building). */}
          <p className="m-0 text-sm text-[var(--wh-muted)]">{about ? `About ${ref(about)}: goes to ${first} the way they chose, ${linkBack(about)}.` : `Goes to ${first} the way they chose, ${linkBack(null)}.`}</p>
          <Button variant="accent" className="min-h-11" disabled={sending} onClick={() => void send()}>Send reply</Button>
        </div>
        {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
      </div>
      {showText && told ? <TheirText customerId={customerId} about={told.about} first={first} onClose={() => setShowText(false)} /> : null}
    </section>
  );
}

/**
 * ac-reply-text: the newest reply as the customer gets it: Reply from the shop
 * for a repair, Reply to a message for a general one. Read from /api/messages,
 * which gives each message's key.
 */
function TheirText({ customerId, about, first, onClose }: { customerId: number; about: About | null; first: string; onClose: () => void }) {
  const key = about ? 'shop_reply' : 'message_reply';
  const url = about ? `/api/messages?jobId=${about.jobId}` : `/api/messages?customerId=${customerId}`;
  const messages = useQuery({ queryKey: ['messages', about ? about.jobId : `customer-${customerId}`, key], queryFn: () => apiGet<{ key: string | null; body: string; channel?: string }[]>(url) });
  const latest = messages.data?.find((m) => m.key === key);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="txt-title" className="md:max-w-[480px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="txt-title">{`What ${first} gets`}</DialogTitle>
          {latest ? <span className="text-size-13 text-[var(--wh-muted)]">{`By ${channelWord(latest.channel)}, the way ${first} chose`}</span> : null}
        </div>
      </DialogHeader>
      <DialogBody>
        {latest ? <p className="m-0 rounded-[14px_14px_14px_4px] bg-[var(--wh-surface-muted)] px-3.5 py-3 text-sm leading-normal">{latest.body}</p>
          : <p className="m-0 text-sm text-[var(--wh-muted)]">{messages.isLoading ? 'Loading…' : 'No text went for this reply.'}</p>}
      </DialogBody>
      <DialogFooter className="flex justify-end"><Button onClick={onClose}>Close</Button></DialogFooter>
    </Dialog>
  );
}
