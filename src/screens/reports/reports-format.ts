import { penceText } from '@/lib/cash-count.ts';

/** What the Sales report sends (server/lib/report-sales.js). */
export type SalesRow = {
  key: string | number; label: string; notReached: boolean;
  takingsPence: number | null; sales: number | null; averagePence: number | null;
  beforeTakingsPence: number; beforeSales: number;
};
export type SalesReport = {
  period: { period: string; from: string; to: string; through: string; soFar: boolean; unit: 'day' | 'month' | 'hour'; label: string; against: string };
  before: { from: string; to: string };
  figures: {
    takings: { pence: number; beforePence: number; diffPence: number | null };
    sales: { count: number; beforeCount: number; diff: number | null };
    average: { pence: number | null; beforePence: number | null; diffPence: number | null };
  };
  rows: SalesRow[];
  total: { label: string; takingsPence: number; sales: number; averagePence: number | null };
  empty: boolean; nothingBefore: boolean; firstSaleOn: string | null; shopLine: string; today: string;
};

/** Pence as pounds and pence, "£45.00"; "—" for a figure that has no value (a day not reached). */
export const money = (pence: number | null): string => (pence === null ? '—' : penceText(pence));
export const count = (n: number | null): string => (n === null ? '—' : String(n));

/** "Up £92.00 on the same days last week", the comparison in words (audit M9). */
export function compareWords(diff: number | null, against: string, kind: 'money' | 'count'): string | null {
  if (diff === null) return null;
  if (diff === 0) return `No change on ${against}`;
  const size = kind === 'money' ? penceText(Math.abs(diff)) : String(Math.abs(diff));
  return `${diff > 0 ? 'Up' : 'Down'} ${size} on ${against}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "15 September 2026" from 2026-09-15. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** A cash difference: "−£5.00" when short, "£2.00" when over, "£0.00" when exact. */
export const differenceText = (pence: number): string => (pence < 0 ? `−${penceText(-pence)}` : penceText(pence));
