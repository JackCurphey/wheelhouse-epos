import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';

/**
 * Settings › Messages (the messages engine, Jack 20 Oct, pretend for now;
 * drawn as set-msg-list and set-msg-edit, with the booking messages' email
 * preview from book.mjs). Only the messages something sends today are
 * listed (stage 1 drawing gaps 7); each goes the customer's way.
 */
type Template = {
  key: string; name: string; when: string; enabled: boolean; wording: string; subject: string;
  changed: boolean; tapIns: string[]; live: boolean;
  /** 'booking' for the booking messages, listed under their own heading. */
  group?: string | null;
};
type Preview = { text: string; email: { subject: string; body: string } };

const KEY = ['message-templates'];
const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';

export function MessagesSettings() {
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: KEY, queryFn: () => apiGet<Template[]>('/api/message-templates') });
  // Each message's own save in flight, so two quick switches don't share one.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);

  async function change(key: string, body: object) {
    setBusy((b) => new Set(b).add(key));
    setError(null);
    try {
      const saved = await apiMutate<Template>(`/api/message-templates/${key}`, body, { method: 'PUT' });
      queryClient.setQueryData<Template[]>(KEY, (list) => list?.map((t) => (t.key === key ? saved : t)));
      return saved;
    } catch {
      setError(SAVE_FAILED);
      return null;
    } finally {
      setBusy((b) => { const next = new Set(b); next.delete(key); return next; });
    }
  }

  // Back to the row's Edit when the box closes, for keyboard users.
  function closeEdit() {
    const name = editing?.name;
    setEditing(null);
    setError(null);
    setTimeout(() => document.querySelector<HTMLButtonElement>(`[aria-label="Edit the wording of ${name}"]`)?.focus(), 0);
  }

  const live = templates.data?.filter((t) => t.live) ?? [];
  const jobMessages = live.filter((t) => t.group !== 'booking');
  const bookingMessages = live.filter((t) => t.group === 'booking');
  const row = (t: Template) => (
    <div key={t.key} className="flex min-h-[60px] flex-wrap items-center gap-2.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-2.5 pr-2.5 pl-3.5 md:flex-nowrap md:py-0 md:pr-2">
      <span className="flex min-w-0 grow basis-full flex-col gap-0.5 md:basis-auto">
        <span className="text-[15px] font-bold">{t.name}</span>
        <span className="text-[13px] text-[var(--wh-muted)]">{t.when}</span>
      </span>
      <button type="button" aria-label={`Edit the wording of ${t.name}`} onClick={() => setEditing(t)} className="min-h-11 px-3 text-sm font-semibold underline">Edit</button>
      <span className="text-[13px] whitespace-nowrap text-[var(--wh-muted)]">Customer’s choice</span>
      <OnOff name={t.name} on={t.enabled} disabled={busy.has(t.key)} onChange={(on) => void change(t.key, { enabled: on })} />
    </div>
  );
  return (
    <section aria-labelledby="set-messages" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="set-messages" className="m-0 text-xl font-bold">Messages</h2>
        <p className="m-0 text-sm text-[var(--wh-muted)]">The texts and emails customers get from the shop.</p>
      </div>
      <section aria-labelledby="set-msg-list" className="flex flex-col gap-2 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
        <h3 id="set-msg-list" className="m-0 text-base font-bold">Automatic messages</h3>
        {templates.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the messages. Try again in a moment.</p> : null}
        {jobMessages.map(row)}
        {/* The booking messages under their own heading, as drawn (msgListOpen). */}
        {bookingMessages.length ? (
          <>
            <h4 className="m-0 mt-2 text-sm font-bold">Booking messages</h4>
            <p className="m-0 text-[13px] text-[var(--wh-muted)]">Sent the way each customer chose when booking: text, WhatsApp or email.</p>
          </>
        ) : null}
        {bookingMessages.map(row)}
        {error && !editing ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </section>
      {editing ? (
        <EditMessage
          template={templates.data?.find((t) => t.key === editing.key) ?? editing}
          error={error}
          onSave={(body) => change(editing.key, body)}
          onClose={closeEdit}
        />
      ) : null}
    </section>
  );
}

// The drawn On/Off pill, named with its message ("Bike ready: On").
function OnOff({ name, on, disabled, onChange }: { name: string; on: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${name}: ${on ? 'On' : 'Off'}`}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] text-[var(--wh-muted)]'}`}
    >
      {on ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg> : null}
      {on ? 'On' : 'Off'}
    </button>
  );
}

function EditMessage({ template, error, onSave, onClose }: { template: Template; error: string | null; onSave: (body: object) => Promise<Template | null>; onClose: () => void }) {
  const [words, setWords] = useState(template.wording);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  // The preview follows the words as they're typed, filled in by the server
  // with the drawings' example (Maya Patel's Trek Domane AL 3, WH-1042).
  useEffect(() => {
    let current = true;
    const t = setTimeout(() => {
      apiMutate<Preview>(`/api/message-templates/${template.key}/preview`, { wording: words })
        .then((p) => { if (current) { setPreview(p); setPreviewFailed(false); } })
        .catch(() => { if (current) setPreviewFailed(true); });
    }, 200);
    return () => { current = false; clearTimeout(t); };
  }, [template.key, words]);

  // A tap-in goes in where the cursor is.
  function putIn(name: string) {
    const el = box.current;
    const at = el ? el.selectionStart : words.length;
    const end = el ? el.selectionEnd : words.length;
    const tag = `[${name}]`;
    setWords(words.slice(0, at) + tag + words.slice(end));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(at + tag.length, at + tag.length); }, 0);
  }

  async function done() {
    if (words === template.wording) return onClose();
    setBusy(true);
    const saved = await onSave({ wording: words });
    setBusy(false);
    if (saved) onClose();
  }

  async function goBack() {
    setBusy(true);
    const saved = await onSave({ wording: null });
    setBusy(false);
    if (saved) setWords(saved.wording);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="msg-title" className="md:max-w-[620px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="msg-title">{template.name}</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">{`Sent ${template.when.charAt(0).toLowerCase()}${template.when.slice(1)}`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3.5">
        <p className="m-0 text-[15px]">Sent the way each customer chose: text, WhatsApp or email.</p>
        <div className="flex flex-col gap-2">
          <label htmlFor="msg-words" className="text-[15px] font-semibold">Wording</label>
          <textarea
            id="msg-words" ref={box} rows={4} maxLength={2000} value={words} onChange={(e) => setWords(e.target.value)}
            className="resize-none rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] p-2.5 text-[15px] leading-normal"
          />
          <div role="group" aria-label="Put in" className="flex flex-wrap gap-1.5">
            {template.tapIns.map((name) => (
              <button key={name} type="button" onClick={() => putIn(name)} className="min-h-11 rounded-md border border-dashed border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-[13px] font-semibold">{`+ ${name}`}</button>
            ))}
          </div>
          {/* UX walk-through 7 M6, drawn under the wording (set-msg-edit). */}
          <p className="m-0 text-sm text-[var(--wh-muted)]">With more than one shop, [Shop name] fills in as the business and the shop, like “North Street Cycles, Bolton”.</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-[var(--wh-muted)]">PREVIEW · TEXT TO MAYA PATEL</span>
          {previewFailed ? <p role="status" className="m-0 text-sm text-[var(--wh-muted)]">Wheelhouse couldn’t show the preview. Try again in a moment.</p> : null}
          <div className="max-w-full self-start rounded-[14px_14px_14px_4px] bg-[var(--wh-surface-muted)] px-3.5 py-3 text-sm leading-normal whitespace-pre-wrap">{preview?.text ?? ''}</div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-[var(--wh-muted)]">PREVIEW · EMAIL TO MAYA PATEL</span>
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3 text-sm leading-normal">
            <span className="font-bold">{preview?.email.subject ?? ''}</span>
            <span className="whitespace-pre-wrap">{preview?.email.body ?? ''}</span>
          </div>
        </div>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-between gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={() => void goBack()}>Go back to Wheelhouse’s wording</Button>
        <Button variant="primary" disabled={busy} onClick={() => void done()}>Done</Button>
      </DialogFooter>
    </Dialog>
  );
}
