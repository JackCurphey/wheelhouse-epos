import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { parseTotal, penceText } from '@/lib/cash-count.ts';
import { Button } from '@/components/ui/button.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { dayLabel } from '@/screens/diary/rules.ts';

/**
 * Close the day for a reopened earlier day (reports-accounts-and-reopen design 1; not drawn: the drawings show
 * only Reopen this day and the reopened bar, so this follows Close the day's own words and rows). The day's
 * first close was kept as history and its sales stay with it, so what it should hold is worked out from them:
 * the Owner counts the cash again, sees the difference, and closes it again. The server answers with the same
 * close the day had, now with the new count.
 */
export type ReopenedDayData = {
  day: string; floatPence: number | null; floatStart: { pence: number; how: string; expectedPence: number; byName: string; at: string } | null;
  cashPence: number; paidOutsPence: number; expectedPence: number | null; earlierBankedPence?: number;
  reopened: { id: number; day: string; reason: string; reopenedByName: string; reopenedAt: string };
};
const INPUT = 'w-full max-w-[260px] rounded-[7px] border border-[var(--input)] bg-[var(--wh-panel)] px-2.5 py-[9px] text-base';
const diff = (pence: number) => (pence === 0 ? penceText(0) : `${penceText(Math.abs(pence))} ${pence < 0 ? 'short' : 'over'}`);

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--wh-border)] py-2 first:border-t-0">
      <span className={`text-size-15 ${strong ? 'font-bold' : ''}`}>{label}</span>
      <span className={`font-mono ${strong ? 'text-xl' : 'text-size-15'}`}>{value}</span>
    </div>
  );
}

export function ReopenedDay({ data: first }: { data: ReopenedDayData }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // The figures can change while counting (a sale, cash taken out): the page reads them again when the server says so.
  const live = useQuery({ queryKey: ['close-the-day', first.day], queryFn: () => apiGet<ReopenedDayData>(`/api/close-the-day?day=${encodeURIComponent(first.day)}`), initialData: first, staleTime: Infinity, retry: false });
  const data = live.data && 'reopened' in live.data ? live.data : first;
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const label = dayLabel(data.day);
  const parsed = parseTotal(typed);
  const counted = parsed && 'pence' in parsed ? parsed.pence : null;
  const expected = data.expectedPence;
  const difference = counted !== null && expected !== null ? counted - expected : null;
  const ready = counted !== null && expected !== null;
  const { reopened } = data;

  async function closeAgain() {
    if (!ready) return;
    setSaving(true);
    setFailed(null);
    try {
      // A reason only goes with a difference: one typed before a recount that came out right is dropped.
      const why = difference !== null && difference !== 0 ? reason.trim() : '';
      const { close } = await apiMutate<{ close: { id: number } }>('/api/close-the-day', { day: data.day, countedPence: counted, expectedPence: expected, ...(why ? { reason: why } : {}) }, { method: 'POST' });
      void queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      void queryClient.invalidateQueries({ queryKey: ['close-the-day'] });
      void queryClient.invalidateQueries({ queryKey: ['reports-takings'] });
      void queryClient.invalidateQueries({ queryKey: ['reports-day'] });
      navigate(`${ROUTES['rp-takings']}?day=${close.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && (err.body as { code?: string } | null)?.code === 'expected_changed') {
        // Show the figures the server has now, so the difference is checked again.
        await live.refetch();
        setFailed('The till’s figures changed while you were counting. Check the difference again.');
        return;
      }
      setFailed(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-size-22 font-bold md:text-size-26">Close the day</h2>
        <span className="text-sm text-[var(--wh-muted)]">{label}</span>
      </div>
      <section aria-label="Close the day again" className="flex flex-col gap-3 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`${label} was reopened by ${reopened.reopenedByName}: “${reopened.reason}”. Count the cash to close it again.`}</p>
        {data.floatStart ? <Line label="Float at the start" value={penceText(data.floatStart.pence)} /> : null}
        <Line label="Cash sales" value={penceText(data.cashPence)} />
        {data.paidOutsPence ? <Line label="Cash taken out" value={`−${penceText(data.paidOutsPence)}`} /> : null}
        {data.earlierBankedPence ? <Line label="Cash banked for an earlier day" value={`−${penceText(data.earlierBankedPence)}`} /> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reopen-count" className="text-size-15 font-bold">Cash counted, total</label>
          <input id="reopen-count" inputMode="decimal" className={INPUT} value={typed} placeholder="£0.00" onChange={(e) => setTyped(e.target.value)}
            aria-invalid={parsed && 'invalid' in parsed ? true : undefined} />
          {parsed && 'invalid' in parsed ? <p role="alert" className="m-0 text-size-13-5 font-semibold text-[var(--wh-danger)]">Type pounds and pence, like 208.70</p> : null}
        </div>
        {counted !== null && expected !== null ? (
          <div aria-live="polite" className="flex flex-col">
            <Line label="Should have" value={penceText(expected)} />
            <Line label="Counted" value={penceText(counted)} />
            <Line label="Difference" value={diff(difference ?? 0)} strong />
          </div>
        ) : null}
        {difference !== null && difference !== 0 ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reopen-why" className="text-size-15 font-bold">Why is it out? (optional)</label>
            <input id="reopen-why" className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        ) : null}
        {failed ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger)]">{failed}</p> : null}
        <div>
          <Button variant="primary" aria-disabled={!ready || undefined} className={ready ? undefined : 'opacity-45'} disabled={saving} onClick={() => void closeAgain()}>Close the day again</Button>
        </div>
      </section>
    </div>
  );
}
