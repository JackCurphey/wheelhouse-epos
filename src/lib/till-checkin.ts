import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from './api/client.ts';

/**
 * Who is serving on this till, and who has checked in at the shop today
 * (openspec/changes/pins-and-checkin; signing in decision 4). The server
 * keeps the check-in in a cookie of its own, so this browser is the till
 * until "Set up this till" names tills.
 */
export type CheckedIn = { id: number; name: string };
/** Someone with no PIN yet, for the Owner serving to give one (openspec/changes/give-pin-at-till). */
export type GiveTo = { id: number; name: string; role: 'Staff' | 'Mechanic'; tillOnly: boolean };
export type TillCheckin = { serving: CheckedIn | null; checkedInToday: CheckedIn[]; givePin?: GiveTo[] };

export const CHECKIN_QUERY = ['till-checkin'];
// The float check asks the person checked in, so it is read again when that changes.
const FLOAT_QUERY = ['float-check'];

export function useTillCheckin() {
  // Read again when the till comes back into view, so a till left overnight
  // asks for a PIN in the morning (the check-in lasts the shop's day).
  return useQuery({ queryKey: CHECKIN_QUERY, queryFn: () => apiGet<TillCheckin>('/api/till-checkin'), retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true });
}

/** Check in, or take over, with a PIN alone; Switch, back to Enter your PIN; and after giving a PIN. */
export function useCheckinActions() {
  const queryClient = useQueryClient();
  const settle = (serving: CheckedIn | null) => {
    queryClient.setQueryData<TillCheckin>(CHECKIN_QUERY, (old) => {
      const today = old?.checkedInToday ?? [];
      // Who can be given a PIN is the Owner's to see, so it goes with whoever was serving.
      return { serving, checkedInToday: serving && !today.some((p) => p.id === serving.id) ? [...today, serving] : today, givePin: [] };
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
    /** A PIN was given at the till: the server ended this check-in, back to Enter your PIN. */
    gaveAPin() {
      settle(null);
    },
  };
}
