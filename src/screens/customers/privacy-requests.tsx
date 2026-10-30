import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { apiGet, apiMutate, ApiError } from '@/lib/api/client.ts';
import { useSession } from '@/lib/auth/use-session.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { ROUTES } from '@/staff/routes.ts';

/**
 * The shop's privacy requests (openspec/changes/delete-account design 7;
 * drawn as cs-privacy, ac-privacy-requests and cs-privacy-delete in
 * customer.mjs and account.mjs; customer service decision 9; coverage walks
 * answers 4 and 5; Jack's 30 Oct answer 3): each request, dated, answered
 * within a month, and Delete their details, the Owner only. "+ Log a
 * request" and "Send the copy" aren't built yet, so aren't shown.
 */
export type InTheWay = { jobId: number; reference: string };
type Request = {
  id: number; reference: string; customerId: number | null; name: string | null; kind: 'copy' | 'delete'; source: 'account' | 'shop';
  askedOn: string; dueBy: string; overdue: boolean; doneOn: string | null; inTheWay: InTheWay[];
};
type List = { requests: Request[]; openCount: number };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A shop's day, "2026-09-01", as the staff app writes a day: "Tue 1 Sep". */
export const dayText = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
};
const WHAT = { copy: 'Copy of their data', delete: 'Delete their details' } as const;
const inTheWayLine = (refs: InTheWay[]) => `Still in the way: bike in the workshop, ${refs.map((r) => r.reference).join(', ')}`;
const FROM = { account: 'From their account on the website', shop: '' } as const;

/** "Privacy requests · [n] open", at the foot of Customers (cs-list), for the Owner. */
export function PrivacyLink() {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const count = useQuery({ queryKey: ['privacy-requests', 'open-count'], queryFn: () => apiGet<{ openCount: number }>('/api/privacy-requests/open-count'), enabled: owner });
  if (!owner || !count.data) return null;
  return (
    <div className="flex justify-end">
      <Link to={ROUTES['cs-privacy']} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--wh-ink)]">{`Privacy requests · ${count.data.openCount} open`}</Link>
    </div>
  );
}

/** A waiting request on the customer's page (ac-customer-delete). */
export function DeletionLine({ request }: { request: { askedOn: string; dueBy: string; source: 'account' | 'shop'; inTheWay: InTheWay[] } }) {
  const from = request.source === 'account' ? ' · from their account on the website' : '';
  return (
    <p role="note" className="m-0 flex items-start gap-2.5 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-3 text-size-15 leading-snug text-[var(--wh-warn-ink)]">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
      <span><strong>{`Asked to delete their account on ${dayText(request.askedOn)}`}</strong>{`${from} · answer by ${dayText(request.dueBy)}.${request.inTheWay.length ? ` ${inTheWayLine(request.inTheWay)}.` : ''}`}</span>
    </p>
  );
}

function Row({ r, onDelete }: { r: Request; onDelete: (r: Request) => void }) {
  const open = r.doneOn === null;
  const blocked = open && r.inTheWay.length > 0;
  const whyId = `pr-why-${r.id}`;
  const sub = open
    ? `${r.overdue ? 'Overdue · ' : ''}${FROM[r.source] ? `${FROM[r.source]} · asked` : 'Asked'} ${dayText(r.askedOn)} · answer by ${dayText(r.dueBy)}`
    : `Asked ${dayText(r.askedOn)} · done ${dayText(r.doneOn as string)}`;
  return (
    <li className="flex min-h-[60px] flex-wrap items-center gap-3 border-t border-[var(--wh-border)] px-3.5 py-2 first:border-t-0">
      <span className="flex min-w-[200px] grow flex-col gap-0.5">
        <span className="text-size-15 font-bold">{`${r.name ?? r.reference} · ${WHAT[r.kind]}`}</span>
        <span className={r.overdue && open ? 'text-size-13 font-bold text-[var(--wh-warn-ink)]' : 'text-size-13 text-[var(--wh-muted)]'}>{sub}</span>
        {blocked ? <span className="text-size-13 font-bold text-[var(--wh-warn-ink)]">{inTheWayLine(r.inTheWay)}</span> : null}
      </span>
      {!open ? <span className="text-sm text-[var(--wh-muted)]">Done</span>
        : r.kind === 'delete' ? <Button variant="danger" disabled={blocked} aria-describedby={blocked ? whyId : undefined} onClick={() => onDelete(r)}>Delete their details</Button>
        : null}
      {blocked ? <span id={whyId} className="basis-full text-size-13 text-[var(--wh-muted)]">Can be deleted once the bike is collected.</span> : null}
    </li>
  );
}

// "Delete [name]'s details?" (cs-privacy-delete).
function DeleteDialog({ r, onClose }: { r: Request; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/privacy-requests/${r.id}/delete`, {}, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['privacy-requests'] });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.hasServerMessage ? err.message : 'That didn’t go through. Check your connection and try again.');
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} aria-labelledby="del-title" className="md:max-w-[560px]">
      <DialogHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle id="del-title">{`Delete ${r.name ?? r.reference}’s details?`}</DialogTitle>
          <span className="text-size-13 text-[var(--wh-muted)]">{`A privacy request asked on ${dayText(r.askedOn)}`}</span>
        </div>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <p className="m-0 text-sm text-[var(--wh-muted)]">Their name, phone, email, address, note and bikes are removed. Sales and jobs stay in the books without their name, because the shop must keep them for tax. This can’t be undone.</p>
        {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
      </DialogBody>
      <DialogFooter className="flex justify-end gap-2.5">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Keep their details</Button>
        <Button variant="danger" disabled={busy} onClick={() => void remove()}>Delete their details</Button>
      </DialogFooter>
    </Dialog>
  );
}

export function PrivacyRequestsPage() {
  const session = useSession();
  const owner = session.status === 'signed-in' && session.user.isOwner;
  const list = useQuery({ queryKey: ['privacy-requests', 'list'], queryFn: () => apiGet<List>('/api/privacy-requests'), enabled: owner, retry: false });
  const [deleting, setDeleting] = useState<Request | null>(null);
  const back = <Link to={ROUTES.customers} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline"><span aria-hidden="true">‹</span>Customers</Link>;
  if (session.status === 'signed-in' && !owner) {
    return <div className="flex flex-col gap-2.5">{back}<p className="m-0 text-sm">Only the shop’s owner can see privacy requests.</p></div>;
  }
  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-3.5">
      {back}
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-size-22 font-bold">Privacy requests</h2>
        <p className="m-0 text-sm text-[var(--wh-muted)]">When someone asks for a copy of what the shop holds about them, or for it to be deleted. Answer within one month.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)]">
        {list.isError ? <p role="alert" className="m-0 px-3.5 py-3 text-sm">Wheelhouse couldn’t load the privacy requests. Try again in a moment.</p>
          : !list.data ? <p className="m-0 px-3.5 py-3 text-sm text-[var(--wh-muted)]">Loading…</p>
          : list.data.requests.length === 0 ? <p className="m-0 px-3.5 py-3 text-sm text-[var(--wh-muted)]">No privacy requests yet.</p>
          : <ul aria-label="Privacy requests" className="m-0 list-none p-0">{list.data.requests.map((r) => <Row key={r.id} r={r} onDelete={setDeleting} />)}</ul>}
      </div>
      {deleting ? <DeleteDialog r={deleting} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}
