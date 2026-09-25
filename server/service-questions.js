// Service questions (book screen 03, staff screen 66). Pure: no database, no
// request object. Staff save a service's whole list at once through
// readServiceQuestions; a booking's answers go through checkAnswers, which
// returns the frozen copy the booking stores.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import { randomBytes } from 'node:crypto';

export const MAX_QUESTIONS = 10;
export const MAX_WORDING = 200;
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 10;
export const MAX_CHOICE = 100;
export const MAX_ANSWER = 1000;

const newQuestionId = () => `q_${randomBytes(6).toString('hex')}`;
const trimmed = (v) => (typeof v === 'string' ? v.trim() : '');

// `stored` is the service's current list ([] for a new service). An id the
// caller sends is kept only when it is already one of this service's, so a
// reworded question stays the same question and nobody can pick their own ids.
export function readServiceQuestions(input, stored = []) {
  if (!Array.isArray(input)) return { error: 'Questions must be a list' };
  if (input.length > MAX_QUESTIONS) return { error: `A service can have up to ${MAX_QUESTIONS} questions` };
  const storedIds = new Set(stored.map((q) => q.id));
  const used = new Set();
  const value = [];
  for (const q of input) {
    const wording = trimmed(q?.wording);
    if (!wording) return { error: 'Every question needs wording' };
    if (wording.length > MAX_WORDING) return { error: `A question can be up to ${MAX_WORDING} characters` };
    if (q.kind !== 'text' && q.kind !== 'choice') return { error: 'A question must be free text or a choice from a list' };
    const id = typeof q.id === 'string' && storedIds.has(q.id) && !used.has(q.id) ? q.id : newQuestionId();
    used.add(id);
    const item = { id, wording, kind: q.kind, required: q.required === true };
    if (q.kind === 'choice') {
      if (!Array.isArray(q.choices) || q.choices.length < MIN_CHOICES || q.choices.length > MAX_CHOICES) {
        return { error: `A list question needs ${MIN_CHOICES} to ${MAX_CHOICES} choices` };
      }
      const choices = q.choices.map(trimmed);
      if (choices.some((c) => !c || c.length > MAX_CHOICE)) {
        return { error: `Each choice needs wording, up to ${MAX_CHOICE} characters` };
      }
      if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) {
        return { error: 'A list question cannot repeat a choice' };
      }
      item.choices = choices;
      // "I'm not sure" is on unless the shop switches it off.
      item.allowNotSure = q.allowNotSure !== false;
    }
    value.push(item);
  }
  return { value };
}
