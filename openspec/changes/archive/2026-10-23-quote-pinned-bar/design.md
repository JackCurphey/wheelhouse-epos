# Design: the quote's pinned answer bar

## Context

The customer's booking page (`src/screens/book/pending.tsx`) renders
`QuoteCard` inside `BookFrame`. The frame is a narrow column at every screen
size, and already has a pinned bottom area for a screen's main action
(`data-book-pinned`, with bottom padding and `scroll-padding-bottom` so focus
is never hidden behind it). None of the pages that show a quote pass the
frame an action, so the frame's own bar and the quote's never meet.

## Goals / Non-Goals

**Goals:** the drawn bar on a tablet or phone, the frame's look for pinned
areas, nothing hidden under it, focus never behind it.

**Non-Goals:** the deposit wording and the Lightspeed price-up bar (see the
proposal); any change to how the answer is sent.

## Decisions

1. **"Tablet or phone" means a touch screen, or a window narrower than a
   computer's.** The drawings tell desktop from tablet by device (the
   tablet board is 1180 wide), not by width alone. The diary already reads
   touch screens with `(pointer: coarse)` and "narrower than a computer" with
   `(max-width: 1023px)`. The bar shows when either matches, so a tablet in
   landscape gets the bar and a narrow computer window does too, since the
   quote is longer than the screen there as well. Where neither can be read
   (the screen tests' pretend browser), the quote shows as on a computer.
   *Alternative:* the frame's rule, pinned at every size. Rejected: the
   desktop drawing keeps the button in the card. Logged in
   `decided-while-building.md`.
2. **The bar belongs to the quote card**, rendered by `QuoteCard` itself as a
   fixed bottom bar in the frame's style (`data-book-pinned`, panel colour,
   top border, centred to the frame's width). The card holds the ticks, total,
   label and send, so no state has to move up to the page. *Alternative:*
   pass an action up to `BookFrame`. Rejected: the bar needs the total and the
   final-answer line, which the frame's action doesn't carry, and every page
   would need the quote's state.
3. **Room under the page.** The frame offers a `PinnedRoom` context: while
   the bar shows, the card asks for its height in rem (9, or 13 with a failed
   send's message), and the frame sets the page's bottom padding and
   `scroll-padding-bottom` to it, as it does for its own pinned action, and
   clears them when the bar goes. *Alternative:* the card setting the padding
   on the page itself. Rejected: the frame already owns that padding.
4. **A failed send's message shows in the bar**, above the button, so it is
   seen where the customer tapped.

## Risks / Trade-offs

- [The bar is taller with a failed send's message] → The room asked for
  grows with the message; two 320px browser tests check nothing hides under
  the bar, with and without it.
- [A device that reports neither a touch screen nor a narrow window but is
  small] → It gets the computer layout, which still works by scrolling.
