import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { parseTotal, penceText } from '@/lib/cash-count.ts';
import { RowSwitch } from './row-switch.tsx';

/**
 * Settings › Front desk › Payments › Ways to pay (drawn as set-pay-ways in setup.mjs; journey 11
 * decisions 6 and 8; openspec/changes/finish-customers, design 8): the two rows this piece needs,
 * Store credit and Customer accounts, each switched on or off as you go; an "on" Customer accounts
 * shows its one setting, Most a customer can owe, saved in whole pence when the box is left, as the
 * Float box saves. Cash comes first, "Always on", with nothing to switch (owner-setup-till-payments-eod,
 * design 4); card, gift cards and deposits come with their own pieces (Jack's answer 3, 11 Nov).
 */
export type PaymentSettings = { storeCreditOn: boolean; accountsOn: boolean; accountLimitPence: number | null };
export const PAYMENT_SETTINGS_KEY = ['payment-settings'];
export const usePaymentSettings = () => useQuery({ queryKey: PAYMENT_SETTINGS_KEY, queryFn: () => apiGet<PaymentSettings>('/api/payment-settings') });
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');

/**
 * The fold's summary: the built ways that are on, Cash first as it's always on, in the drawing's
 * words (settings-frame.mjs payFolds, "Cash, card and 4 more"): "Cash", "Cash and store credit",
 * "Cash, store credit and customer accounts".
 */
export function useWaysToPaySummary(): string {
  const settings = usePaymentSettings();
  if (!settings.data) return '';
  const on = ['Cash', settings.data.storeCreditOn ? 'store credit' : null, settings.data.accountsOn ? 'customer accounts' : null].filter(Boolean);
  return on.length > 1 ? `${on.slice(0, -1).join(', ')} and ${on[on.length - 1]}` : 'Cash';
}

// A way to pay: its switch, what it is underneath, then its one setting when on (setup.mjs way()).
function Way({ toggle, sub, children }: { toggle: React.ReactNode; sub: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-2">
      {toggle}
      <span className="text-size-13 text-[var(--wh-muted)]">{sub}</span>
      {children}
    </div>
  );
}

export function WaysToPaySettings() {
  const queryClient = useQueryClient();
  const settings = usePaymentSettings();
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const s = settings.data;

  async function save(change: Partial<PaymentSettings>) {
    setNote(null);
    try {
      const saved = await apiMutate<PaymentSettings>('/api/payment-settings', change, { method: 'PUT' });
      queryClient.setQueryData(PAYMENT_SETTINGS_KEY, saved);
      // Every customer page shows or hides its lines with these.
      void queryClient.invalidateQueries({ queryKey: ['customer'] });
      return true;
    } catch (err) {
      setNote({ ok: false, text: words(err) });
      return false;
    }
  }
  async function saveLimit() {
    if (typed === null || !s) return;
    let pence: number | null = null;
    if (typed.trim() !== '') {
      const read = parseTotal(typed);
      if (read === null || 'invalid' in read) { setNote({ ok: false, text: 'Pounds and pence, like 5.00' }); return; }
      pence = read.pence;
    }
    if (pence === s.accountLimitPence) { setTyped(null); setNote(null); return; }
    if (await save({ accountLimitPence: pence })) {
      setTyped((t) => (t === typed ? null : t));
      setNote({ ok: true, text: 'Saved.' });
    }
  }

  if (settings.isError) return <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the ways to pay. Try again in a moment.</p>;
  return (
    <div className="grid items-start gap-2 md:grid-cols-2">
      <div className="flex flex-col gap-0.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3">
        <span className="text-size-15 font-bold">Cash</span>
        <span className="text-size-13 text-[var(--wh-muted)]">Always on</span>
      </div>
      <Way sub="Earned back on sales, and given on refunds without a receipt"
        toggle={<RowSwitch label="Store credit" on={Boolean(s?.storeCreditOn)} disabled={!s} onChange={(on) => void save({ storeCreditOn: on })} />} />
      <Way sub="Pay later, settled from the customer’s page"
        toggle={<RowSwitch label="Customer accounts" on={Boolean(s?.accountsOn)} disabled={!s} onChange={(on) => void save({ accountsOn: on })} />}>
        {s?.accountsOn ? (
          <>
            <span className="flex items-center gap-2.5 pt-2">
              <label htmlFor="pay-limit" className="grow text-sm">Most a customer can owe</label>
              <input
                id="pay-limit"
                inputMode="decimal"
                value={typed ?? (s.accountLimitPence === null ? '' : penceText(s.accountLimitPence))}
                aria-invalid={note && !note.ok ? true : undefined}
                onChange={(e) => setTyped(e.target.value)}
                onBlur={() => void saveLimit()}
                className="min-h-11 w-[120px] rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-right font-mono text-size-15"
              />
            </span>
            <span className="text-size-13 text-[var(--wh-muted)]">For everyone. Change it for one customer on their page.</span>
          </>
        ) : null}
      </Way>
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold md:col-span-2 ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}
