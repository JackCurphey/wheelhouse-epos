import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { CHIP } from '@/screens/diary/diary-model.ts';
import { STATE_LABEL, diaryState, shortDay } from '@/screens/diary/rules.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { shortDate } from '@/screens/diary/when.ts';
import { ROUTES } from '@/staff/routes.ts';
import { Field, OnOff, initials } from './customers-page.tsx';

/**
 * A customer's page (drawn as cs-page and cs-page-new, customer.mjs; customer
 * service review 12: one page, one history; openspec/changes/customer-page):
 * who they are with New job, Details with Edit (cs-edit), their bikes, offers,
 * and History: what's open now, then everything else, newest first.
 */
type Customer = {
  createdAt?: string;
  id: number; name: string; phone: string | null; email: string | null; notes: string | null;
  address: string | null; postcode: string | null; marketingPermission: boolean;
  groups: { id: number; name: string; discountPercent: number }[];
};
type Twin = { id: number; name: string; phone: string | null; email: string | null; address: string | null; postcode: string | null; notes: string | null; reason: 'phone' | 'email'; jobs: number; sales: number; createdAt: string };
type Merge = { id: number; otherName: string; mergedAt: string; undoUntil: string };
type Bike = { id: number; make: string | null; model: string | null; colour?: string | null };
type Item =
  | { kind: 'job'; id: number; reference: string; title: string; jobDate: string | null; bookingState: string; custodyState: string; workState: string; mechanicName: string | null; open: boolean; at: string }
  | { kind: 'sale'; id: number; total: number; what: string; at: string }
  | { kind: 'message'; id: number; name: string; channel: string; to: string | null; at: string };
type Filter = 'Everything' | 'Jobs' | 'Sales' | 'Messages';
const KIND: Record<Filter, Item['kind'] | null> = { Everything: null, Jobs: 'job', Sales: 'sale', Messages: 'message' };
const SHOWN = 8;
const mono = 'font-[family-name:var(--wh-font-mono)]';
const money = (pounds: number) => `£${pounds.toFixed(2)}`;
const newJobHref = (id: number) => `${ROUTES.diary}?customer=${id}`;

function Section({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <div className="flex items-center justify-between gap-2 pt-3.5 pb-1.5">
        <h3 id={id} className="m-0 text-[15px] font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// A job's stage word and colour, as the diary says it.
function Stage({ j }: { j: Extract<Item, { kind: 'job' }> }) {
  const state = diaryState({ bookingState: j.bookingState, workState: j.workState });
  const ended = ['cancelled', 'declined', 'expired'].includes(j.bookingState);
  const label = ended ? 'Cancelled' : j.custodyState === 'collected' ? 'Collected' : state === 'hidden' ? null : STATE_LABEL[state];
  if (!label) return null;
  const tone = ended ? CHIP.cancelled : state === 'hidden' ? CHIP.scheduled : CHIP[state];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${tone}`}>{label}</span>;
}

function HistoryRow({ item }: { item: Item }) {
  const tag = (t: string) => <span className="w-[76px] shrink-0 text-[13px] font-bold text-[var(--wh-muted)]">{t}</span>;
  if (item.kind === 'job') {
    const when = [item.jobDate ? shortDay(item.jobDate) : null, item.mechanicName].filter(Boolean).join(' · ');
    return (
      <li className="border-t border-[var(--wh-border)]">
        <Link to={`${ROUTES.diary}?job=${item.id}`} className="flex min-h-[52px] items-center gap-3 text-[var(--wh-ink)] no-underline hover:bg-[var(--wh-hover)]">
          <span className={`w-[76px] shrink-0 text-sm ${mono}`}>{item.reference}</span>
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{item.title}</span>
            {when ? <span className="text-[13px] text-[var(--wh-muted)]">{when}</span> : null}
          </span>
          <Stage j={item} />
        </Link>
      </li>
    );
  }
  if (item.kind === 'sale') {
    return (
      <li className="flex min-h-[52px] items-center gap-3 border-t border-[var(--wh-border)]">
        <span className={`w-[76px] shrink-0 text-sm ${mono}`}>{`Sale ${item.id}`}</span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-[15px] font-semibold">Sale</span>
          <span className="text-[13px] text-[var(--wh-muted)]">{[shortDate(item.at), item.what].filter(Boolean).join(' · ')}</span>
        </span>
        <span className={`text-[15px] ${mono}`}>{money(item.total)}</span>
      </li>
    );
  }
  return (
    <li className="flex min-h-[52px] items-center gap-3 border-t border-[var(--wh-border)]">
      {tag(item.channel === 'email' ? 'Email' : 'Text')}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{item.name}</span>
        <span className="text-[13px] text-[var(--wh-muted)]">{[shortDate(item.at), item.to ? `sent to ${item.to}` : null].filter(Boolean).join(' · ')}</span>
      </span>
    </li>
  );
}

function History({ id }: { id: number }) {
  const history = useQuery({ queryKey: ['customer-history', id], queryFn: () => apiGet<{ items: Item[] }>(`/api/customers/${id}/history`) });
  const [filter, setFilter] = useState<Filter>('Everything');
  const [all, setAll] = useState(false);
  const items = (history.data?.items ?? []).filter((i) => !KIND[filter] || i.kind === KIND[filter]);
  // What's open now is always shown, however much came since (review); the rest eight at a time.
  const open = items.filter((i) => i.kind === 'job' && i.open);
  const rest = items.filter((i) => !(i.kind === 'job' && i.open));
  const earlier = all ? rest : rest.slice(0, Math.max(0, SHOWN - open.length));
  const head = (t: string, listId: string) => <span id={listId} className="pt-2.5 pb-1 text-[13px] font-bold text-[var(--wh-muted)]">{t}</span>;
  return (
    <section aria-labelledby="h-history" className="flex min-w-0 grow flex-col gap-1.5 self-start rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5 max-md:self-stretch">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="h-history" className="m-0 text-[17px] font-bold">History</h3>
        {history.data?.items.length ? (
          <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
            {(Object.keys(KIND) as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setAll(false); }}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${filter === f ? 'border-transparent bg-[var(--wh-accent-soft)] text-[var(--wh-accent-soft-ink)]' : 'border-[var(--wh-input-border)] bg-[var(--wh-panel)]'}`}>{f}</button>
            ))}
          </div>
        ) : null}
      </div>
      {history.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the history. Try again in a moment.</p>
        : !history.data ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
        : history.data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 rounded-[10px] border-2 border-dashed border-[var(--wh-border)] px-4 py-7 text-center">
            <span className="text-base font-bold">Nothing yet</span>
            <p className="m-0 text-sm text-[var(--wh-muted)]">Jobs, sales and messages show here, newest first.</p>
            <Link to={newJobHref(id)} className="inline-flex min-h-11 items-center rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-4 text-sm font-semibold text-[var(--wh-ink)] no-underline">New job</Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {open.length ? <>{head('Open now', 'h-open')}<ul aria-labelledby="h-open" className="m-0 list-none p-0">{open.map((i) => <HistoryRow key={`${i.kind}${i.id}`} item={i} />)}</ul></> : null}
            {earlier.length ? <>{head('Earlier, newest first', 'h-earlier')}<ul aria-labelledby="h-earlier" className="m-0 list-none p-0">{earlier.map((i) => <HistoryRow key={`${i.kind}${i.id}`} item={i} />)}</ul></> : null}
            {!all && open.length + earlier.length < items.length ? (
              <button type="button" onClick={() => setAll(true)} className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline">{`Show all (${items.length})`}</button>
            ) : null}
          </div>
        )}
    </section>
  );
}

function EditCustomer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const queryClient = useQueryClient();
  const groups = useQuery({ queryKey: ['customer-groups'], queryFn: () => apiGet<{ id: number; name: string }[]>('/api/customer-groups') });
  const isPhone = useMedia('(max-width: 767px)');
  const [form, setForm] = useState({
    name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '', address: customer.address ?? '', postcode: customer.postcode ?? '',
    notes: customer.notes ?? '', group: customer.groups[0] ? String(customer.groups[0].id) : 'none', offers: customer.marketingPermission,
  });
  // A customer in more than one group (the old app allows it) keeps them all unless the group is changed here (review).
  const [groupTouched, setGroupTouched] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    if (!form.name.trim()) { setProblem('Add their name.'); return; }
    if (!form.phone.trim() && !form.email.trim()) { setProblem('A phone number or an email — at least one.'); return; }
    setProblem(null);
    setBusy(true);
    try {
      const saved = await apiMutate<Customer>(`/api/customers/${customer.id}`, {
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(), postcode: form.postcode.trim(),
        notes: form.notes.trim(), marketingPermission: form.offers,
        ...(groupTouched ? { groupIds: form.group === 'none' ? [] : [Number(form.group)] } : {}),
      }, { method: 'PUT' });
      queryClient.setQueryData(['customer', customer.id], saved);
      void queryClient.invalidateQueries({ queryKey: ['recent-customers'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      onClose();
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  const two = isPhone ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3';
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="edit-title" className="md:max-w-[640px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="edit-title">{`Edit ${customer.name}’s details`}</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">Nothing changes until you save</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <Field id="edit-name" label="Name" value={form.name} onChange={set('name')} />
        <div className={two}>
          <Field id="edit-phone" label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
          <Field id="edit-email" label="Email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <div className={two}>
          <Field id="edit-address" label="Address" value={form.address} onChange={set('address')} />
          <Field id="edit-postcode" label="Postcode" value={form.postcode} onChange={set('postcode')} />
        </div>
        {groups.data?.length ? (
          <PillGroup legend="Group" value={form.group} onChange={(v) => { setGroupTouched(true); set('group')(v); }}
            options={[{ value: 'none', label: 'None' }, ...groups.data.map((g) => ({ value: String(g.id), label: g.name }))]} />
        ) : null}
        <Field id="edit-note" label="Note" value={form.notes} onChange={set('notes')} />
        <div className="flex items-center gap-3">
          <span id="edit-offers" className="grow text-[15px] font-semibold">Happy to hear about offers</span>
          <OnOff on={form.offers} labelledBy="edit-offers" onChange={() => setForm((f) => ({ ...f, offers: !f.offers }))} />
        </div>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={busy} onClick={() => void save()}>Save changes</Button>
      </DialogFooter>
    </Dialog>
  );
}

const counted = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
// The fields "The same person?" can show, each as its words (address with its postcode).
const MERGE_FIELDS: { key: 'name' | 'phone' | 'email' | 'address' | 'notes'; label: string; of: (c: Pick<Twin, 'name' | 'phone' | 'email' | 'address' | 'postcode' | 'notes'>) => string }[] = [
  { key: 'name', label: 'Name', of: (c) => c.name },
  { key: 'phone', label: 'Phone', of: (c) => c.phone ?? '' },
  { key: 'email', label: 'Email', of: (c) => c.email ?? '' },
  { key: 'address', label: 'Address', of: (c) => [c.address, c.postcode].filter(Boolean).join(', ') },
  { key: 'notes', label: 'Note', of: (c) => c.notes ?? '' },
];

/** The same person? (cs-merge): only what differs, a choice of each, Merge into one or They're different people. */
function MergeDialog({ me, twin, myJobs, mySales, onClose }: { me: Customer & { createdAt?: string }; twin: Twin; myJobs: number; mySales: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const differs = MERGE_FIELDS.filter((f) => f.of(me).trim() !== f.of(twin).trim());
  const [keep, setKeep] = useState<Record<string, 'this' | 'other'>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const same = twin.reason === 'phone' ? me.phone : me.email;
  async function act(path: string, body: object) {
    setBusy(true);
    setProblem(null);
    try {
      await apiMutate(path, body);
      for (const key of [['customer', me.id], ['customer-history', me.id], ['customer-bikes', me.id], ['possible-duplicates', me.id], ['customer-merges', me.id], ['recent-customers'], ['search']]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      onClose();
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t do that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }
  const pick = (key: string, side: 'this' | 'other') => setKeep((k) => ({ ...k, [key]: side }));
  const option = (key: string, side: 'this' | 'other', words: string) => {
    const on = (keep[key] ?? 'this') === side;
    return (
      <button type="button" aria-pressed={on} onClick={() => pick(key, side)}
        className={`flex min-h-11 items-center gap-2 rounded-lg border bg-[var(--wh-panel)] px-3 text-left text-sm ${on ? 'border-[var(--wh-ink)]' : 'border-[var(--wh-border)]'}`}>
        <span aria-hidden="true" className="w-4">{on ? '✓' : ''}</span>{words || 'Nothing'}
      </button>
    );
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="merge-title" className="md:max-w-[760px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="merge-title">The same person?</DialogTitle>
          <span className="text-[13px] text-[var(--wh-muted)]">Pick what to keep. Jobs, sales and bikes from both are kept together.</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-2">
        <div className="grid grid-cols-[120px_1fr_1fr] gap-2.5 max-md:hidden">
          <span />
          {[[me.name, myJobs, mySales], [twin.name, twin.jobs, twin.sales]].map(([name, jobs, sales]) => (
            <span key={String(name)} className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold">{name}</span>
              <span className="text-[13px] text-[var(--wh-muted)]">{`${counted(Number(jobs), 'job')} · ${counted(Number(sales), 'sale')}`}</span>
            </span>
          ))}
        </div>
        {same ? <p className="m-0 text-sm text-[var(--wh-muted)]">{`Only what’s different is shown. Both have ${same}.`}</p> : null}
        {differs.map((f) => (
          <div key={f.key} role="group" aria-label={f.label} className="grid grid-cols-[120px_1fr_1fr] items-center gap-2.5 border-t border-[var(--wh-border)] py-2 max-md:grid-cols-1">
            <span aria-hidden="true" className="text-[13px] font-bold text-[var(--wh-muted)]">{f.label}</span>
            {option(f.key, 'this', f.of(me))}
            {option(f.key, 'other', f.of(twin))}
          </div>
        ))}
        <p className="m-0 text-sm text-[var(--wh-muted)]">{`${me.createdAt ? `Added on ${shortDate(me.createdAt)} and ${shortDate(twin.createdAt)}. ` : ''}Merging can be undone from the customer’s page for 30 days.`}</p>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" disabled={busy} onClick={() => void act(`/api/customers/${me.id}/not-duplicate`, { otherId: twin.id })}>They’re different people</Button>
        <Button variant="accent" disabled={busy} onClick={() => void act(`/api/customers/${me.id}/merge`, { otherId: twin.id, keep: Object.fromEntries(differs.map((f) => [f.key, keep[f.key] ?? 'this'])) })}>Merge into one</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** The flagged duplicates and the merges that can still be undone, at the top of the page (cs-page-dup; design 7). */
function Duplicates({ me }: { me: Customer & { createdAt?: string } }) {
  const queryClient = useQueryClient();
  const twins = useQuery({ queryKey: ['possible-duplicates', me.id], queryFn: () => apiGet<Twin[]>(`/api/customers/${me.id}/possible-duplicates`) });
  const merges = useQuery({ queryKey: ['customer-merges', me.id], queryFn: () => apiGet<Merge[]>(`/api/customers/${me.id}/merges`) });
  const history = useQuery({ queryKey: ['customer-history', me.id], queryFn: () => apiGet<{ items: Item[] }>(`/api/customers/${me.id}/history`) });
  const [checking, setChecking] = useState<Twin | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const box = 'flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--wh-ink)] bg-[var(--wh-panel)] py-2 pr-2 pl-3.5';
  async function undo(m: Merge) {
    setProblem(null);
    try {
      await apiMutate(`/api/customer-merges/${m.id}/undo`, {});
      for (const key of [['customer', me.id], ['customer-history', me.id], ['customer-bikes', me.id], ['possible-duplicates', me.id], ['customer-merges', me.id], ['recent-customers'], ['search']]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t undo that. Try again in a moment.');
    }
  }
  const items = history.data?.items ?? [];
  return (
    <>
      {(merges.data ?? []).map((m) => (
        <div key={m.id} role="status" className={box}>
          <span className="grow text-[15px]">{`Merged with ${m.otherName} on ${shortDate(m.mergedAt)} · can be undone until ${shortDate(m.undoUntil)}`}</span>
          <Button onClick={() => void undo(m)}>Undo the merge</Button>
        </div>
      ))}
      {(twins.data ?? []).map((t) => (
        <div key={t.id} role="status" className={box}>
          <span className="grow text-[15px]"><strong>{`Might be the same person as ${t.name}`}</strong> <span className="text-[var(--wh-muted)]">{t.reason === 'phone' ? '· same phone number' : '· same email address'}</span></span>
          <Button onClick={() => setChecking(t)}>Check</Button>
        </div>
      ))}
      {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      {checking ? (
        <MergeDialog me={me} twin={checking} myJobs={items.filter((i) => i.kind === 'job').length} mySales={items.filter((i) => i.kind === 'sale').length} onClose={() => setChecking(null)} />
      ) : null}
    </>
  );
}

export function CustomerPage() {
  // A customer's number from the address; anything else is no such customer.
  const id = Number(useParams().id ?? '');
  const isPhone = useMedia('(max-width: 767px)');
  const known = Number.isInteger(id);
  const customer = useQuery({ queryKey: ['customer', id], queryFn: () => apiGet<Customer>(`/api/customers/${id}`), retry: false, enabled: known });
  const bikes = useQuery({ queryKey: ['customer-bikes', id], queryFn: () => apiGet<Bike[]>(`/api/customers/${id}/bikes`), enabled: known });
  const [editing, setEditing] = useState(false);
  const back = <Link to={ROUTES.customers} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline"><span aria-hidden="true">‹</span>Customers</Link>;
  if (!known || customer.isError) {
    return <div className="flex flex-col gap-2.5">{back}<p role="alert" className="m-0 text-sm">{!known || (customer.error instanceof ApiError && customer.error.status === 404) ? 'There’s no such customer.' : 'Wheelhouse couldn’t load this customer. Try again in a moment.'}</p></div>;
  }
  const c = customer.data;
  if (!c) return <div className="flex flex-col gap-2.5">{back}<p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></div>;
  const group = c.groups[0];
  return (
    <div className="flex flex-col gap-2.5">
      {back}
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--wh-surface-muted)] text-[17px] font-bold">{initials(c.name)}</span>
        <span className="flex grow flex-col gap-[3px]">
          <h2 className="m-0 text-[22px] font-bold">{c.name}</h2>
          <span className="text-sm text-[var(--wh-muted)]">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
        </span>
        <Link to={newJobHref(c.id)} className="inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--wh-on-brand)] no-underline">New job</Link>
      </div>
      <Duplicates me={c} />
      <div className={`flex gap-4 ${isPhone ? 'flex-col' : 'flex-row items-start'}`}>
        <div className={`flex shrink-0 flex-col rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] pt-1 pb-3.5 ${isPhone ? '' : 'w-80'}`}>
          <Section id="h-details" title="Details" action={<button type="button" onClick={() => setEditing(true)} className="min-h-11 px-2 text-sm font-semibold underline">Edit</button>}>
            {c.address || c.postcode ? (
              <div className="flex flex-col gap-1 border-t border-[var(--wh-border)] py-2">
                <span className="text-[13px] text-[var(--wh-muted)]">Address</span>
                <span className="text-[15px] leading-[1.45]">{c.address ? <span className="block">{c.address}</span> : null}{c.postcode ? <span className="block">{c.postcode}</span> : null}</span>
              </div>
            ) : null}
            {group ? (
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--wh-border)] py-2">
                <span className="text-[13px] text-[var(--wh-muted)]">Group</span>
                <span className="text-right text-[15px] font-semibold">{`${group.name} · ${group.discountPercent}% off`}</span>
              </div>
            ) : null}
            {c.notes ? (
              <div className="flex flex-col gap-1 rounded-lg bg-[var(--wh-surface-muted)] px-3 py-2.5">
                <span className="text-[13px] font-bold">Note</span>
                <span className="text-sm leading-[1.45]">{c.notes}</span>
              </div>
            ) : null}
          </Section>
          <Section id="h-bikes" title="Bikes">
            {bikes.data?.length ? (
              <ul className="m-0 list-none p-0">
                {bikes.data.map((b) => (
                  <li key={b.id} className="flex flex-col gap-1 border-t border-[var(--wh-border)] py-2.5">
                    <span className="text-[15px] font-semibold">{[b.make, b.model].filter(Boolean).join(' ') || 'A bike'}</span>
                    {b.colour ? <span className="text-[13px] text-[var(--wh-muted)]">{b.colour}</span> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="m-0 border-t border-[var(--wh-border)] py-2.5 text-sm text-[var(--wh-muted)]">{bikes.data ? 'No bikes yet.' : 'Loading…'}</p>}
          </Section>
          <Section id="h-glance" title="At a glance">
            <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-[var(--wh-border)]">
              <span className="text-[15px] font-semibold">Happy to hear about offers</span>
              <span className={`text-sm font-semibold ${c.marketingPermission ? '' : 'text-[var(--wh-muted)]'}`}>{c.marketingPermission ? 'On' : 'Off'}</span>
            </div>
          </Section>
        </div>
        <History id={c.id} />
      </div>
      {editing ? <EditCustomer customer={c} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
