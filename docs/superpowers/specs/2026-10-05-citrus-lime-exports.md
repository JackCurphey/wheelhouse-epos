# What Citrus Lime exports (issue #136)

**Why.** The programme spec calls whether Citrus Lime's exports are enough
"the largest risk and the cheapest to check" (Codex finding 10). This page
records what exists, by column name only. Real export files never go in the
repo (project rule); nothing here is shop data.

**How it was read.** On 5 Oct 2026, on the shop's computer, Claude (through
the Chrome extension, with Jack signed in) opened each report and screen and
read only its column headings and its column chooser. No report was
generated and nothing was downloaded.

**What it means for the import** (build plan WP-2.4 and WP-8.1, updated in
the same pull request):

| Needed for the move | Where it comes from | Exports? |
|---|---|---|
| Products, prices, cost, supplier, reorder levels | Cloud Reports: Price List - Store Level | Yes, Excel |
| Stock per shop | Price List - Store Level; Stock by Location | Yes |
| Barcodes | Barcode/Alias List | Yes |
| Serial numbers | Serial Number List | Yes |
| Customers, perhaps only those who have bought | Top Customers | Yes |
| Every customer, buyers or not | Back office Customers list | **No export button** |
| Customers' bikes | Service Items Report (tick "include items never serviced"); it has the owner's name, email and phone but no account number | Yes |
| Money customers owe, credit limits | Customer Accounts with Balances; Outstanding Credit/Debit | Yes |
| Gift vouchers still to spend | Outstanding Gift Vouchers | Yes |
| Open orders and deposits, including open workshop jobs (to confirm: their Type column) | All Customer Orders; Order Line Detail (open only); Outstanding Deposits | Yes |
| Purchase orders | Purchase Order Lines - All Orders | Yes |
| Past sales, for the weekly check | Who Bought What; Tender Detail (by date range) | Yes |
| Stock history | Item Movement (from 25 Jan 2017) | Yes |
| Workshop job history, with mechanic, bike, dates and status | Back office Workshop list | **No export button** |
| Each job's notes and work done | Not seen in any list | **Not found** |
| Closed order lines | Back office Customer Order Lines | **No export button**; not needed for the move |
| Marketing consent and its date | Top Customers; Who Bought What | Yes |

**What can't be exported:** every customer (including those who never
bought) and the workshop job history with its notes. Ways to get them, in
this order: (1) Jack asks Citrus Lime support for a full export, with each
customer's account number and marketing consent (shops leaving usually get
one); (2) a way for programs to read Citrus Lime's data directly (an API),
if they offer one; (3) only if Jack decides to, as a last resort, after
checking Citrus Lime's terms and data-protection rules, an agent copying
the back office screens page by page, with the copy kept by Jack and never
in the repo.

The weekly check compares the number of customers (Moving from Citrus Lime,
decision 5), so it can only match once every customer has come across:
the full export is needed before the weekly check can pass.

"Item Lookup Code" (ILC) is Citrus Lime's product code.

## Cloud Reports (intelligence.citruslime.com/reports)

Every report below has "Export to Excel".

### Products and stock
- **Price List - Store Level** (`PriceListStoreLevel.aspx`), per store. Shown:
  Store, Department, Category, Supplier, Item Lookup Code, Description, Brand,
  Season, Gender, Store Cost, Price, MSRP, Tax Rate, Price Excl. Tax, Tax,
  Projected Profit (£), Projected Profit Margin (%), Date Created, Min (Reorder
  Point), Max (Restock Level), Qty On Hand, Qty Committed, Qty Available,
  Quantity On PO at Store, Quantity On Transfer to Store, Bin Location, Matrix
  Lookup Code, Matrix Description. Extra columns in the chooser: Active, Amazon
  Price (+Changed), Do Not Place On PO, eBay Price (+Changed), Item Notes, Last
  Counted, Last Received, Last Sold, Matrix Active, Matrix Dimension 1/2/3, MPQ,
  MSRP Changed, Not Available From Supplier, On Sale, Price A–E (+Changed),
  Price Changed, Sale End Date, Sale Price, Sale Start Date, Supplier Cost,
  Supplier Part Code, Website Price (+Changed).
- **Price List** (`PriceList.aspx`): the business-wide version (not opened).
- **Stock by Location** (`StockByLocationReport.aspx`): Brand, Season,
  Department, Category, Quantity, Quantity Committed, Quantity Available, Store
  Name, Item Lookup Code, Description.
- **Barcode/Alias List** (`AliasList.aspx`): Alias, ILC, Description, Brand,
  Season, Supplier, Department, Category, Cost, Price.
- **Serial Number List** (`SerialList.aspx`): Store, Item Lookup Code,
  Description, Brand, Season, Supplier, Department, Category, Serial Number,
  Serial Number 2, Serial Number 3, Status, Cost, Price.
- **Item Movement Report** (`ItemMovementReport.aspx`, from 25 Jan 2017): Store
  Name, Department, Category, Item Lookup Code, Description, Quantity, Movement
  Type, Cost, Extended Cost, Date, Transaction ID, Purchase Order/Transfer
  Number, Purchase Order/Transfer Title, PO Supplier Ref., Stock Take
  Description, Reason Code, Cashier Name, Item Tax Rate, Supplier.
- **Purchase Order Lines Report - All Orders**
  (`PurchaseOrderLinesReportAllOrders.aspx`): Order Date, Closed?, Item Lookup
  Code, Supplier Part Code, Description, Store Name, PO Number, Supplier,
  Department, Category, Brand, Season, Gender, Qty Ordered, Qty Received, MPQ,
  PO Cost Price, Item Avg Cost, Supplier Cost, Qty On Hand, Qty Committed,
  Price, MSRP, Active, Do Not Place On PO, Last Received, Last Sold, Invoice
  Number, Title, Notes, Created By, Supplier's Order Ref, Order Placed, Due Date.

### Customers and bikes
- **Top Customers** (`topcustomers.aspx`): Account Number, Total Sales, Total
  Savings, Total Visits, Last Visit, First Name, Last Name, Address, Address 2,
  City, County, Postcode, Country, Email, Phone, GDPR Consent, GDPR Consent
  Date, Price Level. (Excludes Amazon customers; whether it lists customers
  with no sales is unknown.)
- **Service Items Report** (`ServiceItemsReport.aspx`), the customers' bikes:
  Description, Serial Number, Date Created, Last Serviced, Total Service
  Revenue, Total Number of Services, On Open Job?, Customer Name, Email
  Address, Mobile Number, Phone Number, Address, Address 2, City, County,
  Country, Postcode. Option: include items never serviced.

### Money owed and held
- **Customer Accounts with Balances** (`CustomerAccounts.aspx`): Account
  Number, Customer Name, Credit Limit, Account Balance, Account Grace Period
  (days), Company, Address, Address 2, City, County, Postcode, Email Address,
  Phone Number, Mobile Number, Last Visit, Total Sales, Total Visits.
- **Accounts - Outstanding Credit/Debit Report** (`customercredit.aspx`):
  Account Number, Customer Name, Company, Type, Date, Terms (Days), Due Date,
  Aging (Days), Original Amount, Outstanding Amount, Transaction Number.
- **Outstanding Gift Vouchers Report** (`OutstandingGiftVouchers.aspx`):
  Status, Voucher Code, Creation Date, Expiry Date, Starting Balance, Current
  Balance, Customer Link. (Also All Gift Vouchers, not opened.)

### Orders and workshop jobs
- **All Customer Orders Report** (`posorders.aspx`; also `?deposits=true` for
  outstanding deposits): Store, Customer Name, Order Number, Order Ref.,
  Postcode, Account Number, Order Type, Due Date, Created Date, Deposit, Order
  Total, Closed.
- **Order Line Detail Report** (`POSOrderLineDetail.aspx`), open orders only:
  Store, Status, Type, Order Number, Customer, Customer Email Address, Due
  Date, Item Lookup Code, Description, Qty Ordered, Qty Collected, Price, Free
  Stock (Store), Qty on Customer Orders (Store), Item Type, Qty On Purchase
  Orders (Store), Soonest PO # (Store), Soonest PO Date (Store), Quantity On
  Transfer to Store, Quantity On Transfer to All Stores, Free Stock (Global),
  Qty on Customer Orders (Global), Acc. Number, Postcode, Brand, Supplier,
  Season, Department, Category, Deposit on Order, Date Created, Line Comments,
  Order Comment, Order Reference.
- Workshop reports (Workshop Productivity, Performance, Mechanic Performance)
  are summaries by month or mechanic, not job lists.

### Past sales
- **Who Bought What** (`whoboughtwhat.aspx`), by date range: Date, Channel,
  Store Transaction Number, Item Lookup Code, Description, Qty Sold, Line Rev.,
  Line Rev. Inc Tax, Profit, Department, Category, Brand, Email Address,
  Account Number, Customer Name, Address 1, Address 2, City, Postcode, Phone,
  Cashier, Store, GDPR Consent, GDPR Consent Date.
- **Tender Detail Report** (`TenderDetailReport.aspx`), by date range: Store,
  Till, Batch, Tender, Transaction/Order Number, Customer Name, Customer
  Account Number, Date of Payment, Tendered Amount.

### Not found in Cloud Reports
- A full customer list including customers who never bought (Top Customers
  may only list buyers).
- Workshop jobs as a list with their work, mechanic and notes: open ones may
  be in the customer orders reports (Order Type / Type), closed ones not.

## Cloud POS back office (pos2.citruslime.com), read 5 Oct 2026
Column headings and Manage View lists only. None of these screens showed an
Export or Download button.
- **Customers** (`#/backoffice/customers`): every customer, 43,094 records,
  buyers or not. Columns: Account #, Type, First Name, Last Name, Email, Mobile
  Number, Town/City, Postcode, Company, County/State (hidden by default), Total
  Sales, Total Visits, Last Visit.
- **Customer Orders** (`#/backoffice/customerOrders`): special orders,
  workshop jobs, quotes and layaways. Columns: Order Number, Order Ref.,
  Customer, Postcode, Country, Acc. Number, Store, Type, Order Status, Due
  Date, Date Created, Deposit, Total, Closed. Same as Cloud Reports' All
  Customer Orders Report, which does export.
- **Customer Order Lines** (`#/backoffice/customerOrdersLines`), by date
  range, open and closed: Order Number, Customer, Item Lookup Code,
  Description, Qty Ordered, Qty Collected, Price, Due Date, Store, Type, Free
  Stock (Store), Qty on Customer Orders (Store), Order Line Status, Order
  Status.
- **Workshop list** (`#/workshop/`, List view), every job back to at least
  2022: Order Number, Order Reference, Customer Name, Checked In, Is Complete,
  Is Paid For, Is Bike Build, Created Date, Start Date, End Date, Due Date,
  Assigned Mechanic, Status, Service Item (the bike), QC, Order Value, Storage
  Slot, Warranty (hidden by default).
- Wizards & Imports: bulk updates and imports into Citrus Lime, not exports.
  Not opened.

## Still unknown
- How to get the full customer list, the closed order lines and the workshop
  job list out: the back office screens show them but have no export button.
  Options: Citrus Lime support (a data export on leaving), or the Cloud Reports
  versions (Top Customers may miss customers who never bought; Order Line
  Detail is open orders only).
- Job notes and the work done on each job: not seen in any list.
