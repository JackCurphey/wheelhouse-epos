import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { Lock } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { pageNav } from '@/lib/page-nav.ts';

/**
 * The staff app when nobody is signed in (openspec/changes/staff-signin-workos-screens).
 * In order: a failed sign-in's message (?signin=, design 4, not drawn); after
 * signing out, auth-signedout; a session that has run out, auth-expired; and
 * otherwise straight to WorkOS's page, back to this page after (design 6).
 * The frame is signin.mjs's centred(): the name, then a card on the sand
 * ground, which on a phone falls away. No logo exists, so the name is words.
 */
const START = '/api/auth/workos/start';
const startFrom = (page: string) => `${START}?from=${encodeURIComponent(page)}`;

type Message = { heading: string; line: string; button?: string; href?: string; lock?: boolean };

// Design 4: a failed sign-in's words, decided while building.
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
  if (reason !== null) return { href: START, ...(FAILED[reason] ?? FAILED.failed) };
  if (pathname.replace(/\/$/, '') === '/workshop/signed-out') {
    return { heading: 'You’ve signed out', line: 'Close this window, or sign in again.', button: 'Sign in again', href: START };
  }
  if (expired) {
    return {
      heading: 'Please sign in again',
      line: 'You were signed out after a while without activity. Sign in and you’ll be back where you were.',
      button: 'Sign in again',
      href: startFrom(pathname + search),
      lock: true,
    };
  }
  return null;
}

export function SignedOut({ expired }: { expired: boolean }) {
  const { pathname, search } = useLocation();
  const message = messageFor(pathname, search, expired);

  useEffect(() => {
    if (!message) pageNav.go(startFrom(pathname + search));
  }, [message, pathname, search]);

  // Said while the browser goes on to WorkOS, for screen readers (review).
  if (!message) {
    return (
      <p role="status" className="p-8 text-[var(--wh-muted)]">
        Taking you to sign in…
      </p>
    );
  }
  return (
    <main className="flex min-h-screen flex-col gap-7 bg-[var(--wh-panel)] px-5 py-7 sm:items-center sm:justify-center sm:gap-6 sm:bg-[var(--wh-bg)] sm:p-8">
      <p className="text-lg font-bold text-[var(--wh-ink)] sm:text-xl">Wheelhouse</p>
      <div className="flex flex-col gap-4 sm:w-[440px] sm:rounded-xl sm:border sm:border-[var(--wh-border)] sm:bg-[var(--wh-panel)] sm:p-8 sm:shadow-[var(--wh-shadow)]">
        {message.lock && (
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--wh-warn-bg)] text-[var(--wh-warn-ink)]">
            <Lock aria-hidden="true" className="size-6" />
          </span>
        )}
        <h1 className="m-0 text-size-26 leading-tight font-bold tracking-[-0.3px] text-[var(--wh-ink)]">{message.heading}</h1>
        <p className="m-0 text-size-15 leading-normal text-[var(--wh-muted)]">{message.line}</p>
        {message.button && message.href && (
          <a href={message.href} className={cn(buttonVariants({ variant: 'accent', block: true }))}>
            {message.button}
          </a>
        )}
      </div>
    </main>
  );
}
