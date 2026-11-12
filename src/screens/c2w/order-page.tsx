import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { SavedNoteArea, useSavedNote } from '@/screens/settings/saved-note.tsx';
import { customerHref } from '@/screens/customers/customers-page.tsx';
import {
  Back, Box, Kv, Msg, Page, daysBetween, dayOf, firstName, linkClass, longDate, mono, note, plural, pounds, bikeLine,
  useAllProviders, useC2wSettings, type C2wEvent, type C2wOrder, type Provider,
} from './c2w-bits.tsx';
import { printPaperWhenLoaded } from '@/screens/till/receipt.tsx';
import { QuoteDoc, getQuote, quoteKey, useEmailQuote } from './quote-page.tsx';

/**
 * One Cycle to Work order (c2w.mjs orderPage; cw-order-held, and the owner's
 * provider line from cw-more): the stages, what's next, "What's happened",
 * The order with Who pays what, and the customer. The next-step buttons and
 * the More… menu come with the pull requests that build those steps
 * (openspec/changes/cycle-to-work tasks 5–8; logged).
 */
type Full = C2wOrder & { events: C2wEvent[] };
const STAGES = ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected', 'Paid by the provider'];
// A quote given is already waiting for the certificate, as drawn (cw-order-held).
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

function NextStep({ o, rule, remindDays, now }: { o: Full; rule: string | undefined; remindDays: number | null; now: string }) {
  if (o.stage !== 'quote' && o.stage !== 'waiting') return null;
  const name = firstName(o.customerName);
  if (o.holdUntil) {
    const left = daysBetween(now, o.holdUntil);
    return (
      <Box label="cw-next">
        <h3 id="cw-next" className="m-0 text-size-17 font-bold">Next: the certificate</h3>
        <Msg><strong>{`${o.bike} is held until ${longDate(o.holdUntil)}.`}</strong>{left >= 0 ? ` Hold ends in ${plural(left, 'day', 'days')} — we’ll remind the shop ${remindDays === null ? '[n] days' : plural(remindDays, 'day', 'days')} before.` : ''}</Msg>
      </Box>
    );
  }
  if (!o.inStock) {
    const trigger = rule === 'applied' ? 'once the customer has applied' : 'once the certificate arrives';
    if (o.stage === 'waiting' && rule === 'applied') {
      return (
        <Box label="cw-next">
          <h3 id="cw-next" className="m-0 text-size-17 font-bold">Next: order the bike</h3>
          <Msg tone="ok"><strong>{`${name} has applied`}</strong>{o.applicationReference ? ` (reference ${o.applicationReference})` : ''}{`. Your rule: order ${trigger}.`}</Msg>
        </Box>
      );
    }
    return (
      <Box label="cw-next">
        <h3 id="cw-next" className="m-0 text-size-17 font-bold">{o.stage === 'quote' ? `Next: ${name} applies` : 'Next: the certificate'}</h3>
        <Msg><strong>Not in stock.</strong>{` Your rule: order ${trigger}.`}</Msg>
      </Box>
    );
  }
  return <Box label="cw-next"><h3 id="cw-next" className="m-0 text-size-17 font-bold">Next: the certificate</h3></Box>;
}

/** Each line of "What's happened" in the drawn words (c2w.mjs EV); a quote and its email together are one line. */
function lines(o: Full): { at: string; by: string; text: string }[] {
  const out: { at: string; by: string; text: string }[] = [];
  o.events.forEach((e, i) => {
    const prev = o.events[i - 1];
    if (e.kind === 'quote_emailed' && prev?.kind === 'quote_given' && prev.by === e.by) {
      out[out.length - 1].text = out[out.length - 1].text.replace(/^gave quote (\S+)/, `gave quote $1 and emailed it to ${e.detail.to}`);
      return;
    }
    let text: string | null = null;
    if (e.kind === 'quote_given') {
      const held = /^We’re holding your bike until (.+?)\. /.exec(e.detail.closing ?? '');
      text = `gave quote ${e.detail.quoteRef}${held ? ` · it says the bike is put aside until ${held[1]}` : e.detail.closing ? ` · it says “${e.detail.closing}”` : ''}`;
    } else if (e.kind === 'quote_emailed') text = `emailed the quote to ${e.detail.to}`;
    else if (e.kind === 'applied') text = [`marked ${firstName(o.customerName)} as applied`, e.detail.employer ? `employer ${e.detail.employer}` : null, e.detail.reference ? `reference ${e.detail.reference}` : null].filter(Boolean).join(' · ');
    if (text) out.push({ at: e.at, by: e.by ?? 'Wheelhouse', text });
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
  const left = <><NextStep o={o} rule={settings?.orderRule} remindDays={settings?.remindDays ?? null} now={order.data?.today ?? ''} /><History o={o} /></>;
  const right = <><Details o={o} provider={provider} onEmail={() => void send()} busy={busy} /><Customer o={o} /></>;
  return (
    <Page>
      <Back to={ROUTES.c2w}>Cycle to Work</Back>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-size-22 font-bold md:text-size-26">{`${o.customerName} · Cycle to Work`}</h2>
        <p className={note}>{`Quote ${o.quoteRef} · ${o.siteName && o.siteName !== shop ? `${shop}, ${o.siteName}` : shop}`}</p>
      </div>
      <Stages o={o} />
      <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-3.5">{left}</div>
        <div className="flex flex-col gap-3.5">{right}</div>
      </div>
    </Page>
  );
}

export function C2wOrderPage() {
  return <SavedNoteArea room="c2w-order" className="flex w-full flex-col"><OrderBody /></SavedNoteArea>;
}
