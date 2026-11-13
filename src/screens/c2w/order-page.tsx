import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError, serverSaid } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { SavedNoteArea, useSavedNote } from '@/screens/settings/saved-note.tsx';
import { customerHref } from '@/screens/customers/customers-page.tsx';
import {
  Back, Box, Kv, Msg, Page, daysBetween, dayOf, firstName, linkClass, longDate, mono, note, orderLabel, orderedNote, plural, possessive, pounds, bikeLine,
  useAllProviders, useC2wSettings, type C2wEvent, type C2wOrder, type Provider,
} from './c2w-bits.tsx';
import { orderHref as supplierOrderHref } from '@/screens/deliveries/deliveries-bits.tsx';
import { printPaperWhenLoaded } from '@/screens/till/receipt.tsx';
import { QuoteDoc, getQuote, quoteKey, useEmailQuote } from './quote-page.tsx';
import { AppliedDialog, CertificateDialog } from './certificate-dialog.tsx';
import { HandOverDialog } from './hand-over-dialog.tsx';
import { CancelDialog, MoreMenu } from './cancel-dialog.tsx';
import { MarkPaidDialog, owedOf } from './mark-paid-dialog.tsx';

/**
 * One Cycle to Work order (c2w.mjs orderPage; cw-order-held, and the owner's
 * provider line from cw-more): the stages, what's next, "What's happened",
 * The order with Who pays what, and the customer. The next-step buttons and
 * the More… menu's items come with the pull requests that build those steps
 * (openspec/changes/cycle-to-work tasks 5–8; logged).
 */
type Full = C2wOrder & { events: C2wEvent[] };
const STAGES = ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected', 'Paid by the provider'];
// A quote given is already waiting for the certificate, as drawn (cw-order-held).
// More… is there until the bike is collected; the money steps take over after (cw-more).
const OPEN_STAGES = new Set(['quote', 'waiting', 'certificate', 'ready']);
const AT: Record<string, number> = { quote: 1, waiting: 1, certificate: 2, ready: 3, collected: 4, paid: 6 };

function Stages({ o }: { o: Full }) {
  const at = AT[o.stage] ?? 0;
  const reached = [dayOf(o.quoteGivenAt), o.appliedAt ? dayOf(o.appliedAt) : null, o.certificateReceivedOn, null, o.collectedAt ? dayOf(o.collectedAt) : null, o.paidOn];
  return (
    <ol aria-label="Stages" className="m-0 grid list-none grid-cols-2 gap-1.5 p-0 md:grid-cols-6">
      {STAGES.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li key={s} aria-current={now ? 'step' : undefined} className={`flex flex-col gap-1 rounded-lg px-2.5 py-2 text-size-13 ${now ? 'border-2 border-[var(--wh-ink)]' : 'border border-[var(--wh-border)]'} ${done ? 'bg-[var(--wh-surface-muted)]' : 'bg-[var(--wh-panel)]'}`}>
            <span className={`inline-flex items-center gap-1.5 font-bold ${done || now ? '' : 'text-[var(--wh-muted)]'}`}>
              {done ? <NavIcon name="check" size={14} /> : <span className="w-3.5 text-center">{i + 1}</span>}{s}
            </span>
            <span className="text-[var(--wh-muted)]">{done ? (reached[i] ? longDate(reached[i] as string) : '') : now ? 'Now' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

type Act = { onApplied: () => void; onCertificate: () => void; onReady: () => void; onOrder: () => void; onHandOver: () => void; busy: boolean };
type Money = { provider: Provider | undefined; lateDays: number | null; canPay: boolean; onPay: () => void; onCloseOwed: () => void };

/** What one payment put on this order, its extra included (paymentPence is the whole payment, which may cover several bikes). */
const putOn = (e: { detail: Record<string, unknown> }) => Number(e.detail.amountPence) + Number(e.detail.extraPence ?? 0);
/** What the provider has sent for the order, from its payments. */
const received = (o: Full) => o.events.reduce((sum, e) => (e.kind === 'paid' || e.kind === 'part_paid' ? sum + putOn(e) : sum), 0);

/**
 * After collection: what the provider owes (cw-order-owed), what's still owed after
 * part of it came (cw-order-part-paid), and Paid (cw-order-paid). Only the owner can
 * mark a payment, so others see the boxes without the buttons (logged). A closed
 * order isn't drawn: it says what wasn't paid and why (logged).
 */
function MoneyStep({ o, money }: { o: Full; money: Money }) {
  const head = (text: string) => <h3 id="cw-next" tabIndex={-1} className="m-0 text-size-17 font-bold">{text}</h3>;
  const expected = o.expectedPence ?? 0;
  if (o.stage === 'closed') {
    return <Box label="cw-next"><Msg tone="warn"><strong id="cw-next" tabIndex={-1}>{`Closed with ${pounds(owedOf(o))} not paid.`}</strong>{o.closeReason ? ` ${o.closeReason}` : ''}</Msg></Box>;
  }
  if (o.stage === 'paid') {
    const got = received(o) || (o.paidPence ?? 0);
    return (
      <Box label="cw-next">
        {head('Paid')}
        <Msg tone="ok"><strong>{`${pounds(got)} received from ${o.providerName}${o.paidOn ? ` on ${longDate(o.paidOn)}` : ''}`}</strong>{got === expected ? ', as expected.' : '.'}</Msg>
      </Box>
    );
  }
  if (o.paidPence) {
    return (
      <Box label="cw-next">
        {head('Next: the rest of the payment')}
        <Msg tone="warn"><strong>{`${pounds(o.paidPence)} of ${pounds(expected)} received from ${o.providerName}.`}</strong>{` ${pounds(owedOf(o))} still owed — it stays on the owed list and on Today if it’s late.`}</Msg>
        {money.canPay ? row(<><Button variant="primary" onClick={money.onPay}>Mark the rest paid</Button><Button variant="default" onClick={money.onCloseOwed}>Close with a reason…</Button></>) : null}
      </Box>
    );
  }
  // The provider's rate, only while it still gives the order's own figures (logged).
  const kept = money.provider && o.certificatePence !== null && keptPence(money.provider, o.certificatePence) === o.certificatePence - expected ? commission(money.provider) : null;
  // Only someone who can see costs is sent the provider's commission (decision H3), so it's shown only to them.
  const seesCosts = money.provider?.commissionKind !== undefined;
  const less = o.certificatePence === null || !seesCosts ? '' : ` — the certificate ${pounds(o.certificatePence)} less ${kept ?? pounds(o.certificatePence - expected)} commission.`;
  return (
    <Box label="cw-next">
      {head('Next: the provider’s payment')}
      <Msg><strong>{`Expected ${pounds(expected)} from ${o.providerName}${o.expectedBy ? ` by ${longDate(o.expectedBy)}` : ''}`}</strong>{less || '.'}</Msg>
      {money.canPay ? <div><Button variant="primary" onClick={money.onPay}>Mark paid</Button></div> : null}
      {money.lateDays === null ? null : <p className={note}>{`If it hasn’t arrived ${plural(money.lateDays, 'day', 'days')} after that, it shows on Today.`}</p>}
    </Box>
  );
}
const row = (children: ReactNode) => <div className="flex flex-wrap gap-2.5">{children}</div>;

function NextStep({ o, rule, remindDays, now, act, money }: { o: Full; rule: string | undefined; remindDays: number | null; now: string; act: Act; money: Money }) {
  const name = firstName(o.customerName);
  const head = (text: string) => <h3 id="cw-next" tabIndex={-1} className="m-0 text-size-17 font-bold">{text}</h3>;
  const addCertificate = (variant: 'primary' | 'default') => <Button variant={variant} onClick={act.onCertificate}>Add the certificate</Button>;
  const orderButton = (variant: 'primary' | 'default') => <Button variant={variant} disabled={act.busy} onClick={act.onOrder}>{orderLabel(o)}</Button>;
  const ordering = <p className={note}>Ordering creates the supplier order in Deliveries and orders.</p>;
  const trigger = rule === 'applied' ? 'once the customer has applied' : 'once the certificate arrives';
  if (o.stage === 'cancelled') {
    return <Box label="cw-next"><Msg><strong id="cw-cancelled" tabIndex={-1}>This order is cancelled.</strong></Msg></Box>;
  }
  if (o.stage === 'paid' || o.stage === 'closed' || (o.stage === 'collected' && o.expectedPence !== null)) return <MoneyStep o={o} money={money} />;
  if (o.stage === 'ready') {
    return (
      <Box label="cw-next">
        {head('Next: hand over')}
        <Msg tone="ok"><strong>Ready to collect.</strong>{` Certificate ${o.certificateNumber ?? ''}${o.held ? ` · ${o.bike} put aside` : ''}.`}</Msg>
        {row(<Button variant="primary" onClick={act.onHandOver}>Hand over</Button>)}
      </Box>
    );
  }
  if (o.stage === 'certificate') {
    if (o.onOrder) {
      // No due date: a supplier order has none to give (logged).
      return (
        <Box label="cw-next">
          {head('Next: the bike arrives')}
          <Msg tone="ok"><strong>Certificate received.</strong>{` The bike is on order${o.orderedFrom ? ` from ${o.orderedFrom}` : ''}.`}</Msg>
          <p className={note}>{`When it’s booked in through Deliveries and orders, it’s put aside for ${name} and this order moves to Ready to collect. ${name} is emailed “Ready to collect” then.`}</p>
          {o.purchaseOrderId ? <div><Link to={supplierOrderHref(o.purchaseOrderId)} aria-label={`Open the supplier order for ${possessive(name)} bike`} className={linkClass}>Open the supplier order</Link></div> : null}
        </Box>
      );
    }
    if (o.next === 'order') {
      // Not drawn (logged): the certificate rule's turn to order, as cw-order-applied.
      return (
        <Box label="cw-next">
          {head('Next: order the bike')}
          <Msg tone="ok"><strong>Certificate received.</strong>{` Your rule: order ${trigger}.`}</Msg>
          {row(orderButton('primary'))}
          {ordering}
        </Box>
      );
    }
    // A bike let go by booking in is pull request 6c's third part (logged).
    if (!o.held) return null;
    return (
      <Box label="cw-next">
        {head('Next: get the bike ready')}
        <Msg tone="ok"><strong>Certificate received.</strong>{` ${o.bike} is put aside for ${name}. ${name} has been sent “Certificate received”.`}</Msg>
        {row(<Button variant="primary" disabled={act.busy} aria-label={`Mark ${o.customerName}’s bike ready to collect`} onClick={act.onReady}>Mark ready to collect</Button>)}
        <p className={note}>{`One press, with Undo. ${name} is sent “Ready to collect”.`}</p>
      </Box>
    );
  }
  if (o.stage !== 'quote' && o.stage !== 'waiting') return null;
  if (o.onOrder) {
    // Not drawn (logged): ordered before the certificate, as the deposit's "and the bike ordered from [supplier]".
    return (
      <Box label="cw-next">
        {head(o.stage === 'quote' ? `Next: ${name} applies` : 'Next: the certificate')}
        <Msg tone="ok"><strong>The bike is ordered</strong>{o.orderedFrom ? ` from ${o.orderedFrom}.` : '.'}</Msg>
        {row(<>{o.stage === 'quote' ? <Button variant="primary" onClick={act.onApplied}>Mark as applied</Button> : null}{addCertificate(o.stage === 'quote' ? 'default' : 'primary')}</>)}
      </Box>
    );
  }
  if (o.holdUntil) {
    const left = daysBetween(now, o.holdUntil);
    // Hold longer and Release the bike come with pull request 5b (logged).
    return (
      <Box label="cw-next">
        {head('Next: the certificate')}
        <Msg><strong>{`${o.bike} is held until ${longDate(o.holdUntil)}.`}</strong>{left >= 0 ? ` Hold ends in ${plural(left, 'day', 'days')} — we’ll remind the shop ${remindDays === null ? '[n] days' : plural(remindDays, 'day', 'days')} before.` : ''}</Msg>
        {row(addCertificate('primary'))}
      </Box>
    );
  }
  if (!o.inStock) {
    if (o.next === 'order' || (o.stage === 'waiting' && rule === 'applied')) {
      return (
        <Box label="cw-next">
          {head('Next: order the bike')}
          <Msg tone="ok"><strong>{`${name} has applied`}</strong>{o.applicationReference ? ` (reference ${o.applicationReference})` : ''}{`. Your rule: order ${trigger}.`}</Msg>
          {row(<>{orderButton('primary')}{addCertificate('default')}</>)}
          {ordering}
        </Box>
      );
    }
    return (
      <Box label="cw-next">
        {head(o.stage === 'quote' ? `Next: ${name} applies` : 'Next: the certificate')}
        <Msg><strong>Not in stock.</strong>{` Your rule: order ${trigger}.`}</Msg>
        {row(<>{o.stage === 'quote' ? <Button variant="primary" onClick={act.onApplied}>Mark as applied</Button> : null}{addCertificate(o.stage === 'quote' ? 'default' : 'primary')}</>)}
      </Box>
    );
  }
  return <Box label="cw-next">{head('Next: the certificate')}{row(addCertificate('primary'))}</Box>;
}

/** Each line of "What's happened" in the drawn words (c2w.mjs EV); a quote and its email together are one line,
 *  even with the hold the server records between them (quote, held, emailed). */
function lines(o: Full): { at: string; by: string; text: string }[] {
  const out: { at: string; by: string; text: string }[] = [];
  const expected = o.expectedPence ?? 0;
  let paidSoFar = 0;
  let quoteLine: { line: { at: string; by: string; text: string }; by: string | null } | null = null;
  o.events.forEach((e) => {
    if (e.kind === 'quote_emailed' && quoteLine && quoteLine.by === e.by) {
      quoteLine.line.text = quoteLine.line.text.replace(/^gave quote (\S+)/, `gave quote $1 and emailed it to ${e.detail.to}`);
      quoteLine = null;
      return;
    }
    if (e.kind !== 'held') quoteLine = null;
    let text: string | null = null;
    if (e.kind === 'quote_given') {
      const held = /^We’re holding your bike until (.+?)\. /.exec(e.detail.closing ?? '');
      text = `gave quote ${e.detail.quoteRef}${held ? ` · it says the bike is put aside until ${held[1]}` : e.detail.closing ? ` · it says “${e.detail.closing}”` : ''}`;
    } else if (e.kind === 'held') text = e.detail.until ? `held ${o.bike} until ${longDate(e.detail.until)}` : null;
    else if (e.kind === 'quote_emailed') text = `emailed the quote to ${e.detail.to}`;
    else if (e.kind === 'certificate') text = `added certificate ${e.detail.number} · certificate ${pounds(Number(e.detail.certificatePence))} · quote ${pounds(Number(e.detail.quotePence))}${e.detail.ready ? ' · and marked the bike ready to collect' : ''}`;
    else if (e.kind === 'ready') text = 'marked the bike ready to collect';
    else if (e.kind === 'ordered') text = `ordered the bike from ${e.detail.supplier} · supplier order ${e.detail.purchaseOrderId}`;
    // Not drawn (logged): Undo of ordering says what it did.
    else if (e.kind === 'order_undone') text = 'undid the order from the supplier';
    // Not drawn (logged): Undo of Mark ready says what it did.
    else if (e.kind === 'ready_undone') text = 'undid ready to collect';
    else if (e.kind === 'cancelled') text = ['cancelled the order', e.detail.bike === 'keep' ? 'kept the bike as shop stock' : null, e.detail.notTold ? `${firstName(o.customerName)} wasn’t told: ${e.detail.notTold === 'no_phone' ? 'the shop has no phone number in Settings' : 'the message couldn’t be sent'}` : null, e.reason].filter(Boolean).join(' · ');
    else if (e.kind === 'part_paid') {
      paidSoFar += Number(e.detail.amountPence);
      text = `saved part paid: ${pounds(paidSoFar)} of ${pounds(expected)} received ${longDate(e.detail.receivedOn)} · ${pounds(expected - paidSoFar)} still owed`;
    } else if (e.kind === 'paid') {
      paidSoFar += Number(e.detail.amountPence);
      text = [`marked paid: ${pounds(putOn(e))} received ${longDate(e.detail.receivedOn)}`, e.detail.reference ? `reference ${e.detail.reference}` : null, e.detail.extraPence ? `the extra ${pounds(Number(e.detail.extraPence))} is noted` : null].filter(Boolean).join(' · ');
    } else if (e.kind === 'shortfall_closed') {
      const got = Number(e.detail.amountPence);
      paidSoFar += got;
      text = [`closed it with ${pounds(Number(e.detail.shortfallPence))} not paid${got ? `: ${pounds(got)} received ${longDate(e.detail.receivedOn)}` : ''}`, e.reason].filter(Boolean).join(' · ');
    } else if (e.kind === 'applied') text = [`marked ${firstName(o.customerName)} as applied`, e.detail.employer ? `employer ${e.detail.employer}` : null, e.detail.reference ? `reference ${e.detail.reference}` : null].filter(Boolean).join(' · ');
    if (!text) return;
    const line = { at: e.at, by: e.by ?? 'Wheelhouse', text };
    out.push(line);
    if (e.kind === 'quote_given') quoteLine = { line, by: e.by };
  });
  return out;
}
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

function History({ o }: { o: Full }) {
  return (
    <Box label="cw-hist">
      <h3 id="cw-hist" className="m-0 text-size-17 font-bold">What’s happened</h3>
      <ol className="m-0 list-none p-0">
        {lines(o).map((l, i) => (
          <li key={i} className="flex gap-3 border-t border-[var(--wh-border)] py-[7px] text-sm">
            <span className={`shrink-0 text-[var(--wh-muted)] ${mono}`}>{when(l.at)}</span>
            <span><strong>{l.by}</strong> {l.text}</span>
          </li>
        ))}
      </ol>
    </Box>
  );
}

const keptPence = (p: Provider, certificate: number) => (p.commissionValue == null ? null : p.commissionKind === 'percent' ? Math.round((certificate * p.commissionValue) / 10000) : p.commissionValue);
const commission = (p: Provider) => (p.commissionKind === undefined || p.commissionValue == null ? null : p.commissionKind === 'percent' ? `${p.commissionValue / 100}%` : pounds(p.commissionValue));

function Details({ o, provider, onEmail, busy }: { o: Full; provider: Provider | undefined; onEmail: () => void; busy: boolean }) {
  const queryClient = useQueryClient();
  const { show } = useSavedNote();
  // The quote on its own paper, as receipts print, once its logo has loaded, without leaving the order.
  async function print() {
    try {
      const { quote } = await queryClient.fetchQuery({ queryKey: quoteKey(o.id), queryFn: () => getQuote(o.id) });
      await printPaperWhenLoaded(<QuoteDoc q={quote} paper />);
    } catch {
      show({ text: 'Wheelhouse couldn’t load the quote to print. Try again in a moment.', failed: true, action: { label: 'Try again', run: () => void print() } });
    }
  }
  const extrasPence = o.accessories.reduce((n, a) => n + a.pricePence, 0);
  // Until the certificate, the provider pays the order, or the bike only when its accessories aren't inside.
  const providerPays = o.certificatePence ?? (provider && !provider.accessoriesInside ? o.totalPence - extrasPence : o.totalPence);
  const cut = provider ? commission(provider) : null;
  return (
    <Box label="cw-order">
      <h3 id="cw-order" className="m-0 text-size-17 font-bold">The order</h3>
      <div>
        <Kv k="Bike">{bikeLine(o)}</Kv>
        <Kv k="Accessories">{o.accessories.length ? o.accessories.map((a) => a.name).join(' · ') : 'None'}</Kv>
        <Kv k="Provider">{cut ? `${o.providerName} · commission ${cut}` : o.providerName}</Kv>
        <Kv k="Expected from the provider">{o.expectedPence !== null && o.expectedBy ? <span className={mono}>{`${pounds(o.expectedPence)} by ${longDate(o.expectedBy)}`}</span> : 'After collection'}</Kv>
      </div>
      <h3 id="cw-pays" className="m-0 mt-1 text-size-15 font-bold">Who pays what</h3>
      <div aria-labelledby="cw-pays">
        <Kv k="Order total"><span className={mono}>{pounds(o.totalPence)}</span></Kv>
        <Kv k={`${o.providerName} pays (the certificate)`}><span className={mono}>{pounds(providerPays)}</span></Kv>
        <Kv k={`${firstName(o.customerName)} pays at collection`} strong><span className={mono}>{pounds(Math.max(0, o.totalPence - providerPays))}</span></Kv>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {o.customerEmail ? <Button variant="default" disabled={busy} onClick={onEmail}>Email the quote again</Button> : null}
        <Button variant="default" onClick={() => void print()}>Print the quote</Button>
      </div>
    </Box>
  );
}

function Customer({ o }: { o: Full }) {
  const employer = [...o.events].reverse().find((e) => e.kind === 'applied')?.detail.employer;
  return (
    <Box label="cw-cust">
      <h3 id="cw-cust" className="m-0 text-size-17 font-bold">Customer</h3>
      <Link to={customerHref(o.customerId)} className={`${linkClass} self-start text-size-15 font-bold`}>{o.customerName}</Link>
      <span className="text-sm">{[o.customerPhone ? <span key="p" className={mono}>{o.customerPhone}</span> : null, o.customerEmail].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))}</span>
      <div>
        <Kv k="Applied">{o.appliedAt ? longDate(dayOf(o.appliedAt)) : '—'}</Kv>
        <Kv k="Employer">{employer ?? '—'}</Kv>
        <Kv k="Application reference">{o.applicationReference ?? '—'}</Kv>
      </div>
    </Box>
  );
}

function OrderBody() {
  const id = Number(useParams().id ?? '');
  const known = Number.isInteger(id);
  const session = useSession();
  const shop = session.status === 'signed-in' ? session.shop.name : '';
  const location = useLocation();
  const navigate = useNavigate();
  const saved = useSavedNote();
  const { show } = saved;
  const order = useQuery({ queryKey: ['c2w-order', id], queryFn: () => apiGet<{ order: Full; today: string }>(`/api/c2w/orders/${id}`), retry: false, enabled: known });
  const settings = useC2wSettings().data?.settings;
  const providers = useAllProviders().data?.providers;
  const { send, busy } = useEmailQuote(id);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<'applied' | 'certificate' | 'hand-over' | 'cancel' | 'paid' | 'close' | null>(null);
  const [stepping, setStepping] = useState(false);
  const shown = useRef(false);
  // The note New order sends (cw-order-held), shown once: the address is cleared
  // of it, so a reload or Back doesn't show it again. An email that didn't go
  // offers Try again.
  useEffect(() => {
    const sent = (location.state as { note?: { text: string; failed: boolean; retry?: boolean } } | null)?.note;
    if (!sent || shown.current) return;
    shown.current = true;
    show(sent.retry ? { text: sent.text, failed: true, action: { label: 'Try again', run: () => { saved.busy(); void send(); } } } : sent);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, show, send, saved]);

  if (!known || order.isError) {
    return <Page><Back to={ROUTES.c2w}>Cycle to Work</Back><p role="alert" className="m-0 text-sm">{!known || (order.error instanceof ApiError && order.error.status === 404) ? 'Order not found' : 'Wheelhouse couldn’t load this order. Try again in a moment.'}</p></Page>;
  }
  const o = order.data?.order;
  if (!o) return <Page><Back to={ROUTES.c2w}>Cycle to Work</Back><p className={note}>Loading…</p></Page>;
  const provider = providers?.find((p) => p.id === o.providerId);
  const today = order.data?.today ?? '';
  const name = firstName(o.customerName);
  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['c2w-order', id] }),
    queryClient.invalidateQueries({ queryKey: ['c2w-orders'] }),
    queryClient.invalidateQueries({ queryKey: ['c2w-count'] }),
  ]);
  // Mark ready to collect (cw-marked-ready) and Order from [supplier] (cw-ordered), each with Undo in the note.
  async function step(path: 'ready' | 'ready/undo' | 'order' | 'order/undo') {
    const current = o as Full;
    setStepping(true);
    try {
      const done = await apiMutate<{ supplier?: string }>(`/api/c2w/orders/${id}/${path}`, {});
      await reload();
      const undo = (back: 'ready/undo' | 'order/undo') => ({ label: 'Undo', run: () => { saved.busy(); void step(back); } });
      show(path === 'ready'
        ? { text: `Marked ready to collect. ${name} is sent “Ready to collect”.`, action: undo('ready/undo') }
        : path === 'order' ? { text: orderedNote(current, done.supplier ?? current.supplier), action: undo('order/undo') }
          : { text: 'Undone' });
    } catch (err) {
      void reload();
      show({ text: serverSaid(err) ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.', failed: true });
    } finally {
      setStepping(false);
    }
  }
  const act = { onApplied: () => setOpen('applied'), onCertificate: () => setOpen('certificate'), onReady: () => void step('ready'), onOrder: () => void step('order'), onHandOver: () => setOpen('hand-over'), busy: stepping };
  const canPay = session.status === 'signed-in' && session.user.isOwner;
  const money = { provider, lateDays: settings?.paymentLateDays ?? null, canPay, onPay: () => setOpen('paid'), onCloseOwed: () => setOpen('close') };
  const left = <><NextStep o={o} rule={settings?.orderRule} remindDays={settings?.remindDays ?? null} now={today} act={act} money={money} /><History o={o} /></>;
  const right = <><Details o={o} provider={provider} onEmail={() => void send()} busy={busy} /><Customer o={o} /></>;
  return (
    <Page>
      <Back to={ROUTES.c2w}>Cycle to Work</Back>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-size-22 font-bold md:text-size-26">{`${o.customerName} · Cycle to Work`}</h2>
          <p className={note}>{`Quote ${o.quoteRef} · ${o.siteName && o.siteName !== shop ? `${shop}, ${o.siteName}` : shop}`}</p>
        </div>
        {OPEN_STAGES.has(o.stage) ? <MoreMenu o={o} onCancel={() => setOpen('cancel')} /> : null}
      </div>
      {o.stage === 'cancelled' || o.stage === 'closed' ? null : <Stages o={o} />}
      <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-3.5">{left}</div>
        <div className="flex flex-col gap-3.5">{right}</div>
      </div>
      {open === 'applied' ? <AppliedDialog o={o} today={today} rule={settings?.orderRule} supplier={o.supplier ?? null} onClose={() => setOpen(null)} /> : null}
      {open === 'certificate' ? <CertificateDialog o={o} today={today} onClose={() => setOpen(null)} /> : null}
      {open === 'hand-over' ? <HandOverDialog o={o} provider={provider} onClose={() => setOpen(null)} /> : null}
      {open === 'cancel' ? <CancelDialog o={o} events={o.events} shop={shop} onClose={() => setOpen(null)} /> : null}
      {open === 'paid' || open === 'close' ? <MarkPaidDialog o={o} today={today} closing={open === 'close'} onClose={() => setOpen(null)} onSaved={(text) => show({ text })} /> : null}
    </Page>
  );
}

export function C2wOrderPage() {
  return <SavedNoteArea room="c2w-order" className="flex w-full flex-col"><OrderBody /></SavedNoteArea>;
}
