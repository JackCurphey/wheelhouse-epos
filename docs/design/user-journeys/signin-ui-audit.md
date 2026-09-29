# Journey B — UI audit (desktop, Soft sand)

Audited 29 Sep 2026 by the designer helper from the 10 desktop renders plus
Your settings (with its Till PIN section), against
`docs/decisions/2026-09-29-signing-in-review.md` (decisions 1–8) and the
rules that apply everywhere. Verdict: the flows are clean and follow the
decisions; the gaps are states that aren't drawn yet.

Checked in the main session before bringing to Jack:

- **H1 — kept.** Till check-in's bar says "Nobody checked in yet" while the
  list below shows Alex Morgan checked in. The bar means "nobody is serving
  right now"; the wording is wrong. Fix: "Nobody serving — enter your PIN".
- **H2 — kept.** No wrong-PIN state. Fix: dots clear and a line reads "That
  PIN isn't anyone's — try again" (feedback only; no lock, decision 8).
- **H3 — kept.** No wrong or expired customer code state. Fix: a line under
  the boxes with "Send a new code".
- **M1 — kept as a rule, no board.** Someone with one site never sees "Where
  are you working today?"; they go straight in.
- **M2 — dismissed.** The auditor doubted the WorkOS page's "Forgot your
  password?" link, but staff do sign in to WorkOS with email and password
  (the WorkOS spec); PINs are only for the till.
- **L1 — dismissed.** The pop-up's close button is a link between boards
  because that is how the canvas prototypes move; the built app closes the
  pop-up.
- **L2 — low; no change.** "Go to Today" on the no-access page.
- **Trade-off noted:** the new PIN is shown on screen in Your settings, which
  is reached from your own name on your own sign-in, not from a shared till.
