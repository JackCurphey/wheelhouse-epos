# Jack's answers, 11 Nov 2026: the rest of Settings (WP-1.3 quick buttons; WP-5.1 End of day and Ways to pay)

These questions came up while writing the spec `openspec/changes/owner-setup-till-payments-eod`. It covers Front desk › Till › Quick buttons, Front desk › End of day (Close the day timing, Count first) and Front desk › Payments › Ways to pay. Jack answered them on 11 Nov, and the Front desk session passed them on. Each answer says what it settles.

## 1. What existing shops' quick buttons start as

The question: the drawing shows a new shop with no quick buttons (`set-till-empty`), but today every shop's till shows its active workshop services.

**Option 1, the recommendation.** The migration copies each existing shop's active services into a "Workshop" quick-button group, in their current order, so no shop's till goes blank. Shops that sign up after it start with no quick buttons, as drawn.

## 2. When Close the day shows for existing shops

The question: owner setup decision 18 sets 30 minutes before closing for a new shop. Shops using the app have had a fixed hour before (`decided-while-building.md` line 4717).

**Option 2, not the recommendation.** Every shop moves to 30 minutes before closing, including existing ones, the same as new shops under decision 18. Each shop can change it in Settings › End of day › Close the day.

## 3. How much of Ways to pay comes now

The question: the drawn Ways to pay (`set-pay-ways`) and Other ways to pay (`set-pay-other`) include ways the till can't take yet.

**Option 1, the recommendation.** The Cash card ("Always on") and the Other ways to pay list come now, in Settings only. The list does nothing at the till until Mark adds "Other" to Take payment. The Card, Gift cards and Deposits switches and Store credit's earn-back come later, each with the till piece that makes it work (the precedent at `decided-while-building.md` line 3939).

Jack first chose option 2 (the Cash card only) on 11 Nov, then changed it to option 1 the same evening. Option 1 is the answer.
