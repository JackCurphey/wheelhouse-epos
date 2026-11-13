// screens: set-data-export
// Settings › Office › Your data › Download everything (openspec/changes/your-data-download
// group 3; Jack's 10 Nov answers 2 and 7): the spreadsheets the zip holds, the note
// and the button. Owner only on the server. The waiting and failure states aren't drawn
// (small one 8): they follow the customer's own copy (src/screens/book/account.tsx).
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { Check, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';

const HOLDS = ['Customers', 'Daily figures', 'Sales and refunds', 'Stock', 'Workshop jobs'];

/** The file's name from Content-Disposition: filename* first (it carries ’ and quotes), then filename. */
function fileName(header: string | null): string {
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header ?? '')?.[1];
  if (star) {
    try { return decodeURIComponent(star); } catch { /* fall through to the plain name */ }
  }
  return /filename="([^"]+)"/.exec(header ?? '')?.[1] ?? 'shop data.zip';
}

export function DownloadEverything() {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  // The Citrus Lime rows left out, a fifth spreadsheet while there are any (group 4).
  const leftOut = useQuery({ queryKey: ['your-data'], queryFn: () => apiGet<{ leftOut: number }>('/api/settings/your-data') }).data?.leftOut ?? 0;
  const holds = leftOut > 0 ? [...HOLDS, `Left out from Citrus Lime · ${leftOut} ${leftOut === 1 ? 'row' : 'rows'}`] : HOLDS;
  const button = useRef<HTMLButtonElement>(null);
  // The button is greyed out while the zip is made, and Try again goes with the warning, so the
  // browser drops the focus to the top of the page: give it back to the button (review).
  useEffect(() => {
    if (state !== 'busy' && document.activeElement === document.body) button.current?.focus();
  }, [state]);
  async function download() {
    setState('busy');
    try {
      const res = await fetch('/api/settings/your-data/download', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`shop data: ${res.status}`);
      const name = fileName(res.headers.get('content-disposition'));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      // The browser has the file once the click is handled; let go of it after.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setState('idle');
    } catch {
      setState('failed');
    }
  }
  const busy = state === 'busy';
  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="What the download holds" className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
        {holds.map((t) => (
          <li key={t} className="flex min-h-12 items-center gap-2.5 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3">
            <Check aria-hidden="true" className="size-4 shrink-0" />
            <span className="text-size-15 font-semibold">{t}</span>
          </li>
        ))}
      </ul>
      {/* Always there, so screen readers read the warning out when it arrives (review). */}
      <div role="status">
        {state === 'failed' ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-3 text-size-15 leading-snug text-[var(--wh-warn-ink)]">
            <TriangleAlert aria-hidden="true" className="size-[18px] shrink-0" />
            <span className="grow">The download didn’t start.</span>
            <Button onClick={() => void download()}>Try again</Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-2.5">
        <p className="m-0 text-sm text-[var(--wh-muted)]">Spreadsheets that open in Excel or Google Sheets — yours to keep, whatever happens.</p>
        <div aria-live="polite">
          <Button ref={button} variant="accent" onClick={() => void download()} disabled={busy}>{busy ? 'Preparing your download…' : 'Download everything'}</Button>
        </div>
      </div>
    </div>
  );
}
