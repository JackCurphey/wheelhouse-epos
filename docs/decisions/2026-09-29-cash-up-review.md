# Journey 16, End-of-day cash-up — Jack's decisions (29 Sep 2026)

Journey 16 closes the till's day: every till has sent its sales, anything
flagged is sorted, the cash drawer is counted against what it should hold,
paid-outs and banking are recorded, card sales are checked against the card
machine, and the day's report is printed or saved. Designed in the Soft sand
look on its own canvas, drawn at desktop, tablet and phone together (the
size-aware pattern from journey 11), inside the till frame from journeys A
and 11. Rules for every journey apply (Workshop day 45, 48, 50, 53, 57, 62,
65–67; A2, A6 — as few clicks as possible).

Background: Release 2 piece 3 includes end-of-day cash-up; the offline spec
§8 says a till can't be cleared while sales wait to send. Journey 11
decision 6 connects the card machine to the till, so card totals can come
from the machine itself rather than being typed in.

1. **Journey 16 is next** (Jack, 29 Sep), chosen over Customer service,
   Owner setup and Opening the shop.
2. **Each shop chooses whether the cash count is blind** (Jack, 29 Sep): a
   till setting — "count first, then see the difference" or "show the
   expected amount while counting". Drawn both ways. The default is to be
   settled with Owner setup (journey 8); the drawings assume blind.
3. **The cash count has a box for every note and coin, adding up to a total
   that can also be typed over** (Jack, 29 Sep): staff can count £50 notes
   down to 1p coins and let the till add up, or just type the total. Typing
   the total directly takes over from the note-and-coin boxes.
4. **The shop sets a standard float; the till says "Leave £[float] in the
   drawer, bank £[the rest]"** (Jack, 29 Sep): every day starts with the
   same float and the till works out the banking. Chosen over deciding each
   evening and banking everything.
5. **"Close the day" appears in the till bar for owners and managers after
   a time the shop sets** (Jack, 29 Sep): one tap at the end of the day,
   nothing extra on the till during trading. The time is a till setting
   (Owner setup, journey 8). Chosen over the till menu and Office › Today.
6. **Audit fixes adopted** (Jack, 29 Sep; `docs/design/user-journeys/cashup-ui-audit.md`):
   finishing a step opens the next one by itself (about 6 taps for a clean
   night); "Check" on a flagged sale opens that sale; "Add a paid-out" opens
   a small pop-up (amount, what it was for, who); a count that matches
   exactly shows "Spot on" with no reason box; a night with no paid-outs is
   drawn; each till closes on its own; a closed day can be reopened by a
   manager from Reports, with a reason; the phone report shows the date and
   who closed it.
7. **Journey 16 approved** (Jack, 29 Sep: "let's get it into the big
   canvas") — desktop, tablet and phone; copied into the user journeys
   canvas, status Designed.
8. **The big user-journeys canvas shows desktop only from now on** (Jack,
   29 Sep; applies to every journey, not just this one): each redesigned
   screen appears once, at desktop (or at its only size, for phone-only
   screens), with a link on its strip to its journey's own canvas where the
   tablet and phone boards live. Frees about 280 files under the canvas's
   512-file limit. Chosen over splitting the big canvas in two and a mixed
   rule.
