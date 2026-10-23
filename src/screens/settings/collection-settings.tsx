import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';

/**
 * Settings › Workshop › Collection (drawn as cp-setting; collect and pay
 * review item 4 and M5; openspec/changes/uncollected-bike): the days from when
 * a bike is marked ready to "Bike still waiting", and to the bike showing on
 * Today. Leaving either box saves both as they read, so the reminder can be
 * raised past Today's count by raising Today next (review). The Hand-back
 * reminders switch in the drawing is a piece of its own.
 */
type Days = { collectionReminderDays?: number; collectionTodayDays?: number };
const KEY = ['workshop-settings'];
const FIELDS = { remind: 'collectionReminderDays', today: 'collectionTodayDays' } as const;
const LIMITS = { remind: [1, 60], today: [2, 90] } as const;
type Box = keyof typeof FIELDS;

/** The fold's summary: "Reminder after 3 days". */
export function useCollectionSummary(): string {
  const settings = useQuery({ queryKey: KEY, queryFn: () => apiGet<Days>('/api/workshop-settings') });
  const days = settings.data?.collectionReminderDays;
  return days === undefined ? '' : `Reminder after ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function CollectionSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: KEY, queryFn: () => apiGet<Days>('/api/workshop-settings') });
  const [typed, setTyped] = useState<Partial<Record<Box, string>>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const stored = (box: Box) => settings.data?.[FIELDS[box]];
  const shown = (box: Box) => typed[box] ?? (stored(box) === undefined ? '' : String(stored(box)));

  async function save() {
    if (typed.remind === undefined && typed.today === undefined) return;
    const body: Record<string, number> = {};
    for (const box of ['remind', 'today'] as Box[]) {
      const text = shown(box).trim();
      const n = Number(text);
      const [min, max] = LIMITS[box];
      if (text === '' || !Number.isInteger(n) || n < min || n > max) { setNote({ ok: false, text: `Enter ${min} to ${max} days` }); return; }
      body[FIELDS[box]] = n;
    }
    if (body.collectionReminderDays === stored('remind') && body.collectionTodayDays === stored('today')) { setTyped({}); setNote(null); return; }
    setNote(null);
    try {
      const saved = await apiMutate<Days>('/api/workshop-settings', body, { method: 'PUT' });
      queryClient.setQueryData(KEY, saved);
      setTyped({});
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      // What was typed stays, with the server's reason ("Show it on Today after more days than the reminder.").
      setNote({ ok: false, text: err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    }
  }

  const row = (box: Box, id: string, label: string, hint: ReactNode) => (
    <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3">
      <span className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-[15px] font-semibold">{label}</label>
        <span id={`${id}-h`} className="text-[13px] text-[var(--wh-muted)]">{hint}</span>
      </span>
      <span className="inline-flex items-center gap-2 text-sm">
        <input
          id={id}
          aria-describedby={`${id}-h`}
          inputMode="numeric"
          value={shown(box)}
          disabled={!settings.data}
          onChange={(e) => { const value = e.target.value; setTyped((t) => ({ ...t, [box]: value })); }}
          onBlur={() => void save()}
          className="min-h-11 w-16 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-center font-[family-name:var(--wh-font-mono)] text-[15px]"
        />
        days
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-1">
      {row('remind', 'rem-days', 'Remind the customer after', <>Counted from when the bike is marked ready · sends “Bike still waiting” — <Link to={`${ROUTES.settings}?room=front-desk&fold=automatic-messages`} className="text-inherit underline">edit it in Messages</Link></>)}
      {row('today', 'flag-days', 'Show it on Today after', 'Counted the same way, and longer than the reminder · for owners and managers')}
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null}
    </div>
  );
}
