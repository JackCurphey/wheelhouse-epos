# Proposal: a bike's own page

## Why

Jack's answer of 15 Oct (`docs/decisions/2026-10-08-not-drawn-pages.md:109-122`,
#7 and #8): each bike has its own page, `cs-bike`, laid out as a customer's
page is. It is drawn and agreed (`customer.mjs:150-183`; `journeys.mjs:986`).
WP-3.2, Jack's lane. Found buildable by the 25 Oct workflow.

## What Changes

This pull request:
- **`GET /api/bikes/:id`:** the bike, who it belongs to, and every job on it
  newest first, each saying whether it's open (as the customer's history
  says it).
- **The page, `/workshop/bikes/:id`:**
  - back to the owner;
  - the bike's name with "[Customer]’s bike" and New job;
  - on the left, Details with Edit (Colour, Frame number, Note) and Belongs
    to (their name and phone, linking to their page);
  - on the right, "Jobs on this bike": Open now, then "Earlier, newest
    first", eight at a time with "Show all ([n])".
- **Edit** opens a box with Make, Model, Colour, Frame number and Note,
  saved through the existing `PUT /api/bikes/:id`.
- **New job** opens the diary's New job with the owner and this bike
  already chosen.
- **The customer's page** links each bike to its page.

The next pull request: finding a bike in the header search, by make, model
or frame number.

## Capabilities

### Modified Capabilities

- `customers`: a bike's own page.

## Out of scope

- **The Warranty block.** Nothing records a bike bought here yet, so it
  stays hidden rather than showing a made-up date.
- **A Cycle to Work bike's page:** not drawn.
