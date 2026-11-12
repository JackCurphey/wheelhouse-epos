import type { Choice } from './choice-chips.tsx';

/** What a changed report's address and the choices route carry. */
export type Selection = { measure: string; split: string; only: string[]; supplier: string };
export type Choices = { measure: Choice[]; split: Choice[]; only: Choice[]; suppliers: Choice[] };
export type ChoicesAnswer = { base: string; selection: Selection; choices: Choices };

export type ChangedRow = { key: string; label: string; value: number | null; takingsPence: number | null; beforeValue: number | null; notReached?: boolean };
export type ChangedReport = {
  base: 'sales' | 'takings'; baseLabel: string; measure: string; split: string; only: string[]; supplier: string;
  title: string; line: string;
  period: { period: string; from: string; to: string; through: string; soFar: boolean; unit: 'day' | 'month' | 'hour'; label: string; against: string };
  columns: string[]; rows: ChangedRow[];
  total: { label: string; value: number; takingsPence: number };
  figures: { value: number; beforeValue: number; diffValue: number | null };
  showBefore: boolean; empty: boolean; nothingBefore: boolean; firstSaleOn: string | null;
  choices: Choices; shopLine: string; today: string;
};

/** The report's own address for a base ("sales" or "takings"). */
export const BASE_PATH = { sales: '/workshop/reports/sales', takings: '/workshop/reports/takings' } as const;
export const BASE_LABEL = { sales: 'Sales', takings: 'Takings and cash-ups' } as const;

/** The period's words under the panel's title, as the drawing has them: "this week so far". */
export const PERIOD_WORDS: Record<string, string> = {
  today: 'today so far', 'this-week': 'this week so far', 'this-month': 'this month so far', 'last-month': 'last month', 'last-12-months': 'last 12 months',
};

/** A selection as an address's choices (measure, split, each only, supplier). */
export function selectionParams(sel: Partial<Selection>): URLSearchParams {
  const q = new URLSearchParams();
  if (sel.measure) q.set('measure', sel.measure);
  if (sel.split) q.set('split', sel.split);
  for (const o of sel.only ?? []) q.append('only', o);
  if (sel.supplier) q.set('supplier', sel.supplier);
  return q;
}
