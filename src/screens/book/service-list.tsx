import * as React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ChoiceCard } from '@/components/ui/choice-card';
import { cn } from '@/lib/utils';
import { BookFrame } from './frame.tsx';
import { useDraft } from './draft.tsx';
import { useServices, type PortalService, type PortalFullService } from './services-query.ts';
import {
  continueError, formatFrom, includesLine, lockedBy, notSurePatch, savedServices, summary, toggle, type Notice,
} from './service-selection.ts';

/**
 * The service list (atlas `service-list`): full services, each category, then
 * "Other", ticked with a Continue button (Jack, 26 Sep). A ticked full service
 * greys out and locks what it includes (hint and lock). Prices read "From £X"
 * under a parts note when the shop shows prices. ?start=full|individual
 * scrolls to that section on arrival.
 * Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
 */
type Section = { key: string; heading: string; services: (PortalService | PortalFullService)[]; individual: boolean };

export function ServiceListScreen() {
  const { shopSlug = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data } = useServices(shopSlug);
  const { draft, update } = useDraft();
  const ticked = draft.serviceIds ?? [];
  const [notices, setNotices] = React.useState<Notice[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  // Bumped on every Continue press that still fails, so a repeated press with
  // the same problem remounts the alert as a fresh node - role="alert" is
  // only re-announced when its content changes or it's new, and unchanged
  // text otherwise goes unheard the second time (M2).
  const [attempt, setAttempt] = React.useState(0);
  const fullHeading = React.useRef<HTMLHeadingElement>(null);
  const individualHeading = React.useRef<HTMLHeadingElement>(null);
  const start = params.get('start');
  const loaded = data !== undefined;

  React.useEffect(() => {
    if (!loaded) return;
    const target = start === 'full' ? fullHeading.current : start === 'individual' ? individualHeading.current : null;
    target?.scrollIntoView({ block: 'start' });
  }, [loaded, start]);

  if (!data) return <BookFrame step={1} title="Choose your services" back={`/book/${shopSlug}`}>{null}</BookFrame>;

  const sections: Section[] = [
    { key: 'full', heading: 'Full services', services: data.full, individual: false },
    ...data.categories.map((c) => ({ key: `c${c.id}`, heading: c.name, services: c.services, individual: true })),
    { key: 'other', heading: 'Other', services: data.uncategorised, individual: true },
  ].filter((s) => s.services.length > 0);
  const firstIndividual = sections.find((s) => s.individual)?.key;

  const tap = (id: number) => {
    const out = toggle(data, ticked, id);
    if (out.ticked === ticked) return;
    setNotices(out.notices);
    setError(null);
    update({ serviceIds: out.ticked, notSure: undefined });
  };
  const onContinue = () => {
    const problem = continueError(data, ticked);
    if (problem) {
      setError(problem);
      setAttempt((a) => a + 1);
      return;
    }
    const ids = savedServices(data, ticked).map((s) => s.id);
    update({ serviceIds: ids, answers: (draft.answers ?? []).filter((a) => ids.includes(a.serviceId)) });
    navigate(`/book/${shopSlug}/problem`);
  };
  const notSure = () => {
    update(notSurePatch);
    navigate(`/book/${shopSlug}/problem`);
  };

  const line = summary(data, ticked);
  return (
    <BookFrame
      step={1}
      title="Choose your services"
      back={`/book/${shopSlug}`}
      action={{ label: 'Continue', onClick: onContinue }}
      actionNote={
        <>
          <p className="m-0" aria-live="polite">
            {[line, ...notices.map((n) => n.text)].filter(Boolean).join(' ')}
          </p>
          {error && <p key={attempt} role="alert" className="m-0 mt-1 text-[var(--wh-danger)]">{error}</p>}
        </>
      }
    >
      {data.showPrices && <p className="m-0 mb-3 text-sm text-[var(--wh-muted)]">Prices are for labour. Parts are quoted separately.</p>}
      {sections.map((section) => (
        <section key={section.key} className="mb-4">
          <h2
            ref={section.key === 'full' ? fullHeading : section.key === firstIndividual ? individualHeading : undefined}
            className="m-0 mb-2 scroll-mt-4 text-base font-semibold"
          >
            {section.heading}
          </h2>
          <div className="flex flex-col gap-2">
            {section.services.map((s) => {
              const lock = lockedBy(data, ticked, s.id);
              const notice = notices.find((n) => n.id === s.id);
              const includes = 'includes' in s ? includesLine(s) : null;
              // A "taken off" notice shows on its row until the next tap, even
              // though that row is now locked; after that the lock text shows.
              const detail = notice ? notice.text : lock ? `Included in your ${lock.name}` : includes;
              return (
                <ChoiceCard
                  key={s.id}
                  title={s.name}
                  detail={detail ?? undefined}
                  price={s.price === null ? undefined : formatFrom(s.price)}
                  selected={ticked.includes(s.id)}
                  aria-disabled={lock ? true : undefined}
                  className={cn(lock && 'cursor-not-allowed bg-[var(--wh-hover)] opacity-60')}
                  onClick={() => tap(s.id)}
                />
              );
            })}
          </div>
        </section>
      ))}
      <button type="button" className="min-h-11 text-sm text-[var(--accent-dark)] underline" onClick={notSure}>
        Not sure what you need? Describe the problem
      </button>
    </BookFrame>
  );
}
