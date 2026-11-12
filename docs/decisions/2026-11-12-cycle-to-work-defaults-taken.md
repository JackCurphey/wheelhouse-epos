# Cycle to Work (WP-7.1): defaults taken overnight, and what waits for Jack — 12 Nov 2026

On 12 Nov Jack answered "1" to the Front desk: overnight sessions may take
the recommended answer on spec questions, marked "default taken, Jack can
overrule", except anything touching money taken at the till, real
accounts, or contradicting a recorded decision, which still waits for him.

The plan is `openspec/changes/cycle-to-work/`; the full questions with
their options are in the overnight file `spec-c2w.md`.

## Defaults taken — Jack can overrule

1. **Deposits before Mark's till deposit is built** — option 1, wait. Every
   other part is built first; "Straight away, with a deposit" stays hidden
   until the till can take a deposit against an order, then pull request 11
   adds it on Mark's deposit table.
2. **Holding a bike that has no frame numbers** — option 1, hold a count.
   The order holds "one of these", available stock goes down by one until
   it is released, and the actual bike is picked at hand-over.

## Waiting for Jack

3. **Four messages or six.** The 2 Oct decision (point 6) names four:
   "Your bike is put aside", "Certificate received", "Ready to collect" and
   "Your hold ends on [date]". The drawn message list (`cw-messages`) adds
   "Your bike is no longer put aside" and "Your order is cancelled". Adding
   them goes beyond the recorded decision, so only the four are built; the
   other two wait.
4. **The paid box wording for a certificate-only hand-over.** The 3 Oct
   change (third walk, answer 4) says one line, "Paid · Cycle to Work ·
   [Provider]". The drawing (`till-c2w-paid-cert`) shows "Paid" with
   "Cycle to Work · [Provider] · receipt [receipt number]" under it. These
   differ, so the wording waits.

Also waiting, under the same answer: pull requests 7 (the hand-over at the
till) and 8 (the provider's money), because money taken at the till is
Jack's to approve.

Status: items 1–2 defaults taken; items 3–4 and pull requests 7–8 waiting
for Jack.
