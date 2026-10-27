## Why

"Continue with Google" on Wheelhouse's sign-in screen showed a "[G]" stand-in,
because there was no file of Google's official G (`staff-signin-google` left it
out of scope). Jack asked for the official G on 27 Oct and said yes to
downloading Google's Sign in with Google branding kit.

## What changes

- The button carries Google's own G, taken from the kit (`signin-assets.zip`,
  developers.google.com/identity/branding-guidelines): the light, icon-only
  Android + Web button's SVG with only its two button-box lines left out, so
  the G sits on Wheelhouse's own button with its colours and shapes unchanged.
- It is hidden from screen readers; the words "Continue with Google" say it.
- `tests/design-tokens.test.js` allows the G's own colours in that one file,
  with the reason: Google's brand rules forbid recolouring it.

No other change: the button's words, link and look are as built.
