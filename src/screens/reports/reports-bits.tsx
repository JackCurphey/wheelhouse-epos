import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError, serverSaid } from '@/lib/api/client.ts';
import { ROUTES } from '@/staff/routes.ts';
import { Button } from '@/components/ui/button';
import { useMedia } from '@/screens/diary/diary-bits.tsx';

/** The page's width and spacing, as the other staff pages have it. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3.5 p-5 max-md:p-4">{children}</div>;
}

/** reports.mjs `box`: a white card with its content spaced out. */
export function Box({ children, label }: { children: ReactNode; label?: string }) {
  return <section aria-label={label} className="flex flex-col gap-2.5 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] p-[18px] max-md:p-3.5">{children}</section>;
}

export function BoxHeading({ id, children }: { id?: string; children: ReactNode }) {
  return <h3 id={id} className="m-0 text-size-17 font-bold">{children}</h3>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="m-0 text-sm text-[var(--wh-muted)]">{children}</p>;
}

/** "All reports", back to the page (reports.mjs `back`). */
export function BackToReports() {
  return (
    <Link to={ROUTES.reports} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-[var(--wh-ink)] no-underline">
      <span aria-hidden="true">‹</span>All reports
    </Link>
  );
}

/** A refusal in the server's own words, or a plain failure. */
export function Refusal({ error }: { error: unknown }) {
  const words = serverSaid(error) ? error.message : error instanceof ApiError || error instanceof Error ? 'Something went wrong showing this report. Try again.' : 'Something went wrong.';
  return <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-sm font-semibold">{words}</p>;
}

/**
 * "Download as spreadsheet" (reports.mjs `DL`; Jack's answer 10): asks the server for
 * the report's file and hands it to the browser under the name the server gave it. On
 * a phone it says just "Download", so it fits beside the title.
 */
export function DownloadButton({ path }: { path: string }) {
  const phone = useMedia('(max-width: 767px)');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function download() {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(path);
      if (!res.ok) {
        const words = res.status < 500 ? await res.json().then((b: { error?: unknown }) => (typeof b?.error === 'string' ? b.error : null), () => null) : null;
        setProblem(words ?? 'Wheelhouse couldn’t make the file. Try again in a moment.');
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'report.csv';
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setProblem('Wheelhouse couldn’t make the file. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="default" className="min-h-11" disabled={busy} onClick={() => void download()}>{phone ? 'Download' : 'Download as spreadsheet'}</Button>
      {problem ? <p role="alert" className="m-0 text-size-13-5 font-semibold text-[var(--wh-danger-hover)]">{problem}</p> : null}
    </div>
  );
}
