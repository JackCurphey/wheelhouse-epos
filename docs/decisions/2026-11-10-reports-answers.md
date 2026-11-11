# Jack's answers, 10 Nov 2026: Reports, the first part (WP-5.3)

Questions from writing the spec for the first part of WP-5.3, Reports and accounts (`openspec/changes/reports-sales-and-takings`): the Reports page, Sales, and Takings and cash-ups. Answered by Jack on 10 Nov and passed on by the Front desk session. Each answer names what it settles. The split of WP-5.3 into four parts is in that change's proposal.

## 1. Margin on the Reports page's strip

The question: the drawing's strip (`rp-home`) shows Takings and Margin, but no sale record keeps what each item cost when it was sold.

**The recommendation.** The strip shows Takings only for now. Margin comes in part 2, with the Margin and stock value report, once each sale line keeps its cost when sold. That changes how a sale is saved, so it is agreed with Mark's step C first. Nothing works margin out from today's product costs.

## 2. Cards for reports not built yet

**The recommendation.** Only reports that are built get a card on the Reports page (Sales, and Takings and cash-ups, in part 1); each later part adds its card.

## 3. The Refunds figure on Sales

The question: no refund of a sale is recorded with its money until step C (Shopify refunds only put stock back).

**The recommendation.** The Refunds figure stays off Sales until step C records refunds.

## 4. Closed days per shop, not per till

The question: the built Close the day makes one close per shop per day; `rp-takings` lists a row per till.

**The recommendation.** Takings and cash-ups shows one row per closed day, without a till. The card's line reads "Each closed day, and any cash difference".

## 5. Online deposits in Takings

**The recommendation.** Sales counts a deposit paid online when the sale it pays towards is made. Takings and cash-ups shows it on that day's Online row, as the close already does.

## 6. The old app's Sales History

The question: the old app's Sales History tab lists single sales and opens each; Reports shows totals.

**Not the recommendation: keep it.** The old app's Sales History tab stays until a list of single sales is drawn and built, because a walk-in sale with no customer must stay findable. Part 1 does not remove it. A list of single sales is needed before the old tab goes; it is not drawn yet.

## 7 to 12. The small ones

**The defaults**, as `design.md` lists them: graphs for Today by hour, months and picked dates by day (by month beyond 62 days); Today compared with the same weekday last week, This month with the same days last month, Last month with the month before; Takings and cash-ups with the same periods as Sales, a row per month beyond 62 days; downloads as CSV files; "Show graphs in reports" on to start; a closed day's report in Reports shows what Close the day's report shows today, the drawing's extra rows waiting for step C.
