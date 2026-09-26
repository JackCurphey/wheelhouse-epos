# Book (d3): the problem screen

**Date:** 2026-09-26. **Follows:** d2 (#78), #79, and **server piece 9**
(below), which must merge first. **Changes:**
- the atlas mock-up for `problem` (`docs/design/release-1-journey/screens.js`):
  one bike box instead of make/model plus colour, choice questions as pills
  with a free-text box instead of a `<select>`, photos only (no video), the
  description after the questions, and "Continue" instead of "Choose a day".
- d1's draft shape: `bike: {make, model, colour}` becomes `bikeNote`.
- the server's booking rules (piece 9): a bike note, the description required
  only for "Not sure", and typed words accepted on choice questions.

## Why

The second step of the customer booking journey at `/book`. The customer
says which bike is coming in and what is wrong, answers the shop's questions
for each chosen service, and can add photos. Booking should take as few steps
as possible, but the shop should not receive a booking with no information.

## Decisions (Jack, 26 Sep)

1. **One free-text bike box, for everyone in d3.** A customer with an account
   will later pick a saved bike or add one; that needs sign-in in the booking
   app and is not in d3.
2. **The bike words are a note on the booking, not a bike record.** Staff
   create the real bike at check-in, once they can see it. Chosen over saving
   the text as a bike record's make (half-filled records and duplicates).
3. **The bike box is optional.**
4. **Choice questions are quick-answer pills plus "Or tell us in your own
   words".** A tap, some words, or both count as an answer. A question the
   shop marks required needs at least one of them; an optional one can be
   skipped. Chosen over pills alone (the answer may not be listed), text only
   (loses one-tap answers) and a dropdown (hidden choices, no approved
   control).
5. **Question wording is the shop's.** Shops are encouraged to ask one overall
   question per service ("What's wrong with the brakes?") with short common
   answers ("Squeaking", "Not stopping well"). Test and demo data use that
   style; the staff question-setup screen should suggest it. Up to 10
   questions per service stay allowed.
6. **Photos only, optional.** Up to 5, as the server already allows. Held in
   memory, not saved in the browser: after a refresh the screen says so.
   Video is not in this piece.
7. **The description is required only for "Not sure".** For chosen services
   it is optional.

## The screen: `problem` (`/book/:shopSlug/problem`)

- `BookFrame` step 2. Back link: to `/book/:shopSlug/services` when services
  are ticked, to `/book/:shopSlug` for "Not sure". Heading: "Tell us about
  your bike". Action: "Continue".
- In order:
  1. **"Your bike (optional)"**: one `Input`, placeholder "Blue Trek road
     bike", at most 200 characters.
  2. **Questions**, only when services are ticked: for each ticked service
     that has questions, in list order, a small heading with the service's
     name, then its questions in the shop's order.
     - A text question: the wording, then a `Textarea` (at most 1,000
       characters).
     - A choice question: the wording, a single-choice `PillGroup` of the
       shop's choices, plus "I'm not sure" when the shop allows it; then "Or
       tell us in your own words" and a `Textarea` (at most 1,000
       characters). A tapped pill can be changed to another but not cleared
       (the pills are radio buttons); the words box is always available.
     - An optional question's wording ends with " (optional)".
  3. **Description**: a `Textarea` (the server sets no length limit, and
     neither does the screen).
     - "Not sure": label "What's wrong with it?", required.
     - Services ticked: label "Anything else we should know? (optional)".
  4. **"Add photos (optional)"**: the `PhotoPicker` (at most 5, 10 MB each,
     JPEG, PNG or WebP), then "You can also show us at drop-off."
- Everything except photos is written to the draft as it changes, so it
  survives a refresh in the same tab (d1).
- **Photos after a refresh**: if the draft says photos were added but none
  are held in memory, the screen shows "Your photos were cleared - please add
  them again" above the picker, until photos are added or the customer
  continues.
- **Continue** checks, and on failure stays on the screen:
  - each required question with no pill and no words: "Please answer:
    <wording>" under that question (the server's wording);
  - "Not sure" with an empty description: "Tell us what's wrong" under the
    description;
  - when anything failed, "Please check the answers marked above" in the
    pinned area (announced to screen readers), and focus moves to the first
    question or field with a message.
  - Otherwise it goes to `/book/:shopSlug/date`.
- A service with no questions shows no heading. With services ticked but no
  questions at all, the screen is the bike box, the optional description and
  photos.

## Draft changes (`src/screens/book/draft.tsx`, `require-draft.tsx`)

- `BookingDraft`: `bikeNote?: string` replaces `bike`. `description?: string`
  stays. `hadPhotos?: boolean` records that photos were added, for the
  refresh message.
- `Answer`: `{serviceId, questionId, choice?, text?, notSure?}`. A choice
  question may carry `choice`, `text`, both, or `notSure` (the "I'm not sure"
  pill, which takes the place of `choice`). A text question carries `text`.
  An answer with none of these is removed from the draft.
- Answers for services no longer ticked are already dropped by d2's Continue.
- A new guard `hasProblem(draft, services)`: the service check plus every
  required question answered and, for "Not sure", a description. The `date`
  screen (d4) requires it and sends the customer back to `problem`. d3 adds
  the guard and its tests; d4 applies it.

## Rules (`src/screens/book/problem-rules.ts`)

Pure functions, no React, taking the `ServicesResponse` and the draft:
- `questionGroups`: the ticked services with questions, in list order, each
  with its questions
- `setAnswer`: returns the answers with one question's pill or words changed
  (empty answers removed)
- `missingAnswers`: the required questions with no answer, in screen order
- `descriptionError`: the message or null
- `photosCleared`: whether to show the cleared message

The screen only calls these.

## Server piece 9 (prerequisite, own spec and PR)

Summarised here so d3 can be reviewed whole; piece 9's spec is the authority.
- The booking POST accepts `bikeNote` (trimmed, optional, at most 200
  characters), stored on the booking in a new column; no `customer_bikes` row
  is created from it.
- `description` is required only when `notSure` is true.
- A choice question's answer may carry `text` (at most 1,000 characters) with
  or without `choice`; a required choice question is answered by `choice`,
  `text`, or `notSure`.
- Staff see the note, "Bike (customer's words): …", wherever they already
  see a booking's description.

## Tests (written first, each watched failing)

- `tests/customer/problem-rules.test.js`: grouping and order (services with
  no questions skipped); `setAnswer` for pill, words, both, clearing, and the
  "I'm not sure" pill; `missingAnswers` for required and optional questions,
  answered by pill only, words only, or not at all; `descriptionError` for
  "Not sure" and ticked services; `photosCleared`.
- `tests/customer/problem-screen.test.js` (jsdom, the d2 helper):
  - services layout: headings per service, pills plus the words box, labels
    with "(optional)"
  - "Not sure" layout: no questions, required description, back link to the
    first screen
  - a tap, words, or both are saved to the draft as they change; typing
    survives a remount
  - each Continue message, the pinned summary, focus on the first problem
  - a good Continue navigates to `date`
  - the photos-cleared message after a remount with `hadPhotos`
- `tests/customer/require-draft.test.js`: `hasProblem`.
- `tests/customer/draft.test.js`: the new shape.
- `tests/browser/book-problem.spec.ts` (Playwright, 320×568): with a text box
  focused and the visible height reduced to that of a phone with its
  on-screen keyboard open, the focused box is entirely above the pinned area.
  This imitates the keyboard; it is not a real one (moved here from d2).

## Not in this piece

- Picking or adding a saved bike (needs sign-in in the booking app).
- The staff screen that turns the bike note into a bike record.
- The staff question-setup screen and its suggested wording.
- Video.
- `date`, `details`, `pending` (d4-d5).
