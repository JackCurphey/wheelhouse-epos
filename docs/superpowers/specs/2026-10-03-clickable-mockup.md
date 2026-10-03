# The clickable mockup (issue #116 step 5)

Jack, 3 Oct: "lets do step 5". Source: issue #116 step 5 and step 6's
done-when lines for the mockup.

## Intent

A static, clickable version of every story, built from the drawings already on
the one canvas, to walk the joins by clicking (issue #116 step 4's third
change). It stays a mockup: fixed example data, nothing saved, no sign-in. The
canvas stays the overview of every screen.

## What Mark asked for, and how each is met

| Mark's step 5 | Here |
|---|---|
| One page per real screen, one shared CSS from the Soft sand tokens | One page (`index.html`) that shows any of the 202 kept screens; the drawings already carry the Soft sand tokens. Deviation, logged: an Artifact keeps 511 files and 823 screens × 3 sizes is 2,464 drawings, so the drawings ship as data files (one per journey and size) the page loads. |
| A situation shown by an address ending, e.g. `receive.html?state=staff` | Each screen and situation has its own plain link, `#<id>` (e.g. `#rs-delivery-staff`). A shared Artifact link only carries a plain `#name`, not `?state=`. |
| Every button and link goes somewhere; a dead link fails the build | Every `<a>` and `<button>` in every drawing resolves to a target by the link rules below; `check.test.mjs` in `mockup/` fails on any control with no target or a target that doesn't exist. |
| A switcher bar: person, shop, size; the page re-flows | Person (Owner, Manager, Staff, Saturday worker, Mechanic, Customer), shop (Bolton, [Second site], All shops) and size (desktop, tablet, phone). Size picks the drawing at that size where one exists (the drawings are fixed sizes, so "re-flows" means the drawn size). Person and shop pick the screen's situation for that person or shop where one exists, and say so when there isn't one. |
| "Start a story": one entry per walk-through story, on its first screen as the right person | The 12 stories from `ux-walkthrough-script.md` and the build plan's stage W. |
| Publish as one Artifact, keep the canvas | A new private Artifact, linked from the canvas overview. |
| Stays a mockup | Same example data as the drawings; nothing is stored except the viewer's own switcher choice. |

## Link rules (in order)

1. **A drawing's own link** (`href="x.dc.html"`, from the generators) goes to
   that screen.
2. **Per-screen map** (`mockup/links/<journey>.mjs`): `{ '<screen id>': {
   '<control label>': target } }`, written from the decisions and the stories.
3. **Shared labels** (`mockup/links/shared.mjs`): the sidebar, rail and header
   (Today, Till, Diary, Customers, Settings…, the shop menu, Your settings).
4. **Kinds of control that don't navigate**: a switch, radio, tick box, tab
   or toggle (`role="switch|radio|checkbox|tab"`, `aria-pressed`,
   `aria-expanded`) changes on the spot.
5. **Close, Cancel, Not now, Back, ✕**: back to the screen before.

Targets: `go('<id>')` (a kept screen or a situation), `back`, `stay` (said on
purpose: the control acts in place, e.g. a number stepper), `outside('<what>')`
(leaves Wheelhouse: the card machine, Lightspeed, an email app), shown as a
short note instead of a page.

## Stories

`mockup/stories.mjs`: each story's person, first screen, and its steps as
screen ids in order. A check walks each story: every step must be reachable
from the one before by one control's target. That is step 6's "every
walk-through story can be clicked start to finish".

## Done when

- `node --test docs/design/user-journeys/generator/mockup/` passes: no dead
  control, every target exists, every story clicks start to finish. Each check
  seen failing first.
- `node mockup/build-mockup.mjs` writes `out-mockup/` (page + data files)
  under the Artifact limits (511 files, 16MB a file).
- The page opens on the canvas link's overview, switches person, shop and size,
  and every story's start works (checked in the browser once).
- Jack sees it before it's shared.

## Decision log

- 3 Oct: one page plus data files, not one HTML file per screen (the Artifact
  file limit; above).
- 3 Oct: links are plain `#<id>` tokens (the Artifact link limit; above).
