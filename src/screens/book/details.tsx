import * as React from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { PillGroup } from '@/components/ui/pill-group';
import { BookFrame } from './frame.tsx';
import { useDraft, type BookingDraft } from './draft.tsx';
import { RequireDraft, hasDate } from './require-draft.tsx';
import { useServices, type ServicesResponse } from './services-query.ts';
import { useAvailability, useMechanics } from './date-query.ts';
import { jobMinutes } from './date-rules.ts';
import { useTerms } from './terms-query.ts';
import {
  CHANNEL_OPTIONS, CHECK_ANSWERS, channelOf, dropoffWindowOn, emailLabel, fieldErrors, summaryLines, whenText,
  type ContactField, type UpdateChannel,
} from './details-rules.ts';

/**
 * The details screen (atlas `details`, step 4): a summary of the booking, the
 * customer's name, mobile number, how to send updates (one channel, Text
 * message by default), an email (required only for Email updates), and the
 * booking terms, which open in a dialog on the same screen. Everything is
 * written to the draft as it changes. Request booking checks the fields.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
const TITLE = 'How can we reach you?';

export function DetailsScreen() {
  const { shopSlug = '' } = useParams();
  const { data } = useServices(shopSlug);
  const back = `/book/${shopSlug}/date`;
  // As on date: the guard waits for /services, and until then only the
  // frame shows (its own loading and failed states).
  if (!data) return <BookFrame step={4} title={TITLE} back={back}>{null}</BookFrame>;
  return (
    <RequireDraft has={hasDate} to="date">
      <DetailsForm services={data} back={back} />
    </RequireDraft>
  );
}

type FormProps = { services: ServicesResponse; back: string };

function DetailsForm({ services, back }: FormProps) {
  const { draft, update } = useDraft();
  const base = React.useId();
  // Messages show only after a press, then follow the draft, so each goes as
  // soon as it is fixed.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed press so the pinned alert is a new node and is
  // announced again (as on the earlier screens).
  const [attempt, setAttempt] = React.useState(0);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const ids: Record<ContactField, string> = {
    name: `${base}-name`, phone: `${base}-phone`, email: `${base}-email`, terms: `${base}-terms`,
  };
  const channel = channelOf(draft);
  const problems = checked ? fieldErrors(draft) : [];
  const errorFor = (field: ContactField) => problems.find((p) => p.field === field)?.message ?? null;
  const termsError = errorFor('terms');

  const onRequest = () => {
    const now = fieldErrors(draft);
    if (now.length > 0) {
      setChecked(true);
      setAttempt((a) => a + 1);
      document.getElementById(ids[now[0].field])?.focus();
    }
  };

  return (
    <BookFrame
      step={4}
      title={TITLE}
      back={back}
      action={{ label: 'Request booking', onClick: onRequest }}
      actionNote={
        problems.length > 0 ? (
          <p key={attempt} role="alert" className="m-0 text-[var(--wh-danger)]">{CHECK_ANSWERS}</p>
        ) : undefined
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
      <Field>
        <Checkbox
          id={ids.terms}
          checked={draft.termsAccepted === true}
          aria-invalid={termsError ? true : undefined}
          aria-describedby={termsError ? `${ids.terms}-error` : undefined}
          onChange={(e) => update({ termsAccepted: e.target.checked || undefined })}
          label={
            <>
              I agree to the{' '}
              {/* A button inside the label opens the terms without ticking the box. */}
              <button type="button" className="text-[var(--accent-dark)] underline" onClick={() => setTermsOpen(true)}>
                booking terms
              </button>
            </>
          }
        />
        {termsError && <FieldError id={`${ids.terms}-error`}>{termsError}</FieldError>}
      </Field>
      <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
    </BookFrame>
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
