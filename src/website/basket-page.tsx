import { useId, useState } from 'react';
import { Link } from 'react-router';
import { CircleAlert, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { penceText } from '@/lib/money.ts';
import { MOST_OF_ONE, type BasketLine } from './basket.ts';
import { usePageTitle } from './pages.tsx';
import { Box, Failed, H1, linkButton } from './parts.tsx';
import { StockBox } from './product.tsx';
import { useBasket, useSiteContext, type BasketAnswer, type BasketAnswerLine } from './site-query.ts';

/**
 * The basket (openspec/changes/website-buy-online, task 11.4; on-basket,
 * on-basket-changed and on-basket-empty in online.mjs): each line priced by
 * the server, its quantity and Remove (with Undo), Your order, and Go to
 * checkout. A changed basket says so above the lines and marks each one; a
 * line no longer in stock holds Go to checkout until it is removed.
 */
export function BasketPage() {
  usePageTitle('Your basket');
  const { address, chosen, basket, setBasket } = useSiteContext();
  const priced = useBasket(address, chosen?.id ?? null, basket);
  const [removed, setRemoved] = useState<{ line: BasketLine; at: number; name: string } | null>(null);

  const remove = (line: BasketAnswerLine) => {
    const at = basket.findIndex((l) => l.productId === line.productId);
    if (at < 0) return;
    setBasket(basket.filter((_, i) => i !== at));
    setRemoved({ line: basket[at], at, name: nameOf(line) });
  };
  const undo = () => {
    if (!removed) return;
    setBasket([...basket.slice(0, removed.at), removed.line, ...basket.slice(removed.at)]);
    setRemoved(null);
  };
  const setQty = (productId: number, qty: number) => setBasket(basket.map((l) => (l.productId === productId ? { productId, qty } : l)));

  return (
    <>
      <H1>Your basket</H1>
      <p role="status" className="m-0 text-size-15 empty:hidden">
        {removed && <><span>Removed {removed.name}.</span> <Button variant="ghost" className="min-h-11 text-size-15 underline" onClick={undo}>Undo</Button></>}
      </p>
      {basket.length === 0 ? (
        <Box className="max-w-[640px]">
          <p className="m-0 text-size-17">Your basket is empty.</p>
          <span><Link to="/shop" className={linkButton('default')}>Carry on shopping</Link></span>
        </Box>
      ) : priced.error && !priced.data ? (
        <Failed onRetry={() => { void priced.refetch(); }} />
      ) : priced.data ? (
        <Priced answer={priced.data} onQty={setQty} onRemove={remove} basket={basket} />
      ) : null}
    </>
  );
}

// A product the shop no longer sells has no name from the server (decided while building).
const nameOf = (line: BasketAnswerLine) => line.name ?? 'An item no longer sold';
const itemsText = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

function Priced({ answer, basket, onQty, onRemove }: { answer: BasketAnswer; basket: BasketLine[]; onQty: (productId: number, qty: number) => void; onRemove: (line: BasketAnswerLine) => void }) {
  const { setBasket, chosen, several, openChooser } = useSiteContext();
  const orderId = useId();
  const blockedId = useId();
  const [changedHead, ...changedRest] = (answer.changed ?? '').split('. ');
  // Going on takes what the server priced: a line cut to the stock left goes to checkout cut.
  const accept = () => {
    const priced = new Map(answer.lines.filter((l) => !l.gone).map((l) => [l.productId, l.qty]));
    setBasket(basket.filter((l) => priced.has(l.productId)).map((l) => ({ productId: l.productId, qty: priced.get(l.productId)! })));
  };
  return (
    <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:gap-8">
      <div className="flex flex-col gap-3.5">
        {answer.changed && (
          <p role="status" className="m-0 flex items-start gap-2 rounded-lg bg-[var(--wh-warn-bg)] px-3 py-2.5 text-size-15 text-[var(--wh-warn-ink)]">
            <CircleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0" />
            <span className="flex flex-col">
              <strong>{changedRest.length ? `${changedHead}.` : changedHead}</strong>
              {changedRest.length > 0 && <span>{changedRest.join('. ')}</span>}
            </span>
          </p>
        )}
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {answer.lines.map((line) => <Line key={line.productId} line={line} onQty={onQty} onRemove={onRemove} />)}
        </ul>
      </div>
      <section aria-labelledby={orderId}>
        <Box>
          <h2 id={orderId} className="m-0 text-[18px] font-bold">Your order</h2>
          <dl className="m-0 flex flex-col gap-2 text-size-15">
            <div className="flex justify-between gap-3"><dt>{itemsText(answer.count)}</dt><dd className="m-0 font-mono">{penceText(answer.totalPence)}</dd></div>
            {answer.shop ? (
              <div className="flex justify-between gap-3"><dt>Collect from {answer.shop.name}</dt><dd className="m-0">Free</dd></div>
            ) : several && !chosen ? (
              <div className="flex items-center justify-between gap-3">
                <dt>Collect from</dt>
                <dd className="m-0"><Button variant="default" className="min-h-11 text-size-15" onClick={(e) => openChooser(e.currentTarget)}>Choose a shop</Button></dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-[var(--wh-border)] pt-2 font-bold"><dt>Total (includes VAT)</dt><dd className="m-0 font-mono">{penceText(answer.totalPence)}</dd></div>
          </dl>
          {!answer.taking ? (
            <StockBox tone="grey"><strong>Not taking online orders right now.</strong> Ask in the shop, or call us, to buy this</StockBox>
          ) : answer.blocked ? (
            <>
              <Button variant="accent" aria-disabled="true" aria-describedby={blockedId} className="min-h-11 text-size-15 opacity-60" onClick={(e) => e.preventDefault()}>Go to checkout</Button>
              <p id={blockedId} className="m-0 text-size-13 text-[var(--wh-muted)]">{answer.blocked}</p>
            </>
          ) : (
            <Link to="/checkout" onClick={accept} className={linkButton('accent')}>Go to checkout</Link>
          )}
        </Box>
      </section>
    </div>
  );
}

const step = (held: boolean) => cn('inline-flex size-11 items-center justify-center border-0 bg-[var(--wh-panel)] text-[var(--wh-ink)]', held && 'text-[var(--wh-muted)] opacity-50');

function Line({ line, onQty, onRemove }: { line: BasketAnswerLine; onQty: (productId: number, qty: number) => void; onRemove: (line: BasketAnswerLine) => void }) {
  const name = nameOf(line);
  const stockLeft = line.stock?.line === 'ready' ? line.stock.qty : Infinity;
  const moreHeld = line.gone || line.qty >= stockLeft || line.qty >= MOST_OF_ONE;
  const fewerHeld = line.gone || line.qty <= 1;
  const details = [line.size, line.colour].filter(Boolean).join(' · ');
  return (
    <li className="flex gap-3.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-3.5 md:p-4">
      {line.photo
        ? <img src={line.photo} alt={`Photo of ${name}`} className="size-20 shrink-0 rounded-lg object-cover" />
        : <span aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-[var(--wh-surface-muted)] p-1 text-center text-size-13 font-semibold">{name}</span>}
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <h2 className="m-0 text-[16px] font-bold">{name}</h2>
        {line.code && <span className="font-mono text-size-13 text-[var(--wh-muted)]">{line.code}</span>}
        {details && <span className="text-size-13">{details}</span>}
        {line.note
          ? <span className="flex items-start gap-1.5 text-size-13 font-semibold text-[var(--wh-warn-ink)]"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{line.note}</span>
          : line.stock?.line === 'ready' && <span className="text-size-13 text-[var(--wh-state-ready-ink)]">Ready today at {line.stock.shop}</span>}
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={`Quantity of ${name}`} className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--wh-input-border)]">
            <button type="button" aria-label={`One fewer ${name}`} aria-disabled={fewerHeld || undefined} onClick={() => { if (!fewerHeld) onQty(line.productId, line.qty - 1); }} className={step(fewerHeld)}><Minus aria-hidden className="size-4" /></button>
            <span aria-live="polite" className="min-w-10 text-center text-[16px] font-bold">{line.qty}</span>
            <button type="button" aria-label={`One more ${name}`} aria-disabled={moreHeld || undefined} onClick={() => { if (!moreHeld) onQty(line.productId, line.qty + 1); }} className={step(moreHeld)}><Plus aria-hidden className="size-4" /></button>
          </div>
          <Button variant="ghost" aria-label={`Remove ${name}`} className="min-h-11 text-size-15 underline" onClick={() => onRemove(line)}>Remove</Button>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {line.pricePence !== null && <span className="text-size-13 text-[var(--wh-muted)]">{penceText(line.pricePence)} each</span>}
        {!line.gone && <span className="font-mono text-[16px] font-bold">{penceText(line.linePence)}</span>}
      </div>
    </li>
  );
}
