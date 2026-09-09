// Real-browser harness: serves the production bundle from prototype/dist on an
// ephemeral port and drives it with Playwright. Unlike tests/ui.test.mjs (JSDOM)
// this exercises actual layout, focus, and media decoding.
import { createServer } from "node:http";
import { readFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));
const browsersDir = fileURLToPath(
  new URL("../../.playwright-browsers/", import.meta.url),
);
export const evidenceDir = fileURLToPath(
  new URL("../../../.prototype-overnight/browser/", import.meta.url),
);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".vtt": "text/vtt; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

// Static server over the built bundle. Deliberately independent of the demo
// `vite preview` on 4173 so running the checks never touches a live demo.
export async function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    let file = path.resolve(distDir, rel || ".");
    const inside = path.relative(distDir, file);
    if (inside.startsWith("..") || path.isAbsolute(inside)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    let info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) {
      // Single-page app: unknown paths (progress links) fall back to index.html.
      file = path.join(distDir, "index.html");
      info = await stat(file).catch(() => null);
      if (!info) {
        res.writeHead(404).end("not built");
        return;
      }
    }
    const body = await readFile(file);
    const headers = {
      "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
      "content-length": body.length,
      "cache-control": "no-store",
    };
    if (req.method === "HEAD") {
      res.writeHead(200, headers).end();
      return;
    }
    // Range support so <video> can seek and decode.
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Number(m[2]) : body.length - 1;
        res
          .writeHead(206, {
            ...headers,
            "content-length": end - start + 1,
            "content-range": `bytes ${start}-${end}/${body.length}`,
            "accept-ranges": "bytes",
          })
          .end(body.subarray(start, end + 1));
        return;
      }
    }
    res.writeHead(200, { ...headers, "accept-ranges": "bytes" }).end(body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((r) => server.close(r));
    },
  };
}

let chromiumPromise;
async function chromium() {
  if (!chromiumPromise) {
    // Set before importing Playwright: keeps browser downloads inside the
    // prototype instead of the shared machine cache.
    process.env.PLAYWRIGHT_BROWSERS_PATH ??= browsersDir;
    chromiumPromise = import("playwright").then((m) => m.chromium);
  }
  return chromiumPromise;
}

// Prefers the pinned Playwright build; falls back to an installed Google Chrome
// so a machine without the download can still run the checks.
export async function launch() {
  const engine = await chromium();
  const attempts = [{}, { channel: "chrome" }];
  let last;
  for (const options of attempts) {
    try {
      const browser = await engine.launch(options);
      return { browser, channel: options.channel ?? "playwright-chromium" };
    } catch (error) {
      last = error;
    }
  }
  throw new Error(
    `No browser could be launched. Run "npm --prefix prototype run test:browser:install".\n${last?.message}`,
  );
}

export const VIEWPORTS = [
  { name: "320", width: 320, height: 720, phone: true },
  { name: "390", width: 390, height: 844, phone: true },
  { name: "768", width: 768, height: 1024, phone: false },
  { name: "1440", width: 1440, height: 900, phone: false },
];

// One page with console/pageerror capture and the demo already booted.
export async function openApp(browser, origin, viewport = VIEWPORTS[3], extra = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: viewport.phone,
    ...extra,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const problems = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning")
      problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (req) => {
    // Browsers routinely abort media range requests once they have enough data,
    // and closing a page cancels in-flight ones. Playback is asserted directly
    // in media.test.mjs instead of inferred from network noise.
    const aborted = req.failure()?.errorText === "net::ERR_ABORTED";
    if (aborted && req.resourceType() === "media") return;
    problems.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`);
  });
  await page.goto(`${origin}/`, { waitUntil: "load" });
  await page.getByRole("heading", { name: "A good day for a better ride." }).waitFor();
  return { context, page, problems };
}

export async function shot(page, name) {
  await mkdir(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

// Any element wider than the viewport, or the document scrolling sideways, is a
// responsive defect on a prototype meant to be usable on a phone.
export async function overflow(page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scroll =
      document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const wide = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.overflowX === "auto" || style.overflowX === "scroll") continue;
      if (r.right > docWidth + 1 || r.left < -1) {
        wide.push(
          `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} left=${Math.round(r.left)} right=${Math.round(r.right)}`,
        );
      }
    }
    return { scroll, wide: [...new Set(wide)].slice(0, 12), docWidth };
  });
}

// Controls a participant is expected to press must be reachable and big enough
// to tap; a clipped or zero-size control is a failure a screenshot can hide.
export async function unreachableControls(page) {
  return page.evaluate(() => {
    const bad = [];
    const docWidth = document.documentElement.clientWidth;
    for (const el of document.querySelectorAll(
      "main button, main a[href], main input, main select, main textarea, nav button, .rolebar button, .simbar button",
    )) {
      if (el.disabled) continue;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (r.width < 1 || r.height < 1) continue;
      // A checkbox or radio is tapped through its label, so the label is the
      // real target area.
      const target =
        (el.type === "checkbox" || el.type === "radio") && el.closest("label")
          ? el.closest("label").getBoundingClientRect()
          : r;
      if (r.right > docWidth + 1)
        bad.push(`clipped: ${el.tagName}[${el.textContent?.trim().slice(0, 30)}] right=${Math.round(r.right)}/${docWidth}`);
      else if (target.height < 24 || target.width < 24)
        bad.push(`tiny: ${el.tagName}[${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}] ${Math.round(target.width)}x${Math.round(target.height)}`);
    }
    return [...new Set(bad)];
  });
}

// Every interactive control needs a name a screen reader can announce.
export async function unlabelledControls(page) {
  return page.evaluate(() => {
    const name = (el) => {
      const aria = el.getAttribute("aria-label");
      if (aria?.trim()) return aria.trim();
      const id = el.getAttribute("aria-labelledby");
      if (id && document.getElementById(id)?.textContent?.trim()) return "labelledby";
      if (el.textContent?.trim()) return el.textContent.trim();
      if (el.id && document.querySelector(`label[for="${el.id}"]`)) return "label";
      if (el.closest("label")) return "wrapping label";
      if (el.title?.trim()) return el.title.trim();
      return "";
    };
    const bad = [];
    for (const el of document.querySelectorAll(
      "button, a[href], input:not([type=hidden]), select, textarea",
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (!name(el))
        bad.push(`${el.tagName.toLowerCase()}${el.className ? "." + el.className.toString().split(" ")[0] : ""}`);
    }
    return [...new Set(bad)];
  });
}
