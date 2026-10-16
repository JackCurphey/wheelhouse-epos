import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError, jobAction } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { addDays, dayLabel, hhmm, shortDay, toMinutes } from './rules.ts';

/**
 * New job (journey 12; drawn as new-job and new-job-day in
 * docs/design/user-journeys/generator/diary.mjs), opened at the time chosen
 * on the grid. Only what the server saves is here: customer and bike, the
 * work (decision 66's pills: Full service / Individual service, from the
 * shop's own services), the title, notes, mechanic (decision 18 chooses the
 * one with most free time; the staff member can change it), starting status,
 * "The bike is here now" (books it in), and New bike build (decision 50:
 * the customer becomes optional).
 *
 * Decision 23: once work is chosen, the form warns when it is longer than
 * the mechanic's free time from the start chosen, and "Find the next free"
 * moves the job to that mechanic's next gap long enough (Jack, 15 Oct).
 *
 * Not here yet, because the server has nowhere to keep them: storage hooks,
 * and separate customer and staff notes.
 */

type Person = { id: number; name: string };
type Service = { id: number; name: string; minutes: number; active: boolean; kind: string | null };
type Customer = { id: number; name: string; email?: string | null; phone?: string | null };
type Bike = { id: number; make: string | null; model: string | null; colour: string | null };
type Capacity = { days: { date: string; mechanics: { mechanicId: number; freeWindows: { start: string; end: string }[] }[] }[] };

/** How far "Find the next free" looks, as Add another day does. */
const LOOK_AHEAD_DAYS = 60;

/** A mechanic's free stretches on one day, in minutes from midnight. */
function windowsOf(capacity: Capacity | undefined, day: string, mechanicId: number) {
  const m = capacity?.days.find((d) => d.date === day)?.mechanics.find((x) => x.mechanicId === mechanicId);
  return (m?.freeWindows ?? []).map((w) => ({ start: toMinutes(w.start), end: toMinutes(w.end) }));
}

const KINDS = [
  { kind: 'full', label: 'Full service' },
  { kind: 'individual', label: 'Individual service' },
];

const bikeName = (b: Bike) => [b.make, b.model].filter(Boolean).join(' ') + (b.colour ? ` · ${b.colour}` : '');

function Pill({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap ${on ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold ${on ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}
      >
        <span aria-hidden="true" className={`inline-block size-3 rounded-full border ${on ? 'border-[var(--wh-accent-soft-ink)] bg-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)]'}`} />
        {label}
      </button>
      <span className="text-xs text-[var(--wh-muted)]">{hint}</span>
    </div>
  );
}

const LABEL = 'text-sm font-semibold';
const INPUT = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm';

export function NewJobDialog({ date: chosenDate, startMin: chosenStart, mechanicId, autoChosen, entered = false, chooseMechanic, people, onClose }: {
  date: string; startMin: number; mechanicId: number | null; autoChosen: boolean; entered?: boolean;
  chooseMechanic?: (day: string) => number | null; people: Person[]; onClose: () => void;
}) {
  // Opened by "Enter a time instead" (Jack, 15 Oct, issue 192; drawn as
  // new-job-entered), the form has Date and Start time boxes, filled with the
  // diary's day and first hour. From a click on the grid it has the time clicked.
  const [dayBox, setDayBox] = useState(chosenDate);
  const [timeBox, setTimeBox] = useState(hhmm(chosenStart));
  // Where "Find the next free" moved a job opened from the grid.
  const [moved, setMoved] = useState<{ date: string; startMin: number } | null>(null);
  const date = entered ? dayBox : moved?.date ?? chosenDate;
  const startMin = entered && /^\d{2}:\d{2}$/.test(timeBox) ? toMinutes(timeBox) : moved?.startMin ?? chosenStart;
  const queryClient = useQueryClient();
  const [newBuild, setNewBuild] = useState(false);
  const [search, setSearch] = useState('');
  // The matches drop down over the form, so New job keeps one size while
  // staff type (Jack, 16 Oct).
  const [listOpen, setListOpen] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bikeId, setBikeId] = useState<number | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [mech, setMech] = useState<number | null>(mechanicId);
  // Picked by hand, the mechanic stays when the date changes; otherwise it is
  // chosen again for the new day (decision 18).
  const [mechByHand, setMechByHand] = useState(false);
  // The day the automatic choice was made for: "Find the next free" moves
  // the job but keeps the mechanic (Jack, 15 Oct), so the note keeps its day.
  const [autoDay, setAutoDay] = useState(chosenDate);
  function changeDay(day: string) {
    setDayBox(day);
    if (!mechByHand && autoChosen && chooseMechanic && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setMech(chooseMechanic(day));
      setAutoDay(day);
    }
  }
  const [status, setStatus] = useState<'scheduled' | 'waiting_parts'>('scheduled');
  const [bikeHere, setBikeHere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const services = useQuery({ queryKey: ['workshop-services'], queryFn: () => apiGet<Service[]>('/api/workshop-services') });
  const term = search.trim();
  const found = useQuery({
    queryKey: ['customers', term],
    queryFn: () => apiGet<Customer[]>(`/api/customers?search=${encodeURIComponent(term)}`),
    enabled: !customer && term.length >= 2,
  });
  const listShown = listOpen && found.isSuccess;
  const bikes = useQuery({
    queryKey: ['customer-bikes', customer?.id],
    queryFn: () => apiGet<Bike[]>(`/api/customers/${customer?.id}/bikes`),
    enabled: Boolean(customer),
  });

  const endMin = service ? startMin + service.minutes : null;
  const mechName = mech === null ? 'Shared queue' : people.find((p) => p.id === mech)?.name ?? 'Shared queue';

  // The Shared queue has no free stretches of its own, so it gets no warning.
  const realDay = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const capacity = useQuery({
    queryKey: ['workshop-capacity', date, date],
    queryFn: () => apiGet<Capacity>(`/api/workshop-capacity?start=${date}&end=${date}`),
    enabled: Boolean(service) && mech !== null && realDay,
  });
  const here = mech === null ? undefined : windowsOf(capacity.data, date, mech).find((w) => w.start <= startMin && startMin < w.end);
  const freeHere = here ? here.end - startMin : 0;
  const wontFit = Boolean(service && mech !== null && capacity.data && service.minutes > freeHere);
  // A search's answer belongs to the mechanic, work and time it was asked for.
  const asked = `${mech} ${service?.id} ${date} ${startMin}`;
  const latest = useRef(asked);
  useEffect(() => { latest.current = asked; }, [asked]);
  const [findNote, setFindNote] = useState<{ asked: string; text: string } | null>(null);
  const noneFound = findNote?.asked === asked ? findNote.text : null;
  const timeLine = useRef<HTMLParagraphElement>(null);
  const startBox = useRef<HTMLInputElement>(null);
  useEffect(() => { if (moved) timeLine.current?.focus(); }, [moved]);

  async function findNextFree() {
    if (!service || mech === null) return;
    const from = asked;
    const last = addDays(date, LOOK_AHEAD_DAYS - 1);
    let ahead: Capacity;
    try {
      ahead = await queryClient.fetchQuery({
        queryKey: ['workshop-capacity', date, last],
        queryFn: () => apiGet<Capacity>(`/api/workshop-capacity?start=${date}&end=${last}`),
        retry: false,
      });
    } catch {
      if (latest.current === from) setFindNote({ asked: from, text: "Couldn't find free time — try again." });
      return;
    }
    if (latest.current !== from) return;
    for (let i = 0; i < LOOK_AHEAD_DAYS; i++) {
      const day = addDays(date, i);
      for (const w of windowsOf(ahead, day, mech)) {
        // Later than the chosen start on its own day, on the quarter hour.
        const at = Math.ceil(Math.max(w.start, i === 0 ? startMin : 0) / 15) * 15;
        if (w.end - at >= service.minutes) {
          if (entered) {
            setDayBox(day);
            setTimeBox(hhmm(at));
            startBox.current?.focus();
          } else setMoved({ date: day, startMin: at });
          return;
        }
      }
    }
    setFindNote({ asked: from, text: `${mechName} has no free ${service.minutes} minutes in the next ${LOOK_AHEAD_DAYS} days.` });
  }
  const weekday = dayLabel(entered && !autoChosen ? date : autoDay).split(' ')[0];

  function chooseCustomer(c: Customer) {
    setCustomer(c);
    setSearch('');
    setBikeId(null);
  }
  // A customer's only bike is chosen for them once their bikes arrive.
  const bikeList = bikes.data ?? [];
  const effectiveBike = bikeId ?? (bikeList.length === 1 ? bikeList[0].id : null);

  function chooseService(s: Service) {
    setService(s);
    setTitle(s.name);
  }

  async function save() {
    if (entered && (!/^\d{4}-\d{2}-\d{2}$/.test(dayBox) || !/^\d{2}:\d{2}$/.test(timeBox))) {
      setError('Choose a date and a start time.');
      return;
    }
    // A click on the grid snaps to 15 minutes; a typed time keeps to the same.
    if (entered && startMin % 15 !== 0) {
      setError('Choose a start time on the quarter hour, like 14:30 or 14:45.');
      return;
    }
    if ((endMin ?? startMin + 60) > 24 * 60) {
      setError('The job would run past midnight. Choose an earlier start time.');
      return;
    }
    if (!title.trim() || (!customer && !newBuild)) {
      setError('Give the job a title, and choose a customer or turn on New bike build.');
      return;
    }
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      title: title.trim(),
      jobDate: date,
      startTime: hhmm(startMin),
      endTime: hhmm(endMin ?? startMin + 60),
      customerId: customer?.id ?? null,
      bikeId: customer ? effectiveBike : null,
      mechanicId: mech,
      status,
      notes: notes.trim(),
    };
    if (service) body.plannedMinutes = service.minutes;
    try {
      const job = await apiMutate<WorkshopJob>('/api/workshop-jobs', body);
      // A waiting-for-parts job is created with the bike already in, so
      // booking it in again would be refused (Jack, 8 Oct).
      if (bikeHere && job.custodyState !== 'in_shop') await jobAction(job.id, 'book-in', job.version);
      await queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="new-job-title" wide className="max-w-[960px]">
      <DialogHeader>
        <DialogTitle id="new-job-title">New job</DialogTitle>
        <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--wh-hover)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5">
        <Toggle on={newBuild} onChange={setNewBuild} label="New bike build or pre-delivery check" hint="Customer becomes optional." />
        <div className="grid gap-7 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2.5">
            {customer ? (
              <div className="flex items-start justify-between gap-2 rounded-lg border-2 border-[var(--accent)] bg-[var(--wh-surface-muted)] px-3 py-1.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold">{customer.name}</span>
                  <span className="text-[13px] text-[var(--wh-muted)]">{[customer.phone, customer.email].filter(Boolean).join(' · ')}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>Change</Button>
              </div>
            ) : (
              <div
                className="relative flex flex-col gap-1.5"
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setListOpen(false); }}
                // Escape closes the list (from the box or a result), not New job,
                // and only when the list is showing.
                onKeyDown={(e) => { if (e.key === 'Escape' && listShown) { e.preventDefault(); e.stopPropagation(); setListOpen(false); } }}
              >
                <label htmlFor="nj-find" className={LABEL}>Find customer by name, phone or email</label>
                <input
                  id="nj-find"
                  type="search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setListOpen(true); }}
                  onFocus={() => setListOpen(true)}
                  placeholder="Search by name, phone or email"
                  className={INPUT}
                  autoComplete="off"
                />
                {/* Said aloud as the results change; the list itself isn't. */}
                <span role="status" className="sr-only">{listShown ? (found.data?.length ? `${found.data.length} customer${found.data.length === 1 ? '' : 's'} found.` : `No customer matches “${term}”.`) : ''}</span>
                {listShown ? (
                  <div data-customer-results className="absolute top-full right-0 left-0 z-20 mt-1 flex max-h-60 flex-col gap-1 overflow-y-auto rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1 shadow-[0_8px_24px_var(--wh-backdrop)]">
                    {(found.data ?? []).map((c) => (
                      // Pressing keeps the focus in the search: Safari and iPad
                      // don't focus a clicked button, so the list would close first.
                      <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseCustomer(c)} className="flex flex-col rounded-md px-3 py-1.5 text-left hover:bg-[var(--wh-hover)]">
                        <span className="text-sm font-bold">{c.name}</span>
                        <span className="text-[13px] text-[var(--wh-muted)]">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                      </button>
                    ))}
                    {found.data?.length === 0 ? <span className="px-3 py-1.5 text-[13px] text-[var(--wh-muted)]">No customer matches “{term}”.</span> : null}
                  </div>
                ) : null}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nj-bike" className={LABEL}>Bike</label>
              <select id="nj-bike" className={INPUT} disabled={!customer} value={effectiveBike ?? ''} onChange={(e) => setBikeId(e.target.value ? Number(e.target.value) : null)}>
                {!customer ? <option value="">Select a customer first</option> : <option value="">No bike</option>}
                {bikeList.map((b) => (
                  <option key={b.id} value={b.id}>{bikeName(b)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="nj-work" className={LABEL}>Work</span>
              <div role="radiogroup" aria-labelledby="nj-work" className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <Pill key={k.kind} on={kind === k.kind} onClick={() => setKind(k.kind)}>{k.label}</Pill>
                ))}
              </div>
              {kind ? (
                <div role="radiogroup" aria-label={KINDS.find((k) => k.kind === kind)?.label} className="flex flex-wrap gap-1.5">
                  {(services.data ?? []).filter((s) => s.active && s.kind === kind).map((s) => (
                    <Pill key={s.id} on={service?.id === s.id} onClick={() => chooseService(s)}>{`${s.name} · ${s.minutes} min`}</Pill>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nj-title" className={LABEL}>Job title</label>
              <input id="nj-title" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} aria-describedby="nj-title-hint" />
              <span id="nj-title-hint" className="text-xs text-[var(--wh-muted)]">Filled in from the work chosen. Shown on the diary block.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nj-notes" className={LABEL}>Notes</label>
              <textarea id="nj-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${INPUT} py-2`} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2.5">
            {entered ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nj-date" className={LABEL}>Date</label>
                  <input id="nj-date" type="date" autoFocus value={dayBox} onChange={(e) => changeDay(e.target.value)} aria-invalid={error === 'Choose a date and a start time.' && !dayBox ? true : undefined} className={INPUT} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nj-time" className={LABEL}>Start time</label>
                  <input id="nj-time" ref={startBox} type="time" step={900} value={timeBox} onChange={(e) => setTimeBox(e.target.value)} aria-invalid={error !== null && error.startsWith('Choose a') && (!timeBox || error.includes('quarter')) ? true : undefined} className={INPUT} />
                </div>
              </div>
            ) : (
              <p ref={timeLine} tabIndex={-1} className="m-0 rounded-md bg-[var(--wh-state-scheduled-bg)] px-3 py-2 text-sm font-semibold text-[var(--wh-state-scheduled-ink)]">
                {`${shortDay(date)} · ${hhmm(startMin)}${endMin ? `–${hhmm(endMin)}` : ''} · ${mechName}`}
              </p>
            )}
            {/* Chosen for the day shown, until staff pick one themselves. */}
            {autoChosen && !mechByHand ? <span className="text-[13px] text-[var(--wh-muted)]">{`Mechanic chosen automatically: most free time on ${weekday}.`}</span> : null}
            {wontFit && service ? (
              <div role="status" className="rounded-md bg-[var(--wh-warn-bg)] px-3 py-2 text-sm text-[var(--wh-warn-ink)]">
                <span>{`${freeHere > 0 ? `Only ${freeHere} minutes free` : 'No free time'} at ${hhmm(startMin)} — this job needs ${service.minutes}. Choose another time, or save anyway and the diary will show the overlap.`}</span>{' '}
                <button type="button" onClick={() => void findNextFree()} className="font-semibold underline">{`Find the next free ${service.minutes} minutes`}</button>
                {noneFound ? <span className="mt-1 block">{noneFound}</span> : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <span id="nj-mech" className={LABEL}>Mechanic</span>
              <div role="radiogroup" aria-labelledby="nj-mech" className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <Pill key={p.id} on={mech === p.id} onClick={() => { setMech(p.id); setMechByHand(true); }}>{p.name}</Pill>
                ))}
                <Pill on={mech === null} onClick={() => { setMech(null); setMechByHand(true); }}>Shared queue</Pill>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="nj-status" className={LABEL}>Starting status</span>
              <div role="radiogroup" aria-labelledby="nj-status" className="flex flex-wrap gap-1.5">
                <Pill on={status === 'scheduled'} onClick={() => setStatus('scheduled')}>Booked</Pill>
                <Pill on={status === 'waiting_parts'} onClick={() => setStatus('waiting_parts')}>Waiting for parts</Pill>
              </div>
            </div>
            <Toggle on={bikeHere} onChange={setBikeHere} label="The bike is here now" hint="Books it in straight away." />
          </div>
        </div>
        {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="accent" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save job'}</Button>
      </DialogFooter>
    </Dialog>
  );
}
