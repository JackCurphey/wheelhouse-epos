import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { PrivacyLink } from './privacy-requests.tsx';

/**
 * Front desk › Customers (drawn as cs-list, cs-add and cs-add-match in
 * customer.mjs; customer service review 3, 5 and 12;
 * openspec/changes/customers-list): the recent customers, with the header
 * search for anyone else, and Add a customer, which shows a customer who
 * already has the phone or email before anyone is added twice. A customer
 * can be a company or club (cs-add-company; openspec/changes/company-customers).
 */
type Recent = { id: number; name: string; phone: string | null; email: string | null; bikeLabel: string | null };
type Group = { id: number; name: string };
export const customerHref = (id: number) => `${ROUTES.customers}/${id}`;
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
const mono = 'font-[family-name:var(--wh-font-mono)]';

function Row({ c, phone }: { c: Recent; phone: boolean }) {
  return (
    <li className="border-t border-[var(--wh-border)] first:border-t-0">
      <Link to={customerHref(c.id)} className="flex min-h-[60px] items-center gap-3 px-3.5 text-[var(--wh-ink)] no-underline hover:bg-[var(--wh-hover)]">
        <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--wh-surface-muted)] text-size-13 font-bold">{initials(c.name)}</span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-size-15 font-bold">{c.name}</span>
          {c.bikeLabel ? <span className="text-size-13 text-[var(--wh-muted)]">{c.bikeLabel}</span> : null}
        </span>
        {!phone && c.phone ? <span className={`${mono} text-sm text-[var(--wh-muted)]`}>{c.phone}</span> : null}
      </Link>
    </li>
  );
}

export function Field({ id, label, value, onChange, type = 'text', placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-size-15 font-semibold">{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2.5 text-size-15" />
    </div>
  );
}

/** Happy to hear about offers' switch: On or Off in words, and the track (cs-add). */
export function OnOff({ on, labelledBy, onChange }: { on: boolean; labelledBy: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-labelledby={labelledBy} onClick={onChange}
      className="inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1">
      <span className={`text-sm font-semibold ${on ? '' : 'text-[var(--wh-muted)]'}`}>{on ? 'On' : 'Off'}</span>
      <span aria-hidden="true" className={`relative inline-block h-[26px] w-11 rounded-full ${on ? 'bg-[var(--wh-brand)]' : 'bg-[var(--wh-input-border)]'}`}>
        <span className={`absolute top-[3px] size-5 rounded-full bg-[var(--wh-panel)] shadow ${on ? 'left-[21px]' : 'left-[3px]'}`} />
      </span>
    </button>
  );
}

/** "This is" (cs-add-company): a person, or a company or club. */
export const WHO = [{ value: 'person', label: 'A person' }, { value: 'company', label: 'A company or club' }];
export type Who = 'person' | 'company';

/** A company's name and contact, in place of Name (cs-add-company). */
export function CompanyNames({ prefix, name, contact, onName, onContact }: { prefix: string; name: string; contact: string; onName: (v: string) => void; onContact: (v: string) => void }) {
  return (
    <>
      <Field id={`${prefix}-company`} label="Company or club name" value={name} onChange={onName} placeholder="e.g. the club’s name" />
      <Field id={`${prefix}-contact`} label="Contact name" value={contact} onChange={onContact} placeholder="Who we deal with" />
    </>
  );
}
/**
 * A company's VAT number and Send invoices to, after the address
 * (cs-add-company). `optional` adds "(optional)", as Add labels its optional
 * boxes and Edit doesn't.
 */
export function CompanyInvoice({ prefix, optional, vat, invoice, onVat, onInvoice, className }: { prefix: string; optional: boolean; vat: string; invoice: string; onVat: (v: string) => void; onInvoice: (v: string) => void; className: string }) {
  const o = optional ? ' (optional)' : '';
  return (
    <div className={className}>
      <Field id={`${prefix}-vat`} label={`VAT number${o}`} value={vat} onChange={onVat} placeholder="For VAT invoices" />
      <Field id={`${prefix}-invoice`} label={`Send invoices to${o}`} type="email" value={invoice} onChange={onInvoice} placeholder="The contact’s email if blank" />
    </div>
  );
}
/** What's missing from a company's names, in the pop-up's words, or null. */
export const companyProblem = (name: string, contact: string) =>
  !name.trim() ? 'Add the company or club’s name.' : !contact.trim() ? 'Add the contact’s name.' : null;

/** The phone or email typed, once typing pauses, matched against the shop's customers (cs-add-match). */
function useMatch(phone: string, email: string) {
  const [asked, setAsked] = useState({ phone: '', email: '' });
  useEffect(() => {
    const t = setTimeout(() => setAsked({ phone: phone.trim(), email: email.trim() }), 300);
    return () => clearTimeout(t);
  }, [phone, email]);
  const worth = asked.phone.replace(/\D/g, '').length >= 7 || asked.email.includes('@');
  const found = useQuery({
    queryKey: ['customer-matches', asked.phone, asked.email],
    queryFn: () => apiGet<Recent[]>(`/api/customer-matches?${new URLSearchParams(asked)}`),
    enabled: worth,
  });
  return worth ? found.data?.[0] ?? null : null;
}

function AddCustomer({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const groups = useQuery({ queryKey: ['customer-groups'], queryFn: () => apiGet<Group[]>('/api/customer-groups') });
  const [form, setForm] = useState({ who: 'person' as Who, name: '', contactName: '', vatNumber: '', invoiceEmail: '', phone: '', email: '', address: '', postcode: '', notes: '', group: 'none', offers: false });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const match = useMatch(form.phone, form.email);
  const isPhone = useMedia('(max-width: 767px)');
  // Matched by the email typed, or else by the number, however it was written (+44 or 07…).
  const matchedBy = match && form.email.trim() && match.email?.trim().toLowerCase() === form.email.trim().toLowerCase() ? 'email address' : 'number';

  async function add() {
    const company = form.who === 'company';
    const missing = company ? companyProblem(form.name, form.contactName) : !form.name.trim() ? 'Add their name.' : null;
    if (missing) { setProblem(missing); return; }
    if (!form.phone.trim() && !form.email.trim()) { setProblem('A phone number or an email — at least one.'); return; }
    setProblem(null);
    setBusy(true);
    try {
      const made = await apiMutate<{ id: number }>('/api/customers', {
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(), postcode: form.postcode.trim(),
        notes: form.notes.trim(), marketingPermission: form.offers, groupIds: form.group === 'none' ? [] : [Number(form.group)],
        ...(company ? { isCompany: true, contactName: form.contactName.trim(), vatNumber: form.vatNumber.trim(), invoiceEmail: form.invoiceEmail.trim() } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ['recent-customers'] });
      navigate(customerHref(made.id));
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t add them. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  const two = isPhone ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3';
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="add-title" className="md:max-w-[640px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="add-title">Add a customer</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">Only a name and one way to reach them are needed</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <PillGroup legend="This is" value={form.who} onChange={(v) => setForm((f) => ({ ...f, who: v as Who }))} options={WHO} />
        {form.who === 'company'
          ? <CompanyNames prefix="add" name={form.name} contact={form.contactName} onName={set('name')} onContact={set('contactName')} />
          : <Field id="add-name" label="Name" value={form.name} onChange={set('name')} placeholder="First and last name" />}
        <div className={two}>
          <Field id="add-phone" label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
          <Field id="add-email" label="Email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">A phone number or an email — at least one.</p>
        {match ? (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3 py-2.5">
            <span className="flex grow flex-col gap-0.5">
              <span className="text-size-15 font-bold">{`${match.name} already has this ${matchedBy}`}</span>
              <span className="text-size-13 text-[var(--wh-muted)]">{[match.phone, match.bikeLabel].filter(Boolean).join(' · ')}</span>
            </span>
            <Link to={customerHref(match.id)} onClick={onClose} className="inline-flex min-h-11 items-center rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-sm font-semibold text-[var(--wh-ink)] no-underline">{`Use ${match.name}`}</Link>
          </div>
        ) : null}
        <div className={two}>
          <Field id="add-address" label="Address (optional)" value={form.address} onChange={set('address')} />
          <Field id="add-postcode" label="Postcode (optional)" value={form.postcode} onChange={set('postcode')} />
        </div>
        {form.who === 'company'
          ? <CompanyInvoice prefix="add" optional className={two} vat={form.vatNumber} invoice={form.invoiceEmail} onVat={set('vatNumber')} onInvoice={set('invoiceEmail')} />
          : null}
        {groups.data?.length ? (
          <PillGroup legend="Group (optional)" value={form.group} onChange={set('group')}
            options={[{ value: 'none', label: 'None' }, ...groups.data.map((g) => ({ value: String(g.id), label: g.name }))]} />
        ) : null}
        <Field id="add-note" label="Note (optional)" value={form.notes} onChange={set('notes')} placeholder="e.g. prefers texts, not calls" />
        <div className="flex items-center gap-3">
          <span className="flex grow flex-col gap-0.5">
            <span id="add-offers" className="text-size-15 font-semibold">Happy to hear about offers</span>
            <span className="text-size-13 text-[var(--wh-muted)]">Only if they say yes. Job updates always go.</span>
          </span>
          <OnOff on={form.offers} labelledBy="add-offers" onChange={() => setForm((f) => ({ ...f, offers: !f.offers }))} />
        </div>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="accent" disabled={busy} onClick={() => void add()}>Add the customer</Button>
      </DialogFooter>
    </Dialog>
  );
}

export function CustomersPage() {
  const isPhone = useMedia('(max-width: 767px)');
  const recent = useQuery({ queryKey: ['recent-customers'], queryFn: () => apiGet<Recent[]>('/api/recent-customers') });
  const [adding, setAdding] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h2 id="recent-title" className="m-0 text-xl font-bold">Recent customers</h2>
          <p className="m-0 text-sm text-[var(--wh-muted)]">To find anyone else, use the search at the top — by name, phone, email or postcode.</p>
        </div>
        <Button variant="accent" onClick={() => setAdding(true)}>+ Add a customer</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
        {recent.isError ? <p role="alert" className="m-0 px-3.5 py-3 text-sm">Wheelhouse couldn’t load the customers. Try again in a moment.</p>
          : !recent.data ? <p className="m-0 px-3.5 py-3 text-sm text-[var(--wh-muted)]">Loading…</p>
          : recent.data.length === 0 ? <p className="m-0 px-3.5 py-3 text-sm text-[var(--wh-muted)]">No customers yet.</p>
          : <ul aria-labelledby="recent-title" className="m-0 list-none p-0">{recent.data.map((c) => <Row key={c.id} c={c} phone={isPhone} />)}</ul>}
      </div>
      <PrivacyLink />
      {adding ? <AddCustomer onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
