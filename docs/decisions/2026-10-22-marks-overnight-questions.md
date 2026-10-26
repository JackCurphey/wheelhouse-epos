# Mark's overnight questions (22 Oct)

Mark's overnight run asked Jack five questions (draft #385, STATUS). Jack's
answers, one at a time.

## Answers

1. **Ended bookings: hold and reopen** (#378). On a cancelled, declined or
   expired booking, putting work that hasn't started on hold, and reopening
   finished work, are refused, as booking in and starting are (Jack, 16 Oct,
   job page fixes item 5). Jack, 22 Oct: "I also agree with 1 for marks
   question, block both". Collecting the bike and finishing work already
   under way stay allowed. Mark's draft also notes that work put on hold
   before the booking ended can still be resumed, which starts it; that gap
   is for his draft to close under the same answer.

2. **Should a booking confirmed automatically send "Booking confirmed"?**
   (#373). Already settled and built: it does (Jack, 19 Oct, auto-confirm;
   built in #357 and #362, `server/routes/portal.js`). #373 repeats work
   already on main.

3. **The job page's total.** Not one of Mark's: Jack asked for the total to
   be in view without scrolling; the fixed strip's "Total £…" tag already
   does it. Jack, 22 Oct: "The total in the top strip is enough."

4. **The money check's two questions** (#375: till sales on "check these",
   and order lines in fractions of a penny). Jack, 22 Oct: "leave the two
   money-check questions to Mark; they're technical details of his pence
   work. Suggest he fixes the rounding at the source rather than accepting
   1p differences."

5. **Website settings and the Shopify connection** (audit P2 1). Jack, 22
   Oct: "make the website settings and the Shopify connection Owner-only now,
   like the rest of Settings." Built in #393.

6. **Accepting a time the customer wasn't shown** (audit P2 2, #315). Jack,
   22 Oct: "refuse an Accept for a time the customer wasn't shown; show them
   the new time to accept instead. And an offered booking can't be dragged
   in the diary; staff offer again instead." Built in the offer-accept-shown
   change.

7. **Booking answers and Undo** (audit P2 3, #336). Jack, 22 Oct: "keep
   booking answers sending at once and correct the messages spec." The spec
   now names Quote to approve and Bike ready as the messages with a minute's
   Undo.
