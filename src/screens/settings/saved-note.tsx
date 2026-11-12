import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, CircleAlert } from 'lucide-react';

/**
 * Settings' one note after a change (owner setup decision 17, H4; drawn as
 * settings-frame.mjs toastHtml, on set-till-quick-saved and set-save-failed):
 * a dark note at the foot of the Settings content area, a tick and "Saved · …"
 * with Undo, or the circled "!" and what went wrong with Try again. Any fold
 * shows one with `useSavedNote().show`; the newest replaces the last, and a
 * new room starts with none. While a save is under way the note stays, its
 * button off (`busy`). The status area is always on the page and its words
 * are swapped in, so a screen reader announces each one; focus in the note
 * goes back to the setting that changed. While a note shows, space under the
 * page as tall as the note and the gap below it (measured) lets the last fold
 * scroll clear of it (logged).
 */
type Back = () => HTMLElement | null;
export type SavedNote = { text: string; failed?: boolean; action?: { label: string; run: () => void }; owner?: object; back?: Back };
type ShowNote = { show: (note: SavedNote) => void; busy: (back?: Back) => void; owner: object | null };
const ShowNoteContext = createContext<ShowNote>({ show: () => {}, busy: () => {}, owner: null });
export const useSavedNote = () => useContext(ShowNoteContext);

const px = (v: string) => parseFloat(v) || 0;

export function SavedNoteArea({ room, className, children }: { room: string; className: string; children: ReactNode }) {
  const [note, setNote] = useState<(SavedNote & { busy?: boolean }) | null>(null);
  const [forRoom, setForRoom] = useState(room);
  if (room !== forRoom) { setForRoom(room); setNote(null); }
  const frame = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const [space, setSpace] = useState(0);

  const owner = note?.owner ?? null;
  const api = useMemo<ShowNote>(() => {
    const focusBack = (back?: Back) => { if (back && shown.current?.contains(document.activeElement)) back()?.focus(); };
    return {
      owner,
      show: (next) => { focusBack(next.back); setNote(next); },
      busy: (back) => { focusBack(back); setNote((n) => (n ? { ...n, busy: true } : n)); },
    };
  }, [owner]);

  // Where the drawing puts it: inside the content area's padding, 24px above
  // its foot and centred on a computer; 12px in at each side and the foot on a phone.
  useLayoutEffect(() => {
    if (!note) return;
    const measure = () => {
      const f = frame.current;
      if (!f) return;
      const r = f.getBoundingClientRect();
      const s = getComputedStyle(f);
      const main = f.closest('main');
      // The main area runs to the foot of the screen, as the drawing's does.
      const height = window.innerHeight;
      const phone = !(window.matchMedia?.('(min-width: 768px)').matches ?? true);
      const left = r.left + px(s.paddingLeft);
      const right = r.right - px(s.paddingRight);
      const bottom = (main ? px(getComputedStyle(main).paddingBottom) : 0) + px(s.paddingBottom) + (phone ? 12 : 24);
      setPlace(phone
        ? { left: left + 12, right: document.documentElement.clientWidth - right + 12, bottom }
        : { left: (left + right) / 2, bottom, transform: 'translateX(-50%)', maxWidth: right - left });
      const el = shown.current;
      if (el) setSpace(Math.max(0, Math.ceil(height - el.getBoundingClientRect().top)));
    };
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (shown.current) watch?.observe(shown.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { watch?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [note]);

  return (
    <ShowNoteContext.Provider value={api}>
      <div ref={frame} data-settings-frame className={className}>{children}</div>
      {note ? <div data-saved-note-space aria-hidden="true" style={{ height: space }} className="shrink-0" /> : null}
      <div role="status" data-saved-note>
        {note ? (
          <div ref={shown} style={place ?? { visibility: 'hidden' }} className="fixed z-40 flex items-center gap-3 rounded-[10px] bg-[var(--wh-ink)] py-1.5 pr-1.5 pl-4 text-sm text-[var(--wh-on-brand)] shadow-[var(--wh-shadow-note)]">
            <span className="inline-flex grow items-center gap-2">
              {note.failed ? <CircleAlert size={16} aria-hidden="true" className="shrink-0" /> : <Check size={16} aria-hidden="true" className="shrink-0" />}
              {note.text}
            </span>
            {note.action ? (
              // Pressing it keeps focus where it was, so a box being typed in
              // isn't left (and saved) before the click lands.
              <button type="button" disabled={note.busy} onMouseDown={(e) => e.preventDefault()} onClick={note.action.run} className="min-h-11 rounded-[8px] border-0 bg-[var(--wh-on-ink-tint)] px-3.5 text-sm font-bold whitespace-nowrap text-[var(--wh-on-brand)] disabled:opacity-60">
                {note.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ShowNoteContext.Provider>
  );
}
