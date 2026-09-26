// Service questions, checked without a server: the staff list and the
// customer's answers.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readServiceQuestions, checkAnswers, QUESTIONS_CHANGED } from '../server/service-questions.js';

const ID = /^q_[0-9a-f]{12}$/;
const text = (over = {}) => ({ wording: 'What is wrong?', kind: 'text', ...over });
const choice = (over = {}) => ({ wording: 'E-bike?', kind: 'choice', choices: ['Yes', 'No'], ...over });

test('a list is kept in order, trimmed, with new ids and defaults', () => {
  const r = readServiceQuestions([text({ wording: '  What is wrong?  ' }), choice()]);
  assert.ok(r.value, r.error);
  assert.equal(r.value.length, 2);
  assert.match(r.value[0].id, ID);
  assert.match(r.value[1].id, ID);
  assert.notEqual(r.value[0].id, r.value[1].id);
  assert.deepEqual({ ...r.value[0], id: 'x' }, { id: 'x', wording: 'What is wrong?', kind: 'text', required: false });
  assert.deepEqual({ ...r.value[1], id: 'x' },
    { id: 'x', wording: 'E-bike?', kind: 'choice', required: false, choices: ['Yes', 'No'], allowNotSure: true });
});

test('required and allowNotSure are taken when given', () => {
  const r = readServiceQuestions([choice({ required: true, allowNotSure: false })]);
  assert.equal(r.value[0].required, true);
  assert.equal(r.value[0].allowNotSure, false);
});

test('a text question drops choices and allowNotSure', () => {
  const r = readServiceQuestions([text({ choices: ['a', 'b'], allowNotSure: true })]);
  assert.deepEqual(Object.keys(r.value[0]).sort(), ['id', 'kind', 'required', 'wording']);
});

test('an id already stored on this service is kept; any other id is replaced', () => {
  const stored = [{ id: 'q_aaaaaaaaaaaa', wording: 'Old', kind: 'text', required: false }];
  const r = readServiceQuestions([text({ id: 'q_aaaaaaaaaaaa', wording: 'Reworded' }), text({ id: 'q_bbbbbbbbbbbb' })], stored);
  assert.equal(r.value[0].id, 'q_aaaaaaaaaaaa');
  assert.equal(r.value[0].wording, 'Reworded');
  assert.notEqual(r.value[1].id, 'q_bbbbbbbbbbbb');
  assert.match(r.value[1].id, ID);
});

test('a stored id sent twice is kept only once', () => {
  const stored = [{ id: 'q_aaaaaaaaaaaa', wording: 'Old', kind: 'text', required: false }];
  const r = readServiceQuestions([text({ id: 'q_aaaaaaaaaaaa' }), text({ id: 'q_aaaaaaaaaaaa' })], stored);
  assert.equal(r.value[0].id, 'q_aaaaaaaaaaaa');
  assert.notEqual(r.value[1].id, 'q_aaaaaaaaaaaa');
});

test('an empty list is allowed', () => {
  assert.deepEqual(readServiceQuestions([]), { value: [] });
});

const refuses = (input, pattern) => {
  const r = readServiceQuestions(input);
  assert.ok(r.error, `expected a refusal, got ${JSON.stringify(r)}`);
  assert.match(r.error, pattern);
};

test('not a list is refused', () => refuses({}, /must be a list/));
test('more than 10 questions is refused', () =>
  refuses(Array.from({ length: 11 }, () => text()), /up to 10 questions/));
test('10 questions are allowed', () =>
  assert.ok(readServiceQuestions(Array.from({ length: 10 }, () => text())).value));
test('missing wording is refused', () => refuses([text({ wording: '   ' })], /needs wording/));
test('wording over 200 characters is refused', () => refuses([text({ wording: 'x'.repeat(201) })], /200 characters/));
test('wording of exactly 200 characters is allowed', () =>
  assert.ok(readServiceQuestions([text({ wording: 'x'.repeat(200) })]).value));
test('an unknown kind is refused', () => refuses([text({ kind: 'photo' })], /free text or a choice/));
test('a choice question with one choice is refused', () => refuses([choice({ choices: ['Yes'] })], /2 to 10 choices/));
test('a choice question with 11 choices is refused', () =>
  refuses([choice({ choices: Array.from({ length: 11 }, (_, i) => `c${i}`) })], /2 to 10 choices/));
test('a choice question without a choices list is refused', () => refuses([choice({ choices: undefined })], /2 to 10 choices/));
test('an empty choice is refused', () => refuses([choice({ choices: ['Yes', ' '] })], /100 characters/));
test('a choice over 100 characters is refused', () => refuses([choice({ choices: ['Yes', 'x'.repeat(101)] })], /100 characters/));
test('duplicate choices are refused, ignoring case and spaces', () =>
  refuses([choice({ choices: ['Yes', ' yes '] })], /repeat a choice/));

const Q = [
  { id: 'q_000000000001', wording: 'What is wrong?', kind: 'text', required: true },
  { id: 'q_000000000002', wording: 'E-bike?', kind: 'choice', required: false, choices: ['Yes', 'No'], allowNotSure: true },
  { id: 'q_000000000003', wording: 'Tubeless?', kind: 'choice', required: true, choices: ['Yes', 'No'], allowNotSure: false },
];
const good = [
  { questionId: 'q_000000000001', text: '  Squeaks  ' },
  { questionId: 'q_000000000003', choice: 'No' },
];

test('answers become a frozen copy in question order, skipped optional as null', () => {
  assert.deepEqual(checkAnswers(Q, [...good].reverse()), {
    value: [
      { id: 'q_000000000001', wording: 'What is wrong?', kind: 'text', answer: 'Squeaks' },
      { id: 'q_000000000002', wording: 'E-bike?', kind: 'choice', answer: null, text: null },
      { id: 'q_000000000003', wording: 'Tubeless?', kind: 'choice', answer: 'No', text: null },
    ],
  });
});

test('a choice answer may carry words with no choice', () => {
  const qs = [{ ...Q[1], required: false }];
  assert.deepEqual(checkAnswers(qs, [{ questionId: 'q_000000000002', text: 'Not sure, will check' }]).value[0],
    { id: 'q_000000000002', wording: 'E-bike?', kind: 'choice', answer: null, text: 'Not sure, will check' });
});

test('a choice answer may carry a choice and words together', () => {
  assert.deepEqual(checkAnswers(Q, [good[0], { questionId: 'q_000000000003', choice: 'No', text: 'Fitted last month' }]).value[2],
    { id: 'q_000000000003', wording: 'Tubeless?', kind: 'choice', answer: 'No', text: 'Fitted last month' });
});

test('a required choice question is answered by words alone', () => {
  assert.deepEqual(checkAnswers(Q, [good[0], { questionId: 'q_000000000003', text: 'No idea, ask at drop-off' }]).value[2],
    { id: 'q_000000000003', wording: 'Tubeless?', kind: 'choice', answer: null, text: 'No idea, ask at drop-off' });
});

test('a required choice question with no choice, no notSure and no words is refused', () =>
  refused([good[0]], /^Please answer: Tubeless\?$/));

test('words on a choice question over 1,000 characters are refused', () =>
  refused([good[0], { questionId: 'q_000000000003', choice: 'No', text: 'x'.repeat(1001) }], /1,000 characters/));

test('not sure is stored as { notSure: true } and answers a required question', () => {
  const qs = [{ ...Q[1], required: true }];
  assert.deepEqual(checkAnswers(qs, [{ questionId: 'q_000000000002', notSure: true }]).value[0].answer, { notSure: true });
});

test('a service with no questions and no answers gives an empty copy', () => {
  assert.deepEqual(checkAnswers([], undefined), { value: [] });
});

test('a blank text answer to an optional question is stored as null', () => {
  const qs = [{ ...Q[0], required: false }];
  assert.equal(checkAnswers(qs, [{ questionId: 'q_000000000001', text: '   ' }]).value[0].answer, null);
});

const refused = (answers, pattern, qs = Q) => {
  const r = checkAnswers(qs, answers);
  assert.ok(r.error, `expected a refusal, got ${JSON.stringify(r)}`);
  assert.match(r.error, pattern);
};

test('the changed message is exact', () =>
  assert.equal(QUESTIONS_CHANGED, 'The questions for this service have changed — please check them and try again'));
test('answers that are not a list are refused', () => refused({}, /must be a list/));
test('a missing required answer is refused, naming the question', () =>
  refused([good[1]], /^Please answer: What is wrong\?$/));
test('a blank answer to a required text question is refused', () =>
  refused([{ questionId: 'q_000000000001', text: ' ' }, good[1]], /Please answer: What is wrong/));
test('an unknown question id is refused as changed', () =>
  refused([...good, { questionId: 'q_gone00000000', text: 'x' }], /questions for this service have changed/));
test('a choice not on the list is refused as changed', () =>
  refused([good[0], { questionId: 'q_000000000003', choice: 'Maybe' }], /have changed/));
test('not sure where it is switched off is refused as changed', () =>
  refused([good[0], { questionId: 'q_000000000003', notSure: true }], /have changed/));
test('not sure on a text question is refused as changed', () =>
  refused([{ questionId: 'q_000000000001', notSure: true }, good[1]], /have changed/));
test('a non-string choice or words on a choice question is refused as changed', () =>
  refused([good[0], { questionId: 'q_000000000003', text: 42 }], /have changed/));
test('a text answer over 1,000 characters is refused', () =>
  refused([{ questionId: 'q_000000000001', text: 'x'.repeat(1001) }, good[1]], /1,000 characters/));
test('a text answer of exactly 1,000 characters is allowed', () =>
  assert.ok(checkAnswers(Q, [{ questionId: 'q_000000000001', text: 'x'.repeat(1000) }, good[1]]).value));
test('the same question answered twice is refused', () =>
  refused([...good, good[0]], /answered only once/));
test('an answer without a question id is refused', () => refused([{ text: 'x' }], /needs a question/));
