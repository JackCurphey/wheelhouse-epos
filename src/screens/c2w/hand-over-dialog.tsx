import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Tick } from './certificate-dialog.tsx';
import { Kv, firstName, mono, note, pounds, type C2wOrder, type Provider } from './c2w-bits.tsx';

/**
 * Hand over (c2w.mjs handOver; openspec/changes/cycle-to-work task 7, PR 7b):
 * the provider's own checks from Settings to tick, who pays what, then
 * "Hand over at the till", which opens the till with the order in the basket
 * (`TillPage`'s `?c2w=`). The ticked checks travel with it and are sent with
 * the sale, which records them in the order's history (server/c2w/hand-over.js).
 */
export function HandOverDialog({ o, provider, onClose }: { o: C2wOrder; provider: Provider | undefined; onClose: () => void }) {
  const navigate = useNavigate();
  const checks = provider?.handoverChecks ?? [];
  const [ticked, setTicked] = useState<string[]>([]);
  const name = firstName(o.customerName);
  const providerPays = o.providerPaysPence ?? o.certificatePence ?? o.totalPence;
  const toTill = () => navigate(`${ROUTES.till}?c2w=${o.id}`, { state: { c2wChecks: checks.filter((c) => ticked.includes(c)) } });
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }} aria-labelledby="ho-title" className="md:max-w-[560px]">
      <DialogHeader>
        <DialogTitle id="ho-title">{`Hand over to ${o.customerName}`}</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`${o.bike} · certificate ${o.certificateNumber ?? ''}`}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {checks.length > 0 ? (
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 p-0 text-size-15 font-bold">{`${o.providerName}’s checks, from your note in Settings`}</legend>
            {checks.map((c) => (
              <Tick key={c} label={c} checked={ticked.includes(c)} onChange={(on) => setTicked((t) => (on ? [...t, c] : t.filter((x) => x !== c)))} />
            ))}
          </fieldset>
        ) : null}
        <div className="rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-1.5 md:px-[18px]">
          <Kv k="Order total"><span className={mono}>{pounds(o.totalPence)}</span></Kv>
          <Kv k={`${o.providerName} pays (the certificate)`}><span className={mono}>{pounds(providerPays)}</span></Kv>
          <Kv k={`${name} pays at collection`} strong><span className={mono}>{pounds(Math.max(0, o.totalPence - providerPays))}</span></Kv>
        </div>
        <p className={note}>{`“Hand over at the till” opens the till with ${name}’s order in the basket: the bike, with its held frame number, and the order’s accessories, marked “on the order”. “Cycle to Work · ${o.providerName}” is the first way to pay. Anything ${name} adds at the counter goes on the same sale, for ${name} to pay. The ticked checks go in the order’s history.`}</p>
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={toTill}>Hand over at the till</Button>
      </DialogFooter>
    </Dialog>
  );
}
