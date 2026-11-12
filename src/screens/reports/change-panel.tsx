import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChoiceChip, Reasons } from './choice-chips.tsx';
import { Refusal } from './reports-bits.tsx';
import { BASE_LABEL, PERIOD_WORDS, selectionParams, type ChoicesAnswer, type Selection } from './changed-format.ts';

/**
 * "Change what's shown" (rp-change in generator/reports.mjs; openspec/changes/reports-your-own,
 * decisions 1 and 2): one popup with Measure, Split by and Only (categories, Labour, Supplier)
 * in the one chip look. It opens on what the report already shows (the server's defaults for
 * the report it started from, or the changed report's own choices). Each click asks the server
 * what now fits, so a choice that doesn't is greyed with its reason and the split moves to one
 * that does; the screen holds no table of what fits with what. "Show report" opens the changed
 * report in its own address.
 */
const GROUP = 'flex flex-col gap-2';
const CHIPS = 'flex flex-wrap gap-1.5';

export function ChangePanel({ base, period, initial, onClose }: {
  base: 'sales' | 'takings'; period: URLSearchParams; initial?: Partial<Selection>; onClose: () => void;
}) {
  const navigate = useNavigate();
  const [want, setWant] = useState<Partial<Selection>>(initial ?? {});
  const query = new URLSearchParams({ base });
  for (const [k, v] of period) query.set(k, v);
  for (const [k, v] of selectionParams(want)) query.append(k, v);
  const answer = useQuery({
    queryKey: ['reports-change-choices', query.toString()], retry: false, placeholderData: keepPreviousData,
    queryFn: () => apiGet<ChoicesAnswer>(`/api/reports/changed/choices?${query.toString()}`),
  });
  const data = answer.data;
  const sel = data?.selection;
  // While the server is still checking the last click, the choices on screen are the old ones: wait for it.
  const checking = answer.isPlaceholderData;
  const set = (next: Partial<Selection>) => { if (sel && !checking) setWant({ ...sel, ...next }); };
  const toggle = (value: string) => set({ only: sel!.only.includes(value) ? sel!.only.filter((o) => o !== value) : [...sel!.only, value] });

  function show() {
    if (!sel || checking) return;
    const next = new URLSearchParams({ base, ...Object.fromEntries(period) });
    for (const [k, v] of selectionParams(sel)) next.append(k, v);
    onClose();
    navigate(`${ROUTES['rp-changed']}?${next.toString()}`);
  }
  const words = PERIOD_WORDS[period.get('period') ?? 'this-week'] ?? 'these dates';
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="ch-title" className="md:max-w-[680px]">
      <DialogHeader>
        <div><DialogTitle id="ch-title">Change what’s shown</DialogTitle><DialogDescription>{BASE_LABEL[base]} · {words}</DialogDescription></div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {answer.isError ? <Refusal error={answer.error} /> : null}
        {data && sel ? (
          <>
            <fieldset className={`m-0 min-w-0 border-0 p-0 ${GROUP}`}>
              <legend className="mb-2 text-size-15 font-bold">Measure</legend>
              <div className={CHIPS}>{data.choices.measure.map((c) => <ChoiceChip key={c.value} role="radio" group="measure" choice={c} checked={sel.measure === c.value} onChoose={() => set({ measure: c.value })} />)}</div>
              <Reasons choices={data.choices.measure} />
            </fieldset>
            <fieldset className={`m-0 min-w-0 border-0 p-0 ${GROUP}`}>
              <legend className="mb-2 text-size-15 font-bold">Split by</legend>
              <div className={CHIPS}>{data.choices.split.map((c) => <ChoiceChip key={c.value} role="radio" group="split" choice={c} checked={sel.split === c.value} onChoose={() => set({ split: c.value })} />)}</div>
              <Reasons choices={data.choices.split} />
            </fieldset>
            <fieldset className={`m-0 min-w-0 border-0 p-0 ${GROUP}`}>
              <legend className="mb-2 text-size-15 font-bold">Only <span className="font-normal text-[var(--wh-muted)]">— pick one or more</span></legend>
              <div className={CHIPS}>{data.choices.only.map((c) => <ChoiceChip key={c.value} role="checkbox" group="only" choice={c} checked={sel.only.includes(c.value)} onChoose={() => toggle(c.value)} />)}</div>
              <span className="mt-1 text-sm font-semibold">Supplier</span>
              <div role="radiogroup" aria-label="Supplier" className={CHIPS}>{data.choices.suppliers.map((c) => <ChoiceChip key={c.value || 'any'} role="radio" group="supplier" choice={c} checked={sel.supplier === c.value} onChoose={() => set({ supplier: c.value })} />)}</div>
            </fieldset>
          </>
        ) : answer.isError ? null : <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!sel || checking} onClick={show}>Show report</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** The "Change what's shown" button of a report, and the panel it opens. */
export function ChangeWhatsShown({ base, period, initial }: { base: 'sales' | 'takings'; period: URLSearchParams; initial?: Partial<Selection> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="default" className="min-h-11" onClick={() => setOpen(true)}>Change what’s shown</Button>
      {open ? <ChangePanel base={base} period={period} initial={initial} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
