import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The date screen's data (d4), shared through React Query like /services.
 * Shapes match server/server.js on server piece 10
 * (GET /api/portal/:shopSlug/mechanics and /availability) and
 * server/capacity.js. With `minutes`, /availability returns `days`: per date
 * the shop's mode, and per mechanic the start times (timed) or whether the job
 * fits (drop-off). Nothing earlier than the shop's minimum notice is offered
 * (piece 10). `busy` is the old page's view: booked time, closures and a
 * shorter day, with no reason attached.
 * Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
 */
export type PortalMechanic = { id: number; name: string; workingDays: number[] };

export type MechanicsResponse = {
  mechanics: PortalMechanic[];
  // The shop's widest hours; a shorter day comes back from /availability as busy time.
  openingTime: string;
  closingTime: string;
  openingDays: number[];
};

export type BusyBlock = { mechanicId: number; jobDate: string; startTime: string; endTime: string };

export type TimedDay = { date: string; mode: 'timed'; mechanics: { mechanicId: number; startTimes: string[] }[] };

export type DropoffDay = {
  date: string;
  mode: 'dropoff';
  dropoffWindow: { start: string; end: string };
  mechanics: { mechanicId: number; bookable: boolean }[];
};

export type AvailabilityDay = TimedDay | DropoffDay;

export type AvailabilityResponse = {
  busy: BusyBlock[];
  fullDays: { mechanicId: number; jobDate: string }[];
  days: AvailabilityDay[];
};

export type AvailabilityQuery = { start: string; end: string; minutes: number };

export const mechanicsPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/mechanics`;

export const availabilityPath = (shopSlug: string, q: AvailabilityQuery) =>
  `/api/portal/${encodeURIComponent(shopSlug)}/availability?${new URLSearchParams({
    start: q.start,
    end: q.end,
    minutes: String(q.minutes),
  })}`;

export function useMechanics(shopSlug: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'mechanics'],
    queryFn: () => apiGet<MechanicsResponse>(mechanicsPath(shopSlug)),
  });
}

export function useAvailability(shopSlug: string, q: AvailabilityQuery) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'availability', q.start, q.end, q.minutes],
    queryFn: () => apiGet<AvailabilityResponse>(availabilityPath(shopSlug, q)),
  });
}
