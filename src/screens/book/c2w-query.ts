import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * A Cycle to Work order read through its private link, with no sign-in
 * (GET /api/portal/:shopSlug/c2w-links/:code, server/routes/portal.js; the
 * allowed fields from server/c2w/customer-view.js). 404 when the code finds
 * nothing. `state` says whether the bike is put aside before the certificate:
 * 'held', 'released', 'cancelled' for a cancelled order, or null.
 */
export type C2wView = {
  quoteRef: string;
  shopName: string;
  /** The site, only for a shop with more than one. */
  place: string | null;
  providerName: string;
  stage: string;
  /** Which of `stages` the order is at; null once cancelled. */
  stageIndex: number | null;
  stages: string[];
  state: 'held' | 'released' | 'cancelled' | null;
  /** The day the hold ends, YYYY-MM-DD, while held. */
  holdUntil: string | null;
  bike: string;
  accessories: string[];
  totalPence: number;
  customerPaysPence: number | null;
  collectedAt: string | null;
  howToApply: string | null;
};

export function useC2wLink(shopSlug: string, code: string) {
  return useQuery({
    queryKey: ['c2w-link', shopSlug, code],
    queryFn: () =>
      apiGet<C2wView>(
        `/api/portal/${encodeURIComponent(shopSlug)}/c2w-links/${encodeURIComponent(code)}`,
      ),
    enabled: Boolean(shopSlug && code),
    // A 404 is the answer (a wrong link), not a fault to retry.
    retry: false,
    refetchOnWindowFocus: false,
  });
}
