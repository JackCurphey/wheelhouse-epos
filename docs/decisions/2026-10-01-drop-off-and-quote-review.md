# Journey 4, Drop off and approve the quote — Jack's decisions (1 Oct 2026)

Journey 4 is the bike's time in the shop from the customer's side: dropping
it off, seeing how it's going, and approving or declining extra work the
mechanic finds — plus the staff screens that send the quote. Background, not
reopened here: booking in, the tag and storage slots, and the job page at
each stage are drawn and approved (Workshop day 4, 20, 27); the customer
sets a spending limit when booking and work under it skips the quote
(Workshop day 41–43); a customer's decision on a quote line is final, and a
change means a new revision from the shop (2026-09-23 quote line decisions
are final); the booking's own page (Book a repair 10) and the "Bike ready"
link with Pay now (Collect and pay 2; Owner setup 23); one update channel
chosen at booking (Book a repair 6, Book d5). Real example data: Maya Patel,
WH-1042, Trek Domane AL 3, the lines and prices in `LINES_APPROVED` (Standard
service £65, Shimano brake pads B05S-RX £28, Fit & adjust brakes £18,
Replace gear cable £12 declined; £111.00 approved), her note and the
mechanic's note (`job-page.mjs`), Alex Morgan, North Street Cycles, Bolton;
every other value is a bracketed placeholder. As on the diary's own quote
board, the example has no spending limit set (Workshop day 43: under a limit
no quote is sent). Generator: `quote.mjs` + `build-quote.mjs --theme sand`. Designed in the Soft sand look
on its own canvas (https://claude.ai/artifact/XWm8FSLNSWC4de3vcCAKWC), desktop first, then tablet and phone. Rules for every
journey apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few
clicks as possible).

1. **One page per job, changing as the job moves on** (Jack, 1 Oct: "1").
   The link from booking keeps working the whole way: the booking page
   before drop-off (Book a repair 10); once the bike is in, progress
   ("In the workshop"); a quote, when there is one, at the top to approve
   line by line; then journey 5's "Ready to collect" with Pay now. Every
   message links to the same page. Chosen over separate pages with their
   own links, and keeping Release 1's progress page with the quote as its
   own page.
2. **A quote is answered with ticks set the way the mechanic recommends,
   and one button** (Jack, 1 Oct: "1"). Each new line shows its price, the
   mechanic's reason and "Needed" or "Optional"; needed lines start ticked,
   optional ones unticked; lines that only make sense together (pads and
   fitting) tick and untick as a pair; the total updates as the customer
   goes; the button says what happens ("Approve £111.00"); before sending,
   "You can't change these answers afterwards — call us if you change your
   mind" (decisions are final, 2026-09-23). Staff mark each line Needed or
   Optional when building the quote. Chosen over Yes or No on every line
   with nothing chosen, and approve-all or decline-all.
3. **Photos on each quote line, added by the mechanic from the job page**
   (Jack, 1 Oct: "1"), closing the Release 1 gap "Inspection findings with
   photos" (INS-02, DONE-02). The mechanic taps "Add photo" on a line from a
   tablet or phone in the workshop; the customer sees a small picture beside
   that line's reason and can tap to enlarge it; photos are optional; the
   same photos show on the "Ready to collect" summary (journey 5). Chosen
   over written reasons only, and a separate "What we found" section.
4. **No answer to a quote: a reminder, then a flag for staff, and staff
   can record a phone answer** (Jack, 1 Oct: "1"). After a time the shop
   sets ([n] hours), the customer gets one reminder; still nothing, and the
   job shows "No answer yet" on Today and in the diary with the customer's
   number. "Record their answer" lets staff tick what the customer agreed
   on the phone, saved with who took the call and when. A quote never
   expires by itself; staff can withdraw it. Chosen over expiring after a
   set number of days, and nothing automatic.
5. **Sending a quote is one click, then Undo** (Jack, 1 Oct: "1"). On the
   job page's table each line carries Needed or Optional and "Add photo",
   set as lines are added. "Send quote" sends straight away, the way the
   customer chose (text, WhatsApp or email); a bar says "Quote sent to Maya
   by text · Undo" for a minute, with "See what Maya sees"; the job turns
   purple ("Awaiting approval"). The wording is set once in Settings ›
   Messages ("Quote to approve"). Chosen over a preview pop-up first, and a
   separate quote-building page (Workshop day 20: one job page).
6. **While the bike is in, a four-step tracker with the expected ready
   time** (Jack, 1 Oct: "1"). Booked → In the shop → Being worked on →
   Ready, the current step marked; "Expected ready: [day, date, time]";
   the work agreed so far and its total; "Add a note for the shop" as on
   the booking page. The tracker moves by itself as staff use the job page
   (book in, start work, finished); waiting for parts reads "Waiting for a
   part — we'll update you". Chosen over a full timeline with times, and
   one status line.
7. **UI audit: every recommendation taken** (Jack, 1 Oct: "yeah go ahead
   with all of them"). From `design/user-journeys/quote-ui-audit.md`: the
   button, pop-up and answered page follow the ticks — "Decline the extra
   work" when nothing new is ticked, and an unticked "Needed" line says what
   happens without it; **no "Send your answers?" pop-up on desktop** — "Your
   answers are final once sent." beside the button, which sends in one click,
   with "Not sure? Call [shop phone], or add a note for the shop." (H2,
   option 2; re-check on phone); a deposit paid at booking shows as "Deposit
   paid" and "Still to pay" on the quote and the job's page; **journey 5's
   ready page keeps its two columns** but gains the "Your booking · WH-1042"
   line, the tracker at Ready, the pads photo and "Add a note for the shop"
   (H4, option 2); **staff Needed/Optional and photo buttons 44px** (M1,
   option 2); the reason for the customer is the line's note, and **staff
   choose which lines go together** ("Goes with: Shimano brake pads", M2,
   option 1); the customer's page shows **facts only** — "Sent [day, time]",
   "We sent a reminder at [time]" and the shop number (M3, option 1); a quote
   can be withdrawn, with its customer page; the Undo bar says "Sending … in
   1 minute" and sits above the footer; Today drops WH-1042 from "Still to
   arrive" while its quote waits; **"Record their answer" keeps the
   recommended ticks and the save button reads back what is saved** (M5,
   option 1); screen-reader fixes; "No thanks" instead of "Not now"; "Agreed"
   on the staff line; a tappable-photo cue; "Untick anything you don't want"
   above the list; tracker labels aligned; "Edit wording" on every Messages
   row, the reminder as its own line, and "Customer's choice" on "Bike ready"
   and "Bike still waiting"; the job page's "Waiting for a part" step and the
   answered job page drawn.
8. **Tablet and phone drawn** (Jack, 1 Oct: "looks great, can you do the
   tablet and phone"). Every board is now at desktop, tablet and phone. The
   quote is longer than a tablet or phone screen, so there the new total,
   "Your answers are final once sent." and the Approve (or "Decline the
   extra work") button sit in a bar pinned along the bottom, as "Your
   booking" does on the booking page. With the button always in view beside
   the final-answer line, the phone keeps decision 7's one-click send — no
   "Send your answers?" pop-up (the re-check decision 7 asked for). The
   tracker stacks on phone; pop-ups fill the screen; staff boards use the
   job page's own tablet and phone layouts.

**Later change (1 Oct 2026, Account, history and reminders decisions 2, 5 and 8):**
the ready page (journey 5's, shown here at Ready) has the same unticked
"Remind me when my bike is due its next service" box under Pay now, saying
"the way you chose when you booked"; Settings › Messages gains the
"Bringing customers back" group ("Service reminder", "Review request").

**Later change (1 Oct 2026, Multiple sites decisions 9 and 11):** the shop
switcher in the sidebar is named "Shop: Bolton. Choose a shop" (with its open
state) for screen readers, and on tablet and phone — where the switcher is out
of sight — the shop's name, "North Street Cycles · Bolton", sits in small type
under each staff page's title. Nothing else on these boards changed.
