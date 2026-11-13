import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { AlertCircle } from 'lucide-react';
import { penceText } from '@/lib/money.ts';
import { shortDay } from '@/screens/diary/rules.ts';
import { clock } from '@/screens/diary/when.ts';
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';

/**
 * Settings › Your data › Accounts software (rp-accounts-connect, rp-accounts-map, rp-accounts-missing and
 * rp-accounts-disconnect in generator/reports.mjs; openspec/changes/reports-accounts-and-reopen, accounts-software
 * spec; Jack's answers 2 and 3 of 12 Nov): connect Xero or QuickBooks (a pretend service until Jack says yes to
 * a real account), choose once which account each line of a day's summary goes to, and disconnect, keeping the
 * choices. The Owner's, like Settings. What each day sent, and the lost connection, come in the next pull request.
 */
type Line = { key: string; label: string; recorded: boolean; accountId: string | null; accountName: string | null };
type Group = { key: string; title: string; lines: Line[] };
export type AccountsState = {
  status: 'not_connected' | 'connected' | 'lost';
  summary: string;
  connection: { provider: string; providerName: string; connectedByName: string | null; connectedAt: string } | null;
  providers?: { id: string; name: string }[];
  practice?: boolean;
  accounts?: { id: string; name: string }[];
  groups?: Group[];
  missing?: number;
  lostOn?: string | null;
  needLook?: number;
};
type LogDay = {
  day: string; closeId: number | null; closedAt: string | null; amountPence: number | null; sentAt: string | null;
  status: 'sent' | 'waiting' | 'failed' | 'open' | 'reopened'; reason: string | null; line: string | null; missingLine: string | null; text: string | null;
  notRecorded?: string[];
};
export const LOG_KEY = ['accounts-log'];
export const ACCOUNTS_KEY = ['accounts'];

const longDate = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(iso));
const SELECT = 'min-h-11 min-w-[240px] rounded-md border bg-[var(--wh-panel)] px-2.5 text-sm max-md:w-full';

/** The fold's summary and body share one question, so the page can show the summary without the body being open. */
export function useAccounts() {
  return useQuery({ queryKey: ACCOUNTS_KEY, queryFn: () => apiGet<AccountsState>('/api/accounts'), retry: false });
}

const BADGE = { sent: 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]', failed: 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]', reopened: 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]', waiting: 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]', open: 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]' } as const;
const BADGE_WORDS = { sent: 'Sent', failed: 'Not sent', reopened: 'Reopened', waiting: 'Waiting', open: 'Not closed yet' } as const;

/** What each day sent (rp-accounts-log): newest first, with what to do about a day that couldn't go. */
function SentLog() {
  const log = useQuery({ queryKey: LOG_KEY, queryFn: () => apiGet<{ days: LogDay[] }>('/api/accounts/log'), retry: false });
  const days = log.data?.days ?? [];
  if (!days.length) return null; // a shop that never connected has no log
  const sub = (d: LogDay) => {
    if (d.status === 'sent') return `Sent at ${d.sentAt ? clock(d.sentAt) : ''} · ${penceText(d.amountPence ?? 0)}`;
    if (d.status === 'open' || d.status === 'reopened') return d.text ?? '';
    return `Closed at ${d.closedAt ? clock(d.closedAt) : ''} · ${d.text ?? ''}`;
  };
  return (
    <div className="flex flex-col">
      <h4 className="m-0 mt-3 text-sm font-bold">What was sent</h4>
      <ul aria-label="What was sent" className="m-0 flex list-none flex-col p-0">
        {days.map((d) => (
          <li key={d.day} className="flex min-h-[52px] flex-wrap items-center gap-3 border-t border-[var(--wh-border)] py-1.5 first:border-t-0">
            <span className="flex min-w-[240px] flex-1 flex-col gap-0.5">
              <span className="text-size-15 font-semibold">{shortDay(d.day)}</span>
              <span className={`text-size-13 ${d.status === 'failed' ? 'text-[var(--wh-warn-ink)]' : 'text-[var(--wh-muted)]'}`}>{sub(d)}</span>
              {d.status === 'sent' && d.notRecorded?.length ? <span className="text-size-13 text-[var(--wh-muted)]">{`Not recorded in Wheelhouse yet: ${d.notRecorded.join(', ')}`}</span> : null}
            </span>
            {d.status === 'failed' && d.missingLine ? (
              <Button className="min-h-11" onClick={() => { const el = document.getElementById(`acct-${d.line}`); el?.scrollIntoView?.({ block: 'center' }); el?.focus(); }}>{`Choose an account for ${d.missingLine}`}</Button>
            ) : <span className={`rounded-full px-2.5 py-0.5 text-size-13-5 font-semibold ${BADGE[d.status]}`}>{BADGE_WORDS[d.status]}</span>}
          </li>
        ))}
      </ul>
      <p className="m-0 mt-2 text-sm text-[var(--wh-muted)]">Each day goes once all that shop’s tills are closed. A day that’s reopened is corrected when it closes again.</p>
    </div>
  );
}

export function AccountsSoftware() {
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const [disconnecting, setDisconnecting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shop = useQuery({ queryKey: ['shop-details'], queryFn: () => apiGet<{ name: string }>('/api/shop-details') }).data?.name ?? 'Your shop';
  const change = useMutation({
    mutationFn: ({ path, body, method }: { path: string; body: unknown; method?: 'POST' | 'PUT' }) => apiMutate<AccountsState>(path, body, { method: method ?? 'POST' }),
    onSuccess: (next) => {
      setProblem(null);
      queryClient.setQueryData(ACCOUNTS_KEY, next);
      // A day may have gone, or been held, by this change.
      void queryClient.invalidateQueries({ queryKey: LOG_KEY });
      void queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      void queryClient.invalidateQueries({ queryKey: ['reports-takings'] });
    },
    onError: (err) => setProblem(serverSaid(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.'),
  });
  const state = accounts.data;
  if (accounts.isError) return <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this. Try again in a moment.</p>;
  if (!state) return <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>;
  const issue = problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger)]">{problem}</p> : null;

  if (!state.connection) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="m-0 text-sm text-[var(--wh-muted)]">Each closed day goes across as one summary per shop: sales by account, the VAT, the money taken by how it was paid. Only the owner can connect.</p>
        <div className="flex flex-wrap gap-2.5">
          {(state.providers ?? []).map((p) => (
            <Button key={p.id} className="min-h-11" disabled={change.isPending} onClick={() => change.mutate({ path: '/api/accounts/connect', body: { provider: p.id } })}>{`Connect ${p.name}`}</Button>
          ))}
        </div>
        {issue}
        <SentLog />
        <p className="m-0 text-sm text-[var(--wh-muted)]">Not using either? “Download everything” above has the same daily figures to import.</p>
      </div>
    );
  }

  const { providerName, connectedByName, connectedAt } = state.connection;
  const lost = state.status === 'lost';
  if (lost) {
    // rp-accounts-lost shows only the bar and the log until Reconnect.
    return (
      <div className="flex flex-col gap-2">
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-size-15 leading-snug text-[var(--wh-warn-ink)]">
          <AlertCircle size={18} aria-hidden="true" />
          <span className="min-w-[240px] flex-1"><strong>{`${providerName} disconnected on ${state.lostOn ? longDate(state.lostOn) : ''}.`}</strong> Nothing has been sent since. Reconnect and the waiting days go across.</span>
          <Button className="min-h-11" disabled={change.isPending} onClick={() => change.mutate({ path: '/api/accounts/connect', body: { provider: state.connection!.provider } })}>{`Reconnect ${providerName}`}</Button>
        </div>
        {issue}
        <SentLog />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-[var(--wh-ok-bg)] px-2.5 py-0.5 text-size-13-5 font-semibold text-[var(--wh-status-complete-ink)]">{`Connected to ${providerName}`}</span>
        <span className="text-size-13 text-[var(--wh-muted)]">{connectedByName ? `by ${connectedByName} on ${longDate(connectedAt)}` : `on ${longDate(connectedAt)}`}</span>
        <span className="grow" />
        <button type="button" onClick={() => setDisconnecting(true)} className="inline-flex min-h-11 items-center border-0 bg-transparent px-1 text-sm font-semibold text-[var(--wh-ink)] underline">{`Disconnect ${providerName}`}</button>
      </div>
      {state.practice ? <p className="m-0 text-sm text-[var(--wh-muted)]">{`This is a practice connection: nothing leaves Wheelhouse until a real ${providerName} account is set up.`}</p> : null}
      {issue}
      {(state.groups ?? []).map((g) => (
        <div key={g.key} className="flex flex-col">
          <h4 className="m-0 mt-3 text-sm font-bold">{g.title}</h4>
          {g.lines.map((l) => {
            const missing = l.recorded && l.accountId === null;
            const id = `acct-${l.key}`;
            return (
              <div key={l.key} className="flex min-h-[52px] flex-wrap items-center gap-3 border-t border-[var(--wh-border)] py-1.5 first-of-type:border-t-0">
                <label htmlFor={id} className="flex min-w-[200px] flex-1 flex-col gap-0.5 text-size-15 font-semibold">
                  {l.label}
                  {missing ? (
                    <span className="text-size-13 font-bold text-[var(--wh-danger)]">
                      {g.key === 'sales' ? `No ${providerName} account chosen — days with ${l.label} sales can’t be sent` : `No ${providerName} account chosen — days with ${l.label} can’t be sent`}
                    </span>
                  ) : null}
                  {!l.recorded ? <span className="text-size-13 font-normal text-[var(--wh-muted)]">Not recorded in Wheelhouse yet</span> : null}
                </label>
                <select
                  id={id} value={l.accountId ?? ''} aria-invalid={missing ? true : undefined}
                  className={`${SELECT} ${missing ? 'border-2 border-[var(--wh-danger)]' : 'border-[var(--wh-input-border)]'}`}
                  onChange={(e) => change.mutate({ path: '/api/accounts/choices', method: 'PUT', body: { line: l.key, accountId: e.target.value === '' ? null : e.target.value } })}
                >
                  <option value="">{`Choose a ${providerName} account`}</option>
                  {(state.accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      ))}
      <SentLog />
      <p className="m-0 mt-2 text-sm text-[var(--wh-muted)]">{`VAT on sales goes to one ${providerName} account for every rate. Check these choices with your accountant before the first day is sent.`}</p>
      {disconnecting ? (
        <Dialog open onOpenChange={(o) => { if (!o) setDisconnecting(false); }} aria-labelledby="dc-title" className="md:max-w-[520px]">
          <DialogHeader>
            <div><DialogTitle id="dc-title">{`Disconnect ${providerName}?`}</DialogTitle><DialogDescription>{`${shop}, every shop`}</DialogDescription></div>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-2.5">
            {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger)]">{problem}</p> : null}
            <p className="m-0 text-size-15 leading-normal">{`Days already sent stay in ${providerName}. Nothing more is sent until you connect again — the daily figures are still in “Download everything”.`}</p>
            <p className="m-0 text-sm text-[var(--wh-muted)]">Your account choices are kept in case you reconnect.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setDisconnecting(false)}>Keep connected</Button>
            <Button variant="danger" className="min-h-11" disabled={change.isPending} onClick={() => { change.mutate({ path: '/api/accounts/disconnect', body: {} }, { onSuccess: () => setDisconnecting(false) }); }}>Disconnect</Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </div>
  );
}
