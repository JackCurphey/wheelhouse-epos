import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';

/**
 * Settings, first piece (Jack, 18 Oct, docs/decisions/2026-10-16-mechanic-sign-off.md
 * "Piece 3"; drawn as set-workshop-sign-off in docs/design/user-journeys/generator/setup.mjs):
 * Workshop › Mechanics holds "Show who signed off to customers", off to
 * start, saved as soon as it's switched. The rest of Settings comes with
 * WP-5.1.
 */
type WorkshopSettings = { showSignOffToCustomers?: boolean };
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

export function SettingsPage() {
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
