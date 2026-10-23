# Design: Folded sidebar

## Decisions

1. **One `Rail` for a tablet and a folded computer**: the tablet's icon rail
   with Unfold at its top, and the full sidebar (`aria-label="Main"`) laid
   over the page beside it, hidden until unfolded. The rail is "Main, folded",
   as drawn.
2. **Opening**: Unfold (keyboard, touch, click) or, with a mouse, a rest of
   about 300 ms (CSS `group-hover` with the drawn delays); Fold or Escape
   closes it and returns focus to Unfold. **Unlike the drawing, focus moving
   into the rail doesn't open it**: with that, Escape put focus back on Unfold
   and it opened again at once, so the keyboard's way is Unfold. After Fold or
   Escape the pointer resting on the rail doesn't reopen it until it has left.
3. **Folded when** the page is the Till, or the person's `foldedSidebar` is on
   (the shared settings query).
