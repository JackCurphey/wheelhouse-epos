import * as React from 'react';
import { Navigate, useParams } from 'react-router';
import { useDraft, type BookingDraft } from './draft.tsx';

/**
 * A screen that needs earlier answers, opened without them (an old link, a
 * cleared tab), goes back to the first book screen instead of breaking.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */
export const hasService = (draft: BookingDraft) => draft.serviceId !== undefined || draft.notSure === true;

export function RequireDraft({ has, children }: { has: (draft: BookingDraft) => boolean; children: React.ReactNode }) {
  const { draft } = useDraft();
  const { shopSlug = '' } = useParams();
  if (!has(draft)) return <Navigate to={`/book/${shopSlug}`} replace />;
  return <>{children}</>;
}
