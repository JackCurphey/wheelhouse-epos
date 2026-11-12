import * as React from 'react';
import { Link } from 'react-router';
import { Check, Store } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { penceText } from '@/lib/money.ts';
import { bookPath } from './address.ts';
import { detailsLine } from './filters.ts';
import { hasDetails, useSiteContext, type Category, type FirstShop, type ProductCardData, type ShopEntry, type StockLine } from './site-query.ts';

/**
 * The pieces the website's pages share, as browse.mjs draws them: headings,
 * the box (card), buttons that are links, the product, category and shop
 * cards, and the stock line. Words and order follow the drawing; a piece the
 * shop has no data for is left out rather than drawn empty (task 3.5).
 */

/** The 44px-tall buttons the drawings use, as links. */
export const linkButton = (variant: 'accent' | 'default') => cn(buttonVariants({ variant }), 'min-h-11 text-size-15 no-underline');

export function H1({ children, id, tabIndex }: { children: React.ReactNode; id?: string; tabIndex?: number }) {
  return <h1 id={id} tabIndex={tabIndex} className="m-0 text-[24px] font-bold leading-tight outline-none md:text-size-30">{children}</h1>;
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="m-0 text-[20px] font-bold">{children}</h2>;
}

export function Box({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex shrink-0 flex-col gap-3.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-4 md:p-[22px]', className)}>
      {children}
    </div>
  );
}

/** A heading with an optional link beside it, then the section's content (browse.mjs `section`). */
export function Section({ title, id, more, children }: { title: string; id: string; more?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex shrink-0 flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <H2 id={id}>{title}</H2>
        {more}
      </div>
      {children}
    </section>
  );
}

export function MoreLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="inline-flex min-h-11 items-center text-size-15 font-semibold text-[var(--wh-ink)]">{children}</Link>;
}

/** A grid of cards: `cols` on a computer, two on a phone (browse.mjs `grid`). */
export function Grid({ cols, phoneCols = 2, children }: { cols: 2 | 3 | 4; phoneCols?: 1 | 2; children: React.ReactNode }) {
  const wide = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }[cols];
  return <div className={cn('grid gap-3 md:gap-[18px]', phoneCols === 1 ? 'grid-cols-1' : 'grid-cols-2', wide)}>{children}</div>;
}

/** A failed read: the server's own words, and a way to ask again (design 2). */
export function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-size-15">
      <span>Something went wrong — try again</span>
      <Button variant="default" className="min-h-11 text-size-15" onClick={onRetry}>Try again</Button>
    </div>
  );
}

/** The stock line for the chosen shop (Jack's answer 2: only what's on its shelf). */
export function StockLineView({ stock }: { stock: StockLine }) {
  if (stock.line === 'none') return null;
  const ready = stock.line === 'ready';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-size-15', ready ? 'text-[var(--wh-state-ready-ink)]' : 'text-[var(--wh-muted)]')}>
      {ready ? <Check aria-hidden className="size-3.5" /> : <Store aria-hidden className="size-3.5" />}
      {ready ? `Ready today at ${stock.shop}` : `Sold out at ${stock.shop}`}
    </span>
  );
}

export const priceText = (low: number, high: number | null) => (high != null ? `${penceText(low)} to ${penceText(high)}` : penceText(low));

/** A product's card (browse.mjs `productCard`): photo, or its name in a tile; name, price, stock line. */
/** A product's card; `withDetails` adds the category page's details line (wb-category; the home page's cards have none). */
export function ProductCard({ product, withDetails = false }: { product: ProductCardData; withDetails?: boolean }) {
  const line = withDetails ? detailsLine(product.details ?? []) : null;
  return (
    <Link to={`/products/${product.id}`} className="flex flex-col gap-2 text-[var(--wh-ink)] no-underline">
      {product.photo ? (
        <img src={product.photo} alt={`Photo of ${product.name}`} className="h-[120px] w-full rounded-[10px] object-cover md:h-[170px]" />
      ) : (
        <span aria-hidden className="flex h-[120px] w-full items-center justify-center rounded-[10px] bg-[var(--wh-surface-muted)] p-3 text-center text-size-15 font-semibold md:h-[170px]">{product.name}</span>
      )}
      <span className="text-size-15 font-semibold leading-snug">{product.name}</span>
      {line && <span className="text-size-13 text-[var(--wh-muted)]">{line}</span>}
      <span className="font-mono text-size-15 font-bold">{priceText(product.pricePence, product.priceHighPence)}</span>
      <StockLineView stock={product.stock} />
    </Link>
  );
}

/** The categories a customer can see: those with a product online. */
export const visible = (categories: Category[]) => categories.filter((c) => c.products > 0);
export const topCategories = (categories: Category[]) => visible(categories).filter((c) => c.parentId == null);

/** "[n] products", or a parent's first type and how many more ("Derailleurs and [n] more"). */
export function categoryLine(category: Category, categories: Category[]): string {
  const types = visible(categories).filter((c) => c.parentId === category.id);
  if (types.length === 0) return `${category.products} ${category.products === 1 ? 'product' : 'products'}`;
  return types.length === 1 ? types[0].name : `${types[0].name} and ${types.length - 1} more`;
}

/** A category's card (browse.mjs `catCard`); categories have no photo, so none is drawn. */
export function CategoryCard({ category, categories }: { category: Category; categories: Category[] }) {
  return (
    <Link to={`/shop/${category.id}`} className="flex flex-col gap-2 text-[var(--wh-ink)] no-underline">
      <span className="text-[16px] font-bold">{category.name}</span>
      <span className="text-size-13 text-[var(--wh-muted)]">{categoryLine(category, categories)}</span>
    </Link>
  );
}

const weekdayName = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** Today's hours, or when the shop next opens (design 9); nothing when no hours are set. */
export function TodayLine({ shop }: { shop: FirstShop }) {
  if (shop.today) {
    return <span className="text-size-15"><strong>Open today</strong> {shop.today.open}–{shop.today.close}</span>;
  }
  if (!shop.nextOpening) return null;
  return <span className="text-size-15"><strong>Closed today</strong> · opens {weekdayName(shop.nextOpening.date)} {shop.nextOpening.open}</span>;
}

/** Google Maps' public directions address: a link, not a map, so it sets no cookie here (written line 3). */
export const directionsUrl = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

/**
 * A shop's card (browse.mjs `shopCard`). The shared address, phone and hours
 * are on the first shop only (Jack's answer 1); another shop shows its name.
 * Shops have no photo of their own yet, so none is drawn. `title` is the
 * business's name with one shop (wb-home-one-shop), else the shop's.
 */
export function ShopCard({ shop, title, book = true, email = false }: { shop: ShopEntry; title: string; book?: boolean; email?: boolean }) {
  const { address, several } = useSiteContext();
  const details = hasDetails(shop) ? shop : null;
  const tall = 'inline-flex min-h-11 items-center text-size-15 text-[var(--wh-ink)]';
  return (
    <Box>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-[18px] font-bold">
          <Link to={`/shops/${shop.id}`} className={cn(tall, 'text-[18px]')}>{title}</Link>
        </h3>
        {details?.address && <span className="whitespace-pre-line text-size-15">{details.address}</span>}
        {details && <TodayLine shop={details} />}
        {details?.phone && <a href={`tel:${details.phone.replace(/\s+/g, '')}`} className={tall}>{details.phone}</a>}
        {email && details?.email && <a href={`mailto:${details.email}`} className={tall}>{details.email}</a>}
      </div>
      {(book || details?.address) && (
        <div className="flex flex-wrap gap-2.5">
          {book && <a href={bookPath(address, several ? shop.id : null)} className={linkButton('default')}>Book a repair here</a>}
          {details?.address && (
            <a href={directionsUrl(details.address)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${title} (opens your maps app)`} className={linkButton('default')}>
              Directions
            </a>
          )}
        </div>
      )}
    </Box>
  );
}

/** Every shop's card: "Our shops" with several, the one shop under the business's name with one. */
export function ShopCards({ email = false, book }: { email?: boolean; book?: boolean }) {
  const { site, several } = useSiteContext();
  if (!several) {
    return <div className="max-w-[560px]">{site.shops[0] && <ShopCard shop={site.shops[0]} title={site.name} book={book ?? false} email={email} />}</div>;
  }
  return (
    <Grid cols={2} phoneCols={1}>
      {site.shops.map((s) => <ShopCard key={s.id} shop={s} title={s.name} book={book ?? true} email={email} />)}
    </Grid>
  );
}
