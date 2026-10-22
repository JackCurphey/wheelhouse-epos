# Design

`src/screens/book/notes-card.tsx`, placed after the quote card on the
in-the-shop page (`pending.tsx`), as drawn (between the tracker and Work
agreed). It reads the thread once (no timer, no refetch on focus: every read
counts against the booking link's guess limit) and replaces it with the
POST's reply. An empty box sends nothing; a refusal shows the server's words.
The card's border is the ink colour while there's no note yet, as drawn.
