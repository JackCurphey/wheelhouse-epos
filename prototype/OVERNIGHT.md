# Overnight checkpoint — workshop prototype

Session of 8 September 2026. Governing specification: [workshop prototype decisions](../docs/reviews/2026-09-08-workshop-prototype-decisions.md). This file is the durable handoff: what changed, what is proven, what is not.

## State

The prototype implements the agreed scope. Two check suites run against it:

| Command | What it proves | Result |
|---|---|---|
| `npm run prototype:test` | Type check, production build, 15 domain checks, 3 rendered-UI walkthroughs in JSDOM | 18/18 pass |
| `npm run prototype:test:browser` | The built bundle in a real Chromium, on its own ephemeral port | 20/20 pass |

Both were run from a clean build in this session. The earlier report of 18 passing checks was reproduced rather than assumed.

Real-browser verification was the material gap in the previous session and is now closed for everything automation can reach. What remains manual is listed under [Not proven](#not-proven).

## What changed this session

1. **Real-browser test suite added** (`tests/browser/`), run by `npm --prefix prototype run test:browser`.
   - `harness.mjs` serves `dist/` over a static server on port 0 (an ephemeral port), with byte-range support so `<video>` can seek. It never touches the demo on 4173 and starts and stops its own server.
   - Chromium comes from `prototype/.playwright-browsers` (gitignored, installed by `npm --prefix prototype run test:browser:install`), falling back to an installed Google Chrome. The shared `~/Library/Caches/ms-playwright` cache is deliberately not written to; it held a stale `__dirlock` and may be in use by other sessions.
   - Console errors, page errors and failed requests fail the tests. Aborted `media` range requests are excluded, because browsers abort those routinely once buffered; playback is asserted directly instead.
2. **Media capture defect fixed.** The photo/video input carried `capture="environment"` unconditionally. On a phone that opens the camera and never offers the photo library, so a rider could not attach a photo they already had — directly against P-02. There are now two inputs: *Take a photo or video* (camera) and *Or choose photos or video* (existing files). Same split on the mechanic's inspection form. Covered by a browser test that fails if either input disappears.
3. **Navigation label defect fixed.** At 320px the "Demo inbox" and "Shop settings" labels spilled outside their buttons and touched. Labels shrink below 400px. At 621–900px the sidebar is icons only; the nav buttons now carry a `title` so a pointer user can read the name, not only a screen reader. Covered by a browser test measuring label boxes.
4. **JSDOM test updated** for the new media input labels (`Or choose photos or video`). No assertion was removed or weakened.
5. Root `package.json` gained `prototype:test:browser` and `prototype:browser:install`.
6. **New dependency:** `playwright@1.63.0` as a `devDependency` of `prototype/` only. It is the browser automation the brief asked for. Nothing in the demo itself depends on it, and the browser binary lives in a gitignored directory inside `prototype/`.

The browser suite takes about 40 seconds. Roughly 20 of those are the clock test, which has to wait on a real five-second interval; it polls for the clock to change rather than sleeping a fixed time, so a browser throttling timers slows it down but does not make it flaky.

## Acceptance matrix

Every "passed" row below names a check that was run in this session and a screenshot that was opened and looked at, not merely written to disk. Evidence paths are under `.prototype-overnight/browser/`.

| ID | Status | Evidence |
|---|---|---|
| P-01 Default scenarios, edit one, create one | passed | browser `saving, starting, and resetting a scenario leaves no stale state or link` (edits booking model and allocation, saves "Jack's drop-off day", starts it); domain `custom scenarios snapshot settings, jobs and media independently of later edits`; `sim-02-scenarios.png`, `{320,390,768,1440}-scenarios.png` |
| P-02 Phone guest request, plain language, media, no account | passed (emulated phone) | browser `guest request on a phone runs to collection with mixed item approvals` at 390px, real PNG attached through the file input; `a mechanic's uploaded video plays and a rider's photo renders`; `media inputs offer both a camera capture and a file choice`; `flow-01-request-created.png`, `390-request.png`. Physical-phone camera capture is a manual check. |
| P-03 Automatic vs review, service rules, pending distinct | passed | browser `review, drop-off, and shared queue are visibly different from the automatic path` (per-service rules: routine auto, unknown reviewed; "Needs review" on the card only for the reviewed job) and the automatic arm in the guest-request test; `flow-04-settings.png`, `flow-05-pending-review.png` |
| P-04 Appointments vs drop-off days | passed | same browser test: customer hero reads `Drop-off: … between 09:00 and 17:00` with no time promised, diary reads "Drop-offs reserve work for the day"; appointment arm books 14:00; `768-schedule.png` |
| P-05 Mechanic assignment and shared queue | passed | browser `review, drop-off, and shared queue …` — queue job is unassigned until "Take this job", history records the pickup; assignment path shows "Assigned to Jack"; `flow-06-queue-pickup.png` |
| P-06 Inspection video, itemised work, mixed approve/decline | passed | browser guest-request test (approve one, decline two; declined excluded from the total; start blocked while choices are outstanding) and `a new proposal keeps settled lines and replaces only the undecided one`; `flow-02-customer-inspection.png`, `flow-08-reproposal.png` |
| P-07 Advance permission and exceeding the limit | passed | browser `a spending limit authorises work cumulatively and stops at the limit` — £65 service under a £100 limit authorises £20 and holds £30 for explicit approval; `flow-07-limit-split.png` |
| P-08 Preferences, simulated Email/SMS/WhatsApp, nothing sent | passed | browser `notification preferences change channels without changing the job history`; the test also records every request and asserts none left the test origin; turning all channels off stops delivery but keeps the conversation; `sim-01-inbox.png` |
| P-09 Conversation consistent across views | passed | browser guest-request test (customer → shop → customer) and `the same job follows a participant across all three roles` |
| P-10 Parts hold, revised estimate, fast-forward, resume | passed | browser `a parts hold revises the estimate and only the shop resumes the work` (resume disabled until the part lands, time alone does not finish the work) and `the clock only runs when Jack starts it`; `flow-09-part-arrived.png` |
| P-11 Finished, ready, collected as separate steps | passed | browser guest-request test — billing stub is present and disabled, "Record collection" does not exist until the bike is marked ready; `flow-03-ready-for-collection.png` |
| P-12 Pause and reset with no stale carry-over | passed | browser `saving, starting, and resetting …` (inbox cleared, clock back to Tue 8 Sept, old progress token refused inside the live session, new token works) and the clock test; `sim-03-stale-link.png` |
| P-13 One session, every role, phone and larger screens | passed (emulated) | full walkthrough at 390px; layout checks at 320, 390, 768 and 1440px across workshop, request, job detail, inspection dialog, schedule, settings, scenarios, inbox and customer views; keyboard-only navigation with a visible focus ring and Escape closing a dialog; all screenshots inspected. Real-device checks remain manual. |

Also proven in a real browser, beyond the numbered walkthroughs: the seeded H.264 clip decodes at 1280×720 and advances when played, with its captions track and poster; an uploaded video plays from a blob URL and never leaves the browser; a rescheduling conflict is refused ("Sam has no remaining capacity that day.") and the original booking is unchanged.

## Tests were watched failing

A green check is worth nothing until it has gone red on purpose. Each of these mutations was applied to source, confirmed to have landed, built, and the named check went red; then the source was restored and both suites re-run green.

| Mutation | Check that failed |
|---|---|
| `decide` records a decline as an approval | guest request … mixed item approvals |
| reset stops rotating progress tokens | saving, starting, and resetting a scenario … |
| `.board { min-width: 1600px }` | layout at 390px |
| sample clip points at a missing file | the seeded inspection clip actually decodes and plays |
| delivery ignores channel preferences | notification preferences change channels … |
| focus outline removed | keyboard alone reaches navigation, roles, and the request form |
| the clock ignores `paused` | the clock only runs when Jack starts it |
| a drop-off day renders as a start time | review, drop-off, and shared queue … |

Reproduce any of them by making the edit, running `npm run build`, then `node --test --test-concurrency=1 --test-name-pattern="<name>" tests/browser/<file>`.

## Not proven

- **Physical-phone camera capture.** Browser emulation cannot open a real camera. The test asserts the two file inputs and their `accept`/`capture` attributes, which is what a phone browser acts on; opening the camera on an actual iPhone or Android device is a manual check. Do not read the emulated pass as a device test.
- **Safari and Firefox.** Only Chromium was exercised. MOV playback in particular depends on the browser's codecs; MP4/H.264 is the supplied sample format.
- **Two devices at once.** Each tab is its own demo session by design; there is no synchronisation to test.
- **Anything deferred by the spec** — real messaging, invoices, payments, till integration, durable storage, production access control — is absent by intent, not untested.

## How Jack launches it

From the repository root, with Node.js 22.18 or later:

```sh
npm ci --prefix prototype
npm run prototype
```

Then open http://127.0.0.1:4173/. The walkthrough is in [README.md](README.md). Nothing else needs to run: no database, till, messaging account or payment provider.

To run the checks:

```sh
npm run prototype:test              # types, build, domain and JSDOM UI checks
npm run prototype:browser:install   # once, downloads Chromium into prototype/
npm run prototype:test:browser      # real-browser checks and screenshots
```

Screenshots land in `.prototype-overnight/browser/` (gitignored).

## Next concrete actions

In priority order, for whoever picks this up:

1. Run the walkthrough on a physical phone and an iPad: attach a photo from the library and record one with the camera, on Safari and Chrome. This is the only remaining gap in P-02 and P-13.
2. Decide whether to keep the prepared illustrative clip or replace it with real workshop footage. The clip is labelled "ILLUSTRATIVE INSPECTION / FICTIONAL DEMO FOOTAGE" on the frames themselves; a replacement must keep an equivalent label.
3. Consider adding Firefox and WebKit to the browser suite. The harness takes a browser engine, so this is a small change, but each engine adds a download.
4. Nothing in the spec's scope is known to be unimplemented. Resist adding features; the open questions are commercial, and Jack answers those by watching people use this.
