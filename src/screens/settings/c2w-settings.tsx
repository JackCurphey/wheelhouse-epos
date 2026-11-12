import { useId, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { penceInput, penceText } from '@/lib/money.ts';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { RowSwitch } from './row-switch.tsx';

/**
 * Settings › Front desk › Cycle to Work (openspec/changes/cycle-to-work
 * tasks 2.1 to 2.3): the six drawn folds (settings-frame.mjs c2wFolds) and
 * their contents (c2w.mjs cw-settings, cw-settings-provider). Each setting
 * saves when it is picked or its box is left, as End of day's Float does.
 * Amounts are whole numbers: pence for £, hundredths of a percent for %.
 */
type Kind = 'percent' | 'pounds';
type Settings = {
  holdDays: number | null; remindDays: number | null; quoteValidDays: number | null;
  orderRule: 'certificate' | 'applied' | 'deposit'; depositKind: Kind; depositValue: number | null;
  depositOnCertificate: 'refund' | 'count'; depositOnPullOut: 'refund' | 'keep'; howToApply: string;
  todayLines: boolean; noCertificateDays: number | null; paymentLateDays: number | null;
};
type Provider = {
  id: number; name: string; paysInDays: number | null; accessoriesInside: boolean; handoverNote: string;
  handoverChecks: string[]; retiredAt: string | null; commissionKind?: Kind; commissionValue?: number | null;
};
const KEY = ['c2w-settings'];
const PROVIDERS = ['c2w-providers'];
const useC2w = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<{ settings: Settings }>('/api/c2w/settings') });
const useProviders = () => useQuery({ queryKey: PROVIDERS, queryFn: () => apiGet<{ providers: Provider[] }>('/api/c2w/providers') });
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
const daysText = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
const hint = 'm-0 text-sm leading-normal text-[var(--wh-muted)]';
const field = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-base font-normal';

// An amount typed in its unit, as stored: "4.5" % is 450, "25" £ is 2500.
// Empty is null; anything else that isn't 0 to 100% or 0 pounds or more is undefined.
function amountOf(typed: string, kind: Kind): number | null | undefined {
  const t = typed.trim().replace(/^£|%$/g, '').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || (kind === 'percent' && n > 100)) return undefined;
  const v = Math.round(n * 100);
  return Math.abs(v - n * 100) < 1e-6 ? v : undefined;
}
const amountBox = (v: number | null | undefined, kind: Kind) => (v === null || v === undefined ? '' : kind === 'percent' ? String(v / 100) : penceInput(v));
const amountText = (v: number, kind: Kind) => (kind === 'percent' ? `${v / 100}%` : penceText(v));

/** Saves part of the settings; the reply becomes what every fold reads. */
function useSave() {
  const queryClient = useQueryClient();
  return async (body: Partial<Settings>) => {
    const saved = await apiMutate<{ settings: Settings }>('/api/c2w/settings', body, { method: 'PUT' });
    queryClient.setQueryData(KEY, saved);
  };
}

/** Each fold's summary in the drawn words, from what is set; "Not set yet" for gaps. */
export function useC2wSummaries() {
  const s = useC2w().data?.settings;
  const providers = useProviders().data?.providers;
  if (!s) return { hold: '', order: '', apply: '', deposits: '', providers: '', today: '' };
  const hold = [s.holdDays !== null ? `Held from the quote for ${daysText(s.holdDays)}` : '', s.quoteValidDays !== null ? `quotes valid for ${daysText(s.quoteValidDays)}` : ''].filter(Boolean).join(' · ');
  const today = [s.noCertificateDays !== null ? `No certificate after ${daysText(s.noCertificateDays)}` : '', s.paymentLateDays !== null ? `payment ${daysText(s.paymentLateDays)} late` : ''].filter(Boolean).join(' · ');
  const active = providers?.filter((p) => !p.retiredAt).length;
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return {
    hold: hold ? cap(hold) : 'Not set yet',
    order: { certificate: 'Ordered once the certificate arrives', applied: 'Ordered once the customer has applied', deposit: 'Ordered straight away, with a deposit' }[s.orderRule],
    apply: s.howToApply.trim() ? 'A line on every quote and email' : 'Not set yet',
    deposits: s.depositOnCertificate === 'count' ? 'Counted toward the price' : 'Refunded when the certificate arrives',
    providers: active === undefined ? '' : active === 0 ? 'No providers yet' : active === 1 ? '1 provider' : `${active} providers`,
    today: !s.todayLines ? 'Off' : today ? cap(today) : 'Not set yet',
  };
}

function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  return note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null;
}

// c2w.mjs numRow: the label, a small box, and its unit word.
function DaysRow({ label, name, min, unit = 'days' }: { label: string; name: 'holdDays' | 'remindDays' | 'quoteValidDays' | 'noCertificateDays' | 'paymentLateDays'; min: number; unit?: string }) {
  const id = useId();
  const s = useC2w().data?.settings;
  const save = useSave();
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const stored = s?.[name] ?? null;
  async function leave() {
    if (typed === null) return;
    const t = typed.trim();
    const n = t === '' ? null : Number(t);
    if (n !== null && (!Number.isInteger(n) || n < min || n > 365)) { setNote({ ok: false, text: `A whole number of days, ${min} to 365` }); return; }
    if (n === stored) { setTyped(null); setNote(null); return; }
    try {
      await save({ [name]: n });
      setTyped((now) => (now === typed ? null : now));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) { setNote({ ok: false, text: words(err) }); }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-[52px] items-center gap-2.5">
        <label htmlFor={id} className="grow text-size-15 font-semibold">{label}</label>
        <input id={id} inputMode="numeric" value={typed ?? (stored === null ? '' : String(stored))} disabled={!s}
          aria-invalid={note && !note.ok ? true : undefined}
          onChange={(e) => setTyped(e.target.value)} onBlur={() => void leave()}
          className={`${field} w-[70px] text-right font-mono`} />
        <span className="text-size-15 text-[var(--wh-muted)]">{unit}</span>
      </div>
      <Note note={note} />
    </div>
  );
}

// c2w.mjs unitSwitch: £ and %, the one in use pressed.
function UnitSwitch({ label, kind, disabled, onPick }: { label: string; kind: Kind; disabled?: boolean; onPick: (k: Kind) => void }) {
  const pill = (to: Kind, text: string) => (
    <button type="button" aria-pressed={kind === to} disabled={disabled} onClick={() => onPick(to)}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold ${kind === to ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}>
      {text}
    </button>
  );
  return <span role="group" aria-label={`${label} in`} className="inline-flex gap-1.5">{pill('pounds', '£')}{pill('percent', '%')}</span>;
}

function Choice<T extends string>({ legend, name, value, options, disabled, onPick }: {
  legend: string; name: string; value: T | undefined; options: { value: T; label: string; hint?: string }[]; disabled?: boolean; onPick: (v: T) => void;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 text-size-15 font-bold">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="flex min-h-11 items-start gap-2.5 py-1.5">
          {/* Named by its label alone; the hint is its description. */}
          <input type="radio" name={name} className="mt-1 size-4" checked={value === o.value} disabled={disabled} onChange={() => onPick(o.value)}
            aria-label={o.label} aria-describedby={o.hint ? `${name}-${o.value}-hint` : undefined} />
          <span className="flex flex-col gap-0.5">
            <span className="text-size-15 font-semibold">{o.label}</span>
            {o.hint ? <span id={`${name}-${o.value}-hint`} className="text-size-13 text-[var(--wh-muted)]">{o.hint}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** A choice that saves when picked, showing the server's words if it says no. */
function SavedChoice<K extends 'orderRule' | 'depositOnCertificate' | 'depositOnPullOut'>({ setting, ...rest }: {
  setting: K; legend: string; name: string; options: { value: Settings[K]; label: string; hint?: string }[];
}) {
  const s = useC2w().data?.settings;
  const save = useSave();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const pick = async (v: Settings[K]) => {
    setNote(null);
    try { await save({ [setting]: v } as Partial<Settings>); } catch (err) { setNote({ ok: false, text: words(err) }); }
  };
  return <div className="flex flex-col gap-1.5"><Choice {...rest} value={s?.[setting]} disabled={!s} onPick={(v) => void pick(v)} /><Note note={note} /></div>;
}

export function HoldSettings() {
  return (
    <div className="flex flex-col gap-1">
      <DaysRow label="Hold a bike in stock from the quote for" name="holdDays" min={1} />
      <DaysRow label="Remind the shop before the hold ends" name="remindDays" min={0} unit="days before" />
      <DaysRow label="Quotes are valid for" name="quoteValidDays" min={1} />
      <p className={hint}>The certificate makes the hold firm until the bike is collected.</p>
    </div>
  );
}

// The deposit amount with its unit; switching unit sends the amount in the new one.
function DepositAmount() {
  const id = useId();
  const s = useC2w().data?.settings;
  const save = useSave();
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const kind = s?.depositKind ?? 'pounds';
  const shown = typed ?? amountBox(s?.depositValue, kind);
  async function send(to: Kind, text: string) {
    const v = amountOf(text, to);
    if (v === undefined) { setNote({ ok: false, text: to === 'percent' ? 'Type the deposit as a percentage from 0 to 100' : 'Type the deposit in pounds, like 50.00' }); return; }
    if (to === kind && v === (s?.depositValue ?? null)) { setTyped(null); setNote(null); return; }
    try {
      await save({ depositKind: to, depositValue: v });
      setTyped((now) => (now === text ? null : now));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) { setNote({ ok: false, text: words(err) }); }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-[52px] flex-wrap items-center gap-2.5">
        <label htmlFor={id} className="grow text-size-15 font-semibold">Deposit</label>
        <input id={id} inputMode="decimal" value={shown} disabled={!s} aria-invalid={note && !note.ok ? true : undefined}
          onChange={(e) => setTyped(e.target.value)} onBlur={() => { if (typed !== null) void send(kind, typed); }}
          className={`${field} w-[90px] text-right font-mono`} />
        <UnitSwitch label="Deposit" kind={kind} disabled={!s} onPick={(to) => { if (to !== kind) void send(to, shown); }} />
      </div>
      <Note note={note} />
    </div>
  );
}

export function OrderSettings() {
  return (
    <div className="flex flex-col gap-2.5">
      <SavedChoice setting="orderRule" legend="Order a bike that isn’t in stock" name="c2w-order-rule" options={[
        { value: 'certificate', label: 'Once the certificate arrives', hint: 'Safest. The customer waits a little longer.' },
        { value: 'applied', label: 'Once the customer has applied', hint: 'Staff mark the order “Applied”, with the application reference if there is one.' },
        { value: 'deposit', label: 'Straight away, with a deposit', hint: 'Until the certificate arrives.' },
      ]} />
      <DepositAmount />
      <p className={hint}>Owners, managers and anyone with “Can close the day” can still “Order now anyway” on one order, with a reason that goes in the activity log.</p>
    </div>
  );
}

export function ApplySettings() {
  const id = useId();
  const s = useC2w().data?.settings;
  const save = useSave();
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  async function leave() {
    if (typed === null || typed === s?.howToApply) { setTyped(null); return; }
    try {
      await save({ howToApply: typed });
      setTyped((now) => (now === typed ? null : now));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) { setNote({ ok: false, text: words(err) }); }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-size-15 font-semibold">How to apply</label>
      <textarea id={id} rows={3} value={typed ?? s?.howToApply ?? ''} disabled={!s}
        placeholder="[The shop’s own words — for example, where customers start their application]"
        onChange={(e) => setTyped(e.target.value)} onBlur={() => void leave()} className={`${field} py-2`} />
      <p className={hint}>Printed on every quote and in the “Your bike is put aside” email.</p>
      <Note note={note} />
    </div>
  );
}

export function DepositSettings() {
  return (
    <div className="flex flex-col gap-3">
      <SavedChoice setting="depositOnCertificate" legend="When the certificate arrives" name="c2w-deposit-certificate" options={[
        { value: 'refund', label: 'Refund the deposit', hint: 'The way it was paid.' },
        { value: 'count', label: 'Count it toward the price', hint: 'The provider pays the rest; Wheelhouse works out the split.' },
      ]} />
      <SavedChoice setting="depositOnPullOut" legend="If the customer pulls out" name="c2w-deposit-pull-out" options={[
        { value: 'refund', label: 'Refund it' },
        { value: 'keep', label: 'Keep it when the bike was ordered in', hint: 'The quote says so.' },
      ]} />
    </div>
  );
}

// On Today has no drawn contents: the two [n]s of its summary, and a switch
// (decided while building, 12 Nov, item 6 and PR 2).
export function TodaySettings() {
  const s = useC2w().data?.settings;
  const save = useSave();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const flip = async (on: boolean) => { setNote(null); try { await save({ todayLines: on }); } catch (err) { setNote({ ok: false, text: words(err) }); } };
  return (
    <div className="flex flex-col gap-1">
      <RowSwitch label="Show these on Today" on={s?.todayLines === true} disabled={!s} onChange={(on) => void flip(on)} />
      <Note note={note} />
      <DaysRow label="No certificate after" name="noCertificateDays" min={1} />
      <DaysRow label="Payment late after" name="paymentLateDays" min={1} />
    </div>
  );
}

// c2w.mjs providersOpen: "Commission [%] · pays in about [n] days · [n] checks at hand-over", only the parts filled in.
function termsLine(p: Provider): string {
  const n = p.handoverChecks.length;
  const parts = [
    p.commissionKind && p.commissionValue !== null && p.commissionValue !== undefined ? `Commission ${amountText(p.commissionValue, p.commissionKind)}` : '',
    p.paysInDays !== null ? `pays in about ${daysText(p.paysInDays)}` : '',
    n ? `${n} check${n === 1 ? '' : 's'} at hand-over` : '',
  ].filter(Boolean).join(' · ');
  return parts ? parts.charAt(0).toUpperCase() + parts.slice(1) : 'Terms not filled in yet';
}

export function ProvidersSettings() {
  const queryClient = useQueryClient();
  const providers = useProviders();
  const [editing, setEditing] = useState<Provider | 'new' | null>(null);
  const [retiring, setRetiring] = useState<Provider | null>(null);
  const done = async () => { await queryClient.invalidateQueries({ queryKey: PROVIDERS }); };
  return (
    <div className="flex flex-col gap-2.5">
      <p className={hint}>The schemes your customers use. Their terms are yours to fill in, from each provider’s agreement.</p>
      {(providers.data?.providers ?? []).filter((p) => !p.retiredAt).map((p) => (
        <div key={p.id} className="flex min-h-14 items-center gap-3 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] py-0 pr-2 pl-3.5">
          <span className="flex grow flex-col gap-0.5">
            <span className="text-size-15 font-bold">{p.name}</span>
            <span className="text-size-13 text-[var(--wh-muted)]">{termsLine(p)}</span>
          </span>
          <Button variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>Edit</Button>
          <Button variant="ghost" aria-label={`Retire ${p.name}`} onClick={() => setRetiring(p)}>Retire</Button>
        </div>
      ))}
      <div className="flex flex-col items-start gap-2.5">
        <Button onClick={() => setEditing('new')}>+ Add a provider</Button>
        <p className={hint}>Changing a provider’s terms applies to new orders; open orders keep the terms they were made with.</p>
      </div>
      {editing ? <ProviderBox start={editing === 'new' ? null : editing} onDone={done} onClose={() => setEditing(null)} /> : null}
      {retiring ? <RetireBox provider={retiring} onDone={done} onClose={() => setRetiring(null)} /> : null}
    </div>
  );
}

function BoxHeader({ id, title, sub, onClose }: { id: string; title: string; sub?: string; onClose: () => void }) {
  return (
    <DialogHeader className="bg-[var(--wh-panel)]">
      <span className="flex grow flex-col gap-0.5">
        <DialogTitle id={id} className="text-xl">{title}</DialogTitle>
        {sub ? <p className="m-0 text-size-13 text-[var(--wh-muted)]">{sub}</p> : null}
      </span>
      <DialogClose onClick={onClose} />
    </DialogHeader>
  );
}

function Labelled({ label, children, after }: { label: string; children: ReactNode; after?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">{label}{children}</label>
      {after}
    </div>
  );
}

// c2w.mjs providerEdit; Add uses the same box (decided while building, PR 2).
function ProviderBox({ start, onDone, onClose }: { start: Provider | null; onDone: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(start?.name ?? '');
  const [kind, setKind] = useState<Kind>(start?.commissionKind ?? 'percent');
  const [commission, setCommission] = useState(amountBox(start?.commissionValue, start?.commissionKind ?? 'percent'));
  const [pays, setPays] = useState(start?.paysInDays === null || start?.paysInDays === undefined ? '' : String(start.paysInDays));
  const [inside, setInside] = useState(start?.accessoriesInside ?? true);
  const [checks, setChecks] = useState(start?.handoverNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const value = amountOf(commission, kind);
    const days = pays.trim() === '' ? null : Number(pays.trim());
    if (!name.trim()) { setError('Give the provider a name'); return; }
    if (value === undefined) { setError(kind === 'percent' ? 'Type the commission as a percentage from 0 to 100' : 'Type the commission in pounds, like 25.00'); return; }
    if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) { setError('Pays in about is a whole number of days, 0 to 365'); return; }
    const body = { name: name.trim(), commissionKind: kind, commissionValue: value, paysInDays: days, accessoriesInside: inside, handoverNote: checks };
    setBusy(true);
    setError(null);
    try {
      await (start ? apiMutate(`/api/c2w/providers/${start.id}`, body, { method: 'PUT' }) : apiMutate('/api/c2w/providers', body));
      await onDone();
      onClose();
    } catch (err) { setError(words(err)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="c2w-provider-title" className="md:max-w-[520px]">
      <BoxHeader id="c2w-provider-title" title={start ? 'Edit provider' : 'Add a provider'} sub={start?.name} onClose={onClose} />
      <DialogBody className="flex flex-col gap-4">
        <Labelled label="Name"><input className={field} value={name} onChange={(e) => setName(e.target.value)} /></Labelled>
        <div className="flex flex-wrap items-end gap-2.5">
          <Labelled label="Commission"><input className={`${field} w-32 font-mono`} inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} /></Labelled>
          <UnitSwitch label="Commission" kind={kind} onPick={setKind} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c2w-pays" className="text-sm font-semibold">Pays in about</label>
          <span className="flex items-center gap-2.5"><input id="c2w-pays" className={`${field} w-[70px] text-right font-mono`} inputMode="numeric" value={pays} onChange={(e) => setPays(e.target.value)} /><span className="text-[var(--wh-muted)]">days</span></span>
          <p className={hint}>After collection</p>
        </div>
        <Choice legend="Accessories" name="c2w-accessories" value={inside ? 'inside' : 'customer'} onPick={(v) => setInside(v === 'inside')} options={[
          { value: 'inside', label: 'Inside what the provider pays' },
          { value: 'customer', label: 'The customer pays for them at collection' },
        ]} />
        <Labelled label="Checks at hand-over" after={<p className={hint}>Each line becomes a box for staff to tick at hand-over.</p>}>
          <textarea className={`${field} py-2`} rows={4} placeholder="[From their agreement — one check per line]" value={checks} onChange={(e) => setChecks(e.target.value)} />
        </Labelled>
        {error ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}

// Not drawn: Tills' Remove box (decided while building, PR 2); decided item 5 for the words.
function RetireBox({ provider, onDone, onClose }: { provider: Provider; onDone: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function retire() {
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/c2w/providers/${provider.id}/retire`, {});
      await onDone();
      onClose();
    } catch (err) { setError(words(err)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} dismissOnBackdrop={false} aria-labelledby="c2w-retire-title" className="md:max-w-[520px]">
      <BoxHeader id="c2w-retire-title" title={`Retire ${provider.name}?`} onClose={onClose} />
      <DialogBody className="flex flex-col gap-4">
        <p className={hint}>It comes off the list staff pick from for new orders. Orders that already use it keep it. A retired provider can’t be brought back.</p>
        {error ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button variant="ghost" onClick={onClose}>{`Keep ${provider.name}`}</Button>
        <Button variant="danger" disabled={busy} onClick={() => void retire()}>{`Retire ${provider.name}`}</Button>
      </DialogFooter>
    </Dialog>
  );
}
