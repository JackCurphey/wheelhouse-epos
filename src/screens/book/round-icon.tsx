import type * as React from 'react';

/**
 * The drawn round icon on the customer's done, spent and stopped pages
 * (roundIcon in diary.mjs; the stopped page's is 44px, account.mjs).
 */
export function RoundIcon({ tone, size = 'size-12', children }: { tone: 'ok' | 'warn'; size?: string; children: React.ReactNode }) {
  const look = tone === 'ok' ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-state-ready-ink)]' : 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]';
  return <span className={`mb-3 inline-flex ${size} items-center justify-center rounded-full ${look}`}>{children}</span>;
}
