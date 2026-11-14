import { useId, useState } from 'react';
import { Link } from 'react-router';
import { CircleAlert, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { penceText } from '@/lib/money.ts';
import { MOST_OF_ONE, readBasket, type BasketLine } from './basket.ts';
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

  // Every change starts from the cookie as it is now, not as this page last
  // saw it: another tab may have changed it, or a tap may be waiting on its answer.
  const remove = (line: BasketAnswerLine) => {
    const now = readBasket();
    const at = now.findIndex((l) => l.productId === line.productId);
    if (at < 0) return;
    setBasket(now.filter((_, i) => i !== at));
    setRemoved({ line: now[at], at, name: nameOf(line) });
  };
  const undo = () => {
    if (!removed) return;
    const now = readBasket();
    if (!now.some((l) => l.productId === removed.line.productId)) setBasket([...now.slice(0, removed.at), removed.line, ...now.slice(removed.at)]);
    setRemoved(null);
  };
  const step = (productId: number, by: number, most: number) => {
    setBasket(readBasket().map((l) => (l.productId === productId ? { productId, qty: Math.max(1, Math.min(most, MOST_OF_ONE, l.qty + by)) } : l)));
  };

  return (
    <>
      <H1>Your basket</H1>
      <p role="status" className="m-0 text-size-15 empty:hidden">
        {removed && <><span>Removed {removed.name}.</span> <Button variant="ghost" className="min-h-11 text-size-15 underline" onClick={undo}>Undo</Button></>}
      </p>
      {basket.length === 0 ? (
        <EmptyBasket />
      ) : priced.error && (!priced.data || priced.isPlaceholderData) ? (
        <Failed onRetry={() => { void priced.refetch(); }} />
      ) : priced.data ? (
        <Priced answer={priced.data} onStep={step} onRemove={remove} />
      ) : null}
    </>
  );
}

/** on-basket-empty's box; checkout shows it too when there's nothing to check out. */
export function EmptyBasket() {
  return (
    <Box className="max-w-[640px]">
      <p className="m-0 text-size-17">Your basket is empty.</p>
      <span><Link to="/shop" className={linkButton('default')}>Carry on shopping</Link></span>
    </Box>
  );
}

// A product the shop no longer sells has no name from the server (decided while building).
const nameOf = (line: BasketAnswerLine) => line.name ?? 'An item no longer sold';
const itemsText = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

type Step = (productId: number, by: number, most: number) => void;

function Priced({ answer, onStep, onRemove }: { answer: BasketAnswer; onStep: Step; onRemove: (line: BasketAnswerLine) => void }) {
  const { setBasket, chosen, several, openChooser } = useSiteContext();
  const orderId = useId();
  const blockedId = useId();
  const [changedHead, ...changedRest] = (answer.changed ?? '').split('. ');
  // Going on takes what the server cut: a line cut to the stock left goes to
  // checkout cut. Anything else stays as the cookie has it now, which may be
  // newer than the answer on screen (a tap still waiting on its answer).
  const accept = () => {
    const gone = new Set(answer.lines.filter((l) => l.gone).map((l) => l.productId));
    const cut = new Map(answer.lines.filter((l) => l.note && !l.gone).map((l) => [l.productId, l.qty]));
    setBasket(readBasket().filter((l) => !gone.has(l.productId)).map((l) => ({ productId: l.productId, qty: Math.min(l.qty, cut.get(l.productId) ?? l.qty) })));
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
          {answer.lines.map((line) => <Line key={line.productId} line={line} onStep={onStep} onRemove={onRemove} />)}
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

function Line({ line, onStep, onRemove }: { line: BasketAnswerLine; onStep: Step; onRemove: (line: BasketAnswerLine) => void }) {
  const name = nameOf(line);
  const stockLeft = line.stock?.line === 'ready' ? line.stock.qty : Infinity;
  const moreHeld = line.gone || line.qty >= stockLeft || line.qty >= MOST_OF_ONE;
  const fewerHeld = line.gone || line.qty <= 1;
  const details = [line.size, line.colour].filter(Boolean).join(' · ');
  return (
    <li className="flex gap-3.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-3.5 md:p-4">
      {line.photo
        ? <img src={line.photo} alt={`Photo of ${name}`} className="size-20 shrink-0 rounded-lg object-cover" />
        : <span role="img" aria-label={`Photo of ${name}`} className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-[var(--wh-surface-muted)] p-1 text-center text-size-13 font-semibold">{name}</span>}
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <h2 className="m-0 text-[16px] font-bold">{name}</h2>
        {line.code && <span className="font-mono text-size-13 text-[var(--wh-muted)]">{line.code}</span>}
        {details && <span className="text-size-13">{details}</span>}
        {line.note
          ? <span className="flex items-start gap-1.5 text-size-13 font-semibold text-[var(--wh-warn-ink)]"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{line.note}</span>
          : line.stock?.line === 'ready' && <span className="text-size-13 text-[var(--wh-state-ready-ink)]">Ready today at {line.stock.shop}</span>}
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={`Quantity of ${name}`} className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--wh-input-border)]">
            <button type="button" aria-label={`One fewer ${name}`} aria-disabled={fewerHeld || undefined} onClick={() => { if (!fewerHeld) onStep(line.productId, -1, stockLeft); }} className={step(fewerHeld)}><Minus aria-hidden className="size-4" /></button>
            <span aria-live="polite" className="min-w-10 text-center text-[16px] font-bold">{line.qty}</span>
            <button type="button" aria-label={`One more ${name}`} aria-disabled={moreHeld || undefined} onClick={() => { if (!moreHeld) onStep(line.productId, 1, stockLeft); }} className={step(moreHeld)}><Plus aria-hidden className="size-4" /></button>
          </div>
          <Button variant="ghost" aria-label={`Remove ${name}`} className="min-h-11 text-size-15 underline" onClick={() => onRemove(line)}>Remove</Button>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {/* basketLine: more than one shows the line's total, the price each beneath; one shows its price. */}
        {line.qty > 1 && !line.gone ? (
          <>
            <span className="font-mono text-[16px] font-bold">{penceText(line.linePence)}</span>
            <span className="text-size-13 text-[var(--wh-muted)]">{penceText(line.pricePence!)} each</span>
          </>
        ) : line.pricePence !== null && <span className="font-mono text-[16px] font-bold">{penceText(line.pricePence)}</span>}
      </div>
    </li>
  );
}
