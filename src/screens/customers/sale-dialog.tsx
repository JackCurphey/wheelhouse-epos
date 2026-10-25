import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { shortDate } from '@/screens/diary/when.ts';
import { printReceipt, type ReceiptSale, type ShopDetails } from '@/screens/till/receipt.tsx';

/**
 * A sale from a customer's history (cs-sale in customer.mjs; customer service
 * review decisions 2 and 12; openspec/changes/customer-sale-dialog): its lines,
 * the total, how it was paid, and Print the receipt for a sale on the old
 * record. "Refund at the till" waits for refunds; a till sale prints once its
 * receipt exists (design 3).
 */
type Sale = ReceiptSale & {
  source: 'old' | 'till';
  receiptNumber?: number | null;
  customerName: string | null;
  cashierName: string | null;
  paymentMethod: string | null;
};

const mono = 'font-[family-name:var(--wh-font-mono)]';
// "[date], [time]" in the shop's clock (design 2, review).
const when = (at: string) => `${shortDate(at)}, ${new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}`;
const money = (pounds: number) => `£${pounds.toFixed(2)}`;

export function SaleDialog({ id, source, receiptNumber, onClose }: { id: number; source: 'old' | 'till'; receiptNumber: number | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const sale = useQuery({ queryKey: ['sale', source, id], queryFn: () => apiGet<Sale>(`/api/sales/${id}?source=${source}`) });
  const title = `Sale ${receiptNumber ?? id}`;
  async function print() {
    if (!sale.data) return;
    const details = await queryClient.fetchQuery({ queryKey: ['shop-details'], queryFn: () => apiGet<ShopDetails & { name: string }>('/api/shop-details') }).catch(() => undefined);
    printReceipt({ details, sale: sale.data, shopName: details?.name ?? '' });
  }
  const s = sale.data;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="sale-title" className="md:max-w-[560px]">
      <DialogHeader>
        <DialogTitle id="sale-title">{title}</DialogTitle>
        {s ? (
          <p className="m-0 text-sm text-[var(--wh-muted)]">
            {[when(s.createdAt), s.cashierName ? `served by ${s.cashierName}` : null, s.customerName].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </DialogHeader>
      <DialogBody className="flex flex-col">
        {sale.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load this sale. Try again in a moment.</p>
          : !s ? <p className="m-0 text-sm text-[var(--wh-muted)]">Loading…</p>
          : (
            <>
              <ul className="m-0 list-none p-0">
                {s.items.map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-3 border-t border-[var(--wh-border)] py-2.5">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-size-15">{l.name}</span>
                      <span className="text-size-13 text-[var(--wh-muted)]">{`× ${l.qty}`}</span>
                    </span>
                    <span className={`text-size-15 ${mono}`}>{money(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between border-t border-[var(--wh-ink)] py-2.5">
                <span className="text-base font-bold">Total</span>
                <span className={`text-lg ${mono}`}>{money(s.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-[var(--wh-muted)]">
                <span>Paid by</span>
                <span>{s.paymentMethod ?? '—'}</span>
              </div>
            </>
          )}
      </DialogBody>
      <DialogFooter>
        {s && s.source === 'old' ? <Button variant="ghost" onClick={print}>Print the receipt</Button> : null}
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}
