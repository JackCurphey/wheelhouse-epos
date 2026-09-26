import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Photo picker for a booking: "Add photos" opens the phone's own chooser
 * (camera or library). Photos only - JPEG, PNG or WebP, the types the booking
 * server accepts - up to `max`, each up to `maxBytes`. Anything else is refused
 * here with a message naming the file and the rule, and the accepted files are
 * kept. Chosen photos show as thumbnails with a remove button each.
 * Turning files into the base64 the server wants is the screen's job.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type PhotoPickerProps = {
  value: File[];
  onChange: (files: File[]) => void;
  max?: number;
  maxBytes?: number;
  label?: React.ReactNode;
  className?: string;
};

export function PhotoPicker({ value, onChange, max = 5, maxBytes = 10 * 1024 * 1024, label = 'Add photos', className }: PhotoPickerProps) {
  const inputId = React.useId();
  const [refused, setRefused] = React.useState<string[]>([]);
  const urls = React.useMemo(() => value.map((f) => URL.createObjectURL(f)), [value]);
  React.useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function add(list: FileList | File[] | null) {
    const kept = [...value];
    const why: string[] = [];
    for (const f of Array.from(list ?? [])) {
      if (!PHOTO_TYPES.includes(f.type)) why.push(`${f.name} isn't a JPEG, PNG or WebP photo.`);
      else if (f.size > maxBytes) why.push(`${f.name} is over ${Math.round(maxBytes / (1024 * 1024))} MB.`);
      else if (kept.length >= max) why.push(`${f.name} wasn't added: ${max} photos is the most.`);
      else kept.push(f);
    }
    setRefused(why);
    if (kept.length !== value.length) onChange(kept);
  }

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {value.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
          {value.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative size-[58px]">
              <img src={urls[i]} alt={f.name} className="size-full rounded-md object-cover" />
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute -right-0 -top-0 size-11 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <span
                  aria-hidden
                  className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-[var(--wh-ink)] text-sm text-white"
                >
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        htmlFor={inputId}
        className={cn(
          'flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-[7px] border border-dashed border-[var(--wh-muted)] p-3.5 text-center text-sm text-[var(--wh-ink)]',
          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]',
          value.length >= max && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-[var(--wh-muted)]">
          Optional · {value.length} of {max} added · up to {Math.round(maxBytes / (1024 * 1024))} MB each
        </span>
        <input
          id={inputId}
          type="file"
          accept={PHOTO_TYPES.join(',')}
          multiple
          disabled={value.length >= max}
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = ''; // choosing the same file again still fires
          }}
        />
      </label>
      {refused.length > 0 && (
        <ul role="alert" className="m-0 list-none rounded-md bg-[var(--wh-danger-bg)] p-2.5 text-[12.5px] text-[var(--wh-danger)]">
          {refused.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
