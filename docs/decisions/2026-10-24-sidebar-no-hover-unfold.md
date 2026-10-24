# The folded sidebar opens only with Unfold

App map review decision 5 (`2026-09-29-app-map-review.md`, Jack, 29 Sep) had
the folded sidebar's icon rail open the full sidebar when the pointer rested
on it for about 300 ms, as well as with Unfold. It was built on 23 Oct
(`openspec/changes/archive/2026-10-24-folded-sidebar`).

## Answer

Jack, 24 Oct, using the workshop screens: "the 300 ms unfold is jarring;
fold only on the button."

1. **Resting the pointer on the rail no longer opens it.** The rail stays
   folded until Unfold is pressed (a tap on a tablet), and folds again with
   Fold, Escape, or a tap on the page beside it.
2. **This replaces decision 5** of the app map review. Decisions 4 (the Till
   folds) and 7 (Folded sidebar is a personal setting) stand.
3. **Your settings' hint on a computer** loses "Rest the pointer on it":
   "Folds the sidebar down to icons on every page, for more room. Press
   Unfold to open it. The Till always has it folded."

Built in `openspec/changes/archive/2026-10-24-sidebar-no-hover-unfold`.
