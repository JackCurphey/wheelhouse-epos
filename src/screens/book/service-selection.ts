import type { PortalFullService, PortalService, ServicesResponse } from './services-query.ts';

/**
 * The service list's rules, kept apart from the screens so they can be tested
 * directly and reused later (d4 needs the total minutes). Ticking a full
 * service locks the individual services it includes (Jack, 26 Sep: hint and
 * lock); the server refuses the pair too (piece 8, as changed by d2).
 * Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
 */

export const MAX_SERVICES = 10;
export const MAX_MINUTES = 720;

export type Notice = { id: number; text: string };

/** Every service in the order the list shows them: full, each category, then uncategorised. */
export function listOrder(data: ServicesResponse): PortalService[] {
  return [...data.full, ...data.categories.flatMap((c) => c.services), ...data.uncategorised];
}

/** The ticked services still on the list, in list order. */
export function chosenServices(data: ServicesResponse, ticked: number[]): PortalService[] {
  const set = new Set(ticked);
  return listOrder(data).filter((s) => set.has(s.id));
}

/** The first ticked full service, in list order, that includes `id`; null if none. */
export function lockedBy(data: ServicesResponse, ticked: number[], id: number): PortalFullService | null {
  return data.full.find((f) => ticked.includes(f.id) && f.includes.some((i) => i.id === id)) ?? null;
}

/**
 * Tap a service. A locked one is ignored (the same array comes back). Ticking
 * a full service takes off anything ticked that it includes, with a notice.
 * The notice names the removed service from the full service's own
 * `includes` list, not from the flattened list order - a ticked id can be
 * stale (present in `includes` but no longer among the individual sections),
 * and the flattened list wouldn't have a name for it (controller ruling, 26 Sep).
 */
export function toggle(data: ServicesResponse, ticked: number[], id: number): { ticked: number[]; notices: Notice[] } {
  if (ticked.includes(id)) return { ticked: ticked.filter((t) => t !== id), notices: [] };
  if (lockedBy(data, ticked, id)) return { ticked, notices: [] };
  const full = data.full.find((f) => f.id === id);
  const takenOff = full ? ticked.filter((t) => full.includes.some((i) => i.id === t)) : [];
  const next = new Set([...ticked.filter((t) => !takenOff.includes(t)), id]);
  return {
    ticked: listOrder(data).map((s) => s.id).filter((s) => next.has(s)),
    notices: full
      ? takenOff.map((t) => ({
          id: t,
          text: `${full.includes.find((i) => i.id === t)!.name} is part of your ${full.name}, so we've taken it off`,
        }))
      : [],
  };
}

/** "Includes A, B, C and N more", names as the shop typed them; null when it includes nothing. */
export function includesLine(full: PortalFullService): string | null {
  const names = full.includes.map((i) => i.name);
  if (names.length === 0) return null;
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `Includes ${shown} and ${names.length - 3} more` : `Includes ${shown}`;
}

/** Pounds, with pence only when there are any: £80, £22.50. Summed in pence to avoid float drift. */
export function formatMoney(amount: number): string {
  const pence = Math.round(amount * 100);
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

export const formatFrom = (price: number) => `From ${formatMoney(price)}`;

/** "2 services · from £95", or "2 services" when prices are hidden; "" when nothing is ticked. */
export function summary(data: ServicesResponse, ticked: number[]): string {
  const chosen = chosenServices(data, ticked);
  if (chosen.length === 0) return '';
  const count = chosen.length === 1 ? '1 service' : `${chosen.length} services`;
  if (!data.showPrices || chosen.some((s) => s.price === null)) return count;
  const pence = chosen.reduce((sum, s) => sum + Math.round((s.price as number) * 100), 0);
  return `${count} · from ${formatMoney(pence / 100)}`;
}

export function totalMinutes(data: ServicesResponse, ticked: number[]): number {
  return chosenServices(data, ticked).reduce((sum, s) => sum + (s.minutes ?? 0), 0);
}

/** Why Continue can't go on yet, checked in this order; null when it can. */
export function continueError(data: ServicesResponse, ticked: number[]): string | null {
  const chosen = chosenServices(data, ticked);
  if (chosen.length === 0) return 'Choose at least one service';
  if (chosen.length > MAX_SERVICES) return `You can book up to ${MAX_SERVICES} services at once`;
  if (totalMinutes(data, ticked) > MAX_MINUTES) return "That's too much work for one visit - please book the jobs separately";
  return null;
}
