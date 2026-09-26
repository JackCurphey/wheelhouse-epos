import * as React from 'react';
import { Navigate, useParams } from 'react-router';
import { useDraft, type BookingDraft } from './draft.tsx';
import type { ServicesResponse } from './services-query.ts';
import { descriptionError, missingAnswers } from './problem-rules.ts';

/**
 * A screen that needs earlier answers, opened without them (an old link, a
 * cleared tab), goes back to an earlier book screen instead of breaking: the
 * first screen by default, or `to` (the part of the address after
 * /book/<shopSlug>; d4's date screen uses `problem`).
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 * d4 (`to`, hasDate): docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
 */
export const hasService = (draft: BookingDraft) => (draft.serviceIds?.length ?? 0) > 0 || draft.notSure === true;

/**
 * The date screen's guard (d3 adds it; d4 applies it): a service chosen, every
 * required question answered and, for "Not sure", a description.
 * Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
 */
export const hasProblem = (draft: BookingDraft, services: ServicesResponse) =>
  hasService(draft) && missingAnswers(services, draft).length === 0 && descriptionError(draft) === null;

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const TIME_FORMAT = /^\d{2}:\d{2}$/;

/**
 * The details screen's guard (d4 adds it; d5 applies it): a day and a real
 * mechanic, plus a start time when one was chosen. A drop-off day holds no
 * start time, and "Any mechanic" is resolved before it is saved.
 */
export const hasDate = (draft: BookingDraft) =>
  typeof draft.date === 'string' &&
  DAY_FORMAT.test(draft.date) &&
  Number.isInteger(draft.mechanicId) &&
  (draft.startTime === undefined || TIME_FORMAT.test(draft.startTime));

export function RequireDraft({
  has,
  to = '',
  children,
}: {
  has: (draft: BookingDraft) => boolean;
  to?: string;
  children: React.ReactNode;
}) {
  const { draft } = useDraft();
  const { shopSlug = '' } = useParams();
  if (!has(draft)) return <Navigate to={to ? `/book/${shopSlug}/${to}` : `/book/${shopSlug}`} replace />;
  return <>{children}</>;
}
