import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Card, Page, Row, Tag } from '@/screens/deliveries/deliveries-bits.tsx';
import { Count, useSearch } from '@/screens/deliveries/new-order.tsx';
import { names, type Take } from './stock-take-bits.ts';

/**
 * Counting in a stock take (tk-count, tk-count-below in stock.mjs; stock
 * control decisions 5, 9 and 11; openspec/changes/stock-take). Blind: only
 * what this person has counted shows, never what Wheelhouse expects. Each
 * scan adds one; a typed number sets the count; − at 1 takes the line off.
 * Counts go to the server one at a time, in order, so a typed 12 can't land
 * before the 1 typed on the way to it. A below-zero count lists what's still
 * to find, by name; a line the manager asked to be recounted shows with no
 * number until someone counts it. Sizes come later (WP-1.5).
 */
type Line = { productId: number; name: string; sku: string | null; qty: number };
type Product = { id: number; sku: string | null; barcode: string | null; name: string };
type Recount = { productId: number; name: string; sku: string | null; askedBy: string };
type CountView = Take & { mine: Line[]; myItems: number; othersCounting: string[]; recountAsked?: Recount[]; stillToFind: { productId: number; name: string; sku: string | null }[] | null };
type Body = { productId: number; add: 1 } | { productId: number; qty: number };

// This person's lines with one changed: a new one first, 0 taken off.
function withLine(v: CountView, line: Line): CountView {
  const had = v.mine.some((l) => l.productId === line.productId);
  const mine = line.qty === 0 ? v.mine.filter((l) => l.productId !== line.productId)
    : had ? v.mine.map((l) => (l.productId === line.productId ? line : l)) : [line, ...v.mine];
  const counted = (s: { productId: number }) => s.productId !== line.productId || line.qty === 0;
  return { ...v, mine, myItems: mine.reduce((n, l) => n + l.qty, 0), stillToFind: v.stillToFind && v.stillToFind.filter((s) => s.productId !== line.productId), recountAsked: v.recountAsked?.filter(counted) };
}

export function CountPage() {
  const id = Number(useParams().id ?? '');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const key = ['stock-take', id];
  const view = useQuery({ queryKey: key, queryFn: () => apiGet<CountView>(`/api/stock-takes/${id}`) });
  const [text, setText] = useState('');
  const [said, setSaid] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const matches = useSearch(text);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  // Opening the page joins the count (or comes back to counting).
  useEffect(() => {
    if (Number.isSafeInteger(id) && id > 0) void apiMutate(`/api/stock-takes/${id}/join`, {}).catch(() => {});
  }, [id]);

  function send(body: Body, line: Line) {
    queryClient.setQueryData<CountView>(key, (v) => v && withLine(v, line));
    pending.current += 1;
    chain.current = chain.current.then(async () => {
      try {
        const saved = await apiMutate<Line>(`/api/stock-takes/${id}/counts`, body);
        queryClient.setQueryData<CountView>(key, (v) => v && withLine(v, saved));
        setProblem(null);
      } catch (err) {
        setSaid('');
        setProblem(err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that count. Try again in a moment.');
      } finally {
        pending.current -= 1;
        // Once nothing is on its way, the server's own view (and who else is counting).
        if (pending.current === 0) void queryClient.invalidateQueries({ queryKey: key });
      }
    });
  }

  const lineOf = (productId: number) => view.data?.mine.find((l) => l.productId === productId);
  function take(p: Product) {
    setText('');
    const qty = (lineOf(p.id)?.qty ?? 0) + 1;
    send({ productId: p.id, add: 1 }, { productId: p.id, name: p.name, sku: p.sku, qty });
    setSaid(`Added ${p.name} · 1`);
  }
  const setQty = (l: Line, qty: number) => send({ productId: l.productId, qty }, { ...l, qty });

  // A scanner types the code and presses Enter at once, so Enter looks it up
  // itself: an exact barcode or code, or the only match (as receiving does).
  async function onEnter() {
    const code = text.trim();
    if (!code) return;
    let found: Product[];
    try {
      found = await apiGet<Product[]>(`/api/products?${new URLSearchParams({ search: code })}`);
    } catch {
      setProblem('Wheelhouse couldn’t look that up. Try again in a moment.');
      return;
    }
    const lc = code.toLowerCase();
    const exact = found.find((p) => [p.barcode, p.sku].some((v) => v && v.toLowerCase() === lc));
    const one = exact ?? (found.length === 1 ? found[0] : undefined);
    if (one) take(one);
    else if (found.length === 0) { setText(''); setSaid(`Nothing in Wheelhouse has the barcode ${code}`); }
  }

  async function finish() {
    setBusy(true);
    await chain.current;
    try {
      await apiMutate(`/api/stock-takes/${id}/finish`, {});
      void queryClient.invalidateQueries({ queryKey: ['stock-takes'] });
      navigate(ROUTES.stocktake);
    } catch {
      setProblem('Wheelhouse couldn’t save that. Try again in a moment.');
      setBusy(false);
    }
  }

  const back = (
    <Link to={ROUTES.stocktake} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline">
      <span aria-hidden="true">‹</span>Stock take
    </Link>
  );
  if (view.isError) return <Page>{back}<p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this count. Try again in a moment.</p></Page>;
  const v = view.data;
  if (!v) return <Page>{back}<p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></Page>;
  if (v.status === 'applied') return <Page>{back}<p className="m-0 text-sm">This count has been applied.</p></Page>;
  const below = v.kind === 'below_zero';
  const others = v.othersCounting;
  const recounts = v.recountAsked ?? [];
  return (
    <Page>
      {back}
      <Card id="t-counting" title={below ? 'Counting: below zero' : v.kind === 'whole_shop' ? 'Counting the whole shop' : `Counting ${v.label}`}>
        <h3 className="m-0 text-size-15 font-bold">{below ? 'Find and scan these' : 'Scan what’s here'}</h3>
        <div className="relative">
          <label className="flex min-h-[52px] items-center gap-2.5 rounded-[10px] border-2 border-[var(--wh-ink)] bg-[var(--wh-panel)] px-3.5 text-[var(--wh-muted)]">
            <NavIcon name="search" size={20} />
            <input type="search" aria-label="Scan each item, or type to find it" placeholder="Scan each item, or type to find it" value={text}
              aria-controls="tk-matches" aria-expanded={matches.length > 0}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onEnter(); } }}
              className="min-w-0 grow border-0 bg-transparent text-base text-[var(--wh-ink)] placeholder:text-[var(--wh-muted)] focus:outline-none" />
          </label>
          {matches.length > 0 ? (
            <ul id="tk-matches" role="listbox" aria-label="Matching products" className="m-0 mt-1 list-none rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] p-0">
              {matches.slice(0, 8).map((p) => (
                <li key={p.id} role="option" aria-selected="false" tabIndex={-1} onClick={() => take(p)}
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-[var(--wh-border)] px-3 first:border-t-0 hover:bg-[var(--wh-hover)]">
                  <span className="text-size-15 font-semibold">{p.name}</span>
                  <span className="text-size-13 text-[var(--wh-muted)]">{p.sku}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p role="status" className="m-0 min-h-5 text-sm text-[var(--wh-muted)]">{said}</p>
        {problem ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
        {below && v.stillToFind ? (
          <>
            <h3 className="m-0 mt-1 text-size-15 font-bold">{`Still to find · ${v.stillToFind.length}`}</h3>
            {v.stillToFind.length > 0 ? (
              <ul aria-label="Still to find" className="m-0 list-none p-0">
                {v.stillToFind.map((s) => <Row key={s.productId} title={s.name} sub={s.sku ?? undefined}><Tag>Not found yet</Tag></Row>)}
              </ul>
            ) : null}
            <h3 className="m-0 mt-1 text-size-15 font-bold">Counted</h3>
          </>
        ) : null}
        {recounts.length > 0 ? (
          <ul aria-label="Recounts asked" className="m-0 list-none p-0">
            {recounts.map((r) => (
              <Row key={r.productId} title={r.name} sub={<>{r.sku ? `${r.sku} · ` : ''}<strong className="text-[var(--wh-ink)]">{`Recount asked by ${r.askedBy}`}</strong></>}>
                <Count name={r.name} value={null} onChange={(n) => setQty({ productId: r.productId, name: r.name, sku: r.sku, qty: n }, n)} />
              </Row>
            ))}
          </ul>
        ) : null}
        {v.mine.length > 0 ? (
          <ul aria-label="Counted" className="m-0 list-none p-0">
            {v.mine.map((l) => (
              <Row key={l.productId} title={l.name} sub={l.sku ?? undefined}>
                <Count name={l.name} value={l.qty} onChange={(n) => setQty(l, n)} onBelowOne={() => setQty(l, 0)} />
              </Row>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
          <span className="text-sm text-[var(--wh-muted)]">{`${v.myItems} ${v.myItems === 1 ? 'item' : 'items'} counted by you${others.length ? ` · ${names(others)} ${others.length === 1 ? 'is' : 'are'} counting too` : ''}`}</span>
          <Button variant="accent" disabled={busy} onClick={() => void finish()}>I’ve finished my part</Button>
        </div>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{below ? `Started by ${v.startedBy}. Staff can join from Stock take. Numbers aren’t shown — count what you find.` : 'Count what’s on the shelf. Anything sold, booked in, used or sent while you count is allowed for.'}</p>
      </Card>
    </Page>
  );
}
