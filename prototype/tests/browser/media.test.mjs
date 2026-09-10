import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { startServer, launch, openApp, shot, VIEWPORTS } from "./harness.mjs";
import { press, openJob, dialog, sendRequest } from "./actions.mjs";

const PHOTO = fileURLToPath(new URL("./fixtures/rider-photo.png", import.meta.url));
const SAMPLE = fileURLToPath(new URL("../../public/media/inspection.mp4", import.meta.url));
const PHONE = VIEWPORTS[1];
const DESK = VIEWPORTS[3];

let server;
let browser;
let channel;
test.before(async () => {
  server = await startServer();
  ({ browser, channel } = await launch());
});
test.after(async () => {
  await browser?.close();
  await server?.close();
});

// Playback needs a codec, a decoder and a real media element; JSDOM cannot
// establish any of them. Chrome ships H.264; a bare Chromium build may not, so
// an unsupported codec is reported rather than silently passed.
test("the seeded inspection clip actually decodes and plays", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, DESK);
  try {
    await openJob(page, "Priya Shah");
    await press(page, "Share inspection");
    const d = await dialog(page, "Share an inspection");
    await d.getByRole("button", { name: "Use sample inspection video" }).click();
    await d.getByRole("button", { name: "Share inspection and estimate" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    const video = page.locator("main video").first();
    await video.waitFor();
    const support = await video.evaluate((el) =>
      el.canPlayType("video/mp4; codecs=\"avc1.42E01E\""),
    );
    assert.notEqual(support, "", `this browser (${channel}) cannot decode H.264 MP4`);

    const played = await video.evaluate(async (el) => {
      el.muted = true;
      await new Promise((resolve, reject) => {
        if (el.readyState >= 2) return resolve();
        el.addEventListener("loadeddata", resolve, { once: true });
        el.addEventListener("error", () => reject(new Error("media error")), { once: true });
        setTimeout(() => reject(new Error("metadata timeout")), 8000);
      });
      const start = el.currentTime;
      await el.play();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const moved = el.currentTime;
      el.pause();
      return {
        duration: el.duration,
        width: el.videoWidth,
        height: el.videoHeight,
        advanced: moved - start,
        tracks: el.textTracks.length,
        poster: !!el.getAttribute("poster"),
      };
    });
    assert.ok(played.duration > 5, `unexpected duration ${played.duration}`);
    assert.equal(played.width, 1280);
    assert.equal(played.height, 720);
    assert.ok(played.advanced > 0.3, `playback did not advance (${played.advanced}s)`);
    assert.equal(played.tracks, 1, "the sample clip should carry its captions track");
    assert.ok(played.poster, "the sample clip should have a poster frame");
    await shot(page, "media-01-sample-playing");
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// The mechanic's own recording is the real phone path; the same file input is
// what a phone camera writes into.
test("a mechanic's uploaded video plays and a rider's photo renders", async () => {
  const { page, context, problems } = await openApp(browser, server.origin, PHONE);
  try {
    await sendRequest(page, {
      name: "Sam Upload",
      bike: "Brompton C Line",
      service: "Routine service",
      problem: "Here is a photo of the worn tyre.",
      files: [PHOTO],
    });
    const photo = page.locator("main img[alt='rider-photo.png']").first();
    await photo.waitFor();
    const rendered = await photo.evaluate((el) => ({
      w: el.naturalWidth,
      h: el.naturalHeight,
    }));
    assert.deepEqual(rendered, { w: 64, h: 64 }, "the rider's photo did not decode");

    await press(page, "Receive bike");
    await press(page, "Share inspection");
    const d = await dialog(page, "Share an inspection");
    await d.getByLabel("Explain what you found").fill("Walk-around recorded on the phone.");
    await d.getByLabel("Or choose a video file").setInputFiles(SAMPLE);
    await d.getByLabel("Item 1", { exact: true }).fill("New tyre");
    await d.getByLabel("Estimate (£)").first().fill("34.00");
    for (let i = 3; i > 1; i -= 1)
      await d.getByRole("button", { name: `Remove item ${i}` }).click();
    await d.getByRole("button", { name: "Share inspection and estimate" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    await press(page, "Open customer view");
    const video = page.locator("main video").first();
    await video.waitFor();
    const played = await video.evaluate(async (el) => {
      el.muted = true;
      await new Promise((resolve, reject) => {
        if (el.readyState >= 2) return resolve();
        el.addEventListener("loadeddata", resolve, { once: true });
        el.addEventListener("error", () => reject(new Error("media error")), { once: true });
        setTimeout(() => reject(new Error("metadata timeout")), 8000);
      });
      await el.play();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const t = el.currentTime;
      el.pause();
      return { t, src: el.currentSrc.slice(0, 5), controls: el.controls, inline: el.playsInline };
    });
    assert.ok(played.t > 0.2, `an uploaded video did not play (${played.t}s)`);
    assert.equal(played.src, "blob:", "uploaded media should stay in the browser as a blob URL");
    assert.equal(played.controls, true);
    assert.equal(played.inline, true, "phone playback needs playsinline");
    await shot(page, "media-02-uploaded-video");
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// The file input is the camera path on a phone. Emulation cannot open a real
// camera, so this asserts the attributes a phone browser acts on.
test("media inputs offer both a camera capture and a file choice", async () => {
  const { page, context } = await openApp(browser, server.origin, PHONE);
  try {
    await press(page, "New service request");
    const d = await dialog(page, "Request work on a bike");
    const inputs = d.locator("input[type=file]");
    const described = await inputs.evaluateAll((els) =>
      els.map((el) => ({
        accept: el.getAttribute("accept"),
        capture: el.getAttribute("capture"),
      })),
    );
    assert.ok(described.length >= 1, "the request form has no media input");
    assert.ok(
      described.some((i) => i.capture),
      "no input asks a phone for the camera",
    );
    assert.ok(
      described.some((i) => !i.capture),
      "every media input forces the camera, so an existing photo cannot be attached",
    );
    for (const input of described)
      assert.match(input.accept, /image|video/, "media input accepts anything");
  } finally {
    await context.close();
  }
});
