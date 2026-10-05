# Build plan — questions for Jack (3 Oct 2026)

Everything that would otherwise stop an unattended build, in one place, so it
can be answered in one sitting. Each has a recommendation. The build plan is
`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`. Jack's answers
are recorded under **Answers** at the bottom.

Items already settled and **not** asked: paying for a job also records
collection (Collect and pay 3, which settles Workshop day 63); the four staff
roles and their switches (Owner setup 8–11, only the server work is left);
the idle-time fallback and live updates (walk-through 8, decisions 2–3).

## Questions only Jack can answer

**Q1. What may I do without asking?** Recommend all of these:
1. Build exactly what the drawings and decisions show, in the plan's order.
2. Make the database changes the plan lists.
3. Where a drawing is silent, follow the closest pattern already built and
   write it in `docs/decisions/decided-while-building.md` for Jack to read
   and overrule whenever he likes.
4. Merge my own pull requests once the tests pass and a fresh reviewer has
   checked the work against the spec and the drawings.
5. Remove an old-app screen once its new replacement is merged (it stays in
   the project's history).
6. Add a small, well-known piece of add-on software when a piece needs it,
   noted in the pull request.
7. Keep the build board and the status file up to date as I go.

Still stops for Jack: spending money; creating or connecting a real
account or key; touching real shop data; deleting anything else; anything
that contradicts a decision; a test that can't be made to pass.

**Q2. The build order.** Pick one:
1. **The plan's order (recommended):** foundations first (roles, settings,
   shops, products and stock, one sales record, sign-in, messages, live
   updates), then stock, the till and shop day, the workshop, the office,
   the website, Cycle to Work, and the move. Each stage leans on the one
   before, so nothing gets built twice.
2. **Journey by journey, as so far.** Easier to follow on the build board,
   but foundations get built in bits as each journey hits them, and some
   screens need reworking when the foundation lands.

**Q3. Mechanic sign-off (Workshop day 64), never designed.** Pick one:
1. **Recommended: pressing "Mark ready" is the sign-off.** The job records
   "Signed off by Alex Morgan · 15:30" (the person working, by PIN on a
   shared computer), shown in the job's "Who did what" list and the hover
   summary. No extra click.
2. **A separate "Sign off" button** before Mark ready. Clearer, but one more
   click on every job, and someone else could mark it ready.

**Q4. Citrus Lime exports.** The plan's run-alongside step and the import
need to know what Citrus Lime lets the shop export: products, stock,
customers, bikes, sales, workshop jobs, and in what file formats. Only Jack
can check this, from the shop's Citrus Lime admin. Recommend: check soon
and tell me what's there. Real customer files never go into the project; we
agree where they're kept when we get there.

**Q5. Lightspeed shops (journey 21).** Pick one:
1. **Recommended: after the trading week.** There's no Lightspeed test
   account yet and Jack's shop doesn't need it to switch over.
2. Within Release 2, against a pretend Lightspeed until an account exists.

**Q6. How long a workshop computer waits before asking for a PIN again**
(walk-through 8, decision 3). Nothing is lost when it does. Recommend **10
minutes**: long enough to work on a bike and come back without retyping,
short enough that it isn't left open for the day. Other choices: 5 or 15.

**Q7. Your card machine.** Which card machine provider does the shop use
today? Until it's linked, staff key the amount in on the machine (already
built).

**Q8. Starting numbers the shop can change.** Recommend accepting these
defaults; each becomes a setting:
- Sales waiting to send are flagged after **10 minutes**.
- A booking link keeps working **30 days** after collection (or after the
  booked date if the bike never arrives).
- A quote with no answer gets a reminder after **24 hours**.
- Uncollected online orders are flagged after **7 days**.
- Website history is kept **90 days**.
- A "returning customer" came back within **12 months**.

**Q9. Automatic message wording.** Recommend: I draft every automatic
message (booking, quote, bike ready, reminders, receipts), marked as draft
wording, and Jack reads them all in one go before the shop goes live.

## Questions for Jack and Mark together

These don't stop building (each is built against a stand-in), but they stop
going live.

**Q10. Accounts Mark needs to set up:** hosting (PL-1), an email sending
service, WorkOS for sign-in, an online payments provider (PAY-05), and Xero
and QuickBooks developer access. Recommend: send Mark this list.

**Q11. The business plan's freeze.** The business plan holds back the
website, supplier feeds, offline selling, multiple shops and sizes and
colours until three shops are paying. Release 2 needs all five
(programme spec §5). Recommend: Jack and Mark agree that the Release 2
spec replaces the freeze, and record it.

**Q12. Professional checks before going live.** A solicitor for the privacy,
cookie, returns and reminder wording; the shop's accountant for the VAT
report layout and the accounts mapping; how long records are kept (LEG-05).
Recommend: I build with clearly marked placeholder wording, and these are
done before switch-over.

## Answers

Jack, 3 Oct 2026: "all recommended, but dont start the build yet, i just
want to ge the build plan on github so i can share it with mark and get his
opinion on it."

- **Q1–Q3, Q5, Q6, Q8–Q12:** the recommendation, as written above. So: the
  plan's order; "Mark ready" is the mechanic sign-off; Lightspeed shops after
  the trading week; a workshop computer asks for a PIN again after 10
  minutes; the six starting numbers in Q8; draft message wording read in one
  go before going live.
- **Q4, Citrus Lime exports:** "citrus exports data in excel sheets, but im
  sure we can mutate it into a different format once thats downloaded." So
  the import reads Excel files (or spreadsheets saved from them). Which
  kinds of data can be exported is still to check.
- **Q7, card machine:** "we use a paymentsense machine, something 5000 i
  believe." The exact model is still to confirm. Whether it can take amounts
  from the till, and what it does offline, is still to check (offline spec
  open item).
- **Not started:** the build waits for Mark's view of the plan.
- **Persona walk-throughs first:** "i also want to make sure that we have
  done persona walkthroughs of everything before we build so that we have to
  make the least changes at the end." Added to the plan as stage W, before
  stage 0.

**Later change (3 Oct 2026, walk-through 12 M2, `docs/design/user-journeys/walk-2/`):** Jack, 3 Oct: "1". The customer texts that start each repair step (Request received, Booking confirmed, Quote to approve) are drafted now, as lines on Settings › Messages, so walk-throughs and the clickable mockup can show them. Each says who it's from, what to do, and that no app or sign-in is needed. They are read again in Q9's read-through before going live. Not drawn yet.

**Later change (5 Oct 2026, issue #132, `docs/decisions/2026-10-05-roles-and-switches.md`):** Jack, 5 Oct, answer 3. Q6's 10 minutes applies when the shop's "trust PIN" setting is off. With it on, a workshop computer left idle shows the names of everyone who typed their PIN on it that day, and they tap their own.
