import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check } from 'lucide-react';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { useTillCheckin } from '@/lib/till-checkin.ts';
import { penceText } from '@/lib/cash-count.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Floating } from '@/screens/diary/diary-bits.tsx';
import { NoteCoinCounter } from './note-coin-counter.tsx';
import { useHoldScreen } from '@/lib/screen-clear.ts';

/**
 * Opening the shop with a float check (journey 10; opening the shop
 * decisions 2 and 8; drawn in docs/design/user-journeys/generator/opening.mjs
 * as op-float-check, op-float-check-first, op-float-count, op-float-matched,
 * op-float-short and op-float-over). The first person to open the till each
 * day who takes payments checks the drawer holds the shop's float: Looks
 * right, or Count it with the note-and-coin counter. No ✕ and no Escape:
 * every way out is an answer (audit M1, walk-through 2 L3).
 * "First in" is the first to check in at the till with their PIN, who is
 * asked by name (openspec/changes/pins-and-checkin); there is no "Till B1"
 * until tills are named (openspec/changes/opening-float-check).
 */
type Check = { id: number; how: 'looked' | 'counted'; expectedPence: number; countedPence: number | null; reason: string; checkedByName: string; checkedAt: string };
type Today = { day: string; floatPence: number | null; takesPayments: boolean; firstDay: boolean; check: Check | null };
type Step = { at: 'check' } | { at: 'count' } | { at: 'diff'; counted: number };

const QUERY = ['float-check'];
// Close the day's query (close-the-day.tsx imports this file, so it is named here).
const CLOSE_DAY_QUERY = ['close-the-day'];
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';

export function FloatCheck({ atClose = false }: { atClose?: boolean } = {}) {
  const session = useSession();
  const queryClient = useQueryClient();
  // Read again every minute and when the till comes back into view, so a till
  // left open overnight asks the next morning (review, 27 Oct; Today's pattern).
  const today = useQuery({ queryKey: QUERY, queryFn: () => apiGet<Today>('/api/float-check'), retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true });
  // Nothing opens by itself over the till until this knows whether to ask (whos-in-and-first-pin).
  useHoldScreen(today.isPending);
  const [step, setStep] = useState<Step>({ at: 'check' });
  const [counted, setCounted] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // The person checked in at the till; at closing, the Owner signed in (pins-and-checkin).
  const checkedIn = useTillCheckin().data?.serving ?? null;
  const signedIn = session.status === 'signed-in' ? session.user.name : '';
  const name = !atClose && checkedIn ? checkedIn.name : signedIn;
  const t = today.data;
  // The counter starts empty each time, so what it says starts as nothing counted.
  const toCount = () => { setCounted(null); setStep({ at: 'count' }); };

  async function save(countedPence: number | null, why?: string) {
    setSaving(true);
    setFailed(null);
    try {
      const body = why ? { countedPence, reason: why } : { countedPence };
      const { check } = await apiMutate<{ check: Check }>('/api/float-check', atClose ? { ...body, atClose: true } : body, { method: 'POST' });
      queryClient.setQueryData<Today>(QUERY, (old) => (old ? { ...old, check } : old));
      // Close the day's figures start from this morning's float (close-the-day.tsx).
      void queryClient.invalidateQueries({ queryKey: CLOSE_DAY_QUERY });
      // A count that matches, or a look, says so; only a count says "counted by" (j10 line).
      if (countedPence === null) setMessage(`Float checked · looked right · ${check.checkedByName}`);
      else if (countedPence === check.expectedPence) setMessage(`Float checked · counted by ${check.checkedByName}`);
    } catch (err) {
      // Someone else checked it first: the day is checked, so the pop-up goes.
      if (err instanceof ApiError && err.status === 409 && (err.body as { code?: string } | null)?.code === 'already_checked') {
        await queryClient.invalidateQueries({ queryKey: QUERY });
        void queryClient.invalidateQueries({ queryKey: CLOSE_DAY_QUERY });
      // The server's own words for a refused count, as the settings boxes show them.
      } else setFailed(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  const due = t && t.floatPence !== null && t.takesPayments && !t.check;
  const floating = message ? (
    <Floating>
      <div role="status" className="pointer-events-auto flex items-center gap-2 self-center rounded-[10px] bg-[var(--wh-ink)] py-1 pr-1 pl-4 text-sm text-[var(--wh-panel)] shadow-[0_8px_24px_var(--wh-backdrop)]">
        <Check size={16} aria-hidden="true" />
        <span className="grow py-1.5">{message}</span>
        <button type="button" aria-label="Close the message" onClick={() => setMessage(null)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </Floating>
  ) : null;
  if (!due || t.floatPence === null) return floating;
  const expected = t.floatPence;
  const error = failed ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{failed}</p> : null;

  if (step.at === 'count') {
    return (
      <Box key="count" id="cnt" title="Count the float" sub="count every note and coin" wide focus='input[aria-label="Number of £50"]'
        footer={<>
          <Button onClick={() => setStep({ at: 'check' })}>Back</Button>
          <Button variant="primary" disabled={counted === null || saving} onClick={() => {
            if (counted === null) return;
            if (counted === expected) void save(counted);
            else { setReason(''); setStep({ at: 'diff', counted }); }
          }}>Done counting</Button>
        </>}>
        <NoteCoinCounter onChange={setCounted} />
        {error}
      </Box>
    );
  }

  if (step.at === 'diff') {
    const over = step.counted > expected;
    const diff = Math.abs(step.counted - expected);
    return (
      <Box key="diff" id="diff" focus="#diff-why" title={`The float is ${over ? 'over' : 'short'}`} sub={`counted by ${name}`}
        footer={<>
          <Button onClick={toCount}>Count again</Button>
          <Button variant="primary" disabled={saving} onClick={() => void save(step.counted, reason.trim() || undefined)}>Start the day</Button>
        </>}>
        <div>
          <Row label="Should have" value={penceText(expected)} first />
          <Row label="Counted" value={penceText(step.counted)} />
          <Row label="Difference" value={`${penceText(diff)} ${over ? 'over' : 'short'}`} warn />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="diff-why" className="text-sm font-semibold">Any idea why? <span className="font-normal text-[var(--wh-muted)]">(optional)</span></label>
          <input id="diff-why" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm" />
        </div>
        <Note>A manager sees this on Today. The till starts with what you counted.</Note>
        {error}
      </Box>
    );
  }

  // At closing, a float nobody checked is looked at, never counted, even on
  // the first day (Jack's answer 8, 27 Oct; close-the-day).
  if (atClose) {
    return (
      <Box key="close" id="fc" title={`Hello, ${name.split(' ')[0]}`} sub="the float wasn’t checked this morning"
        footer={<><span /><Button variant="primary" disabled={saving} onClick={() => void save(null)}>Looks right</Button></>}>
        <div className="flex flex-col items-center gap-1.5 py-2.5 text-center">
          <span className="text-size-15 text-[var(--wh-muted)]">The drawer should have</span>
          <span className="font-mono text-size-30">{penceText(expected)}</span>
          <span className="text-sm text-[var(--wh-muted)]">The shop’s float</span>
        </div>
        {error}
      </Box>
    );
  }

  // UX walk-through 4 M4: the first day on Wheelhouse is counted, never looked at.
  const first = t.firstDay;
  return (
    <Box key="check" id="fc" title={`Hello, ${name.split(' ')[0]}`} sub={first ? 'first in on the first day on Wheelhouse' : 'first in today to take payments'}
      footer={first ? <Button variant="primary" onClick={toCount}>Count it</Button> : <>
        <Button onClick={toCount}>Count it</Button>
        <Button variant="primary" disabled={saving} onClick={() => void save(null)}>Looks right</Button>
      </>}>
      <div className="flex flex-col items-center gap-1.5 py-2.5 text-center">
        <span className="text-size-15 text-[var(--wh-muted)]">The drawer should have</span>
        <span className="font-mono text-size-30">{penceText(expected)}</span>
        <span className="text-sm text-[var(--wh-muted)]">The shop’s float</span>
      </div>
      <Note>{first
        ? 'This is the first day the till takes real money, and nothing has been counted in Wheelhouse before. Count the float once, so today starts from a real figure.'
        : 'Have a quick look. If it doesn’t look right, count it — it only takes a minute.'}</Note>
      {error}
    </Box>
  );
}

/**
 * A float check pop-up: no ✕, a click outside does nothing, and Escape does
 * nothing. The page can stop Escape only once without a click in between, so
 * if the browser closes it anyway it opens again (review, 27 Oct). Each step
 * is its own pop-up (a key per step) with the focus put in it, so Enter on
 * one step's button can't press the next one's.
 */
function Box({ id, title, sub, wide = false, focus, footer, children }: { id: string; title: string; sub: string; wide?: boolean; focus?: string; footer: ReactNode; children: ReactNode }) {
  const [opened, setOpened] = useState(0);
  useEffect(() => {
    if (focus) document.getElementById(`${id}-title`)?.closest('dialog')?.querySelector<HTMLElement>(focus)?.focus();
  }, [id, focus, opened]);
  return (
    <Dialog key={opened} open onOpenChange={(open) => { if (!open) setOpened((n) => n + 1); }} dismissOnBackdrop={false} wide={wide} onCancel={(e) => e.preventDefault()} aria-labelledby={`${id}-title`} aria-describedby={`${id}-sub`}>
      <DialogHeader>
        <div className="min-w-0 grow">
          <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
          <DialogDescription id={`${id}-sub`}>{sub}</DialogDescription>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">{children}</DialogBody>
      <DialogFooter>{footer}</DialogFooter>
    </Dialog>
  );
}

function Row({ label, value, first = false, warn = false }: { label: string; value: string; first?: boolean; warn?: boolean }) {
  return (
    <div data-row className={`flex items-baseline justify-between gap-3 py-2 ${first ? '' : 'border-t border-[var(--wh-border)]'}`}>
      <span className={`inline-flex items-center gap-2 text-size-15 ${warn ? 'font-bold text-[var(--wh-warn-ink)]' : ''}`}>{warn ? <AlertTriangle size={16} aria-hidden="true" /> : null}{label}</span>
      <span className={`font-mono ${warn ? 'text-xl' : 'text-size-15'}`}>{value}</span>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  // The drawing's note (settings-frame.mjs `note`): plain muted words.
  return <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">{children}</p>;
}
