# Jack's answers, 9 Nov 2026: finishing the account (WP-4.5)

Questions from writing the spec for the rest of WP-4.5, Account, history and reminders (`openspec/changes/finish-account`), answered by Jack on 9 Nov and passed on by the Front desk session. Each answer names what it settles.

## 1. Receipt numbers on older sales

The question: in-shop sales recorded before the new till have no B1-0000 receipt number. On 26 Oct Jack chose that the text receipt waits for Mark's step C rather than show "Sale [n]".

**Not the recommendation: keep to the 26 Oct choice.** A sale with a receipt number (B1-0000) opens its receipt from the account now. Older in-shop sales without one stay unclickable until step C. His reason: nobody uses Wheelhouse yet, so it can change later without repercussions. Since every repair is paid through the older record today, a repair's receipt, and the receipt email's "See it in your account", wait for step C too.

## 2. Where the privacy notice's words come from

**The recommendation.** The Owner types the shop's own privacy notice in Settings, as booking terms are, and the account's "Privacy notice" link shows only once it is added. Wheelhouse offers no wording of its own.

## 3. What "Edit" on Your details changes

**Not the recommendation.** Edit changes name, mobile and email. A new email is confirmed with a code sent to it, reusing the sign-in code, before it replaces the old one, which keeps working until then. What the old address is told is designed from the closest built pattern and logged (`decided-while-building.md`, 9 Nov, the plan for finishing the account).

## 4. Whether the reminder's booking link is built in this piece

**Yes**, as drawn (`ac-reminder-landing`), with its migration.

## 5. Receipts when "Show prices online" is off

**The recommendation.** A receipt always shows what was paid. Jack's background: shops that hide prices online usually only hide service prices; bikes and accessories always have prices.

## 6. Download receipt (PDF)

**The recommendation.** Left out; a browser can print or save the receipt.

## Small ones, 7 to 13

Kept as proposed (`openspec/changes/finish-account/design.md` § Open questions); Jack can overrule any later.
