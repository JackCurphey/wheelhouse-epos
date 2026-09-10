import test from "node:test";
import assert from "node:assert/strict";
import { startServer, launch, openApp, shot, VIEWPORTS } from "./harness.mjs";
import { nav, role, press, card, openJob, dialog, sendRequest, jobText } from "./actions.mjs";

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

// P-08: the same workshop events reach the demo inbox on the channels the
// customer chose, and nothing leaves the browser.
test("notification preferences change channels without changing the job history", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    const sent = [];
    await page.route("**/*", (routeReq) => {
      const url = routeReq.request().url();
      if (!url.startsWith(server.origin)) sent.push(url);
      return routeReq.continue();
    });

    await role(page, "Customer");
    await page.getByLabel("Demo customer").selectOption({ label: "Taylor Reed · Brompton C Line" });
    // Default channel is WhatsApp only; add Email and SMS.
    await page.getByLabel("Email", { exact: true }).check();
    await page.getByLabel("SMS", { exact: true }).check();
    // "Work progress" is off by default; a customer can opt into it.
    const progress = page.getByLabel("Work progress", { exact: true });
    assert.equal(await progress.isChecked(), false);
    await progress.check();
    await page.getByLabel("Your message").fill("Any news this morning?");
    await press(page, "Send message");

    await role(page, "Shop");
    await openJob(page, "Taylor Reed");
    await page.getByLabel("Your message").fill("All on track for this afternoon.");
    await press(page, "Send message");

    await nav(page, "Demo inbox");
    await shot(page, "sim-01-inbox");
    const inbox = await jobText(page);
    for (const channel of ["WhatsApp", "Email", "SMS"])
      assert.equal(
        await page.locator(`.channel-${channel}`).count() > 0,
        true,
        `no ${channel} message was simulated: ${inbox.slice(0, 400)}`,
      );
    assert.match(inbox, /All on track for this afternoon/);

    // Turning every channel off must stop deliveries but keep the conversation.
    await role(page, "Customer");
    await page.getByLabel("Demo customer").selectOption({ label: "Taylor Reed · Brompton C Line" });
    for (const channel of ["WhatsApp", "Email", "SMS"])
      await page.getByLabel(channel, { exact: true }).uncheck();
    assert.match(await jobText(page), /Updates are off/);
    await role(page, "Shop");
    await openJob(page, "Taylor Reed");
    const before = await page.locator(".notification, .inbox-item, article").count();
    await page.getByLabel("Your message").fill("Second update with updates off.");
    await press(page, "Send message");
    assert.match(await jobText(page), /Second update with updates off/);
    await nav(page, "Demo inbox");
    assert.doesNotMatch(await jobText(page), /Second update with updates off/);

    assert.deepEqual(sent, [], "the prototype must not talk to any external service");
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// P-01 and P-12: scenarios are editable, resettable, and a reset leaves no
// stale job, message, or progress link behind.
test("saving, starting, and resetting a scenario leaves no stale state or link", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    // P-01: edit the default scenario's operating settings, then save it as Jack's own.
    await nav(page, "Shop settings");
    await page.getByLabel(/Day-based drop-offs/).check();
    await page.getByLabel(/Shared queue/).check();
    await nav(page, "Workshop");
    await sendRequest(page, {
      name: "Nadia Brooks",
      bike: "Brompton C Line",
      service: "Routine service",
      problem: "Gears need adjusting before a tour.",
    });

    // Capture this run's progress link before saving and resetting.
    await role(page, "Customer");
    await page.getByLabel("Demo customer").selectOption({ label: "Nadia Brooks · Brompton C Line" });
    const link = await page.getByRole("link", { name: "Open progress link" }).getAttribute("href");
    assert.match(link, /^#track=/);
    await page.getByLabel("Your message").fill("A message from the first run.");
    await press(page, "Send message");

    await role(page, "Shop");
    await nav(page, "Scenarios");
    await press(page, "Create a scenario");
    const d = await dialog(page, "Make this scenario yours");
    await d.getByLabel("Scenario name").fill("Jack's drop-off day");
    await d.getByLabel("What should this scenario explore?").fill("Drop-offs with a shared queue.");
    await d.getByRole("button", { name: "Save scenario" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await shot(page, "sim-02-scenarios");
    const saved = page.locator("article", { hasText: "Jack's drop-off day" });
    await saved.waitFor();

    await saved.getByRole("button", { name: /Start this scenario/ }).click();
    assert.match(await jobText(page), /Nadia Brooks/);

    // Move the run on, then reset it.
    await press(page, "+1 day");
    await openJob(page, "Nadia Brooks");
    await press(page, "Reset scenario");
    const reset = await dialog(page, "Reset this scenario?");
    await reset.getByRole("button", { name: "Reset scenario" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    // Clock, jobs, and simulated messages return to the saved starting point.
    assert.match(await page.locator(".simbar, header").first().innerText(), /Tue 8 Sept/);
    await nav(page, "Demo inbox");
    assert.doesNotMatch(await jobText(page), /A message from the first run/);

    // P-12: a progress link from the previous run must not open the new run's
    // job. Checked inside the live session, where the old token could still
    // have matched something, rather than after a reload that clears state.
    await page.evaluate((hash) => {
      location.hash = hash;
    }, link);
    const stale = page.getByRole("alert");
    await stale.waitFor();
    assert.match(await stale.innerText(), /belongs to another run or session/);
    const afterLink = await jobText(page);
    assert.doesNotMatch(
      afterLink,
      /A message from the first run/,
      "a stale progress link exposed a previous run's conversation",
    );
    // The new run's own link still works.
    await role(page, "Customer");
    await page.getByLabel("Demo customer").selectOption({ label: "Nadia Brooks · Brompton C Line" });
    const fresh = await page.getByRole("link", { name: "Open progress link" }).getAttribute("href");
    assert.notEqual(fresh, link, "reset must rotate the progress token");
    await page.evaluate((hash) => {
      location.hash = hash;
    }, fresh);
    await page.getByRole("heading", { name: /your bike is in the loop/i }).waitFor();
    await shot(page, "sim-03-stale-link");
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// Rescheduling beyond the workshop's capacity must fail loudly and leave the
// original booking untouched.
test("a rescheduling conflict is refused and the original plan survives", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    await openJob(page, "Taylor Reed");
    const planned = await page.locator(".panel", { hasText: "On the diary" }).innerText();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const d = await dialog(page, "Plan this work");
    // 480 minutes for each of four bikes cannot fit three mechanics' days.
    await d.getByLabel("Planned work (minutes)").fill("480");
    await d.getByLabel("Assigned mechanic").selectOption("Sam");
    await d.getByLabel("Start time").fill("11:30");
    await d.getByRole("button", { name: "Save schedule" }).click();
    const error = page.getByRole("alert");
    await error.waitFor();
    await shot(page, "sim-04-conflict");
    assert.match(await error.innerText(), /\w/);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.locator(".panel", { hasText: "On the diary" }).innerText(),
      planned,
      "a refused reschedule changed the booking anyway",
    );
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// P-13: one participant can hold all three roles over the same job.
test("the same job follows a participant across all three roles", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    await openJob(page, "Priya Shah");
    const reference = (await jobText(page)).match(/SERVICE REQUEST · (\w+)/)[1];
    await role(page, "Mechanic");
    // A mechanic sees their own bench, so play the mechanic this job belongs to.
    await page.getByLabel("Demo mechanic").selectOption("Sam");
    await openJob(page, "Priya Shah");
    assert.match(await jobText(page), new RegExp(reference));
    await page.getByLabel("Your message").fill("Mechanic note for the rider.");
    await press(page, "Send message");
    await role(page, "Customer");
    await page.getByLabel("Demo customer").selectOption({ label: "Priya Shah · Trek Domane AL 2" });
    assert.match(await jobText(page), /Mechanic note for the rider/);
    await role(page, "Shop");
    await openJob(page, "Priya Shah");
    assert.match(await jobText(page), /Mechanic note for the rider/);
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// P-10 and P-12: the demo clock runs, pauses, and fast-forwards on Jack's
// command; nothing advances on its own while it is paused.
test("the clock only runs when Jack starts it", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    // The running clock is a real 5-second interval, and a browser throttles
    // timers in a page it considers hidden.
    await page.bringToFront();
    const clock = page.locator(".clock");
    // Waits for the clock to read something other than `from`, and reports
    // whether it moved rather than throwing.
    const moved = async (from, ms) => {
      try {
        await page.waitForFunction(
          (before) => document.querySelector(".clock")?.textContent !== before,
          from,
          { timeout: ms, polling: 250 },
        );
        return true;
      } catch {
        return false;
      }
    };

    const paused = await clock.innerText();
    assert.equal(await moved(paused, 7000), false, "the clock moved while paused");

    await press(page, "Run clock");
    await page.getByRole("button", { name: "Pause" }).waitFor();
    assert.equal(
      await moved(paused, 30_000),
      true,
      "Run clock did not advance the demo clock",
    );

    await press(page, "Pause");
    const stopped = await clock.innerText();
    assert.equal(await moved(stopped, 7000), false, "Pause did not stop the clock");

    // Fast-forward still works while paused.
    await press(page, "+1 hour");
    assert.notEqual(await clock.innerText(), stopped);
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});
