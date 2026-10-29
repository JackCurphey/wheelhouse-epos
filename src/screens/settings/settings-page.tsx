import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { ROUTES } from '@/staff/routes.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { previewLines } from './booking-preview.ts';
import { AutomaticMessages, useMessagesSummary } from './messages-settings.tsx';
import { ChecklistsSettings, useChecklistsSummary } from './checklists-settings.tsx';
import { ServicesSettings, SERVICES_SUMMARY } from './services-settings.tsx';
import { DiaryBlocksSettings, useDiaryBlocksSummary } from './diary-blocks-settings.tsx';
import { StorageSlotsSettings, useStorageSlotsSummary } from './storage-slots-settings.tsx';
import { CustomerGroupsSettings, useCustomerGroupsSummary } from './customer-groups-settings.tsx';
import { CollectionSettings, useCollectionSummary } from './collection-settings.tsx';
import { FloatSettings, useFloatSummary } from './end-of-day-settings.tsx';
import { TillsSettings, useTillsSummary } from './tills-settings.tsx';
import { SigningInSettings, useSigningInSummary } from './signing-in-settings.tsx';
import { SettingsFrame, type SettingsRoom } from './settings-frame.tsx';
import { RowSwitch } from './row-switch.tsx';
import { shortDay } from '@/screens/diary/rules.ts';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';

/**
 * Settings, first piece (Jack, 18 Oct, docs/decisions/2026-10-16-mechanic-sign-off.md
 * "Piece 3"; drawn as set-workshop-sign-off in docs/design/user-journeys/generator/setup.mjs):
 * Workshop › Mechanics holds "Show who signed off to customers", off to
 * start, saved as soon as it's switched. The rest of Settings comes with
 * WP-5.1.
 */
type DayHours = { weekday: number; open: string; close: string };
type WorkshopSettings = { showSignOffToCustomers?: boolean; showPricesOnline?: boolean; confirmBookingsAutomatically?: boolean; openingHours?: DayHours[]; openingTime?: string; closingTime?: string; fullDayThresholdMinutes?: number; timedLeadMinutes?: number; bookingMode?: string; minNoticeMinutes?: number; minNoticeDays?: number | null;
  nextBookingMode?: string | null; nextBookingModeFrom?: string | null; dropoffWindowStart?: string; dropoffWindowEnd?: string; confirmationNote?: string; bookingTerms?: string | null;
  depositOn?: boolean; depositKind?: 'percent' | 'fixed'; depositPercent?: number | null; depositFixedPence?: number | null; depositUnknownPence?: number | null; depositCancelHours?: number; paymentsConnected?: boolean };
type ShopDetails = { name: string; address: string | null; phone: string | null; email: string | null; vatNumber: string | null; receiptFooter: string | null };
type DetailKey = keyof ShopDetails;
const DETAIL_ROWS: [Exclude<DetailKey, 'receiptFooter'>, string, string][] = [
  ['name', 'Shop name', 'organization'], ['address', 'Address', 'street-address'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['vatNumber', 'VAT number', 'off'],
];

// The shop's details, each saved when its box is left if it changed (Shop
// details and Till › Receipts share them).
function useShopDetails() {
  const queryClient = useQueryClient();
  const details = useQuery({ queryKey: ['shop-details'], queryFn: () => apiGet<ShopDetails>('/api/shop-details') });
  const [typed, setTyped] = useState<Partial<Record<DetailKey, string>>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const valueOf = (key: DetailKey) => typed[key] ?? details.data?.[key] ?? '';

  async function save(key: DetailKey) {
    const value = typed[key];
    if (value === undefined || value.trim() === (details.data?.[key] ?? '')) return;
    setNote(null);
    try {
      const saved = await apiMutate<ShopDetails>('/api/shop-details', { [key]: value }, { method: 'PUT' });
      // Only the box that was saved, so replies arriving out of order can't
      // put back an older value in another box (fresh review).
      queryClient.setQueryData<ShopDetails>(['shop-details'], (old) => (old ? { ...old, [key]: saved[key] } : saved));
      // Anything typed since this save went keeps its place (fresh review).
      setTyped((t) => { if (t[key] !== value) return t; const next = { ...t }; delete next[key]; return next; });
      setNote({ ok: true, text: 'Saved.' });
      // A new name shows across the app (the session carries it).
      if (key === 'name') void queryClient.invalidateQueries({ queryKey: ['session'] });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    }
  }

  return { details, valueOf, setTyped, save, note };
}

/**
 * Settings › Shop and sites › Shop details (Jack, 18 Oct, docs/decisions/2026-10-18-shop-details.md;
 * drawn as set-shop-details): one set for the whole business, for now. Each
 * box saves when it's left, if it changed, as the settings pages save as you go.
 */
function ShopDetailsBox() {
  const { details, valueOf, setTyped, save, note } = useShopDetails();
  return (
    <div className="flex flex-col">
      {details.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the shop’s details. Try again in a moment.</p> : null}
      {DETAIL_ROWS.map(([key, label, autoComplete]) => (
        <div key={key} className="flex min-h-[52px] flex-col gap-1.5 border-t border-[var(--wh-border)] py-2 md:flex-row md:items-center md:gap-3 md:py-0">
          <label htmlFor={`shop-${key}`} className="shrink-0 text-size-15 font-semibold md:w-40">{label}</label>
          <input
            id={`shop-${key}`}
            value={valueOf(key)}
            autoComplete={autoComplete}
            disabled={!details.data}
            onChange={(e) => setTyped((t) => ({ ...t, [key]: e.target.value }))}
            onBlur={() => void save(key)}
            className="min-h-11 grow rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-size-15"
          />
        </div>
      ))}
      <p className="m-0 mt-2 text-sm text-[var(--wh-muted)]">These show on receipts, emails and the website.</p>
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 mt-1 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}

/**
 * Settings › Till › Receipts, first piece (Jack, 19 Oct, docs/decisions/2026-10-19-receipt-words.md;
 * drawn as set-till-receipts): the words printed at the bottom of every
 * receipt. The Paid box's Print, Email and Text choices come later.
 */
function ReceiptsBox() {
  const { details, valueOf, setTyped, save, note } = useShopDetails();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="receipt-footer" className="text-sm font-semibold">Words at the bottom</label>
      <textarea
        id="receipt-footer"
        rows={3}
        placeholder="e.g. your returns policy, a thank-you"
        maxLength={500}
        value={valueOf('receiptFooter')}
        disabled={!details.data}
        onChange={(e) => setTyped((t) => ({ ...t, receiptFooter: e.target.value }))}
        onBlur={() => void save('receiptFooter')}
        className="resize-none rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] p-2.5 text-sm"
      />
      <p className="m-0 text-sm text-[var(--wh-muted)]">The shop’s name and address come from Shop and sites. Every receipt carries a barcode so a refund can find the sale.</p>
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}

// Monday first, as the drawing; 0 is Sunday on the server.
const WEEKDAYS: [number, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
// Whole hours only, as the server and the diary need.
const HOURS = Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, '0')}:00`);

/**
 * Settings › Shop and sites › Opening hours (Jack, 19 Oct, docs/decisions/2026-10-19-opening-hours.md;
 * drawn as set-shop-hours): each day Open or Closed, an open day's hours on
 * the hour. Each change saves the whole week at once; a refusal puts it back.
 */
function HoursBox() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [draft, setDraft] = useState<DayHours[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // While one save is on its way, the latest choice waits and goes next, so
  // the pickers stay usable from the keyboard (fresh review).
  const busy = useRef(false);
  const pending = useRef<DayHours[] | null>(null);
  const week = draft ?? settings.data?.openingHours ?? [];
  // A day turned Open starts at the shop's usual hours.
  const usual = { open: settings.data?.openingTime ?? '09:00', close: settings.data?.closingTime ?? '17:00' };

  async function saveWeek(next: DayHours[]) {
    const sorted = [...next].sort((a, b) => a.weekday - b.weekday);
    setDraft(sorted);
    setError(null);
    if (busy.current) { pending.current = sorted; return; }
    busy.current = true;
    setSaving(true);
    let sending: DayHours[] | null = sorted;
    try {
      while (sending) {
        const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', { openingHours: sending }, { method: 'PUT' });
        queryClient.setQueryData(['workshop-settings'], saved);
        sending = pending.current;
        pending.current = null;
      }
    } catch (err) {
      pending.current = null;
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      busy.current = false;
      setSaving(false);
      setDraft(null);
    }
  }
  const toggle = (weekday: number) => {
    const open = week.some((d) => d.weekday === weekday);
    void saveWeek(open ? week.filter((d) => d.weekday !== weekday) : [...week, { weekday, ...usual }]);
  };
  const setTime = (weekday: number, which: 'open' | 'close', value: string) =>
    void saveWeek(week.map((d) => (d.weekday === weekday ? { ...d, [which]: value } : d)));
  const select = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2 font-[family-name:var(--wh-font-mono)] text-size-15';
  // A time saved elsewhere outside the list still shows as it is (fresh review).
  const options = (value: string) => (HOURS.includes(value) ? HOURS : [value, ...HOURS].sort());

  return (
    <div className="flex flex-col">
      {settings.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the opening hours. Try again in a moment.</p> : null}
      {WEEKDAYS.map(([weekday, name]) => {
        const day = week.find((d) => d.weekday === weekday);
        // As drawn: on a phone the day and Open/Closed share a line, the times
        // under them; wider, one line with Open/Closed at the end.
        return (
          <div key={weekday} className="flex flex-col gap-2 border-t border-[var(--wh-border)] py-2 md:min-h-[50px] md:flex-row md:items-center md:gap-3 md:py-1">
            <div className="flex items-center justify-between gap-3 md:contents">
              <span className="text-size-15 font-semibold md:order-1 md:w-24">{name}</span>
              <button
                type="button"
                aria-pressed={Boolean(day)}
                aria-label={`${name} open`}
                disabled={!settings.data || saving}
                onClick={() => toggle(weekday)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold md:order-4 ${day ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] text-[var(--wh-muted)]'}`}
              >
                {day ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg> : null}
                {day ? 'Open' : 'Closed'}
              </button>
            </div>
            {day ? (
              <span className="flex items-center gap-2 md:order-2">
                <select aria-label={`${name} opens`} value={day.open} disabled={!settings.data} onChange={(e) => setTime(weekday, 'open', e.target.value)} className={select}>
                  {options(day.open).map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-[var(--wh-muted)]">to</span>
                <select aria-label={`${name} closes`} value={day.close} disabled={!settings.data} onChange={(e) => setTime(weekday, 'close', e.target.value)} className={select}>
                  {options(day.close).map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </span>
            ) : null}
            <span className="hidden grow md:order-3 md:block" />
          </div>
        );
      })}
      <p className="m-0 mt-2 text-sm text-[var(--wh-muted)]">Online booking only offers mechanics on the days they’re in, set on each person.</p>
      {error ? <p role="alert" className="m-0 mt-1 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
    </div>
  );
}

/**
 * Settings for the Owner only, until roles are built (Jack, 19 Oct,
 * docs/decisions/2026-10-19-owner-only-settings.md): anyone else sees the
 * drawn auth-noaccess card, its words fitted to Settings and to there being
 * no Managers yet. The server refuses their changes too.
 */
function NoAccess() {
  return (
    <div className="mx-auto w-full max-w-[520px] p-5">
      <div className="flex flex-col gap-3.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-7">
        <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        </span>
        <h2 className="m-0 text-size-22 font-bold">Settings aren’t part of your role</h2>
        <p className="m-0 text-size-15">Only the shop’s owner can change settings for now. Ask the owner if you need something changed.</p>
        <div><Link to={ROUTES.till} className="inline-flex min-h-11 items-center rounded-md border border-[var(--wh-input-border)] px-4 font-semibold">Go to the till</Link></div>
      </div>
    </div>
  );
}

type NumberField = 'fullDayThresholdMinutes' | 'timedLeadMinutes' | 'depositPercent' | 'depositFixedPence' | 'depositUnknownPence' | 'depositCancelHours';

/**
 * One number setting saved to the workshop settings when its box is left, if
 * it changed: shown in the box's own unit, refused in the screen when it
 * isn't allowed, a server refusal shown in its words.
 */
function NumberSetting({ id, label, hint, unit, prefix, field, toBox, fromBox, invalid, emptyIsNone = false, disabled = false }: {
  id: string; label: string; hint: string; unit: string; prefix?: string; field: NumberField;
  toBox: (stored: number) => string; fromBox: (typed: number) => number | null; invalid: string;
  // An empty box saves "none" (null), as "If the price isn't known" (deposit-settings design 5).
  emptyIsNone?: boolean;
  // Held while a setting it depends on is saving, as the switches beside it are.
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const stored = settings.data?.[field];
  const shown = typed ?? (stored === undefined || stored === null ? '' : toBox(stored));

  async function save() {
    if (typed === null) return;
    const number = Number(typed.trim());
    const none = emptyIsNone && typed.trim() === '';
    const value = none ? null : typed.trim() === '' || !Number.isFinite(number) ? null : fromBox(number);
    if (value === null && !none) { setNote({ ok: false, text: invalid }); return; }
    if (value === (stored ?? null)) { setTyped(null); setNote(null); return; }
    setNote(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', { [field]: value }, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
      setTyped((t) => (t === typed ? null : t));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <label htmlFor={id} className="text-size-15 font-semibold">{label}</label>
          {hint ? <span id={`${id}-h`} className="text-size-13 text-[var(--wh-muted)]">{hint}</span> : null}
        </span>
        <span className="inline-flex items-center gap-2 text-sm">
          {prefix}
          <input
            id={id}
            aria-describedby={hint ? `${id}-h` : undefined}
            inputMode="decimal"
            value={shown}
            disabled={!settings.data || disabled}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => void save()}
            className="min-h-11 w-[72px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-center font-[family-name:var(--wh-font-mono)] text-size-15"
          />
          {unit}
        </span>
      </div>
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}

/**
 * Notice in hours or whole days (Jack, 19 Oct, docs/decisions/2026-10-19-retire-old-workshop-settings.md
 * answers 4 and 8; drawn as bk-settings-notice-days): days count from the
 * start of the day, so 1 day lets a customer book any time tomorrow. The box
 * saves when left; choosing the other unit saves the box's number in it.
 */
function NoticeSetting() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const data = settings.data;
  const unit: 'hours' | 'days' = data?.minNoticeDays ? 'days' : 'hours';
  const stored = !data ? '' : unit === 'days' ? String(data.minNoticeDays) : String((data.minNoticeMinutes ?? 0) / 60);
  const shown = typed ?? stored;

  // The body to save, or the words for why not.
  function bodyFor(text: string, to: 'hours' | 'days'): { body: object } | { error: string } {
    const n = Number(text.trim());
    if (to === 'hours') {
      return text.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 168 ? { body: { minNoticeMinutes: n * 60, minNoticeDays: null } } : { error: 'Enter 0 to 168 hours' };
    }
    return text.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 28 ? { body: { minNoticeDays: n } } : { error: 'Enter 1 to 28 days' };
  }
  async function save(to: 'hours' | 'days') {
    // A part-hour saved before (say 1.5) switches to days rounded up (fresh review).
    const text = typed ?? (to === 'days' && unit === 'hours' ? String(Math.max(1, Math.ceil(Number(stored)))) : stored);
    if (to === unit && (typed === null || text === stored)) { setTyped(null); return; }
    const next = bodyFor(text, to);
    if ('error' in next) { setNote({ ok: false, text: next.error }); return; }
    setNote(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', next.body, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
      setTyped((t) => (t === typed ? null : t));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    }
  }
  const pill = (to: 'hours' | 'days') => (
    <button
      type="button"
      role="radio"
      aria-checked={unit === to}
      disabled={!data}
      // Keeps the cursor in the box, so picking a unit right after typing
      // sends one save, not one from leaving the box as well (fresh review).
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void save(to)}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${unit === to ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}
    >
      {to}
    </button>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <label htmlFor="notice" className="text-size-15 font-semibold">Notice</label>
          <span id="notice-h" className="text-size-13 text-[var(--wh-muted)]">How far ahead customers must book</span>
        </span>
        <div className="inline-flex items-center gap-2 text-sm">
          <input
            id="notice"
            aria-describedby="notice-h"
            inputMode="numeric"
            value={shown}
            disabled={!data}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => void save(unit)}
            className="min-h-11 w-[72px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-center font-[family-name:var(--wh-font-mono)] text-size-15"
          />
          <RadioPillGroup pickOnMove={false} aria-label="Notice in" className="inline-flex gap-2">{pill('hours')}{pill('days')}</RadioPillGroup>
        </div>
      </div>
      <p className="m-0 text-sm text-[var(--wh-muted)]">{unit === 'days'
        ? 'Days: a customer can book from that many days on, whatever the time now. 1 day lets them book any time tomorrow.'
        : 'Hours: counted from now. Days: counted in whole days, so 1 day lets a customer book any time tomorrow.'}</p>
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}

const HALF_HOURS = Array.from({ length: 35 }, (_, i) => `${String(5 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const MODE_WORDS: Record<string, string> = { timed: 'a set time', dropoff: 'the whole day' };

/**
 * How bikes are booked in (Jack, 19 Oct, docs/decisions/2026-10-19-retire-old-workshop-settings.md
 * answers 2, 9 and 10; drawn as bk-settings-mode-change, bk-settings-mode-scheduled,
 * bk-settings-whole-day). A change of mode takes effect from a day the shop
 * chooses, tomorrow at the earliest, and bookings keep their shape (Jack,
 * 24 Sep); the drop-off window shows while the whole day is the shop's mode.
 */
function ModeSetting() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const data = settings.data;
  const mode = data?.bookingMode;
  const [asking, setAsking] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function put(body: object, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', body, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
      after?.();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }
  // Changing the date of a coming change starts from the date already chosen (fresh review).
  const choose = (to: string) => { if (to !== mode) { setAsking(to); setFrom(data?.nextBookingMode === to ? data.nextBookingModeFrom ?? '' : ''); setError(null); } };
  // A refusal belongs to the pop-up: closing it clears it (fresh review).
  const close = () => { setAsking(null); setError(null); };
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  // As drawn (bk-settings-mode-scheduled): the window shows once the whole day is the shop's mode.
  const showWindow = mode === 'dropoff';
  const windowFrom = data?.dropoffWindowStart ?? '09:00';
  const windowTo = data?.dropoffWindowEnd ?? '10:00';
  const times = (v: string) => (HALF_HOURS.includes(v) ? HALF_HOURS : [...HALF_HOURS, v].sort());
  const pill = (to: string, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === to}
      disabled={!data}
      onClick={() => choose(to)}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${mode === to ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}
    >
      {label}
    </button>
  );
  const select = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2 font-[family-name:var(--wh-font-mono)] text-size-15';

  return (
    <div className="flex flex-col gap-2">
      <h4 className="m-0 border-t border-[var(--wh-border)] pt-3 text-size-15 font-bold">How bikes are booked in</h4>
      <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3">
        <span id="mode-label" className="text-size-15 font-semibold">Bikes are booked in for</span>
        <RadioPillGroup pickOnMove={false} aria-labelledby="mode-label" className="flex flex-wrap gap-2">{pill('timed', 'A set time')}{pill('dropoff', 'The whole day')}</RadioPillGroup>
      </div>
      {data?.nextBookingMode && data.nextBookingModeFrom ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--wh-surface-muted)] px-3 py-2.5 text-sm">
          <p role="status" data-mode-change="true" className="m-0">
            {`Changing to ${MODE_WORDS[data.nextBookingMode]} from ${shortDay(data.nextBookingModeFrom)}. Bookings already made keep their ${data.nextBookingMode === 'dropoff' ? 'set times' : 'days'}.`}
          </p>
          <Button disabled={busy} onClick={() => void put({ nextBookingMode: null, nextBookingModeFrom: null })}>Cancel the change</Button>
        </div>
      ) : null}
      <p className="m-0 text-sm text-[var(--wh-muted)]">A set time: the customer drops the bike off before the time they booked. The whole day: they drop it off in the drop-off window, for example 09:00 to 10:00.</p>
      {showWindow ? (
        <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-size-15 font-semibold">Drop-off window</span>
            <span className="text-size-13 text-[var(--wh-muted)]">Whole-day customers drop their bike off between these times</span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm">
            <select aria-label="Drop-off window starts" value={windowFrom} disabled={busy} onChange={(e) => void put({ dropoffWindowStart: e.target.value, dropoffWindowEnd: windowTo })} className={select}>
              {times(windowFrom).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            to
            <select aria-label="Drop-off window ends" value={windowTo} disabled={busy} onChange={(e) => void put({ dropoffWindowStart: windowFrom, dropoffWindowEnd: e.target.value })} className={select}>
              {times(windowTo).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </span>
        </div>
      ) : null}
      {error && !asking ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      <Dialog open={asking !== null} onOpenChange={(o) => { if (!o) close(); }} aria-labelledby="mode-title" className="md:max-w-[480px]">
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle id="mode-title">{`Book bikes in for ${asking ? MODE_WORDS[asking] : ''}?`}</DialogTitle>
            <span className="text-size-13 text-[var(--wh-muted)]">From a day you choose</span>
          </div>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mode-from" className="text-size-15 font-semibold">Starting on</label>
            <input id="mode-from" type="date" min={tomorrow} value={from} onChange={(e) => setFrom(e.target.value)} aria-describedby="mode-from-h" className="min-h-11 max-w-[220px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-size-15" />
            <span id="mode-from-h" className="text-size-13 text-[var(--wh-muted)]">Tomorrow at the earliest</span>
          </div>
          <p className="m-0 text-sm text-[var(--wh-muted)]">{asking === 'dropoff'
            ? 'Bookings already made keep their set times. From that day, customers book a day and drop their bike off in the drop-off window.'
            : 'Bookings already made keep their days. From that day, customers book a time and drop their bike off before it.'}</p>
          {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
        </DialogBody>
        <DialogFooter className="flex justify-between gap-2.5">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!from || busy} onClick={() => void put({ nextBookingMode: asking, nextBookingModeFrom: from }, close)}>
            {from ? `Change from ${shortDay(from)}` : 'Change from…'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

/**
 * "Show prices on the booking page" (Jack, 19 Oct, docs/decisions/2026-10-19-retire-old-workshop-settings.md
 * answer 11; drawn in bk-settings): the settings pages' own switch, saved at once.
 */
function PricesSetting() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', { showPricesOnline: next }, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <RowSwitch label="Show prices on the booking page" on={settings.data?.showPricesOnline === true} disabled={saving || !settings.data} onChange={(next) => void change(next)} />
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
    </div>
  );
}

/**
 * "Confirm bookings automatically" (Jack, 19 Oct, docs/decisions/2026-10-19-auto-confirm.md;
 * drawn as bk-settings-auto): after Show prices, with the drawn note, saved at once.
 */
function ConfirmSetting() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', { confirmBookingsAutomatically: next }, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <RowSwitch label="Confirm bookings automatically" on={settings.data?.confirmBookingsAutomatically === true} disabled={saving || !settings.data} onChange={(next) => void change(next)} />
      <p className="m-0 text-sm text-[var(--wh-muted)]">Off: each booking is a request, purple in the diary until someone accepts it. On: a booking that fits the diary is confirmed straight away. Changing a confirmed booking is always a request.</p>
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
    </div>
  );
}

// Pounds typed, whole pence saved: 1p to £10,000 (deposit-settings design 1).
const penceFromPounds = (pounds: number) => { const p = Math.round(pounds * 100); return Math.abs(p - pounds * 100) < 1e-6 && p >= 1 && p <= 1_000_000 ? p : null; };
const poundsBox = (pence: number) => (pence / 100).toFixed(2);
const AMOUNT_INVALID = 'Enter an amount from £0.01 to £10,000';

/** The deposit as the Online booking fold's summary says it (settings-frame.mjs line 192). */
function depositWords(s: WorkshopSettings): string {
  if (s.depositOn && s.depositKind === 'percent' && s.depositPercent) return `deposit ${s.depositPercent}%`;
  if (s.depositOn && s.depositKind === 'fixed' && s.depositFixedPence) return `deposit £${poundsBox(s.depositFixedPence)}`;
  return 'no deposit';
}

/**
 * Deposits (Jack, 24 Oct, docs/decisions/2026-10-24-morning-questions.md;
 * drawn as bk-settings-deposits; openspec/changes/deposit-settings design 5):
 * the switch, and while it's on the drawn rows, each saved as soon as changed.
 * "For: Every booking / Chosen services" waits for the service editor (design 6).
 */
function DepositSetting() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const data = settings.data;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function put(body: object) {
    setSaving(true);
    setError(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', body, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }
  const kind = data?.depositKind ?? 'percent';
  const pill = (to: 'percent' | 'fixed', label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={kind === to}
      disabled={!data || saving}
      onClick={() => { if (to !== kind) void put({ depositKind: to }); }}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${kind === to ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      <h4 className="m-0 mt-2 border-t border-[var(--wh-border)] pt-3 text-size-15 font-bold">Deposits</h4>
      <RowSwitch label="Take a deposit when booking" on={data?.depositOn === true} disabled={saving || !data} onChange={(next) => void put({ depositOn: next })} />
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      {data?.depositOn ? (
        <>
          <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3">
            <span id="deposit-kind-label" className="text-size-15 font-semibold">Deposit</span>
            <RadioPillGroup pickOnMove={false} aria-labelledby="deposit-kind-label" className="flex flex-wrap gap-2">{pill('fixed', 'A fixed amount')}{pill('percent', 'A percentage of the price')}</RadioPillGroup>
          </div>
          {kind === 'percent' ? (
            <NumberSetting
              key="percent" id="dep-pc" label="How much" hint="" unit="%" field="depositPercent" toBox={(n) => String(n)} disabled={saving}
              fromBox={(n) => (Number.isInteger(n) && n >= 1 && n <= 100 ? n : null)} invalid="Enter a whole percentage from 1 to 100"
            />
          ) : (
            <NumberSetting
              key="fixed" id="dep-fixed" label="How much" hint="" unit="" prefix="£" field="depositFixedPence" toBox={poundsBox} disabled={saving}
              fromBox={penceFromPounds} invalid={AMOUNT_INVALID}
            />
          )}
          <NumberSetting
            id="dep-unknown" label="If the price isn’t known" hint="For “Not sure what’s wrong?” bookings" unit="" prefix="£" field="depositUnknownPence"
            toBox={poundsBox} fromBox={penceFromPounds} invalid={AMOUNT_INVALID} emptyIsNone
          />
          <NumberSetting
            id="cutoff" label="Free to cancel until" hint="Before the booked time · after that, or if they don’t come, the shop keeps the deposit" unit="hours before"
            field="depositCancelHours" toBox={(n) => String(n)} fromBox={(n) => (Number.isInteger(n) && n >= 0 && n <= 168 ? n : null)} invalid="Enter 0 to 168 whole hours"
          />
          {data.confirmBookingsAutomatically ? null : (
            <p className="m-0 text-sm text-[var(--wh-muted)]">With automatic confirming off, the customer pays before the shop has said yes; if the shop declines, the deposit is refunded automatically.</p>
          )}
        </>
      ) : null}
    </div>
  );
}

/**
 * A shop's own booking terms (Jack, 8 Oct, docs/decisions/2026-10-08-not-drawn-pages.md
 * row 95: a form box on bk-settings; 20 Oct). "Use your own" starts from
 * Wheelhouse's standard terms; the box saves when left, if the words differ
 * from what customers get now; "Go back to Wheelhouse's standard terms"
 * saves null. The server keeps a copy with each booking (piece 11).
 */
function TermsSetting() {
  const queryClient = useQueryClient();
  const session = useSession();
  const slug = session.status === 'signed-in' ? session.shop.slug : '';
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const own = settings.data?.bookingTerms ?? null;
  const open = own !== null || editing;
  // The standard words, to start from (the customers' own terms address).
  const standard = useQuery({
    queryKey: ['portal', slug, 'terms'],
    queryFn: () => apiGet<{ text: string; standard: boolean }>(`/api/portal/${encodeURIComponent(slug)}/terms`),
    enabled: editing && own === null && slug !== '',
  });
  const current = own ?? (standard.data?.standard ? standard.data.text : '');
  // Once the box opens from "Use your own" and has its words, the cursor goes
  // into it, as the button it replaced has gone (fresh review).
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const ready = !!settings.data && (own !== null || !!standard.data);
  useEffect(() => {
    if (editing && ready) boxRef.current?.focus();
  }, [editing, ready]);
  const shown = typed ?? current;

  async function put(value: string | null) {
    setNote(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', { bookingTerms: value }, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
      setTyped((t) => (value === null || t === value ? null : t));
      if (value === null) setEditing(false);
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    }
  }

  function leave(e: FocusEvent<HTMLTextAreaElement>) {
    // Going straight to "Go back" mustn't save the words first (fresh review).
    if ((e.relatedTarget as HTMLElement | null)?.id === 'terms-go-back') return;
    if (typed === null || typed.trim() === current.trim()) return;
    void put(typed);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-size-15 font-semibold">Booking terms</span>
          <span className="text-size-13 text-[var(--wh-muted)]">{own !== null ? 'Your own terms · a copy is kept with each booking' : 'Wheelhouse’s standard terms · a copy is kept with each booking'}</span>
        </span>
        {!open && <Button disabled={!settings.data} onClick={() => { setNote(null); setEditing(true); }}>Use your own</Button>}
      </div>
      {open && (
        <>
          <label htmlFor="booking-terms" className="text-size-15 font-semibold">Your booking terms</label>
          <textarea
            id="booking-terms"
            ref={boxRef}
            aria-describedby="booking-terms-h"
            rows={8}
            maxLength={20000}
            value={shown}
            disabled={!ready}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={(e) => leave(e)}
            className="resize-y rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] p-2.5 text-sm leading-normal"
          />
          <span id="booking-terms-h" className="text-size-13 text-[var(--wh-muted)]">Customers agree to these when they book. A copy is kept with each booking.</span>
          {own !== null && (
            <div><Button id="terms-go-back" variant="ghost" onClick={() => { setTyped(null); void put(null); }}>Go back to Wheelhouse’s standard terms</Button></div>
          )}
        </>
      )}
      {editing && own === null && standard.isError && (
        <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Wheelhouse couldn’t load the standard terms to start from. Try again in a moment.</p>
      )}
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}

/**
 * Preview what the customer sees (Jack, 19 Oct, docs/decisions/2026-10-19-booking-preview.md;
 * drawn as bk-settings-preview): the confirmed page for the drawings' example
 * booking, with the shop's saved drop-off time, note and prices.
 */
function BookingPreview() {
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [open, setOpen] = useState(false);
  const p = previewLines(settings.data ?? {});
  const row = (k: string, v: string) => (
    <p className="m-0 flex justify-between gap-3 border-t border-[var(--wh-border)] py-2 text-size-15">
      <span className="text-[var(--wh-muted)]">{k}</span>{' '}<strong className="text-right">{v}</strong>
    </p>
  );
  return (
    <div>
      <Button variant="default" disabled={!settings.data} onClick={() => setOpen(true)}>Preview</Button>
      <Dialog open={open} onOpenChange={setOpen} aria-labelledby="preview-title" aria-describedby="preview-sub" className="md:max-w-[560px]">
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle id="preview-title">What the customer sees</DialogTitle>
            <span id="preview-sub" className="text-size-13 text-[var(--wh-muted)]">An example booking, with your settings as they are now</span>
          </div>
          <DialogClose onClick={() => setOpen(false)} />
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px]">
            <span className="self-start rounded-full bg-[var(--wh-status-complete-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--wh-status-complete-ink)]">Booking confirmed</span>
            <h3 className="m-0 text-xl font-bold">{p.heading}</h3>
            {p.arrival ? <p className="m-0 text-size-15 leading-normal">{p.arrival}</p> : null}
            <div>{row('Service', p.service)}{row('Bike', p.bike)}{row('When', p.when)}</div>
          </div>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Customers see this once a booking is confirmed. Change a setting and preview again to see the difference.</p>
        </DialogBody>
        {/* Close on the left, as drawn. */}
        <DialogFooter className="flex justify-start gap-2.5">
          <Button variant="default" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

/**
 * The shop's additional note on the booking confirmation (Jack, 19 Oct,
 * docs/decisions/2026-10-19-confirmation-note.md; drawn in bk-settings): its
 * own words after the drop-off time, saved when the box is left if changed.
 */
function ConfirmationNoteSetting() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const stored = settings.data?.confirmationNote ?? '';

  async function save() {
    if (typed === null) return;
    if (typed.trim() === stored) { setTyped(null); return; }
    setNote(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', { confirmationNote: typed }, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
      setTyped((t) => (t === typed ? null : t));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    }
  }

  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      <label htmlFor="confirm-note" className="text-size-15 font-semibold">Additional note on the confirmation</label>
      <textarea
        id="confirm-note"
        aria-describedby="confirm-note-h"
        rows={2}
        maxLength={300}
        value={typed ?? stored}
        disabled={!settings.data}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={() => void save()}
        className="resize-y rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] p-2.5 text-size-15 leading-normal"
      />
      <span id="confirm-note-h" className="text-size-13 text-[var(--wh-muted)]">Shown after the drop-off time once a booking is confirmed. Leave it empty to show nothing.</span>
      <BookingPreview />
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}

/**
 * Settings › Workshop › Online booking, so far (Jack, 19 Oct,
 * docs/decisions/2026-10-19-retire-old-workshop-settings.md; drawn as
 * bk-settings-reserve): how long before a set-time booking bikes come in
 * (answers 3 and 7), shown while bikes are booked in for a set time, and the
 * time kept free each day (answers 1 and 6); then the confirmation note,
 * notice, prices, confirming, Deposits (deposit-settings) and Terms.
 */
function OnlineBookingBox() {
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  return (
    <div className="flex flex-col gap-2">
      <ModeSetting />
      {settings.data?.bookingMode === 'timed' ? (
        <NumberSetting
          id="lead" label="Drop off before the booking" hint="How long before their booked time customers bring the bike in" unit="minutes"
          field="timedLeadMinutes" toBox={(m) => String(m)}
          fromBox={(n) => (Number.isInteger(n) && n >= 0 && n <= 240 ? n : null)} invalid="Enter 0 to 240 minutes"
        />
      ) : null}
      <ConfirmationNoteSetting />
      <NoticeSetting />
      <NumberSetting
        id="reserve" label="Time kept free each day" hint="For the little jobs between bikes" unit="hours"
        field="fullDayThresholdMinutes" toBox={(m) => String(m / 60)}
        fromBox={(h) => (h >= 0 && h <= 8 && Number.isInteger(h * 2) ? h * 60 : null)} invalid="Enter 0 to 8 hours, in half hours"
      />
      <p className="m-0 text-sm text-[var(--wh-muted)]">Lunch and admin go in the diary as blocks, so don’t count them here. Online booking treats a day as full once less than this is left.</p>
      <PricesSetting />
      <ConfirmSetting />
      <DepositSetting />
      <h4 className="m-0 mt-2 border-t border-[var(--wh-border)] pt-3 text-size-15 font-bold">Terms</h4>
      <TermsSetting />
    </div>
  );
}

export function SettingsPage() {
  const session = useSession();
  if (session.status !== 'signed-in') return null;
  if (!session.user.isOwner) return <NoAccess />;
  return <OwnerSettings />;
}

// Workshop › Mechanics, so far: who signed off, shown to customers or not
// (mechanic sign-off piece 3; drawn as set-workshop-sign-off).
function MechanicsBody() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = settings.data?.showSignOffToCustomers === true;

  async function change(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', { showSignOffToCustomers: next }, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
    } catch {
      setError('Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {settings.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the settings. Try again in a moment.</p> : null}
      <RowSwitch label="Show who signed off to customers" on={on} disabled={saving || !settings.data} onChange={(next) => void change(next)} />
      <p className="m-0 text-sm text-[var(--wh-muted)]">Adds “Checked by [name]” to their receipt and booking link, and the mechanic’s name to quotes. Off: only staff see who signed a job off, and quotes say “we”.</p>
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
    </div>
  );
}

// The folds' one-line summaries describe only what's set up (setup audit H3, M2).
const DAY_NAMES: Record<number, string> = { 0: 'Sundays', 1: 'Mondays', 2: 'Tuesdays', 3: 'Wednesdays', 4: 'Thursdays', 5: 'Fridays', 6: 'Saturdays' };
function closedDays(hours: DayHours[] | undefined): string {
  if (!hours) return '';
  const closed = [1, 2, 3, 4, 5, 6, 0].filter((d) => !hours.some((h) => h.weekday === d)).map((d) => DAY_NAMES[d]);
  if (!closed.length) return 'Open every day';
  if (closed.length === 7) return 'Closed every day';
  return `Closed ${closed.length === 1 ? closed[0] : `${closed.slice(0, -1).join(', ')} and ${closed[closed.length - 1]}`}`;
}
function noticeWords(s: WorkshopSettings): string {
  if (s.minNoticeDays) return s.minNoticeDays === 1 ? '1 day’s notice' : `${s.minNoticeDays} days’ notice`;
  const minutes = s.minNoticeMinutes ?? 0;
  if (!minutes) return 'No notice';
  if (minutes % 60) return `${minutes} minutes’ notice`;
  return minutes === 60 ? '1 hour’s notice' : `${minutes / 60} hours’ notice`;
}

function OwnerSettings() {
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const details = useQuery({ queryKey: ['shop-details'], queryFn: () => apiGet<ShopDetails>('/api/shop-details') });
  const messages = useMessagesSummary();
  const checklists = useChecklistsSummary();
  const diaryBlocks = useDiaryBlocksSummary();
  const storageSlots = useStorageSlotsSummary();
  const customerGroups = useCustomerGroupsSummary();
  const collection = useCollectionSummary();
  const float = useFloatSummary();
  const tills = useTillsSummary();
  const signingIn = useSigningInSummary();
  const s = settings.data;
  // Only what's built (stage 1 drawing gaps decision 6), in the drawn rooms'
  // order and words (settings-frame.mjs SETTINGS_ROOMS); Stockroom has nothing yet.
  const rooms: SettingsRoom[] = [
    {
      key: 'front-desk', name: 'Front desk', intro: 'The till, payments, messages to customers and closing the day.',
      areas: [
        { key: 'till', title: 'Till', intro: 'What staff see and use at the till.', folds: [
          { key: 'receipts', title: 'Receipts', summary: details.data ? (details.data.receiptFooter ? 'Words at the bottom' : 'Nothing at the bottom yet') : '', body: <ReceiptsBox /> },
          // Last in Till, as drawn (setup.mjs tillFolds; till-setup).
          { key: 'tills', title: 'Tills', summary: tills, body: <TillsSettings /> },
          // Beside Tills, its own fold (stage-1 gaps 9; trust-pin-workshop).
          { key: 'signing-in', title: 'Signing in', summary: signingIn, body: <SigningInSettings /> },
        ] },
        // After Till, as drawn (settings-frame.mjs); only Customer groups works yet (cs-groups).
        { key: 'payments', title: 'Payments', intro: 'How customers can pay.', folds: [
          { key: 'customer-groups', title: 'Customer groups', summary: customerGroups, body: <CustomerGroupsSettings /> },
        ] },
        { key: 'messages', title: 'Messages', intro: 'The texts and emails customers get from the shop.', folds: [
          { key: 'automatic-messages', title: 'Automatic messages', summary: messages, body: <AutomaticMessages /> },
        ] },
        // After Messages, as drawn (settings-frame.mjs SETTINGS_ROOMS); only Float works yet (set-eod).
        { key: 'end-of-day', title: 'End of day', intro: 'How the till closes each day.', folds: [
          { key: 'float', title: 'Float', summary: float, body: <FloatSettings /> },
        ] },
      ],
    },
    {
      key: 'workshop', name: 'Workshop', intro: '',
      areas: [
        { key: 'workshop', title: 'Workshop', intro: 'Services, who works in the workshop, and how the diary looks.', folds: [
          // First, as drawn (set-workshop-services; services-room).
          { key: 'services', title: 'Services', summary: SERVICES_SUMMARY, body: <ServicesSettings /> },
          // Under Services in the drawing (set-workshop-checklists).
          { key: 'checklists', title: 'Checklists', summary: checklists, body: <ChecklistsSettings /> },
          { key: 'online-booking', title: 'Online booking', summary: s ? `${s.bookingMode === 'dropoff' ? 'The whole day' : 'Set times'} · ${noticeWords(s)} · ${depositWords(s)} · ${s.confirmBookingsAutomatically ? 'confirmed straight away' : 'each booking a request'}` : '', body: <OnlineBookingBox /> },
          { key: 'mechanics', title: 'Mechanics', summary: s ? `Who signed off: ${s.showSignOffToCustomers ? 'shown to customers' : 'staff only'}` : '', body: <MechanicsBody /> },
          { key: 'diary-blocks', title: 'Diary blocks', summary: diaryBlocks, body: <DiaryBlocksSettings /> },
          { key: 'storage-slots', title: 'Storage slots', summary: storageSlots, body: <StorageSlotsSettings /> },
          { key: 'collection', title: 'Collection', summary: collection, body: <CollectionSettings /> },
        ] },
      ],
    },
    {
      key: 'office', name: 'Office', intro: 'The shop and its sites, the people who work here, and your data.',
      areas: [
        { key: 'shop', title: 'Shop and sites', intro: 'The shop’s details, its sites and their opening hours.', folds: [
          { key: 'shop-details', title: 'Shop details', summary: details.data?.name ?? '', body: <ShopDetailsBox /> },
          { key: 'opening-hours', title: 'Opening hours', summary: closedDays(s?.openingHours), body: <HoursBox /> },
        ] },
      ],
    },
  ];
  return <SettingsFrame rooms={rooms} />;
}
