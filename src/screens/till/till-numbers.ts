/**
 * Set up this till's number pills (till-setup design 5; UX walk-through 7
 * M2): 1 up to three, or one past the highest number taken at that shop,
 * whichever is more; taken ones "In use"; the lowest free one chosen.
 * Bolton with none taken: B1 (chosen), B2, B3. [Second site] with 1 and 2
 * taken: [code]1 and [code]2 In use, [code]3 chosen.
 * A .ts file, not .tsx, so the tests can load it straight into Node.
 */
export type TillNumber = { number: number; inUse: boolean };

export function tillNumbers(taken: number[]): { numbers: TillNumber[]; chosen: number | null } {
  const used = new Set(taken);
  const last = Math.min(99, Math.max(3, ...taken.map((n) => n + 1)));
  const numbers = Array.from({ length: last }, (_, i) => ({ number: i + 1, inUse: used.has(i + 1) }));
  return { numbers, chosen: numbers.find((n) => !n.inUse)?.number ?? null };
}
