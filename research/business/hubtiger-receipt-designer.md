# Hubtiger — Receipt Designer

**Date:** 8 September 2026

**What prompted this:** on 8 September 2026 a trial account was opened with Hubtiger (hubtiger.com), a repair/rental shop management product and the main competitor to this project. The trial account's Settings screen showed a "Receipt Designer" item under a "Plugins" group, alongside "Website Widget" and "Shop Rides Widget". This note records what could and could not be independently confirmed about it from Hubtiger's own public material.

**Confidence tags:** **[V]** verified against a primary source · **[R]** third-party reported, not vendor-confirmed · **[U]** unverified / could not confirm · **[NF]** searched for, not found — *which is not proof of absence*.

---

## What this is

Hubtiger is cloud-based shop management software for bike (and other) repair and rental businesses, sold in separate "Repair Software" and "Rental Software" product lines with tiered monthly pricing **[V]** (`https://hubtiger.com/pricing/`). It runs alongside a shop's existing point-of-sale (POS) system rather than replacing it — the product is explicitly built to plug into POS platforms for payment and transaction processing **[V]** (`https://hubtiger.com/integrations/`).

A "Receipt Designer" plugin was observed directly in the trial account's Settings > Plugins group on 8 September 2026, per the task brief. This is a first-hand, in-product observation by the person who opened the trial, not something this research independently reproduced — no trial account was opened as part of this research pass, and no matching public documentation was found (see "What we could not establish" below).

---

## Findings

### 1. What the Receipt Designer does, what's customisable, output formats

**[NF]** — No page on hubtiger.com, no article in Hubtiger's public help centre (`https://help.hubtiger.com/`), and no third-party writeup (Capterra, SoftwareAdvice, Software Finder, Slashdot, GetApp, TrustRadius) mentions a "Receipt Designer" feature by that name. Searched directly for the phrase "Receipt Designer" plus "Hubtiger", and for "Hubtiger" plus "plugin", "receipt", "printer settings" — none surfaced it.

What *is* documented, which is adjacent but not the same feature:

- Hubtiger's help centre categorises "Repair Software" documentation into 12 sections including **"Calendar and Job Cards"** and **"Payments and POS Integration"** — no "Receipts" or "Printing" section is listed among them **[V]** (`https://help.hubtiger.com/`, fetched 8 Sept 2026).
- A Hubtiger marketing article ("17 Must-Have Job Card Software Features") describes opening a job card and using **a printer icon in the top-right corner to produce a printable version of the job card** **[R]** (surfaced via search snippet, not independently confirmed by fetching the exact source page, which did not contain this detail when fetched directly — see gaps below). This is a *job card* print, not a customer receipt, and nothing found describes it as customisable (no mention of logo, fields, layout, or terms).
- Hubtiger's own "Job Card Software" marketing page (`https://hubtiger.com/job-card-software/`) was fetched directly and contains **no mention** of printing, PDF export, receipts, or a "Receipt Designer" **[V, negative finding]**.
- Hubtiger's FAQ page (`https://hubtiger.com/faq/`) was fetched directly and contains **no mention** of receipts, printing, job-card output, or a "Receipt Designer" **[V, negative finding]**.

**Confirmed structural pattern that supports the trial-account observation being plausible in shape:** Hubtiger's Settings does use a **"Settings > Plugins"** grouping for at least one other named feature — the **Service Booking Widget** — which is customisable for primary/secondary colours, card background, border-radius and fonts, and can be embedded via a copyable URL or iFrame code **[R]** (search-engine synthesis of Hubtiger help content; not independently fetched from a single confirmed URL). This corroborates that "Settings > Plugins" containing named, brand-customisable widget-style features is a real pattern in the product — but it does not confirm the specific content, customisation options, or output formats of a "Receipt Designer" item within that group.

### 2. Plan gating — is it on all plans or gated to higher tiers?

**[NF]** — Hubtiger's pricing page (`https://hubtiger.com/pricing/`, fetched directly 8 Sept 2026) lists Repair Software tiers **Lite ($52/mo), Professional ($99/mo), Premium ($125/mo)** and separate Rental Software tiers by item-count band (**Lite $42/mo through Enterprise $315/mo**). None of the plan feature lists on that page mention "Receipt Designer", "Plugins", or any receipt/printing capability by name at any tier **[V, negative finding]**. Whether the plugin is universal or tier-gated could not be established from public pricing copy.

### 3. Relationship to POS integrations — whose branding prints?

**[NF]** for a direct statement, but the surrounding evidence points one way. Hubtiger integrates with (at least) Lightspeed, Square, Shopify, Epos Now, Retail Express, Global Payments, Teamwork Commerce, Sage, Xero and Cin7 **[V]** (`https://hubtiger.com/integrations/`, fetched 8 Sept 2026). Hubtiger's own point-of-sale-integration marketing page states that at the point of sale, **"the POS software calculates the total amount due, processes payments, updates inventory levels, and generates receipts; all in real-time"** **[V]** (`https://hubtiger.com/point-of-sale-integration/`, fetched 8 Sept 2026) — attributing receipt generation to the connected POS, not to Hubtiger. Nothing on that page claims Hubtiger overrides or replaces the POS's own receipt output.

This makes it plausible that a "Receipt Designer" plugin, if it exists as seen in the trial, is scoped to Hubtiger's *own* documents — job cards, quotes, or workshop tickets that Hubtiger generates directly — rather than to the transactional receipt the connected POS prints at checkout. This is inference from the surrounding documentation, not a confirmed fact **[U]**.

### 4. Thermal printer support, A4/A5, PDF, email delivery

**[NF]** — No public Hubtiger material found specifies printer hardware compatibility (thermal or otherwise), paper size (A4/A5/80mm roll), PDF export, or email delivery of any designed receipt or job card. The only concrete printing reference found anywhere in Hubtiger's own content is the generic "printer icon" on a job card, reported third-hand (see §1) and not confirmed on the specific page it was attributed to.

### 5. Comparable features in competitors

- **Velodrop** — has documented print functionality for **work orders and job tickets** ("print work orders and tags... create, view and print job tickets, attach them to bikes and assign them to mechanics") **[R]** (search-engine synthesis from `velodrop.com/bike-shop-work-order-software/` and related pages; not independently fetched from a single confirmed URL). No detail found on customisation (logo/layout) or output format.
- **Bikebook** — its help centre explicitly documents printing both **"internal job tickets to guide your mechanics"** and **"customer receipts to finalise transactions,"** with separate named help articles "How To Print A Job card" and "How to print a receipt or job ticket" **[V]** (`https://docs.bikebook.co.uk/en/collections/10669632-job-cards`, fetched 8 Sept 2026). This is the closest confirmed match among competitors to a dual job-card-and-receipt print feature, though the article content itself (PDF/logo/paper-size details) was not opened.
- **Citrus-Lime — Book My Bike In** — this is an online booking front-end, not a receipt/document designer; it auto-creates a Workshop Job in Citrus-Lime Cloud POS on booking **[R]** (Citrus-Lime support pages). No print/receipt-design capability specific to Book My Bike In was found; general Citrus-Lime Cloud POS e-receipt functionality exists separately (`howto.citruslime.com/sales-returns-and-exchanges/cloud-pos-e-receipts-2`) but was not opened to check for design/customisation options **[NF]**.
- **QuoteMachine (by Lightspeed)** — has a documented **branded template editor** for quotes, invoices, contracts and statements, including a tutorial "How to edit and customize your templates" **[V]** (`https://www.quotemachine.com/en/blog/how-to-make-a-quote-template-in-4-minutes/`, referenced via search; page itself not independently fetched, so tagging as **[R]** rather than [V] for the specific customisation claims). This is the closest thing found across all competitors to a genuine "document designer" as opposed to a fixed-format print button — but QuoteMachine targets quotes/contracts, not till receipts, and is a Lightspeed add-on rather than a repair-shop-specific tool.

---

## What we could not establish

- **[NF]** Whether Hubtiger's Receipt Designer exists at all as public-facing documented functionality — it appears in the trial account per the brief, but no corroborating vendor documentation, help article, marketing page, or third-party review was found describing it by name.
- **[NF]** What document type(s) it actually designs — receipt, job card, quote, or workshop ticket — could not be confirmed from any source.
- **[NF]** What is customisable within it (logo, fields, layout, terms & conditions text).
- **[NF]** Output format(s) — PDF, direct thermal print, email.
- **[NF]** Printer/paper-size support — thermal roll widths, A4, A5.
- **[NF]** Which pricing tier(s) it is available on, or whether it's universal.
- **[NF]** Whether it governs the receipt printed by the connected POS at checkout, or only Hubtiger-generated documents (job cards/quotes) — the surrounding evidence (§3) points toward the latter but this is inference, not a confirmed fact.
- Not attempted in this pass: opening a fresh Hubtiger trial account to inspect the Receipt Designer directly, or fetching a YouTube demo that walks through it — no such demo was located in searches performed, but a dedicated video search was not exhaustively run.

---

## Why it matters here

If the Receipt Designer turns out to be scoped narrowly — a customisable print layout for job cards/workshop tickets, sitting alongside (not replacing) whatever receipt the shop's actual POS prints — then it is a modest, table-stakes feature. Bikebook already documents an equivalent (print job ticket *and* customer receipt), and Velodrop documents work-order printing. It would not represent a unique capability gap so much as parity with at least one direct competitor.

If it turns out to be a genuine branded-template editor in the way QuoteMachine's is (logo, layout, terms, multiple document types, PDF/email delivery), that would be a more substantive gap worth taking seriously — repair shops do care about handing customers a professional-looking, branded job ticket or receipt, and "looks like a real business" is a plausible small-shop buying signal.

The honest position right now: this cannot be resolved from public material. Hubtiger doesn't document the feature publicly under this name anywhere that was found, which is unusual for a feature prominent enough to sit in a top-level Settings > Plugins group — that itself is worth noting, not just the feature's contents. The next concrete step, if this matters for prioritisation, is to open a Hubtiger trial directly and screenshot/document the Receipt Designer screen rather than relying on further web search, which has been exhausted for this pass.

---

## Sources

- `https://hubtiger.com/pricing/` — pricing tiers, feature lists, fetched directly 8 Sept 2026
- `https://hubtiger.com/faq/` — FAQ page, fetched directly 8 Sept 2026 (no receipt/printing content)
- `https://hubtiger.com/integrations/` — list of supported POS systems, fetched directly 8 Sept 2026
- `https://hubtiger.com/point-of-sale-integration/` — POS integration description, fetched directly 8 Sept 2026 ("POS software... generates receipts")
- `https://hubtiger.com/job-card-software/` — job card features marketing page, fetched directly 8 Sept 2026 (no printing/receipt content)
- `https://help.hubtiger.com/` — Hubtiger public help centre home, fetched directly 8 Sept 2026 (category list; no Receipt Designer or printing category)
- `https://docs.bikebook.co.uk/en/collections/10669632-job-cards` — Bikebook help centre, job cards & receipt printing, fetched directly 8 Sept 2026
- `https://velodrop.com/bike-shop-work-order-software/` — Velodrop work order/print claims (via search synthesis, not independently fetched)
- `https://citrus-lime.helpjuice.com/book-my-bike-in-how-does-it-work` and `https://howto.citruslime.com/book-my-bike-in` — Citrus-Lime Book My Bike In documentation (via search synthesis)
- `https://howto.citruslime.com/sales-returns-and-exchanges/cloud-pos-e-receipts-2` — Citrus-Lime e-receipts help page (referenced, not opened)
- `https://www.quotemachine.com/en/blog/how-to-make-a-quote-template-in-4-minutes/` — QuoteMachine template customisation (via search synthesis, not independently fetched)
- Search queries run without a single confirmable primary source (used for context only, not as citations for claims above): "Hubtiger Receipt Designer", "Hubtiger 'receipt designer' plugin", "Hubtiger help center receipt printer settings", "site:hubtiger.com receipt", "Hubtiger website widget shop rides widget plugins settings", "Hubtiger knowledge base intercom help.hubtiger.com", "Hubtiger pricing plans tiers plugins gated", "Bikebook shop management job card print receipt", "QuoteMachine bike shop print quote receipt customise", "Hubtiger Capterra reviews receipt design customise logo"

---

## Addendum — verified in the product, 8 September 2026

Added after the desk research above, by driving the live trial account. This
resolves most of the **[NF]** items. Everything in this section is **[V]** —
observed directly on screen at
`hubtigerportal.azurewebsites.net/store/receipt-templates`.

### It is not a till-receipt designer

The screen's own title and subtitle:

> **Receipt Template Designer**
> *"Create and manage print templates for job cards and dispatch memos."*

The desk research inferred from Hubtiger's POS page that the feature governs
Hubtiger's own documents rather than the POS receipt, and tagged that **[U]**.
**Confirmed [V].** It designs **job cards and dispatch memos**. The connected
POS still generates the sale receipt.

The menu label ("Receipt Designer") and the screen title ("Receipt Template
Designer") differ, which is likely why the phrase returns nothing publicly.

### It is a full drag-and-drop WYSIWYG editor

Not a settings form. A grid canvas with a merge-tag palette, and the
instruction *"Drag merge tags from the left panel onto this canvas"*. Toolbar:
grid toggle, zoom out / **100%** / zoom in, preview, undo, redo, print,
duplicate. Selecting an element opens a properties panel. Templates list with
**Name · Type · Dimensions · Active · Default · Last updated · Actions**, so
multiple templates per type with one default.

### Paper and label sizes — resolves the format [NF]

**A4 Portrait · A4 Landscape · A5 Portrait · A5 Landscape · Label Small
(50×25) · Label Medium (100×50) · Label Large (100×150) · Custom.**

A4 reports as 210 × 297 mm on the canvas. The three label sizes plus Custom
mean this covers **bike tags**, not just paperwork — the physical label that
goes on the bike in the rack.

### Merge fields available — and what they reveal about the data model

- **Customer:** First Name, Last Name, Email, Phone Number, Address, Customer notes
- **Job card:** Custom Questions, Technician, Job Card No., Quote, Total,
  **Bay Number**, Scheduled Date, **Required by Date**, **Third Party Name**,
  Service Type, Status, **Pre-service checks**, Totals, **Checklists**
- **Bike:** Color, Bike Details, Model, **Serial No.**, Size, Year
- **Barcodes, attachments & image:** **Barcodes**, Attachments,
  **Quote (Barcodes)**, **QR Code image**, **Third Party Logo**
- **Extras:** Shop Logo, Your store name, External Notes, Internal Notes
- **Custom:** Free Text, Line

Four of these are the interesting ones, because they are data we do not model:

- **Bay Number** — physical workshop location for the bike
- **Third Party Name / Third Party Logo** — subcontracted work sent out and
  back, with the subcontractor's own branding on the paperwork
- **Pre-service checks** and **Checklists** — structured condition capture at
  intake, printable
- **Barcodes / Quote (Barcodes) / QR Code image** — scannable job cards, which
  is what makes a printed tag part of a workflow rather than a receipt

### Not tested

- Whether a saved template can be set per service type, or is global **[NF]**
- What the print output actually looks like — no template was saved, since
  that writes to the account **[NF]**
- Tier gating still unresolved: the feature is present on a trial, which does
  not establish which paid tier carries it **[NF]**

### Why this changes the read

The desk research's cautious conclusion — that this is probably about
Hubtiger's own documents — was right. But "print templates for job cards" is a
substantial understatement of what is there. It is a template designer with
label-printer support, scannable barcodes, and merge fields for workshop
concepts (bay, third party, checklists) that imply a deeper job model than
either Velodrop or our own.

Velodrop's equivalent is a single **Print** button on the workorder with no
customisation observed. That is the honest comparison: not "both have
printing", but "one has a print button and the other has a template designer".
