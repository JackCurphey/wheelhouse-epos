import test from "node:test";
import assert from "node:assert/strict";
import {
  startServer,
  launch,
  openApp,
  shot,
  overflow,
  unreachableControls,
  unlabelledControls,
  VIEWPORTS,
} from "./harness.mjs";

// Screens a participant actually uses, in the roles they use them in.
const SCREENS = [
  { name: "workshop", open: async () => {} },
  {
    name: "request",
    open: async (page) => {
      await page.getByRole("button", { name: "New service request", exact: true }).click();
      await page.getByLabel("Your name").waitFor();
    },
  },
  {
    name: "job-detail",
    open: async (page) => {
      await page.locator(".job-card", { hasText: "Priya Shah" }).click();
      await page.getByRole("button", { name: "Share inspection" }).waitFor();
    },
  },
  {
    name: "inspection-dialog",
    open: async (page) => {
      await page.locator(".job-card", { hasText: "Priya Shah" }).click();
      await page.getByRole("button", { name: "Share inspection" }).click();
      await page.getByRole("button", { name: "Use sample inspection video" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    name: "schedule",
    open: async (page) => {
      await page.getByRole("button", { name: "Schedule", exact: true }).click();
    },
  },
  {
    name: "settings",
    open: async (page) => {
      await page.getByRole("button", { name: "Shop settings", exact: true }).click();
    },
  },
  {
    name: "scenarios",
    open: async (page) => {
      await page.getByRole("button", { name: "Scenarios", exact: true }).click();
    },
  },
  {
    name: "inbox",
    open: async (page) => {
      await page.getByRole("button", { name: "Demo inbox", exact: true }).click();
    },
  },
  {
    name: "customer",
    open: async (page) => {
      await page.getByRole("button", { name: "Customer", exact: true }).click();
      await page.getByRole("heading", { name: /your bike is in the loop/i }).waitFor();
    },
  },
];

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

for (const viewport of VIEWPORTS) {
  test(`layout at ${viewport.width}px has no overflow, clipping, or unlabelled controls`, async () => {
    const failures = [];
    for (const screen of SCREENS) {
      const { page, context, problems } = await openApp(browser, server.origin, viewport);
      try {
        await screen.open(page);
        await page.waitForTimeout(120);
        const file = await shot(page, `${viewport.name}-${screen.name}`);
        const flow = await overflow(page);
        const controls = await unreachableControls(page);
        const labels = await unlabelledControls(page);
        const where = `${viewport.width}px/${screen.name}`;
        if (flow.scroll > 1)
          failures.push(`${where}: horizontal scroll ${flow.scroll}px (${flow.wide.join("; ")}) ${file}`);
        if (flow.wide.length)
          failures.push(`${where}: elements outside viewport ${flow.wide.join("; ")} ${file}`);
        if (controls.length) failures.push(`${where}: ${controls.join("; ")} ${file}`);
        if (labels.length) failures.push(`${where}: unlabelled ${labels.join("; ")} ${file}`);
        if (problems.length) failures.push(`${where}: console ${problems.join("; ")}`);
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(failures, [], failures.join("\n"));
  });
}

test("keyboard alone reaches navigation, roles, and the request form", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, VIEWPORTS[3]);
  try {
    const reachable = async (label) => {
      await page.keyboard.press("Tab");
      return page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          name: (el?.getAttribute("aria-label") || el?.textContent || "").trim().slice(0, 40),
          visibleFocus: (() => {
            const s = el ? getComputedStyle(el) : null;
            return !!s && (s.outlineStyle !== "none" || s.boxShadow !== "none");
          })(),
        };
      });
    };
    const seen = [];
    for (let i = 0; i < 40; i += 1) seen.push(await reachable());
    const names = seen.map((s) => s.name);
    for (const expected of ["Workshop", "Demo inbox", "Scenarios", "New service request"])
      assert.ok(
        names.some((n) => n.includes(expected)),
        `Tab order never reached ${expected}: ${JSON.stringify(names)}`,
      );
    assert.ok(
      seen.filter((s) => s.tag === "BUTTON").every((s) => s.visibleFocus),
      "a focused button had no visible focus indicator",
    );

    // Opening a dialog must move focus into it and Escape must close it.
    await page.getByRole("button", { name: "New service request", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const inside = await page.evaluate(() =>
      document.querySelector("dialog[open]")?.contains(document.activeElement),
    );
    assert.ok(inside, "focus stayed outside the opened dialog");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// A label that spills out of its own button collides with the next one; at
// tablet width the labels are hidden entirely, so the icons need a hover name.
test("navigation labels stay inside their buttons at every width", async () => {
  const failures = [];
  for (const viewport of VIEWPORTS) {
    const { page, context } = await openApp(browser, server.origin, viewport);
    try {
      const items = await page.$$eval("nav .nav-item", (els) =>
        els.map((el) => {
          const label = el.querySelector("span:not(.nav-count)");
          const box = el.getBoundingClientRect();
          const text = label ? label.getBoundingClientRect() : null;
          return {
            name: el.getAttribute("aria-label"),
            box: { left: box.left, right: box.right },
            text:
              text && text.width > 0
                ? { left: text.left, right: text.right, top: text.top, bottom: text.bottom }
                : null,
            title: el.getAttribute("title"),
            hidden: !text || getComputedStyle(label).display === "none",
          };
        }),
      );
      for (const item of items) {
        if (item.text) {
          if (item.text.left < item.box.left - 0.5 || item.text.right > item.box.right + 0.5)
            failures.push(
              `${viewport.width}px: "${item.name}" label spills outside its button (${Math.round(item.text.left)}-${Math.round(item.text.right)} vs ${Math.round(item.box.left)}-${Math.round(item.box.right)})`,
            );
        } else if (!item.title) {
          failures.push(
            `${viewport.width}px: "${item.name}" shows only an icon and has no title for a pointer user`,
          );
        }
      }
      for (let i = 1; i < items.length; i += 1) {
        const a = items[i - 1].text;
        const b = items[i].text;
        // Only labels sharing a row can collide; a stacked sidebar does not.
        const sameRow = a && b && b.top < a.bottom - 0.5 && a.top < b.bottom - 0.5;
        if (sameRow && b.left < a.right - 0.5)
          failures.push(
            `${viewport.width}px: "${items[i - 1].name}" and "${items[i].name}" labels overlap`,
          );
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});
