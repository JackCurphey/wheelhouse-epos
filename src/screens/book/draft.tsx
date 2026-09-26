import * as React from 'react';

/**
 * The booking in progress, shared by the six book screens (Jack, 26 Sep: it
 * survives a refresh in that tab). Everything but photos is kept in the tab's
 * sessionStorage under wh-book-draft:<shopSlug> until the booking is sent or
 * the tab closes. Photos are too large to store, so they live in memory only
 * and must be re-added after a reload. If the browser refuses storage, the
 * draft still works for the life of the page.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */

export type Answer = { questionId: string; text?: string; choice?: string; notSure?: true };

export type BookingDraft = {
  serviceId?: number;
  notSure?: boolean;
  serviceName?: string;
  serviceMinutes?: number;
  answers?: Answer[];
  bike?: { make: string; model: string; colour: string };
  description?: string;
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
    return raw ? (JSON.parse(raw) as BookingDraft) : {};
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

  React.useEffect(() => {
    writeStored(shopSlug, draft);
  }, [shopSlug, draft]);

  const api = React.useMemo<DraftApi>(
    () => ({
      draft,
      photos,
      update: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      setPhotos,
      clear: () => {
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
