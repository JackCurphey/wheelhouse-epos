import * as React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet, ApiError } from '@/lib/api/client.ts';
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
import { DepositPart, HOLD_FAILED, PAY_AGAIN, payCard, pounds, serverCode, useDepositHold, type DepositHold, type PayState } from './deposit.tsx';
import {
  CHANNEL_OPTIONS, CHECK_ANSWERS, PHOTOS_QUESTION, SEND_FAILED, bookingBody, channelOf, dropoffWindowOn, emailLabel, fieldErrors,
  newRequestKey, refusalRoute, summaryLines, whenText, type ContactField, type SendRefusalState, type UpdateChannel,
} from './details-rules.ts';

/**
 * The details screen (screen design `details`, step 4): a summary of the booking, the
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
  // The deposit (deposit-pay-screen): the request key is made as step 4
  // opens, so the hold and the booking share it.
  React.useEffect(() => {
    if (services.takesDeposit && !draft.requestKey) update({ requestKey: newRequestKey() });
  }, [services.takesDeposit, draft.requestKey, update]);
  const holdQuery = useDepositHold(shopSlug, services, draft);
  const hold: DepositHold | null = holdQuery.data ?? null;
  const paid = !!hold && draft.depositHeld === hold.ref;
  const holdFailed = services.takesDeposit === true && holdQuery.isError;
  const [payState, setPayState] = React.useState<PayState>('ready');
  const [cardNumber, setCardNumber] = React.useState('');
  const [cardError, setCardError] = React.useState<string | null>(null);
  const ids: Record<ContactField, string> = {
    name: `${base}-name`, phone: `${base}-phone`, email: `${base}-email`, terms: `${base}-terms`,
  };
  const channel = channelOf(draft);
  const problems = checked ? fieldErrors(draft) : [];
  const errorFor = (field: ContactField) => problems.find((p) => p.field === field)?.message ?? null;
  const termsError = errorFor('terms');
  const note = problems.length > 0 ? CHECK_ANSWERS : sendError;
  // Back while "Sending…" leaves this screen, but the booking can still be
  // made (WP-0.2). Once it is, the customer is taken to its link from
  // wherever they are, so they never lose it.
  const navigate = useNavigate();
  const shown = React.useRef(true);
  // Set on every mount, not only at first: StrictMode mounts twice, and a
  // flag only ever cleared would read "gone" for the screen's whole life.
  React.useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);

  const send = async () => {
    setSending(true);
    setSendError(null);
    // One key per booking, saved before sending, so a retry (or a resend
    // after a refresh) repeats it and the server makes the booking once.
    const requestKey = draft.requestKey ?? newRequestKey();
    if (!draft.requestKey) update({ requestKey });
    // The deposit is paid first, once: a booking already paid for (a retry,
    // or after a refresh) is sent without paying again (design 4, 5).
    let heldNow = paid;
    if (hold && !paid) {
      try {
        await payCard(shopSlug, hold.ref, cardNumber);
        update({ depositHeld: hold.ref });
        heldNow = true;
      } catch (err) {
        setSending(false);
        if (serverCode(err) === 'card_declined') setPayState('card-failed');
        else if (err instanceof ApiError && err.status === 400 && err.hasServerMessage) setCardError(err.message);
        else if (err instanceof ApiError && err.status === 409) {
          // The hold was let go meanwhile (an hour on, or a refusal): a new one (review).
          void queryClient.invalidateQueries({ queryKey: ['deposit-hold', shopSlug] });
          setSendError(PAY_AGAIN);
        } else setSendError(SEND_FAILED);
        setAttempt((a) => a + 1);
        return;
      }
    }
    try {
      // The shop can edit its questions between problem and now, so the
      // answers are cleaned against a fresh copy. Read outside React Query
      // so a failed read can't put the frame into its failed state; the copy
      // then replaces the cached one.
      const fresh = await apiGet<ServicesResponse>(servicesPath(shopSlug));
      queryClient.setQueryData(servicesQueryKey(shopSlug), fresh);
      const photoData = await photosBase64(photos);
      const body = bookingBody(fresh, { ...draft, requestKey }, photoData);
      const reply = await sendBooking(shopSlug, hold ? { ...body, paymentId: hold.paymentId } : body);
      if (shown.current) {
        clear();
        onExit({ to: reply.privateLink, replace: true });
      } else {
        // The router applies a navigation inside a transition, so a plain
        // clear() would render first and the screen they went back to would
        // redirect on the empty draft, replacing the link. Wait for the
        // navigation, then clear inside a transition of its own.
        await navigate(reply.privateLink, { replace: true });
        React.startTransition(() => clear());
      }
    } catch (err) {
      const route = refusalRoute(err);
      const code = serverCode(err);
      if (code === 'deposit_changed' || code === 'deposit_not_held') {
        // Paid for another amount, or not held after all: ask for the hold
        // and the card again (design 4).
        update({ depositHeld: undefined });
        setPayState('ready');
        void queryClient.invalidateQueries({ queryKey: ['deposit-hold', shopSlug] });
        setSending(false);
        setSendError(err instanceof ApiError ? err.message : SEND_FAILED);
        setAttempt((a) => a + 1);
        return;
      }
      // Paid, but the booking didn't get through: check, never pay again (bk-checking-payment).
      if (hold && heldNow && route.to === 'stay' && route.message === SEND_FAILED) {
        setSending(false);
        setPayState('checking');
        setAttempt((a) => a + 1);
        return;
      }
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
    // The hold couldn't be got ready: ask again, and send nothing (review).
    if (holdFailed) {
      void holdQuery.refetch();
      return;
    }
    const now = fieldErrors(draft);
    const needCard = !!hold && !paid && cardNumber.replace(/[\s-]/g, '') === '';
    setCardError(needCard ? 'Enter the card number' : null);
    if (needCard && now.length === 0) {
      setAttempt((a) => a + 1);
      document.getElementById('deposit-card')?.focus();
      return;
    }
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

  // The drawn labels (book.mjs detailsBody): Pay first; once paid, send; and
  // the card-failed and checking states' own words.
  function actionLabel() {
    if (sending) return 'Sending…';
    if (holdFailed) return 'Try again';
    if (!hold) return services.confirmsAutomatically ? 'Confirm booking' : 'Request booking';
    if (payState === 'checking') return 'Check again';
    if (payState === 'card-failed') return 'Try again';
    if (paid) return services.confirmsAutomatically ? 'Book' : 'Send request';
    return `Pay ${pounds(hold.depositPence)} and ${services.confirmsAutomatically ? 'book' : 'send request'}`;
  }

  return (
    <BookFrame
      step={4}
      title={TITLE}
      back={back}
      action={{ label: actionLabel(), onClick: onRequest, disabled: sending || (services.takesDeposit === true && holdQuery.isPending) }}
      actionNote={
        (holdFailed ? HOLD_FAILED : note) ? <p key={attempt} role="alert" className="m-0 text-[var(--wh-danger)]">{holdFailed ? HOLD_FAILED : note}</p> : undefined
      }
    >
      <Summary services={services} draft={draft} deposit={hold} />
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
      {/* Say yes once to service reminders, unticked to start (ac-book-remind;
          account and reminders decisions 2 and 8). */}
      <Checkbox
        className="mb-3 items-start gap-3 [&>input]:mt-px [&>input]:size-[22px]"
        checked={draft.remindMe === true}
        onChange={(e) => update({ remindMe: e.target.checked ? true : undefined })}
        label={(
          <span className="flex flex-col gap-0.5">
            <span className="text-size-15 font-semibold">Remind me when my bike is due its next service</span>
            <span className="text-size-13 leading-[1.45] text-[var(--wh-muted)]">And ask me for a review after I collect. One message each, the way you chose above. Stop any time.</span>
          </span>
        )}
      />
      {hold ? (
        <DepositPart
          hold={hold} draft={draft} paid={paid} state={payState} cardNumber={cardNumber} cardError={cardError}
          onCard={(value) => { setCardNumber(value); setCardError(null); if (payState === 'card-failed') setPayState('ready'); }}
        />
      ) : null}
      {/* A separate row above the tick box, so a near-miss tap on the box
          can't open the terms, and vice versa (Jack, 26 Sep). */}
      <button
        type="button"
        className="mb-3 flex min-h-11 w-full items-center rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3.5 text-left text-sm font-semibold text-[var(--accent-dark)]"
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

type SummaryProps = { services: ServicesResponse; draft: BookingDraft; deposit?: DepositHold | null };

// The drawn summary's deposit line (book.mjs summaryBox, deposit 'now').
const withDeposit = (lines: string[], deposit?: DepositHold | null) => (deposit ? [...lines, `Deposit to pay now ${pounds(deposit.depositPence)}`] : lines);

function Summary({ services, draft, deposit }: SummaryProps) {
  // A drop-off day stores no start time (d4).
  return draft.startTime === undefined
    ? <DropoffSummary services={services} draft={draft} deposit={deposit} />
    : <TimedSummary services={services} draft={draft} deposit={deposit} />;
}

function TimedSummary({ services, draft, deposit }: SummaryProps) {
  const { shopSlug = '' } = useParams();
  const mechanics = useMechanics(shopSlug);
  return <SummaryBox lines={withDeposit(summaryLines(services, draft, whenText(draft, mechanics.data?.mechanics)), deposit)} />;
}

function DropoffSummary({ services, draft, deposit }: SummaryProps) {
  const { shopSlug = '' } = useParams();
  const date = draft.date ?? '';
  // That day alone, for its drop-off window.
  const availability = useAvailability(shopSlug, { start: date, end: date, minutes: jobMinutes(services, draft) });
  const dropoff = availability.data ? dropoffWindowOn(availability.data, date) : undefined;
  return <SummaryBox lines={withDeposit(summaryLines(services, draft, whenText(draft, undefined, dropoff)), deposit)} />;
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
