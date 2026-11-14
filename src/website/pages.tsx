import { useEffect, useId } from 'react';
import { Link } from 'react-router';
import { useCategories, useSiteContext } from './site-query.ts';
import { Box, CategoryCard, Failed, Grid, H1, ShopCards, linkButton, topCategories } from './parts.tsx';

/**
 * The website's pages other than home (website-browse tasks 3.6-3.9): Shop
 * (wb-shop), not found (wb-not-found) and the footer pages. (The basket is
 * basket-page.tsx.) Each is an h1 and its content in the shell, the pattern the drawings use for every page.
 */

/** "<page> · <shop>", or the shop's name alone on the home page. */
export function usePageTitle(page: string | null) {
  const { site } = useSiteContext();
  useEffect(() => {
    document.title = page ? `${page} · ${site.name}` : site.name;
  }, [page, site.name]);
}

const words = 'm-0 whitespace-pre-line text-size-15 leading-relaxed';

/** wb-shop: every top category, each card naming what's beneath it. */
export function ShopPage() {
  usePageTitle('Shop');
  const { address } = useSiteContext();
  const categories = useCategories(address);
  const all = categories.data ?? [];
  const top = topCategories(all);
  return (
    <>
      <H1>Shop</H1>
      {categories.error && <Failed onRetry={() => { void categories.refetch(); }} />}
      {categories.data && top.length === 0 && <p className={words}>This shop hasn’t put any products online yet.</p>}
      {top.length > 0 && <Grid cols={4}>{top.map((c) => <CategoryCard key={c.id} category={c} categories={all} />)}</Grid>}
    </>
  );
}

/** wb-not-found: an address that matches no page. */
export function NotFoundPage() {
  usePageTitle('We can’t find that page');
  const { several } = useSiteContext();
  const id = useId();
  return (
    <div className="flex max-w-[640px] flex-col gap-4 pt-10">
      <H1>We can’t find that page</H1>
      <p className="m-0 text-[16px] leading-relaxed">It may have moved, or the link may be wrong.</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-size-15 font-semibold">Search for a page or product</label>
        <input id={id} type="search" placeholder="What are you looking for?" className="min-h-11 rounded-lg border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-size-15" />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link to="/" className={linkButton('accent')}>Go to the home page</Link>
        <Link to="/shops" className={linkButton('default')}>{several ? 'Our shops' : 'Find us'}</Link>
      </div>
    </div>
  );
}

/** A footer page of the shop's own words, or a line saying there are none yet. */
function WordsPage({ title, text, none }: { title: string; text: string; none: string }) {
  usePageTitle(title);
  return (
    <>
      <H1>{title}</H1>
      <Box className="max-w-[760px]">
        <p className={words}>{text || none}</p>
      </Box>
    </>
  );
}

export function CollectionReturnsPage() {
  const { site } = useSiteContext();
  return <WordsPage title="Collection and returns" text={site.parts.collectionReturns} none="This shop hasn’t added its collection and returns details yet." />;
}

export function PrivacyPage() {
  const { site } = useSiteContext();
  return <WordsPage title="Privacy" text={site.parts.privacy} none="This shop hasn’t added a privacy notice yet." />;
}

/** Contact us: each shop's card with its email (not-drawn row 79, design 9). */
export function ContactPage() {
  usePageTitle('Contact us');
  return (
    <>
      <H1>Contact us</H1>
      <ShopCards email book={false} />
    </>
  );
}
