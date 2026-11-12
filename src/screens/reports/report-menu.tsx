import { useEffect, useRef, useState } from 'react';

/**
 * The "…" menu on one of your own saved reports (rp-report-menu in generator/reports.mjs `menuBtn` and the
 * open menu; audit M6): "More for [name]" with Rename, Share with managers and Delete in the danger colour.
 * Share is greyed with its reason until staff roles bring managers (decision 9). A real menu: it opens on its
 * first item, the arrow keys move, Escape or a click outside closes it and Escape puts the focus back.
 */
const NO_MANAGERS = 'there are no managers until staff roles are set up';
const ITEM = 'flex min-h-11 w-full items-center rounded-md border-0 bg-transparent px-3 text-left text-size-15 font-semibold';

export function ReportMenu({ name, onRename, onDelete }: { name: string; onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && e.target !== button.current) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  function keys(e: React.KeyboardEvent) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(at + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus(); }
  }
  const choose = (act: () => void) => () => { setOpen(false); act(); };
  return (
    <div className="relative">
      <button
        ref={button} type="button" aria-label={`More for ${name}`} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} className="h-11 w-11 shrink-0 rounded-lg border-0 bg-transparent text-xl font-bold text-[var(--wh-ink)]"
      ><span aria-hidden="true">…</span></button>
      {open ? (
        <div ref={menu} role="menu" aria-label={name} onKeyDown={keys}
          className="absolute right-0 top-12 z-10 w-60 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1.5 shadow-modal">
          <button type="button" role="menuitem" className={`${ITEM} text-[var(--wh-ink)]`} onClick={choose(onRename)}>Rename</button>
          <button type="button" role="menuitem" aria-disabled="true" aria-description={NO_MANAGERS} className={`${ITEM} cursor-not-allowed text-[var(--wh-muted)] line-through`}>Share with managers</button>
          <span className="px-3 pb-1 text-size-13-5 text-[var(--wh-muted)]">{NO_MANAGERS}</span>
          <button type="button" role="menuitem" className={`${ITEM} text-[var(--wh-danger)]`} onClick={choose(onDelete)}>Delete</button>
        </div>
      ) : null}
    </div>
  );
}
