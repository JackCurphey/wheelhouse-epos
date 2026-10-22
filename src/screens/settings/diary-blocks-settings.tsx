import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';

/**
 * Settings › Workshop › Diary blocks (Workshop day 17 and 29, 27 Sep; drawn as
 * set-workshop-diary's blockPrefContent): what a diary block shows first and
 * second, from bike, job title, customer and job number; bike, then job title,
 * by default. Saved as soon as it's chosen. The status always shows too.
 */
export type BlockField = 'bike' | 'jobTitle' | 'customer' | 'reference';
type Settings = { blockFirst?: BlockField; blockSecond?: BlockField };

export const BLOCK_FIELDS: { value: BlockField; label: string }[] = [
  { value: 'bike', label: 'Bike' },
  { value: 'jobTitle', label: 'Job title' },
  { value: 'customer', label: 'Customer' },
  { value: 'reference', label: 'Job number' },
];
const label = (f: BlockField) => BLOCK_FIELDS.find((x) => x.value === f)?.label ?? '';
// The drawing's example block (Maya Patel's Trek Domane AL 3, WH-1042).
const EXAMPLE: Record<BlockField, string> = { bike: 'Trek Domane AL 3', jobTitle: 'Standard service', customer: 'Maya Patel', reference: 'WH-1042' };

/** The fold's summary: "Bike, then job title". */
export function useDiaryBlocksSummary(): string {
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<Settings>('/api/workshop-settings') });
  const s = settings.data;
  if (!s?.blockFirst || !s.blockSecond) return '';
  return `${label(s.blockFirst)}, then ${label(s.blockSecond).toLowerCase()}`;
}

export function DiaryBlocksSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<Settings>('/api/workshop-settings') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = settings.data?.blockFirst ?? 'bike';
  const second = settings.data?.blockSecond ?? 'jobTitle';

  // Choosing the other line's choice swaps the two, so the lines never repeat.
  async function choose(line: 'first' | 'second', value: BlockField) {
    const next = line === 'first'
      ? { blockFirst: value, blockSecond: value === second ? first : second }
      : { blockFirst: value === first ? second : first, blockSecond: value };
    setBusy(true);
    setError(null);
    try {
      const saved = await apiMutate<Settings>('/api/workshop-settings', next, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  const select = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-sm';
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {(['first', 'second'] as const).map((line) => (
          <div key={line} className="flex flex-col gap-1.5">
            <label htmlFor={`block-${line}`} className="text-sm font-semibold">{line === 'first' ? 'First line' : 'Second line'}</label>
            <select id={`block-${line}`} value={line === 'first' ? first : second} disabled={busy || !settings.data} onChange={(e) => void choose(line, e.target.value as BlockField)} className={select}>
              {BLOCK_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <figure aria-label="Preview" className="m-0 flex flex-col gap-1.5 border-t border-[var(--wh-border)] pt-3">
        <figcaption className="text-xs font-bold tracking-[0.4px] text-[var(--wh-muted)] uppercase">Preview</figcaption>
        <div className="flex w-[190px] flex-col rounded-[5px] border-[1.75px] border-[var(--wh-state-scheduled-ink)] bg-[var(--wh-state-scheduled-bg)] px-1.5 py-[3px] text-xs leading-[14px] font-bold">
          <span className="truncate text-[var(--wh-ink)]">{EXAMPLE[first]}</span>
          <span className="truncate">{EXAMPLE[second]}</span>
          <span className="truncate text-[var(--wh-state-scheduled-ink)]">Expected</span>
        </div>
      </figure>
      <p className="m-0 text-sm text-[var(--wh-muted)]">The status always shows too, whatever the two lines above are set to.</p>
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
    </div>
  );
}
