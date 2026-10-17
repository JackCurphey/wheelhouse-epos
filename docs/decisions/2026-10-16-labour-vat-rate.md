# Labour's VAT rate (16 Oct 2026)

Mark's question on #134 (15 Oct), from the sales-in-pence change
(`openspec/changes/wp-1-6-sales-in-pence/design.md`): what VAT rate should
labour carry, meaning workshop services and labour lines typed on the job
page? Jack, 16 Oct, one question. Answer posted on #134.

1. **The shop's standard rate, set once in Settings** (Jack: "1"), for
   workshop services and typed labour lines alike. A VAT-registered shop
   sets 20%; a shop that isn't registered sets 0%. Chosen over a rate per
   service, and over leaving it until VAT reports (stage 6).
2. **Products keep their own rates** (Jack): different items carry
   different rates, for example cycle helmets and some food at 0%. The
   design already does this: `products.vat_rate_bp` per product, copied
   onto each sale line. Which products are 0% follows HMRC's rules and is
   set by each shop, not built in.
