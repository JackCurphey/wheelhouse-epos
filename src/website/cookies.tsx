import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog.tsx';
import { RowSwitch } from '@/screens/settings/row-switch.tsx';
import { CHOICE_FOR_KIND, COOKIE_CHOICES, cookiesFor } from './cookie-list.ts';
import { loadTools } from './tracking.ts';
import { useSiteContext } from './site-query.ts';
import { Box, H1, H2 } from './parts.tsx';
import { usePageTitle } from './pages.tsx';

/**
 * The visitor's cookie choices (openspec/changes/website-browse, design 4;
 * screens wb-cookies-banner, wb-cookies-choose, wb-cookies-saved,
 * wb-cookies-page and wb-cookies-page-plain in browse.mjs).
 *
 * A shop with a tracking tool asks first: the banner until the visitor
 * chooses, then Cookie choices at the bottom of every page. The choice is the
 * `wh_cookies` cookie, e.g. `measuring-on.advertising-off`; the server reads
 * it and only then sends a tool's ID (server/routes/site.js), so the site is
 * read again after each choice and a tool with an ID is loaded. A shop with
 * no tool asks nothing and writes no choice.
 */

export type Choice = 'measuring' | 'advertising';
export type Choices = Record<Choice, boolean>;
const ORDER: Choice[] = ['measuring', 'advertising'];
const WHAT: Record<Choice, string> = { measuring: 'measuring visits', advertising: 'advertising' };

/** The saved choice, or null when the visitor hasn't chosen (or the cookie is unreadable). */
export function readChoices(cookie: string = document.cookie): Choices | null {
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== COOKIE_CHOICES.name) continue;
    const said = new Map(rest.join('=').split('.').map((p) => p.split('-') as [string, string]));
    if (!ORDER.every((c) => said.get(c) === 'on' || said.get(c) === 'off')) return null;
    return { measuring: said.get('measuring') === 'on', advertising: said.get('advertising') === 'on' };
  }
  return null;
}

function writeChoices(choices: Choices, base: string) {
  const value = ORDER.map((c) => `${c}-${choices[c] ? 'on' : 'off'}`).join('.');
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_CHOICES.name}=${value}; Path=${base || '/'}; Max-Age=${COOKIE_CHOICES.seconds}; SameSite=Lax${secure}`;
}

/** "A", "A and B", or "A, B and C". */
const named = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

type CookieContextValue = {
  /** The kinds the shop's tools need a choice for, in order; empty for a shop with no tool. */
  kinds: Choice[];
  /** Each kind's tool names. */
  tools: Record<Choice, string[]>;
  choices: Choices | null;
  save: (choices: Choices) => void;
  openChoose: () => void;
};
const CookieContext = createContext<CookieContextValue | null>(null);

function useCookies(): CookieContextValue {
  const value = useContext(CookieContext);
  if (!value) throw new Error('useCookies outside the website shell');
  return value;
}

/** Around the frame: the banner, Choose cookies, the saved message, and loading the tools chosen. */
export function CookieChoices({ children }: { children: React.ReactNode }) {
  const { address, site } = useSiteContext();
  const client = useQueryClient();
  const [choices, setChoices] = useState<Choices | null>(() => readChoices());
  const [choosing, setChoosing] = useState(false);
  // Each opening of Choose cookies starts again from what was last saved.
  const [opening, setOpening] = useState(0);
  const [saved, setSaved] = useState(0);

  const { tools, kinds } = useMemo(() => {
    const byKind: Record<Choice, string[]> = { measuring: [], advertising: [] };
    for (const t of site.tracking) {
      const kind = CHOICE_FOR_KIND[t.kind];
      if (kind && !byKind[kind].includes(t.name)) byKind[kind].push(t.name);
    }
    return { tools: byKind, kinds: ORDER.filter((c) => byKind[c].length > 0) };
  }, [site.tracking]);

  // A tool the visitor said yes to comes back with its ID: load it.
  useEffect(() => { loadTools(site.tracking); }, [site.tracking]);

  // The saved message goes after a few seconds.
  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(0), 5000);
    return () => clearTimeout(timer);
  }, [saved]);

  const save = useCallback((next: Choices) => {
    writeChoices(next, address.base);
    // A tool already running can't be unloaded: saying no to its kind starts
    // the page again, without it (decided while building).
    const loaded = new Set([...document.querySelectorAll<HTMLScriptElement>('script[data-wh-tool]')].map((s) => s.dataset.whTool));
    const running = site.tracking.some((t) => t.tool && loaded.has(t.tool) && !next[CHOICE_FOR_KIND[t.kind]]);
    if (running) {
      window.location.reload();
      return;
    }
    setChoices(next);
    setChoosing(false);
    setSaved((n) => n + 1);
    // The server sends a tool's ID only once its kind is on.
    void client.invalidateQueries({ queryKey: ['site', address.base], exact: true });
  }, [address.base, client, site.tracking]);
  const openChoose = useCallback(() => { setOpening((n) => n + 1); setChoosing(true); }, []);

  const value = useMemo(() => ({ kinds, tools, choices, save, openChoose }), [kinds, tools, choices, save, openChoose]);
  return (
    <CookieContext.Provider value={value}>
      {children}
      {kinds.length > 0 && choices == null && !choosing && <CookieBanner />}
      {kinds.length > 0 && <ChooseCookies key={opening} open={choosing} onOpenChange={setChoosing} />}
      {saved > 0 && (
        <div role="status" className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-[10px] bg-[var(--wh-ink)] px-4 py-2.5 text-size-15 text-white">
          <Check aria-hidden className="size-4" />Your cookie choices are saved
        </div>
      )}
    </CookieContext.Provider>
  );
}

const all = (on: boolean): Choices => ({ measuring: on, advertising: on });

/** wb-cookies-banner. */
function CookieBanner() {
  const { kinds, tools, save, openChoose } = useCookies();
  return (
    <section
      role="region"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-10 flex flex-col items-stretch gap-4 border border-[var(--wh-border)] bg-[var(--wh-panel)] px-5 py-[18px] shadow-[0_-8px_30px_rgba(28,30,25,0.18)] md:inset-x-10 md:bottom-5 md:flex-row md:items-center md:rounded-xl"
    >
      <div className="flex grow flex-col gap-1">
        <h2 className="m-0 text-size-17 font-bold">Cookies on this website</h2>
        <p className="m-0 text-size-15 leading-normal">
          We use the cookies the site needs to work. With your OK, we’d also like to use {named(kinds.flatMap((k) => tools[k]))} to see how people use the site.{' '}
          <Link to="/cookies" className="inline-flex min-h-11 items-center text-[var(--wh-ink)]">About cookies</Link>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 whitespace-nowrap md:grid-cols-3">
        <Button className="min-h-11" onClick={() => save(all(false))}>Reject all</Button>
        <Button className="min-h-11" onClick={() => save(all(true))}>Accept all</Button>
        <Button className="min-h-11" variant="ghost" onClick={openChoose}>Choose</Button>
      </div>
    </section>
  );
}

const ROW = {
  measuring: { title: 'Measuring visits', why: 'to count visits and see which pages are used.' },
  advertising: { title: 'Advertising', why: 'to show you its adverts elsewhere.' },
} as const;

/** wb-cookies-choose: a row for each kind the shop's tools need. */
function ChooseCookies({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { site } = useSiteContext();
  const { kinds, tools, choices, save } = useCookies();
  // Keyed by each opening (CookieChoices), so it starts from what was last saved.
  const [draft, setDraft] = useState<Choices>(choices ?? all(false));
  const titleId = useId();
  const subId = useId();
  const row = 'flex items-start gap-3.5 border-t border-[var(--wh-border)] py-3';
  return (
    <Dialog open={open} onOpenChange={onOpenChange} wide aria-labelledby={titleId} aria-describedby={subId}>
      <DialogHeader>
        <div>
          <DialogTitle id={titleId}>Choose cookies</DialogTitle>
          <DialogDescription id={subId}>Change these any time from “Cookie choices” at the bottom of every page</DialogDescription>
        </div>
        <DialogClose onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <DialogBody className="py-2">
        <div className={row}>
          <span className="flex grow flex-col gap-0.5">
            <span className="text-size-15 font-bold">Needed for the site to work</span>
            <span className="text-size-14 leading-normal text-[var(--wh-muted)]">Your basket, signing in, the shop you’ve chosen, and these choices.</span>
          </span>
          <span className="whitespace-nowrap text-size-14 font-semibold">Always on</span>
        </div>
        {kinds.map((kind) => (
          <div key={kind} className={row}>
            <span className="flex grow flex-col gap-0.5">
              <span className="text-size-15 font-bold">{ROW[kind].title}</span>
              <span className="text-size-14 leading-normal text-[var(--wh-muted)]">{named(tools[kind])}, added by {site.name}, {ROW[kind].why}</span>
            </span>
            <span className="shrink-0">
              <RowSwitch label={ROW[kind].title} hideLabel on={draft[kind]} disabled={false} onChange={(on) => setDraft((d) => ({ ...d, [kind]: on }))} />
            </span>
          </div>
        ))}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" className="min-h-11" onClick={() => save(all(false))}>Reject all</Button>
        <Button variant="primary" className="min-h-11" onClick={() => save(draft)}>Save my choices</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** The footer's "Cookie choices", after Cookies, for a shop with a tool. */
export function CookieChoicesButton({ className }: { className: string }) {
  const { kinds, openChoose } = useCookies();
  if (kinds.length === 0) return null;
  return <button type="button" onClick={openChoose} className={`${className} border-0 bg-transparent p-0 text-left font-[inherit] underline`}>Cookie choices</button>;
}

/** wb-cookies-page and wb-cookies-page-plain. */
export function CookiesPage() {
  usePageTitle('Cookies');
  const { kinds, tools, choices, openChoose } = useCookies();
  const usedId = useId();
  const toolsId = useId();
  const text = 'm-0 text-size-15 leading-relaxed';
  return (
    <>
      <H1>Cookies</H1>
      <div className="flex max-w-[760px] flex-col gap-[18px]">
        <Box>
          <H2 id={usedId}>What this website uses</H2>
          <table className="w-full border-collapse text-size-15">
            <caption className="pb-2 text-left text-size-15 text-[var(--wh-muted)]">Cookies this website sets</caption>
            <thead>
              <tr>
                {['Cookie', 'What it’s for', 'How long'].map((c) => (
                  <th key={c} scope="col" className="border-b border-[var(--wh-border)] py-2 pr-2 text-left text-size-13 text-[var(--wh-muted)]">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cookiesFor(kinds.length > 0).map((c) => (
                <tr key={c.name}>
                  <td className="border-b border-[var(--wh-border)] py-[9px] pr-2 font-mono">{c.name}</td>
                  <td className="border-b border-[var(--wh-border)] py-[9px] pr-2">{c.purpose}</td>
                  <td className="border-b border-[var(--wh-border)] py-[9px] pr-2">{c.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={text}>These are needed for the site to work, so they don’t need your OK.</p>
        </Box>
        {kinds.length > 0 ? (
          <Box>
            <H2 id={toolsId}>Tools the shop has added</H2>
            {kinds.flatMap((kind) => tools[kind].map((name) => <p key={`${kind}-${name}`} className={text}>{name} — {WHAT[kind]}.</p>))}
            {kinds.map((kind) => (
              <p key={kind} className={text}>
                <strong>{choices == null ? `You haven’t chosen yet about ${WHAT[kind]}.` : `You said ${choices[kind] ? 'yes' : 'no'} to ${WHAT[kind]}.`}</strong>
              </p>
            ))}
            <div><Button className="min-h-11" onClick={openChoose}>Change cookie choices</Button></div>
          </Box>
        ) : (
          <Box><p className={text}>This website doesn’t use any other cookies, so there’s nothing for you to choose.</p></Box>
        )}
      </div>
    </>
  );
}
