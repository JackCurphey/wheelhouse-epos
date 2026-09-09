# Workshop prototype decisions — 8 September 2026

Status: prototype scope agreed in conversation with Mark, acting as Jack's proxy. This records the answers following the [adversarial review](2026-09-08-spec-and-business-adversarial-review.md). It defines the next learning prototype, not a production release or a validated commercial offer.

Implementation: the standalone [interactive prototype and walkthrough guide](../../prototype/README.md) now implement this scope. Type checking, the production build, 15 domain checks, and three rendered-UI walkthroughs pass. Real-browser visual layout, phone camera capture, and media playback remain to be checked; browser launch was blocked in the implementation environment. The supplied inspection video is an illustrative animation that can be replaced with prepared footage.

## Purpose and commercial position

Build something people can interact with before asking Jack to validate the product. Jack will take the prototype to a broad set of potential users and observe whether their workflows and problems match his experience, where they differ, and how useful the proposed system could be.

- Freemium is the working hypothesis. Pricing, the free/paid split, limits, and commercial promises remain undecided until evidence supports them. Neither “everything free forever” nor a paid till at the previously proposed price is approved by this conversation.
- The target audience is unvalidated. Lightspeed R-Series users are one possible group, not the selected first market. The demonstrated domain remains bike workshops; expansion into other industries was not decided.
- The immediate milestone is an interactive, standalone prototype. Real-shop adoption, willingness to pay, conversion, and sustainable operating costs remain later questions. A successful demonstration does not settle them.
- Jack owns validation. Feedback comes from watching people use the prototype; do not build a feedback capture or export feature.

This decision removes pricing and target-segment selection as prerequisites for this prototype. It does not close the commercial evidence gaps for a live service. Earlier integration-first and paid-conversion milestones do not define acceptance of this prototype.

## Agreed experience

The walkthrough runs from a customer's service request through shop scheduling, inspection, approvals, work, updates, and collection. Billing appears in the UX as a clearly labelled stub.

| Area | Agreed prototype behavior |
|---|---|
| Participants | A single person can play multiple roles and switch between customer and shop views in the same scenario. Participants can interact directly, including changing shop settings. |
| Devices | Fully responsive. Customer requests and mechanic inspections work on phones; scheduling works on a larger screen and remains usable on smaller screens. |
| Customer entry | No account required. A customer can describe a problem in their own words and attach photos or video without knowing which service to choose. |
| Return access | A customer progress link provides access to status, inspection videos, messages, and approvals. It represents secure guest access, not a requirement to create an account. |
| Acceptance | Model automatic acceptance and shop review before confirmation. Allow testing a shop-wide mode and service-specific rules rather than selecting a single permanent policy. |
| Booking | Shops can choose exact appointments or day-based drop-offs. A drop-off date is not a promised mechanic start time. |
| Work allocation | Model both assignment to individual mechanics and a shared queue from which staff take work. |
| Inspection | A mechanic can capture a video with a phone, explain findings, and propose additional work with estimated costs. Seeded inspection videos support immediate demonstrations. |
| Authorisation | Customers can approve or decline proposed items separately. Also model advance permission up to a spending limit. The shop can see what was authorised. |
| Delays | Jobs can wait for parts, with revised completion estimates visible to customers. |
| Conversations | Customer–shop messages remain attached to the service request. |
| Notifications | Simulate email, SMS, WhatsApp, and allow other channels later. Provide sensible defaults; customers can choose updates and channels. |
| Completion | Track work finished, ready for collection, and collected separately, preserving visibility of bikes still in the shop's care. |
| Billing | Show the billing step and illustrative amounts, but stub invoicing and payment. No real financial transaction is needed for the prototype. |

## Jack-controlled simulator

- Runs independently of an incumbent till, stock system, or external provider.
- Lets Jack create scenarios, start from editable defaults, and run the customer and shop sides.
- Supports pause, fast-forward, and reset, so several days of activity fit into one session.
- Seeds realistic sample bikes, fictional customers, jobs, and inspection media so participants can begin immediately.
- Supports changing the modeled operating options and seeing their consequences in the interactive workflow.
- Needs to support one complete session. Resuming a participant's session on a later visit is not required.
- Does not require an autonomous simulator to invent activity: Jack drives the scenarios.

### Default scenarios

The following are proposed fixture details implementing the agreed defaults, not validated operating policies. Jack can edit them.

| Scenario | Walkthrough and options to compare |
|---|---|
| Routine service | Customer selects a known service; compare automatic acceptance with review, an exact appointment with a drop-off day, and mechanic assignment with the shared queue. Complete the work, show the billing stub, mark ready, then record collection. |
| Problem diagnosis and extra work | Customer describes an unknown problem and attaches media. Mechanic performs a video inspection and proposes several items. Customer approves some and declines others. Replay with an advance spending limit. |
| Parts delay | An authorised repair waits for a part. Shop changes the estimated completion date, customer sees the update and asks a question, work resumes, and the bike progresses to collection. |

These are editable scenarios, not a requirement to build every combination as a separate demo. Each should expose where a participant's real process differs from Jack's assumptions.

### Demo content

Use web-sourced bike specifications with source URLs retained in fixture metadata. Jack suggested ElevenLabs for creating sample inspection videos. This is a production approach to investigate, not a verified assertion that a particular ElevenLabs product provides the complete video workflow. No provider dependency is required to run the finished demo; use prepared assets.

Use sample identities and clearly distinguish illustrative inspection findings from manufacturer specifications. Media and notification previews should be ready before the session so demonstrations do not depend on provider setup.

## Design constraints that preserve a later real implementation

These are proposed implementation guardrails derived from the agreed scope. They are not evidence of production readiness and do not mandate a framework rewrite or provider infrastructure.

1. **Keep workshop facts independent of the till.** Requests, planned effort, scheduling, approvals, work state, and custody must work without creating a sale or issuing an invoice. Displayed estimates support approval demonstrations without pretending to settle money.
2. **Use one job across role views.** A customer's approval or message updates the same scenario state the shop sees. Switching roles must not create disconnected screen mockups.
3. **Separate events from delivery.** Workshop actions produce notification intentions with a recipient, event, channel, and content. A simulated delivery adapter renders these in the demo inbox. Real email, SMS, and WhatsApp adapters can be added later; the prototype does not claim that their onboarding, templates, permissions, or delivery behavior have been implemented.
4. **Keep simulation controls explicit.** Advancing the scenario clock should advance delays and scheduled updates consistently. Pausing and resetting must not leak messages or job changes from a previous run. Real-world delivery is disabled.
5. **Make authorisation precise.** Approval refers to the displayed work and estimate version. Declined work is not authorised. A spending limit applies to a clearly displayed scope and total; increasing that amount or changing the scope must not silently inherit consent.
6. **Separate work, custody, and billing.** Work completed does not imply collection or payment. The billing stub must not assert a real invoice or settlement exists.
7. **Keep demo role switching distinct from real access control.** A future live service needs genuine guest-link security and staff authorisation. A role selector used during a demo is not that security boundary.

## Prototype acceptance walkthrough

These checks describe the agreed demonstration, not automated tests claimed to have run.

| ID | Check |
|---|---|
| P-01 | Start with populated default scenarios; edit one and create a scenario with Jack's chosen operating settings. |
| P-02 | As a customer on a phone, request an unknown repair with text and media without creating an account. |
| P-03 | Compare automatic acceptance and shop review, including service-specific behavior. Pending requests are visibly distinct from confirmed bookings. |
| P-04 | Compare exact appointments and day-based drop-offs without presenting a drop-off day as a fixed work start time. |
| P-05 | Assign work to a mechanic, then demonstrate the shared-queue alternative. |
| P-06 | As a mechanic, add an inspection video and itemised proposed work; switch to the customer link and approve some items while declining others. |
| P-07 | Replay with advance permission up to a spending limit; show what happens when proposed work exceeds the limit. |
| P-08 | Change notification preferences and inspect simulated email, SMS, and WhatsApp messages from the same workshop workflow. No external message is sent. |
| P-09 | Exchange messages through the request and see consistent history from customer and shop views. |
| P-10 | Put a job on hold for parts, revise its estimate, fast-forward, and resume work. |
| P-11 | Finish work, pass the clearly labelled billing stub, mark the bike ready, and record collection as separate actions. |
| P-12 | Pause and reset a scenario with no stale jobs, approvals, or scheduled messages carried into the new run. |
| P-13 | A participant can complete the walkthrough in one session and use each role on relevant phone and larger-screen layouts. No built-in feedback system is needed. |

## Remaining prototype details

These can be specified as explicit, changeable demo defaults before implementing the affected behavior. They do not reopen the agreed scope or require another commercial decision round.

- Which notifications are on by default, which channel each uses, and how preferences affect requests for approval.
- What happens to capacity while a request awaits shop review; how conflicts and setting changes affect existing bookings.
- How advance spending limits include the original estimate and subsequent extras, and how revised work prompts fresh approval.
- Whether customer media is captured, uploaded, or selected from prepared assets on each supported browser.
- How simulated guest links and role switching behave within the shared session.

Keep these choices visible in the spec and prototype so Jack can test alternatives. Do not expand the list of operating options indefinitely before the core walkthrough works.

## Deferred beyond the prototype

Live till integrations and migration, real invoices and payments, real outbound messaging, provider-account setup, production onboarding, and commercial entitlements are not required for this prototype. The full [acceptance-scenario review](2026-09-08-spec-acceptance-scenarios.md) still records the relevant questions before enabling those capabilities.

After observation, revisit audience selection, which operating variants deserve support, pricing and packaging, and whether the demonstrated value justifies a live pilot. Commercial validation remains open until evidence addresses it.
