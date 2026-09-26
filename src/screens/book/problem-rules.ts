import type { PortalQuestion, PortalService, ServicesResponse } from './services-query.ts';
import type { Answer, BookingDraft } from './draft.tsx';
import { chosenServices } from './service-selection.ts';

/**
 * The problem screen's rules, kept apart from the screen so they can be tested
 * directly and reused (d4's guard, hasProblem, calls missingAnswers and
 * descriptionError). A choice question is answered by a tapped pill, by the
 * customer's own words, or both; "I'm not sure" takes the place of a choice
 * (Jack, 26 Sep, decision 4). The description is required only for "Not sure"
 * (decision 7). A choice answer counts as answered only if its `choice` is
 * still one of the question's current `choices` - a shop may reword or
 * remove a choice after the customer tapped it, and words or notSure still
 * count on their own (controller ruling, 26 Sep). The server applies the
 * same rules (piece 9).
 * Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
 */

// The server's limits (piece 9 and piece 6).
export const BIKE_NOTE_MAX = 200;
export const ANSWER_TEXT_MAX = 1000;
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type ChoiceQuestion = Extract<PortalQuestion, { kind: 'choice' }>;
export type QuestionGroup = { service: PortalService; questions: PortalQuestion[] };
export type Missing = { serviceId: number; questionId: string; message: string };
export type AnswerChange = { choice: string } | { notSure: true } | { text: string };

// Pill values are prefixed so a shop choice worded "I'm not sure" can't be
// mistaken for the built-in "I'm not sure" pill.
const NOT_SURE_VALUE = 'not-sure';
const CHOICE_PREFIX = 'choice:';

/** The ticked services that have questions, in list order, each with its questions in the shop's order. */
export function questionGroups(data: ServicesResponse, draft: BookingDraft): QuestionGroup[] {
  if (draft.notSure) return [];
  return chosenServices(data, draft.serviceIds ?? [])
    .filter((s) => s.questions.length > 0)
    .map((s) => ({ service: s, questions: s.questions }));
}

/** The shop's wording, with " (optional)" when the shop did not mark it required. */
export function questionLabel(q: PortalQuestion): string {
  return q.required ? q.wording : `${q.wording} (optional)`;
}

export function pillOptions(q: ChoiceQuestion): { value: string; label: string }[] {
  const options = q.choices.map((c) => ({ value: `${CHOICE_PREFIX}${c}`, label: c }));
  return q.allowNotSure ? [...options, { value: NOT_SURE_VALUE, label: "I'm not sure" }] : options;
}

export function pillValue(answer: Answer | undefined): string | null {
  if (answer?.notSure) return NOT_SURE_VALUE;
  if (answer?.choice !== undefined) return `${CHOICE_PREFIX}${answer.choice}`;
  return null;
}

export function pillChange(value: string): AnswerChange {
  return value === NOT_SURE_VALUE ? { notSure: true } : { choice: value.slice(CHOICE_PREFIX.length) };
}

export function findAnswer(answers: Answer[] | undefined, serviceId: number, questionId: string): Answer | undefined {
  return answers?.find((a) => a.serviceId === serviceId && a.questionId === questionId);
}

/**
 * The answers with one question's pill or words changed. A pill replaces the
 * other pill ("I'm not sure" replaces a choice and the other way round); the
 * words are kept as typed (trimming happens on the server) and are
 * independent of the pill. An answer left with no pill and no words is
 * removed. Other answers keep their order.
 */
export function setAnswer(answers: Answer[] | undefined, serviceId: number, questionId: string, change: AnswerChange): Answer[] {
  const list = answers ?? [];
  const index = list.findIndex((a) => a.serviceId === serviceId && a.questionId === questionId);
  const old: Partial<Answer> = index === -1 ? {} : list[index];
  const next: Answer = { serviceId, questionId };
  if ('choice' in change) next.choice = change.choice;
  else if ('notSure' in change) next.notSure = true;
  else if (old.notSure) next.notSure = true;
  else if (old.choice !== undefined) next.choice = old.choice;
  const text = 'text' in change ? change.text : old.text;
  if (text) next.text = text;
  const empty = next.choice === undefined && next.notSure === undefined && next.text === undefined;
  if (index === -1) return empty ? list : [...list, next];
  return empty ? list.filter((_, i) => i !== index) : list.map((a, i) => (i === index ? next : a));
}

function answered(q: PortalQuestion, a: Answer | undefined): boolean {
  const words = (a?.text ?? '').trim() !== '';
  if (q.kind === 'text') return words;
  const choiceStillCurrent = a?.choice !== undefined && q.choices.includes(a.choice);
  return words || choiceStillCurrent || a?.notSure === true;
}

/** The required questions with no answer, in screen order, with the server's message. */
export function missingAnswers(data: ServicesResponse, draft: BookingDraft): Missing[] {
  return questionGroups(data, draft).flatMap(({ service, questions }) =>
    questions
      .filter((q) => q.required && !answered(q, findAnswer(draft.answers, service.id, q.id)))
      .map((q) => ({ serviceId: service.id, questionId: q.id, message: `Please answer: ${q.wording}` })),
  );
}

export function descriptionError(draft: BookingDraft): string | null {
  return draft.notSure === true && (draft.description ?? '').trim() === '' ? "Tell us what's wrong" : null;
}

/** Photos were added in this tab but none are held now (they live in memory only, so a refresh loses them). */
export function photosCleared(draft: BookingDraft, photoCount: number): boolean {
  return draft.hadPhotos === true && photoCount === 0;
}
