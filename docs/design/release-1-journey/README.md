# Wheelhouse Release 1 journey atlas

Proposed visual build target for Mark and Jack’s store review, 10 September 2026. This applies the narrowed Release 1 scope; it is not final store sign-off or evidence of completed implementation.

Review and return screen-specific feedback in [GitHub issue #50](https://github.com/JackCurphey/wheelhouse-epos/issues/50).

Open **[Wheelhouse-Release-1-Journey-Atlas.html](Wheelhouse-Release-1-Journey-Atlas.html)** in a browser. It is a single offline file: no server, installation, account, fonts CDN or network service required. Use **Start walkthrough**, or click any screen. **All screens**, chapter filters, search, zoom and **Fit width** make the whole board navigable. In the screen viewer, Next follows the intended handoff; buttons open related states. Escape closes the viewer. Every screen has a stable reference for review and links to its P00–P10 work packages.

For store review, open a screen and use **Jack’s feedback** in the right-hand panel. Choose **Change requested**, **Question**, **Approved as shown** or **General note**, then save. Reviewed cards are marked on the board. **Review feedback** collects every saved comment and exports a single Markdown review ready to paste into the linked GitHub issue. Feedback is stored only in that browser’s local storage; export it before clearing browser data or moving to another device.

Review copies:

- [Whole journey board — PNG](Wheelhouse-Release-1-Journey-Board.png)
- [Whole journey board — single-page PDF](Wheelhouse-Release-1-Journey-Board.pdf)
- [All 84 screens — 85-page bookmarked PDF with cover](Wheelhouse-Release-1-Screen-Review.pdf)

The static copies are rendered from the screen markup using WeasyPrint and print-specific layout rules. The giant board PDF embeds every screen as vector content so it remains crisp when zoomed. The detailed review identifies each phone or desktop viewport and keeps one screen per page. Long forms show their initial viewport; scroll in the HTML viewer to see the rest. These are useful visual references, not screenshots proving Chrome/Safari rendering. The HTML remains the interaction/layout source of truth.

## Review route

1. Customer: service / unknown problem → bike details and optional media → drop-off or appointment → contact and channel preferences → request.
2. Service desk: review → reserve capacity → confirm → physically receive bike → print tag → scan into an authenticated staff job.
3. Mechanic and customer: inspection → itemised quote → secure line decisions → exact agreement preserved.
4. Workshop: allocate or claim → approved work → final check → Lightspeed work-order handoff → ready notification → physical collection → locked history.
5. Alternatives: full dates, rejected / expired requests, reschedule / cancellation, stale quotes, spending ceiling, capacity / claim conflicts, parts delays, delivery uncertainty, printer uncertainty, access denial and reopening.
6. Manager: profile / embed appearance, services / questions / checklists, hours / leave / closures, booking controls, messaging setup / templates, one Lightspeed connection, printing and staff access. Staff customer/bike maintenance and duplicate review remain in scope.

## Scope and fixture contracts

Authority: [scope reduction](../../decisions/2026-09-10-release-1-scope-reduction.md), [implementation plan](../../superpowers/plans/2026-09-10-release-1-workshop-plan.md), [Lightspeed readiness](../../decisions/2026-09-10-release-1-lightspeed-readiness.md), [revised row ledger](../../reviews/2026-09-10-release-1-revised-traceability.csv). Existing prototype and approved Wheelhouse colour/type tokens informed the screen styling. This artefact does not modify production screens or replace the existing stateful prototype.

The primary fixture is Maya Patel’s green Trek Domane, job WH-1042, at fictional North Street Cycles. The base service is £65. New brake pads are £28 and fitting £18; optional cable is £12. The canonical agreement is £111 with the cable declined. The approval screen’s checkboxes calculate alternate totals and validate the brake repair dependency; its confirmation reflects those selections. Other screens are named fixed-state specimens of the canonical scenario, not a fully stateful product simulation. Diagnosis and delay branches have explicitly identified alternative fixtures.

Forms display intended controls. Inputs and local file selection are illustrative; they do not persist, upload or send. Navigation actions show the intended next state. A real implementation must validate and persist form values rather than copying these fixture strings. Shared save confirmation is a review specimen; production should retain the edited screen and show a specific confirmation there.

Approval, extra-effort allocation, physical custody, work completion and collection are independent facts. There are no Wheelhouse invoice, payment-link, refund, customer-import, reporting, group-capacity or recovery-development flows. All financial operations remain at the shop’s Lightspeed till.

## Open decisions surfaced in screen notes

- Confirm the actual first shop’s Lightspeed series. R-Series is a provisional specimen; real OAuth, employee rights, endpoint / stock behaviour and required reads/writes remain unproven. Connected screens are intended UI states, not claims of access.
- Confirm printer host, driver, dimensions, label stock, 2D / 1D scanner and physical print quality. Existing agent direction is Windows. Tag deliberately omits customer name/contact by default. The valid sample QR points to the reserved example URL `https://wheelhouse.example/staff/jobs/WH-1042`; it is not a live staff route or customer token. An agreed 1D scanner needs Code 128 in addition.
- Validate four-hour reservation expiry and 60-minute staff capacity reserve. These are proposed defaults, not decisions already made by Jack.
- Agree spending-ceiling scope and linked-line repair behaviour. The customer sees individual lines and their dependency; inconsistent brake selection is blocked with an explanation.
- Align final staff role matrix and sign-in method with the existing authentication plan. Staff-only QR resolution must be enforced server-side.
- Choose and prove messaging providers, inbound routing and WhatsApp requirements. Credential fields are preliminary until that evidence exists.

## Validation and editing

`verification.json` records the completed DOM/interaction checks: all 84 IDs and navigation targets, no JavaScript errors, labelled controls, search/filtering, modal navigation, quote arithmetic and dependent-line validation. Real Chromium and Chrome were attempted but aborted in the managed workspace, so browser layout, cross-browser behaviour, focus appearance and real device usability still need verification. The static print render is a separate check and does not close those gaps.

`pdf-verification.json` records the PDF checks: 84 vector cards on the single-page journey board; a cover plus 84 screen pages in the review book; 91 bookmarks; and extracted headings and design notes for every screen. Representative pages from every screen family were also inspected at full resolution.

Sources: `screens.js` (primary journey), `branches.js` (alternatives/settings), `screen.css` (product UI), `atlas.js`, `atlas.css`, `template.html`, `tag-qr.svg`. The screen index is machine-readable in `screen-index.json`.

Repackage and validate:

```sh
python3 docs/design/release-1-journey/package.py
node docs/design/release-1-journey/check-static.mjs
PYTHONPATH=/tmp/wheelhouse-ux-python python3 docs/design/release-1-journey/check-pdfs.py
```

`check.mjs` is the Playwright layout/navigation check to run in an environment that can launch a browser. `export-screens.mjs`, `render-review.py` and `assemble-review.py` produce the static review copies; the renderer requires WeasyPrint, PyMuPDF, Pillow and Pango. The generated HTML remains standalone when copied elsewhere; its relative specification links work from this repository.
