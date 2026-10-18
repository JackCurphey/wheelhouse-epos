import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';

/**
 * Settings, first piece (Jack, 18 Oct, docs/decisions/2026-10-16-mechanic-sign-off.md
 * "Piece 3"; drawn as set-workshop-sign-off in docs/design/user-journeys/generator/setup.mjs):
 * Workshop › Mechanics holds "Show who signed off to customers", off to
 * start, saved as soon as it's switched. The rest of Settings comes with
 * WP-5.1.
 */
type WorkshopSettings = { showSignOffToCustomers?: boolean };

// The settings pages' own switch (settings-frame.mjs rowSwitch): the label,
// On or Off in words, and the track; the whole row is the control.
function RowSwitch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-[15px] font-bold">{label}</span>
      <span className="inline-flex items-center gap-2.5">
        <span className={`text-sm font-semibold ${on ? '' : 'text-[var(--wh-muted)]'}`}>{on ? 'On' : 'Off'}</span>
        <span aria-hidden="true" className={`relative inline-block h-[26px] w-11 rounded-full ${on ? 'bg-[var(--wh-brand)]' : 'bg-[var(--wh-input-border)]'}`}>
          <span className={`absolute top-[3px] size-5 rounded-full bg-[var(--wh-panel)] shadow ${on ? 'left-[21px]' : 'left-[3px]'}`} />
        </span>
      </span>
    </button>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['workshop-settings'], queryFn: () => apiGet<WorkshopSettings>('/api/workshop-settings') });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = settings.data?.showSignOffToCustomers === true;

  async function change(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      const saved = await apiMutate<WorkshopSettings>('/api/workshop-settings', { showSignOffToCustomers: next }, { method: 'PUT' });
      queryClient.setQueryData(['workshop-settings'], saved);
    } catch {
      setError('Wheelhouse couldn’t save that. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 p-5">
      {/* The staff frame's header already says "Settings". */}
      <section aria-labelledby="set-workshop" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="set-workshop" className="m-0 text-xl font-bold">Workshop</h2>
          <p className="m-0 text-sm text-[var(--wh-muted)]">Services, who works in the workshop, and how the diary looks.</p>
        </div>
        <section aria-labelledby="set-mechanics" className="flex flex-col gap-2 rounded-xl border border-[var(--wh-border)] bg-[var(--wh-panel)] px-[18px] py-3.5">
          <h3 id="set-mechanics" className="m-0 text-base font-bold">Mechanics</h3>
          {settings.isError ? <p role="alert" className="m-0 text-sm">Wheelhouse couldn’t load the settings. Try again in a moment.</p> : null}
          <RowSwitch label="Show who signed off to customers" on={on} disabled={saving || !settings.data} onChange={(next) => void change(next)} />
          <p className="m-0 text-sm text-[var(--wh-muted)]">Adds “Checked by [name]” to their receipt and booking link. Off: only staff see who signed a job off.</p>
          {error ? <p role="alert" className="m-0 text-sm font-semibold text-[var(--wh-danger-hover)]">{error}</p> : null}
        </section>
      </section>
    </div>
  );
}
