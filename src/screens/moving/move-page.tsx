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
type MoveFile = {
  id: number; report: 'price_list' | 'barcodes' | null; fileName: string; state: 'reading' | 'cant_read' | 'bringing' | 'done';
  rowsTotal: number; rowsIn: number; rowsSame: number; rowsSkipped: number; rowsLook: number; stockIn: number; stockLook: number;
};
type Sending = { key: string; name: string; problem?: 'cant_read' | 'not_sent' };

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const BUSY_WAIT_MS = 2000;
const BUSY_TRIES = 15;
const KEY = ['move'];
const STAGES = ['Bring your data', 'Run alongside', 'Switch over'];
const REPORTS_NOTE = 'Download these from Citrus Lime, then drop them in together. Nothing in Citrus Lime changes.';
const CANT_READ = 'Wheelhouse couldn’t read this file';

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
const sumOf = (files: MoveFile[], pick: (f: MoveFile) => number) => files.reduce((sum, f) => sum + pick(f), 0);
const dealtWith = (f: MoveFile) => f.rowsIn + f.rowsSame + f.rowsSkipped + f.rowsLook;

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
    refetchInterval: (q) => (q.state.data?.files.some((f) => f.state === 'reading' || f.state === 'bringing') ? 2000 : false),
  });
  const [sends, setSends] = useState<Sending[]>([]);
  const another = useRef<HTMLInputElement>(null);
  const replacing = useRef<{ send?: Sending; fileId?: number } | null>(null);

  // One at a time, so a big drop doesn't send them all at once. A send that got
  // no answer goes again with the same key, so it can't count twice; so does one
  // told the server is busy with another file, after a moment.
  async function post(body: object) {
    for (let tries = 1; ; tries += 1) {
      try {
        return await apiMutate('/api/move/files', body);
      } catch (err) {
        const busy = err instanceof ApiError && err.status === 429;
        if (err instanceof ApiError && !busy) throw err;
        if (tries >= (busy ? BUSY_TRIES : 2)) throw err;
        if (busy) await new Promise((r) => { setTimeout(r, BUSY_WAIT_MS); });
      }
    }
  }
  async function sendOne(file: File) {
    const send: Sending = { key: newRequestKey(), name: file.name };
    setSends((all) => [...all, send]);
    let problem: Sending['problem'];
    try {
      if (file.size > MAX_FILE_BYTES) throw new ApiError(422, {});
      await post({ fileName: file.name, dataBase64: await readAsBase64(file), requestKey: send.key });
    } catch (err) {
      problem = err instanceof ApiError && err.status === 422 ? 'cant_read' : 'not_sent';
    }
    if (!problem) await queryClient.invalidateQueries({ queryKey: KEY });
    setSends((all) => (problem ? all.map((s) => (s === send ? { ...s, problem } : s)) : all.filter((s) => s !== send)));
  }
  async function onFiles(files: File[]) {
    for (const file of files) await sendOne(file);
  }
  // A refused row stays until a file is chosen: going sooner could take the
  // page's file box with it while the owner is still choosing.
  function chooseAnother(what: { send?: Sending; fileId?: number }) {
    replacing.current = what;
    another.current?.click();
  }
  async function anotherChosen(chosen: File[]) {
    if (chosen.length === 0) return;
    const was = replacing.current;
    replacing.current = null;
    if (was?.send) setSends((all) => all.filter((s) => s !== was.send));
    // If this goes wrong the refused row just stays: nothing depends on it.
    if (was?.fileId) await apiMutate(`/api/move/files/${was.fileId}`, {}, { method: 'DELETE' }).catch(() => {});
    await queryClient.invalidateQueries({ queryKey: KEY });
    await onFiles(chosen);
  }

  if (session.status !== 'signed-in') return null;
  if (!isOwner) return <Page><p className="m-0 text-sm">Moving from Citrus Lime is for the shop’s owner.</p></Page>;
  if (move.isError) return <Page><Stages /><p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this. Try again in a moment.</p></Page>;
  if (!move.data) return <Page><Stages /><p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p></Page>;

  const files = move.data.files;
  const products = files.filter((f) => f.report === 'price_list' || f.report === 'barcodes');
  const priceLists = files.filter((f) => f.report === 'price_list');
  const reading = files.filter((f) => f.state === 'reading');
  const refused = files.filter((f) => f.state === 'cant_read');
  const busy = files.some((f) => f.state === 'bringing') || reading.length > 0;
  const hiddenInput = <input ref={another} type="file" multiple hidden aria-label="Choose another file" accept=".xlsx,.csv" onChange={(e) => { void anotherChosen([...(e.target.files ?? [])]); e.target.value = ''; }} />;

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

  if (busy || sends.length > 0 || refused.length > 0) {
    const state = (list: MoveFile[]) => {
      if (list.length === 0) return <Chip>Not added yet</Chip>;
      if (list.every((f) => f.state === 'done')) return <Chip tone="ok">Done</Chip>;
      return <Chip>{list.some((f) => dealtWith(f) > 0) ? 'Bringing across' : 'Waiting'}</Chip>;
    };
    const progress = (list: MoveFile[]) => <>{names(list)} · <span className={mono}>{sumOf(list, dealtWith)}</span> of <span className={mono}>{sumOf(list, (f) => f.rowsTotal)}</span></>;
    const refusedRow = (key: string, name: string, sub: string, chip: string, what: { send?: Sending; fileId?: number }) => (
      <Row key={key} title={name} sub={sub}>
        <span className="flex flex-wrap items-center gap-2">
          <Chip tone="warn">{chip}</Chip>
          <Button variant="default" aria-label={`Choose another file for ${name}`} onClick={() => chooseAnother(what)}>Choose another file</Button>
        </span>
      </Row>
    );
    return (
      <Page>
        <Stages />
        <Card id="t-bringing-your-data-across" title="Bringing your data across">
          <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">You can leave this page — Wheelhouse carries on and shows the result here.</p>
          {hiddenInput}
          <div role="status" aria-live="polite">
            <ul className="m-0 list-none p-0">
              <Row title="Products" sub={products.length ? progress(products) : undefined}>{state(products)}</Row>
              <Row title="Stock levels" sub={priceLists.length ? names(priceLists) : undefined}>{state(priceLists)}</Row>
              {reading.map((f) => <Row key={`r${f.id}`} title={f.fileName}><Chip>Bringing across</Chip></Row>)}
              {refused.map((f) => refusedRow(`f${f.id}`, f.fileName, CANT_READ, 'Couldn’t read it', { fileId: f.id }))}
              {sends.map((s) => (s.problem
                ? refusedRow(s.key, s.name, s.problem === 'cant_read' ? CANT_READ : 'Wheelhouse couldn’t send this file. Try again in a moment.', s.problem === 'cant_read' ? 'Couldn’t read it' : 'Not sent', { send: s })
                : <Row key={s.key} title={s.name}><Chip>Bringing across</Chip></Row>))}
              {LATER_KINDS.map((k) => <Row key={k} title={k}><Chip>Later</Chip></Row>)}
            </ul>
          </div>
        </Card>
      </Page>
    );
  }

  const looks = sumOf(products, (f) => f.rowsLook);
  const stockLooks = sumOf(priceLists, (f) => f.stockLook);
  const productsIn = sumOf(priceLists, (f) => f.rowsIn);
  const productsSame = sumOf(priceLists, (f) => f.rowsSame);
  return (
    <Page>
      <Stages />
      <Card id="t-here-s-what-came-across" title="Here’s what came across">
        <ul className="m-0 list-none p-0">
          <Row title="Products" sub={<>{n(productsIn)} brought across{productsSame > 0 ? <> · {n(productsSame)} already here</> : null}</>}>
            {looks > 0 ? <Chip tone="warn">{looks} need a look</Chip> : <Chip tone="ok">All in</Chip>}
          </Row>
          <Row title="Stock levels" sub={<>{n(sumOf(priceLists, (f) => f.stockIn))} brought across</>}>
            {stockLooks > 0 ? <Chip tone="warn">{stockLooks} need a look</Chip> : <Chip tone="ok">All in</Chip>}
          </Row>
          {LATER_KINDS.map((k) => <Row key={k} title={k}><Chip>Later</Chip></Row>)}
        </ul>
        <DropZone slim title="Drop more files here" onFiles={(f) => void onFiles(f)} />
      </Card>
    </Page>
  );
}
