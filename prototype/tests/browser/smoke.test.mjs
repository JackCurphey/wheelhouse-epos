import test from "node:test";
import assert from "node:assert/strict";
import { startServer, launch, openApp, shot, overflow } from "./harness.mjs";

test("boots in a real browser with no console errors", async () => {
  const server = await startServer();
  const { browser, channel } = await launch();
  try {
    const { page, problems, context } = await openApp(browser, server.origin);
    console.log("browser:", channel, await browser.version());
    const file = await shot(page, "smoke-1440");
    console.log("screenshot:", file);
    console.log("overflow:", JSON.stringify(await overflow(page)));
    console.log("problems:", JSON.stringify(problems));
    assert.deepEqual(problems, []);
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
});
