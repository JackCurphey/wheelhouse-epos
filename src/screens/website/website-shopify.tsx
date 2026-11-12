import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, TriangleAlert } from 'lucide-react';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Box, Page } from '@/screens/reports/reports-bits.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { PAYING_ONLINE } from '@/screens/settings/online-orders-settings.tsx';
import { Note } from './website-tracking.tsx';
import { SummaryRow } from './website-page.tsx';
import { plural, when, type ShopifyLink, type WebsiteState } from './website-types.ts';

/**
 * Shopify in the new frame (openspec/changes/website-management design 7,
 * pull request 6b; the drawings ws-start-shopify, ws-shopify-connect,
 * -failed, -check, -sending, -on, -problem and -switch in
 * docs/design/user-journeys/generator/website.mjs, lines 473-491). Shopify
 * itself sits behind server/shopify's adapter, with a pretend version.
 */
type Preview = {
  address: string; count: number; newPrices: number; newPhotos: number; newStock: number; added: number; onlyInShopify: number; noPrice: number;
  onlyInShopifyProducts: { sku: string; name: string }[];
  products: { id: number; sku: string; name: string; changes: string[] }[];
};
const failed = (err: unknown) => (serverSaid(err) ? err.message : 'Wheelhouse couldn’t reach Shopify. Try again in a moment.');

/** What coming back from Shopify says when it didn't connect (website.mjs line 561). */
export const connectFailed = (address: string) => `Couldn’t connect. Shopify didn’t find ${address || 'that address'}, or the approval was cancelled. Nothing has changed.`;

/** website.mjs WHAT_HAPPENS; Jack's default 2 (12 Nov) fills [what happens to them]. */
export function WhatHappens() {
  return (
    <Box label="What happens">
      <h3 className="m-0 text-size-17 font-bold">What happens</h3>
      <ul aria-label="What happens" className="m-0 flex flex-col gap-2 pl-5 text-size-15 leading-normal">
        <li><strong>Wheelhouse will replace the prices, photos and stock of the products in your Shopify shop with Wheelhouse’s.</strong> You’ll see how many will change before anything is sent.</li>
        <li>Products in Shopify that aren’t in Wheelhouse: left alone in Shopify, never hidden or deleted.</li>
        <li>From then on, change products, prices and stock in Wheelhouse — changes to them made in Shopify are replaced. “Show on website” decides what’s sent.</li>
        <li>Shopify orders come into <strong>Front desk › Online orders</strong>, with your other orders, and take the stock off straight away.</li>
        <li>Stock sent to Shopify leaves out bikes held for Cycle to Work orders, so a held bike shows as sold out.</li>
        <li>Shopify’s checkout takes the payment for those orders.</li>
      </ul>
    </Box>
  );
}

/** website.mjs connectBox: the address, Connect, and off to Shopify to approve. */
export function ConnectBox({ address: start = '' }: { address?: string }) {
  const [address, setAddress] = useState(start);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldId = useId();
  const saidId = useId();
  async function connect() {
    setBusy(true);
    setProblem(null);
    try {
      const { address: to } = await apiMutate<{ address: string }>('/api/shopify/connect', { address: address.trim() }, { method: 'POST' });
      // Shopify's page brings the Owner back to the Website page; busy until it does.
      window.location.assign(to);
    } catch (err) {
      setProblem(failed(err));
      setBusy(false);
    }
  }
  return (
    <Box label="Your Shopify address">
      <div className="flex max-w-[600px] flex-wrap items-end gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
          <label htmlFor={fieldId} className="text-sm font-semibold">Your Shopify address</label>
          <Input id={fieldId} value={address} placeholder="[your-shop].myshopify.com" autoComplete="off" spellCheck={false}
            aria-invalid={problem ? true : undefined} aria-describedby={problem ? saidId : undefined}
            onChange={(e) => { setAddress(e.target.value); setProblem(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void connect(); }} />
        </div>
        <Button disabled={busy} onClick={() => void connect()}>Connect</Button>
      </div>
      {problem ? <p id={saidId} role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Opens Shopify to approve the connection, then brings you back here. Nothing is sent until you say so.</p>
    </Box>
  );
}

function BackToWebsite({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold">
      <ChevronLeft aria-hidden="true" className="size-4" />Website
    </button>
  );
}

/** ws-shopify-connect and ws-shopify-failed: from the Website page's Wheelhouse's website or Shopify row. */
export function ShopifyConnect({ failedAddress, onBack }: { failedAddress: string | null; onBack: () => void }) {
  return (
    <Page>
      <BackToWebsite onBack={onBack} />
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-size-26 font-bold">Connect your Shopify shop</h2>
        <p className="m-0 text-size-15 leading-normal text-[var(--wh-muted)]">Keep your Shopify look, theme and checkout. Wheelhouse looks after what’s for sale.</p>
      </div>
      <WhatHappens />
      {failedAddress !== null ? <Note tone="bad" live>{connectFailed(failedAddress)}</Note> : null}
      <ConnectBox address={failedAddress ?? ''} />
    </Page>
  );
}

/**
 * The Website page for a Shopify shop: Ready to send (until something is
 * sent, or Not now), Sending, and Connected, with its problems and the
 * switch back to Wheelhouse's website.
 */
export function ShopifyPage({ state, link, onState }: { state: WebsiteState; link: ShopifyLink; onState: (next: WebsiteState) => void }) {
  const nothingSent = !link.lastSentAt;
  // Ready to send opens by itself only on a link that has never sent and isn't sending now.
  const [checking, setChecking] = useState(nothingSent && link.state === 'idle' && !link.problems.length);
  const [switching, setSwitching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function post(path: string, after?: () => void) {
    setBusy(true);
    setProblem(null);
    try {
      const answer = await apiMutate<{ shopify: ShopifyLink } & Partial<WebsiteState>>(path, {}, { method: 'POST' });
      onState('setUp' in answer ? (answer as WebsiteState) : { ...state, shopify: answer.shopify });
      after?.();
    } catch (err) {
      setProblem(failed(err));
    } finally {
      setBusy(false);
    }
  }
  const send = () => void post('/api/shopify/send', () => setChecking(false));
  const said = problem ? <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-sm font-semibold">{problem}</p> : null;

  if (link.state === 'sending') return <Sending link={link} />;
  if (checking) return <ReadyToSend link={link} busy={busy} said={said} onSend={send} onNotNow={() => setChecking(false)} />;

  const paused = link.state === 'paused';
  const troubled = link.problems.length > 0;
  return (
    <Page>
      {said}
      <Box label="Connected to your Shopify shop">
        <div className="flex flex-wrap items-center gap-4">
          <span aria-hidden="true" className={`inline-flex size-12 items-center justify-center rounded-xl ${troubled ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]'}`}>
            {troubled ? <TriangleAlert size={22} /> : <Check size={22} />}
          </span>
          <div className="flex min-w-0 grow flex-col gap-1">
            <h2 className="m-0 text-size-17 font-bold">Connected to your Shopify shop</h2>
            <span className="text-size-15 text-[var(--wh-muted)]">
              {nothingSent ? `${link.address} · nothing sent yet` : `${link.address} · last sent ${when(link.lastSentAt)} · ${plural(link.products, 'product')} · sent when you press Send`}
            </span>
          </div>
          <Button variant="ghost" onClick={() => setChecking(true)}>See what will change</Button>
          {nothingSent ? null : paused
            ? <Button variant="ghost" disabled={busy} onClick={() => void post('/api/shopify/resume')}>Resume sending</Button>
            : <Button variant="ghost" disabled={busy} onClick={() => void post('/api/shopify/pause')}>Pause sending</Button>}
          <a href={`https://${link.address}/admin`} target="_blank" rel="noreferrer"
            className={`${buttonVariants({ variant: 'default' })} no-underline`}>Open Shopify</a>
        </div>
        {troubled ? <Problems link={link} busy={busy} onSend={send} /> : null}
      </Box>

      <ul aria-label="Your website" className="m-0 flex list-none flex-col overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0">
        <SummaryRow name="Orders from Shopify">In Front desk › Online orders, with your other orders</SummaryRow>
        <SummaryRow name="What’s sent to Shopify" to={ROUTES.stock}>“Show on website” on each category and product, in Stock</SummaryRow>
        <SummaryRow name="Taking payments" to={PAYING_ONLINE}>Shopify’s checkout · Wheelhouse’s for “Pay now” on repairs</SummaryRow>
        <SummaryRow name="Wheelhouse’s website or Shopify" onOpen={() => setSwitching(true)}>Your Shopify shop · switch to Wheelhouse’s website</SummaryRow>
      </ul>
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Change products, prices and stock here in Wheelhouse — changes to them made in Shopify are replaced. Your Shopify theme, pages, cookies and tracking are set in Shopify.</p>

      {switching ? (
        <SwitchBox busy={busy} problem={problem} onClose={() => { setSwitching(false); setProblem(null); }}
          onSwitch={() => void post('/api/shopify/switch-to-wheelhouse')} />
      ) : null}
    </Page>
  );
}

/** ws-shopify-check: how many products will change, the list, and Send. */
function ReadyToSend({ link, busy, said, onSend, onNotNow }: { link: ShopifyLink; busy: boolean; said: ReactNode; onSend: () => void; onNotNow: () => void }) {
  const preview = useQuery({ queryKey: ['shopify-preview'], queryFn: () => apiGet<Preview>('/api/shopify/preview'), staleTime: 0, gcTime: 0 });
  const [listOpen, setListOpen] = useState(false);
  const p = preview.data;
  return (
    <Page>
      <BackToWebsite onBack={onNotNow} />
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-size-26 font-bold">Ready to send to Shopify</h2>
        <p className="m-0 text-size-15 leading-normal text-[var(--wh-muted)]">
          {link.lastSentAt ? `Connected to ${link.address}. Last sent ${when(link.lastSentAt)}.` : `Connected to ${link.address}. Nothing has been sent yet.`}
        </p>
      </div>
      {said}
      <Box label="What will change">
        {preview.error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{failed(preview.error)}</p> : null}
        {!p ? (preview.error ? null : <p className="m-0 text-sm text-[var(--wh-muted)]">Asking Shopify…</p>) : (
          <>
            <h3 className="m-0 text-size-17 font-bold">{`${plural(p.count, 'product')} will change in your Shopify shop`}</h3>
            <ul aria-label="What will change" className="m-0 flex list-none flex-col p-0">
              {([
                ['New prices', plural(p.newPrices, 'product')],
                ['New photos', plural(p.newPhotos, 'product')],
                ['New stock levels', plural(p.newStock, 'product')],
                ['Added', `${plural(p.added, 'product')} not in Shopify yet`],
                ['Only in Shopify', `${plural(p.onlyInShopify, 'product')} — left alone in Shopify`],
              ] as const).map(([k, v]) => (
                <li key={k} className="flex gap-3 border-t border-[var(--wh-border)] py-2.5 text-size-15 max-md:flex-col max-md:gap-0.5">
                  <strong className="min-w-[180px] max-md:min-w-0">{k}</strong><span>{v}</span>
                </li>
              ))}
            </ul>
            {listOpen ? <ProductList preview={p} /> : (
              <button type="button" onClick={() => setListOpen(true)} className="inline-flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wh-ink)] underline">See the list of products</button>
            )}
            <div className="flex flex-wrap gap-3">
              <Button disabled={busy || p.count === 0} onClick={onSend}>{`Send ${plural(p.count, 'product')}`}</Button>
              <Button variant="ghost" onClick={onNotNow}>Not now</Button>
            </div>
          </>
        )}
      </Box>
    </Page>
  );
}

const CHANGE_WORDS: Record<string, string> = { price: 'new price', photo: 'new photo', stock: 'new stock level', added: 'added' };

/** See the list of products, opened in place: what changes, and what's only in Shopify (left alone). */
function ProductList({ preview: p }: { preview: Preview }) {
  return (
    <div className="flex flex-col gap-3">
      {p.products.length ? (
        <ul aria-label="Products that will change" className="m-0 flex list-none flex-col gap-1 p-0 text-size-15">
          {p.products.map((x) => <li key={`${x.id}-${x.sku}`}><strong>{x.name}</strong>{` — ${x.changes.map((c) => CHANGE_WORDS[c] ?? c).join(', ')}`}</li>)}
        </ul>
      ) : null}
      {p.onlyInShopifyProducts.length ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold">Only in Shopify — left alone in Shopify</span>
          <ul aria-label="Only in Shopify" className="m-0 flex list-none flex-col gap-1 p-0 text-size-15">
            {p.onlyInShopifyProducts.map((x) => <li key={x.sku}>{x.name}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** ws-shopify-sending: the bar and the count; the Website page asks again each second. */
function Sending({ link }: { link: ShopifyLink }) {
  const done = link.total ? Math.round((link.sentCount / link.total) * 100) : 0;
  return (
    <Page>
      <Box label="Sending to your Shopify shop">
        <div className="flex flex-wrap items-center gap-4">
          <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--wh-surface-muted)]"><NavIcon name="website" size={22} /></span>
          <div className="flex min-w-0 grow flex-col gap-1">
            <h2 className="m-0 text-size-17 font-bold">Sending to your Shopify shop</h2>
            <span className="text-size-15 text-[var(--wh-muted)]">{link.address}</span>
          </div>
        </div>
        <div role="progressbar" aria-label="Products sent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={done} className="h-2.5 overflow-hidden rounded-full bg-[var(--wh-border)]">
          <span className="block h-full bg-[var(--wh-ink)]" style={{ width: `${done}%` }} />
        </div>
        <span role="status" className="text-size-15">{`${link.sentCount} of ${plural(link.total, 'product')} sent. You can leave this page — it carries on.`}</span>
      </Box>
    </Page>
  );
}

/** ws-shopify-problem: what couldn't be sent, why, Fix in Stock, and Try sending again. */
function Problems({ link, busy, onSend }: { link: ShopifyLink; busy: boolean; onSend: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2.5 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-3 text-[var(--wh-warn-ink)]">
      <strong className="flex items-center gap-2 text-size-15"><TriangleAlert aria-hidden="true" size={18} />{`${plural(link.problems.length, 'product')} couldn’t be sent to Shopify`}</strong>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[var(--wh-ink)]">
        {link.problems.map((x) => (
          <li key={`${x.productId}-${x.kind}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-size-15">
            <strong>{x.name}</strong><span>{x.reason}</span>
            {x.productId ? <Link to={`${ROUTES.stock}/${x.productId}`} aria-label={`Fix ${x.name} in Stock`} className="inline-flex min-h-11 items-center font-semibold text-[var(--wh-ink)]">Fix in Stock</Link> : null}
          </li>
        ))}
      </ul>
      <div><Button disabled={busy} onClick={onSend}>Try sending again</Button></div>
    </div>
  );
}

/** ws-shopify-switch: what changes when Wheelhouse's website takes over. */
function SwitchBox({ busy, problem, onSwitch, onClose }: { busy: boolean; problem: string | null; onSwitch: () => void; onClose: () => void }) {
  const titleId = useId();
  const subId = useId();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} aria-labelledby={titleId} aria-describedby={subId} className="max-w-[580px]">
      <DialogHeader>
        <div>
          <DialogTitle id={titleId}>Switch to Wheelhouse’s website?</DialogTitle>
          <DialogDescription id={subId}>From your Shopify shop</DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
        <ul className="m-0 flex flex-col gap-1.5 pl-5 text-size-15 leading-normal">
          <li>Wheelhouse stops sending to Shopify. Your Shopify shop stays as it is — close it in Shopify when you’re ready.</li>
          <li>Wheelhouse’s website is made from your shop’s details, switched off, for you to check and turn on.</li>
          <li>Your web address, orders and “Show on website” switches stay as they are.</li>
          <li>Orders already placed on Shopify stay in Online orders.</li>
        </ul>
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={onSwitch}>Switch</Button>
      </DialogFooter>
    </Dialog>
  );
}
