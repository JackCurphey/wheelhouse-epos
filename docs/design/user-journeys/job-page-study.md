# Job page study — analysis and variants

Written spec for the job page pop-up (decisions 15/16/20/30/31/32 in
`docs/decisions/2026-09-27-workshop-day-review.md`). This is analysis and
layout direction, not code or final look — colours/type will be revisited
later (decision 28); the constraint here is hierarchy and layout inside the
1280×800 pop-up, ~32px dimmed margin, over the diary.

Grounded in: the decisions doc, `generator/job-options.mjs` (options 1–6),
the renders in the scratchpad (`job-option-1.png` … `job-option-6b.png`),
`generator/ui.mjs` (Fjell tokens, DW/DH = 1280×800), and Jack's Citrus Lime
Cloud POS reference screenshot (27 Sep) and "Create a Workshop Job" dialog
(item 26).

---

## 1. Users and stages

| Who | Device | When they open the job | What they mostly do |
| --- | --- | --- | --- |
| **Front desk staff** | Desktop, mouse/keyboard | Booked in, quoting, waiting for parts, collection/payment | Read customer contact/bike details, check status, write a note ("customer called, running late"), chase approval, take payment, print. Rarely touches the checklist or the parts table. |
| **Mechanic** | Desktop or touchscreen tablet at the bench | In the workshop (the stage they live in) | Tick the checklist, add a note to a checklist item, scan a part in, occasionally write a note ("started, waiting on brake pads"). Barely touches customer contact fields. |
| **Manager** | Desktop | Any stage, but especially quoting/awaiting approval and finished | Skims everything at once — approved total, checklist progress, notes — to answer "where's this job at" without asking the mechanic. Occasionally reassigns by dragging in the diary (not on this page — decision 32). |

Stage → dominant action (decision 20, "each stage is the same page with that
stage's main action"):

| Stage | Dominant action on this page | Footer action |
| --- | --- | --- |
| Expected | Confirm details, note anything unusual before the bike arrives | "Book in" |
| Booked in | Confirm bike is here, storage slot, start the checklist | "Send quote" / "Start work" |
| Quoting / awaiting approval | Read the checklist findings, wait for/record customer decision | "Send quote" or shows "Awaiting approval" |
| In the workshop | **Tick checklist, scan parts, write notes** (this is the long-dwell stage — the study's worked example) | "Mark ready for collection" |
| Waiting for parts | Check what's on order, write a note when it arrives | "Mark ready for collection" (disabled/blocked with a reason) |
| Finished | Confirm nothing's missing before the customer comes | "Take payment" (decision 1) |
| Collection / payment | Take payment, hand back | "Take payment" / "Complete job" |

This spec designs the **in the workshop** stage in full (Jack's worked
example) and notes, per variant, which sections default open/closed at the
other stages.

---

## 2. Information inventory

Legend: **must-see** = visible without any click, every time the page opens
at a relevant stage. **one-glance** = visible in summarised form (count,
status, latest item), full detail one click away. **one-click** = fully
behind a fold or a "Show all"/"See all".

| Item | Who needs it | Stages | Priority | Notes |
| --- | --- | --- | --- | --- |
| Job title + status chip | Everyone | All | must-see | Header. |
| Job number (WH-1042) | Everyone (reference on the phone, in emails) | All | must-see, small | Mono, low visual weight — identifier, not content. |
| Customer name (link to account) | Front desk, manager | All | must-see | Decision 24. |
| Customer phone / email | Front desk | All | must-see | For calling/emailing without leaving the page. |
| Bike (+ colour) | Mechanic, front desk | All | must-see | |
| Storage slot ("Kept on Hook 3") | Mechanic, front desk | Booked in → finished | must-see if shop uses slots (decision 27), else absent | |
| Mechanic name (plain text) | Everyone | All | must-see | Decision 32 — no select, plain text in the customer strip. |
| Message / email / notes icon buttons | Front desk | All | must-see (icons), action one-click | Reuses existing channels (decision 2). |
| Created date/by | Manager, front desk (rarely) | All | one-glance | Provenance, not action. |
| Ready-by date | Everyone | All | must-see | Governs urgency. |
| Diary time | Front desk, manager | All | one-glance | Duplicates the diary itself — could arguably drop to one-click; kept one-glance since it explains "why is this slot busy" without leaving the job. |
| Status (dropdown) | Front desk, manager | All | must-see, real control | The one field on this page that actually changes stage. |
| "Bike is here" tick | Front desk | Expected → booked in | must-see at early stages, one-glance after | Becomes historical fact once ticked. |
| "New bike build" tick | Front desk | Expected/booked in only | one-glance, mostly irrelevant after booking | Could fold away once ticked or once in the workshop. |
| Approved total / declined flag | Everyone | Quoting onward | must-see (as a badge) | |
| **Notes** (customer's told-us + staff notes, combined) | Mechanic, front desk, manager | All, heaviest at in-the-workshop | **must-see, largest region** | Decision 31 — this is the actual finding: writing notes is what staff do most when they open a job. Customer's note must read as the customer's (decision 31), not blended anonymously. |
| Checklist (10 items, tick + optional note) | Mechanic (writes), everyone (reads progress) | Booked in → finished | one-glance (count/progress) normally, must-see while actively working through it | Decision 21 — items carry an optional note. At the in-the-workshop stage this is being actively worked, so it earns more visibility than at other stages, but the notes box is still the single biggest thing (Jack's explicit ranking). |
| Work and parts (table: code, description, done, note, qty, price, total, approval) | Mechanic (scans items), front desk/manager (checks total) | Quoting onward | one-glance by default (summary: n lines, total, declined count), must-see the row being scanned right now, full table one-click | Decision 31 — "generally all you'll be doing is just scanning an item in." A full always-open table is overkill for a scan-and-go action; a bare "click to see the table" line loses the sense that anything's in progress (option 6's mistake — see §3). |
| Messages (latest + count) | Front desk | All | one-glance | Icon button with count is enough; full thread is a click away (existing Messages page, decision 2). |
| History / activity log | Manager mainly | All | one-click | Nobody asked for this on this page in Jack's notes; kept reachable, not shown by default. |
| Footer actions (Unschedule, stage action) | Front desk, manager | All | must-see | Decision 1's "Take payment" swaps in at finished/collection. |

**Dropped from options 1–4** (superseded by decisions 30/31): "What the
customer told us" as its own panel — folded into notes (decision 31).
Separate rails for messages/history as their own always-on panels — these
are one-click, not must-see; nobody in Jack's notes asked to see the full
message thread or the history log without a click.

**Flag — possibly missing, not in any decision:** there's no visible
indicator on this page of *unread* customer messages (just a count). If a
customer messages while a mechanic is mid-job, a plain count doesn't say
"new since you last looked." Raising this as a separate suggestion, not
building it in — it's out of scope for decisions 1–32.

---

## 3. Diagnosis: option 5 vs option 6

**What 5 gets right:**
- Generous, legible card structure — each region (job details, work and
  parts) is a bordered panel with real padding, a heading, and breathing
  room. Nothing reads as crammed.
- The job details card keeps two clearly separated jobs: a left column of
  *controls* (status, ready-by, ticks) and a right column of *reading*
  (the customer's concern, a notes field). That's a sound split even though
  the specific content in each column needs to change.
- Work and parts as a real table, open by default, reads as "this job has
  four lines, one declined, £111 approved" at a glance — you can see the
  job's shape without clicking anything.
- It matches Jack's actual reference (Citrus Lime) closely enough that
  muscle memory carries over for anyone who's used that system.

**What's wrong with 5** (both against decision 31/32, not style):
- A mechanic select is shown — decision 32 removes it entirely; the
  mechanic is diary-assigned and shown as plain text only.
- "What the customer told us" is its own small quote box, separate from
  "Staff notes" (a single-row textarea) — decision 31 wants one notes box,
  with the customer's words inside it, marked as theirs.
- The notes area is the smallest, least prominent thing in the job details
  card (a 1-row textarea) — the opposite of "writing notes is the main
  thing a staff member does" (decision 31).

**Where 6 overcorrected:**
- 6 solved notes prominence by **pulling notes out into a brand-new,
  full-width top-level section** below job details, sized to dominate the
  page. That costs space everywhere else: job details had to compress from
  a generous two-column card into two dense, tightly-wrapped rows with
  11px labels and everything — mechanic-status-time-ready-by-ticks-tags —
  fighting for one strip. That's not what decision 31 asked for ("a
  compact strip", not an illegible one).
- Work and parts also lost its table entirely, collapsing to a single line
  with a "Show all" link. That's more compression than "small by default"
  needs — Jack's own phrasing was "a summary with Scan barcode / Add item
  ready", not "invisible until clicked." A mechanic scanning a part in
  should be able to see roughly what's already logged without opening
  anything.
- Net effect: 6 fixed the two real defects in 5 (mechanic field, notes
  size) but paid for it by breaking the two things 5 did well (legible
  compact-but-readable details, an at-a-glance parts table). That's
  consistent with Jack's "I like 5 more" — he's reacting to the loss of
  breathing room and glanceability, not asking to undo the notes/mechanic
  fixes.

**What decision 31 is actually asking for, read literally:** "one notes
box" and "job details are a compact strip" are two separate instructions —
they don't require notes to become an entirely new top-level section. In
Jack's own Citrus Lime reference (the prompt's structure notes), the large
notes box lives **inside** the "Workshop Job Information" section, in its
own right-hand column, not as a fourth top-level region. Making the notes
column of the details section generously tall — rather than inventing a
new section for it — may get prominence without option 6's collateral
damage. That's the specific hypothesis the variants below test.

---

## 4. Evaluation criteria (weighted, out of 20)

1. **Notes speed/prominence (4)** — how quickly can a staff member start
   typing a note on open, and how much of the page is notes; does the
   customer's note read as clearly theirs (decision 31).
2. **Scan-a-part speed and visibility (3)** — how many clicks/taps to log a
   scanned item, and whether the existing lines are visible without
   opening anything (decision 31's "generally all you'll be doing is
   scanning an item in").
3. **Glanceability of job state at a stage change (3)** — opening the page
   cold, how fast can you answer "what stage, what's approved, what's
   still owed, is anything blocked" — matters most for front desk/manager.
4. **Density without cramping (3)** — no region under ~14px body /12px
   label text, no fold header doing double duty as a data field, no
   wrapping chaos at 1280px (option 6's job strip risk).
5. **Citrus Lime muscle memory (2)** — a shop switching from Citrus Lime
   recognises the shape (title bar → customer strip → details → items →
   footer) even if it isn't pixel-identical.
6. **Touch-friendliness for the mechanic (2)** — checklist ticks, done
   checkboxes, scan/add buttons all ≥44px and reachable without precise
   pointing, notes composer easy to tap into.
7. **Fits 1280×800 with no internal scroll (2)** — every region's default
   state must sum to the available body height with room to spare, at
   every stage, not just the worked example.
8. **Stage adaptability (1)** — how gracefully the same layout re-flows
   when checklist/work-and-parts genuinely have nothing to show yet
   (expected stage) versus everything (finished stage).

---

## 5. Variants

Shared across all five: title bar (job title + status badge + close),
tinted customer strip (name link, phone, email, bike, storage slot,
**mechanic: plain text**, 3 icon buttons), footer (Unschedule red left /
stage action right). These are unchanged from option 5/6 and not redrawn
per variant except where noted. Dialog body available height ≈
800 − 32(top margin) − 32(bottom margin) − ~50(title bar) − ~46(customer
strip) − ~56(footer) ≈ **584px**, width 1280 − 2×32 = **1216px**, minus the
dialog's own ~22px side padding ≈ **1172px** usable body width.

Example job for all variants: WH-1042, Maya Patel, Trek Domane AL 3 ·
green, in the workshop with Alex Morgan, Hook 3, 10-item checklist (8
done, 1 with a note), 4 agreed lines £111.00 approved with 1 declined
(gear cable), notes: 1 customer note (from booking) + 2 staff notes.

### Variant A — "Faithful Five" (minimal refinement)

One-line idea: keep option 5's card structure almost exactly; only change
what decision 31/32 require — remove the mechanic select, and let the
details card's right column *become* the notes box instead of a tiny
staff-notes field, with the customer's note as the first entry.

```
┌─ Job details ───────────────────────────────────────── 1172×230 ─┐
│ WH-1042 · Created Thu 17 Sep · by Jo Taylor      [Ready by][Approved]│
│ ┌─ left 420px ──────────┐ ┌─ right 700px: NOTES ─────────────────┐ │
│ │ Status [In workshop ▾] │ │ [Write a note…            ] [Add]   │ │
│ │ Diary time  Thu 11:30  │ │ ── feed, newest first ──────────────│ │
│ │ Ready by    Fri 18 Sep │ │ Alex Morgan · 12:10  "Rear pads..." │ │
│ │ ☑ Bike is here         │ │ Jo Taylor · 09:05  "Booked in..."   │ │
│ │ ☐ New bike build       │ │ [Customer] Maya Patel · from booking│ │
│ │                        │ │   "My rear brake squeals..."        │ │
│ └────────────────────────┘ └──────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
┌─ Work and parts — expanded table ───────────────────── 1172×250 ─┐
│ [+ Add item] [Scan barcode] [Print]                                │
│ Code | Work/part | Done | Note | Qty | In stock | Price | Total |  │
│ Approval  — full 4-row table, as option 5 —                        │
│                                          Approved total   £111.00  │
└──────────────────────────────────────────────────────────────────┘
┌─ Checklist ▸ Standard service checklist · 8 of 10 done · 1 note ── 36px ─┐
└──────────────────────────────────────────────────────────────────┘
```

- **Job details**: expanded, always (no fold, per decision 31 — the chevron
  in option 5's render is vestigial and should go). Left column: real
  controls only (Status select — no Mechanic; diary time/ready-by as plain
  text; two ticks). Right column: the notes box, now the visibly larger
  of the two columns, composer pinned at top, feed below.
- **Work and parts**: full table, open by default (as option 5) — this
  variant does *not* shrink it, testing whether notes can grow inside the
  details card without needing to steal space from the table.
- **Checklist**: folded, one-line summary (as option 5/6).
- Demoted: nothing beyond option 5 already demoted (messages/history stay
  icon+count / not shown).
- Type: title 18px, section headings 15px, body 14px, labels 11–12px
  (matches option 5).
- Other stages: Booked in/expected — work-and-parts table replaced by its
  empty state ("No items yet — Add item"), checklist folded showing
  "0 of 10 done"; details card ticks become the live controls (front desk
  is actively checking "Bike is here"). Finished — footer swaps to "Take
  payment"; work-and-parts stays open (everything's done, worth showing).

### Variant B — "Compact strip + standalone notes + mini-table"

One-line idea: take decision 31 at its most literal — a genuinely compact,
single-purpose strip at the top; notes as their own full-width section
(like option 6) but sized to leave visible room for a real, if small,
parts table instead of a bare link.

```
┌─ Job strip ── WH-1042 · Created Thu 17 Sep      [Ready by][Approved] ── 60px ─┐
│ Status[▾] · ☑ Bike is here · ☐ New bike build           Diary Thu 11:30–13:00│
└────────────────────────────────────────────────────────────────────────────┘
┌─ Notes ──────────────────────────────────────────────────────── 1172×300 ─┐
│ [Write a note…                                              ] [Add note] │
│ Alex Morgan · Thu 12:10 — "The rear pads are worn..."                     │
│ Jo Taylor · Thu 09:05 — "Bike booked in, tag printed."                    │
│ [Customer] Maya Patel · from booking — "My rear brake squeals..."         │
└────────────────────────────────────────────────────────────────────────┘
┌─ Work and parts ── mini-table, 2 of 4 rows shown + "and 2 more" ── 130px ─┐
│ [Scan barcode] [Add item]                    4 lines · £111.00 · 1 declined│
│ Standard service          Done  £65.00                                     │
│ Shimano brake pads (worn) Done  £28.00                     [Show all rows] │
└────────────────────────────────────────────────────────────────────────┘
┌─ Checklist ▸ 8 of 10 done · 1 note ─────────────────────────────── 36px ─┐
```

- **Job strip**: single row, ~60px not 2×32px — drops diary time to the
  right edge rather than wedging it between labels (6's crowding problem);
  ready-by/approved stay as badges on the right of the header line, not
  crammed into the control row.
- **Notes**: its own section, biggest region on the page — but this is
  the same structural move as option 6; the difference from A is testing
  whether *just* fixing the strip's crowding and giving the table real
  rows is enough to earn Jack's "I like 5 more" back, without retreating
  notes into the details card.
- **Work and parts**: default state shows the 2 most recent/relevant
  rows (not just a count) plus Scan/Add always visible — restores some of
  the glanceability 6 lost, without the full 5-row table's height cost.
- Type: strip labels 12px, body 14px throughout; notes text 14px.
- Other stages: strip's controls stay constant; notes stays constant size
  at every stage (it's the anchor); mini-table's row count adapts (0 rows
  shown pre-quote, full "and N more" once items build up); checklist
  folded until booked in, when it unfolds by default until the first
  ticks land, then folds again once >50% done.

### Variant C — "Side rail + notes column"

One-line idea: transpose the layout — a narrow left rail carries the
compact controls, mini-table and checklist toggle; the entire right column,
full height, is notes. Tests whether notes benefit more from height than
width.

```
┌─ left rail 380px ──────────┐┌─ right: NOTES, full height ── 780×584 ──┐
│ Job details (compact card) ││ [Write a note…                    ][Add]│
│  WH-1042 · 17 Sep · Jo T.  ││ ── feed ──────────────────────────────  │
│  Status [In workshop ▾]    ││ Alex Morgan · 12:10                     │
│  ☑ Bike is here            ││  "The rear pads are worn..."            │
│  Ready by Fri 18 Sep [tag] ││ Jo Taylor · 09:05                       │
│  [Approved £111.00 tag]    ││  "Bike booked in, tag printed."         │
├─────────────────────────────┤│ [Customer] Maya Patel · from booking   │
│ Work and parts ▾            ││  "My rear brake squeals and feels      │
│  4 lines · £111 · 1 decl.  ││   weak. The gears could use a           │
│  [Scan barcode][Add item]  ││   tune-up too."                         │
├─────────────────────────────┤│                                          │
│ Checklist ▸ 8/10 · 1 note  ││                                          │
└─────────────────────────────┘└──────────────────────────────────────────┘
```

- **Left rail**: 380px, stacked cards — job details (compact, no fold),
  work-and-parts (folded to one summary line + Scan/Add, since the rail is
  narrow — a table wouldn't fit at 380px without wrapping badly), checklist
  (folded).
- **Right column**: notes only, full 584px height — most vertical room of
  any variant, genuinely the largest single region on the page.
- Risk this variant is designed to surface: is a narrow rail too cramped
  for the details card and the parts summary, even compact? (Ties to
  criterion 4.)
- Type: rail labels 11px (narrow column forces this down near the floor —
  flagged, not assumed acceptable), notes 14–15px (has room to be larger
  since it owns a whole column).
- Other stages: rail's work-and-parts card is the one that changes most —
  empty/greyed before quoting, a green "Approved" tag once agreed; notes
  column never resizes, which is the point of this variant — it's a
  constant-size scratchpad regardless of stage.

### Variant D — "Notes and checklist paired, work as a slim bar"

One-line idea: put notes and checklist side by side (both are things a
mechanic reads/writes while working), and demote work-and-parts to a
single slim always-visible bar — testing the "checklist and notes share a
column" axis directly, and the most aggressive demotion of the parts table
of any variant.

```
┌─ Job strip (compact, as variant B) ────────────────────────── 60px ─┐
└────────────────────────────────────────────────────────────────────┘
┌─ Notes 700px ───────────────────┐┌─ Checklist 472px ─────────────────┐
│ [Write a note…          ][Add]  ││ Standard service checklist 8/10   │
│ Alex Morgan · 12:10             ││ ☑ Frame & fork      ☑ Gears        │
│  "The rear pads are worn..."    ││ ☑ Wheels & tyres    ☑ Chain        │
│ Jo Taylor · 09:05               ││ ☑ Tyre pressure     ☑ Bottom bkt   │
│  "Bike booked in..."            ││ ☑ Brakes· note      ☑ Headset      │
│ [Customer] Maya · from booking  ││ ☐ Cables & housing  ☐ Bolts torqued│
│  "My rear brake squeals..."     ││ (2-col, all 10 visible, no scroll) │
└──────────────────────────────────┘└─────────────────────────────────┘
┌─ Work and parts — slim bar: 4 lines · £111.00 · 1 declined  [Scan][Add][Show all] ─ 56px ─┐
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Notes/Checklist row**: ~430px tall, two panels side by side — notes
  700px (wider, since it's the priority), checklist 472px (all 10 items
  visible at once in two 5-item columns, no fold needed — it's a fixed
  10-item list, so showing all of it isn't a density risk the way an
  open-ended parts table would be).
- **Work and parts**: the one region reduced to a bar, not even a
  mini-table — riskiest demotion of any variant against criterion 2 (a
  mechanic can't see what's already logged without a click). Included
  specifically to test whether that risk is real or whether "usually you
  just scan" means a bar is genuinely enough.
- Type: notes 14px, checklist item labels 14px + 12px note sub-line
  (matches option 1/4's checklist treatment), slim bar 13px.
- Other stages: checklist panel collapses to a single summary line when 0
  items exist yet (expected/booked in, before work starts) — freeing that
  width for notes to go full-width temporarily; work-and-parts bar
  disabled/greyed pre-quote.

### Variant E — "Six, fixed" (stack, corrected)

One-line idea: keep option 6's full-width top-to-bottom stack (which Jack
saw and reacted to), but repair its two specific faults — breathing room
in the details strip, and a real (if small) glimpse of parts — without
adopting a card/column structure at all. This isolates whether the stack
shape itself was the problem, or just its execution.

```
┌─ Job strip — two breathing rows, not cramped ──────────────── 90px ─┐
│ WH-1042 · Created Thu 17 Sep · by Jo Taylor      [Ready by][Approved]│
│ Status [In workshop ▾]      ☑ Bike is here    ☐ New bike build      │
│                                          Diary: Thu 17 Sep 11:30–13:00│
└────────────────────────────────────────────────────────────────────┘
┌─ Notes — largest region ──────────────────────────────────── 1172×290 ─┐
│  (identical composer + feed to variant B)                              │
└────────────────────────────────────────────────────────────────────┘
┌─ Checklist ▸ 8 of 10 done · 1 note ───────────────────────────── 36px ─┐
┌─ Work and parts — mini-table (2 rows + count, not link-only) ── 118px ─┐
│ [Scan barcode] [Add item]                4 lines · £111.00 · 1 declined│
│ Standard service   Done  £65.00                                        │
│ Shimano brake pads Done  £28.00                          [Show all rows]│
└────────────────────────────────────────────────────────────────────┘
```

- Nearly identical content to variant B; the difference is emphasis and
  ordering — E keeps option 6's original section order (details → notes →
  checklist → work) with checklist above work, while B puts work directly
  under notes and checklist last. Included as a close pair to B so the
  drawings can show whether ordering (not just row height) affects how
  "settled" the page feels — Jack's reaction to 6 may have been about
  order as much as density.
- Type: identical scale to variant B.
- Other stages: identical adaptation pattern to variant B.

---

## 6. Hypothesis and what the drawings need to confirm

**Hypothesis: Variant A ("Faithful Five") is the strongest starting
point.** Reasoning: Jack's own preference signal — "I like 5 more" — is
about what 6 cost him (breathing room, glanceability of parts), not about
wanting less notes prominence; and his description of the Citrus Lime
reference already puts the large notes box *inside* the job-details
section, not as a new top-level region. Variant A is the only one that
takes that literally: it fixes both of 5's real defects (mechanic field,
notes size) by growing the existing right column rather than inventing a
new section, so nothing else on the page has to shrink to pay for it.

Variant B is the fallback hypothesis if A's details card, even with a
tall notes column, still doesn't read as "notes-first" enough once drawn —
B keeps the standalone notes section Jack's decision 31 wording literally
asks for ("one notes box... large and prominent") but fixes 6's specific
execution faults.

**What to check in the drawings:**
- **A**: does a notes column inside the details card actually look and
  feel prominent, or does the surrounding chrome (labels, controls, card
  border) make it read as "a big text field in a settings panel" rather
  than "the main thing on the page"? If reviewers reach for the standalone
  section instead, that's evidence against the hypothesis.
- **B vs E**: does section order (work directly under notes, checklist
  last, vs. checklist above work) change how settled the page feels at a
  glance? If they're indistinguishable, drop one.
- **C**: does the 380px rail feel cramped for the details card and parts
  summary (label sizes at the 11px floor)? If so, C is eliminated on
  criterion 4 regardless of its notes column being the tallest.
- **D**: is the work-and-parts bar (no visible rows at all) actually a
  problem in practice, or does "usually you just scan" mean nobody needs
  to see existing lines? This is the sharpest test of criterion 2 across
  all five variants.
- Across all: confirm nothing drops under the 14px body/12px label floor,
  and that every variant's default-state heights actually sum to ~584px
  at 1280×800 with no internal scroll, at every stage listed, not just
  "in the workshop."

---

## 7. Review of the drawings (A, B, E)

Only A, B and E were drawn — C and D were dropped once decision 33 landed
(Jack, comparing options 5 and 6: he prefers 5, and "seeing the work and
parts list straight away is part of why. I really just want it to be kind
of a refined version of [Citrus Lime's job page]." C and D both demote the
parts table further than 6 did, so they were no longer worth drawing.)

### 7.1 Weighted scores

Decision 33 changes the weighting from §4, not just the content: "parts
visible straight away, refined Citrus Lime" pulls weight onto criterion 2
(scan-a-part visibility) and criterion 5 (Citrus Lime muscle memory) — those
are the two criteria that directly test what Jack said, in these words, on
28 Sep. That weight has to come from somewhere, so it comes off criteria 6
and 4, which none of the three drawings actually distinguish much on (all
three have the same touch-target problem; all three fit the 584px body).
Revised weights, still out of 20:

| # | Criterion | §4 weight | Revised weight | Why moved |
| - | --- | --- | --- | --- |
| 1 | Notes speed/prominence | 4 | 4 | Unchanged — still real, just no longer the only priority. |
| 2 | Scan-a-part speed/visibility | 3 | **5** | Item 33 is this criterion, almost word for word. |
| 3 | Glanceability of job state | 3 | 3 | Unchanged. |
| 4 | Density without cramping | 3 | **2** | All three drawings clear the 12px/14px floor; not a distinguishing test here. |
| 5 | Citrus Lime muscle memory | 2 | **3** | Item 33 names Citrus Lime directly as the target to refine, not depart from. |
| 6 | Touch-friendliness | 2 | **1** | All three drawings share the same undersized-button defect (§7.2) — doesn't distinguish them, so it can't carry as much weight in *this* comparison. Still a real defect, fixed in §7.3 regardless of which variant wins. |
| 7 | Fits 1280×800, no scroll | 2 | 2 | Unchanged. |
| 8 | Stage adaptability | 1 | 1 | Unchanged. |
| | **Total** | **20** | **20** | |

| Criterion (weight) | A | B | E |
| --- | --- | --- | --- |
| Notes prominence (4) | 3 — tall right-hand column, but framed as a form field inside the details card (11px "NOTES" caption, card border), competing visually with the table below it for size. | 4 — full-width standalone section, plainly the biggest block on the page. | 4 — same standalone section as B. |
| Scan-a-part visibility (5) | 5 — all 4 lines, every column (code, note, qty, price, approval), visible with no click. This is what decision 33 is asking for. | 3 — only 2 of 4 rows shown, and the item note ("worn") that explains why the part's on the job is dropped; "Show all rows" needed for the rest. | 3 — same mini-table as B; pushed to the very bottom of the page (last section, below checklist), so it's the drawing that delays "parts visible straight away" furthest. |
| Glanceability (3) | 3 — one card, badges top-right, status/ready-by/ticks together, nothing fragmented. | 2 — diary time is floated to the far right of the strip, separated from status/ticks by a wide gap; reads as two strips, not one. | 3 — the two-row strip gives status/ticks and diary time each their own line, which reads more settled than B's single cramped row. |
| Density (2) | 2 — generous, no cramping; costs some dead space at the bottom (see §7.2). | 1 — the mini-table has no column headers, so "Done £65.00" doesn't say whether that's a unit price or a line total. | 1 — same header-less mini-table problem. |
| Citrus Lime memory (3) | 3 — closest recreation: card-based details, full open table, matches Jack's reference most directly. | 1 — notes as a new top-level section and parts summarised to 2 rows is a bigger structural departure from Citrus Lime than option 5 was. | 1 — same departure as B, plus parts is now the last section rather than near the top. |
| Touch-friendliness (1) | 0 — Add button and checkboxes read at roughly 30–32px tall, under the 44px floor. | 0 — same defect. | 0 — same defect. |
| Fits 800×no scroll (2) | 2 — fits with room to spare. | 2 — fits. | 2 — fits, tighter bottom margin than A or B. |
| Stage adaptability (1) | 1 — full table stays open at every stage; worth checking it doesn't get long at "finished" with many approved lines, but nothing in the drawing breaks. | 1 — mini-table and notes both resize sensibly by stage. | 1 — same as B. |
| **Total /20** | **18** | **13** | **15** |

A wins clearly under both the original and the decision-33-adjusted
weights — decision 33 just widens the gap, because it's scoring exactly
the thing A does and B/E don't: showing the real parts table, not a
2-row summary with a "show all" link.

### 7.2 Concrete defects per drawing

**A**
- The "Work and parts" heading has a down-chevron (⌄) next to it, which
  reads as a fold/collapse control. Decision 33 says this table stays
  visible, not folds to one line — the chevron shouldn't be there, or
  if a genuine collapse is ever wanted it should be a plain text
  "Collapse" link, not a disclosure triangle that implies the table's
  default state is negotiable.
- The declined row strikes through both the price and the total column
  (£12.00 and £12.00) — redundant; strike the total only, it's the one
  that says "not counted."
- There's roughly 40–50px of empty white space between the folded
  checklist row and the footer buttons — not a cramping problem, but
  wasted room that could go to slightly more breathing space around the
  notes/table above, or show one more note line.
- Notes feed order is "newest first" for the two staff notes (Alex
  12:10, then Jo 09:05) but the customer's note — timestamped earliest,
  Wed 16 Sep — sits last regardless. That reads as an inconsistency
  unless it's a deliberate "customer note always anchored at the
  bottom" rule; right now it looks like a sort bug.
- Add button and the two checkboxes ("Bike is here", "New bike build")
  are noticeably under the 44px touch floor (approx. 30–32px) — a
  problem for the mechanic on a tablet specifically (criterion 6).
- Labels ("Status", "Diary time", "Ready by", column headers) sit right
  at the 12px floor with no headroom, confirmed by the generator's own
  note that A was built to fit by measurement at that floor — fine on
  a desktop screen, worth re-checking once real fonts (decision 28)
  are in, since some typefaces read smaller at 12px than others.

**B**
- The mini-table rows have no column headers — "Standard service ...
  Done £65.00" doesn't say whether £65 is a unit price, a total, or
  something else. A's full table avoids this by keeping "Price" and
  "Total" as labelled columns; B's summary drops the labels along with
  the rows.
- The drawer's build note confirms the "(worn)" qualifier was dropped
  from "Shimano brake pads" — that's the one piece of context (why this
  part is on the job) that made a 2-row summary worth showing at all;
  without it the row is just a name and a price.
- "Show all rows" sits alone on its own line under the second row,
  right-aligned, disconnected from the "4 lines · £111.00 · 1 declined"
  summary at the top of the section — it's easy to miss, and the count
  and the action live in two different places in the same small block.
- The job strip floats "Diary Thu 17 Sep 11:30–13:00" hard right, well
  separated from "Status / Bike is here / New bike build" on the same
  row — the strip reads as two unrelated fragments rather than the
  single compact row decision 31 asked for.
- Checklist is the last section on the page, below both notes and
  work-and-parts — for the in-the-workshop stage, which is specifically
  the stage where the checklist is being actively worked, that's an
  odd place to park it.

**E**
- Same missing-headers and dropped-"(worn)" defects as B (identical
  mini-table).
- Work and parts is the very last section on the page — below notes
  and the checklist. Of all three drawings this is the one that
  buries parts furthest from the top, which runs directly against
  decision 33's "visible straight away."
- Same orphaned "Show all rows" placement as B.
- The two-row job strip (90px vs B's 60px) reads calmer than B's single
  cramped row, but it's spending extra vertical height that isn't
  available if a shop's checklist or notes feed is longer — worth a
  check at "finished" (10/10 checklist, longer notes history) rather
  than assuming the worked example's proportions hold everywhere.

### 7.3 Recommendation

**Variant A**, with the following refinements before it's handed to
`frontend` as the final in-the-workshop layout:

1. Remove the disclosure chevron on "Work and parts". Replace with a
   plain static heading (matching "Checklist" and "Notes" heading
   style) — no fold affordance. The table is always expanded at this
   stage.
2. Give the notes column real visual weight instead of just extra
   height: heading size up from the 11px form-field caption to match
   the other section headings (15px, per §5's type scale), and a
   subtle tint or left accent border on the notes column so it reads
   as a feature, not a form field inside a settings card. This is the
   cheapest way to answer §6's open question ("does a notes column
   inside the details card actually read as prominent") without
   inventing a new top-level section.
3. Fix the notes feed order: newest first, no exception — including
   the customer's note. If a "customer note always visible regardless
   of age" rule is wanted instead, say so explicitly and pin it with a
   visual marker (e.g., always top, not always bottom).
4. Declined row: strike through the Total column only, not Price.
5. Raise all tap targets to at least 44px tall: the notes "Add"
   button, the "Bike is here"/"New bike build" checkboxes (or at least
   their tap area), the checklist row's done-checkboxes, and "Add
   item"/"Scan barcode"/"Print" buttons in the work-and-parts header.
   This applies regardless of which variant ships — it's a drawing-wide
   defect, not specific to A — but list it here since A is the one
   going forward.
6. Use the freed space at the bottom (the ~40–50px gap above the
   footer) to either show one more line of the notes feed by default,
   or leave it as intentional breathing room — but make the choice
   deliberately rather than by accident of the table's height.
7. Keep the left column exactly as drawn: Status select, Diary time,
   Ready by, Bike is here, New bike build — no mechanic field (decision
   32 confirmed correct in the drawing).
8. Keep the full 8-column work-and-parts table (code, work/part, done,
   note, qty, in stock, price, total, approval) exactly as drawn — this
   is the piece decision 33 is specifically endorsing; don't shrink it
   in a later pass without checking with Jack first.

### 7.4 How Variant A adapts at the other stages

| Stage | Job details strip | Notes | Checklist | Work and parts | Footer |
| --- | --- | --- | --- | --- | --- |
| Expected | Ticks ("Bike is here", "New bike build") are the live controls staff are about to use | As drawn, usually just the customer's booking note so far | Folded, "0 of 10 done" | Empty state: "No items yet — Add item" | "Book in" |
| Booked in | "Bike is here" gets ticked here | As drawn | Unfolds by default until the first tick lands, then folds again | Table starts populating as work is agreed | "Send quote" / "Start work" |
| Quoting / awaiting approval | Unchanged | Staff notes about the quote conversation likely appear here | Folded | Table shows proposed lines with a pending-approval badge instead of "Approved" | "Send quote", or a static "Awaiting approval" state |
| In the workshop | As drawn (worked example) | As drawn — heaviest use | Folded, live progress count | Full table open, as drawn | "Mark ready for collection" |
| Waiting for parts | Unchanged | A note about what's on order is common here | Folded | Table shows an "on order" badge on the affected line | "Mark ready for collection", disabled with a reason |
| Finished | Unchanged | As drawn | Folded, "10 of 10 done" | Table stays open — everything's done, worth showing | "Take payment" |
| Collection / payment | Unchanged | As drawn | Folded | Table stays open | "Take payment" / "Complete job" |

### 7.5 Questions for Jack before finalising

1. The notes column in A currently lives inside the same bordered card
   as the status controls — just made taller, with a bigger heading and
   a tint (per refinement 2 above). Is that enough to feel like "the
   main thing on the page" per decision 31, or do you want it pulled
   out as its own section like B/E, just with the full parts table kept
   underneath (a hybrid not drawn yet)? Trade-off: keeping it inside the
   card (A as drawn) costs nothing extra to build and keeps the parts
   table exactly where you said you want it; pulling notes into its own
   section means a new drawing and re-checks the 584px fit, for a
   prominence gain that may already be solved by refinement 2.
2. The undersized buttons and checkboxes (§7.2) affect all three
   drawings equally. Fix the sizes now, as part of locking in this
   layout, or leave them as-is and address touch sizing in the general
   look-and-feel pass (decision 28)? Trade-off: fixing now means the
   layout is tablet-ready immediately; deferring keeps this round
   scoped to structure only, with a known follow-up before mechanics
   actually use it on a tablet.
