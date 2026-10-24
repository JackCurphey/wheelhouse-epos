import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { refusalText } from './refusal-words.ts';
import { Button } from '@/components/ui/button.tsx';
import { ItemSearch } from './item-search.tsx';
import { QuotePanel } from './quote-panel.tsx';
import type { WorkshopJob } from '@/lib/api/types.ts';

/**
 * A job's work and parts (journey 12; decision 46: labour above parts), on
 * the job's order. The server takes the whole list back each time
 * (PUT /api/sale-documents/:id/items), so every change sends every line.
 * Add item searches the shop's services and products; a scanner types a
 * barcode and Enter, which adds that product straight away.
 * Spec: docs/superpowers/specs/2026-10-03-staff-job-page-design.md (piece 3)
 *
 * Each line has a Done tick and a staff note (Jack, 24 Oct,
 * docs/decisions/2026-10-24-line-notes.md; job-page.mjs's Done and Note
 * columns; openspec/changes/line-done-notes), saved one line at a time and
 * kept through a save of the whole list by each line's id. Like the
 * checklist: anyone signed in, the latest change wins, "+ Add note", and
 * neither changes once the work is finished.
 *
 * Not here yet: the customer's approval per line (the quote stage).
 */

type Line = {
  id: number; productId: number | null; name: string; sku: string | null; unitPrice: number; qty: number;
  lineTotal: number; lineType: string | null; serviceId: number | null; minutes: number | null;
  done?: boolean; note?: string | null;
};
type Order = { id: number; status: string; total: number; items: Line[] };

const money = (n: number) => `£${Number(n).toFixed(2)}`;
const isLabour = (l: Line) => l.lineType === 'labour';

/** A line as the server takes it back, with its id so its Done tick and note stay. */
function asInput(l: Line) {
  if (isLabour(l)) {
    const out: Record<string, unknown> = { id: l.id, lineType: 'labour', name: l.name, unitPrice: l.unitPrice };
    if (l.minutes) out.minutes = l.minutes;
    if (l.serviceId) out.serviceId = l.serviceId;
    return out;
  }
  return { id: l.id, productId: l.productId, qty: l.qty, unitPrice: l.unitPrice };
}

export function WorkParts({ orderId, job }: { orderId: number; job?: WorkshopJob }) {
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ['sale-document', orderId], queryFn: () => apiGet<Order>(`/api/sale-documents/${orderId}`) });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<number, string>>({});
  // Lines whose note box "+ Add note" opened, and notes being typed.
  const [noting, setNoting] = useState<Set<number>>(new Set());
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});


  const lines = order.data?.items ?? [];
  const editable = order.data?.status === 'open';
  // Done and notes stop with the work, until it's reopened (as the checklist).
  const finished = job?.workState === 'complete';
  const marking = editable && !finished;
  // Decision 46: labour first, then parts.
  const sorted = [...lines].sort((a, b) => Number(isLabour(b)) - Number(isLabour(a)));

  async function save(items: Record<string, unknown>[]) {
    setSaving(true);
    setError(null);
    try {
      await apiMutate(`/api/sale-documents/${orderId}/items`, { items }, { method: 'PUT' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sale-document', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['workshop-jobs'] }),
        // The quote's whole bill counts this order: the limit check follows it (fresh review).
        queryClient.invalidateQueries({ queryKey: ['quote'] }),
      ]);
      return true;
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "This job's order no longer exists." : refusalText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  // One line's Done tick or note; no totals change.
  async function progress(line: Line, body: { done?: boolean; note?: string }) {
    setSaving(true);
    setError(null);
    try {
      await apiMutate(`/api/sale-documents/${orderId}/items/${line.id}/progress`, body, { method: 'PUT' });
      await queryClient.invalidateQueries({ queryKey: ['sale-document', orderId] });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "This job's order no longer exists." : refusalText(err));
    } finally {
      setSaving(false);
    }
  }

  // Leaving the note box saves what changed.
  function leaveNote(line: Line) {
    const draft = noteDraft[line.id];
    setNoteDraft((d) => {
      const next = { ...d };
      delete next[line.id];
      return next;
    });
    setNoting((n) => {
      const next = new Set(n);
      next.delete(line.id);
      return next;
    });
    if (draft === undefined || draft.trim() === (line.note ?? '')) return;
    void progress(line, { note: draft });
  }

  async function add(input: Record<string, unknown>) {
    if (await save([...sorted.map(asInput), input])) setAdding(false);
  }

  function commitQty(line: Line) {
    const raw = qtyDraft[line.id];
    if (raw === undefined) return;
    const qty = Math.trunc(Number(raw));
    setQtyDraft((d) => {
      const next = { ...d };
      delete next[line.id];
      return next;
    });
    if (!Number.isFinite(qty) || qty <= 0 || qty === line.qty) return;
    void save(sorted.map((l) => (l.id === line.id ? { ...asInput(l), qty } : asInput(l))));
  }

  return (
    <div className="flex flex-col gap-2">
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>Add item</Button>
        </div>
      ) : null}
      {adding ? (
        <ItemSearch
          id="wp-search"
          disabled={saving}
          onPick={(p) => add(p.type === 'service'
            ? { lineType: 'labour', serviceId: p.service.id }
            : { productId: p.product.id, qty: 1, unitPrice: p.product.price })}
        />
      ) : null}
      {error ? <p role="alert" className="m-0 rounded-md bg-[var(--wh-danger-bg)] px-3 py-2 text-sm text-[var(--wh-danger-hover)]">{error}</p> : null}
      {order.data ? (
        <div className="overflow-x-auto rounded-md border border-[var(--wh-border)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--wh-surface-muted)] text-left text-xs text-[var(--wh-muted)]">
                <th scope="col" className="px-3 py-2 font-semibold">Work or part</th>
                <th scope="col" className="px-1 py-2 text-center font-semibold">Done</th>
                <th scope="col" className="px-3 py-2 font-semibold">Note</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Qty</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Price</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
                {editable ? <th scope="col" className="px-3 py-2"><span className="sr-only">Remove</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id} className="border-t border-[var(--wh-border)]">
                  <td className="px-3 py-2">{l.name}</td>
                  {/* A 44px-wide hit area round the box (decision 55; job-page.mjs:276). */}
                  <td className="px-0 py-0 text-center">
                    <label className="inline-flex min-h-9 w-11 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox" aria-label={`${l.name} done`} checked={l.done === true}
                        disabled={!marking || saving}
                        onChange={(e) => void progress(l, { done: e.target.checked })}
                        className="size-5 accent-[var(--accent-dark)]"
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    {noting.has(l.id) ? (
                      <textarea
                        id={`line-note-${l.id}`} aria-label={`Note for ${l.name}`} rows={2} maxLength={500}
                        value={noteDraft[l.id] ?? l.note ?? ''}
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                        onBlur={() => leaveNote(l)}
                        className="w-full min-w-40 resize-y rounded-md border border-[var(--wh-border)] bg-[var(--wh-surface-muted)] px-2.5 py-2 text-sm leading-normal"
                      />
                    ) : l.note ? (
                      marking ? (
                        <button
                          type="button" aria-label={`Change the note for ${l.name}`}
                          onClick={() => { setNoting(new Set(noting).add(l.id)); setTimeout(() => document.getElementById(`line-note-${l.id}`)?.focus(), 0); }}
                          className="text-left text-[var(--wh-muted)] hover:underline"
                        >{l.note}</button>
                      ) : <span className="text-[var(--wh-muted)]">{l.note}</span>
                    ) : marking ? (
                      <button
                        type="button" aria-label={`Add a note for ${l.name}`}
                        onClick={() => { setNoting(new Set(noting).add(l.id)); setTimeout(() => document.getElementById(`line-note-${l.id}`)?.focus(), 0); }}
                        className="min-h-9 px-0 text-sm font-semibold"
                      >+ Add note</button>
                    ) : <span className="text-[var(--wh-muted)]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {editable && !isLabour(l) ? (
                      <input
                        type="number"
                        min={1}
                        aria-label={`Quantity of ${l.name}`}
                        value={qtyDraft[l.id] ?? String(l.qty)}
                        onChange={(e) => setQtyDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                        onBlur={() => commitQty(l)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitQty(l); }}
                        className="min-h-9 w-16 rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-2 text-right"
                      />
                    ) : l.qty}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(l.unitPrice)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(l.lineTotal)}</td>
                  {editable ? (
                    <td className="px-1 py-1 text-right">
                      <Button size="sm" variant="ghost" disabled={saving} aria-label={`Remove ${l.name}`} onClick={() => save(sorted.filter((x) => x.id !== l.id).map(asInput))}>Remove</Button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr><td colSpan={editable ? 7 : 6} className="px-3 py-2 text-[var(--wh-muted)]">Nothing added yet.</td></tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--wh-border)] font-bold">
                <td colSpan={5} className="px-3 py-2 text-right">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(order.data.total)}</td>
                {editable ? <td /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
      {order.data && editable && finished ? <p className="m-0 text-size-13 text-[var(--wh-muted)]">Reopen the work to change its Done ticks and notes.</p> : null}
      {order.data && !editable ? <p className="m-0 text-size-13 text-[var(--wh-muted)]">This job&apos;s order is closed, so its work and parts can&apos;t be changed here.</p> : null}
      {job && order.data && editable ? <QuotePanel job={job} orderTotal={Number(order.data.total)} /> : null}
    </div>
  );
}
