import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/staff/routes.ts';

/**
 * The Settings frame (WP-1.3; drawn in docs/design/user-journeys/generator/settings-frame.mjs,
 * Owner setup decisions 3, 17 and 21): the rooms down the left, each room's
 * page with its areas, "Jump to" when a room has more than one, and each
 * area's settings as folding sections with a one-line summary. On a phone,
 * Settings opens on the list of rooms and each room is its own page with
 * "‹ Settings" back. Only what works is shown (stage 1 drawing gaps
 * decision 6): a room or area appears once something in it is built.
 *
 * A room opens with its first fold open ("one section open", decision 17);
 * each fold then opens and closes on its own.
 */
export type SettingsFold = { key: string; title: string; summary: ReactNode; body: ReactNode };
export type SettingsArea = { key: string; title: string; intro: string; folds: SettingsFold[] };
export type SettingsRoom = { key: string; name: string; intro: string; areas: SettingsArea[] };

const roomHref = (key: string) => `${ROUTES.settings}?room=${key}`;
// The phone list's line under each room: what's in it.
const roomLine = (room: SettingsRoom) => {
  const titles = room.areas.length > 1 ? room.areas.map((a) => a.title) : room.areas[0]?.folds.map((f) => f.title) ?? [];
  return titles.map((t, i) => (i === 0 ? t : t.charAt(0).toLowerCase() + t.slice(1))).join(', ');
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`shrink-0 text-[var(--wh-muted)] ${open ? 'rotate-180' : ''}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Fold({ fold, open, onToggle, level }: { fold: SettingsFold; open: boolean; onToggle: () => void; level: 3 | 4 }) {
  // Once opened, a fold's settings stay in place while it's closed (hidden), so
  // what was typed, a failed save's words and a save on its way aren't lost.
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  const Heading = level === 3 ? 'h3' : 'h4';
  const panel = `set-fold-${fold.key}`;
  return (
    <div className="border-t border-[var(--wh-border)] first:border-t-0">
      <Heading className="m-0 text-[length:inherit] font-[number:inherit]">
        <button
          type="button" aria-expanded={open} aria-controls={panel} onClick={onToggle}
          className="flex min-h-14 w-full items-center gap-3.5 px-[18px] py-2 text-left max-md:px-3.5"
        >
          <span className="flex min-w-0 grow flex-col gap-0.5 md:flex-row md:items-center md:gap-3.5">
            <span className="grow text-base font-bold">{fold.title}</span>
            <span className="text-size-13 text-[var(--wh-muted)] md:text-right">{fold.summary}</span>
          </span>
          <Chevron open={open} />
        </button>
      </Heading>
      <div id={panel} hidden={!open} className="flex flex-col gap-3 px-[18px] pb-[18px] max-md:px-3.5 max-md:pb-3.5">
        {opened ? fold.body : null}
      </div>
    </div>
  );
}

function RoomPage({ room, fold }: { room: SettingsRoom; fold: string | null }) {
  const many = room.areas.length > 1;
  // The fold a link names (?fold=, "edit it in Messages" on cp-setting), else the room's first.
  const named = room.areas.some((a) => a.folds.some((f) => f.key === fold)) ? fold : null;
  const first = named ?? room.areas[0]?.folds[0]?.key;
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(first ? [first] : []));
  const toggle = (key: string) => setOpen((was) => {
    const next = new Set(was);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const folds = (area: SettingsArea) => (
    <div className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
      {area.folds.map((f) => <Fold key={f.key} fold={f} open={open.has(f.key)} onToggle={() => toggle(f.key)} level={many ? 4 : 3} />)}
    </div>
  );
  return (
    <div className="flex min-w-0 grow flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-size-22 font-bold max-md:text-xl">{room.name}</h2>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{many ? room.intro : room.areas[0]?.intro}</p>
      </div>
      {many ? (
        <nav aria-label="Jump to" className="flex flex-wrap gap-2">
          {room.areas.map((a) => (
            <a key={a.key} href={`#set-${a.key}`} className="inline-flex min-h-11 items-center rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 text-sm font-semibold">{a.title}</a>
          ))}
        </nav>
      ) : null}
      {room.areas.map((a) => (many ? (
        <section key={a.key} aria-labelledby={`set-${a.key}`} className="flex shrink-0 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h3 id={`set-${a.key}`} className="m-0 text-lg font-bold">{a.title}</h3>
            <p className="m-0 text-sm text-[var(--wh-muted)]">{a.intro}</p>
          </div>
          {folds(a)}
        </section>
      ) : <div key={a.key}>{folds(a)}</div>))}
    </div>
  );
}

export function SettingsFrame({ rooms }: { rooms: SettingsRoom[] }) {
  const [params] = useSearchParams();
  const asked = rooms.find((r) => r.key === params.get('room'));
  // A computer opens on the first room; a phone on the list of rooms.
  const room = asked ?? rooms[0];
  if (!room) return null;
  return (
    <div className="mx-auto flex w-full max-w-[1040px] gap-6 p-5 max-md:p-4">
      <nav aria-label="Settings" className="hidden w-[190px] shrink-0 flex-col gap-0.5 md:flex lg:w-[220px]">
        {rooms.map((r) => (
          <Link key={r.key} to={roomHref(r.key)} aria-current={r.key === room.key ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-size-15 ${r.key === room.key ? 'bg-[var(--wh-surface-muted)] font-bold' : ''}`}>
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${r.key === room.key ? 'bg-[var(--wh-highlight)]' : ''}`} />
            {r.name}
          </Link>
        ))}
      </nav>
      {asked ? null : (
        <nav aria-label="Settings rooms" className="flex w-full flex-col overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] md:hidden">
          {rooms.map((r) => (
            <Link key={r.key} to={roomHref(r.key)} className="flex min-h-[60px] items-center gap-3 border-t border-[var(--wh-border)] px-4 first:border-t-0">
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="text-base font-bold">{r.name}</span>
                <span className="text-size-13 text-[var(--wh-muted)]">{roomLine(r)}</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--wh-muted)]"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          ))}
        </nav>
      )}
      <div className={`min-w-0 grow flex-col gap-3 ${asked ? 'flex' : 'hidden md:flex'}`}>
        {asked ? <Link to={ROUTES.settings} className="inline-flex min-h-11 items-center self-start text-sm font-semibold md:hidden"><span aria-hidden="true">‹&nbsp;</span>Settings</Link> : null}
        <RoomPage key={room.key} room={room} fold={params.get('fold')} />
      </div>
    </div>
  );
}
