import { Fragment, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { LineChoices, linesChosen, linesText, startChoices, type Line } from '@/screens/settings/bike-warranties-settings.tsx';
import { Box, kv } from './product-page.tsx';

/**
 * A bike's brand and warranty on its product page (openspec/changes/finish-customers, design 6;
 * questions 17 and 18). Not drawn on st-product: a box of its own, in the page's Box and kv
 * pattern. The warranty is its own lines if it has any, else its listed brand's; the Owner
 * gives a model its own lines, starting at its brand's, or puts its brand's back.
 */
export type Warranty = { own: boolean; brand: string | null; lines: Line[] } | null;
type Bike = { id: number; name: string; brand?: string | null; isEbike?: boolean; warranty?: Warranty };
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');

export function BrandWarranty({ p, owner }: { p: Bike; owner: boolean }) {
  const queryClient = useQueryClient();
  const [own, setOwn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const w = p.warranty ?? null;
  async function brandsBack() {
    setError(null);
    try {
      await apiMutate(`/api/products/${p.id}/warranty`, { lines: null }, { method: 'PUT' });
      await queryClient.invalidateQueries({ queryKey: ['product', p.id] });
    } catch (err) {
      setError(words(err));
    }
  }
  return (
    <Box id="h-warranty" title="Brand and warranty">
      {kv('Brand', p.brand || '—')}
      {kv('E-bike', p.isEbike ? 'Yes' : 'No')}
      {w && w.lines.length ? <p className="m-0 text-size-15">{`Warranty${w.own ? ' (this model’s own)' : ''}: ${linesText(w.lines)}`}</p> : null}
      {owner ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {w?.own
            ? (w.brand ? <Button onClick={() => void brandsBack()}>{`Use ${w.brand}’s lines`}</Button> : <Button onClick={() => void brandsBack()}>Remove its own lines</Button>)
            : <Button onClick={() => setOwn(true)}>Give this model its own lines</Button>}
          {w?.own ? <Button variant="ghost" onClick={() => setOwn(true)}>Change its own lines</Button> : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      {own ? <OwnLines p={p} start={w?.lines ?? []} onClose={() => setOwn(false)} /> : null}
    </Box>
  );
}

function OwnLines({ p, start, onClose }: { p: Bike; start: Line[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [choices, setChoices] = useState(startChoices(start));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const lines = linesChosen(choices);
    if (typeof lines === 'string') { setError(lines); return; }
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/products/${p.id}/warranty`, { lines }, { method: 'PUT' });
      await queryClient.invalidateQueries({ queryKey: ['product', p.id] });
      onClose();
    } catch (err) {
      setError(words(err));
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="ow-title" className="md:max-w-[560px]">
      <DialogHeader><DialogTitle id="ow-title">{`${p.name}’s own lines`}</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <p className="m-0 text-sm text-[var(--wh-muted)]">In place of its brand’s, for this model only.</p>
        <Fragment><LineChoices choices={choices} onChange={(part, c) => setChoices((cs) => ({ ...cs, [part]: c }))} /></Fragment>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}
