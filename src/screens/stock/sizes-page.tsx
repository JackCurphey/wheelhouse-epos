import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { apiGet, apiMutate, ApiError, serverSaid } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { useMedia } from '@/screens/diary/diary-bits.tsx';
import { ROUTES } from '@/staff/routes.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Box, kv, StockHistory, type Line, type ShopStock } from './product-page.tsx';
import { Field, field, NONE, pence, pounds } from './product-box.tsx';
import { useCategoryList } from './stock-list-bits.tsx';
import { count, margin, money, mono, productHref, type Product } from './stock-bits.tsx';

/**
 * A product with sizes' page (drawn as st-product-sizes in stock.mjs; stock control decision 4;
 * openspec/changes/product-page-sizes, design 3): its codes, its stock at each shop and its
 * prices on the left; on the right the grid, sizes across and colours down, each cell its own
 * stock and opening that size's page, then one history for all its sizes. The Owner adds a size
 * or colour and edits its name and category (decision 11). Adjusting is on each size's page, as
 * the grid's note says.
 */
type Item = Omit<Product, 'showOnline' | 'photoUrl'> & { size: string | null; colour: string | null };
type Group = {
  id: number; name: string; category: string; sizes: string[]; colours: string[]; items: Item[];
  vatRateBp: number | null; stockAtShops: ShopStock[]; history: Line[];
};
const several = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const range = (values: number[]) => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
};
const words = (err: unknown, what: string) => (serverSaid(err) ? err.message : `Wheelhouse couldn’t ${what}. Try again in a moment.`);
const label = 'text-sm font-semibold';

function SaveFooter({ why, busy, saveLabel, onSave, onClose, id }: { why: string | null; busy: boolean; saveLabel: string; onSave: () => void; onClose: () => void; id: string }) {
  return (
    <DialogFooter className="items-start justify-between">
      <Button onClick={onClose}>Cancel</Button>
      <span className="flex flex-col items-end gap-1">
        <Button variant="primary" aria-disabled={why || busy ? true : undefined} aria-describedby={why ? id : undefined}
          className={why ? 'opacity-45' : undefined} onClick={onSave}>{saveLabel}</Button>
        {why ? <span id={id} className="text-size-13 text-[var(--wh-muted)]">{why}</span> : null}
      </span>
    </DialogFooter>
  );
}

function useSave(groupId: number, what: string, onClose: () => void) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/product-groups/${groupId}`, body, { method: 'PUT' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['product-group', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
      onClose();
    } catch (err) {
      setError(words(err, what));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, save };
}

/** + Add a size or colour: one new size, its price the first size's to start. */
function AddSize({ group, onClose }: { group: Group; onClose: () => void }) {
  const [size, setSize] = useState('');
  const [colour, setColour] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState(pounds(group.items[0]?.pricePence));
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('0');
  const { busy, error, save } = useSave(group.id, 'add the size', onClose);
  const pricePence = pence(price);
  const costPence = cost.trim() ? pence(cost) : null;
  const stockQty = /^-?\d{1,6}$/.test(stock.trim()) ? Number(stock.trim()) : null;
  const why = !size.trim() && !colour.trim() ? 'Type a size or a colour'
    : pricePence === null ? 'Type a price in pounds, like 28.00'
    : cost.trim() && costPence === null ? 'Type the cost in pounds, or leave it blank'
    : stockQty === null ? 'Starting stock is a whole number'
    : null;
  const add = () => {
    if (why || busy) return;
    void save({ sizes: [{ size: size.trim(), colour: colour.trim(), barcode: barcode.trim(), sku: sku.trim(), pricePence, ...(costPence === null ? {} : { costPence }), stockQty }] });
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="as-title" className="md:max-w-[620px]">
      <DialogHeader className="flex-col items-start gap-1">
        <DialogTitle id="as-title">Add a size or colour</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{group.name}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3"><Field id="as-size" name="Size" value={size} onChange={setSize} /><Field id="as-colour" name="Colour" value={colour} onChange={setColour} /></div>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1"><Field id="as-barcode" name="Barcode" value={barcode} onChange={setBarcode} mono /><Field id="as-code" name="Supplier code" value={sku} onChange={setSku} mono /></div>
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2">
          <Field id="as-cost" name="Cost" value={cost} onChange={setCost} mono />
          <Field id="as-price" name="Price" value={price} onChange={setPrice} mono />
          <Field id="as-stock" name="Starting stock" value={stock} onChange={setStock} mono />
        </div>
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">It gets its own barcode and stock, and is named {[group.name, size.trim(), colour.trim()].filter(Boolean).join(' ')}.</p>
        {error ? <p role="alert" className="m-0 text-sm">{error}</p> : null}
      </DialogBody>
      <SaveFooter id="as-why" why={why} busy={busy} saveLabel="Add" onSave={add} onClose={onClose} />
    </Dialog>
  );
}

/** Edit: its name and category, which every size follows (answer 9). */
function EditGroup({ group, onClose }: { group: Group; onClose: () => void }) {
  const categories = useCategoryList();
  const [name, setName] = useState(group.name);
  const [category, setCategory] = useState(group.category);
  const { busy, error, save } = useSave(group.id, 'save the product', onClose);
  const paths = (categories.data ?? []).map((c) => c.path);
  if (category !== NONE && !paths.includes(category)) paths.unshift(category);
  const why = name.trim() ? null : 'Type its name';
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="eg-title" className="md:max-w-[560px]">
      <DialogHeader className="flex-col items-start gap-1">
        <DialogTitle id="eg-title">Edit product</DialogTitle>
        <p className="m-0 text-sm text-[var(--wh-muted)]">{group.name}</p>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <Field id="eg-name" name="Name" value={name} onChange={setName} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="eg-cat" className={label}>Category</label>
          <select id="eg-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            <option value={NONE}>No category</option>
            {paths.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <p className="m-0 text-size-13 text-[var(--wh-muted)]">Every size and colour follows, named with its size and colour. Each size’s price and barcode are on its own page.</p>
        {error ? <p role="alert" className="m-0 text-sm">{error}</p> : null}
      </DialogBody>
      <SaveFooter id="eg-why" why={why} busy={busy} saveLabel="Save" onSave={() => { if (!why && !busy) void save({ name: name.trim(), category }); }} onClose={onClose} />
    </Dialog>
  );
}

function Grid({ group }: { group: Group }) {
  const sizes: (string | null)[] = group.sizes.length ? group.sizes : [null];
  const colours: (string | null)[] = group.colours.length ? group.colours : [null];
  const th = 'py-1.5 text-size-13 font-semibold text-[var(--wh-muted)]';
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">Stock by size and colour</caption>
      <thead><tr><th scope="col" className={`${th} text-left`}>Colour</th>{sizes.map((z) => <th key={z ?? '-'} scope="col" className={th}>{z ?? 'Stock'}</th>)}</tr></thead>
      <tbody>
        {colours.map((c) => (
          <tr key={c ?? '-'}>
            <th scope="row" className="border-t border-[var(--wh-border)] text-left text-size-15 font-semibold">{c ?? '—'}</th>
            {sizes.map((z) => {
              const item = group.items.find((i) => i.size === z && i.colour === c);
              if (!item) return <td key={z ?? '-'} className="border-t border-[var(--wh-border)]" />;
              const q = item.stockQty;
              const said = q < 0 ? `${count(q)}, below zero` : q === 0 ? 'none in stock' : `${q} in stock`;
              const which = [c, z ? `size ${z}` : null].filter(Boolean).join(', ');
              return (
                <td key={z ?? '-'} className="border-t border-[var(--wh-border)] p-0">
                  <Link to={productHref(item.id)} aria-label={`${which}: ${said}`}
                    className={`flex min-h-[52px] items-center justify-center gap-1.5 text-size-15 font-bold no-underline ${mono} ${q < 0 ? 'bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]' : q === 0 ? 'text-[var(--wh-muted)]' : 'text-[var(--wh-ink)]'}`}>
                    {q < 0 ? <AlertTriangle aria-hidden="true" size={13} /> : null}{count(q)}
                  </Link>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SizesPage() {
  const id = Number(useParams().id ?? '');
  const known = Number.isInteger(id);
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const isPhone = useMedia('(max-width: 767px)');
  const [open, setOpen] = useState<'edit' | 'add' | null>(null);
  const query = useQuery({ queryKey: ['product-group', id], queryFn: () => apiGet<Group>(`/api/product-groups/${id}`), retry: false, enabled: known });
  if (!known || query.isError) {
    return <p role="alert" className="m-0 text-sm">{!known || (query.error instanceof ApiError && query.error.status === 404) ? 'Product not found' : 'Wheelhouse couldn’t load this product. Try again in a moment.'}</p>;
  }
  const g = query.data;
  if (!g) return <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>;
  const codes = [g.category, several(g.sizes.length, 'size', 'sizes'), several(g.colours.length, 'colour', 'colours')].join(' · ');
  const prices = g.items.map((i) => i.pricePence);
  const costs = g.items.map((i) => i.costPence).filter((c): c is number => c !== null);
  const showCost = owner && costs.length > 0;
  // One margin only when every size has one price, one cost and one VAT rate (as the list's row).
  const one = new Set(prices).size === 1 && costs.length === g.items.length && new Set(costs).size === 1;
  const m = one && g.items.length ? margin({ pricePence: prices[0], costPence: costs[0], vatRateBp: g.vatRateBp }) : null;
  return (
    <div className="flex flex-col gap-3.5">
      <Link to={ROUTES.stock} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline"><span aria-hidden="true">‹</span>Stock</Link>
      <h2 className="m-0 text-size-22 font-bold">{g.name}</h2>
      <div className={`grid items-start gap-3.5 ${isPhone ? 'grid-cols-1' : 'grid-cols-[minmax(0,380px)_minmax(0,1fr)]'}`}>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col items-start gap-1.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-4">
            <span className="text-size-13 text-[var(--wh-muted)]">{codes}</span>
            {owner ? <Button onClick={() => setOpen('edit')}>Edit</Button> : null}
          </div>
          <Box id="h-in-stock" title="In stock">
            {g.stockAtShops.map((s) => <Fragment key={s.id}>{kv(s.name, <span className={mono}>{count(s.qty)}</span>)}</Fragment>)}
          </Box>
          <Box id="h-price" title={showCost ? 'Price and cost' : 'Price'}>
            {prices.length ? kv('Price', <span className={mono}>{range(prices)}</span>) : null}
            {showCost ? kv('Cost', <span className={mono}>{range(costs)}</span>) : null}
            {showCost ? kv('Margin', m === null ? '—' : `${m}%`) : null}
            {kv('VAT', g.vatRateBp === null ? '—' : `${g.vatRateBp / 100}%`)}
          </Box>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Box id="h-sizes" title="Sizes and colours"
            action={owner ? <button type="button" onClick={() => setOpen('add')} className="inline-flex min-h-11 items-center border-0 bg-transparent px-1 text-sm font-semibold text-[var(--wh-ink)] underline">+ Add a size or colour</button> : null}>
            <Grid group={g} />
            <p className="m-0 text-size-13 text-[var(--wh-muted)]">Each size and colour has its own barcode. Open one to see its history or adjust it. 0 means none in stock; a size below zero needs counting.</p>
          </Box>
          <StockHistory history={g.history} />
        </div>
      </div>
      {open === 'add' ? <AddSize group={g} onClose={() => setOpen(null)} /> : null}
      {open === 'edit' ? <EditGroup group={g} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
