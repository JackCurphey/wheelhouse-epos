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
4. **Applied as classes on `<html>`** by the staff frame: `wh-larger-text`
   and `wh-reduce-motion`, so every screen follows without changes.
   - **Larger text** is `zoom` on the staff app's root, 17/14 of normal (the
     drawn preview). Text is set in pixels throughout, so a root font size
     wouldn't reach it; zoom does, as the browser's own zoom does. Checked
     at a phone's width in a browser test.
   - **Reduce motion** stops animations and transitions in CSS, as the
     computer's own setting does; the diary's hover delay reads one shared
     `prefersReducedMotion()` that answers yes for either.
5. **Only built switches show.** The pop-up lists Larger text and Reduce
   motion now; each later change adds its own row with what it acts on.

## Risks / Trade-offs

- [Zoom makes things a step larger, not just text] → It's what the browser's
  zoom does and keeps the layout's proportions; the drawing's preview is of
  text. Logged for Jack.
