# Design: the folded sidebar opens only with Unfold

The rail (`Rail` in `src/staff/staff-layout.tsx`) showed the panel over the
page in two ways: its `open` state (Unfold) and a CSS rule
(`group-hover/rail:visible … delay-300`) that showed the panel while the
pointer was over the rail. A `dismissed` state, reset on `onMouseLeave`,
switched the hover rule off after Fold or Escape.

The change removes the hover rule, the `group/rail` group name it needed, the
`dismissed` state and the `onMouseLeave` handler. `open` is then the only
thing that shows the panel, so Unfold, Fold, Escape and the tap beside it
behave as before. The hidden panel's `delay-[250ms]` was there so the panel
didn't vanish the moment the pointer slipped off the rail; with no hover it
goes too, so Fold hides it straight away.

Tests: the screen test checks the panel carries no hover rule and stays
folded after the pointer enters the rail (jsdom has no CSS, so the browser
test is the one that watches a real pointer rest on the rail and the panel
stay hidden).
