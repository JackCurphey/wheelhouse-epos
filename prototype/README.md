# Wheelhouse workshop prototype

A standalone interactive implementation of the [agreed workshop prototype](../docs/reviews/2026-09-08-workshop-prototype-decisions.md). One person can play the customer, shop, and mechanic in a single session. No database, incumbent till connection, messaging account, or payment provider is required.

## Run it

Use Node.js 22.18 or later. From the repository root:

```sh
npm ci --prefix prototype
npm run prototype
```

Open [the local prototype](http://127.0.0.1:4173/). The existing EPOS server is not needed. Dependencies and the lockfile live under `prototype/`, separate from the server.

For a phone on the same trusted network, run `npm --prefix prototype run dev -- --host 0.0.0.0` and open the computer’s LAN address on port 4173. Each browser tab has its own demonstration session; this does not synchronise two devices. Media has two separate inputs: **Take a photo or video** opens the camera on a phone, and **Or choose photos or video** picks a file that already exists on the device. Both are offered everywhere, because a phone browser given the camera hint will not also offer the photo library.

## A first walkthrough for Jack

1. Open **Scenarios** and start **Inspection and approval**. Open Priya’s bike.
2. Select **Share inspection**, keep or replace the sample video, edit the proposed items, and share the estimate.
3. Select **Open customer view**. Play the inspection and approve some items while declining others. Send the workshop a question.
4. Switch to **Shop**, reopen that bike, and reply. Start the authorised work. Use **Waiting for parts** to test a delay and revised estimate.
5. Use **+1 day** to simulate arrival, then explicitly resume the work. Finish it, mark the bike ready, and record collection. Billing remains a labelled stub.
6. Open **Demo inbox** to inspect the messages. Enable Email and SMS in the customer’s preferences, then trigger another selected update to compare channels.

Use **Shop settings** to compare appointments and day drop-offs, automatic acceptance and review (including per-service rules), and assigned mechanics and a shared queue. Create a new service request to exercise the changed settings. Existing bookings keep their agreed mode and time.

## Scenarios and time

Four starting points are supplied: a mixed workshop day, routine service, inspection and approval, and a parts delay. **Create a scenario** can save current bikes and settings, replace the active starting point, or start empty. Edit jobs through their workshop screens and save again to change the scenario.

The clock starts paused. **Run clock** advances 15 demo minutes every five real seconds. Pause stops automatic advancement; manual actions and fast-forward still work. Advancing time makes a scheduled part arrive; it does not automatically perform a repair or collect a bike.

**Reset scenario** restores its saved jobs, settings, clock, and parts timers, clears delivered messages, and rotates customer progress tokens. Saved scenarios remain available during the session. Refreshing or closing the tab discards all changes, custom scenarios, and attachments, consistent with the agreed single-session scope.

## Explicit operating defaults

- Shop hours are 09:00–17:00. Three mechanics have eight hours of daily capacity each. Timed appointments also check mechanic overlap; drop-offs reserve planned minutes for the day.
- Pending review holds capacity, with no automatic expiry. Replanning checks capacity before changing the job. Planned minutes do not change the price.
- Unknown work initially reserves one hour and displays a zero initial estimate pending diagnosis; it is not a promise of a free repair.
- WhatsApp is the default simulated channel. Booking, approval, delays, readiness, and messages are enabled; routine progress is initially off. Customers can change events/channels or turn them off and use their progress page.
- Spending limits include the original service and cumulative authorised extras. New proposal items are considered in display order. Items exceeding the remaining limit require explicit approval. Changing a limit does not silently approve already-pending items or revoke past approvals.
- Resubmitting an inspection replaces unresolved items with a new proposal version. Approved and declined lines retain their exact amounts and decisions. The shop starts work once outstanding choices are resolved.
- Work completed, ready for collection, and collected are distinct. Billing never marks work complete or proves collection.
- Customer media offers both a camera capture and an ordinary file choice on every browser. Nothing is uploaded; attachments are browser object URLs held in the tab.
- Navigation shows icon-and-label at phone widths, icons with hover names between roughly 620px and 900px, and a full sidebar above that.

## Media and sources

The included 18-second inspection clip is an original captioned **illustrative animation**, not footage of a real bike or an ElevenLabs-generated video. It can be used immediately and replaced with a mechanic’s phone recording or prepared ElevenLabs assets. There is no ElevenLabs account connection in this implementation. Uploaded media stays in memory using browser object URLs; nothing is transmitted to a storage provider.

The source is [create-sample-media.py](scripts/create-sample-media.py); regenerating the checked-in MP4, poster, and captions requires Pillow and ffmpeg. Running the demo does not require either tool.

Sample bike facts are paraphrased from manufacturer pages, checked on 8 September 2026:

- [Brompton C Line subscription](https://www.brompton.com/p/1565/c-line-subscription): steel frame, six-speed folding bike.
- [Trek Domane AL 2](https://www.trekbikes.com/us/en_US/bikes/road-bikes/performance-road-bikes/domane/domane-al/domane-al-2/p/549562/): 100 Series Alpha aluminium and Shimano Claris eight-speed. This fixture does not claim to describe every generation of the model.

Sources remain linked on the shop’s bike detail and in `BIKES` metadata. Customer identities, repair findings, and prices are fictional.

## Implementation and verification

- React and TypeScript, Vite, Tailwind, and Wheelhouse’s existing green/orange palette. Native form and dialog elements keep the prototype independent of the stale checkout’s absent component registry.
- [model.ts](src/model.ts) holds workshop operations and a simulated notification delivery adapter. [main.tsx](src/main.tsx) connects the same state to all roles. Provider delivery is separate from event creation so real adapters can be introduced later.
- No external message send, financial transaction, or production API call occurs. Customer links resolve within the current tab’s memory; role switching is a demo control, not production authorisation.
- Time is an explicit shop-local demo clock represented using UTC arithmetic. Production timezone, holiday, split-job, and multi-user concurrency rules remain outside this prototype.

```sh
npm run prototype:test              # types, production build, domain and JSDOM UI checks
npm run prototype:browser:install   # once: downloads Chromium into prototype/.playwright-browsers
npm run prototype:test:browser      # the built bundle in a real browser
```

`prototype:test` type-checks and builds, then runs 15 domain checks and three interaction walkthroughs against the actual production bundle in JSDOM. These cover stale approval protection, cumulative limits, capacity conflicts, messaging preferences, scenario restoration, uploads, and the request-to-collection path.

`prototype:test:browser` runs 20 checks in a real Chromium against the built bundle, served on an ephemeral port by the test itself — it does not use or disturb the demo on 4173. These cover the P-01 to P-13 walkthroughs, layout at 320px, 390px, 768px and 1440px across nine screens, keyboard-only navigation and focus, horizontal overflow and clipped or unlabelled controls, console errors, and actual playback of both the seeded clip and an uploaded video. Screenshots are written to `.prototype-overnight/browser/`. Chromium is installed inside `prototype/`; an installed Google Chrome is used as a fallback.

Both suites passed in the session recorded in [OVERNIGHT.md](OVERNIGHT.md), which also lists the deliberate breakages used to confirm each check can fail.

**What automation does not establish.** Only Chromium was exercised, so Safari and Firefox — and MOV playback, which depends on the browser's codecs — still need a manual look; MP4 is the supplied sample format. Browser emulation cannot open a real camera, so capturing a photo or video on a physical phone remains a manual check before a participant session. Run the walkthrough once on an actual phone and on a laptop.

Production access control, durable storage, external guest links, billing, provider integrations, and commercial packaging remain separate follow-on work.
