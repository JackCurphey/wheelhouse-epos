import { useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { NavIcon } from '@/staff/nav-icon.tsx';
import { newRequestKey } from '@/screens/book/details-rules.ts';
import { Card, Page, Row, mono } from '@/screens/deliveries/deliveries-bits.tsx';

/**
 * Office › Moving from Citrus Lime, Bring your data (mv-start, mv-progress,
 * mv-progress-failed, mv-summary in moving.mjs; Moving from Citrus Lime
 * decisions 2, 4 and 9; openspec/changes/citrus-import-screens). The owner
 * drops the files in; it starts by itself, with no Import button, and carries
 * on if they leave. Customers, Fix and Ask us to help follow in later pull
 * requests of WP-2.4; Run alongside and Switch over are WP-8.1.
 */
type MoveFile = { id: number; report: 'price_list' | 'barcodes'; fileName: string; state: 'bringing' | 'done'; rowsTotal: number; rowsIn: number; rowsLook: number; stockIn: number };
type Sending = { key: string; name: string; problem?: 'cant_read' | 'not_sent' };

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const KEY = ['move'];
const STAGES = ['Bring your data', 'Run alongside', 'Switch over'];
const REPORTS_NOTE = 'Download these from Citrus Lime, then drop them in together. Nothing in Citrus Lime changes.';

// "[Which Citrus Lime export, and where to find it]" on mv-start, from
// docs/superpowers/specs/2026-10-05-citrus-lime-exports.md.
const WHERE_PRODUCTS = 'Price List - Store Level and Barcode/Alias List, in Cloud Reports';
const WHERE_STOCK = 'Price List - Store Level, the same file';
const WHERE_LATER = 'Comes across later';
const LATER_KINDS = ['Customers', 'Sales', 'Workshop jobs'];

function Stages() {
  return (
    <nav aria-label="Stages of the move">
      <ol className="m-0 flex list-none gap-1.5 p-0 md:gap-2">
        {STAGES.map((t, i) => (
          <li key={t} className="flex min-w-0 flex-[1_1_0]">
            <span aria-current={i === 0 ? 'step' : undefined}
              className={`flex min-h-16 grow flex-col items-start gap-1.5 rounded-[10px] border bg-[var(--wh-panel)] p-2 md:min-h-14 md:flex-row md:items-center md:gap-2.5 md:px-3 md:py-2.5 ${i === 0 ? 'border-[var(--wh-ink)]' : 'border-[var(--wh-border)]'}`}>
              <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold md:size-7 md:text-size-13 ${i === 0 ? 'bg-[var(--wh-ink)] text-[var(--wh-panel)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]'}`}>{i + 1}</span>
              <span className="flex min-w-0 flex-col gap-px">
                <span className="text-size-13 leading-tight font-bold md:text-size-15">{t}</span>
                <span className="text-size-13 leading-tight text-[var(--wh-muted)]">{i === 0 ? 'Now' : 'Later'}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Chip({ tone = 'grey', children }: { tone?: 'ok' | 'warn' | 'grey'; children: ReactNode }) {
  const look = tone === 'ok' ? 'bg-[var(--wh-ok-bg)] text-[var(--wh-status-complete-ink)]' : tone === 'warn' ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : 'bg-[var(--wh-surface-muted)] text-[var(--wh-muted)]';
  return (
    <span className={`inline-flex min-h-[26px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${look}`}>
      {tone === 'ok' ? <NavIcon name="check" size={13} /> : null}{children}
    </span>
  );
}

const n = (value: number) => <span className={`${mono} text-size-15`}>{value}</span>;
const names = (files: MoveFile[]) => files.map((f) => f.fileName).join(', ');
const lookCount = (files: MoveFile[]) => files.reduce((sum, f) => sum + f.rowsLook, 0);

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^[^,]*,/, ''));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/** The big drop zone (mv-start) or the slim one (as the Weekly refresh card's). */
function DropZone({ slim, onFiles, title }: { slim?: boolean; title: string; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}
      className={`rounded-xl border-2 border-dashed bg-[var(--wh-panel)] ${over ? 'border-[var(--wh-ink)]' : 'border-[var(--wh-input)]'} ${slim ? 'flex min-h-16 flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5' : 'flex min-h-[150px] flex-col items-center justify-center gap-2.5 p-4.5 text-center'}`}
    >
      <span className={`font-bold ${slim ? 'text-size-15' : 'text-base'}`}>{title}</span>
      {slim ? null : <span className="text-sm text-[var(--wh-muted)]">Wheelhouse works out which file is which</span>}
      <Button variant="default" onClick={() => input.current?.click()}>Choose files</Button>
      <input ref={input} type="file" multiple hidden aria-label="Choose files" accept=".xlsx,.csv"
        onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
    </div>
  );
}

export function MovePage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const isOwner = session.status === 'signed-in' && session.user.isOwner;
  const move = useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<{ files: MoveFile[] }>('/api/move'),
    enabled: isOwner,
    // While a file comes across, this page keeps up (audit M4).
    refetchInterval: (q) => (q.state.data?.files.some((f) => f.state === 'bringing') ? 2000 : false),
  });
  const [sends, setSends] = useState<Sending[]>([]);
  const another = useRef<HTMLInputElement>(null);
  const replacing = useRef<Sending | null>(null);

  // One at a time, so a big drop doesn't send them all at once. A send that got
  // no answer goes once more with the same key, so it can't count twice.
  async function sendOne(file: File) {
    const send: Sending = { key: newRequestKey(), name: file.name };
    setSends((all) => [...all, send]);
    let problem: Sending['problem'];
    try {
      if (file.size > MAX_FILE_BYTES) throw new ApiError(422, {});
      const body = { fileName: file.name, dataBase64: await readAsBase64(file), requestKey: send.key };
      try {
        await apiMutate('/api/move/files', body);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        await apiMutate('/api/move/files', body);
      }
    } catch (err) {
      problem = err instanceof ApiError && err.status === 422 ? 'cant_read' : 'not_sent';
    }
    if (!problem) await queryClient.invalidateQueries({ queryKey: KEY });
    setSends((all) => (problem ? all.map((s) => (s === send ? { ...s, problem } : s)) : all.filter((s) => s !== send)));
  }
  async function onFiles(files: File[]) {
    for (const file of files) await sendOne(file);
  }
  // The refused row stays until a file is chosen: going sooner could take the
  // page's file box with it while the owner is still choosing.
  function chooseAnother(failed: Sending) {
    replacing.current = failed;
    another.current?.click();
  }
  function anotherChosen(chosen: File[]) {
    if (chosen.length === 0) return;
    setSends((all) => all.filter((s) => s !== replacing.current));
    void onFiles(chosen);
  }

  if (session.status !== 'signed-in') return null;
  if (!isOwner) return <Page><p className="m-0 text-sm">Moving from Citrus Lime is for the shop’s owner.</p></Page>;
  if (move.isError) return <Page><Stages /><p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this. Try again in a moment.</p></Page>;
  if (!move.data) return <Page><Stages /><p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></Page>;

  const files = move.data.files;
  const products = files.filter((f) => f.report === 'price_list' || f.report === 'barcodes');
  const priceLists = files.filter((f) => f.report === 'price_list');
  const bringing = files.some((f) => f.state === 'bringing');
  const hiddenInput = <input ref={another} type="file" multiple hidden aria-label="Choose another file" accept=".xlsx,.csv" onChange={(e) => { anotherChosen([...(e.target.files ?? [])]); e.target.value = ''; }} />;

  if (files.length === 0 && sends.length === 0) {
    return (
      <Page>
        <Stages />
        <Card id="t-bring-your-data-from-citrus-lime" title="Bring your data from Citrus Lime">
          <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">{REPORTS_NOTE}</p>
          <ul className="m-0 list-none p-0">
            <Row title="Products" sub={WHERE_PRODUCTS}><Chip>Not added yet</Chip></Row>
            <Row title="Stock levels" sub={WHERE_STOCK}><Chip>Not added yet</Chip></Row>
            {LATER_KINDS.map((k) => <Row key={k} title={k} sub={WHERE_LATER}><Chip>Later</Chip></Row>)}
          </ul>
          <DropZone title="Drop all the files here" onFiles={(f) => void onFiles(f)} />
        </Card>
      </Page>
    );
  }

  if (bringing || sends.length > 0) {
    const state = (list: MoveFile[]) => {
      if (list.length === 0) return <Chip>Not added yet</Chip>;
      if (list.every((f) => f.state === 'done')) return <Chip tone="ok">Done</Chip>;
      return <Chip>{list.some((f) => f.rowsIn + f.rowsLook > 0) ? 'Bringing across' : 'Waiting'}</Chip>;
    };
    const done = products.reduce((sum, f) => sum + f.rowsIn + f.rowsLook, 0);
    const total = products.reduce((sum, f) => sum + f.rowsTotal, 0);
    return (
      <Page>
        <Stages />
        <Card id="t-bringing-your-data-across" title="Bringing your data across">
          <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">You can leave this page — Wheelhouse carries on and shows the result here.</p>
          {hiddenInput}
          <div role="status" aria-live="polite">
            <ul className="m-0 list-none p-0">
              <Row title="Products" sub={products.length ? <>{names(products)} · <span className={mono}>{done}</span> of <span className={mono}>{total}</span></> : undefined}>{state(products)}</Row>
              <Row title="Stock levels" sub={priceLists.length ? names(priceLists) : undefined}>{state(priceLists)}</Row>
              {sends.map((s) => (
                <Row key={s.key} title={s.name}
                  sub={s.problem === 'cant_read' ? 'Wheelhouse couldn’t read this file' : s.problem === 'not_sent' ? 'Wheelhouse couldn’t send this file. Try again in a moment.' : undefined}>
                  {s.problem
                    ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <Chip tone="warn">{s.problem === 'cant_read' ? 'Couldn’t read it' : 'Not sent'}</Chip>
                        <Button variant="default" aria-label={`Choose another file for ${s.name}`} onClick={() => chooseAnother(s)}>Choose another file</Button>
                      </span>
                    )
                    : <Chip>Bringing across</Chip>}
                </Row>
              ))}
              {LATER_KINDS.map((k) => <Row key={k} title={k}><Chip>Later</Chip></Row>)}
            </ul>
          </div>
        </Card>
      </Page>
    );
  }

  const looks = lookCount(products);
  const productCount = products.filter((f) => f.report === 'price_list').reduce((sum, f) => sum + f.rowsIn, 0);
  const stockCount = priceLists.reduce((sum, f) => sum + f.stockIn, 0);
  return (
    <Page>
      <Stages />
      <Card id="t-here-s-what-came-across" title="Here’s what came across">
        <ul className="m-0 list-none p-0">
          <Row title="Products" sub={<>{n(productCount)} brought across</>}>
            {looks > 0 ? <Chip tone="warn">{looks} need a look</Chip> : <Chip tone="ok">All in</Chip>}
          </Row>
          <Row title="Stock levels" sub={<>{n(stockCount)} brought across</>}><Chip tone="ok">All in</Chip></Row>
          {LATER_KINDS.map((k) => <Row key={k} title={k}><Chip>Later</Chip></Row>)}
        </ul>
        <DropZone slim title="Drop more files here" onFiles={(f) => void onFiles(f)} />
      </Card>
    </Page>
  );
}
