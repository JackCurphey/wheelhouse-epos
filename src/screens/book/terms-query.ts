import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The booking terms a customer agrees to (server piece 11,
 * GET /api/portal/:shopSlug/terms): the shop's own when it has set them, else
 * the standard Wheelhouse terms; `standard` says which. Plain text, a line
 * break between items. A copy is saved with each booking by the server.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export type TermsResponse = { title: string; text: string; standard: boolean };

export const termsPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/terms`;

export function useTerms(shopSlug: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'terms'],
    queryFn: () => apiGet<TermsResponse>(termsPath(shopSlug)),
  });
}
