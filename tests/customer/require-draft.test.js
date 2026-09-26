// The guard that sends a screen needing earlier answers back to the first
// book screen when they are missing.
// Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
  uninstall = undefined;
});

const GUARD = new URL('../../.test-build/screens/book/require-draft.js', import.meta.url).href;
const DRAFT = new URL('../../.test-build/screens/book/draft.js', import.meta.url).href;

async function renderAt(stored) {
  uninstall = installDom('http://localhost/book/north/date');
  if (stored) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(stored));
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { RequireDraft, hasService } = await importFresh(GUARD);
  const { DraftProvider } = await import(DRAFT);
  const router = createMemoryRouter([
    { path: '/book/:shopSlug/date', Component: () => h(RequireDraft, { has: hasService }, h('p', null, 'Date screen')) },
    { path: '/book/:shopSlug', Component: () => h('p', null, 'First screen') },
  ], { initialEntries: ['/book/north/date'] });
  const ui = render(h(DraftProvider, { shopSlug: 'north' }, h(RouterProvider, { router })));
  return { ui, router };
}

test('a screen that needs a service, opened with none, goes back to the first screen', async () => {
  const { ui, router } = await renderAt(null);
  assert.ok(await ui.findByText('First screen'));
  assert.equal(ui.queryByText('Date screen'), null);
  // The redirect replaces history: Back from the first screen must not land
  // the visitor on the guarded screen they were just bounced from.
  assert.equal(router.state.historyAction, 'REPLACE');
});

test('with a service chosen, the screen shows', async () => {
  const { ui } = await renderAt({ serviceIds: [7] });
  assert.ok(await ui.findByText('Date screen'));
});

test('an empty service list counts as no service chosen', async () => {
  const { ui } = await renderAt({ serviceIds: [] });
  assert.ok(await ui.findByText('First screen'));
});

test('not sure counts as a chosen service', async () => {
  const { ui } = await renderAt({ notSure: true });
  assert.ok(await ui.findByText('Date screen'));
});

// hasProblem: the date screen's guard (d3 adds it; d4 applies it).
// Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
const PROBLEM_SERVICES = {
  shopName: 'North Street Cycles', showPrices: false, full: [], categories: [],
  uncategorised: [
    { id: 11, name: 'Brake service', price: null, minutes: 30, questions: [
      { id: 'b1', wording: "What's wrong with the brakes?", kind: 'choice', required: true, choices: ['Squeaking', 'Not stopping well'], allowNotSure: true },
      { id: 'b2', wording: 'Anything else about the brakes?', kind: 'text', required: false },
    ] },
    { id: 12, name: 'Gear service', price: null, minutes: 30, questions: [] },
  ],
};

test('hasProblem needs a service first', async () => {
  const { hasProblem } = await import(GUARD);
  assert.equal(hasProblem({}, PROBLEM_SERVICES), false);
  assert.equal(hasProblem({ serviceIds: [] }, PROBLEM_SERVICES), false);
});

test('hasProblem needs every required question answered, by a pill or by words', async () => {
  const { hasProblem } = await import(GUARD);
  assert.equal(hasProblem({ serviceIds: [11] }, PROBLEM_SERVICES), false);
  assert.equal(hasProblem({ serviceIds: [11], answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking' }] }, PROBLEM_SERVICES), true);
  assert.equal(hasProblem({ serviceIds: [11], answers: [{ serviceId: 11, questionId: 'b1', text: 'Grinding' }] }, PROBLEM_SERVICES), true);
  assert.equal(hasProblem({ serviceIds: [12] }, PROBLEM_SERVICES), true, 'a service with no questions needs nothing more');
});

test('hasProblem needs a description for Not sure', async () => {
  const { hasProblem } = await import(GUARD);
  assert.equal(hasProblem({ notSure: true }, PROBLEM_SERVICES), false);
  assert.equal(hasProblem({ notSure: true, description: '  ' }, PROBLEM_SERVICES), false);
  assert.equal(hasProblem({ notSure: true, description: 'Clicks when pedalling' }, PROBLEM_SERVICES), true);
});

test('hasProblem treats a stale choice (no longer one of the shop\'s choices) as unanswered', async () => {
  const { hasProblem } = await import(GUARD);
  assert.equal(
    hasProblem({ serviceIds: [11], answers: [{ serviceId: 11, questionId: 'b1', choice: 'Worn pads' }] }, PROBLEM_SERVICES),
    false,
  );
});
