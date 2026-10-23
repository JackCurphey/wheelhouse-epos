# Design: Show status symbols

## Decisions

1. **The drawing's seven shapes** (`STATUS_SHAPE`), drawn in the block's own
   ink (`currentColor`; the block's text colour is its status ink), 13px in a
   block and 11px in a legend swatch, with the drawn white halo. An offered
   time has no shape in the drawing, so none.
2. **Where:** a narrow week column and every request, as `jobBlock`
   (`narrow && SHOW_STATUS_SYMBOLS`) and `pendingBlock` draw it; a block with
   a shape keeps 16px clear on the right for it, as drawn.
3. **One hook, `useStatusSymbols()`**, reading the person's settings (the
   shared `['your-settings']` query), so every block follows a change at once.
