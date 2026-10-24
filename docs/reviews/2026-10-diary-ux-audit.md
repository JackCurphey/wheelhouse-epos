# Diary page: a look at the layout (16 Oct 2026)

For Jack. This is a report only: no code and no drawings were changed.
Every recommendation needs your yes before anyone builds it. Each one says
whether it only catches the build up with your drawings, or whether it
would change a drawing or a decision.

## How this was checked, and what wasn't

- **Read, not seen.** I read the built page
  (`src/screens/diary/diary-page.tsx` and its pop-ups) and the drawings
  (`docs/design/user-journeys/generator/diary.mjs`) line by line. I could
  not open the running page. The online copy needs a sign-in, and the local
  copy needs its database started, which this session wasn't allowed to do.
  So anything about how the page *wraps* on a narrower screen is worked out
  from the code, not seen. Those points say "not seen".
- **Pop-ups.** New job, the job page and the request pop-ups were checked
  for where their buttons sit. Their full click paths were not walked.

## Your three questions

### 1. Where should the Week / Day switch go?

**Today:** the Week / Day switch is at the far left. Then comes a stretchy
gap, then the dates (‹ 14–20 September 2026 › Today) in the middle. Then
another stretchy gap, then the people chips and New job on the right. The
drawing does exactly this (`diary.mjs:1279-1285`).

**The problem:** the switch and the dates are one control. Pressing Day
changes the date text and the arrows' meaning ("Previous week" becomes
"Previous day"). But a wide empty gap sits between them, so the eye reads
them as two separate things. The switch ends up far from what it changes.

**Your decision 60** (`docs/decisions/2026-09-27-workshop-day-review.md:299-304`)
only fixes the order, "view · dates · people and New job". It does not say
the dates must be centred; only the drawing does. So both options below
keep decision 60 and change only the drawing.

Options:

1. **Switch and dates together at the left, people and New job at the
   right** (my recommendation). It reads as `[Week | Day]  ‹ date ›  Today
   ……… people · New job`. What you look at and where you are sit together
   at the left, where the eye starts. Who and New job sit together at the
   right. It also leaves one gap instead of two, which helps on a tablet
   (see 7 below). Cost: very small, about one line moved in the page and the
   same in the drawing.
2. **Switch moved next to the arrows, the pair kept in the middle.** This
   keeps today's centred look and closes the gap. It is the same small cost.
   It still leaves two stretchy gaps, which squeeze first on a tablet.
3. **Leave it as it is.** It costs nothing. The switch stays apart from
   the dates.

### 2. Is "Waiting for you" clear as its own area?

**Today:** a small bold heading, "Waiting for you (3)", over a stack of
separate cards. There is no box around them (`diary-page.tsx:1307-1351`).
The drawing has no box either (`diary.mjs:551-557`). The heading is the same
size as the toolbar text, so the column reads more like a list of notes
than a place where things wait for you.

**Yes, boxing it in helps.** Give it a light panel with the heading inside
at the top, and the count as a small badge ("Waiting for you  3") rather
than "(3)". The left column then reads as an inbox beside the diary.
Decision 7 (`2026-09-27-workshop-day-review.md:28`, "the diary's Waiting
for you column on the left") is unchanged. The box itself is not in the
drawing, so the drawing would need updating to match.

See recommendations 3 to 5 below for the things inside that area.

### 3. Anything else placed awkwardly?

Yes, see below. Most of it is the build not yet matching the tablet
drawings, rather than a design question.

## Recommendations

Numbered in the order I'd do them. "Catch-up" means the drawing already
shows it, so no design decision is needed, only your go-ahead.

1. **Put Week / Day beside the dates** (question 1, option 1).
   - *What changes:* the switch moves next to the arrows, and the pair sits
     at the left.
   - *Why:* it is one control, and it should look like one.
   - *Cost:* very small.
   - *Changes:* drawing `diary.mjs:1285` (the toolbar). Decision 60 is kept.

2. **Box in Waiting for you as a panel** (question 2).
   - *What changes:* a light panel round the column, the heading inside,
     the count as a badge.
   - *Why:* it then reads as its own area, an inbox.
   - *Cost:* small.
   - *Changes:* drawing `diary.mjs:551-557`. Decisions 7 and 14 are kept.

3. **Say how to open a Waiting card** (catch-up).
   - *What changes:* opening a card takes two steps. Click it to highlight
     it in the diary, then press Open or double-click it (decision 14,
     `2026-09-27-workshop-day-review.md:49-54`).
   - *Why:* the drawing puts a short note under the cards once one is
     chosen, "Double-click a card to open it." (`diary.mjs:555`, used at
     `:1678`). The built computer and tablet view leaves the note out; only
     the phone has it (`diary-page.tsx:1214`). Without it, people don't
     find the double-click.
   - *Cost:* tiny.
   - *Changes:* nothing; it matches the drawing.
   - *Not suggested:* showing Open before a card is chosen would save a
     click, but it would reopen decision 14, so I haven't recommended it.

4. **Tablet-sized Waiting cards and Open button** (catch-up).
   - *What changes:* on a tablet, the drawing makes the cards larger. The
     text is 12 / 15 / 13 points against the build's 11 / 13 / 12, and the
     card adds the bike as its own line. The Open button is a 44-pixel
     finger target (`diary.mjs:1468-1478`). The build uses the small
     computer card on the tablet: the Open button is 32 pixels
     (`diary-page.tsx:1343`) and there is no bike line (`:1334-1336`).
   - *Why:* 44 pixels is the usual minimum for a fingertip, and you want
     the page as accessible as possible.
   - *Cost:* small.
   - *Changes:* nothing; it matches the drawing.

5. **Week / Day buttons 44 pixels tall on a tablet** (catch-up).
   - *What changes:* the drawing makes them 44 pixels on a tablet
     (`diary.mjs:1180`). The build keeps them at 38 everywhere
     (`diary-page.tsx:1267`).
   - *Why:* same as 4.
   - *Cost:* tiny.
   - *Changes:* nothing; it matches the drawing.

6. **Check the small writing on diary blocks** (accessibility).
   - *What changes:* several labels on the grid are 9–11 pixels, for
     example the day header strip (`diary-page.tsx:495`) and the job block
     lines (`:189-192`, `:328-329`). The drawing's own note says touch
     screens step up to a 12-pixel floor (`diary.mjs:1129`). Contrast was
     not measured.
   - *Why:* small grey text is the commonest thing that fails people with
     weaker eyesight.
   - *Cost:* small to medium. Bigger text can mean fewer lines fit in a
     short job block, so this needs a look on screen, not a blind change.
   - *Changes:* nothing on a tablet (catch-up). On a computer it would go
     beyond the drawing, so that part is your call.

7. **Decide what a portrait tablet looks like** (not seen).
   - *What changes:* the drawings show a computer (1280 wide), a landscape
     tablet (1180) and a phone. Nothing is drawn between 768 and about
     1000 pixels wide, which is an upright iPad. There the build uses the
     computer layout. The toolbar is allowed to wrap onto two lines
     (`diary-page.tsx:1258`), while the drawing keeps it on one
     (`diary.mjs:1280`). The Waiting column still takes 184 pixels, so the
     week grid may need sideways scrolling.
   - *Why:* a shop with an upright tablet on the bench would get an
     undesigned layout.
   - *Cost:* a drawing first (small), then building it (small to medium).
     Recommendation 1 makes this easier, because one group at each end
     wraps more tidily than three groups with two gaps.
   - *Changes:* adds a portrait-tablet drawing. No decision is affected.

8. **Change request pop-up: the "Open full job" button** (catch-up, or
   check the plan).
   - *What changes:* the drawing gives a change request Accept, Decline and
     "Open full job" (`diary.mjs:1935`, `:1942`). The build has Accept and
     Decline only (`request-dialog.tsx:160-165`). To see the whole job,
     staff close the pop-up and find the block: two or more extra clicks.
   - *Why:* fewest clicks.
   - *Cost:* small.
   - *Changes:* nothing if it is simply not built yet. I didn't find it in
     any plan.
   - *Not a problem:* on a new booking request the lone Decline button sits
     on a row of its own (`request-dialog.tsx:137-141`). That row is the
     place kept for "Offer another time", which is a later package (WP-4.1,
     `docs/decisions/2026-10-08-not-drawn-pages.md:230`).

9. **Phone: a way back to today** (beyond the drawing, your call).
   - *What changes:* the phone has no Today button. The drawing doesn't
     have one either (`diary.mjs:1597-1598`). From another week, getting
     back takes several taps on the arrows.
   - *Why:* fewest clicks.
   - *Cost:* small.
   - *Changes:* the phone drawing. Optional.

## Checked and fine

- **New job pop-up.** It is laid out sensibly. Who and what (customer,
  bike, work, title, notes) are on the left; when and who does it (time,
  mechanic, status, "bike is here now") are on the right. Cancel and Save
  job are at the bottom (`new-job-dialog.tsx:266-375`). The tab key moves
  down the left column, then the right, which matches how you'd fill it
  in.
- **Job page.** Its buttons sit at the bottom right with the main action
  last, and the close button is a full 44 pixels (`job-dialog.tsx:210`,
  `:319-326`).
- **Waiting cards.** A chosen card is shown by a thicker outline and a
  glow, and to screen readers as "pressed". The card type is written in
  words on the pill, not shown by colour alone.
- **New job.** It is the only solid button in the toolbar, alone at the
  right, as decision 60 asks.

## Click counts as built (fewest)

| Task | Computer / tablet | Phone |
|---|---|---|
| Start a new job | New job, pick a slot, fill in, Save job | +, pick a slot, fill in, Save job |
| Open a job | 1 click on its block (2 from a stack) | 1 tap |
| Go to today's Day view | Day, Today (2) | 1 tap on today in the strip, more from another week |
| Answer a waiting request | card, Open, Accept (3); double-click makes it 2 | Waiting, card, Open, Accept (4) |
