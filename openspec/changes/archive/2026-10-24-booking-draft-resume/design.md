# Design

1. **Two copies** (`draft.tsx`): the tab's (sessionStorage, as now) and the
   later copy (localStorage `wh-book-draft-later:<shopSlug>`, `{ draft,
   savedAt, step }`). Every save writes both, and an empty draft removes both.
   Photos are never written, as now.
2. **Reading.** If the tab has a copy, use it, with `resumed` false. Otherwise,
   if the later copy is under 7 days old, use it, set `resumed` true and write
   it into the tab. An older or broken later copy is removed.
3. **The step.** `BookFrame` records the path after `/book/<shopSlug>` as the
   later copy's `step` on each screen. On a resume, the first screen sends the
   customer to that step (`replace`); other screens stay where they are.
4. **The banner** (`BookFrame`) shows while `resumed` is true, at the top, as
   drawn (warning colours, `role="status"`). **Carry on** sets `resumed`
   false. **Start again** clears both copies, sets `resumed` false and goes to
   `/book/<shopSlug>`.
5. **How long:** 7 days, so a shared device doesn't hold someone's name and
   number for long. Logged in `decided-while-building.md` for Jack.
