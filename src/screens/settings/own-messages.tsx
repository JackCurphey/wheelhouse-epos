import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';

/**
 * Your own messages, under Settings › Messages › Automatic messages
 * (openspec/changes/own-messages-screens; drawn as set-msg-new in setup.mjs;
 * owner setup decision 14; stage 1 drawing gaps decision 7; Jack's answers of
 * 26 Oct, docs/decisions/2026-10-26-receipt-and-own-messages.md). Each row is
 * the shop's own message with when and how it goes, Edit, and On or Off; the
 * drawn box adds one, and Edit opens it again with Remove and Save.
 */
type SendWhen = 'after_collected' | 'before_booked' | 'after_sale';
type OwnMessage = {
  id: number; name: string; sendWhen: SendWhen; amount: number; unit: 'days' | 'months';
  byText: boolean; byEmail: boolean; wording: string; enabled: boolean;
};

const KEY = ['own-messages'];
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
const NOTE = 'Only customers who’ve agreed to hear from the shop get messages like this. Job updates always go.';
const WHEN: Record<SendWhen, string> = {
  after_collected: 'After a job is collected',
  before_booked: 'Before a booked job',
  after_sale: 'After a sale',
};
// The drawn put-ins (setup.mjs wordingBox).
const PUT_INS = ['Customer’s first name', 'Bike', 'Job number', 'Amount to pay', 'Link to the job', 'Shop name', 'Opening hours'];

/** "6 months after a job is collected · by email" (design 2; not drawn). */
export function whenLine(m: Pick<OwnMessage, 'sendWhen' | 'amount' | 'unit' | 'byText' | 'byEmail'>): string {
  const unit = m.amount === 1 ? m.unit.slice(0, -1) : m.unit;
  const how = m.byText && m.byEmail ? 'by text or email' : m.byText ? 'by text' : 'by email';
  return `${m.amount} ${unit} ${WHEN[m.sendWhen].charAt(0).toLowerCase()}${WHEN[m.sendWhen].slice(1)} · ${how}`;
}

// What PUT and POST take: the message without its id or switch.
const toBody = (m: OwnMessage) => ({ name: m.name, sendWhen: m.sendWhen, amount: m.amount, unit: m.unit, byText: m.byText, byEmail: m.byEmail, wording: m.wording });
const said = (err: unknown) => (err instanceof ApiError && err.status === 400 ? err.message : SAVE_FAILED);

export function OwnMessages() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: () => apiGet<OwnMessage[]>('/api/own-messages') });
  // null: no box; 'new': adding; a message: editing it.
  const [open, setOpen] = useState<OwnMessage | 'new' | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function flip(m: OwnMessage) {
    setBusy((b) => new Set(b).add(m.id));
    setError(null);
    try {
      const saved = await apiMutate<OwnMessage>(`/api/own-messages/${m.id}`, { ...toBody(m), enabled: !m.enabled }, { method: 'PUT' });
      queryClient.setQueryData<OwnMessage[]>(KEY, (all) => all?.map((x) => (x.id === m.id ? saved : x)));
    } catch (err) {
      setError(said(err));
    } finally {
      setBusy((b) => { const next = new Set(b); next.delete(m.id); return next; });
    }
  }

  // Back to the row's Edit, or the add button, when the box closes, for keyboard users.
  function close(focusLabel: string) {
    setOpen(null);
    setTimeout(() => document.querySelector<HTMLButtonElement>(`[aria-label="${focusLabel}"]`)?.focus(), 0);
  }

  return (
    <div className="flex flex-col gap-2">
      <h5 className="m-0 mt-2 text-sm font-bold">Your own messages</h5>
      <p className="m-0 text-size-13 text-[var(--wh-muted)]">{NOTE}</p>
      {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load your own messages. Try again in a moment.</p> : null}
      {(list.data ?? []).map((m) => (
        <div key={m.id} className="flex min-h-[60px] flex-wrap items-center gap-2.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-2.5 pr-2.5 pl-3.5 md:flex-nowrap md:py-0 md:pr-2">
          <span className="flex min-w-0 grow basis-full flex-col gap-0.5 md:basis-auto">
            <span className="text-size-15 font-bold">{m.name}</span>
            <span className="text-size-13 text-[var(--wh-muted)]">{whenLine(m)}</span>
          </span>
          <button type="button" aria-label={`Edit ${m.name}`} onClick={() => setOpen(m)} className="min-h-11 px-3 text-sm font-semibold underline">Edit</button>
          <button
            type="button"
            aria-pressed={m.enabled}
            aria-label={`${m.name}: ${m.enabled ? 'On' : 'Off'}`}
            disabled={busy.has(m.id)}
            onClick={() => void flip(m)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${m.enabled ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] text-[var(--wh-muted)]'}`}
          >
            {m.enabled ? 'On' : 'Off'}
          </button>
        </div>
      ))}
      {error && !open ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      <div>
        <Button aria-label="+ Add your own message" onClick={() => { setError(null); setOpen('new'); }}>+ Add your own message</Button>
      </div>
      {open ? (
        <MessageBox
          key={open === 'new' ? 'new' : open.id}
          message={open === 'new' ? null : open}
          onDone={(saved, removedId) => {
            queryClient.setQueryData<OwnMessage[]>(KEY, (all) => {
              const rest = (all ?? []).filter((x) => x.id !== removedId);
              if (!saved) return rest;
              return rest.some((x) => x.id === saved.id) ? rest.map((x) => (x.id === saved.id ? saved : x)) : [...rest, saved];
            });
            close(saved ? `Edit ${saved.name}` : '+ Add your own message');
          }}
          onClose={() => close(open === 'new' ? '+ Add your own message' : `Edit ${open.name}`)}
        />
      ) : null}
    </div>
  );
}

/**
 * The drawn box (set-msg-new): Name, Send it, how long, Send by, Wording with
 * its put-ins, the note. Adding starts as drawn: after a job is collected,
 * months, by email. Edit adds Remove (Jack's answer 4) and saves with Save.
 */
function MessageBox({ message, onDone, onClose }: { message: OwnMessage | null; onDone: (saved: OwnMessage | null, removedId?: number) => void; onClose: () => void }) {
  const [name, setName] = useState(message?.name ?? '');
  const [sendWhen, setSendWhen] = useState<SendWhen>(message?.sendWhen ?? 'after_collected');
  const [amount, setAmount] = useState(message ? String(message.amount) : '');
  const [unit, setUnit] = useState<'days' | 'months'>(message?.unit ?? 'months');
  const [byText, setByText] = useState(message?.byText ?? false);
  const [byEmail, setByEmail] = useState(message?.byEmail ?? true);
  const [wording, setWording] = useState(message?.wording ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // A put-in goes where the cursor is, as in the built-in messages' box.
  function putIn(tapIn: string) {
    const el = box.current;
    const at = el ? el.selectionStart : wording.length;
    const end = el ? el.selectionEnd : wording.length;
    const tag = `[${tapIn}]`;
    setWording(wording.slice(0, at) + tag + wording.slice(end));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(at + tag.length, at + tag.length); }, 0);
  }

  async function save() {
    setBusy(true);
    setError(null);
    // The server checks each part and says what to fix (own-messages-server design 6).
    const body = { name, sendWhen, amount: /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : amount.trim() === '' ? null : Number.NaN, unit, byText, byEmail, wording };
    try {
      const saved = message
        ? await apiMutate<OwnMessage>(`/api/own-messages/${message.id}`, { ...body, enabled: message.enabled }, { method: 'PUT' })
        : await apiMutate<OwnMessage>('/api/own-messages', body, { method: 'POST' });
      onDone(saved);
    } catch (err) {
      setError(said(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!message) return;
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/own-messages/${message.id}`, {}, { method: 'DELETE' });
      onDone(null, message.id);
    } catch (err) {
      setError(said(err));
      setBusy(false);
    }
  }

  const chan = (label: string, on: boolean, set: (v: boolean) => void) => (
    <button type="button" aria-pressed={on} onClick={() => set(!on)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] text-[var(--wh-ink)]'}`}>{label}</button>
  );
  const howLong = sendWhen === 'before_booked' ? 'How long before' : 'How long after';

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="own-msg-title" className="md:max-w-[620px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="own-msg-title">Your own message</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">Sent automatically</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="own-msg-name" className="text-size-15 font-semibold">Name</label>
          <Input id="own-msg-name" maxLength={60} placeholder="e.g. Service reminder" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <PillGroup legend="Send it" options={(Object.keys(WHEN) as SendWhen[]).map((k) => ({ value: k, label: WHEN[k] }))} value={sendWhen} onChange={(v) => setSendWhen(v as SendWhen)} />
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="own-msg-amount" className="grow text-size-15 font-semibold">{howLong}</label>
          <Input id="own-msg-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-[72px] text-center font-[family-name:var(--wh-font-mono)]" />
          <PillGroup legend={<span className="sr-only">Days or months</span>} className="[&_legend]:sr-only" options={[{ value: 'days', label: 'Days' }, { value: 'months', label: 'Months' }]} value={unit} onChange={(v) => setUnit(v as 'days' | 'months')} />
        </div>
        <div role="group" aria-label="Send by" className="flex flex-wrap items-center gap-2">
          <span className="grow text-size-15 font-semibold">Send by</span>
          {chan('Text', byText, setByText)}
          {chan('Email', byEmail, setByEmail)}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="own-msg-words" className="text-size-15 font-semibold">Wording</label>
          <textarea id="own-msg-words" ref={box} rows={3} maxLength={2000} value={wording} onChange={(e) => setWording(e.target.value)} className="resize-none rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] p-2.5 text-size-15 leading-normal" />
          <div role="group" aria-label="Put in" className="flex flex-wrap gap-1.5">
            {PUT_INS.map((t) => (
              <button key={t} type="button" onClick={() => putIn(t)} className="min-h-11 rounded-md border border-dashed border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-size-13 font-semibold">{`+ ${t}`}</button>
            ))}
          </div>
        </div>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{NOTE}</p>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        {message ? <Button variant="ghost" disabled={busy} onClick={() => void remove()}>Remove</Button> : <span />}
        <span className="flex gap-2.5">
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>{message ? 'Save' : 'Add the message'}</Button>
        </span>
      </DialogFooter>
    </Dialog>
  );
}
