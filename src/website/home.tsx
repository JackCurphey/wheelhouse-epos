import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { penceText } from '@/lib/money.ts';
import { bookPath } from './address.ts';
import { useCategories, useHome, useSiteContext } from './site-query.ts';
import { usePageTitle } from './pages.tsx';
import { Box, CategoryCard, Failed, Grid, H2, MoreLink, ProductCard, Section, ShopCards, linkButton, topCategories } from './parts.tsx';

/**
 * The home page (website-browse design 8; wb-home, wb-home-lower,
 * wb-home-one-shop, wb-first-visit in browse.mjs): the drawn sections in the
 * drawn order, each filled from the published parts. A section with nothing
 * in it is left out (spec: "An empty section is left out").
 */
export function HomePage() {
  usePageTitle(null);
  const { address, site, chosen, several } = useSiteContext();
  const categories = useCategories(address);
  const home = useHome(address, chosen?.id ?? null);
  const { parts } = site;
  const book = bookPath(address, several && chosen ? chosen.id : null);
  const cats = topCategories(categories.data ?? []).slice(0, 4);
  const featured = home.data?.featured ?? [];
  const repairs = home.data?.repairs ?? [];

  return (
    <>
      <section aria-labelledby="hero-h" className="relative shrink-0 overflow-hidden rounded-[14px]">
        {parts.bigPhoto && (
          <img src={parts.bigPhoto.url} alt={parts.bigPhoto.description} className="h-[260px] w-full rounded-[14px] object-cover md:h-[330px]" />
        )}
        <div className={cn(
          'flex max-w-[560px] flex-col items-start gap-3 rounded-xl bg-[var(--wh-panel)] px-5 py-[18px]',
          parts.bigPhoto ? 'absolute bottom-4 left-4 right-4 md:bottom-9 md:left-10' : 'border border-[var(--wh-border)]',
        )}>
          <h1 id="hero-h" className="m-0 text-[22px] font-bold leading-tight md:text-size-30">{parts.headline || site.name}</h1>
          {parts.aboutLine && <span className="text-[16px] leading-normal">{parts.aboutLine}</span>}
          <span className="flex flex-wrap gap-2.5">
            <a href={book} className={linkButton('accent')}>Book a repair</a>
            <Link to="/shop" className={linkButton('default')}>Shop</Link>
          </span>
        </div>
      </section>

      {categories.error && <Failed onRetry={() => { void categories.refetch(); }} />}
      {cats.length > 0 && (
        <Section title="Shop by category" id="h-cats" more={<MoreLink to="/shop">All categories</MoreLink>}>
          <Grid cols={4}>{cats.map((c) => <CategoryCard key={c.id} category={c} categories={categories.data ?? []} />)}</Grid>
        </Section>
      )}

      {home.error && <Failed onRetry={() => { void home.refetch(); }} />}
      {featured.length > 0 && (
        <Section title="Featured products" id="h-prods">
          <Grid cols={4}>{featured.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}</Grid>
        </Section>
      )}

      {(repairs.length > 0 || parts.workshopWords) && (
        <section aria-labelledby="h-rep">
          <Box>
            <div className="grid items-center gap-5 md:grid-cols-2">
              <div className="flex flex-col items-start gap-2.5">
                <H2 id="h-rep">Book a repair</H2>
                {parts.workshopWords && <p className="m-0 whitespace-pre-line text-size-15 leading-normal">{parts.workshopWords}</p>}
                <a href={book} className={linkButton('accent')}>Book a repair</a>
              </div>
              {repairs.length > 0 && (
                <ul className="m-0 flex list-none flex-col p-0">
                  {repairs.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3 border-t border-[var(--wh-border)] py-2.5 text-size-15">
                      <span>{s.name}</span>
                      {s.pricePence != null && <span className="font-mono">{penceText(s.pricePence)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Box>
        </section>
      )}

      {site.shops.length > 0 && (
        <Section title={several ? 'Our shops' : 'Find us'} id="h-shops" more={several ? <MoreLink to="/shops">All shops</MoreLink> : undefined}>
          <ShopCards />
        </Section>
      )}

      {(parts.shopWords || parts.shopPhoto) && (
        <section aria-labelledby="h-words">
          <Box>
            <div className={cn('grid items-center gap-5', parts.shopPhoto && 'md:grid-cols-[minmax(0,1fr)_360px]')}>
              <div className="flex flex-col gap-2.5">
                <H2 id="h-words">About us</H2>
                {parts.shopWords && <p className="m-0 whitespace-pre-line text-size-15 leading-relaxed">{parts.shopWords}</p>}
              </div>
              {parts.shopPhoto && <img src={parts.shopPhoto.url} alt={parts.shopPhoto.description} className="h-[200px] w-full rounded-[10px] object-cover" />}
            </div>
          </Box>
        </section>
      )}
    </>
  );
}
