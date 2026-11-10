import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The shop's privacy notice (GET /api/portal/:shopSlug/privacy, finish-account
 * design 7): its words, or a 404 when the shop hasn't added one. Shared by the
 * account's Your data link and the notice's own page.
 */
export type PrivacyNotice = { shopName: string; text: string };

export function usePrivacyNotice(shopSlug: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'privacy'],
    queryFn: () => apiGet<PrivacyNotice>(`/api/portal/${encodeURIComponent(shopSlug)}/privacy`),
    retry: false,
    refetchOnWindowFocus: false,
  });
}
