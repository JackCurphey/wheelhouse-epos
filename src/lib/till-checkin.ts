import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from './api/client.ts';

/**
 * Who is serving on this till, and who has checked in at the shop today
 * (openspec/changes/pins-and-checkin; signing in decision 4). The server
 * keeps the check-in in a cookie of its own, so this browser is the till
 * until "Set up this till" names tills.
 */
export type CheckedIn = { id: number; name: string };
export type TillCheckin = { serving: CheckedIn | null; checkedInToday: CheckedIn[] };

export const CHECKIN_QUERY = ['till-checkin'];
// The float check asks the person checked in, so it is read again when that changes.
const FLOAT_QUERY = ['float-check'];

export function useTillCheckin() {
  // Read again when the till comes back into view, so a till left overnight
  // asks for a PIN in the morning (the check-in lasts the shop's day).
  return useQuery({ queryKey: CHECKIN_QUERY, queryFn: () => apiGet<TillCheckin>('/api/till-checkin'), retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true });
}

/** Check in, or take over, with a PIN alone; and Switch, back to Enter your PIN. */
export function useCheckinActions() {
  const queryClient = useQueryClient();
  const settle = (serving: CheckedIn | null) => {
    queryClient.setQueryData<TillCheckin>(CHECKIN_QUERY, (old) => {
      const today = old?.checkedInToday ?? [];
      return { serving, checkedInToday: serving && !today.some((p) => p.id === serving.id) ? [...today, serving] : today };
    });
    void queryClient.invalidateQueries({ queryKey: CHECKIN_QUERY });
    void queryClient.invalidateQueries({ queryKey: FLOAT_QUERY });
  };
  return {
    async checkIn(pin: string) {
      const { serving } = await apiMutate<{ serving: CheckedIn }>('/api/till-checkin', { pin });
      settle(serving);
    },
    async switchServing() {
      await apiMutate('/api/till-checkin/end', {});
      settle(null);
    },
  };
}
