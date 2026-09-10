// Shared page actions for the browser workflow checks. Selectors use the same
// accessible names a participant sees, so a rename that breaks a screen reader
// breaks these checks too.
export const nav = (page, label) =>
  page.getByRole("button", { name: label, exact: true }).click();

export const role = (page, name) =>
  page.getByRole("button", { name, exact: true }).click();

export const press = (page, name) =>
  page.getByRole("button", { name, exact: true }).click();

export const card = (page, text) => page.locator(".job-card", { hasText: text });

export async function openJob(page, text) {
  await card(page, text).click();
  await page.getByRole("button", { name: "Back to workshop" }).waitFor();
}

export async function dialog(page, title) {
  const d = page.getByRole("dialog");
  await d.waitFor();
  if (title) await d.getByRole("heading", { name: title }).waitFor();
  return d;
}

// Fills the guest request form. `files` are absolute paths attached through the
// real file input, which is the same control a phone uses for camera capture.
export async function sendRequest(page, { name, bike, service, problem, files, limit, time }) {
  await press(page, "New service request");
  const d = await dialog(page, "Request work on a bike");
  await d.getByLabel("Your name").fill(name);
  await d.getByLabel("Your bike").fill(bike);
  if (service) await d.getByLabel("What can we help with?").selectOption(service);
  await d.getByLabel("Tell us about the problem").fill(problem);
  if (files?.length)
    await d.getByLabel("Or choose photos or video").setInputFiles(files);
  if (time) await d.getByLabel("Appointment time").fill(time);
  if (limit != null) {
    await d.getByLabel("Authorise work within a total spending limit").check();
    await d.getByLabel("Total spending limit (£)").fill(String(limit));
  }
  await d.getByRole("button", { name: "Send service request" }).click();
}

// Mechanic-side inspection: attaches the seeded sample clip and proposes items.
export async function shareInspection(page, { note, items, revise = false }) {
  await press(page, revise ? "Add or revise proposal" : "Share inspection");
  const d = await dialog(page, "Share an inspection");
  if (note) await d.getByLabel("Explain what you found").fill(note);
  await d.getByRole("button", { name: "Use sample inspection video" }).click();
  for (const [i, item] of items.entries()) {
    if (i >= 3) await d.getByRole("button", { name: "Add another item" }).click();
    await d.getByLabel(`Item ${i + 1}`, { exact: true }).fill(item.name);
    await d.getByLabel("Estimate (£)").nth(i).fill(String(item.amount));
  }
  // Remove any seeded rows the caller did not overwrite.
  for (let i = (await d.getByRole("button", { name: /^Remove item/ }).count()); i > items.length; i -= 1)
    await d.getByRole("button", { name: `Remove item ${i}` }).click();
  await d.getByRole("button", { name: "Share inspection and estimate" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}

export async function setSetting(page, label) {
  await nav(page, "Shop settings");
  await page.getByLabel(label).check();
}

export const jobText = (page) => page.locator("main").innerText();
