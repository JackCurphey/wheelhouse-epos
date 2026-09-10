# Claude review prompt — ranked Release 1 plan

Review this proposed implementation plan adversarially before implementation. Do not implement, change Jack’s buckets, create issues, post messages or contact providers. Your output is a critique and specific plan corrections for Jack/Mark to review.

Read:

1. `docs/reviews/2026-09-10-ranked-release-source.md` — exact ranking comment; buckets are Jack’s, original order is Claude’s.
2. `docs/reviews/2026-09-10-ranked-release-adversarial-review.md`.
3. `docs/reviews/2026-09-10-ranked-release-implementation-plan.md`.
4. `docs/reviews/2026-09-10-ranked-release-traceability.csv` — all 317 rows, including excluded safeguards and overlapping rows.
5. Earlier 8/10 September reviews, acceptance scenarios and prototype decisions, the Hubtiger comparison/live analysis, business research, locked master plan and relevant subsequent decisions.
6. The competitive trials on GitHub main at `b7034548661c3c83ac958fedcb92cfd76e0736b8`, especially §§6.3–6.4. That document is missing from the plan author’s checkout; its pinned link is in the review. Read current application code and verify your HEAD before judging implementation status.

Assume neither the earlier reviews nor this plan is right. Distinguish source observation, implementation evidence, inference and proposed policy. Preserve the difference between prototype scope, Jack’s free/BYO decision and older paid-tier assumptions. Do not treat competitor parity as independent market validation.

Specifically challenge:

- Are all 172 R1 rows covered, including 22 fonts, SKU groups, Bike Sale, third-party payer, both POS series and group reporting? Find under-specified or silently reduced features.
- Are any Later/No features smuggled in as “foundations”? Which are truly necessary internals, which need a product decision, and which can remain absent? Address No immutable quote version 169, Later snapshots 208, Later suppression 151 and No date-only 15 explicitly.
- Does the plan get source precedence and current code right? Independently check claimed existing guest booking, hours/overlap guards, reserve subtraction, service settings and deactivation behavior.
- Does W00 settle only necessary contracts, or create a new specification bureaucracy? Can anything be simplified without weakening selected promises?
- Is the dependency graph acyclic and sufficient? Are schema/file ownership boundaries practical? What is the smallest coherent first vertical slice and which external access will actually dominate delivery?
- Can quotes, holds, cancellations, messages, payment, stock and collection disagree under concurrent edits, delayed webhooks or restore? Write counterexample sequences.
- Does multi-store aggregation preserve tenant boundaries? Can identity merge or a public token accidentally expose another customer’s data?
- Are R/X treated separately and does read-first coexistence have an honest complete job-to-payment contract? Is cutover accidentally promised despite Later 280?
- Are proposed owners, effort labels and release gates supported? Identify decisions that can wait, and any missing decision that blocks safe implementation.

Return:

1. Verdict: ready for detailed issue splitting, ready with specified corrections, or not ready; explain the actual blocker.
2. Findings ordered by severity, each with exact file/row/package evidence, a failure example, and the smallest correction. Do not produce generic security/architecture checklists.
3. Missing/duplicate R1 coverage and bucket conflicts, with proposed interpretations kept separate from Jack’s recorded selections.
4. Corrected dependency order and the first five bounded implementation issues, with prerequisites and acceptance examples. Do not publish them.
5. A short list of questions only Jack/Mark can decide, and useful work that can proceed before each answer.
6. Arguments against your own proposed changes, including any extra complexity they introduce.

Do not report tests as passing unless you ran them. Do not accept simulations as production provider/device evidence. If the source comment or main changed since the pinned snapshot, show the delta before changing the review’s scope.
