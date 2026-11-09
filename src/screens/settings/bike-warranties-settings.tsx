import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { RadioPillGroup } from '@/staff/radio-pill-group.tsx';

/**
 * Settings › Stockroom › Bike warranties (openspec/changes/finish-customers, design 6; Jack's
 * 9 Nov answer 3): bike brands, each with Frame, Components and Electronics lines of whole years
 * or Lifetime. Not drawn: it follows Categories (a list the Owner edits, each row's lines in its
 * own box), after Categories, logged in decided-while-building.md.
 */
export type Part = 'frame' | 'components' | 'electronics';
export type Line = { part: Part; years: number | null };
type Brand = { id: number; brand: string; lines: Line[] };

export const PARTS: [Part, string][] = [['frame', 'Frame'], ['components', 'Components'], ['electronics', 'Electronics']];
export const YEARS_WORDS = 'Type whole years, from 1 to 50, or choose Lifetime';
const KEY = ['bike-warranties'];
export const useBikeWarranties = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<{ brands: Brand[] }>('/api/bike-warranties') });
const listOf = (data: { brands?: Brand[] } | undefined): Brand[] => (Array.isArray(data?.brands) ? data.brands : []);
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
const field = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-base font-normal';

/** "Frame lifetime · Components 2 years", in the plan's words. */
export const linesText = (lines: Line[]) => PARTS
  .flatMap(([part, name]) => lines.filter((l) => l.part === part).map((l) => `${name} ${l.years === null ? 'lifetime' : `${l.years} ${l.years === 1 ? 'year' : 'years'}`}`))
  .join(' · ');

/** The fold's summary: the brands by name, or none yet. */
export function useBikeWarrantiesSummary(): string {
  const brands = useBikeWarranties();
  if (!brands.data) return '';
  const all = listOf(brands.data);
  if (all.length === 0) return 'None yet';
  const first = all.slice(0, 2).map((b) => b.brand).join(', ');
  return all.length > 2 ? `${first} and ${all.length - 2} more` : first;
}

export function BikeWarrantiesSettings() {
  const brands = useBikeWarranties();
  const [open, setOpen] = useState<Brand | 'new' | null>(null);
  const all = listOf(brands.data);
  return (
    <div className="flex flex-col gap-2.5">
      {all.length ? (
        <ul aria-label="Bike brands" className="m-0 list-none p-0">
          {all.map((b) => (
            <li key={b.id} className="flex min-h-14 items-center gap-3 border-t border-[var(--wh-border)] py-2">
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="text-size-15 font-semibold">{b.brand}</span>
                <span className="text-size-13 text-[var(--wh-muted)]">{linesText(b.lines) || 'No lines yet'}</span>
              </span>
              <Button variant="ghost" aria-label={`Edit ${b.brand}`} onClick={() => setOpen(b)}>Edit</Button>
            </li>
          ))}
        </ul>
      ) : brands.data ? <p className="m-0 text-size-15 text-[var(--wh-muted)]">No brands yet.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Button onClick={() => setOpen('new')}>+ Add a brand</Button>
        <p className="m-0 text-sm text-[var(--wh-muted)]">A bike sold, or recorded as bought here, keeps the warranty it had then.</p>
      </div>
      {open ? <BrandBox key={open === 'new' ? 'new' : open.id} start={open === 'new' ? null : open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

// Each line in the box: not covered, Lifetime, or a number of years typed.
type Choice = { kind: 'none' | 'lifetime' | 'years'; typed: string };
const choiceOf = (lines: Line[], part: Part): Choice => {
  const l = lines.find((x) => x.part === part);
  return !l ? { kind: 'none', typed: '' } : l.years === null ? { kind: 'lifetime', typed: '' } : { kind: 'years', typed: String(l.years) };
};

/** The lines as chosen, or the words to refuse them with. Shared with a model's own lines. */
export function linesChosen(choices: Record<Part, Choice>): Line[] | string {
  const out: Line[] = [];
  for (const [part] of PARTS) {
    const c = choices[part];
    if (c.kind === 'lifetime') out.push({ part, years: null });
    if (c.kind === 'years') {
      const n = Number(c.typed.trim());
      if (!/^\d+$/.test(c.typed.trim()) || n < 1 || n > 50) return YEARS_WORDS;
      out.push({ part, years: n });
    }
  }
  return out;
}

export const startChoices = (lines: Line[]) => Object.fromEntries(PARTS.map(([p]) => [p, choiceOf(lines, p)])) as Record<Part, Choice>;

/** Frame, Components and Electronics, each with its pills and, for Years, a box. */
export function LineChoices({ choices, onChange }: { choices: Record<Part, Choice>; onChange: (part: Part, c: Choice) => void }) {
  return (
    <>
      {PARTS.map(([part, name]) => (
        <div key={part} className="flex flex-col gap-1.5">
          <span className="text-sm"><span id={`wl-${part}`} className="font-semibold">{name}</span>{part === 'electronics' ? <span className="text-[var(--wh-muted)]"> · <span>E-bikes only</span></span> : null}</span>
          <div className="flex flex-wrap items-center gap-2">
            <RadioPillGroup aria-labelledby={`wl-${part}`} className="flex flex-wrap gap-2">
              {([['none', 'Not covered'], ['lifetime', 'Lifetime'], ['years', 'Years']] as const).map(([k, w]) => {
                const on = choices[part].kind === k;
                return <button key={k} type="button" role="radio" aria-checked={on} onClick={() => onChange(part, { ...choices[part], kind: k })}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-border)] bg-[var(--wh-panel)]'}`}>{w}</button>;
              })}
            </RadioPillGroup>
            {choices[part].kind === 'years' ? (
              <input aria-label={`${name}, years`} inputMode="numeric" className={`${field} w-20`} value={choices[part].typed}
                onChange={(e) => onChange(part, { kind: 'years', typed: e.target.value })} />
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}

function BrandBox({ start, onClose }: { start: Brand | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [brand, setBrand] = useState(start?.brand ?? '');
  const [choices, setChoices] = useState(startChoices(start?.lines ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = start ? start.brand : 'Add a brand';

  async function save() {
    const lines = linesChosen(choices);
    if (typeof lines === 'string') { setError(lines); return; }
    if (!brand.trim()) { setError('A brand needs a name'); return; }
    setBusy(true);
    setError(null);
    try {
      const body = { brand: brand.trim(), lines };
      if (start) await apiMutate(`/api/bike-warranties/${start.id}`, body, { method: 'PUT' });
      else await apiMutate('/api/bike-warranties', body);
      await queryClient.invalidateQueries({ queryKey: KEY });
      onClose();
    } catch (err) {
      setError(words(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="bw-title" className="md:max-w-[560px]">
      <DialogHeader><DialogTitle id="bw-title">{title}</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Brand
          <input className={field} value={brand} maxLength={60} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <LineChoices choices={choices} onChange={(part, c) => setChoices((cs) => ({ ...cs, [part]: c }))} />
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}
