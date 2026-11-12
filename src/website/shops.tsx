import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams } from 'react-router';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { bookPath } from './address.ts';
import { hasDetails, useSiteContext, type FirstShop, type ShopEntry } from './site-query.ts';
import { Box, H1, H2, ShopCards, directionsUrl, linkButton } from './parts.tsx';
import { NotFoundPage, usePageTitle } from './pages.tsx';

/**
 * Our shops and each shop's own page (openspec/changes/website-browse, task
 * 7.3-7.4; wb-shops, wb-shop-page, wb-shop-collect and wb-find-us in
 * browse.mjs). The shared address, phone, email and hours are on the first
 * shop only (Jack's answer 1); another shop shows its name until Multiple
 * sites gives it its own details. Shops have no photo or words of their own
 * yet, so neither is drawn (task 3.5: no data, no piece).
 */

/** /shops: a card for each shop (wb-shops); with one shop, Find us (wb-find-us). */
export function ShopsPage() {
  const { site, several } = useSiteContext();
  if (!several) return site.shops[0] ? <ShopView shop={site.shops[0]} /> : <NotFoundPage />;
  return <OurShops />;
}

function OurShops() {
  usePageTitle('Our shops');
  return (
    <>
      <H1>Our shops</H1>
      <ShopCards />
    </>
  );
}

/** /shops/<id>: that shop's page, or "We can’t find that page" for a shop the business doesn't have. */
export function ShopPageRoute() {
  const { id } = useParams();
  const { site } = useSiteContext();
  const shop = site.shops.find((s) => String(s.id) === id);
  return shop ? <ShopView shop={shop} /> : <NotFoundPage />;
}

/** Monday first, as the drawing lists the week; 0 is Sunday. */
const WEEK: [number, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];

const dayMonth = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "Closed 25 December to 26 December.", "Closed 7 September and 1 October to 2 October." */
export function closuresText(closures: FirstShop['closures']): string {
  const parts = closures.map((c) => (c.from === c.to ? dayMonth(c.from) : `${dayMonth(c.from)} to ${dayMonth(c.to)}`));
  const list = parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Closed ${list}.`;
}

/** wb-shop-page's Opening hours: the week with today's row in bold, then the closures. */
function OpeningHours({ shop }: { shop: FirstShop }) {
  const today = new Date(`${shop.todayDate}T12:00:00Z`).getUTCDay();
  return (
    <Box>
      <H2 id="s-hours">Opening hours</H2>
      {shop.hours.length > 0 && (
        <table aria-labelledby="s-hours" className="border-collapse text-size-15">
          <tbody>
            {WEEK.map(([weekday, name]) => {
              const hours = shop.hours.find((h) => h.weekday === weekday);
              const isToday = weekday === today;
              return (
                <tr key={weekday} className={cn(isToday && 'font-bold')}>
                  <th scope="row" className="py-[7px] pr-6 text-left font-[inherit]">{name}{isToday && ' (today)'}</th>
                  <td className="py-[7px]">{hours ? `${hours.open}–${hours.close}` : 'Closed'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {shop.closures.length > 0 && <p className="m-0 text-[14px]">{closuresText(shop.closures)}</p>}
    </Box>
  );
}

/**
 * A shop's page (wb-shop-page). With several shops: the path, "<business>,
 * <shop>", its details and Collect from here, which chooses it and says so
 * (wb-shop-collect). With one: Find us, the business's name over its address,
 * and no path or Collect from here (wb-find-us).
 */
function ShopView({ shop }: { shop: ShopEntry }) {
  const { address, site, chosen, several, choose } = useSiteContext();
  usePageTitle(several ? shop.name : 'Find us');
  const said = useRef<HTMLParagraphElement>(null);
  const details = hasDetails(shop) ? shop : null;
  const title = several ? shop.name : site.name;
  const collecting = several && chosen?.id === shop.id;
  const tall = 'inline-flex min-h-11 items-center text-[var(--wh-ink)]';
  const step = 'inline-flex min-h-11 items-center text-inherit';

  const collect = () => {
    flushSync(() => choose(shop.id));
    // The button it replaced is gone: focus goes to the sentence that says what happened.
    said.current?.focus();
  };

  return (
    <>
      {several && (
        <nav aria-label="You are here" className="text-[14px] text-[var(--wh-muted)]">
          <Link to="/shops" className={step} style={{ color: 'inherit' }}>Our shops</Link>
          {' › '}
          <span aria-current="page">{shop.name}</span>
        </nav>
      )}
      <H1>{several ? `${site.name}, ${shop.name}` : 'Find us'}</H1>
      {collecting && (
        <p ref={said} role="status" tabIndex={-1} className="m-0 flex items-center gap-2 rounded-lg bg-[var(--wh-ok-bg)] px-3 py-2.5 text-size-15 text-[var(--wh-state-ready-ink)] outline-none">
          <Check aria-hidden className="size-[18px] shrink-0" />
          <span>Collecting from {shop.name} — what you see now shows when it’s ready here.</span>
        </p>
      )}
      <Box className="md:max-w-[380px]">
        {(details?.address || details?.phone || details?.email || !several) && (
          <div className="flex flex-col gap-1 text-size-15 leading-normal">
            {several ? (
              details?.address && <strong className="whitespace-pre-line">{details.address}</strong>
            ) : (
              <>
                <strong>{site.name}</strong>
                {details?.address && <span className="whitespace-pre-line">{details.address}</span>}
              </>
            )}
            {details?.phone && <a href={`tel:${details.phone.replace(/\s+/g, '')}`} className={tall}>{details.phone}</a>}
            {details?.email && <a href={`mailto:${details.email}`} className={tall}>{details.email}</a>}
          </div>
        )}
        <div className="flex flex-wrap gap-2.5">
          <a href={bookPath(address, several ? shop.id : null)} className={linkButton('accent')}>Book a repair here</a>
          {details?.address && (
            <a href={directionsUrl(details.address)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${title} (opens your maps app)`} className={linkButton('default')}>
              Directions
            </a>
          )}
          {several && !collecting && <Button variant="default" className="min-h-11 text-size-15" onClick={collect}>Collect from here</Button>}
        </div>
      </Box>
      {details && (details.hours.length > 0 || details.closures.length > 0) && (
        <div className="grid items-start gap-6 md:grid-cols-2">
          <OpeningHours shop={details} />
        </div>
      )}
    </>
  );
}
