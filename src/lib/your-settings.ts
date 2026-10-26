import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';

/**
 * Each person's own settings (Your settings; workshop day 57; Jack, 23 Oct:
 * saved on the signed-in account until PINs). openspec/changes/your-settings-accessibility.
 */
export type Accessibility = { statusSymbols: boolean; reduceMotion: boolean; noAutoClose: boolean; largerText: boolean; foldedSidebar: boolean };
const KEY = ['your-settings'];

export function useYourSettings(enabled = true) {
  // Changed only here, so it's read once, not each time a diary block appears (review).
  return useQuery({ queryKey: KEY, queryFn: () => apiGet<{ accessibility: Accessibility }>('/api/your-settings'), enabled, staleTime: Infinity });
}

/** Saves one switch; the page follows once it's saved. */
export function useChangeAccessibility() {
  const queryClient = useQueryClient();
  return async (key: keyof Accessibility, on: boolean) => {
    const saved = await apiMutate<{ accessibility: Accessibility }>('/api/your-settings', { accessibility: { [key]: on } }, { method: 'PUT' });
    // Only this switch from the answer, so two quick saves answered out of order can't undo each other (review).
    queryClient.setQueryData<{ accessibility: Accessibility }>(KEY, (old) => ({ accessibility: { ...(old?.accessibility ?? saved.accessibility), [key]: saved.accessibility[key] } }));
  };
}

// The classes on <html> that the switches turn on (theme.css).
const CLASSES: [keyof Accessibility, string][] = [['reduceMotion', 'wh-reduce-motion'], ['largerText', 'wh-larger-text']];

/** Puts the signed-in person's switches on the page, for every screen; the staff frame runs it. */
export function useAccessibilityClasses(signedIn: boolean) {
  const settings = useYourSettings(signedIn);
  const a11y = settings.data?.accessibility;
  useEffect(() => {
    const root = document.documentElement.classList;
    for (const [key, cls] of CLASSES) root.toggle(cls, Boolean(a11y?.[key]));
    return () => { for (const [, cls] of CLASSES) root.remove(cls); };
  }, [a11y]);
}

/** Reduce motion, from the person's switch or the computer's own setting (the drawn hint). */
export function prefersReducedMotion(): boolean {
  if (document.documentElement.classList.contains('wh-reduce-motion')) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
