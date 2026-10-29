import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from './api/client.ts';

/**
 * Who is serving on this till, who has checked in on it today, and which
 * till this browser is (openspec/changes/pins-and-checkin, till-setup;
 * signing in decision 4). The server keeps the check-in and the till in
 * cookies of their own; a browser that isn't a set-up till has no till.
 */
export type CheckedIn = { id: number; name: string };
/** Someone with no PIN yet, for the Owner serving to give one (openspec/changes/give-pin-at-till). */
export type GiveTo = { id: number; name: string; role: 'Staff' | 'Mechanic'; tillOnly: boolean };
/** This browser's till, from Set up this till (openspec/changes/till-setup). */
export type ThisTillName = { code: string; name: string | null; siteName: string };
/** This browser's workshop computer (openspec/changes/workshop-computer). */
export type ThisWorkshop = { name: string | null; siteName: string };
/** `idleMinutes`: how long a workshop computer waits before going back, null for never (openspec/changes/trust-pin-workshop). */
export type TillCheckin = { serving: CheckedIn | null; checkedInToday: CheckedIn[]; givePin?: GiveTo[]; till?: ThisTillName | null; workshop?: ThisWorkshop | null; idleMinutes?: number | null };

export const CHECKIN_QUERY = ['till-checkin'];
// The float check asks the person checked in, so it is read again when that changes.
const FLOAT_QUERY = ['float-check'];
// useSession's (src/lib/auth/use-session.ts).
const SESSION_QUERY = ['session'];

export function useTillCheckin(enabled = true) {
  // Read again when the till comes back into view, so a till left overnight
  // asks for a PIN in the morning (the check-in lasts the shop's day), and
  // every minute, so a workshop computer the server has stopped counting
  // goes back to Enter your PIN (workshop-computer design 2).
  return useQuery({ queryKey: CHECKIN_QUERY, queryFn: () => apiGet<TillCheckin>('/api/till-checkin'), retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true, enabled });
}

/** Check in, or take over, with a PIN alone; Switch, back to Enter your PIN; and after giving a PIN. */
export function useCheckinActions() {
  const queryClient = useQueryClient();
  const settle = (serving: CheckedIn | null) => {
    queryClient.setQueryData<TillCheckin>(CHECKIN_QUERY, (old) => {
      const today = old?.checkedInToday ?? [];
      // Who can be given a PIN is the Owner's to see, so it goes with whoever was serving.
      return { serving, checkedInToday: serving && !today.some((p) => p.id === serving.id) ? [...today, serving] : today, givePin: [], till: old?.till ?? null, workshop: old?.workshop ?? null, idleMinutes: old?.idleMinutes };
    });
    void queryClient.invalidateQueries({ queryKey: CHECKIN_QUERY });
    void queryClient.invalidateQueries({ queryKey: FLOAT_QUERY });
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY });
  };
  return {
    async checkIn(pin: string) {
      const { serving } = await apiMutate<{ serving: CheckedIn }>('/api/till-checkin', { pin });
      // Who is signed in is read again first: on a workshop computer the
      // Owner's pages follow the person working (workshop-computer design 9),
      // so the menu never shows the last person's for a moment.
      await queryClient.refetchQueries({ queryKey: SESSION_QUERY }).catch(() => {});
      settle(serving);
    },
    async switchServing() {
      await apiMutate('/api/till-checkin/end', {});
      settle(null);
    },
    /**
     * Someone is using the workshop computer: their 10 minutes start again on
     * the server. If it has already stopped counting them, back to Enter your PIN.
     */
    async stillHere() {
      const { serving } = await apiMutate<{ serving: CheckedIn | null }>('/api/till-checkin/active', {});
      if (!serving) settle(null);
    },
    /**
     * The workshop computer was left alone for 10 minutes: back to Enter your
     * PIN, even if the server can't be told just now (it ends it by itself).
     */
    idleOut() {
      void apiMutate('/api/till-checkin/end', {}).catch(() => {}).finally(() => settle(null));
    },
    /** A PIN was given at the till: the server ended this check-in, back to Enter your PIN. */
    gaveAPin() {
      settle(null);
    },
  };
}
