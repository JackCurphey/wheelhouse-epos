# Retiring the old app's workshop diary (18 Oct 2026)

Jack, 18 Oct, choosing what to work on (project rule 5: remove an old-app
screen once its new replacement is merged).

1. **The old app's workshop diary goes completely** (Jack: "nobody is using
   the old diary now… we can completely remove it and just make the
   features in the new diary"). Nothing is added to or kept in the old
   diary for its own sake. The old app's Workshop tab opens the new diary
   (`/workshop/diary`), so the old app still has a way in.
2. **No feature is lost for good**: what only the old diary does is built
   into the new diary instead. Until then it is simply missing; nobody uses
   the old diary, so nothing is lost in practice. Each piece is drawn for
   Jack to approve before it is built, as every design change is. The list,
   from the 18 Oct survey of `public/app.js`:
   - **Month view**, with the "+[n] more" list of a busy day. It is in the
     feature catalogue as something the app has (CAL-02,
     `2026-08-31-feature-catalogue.md`), so it is kept, in the new diary.
   - **Stretching a job longer or shorter by dragging its edge** (CAL-05,
     same file).
   - **Changing a job's title, customer, date, time or mechanic** after it
     is made.
   - **Deleting a job** and **attachments**: their server half is in #225,
     waiting for Mark; their screens follow.
   - **Approving a job staff made as pending**, **printing the job's
     receipt** and **opening the job's order in the till** (the old
     right-click menu).
   - **Showing only unassigned jobs** (the old "Unassigned" pill).
3. **Not part of the diary, so they stay for now**, each until the screen it
   sits on is rebuilt: the old job form as opened from an order ("Show in
   workshop diary" and "View / edit workshop job"), the workshop opening
   hours under Office > Edit Shop > Workshop, and a bike's service history
   under Customers.

The old diary's booking pop-up (Accept, Decline, Seen), its "Waiting for
you" column, week grid, mechanic pills, dragging and hover summary all
already have their new versions (`src/screens/diary/`).

**Drawn, 18 Oct:** Jack approved the drawings of the month view, stretching,
changing a job's details, the menu's three actions and the Shared queue
button: `2026-10-18-old-diary-features.md`.

**Changed, 20 Oct** (Jack: "1: yes — an order's 'Show in workshop diary' and
'View / edit workshop job' open the new diary and job page now, before the
order screen is rebuilt."): item 3's old job form as opened from an order is
replaced. "View / edit workshop job" opens the job's page in the new diary;
ticking "Show in workshop diary" opens New job in the new diary for that
order, its title and customer filled in, and the saved job is linked to the
order. Unticking it (removing the job) stays in the old app until the order
screen is rebuilt.
