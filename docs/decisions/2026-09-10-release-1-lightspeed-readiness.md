# One Lightspeed adapter — access and integration readiness

Date: 10 September 2026. **Documentation checked; our account access and live integration remain unproven.**

## Recommendation

Plan for **R-Series**, subject to the first shop actually using it and passing the proof below. It has a documented work-order API and aligns with the earlier R-Series design. A trial account being easy to create is not proof of the right API access. The earlier competitive trial reported an X-Series account, not an R-Series account; neither working integration was demonstrated by that fact.

Only one adapter enters Release 1. X-Series remains the alternative if it fits the first shop and independently passes the same operational acceptance. Changing series means changing the integration specification, not implementing an R-Series payload against an X-Series URL.

## What is established by current primary sources

| Fact | Evidence and consequence |
|---|---|
| R-Series supports OAuth and REST read/create/update/archive operations | [Getting started](https://developers.lightspeedhq.com/retail/introduction/introduction/). API availability is documented; our entitlement is not |
| Register a client, then authorise the shop and exchange/refresh tokens | [Authentication overview](https://developers.lightspeedhq.com/retail/authentication/authentication-overview/). Use the registered callback, server-held secrets and a browser-bound login transaction |
| Client registration and shop access are separate | [API clients](https://developers.lightspeedhq.com/retail/authentication/clients/). Register/update a client using a server-controlled HTTPS redirect. An issued client ID does not demonstrate access to the intended shop |
| Both scopes and employee rights constrain access | [Access scopes](https://developers.lightspeedhq.com/retail/authentication/scopes/). Even `employee:all` cannot exceed the authorising employee’s rights. Validate the actual token against every required operation |
| Work-order query exists in Lightspeed’s own collection | [Official R-Series Workorder request](https://www.postman.com/lightspeedhq/r-series-api/request/twq7dzb/workorder-query). Base: `https://api.lightspeedapp.com/API/V3/Account/{accountID}/Workorder.json` |
| Product stock is represented through related records | [Relations](https://developers.lightspeedhq.com/retail/introduction/relations/). Load the required `ItemShops` relation explicitly; do not infer availability from a product record alone |
| X-Series has its own developer app and authorisation flow | [X-Series authorisation](https://x-series-api.lightspeedhq.com/docs/authorization) and [scope reference](https://x-series-api.lightspeedhq.com/v1.0/docs/scopes). Reassess capabilities separately if the shop uses X-Series |

No Lightspeed-related configuration keys were found in the project `.env` or current environment (key names checked without outputting secret values). This does not prove no account exists elsewhere. No authenticated Lightspeed requests were made. Child work-order endpoint payloads and behaviour have not been freshly verified here; resolve those from the official reference/collection during the proof. The older timestamp/rate-limit research remains a hypothesis to test, not a passing result.

## Release 1 integration contract

**Lightspeed owns:** product identity/SKU, stock and the shop’s invoicing, payment and refund workflow. **Wheelhouse owns:** online requests, scheduling/effort, operational job/custody state, itemised quote approval, messages and tag identity. Store stable links between the two systems. No financial write endpoints are used by Wheelhouse in this release.

Proposed flow: authorised staff connect the shop → read its relevant products and stock → customer requests work in Wheelhouse → staff quote → customer approves selected lines → create/update the corresponding Lightspeed work order and approved physical part commitments → shop completes invoicing/payment/refunds in Lightspeed. Record the external work-order reference and whether the handoff succeeded, failed or is uncertain. Completion and collection in Wheelhouse do not imply payment was taken.

Customer matching is staff-confirmed against a specific existing POS customer or creates the current job’s customer after confirmation. No public phone lookup and no background customer import. Only current-job customer details are copied. Product catalogue synchronisation is still needed for quoting and is not customer migration.

Reservation versus stock decrement is a **proof outcome**, not an assumption. Determine what creating/removing a work-order part already does to reserved/available/on-hand stock. Never issue an additional stock adjustment for the same event if Lightspeed already performed it. Cancellation before sale releases only this job’s commitment; after a till sale, settlement and return stay in Lightspeed. Wheelhouse must show a conflict rather than silently restock a sold item.

## P00-LS: bounded proof before connector implementation

Owner to assign; Jack supplies the first-shop/account context. Request credentials through secure setup, never an issue or chat message. Use a shop-authorised test account/records for writes; no production inventory experiments are implied by this plan.

| Step | Required proof | Current result |
|---|---|---|
| LS-01 Account/client | Correct series, account ID and outlet; registered app callback; intended admin/employee can authorise | Pending account/client evidence |
| LS-02 Authentication | Code exchange, token refresh, revoked/locked user, rejected scope and reconnect exercised | Pending |
| LS-03 Reads | Account/shop, product/SKU, related stock and employee mapping queried with the intended scopes | Pending |
| LS-04 Current-job customer | Resolve one explicitly chosen customer, create a test customer if needed, retain source ID; no bulk import | Pending |
| LS-05 Work-order handoff | Create/read/update a test work order and labour/physical part lines; confirm unsupported field mapping and separate scheduled time in Wheelhouse | Pending exact child endpoint/payload proof |
| LS-06 Stock | Measure stock before add, after add, after quantity change, remove and cancellation. Confirm one authority and no double decrement; labour changes no stock | Pending |
| LS-07 Change detection | Edit a child line in the POS; determine whether parent timestamp changes. If not, prove a bounded child reconciliation strategy and its request cost | Pending |
| LS-08 Failure handling | Inspect actual rate-limit headers; pagination; timeout after an accepted write; stale data; reconnect; duplicate task delivery | Pending |
| LS-09 Shop round trip | Staff find the linked job in the actual POS UI and complete their existing till workflow without Wheelhouse issuing an invoice or taking money | Pending shop walkthrough; payment need not be triggered by our API |

Candidate R-Series scopes are `employee:workbench`, `employee:inventory_read`, `employee:customers` and the minimum scope required for employee lookup; use staff-entered POS employee IDs if full employee administration is unnecessary. Add inventory-write permission only if LS-06 proves a separate stock operation is needed. Validate this list against actual endpoint requirements; it is not a certified scope set. Do not request register/refund/report privileges for excluded features.

**Pass artefact:** redacted requests/responses, endpoint+scope matrix, fixture IDs, observed stock deltas, refresh/revoke results, child-edit result, failure/reconciliation example and the shop walkthrough. Close this task only when every required operation works with that exact account/app configuration. A 200 response alone is insufficient; reconcile the records and physical-stock accounting.

**If it fails:** stop dependent connector writes, identify missing entitlement or unsupported operation, and take a concrete R-versus-X decision with Jack. Do not declare Release 1 integration complete using screenshots, mocks or a manual handoff alone. Core workshop and tag work can proceed independently.
