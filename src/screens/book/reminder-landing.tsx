import * as React from 'react';
import { Navigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { BookFrame } from './frame.tsx';
import { useDraft, type BookingDraft } from './draft.tsx';
import { hasProblem } from './require-draft.tsx';
import { useServices } from './services-query.ts';
import { detailsFromReminder } from './details-rules.ts';

/**
 * A service reminder's booking link (openspec/changes/finish-account design 4;
 * drawn as ac-reminder-landing; account and reminders decision 2; Jack, 9 Nov,
 * answer 4). The page the link opens, with no sign-in: it fills a fresh booking
 * with the service, the bike and the customer's details (partly hidden), then
 * opens "When?". A service no longer booked online opens the service step, a
 * removed bike the bike step (question 10). A code that doesn't work opens
 * Book a repair as for anyone.
 */
export type ReminderLink = {
  serviceId: number | null;
  serviceName: string | null;
  bikeId: number | null;
  bikeLabel: string | null;
  details: { name: string | null; phone: string | null };
};

export function ReminderLandingScreen() {
  const { shopSlug = '', code = '' } = useParams();
  const { clear, update } = useDraft();
  const services = useServices(shopSlug);
  const link = useQuery({
    queryKey: ['reminder-link', shopSlug, code],
    queryFn: () => apiGet<ReminderLink>(`/api/portal/${encodeURIComponent(shopSlug)}/reminder-links/${encodeURIComponent(code)}`),
    retry: false,
    staleTime: Infinity,
  });
  const [to, setTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (to !== null) return;
    // A code that doesn't work, or a shop not taking bookings: Book a repair, which says so.
    if (link.isError || services.isError) {
      setTo('');
      return;
    }
    if (!link.data || !services.data) return;
    const v = link.data;
    const draft: BookingDraft = {
      ...(v.serviceId ? { serviceIds: [v.serviceId] } : {}),
      ...(v.bikeLabel ? { bikeNote: v.bikeLabel } : {}),
      // No mobile on her record: updates start on email, as there's no box to type one (review).
      ...(v.details.name !== null && v.details.phone === null ? { updateChannel: 'email' as const } : {}),
      reminder: {
        code, serviceId: v.serviceId, serviceName: v.serviceName, bikeId: v.bikeId, bikeLabel: v.bikeLabel,
        name: v.details.name, phone: v.details.phone, details: v.details.name !== null,
      },
    };
    // A fresh booking: anything in progress, or kept from an earlier visit, gives way.
    clear();
    update(draft);
    setTo(!v.serviceId ? '' : !v.bikeId || !hasProblem(draft, services.data) ? 'problem' : 'date');
  }, [to, link.isError, link.data, services.isError, services.data, code, clear, update]);

  if (to !== null) return <Navigate to={`/book/${shopSlug}${to ? `/${to}` : ''}`} replace />;
  return (
    <BookFrame title="Book a repair">
      <p role="status" className="m-0">Loading…</p>
    </BookFrame>
  );
}

/**
 * The drawn box (ac-reminder-landing): what the reminder chose, while it's
 * still what's chosen, and the details filled in, with Change, which clears
 * them so the details step asks as for anyone. The details step shows the
 * details line alone, in place of name and mobile.
 */
export function ReminderNote({ detailsOnly = false }: { detailsOnly?: boolean }) {
  const { draft, update } = useDraft();
  const r = draft.reminder;
  if (!r) return null;
  const chose = !detailsOnly && !!r.serviceName && !!r.bikeLabel
    && draft.serviceIds?.length === 1 && draft.serviceIds[0] === r.serviceId && draft.bikeNote === r.bikeLabel;
  const details = detailsFromReminder(draft);
  if (!chose && !details) return null;
  return (
    <p className="m-0 mb-3 rounded-lg bg-[var(--wh-surface-muted)] px-3 py-2.5 text-size-15 leading-normal">
      {chose && <>From your reminder: booking the next <strong>{r.serviceName}</strong> for your <strong>{r.bikeLabel}</strong>. Change either above.</>}
      {chose && details && <br />}
      {details && (
        <>
          Your details are filled in from your reminder: <strong>{r.name}</strong>
          {r.phone && <> · <span className="font-mono">{r.phone}</span></>}
          {' · '}
          <button
            type="button"
            aria-label="Change your details"
            className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[var(--wh-ink)] underline"
            onClick={() => update({ reminder: { ...r, details: false } })}
          >
            Change
          </button>
        </>
      )}
    </p>
  );
}
