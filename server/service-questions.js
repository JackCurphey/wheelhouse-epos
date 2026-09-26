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

export const QUESTIONS_CHANGED = 'The questions for this service have changed — please check them and try again';

// Trims a caller-sent words value; a non-string throws QUESTIONS_CHANGED, an
// absent one is null. Shared by the notSure and plain-choice branches below so
// both take words the same way.
function checkedWords(raw) {
  if (raw === undefined || raw === null) return { text: null };
  if (typeof raw !== 'string') return { error: QUESTIONS_CHANGED };
  const text = raw.trim();
  if (text.length > MAX_ANSWER) return { error: 'An answer can be up to 1,000 characters' };
  return { text: text || null };
}

// `questions` is the service's current list; `answers` is what the customer
// sent: [{ questionId, text } | { questionId, choice } | { questionId, choice, text }
// | { questionId, notSure: true } | { questionId, notSure: true, text }].
// Answers are matched by id. An answer the current list cannot take (the
// question is gone, a choice was reworded, not sure was switched off) means
// the customer answered an older version, so the booking is refused as changed.
// A choice question's answer may carry typed words with or without a choice
// (piece 9); a `choice` sent alongside `notSure: true` is accepted but
// ignored - the stored answer is { notSure: true } either way, and only
// notSure's own gating (a choice-kind question with allowNotSure) applies.
// Returns the frozen copy: every question in order, wording as asked, the
// answer or null, and - for choice questions only - the typed words or null.
export function checkAnswers(questions, answers) {
  const list = answers === undefined || answers === null ? [] : answers;
  if (!Array.isArray(list)) return { error: 'Answers must be a list' };
  const byId = new Map(questions.map((q) => [q.id, q]));
  const given = new Map();
  for (const a of list) {
    if (typeof a?.questionId !== 'string') return { error: 'Each answer needs a question' };
    const q = byId.get(a.questionId);
    if (!q) return { error: QUESTIONS_CHANGED };
    if (given.has(q.id)) return { error: 'Each question can be answered only once' };
    let answer;
    let text = null;
    if (a.notSure === true) {
      if (q.kind !== 'choice' || !q.allowNotSure) return { error: QUESTIONS_CHANGED };
      const words = checkedWords(a.text);
      if (words.error) return { error: words.error };
      answer = { notSure: true };
      text = words.text;
    } else if (q.kind === 'text') {
      if (typeof a.text !== 'string') return { error: QUESTIONS_CHANGED };
      const t = a.text.trim();
      if (t.length > MAX_ANSWER) return { error: 'An answer can be up to 1,000 characters' };
      answer = t || null;
    } else {
      let choice = null;
      if (a.choice !== undefined && a.choice !== null) {
        if (typeof a.choice !== 'string' || !q.choices.includes(a.choice)) return { error: QUESTIONS_CHANGED };
        choice = a.choice;
      }
      const words = checkedWords(a.text);
      if (words.error) return { error: words.error };
      answer = choice;
      text = words.text;
    }
    given.set(q.id, { answer, text });
  }
  const value = [];
  for (const q of questions) {
    const got = given.get(q.id);
    const answer = got ? got.answer : null;
    const text = q.kind === 'choice' ? (got ? got.text : null) : null;
    const unanswered = q.kind === 'choice' ? (answer === null && !text) : answer === null;
    if (q.required && unanswered) return { error: `Please answer: ${q.wording}` };
    const entry = { id: q.id, wording: q.wording, kind: q.kind, answer };
    if (q.kind === 'choice') entry.text = text;
    value.push(entry);
  }
  return { value };
}
