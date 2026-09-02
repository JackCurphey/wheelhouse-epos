# Frontend platform decisions — 31 August 2026

Approver: Mark (direct selection). These are user decisions, not defaults.

They live in `docs/` rather than `.agents/` deliberately. `.agents/` is
gitignored as volatile working memory, and on 31 August an untracked
`.agents/DECISIONS.md` holding D-005 to D-007 was destroyed mid-session with no
git history to recover it from. Decisions are durable; the scratchpad is not.
Anything that must survive belongs here.

---

## D-005 — shadcn/ui + Tailwind supersedes most of the design remediation plan

**Context.** `docs/superpowers/plans/2026-08-31-design-remediation.md` (19 tasks)
was approved earlier the same day. Its D-002 rationale is explicitly that
extracting `tokens.css` "changes no existing selector, so 6,933 lines of
`app.js` template strings stay untouched", and D-003 rules out new
dependencies. Adopting shadcn/ui requires the opposite on both counts.

**Decision.** shadcn supersedes the overlapping half of the plan.

**Retired (11)** — Radix and Tailwind provide these directly:
1 (CSS/markup test helpers), 3 (extract `tokens.css` → Tailwind `@theme`),
4 (lock out untokenised colour → ESLint rule), 5 (spacing/type scale, focus
ring), 7 (modal shell → `Dialog`), 8 (escape + focus trap → Radix), 9 (touch
target floor), 10 (breakpoint system), 12 (toasts → Sonner), 13 (`confirm()`
replacement → `AlertDialog`), 19 (retire inline styles).

**Survives (8):** 2 (contrast gate, retargeted at `@theme`), 6 (live regions),
11 (phone booking picker), 14 (Front Desk primary action), 15 (storefront
rebuild on shared tokens), 16 (buy button state machine), 17 (booking selection
in URL), 18 (public page metadata).

**Consequences.** D-002 superseded — token extraction still happens, as a
Tailwind `@theme` block. D-003 superseded *for the frontend only*; `server/`
stays plain JS with `pg` as its only runtime dependency. **D-001 is unaffected
and still binding** — see below.

---

## D-006 — TypeScript for the frontend, plain JavaScript for the server

Every shadcn component and registry item ships as TSX, and the CLI's JS output
path swims against every doc and third-party registry item. There is no reason
to couple the server's language choice to it.

---

## D-007 — Re-platform only; no visual redesign during the migration

The migration keeps the current look and swaps the machinery underneath. Any
visual difference from the current app is a regression to fix, not an intended
change. Design direction remains Mark's to approve separately.

---

## D-001 carry-forward — the computed contrast tokens

D-001's table in the remediation plan is the authority. Three of its four values
are applied in `src/styles/theme.css`; the fourth is deliberately not.

| Token | Old | New | Ratio | Status |
|---|---|---|---|---|
| `--wh-brand` | `#d9581e` (3.91 ✗) | `#b8460f` | 5.36 | applied |
| `--wh-brand-dark` | `#b8460f` | `#93380b` | 7.47 | applied |
| `--wh-muted` | `#6b7570` (4.36 ✗) | `#5f6a64` | 5.14 / 5.63 | applied |
| `--wh-status-complete-paid-ink` | `#6b9484` (3.21 ✗) | `#4d7364` | 5.03 | **NOT applied — needs sign-off** |

The last one is held back on purpose. `styles.css:31-34` documents that this
state is *meant* to recede, and darkening the ink works against that intent.
The plan's resolution is to carry the receding signal in the background instead.
It is a visual change, so it waits for approval rather than being applied
silently.

**Note:** `public/styles.css` still carries the old `--brand: #d9581e`. Until the
vanilla app is retired or updated, it and the React theme disagree on the brand
colour. The React side is the corrected one.

---

## Open, not decided

1. **Dark mode palette.** `src/styles/theme.css` contains a dark palette that
   was invented during the scaffold, not derived from an approved design. Nothing
   renders it yet. It needs sign-off before anything does.
2. **`--status-waiting_parts-border` is still `#d9581e`** — the value D-001
   rejected for contrast elsewhere. Not covered by D-001; needs its own check.
3. **The registry primitives use no Radix.** They use native `<dialog>` and plain
   `<label>` because `@radix-ui/*` was not installed during the scaffold. That is
   a deviation from a normal shadcn registry and should be an explicit decision
   rather than an accident of the build order.
