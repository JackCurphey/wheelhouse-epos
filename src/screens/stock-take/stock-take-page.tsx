import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { PillGroup } from '@/components/ui/pill-group.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { Card, Page, Row, Tag, linkClass } from '@/screens/deliveries/deliveries-bits.tsx';
import { appliedHref, atCost, checkHref, countHref, names, plural, started, useActiveOption, type Applied, type Kind, type Take } from './stock-take-bits.ts';
import { day } from '@/screens/deliveries/deliveries-bits.tsx';

/**
 * Stockroom › Stock take (tk-hub, tk-hub-staff, tk-start, tk-start-category
 * in stock.mjs; stock control decisions 5, 9 and 11;
 * openspec/changes/stock-take). The Owner starts a count (until "Can order
 * stock"); everyone sees the counts in progress and joins one. The Owner
 * checks a count (Check it) and sees the Finished counts.
 */
type InProgress = Take & { counting: string[]; finished: string[]; itemsCounted: number; everyoneFinished: boolean };
// `finished` comes for the Owner only: it carries costs (Staff see none).
type Hub = { canStart: boolean; areasUsed: string[]; inProgress: InProgress[]; finished?: Applied[] };

export function StockTakePage() {
  const session = useSession();
  const hub = useQuery({ queryKey: ['stock-takes'], queryFn: () => apiGet<Hub>('/api/stock-takes'), enabled: session.status === 'signed-in' });
  const [starting, setStarting] = useState(false);
  if (session.status !== 'signed-in') return null;
  const canStart = hub.data?.canStart ?? false;
  return (
    <Page>
      {canStart ? (
        <Card id="t-count-stock" title="Count stock">
          <p className="m-0 text-sm text-[var(--wh-muted)]">Count the whole shop, a category or an area. Staff join on their phones; the shop stays open.</p>
          <div><Button variant="accent" onClick={() => setStarting(true)}>Start a count</Button></div>
        </Card>
      ) : null}
      <Card id="t-counts-in-progress" title="Counts in progress">
        {hub.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the counts. Try again in a moment.</p>
          : !hub.data ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
          : hub.data.inProgress.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No counts in progress.</p>
          : (
            <ul aria-labelledby="t-counts-in-progress" className="m-0 list-none p-0">
              {hub.data.inProgress.map((t) => (
                <Row key={t.id} title={t.label}
                  sub={[
                    `Started ${started(t.startedAt)} by ${t.startedBy}`,
                    `${t.itemsCounted} ${t.itemsCounted === 1 ? 'item' : 'items'} counted`,
                    t.everyoneFinished ? 'everyone has finished' : t.counting.length ? `${names(t.counting)} counting` : '',
                  ].filter(Boolean).join(' · ')}>
                  <Tag>{t.everyoneFinished ? 'Ready to check' : 'Counting'}</Tag>
                  <Link to={countHref(t.id)} className={linkClass} aria-label={`Join the count of ${t.label}`}>Join</Link>
                  {canStart ? <Link to={checkHref(t.id)} className={linkClass} aria-label={`Check the count of ${t.label}`}>Check it</Link> : null}
                </Row>
              ))}
            </ul>
          )}
      </Card>
      {canStart && hub.data?.finished ? (
        <Card id="t-finished-counts" title="Finished counts">
          {hub.data.finished.length === 0 ? <p className="m-0 text-sm text-[var(--wh-muted)]">No finished counts yet.</p> : (
            <ul aria-labelledby="t-finished-counts" className="m-0 list-none p-0">
              {hub.data.finished.map((t) => (
                <Row key={t.id} title={t.label}
                  sub={`Applied ${day(t.appliedAt!)} by ${t.appliedBy} · ${plural(t.productsChanged, 'product')} changed · ${atCost(t.valuePence)}`}>
                  <Link to={appliedHref(t.id)} className={linkClass}
                    aria-label={t.kind === 'whole_shop' ? `Open the whole-shop count from ${day(t.appliedAt!)}` : `Open the count of ${t.label} from ${day(t.appliedAt!)}`}>Open</Link>
                </Row>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
      {hub.data && !canStart ? <p className="m-0 text-sm text-[var(--wh-muted)]">Starting a count, and checking and applying it, are for the shop’s owner for now.</p> : null}
      {starting && hub.data ? <StartCount areasUsed={hub.data.areasUsed} onCancel={() => setStarting(false)} /> : null}
    </Page>
  );
}

const KINDS: { value: Kind; label: string }[] = [
  { value: 'whole_shop', label: 'Whole shop' },
  { value: 'category', label: 'A category' },
  { value: 'area', label: 'An area' },
  { value: 'below_zero', label: 'Below zero' },
];

/**
 * Start a count (tk-start, tk-start-category): what to count, an area named
 * (with areas used before) or a category found by searching, then Start the
 * count, which opens the counting page.
 */
function StartCount({ areasUsed, onCancel }: { areasUsed: string[]; onCancel: () => void }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>('area');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState('');
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => apiGet<string[]>('/api/categories'), enabled: kind === 'category' });
  const typed = category.trim().toLowerCase();
  const matches = typed && picked !== category ? (categories.data ?? []).filter((c) => c.toLowerCase().includes(typed)).slice(0, 8) : [];
  // A category typed in full, in any case, counts as picked (review, 28 Oct).
  const exact = (categories.data ?? []).find((c) => c.toLowerCase() === typed);
  const keys = useActiveOption(matches.length);
  const pick = (c: string) => { setCategory(c); setPicked(c); keys.reset(); };
  const target = kind === 'area' ? area.trim() : kind === 'category' ? picked || exact || '' : '';
  const ready = (kind !== 'area' && kind !== 'category') || target !== '';

  async function start() {
    setBusy(true);
    setProblem(null);
    try {
      const made = await apiMutate<Take>('/api/stock-takes', target ? { kind, target } : { kind });
      navigate(countHref(made.id));
    } catch (err) {
      setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t start the count. Try again in a moment.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }} aria-labelledby="tk-title">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="tk-title">Start a count</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">Staff can join it from Stock take on any device</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <PillGroup legend="What to count" value={kind} onChange={(v) => { setKind(v as Kind); setProblem(null); }} options={KINDS} />
        {kind === 'category' ? (
          <div className="relative flex flex-col gap-1.5">
            <label htmlFor="tk-cat" className="text-sm font-semibold">Which category</label>
            <span className="flex min-h-11 items-center gap-2 rounded-md border border-[var(--input)] bg-[var(--wh-panel)] px-2.5 text-[var(--wh-muted)]">
              <NavIcon name="search" size={15} />
              <input id="tk-cat" role="combobox" aria-expanded={matches.length > 0} aria-controls="tk-cat-matches" aria-autocomplete="list" value={category}
                aria-activedescendant={keys.index >= 0 ? `tk-cat-${keys.index}` : undefined}
                onKeyDown={(e) => { keys.onKeyDown(e, (i) => pick(matches[i])); }}
                onChange={(e) => { setCategory(e.target.value); setPicked(''); keys.reset(); }}
                className="min-w-0 grow border-0 bg-transparent text-size-15 text-[var(--wh-ink)] focus:outline-none" />
            </span>
            {matches.length > 0 ? (
              <ul id="tk-cat-matches" role="listbox" aria-label="Matching categories" className="m-0 list-none rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0">
                {matches.map((c, i) => (
                  <li key={c} id={`tk-cat-${i}`} role="option" aria-selected={keys.index === i} tabIndex={-1} onClick={() => pick(c)}
                    className={`flex min-h-11 cursor-pointer items-center border-t border-[var(--wh-border)] px-3 text-size-15 first:border-t-0 hover:bg-[var(--wh-hover)] ${keys.index === i ? 'bg-[var(--wh-hover)] font-semibold' : ''}`}>{c}</li>
                ))}
              </ul>
            ) : null}
            <p className="m-0 text-sm text-[var(--wh-muted)]">Everything in this category — and nothing else — is compared.</p>
          </div>
        ) : null}
        {kind === 'area' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tk-area" className="text-sm font-semibold">Which area</label>
            <Input id="tk-area" value={area} maxLength={60} onChange={(e) => setArea(e.target.value)} />
            {areasUsed.length > 0 ? (
              <div role="group" aria-label="Areas used before" className="flex flex-wrap items-center gap-1.5">
                <span className="text-size-13 text-[var(--wh-muted)]">Used before:</span>
                {areasUsed.map((a) => (
                  <button key={a} type="button" onClick={() => setArea(a)}
                    className="inline-flex min-h-11 items-center rounded-full border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 text-sm font-semibold text-[var(--wh-ink)]">{a}</button>
                ))}
              </div>
            ) : null}
            <p className="m-0 text-sm text-[var(--wh-muted)]">Only what’s scanned in this area is compared — products nobody scans are left as they are.</p>
          </div>
        ) : null}
        {/* The drawn note, shortened until it is true (review, 28 Oct): jobs
            don't move stock, nothing is sent between shops, and nothing holds
            stock for orders, jobs or Cycle to Work yet. */}
        <p className="m-0 text-sm text-[var(--wh-muted)]">Counters don’t see what Wheelhouse expects, so they count what’s really there. Anything sold, booked in or adjusted during the count is allowed for.</p>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="default" onClick={onCancel}>Cancel</Button>
        <Button variant="accent" disabled={!ready || busy} onClick={() => void start()}>Start the count</Button>
      </DialogFooter>
    </Dialog>
  );
}
