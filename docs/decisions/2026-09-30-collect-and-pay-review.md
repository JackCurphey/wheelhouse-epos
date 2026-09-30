# Journey 5, Collect the bike and pay — Jack's decisions (30 Sep 2026)

Journey 5 is the end of a workshop job: the customer is told the bike is
ready, sees what was done, pays and takes it away. Already decided
elsewhere and not reopened here: paying for a job at the till also records
collection by default, with a pill to switch it off (Selling at the till
10); a deposit leaves the balance to pay at collection (Selling at the till
11); the "Bike ready" message wording, whose link opens one job's summary
with nothing to sign into (Owner setup 23); a checklist item ticked with no
note reads "All working well" to the customer (Workshop day 21); storage
slots (Workshop day 27). Note: journey 12's drawn "Ready for collection"
board still shows payment and "Record collection" as separate steps, which
Selling at the till 10–11 later changed — this journey settles it. Real
example data: WH-1042, Maya Patel, Trek Domane AL 3, Standard service £65.00,
Shimano brake pads £28.00, Fit & adjust brakes £18.00, gear cable declined,
£111.00 agreed, Hook 3, mechanic Alex Morgan. Designed in the Soft sand look
on its own canvas (https://claude.ai/artifact/LdnE9ayZJ1L2qu6suqcC2W),
desktop first, then tablet and phone. Generator: `collect.mjs` +
`build-collect.mjs --theme sand`. Rules for every
journey apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few
clicks as possible).

1. **Journey 5 is next** (Jack, 30 Sep), chosen over Receiving stock and
   purchase orders, and Book a repair.
2. **The customer can pay online from the job summary, when the shop has
   online payments switched on** (Jack, 30 Sep): the summary the "Bike
   ready" link opens shows what was done and the amount to pay, with "Pay
   now". A bike paid online is handed over at the counter in one tap; one
   not paid is paid at the till as now, which also records collection
   (Selling at the till 10). Depends on online card payments (journey 18
   and a payment provider not yet chosen). Chosen over reading-only
   summaries with everyone paying in the shop, and online payment only.
3. **One main button on the job at collection, depending on whether it's
   paid** (Jack, 30 Sep): not paid yet — "Take payment" opens the till with
   the job loaded and "Bike collected when paid" on, and paying records
   collection (no second step); paid online or in full earlier — "Hand
   over" records collection in one tap. Journey 12's two hand-back ticks
   ("Bike handed to the customer or authorised collector", "Lock key and
   rear light returned") become optional reminders a shop can switch on,
   off by default. Journey 12's "Ready for collection" board is redrawn to
   match. Chosen over keeping the ticks required and keeping journey 12's
   separate "Record collection" step.
4. **A bike left uncollected gets a reminder, then a flag for staff**
   (Jack, 30 Sep): after [n] days (the shop sets it, in Settings › Workshop
   › Collection) the customer gets a "Bike still waiting" message — one of
   the editable automatic messages (Owner setup 14); after a longer wait,
   also set there, the bike shows on Today under Needs attention (drawn
   with WH-1050, the diary's oldest ready job: "ready since Mon 14 Sep") with "Contact them". Chosen over the reminder
   message only, and adding storage charges.
5. **UI audit fixes, all as recommended** (Jack, 30 Sep; audit in
   `docs/design/user-journeys/collect-ui-audit.md`):
   - H1: the link after paying shows "£111.00 paid on [date]" and no Pay
     button; it stays live for [n] days after collection, then says it has
     expired; a card that doesn't go through says nothing was taken.
   - H2: after a deposit, the link and the job page show "Deposit paid
     £27.75 · [date]" and £83.25 to pay (journey 11's example).
   - H3: no double payment — the counter strip says "Paid online · [date]";
     while a till sale for the job is under way, the link says it's being
     paid at the counter and offers no Pay button.
   - H4: Today's uncollected line shows the customer's [phone] and a
     "Contacted" button; the line goes by itself at hand-over.
   - M1: the checklist note is labelled "What the mechanic found:", and a
     grey line says "8 of 10 checks done." (wording to confirm with Jack).
   - M2: at the till a job's agreed lines are locked (no − / +), marked
     "agreed on the job"; anything extra is added separately.
   - M3: "Not paid yet · £111.00 to pay" and "Paid online · [date]" in
     words; the main button is the same width on both.
   - M4: after Hand over (or paying), "Collected · the job is closed" with
     Undo for a few minutes, and the job's Collected state.
   - M5: the hand-back switch says On/Off and the whole row is the control;
     the day counts say they run from when the bike is marked ready; the
     two ticks are drawn as they appear when it's on.
   - M6: "Bike still waiting" has its wording, built from "Bike ready".
   - L1: labelled sections, the pay card first in reading order, the Paid
     page's heading announced.
   - L2: "just give your name" on the in-shop page; the Paid page keeps the
     shop's details; Aisha Khan's Cannondale being both WH-1050 (ready) and
     WH-1047 (arriving) on the same Today is example-data overlap, noted in
     the handover rather than changing the approved diary.
