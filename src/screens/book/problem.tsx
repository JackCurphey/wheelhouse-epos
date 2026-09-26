import * as React from 'react';
import { useNavigate, useParams } from 'react-router';
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
  ANSWER_TEXT_MAX, BIKE_NOTE_MAX, MAX_PHOTOS, MAX_PHOTO_BYTES, descriptionError, findAnswer, missingAnswers, photosCleared,
  pillChange, pillOptions, pillValue, questionGroups, questionLabel, setAnswer, type AnswerChange,
} from './problem-rules.ts';

/**
 * The problem screen (atlas `problem`, step 2): the bike in the customer's own
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
  const failed = missing.length > 0 || descError !== null;
  const descId = `${base}-description`;

  const answer = (serviceId: number, questionId: string, change: AnswerChange) =>
    update({ answers: setAnswer(draft.answers, serviceId, questionId, change) });

  const onContinue = () => {
    const nowMissing = missingAnswers(data, draft);
    const nowDescError = descriptionError(draft);
    if (nowMissing.length > 0 || nowDescError !== null) {
      setChecked(true);
      setAttempt((a) => a + 1);
      // Questions come before the description on screen, so the first
      // missing question, if any, is the first problem.
      const first = nowMissing[0];
      const target = first
        ? document.getElementById(blockId(base, first.serviceId, first.questionId))?.querySelector<HTMLElement>('input, textarea')
        : document.getElementById(descId);
      target?.focus();
      return;
    }
    // Continuing ends the "photos were cleared" message (spec): the flag now
    // matches the photos actually held.
    update({ hadPhotos: photos.length > 0 ? true : undefined });
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
