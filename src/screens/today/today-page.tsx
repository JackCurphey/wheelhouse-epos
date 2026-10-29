import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Mail } from 'lucide-react';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { REASON_LABEL } from '@/screens/stock/adjust-stock.tsx';
import { productHref } from '@/screens/stock/stock-bits.tsx';
import { countHref } from '@/screens/stock-take/stock-take-bits.ts';
import { penceText } from '@/lib/cash-count.ts';
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
 * which shares the Overview's rules; Tills for the Owner and Who's in for
 * everyone, from the PIN check-ins (openspec/changes/whos-in-and-first-pin).
 */
type Attention =
  | { kind: 'quote_no_answer'; jobId: number; reference: string; customerName: string | null; phone: string | null; sentAt: string | null; reminderSentAt: string | null }
  | { kind: 'replies'; count: number; oldestName: string | null; oldestAt: string }
  | { kind: 'uncollected'; jobId: number; reference: string; customerName: string | null; bikeLabel: string | null; phone: string | null; readySince: string; reminderSentAt: string | null }
  | { kind: 'float_short'; checkId: number; day: string; shortPence: number; tillCode?: string | null; countedByName: string; checkedAt: string; reason: string }
  | { kind: 'float_over'; checkId: number; day: string; overPence: number; tillCode?: string | null; countedByName: string; checkedAt: string; reason: string }
  | { kind: 'below_zero'; count: number; takeId: number | null }
  | { kind: 'stock_adjusted'; movementId: number; productId: number; productName: string; change: number; valuePence: number; reason: string; note: string; byName: string | null; at: string };
type Person = { id: number; name: string; role: string; checkedInAt?: string; dueAt?: string };
type TillToday = { code: string | null; openedAt: string | null; openedBy: string | null; floatCheck: { byName: string; at: string; short: boolean; seenByName: string | null } | null };
type Hours = { openingHours?: { weekday: number; open: string; close: string }[] };

// The drawing's card: a labelled section, its rows a list (opening.mjs `section`).
function Card({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} tabIndex={-1} className="m-0 text-size-17 font-bold">{title}</h2>
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
        <span className="text-size-15 font-semibold">{title}</span>
        {sub ? <span className="text-size-13 text-[var(--wh-muted)]">{sub}</span> : null}
      </span>
      {right}
    </li>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 py-2.5">
      <span className="text-size-13 text-[var(--wh-muted)]">{label}</span>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-size-13 text-[var(--wh-muted)]">{note}</span>
    </div>
  );
}

const warn = <span aria-hidden="true" className="inline-flex text-[var(--wh-warn-ink)]"><AlertTriangle size={18} /></span>;
const mono = (t: string) => <span className="font-[family-name:var(--wh-font-mono)]">{t}</span>;
const linkButton = (touch: boolean) => `inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm font-semibold text-[var(--wh-ink)] hover:bg-[var(--wh-surface-muted)] ${touch ? 'min-h-11' : 'min-h-9'}`;

// The drawing's tag (opening.mjs `tag`): a tick for good news, a warning, or grey.
function Tag({ tone, children }: { tone: 'ok' | 'warn' | 'grey'; children: ReactNode }) {
  const look = tone === 'ok' ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]' : tone === 'warn' ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]';
  return (
    <span className={`inline-flex min-h-[26px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${look}`}>
      {tone === 'ok' ? <Check size={13} aria-hidden="true" /> : tone === 'warn' ? <AlertTriangle size={13} aria-hidden="true" /> : null}{children}
    </span>
  );
}
const loading = (q: { isError: boolean; isSuccess: boolean }, what: string) => q.isError
  ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t load {what}. It tries again in a minute.</p>
  : <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>;

// Tills (op-today, op-today-short, op-today-seen): a line per till, "Till B1",
// and "Till" with no number for a browser that isn't a set-up till
// (openspec/changes/till-setup, design 2).
function TillLine({ t }: { t: TillToday }) {
  const f = t.floatCheck;
  // "Open" only once someone checked in: the Owner's look at closing alone doesn't open the till (review, 28 Oct).
  const sub = !t.openedAt ? 'Not open yet' : f ? `Open · float checked by ${f.byName} at ${clock(f.at)}` : `Open · ${t.openedBy} checked in at ${clock(t.openedAt)}`;
  const tag = f?.short ? (f.seenByName ? <Tag tone="grey">Float short · seen by {f.seenByName}</Tag> : <Tag tone="warn">Float short</Tag>) : null;
  return <Line title={t.code ? `Till ${t.code}` : 'Till'} sub={sub} right={tag} />;
}
function Tills() {
  const q = useQuery({ queryKey: ['today-tills'], queryFn: () => apiGet<{ tills: TillToday[] }>('/api/today/tills'), refetchInterval: 60_000, refetchOnWindowFocus: true });
  const tills = q.data?.tills;
  return (
    <Card id="today-tills" title="Tills">
      {tills ? <ul className="m-0 list-none p-0">{tills.map((t) => <TillLine key={t.code ?? ''} t={t} />)}</ul> : loading(q, 'the tills')}
    </Card>
  );
}

// Who's in (op-today, op-today-late; decisions 5 and 6): checked in today,
// then mechanics due, "Not in yet" turning "Late" by the page's own clock.
function WhosIn({ now }: { now: Date }) {
  const q = useQuery({ queryKey: ['today-whos-in'], queryFn: () => apiGet<{ people: Person[] }>('/api/today/whos-in'), refetchInterval: 60_000, refetchOnWindowFocus: true });
  const people = q.data?.people;
  const time = clock(now.toISOString());
  return (
    <Card id="today-whos-in" title="Who’s in">
      {!people ? loading(q, 'who’s in')
        : people.length ? (
          <ul className="m-0 list-none p-0">
            {people.map((p) => (p.checkedInAt
              ? <Line key={p.id} title={p.name} sub={`Checked in at ${clock(p.checkedInAt)} · ${p.role}`} right={<Tag tone="ok">In</Tag>} />
              : <Line key={p.id} title={p.name} sub={`Due in at ${p.dueAt} · ${p.role}`} right={<Tag tone="grey">{p.dueAt && time > p.dueAt ? 'Late' : 'Not in yet'}</Tag>} />))}
          </ul>
        ) : <p className="m-0 border-t border-[var(--wh-border)] py-2 text-sm text-[var(--wh-muted)]">Nobody has checked in yet.</p>}
    </Card>
  );
}

function NeedsAttention({ today, touch, phone }: { today: string; touch: boolean; phone: boolean }) {
  // Read again every minute and when the window comes back, until live updates (design 6).
  const list = useQuery({ queryKey: ['needs-attention'], queryFn: () => apiGet<{ items: Attention[] }>('/api/needs-attention'), refetchInterval: 60_000, refetchOnWindowFocus: true });
  const items = list.data?.items ?? [];
  const queryClient = useQueryClient();
  const [contacting, setContacting] = useState<ReadonlySet<number>>(new Set());
  const [seeing, setSeeing] = useState<ReadonlySet<number>>(new Set());
  const [refused, setRefused] = useState<string | null>(null);
  // Contacted (cp-today-uncollected; H4): recorded, and the line goes; the
  // focus goes to the card's heading, not the top of the page (fresh review).
  async function contacted(jobId: number) {
    setContacting((c) => new Set(c).add(jobId));
    setRefused(null);
    let done = false;
    try {
      await apiMutate(`/api/workshop-jobs/${jobId}/contacted`, {}, { method: 'POST' });
      done = true;
    } catch {
      setRefused('Wheelhouse couldn’t record that. Try again in a moment.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      setContacting((c) => { const next = new Set(c); next.delete(jobId); return next; });
    }
    if (done) document.getElementById('today-attention')?.focus();
  }
  // Seen on a short float (op-today-seen; H3): one click, and the line goes.
  async function seen(checkId: number) {
    setSeeing((c) => new Set(c).add(checkId));
    setRefused(null);
    let done = false;
    try {
      await apiMutate(`/api/float-check/${checkId}/seen`, {}, { method: 'POST' });
      done = true;
    } catch {
      setRefused('Wheelhouse couldn’t record that. Try again in a moment.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      setSeeing((c) => { const next = new Set(c); next.delete(checkId); return next; });
    }
    if (done) document.getElementById('today-attention')?.focus();
  }
  // Seen on a big stock adjustment (st-today-adjust): as the float's Seen.
  const [seeingStock, setSeeingStock] = useState<ReadonlySet<number>>(new Set());
  async function stockSeen(movementId: number) {
    setSeeingStock((c) => new Set(c).add(movementId));
    setRefused(null);
    let done = false;
    try {
      await apiMutate(`/api/stock-adjustments/${movementId}/seen`, {}, { method: 'POST' });
      done = true;
    } catch {
      setRefused('Wheelhouse couldn’t record that. Try again in a moment.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      setSeeingStock((c) => { const next = new Set(c); next.delete(movementId); return next; });
    }
    if (done) document.getElementById('today-attention')?.focus();
  }
  // Count them (st-today-below; stock decisions 9 and 11, "starts the count at
  // once"): a below-zero stock take, opened on its counting page; the one
  // already counting if there is one (stock-warnings-on-today design 7).
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  async function countThem(takeId: number | null) {
    if (takeId !== null) { navigate(countHref(takeId)); return; }
    setStarting(true);
    setRefused(null);
    try {
      const made = await apiMutate<{ id: number }>('/api/stock-takes', { kind: 'below_zero' });
      navigate(countHref(made.id));
    } catch (err) {
      setRefused(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t start the count. Try again in a moment.');
      setStarting(false);
    }
  }
  const lines = items.map((i) => {
    // st-today-below: on a phone See them and Count them sit under the words.
    if (i.kind === 'below_zero') {
      const sub = 'Sold more than Wheelhouse thought were here · Count them starts a count straight away';
      const acts = (
        <span className="inline-flex items-center gap-1.5">
          <Link to={`${ROUTES.stock}?show=below-zero`} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold whitespace-nowrap text-[var(--wh-ink)]">See them</Link>
          <Button size={touch ? 'default' : 'sm'} className={`whitespace-nowrap ${touch ? 'min-h-11' : ''}`} disabled={starting} onClick={() => void countThem(i.takeId)}>Count them</Button>
        </span>
      );
      return (
        <Line key="below-zero" lead={warn}
          title={`${i.count} ${i.count === 1 ? 'product' : 'products'} below zero`}
          sub={phone ? <>{sub}<span className="mt-1 flex text-[var(--wh-ink)]">{acts}</span></> : sub}
          right={phone ? null : acts} />
      );
    }
    // st-today-adjust: the product's name opens its page (audit M8).
    if (i.kind === 'stock_adjusted') {
      const change = i.change < 0 ? `−${-i.change}` : `+${i.change}`;
      const at = londonDay(i.at) === today ? clock(i.at) : when(i.at);
      const sub = [REASON_LABEL[i.reason] ?? 'Adjusted', i.note ? `“${i.note}”` : null, i.byName ? `by ${i.byName} at ${at}` : at].filter(Boolean).join(' · ');
      return (
        <Line key={`s${i.movementId}`} lead={warn}
          title={<>Stock adjusted: <Link to={productHref(i.productId)} className="inline-flex min-h-11 items-center text-[var(--wh-ink)] underline">{i.productName}</Link> {change} · {penceText(i.valuePence)}</>}
          sub={sub}
          right={<Button size={touch ? 'default' : 'sm'} className={touch ? 'min-h-11' : undefined} disabled={seeingStock.has(i.movementId)} onClick={() => void stockSeen(i.movementId)}>Seen</Button>} />
      );
    }
    // op-today-short, "Till B1’s float…" when counted on a set-up till
    // (till-setup); it stays until Seen, so an earlier day's gives its date
    // (review, 27 Oct). An over float reads the same, once yesterday was
    // closed (decision 8 H1; close-the-day).
    if (i.kind === 'float_short' || i.kind === 'float_over') {
      const by = i.kind === 'float_short' ? `${penceText(i.shortPence)} short` : `${penceText(i.overPence)} over`;
      return (
        <Line key={`f${i.checkId}`} lead={warn}
          title={`${i.tillCode ? `Till ${i.tillCode}’s float` : 'The float'} was ${by} ${londonDay(i.checkedAt) === today ? 'this morning' : `on ${shortDate(i.checkedAt)}`}`}
          sub={`Counted by ${i.countedByName} at ${clock(i.checkedAt)}${i.reason ? ` · “${i.reason}”` : ''}`}
          right={<Button size={touch ? 'default' : 'sm'} className={touch ? 'min-h-11' : undefined} disabled={seeing.has(i.checkId)} onClick={() => void seen(i.checkId)}>Seen</Button>} />
      );
    }
    if (i.kind === 'uncollected') {
      const sub = [i.bikeLabel, i.reminderSentAt ? `reminder sent ${shortDate(i.reminderSentAt)}` : null].filter(Boolean).join(' · ');
      return (
        <Line key={`u${i.jobId}`} lead={warn}
          title={`${i.reference} · ${i.customerName ?? 'No customer'} — ready since ${shortDate(i.readySince)}`}
          sub={<>{sub}{i.phone ? <>{sub ? ' · ' : ''}<a href={`tel:${i.phone.replace(/\s+/g, '')}`} className="whitespace-nowrap text-inherit">{mono(i.phone)}</a></> : null}</>}
          right={<Button size={touch ? 'default' : 'sm'} className={touch ? 'min-h-11' : undefined} disabled={contacting.has(i.jobId)} aria-label={`Contacted: ${i.reference}`} onClick={() => void contacted(i.jobId)}>Contacted</Button>} />
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
        : <p className="m-0 flex min-h-12 items-center gap-2.5 border-t border-[var(--wh-border)] text-size-15 text-[var(--wh-muted)]"><Check size={16} aria-hidden="true" />Nothing needs you right now</p>}
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

  // The Owner: Needs attention, Tills, Who's in; Staff: Who's in (decision 4, op-today-staff).
  const left = <>{owner ? <><NeedsAttention today={today} touch={touch} phone={isPhone} /><Tills /></> : null}<WhosIn now={now} /></>;
  const work = <WorkshopToday today={today} now={now} touch={touch} />;
  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">
      <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{dateLine}</p>
      {/* Two columns on a computer or tablet, the left one first on a phone. */}
      {isPhone ? (
        <div className="flex flex-col gap-3.5">{left}{work}</div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3.5">
          <div className="flex flex-col gap-3.5">{left}</div>
          <div className="flex flex-col gap-3.5">{work}</div>
        </div>
      )}
    </div>
  );
}
