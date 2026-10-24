import { useQuery } from '@tanstack/react-query';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { dayLabel } from './date-rules.ts';
import { pounds } from './money.ts';
import type { BookingDraft } from './draft.tsx';
import type { ServicesResponse } from './services-query.ts';

/**
 * Paying the deposit on step 4 (Jack, 24 Oct answers 1–5; drawn as
 * bk-details-deposit, bk-card-failed and bk-checking-payment in book.mjs;
 * openspec/changes/deposit-pay-screen). The hold is asked for when step 4
 * opens; the card goes to the pretend provider's form until a real one exists.
 */
export type DepositHold = { paymentId: number; depositPence: number; depositCancelHours: number; provider: string; ref: string };

const holdsPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/deposit-holds`;
const cardPath = (shopSlug: string, ref: string) => `/api/portal/${encodeURIComponent(shopSlug)}/pretend-payments/${encodeURIComponent(ref)}/card`;

export { pounds };
export const HOLD_FAILED = 'We couldn’t get the deposit ready - please check your connection and try again';
export const PAY_AGAIN = 'The deposit needs paying again — please press Pay.';

/** The server's own code for a refusal (deposit_changed, card_declined, …), which ApiError doesn't sort. */
export const serverCode = (err: unknown) => (err instanceof ApiError && err.body && typeof err.body === 'object' && 'code' in err.body ? String((err.body as { code: unknown }).code) : null);

/** The deposit's hold for this booking, or null when none is taken (design 1). */
export function useDepositHold(shopSlug: string, services: ServicesResponse, draft: BookingDraft) {
  const enabled = services.takesDeposit === true && !!draft.requestKey;
  const body = draft.notSure ? { notSure: true, requestKey: draft.requestKey } : { serviceIds: draft.serviceIds ?? [], requestKey: draft.requestKey };
  return useQuery({
    queryKey: ['deposit-hold', shopSlug, draft.requestKey, draft.notSure ? 'not-sure' : (draft.serviceIds ?? []).join(',')],
    queryFn: async () => {
      const reply = await apiMutate<DepositHold | { depositPence: null }>(holdsPath(shopSlug), body);
      return reply.depositPence === null ? null : (reply as DepositHold);
    },
    enabled,
    staleTime: Infinity,
  });
}

/** The pretend card form's answer: held, or an ApiError (402 card_declined, 400 check the number). */
export const payCard = (shopSlug: string, ref: string, cardNumber: string) => apiMutate<{ status: string }>(cardPath(shopSlug, ref), { cardNumber });

/**
 * "Free to cancel until": the booked start (the day's start for a drop-off
 * day) less the shop's hours, in the shop's clock as the booking shows it
 * (design 2). Worked in UTC so no time zone can shift it.
 */
export function cancelUntil(draft: BookingDraft, hours: number): string {
  const at = new Date(`${draft.date}T${draft.startTime ?? '00:00'}:00Z`);
  at.setUTCHours(at.getUTCHours() - hours);
  const iso = at.toISOString();
  return `${dayLabel(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;
}

export type PayState = 'ready' | 'card-failed' | 'checking';

type PartProps = {
  hold: DepositHold;
  draft: BookingDraft;
  paid: boolean;
  state: PayState;
  cardNumber: string;
  cardError: string | null;
  onCard: (value: string) => void;
};

const alert = (strong: string, rest: string) => (
  <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-3 text-[15px] leading-snug text-[var(--wh-warn-ink)]">
    <strong>{strong}</strong> {rest}
  </p>
);

/** The drawn deposit part (book.mjs detailsBody `pay`), with the card form or what's been paid. */
export function DepositPart({ hold, draft, paid, state, cardNumber, cardError, onCard }: PartProps) {
  const title = `Deposit · ${pounds(hold.depositPence)}`;
  return (
    <section role="group" aria-label={title} className="mb-4 flex flex-col gap-2 border-t border-[var(--wh-border)] pt-3">
      <span className="text-[15px] font-bold">Deposit · <span className="font-[family-name:var(--wh-font-mono)]">{pounds(hold.depositPence)}</span></span>
      <p className="m-0 text-sm leading-normal">
        We take the deposit now, and it comes off the bill when you collect. <strong>If the shop can’t fit you in, it comes back in full</strong> within 5 to 10 working days.
      </p>
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">
        {`Free to cancel until ${cancelUntil(draft, hold.depositCancelHours)}. After that, or if you don’t come, the shop keeps it.`}
      </p>
      {state === 'card-failed' ? alert('The card didn’t go through.', 'Nothing was taken and nothing is booked yet. Try again, or use another card.') : null}
      {state === 'checking'
        ? alert('We’re checking whether your payment went through — please don’t pay again.', 'Your connection dropped while sending. Nothing will be taken twice.')
        : paid
          ? <p className="m-0 text-sm font-semibold">Paid. It’s held until your booking is sent.</p>
          : (
            <div className="rounded-[10px] border-2 border-dashed border-[var(--wh-border)] p-4">
              <Field>
                <Label htmlFor="deposit-card">Card number</Label>
                <Input
                  id="deposit-card" inputMode="numeric" autoComplete="off" value={cardNumber}
                  aria-invalid={cardError ? true : undefined} aria-describedby={`deposit-card-note${cardError ? ' deposit-card-error' : ''}`}
                  onChange={(e) => onCard(e.target.value)}
                />
                {cardError ? <FieldError id="deposit-card-error">{cardError}</FieldError> : null}
                <p id="deposit-card-note" className="m-0 mt-1 text-[13px] text-[var(--wh-muted)]">
                  Pretend payments while Wheelhouse is being built: nothing is taken. 4242 4242 4242 4242 pays; 4000 0000 0000 0002 is declined.
                </p>
              </Field>
            </div>
          )}
    </section>
  );
}
