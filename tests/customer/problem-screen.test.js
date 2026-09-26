// The problem screen: bike box, each ticked service's questions (pills plus
// the customer's own words), the description, and Continue.
// Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const choiceQ = (id, wording, choices, { required = true, allowNotSure = true } = {}) =>
  ({ id, wording, kind: 'choice', required, choices, allowNotSure });
const textQ = (id, wording, required = true) => ({ id, wording, kind: 'text', required });
const svc = (id, name, questions = []) => ({ id, name, price: 20, minutes: 30, questions });
const DATA = {
  shopName: 'North Street Cycles', showPrices: true, full: [],
  categories: [
    { id: 5, name: 'Brakes', services: [svc(11, 'Brake service', [choiceQ('b1', "What's wrong with the brakes?", ['Squeaking', 'Not stopping well'])])] },
    { id: 6, name: 'Wheels', services: [svc(13, 'Wheel true', [
      textQ('w1', 'Which wheel needs truing?'),
      choiceQ('w2', 'Tubeless?', ['Yes', 'No'], { required: false, allowNotSure: false }),
    ])] },
  ],
  uncategorised: [svc(12, 'Gear service')],
};
const BRAKE_WORDS = "What's wrong with the brakes? Or tell us in your own words";

const open = async (draft = { serviceIds: [11, 12, 13] }, services = DATA) => {
  current = await renderBookScreen({
    file: 'screens/book/problem.js', exportName: 'ProblemScreen', at: 'problem', url: '/book/north/problem', services, draft,
  });
  await current.ui.findByRole('heading', { level: 1, name: 'Tell us about your bike' });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => (await rtl()).fireEvent.click(el);
const type = async (el, value) => (await rtl()).fireEvent.change(el, { target: { value } });
const pillLabels = async (ui, name) => {
  const { within } = await rtl();
  return within(ui.getByRole('group', { name })).getAllByRole('radio').map((r) => r.closest('label').textContent);
};

test('a heading per ticked service with questions, in list order; none for a service without', async () => {
  const { ui } = await open();
  assert.deepEqual(ui.getAllByRole('heading', { level: 2 }).map((h) => h.textContent), ['Brake service', 'Wheel true']);
});

test('a choice question shows its pills, "I\'m not sure" when allowed, and a words box', async () => {
  const { ui } = await open();
  assert.deepEqual(await pillLabels(ui, "What's wrong with the brakes?"), ['Squeaking', 'Not stopping well', "I'm not sure"]);
  assert.deepEqual(await pillLabels(ui, 'Tubeless? (optional)'), ['Yes', 'No']);
  assert.ok(ui.getByText("What's wrong with the brakes?").closest('fieldset'));
  assert.equal(ui.getAllByText('Or tell us in your own words').length, 2);
  const words = ui.getByRole('textbox', { name: BRAKE_WORDS });
  assert.equal(words.tagName, 'TEXTAREA');
  assert.equal(words.maxLength, 1000);
  assert.ok(ui.getByRole('textbox', { name: 'Tubeless? (optional) Or tell us in your own words' }));
});

test('the bike box, a text question, and the optional description', async () => {
  const { ui } = await open();
  const bike = ui.getByRole('textbox', { name: 'Your bike (optional)' });
  assert.equal(bike.tagName, 'INPUT');
  assert.equal(bike.getAttribute('placeholder'), 'Blue Trek road bike');
  assert.equal(bike.maxLength, 200);
  const which = ui.getByRole('textbox', { name: 'Which wheel needs truing?' });
  assert.equal(which.tagName, 'TEXTAREA');
  assert.equal(which.maxLength, 1000);
  const description = ui.getByRole('textbox', { name: 'Anything else we should know? (optional)' });
  assert.equal(description.hasAttribute('maxlength'), false, 'the description has no length limit');
});

test('services ticked but no questions: the bike box and the optional description only', async () => {
  const { ui } = await open({ serviceIds: [12] });
  assert.equal(ui.queryAllByRole('heading', { level: 2 }).length, 0);
  assert.equal(ui.getAllByRole('textbox').length, 2);
  assert.ok(ui.getByRole('textbox', { name: 'Your bike (optional)' }));
  assert.ok(ui.getByRole('textbox', { name: 'Anything else we should know? (optional)' }));
});

test('Not sure: no questions, a required description, and Back goes to the first screen', async () => {
  const { ui } = await open({ notSure: true, serviceIds: [], answers: [] });
  assert.equal(ui.queryAllByRole('heading', { level: 2 }).length, 0);
  assert.equal(ui.queryByRole('radio'), null);
  assert.ok(ui.getByRole('textbox', { name: "What's wrong with it?" }));
  assert.equal(ui.queryByText('Anything else we should know? (optional)'), null);
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north'));
});

test('with services ticked, Back goes to the service list', async () => {
  const { ui } = await open();
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north/services'));
});

test('opened with no service chosen, it goes back to the first screen', async () => {
  current = await renderBookScreen({
    file: 'screens/book/problem.js', exportName: 'ProblemScreen', at: 'problem', url: '/book/north/problem', services: DATA,
  });
  assert.ok(await current.ui.findByText('At /book/north'));
});

test('a tap, words, or both are saved to the draft as they change', async () => {
  const { ui, readDraft } = await open();
  const answer = () => readDraft().answers.find((a) => a.questionId === 'b1');
  await type(ui.getByRole('textbox', { name: BRAKE_WORDS }), 'Grinding');
  assert.deepEqual(answer(), { serviceId: 11, questionId: 'b1', text: 'Grinding' });
  await click(ui.getByRole('radio', { name: 'Squeaking' }));
  assert.deepEqual(answer(), { serviceId: 11, questionId: 'b1', choice: 'Squeaking', text: 'Grinding' });
  assert.equal(ui.getByRole('radio', { name: 'Squeaking' }).checked, true);
  await click(ui.getByRole('radio', { name: "I'm not sure" }));
  assert.deepEqual(answer(), { serviceId: 11, questionId: 'b1', notSure: true, text: 'Grinding' });
  await type(ui.getByRole('textbox', { name: BRAKE_WORDS }), '');
  assert.deepEqual(answer(), { serviceId: 11, questionId: 'b1', notSure: true });
  await type(ui.getByRole('textbox', { name: 'Which wheel needs truing?' }), 'Front');
  assert.deepEqual(readDraft().answers.find((a) => a.questionId === 'w1'), { serviceId: 13, questionId: 'w1', text: 'Front' });
});

test('the bike box, description and words survive a remount', async () => {
  const first = await open({ serviceIds: [11] });
  await type(first.ui.getByRole('textbox', { name: 'Your bike (optional)' }), 'Green Brompton');
  await type(first.ui.getByRole('textbox', { name: 'Anything else we should know? (optional)' }), 'Rattles over bumps');
  await type(first.ui.getByRole('textbox', { name: BRAKE_WORDS }), 'Grinding');
  const stored = first.readDraft();
  assert.equal(stored.bikeNote, 'Green Brompton');
  assert.equal(stored.description, 'Rattles over bumps');
  first.ui.unmount();
  current.client.clear();
  current.uninstall();
  current = undefined;

  const second = await open(stored);
  assert.equal(second.ui.getByRole('textbox', { name: 'Your bike (optional)' }).value, 'Green Brompton');
  assert.equal(second.ui.getByRole('textbox', { name: 'Anything else we should know? (optional)' }).value, 'Rattles over bumps');
  assert.equal(second.ui.getByRole('textbox', { name: BRAKE_WORDS }).value, 'Grinding');
});

test('Continue with required questions unanswered: a message under each, the pinned summary, focus on the first', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  const brakes = ui.getByText("Please answer: What's wrong with the brakes?");
  assert.ok(brakes.parentElement.contains(ui.getByRole('radio', { name: 'Squeaking' })), 'message is not under its question');
  assert.ok(ui.getByText('Please answer: Which wheel needs truing?'));
  assert.equal(ui.queryByText(/Please answer: Tubeless/), null, 'an optional question needs no answer');
  const words = ui.getByRole('textbox', { name: BRAKE_WORDS });
  assert.equal(words.getAttribute('aria-invalid'), 'true');
  assert.equal(words.getAttribute('aria-describedby'), brakes.id);
  const alert = ui.getByRole('alert');
  assert.equal(alert.textContent, 'Please check the answers marked above');
  assert.ok(document.querySelector('[data-book-pinned]').contains(alert));
  assert.ok(document.activeElement === ui.getByRole('radio', { name: 'Squeaking' }), 'focus is not on the first question');
  assert.equal(ui.queryByText(/^At /), null);
});

test('a message goes as soon as its question is answered', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  await type(ui.getByRole('textbox', { name: BRAKE_WORDS }), 'Grinding');
  assert.equal(ui.queryByText("Please answer: What's wrong with the brakes?"), null);
  assert.ok(ui.getByText('Please answer: Which wheel needs truing?'));
  assert.ok(ui.getByRole('alert'));
});

test('pressing Continue twice with the same problem re-announces a fresh alert', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  const first = ui.getByRole('alert');
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert') !== first, 'the alert node was not replaced on the second press');
});

test('Not sure with no description: a message under it, and focus on it', async () => {
  const { ui } = await open({ notSure: true, serviceIds: [], answers: [] });
  await click(ui.getByRole('button', { name: 'Continue' }));
  const box = ui.getByRole('textbox', { name: "What's wrong with it?" });
  const message = ui.getByText("Tell us what's wrong");
  assert.equal(box.getAttribute('aria-describedby'), message.id);
  assert.ok(ui.getByRole('alert').textContent === 'Please check the answers marked above');
  assert.ok(document.activeElement === box, 'focus is not on the description');
  assert.equal(ui.queryByText(/^At /), null);
});

test('a good Continue goes to the date screen and sends nothing', async () => {
  const { ui, requests } = await open();
  await type(ui.getByRole('textbox', { name: BRAKE_WORDS }), 'Grinding');
  await type(ui.getByRole('textbox', { name: 'Which wheel needs truing?' }), 'Front');
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/date'));
  assert.ok(requests.length > 0);
  assert.ok(requests.every((r) => r.method === 'GET' && r.url.endsWith('/api/portal/north/services')), JSON.stringify(requests));
});

test('Not sure with a description continues to the date screen', async () => {
  const { ui } = await open({ notSure: true, serviceIds: [], answers: [] });
  await type(ui.getByRole('textbox', { name: "What's wrong with it?" }), 'Clicks when pedalling');
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/date'));
});

const photo = (name) => new File([new Uint8Array(1000)], name, { type: 'image/jpeg' });
const addPhotos = async (ui, files) =>
  (await rtl()).fireEvent.change(ui.container.querySelector('input[type="file"]'), { target: { files } });

test('photos: the picker, its label and the drop-off line', async () => {
  const { ui } = await open({ serviceIds: [12] });
  assert.ok(ui.getByText('Add photos (optional)'));
  assert.ok(ui.getByText('You can also show us at drop-off.'));
  assert.equal(ui.container.querySelector('input[type="file"]').getAttribute('accept'), 'image/jpeg,image/png,image/webp');
  assert.equal(ui.queryByText('Your photos were cleared - please add them again'), null);
});

test('adding photos records it in the draft, never the photos themselves', async () => {
  const { ui, readDraft } = await open({ serviceIds: [12] });
  await addPhotos(ui, [photo('wheel.jpg')]);
  assert.ok(ui.getByRole('button', { name: 'Remove wheel.jpg' }));
  assert.equal(readDraft().hadPhotos, true);
  assert.doesNotMatch(JSON.stringify(readDraft()), /wheel\.jpg/);
  await click(ui.getByRole('button', { name: 'Remove wheel.jpg' }));
  assert.equal(readDraft().hadPhotos, undefined);
});

test('after a remount, photos added before are reported cleared, above the picker, until added again', async () => {
  const first = await open({ serviceIds: [12] });
  await addPhotos(first.ui, [photo('wheel.jpg')]);
  const stored = first.readDraft();
  first.ui.unmount();
  current.client.clear();
  current.uninstall();
  current = undefined;

  const { ui } = await open(stored);
  const message = ui.getByText('Your photos were cleared - please add them again');
  assert.ok(message.compareDocumentPosition(ui.getByText('Add photos (optional)')) & Node.DOCUMENT_POSITION_FOLLOWING, 'the message is not above the picker');
  await addPhotos(ui, [photo('wheel.jpg')]);
  assert.equal(ui.queryByText('Your photos were cleared - please add them again'), null);
});

test('continuing without re-adding photos drops the cleared message', async () => {
  const { ui, readDraft } = await open({ serviceIds: [12], hadPhotos: true });
  assert.ok(ui.getByText('Your photos were cleared - please add them again'));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/date'));
  assert.equal(readDraft().hadPhotos, undefined);
});
