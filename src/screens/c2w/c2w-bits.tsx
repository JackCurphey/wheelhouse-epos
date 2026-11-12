import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { penceText } from '@/lib/money.ts';
import { ROUTES } from '@/staff/routes.ts';

/**
 * Pieces shared by Front desk › Cycle to Work, New order, the order and its
 * quote (openspec/changes/cycle-to-work group 4; c2w.mjs). Money is pence and
 * dates are YYYY-MM-DD days, as `server/routes/c2w.js` sends them.
 */
export type Stage = 'quote' | 'waiting' | 'certificate' | 'ready' | 'collected' | 'paid' | 'cancelled' | 'closed';
export type Next = 'choose' | 'order' | 'certificate' | 'ready' | 'handover' | 'paid' | null;
export type C2wOrder = {
  id: number; stage: Stage; quoteRef: string; customerId: number; customerName: string; customerPhone: string | null; customerEmail: string | null;
  providerId: number; providerName: string; productId: number; bike: string; siteName: string | null; onOrder: boolean;
  quoteGivenAt: string; quoteRevisedAt: string | null; validUntil: string; holdUntil: string | null; holdWanted: boolean;
  accessories: { productId: number; name: string; pricePence: number }[]; totalPence: number;
  appliedAt: string | null; applicationReference: string | null; certificateNumber: string | null; certificatePence: number | null;
  certificateReceivedOn: string | null; collectedAt: string | null; paidOn: string | null; inStock: boolean;
  expectedPence: number | null; expectedBy: string | null; paidPence: number | null; next?: Next;
  // Whether a bike is put aside for the order now, and what's been said about any difference.
  held?: boolean; certificateLate?: boolean; differenceChoice?: 'keep' | 'match' | null;
};
export type C2wEvent = { kind: string; by: string | null; at: string; reason: string | null; detail: Record<string, string> };
export type Settings = { holdDays: number | null; remindDays: number | null; quoteValidDays: number | null; orderRule: 'certificate' | 'applied' | 'deposit'; howToApply: string };
export type Provider = { id: number; name: string; paysInDays: number | null; accessoriesInside: boolean; commissionKind?: 'percent' | 'pounds'; commissionValue?: number | null };

export const useC2wSettings = () => useQuery({ queryKey: ['c2w-settings'], queryFn: () => apiGet<{ settings: Settings }>('/api/c2w/settings') });
// Retired ones too: an order keeps the provider it was quoted with.
export const useAllProviders = () => useQuery({ queryKey: ['c2w-providers', 'all'], queryFn: () => apiGet<{ providers: Provider[] }>('/api/c2w/providers?retired=1') });

export const orderHref = (id: number) => ROUTES['cw-order-held'].replace(':id', String(id));
export const quoteHref = (id: number) => ROUTES['cw-quote'].replace(':id', String(id));
export const pounds = (pence: number) => penceText(pence);
export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
export const possessive = (name: string) => `${name}’s`;
export const mono = 'font-[family-name:var(--wh-font-mono)]';

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
/** "8 October 2026", as the quote prints a date (server/c2w/orders.js longDate). */
export const longDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** A moment's day in the shop. */
export const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
/** The bike as a row and The order say it: on order, or not in stock (c2w.mjs listPage, details). */
export const bikeLine = (o: C2wOrder) => (o.onOrder ? `${o.bike} · on order` : o.inStock ? o.bike : `${o.bike} · not in stock`);
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The quote's closing paragraph, as the server words it (server/c2w/orders.js quoteClosing). */
export function closingFor({ bike, holdUntil, inStock, validUntil, rule }: { bike: string; holdUntil: string | null; inStock: boolean; validUntil: string; rule: Settings['orderRule'] }) {
  const valid = `This quote is valid until ${longDate(validUntil)}.`;
  if (holdUntil) return `We’re holding your bike until ${longDate(holdUntil)}. ${valid} Once your certificate reaches us, it’s yours to collect.`;
  if (!inStock) return `${bike} isn’t in stock. We’ll order it once ${rule === 'applied' ? 'you’ve applied' : 'your certificate reaches us'}, and let you know when it arrives. ${valid}`;
  return valid;
}

/** A status badge in the drawing's tones (ui.mjs badge): amber for something due, blue for a step ready. */
export function Badge({ tone, children }: { tone: 'amber' | 'blue'; children: ReactNode }) {
  const colours = tone === 'amber' ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-sm font-semibold whitespace-nowrap ${colours}`}>{children}</span>;
}

/** A white box with its contents spaced (c2w.mjs `box`). */
export function Box({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-labelledby={label} className={`shrink-0 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] ${className}`}>
      <div className="flex flex-col gap-3 p-3.5 md:p-[18px]">{children}</div>
    </section>
  );
}

/** A label and its value on one ruled line (c2w.mjs `kv`). */
export function Kv({ k, children, strong = false }: { k: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 border-t border-[var(--wh-border)] py-[7px] text-size-15 ${strong ? 'font-bold' : ''}`}>
      <span className={strong ? '' : 'text-[var(--wh-muted)]'}>{k}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/** A grey, green or amber message with its lead in bold (c2w.mjs `msg`). */
const TONES = { grey: 'bg-[var(--wh-surface-muted)] text-[var(--wh-ink)]', ok: 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]', warn: 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' };
export function Msg({ tone = 'grey', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <p className={`m-0 rounded-lg px-3 py-2.5 text-size-15 leading-normal ${TONES[tone]}`}>{children}</p>;
}

export const note = 'm-0 text-size-13 text-[var(--wh-muted)]';
export const linkClass = 'inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-semibold text-[var(--wh-ink)]';

/** The way back (c2w.mjs `back`). */
export function Back({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline">
      <span aria-hidden="true">‹</span>{children}
    </Link>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3.5">{children}</div>;
}
