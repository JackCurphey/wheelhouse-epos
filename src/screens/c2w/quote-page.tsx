import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { SavedNoteArea, useSavedNote } from '@/screens/settings/saved-note.tsx';
import { printPaperWhenLoaded } from '@/screens/till/receipt.tsx';
import { Back, Msg, Page, firstName, longDate, mono, note, orderHref, pounds, type C2wOrder } from './c2w-bits.tsx';

/**
 * The quote, to print or email (c2w.mjs quoteDoc; cw-quote, cw-quote-revised;
 * decision 6). The shop's own logo when it has one, else the drawn "LOGO"
 * placeholder: never a made-up mark. Print puts the quote on its own paper,
 * as receipts and bike tags print, once its logo has loaded (printPaperWhenLoaded). A revised quote's grey
 * message names what changed until it has been emailed (task 4.8).
 */
export type Quote = {
  shop: { name: string; address: string | null; phone: string | null; vatNumber: string | null; logoUrl: string | null };
  quoteRef: string; givenOn: string; revisedOn: string | null; validUntil: string; customerName: string; providerName: string;
  items: { productId: number; name: string; pricePence: number }[]; totalPence: number; closing: string; howToApply: string | null;
  revision?: { what: 'bike' | 'accessories' | 'provider'; on: string; sent: boolean } | null;
};
export const quoteKey = (id: number) => ['c2w-quote', id];
export const getQuote = (id: number) => apiGet<{ quote: Quote }>(`/api/c2w/orders/${id}/quote`);

/**
 * Email the quote, with the drawn note after: "Quote emailed to [email].", or
 * the server's words with Try again when trying again could work (set-save-failed).
 */
export function useEmailQuote(id: number) {
  const note = useSavedNote();
  const { show } = note;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  // One send at a time: a second tap, here or on the note's Try again, waits for the first.
  async function send() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const sent = await apiMutate<{ to: string }>(`/api/c2w/orders/${id}/email-quote`, {});
      show({ text: `Quote emailed to ${sent.to}.` });
      void queryClient.invalidateQueries({ queryKey: ['c2w-order', id] });
    } catch (err) {
      // Try again locks the note's button while it sends (Settings' note, `busy`).
      show(failedNote(err, () => { note.busy(); void send(); }));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return { send, busy };
}

/**
 * The note for an email that didn't go: a refusal shows the server's words; no
 * connection or a fault offers Try again (Settings' rule, 11 Nov entry 6).
 */
function failedNote(err: unknown, retry: () => void) {
  return serverSaid(err)
    ? { text: err.message, failed: true }
    : { text: 'Wheelhouse couldn’t send the quote.', failed: true, action: { label: 'Try again', run: retry } };
}

const cell = 'py-2';

/**
 * The quote itself, on the screen and on paper. On paper it's black on white
 * (theme.css #wh-print): no card, band or shadow, and every line in the
 * paper's own colour, as the receipt and bike tag are.
 */
export function QuoteDoc({ q, paper = false }: { q: Quote; paper?: boolean }) {
  const title = paper ? 'qd-title-paper' : 'qd-title';
  const muted = paper ? '' : 'text-[var(--wh-muted)]';
  const rule = paper ? 'border-current' : 'border-[var(--wh-border)]';
  return (
    <article aria-labelledby={title} className={paper
      ? 'box-border flex w-full max-w-[620px] flex-col gap-3.5 p-2 text-sm'
      : 'box-border flex w-full max-w-[620px] flex-col gap-3.5 rounded-md border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] text-sm text-[var(--wh-ink)] shadow-[var(--wh-shadow)] md:p-9'}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-[3px]">
          {q.shop.logoUrl
            ? <img src={q.shop.logoUrl} alt={`${q.shop.name} logo`} className="size-10 object-contain" />
            : <span title="No official logo file exists yet" aria-label="Shop logo goes here" className={`inline-flex size-10 items-center justify-center rounded-lg border border-dashed text-size-10 font-bold ${paper ? 'border-current' : 'border-[var(--wh-input-border)] text-[var(--wh-muted)]'}`}>LOGO</span>}
          <strong className="text-base">{q.shop.name}</strong>
          {q.shop.address || q.shop.phone ? <span>{[q.shop.address, q.shop.phone].filter(Boolean).join(' · ')}</span> : null}
          {q.shop.vatNumber ? <span>{`VAT ${q.shop.vatNumber}`}</span> : null}
        </div>
        <div className="flex flex-col gap-[3px] text-right">
          <h3 id={title} className="m-0 text-lg">Cycle to Work quote</h3>
          <span>Quote number <span className={`whitespace-nowrap ${mono}`}>{q.quoteRef}</span></span>
          <span>{q.revisedOn ? <strong>{`Revised ${longDate(q.revisedOn)}`}</strong> : `Given ${longDate(q.givenOn)}`}</span>
          <span><strong>{`Valid until ${longDate(q.validUntil)}`}</strong></span>
        </div>
      </div>
      <div className={paper ? 'py-1' : 'rounded-md bg-[var(--wh-bg)] px-3 py-2.5'}>For <strong>{q.customerName}</strong> · scheme provider <strong>{q.providerName}</strong></div>
      <table className="w-full border-collapse">
        <thead>
          <tr className={`text-left text-xs ${muted}`}><th className="py-1.5">Item</th><th className="py-1.5 text-right">Price</th></tr>
        </thead>
        <tbody>
          {q.items.map((it, i) => (
            <tr key={`${it.productId}-${i}`} className={`border-t ${rule}`}><td className={cell}>{it.name}</td><td className={`${cell} text-right ${mono}`}>{pounds(it.pricePence)}</td></tr>
          ))}
          <tr className={`border-t-2 ${paper ? 'border-current' : 'border-[var(--wh-ink)]'}`}><td className={`${cell} font-bold`}>Total (includes VAT)</td><td className={`${cell} text-right font-bold ${mono}`}>{pounds(q.totalPence)}</td></tr>
        </tbody>
      </table>
      <p className="m-0 leading-normal">{q.closing}</p>
      {q.howToApply ? <p className={`m-0 leading-normal ${muted}`}><strong className={paper ? '' : 'text-[var(--wh-ink)]'}>How to apply:</strong> {q.howToApply}</p> : null}
    </article>
  );
}

function QuoteBody() {
  const id = Number(useParams().id ?? '');
  const known = Number.isInteger(id);
  const quote = useQuery({ queryKey: quoteKey(id), queryFn: () => getQuote(id), retry: false, enabled: known });
  // The order says whether the customer has an email address to send to.
  const order = useQuery({ queryKey: ['c2w-order', id], queryFn: () => apiGet<{ order: C2wOrder }>(`/api/c2w/orders/${id}`), retry: false, enabled: known });
  const { send, busy } = useEmailQuote(id);
  const q = quote.data?.quote;

  if (quote.isError) return <Page><p role="alert" className="m-0 text-sm">{quote.error instanceof ApiError && quote.error.status === 404 ? 'Order not found' : 'Wheelhouse couldn’t load the quote. Try again in a moment.'}</p></Page>;
  if (!q) return <Page><p className={note}>Loading…</p></Page>;
  const name = firstName(q.customerName);
  return (
    <Page>
      <Back to={orderHref(id)}>{`${q.customerName} · Cycle to Work`}</Back>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="m-0 text-size-22 font-bold md:text-size-26">{q.revisedOn ? 'The revised quote' : 'The quote'}</h2>
        <span className="flex flex-wrap gap-2.5">
          <Button variant="default" onClick={() => void printPaperWhenLoaded(<QuoteDoc q={q} paper />)}>Print</Button>
          {order.data?.order.customerEmail
            ? <Button variant="accent" disabled={busy} onClick={() => void send()}>{q.revisedOn ? `Email the revised quote to ${name}` : `Email to ${name}`}</Button>
            : null}
        </span>
      </div>
      {q.revision && !q.revision.sent
        ? <Msg><strong>Revised quote.</strong>{` The ${q.revision.what} changed on ${longDate(q.revision.on)} — it’s in the order’s history. ${name} hasn’t been sent it yet.`}</Msg>
        : null}
      <div className="flex justify-center pt-1.5 pb-5"><QuoteDoc q={q} /></div>
    </Page>
  );
}

export function C2wQuotePage() {
  return <SavedNoteArea room="c2w-quote" className="flex w-full flex-col"><QuoteBody /></SavedNoteArea>;
}
