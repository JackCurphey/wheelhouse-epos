import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { startServer, launch, openApp, shot, VIEWPORTS } from "./harness.mjs";
import {
  nav,
  role,
  press,
  card,
  openJob,
  dialog,
  sendRequest,
  shareInspection,
  jobText,
} from "./actions.mjs";

const PHOTO = fileURLToPath(new URL("./fixtures/rider-photo.png", import.meta.url));
const PHONE = VIEWPORTS[1];
const DESK = VIEWPORTS[3];

let server;
let browser;
test.before(async () => {
  server = await startServer();
  ({ browser } = await launch());
});
test.after(async () => {
  await browser?.close();
  await server?.close();
});

// P-02, P-03 (automatic), P-04 (appointment), P-06, P-09, P-11
test("guest request on a phone runs to collection with mixed item approvals", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, PHONE);
  try {
    // P-03 automatic arm: confirm without shop review.
    await nav(page, "Shop settings");
    await page.getByLabel(/Automatically/).check();
    await nav(page, "Workshop");
    await sendRequest(page, {
      name: "Jamie Rivers",
      bike: "Trek Domane AL 2",
      service: "Not sure — diagnose a problem",
      problem: "A grinding noise from the back wheel when I pedal hard.",
      files: [PHOTO],
      time: "14:00",
    });
    // No account was created: the request opens straight into the job.
    await page.getByRole("heading", { name: "Trek Domane AL 2" }).first().waitFor();
    const detail = await jobText(page);
    assert.match(detail, /Jamie Rivers/);
    assert.doesNotMatch(detail, /Needs review/);
    await shot(page, "flow-01-request-created");

    // The rider's own photo is attached to the request the shop sees.
    assert.equal(await page.locator("main img[alt='rider-photo.png']").count(), 1);

    await press(page, "Receive bike");
    await shareInspection(page, {
      note: "The rear hub bearings are dry and the pads are down to the metal.",
      items: [
        { name: "Replace rear hub bearings", amount: "48.00" },
        { name: "Replace rear brake pads", amount: "26.00" },
        { name: "New bar tape", amount: "22.00" },
      ],
    });
    // Work cannot start while the rider still has choices to make.
    assert.equal(
      await page.getByRole("button", { name: "Start authorised work" }).isDisabled(),
      true,
    );

    await press(page, "Open customer view");
    await page.getByRole("heading", { name: "See what we found" }).waitFor();
    await shot(page, "flow-02-customer-inspection");
    await press(page, "Approve Replace rear hub bearings");
    await press(page, "Decline Replace rear brake pads");
    await press(page, "Decline New bar tape");
    const customer = await jobText(page);
    assert.match(customer, /Approved by customer/);
    assert.match(customer, /Declined — not included/);
    // Declined lines are excluded from the authorised total (£0 diagnosis + £48).
    assert.match(customer, /£48\.00/);
    assert.doesNotMatch(customer, /£96\.00/);

    // P-09: the conversation is one history seen from both sides.
    await page.getByLabel("Your message").fill("Can I collect on Thursday?");
    await press(page, "Send message");
    assert.match(await jobText(page), /Can I collect on Thursday\?/);

    await role(page, "Shop");
    await openJob(page, "Jamie Rivers");
    assert.match(await jobText(page), /Can I collect on Thursday\?/);
    await page.getByLabel("Your message").fill("Thursday works. We will confirm.");
    await press(page, "Send message");

    // P-11: work, billing stub, readiness, and collection are separate steps.
    await press(page, "Start authorised work");
    await press(page, "Finish work");
    const finished = await jobText(page);
    assert.match(finished, /Prototype stub/);
    assert.match(finished, /In the shop’s care/);
    assert.equal(
      await page.getByRole("button", { name: "Invoice and payment coming later" }).isDisabled(),
      true,
      "the billing stub must not be actionable",
    );
    assert.equal(await page.getByRole("button", { name: "Record collection" }).count(), 0);
    await press(page, "Mark ready for collection");
    await shot(page, "flow-03-ready-for-collection");
    await press(page, "Record collection");
    assert.match(await jobText(page), /Back on the road/);

    await role(page, "Customer");
    assert.match(await jobText(page), /collected/i);
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// P-03 (review and per-service rules), P-04 (drop-off), P-05 (shared queue)
test("review, drop-off, and shared queue are visibly different from the automatic path", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    await nav(page, "Shop settings");
    await page.getByLabel(/Day-based drop-offs/).check();
    await page.getByLabel(/Depends on the service/).check();
    await page.getByLabel("Not sure — diagnose a problem", { exact: true }).selectOption("review");
    await page.getByLabel("Routine service", { exact: true }).selectOption("auto");
    await page.getByLabel(/Shared queue/).check();
    await shot(page, "flow-04-settings");

    await nav(page, "Workshop");
    await sendRequest(page, {
      name: "Casey Lane",
      bike: "Brompton C Line",
      service: "Routine service",
      problem: "Annual service before winter.",
    });
    // The service-specific rule confirms a familiar job automatically.
    const auto = await jobText(page);
    assert.doesNotMatch(auto, /Needs review/);
    assert.match(auto, /Drop-off/);
    assert.doesNotMatch(auto, /Appointment\n/);

    // P-04: a drop-off day must not read as a promised start time.
    await press(page, "Open customer view");
    const hero = await page.locator(".customer-hero").innerText();
    assert.match(hero, /Drop-off: [^\n]*between 09:00 and 17:00/);
    assert.doesNotMatch(hero, /Appointment|at \d\d:\d\d/);
    await role(page, "Shop");
    await nav(page, "Schedule");
    assert.match(
      await jobText(page),
      /Drop-offs reserve work for the day/,
      "the diary should say a drop-off is not a fixed start time",
    );

    await nav(page, "Workshop");
    await sendRequest(page, {
      name: "Rowan Fox",
      bike: "Trek Domane AL 2",
      service: "Not sure — diagnose a problem",
      problem: "Something clicks when I stand on the pedals.",
    });
    const review = await jobText(page);
    assert.match(review, /Needs review|reviewing your request/i);
    assert.match(review, /Shared queue/);
    await shot(page, "flow-05-pending-review");

    // A pending request is visibly distinct on the board from a confirmed one.
    await nav(page, "Workshop");
    const pending = card(page, "Rowan Fox");
    assert.match(await pending.innerText(), /Needs review/i);
    assert.doesNotMatch(await card(page, "Casey Lane").innerText(), /Needs review/i);

    await openJob(page, "Rowan Fox");
    await press(page, "Accept request");
    assert.doesNotMatch(await jobText(page), /Needs review/i);

    // P-05: unassigned queue work is picked up by a mechanic, not pushed to one.
    assert.match(await jobText(page), /Shared queue/);
    await role(page, "Mechanic");
    await openJob(page, "Rowan Fox");
    await press(page, "Take this job");
    const taken = await jobText(page);
    assert.doesNotMatch(taken, /Shared queue/);
    assert.match(taken, /picked up the job from the shared queue/);
    await shot(page, "flow-06-queue-pickup");
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// P-07: advance permission, cumulative limit, and excess needing explicit consent
test("a spending limit authorises work cumulatively and stops at the limit", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    await sendRequest(page, {
      name: "Ada Quinn",
      bike: "Brompton C Line",
      service: "Routine service",
      problem: "Please service it and fix anything cheap that needs doing.",
      limit: 100,
    });
    await press(page, "Receive bike");
    // Routine service is £65; the £100 limit leaves £35 of headroom.
    await shareInspection(page, {
      note: "Cables are frayed and the chain is worn past the wear marker.",
      items: [
        { name: "New gear cables", amount: "20.00" },
        { name: "New chain", amount: "30.00" },
      ],
    });
    const shop = await jobText(page);
    assert.match(shop, /Authorised within your spending limit/);
    assert.match(shop, /Your approval is needed/);
    await shot(page, "flow-07-limit-split");

    await press(page, "Open customer view");
    const seen = await jobText(page);
    // First item fits the remaining £35; the second exceeds it and waits.
    assert.match(seen, /New gear cables[\s\S]*Authorised within your spending limit/);
    assert.match(seen, /New chain[\s\S]*Your approval is needed/);
    assert.match(seen, /up to £100\.00/);
    assert.match(seen, /£85\.00/);
    assert.equal(await page.getByRole("button", { name: "Approve New chain" }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "Approve New gear cables" }).count(), 0);
    await press(page, "Approve New chain");
    assert.match(await jobText(page), /£115\.00/);
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// P-06 continued: a replaced proposal must not silently inherit or lose consent
test("a new proposal keeps settled lines and replaces only the undecided one", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    await openJob(page, "Priya Shah");
    await shareInspection(page, {
      note: "Pads and cables need attention.",
      items: [
        { name: "Replace front brake pads", amount: "28.00" },
        { name: "Adjust gears", amount: "18.00" },
      ],
    });
    await press(page, "Open customer view");
    await press(page, "Approve Replace front brake pads");
    await role(page, "Shop");
    await openJob(page, "Priya Shah");
    await shareInspection(page, {
      revise: true,
      note: "Second look: the rear pads are worn too.",
      items: [{ name: "Replace rear brake pads", amount: "31.00" }],
    });
    const after = await jobText(page);
    assert.match(after, /Replace front brake pads[\s\S]*Approved by customer/);
    assert.match(after, /£28\.00/, "the approved amount must be preserved exactly");
    assert.doesNotMatch(after, /Adjust gears/, "an undecided line is replaced by the new version");
    assert.match(after, /Replace rear brake pads[\s\S]*Your approval is needed/);
    await shot(page, "flow-08-reproposal");
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// P-10: parts hold, revised estimate, fast-forward, explicit resumption
test("a parts hold revises the estimate and only the shop resumes the work", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    await openJob(page, "Morgan Ellis");
    assert.equal(await page.getByRole("button", { name: "Resume work" }).isDisabled(), true);
    await role(page, "Customer");
    await page.getByLabel("Demo customer").selectOption({ label: "Morgan Ellis · Brompton C Line" });
    assert.match(await jobText(page), /Estimated completion/);
    await role(page, "Shop");
    await openJob(page, "Morgan Ellis");
    await press(page, "+1 day");
    await page.getByRole("button", { name: "Resume work" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Resume work" }).isDisabled(), false);
    await shot(page, "flow-09-part-arrived");
    // Time passing does not finish the repair on its own.
    assert.equal(await page.getByRole("button", { name: "Finish work" }).count(), 0);
    await press(page, "Resume work");
    await page.getByRole("button", { name: "Finish work" }).waitFor();

    // A fresh hold with a revised completion date reaches the customer.
    await press(page, "Waiting for parts");
    const d = await dialog(page, "Waiting for a part");
    await d.getByLabel("What are we waiting for?").fill("A replacement rear derailleur");
    await d.getByLabel("Part arrives in (demo hours)").fill("6");
    await d.getByRole("button", { name: /Save|Update|Confirm|Hold/ }).first().click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.match(await jobText(page), /replacement rear derailleur/);
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});
