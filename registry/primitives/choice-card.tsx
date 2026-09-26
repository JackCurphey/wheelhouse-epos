import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A big tappable option card: title, optional detail line, optional price.
 * Selected = 2px shop-colour border and a pale shop-colour fill (Jack, 26 Sep:
 * the atlas card style). Pass `selected` only when the card is one of a set
 * the customer picks between; a card that just navigates leaves it out and
 * gets no aria-pressed. `price` is shown as given - never formatted here.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export type ChoiceCardProps = Omit<React.ComponentProps<'button'>, 'title'> & {
  title: React.ReactNode;
  detail?: React.ReactNode;
  price?: string;
  selected?: boolean;
};

export function ChoiceCard({ title, detail, price, selected, className, type = 'button', ...props }: ChoiceCardProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-[var(--wh-border)] bg-white px-3.5 py-4 text-left text-[var(--wh-ink)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected && 'border-2 border-[var(--accent-dark)] bg-[color-mix(in_srgb,var(--accent-dark)_7%,white)]',
        className,
      )}
      {...props}
    >
      {/* The {' '} spaces keep the button's accessible name as separate words
          ("Service 1 From £20") even when the stylesheet has not loaded. In a
          flex layout they take no room, so nothing moves on screen. */}
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        {detail && <>{' '}<span className="text-[13px] text-[var(--wh-muted)]">{detail}</span></>}
      </span>
      {price && <>{' '}<span className="whitespace-nowrap font-semibold">{price}</span></>}
    </button>
  );
}
