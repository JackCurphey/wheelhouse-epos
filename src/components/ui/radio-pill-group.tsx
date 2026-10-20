import * as React from 'react';

/**
 * A group of pill buttons that work as radios (`role="radio"` with
 * `aria-checked`): one Tab stop for the group, on the picked pill (or the
 * first when none is picked), and the arrow keys moving to the next or
 * previous pill, wrapping, with Home and End to the ends, as the drawings'
 * pills do (diary.mjs mechanicPill's roving tabindex). By default the pill
 * moved to is also picked, as a radio is; `pickOnMove={false}` only moves, for
 * a group whose choice opens a question (Space or Enter then picks, as for any
 * button). Disabled pills are skipped.
 */
export type RadioPillGroupProps = React.ComponentProps<'div'> & { pickOnMove?: boolean };

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function radiosIn(el: HTMLElement | null): HTMLElement[] {
  if (!el) return [];
  return [...el.querySelectorAll<HTMLElement>('[role="radio"]')].filter(
    (r) => !(r as HTMLButtonElement).disabled && r.getAttribute('aria-disabled') !== 'true',
  );
}

export function RadioPillGroup({ pickOnMove = true, onKeyDown, children, ...props }: RadioPillGroupProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  // After every render: only the picked pill (or the first) is in the Tab order.
  React.useLayoutEffect(() => {
    const radios = radiosIn(ref.current);
    const on = radios.find((r) => r.getAttribute('aria-checked') === 'true') ?? radios[0];
    for (const r of ref.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []) r.tabIndex = r === on ? 0 : -1;
  });

  function move(e: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const radios = radiosIn(ref.current);
    const at = radios.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    let next: HTMLElement | undefined;
    if (e.key in STEP) next = radios[(at + STEP[e.key] + radios.length) % radios.length];
    else if (e.key === 'Home') next = radios[0];
    else if (e.key === 'End') next = radios[radios.length - 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
    if (pickOnMove && next.getAttribute('aria-checked') !== 'true') next.click();
  }

  return (
    <div ref={ref} role="radiogroup" onKeyDown={move} {...props}>
      {children}
    </div>
  );
}
