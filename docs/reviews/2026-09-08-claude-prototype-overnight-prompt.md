# Claude Code overnight brief: Wheelhouse workshop prototype

You are implementing and reviewing the Wheelhouse workshop prototype for Mark and Jack. Work autonomously through small, testable changes until the agreed prototype is ready for an observed walkthrough. This is an implementation task, not a request for another plan.

## The governing specification

Read `docs/reviews/2026-09-08-workshop-prototype-decisions.md` in full before working. It records Mark's answers as Jack's proxy and is the product authority for this task. The loop also supplies a verbatim pinned copy and its SHA-256 on every pass. Do not edit that document, weaken its acceptance criteria, or replace it with a reinterpretation.

Read `prototype/README.md` and inspect the current `prototype/` implementation next. Read applicable repository instructions for implementation conventions, but where older product plans conflict with the explicit user decisions in this brief and the pinned spec, follow the latter. The older business plan, master implementation plan, feature catalogue, architecture reviews, and 63 broad acceptance scenarios are historical context. They are not the overnight backlog. Do not import their production requirements into this prototype.

The current checkout is older than remote main, and important work is uncommitted or untracked. The complete prototype and the governing spec are in this working directory. Do not switch branches, reset, clean, stash, pull, rebase, merge, commit, push, or create a fresh worktree that loses them. Improve the current prototype rather than rebuilding it from scratch. Preserve all unrelated local changes, especially `.agents/STATUS.md` and existing review documents.

## Settled scope

- An interactive, fully responsive bike-workshop prototype, running standalone without a database or incumbent system.
- Jack drives editable default scenarios and can create his own. One participant can switch between customer, mechanic, and shop roles. The same job state must follow them across views.
- Guest requests with a plain-language problem description and photos/video. No mandatory account. A progress link exposes that request's status, inspection, approvals, and conversation within the demo session.
- Test both automatic acceptance and review by the shop, including service-specific rules. Test both appointments and day-based drop-offs and both individual mechanic assignment and a shared queue. Let participants operate the settings.
- Phone inspection video, itemised extra work, item-by-item approve/decline, and an alternative whole-job spending limit. Preserve exact authorised work and amounts when proposals change. Declined work must not become authorised.
- Parts delays, revised completion estimates, and messages attached to the job.
- Customer-selectable notifications with sensible defaults. Simulate Email, SMS, and WhatsApp. Keep workshop events separate from channel delivery so real adapters can follow later.
- Distinct work finished, ready for collection, and collected states. Show a clearly labelled billing stub; never create a real invoice, payment, or financial settlement.
- Simulator pause, fast-forward, and reset; realistic fictional fixtures; a complete walkthrough in one session. No cross-device synchronisation or return-on-another-day persistence requirement.
- Jack learns by watching participants. Do not add analytics, surveys, feedback capture, or feedback export.

Freemium is only a hypothesis. The audience, pricing, and free/paid split are deliberately undecided. Do not invent answers, pricing pages, entitlements, or free-forever promises. Lightspeed R-Series is not the chosen market. Do not implement till adapters, production auth migration, billing providers, outbound messaging, a multi-tenant backend, or a general workflow engine tonight.

## What already exists

There is a working React/TypeScript/Vite prototype with shared domain operations, role views, a workshop board, scheduling, shop settings, scenarios, media attachments, item approvals, spending limits, notifications, conversations, and collection states. `npm run prototype:test` builds and runs domain and rendered-UI tests. The previous implementation run had 18 passing checks; verify the current state yourself rather than treating that count as a target.

The sample inspection is a captioned illustrative animation, not real workshop footage or an ElevenLabs video. Keep it truthfully labelled and usable offline. Prepared recordings can replace it. Do not create accounts, incur provider charges, or require ElevenLabs access. Sample bike facts include manufacturer source links. Preserve attribution, and keep fictional findings separate from manufacturer specifications.

The material gap is real-browser verification: the earlier environment blocked Chrome/headless Chromium launch. JSDOM does not prove visual layout, focus behaviour, video playback, or phone camera behaviour. Attempt browser testing in this environment. If that remains blocked, finish all independent work and report the exact remaining limitation without inventing evidence.

## Work within these boundaries

You may edit `prototype/**`, its package/lock files, and its documentation. Minimal root `package.json`, `package-lock.json`, and `README.md` changes are allowed only to support launching and checking the prototype. Write run-specific evidence and logs to the run directory supplied by the loop.

Do not edit the canonical spec, this handoff, the loop runner, unrelated application/server code, `.agents/`, `.claude/`, other review documents, or global settings. Do not read or print `.env`, credentials, customer uploads, or unrelated private files. Do not send external messages, deploy, publish, or change external systems. Local tests, ordinary project dependencies, and local browser tooling are authorised. Do not disable the browser/OS security boundary to force a test to work.

Keep the existing stack and Wheelhouse styling. Improve clarity, responsive behaviour, and accessibility within that direction. Avoid a wholesale redesign, framework migration, new abstractions without demonstrated need, or implementing every possible workshop policy. For small missing details, choose an explicit, changeable demo default and document it in `prototype/README.md`. Do not stop to ask for routine implementation choices or design approval already implicit in this build instruction.

Work as a single agent. Do not spawn other agents, another Claude instance, or a nested overnight loop. Tool permissions may be limited. If an operation is denied, use an authorised alternative where possible; do not bypass the restriction or spend repeated passes trying the same action.

## Each pass

1. Read the pinned spec and `prototype/OVERNIGHT.md` if present. Inspect git status, current files, and the previous pass's result/test logs named by the driver.
2. Maintain a P-01 through P-13 acceptance matrix in `prototype/OVERNIGHT.md`. For each criterion record `not checked`, `failing`, `passed`, or `blocked`, with the actual evidence path and any caveat. Do not mark an entire criterion passed from a static-code inspection alone.
3. Pick the highest-value incomplete criterion or observed defect. Reproduce it, implement the smallest coherent correction, and test the behaviour. Preserve the full end-to-end workflow. Spend most effort on gaps, not recurring broad reviews of already working code.
4. Run `npm run prototype:test` after a coherent change. Add meaningful regression tests for discovered domain or interaction defects. Do not remove tests, weaken assertions, add skips, or hide failures to get green output. Existing tests may be corrected only when they demonstrably contradict the pinned spec; explain the discrepancy.
5. Add and run `npm --prefix prototype run test:browser`, backed by real browser automation such as Playwright. Its command must start/stop its own server on an available test port, fail on test failures, and not depend on the already-running demo at 4173. Keep the browser tests in the repository. Exercise all P-01–P-13 workflows, keyboard interactions, real sample-video playback, error states, and 320px, 390px, 768px, and 1440px layouts. Save screenshots and check for horizontal overflow, clipped controls, console errors, inaccessible labels, and focus problems. Read screenshots using the available image-reading capability, not just their file existence. Real phone-camera capture can remain a clearly named manual check if no physical device is available; do not describe emulation as a real-device test.
6. Make browser workflows include: a new unknown-problem request; automatic and reviewed acceptance; both booking modes; shared-queue pickup; rescheduling conflicts; video inspection; mixed approvals; cumulative spending-limit excess; stale proposals; customer/shop messages; channel preferences; parts arrival after fast-forward; separate finishing/readiness/collection; saved and reset scenarios; invalidated old progress links. Newly discovered functional failures take priority over visual polish.
7. Update `prototype/OVERNIGHT.md` before the pass ends. Include completed work, remaining concrete tasks, blockers, test commands/results, evidence paths, and the next action. This is the durable handoff to the next fresh session, not a place for lengthy conversational history.
8. Return structured output in the driver's requested schema. `status` is `continue`, `complete`, or `blocked`; include a concise summary, remaining work, and blockers. If run interactively without a schema, return those same fields as JSON.

## Finish and stop conditions

A pass may report `complete` only when every automated portion of P-01–P-13 has evidence, production build/type checks and domain/UI/browser checks pass, screenshots have been inspected, and the README provides a reliable walkthrough. Document any physical-device-only checks separately. The driver will independently rerun the normal and browser commands before accepting completion.

Do not declare completion because tests already existed, because the token/time allowance is almost spent, or because another agent previously said it was done. If browser launch or a required capability is unavailable and no useful independent work remains, use `blocked`, identify the exact failed command and reason, and leave a clean, runnable prototype with a precise next action. Do not pretend browser verification happened.

Stop when the agreed prototype is complete. Do not keep inventing features or refactoring to fill the night. Time, iteration, and token stops are limits, not goals to consume. On a limit, leave the checkpoint accurate so work can resume without repeating the investigation.
