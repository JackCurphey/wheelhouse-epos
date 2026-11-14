import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Check, ChevronLeft, ChevronRight, CircleAlert, Minus, Plus, Store, X } from 'lucide-react';
import { ApiError } from '@/lib/api/client.ts';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { penceText } from '@/lib/money.ts';
import { AskTheShop, Crumbs } from './category.tsx';
import { NotFoundPage, usePageTitle } from './pages.tsx';
import { Button } from '@/components/ui/button';
import { MOST_LINES, MOST_OF_ONE, addTo, addedBy, readBasket } from './basket.ts';
import { Failed, H1, H2, priceText } from './parts.tsx';
import { useCategories, useProduct, useSiteContext, useTaking, type PageStock, type Product } from './site-query.ts';

/**
 * A product's page (website-browse tasks 5.1-5.7, design 3 and 7; wb-product,
 * wb-product-sizes, wb-product-size-other, wb-product-held and
 * wb-product-photos in browse.mjs): the photos, the path, the name and
 * price, the colour and size choosers with nothing chosen, the stock line at
 * the chosen shop, buying, About it and Specifications. Add to basket
 * (website-buy-online tasks 11.1-11.3; on-product-added, on-product-off,
 * on-product-no-shop) puts the product, or the chosen size, in the basket.
 */
export function ProductPage() {
  const { id: raw = '' } = useParams();
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
  const { address, chosen } = useSiteContext();
  const product = useProduct(address, id, chosen?.id ?? null);
  if (id === 0 || (product.error instanceof ApiError && product.error.status === 404)) return <NotFoundPage />;
  if (product.error) return <Failed onRetry={() => { void product.refetch(); }} />;
  if (!product.data) return null;
  return <ProductView key={product.data.id} product={product.data} />;
}

const OUT: PageStock['line'][] = ['elsewhere', 'sold-out'];
const radio = (on: boolean) => cn('inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--wh-panel)] px-3.5 text-[14px] font-semibold text-[var(--wh-ink)]', on ? 'border-2 border-[var(--wh-ink)]' : 'border border-[var(--wh-input-border)]');

function ProductView({ product }: { product: Product }) {
  usePageTitle(product.name);
  const { address, site, chosen, several, choose } = useSiteContext();
  const categories = useCategories(address);
  // Asked once: a shop not taking orders says so instead of Add to basket. Until it answers, or if it can't, Add to basket shows; checkout asks again.
  const taking = useTaking(address);
  const [colour, setColour] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const outId = useId();
  const hasColours = product.colours.length > 0;
  const hasSizes = product.sizes.length > 0;
  const sized = product.stock === null;
  // A colour and size the shop doesn't have together counts as sold out at the chosen shop.
  const missing: PageStock = chosen ? { line: 'sold-out', shop: chosen.name } : { line: 'none' };
  const itemOf = (c: string | null, s: string | null) => product.items.find((i) => (!hasColours || i.colour === c) && (!hasSizes || i.size === s));
  const picked = sized && (!hasColours || colour !== null) && (!hasSizes || size !== null);
  const item = picked ? itemOf(colour, size) : undefined;
  const stock: PageStock | null = !sized ? product.stock : picked ? (item?.stock ?? missing) : null;
  const sizeOut = (s: string) => sized && (!hasColours || colour !== null) && OUT.includes((itemOf(colour, s)?.stock ?? missing).line);
  const buy = stock === null || !OUT.includes(stock.line);
  const inColour = hasSizes && hasColours ? ` in ${colour}` : '';
  const specs = [
    ...(hasSizes ? [['Sizes', product.sizes.join(', ')]] : []),
    ...(hasColours ? [['Colours', product.colours.join(', ')]] : []),
    ...product.specifications.map((d) => [d.name, d.unit ? `${d.value} ${d.unit}` : String(d.value)]),
    ...(product.brand ? [['Brand', product.brand]] : []),
  ];

  const info = (
    <div className="flex min-w-0 flex-col gap-4">
      {product.category ? <Crumbs category={product.category} categories={categories.data ?? []} current={product.name} /> : null}
      <div className="flex flex-col gap-1.5">
        <H1>{product.name}</H1>
        <span className="font-mono text-[24px] font-bold">{item ? penceText(item.pricePence) : priceText(product.pricePence, product.priceHighPence)}</span>
        <span className="text-size-13 text-[var(--wh-muted)]">Includes VAT{product.brand ? ` · ${product.brand}` : ''}</span>
      </div>
      {hasColours && (
        <div role="radiogroup" aria-label="Colour" className="flex flex-col gap-2">
          <span className="text-size-15 font-bold">Colour: {colour ?? 'choose one'}</span>
          <div className="flex flex-wrap gap-2">
            {product.colours.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={c === colour} {...roving(product.colours, colour, setColour, i)} onClick={() => setColour(c)} className={radio(c === colour)}>
                <span aria-hidden className="size-[18px] rounded-full border border-dashed border-[var(--wh-input-border)] bg-[var(--wh-surface-muted)]" />
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {hasSizes && (
        <div role="radiogroup" aria-label="Size" className="flex flex-col gap-2">
          <span className="text-size-15 font-bold">Size: {size ?? 'choose one'}</span>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s, i) => {
              const out = sizeOut(s);
              const on = s === size;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-describedby={out && on ? outId : undefined}
                  {...roving(product.sizes, size, setSize, i)}
                  onClick={() => setSize(s)}
                  className={cn(radio(on), 'min-w-14 justify-center text-size-15', out && 'bg-[var(--wh-surface-muted)]', out && !on && 'border-[var(--wh-border)] text-[var(--wh-muted)] line-through')}
                >
                  {s}
                  {/* The space sits outside the hidden words, so every reader keeps it. */}
                  {out && <> <span className="sr-only">— not in stock at {chosen?.name}</span></>}
                </button>
              );
            })}
          </div>
          {size && sizeOut(size) && <span id={outId} className="text-size-13">{size} isn’t in stock at {chosen?.name}{inColour}.</span>}
        </div>
      )}
      {taking.data === false ? (
        // on-product-off: the line takes the stock line's place, and nothing can be added.
        <StockBox tone="grey"><strong>Not taking online orders right now.</strong> Ask in the shop, or call us, to buy this</StockBox>
      ) : stock === null ? (
        <StockBox tone="grey">Choose a {[hasColours && 'colour', hasSizes && 'size'].filter(Boolean).join(' and ')} to see when it’s ready</StockBox>
      ) : stock.line === 'ready' ? (
        <StockBox tone="ok"><strong>Ready today at {stock.shop}</strong> · {stock.qty} in stock</StockBox>
      ) : stock.line === 'sold-out' ? (
        <StockBox tone="grey"><strong>Sold out at {stock.shop}</strong></StockBox>
      ) : stock.line === 'none' && several ? (
        <StockBox tone="grey">Choose a shop to see when it’s ready</StockBox>
      ) : stock.line === 'elsewhere' ? (
        <>
          <StockBox tone="warn">
            <strong>{(hasSizes ? size : hasColours ? colour : 'It')} isn’t in stock at {stock.shop}</strong>{inColour} — it’s in stock at our {stock.at} shop
          </StockBox>
          {otherShop(site.shops, stock.at) && (
            <Button variant="default" className="min-h-11 self-start text-size-15" onClick={() => choose(otherShop(site.shops, stock.at)!.id)}>Collect from {stock.at} instead</Button>
          )}
        </>
      ) : null}
      {taking.data !== false && buy && <Buy name={product.name} productId={sized ? (item?.id ?? null) : product.id} />}
      <AskTheShop label="Ask the shop about this" />
    </div>
  );

  return (
    <>
      <div className="grid items-start gap-[22px] md:grid-cols-2 md:gap-10">
        <Photos photos={product.photos} name={product.name} />
        {info}
      </div>
      <div className="grid items-start gap-7 md:grid-cols-2">
        <section aria-labelledby={`${outId}-about`} className="flex flex-col gap-2.5">
          <H2 id={`${outId}-about`}>About it</H2>
          <p className="m-0 whitespace-pre-line text-size-15 leading-relaxed">{product.description}</p>
        </section>
        {specs.length > 0 && (
          <table className="w-full border-collapse text-size-15">
            <caption className="pb-2 text-left text-[17px] font-bold">Specifications</caption>
            <tbody>
              {specs.map(([k, v], i) => (
                <tr key={i}>
                  <th scope="row" className="w-[45%] border-t border-[var(--wh-border)] py-[9px] text-left font-normal text-[var(--wh-muted)]">{k}</th>
                  <td className="border-t border-[var(--wh-border)] py-[9px]">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/**
 * The keyboard of a radio group (WAI-ARIA radio group pattern): one tab stop,
 * the chosen radio or else the first; the arrow keys move to the next or
 * previous one and choose it, going round at the ends.
 */
function roving(values: string[], chosen: string | null, choose: (v: string) => void, i: number) {
  const stop = chosen === null ? i === 0 : values[i] === chosen;
  return {
    tabIndex: stop ? 0 : -1,
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const by = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (by === 0) return;
      e.preventDefault();
      const j = (i + by + values.length) % values.length;
      choose(values[j]);
      (e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[j])?.focus();
    },
  };
}

const otherShop = (shops: { id: number; name: string }[], name: string) => shops.find((s) => s.name === name);

/** The stock line's box (browse.mjs `readyBox`), read out as it changes. */
export function StockBox({ tone, children }: { tone: 'ok' | 'warn' | 'grey'; children: React.ReactNode }) {
  const Icon = tone === 'ok' ? Check : tone === 'warn' ? CircleAlert : Store;
  return (
    <p role="status" className={cn(
      'm-0 flex items-start gap-2 rounded-lg px-3 py-2.5 text-size-15',
      tone === 'ok' ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-state-ready-ink)]' : tone === 'warn' ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-ink)]',
    )}>
      <Icon aria-hidden className="mt-0.5 size-[18px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * How many, and Add to basket (browse.mjs `qty`; on-product-added): adds to
 * the basket, adding to the line already there, and says so with View
 * basket. `productId` is null until a size is chosen. With several shops and
 * none chosen, the box asks which first, then adds (on-choose-shop).
 */
function Buy({ name, productId }: { name: string; productId: number | null }) {
  const { setBasket, chosen, several, openChooser } = useSiteContext();
  const [qty, setQty] = useState(1);
  // What the last add did, for the product it was for (a size chosen since says nothing).
  const [added, setAdded] = useState<{ productId: number; n: number; full: boolean } | null>(null);
  // Read from the cookie at the moment of adding, so an add that waits for the
  // shop box adds to the basket as it is then (another tab may have changed it).
  const add = () => {
    if (productId === null) return;
    const before = readBasket();
    const after = addTo(before, productId, qty);
    if (after !== before) setBasket(after);
    setAdded({ productId, n: addedBy(before, after, productId), full: after === before && before.length >= MOST_LINES });
  };
  const said = added?.productId === productId ? added : null;
  const step = 'inline-flex size-11 items-center justify-center border-0 bg-[var(--wh-panel)] text-[var(--wh-ink)]';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={`Quantity of ${name}`} className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--wh-input-border)]">
          <button type="button" aria-label={`One fewer ${name}`} onClick={() => setQty((q) => Math.max(1, q - 1))} className={step}><Minus aria-hidden className="size-4" /></button>
          <span aria-live="polite" className="min-w-10 text-center text-[16px] font-bold">{qty}</span>
          <button type="button" aria-label={`One more ${name}`} onClick={() => setQty((q) => Math.min(99, q + 1))} className={step}><Plus aria-hidden className="size-4" /></button>
        </div>
        <Button
          variant="accent"
          className="min-h-11 text-size-15"
          disabled={productId === null}
          onClick={(e) => (several && !chosen ? openChooser(e.currentTarget, add) : add())}
        >
          Add to basket
        </Button>
      </div>
      <p role="status" className="m-0 text-size-15">
        {said && (said.n > 0
          ? <><span>Added {said.n} × {name}</span> <Link to="/basket" className="font-semibold text-[var(--wh-ink)]">View basket</Link></>
          : <span>{said.full ? `Your basket is full: it holds ${MOST_LINES} different things. Remove one to add this.` : `Your basket already has ${MOST_OF_ONE} of these, the most for one order.`}</span>)}
      </p>
    </div>
  );
}

/**
 * The photos (design 7): none, the name in a tile; one, that photo; more,
 * the larger photo with a row of them under it, and the viewer: "Photo 2 of
 * 4", moved by the arrows and the arrow keys, closed by Esc or Close, the
 * larger photo then showing the one last seen, with focus back on it.
 */
function Photos({ photos, name }: { photos: string[]; name: string }) {
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const big = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const n = photos.length;
  const wasOpen = useRef(false);
  // Once the viewer has gone (by any way), focus goes back to the larger photo.
  useEffect(() => {
    if (wasOpen.current && open === null) big.current?.focus();
    wasOpen.current = open !== null;
  }, [open]);
  const tall = 'h-[260px] w-full rounded-[10px] md:h-[380px]';
  if (n === 0) return <span aria-hidden data-name-tile className={cn(tall, 'flex items-center justify-center bg-[var(--wh-surface-muted)] p-3 text-center text-size-15 font-semibold')}>{name}</span>;
  if (n === 1) return <img src={photos[0]} alt={`Photo of ${name}`} className={cn(tall, 'object-cover')} />;
  const move = (by: number) => setOpen((i) => (i === null ? i : (i + by + n) % n));
  // The larger photo stays on the one last seen in the viewer.
  const close = () => { if (open !== null) setShown(open); setOpen(null); };
  return (
    <div className="flex flex-col gap-2.5">
      <button ref={big} type="button" aria-label={`Open larger photo ${shown + 1} of ${n}`} onClick={() => setOpen(shown)} className="block w-full cursor-zoom-in border-0 bg-transparent p-0">
        <img src={photos[shown]} alt={`Photo ${shown + 1} of ${n} — ${name}`} className={cn(tall, 'object-cover')} />
      </button>
      <div role="group" aria-label="Photos" className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <button
            key={url}
            type="button"
            aria-label={`Show photo ${i + 1} of ${n}`}
            aria-current={i === shown ? 'true' : undefined}
            onClick={() => setShown(i)}
            className={cn('size-16 overflow-hidden rounded-lg bg-[var(--wh-surface-muted)] p-0', i === shown ? 'border-2 border-[var(--wh-ink)]' : 'border border-[var(--wh-input-border)]')}
          >
            <img src={url} alt="" className="size-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && (
        <Dialog
          open
          onOpenChange={(o) => { if (!o) close(); }}
          aria-labelledby={titleId}
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') move(1);
            else if (e.key === 'ArrowLeft') move(-1);
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
          }}
          className="m-0 h-dvh max-h-none w-screen max-w-none rounded-none bg-[var(--wh-panel)] md:m-auto md:h-[640px] md:max-h-[90vh] md:w-[900px] md:max-w-[90vw] md:rounded-xl"
        >
          <div className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="m-0 text-[16px] font-bold">Photo {open + 1} of {n}</h2>
              <button type="button" aria-label="Close photos" onClick={close} className="inline-flex size-11 items-center justify-center border-0 bg-transparent text-[var(--wh-ink)]">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="flex min-h-0 grow items-center gap-3">
              <button type="button" aria-label="Previous photo" onClick={() => move(-1)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]">
                <ChevronLeft aria-hidden className="size-[18px]" />
              </button>
              <img src={photos[open]} alt={`Photo ${open + 1} of ${n} — ${name}`} className="h-full min-w-0 grow object-contain" />
              <button type="button" aria-label="Next photo" onClick={() => move(1)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--wh-input-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]">
                <ChevronRight aria-hidden className="size-[18px]" />
              </button>
            </div>
            <p className="m-0 text-size-13 text-[var(--wh-muted)]">Left and right arrows change photo · Esc closes</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
