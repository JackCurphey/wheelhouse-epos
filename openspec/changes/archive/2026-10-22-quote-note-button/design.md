# Design

`notes-card.tsx` exports `goToNoteBox()`: it finds the box by its id
(`job-note`), scrolls it into view and focuses it; if the card is still
loading or failed to load, it scrolls to the card's heading instead. The
quote card takes an optional `onAddNote`; the booking page passes it only
where it also shows the notes card (the in-the-shop page). Without it the
"Not sure?" line is as before. The Work agreed card's button calls the same
function. Both buttons are the default (outlined) look, as drawn.
