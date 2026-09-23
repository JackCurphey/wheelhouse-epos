import { useQuery } from '@tanstack/react-query';
import { apiGet, ApiError } from '../api/client.ts';

/**
 * The ONLY identity source in the staff app.
 *
 * Decision B, 20 Sep: the mechanic screens build on the existing team-login,
 * and the WorkOS migration is approved but unbuilt. Keeping every screen
 * behind this one call is what makes that migration a provider swap rather
 * than 82 screen edits. No screen reads the session cookie or the team tables.
 *
 * The shapes follow serializeSession in server/server.js, which is flat and
 * sends no shop id - so SessionShop has none.
 */
export type SessionUser = { id: number; name: string; email: string; isOwner: boolean };
export type SessionShop = { name: string; slug: string };
export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; error: unknown }
  | { status: 'signed-in'; user: SessionUser; shop: SessionShop };

type MeResponse = {
  id: number;
  name: string;
  email: string;
  isOwner: boolean;
  shopName: string;
  shopSlug: string;
};

export async function resolveSession(): Promise<SessionState> {
  try {
    const me = await apiGet<MeResponse>('/api/auth/me');
    return {
      status: 'signed-in',
      user: { id: me.id, name: me.name, email: me.email, isOwner: me.isOwner },
      shop: { name: me.shopName, slug: me.shopSlug },
    };
  } catch (err) {
    // Signed out is an ordinary answer to "who am I", not a failure. Anything
    // else is a real error and must not be disguised as signed-out, or an
    // outage silently becomes a login screen.
    if (err instanceof ApiError && err.status === 401) return { status: 'signed-out' };
    throw err;
  }
}

export function useSession(): SessionState {
  const { data, error, isError } = useQuery({ queryKey: ['session'], queryFn: resolveSession });
  // Without this branch a failed lookup leaves `data` undefined and the app
  // shows "loading" forever.
  if (isError) return { status: 'error', error };
  return data ?? { status: 'loading' };
}
