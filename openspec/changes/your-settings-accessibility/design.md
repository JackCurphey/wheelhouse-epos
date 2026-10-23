# Design: Your settings › Accessibility

## Decisions

1. **A table of its own, `login_preferences`** (migration 065): `login_id`
   (primary key, the login's), `shop_id` with row-level security as every
   shop table, `accessibility` JSONB, `updated_at`. Not columns on `logins`,
   which the sign-in code reads outside a shop's scope; and a later PIN
   person can get the same row by a different key. *Alternative:* the
   browser's storage. Rejected: Jack decided they follow the account (23 Oct).
2. **`GET /api/your-settings`** returns `{ accessibility: { statusSymbols,
   reduceMotion, noAutoClose, largerText, foldedSidebar } }`, every one
   `false` until set; **`PUT`** takes some of them, each `true` or `false`,
   and returns the whole. Any signed-in login, for itself only.
3. **The pop-up opens at `/workshop/your-settings`**, the address your name
   already links to, over an empty frame; Close or Escape goes back to the
   page you came from (or the desk). The drawing shows a pop-up over the
   diary; the address keeps the existing links working.
4. **Applied as a class on `<html>`** by the staff frame, `wh-reduce-motion`,
   so every screen follows without changes: CSS stops animations and
   transitions, as the computer's own setting does, and the diary's hover
   delay reads one shared `prefersReducedMotion()` that answers yes for
   either.
   - **Larger text was first built as `zoom` on the app's root and taken
     out** (review): checked in a browser, a zoomed page's pointer positions
     are in screen pixels while the diary's rows are measured unzoomed, so a
     drop landed about a fifth too far down and pop-ups placed beside a block
     drifted. Text is set in pixels throughout, so a root font size wouldn't
     reach it either. A question for Jack: (1) scale the text sizes
     themselves (every screen's sizes change once, the layout stays), or
     (2) keep zoom and correct each place that measures the screen.
5. **Only built switches show.** The pop-up lists Reduce motion now; each later change adds its own row with what it acts on.

## Risks / Trade-offs

- [Reduce motion also stops a fade that tells something happened] → The
  change still shows at once; only the movement goes.
