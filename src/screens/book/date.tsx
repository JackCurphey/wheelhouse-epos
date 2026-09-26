import * as React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { DayDiary } from '@/components/ui/day-diary';
import { MonthCalendar } from '@/components/ui/month-calendar';
import { PillGroup } from '@/components/ui/pill-group';
import { BookFrame } from './frame.tsx';
import { useDraft, type BookingDraft } from './draft.tsx';
import { RequireDraft, hasProblem } from './require-draft.tsx';
import { useServices, type ServicesResponse } from './services-query.ts';
import {
  useAvailability, useMechanics, type AvailabilityResponse, type DropoffDay, type MechanicsResponse, type TimedDay,
} from './date-query.ts';
import {
  ANY_MECHANIC, availableDays, bookingRange, choiceStillFree, continueMessage, diaryColumns, dropoffOptions, initialMonth,
  jobMinutes, localToday, pickedDay, resolveMechanic, summaryText, type BookingRange,
} from './date-rules.ts';

/**
 * The date screen (atlas `date`, step 3): a month calendar for this month and
 * next; on a timed day, mechanic pills and the one-day diary (every mechanic
 * shown, one column each; tapping a free time picks that mechanic and time);
 * on a drop-off day, the drop-off window and a mechanic choice starting on
 * "Any mechanic". A summary is pinned above Continue. Nothing is sent until
 * d5.
 * Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
 */
const TITLE = 'When can you drop in?';

export function DateScreen() {
  const { shopSlug = '' } = useParams();
  const { data } = useServices(shopSlug);
  const back = `/book/${shopSlug}/problem`;
  // hasProblem reads the services' questions, so the guard waits for
  // /services; until then only the frame shows (its own loading and failed
  // states).
  if (!data) return <BookFrame step={3} title={TITLE} back={back}>{null}</BookFrame>;
  return (
    <RequireDraft has={(d) => hasProblem(d, data)} to="problem">
      <DateLoader services={data} back={back} />
    </RequireDraft>
  );
}

function DateLoader({ services, back }: { services: ServicesResponse; back: string }) {
  const { shopSlug = '' } = useParams();
  const { draft } = useDraft();
  // The server refuses minutes=0 (piece 10): if every ticked service has
  // since left /services (removed from the shop's list since the draft was
  // made), there is nothing bookable to ask for - back to services instead
  // of requesting availability (controller ruling, 26 Sep). This is checked
  // before any fetching component mounts, so neither /mechanics nor
  // /availability is asked for.
  if (jobMinutes(services, draft) === 0) return <Navigate to={`/book/${shopSlug}/services`} replace />;
  return <DateFetcher services={services} draft={draft} shopSlug={shopSlug} back={back} />;
}

type FetcherProps = { services: ServicesResponse; draft: BookingDraft; shopSlug: string; back: string };

function DateFetcher({ services, draft, shopSlug, back }: FetcherProps) {
  // Fixed when the screen opens: the device's date (see localToday).
  const [range] = React.useState(() => bookingRange(localToday(new Date())));
  const mechanics = useMechanics(shopSlug);
  const availability = useAvailability(shopSlug, { start: range.start, end: range.end, minutes: jobMinutes(services, draft) });

  // A background refetch failing (React Query keeps the last good data and
  // sets isError) must not tear down an already-shown picker: only show the
  // failure state when there is no data to fall back on.
  if ((mechanics.isError && !mechanics.data) || (availability.isError && !availability.data)) {
    const retry = () => {
      if (mechanics.isError) void mechanics.refetch();
      if (availability.isError) void availability.refetch();
    };
    return (
      <BookFrame step={3} title={TITLE} back={back}>
        <p role="alert" className="m-0 mb-3">We couldn&apos;t load the free days</p>
        <Button variant="accent" onClick={retry}>Try again</Button>
      </BookFrame>
    );
  }
  if (!mechanics.data || !availability.data) {
    return (
      <BookFrame step={3} title={TITLE} back={back}>
        <p role="status">Loading…</p>
      </BookFrame>
    );
  }
  return <DatePicker range={range} mechanics={mechanics.data} availability={availability.data} back={back} />;
}

type PickerProps = { range: BookingRange; mechanics: MechanicsResponse; availability: AvailabilityResponse; back: string };

function DatePicker({ range, mechanics, availability, back }: PickerProps) {
  const { shopSlug = '' } = useParams();
  const navigate = useNavigate();
  const { draft, update } = useDraft();
  const available = React.useMemo(() => availableDays(availability), [availability]);
  const [month, setMonth] = React.useState(() => initialMonth(range, draft, available));
  // The mechanics whose diary columns show; null means all of them (every
  // mechanic is on when a day is picked).
  const [shown, setShown] = React.useState<number[] | null>(null);
  // The Continue message shows only after a press, then follows the draft.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed Continue so the alert is a new node and is
  // announced again (as on the service list).
  const [attempt, setAttempt] = React.useState(0);

  // A saved choice no longer offered (after a refresh, or availability
  // fetched again) is cleared, with a message until the next pick. Each new
  // availability answer is checked once, while rendering (React's "adjust
  // state when a prop changes"; lint forbids setting state inside an effect).
  // The effect then clears the stored choice, one render later.
  const [checkedAvailability, setCheckedAvailability] = React.useState<AvailabilityResponse | null>(null);
  const [taken, setTaken] = React.useState(false);
  const stale = !choiceStillFree(availability, draft);
  if (checkedAvailability !== availability) {
    setCheckedAvailability(availability);
    if (stale) setTaken(true);
  }
  React.useEffect(() => {
    if (stale) update({ date: undefined, mechanicId: undefined, startTime: undefined });
  }, [stale, update]);

  const day = pickedDay(availability, draft.date);
  const message = checked ? continueMessage(availability, draft) : null;
  const noDays = available.size === 0;

  const pickDay = (date: string) => {
    setTaken(false);
    setChecked(false);
    setShown(null);
    if (date !== draft.date) update({ date, mechanicId: undefined, startTime: undefined });
  };
  const pickTime = (date: string, mechanicId: number, startTime: string) => {
    setTaken(false);
    update({ date, mechanicId, startTime });
  };
  const pickMechanic = (value: string) => {
    setTaken(false);
    update({ mechanicId: value === ANY_MECHANIC ? undefined : Number(value), startTime: undefined });
  };

  const onContinue = () => {
    if (continueMessage(availability, draft) !== null) {
      setChecked(true);
      setAttempt((a) => a + 1);
      return;
    }
    // "Any mechanic" is never stored: it becomes the first bookable mechanic
    // in the shop's order now.
    if (day?.mode === 'dropoff' && draft.mechanicId === undefined) {
      update({ mechanicId: resolveMechanic(day, mechanics.mechanics) ?? undefined });
    }
    navigate(`/book/${shopSlug}/details`);
  };

  return (
    <BookFrame
      step={3}
      title={TITLE}
      back={back}
      action={noDays ? undefined : { label: 'Continue', onClick: onContinue }}
      actionNote={
        noDays ? undefined : (
          <>
            <p className="m-0 min-h-5" aria-live="polite">{summaryText(availability, draft, mechanics.mechanics)}</p>
            {message && <p key={attempt} role="alert" className="m-0 mt-1 text-[var(--wh-danger)]">{message}</p>}
          </>
        )
      }
    >
      {taken && (
        <p role="alert" className="m-0 mb-3 rounded-md bg-[var(--wh-warn-bg)] p-2.5 text-sm text-[var(--wh-warn-ink)]">
          That time has just been taken - please choose another
        </p>
      )}
      {noDays ? (
        <p className="m-0">There are no free days in the next two months - please contact the shop</p>
      ) : (
        <>
          <MonthCalendar
            month={month}
            onMonthChange={(m) => {
              if (range.months.includes(m)) setMonth(m);
            }}
            available={available}
            value={day ? day.date : null}
            onChange={pickDay}
            className="mb-4"
          />
          {day?.mode === 'timed' && (
            <TimedDayPicker
              day={day}
              availability={availability}
              mechanics={mechanics}
              shown={shown ?? mechanics.mechanics.map((m) => m.id)}
              onShow={setShown}
              draft={draft}
              onPick={(mechanicId, startTime) => pickTime(day.date, mechanicId, startTime)}
            />
          )}
          {day?.mode === 'dropoff' && <DropoffDayPicker day={day} mechanics={mechanics} draft={draft} onPick={pickMechanic} />}
        </>
      )}
    </BookFrame>
  );
}

type TimedProps = {
  day: TimedDay;
  availability: AvailabilityResponse;
  mechanics: MechanicsResponse;
  shown: number[];
  onShow: (ids: number[]) => void;
  draft: BookingDraft;
  onPick: (mechanicId: number, startTime: string) => void;
};

function TimedDayPicker({ day, availability, mechanics, shown, onShow, draft, onPick }: TimedProps) {
  const hours = { open: mechanics.openingTime, close: mechanics.closingTime };
  const picked = draft.mechanicId !== undefined && draft.startTime
    ? { columnId: String(draft.mechanicId), time: draft.startTime }
    : null;
  // The last mechanic on can't be turned off: an empty choice is ignored.
  const onPills = (ids: string[]) => {
    if (ids.length > 0) onShow(ids.map(Number));
  };
  return (
    <>
      <PillGroup
        multiple
        legend="Mechanic"
        options={mechanics.mechanics.map((m) => ({ value: String(m.id), label: m.name }))}
        value={shown.map(String)}
        onChange={onPills}
        className="mb-3"
      />
      <DayDiary
        open={hours.open}
        close={hours.close}
        columns={diaryColumns(availability, day, mechanics.mechanics, shown, hours)}
        value={picked}
        onChange={(v) => onPick(Number(v.columnId), v.time)}
      />
    </>
  );
}

type DropoffProps = { day: DropoffDay; mechanics: MechanicsResponse; draft: BookingDraft; onPick: (value: string) => void };

function DropoffDayPicker({ day, mechanics, draft, onPick }: DropoffProps) {
  return (
    <>
      <p className="m-0">{`Drop off between ${day.dropoffWindow.start} and ${day.dropoffWindow.end}`}</p>
      <p className="m-0 mb-3 text-sm text-[var(--wh-muted)]">{"We'll confirm once the shop has looked at your request"}</p>
      <PillGroup
        legend="Mechanic"
        options={dropoffOptions(day, mechanics.mechanics)}
        value={draft.mechanicId !== undefined ? String(draft.mechanicId) : ANY_MECHANIC}
        onChange={onPick}
      />
    </>
  );
}
