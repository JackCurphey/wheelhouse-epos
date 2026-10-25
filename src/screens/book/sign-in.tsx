import * as React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { apiMutate, ApiError } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { BookFrame } from './frame.tsx';

/**
 * Signing in with a code sent by email (openspec/changes/customer-signin-screens;
 * drawn as cust-signin, cust-code and cust-code-expired, signin.mjs:256-285;
 * signing-in decisions 5 and 9). An email, then one box drawn as six that
 * checks itself on the sixth digit; then the page the link came from (third
 * walk, answer 8), only ever one of this shop's own. In the booking pages'
 * frame, as the stop page is: the website's frame, with Account, isn't built.
 */
const OOPS = 'That didn’t go through. Check your connection and try again.';
// The server's own words for a refusal, or for sign-in not being switched on (503).
const said = (err: unknown) => (err instanceof ApiError && (err.status < 500 || err.status === 503) && err.hasServerMessage ? err.message : OOPS);

/** Where sign-in returns to: `from` when it is this shop's own page, else its booking page (design 4). */
export function returnTo(from: string | null, shopSlug: string, origin = window.location.origin) {
  const home = `/book/${shopSlug}`;
  if (!from) return home;
  try {
    const u = new URL(from, origin);
    if (u.origin === origin && (u.pathname === home || u.pathname.startsWith(`${home}/`))) return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    // Not an address: the booking page.
  }
  return home;
}

export function SignInScreen() {
  const { shopSlug = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const base = `/api/portal/${encodeURIComponent(shopSlug)}/sign-in`;
  const [step, setStep] = React.useState<'email' | 'code'>('email');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [problem, setProblem] = React.useState<{ words: string; expired: boolean } | null>(null);
  const [resent, setResent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // Whether the code box has the keyboard, so the next box is marked only then (review).
  const [focused, setFocused] = React.useState(false);
  // The latest check: an answer to one a newer check replaced is let go (review).
  const latest = React.useRef(0);
  const emailId = React.useId();
  const codeError = React.useId();

  async function ask(again: boolean) {
    setBusy(true);
    setProblem(null);
    try {
      await apiMutate(`${base}/code`, { email: email.trim() }, { method: 'POST' });
      setCode('');
      setResent(again);
      setStep('code');
    } catch (err) {
      setProblem({ words: said(err), expired: false });
    } finally {
      setBusy(false);
    }
  }

  async function check(typed: string) {
    const mine = ++latest.current;
    setProblem(null);
    setResent(false);
    try {
      await apiMutate(`${base}/check`, { email: email.trim(), code: typed }, { method: 'POST' });
      navigate(returnTo(search.get('from'), shopSlug), { replace: true });
    } catch (err) {
      if (mine !== latest.current) return;
      const reason = err instanceof ApiError ? (err.body as { reason?: string } | null)?.reason : undefined;
      setProblem({ words: said(err), expired: reason === 'expired' });
    }
  }

  // Digits only, so a code pasted from the email with a space still fills all six.
  function typing(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // Every sixth digit checks, even while an earlier check is out (review).
    if (digits.length === 6) void check(digits);
  }

  if (step === 'email') {
    return (
      <BookFrame title="Sign in to your account">
        <p className="m-0">See your bookings, your bikes and past work. We’ll email you a code — no password needed.</p>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void ask(false); }}>
          <Field>
            <Label htmlFor={emailId}>Email</Label>
            <Input id={emailId} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${emailId}-error` : undefined} />
            {problem ? <FieldError id={`${emailId}-error`} role="alert">{problem.words}</FieldError> : null}
          </Field>
          <Button type="submit" variant="accent" disabled={busy} className="w-full">Email me a code</Button>
        </form>
        <p className="m-0 border-t border-[var(--wh-border)] pt-3.5 text-sm">Just checking a booking? Open the link in your text or email — no sign-in needed.</p>
      </BookFrame>
    );
  }
  return (
    <BookFrame title="Enter your code">
      <p className="m-0">We sent a 6-digit code to <strong>{email.trim()}</strong>. It works for 10 minutes and signs you in as soon as the last digit goes in.</p>
      <div className="relative flex gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} aria-hidden="true"
            className={`inline-flex h-14 w-12 items-center justify-center rounded-lg bg-[var(--wh-panel)] font-[family-name:var(--wh-font-mono)] text-2xl text-[var(--wh-ink)] ${problem ? 'border-2 border-[var(--wh-danger)]' : `border ${focused && i === code.length ? 'border-[var(--wh-ink)]' : 'border-[var(--wh-input-border)]'}`}`}>
            {code[i] ?? ''}
          </span>
        ))}
        <input aria-label="Your 6-digit code" autoComplete="one-time-code" inputMode="numeric" maxLength={6}
          value={code} onChange={(e) => typing(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          aria-invalid={problem ? true : undefined} aria-describedby={problem ? codeError : undefined}
          className="absolute inset-0 h-full w-full opacity-0" />
      </div>
      {problem ? <FieldError id={codeError} role="alert">{problem.words}</FieldError> : null}
      {resent ? <p role="status" className="m-0 text-sm">{`We sent a new code to ${email.trim()}`}</p> : null}
      <div className="flex justify-between gap-3">
        <button type="button" disabled={busy} onClick={() => void ask(true)}
          className={`inline-flex min-h-11 items-center text-sm underline ${problem?.expired ? 'font-bold' : 'font-semibold'}`}>Send a new code</button>
        <button type="button" onClick={() => { setStep('email'); setProblem(null); setResent(false); }}
          className="inline-flex min-h-11 items-center text-sm font-semibold underline">Use a different email</button>
      </div>
    </BookFrame>
  );
}
