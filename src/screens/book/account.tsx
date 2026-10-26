import * as React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants } from '@/components/ui/button';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { cn } from '@/lib/utils';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { BookFrame } from './frame.tsx';
import { pounds } from './money.ts';
import { STAGE_TEXT } from './pending-rules.ts';
import type { BookingStage } from './pending-query.ts';

/**
 * The customer's account (openspec/changes/customer-account-screens; drawn as
 * ac-account, ac-account-repairs and ac-account-new in account.mjs; account
 * decisions 1, 6, 8 and 9; Jack's answers in
 * docs/decisions/2026-10-26-customer-account.md). Her bikes, her details and
 * how the shop contacts her, and one history: what's on now, then earlier,
 * newest first. A repair opens its own page by her sign-in (job-<id>).
 * Not built yet, so not shown: Ask the shop a question, store credit,
 * warranty and next-service lines, adding a bike, changing details, a
 * purchase's receipt, and Your data.
 */
type Me = {
  id: number; email: string; name: string | null; phone: string | null; shopName: string; shopSlug: string;
  updateChannel: 'sms' | 'whatsapp' | 'email'; serviceReminders: boolean; reviewRequests: boolean; marketingPermission: boolean;
};
type Bike = { id: number; make: string; model: string; colour: string | null; nextServiceDue?: string | null };
type Repair = {
  kind: 'repair'; jobId: number; reference: string; title: string; bikeLabel: string | null; bikeId: number | null;
  stage: BookingStage; workStarted: boolean; jobDate: string; totalPence: number | null; at: string;
};
type Purchase = { kind: 'purchase'; source: string; id: number; receiptNumber: number | null; what: string; totalPence: number; at: string };
type Item = Repair | Purchase;

const ENDED: BookingStage[] = ['collected', 'cancelled', 'declined', 'request_expired'];
// Not a type guard: a repair that has ended is still a Repair.
const isNow = (i: Item) => i.kind === 'repair' && !ENDED.includes(i.stage);
const EARLIER_SHOWN = 8;

// "Thu 17 Sep", as the drawings and the booking page write a day.
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${SHORT_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${SHORT_MONTHS[m - 1]}`;
};
// "Wed 17 Mar 2027": a next service is months off, so the year always shows.
const longDate = (date: string) => `${shortDate(date)} ${date.slice(0, 4)}`;
const londonDate = (iso: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/London' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// The tracker's current step (pending.tsx's Tracker), as the row's chip (audit M4).
function chip(r: Repair) {
  if (r.stage === 'ready_to_collect') return 'Ready';
  if (r.stage === 'in_workshop') return r.workStarted ? 'Being worked on' : 'In the shop';
  return 'Booked';
}

const signedOut = (err: unknown) => err instanceof ApiError && err.status === 401;

export function AccountScreen() {
  const { shopSlug = '' } = useParams();
  const base = `/api/portal/${encodeURIComponent(shopSlug)}`;
  const opts = { retry: false, refetchOnWindowFocus: false } as const;
  const me = useQuery({ queryKey: ['account', shopSlug, 'me'], queryFn: () => apiGet<Me>(`${base}/me`), ...opts });
  const bikes = useQuery({ queryKey: ['account', shopSlug, 'bikes'], queryFn: () => apiGet<Bike[]>(`${base}/bikes`), ...opts });
  const history = useQuery({ queryKey: ['account', shopSlug, 'history'], queryFn: () => apiGet<Item[]>(`${base}/history`), ...opts });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [leaving, setLeaving] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const home = `/book/${shopSlug}`;

  if ([me, bikes, history].some((q) => signedOut(q.error))) {
    return <Navigate replace to={`${home}/sign-in?from=${encodeURIComponent(`${home}/account`)}`} />;
  }
  if (me.isPending || bikes.isPending || history.isPending) return <BookFrame title="Loading…">{null}</BookFrame>;
  if (!me.data || !bikes.data || !history.data) {
    return (
      <BookFrame title="We couldn’t load your account">
        <Button variant="accent" onClick={() => { void me.refetch(); void bikes.refetch(); void history.refetch(); }}>Try again</Button>
      </BookFrame>
    );
  }

  async function signOut() {
    setLeaving(true);
    setFailed(false);
    try {
      await apiMutate(`${base}/logout`, {}, { method: 'POST' });
      queryClient.removeQueries({ queryKey: ['account', shopSlug] });
      navigate(home, { replace: true });
    } catch {
      setFailed(true);
      setLeaving(false);
    }
  }

  const items = history.data;
  const bookLink = <Link to={home} className={cn(buttonVariants({ variant: 'accent' }), 'no-underline')}>Book a repair</Link>;
  const bikesCard = <BikesCard bikes={bikes.data} items={items} bookLink={bookLink} shopSlug={shopSlug} reminders={me.data.serviceReminders} />;
  return (
    <BookFrame title="Your account" wide>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <span className="text-sm text-[var(--wh-muted)]">
          {me.data.name ? `${me.data.name} · ` : ''}{me.data.email} · <button type="button" disabled={leaving} onClick={() => void signOut()} className="min-h-11 cursor-pointer border-0 bg-transparent p-0 font-semibold text-[var(--wh-ink)] underline">Sign out</button>
        </span>
        {bookLink}
      </div>
      {failed ? <p role="alert" className="m-0 mb-4 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">That didn’t go through. Check your connection and try again.</p> : null}
      {/* On a phone: bikes, history, details (ac-account phone); on a computer, bikes and details on the left, the history on the right. */}
      <div className="grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="lg:col-start-1 lg:row-start-1">{bikesCard}</div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1"><HistoryCard items={items} shopSlug={shopSlug} shopName={me.data.shopName} bookLink={bookLink} /></div>
        <div className="lg:col-start-1 lg:row-start-2"><DetailsCard me={me.data} shopSlug={shopSlug} /></div>
      </div>
    </BookFrame>
  );
}

function Card({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 rounded-[10px] border border-[var(--wh-border)] p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="m-0 text-lg font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function BikesCard({ bikes, items, bookLink, shopSlug, reminders }: { bikes: Bike[]; items: Item[]; bookLink: React.ReactNode; shopSlug: string; reminders: boolean }) {
  const idBase = React.useId();
  const [adding, setAdding] = React.useState(false);
  // "+ Add a bike": a button on the empty card, a link-style one under the bikes, as drawn (add-a-bike design 2).
  const addBox = adding ? <AddBike shopSlug={shopSlug} onClose={() => setAdding(false)} /> : null;
  if (!bikes.length) {
    return (
      <Card id={`${idBase}-bikes`} title="Your bikes">
        <p className="m-0 text-size-15 text-[var(--wh-muted)]">No bikes yet. Add one to book it in faster.</p>
        <div><Button onClick={() => setAdding(true)}>+ Add a bike</Button></div>
        {addBox}
      </Card>
    );
  }
  return (
    <Card id={`${idBase}-bikes`} title="Your bikes">
      {bikes.map((b) => {
        // A repair of this bike in the workshop or ready to collect (the drawn "In the shop now").
        const inShop = items.find((i): i is Repair => i.kind === 'repair' && i.bikeId === b.id && (i.stage === 'in_workshop' || i.stage === 'ready_to_collect'));
        return (
          <div key={b.id} className="flex flex-col gap-1.5 border-t border-[var(--wh-border)] pt-2.5">
            <span className="text-base font-bold">{[[b.make, b.model].filter(Boolean).join(' '), b.colour].filter(Boolean).join(' · ')}</span>
            {/* "next service due [date]", only while reminders are on (audit L10; next-service-due design 3). */}
            {(() => {
              const due = reminders && b.nextServiceDue ? `next service due ${longDate(b.nextServiceDue)}` : null;
              const line = inShop ? [`In the shop now · ${inShop.reference}`, due].filter(Boolean).join(' · ') : due ? `N${due.slice(1)}` : null;
              return line ? <span className="text-size-13 text-[var(--wh-muted)]">{line}</span> : null;
            })()}
            <div className="pt-1">{bookLink}</div>
          </div>
        );
      })}
      <div><button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wh-ink)] underline">+ Add a bike</button></div>
      {addBox}
    </Card>
  );
}

/**
 * Add a bike from the account (openspec/changes/add-a-bike design 2; not-drawn
 * pages 16): the booking's bike fields ("A different bike" on bk-bike). The
 * make and model go in as one, as the booking's guest bike does.
 */
function AddBike({ shopSlug, onClose }: { shopSlug: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [colour, setColour] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const field = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-size-15';

  async function add() {
    if (!name.trim()) { setError('Enter its make and model.'); return; }
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/portal/${encodeURIComponent(shopSlug)}/bikes`, { make: name.trim(), model: '', colour: colour.trim() }, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['account', shopSlug, 'bikes'] });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? 'Enter its make and model.' : 'That didn’t go through. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="acc-add-bike" className="md:max-w-[520px]">
      <DialogHeader><DialogTitle id="acc-add-bike">Add a bike</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="acc-bike-name" className="text-sm font-semibold">Make and model</label>
          <input id="acc-bike-name" autoComplete="off" className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="acc-bike-colour" className="text-sm font-semibold">Colour, or anything that helps us spot it</label>
          <input id="acc-bike-colour" autoComplete="off" className={field} value={colour} onChange={(e) => setColour(e.target.value)} />
        </div>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={busy} onClick={() => void add()}>Add bike</Button>
      </DialogFooter>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--wh-border)] py-2 text-size-15">
      <span className="text-[var(--wh-muted)]">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}

function DetailsCard({ me, shopSlug }: { me: Me; shopSlug: string }) {
  const idBase = React.useId();
  const [changing, setChanging] = React.useState(false);
  const onOff = (on: boolean) => (on ? 'On' : 'Off');
  return (
    <Card id={`${idBase}-details`} title="Your details">
      <div>
        <Row k="Name" v={me.name ?? ''} />
        <Row k="Mobile" v={<span className="font-[family-name:var(--wh-font-mono)]">{me.phone ?? ''}</span>} />
        <Row k="Email" v={me.email} />
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <h3 className="m-0 text-base font-bold">How we contact you</h3>
        <button type="button" aria-label="Change how we contact you" onClick={() => setChanging(true)} className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wh-ink)] underline">Change</button>
      </div>
      <div>
        <Row k="Job updates" v={`By ${wayWord(me.updateChannel)}`} />
        <Row k="Service reminders" v={onOff(me.serviceReminders)} />
        <Row k="Review requests" v={onOff(me.reviewRequests)} />
        <Row k="Offers and news" v={onOff(me.marketingPermission)} />
      </div>
      {changing ? <ContactBox me={me} shopSlug={shopSlug} onClose={() => setChanging(false)} /> : null}
    </Card>
  );
}

const WAYS: Record<Me['updateChannel'], string> = { sms: 'Text', whatsapp: 'WhatsApp', email: 'Email' };
// In a sentence: "by text", "by email", but "by WhatsApp", a name (review).
const wayWord = (way: Me['updateChannel']) => (way === 'whatsapp' ? WAYS[way] : WAYS[way].toLowerCase());
type Switch = 'serviceReminders' | 'reviewRequests' | 'marketingPermission';
const SWITCHES: { key: Switch; label: string; sub: string }[] = [
  { key: 'serviceReminders', label: 'Service reminders', sub: 'When your bike is due its next service' },
  { key: 'reviewRequests', label: 'Review requests', sub: 'After you collect your bike' },
  { key: 'marketingPermission', label: 'Offers and news', sub: 'Only if you say yes' },
];

/**
 * How we contact you (openspec/changes/how-we-contact-you design 2; drawn as
 * ac-contact and ac-contact-changed; account and reminders decision 6): the
 * way job updates go, and three switches, each saved as it's pressed and
 * said so.
 */
function ContactBox({ me, shopSlug, onClose }: { me: Me; shopSlug: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function save(change: Partial<Pick<Me, 'updateChannel' | Switch>>, done: string) {
    // Pressed while a change is saving: ignored. The buttons stay focusable, so
    // a keyboard user keeps their place (aria-disabled, not disabled; review).
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaid(null);
    try {
      const saved = await apiMutate<Partial<Me>>(`/api/portal/${encodeURIComponent(shopSlug)}/me/contact`, change, { method: 'PUT' });
      queryClient.setQueryData<Me>(['account', shopSlug, 'me'], (old) => (old ? { ...old, ...saved } : old));
      setSaid(done);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Please sign in again to change this.'
        : err instanceof ApiError && err.status === 400 && err.hasServerMessage ? err.message : 'That didn’t go through. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="ct-title" className="md:max-w-[560px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="ct-title">How we contact you</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">Changes save straight away</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {said ? <p role="status" className="m-0 rounded-lg bg-[var(--wh-status-complete-bg)] px-3 py-2 text-sm font-semibold text-[var(--wh-status-complete-ink)]">{said}</p> : null}
        {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
        <div className="flex flex-col gap-2">
          <span className="text-size-15 font-bold">Job updates</span>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Bookings, quotes, and when your bike is ready. You can change how — they can’t be switched off while a bike is with us.</p>
          <div role="radiogroup" aria-label="Job updates by" className="flex flex-wrap gap-2">
            {(Object.keys(WAYS) as Me['updateChannel'][]).map((way) => (
              <button key={way} type="button" role="radio" aria-checked={me.updateChannel === way} aria-disabled={busy}
                onClick={() => { if (me.updateChannel !== way) void save({ updateChannel: way }, `Job updates will come by ${wayWord(way)}`); }}
                className={cn('min-h-11 cursor-pointer rounded-full border px-4 text-size-15 font-semibold text-[var(--wh-ink)]', me.updateChannel === way ? 'border-[var(--wh-ink)] bg-[var(--wh-surface-muted)]' : 'border-[var(--wh-border)] bg-transparent')}>
                {WAYS[way]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col pt-1.5">
          {SWITCHES.map(({ key, label, sub }) => (
            <button key={key} type="button" role="switch" aria-checked={me[key]} aria-labelledby={`ct-${key}`} aria-describedby={`ct-${key}-sub`} aria-disabled={busy}
              onClick={() => void save({ [key]: !me[key] }, `${label} ${label.endsWith('s') ? 'are' : 'is'} ${me[key] ? 'off' : 'on'}`)}
              className="flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-3 border-0 border-t border-[var(--wh-border)] bg-transparent p-0 text-left text-[var(--wh-ink)]">
              <span className="flex flex-col gap-0.5">
                <span id={`ct-${key}`} className="text-size-15 font-semibold">{label}</span>
                <span id={`ct-${key}-sub`} className="text-size-13 text-[var(--wh-muted)]">{sub}</span>
              </span>
              <span className="text-sm font-semibold">{me[key] ? 'On' : 'Off'}</span>
            </button>
          ))}
        </div>
        <p className="m-0 text-sm text-[var(--wh-muted)]">Each of these ends with “Stop these”, which switches that one off without signing in.</p>
      </DialogBody>
      <DialogFooter className="flex justify-end">
        <Button variant="accent" onClick={onClose}>Done</Button>
      </DialogFooter>
    </Dialog>
  );
}

type Filter = 'Everything' | 'Repairs' | 'Purchases';

function HistoryCard({ items, shopSlug, shopName, bookLink }: { items: Item[]; shopSlug: string; shopName: string; bookLink: React.ReactNode }) {
  const idBase = React.useId();
  const [filter, setFilter] = React.useState<Filter>('Everything');
  const [more, setMore] = React.useState(false);
  const pills = (
    <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
      {(['Everything', 'Repairs', 'Purchases'] as const).map((f) => (
        <button key={f} type="button" aria-pressed={f === filter} onClick={() => setFilter(f)} className={cn('min-h-11 cursor-pointer rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 text-sm text-[var(--wh-ink)]', f === filter && 'border-[var(--wh-ink)] bg-[var(--wh-ink)] font-semibold text-[var(--wh-panel)]')}>{f}</button>
      ))}
    </div>
  );
  if (!items.length) {
    return (
      <Card id={`${idBase}-history`} title="History" aside={pills}>
        <div className="flex flex-col items-center gap-3 px-3 py-9 text-center">
          <p className="m-0 max-w-[360px] text-size-15 text-[var(--wh-muted)]">{`Nothing here yet. Your repairs and purchases with ${shopName} show here.`}</p>
          {bookLink}
        </div>
      </Card>
    );
  }
  const shown = items.filter((i) => filter === 'Everything' || (filter === 'Repairs') === (i.kind === 'repair'));
  const newest = (a: Item, b: Item) => b.at.localeCompare(a.at);
  const now = shown.filter((i): i is Repair => isNow(i)).sort(newest);
  const earlier = shown.filter((i) => !isNow(i)).sort(newest);
  const earlierShown = more ? earlier : earlier.slice(0, EARLIER_SHOWN);
  const sub = (t: string) => <h3 className="m-0 pt-3 pb-1 text-size-13 font-bold text-[var(--wh-muted)]">{t}</h3>;
  return (
    <Card id={`${idBase}-history`} title="History" aside={pills}>
      <div className="flex flex-col">
        {now.length ? <>{sub('Now')}{now.map((r) => <RepairRow key={`r${r.jobId}`} r={r} shopSlug={shopSlug} />)}</> : null}
        {/* Not drawn: with nothing earlier yet, no heading over nothing. */}
        {earlier.length ? sub('Earlier, newest first') : null}
        {earlierShown.map((i) => (i.kind === 'repair' ? <RepairRow key={`r${i.jobId}`} r={i} shopSlug={shopSlug} /> : <PurchaseRow key={`p${i.source}${i.id}`} p={i} />))}
      </div>
      {!more && earlier.length > EARLIER_SHOWN ? (
        <div><button type="button" onClick={() => setMore(true)} className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wh-ink)] underline">Show more</button></div>
      ) : null}
    </Card>
  );
}

const rowClass = 'flex min-h-[60px] items-center gap-2 border-t border-[var(--wh-border)] py-1.5 text-[var(--wh-ink)] no-underline sm:gap-3';
const kindClass = 'hidden w-[76px] shrink-0 text-size-13 font-bold text-[var(--wh-muted)] sm:inline';

function RepairRow({ r, shopSlug }: { r: Repair; shopSlug: string }) {
  const now = isNow(r);
  const title = [r.reference, r.bikeLabel, r.title].filter(Boolean).join(' · ');
  const under = now ? `Booked in ${shortDate(r.jobDate)}` : `${shortDate(r.jobDate)} · ${STAGE_TEXT[r.stage].toLowerCase()}`;
  return (
    <Link to={`/book/${shopSlug}/booking/job-${r.jobId}`} className={rowClass}>
      <span className={kindClass}>Repair</span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-size-15 font-semibold">{title}</span>
        <span className="text-size-15 text-[var(--wh-muted)]"><span className="sm:hidden">Repair · </span>{under}</span>
      </span>
      {now
        ? <span className="shrink-0 rounded-full bg-[var(--wh-status-pending-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--wh-status-pending-ink)]">{chip(r)}</span>
        : r.totalPence !== null ? <span className="shrink-0 font-[family-name:var(--wh-font-mono)] text-size-15">{pounds(r.totalPence)}</span> : null}
      <span aria-hidden="true" className="text-[var(--wh-muted)]">›</span>
    </Link>
  );
}

// A purchase opens nothing yet: its receipt is a later piece (design 2).
function PurchaseRow({ p }: { p: Purchase }) {
  const number = p.receiptNumber !== null ? String(p.receiptNumber) : `No. ${p.id}`;
  return (
    <div className={rowClass}>
      <span className={kindClass}>Purchase</span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-size-15 font-semibold">{`${number} · ${p.what}`}</span>
        <span className="text-size-15 text-[var(--wh-muted)]"><span className="sm:hidden">Purchase · </span>{`${shortDate(londonDate(p.at))} · in the shop`}</span>
      </span>
      <span className="shrink-0 font-[family-name:var(--wh-font-mono)] text-size-15">{pounds(p.totalPence)}</span>
    </div>
  );
}
