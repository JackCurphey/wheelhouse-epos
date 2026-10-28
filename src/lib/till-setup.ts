import { useQuery } from '@tanstack/react-query';
import { apiGet } from './api/client.ts';

/**
 * Set up this till's data (openspec/changes/till-setup): the shop's sites
 * with the till numbers used at each, which till this browser is, and the
 * active tills' codes. The Owner's only.
 */
export type SetupSite = { id: number; name: string; code: string; taken: number[] };
export type ThisTill = { id: number; code: string; name: string | null; siteName: string };
export type TillSetup = { sites: SetupSite[]; thisTill: ThisTill | null; tills: string[] };
export const SETUP_QUERY = ['till-setup'];

export function useTillSetup() {
  return useQuery({ queryKey: SETUP_QUERY, queryFn: () => apiGet<TillSetup>('/api/till-setup'), retry: false });
}
