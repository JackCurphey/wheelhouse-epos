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

## Answered by Jack — 12 Nov evening

Jack answered both questions that were waiting (relayed by the Front desk,
12 Nov evening).

3. **Four messages or six — six, as drawn (option 1).** The drawn message
   list (`cw-messages`) is built in full: "Your bike is put aside",
   "Certificate received", "Ready to collect", "Your hold ends on [date]",
   "Your bike is no longer put aside" and "Your order is cancelled". This
   changes the 2 Oct decision (journey 6, point 6), which named four.
4. **The paid box wording for a certificate-only hand-over — build the
   drawing (option 1).** The paid box shows "Paid" with "Cycle to Work ·
   [Provider] · receipt [receipt number]" under it, as `till-c2w-paid-cert`
   draws it. This changes the 3 Oct wording (third walk, answer 4), which
   was one line, "Paid · Cycle to Work · [Provider]".

With those answers, pull requests 7 (the hand-over at the till) and 8 (the
provider's money) go ahead, under the risky-area rules.

## The owed and paid report (`rp-c2w`) — Jack's answer, 14 Nov

Pull request #770 built the report and left two questions for Jack (until
now written only in that pull request and an overnight note outside the
repo).

5. **Money received on an order closed with a reason — leave as built
   (option 1).** Jack's answer, 14 Nov, relayed by the Front desk. Settled:
   such money is not counted in Paid. No code changes.
6. **`paid_on` is the day the money was received, not the day the bike was
   marked paid** (as #770 put it) — keep counting by the day the payment was
   received (option 1). Jack's answer, 14 Nov, relayed by the Front desk.
   Settled. The `rp-c2w` note now reads "on the day the payment was
   received", in the drawing and on the screen.

Status: items 1–2 defaults taken; items 3–4 answered by Jack on 12 Nov;
pull requests 7–8 going ahead. Items 5–6 answered by Jack on 14 Nov.
