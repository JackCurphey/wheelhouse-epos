import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Short options as tappable pills, one choice (native radios) or several
 * (native checkboxes, `multiple`). The inputs are visually hidden inside
 * each pill's label, so arrow keys, screen readers and disabled options
 * behave natively. A disabled option is greyed and cannot be picked (the
 * drop-off mechanic choice greys mechanics who cannot take the job).
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export type PillOption = { value: string; label: React.ReactNode; disabled?: boolean };

type Common = { legend: React.ReactNode; options: PillOption[]; name?: string; className?: string };
export type PillGroupProps = Common &
  (
    | { multiple?: false; value: string | null; onChange: (value: string) => void }
    | { multiple: true; value: string[]; onChange: (value: string[]) => void }
  );

export function PillGroup(props: PillGroupProps) {
  const autoName = React.useId();
  const name = props.name ?? autoName;
  const isOn = (v: string) => (props.multiple ? props.value.includes(v) : props.value === v);

  function pick(v: string) {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
    }
  }

  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0', props.className)}>
      <legend className="mb-1.5 text-xs font-semibold text-[var(--wh-muted)]">{props.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'relative inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-lg border border-[var(--wh-border)] bg-white px-3.5 text-sm text-[var(--wh-ink)]',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]',
              isOn(o.value) && 'border-2 border-[var(--accent-dark)] bg-[color-mix(in_srgb,var(--accent-dark)_7%,white)]',
              o.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type={props.multiple ? 'checkbox' : 'radio'}
              name={name}
              value={o.value}
              checked={isOn(o.value)}
              disabled={o.disabled}
              onChange={(e) => !e.target.disabled && pick(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
