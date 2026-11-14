import { useEffect, useId, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client.ts';
import { penceText } from '@/lib/money.ts';
import { newRequestKey } from '@/screens/book/details-rules.ts';
import { EmptyBasket, nameOf } from './basket-page.tsx';
import { usePageTitle } from './pages.tsx';
import { Box, Failed, H1, todayText } from './parts.tsx';
import { StockBox } from './product.tsx';
import { askCheckout, hasDetails, useBasket, useSiteContext, type BasketAnswer } from './site-query.ts';

/**
 * Checkout, up to where paying starts (openspec/changes/website-buy-online,
 * tasks 12.1, 12.2 and 12.5; on-checkout, on-checkout-errors,
 * on-checkout-credit and on-checkout-covered in online.mjs): How you'll get
 * it, Your details (signed in, or boxes to fill), the store credit box, Your
 * order, and the Pay button with the terms. The wallets and the card form come
 * with paying (tasks 5.0b–e); until then the server answers 501 and its words
 * show beside the button. On a phone the order sits at the top and Pay stays
 * in a bar along the bottom (decision 10); on a computer the order and Pay sit
 * in a column on the right that stays in view.
 */
export function CheckoutPage() {
  usePageTitle('Checkout');
  const { address, chosen, basket } = useSiteContext();
  const priced = useBasket(address, chosen?.id ?? null, basket);
  return (
    <>
      <H1>Checkout</H1>
      {basket.length === 0 ? (
        <EmptyBasket />
      ) : priced.error && (!priced.data || priced.isPlaceholderData) ? (
        <Failed onRetry={() => { void priced.refetch(); }} />
      ) : priced.data?.changed ? (
        // What the customer pays for is what they saw: a changed basket is sorted on the basket page first.
        <Navigate to="/basket" replace />
      ) : priced.data ? (
        <Form answer={priced.data} refreshing={priced.isPlaceholderData || priced.isFetching} />
      ) : null}
    </>
  );
}

type Details = { name: string; phone: string; email: string };
type Fields = Partial<Record<keyof Details, string>>;
const SOMETHING_WRONG = 'Something went wrong — try again';

function Form({ answer, refreshing }: { answer: BasketAnswer; refreshing: boolean }) {
  const { address, chosen, several, openChooser, basket, site } = useSiteContext();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [typed, setTyped] = useState<Details>({ name: '', phone: '', email: '' });
  const [fields, setFields] = useState<Fields>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [useCredit, setUseCredit] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);
  // Pressing Pay again with the same details, basket and credit is the same request, so it keeps its key;
  // anything changed, or a refusal from the server, gets a new one.
  const keyFor = useRef<{ what: string; key: string } | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const orderId = useId();
  const payId = useId();

  const credit = answer.credit;
  const creditOn = !!credit && useCredit;
  const leftToPay = creditOn ? credit.leftToPayPence : answer.totalPence;
  const covered = creditOn && !!credit.coversAll;
  const label = covered ? 'Place order' : `Pay ${penceText(leftToPay)}`;
  // A signed-in customer's details come from their account; one it hasn't got is typed.
  const you = answer.you;
  const missing = (k: keyof Details) => !you || !you[k];

  const pay = useMutation({
    mutationFn: () => {
      const ask = {
        shop: chosen?.id ?? null,
        lines: basket,
        ...(missing('name') ? { name: typed.name } : {}),
        ...(missing('phone') ? { phone: typed.phone } : {}),
        ...(missing('email') ? { email: typed.email } : {}),
        useCredit: creditOn,
      };
      const what = JSON.stringify(ask);
      if (keyFor.current?.what !== what) keyFor.current = { what, key: newRequestKey() };
      return askCheckout(address, { ...ask, requestKey: keyFor.current.key });
    },
    onMutate: () => { setSaid(null); setSummary(null); setFields({}); },
    onError: (error) => {
      const body = error instanceof ApiError ? (error.body as { error?: string; fields?: Fields; basket?: BasketAnswer } | null) : null;
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) keyFor.current = null;
      if (error instanceof ApiError && error.status === 400 && body?.fields) {
        setFields(body.fields);
        setSummary(body.error ?? null);
      } else if (error instanceof ApiError && error.status === 409 && body?.basket) {
        // The basket changed: the basket page says how, from a fresh answer.
        void client.invalidateQueries({ queryKey: ['site', address.base, 'basket'] });
        navigate('/basket', { replace: true });
      } else {
        setSaid(error instanceof ApiError && error.hasServerMessage && body?.error ? body.error : SOMETHING_WRONG);
      }
    },
  });
  useEffect(() => { if (summary) summaryRef.current?.focus(); }, [summary]);
  // On a phone the page leaves room under its content for the pay bar, however tall the bar grows.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => setBarHeight(getComputedStyle(bar).position === 'fixed' ? bar.offsetHeight : 0));
    watch.observe(bar);
    return () => watch.disconnect();
  }, []);
  // ...and a box the keyboard moves to isn't left under it.
  const clearOfBar = (target: EventTarget) => {
    const bar = barRef.current;
    if (!barHeight || !bar || !(target instanceof HTMLElement) || bar.contains(target)) return;
    const over = target.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 16;
    if (over > 16) window.scrollBy(0, over);
  };
  const busy = pay.isPending || refreshing;

  const type = (k: keyof Details) => (value: string) => {
    setTyped((t) => ({ ...t, [k]: value }));
    setFields((f) => (f[k] ? { ...f, [k]: undefined } : f));
  };

  const shop = chosen && hasDetails(chosen) ? chosen : site.shops.find(hasDetails);
  const howSub = ['Free', shop && todayText(shop), shop?.address].filter(Boolean).join(' · ');

  const rows: [string, string, boolean?][] = [
    ...answer.lines.map((l): [string, string] => [l.qty > 1 ? `${nameOf(l)} × ${l.qty}` : nameOf(l), penceText(l.linePence)]),
    ...(answer.shop ? [[`Collect from ${answer.shop.name}`, 'Free'] as [string, string]] : []),
    ['Total (includes VAT)', penceText(answer.totalPence), true],
    ...(creditOn ? [['Store credit', `−${penceText(credit.usePence)}`], ['Left to pay', penceText(leftToPay), true]] as [string, string, boolean?][] : []),
  ];
  const terms = (
    <p className="m-0 text-size-13 leading-normal text-[var(--wh-muted)]">
      By paying you agree to our{' '}
      <button type="button" onClick={() => setTermsOpen(true)} className="border-0 bg-transparent p-0 text-[var(--wh-ink)] underline">terms</button>
      . You can cancel for a full refund until your order is ready.
    </p>
  );

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); if (!busy) pay.mutate(); }}
        onFocus={(e) => clearOfBar(e.target)}
        className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:gap-8"
        style={{ paddingBottom: barHeight || undefined }}
      >
        <div className="flex min-w-0 flex-col gap-5 md:col-start-1 md:row-start-1">
          <Part title="How you’ll get it">
            {several && !chosen ? (
              // No shop chosen yet: the same box the basket opens (decided while building).
              <p className="m-0 flex flex-wrap items-center gap-3 text-size-15">
                <span>Choose which shop to collect from.</span>
                <Button type="button" variant="default" className="min-h-11 text-size-15" onClick={(e) => openChooser(e.currentTarget)}>Choose a shop</Button>
              </p>
            ) : (
              <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
                <legend className="sr-only">How you’ll get it</legend>
                <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border-2 border-[var(--wh-ink)] bg-[var(--wh-panel)] p-3.5">
                  <input type="radio" name="how" defaultChecked className="mt-0.5 size-[22px] accent-[var(--wh-ink)]" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[16px] font-bold">Collect from {site.name}, {answer.shop?.name ?? shop?.name}</span>
                    <span className="text-size-14 leading-snug text-[var(--wh-muted)]">{howSub}</span>
                  </span>
                </label>
              </fieldset>
            )}
          </Part>

          <Part title="Your details">
            {summary && (
              <div ref={summaryRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-lg bg-[var(--wh-danger-bg)] px-3 py-2.5 text-size-15 font-semibold text-[var(--wh-danger)]">
                <CircleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0" /><span>{summary}</span>
              </div>
            )}
            {you && (
              <>
                <p className="m-0 text-size-15 leading-relaxed">
                  {you.name && <><strong>{you.name}</strong><br /></>}
                  {you.email}{you.email && you.phone && ' · '}{you.phone && <span className="font-mono">{you.phone}</span>}
                </p>
                <p className="m-0 text-size-14 text-[var(--wh-muted)]">
                  Signed in · <a href={`/book/${encodeURIComponent(address.slug)}/account`} className="text-[var(--wh-ink)]">Not you?</a> · <a href={`/book/${encodeURIComponent(address.slug)}/account`} className="text-[var(--wh-ink)]">Change</a>
                </p>
              </>
            )}
            {(missing('name') || missing('phone')) && (
              <div className="grid gap-3 md:grid-cols-2">
                {missing('name') && <TextField label="Name" autoComplete="name" value={typed.name} error={fields.name} onChange={type('name')} />}
                {missing('phone') && <TextField label="Phone" type="tel" autoComplete="tel" value={typed.phone} error={fields.phone} onChange={type('phone')} />}
              </div>
            )}
            {missing('email') && <TextField label="Email" type="email" autoComplete="email" value={typed.email} error={fields.email} hint="For your receipt and to tell you when it’s ready." onChange={type('email')} />}
            {!you && (
              <p className="m-0 text-size-14 text-[var(--wh-muted)]">
                Bought here before? <a href={`/book/${encodeURIComponent(address.slug)}/account`} className="text-[var(--wh-ink)]">Sign in</a> to fill this in.
              </p>
            )}
          </Part>

          {credit && (
            <section aria-labelledby={payId} className="flex flex-col gap-3">
              <h2 id={payId} className="m-0 text-[18px] font-bold">Pay</h2>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} className="mt-px size-[22px] accent-[var(--wh-ink)]" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-size-15 font-semibold">Use my store credit · <span className="font-mono">{penceText(credit.availablePence)}</span></span>
                  {!credit.coversAll && <span className="text-size-13 text-[var(--wh-muted)]">Ticked for you. The rest goes on your card.</span>}
                </span>
              </label>
              {covered && (
                <p className="m-0 flex items-start gap-2 rounded-lg bg-[var(--wh-ok-bg)] px-3 py-2.5 text-size-15 text-[var(--wh-state-ready-ink)]">
                  <Check aria-hidden className="mt-0.5 size-[18px] shrink-0" /><span>{credit.coversAll}</span>
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="order-first flex flex-col gap-3 md:sticky md:top-4 md:order-none md:col-start-2 md:row-start-1">
          <section aria-labelledby={orderId}>
            <Box>
              <h2 id={orderId} className="m-0 text-[18px] font-bold">Your order</h2>
              <dl className="m-0 flex flex-col gap-2 text-size-15">
                {rows.map(([what, amount, bold], i) => (
                  <div key={i} className={bold ? 'flex justify-between gap-3 border-t border-[var(--wh-border)] pt-2 font-bold' : 'flex justify-between gap-3'}>
                    <dt>{what}</dt><dd className="m-0 font-mono">{amount}</dd>
                  </div>
                ))}
              </dl>
              <div ref={barRef} data-pay-bar className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 pb-4 pt-3 md:static md:border-0 md:p-0">
                {!answer.taking ? (
                  <StockBox tone="grey"><strong>Not taking online orders right now.</strong> Ask in the shop, or call us, to buy this</StockBox>
                ) : (
                  <>
                    {said && <p role="alert" className="m-0 flex items-start gap-2 rounded-lg bg-[var(--wh-danger-bg)] px-3 py-2.5 text-size-15 font-semibold text-[var(--wh-danger)]"><CircleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0" />{said}</p>}
                    <Button type="submit" variant="accent" className="min-h-12 w-full text-size-15" disabled={busy}>{label}</Button>
                    {creditOn && <p className="m-0 text-size-13 text-[var(--wh-muted)]">Your store credit is only used once the order is paid.</p>}
                  </>
                )}
              </div>
              {terms}
            </Box>
          </section>
        </aside>
      </form>
      <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} text={site.parts.collectionReturns} />
    </>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="m-0 text-[18px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

type TextFieldProps = { label: string; value: string; error?: string; hint?: string; type?: string; autoComplete: string; onChange: (value: string) => void };

function TextField({ label, value, error, hint, type = 'text', autoComplete, onChange }: TextFieldProps) {
  const id = useId();
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <Field className="mb-0">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} autoComplete={autoComplete} value={value} aria-invalid={error ? true : undefined} aria-describedby={described} onChange={(e) => onChange(e.target.value)} />
      {hint && <p id={`${id}-hint`} className="m-0 text-size-13 text-[var(--wh-muted)]">{hint}</p>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

// The shop's Collection and returns words over checkout, as the booking site's terms open (spec, Checkout).
function TermsDialog({ open, onOpenChange, text }: { open: boolean; onOpenChange: (open: boolean) => void; text: string }) {
  const titleId = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={titleId}>
      <DialogHeader>
        <DialogTitle id={titleId}>Collection and returns</DialogTitle>
        <DialogClose onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <DialogBody>
        <p className="m-0 whitespace-pre-line text-size-15 leading-relaxed">{text || 'This shop hasn’t added its collection and returns details yet.'}</p>
      </DialogBody>
    </Dialog>
  );
}
