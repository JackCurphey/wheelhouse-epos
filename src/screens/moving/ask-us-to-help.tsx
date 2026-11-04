import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { Floating } from '@/screens/diary/diary-bits.tsx';
import { newRequestKey } from '@/screens/book/details-rules.ts';
import { linkClass } from '@/screens/deliveries/deliveries-bits.tsx';

/**
 * Ask us to help (mv-help, mv-help-sent in moving.mjs; Jack, 15 Oct, not-drawn pages
 * #30; openspec/changes/citrus-import-fix, design 15). A short form, top right of
 * the card it's about, drawn as Send feedback is, without its picture of the screen,
 * as a move's rows hold customers' details. What's written and the card go; nothing
 * from the rows.
 */
export function HelpLink({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`${linkClass} cursor-pointer border-0 bg-transparent underline`}>Ask us to help</button>;
}

export function HelpDialog({ card, who, shop, onClose, onSent }: { card: string; who: string; shop: string; onClose: () => void; onSent: () => void }) {
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const key = useRef(newRequestKey());
  const written = text.trim() !== '';
  async function send() {
    if (!written || sending) return;
    setSending(true);
    setFailed(false);
    try {
      await apiMutate('/api/move/help', { text, card, requestKey: key.current });
      onSent();
    } catch {
      setFailed(true);
      setSending(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="ah-title" className="md:max-w-[540px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="ah-title">Ask us to help</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">With moving from Citrus Lime · to the Wheelhouse team</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {failed ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">Couldn’t send. What you wrote is kept here. Try again.</p> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ah-text" className="text-sm font-semibold">What looks wrong?</label>
          <Textarea id="ah-text" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <p className="m-0 flex gap-2 text-sm text-[var(--wh-muted)]">
          <NavIcon name="website" size={16} />
          <span>We’ll see you asked from <strong className="text-[var(--wh-ink)]">{card}</strong>, and that you’re {who} at {shop}.</span>
        </p>
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" aria-disabled={written ? undefined : true} title={written ? undefined : 'Write something first'}
          className={written ? undefined : 'opacity-45'} onClick={() => void send()}>{failed ? 'Try again' : 'Send'}</Button>
      </DialogFooter>
    </Dialog>
  );
}

export function HelpThanks({ onClose }: { onClose: () => void }) {
  return (
    <Floating>
      <div role="status" className="pointer-events-auto flex items-center gap-2 self-center rounded-[10px] bg-[var(--wh-ink)] py-1 pr-1 pl-4 text-sm text-[var(--wh-panel)] shadow-[0_8px_24px_var(--wh-backdrop)]">
        <Check size={16} aria-hidden="true" />
        <span className="grow py-1.5">Thanks — we’ve got it. Any reply comes to your email.</span>
        <button type="button" aria-label="Close the message" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </Floating>
  );
}
