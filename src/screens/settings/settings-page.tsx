import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { ROUTES } from '@/staff/routes.ts';

/**
 * Settings, first piece (Jack, 18 Oct, docs/decisions/2026-10-16-mechanic-sign-off.md
 * "Piece 3"; drawn as set-workshop-sign-off in docs/design/user-journeys/generator/setup.mjs):
 * Workshop › Mechanics holds "Show who signed off to customers", off to
 * start, saved as soon as it's switched. The rest of Settings comes with
 * WP-5.1.
 */
type DayHours = { weekday: number; open: string; close: string };
type WorkshopSettings = { showSignOffToCustomers?: boolean; openingHours?: DayHours[]; openingTime?: string; closingTime?: string };
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
    <section aria-labelledby="set-shop-details" className="flex flex-col rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
      <h3 id="set-shop-details" className="m-0 mb-2 text-base font-bold">Shop details</h3>
      {details.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the shop’s details. Try again in a moment.</p> : null}
      {DETAIL_ROWS.map(([key, label, autoComplete]) => (
        <div key={key} className="flex min-h-[52px] flex-col gap-1.5 border-t border-[var(--wh-border)] py-2 md:flex-row md:items-center md:gap-3 md:py-0">
          <label htmlFor={`shop-${key}`} className="shrink-0 text-[15px] font-semibold md:w-40">{label}</label>
          <input
            id={`shop-${key}`}
            value={valueOf(key)}
            autoComplete={autoComplete}
            disabled={!details.data}
            onChange={(e) => setTyped((t) => ({ ...t, [key]: e.target.value }))}
            onBlur={() => void save(key)}
            className="min-h-11 grow rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-[15px]"
          />
        </div>
      ))}
      <p className="m-0 mt-2 text-sm text-[var(--wh-muted)]">These show on receipts, emails and the website.</p>
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 mt-1 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </section>
  );
}

// The settings pages' own switch (settings-frame.mjs rowSwitch): the label,
// On or Off in words, and the track; the whole row is the control.
function RowSwitch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-[15px] font-bold">{label}</span>
      <span className="inline-flex items-center gap-2.5">
        <span className={`text-sm font-semibold ${on ? '' : 'text-[var(--wh-muted)]'}`}>{on ? 'On' : 'Off'}</span>
        <span aria-hidden="true" className={`relative inline-block h-[26px] w-11 rounded-full ${on ? 'bg-[var(--wh-brand)]' : 'bg-[var(--wh-input-border)]'}`}>
          <span className={`absolute top-[3px] size-5 rounded-full bg-[var(--wh-panel)] shadow ${on ? 'left-[21px]' : 'left-[3px]'}`} />
        </span>
      </span>
    </button>
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
    <section aria-labelledby="set-receipts" className="flex flex-col gap-1.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
      <h3 id="set-receipts" className="m-0 mb-1 text-base font-bold">Receipts</h3>
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
    </section>
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
  const select = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2 font-[family-name:var(--wh-font-mono)] text-[15px]';
  // A time saved elsewhere outside the list still shows as it is (fresh review).
  const options = (value: string) => (HOURS.includes(value) ? HOURS : [value, ...HOURS].sort());

  return (
    <section aria-labelledby="set-hours" className="flex flex-col rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
      <h3 id="set-hours" className="m-0 mb-2 text-base font-bold">Opening hours</h3>
      {settings.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the opening hours. Try again in a moment.</p> : null}
      {WEEKDAYS.map(([weekday, name]) => {
        const day = week.find((d) => d.weekday === weekday);
        // As drawn: on a phone the day and Open/Closed share a line, the times
        // under them; wider, one line with Open/Closed at the end.
        return (
          <div key={weekday} className="flex flex-col gap-2 border-t border-[var(--wh-border)] py-2 md:min-h-[50px] md:flex-row md:items-center md:gap-3 md:py-1">
            <div className="flex items-center justify-between gap-3 md:contents">
              <span className="text-[15px] font-semibold md:order-1 md:w-24">{name}</span>
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
    </section>
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
        <h2 className="m-0 text-[22px] font-bold">Settings aren’t part of your role</h2>
        <p className="m-0 text-[15px]">Only the shop’s owner can change settings for now. Ask the owner if you need something changed.</p>
        <div><Link to={ROUTES.till} className="inline-flex min-h-11 items-center rounded-md border border-[var(--wh-input-border)] px-4 font-semibold">Go to the till</Link></div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const session = useSession();
  if (session.status !== 'signed-in') return null;
  if (!session.user.isOwner) return <NoAccess />;
  return <OwnerSettings />;
}

function OwnerSettings() {
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
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 p-5">
      {/* The staff frame's header already says "Settings". */}
      <section aria-labelledby="set-shop" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="set-shop" className="m-0 text-xl font-bold">Shop and sites</h2>
          <p className="m-0 text-sm text-[var(--wh-muted)]">The shop’s details, its sites and their opening hours.</p>
        </div>
        <ShopDetailsBox />
        <HoursBox />
      </section>
      <section aria-labelledby="set-till" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="set-till" className="m-0 text-xl font-bold">Till</h2>
          <p className="m-0 text-sm text-[var(--wh-muted)]">What staff see and use at the till.</p>
        </div>
        <ReceiptsBox />
      </section>
      <section aria-labelledby="set-workshop" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="set-workshop" className="m-0 text-xl font-bold">Workshop</h2>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Services, who works in the workshop, and how the diary looks.</p>
        </div>
        <section aria-labelledby="set-mechanics" className="flex flex-col gap-2 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
          <h3 id="set-mechanics" className="m-0 text-base font-bold">Mechanics</h3>
          {settings.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the settings. Try again in a moment.</p> : null}
          <RowSwitch label="Show who signed off to customers" on={on} disabled={saving || !settings.data} onChange={(next) => void change(next)} />
          <p className="m-0 text-sm text-[var(--wh-muted)]">Adds “Checked by [name]” to their receipt and booking link. Off: only staff see who signed a job off.</p>
          {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
        </section>
      </section>
    </div>
  );
}
