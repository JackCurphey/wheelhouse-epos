// Downloads the pinned Chromium into prototype/.playwright-browsers so the
// browser checks never depend on — or write to — the shared machine cache.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../../.playwright-browsers/", import.meta.url));
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", "install", "chromium"],
  { stdio: "inherit", env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: dir } },
);
process.exit(result.status ?? 1);
