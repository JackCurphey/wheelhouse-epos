# Stage 1: what the drawings don't show — Jack's decisions (7 Oct 2026)

Before stage 1 is built, every screen in Jack's stage-1 packages (WP-1.1,
1.3, 1.7, 1.8, 1.10, 1.11; split plan §6) was checked against its drawing,
the build plan, the specs and the decisions. Every board is drawn; nothing
blocks building. These are the 25 places where a screen needs something the
drawings don't show, or where two sources disagree. Jack decides each one
here, so it is settled before building rather than during it.

Sources: the blocks list `docs/design/user-journeys/README.md:105-170`; the
build plan `docs/superpowers/plans/2026-10-03-release-2-build-plan.md:209-355`;
the drawings in `docs/design/user-journeys/generator/` (`consolidate/ja.mjs`,
`jb.mjs`, `j08.mjs`, `j10.mjs`, `j12.mjs`). The check read the drawings' text,
not their pictures, and not the live claude.ai canvases.

Status: **3 of 25 decided.**

## Decided

### 1. An Owner or Manager PIN on a workshop computer

**The gap.** Settings and other owner pages on a workshop computer open
only after an Owner's or Manager's PIN, every time (walk-through 8,
decision 3; `consolidate/ja.mjs:29`; spec
`2026-10-05-wp-1-1-roles-and-switches.md:118`). It was a written line only,
with no drawing, and it didn't say whether typing that PIN makes the Owner
the person working.

**Decision** (Jack, 7 Oct: "1"). A PIN pop-up over the page — "Settings
needs an Owner or Manager PIN" with the usual PIN box. The Owner's or
Manager's change is recorded under their name; the person working on the
computer stays who they were (for example Sam the mechanic), so nobody has
to switch back. Chosen over making the Owner the person working, which
would record later work under the Owner's name if nobody switched back.

### 2. Changing a one-time PIN at check-in

**The gap.** A forgotten till PIN is replaced by a one-time PIN the Owner or
a Manager reads out over a call, and "you change it here at check-in"
(walk-through 10 M2, `2026-09-29-signing-in-review.md:80`;
`consolidate/jb.mjs:40`). The check-in step that changes it wasn't drawn.

**Decision** (Jack, 7 Oct: "1"). Straight after the one-time PIN, the till
shows "Choose your own PIN", typed twice; check-in finishes only once it is
set, with no way to skip. The one-time PIN then stops working, so nobody
else knows the person's PIN (signing in, decision 6). Chosen over a
"Later" button, which would leave the read-out PIN working.

### 3. Giving someone their PIN at the till

**The gap.** The PIN box the person types into (`till-give-pin`) is drawn;
how the checked-in Owner or Manager opens "Give [name] their PIN" and picks
the person was a written line only (`setup.mjs:275`; `signin.mjs:252`).

**Decision** (Jack, 7 Oct: "1", after a sketch of both). From the checked-in
Owner's or Manager's name on the till's top bar: a menu item "Give someone
their PIN" opens a list of only the people waiting for one (new, or PIN
cleared); tapping a name opens the drawn PIN box, screen turned to them.
Chosen over a "Give a PIN" button on the check-in screen, which every
member of staff would see.

## Still to decide

**A. Needed by stage-1 screens but not drawn, or drawn only in a later package**

4. Making a computer a till or a workshop computer — the only way into "Set
   up this till" is on the Tills page (WP-5.1), and "Make this computer a
   workshop computer" is a written line only (`mockup/links/j08.mjs:57`;
   build plan `:691`; `consolidate/jb.mjs:34`).
5. The sidebar for people with extra switches — not drawn for Staff with
   switch 7, a Mechanic with any switch, or "Give everything a Manager can
   do"; which rooms a Mechanic who can use the till gets (spec `:31`, `:44`,
   `:105`).
6. What the Settings frame shows in stage 1 — only Front desk › Till has
   content until WP-5.1; nothing says what empty rooms and rows that can't
   open yet show (build plan `:229-232`).
7. The Messages list in stage 1 — its rows arrive with later journeys, so it
   starts empty or nearly; an empty list isn't drawn (build plan `:303-306`,
   `:315`).

**B. States that are missing**

8. Failed save — WP-1.3 builds it (build plan `:230`), but its drawing
   (`set-save-failed`) is filed under WP-5.1 (`consolidate/j08.mjs:23`).
9. Where the trust PIN and idle-time settings go, and who may change trust
   PIN (`consolidate/j08.mjs:59-60`).
10. Block 26's "Working: [name] · Switch" bar — drawn only inside the job
    pop-up, not on the diary page; Switch goes nowhere (`diary.mjs:2631-2637`;
    `consolidate/j12.mjs:48`).
11. Till PIN screen with trust PIN on — whether "Checked in today" names can
    be tapped instead of a PIN (spec `:114-115`).
12. Today in stage 1 — "Not in yet" (grey) is decided but only "Late" is
    drawn (`2026-09-30-opening-the-shop-review.md:37-40`); the Tills card's
    "float checked" comes in WP-3.3.
13. Customer wrong-code message — only the expired-code message is drawn
    (`2026-09-29-signing-in-review.md` decision 9; `consolidate/jb.mjs:26`).
14. Email sign-in timeout — no decision found; the 10 minutes (Q6) is for
    workshop computers (split plan `:409`).

**C. Places where two sources disagree**

15. Sign out vs Check out on a workshop computer (`consolidate/ja.mjs:40`
    vs `signin.mjs:197-203`).
16. A Staff member at a workshop computer — "Workshop pages" (spec `:118`)
    vs their full Staff sidebar (`mockup/links/jb.mjs:33-36`).
17. Text, WhatsApp or email (`setup.mjs:382,385`) vs "text or email" (build
    plan `:304`; split plan `:410`).
18. "Not part of your role" page — "Reports are for owners and managers",
    no name to ask (`signin.mjs:66`), vs Reports as switch 2 and block 29's
    "ask [name]".
19. Who sets up a till — "a manager" (`app-map.mjs:403`) vs the Owner only
    (spec `:59`).
20. Takings on Today — the map and spec include them (`app-map.mjs:411`;
    spec `:261`); the `op-today` drawing has no takings card.
21. "All shops" — Owners and managers at two or more shops (`signin.mjs:63`)
    vs also anyone with "Give everything" (spec `:89`, decision R1).

**D. Minor**

22. Header search should also find bikes, frame numbers and booking
    requests — a written line only (`consolidate/ja.mjs:36`); its server
    side is WP-1.11 but its screen situation is listed under WP-1.1.
23. The shop switcher's open state is built in WP-5.2 (build plan `:706`)
    but sits in every stage-1 sidebar.
24. The Messages edit box shows only a text preview — no email preview or
    subject line, and no "How messages are sent" section opened.
25. Two STATUS lines are out of date: the trust-PIN and Mechanic drawings
    were done in #172 (`2026-10-05-roles-and-switches.md:99`), and the
    "Change requested" badge belongs to the job page in WP-4.1, stage 4
    (`2026-10-03-quote-stage-design.md:172`; build plan `:566`).
