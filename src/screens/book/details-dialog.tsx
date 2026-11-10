import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { apiMutate, ApiError } from '@/lib/api/client.ts';

/**
 * Edit your details (openspec/changes/finish-account design 6; Jack, 9 Nov,
 * answer 3; "Edit" on ac-account). Not drawn: a Form box as How we contact
 * you's is, with Name, Mobile and Email, Cancel and Save (decided while
 * building). Name and mobile save at once. A new email is confirmed first: a
 * code goes to it, and the box asks for it as the sign-in's code step does;
 * until then nothing about the email changes.
 */
export type Details = { name: string | null; phone: string | null; email: string };
type Step = { at: 'form' } | { at: 'code'; email: string } | { at: 'done'; said: string };

const FAILED = 'That didn’t go through. Check your connection and try again.';
const words = (err: unknown) => (err instanceof ApiError && err.status === 401 ? 'Please sign in again to change this.'
  : err instanceof ApiError && (err.status === 400 || err.status === 429) && err.hasServerMessage ? err.message : FAILED);

export function DetailsDialog({ me, shopSlug, onClose }: { me: Details; shopSlug: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const base = `/api/portal/${encodeURIComponent(shopSlug)}/me`;
  const [name, setName] = React.useState(me.name ?? '');
  const [phone, setPhone] = React.useState(me.phone ?? '');
  const [email, setEmail] = React.useState(me.email);
  const [code, setCode] = React.useState('');
  const [step, setStep] = React.useState<Step>({ at: 'form' });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resent, setResent] = React.useState(false);
  const field = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-size-15';
  const keep = (saved: Partial<Details>) => queryClient.setQueryData<Details>(['account', shopSlug, 'me'], (old) => (old ? { ...old, ...saved } : old));

  async function askCode(to: string, again: boolean) {
    await apiMutate(`${base}/email`, { email: to }, { method: 'POST' });
    setCode('');
    setResent(again);
    setStep({ at: 'code', email: to.trim().toLowerCase() });
  }

  async function save() {
    const change: { name?: string; phone?: string } = {};
    if (name.trim() !== (me.name ?? '').trim()) change.name = name;
    if (phone.trim() !== (me.phone ?? '').trim()) change.phone = phone;
    const newEmail = email.trim().toLowerCase() !== me.email.trim().toLowerCase();
    if (!Object.keys(change).length && !newEmail) { onClose(); return; }
    setBusy(true);
    setError(null);
    try {
      if (Object.keys(change).length) keep(await apiMutate<Pick<Details, 'name' | 'phone'>>(base, change, { method: 'PUT' }));
      if (newEmail) await askCode(email, false);
      else onClose();
    } catch (err) {
      setError(words(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    setError(null);
    setResent(false);
    try {
      const done = await apiMutate<{ email: string; said: string }>(`${base}/email/confirm`, { code }, { method: 'POST' });
      keep({ email: done.email });
      setStep({ at: 'done', said: done.said });
    } catch (err) {
      setError(words(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendAgain(to: string) {
    setBusy(true);
    setError(null);
    try {
      await askCode(to, true);
    } catch (err) {
      setError(words(err));
    } finally {
      setBusy(false);
    }
  }

  const alert = error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="ed-title" className="md:max-w-[520px]">
      <DialogHeader><DialogTitle id="ed-title">Edit your details</DialogTitle></DialogHeader>
      {step.at === 'form' ? (
        <>
          <DialogBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-name" className="text-sm font-semibold">Name</label>
              <input id="ed-name" autoComplete="name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-phone" className="text-sm font-semibold">Mobile</label>
              <input id="ed-phone" type="tel" autoComplete="tel" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-email" className="text-sm font-semibold">Email</label>
              <input id="ed-email" type="email" autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {alert}
          </DialogBody>
          <DialogFooter className="flex justify-end gap-2.5">
            <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button variant="accent" disabled={busy} onClick={() => void save()}>Save</Button>
          </DialogFooter>
        </>
      ) : step.at === 'code' ? (
        <>
          <DialogBody className="flex flex-col gap-3">
            <p className="m-0">We sent a code to <strong>{step.email}</strong>. It works for 10 minutes.</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-code" className="text-sm font-semibold">Your 6-digit code</label>
              <input id="ed-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6}
                className={`${field} font-[family-name:var(--wh-font-mono)] tracking-widest`}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            {alert}
            {resent ? <p role="status" className="m-0 text-sm">{`We sent a new code to ${step.email}`}</p> : null}
            <button type="button" disabled={busy} onClick={() => void sendAgain(step.email)}
              className="inline-flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wh-ink)] underline">Send a new code</button>
          </DialogBody>
          <DialogFooter className="flex justify-end gap-2.5">
            <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button variant="accent" disabled={busy || code.length !== 6} onClick={() => void confirmCode()}>Confirm</Button>
          </DialogFooter>
        </>
      ) : (
        <>
          <DialogBody>
            <p role="status" className="m-0 rounded-lg bg-[var(--wh-status-complete-bg)] px-3 py-2 text-sm font-semibold text-[var(--wh-status-complete-ink)]">{step.said}</p>
          </DialogBody>
          <DialogFooter className="flex justify-end">
            <Button variant="accent" onClick={onClose}>Done</Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
