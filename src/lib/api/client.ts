/**
 * The one place the staff app talks to the server.
 *
 * Two rules live here rather than in 82 screens:
 *
 * 1. Every guarded action carries the job's `version`. The server refuses a
 *    missing one with 400 and a stale one with 409 (server/workshop/
 *    transitions.js). `jobAction` takes version as a required parameter so a
 *    screen that does not have it cannot compile.
 * 2. A 409 is not a generic failure. `stale` means someone else moved the job
 *    and the screen must refetch and say so; `illegal` means the action was
 *    never allowed from this state and refetching changes nothing; `capacity`
 *    means the time or day has been used up by other bookings - pick another;
 *    retrying the same one cannot help. Screens behave differently for the
 *    three, so the client tells them apart - from the `code` the server sends,
 *    never from the wording of its message.
 *
 * Imports in this directory are relative with a `.ts` extension, not `@/`:
 * the tests load these files straight into Node, which knows no Vite alias.
 */
import type { ApiErrorBody } from './types.ts';

export type ApiErrorCode =
  | 'stale'
  | 'illegal'
  | 'capacity'
  | 'not_found'
  | 'bad_request'
  | 'unauthorized'
  | 'unknown';

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  body: unknown;
  /**
   * True when the reply parsed as JSON with an `error` field, so `message` is
   * the server's own words rather than the client's fallback wording. A proxy
   * or gateway failure (a 502/413 HTML page, or any reply the server never
   * wrote) leaves this false, and callers that would otherwise show `message`
   * to the customer should show their own generic wording instead.
   */
  hasServerMessage: boolean;

  constructor(status: number, body: unknown) {
    const parsed = isErrorBody(body) ? body : null;
    super(parsed?.error || `request failed with ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.hasServerMessage = parsed !== null;
    this.code = classify(status, parsed?.code);
  }
}

function isErrorBody(body: unknown): body is ApiErrorBody {
  return !!body && typeof body === 'object' && 'error' in body;
}

function classify(status: number, serverCode: ApiErrorBody['code']): ApiErrorCode {
  // A 409 with no code is left unknown rather than assumed stale: guessing
  // stale would reload and invite a retry of something that may never be
  // allowed.
  if (status === 409) {
    return serverCode === 'stale' || serverCode === 'illegal' || serverCode === 'capacity' ? serverCode : 'unknown';
  }
  if (status === 404) return 'not_found';
  if (status === 401) return 'unauthorized';
  if (status === 400) return 'bad_request';
  return 'unknown';
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiMutate<T>(
  path: string,
  body: unknown,
  opts: { method?: 'POST' | 'PUT' | 'DELETE' } = {},
): Promise<T> {
  return request<T>(path, {
    method: opts.method ?? 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * One of the fifteen guarded actions. `version` is required and never
 * defaulted: defaulting it would send whatever the client last saw, which is
 * precisely the race the optimistic check exists to refuse. It is spread last
 * so a stray `version` in `body` cannot override it.
 */
export function jobAction<T>(
  jobId: number,
  action: string,
  version: number,
  body: object = {},
): Promise<T> {
  return apiMutate<T>(`/api/workshop-jobs/${jobId}/${action}`, { ...body, version });
}
