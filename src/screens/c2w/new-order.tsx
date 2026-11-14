import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { AddCustomer } from '@/screens/customers/customers-page.tsx';
import { Kv, addDays, closingFor, longDate, mono, orderHref, plural, pounds, useC2wSettings, type C2wOrder, type Provider } from './c2w-bits.tsx';

/**
 * New Cycle to Work order (c2w.mjs newOrder; cw-new, cw-new-not-in-stock;
 * edge 6c, + New customer). The Bike line's stock words ("1 free at Bolton ·
 * none held") wait for pull request 5's stock reply (logged); until then the
 * site's stock figure decides whether the hold is offered, as the server's
 * freeHere does. Dates count from the shop's day (`today`, from the list).
 * Make the quote makes the order, then emails it if ticked, and opens the
 * order with the drawn note.
 */
type Person = { id: number; name: string; phone: string | null; email: string | null };
export type Product = { id: number; name: string; sku: string | null; pricePence: number };
type ProductPage = { stockAtShops: { id: number; name: string; qty: number; here: boolean }[] };

const LABEL = 'text-sm font-semibold';
const INPUT = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm';
const SUB = 'text-size-13 text-[var(--wh-muted)]';
const words = (err: unknown, fallback: string) => (serverSaid(err) ? err.message : fallback);
// After the screen has changed (an effect runs once the new screen is in place).
const focusById = (id: string) => document.getElementById(id)?.focus();

/**
 * A search box that lists its matches (a combobox and its listbox, as
 * Deliveries' New order lists products): the arrow keys move through them,
 * Enter picks, and Escape closes the list without closing New order.
 */
export function Search<T extends { id: number }>({ id, label, path, show, name, onPick }: { id: string; label: string; path: string; show: (t: T) => ReactNode; name: (t: T) => string; onPick: (t: T) => void }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(0);
  const listId = useId();
  const q = term.trim();
  const found = useQuery({ queryKey: ['c2w-search', path, q], queryFn: () => apiGet<T[]>(`${path}?search=${encodeURIComponent(q)}`), enabled: q.length >= 2 });
  const items = q.length >= 2 ? found.data ?? null : null;
  const shown = open && items !== null;
  const pick = (t: T) => { onPick(t); setTerm(''); setActive(0); };
  const listed = shown && items.length > 0;
  return (
    // Leaving the box and its list closes the list (New job's customer search).
    <div className="flex flex-col gap-1.5" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <input id={id} type="text" role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={listed} aria-controls={listed ? listId : undefined}
        aria-activedescendant={listed && items[active] ? `${listId}-${active}` : undefined}
        value={term} onChange={(e) => { setTerm(e.target.value); setOpen(true); setActive(0); }} placeholder="Type to search" autoComplete="off" className={INPUT}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            // Escape closes the list, then empties the box; from an empty box it
            // reaches New order and closes it (new-job-dialog.tsx's customer search).
            if (!shown && !term) return;
            e.preventDefault();
            e.stopPropagation();
            if (shown) setOpen(false); else setTerm('');
          } else if (!shown && e.key === 'ArrowDown' && items !== null) {
            e.preventDefault();
            setOpen(true);
          } else if (listed && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length);
          } else if (listed && e.key === 'Enter' && items[active]) {
            e.preventDefault();
            pick(items[active]);
          }
        }} />
      <span role="status" className="sr-only">{shown ? (items.length ? `${items.length} found.` : `Nothing matches “${q}”.`) : ''}</span>
      {listed ? (
        <ul id={listId} role="listbox" aria-label={`Matching: ${label}`} className="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1">
          {items.map((t, i) => (
            // Pressing keeps the focus in the box: Safari and iPad don't focus a clicked option.
            <li key={t.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} aria-label={name(t)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(t)}
              className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-md px-3 py-1 text-left text-sm hover:bg-[var(--wh-hover)] ${i === active ? 'bg-[var(--wh-hover)]' : ''}`}>{show(t)}</li>
          ))}
        </ul>
      ) : null}
      {shown && items.length === 0 ? <p className={`m-0 px-3 py-1.5 ${SUB}`}>{`Nothing matches “${q}”.`}</p> : null}
    </div>
  );
}

/** A picked value with Change, in the place of its search (New job's customer, new-job-dialog.tsx). */
export function Picked({ id, labelId, children, onChange, what }: { id: string; labelId: string; children: ReactNode; onChange: () => void; what: string }) {
  return (
    <div role="group" aria-labelledby={labelId} className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] pl-3 text-sm">
      <span className="min-w-0">{children}</span>
      <Button id={id} variant="ghost" size="sm" className="min-h-11" aria-label={`Change ${what}`} onClick={onChange}>Change</Button>
    </div>
  );
}

/** A field's label: on its box while there's one to type in, else naming the picked value's group. */
export function Field({ id, label, sub, picked = false, children }: { id: string; label: string; sub?: ReactNode; picked?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {picked ? <span id={`${id}-l`} className={LABEL}>{label}</span> : <label id={`${id}-l`} htmlFor={id} className={LABEL}>{label}</label>}
      {children}
      {sub ? <span className={SUB}>{sub}</span> : null}
    </div>
  );
}

function Tick({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--wh-ink)]" />
      <span className="flex flex-col gap-0.5">
        <span className="text-size-15 font-semibold">{label}</span>
        {sub ? <span className={SUB}>{sub}</span> : null}
      </span>
    </label>
  );
}

const nameAndPhone = (c: Person) => [c.name, c.phone].filter(Boolean).join(' · ');

export function NewOrder({ today, onClose }: { today: string; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const shop = session.status === 'signed-in' ? session.shop.name : '';
  const settings = useC2wSettings().data?.settings;
  const providers = useQuery({ queryKey: ['c2w-providers'], queryFn: () => apiGet<{ providers: Provider[] }>('/api/c2w/providers') }).data?.providers ?? [];
  const [customer, setCustomer] = useState<Person | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [bike, setBike] = useState<Product | null>(null);
  const [extras, setExtras] = useState<Product[]>([]);
  const [hold, setHold] = useState(true);
  const [email, setEmail] = useState(true);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stock = useQuery({ queryKey: ['product', bike?.id], queryFn: () => apiGet<ProductPage>(`/api/products/${bike?.id}`), enabled: bike !== null });
  // Where the focus goes once the screen has changed: a picked field's Change, or a box to type in.
  const focusNext = useRef<string | null>(null);
  useEffect(() => { if (focusNext.current) { focusById(focusNext.current); focusNext.current = null; } });
  const then = (id: string) => { focusNext.current = id; };

  // One provider is picked for you; with more, the first until another is chosen.
  const provider = providers.find((p) => p.id === providerId) ?? providers[0] ?? null;
  const here = stock.data?.stockAtShops.find((s) => s.here);
  const inStock = here ? here.qty > 0 : null;
  const holdUntil = settings?.holdDays != null ? addDays(today, settings.holdDays) : null;
  const holding = inStock === true && hold;
  const validUntil = settings?.quoteValidDays != null ? addDays(today, settings.quoteValidDays) : null;
  const says = bike && inStock !== null && settings && validUntil
    ? closingFor({ bike: bike.name, holdUntil: holding ? holdUntil : null, inStock, validUntil, rule: settings.orderRule })
    : null;
  const total = (bike?.pricePence ?? 0) + extras.reduce((n, a) => n + a.pricePence, 0);

  async function make() {
    if (!customer || !bike || !provider) {
      setProblem(!customer || !bike ? 'Choose the customer and the bike.' : 'Add a scheme provider in Settings first.');
      return;
    }
    setProblem(null);
    setBusy(true);
    let made: C2wOrder;
    try {
      // Not in stock, the hold stays wanted: the server reads that as "to order".
      made = (await apiMutate<{ order: C2wOrder }>('/api/c2w/orders', { customerId: customer.id, providerId: provider.id, productId: bike.id, accessoryIds: extras.map((a) => a.id), hold: inStock ? hold : true })).order;
    } catch (err) {
      setProblem(words(err, 'Wheelhouse couldn’t make the quote. Try again in a moment.'));
      setBusy(false);
      return;
    }
    const held = made.holdUntil ? ` Bike held until ${longDate(made.holdUntil)}.` : '';
    let note: { text: string; failed: boolean; retry?: boolean } = { text: `Quote ${made.quoteRef} made.${held}`, failed: false };
    if (email && customer.email) {
      try {
        await apiMutate(`/api/c2w/orders/${made.id}/email-quote`, {});
        note = { text: `Quote emailed to ${customer.email}.${held}`, failed: false };
      } catch (err) {
        // Try again on the order when trying again could work: no connection or a fault, not a refusal (set-save-failed).
        note = { text: `Quote ${made.quoteRef} made, not emailed: ${words(err, 'Wheelhouse couldn’t send it.')}`, failed: true, retry: !serverSaid(err) };
      }
    }
    void queryClient.invalidateQueries({ queryKey: ['c2w-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['c2w-count'] });
    navigate(orderHref(made.id), { state: { note } });
  }

  if (adding) return <AddCustomer onClose={() => { setAdding(false); then('no-add'); }} onAdded={(c) => { setCustomer(c); setAdding(false); then('no-cust-change'); }} />;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="no-title" className="md:max-w-[620px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="no-title">New Cycle to Work order</DialogTitle>
          <span className={SUB}>{shop}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Field id="no-cust" label="Customer" picked={customer !== null}>
              {customer
                ? <Picked id="no-cust-change" labelId="no-cust-l" what="the customer" onChange={() => { setCustomer(null); then('no-cust'); }}>{nameAndPhone(customer)}</Picked>
                : <Search<Person> id="no-cust" label="Customer" path="/api/customers" name={(c) => nameAndPhone(c)} onPick={(c) => { setCustomer(c); then('no-cust-change'); }}
                  show={(c) => <><span className="font-bold">{c.name}</span><span className={SUB}>{[c.phone, c.email].filter(Boolean).join(' · ')}</span></>} />}
            </Field>
            <div><Button id="no-add" variant="ghost" size="sm" className="min-h-11" onClick={() => setAdding(true)}>+ New customer</Button></div>
          </div>
          <Field id="no-prov" label="Scheme provider" sub={provider ? `Pays in about ${provider.paysInDays === null ? '[n] days' : plural(provider.paysInDays, 'day', 'days')}` : undefined}>
            <select id="no-prov" className={INPUT} value={provider?.id ?? ''} onChange={(e) => setProviderId(Number(e.target.value))}>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <Field id="no-bike" label="Bike" picked={bike !== null}>
          {bike
            ? <Picked id="no-bike-change" labelId="no-bike-l" what="the bike" onChange={() => { setBike(null); then('no-bike'); }}>{bike.name}</Picked>
            : <Search<Product> id="no-bike" label="Bike" path="/api/products" name={(p) => p.name} onPick={(p) => { setBike(p); then('no-bike-change'); }}
              show={(p) => <><span className="font-bold">{p.name}</span><span className={SUB}>{pounds(p.pricePence)}</span></>} />}
        </Field>
        <Field id="no-acc" label="Accessories" sub="Optional">
          {extras.length ? (
            <ul aria-label="Accessories chosen" className="m-0 flex list-none flex-wrap gap-2 p-0">
              {extras.map((a, i) => (
                <li key={`${a.id}-${i}`} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[var(--wh-input-border)] pl-3 text-sm">
                  {a.name}
                  <Button variant="ghost" size="sm" className="min-h-11" aria-label={`Remove ${a.name}`} onClick={() => { setExtras((x) => x.filter((_, j) => j !== i)); then('no-acc'); }}>✕</Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Search<Product> id="no-acc" label="Accessories" path="/api/products" name={(p) => p.name} onPick={(p) => setExtras((x) => [...x, p])}
            show={(p) => <><span className="font-bold">{p.name}</span><span className={SUB}>{pounds(p.pricePence)}</span></>} />
        </Field>
        {inStock ? (
          <Tick checked={hold} onChange={setHold} label={holdUntil ? `Hold the bike until ${longDate(holdUntil)}` : 'Hold the bike'}
            sub={`${settings?.holdDays != null ? plural(settings.holdDays, 'day', 'days') : '[n] days'}, from Settings. Untick for an easy-to-replace bike.`} />
        ) : null}
        {says ? (
          <div className="rounded-lg border border-dashed border-[var(--wh-input-border)] px-3 py-2.5 text-sm leading-normal">
            <span className="block text-size-13 font-bold text-[var(--wh-muted)]">The quote will say</span>
            <span>{says}</span>
          </div>
        ) : null}
        {customer?.email ? (
          <Tick checked={email} onChange={setEmail} label={`Email the quote to ${customer.email} now`}
            sub={holding ? 'It says the bike is put aside, so no separate “put aside” message goes.' : undefined} />
        ) : null}
        <Kv k="Total (includes VAT)"><span className={mono}>{pounds(total)}</span></Kv>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={busy} onClick={() => void make()}>Make the quote</Button>
      </DialogFooter>
    </Dialog>
  );
}
