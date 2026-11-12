import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button, buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { NewOrder } from './new-order.tsx';
import {
  Badge, Box, Page, daysBetween, dayOf, linkClass, longDate, note, orderHref, plural, possessive, pounds, bikeLine, useC2wSettings, type C2wOrder,
} from './c2w-bits.tsx';

/**
 * Front desk › Cycle to Work (c2w.mjs listPage, cw-list and cw-list-owner;
 * firstUse, cw-first-use): what needs doing, then the open orders grouped by
 * stage. Each row's next-step button comes with the pull request that builds
 * that step (openspec/changes/cycle-to-work tasks 5–8); until then the
 * name opens the order (logged).
 */
type Group = 'waiting' | 'certificate' | 'ready' | 'collected' | 'paid';
type List = {
  groups: Record<Group, C2wOrder[]>;
  counts: { holdEndingSoon: number; holdEnded: number; readyToOrder: number; noCertificate: number; paymentLate: number; owedPence?: number };
  count: number; providers: number; today: string;
};
const TITLES: [Group, string, string?][] = [
  ['waiting', 'Waiting for the certificate', 'Bikes in stock are held for the customer. Ones to order follow your rule in Settings.'],
  ['certificate', 'Certificate received'],
  ['ready', 'Ready to collect'],
  ['collected', 'Collected · waiting for payment'],
  ['paid', 'Paid · last 30 days'],
];
export const C2W_SETTINGS = (fold: string) => `${ROUTES.settings}?room=front-desk&fold=${fold}`;
const dayName = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', '');

function Status({ o, remindDays, now }: { o: C2wOrder; remindDays: number | null; now: string }) {
  if (o.stage === 'collected' && o.expectedBy && o.expectedPence !== null) {
    const late = daysBetween(o.expectedBy, now);
    return late > 0
      ? <><Badge tone="amber">{`${plural(late, 'day', 'days')} late`}</Badge> {`${pounds(o.expectedPence)} was due ${longDate(o.expectedBy)}`}</>
      : <>{`Expected ${pounds(o.expectedPence)} by ${longDate(o.expectedBy)}`}</>;
  }
  if (o.stage === 'paid' && o.paidOn && o.paidPence !== null) return <>{`Paid ${pounds(o.paidPence)} on ${longDate(o.paidOn)}`}</>;
  // "Due from [supplier] [date]" for a bike on order waits for pull request 6, which orders it (logged).
  if (o.stage === 'ready' && o.certificateNumber) return <>{`Certificate ${o.certificateNumber} · put aside`}</>;
  if (o.stage !== 'quote' && o.stage !== 'waiting') return null;
  if (o.holdUntil) {
    // The server says when a hold has ended (its "choose"); the days left come from the reminder days.
    if (o.next === 'choose') return <>Still held<br /><Badge tone="amber">{`Hold ended ${longDate(o.holdUntil)} — choose`}</Badge></>;
    const left = daysBetween(now, o.holdUntil);
    const soon = remindDays !== null && left >= 0 && left <= remindDays;
    return <>{`Held until ${longDate(o.holdUntil)}`}{soon ? <><br /><Badge tone="amber">{`Hold ends in ${plural(left, 'day', 'days')}`}</Badge></> : null}</>;
  }
  const said = o.appliedAt ? `Applied ${longDate(dayOf(o.appliedAt))}` : `Quote given ${longDate(dayOf(o.quoteGivenAt))}`;
  return <>{said}{o.next === 'order' ? <><br /><Badge tone="blue">Ready to order</Badge></> : null}</>;
}

function Row({ o, remindDays, now }: { o: C2wOrder; remindDays: number | null; now: string }) {
  const late = o.stage === 'collected' && o.expectedBy !== null && o.expectedBy < now;
  const open = o.stage === 'collected' || o.stage === 'paid' || o.stage === 'certificate' || o.stage === 'ready';
  return (
    <li className="grid grid-cols-1 items-center gap-1.5 border-t border-[var(--wh-border)] py-3 md:grid-cols-[200px_minmax(0,1fr)_230px_190px] md:gap-4">
      <Link to={orderHref(o.id)} aria-label={`Open ${possessive(o.customerName)} order`} className="flex min-h-11 flex-col justify-center gap-0.5 text-[var(--wh-ink)] no-underline">
        <span className="text-size-15 font-bold underline">{o.customerName}</span>
        <span className="text-size-13 text-[var(--wh-muted)]">{`Quote ${o.quoteRef}`}</span>
      </Link>
      <span className="flex flex-col gap-[3px] text-sm">
        <span>{bikeLine(o)}</span>
        <span className="text-[var(--wh-muted)]">{o.providerName}</span>
      </span>
      <span className="text-sm">
        <Status o={o} remindDays={remindDays} now={now} />
      </span>
      <span className="justify-self-start md:justify-self-end">
        {open ? <Link to={orderHref(o.id)} aria-label={`Open ${possessive(o.customerName)} ${late ? 'late ' : o.stage === 'paid' ? 'paid ' : ''}order`} className={linkClass}>Open</Link> : null}
      </span>
    </li>
  );
}

function TopLine({ list, action }: { list: List; action: ReactNode }) {
  const c = list.counts;
  const items: [number, string, 'amber' | 'blue'][] = [
    [c.holdEnded, plural(c.holdEnded, 'hold ended — choose', 'holds ended — choose'), 'amber'],
    [c.holdEndingSoon, plural(c.holdEndingSoon, 'hold ending soon', 'holds ending soon'), 'amber'],
    [c.readyToOrder, plural(c.readyToOrder, 'bike ready to order', 'bikes ready to order'), 'blue'],
    [c.noCertificate, plural(c.noCertificate, 'quote with no certificate yet', 'quotes with no certificate yet'), 'amber'],
    [c.paymentLate, plural(c.paymentLate, 'payment late', 'payments late'), 'amber'],
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <p className="m-0 inline-flex flex-wrap items-center gap-x-3.5 gap-y-2 text-size-15">
        {items.filter(([n]) => n > 0).map(([, text, tone]) => <Badge key={text} tone={tone}>{text}</Badge>)}
        {c.owedPence !== undefined ? <span className="inline-flex min-h-11 items-center font-semibold">{`Owed by providers ${pounds(c.owedPence)} · ${c.paymentLate} late`}</span> : null}
      </p>
      {action}
    </div>
  );
}

function FirstUse({ owner, shop }: { owner: boolean; shop: string }) {
  return (
    <>
      <p className={note}>{shop}</p>
      <Box className="max-w-[720px]" label="cw-first">
        <h3 id="cw-first" className="m-0 text-size-17 font-bold">No Cycle to Work orders yet</h3>
        <p className="m-0 text-size-15 leading-normal">Each bike sold through a scheme gets an order here, from the quote to the provider’s payment.</p>
        <p className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3 py-2.5 text-size-15 leading-normal text-[var(--wh-warn-ink)]"><strong>No scheme providers yet.</strong> Add the providers your customers use, with their terms, before the first quote.</p>
        {owner ? (
          <div className="flex flex-wrap gap-2.5">
            <Link to={C2W_SETTINGS('c2w-providers')} className={buttonVariants({ variant: 'accent' })}>Add providers</Link>
            <Link to={C2W_SETTINGS('c2w-hold')} className={buttonVariants({ variant: 'default' })}>Set how bikes are held and ordered</Link>
          </div>
        ) : null}
        <p className={note}>Staff can start orders once there’s a provider to choose.</p>
      </Box>
    </>
  );
}

export function C2wListPage() {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const shop = session.status === 'signed-in' ? session.shop.name : '';
  const list = useQuery({ queryKey: ['c2w-orders'], queryFn: () => apiGet<List>('/api/c2w/orders') });
  const remindDays = useC2wSettings().data?.settings.remindDays ?? null;
  const [starting, setStarting] = useState(false);

  if (list.isError) return <Page><p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load Cycle to Work orders. Try again in a moment.</p></Page>;
  const l = list.data;
  if (!l) return <Page><p className={note}>Loading…</p></Page>;
  const groups = TITLES.filter(([g]) => l.groups[g].length > 0);
  if (groups.length === 0 && l.providers === 0) return <Page><FirstUse owner={owner} shop={shop} /></Page>;

  const start = l.providers > 0
    ? <Button variant="accent" onClick={() => setStarting(true)}>+ New Cycle to Work order</Button>
    : owner ? <Link to={C2W_SETTINGS('c2w-providers')} className={buttonVariants({ variant: 'accent' })}>+ New Cycle to Work order</Link> : null;
  return (
    <Page>
      <p className={note}>{`${dayName(l.today)} · ${shop}`}</p>
      <TopLine list={l} action={start} />
      {groups.length === 0 ? (
        <Box label="cw-none">
          <h3 id="cw-none" className="m-0 text-size-17 font-bold">No Cycle to Work orders yet</h3>
          <p className="m-0 text-size-15 leading-normal">Each bike sold through a scheme gets an order here, from the quote to the provider’s payment.</p>
        </Box>
      ) : null}
      {groups.map(([g, title, sub]) => (
        <Box key={g} label={`cw-g-${g}`}>
          <h2 id={`cw-g-${g}`} className="m-0 text-size-17 font-bold">{`${title} · ${l.groups[g].length}`}</h2>
          {sub ? <p className={note}>{sub}</p> : null}
          <ul aria-labelledby={`cw-g-${g}`} className="m-0 list-none p-0">
            {l.groups[g].map((o) => <Row key={o.id} o={o} remindDays={remindDays} now={l.today} />)}
          </ul>
        </Box>
      ))}
      {starting ? <NewOrder today={l.today} onClose={() => setStarting(false)} /> : null}
    </Page>
  );
}
