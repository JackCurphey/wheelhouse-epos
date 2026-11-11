import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';
import { BoxHeading, Page, Refusal } from './reports-bits.tsx';
import { money } from './reports-format.ts';

/**
 * Reports (rp-home in generator/reports.mjs; Jack's answers 1 and 2 of
 * 10 Nov; openspec/changes/reports-sales-and-takings): today's date and the
 * shop, the strip with this week's Takings so far (its Margin tile waits for
 * part 2), and a card for each report that is built. Each later part adds its
 * card here and nowhere else.
 */
type Home = { today: string; dateLine: string; shopLine: string; strip: { heading: string; takingsPence: number } };

const CARDS: { name: string; line: string; to: string }[] = [
  { name: 'Sales', line: 'Takings, number of sales and the average sale', to: ROUTES['rp-sales'] },
  // The drawing's "and till" is left out while closes are per shop (Jack's answer 4, 10 Nov).
  { name: 'Takings and cash-ups', line: 'Each closed day, and any cash difference', to: ROUTES['rp-takings'] },
  { name: 'Workshop', line: 'Jobs, labour and parts, how full each mechanic was', to: ROUTES['rp-workshop'] },
  { name: 'Returning customers', line: 'Who comes back, and who hasn’t been in for a while', to: ROUTES['rp-returning'] },
  { name: 'Margin and stock value', line: 'What you made on what you sold, what’s on the shelves, and stock written off', to: ROUTES['rp-margin'] },
  { name: 'VAT', line: 'VAT by rate for your VAT quarter, for your accountant', to: ROUTES['rp-vat'] },
];

export function ReportsPage() {
  const home = useQuery({ queryKey: ['reports-home'], queryFn: () => apiGet<Home>('/api/reports/home'), retry: false });
  if (home.isError) return <Page><Refusal error={home.error} /></Page>;
  if (!home.data) return <Page><p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></Page>;
  const { dateLine, shopLine, strip } = home.data;
  return (
    <Page>
      <p className="m-0 text-size-15 text-[var(--wh-muted)] max-md:text-sm">{dateLine} · {shopLine}</p>
      <section aria-label={strip.heading} className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">
        <BoxHeading>{strip.heading}</BoxHeading>
        <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3">
            <span className="text-size-13-5 text-[var(--wh-muted)]">Takings</span>
            <span className="text-size-17 font-bold">{money(strip.takingsPence)}</span>
          </div>
          <Link to={ROUTES['rp-sales']} className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 py-3 text-[var(--wh-ink)] no-underline">
            <span className="flex min-w-0 flex-col gap-0.5"><span className="text-size-13-5 text-[var(--wh-muted)]">Shop</span><span className="text-size-17 font-bold">{shopLine}</span></span>
            <span aria-hidden="true" className="text-[var(--wh-muted)]">›</span>
          </Link>
        </div>
      </section>
      <section aria-labelledby="rp-ready" className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">
        <BoxHeading id="rp-ready">Ready-made reports</BoxHeading>
        <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
          {CARDS.map((c) => (
            <Link key={c.name} to={c.to} className="flex min-h-[76px] flex-col gap-1 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-3.5 text-[var(--wh-ink)] no-underline">
              <span className="text-size-15 font-bold">{c.name}</span>
              <span className="text-sm text-[var(--wh-muted)]">{c.line}</span>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  );
}

