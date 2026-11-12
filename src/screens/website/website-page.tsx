import { useId, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Check, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ApiError, apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';
import { Button } from '@/components/ui/button';
import { Box, Page, Refusal } from '@/screens/reports/reports-bits.tsx';
import { DiscardBox, HistoryBox, PartBox } from './website-boxes.tsx';
import { WebsiteStart } from './website-start.tsx';
import { changeWords, customerSite, plural, when, type Part, type WebsiteState } from './website-types.ts';

/**
 * Office › Website (openspec/changes/website-management, pull request 2; the
 * drawings ws-page, ws-page-on, ws-page-changes and ws-no-access in
 * docs/design/user-journeys/generator/website.mjs). Only an Owner gets the
 * page; anyone else is told who can change it.
 */
export function WebsitePage() {
  const queryClient = useQueryClient();
  const site = useQuery({ queryKey: ['website'], queryFn: () => apiGet<WebsiteState>('/api/website') });
  const [toast, setToast] = useState<'on' | 'off' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [history, setHistory] = useState(false);
  const wordsHeading = useRef<HTMLHeadingElement>(null);
  const historyTip = useId();

  if (site.error instanceof ApiError && site.error.status === 403) {
    const owners = (site.error.body as { owners?: unknown })?.owners;
    return <NoAccess owners={Array.isArray(owners) ? owners.map(String) : []} />;
  }
  if (site.error) return <Page><Refusal error={site.error} /></Page>;
  const s = site.data;
  if (!s) return <Page><p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></Page>;
  if (!s.setUp) return <WebsiteStart state={s} onState={(next) => queryClient.setQueryData(['website'], next)} />;

  /** Sends a change; the server answers with the whole Website page's state. */
  async function send(path: string, after?: (next: WebsiteState) => void) {
    setBusy(true);
    setProblem(null);
    setToast(null);
    try {
      const next = await apiMutate<WebsiteState>(path, {}, { method: 'POST' });
      queryClient.setQueryData(['website'], next);
      after?.(next);
      return true;
    } catch (err) {
      setProblem(serverSaid(err) ? err.message : 'Wheelhouse couldn’t do that. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const saved = (next: WebsiteState) => queryClient.setQueryData(['website'], next);
  const partNamed = (name: string) => s.parts.find((p) => p.name === name) ?? null;
  // The photo the server counted as undescribed, or the first photo part.
  const undescribed = s.parts.find((p) => p.photo && !String(p.description ?? '').trim() && !p.decoration)
    ?? s.parts.find((p) => 'photo' in p) ?? null;
  const hasChanges = s.changeCount > 0;

  return (
    <Page>
      <h1 className="m-0 text-size-22 font-bold">Website</h1>
      <div role="status">{toast ? <Toast state={toast} address={customerSite(s.address)} /> : null}</div>
      {problem ? <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-sm font-semibold">{problem}</p> : null}

      <Box label={s.isOn ? 'Your website is on' : 'Your website is off'}>
        <div className="flex flex-wrap items-center gap-4">
          <span aria-hidden="true" className={`inline-flex size-12 items-center justify-center rounded-xl ${s.isOn ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-ink)]'}`}>
            {s.isOn ? <Check size={22} /> : <Lock size={22} />}
          </span>
          <div className="flex min-w-0 grow flex-col gap-1">
            <h2 className="m-0 text-size-17 font-bold">{s.isOn ? 'Your website is on' : 'Your website is off'}</h2>
            <p className="m-0 text-size-15 text-[var(--wh-muted)]">
              {s.isOn ? 'Customers can see it at ' : 'Only your staff can see it. Customers will find it at '}
              <a href={customerSite(s.address)} target="_blank" rel="noreferrer" className="font-semibold text-[var(--wh-ink)]">{s.address}</a>
            </p>
          </div>
          {s.isOn
            ? <Button disabled={busy} onClick={() => void send('/api/website/turn-off')}>Turn off</Button>
            : <Button variant={s.neverPublished ? 'accent' : 'default'} disabled={busy} onClick={() => void send('/api/website/turn-on')}>Turn it on</Button>}
        </div>
        {s.isOn ? null : (
          <div className="flex flex-col gap-0.5 text-size-13 text-[var(--wh-muted)] md:items-end md:text-right">
            {s.neverPublished ? <span>This also publishes your website as it is now.</span> : null}
            <span>Customers can look but not buy until you connect payments.</span>
            {s.partsToCheck.length ? (
              <span>
                {`${plural(s.partsToCheck.length, 'page')} still ${s.partsToCheck.length === 1 ? 'has' : 'have'} starting wording: `}
                {s.partsToCheck.map((name, i) => (
                  <span key={name}>{i ? ', ' : ''}<LinkButton onClick={() => setEditing(partNamed(name))}>{name}</LinkButton></span>
                ))}
              </span>
            ) : null}
            {s.neverPublished ? <ProductCounts counts={s.productCounts} /> : null}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--wh-border)] pt-3.5">
          <Button variant={s.neverPublished ? 'default' : 'accent'} onClick={() => wordsHeading.current?.focus()}><NavIcon name="website" size={18} />Edit words and photos</Button>
          {hasChanges ? (
            <>
              <button type="button" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--wh-warn-ink)] bg-[var(--wh-warn-bg)] px-3 text-sm font-bold text-[var(--wh-warn-ink)]">
                {plural(s.changeCount, 'unpublished change')}
                <ChevronDown aria-hidden="true" size={14} className={listOpen ? 'rotate-180' : ''} />
              </button>
              <span className="text-sm text-[var(--wh-muted)]">{`Saved${s.savedBy ? ` by ${s.savedBy}` : ''} ${when(s.savedAt)} · customers see them when you publish`}</span>
            </>
          ) : (
            <span className="text-sm text-[var(--wh-muted)]">
              {s.neverPublished ? 'Not published yet' : `Last published${s.publishedBy ? ` by ${s.publishedBy}` : ''} on ${when(s.publishedAt)}`}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {s.neverPublished ? <span id={historyTip} className="text-size-13 text-[var(--wh-muted)]">Nothing published yet</span> : null}
            <Button variant="ghost" disabled={s.neverPublished} aria-describedby={s.neverPublished ? historyTip : undefined} onClick={() => setHistory(true)}>History</Button>
          </span>
        </div>
        {hasChanges && listOpen ? (
          <section aria-label="Unpublished changes" className="flex flex-col gap-2.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-bg)] p-3.5">
            <h3 className="m-0 text-size-15 font-bold">{plural(s.changeCount, 'unpublished change')}</h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {s.changes.map((c) => (
                <li key={c.page} className="flex gap-3 border-t border-[var(--wh-border)] py-2 text-size-15 max-md:flex-col max-md:gap-0.5">
                  <strong className="md:min-w-[200px]">{c.page}</strong>
                  {changeWords(c) ? <span>{changeWords(c)}</span> : null}
                </li>
              ))}
            </ul>
            {s.photosWithoutDescription && undescribed ? (
              <p className="m-0 flex items-start gap-2 rounded-lg bg-[var(--wh-surface-muted)] px-3 py-2.5 text-size-15">
                <NavIcon name="website" size={18} />
                <span>
                {`${plural(s.photosWithoutDescription, 'photo')} ${s.photosWithoutDescription === 1 ? 'has' : 'have'} no description. `}
                <LinkButton onClick={() => setEditing(undescribed)}>Add it</LinkButton>
                </span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2.5">
              <Button variant="accent" disabled={busy} onClick={() => void send('/api/website/publish', (next) => setToast(next.isOn ? 'on' : 'off'))}>Publish</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setDiscarding(true)}>Discard changes</Button>
            </div>
          </section>
        ) : null}

      </Box>

      <ul aria-label="Your website" className="m-0 flex list-none flex-col overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0">
        <SummaryRow name="Taking payments" to={ROUTES.settings} badge="Not connected">Not connected · customers can look but not buy · open to connect [payment provider] · in Settings › Front desk › Online orders</SummaryRow>
        <SummaryRow name="Pages">Home, About us, Contact us, Collection and returns, Privacy, Cookies</SummaryRow>
        <SummaryRow name="Tracking tools">{s.tracking.length ? `${s.tracking.map((t) => t.name).join(', ')} · cookie choice on` : 'None — so there’s no cookie choice'}</SummaryRow>
        <SummaryRow name="Web address">{`${s.address} · your free address · Wheelhouse sets up your own address for you`}</SummaryRow>
        <SummaryRow name="Wheelhouse’s website or Shopify">{s.kind === 'shopify' ? 'Shopify' : 'Wheelhouse’s website'}</SummaryRow>
      </ul>

      <section aria-labelledby="ws-words" className="overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
        <h3 id="ws-words" ref={wordsHeading} tabIndex={-1} className="m-0 px-[18px] pt-3.5 pb-2.5 text-size-17 font-bold">Words and photos</h3>
        <ul aria-label="Words and photos" className="m-0 flex list-none flex-col p-0">
          {s.parts.map((p) => (
            <li key={p.key} className="flex min-h-14 items-center gap-3.5 border-t border-[var(--wh-border)] px-[18px] py-1.5">
              <span className="min-w-0 grow text-base font-bold">{p.name}</span>
              {p.checked ? null : <span className="rounded-full bg-[var(--wh-warn-bg)] px-2.5 py-0.5 text-size-13 font-semibold text-[var(--wh-warn-ink)]">Check this</span>}
              <Button aria-label={`Edit: ${p.name}`} onClick={() => setEditing(p)}>Edit</Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
        <span className="grow text-size-15">What the website sells, “Show on website” and online payments are in <strong>Settings › Front desk › Online orders</strong>.</span>
        <Link to={ROUTES.settings} className="inline-flex min-h-11 items-center text-size-15 font-semibold text-[var(--wh-ink)]">Open Online orders settings</Link>
      </div>

      {editing ? <PartBox part={editing} onState={saved} onSaved={(next) => { saved(next); setEditing(null); }} onClose={() => setEditing(null)} /> : null}
      {discarding ? (
        <DiscardBox state={s} busy={busy} problem={problem} onClose={() => { setDiscarding(false); setProblem(null); }}
          onDiscard={() => void send('/api/website/discard', () => setDiscarding(false))} />
      ) : null}
      {history ? <HistoryBox changeCount={s.changeCount} parts={s.parts} onRestored={(next) => { saved(next); setListOpen(true); setHistory(false); }} onClose={() => setHistory(false)} /> : null}
    </Page>
  );
}

/** website.mjs `productCounts`: what goes online, with See them opening Stock. */
export function ProductCounts({ counts }: { counts: WebsiteState['productCounts'] }) {
  return (
    <ul aria-label="Your products online" className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
      <li>{`${plural(counts.goOnline, 'product')} ${counts.goOnline === 1 ? 'goes' : 'go'} online`}</li>
      <li className="flex flex-wrap gap-2"><span>{`${counts.noPhoto} ${counts.noPhoto === 1 ? 'has' : 'have'} no photo (shown with their name)`}</span><Link to={`${ROUTES.stock}?show=no-photo`} aria-label="See the products with no photo, in Stock" className="font-semibold text-[var(--wh-ink)]">See them</Link></li>
      <li className="flex flex-wrap gap-2"><span>{`${counts.noPrice} ${counts.noPrice === 1 ? 'has' : 'have'} no price (stay off until priced)`}</span><Link to={`${ROUTES.stock}?show=no-price`} aria-label="See the products with no price, in Stock" className="font-semibold text-[var(--wh-ink)]">See them</Link></li>
    </ul>
  );
}

/** website.mjs `row`: a title over its line; Taking payments opens its settings. */
function SummaryRow({ name, badge, to, children }: { name: string; badge?: string; to?: string; children: ReactNode }) {
  const inner = (
    <>
      <span className="flex min-w-0 grow flex-col gap-[3px]">
        <span className="text-base font-bold">{name}</span>
        <span className="text-sm text-[var(--wh-muted)]">{children}</span>
      </span>
      {badge ? <span className="rounded-full bg-[var(--wh-warn-bg)] px-2.5 py-0.5 text-size-13 font-semibold whitespace-nowrap text-[var(--wh-warn-ink)]">{badge}</span> : null}
      {to ? <ChevronRight aria-hidden="true" size={18} /> : null}
    </>
  );
  const look = 'flex min-h-16 items-center gap-3.5 px-[18px] py-2.5 text-[var(--wh-ink)] no-underline';
  return (
    <li className="border-t border-[var(--wh-border)] first:border-t-0">
      {to ? <Link to={to} className={look}>{inner}</Link> : <div className={look}>{inner}</div>}
    </li>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wh-ink)] underline">{children}</button>;
}

/** The Published toasts (website.mjs line 72): on, or off and waiting to be turned on. */
function Toast({ state, address }: { state: 'on' | 'off'; address: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-[10px] bg-[var(--wh-ink)] py-1.5 pr-1.5 pl-4 text-sm text-[var(--wh-panel)] shadow-modal max-md:right-3 max-md:bottom-3 max-md:left-3 max-md:translate-x-0">
      <Check aria-hidden="true" size={16} />
      <span className="grow pr-1.5">{state === 'on' ? 'Published — customers see it now' : 'Published. Customers will see it once you turn the website on'}</span>
      <a href={address} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-white/15 px-3.5 font-bold whitespace-nowrap text-[var(--wh-panel)] no-underline">{state === 'on' ? 'View website' : 'View it'}</a>
    </div>
  );
}

/** ws-no-access: someone who can't change the website, told who can. */
function NoAccess({ owners }: { owners: string[] }) {
  return (
    <Page>
      <section aria-label="Only some people can change the website" className="flex max-w-[640px] flex-col items-start gap-3 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px]">
        <span className="flex size-12 items-center justify-center rounded-[10px] bg-[var(--wh-surface-muted)]"><Lock aria-hidden="true" size={22} /></span>
        <h2 className="m-0 text-size-17 font-bold">Only some people can change the website</h2>
        <p className="m-0 text-sm">
          {'People with “Can edit the website” can change it: '}
          {owners.map((name, i) => <span key={name}>{i ? ', ' : ''}<strong>{name}</strong></span>)}
          {'. Ask them if something needs changing.'}
        </p>
        <Link to={ROUTES.today} className="inline-flex min-h-11 items-center rounded-md border border-[var(--wh-input-border)] px-3 text-sm font-semibold text-[var(--wh-ink)] no-underline">Back to Today</Link>
      </section>
    </Page>
  );
}
