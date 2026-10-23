import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Mail } from 'lucide-react';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { dayLabel, todayIso } from '@/screens/diary/rules.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { clock, londonDay, shortDate, when } from '@/screens/diary/when.ts';
import { due, startOf, useBookIn, useNow, useWorkshopDay } from '@/screens/overview/workshop-day.tsx';

/**
 * Office › Today (drawn as op-today and op-today-staff in generator/opening.mjs;
 * Jack, 30 Sep, opening the shop decisions 3 and 4; openspec/changes/today-page):
 * the day and the shop, Needs attention for the Owner, and Workshop today,
 * which shares the Overview's rules. Tills and Who's in wait for their
 * packages (WP-1.7 check-ins).
 */
type Attention =
  | { kind: 'quote_no_answer'; jobId: number; reference: string; customerName: string | null; phone: string | null; sentAt: string | null; reminderSentAt: string | null }
  | { kind: 'replies'; count: number; oldestName: string | null; oldestAt: string }
  | { kind: 'uncollected'; jobId: number; reference: string; customerName: string | null; bikeLabel: string | null; phone: string | null; readySince: string; reminderSentAt: string | null };
type Hours = { openingHours?: { weekday: number; open: string; close: string }[] };

// The drawing's card: a labelled section, its rows a list (opening.mjs `section`).
function Card({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="m-0 text-[17px] font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Line({ lead, title, sub, right }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <li className="flex min-h-[52px] items-center gap-3 border-t border-[var(--wh-border)] py-2">
      {lead}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        {sub ? <span className="text-[13px] text-[var(--wh-muted)]">{sub}</span> : null}
      </span>
      {right}
    </li>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 py-2.5">
      <span className="text-[13px] text-[var(--wh-muted)]">{label}</span>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-[13px] text-[var(--wh-muted)]">{note}</span>
    </div>
  );
}

const warn = <span aria-hidden="true" className="inline-flex text-[var(--wh-warn-ink)]"><AlertTriangle size={18} /></span>;
const mono = (t: string) => <span className="font-[family-name:var(--wh-font-mono)]">{t}</span>;
const linkButton = (touch: boolean) => `inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm font-semibold text-[var(--wh-ink)] hover:bg-[var(--wh-surface-muted)] ${touch ? 'min-h-11' : 'min-h-9'}`;

function NeedsAttention({ today, touch }: { today: string; touch: boolean }) {
  // Read again every minute and when the window comes back, until live updates (design 6).
  const list = useQuery({ queryKey: ['needs-attention'], queryFn: () => apiGet<{ items: Attention[] }>('/api/needs-attention'), refetchInterval: 60_000, refetchOnWindowFocus: true });
  const items = list.data?.items ?? [];
  const queryClient = useQueryClient();
  const [contacting, setContacting] = useState<number | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  // Contacted (cp-today-uncollected; H4): recorded, and the line goes.
  async function contacted(jobId: number) {
    setContacting(jobId);
    setRefused(null);
    try {
      await apiMutate(`/api/workshop-jobs/${jobId}/contacted`, {}, { method: 'POST' });
    } catch {
      setRefused('Wheelhouse couldn’t record that. Try again in a moment.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      setContacting(null);
    }
  }
  const lines = items.map((i) => {
    if (i.kind === 'uncollected') {
      const sub = [i.bikeLabel, i.reminderSentAt ? `reminder sent ${shortDate(i.reminderSentAt)}` : null].filter(Boolean).join(' · ');
      return (
        <Line key={`u${i.jobId}`} lead={warn}
          title={`${i.reference} · ${i.customerName ?? 'No customer'} — ready since ${shortDate(i.readySince)}`}
          sub={<>{sub}{i.phone ? <>{sub ? ' · ' : ''}<a href={`tel:${i.phone.replace(/\s+/g, '')}`} className="whitespace-nowrap text-inherit">{mono(i.phone)}</a></> : null}</>}
          right={<Button size={touch ? 'default' : 'sm'} className={touch ? 'min-h-11' : undefined} disabled={contacting === i.jobId} aria-label={`Contacted: ${i.reference}`} onClick={() => void contacted(i.jobId)}>Contacted</Button>} />
      );
    }
    if (i.kind === 'quote_no_answer') {
      const sent = [i.sentAt ? `Sent ${when(i.sentAt)}` : null, i.reminderSentAt ? `reminder sent ${when(i.reminderSentAt)}` : null].filter(Boolean).join(' · ');
      return (
        <Line key={`q${i.jobId}`} lead={warn}
          title={`${i.reference} · ${i.customerName ?? 'No customer'} — no answer to the quote yet`}
          sub={<>{sent}{i.phone ? <>{' · '}<a href={`tel:${i.phone.replace(/\s+/g, '')}`} className="whitespace-nowrap text-inherit">{mono(i.phone)}</a></> : null}</>}
          right={<Link to={`${ROUTES.diary}?job=${i.jobId}`} aria-label={`Record their answer for ${i.reference}`} className={linkButton(touch)}>Record their answer</Link>} />
      );
    }
    return (
      <Line key="replies" lead={<span aria-hidden="true" className="inline-flex text-[var(--wh-ink)]"><Mail size={18} /></span>}
        title={`${i.count} ${i.count === 1 ? 'message needs' : 'messages need'} a reply`}
        sub={`From customers · oldest from ${i.oldestName ?? 'a customer'} at ${londonDay(i.oldestAt) === today ? clock(i.oldestAt) : when(i.oldestAt)}`}
        right={<Link to={ROUTES.messages} className={linkButton(touch)}>Open Messages</Link>} />
    );
  });
  return (
    <Card id="today-attention" title={lines.length ? `Needs attention · ${lines.length}` : 'Needs attention'}>
      {refused ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{refused}</p> : null}
      {list.isError ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t load what needs attention. It tries again in a minute.</p>
        : !list.isSuccess ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
        : lines.length ? <ul className="m-0 list-none p-0">{lines}</ul>
        : <p className="m-0 flex min-h-12 items-center gap-2.5 border-t border-[var(--wh-border)] text-[15px] text-[var(--wh-muted)]"><Check size={16} aria-hidden="true" />Nothing needs you right now</p>}
    </Card>
  );
}

function WorkshopToday({ today, now, touch }: { today: string; now: Date; touch: boolean }) {
  const day = useWorkshopDay(today);
  // The booked row leaves the list: the focus goes to the list's heading, not the top of the page.
  const listHeading = useRef<HTMLHeadingElement>(null);
  const booking = useBookIn(() => listHeading.current?.focus());
  const { arrivals, expectedToday, ready } = day;
  const right = (j: WorkshopJob) => {
    const start = startOf(j, today);
    const label = start ? <span className="text-sm">{mono(start)} appointment</span> : <span className="text-sm">Drop-off</span>;
    return (
      <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
        {label}
        {due(start, now) ? <Button variant="accent" size={touch ? 'default' : 'sm'} className={touch ? 'min-h-11' : undefined} disabled={booking.busy === j.id} aria-label={`Book in ${j.reference}`} onClick={() => booking.start(j)}>Book in</Button> : null}
      </span>
    );
  };
  const openDiary = <Link to={ROUTES.diary} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--wh-ink)]">Open the diary</Link>;
  return (
    <Card id="today-workshop" title="Workshop today" action={openDiary}>
      {day.failed ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t load the workshop’s jobs. Try again in a moment.</p>
          <Button className={touch ? 'min-h-11' : undefined} onClick={day.retry}>Try again</Button>
        </div>
      ) : !day.loaded ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
            <Stat label="Expected today" value={`${expectedToday.length} ${expectedToday.length === 1 ? 'bike' : 'bikes'}`} note={`${arrivals.length} still to arrive`} />
            <Stat label="Repairs ready to collect" value={String(ready.length)} note="In the workshop now" />
          </div>
          <h3 ref={listHeading} tabIndex={-1} className="mt-1.5 mb-0 text-sm font-bold">Still to arrive</h3>
          {booking.refused ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{booking.refused}</p> : null}
          {arrivals.length ? (
            <ul className="m-0 list-none p-0">
              {arrivals.map((j) => (
                <Line key={j.id} title={<>{mono(j.reference ?? '')} · {j.customerName ?? 'No customer'}</>} sub={`${j.bikeLabel ?? 'No bike'} · ${j.title}`} right={right(j)} />
              ))}
            </ul>
          ) : <p className="m-0 border-t border-[var(--wh-border)] py-2 text-sm text-[var(--wh-muted)]">Every bike booked for today is in.</p>}
        </>
      )}
      {booking.dialog}
    </Card>
  );
}

export function TodayPage() {
  const session = useSession();
  const isPhone = useMedia('(max-width: 767px)');
  // A touch screen gets 44px buttons, as the Overview's.
  const touch = useMedia('(pointer: coarse)') || isPhone;
  const now = useNow();
  const today = todayIso(now);
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<Hours>('/api/workshop-settings') });
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const hours = settings.data?.openingHours?.find((h) => h.weekday === weekday);
  const signedIn = session.status === 'signed-in' ? session : null;
  const owner = Boolean(signedIn?.user.isOwner);
  const dateLine = [dayLabel(today), signedIn?.shop.name, hours ? `open ${hours.open}–${hours.close}` : null].filter(Boolean).join(' · ');

  const attention = owner ? <NeedsAttention today={today} touch={touch} /> : null;
  const work = <WorkshopToday today={today} now={now} touch={touch} />;
  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">
      <p className="m-0 text-[15px] text-[var(--wh-muted)] max-md:text-sm">{dateLine}</p>
      {/* Two columns on a computer or tablet, Needs attention on the left; one on a phone, Needs attention first. */}
      {isPhone || !attention ? (
        <div className="flex flex-col gap-3.5">{attention}{work}</div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3.5">
          <div className="flex flex-col gap-3.5">{attention}</div>
          <div className="flex flex-col gap-3.5">{work}</div>
        </div>
      )}
    </div>
  );
}
