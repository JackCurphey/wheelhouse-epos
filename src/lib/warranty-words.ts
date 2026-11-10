/**
 * A bike bought here and its warranty, in the plan's words (openspec/changes/finish-customers,
 * design 6; Jack's 9 Nov answer 3; questions 15 and 19), shared by the bike page, the customer
 * page's Bikes and the customer's account. The server works out each line's end and its whole
 * months left from the shop's today; these only say it.
 */
export type WarrantyLine = { part: 'frame' | 'components' | 'electronics'; endsOn: string | null; monthsLeft: number | null; ended: boolean };
export type BikeWarranty = { boughtHereOn: string; brand: string | null; running: boolean; endedOn: string | null; lines: WarrantyLine[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PART = { frame: 'Frame', components: 'Components', electronics: 'Electronics' } as const;

/** "15 Jan 2028" from 2028-01-15: a warranty's dates run for years, so the year is said. */
export function dayYear(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Frame: lifetime", "Components: until 15 Jan 2028, 16 months left", "Components: ended 15 Aug 2026". */
export function lineText(l: WarrantyLine) {
  const left = l.monthsLeft === 0 ? 'less than a month left' : `${l.monthsLeft} ${l.monthsLeft === 1 ? 'month' : 'months'} left`;
  const what = l.endsOn === null ? 'lifetime' : l.ended ? `ended ${dayYear(l.endsOn)}` : `until ${dayYear(l.endsOn)}, ${left}`;
  return `${PART[l.part]}: ${what}`;
}

/** "Under warranty" while any line runs, "Warranty ended [date]" once all have; null with no lines. */
export function warrantyState(w: BikeWarranty | null | undefined): string | null {
  if (!w || w.lines.length === 0) return null;
  return w.running ? 'Under warranty' : `Warranty ended ${dayYear(w.endedOn ?? w.boughtHereOn)}`;
}

/** The whole line, as the Bikes list shows it: "Under warranty · Frame: lifetime · …". */
export function warrantyText(w: BikeWarranty | null | undefined): string | null {
  const state = warrantyState(w);
  if (!state || !w) return null;
  return w.running ? [state, ...w.lines.map(lineText)].join(' · ') : state;
}
