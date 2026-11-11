import { createContext, useContext, useState, type ReactNode } from 'react';
import { Check, TriangleAlert } from 'lucide-react';

/**
 * Settings' one note after a change (owner setup decision 17, H4; drawn as
 * settings-frame.mjs toastHtml, on set-till-quick-saved and set-save-failed):
 * a dark note floating at the foot of the page, a tick and "Saved · …" with
 * Undo, or a warning and what went wrong with Try again. Any fold shows one
 * with `useSavedNote()`; the newest replaces the last. The status area is
 * always on the page and its words are swapped in, so a screen reader
 * announces each one.
 */
export type SavedNote = { text: string; failed?: boolean; action?: { label: string; run: () => void } };
const ShowNote = createContext<(note: SavedNote | null) => void>(() => {});
export const useSavedNote = () => useContext(ShowNote);

export function SavedNoteArea({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<SavedNote | null>(null);
  return (
    <ShowNote.Provider value={setNote}>
      {children}
      <div role="status" data-saved-note>
        {note ? (
          <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-[10px] bg-[var(--wh-ink)] py-1.5 pr-1.5 pl-4 text-sm text-white shadow-[0_8px_24px_rgba(38,36,32,0.25)] max-md:right-3 max-md:bottom-3 max-md:left-3 max-md:translate-x-0">
            <span className="inline-flex grow items-center gap-2">
              {note.failed ? <TriangleAlert size={16} aria-hidden="true" className="shrink-0" /> : <Check size={16} aria-hidden="true" className="shrink-0" />}
              {note.text}
            </span>
            {note.action ? (
              <button type="button" onClick={note.action.run} className="min-h-11 rounded-lg border-0 bg-[rgba(255,255,255,0.14)] px-3.5 text-sm font-bold whitespace-nowrap text-white">
                {note.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ShowNote.Provider>
  );
}
