import * as React from 'react';

/**
 * The booking in progress, shared by the six book screens (Jack, 26 Sep: it
 * survives a refresh in that tab). Everything but photos is kept in the tab's
 * sessionStorage under wh-book-draft:<shopSlug> until the booking is sent or
 * the tab closes. Photos are too large to store, so they live in memory only
 * and must be re-added after a reload. If the browser refuses storage, the
 * draft still works for the life of the page.
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
  // The date screen (d4): the day, and always a real mechanic ("Any
  // mechanic" is resolved on Continue and never stored). A drop-off day
  // stores no startTime.
  date?: string;
  mechanicId?: number;
  startTime?: string;
  name?: string;
  phone?: string;
  email?: string;
  updateChannel?: 'email' | 'sms' | 'whatsapp';
  termsAccepted?: boolean;
  marketingPermission?: boolean;
};

type DraftApi = {
  draft: BookingDraft;
  photos: File[];
  update: (patch: Partial<BookingDraft>) => void;
  setPhotos: (files: File[]) => void;
  clear: () => void;
};

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
  const [draft, setDraft] = React.useState<BookingDraft>(() => readStored(shopSlug));
  const [photos, setPhotos] = React.useState<File[]>([]);
  const changed = React.useRef(false);

  React.useEffect(() => {
    if (!changed.current) return;
    writeStored(shopSlug, draft);
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
      },
    }),
    [draft, photos],
  );

  return <DraftContext.Provider value={api}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftApi {
  const api = React.useContext(DraftContext);
  if (!api) throw new Error('useDraft must be used inside a DraftProvider');
  return api;
}
