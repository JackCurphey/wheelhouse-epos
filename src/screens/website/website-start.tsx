import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiGet, apiMutate, serverSaid } from '@/lib/api/client.ts';
import { Button } from '@/components/ui/button';
import { Box, Page } from '@/screens/reports/reports-bits.tsx';
import { PHOTO_TYPES, readAsBase64 } from './website-boxes.tsx';
import { Note } from './website-tracking.tsx';
import { colourName, colourProblem, coloursFromPixels, hexOf, type Swatch } from './website-colour.ts';
import { ProductCounts } from './website-page.tsx';
import { ConnectBox, WhatHappens, connectFailed } from './website-shopify.tsx';
import type { WebsiteState } from './website-types.ts';

const CHARCOAL: Swatch = { hex: hexOf('2A2822'), name: 'Soft sand charcoal' };
const failed = (err: unknown) => (serverSaid(err) ? err.message : 'Wheelhouse couldn’t do that. Try again.');

/**
 * The Website start (openspec/changes/website-management, design 4; the
 * drawings ws-start-which, ws-start-look and ws-start-products in
 * docs/design/user-journeys/generator/website.mjs, lines 155-172): three
 * steps, then the Website page. Not now shows "Not set up yet".
 */
export function WebsiteStart({ state, onState, failedAddress = null }: { state: WebsiteState; onState: (next: WebsiteState) => void; failedAddress?: string | null }) {
  const [later, setLater] = useState(false);
  // Back from Shopify without connecting: step 2 again, saying so (ws-shopify-failed).
  const [step, setStep] = useState(failedAddress === null ? 1 : 2);
  // Back and Next move focus to the new step's title, so a screen reader hears where it is.
  const [moved, setMoved] = useState(false);
  const [kind, setKind] = useState<'wheelhouse' | 'shopify'>(failedAddress === null ? 'wheelhouse' : 'shopify');
  const [notConnected, setNotConnected] = useState(failedAddress);
  const [colour, setColour] = useState<string | null>(null);
  const [startWith, setStartWith] = useState<'every' | 'nothing'>('every');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fromLogo = useLogoColours(state.logo);
  const chosen = colour ?? fromLogo[0]?.hex ?? CHARCOAL.hex;

  if (later) {
    return (
      <Page>
        <Box label="Not set up yet">
          <h2 className="m-0 text-size-17 font-bold">Not set up yet</h2>
          <p className="m-0 text-size-15 text-[var(--wh-muted)]">Three steps: which website, your logo and colour, and what starts online.</p>
          <div><Button variant="accent" onClick={() => { setLater(false); setStep(1); }}>Set up your website</Button></div>
        </Box>
      </Page>
    );
  }

  async function makeIt() {
    setBusy(true);
    setProblem(null);
    try {
      onState(await apiMutate<WebsiteState>('/api/website/set-up', { kind, startWith, mainColour: chosen }, { method: 'POST' }));
    } catch (err) {
      // Set up meanwhile, in another tab: show the Website page as it now is.
      if (err instanceof ApiError && err.status === 409) {
        try { onState(await apiGet<WebsiteState>('/api/website')); return; } catch { /* show the server's words below */ }
      }
      setProblem(failed(err));
    } finally {
      setBusy(false);
    }
  }
  const go = (n: number) => { setMoved(true); setProblem(null); setNotConnected(null); setStep(n); };

  if (step === 1) {
    return (
      <Steps moved={moved} n={1} title="Wheelhouse’s website, or your Shopify shop?" sub="You can change this later." problem={problem}
        back={<span className="flex flex-wrap items-center gap-2.5"><Button variant="ghost" onClick={() => setLater(true)}>Not now</Button><span className="text-size-13 text-[var(--wh-muted)]">The Website page will say “Not set up yet”</span></span>}
        next={<Button variant="accent" onClick={() => go(2)}>Next</Button>}>
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="sr-only">Which website</legend>
          <Option name="Wheelhouse’s website" group="kind" checked={kind === 'wheelhouse'} onChoose={() => setKind('wheelhouse')}>Made from your shop’s details, in your colours. Products, stock, booking repairs and click and collect all built in.</Option>
          <Option name="Connect your Shopify shop" group="kind" checked={kind === 'shopify'} onChoose={() => setKind('shopify')}>Keep your Shopify look and checkout. Wheelhouse sends Shopify your products, prices and stock, and Shopify orders come into Online orders.</Option>
        </fieldset>
      </Steps>
    );
  }
  if (kind === 'shopify') {
    // ws-start-shopify: Connect goes to Shopify and comes back to the Website page, set up.
    return (
      <Steps moved={moved} n={2} title="Connect your Shopify shop" sub="Then choose which products to send. Your Shopify look stays as it is." problem={null}
        back={<Button variant="ghost" onClick={() => go(1)}>Back</Button>}
        next={<Button variant="accent" aria-disabled="true" title="Connect first" className="cursor-not-allowed opacity-50">Next</Button>}>
        <WhatHappens />
        {notConnected !== null ? <Note tone="bad" live>{connectFailed(notConnected)}</Note> : null}
        <ConnectBox address={failedAddress ?? ''} />
      </Steps>
    );
  }
  if (step === 2) {
    return (
      <Steps moved={moved} n={2} title="Your logo and colour" sub="Wheelhouse suggests colours from your logo." problem={problem}
        back={<Button variant="ghost" onClick={() => go(1)}>Back</Button>}
        next={<Button variant="accent" onClick={() => go(3)}>Next</Button>}>
        <LookStep state={state} onState={onState} fromLogo={fromLogo} chosen={chosen} onChoose={(hex) => { setColour(hex); setProblem(null); }} onProblem={setProblem} />
      </Steps>
    );
  }
  return (
    <Steps moved={moved} n={3} title="Start with every product online, or nothing?" sub="Either way, every category and product has its own “Show on website” switch afterwards." problem={problem}
      back={<Button variant="ghost" onClick={() => go(2)}>Back</Button>}
      next={<Button variant="accent" disabled={busy} onClick={() => void makeIt()}>Make my website</Button>}>
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="sr-only">Start with</legend>
        <Option name="Every product online" group="start" checked={startWith === 'every'} onChoose={() => setStartWith('every')}>Everything with a price shows. Switch off what you don’t want online.</Option>
        <Option name="Nothing online" group="start" checked={startWith === 'nothing'} onChoose={() => setStartWith('nothing')}>Add categories and products as you go.</Option>
      </fieldset>
      {state.startCounts ? (
        <div className="flex flex-col gap-0.5 rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-2.5">
          <span className="pt-1 text-sm font-bold">With every product online</span>
          <ProductCounts counts={state.startCounts} />
        </div>
      ) : null}
      <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Your website stays off until you turn it on.</p>
    </Steps>
  );
}

/** website.mjs `steps`: the step line, the bars, the title, the body and Back / Next. */
function Steps({ moved, n, title, sub, problem, back, next, children }: {
  moved: boolean; n: number; title: string; sub: string; problem: string | null; back: ReactNode; next: ReactNode; children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (moved) heading.current?.focus(); }, [moved, title]);
  return (
    <Page>
      <div className="flex w-full max-w-[720px] flex-col gap-[18px] self-center pt-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-size-13 font-bold tracking-[1px] text-[var(--wh-muted)]">{`SET UP YOUR WEBSITE · STEP ${n} OF 3`}</span>
          <div role="progressbar" aria-label={`Step ${n} of 3`} aria-valuemin={1} aria-valuemax={3} aria-valuenow={n} className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 rounded-full ${i <= n ? 'bg-[var(--wh-ink)]' : 'bg-[var(--wh-border)]'}`} />)}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 ref={heading} tabIndex={-1} className="m-0 text-size-26 font-bold outline-none">{title}</h2>
          <p className="m-0 text-size-15 leading-normal text-[var(--wh-muted)]">{sub}</p>
        </div>
        {children}
        {problem ? <p role="alert" className="m-0 rounded-lg bg-[var(--wh-warn-bg)] px-3.5 py-2.5 text-sm font-semibold">{problem}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">{back}{next}</div>
      </div>
    </Page>
  );
}

/** website.mjs `option`: a radio card, its border darker when chosen. */
function Option({ name, group, checked, onChoose, children }: { name: string; group: string; checked: boolean; onChoose: () => void; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-[10px] bg-[var(--wh-panel)] p-4 ${checked ? 'border-2 border-[var(--wh-ink)]' : 'border border-[var(--wh-border)]'}`}>
      <input type="radio" name={group} checked={checked} onChange={onChoose} className="mt-0.5 size-[22px] accent-[var(--wh-ink)]" />
      <span className="flex flex-col gap-1">
        <span className="text-base font-bold">{name}</span>
        <span className="text-sm leading-[1.45] text-[var(--wh-muted)]">{children}</span>
      </span>
    </label>
  );
}

/** Step 2's body: the logo on the left, the main colour on the right. */
function LookStep({ state, onState, fromLogo, chosen, onChoose, onProblem }: {
  state: WebsiteState; onState: (next: WebsiteState) => void; fromLogo: Swatch[]; chosen: string;
  onChoose: (hex: string) => void; onProblem: (words: string | null) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [another, setAnother] = useState(false);
  // A colour that isn't one of the suggestions is shown as "Your own", so it
  // is still there, and chosen, after Back or a new logo.
  const own = [...fromLogo, CHARCOAL].some((s) => s.hex === chosen) ? null : { hex: chosen, name: colourName(chosen) };
  const anotherId = useId();

  async function upload(picked: File | undefined) {
    if (!picked) return;
    if (!PHOTO_TYPES.includes(picked.type)) { onProblem(`${picked.name} isn’t a picture Wheelhouse can use. Choose a JPEG, PNG or WebP.`); return; }
    try {
      onState(await apiMutate<WebsiteState>('/api/website/logo', { dataBase64: await readAsBase64(picked), contentType: picked.type }, { method: 'POST' }));
      onProblem(null);
    } catch (err) {
      onProblem(failed(err));
    }
  }
  function pickAnother(value: string) {
    const hex = value.toUpperCase();
    const problem = colourProblem(hex);
    if (problem) { onProblem(problem); return; }
    onChoose(hex);
  }

  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6 max-md:grid-cols-1">
      <div className="flex flex-col gap-2">
        <span className="text-size-15 font-bold">Logo</span>
        <div className="flex h-[140px] items-center justify-center rounded-[10px] border-2 border-dashed border-[var(--wh-border)] bg-[var(--wh-panel)] text-sm text-[var(--wh-muted)]">
          {state.logo ? <img src={state.logo} alt="Your logo, uploaded" className="max-h-[120px] max-w-[90%] object-contain" /> : 'No logo yet'}
        </div>
        <LinkButton onClick={() => file.current?.click()}>{state.logo ? 'Change logo' : 'Add a logo'}</LinkButton>
        <input ref={file} type="file" aria-label="Logo file" accept={PHOTO_TYPES.join(',')} hidden onChange={(e) => { const picked = e.target.files?.[0]; e.target.value = ''; void upload(picked); }} />
        <span className="text-size-13 leading-[1.4] text-[var(--wh-muted)]">No logo yet? Skip it — your shop’s name is shown instead, and you can add one later.</span>
      </div>
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="pb-2 text-size-15 font-bold">Main colour — for buttons and links</legend>
        <div className="flex flex-wrap items-start gap-6 max-md:gap-3">
          {fromLogo.length ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-[var(--wh-muted)]">From your logo</span>
              <div className="flex gap-2">{fromLogo.map((s) => <SwatchChoice key={s.hex} swatch={s} chosen={chosen} onChoose={onChoose} />)}</div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <span className="text-sm text-[var(--wh-muted)]">Wheelhouse’s own</span>
            <SwatchChoice swatch={CHARCOAL} chosen={chosen} onChoose={onChoose} />
          </div>
          {own ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-[var(--wh-muted)]">Your own</span>
              <SwatchChoice swatch={own} chosen={chosen} onChoose={onChoose} />
            </div>
          ) : null}
        </div>
        <LinkButton onClick={() => setAnother(true)}>Choose another colour</LinkButton>
        {another ? (
          <span className="flex items-center gap-2.5">
            <label htmlFor={anotherId} className="text-sm font-semibold">Another colour</label>
            <input id={anotherId} type="color" autoFocus value={chosen.toLowerCase()} onChange={(e) => pickAnother(e.target.value)} className="h-11 w-16 cursor-pointer rounded-md border border-[var(--wh-input-border)] bg-[var(--wh-panel)]" />
          </span>
        ) : null}
        <p className="m-0 text-sm leading-normal text-[var(--wh-muted)]">Every colour is checked so text on it stays easy to read.</p>
      </fieldset>
    </div>
  );
}

/** website.mjs `swatch`: a colour square with its name and code; the radio is read out. */
function SwatchChoice({ swatch, chosen, onChoose }: { swatch: Swatch; chosen: string; onChoose: (hex: string) => void }) {
  const on = swatch.hex === chosen;
  return (
    <label className="flex w-24 cursor-pointer flex-col items-center gap-1 text-center">
      <input type="radio" name="colour" checked={on} onChange={() => onChoose(swatch.hex)} aria-label={`${swatch.name}, ${swatch.hex}`} className="peer sr-only" />
      <span aria-hidden="true" className={`size-[52px] rounded-[10px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--wh-ink)] ${on ? 'shadow-[0_0_0_3px_var(--wh-panel),0_0_0_5px_var(--wh-ink)]' : 'shadow-[inset_0_0_0_1px_var(--wh-border)]'}`} style={{ background: swatch.hex }} />
      <span className="text-size-13 leading-[1.3] font-semibold">{swatch.name}</span>
      <span className="font-mono text-xs text-[var(--wh-muted)]">{swatch.hex}</span>
    </label>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wh-ink)] underline">{children}</button>;
}

/** Up to two readable colours from the logo, read through a small canvas; none if the browser can't. */
function useLogoColours(logo: string | null): Swatch[] {
  const [found, setFound] = useState<{ logo: string; colours: Swatch[] } | null>(null);
  useEffect(() => {
    if (!logo) return;
    let live = true;
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        if (!context || !live) return;
        context.drawImage(image, 0, 0, 64, 64);
        setFound({ logo, colours: coloursFromPixels(context.getImageData(0, 0, 64, 64).data) });
      } catch { /* a logo the browser won't read gives no suggestions */ }
    };
    image.src = logo;
    return () => { live = false; };
  }, [logo]);
  return found && found.logo === logo ? found.colours : [];
}
