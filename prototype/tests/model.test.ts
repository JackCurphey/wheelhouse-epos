import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  loadScenario,
  saveScenario,
  createRequest,
  schedule,
  propose,
  decide,
  setLimit,
  advance,
  transition,
  delay,
  sendMessage,
  total,
  SERVICES,
  SAMPLE_MEDIA,
} from "../src/model.ts";

function inspect() {
  const s = initialState();
  loadScenario(s, "inspection");
  return { s, j: s.jobs[0] };
}
const extras = [
  { name: "Brake pads", amount: 2800 },
  { name: "Adjust gears", amount: 1800 },
  { name: "Bar tape", amount: 2400 },
];

test("a full job moves through work and custody without a payment dependency", () => {
  const s = initialState();
  loadScenario(s, "routine");
  const j = s.jobs[0];
  transition(s, j, "receive");
  transition(s, j, "start");
  transition(s, j, "finish");
  assert.equal(j.work, "finished");
  assert.equal(j.ready, false);
  assert.equal(j.custody, "shop");
  assert.throws(() => transition(s, j, "collect"));
  transition(s, j, "ready");
  assert.equal(j.custody, "shop");
  transition(s, j, "collect");
  assert.equal(j.custody, "collected");
  assert.throws(() => transition(s, j, "collect"));
  assert.throws(() => transition(s, j, "finish"));
});
test("approvals bind to item version, decline excludes charges, pending work blocks start", () => {
  const { s, j } = inspect();
  propose(s, j, extras, "Fictional inspection", [SAMPLE_MEDIA]);
  assert.throws(() => transition(s, j, "start"), /outstanding/);
  const [a, b, c] = j.lines;
  decide(s, j, a.id, a.version, "approved");
  decide(s, j, b.id, b.version, "declined");
  assert.throws(() => decide(s, j, a.id, a.version, "approved"), /changed/);
  assert.throws(() => decide(s, j, c.id, c.version + 1, "approved"), /changed/);
  decide(s, j, c.id, c.version, "declined");
  assert.equal(total(j), 2800);
  transition(s, j, "start");
  assert.equal(j.work, "working");
});
test("proposal replacement invalidates stale choices and preserves authorised prices", () => {
  const { s, j } = inspect();
  propose(s, j, extras, "First inspection", []);
  const [approved, stale] = j.lines;
  decide(s, j, approved.id, approved.version, "approved");
  propose(
    s,
    j,
    [{ name: "Revised gear work", amount: 2200 }],
    "New findings",
    [],
  );
  assert.throws(() => decide(s, j, stale.id, stale.version, "approved"));
  assert.equal(j.lines[0].amount, 2800);
  assert.equal(j.lines[0].decision, "approved");
  assert.equal(j.lines[1].version, 2);
});
test("advance limit includes original service and cumulative previously authorised extras", () => {
  const { s, j } = inspect();
  j.base = 6500;
  setLimit(s, j, 10000);
  propose(s, j, extras, "First inspection", []);
  assert.deepEqual(
    j.lines.map((l) => l.decision),
    ["limit", "pending", "pending"],
  );
  assert.equal(total(j), 9300);
  propose(
    s,
    j,
    [{ name: "Extra cable", amount: 800 }],
    "Second inspection",
    [],
  );
  assert.equal(j.lines[1].decision, "pending");
  assert.equal(total(j), 9300);
  assert.throws(() => setLimit(s, j, 9200));
  setLimit(s, j, 12000);
  assert.equal(j.lines[1].decision, "pending");
  setLimit(s, j, null);
  assert.equal(j.lines[0].decision, "limit");
});
test("parts arrival requires clock advance and explicit resumption; does not complete work", () => {
  const { s, j } = inspect();
  delay(s, j, "2026-09-10", 24, "Waiting for a part");
  advance(s, 1439);
  assert.equal(j.partsArrived, false);
  assert.throws(() => transition(s, j, "resume"));
  advance(s, 1);
  assert.equal(j.partsArrived, true);
  assert.equal(j.work, "parts");
  const count = j.history.length;
  advance(s, 1440);
  assert.equal(j.history.length, count);
  transition(s, j, "resume");
  assert.equal(j.work, "working");
  assert.equal(j.custody, "shop");
});
test("reset clears deliveries, old progress tokens and timer progress while retaining saved scenarios", () => {
  const s = initialState();
  loadScenario(s, "parts");
  const oldToken = s.jobs[0].token;
  advance(s, 1440);
  sendMessage(s, s.jobs[0], "shop", "Part arrived");
  assert.ok(s.notifications.length);
  loadScenario(s, "parts");
  assert.equal(s.notifications.length, 0);
  assert.equal(s.jobs[0].partsArrived, false);
  assert.notEqual(s.jobs[0].token, oldToken);
  assert.equal(s.paused, true);
  advance(s, 1440);
  assert.equal(s.jobs[0].partsArrived, true);
});
test("notifications respect event and channel preferences but preserve shared job history", () => {
  const { s, j } = inspect();
  j.preferences = { events: ["delay"], channels: ["Email", "SMS", "WhatsApp"] };
  delay(s, j, "2026-09-10", 24, "Waiting");
  assert.equal(s.notifications.length, 3);
  assert.deepEqual(
    new Set(s.notifications.map((n) => n.channel)),
    new Set(["Email", "SMS", "WhatsApp"]),
  );
  sendMessage(s, j, "shop", "Hello");
  assert.equal(s.notifications.length, 3);
  assert.equal(j.messages.length, 1);
  j.preferences.channels = [];
  delay(s, j, "2026-09-11", 48, "More waiting");
  assert.equal(s.notifications.length, 3);
  assert.match(j.history.at(-1)!.text, /More waiting/);
});
test("customer and shop messages are in one conversation, only shop messages trigger delivery", () => {
  const { s, j } = inspect();
  sendMessage(s, j, "customer", "Can I collect tomorrow?");
  assert.equal(s.notifications.length, 0);
  sendMessage(s, j, "mechanic", "Yes, after 10.");
  assert.equal(j.messages.length, 2);
  assert.equal(s.notifications.length, 1);
});
test("new requests follow service acceptance rules and settings changes preserve existing bookings", () => {
  const s = initialState();
  s.jobs = [];
  const a = createRequest(s, {
    customer: "A",
    bike: "Bike A",
    problem: "Service please",
    service: SERVICES[0].name,
    time: "09:00",
  });
  const b = createRequest(s, {
    customer: "B",
    bike: "Bike B",
    problem: "Unknown fault",
    service: SERVICES[2].name,
    time: "10:30",
  });
  assert.equal(s.jobs.find((j) => j.id === a)!.work, "scheduled");
  assert.equal(s.jobs.find((j) => j.id === b)!.work, "pending");
  s.settings.booking = "dropoff";
  s.settings.acceptance = "review";
  s.settings.allocation = "queue";
  createRequest(s, { customer: "C", bike: "Bike C", problem: "Brake issue" });
  assert.equal(s.jobs[0].bookingMode, "appointment");
  assert.equal(s.jobs[2].bookingMode, "dropoff");
  assert.equal(s.jobs[2].mechanic, "");
  assert.equal(s.jobs[2].work, "pending");
});
test("pending timed requests reserve finite capacity, preventing a fourth concurrent bike", () => {
  const s = initialState();
  s.jobs = [];
  s.settings.acceptance = "review";
  for (let i = 0; i < 3; i++)
    createRequest(s, {
      customer: `Rider ${i}`,
      bike: "Bike",
      problem: "Problem",
      time: "10:00",
    });
  assert.throws(
    () =>
      createRequest(s, {
        customer: "Fourth rider",
        bike: "Bike",
        problem: "Problem",
        time: "10:00",
      }),
    /booked/,
  );
  assert.equal(s.jobs.length, 3);
});
test("failed reschedule leaves original booking and price intact", () => {
  const s = initialState();
  const [j, other] = s.jobs;
  other.mechanic = j.mechanic;
  const old = structuredClone(j);
  assert.throws(
    () => schedule(s, j, { time: other.time, minutes: 60 }),
    /already has/,
  );
  assert.equal(j.time, old.time);
  assert.equal(j.minutes, old.minutes);
  assert.equal(j.base, old.base);
  schedule(s, j, { minutes: 90 });
  assert.equal(j.base, old.base);
});
test("drop-off effort consumes capacity without reserving a continuous all-day appointment", () => {
  const s = initialState();
  s.jobs = [];
  s.settings.booking = "dropoff";
  s.settings.allocation = "queue";
  createRequest(s, { customer: "A", bike: "Bike", problem: "Repair" });
  const j = s.jobs[0];
  schedule(s, j, { minutes: 480, mechanic: "Jack" });
  createRequest(s, { customer: "B", bike: "Bike", problem: "Repair" });
  assert.throws(
    () => schedule(s, s.jobs[1], { mechanic: "Jack" }),
    /remaining capacity/,
  );
  schedule(s, s.jobs[1], { mechanic: "Sam" });
  assert.equal(s.jobs[1].mechanic, "Sam");
});
test("custom scenarios snapshot settings, jobs and media independently of later edits", () => {
  const { s, j } = inspect();
  saveScenario(s, "My walkthrough", "An edited inspection");
  const id = s.scenarioId;
  j.customer = "Changed";
  s.settings.booking = "dropoff";
  advance(s, 90);
  loadScenario(s, id);
  assert.equal(s.jobs[0].customer, "Priya Shah");
  assert.equal(s.settings.booking, "appointment");
  assert.equal(s.jobs[0].media[0].url, SAMPLE_MEDIA.url);
});
test("a customer cannot approve a missing or stale item after completion", () => {
  const { s, j } = inspect();
  propose(s, j, [extras[0]], "Inspection", []);
  const l = j.lines[0];
  decide(s, j, l.id, l.version, "approved");
  transition(s, j, "start");
  transition(s, j, "finish");
  assert.throws(() => decide(s, j, l.id, l.version, "approved"), /complete/);
  assert.throws(() => propose(s, j, extras, "Late inspection", []), /complete/);
});
test("request validation rejects impossible spending limits and invalid booking times", () => {
  const s = initialState();
  s.jobs = [];
  assert.throws(
    () => createRequest(s, { service: SERVICES[0].name, limit: 100 }),
    /cover/,
  );
  assert.throws(() => createRequest(s, { time: "17:00" }), /09:00/);
  assert.throws(() => createRequest(s, { day: "2026-09-01" }), /future/);
});
