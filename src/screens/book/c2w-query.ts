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

/**
 * One of the signed-in customer's own orders (GET
 * /api/portal/:shopSlug/c2w-orders[/:id]): the same fields as the link, its
 * id, and the till sale it was collected with, if any.
 */
export type C2wOrder = C2wView & { id: number; saleId: number | null };

const once = { retry: false, refetchOnWindowFocus: false } as const;
const portal = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}`;

export function useC2wOrders(shopSlug: string) {
  return useQuery({
    queryKey: ['account', shopSlug, 'c2w-orders'],
    queryFn: () => apiGet<C2wOrder[]>(`${portal(shopSlug)}/c2w-orders`),
    ...once,
  });
}

export function useC2wOrder(shopSlug: string, id: string) {
  return useQuery({
    queryKey: ['account', shopSlug, 'c2w-orders', id],
    queryFn: () => apiGet<C2wOrder>(`${portal(shopSlug)}/c2w-orders/${encodeURIComponent(id)}`),
    enabled: /^\d+$/.test(id),
    ...once,
  });
}

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
