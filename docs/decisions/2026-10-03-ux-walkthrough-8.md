# UX walk-through 8 — Jack's decisions (3 Oct 2026)

Walk-through 8 tests one requirement Jack gave on 3 Oct: at his shop the
mechanics share one computer today, but "i dont want the mechanic side of the
app to be built around only having access to one computer". It walked the
workshop as several mechanics on one shared desktop, as mechanics on their own
tablets at the same time, and as the Saturday worker at the front desk. The
personas it used are in `design/user-journeys/personas.md`, and the report is
`design/user-journeys/ux-walkthrough-8-shared-workshop.md` (3 High, 6 Medium,
3 Low). A second reviewer checked every finding before it reached Jack: 3
confirmed, 9 corrected, none removed.

Jack, 3 Oct: "all recommended, saturday workers do work the front desk".

1. **A workshop computer, set up like a till (H1, option 1).** The owner
   makes a computer a workshop computer once. It stays signed in as the shop,
   and each person takes over by typing their PIN. A bar on every workshop
   page reads "Working: Alex Morgan · Switch", and everything done is
   recorded under that name and role. Signed-in devices lists it. This
   widens what the PIN is for: the offline spec said it "is not a sign-in for
   anything beyond the till" (`2026-09-27-release-2-foundations-offline-design.md`
   lines 83–86); Jack chose to widen it. Everyone who uses a workshop
   computer needs a PIN, not only people with "Can use the till" (Owner
   setup 9).
2. **Live diary and job, with "who else is here" (H2, option 1).** A change
   on any device shows on the others within a few seconds; a job open
   elsewhere says "Jo Taylor has this job open"; the notes box shows the other
   person's words arriving; a clash on one line offers "Keep mine" or "Keep
   Alex's". If this is too big for Release 2, the fallback the report gave
   is option 2 for the job (one person changes it at a time, "View only" and
   "Take over") with the diary still live.
3. **A workshop computer goes back to the PIN screen when idle (H3,
   option 1).** After [n] minutes with nobody touching it, it shows "Enter
   your PIN", with nothing lost. Owner and manager pages open there only
   after an Owner or Manager PIN, and "Change PIN" is not offered on a shared
   computer. **[n] is still to set.**
4. **A "who's working" name on every workshop page and in the job pop-up's
   header, at every size (M1, option 1).** The job keeps "Mechanic: Alex
   Morgan" for the job's assigned mechanic.
5. **"I'll do this" on a shared-queue job (M4, option 1).** One tap puts it
   in your column at your next free time, and every device shows "Taken by Jo
   Taylor". It sits beside the drag Owner setup 19 settled, as a second way.
6. **On a desktop, "Add photo" offers "Choose a file" and "Use my phone" (M5,
   option 1).** "Use my phone" shows a code to scan that opens that one
   line's photo step with no sign-in.
7. **A short, folded "Who did what" list on the job (L2, option 1):** name,
   what, time. Tied to mechanic sign-off (Workshop day 64), still to design.
8. **The till can book a bike in and hand over a repair paid online (M6
   part 2, option 1).** The Saturday workers work the front desk, so a
   till-only worker must be able to do both without an email sign-in. Two
   new till screens.

## The fixes with no choice, taken as the report gives them

- **M2:** "Me" means the person working now. On a shared computer with
  nobody working, the diary opens on Everyone. Anyone with "Works in the
  workshop" gets "Me".
- **M3:** on a workshop computer, Your settings belong to the PIN person and
  switch with them.
- **M6 part 1:** on a till, the rest of the shop opens as the person checked
  in by PIN, with their role; with nobody checked in, only the PIN screen.
  The rail's foot reads "Jo Taylor · Staff · Check out".
- **L1:** the book-in and the tag print are one person and one time: Jo
  Taylor at 09:12 (the time Maya's page promises). The quick look's 09:05
  moves.
- **L3:** the script's word list gains "Enter your PIN", "Working: [name]"
  and "Check out [name]" for a shared computer.

## Not yet done

The drawings and the build are not changed yet. These decisions are recorded
for when the workshop and signing-in pieces are drawn and built.

**Later change (3 Oct 2026, walk-through 8 second walk H3, `docs/design/user-journeys/walk-2/`):** Jack, 3 Oct: "1". With Signed-in devices put off (issue #116 answer 5), decision 1's workshop computers are seen and stopped beside the tills, in Settings › Front desk › Till: "Workshop computers: [name] · … › Stop using as a workshop computer", and "Check Jo Taylor out" in a till's "…". Chosen over bringing Signed-in devices back for tills and workshop computers, and leaving it. Not drawn yet.

**Later change (3 Oct 2026, walk-through 10 M1):** Jack, 3 Oct: "1". "Till only" also opens Front desk › Online orders, so a till-only worker can mark online orders ready; every other room stays hidden. This widens what decision 8 kept as "till only". Chosen over the till page alone, with "A colleague gets these ready". Not drawn yet.

**Later change (3 Oct 2026, walk-through 1 second walk L3):** Jack, 3 Oct: "1". Maya's book-in time is "[time]" everywhere (job note, tag, quote page), since her appointment is 11:30. Replaces fix L1's 09:12. Not drawn yet.

**Later change (3 Oct 2026, third walk, answers 1, 7 and 8, `docs/decisions/2026-10-03-ux-walkthrough-third-walk.md`):** Jack, 3 Oct: "1" to each. Two of this walk-through's moments are drawn as situations: a workshop computer's "Enter your PIN", with no till number, whose keys open the diary as that person ("Now working: Alex Morgan"); and the till search with WH-1042 "Paid online · [date] · Hand over", leading to the till's hand-over (decision 8). The clickable mockup lists each screen's situation lines under the drawing, the same lines as the canvas, so the decisions kept as lines can be read while clicking. Decisions 1–8 are unchanged. Drawn in `docs/superpowers/specs/2026-10-03-draw-the-third-walk.md`.

**Later change (5 Oct 2026, issue #132, `docs/decisions/2026-10-05-roles-and-switches.md`):** Jack, 5 Oct. Two changes to decision 3. A per-shop "trust PIN" setting: with it on, someone who has typed their PIN on a workshop computer that day taps their name after it has been left idle instead of typing the PIN again; Owner and Manager pages still ask for the PIN every time (answer 3). And adding or removing people, changing roles or switches, and registering or removing tills are never offered by PIN on a shared computer, only with an email sign-in (answer 2). Not drawn yet.
