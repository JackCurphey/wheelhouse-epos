import { Check } from 'lucide-react';

/**
 * One chip look for every choice (reports.mjs `chip`; audit M3): the chosen one dark with a
 * tick, as radios or checkboxes. A choice that doesn't fit is greyed, struck through and not
 * choosable, with its reason announced to a screen reader (`aria-description`), and written
 * under its group by `Reasons` (audit M1, M2).
 */
export type Choice = { value: string; label: string; why?: string };

export function ChoiceChip({ role, group, choice, checked, onChoose }: {
  role: 'radio' | 'checkbox'; group: string; choice: Choice; checked: boolean; onChoose: () => void;
}) {
  const greyed = Boolean(choice.why);
  const tone = greyed
    ? 'border-[var(--wh-border)] bg-transparent text-[var(--wh-muted)] line-through'
    : checked ? 'border-[var(--wh-ink)] bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'border-[var(--wh-ink)] bg-transparent text-[var(--wh-ink)]';
  return (
    <label className={`relative inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)] ${greyed ? 'cursor-not-allowed' : 'cursor-pointer'} ${tone}`}>
      <input
        type={role} name={group} value={choice.value} checked={checked && !greyed}
        aria-disabled={greyed ? true : undefined} aria-description={choice.why}
        onChange={() => { if (!greyed) onChoose(); }} className="sr-only"
      />
      {checked && !greyed ? <Check size={14} aria-hidden="true" /> : null}
      {choice.label}
    </label>
  );
}

/** "Jobs: workshop only — choose it from the Workshop report · Hours: workshop only", under a group. */
export function Reasons({ choices }: { choices: Choice[] }) {
  const list = choices.filter((c) => c.why);
  if (!list.length) return null;
  return <span className="text-size-13-5 text-[var(--wh-muted)]">{list.map((c) => `${c.label}: ${c.why}`).join(' · ')}</span>;
}
