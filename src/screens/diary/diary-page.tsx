import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { createPortal } from 'react-dom';
import { apiGet, ApiError } from '@/lib/api/client.ts';
import type { WorkshopJob } from '@/lib/api/types.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { printReceipt, type ReceiptSale, type ShopDetails } from '@/screens/till/receipt.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { HeaderSlotContext } from '@/staff/header-slot.ts';
import { RequestDialog } from './request-dialog.tsx';
import { NewJobDialog, type ForOrder } from './new-job-dialog.tsx';
import { OfferDialog, requestMinutes, type OfferAt } from './offer-dialog.tsx';
import { JobDialog } from './job-dialog.tsx';
import { Chevron, Floating, initial, shortWeek, useIsNarrow, useIsPhone, useMedia } from './diary-bits.tsx';
import { BlockLinesContext, ExtrasContext, MoveContext, PickContext, SlotContext, type PickApi } from './diary-context.ts';
import { BLOCK, CHIP, PHONE_SLOT_H, SLOT_H, SR, blocksOf, cardDay, describe, type Col, type Mechanic, type Outline, type Settings, type Shown, type Waiting } from './diary-model.ts';
import { ChosenBar, MoveErrorBox, NoticeBox, PickBar, WaitingSheet } from './diary-menus.tsx';
import { ChooseDaySheet, MonthGrid } from './diary-month.tsx';
import { Column, Grid, NewOnlineMark } from './diary-tiles.tsx';
import { useDiaryExtras } from './use-diary-extras.tsx';
import { useDiaryMoves } from './use-diary-moves.ts';
import {
  LEGEND, LEGEND_LABEL, addDays, addMonths, dropStart, monthLabel, monthOf, dayLabel, diaryState, gridRange, hhmm, todayIso, toMinutes,
  shortDay, waitingCard, weekLabel, weekOf, type DiaryState, type WaitingItem,
} from './rules.ts';

/**
 * Workshop › Diary, piece 1: seeing the week and the day (journey 12,
 * drawn by docs/design/user-journeys/generator/diary.mjs). Nothing here
 * changes a job yet; answering requests and moving jobs are the next pieces.
 * Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md
 *
 * The diary keeps its place in the address (?date=, ?view=day, ?who=), so a
 * reload or a shared link opens the same week.
 */

export function DiaryPage() {
  const [params, setParams] = useSearchParams();
  const isPhone = useIsPhone();
  const isNarrow = useIsNarrow();
  const today = todayIso();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? (params.get('date') as string) : today;
  // On a phone the diary is always one day (decision 68); the week is the strip of days.
  const askedView = params.get('view');
  const view: 'week' | 'day' | 'month' = isPhone || askedView === 'day' ? 'day' : askedView === 'month' ? 'month' : 'week';
  // A day's jobs in the month are too small to tap one by one on a touch screen (decision 68).
  const coarse = useMedia('(pointer: coarse)');
  const who = params.get('who');
  const slotPx = isPhone ? PHONE_SLOT_H : SLOT_H;
  const [chosen, setChosen] = useState<number | null>(null);
  // How the last press on a Waiting card was made: a second tap opens the
  // chosen card on a touch screen, a second mouse click doesn't (decision 14).
  const cardPointer = useRef<string>('mouse');
  // The phone's By mechanic names, kept in step with the columns as they scroll.
  const mechHeadRef = useRef<HTMLDivElement>(null);
  // Whether the chosen card was chosen by a tap, for its hint (layout review 238, item 3).
  const [chosenByTouch, setChosenByTouch] = useState(false);
  const [openItem, setOpenItem] = useState<WaitingItem | null>(null);

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  };

  const days = view === 'week' ? weekOf(date) : view === 'month' ? monthOf(date) : [date];
  // A phone loads the whole week, so tapping another day in the strip is instant.
  const fetchDays = isPhone ? weekOf(date) : days;
  const start = fetchDays[0];
  const end = fetchDays[fetchDays.length - 1];

  const mechanics = useQuery({ queryKey: ['mechanics'], queryFn: () => apiGet<Mechanic[]>('/api/employees?role=mechanic') });
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<Settings>('/api/workshop-settings') });
  const waiting = useQuery({ queryKey: ['workshop-waiting'], queryFn: () => apiGet<Waiting>('/api/workshop-waiting'), refetchInterval: 60_000 });
  const jobs = useQuery({
    queryKey: ['workshop-jobs', start, end],
    queryFn: () => apiGet<WorkshopJob[]>(`/api/workshop-jobs?start=${start}&end=${end}`),
    // Keep the last week on screen while the next one loads, rather than
    // blanking the grid on every arrow press.
    placeholderData: (previous) => previous,
  });

  const people = (mechanics.data ?? []).filter((m) => m.active);
  const whoId = who && people.some((m) => String(m.id) === who) ? Number(who) : null;
  // Only the jobs no mechanic has yet (Jack, 18 Oct, docs/decisions/2026-10-18-old-diary-features.md answer 5).
  const shared = who === 'shared';
  // A phone shows Everyone in one column unless "By mechanic" is chosen.
  const byMechanic = !isPhone || who === 'bymech';

  const shown: Shown[] = (jobs.data ?? [])
    .flatMap(blocksOf)
    .map((j) => ({ ...j, state: diaryState(j) }))
    .filter((j): j is Shown => j.state !== 'hidden')
    .filter((j) => (shared ? j.mechanicId === null : whoId === null || j.mechanicId === whoId));
  const range = gridRange(settings.data ?? {}, shown);
  // From the jobs on screen, and from "Waiting for you" for a booking whose
  // own day is in another week (Jack, 15 Oct).
  const onScreen = new Set(shown.map((j) => j.id));
  const outlines: Outline[] = [
    ...shown.filter((j) => j.state === 'hold' && j.partPos === 1 && j.requested?.startTime)
      .map((j) => ({ id: j.id, label: j.bikeLabel || 'Bike', mechanicId: j.mechanicId, requested: j.requested ?? {} })),
    ...(waiting.data?.items ?? [])
      .filter((i) => i.kind === 'change_request' && i.jobId && !onScreen.has(i.jobId) && i.to?.startTime
        && (shared ? !i.mechanicId : whoId === null || i.mechanicId === whoId))
      .map((i) => ({ id: i.jobId as number, label: i.customerName || 'Customer', mechanicId: i.mechanicId ?? null, requested: i.to ?? {} })),
  ];
  const outlinesFor = (pred: (o: Outline) => boolean) => outlines.filter(pred);

  const step = view === 'week' ? 7 : 1;
  const unit = view;
  const shift = (n: -1 | 1) => (view === 'month' ? addMonths(date, n) : addDays(date, n * step));

  // The grid's columns: the week's days, or the day's mechanics.
  let columns: Col[];
  if (view !== 'day') {
    columns = days.map((d) => ({ key: d, label: dayLabel(d), date: d, mechanicId: null }));
  } else if (shared) {
    columns = [{ key: 'none', label: 'Shared queue', date, mechanicId: null }];
  } else if (whoId === null && !byMechanic) {
    columns = [{ key: 'all', label: 'Everyone', date, mechanicId: null, all: true }];
  } else {
    columns = (whoId === null ? people : people.filter((m) => m.id === whoId))
      .map((m) => ({ key: String(m.id), label: m.name, date, mechanicId: m.id }));
    if (whoId === null && shown.some((j) => j.jobDate === date && j.startTime && j.mechanicId === null)) {
      columns.push({ key: 'none', label: 'Not assigned yet', date, mechanicId: null });
    }
  }
  const jobsIn = (c: Col) => shown.filter((j) => j.jobDate === c.date && (view !== 'day' || c.all || j.mechanicId === c.mechanicId));
  const outlinesIn = (c: Col) => outlinesFor((o) => o.requested.jobDate === c.date
    && (view !== 'day' || c.all || (o.requested.mechanicId ?? o.mechanicId) === c.mechanicId));
  // With the time asked for on screen, the chosen job takes the drawing's light
  // mark and the time the strong ring (change-selected).
  const chosenTimeShown = columns.some((c) => outlinesIn(c).some((o) => o.id === chosen));

  // ---- Moving a job (piece 3) ----
  const queryClient = useQueryClient();
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  // An offered time opens its request pop-up (Jack, 20 Oct, request-offered),
  // however it's opened: its block, a stack's chooser, the menu or the overview.
  const openShown = (job: WorkshopJob & { state: DiaryState }) => {
    if (job.state === 'offered') { setOpenItem(requestItem(job, 'offered')); return; }
    setOpenJobId(job.id);
  };
  const { preview, moveNote, moveError, setMoveError, moveApi, openJob, startStretch, startKeyMove, followPart, justDragged } = useDiaryMoves({
    columns, view, range, settings: settings.data, slotPx, isPhone, jobsIn, openShown,
  });
  // A booking message that couldn't go (booking messages answer 5, diary-no-message).
  const [notice, setNotice] = useState<string | null>(null);
  const session = useSession();
  // "Print receipt" (Jack, 18 Oct, docs/decisions/2026-10-18-print-receipt.md):
  // the paid order names its sale; that sale is the receipt.
  async function printJobReceipt(j: { orderId: number | null; reference: string; bikeLabel?: string | null; signedOffByName?: string | null; customerDescription?: string | null }) {
    setMoveError(null);
    try {
      const order = await apiGet<{ convertedSaleId: number | null }>(`/api/sale-documents/${j.orderId}`);
      if (!order.convertedSaleId) throw new Error('no sale');
      const sale = await apiGet<ReceiptSale>(`/api/sales/${order.convertedSaleId}`);
      // The shop's address, phone and VAT number (Shop details, 18 Oct).
      const details = await queryClient.fetchQuery({ queryKey: ['shop-details'], queryFn: () => apiGet<ShopDetails & { name: string }>('/api/shop-details') }).catch(() => undefined);
      printReceipt({ details, sale, shopName: details?.name ?? (session.status === 'signed-in' ? session.shop.name : ''), job: { reference: j.reference, bikeLabel: j.bikeLabel ?? null, customerWords: j.customerDescription ?? null, checkedBy: settings.data?.showSignOffToCustomers ? j.signedOffByName ?? null : null } });
    } catch {
      setMoveError('Wheelhouse couldn’t get this job’s receipt to print. Try again in a moment.');
    }
  }

  const grid: ReactNode = view === 'month' ? (
    <MonthGrid days={days} month={date} jobs={shown} today={today} coarse={coarse} onOpen={openJob} onOpenDay={(d) => set({ view: 'day', date: d })} />
  ) : (
    <Grid
      ariaLabel={view === 'week' ? `Workshop diary, week of ${dayLabel(start)}` : `Workshop diary, ${dayLabel(date)}, by mechanic`}
      range={range}
      heads={view === 'week'
        ? days.map((d) => {
          const [weekday, ...rest] = shortDay(d).split(' ');
          return { key: d, top: weekday, main: rest.join(' '), today: d === today };
        })
        : columns.map((c) => ({ key: c.key, main: c.label }))}
      // The Day view has the row too, with that day's untimed jobs (Jack, 15 Oct, issue 192).
      noTime={shown.filter((j) => !j.startTime && (view === 'week' || j.jobDate === date))}
      onOpen={openJob}
      columns={columns.map((c, i) => (
        <Column key={c.key} label={c.label} index={i} jobs={jobsIn(c)} outlines={outlinesIn(c)} range={range} wide={view === 'day'} chosenId={chosen} lightChosen={chosenTimeShown} />
      ))}
    />
  );

  // ---- New job (piece 5) ----
  const [picking, setPicking] = useState(false);
  const [newJob, setNewJob] = useState<{ date: string; startMin: number; mechanicId: number | null; auto: boolean; entered?: boolean; order?: ForOrder } | null>(null);
  // ---- Offer another time (Jack, 20 Oct): the same pick mode, for a request ----
  const [offering, setOffering] = useState<WorkshopJob | null>(null);
  const [offerAt, setOfferAt] = useState<OfferAt | null>(null);
  const newJobPicking = picking && !offering;

  const { extrasApi, extrasUi } = useDiaryExtras({
    isPhone, otherBusy: Boolean(preview || picking || openJobId !== null || newJob || offerAt), picking, waitingItems: waiting.data?.items ?? [],
    openShown, startStretch, startKeyMove, followPart, justDragged, printJobReceipt, setOpenItem,
  });

  /** Decision 18: the mechanic working that day with the most free time (fewest booked minutes). */
  const freest = (day: string): number | null => {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const working = people.filter((m) => !Array.isArray(m.workingDays) || m.workingDays.includes(weekday));
    const pool = working.length ? working : people;
    let best: number | null = null;
    let bestMinutes = Infinity;
    for (const m of pool) {
      const booked = (jobs.data ?? []).flatMap(blocksOf).filter((j) => j.jobDate === day && j.mechanicId === m.id && j.startTime && j.endTime)
        .reduce((sum, j) => sum + toMinutes(j.endTime as string) - toMinutes(j.startTime as string), 0);
      if (booked < bestMinutes) { best = m.id; bestMinutes = booked; }
    }
    return best;
  };
  const pickApi: PickApi = picking ? {
    onPick(colIndex, y) {
      const c = columns[colIndex];
      const startMin = dropStart(y, range, 30, slotPx);
      const fixed = view === 'day' && !c.all;
      if (offering) {
        // A mechanic's own column gives that mechanic; else the request's, else
        // the freest that day (decision 18). Shared queue has none (fresh review).
        const columnMechanic = fixed ? c.mechanicId : null;
        setOfferAt({ date: c.date, startMin: dropStart(y, range, requestMinutes(offering), slotPx), mechanicId: columnMechanic ?? offering.mechanicId ?? freest(c.date) });
        setPicking(false);
        return;
      }
      setNewJob({ date: c.date, startMin, mechanicId: fixed ? c.mechanicId : freest(c.date), auto: !fixed });
      setPicking(false);
    },
  } : null;
  // Keyboard users land on the bar's first button (it is at the end of the page).
  const enterInsteadRef = useRef<HTMLButtonElement>(null);
  const pickCancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (picking) (offering ? pickCancelRef : enterInsteadRef).current?.focus(); }, [picking, offering]);
  // The request's card again, from Waiting for you or made from the job, to go back to it.
  const requestItem = (j: { id: number; reference?: string | null; customerName?: string | null; mechanicId?: number | null; jobDate: string; startTime?: string | null; endTime?: string | null }, kind: 'new_booking' | 'offered' = 'new_booking'): WaitingItem =>
    (kind === 'new_booking' ? (waiting.data?.items ?? []).find((i) => i.jobId === j.id && i.kind === 'new_booking') : undefined)
    ?? { kind, jobId: j.id, reference: j.reference ?? undefined, customerName: j.customerName ?? null, serviceNames: [], mechanicId: j.mechanicId ?? null, jobDate: j.jobDate, startTime: j.startTime ?? null, endTime: j.endTime ?? null };
  const backToRequest = () => {
    if (offering) setOpenItem(requestItem(offering, offering.bookingState === 'offered' ? 'offered' : 'new_booking'));
    setOffering(null);
    setOfferAt(null);
    setPicking(false);
  };
  const startOffer = (j: WorkshopJob) => { setOffering(j); setOfferAt(null); setMoveError(null); if (view === 'month') set({ view: null }); setPicking(true); };
  const enterInstead = () => {
    setNewJob({ date, startMin: range.start, mechanicId: freest(date), auto: true, entered: true });
    setPicking(false);
  };
  // From the old app's order screen (Jack, 20 Oct, docs/decisions/2026-10-18-retire-old-diary.md):
  // ?job= opens that job as a click on its block does; ?order= opens New job,
  // as "Enter a time instead" does, filled in from the order. Each is read
  // once, then dropped from the address so going back or reloading doesn't
  // open it again.
  const fromAddress = useRef(false);
  // The order read, until the mechanics, opening hours and jobs are in, so
  // New job chooses the mechanic and the first hour as it would from the diary.
  const [orderFor, setOrderFor] = useState<ForOrder | null>(null);
  useEffect(() => {
    if (fromAddress.current) return;
    fromAddress.current = true;
    if (!params.has('job') && !params.has('order')) return;
    const jobId = Number(params.get('job'));
    const orderId = Number(params.get('order'));
    const kept = new URLSearchParams(params);
    kept.delete('job');
    kept.delete('order');
    setParams(kept, { replace: true });
    const words = (err: unknown) => (err instanceof ApiError ? err.message : 'the server couldn’t be reached');
    const openById = async (id: number) => {
      const job = await apiGet<WorkshopJob>(`/api/workshop-jobs/${id}`);
      const state = diaryState(job);
      if (state === 'hidden') setOpenJobId(job.id);
      else openShown({ ...job, state });
    };
    if (Number.isInteger(jobId) && jobId > 0) {
      openById(jobId).catch((err) => setNotice(`Couldn’t open that job: ${words(err)}`));
    }
    if (Number.isInteger(orderId) && orderId > 0) {
      (async () => {
        try {
          const doc = await apiGet<{ id: number; status: string; title: string; customerId: number | null; note: string | null; workshopJobId: number | null }>(`/api/sale-documents/${orderId}`);
          // Checked before a job is made, as the order refuses the link after.
          if (doc.status !== 'open') { setNotice(`That order is already ${doc.status}, so it can’t go in the diary.`); return; }
          if (doc.workshopJobId) { await openById(doc.workshopJobId); return; }
          const customer = doc.customerId ? await apiGet<{ id: number; name: string; email: string | null; phone: string | null }>(`/api/customers/${doc.customerId}`) : null;
          setOrderFor({ id: doc.id, title: doc.title || `Order #${doc.id}`, customer, notes: doc.note ?? '' });
        } catch (err) {
          setNotice(`Couldn’t open that order: ${words(err)}`);
        }
      })();
    }
  });
  // Handed to New job once the mechanics, opening hours and jobs are in, during
  // render as the state it follows from changes; one of them failing would
  // otherwise leave the order waiting with nothing said.
  const notLoaded = [mechanics, settings, jobs].find((q) => q.isError)?.error;
  if (orderFor && notLoaded) {
    setOrderFor(null);
    setNotice(`Couldn’t open that order: ${notLoaded instanceof ApiError ? notLoaded.message : 'the server couldn’t be reached'}`);
  } else if (orderFor && mechanics.data && settings.data && jobs.data) {
    setOrderFor(null);
    setNewJob({ date, startMin: range.start, mechanicId: freest(date), auto: true, entered: true, order: orderFor });
  }
  const newJobDialog = newJob ? (
    <NewJobDialog
      key={`${newJob.date}-${newJob.startMin}`}
      date={newJob.date}
      startMin={newJob.startMin}
      mechanicId={newJob.mechanicId}
      autoChosen={newJob.auto}
      entered={newJob.entered}
      chooseMechanic={freest}
      people={people}
      order={newJob.order}
      onSavedWithProblem={setNotice}
      onClose={() => setNewJob(null)}
    />
  ) : null;
  const pickBar = picking ? <PickBar offering={offering} isPhone={isPhone} enterInsteadRef={enterInsteadRef} cancelRef={pickCancelRef} onEnterInstead={enterInstead} onCancel={() => (offering ? backToRequest() : setPicking(false))} /> : null;
  const offerDialog = offering && offerAt ? (
    <OfferDialog
      key={`${offerAt.date}-${offerAt.startMin}-${offerAt.mechanicId}`}
      job={offering}
      at={offerAt}
      people={people}
      onChooseAgain={() => { setOfferAt(null); setPicking(true); }}
      onKeep={backToRequest}
      onOffered={(note) => { setOffering(null); setOfferAt(null); setChosen(null); if (note) setNotice(note); }}
    />
  ) : null;
  const moveErrorBox = moveError ? <MoveErrorBox message={moveError} onClose={() => setMoveError(null)} /> : null;
  const noticeBox = notice ? <NoticeBox message={notice} onClose={() => setNotice(null)} /> : null;
  const floating = pickBar || moveErrorBox || noticeBox ? <Floating>{pickBar}{moveErrorBox}{noticeBox}</Floating> : null;
  // Room at the foot of the page, so the floating bar can't hide the last
  // hour of the diary: scrolling to the bottom brings it above the bar.
  const floatingSpacer = floating ? <div data-floating-spacer aria-hidden="true" className="h-28" /> : null;

  // ---- Phone (piece 4) ----
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chooseOpen, setChooseOpen] = useState(false);
  // The top bar's action slot, drawn by the frame outside this page.
  const headerSlot = useContext(HeaderSlotContext);
  const items = waiting.data?.items ?? [];
  const chip = (key: string, label: string, name: string, badge: ReactNode, on: boolean) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      aria-label={name}
      onClick={() => set({ who: key === 'all' ? null : key })}
      className={`inline-flex min-h-11 items-center gap-[7px] rounded-full border py-[5px] pr-3.5 pl-[5px] text-[13px] font-semibold ${on ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}
    >
      <span aria-hidden="true" className={`inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${on ? 'bg-[var(--wh-panel)] text-[var(--wh-accent-soft-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]'}`}>
        {badge}
      </span>
      {label}
    </button>
  );

  // The Waiting list as a sheet: on a phone, and on an upright tablet where
  // there's no room for its column (Jack, 16 Oct; layout review 238, item 7).
  const chooseItem = (item: WaitingItem) => {
    if (chosen === item.jobId) { setOpenItem(item); setSheetOpen(false); return; }
    setChosen(item.jobId ?? null);
    const day = cardDay(item);
    if (day) set({ date: day, who: null });
    setSheetOpen(false);
  };
  // The chosen card with Open, at the foot of a phone or an upright tablet,
  // where there's no Waiting column to show it in.
  const chosenItem = items.find((i) => i.jobId === chosen) ?? null;
  const chosenBar = chosenItem ? <ChosenBar item={chosenItem} onOpen={() => setOpenItem(chosenItem)} /> : null;
  const waitingSheet = <WaitingSheet open={sheetOpen} onOpenChange={setSheetOpen} count={waiting.data?.count ?? items.length} items={items} chosen={chosen} onChoose={chooseItem} />;

  if (isPhone) {
    const week = weekOf(date);
    const showing = shared ? 'Shared queue' : whoId !== null ? people.find((m) => m.id === whoId)?.name ?? 'Everyone' : byMechanic ? 'By mechanic' : 'Everyone';
    const hours: number[] = [];
    for (let m = Math.ceil(range.start / 60) * 60; m < range.end; m += 60) hours.push(m);
    const noTime = columns.length === 1 ? shown.filter((j) => j.jobDate === date && !j.startTime) : [];
    const pickPeople = (value: string | null) => { set({ who: value }); setPeopleOpen(false); };
    return (
      <div className="-m-3.5 flex flex-col">
        {headerSlot ? createPortal(
          <button
            type="button"
            aria-label={`Waiting for you, ${waiting.data?.count ?? items.length}`}
            onClick={() => setSheetOpen(true)}
            className="inline-flex min-h-11 items-center gap-[7px] rounded-[10px] border border-[var(--wh-on-accent)]/35 pr-2.5 pl-3 text-[15px] font-semibold text-[var(--sidebar-foreground)]"
          >
            Waiting
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--wh-panel)] px-[7px] text-[13px] font-bold text-[var(--wh-ink)]">
              {waiting.data?.count ?? items.length}
            </span>
          </button>,
          headerSlot,
        ) : null}
        {headerSlot ? createPortal(
          <button
            type="button"
            aria-label={newJobPicking ? 'Choose a time' : 'New job'}
            aria-pressed={newJobPicking}
            onClick={() => { setPicking((v) => (offering ? true : !v)); setOffering(null); setOfferAt(null); setMoveError(null); }}
            className={`inline-flex size-11 items-center justify-center rounded-[10px] text-[22px] ${newJobPicking ? 'bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)] shadow-[0_0_0_3px_var(--wh-highlight)]' : 'bg-[var(--wh-panel)] text-[var(--wh-ink)]'}`}
          >
            <span aria-hidden="true">+</span>
          </button>,
          headerSlot,
        ) : null}

        <div className="flex flex-col gap-2 border-b border-[var(--wh-border)] px-3.5 py-2.5">
          {/* The people chip shortens its text, rather than the row running off
              a narrow phone, when Today is showing (Jack, 16 Oct). */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="relative min-w-0">
              <button
                type="button"
                aria-expanded={peopleOpen}
                aria-label={`Showing ${showing}. Change whose jobs are shown`}
                onClick={() => setPeopleOpen((o) => !o)}
                className="inline-flex min-h-11 max-w-full items-center gap-[7px] rounded-full bg-[var(--wh-accent-soft)] py-[5px] pr-2.5 pl-1.5 text-sm font-semibold whitespace-nowrap text-[var(--wh-accent-soft-ink)]"
              >
                <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--wh-panel)]">
                  {whoId !== null ? initial(showing) : <NavIcon name="customers" size={14} />}
                </span>
                <span className="min-w-0 truncate">{showing}</span>
                <Chevron dir="next" />
              </button>
              {peopleOpen ? (
                <div role="menu" aria-label="Whose jobs to show" className="absolute top-full left-0 z-20 mt-1 flex min-w-[200px] flex-col rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1 shadow-[0_10px_26px_var(--wh-backdrop)]">
                  {[{ v: null as string | null, label: 'Everyone' }, { v: 'bymech', label: 'By mechanic' }, ...people.map((m) => ({ v: String(m.id), label: m.name })), { v: 'shared', label: 'Shared queue' }].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="menuitemradio"
                      aria-checked={showing === o.label}
                      onClick={() => pickPeople(o.v)}
                      className={`min-h-11 rounded-md px-3 text-left text-sm font-semibold ${showing === o.label ? 'bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'hover:bg-[var(--wh-hover)]'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0">
              <button type="button" aria-label="Previous week" onClick={() => set({ date: addDays(date, -7) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
                <Chevron dir="prev" />
              </button>
              <button type="button" aria-haspopup="dialog" aria-label={`Choose a day. Showing ${shortWeek(week[0])}`} onClick={() => setChooseOpen(true)} className="inline-flex min-h-11 min-w-[66px] items-center justify-center text-sm font-bold whitespace-nowrap">{shortWeek(week[0])}</button>
              <button type="button" aria-label="Next week" onClick={() => set({ date: addDays(date, 7) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
                <Chevron dir="next" />
              </button>
              {/* Back to today in one tap, shown only away from it (Jack, 16 Oct; layout review 238, item 9). */}
              {date !== today ? (
                <button type="button" onClick={() => set({ date: null })} className="min-h-11 rounded-md px-1.5 text-sm font-semibold">Today</button>
              ) : null}
            </div>
          </div>
          {/* The week's days replace the Week/Day switch (decision 68). */}
          <div role="tablist" aria-label="Choose a day" className="flex gap-0.5 rounded-[10px] bg-[var(--wh-surface-muted)] p-[3px]">
            {week.map((d) => {
              const on = d === date;
              const [wd, dn] = shortDay(d).split(' ');
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={`${dayLabel(d)}${d === today ? ', today' : ''}`}
                  onClick={() => set({ date: d })}
                  className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-lg ${on ? 'bg-[var(--wh-panel)] shadow-[0_1px_2px_var(--wh-border)]' : ''}`}
                >
                  <span className={`text-xs font-bold uppercase ${on ? '' : 'text-[var(--wh-muted)]'}`}>{wd}</span>
                  <span className="text-base leading-tight font-bold">{dn}</span>
                  {d === today ? <span aria-hidden="true" className="absolute bottom-1 size-[5px] rounded-full bg-[var(--wh-highlight)]" /> : null}
                </button>
              );
            })}
          </div>
          {columns.length === 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">No time</span>
              <div role="group" aria-label="No time" className="flex flex-wrap gap-1.5">
                {noTime.length === 0 ? <span className="text-[13px] text-[var(--wh-muted)]">None</span> : null}
                {noTime.map((j) => (
                  <button type="button" key={j.partId} disabled={picking} onClick={() => openJob(j)} className={`inline-flex min-h-11 items-center rounded-full border border-[var(--wh-state-scheduled-ink)] px-3 text-[13px] font-bold whitespace-nowrap ${CHIP[j.state]}`}>
                    <span className={SR}>{describe(j, false)}</span>
                    <span aria-hidden="true" className="inline-flex items-center gap-1">{j.bikeLabel || 'Bike'}{j.newOnline ? <>{' · '}<NewOnlineMark short={false} /></> : null}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p id="diary-move-hint" className={SR}>Press Enter to open the job, or M to move it with the arrow keys. You can also drag it.</p>
        <p role="status" aria-live="polite" className={SR}>{moveNote}</p>

        <section aria-label={`Workshop diary, ${dayLabel(date)}`} className="px-3.5 pb-3.5">
          {/* By mechanic: each column keeps a readable 96px and the diary scrolls
              sideways in its own area; the times stay put and the names move
              with their columns (Jack, 17 Oct). */}
          {columns.length > 1 ? (
            <div ref={mechHeadRef} data-mech-headings className="sticky top-0 z-[4] overflow-hidden bg-[var(--wh-bg)]">
              <div className="grid" style={{ gridTemplateColumns: `48px repeat(${columns.length}, minmax(96px, 1fr))` }}>
                <span className="sticky left-0 z-[1] bg-[var(--wh-bg)]" />
                {columns.map((c) => (
                  <span key={c.key} data-mech className="truncate border-b border-l border-[var(--wh-border)] px-1 py-1.5 text-center text-sm font-bold first:border-l-0">{c.label}</span>
                ))}
              </div>
            </div>
          ) : null}
          <SlotContext.Provider value={PHONE_SLOT_H}>
            <PickContext.Provider value={pickApi}>
            <MoveContext.Provider value={moveApi}><ExtrasContext.Provider value={extrasApi}>
              <div
                data-mech-scroll
                className="scroll-pl-12 overflow-x-auto"
                onScroll={(e) => { if (mechHeadRef.current) mechHeadRef.current.scrollLeft = e.currentTarget.scrollLeft; }}
              >
              <div className="grid pt-2" style={{ gridTemplateColumns: `48px repeat(${columns.length}, minmax(${columns.length > 1 ? 96 : 0}px, 1fr))` }}>
                <div data-hours aria-hidden="true" className="sticky left-0 z-[3] bg-[var(--wh-bg)]" style={{ height: ((range.end - range.start) / 30) * PHONE_SLOT_H }}>
                  {hours.map((m) => (
                    <span key={m} className="absolute left-0 font-[family-name:var(--wh-font-mono)] text-xs text-[var(--wh-muted)]" style={{ top: Math.max(((m - range.start) / 30) * PHONE_SLOT_H - 8, 0) }}>
                      {hhmm(m)}
                    </span>
                  ))}
                </div>
                {columns.map((c, i) => (
                  <Column key={c.key} label={c.label} index={i} jobs={jobsIn(c)} outlines={outlinesIn(c)} range={range} wide={false} fullMark chosenId={chosen} lightChosen={chosenTimeShown} />
                ))}
              </div>
              </div>
            </ExtrasContext.Provider></MoveContext.Provider>
            </PickContext.Provider>
          </SlotContext.Provider>
        </section>

        {/* The foot of the phone page: passing messages sit above the chosen
            card's bar, at the end of the page, so nothing above moves and
            neither covers the other (Jack, 16 Oct). */}
        <div data-phone-foot className="sticky bottom-0 z-30 flex flex-col">
        {pickBar || moveErrorBox || noticeBox ? <div className="flex flex-col gap-2 px-3.5 pb-2">{pickBar}{moveErrorBox}{noticeBox}</div> : null}
        {chosenBar}
        </div>

        {waitingSheet}
        <ChooseDaySheet key={chooseOpen ? `open-${date}` : 'closed'} open={chooseOpen} date={date} who={(j) => (shared ? j.mechanicId === null : whoId === null || j.mechanicId === whoId)} whose={shared ? 'Shared queue' : whoId !== null ? people.find((m) => m.id === whoId)?.name ?? 'everyone' : 'everyone'} onClose={() => setChooseOpen(false)} onPick={(d) => { setChooseOpen(false); set({ date: d }); }} />

        {openItem ? <RequestDialog key={`${openItem.kind}-${openItem.jobId}`} item={openItem} onClose={() => setOpenItem(null)} onAnswered={() => setChosen(null)} onNotice={setNotice} onOpenJob={(id) => { setOpenItem(null); setOpenJobId(id); }} onOffer={startOffer} /> : null}
        {newJobDialog}
        {offerDialog}
        {openJobId !== null ? <JobDialog key={openJobId} jobId={openJobId} onClose={() => setOpenJobId(null)} /> : null}
        {extrasUi}
      </div>
    );
  }

  return (
    <BlockLinesContext.Provider value={{ first: settings.data?.blockFirst ?? 'bike', second: settings.data?.blockSecond ?? 'jobTitle' }}>
    <div className="flex flex-col gap-3">
      {/* Toolbar (decision 60): view and dates together · people and New job.
          From 1280px, spaced as the desktop Shared queue drawing (Jack, 18 Oct)
          so four people buttons fit one row; tablets keep their drawn spacing. */}
      <div className="flex flex-wrap items-center gap-3 xl:gap-x-1">
        <div role="tablist" aria-label="Diary view" className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-[10px] bg-[var(--wh-surface-muted)] p-[3px]">
          {(['week', 'day', 'month'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => { if (v === 'month') { setPicking(false); setOffering(null); } set({ view: v === 'week' ? null : v }); }}
              className={`inline-flex min-h-[38px] items-center rounded-lg px-4 text-[13px] font-semibold pointer-coarse:min-h-11 ${view === v ? 'bg-[var(--wh-panel)] shadow-[0_1px_2px_var(--wh-border)]' : ''}`}
            >
              {v === 'week' ? 'Week' : v === 'day' ? 'Day' : 'Month'}
            </button>
          ))}
        </div>
        {/* Week/Day and the dates together at the left, one control (Jack, 16 Oct; layout review 238, item 1). */}
        <div className="inline-flex shrink-0 items-center gap-1">
          <button type="button" aria-label={`Previous ${unit}`} onClick={() => set({ date: shift(-1) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
            <Chevron dir="prev" />
          </button>
          <span className="min-w-[164px] text-center text-sm font-semibold whitespace-nowrap">{view === 'week' ? weekLabel(start) : view === 'month' ? monthLabel(date) : dayLabel(date)}</span>
          <button type="button" aria-label={`Next ${unit}`} onClick={() => set({ date: shift(1) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--wh-input-border)]">
            <Chevron dir="next" />
          </button>
          <button type="button" onClick={() => set({ date: null })} className="ml-0.5 min-h-11 rounded-md px-2.5 text-[13px] font-semibold">
            Today
          </button>
        </div>
        {/* On an upright tablet this group is its own row: people on the left,
            Waiting and New job on the right (layout review 238, item 7). */}
        <div className="flex basis-full items-center gap-3 lg:grow lg:basis-auto xl:gap-0">
        <div className="hidden grow lg:block" />
        <div role="group" aria-label="Mechanic" className="flex flex-wrap items-center gap-1.5 xl:gap-1">
          {chip('all', 'Everyone', 'Everyone', <NavIcon name="customers" size={13} />, whoId === null && !shared)}
          {people.map((m) => chip(String(m.id), m.name.split(' ')[0], m.name, initial(m.name), whoId === m.id))}
          {chip('shared', 'Shared queue', 'Shared queue', <NavIcon name="customers" size={13} />, shared)}
        </div>
        <div className="grow lg:hidden" />
        <button
          type="button"
          aria-label={`Waiting for you, ${waiting.data?.count ?? items.length}`}
          onClick={() => setSheetOpen(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-[7px] rounded-[10px] border border-[var(--wh-input-border)] bg-[var(--wh-panel)] pr-2.5 pl-3 text-[15px] font-semibold lg:hidden"
        >
          Waiting
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--wh-surface-muted)] px-[7px] text-[13px] font-bold">{waiting.data?.count ?? items.length}</span>
        </button>
        <div className="hidden w-5 shrink-0 lg:block xl:w-2" />
        {newJobPicking ? (
          <button type="button" aria-pressed="true" onClick={() => setPicking(false)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-[15px] font-semibold text-[var(--wh-on-brand)]">
            Choose a time
          </button>
        ) : (
          <button type="button" onClick={() => { if (view === 'month') set({ view: null }); setOffering(null); setOfferAt(null); setPicking(true); setMoveError(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-[15px] font-semibold text-[var(--wh-on-brand)]">
            <span aria-hidden="true">+</span>
            New job
          </button>
        )}
        </div>
      </div>
      {isNarrow ? null : floating}

      <div className="flex items-start gap-4">
        {/* Waiting for you (decision 14). */}
        {/* Boxed in as a panel, its count a badge (Jack, 16 Oct; the layout review, pull request 238). */}
        <section aria-labelledby="waiting-heading" className="hidden w-[184px] shrink-0 flex-col gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-surface-muted)] p-2.5 lg:flex lg:w-[224px]">
          <h2 id="waiting-heading" className="m-0 flex items-center gap-2 text-sm font-bold">
            {/* Screen readers hear the name in one piece: "Waiting for you (2)". */}
            <span aria-hidden="true">Waiting for you</span>
            <span data-count-badge aria-hidden="true" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--wh-panel)] px-[7px] text-[13px] font-bold text-[var(--wh-ink)]">{waiting.data?.count ?? items.length}</span>
            <span className={SR}>{`Waiting for you (${waiting.data?.count ?? items.length})`}</span>
          </h2>
          {items.length === 0 && waiting.isSuccess ? <p className="m-0 text-[13px] text-[var(--wh-muted)]">Nothing waiting.</p> : null}
          {items.map((item) => {
            const card = waitingCard(item);
            const on = chosen === item.jobId;
            // byTap: the card was chosen by a finger, not a mouse or the keyboard.
            const choose = (byTap = false) => {
              setChosen(item.jobId ?? null);
              setChosenByTouch(byTap);
              const day = cardDay(item);
              if (day) set({ date: day, who: null });
            };
            return (
              <div
                key={`${item.kind}-${item.jobId}`}
                className={`flex flex-col gap-2 rounded-lg bg-[var(--wh-panel)] ${on ? 'border-2 border-[var(--accent)] shadow-[0_0_0_3px_var(--wh-highlight)]' : 'border border-[var(--wh-border)]'}`}
              >
                {/* One click chooses the card; double-click, or Open, opens it; on a
                    touch screen a second tap opens it too (decision 14). A click
                    from the keyboard (detail 0) is never a tap, as for a stack. */}
                <button
                  type="button"
                  aria-pressed={on}
                  onPointerDown={(e) => { cardPointer.current = e.pointerType; }}
                  onClick={(e) => { const tap = e.detail > 0 && cardPointer.current === 'touch'; if (on && tap) setOpenItem(item); else choose(tap); }}
                  onDoubleClick={() => { choose(); setOpenItem(item); }}
                  className="flex flex-col gap-[5px] rounded-lg px-3 pt-2.5 pb-2.5 text-left"
                >
                  {/* Larger on a touch screen, as drawn for the tablet (layout review 238, item 4). */}
                  <span className={`inline-flex self-start rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[card.tone]}`}>{card.label}</span>
                  <span className="text-[13px] font-bold pointer-coarse:text-[15px]">{card.customer}</span>
                  <span className="text-xs pointer-coarse:text-[13px]">{card.detail}</span>
                </button>
                {on ? (
                  <button
                    type="button"
                    aria-label={`Open ${card.customer}'s request`}
                    onClick={() => setOpenItem(item)}
                    className="mx-3 mb-2.5 inline-flex min-h-8 self-start items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-bold text-[var(--wh-on-brand)] pointer-coarse:min-h-11 pointer-coarse:px-[18px] pointer-coarse:text-sm"
                  >
                    Open
                  </button>
                ) : null}
              </div>
            );
          })}
          {/* How to open the chosen card, as drawn (layout review 238, item 3; decision 14). */}
          {chosen !== null && items.some((i) => i.jobId === chosen) ? (
            <p className="m-0 text-xs text-[var(--wh-muted)]">{chosenByTouch ? 'Tap the card again to open it.' : 'Double-click a card to open it.'}</p>
          ) : null}
        </section>

        <div className="flex min-w-0 grow flex-col gap-2.5">
          <p id="diary-move-hint" className={SR}>Press Enter to open the job, or M to move it with the arrow keys. You can also drag it.</p>
          <p role="status" aria-live="polite" className={SR}>{moveNote}</p>
          <div className="overflow-x-auto"><PickContext.Provider value={pickApi}><MoveContext.Provider value={moveApi}><ExtrasContext.Provider value={extrasApi}>{jobs.isLoading ? <p>Loading the diary…</p> : grid}</ExtrasContext.Provider></MoveContext.Provider></PickContext.Provider></div>
          {jobs.isError ? <p role="alert">Wheelhouse couldn&apos;t load the diary. Try again in a moment.</p> : null}
          <ul aria-label="What the colours mean" className="m-0 flex list-none flex-wrap gap-3 p-0">
            {LEGEND.map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5 text-xs">
                <span aria-hidden="true" className={`inline-block size-3.5 rounded-[3px] border-[1.75px] ${BLOCK[s]}`} />
                {LEGEND_LABEL[s]}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {isNarrow ? (
        // An upright tablet: the foot of the page, as on a phone.
        <div data-tablet-foot className="sticky bottom-0 z-30 -mx-3.5 flex flex-col md:-mx-[22px]">
          {pickBar || moveErrorBox || noticeBox ? <div className="flex flex-col gap-2 px-3.5 pb-2">{pickBar}{moveErrorBox}{noticeBox}</div> : null}
          {chosenBar}
        </div>
      ) : floatingSpacer}
      {waitingSheet}
      {openItem ? <RequestDialog key={`${openItem.kind}-${openItem.jobId}`} item={openItem} onClose={() => setOpenItem(null)} onAnswered={() => setChosen(null)} onNotice={setNotice} onOpenJob={(id) => { setOpenItem(null); setOpenJobId(id); }} onOffer={startOffer} /> : null}
      {newJobDialog}
      {offerDialog}
      {openJobId !== null ? <JobDialog key={openJobId} jobId={openJobId} onClose={() => setOpenJobId(null)} /> : null}
      {extrasUi}
    </div>
    </BlockLinesContext.Provider>
  );
}
