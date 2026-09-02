# Wheelhouse EPOS — Strategic Report (v2)

**Date:** 31 August 2026 · supersedes v1 of the same date
**Confidence tags:** **[V]** verified against a primary source · **[R]** third-party reported · **[U]** unverified · **[NF]** searched, not found (not proof of absence)

> **Platform decision, 2 September 2026.** This report does not pick a first
> platform. `docs/decisions/2026-09-02-lightspeed-first-platform.md` does:
> Lightspeed R-Series, UK shops first, integrating by reading data *out* of the
> incumbent rather than writing bookings into it. It supersedes §5b of
> `2026-09-01-wedge-booking-vs-workshop.md`. Read it before acting on §10 here.

---

## 0. Corrections to v1 — read this first

Five things in v1 were wrong or overstated. They are corrected throughout, and listed here because v1 was circulated.

| v1 said | Correct position |
|---|---|
| Citrus-Lime costs ~£63.50/mo **[R]** | **Fabricated.** Traced to a dead blog post on Bikebook.co.uk — a *competitor* — repeated 8× as filler, matching no real tier. Real published pricing: **£105 / £339 / £515 per month ex VAT** **[V]** |
| Madison "publishes no API", implying no interface exists | **The barrier is commercial, not technical.** A working live feed demonstrably exists; access is gated by a per-integrator agreement and a per-supplier "SIM licence" **[V]** |
| "A shop owner built a rival bolt-on" was our strongest signal | **The source was never readable** — 403 on every attempt, zero Wayback snapshots. Claim reframed and re-sourced to three verifiable companies **[V]** |
| UK software SAM ≈ £1.3–6.6M/yr | **~6× too low**, because it was built on the fabricated price. Revised in §3 |
| Saledock is the ACT's endorsed UK partner | Still endorsed — but **acquired by Celerant (US) in March 2025 and rebranded "Celerant ONE" in August 2026** **[V]** |

---

## 1. Executive summary

The market is worth far more per shop than v1 assumed, the incumbent just took outside capital, and the distributor layer we planned to integrate with is visibly unstable. That combination argues for moving faster on a narrower wedge.

1. **Citrus-Lime charges £4,070–£6,180/year**, not £760. The market will support a real price, and there is far more room beneath the incumbent than we thought.
2. **Citrus-Lime recapitalised in November 2025.** Founders ceded control to a new topco with institutional secured debt. They now have capital to invest and probably to acquire. The window is narrowing.
3. **The Madison barrier is commercial.** There is a working interface; we simply aren't party to it. There is also a second door nobody has tried: **TrueCommerce/Netalogue**, who operate the platform under both Madison and Silverfish.
4. **UK bike distribution is in visible distress** — Saddleback in administration, Accell/Raleigh in insolvency proceedings, ZyroFisher carrying a going-concern note. Betting the strategy on distributor integrations is riskier than v1 implied. Madison is the healthy one.
5. **Payment freedom survives as the wedge**, but should be built as a curated adapter over cloud terminal APIs rather than "no payments at all".

---

## 2. Competitors — with financials

All figures from Companies House filed accounts, read directly. **[V]**

### Citrus-Lime Ltd — company 03792454

Turnover is **never disclosed** in any filed year (small-company exemption). What is filed:

| Year to 31 Mar | Net assets | Employees |
|---|---|---|
| 2021 | £776,986 | 47 |
| 2023 | £1,379,271 | 57 |
| 2025 | £1,080,537 | 69 |

Headcount +47% over four years while net assets fell 22% from the 2023 peak and cash fell £533k → £307k. That is a business investing ahead of revenue, not one in trouble.

**The material event:** on 20 November 2025 a new holding company, **Citrus-Lime Topco Ltd** (incorporated 7 Nov 2025), replaced the three founder-directors as controlling party, and a charge was registered to **BGF Nominees Limited as Security Trustee**, followed by a fresh Clydesdale charge in January 2026. Historic NatWest charges were satisfied the same month. That is a textbook buyout/recapitalisation signature. BGF Nominees is the standard vehicle of BGF, a well-known UK growth investor — but **the BGF identification is an inference from the charge-holder name, not a confirmed press statement [U]**.

**Implication:** the incumbent is small (69 staff) but newly capitalised. Expect product investment, aggressive pricing, and possible acquisition of smaller rivals. This also explains the shift to published pricing and the ~3% price rise in four months — professionalising for investors.

### Pricing — verified **[V]**

From citruslime.com/pricing/uk/, fetched 31 Aug 2026, **ex VAT**, single site:

| Tier | Price | Includes | Card rates |
|---|---|---|---|
| Essentials | £105/mo | POS, reports, supplier data, workshop — **no ecommerce** | 1.8% + 9p |
| Growth *(their "most popular")* | £339/mo | Adds full ecommerce, Reports PRO | 1.6% + 8p |
| Advanced | £515/mo | Ecommerce PRO, Xero/QuickBooks, CMS | POA |
| Enterprise | POA | — | Custom |

**Real cost to a typical single-site shop wanting a webstore: £339 + VAT = £406.80/mo ≈ £4,882/year** — before per-supplier SIM licence fees (**price published nowhere [NF]** — a genuine unknown), card processing, multi-site surcharges and hardware.

Two further observations:
- **They only began publishing prices in late 2025** — Wayback shows no earlier pricing snapshots. Before that it was quote-only.
- **Their card rates improve as you pay more** (1.8% → 1.6%), a soft version of exactly the bundling Lightspeed was attacked for.

### The rest of the UK field

| Vendor | Financial reality | Read |
|---|---|---|
| **Saledock / Celerant ONE** | Acquired by **Celerant (US)** Mar 2025; rebranded Aug 2026. UK entity had **negative net worth (-£14,561)** and 7 staff at May 2025 **[V]** | The ACT's endorsed partner is now the UK arm of a US platform |
| **Seanic Retail** | 3 employees, £18,146 net assets, falling **[V]** | Lifestyle-scale micro business |
| **i-BikeShop** | Not a company — a brand of **SiWIS Ltd, 1 employee** **[V]** | Effectively a sole operator |
| **Bikedesk** (DK) | CVR 35802843; **financials not obtainable** — register blocked **[NF]**. ~25–30 staff from their own team page **[U]** | Closest philosophical peer |
| **Lightspeed** | Public company | Payment-bundling backlash documented **[V]** |
| **Ascend** | Trek-owned **[V]** | Quote-only |

**Strategic read:** the displaceable incumbents are not Citrus-Lime. They are **Seanic (3 staff) and i-BikeShop (1 person)** — real vendors with real customers and no capacity to compete on product. That is where a credible new entrant takes its first share.

### The distributor layer is unstable **[V]**

| Company | Status |
|---|---|
| **H Young (Madison)** | **Healthy.** £120.3m turnover FY2024, £6.1m operating profit, £52.0m net assets, 290 staff, £10m/yr dividends to parent. Group £176.2m. Owned by Dr Ronald Sämann. Bicycle segment sales down 3.5%, but solid |
| **ZyroFisher (Zyro Ltd)** | £48.3m turnover; losses of **-£9.3m (FY24) and -£1.5m (FY25)**; **going-concern note**; dependent on LGT Private Debt continuing support |
| **Saddleback Ltd** | **In administration, 29 May 2026.** 42 redundancies |
| **Accell (Raleigh)** | **Notice of intention to appoint administrators, 5 Aug 2026.** KKR losses estimated >€1bn |

Two brand-name distributor failures in three months, and a third on parent life-support. Any strategy assuming stable distributor relationships is building on contested ground. Madison being the healthy one validates targeting it — but also means Madison has no pressing need to help a tiny vendor.

---

## 3. Market sizing — revised

### Shop counts **[V]** except where noted

| Territory | Count | Definition |
|---|---|---|
| **UK** | 1,675 "true independents" / 2,203–2,252 all businesses | IndieRetail.UK (2022) / IBISWorld (2024–25) |
| **USA** | ~3,400 specialty / 10,004 broad | Definitions differ by 3× — state which you mean |
| **Canada** | ~1,381–2,000+ | Directory scrape, not a census |
| **Australia** | 1,228 | IBISWorld ANZSIC, 2026 |
| **Ireland** | **Not found [NF]** | Do not interpolate |
| **New Zealand** | **Not found [NF]** | The 969 "sport & camping" figure is *not* a bike-shop proxy |

### Revised UK SAM

v1 assumed £780/shop/yr on the fabricated price. Using **real** pricing:

- Floor (Essentials, no ecommerce): £105 × 12 = £1,260/yr ex VAT
- Realistic (Growth): £339 × 12 = **£4,068/yr ex VAT**

1,675 UK independents × £1,260–£4,068 = **£2.1M – £6.8M/yr**, midpoint ~£4.5M.
Using the broader 2,252 count: **£2.8M – £9.2M/yr**.

**This is a model, not a researched figure.** It assumes every shop buys dedicated software at list price, which is false — many run Square, Shopify POS, spreadsheets, or nothing. Real penetration is unknown.

Honest conclusion: **the UK alone is a single-digit-millions market.** It supports a profitable small company, not a venture outcome. Multi-territory or multi-vertical expansion is required for anything larger.

### Best second vertical: motorcycle / powersports **[V]**

15,781 US dealers and 2,121 UK — larger than bikes, same structural shape (serialised inventory, service department as profit centre, parts counter, seasonality). Caveat: entrenched incumbents (DX1, Karmak) already serve it. Not white space.

Worth noting: Citrus-Lime already serves outdoor/watersports — a named customer is **Pyranha Kayaks** **[V]** — so vertical adjacency is a proven route in this market.

Ski, golf, running, outdoor and marine were all sized or ruled out; running and outdoor lack the workshop component that makes bikes interesting. One flagged figure: the "10,141 US surf shops" statistic is **implausible and should not be used [U]**.

---

## 4. Madison — corrected

### The mechanism **[V]**

Data does flow. Citrus-Lime builds and maintains a bespoke feed per supplier, branded **SIM/AutoSIM**; their own blog calls each new one "this new **direct feed**". Retailers need a **per-supplier SIM licence** before that supplier appears. Madison's B2B site runs on **TrueCommerce Netalogue**, and trade press confirms a "real-time link to the Madison commercial system with full online stock availability".

- **No evidence retailers enter their own Madison credentials** — the setup docs cover only in-POS mechanics. Points to a vendor-level agreement, not per-shop scraping. Not conclusive **[U]**.
- **Every UK distributor works this way.** ZyroFisher and Extra UK show the identical pattern: advertised live integration, zero published spec.
- The transport — Netalogue API vs EDI vs bespoke FTP — is **not documented anywhere [NF]**. A claim that Netalogue exposes an OAuth2/Hub API came from a search summary that could not be confirmed **[U]**.

### The second door

**TrueCommerce/Netalogue operate the platform under both Madison and Silverfish.** If they have any partner-integration route, one build could reach several distributors. Nobody appears to have asked. This is the highest-value unexplored lead in the report.

### Registration

Trade account: `newaccounts@madison.co.uk` / 01908 326032. Requires company and VAT registration, trade references, turnover band, director and bank details; credit review; first order pro-forma **min £500 at cost**. The form notes Madison "is not actively seeking to develop new accounts."

**No software-vendor programme is documented [NF].** Route the integration ask to whoever owns the B2B platform commercially, not the new-accounts desk. Ask the seven questions in §9.

### How it plugs into our architecture

The seam is sound: `fetchItems(config) → [{supplierSku, barcode, name, price, stockQty}]`, one file plus one registry line. Seven gaps before a real feed lands:

1. **Contract too thin** — five fields, and **no RRP column exists**, so auto-pricing on import is impossible
2. **N+1 upsert** — one round-trip per item against tens of thousands of SKUs
3. **Whole catalogue in memory** — returns one array
4. **Credentials in plaintext** — `suppliers.config` is unencrypted JSONB, while AES-GCM already exists in `shopify.js`
5. **No scheduling** — manual POST route only
6. **No delisting** — `last_seen_at` written but never acted on
7. **No electronic ordering** — POs have no submission path. **This is where the value is**

---

## 5. Validated market pain — re-sourced

### 5.1 Pricing and payment coercion — STRONGEST **[V]**

Lightspeed told retailers to adopt its processor or pay more; one shop quoted **$138 → $602/month**, a co-owner called it "blackmail". A **$400/month penalty** for non-adoption was reported in late 2025. Capterra: rate doubled four months into a twelve-month contract. BBB complaints allege undisclosed hikes. Citrus-Lime Trustpilot (Nov 2025): "continuously raise the cost each month."

### 5.2 Lock-in and migration fear — STRONG **[V]**

A shop stays on a disliked system rather than risk "losing information we have gathered over our 15-year history". Note the nuance: the complaint is *fear of* a bad migration, not a documented failed export **[U]**.

### 5.3 Workshop gaps — RE-SOURCED

**The v1 framing does not hold.** The Bike Forums thread was unreadable (403 every attempt, **zero Wayback snapshots** — the Internet Archive has never captured it), and a "posted June 2026" date appears to have been invented by a search summariser. It should never have been called our strongest signal.

**The pattern itself is real**, sourced properly to three independently-operated companies built specifically to bolt booking/work-orders/SMS onto Lightspeed and Ascend:

| Company | Evidence | Pricing |
|---|---|---|
| **Velodrop** | Wayback history to **January 2018** — genuinely long-running. "Founded by experienced bicycle mechanics" **[V]** | Not published |
| **Masterlinq** | Active since Oct 2023. Explicitly markets against "manual phone bookings and inventory confusion that traditional systems create" **[V]** | Not published |
| **Bikebook Workshop** | Active since Apr 2024. **£49.99/mo ex VAT** (not the $89 in v1). Listed in NBDA's "Friends of" section **[V]**. The "400+ UK businesses" claim is **not found on the current site [U]** |

**Velobench** — the product tied to the unreadable thread — exists, but rests entirely on its own marketing site: no Wayback history at all, no press, no LinkedIn, and the shop that supposedly built it never mentions it **[U]**.

Corrected claim to use: *"At least three independently-run companies have built businesses bolting workshop tooling onto incumbent POS systems — the oldest operating since 2018."* That is defensible. The single-anecdote version was not.

### 5.4 Also validated

Support quality **[V]**; cloud outages disabling the till **[V]**, severity single-sourced **[U]**.

### 5.5 Evidence gap

**Reddit was unreachable across every attempt** in all research passes. That is a real hole, not proof those communities are quiet.

---

## 6. Payments — revised position

v1's "we never touch payments" is replaced by **merchant choice via a curated adapter**, which is strictly stronger.

Only providers with **cloud/server-driven terminal APIs** — no native app, no local SDK:

| Provider | Fit | Detail |
|---|---|---|
| **SumUp Cloud API** | Best | Explicitly for POS on "any platform… web-based"; HTTPS only |
| **Stripe Terminal** (server-driven) | Strong | Stripe now steers away from the JS SDK; UK 1.4% + 10p |
| **Square Terminal API** | Strong | Built for third-party POS; rev-share real but **capped at 24 months** |
| Adyen / Worldpay / Dojo / Zettle | Not yet | Enterprise-oriented or undocumented ISV terms **[U]** |

This suits our architecture — we already ship an Electron agent on Windows, exactly where a cloud terminal call belongs.

**Two constraints:**
- **Don't model revenue on it.** Stripe shares none of its margin — you'd add a visible platform fee. Square's referral bonus needs $250k/yr volume, out of reach for most UK independents. This is differentiation, not a revenue line.
- **PCI decides the architecture.** Card data through certified terminals only, never our UI → SAQ A online, SAQ B-IP in store. Requires a QSA review before launch, not a research summary.

**Tap to Pay requires a native app on every provider** — out of scope for a browser-first stack.

---

## 7. Shopify — bring your own store

We already do BYO Shopify via manual custom-app tokens. **That judgement has got worse, not better.**

- **Since 1 January 2026, merchants can no longer create custom apps from the store admin.** They must use Shopify's separate **Dev Dashboard or CLI [V]**. Our onboarding instructions are stale and will confuse shop owners today.
- **The one-click-install-without-review path does not exist.** Shopify's custom distribution is restricted to stores within the same Shopify Plus organisation — not arbitrary merchants **[V]**. The choice is genuinely binary: manual tokens, or full App Store review.
- App Store terms: **0% revenue share to $1M lifetime**, 15% above; 2.9% only if billing through Shopify (avoidable by billing outside) **[V]**. Registration fee reported as $19 **[U]**.
- Quarterly API versions, 12-month support windows; listed apps face delisting if they don't migrate **[V]**.

**BYO Shopify is not a differentiator** — Bikedesk and Rain POS both support it, Rain with a dedicated two-way sync product, and Masterlinq ships an actual App Store listing bridging Lightspeed and Ascend **[V]**. What differs is friction, and nobody has solved it because Shopify doesn't offer the mechanism.

**Recommendation:** stay on custom-app tokens near term, but (1) rewrite the onboarding docs for the Dev Dashboard flow, and (2) add a token health check so a broken sync degrades visibly. Treat a public App Store listing as a discrete later project — it's the only way to get one-click install, and the App Store is a plausible acquisition channel with **no confirmed direct competitor** occupying "bike-shop POS ↔ Shopify sync" **[NF]**.

**Separately:** our storefront is *hard-coupled* to Shopify — cart, checkout, sync, webhooks. Every shop wanting a storefront must buy a Shopify plan from a company selling a competing POS. Stripe Checkout would remove that and unify in-store and online under the shop's chosen processor.

---

## 8. Migration off incumbents

### What's actually exportable **[V]**

| Incumbent | Route | Gaps |
|---|---|---|
| **Citrus-Lime** | Real REST API (Swagger-documented, full CRUD) + a bulk Data Export/intelligence feed. **API key gated behind a support call** | No documented export for sales history, workshop jobs, loyalty, gift cards, images **[NF]** |
| **Lightspeed** | Documented public API; Personal Tokens for own-account access; leaky-bucket rate limits scaling with till count | S-Series export **explicitly excludes** gift cards and customer list; X-Series sales export **capped at 1,000 rows** — 15 years of history means heavy pagination |
| **Ascend** | Query builder → CSV/XLSX | Direct SQL access undocumented **[U]** |
| Bikedesk, Rain, RetailEdge, Celerant | **Not found [NF]** | Needs trial accounts or support tickets |

### The legal lever — v1 would have been wrong

This matters, because the obvious pitch is legally incorrect:

- **GDPR Article 20 (portability) does NOT apply.** Confirmed against ICO guidance: it is an *individual data subject's* right. A shop is the controller of its customers' data, not a data subject. **"Invoke Article 20 to get your data out of Citrus-Lime" is legally wrong — do not use it.**
- **Article 28(3)(g) is the correct lever.** The POS vendor is the *processor*; the shop is the *controller*. At end of contract the processor must delete **or return** all personal data. This must be a contract term.
- **But:** it covers **personal data only**. Product catalogue, stock and sales figures have no statutory protection — purely contractual. And the regulation mandates no format, so a vendor could hand over a thin CSV and argue compliance.

Usable pitch: *"GDPR entitles you to your customer data back."* Not usable: *"GDPR entitles you to your whole database."*

**Highest-value follow-up: obtain and read each vendor's actual DPA/ToS end-of-contract clause.** That is the load-bearing artifact and nobody has read one yet.

### Scraping — recommend against

Technically feasible for a shop using its own login. But:
- **A shop doing it itself**: lowest risk; their contract, their account, their call. Realistic risk is account termination mid-extraction.
- **Us doing it as a productised service**: materially worse. Third-party access under credentials not issued to us, at commercial scale, against near-universal SaaS ToS prohibitions. Invites cease-and-desist and infrastructure blacklisting.

Keep as documented last-resort guidance for shops, with a risk disclosure. **Do not build a product on it** without solicitor review of Computer Misuse Act exposure and specific vendor ToS.

### What incumbents offer inbound

Lightspeed sells **paid** "tailored onboarding" including migration, plus a self-serve import tool (10,000 items). **Citrus-Lime's public site shows no migration offer at all [NF]**.

**That gap is the opening.** Nobody credibly solves outbound migration, and the market's #2 complaint is fear of exactly that.

---

## 9. Questions to put to Madison

1. Who owns third-party EPOS integrations commercially — a different team from retailer account management?
2. What mechanism do integrated vendors get today for catalogue, live stock, dealer pricing, order placement, invoices? *Ask for what Citrus-Lime and Saledock were given.*
3. Is there a written spec or sandbox to review before commercial terms?
4. Is a trade account a prerequisite — ours, or each retailer's?
5. Fees, minimum volumes, NDA? Timeline to a live feed?
6. **Does TrueCommerce/Netalogue offer anything reusable across the distributors it hosts, e.g. Silverfish?**
7. Who is our named account manager, and can we have direct contact?

---

## 10. Recommended sequence

### Phase 0 — Make it defensible
1. Fix the cross-tenant login vulnerability *(live security hole)*
2. Add CSV export *(small; unblocks the anti-lock-in pitch and inbound migration)*
3. Rewrite the README, and the Shopify onboarding docs for the Dev Dashboard change
4. Add CI running the test suite

### Phase 1 — Make it sellable
5. Refunds, voids, returns *(hard blocker)*
6. Cash-up / Z-report
7. A real permissions model
8. VAT as stored data + date-range reporting

### Phase 2 — Sell the wedge
9. Package workshop + booking portal + SMS standalone. Benchmark against Bikebook's **£49.99/mo**
10. Publish pricing. Lead with payment freedom and free export
11. Land 3–5 paying shops; validate price and churn

### Phase 3 — Moat *(commercial track starts in Phase 0)*
12. Open the Madison trade account now — the credit review alone takes time
13. **Call TrueCommerce/Netalogue** — the unexplored second door
14. Widen the adapter contract and fix the write path
15. Build the Article 28(3)(g) data-return request as a real feature, correctly framed

### Deliberately deferred
Offline mode, multi-site inventory, product variants, accounting integration, loyalty, rentals. Revisit variants first — bike sizing will force it.

**Open source worth using:** JsBarcode (MIT, zero deps) and ReceiptPrinterEncoder (maintained, no deps). If offline mode becomes a priority, ElectricSQL is the best philosophical fit (Postgres-native sync) — but it would be a real dependency. Everything else surveyed — Odoo, ERPNext, Medusa, Saleor, Akeneo, Pimcore — is a framework demanding you adopt its whole world. Read for design ideas, don't adopt.

---

## 11. The five things that matter most

1. **Reprice the opportunity.** The incumbent charges ~£4,900/yr, not £760. There is real room underneath, and the market is worth more than v1 said.
2. **The window is narrowing.** Citrus-Lime took outside capital in November 2025 and is investing.
3. **Attack the weak incumbents first.** Seanic (3 staff) and i-BikeShop (1 person) are displaceable. Citrus-Lime is not, yet.
4. **Call TrueCommerce, not just Madison.** One platform sits under multiple distributors and nobody has asked.
5. **Own migration.** Nobody solves getting data *out*, it's the #2 complaint, and we currently have the same flaw.

---

## Appendix — key sources

**Financials:** Companies House filed accounts read directly — Citrus-Lime Ltd (03792454), H Young (Operations) Ltd (00706712), H Young Holdings PLC (00194944), Saledock Ltd (12597079), Seanic Retail Software Ltd (04058001), SiWIS Ltd (05378609), Zyro Ltd (03060232).

**Pricing:** citruslime.com/pricing/uk/ (31 Aug 2026); Saledock comparison blog (Apr 2026); Wayback CDX history; the fabricated £63.50 traced to an archived, now-404 Bikebook.co.uk article.

**Market pain:** Bicycle Retailer "State of Retail" 2022/2023/2025; Bicycle Retailer on Lightspeed's programme (May 2023); Capterra; Trustpilot; BBB.

**Madison:** citruslime.com SIM/AutoSIM pages; howto.citruslime.com; TrueCommerce Madison case study; Saledock help centre; Madison account application form.

**Shopify:** shopify.dev distribution, versioning, rate limits, revenue share; Shopify Help Center custom apps.

**Migration:** ICO right-to-data-portability guidance; GDPR Art. 28; Lightspeed Export Center and X-Series docs; Citrus-Lime Cloud POS API docs.

**Internal:** full code review of this repository, 31 Aug 2026, including a verified working cross-tenant exploit and a live 66/66 test run.
