# Wheelhouse EPOS — Business Research

**Compiled:** 31 August 2026
**Status:** Research reference. Paused mid-thread — see §12 for open questions and the next actions.
**Companion files on Desktop:** `Wheelhouse-EPOS-Strategy.md` (strategic recommendations, v2), `Wheelhouse-EPOS-Strategy.pptx` (14 slides), `Wheelhouse-EPOS-Code-Review.pptx` (10 slides).

**Confidence tags used throughout:**
**[V]** verified against a primary source · **[R]** third-party reported, not vendor-confirmed · **[U]** unverified / could not confirm · **[NF]** searched for, not found — *which is not proof of absence*

---

## 0. How to use this document

This is the evidence base, not the plan. The strategy doc holds the recommendations; this holds what we actually found and how well sourced it is.

Two habits worth keeping when picking this up:

1. **Check the confidence tag before quoting anything.** Several early findings were wrong and were corrected mid-research (§11 logs them). The tags are the guard against repeating that.
2. **Research quality was uneven.** Web-search budgets were exhausted in several passes, Reddit was unreachable throughout, and a number of vendor pages returned 403/404. Gaps are marked as gaps rather than filled in.

---

## 1. The market

### 1.1 Shop counts, English-speaking territories

| Territory | Count | Definition | Confidence |
|---|---|---|---|
| **UK** | 1,675 "true independents" | IndieRetail.UK via Cycling Industry News, 2022 | **[R]** |
| **UK** | 2,203 (2024), 2,252 (2025) | IBISWorld, all bicycle-retailing businesses incl. chains | **[R]** |
| **USA** | ~3,400 specialty / 10,004 broad | Definitions differ by 3× — always state which | **[R]** |
| **Canada** | ~1,381–2,000+ | Directory scrape, not a census | **[R]** |
| **Australia** | 1,228 | IBISWorld ANZSIC, 2026 | **[R]** |
| **Ireland** | **Not found** | Do not interpolate | **[NF]** |
| **New Zealand** | **Not found** | The 969 "sport & camping" figure is *not* a bike-shop proxy | **[NF]** |

### 1.2 Addressable market — derived, not researched

Using **real** Citrus-Lime pricing (§2.2), not the fabricated figure that skewed the first pass:

- Floor (Essentials, no ecommerce): £105 × 12 = £1,260/yr ex VAT
- Realistic (Growth tier): £339 × 12 = **£4,068/yr ex VAT**

1,675 UK independents × £1,260–£4,068 = **£2.1M – £6.8M/yr**. On the broader 2,252 count: **£2.8M – £9.2M/yr**.

**This is a model.** It assumes every shop buys dedicated software at list price, which is false — many run Square, Shopify POS, spreadsheets or nothing. Real penetration is unknown.

**Conclusion: the UK alone is a single-digit-millions market.** It supports a profitable small company, not a venture outcome. Anything larger needs multi-territory or multi-vertical expansion.

### 1.3 Industry conditions

Post-COVID inventory glut, heavy discounting, accelerating closures. 115 US bike brands exited in 2024, over 4× the 2023 rate **[R]**. BikeBiz frames UK independent retail as a deepening crisis **[R]**. Bicycle Retailer has published a dissenting view questioning whether failure rates are genuinely abnormal **[R]**.

Shops are more cost-sensitive than at any point since 2021 — a bad time to sell a premium platform, a good time to sell an honest cheap one. But switching costs matter more too: a struggling shop won't risk a migration.

### 1.4 Adjacent verticals

**Best second market: motorcycle / powersports** — 15,781 US dealers, 2,121 UK **[R]**. Same structural shape: serialised inventory, service department as profit centre, parts counter, seasonality. Caveat: DX1 and Karmak already serve it. Not white space.

Ski, golf, running, outdoor and marine were sized or ruled out. Running and outdoor lack the workshop component that makes bikes interesting. **Flagged as unreliable:** a "10,141 US surf shops" figure — implausible, do not use **[U]**.

Note **Citrus-Lime already sells into watersports** — Pyranha Kayaks is a named customer **[V]** — so vertical adjacency is a proven route in this market.

---

## 2. Competitors

### 2.1 Financials — from Companies House filings, read directly **[V]**

| Company | Position |
|---|---|
| **Citrus-Lime Ltd** (03792454) | 69 staff, £1.08m net assets (2025), turnover never disclosed. Headcount +47% over four years while net assets fell 22% from the 2023 peak and cash fell £533k→£307k. Investing ahead of revenue |
| **H Young (Operations)** — Madison (00706712) | **£120.3m turnover** FY2024, £6.1m operating profit, £52.0m net assets, 290 staff, £10m/yr dividends to parent. Group £176.2m. Owned by Dr Ronald Sämann. Bicycle segment down 3.5% but solid |
| **Saledock Ltd** (12597079) | **Acquired by Celerant (US) Mar 2025**, rebranded "Celerant ONE" Aug 2026. UK entity had **negative net worth (−£14,561)**, 7 staff at May 2025 |
| **Seanic Retail** (04058001) | 3 employees, £18,146 net assets, falling |
| **i-BikeShop** | Not a company — a brand of **SiWIS Ltd (05378609), one employee** |
| **Bikedesk** (DK) | CVR 35802843. Financials not obtainable — register blocked **[NF]**. ~25–30 staff from their own team page **[U]** |
| **ZyroFisher** (Zyro Ltd, 03060232) | £48.3m turnover; losses **−£9.3m (FY24), −£1.5m (FY25)**; **going-concern note**; dependent on LGT Private Debt |

**The displaceable incumbents are not Citrus-Lime.** They are Seanic (3 staff) and i-BikeShop (1 person) — real vendors with real customers and no capacity to compete on product.

### 2.2 Citrus-Lime pricing — verified **[V]**

From citruslime.com/pricing/uk/, fetched 31 Aug 2026, **ex VAT, single site**:

| Tier | Price | Includes | Card rates |
|---|---|---|---|
| Essentials | £105/mo | POS, reports, supplier data, workshop — **no ecommerce** | 1.8% + 9p |
| Growth *(their "most popular")* | £339/mo | Adds full ecommerce, Reports PRO | 1.6% + 8p |
| Advanced | £515/mo | Ecommerce PRO, Xero/QuickBooks, CMS | POA |
| Enterprise | POA | — | Custom |

**Real cost to a typical single-site shop wanting a webstore: £339 + VAT = £406.80/mo ≈ £4,882/year** — before per-supplier SIM licence fees (**price published nowhere [NF]**), card processing, multi-site surcharges and hardware.

Three observations:
- **Rising.** Saledock quoted Growth at £329 in April 2026; £339 now — ~3% in four months.
- **Newly public.** Wayback shows no pricing snapshots before late 2025. Quote-only until recently.
- **Soft bundling.** Card rates improve as you pay more (1.8%→1.6%) — a gentler version of what Lightspeed was attacked for.

### 2.3 The Citrus-Lime recapitalisation **[V]**

- **Investor: BGF** (Business Growth Fund). Confirmed three ways — BGF's own portfolio page (Technology, North West, Growth, 2025), BikeBiz and Cycling Industry News both 3 Dec 2025.
- **Amount publicly disclosed: none.** Both articles say only "multimillion-pound."
- **The one hard figure in the filings: £2,250,000** — Citrus-Lime Topco's SH01 records 2,250,000 "A Preference Shares" at £1 nominal, £1 paid, no premium, allotment dated 20 Nov 2025.
- **But that isn't the whole deal.** The statement of capital shows ten share classes totalling £3,404,009 nominal, including **£1,154,000 of B Preference Shares with no "amount paid" entry anywhere.** A replacement SH01 was filed Aug 2026 "as the original contained an error"; the two versions differ by 10,000 shares and don't reconcile.
- **Structure:** BGF Nominees holds **25–50% of Topco**; Topco holds **75%+ of the trading company**. This is a **minority growth investment, not a takeover.** All three founders remain directors of the operating company.
- New Topco directors: **Joshuah Bean** (BGF, named in press) and **David Quantrell**, whose 13 other directorships are almost all growth-stage UK software — the profile of an investor-installed chair, though no filing says so **[U]**.
- An NPIF/FW Capital venture-debt charge was **repaid** 26 Nov 2025. BGF's security is an "all monies" debenture with no stated cap.
- Money is earmarked for **technology development and expansion into the US, Europe and Australia**.

### 2.4 Competitor summary

| Vendor | Price | Deployment | Workshop | Note |
|---|---|---|---|---|
| Citrus-Lime | £105–£515/mo | Cloud + offline | Yes | UK incumbent, BGF-backed |
| Saledock / Celerant ONE | Not published | Cloud | Yes | ACT's endorsed partner, now US-owned |
| i-BikeShop | £71–£113/mo + £250 setup **[R]** | Cloud | **No** | One-person operation |
| Seanic Retail | Not published | Cloud | Yes + rentals | 3 staff |
| Bikedesk | €99 / €149/mo **[V]** | Cloud | Metered tickets | Closest philosophical peer |
| Lightspeed | from $89–$109/mo | Cloud | Service orders | Payment-bundling backlash |
| Ascend | Quote only | On-site + cloud | Yes | Trek-owned |
| RetailEdge | Not published | **Local-first** | Yes | Only offline-resilient vendor found |

**Vend no longer exists** — Lightspeed acquired it for $350M in 2021 **[V]**. Do not position against it.

On Trek/Ascend: Trek's ownership is verified **[V]**. A widely-shared allegation that Trek uses Ascend financial data against indebted dealers is **single-sourced to a social-media thread with no corroborating journalism [U]** — do not repeat it.

### 2.5 Citrus-Lime's customers

Their "400 UK bike shops" claim is unverified. **~16–18 can be named** from public sources: Balfe's Bikes, Leisure Lakes, Certini, Giant Store Rutland, Pedal Heaven, Ride Bikes, Friction Cycles, Chevin Cycles, E-Bike Alley (US), Spoke N Sport, Giant Canning Vale (AU), Tom's Pro Bike (US), Middle of Town Cycling (US), Team Cycles, plus Northwest Mountain Bike Centre, J's Cycle Shack and Pyranha Kayaks from an indexed blog subdomain.

Several are **not UK**, so the "400 UK" figure can't be padded with them. Enumeration fingerprint exists — the footer string "Integrated Ecommerce © Citrus-Lime Limited" — but full enumeration needs paid tooling (BuiltWith or PublicWWW).

---

## 3. Validated customer pain

Ranked by strength of independent evidence.

### 3.1 Pricing, surprise rises, payment coercion — STRONGEST **[V]**

- Lightspeed told retailers to adopt its processor or pay more. One shop quoted **$138 → $602/month**; a co-owner called it "blackmail" *(Bicycle Retailer, May 2023)*. A **$400/month penalty** for non-adoption was reported in late 2025.
- Capterra, verified reviewer: *"They put us under a 12-month contract at one rate, 4 months later they doubled the rate with zero explanation."*
- BBB complaints (Mar and May 2026) allege undisclosed rate hikes totalling $5,823.84 and forced rebidding under a $1,870/month penalty threat.
- Citrus-Lime Trustpilot (Nov 2025): *"continuously raise the cost each month, whilst still not providing what was promised."*

### 3.2 Lock-in and migration fear — STRONG **[V]**

A shop owner stays on a system she dislikes rather than risk *"losing information we have gathered over our 15-year history."* Note the nuance: the complaint is **fear of** a bad migration, not a documented failed export **[U]**.

### 3.3 Workshop gaps — MODERATE, re-sourced

**The original framing did not hold** (see §11). Re-sourced to three verifiable companies built specifically to bolt booking/work-orders/SMS onto Lightspeed and Ascend:

| Company | Evidence | Pricing |
|---|---|---|
| **Velodrop** | Wayback to **Jan 2018** — genuinely long-running. "Founded by experienced bicycle mechanics" | **$59 / $95 / $129 per month** (tiers differ only by bundled SMS credits) |
| **Masterlinq** | Active since Oct 2023. Markets explicitly against "manual phone bookings and inventory confusion that traditional systems create" | **From $750/month** +$100/location — a full storefront platform, not a workshop add-on |
| **Bikebook Workshop** | Active since Apr 2024. UK, owned by **MyGroup Services Ltd (12895911)**. In NBDA's "Friends of" list | **£49.99/month ex VAT** |

**Velobench** — the product tied to the unreadable forum thread — exists but rests entirely on its own marketing site: no Wayback history at all, no press, no LinkedIn, and the shop that supposedly built it never mentions it **[U]**.

**Defensible claim:** *"At least three independently-run companies have built businesses bolting workshop tooling onto incumbent POS systems — the oldest operating since 2018."*

### 3.4 Also validated

Support quality **[V]** — Lightspeed *"Don't expect help getting set up… useless AI chat"*; Citrus-Lime 1-stars allege nine months of overbilling. Cloud outages disabling the till **[V]**, though severity claims are single-sourced **[U]**.

### 3.5 Evidence gap

**Reddit was unreachable in every research pass** — r/bikeshops, r/BikeMechanics, r/NICUBikeShop. Fetches blocked, no indexed threads surfaced. This is a real hole, not proof those communities are quiet. Worth a manual pass before committing spend.

---

## 4. Distributor integration

### 4.1 Madison — the barrier is commercial, not technical **[V]**

Data does flow. Citrus-Lime builds a bespoke feed per supplier, branded **SIM/AutoSIM** — their own blog calls each new one "this new **direct feed**". Retailers need a **per-supplier SIM licence** before that supplier appears. Madison's B2B site runs on TrueCommerce Netalogue; trade press confirms a "real-time link to the Madison commercial system with full online stock availability."

- **No evidence retailers enter their own Madison credentials** — setup docs cover only in-POS mechanics. Points to a vendor-level agreement, not per-shop scraping. Not conclusive **[U]**.
- **Every UK distributor works this way** — ZyroFisher and Extra UK show the identical pattern.
- The transport (API vs EDI vs FTP) is **documented nowhere [NF]**.
- Saledock's help docs: Madison catalogue import is available **"upon approval from your Madison account manager only" [V]**.

### 4.2 TrueCommerce / Netalogue — tested and downgraded **[V]**

This was initially flagged as "the highest-value unexplored lead." **The evidence does not support that.**

- **Confirmed:** Madison's portal footer literally reads *"Online catalogue powered by TrueCommerce(Netalogue) ebusiness and ecommerce engine."* It's legacy ASP.NET WebForms. Silverfish ran on it too.
- **But there is no catalogue feed.** The one documented TrueCommerce API is **EDI-transaction-scoped** — orders, acknowledgements, ASN, invoices, with OAuth. Not stock, not product data, not prices.
- **"Netalogue Hub API" could not be found anywhere**, current or archived. Treat as non-existent until someone says otherwise **[NF]**.
- **They don't own the data.** Netalogue is a display layer over each distributor's own ERP (Sage X3 at Silverfish, SAP Business One elsewhere). TrueCommerce cannot grant access to Madison's data.
- **Their other clients are pubs** — Greene King, Marstons, Bunzl, Matthew Clark. No cycling cluster.
- Partner programme is **TrueCommerce xChange**, aimed at ERP resellers and supply-chain ISVs, not bolt-on vendors.

**Verdict: same playbook, still N efforts — not "one integration, N distributors."** Worth one 30-minute call, not a strategy.

Contact: TrueCommerce UK, 2 New Bailey, Salford M3 5GS, **+44 (0) 345 643 6600**.

**Unresolved:** how many other UK bike distributors run on the platform — only two confirmed, the wider sweep wasn't completed **[NF]**.

### 4.3 Madison registration path

Trade account: `newaccounts@madison.co.uk` / 01908 326032. Requires company and VAT registration, trade references, turnover band, director and bank details. Credit review; first order pro-forma **min £500 at cost**. The form notes Madison *"is not actively seeking to develop new accounts."*

**No software-vendor programme is documented [NF].** Route the integration ask to whoever owns the B2B platform commercially, not the new-accounts desk.

**Questions to put to Madison:**
1. Who owns third-party EPOS integrations commercially — a different team from retailer account management?
2. What mechanism do integrated vendors get today for catalogue, live stock, dealer pricing, order placement, invoices? *Ask for what Citrus-Lime and Saledock were given.*
3. Is there a written spec or sandbox to review before commercial terms?
4. Is a trade account a prerequisite — ours, or each retailer's?
5. Fees, minimum volumes, NDA? Timeline to a live feed?
6. Does TrueCommerce/Netalogue offer anything reusable across the distributors it hosts?
7. Who is our named account manager?

### 4.4 The distributor layer is unstable **[V]**

| Company | Status |
|---|---|
| **Saddleback Ltd** | **In administration, 29 May 2026.** 42 redundancies |
| **Accell / Raleigh** | **Notice of intention to appoint administrators, 5 Aug 2026.** KKR losses estimated >€1bn |
| **ZyroFisher** | Going-concern note, on LGT Private Debt support |
| **Madison** | Healthy — the exception |

Two brand-name failures in three months. Any strategy assuming stable distributor relationships is building on contested ground.

### 4.5 How a real feed plugs into our architecture

The seam is sound: `fetchItems(config) → [{supplierSku, barcode, name, price, stockQty}]` in `server/suppliers/index.js`. Adding an adapter is one file plus one registry line. Today only `mock_csv` exists, reading a bundled sample; every new shop is auto-seeded with a supplier literally named "Madison (mock)".

**Seven gaps before a real feed lands:**

1. **Contract too thin** — five fields, and **no RRP column exists**, so auto-pricing on import is impossible
2. **N+1 upsert** — one round-trip per item against tens of thousands of SKUs
3. **Whole catalogue in memory** — returns one array
4. **Credentials in plaintext** — `suppliers.config` is unencrypted JSONB, while AES-GCM already exists in `shopify.js`
5. **No scheduling** — manual `POST /api/suppliers/:id/sync` only
6. **No delisting** — `last_seen_at` written but never acted on
7. **No electronic ordering** — POs have no submission path. **This is where the value is**

---

## 5. Payments

Position: **merchant choice via a curated adapter**, not "we never touch payments."

Only providers with **cloud / server-driven terminal APIs** — no native app, no local SDK:

| Provider | Fit | Detail |
|---|---|---|
| **SumUp Cloud API** | **Best** | Explicitly for POS on "any platform… web-based"; HTTPS only |
| **Stripe Terminal** (server-driven) | Strong | Stripe now steers away from the JS SDK. UK 1.4% + 10p; readers £49–£229 |
| **Square Terminal API** | Strong | Built for third-party POS. Rev-share real but **capped at 24 months** |
| Adyen / Worldpay / Dojo / Zettle | Not yet | Enterprise-oriented or undocumented ISV terms **[U]** |

This suits our architecture — we already ship an Electron agent on Windows, exactly where a cloud terminal call belongs.

**Two constraints:**
- **Don't model revenue on it.** Stripe shares none of its margin — we'd add a visible platform fee. Square's referral bonus needs $250k/yr volume, out of reach for most UK independents. Differentiation, not a revenue line.
- **PCI decides the architecture.** Card data through certified terminals only, never our UI → SAQ A online, SAQ B-IP in store. **Needs a QSA review before launch.**

**Tap to Pay requires a native app on every provider** — out of scope for a browser-first stack.

---

## 6. Storefront and website

### 6.1 What we have today

**238 lines total.** One hardcoded layout, client-rendered via `innerHTML`, themed by three CSS custom properties from five presets. Served as a **pure static file with zero server-side rendering**:

- Every shop's page has the same `<title>Shop</title>`
- No meta description, no Open Graph, no structured data, no sitemap, no robots.txt
- **No product detail pages at all** — no per-product URLs, just a grid

The problem isn't that it looks plain. It's that it's **commercially invisible**.

### 6.2 The data problem is bigger than the hosting problem

Public API exposes six fields: `id · name · price · description · photoUrl · shopifyVariantId`.

| Missing | Status | Why it matters |
|---|---|---|
| **Category** | In the DB, **not exposed** | No navigation, filtering or collection pages. Cheap fix |
| **Stock level** | In the DB, **not exposed** | "In stock at our shop" is the biggest conversion driver for click-and-collect |
| **Brand** | **Doesn't exist** | Bike shops sell by brand. No brand pages, no brand filtering |
| **Variants** | **Don't exist** | Bikes come in sizes. Shopify sync creates single-variant products only |
| **Product slug/URL** | **Doesn't exist** | Nothing to link, share or rank |
| **Image gallery** | Single `photo_url` | Nobody buys a £3,000 bike from one photo |
| **Specs** | **Nothing structured** | No wheel size, groupset, frame material |

**The catalogue is a till's data model, not a shop window's.** No vendor choice fixes this.

### 6.3 Is "great-looking website" a validated pain? — NOT VALIDATED

Five live Citrus-Lime storefronts were inspected. They **are** visibly templated — same footer, same nav, same section blocks, differentiated by logo and photography — and one (Chevin Cycles) is genuinely dated. Balfe's and Leisure Lakes are competently modern.

**But the complaints shops actually voice are about cost and unmet promises, not appearance [V].** Citrus-Lime's own marketing sells click-and-collect and local footfall, not visual differentiation. A shop can buy a modern Shopify theme for $150–500 one-off.

Counter-signal: **Workstand tiers theme access up to $659/month**, so *some* willingness to pay for design exists. And Citrus-Lime's own case studies cite "professional online presence" and "a faster website" as customer wins.

Verdict: **plausible nice-to-have, not the differentiator.** The "80% of online bike sales collected in-store" statistic often quoted could not be located on Citrus-Lime's site — **do not repeat it as sourced [U]**.

### 6.4 Bring your own Shopify

We already do this via manual custom-app tokens. **The judgement got worse, not better:**

- **Since 1 Jan 2026 merchants can no longer create custom apps from the store admin** — they must use Shopify's separate Dev Dashboard or CLI **[V]**. **Our onboarding docs are stale today.**
- **The one-click-install-without-review path does not exist.** Shopify's custom distribution is restricted to stores inside the same Shopify Plus organisation **[V]**. The choice is binary: manual tokens, or full App Store review.
- App Store terms: **0% revenue share to $1M lifetime**, 15% above; 2.9% only if billing through Shopify (avoidable) **[V]**. Registration fee reported as $19 **[U]**.
- Quarterly API versions, 12-month support windows; listed apps face delisting if they don't migrate **[V]**.
- **Not a differentiator** — Bikedesk and Rain POS both support BYO Shopify (Rain with a dedicated two-way sync product), and Masterlinq ships an App Store listing bridging Lightspeed and Ascend **[V]**.

**Also:** our storefront is *hard-coupled* to Shopify — cart, checkout, sync, webhooks. Every shop wanting a storefront must buy a Shopify plan from a company selling a competing POS.

### 6.5 Would we have to rebuild Shopify?

Largely yes, and that's the argument against. To replace rather than sit alongside Shopify: cart persistence, guest checkout, address validation, abandoned-cart recovery, UK VAT (hardcoded 20% in four places today), EU VAT/OSS, US sales-tax nexus, shipping rates and zones, carrier integration, cards + Apple/Google Pay + Klarna + PayPal, PCI scope, chargebacks, fraud screening, fulfilment states, partial shipment, returns, refunds, email notifications, and **product variants which we don't have at all**.

### 6.6 The website provisioning decision — BUY, don't build

**Duda's platform API is confirmed and does what we need [V]:**

| Capability | Endpoint |
|---|---|
| Create site from template | `POST /sites/multiscreen/create` |
| Inject content and structured data | Content Injection + Content Library + Collections APIs |
| Publish live | `POST /sites/multiscreen/publish/{site_name}` |
| White-label | Confirmed — our branding |

**Pricing: $149/mo annual** ($199 monthly) — 4 published sites, 6 seats, advanced API access. Extra sites ~$17–19/mo. Roughly **$20–26 per shop per month** at small scale; a "Custom" volume tier above.

Note the earlier "App Store API is not open to the public" line was a red herring — that's a *different* API for marketplace apps.

**Precedent:** Duda's own success stories name vertical SaaS platforms embedding it — **AppFolio, DoorLoop, Smoobu, Bokun, CCC, Shazamme, Moovs, Broadly**. None bike-specific, but the pattern is proven.

**Alternative — Vercel for Platforms [V]:** unlimited custom domains, automatic SSL issued and renewed per tenant domain, programmatic domain management via REST/SDK, multi-tenant pattern explicitly used by site builders (Typedream, Super, Universe named). But **no buy-domain REST endpoint** — only `POST /v7/domains` to attach an existing one. Buying is dashboard-only or via Vercel MCP.

**Ecwid / Lightspeed eCom** has a white-label partner API with revenue share — but the footer reads *"© 2026 Ecwid by Lightspeed."* Selling independence from big POS vendors while running a Lightspeed product under our brand is a strategic contradiction worth naming.

### 6.7 Scoping

| Path | Weeks | Notes |
|---|---|---|
| Data work (category, brand, slugs, stock, galleries, specs) | 4 | Required for every option |
| Product variants | 3–4 | Touches till, inventory, POs, Shopify sync. Defer until asked |
| **A — Server-render what we have** | **3** | Real product pages, meta, OG, structured data, sitemap |
| **B — Duda** | **5–8** | Integration, sync, style picker, domain flow |
| **C — Vercel + own templates** | **9–10 MVP, 20+ good** | We'd be building a website builder |

**Combined:** A ≈ 10–11 weeks. B ≈ 9–12. C ≈ 17–18 minimum.

**Recommendation:** do A plus the cheap data items first (~6 weeks, no vendor decision needed, all of it a prerequisite for B and C anyway). Then decide B vs C on whether Duda's remaining unknowns clear.

---

## 7. DNS and custom domains

### 7.1 Two separate jobs

**Our own domain** — one wildcard record `*.wheelhouseepos.com` plus one wildcard TLS certificate. Reserved subdomains (`www`, `app`, `api`, `admin`, `staff`) already handled at `server/storefront.js:58`. Solved.

**Each shop's own domain** — currently an explicit non-goal in the spec, deferred with a planned `custom_domain` column.

### 7.2 Three models

| | What happens | Verdict |
|---|---|---|
| **A. Shop keeps their DNS, adds records** | They add a CNAME plus a TXT to prove ownership | **Recommended** |
| **B. We take over their nameservers** | They repoint NS to us | **Avoid** |
| **C. Delegate one subdomain** | CNAME `shop.theirdomain.co.uk` | Safe, but nobody wants a subdomain |

**Why B is dangerous:** we'd inherit their MX records, SPF, DKIM, DMARC and Microsoft/Google verification records. Miss one and the shop stops receiving customer email — silently, and they'd blame us correctly.

### 7.3 The apex problem

A shop wants `bobsbikes.co.uk`, not `www.bobsbikes.co.uk`. **You cannot put a CNAME at a domain apex** — protocol-level restriction. Three workarounds:

1. **ALIAS/ANAME/CNAME-flattening** — Cloudflare, Route 53, DNSimple support it. **Many cheap UK registrars don't**, which is where bike shops are
2. **A record to a stable anycast IP** — works everywhere, costs flexibility
3. **Make `www` canonical** and use the registrar's apex-redirect. Ugly, universally supported, fine

Plan for all three.

### 7.4 Domain registration — don't become a registrar

**Nominet tag holder route [V]:** apply for a tag, sign the Registrar Agreement, open a credit account subject to bank/trade references (or pay a deposit), integrate over EPP. That's a compliance programme, not a feature.

**Reseller route — the right answer.** **Gandi confirmed [V]**: `POST /v5/domain/domains` registers a domain via API, they sell `.co.uk`, and they're Nominet-accredited so they're registrar of record, not us. **OpenSRS/Tucows** is a credible wholesale alternative — no monthly fees, no minimum purchase, full white-label — though `.co.uk` support unconfirmed **[U]**.

**Duda may handle domains itself** — a `DOMAIN_PURCHASED` webhook exists. If it covers `.co.uk`, we may not need a registrar integration for v1 **[U]**.

**Cloudflare Registrar has a beta API [V]** — `POST /accounts/{account_id}/registrar/registrations` genuinely registers domains. But `.co.uk` registration (vs transfer) is unresolved and leans negative — their `.uk` docs cover only transfers **[U]**.

**Cloudflare for SaaS: under 100 custom hostnames free, then $0.10 each [V].** Essentially free at our scale, and Custom Hostnames is a REST resource.

### 7.5 Support burden

Every shop is on a different registrar with a different control panel. Budget for per-registrar help pages with screenshots (123-reg, Fasthosts, GoDaddy, IONOS, Names.co), a "check my DNS" diagnostic, and monitoring for certificate renewal failures.

**Decide early:** if a shop leaves, their domain still points at our servers. You need a clean offboarding path.

---

## 8. Migration off incumbents

### 8.1 What's exportable **[V]**

| Incumbent | Route | Gaps |
|---|---|---|
| **Citrus-Lime** | Real REST API (Swagger-documented, full CRUD) + bulk Data Export feed. **API key gated behind a support call** | No documented export for sales history, workshop jobs, loyalty, gift cards, images **[NF]** |
| **Lightspeed** | Public API; Personal Tokens; leaky-bucket rate limits scaling with till count | S-Series export **explicitly excludes** gift cards and customer list; X-Series sales export **capped at 1,000 rows** |
| **Ascend** | Query builder → CSV/XLSX | Direct SQL access undocumented **[U]** |
| Bikedesk, Rain, RetailEdge, Celerant | **Not found [NF]** | Needs trial accounts or support tickets |

### 8.2 The legal lever — get this right

- **GDPR Article 20 does NOT apply.** Confirmed against ICO guidance: it's an *individual data subject's* right. A shop is the controller of its customers' data, not a data subject. **"Invoke Article 20" is legally wrong — do not use it.**
- **Article 28(3)(g) IS the lever.** The vendor is the processor; at contract end it must delete **or return** all personal data. Must be a contract term.
- **But personal data only.** Product catalogue, stock and sales figures have no statutory protection — purely contractual. And no format is mandated, so a vendor could hand over a thin CSV and claim compliance.

Usable: *"GDPR entitles you to your customer data back."* Not usable: *"…your whole database."*

**Highest-value follow-up: obtain and read each vendor's actual DPA/ToS end-of-contract clause.** Nobody has read one yet.

### 8.3 The Chrome extension idea — risky, safer variant exists

Idea tested: a Chrome extension the shop installs and runs itself, logged into its own account, extracting its own data — possibly LLM-driven to adapt per vendor.

**What works:** injecting into the page's own JS context and monkey-patching `fetch`/`XMLHttpRequest` to capture the JSON the incumbent's app already receives. Far more robust than DOM scraping.

**Three things break it as specified:**

1. **Manifest V3 constrains the LLM part.** Chrome forbids remotely-hosted code, extending to "any external code or resource fetched by the extension package." A JSON blob of selectors interpreted locally is fine; anything `eval()`'d is prohibited. An LLM returning live instructions only clears review if its output is a **closed vocabulary**.
2. **The Web Store makes us hostage to competitors.** Review is largely complaint-driven. A Citrus-Lime or Lightspeed complaint to Google could pull us. Install-time warning (*"Read and change your data on…"*) is real friction for a nervous shop owner.
3. **The real legal risk is inducing breach of contract** (*OBG Ltd v Allan* [2007] UKHL 21), not the Computer Misuse Act. We'd be the party that built and marketed a tool to enable a ToS breach. And **Facebook v Power Ventures** is the warning: Power used users' own credentials with consent and still lost, because once Facebook sent a cease-and-desist, continued access became unauthorised.

**Claude in the extraction loop is a liability.** For 3–5 known vendors, hand-coded connectors are more reliable, cheaper, deterministic and testable. A migration that silently drops 10% of sales history is worse than useless, and LLM extraction fails *silently and plausibly*. Use Claude offline to author configs, and for post-extraction cleanup (deduping, normalising) — not the extraction loop.

**Safer variant: ship it in the Electron app we already have.** Same legal framing, no MV3 prohibition, no Web Store review, same interception via Chrome DevTools Protocol, proper pagination control (MV3 service workers die after ~30s idle). **Cart2Cart and LitExtension — the closest analogous market — use server-side API connectors, not extensions.**

Pair with: hand-coded connectors, a documented policy to **stop immediately on any cease-and-desist**, and routing shops toward a formal Article 28(3)(g) request first.

*Caveat: UK case law on automated access with valid credentials (DPP v Bignell, ex parte Allison) is from training knowledge, not re-verified. Needs a solicitor before building.*

### 8.4 The opening

Lightspeed sells migration as **paid** white-glove onboarding plus a self-serve import tool (10,000 items). **Citrus-Lime's public site offers none at all [NF].** Nobody credibly solves getting data *out*, and it's the market's #2 complaint.

---

## 9. Open source

**Direct answer: nothing does multi-tenant hosted website provisioning end-to-end.** We'd be assembling pieces.

### 9.1 Licence traps — verified by reading LICENSE files

| Project | Licence | Problem |
|---|---|---|
| **Shopify Dawn** | MIT text **+ field-of-use restriction** | *"may only be exercised to develop themes that integrate or interoperate with Shopify… all other uses strictly prohibited."* GitHub classifies it `NOASSERTION`. **Cannot render outside Shopify** |
| **Webstudio** | AGPL-3.0 | Network use counts as distribution |
| **Silex** | AGPL-3.0 | Same |
| **Directus** | **Monospace Sustainable Core Licence** | A BSL clone with an explicit **"Competing Use" prohibition**. Converts to GPL 4 years after each release |
| **Statamic** | Proprietary | One production install per licence |
| **Vendure** | GPL-3.0 or paid commercial | Copyleft unless bought out |
| **Webiny** | MIT with `enterprise/` carve-outs | Also AWS-serverless + DynamoDB |
| **vercel/platforms** | **No LICENSE file at all** | Legally all rights reserved. Read the pattern, don't vendor it |

### 9.2 Worth using

| Project | Licence | Verdict |
|---|---|---|
| **Caddy** | Apache-2.0 | **ADOPT** if we self-host. On-demand TLS issues a cert at first handshake after calling a webhook we control — the hardest part of custom domains, as a drop-in binary |
| **BigCommerce Cornerstone** | **Plain MIT, unrestricted** | The only commerce reference theme genuinely reusable. Default look is dated |
| **JsBarcode** | MIT, zero deps | Already relevant to label printing |
| **ReceiptPrinterEncoder** | Maintained, no deps | ESC/POS receipt encoding |
| **Coolify / Dokku** | Apache-2.0 / MIT | **EMBED** for API-driven per-tenant provisioning if we self-host |
| **GrapesJS** | BSD-style | Only **framework-free** visual editor. Puck and Craft.js are React-locked; Craft.js is 18 months stale |
| **LiquidJS** | MIT, no runtime deps | If we ever build templates. Logic-less — the security boundary |
| **ElectricSQL** | Apache-2.0 | Postgres-native sync, if offline becomes a priority |

### 9.3 Read, don't adopt

Odoo, ERPNext, Medusa, Saleor, Payload (MIT and clean, but Next.js-locked), Akeneo, Pimcore, WordPress Multisite. All frameworks demanding you adopt their whole world. WordPress Multisite is the strongest *architectural* precedent for "many sites, one install" — but it's PHP/MySQL alongside Node/Postgres: two languages, two databases, two patch cadences.

**Repair/workshop open source is genuinely thin.** The highest-starred entry (GarageBuddy, C#/.NET, 47 stars) is abandoned. Nothing worth borrowing code from.

---

## 10. Our own product position

### 10.1 Genuinely strong

Workshop diary (drag to place/move/resize, per-mechanic columns, job attachments, server-enforced hours and overlap, configurable "day is full" threshold). Customer booking portal (leaks nothing, guest booking by phone, pending-approval queue). Real Twilio SMS. Purchase orders — complete, including split deliveries. Multi-tenancy via Postgres RLS, **verified live**: 25 tables FORCEd, cross-shop reads return nothing, cross-shop writes rejected with `42501`. UK-native throughout. One runtime dependency.

### 10.2 Blocks selling to shop #2

| Gap | Why | Effort |
|---|---|---|
| **No refunds, voids or returns** | A till that can't reverse a sale isn't a till | Medium |
| **No cash-up / Z-report** | Every shop counts the drawer | Medium |
| **No data export at all** | Blocks migration in — and contradicts our own anti-lock-in pitch | **Small** |
| **VAT not stored data** | Hardcoded 20% in the UI. No VAT return, no Making Tax Digital | Medium |
| **No permissions model** | `is_owner` checked in 7 places, all team management. Everything else open to any logged-in staff | Medium |
| **Cross-tenant security bug** | One shop can disable/re-enable another shop's staff logins — **exploit verified** | **Small** |
| **No reporting** | Dashboard shows four things, all "today" | Medium |

### 10.3 Where we stand against the workshop competitors

**Ahead:** drag-and-drop week *and* month diary with per-mechanic columns (none of the three describe one); the moderated **pending-approval booking queue** (all three do direct self-service); auto-created linked order making jobs billable at the till; explicit capacity/overlap logic.

**Behind:** **automated status-triggered SMS/email** (Bikebook and Velodrop both have it; we have manual only — the clearest and cheapest gap to close); **job photos from a phone** (Bikebook sells this); **service reminders** (Velodrop has them — a revenue lever, not just parity).

**Nobody clearly has:** quotes/estimates on jobs, parts-attached-to-job. Possibly a category-wide gap worth building ahead of the market.

**Minimum to compete:** automated status messaging → phone photo capture → service reminders → parts-to-job → quotes.

---

## 11. Corrections log

Things that were wrong during this research and were fixed. Kept because the pattern matters.

| Claim | Correction |
|---|---|
| Citrus-Lime costs ~£63.50/mo | **Fabricated.** Traced to a dead blog post on Bikebook.co.uk — a competitor — repeated 8× as filler. Real: £105/£339/£515 ex VAT |
| UK SAM ≈ £1.3–6.6M/yr | ~6× too low; built on the fabricated price |
| Madison "publishes no API" | Incomplete — reads as "no interface exists." Barrier is **commercial** |
| TrueCommerce is "the highest-value unexplored lead" | Tested and **downgraded**. No catalogue feed; they don't own the data |
| "A shop owner built a rival bolt-on" — our strongest signal | Source was **never readable** (403 every attempt, zero Wayback snapshots). A "posted June 2026" date appears to have been invented by a search summariser. Re-sourced to three real companies |
| BGF took 75%+ of Citrus-Lime | **Wrong.** BGF holds 25–50% of Topco; Topco holds 75%+ of the trading company. A minority investment |
| Shopify's Dawn theme is MIT | **Not MIT.** Field-of-use restriction forbids use outside Shopify |
| Cloudflare Registrar has no API or reseller path | **Wrong.** It has a beta Registrar API that genuinely registers domains |
| Bikebook Workshop costs $89/mo | **£49.99/mo ex VAT.** Its "400+ UK businesses" claim isn't on the current site |
| Saledock is an independent UK vendor | Acquired by **Celerant (US)** Mar 2025, rebranded Celerant ONE Aug 2026 |

---

## 12. Open questions and next actions

### Immediate, cheap, no dependencies
1. Fix the cross-tenant login vulnerability *(live security hole, exploit verified)*
2. Add CSV export *(small; unblocks the anti-lock-in pitch and inbound migration)*
3. Rewrite the README, and the Shopify onboarding docs for the Dev Dashboard change
4. Add CI running the test suite *(66/66 pass locally; nothing has ever gated a merge)*

### Calls to make
5. **Duda** — three questions: is there an API to attach a *primary* custom domain (only alternate domains found)? Does their domain purchase cover `.co.uk`? Volume pricing above White Label tier?
6. **Madison** — the seven questions in §4.3. Open the trade account now; the credit review alone takes time
7. **TrueCommerce** — 30 minutes: is there a standard export a distributor can switch on?

### Research still outstanding
- **Reddit** — unreachable in every pass. r/bikeshops and r/BikeMechanics need a manual sweep
- **Vendor DPA/ToS end-of-contract clauses** — nobody has read one. The load-bearing artifact for the migration pitch
- **Per-supplier SIM licence price** — published nowhere; ask a shop that uses Citrus-Lime
- **NBDA 2025 Specialty Bicycle Retail Report** — paid; would settle retailer priorities
- **How many UK bike distributors run on Netalogue** — only two confirmed
- **ICANN gTLD accreditation** requirements — pages 403'd
- **Whether Jobber, Housecall Pro, Toast et al. buy or build** their website builders
- **Trial accounts with Velodrop and Bikebook** (both free, no card) to verify quotes/estimates and POS write-back depth
- **Citrus-Lime customer enumeration** — needs BuiltWith or PublicWWW (paid)

### Decisions waiting
- **Buy vs build the storefront** — resolves on Duda's three unknowns
- **Full EPOS vs workshop-first** go-to-market
- **Whether third parties can ever author themes** — roughly doubles the cost of any theme system
- **Offline mode** — a validated market complaint and RetailEdge's only real differentiator, but a big build

---

## 13. Sources

**Financials:** Companies House filed accounts read directly — Citrus-Lime Ltd (03792454), Citrus-Lime Topco (16839694), H Young Operations (00706712), H Young Holdings (00194944), Saledock (12597079), Seanic Retail (04058001), SiWIS (05378609), Zyro (03060232), BGF Nominees (10007355), MyGroup Services (12895911).

**Pricing:** citruslime.com/pricing/uk/; Saledock comparison blog (Apr 2026); Wayback CDX history; duda.co/pricing; velodrop.com/pricing; masterlinq.io/pricing; bikebook.co.uk/workshop.

**Market pain:** Bicycle Retailer "State of Retail" 2022/2023/2025; Bicycle Retailer on Lightspeed's programme (May 2023); Capterra; Trustpilot; BBB.

**Madison / TrueCommerce:** madisonb2b.co.uk (footer attribution, fetched directly); TrueCommerce Madison case study; archived Netalogue case studies, reseller and punchout pages; citruslime.com SIM/AutoSIM; howto.citruslime.com; Saledock help centre.

**Shopify:** shopify.dev distribution, versioning, rate limits, revenue share; Shopify Help Center custom apps; github.com/Shopify/dawn LICENSE.md.

**Payments:** Stripe Terminal docs; Square Terminal API FAQ; SumUp Cloud API docs; PCI SAQ guidance.

**Website provisioning:** developer.duda.co; duda.co/success-stories; vercel.com/docs/platforms and REST API domains reference; developers.cloudflare.com (Cloudflare for SaaS, Registrar API); api.gandi.net/docs/domains; Nominet registrar resources (via Wayback); caddyserver.com on-demand TLS docs.

**Migration and legal:** ICO right-to-data-portability guidance; GDPR Art. 28; Lightspeed Export Center and X-Series docs; Citrus-Lime Cloud POS API docs; Chrome Web Store program policies; Computer Misuse Act 1990 s.1; OBG Ltd v Allan; Facebook v Power Ventures.

**Open source:** GitHub REST API for live stars/licence/last-push, plus direct LICENSE file reads.

**Internal:** full code review of this repository, 31 Aug 2026 — including a verified working cross-tenant exploit and a live 66/66 test run against real Postgres.
