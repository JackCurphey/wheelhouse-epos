# Clickable mockup: fixing the Codex review (issue #123)

Mark asked Codex to review the clickable mockup (#116 step 5). It found 13
problems, listed in issue #123, and Mark asked for all of them to be fixed
(4 Oct). This spec covers only the mockup page's own controls and loading. No
drawing changes, and no screen design beyond what the drawings show.

## Intent

The mockup should always show the screen its title, address and story counter
say it shows. The Person and Shop boxes should only move between views drawn
for a person or shop. Back should undo exactly one step. Failures should be
visible and retryable. It should work on a phone and with a keyboard.

## Approach

| # | Problem | Fix |
|---|---|---|
| 1 | A late drawing replaces a newer one | Each navigation gets a number. A response for an older number is dropped. Nothing on the page changes until the drawing has loaded. |
| 2, 3 | Person/Shop pick unrelated situations; id guessing misses or mislabels views | `mockup/views.mjs`: a hand-made list of which situations are another person's or shop's view of their screen. The boxes choose among the screen and its listed views only. A situation that is a moment, not a view, stays put. A view for one shop only hides the general one when it also fits the chosen person. |
| 4, 6, 7 | Back loses the story step, person and shop; the first screen isn't recorded | One history: an in-page trail of {screen, person, shop, story step}. Back restores all four. The address is always rewritten to the screen shown, including the first one. A story's step sets Person only when you enter that step. |
| 5 | Size changes the screen but not the address | Changing size redraws the same screen (no refit). |
| 7 | "Back at Bolton" keeps [Second site] | The Accept link sets Bolton (`go(…, shop)`), and Back restores the shop. |
| 8 | A failed load sticks | Check the HTTP status and that the drawing is in the file. Forget a failed file. Show the error with a Try again button. |
| 9 | Phone bar overflows; wide drawings tiny | The bar's boxes can shrink to the screen width. A "Fit / Actual size" button (Mark, 4 Oct, option 1): Actual size shows 100% and scrolls sideways inside the drawing area only. |
| 10 | Keyboard focus lost; skip link dead | After a click in a drawing, focus moves to the screen's title, which is announced. "Skip to the main content" focuses `#main-content` inside the drawing. |
| 11 | Checks never run the page | Browser tests (`mockup/browser/page.test.mjs`, Playwright) for each scenario above. They run as a CI step after Chromium is installed (Mark, 4 Oct, option 1). The node checks fail if the drawings aren't built, and check the built manifest. |
| 12 | Wrong font | The page's font link is taken from the Soft sand drawings themselves (Public Sans), not from the Fjell build process. |
| 13 | Dark mode half applied | The drawings keep `color-scheme: light`. They are light designs. |

Done when: every browser test and every mockup check passes. Each new test
must have been seen failing against the current `page.html` before the fix.

## Decision log

- 4 Oct, history model: an in-page trail, with the address rewritten in place
  (not `pushState`). The mockup runs inside the claude.ai artifact frame,
  where browser Back would step through the frame and the host page together.
  The page's own Back button is the one history. (Codex suggested "one
  consistent history model"; this picks the in-page one.)
- 4 Oct, views list: written by hand from the 23 ids that matched the old
  guess plus 10 situations whose titles name a person or shop. These were left
  out as moments, not views: `ac-inbox-all` ("All conversations"),
  `set-staff-person-all`, `rs-receive-staff`, `rs-receive-staff-left`,
  `op-today-staff-lightspeed` (a Lightspeed shop), `rs-booked-staff`,
  `ms-request-from-shop`, `ms-switched`. For Jack to check in the pull request.
- 4 Oct, the situation box: a situation chosen by name in "This screen's
  situations" is shown exactly as chosen. Before, it was re-fitted to the
  person and shop, which could open something other than what was picked.
- 4 Oct, test 3: first written against the Person and Shop boxes, where the
  old page already picked `ms-today-all`. Rewritten to Codex's scenario, a
  click into the screen from `on-settings`, where the old page failed.
- 4 Oct, the font: taken from the drawings' own `<link>` (one link across all
  of them, or the build stops), not from `ui.mjs`. `ui.mjs` picks its theme
  per process, and the mockup build runs as Fjell.
- 4 Oct, "Back at Bolton": fixed on the one link Codex named (`links/j19.mjs`,
  Accept). Other links that return to Bolton without setting the shop were
  not searched for. Back now restores the shop, which covers the return trip.
- 4 Oct, fresh review (a subagent that didn't write the code) found these;
  each now has a browser test that was seen failing first:
  - Person and Shop: at Bolton the person decides; at another shop a view
    drawn for that shop wins when it fits the person at all. Before, a
    Manager at All shops never got `ms-today-all`.
  - A kept screen is for any shop. Only a situation's title can name its
    shop: `ms-switch-open`'s title says "All shops" and set the shop wrongly.
  - Views taken out: `ops-log-manager` (same role as `ops-log`, so never
    picked) and `ms-one-shop` (how many shops someone has, not a person).
  - Person, Shop or Size changed while a screen loads: that screen opens
    again with the new choice.
  - A story starts only once its first drawing has loaded. Before, a failed
    first step cleared Back and changed the bar.
  - A failed `manifest.json` says so, with Try again.
  - Back clears an old note. An unknown address is put back. A link's note
    survives Try again. Person and Shop set by a story or Back are remembered
    on reload.
  - Found by the first version of test 9, which failed now and then: going
    back to the screen shown while a story loads now cancels the story.
- Not done: the reviewer suggested Jack check two views as possible moments:
  `on-orders-second` and `ms-pick-shop`. Both kept for now.
