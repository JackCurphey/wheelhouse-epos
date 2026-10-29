import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiMutate } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, Row, day } from './deliveries-bits.tsx';

/**
 * To return to [Supplier] on Deliveries and orders (rs-hub in receiving.mjs,
 * hubBoard's To return section; openspec/changes/to-return; receiving
 * decisions 9 and 10): the damaged and wrong items set aside at booking in,
 * one section per supplier, only when something is on it, each with
 * Returned. The Owner's, as orders are (decision 4), until roles.
 */
type Item = { id: number; productName: string; kind: 'damaged' | 'wrong_item'; qty: number; deliveredAt: string };
type Group = { supplierId: number | null; supplierName: string | null; items: Item[] };
const QUERY = ['deliveries', 'to-return'];
const KIND = { damaged: 'Damaged', wrong_item: 'Wrong item' } as const;
const words = (err: unknown) => (err instanceof ApiError && err.status < 500 && err.hasServerMessage ? err.message : 'Wheelhouse couldn’t save that. Try again in a moment.');

export function ToReturn() {
  const list = useQuery({ queryKey: QUERY, queryFn: () => apiGet<{ suppliers: Group[] }>('/api/deliveries/to-return') });
  // A list that can't be loaded says so, as Orders does, rather than looking
  // like nothing to return (the review of #582).
  if (list.isError) {
    return (
      <Card id="t-to-return-error" title="To return">
        <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the items to return. Try again in a moment.</p>
      </Card>
    );
  }
  // A reply of another shape shows nothing.
  const groups = Array.isArray(list.data?.suppliers) ? list.data.suppliers : [];
  return <>{groups.map((g) => <SupplierSection key={g.supplierId ?? 'none'} group={g} />)}</>;
}

function SupplierSection({ group }: { group: Group }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = `t-to-return-${group.supplierId ?? 'none'}`;
  async function returned(item: Item) {
    setBusy(item.id);
    setError(null);
    try {
      await apiMutate(`/api/deliveries/to-return/${item.id}/returned`, {});
      await queryClient.invalidateQueries({ queryKey: QUERY });
    } catch (err) {
      setError(words(err));
      // Refused (say, already returned elsewhere): read the list again, so a
      // stale line goes (the review of #582).
      await queryClient.invalidateQueries({ queryKey: QUERY });
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card id={id} title={group.supplierName ? `To return to ${group.supplierName}` : 'To return'}>
      <ul aria-labelledby={id} className="m-0 list-none p-0">
        {group.items.map((item) => (
          <Row key={item.id} title={item.productName} sub={`${KIND[item.kind]} · ${item.qty} · from the delivery on ${day(item.deliveredAt)}`}>
            <Button variant="default" disabled={busy === item.id} aria-label={`Returned: ${item.productName}, ${KIND[item.kind].toLowerCase()}`}
              onClick={() => void returned(item)}>Returned</Button>
          </Row>
        ))}
      </ul>
      {error ? <p role="alert" className="m-0 text-sm text-[var(--wh-danger)]">{error}</p> : null}
    </Card>
  );
}
