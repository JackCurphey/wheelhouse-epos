import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Lock, User } from 'lucide-react';
import { useCheckinActions, type CheckedIn, type GiveTo } from '@/lib/till-checkin.ts';
import { Dialog } from '@/components/ui/dialog.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { PinOfferDialog } from './pin-offer-dialog.tsx';

/**
 * Giving a PIN at the till (openspec/changes/give-pin-at-till; drawn in
 * docs/design/user-journeys/generator/signin.mjs as till-serving-menu,
 * till-serving-menu-several, till-give-pin-pick and till-give-pin; Jack's
 * answers 28 Oct, 3 to 5). For the Owner serving, while someone has no PIN,
 * "Serving: [name]" opens a menu: Switch who’s serving, and the PIN to give,
 * straight away for one person or from "Who’s getting a PIN?" for several.
 * "[Name]’s till PIN" is turned to that person; keeping it takes the till
 * back to Enter your PIN, ready for them.
 */
type Open = { at: 'menu'; phone: boolean } | { at: 'pick' } | { at: 'give'; person: GiveTo } | null;

export function ServingMenuButton({ serving, givePin, onFailed }: { serving: CheckedIn; givePin: GiveTo[]; onFailed: () => void }) {
  const { switchServing, gaveAPin } = useCheckinActions();
  const [open, setOpen] = useState<Open>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const label = `Serving: ${serving.name}`;
  const menuOpen = open?.at === 'menu';
  const close = (refocus: boolean) => {
    setOpen(null);
    if (refocus) buttonRef.current?.focus();
  };
  function choose(next: 'switch' | 'give') {
    if (next === 'switch') {
      setOpen(null);
      switchServing().catch(onFailed);
    } else if (givePin.length === 1) setOpen({ at: 'give', person: givePin[0] });
    else setOpen({ at: 'pick' });
  }
  const one = givePin.length === 1 ? givePin[0] : null;
  const items = (
    <>
      <MenuItem label="Switch who’s serving" sub="Back to Enter your PIN" icon={<User size={18} />} onClick={() => choose('switch')} />
      <div role="separator" className="mx-1.5 my-1 h-px bg-[var(--wh-border)]" />
      {one
        ? <MenuItem label={`Give ${one.name} their PIN`} sub={`${one.tillOnly ? 'Till only' : one.role} · no PIN yet`} icon={<Lock size={18} />} onClick={() => choose('give')} />
        : <MenuItem label="Give someone their PIN" sub={`${givePin.length} people have no PIN yet`} icon={<Lock size={18} />} onClick={() => choose('give')} />}
    </>
  );

  return (
    <div className="relative">
      <button ref={buttonRef} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={menuOpen}
        onClick={() => setOpen(menuOpen ? null : { at: 'menu', phone: window.innerWidth < 768 })}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 text-sm font-semibold hover:bg-[var(--wh-hover)]">
        <User size={16} aria-hidden="true" />{label}
      </button>
      {open?.at === 'menu' && !open.phone ? (
        <ServingMenu label={label} onClose={close} anchor={buttonRef}>{items}</ServingMenu>
      ) : null}
      {open?.at === 'menu' && open.phone ? (
        // On a phone the menu is a sheet from the bottom, as the diary's menus are.
        <Dialog open onOpenChange={(o) => { if (!o) close(true); }} aria-labelledby="serving-title"
          className="max-md:mt-auto max-md:mb-0 max-md:max-w-none max-md:rounded-t-2xl max-md:rounded-b-none bg-[var(--wh-panel)]">
          <div aria-hidden="true" className="flex justify-center pt-2"><span className="h-1 w-10 rounded-full bg-[var(--wh-border)]" /></div>
          <header className="flex items-center justify-between gap-2.5 border-b border-[var(--wh-border)] py-1.5 pr-2 pl-4">
            <h2 id="serving-title" className="m-0 text-size-17 font-bold">{label}</h2>
            <button type="button" aria-label="Close" onClick={() => close(true)} className="inline-flex size-11 items-center justify-center rounded-lg">
              <NavIcon name="close" size={20} />
            </button>
          </header>
          <MenuList label={label} onClose={close} className="flex flex-col gap-0.5 px-2 pt-2 pb-5">{items}</MenuList>
        </Dialog>
      ) : null}
      {open?.at === 'pick' ? (
        <PickDialog people={givePin} onPick={(person) => setOpen({ at: 'give', person })} onClose={() => close(true)} />
      ) : null}
      {open?.at === 'give' ? (
        <PinOfferDialog
          title={`${open.person.name}’s till PIN`}
          intro={`Turn the screen to ${open.person.name}. Wheelhouse picked this PIN — nobody else at the shop has it. ${open.person.name} learns it now; only they should see it.`}
          foot={`Then the till goes back to the PIN screen, ready for ${open.person.name} to check in.`}
          pinWords={`${open.person.name}’s PIN`}
          closeLabel="Close without giving a PIN"
          offerPath={`/api/till-checkin/give-pin/${open.person.id}/offer`}
          keepPath={`/api/till-checkin/give-pin/${open.person.id}`}
          onKept={() => { setOpen(null); gaveAPin(); }}
          onClose={() => close(true)}
        />
      ) : null}
    </div>
  );
}

function MenuItem({ label, sub, icon, onClick }: { label: string; sub: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" tabIndex={-1} aria-label={label} onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[var(--wh-ink)] hover:bg-[var(--wh-hover)] focus-visible:bg-[var(--wh-hover)]">
      <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--wh-surface-muted)]">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-size-15 font-bold">{label}</span>
        <span className="text-size-13 text-[var(--wh-muted)]">{sub}</span>
      </span>
    </button>
  );
}

/** The menu's items: the first takes the focus; arrows, Home and End move it; Escape closes back to Serving. */
function MenuList({ label, onClose, className, children }: { label: string; onClose: (refocus: boolean) => void; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); }, []);
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose(true);
    } else if (e.key === 'Tab') {
      onClose(false);
    }
  }
  return <div ref={ref} role="menu" aria-label={label} onKeyDown={onKey} className={className}>{children}</div>;
}

/** On a computer: a small menu under the button; a click away closes it. */
function ServingMenu({ label, onClose, anchor, children }: { label: string; onClose: (refocus: boolean) => void; anchor: RefObject<HTMLButtonElement | null>; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      const at = e.target as Node;
      if (box.current?.contains(at) || anchor.current?.contains(at)) return;
      onClose(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [onClose, anchor]);
  return (
    <div ref={box} className="absolute top-full right-0 z-40 mt-1.5 w-[320px] max-w-[calc(100vw-32px)] rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1.5 shadow-[0_12px_32px_var(--wh-backdrop)]">
      <MenuList label={label} onClose={onClose} className="flex flex-col gap-0.5">{children}</MenuList>
    </div>
  );
}

/** "Who’s getting a PIN?": the names with no PIN; tapping one opens their PIN (till-give-pin-pick). */
function PickDialog({ people, onPick, onClose }: { people: GiveTo[]; onPick: (person: GiveTo) => void; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} dismissOnBackdrop={false} aria-labelledby="pick-title"
      className="md:max-w-[440px] max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none max-md:bg-[var(--wh-bg)]">
      <div className="flex min-h-[72px] items-center gap-3 border-b border-[var(--wh-border)] bg-[var(--wh-panel)] py-3.5 pr-3.5 pl-[22px]">
        <h2 id="pick-title" className="m-0 grow text-xl font-bold">Who’s getting a PIN?</h2>
        <button type="button" aria-label="Close without giving a PIN" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-lg">
          <NavIcon name="close" size={20} />
        </button>
      </div>
      <div className="flex flex-col gap-3 bg-[var(--wh-bg)] px-5 pt-6 pb-7 md:px-7">
        <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">These people have no PIN yet. Tap a name, then turn the screen to them.</p>
        {people.map((p) => (
          <button key={p.id} type="button" onClick={() => onPick(p)}
            className="flex min-h-14 w-full items-center gap-3.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-2.5 text-left text-[var(--wh-ink)] hover:bg-[var(--wh-hover)] md:min-h-16">
            <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--wh-surface-muted)] font-bold">{initialOf(p.name)}</span>
            <span className="flex flex-col">
              <span className="text-size-17 font-semibold">{p.name}</span>
              <span className="text-size-13 text-[var(--wh-muted)]">{p.tillOnly ? `${p.role} · till only` : p.role}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

// The first letter of a name; a person icon where the name has none (as the drawing's [Name]).
function initialOf(name: string) {
  const letter = name.match(/\p{L}/u)?.[0];
  return letter && name.trim().startsWith(letter) ? letter.toUpperCase() : <User size={18} />;
}
