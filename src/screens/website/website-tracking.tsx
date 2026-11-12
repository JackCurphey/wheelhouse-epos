import { useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, TriangleAlert } from 'lucide-react';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Input } from '@/components/ui/input';
import { RowSwitch } from '@/screens/settings/row-switch.tsx';
import { Page } from '@/screens/reports/reports-bits.tsx';
import type { Tool, WebsiteState } from './website-types.ts';

/** The tools customers' browsers would load once published: on, with a right ID. */
export const liveTools = (tracking: Tool[]) => tracking.filter((t) => t.on && !t.waiting);

/**
 * Website › Tracking tools (openspec/changes/website-management, task 4.4;
 * the drawings ws-tracking, ws-tracking-on and ws-tracking-error in
 * docs/design/user-journeys/generator/website.mjs, lines 399-411). Each change
 * saves to the draft; nothing goes live until the website is published.
 */
export function TrackingTools({ state, onState, onBack, onEditPrivacy }: {
  state: WebsiteState;
  onState: (next: WebsiteState) => void;
  onBack: () => void;
  onEditPrivacy: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [toast, setToast] = useState<Tool | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>({});
  // One save at a time, in the order made: leaving the ID box by pressing
  // the switch sends the ID first, then the switch.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // The ID being sent per tool, so Enter then leaving the box saves it once.
  const sending = useRef<Record<string, string>>({});

  function save(tool: Tool, body: { on: boolean; id?: string }): Promise<boolean> {
    const next = queue.current.then(() => sendSave(tool, body));
    queue.current = next;
    return next;
  }
  async function sendSave(tool: Tool, body: { on: boolean; id?: string }) {
    setBusy(tool.tool);
    setProblem(null);
    try {
      const next = await apiMutate<WebsiteState>(`/api/website/tracking/${tool.tool}`, body, { method: 'PUT' });
      onState(next);
      return true;
    } catch (err) {
      setProblem(serverSaid(err) ? err.message : 'Wheelhouse couldn’t do that. Try again.');
      return false;
    } finally {
      setBusy(null);
    }
  }
  async function switchTo(tool: Tool, on: boolean) {
    setToast(null);
    if (await save(tool, { on }) && on) setToast(tool);
  }
  // What was typed stays in the box until the server has it.
  function saveId(tool: Tool) {
    const id = typed[tool.tool]?.trim();
    if (id === undefined || id === tool.id || sending.current[tool.tool] === id) return;
    sending.current[tool.tool] = id;
    void save(tool, { on: tool.on, id }).then((saved) => {
      delete sending.current[tool.tool];
      if (saved) setTyped((now) => {
        const rest = { ...now };
        delete rest[tool.tool];
        return rest;
      });
    });
  }

  // On but not usable yet, with no ID or a wrong one: nothing loads for it.
  const waiting = state.tracking.filter((t) => t.on && t.waiting);
  const live = liveTools(state.tracking);
  const names = (list: Tool[]) => list.map((t) => t.name).join(', ');
  const kinds = [...new Set(live.map((t) => `“${t.kind}”`))].join(' or ');

  return (
    <Page>
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold">
        <ChevronLeft aria-hidden="true" className="size-4" />Website
      </button>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-size-17 font-bold">Tracking tools</h2>
        <p className="m-0 text-sm text-[var(--wh-muted)]">Tools that show how people use your website, or help with adverts. Like everything else, they go live when you publish.</p>
      </div>
      {problem ? <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-sm font-semibold">{problem}</p> : null}

      {waiting.length ? (
        <Note tone="warn">{`${names(waiting)} ${waiting.length === 1 ? 'needs' : 'need'} a correct ID before ${waiting.length === 1 ? 'it' : 'they'} can be used.`}</Note>
      ) : null}
      {live.length ? (
        <>
          <Note tone="ok"><strong>When you publish, your website will ask customers about cookies.</strong>{` ${names(live)} only ${live.length === 1 ? 'loads' : 'load'} for customers who say yes to ${kinds}. Every page’s footer gains “Cookie choices”.`}</Note>
          <Note tone="warn">
            {'Check your '}<strong>Cookies</strong>{' and '}
            <button type="button" onClick={onEditPrivacy} className="cursor-pointer border-0 bg-transparent p-0 font-bold text-inherit underline">Privacy</button>
            {` pages — they should name ${names(live)}.`}
          </Note>
        </>
      ) : !waiting.length ? (
        <Note tone="grey">With no tools on, your website only uses the cookies it needs to work — so customers get no cookie choice.</Note>
      ) : null}

      <ul aria-label="Tracking tools" className="m-0 flex list-none flex-col overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0">
        {state.tracking.map((t) => (
          <ToolRow key={t.tool} tool={t} busy={busy === t.tool} value={typed[t.tool] ?? t.id}
            onSwitch={(next) => void switchTo(t, next)}
            onType={(value) => setTyped((now) => ({ ...now, [t.tool]: value }))}
            onDone={() => saveId(t)} />
        ))}
      </ul>
      <p className="m-0 text-sm text-[var(--wh-muted)]">Each tool is marked Statistics or Marketing, so the cookie choice asks customers the right question. No tool loads until a customer agrees. Switching a tool off keeps its ID.</p>

      <div role="status">
        {toast ? (
          <div className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-[10px] bg-[var(--wh-ink)] py-1.5 pr-1.5 pl-4 text-sm whitespace-nowrap text-[var(--wh-on-brand)] shadow-[var(--wh-shadow-note)] max-md:whitespace-normal max-md:right-3 max-md:bottom-3 max-md:left-3 max-md:translate-x-0">
            <Check aria-hidden="true" size={16} />
            <span className="grow pr-1.5">{`${toast.name} on · goes live when you publish`}</span>
            <button type="button" disabled={busy !== null} onClick={() => { const undo = toast; setToast(null); void save(undo, { on: false }); }}
              className="min-h-11 cursor-pointer rounded-[8px] border-0 bg-[var(--wh-on-ink-tint)] px-3.5 text-sm font-bold whitespace-nowrap text-[var(--wh-on-brand)]">Undo</button>
          </div>
        ) : null}
      </div>
    </Page>
  );
}

/** website.mjs `toolRow`: the name, its kind, the switch; when on, its ID. */
function ToolRow({ tool, busy, value, onSwitch, onType, onDone }: {
  tool: Tool; busy: boolean; value: string;
  onSwitch: (on: boolean) => void; onType: (value: string) => void; onDone: () => void;
}) {
  const box = useId();
  const said = useId();
  const marketing = tool.kind === 'Marketing';
  return (
    <li className="flex flex-col gap-2.5 border-t border-[var(--wh-border)] px-[18px] py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        <span className="flex grow flex-col gap-1">
          <span className="text-base font-bold">{tool.name}</span>
          <span><span className={`rounded-full px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap ${marketing ? 'bg-[var(--wh-state-pending-bg)] text-[var(--wh-state-pending-ink)]' : 'bg-[var(--wh-state-scheduled-bg)] text-[var(--wh-state-scheduled-ink)]'}`}>{tool.kind}</span></span>
        </span>
        <span className="w-[180px] shrink-0 max-md:w-[110px]"><RowSwitch label={tool.name} hideLabel on={tool.on} disabled={busy} onChange={onSwitch} /></span>
      </div>
      {tool.on ? (
        <>
          <div className="flex max-w-[440px] flex-col gap-1.5">
            <label htmlFor={box} className="text-sm font-semibold">{`Your ${tool.name} ID`}</label>
            <Input id={box} value={value} placeholder="[ID from the tool]" aria-describedby={said} aria-invalid={tool.idProblem ? true : undefined}
              onChange={(e) => onType(e.target.value)} onBlur={onDone} onKeyDown={(e) => { if (e.key === 'Enter') onDone(); }} />
            <span id={said} className={`text-size-13 ${tool.idProblem ? 'text-[var(--wh-danger)]' : 'text-[var(--wh-muted)]'}`}>{tool.idProblem ?? tool.idHelp}</span>
          </div>
          {tool.waiting ? <p className="m-0 text-sm text-[var(--wh-muted)]">Waiting for a correct ID — until then, no cookie choice and nothing loads.</p> : null}
        </>
      ) : null}
    </li>
  );
}

/**
 * website.mjs `msg`: a line in green, amber or grey; `bad` looks amber but,
 * when `live`, is said at once (role alert) where the others are a status.
 */
export function Note({ tone, live = false, children }: { tone: 'ok' | 'warn' | 'bad' | 'grey'; live?: boolean; children: ReactNode }) {
  const amber = tone === 'warn' || tone === 'bad';
  const look = tone === 'ok' ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-state-ready-ink)]' : amber ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-ink)]';
  return (
    <p role={live ? (tone === 'bad' ? 'alert' : 'status') : undefined} className={`m-0 flex items-start gap-2 rounded-[8px] px-3 py-2.5 text-size-15 leading-[1.45] ${look}`}>
      <span aria-hidden="true" className="mt-0.5 shrink-0">{amber ? <TriangleAlert size={18} /> : tone === 'ok' ? <Check size={18} /> : <NavIcon name="website" size={18} />}</span>
      <span>{children}</span>
    </p>
  );
}
