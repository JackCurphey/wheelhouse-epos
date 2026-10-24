import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { STATE_LABEL, diaryState, shortDay } from '@/screens/diary/rules.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { NavIcon } from './nav-icon.tsx';
import { ROUTES } from './routes.ts';

/**
 * The header search (drawn as staff-search, app-map.mjs; the header's box and
 * button, diary.mjs; app map review 2; Jack, 24 Oct, answer 7;
 * openspec/changes/header-search): jobs and customers from any staff page.
 * Results are a labelled list of links, grouped as drawn, not a list of
 * options (design 2). A box in the header on a computer; on a tablet or a
 * phone a button that opens the box and its results over the page.
 */
type Job = { id: number; reference: string; title: string; jobDate: string | null; bookingState: string; custodyState: string; workState: string; customerName: string | null; bikeLabel: string | null };
type Customer = { id: number; name: string; phone: string | null };
type Found = { jobs: Job[]; customers: Customer[] };
const LABEL = 'Search jobs and customers';

/** What was typed, once typing has paused (250 ms). */
function useSettled(value: string, ms = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

function useSearch(typed: string) {
  const q = useSettled(typed.trim());
  const found = useQuery({ queryKey: ['search', q], queryFn: () => apiGet<Found>(`/api/search?q=${encodeURIComponent(q)}`), enabled: q.length >= 2 });
  return { q, found: q.length >= 2 ? found.data ?? null : null, failed: q.length >= 2 && found.isError };
}

// "Trek Domane AL 3 · Standard service · Expected · Thu 17 Sep": the bike, the job, its stage and day (walk-through 9 H1).
function jobLine(j: Job) {
  const state = diaryState({ bookingState: j.bookingState, workState: j.workState });
  return [j.bikeLabel, j.title, state === 'hidden' ? null : STATE_LABEL[state], j.jobDate ? shortDay(j.jobDate) : null].filter(Boolean).join(' · ');
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-1">
      <div aria-hidden="true" className="px-3 text-xs font-bold tracking-[0.8px] text-[var(--wh-muted)] uppercase">{title}</div>
      <ul role="list" className="m-0 flex list-none flex-col p-0">{children}</ul>
    </div>
  );
}

function Row({ to, main, sub, onPick }: { to: string; main: React.ReactNode; sub: string; onPick: () => void }) {
  return (
    <li className="flex min-h-[52px] flex-col justify-center gap-0.5 rounded-lg px-3 py-1.5 hover:bg-[var(--wh-hover)]">
      <Link to={to} onClick={onPick} className="self-start text-size-15 font-semibold text-[var(--wh-ink)] no-underline hover:underline">{main}</Link>
      <span className="text-size-13 text-[var(--wh-muted)]">{sub}</span>
    </li>
  );
}

// What the search found, in words: said by the one status line that's always there (review).
function said(q: string, found: Found | null, failed: boolean) {
  if (failed) return 'Wheelhouse couldn’t search just now. Try again in a moment.';
  if (!found) return '';
  const count = found.jobs.length + found.customers.length;
  return count ? `${count} result${count === 1 ? '' : 's'}` : `Nothing matches “${q}”`;
}

function Results({ q, found, onPick }: { q: string; found: Found; onPick: () => void }) {
  const count = found.jobs.length + found.customers.length;
  const none = `Nothing matches “${q}”`;
  return (
    <>
      <section aria-label="Search results" className="flex flex-col gap-3 bg-[var(--wh-panel)] px-2 py-2.5">
        {count === 0 ? <p className="m-0 px-3 py-1.5 text-sm text-[var(--wh-muted)]">{none}</p> : null}
        {found.jobs.length ? (
          <Group title="Jobs">
            {found.jobs.map((j) => (
              <Row key={j.id} to={`${ROUTES.diary}?job=${j.id}`} onPick={onPick} main={`${j.reference} · ${j.customerName ?? 'No customer'}`} sub={jobLine(j)} />
            ))}
          </Group>
        ) : null}
        {found.customers.length ? (
          <Group title="Customers">
            {found.customers.map((c) => (
              <Row key={c.id} to={`${ROUTES.customers}/${c.id}`} onPick={onPick} main={c.name} sub={c.phone ? `Customer · ${c.phone}` : 'Customer'} />
            ))}
          </Group>
        ) : null}
      </section>
    </>
  );
}

function SearchBox({ value, onChange, onEscape, inputRef, big = false }: { value: string; onChange: (v: string) => void; onEscape: () => void; inputRef?: React.Ref<HTMLInputElement>; big?: boolean }) {
  return (
    <label className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-[var(--wh-input-border)] bg-[var(--wh-panel)] px-3 text-[var(--wh-muted)] focus-within:border-[var(--wh-ink)] ${big ? 'grow' : 'w-80'}`}>
      <NavIcon name="search" size={16} />
      <input
        ref={inputRef}
        type="search"
        aria-label={LABEL}
        placeholder={LABEL}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onEscape(); } }}
        className={`min-w-0 grow border-0 bg-transparent text-[var(--wh-ink)] outline-none ${big ? 'text-base' : 'text-sm'}`}
      />
    </label>
  );
}

export function HeaderSearch() {
  const narrow = useMedia('(max-width: 1023px)');
  const isPhone = useMedia('(max-width: 767px)');
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const { q, found, failed } = useSearch(typed);
  const status = <span role="status" data-search-status="" className="sr-only">{said(q, found, failed)}</span>;
  const failedLine = failed ? <p role="alert" className="m-0 bg-[var(--wh-panel)] px-5 py-3 text-sm">Wheelhouse couldn’t search just now. Try again in a moment.</p> : null;
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  // Over the page it holds the keyboard: Tab goes round its own box, links and Close (review); Escape shuts it.
  const keepFocusIn = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab' || !sheet.current) return;
    const stops = [...sheet.current.querySelectorAll<HTMLElement>('input, a[href], button')];
    const [first, last] = [stops[0], stops[stops.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const clear = () => setTyped('');
  const close = () => { setOpen(false); setTyped(''); button.current?.focus(); };
  useEffect(() => { if (open) sheetInput.current?.focus(); }, [open]);
  // A click elsewhere on the page puts the computer's results away.
  useEffect(() => {
    if (narrow || !typed) return undefined;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) clear(); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [narrow, typed]);

  if (!narrow) {
    return (
      <div ref={wrap} className="relative hidden shrink-0 md:block">
        <SearchBox value={typed} onChange={setTyped} onEscape={clear} />
        {status}
        {failed ? <div className="absolute top-[calc(100%+6px)] right-0 z-50 w-[460px] overflow-hidden rounded-[10px] border border-[var(--wh-border)]">{failedLine}</div> : null}
        {found ? (
          <div className="absolute top-[calc(100%+6px)] right-0 z-50 w-[460px] overflow-hidden rounded-[10px] border border-[var(--wh-border)] shadow-[0_12px_32px_var(--wh-backdrop)]">
            <Results q={q} found={found} onPick={clear} />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <>
      {status}
      <button ref={button} type="button" aria-label={LABEL} aria-expanded={open} onClick={() => setOpen(true)}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] md:text-[var(--wh-ink)] md:hover:bg-[var(--wh-hover)]">
        <NavIcon name="search" size={20} />
      </button>
      {open ? (
        <>
          {/* Tapping the page shuts it: dimmed on a phone, clear on a tablet (review). */}
          <div aria-hidden="true" onClick={close} className={`fixed inset-0 z-40 ${isPhone ? 'bg-[var(--wh-backdrop)]' : ''}`} />
          <div ref={sheet} role="dialog" aria-modal="true" aria-label="Search" onKeyDown={keepFocusIn}
            className={`fixed z-50 flex flex-col bg-[var(--wh-panel)] text-[var(--wh-ink)] shadow-[0_12px_32px_var(--wh-backdrop)] ${isPhone ? 'inset-x-0 top-0 rounded-b-[14px] pb-1.5' : 'top-14 right-[22px] w-[480px] rounded-[10px] border border-[var(--wh-border)]'}`}>
            <div className="flex items-center gap-2 px-2.5 pt-2.5">
              <SearchBox big value={typed} onChange={setTyped} onEscape={close} inputRef={sheetInput} />
              <button type="button" onClick={close} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold">Close search</button>
            </div>
            {failedLine}
            {found ? <Results q={q} found={found} onPick={close} /> : null}
          </div>
        </>
      ) : null}
    </>
  );
}
