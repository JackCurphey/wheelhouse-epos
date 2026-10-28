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

// "Jo Taylor and Alex Morgan"; "A, B and C".
export const names = (ns: string[]) => (ns.length < 2 ? ns.join('') : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);

// When a count started, in the shop's time: "10:30" today, else "Tue 1 Sep, 10:30".
const LONDON = 'Europe/London';
export function started(iso: string, now = new Date()) {
  const time = new Date(iso).toLocaleTimeString('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit' });
  const sameDay = new Date(iso).toLocaleDateString('en-GB', { timeZone: LONDON }) === now.toLocaleDateString('en-GB', { timeZone: LONDON });
  return sameDay ? time : `${day(iso)}, ${time}`;
}
