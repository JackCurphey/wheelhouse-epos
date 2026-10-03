# Journey 7, Account, history and reminders — Jack's decisions (1 Oct 2026)

Journey 7 is the customer's signed-in account on the shop's website — their
bikes, bookings, past work and purchases, details and how they hear from
the shop — and the messages that bring them back: service reminders, a
review request, turning marketing off, and privacy requests. Background,
not reopened here: customers sign in with an emailed code, on the shop's
own site in its theme (Signing in B5, B9); signing in is offered, never
required, and "Your bookings" lists a signed-in customer's bookings (Book a
repair 6, 10, 12); one page per job from booking to ready, linked from every
message (Drop off and approve the quote 1); the staff customer page — a
summary on the left, one history on the right — with bikes and warranty,
money features only when switched on, loyalty as store credit, logged
privacy requests and deletion rules (Customer service 2–4, 6, 9, 10, 12);
the shop rewords and switches every automatic message and adds its own
(Owner setup 14); texts can be sent but replies can't be received yet
(Workshop day 2). Real example data: Maya Patel, 07700 900 142,
maya@example.test, Trek Domane AL 3 · green · black mudguards, bought here
and under warranty ([n] months left), WH-1042 and its lines and £111.00
total, North Street Cycles, Bolton; every other value is a bracketed
placeholder; what customers and staff write to each other is a bracketed
placeholder too. Generator: `account.mjs` + `build-account.mjs --theme sand`.
Designed in the Soft sand look on its own canvas
(https://claude.ai/artifact/Hoz1q28Frh9M7hNgV2bo3b), desktop first, then
tablet and phone. The reminder tick at booking and collection, the two new
Messages rows and the Today lines are drawn on this canvas only for now;
they join journeys 3, 4, 5 and 8's boards when journey 7 goes into the big
canvas. Rules for every journey apply (Workshop day
45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few clicks as possible).

1. **One account page, the same shape as the staff customer page** (Jack,
   1 Oct: "1"). On the left: their bikes, each with its warranty and "Book a
   service"; store credit when the shop uses it; their details and how
   they get updates. On the right: one history, newest first — bookings
   coming up, jobs in progress (opening journey 4's job page), past jobs and
   purchases with receipts — filtered by Everything, Repairs, Purchases.
   Chosen over separate pages for bookings, bikes, purchases and details,
   and a bike-first layout.
2. **Service reminders: a time per service, and customers say yes once**
   (Jack, 1 Oct: "1"). The shop sets a reminder gap on each service in
   Settings (Standard service after [n] months; none for a puncture). When
   booking or collecting, the customer ticks "Remind me when my bike is due
   its next service", and can switch it off in their account. The
   reminder's link opens Book a repair with the bike and service chosen, on
   the "When?" step. Chosen over one time for every job sent to everyone,
   and no automatic reminders.
3. **Conversations with the shop live on the website** (Jack, 1 Oct:
   "1"). "Add a note for the shop" on a job's page starts a conversation on
   that job, shown there as a short thread; "Ask the shop a question" on
   the account page covers anything else. Staff answer from the Messages
   page; each reply goes by the customer's chosen channel with a link back
   to the thread, and every text says "Replies to this number aren't read —
   reply on your page: [link]" (texts can't be received yet, Workshop day
   2). Both show in the account history. Replaces Release 1's "Talk to the
   workshop" chat. Chosen over waiting for two-way texting, and email only.
4. **"Your data": an instant copy, and deletion as a request** (Jack, 1
   Oct: "1"). "Download a copy of your data" is ready straight away
   (details, bikes, jobs, purchases, messages, consents) and logged;
   "Ask us to delete your account" becomes a request staff confirm, shown
   on Today and the customer page, with anything blocking it said up front
   ("We can delete your account once your bike has been collected" —
   Customer service 12). The privacy notice is linked beside them. Chosen
   over both as requests to the shop, and contacting the shop by email.
5. **A review request after collection: an automatic message, off by
   default** (Jack, 1 Oct: "1"). Switched on in Settings › Messages, where
   the shop picks the review page (such as its Google page) and when it is
   sent ([n] days after collection). Every customer gets the same link —
   no first asking how happy they were and sending only happy customers on,
   which Google's rules forbid. Customers can turn these off in their
   account. Chosen over private feedback only, and no review requests.
6. **One "How we contact you" section, with a one-click stop in every
   optional message** (Jack, 1 Oct: "1"). Job updates by Text, WhatsApp or
   Email (one choice, as at booking) — the way can change, but job updates
   can't be switched off while a job is in; three switches for Service
   reminders, Review requests, and Offers and news (offers off unless the
   customer said yes); every reminder, review request or offer ends "Stop
   these: [link]", which switches that one kind off at once, with no
   signing in, and says so. Replaces Release 1's "Your update preferences".
   Chosen over one switch for everything not about a job, and a switch for
   every message.
7. **The staff Messages page is an inbox with two panes** (Jack, 1 Oct:
   "1"). On the left, conversations with "Needs a reply" first — customer,
   bike, job number when it's about a job, the last line; on the right, the
   open conversation and a reply box that says how the reply goes ("Sent by
   text, with a link back to this conversation", following the customer's
   choice). Filters: Needs a reply, All. "Needs a reply · [n]" shows on
   Today, and each conversation shows on the job page and the customer
   page. On a phone: the list, then the conversation. Replaces the Release
   1 inbox Workshop day 2 kept "as drawn". Chosen over conversations only on
   job and customer pages, and messages answered from Today.
8. **UI audit: every recommendation taken** (Jack, 1 Oct: "yes please"). From
   `design/user-journeys/account-ui-audit.md`: **the reminder tick starts
   unticked**, and the same tick is the customer's yes to a review request
   ("And ask me for a review after I collect") — the shop should check that
   wording with its lawyer (H1, option 1); the On/Off controls in "How we
   contact you" are named switches, and a change shows a short line ("Service
   reminders are off") (H2, option 2); **a deletion request shows on the
   account with "Cancel my request"** until staff confirm (H3, option 1);
   **"Your details" and "How we contact you" are one card, and "Your data"
   sits under History** (M2, option 2); **store credit doesn't block
   deletion** — the pop-up says it will be lost, and staff see it on the
   request (M12, option 2). Also: hints name the customer's own way of hearing
   back; job notes and questions get their own history rows, titled by their
   first line; WH-1042's chip uses the tracker's words and Today shows it as
   arrived; the stop page links to signing in and has a "turned back on"
   state; the states after sending a question, emailing a receipt, a shop's
   first review setup and an empty inbox are drawn; "Needs a reply" in words
   in the inbox; "Stop these" is a fixed line the shop can't delete, with
   only the insert buttons that fit; named links and buttons; "sent" lines
   announced; the staff request says where it came from and what's in the
   way, and shows on the customer page; and the Lows (plain receipt wording,
   Account marked in the header, "This can't be undone" on its own line, a
   "why" line on the reminder's booking page, the collection tick's wording,
   "Edit" on every Messages row, reply again after replying, one count on
   Today, the download's file and a failed download, and "Next service due"
   on the bike). Side effect: the
   website header now marks "Account" whenever a page opens as Account, so
   Signing in's customer sign-in and code boards gain the underline too; they
   are carried over when journey 7 goes into the big canvas.
9. **Tablet and phone drawn** (Jack, 1 Oct: "lets do that"). Every board is
   now at desktop, tablet and phone. On a phone the account reads top to
   bottom as bikes, history, store credit, details and how we contact you,
   then your data, and history rows put their kind ("Repair", "Purchase",
   "Message") under the title so the title has room. The staff inbox is two
   screens on a phone, as decision 7 says: the list (its own board), then the
   conversation with a way back. Pop-ups fill the screen; staff boards use
   the app's own tablet and phone layouts.

**Later change (1 Oct 2026, Multiple sites decisions 9 and 11):** the shop
switcher in the sidebar is named "Shop: Bolton. Choose a shop" (with its open
state) for screen readers, and on tablet and phone — where the switcher is out
of sight — the shop's name, "North Street Cycles · Bolton", sits in small type
under each staff page's title. Nothing else on these boards changed.

**Later change (1 Oct 2026, Buy online decision 10):** the Messages boards list the five online-order messages and read "15 on". Nothing else changed.

**Later change (2 Oct 2026, Find the shop decision 8):** every website page gains a "Skip to the main content" link before the header, and the footer reads Contact us, Collection and returns (was "Delivery and returns"), Privacy and Cookies, its links 44px tall. Nothing else changed.
