import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The shop's bookable services (GET /api/portal/:shopSlug/services), shared
 * through React Query: the frame reads shopName from it and the service
 * screens read the lists. Shapes match server/server.js and
 * server/service-questions.js.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */
export type PortalQuestion =
  | { id: string; wording: string; kind: 'text'; required: boolean }
  | { id: string; wording: string; kind: 'choice'; required: boolean; choices: string[]; allowNotSure: boolean };

export type PortalService = { id: number; name: string; price: number | null; minutes: number; questions: PortalQuestion[] };

/** A full service also names the services it includes (server piece 8). */
export type PortalFullService = PortalService & { includes: { id: number; name: string }[] };

export type ServicesResponse = {
  shopName: string;
  showPrices: boolean;
  full: PortalFullService[];
  categories: { id: number; name: string; services: PortalService[] }[];
  uncategorised: PortalService[];
};

export const servicesPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/services`;

/** Shared with the details screen, which replaces the cached copy with a fresh one just before sending. */
export const servicesQueryKey = (shopSlug: string) => ['portal', shopSlug, 'services'] as const;

export function useServices(shopSlug: string) {
  return useQuery({
    queryKey: servicesQueryKey(shopSlug),
    queryFn: () => apiGet<ServicesResponse>(servicesPath(shopSlug)),
  });
}
