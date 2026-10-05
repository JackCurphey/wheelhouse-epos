# Card payments: which company to build for first — Jack's decision (5 Oct 2026)

**Decision** (Jack, 5 Oct: "1"). Wheelhouse builds for **Stripe first**, for
both the card reader at the till (Stripe Terminal, driven from the server)
and online payments (payment links and checkout). **SumUp** is the second
card reader connection, and **Paymentsense** comes later. Each sits behind
the card machine adapter (Selling at the till 6, later change of 5 Oct), so
adding one never changes the till. Chosen over SumUp first and over keeping
Paymentsense first.

**Why** (Jack, 5 Oct: "stripe could be a good one as i know citruslime uses
them for paymentlinks, which we are going to have aswell"):
- A single shop can connect its own till to Stripe with keys from its own
  dashboard; no partner agreement was found. Paymentsense's live
  connection needs IDs Dojo issues, which may need a partner deal (#138).
- Stripe's guidance for a payment whose result was lost (a dropped
  connection) is the clearest of the companies checked, and it has a
  pretend reader to build against.
- One company for the card reader and online links: Stripe says both are
  managed in one dashboard. Whether payouts and reports are combined was
  not confirmed.

**The trade-off accepted.** With the reader driven from the server, card
payments stop when the shop's internet is down. The fallback is keying the
amount in on a separate card machine, or the Stripe Reader S710 with its
mobile signal (£7 a month). Which reader to buy is still to decide.

**What the research found** (5 Oct 2026, current official pages unless
marked; nothing was signed up for):

| | Stripe | SumUp (Solo) | Paymentsense / Dojo |
|---|---|---|---|
| A single shop can connect | Yes, own dashboard keys | Yes, a key made in its own settings | Not confirmed: live needs IDs from Dojo |
| Works from a browser till | Yes, the server sends to a named reader | Yes, Solo reader only | Yes |
| UK card fee in person | 1.4% + 10p (EEA cards, which include UK cards in Stripe's table), no monthly fee | 1.69%, no monthly fee | about £39.99 a month, then 1% (third-party reviews) |
| Online payment link fee | 1.5% + 20p (standard UK cards; premium UK cards 2.8% + 20p) | 2.5% (third-party) | not confirmed |
| Readers | S700 or S710 £229, WisePad 3 £49 | Solo £79 + VAT (third-party) | from £79 (third-party) |
| Internet down | No card payments; S710 has 4G at £7 a month | Solo has its own SIM and an offline mode | not stated |
| Test mode | Pretend reader | Pretend Solo | Pretend terminals |

Sources: Stripe — docs.stripe.com/terminal and its server-driven guides,
stripe.com/en-gb/pricing, stripe.com/en-gb/payments/payment-links. SumUp —
developer.sumup.com (Cloud API, affiliate keys, Readers API),
sumup.com/en-gb/pricing. Dojo — docs.dojo.tech (Pay at Counter, terminals);
fees from expertmarket.com (third-party). Square, Teya, Zettle and Adyen
were also checked and fit less well (higher fees, unconfirmed self-serve
access, or partner-only).

**Still to do:** Mark sets up the Stripe account (Q10: the online payments
provider is among the accounts Mark sets up), or uses the one Citrus Lime's
links may already use; like buying a reader, it is a real account and
money, so it waits for Jack's yes (project rules). Until then Mark builds
against Stripe's pretend reader.
