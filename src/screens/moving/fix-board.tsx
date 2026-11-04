import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { newRequestKey } from '@/screens/book/details-rules.ts';
import { Card, Row } from '@/screens/deliveries/deliveries-bits.tsx';

/**
 * The rows that need a look (mv-fix in moving.mjs; Moving from Citrus Lime decisions
 * 2 and 9, M3; openspec/changes/citrus-import-fix), and Fix, the pop-up for one row
 * (second walk 4 and 4d: what it asks is left for the build). Every button is named
 * after its row. A person decides on a row that looks like someone (answers 3 and 6),
 * one row at a time; the server has the last word on all of it.
 */
type Report = 'price_list' | 'barcodes' | 'customers' | 'bikes';
export type LookRow = { id: number; report: Report; why: string; seen: string; fields: Record<string, string>; sameAs?: { id: number; name: string } };
type Outcome = { id: number; state: 'in' | 'same' | 'skipped' | 'left_out' };

const SHARED = 'Shares contact details with a customer who was deleted';
const SHARED_TICK = 'I’ve checked: this is someone else, not the customer who was deleted';
// Changing one of these means the person ticked about may not be who it's about now.
const WHO_THEY_ARE = new Set(['Email', 'Phone', 'Account Number', 'Email Address', 'Mobile Number', 'Phone Number']);
const ASKS: Record<Report, [string, string][]> = {
  price_list: [['Item Lookup Code', 'Product code'], ['Description', 'Description'], ['Price', 'Price'], ['Store Cost', 'Cost'], ['Tax Rate', 'VAT rate'], ['Qty On Hand', 'Stock'], ['Min (Reorder Point)', 'Reorder level']],
  barcodes: [['ILC', 'Product code'], ['Alias', 'Barcode']],
  customers: [['First Name', 'First name'], ['Last Name', 'Last name'], ['Account Number', 'Account number'], ['Email', 'Email'], ['Phone', 'Phone']],
  bikes: [['Description', 'Description'], ['Serial Number', 'Frame number'], ['Customer Name', 'Customer name'], ['Email Address', 'Email'], ['Mobile Number', 'Mobile'], ['Phone Number', 'Phone']],
};

/** What a row is called: its name, or the best thing it has when it has none. */
function called(row: LookRow, index: number): string {
  const f = row.fields;
  const name = [f['First Name'], f['Last Name']].filter(Boolean).join(' ');
  if (row.report === 'customers') return name || f['Account Number'] || f.Email || f.Phone || `Customer row ${index + 1}`;
  if (row.report === 'bikes') return f.Description || f['Serial Number'] || f['Customer Name'] || `Bike row ${index + 1}`;
  if (row.report === 'barcodes') return f.Alias || f.ILC || `Barcode row ${index + 1}`;
  return f.Description || f['Item Lookup Code'] || `Product row ${index + 1}`;
}

// A request with no answer goes once more with the same key, so it can't count twice.
async function send<T>(path: string, body: object): Promise<T> {
  try {
    return await apiMutate<T>(path, body);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return apiMutate<T>(path, body);
  }
}
const NO_ANSWER = 'Wheelhouse didn’t answer. Try again in a moment.';
const SERVER_SAYS_GONE = new Set(['row_changed', 'row_gone', 'reused_key']);
const gone = (err: unknown) => err instanceof ApiError && SERVER_SAYS_GONE.has((err.body as { code?: string } | null)?.code ?? '');
type Said = { why?: string; decide?: 'shared' | 'same_person'; sameAs?: { id: number; name: string } };

function FixDialog({ row, title, onDone, onGone, onClose }: { row: LookRow; title: string; onDone: (o: Outcome) => void; onGone: (message: string) => void; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...row.fields }));
  const [shared, setShared] = useState(false);
  const [notSame, setNotSame] = useState(false);
  const [asked, setAsked] = useState<Said>({});
  const [failed, setFailed] = useState('');
  const [saving, setSaving] = useState(false);
  // Kept until the server has answered: a save it never answered may have gone through.
  const key = useRef(newRequestKey());
  const sameAs = asked.sameAs ?? row.sameAs;
  const asksShared = row.why === SHARED || asked.decide === 'shared';

  function change(field: string, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (WHO_THEY_ARE.has(field)) { setShared(false); setNotSame(false); }
  }
  async function save() {
    setSaving(true);
    setFailed('');
    try {
      const fields = Object.fromEntries(ASKS[row.report].map(([field]) => [field, values[field] ?? '']));
      const done = await send<Outcome>(`/api/move/rows/${row.id}/fix`, { seen: row.seen, fields, decided: { shared, notSameAs: notSame && sameAs ? sameAs.id : null }, requestKey: key.current });
      onDone(done);
    } catch (err) {
      setSaving(false);
      if (gone(err)) { onGone((err as ApiError).message); return; }
      if (!(err instanceof ApiError)) { setFailed(NO_ANSWER); return; }
      // Refused, so nothing was kept of that try.
      key.current = newRequestKey();
      const said = (err.body ?? {}) as Said;
      setAsked(said);
      setFailed(said.why ?? err.message);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="mv-fix-title" className="md:max-w-[540px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="mv-fix-title">{`Fix ${title}`}</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">{row.why}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {failed ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{failed}</p> : null}
        {ASKS[row.report].map(([field, label]) => (
          <div key={field} className="flex flex-col gap-1.5">
            <label htmlFor={`mv-fix-${field}`} className="text-sm font-semibold">{label}</label>
            <Input id={`mv-fix-${field}`} value={values[field] ?? ''} maxLength={500} onChange={(e) => change(field, e.target.value)} />
          </div>
        ))}
        {asksShared ? <Checkbox label={SHARED_TICK} checked={shared} onChange={(e) => setShared(e.target.checked)} /> : null}
        {sameAs ? <Checkbox label={`This is someone else, not ${sameAs.name}`} checked={notSame} onChange={(e) => setNotSame(e.target.checked)} /> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={saving} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}

const TOLD: Record<Outcome['state'], string> = { in: 'came across', same: 'is already here, so nothing changed', skipped: 'is left out, as they asked', left_out: 'left out' };

/**
 * The board. `action` is its Ask us to help; `count` says how many need a look in all,
 * and `kinds` how many under each heading, from the files, as the list stops at 200.
 */
export function FixBoard({ count, kinds, listKey, action, onDoneForNow, onSorted }: {
  count: number; kinds: { products: number; customers: number }; listKey: unknown[]; action?: ReactNode; onDoneForNow: () => void; onSorted: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: listKey, queryFn: () => apiGet<{ rows: LookRow[]; total: number }>('/api/move/look') });
  const [open, setOpen] = useState<{ row: LookRow; title: string } | null>(null);
  const [said, setSaid] = useState<{ text: string; bad: boolean } | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const rows = list.data?.rows ?? [];
  // The row whose buttons had focus has gone: focus goes to what happened.
  useEffect(() => { if (said) status.current?.focus(); }, [said]);

  async function refresh() {
    await Promise.all([queryClient.invalidateQueries({ queryKey: listKey }), onSorted()]);
  }
  async function sorted(title: string, done: Outcome) {
    setOpen(null);
    setSaid({ text: `${title} ${TOLD[done.state]}`, bad: false });
    await refresh();
  }
  async function gotGone(message: string) {
    setOpen(null);
    setSaid({ text: message, bad: true });
    await refresh();
  }
  async function leaveOut(row: LookRow, title: string) {
    try {
      await sorted(title, await send<Outcome>(`/api/move/rows/${row.id}/leave-out`, { seen: row.seen, requestKey: newRequestKey() }));
    } catch (err) {
      await gotGone(err instanceof ApiError ? err.message : NO_ANSWER);
    }
  }
  const group = (heading: string, n: number, of: LookRow[]) => (of.length === 0 ? null : (
    <>
      <h3 className="m-0 mt-1 text-size-15 font-bold">{`${heading} · ${n}`}</h3>
      <ul className="m-0 list-none p-0">
        {of.map((row) => {
          const title = called(row, rows.indexOf(row));
          return (
            <Row key={row.id} title={title} sub={row.why}>
              <span className="flex gap-2">
                <Button variant="default" aria-label={`Leave out ${title}`} onClick={() => void leaveOut(row, title)}>Leave it out</Button>
                <Button variant="default" aria-label={`Fix ${title}`} onClick={() => setOpen({ row, title })}>Fix</Button>
              </span>
            </Row>
          );
        })}
      </ul>
    </>
  ));
  return (
    <Card id="t-need-a-look" title={`${count} need a look`} action={action}>
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Everything else is in. These didn’t fit, so they’re waiting for you — leave any out and add it by hand later.</p>
      {said ? <p ref={status} tabIndex={-1} role={said.bad ? 'alert' : 'status'} className={`m-0 text-sm font-semibold ${said.bad ? 'text-[var(--wh-danger-hover)]' : ''}`}>{said.text}</p> : null}
      {list.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this. Try again in a moment.</p> : null}
      {group('Products', kinds.products, rows.filter((r) => r.report === 'price_list' || r.report === 'barcodes'))}
      {group('Customers', kinds.customers, rows.filter((r) => r.report === 'customers' || r.report === 'bikes'))}
      {list.data && list.data.total > rows.length ? <p className="m-0 text-size-13 text-[var(--wh-muted)]">{`Showing the first ${rows.length} of ${list.data.total}. The rest show as these are sorted.`}</p> : null}
      <div className="flex justify-end pt-1.5"><Button variant="primary" onClick={onDoneForNow}>Done for now</Button></div>
      {open
        ? <FixDialog key={open.row.id} row={open.row} title={open.title} onClose={() => setOpen(null)} onDone={(o) => void sorted(open.title, o)} onGone={(m) => void gotGone(m)} />
        : null}
    </Card>
  );
}
