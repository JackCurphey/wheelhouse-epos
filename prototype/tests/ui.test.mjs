import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  getByRole,
  getByLabelText,
  getAllByRole,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/dom";

async function app() {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><body><div id="root"></div></body></html>',
    {
      url: "http://localhost:4173/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const win = dom.window;
  win.structuredClone = structuredClone;
  win.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  win.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  win.URL.createObjectURL = () =>
    `blob:http://localhost/${crypto.randomUUID()}`;
  win.URL.revokeObjectURL = () => {};
  const errors = [];
  win.addEventListener("error", (e) => errors.push(e.message));
  const file = readdirSync(new URL("../dist/assets/", import.meta.url)).find(
    (f) => f.endsWith(".js"),
  );
  let code = readFileSync(
    new URL(`../dist/assets/${file}`, import.meta.url),
    "utf8",
  );
  // Bundle is a self-contained module; its empty export marker is irrelevant to this DOM harness.
  code = code.replace(/export\s*\{[^}]*\};?\s*$/, "");
  win.eval(code);
  const body = win.document.body;
  const button = (name) => getByRole(body, "button", { name, exact: true });
  const click = async (name) => {
    fireEvent.click(button(name));
    await settle();
  };
  const fill = (label, value) =>
    fireEvent.input(getByLabelText(body, label, { exact: true }), {
      target: { value },
    });
  const select = (label, value) =>
    fireEvent.change(getByLabelText(body, label, { exact: true }), {
      target: { value },
    });
  await waitFor(
    () =>
      assert.ok(
        getByRole(body, "heading", { name: "A good day for a better ride." }),
      ),
    { container: body },
  );
  return { dom, win, body, button, click, fill, select, errors };
}
const settle = () => new Promise((r) => setTimeout(r, 25));

// Runs the actual production React bundle against a DOM. Layout and media playback
// still need real-browser checking; dialog open/close is polyfilled in this harness.
test("interactive request → inspection → item approval → messages → work → collection", async () => {
  const a = await app();
  const { dom, body, click, fill, select, button, errors } = a;
  try {
    await click("New service request");
    fill("Your name", "Jamie Test");
    fill("Your bike", "Brompton C Line");
    fill("Tell us about the problem", "The brakes are noisy.");
    select("What can we help with?", "Routine service");
    await click("Send service request");
    assert.ok(
      getByRole(body, "heading", { name: "Brompton C Line", exact: true }),
    );
    await click("Receive bike");
    await click("Share inspection");
    await click("Use sample inspection video");
    await click("Share inspection and estimate");
    assert.equal(button("Start authorised work").disabled, true);
    await click("Open customer view");
    assert.ok(getByRole(body, "heading", { name: "See what we found" }));
    await click("Approve Replace front brake pads");
    await click("Decline Adjust gears and cable tension");
    await click("Decline Replace worn handlebar tape");
    assert.match(body.textContent, /£93\.00/);
    fireEvent.click(getByLabelText(body, "Email", { exact: true }));
    await settle();
    fireEvent.click(getByLabelText(body, "SMS", { exact: true }));
    await settle();
    fill("Your message", "Can I collect this afternoon?");
    await click("Send message");
    assert.match(body.textContent, /Can I collect this afternoon/);
    await click("Shop");
    const card = getAllByRole(body, "button").find(
      (el) =>
        el.classList.contains("job-card") &&
        el.textContent.includes("Jamie Test"),
    );
    fireEvent.click(card);
    await settle();
    assert.match(body.textContent, /Can I collect this afternoon/);
    fill("Your message", "Yes, we will let you know when it is ready.");
    await click("Send message");
    await click("Start authorised work");
    await click("Finish work");
    assert.match(body.textContent, /Prototype stub/);
    assert.ok(button("Mark ready for collection"));
    await click("Mark ready for collection");
    await click("Record collection");
    assert.match(body.textContent, /Back on the road/);
    await click("Demo inbox");
    for (const c of ["Email", "SMS", "WhatsApp"])
      assert.ok(body.querySelector(`.channel-${c}`));
    fireEvent.click(getAllByRole(body, "link", { name: "View your bike" })[0]);
    await settle();
    assert.ok(getByRole(body, "heading", { name: /your bike is in the loop/ }));
    assert.match(body.textContent, /Collected/);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("shop settings change actual requests, media attaches, and scenario reset restores a saved baseline", async () => {
  const { dom, body, click, fill, select, errors } = await app();
  try {
    await click("Shop settings");
    fireEvent.click(getByLabelText(body, /Day-based drop-offs/));
    await settle();
    fireEvent.click(getByLabelText(body, /After shop review/));
    await settle();
    fireEvent.click(getByLabelText(body, /Shared queue/));
    await settle();
    await click("Workshop");
    await click("New service request");
    fill("Your name", "River Test");
    fill("Your bike", "Test city bike");
    fill("Tell us about the problem", "A noisy chain.");
    const file = new dom.window.File(["sample"], "bike.png", {
      type: "image/png",
    });
    fireEvent.change(
      getByLabelText(body, "Or choose photos or video", { exact: true }),
      { target: { files: [file] } },
    );
    await settle();
    assert.ok(getByRole(body, "img", { name: "bike.png" }));
    assert.equal(body.querySelector("input[type=time]"), null);
    await click("Send service request");
    assert.match(body.textContent, /Needs review/);
    assert.match(body.textContent, /Shared queue/);
    await click("Scenarios");
    await click("Create a scenario");
    fill("Scenario name", "Our test workshop");
    await click("Save scenario");
    const card = getAllByRole(body, "article").find((el) =>
      el.textContent.includes("Our test workshop"),
    );
    assert.ok(card);
    fireEvent.click(
      within(card).getByRole("button", { name: "Start this scenario" }),
    );
    await settle();
    await click("+1 day");
    await click("Reset scenario");
    fireEvent.click(
      within(getByRole(body, "dialog")).getByRole("button", {
        name: "Reset scenario",
      }),
    );
    await settle();
    assert.match(body.textContent, /Tue 8 Sept/);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("parts scenario pauses, advances, resumes, and resets without stale arrival state", async () => {
  const { dom, body, click, button, errors } = await app();
  try {
    await click("Scenarios");
    const card = getAllByRole(body, "article").find((el) =>
      el.textContent.includes("03 · Waiting for a part"),
    );
    fireEvent.click(
      within(card).getByRole("button", { name: "Start this scenario" }),
    );
    await settle();
    fireEvent.click(body.querySelector(".job-card"));
    await settle();
    assert.equal(button("Resume work").disabled, true);
    await click("Run clock");
    assert.ok(button("Pause"));
    await click("Pause");
    await click("+1 day");
    assert.equal(button("Resume work").disabled, false);
    await click("Resume work");
    assert.ok(button("Finish work"));
    await click("Reset scenario");
    fireEvent.click(
      within(getByRole(body, "dialog")).getByRole("button", {
        name: "Reset scenario",
      }),
    );
    await settle();
    fireEvent.click(body.querySelector(".job-card"));
    await settle();
    assert.equal(button("Resume work").disabled, true);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
