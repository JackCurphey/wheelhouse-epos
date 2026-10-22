# A new quote after the customer says no to everything (22 Oct 2026)

**The question.** Maya said no to all the extra work, then rings back wanting
the brake pads after all. What can staff do? The quote machine treated an
all-declined quote as finished (`server/workshop/state-machines.js`: no way
out of `declined`; "Raised for Phase 4"), so staff had no way to quote again.
The 23 Sep decision (`2026-09-23-quote-line-decisions-are-final.md`) says a
change of mind means the shop issues a new revision, but was written about a
quote still open.

**Options put to Jack.**
1. Staff send a new quote with just what she now wants; her earlier "no
   thanks" lines show as history, like the drawn "The quote has changed"
   page (`dq-quote-newer`).
2. No new quote: staff add the work to the job directly and note her OK.

**Jack's answer** (22 Oct): "1: staff send a new quote with just what she
now wants; her earlier "no thanks" lines show as history, like the drawn
"quote has changed" page."

**What it means.** A declined quote can be revised, as a partly approved or
approved one can: staff add to the quote, the old one is superseded, and the
new one goes to the customer. Her earlier answers stay final and show on the
new quote as "Already agreed" and "You said no thanks".
