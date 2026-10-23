# Design

## Storing the pair
Draft saves delete and re-insert every line (`createRevision`), so a pair
can't be sent as line ids. The request names the partner by its index in
the same `lines` list (`goesWith: 0`); `insertLines` inserts every line,
then sets each `goes_with_line_id` from the new ids. The reply gives
`goesWithLineId`; the staff screen turns it back into an index when it saves.

Rules, checked before anything is written (409 `illegal`, as other quote line refusals):
- `goesWith` is an index of another line in the list;
- only a labour line has one, and it points at a part (so no chains and no
  line goes with itself);
- `without` is text up to 300 letters, blank for none.

## Answers
`answerAll` refuses, before any write, a decision set where a labour line and
its part differ: "Lines that go together need the same answer: Fit and
adjust brakes goes with Shimano brake pads." (409 `pair`, so the card can tell it from a changed quote). `recordLineDecision` (the older
one-line route) refuses a line that is in a pair: "This line goes with
another; answer the whole quote."

## Screens
Customer card: a part and every labour line that goes with it are one group:
a tick change applies to the whole group, and the group starts ticked if any
line in it is Needed (fresh review: a Needed part with Optional fitting
would otherwise open split and be refused). A refused split shows the
shop's words and keeps the ticks. The live total line gains a screen-reader
sentence naming the partners changed. The "recommends this" box shows only
for an unticked Needed line with `without` words, as drawn.

Staff panel: in a draft, a labour line's reason cell gains the drawn "Goes
with" select (Nothing, then each part line), saved on change; a Needed line
gains a "What happens without it" box, saved on blur like the reason. Once
sent, "Goes with [part]" shows as grey text. Record their answer ticks pairs
together.
