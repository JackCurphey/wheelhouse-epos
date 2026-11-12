import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { dayText } from '@/screens/customers/privacy-requests.tsx';
import { londonDay } from '@/screens/diary/when.ts';
import { Note } from '@/screens/website/website-tracking.tsx';
import { RowSwitch } from './row-switch.tsx';

/**
 * Settings › Front desk › Online orders (openspec/changes/website-management
 * design 6; drawn as ws-pay-none, ws-pay-connected, ws-pay-tested,
 * ws-pay-failed and ws-pay-more in generator/website.mjs). Buying online, and
 * Paying online: the shop's own account with the payment provider, connected
 * on the provider's page. Only these two for now (defaults taken 12 Nov, 4);
 * the wallet switches wait (decided-while-building 2026-11-jack 56).
 */
type PayState = 'none' | 'failed' | 'connected' | 'tested' | 'more';
type OnlineOrders = {
  buyingOnline: boolean;
  payments: {
    state: PayState; providerName: string | null; connectedByName: string | null; connectedAt: string | null;
    testPaidAt: string | null; payoutLast4: string | null; payoutTiming: string | null; needsDetailsBy: string | null; needsWhat: string | null;
  };
};
const KEY = ['online-orders-settings'];
const useOnlineOrders = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<OnlineOrders>('/api/online-orders-settings') });

/** Where "Add the details" and the Website page's Taking payments row open. */
export const PAYING_ONLINE = `${ROUTES.settings}?room=front-desk&fold=paying-online`;

/** The provider's name, or the drawing's placeholder until one is chosen. */
export const providerText = (name: string | null, capital = false) => name ?? (capital ? '[Payment provider]' : '[payment provider]');
const connectedNow = (s: PayState) => s === 'connected' || s === 'tested' || s === 'more';

/** The Paying online fold's summary (website.mjs paySettings), without the wallets that aren't built (gap 57). */
export function usePayingOnlineSummary(): string {
  const online = useOnlineOrders();
  const p = online.data?.payments;
  if (!p) return '';
  if (!connectedNow(p.state)) return 'Not connected';
  return providerText(p.providerName, true);
}

/** website.mjs `master`: Buying online, above the folds. */
export function BuyingOnline() {
  const queryClient = useQueryClient();
  const online = useOnlineOrders();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const d = online.data;
  if (!d) return null;
  const provider = providerText(d.payments.providerName);
  const can = connectedNow(d.payments.state);
  const on = can && d.buyingOnline;

  async function turn(next: boolean) {
    setBusy(true);
    setProblem(null);
    try {
      queryClient.setQueryData(KEY, await apiMutate<OnlineOrders>('/api/online-orders-settings', { buyingOnline: next }, { method: 'PUT' }));
    } catch (err) {
      setProblem(serverSaid(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-1">
      {can ? <RowSwitch label="Buying online" on={on} disabled={busy} onChange={(next) => void turn(next)} /> : (
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className="text-size-15 font-bold">Buying online</span>
          <span className="text-sm font-semibold text-[var(--wh-muted)]">{`Off until you connect ${provider}`}</span>
        </div>
      )}
      <p className="m-0 mb-3 text-sm text-[var(--wh-muted)]">
        {on ? 'Customers can buy from your website and collect from the shop.' : 'Customers can look at products, but the website says “Not taking online orders right now”.'}
      </p>
      {problem ? <p role="alert" className="m-0 mb-3 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
    </div>
  );
}

/** website.mjs PAY: the fold's body for each state, and what coming back from the provider says. */
export function PayingOnline() {
  const online = useOnlineOrders();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const p = online.data?.payments;
  if (!p) return null;
  const provider = providerText(p.providerName);
  const back = params.get('payments');

  // Off to the provider's page; it brings the Owner back here.
  async function go(path: string) {
    setBusy(true);
    setProblem(null);
    try {
      const { address } = await apiMutate<{ address: string }>(path, {}, { method: 'POST' });
      window.location.assign(address);
    } catch (err) {
      setProblem(serverSaid(err) ? err.message : 'Wheelhouse couldn’t reach the payment provider. Try again in a moment.');
      setBusy(false);
    }
  }
  const connect = () => void go('/api/online-payments/connect');
  const by = p.connectedByName ? ` by ${p.connectedByName}` : '';
  const connectedOn = p.connectedAt ? `Connected to ${provider}${by} on ${dayText(londonDay(p.connectedAt))}` : `Connected to ${provider}${by}`;
  const said = problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null;

  if (p.state === 'none' || p.state === 'failed') {
    return (
      <div className="flex flex-col gap-3">
        {p.state === 'failed' ? (
          <Note tone="bad" live><strong>Not connected.</strong>{` ${provider} didn’t finish connecting, so nothing has changed. Try again — if it keeps happening, ${provider}’s support can see why.`}</Note>
        ) : (
          <Note tone="warn"><strong>Not connected.</strong>{` Customers can’t buy online, “Pay now” for repairs is hidden and booking deposits are off, until you connect ${provider}.`}</Note>
        )}
        <div><Button disabled={busy} onClick={connect}>{p.state === 'failed' ? 'Try again' : `Connect ${provider}`}</Button></div>
        {said}
        {p.state === 'none' ? (
          <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">{`Opens ${provider}’s own page to sign up or sign in, then brings you back here. Your shop has its own account with them: card details, payouts and fees ([fees]) are between you and ${provider}.`}</p>
        ) : null}
      </div>
    );
  }

  if (p.state === 'more') {
    return (
      <div className="flex flex-col gap-3">
        <Note tone="warn">
          <strong>{`${provider} needs more details from you by ${p.needsDetailsBy ? dayText(p.needsDetailsBy) : '[date]'}`}</strong>
          {`, or online payments will stop. It’s usually ${p.needsWhat ?? '[what they need]'}. This also shows on Today and the Website page.`}
        </Note>
        <div><Button disabled={busy} onClick={connect}>{`Add the details at ${provider}`}</Button></div>
        {said}
        <Note tone="grey">{connectedOn}</Note>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {back === 'connected' ? <Note tone="ok" live>{`Connected to ${provider}${by} just now`}</Note> : <Note tone="ok">{connectedOn}</Note>}
      {p.state === 'tested' ? (
        <Note tone="ok" live={back === 'tested'}>
          <strong>Test payment worked.</strong>
          {` £1.00 taken and refunded. Payouts go to the account ending ${p.payoutLast4 ?? '[last 4 digits]'}, ${p.payoutTiming ?? '[payout timing]'}.`}
        </Note>
      ) : (
        <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--wh-warn-ink)] bg-[var(--wh-warn-bg)] p-3.5">
          <h3 className="m-0 text-size-17 font-bold">Make a test payment before customers use it</h3>
          <p className="m-0 text-size-15 leading-normal">Pay £1.00 with your own card to check everything works. It’s refunded; [what the provider charges on a refund].</p>
          {back === 'declined' ? <Note tone="bad" live>The test card was declined. Nothing was taken — try again.</Note> : null}
          <div><Button disabled={busy} onClick={() => void go('/api/online-payments/test-payment')}>Make a test payment</Button></div>
          {said}
        </div>
      )}
    </div>
  );
}
