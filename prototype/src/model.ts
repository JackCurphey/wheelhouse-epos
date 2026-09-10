export type Role = "shop" | "mechanic" | "customer";
export type WorkState =
  | "pending"
  | "scheduled"
  | "inspection"
  | "approval"
  | "working"
  | "parts"
  | "finished";
export type Channel = "Email" | "SMS" | "WhatsApp";
export type EventKind =
  "booking" | "approval" | "progress" | "delay" | "ready" | "message";
export type BookingMode = "appointment" | "dropoff";
export type Decision = "pending" | "approved" | "declined" | "limit";
export interface Media {
  id: string;
  url: string;
  name: string;
  type: string;
}
export interface Line {
  id: string;
  name: string;
  amount: number;
  decision: Decision;
  version: number;
}
export interface Entry {
  id: string;
  at: number;
  text: string;
}
export interface Message extends Entry {
  from: Role;
}
export interface Preferences {
  events: EventKind[];
  channels: Channel[];
}
export interface Job {
  id: string;
  token: string;
  customer: string;
  bike: string;
  service: string;
  problem: string;
  day: string;
  time: string;
  minutes: number;
  bookingMode: BookingMode;
  mechanic: string;
  work: WorkState;
  custody: "customer" | "shop" | "collected";
  ready: boolean;
  base: number;
  limit: number | null;
  lines: Line[];
  estimateVersion: number;
  inspection: string;
  media: Media[];
  customerMedia: Media[];
  history: Entry[];
  messages: Message[];
  preferences: Preferences;
  expected: string;
  partsDue: number | null;
  partsArrived: boolean;
}
export interface Settings {
  name: string;
  booking: BookingMode;
  acceptance: "auto" | "review" | "service";
  serviceRules: Record<string, "auto" | "review">;
  allocation: "assigned" | "queue";
}
export interface Scenario {
  id: string;
  name: string;
  description: string;
  jobs: Job[];
  settings: Settings;
  now: number;
}
export interface Notification {
  id: string;
  jobId: string;
  event: EventKind;
  at: number;
  channel: Channel;
  recipient: string;
  title: string;
  body: string;
  token: string;
}
export interface State {
  now: number;
  paused: boolean;
  jobs: Job[];
  settings: Settings;
  notifications: Notification[];
  scenarios: Scenario[];
  scenarioId: string;
}
export const MECHANICS = ["Jack", "Sam", "Alex"];
export const SERVICES = [
  { name: "Routine service", amount: 6500, minutes: 60 },
  { name: "Brake service", amount: 3500, minutes: 45 },
  { name: "Not sure — diagnose a problem", amount: 0, minutes: 60 },
];
export const EVENT_NAMES: Record<EventKind, string> = {
  booking: "Booking confirmations",
  approval: "Work needing approval",
  progress: "Work progress",
  delay: "Delays and revised estimates",
  ready: "Ready for collection",
  message: "New messages",
};
export const WORK_LABELS: Record<WorkState, string> = {
  pending: "Needs review",
  scheduled: "Scheduled",
  inspection: "Inspection",
  approval: "Needs approval",
  working: "In progress",
  parts: "Waiting for parts",
  finished: "Work finished",
};
export const BIKES = [
  {
    name: "Brompton C Line",
    detail: "Steel frame · 6-speed · folding city bike",
    source: "https://www.brompton.com/p/1565/c-line-subscription",
    checked: "2026-09-08",
  },
  {
    name: "Trek Domane AL 2",
    detail: "100 Series Alpha aluminium · Shimano Claris 8-speed",
    source:
      "https://www.trekbikes.com/us/en_US/bikes/road-bikes/performance-road-bikes/domane/domane-al/domane-al-2/p/549562/",
    checked: "2026-09-08",
  },
];
export const SAMPLE_MEDIA: Media = {
  id: "sample-inspection",
  url: "./media/inspection.mp4",
  name: "Illustrative brake inspection",
  type: "video/mp4",
};
export const defaults = (): Preferences => ({
  events: ["booking", "approval", "delay", "ready", "message"],
  channels: ["WhatsApp"],
});
export function uid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues also works on a phone opening the LAN demo over HTTP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100,
  );
export const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
export const dateLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
// Demo time is a shop-local wall clock represented as UTC; no host timezone conversion.
export const timeLabel = (now: number) =>
  new Date(now).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
export function total(job: Job) {
  return (
    job.base +
    job.lines
      .filter((l) => l.decision === "approved" || l.decision === "limit")
      .reduce((n, l) => n + l.amount, 0)
  );
}
export function status(job: Job) {
  return job.custody === "collected"
    ? "Collected"
    : job.ready
      ? "Ready for collection"
      : WORK_LABELS[job.work];
}
export function log(state: State, job: Job, text: string) {
  job.history.push({ id: uid(), at: state.now, text });
}

// Delivery adapter for the prototype. Domain operations never call a provider.
export function simulateDelivery(
  state: State,
  job: Job,
  event: EventKind,
  title: string,
  body: string,
) {
  if (!job.preferences.events.includes(event)) return;
  for (const channel of job.preferences.channels) {
    state.notifications.unshift({
      id: uid(),
      jobId: job.id,
      event,
      at: state.now,
      channel,
      recipient: job.customer,
      title,
      body,
      token: job.token,
    });
  }
}
function notify(
  state: State,
  job: Job,
  event: EventKind,
  title: string,
  body = title,
) {
  log(state, job, body);
  simulateDelivery(state, job, event, title, body);
}
export function makeJob(input: Partial<Job> = {}): Job {
  return {
    id: uid(),
    token: uid(),
    customer: "Taylor Reed",
    bike: BIKES[0].name,
    service: SERVICES[0].name,
    problem:
      "My daily commute is getting noisy. Please check the brakes and gears.",
    day: "2026-09-08",
    time: "10:00",
    minutes: 60,
    bookingMode: "appointment",
    mechanic: "",
    work: "scheduled",
    custody: "customer",
    ready: false,
    base: 6500,
    limit: null,
    lines: [],
    estimateVersion: 0,
    inspection: "",
    media: [],
    customerMedia: [],
    history: [],
    messages: [],
    preferences: defaults(),
    expected: "2026-09-08",
    partsDue: null,
    partsArrived: false,
    ...input,
  };
}
const baseSettings = (): Settings => ({
  name: "Wheelhouse Cycles",
  booking: "appointment",
  acceptance: "service",
  serviceRules: Object.fromEntries(
    SERVICES.map((s, i) => [s.name, i === 2 ? "review" : "auto"]),
  ),
  allocation: "assigned",
});
export function initialState(): State {
  const now = Date.parse("2026-09-08T09:00:00Z");
  const routine = makeJob({
    customer: "Taylor Reed",
    bike: BIKES[0].name,
    mechanic: "Jack",
  });
  const inspection = makeJob({
    customer: "Priya Shah",
    bike: BIKES[1].name,
    service: SERVICES[2].name,
    problem:
      "The front brake squeals and the gears skip when I climb. I don’t know what needs fixing.",
    base: 0,
    time: "11:30",
    mechanic: "Sam",
    work: "inspection",
    custody: "shop",
    inspection:
      "The front brake pads show wear. I recommend replacing them, then adjusting the gears. Please choose the work you would like us to do.",
    media: [{ ...SAMPLE_MEDIA }],
  });
  const parts = makeJob({
    customer: "Morgan Ellis",
    bike: BIKES[0].name,
    service: "Brake service",
    base: 3500,
    day: "2026-09-09",
    expected: "2026-09-10",
    time: "14:00",
    mechanic: "Alex",
    work: "parts",
    custody: "shop",
    partsDue: now + 24 * 60 * 60000,
    bookingMode: "dropoff",
    problem:
      "Please replace the rear brake cable and check the brake adjustment.",
  });
  for (const j of [routine, inspection, parts])
    j.history.push({
      id: uid(),
      at: now,
      text: "Sample service request created.",
    });
  const scenarios: Scenario[] = [
    {
      id: "day",
      name: "A day at the workshop",
      description:
        "Three bikes, three stages. Switch roles to see the whole workshop.",
      jobs: [routine, inspection, parts],
      settings: baseSettings(),
      now,
    },
    {
      id: "routine",
      name: "01 · Routine service",
      description: "From a booking to a bike ready for the ride home.",
      jobs: [routine],
      settings: baseSettings(),
      now,
    },
    {
      id: "inspection",
      name: "02 · Inspection and approval",
      description: "Show the findings. Let the rider decide what happens next.",
      jobs: [inspection],
      settings: baseSettings(),
      now,
    },
    {
      id: "parts",
      name: "03 · Waiting for a part",
      description:
        "Change an estimate, keep the rider informed, and resume work.",
      jobs: [{ ...parts, mechanic: "" }],
      settings: { ...baseSettings(), booking: "dropoff", allocation: "queue" },
      now,
    },
  ];
  const state: State = {
    now,
    paused: true,
    jobs: structuredClone(scenarios[0].jobs),
    settings: baseSettings(),
    notifications: [],
    scenarios,
    scenarioId: "day",
  };
  for (const job of state.jobs)
    simulateDelivery(
      state,
      job,
      "booking",
      "Your request is with us",
      `${job.service} for your ${job.bike}. Follow your bike’s progress here.`,
    );
  return state;
}
export function loadScenario(state: State, id: string) {
  const scenario = state.scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error("Choose an existing scenario.");
  state.jobs = structuredClone(scenario.jobs);
  // Tokens belong to this run. Links from an earlier run must not open new jobs.
  for (const job of state.jobs) job.token = uid();
  state.settings = structuredClone(scenario.settings);
  state.now = scenario.now;
  state.scenarioId = id;
  state.paused = true;
  state.notifications = [];
}
export function saveScenario(
  state: State,
  name: string,
  description: string,
  overwrite = false,
) {
  if (!name.trim()) throw new Error("Give your scenario a name.");
  const scenario: Scenario = {
    id: overwrite ? state.scenarioId : uid(),
    name: name.trim(),
    description,
    jobs: structuredClone(state.jobs),
    settings: structuredClone(state.settings),
    now: state.now,
  };
  const at = state.scenarios.findIndex((s) => s.id === scenario.id);
  if (at >= 0) state.scenarios[at] = scenario;
  else state.scenarios.push(scenario);
  state.scenarioId = scenario.id;
}
function minuteOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function capacityError(state: State, job: Job, mechanic: string) {
  const sameDay = state.jobs.filter(
    (j) =>
      j.id !== job.id &&
      j.day === job.day &&
      j.custody !== "collected" &&
      j.work !== "finished",
  );
  // Pending review holds capacity in this prototype until accepted or rescheduled.
  if (
    sameDay.reduce((n, j) => n + j.minutes, job.minutes) >
    MECHANICS.length * 480
  )
    return "This day has no remaining workshop capacity. Choose another day.";
  if (
    mechanic &&
    sameDay
      .filter((j) => j.mechanic === mechanic)
      .reduce((n, j) => n + j.minutes, job.minutes) > 480
  )
    return `${mechanic} has no remaining capacity that day.`;
  if (job.bookingMode === "appointment") {
    const start = minuteOf(job.time),
      end = start + job.minutes;
    if (!Number.isFinite(start) || start < 9 * 60 || end > 17 * 60)
      return "Choose an appointment between 09:00 and 17:00, allowing time for the work.";
    const overlaps = sameDay.filter(
      (j) =>
        j.bookingMode === "appointment" &&
        start < minuteOf(j.time) + j.minutes &&
        end > minuteOf(j.time),
    );
    if (mechanic && overlaps.some((j) => j.mechanic === mechanic))
      return `${mechanic} already has an appointment at that time.`;
    if (!mechanic && overlaps.length >= MECHANICS.length)
      return "All mechanics are booked at that time. Choose another appointment.";
  }
  return "";
}
export function schedule(
  state: State,
  job: Job,
  patch: Partial<Pick<Job, "day" | "time" | "minutes" | "mechanic">>,
) {
  if (job.work === "finished" || job.custody === "collected")
    throw new Error("Completed work cannot be rescheduled.");
  const candidate = { ...job, ...patch };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(candidate.day) ||
    candidate.day < dayOf(state.now)
  )
    throw new Error("Choose today or a future day.");
  if (
    !Number.isInteger(candidate.minutes) ||
    candidate.minutes < 15 ||
    candidate.minutes > 480
  )
    throw new Error("Planned work must be between 15 and 480 minutes.");
  if (candidate.mechanic && !MECHANICS.includes(candidate.mechanic))
    throw new Error("Choose a mechanic from the team.");
  const error = capacityError(state, candidate, candidate.mechanic);
  if (error) throw new Error(error);
  Object.assign(job, patch);
}
export function createRequest(state: State, input: Partial<Job>) {
  const service = SERVICES.find((s) => s.name === input.service) || SERVICES[2];
  const job = makeJob({
    ...input,
    base: service.amount,
    minutes: service.minutes,
    bookingMode: state.settings.booking,
    mechanic: "",
    work: "pending",
    custody: "customer",
    ready: false,
  });
  if (!job.customer.trim() || !job.bike.trim() || !job.problem.trim())
    throw new Error("Add your name, bike, and a short description.");
  if (
    job.limit !== null &&
    (!Number.isInteger(job.limit) || job.limit < job.base)
  )
    throw new Error(
      "Your total spending limit must cover the original service estimate.",
    );
  schedule(state, job, {});
  if (state.settings.allocation === "assigned") {
    const available = MECHANICS.find((m) => !capacityError(state, job, m));
    if (!available)
      throw new Error(
        "No mechanic has capacity for this request. Choose another day.",
      );
    job.mechanic = available;
  }
  const mode =
    state.settings.acceptance === "service"
      ? state.settings.serviceRules[service.name]
      : state.settings.acceptance;
  job.work = mode === "auto" ? "scheduled" : "pending";
  state.jobs.push(job);
  notify(
    state,
    job,
    "booking",
    job.work === "pending"
      ? "Request received — awaiting review"
      : "Your booking is confirmed",
    `${job.service} · ${dateLabel(job.day)}${job.bookingMode === "appointment" ? ` at ${job.time}` : " · drop off between 09:00 and 17:00"}. ${job.work === "pending" ? "The shop will review your request before confirming." : "We look forward to seeing you."}`,
  );
  return job.id;
}
function editable(job: Job) {
  if (job.work === "finished" || job.custody === "collected")
    throw new Error("This job’s work is complete.");
}
export function propose(
  state: State,
  job: Job,
  items: { name: string; amount: number }[],
  inspection: string,
  media: Media[],
) {
  editable(job);
  if (job.custody !== "shop")
    throw new Error("Receive the bike before recording an inspection.");
  if (
    !items.length ||
    items.some(
      (l) => !l.name.trim() || !Number.isInteger(l.amount) || l.amount < 0,
    )
  )
    throw new Error("Add at least one item with a valid estimate.");
  if (!inspection.trim()) throw new Error("Explain the inspection findings.");
  // Only unresolved proposals may be replaced. Authorised and declined lines retain their exact versions.
  job.lines = job.lines.filter((l) => l.decision !== "pending");
  job.estimateVersion++;
  let committed = total(job);
  for (const item of items) {
    const decision: Decision =
      job.limit !== null && committed + item.amount <= job.limit
        ? "limit"
        : "pending";
    if (decision === "limit") committed += item.amount;
    job.lines.push({
      ...item,
      id: uid(),
      decision,
      version: job.estimateVersion,
    });
  }
  job.inspection = inspection;
  job.media = media;
  job.work = job.lines.some((l) => l.decision === "pending")
    ? "approval"
    : "inspection";
  notify(
    state,
    job,
    "approval",
    "Your inspection is ready",
    `${inspection} Review the proposed work. Authorised estimate: ${money(total(job))}.`,
  );
}
export function decide(
  state: State,
  job: Job,
  lineId: string,
  version: number,
  decision: "approved" | "declined",
) {
  editable(job);
  const line = job.lines.find((l) => l.id === lineId);
  if (!line || line.version !== version || line.decision !== "pending")
    throw new Error("This proposal has changed. Review the latest estimate.");
  line.decision = decision;
  log(
    state,
    job,
    `${job.customer} ${decision} “${line.name}” (${money(line.amount)}), proposal ${version}.`,
  );
  if (
    !job.lines.some((l) => l.decision === "pending") &&
    job.work === "approval"
  )
    job.work = "inspection";
}
export function setLimit(state: State, job: Job, amount: number | null) {
  editable(job);
  if (amount !== null && (!Number.isInteger(amount) || amount < total(job)))
    throw new Error("The spending limit must cover work already authorised.");
  job.limit = amount;
  log(
    state,
    job,
    amount === null
      ? "Extra work now requires item-by-item approval. Existing approvals remain valid."
      : `Advance permission set to ${money(amount)} for the whole job, including the original service. Pending items still need an explicit choice.`,
  );
}
export function advance(state: State, minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0)
    throw new Error("Move time forward by a positive amount.");
  state.now += minutes * 60000;
  for (const job of state.jobs) {
    if (job.partsDue !== null && job.partsDue <= state.now) {
      job.partsDue = null;
      job.partsArrived = true;
      log(
        state,
        job,
        "The expected part has arrived in the simulator. The shop can resume work.",
      );
    }
  }
}
export function transition(state: State, job: Job, action: string) {
  if (job.custody === "collected")
    throw new Error("This bike has already been collected.");
  if (action === "accept") {
    if (job.work !== "pending")
      throw new Error("Only pending requests need acceptance.");
    schedule(state, job, {});
    job.work = "scheduled";
    notify(state, job, "booking", "Your booking is confirmed");
  } else if (action === "receive") {
    if (job.work !== "scheduled" || job.custody !== "customer")
      throw new Error("Confirm the booking before receiving the bike.");
    job.custody = "shop";
    job.work = "inspection";
    notify(state, job, "progress", "Your bike is with the workshop");
  } else if (action === "start") {
    if (
      !["inspection", "approval"].includes(job.work) ||
      job.custody !== "shop"
    )
      throw new Error("Receive and inspect the bike first.");
    if (job.lines.some((l) => l.decision === "pending"))
      throw new Error(
        "Resolve the outstanding approval requests before starting work.",
      );
    job.work = "working";
    notify(state, job, "progress", "Work has started on your bike");
  } else if (action === "resume") {
    if (job.work !== "parts" || !job.partsArrived)
      throw new Error("Wait for the part to arrive before resuming work.");
    job.work = "working";
    notify(state, job, "progress", "The part has arrived and work has resumed");
  } else if (action === "finish") {
    if (job.work !== "working")
      throw new Error("Start the authorised work before finishing it.");
    job.work = "finished";
    notify(state, job, "progress", "The work on your bike is finished");
  } else if (action === "ready") {
    if (job.work !== "finished" || job.ready)
      throw new Error("Finish the work before marking the bike ready.");
    job.ready = true;
    notify(
      state,
      job,
      "ready",
      "Your bike is ready for collection",
      "Your bike is ready. Collect from the shop between 09:00 and 17:00. Billing is simulated in this prototype.",
    );
  } else if (action === "collect") {
    if (!job.ready || job.custody !== "shop")
      throw new Error("Mark the bike ready before recording collection.");
    job.custody = "collected";
    log(state, job, "The shop recorded that the customer collected the bike.");
  } else throw new Error("Unknown workshop action.");
}
export function delay(
  state: State,
  job: Job,
  expected: string,
  hours: number,
  reason: string,
) {
  editable(job);
  if (job.custody !== "shop")
    throw new Error("Receive the bike before recording a parts delay.");
  if (
    !Number.isFinite(hours) ||
    hours < 1 ||
    !expected ||
    expected < dayOf(state.now)
  )
    throw new Error(
      "Choose a future estimate and at least one hour for delivery.",
    );
  if (!reason.trim()) throw new Error("Explain what the shop is waiting for.");
  if (job.lines.some((l) => l.decision === "pending"))
    throw new Error("Resolve the work approvals before ordering parts.");
  job.work = "parts";
  job.expected = expected;
  job.partsDue = state.now + hours * 60 * 60000;
  job.partsArrived = false;
  notify(
    state,
    job,
    "delay",
    "An update to your repair",
    `${reason} Estimated completion: ${dateLabel(expected)}.`,
  );
}
export function sendMessage(state: State, job: Job, from: Role, text: string) {
  if (!text.trim()) throw new Error("Write a message first.");
  job.messages.push({ id: uid(), at: state.now, from, text: text.trim() });
  if (from !== "customer")
    simulateDelivery(
      state,
      job,
      "message",
      "A message from the workshop",
      text.trim(),
    );
}
