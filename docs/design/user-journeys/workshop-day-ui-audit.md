# Workshop day — UI/UX audit (Soft sand, dark rail look)

Audited: 25 desktop (1280×800) renders in
`/private/tmp/claude-501/.../scratchpad/audit/` — diary (week/day/mechanic),
waiting-column states, request pop-ups, diary settings, context menu, new
job (pick/form/day-view), job page at all seven stages, full service
checklist, customer page, workshop overview.

Read against `docs/decisions/2026-09-27-workshop-day-review.md` (54
decisions). Nothing below relitigates a decision Jack already made — where a
decision looks like it's costing him something, it's called out separately
in section 4, with the trade-off stated, not argued as a defect.

---

## 1. Overall verdict

The structure is right and it shows: one diary as the front door, requests
that open where you'd expect, a job page that actually holds everything
without tab-hunting, notes as the biggest thing on the page. The content
model (decisions 20, 30–40) is sound. What's letting it down is execution
detail that undercuts the model's own promises — most importantly, the
diary's status text truncates to unreadable fragments ("Sc...", "Wa...")
in exactly the view (Week) that's used most, on the same page whose own
settings screen promises "never truncates to something unreadable." A
second-tier of small inconsistencies — a template placeholder left un-filled
in the request pop-up, checkboxes that look smaller than the 44px promised
for a mechanic's fingers, a legend that doesn't visually match the blocks it
explains — are the kind of thing that erode trust in the system on day one,
even though none of them are hard to fix. Nothing here needs a rethink of
the plan; it needs a pass of finishing.

---

## 2. Findings, ranked by impact

### High impact

**H1 — Diary Week view: status text truncates to unreadable fragments,
contradicting the app's own promise.**
Screens: `diary-desktop`, `change-selected-desktop`, `request-*-desktop`
(diary visible behind the pop-up). Every block in Week view shows a second
line like "Sc...", "Wa...", "Re..." — the status word cut off mid-way. The
Diary settings page (`diary-settings-desktop`) states outright: "The status
is always shown — never colour alone — and never truncates to something
unreadable." The diary itself breaks that promise in the most common view.
Why it matters: at a glance is the whole point of a diary. If "Waiting for
parts" and "Ready" both read as "Wa..." vs "Re..." that's fine, but several
statuses share a first syllable-ish shape at small width and a mechanic
scanning fast will misread it, or just won't bother reading it and rely on
colour alone — which is the exact failure mode the settings page says it
avoids. Fix: don't truncate the status word — replace it with a short fixed
form that always fits (a single glyph or two-letter code alongside the
colour, e.g. a coloured dot + "Ready" only when width allows, dot alone
otherwise) rather than word-wrapping arbitrary text that may or may not fit.
See Structural idea S1.

**H2 — Diary legend doesn't visually match the blocks it explains.**
Screen: `diary-desktop` (and all diary screens), bottom legend row. The
legend renders as six plain outlined squares in what reads as the same
neutral tone; the actual blocks are tinted-fill with a full colour outline
(decision 45). A legend that doesn't reproduce the thing it's a key for
teaches nothing. Fix: legend swatches should be small tinted-fill +
outlined chips, identical in treatment to a real block, in the six status
colours.

**H3 — "Done" checkboxes in Work and parts look smaller than the 44px
promised for a mechanic.**
Screens: `job-mechanic-desktop`, `job-waiting-parts-desktop`,
`job-finished-desktop`, `job-collection-desktop` — the Done column.
Decision 34 explicitly raises "controls a mechanic presses" to 44px now,
not in a later look pass. In the table, the tick boxes read as
default-size checkboxes (roughly half that), sitting in a dense row with
six other columns. Why it matters: this is the control a mechanic — often
gloved, often glancing not looking — taps most often on the job page; it's
also the one place the spec was unusually specific about size. Fix: confirm
the actual rendered size in the build (not just the mock) and pad the
touch target to 44×44px even if the visible box stays small, the same
pattern used for "Bike is here" pill-buttons.

**H4 — Unrendered template placeholder in the new-request pop-up.**
Screen: `request-new-desktop`. The work line reads "Brake service ·
[price]" — literal square-bracket placeholder text, not a real value or a
sensible fallback like "Price to be confirmed." Why it matters: this is the
exact pop-up where staff decide whether to accept a customer's money-facing
request; a raw template tag reads as broken software in a place where trust
matters most. Fix: bind the real price, or render "Price to be agreed on
arrival" when there isn't one yet.

**H5 — The job-collection banner reads as ambiguous about what's already
happened.**
Screen: `job-collection-desktop`. The top banner says, in what reads as
past tense with a timestamp, "Bike handed to the customer or authorised
collector · Lock key and rear light returned … Taken at the Wheelhouse till
today at 16:52," with a "Paid" tag — but the primary button at the bottom
still says "Record collection," and Status still reads "Ready for
collection." It's not obvious on a first read whether the bike has already
gone out the door (and this is a receipt) or whether this is a checklist of
what "Record collection" is about to do. Why it matters: this is the
literal handover step — the shop's last chance to check the lock key and
rear light are back before the customer leaves. Ambiguity here risks a bike
going out with something missing, or double-confusion about whether payment
already happened. Fix: separate "payment taken" (already true, shown as a
fact) from "what Record collection will do" (a forward-looking checklist),
visually — e.g. the paid confirmation as a settled banner, and the
handover checklist as inline checkboxes next to the button, not prose that
reads like a past event.

### Medium impact

**M1 — Job header strip is one dense line and won't survive real names.**
Screens: all job-page stages. "Maya Patel · 07700 900 142 ·
maya@example.test · Trek Domane AL 3 · green · black mudguards · Kept on
Hook 3 · Mechanic: Alex Morgan" already nearly fills the width at 1280px
with a short name and a short bike description. A longer customer name, a
two-line address-style bike description, or a longer mechanic name will
wrap awkwardly or force the row to grow unpredictably. Fix: two rows —
identity (name · phone · email) and logistics (bike · storage · mechanic) —
so each has its own wrapping behaviour. See Structural idea S2.

**M2 — Spending-limit and ready-by chips are low-contrast for what they're
meant to do.**
Screens: all job-page stages, top-right of the Notes panel ("Customer OK
up to £200," "Ready by Thu 17 Sep," "Approved £111.00"). Decision 42 says
these exist so "a mechanic sees at a glance" whether extra work needs a
call first — but the chip background sits very close in tone to the page
background, and the text is small. This is the one piece of information on
the page that's supposed to prevent a mechanic doing unapproved work; it
shouldn't be the quietest thing on the page. Fix: darker chip background or
a coloured left-edge on the spending-limit chip specifically (it's the one
with a consequence if missed), kept small but not this quiet.

**M3 — Full service checklist shows an empty note box under every single
item, whether or not there's anything to say.**
Screen: `job-checklist-desktop`. All ten items get a full-width empty
textarea plus a caption ("Customer sees: All working well") underneath,
even the eight items with nothing written. Decision 21 makes the note
optional per item; the layout currently pays the same visual cost whether
it's used or not, making a mechanic scroll through a long page of empty
boxes to find the two items that matter. Fix: collapse to a tick + label by
default; clicking "add a note" (or the item itself) reveals the box for
that item only. See Structural idea S3.

**M4 — Overlapping jobs in the diary ("2 jobs · 09:00") don't look
clickable or explain what happens next.**
Screens: `diary-desktop`, `diary-desktop` Thu/Fri columns. When two jobs
share a slot, the block shows plain text "2 jobs · 09:00" with the two job
names stacked below — it reads as a summary label, not a control. Why it
matters: this is exactly the situation a busy shop hits often (two bikes
booked at once), and it's unclear from the block alone whether clicking it
opens a chooser, expands the slot, or does nothing useful. Fix: same
treatment as a single block (clickable, opens a small picker of the two
jobs) with a visual cue — a stacked-card look, not a plain text label —
that signals "there's more here, click to choose."

**M5 — Two "pill" controls with the same look sit in visually inconsistent
places.**
Screen: `new-job-desktop`. "New bike build or pre-delivery check" (top,
outside the two-column grid, before any customer is picked) and "The bike
is here now" (mid-right column, inside the grid) are both the same pill
control (decision 50), but nothing about their placement groups them as
the same kind of control. A shop owner scanning the form for "what are my
toggle choices here" has to notice two pills in two different rooms of the
layout. Fix: keep both pills in the same visual position relative to their
related field (e.g. both directly under/beside the field they modify), or
group them together in one row.

**M6 — Icon-only buttons on the job header have no visible label.**
Screens: all job-page stages, top-right of the header strip (inbox / mail /
hamburger-menu icons). No text, and the inbox-tray and envelope icons are
similar enough to hesitate over at a glance. Fix: tooltips at minimum;
consider a text label on the primary one (likely "Messages," matching
decision 49).

**M7 — Workshop overview's "Planned effort" card is a ratio with no
visual proportion.**
Screen: `overview-desktop`. "6h / 8h" communicates capacity but needs a
moment of mental maths; a thin progress/fill bar under the number would
tell the same story in zero reading time — worth doing given the card sits
beside two others that are pure counts and reads slower by comparison.

### Low impact / polish

**L1 — "Take payment" button carries an icon; its sibling primary buttons
don't** (`job-finished-desktop`). Pick one convention — icons on all
primary actions, or none.

**L2 — Customer page: WH-1042's "Work" column reads "approved £111"
instead of a service name** (`customer-desktop`), where every other row in
the same table shows the actual work done ("gear adjustment," "standard
service"). Reads like a data-binding slip — the approval amount has
leaked into the Work column. Worth checking against the real binding, not
just the mock.
**L3 — Status field on the job page is a plain HTML-style dropdown, while
"Bike is here" nearby is a pill-button** (`job-overview-desktop` and
throughout) — two different control languages for what are both
"current state" pickers on the same strip.
**L4 — Request pop-ups show "Mechanic: Shared workshop queue"** on Accept
(`request-new-desktop`) with no visual distinction from a named mechanic —
easy to miss that this one isn't assigned to a person yet.

---

## 3. Top structural ideas (for a before/after board)

### S1 — Diary block: status as an icon/dot, not truncated text, below a width threshold

**Screen:** `diary-desktop` (Week view), all seven day columns.
**Change:** Below a set column width (Week view, 7 columns @ ~95px), drop
the truncating status word entirely. Show: coloured left corner-flag
or a small coloured dot fixed to the block's top-right corner (colour =
status, matches decision 45's outline colour), plus the two content lines
(bike, job title) using the full width instead of losing a line to status
text. In Day view (wide columns), the status word can stay written out in
full since there's room.
**Stays the same:** tinted fill + full outline per decision 45; colour
mapping (blue/purple/amber/orange/green/grey); bike-then-title default
(decision 29); "No time" row; click-to-highlight/open behaviour.

```
BEFORE (Week column, ~95px wide)          AFTER (same width)
┌─────────────────┐                       ┌─────────────────┐
│ Giant Escape 2   │                       │ Giant Escape 2  ●│ ← dot, top-
│ Gear adjustm...  │                       │ Gear adjustment  │   right corner
└─────────────────┘                       └─────────────────┘
  "Sc..." lost, unreadable                  no truncated word;
                                             colour still carries status,
                                             backed by legend (S1 pairs
                                             with fixing H2's legend chips)
```

### S2 — Job header strip: split into an identity row and a logistics row

**Screen:** all job-page stages (`job-overview-desktop` etc.), the strip
under the title.
**Change:** One dense line becomes two short ones, each free to wrap on
its own terms.
**Stays the same:** customer name as a link (decision 24); all the same
fields shown; icon buttons at the right of the top row; mechanic shown as
plain text (decision 32); storage slot only when the shop has them on.

```
BEFORE (one line, ~1170px wide, already near full)
┌────────────────────────────────────────────────────────────────────┐
│ Maya Patel  07700 900 142  maya@example.test  Trek Domane AL 3 ·    │
│ green · black mudguards   Kept on Hook 3   Mechanic: Alex Morgan    │
└────────────────────────────────────────────────────────────────────┘

AFTER (two rows, each with headroom to wrap independently)
┌────────────────────────────────────────────────────────────────────┐
│ Maya Patel · 07700 900 142 · maya@example.test                      │
│ Trek Domane AL 3 · green · black mudguards · Hook 3 · Alex Morgan   │
└────────────────────────────────────────────────────────────────────┘
```

### S3 — Full service checklist: notes closed by default, opened on demand

**Screen:** `job-checklist-desktop`.
**Change:** Each item is a single row (tick + label) by default. A small
"+ note" link/icon on the row reveals that item's text box, in place,
without navigating away. Once a note exists, the row always shows it
(no re-hiding a written note).
**Stays the same:** two-column grid of items; "Customer sees: All working
well" copy for unticked-note items; full-screen pop-up (decision 39);
Done button; only appears for services with a checklist.

```
BEFORE (each item ~120px tall × 10 items ≈ 3–4 screens of scroll)
┌───────────────────────┐  ┌───────────────────────┐
│ ☑ Frame & fork         │  │ ☑ Chain & drivetrain   │
│ ┌───────────────────┐ │  │ ┌───────────────────┐ │
│ │ (empty)            │ │  │ │ (empty)            │ │
│ └───────────────────┘ │  │ └───────────────────┘ │
│ Customer sees: All...  │  │ Customer sees: All...  │
└───────────────────────┘  └───────────────────────┘

AFTER (collapsed rows, ~40px each; ~1 screen for 10 items)
┌───────────────────────┐  ┌───────────────────────┐
│ ☑ Frame & fork  +note  │  │ ☑ Chain & drivetr +note│
├───────────────────────┤  ├───────────────────────┤
│ ☑ Brakes bled & adj.   │  │ ☐ Cables & housing +nt │
│  "Rear pads worn..."   │  │                        │
└───────────────────────┘  └───────────────────────┘
   (note stays visible once written; others stay one line)
```

### S4 — Overlapping diary slot: a stacked-card control, not a text summary

**Screen:** `diary-desktop`, Thu/Fri "2 jobs · 09:00" blocks.
**Change:** Render as two thin overlapping card edges (like a card-fan)
behind the front job's block, so the shape itself says "there's more
underneath," with the count as a small badge. Clicking opens a short list
to choose which of the two to open, replacing today's plain "2 jobs ·
09:00" text label that reads as a caption rather than a control.
**Stays the same:** single-click-highlight / double-click-open pattern
elsewhere in the diary; block colouring; the underlying jobs unchanged.

```
BEFORE                              AFTER
┌───────────────────┐               ┌──────────┐┐
│ 2 jobs · 09:00     │               │ Giant Esc││  ← second card edge
│ Giant Escape 2     │               │ cape 2   ││    peeking out
│ Cannondale Q...     │               │ 2 ▸      ││  ← count badge
└───────────────────┘               └──────────┘┘
```

---

## 4. Worth reconsidering

At most three, each a genuine trade-off against a decision Jack already
made — not a case for reversing it outright.

1. **Decision 38: no name/timestamp on staff notes in the notes canvas.**
   Jack's reason was clarity — "no prompts or placeholder text anywhere in
   the box." The trade-off: once two or three staff are writing into the
   same plain-text box over a job's life, there's no way to tell who wrote
   what or when without asking. If a customer disputes "who told me it'd
   be £200," or a mechanic needs to know whether a note is from this
   morning or last week, the box can't answer that. A light-touch middle
   ground — a small greyed timestamp only, no name, right-aligned, easy to
   ignore when reading — would keep the box feeling like one continuous
   note while keeping an audit trail. Worth a second look before this ships
   to a shop with more than one member of staff on the same job.

2. **Decision 45: full outline instead of the left colour bar, combined
   with status text that has to truncate at small widths (see H1).** On
   its own, dropping the left bar for a full tinted outline is a fair
   look choice. Combined with Week view's narrow columns, though, it means
   colour is doing more of the identification work than the settings page
   promises it should — a full outline read at 95px wide is a thinner
   colour signal than a solid bar was. If S1 (dot/icon backup) isn't
   built, it may be worth keeping a slightly heavier edge specifically at
   Week-view width, even though it adds back a little of the visual weight
   item 45 was trying to remove.

3. **Decision 51: ready-by tied to the diary day, no separate field.**
   This is simpler and avoids two dates disagreeing — a real win. The
   trade-off: a shop sometimes wants to promise "ready by 5pm today" at
   drop-off distinctly from "ready by end of the day it's diarised," e.g.
   a bike booked in first thing that the customer needs back same
   afternoon versus one that's fine to collect anytime that day. Collapsing
   to "the diary day is the ready-by day" loses that finer promise. Given
   it's a small addition (a time picker next to the existing diary time,
   not a whole new date field), it may be worth keeping narrowly for
   same-day jobs rather than dropping entirely — but this is a minor
   reconsideration, not a strong objection.

---

## 5. Quick wins (fixable in minutes)

- Fix the literal `[price]` placeholder in `request-new` to a real value
  or "Price to be confirmed" (H4).
- Make the diary legend swatches tinted-fill + outlined, matching real
  blocks, instead of plain outlines (H2).
- Add tooltips to the three icon-only buttons on the job header (M6).
- Pick one icon convention for primary action buttons and apply it
  everywhere, or nowhere (L1).
- Check the Work column data binding for WH-1042 on the customer page —
  should read the service name, not the approval amount (L2).
- Add a thin fill bar under "Planned effort 6h / 8h" on the overview card
  (M7).
- Darken the spending-limit chip specifically (or give it a coloured
  edge) so it doesn't read at the same visual weight as "Ready by" (M2).
