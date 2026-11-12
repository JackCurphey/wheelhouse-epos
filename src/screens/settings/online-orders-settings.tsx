import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
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
 * on the provider's page. The rest of the folds (openspec/changes/
 * website-buy-online, pull request 2; drawn as on-settings, on-settings-show,
 * on-settings-pay and on-settings-keep in generator/online.mjs, and
 * settings-frame.mjs onlineFolds): What the website sells (only what's on the
 * shelf, question 10), Showing products, the wallet and store credit switches
 * (no Gift cards, question 8), Not collected and Where ready orders wait.
 */
type PayState = 'none' | 'failed' | 'connected' | 'tested' | 'more';
type Category = { id: number; path: string; showOnline: boolean };
type OnlineOrders = {
  buyingOnline: boolean;
  sells: 'shelf';
  walletsOn: boolean;
  storeCreditOn: boolean;
  remindDays: number;
  keepDays: number;
  shelfName: string | null;
  // setDifferently: null until a Wheelhouse website is set up; shopify: the fold isn't shown.
  showing: { categories: Category[]; setDifferently: number | null; shopify: boolean };
  payments: {
    state: PayState; connected: boolean; providerName: string | null; connectedByName: string | null; connectedAt: string | null;
    testPaidAt: string | null; payoutLast4: string | null; payoutTiming: string | null; needsDetailsBy: string | null; needsWhat: string | null;
  };
};
const KEY = ['online-orders-settings'];
const useOnlineOrders = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<OnlineOrders>('/api/online-orders-settings') });
/** Whether the website is the shop's Shopify shop (ws-pay-shopify): Shopify's checkout takes the website's payments. */
const useShopifyWebsite = () => {
  const site = useQuery({ queryKey: ['website'], queryFn: () => apiGet<{ kind: string | null }>('/api/website'), retry: false });
  return site.data?.kind === 'shopify';
};

/** Where "Add the details" and the Website page's Taking payments row open. */
export const PAYING_ONLINE = `${ROUTES.settings}?room=front-desk&fold=paying-online`;

/** The provider's name, or the drawing's placeholder until one is chosen. */
export const providerText = (name: string | null, capital = false) => name ?? (capital ? '[Payment provider]' : '[payment provider]');
const connectedNow = (s: PayState) => s === 'connected' || s === 'tested' || s === 'more';

/** The Paying online fold's summary (website.mjs paySettings): no gift cards (question 8), and store credit while it's on. */
export function usePayingOnlineSummary(): string {
  const online = useOnlineOrders();
  const shopify = useShopifyWebsite();
  const p = online.data?.payments;
  if (!p) return '';
  if (!connectedNow(p.state)) return 'Not connected';
  if (shopify) return `Shopify for website orders · ${providerText(p.providerName, true)} for repairs`;
  return `${providerText(p.providerName, true)}${online.data?.storeCreditOn ? ' · store credit' : ''}`;
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const SHELF_PLACEHOLDER = '[Shelf name]';

/** The other folds' summaries (settings-frame.mjs onlineFolds), from what is set. */
export function useOnlineOrdersSummaries() {
  const d = useOnlineOrders().data;
  if (!d?.payments) return { sells: '', showing: '', notCollected: '', shelf: '', shopify: false };
  return {
    // A Shopify website has no Showing products fold: Shopify's shop is sent what Stock says.
    shopify: d.showing?.shopify === true,
    sells: 'Only what’s on the shelf',
    showing: 'Set on each category and product',
    notCollected: `Reminder after ${days(d.remindDays)} · kept for ${days(d.keepDays)}`,
    shelf: d.shelfName ?? SHELF_PLACEHOLDER,
  };
}

const couldntSave = (err: unknown) => (serverSaid(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');
const hint = 'm-0 text-sm leading-normal text-[var(--wh-muted)]';
const box = 'min-h-11 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-size-15';
type Said = { ok: boolean; text: string } | null;
function SaidNote({ note }: { note: Said }) {
  return note ? <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-sm font-semibold ${note.ok ? '' : 'text-[var(--wh-danger-hover)]'}`}>{note.text}</p> : null;
}

type Saved = Partial<Pick<OnlineOrders, 'walletsOn' | 'storeCreditOn' | 'remindDays' | 'keepDays'>> & { shelfName?: string };
/** Saves the settings sent; the reply is what every fold reads. */
function useSaveSettings() {
  const queryClient = useQueryClient();
  return async (body: Saved) => {
    queryClient.setQueryData(KEY, await apiMutate<OnlineOrders>('/api/online-orders-settings', body, { method: 'PUT' }));
  };
}

/** online.mjs sellsOpen(0): only what's on the shelf for now (question 10, default taken). */
export function WhatTheWebsiteSells() {
  const d = useOnlineOrders().data;
  const id = useId();
  return (
    <div className="flex flex-col gap-2.5">
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-1 p-0 text-size-15 font-bold">Customers can buy</legend>
        <label className="flex min-h-11 items-start gap-2.5 py-1.5">
          <input type="radio" name="online-sells" className="mt-1 size-4" checked={d?.sells === 'shelf'} readOnly
            aria-label="Only what’s on the shelf" aria-describedby={`${id}-hint`} />
          <span className="flex flex-col gap-0.5">
            <span className="text-size-15 font-semibold">Only what’s on the shelf</span>
            <span id={`${id}-hint`} className="text-size-13 text-[var(--wh-muted)]">At the shop they collect from. Ready the same day.</span>
          </span>
        </label>
      </fieldset>
      <p className={hint}>Stock is held for the customer as soon as they’ve paid, and checked again just before they pay.</p>
    </div>
  );
}

/** online.mjs showOpen: a switch on each category, and how many products differ, with See them (opening Stock, as the Website page's does). */
export function ShowingProducts() {
  const queryClient = useQueryClient();
  const d = useOnlineOrders().data;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!d?.showing) return null;
  const n = d.showing.setDifferently;

  async function turn(c: Category, on: boolean) {
    setBusy(true);
    setProblem(null);
    try {
      queryClient.setQueryData(KEY, await apiMutate<OnlineOrders>(`/api/online-orders-settings/categories/${c.id}`, { showOnline: on }, { method: 'PUT' }));
    } catch (err) {
      setProblem(couldntSave(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        {d.showing.categories.map((c) => <RowSwitch key={c.id} label={c.path} on={c.showOnline} disabled={busy} onChange={(on) => void turn(c, on)} />)}
      </div>
      {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      {/* Only once the Wheelhouse website is set up: before that, every priced product would count. */}
      {n === null ? null : <p className="m-0 flex flex-wrap items-center gap-x-3 text-sm">
        <span>{`${n} ${n === 1 ? 'product is' : 'products are'} set differently from their category.`}</span>
        {n > 0 ? <Link to={`${ROUTES.stock}?show=set-differently`} aria-label="See the products set differently from their category, in Stock" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--wh-ink)]">See them</Link> : null}
      </p>}
      <p className={hint}>New products follow their category. Each product’s page in Stock has its own “Show on website” switch.</p>
    </div>
  );
}

/** online.mjs payOpen: Apple Pay and Google Pay, and Store credit; no Gift cards switch until gift cards are built (question 8). */
function Wallets() {
  const d = useOnlineOrders().data;
  const save = useSaveSettings();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!d) return null;
  async function turn(body: Saved) {
    setBusy(true);
    setProblem(null);
    try { await save(body); } catch (err) { setProblem(couldntSave(err)); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col">
      <RowSwitch label="Apple Pay and Google Pay" on={d.walletsOn} disabled={busy} onChange={(on) => void turn({ walletsOn: on })} />
      <RowSwitch label="Store credit (for signed-in customers)" on={d.storeCreditOn} disabled={busy} onChange={(on) => void turn({ storeCreditOn: on })} />
      {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
    </div>
  );
}

const LIMITS = { remindDays: [1, 60], keepDays: [2, 90] } as const;
type DaysBox = keyof typeof LIMITS;

/**
 * online.mjs collectOpen: the reminder and how long orders are kept. Leaving
 * either box saves both as they read, as the bikes' Collection does
 * (collection-settings.tsx), so the reminder can be raised past keeping by
 * raising keeping first.
 */
export function NotCollected() {
  const d = useOnlineOrders().data;
  const save = useSaveSettings();
  const id = useId();
  const [typed, setTyped] = useState<Partial<Record<DaysBox, string>>>({});
  const [note, setNote] = useState<Said>(null);
  if (!d) return null;
  const stored = d;
  const shown = (b: DaysBox) => typed[b] ?? String(stored[b]);

  async function leave() {
    if (typed.remindDays === undefined && typed.keepDays === undefined) return;
    const body: Record<DaysBox, number> = { remindDays: 0, keepDays: 0 };
    for (const b of ['remindDays', 'keepDays'] as DaysBox[]) {
      const text = shown(b).trim();
      const n = Number(text);
      const [min, max] = LIMITS[b];
      if (text === '' || !Number.isInteger(n) || n < min || n > max) { setNote({ ok: false, text: `Choose from ${min} to ${max} days.` }); return; }
      body[b] = n;
    }
    if (body.remindDays === stored.remindDays && body.keepDays === stored.keepDays) { setTyped({}); setNote(null); return; }
    setNote(null);
    try {
      await save(body);
      // Only what was saved: a box typed into meanwhile keeps its words.
      setTyped((t) => Object.fromEntries(Object.entries(t).filter(([b, text]) => text.trim() !== String(body[b as DaysBox]))));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      // What was typed stays, with the server's reason ("Keep orders for more days than the reminder.").
      setNote({ ok: false, text: couldntSave(err) });
    }
  }

  const field = (b: DaysBox, label: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-${b}`} className="text-size-15 font-semibold">{label}</label>
      <span className="inline-flex items-center gap-2 text-sm">
        <input id={`${id}-${b}`} inputMode="numeric" value={shown(b)} aria-invalid={note && !note.ok ? true : undefined}
          onChange={(e) => { const value = e.target.value; setTyped((t) => ({ ...t, [b]: value })); }}
          onBlur={() => void leave()} className={`${box} w-16 text-center font-[family-name:var(--wh-font-mono)]`} />
        days
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {field('remindDays', 'Remind the customer after')}
        {field('keepDays', 'Keep orders for')}
      </div>
      <SaidNote note={note} />
      <p className={hint}>The “ready” email tells the customer we’ll keep it until that date. If it isn’t collected by then, it shows on Today. Staff then contact the customer, or cancel it — a refund the way it was paid, and the items back on sale.</p>
    </div>
  );
}

/** online.mjs shelfOpen: one named spot, set once; empty until named (design, decided while planning 20). */
export function WhereReadyOrdersWait() {
  const d = useOnlineOrders().data;
  const save = useSaveSettings();
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);
  const [note, setNote] = useState<Said>(null);
  if (!d) return null;
  const saved = d.shelfName ?? '';
  async function leave() {
    if (typed === null) return;
    const text = typed.trim();
    if (text === saved) { setTyped(null); setNote(null); return; }
    setNote(null);
    try {
      await save({ shelfName: text });
      setTyped((now) => (now === typed ? null : now));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      setNote({ ok: false, text: couldntSave(err) });
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-size-15 font-semibold">Shelf or spot</label>
      <input id={id} value={typed ?? saved} placeholder={SHELF_PLACEHOLDER} maxLength={60} aria-invalid={note && !note.ok ? true : undefined}
        aria-describedby={`${id}-hint`} onChange={(e) => setTyped(e.target.value)} onBlur={() => void leave()} className={`${box} max-w-sm`} />
      <SaidNote note={note} />
      <p id={`${id}-hint`} className={hint}>Set once. Ready orders show “Waiting at [Shelf name]” on Online orders, and the till’s hand-over says where to fetch them from.</p>
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
        {shopify ? null : <Wallets />}
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
      <Wallets />
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
