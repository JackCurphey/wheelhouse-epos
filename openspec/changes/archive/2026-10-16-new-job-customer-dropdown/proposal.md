# Proposal: New job's customer search drops down over the form

## Why

Jack, 16 Oct, on the online test copy: typing a customer's name on New job,
the results (or "No customer matches …") appear under the box and push the
form down, so the pop-up grows and shrinks as he types, which is jarring.

## What Changes

- The matches, or "No customer matches “[text]”.", drop down over the form
  just under the search box, like most search boxes, instead of taking room
  in it (Jack: "1"). The pop-up stays one size.
- The list closes when a customer is picked, on Escape, or when the focus
  leaves the search; typing again opens it. It scrolls if there are many.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/new-job-dialog.tsx`. No server change.
- **Drawings:** `new-job` shows the chosen customer's card, not the search
  results while typing; this decides that gap
  (`docs/decisions/2026-10-16-workshop-test-copy-changes.md`).
- **Decisions:** none changed.

## Out of scope

- The job page's item search and any other search box.

## Impact

- `src/screens/diary/new-job-dialog.tsx`, `tests/screens/diary-new-job.test.js`,
  `tests/browser/diary-extras.spec.ts`, `workshop-diary`'s New job form.
