import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet, serverSaid } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button, buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/staff/routes.ts';
import { SavedNoteArea, useSavedNote } from '@/screens/settings/saved-note.tsx';
import { Back, Badge, Box, Page, longDate, note, orderHref, plural, pounds, type C2wOrder } from './c2w-bits.tsx';
import { MarkPaidDialog } from './mark-paid-dialog.tsx';
import { RecordPaymentDialog, expectedLine, owedProviderQuery, type OwedBike, type OwedProvider } from './record-payment-dialog.tsx';

/**
 * What Cycle to Work providers owe (c2w.mjs owedPage, owedProvider; cw-owed,
 * cw-owed-reports, cw-owed-provider; openspec/changes/cycle-to-work task 8's
 * owed screens). Only someone who can see costs sees amounts: the server
 * refuses anyone else, and the page shows its reason. Record a payment and
 * Mark paid are the owner's, as the server allows (logged).
 */
type Owed = {
  providers: { id: number; name: string; bikes: number; owedPence: number; latePence: number; lateDays: number | null }[];
  total: { bikes: number; owedPence: number; latePence: number };
  today: string;
};
const HEAD = 'border-b border-[var(--wh-border)] px-2 py-2 text-size-13 font-semibold text-[var(--wh-muted)] first:pl-0 last:pr-0';
const CELL = 'border-b border-[var(--wh-border)] px-2 py-2.5 first:pl-0 last:pr-0';
const TOTAL = 'px-2 py-2.5 font-bold first:pl-0 last:pr-0';
const mono = 'font-[family-name:var(--wh-font-mono)]';
const days = (n: number) => plural(n, 'day', 'days');
const LOAD_FAILED = 'Wheelhouse couldn’t load what’s owed. Try again in a moment.';
const providerHref = (id: number) => ROUTES['cw-owed-provider'].replace(':id', String(id));

function useShop() {
  const session = useSession();
  return { shop: session.status === 'signed-in' ? session.shop.name : '', owner: session.status === 'signed-in' && session.user.isOwner };
}

function Refused({ error }: { error: unknown }) {
  return <p role="alert" className="m-0 text-sm">{serverSaid(error) ? error.message : LOAD_FAILED}</p>;
}

function OwedBody() {
  const fromReports = useLocation().pathname === ROUTES['cw-owed-reports'];
  const { shop } = useShop();
  const owed = useQuery({ queryKey: ['c2w-owed'], queryFn: () => apiGet<Owed>('/api/c2w/owed'), retry: false });
  const o = owed.data;
  return (
    <Page>
      {fromReports ? <Back to={ROUTES.reports}>Reports</Back> : <Back to={ROUTES.c2w}>Cycle to Work</Back>}
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 text-xl font-bold">Owed by Cycle to Work providers</h2>
          <p className={note}>{`Bikes collected, not yet paid for · ${shop}`}</p>
        </div>
        {o && o.providers.length > 0 ? (
          <a href="/api/c2w/owed.csv" download aria-label="Download as spreadsheet" className={buttonVariants({ variant: 'default' })}>
            <span className="max-md:hidden">Download as spreadsheet</span><span className="md:hidden">Download</span>
          </a>
        ) : null}
      </div>
      {owed.isError ? <Refused error={owed.error} /> : !o ? <p className={note}>Loading…</p>
        : o.providers.length === 0 ? <Box><p className="m-0 text-size-15">Nothing is owed by Cycle to Work providers just now.</p></Box> : (
          <>
            <Box>
              <table className="w-full border-collapse text-size-15 max-md:text-sm">
                <thead><tr>
                  <th scope="col" className={`${HEAD} text-left`}>Provider</th>
                  <th scope="col" className={`${HEAD} text-left`}>Bikes</th>
                  <th scope="col" className={`${HEAD} text-right`}>Owed</th>
                  <th scope="col" className={`${HEAD} text-right`}>Late</th>
                </tr></thead>
                <tbody>
                  {o.providers.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className={`${CELL} text-left`}>
                        <Link to={providerHref(p.id)} aria-label={`${p.name}: bikes owed and Record a payment`} className="inline-flex min-h-11 items-center font-bold text-[var(--wh-ink)]">{p.name}</Link>
                      </th>
                      <td className={CELL}>{p.bikes}</td>
                      <td className={`${CELL} text-right ${mono}`}>{pounds(p.owedPence)}</td>
                      <td className={`${CELL} text-right`}>{p.latePence > 0 && p.lateDays !== null ? <Badge tone="amber">{`${pounds(p.latePence)} · ${days(p.lateDays)}`}</Badge> : '—'}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className={`${TOTAL} text-left`}>Total</th>
                    <td className={TOTAL} />
                    <td className={`${TOTAL} text-right ${mono}`}>{pounds(o.total.owedPence)}</td>
                    <td className={TOTAL} />
                  </tr>
                </tbody>
              </table>
            </Box>
            <p className={note}>Open a provider to record a payment that covers several bikes.</p>
          </>
        )}
    </Page>
  );
}

export function C2wOwedPage() {
  return <OwedBody />;
}

// On a phone the table's rows stack (c2w.mjs owedProvider's phone list), with
// each cell's label added by CSS so the table stays one table (logged).
const PHONE_ROW = 'max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)] max-md:gap-x-1.5 max-md:border-b max-md:border-[var(--wh-border)] max-md:py-2';
const PHONE_CELL = 'max-md:border-0 max-md:p-0 max-md:text-size-13';

function ProviderBody() {
  const id = Number(useParams().id);
  const { shop, owner } = useShop();
  const saved = useSavedNote();
  const owed = useQuery({ ...owedProviderQuery(id), retry: false });
  const [paying, setPaying] = useState<OwedBike | null>(null);
  const [recording, setRecording] = useState(false);
  const d: OwedProvider | undefined = owed.data;
  const back = <Back to={ROUTES['cw-owed']}>Owed by Cycle to Work providers</Back>;
  if (owed.isError) return <Page>{back}<Refused error={owed.error} /></Page>;
  if (!d) return <Page>{back}<p className={note}>Loading…</p></Page>;
  const p = d.provider;
  const commission = p.commissionValue == null || !p.commissionKind ? null : p.commissionKind === 'percent' ? `${p.commissionValue / 100}%` : pounds(p.commissionValue);
  const terms = [commission ? `Commission ${commission}` : '', p.paysInDays != null ? `pays in about ${days(p.paysInDays)}` : '', shop].filter(Boolean).join(' · ');
  const asOrder = (b: OwedBike) => ({ ...b, providerId: p.id, providerName: p.name }) as unknown as C2wOrder;
  const show = (text: string) => saved.show({ text });
  return (
    <Page>
      {back}
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="cw-owed-h" tabIndex={-1} className="m-0 text-xl font-bold outline-none">{`${p.name} · ${plural(d.orders.length, 'bike', 'bikes')} owed`}</h2>
          <p className={note}>{terms}</p>
        </div>
        {owner && d.orders.length > 0 ? <Button onClick={() => setRecording(true)}>Record a payment</Button> : null}
      </div>
      <Box>
        {d.orders.length === 0 ? <p className="m-0 text-size-15">{`Nothing is owed by ${p.name} just now.`}</p> : (
          <table className="w-full border-collapse text-size-15 max-md:block">
            <thead className="max-md:sr-only"><tr>
              <th scope="col" className={`${HEAD} text-left`}>Customer</th>
              <th scope="col" className={`${HEAD} text-left`}>Collected</th>
              <th scope="col" className={`${HEAD} text-left`}>Certificate</th>
              <th scope="col" className={`${HEAD} text-right`}>Expected</th>
              <th scope="col" className={`${HEAD} text-left`}>Late</th>
              <th scope="col" className={HEAD}><span className="sr-only">Action</span></th>
            </tr></thead>
            <tbody className="max-md:block">
              {d.orders.map((b) => (
                <tr key={b.id} className={PHONE_ROW}>
                  <th scope="row" className={`${CELL} ${PHONE_CELL} text-left max-md:col-span-2`}>
                    <Link to={orderHref(b.id)} className="inline-flex min-h-11 items-center font-bold text-[var(--wh-ink)] max-md:text-size-15">{b.customerName}</Link>
                  </th>
                  <td className={`${CELL} ${PHONE_CELL} max-md:before:content-['Collected_']`}>{longDate(b.collectedOn)}</td>
                  <td className={`${CELL} ${PHONE_CELL} ${mono} max-md:before:content-['·_certificate_']`}>{b.certificateNumber ?? '—'}</td>
                  <td className={`${CELL} ${PHONE_CELL} text-right ${mono} max-md:text-left max-md:before:content-['Expected_']`}>{expectedLine(b)}</td>
                  <td className={`${CELL} ${PHONE_CELL}`}>{b.lateDays ? <Badge tone="amber">{`${days(b.lateDays)} late`}</Badge> : '—'}</td>
                  <td className={`${CELL} ${PHONE_CELL} text-right max-md:col-span-2 max-md:pt-1.5 max-md:text-left`}>
                    {owner ? <Button aria-label={`Mark paid: ${b.customerName} · ${p.name}`} onClick={() => setPaying(b)}>Mark paid</Button> : null}
                  </td>
                </tr>
              ))}
              <tr className="max-md:flex max-md:justify-between">
                <th scope="row" className={`${TOTAL} text-left`}>Total</th>
                <td className={`${TOTAL} max-md:hidden`} />
                <td className={`${TOTAL} max-md:hidden`} />
                <td className={`${TOTAL} text-right ${mono}`}>{pounds(d.orders.reduce((n, b) => n + b.owedPence, 0))}</td>
                <td className={`${TOTAL} max-md:hidden`} />
                <td className={`${TOTAL} max-md:hidden`} />
              </tr>
            </tbody>
          </table>
        )}
      </Box>
      <p className={note}>“Record a payment” is for one payment that covers several bikes. “Mark paid” on a row is still there for one bike.</p>
      {paying ? <MarkPaidDialog o={asOrder(paying)} today={d.today} focusTo="cw-owed-h" onClose={() => setPaying(null)} onSaved={show} /> : null}
      {recording ? <RecordPaymentDialog provider={p} bikes={d.orders} today={d.today} focusTo="cw-owed-h" onClose={() => setRecording(false)} onSaved={show} /> : null}
    </Page>
  );
}

export function C2wOwedProviderPage() {
  return <SavedNoteArea room="c2w-owed" className="flex w-full flex-col"><ProviderBody /></SavedNoteArea>;
}
