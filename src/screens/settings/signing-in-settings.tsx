import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';
import { RowSwitch } from './row-switch.tsx';

/**
 * Settings › Front desk › Till › Signing in (the trust PIN lines on
 * set-till-quick, generator/consolidate/j08.mjs; roles and switches 3 and 9;
 * stage-1 gaps 9: its own fold on the Till page beside Tills;
 * openspec/changes/trust-pin-workshop design 7). Trust PIN, off to start,
 * and only while it's on, how long a workshop computer waits before going
 * back to the start. Each saved when chosen. The words speak of workshop
 * computers only until the till's pills are built.
 */
type SigningIn = { trustPin: boolean; workshopIdleMinutes: number | null };
const KEY = ['signing-in-settings'];
const useSigningIn = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<SigningIn>('/api/signing-in-settings') });
const TIMES: [number | null, string][] = [[5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [null, 'Off']];

/** The fold's summary. */
export function useSigningInSummary(): string {
  const s = useSigningIn().data;
  if (!s) return '';
  if (!s.trustPin) return 'Trust PIN off';
  return s.workshopIdleMinutes === null ? 'Trust PIN on · never goes back' : `Trust PIN on · back after ${s.workshopIdleMinutes} minutes`;
}

export function SigningInSettings() {
  const queryClient = useQueryClient();
  const settings = useSigningIn();
  const s = settings.data;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function put(body: Partial<SigningIn>) {
    setSaving(true);
    setError(null);
    try {
      queryClient.setQueryData(KEY, await apiMutate<SigningIn>('/api/signing-in-settings', body, { method: 'PUT' }));
      // A workshop computer here reads its new time and names.
      void queryClient.invalidateQueries({ queryKey: ['till-checkin'] });
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {settings.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the settings. Try again in a moment.</p> : null}
      <RowSwitch label="Trust PIN" on={s?.trustPin === true} disabled={saving || !s} onChange={(next) => void put({ trustPin: next })} />
      <p className="m-0 text-sm text-[var(--wh-muted)]">Once someone has typed their PIN on a workshop computer today, they tap their name instead. The owner still types theirs. One setting for the whole business.</p>
      {s?.trustPin ? (
        <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 border-t border-[var(--wh-border)] pt-3">
          <span id="idle-label" className="text-size-15 font-semibold">Go back to the start when left alone</span>
          <RadioPillGroup pickOnMove={false} aria-labelledby="idle-label" className="flex flex-wrap gap-2">
            {TIMES.map(([minutes, label]) => {
              const on = s.workshopIdleMinutes === minutes;
              return (
                <button key={label} type="button" role="radio" aria-checked={on} disabled={saving}
                  onClick={() => { if (!on) void put({ workshopIdleMinutes: minutes }); }}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}>
                  {label}
                </button>
              );
            })}
          </RadioPillGroup>
        </div>
      ) : (
        <p className="m-0 text-sm text-[var(--wh-muted)]">Workshop computers go back to Enter your PIN after 10 minutes left alone.</p>
      )}
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
    </div>
  );
}
