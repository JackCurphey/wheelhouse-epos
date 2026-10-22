# Proposal: the "Your answers" text after staff record an answer from a call

## Why
Journey 4 decision 4 (`docs/decisions/2026-10-01-drop-off-and-quote-review.md`):
staff can record the customer's answer taken by phone. The drawing of
Record their answer (dq-record-answer) says "Maya gets a text — the way Maya
chose — with what was agreed", and Settings › Messages draws "Your answers",
"When staff record the customer’s answer from a call" (setup.mjs). Jack, 22
Oct: "1: use the drafted Your answers wording."

## What changes
- **Messages**: "Your answers" (`your_answers`), live in Settings › Messages.
- **Server**: recording an answer by phone queues it straight away, with what
  is going ahead (and its cost) and what was declined.

## Risky areas
The messaging core. Reviewed.
