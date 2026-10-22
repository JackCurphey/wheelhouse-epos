/** A settings row's On/Off switch: its label on the left, the words and the track on the right. */
export function RowSwitch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
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
