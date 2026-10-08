# Three diary fixes, and the change request pop-up's wording — Jack's decisions (8 Oct 2026)

Found while writing the workshop-diary OpenSpec spec (8 Oct) and confirmed
by a fresh reviewer. Jack, 8 Oct: fix these three now ("1"); the rest is
recorded in issue #192.

1. **New job, "Waiting for parts" with "The bike is here now".** The server
   puts the bike in the shop as it creates the job, so the screen's book-in
   afterwards was refused, the form stayed open, and a second Save with
   Shared queue made a duplicate job and order. Fixed: no book-in is sent
   when the job is created with the bike already in.
2. **The change request pop-up** (drawing `request-change`, `diary.mjs`)
   said "Accepting keeps the same work and mechanic", but accepting moves
   the booking to the mechanic the customer asked for. **Decision** (Jack,
   8 Oct: "1"): From and To name the mechanic on each side — "Mon 14 Sep ·
   10:00 · Sam" → "Mon 14 Sep · 14:00 · Alex Morgan" (from the drawing's
   example) — and the sentence reads "The customer asked to move this
   booking. Accepting keeps the same work." No mechanic reads "Shared
   queue", as on the job page (decided here, the closest built pattern).
   Chosen over changing only the sentence when the mechanic changes. The
   drawing is to be brought into line.
3. **A Week-view drop on the requested time** sent no mechanic, so a request
   for another mechanic was not accepted. Fixed: a drop on exactly the
   requested day and time sends the requested mechanic.
