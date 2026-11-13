import { useEffect, useId, useState, type ReactNode } from 'react';
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
 * on the provider's page. Buying online adds What the website sells, the
 * wallet and store credit switches, Not collected and Where ready orders wait
 * (openspec/changes/website-buy-online tasks 2.1–2.3; on-settings,
 * on-settings-pay and on-settings-keep in generator/online.mjs).
 */
type PayState = 'none' | 'failed' | 'connected' | 'tested' | 'more';
type OnlineOrders = {
  buyingOnline: boolean;
  sells: 'shelf'; walletsOn: boolean; storeCreditOn: boolean; remindDays: number; keepDays: number; shelfName: string | null;
  payments: {
    state: PayState; connected: boolean; providerName: string | null; connectedByName: string | null; connectedAt: string | null;
    testPaidAt: string | null; payoutLast4: string | null; payoutTiming: string | null; needsDetailsBy: string | null; needsWhat: string | null;
  };
};
const KEY = ['online-orders-settings'];
const useOnlineOrders = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<OnlineOrders>('/api/online-orders-settings') });
/** Whether the website is the shop's Shopify shop (ws-pay-shopify): Shopify's checkout takes the website's payments. */
const useWebsiteKind = () => {
  const site = useQuery({ queryKey: ['website'], queryFn: () => apiGet<{ kind: string | null }>('/api/website'), retry: false });
  return { known: site.isFetched, shopify: site.data?.kind === 'shopify' };
};
const useShopifyWebsite = () => useWebsiteKind().shopify;

/** Where "Add the details" and the Website page's Taking payments row open. */
export const PAYING_ONLINE = `${ROUTES.settings}?room=front-desk&fold=paying-online`;

/** The provider's name, or the drawing's placeholder until one is chosen. */
export const providerText = (name: string | null, capital = false) => name ?? (capital ? '[Payment provider]' : '[payment provider]');
const connectedNow = (s: PayState) => s === 'connected' || s === 'tested' || s === 'more';

/** The Paying online fold's summary (settings-frame.mjs onlineFolds), store credit when it's on; no gift cards (question 8). */
export function usePayingOnlineSummary(): string {
  const online = useOnlineOrders();
  const { known, shopify } = useWebsiteKind();
  const p = online.data?.payments;
  if (!p || !known) return '';
  if (!connectedNow(p.state)) return 'Not connected';
  if (shopify) return `Shopify for website orders · ${providerText(p.providerName, true)} for repairs`;
  return `${providerText(p.providerName, true)}${online.data?.storeCreditOn ? ' · store credit' : ''}`;
}

/** The summaries of the folds buying online adds (settings-frame.mjs onlineFolds). */
export function useOnlineOrdersSummaries() {
  const d = useOnlineOrders().data;
  if (!d?.payments) return { sells: '', collect: '', shelf: '' };
  return {
    sells: 'Only what’s on the shelf',
    collect: `Reminder after ${d.remindDays} ${d.remindDays === 1 ? 'day' : 'days'} · kept for ${d.keepDays} days`,
    shelf: d.shelfName ?? 'Not set yet',
  };
}

/** Saves the fields sent; the server answers with the whole settings. */
function useSaveOnline() {
  const queryClient = useQueryClient();
  return async (body: Partial<Pick<OnlineOrders, 'walletsOn' | 'storeCreditOn' | 'remindDays' | 'keepDays' | 'shelfName'>>) => {
    queryClient.setQueryData(KEY, await apiMutate<OnlineOrders>('/api/online-orders-settings', body, { method: 'PUT' }));
    // Two saves can overlap (two switches pressed quickly); read again so an older answer arriving last can't stick.
    void queryClient.invalidateQueries({ queryKey: KEY });
  };
}
const couldntSave = (err: unknown) => (serverSaid(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
const hint = 'm-0 text-sm leading-normal text-[var(--wh-muted)]';
const field = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-base font-normal';
type Said = { ok: boolean; text: string } | null;
function SaidLine({ said }: { said: Said }) {
  return said ? <p role={said.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${said.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{said.text}</p> : null;
}

/** online.mjs sellsOpen(0): only what's on the shelf until stock transfers and supplier times exist (question 10). */
export function WebsiteSells() {
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="pb-1 text-size-15 font-bold">Customers can buy</legend>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border border-[var(--wh-ink)] p-3">
          <input type="radio" name="online-sells" checked readOnly className="mt-0.5 size-5 shrink-0 accent-[var(--wh-ink)]" />
          <span className="flex flex-col gap-0.5">
            <span className="text-size-15 font-semibold">Only what’s on the shelf</span>
            <span className="text-sm text-[var(--wh-muted)]">At the shop they collect from. Ready the same day.</span>
          </span>
        </label>
      </fieldset>
      <p className={hint}>Stock is held for the customer as soon as they’ve paid, and checked again just before they pay.</p>
    </div>
  );
}

/** online.mjs payOpen: Apple Pay and Google Pay, and store credit, each its own switch; no Gift cards (question 8). */
function PaySwitches() {
  const d = useOnlineOrders().data;
  // Not until the website's kind is known: Shopify's checkout takes a Shopify website's payments.
  const site = useWebsiteKind();
  const save = useSaveOnline();
  const [said, setSaid] = useState<Said>(null);
  if (!d || !site.known || site.shopify) return null;
  // Each switch saves on its own; the switches stay usable (and focusable) while one saves.
  async function turn(body: { walletsOn: boolean } | { storeCreditOn: boolean }) {
    setSaid(null);
    try { await save(body); } catch (err) { setSaid({ ok: false, text: couldntSave(err) }); }
  }
  return (
    <div className="flex flex-col">
      <RowSwitch label="Apple Pay and Google Pay" on={d.walletsOn} disabled={false} onChange={(walletsOn) => void turn({ walletsOn })} />
      <RowSwitch label="Store credit (for signed-in customers)" on={d.storeCreditOn} disabled={false} onChange={(storeCreditOn) => void turn({ storeCreditOn })} />
      <SaidLine said={said} />
    </div>
  );
}

// online.mjs collectOpen's two boxes: a whole number of days, saved on leaving the box.
function DaysBox({ label, name, min, max }: { label: string; name: 'remindDays' | 'keepDays'; min: number; max: number }) {
  const id = useId();
  const d = useOnlineOrders().data;
  const save = useSaveOnline();
  const [typed, setTyped] = useState<string | null>(null);
  const [said, setSaid] = useState<Said>(null);
  const stored = d?.[name] ?? null;
  async function leave() {
    if (typed === null) return;
    const n = Number(typed.trim());
    if (!/^\d+$/.test(typed.trim()) || n < min || n > max) { setSaid({ ok: false, text: `A whole number of days, ${min} to ${max}` }); return; }
    if (n === stored) { setTyped(null); setSaid(null); return; }
    try {
      await save({ [name]: n });
      setTyped((now) => (now === typed ? null : now));
      setSaid({ ok: true, text: 'Saved.' });
    } catch (err) {
      setTyped(null); // nothing saved: the box shows what is stored again, under the message
      setSaid({ ok: false, text: couldntSave(err) });
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-size-15 font-semibold">{label}</label>
      <span className="flex items-center gap-2.5">
        <input id={id} inputMode="numeric" value={typed ?? (stored === null ? '' : String(stored))} disabled={!d}
          aria-invalid={said && !said.ok ? true : undefined}
          onChange={(e) => { setTyped(e.target.value); setSaid(null); }} onBlur={() => void leave()}
          className={`${field} w-[70px] text-right font-mono`} />
        <span className="text-size-15 text-[var(--wh-muted)]">days</span>
      </span>
      <SaidLine said={said} />
    </div>
  );
}

/** online.mjs collectOpen: the reminder (1–60 days) and how long orders are kept (2–90, longer than the reminder). */
export function NotCollected() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DaysBox label="Remind the customer after" name="remindDays" min={1} max={60} />
        <DaysBox label="Keep orders for" name="keepDays" min={2} max={90} />
      </div>
      <p className={hint}>The “ready” email tells the customer we’ll keep it until that date. If it isn’t collected by then, it shows on Today. Staff then contact the customer, or cancel it — a refund the way it was paid, and the items back on sale.</p>
    </div>
  );
}

/** online.mjs shelfOpen: one named spot for ready orders, saved on leaving the box; empty clears it. */
export function ReadyShelf() {
  const id = useId();
  const d = useOnlineOrders().data;
  const save = useSaveOnline();
  const [typed, setTyped] = useState<string | null>(null);
  const [said, setSaid] = useState<Said>(null);
  const stored = d?.shelfName ?? '';
  async function leave() {
    if (typed === null) return;
    if (typed.trim() === stored) { setTyped(null); return; }
    try {
      await save({ shelfName: typed.trim() });
      setTyped((now) => (now === typed ? null : now));
      setSaid({ ok: true, text: 'Saved.' });
    } catch (err) { setSaid({ ok: false, text: couldntSave(err) }); }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-size-15 font-semibold">Shelf or spot</label>
      <input id={id} value={typed ?? stored} placeholder="[Shelf name]" maxLength={60} disabled={!d}
        aria-invalid={said && !said.ok ? true : undefined}
        onChange={(e) => { setTyped(e.target.value); setSaid(null); }} onBlur={() => void leave()} className={`${field} max-w-[360px]`} />
      <SaidLine said={said} />
      <p className={hint}>Set once. Ready orders show “Waiting at [Shelf name]” on Online orders, and the till’s hand-over says where to fetch them from.</p>
    </div>
  );
}

/** website.mjs `master`: Buying online, above the folds. */
export function BuyingOnline() {
  const queryClient = useQueryClient();
  const online = useOnlineOrders();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const d = online.data;
  if (!d?.payments) return null;
  const provider = providerText(d.payments.providerName);
  // Not once a more-details date has passed: payments have stopped (server/payments/provider.js isConnected).
  const can = d.payments.connected;
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
  const shopify = useShopifyWebsite();
  const [params, setParams] = useSearchParams();
  // What coming back from the provider says, read once and then dropped from
  // the address, so a reload or a later visit doesn't announce it again.
  const [back] = useState(() => params.get('payments'));
  useEffect(() => {
    if (!params.has('payments')) return;
    setParams((now) => { const next = new URLSearchParams(now); next.delete('payments'); return next; }, { replace: true });
  }, [params, setParams]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const p = online.data?.payments;
  if (!p) return null;
  const provider = providerText(p.providerName);

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
          <Note tone="bad" live={back === 'failed'}><strong>Not connected.</strong>{` ${provider} didn’t finish connecting, so nothing has changed. Try again — if it keeps happening, ${provider}’s support can see why.`}</Note>
        ) : (
          <Note tone="warn"><strong>Not connected.</strong>{` Customers can’t buy online, “Pay now” for repairs is hidden and booking deposits are off, until you connect ${provider}.`}</Note>
        )}
        <div><Button variant="accent" disabled={busy} onClick={connect}>{p.state === 'failed' ? 'Try again' : `Connect ${provider}`}</Button></div>
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
        <PaySwitches />
      </div>
    );
  }

  // ws-pay-shopify: Shopify's checkout takes the website's payments; the provider is for Pay now on repairs.
  if (shopify) {
    return (
      <div className="flex flex-col gap-3">
        <Note tone="grey"><strong>Shopify takes the payment</strong> for orders on your Shopify shop. Wheelhouse’s payments are only for “Pay now” on repairs.</Note>
        <Note tone="ok" live={back === 'connected'}>{`${back === 'connected' ? `Connected to ${provider}${by} just now` : connectedOn} · for “Pay now” on repairs`}</Note>
        {p.state === 'tested' ? null : <TestPayment busy={busy} declined={back === 'declined'} said={said} onTest={() => void go('/api/online-payments/test-payment')} />}
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
        <TestPayment busy={busy} declined={back === 'declined'} said={said} onTest={() => void go('/api/online-payments/test-payment')} />
      )}
      <PaySwitches />
    </div>
  );
}

/** website.mjs PAY connected: make a £1.00 test payment before customers use it. */
function TestPayment({ busy, declined, said, onTest }: { busy: boolean; declined: boolean; said: ReactNode; onTest: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--wh-warn-ink)] bg-[var(--wh-warn-bg)] p-3.5">
      <h3 className="m-0 text-size-17 font-bold">Make a test payment before customers use it</h3>
      <p className="m-0 text-size-15 leading-normal">Pay £1.00 with your own card to check everything works. It’s refunded; [what the provider charges on a refund].</p>
      {declined ? <Note tone="bad" live>The test card was declined. Nothing was taken — try again.</Note> : null}
      <div><Button disabled={busy} onClick={onTest}>Make a test payment</Button></div>
      {said}
    </div>
  );
}
