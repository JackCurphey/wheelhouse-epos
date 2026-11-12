import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { SavedNoteArea, useSavedNote } from '@/screens/settings/saved-note.tsx';
import { Back, Page, firstName, longDate, mono, note, orderHref, pounds } from './c2w-bits.tsx';

/**
 * The quote, to print or email (c2w.mjs quoteDoc; cw-quote, cw-quote-revised;
 * decision 6). The shop's own logo when it has one, else the drawn "LOGO"
 * placeholder: never a made-up mark. The revised quote's grey message, which
 * names what changed, comes with the change steps (logged).
 */
type Quote = {
  shop: { name: string; address: string | null; phone: string | null; vatNumber: string | null; logoUrl: string | null };
  quoteRef: string; givenOn: string; revisedOn: string | null; validUntil: string; customerName: string; providerName: string;
  items: { productId: number; name: string; pricePence: number }[]; totalPence: number; closing: string; howToApply: string | null;
};

/** Email the quote, with the drawn note after: "Quote emailed to [email]." or the server's words. */
export function useEmailQuote(id: number) {
  const { show } = useSavedNote();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function send(to: string | null) {
    setBusy(true);
    try {
      const sent = await apiMutate<{ to: string }>(`/api/c2w/orders/${id}/email-quote`, {});
      show({ text: `Quote emailed to ${sent.to ?? to}.` });
      void queryClient.invalidateQueries({ queryKey: ['c2w-order', id] });
    } catch (err) {
      show({ text: serverSaid(err) ? err.message : 'Wheelhouse couldn’t send the quote. Try again in a moment.', failed: true });
    } finally {
      setBusy(false);
    }
  }
  return { send, busy };
}

const cell = 'py-2';

function QuoteBody() {
  const id = Number(useParams().id ?? '');
  const location = useLocation();
  const quote = useQuery({ queryKey: ['c2w-quote', id], queryFn: () => apiGet<{ quote: Quote }>(`/api/c2w/orders/${id}/quote`), retry: false, enabled: Number.isInteger(id) });
  const { send, busy } = useEmailQuote(id);
  const printed = useRef(false);
  const q = quote.data?.quote;
  // "Print the quote" on the order opens the quote and prints it once.
  useEffect(() => {
    if (q && (location.state as { print?: boolean } | null)?.print && !printed.current) { printed.current = true; window.print(); }
  }, [q, location.state]);

  if (quote.isError) return <Page><p role="alert" className="m-0 text-sm">{quote.error instanceof ApiError && quote.error.status === 404 ? 'Order not found' : 'Wheelhouse couldn’t load the quote. Try again in a moment.'}</p></Page>;
  if (!q) return <Page><p className={note}>Loading…</p></Page>;
  const name = firstName(q.customerName);
  return (
    <Page>
      <Back to={orderHref(id)}>{`${q.customerName} · Cycle to Work`}</Back>
      <div className="flex flex-wrap items-center justify-between gap-2.5 print:hidden">
        <h2 className="m-0 text-size-22 font-bold md:text-size-26">{q.revisedOn ? 'The revised quote' : 'The quote'}</h2>
        <span className="flex flex-wrap gap-2.5">
          <Button variant="default" onClick={() => window.print()}>Print</Button>
          <Button variant="accent" disabled={busy} onClick={() => void send(null)}>{q.revisedOn ? `Email the revised quote to ${name}` : `Email to ${name}`}</Button>
        </span>
      </div>
      <div className="flex justify-center pt-1.5 pb-5">
        <article aria-labelledby="qd-title" className="box-border flex w-full max-w-[620px] flex-col gap-3.5 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] text-sm text-[var(--wh-ink)] shadow-[var(--wh-shadow)] md:p-9">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-[3px]">
              {q.shop.logoUrl
                ? <img src={q.shop.logoUrl} alt={`${q.shop.name} logo`} className="size-10 object-contain" />
                : <span title="No official logo file exists yet" aria-label="Shop logo goes here" className="inline-flex size-10 items-center justify-center rounded-lg border border-dashed border-[var(--wh-input-border)] text-size-10 font-bold text-[var(--wh-muted)]">LOGO</span>}
              <strong className="text-base">{q.shop.name}</strong>
              {q.shop.address || q.shop.phone ? <span>{[q.shop.address, q.shop.phone].filter(Boolean).join(' · ')}</span> : null}
              {q.shop.vatNumber ? <span>{`VAT ${q.shop.vatNumber}`}</span> : null}
            </div>
            <div className="flex flex-col gap-[3px] text-right">
              <h3 id="qd-title" className="m-0 text-lg">Cycle to Work quote</h3>
              <span>Quote number <span className={`whitespace-nowrap ${mono}`}>{q.quoteRef}</span></span>
              <span>{q.revisedOn ? <strong>{`Revised ${longDate(q.revisedOn)}`}</strong> : `Given ${longDate(q.givenOn)}`}</span>
              <span><strong>{`Valid until ${longDate(q.validUntil)}`}</strong></span>
            </div>
          </div>
          <div className="rounded-md bg-[var(--wh-bg)] px-3 py-2.5">For <strong>{q.customerName}</strong> · scheme provider <strong>{q.providerName}</strong></div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs text-[var(--wh-muted)]"><th className="py-1.5">Item</th><th className="py-1.5 text-right">Price</th></tr>
            </thead>
            <tbody>
              {q.items.map((it, i) => (
                <tr key={`${it.productId}-${i}`} className="border-t border-[var(--wh-border)]"><td className={cell}>{it.name}</td><td className={`${cell} text-right ${mono}`}>{pounds(it.pricePence)}</td></tr>
              ))}
              <tr className="border-t-2 border-[var(--wh-ink)]"><td className={`${cell} font-bold`}>Total (includes VAT)</td><td className={`${cell} text-right font-bold ${mono}`}>{pounds(q.totalPence)}</td></tr>
            </tbody>
          </table>
          <p className="m-0 leading-normal">{q.closing}</p>
          {q.howToApply ? <p className="m-0 leading-normal text-[var(--wh-muted)]"><strong className="text-[var(--wh-ink)]">How to apply:</strong> {q.howToApply}</p> : null}
        </article>
      </div>
    </Page>
  );
}

export function C2wQuotePage() {
  return <SavedNoteArea room="c2w-quote" className="flex w-full flex-col"><QuoteBody /></SavedNoteArea>;
}
