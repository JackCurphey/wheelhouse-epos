import * as React from 'react';

/**
 * The booking in progress, shared by the six book screens (Jack, 26 Sep: it
 * survives a refresh in that tab). Everything but photos is kept in the tab's
 * sessionStorage under wh-book-draft:<shopSlug> until the booking is sent or
 * the tab closes. Photos are too large to store, so they live in memory only
 * and must be re-added after a reload. If the browser refuses storage, the
 * draft still works for the life of the page.
 *
 * Kept for later too (Jack, 1 Oct, book a repair decision 9; bk-resume;
 * openspec/changes/booking-draft-resume): a copy on the device
 * (localStorage, wh-book-draft-later:<shopSlug>) with when it was saved and
 * the step it was on, for 7 days. A new tab or visit with nothing in the tab
 * brings it back and says so (`resumed`); a refresh in the same tab doesn't.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 * d3 (bikeNote, hadPhotos): docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
 */

// Each answer names its service (server piece 7).
export type Answer = { serviceId: number; questionId: string; text?: string; choice?: string; notSure?: true };

export type BookingDraft = {
  // The ticked services, in list order (d2). Minutes are derived from these
  // and /services when needed, never stored. A draft saved before d2 has no
  // serviceIds and so counts as no service chosen.
  serviceIds?: number[];
  notSure?: boolean;
  answers?: Answer[];
  // The bike in the customer's own words, sent as a note on the booking, not
  // a bike record: staff create the real bike at check-in (d3; server piece 9).
  bikeNote?: string;
  description?: string;
  // Photos were added in this tab. They live in memory only, so after a
  // refresh the problem screen says they were cleared (d3).
  hadPhotos?: boolean;
  // The spending limit (Workshop day 41): Go ahead chosen, and the amount
  // box as typed (whole pounds; £200 when untouched). Absent: ask first.
  limitOn?: true;
  limitText?: string;
  // The date screen (d4): the day, and always a real mechanic. A drop-off
  // day stores no startTime. anyMechanic (drop-off only, Jack, 26 Sep,
  // .superpowers/sdd/d4-followups/brief.md) records that the customer chose
  // "Any mechanic" - mechanicId still holds a real, resolved mechanic (the
  // server needs one), re-resolved silently if it stops being bookable.
  // Picking a named mechanic, a new day, or a timed time clears it.
  date?: string;
  mechanicId?: number;
  anyMechanic?: true;
  startTime?: string;
  name?: string;
  phone?: string;
  email?: string;
  updateChannel?: 'email' | 'sms' | 'whatsapp';
  termsAccepted?: boolean;
  marketingPermission?: boolean;
  // Made on the first Send and sent on every retry, so the server makes the
  // booking once however many times it is sent (WP-0.2). Kept through a
  // refresh; cleared with the rest of the draft once the booking is made.
  requestKey?: string;
  // The deposit's hold (the provider's ref) once its card was accepted
  // (deposit-pay-screen), so a retry or a refresh sends without paying
  // again; a new hold has a new ref, so it's paid afresh.
  depositHeld?: string;
};

type DraftApi = {
  draft: BookingDraft;
  photos: File[];
  update: (patch: Partial<BookingDraft>) => void;
  setPhotos: (files: File[]) => void;
  clear: () => void;
  /** Brought back from an earlier visit, until Carry on or Start again. */
  resumed: boolean;
  /** The step it was left on (the address after /book/<shopSlug>), once, when resumed. */
  takeResumeStep: () => string | null;
  dismissResume: () => void;
  /** Records the step the customer is on, for coming back later. */
  markStep: (step: string) => void;
};

/** How long a booking in progress is kept on the device (decided while building, 24 Oct). */
export const KEEP_DAYS = 7;
export const laterKey = (shopSlug: string) => `wh-book-draft-later:${shopSlug}`;
type Later = { draft: BookingDraft; savedAt: string; step?: string };

// The kept copy, if it's a real one and young enough; an old or broken one is removed.
function readLater(shopSlug: string): Later | null {
  try {
    const raw = window.localStorage.getItem(laterKey(shopSlug));
    if (!raw) return null;
    let later: Later | null = null;
    try { later = JSON.parse(raw) as Later; } catch { later = null; }
    const fresh = later && typeof later === 'object' && later.draft && typeof later.draft === 'object' && !Array.isArray(later.draft)
      && Date.now() - Date.parse(later.savedAt) < KEEP_DAYS * 86_400_000;
    if (!fresh) { window.localStorage.removeItem(laterKey(shopSlug)); return null; }
    return later;
  } catch {
    return null;
  }
}

function writeLater(shopSlug: string, draft: BookingDraft, step: string | undefined) {
  try {
    if (Object.keys(draft).length === 0) window.localStorage.removeItem(laterKey(shopSlug));
    else window.localStorage.setItem(laterKey(shopSlug), JSON.stringify({ draft, savedAt: new Date().toISOString(), ...(step !== undefined ? { step } : {}) }));
  } catch {
    // Storage refused: nothing is kept for later.
  }
}

function hasStored(shopSlug: string): boolean {
  try { return window.sessionStorage.getItem(draftKey(shopSlug)) !== null; } catch { return false; }
}

export const draftKey = (shopSlug: string) => `wh-book-draft:${shopSlug}`;

function readStored(shopSlug: string): BookingDraft {
  try {
    const raw = window.sessionStorage.getItem(draftKey(shopSlug));
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn(`wh-book-draft: stored draft for "${shopSlug}" is not an object; starting fresh in memory`);
        return {};
      }
      return parsed as BookingDraft;
    } catch {
      console.warn(`wh-book-draft: stored draft for "${shopSlug}" is not valid JSON; starting fresh in memory`);
      return {};
    }
  } catch {
    return {};
  }
}

function writeStored(shopSlug: string, draft: BookingDraft) {
  try {
    if (Object.keys(draft).length === 0) window.sessionStorage.removeItem(draftKey(shopSlug));
    else window.sessionStorage.setItem(draftKey(shopSlug), JSON.stringify(draft));
  } catch {
    // Storage refused (e.g. some private modes): the draft lives in memory only.
  }
}

const DraftContext = React.createContext<DraftApi | null>(null);

export function DraftProvider({ shopSlug, children }: { shopSlug: string; children: React.ReactNode }) {
  // The tab's copy first; with none, a copy kept from an earlier visit, brought into the tab.
  const [start] = React.useState(() => {
    if (hasStored(shopSlug)) return { draft: readStored(shopSlug), later: null as Later | null };
    const later = readLater(shopSlug);
    if (later && Object.keys(later.draft).length) writeStored(shopSlug, later.draft);
    return { draft: later?.draft ?? {}, later };
  });
  const [draft, setDraft] = React.useState<BookingDraft>(start.draft);
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [resumed, setResumed] = React.useState(Boolean(start.later && Object.keys(start.later.draft).length));
  const step = React.useRef<string | undefined>(start.later?.step);
  // The first screen goes to the step left on once, not every time it's opened.
  const stepTaken = React.useRef(false);
  const changed = React.useRef(false);

  React.useEffect(() => {
    if (!changed.current) return;
    writeStored(shopSlug, draft);
    writeLater(shopSlug, draft, step.current);
  }, [shopSlug, draft]);

  const api = React.useMemo<DraftApi>(
    () => ({
      draft,
      photos,
      update: (patch) => {
        changed.current = true;
        setDraft((prev) => ({ ...prev, ...patch }));
      },
      setPhotos,
      clear: () => {
        changed.current = true;
        setDraft({});
        setPhotos([]);
        setResumed(false);
      },
      resumed,
      takeResumeStep: () => {
        if (!resumed || stepTaken.current) return null;
        stepTaken.current = true;
        return start.later?.step || null;
      },
      dismissResume: () => setResumed(false),
      markStep: (at) => {
        if (step.current === at) return;
        step.current = at;
        if (Object.keys(draft).length) writeLater(shopSlug, draft, at);
      },
    }),
    [draft, photos, resumed, shopSlug, start],
  );

  return <DraftContext.Provider value={api}>{children}</DraftContext.Provider>;
}

/** The draft, or null outside a booking (a frame shown on its own). */
export function useOptionalDraft(): DraftApi | null {
  return React.useContext(DraftContext);
}

export function useDraft(): DraftApi {
  const api = React.useContext(DraftContext);
  if (!api) throw new Error('useDraft must be used inside a DraftProvider');
  return api;
}
