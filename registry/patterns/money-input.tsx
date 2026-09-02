import * as React from 'react';

import { Input } from '@/registry/primitives/input';
import { cn } from '@/lib/utils';

/**
 * Money input - the field the Wheelhouse app uses for every price, payment,
 * refund and adjustment.
 *
 * The value it hands the caller is an INTEGER NUMBER OF PENCE. It never
 * produces or consumes a float. `parseFloat('19.99') * 100` is 1998.9999...,
 * and rounding that at each step is how tills drift a penny at a time, so
 * the parser works on the digit strings and the formatter divides only by an
 * exact multiple of 100.
 */

/**
 * Parse typed text into integer pence.
 *
 * Returns null for an empty field (which callers should treat as "not set",
 * distinct from zero) and null for anything that is not a valid amount, so a
 * half-typed value can never be silently read as a different number.
 */
export function parsePence(input: string): number | null {
  const cleaned = input.replace(/[\s,£]/g, '');
  if (cleaned === '') return null;

  const match = /^(-?)(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, sign, whole, frac] = match;
  // "." and "-" on their own are mid-typing, not amounts.
  if (whole === '' && (frac === undefined || frac === '')) return null;

  const pounds = whole === '' ? 0 : Number.parseInt(whole, 10);
  const pence = Number.parseInt(`${frac ?? ''}00`.slice(0, 2), 10);
  if (!Number.isSafeInteger(pounds)) return null;

  const total = pounds * 100 + pence;
  return sign === '-' ? -total : total;
}

/**
 * Render integer pence as a plain decimal string, no currency symbol - the
 * symbol is drawn separately so it never lands inside the editable text.
 *
 * The division is exact: `abs - (abs % 100)` is always a whole number of
 * hundreds, so dividing it by 100 cannot introduce a fractional error.
 */
export function formatPence(pence: number): string {
  if (!Number.isInteger(pence)) {
    throw new TypeError(`formatPence expects integer pence, received ${pence}`);
  }
  const abs = Math.abs(pence);
  const pounds = (abs - (abs % 100)) / 100;
  return `${pence < 0 ? '-' : ''}${pounds}.${String(abs % 100).padStart(2, '0')}`;
}

export type MoneyInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  /** Integer pence, or null when the field is empty. */
  value: number | null;
  /** Fires with integer pence, or null when the field is emptied. */
  onValueChange: (pence: number | null) => void;
  /** Currency symbol drawn inside the field. Wheelhouse trades in GBP. */
  symbol?: string;
};

export function MoneyInput({
  value,
  onValueChange,
  symbol = '£',
  className,
  onBlur,
  'aria-invalid': ariaInvalid,
  ...props
}: MoneyInputProps) {
  // While the field has focus the user's own text wins, so "12." and "007"
  // survive keystroke-by-keystroke instead of being rewritten under the
  // caret. On blur the draft is dropped and the canonical form comes back.
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? (value === null ? '' : formatPence(value));

  // A draft that will not parse is shown as invalid rather than pushed
  // upstream, so the caller's state is only ever a real amount or null.
  const draftIsInvalid = draft !== null && draft.trim() !== '' && parsePence(draft) === null;

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]"
      >
        {symbol}
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        aria-invalid={ariaInvalid ?? (draftIsInvalid || undefined)}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const parsed = parsePence(next);
          if (parsed !== null) onValueChange(parsed);
          else if (next.replace(/[\s,£]/g, '') === '') onValueChange(null);
        }}
        onBlur={(event) => {
          setDraft(null);
          onBlur?.(event);
        }}
        className={cn('pl-6 text-right tabular-nums', className)}
      />
    </div>
  );
}
