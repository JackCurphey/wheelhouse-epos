import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiMutate, serverSaid } from '@/lib/api/client.ts';
import { clock, londonDay, when } from '@/screens/diary/when.ts';

/**
 * Pieces shared by Front desk › Online orders and one order's page
 * (openspec/changes/website-buy-online group 8; online.mjs on-orders and
 * on-order-staff), in the shapes `server/online-orders/orders.js` sends.
 */
export type Stage = 'to_get_ready' | 'ready' | 'collected';
export type Item = { productId: number; name: string; qty: number; where: string | null; notOnShelf: boolean };
export type OrderRow = {
  id: number; reference: string; stage: Stage; customer: string; phone: string | null; how: string;
  paidAt: string; readyAt: string | null; collectedAt: string | null; collectedBy: string | null;
  notCollectedDays: number | null; emailProblem: { failed: string; phone: string | null } | null; markReadyOff: string | null;
  items: Item[];
};
export type FullOrder = OrderRow & { email: string | null; paid: { creditPence: number; cardPence: number; totalPence: number }; shelfName: string | null };
export type Group = { key: Stage; title: string; hint: string; orders: OrderRow[] };

export const possessive = (name: string) => `${name}’s`;
export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
/** Today's times as "10:15", earlier ones as "Mon 14 Sep, 10:15" (logged). */
export const at = (iso: string) => (londonDay(iso) === londonDay(new Date().toISOString()) ? clock(iso) : when(iso));
export const itemName = (i: Item) => (i.qty > 1 ? `${i.name} × ${i.qty}` : i.name);
export const SAVE_FAILED = 'Wheelhouse couldn’t save that. Try again in a moment.';
export const failedText = (err: unknown) => (serverSaid(err) ? err.message : SAVE_FAILED);
export const note = 'm-0 text-size-13 text-[var(--wh-muted)]';

/** A badge in the drawing's tones (ui.mjs badge): grey for where an item is, amber for something to sort. */
export function Badge({ tone = 'grey', children }: { tone?: 'grey' | 'amber'; children: ReactNode }) {
  const colours = tone === 'amber' ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-ink)]';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-sm font-semibold whitespace-nowrap ${colours}`}>{children}</span>;
}

/** The order's steps, each reloading the list, the order and the sidebar count. */
export function useOrderSteps() {
  const queryClient = useQueryClient();
  const reload = (id: number) => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['online-orders'] }),
    queryClient.invalidateQueries({ queryKey: ['online-order', id] }),
    queryClient.invalidateQueries({ queryKey: ['online-order-count'] }),
  ]);
  return async function step<T>(id: number, path: 'ready' | 'ready/undo' | 'not-ready' | 'hand-over', body: object = {}): Promise<T> {
    try {
      return await apiMutate<T>(`/api/online-orders/${id}/${path}`, body);
    } finally {
      await reload(id);
    }
  };
}
