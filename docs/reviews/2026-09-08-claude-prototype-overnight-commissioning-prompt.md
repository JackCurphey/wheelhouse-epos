Build and refine the Wheelhouse workshop prototype in this repository overnight. Continue the implementation already present; do not start again or merely produce a plan.

THE SPECIFICATION TO FOLLOW

Read docs/reviews/2026-09-08-workshop-prototype-decisions.md in full. This is the governing product specification, based on Mark’s answers acting as Jack’s proxy. Follow its agreed scope and P-01 through P-13 acceptance walkthroughs. Do not edit this specification, weaken its criteria, or replace it with an older plan.

Then read prototype/README.md and inspect prototype/. For additional execution guidance, read docs/reviews/2026-09-08-claude-prototype-overnight-prompt.md. The older business plans, feature catalogue, master implementation plan, and broad adversarial-review backlog are background only. Where they conflict with these explicit prototype decisions, follow the prototype decisions. Apply repository instructions for implementation conventions without reviving superseded product scope.

WHAT WE ARE BUILDING

An interactive, fully responsive, standalone bike-workshop prototype that Jack can show people to test whether they share his workflows and problems. A single participant can switch between customer, mechanic, and shop roles in the same scenario. Their actions must update the same job, rather than disconnected screen mockups.

Include:
- Guest service requests, including an unknown problem described in plain language, photos, and video. No mandatory customer account.
- Customer progress links, inspection videos, work approvals, and conversations attached to the request.
- Configurable automatic acceptance and shop review, including rules by service type.
- Both exact appointments and day-based drop-offs, selectable by the shop.
- Both individual mechanic assignments and a shared work queue.
- Phone-based inspection media and itemised proposed extra work. Customers can approve or decline each item separately, or give advance permission up to a whole-job spending limit. Preserve the exact authorised work, estimate versions, and amounts.
- Parts delays, revised completion estimates, and customer/shop messages.
- Simulated Email, SMS, and WhatsApp notifications with sensible defaults and customer-selectable events and channels. Separate workshop events from delivery so providers can be connected later.
- Distinct work finished, ready for collection, and collected states.
- Billing represented in the UX by a clearly labelled stub. No real invoices or payments.
- Jack-controlled editable default scenarios and custom scenarios, with pause, fast-forward, and reset. Seed realistic fictional customers, bikes, jobs, and inspection media. Support a complete walkthrough in one session.

Pricing, the target audience, and the free/paid split remain undecided. Freemium is only a working hypothesis. Do not choose a market, implement pricing or entitlements, promise anything free forever, or treat Lightspeed R-Series as the selected audience. Do not add live till integrations, production auth migration, a multi-tenant backend, real messaging, billing providers, analytics, surveys, or feedback capture. Jack learns by watching participants.

CONTINUE THE EXISTING WORK

The prototype is already implemented in React/TypeScript/Vite under prototype/. It has domain and rendered-UI tests, shared role views, scheduling, scenarios, approvals, messaging, and collection tracking. Run the checks yourself; do not rely on the previous report of 18 passing tests.

The primary unverified area is real-browser behaviour. The earlier environment blocked Chrome/headless Chromium launch. JSDOM tests do not establish responsive layout, focus behaviour, camera capture, or video playback. Attempt those checks in this session’s environment and fix the problems you find.

The supplied inspection video is a captioned illustrative animation, not real bike footage or an ElevenLabs-generated video. Keep it truthfully labelled. It can be replaced with prepared recordings, but do not require an ElevenLabs account or incur provider charges. Preserve manufacturer source links for sample bike specifications.

The current working directory contains important uncommitted and untracked work. Stay in this checkout. Do not switch branches, pull, reset, clean, stash, rebase, merge, commit, push, or move to a fresh worktree that loses those files. Preserve unrelated changes, including .agents/STATUS.md and existing review documents.

You may edit prototype/** and make minimal root package/README changes needed to launch or verify it. Write progress to prototype/OVERNIGHT.md and evidence under .prototype-overnight/. Do not change the governing spec, this prompt, the overnight runner, unrelated server/application code, global settings, or Claude configuration. Do not read credentials, .env files, or unrelated customer uploads. Do not deploy, publish, or send external messages.

HOW TO WORK THROUGH THE NIGHT

Work autonomously through this loop within the current Claude Code session:

1. Read the spec and current checkpoint. Maintain a P-01–P-13 acceptance matrix in prototype/OVERNIGHT.md with actual evidence, failures, and remaining checks.
2. Pick the highest-value unresolved acceptance gap or demonstrated defect. Reproduce it, implement the smallest coherent correction, and verify it.
3. Run npm run prototype:test after coherent changes. Add meaningful regression tests for discovered defects. Do not remove assertions, skip tests, or hide failures to obtain a passing result.
4. Add and run npm --prefix prototype run test:browser using real browser automation such as Playwright. The test command must manage its own server on an available test port and fail when checks fail. Do not depend on the existing demo server at port 4173 or kill unrelated processes.
5. Exercise the complete customer-to-collection workflow, both booking and acceptance modes, shared-queue pickup, rescheduling conflicts, mixed item approvals, cumulative spending limits, stale proposals, conversations, notification preferences, parts arrival, and scenario saving/reset. Check that old progress links do not open a new run’s jobs.
6. Test layouts at 320px, 390px, 768px, and 1440px. Inspect screenshots, horizontal overflow, clipped controls, keyboard navigation, focus, labels, console errors, and actual sample-video playback. Save evidence. Distinguish mobile emulation from a physical-phone camera test.
7. Update prototype/OVERNIGHT.md after each coherent step with changes, commands/results, evidence paths, blockers, and the next concrete action. After context compaction, reread this file and the governing spec and continue without repeating completed work.
8. Repeat until the agreed prototype is ready, the session’s limits are reached, or no useful work remains because of a genuine blocker.

Use reasonable judgement for small implementation details. Record changeable demo defaults in prototype/README.md. Do not pause for routine decisions already authorised by this brief. Keep Wheelhouse’s existing stack and styling; avoid a rewrite, a general workflow engine, or additional features merely to fill the night. Work as one agent; do not spawn other agents or nested Claude sessions.

Aim for the roughly 100k additional working-token allowance discussed, with 200k as a planning ceiling and eight hours as the overnight window. Do not claim that this pasted prompt enforces a hard token, billing, or runtime cap. Do not run the separate overnight script from inside this Claude Code session, install a looping plugin, or change permissions to manufacture unattended access. If the session cannot continue automatically, leave a precise checkpoint rather than claiming a loop remains running.

If a tool or browser launch is denied, use an authorised alternative where possible. Do not bypass security restrictions. Finish independent work before stopping on a blocker, and record the exact failed command and reason. Do not fabricate browser evidence or describe JSDOM checks as real-browser verification.

DONE MEANS

The agreed P-01–P-13 workflows work end to end; build, type checks, domain/UI tests, and real-browser tests pass; screenshots have been inspected; and the README gives Jack a reliable launch and walkthrough procedure. Physical-device-only checks may remain explicitly listed as manual checks. Missing automated browser verification must be reported as incomplete, not silently waived.

At the end, leave the code and an accurate prototype/OVERNIGHT.md containing what changed, acceptance evidence, tests run, remaining limitations, and exactly how Jack launches the demo. Stop when this scope is complete. Do not keep polishing or inventing features to consume the remaining night.

Start now by reading the governing specification, checking the working tree, and running the current prototype checks. Then implement and verify the highest-value remaining gap.
