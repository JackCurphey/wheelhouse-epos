import * as React from 'react';
import { Navigate, useParams } from 'react-router';
import { useDraft, type BookingDraft } from './draft.tsx';
import type { ServicesResponse } from './services-query.ts';
import { descriptionError, missingAnswers } from './problem-rules.ts';

/**
 * A screen that needs earlier answers, opened without them (an old link, a
 * cleared tab), goes back to the first book screen instead of breaking.
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 */
export const hasService = (draft: BookingDraft) => (draft.serviceIds?.length ?? 0) > 0 || draft.notSure === true;

/**
 * The date screen's guard (d3 adds it; d4 applies it): a service chosen, every
 * required question answered and, for "Not sure", a description.
 * Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
 */
export const hasProblem = (draft: BookingDraft, services: ServicesResponse) =>
  hasService(draft) && missingAnswers(services, draft).length === 0 && descriptionError(draft) === null;

export function RequireDraft({ has, children }: { has: (draft: BookingDraft) => boolean; children: React.ReactNode }) {
  const { draft } = useDraft();
  const { shopSlug = '' } = useParams();
  if (!has(draft)) return <Navigate to={`/book/${shopSlug}`} replace />;
  return <>{children}</>;
}
