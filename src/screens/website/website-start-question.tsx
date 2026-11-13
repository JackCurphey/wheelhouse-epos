import type { ReactNode } from 'react';

// Set-up step 3's question (website.mjs ws-start-3), asked again by Settings ›
// Front desk › Online orders › Showing products' Change (online.mjs on-settings-show;
// openspec/changes/website-buy-online task 2.5). Its own file so Settings can use
// it without importing the Website page, which imports Settings.

/** Step 3's question, asked again by Settings › Online orders › Showing products' Change (on-settings-show). */
export const START_QUESTION = {
  title: 'Start with every product online, or nothing?',
  sub: 'Either way, every category and product has its own “Show on website” switch afterwards.',
};

/** Step 3's two answers. */
export function StartOptions({ startWith, onChoose, group = 'start' }: { startWith: 'every' | 'nothing'; onChoose: (startWith: 'every' | 'nothing') => void; group?: string }) {
  return (
    <>
      <Option name="Every product online" group={group} checked={startWith === 'every'} onChoose={() => onChoose('every')}>Everything with a price shows. Switch off what you don’t want online.</Option>
      <Option name="Nothing online" group={group} checked={startWith === 'nothing'} onChoose={() => onChoose('nothing')}>Add categories and products as you go.</Option>
    </>
  );
}

/** website.mjs `option`: a radio card, its border darker when chosen. */
export function Option({ name, group, checked, onChoose, children }: { name: string; group: string; checked: boolean; onChoose: () => void; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-[10px] bg-[var(--wh-panel)] p-4 ${checked ? 'border-2 border-[var(--wh-ink)]' : 'border border-[var(--wh-border)]'}`}>
      <input type="radio" name={group} checked={checked} onChange={onChoose} className="mt-0.5 size-[22px] accent-[var(--wh-ink)]" />
      <span className="flex flex-col gap-1">
        <span className="text-base font-bold">{name}</span>
        <span className="text-sm leading-[1.45] text-[var(--wh-muted)]">{children}</span>
      </span>
    </label>
  );
}
