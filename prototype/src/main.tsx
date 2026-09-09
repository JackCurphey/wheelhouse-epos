import React, { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  Bike,
  LayoutDashboard,
  CalendarDays,
  MessageSquare,
  Settings2,
  FlaskConical,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Wrench,
  ChevronRight,
  X,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Camera,
  Package,
  Link2,
  CheckCircle2,
  UserRound,
  Bell,
  Mail,
  Smartphone,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  log,
  simulateDelivery,
  total,
  status,
  money,
  dateLabel,
  dayOf,
  timeLabel,
  MECHANICS,
  SERVICES,
  BIKES,
  SAMPLE_MEDIA,
  EVENT_NAMES,
  uid,
} from "./model.ts";
import type { State, Job, Role, Media, Channel, EventKind } from "./model.ts";
import "./styles.css";

type Mutate = (fn: (state: State) => void, message?: string) => boolean;
type ModalKind =
  "request" | "scenario" | "inspection" | "delay" | "schedule" | "reset" | null;
const cx = (...values: (string | boolean | undefined)[]) =>
  values.filter(Boolean).join(" ");
function Button({
  children,
  icon: Icon,
  tone = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  tone?: "default" | "primary" | "quiet" | "danger";
}) {
  return (
    <button
      type="button"
      {...props}
      className={cx("button", `button-${tone}`, props.className)}
    >
      {Icon && <Icon size={17} aria-hidden="true" />}
      {children}
    </button>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, (child) => {
        if (
          React.isValidElement(child) &&
          ["input", "select", "textarea"].includes(String(child.type))
        ) {
          return React.cloneElement(
            child as React.ReactElement<Record<string, unknown>>,
            { id, "aria-describedby": hint ? `${id}-hint` : undefined },
          );
        }
        return child;
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
function Tag({ job }: { job: Job }) {
  return (
    <span
      className={`tag status-${job.ready || job.custody === "collected" ? "finished" : job.work}`}
    >
      <span className="status-dot" />
      {status(job)}
    </span>
  );
}
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Bike size={32} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-inner">
        <header className="section-heading">
          <h2 id={titleId}>{title}</h2>
          <Button
            icon={X}
            aria-label="Close dialog"
            tone="quiet"
            onClick={close}
          />
        </header>
        {children}
      </div>
    </dialog>
  );
}
function MediaGallery({ media }: { media: Media[] }) {
  if (!media.length) return null;
  return (
    <div className="media-gallery">
      {media.map((m) => (
        <figure key={m.id}>
          {m.type.startsWith("video/") ? (
            <video
              controls
              playsInline
              preload="metadata"
              src={m.url}
              poster={
                m.id === SAMPLE_MEDIA.id
                  ? "./media/inspection-poster.png"
                  : undefined
              }
              aria-label={m.name}
            >
              {m.id === SAMPLE_MEDIA.id && (
                <track
                  default
                  kind="captions"
                  src="./media/inspection.vtt"
                  srcLang="en"
                  label="English"
                />
              )}
            </video>
          ) : (
            <img src={m.url} alt={m.name} />
          )}
          <figcaption>{m.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}
const objectURLs = new Set<string>();
function releaseMedia() {
  for (const url of objectURLs) URL.revokeObjectURL(url);
  objectURLs.clear();
}
function MediaInput({
  value,
  onChange,
  videoOnly = false,
}: {
  value: Media[];
  onChange: (value: Media[]) => void;
  videoOnly?: boolean;
}) {
  const [error, setError] = useState("");
  const accept = videoOnly ? "video/*" : "image/*,video/*";
  const add = (files: File[]) => {
    if (
      files.some(
        (f) =>
          f.size > 50 * 1024 * 1024 ||
          !/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(
            f.type,
          ),
      )
    ) {
      setError("Use a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file under 50 MB.");
      return;
    }
    setError("");
    onChange([
      ...value,
      ...files.map((f) => {
        const url = URL.createObjectURL(f);
        objectURLs.add(url);
        return { id: uid(), name: f.name, type: f.type, url };
      }),
    ]);
  };
  const handler = (e: ChangeEvent<HTMLInputElement>) => {
    add([...(e.target.files || [])]);
    e.target.value = "";
  };
  return (
    <div>
      {/* Two inputs on purpose: a phone browser given `capture` opens the camera
          and never offers the photo library, so a separate plain file input
          keeps an existing photo or a prepared clip attachable. */}
      <div className="media-inputs">
        <Field
          label={videoOnly ? "Record a video now" : "Take a photo or video"}
          hint="Opens the camera on a phone. Files stay in this browser session."
        >
          <input
            type="file"
            accept={accept}
            capture="environment"
            multiple
            onChange={handler}
          />
        </Field>
        <Field
          label={
            videoOnly ? "Or choose a video file" : "Or choose photos or video"
          }
          hint="Pick something you already have on this device."
        >
          <input type="file" accept={accept} multiple onChange={handler} />
        </Field>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <MediaGallery media={value} />
      {value.length > 0 && (
        <Button tone="quiet" onClick={() => onChange([])}>
          Remove attachments
        </Button>
      )}
    </div>
  );
}
function App() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  const [role, setRole] = useState<Role>("shop");
  const [view, setView] = useState("workshop");
  const [selected, setSelected] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(state.jobs[0]?.id || "");
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [boardFilter, setBoardFilter] = useState("all");
  const [mechanic, setMechanic] = useState("Jack");
  const [scheduleDay, setScheduleDay] = useState(dayOf(state.now));
  const [inboxChannel, setInboxChannel] = useState("All");
  const mutate: Mutate = (fn, message) => {
    try {
      const next = structuredClone(stateRef.current);
      fn(next);
      stateRef.current = next;
      setState(next);
      setError("");
      if (message) setToast(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That change could not be made.",
      );
      return false;
    }
  };
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (state.paused) return;
    const timer = setInterval(() => mutate((s) => advance(s, 15)), 5000);
    return () => clearInterval(timer);
  }, [state.paused]);
  useEffect(() => {
    function readLink() {
      if (!location.hash.startsWith("#track=")) return;
      const token = location.hash.slice(7);
      const job = stateRef.current.jobs.find((j) => j.token === token);
      if (job) {
        setRole("customer");
        setCustomerId(job.id);
        setView("workshop");
        setSelected(null);
      } else
        setError(
          "This demo link belongs to another run or session. Choose a current customer in the role controls.",
        );
    }
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);
  const scenario = state.scenarios.find((s) => s.id === state.scenarioId)!;
  const job = state.jobs.find(
    (j) => j.id === (role === "customer" ? customerId : selected),
  );
  const open = (kind: ModalKind) => {
    setError("");
    setModal(kind);
  };
  const close = () => {
    setModal(null);
    setError("");
  };
  const getJob = (s: State) => {
    const found = s.jobs.find((j) => j.id === job?.id);
    if (!found) throw new Error("Choose a current job.");
    return found;
  };
  const switchRole = (next: Role) => {
    if (selected) setCustomerId(selected);
    setRole(next);
    setView("workshop");
    setSelected(null);
    setError("");
    history.replaceState(null, "", location.pathname);
  };
  const reset = (id: string) => {
    if (
      mutate(
        (s) => loadScenario(s, id),
        "Scenario loaded. The clock is paused.",
      )
    ) {
      setSelected(null);
      setCustomerId(stateRef.current.jobs[0]?.id || "");
      setScheduleDay(dayOf(stateRef.current.now));
      setQuery("");
      setBoardFilter("all");
      close();
      history.replaceState(null, "", location.pathname);
    }
  };
  const filtered = state.jobs
    .filter((j) =>
      `${j.customer} ${j.bike} ${j.service}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (j) =>
        boardFilter === "all" ||
        (boardFilter === "attention"
          ? ["pending", "approval", "parts"].includes(j.work)
          : j.custody === "shop"),
    )
    .filter(
      (j) => role !== "mechanic" || !j.mechanic || j.mechanic === mechanic,
    );
  const inCare = state.jobs.filter((j) => j.custody === "shop").length;
  const attention = state.jobs.filter((j) =>
    ["pending", "approval", "parts"].includes(j.work),
  ).length;
  const newRequest = () => open("request");

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="simbar">
        <div className="sim-title">
          <FlaskConical size={17} />
          <strong>Prototype</strong>
          <span className="sim-description">
            One session. All messages simulated.
          </span>
        </div>
        <div className="clock-controls">
          <span className="clock" aria-live="off">
            {timeLabel(state.now)}
          </span>
          <Button
            tone="quiet"
            icon={state.paused ? Play : Pause}
            onClick={() =>
              mutate((s) => {
                s.paused = !s.paused;
              })
            }
          >
            {state.paused ? "Run clock" : "Pause"}
          </Button>
          <Button
            tone="quiet"
            icon={FastForward}
            onClick={() => mutate((s) => advance(s, 60), "Advanced one hour")}
          >
            +1 hour
          </Button>
          <Button
            tone="quiet"
            onClick={() => mutate((s) => advance(s, 1440), "Advanced one day")}
          >
            +1 day
          </Button>
          <Button
            tone="quiet"
            icon={RotateCcw}
            onClick={() => open("reset")}
            aria-label="Reset scenario"
          />
        </div>
      </div>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setSelected(null);
              setView("workshop");
            }}
          >
            <span className="brand-mark">
              <Bike size={25} />
            </span>
            <span>
              Wheelhouse<small>THE WORKSHOP</small>
            </span>
          </a>
          <div className="shop-identity">
            <span className="avatar">WC</span>
            <span>
              <strong>{state.settings.name}</strong>
              <small>Workshop prototype</small>
            </span>
          </div>
          <p className="eyebrow sidebar-label">Your workspace</p>
          <nav aria-label="Main navigation">
            {[
              [
                "workshop",
                role === "customer" ? "My bike" : "Workshop",
                LayoutDashboard,
              ],
              ...(role === "customer"
                ? []
                : [["schedule", "Schedule", CalendarDays]]),
              ["inbox", "Demo inbox", MessageSquare],
              ...(role === "customer"
                ? []
                : [["settings", "Shop settings", Settings2]]),
              ["scenarios", "Scenarios", FlaskConical],
            ].map(([id, label, Icon]) => {
              const Glyph = Icon as LucideIcon;
              return (
                <button
                  key={id as string}
                  aria-label={label as string}
                  // At tablet width the sidebar shows icons only, so the name
                  // has to be available on hover as well as to a screen reader.
                  title={label as string}
                  className={cx("nav-item", view === id && "active")}
                  onClick={() => {
                    setView(id as string);
                    setSelected(null);
                    setError("");
                  }}
                >
                  <Glyph size={19} />
                  <span>{label as string}</span>
                  {id === "inbox" && (
                    <span className="nav-count">
                      {
                        state.notifications.filter(
                          (n) => role !== "customer" || n.jobId === customerId,
                        ).length
                      }
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <div className="mini-label">
              <span className="live-dot" /> JACK’S SIMULATOR
            </div>
            <strong>{scenario.name}</strong>
            <p>{scenario.description}</p>
            <button
              className="text-link"
              onClick={() => {
                setView("scenarios");
                setSelected(null);
              }}
            >
              Explore scenarios <ArrowUpRight size={15} />
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="rolebar">
            <div>
              <span className="eyebrow">You’re trying the</span>
              <strong>
                {role === "shop"
                  ? "Shop experience"
                  : role === "mechanic"
                    ? "Mechanic experience"
                    : "Customer experience"}
              </strong>
            </div>
            <div className="role-options" aria-label="Switch demo role">
              {(["shop", "mechanic", "customer"] as Role[]).map((r) => (
                <button
                  key={r}
                  aria-pressed={role === r}
                  className={cx(role === r && "selected")}
                  onClick={() => switchRole(r)}
                >
                  {r === "shop" ? (
                    <LayoutDashboard size={16} />
                  ) : r === "mechanic" ? (
                    <Wrench size={16} />
                  ) : (
                    <UserRound size={16} />
                  )}
                  {r[0].toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            {role === "customer" && (
              <label className="role-picker">
                Playing as
                <select
                  aria-label="Demo customer"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    history.replaceState(null, "", location.pathname);
                  }}
                >
                  {state.jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.customer} · {j.bike}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {role === "mechanic" && (
              <label className="role-picker">
                Playing as
                <select
                  aria-label="Demo mechanic"
                  value={mechanic}
                  onChange={(e) => setMechanic(e.target.value)}
                >
                  {MECHANICS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            )}
          </header>
          <main id="main" tabIndex={-1}>
            {error && !modal && (
              <div className="error error-banner" role="alert">
                {error}
                <Button
                  icon={X}
                  tone="quiet"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                />
              </div>
            )}
            {view === "workshop" &&
              (role === "customer" ? (
                job ? (
                  <Customer
                    job={job}
                    state={state}
                    mutate={mutate}
                    newRequest={newRequest}
                  />
                ) : (
                  <Empty title="Start with your bike">
                    <Button tone="primary" onClick={newRequest}>
                      Request a service
                    </Button>
                  </Empty>
                )
              ) : selected && job ? (
                <>
                  <Button
                    tone="quiet"
                    icon={ArrowLeft}
                    onClick={() => setSelected(null)}
                  >
                    Back to workshop
                  </Button>
                  <JobDetail
                    job={job}
                    state={state}
                    role={role}
                    mechanic={mechanic}
                    mutate={mutate}
                    open={open}
                    onCustomer={() => {
                      setCustomerId(job.id);
                      setRole("customer");
                      setSelected(null);
                    }}
                  />
                </>
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">
                        {dateLabel(dayOf(state.now))} · THE WORKSHOP
                      </p>
                      <h1>A good day for a better ride.</h1>
                      <p>
                        Every bike, from the first request to the ride home.
                      </p>
                    </div>
                    <Button tone="primary" icon={Plus} onClick={newRequest}>
                      New service request
                    </Button>
                  </div>
                  <div className="stats">
                    <button
                      onClick={() => setBoardFilter("all")}
                      className={cx(boardFilter === "all" && "chosen")}
                    >
                      <span>Active requests</span>
                      <strong>
                        {state.jobs
                          .filter((j) => j.custody !== "collected")
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      <Bike />
                    </button>
                    <button
                      onClick={() => setBoardFilter("attention")}
                      className={cx(boardFilter === "attention" && "chosen")}
                    >
                      <span>Need attention</span>
                      <strong>{attention.toString().padStart(2, "0")}</strong>
                      <Clock3 />
                    </button>
                    <button
                      onClick={() => setBoardFilter("care")}
                      className={cx(boardFilter === "care" && "chosen")}
                    >
                      <span>Bikes in our care</span>
                      <strong>{inCare.toString().padStart(2, "0")}</strong>
                      <Wrench />
                    </button>
                  </div>
                  <div className="section-heading board-heading">
                    <div>
                      <h2>On the workbench</h2>
                      <span className="muted">
                        {role === "mechanic"
                          ? `${mechanic}’s jobs and the shared queue`
                          : "Across the workshop"}
                      </span>
                    </div>
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Search jobs"
                        placeholder="Find a bike or customer"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="board">
                    {[
                      {
                        title: "Coming in",
                        hint: "Requests and bookings",
                        jobs: filtered.filter(
                          (j) =>
                            ["pending", "scheduled"].includes(j.work) &&
                            j.custody !== "collected",
                        ),
                      },
                      {
                        title: "On the bench",
                        hint: "Inspections and work",
                        jobs: filtered.filter(
                          (j) =>
                            !["pending", "scheduled", "finished"].includes(
                              j.work,
                            ),
                        ),
                      },
                      {
                        title: "Heading home",
                        hint: "Finished and collected",
                        jobs: filtered.filter((j) => j.work === "finished"),
                      },
                    ].map((col) => (
                      <section className="board-column" key={col.title}>
                        <header>
                          <h3>
                            {col.title}
                            <span>{col.jobs.length}</span>
                          </h3>
                          <small>{col.hint}</small>
                        </header>
                        {col.jobs.map((j) => (
                          <button
                            className="job-card"
                            key={j.id}
                            onClick={() => setSelected(j.id)}
                          >
                            <div className="card-top">
                              <Tag job={j} />
                              <ArrowUpRight size={17} />
                            </div>
                            <h3>{j.bike}</h3>
                            <p>{j.customer}</p>
                            <div className="service-line">
                              <Wrench size={14} />
                              {j.service}
                            </div>
                            <div className="card-foot">
                              <span>
                                <CalendarDays size={14} />
                                {dateLabel(j.day)}
                                {j.bookingMode === "appointment"
                                  ? ` · ${j.time}`
                                  : " · Drop-off"}
                              </span>
                              <span>{j.mechanic || "Shared queue"}</span>
                            </div>
                            {j.work === "parts" && (
                              <div className="card-note">
                                <Package size={14} />
                                {j.partsArrived
                                  ? "Part arrived — ready to resume"
                                  : `Expected ${dateLabel(j.expected)}`}
                              </div>
                            )}
                          </button>
                        ))}
                        {!col.jobs.length && (
                          <div className="column-empty">
                            {col.title === "Heading home"
                              ? "Good work ends here."
                              : "No bikes here just now."}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                  <div className="hint-strip">
                    <FlaskConical size={20} />
                    <p>
                      <strong>Try the other side of the counter.</strong> Open a
                      bike, then switch to its customer view. Every action
                      carries across.
                    </p>
                    <Button
                      tone="quiet"
                      onClick={() => {
                        setView("scenarios");
                        setSelected(null);
                      }}
                    >
                      Choose a scenario <ArrowRight size={16} />
                    </Button>
                  </div>
                </>
              ))}
            {view === "schedule" && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">PLAN THE WORK</p>
                    <h1>The workshop diary</h1>
                    <p>
                      Appointments keep their time. Drop-offs reserve work for
                      the day.
                    </p>
                  </div>
                  <Button tone="primary" icon={Plus} onClick={newRequest}>
                    New request
                  </Button>
                </div>
                <div className="panel">
                  <div className="section-heading">
                    <Field label="Work date">
                      <input
                        type="date"
                        value={scheduleDay}
                        onChange={(e) => setScheduleDay(e.target.value)}
                      />
                    </Field>
                    <span className="muted">
                      09:00–17:00 · 8 hours per mechanic
                    </span>
                  </div>
                  <div className="schedule-grid">
                    {[...MECHANICS, "Shared queue"].map((m) => {
                      const jobs = state.jobs.filter(
                        (j) =>
                          j.day === scheduleDay &&
                          (j.mechanic || "Shared queue") === m &&
                          j.custody !== "collected",
                      );
                      const minutes = jobs
                        .filter((j) => j.work !== "finished")
                        .reduce((n, j) => n + j.minutes, 0);
                      return (
                        <section key={m}>
                          <h3>{m}</h3>
                          <small>{minutes} minutes planned</small>
                          <div className="capacity">
                            <span
                              style={{
                                width: `${Math.min(100, (minutes / 480) * 100)}%`,
                              }}
                            />
                          </div>
                          {jobs
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map((j) => (
                              <button
                                className="schedule-job"
                                key={j.id}
                                onClick={() => {
                                  setSelected(j.id);
                                  setView("workshop");
                                }}
                              >
                                <strong>
                                  {j.bookingMode === "appointment"
                                    ? j.time
                                    : "Day drop-off"}
                                </strong>
                                <span>{j.bike}</span>
                                <small>
                                  {j.customer} · {j.minutes} min
                                </small>
                                <Tag job={j} />
                              </button>
                            ))}
                          {!jobs.length && (
                            <p className="muted">Room for the next bike.</p>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </div>
                <p className="footnote">
                  Demo rule: pending requests hold capacity. Each mechanic has
                  eight working hours; no automatic expiry. Change a job’s
                  allocation or date from its workshop view.
                </p>
              </>
            )}
            {view === "inbox" && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">SIMULATED DELIVERY</p>
                    <h1>The right update, in the right place.</h1>
                    <p>
                      Preview what the customer receives. Nothing is sent
                      outside this session.
                    </p>
                  </div>
                </div>
                <div className="chips">
                  {["All", "WhatsApp", "Email", "SMS"].map((channel) => (
                    <button
                      className={cx(
                        "chip",
                        channel === inboxChannel && "selected",
                      )}
                      key={channel}
                      onClick={() => setInboxChannel(channel)}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
                <div className="inbox">
                  {state.notifications
                    .filter(
                      (n) =>
                        (inboxChannel === "All" ||
                          n.channel === inboxChannel) &&
                        (role !== "customer" || n.jobId === customerId),
                    )
                    .map((n) => (
                      <article
                        className={`notification channel-${n.channel}`}
                        key={n.id}
                      >
                        <div className="section-heading">
                          <span className="channel-label">
                            {n.channel === "Email" ? (
                              <Mail size={17} />
                            ) : n.channel === "WhatsApp" ? (
                              <MessageSquare size={17} />
                            ) : (
                              <Smartphone size={17} />
                            )}
                            {n.channel}
                          </span>
                          <small>{timeLabel(n.at)}</small>
                        </div>
                        <p className="muted">To {n.recipient} · simulated</p>
                        <h3>{n.title}</h3>
                        <p>{n.body}</p>
                        <a
                          className="text-link"
                          href={`#track=${n.token}`}
                          onClick={() => {
                            setCustomerId(n.jobId);
                            setRole("customer");
                            setView("workshop");
                            setSelected(null);
                          }}
                        >
                          View your bike <ArrowUpRight size={16} />
                        </a>
                      </article>
                    ))}
                  {!state.notifications.some(
                    (n) =>
                      (inboxChannel === "All" || n.channel === inboxChannel) &&
                      (role !== "customer" || n.jobId === customerId),
                  ) && (
                    <Empty title="No updates here yet">
                      Choose this channel in the customer’s update preferences,
                      then make a change to their job.
                    </Empty>
                  )}
                </div>
              </>
            )}
            {view === "settings" && (
              <ShopSettings state={state} mutate={mutate} />
            )}
            {view === "scenarios" && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">JACK’S SIMULATOR</p>
                    <h1>Different days. Different ways.</h1>
                    <p>
                      Choose a starting point, change the workflow, and play
                      every part.
                    </p>
                  </div>
                  <Button
                    tone="primary"
                    icon={Plus}
                    onClick={() => open("scenario")}
                  >
                    Create a scenario
                  </Button>
                </div>
                <div className="scenario-grid">
                  {state.scenarios.map((s) => (
                    <article className="scenario-card" key={s.id}>
                      <div className="section-heading">
                        <FlaskConical size={25} />
                        {s.id === state.scenarioId && (
                          <span className="tag status-finished">
                            Current scenario
                          </span>
                        )}
                      </div>
                      <h2>{s.name}</h2>
                      <p>{s.description}</p>
                      <div className="scenario-meta">
                        {s.jobs.length} {s.jobs.length === 1 ? "bike" : "bikes"}{" "}
                        ·{" "}
                        {s.settings.booking === "appointment"
                          ? "Appointments"
                          : "Day drop-offs"}
                      </div>
                      <Button
                        onClick={() => {
                          reset(s.id);
                          setView("workshop");
                        }}
                      >
                        Start this scenario <ArrowRight size={16} />
                      </Button>
                    </article>
                  ))}
                </div>
                <div className="panel scenario-help">
                  <h2>Make it your workshop</h2>
                  <p>
                    Change shop settings, create requests, and move bikes
                    through the workflow. Save the current state as a new
                    scenario, or replace the current starting point. Reset
                    returns to that saved starting point.
                  </p>
                  <Button onClick={() => open("scenario")}>
                    Save or edit this scenario
                  </Button>
                  <p className="footnote">
                    Run clock advances 15 demo minutes every 5 seconds. Pause
                    stops the clock; you can still interact and fast-forward. A
                    reset clears delivered updates and restores the saved jobs
                    and parts timers. Everything is held in memory until you
                    refresh or close this tab.
                  </p>
                </div>
              </>
            )}
          </main>
          <footer className="app-footer">
            <span>Wheelhouse · A little less admin. A little more riding.</span>
            <span>Interactive prototype · Fictional customers</span>
          </footer>
        </div>
      </div>
      {modal && (
        <Dialog
          title={
            {
              request: "Request work on a bike",
              scenario: "Make this scenario yours",
              inspection: "Share an inspection",
              delay: "Waiting for a part",
              schedule: "Plan this work",
              reset: "Reset this scenario?",
            }[modal]
          }
          close={close}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {modal === "request" && (
            <RequestForm
              state={state}
              onSubmit={(input) => {
                let id = "";
                if (
                  mutate((s) => {
                    id = createRequest(s, input);
                  }, "Service request created")
                ) {
                  setCustomerId(id);
                  setSelected(role === "customer" ? null : id);
                  setView("workshop");
                  close();
                }
              }}
            />
          )}
          {modal === "scenario" && (
            <ScenarioForm
              scenario={scenario}
              onSubmit={(name, desc, overwrite, blank) => {
                if (
                  mutate((s) => {
                    if (blank) {
                      s.jobs = [];
                      s.notifications = [];
                    }
                    saveScenario(s, name, desc, overwrite);
                    s.paused = true;
                  }, "Scenario saved for this session")
                ) {
                  setSelected(null);
                  setCustomerId(stateRef.current.jobs[0]?.id || "");
                  close();
                }
              }}
            />
          )}
          {modal === "inspection" && job && (
            <InspectionForm
              job={job}
              onSubmit={(items, note, media) => {
                if (
                  mutate(
                    (s) => propose(s, getJob(s), items, note, media),
                    "Inspection shared with the customer",
                  )
                )
                  close();
              }}
            />
          )}
          {modal === "delay" && job && (
            <DelayForm
              state={state}
              job={job}
              onSubmit={(expected, hours, reason) => {
                if (
                  mutate(
                    (s) => delay(s, getJob(s), expected, hours, reason),
                    "Completion estimate updated",
                  )
                )
                  close();
              }}
            />
          )}
          {modal === "schedule" && job && (
            <ScheduleForm
              job={job}
              state={state}
              onSubmit={(patch) => {
                if (
                  mutate((s) => {
                    const j = getJob(s);
                    schedule(s, j, patch);
                    log(
                      s,
                      j,
                      `Work replanned for ${dateLabel(j.day)}${j.bookingMode === "appointment" ? ` at ${j.time}` : " as a day drop-off"} · ${j.mechanic || "shared queue"}.`,
                    );
                    simulateDelivery(
                      s,
                      j,
                      "booking",
                      "Your schedule has changed",
                      j.history.at(-1)!.text,
                    );
                  }, "Work schedule updated")
                )
                  close();
              }}
            />
          )}
          {modal === "reset" && (
            <>
              <p>
                This returns <strong>{scenario.name}</strong> to its saved
                starting point. Changes made since saving and simulated messages
                will be cleared.
              </p>
              <div className="actions">
                <Button onClick={close}>Keep exploring</Button>
                <Button
                  tone="primary"
                  icon={RotateCcw}
                  onClick={() => reset(state.scenarioId)}
                >
                  Reset scenario
                </Button>
              </div>
            </>
          )}
        </Dialog>
      )}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </>
  );
}
function JobDetail({
  job,
  state,
  role,
  mechanic,
  mutate,
  open,
  onCustomer,
}: {
  job: Job;
  state: State;
  role: Role;
  mechanic: string;
  mutate: Mutate;
  open: (kind: ModalKind) => void;
  onCustomer: () => void;
}) {
  const change = (action: string) =>
    mutate(
      (s) =>
        transition(
          s,
          s.jobs.find((j) => j.id === job.id)!,
          action,
        ),
      "Workshop updated",
    );
  const source = BIKES.find((b) => b.name === job.bike);
  const pending = job.lines.some((l) => l.decision === "pending");
  const finished = job.work === "finished";
  return (
    <>
      <div className="page-heading detail-heading">
        <div>
          <p className="eyebrow">
            SERVICE REQUEST · {job.id.slice(0, 6).toUpperCase()}
          </p>
          <h1>{job.bike}</h1>
          <p>
            {job.customer} <span className="separator">/</span> {job.service}
          </p>
        </div>
        <div className="actions">
          <Tag job={job} />
          <Button icon={ArrowUpRight} onClick={onCustomer}>
            Open customer view
          </Button>
        </div>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel">
            <div className="section-heading">
              <h2>The rider’s request</h2>
              <Bike size={23} />
            </div>
            <p className="request-quote">“{job.problem}”</p>
            <MediaGallery media={job.customerMedia} />
            {source && (
              <div className="bike-spec">
                <span>{source.detail}</span>
                <a href={source.source} target="_blank" rel="noreferrer">
                  Manufacturer specifications <ArrowUpRight size={13} />
                </a>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Inspection and work</h2>
                <p className="muted">Show the findings. Agree the work.</p>
              </div>
              {!finished && job.custody === "shop" && (
                <Button icon={Camera} onClick={() => open("inspection")}>
                  {job.lines.length
                    ? "Add or revise proposal"
                    : "Share inspection"}
                </Button>
              )}
            </div>
            {job.inspection ? (
              <>
                <MediaGallery media={job.media} />
                <p>{job.inspection}</p>
              </>
            ) : (
              <div className="inline-empty">
                <Camera size={23} />
                <p>
                  Record a quick walk-around so the customer can see what you
                  see.
                </p>
              </div>
            )}
            <Estimate job={job} />
            {pending && (
              <div className="notice">
                <Clock3 size={18} />
                <span>
                  Waiting for the customer’s choices. Open their view to try the
                  approval experience.
                </span>
              </div>
            )}
          </section>
          <Conversation job={job} role={role} mutate={mutate} />
          <History job={job} />
        </div>
        <aside className="detail-side">
          <section className="panel next-step">
            <p className="eyebrow">NEXT AT THE WORKBENCH</p>
            <h2>
              {job.custody === "collected"
                ? "Back on the road."
                : job.ready
                  ? "Ready for the ride home."
                  : finished
                    ? "All work finished."
                    : job.work === "parts"
                      ? "A pause for a part."
                      : job.work === "approval"
                        ? "Let the rider choose."
                        : "Keep this bike moving."}
            </h2>
            {job.work === "pending" && (
              <Button
                tone="primary"
                icon={Check}
                onClick={() => change("accept")}
              >
                Accept request
              </Button>
            )}
            {job.work === "scheduled" && (
              <Button
                tone="primary"
                icon={Bike}
                onClick={() => change("receive")}
              >
                Receive bike
              </Button>
            )}
            {["inspection", "approval"].includes(job.work) && (
              <Button
                tone="primary"
                icon={Wrench}
                disabled={pending}
                onClick={() => change("start")}
              >
                Start authorised work
              </Button>
            )}
            {job.work === "working" && (
              <Button
                tone="primary"
                icon={CheckCircle2}
                onClick={() => change("finish")}
              >
                Finish work
              </Button>
            )}
            {job.work === "parts" && (
              <>
                <p>
                  {job.partsArrived
                    ? "The part has arrived. You can resume the repair."
                    : "Fast-forward the simulator to the part’s arrival."}
                </p>
                <Button
                  tone="primary"
                  disabled={!job.partsArrived}
                  onClick={() => change("resume")}
                >
                  Resume work
                </Button>
              </>
            )}
            {finished && !job.ready && (
              <Button tone="primary" onClick={() => change("ready")}>
                Mark ready for collection
              </Button>
            )}
            {job.ready && job.custody === "shop" && (
              <Button tone="primary" onClick={() => change("collect")}>
                Record collection
              </Button>
            )}
            {job.custody === "collected" && (
              <p>
                The bike has left the shop. The work and collection are recorded
                separately.
              </p>
            )}
            {!finished && job.custody === "shop" && (
              <Button
                icon={Package}
                disabled={pending}
                onClick={() => open("delay")}
              >
                Waiting for parts
              </Button>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>On the diary</h2>
              {!finished && (
                <Button tone="quiet" onClick={() => open("schedule")}>
                  Edit
                </Button>
              )}
            </div>
            <dl className="facts">
              <div>
                <dt>
                  {job.bookingMode === "appointment"
                    ? "Appointment"
                    : "Drop-off day"}
                </dt>
                <dd>
                  {dateLabel(job.day)}
                  {job.bookingMode === "appointment" ? ` · ${job.time}` : ""}
                </dd>
              </div>
              <div>
                <dt>Planned effort</dt>
                <dd>{job.minutes} minutes</dd>
              </div>
              <div>
                <dt>Assigned to</dt>
                <dd>{job.mechanic || "Shared queue"}</dd>
              </div>
              <div>
                <dt>Estimated completion</dt>
                <dd>{dateLabel(job.expected)}</dd>
              </div>
              <div>
                <dt>Bike location</dt>
                <dd>
                  {job.custody === "shop"
                    ? "In the shop’s care"
                    : job.custody === "collected"
                      ? "Collected"
                      : "With the customer"}
                </dd>
              </div>
            </dl>
            {role === "mechanic" && !job.mechanic && !finished && (
              <Button
                onClick={() =>
                  mutate((s) => {
                    const j = s.jobs.find((x) => x.id === job.id)!;
                    schedule(s, j, { mechanic });
                    log(
                      s,
                      j,
                      `${mechanic} picked up the job from the shared queue.`,
                    );
                  }, "Job assigned")
                }
              >
                Take this job
              </Button>
            )}
          </section>
          <Billing job={job} />
        </aside>
      </div>
    </>
  );
}
function Estimate({
  job,
  customer = false,
  mutate,
}: {
  job: Job;
  customer?: boolean;
  mutate?: Mutate;
}) {
  return (
    <div className="estimate">
      <div className="estimate-row">
        <div>
          <strong>{job.service}</strong>
          <small>Original service estimate</small>
        </div>
        <strong>{money(job.base)}</strong>
      </div>
      {job.lines.map((l) => (
        <div className="estimate-item" key={l.id}>
          <div className="estimate-row">
            <div>
              <strong>{l.name}</strong>
              <small>
                {l.decision === "limit"
                  ? "Authorised within your spending limit"
                  : l.decision === "pending"
                    ? "Your approval is needed"
                    : l.decision === "approved"
                      ? "Approved by customer"
                      : "Declined — not included"}{" "}
                · v{l.version}
              </small>
            </div>
            <strong>{money(l.amount)}</strong>
          </div>
          {customer && l.decision === "pending" && (
            <div className="approval-actions">
              <Button
                tone="primary"
                icon={Check}
                onClick={() =>
                  mutate?.(
                    (s) =>
                      decide(
                        s,
                        s.jobs.find((j) => j.id === job.id)!,
                        l.id,
                        l.version,
                        "approved",
                      ),
                    "Work approved",
                  )
                }
              >
                Approve {l.name}
              </Button>
              <Button
                onClick={() =>
                  mutate?.(
                    (s) =>
                      decide(
                        s,
                        s.jobs.find((j) => j.id === job.id)!,
                        l.id,
                        l.version,
                        "declined",
                      ),
                    "Work declined",
                  )
                }
              >
                Decline {l.name}
              </Button>
            </div>
          )}
        </div>
      ))}
      <div className="estimate-total">
        <span>Authorised estimate</span>
        <strong>{money(total(job))}</strong>
      </div>
      <small>Illustrative prices. No invoice or payment is created.</small>
      {job.limit !== null && (
        <div className="limit-note">
          Advance permission: up to {money(job.limit)} for the whole job,
          including the original service.
        </div>
      )}
    </div>
  );
}
function Billing({ job }: { job: Job }) {
  return (
    <section className="panel billing">
      <div className="section-heading">
        <h2>Billing</h2>
        <span className="tag">Prototype stub</span>
      </div>
      <div className="billing-amount">{money(total(job))}</div>
      <p>Authorised estimate. The finished product will handle billing here.</p>
      <Button disabled>Invoice and payment coming later</Button>
      <small>No money has been taken. Collection is tracked separately.</small>
    </section>
  );
}
function History({ job }: { job: Job }) {
  return (
    <section className="panel">
      <h2>Your bike’s story</h2>
      <ol className="timeline">
        {[...job.history].reverse().map((e) => (
          <li key={e.id}>
            <span className="timeline-dot" />
            <div>
              <p>{e.text}</p>
              <time>{timeLabel(e.at)}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
function Conversation({
  job,
  role,
  mutate,
}: {
  job: Job;
  role: Role;
  mutate: Mutate;
}) {
  const [text, setText] = useState("");
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>
          {role === "customer"
            ? "Talk to the workshop"
            : "Conversation with the rider"}
        </h2>
        <MessageSquare size={21} />
      </div>
      <div className="conversation">
        {!job.messages.length && (
          <p className="muted">
            A question about the repair? Keep the conversation with the bike.
          </p>
        )}
        {job.messages.map((m) => (
          <div
            key={m.id}
            className={cx(
              "bubble",
              (role === "customer") === (m.from === "customer") && "mine",
            )}
          >
            <strong>
              {m.from === "customer" ? job.customer : "The workshop"}
            </strong>
            <p>{m.text}</p>
            <small>{timeLabel(m.at)}</small>
          </div>
        ))}
      </div>
      <form
        className="message-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            mutate(
              (s) =>
                sendMessage(
                  s,
                  s.jobs.find((j) => j.id === job.id)!,
                  role,
                  text,
                ),
              "Message added to the conversation",
            )
          )
            setText("");
        }}
      >
        <label className="sr-only" htmlFor="message">
          Your message
        </label>
        <textarea
          id="message"
          required
          maxLength={2000}
          rows={2}
          placeholder={
            role === "customer"
              ? "Ask the workshop a question…"
              : "Write an update for the rider…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" tone="primary" icon={ArrowRight}>
          Send message
        </Button>
      </form>
    </section>
  );
}
function Customer({
  job,
  state,
  mutate,
  newRequest,
}: {
  job: Job;
  state: State;
  mutate: Mutate;
  newRequest: () => void;
}) {
  const [limitMode, setLimitMode] = useState(
    job.limit === null ? "each" : "limit",
  );
  const [limitValue, setLimitValue] = useState(
    String((job.limit || 15000) / 100),
  );
  useEffect(() => {
    setLimitMode(job.limit === null ? "each" : "limit");
    setLimitValue(String((job.limit || 15000) / 100));
  }, [job.id, job.limit]);
  const steps = ["Request", "In the shop", "The work", "Ready", "Collected"];
  const step =
    job.custody === "collected"
      ? 4
      : job.ready
        ? 3
        : ["working", "parts", "finished"].includes(job.work)
          ? 2
          : job.custody === "shop"
            ? 1
            : 0;
  const pending = job.lines.some((l) => l.decision === "pending");
  return (
    <div className="customer-page">
      <div className="customer-heading">
        <p className="eyebrow">{state.settings.name} · YOUR BIKE</p>
        <h1>
          Hi {job.customer.split(" ")[0]},<br />
          your bike is in the loop.
        </h1>
        <p>Everything you need to know, all in one place.</p>
      </div>
      <section className="customer-hero">
        <div>
          <Tag job={job} />
          <h2>{job.bike}</h2>
          <p>{job.service}</p>
          <span>
            {job.work === "pending"
              ? "The shop is reviewing your request. Your booking is not yet confirmed."
              : job.custody === "customer"
                ? `${job.bookingMode === "appointment" ? "Appointment" : "Drop-off"}: ${dateLabel(job.day)}${job.bookingMode === "appointment" ? ` at ${job.time}` : " between 09:00 and 17:00"}`
                : job.custody === "collected"
                  ? "Your bike has been collected. Enjoy the ride."
                  : job.ready
                    ? "Ready when you are. Collect between 09:00 and 17:00."
                    : `Estimated completion: ${dateLabel(job.expected)}`}
          </span>
        </div>
        <div className="hero-bike" aria-hidden="true">
          <Bike size={115} strokeWidth={1} />
        </div>
        <ol className="progress-steps">
          {steps.map((label, i) => (
            <li
              key={label}
              className={cx(i <= step && "done", i === step && "current")}
              aria-current={i === step ? "step" : undefined}
            >
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
      </section>
      {pending && (
        <div className="approval-banner">
          <Camera size={26} />
          <div>
            <strong>Your mechanic has something to show you.</strong>
            <p>Watch the inspection and choose the work you’d like us to do.</p>
          </div>
          <a href="#customer-inspection" className="button button-primary">
            Review inspection <ArrowRight size={17} />
          </a>
        </div>
      )}
      <div className="customer-columns">
        <div>
          <section className="panel" id="customer-inspection">
            <div className="section-heading">
              <h2>
                {job.inspection ? "See what we found" : "Your service request"}
              </h2>
              <Camera size={22} />
            </div>
            {job.inspection ? (
              <>
                <MediaGallery media={job.media} />
                <p>{job.inspection}</p>
              </>
            ) : (
              <>
                <p>{job.problem}</p>
                <MediaGallery media={job.customerMedia} />
                <p className="muted">
                  Any inspection findings will appear here before extra work
                  goes ahead.
                </p>
              </>
            )}
            <Estimate job={job} customer mutate={mutate} />
          </section>
          <Conversation
            key={job.id}
            job={job}
            role="customer"
            mutate={mutate}
          />
          <History job={job} />
        </div>
        <div>
          <section className="panel">
            <h2>You’re in control</h2>
            <p>Choose how we get permission for extra work.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  (s) =>
                    setLimit(
                      s,
                      s.jobs.find((j) => j.id === job.id)!,
                      limitMode === "each"
                        ? null
                        : Math.round(Number(limitValue) * 100),
                    ),
                  "Approval preference saved",
                );
              }}
            >
              <label className="choice">
                <input
                  type="radio"
                  name="approval-mode"
                  checked={limitMode === "each"}
                  onChange={() => setLimitMode("each")}
                  disabled={job.work === "finished"}
                />
                <span>
                  <strong>Ask me about every item</strong>
                  <small>I’ll approve or decline each proposal.</small>
                </span>
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="approval-mode"
                  checked={limitMode === "limit"}
                  onChange={() => setLimitMode("limit")}
                  disabled={job.work === "finished"}
                />
                <span>
                  <strong>Work within a spending limit</strong>
                  <small>Includes the original service and extras.</small>
                </span>
              </label>
              {limitMode === "limit" && (
                <Field label="Total spending limit (£)">
                  <input
                    required
                    type="number"
                    min={total(job) / 100}
                    step="0.01"
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                    disabled={job.work === "finished"}
                  />
                </Field>
              )}
              <p className="footnote">
                Changes apply to future proposals. Existing approvals stay
                valid; pending items above still need your choice.
              </p>
              <Button type="submit" disabled={job.work === "finished"}>
                Save approval preference
              </Button>
            </form>
          </section>
          <Preferences job={job} mutate={mutate} />
          <section className="panel">
            <h2>Your progress link</h2>
            <p>No account or password needed.</p>
            <a className="button" href={`#track=${job.token}`}>
              <Link2 size={17} />
              Open progress link
            </a>
            <small className="block muted">
              Demo links work in this tab’s current session. Refreshing starts a
              fresh demo.
            </small>
          </section>
          {job.work === "finished" && <Billing job={job} />}
          <Button icon={Plus} onClick={newRequest}>
            Request work on another bike
          </Button>
        </div>
      </div>
    </div>
  );
}
function Preferences({ job, mutate }: { job: Job; mutate: Mutate }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Your updates</h2>
        <Bell size={20} />
      </div>
      <p>We’ll keep you posted about the things that matter to you.</p>
      <fieldset>
        <legend>What would you like to hear?</legend>
        {(Object.entries(EVENT_NAMES) as [EventKind, string][]).map(
          ([event, label]) => (
            <label className="check-row" key={event}>
              <input
                type="checkbox"
                checked={job.preferences.events.includes(event)}
                onChange={(e) =>
                  mutate((s) => {
                    const p = s.jobs.find((j) => j.id === job.id)!.preferences;
                    p.events = e.target.checked
                      ? [...p.events, event]
                      : p.events.filter((v) => v !== event);
                  }, "Update preferences saved")
                }
              />
              {label}
            </label>
          ),
        )}
      </fieldset>
      <fieldset>
        <legend>Where should updates appear?</legend>
        {(["WhatsApp", "Email", "SMS"] as Channel[]).map((channel) => (
          <label className="check-row" key={channel}>
            <input
              type="checkbox"
              checked={job.preferences.channels.includes(channel)}
              onChange={(e) =>
                mutate((s) => {
                  const p = s.jobs.find((j) => j.id === job.id)!.preferences;
                  p.channels = e.target.checked
                    ? [...p.channels, channel]
                    : p.channels.filter((c) => c !== channel);
                }, "Channel preferences saved")
              }
            />
            {channel}
          </label>
        ))}
      </fieldset>
      {(!job.preferences.channels.length || !job.preferences.events.length) && (
        <p className="notice">
          Updates are off. Check your progress link for approvals and changes.
        </p>
      )}
      <small className="muted">
        Messages appear in the demo inbox. You can always check this page, even
        with updates off.
      </small>
    </section>
  );
}
function ShopSettings({ state, mutate }: { state: State; mutate: Mutate }) {
  const settings = state.settings;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR SHOP, YOUR WAY</p>
          <h1>Make the workflow fit.</h1>
          <p>
            Try the options with a new service request. Existing bookings keep
            their agreed mode and time.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Booking model</h2>
          <p>What does a customer reserve?</p>
          {(
            [
              [
                "appointment",
                "Exact appointments",
                "Customers choose a time. Work reserves a continuous slot.",
              ],
              [
                "dropoff",
                "Day-based drop-offs",
                "Customers choose a day. Plan the work within that day.",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <label className="choice" key={value}>
              <input
                type="radio"
                name="booking"
                checked={settings.booking === value}
                onChange={() =>
                  mutate((s) => {
                    s.settings.booking = value;
                  }, "Booking model saved for new requests")
                }
              />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>Request acceptance</h2>
          <p>When is the customer’s booking confirmed?</p>
          {(
            [
              [
                "auto",
                "Automatically",
                "Confirm when there is workshop capacity.",
              ],
              [
                "review",
                "After shop review",
                "Hold the capacity until the shop confirms or replans.",
              ],
              [
                "service",
                "Depends on the service",
                "Use different rules for familiar jobs and unknown problems.",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <label className="choice" key={value}>
              <input
                type="radio"
                name="acceptance"
                checked={settings.acceptance === value}
                onChange={() =>
                  mutate((s) => {
                    s.settings.acceptance = value;
                  }, "Acceptance mode saved")
                }
              />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
          {settings.acceptance === "service" &&
            SERVICES.map((service) => (
              <Field label={service.name} key={service.name}>
                <select
                  value={settings.serviceRules[service.name]}
                  onChange={(e) =>
                    mutate((s) => {
                      s.settings.serviceRules[service.name] = e.target.value as
                        "auto" | "review";
                    }, "Service rule saved")
                  }
                >
                  <option value="auto">Automatically confirm</option>
                  <option value="review">Shop reviews first</option>
                </select>
              </Field>
            ))}
        </section>
        <section className="panel">
          <h2>Who takes the work?</h2>
          <p>Try individual responsibility or a shared work queue.</p>
          {(
            [
              [
                "assigned",
                "Assign to mechanics",
                "New requests go to the first available mechanic. Reassign in the job.",
              ],
              [
                "queue",
                "Shared queue",
                "Leave new work unassigned until a mechanic picks it up.",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <label className="choice" key={value}>
              <input
                type="radio"
                name="allocation"
                checked={settings.allocation === value}
                onChange={() =>
                  mutate((s) => {
                    s.settings.allocation = value;
                  }, "Allocation saved for new requests")
                }
              />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>The demo’s starting rules</h2>
          <ul className="rules">
            <li>The shop works 09:00–17:00, with eight hours per mechanic.</li>
            <li>Unknown repairs initially reserve one hour for diagnosis.</li>
            <li>
              Pending review holds capacity; it does not expire automatically.
            </li>
            <li>Original prices and planned minutes are independent.</li>
            <li>
              New customers get key updates through simulated WhatsApp, with
              routine progress off.
            </li>
          </ul>
          <p className="muted">
            These are explicit prototype defaults to challenge during
            observation.
          </p>
        </section>
      </div>
    </>
  );
}
function RequestForm({
  state,
  onSubmit,
}: {
  state: State;
  onSubmit: (job: Partial<Job>) => void;
}) {
  const [service, setService] = useState(SERVICES[2].name);
  const [media, setMedia] = useState<Media[]>([]);
  const [approval, setApproval] = useState("each");
  const rule =
    state.settings.acceptance === "service"
      ? state.settings.serviceRules[service]
      : state.settings.acceptance;
  const base = SERVICES.find((s) => s.name === service)!;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          customer: String(f.get("customer")),
          bike: String(f.get("bike")),
          service,
          problem: String(f.get("problem")),
          day: String(f.get("day")),
          time: String(f.get("time") || "09:00"),
          expected: String(f.get("day")),
          customerMedia: media,
          limit:
            approval === "limit"
              ? Math.round(Number(f.get("limit")) * 100)
              : null,
        });
      }}
    >
      <p>Tell us what’s happening. You don’t need to know the fix.</p>
      <div className="form-grid">
        <Field label="Your name">
          <input
            name="customer"
            required
            maxLength={80}
            placeholder="e.g. Taylor Reed"
            autoComplete="off"
          />
        </Field>
        <Field label="Your bike">
          <input
            name="bike"
            required
            maxLength={100}
            list="bike-models"
            placeholder="Make and model"
            autoComplete="off"
          />
          <datalist id="bike-models">
            {BIKES.map((b) => (
              <option key={b.name}>{b.name}</option>
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="What can we help with?">
        <select value={service} onChange={(e) => setService(e.target.value)}>
          {SERVICES.map((s) => (
            <option key={s.name}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Tell us about the problem">
        <textarea
          name="problem"
          required
          maxLength={3000}
          rows={3}
          placeholder="When does it happen? What would you like us to look at?"
        />
      </Field>
      <MediaInput value={media} onChange={setMedia} />
      <div className="form-grid">
        <Field
          label={
            state.settings.booking === "appointment"
              ? "Appointment day"
              : "Drop-off day"
          }
        >
          <input
            type="date"
            name="day"
            required
            min={dayOf(state.now)}
            defaultValue={dayOf(state.now)}
          />
        </Field>
        {state.settings.booking === "appointment" && (
          <Field label="Appointment time">
            <input
              type="time"
              name="time"
              required
              defaultValue="10:00"
              min="09:00"
              max="16:00"
              step="900"
            />
          </Field>
        )}
      </div>
      <div className="notice">
        <CalendarDays size={18} />
        <span>
          {state.settings.booking === "dropoff"
            ? "Drop off between 09:00 and 17:00. This is not a fixed work start time."
            : `${base.minutes} minutes reserved for this service.`}{" "}
          {rule === "review"
            ? "The shop will review your request before confirming."
            : "Your booking is confirmed automatically if there is capacity."}
        </span>
      </div>
      <fieldset>
        <legend>Permission for extra work</legend>
        <label className="check-row">
          <input
            type="radio"
            name="permission"
            checked={approval === "each"}
            onChange={() => setApproval("each")}
          />
          Ask me to approve each item
        </label>
        <label className="check-row">
          <input
            type="radio"
            name="permission"
            checked={approval === "limit"}
            onChange={() => setApproval("limit")}
          />
          Authorise work within a total spending limit
        </label>
        {approval === "limit" && (
          <Field
            label="Total spending limit (£)"
            hint="Includes the original service and any extra work."
          >
            <input
              name="limit"
              type="number"
              min={base.amount / 100}
              step="0.01"
              defaultValue="150"
              required
            />
          </Field>
        )}
      </fieldset>
      <div className="estimate-total">
        <span>Original estimate</span>
        <strong>
          {money(base.amount)}
          {base.amount === 0 ? " · diagnosis first" : ""}
        </strong>
      </div>
      <p className="footnote">
        No account needed. You’ll get a progress link in this session.
        Notifications and billing are simulated.
      </p>
      <div className="actions">
        <Button type="submit" tone="primary" icon={ArrowRight}>
          Send service request
        </Button>
      </div>
    </form>
  );
}
function ScenarioForm({
  scenario,
  onSubmit,
}: {
  scenario: State["scenarios"][number];
  onSubmit: (
    name: string,
    desc: string,
    overwrite: boolean,
    blank: boolean,
  ) => void;
}) {
  const [mode, setMode] = useState("copy");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit(
          String(f.get("name")),
          String(f.get("description")),
          mode === "replace",
          mode === "blank",
        );
      }}
    >
      <p>
        Save a starting point for the next walkthrough. Scenarios stay in this
        browser session.
      </p>
      <Field label="Scenario name">
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={`${scenario.name} · my version`}
        />
      </Field>
      <Field label="What should this scenario explore?">
        <textarea
          name="description"
          maxLength={400}
          rows={3}
          defaultValue={scenario.description}
        />
      </Field>
      <Field label="Starting point">
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="copy">
            Save current bikes and settings as a new scenario
          </option>
          <option value="replace">
            Replace this scenario’s saved starting point
          </option>
          <option value="blank">Start empty, keeping the shop settings</option>
        </select>
      </Field>
      <p className="footnote">
        To change the jobs, close this dialog, edit them in the workshop, then
        save your starting point here.
      </p>
      <div className="actions">
        <Button type="submit" tone="primary">
          Save scenario
        </Button>
      </div>
    </form>
  );
}
function InspectionForm({
  job,
  onSubmit,
}: {
  job: Job;
  onSubmit: (
    items: { name: string; amount: number }[],
    note: string,
    media: Media[],
  ) => void;
}) {
  const pending = job.lines.filter((l) => l.decision === "pending");
  const [items, setItems] = useState(
    pending.length
      ? pending.map((l) => ({
          name: l.name,
          price: (l.amount / 100).toFixed(2),
        }))
      : [
          { name: "Replace front brake pads", price: "28.00" },
          { name: "Adjust gears and cable tension", price: "18.00" },
          { name: "Replace worn handlebar tape", price: "24.00" },
        ],
  );
  const [media, setMedia] = useState<Media[]>(job.media);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit(
          items.map((l) => ({
            name: l.name,
            amount: Math.round(Number(l.price) * 100),
          })),
          String(f.get("note")),
          media,
        );
      }}
    >
      <Field label="Explain what you found">
        <textarea
          name="note"
          required
          maxLength={3000}
          rows={3}
          defaultValue={
            job.inspection ||
            "The front brake pads show wear. I recommend replacing them, then adjusting the gears. Please choose the work you would like us to do."
          }
        />
      </Field>
      <MediaInput value={media} onChange={setMedia} videoOnly />
      <Button icon={Play} onClick={() => setMedia([{ ...SAMPLE_MEDIA }])}>
        Use sample inspection video
      </Button>
      <p className="footnote">
        The sample is an illustrative animation, not an inspection of a real
        bike. You can replace it with a mechanic’s recording.
      </p>
      <h3>Proposed extra work</h3>
      {items.map((item, i) => (
        <div className="proposal-input" key={i}>
          <Field label={`Item ${i + 1}`}>
            <input
              required
              maxLength={160}
              value={item.name}
              onChange={(e) =>
                setItems(
                  items.map((l, n) =>
                    n === i ? { ...l, name: e.target.value } : l,
                  ),
                )
              }
            />
          </Field>
          <Field label="Estimate (£)">
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={item.price}
              onChange={(e) =>
                setItems(
                  items.map((l, n) =>
                    n === i ? { ...l, price: e.target.value } : l,
                  ),
                )
              }
            />
          </Field>
          <Button
            icon={X}
            aria-label={`Remove item ${i + 1}`}
            onClick={() => setItems(items.filter((_, n) => n !== i))}
          />
        </div>
      ))}
      <Button
        icon={Plus}
        onClick={() => setItems([...items, { name: "", price: "0.00" }])}
      >
        Add another item
      </Button>
      {job.lines.length > 0 && (
        <p className="notice">
          This replaces unresolved proposals with a new version. Previously
          approved or declined items keep their recorded decisions and amounts.
        </p>
      )}
      <div className="actions">
        <Button type="submit" tone="primary" disabled={!items.length}>
          Share inspection and estimate
        </Button>
      </div>
    </form>
  );
}
function DelayForm({
  state,
  job,
  onSubmit,
}: {
  state: State;
  job: Job;
  onSubmit: (expected: string, hours: number, reason: string) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit(
          String(f.get("expected")),
          Number(f.get("hours")),
          String(f.get("reason")),
        );
      }}
    >
      <Field label="What are we waiting for?">
        <textarea
          name="reason"
          required
          maxLength={1000}
          rows={3}
          defaultValue="We’re waiting for a replacement brake part. We’ll let you know when work resumes."
        />
      </Field>
      <div className="form-grid">
        <Field label="Revised completion estimate">
          <input
            type="date"
            name="expected"
            required
            min={dayOf(state.now)}
            defaultValue={
              job.expected >= dayOf(state.now)
                ? job.expected
                : dayOf(state.now + 86400000)
            }
          />
        </Field>
        <Field label="Part arrives in (demo hours)">
          <input
            type="number"
            name="hours"
            required
            min="1"
            max="720"
            defaultValue="24"
          />
        </Field>
      </div>
      <p className="footnote">
        The simulator marks the part as arrived when its clock reaches the
        delivery time. A mechanic then resumes work.
      </p>
      <div className="actions">
        <Button tone="primary" type="submit">
          Update the rider
        </Button>
      </div>
    </form>
  );
}
function ScheduleForm({
  state,
  job,
  onSubmit,
}: {
  state: State;
  job: Job;
  onSubmit: (
    patch: Partial<Pick<Job, "day" | "time" | "minutes" | "mechanic">>,
  ) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          day: String(f.get("day")),
          time: String(f.get("time") || job.time),
          minutes: Number(f.get("minutes")),
          mechanic: String(f.get("mechanic")),
        });
      }}
    >
      <p>
        {job.bookingMode === "appointment"
          ? "This bike has an exact appointment."
          : "This bike is booked as a day drop-off."}{" "}
        Changing the schedule sends a simulated update when the customer has
        booking updates enabled.
      </p>
      <div className="form-grid">
        <Field label="Work day">
          <input
            name="day"
            type="date"
            required
            min={dayOf(state.now)}
            defaultValue={job.day}
          />
        </Field>
        {job.bookingMode === "appointment" && (
          <Field label="Start time">
            <input name="time" type="time" required defaultValue={job.time} />
          </Field>
        )}
        <Field label="Planned work (minutes)">
          <input
            name="minutes"
            type="number"
            required
            min="15"
            max="480"
            step="15"
            defaultValue={job.minutes}
          />
        </Field>
        <Field label="Assigned mechanic">
          <select name="mechanic" defaultValue={job.mechanic}>
            <option value="">Shared queue</option>
            {MECHANICS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="footnote">
        Changing planned time does not change the agreed price.
      </p>
      <div className="actions">
        <Button type="submit" tone="primary">
          Save schedule
        </Button>
      </div>
    </form>
  );
}
window.addEventListener("pagehide", releaseMedia);
createRoot(document.getElementById("root")!).render(<App />);
