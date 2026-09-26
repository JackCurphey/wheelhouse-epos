import * as React from 'react';
import { Navigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { PillGroup } from '@/components/ui/pill-group';
import { BookFrame } from './frame.tsx';
import { useDraft, type BookingDraft } from './draft.tsx';
import { RequireDraft, hasDate } from './require-draft.tsx';
import { servicesPath, servicesQueryKey, useServices, type ServicesResponse } from './services-query.ts';
import { useAvailability, useMechanics } from './date-query.ts';
import { jobMinutes } from './date-rules.ts';
import { photosCleared } from './problem-rules.ts';
import { useTerms } from './terms-query.ts';
import { photosBase64, sendBooking } from './send.ts';
import {
  CHANNEL_OPTIONS, CHECK_ANSWERS, PHOTOS_QUESTION, bookingBody, channelOf, dropoffWindowOn, emailLabel, fieldErrors,
  refusalRoute, summaryLines, whenText, type ContactField, type SendRefusalState, type UpdateChannel,
} from './details-rules.ts';

/**
 * The details screen (atlas `details`, step 4): a summary of the booking, the
 * customer's name, mobile number, how to send updates (one channel, Text
 * message by default), an email (required only for Email updates), and the
 * booking terms, which open in a dialog on the same screen. Everything is
 * written to the draft as it changes. Request booking checks the fields,
 * asks about photos a refresh cleared, and sends the booking; the outcome
 * decides where the customer goes next.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
const TITLE = 'How can we reach you?';

type Exit = { to: string; state?: SendRefusalState; replace?: boolean };

export function DetailsScreen() {
  const { shopSlug = '' } = useParams();
  const { data } = useServices(shopSlug);
  const [exit, setExit] = React.useState<Exit | null>(null);
  const back = `/book/${shopSlug}/date`;
  // Where sending leaves the customer is decided here, above the guard:
  // sending clears the draft (or its date), and the guard would otherwise
  // redirect to date first.
  if (exit) return <Navigate to={exit.to} state={exit.state} replace={exit.replace} />;
  // As on date: the guard waits for /services, and until then only the
  // frame shows (its own loading and failed states).
  if (!data) return <BookFrame step={4} title={TITLE} back={back}>{null}</BookFrame>;
  return (
    <RequireDraft has={hasDate} to="date">
      <DetailsForm services={data} back={back} onExit={setExit} />
    </RequireDraft>
  );
}

type FormProps = { services: ServicesResponse; back: string; onExit: (exit: Exit) => void };

function DetailsForm({ services, back, onExit }: FormProps) {
  const { shopSlug = '' } = useParams();
  const queryClient = useQueryClient();
  const { draft, update, photos, clear } = useDraft();
  const base = React.useId();
  // Messages show only after a press, then follow the draft, so each goes as
  // soon as it is fixed.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed press or send so the pinned alert is a new node and
  // is announced again (as on the earlier screens).
  const [attempt, setAttempt] = React.useState(0);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [askPhotos, setAskPhotos] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const ids: Record<ContactField, string> = {
    name: `${base}-name`, phone: `${base}-phone`, email: `${base}-email`, terms: `${base}-terms`,
  };
  const channel = channelOf(draft);
  const problems = checked ? fieldErrors(draft) : [];
  const errorFor = (field: ContactField) => problems.find((p) => p.field === field)?.message ?? null;
  const termsError = errorFor('terms');
  const note = problems.length > 0 ? CHECK_ANSWERS : sendError;

  const send = async () => {
    setSending(true);
    setSendError(null);
    try {
      // The shop can edit its questions between problem and now, so the
      // answers are cleaned against a fresh copy. Read outside React Query
      // so a failed read can't put the frame into its failed state; the copy
      // then replaces the cached one.
      const fresh = await apiGet<ServicesResponse>(servicesPath(shopSlug));
      queryClient.setQueryData(servicesQueryKey(shopSlug), fresh);
      const photoData = await photosBase64(photos);
      const reply = await sendBooking(shopSlug, bookingBody(fresh, draft, photoData));
      clear();
      onExit({ to: reply.privateLink, replace: true });
    } catch (err) {
      const route = refusalRoute(err);
      if (route.to === 'date') {
        update({ date: undefined, mechanicId: undefined, startTime: undefined, anyMechanic: undefined });
        onExit({ to: `/book/${shopSlug}/date`, state: { timeTaken: true } });
      } else if (route.to === 'problem') {
        onExit({ to: `/book/${shopSlug}/problem`, state: { questionsChanged: route.message } });
      } else {
        setSending(false);
        setSendError(route.message);
        setAttempt((a) => a + 1);
      }
    }
  };

  const onRequest = () => {
    const now = fieldErrors(draft);
    if (now.length > 0) {
      setChecked(true);
      setSendError(null);
      setAttempt((a) => a + 1);
      document.getElementById(ids[now[0].field])?.focus();
      return;
    }
    if (photosCleared(draft, photos.length)) {
      setAskPhotos(true);
      return;
    }
    void send();
  };

  const sendWithoutPhotos = () => {
    setAskPhotos(false);
    // Answered: don't ask again if this send fails and is tried again.
    update({ hadPhotos: undefined });
    void send();
  };

  return (
    <BookFrame
      step={4}
      title={TITLE}
      back={back}
      action={{ label: sending ? 'Sending…' : 'Request booking', onClick: onRequest, disabled: sending }}
      actionNote={
        note ? <p key={attempt} role="alert" className="m-0 text-[var(--wh-danger)]">{note}</p> : undefined
      }
    >
      <Summary services={services} draft={draft} />
      <TextField id={ids.name} label="Your name" autoComplete="name" required value={draft.name}
        error={errorFor('name')} onChange={(name) => update({ name })} />
      <TextField id={ids.phone} label="Mobile number" type="tel" autoComplete="tel" required value={draft.phone}
        error={errorFor('phone')} onChange={(phone) => update({ phone })} />
      <PillGroup
        legend="How should we send updates?"
        options={CHANNEL_OPTIONS}
        value={channel}
        onChange={(value) => update({ updateChannel: value as UpdateChannel })}
        className="mb-3"
      />
      <TextField id={ids.email} label={emailLabel(channel)} type="email" autoComplete="email" required={channel === 'email'}
        value={draft.email} error={errorFor('email')} onChange={(email) => update({ email })} />
      {/* A separate row above the tick box, so a near-miss tap on the box
          can't open the terms, and vice versa (Jack, 26 Sep). */}
      <button
        type="button"
        className="mb-3 flex min-h-11 w-full items-center rounded-lg border border-[var(--wh-border)] bg-white px-3.5 text-left text-sm font-semibold text-[var(--accent-dark)]"
        onClick={() => setTermsOpen(true)}
      >
        Read the booking terms
      </button>
      <Field>
        <Checkbox
          id={ids.terms}
          checked={draft.termsAccepted === true}
          aria-invalid={termsError ? true : undefined}
          aria-describedby={termsError ? `${ids.terms}-error` : undefined}
          onChange={(e) => update({ termsAccepted: e.target.checked || undefined })}
          label="I agree to the booking terms"
        />
        {termsError && <FieldError id={`${ids.terms}-error`}>{termsError}</FieldError>}
      </Field>
      <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
      <PhotosQuestion
        open={askPhotos}
        onOpenChange={setAskPhotos}
        onAdd={() => onExit({ to: `/book/${shopSlug}/problem` })}
        onSendWithout={sendWithoutPhotos}
      />
    </BookFrame>
  );
}

type PhotosQuestionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onSendWithout: () => void;
};

/** Photos live in memory only, so a refresh after adding them loses them (d3). */
function PhotosQuestion({ open, onOpenChange, onAdd, onSendWithout }: PhotosQuestionProps) {
  const questionId = React.useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={questionId}>
      {open && (
        <>
          <DialogBody>
            <p id={questionId} className="m-0">{PHOTOS_QUESTION}</p>
          </DialogBody>
          <DialogFooter>
            <Button onClick={onAdd}>Add photos</Button>
            <Button variant="accent" onClick={onSendWithout}>Send without photos</Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}

type SummaryProps = { services: ServicesResponse; draft: BookingDraft };

function Summary({ services, draft }: SummaryProps) {
  // A drop-off day stores no start time (d4).
  return draft.startTime === undefined
    ? <DropoffSummary services={services} draft={draft} />
    : <TimedSummary services={services} draft={draft} />;
}

function TimedSummary({ services, draft }: SummaryProps) {
  const { shopSlug = '' } = useParams();
  const mechanics = useMechanics(shopSlug);
  return <SummaryBox lines={summaryLines(services, draft, whenText(draft, mechanics.data?.mechanics))} />;
}

function DropoffSummary({ services, draft }: SummaryProps) {
  const { shopSlug = '' } = useParams();
  const date = draft.date ?? '';
  // That day alone, for its drop-off window.
  const availability = useAvailability(shopSlug, { start: date, end: date, minutes: jobMinutes(services, draft) });
  const dropoff = availability.data ? dropoffWindowOn(availability.data, date) : undefined;
  return <SummaryBox lines={summaryLines(services, draft, whenText(draft, undefined, dropoff))} />;
}

function SummaryBox({ lines }: { lines: string[] }) {
  return (
    <div className="mb-4 rounded-md border border-[var(--wh-border)] p-3 text-sm">
      {lines.map((line, i) => <p key={i} className="m-0">{line}</p>)}
    </div>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  value: string | undefined;
  error: string | null;
  onChange: (value: string | undefined) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
};

function TextField({ id, label, value, error, onChange, type = 'text', autoComplete, required }: TextFieldProps) {
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value ?? ''}
        aria-required={required ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

function TermsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const titleId = React.useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={titleId}>
      {/* Fetched only once opened. */}
      {open && <TermsContent titleId={titleId} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function TermsContent({ titleId, onClose }: { titleId: string; onClose: () => void }) {
  const { shopSlug = '' } = useParams();
  const terms = useTerms(shopSlug);
  return (
    <>
      <DialogHeader>
        {/* The server's title once loaded (piece 11 always sends "Booking terms"). */}
        <DialogTitle id={titleId}>{terms.data?.title ?? 'Booking terms'}</DialogTitle>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody>
        {terms.data ? (
          <p className="m-0 whitespace-pre-line text-sm">{terms.data.text}</p>
        ) : terms.isError ? (
          <>
            <p role="alert" className="m-0 mb-3">{"We couldn't load the booking terms"}</p>
            <Button variant="accent" onClick={() => void terms.refetch()}>Try again</Button>
          </>
        ) : (
          <p role="status" className="m-0">Loading…</p>
        )}
      </DialogBody>
    </>
  );
}
