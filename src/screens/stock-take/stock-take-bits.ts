import { useState, type KeyboardEvent } from 'react';
import { ROUTES } from '@/staff/routes.ts';
import { day } from '@/screens/deliveries/deliveries-bits.tsx';

/** Pieces shared by Stock take and its counting page (openspec/changes/stock-take). */
export type Kind = 'whole_shop' | 'category' | 'area' | 'below_zero';
export type Take = { id: number; kind: Kind; target: string; label: string; status: 'counting' | 'applied'; startedAt: string; startedBy: string; appliedAt: string | null; appliedBy: string | null };
export type Applied = Take & { productsChanged: number; valuePence: number };

export const countHref = (id: number) => ROUTES['tk-count'].replace(':id', String(id));
export const checkHref = (id: number) => ROUTES['tk-diff'].replace(':id', String(id));
export const appliedHref = (id: number) => ROUTES['tk-applied'].replace(':id', String(id));

// Pence as "£28.00".
export const pounds = (pence: number) => `£${(Math.abs(pence) / 100).toFixed(2)}`;
// A total at cost: "£28.00 under, at cost" (drawn on tk-hub and tk-diff).
export const atCost = (pence: number) => (pence === 0 ? '£0.00, at cost' : `${pounds(pence)} ${pence < 0 ? 'under' : 'over'}, at cost`);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Arrow keys through a list of matches under a box (review, 28 Oct): Down
 * and Up move the active option, shown to screen readers through the box's
 * aria-activedescendant; Enter picks it. `index` is -1 while none is active
 * (and whenever the list has changed under it, through `reset`).
 */
export function useActiveOption(count: number) {
  const [active, setActive] = useState(-1);
  const index = active < count ? active : -1;
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, pick: (i: number) => void): boolean {
    if (count === 0) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(index < 0 ? (step > 0 ? 0 : count - 1) : (index + step + count) % count);
      return true;
    }
    if (e.key === 'Enter' && index >= 0) {
      e.preventDefault();
      pick(index);
      setActive(-1);
      return true;
    }
    return false;
  }
  return { index, onKeyDown, reset: () => setActive(-1) };
}

// "Jo Taylor and Alex Morgan"; "A, B and C".
export const names = (ns: string[]) => (ns.length < 2 ? ns.join('') : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);

// When a count started, in the shop's time: "10:30" today, else "Tue 1 Sep, 10:30".
const LONDON = 'Europe/London';
export function started(iso: string, now = new Date()) {
  const time = new Date(iso).toLocaleTimeString('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit' });
  const sameDay = new Date(iso).toLocaleDateString('en-GB', { timeZone: LONDON }) === now.toLocaleDateString('en-GB', { timeZone: LONDON });
  return sameDay ? time : `${day(iso)}, ${time}`;
}
