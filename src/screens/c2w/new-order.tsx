import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { AddCustomer } from '@/screens/customers/customers-page.tsx';
import { Kv, addDays, closingFor, longDate, mono, orderHref, plural, pounds, today, useC2wSettings, type C2wOrder, type Provider } from './c2w-bits.tsx';

/**
 * New Cycle to Work order (c2w.mjs newOrder; cw-new, cw-new-not-in-stock;
 * edge 6c, + New customer). The Bike line's stock words ("1 free at Bolton ·
 * none held") wait for pull request 5's stock reply (logged); until then the
 * site's stock figure decides whether the hold is offered, as the server's
 * freeHere does. Make the quote makes the order, then emails it if ticked,
 * and opens the order with the drawn note.
 */
type Person = { id: number; name: string; phone: string | null; email: string | null };
type Product = { id: number; name: string; sku: string | null; pricePence: number };
type ProductPage = { stockAtShops: { id: number; name: string; qty: number; here: boolean }[] };

const LABEL = 'text-sm font-semibold';
const INPUT = 'min-h-11 w-full rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm';
const SUB = 'text-size-13 text-[var(--wh-muted)]';
const words = (err: unknown, fallback: string) => (serverSaid(err) ? err.message : fallback);

/** A search box with its matches under it; picking one hands it back. */
function Search<T extends { id: number }>({ id, label, path, show, onPick }: { id: string; label: string; path: string; show: (t: T) => ReactNode; onPick: (t: T) => void }) {
  const [term, setTerm] = useState('');
  const q = term.trim();
  const found = useQuery({ queryKey: ['c2w-search', path, q], queryFn: () => apiGet<T[]>(`${path}?search=${encodeURIComponent(q)}`), enabled: q.length >= 2 });
  return (
    <div className="relative flex flex-col gap-1.5">
      <input id={id} type="search" aria-label={label} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Type to search" autoComplete="off" className={INPUT} />
      <span role="status" className="sr-only">{found.data ? (found.data.length ? `${found.data.length} found.` : `Nothing matches “${q}”.`) : ''}</span>
      {q.length >= 2 && found.data ? (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-1">
          {found.data.map((t) => (
            <button key={t.id} type="button" onClick={() => { onPick(t); setTerm(''); }} className="flex min-h-11 flex-col justify-center rounded-md px-3 py-1 text-left text-sm hover:bg-[var(--wh-hover)]">{show(t)}</button>
          ))}
          {found.data.length === 0 ? <span className={`px-3 py-1.5 ${SUB}`}>{`Nothing matches “${q}”.`}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A picked value with Change, in the place of its search (New job's customer, new-job-dialog.tsx). */
function Picked({ children, onChange, label }: { children: ReactNode; onChange: () => void; label: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] pl-3 text-sm">
      <span className="min-w-0">{children}</span>
      <Button variant="ghost" size="sm" aria-label={`Change ${label}`} onClick={onChange}>Change</Button>
    </div>
  );
}

function Field({ id, label, sub, children }: { id: string; label: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>{label}</label>
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

export function NewOrder({ onClose }: { onClose: () => void }) {
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

  // One provider is picked for you; with more, the first until another is chosen.
  const provider = providers.find((p) => p.id === providerId) ?? providers[0] ?? null;
  const here = stock.data?.stockAtShops.find((s) => s.here);
  const inStock = here ? here.qty > 0 : null;
  const now = today();
  const holdUntil = settings?.holdDays != null ? addDays(now, settings.holdDays) : null;
  const holding = inStock === true && hold;
  const validUntil = settings?.quoteValidDays != null ? addDays(now, settings.quoteValidDays) : null;
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
    let text = `Quote ${made.quoteRef} made.${held}`;
    let failed = false;
    if (email && customer.email) {
      try {
        await apiMutate(`/api/c2w/orders/${made.id}/email-quote`, {});
        text = `Quote emailed to ${customer.email}.${held}`;
      } catch (err) {
        text = `Quote ${made.quoteRef} made, not emailed: ${words(err, 'Wheelhouse couldn’t send it. Try again from the order.')}`;
        failed = true;
      }
    }
    void queryClient.invalidateQueries({ queryKey: ['c2w-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['c2w-count'] });
    navigate(orderHref(made.id), { state: { note: { text, failed } } });
  }

  if (adding) return <AddCustomer onClose={() => setAdding(false)} onAdded={(c) => { setCustomer(c); setAdding(false); }} />;
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
            <Field id="no-cust" label="Customer">
              {customer
                ? <Picked label="the customer" onChange={() => setCustomer(null)}>{[customer.name, customer.phone].filter(Boolean).join(' · ')}</Picked>
                : <Search<Person> id="no-cust" label="Customer" path="/api/customers" onPick={setCustomer} show={(c) => <><span className="font-bold">{c.name}</span><span className={SUB}>{[c.phone, c.email].filter(Boolean).join(' · ')}</span></>} />}
            </Field>
            <div><Button variant="ghost" size="sm" className="min-h-11" onClick={() => setAdding(true)}>+ New customer</Button></div>
          </div>
          <Field id="no-prov" label="Scheme provider" sub={provider ? `Pays in about ${provider.paysInDays === null ? '[n] days' : plural(provider.paysInDays, 'day', 'days')}` : undefined}>
            <select id="no-prov" className={INPUT} value={provider?.id ?? ''} onChange={(e) => setProviderId(Number(e.target.value))}>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <Field id="no-bike" label="Bike">
          {bike
            ? <Picked label="the bike" onChange={() => setBike(null)}>{bike.name}</Picked>
            : <Search<Product> id="no-bike" label="Bike" path="/api/products" onPick={setBike} show={(p) => <><span className="font-bold">{p.name}</span><span className={SUB}>{pounds(p.pricePence)}</span></>} />}
        </Field>
        <Field id="no-acc" label="Accessories" sub="Optional">
          {extras.length ? (
            <ul aria-label="Accessories chosen" className="m-0 flex list-none flex-wrap gap-2 p-0">
              {extras.map((a, i) => (
                <li key={`${a.id}-${i}`} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[var(--wh-input-border)] pl-3 text-sm">
                  {a.name}
                  <Button variant="ghost" size="sm" aria-label={`Remove ${a.name}`} onClick={() => setExtras((x) => x.filter((_, j) => j !== i))}>✕</Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Search<Product> id="no-acc" label="Accessories" path="/api/products" onPick={(p) => setExtras((x) => [...x, p])} show={(p) => <><span className="font-bold">{p.name}</span><span className={SUB}>{pounds(p.pricePence)}</span></>} />
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
