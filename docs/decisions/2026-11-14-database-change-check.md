# Database changes: which ones wait for Jack (14 Nov 2026)

**Why this came up.** Buy online added migration 156 (`website.started_with`)
in #775. Its own question 13 said the change "needs your yes", and then the
change was built and merged without one. Jack kept it afterwards (option 1).
Nothing had checked for this: the rules were instructions only, the reviewers
checked the code but not Jack's yes, and the Front desk checked only that
each pull request had merged and passed. The build plan doesn't name database
changes one by one, so "the database changes the plan lists" couldn't be
checked as written.

**Jack's answer (14 Nov, option 1, plus both checks):**

- **Allowed without asking:** a database change needed to build what the
  piece's drawings and Jack's decisions show.
- **Waits for Jack's yes:** a change that deletes or alters existing data
  (dropping or renaming a column or table, changing a column's type, or
  updating or deleting existing rows), goes beyond its piece's work package,
  or that the builder's own notes say needs his yes.
- **Checked twice:** the `risky-area-reviewer` agent reports "Stop: needs
  Jack's yes" before merging when a new migration falls in the second group.
  The Front desk also checks each new migration against this rule before it
  reports a pull request to Jack.

CLAUDE.md "Allowed without asking" point 2 now says this.
