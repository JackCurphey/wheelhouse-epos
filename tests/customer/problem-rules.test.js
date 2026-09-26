// The problem screen's rules: which questions show, how a tap or words change
// an answer, what Continue checks, and when to say photos were cleared.
// Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const RULES = new URL('../../.test-build/screens/book/problem-rules.js', import.meta.url).href;
const r = await import(RULES);

const choiceQ = (id, wording, choices, { required = true, allowNotSure = true } = {}) =>
  ({ id, wording, kind: 'choice', required, choices, allowNotSure });
const textQ = (id, wording, required = true) => ({ id, wording, kind: 'text', required });
const svc = (id, name, questions = []) => ({ id, name, price: 20, minutes: 30, questions });

// Test data in the style the spec asks shops to use (decision 5): one overall
// question per service with short common answers.
const BRAKES = choiceQ('b1', "What's wrong with the brakes?", ['Squeaking', 'Not stopping well']);
const WHICH = textQ('w1', 'Which wheel needs truing?');
const TUBELESS = choiceQ('w2', 'Tubeless?', ['Yes', 'No'], { required: false, allowNotSure: false });
const DATA = {
  shopName: 'North Street Cycles', showPrices: true,
  full: [{ ...svc(1, 'General service', [textQ('g1', 'When was its last service?', false)]), includes: [] }],
  categories: [
    { id: 5, name: 'Brakes', services: [svc(11, 'Brake service', [BRAKES])] },
    { id: 6, name: 'Wheels', services: [svc(13, 'Wheel true', [WHICH, TUBELESS])] },
  ],
  uncategorised: [svc(12, 'Gear service')],
};
const A = (extra) => ({ serviceId: 11, questionId: 'b1', ...extra });

test('question groups follow the list order and skip services with no questions', () => {
  const groups = r.questionGroups(DATA, { serviceIds: [12, 13, 11, 1] });
  assert.deepEqual(groups.map((g) => g.service.name), ['General service', 'Brake service', 'Wheel true']);
  assert.deepEqual(groups[2].questions.map((q) => q.id), ['w1', 'w2']);
});

test('ids no longer on the list, no services, and Not sure give no questions', () => {
  assert.deepEqual(r.questionGroups(DATA, { serviceIds: [999] }), []);
  assert.deepEqual(r.questionGroups(DATA, {}), []);
  assert.deepEqual(r.questionGroups(DATA, { notSure: true, serviceIds: [11] }), []);
});

test("an optional question says so; a required one is the shop's wording as typed", () => {
  assert.equal(r.questionLabel(BRAKES), "What's wrong with the brakes?");
  assert.equal(r.questionLabel(TUBELESS), 'Tubeless? (optional)');
  assert.equal(r.questionLabel(WHICH), 'Which wheel needs truing?');
});

test('pills are the shop\'s choices, then "I\'m not sure" when the shop allows it', () => {
  assert.deepEqual(r.pillOptions(BRAKES).map((o) => o.label), ['Squeaking', 'Not stopping well', "I'm not sure"]);
  assert.deepEqual(r.pillOptions(TUBELESS).map((o) => o.label), ['Yes', 'No']);
  const shopNotSure = choiceQ('x', 'X?', ["I'm not sure"]);
  const values = r.pillOptions(shopNotSure).map((o) => o.value);
  assert.equal(new Set(values).size, 2, 'a shop choice worded like the pill must not share its value');
});

test('a pill maps to a choice or to notSure, and an answer maps back to its pill', () => {
  const [squeak, , notSure] = r.pillOptions(BRAKES);
  assert.deepEqual(r.pillChange(squeak.value), { choice: 'Squeaking' });
  assert.deepEqual(r.pillChange(notSure.value), { notSure: true });
  assert.equal(r.pillValue(undefined), null);
  assert.equal(r.pillValue(A({ text: 'Grinding' })), null);
  assert.equal(r.pillValue(A({ choice: 'Squeaking' })), squeak.value);
  assert.equal(r.pillValue(A({ notSure: true })), notSure.value);
});

test('findAnswer matches on both the service and the question', () => {
  const answers = [{ serviceId: 13, questionId: 'b1', text: 'x' }, A({ choice: 'Squeaking' })];
  assert.ok(r.findAnswer(answers, 11, 'b1') === answers[1]);
  assert.equal(r.findAnswer(answers, 11, 'w1'), undefined);
  assert.equal(r.findAnswer(undefined, 11, 'b1'), undefined);
});

test('a tap, words, or both make one answer', () => {
  const tapped = r.setAnswer(undefined, 11, 'b1', { choice: 'Squeaking' });
  assert.deepEqual(tapped, [A({ choice: 'Squeaking' })]);
  assert.deepEqual(r.setAnswer(tapped, 11, 'b1', { text: 'Only when wet' }), [A({ choice: 'Squeaking', text: 'Only when wet' })]);
  assert.deepEqual(r.setAnswer([], 11, 'b1', { text: 'Grinding' }), [A({ text: 'Grinding' })]);
});

test('a tapped pill can be changed; "I\'m not sure" takes the place of the choice', () => {
  let a = r.setAnswer([A({ choice: 'Squeaking', text: 'x' })], 11, 'b1', { notSure: true });
  assert.deepEqual(a, [A({ notSure: true, text: 'x' })]);
  a = r.setAnswer(a, 11, 'b1', { choice: 'Not stopping well' });
  assert.deepEqual(a, [A({ choice: 'Not stopping well', text: 'x' })]);
});

test('clearing the words keeps a tapped pill, and removes an answer left with nothing', () => {
  assert.deepEqual(r.setAnswer([A({ choice: 'Squeaking', text: 'x' })], 11, 'b1', { text: '' }), [A({ choice: 'Squeaking' })]);
  assert.deepEqual(r.setAnswer([A({ text: 'x' })], 11, 'b1', { text: '' }), []);
});

test('other answers are left alone, in their order', () => {
  const other = { serviceId: 13, questionId: 'w1', text: 'Front' };
  assert.deepEqual(r.setAnswer([A({ choice: 'Squeaking' }), other], 11, 'b1', { choice: 'Not stopping well' }),
    [A({ choice: 'Not stopping well' }), other]);
  assert.deepEqual(r.setAnswer([other], 11, 'b1', { text: 'Grinding' }), [other, A({ text: 'Grinding' })]);
});

test("missing answers are the required questions with nothing, in screen order, in the server's words", () => {
  assert.deepEqual(r.missingAnswers(DATA, { serviceIds: [11, 13] }), [
    { serviceId: 11, questionId: 'b1', message: "Please answer: What's wrong with the brakes?" },
    { serviceId: 13, questionId: 'w1', message: 'Please answer: Which wheel needs truing?' },
  ]);
});

test('a pill alone, words alone, or "I\'m not sure" answers a required choice question', () => {
  for (const extra of [{ choice: 'Squeaking' }, { text: 'Grinding' }, { notSure: true }]) {
    assert.deepEqual(r.missingAnswers(DATA, { serviceIds: [11], answers: [A(extra)] }), [], JSON.stringify(extra));
  }
});

test('words that are only spaces are no answer', () => {
  assert.equal(r.missingAnswers(DATA, { serviceIds: [11], answers: [A({ text: '   ' })] }).length, 1);
  assert.equal(r.missingAnswers(DATA, { serviceIds: [13], answers: [{ serviceId: 13, questionId: 'w1', text: ' ' }] }).length, 1);
});

test('an answer filed under another service does not count', () => {
  assert.equal(r.missingAnswers(DATA, { serviceIds: [11], answers: [{ serviceId: 12, questionId: 'b1', choice: 'Squeaking' }] }).length, 1);
});

// Controller ruling (26 Sep): a choice answer counts as answered only if its
// `choice` is still one of the question's current `choices` - a shop may
// reword or remove a choice after the customer tapped it. Words or notSure
// still count even when the choice on file has gone stale.
test('a stale choice - no longer among the question\'s choices - does not answer it on its own', () => {
  const stale = A({ choice: 'Bent rim' }); // not in BRAKES.choices
  assert.deepEqual(r.missingAnswers(DATA, { serviceIds: [11], answers: [stale] }), [
    { serviceId: 11, questionId: 'b1', message: "Please answer: What's wrong with the brakes?" },
  ]);
});

test('a stale choice with words, or with notSure, still answers the question', () => {
  assert.deepEqual(r.missingAnswers(DATA, { serviceIds: [11], answers: [A({ choice: 'Bent rim', text: 'Grinding' })] }), []);
  assert.deepEqual(r.missingAnswers(DATA, { serviceIds: [11], answers: [A({ choice: 'Bent rim', notSure: true })] }), []);
});

test('the description is required only for Not sure', () => {
  assert.equal(r.descriptionError({ notSure: true }), "Tell us what's wrong");
  assert.equal(r.descriptionError({ notSure: true, description: '  ' }), "Tell us what's wrong");
  assert.equal(r.descriptionError({ notSure: true, description: 'Clicks when pedalling' }), null);
  assert.equal(r.descriptionError({ serviceIds: [11] }), null);
});

test('photos were cleared when the draft had some and none are held', () => {
  assert.equal(r.photosCleared({ hadPhotos: true }, 0), true);
  assert.equal(r.photosCleared({ hadPhotos: true }, 2), false);
  assert.equal(r.photosCleared({}, 0), false);
});

test('the limits match the server', () => {
  assert.equal(r.BIKE_NOTE_MAX, 200);
  assert.equal(r.ANSWER_TEXT_MAX, 1000);
  assert.equal(r.MAX_PHOTOS, 5);
  assert.equal(r.MAX_PHOTO_BYTES, 10 * 1024 * 1024);
});
