import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { penceText, parseTotal } from '@/lib/cash-count.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { shortDate } from '@/screens/diary/when.ts';
import { Field } from './customers-page.tsx';
import { AMOUNT_WORDS, UndoEntryDialog, amountOf } from './credit-dialog.tsx';
import { TransferDialog } from './transfer-dialog.tsx';

/**
 * A customer's account (drawn as cs-account in customer.mjs; customer service decision 7; Owner
 * setup decision 7; openspec/changes/finish-customers, design 8; Jack's 9 Nov answers 2 and 5):
 * Owes now, Most [name] can owe (the Owner's to change, until there are managers), the statement
 * newest first, Email the statement and Record a bank transfer. "Take a payment at the till"
 * comes with the till's half (question 20). Someone without an account is offered one by the
 * Owner; what they owed before Wheelhouse is typed once.
 */
export type Entry = {
  id: number; kind: 'opening' | 'sale_on_account' | 'bank_transfer' | 'till_payment' | 'undo'; changePence: number; reference: string | null;
  receivedOn: string | null; saleId: number | null; tillSaleId: number | null; reason: string | null; by: string | null; at: string; undone: boolean; undoesKind: string | null;
};
export type Account = { owed: number; hasAccount: boolean; limit: number | null; ownLimit: number | null; shopLimit: number | null; overBy: number; hasOpening: boolean; statement: Entry[]; today: string };
export const canSay = (err: unknown): err is ApiError => err instanceof ApiError && err.status < 500 && err.hasServerMessage;
const mono = 'font-[family-name:var(--wh-font-mono)]';
export const signed = (pence: number) => `${pence < 0 ? '−' : '+'}${penceText(Math.abs(pence))}`;
const limitText = (pence: number | null) => (pence === null ? 'No limit set' : penceText(pence));
// "Maya" from "Maya Patel", as the drawing names her; a company keeps its whole name.
export const firstName = (name: string, company?: boolean) => (company ? name : name.trim().split(/\s+/)[0] || name);

/** What a statement line says, as drawn ("Paid by bank transfer · [reference]"). */
export function entryWords(e: Entry) {
  if (e.kind === 'opening') return 'Owed from before Wheelhouse';
  if (e.kind === 'bank_transfer') return ['Paid by bank transfer', e.reference].filter(Boolean).join(' · ');
  if (e.kind === 'sale_on_account') return ['Sale on account', e.tillSaleId ?? e.saleId].filter(Boolean).join(' · ');
  if (e.kind === 'till_payment') return 'Paid at the till';
  return ['Put right', e.reason].filter(Boolean).join(' · ');
}
const entryDay = (e: Entry) => shortDate(e.receivedOn ? `${e.receivedOn}T12:00:00Z` : e.at);

export const accountKey = (customerId: number) => ['customer-account', customerId];
export function useInvalidate(customerId: number) {
  const queryClient = useQueryClient();
  return () => Promise.all([accountKey(customerId), ['customer', customerId], ['customer-history', customerId]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

function Big({ label, pence }: { label: string; pence: number }) {
  return (
    <div className="flex grow flex-col gap-1 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3">
      <span className="text-size-13 text-[var(--wh-muted)]">{label}</span>
      <span className={`text-size-20 ${mono}`}>{penceText(pence)}</span>
    </div>
  );
}

export function AccountDialog({ customerId, name, isCompany, onClose }: { customerId: number; name: string; isCompany?: boolean; onClose: () => void }) {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const account = useQuery({ queryKey: accountKey(customerId), queryFn: () => apiGet<Account>(`/api/customers/${customerId}/account`) });
  const invalidate = useInvalidate(customerId);
  const [paying, setPaying] = useState(false);
  const [undoing, setUndoing] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const first = firstName(name, isCompany);
  const a = account.data;

  async function act(url: string, body: unknown, done: (result: { to?: string }) => string | null, method: 'POST' | 'PUT' = 'POST') {
    setBusy(true);
    setSaid(null);
    try {
      const result = await apiMutate<{ to?: string }>(url, body, { method });
      await invalidate();
      const words = done(result ?? {});
      if (words) setSaid({ ok: true, words });
    } catch (err) {
      setSaid({ ok: false, words: canSay(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o && !paying && !undoing) onClose(); }} aria-labelledby="acct-title" className="md:max-w-[640px]">
        <DialogHeader>
          <DialogTitle id="acct-title">{`${name}’s account`}</DialogTitle>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Pay later, settled from here</p>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {account.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the account. Try again in a moment.</p> : null}
          {!a && !account.isError ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p> : null}
          {a && !a.hasAccount ? (
            // Only customers the Owner gives an account can owe (Jack's 9 Nov answer 2).
            <div className="flex flex-col gap-2">
              <p className="m-0 text-size-15">{`${name} doesn’t have an account yet.`}</p>
              {owner
                ? <div><Button variant="default" disabled={busy} onClick={() => void act(`/api/customers/${customerId}/account/open`, {}, () => null)}>{`Give ${first} an account`}</Button></div>
                : <p className="m-0 text-sm text-[var(--wh-muted)]">Only the shop’s owner can give someone an account.</p>}
            </div>
          ) : null}
          {a?.hasAccount ? (
            <>
              <div className="flex flex-wrap gap-2.5"><Big label="Owes now" pence={a.owed} /></div>
              <LimitRow customerId={customerId} first={first} account={a} owner={owner} onSaved={invalidate} />
              {owner && !a.hasOpening ? <OpeningRow customerId={customerId} onSaved={invalidate} /> : null}
              <section aria-labelledby="acct-statement" className="flex flex-col">
                <h3 id="acct-statement" className="m-0 pb-1.5 text-size-15 font-bold">Statement</h3>
                {a.statement.length ? (
                  <ul className="m-0 list-none p-0">
                    {a.statement.map((e) => (
                      <li key={e.id} className="flex min-h-12 items-center gap-3 border-t border-[var(--wh-border)]">
                        <span className="flex grow flex-col gap-0.5">
                          <span className={`text-size-15 ${e.undone ? 'line-through' : ''}`}>{entryWords(e)}</span>
                          <span className="text-size-13 text-[var(--wh-muted)]">{[entryDay(e), e.undone ? 'undone' : null].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className={`text-size-15 ${mono}`}>{signed(e.changePence)}</span>
                        {owner && e.kind === 'bank_transfer' && !e.undone
                          ? <button type="button" aria-label={`Undo ${entryWords(e)}`} onClick={() => setUndoing(e)} className="min-h-11 px-2 text-sm font-semibold underline">Undo</button>
                          : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="m-0 border-t border-[var(--wh-border)] py-2.5 text-sm text-[var(--wh-muted)]">Nothing on the statement yet.</p>}
              </section>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" disabled={busy} onClick={() => void act(`/api/customers/${customerId}/account/email-statement`, {}, (r) => `Sent to ${r.to}`)}>Email the statement</Button>
                {a.owed > 0 ? <Button variant="default" disabled={busy} onClick={() => setPaying(true)}>Record a bank transfer</Button> : null}
              </div>
            </>
          ) : null}
          {said ? <p role={said.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${said.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{said.words}</p> : null}
        </DialogBody>
        <DialogFooter className="flex justify-end gap-2.5">
          {/* "Take a payment at the till" comes with the till's half (question 20). */}
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </Dialog>
      {paying && a ? <TransferDialog customerId={customerId} first={first} owed={a.owed} today={a.today} onClose={() => setPaying(false)} /> : null}
      {undoing ? <UndoEntryDialog url={`/api/account-entries/${undoing.id}/undo`} invalidate={[accountKey(customerId), ['customer', customerId], ['customer-history', customerId]]} onClose={() => setUndoing(null)} /> : null}
    </>
  );
}

// "Most [name] can owe": the Owner types it (blank for the shop's), saved as he leaves the box,
// as Ways to pay's limit is; everyone else reads it.
function LimitRow({ customerId, first, account, owner, onSaved }: { customerId: number; first: string; account: Account; owner: boolean; onSaved: () => Promise<unknown> }) {
  const [typed, setTyped] = useState(account.ownLimit === null ? '' : (account.ownLimit / 100).toFixed(2));
  const [problem, setProblem] = useState<string | null>(null);
  const shops = account.shopLimit === null ? 'the shop has no limit' : `the shop’s is ${penceText(account.shopLimit)}`;
  async function save() {
    const t = typed.trim();
    let pence: number | null = null;
    if (t) {
      const read = parseTotal(t);
      if (!read || 'invalid' in read) { setProblem(AMOUNT_WORDS); return; }
      pence = read.pence;
    }
    if (pence === account.ownLimit) return;
    setProblem(null);
    try {
      await apiMutate(`/api/customers/${customerId}/account/limit`, { pence }, { method: 'PUT' });
      await onSaved();
    } catch (err) {
      setProblem(canSay(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    }
  }
  if (!owner) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-size-15 font-semibold">{`Most ${first} can owe`}</span>
          <span className="text-size-13 text-[var(--wh-muted)]">{`The shop’s owner can change it · ${shops}`}</span>
        </span>
        <span className={`text-size-17 ${mono}`}>{limitText(account.limit)}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Field id="acct-limit" label={`Most ${first} can owe`} placeholder={account.shopLimit === null ? '' : penceText(account.shopLimit)} value={typed} onChange={setTyped} onBlur={() => void save()} />
      <span className="text-size-13 text-[var(--wh-muted)]">{`Leave it empty for the shop’s · ${shops}`}</span>
      {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
    </div>
  );
}

// What was owed before Wheelhouse, typed once by the Owner (Jack's 9 Nov answer 5).
function OpeningRow({ customerId, onSaved }: { customerId: number; onSaved: () => Promise<unknown> }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function save() {
    const pence = amountOf(typed);
    if (pence === null) { setProblem(AMOUNT_WORDS); return; }
    setProblem(null);
    setBusy(true);
    try {
      await apiMutate(`/api/customers/${customerId}/account/opening`, { pence });
      await onSaved();
    } catch (err) {
      setProblem(canSay(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grow"><Field id="acct-opening" label="Owed from before Wheelhouse" placeholder="£0.00" value={typed} onChange={setTyped} /></div>
        <Button variant="default" disabled={busy} onClick={() => void save()}>Add it</Button>
      </div>
      <span className="text-size-13 text-[var(--wh-muted)]">Entered once, from your old system. It starts the statement.</span>
      {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
    </div>
  );
}
