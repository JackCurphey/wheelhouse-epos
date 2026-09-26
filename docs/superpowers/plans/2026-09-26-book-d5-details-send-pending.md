# Book (d5): details, sending, pending, and the whole journey - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the last three parts of the customer booking journey at `/book`: the `details` screen (`/book/:shopSlug/details`: contact details, update channel, booking terms), sending the booking request to the real server, and the `pending` screen (`/book/:shopSlug/booking/:code`, which the private link reopens). Then prove the whole journey end to end in a real browser against the real server and a throwaway shop in the test database.

**Architecture:**
- The rules are pure functions: `src/screens/book/details-rules.ts` (field messages, the summary, the request body from the draft and fresh `/services`, and sorting a refusal into `date` / `problem` / stay) and `src/screens/book/pending-rules.ts` (status words, summary lines). The screens only call these.
- Small data files beside `services-query.ts`: `send.ts` (reads a photo to bare base64, POSTs the booking), `terms-query.ts` (`GET /api/portal/:shopSlug/terms`, server piece 11) and `pending-query.ts` (`GET /api/portal/:shopSlug/booking-links/:code`).
- `details.tsx` renders in `BookFrame` step 4, guarded by `RequireDraft` with `hasDate` and `to="date"` once `/services` has loaded. The terms and the "photos were cleared" question open in the registry `Dialog`, installed unchanged in Task 3.
- Leaving the details screen after sending (success, or a refusal that goes to `date` / `problem`) is decided in `DetailsScreen`, above the guard, because sending clears the draft (or its date) and the guard would otherwise redirect first. `date` and `problem` read a refusal's message from the router's navigation state.
- `pending.tsx` renders in `BookFrame` with no step, no back link and no action. Its heading is the booking's status.
- The journey test (`tests/browser/book-journey.spec.ts`) starts its own live server with `startLiveServer` (which pins the server's clock to `TEST_CLOCK_PIN`, 07:00 UK time on Tuesday 1 September 2026), seeds a throwaway shop through the same helpers the server tests use, pins the browser's clock to the same moment in `Europe/London`, books from `/book/<shop>` to `pending`, checks the database row, and removes the shop. No Playwright config or CI change.

**Tech Stack:**
- React 19, TypeScript, react-router 8, @tanstack/react-query 5
- Registry controls in `src/components/ui/`: `Input`, `Label`/`Field`/`FieldError`, `PillGroup`, `Checkbox`, `Button`, and `Dialog` (installed in Task 3 from `registry/primitives/dialog.tsx`)
- Tailwind classes using only existing `--wh-*` / `--accent*` variables
- Tests: `node:test` + jsdom + @testing-library/react against `.test-build/` (built by `npm run pretest`), and Playwright (`npm run test:browser`)

**Spec:** `docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md`. It relies on **server piece 11** (PR #86, branch `feat/book-server-11-terms`, not merged when this plan was written; spec `docs/superpowers/specs/2026-09-26-book-server-11-terms-design.md` on that branch), which "must merge first". The contracts used here are read from `server/server.js` on this branch (`POST /api/portal/:shopSlug/bookings` ~:4802, `GET /api/portal/:shopSlug/booking-links/:code` ~:5096), `server/booking-request.js`, `server/booking-link.js`, `server/booking-photos.js`, `server/service-questions.js`, and from piece 11's `server/server.js` (`GET /api/portal/:shopSlug/terms` returns `{ title: "Booking terms", text, standard }`; the POST needs nothing new, it stores `terms_text` itself).

## Global Constraints

- Branch `feat/book-d5-details-send-pending`, at `d427d0c` (origin/main `24bccac` plus the d5 spec commit). Never commit to `main`. Never switch branches.
- **Server piece 11 (PR #86) must merge before the d5 PR is merged** (spec: "must merge first"). Tasks 1-7 don't depend on it at runtime: every jsdom and mocked browser test answers the server itself. Task 8's journey test checks `terms_text`, a column piece 11 adds, as its **last** assertion, so on this branch it fails there (and only there) until piece 11 is in. Task 9 checks `gh pr view 86`, merges `origin/main` into this branch only if #86 is `MERGED`, and never merges `feat/book-server-11-terms` or any other unmerged branch.
- Customer component tests run against the build. After changing anything in `src/`, run `npm run pretest` before `node --test tests/customer/<file>.test.js` (or `tests/screens/<file>.test.js`). `npm test` does both.
- Postgres (compose, port 5433) must be running for `npm test` and Playwright. Run `npm run migrate` after any merge that brings a migration.
- Create no files in the repo other than those this plan names. Don't commit `.claude/launch.json` (untracked; always `git add` named paths). No scratch, debug or screenshot files in the repo; screenshots go to `/tmp`.
- **Every new test is watched failing for the right reason before the code that passes it.** Each task has a mutation step that proves its tests bite: make the mutation, show it in `git diff`, run, confirm the named test fails for the stated reason, restore it, confirm `git diff` no longer shows it, and re-run to PASS. A mutation that does not show in `git diff` did not land - redo it.
- jsdom tests:
  - Compare DOM nodes with `assert.ok(a === b)`, never `assert.equal`.
  - Clear the React Query client in `afterEach` (`current?.client.clear()`), after `cleanup()`.
  - A test that renders twice must call `ui.unmount()` before `client.clear()` and `uninstall()`.
  - Every test file must exit within seconds. Never leave a fetch pending: `tests/helpers/book-screen.js` answers every address at once (Task 3 extends it). A test that holds a response back must release it before it ends. Time each new file: `time node --test <file>` should report under 10 s (the pending file's "Copied" test waits about 2 s by design).
  - BookFrame calls `window.scrollTo`, which jsdom lacks; jsdom has no `showModal`/`close` on `<dialog>`, and no `navigator.clipboard`. The helper stubs the first two; the pending test stubs the clipboard itself.
- Never hand-edit `src/components/ui/`. The one control change is installing the registry's existing `dialog` unchanged (Task 3) with `npx shadcn add ./public/r/dialog.json --yes --overwrite`; `tests/customer/installed-controls.test.js` then checks it byte for byte. The controls' real props:
  - `Input`: any `<input>` props (`type` defaults to `text`; `aria-invalid` turns the border red).
  - `Label`: a plain `<label>`; `Field`: a `div` stack with `mb-3`; `FieldError`: a `p` in `--wh-danger`.
  - `PillGroup`: single `{ legend, options: { value, label, disabled? }[], value: string | null, onChange(value: string), className? }` (radios in a `fieldset` named by its legend).
  - `Checkbox`: `{ label: ReactNode, id?, ...<input> props }` (the `label` wraps the input; a `button` inside the label does not toggle the box - checked in jsdom while writing this plan).
  - `Dialog`: `{ open, onOpenChange(open), wide?, dismissOnBackdrop?, ...<dialog> props }` on the native `<dialog>` (`showModal()` when `open`; mirrors Escape/`close` back through `onOpenChange`); `DialogHeader`, `DialogTitle` (`h2`), `DialogBody`, `DialogFooter`, `DialogClose` (a button named "Close").
  - `Button`: `variant` `default` | `primary` | `accent` | `danger` | `ghost`, `block`, any `<button>` props.
- Colours: only existing variables from `src/styles/theme.css` (`--wh-danger`, `--wh-muted`, `--wh-border`, `--wh-warn-bg`, `--wh-warn-ink`, `--accent-dark`). Lint bans hex colours, including hex fallbacks inside `var()` - never write `var(--x, #...)`.
- Lint forbids setting state synchronously inside an effect (`react-hooks/set-state-in-effect`). Setting state in an event handler, a promise callback or a `setTimeout` callback is fine.
- MonthCalendar names its day buttons with Intl, which puts a comma after the weekday ("Wednesday, 2 September 2026"); locate day buttons with `/^Wednesday,?\s+2 September 2026$/` in Playwright (as `tests/browser/book-date.spec.ts` does).
- Never add fixed test dates before 1 September 2026. This plan uses 5 and 6 October 2026 in jsdom tests and 2 September 2026 in the journey test (the day after the pinned test clock).
- **Copy is verbatim from the spec** (hyphens are ASCII `-`; the en dash in the drop-off summary is U+2013, as on `date`):
  - Details: step 4; Back to `/book/:shopSlug/date`; "How can we reach you?" (h1); "Request booking" (action)
  - Summary: the services' names joined by ", ", or "Not sure"; the day and time as on `date` ("Monday 5 October, 09:30 with Alex"; "Tuesday 6 October, drop off 08:30–10:00"); "From £T" when the shop shows prices; the bike note
  - "Your name"; "Mobile number"; "How should we send updates?"; "Text message" (default), "WhatsApp", "Email" (`updateChannel` `sms`, `whatsapp`, `email`); "Email", or "Email (optional)" unless Email is chosen; "I agree to the booking terms" with "booking terms" opening the terms
  - "Please enter your name"; "Please enter your mobile number"; "Please enter a valid email address"; "Please accept the booking terms"
  - "Your photos were cleared - add them again, or send without them?"; "Add photos"; "Send without photos"
  - "Sending…" (U+2026)
  - "Sorry, that time was booked while you were filling in your details - please choose another" (on `date`)
  - "Too many booking requests from this network - please try again later."
  - "We couldn't send your booking - please check your connection and try again"
  - Pending status words: "Awaiting shop confirmation", "Confirmed", "In the workshop", "Ready to collect", "Collected", "Change requested", "Declined", "Cancelled", "Request expired"
  - "Keep this link to check your booking"; "Copy link"; "Copied"; "Need to change or cancel? Contact <shop name>"
  - "We can't find that booking" (404); "This link has expired" (410); "Try again"
  - **Not in the spec** (Jack approves on the PR; see the decision log): "Please check the answers marked above" in the pinned area on details (d3's approved wording, reused); "We couldn't load the booking terms" above "Try again" in the terms dialog; "We couldn't load this booking" as the pending heading on a failure other than 404/410; "Reference" (the atlas mock-up's label) on pending; "Loading…" as pending's heading while the link loads (BookFrame's existing word).
- Data:
  - The body sends `jobDate` and `mechanicId` always (the server refuses a booking without either; `hasDate` guarantees both), `startTime` only when the draft has one (a timed day). `anyMechanic` is never sent.
  - Photos go as `[{ dataBase64 }]`: bare base64, no `data:` prefix, no line breaks (`server/booking-photos.js` checks `^[A-Za-z0-9+/]+={0,2}$`).
  - Before sending, `/services` is read again (outside React Query, so a failed read can't put BookFrame into its failed state) and answers are cleaned with `cleanAnswers` against that copy.
- Navigation: success goes to the reply's `privateLink` (replacing the details entry in history); a time gone goes to `/book/:shopSlug/date` with state `{ timeTaken: true }`; changed questions go to `/book/:shopSlug/problem` with state `{ questionsChanged: <server's message> }`; the guard sends a customer who fails `hasDate` to `/book/:shopSlug/date`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No dependency, CI, config or server changes. If `npx shadcn add` changes `package.json` or `package-lock.json`, restore both with `git checkout --` and report it (lucide-react, the dialog's one dependency, is already installed). Don't edit the atlas mock-up (`docs/design/release-1-journey/screens.js`); the spec's "Changes" list records where d5 departs from it.

## Files

- Create `src/screens/book/details-rules.ts`, `src/screens/book/send.ts`, `tests/customer/details-rules.test.js` (Task 1).
- Create `src/screens/book/pending-query.ts`, `src/screens/book/pending-rules.ts`, `tests/customer/pending-rules.test.js` (Task 2).
- Modify `tests/helpers/book-screen.js`; install `src/components/ui/dialog.tsx`; create `src/screens/book/terms-query.ts`, `src/screens/book/details.tsx`, `tests/customer/details-screen.test.js`; modify `src/customer/app-shell.tsx` (Task 3).
- Modify `src/screens/book/details.tsx`, `tests/customer/details-screen.test.js` (Task 4).
- Modify `src/screens/book/date.tsx`, `src/screens/book/problem.tsx`, `tests/customer/date-screen.test.js`, `tests/customer/problem-screen.test.js` (Task 5).
- Create `src/screens/book/pending.tsx`, `tests/customer/pending-screen.test.js`; modify `src/customer/app-shell.tsx`, `tests/screens/customer-app-shell.test.js` (Task 6).
- Create `tests/browser/book-details.spec.ts` (Task 7).
- Create `tests/browser/book-journey.spec.ts` (Task 8).
- Modify `.agents/STATUS.md` and this plan (decision log, spec walk) (Task 9).

---

### Task 1: The details rules, reading a photo, and sending

**Files:**
- Create: `src/screens/book/details-rules.ts`
- Create: `src/screens/book/send.ts`
- Test: `tests/customer/details-rules.test.js`

**Interfaces:**
- Consumes:
  - `ApiError` (`status`, `code`, `message`, `body`) and `apiMutate<T>(path, body)` from `@/lib/api/client.ts`
  - `BookingDraft`, `Answer` from `./draft.tsx` (`name?`, `phone?`, `email?`, `updateChannel?: 'email' | 'sms' | 'whatsapp'`, `termsAccepted?`, `hadPhotos?`, `date?`, `mechanicId?`, `startTime?`, `anyMechanic?`, `serviceIds?`, `notSure?`, `answers?`, `bikeNote?`, `description?`)
  - `ServicesResponse` from `./services-query.ts`; `AvailabilityResponse`, `PortalMechanic` from `./date-query.ts`
  - `chosenServices(data, ids)`, `formatFrom(price)` from `./service-selection.ts`; `cleanAnswers(data, draft)` from `./problem-rules.ts`; `dayLabel(date)` from `./date-rules.ts`
  - type `PillOption` from `@/components/ui/pill-group`
- Produces, from `details-rules.ts` (all exported):
  - types `UpdateChannel = 'email' | 'sms' | 'whatsapp'`, `ContactField = 'name' | 'phone' | 'email' | 'terms'`, `FieldProblem = { field: ContactField; message: string }`, `SendRefusalState = { timeTaken?: true; questionsChanged?: string }`, `RefusalRoute = { to: 'date' } | { to: 'problem'; message: string } | { to: 'stay'; message: string }`, `DropoffWindow = { start: string; end: string }`, `BookingBody`
  - constants `DEFAULT_CHANNEL` (`'sms'`), `CHANNEL_OPTIONS: PillOption[]`, `FIELD_MESSAGES: Record<ContactField, string>`, `CHECK_ANSWERS`, `PHOTOS_QUESTION`, `TIME_TAKEN_MESSAGE`, `TOO_MANY_REQUESTS`, `SEND_FAILED`
  - `channelOf(draft): UpdateChannel`, `emailLabel(channel): string`, `looksLikeEmail(s): boolean`, `fieldErrors(draft): FieldProblem[]`
  - `serviceNames(services, draft): string`, `priceText(services, draft): string | null`, `dropoffWindowOn(availability, date): DropoffWindow | undefined`, `whenText(draft, mechanics?: PortalMechanic[], dropoff?: DropoffWindow): string`, `summaryLines(services, draft, when: string): string[]`
  - `bookingBody(services, draft, photos: string[]): BookingBody`
  - `refusalRoute(error: unknown): RefusalRoute`
- Produces, from `send.ts`: type `BookingReply = { id: number; reference: string; privateLink: string; services: { name: string; price: number | null }[]; totalPrice: number | null }`; `bookingsPath(shopSlug): string`; `sendBooking(shopSlug, body: BookingBody): Promise<BookingReply>`; `photoBase64(file: Blob): Promise<string>`.

- [ ] **Step 1: Write the failing rules test** `tests/customer/details-rules.test.js`

```js
// The details screen's rules: the field messages, the summary, the request
// body, sorting a refusal, and reading a photo to bare base64.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const BUILD = new URL('../../.test-build/', import.meta.url);
const r = await import(new URL('screens/book/details-rules.js', BUILD).href);
const s = await import(new URL('screens/book/send.js', BUILD).href);
const { ApiError } = await import(new URL('lib/api/client.js', BUILD).href);

const choiceQ = (id, wording, choices) => ({ id, wording, kind: 'choice', required: true, choices, allowNotSure: true });
const SERVICES = {
  shopName: 'North Street Cycles', showPrices: true, full: [], categories: [],
  uncategorised: [
    { id: 11, name: 'Brake service', price: 20, minutes: 30, questions: [choiceQ('b1', "What's wrong with the brakes?", ['Squeaking', 'Not stopping well'])] },
    { id: 12, name: 'Gear service', price: 25.5, minutes: 45, questions: [] },
    { id: 13, name: 'Wheel true', price: null, minutes: 30, questions: [] },
  ],
};
const MECHANICS = [{ id: 1, name: 'Alex', workingDays: [] }, { id: 2, name: 'Jo', workingDays: [] }];
const CONTACT = { name: 'Gina Guest', phone: '07700 900123', termsAccepted: true };

test('the messages, word for word', () => {
  assert.deepEqual(r.FIELD_MESSAGES, {
    name: 'Please enter your name',
    phone: 'Please enter your mobile number',
    email: 'Please enter a valid email address',
    terms: 'Please accept the booking terms',
  });
  assert.equal(r.CHECK_ANSWERS, 'Please check the answers marked above');
  assert.equal(r.PHOTOS_QUESTION, 'Your photos were cleared - add them again, or send without them?');
  assert.equal(r.TIME_TAKEN_MESSAGE, 'Sorry, that time was booked while you were filling in your details - please choose another');
  assert.equal(r.TOO_MANY_REQUESTS, 'Too many booking requests from this network - please try again later.');
  assert.equal(r.SEND_FAILED, "We couldn't send your booking - please check your connection and try again");
});

test('every field is checked, in screen order; blank counts as empty', () => {
  assert.deepEqual(r.fieldErrors({}), [
    { field: 'name', message: 'Please enter your name' },
    { field: 'phone', message: 'Please enter your mobile number' },
    { field: 'terms', message: 'Please accept the booking terms' },
  ]);
  assert.deepEqual(r.fieldErrors({ name: '  ', phone: ' ', termsAccepted: true }).map((p) => p.field), ['name', 'phone']);
  assert.deepEqual(r.fieldErrors(CONTACT), []);
});

test('an email is needed for Email updates, and must look like one whenever it is given', () => {
  const email = (d) => r.fieldErrors({ ...CONTACT, ...d }).find((p) => p.field === 'email')?.message ?? null;
  assert.equal(email({}), null, 'text message, no email');
  assert.equal(email({ updateChannel: 'email' }), 'Please enter a valid email address');
  assert.equal(email({ updateChannel: 'email', email: '   ' }), 'Please enter a valid email address');
  assert.equal(email({ email: 'gina@' }), 'Please enter a valid email address');
  assert.equal(email({ email: 'gina example.com' }), 'Please enter a valid email address');
  assert.equal(email({ updateChannel: 'email', email: ' gina@example.com ' }), null);
  assert.equal(email({ updateChannel: 'whatsapp', email: 'gina@example.com' }), null);
  assert.equal(r.looksLikeEmail('gina@example.com'), true);
  assert.equal(r.looksLikeEmail('gina@@'), false);
});

test('updates default to text message; the email label says optional unless Email is chosen', () => {
  assert.equal(r.DEFAULT_CHANNEL, 'sms');
  assert.equal(r.channelOf({}), 'sms');
  assert.equal(r.channelOf({ updateChannel: 'whatsapp' }), 'whatsapp');
  assert.deepEqual(r.CHANNEL_OPTIONS, [
    { value: 'sms', label: 'Text message' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'Email' },
  ]);
  assert.equal(r.emailLabel('email'), 'Email');
  assert.equal(r.emailLabel('sms'), 'Email (optional)');
  assert.equal(r.emailLabel('whatsapp'), 'Email (optional)');
});

test('the summary: services in list order, or Not sure; the price when shown; the bike note', () => {
  assert.equal(r.serviceNames(SERVICES, { serviceIds: [12, 11] }), 'Brake service, Gear service');
  assert.equal(r.serviceNames(SERVICES, { notSure: true, serviceIds: [] }), 'Not sure');
  assert.equal(r.priceText(SERVICES, { serviceIds: [11, 12] }), 'From £45.50');
  assert.equal(r.priceText({ ...SERVICES, showPrices: false }, { serviceIds: [11, 12] }), null);
  assert.equal(r.priceText(SERVICES, { serviceIds: [11, 13] }), null, 'a service with no price');
  assert.equal(r.priceText(SERVICES, { notSure: true, serviceIds: [] }), null);
  assert.deepEqual(
    r.summaryLines(SERVICES, { serviceIds: [11], bikeNote: ' Blue Trek ' }, 'Monday 5 October, 09:30 with Alex'),
    ['Brake service', 'Monday 5 October, 09:30 with Alex', 'From £20', 'Blue Trek'],
  );
  assert.deepEqual(r.summaryLines(SERVICES, { notSure: true, serviceIds: [], bikeNote: '  ' }, 'Tuesday 6 October'), ['Not sure', 'Tuesday 6 October']);
});

test('the day and time read as on the date screen', () => {
  assert.equal(r.whenText({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }, MECHANICS), 'Monday 5 October, 09:30 with Alex');
  assert.equal(r.whenText({ date: '2026-10-05', mechanicId: 9, startTime: '09:30' }, MECHANICS), 'Monday 5 October, 09:30', 'mechanic not known');
  assert.equal(r.whenText({ date: '2026-10-06', mechanicId: 2 }, MECHANICS, { start: '08:30', end: '10:00' }), 'Tuesday 6 October, drop off 08:30–10:00');
  assert.equal(r.whenText({ date: '2026-10-06', mechanicId: 2 }), 'Tuesday 6 October', 'window not known');
  assert.equal(r.whenText({}), '');
  const av = {
    busy: [], fullDays: [],
    days: [
      { date: '2026-10-06', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' }, mechanics: [] },
      { date: '2026-10-05', mode: 'timed', mechanics: [] },
    ],
  };
  assert.deepEqual(r.dropoffWindowOn(av, '2026-10-06'), { start: '08:30', end: '10:00' });
  assert.equal(r.dropoffWindowOn(av, '2026-10-05'), undefined);
  assert.equal(r.dropoffWindowOn(av, '2026-10-07'), undefined);
});

test('the body on a timed day: services, cleaned answers, the bike note, photos, the time and the contact', () => {
  const draft = {
    serviceIds: [11, 12],
    answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking', text: 'Front only' }, { serviceId: 11, questionId: 'gone', text: 'old' }],
    bikeNote: ' Blue Trek road bike ', description: '  ',
    date: '2026-10-05', mechanicId: 1, startTime: '09:30',
    name: ' Gina Guest ', phone: ' 07700 900123 ', updateChannel: 'whatsapp', termsAccepted: true, hadPhotos: true,
  };
  assert.deepEqual(r.bookingBody(SERVICES, draft, ['AAAA']), {
    serviceIds: [11, 12],
    answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking', text: 'Front only' }],
    bikeNote: 'Blue Trek road bike',
    photos: [{ dataBase64: 'AAAA' }],
    jobDate: '2026-10-05', mechanicId: 1, startTime: '09:30',
    guestName: 'Gina Guest', guestPhone: '07700 900123',
    updateChannel: 'whatsapp', termsAccepted: true,
  });
});

test('Not sure on a drop-off day: no services or answers, the description, no start time, and the email when given', () => {
  const draft = {
    notSure: true, serviceIds: [], answers: [], description: ' Clicks when pedalling ',
    date: '2026-10-06', mechanicId: 2, anyMechanic: true,
    ...CONTACT, email: ' gina@example.com ', updateChannel: 'email',
  };
  assert.deepEqual(r.bookingBody(SERVICES, draft, []), {
    notSure: true, description: 'Clicks when pedalling', photos: [],
    jobDate: '2026-10-06', mechanicId: 2,
    guestName: 'Gina Guest', guestPhone: '07700 900123', email: 'gina@example.com',
    updateChannel: 'email', termsAccepted: true,
  });
  const plain = r.bookingBody(SERVICES, { serviceIds: [12], date: '2026-10-05', mechanicId: 1, startTime: '09:30', ...CONTACT }, []);
  assert.equal(plain.updateChannel, 'sms', 'the default channel is sent');
  assert.equal('email' in plain, false);
});

const refused = (status, body) => r.refusalRoute(new ApiError(status, body));

test('a refusal is sorted: taken or too soon to date, changed questions to problem, the rest stays', () => {
  assert.deepEqual(
    refused(409, { error: 'That mechanic does not have enough free time that day - please choose another day, or a shorter job.', code: 'capacity' }),
    { to: 'date' },
  );
  for (const error of [
    'That time is no longer available - please choose another.',
    "That's too soon for the shop - please choose a later time or day.",
    'That date has passed - please choose another day.',
  ]) assert.deepEqual(refused(400, { error }), { to: 'date' }, error);
  const changed = 'The questions for this service have changed — please check them and try again';
  assert.deepEqual(refused(400, { error: changed }), { to: 'problem', message: changed });
  assert.deepEqual(refused(429, { error: 'anything' }), { to: 'stay', message: 'Too many booking requests from this network - please try again later.' });
  assert.deepEqual(refused(400, { error: 'Please answer: Tubeless?' }), { to: 'stay', message: 'Please answer: Tubeless?' });
  assert.deepEqual(refused(500, null), { to: 'stay', message: 'request failed with 500' });
  assert.deepEqual(r.refusalRoute(new TypeError('Failed to fetch')), {
    to: 'stay', message: "We couldn't send your booking - please check your connection and try again",
  });
});

test('a choice made stale since the date screen also goes back to date (decision 4; Jack approves)', () => {
  for (const error of [
    'That mechanic is unavailable at that time - please choose another time or day.',
    'This shop takes drop-offs on that day - choose the day, not a time.',
    'A start time is required',
    'Please choose a mechanic',
  ]) assert.deepEqual(refused(400, { error }), { to: 'date' }, error);
});

test('a photo is read as bare base64: no data: prefix, no line breaks, a large file in chunks', async () => {
  const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7) % 256);
  const encoded = await s.photoBase64(new File([bytes], 'brake.png', { type: 'image/png' }));
  assert.equal(encoded, Buffer.from(bytes).toString('base64'));
  assert.doesNotMatch(encoded, /^data:|\n/);
});

test("the booking goes to the shop's bookings address", () => {
  assert.equal(s.bookingsPath('north shop'), '/api/portal/north%20shop/bookings');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/details-rules.test.js`
Expected: FAIL. The top-level import rejects with `ERR_MODULE_NOT_FOUND` for `details-rules.js`.

- [ ] **Step 3: Write** `src/screens/book/details-rules.ts`

```ts
import type { PillOption } from '@/components/ui/pill-group';
import { ApiError } from '@/lib/api/client.ts';
import type { Answer, BookingDraft } from './draft.tsx';
import type { ServicesResponse } from './services-query.ts';
import type { AvailabilityResponse, PortalMechanic } from './date-query.ts';
import { chosenServices, formatFrom } from './service-selection.ts';
import { cleanAnswers } from './problem-rules.ts';
import { dayLabel } from './date-rules.ts';

/**
 * The details screen's rules, kept apart from the screen so they can be tested
 * directly: the field messages, the summary, the request body built from the
 * draft and a fresh copy of /services, and where a refusal sends the customer.
 * The screen only calls these. The server applies the same field rules
 * (server/booking-request.js).
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */

export type UpdateChannel = NonNullable<BookingDraft['updateChannel']>;
export type ContactField = 'name' | 'phone' | 'email' | 'terms';
export type FieldProblem = { field: ContactField; message: string };
export type DropoffWindow = { start: string; end: string };
/** Carried in the router's navigation state to the screen a refusal sends the customer to. */
export type SendRefusalState = { timeTaken?: true; questionsChanged?: string };
export type RefusalRoute = { to: 'date' } | { to: 'problem'; message: string } | { to: 'stay'; message: string };

export type BookingBody = {
  serviceIds?: number[];
  notSure?: true;
  answers?: Answer[];
  bikeNote?: string;
  description?: string;
  photos: { dataBase64: string }[];
  jobDate: string;
  mechanicId: number;
  startTime?: string;
  guestName: string;
  guestPhone: string;
  email?: string;
  updateChannel: UpdateChannel;
  termsAccepted: true;
};

export const DEFAULT_CHANNEL: UpdateChannel = 'sms';
export const CHANNEL_OPTIONS: PillOption[] = [
  { value: 'sms', label: 'Text message' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];
export const FIELD_MESSAGES: Record<ContactField, string> = {
  name: 'Please enter your name',
  phone: 'Please enter your mobile number',
  email: 'Please enter a valid email address',
  terms: 'Please accept the booking terms',
};
// Not in the spec: d3's approved wording for the pinned summary, reused (Jack approves).
export const CHECK_ANSWERS = 'Please check the answers marked above';
export const PHOTOS_QUESTION = 'Your photos were cleared - add them again, or send without them?';
export const TIME_TAKEN_MESSAGE = 'Sorry, that time was booked while you were filling in your details - please choose another';
export const TOO_MANY_REQUESTS = 'Too many booking requests from this network - please try again later.';
export const SEND_FAILED = "We couldn't send your booking - please check your connection and try again";

// The server's 400 refusals carry no code, so these are matched on the start
// of its message (server/server.js, the booking route). The spec's list:
const TIME_GONE = ['That time is no longer available', "That's too soon for the shop", 'That date has passed'];
// Not in the spec's list, but each means the date screen's choice has gone
// stale since it was made (spec decision 4: "a time gone at sending returns
// the customer to date"). Jack approves on the PR; delete this list to
// follow the spec's list alone.
const STALE_CHOICE = [
  'That mechanic is unavailable at that time',
  'This shop takes drop-offs on that day',
  'A start time is required',
  'Please choose a mechanic',
];
const QUESTIONS_CHANGED = 'The questions for this service have changed';

export const channelOf = (draft: BookingDraft): UpdateChannel => draft.updateChannel ?? DEFAULT_CHANNEL;

export const emailLabel = (channel: UpdateChannel) => (channel === 'email' ? 'Email' : 'Email (optional)');

/** The server's own test (server/booking-request.js). */
export const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+$/.test(s);

const blank = (s: string | undefined) => (s ?? '').trim() === '';

/** Every field's problem, in screen order; empty when Request booking can go on. */
export function fieldErrors(draft: BookingDraft): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (blank(draft.name)) problems.push({ field: 'name', message: FIELD_MESSAGES.name });
  if (blank(draft.phone)) problems.push({ field: 'phone', message: FIELD_MESSAGES.phone });
  const email = (draft.email ?? '').trim();
  if ((channelOf(draft) === 'email' && !email) || (email && !looksLikeEmail(email))) {
    problems.push({ field: 'email', message: FIELD_MESSAGES.email });
  }
  if (draft.termsAccepted !== true) problems.push({ field: 'terms', message: FIELD_MESSAGES.terms });
  return problems;
}

/** The chosen services' names in list order, or "Not sure". */
export function serviceNames(services: ServicesResponse, draft: BookingDraft): string {
  if (draft.notSure) return 'Not sure';
  return chosenServices(services, draft.serviceIds ?? []).map((s) => s.name).join(', ');
}

/** "From £T" when the shop shows prices and every chosen service has one; summed in pence. */
export function priceText(services: ServicesResponse, draft: BookingDraft): string | null {
  if (draft.notSure || !services.showPrices) return null;
  const chosen = chosenServices(services, draft.serviceIds ?? []);
  if (chosen.length === 0 || chosen.some((s) => s.price === null)) return null;
  const pence = chosen.reduce((sum, s) => sum + Math.round((s.price as number) * 100), 0);
  return formatFrom(pence / 100);
}

/** The drop-off window on that day, whether or not the day still has room. */
export function dropoffWindowOn(availability: AvailabilityResponse, date: string): DropoffWindow | undefined {
  const day = availability.days.find((d) => d.date === date);
  return day?.mode === 'dropoff' ? day.dropoffWindow : undefined;
}

/**
 * The day and time as the date screen's summary shows them. A timed day has a
 * start time and names the mechanic once /mechanics is known; a drop-off day
 * stores no start time and shows its window once that day's availability is
 * known. Until then (or if either fails to load) the line is shorter, never
 * wrong.
 */
export function whenText(draft: BookingDraft, mechanics: PortalMechanic[] = [], dropoff?: DropoffWindow): string {
  if (!draft.date) return '';
  const day = dayLabel(draft.date);
  if (draft.startTime) {
    const name = mechanics.find((m) => m.id === draft.mechanicId)?.name;
    return name ? `${day}, ${draft.startTime} with ${name}` : `${day}, ${draft.startTime}`;
  }
  return dropoff ? `${day}, drop off ${dropoff.start}–${dropoff.end}` : day;
}

/** The summary at the top of the details screen: services, day and time, price when shown, bike note when given. */
export function summaryLines(services: ServicesResponse, draft: BookingDraft, when: string): string[] {
  const bikeNote = draft.bikeNote?.trim() || null;
  return [serviceNames(services, draft), when, priceText(services, draft), bikeNote].filter((l): l is string => !!l);
}

/**
 * The request body. `services` is the copy read just before sending, so the
 * answers are cleaned against the shop's questions as they are now. `photos`
 * is each held photo as bare base64. The details guard (hasDate) guarantees a
 * date and a real mechanic; a start time is sent only on a timed day.
 */
export function bookingBody(services: ServicesResponse, draft: BookingDraft, photos: string[]): BookingBody {
  const bikeNote = draft.bikeNote?.trim();
  const description = draft.description?.trim();
  const email = draft.email?.trim();
  return {
    ...(draft.notSure
      ? { notSure: true as const }
      : { serviceIds: draft.serviceIds ?? [], answers: cleanAnswers(services, draft) }),
    ...(bikeNote ? { bikeNote } : {}),
    ...(description ? { description } : {}),
    photos: photos.map((dataBase64) => ({ dataBase64 })),
    jobDate: draft.date as string,
    mechanicId: draft.mechanicId as number,
    ...(draft.startTime ? { startTime: draft.startTime } : {}),
    guestName: (draft.name ?? '').trim(),
    guestPhone: (draft.phone ?? '').trim(),
    ...(email ? { email } : {}),
    updateChannel: channelOf(draft),
    termsAccepted: true,
  };
}

/** Where a failed send leaves the customer. Anything that isn't an answer from the server is a lost connection. */
export function refusalRoute(error: unknown): RefusalRoute {
  if (!(error instanceof ApiError)) return { to: 'stay', message: SEND_FAILED };
  if (error.status === 429) return { to: 'stay', message: TOO_MANY_REQUESTS };
  if (error.code === 'capacity') return { to: 'date' };
  const starts = (list: string[]) => list.some((prefix) => error.message.startsWith(prefix));
  if (error.status === 400 && starts([...TIME_GONE, ...STALE_CHOICE])) return { to: 'date' };
  if (error.status === 400 && error.message.startsWith(QUESTIONS_CHANGED)) return { to: 'problem', message: error.message };
  return { to: 'stay', message: error.message };
}
```

- [ ] **Step 4: Write** `src/screens/book/send.ts`

```ts
import { apiMutate } from '@/lib/api/client.ts';
import type { BookingBody } from './details-rules.ts';

/**
 * Sending the booking (d5): POST /api/portal/:shopSlug/bookings, and turning a
 * held photo into the bare base64 the server wants (server/booking-photos.js:
 * no data: prefix, no line breaks). Read with arrayBuffer and btoa rather
 * than FileReader, which the component tests (Node) don't have.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export type BookingReply = {
  id: number;
  reference: string;
  privateLink: string;
  services: { name: string; price: number | null }[];
  totalPrice: number | null;
};

export const bookingsPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/bookings`;

export const sendBooking = (shopSlug: string, body: BookingBody) => apiMutate<BookingReply>(bookingsPath(shopSlug), body);

// String.fromCharCode takes its bytes as arguments; a whole 10 MB photo at
// once would pass the engine's argument limit.
const CHUNK = 0x8000;

export async function photoBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `npm run pretest && time node --test tests/customer/details-rules.test.js && npm run typecheck && npm run lint`
Expected: every test PASSES, the file exits in seconds, typecheck and lint are clean.

- [ ] **Step 6: Prove the tests bite.** Each time: make the mutation, confirm it in `git diff`, run `npm run pretest && node --test tests/customer/details-rules.test.js`, confirm the named test fails for the stated reason, restore, confirm `git diff` no longer shows it.
  1. In `fieldErrors`, change `(channelOf(draft) === 'email' && !email) || (email && !looksLikeEmail(email))` to `email && !looksLikeEmail(email)`. "an email is needed for Email updates, ..." must FAIL on `email({ updateChannel: 'email' })` (null).
  2. In `TIME_GONE`, delete `'That date has passed'`. "a refusal is sorted: ..." must FAIL on the "That date has passed" case (`{ to: 'stay', ... }`).
  3. In `bookingBody`, change `...(draft.startTime ? { startTime: draft.startTime } : {}),` to `startTime: draft.startTime,`. "Not sure on a drop-off day: ..." must FAIL (`startTime: undefined` present).
  4. In `photoBase64`, change `return btoa(binary);` to `return btoa(binary).replace(/(.{76})/g, '$1\n');`. "a photo is read as bare base64: ..." must FAIL.

  Re-run Step 5 to PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/book/details-rules.ts src/screens/book/send.ts tests/customer/details-rules.test.js
git commit -m "feat: the details screen's rules, the request body, refusal routes, and bare-base64 photos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The private link's data and the pending rules

**Files:**
- Create: `src/screens/book/pending-query.ts`
- Create: `src/screens/book/pending-rules.ts`
- Test: `tests/customer/pending-rules.test.js`

**Interfaces:**
- Consumes: `apiGet<T>(path)` from `@/lib/api/client.ts`; `dayLabel(date)` from `./date-rules.ts`; `formatFrom(price)`, `formatMoney(amount)` from `./service-selection.ts`.
- Produces, from `pending-query.ts` (all exported), matching `GET /api/portal/:shopSlug/booking-links/:code` (`server/server.js` ~:5096, `server/booking-link.js` `bookingStage`):
  - `type BookingStage = 'awaiting_confirmation' | 'confirmed' | 'in_workshop' | 'ready_to_collect' | 'collected' | 'change_requested' | 'declined' | 'cancelled' | 'request_expired'`
  - `type LinkAnswer = { wording: string; answer: string | { notSure: true } | null; text?: string }`
  - `type BookingLink = { reference: string; shopName: string; jobDate: string; startTime: string; description: string | null; bikeNote: string | null; answers: LinkAnswer[]; bike: { make: string | null; model: string | null } | null; stage: BookingStage; photoCount: number; services: { name: string; price: number | null }[]; totalPrice: number | null }`
  - `bookingLinkPath(shopSlug, code): string`; `useBookingLink(shopSlug, code)` (query key `['portal', shopSlug, 'booking-link', code]`)
- Produces, from `pending-rules.ts` (all exported): `STAGE_TEXT: Record<BookingStage, string>`, `statusText(stage)`, `NOT_FOUND`, `EXPIRED`, `LOAD_FAILED`, `COPIED_MS` (2000), `whenLine(link): string`, `serviceLines(link): { name: string; price: string | null }[]`, `totalLine(link): string | null`, `answerLines(link): { wording: string; answer: string }[]`, `contactLine(shopName): string`.

- [ ] **Step 1: Write the failing rules test** `tests/customer/pending-rules.test.js`

```js
// The pending screen's rules: status words, and the summary lines built from
// the private link's reply.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const BUILD = new URL('../../.test-build/screens/book/', import.meta.url);
const r = await import(new URL('pending-rules.js', BUILD).href);
const q = await import(new URL('pending-query.js', BUILD).href);

const LINK = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-10-05', startTime: '09:30',
  description: 'Squeals when braking', bikeNote: 'Blue Trek road bike', answers: [], bike: null,
  stage: 'awaiting_confirmation', photoCount: 0,
  services: [{ name: 'Brake service', price: 20 }, { name: 'Gear service', price: 25.5 }], totalPrice: 45.5,
};

test('every stage has its words', () => {
  assert.deepEqual(r.STAGE_TEXT, {
    awaiting_confirmation: 'Awaiting shop confirmation',
    confirmed: 'Confirmed',
    in_workshop: 'In the workshop',
    ready_to_collect: 'Ready to collect',
    collected: 'Collected',
    change_requested: 'Change requested',
    declined: 'Declined',
    cancelled: 'Cancelled',
    request_expired: 'Request expired',
  });
  assert.equal(r.statusText('ready_to_collect'), 'Ready to collect');
});

test('the failure headings and how long "Copied" shows', () => {
  assert.equal(r.NOT_FOUND, "We can't find that booking");
  assert.equal(r.EXPIRED, 'This link has expired');
  assert.equal(r.LOAD_FAILED, "We couldn't load this booking");
  assert.equal(r.COPIED_MS, 2000);
});

test('the day and time: a timed booking has its time, a drop-off booking the day alone', () => {
  assert.equal(r.whenLine(LINK), 'Monday 5 October, 09:30');
  assert.equal(r.whenLine({ ...LINK, startTime: '' }), 'Monday 5 October');
});

test('services with their booked prices when shown, and the total as "From £T"', () => {
  assert.deepEqual(r.serviceLines(LINK), [{ name: 'Brake service', price: '£20' }, { name: 'Gear service', price: '£25.50' }]);
  assert.equal(r.totalLine(LINK), 'From £45.50');
  const hidden = { ...LINK, services: [{ name: 'Brake service', price: null }], totalPrice: null };
  assert.deepEqual(r.serviceLines(hidden), [{ name: 'Brake service', price: null }]);
  assert.equal(r.totalLine(hidden), null);
});

test('answers read like the staff notes: the choice or "I\'m not sure", then any words; unanswered left out', () => {
  const link = {
    ...LINK,
    answers: [
      { wording: "What's wrong with the brakes?", answer: 'Squeaking', text: 'Front only' },
      { wording: 'Tubeless?', answer: 'Yes' },
      { wording: 'Which gear slips?', answer: { notSure: true } },
      { wording: 'Rattle?', answer: { notSure: true }, text: 'Somewhere at the back' },
      { wording: 'Anything else?', answer: null, text: 'Only in the rain' },
      { wording: 'Which wheel needs truing?', answer: 'The front' },
      { wording: 'Mudguards?', answer: null },
    ],
  };
  assert.deepEqual(r.answerLines(link), [
    { wording: "What's wrong with the brakes?", answer: 'Squeaking - Front only' },
    { wording: 'Tubeless?', answer: 'Yes' },
    { wording: 'Which gear slips?', answer: "I'm not sure" },
    { wording: 'Rattle?', answer: "I'm not sure - Somewhere at the back" },
    { wording: 'Anything else?', answer: 'Only in the rain' },
    { wording: 'Which wheel needs truing?', answer: 'The front' },
  ]);
});

test('the contact line names the shop', () => {
  assert.equal(r.contactLine('North Street Cycles'), 'Need to change or cancel? Contact North Street Cycles');
});

test('the address carries the shop and the code', () => {
  assert.equal(q.bookingLinkPath('north shop', 'ab12'), '/api/portal/north%20shop/booking-links/ab12');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/pending-rules.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `pending-rules.js`.

- [ ] **Step 3: Write** `src/screens/book/pending-query.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The private booking link, read back without sign-in
 * (GET /api/portal/:shopSlug/booking-links/:code, server/server.js;
 * stage from server/booking-link.js bookingStage). 404 when the code finds
 * nothing, 410 once the link has expired. Services and the total carry prices
 * only when the shop shows prices online. Answers are the frozen copy taken
 * at booking: the wording as asked, the answer (a choice or typed text,
 * { notSure: true }, or null) and, for a choice question, any typed words.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export type BookingStage =
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'in_workshop'
  | 'ready_to_collect'
  | 'collected'
  | 'change_requested'
  | 'declined'
  | 'cancelled'
  | 'request_expired';

export type LinkAnswer = { wording: string; answer: string | { notSure: true } | null; text?: string };

export type BookingLink = {
  reference: string;
  shopName: string;
  jobDate: string;
  startTime: string;
  description: string | null;
  bikeNote: string | null;
  answers: LinkAnswer[];
  bike: { make: string | null; model: string | null } | null;
  stage: BookingStage;
  photoCount: number;
  services: { name: string; price: number | null }[];
  totalPrice: number | null;
};

export const bookingLinkPath = (shopSlug: string, code: string) =>
  `/api/portal/${encodeURIComponent(shopSlug)}/booking-links/${encodeURIComponent(code)}`;

export function useBookingLink(shopSlug: string, code: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'booking-link', code],
    queryFn: () => apiGet<BookingLink>(bookingLinkPath(shopSlug, code)),
  });
}
```

- [ ] **Step 4: Write** `src/screens/book/pending-rules.ts`

```ts
import type { BookingLink, BookingStage } from './pending-query.ts';
import { dayLabel } from './date-rules.ts';
import { formatFrom, formatMoney } from './service-selection.ts';

/**
 * The pending screen's rules: the words for each stage, and the summary lines
 * built from the private link's reply. The screen only calls these.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export const STAGE_TEXT: Record<BookingStage, string> = {
  awaiting_confirmation: 'Awaiting shop confirmation',
  confirmed: 'Confirmed',
  in_workshop: 'In the workshop',
  ready_to_collect: 'Ready to collect',
  collected: 'Collected',
  change_requested: 'Change requested',
  declined: 'Declined',
  cancelled: 'Cancelled',
  request_expired: 'Request expired',
};

export const statusText = (stage: BookingStage) => STAGE_TEXT[stage];

export const NOT_FOUND = "We can't find that booking";
export const EXPIRED = 'This link has expired';
// Not in the spec (Jack approves): the heading for any other failure, above "Try again".
export const LOAD_FAILED = "We couldn't load this booking";
export const COPIED_MS = 2000;

/** "Monday 5 October, 09:30"; a drop-off booking has no start time, so the day alone. */
export function whenLine(link: BookingLink): string {
  const day = dayLabel(link.jobDate);
  return link.startTime ? `${day}, ${link.startTime}` : day;
}

/** Each booked service, with its booked price when the shop shows prices. */
export function serviceLines(link: BookingLink): { name: string; price: string | null }[] {
  return link.services.map((s) => ({ name: s.name, price: s.price === null ? null : formatMoney(s.price) }));
}

/** "From £T", when the shop shows prices and every service had one. */
export function totalLine(link: BookingLink): string | null {
  return link.totalPrice === null ? null : formatFrom(link.totalPrice);
}

/**
 * Each answered question as the staff notes word it (server/server.js
 * answerNoteLine): the choice or "I'm not sure", then " - " and any typed
 * words; words alone when there was no choice. Unanswered questions are left out.
 */
export function answerLines(link: BookingLink): { wording: string; answer: string }[] {
  const lines: { wording: string; answer: string }[] = [];
  for (const a of link.answers) {
    const picked = a.answer === null ? null : typeof a.answer === 'object' ? "I'm not sure" : a.answer;
    const words = a.text || null;
    const answer = picked && words ? `${picked} - ${words}` : picked ?? words;
    if (answer) lines.push({ wording: a.wording, answer });
  }
  return lines;
}

/** Until d6 adds changing and cancelling online. */
export const contactLine = (shopName: string) => `Need to change or cancel? Contact ${shopName}`;
```

- [ ] **Step 5: Run and watch it pass**

Run: `npm run pretest && time node --test tests/customer/pending-rules.test.js && npm run typecheck && npm run lint`
Expected: all PASS, exits in seconds, typecheck and lint clean.

- [ ] **Step 6: Prove the tests bite.** Each time: mutate, confirm in `git diff`, run `npm run pretest && node --test tests/customer/pending-rules.test.js`, confirm the named failure, restore, confirm `git diff` no longer shows it.
  1. In `answerLines`, change `const words = a.text || null;` to `const words = null;`. "answers read like the staff notes: ..." must FAIL ("Squeaking" without " - Front only", and "Anything else?" missing).
  2. In `totalLine`, change `formatFrom(link.totalPrice)` to `formatMoney(link.totalPrice)`. "services with their booked prices ..." must FAIL ("£45.50").
  3. In `whenLine`, change `return link.startTime ? \`${day}, ${link.startTime}\` : day;` to `` return `${day}, ${link.startTime}`; ``. "the day and time: ..." must FAIL on the drop-off case ("Monday 5 October, ").

  Re-run Step 5 to PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/book/pending-query.ts src/screens/book/pending-rules.ts tests/customer/pending-rules.test.js
git commit -m "feat: the private link's data and the pending screen's rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The details screen: guard, summary, fields, messages, and the terms dialog

**Files:**
- Modify: `tests/helpers/book-screen.js` (answer `/terms`, `/booking-links/`, `/bookings`; record request bodies; hold photos; start with navigation state; a `booking/:code` route; show navigation state; stub `<dialog>`)
- Install: `src/components/ui/dialog.tsx` (from `registry/primitives/dialog.tsx`, unchanged)
- Create: `src/screens/book/terms-query.ts`
- Create: `src/screens/book/details.tsx`
- Modify: `src/customer/app-shell.tsx` (`SCREENS`)
- Test: `tests/customer/details-screen.test.js`

**Interfaces:**
- Consumes:
  - from Task 1: `CHANNEL_OPTIONS`, `CHECK_ANSWERS`, `channelOf`, `dropoffWindowOn`, `emailLabel`, `fieldErrors`, `summaryLines`, `whenText`, types `ContactField`, `UpdateChannel`
  - `RequireDraft({ has, to?, children })` and `hasDate(draft)` from `./require-draft.tsx`
  - `BookFrame` with `step`, `title`, `back`, `action: { label, onClick, disabled? }`, `actionNote`; its pinned area carries `data-book-pinned`
  - `useDraft()` (`{ draft, update, photos, setPhotos, clear }`), `useServices(shopSlug)`, `useMechanics(shopSlug)`, `useAvailability(shopSlug, { start, end, minutes })`, `jobMinutes(services, draft)`
- Produces:
  - `export function DetailsScreen()`; Task 4 replaces its body and `DetailsForm`.
  - `terms-query.ts`: `type TermsResponse = { title: string; text: string; standard: boolean }`, `termsPath(shopSlug)`, `useTerms(shopSlug)` (query key `['portal', shopSlug, 'terms']`).
  - `renderBookScreen` gains options `terms`, `bookingLink`, `booking` (each a body answered with 200, or a function `(url, init) => ({ status, body })`, which may be async or throw to imitate a lost connection), `photos` (`File[]` held in the draft's memory), and `state` (the first address's navigation state). Defaults: standard terms `{ title: 'Booking terms', text: '1. Your booking is a request.', standard: true }`; `bookingLink` 404 `{ error: "We can't find that booking" }`; `booking` 201 with `privateLink: PRIVATE_LINK`. Each `requests` entry is `{ url, method, body }` (`body` parsed from JSON, or `undefined`). Routes: `''`, `services`, `problem`, `date`, `details`, `booking/:code`. Other addresses render `At <path><search>`, followed by ` <JSON state>` when the navigation carried state.
  - `export const PRIVATE_LINK = '/book/north/booking/' + 'a'.repeat(64)` from the helper.

- [ ] **Step 1: Update the helper.** Replace `tests/helpers/book-screen.js` with:

```js
// Renders one book screen in jsdom, the way the customer app mounts it: inside
// /book/:shopSlug with the booking-in-progress provider and a query client.
// Every other book address renders "At <path><search>" - followed by the
// navigation state as JSON when there is one (d5) - so a test can see where a
// screen navigated to. Shop slug is always "north".
//
// Every fetch is answered at once and recorded in `requests` ({url, method,
// body}), so a test can prove a screen sent nothing (d3) or what it sent (d5).
// /mechanics and /availability are answered from `mechanics` and
// `availability` (d4); /terms, /booking-links/<code> and /bookings from
// `terms`, `bookingLink` and `booking` (d5); everything else from `services`.
// Each is either a body (sent with 200) or a function (url, init) =>
// ({ status, body }), which may be async - a test that holds an answer back
// must release it before it ends - or may throw, which the screen sees as a
// lost connection. `photos` are held in the draft's memory (they are never
// stored). `state` is the first address's navigation state.
// scrollIntoView (missing in jsdom) is recorded in `scrolled`; <dialog>'s
// showModal and close (missing in jsdom) are stubbed.
import { installDom, importFresh } from './dom.js';

const BUILD = new URL('../../.test-build/', import.meta.url);
const NO_MECHANICS = { mechanics: [], openingTime: '09:00', closingTime: '17:00', openingDays: [] };
const NO_AVAILABILITY = { busy: [], fullDays: [], days: [] };
const STANDARD_TERMS = { title: 'Booking terms', text: '1. Your booking is a request.', standard: true };
const NO_LINK = () => ({ status: 404, body: { error: "We can't find that booking" } });
export const PRIVATE_LINK = `/book/north/booking/${'a'.repeat(64)}`;
const BOOKED = () => ({
  status: 201,
  body: { id: 1, reference: 'WH-1001', privateLink: PRIVATE_LINK, services: [], totalPrice: null },
});

export async function renderBookScreen({
  file, exportName, at, url, services, draft, mechanics = NO_MECHANICS, availability = NO_AVAILABILITY,
  terms = STANDARD_TERMS, bookingLink = NO_LINK, booking = BOOKED, photos, state,
}) {
  const uninstall = installDom(`http://localhost${url}`);
  if (draft) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(draft));
  const scrolled = [];
  // Both the frame's scroll-to-top and a screen's own ?start scrollIntoView
  // land here in call order, so a test can prove the frame's runs first (and
  // the screen's own scroll still wins the final position).
  const scrollCalls = [];
  window.scrollTo = (...args) => scrollCalls.push({ type: 'top', args });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrollCalls.push({ type: 'start', el: this });
    scrolled.push(this);
  };
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const address = String(input);
    const method = init?.method ?? 'GET';
    requests.push({ url: address, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    const { pathname } = new URL(address, 'http://localhost');
    const source = pathname.endsWith('/mechanics') ? mechanics
      : pathname.endsWith('/availability') ? availability
        : pathname.endsWith('/terms') ? terms
          : pathname.includes('/booking-links/') ? bookingLink
            : pathname.endsWith('/bookings') ? booking
              : services;
    const { status, body } = typeof source === 'function' ? await source(address, init) : { status: 200, body: source };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };

  const { render } = await import('@testing-library/react');
  const { createElement: h, useEffect } = await import('react');
  const { createMemoryRouter, RouterProvider, Outlet, useLocation, useParams } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const Screen = (await importFresh(new URL(file, BUILD).href))[exportName];
  const { DraftProvider, useDraft } = await import(new URL('screens/book/draft.js', BUILD).href);

  // Photos live in the provider's memory only, so a test hands them over once, on mount.
  function SeedPhotos() {
    const { setPhotos } = useDraft();
    useEffect(() => {
      setPhotos(photos);
    }, []);
    return null;
  }
  function Layout() {
    const { shopSlug = '' } = useParams();
    return h(DraftProvider, { shopSlug }, photos ? h(SeedPhotos) : null, h(Outlet));
  }
  function Where() {
    const l = useLocation();
    return h('p', null, `At ${l.pathname}${l.search}${l.state ? ` ${JSON.stringify(l.state)}` : ''}`);
  }
  const child = (path) => (path === '' ? { index: true } : { path });
  const routes = ['', 'services', 'problem', 'date', 'details', 'booking/:code']
    .map((p) => ({ ...child(p), Component: p === at ? Screen : Where }));
  const start = new URL(url, 'http://localhost');
  const entry = state ? { pathname: start.pathname, search: start.search, state } : url;
  const router = createMemoryRouter([{ path: '/book/:shopSlug', Component: Layout, children: routes }], { initialEntries: [entry] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(h(QueryClientProvider, { client }, h(RouterProvider, { router })));
  const readDraft = () => JSON.parse(window.sessionStorage.getItem('wh-book-draft:north') ?? '{}');
  return { ui, client, uninstall, scrolled, scrollCalls, requests, readDraft };
}
```

Then run `npm run pretest && node --test tests/customer/service-screen.test.js tests/customer/service-list-screen.test.js tests/customer/problem-screen.test.js tests/customer/date-screen.test.js` and confirm all PASS: the helper change broke nothing.

- [ ] **Step 2: Install the registry dialog, unchanged.**

Run: `npx shadcn add ./public/r/dialog.json --yes --overwrite`, then `git status --short`.
Expected: `src/components/ui/dialog.tsx` is new; nothing else changed except the untracked `.claude/launch.json`. If `package.json` or `package-lock.json` changed, run `git checkout -- package.json package-lock.json` and report it. Then run `npm run pretest && node --test tests/customer/installed-controls.test.js` and confirm "dialog has a registry source and matches it" PASSES.

- [ ] **Step 3: Write the failing screen test** `tests/customer/details-screen.test.js`

```js
// The details screen: the guard, the summary, the contact fields and the
// default update channel, each message, the email label, and the terms
// dialog. Sending is tested in the second half of this file (Task 4).
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen, PRIVATE_LINK } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const choiceQ = (id, wording, choices) => ({ id, wording, kind: 'choice', required: true, choices, allowNotSure: true });
const SERVICES = {
  shopName: 'North Street Cycles', showPrices: true, full: [], categories: [],
  uncategorised: [
    { id: 11, name: 'Brake service', price: 20, minutes: 30, questions: [choiceQ('b1', "What's wrong with the brakes?", ['Squeaking', 'Not stopping well'])] },
    { id: 12, name: 'Gear service', price: 25, minutes: 45, questions: [] },
  ],
};
const MECHANICS = {
  mechanics: [{ id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] }, { id: 2, name: 'Jo', workingDays: [1, 2, 3, 4, 5] }],
  openingTime: '09:00', closingTime: '17:00', openingDays: [1, 2, 3, 4, 5],
};
const AVAILABILITY = {
  busy: [], fullDays: [],
  days: [{ date: '2026-10-06', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' }, mechanics: [{ mechanicId: 2, bookable: true }] }],
};
const TIMED = {
  serviceIds: [11, 12], answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking' }], bikeNote: 'Blue Trek road bike',
  date: '2026-10-05', mechanicId: 1, startTime: '09:30',
};
const DROPOFF = {
  notSure: true, serviceIds: [], answers: [], description: 'Clicks when pedalling', date: '2026-10-06', mechanicId: 2, anyMechanic: true,
};
const CONTACT = { name: 'Gina Guest', phone: '07700 900123' };
const CHECK = 'Please check the answers marked above';

const open = async ({ draft = TIMED, ...rest } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/details.js', exportName: 'DetailsScreen', at: 'details', url: '/book/north/details',
    services: SERVICES, mechanics: MECHANICS, availability: AVAILABILITY, draft, ...rest,
  });
  await current.ui.findByRole('heading', { level: 1, name: 'How can we reach you?' });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => (await rtl()).fireEvent.click(el);
const type = async (el, value) => (await rtl()).fireEvent.change(el, { target: { value } });
const pinned = () => document.querySelector('[data-book-pinned]');
const describedText = (el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? null;
const press = async (ui) => click(ui.getByRole('button', { name: 'Request booking' }));
const posts = (requests) => requests.filter((r) => r.method === 'POST');

test('step 4, the heading, and Back goes to the date screen', async () => {
  const { ui } = await open();
  assert.ok(ui.getByText('Step 4 of 4'));
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north/date'));
});

test('without a day and a mechanic it goes back to the date screen', async () => {
  current = await renderBookScreen({
    file: 'screens/book/details.js', exportName: 'DetailsScreen', at: 'details', url: '/book/north/details',
    services: SERVICES, mechanics: MECHANICS, draft: { serviceIds: [12] },
  });
  assert.ok(await current.ui.findByText('At /book/north/date'));
});

test('the summary: services, day, time and mechanic, the price, and the bike note', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByText('Monday 5 October, 09:30 with Alex'));
  assert.ok(ui.getByText('Brake service, Gear service'));
  assert.ok(ui.getByText('From £45'));
  assert.ok(ui.getByText('Blue Trek road bike'));
});

test("Not sure on a drop-off day: \"Not sure\", that day's drop-off window, and no price", async () => {
  const { ui, requests } = await open({ draft: DROPOFF });
  assert.ok(await ui.findByText('Tuesday 6 October, drop off 08:30–10:00'));
  assert.ok(ui.getByText('Not sure'));
  assert.equal(ui.queryByText(/^From £/), null);
  assert.ok(requests.some((r) => r.url === '/api/portal/north/availability?start=2026-10-06&end=2026-10-06&minutes=60'), JSON.stringify(requests));
});

test('the fields start empty with Text message chosen, and typing saves to the draft', async () => {
  const { ui, readDraft } = await open();
  const name = ui.getByRole('textbox', { name: 'Your name' });
  const phone = ui.getByRole('textbox', { name: 'Mobile number' });
  assert.equal(name.value, '');
  assert.equal(phone.value, '');
  assert.equal(phone.getAttribute('type'), 'tel');
  const { within } = await rtl();
  const radios = within(ui.getByRole('group', { name: 'How should we send updates?' })).getAllByRole('radio');
  assert.deepEqual(radios.map((r) => [r.closest('label').textContent, r.checked]), [['Text message', true], ['WhatsApp', false], ['Email', false]]);
  assert.equal(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }).checked, false);
  await type(name, 'Gina Guest');
  await type(phone, '07700 900123');
  await click(ui.getByRole('radio', { name: 'WhatsApp' }));
  await click(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }));
  const saved = readDraft();
  assert.deepEqual([saved.name, saved.phone, saved.updateChannel, saved.termsAccepted], ['Gina Guest', '07700 900123', 'whatsapp', true]);
});

test('the email is optional until Email is chosen', async () => {
  const { ui, readDraft } = await open();
  assert.equal(ui.getByRole('textbox', { name: 'Email (optional)' }).getAttribute('aria-required'), null);
  await click(ui.getByRole('radio', { name: 'Email' }));
  assert.equal(readDraft().updateChannel, 'email');
  assert.equal(ui.getByRole('textbox', { name: 'Email' }).getAttribute('aria-required'), 'true');
  assert.equal(ui.queryByRole('textbox', { name: 'Email (optional)' }), null);
});

test('Request booking with nothing filled in: each message under its field, a note in the pinned area, focus on the name, nothing sent', async () => {
  const { ui, requests } = await open();
  await press(ui);
  const name = ui.getByRole('textbox', { name: 'Your name' });
  assert.equal(describedText(name), 'Please enter your name');
  assert.equal(name.getAttribute('aria-invalid'), 'true');
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Mobile number' })), 'Please enter your mobile number');
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Email (optional)' })), null, 'no email needed for text messages');
  assert.equal(describedText(ui.getByRole('checkbox', { name: 'I agree to the booking terms' })), 'Please accept the booking terms');
  const { within } = await rtl();
  assert.equal(within(pinned()).getByRole('alert').textContent, CHECK);
  assert.ok(document.activeElement === name, 'focus is not on the name');
  assert.equal(posts(requests).length, 0);
  assert.equal(ui.queryByText(/^At /), null);
});

test('the first problem gets the focus', async () => {
  const { ui } = await open({ draft: { ...TIMED, name: 'Gina Guest' } });
  await press(ui);
  assert.ok(document.activeElement === ui.getByRole('textbox', { name: 'Mobile number' }));
});

test('an email that is not an email address, or none when Email is chosen, is refused', async () => {
  const { ui } = await open({ draft: { ...TIMED, ...CONTACT, termsAccepted: true, email: 'gina@' } });
  await press(ui);
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Email (optional)' })), 'Please enter a valid email address');
  assert.ok(document.activeElement === ui.getByRole('textbox', { name: 'Email (optional)' }));
  await type(ui.getByRole('textbox', { name: 'Email (optional)' }), '');
  await click(ui.getByRole('radio', { name: 'Email' }));
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Email' })), 'Please enter a valid email address');
  await type(ui.getByRole('textbox', { name: 'Email' }), 'gina@example.com');
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Email' })), null);
});

test('each message goes as soon as its field is fixed, and the pinned note with the last', async () => {
  const { ui } = await open();
  await press(ui);
  await type(ui.getByRole('textbox', { name: 'Your name' }), 'Gina Guest');
  assert.equal(ui.queryByText('Please enter your name'), null);
  await type(ui.getByRole('textbox', { name: 'Mobile number' }), '07700 900123');
  await click(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }));
  assert.equal(ui.queryByText('Please accept the booking terms'), null);
  assert.equal(ui.queryByText(CHECK), null);
});

test('"booking terms" opens the terms in a dialog on the same screen, without ticking the box', async () => {
  const { ui, requests } = await open();
  assert.equal(requests.some((r) => r.url.endsWith('/terms')), false, 'the terms are fetched before they are opened');
  await click(ui.getByRole('button', { name: 'booking terms' }));
  const dialog = await ui.findByRole('dialog', { name: 'Booking terms' });
  const { within } = await rtl();
  assert.ok(await within(dialog).findByText('1. Your booking is a request.'));
  assert.equal(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }).checked, false);
  assert.ok(requests.some((r) => r.url === '/api/portal/north/terms'), JSON.stringify(requests));
  await click(within(dialog).getByRole('button', { name: 'Close' }));
  assert.equal(ui.queryByRole('dialog'), null);
  assert.ok(ui.getByRole('heading', { level: 1, name: 'How can we reach you?' }));
});

test('if the terms fail to load, the dialog says so and Try again asks again', async () => {
  let calls = 0;
  const terms = () => (++calls === 1
    ? { status: 500, body: { error: 'Something went wrong' } }
    : { status: 200, body: { title: 'Booking terms', text: '1. Your booking is a request.', standard: true } });
  const { ui } = await open({ terms });
  await click(ui.getByRole('button', { name: 'booking terms' }));
  assert.ok(await ui.findByText("We couldn't load the booking terms"));
  await click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await ui.findByText('1. Your booking is a request.'));
  assert.equal(calls, 2);
});
```

(`PRIVATE_LINK` and `posts` are used by Task 4's tests, appended to this file.)

- [ ] **Step 4: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/details-screen.test.js`
Expected: every test FAILS with `ERR_MODULE_NOT_FOUND` from `importFresh` (`.test-build/screens/book/details.js` doesn't exist).

- [ ] **Step 5: Write** `src/screens/book/terms-query.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The booking terms a customer agrees to (server piece 11,
 * GET /api/portal/:shopSlug/terms): the shop's own when it has set them, else
 * the standard Wheelhouse terms; `standard` says which. Plain text, a line
 * break between items. A copy is saved with each booking by the server.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export type TermsResponse = { title: string; text: string; standard: boolean };

export const termsPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/terms`;

export function useTerms(shopSlug: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'terms'],
    queryFn: () => apiGet<TermsResponse>(termsPath(shopSlug)),
  });
}
```

- [ ] **Step 6: Write** `src/screens/book/details.tsx`

```tsx
import * as React from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { PillGroup } from '@/components/ui/pill-group';
import { BookFrame } from './frame.tsx';
import { useDraft, type BookingDraft } from './draft.tsx';
import { RequireDraft, hasDate } from './require-draft.tsx';
import { useServices, type ServicesResponse } from './services-query.ts';
import { useAvailability, useMechanics } from './date-query.ts';
import { jobMinutes } from './date-rules.ts';
import { useTerms } from './terms-query.ts';
import {
  CHANNEL_OPTIONS, CHECK_ANSWERS, channelOf, dropoffWindowOn, emailLabel, fieldErrors, summaryLines, whenText,
  type ContactField, type UpdateChannel,
} from './details-rules.ts';

/**
 * The details screen (atlas `details`, step 4): a summary of the booking, the
 * customer's name, mobile number, how to send updates (one channel, Text
 * message by default), an email (required only for Email updates), and the
 * booking terms, which open in a dialog on the same screen. Everything is
 * written to the draft as it changes. Request booking checks the fields.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
const TITLE = 'How can we reach you?';

export function DetailsScreen() {
  const { shopSlug = '' } = useParams();
  const { data } = useServices(shopSlug);
  const back = `/book/${shopSlug}/date`;
  // As on date: the guard waits for /services, and until then only the
  // frame shows (its own loading and failed states).
  if (!data) return <BookFrame step={4} title={TITLE} back={back}>{null}</BookFrame>;
  return (
    <RequireDraft has={hasDate} to="date">
      <DetailsForm services={data} back={back} />
    </RequireDraft>
  );
}

type FormProps = { services: ServicesResponse; back: string };

function DetailsForm({ services, back }: FormProps) {
  const { draft, update } = useDraft();
  const base = React.useId();
  // Messages show only after a press, then follow the draft, so each goes as
  // soon as it is fixed.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed press so the pinned alert is a new node and is
  // announced again (as on the earlier screens).
  const [attempt, setAttempt] = React.useState(0);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const ids: Record<ContactField, string> = {
    name: `${base}-name`, phone: `${base}-phone`, email: `${base}-email`, terms: `${base}-terms`,
  };
  const channel = channelOf(draft);
  const problems = checked ? fieldErrors(draft) : [];
  const errorFor = (field: ContactField) => problems.find((p) => p.field === field)?.message ?? null;
  const termsError = errorFor('terms');

  const onRequest = () => {
    const now = fieldErrors(draft);
    if (now.length > 0) {
      setChecked(true);
      setAttempt((a) => a + 1);
      document.getElementById(ids[now[0].field])?.focus();
    }
  };

  return (
    <BookFrame
      step={4}
      title={TITLE}
      back={back}
      action={{ label: 'Request booking', onClick: onRequest }}
      actionNote={
        problems.length > 0 ? (
          <p key={attempt} role="alert" className="m-0 text-[var(--wh-danger)]">{CHECK_ANSWERS}</p>
        ) : undefined
      }
    >
      <Summary services={services} draft={draft} />
      <TextField id={ids.name} label="Your name" autoComplete="name" required value={draft.name}
        error={errorFor('name')} onChange={(name) => update({ name })} />
      <TextField id={ids.phone} label="Mobile number" type="tel" autoComplete="tel" required value={draft.phone}
        error={errorFor('phone')} onChange={(phone) => update({ phone })} />
      <PillGroup
        legend="How should we send updates?"
        options={CHANNEL_OPTIONS}
        value={channel}
        onChange={(value) => update({ updateChannel: value as UpdateChannel })}
        className="mb-3"
      />
      <TextField id={ids.email} label={emailLabel(channel)} type="email" autoComplete="email" required={channel === 'email'}
        value={draft.email} error={errorFor('email')} onChange={(email) => update({ email })} />
      <Field>
        <Checkbox
          id={ids.terms}
          checked={draft.termsAccepted === true}
          aria-invalid={termsError ? true : undefined}
          aria-describedby={termsError ? `${ids.terms}-error` : undefined}
          onChange={(e) => update({ termsAccepted: e.target.checked || undefined })}
          label={
            <>
              I agree to the{' '}
              {/* A button inside the label opens the terms without ticking the box. */}
              <button type="button" className="text-[var(--accent-dark)] underline" onClick={() => setTermsOpen(true)}>
                booking terms
              </button>
            </>
          }
        />
        {termsError && <FieldError id={`${ids.terms}-error`}>{termsError}</FieldError>}
      </Field>
      <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
    </BookFrame>
  );
}

type SummaryProps = { services: ServicesResponse; draft: BookingDraft };

function Summary({ services, draft }: SummaryProps) {
  // A drop-off day stores no start time (d4).
  return draft.startTime === undefined
    ? <DropoffSummary services={services} draft={draft} />
    : <TimedSummary services={services} draft={draft} />;
}

function TimedSummary({ services, draft }: SummaryProps) {
  const { shopSlug = '' } = useParams();
  const mechanics = useMechanics(shopSlug);
  return <SummaryBox lines={summaryLines(services, draft, whenText(draft, mechanics.data?.mechanics))} />;
}

function DropoffSummary({ services, draft }: SummaryProps) {
  const { shopSlug = '' } = useParams();
  const date = draft.date ?? '';
  // That day alone, for its drop-off window.
  const availability = useAvailability(shopSlug, { start: date, end: date, minutes: jobMinutes(services, draft) });
  const dropoff = availability.data ? dropoffWindowOn(availability.data, date) : undefined;
  return <SummaryBox lines={summaryLines(services, draft, whenText(draft, undefined, dropoff))} />;
}

function SummaryBox({ lines }: { lines: string[] }) {
  return (
    <div className="mb-4 rounded-md border border-[var(--wh-border)] p-3 text-sm">
      {lines.map((line, i) => <p key={i} className="m-0">{line}</p>)}
    </div>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  value: string | undefined;
  error: string | null;
  onChange: (value: string | undefined) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
};

function TextField({ id, label, value, error, onChange, type = 'text', autoComplete, required }: TextFieldProps) {
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value ?? ''}
        aria-required={required ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

function TermsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const titleId = React.useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={titleId}>
      {/* Fetched only once opened. */}
      {open && <TermsContent titleId={titleId} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function TermsContent({ titleId, onClose }: { titleId: string; onClose: () => void }) {
  const { shopSlug = '' } = useParams();
  const terms = useTerms(shopSlug);
  return (
    <>
      <DialogHeader>
        {/* The server's title once loaded (piece 11 always sends "Booking terms"). */}
        <DialogTitle id={titleId}>{terms.data?.title ?? 'Booking terms'}</DialogTitle>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody>
        {terms.data ? (
          <p className="m-0 whitespace-pre-line text-sm">{terms.data.text}</p>
        ) : terms.isError ? (
          <>
            <p role="alert" className="m-0 mb-3">{"We couldn't load the booking terms"}</p>
            <Button variant="accent" onClick={() => void terms.refetch()}>Try again</Button>
          </>
        ) : (
          <p role="status" className="m-0">Loading…</p>
        )}
      </DialogBody>
    </>
  );
}
```

Then in `src/customer/app-shell.tsx` add `import { DetailsScreen } from '@/screens/book/details.tsx';` after the `DateScreen` import, and `details: DetailsScreen,` to `SCREENS` after `date: DateScreen,`.

- [ ] **Step 7: Run and watch it pass**

Run: `npm run pretest && time node --test tests/customer/details-screen.test.js tests/customer/installed-controls.test.js tests/screens/customer-app-shell.test.js && npm run typecheck && npm run lint`
Expected: all PASS, `details-screen.test.js` exits in seconds, typecheck and lint clean.

- [ ] **Step 8: Prove three tests bite.** Each time: mutate, confirm in `git diff`, run `npm run pretest && node --test tests/customer/details-screen.test.js`, confirm the named failure, restore, confirm `git diff` no longer shows it.
  1. In `details-rules.ts` `emailLabel`, change `(channel === 'email' ? 'Email' : 'Email (optional)')` to `'Email (optional)'`. "the email is optional until Email is chosen" must FAIL (no textbox named "Email").
  2. In `onRequest`, delete `document.getElementById(ids[now[0].field])?.focus();`. "Request booking with nothing filled in: ..." must FAIL with "focus is not on the name".
  3. In `TermsDialog`, change `{open && <TermsContent titleId={titleId} onClose={() => onOpenChange(false)} />}` to `<TermsContent titleId={titleId} onClose={() => onOpenChange(false)} />`. '"booking terms" opens the terms ...' must FAIL with "the terms are fetched before they are opened".

  Re-run Step 7 to PASS.

- [ ] **Step 9: Commit**

```bash
git add tests/helpers/book-screen.js src/components/ui/dialog.tsx src/screens/book/terms-query.ts src/screens/book/details.tsx src/customer/app-shell.tsx tests/customer/details-screen.test.js
git commit -m "feat: the details screen - summary, contact fields, update channel, terms dialog, messages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sending the booking: photos question, sending state, success, and refusals

**Files:**
- Modify: `src/screens/book/details.tsx` (imports, `DetailsScreen`, `DetailsForm`; add `PhotosQuestion`)
- Test: `tests/customer/details-screen.test.js` (append)

**Interfaces:**
- Consumes:
  - from Task 1: `bookingBody`, `refusalRoute`, `PHOTOS_QUESTION`, type `SendRefusalState`; `sendBooking(shopSlug, body)`, `photoBase64(file)` from `./send.ts`
  - `apiGet`, `servicesPath(shopSlug)`, `photosCleared(draft, photoCount)` from `./problem-rules.ts`, `useQueryClient` from `@tanstack/react-query`, `Navigate` from `react-router`
  - `DialogFooter` from `@/components/ui/dialog`
  - the helper's `booking` option and `PRIVATE_LINK` (Task 3)
- Produces: a valid Request booking sends the booking; on success the draft (photos included) is cleared and the customer goes to the reply's `privateLink` (replacing details in history); a time gone clears `date`/`mechanicId`/`startTime`/`anyMechanic` and goes to `/book/<shop>/date` with state `{ timeTaken: true }`; changed questions go to `/book/<shop>/problem` with state `{ questionsChanged: <message> }`; any other failure shows its message in the pinned area. Task 5 makes `date` and `problem` show those states.

- [ ] **Step 1: Write the failing tests.** Append to `tests/customer/details-screen.test.js`:

```js
// Sending (Task 4).
const READY = { ...TIMED, ...CONTACT, termsAccepted: true };
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const pngFile = () => new File([PNG], 'brake.png', { type: 'image/png' });
const refuse = (status, error, extra = {}) => () => ({ status, body: { error, ...extra } });
const DATE_STATE = 'At /book/north/date {"timeTaken":true}';
const CHANGED = 'The questions for this service have changed — please check them and try again';

test('a good request reads the services again, then sends the booking', async () => {
  const { ui, requests } = await open({ draft: READY });
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  const i = requests.findIndex((r) => r.method === 'POST');
  assert.equal(`${requests[i - 1].method} ${requests[i - 1].url}`, 'GET /api/portal/north/services');
  assert.equal(requests[i].url, '/api/portal/north/bookings');
  assert.deepEqual(requests[i].body, {
    serviceIds: [11, 12], answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking' }],
    bikeNote: 'Blue Trek road bike', photos: [],
    jobDate: '2026-10-05', mechanicId: 1, startTime: '09:30',
    guestName: 'Gina Guest', guestPhone: '07700 900123', updateChannel: 'sms', termsAccepted: true,
  });
});

test('answers are cleaned against the services read just before sending', async () => {
  let fresh = false;
  const reworded = {
    ...SERVICES,
    uncategorised: [
      { ...SERVICES.uncategorised[0], questions: [choiceQ('b1', "What's wrong with the brakes?", ['Squeal', 'Not stopping well'])] },
      SERVICES.uncategorised[1],
    ],
  };
  const services = () => ({ status: 200, body: fresh ? reworded : SERVICES });
  const { ui, requests } = await open({ draft: READY, services });
  fresh = true;
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.deepEqual(posts(requests)[0].body.answers, []);
});

test('Not sure on a drop-off day sends notSure, the description, no answers or start time, and the email', async () => {
  const draft = { ...DROPOFF, ...CONTACT, termsAccepted: true, updateChannel: 'email', email: 'gina@example.com' };
  const { ui, requests } = await open({ draft });
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.deepEqual(posts(requests)[0].body, {
    notSure: true, description: 'Clicks when pedalling', photos: [], jobDate: '2026-10-06', mechanicId: 2,
    guestName: 'Gina Guest', guestPhone: '07700 900123', email: 'gina@example.com', updateChannel: 'email', termsAccepted: true,
  });
});

test('photos held in memory are sent as bare base64', async () => {
  const { ui, requests } = await open({ draft: { ...READY, hadPhotos: true }, photos: [pngFile()] });
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.deepEqual(posts(requests)[0].body.photos, [{ dataBase64: Buffer.from(PNG).toString('base64') }]);
});

test('while sending, the button reads "Sending…" and cannot be pressed again', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const booking = async () => {
    await gate;
    return { status: 201, body: { id: 1, reference: 'WH-1001', privateLink: PRIVATE_LINK, services: [], totalPrice: null } };
  };
  const { ui, requests } = await open({ draft: READY, booking });
  await press(ui);
  const sending = await ui.findByRole('button', { name: 'Sending…' });
  assert.equal(sending.disabled, true);
  await click(sending);
  release();
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.equal(posts(requests).length, 1);
});

test('success clears the draft and opens the private link', async () => {
  const { ui } = await open({ draft: { ...READY, hadPhotos: true }, photos: [pngFile()] });
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), null);
});

test('photos cleared by a refresh: the question, and "Add photos" goes back to problem without sending', async () => {
  const { ui, requests } = await open({ draft: { ...READY, hadPhotos: true } });
  await press(ui);
  const dialog = await ui.findByRole('dialog', { name: 'Your photos were cleared - add them again, or send without them?' });
  const { within } = await rtl();
  await click(within(dialog).getByRole('button', { name: 'Add photos' }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  assert.equal(posts(requests).length, 0);
});

test('"Send without photos" sends with none', async () => {
  const { ui, requests } = await open({ draft: { ...READY, hadPhotos: true } });
  await press(ui);
  const dialog = await ui.findByRole('dialog', { name: 'Your photos were cleared - add them again, or send without them?' });
  const { within } = await rtl();
  await click(within(dialog).getByRole('button', { name: 'Send without photos' }));
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.deepEqual(posts(requests)[0].body.photos, []);
});

test('a capacity refusal clears the day, mechanic and time, keeps everything else, and goes to date', async () => {
  const booking = refuse(409, 'That mechanic does not have enough free time that day - please choose another day, or a shorter job.', { code: 'capacity' });
  const { ui, readDraft } = await open({ draft: { ...DROPOFF, ...CONTACT, termsAccepted: true }, booking });
  await press(ui);
  assert.ok(await ui.findByText(DATE_STATE));
  const saved = readDraft();
  assert.deepEqual([saved.date, saved.mechanicId, saved.startTime, saved.anyMechanic], [undefined, undefined, undefined, undefined]);
  assert.deepEqual([saved.name, saved.phone, saved.description, saved.termsAccepted], ['Gina Guest', '07700 900123', 'Clicks when pedalling', true]);
});

for (const error of [
  'That time is no longer available - please choose another.',
  "That's too soon for the shop - please choose a later time or day.",
  'That date has passed - please choose another day.',
  'That mechanic is unavailable at that time - please choose another time or day.',
]) {
  test(`"${error}" goes back to date`, async () => {
    const { ui, readDraft } = await open({ draft: READY, booking: refuse(400, error) });
    await press(ui);
    assert.ok(await ui.findByText(DATE_STATE));
    assert.equal(readDraft().startTime, undefined);
  });
}

test("changed questions go back to problem with the server's message", async () => {
  const { ui } = await open({ draft: READY, booking: refuse(400, CHANGED) });
  await press(ui);
  assert.ok(await ui.findByText(`At /book/north/problem ${JSON.stringify({ questionsChanged: CHANGED })}`));
});

const staysWith = async (booking, message) => {
  const { ui, readDraft } = await open({ draft: READY, booking });
  await press(ui);
  const { within } = await rtl();
  const alert = await within(pinned()).findByRole('alert');
  assert.equal(alert.textContent, message);
  assert.equal(ui.getByRole('button', { name: 'Request booking' }).disabled, false);
  assert.equal(ui.queryByText(/^At /), null);
  assert.equal(readDraft().startTime, '09:30', 'the choice is kept');
};

test('too many requests: the message on the details screen', async () => {
  await staysWith(refuse(429, 'Too many booking requests from this network - please try again later.'),
    'Too many booking requests from this network - please try again later.');
});

test('no response: asks the customer to check their connection', async () => {
  await staysWith(() => { throw new TypeError('Failed to fetch'); },
    "We couldn't send your booking - please check your connection and try again");
});

test("any other refusal: the server's message on the details screen", async () => {
  await staysWith(refuse(400, "Please answer: What's wrong with the brakes?"), "Please answer: What's wrong with the brakes?");
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run pretest && node --test tests/customer/details-screen.test.js`
Expected: the Task 3 tests PASS. Every new test FAILS: pressing Request booking with valid fields sends nothing, so `findByText('At /book/north/booking/…')`, `findByRole('dialog', …)`, `findByText(DATE_STATE)` and the pinned alert all time out.

- [ ] **Step 3: Implement** in `src/screens/book/details.tsx`.
  - Replace the whole import block (from `import * as React from 'react';` down to the `} from './details-rules.ts';` line) with:

```tsx
import * as React from 'react';
import { Navigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { PillGroup } from '@/components/ui/pill-group';
import { BookFrame } from './frame.tsx';
import { useDraft, type BookingDraft } from './draft.tsx';
import { RequireDraft, hasDate } from './require-draft.tsx';
import { servicesPath, useServices, type ServicesResponse } from './services-query.ts';
import { useAvailability, useMechanics } from './date-query.ts';
import { jobMinutes } from './date-rules.ts';
import { photosCleared } from './problem-rules.ts';
import { useTerms } from './terms-query.ts';
import { photoBase64, sendBooking } from './send.ts';
import {
  CHANNEL_OPTIONS, CHECK_ANSWERS, PHOTOS_QUESTION, bookingBody, channelOf, dropoffWindowOn, emailLabel, fieldErrors,
  refusalRoute, summaryLines, whenText, type ContactField, type SendRefusalState, type UpdateChannel,
} from './details-rules.ts';
```

  - In the doc comment above `const TITLE`, replace the last sentence `Request booking checks the fields.` with: `Request booking checks the fields, asks about photos a refresh cleared, and sends the booking; the outcome decides where the customer goes next.`
  - Replace `export function DetailsScreen() { ... }` and `type FormProps ...` and the whole `function DetailsForm(...) { ... }` (everything from `export function DetailsScreen() {` down to the closing `}` of `DetailsForm`, just before `type SummaryProps`) with:

```tsx
type Exit = { to: string; state?: SendRefusalState; replace?: boolean };

export function DetailsScreen() {
  const { shopSlug = '' } = useParams();
  const { data } = useServices(shopSlug);
  const [exit, setExit] = React.useState<Exit | null>(null);
  const back = `/book/${shopSlug}/date`;
  // Where sending leaves the customer is decided here, above the guard:
  // sending clears the draft (or its date), and the guard would otherwise
  // redirect to date first.
  if (exit) return <Navigate to={exit.to} state={exit.state} replace={exit.replace} />;
  // As on date: the guard waits for /services, and until then only the
  // frame shows (its own loading and failed states).
  if (!data) return <BookFrame step={4} title={TITLE} back={back}>{null}</BookFrame>;
  return (
    <RequireDraft has={hasDate} to="date">
      <DetailsForm services={data} back={back} onExit={setExit} />
    </RequireDraft>
  );
}

type FormProps = { services: ServicesResponse; back: string; onExit: (exit: Exit) => void };

function DetailsForm({ services, back, onExit }: FormProps) {
  const { shopSlug = '' } = useParams();
  const queryClient = useQueryClient();
  const { draft, update, photos, clear } = useDraft();
  const base = React.useId();
  // Messages show only after a press, then follow the draft, so each goes as
  // soon as it is fixed.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed press or send so the pinned alert is a new node and
  // is announced again (as on the earlier screens).
  const [attempt, setAttempt] = React.useState(0);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [askPhotos, setAskPhotos] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const ids: Record<ContactField, string> = {
    name: `${base}-name`, phone: `${base}-phone`, email: `${base}-email`, terms: `${base}-terms`,
  };
  const channel = channelOf(draft);
  const problems = checked ? fieldErrors(draft) : [];
  const errorFor = (field: ContactField) => problems.find((p) => p.field === field)?.message ?? null;
  const termsError = errorFor('terms');
  const note = problems.length > 0 ? CHECK_ANSWERS : sendError;

  const send = async () => {
    setSending(true);
    setSendError(null);
    try {
      // The shop can edit its questions between problem and now, so the
      // answers are cleaned against a fresh copy. Read outside React Query
      // so a failed read can't put the frame into its failed state; the copy
      // then replaces the cached one.
      const fresh = await apiGet<ServicesResponse>(servicesPath(shopSlug));
      queryClient.setQueryData(['portal', shopSlug, 'services'], fresh);
      const photoData = await Promise.all(photos.map(photoBase64));
      const reply = await sendBooking(shopSlug, bookingBody(fresh, draft, photoData));
      clear();
      onExit({ to: reply.privateLink, replace: true });
    } catch (err) {
      const route = refusalRoute(err);
      if (route.to === 'date') {
        update({ date: undefined, mechanicId: undefined, startTime: undefined, anyMechanic: undefined });
        onExit({ to: `/book/${shopSlug}/date`, state: { timeTaken: true } });
      } else if (route.to === 'problem') {
        onExit({ to: `/book/${shopSlug}/problem`, state: { questionsChanged: route.message } });
      } else {
        setSending(false);
        setSendError(route.message);
        setAttempt((a) => a + 1);
      }
    }
  };

  const onRequest = () => {
    const now = fieldErrors(draft);
    if (now.length > 0) {
      setChecked(true);
      setSendError(null);
      setAttempt((a) => a + 1);
      document.getElementById(ids[now[0].field])?.focus();
      return;
    }
    if (photosCleared(draft, photos.length)) {
      setAskPhotos(true);
      return;
    }
    void send();
  };

  const sendWithoutPhotos = () => {
    setAskPhotos(false);
    // Answered: don't ask again if this send fails and is tried again.
    update({ hadPhotos: undefined });
    void send();
  };

  return (
    <BookFrame
      step={4}
      title={TITLE}
      back={back}
      action={{ label: sending ? 'Sending…' : 'Request booking', onClick: onRequest, disabled: sending }}
      actionNote={
        note ? <p key={attempt} role="alert" className="m-0 text-[var(--wh-danger)]">{note}</p> : undefined
      }
    >
      <Summary services={services} draft={draft} />
      <TextField id={ids.name} label="Your name" autoComplete="name" required value={draft.name}
        error={errorFor('name')} onChange={(name) => update({ name })} />
      <TextField id={ids.phone} label="Mobile number" type="tel" autoComplete="tel" required value={draft.phone}
        error={errorFor('phone')} onChange={(phone) => update({ phone })} />
      <PillGroup
        legend="How should we send updates?"
        options={CHANNEL_OPTIONS}
        value={channel}
        onChange={(value) => update({ updateChannel: value as UpdateChannel })}
        className="mb-3"
      />
      <TextField id={ids.email} label={emailLabel(channel)} type="email" autoComplete="email" required={channel === 'email'}
        value={draft.email} error={errorFor('email')} onChange={(email) => update({ email })} />
      <Field>
        <Checkbox
          id={ids.terms}
          checked={draft.termsAccepted === true}
          aria-invalid={termsError ? true : undefined}
          aria-describedby={termsError ? `${ids.terms}-error` : undefined}
          onChange={(e) => update({ termsAccepted: e.target.checked || undefined })}
          label={
            <>
              I agree to the{' '}
              {/* A button inside the label opens the terms without ticking the box. */}
              <button type="button" className="text-[var(--accent-dark)] underline" onClick={() => setTermsOpen(true)}>
                booking terms
              </button>
            </>
          }
        />
        {termsError && <FieldError id={`${ids.terms}-error`}>{termsError}</FieldError>}
      </Field>
      <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
      <PhotosQuestion
        open={askPhotos}
        onOpenChange={setAskPhotos}
        onAdd={() => onExit({ to: `/book/${shopSlug}/problem` })}
        onSendWithout={sendWithoutPhotos}
      />
    </BookFrame>
  );
}

type PhotosQuestionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onSendWithout: () => void;
};

/** Photos live in memory only, so a refresh after adding them loses them (d3). */
function PhotosQuestion({ open, onOpenChange, onAdd, onSendWithout }: PhotosQuestionProps) {
  const questionId = React.useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={questionId}>
      {open && (
        <>
          <DialogBody>
            <p id={questionId} className="m-0">{PHOTOS_QUESTION}</p>
          </DialogBody>
          <DialogFooter>
            <Button onClick={onAdd}>Add photos</Button>
            <Button variant="accent" onClick={onSendWithout}>Send without photos</Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `npm run pretest && time node --test tests/customer/details-screen.test.js && npm run typecheck && npm run lint`
Expected: all PASS, the file exits in seconds, typecheck and lint clean (no `react-hooks/set-state-in-effect` error).

- [ ] **Step 5: Prove the tests bite.** Each time: mutate, confirm in `git diff`, run `npm run pretest && node --test tests/customer/details-screen.test.js`, confirm the named failure, restore, confirm `git diff` no longer shows it.
  1. In `send`, change `bookingBody(fresh, draft, photoData)` to `bookingBody(services, draft, photoData)`. "answers are cleaned against the services read just before sending" must FAIL (the stale "Squeaking" answer is sent).
  2. In the `action` prop, delete `, disabled: sending`. 'while sending, the button reads "Sending…" ...' must FAIL (`disabled` false, and two POSTs).
  3. In the `route.to === 'date'` branch, delete the `update({ date: undefined, ... });` line. "a capacity refusal clears the day, ..." must FAIL on the cleared fields.
  4. In `send`, delete `clear();`. "success clears the draft and opens the private link" must FAIL (the stored draft is not `null`).

  Re-run Step 4 to PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/details.tsx tests/customer/details-screen.test.js
git commit -m "feat: send the booking - fresh answers, bare-base64 photos, photos question, refusal routes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The date and problem screens show why a booking came back

**Files:**
- Modify: `src/screens/book/date.tsx` (`DatePicker`, imports)
- Modify: `src/screens/book/problem.tsx` (`ProblemForm`, imports)
- Test: `tests/customer/date-screen.test.js`, `tests/customer/problem-screen.test.js` (append)

**Interfaces:**
- Consumes: `SendRefusalState`, `TIME_TAKEN_MESSAGE` from `./details-rules.ts` (Task 1); the navigation state Task 4 sends (`{ timeTaken: true }` to date, `{ questionsChanged }` to problem); the helper's `state` option (Task 3).
- Produces: `date` shows "Sorry, that time was booked while you were filling in your details - please choose another" above the calendar until the next pick (a day, a time, or a drop-off mechanic); `problem` shows the server's message above the bike box while the customer is on the screen. Both in d3/d4's approved warn look (`--wh-warn-bg` / `--wh-warn-ink`, `role="alert"`).

- [ ] **Step 1: Write the failing tests.**
  - Append to `tests/customer/date-screen.test.js`:

```js
// d5: a booking refused because its time went while the customer filled in
// their details comes back here with the time cleared.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
const SORRY = 'Sorry, that time was booked while you were filling in your details - please choose another';

test('after a refused booking it says the time was booked, above the calendar, until the next pick', async () => {
  current = await renderBookScreen({
    file: 'screens/book/date.js', exportName: 'DateScreen', at: 'date', url: '/book/north/date',
    services: SERVICES, mechanics: MECHANICS, availability: AVAILABILITY, draft: { serviceIds: [11, 12] },
    state: { timeTaken: true },
  });
  const { ui } = current;
  await ready(ui);
  const message = ui.getByText(SORRY);
  assert.equal(message.getAttribute('role'), 'alert');
  assert.ok(message.compareDocumentPosition(ui.getByRole('group', { name: 'October 2026' })) & Node.DOCUMENT_POSITION_FOLLOWING,
    'the message is not above the calendar');
  await click(day(ui, TUE_6));
  assert.equal(ui.queryByText(SORRY), null);
});

test('opened normally, it says nothing about a refused booking', async () => {
  const { ui } = await open();
  await ready(ui);
  assert.equal(ui.queryByText(SORRY), null);
});
```

  - Append to `tests/customer/problem-screen.test.js`:

```js
// d5: a booking refused because the shop changed its questions comes back
// here with the server's message.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
const CHANGED = 'The questions for this service have changed — please check them and try again';

test("after the questions changed while sending, it shows the server's message above the bike box", async () => {
  current = await renderBookScreen({
    file: 'screens/book/problem.js', exportName: 'ProblemScreen', at: 'problem', url: '/book/north/problem',
    services: DATA, draft: { serviceIds: [11] }, state: { questionsChanged: CHANGED },
  });
  const { ui } = current;
  await ui.findByRole('heading', { level: 1, name: 'Tell us about your bike' });
  const note = ui.getByText(CHANGED);
  assert.equal(note.getAttribute('role'), 'alert');
  assert.ok(note.compareDocumentPosition(ui.getByRole('textbox', { name: 'Your bike (optional)' })) & Node.DOCUMENT_POSITION_FOLLOWING,
    'the message is not above the bike box');
});

test('opened normally, it shows no such message', async () => {
  const { ui } = await open({ serviceIds: [11] });
  assert.equal(ui.queryByText(CHANGED), null);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run pretest && node --test tests/customer/date-screen.test.js tests/customer/problem-screen.test.js`
Expected: the two "after ..." tests FAIL (`getByText` finds no such text); the "opened normally" tests and every earlier test PASS.

- [ ] **Step 3: Implement.**
  - In `src/screens/book/date.tsx`:
    - Change `import { Navigate, useNavigate, useParams } from 'react-router';` to `import { Navigate, useLocation, useNavigate, useParams } from 'react-router';`.
    - After the `./date-rules.ts` import block, add: `import { TIME_TAKEN_MESSAGE, type SendRefusalState } from './details-rules.ts';`
    - In `DatePicker`, directly after `const [taken, setTaken] = React.useState(false);`, add:

```tsx
  // A booking refused at sending because this time went (d5) comes back here
  // with the time cleared; say so until the next pick.
  const location = useLocation();
  const [refused, setRefused] = React.useState(() => (location.state as SendRefusalState | null)?.timeTaken === true);
```

    - In `pickDay`, `pickTime` and `pickMechanic`, add `setRefused(false);` as the first line, directly above each `setTaken(false);`.
    - Directly above `{taken && (`, add:

```tsx
      {refused && (
        <p role="alert" className="m-0 mb-3 rounded-md bg-[var(--wh-warn-bg)] p-2.5 text-sm text-[var(--wh-warn-ink)]">
          {TIME_TAKEN_MESSAGE}
        </p>
      )}
```

  - In `src/screens/book/problem.tsx`:
    - Change `import { useNavigate, useParams } from 'react-router';` to `import { useLocation, useNavigate, useParams } from 'react-router';`.
    - After the `./problem-rules.ts` import block, add: `import type { SendRefusalState } from './details-rules.ts';`
    - In `ProblemForm`, directly after `const navigate = useNavigate();`, add:

```tsx
  // A booking refused at sending because the shop changed its questions (d5)
  // comes back here with the server's message.
  const questionsChanged = (useLocation().state as SendRefusalState | null)?.questionsChanged;
```

    - Directly above the `<Field>` that holds the bike box (`<Label htmlFor={\`${base}-bike\`}>Your bike (optional)</Label>`), add:

```tsx
      {questionsChanged && (
        <p role="alert" className="m-0 mb-3 rounded-md bg-[var(--wh-warn-bg)] p-2.5 text-sm text-[var(--wh-warn-ink)]">
          {questionsChanged}
        </p>
      )}
```

- [ ] **Step 4: Run and watch them pass**

Run: `npm run pretest && time node --test tests/customer/date-screen.test.js tests/customer/problem-screen.test.js && npm run typecheck && npm run lint`
Expected: all PASS, each file exits in seconds, typecheck and lint clean.

- [ ] **Step 5: Prove the tests bite.** Each time: mutate, confirm in `git diff`, run `npm run pretest && node --test tests/customer/date-screen.test.js tests/customer/problem-screen.test.js`, confirm the named failure, restore, confirm `git diff` no longer shows it.
  1. In `DatePicker`'s `pickDay`, delete the added `setRefused(false);`. "after a refused booking it says the time was booked, ..." must FAIL on its last assertion.
  2. In `problem.tsx`, change `{questionsChanged && (` to `{false && questionsChanged && (`. "after the questions changed while sending, ..." must FAIL.

  Re-run Step 4 to PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/date.tsx src/screens/book/problem.tsx tests/customer/date-screen.test.js tests/customer/problem-screen.test.js
git commit -m "feat: date and problem say why a booking came back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The pending screen

**Files:**
- Create: `src/screens/book/pending.tsx`
- Modify: `src/customer/app-shell.tsx` (`SCREENS`)
- Modify: `tests/screens/customer-app-shell.test.js` (the pending placeholder test)
- Test: `tests/customer/pending-screen.test.js`

**Interfaces:**
- Consumes: everything Task 2 produces; `ApiError` from `@/lib/api/client.ts`; `BookFrame` (no `step`, `back` or `action`); `Button`; the helper's `bookingLink` option and `booking/:code` route (Task 3).
- Produces: `export function PendingScreen()`, registered as `pending` in `SCREENS`. Heading (`h1`): the status words; "Loading…" while the link loads; `NOT_FOUND` on 404; `EXPIRED` on 410; `LOAD_FAILED` with "Try again" on any other failure.

- [ ] **Step 1: Write the failing test** `tests/customer/pending-screen.test.js`

```js
// The pending screen: the private link read back - the status, the summary,
// Copy link, the contact line, and 404 / 410 / other failures.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
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

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const CODE = 'b'.repeat(64);
const LINK = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-10-05', startTime: '09:30',
  description: 'Squeals when braking', bikeNote: 'Blue Trek road bike',
  answers: [
    { wording: "What's wrong with the brakes?", answer: 'Squeaking', text: 'Front only' },
    { wording: 'Tubeless?', answer: null },
  ],
  bike: null, stage: 'awaiting_confirmation', photoCount: 1,
  services: [{ name: 'Brake service', price: 20 }, { name: 'Gear service', price: 25 }], totalPrice: 45,
};

const open = async (bookingLink = LINK) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, bookingLink,
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => (await rtl()).fireEvent.click(el);
const heading = (ui, name) => ui.findByRole('heading', { level: 1, name });

test('it reads the private link and shows where the booking is up to as its heading; no step, back link or action', async () => {
  const { ui, requests } = await open();
  assert.ok(await heading(ui, 'Awaiting shop confirmation'));
  assert.ok(requests.some((r) => r.url === `/api/portal/north/booking-links/${CODE}`), JSON.stringify(requests));
  assert.equal(ui.queryByText(/^Step /), null);
  assert.equal(ui.queryByRole('link', { name: /Back/ }), null);
  assert.equal(document.querySelector('[data-book-pinned]'), null);
});

for (const [stage, words] of [
  ['confirmed', 'Confirmed'],
  ['in_workshop', 'In the workshop'],
  ['ready_to_collect', 'Ready to collect'],
  ['collected', 'Collected'],
  ['change_requested', 'Change requested'],
  ['declined', 'Declined'],
  ['cancelled', 'Cancelled'],
  ['request_expired', 'Request expired'],
]) {
  test(`stage ${stage} reads "${words}"`, async () => {
    const { ui } = await open({ ...LINK, stage });
    assert.ok(await heading(ui, words));
  });
}

test('the summary: reference, services with prices, the total, day and time, bike note, description and answers', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  for (const text of [
    'Reference', 'WH-1042', 'Brake service', '£20', 'Gear service', '£25', 'From £45', 'Monday 5 October, 09:30',
    'Blue Trek road bike', 'Squeals when braking', "What's wrong with the brakes?", 'Squeaking - Front only',
  ]) assert.ok(ui.getByText(text), text);
  assert.equal(ui.queryByText('Tubeless?'), null, 'an unanswered question is left out');
});

test('with prices hidden only the names show; a drop-off booking shows the day alone', async () => {
  const { ui } = await open({ ...LINK, startTime: '', services: [{ name: 'Brake service', price: null }], totalPrice: null });
  await heading(ui, 'Awaiting shop confirmation');
  assert.ok(ui.getByText('Brake service'));
  assert.equal(ui.queryByText(/£/), null);
  assert.ok(ui.getByText('Monday 5 October'));
});

test('Copy link copies this page\'s address and says "Copied" briefly', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  const copied = [];
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async (text) => { copied.push(text); } }, configurable: true,
  });
  assert.ok(ui.getByText('Keep this link to check your booking'));
  await click(ui.getByRole('button', { name: 'Copy link' }));
  assert.ok(await ui.findByRole('button', { name: 'Copied' }));
  assert.deepEqual(copied, [`http://localhost/book/north/booking/${CODE}`]);
  const { waitFor } = await rtl();
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Copy link' })), { timeout: 3000 });
});

test('it says to contact the shop to change or cancel', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  assert.ok(ui.getByText('Need to change or cancel? Contact North Street Cycles'));
});

test('a link that finds nothing says so', async () => {
  const { ui } = await open(() => ({ status: 404, body: { error: "We can't find that booking" } }));
  assert.ok(await heading(ui, "We can't find that booking"));
  assert.equal(ui.queryByRole('button', { name: 'Try again' }), null);
});

test('an expired link says so', async () => {
  const { ui } = await open(() => ({ status: 410, body: { error: 'This link has expired' } }));
  assert.ok(await heading(ui, 'This link has expired'));
  assert.equal(ui.queryByRole('button', { name: 'Try again' }), null);
});

test('any other failure offers Try again, which asks again', async () => {
  let calls = 0;
  const { ui } = await open(() => (++calls === 1 ? { status: 500, body: { error: 'Something went wrong' } } : { status: 200, body: LINK }));
  assert.ok(await heading(ui, "We couldn't load this booking"));
  await click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await heading(ui, 'Awaiting shop confirmation'));
  assert.equal(calls, 2);
});
```

- [ ] **Step 2: Update the shell test.** In `tests/screens/customer-app-shell.test.js`, replace the whole test `'a private link opened cold reaches the pending screen'` with:

```js
test('a private link opened cold reaches the pending screen', async () => {
  const LINK = {
    reference: 'WH-1042', shopName: 'Demo Cycles', jobDate: '2026-10-05', startTime: '09:30', description: null,
    bikeNote: null, answers: [], bike: null, stage: 'awaiting_confirmation', photoCount: 0, services: [], totalPrice: null,
  };
  globalThis.fetch = async (input) => {
    const body = new URL(String(input), 'http://localhost').pathname.includes('/booking-links/') ? LINK : SERVICES;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const screen = await renderAt(`/book/demo/booking/${'a'.repeat(64)}`);
  assert.ok(await screen.findByRole('heading', { level: 1, name: 'Awaiting shop confirmation' }));
  screen.unmount();
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npm run pretest && node --test tests/customer/pending-screen.test.js tests/screens/customer-app-shell.test.js`
Expected: every pending-screen test FAILS with `ERR_MODULE_NOT_FOUND` (`pending.js`); the shell's private-link test FAILS (it still shows "Not built yet: pending"); the other shell tests PASS.

- [ ] **Step 4: Write** `src/screens/book/pending.tsx`

```tsx
import * as React from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client.ts';
import { BookFrame } from './frame.tsx';
import { useBookingLink, type BookingLink } from './pending-query.ts';
import {
  COPIED_MS, EXPIRED, LOAD_FAILED, NOT_FOUND, answerLines, contactLine, serviceLines, statusText, totalLine, whenLine,
} from './pending-rules.ts';

/**
 * The pending screen (atlas `pending`): where the booking is up to, as its
 * heading, and a summary of what was booked. The private link the server
 * issues opens it cold, so it reads everything from the link, never the
 * draft. No step, no back link, no action; changing or cancelling online
 * comes with d6, so until then it says to contact the shop.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export function PendingScreen() {
  const { shopSlug = '', code = '' } = useParams();
  const link = useBookingLink(shopSlug, code);
  if (link.data) return <BookingView link={link.data} />;
  if (link.isError) {
    const status = link.error instanceof ApiError ? link.error.status : 0;
    if (status === 404) return <BookFrame title={NOT_FOUND}>{null}</BookFrame>;
    if (status === 410) return <BookFrame title={EXPIRED}>{null}</BookFrame>;
    return (
      <BookFrame title={LOAD_FAILED}>
        <Button variant="accent" onClick={() => void link.refetch()}>Try again</Button>
      </BookFrame>
    );
  }
  return <BookFrame title="Loading…">{null}</BookFrame>;
}

function BookingView({ link }: { link: BookingLink }) {
  const [copied, setCopied] = React.useState(false);
  // "Copied" for a moment, then back. The state is set in the timer's
  // callback, not in the effect itself.
  React.useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // No clipboard, or it was refused: the address bar still has the link.
    }
  };

  const total = totalLine(link);
  const answers = answerLines(link);
  return (
    <BookFrame title={statusText(link.stage)}>
      <div className="mb-4 rounded-md border border-[var(--wh-border)] p-3 text-sm">
        <p className="m-0 mb-2 flex justify-between gap-3">
          {/* The {' '} spaces keep the words apart for a screen reader, as ChoiceCard does. */}
          <span className="text-[var(--wh-muted)]">Reference</span>{' '}<strong>{link.reference}</strong>
        </p>
        <ul className="m-0 mb-2 list-none p-0">
          {serviceLines(link).map((s, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{s.name}</span>
              {s.price && <>{' '}<span>{s.price}</span></>}
            </li>
          ))}
        </ul>
        {total && <p className="m-0 mb-2 font-semibold">{total}</p>}
        <p className="m-0">{whenLine(link)}</p>
        {link.bikeNote && <p className="m-0">{link.bikeNote}</p>}
        {link.description && <p className="m-0">{link.description}</p>}
        {answers.length > 0 && (
          <dl className="m-0 mt-2">
            {answers.map((a, i) => (
              <div key={i} className="mb-1">
                <dt className="text-xs text-[var(--wh-muted)]">{a.wording}</dt>
                <dd className="m-0">{a.answer}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <p className="m-0 mb-2">Keep this link to check your booking</p>
      <Button className="mb-4" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
      <p className="m-0">{contactLine(link.shopName)}</p>
    </BookFrame>
  );
}
```

Then in `src/customer/app-shell.tsx` add `import { PendingScreen } from '@/screens/book/pending.tsx';` after the `DetailsScreen` import, and `pending: PendingScreen,` to `SCREENS` after `details: DetailsScreen,`.

- [ ] **Step 5: Run and watch them pass**

Run: `npm run pretest && time node --test tests/customer/pending-screen.test.js tests/screens/customer-app-shell.test.js tests/customer/book-layout.test.js && npm run typecheck && npm run lint`
Expected: all PASS; `pending-screen.test.js` exits in a few seconds (the "Copied" test waits about 2 s); typecheck and lint clean.

- [ ] **Step 6: Prove the tests bite.** Each time: mutate, confirm in `git diff`, run `npm run pretest && node --test tests/customer/pending-screen.test.js`, confirm the named failure, restore, confirm `git diff` no longer shows it.
  1. In `PendingScreen`, delete the line `if (status === 410) return <BookFrame title={EXPIRED}>{null}</BookFrame>;`. "an expired link says so" must FAIL (the heading is "We couldn't load this booking").
  2. In `BookingView`'s effect, change `window.setTimeout(() => setCopied(false), COPIED_MS)` to `window.setTimeout(() => {}, COPIED_MS)`. 'Copy link copies ... says "Copied" briefly' must FAIL in `waitFor`.
  3. In `pending-rules.ts` `STAGE_TEXT`, change `in_workshop: 'In the workshop',` to `in_workshop: 'In workshop',`. 'stage in_workshop reads "In the workshop"' must FAIL.

  Re-run Step 5 to PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/book/pending.tsx src/customer/app-shell.tsx tests/customer/pending-screen.test.js tests/screens/customer-app-shell.test.js
git commit -m "feat: the pending screen - status, summary, copy link, contact line, 404/410

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: At 320px, the last field and the terms box stay above the pinned Request booking

**Files:**
- Create: `tests/browser/book-details.spec.ts`

**Interfaces:**
- Consumes: the served app at `/book/:shopSlug/details` (Tasks 3-4); `data-book-pinned` on BookFrame's pinned area and BookFrame's bottom padding on `main` (`pb-28`, or `pb-36` with an `actionNote`); the draft key `wh-book-draft:<shopSlug>` in sessionStorage.

- [ ] **Step 1: Write the check** `tests/browser/book-details.spec.ts`

```ts
import { test, expect, type Locator, type Page } from '@playwright/test';

// d5: on a 320x568 phone, scrolled to the bottom of the details screen, the
// last field (Email) and the terms box must sit entirely above the pinned
// Request booking - before any message shows, and again once every message
// shows (the pinned area grows by a line).
//
// /services and /mechanics are answered here and the draft seeded, so no
// seeded shop is needed. A timed day, so /availability isn't asked for.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
const DRAFT = {
  serviceIds: [1], answers: [], bikeNote: 'Blue Trek road bike', date: '2026-10-05', mechanicId: 1, startTime: '09:30',
};

async function bottomOf(locator: Locator, what: string) {
  const box = await locator.boundingBox();
  expect(box, what).not.toBeNull();
  return box!.y + box!.height;
}

async function expectClearOfPinned(page: Page, extra: Locator[] = []) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const pinned = await page.locator('[data-book-pinned]').boundingBox();
  expect(pinned).not.toBeNull();
  const email = page.getByRole('textbox', { name: /^Email/ });
  const terms = page.getByRole('checkbox', { name: 'I agree to the booking terms' }).locator('xpath=ancestor::label[1]');
  expect(await bottomOf(email, 'the email field')).toBeLessThanOrEqual(pinned!.y);
  expect(await bottomOf(terms, 'the terms box')).toBeLessThanOrEqual(pinned!.y);
  for (const locator of extra) expect(await bottomOf(locator, 'the terms message')).toBeLessThanOrEqual(pinned!.y);
}

test('at 320px the last field and the terms box stay above the pinned Request booking', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({
      json: {
        shopName: 'Test shop', showPrices: true, full: [], categories: [],
        uncategorised: [{ id: 1, name: 'Brake service', price: 20, minutes: 30, questions: [] }],
      },
    }));
  await page.route('**/api/portal/*/mechanics', (route) =>
    route.fulfill({
      json: { mechanics: [{ id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] }], openingTime: '09:00', closingTime: '17:00', openingDays: [1, 2, 3, 4, 5] },
    }));
  await page.addInitScript((draft) => window.sessionStorage.setItem('wh-book-draft:any-shop', JSON.stringify(draft)), DRAFT);
  await page.goto('/book/any-shop/details');

  await expect(page.getByText('Monday 5 October, 09:30 with Alex')).toBeVisible();
  await expectClearOfPinned(page);

  await page.getByRole('button', { name: 'Request booking' }).click();
  const termsMessage = page.getByText('Please accept the booking terms');
  await expect(termsMessage).toBeVisible();
  await expectClearOfPinned(page, [termsMessage]);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/browser/book-details.spec.ts`
Expected: PASS. (The web server runs `npm run build && npm start`, so the build includes Tasks 3-6.)

- [ ] **Step 3: Prove it bites.** In `src/screens/book/frame.tsx`, change `(actionNote ? 'pb-36' : 'pb-28')` to `'pb-3'`. Confirm it in `git diff`. Run `npx playwright test tests/browser/book-details.spec.ts`. It must FAIL on "the email field" or "the terms box" (behind the pinned area). Restore `frame.tsx`, confirm `git diff` is clean for it, and re-run to PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/browser/book-details.spec.ts
git commit -m "test: at 320px the details screen's last field and terms box stay above the pinned action

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The whole journey, end to end, against the real server and a test database

**Files:**
- Create: `tests/browser/book-journey.spec.ts`

**Interfaces:**
- Consumes:
  - `startLiveServer()` and `TEST_CLOCK_PIN` (`'2026-09-01T06:00:00Z'`, 07:00 UK time on Tuesday 1 September 2026) from `tests/helpers/liveServer.js`. It spawns `server/server.js` on a free port with `WHEELHOUSE_TEST_CLOCK` pinned (ignored when `NODE_ENV=production`), inheriting `DATABASE_URL`, and waits for `/app.js`. It serves `/book` from `public/dist`, which Playwright's `webServer` (`npm run build && npm start`) has built before any test runs.
  - `staffSignup(baseUrl, { shopName })` (creates the shop, its owner and `workshop_settings` with the defaults: timed mode, 09:00-18:00 every day, 120 minutes' notice, `Europe/London`), `staffRequest(baseUrl, cookie, path, { method, body })`, `seedMechanic(shopId, { name })` from `tests/helpers/staff.js`; `deleteTestShop(shopId)` from `tests/helpers/testShop.js`; `purgeAttachmentFiles(shopId)`, `UPLOADS_DIR` from `tests/helpers/workshopFixtures.js`; `pool`, `runWithShop`, `prepare` from `server/db.js`; `server/load-env.js` (loads `.env` locally; CI sets `DATABASE_URL` in the job env).
  - Every screen from d2-d6 of this plan, served for real.
- Produces: `tests/browser/book-journey.spec.ts`, run by `npm run test:browser` locally and in CI's existing "Journey tests" step. No config or CI change.

- [ ] **Step 1: Write the test** `tests/browser/book-journey.spec.ts`

```ts
// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, runWithShop, prepare } from '../../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { purgeAttachmentFiles, UPLOADS_DIR } from '../helpers/workshopFixtures.js';

// d5: the whole customer booking journey, end to end, in a real browser
// against the real server and the test database - nothing mocked.
//
// A throwaway shop (a service with a question, a mechanic, the default
// opening hours and settings, prices shown) is seeded through the same
// helpers the server tests use, on this file's own live server. That server
// runs on the pinned test clock (07:00 UK time, Tuesday 1 September 2026),
// and the browser's clock is pinned to the same moment in Europe/London, so
// both agree that Wednesday 2 September is bookable. A browser books from
// /book/<shop> to the pending screen, with a photo; the private link is then
// opened cold in a fresh browser context; the booking row is checked in the
// database (answers, bike note, a stored photo, the terms copy); the shop is
// removed afterwards.
//
// terms_text comes from server piece 11 (PR #86); that check is last, so
// before piece 11 is merged into this branch the test fails there and only
// there.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md

// A real 1x1 PNG: the picker accepts it by type, the server by its bytes.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const QUESTION = "What's wrong with the brakes?";
const PHONE = { width: 320, height: 568 };

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let shop: { id: number; slug: string } | undefined;
let serviceId: number;

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: PHONE });

test.beforeAll(async () => {
  server = await startLiveServer();
  const owner = await staffSignup(server.baseUrl, { shopName: 'Journey Cycles' });
  shop = owner.shop;
  await seedMechanic(owner.shop.id, { name: 'Sam' });
  const staff = (p: string, options: object) => staffRequest(server!.baseUrl, owner.cookie, p, options);
  const service = await staff('/api/workshop-services', {
    method: 'POST',
    body: {
      name: 'Brake check', price: 20, minutes: 60, bookableOnline: true,
      questions: [{ wording: QUESTION, kind: 'choice', required: true, choices: ['Squeaking', 'Not stopping well'] }],
    },
  });
  expect(service.status, JSON.stringify(service.body)).toBe(201);
  serviceId = service.body.id;
  const settings = await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } });
  expect(settings.status, JSON.stringify(settings.body)).toBe(200);
});

test.afterAll(async () => {
  if (shop) {
    await purgeAttachmentFiles(shop.id);
    await deleteTestShop(shop.id);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM shops WHERE id = $1', [shop.id]);
    expect(rows[0].n, 'the throwaway shop is removed').toBe(0);
  }
  if (server) await server.stop();
  await pool.end();
});

test('a customer books from the first screen to pending, the private link reopens it, and the booking is stored', async ({ page, browser }) => {
  const slug = shop!.slug;
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/book/${slug}`);

  // service and service-list
  await page.getByRole('button', { name: /Individual services/ }).click();
  await page.getByRole('button', { name: /Brake check/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // problem: the bike, the question, a photo
  await page.getByRole('textbox', { name: 'Your bike (optional)' }).fill('Blue Trek road bike');
  await page.locator('label', { hasText: /^Squeaking$/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'brake.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'brake.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // date: the day after the pinned "today"
  await page.getByRole('button', { name: /^Wednesday,?\s+2 September 2026$/ }).click();
  await page.getByRole('button', { name: 'Sam, 10:00' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // details
  await expect(page.getByRole('heading', { level: 1, name: 'How can we reach you?' })).toBeVisible();
  await expect(page.getByText('Wednesday 2 September, 10:00 with Sam')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Gina Guest');
  await page.getByRole('textbox', { name: 'Mobile number' }).fill('07700 900123');
  await page.getByRole('checkbox', { name: 'I agree to the booking terms' }).check();
  await page.getByRole('button', { name: 'Request booking' }).click();

  // pending
  await expect(page.getByRole('heading', { level: 1, name: 'Awaiting shop confirmation' })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`/book/${slug}/booking/[0-9a-f]{64}$`));
  const privateLink = page.url();
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), `wh-book-draft:${slug}`), 'the draft is cleared').toBeNull();

  // the private link, opened cold
  const cold = await browser.newContext({ timezoneId: 'Europe/London', viewport: PHONE });
  const coldPage = await cold.newPage();
  await coldPage.goto(privateLink);
  await expect(coldPage.getByRole('heading', { level: 1, name: 'Awaiting shop confirmation' })).toBeVisible();
  await expect(coldPage.getByText('Blue Trek road bike')).toBeVisible();
  await cold.close();

  // the booking row
  const jobs = await runWithShop(shop!.id, () => prepare(
    'SELECT id, job_date, start_time, booking_state, customer_bike_note, question_answers FROM workshop_jobs',
  ).all());
  expect(jobs).toHaveLength(1);
  const [job] = jobs;
  expect(job).toMatchObject({ job_date: '2026-09-02', start_time: '10:00', booking_state: 'pending', customer_bike_note: 'Blue Trek road bike' });
  expect(job.question_answers).toMatchObject([{ serviceId, wording: QUESTION, kind: 'choice', answer: 'Squeaking' }]);
  const customer = await runWithShop(shop!.id, () => prepare(
    'SELECT c.name, c.update_channel FROM customers c JOIN workshop_jobs w ON w.customer_id = c.id WHERE w.id = ?',
  ).get(job.id));
  expect(customer).toMatchObject({ name: 'Gina Guest', update_channel: 'sms' });
  const photos = await runWithShop(shop!.id, () => prepare(
    'SELECT storage_key, content_type, from_customer FROM workshop_job_attachments WHERE workshop_job_id = ?',
  ).all(job.id));
  expect(photos.map((p: { content_type: string; from_customer: boolean }) => [p.content_type, p.from_customer])).toEqual([['image/png', true]]);
  expect((await readFile(path.join(UPLOADS_DIR, photos[0].storage_key))).equals(PNG), 'the stored photo is the one sent').toBe(true);

  // the terms copy (server piece 11) - last, see the header
  const stored = await runWithShop(shop!.id, () => prepare('SELECT terms_text FROM workshop_jobs WHERE id = ?').get(job.id));
  const terms = await (await fetch(`${server!.baseUrl}/api/portal/${slug}/terms`)).json();
  expect(terms.standard).toBe(true);
  expect(stored.terms_text).toBe(terms.text);
});
```

- [ ] **Step 2: Run it and read where it stops**

Run: `gh pr view 86 --json state` then `npx playwright test tests/browser/book-journey.spec.ts`
Expected, while piece 11 is not in this branch (the normal case at this task): FAIL at the terms step with a database error naming the column (`column "terms_text" does not exist`) - every earlier step and assertion passed. Read the error and the line: if it fails anywhere earlier, that is a real failure - fix it (or report it), don't move on. If piece 11 is already in this branch (it only arrives through Task 9's merge), Expected: PASS.

  If it fails at `Sam, 10:00` (the button isn't offered), don't guess another time: print the day's availability with `curl "<baseUrl>/api/portal/<slug>/availability?start=2026-09-02&end=2026-09-02&minutes=60"` from a debugging run, report it, and ask.

- [ ] **Step 3: Prove it bites before the terms step.** Each time: mutate, confirm in `git diff`, run `npx playwright test tests/browser/book-journey.spec.ts`, confirm it fails at the named step (not at `terms_text`), restore, confirm `git diff` no longer shows it.
  1. In `src/screens/book/details-rules.ts` `bookingBody`, delete the line `...(bikeNote ? { bikeNote } : {}),`. It must FAIL at the cold page's `getByText('Blue Trek road bike')` (or, if that is reordered, the `customer_bike_note` check).
  2. In `src/screens/book/send.ts` `photoBase64`, change `return btoa(binary);` to `` return `data:image/png;base64,${btoa(binary)}`; ``. It must FAIL at the pending heading: the server refuses the photo ("A photo could not be read — please try adding it again") and the browser stays on details.
  3. In `tests/browser/book-journey.spec.ts` `test.afterAll`, comment out `await deleteTestShop(shop.id);`. The run must FAIL with "the throwaway shop is removed". Restore the line, then remove the shop that run left behind (its photo files were already purged):

```bash
node --input-type=module -e "
import './server/load-env.js';
const { pool } = await import('./server/db.js');
const { deleteTestShop } = await import('./tests/helpers/testShop.js');
const { rows } = await pool.query(\"SELECT id FROM shops WHERE name = 'Journey Cycles'\");
for (const r of rows) await deleteTestShop(r.id);
console.log('removed', rows.length);
await pool.end();"
```

     Expected: `removed 1`.

  Re-run Step 2 and confirm it is back to the expected state (the terms step only, while piece 11 is not in).

- [ ] **Step 4: Confirm nothing else broke.** Run `npm run test:browser` and confirm every other spec (`smoke`, `book-service-list`, `book-problem`, `book-date`, `book-details`) PASSES; `book-journey` is in the state Step 2 describes.

- [ ] **Step 5: Commit**

```bash
git add tests/browser/book-journey.spec.ts
git commit -m "test: the whole booking journey end to end against the real server and a throwaway shop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Piece 11, everything CI runs, screenshots, STATUS, and the spec walk

**Files:**
- Modify: `.agents/STATUS.md`
- Modify: `docs/superpowers/plans/2026-09-26-book-d5-details-send-pending.md` (this plan: decision log and spec walk)

- [ ] **Step 1: Check piece 11 and bring it in - only if it has merged.** Run:

```bash
gh pr view 86 --json state,mergedAt,mergeCommit
git fetch origin
```

  - If the state is `MERGED`: run `git merge-base --is-ancestor <mergeCommit.oid> HEAD && echo "already in this branch"`. If it isn't already in, run

```bash
git merge origin/main -m "Merge origin/main (server piece 11, #86) into d5" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

    If the merge conflicts only in `.agents/STATUS.md`, resolve by keeping both sides' text in full (nothing from either side dropped), `git add .agents/STATUS.md`, and `git commit --no-edit`. Any other conflict: `git merge --abort` and stop; report the conflicting files. After the merge, run `npm run migrate` (it applies piece 11's migration 034 locally) and report the merge commit.
  - If it isn't `MERGED`: **don't merge anything** - never `feat/book-server-11-terms`, never an unmerged branch. Report the state. The journey test stays red at its terms step and the d5 PR must not be opened until #86 merges and this step is re-run. Carry on with Steps 3-7 (skip Step 2), and say in the report which checks couldn't go green.

- [ ] **Step 2: Watch the terms check bite (only after the merge).** Run `npx playwright test tests/browser/book-journey.spec.ts`: PASS. Then in `server/server.js` `createWorkshopJob`, change `termsText = settingsRow?.booking_terms || STANDARD_BOOKING_TERMS;` to `termsText = 'mutated';`, confirm it in `git diff`, re-run: it must FAIL at `expect(stored.terms_text).toBe(terms.text)`. Restore, confirm `git diff` is clean, re-run: PASS.

- [ ] **Step 3: Run everything CI runs** (`.github/workflows/test.yml`). Run each command, read its exit code and output, and report the test counts:

```bash
npm run typecheck
npm run lint
npm run build
npm run registry:validate
node scripts/ci/check-registry-drift.mjs
python3 docs/design/release-1-journey/package.py
node docs/design/release-1-journey/check-static.mjs
node docs/design/release-1-journey/check-notes.mjs
git diff --exit-code -- docs/design/release-1-journey/Wheelhouse-Release-1-Journey-Atlas.html docs/design/release-1-journey/screen-index.json docs/design/release-1-journey/verification.json
node scripts/ci/assert-screen-trace.mjs
npm run migrate
node scripts/ci/assert-rls-coverage.mjs
npm test
npm run test:browser
npm run migrate
```

Expected: every command exits 0, and the last `npm run migrate` prints no `Applied migration:` line. `npm test` includes `details-rules`, `details-screen`, `pending-rules`, `pending-screen`, `installed-controls` (with `dialog`), `date-screen`, `problem-screen` and `customer-app-shell`: confirm each new test name appears in the output. `test:browser` runs `smoke`, `book-service-list`, `book-problem`, `book-date`, `book-details` and `book-journey`: confirm `book-details` and `book-journey` ran. A suite that didn't run isn't a pass. `npm run build` dirties `public/dist` locally (see STATUS); don't commit it.

- [ ] **Step 4: Screenshots at 320px for Jack.** Temporarily add screenshot lines, run, then remove them:
  - In `tests/browser/book-journey.spec.ts`, directly before `await page.getByRole('button', { name: 'Request booking' }).click();`, add `await page.screenshot({ path: '/tmp/d5-details-320.png', fullPage: true });`; directly after the line `const privateLink = page.url();`, add `await page.screenshot({ path: '/tmp/d5-pending-320.png', fullPage: true });`.
  - In `tests/browser/book-details.spec.ts`, directly after `await expectClearOfPinned(page, [termsMessage]);`, add:

```ts
  await page.getByRole('button', { name: 'booking terms' }).click();
  await page.screenshot({ path: '/tmp/d5-terms-320.png' });
```

    and a route for the terms at the top of the test (after the `/mechanics` route):

```ts
  await page.route('**/api/portal/*/terms', (route) =>
    route.fulfill({ json: { title: 'Booking terms', text: '1. Your booking is a request.\n2. Prices shown online are starting prices for labour.', standard: true } }));
```

  Run `npx playwright test tests/browser/book-journey.spec.ts tests/browser/book-details.spec.ts` (if piece 11 isn't merged, the journey still reaches both screenshots before its terms step). Then `git checkout -- tests/browser/book-journey.spec.ts tests/browser/book-details.spec.ts` and confirm `git status --short` lists neither. Open each PNG and check: details shows the summary, the fields, the channel pills and the terms box; pending shows "Awaiting shop confirmation", the summary, Copy link and the contact line; terms shows the dialog over the screen. Report the three paths.

- [ ] **Step 5: STATUS.** Edit `.agents/STATUS.md`:
  1. In the `**Branch:**` line, after "off `main` at `d7638eb`." add: " The follow-ups merged as #85 (`24bccac`). d5 built on `feat/book-d5-details-send-pending`."
  2. Directly after the paragraph that starts `**(d4) merged: #84 at \`d7638eb\`**` (it ends "follow-up piece)."), insert this new paragraph (use "merged into this branch" or "NOT yet merged - the journey test is red at its terms step until it is" for piece 11, per Step 1):

     > **(d5) built on `feat/book-d5-details-send-pending`** (26 Sep; spec `docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md`, plan `docs/superpowers/plans/2026-09-26-book-d5-details-send-pending.md`, which carries the decision log and the spec walk; server piece 11, PR #86, <merged into this branch | NOT yet merged>). Built: the `details` screen (summary; name, mobile, one update channel - Text message by default, WhatsApp, Email - an email required only for Email; the booking terms in a dialog, fetched from piece 11's `/terms` when opened; the four messages under their fields with a pinned note and focus on the first; "photos were cleared" asked in a dialog); sending (`/services` read again and answers cleaned with `cleanAnswers`; photos as bare base64; "Sending…"; success clears the draft and replaces details with the private link; a time gone clears the date choice and returns to `date` with "Sorry, that time was booked while you were filling in your details - please choose another"; changed questions return to `problem` with the server's message; 429, no response and anything else stay on details); the `pending` screen (status as its heading, reference, services and prices, "From £T", day and time, bike note, description, answers, Copy link, "Need to change or cancel? Contact <shop>"; 404, 410, Try again). Rules in `details-rules.ts` / `pending-rules.ts`; the registry `dialog` installed unchanged. **End-to-end test:** `tests/browser/book-journey.spec.ts` starts its own live server (`startLiveServer`, pinned clock), seeds a throwaway shop through the server-test helpers, pins the browser to the same moment in Europe/London, books from `/book/<shop>` to `pending` with a photo, reopens the private link in a fresh context, checks the row (answers, bike note, photo on disk, `terms_text`), and deletes the shop; no config or CI change - it runs in the existing "Journey tests" step. **For piece 12 / d6:** `pending` has no "View request" / "Change or cancel request" buttons yet; d6 replaces `contactLine` in `pending-rules.ts`. `refusalRoute` (`details-rules.ts`) sorts 400 refusals by the start of the server's message (only the capacity 409 has a code): rewording any of "That time is no longer available", "That's too soon for the shop", "That date has passed", "The questions for this service have changed" (or the four stale-choice messages) silently changes where a customer is sent - piece 12, or a later server piece, should give them codes. The link has no drop-off window or mode, so a drop-off booking's pending shows the day alone. `marketingPermission` stays in the draft type, unused (decision 3). Enter-to-submit on details is still not done. **Jack to approve:** the copy not in the spec ("Please check the answers marked above" reused on details; "We couldn't load the booking terms"; "We couldn't load this booking"; "Reference"; "Loading…" as pending's heading while loading); the four stale-choice refusals also going to `date`; the looks, from `/tmp/d5-details-320.png`, `/tmp/d5-pending-320.png`, `/tmp/d5-terms-320.png` (the summary boxes, the dialog's `--modal-bg` panel on `/book`, pending's layout and per-service prices).

- [ ] **Step 6: Walk the build against the spec.** Go through the spec line by line: "Changes", Decisions 1-6, "Details screen" (every bullet and message), "Sending" (every bullet and refusal), "Pending screen" (every bullet), "Rules", "Tests", "Not in this piece". Under "Spec walk" at the end of this plan, record each requirement as **met** (name the test that proves it), **dropped**, or **changed**, with the reason. Add any decision taken during the build to the "Decision log", with what caused it. Put the same walk in the task report.

- [ ] **Step 7: Commit**

```bash
git add .agents/STATUS.md docs/superpowers/plans/2026-09-26-book-d5-details-send-pending.md
git commit -m "docs: STATUS - d5 built; plan decision log and spec walk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decision log

Decisions taken while writing this plan, where the spec left room. Each has the reason. Add any decision taken during the build below them.

1. **`jobDate` and `mechanicId` are always sent; only `startTime` depends on the day.** The spec's "`jobDate`, `mechanicId`, and `startTime` only on a timed day" reads either way; the server refuses a booking with no date ("A valid date is required") or no mechanic ("Please choose a mechanic"), and d4's STATUS note says the same.
2. **The details summary's day and time use the date screen's wording without reusing its availability.** `whenText` names the mechanic from `/mechanics` (cached from `date`) on a timed day, and reads a drop-off day's window from a one-day `/availability` request. If either hasn't loaded or failed, the line is shorter ("Monday 5 October, 09:30"; "Tuesday 6 October"), never wrong; no extra loading or error state. d4's `summaryText` would hide the line entirely if the day had since filled up.
3. **The pinned summary on a failed Request booking reuses d3's approved "Please check the answers marked above".** The spec asks for "a summary in the pinned area" without words. Jack confirms.
4. **The "photos were cleared" question is a dialog** (the same registry `Dialog` as the terms), with "Add photos" (to `problem`, sending nothing) and "Send without photos". Answering "Send without photos" clears `hadPhotos`, so a send that then fails isn't asked about again.
5. **The terms dialog is the registry's existing `dialog`, installed unchanged**, fetched only when opened (a customer who never opens it costs no request). Loading shows "Loading…"; a failure shows "We couldn't load the booking terms" and "Try again" (not in the spec, as d4's "We couldn't load the free days"; Jack approves). The title is the server's (`"Booking terms"`), with the same words shown while loading. The panel is `--modal-bg`, the dialog's own colour; Jack judges it on `/book` from the screenshot.
6. **"booking terms" is a button inside the tick box's label.** Tapping it opens the dialog without ticking the box (the HTML rule for an interactive element inside a label; checked in jsdom). The box's accessible name stays "I agree to the booking terms".
7. **Refusals are sorted by the start of the server's message**, because the booking route's 400 refusals carry no code; the capacity 409 is sorted by its code (`client.ts`'s rule). The rules test lists every message, so a reworded server message fails a test rather than silently misrouting.
8. **Four more refusals also go back to `date`:** "That mechanic is unavailable at that time" (a block or shorter day added since), "This shop takes drop-offs on that day" / "A start time is required" (the day's mode changed), "Please choose a mechanic" (the mechanic was removed). The spec lists three messages and then says "any other refusal: the server's message", but decision 4 says "a time gone at sending returns the customer to date", and each of these is a date-screen choice gone stale; staying on details would leave the customer with no way to fix it. Kept in a separate `STALE_CHOICE` list so one deletion follows the spec's list alone. **Jack approves.**
9. **A failure to re-read `/services` before sending is treated like a failed send** (a lost connection, or the server's message). The re-read uses `apiGet` directly, not React Query's refetch, because a failed refetch sets the shared query's error state and BookFrame would replace the whole screen with "We couldn't load this shop's services". The fresh copy then replaces the cached one.
10. **Where the customer goes after sending is decided above the guard.** Clearing the draft (success) or its date (time gone) would make `RequireDraft` redirect to `date` first, without the message. `DetailsScreen` holds the destination and renders `<Navigate>` before the guard.
11. **Success replaces the details entry in history**, so Back from `pending` doesn't return to a details screen whose draft is gone. Refusals push, as ordinary navigation.
12. **The refused-booking messages travel in the router's navigation state** (`{ timeTaken: true }`, `{ questionsChanged }`), not in the draft: they belong to one visit. On `date` the message shows above the calendar until the next pick (a day, a time or a drop-off mechanic), as the spec says; on `problem` it shows above the bike box while the customer is on the screen. Both use d3/d4's approved warn look.
13. **The server's "questions changed" message is shown as sent**, em dash included ("The questions for this service have changed — please check them and try again"); the spec says "showing the server's message".
14. **No separate `full` screen.** d4's STATUS note said to build one; the d5 spec's "Changes" drops it (a refused time goes back to `date`). The spec wins.
15. **Pending's heading is the status words.** The spec gives pending no title and `BookFrame` needs one; the atlas's "Your request is with us." would be wrong once the booking is confirmed or collected. While the link loads the heading is "Loading…" (BookFrame's existing word); the 404 and 410 headings are the spec's own words; any other failure shows "We couldn't load this booking" with "Try again" (not in the spec; Jack approves). The frame focuses the new heading when it changes.
16. **Pending's summary labels only the reference** ("Reference", the atlas's label). The other lines read on their own; each answer shows the question's wording above the answer. Answers are worded like the staff notes (`answerNoteLine`): the choice or "I'm not sure", then " - " and any typed words; unanswered questions are left out.
17. **Each service on pending shows its booked price as "£20"; the total shows as "From £T".** The spec says "with prices when shown, and 'From £T'". The per-service figures are the prices booked; the total carries "From" because the terms say online prices are starting prices. Jack judges from the screenshot.
18. **A drop-off booking's pending shows the day alone.** The link carries no mode and no drop-off window.
19. **Copy link copies `window.location.href`** (the page's full address, as the spec says) and shows "Copied" for 2 seconds. With no clipboard, or permission refused, the button stays "Copy link" - the address bar still has the link.
20. **Photos are read with `arrayBuffer` and `btoa`, in chunks,** rather than `FileReader`, which the component tests (Node) don't have; the output has no `data:` prefix and no line breaks by construction.
21. **The journey test brings its own server.** Playwright's `webServer` has no pinned clock, and pinning it in `playwright.config.ts` would change the server for every spec. `startLiveServer` already pins the clock for server tests, uses a free port, and serves the bundle `webServer` just built. The shop is seeded through the same helpers as the server tests (so settings, a mechanic and a service with a question come from real routes), and removed in `afterAll`, which also checks it is gone. No CI change: the file runs in CI's existing "Journey tests" step, which already has `DATABASE_URL` and migrated Postgres.
22. **The journey test doesn't open the terms dialog**; the jsdom tests and the mocked 320px test cover it. That keeps its only failure before piece 11 merges at the `terms_text` check, placed last, so every earlier check is proved green now and the mutations in Task 8 prove they bite.
23. **The throwaway shop's day is Wednesday 2 September 2026**, the day after the pinned 07:00 on 1 September, well past the default 120-minute notice, with Sam's 10:00 on the default 09:00-18:00 day. No fixed date before 1 September 2026.
24. **Name and mobile are required on every channel** (the spec says so; the server needs a phone only for Text message and WhatsApp). Blank or spaces-only counts as empty. The email test mirrors the server's own (`^[^\s@]+@[^\s@]+$`).
25. **Leading and trailing spaces are trimmed** from the name, phone, email, bike note and description in the body (the server trims them too); answer words are sent as typed, as d3 decided.

## Spec walk

Walked line by line against `docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md` on 26 Sep, after all commits on this branch (`bbbde21`).

**Changes** (atlas): met - one update channel, no marketing box, no separate `full` screen, no view/change/cancel buttons yet (`details.tsx`, `pending.tsx`).

**Decisions 1-6:**
1. Terms: met - standard Wheelhouse terms, a shop's replacement, a copy saved per booking, all server piece 11 (#86, merged); fetched and shown from `/api/portal/:shopSlug/terms` in the details dialog (`details.tsx`; `tests/customer/details-screen.test.js` "booking terms" tests).
2. Updates - one of Text message (default), WhatsApp, Email: met (`CHANNEL_OPTIONS`, `DEFAULT_CHANNEL` in `details-rules.ts`; `details-rules.test.js` "the messages, word for word" and the channel tests).
3. No marketing permission box: met - `marketingPermission` stays in the draft type, unused (decision log 3); no such field on the screen.
4. A time gone at sending returns to `date` with the time cleared and a message: met (`refusalRoute` `to: 'date'`; `TIME_TAKEN_MESSAGE`; `details-screen.test.js` refusal-route tests).
5. Change/cancel later, pending says to contact the shop: met (`contactLine` in `pending-rules.ts`).
6. Whole-journey test end to end against the real server: met (`tests/browser/book-journey.spec.ts`).

**Details screen:** every bullet met.
- `BookFrame` step 4, back to `date`, heading "How can we reach you?", action "Request booking": met (`details.tsx`; `details-screen.test.js` "step 4, the heading, and Back goes to the date screen").
- Guard `hasDate`, redirect to `date` once `/services` has loaded: met (`RequireDraft` with `hasDate`, `to="date"`; `details-screen.test.js` guard test).
- Summary (services, day/time, "From £T", bike note): met (`summaryLines` in `details-rules.ts`; `details-rules.test.js`).
- Fields (name, mobile, channel pills, email with conditional label, terms tick box opening a dialog): met (`details.tsx`; `details-screen.test.js` field tests; decision 6 for the button-in-label terms link).
- The four field messages, shown under their fields plus a pinned summary, focus on the first problem: met, verbatim (`FIELD_MESSAGES` in `details-rules.ts`; `details-rules.test.js` "the messages, word for word"; pinned summary uses `CHECK_ANSWERS`, decision 3).
- Photos-cleared dialog with "Add photos" / "Send without photos": met (decision 4; `details-screen.test.js` photos-cleared tests).

**Sending:** every bullet met.
- `/services` refetched and answers cleaned with `cleanAnswers` before sending: met (`bookingBody` takes a fresh `services` argument; decision 9).
- "Sending…", disabled while sending: met (`details.tsx`; `details-screen.test.js` sending-state test).
- Body shape (`serviceIds`/`notSure`, `answers`, `bikeNote`, `description`, bare-base64 `photos`, `jobDate`/`mechanicId`/`startTime`, guest fields, `updateChannel`, `termsAccepted`): met (`bookingBody` in `details-rules.ts`), with decision 1's variance already recorded (`jobDate`/`mechanicId` always sent, not only on a timed day - the server requires both regardless).
- Success clears the draft (incl. photos) and goes to `privateLink`: met (`details-screen.test.js` success test; end to end in `book-journey.spec.ts`).
- Capacity/"too soon"/"date passed" refusals clear date+mechanic+time and go to `date` with the sorry message: met (`refusalRoute`, `TIME_GONE` list, `TIME_TAKEN_MESSAGE`).
- "Questions changed" refusal goes to `problem` with the server's message verbatim (em dash included): met (`refusalRoute` `QUESTIONS_CHANGED`; decision 13).
- 429 message: met, verbatim (`TOO_MANY_REQUESTS`).
- No-response message: met, verbatim (`SEND_FAILED`).
- Any other refusal shows the server's message and stays: met (`refusalRoute` default `to: 'stay'`).
- **Changed:** four extra refusal messages ("That mechanic is unavailable...", "This shop takes drop-offs...", "A start time is required", "Please choose a mechanic") also route to `date`, beyond the spec's three-message list. Reason: decision 8 - each is a stale date-screen choice; staying on details would strand the customer. Jack approved on the PR.

**Pending screen:** every bullet met.
- Reads `GET /api/portal/:shopSlug/booking-links/:code`: met (`pending-query.ts`).
- Status line per stage (all nine words): met, verbatim (`STAGE_TEXT` in `pending-rules.ts`; `pending-rules.test.js` "every stage has its words").
- Summary (reference, services with prices, "From £T", day/time, bike note, description, answers): met (`serviceLines`, `totalLine`, `whenLine`, `answerLines` in `pending-rules.ts`; `pending-screen.test.js`).
- "Keep this link to check your booking" + Copy link (copies full address, "Copied" briefly): met, verbatim (`pending.tsx`; decision 19; `COPIED_MS`).
- Contact line: met, verbatim (`contactLine`).
- 404 / 410 / other-failure with Try again: met, verbatim (`NOT_FOUND`, `EXPIRED`, `LOAD_FAILED`; `pending-screen.test.js` 404/410 tests).
- No back link, no action: met (`pending.tsx` passes no back/action to `BookFrame`).

**Rules:** met - pure functions in `details-rules.ts` and `pending-rules.ts`; screens only call these (confirmed by reading both screen files: no field logic or word-choice happens inline in `details.tsx`/`pending.tsx`).

**Tests:** met in full.
- Rules tests for both files: `details-rules.test.js`, `pending-rules.test.js`.
- `details-screen.test.js`: guard, summary, fields/default channel, each message, email label, terms dialog, photos-cleared question, sending state, success, each refusal route, 429, network failure - all present and passing.
- `pending-screen.test.js`: each status, summary, copy link, 404/410 - all present and passing.
- `book-details.spec.ts` (320x568, mocked): last field and terms box above the pinned area, scrolled to bottom, before and after a message shows - met (screenshot Step 4 reconfirmed it live).
- `book-journey.spec.ts` (real server, real database): throwaway shop, full journey to pending with a photo, private link reopened cold, database row checked (answers, bike note, photo on disk, terms copy), shop removed - met (decisions 21-23).

**Not in this piece:** all four items confirmed absent/deferred as intended - no change/cancel online (piece 12/d6), no customer sign-in or saved bikes, no marketing permission field, the body-size memory risk untouched (STATUS's existing piece 6 open item, still Jack's decision before hosting).

**Dropped:** nothing from the spec was dropped.

**Overall:** every spec requirement is met; the only deltas from the literal spec text are the four extra stale-choice refusals to `date` (decision 8, Jack-approved) and the copy not specified in words (decisions 3, 5, 15, 16), all called out above and in STATUS.
