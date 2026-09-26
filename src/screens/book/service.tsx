import { useNavigate, useParams } from 'react-router';
import { ChoiceCard } from '@/components/ui/choice-card';
import { BookFrame } from './frame.tsx';
import { useDraft } from './draft.tsx';
import { useServices } from './services-query.ts';
import { notSurePatch } from './service-selection.ts';

/**
 * The first book screen (atlas `service`): three fixed options (Jack, 24 Sep),
 * each going straight on when tapped (26 Sep). Full and Individual open the
 * one shared list at their section; Not sure skips to describing the problem.
 * A kind the shop has no services of is hidden.
 * Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
 */
export function ServiceScreen() {
  const { shopSlug = '' } = useParams();
  const navigate = useNavigate();
  const { data } = useServices(shopSlug);
  const { update } = useDraft();
  const base = `/book/${shopSlug}`;
  const hasFull = (data?.full.length ?? 0) > 0;
  const hasIndividual = (data?.categories.length ?? 0) > 0 || (data?.uncategorised.length ?? 0) > 0;

  const openList = (start: 'full' | 'individual') => {
    update({ notSure: undefined });
    navigate(`${base}/services?start=${start}`);
  };
  const notSure = () => {
    update(notSurePatch);
    navigate(`${base}/problem`);
  };

  return (
    <BookFrame step={1} title="What do you need?">
      {!hasFull && !hasIndividual ? (
        <p>This shop isn't taking bookings online at the moment - please contact them directly</p>
      ) : (
        <div className="flex flex-col gap-2">
          {hasFull && <ChoiceCard title="Full services" detail="Whole-bike services" onClick={() => openList('full')} />}
          {hasIndividual && (
            <ChoiceCard title="Individual services" detail="Single jobs, like brakes or gears" onClick={() => openList('individual')} />
          )}
          <ChoiceCard title="Not sure" detail="Tell us what's wrong and we'll advise" onClick={notSure} />
        </div>
      )}
    </BookFrame>
  );
}
