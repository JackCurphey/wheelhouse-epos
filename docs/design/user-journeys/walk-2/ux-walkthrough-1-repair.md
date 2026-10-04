# UX walk-through 1, second walk: a repair, start to finish (one canvas)

Walked 3 Oct 2026 for issue #116 step 4, on the one canvas (`generator/out/project/`, published at https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j). I didn't see the canvas rendered. I read each board's HTML, its situation list in `canvas.json`, and the generator code behind it. Where something is only a line in a situation list, I say so.

## The story

1. Maya Patel finds North Street Cycles' website on her phone (`wb-home`) and books a Standard service for her Trek Domane AL 3: Thu 17 Sep, arrive 11:30, "Call me before any extra work" (`bk-service` → `bk-details`).
2. Jo Taylor accepts the request from the diary (`diary`, `request-new`) and books the bike in on the morning (Today → the job page).
3. Alex Morgan, on a tablet or the shared desktop, finds worn pads and sends a quote. Maya approves £111.00 (`dq-quote`).
4. Alex works through the checklist and presses "Mark ready for collection". Maya gets "Bike ready", pays £111.00 online (`cp-summary`, `cp-pay`) and receives the receipt email.
5. Jo, or the Saturday worker, hands the bike over (a line in the job page's list: "At the counter, paid online: Hand over").
6. Months later a service reminder brings Maya back. She rebooks, or signs in to her account (`ac-account`).

## Clicks and screens per person

| Person | Clicks (main path) | Different screens | Notes |
|---|---|---|---|
| Maya (phone) | 16 taps, plus 6 typed fields and the card form | 11 (14 with the account) | wb-home, bk-service, bk-bike, bk-when, bk-details, bk-request, bk-page, dq-quote, cp-summary, cp-pay, receipt email; the account adds cust-signin, cust-code and ac-account. Last walk: 16 taps and 9 fields. The reminder now fills in her details |
| Jo (desktop) | 6 (paid online) or 9 (pays at the till), plus typing a search | 4 (7 at the till) | diary, request-new, Today, job page; then till-sale, till-pay, till-receipt |
| Alex (tablet) | about 28, 12 of them the checklist | 3 | diary, job page, checklist. On the shared desktop, add a PIN and a screen that isn't drawn (H1) |
| Jack Lewis (owner) | 0 to see Today; about 2 to reach Settings › Messages | 2 | Today, set-msg-list |
| Saturday worker | PIN, then not drawn | 2 and more | till check-in, till; booking in and handing over at the till aren't on the canvas (H1) |

## High

**H1: The decisions from walk-through 8 aren't on the canvas, so the canvas still shows the workshop they replaced.**
- *Screens:* `job-checklist` (desktop), `job-overview` (desktop and tablet), `diary` (tablet), `till-sale` and `till-search` (desktop).
- *What happens:* I searched every situation list and every generator module for "Working:", "I'll do this", "Use my phone", "Who did what" and booking in or handing over at the till. None of them appear. The checklist board's sidebar reads "AM Alex Morgan · Mechanic · Sign out", which is a personal email sign-in. The only tablet drawings show Jo's view, with "Book in" as the main button. On the till, WH-1042 offers only "Add to basket". Nothing lets a till-only worker book a bike in or hand over a repair Maya has already paid for online. The decision file says the drawings "are not changed yet".
- *Why it matters:* the build works from the drawings. Alex's work on a shared computer could be recorded under someone else's name, which is the problem walk-through 8 H1 found. And the Saturday worker can't do either of the two front-desk steps in this story.
- *Fix, no choice:* add lines, not drawings. Under `job-overview`: "Shared computer: 'Working: Alex Morgan · Switch' bar, work recorded under that name", "On a desktop, Add photo: Choose a file or Use my phone", "Who did what, folded". Under `diary`: "Shared queue job: I'll do this". Under `till-sale`: "Book a bike in from the till" and "Hand over a repair paid online". The bar is already building block 26.
- *Decision it touches:* walk-through 8 decisions 1, 4–8. Decision 8 says "two new till screens". Making them lines reduces how much gets drawn. It doesn't change what was decided.
- *8th question:* yes, all of these can be lines.

**Second check:** CONFIRMED — none of the wordings is in any situation list or board; the checklist board shows "Alex Morgan · Mechanic" with "Sign out" (`j12-job-checklist-desktop`), the tablet diary and job page are signed in as Jo Taylor with "Book in" as the main link (`j12-job-overview-tablet`), `ja-till-search` offers WH-1042 only "Add to basket", `till-collect` hands over online orders only, and the decision file says "The drawings and the build are not changed yet" (`2026-10-03-ux-walkthrough-8.md` line 71). Two corrections: one walk-through 8 line is on the canvas — `jb_sit_auth-signedout` reads "Signed out after a while — Staff · Walk-through 8, decision 3" — and it contradicts decision 3, which says an idle workshop computer shows "Enter your PIN" with nothing lost, not a sign-out. And decision 8 asks for "Two new till screens" (line 50–51), so turning them into lines changes the letter of a recorded decision; rule 6 allows it only where the layout doesn't change, and booking a bike in from the till (customer, bike, tag) probably does. That part needs Jack's yes, not "no choice". Severity High is right (the Saturday worker's two steps can't happen).

## Medium

**M1: You can't click your way through the story on the canvas.**
- *Screens:* every board on the path.
- *What happens:* every main action is a button with no link, or a link to "#":
  - the website's three "Book a repair" buttons, and "Brake service · Book a repair" in search;
  - "Next" and "Send booking request" in booking;
  - "Accept" on `request-new`;
  - "Book in" and "Open the diary" on Today;
  - "Approve £111.00", "Pay £111.00 now" and "Pay £111.00";
  - "See it in your account" on the receipt email;
  - "Book a repair" on the account page.

  On the workshop boards, the sidebar's Today, Till, Customers, Messages and Settings have no link, although boards for all of them are on the canvas. On the till boards, every sidebar item has no link, Diary included. Prev and Next never cross from one journey to the next: Next on the last board of a journey is plain text (`op-today`, `j05-ready`), and the first board of a journey has no Prev. "Sizes ↗" leaves the one canvas for the old per-journey canvases. Not checked: whether those are still current.

  The links that do work: diary blocks to the job page, "Maya Patel" to the staff customer page, the sidebar's Diary and Overview, and the checklist back to the job page.
- *Why it matters:* nobody can follow a hand-over by clicking, which is what change 3 of step 4 asks for. This is Medium, not High, because the real product isn't broken. This is the list of joins step 5's clickable mockup has to wire up.
- *Fix, no choice:* wire these joins in step 5's mockup.
- *8th question:* no screens are added.

**Second check:** CONFIRMED — every listed control is a `<button>` or `href="#"` on its board (`j01-wb-home` has three "Book a repair" and two "Book a repair here" buttons; `j10-op-today` "Book in" is a button and "Open the diary" goes to "#"; `j07-ac-account` "Book a repair" is a button); the workshop sidebar's other rooms have no link (`j12-job-overview-desktop`), every till sidebar link is "#" including Diary (`j11-till-collect`, `ja-till-search`); `j10-op-today` and `j05-ready` show "Next ›" as plain text; `j01-wb-home` has no Prev. Medium is fair: it blocks step 4's clicking, not the product.

**M2: Situation lines give only a title. The most important moments in this story can't be seen on the canvas, and links that lead to a situation land on the wrong moment.**
- *Screens:* `job-overview`, `job-checklist`, `diary`, `bk-page`.
- *What happens:*
  - The "Ready" step is one press with Undo (decided after walk-through 1, H2). The code still draws it: "Alex marked it ready at 15:30. 'Bike ready' goes to Maya by text in 1 minute · Undo" (`diary.mjs`, `finishedStripCompact`). On the canvas it's just "Job · finished — Staff · Workshop day 20".
  - The reminder filling in Maya's details is the same: the code has "Maya P. · 07700 ••• 142 · Change", but the line reads only "booking, bike and service chosen".
  - The checklist's "Mark ready for collection" links to `job-overview`, whose drawing is "Expected" with a "Book in" button.
  - Maya's diary block reads "approved £111", but it opens a job drawn as "Expected" with only the £65.00 service.
  - README rule 2 asks each line for "What's different". The lists on the canvas don't have that column.
- *Why it matters:* whoever builds or clicks through sees the job go back to before it was booked in, and gets no hint of the one-press rule.
- *Fix, no choice:* add a "What's different" part to each line, starting with the job page's 22 lines, as rule 2 already says.
- *Decision it touches:* README rule 2; walk-through 1 H2 and M7.
- *8th question:* this keeps them as lines. Without it, the pressure goes back to drawing more boards.

**Second check:** CONFIRMED — `finishedStripCompact` (`diary.mjs` line 2294–2295) and the pre-filled details (`book.mjs` line 66, `account.mjs` line 212) are in the code, while the lines read only "Job · finished — Staff · Workshop day 20" and "The reminder’s link: booking, bike and service chosen, saying why"; the checklist's "Mark ready for collection" links to `j12-job-overview-desktop`, titled "Job · expected" with "Book in" and only the £65.00 row; Maya's diary block is labelled "approved £111" and opens the same board; README rule 2 (lines 79–84) has the "What's different" column and no note on the canvas does. Medium is right.

**M3: Maya's confirmed booking page says she paid a deposit she never paid.**
- *Screens:* `bk-page` (phone).
- *What happens:* the main drawing shows "Deposit paid £[deposit]" and "Free to cancel until [date and time]". Maya's path has no deposit. `bk-request` was redrawn without one (walk-through 1 M6), but `book.mjs` `bookingLines` still adds the deposit by default.
- *Why it matters:* it's a promise about money on the page she keeps.
- *Fix, no choice:* draw `bk-page` without a deposit, and add a line: "Confirmed, after paying a deposit".
- *Decision it touches:* walk-through 1 M6.
- *8th question:* the fix is a line.

**Second check:** CONFIRMED — `j03-bk-page-phone` shows "Deposit paid £[deposit]" and "Free to cancel until [date and time]", from `bookingLines` defaulting to `deposit = !lightspeedShop()` (`book.mjs` line 227); `bk-request` passes no deposit. Severity should be **High**: the script's High includes "a promise about money … is broken" (`ux-walkthrough-script.md` line 55), and the report itself calls this a promise about money.

## Low

**L1: Two drawings of one booking page.** `bk-request` and `bk-page` show the same rows (service, bike, when, extra work, reference) and the same three buttons. Drop-off was already folded into `bk-page`. *Fix, no choice:* make "Just sent: Thanks, Maya — your request is with us" a line under `bk-page`. Maya's screen count drops from 11 to 10. Touches Quote decision 1 (one page all the way) and supports it. *8th question:* yes, it can be a line.

**Second check:** CONFIRMED — `j03-bk-request-phone` shows the same five rows and "Change the date", "Cancel request", "Add a note for the shop" as `bk-page`, and `bk-page` already has the line "The booking’s page while it’s still a request". Note that step 3 kept `bk-request` on purpose as building block 40 (`consolidate/j03.mjs` line 25), and its two lines ("Request received, after paying a deposit", "Confirmed straight away") would have to move with it. No recorded decision of Jack's is reopened.

**L2: The reminder's landing page is filed under the wrong screen.** `ac-reminder-landing` became a line under `bk-page` (`consolidate/j07.mjs`), but `account.mjs` builds it as booking's When step (`whenFromReminderAt`). *Fix, no choice:* move the line to `bk-when`. *8th question:* it stays a line.

**Second check:** CONFIRMED — `consolidate/j07.mjs` line 42 has `'ac-reminder-landing': into('bk-page', …)`, and `account.mjs` line 212 builds it with `whenFromReminderAt`.

**L3: Maya is booked in two hours before her appointment.** The page says "booked in Thu 17 Sep at 09:12" (`quote.mjs`), but she booked "arrive 11:30". Today still lists her as "Still to arrive · 11:30 appointment". The job's note says "Jo Taylor · 09:05", and the tag says "printed by Jack Lewis" at 09:12. Walk-through 8 L1 fixed 09:12 before the 11:30 change came through. Options:
1. The book-in time becomes "[time]" everywhere. No made-up time; one example edit.
2. Keep 09:12, and make only the note "Jo Taylor · 09:12" (walk-through 8 L1 as written).

Recommend 1. *8th question:* no screen is added.

**Second check:** CONFIRMED, with two corrections — "booked in Thu 17 Sep at 09:12" (`quote.mjs` line 143) and "09:12 · printed by Jack Lewis" (`diary.mjs` line 2285) are in the code, but no board on the one canvas shows 09:12 (searched every `out/project` board); what the canvas shows is the quick look's "Jo Taylor · 09:05" against the 11:30 appointment. And the chronology is wrong: walk-through 1 moved Maya to 11:30 on 2 Oct (`2026-10-02-ux-walkthrough.md` lines 89–93), and walk-through 8, decided on 3 Oct, walked Alex tapping "the 11:30 block" (`ux-walkthrough-8-shared-workshop.md` line 21) before choosing 09:12 in L1. So option 1 reopens walk-through 8 L1 knowingly; the report's "Needs Jack" is right for that reason.

**L4: The till calls the shop a "site".** The shop switcher's label on the till boards is "Switch site"; elsewhere it's "Shop: Bolton. Choose a shop". The word list says "shop" everywhere staff read it. *Fix, no choice:* use "Shop: Bolton. Choose a shop".

**Second check:** CONFIRMED — "Switch site" is the button's screen-reader name (not visible text) on 30 till-frame boards (the till, `ja-till-*`, `j10-op-float-*`, `j16-eod-*`, `cp-receipt-address`), from `stage1.mjs` line 27 and `app-map.mjs` line 106; the word list says "shop" (`ux-walkthrough-script.md` line 123).

**L5: Your settings still shows things that were put off.** The board has "Send feedback" and "What Wheelhouse records about you · See my own activity", which `j20_later` lists as put off (issue #116 question 5). It also has "Change PIN", which a shared computer shouldn't offer (walk-through 8 decision 3). *Fix, no choice:* remove the first two from the drawing, and add a line: "On a workshop computer: no Change PIN".

**Second check:** CONFIRMED — `ja-your-settings-desktop` has "Send feedback", "What Wheelhouse records about you" with "See my own activity", and "Change PIN"; `j20_later` lists "Your settings: Send feedback, and what’s recorded about you" as later (issue #116 question 5, `2026-10-02-management-oversight-review.md` line 117); walk-through 8 decision 3 says no Change PIN on a shared computer.

**L6: The thread of Maya's own job is lost in a few places.** The only drawn request is Sam Reed's. No board or line shows Maya's request arriving (`bk-staff-request` was folded into `diary` with no line). On the staff customer page, the WH-1042 row has no link. `j05-ready` is an older-style picture of the ready page (kept by Collect and pay decision 6) next to `cp-summary`. I didn't see the picture. *Fix, no choice:* add a line under `diary`, "Maya's request, WH-1042, in Waiting for you", and link the row. `j05-ready` touches Collect decision 6, so it's Jack's call.

**Second check:** PARTLY REFUTED — "`bk-staff-request` was folded into `diary` with no line" is wrong: `diary`'s list has "The diary: a request with a deposit — Staff · from journey 3", the title `journeys.mjs` line 301 gives `bk-staff-request` (`consolidate/j03.mjs` line 49 passes an empty decision, so only the decision column is blank). The rest holds: the only request drawn is Sam Reed's (`j12-request-new-desktop`, `j12-diary-desktop`), that line is a request *with a deposit*, so Maya's own no-deposit request still has no line; the WH-1042 row on `j15-cs-page-desktop` goes to "#"; `j05-ready` is a single image (`/_blob/…`) kept by `consolidate/j05.mjs` line 50 under Collect decision 6 (`2026-09-30-collect-and-pay-review.md` lines 81–85).

**L7: Edge cases at the joins still not drawn, carried from walk-through 1 L9.** A job marked ready while its quote is unanswered. A "Not sure what's wrong?" booking that reaches a quote. No line for either. Listed so they aren't lost.

**Second check:** CONFIRMED — no situation line covers either (searched every note); walk-through 1 L9's third case, paying online after a deposit, is now covered by lines under `cp-pay` and `cp-summary`, so it was rightly dropped.

## Earlier findings: were they fixed on the one canvas?

| Earlier | Now |
|---|---|
| H1 spending limit | Fixed. "Call me before any extra work" is chosen. The job reads "Call before any extra work". Within-limit lines are on `dq-quote` and `job-overview`, and Messages has a row for it |
| H2 one press | Fixed in the code and in Messages ("When a job is marked ready"). Can't be seen on the canvas (M2) |
| M1 remembered shop | Fixed, as a line under `bk-service` |
| M2 arrival time | Fixed: 11:30 on booking, Today, the overview and the job page. New issue: L3 |
| M3 waiting for the customer | Fixed: in the legend, and a line under `diary` |
| M4 two messages | Fixed: "Your answers" and "New ready date" rows. The strip says "Sent to Maya by text · [time]" (in the code) |
| M5 link expiry | Fixed, as lines. 30 days (build plan Q8) |
| M6 deposit | Partly: `bk-request`, pay and receipt are fixed; `bk-page` isn't (M3) |
| M7 reminder pre-fill | Fixed in the code; the line doesn't say so (M2) |
| M8 paid reminder | Fixed in the code (`collect.mjs`, the Bike still waiting wording) |
| M9 website repairs | Fixed: same list as booking; line "From the website: the repair already chosen" |
| L1–L6 | Fixed (Approved chip; "Book a repair" on the account; L2 as a line; one receipt; sign-in line on `bk-request`; "Not done: Cables & housing, Bolts torqued"; "Don't close things by themselves") |
| L7 ✕ | As decided: a ✕ that goes back to another board stays a link |
| L8 diary time | Fixed in the code: "Sat 19 Sep · 16:00–17:30" |
| L9 | Still open (L7) |

## Persona checks

- **Jo:** one box, "Search jobs, customers, products", is on every staff board, and the till's search finds the job, the order and Maya. Labels are in shop words. Undo is on quote, ready and collected. Passes. One-handed: not checked.
- **Alex:** fails on the canvas, both on a shared desktop and on a tablet (H1). Live changes across devices are decided (walk-through 8 decision 2) but not on the canvas.
- **Jack Lewis:** Today needs no clicks. The reports strip of takings by shop isn't drawn on `rp-home` (Reports later change, 3 Oct). That journey isn't in this story, so it's left for story 7.
- **Saturday worker:** fails (H1). The PIN check-in explains itself ("No PIN yet? … No email? Ask the owner or a manager").
- **Maya:** no app, no account, no password. Signing in uses an emailed code. Fewest taps: 16.
- **Screen reader:** diary blocks name their status in words ("Scheduled", "Waiting for parts"). Booking's day and time buttons are radios with full labels. Tick boxes are inside their labels.
- **Keyboard only:** the hover summary in the diary (Workshop day 65) wasn't checked for a keyboard way to open it.
- **Low vision:** the phone boards are a fixed 390px frame, so zoom can't be tested. Staff have Larger text.

## The end table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| H1 | job pages, diary, till | Walk-through 8's shared computer and till hand-over aren't on the canvas | No |
| M1 | all | No join can be clicked; list for step 5 | No |
| M2 | job-overview, diary, bk-page | Lines give only a title; ready-with-Undo can't be seen | No |
| M3 | bk-page | Deposit shown when none was paid | No |
| L1 | bk-request, bk-page | Two drawings of one page | No |
| L2 | bk-page, bk-when | Reminder landing filed under the wrong screen | No |
| L3 | job page, Maya's page, Today | Booked in 09:12 for an 11:30 appointment | Yes (1–2) |
| L4 | till boards | "Switch site" | No |
| L5 | Your settings | Shows put-off items and Change PIN | No |
| L6 | diary, cs-page, j05-ready | Maya's own thread gaps; old ready picture | Yes, for j05-ready |
| L7 | — | Edge cases still undrawn | No |

## Choices for Jack

1. Maya's book-in time (L3): "[time]" everywhere, or 09:12 kept. Recommend "[time]".
2. Whether to keep the older-style "Bike ready" picture `j05-ready` next to `cp-summary` (L6; Collect and pay decision 6). Recommend making it a line, since the rules say nothing is drawn twice.

## Verification

- **Read:** the script, the personas, issue #116 step 4, the README rules, the earlier report, and the decisions for journeys 1, 3, 4, 5, 7 and 12, the walk-through (2 Oct), walk-through 8 and the build-plan questions. None of these six journeys has a 3 Oct #116 note.
- **Board text and every link**, read with a script in the session scratchpad: the 31 boards named in this report (phone for customers, desktop for staff, tablet for the diary and job page). Situation lists: all of j01, j03, j04, j05, j07 and j12, the ones for till, Today, Messages and cs-page, and every "later" list.
- **Code:** `diary.mjs`, `book.mjs`, `account.mjs`, `collect.mjs`, `quote.mjs` and `consolidate/j03–j19`. I also searched the canvas and every generator module for walk-through 8's wording.
- **Not checked:** how anything renders; the `j05-ready` picture; tablet `job-checklist`; whether the "Sizes ↗" canvases are current; keyboard focus; a real screen reader; zoom; receipt numbering for online payments ("B1-[0000]"). Click counts are worked out from the boards, not timed.

## Second check

Second reviewer, 3 Oct 2026, against the canvas files (`generator/out/project/`), the generator and the decision files. 11 findings: **9 confirmed, 1 partly refuted (L6), 0 uncertain** (H1 and L3 confirmed with corrections).

- **Severity:** M3 should be High (a broken promise about money, by the script's own definition). The rest stand.
- **Decisions:** H1's fix turns walk-through 8 decision 8's "two new till screens" into lines; that needs Jack's yes. L3 option 1 reopens walk-through 8 L1, which was chosen knowing about the 11:30 appointment. L6's `j05-ready` touches Collect decision 6 (already flagged).
- **8th question:** no fix adds a drawing. H1's till book-in may be the one place a line won't do (rule 6), since it opens a new box.
- **Nothing invented** was found: quoted wording and file references match, apart from the corrections above.

Missed by the walker (mine):

1. The canvas line "Signed out after a while — Staff · Walk-through 8, decision 3" (`jb_sit_auth-signedout`, on `jb-auth-signedout`, which reads "You’ve signed out") contradicts that decision: an idle workshop computer goes back to "Enter your PIN" with nothing lost. Low; fix with no choice: if the line means a workshop computer, reword it to "A workshop computer left idle: back to Enter your PIN" under the PIN screen; if it means a personal sign-in running out, cite the decision that covers that instead.
