import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Lock } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GoogleG } from './google-g.tsx';

/**
 * The staff app when nobody is signed in (openspec/changes/staff-signin-workos-screens,
 * staff-signin-google). In order: a failed sign-in's message (?signin=, not
 * drawn); after signing out, auth-signedout; a session that has run out,
 * auth-expired; and otherwise Wheelhouse's own sign-in, staff-signin, with
 * "Continue with Google" straight to Google and "Sign in with email" to
 * WorkOS's page, both back to the page that was opened.
 * The frame is signin.mjs's centred(): the name, then a card on the sand
 * ground, which on a phone falls away. No logo exists, so the name is words.
 */
const START = '/api/auth/workos/start';
const SIGN_IN = '/workshop/sign-in';
const withFrom = (path: string, from: string | null, first = '?') => (from ? `${path}${first}from=${encodeURIComponent(from)}` : path);

type Message = { heading: string; line: string; button?: string; href?: string; lock?: boolean };

// A failed sign-in's words, decided while building (staff-signin-workos-screens design 4).
const FAILED: Record<string, Message> = {
  'not-on-staff': {
    heading: 'That email isn’t on a staff list',
    line: 'Sign in with the email your shop has for you, or ask the shop’s owner to add you.',
    button: 'Sign in again',
  },
  unchecked: {
    heading: 'Check your email first',
    line: 'WorkOS sent you an email to check it’s yours. Open it, then sign in again.',
    button: 'Sign in again',
  },
  busy: { heading: 'Too many tries', line: 'Wait a few minutes, then try again.', button: 'Try again' },
  failed: { heading: 'That sign-in didn’t work', line: 'Please try again.', button: 'Try again' },
  // Pressing anything would only come back here.
  off: { heading: 'Signing in isn’t switched on yet', line: 'Ask whoever runs Wheelhouse for your shop.' },
};

function messageFor(pathname: string, search: string, expired: boolean): Message | null {
  const reason = new URLSearchParams(search).get('signin');
  if (reason !== null) return { href: SIGN_IN, ...(FAILED[reason] ?? FAILED.failed) };
  if (pathname.replace(/\/$/, '') === '/workshop/signed-out') {
    return { heading: 'You’ve signed out', line: 'Close this window, or sign in again.', button: 'Sign in again', href: SIGN_IN };
  }
  // On the sign-in screen's own address, the sign-in screen, even with a
  // session that has run out: "Sign in again" leads here (review: no loop).
  if (expired && pathname.replace(/\/$/, '') !== SIGN_IN) {
    return {
      heading: 'Please sign in again',
      line: 'You were signed out after a while without activity. Sign in and you’ll be back where you were.',
      button: 'Sign in again',
      href: withFrom(SIGN_IN, pathname + search),
      lock: true,
    };
  }
  return null;
}

/** signin.mjs's centred() frame; Set up this till's card is wider (480, till-setup). */
export function Frame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-screen flex-col gap-7 bg-[var(--wh-panel)] px-5 py-7 sm:items-center sm:justify-center sm:gap-6 sm:bg-[var(--wh-bg)] sm:p-8">
      <p className="text-lg font-bold text-[var(--wh-ink)] sm:text-xl">Wheelhouse</p>
      <div className={`flex flex-col gap-4 ${wide ? 'sm:w-[480px]' : 'sm:w-[440px]'} sm:rounded-xl sm:border sm:border-[var(--wh-border)] sm:bg-[var(--wh-panel)] sm:p-8 sm:shadow-[var(--wh-shadow)]`}>
        {children}
      </div>
    </main>
  );
}

const heading = 'm-0 text-size-26 leading-tight font-bold tracking-[-0.3px] text-[var(--wh-ink)]';

// staff-signin. The page to come back to: on /workshop/sign-in, its own
// ?from=; on any other page, that page.
function SignIn({ pathname, search }: { pathname: string; search: string }) {
  const onSignIn = pathname.replace(/\/$/, '') === SIGN_IN;
  const from = onSignIn ? new URLSearchParams(search).get('from') : pathname + search;
  return (
    <Frame>
      <h1 className={heading}>Sign in to Wheelhouse</h1>
      <a href={withFrom(`${START}?provider=google`, from, '&')} className={cn(buttonVariants({ block: true }), 'min-h-11 gap-2.5 border-[var(--input)]')}>
        <GoogleG />
        Continue with Google
      </a>
      <div className="flex items-center gap-3 text-size-13 text-[var(--wh-muted)]">
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--wh-border)]" />
        or
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--wh-border)]" />
      </div>
      <a href={withFrom(START, from)} className={cn(buttonVariants({ block: true }), 'min-h-11 border-[var(--input)]')}>
        Sign in with email
      </a>
    </Frame>
  );
}

export function SignedOut({ expired }: { expired: boolean }) {
  const { pathname, search } = useLocation();
  const message = messageFor(pathname, search, expired);
  if (!message) return <SignIn pathname={pathname} search={search} />;
  return (
    <Frame>
      {message.lock && (
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]">
          <Lock aria-hidden="true" className="size-6" />
        </span>
      )}
      <h1 className={heading}>{message.heading}</h1>
      <p className="m-0 text-size-15 leading-normal text-[var(--wh-muted)]">{message.line}</p>
      {message.button && message.href && (
        <a href={message.href} className={cn(buttonVariants({ variant: 'accent', block: true }))}>
          {message.button}
        </a>
      )}
    </Frame>
  );
}
