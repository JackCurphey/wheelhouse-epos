// Service questions, checked without a server: the staff list and the
// customer's answers.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readServiceQuestions } from '../server/service-questions.js';

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
