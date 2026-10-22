import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { PillGroup } from '@/components/ui/pill-group';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { Textarea } from '@/components/ui/textarea';
import { BookFrame } from './frame.tsx';
import { useDraft, type Answer } from './draft.tsx';
import { RequireDraft, hasService } from './require-draft.tsx';
import { useServices, type PortalQuestion } from './services-query.ts';
import {
  ANSWER_TEXT_MAX, BIKE_NOTE_MAX, MAX_PHOTOS, MAX_PHOTO_BYTES, cleanAnswers, descriptionError, findAnswer, missingAnswers,
  photosCleared, pillChange, pillOptions, pillValue, questionGroups, questionLabel, setAnswer, type AnswerChange,
} from './problem-rules.ts';
import { LIMIT_START, limitError, type SendRefusalState } from './details-rules.ts';

/**
 * The problem screen (screen design `problem`, step 2): the bike in the customer's own
 * words, each ticked service's questions (quick-answer pills plus "Or tell us
 * in your own words"), a description (required only for "Not sure"), and
 * photos. Everything but photos is written to the draft as it changes, so it
 * survives a refresh. Continue checks the answers and goes to the date screen;
 * nothing is sent until d5.
 * Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
 */
export function ProblemScreen() {
  return (
    <RequireDraft has={hasService}>
      <ProblemForm />
    </RequireDraft>
  );
}

// A DOM id for one question's block; Continue moves focus into it.
const blockId = (base: string, serviceId: number, questionId: string) =>
  `${base}-q-${serviceId}-${encodeURIComponent(questionId)}`;

function ProblemForm() {
  const { shopSlug = '' } = useParams();
  const navigate = useNavigate();
  // A booking refused at sending because the shop changed its questions (d5)
  // comes back here with the server's message, read into component state
  // once, then cleared from history below, so a refresh or Back/Forward
  // landing back on this same entry doesn't repeat it.
  const location = useLocation();
  const [questionsChanged] = React.useState(() => (location.state as SendRefusalState | null)?.questionsChanged);
  React.useEffect(() => {
    if ((location.state as SendRefusalState | null)?.questionsChanged !== undefined) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [location, navigate]);
  const { data } = useServices(shopSlug);
  const { draft, update, photos, setPhotos } = useDraft();
  // Messages show only after a Continue press, then follow the draft, so each
  // goes as soon as it is fixed.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed Continue so the pinned alert is a new node and is
  // announced again (as on the service list).
  const [attempt, setAttempt] = React.useState(0);
  const base = React.useId();
  const title = 'Tell us about your bike';
  const back = draft.notSure ? `/book/${shopSlug}` : `/book/${shopSlug}/services`;

  if (!data) return <BookFrame step={2} title={title} back={back}>{null}</BookFrame>;

  const groups = questionGroups(data, draft);
  const missing = checked ? missingAnswers(data, draft) : [];
  const descError = checked ? descriptionError(draft) : null;
  const limitProblem = checked ? limitError(draft) : null;
  const failed = missing.length > 0 || descError !== null || limitProblem !== null;
  const descId = `${base}-description`;
  const limitId = `${base}-limit`;

  const answer = (serviceId: number, questionId: string, change: AnswerChange) =>
    update({ answers: setAnswer(draft.answers, serviceId, questionId, change) });

  const onContinue = () => {
    const nowMissing = missingAnswers(data, draft);
    const nowDescError = descriptionError(draft);
    const nowLimit = limitError(draft);
    if (nowMissing.length > 0 || nowDescError !== null || nowLimit !== null) {
      setChecked(true);
      setAttempt((a) => a + 1);
      // Questions come before the description on screen, so the first
      // missing question, if any, is the first problem.
      const first = nowMissing[0];
      const target = first
        ? document.getElementById(blockId(base, first.serviceId, first.questionId))?.querySelector<HTMLElement>('input, textarea')
        : document.getElementById(nowDescError !== null ? descId : limitId);
      target?.focus();
      return;
    }
    // Continuing ends the "photos were cleared" message (spec): the flag now
    // matches the photos actually held. It also cleans the stored answers
    // (I1): a stale choice, a notSure the shop has since disallowed, or an
    // answer left over from a service that got unticked would otherwise
    // reach the server unchanged and be refused.
    update({ hadPhotos: photos.length > 0 ? true : undefined, answers: cleanAnswers(data, draft) });
    navigate(`/book/${shopSlug}/date`);
  };

  return (
    <BookFrame
      step={2}
      title={title}
      back={back}
      action={{ label: 'Continue', onClick: onContinue }}
      actionNote={
        failed ? (
          <p key={attempt} role="alert" className="m-0 text-[var(--wh-danger)]">
            Please check the answers marked above
          </p>
        ) : undefined
      }
    >
      {questionsChanged && (
        <p role="alert" className="m-0 mb-3 rounded-md bg-[var(--wh-warn-bg)] p-2.5 text-sm text-[var(--wh-warn-ink)]">
          {questionsChanged}
        </p>
      )}
      <Field>
        <Label htmlFor={`${base}-bike`}>Your bike (optional)</Label>
        <Input
          id={`${base}-bike`}
          value={draft.bikeNote ?? ''}
          maxLength={BIKE_NOTE_MAX}
          placeholder="Blue Trek road bike"
          onChange={(e) => update({ bikeNote: e.target.value || undefined })}
        />
      </Field>
      {groups.map(({ service, questions }) => (
        <section key={service.id} className="mb-4">
          <h2 className="m-0 mb-2 text-base font-semibold">{service.name}</h2>
          {questions.map((q) => (
            <QuestionField
              key={q.id}
              id={blockId(base, service.id, q.id)}
              question={q}
              answer={findAnswer(draft.answers, service.id, q.id)}
              error={missing.find((m) => m.serviceId === service.id && m.questionId === q.id)?.message ?? null}
              onChange={(change) => answer(service.id, q.id, change)}
            />
          ))}
        </section>
      ))}
      <Field>
        <Label htmlFor={descId}>{draft.notSure ? "What's wrong with it?" : 'Anything else we should know? (optional)'}</Label>
        <Textarea
          id={descId}
          value={draft.description ?? ''}
          aria-required={draft.notSure ? true : undefined}
          aria-invalid={descError ? true : undefined}
          aria-describedby={descError ? `${descId}-error` : undefined}
          onChange={(e) => update({ description: e.target.value || undefined })}
        />
        {descError && <FieldError id={`${descId}-error`}>{descError}</FieldError>}
      </Field>
      <section className="mb-4">
        {photosCleared(draft, photos.length) && (
          <p role="status" className="m-0 mb-2 rounded-md bg-[var(--wh-warn-bg)] p-2.5 text-sm text-[var(--wh-warn-ink)]">
            Your photos were cleared - please add them again
          </p>
        )}
        <PhotoPicker
          label="Add photos (optional)"
          value={photos}
          max={MAX_PHOTOS}
          maxBytes={MAX_PHOTO_BYTES}
          onChange={(files) => {
            setPhotos(files);
            update({ hadPhotos: files.length > 0 ? true : undefined });
          }}
        />
        <p className="m-0 mt-2 text-sm text-[var(--wh-muted)]">You can also show us at drop-off.</p>
      </section>
      {/* The spending limit (Workshop day 41; book.mjs limit()): the whole bill, in whole pounds. */}
      <fieldset className="m-0 mb-4 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-sm font-semibold">If the mechanic finds more to do</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
          <input type="radio" name={`${base}-limit-choice`} className="size-5 shrink-0 accent-[var(--wh-ink)]"
            checked={!draft.limitOn} onChange={() => update({ limitOn: undefined })} />
          Ask me before any extra work
        </label>
        <div className="flex min-h-11 items-center gap-2.5">
          <input type="radio" id={`${limitId}-on`} name={`${base}-limit-choice`} className="size-5 shrink-0 accent-[var(--wh-ink)]"
            checked={Boolean(draft.limitOn)} onChange={() => update({ limitOn: true })} />
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <label htmlFor={`${limitId}-on`} className="cursor-pointer">Go ahead if the whole bill comes to no more than</label>
            <span className="inline-flex items-center gap-1">
              £
              <Input
                id={limitId}
                inputMode="numeric"
                aria-label="Most the whole bill can come to, in pounds"
                aria-invalid={limitProblem ? true : undefined}
                aria-describedby={limitProblem ? `${limitId}-error` : undefined}
                value={draft.limitText ?? LIMIT_START}
                onChange={(e) => update({ limitOn: true, limitText: e.target.value })}
                className="min-h-11 w-[72px] font-mono"
              />
            </span>
          </span>
        </div>
        {limitProblem && <FieldError id={`${limitId}-error`}>{limitProblem}</FieldError>}
      </fieldset>
    </BookFrame>
  );
}

type QuestionFieldProps = {
  id: string;
  question: PortalQuestion;
  answer: Answer | undefined;
  error: string | null;
  onChange: (change: AnswerChange) => void;
};

function QuestionField({ id, question, answer, error, onChange }: QuestionFieldProps) {
  const label = questionLabel(question);
  const errorId = `${id}-error`;
  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;

  if (question.kind === 'text') {
    return (
      <Field id={id}>
        <Label htmlFor={`${id}-box`}>{label}</Label>
        <Textarea
          id={`${id}-box`}
          maxLength={ANSWER_TEXT_MAX}
          value={answer?.text ?? ''}
          aria-required={question.required ? true : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </Field>
    );
  }

  // The words box is named by the question as well as its own label, so a
  // screen reader user knows which question the box belongs to.
  return (
    <Field id={id}>
      <PillGroup
        legend={<span id={`${id}-wording`}>{label}</span>}
        options={pillOptions(question)}
        value={pillValue(answer)}
        onChange={(value) => onChange(pillChange(value))}
      />
      <Label id={`${id}-words`} htmlFor={`${id}-box`} className="mt-2">
        Or tell us in your own words
      </Label>
      <Textarea
        id={`${id}-box`}
        maxLength={ANSWER_TEXT_MAX}
        value={answer?.text ?? ''}
        aria-labelledby={`${id}-wording ${id}-words`}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
