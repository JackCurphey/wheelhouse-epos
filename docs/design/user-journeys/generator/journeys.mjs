// The journey map: every screen, grouped by journey, with its status.
// d(id)            = a screen from the Release 1 screen designs (image shown as is)
// b(id)            = one of those that is also built in the app
// g(...)           = not designed yet;  o(...) = only in the old app, needs a new design
// Placeholder args: (id, title, role, purpose, content[], extra{today, source})

export const d = (id, extra = {}) => ({ id, status: 'designed', ...extra });
export const b = (id, extra = {}) => ({ id, status: 'built', ...extra });
const ph = (status) => (id, title, role, purpose, content = [], extra = {}) => ({ id, status, title, role, purpose, content, ...extra });
export const g = ph('gap');
export const o = ph('old');

export const r = (id, title, role) => ({ id, status: 'review', title, role, drawn: true });
// sd(id, title, role) = an agreed Workshop day redesign screen (diary.mjs, Soft
// sand look), shown at desktop, tablet and phone; build.mjs reads the boards
// from the Soft sand build in out-diary-sand/.
export const sd = (id, title, role) => ({ id, status: 'designed', title, role, sand: true });

export const journeys = [
  {
    id: 'ja', num: 'A', name: 'App map and navigation', who: 'Everyone',
    rows: [
      { label: 'How it fits together', screens: [r('map', 'How Wheelhouse fits together', 'Everyone')] },
      { label: 'Navigation shells', screens: [
        r('shell-staff', 'Staff app', 'Manager'),
        r('shell-staff-menu', 'Staff app: menu open / mechanic view', 'Manager'),
        r('shell-till', 'Till mode', 'Staff'),
        r('shell-site', 'Customer website', 'Customer'),
        r('shell-site-menu', 'Customer website: menu open', 'Customer'),
      ] },
    ],
  },
  {
    id: 'jb', num: 'B', name: 'Signing in and access', who: 'Staff and customers',
    rows: [
      { label: 'Staff', screens: [
        r('auth-signin', 'Sign in', 'Staff'),
        r('auth-forgot', 'Reset your password', 'Staff'),
        r('auth-sent', 'Check your email', 'Staff'),
        r('auth-newpass', 'Choose a new password', 'Staff'),
        r('auth-invite', 'Accept an invitation', 'Staff'),
        r('auth-site', 'Choose where you’re working', 'Staff'),
        r('auth-signedout', 'Signed out', 'Staff'),
        r('auth-expired', 'Session expired', 'Staff'),
        r('auth-noaccess', 'Not part of your role', 'Staff'),
      ] },
      { label: 'Till', screens: [
        r('till-setup', 'Set up this till', 'Manager'),
        r('till-checkin', 'Who’s working today?', 'Staff'),
        r('till-pin', 'Enter your PIN', 'Staff'),
      ] },
      { label: 'Customers', screens: [
        r('cust-signin', 'Sign in to your account', 'Customer'),
        r('cust-code', 'Enter your code', 'Customer'),
        d('pending', { note: 'Booking link: no sign-in needed' }),
        d('expired'),
      ] },
    ],
  },
  {
    id: 'j01', name: 'Find the shop and browse the website', who: 'Customer',
    rows: [
      { label: 'Browse', screens: [
        o('web-home', 'Website home page', 'Customer', 'The shop’s own website: who they are, what they sell, how to book a repair.', ['Shop branding laid out with the theme system (layout, sections, colours, fonts, images)', 'Links to shop products and to book a repair', 'Opening hours and address'], { today: 'The old website page is one fixed layout: logo, hero image, description, product grid, five colour choices. Add to basket goes to Shopify.', source: 'Release 2 piece 7 · rule 6' }),
        g('web-category', 'Category and product list', 'Customer', 'Browse what the shop sells.', ['Categories and filters', 'Price and whether it is in stock', 'Sizes and colours shown on the card'], { source: 'Release 2 piece 7 · INV-06, INV-12' }),
        g('web-product', 'Product page', 'Customer', 'Everything needed to decide and buy.', ['Photos', 'Choose size and colour', 'Price, and stock at each shop', 'Add to basket, or reserve for click and collect'], { source: 'Release 2 piece 7 · INV-04, INV-06' }),
        g('web-search', 'Search results', 'Customer', 'Find a product by name or type.', ['Search box', 'Results with price and stock', 'Nothing found'], { source: 'ECOM-01' }),
        g('web-shops', 'Our shops', 'Customer', 'Where each shop is and when it is open.', ['One card per shop: address, hours, phone', 'Map link', 'Book a repair at this shop'], { source: 'Release 2 multiple sites · ACC-09' }),
      ] },
      { label: 'When things go wrong', screens: [
        g('web-missing', 'Page not found / website switched off', 'Customer', 'A plain page that never reveals whether a shop exists.', ['Friendly message', 'Link back to the home page'], { source: 'Shop websites spec, error handling' }),
        g('web-cookies', 'Cookie choices', 'Customer', 'Only needed if the website sets cookies that are not essential.', ['Accept or decline non-essential cookies', 'Link to the privacy notice'], { source: 'LEG-04' }),
      ] },
    ],
  },
  {
    id: 'j02', name: 'Buy online, or click and collect', who: 'Customer',
    rows: [
      { label: 'Checkout', screens: [
        g('buy-basket', 'Basket', 'Customer', 'Review what is being bought.', ['Lines with size and colour', 'Change quantity or remove', 'Total including VAT', 'Go to checkout'], { today: 'The old website hands the basket to Shopify. Release 2 replaces Shopify.', source: 'Release 2 piece 7' }),
        g('buy-collect', 'Checkout: collect or deliver', 'Customer', 'Choose how to get the order.', ['Click and collect: choose which shop', 'Delivery: address and options', 'Contact details'], { source: 'ECOM-04 · ACC-09' }),
        g('buy-pay', 'Checkout: payment', 'Customer', 'Pay online.', ['Card payment', 'Order summary', 'Terms'], { source: 'PAY-05 (payments decision still open)' }),
        g('buy-confirmed', 'Order confirmed', 'Customer', 'Say what happens next. Also sent by email.', ['Order number', 'What was bought', 'Collect from which shop, or delivery estimate'], { source: 'ECOM-04 · COM-03' }),
      ] },
      { label: 'After ordering', screens: [
        g('buy-ready', 'Ready to collect (message)', 'Customer', 'Tell the customer to come in.', ['Which shop, opening hours', 'What to bring', 'Order number'], { source: 'ECOM-04 · COM-04/05' }),
        g('buy-status', 'Order status', 'Customer', 'See where an order has got to.', ['Ordered, being picked, ready or sent', 'Contact the shop'], { source: 'ECOM-04' }),
      ] },
    ],
  },
  {
    id: 'j03', name: 'Book a repair', who: 'Customer',
    rows: [
      { label: 'Booking', screens: [b('service'), b('service-list'), d('diagnosis'), b('problem'), b('date'), d('appointment'), d('full'), b('details'), b('pending'), d('confirmed')] },
      { label: 'Change, cancel and problems', screens: [
        d('reschedule'), d('change-pending'), d('cancel'), d('cancelled'), d('rejected'), d('expired'), d('service-status'),
        g('book-sending', 'Leaving while the request is sending', 'Customer', 'What the customer sees if they press Back while their booking request is still sending.', ['Whether the request got through', 'Their booking link if it did', 'Try again if it did not'], { source: 'Known follow-up in the project status notes' }),
        g('book-deposit', 'Pay a deposit when booking', 'Customer', 'Only if shops want deposits. Not decided: deposits were left out of Release 1.', ['Amount and what it covers', 'Pay', 'What happens on cancelling'], { source: 'BOOK-09 · PAY-04 · decision of 23 Sep' }),
      ] },
    ],
  },
  {
    id: 'j04', name: 'Drop off and approve the quote', who: 'Customer',
    rows: [
      { label: 'While the bike is in', screens: [
        d('progress'),
        g('quote-findings', 'Inspection findings with photos', 'Customer', 'Show what the mechanic found, with photos, before asking for approval.', ['Each finding with its photo', 'Why it matters', 'Link to approve the work'], { source: 'INS-02 · DONE-02' }),
        d('approval'), d('approval-done'), d('stale'), d('ceiling'), d('customer-message'), d('preferences'),
      ] },
    ],
  },
  {
    id: 'j05', name: 'Collect the bike and pay', who: 'Customer',
    rows: [
      { label: 'Collection', screens: [
        d('ready'),
        g('done-summary', 'Job done: summary and invoice', 'Customer', 'Everything that was done, in one message, with a way to pay.', ['Work done, with photos', 'Itemised invoice', 'Pay now (if paying online)'], { source: 'DONE-01..08' }),
        g('done-pay', 'Pay online for workshop work', 'Customer', 'Pay before or at collection without waiting at the counter.', ['Amount and what it covers', 'Card payment', 'Paid confirmation'], { source: 'DONE-05 · PAY-05' }),
        g('done-receipt', 'Receipt or invoice by email', 'Customer', 'A copy for the customer’s records.', ['Shop details and VAT number', 'Lines, VAT, total, how paid'], { source: 'TILL-13 · DONE-04' }),
      ] },
    ],
  },
  {
    id: 'j06', name: 'Cycle to Work', who: 'Customer and staff',
    rows: [
      { label: 'Waiting for Jack’s explanation', screens: [
        g('c2w-customer', 'Cycle to Work: customer side', 'Customer', 'Jack’s own Cycle to Work design, to be explained before piece 8. No screens can be proposed until then.', [], { source: 'Release 2 spec §7' }),
        g('c2w-staff', 'Cycle to Work: staff side', 'Staff', 'The staff side of the same design, including any sale at the till.', [], { source: 'Release 2 spec §7' }),
      ] },
    ],
  },
  {
    id: 'j07', name: 'Account, history and reminders', who: 'Customer',
    rows: [
      { label: 'Account', screens: [
        g('acct-history', 'Service history and book again', 'Customer', 'Every past job for each bike, and one tap to book the same again.', ['Bikes', 'Past jobs with dates and work done', 'Book again'], { source: 'Release 2 piece 9 · BIKE-02' }),
        g('acct-balance', 'Loyalty points and account balance', 'Customer', 'Open question: do customers see their points or account balance?', ['Points balance', 'Account statement'], { source: 'Release 2 piece 4' }),
      ] },
      { label: 'Messages and privacy', screens: [
        g('acct-reminder', 'Service reminder and landing page', 'Customer', '“Your bike is due a service”, leading straight into booking.', ['Which bike, when last serviced', 'Book now'], { source: 'Release 2 piece 9 · COM-07' }),
        g('acct-review', 'Review request after collection', 'Customer', 'Ask happy customers for a review.', ['Link to leave a review'], { source: 'COM-08' }),
        g('acct-unsubscribe', 'Stop marketing messages', 'Customer', 'Opt out of marketing without affecting job updates.', ['Marketing on or off', 'Job updates unchanged'], { source: 'CUS-06 · COM-09' }),
        g('acct-privacy', 'Privacy notice and data requests', 'Customer', 'Read the privacy notice; ask for a copy of, or deletion of, personal data.', ['Privacy notice', 'Request a copy', 'Request deletion'], { source: 'LEG-02 · LEG-09' }),
      ] },
    ],
  },
  {
    id: 'j08', name: 'Owner setup and onboarding', who: 'Owner and Manager',
    rows: [
      { label: 'Getting started', screens: [
        g('setup-checklist', 'First-run checklist', 'Owner', 'The steps a new shop takes, in order, with progress.', ['Shop details, sites, tills, staff, products, services', 'What is done and what is next'], { source: 'FD-07' }),
        d('settings'),
        g('setup-sites', 'Sites', 'Owner', 'Add and name each shop location, with its code.', ['Site name and code (for example B for Bolton)', 'Address and hours per site'], { source: 'Offline plan 1 (built on the server) · ACC-09' }),
        g('setup-register-till', 'Register a till', 'Manager', 'Set up a computer as a till, for example “Bolton, till 1 — B1”.', ['Choose site and till number', 'One-time key shown once', 'Switch a till off', 'Replace a till computer (reissue)'], { source: 'Offline spec §5 · plan 3' }),
      ] },
      { label: 'People', screens: [
        d('staff-settings'), d('staff-edit'), d('staff-deactivate'),
        g('setup-pin', 'Set a staff PIN', 'Manager', 'Give each member of staff a 4–6 digit PIN for checking in at the till.', ['Set or change PIN', 'Never shown again after saving'], { source: 'Offline spec §4 (built on the server)' }),
        g('setup-roles', 'Roles and permissions', 'Owner', 'Who can discount, refund, see reports and edit stock.', ['Owner, Manager, Staff, Mechanic', 'What each role can do'], { source: 'ACC-04 · piece 3' }),
      ] },
      { label: 'Selling and printing', screens: [
        g('setup-vat', 'VAT rates', 'Manager', 'The VAT rates products can use.', ['Standard, reduced, zero', 'Default for new products'], { source: 'REP-05 · every product has a VAT rate' }),
        g('setup-till', 'Till and receipt settings', 'Manager', 'How payments and receipts work.', ['Payment types', 'Receipt layout and footer', 'Receipt number format'], { source: 'TILL-12 · piece 3' }),
        d('printer-settings'),
        g('setup-receipt-printer', 'Receipt printer and cash drawer', 'Manager', 'Connect the receipt printer and cash drawer to each till.', ['Choose printer', 'Test print', 'Cash drawer opens on cash sales'], { source: 'HW-04 · TILL-20' }),
      ] },
      { label: 'Workshop and messages', screens: [
        d('services'), d('service-edit'), d('hours'), d('booking-settings'), d('message-settings'), d('channel-edit'), d('channel-proof'), d('template'), d('setup-saved'),
      ] },
      { label: 'Data', screens: [
        g('setup-export', 'Export everything', 'Owner', 'Download all of the shop’s data at any time.', ['What to export', 'Download'], { source: 'Release 2 rule 5 · DAT-01' }),
      ] },
    ],
  },
  {
    id: 'j09', name: 'Moving from Citrus Lime', who: 'Owner',
    rows: [
      { label: 'Bring the data across', screens: [
        g('move-upload', 'Upload Citrus Lime exports', 'Owner', 'Bring products, stock, customers, sales and workshop jobs across.', ['One upload per kind of data', 'What each file must contain'], { source: 'Release 2 piece 1 (depends on what Citrus Lime exports)' }),
        g('move-map', 'Match the columns', 'Owner', 'Check each Citrus Lime column lands in the right place before importing.', ['Column matching', 'Preview of the first rows'], { source: 'Implied by Release 2 piece 1' }),
        g('move-run', 'Import progress and result', 'Owner', 'What came across and what did not.', ['Counts per kind of data', 'Rows needing attention'], { source: 'Implied by Release 2 piece 1' }),
        g('move-fix', 'Rows to fix', 'Owner', 'Rows that could not be imported, with the reason, to fix and retry.', ['Reason per row', 'Fix and retry'], { source: 'Release 1 scope reduction' }),
        g('move-schedule', 'Keep in step (re-import)', 'Owner', 'Re-run the import on a schedule while running alongside Citrus Lime.', ['Schedule', 'History of runs'], { source: 'Release 2 piece 1' }),
      ] },
      { label: 'Run alongside, then switch', screens: [
        g('move-compare', 'Compare with Citrus Lime', 'Owner', 'Check Wheelhouse agrees with Citrus Lime, for example a week’s sales totals.', ['Side-by-side totals', 'Differences'], { source: 'Release 2 rule 7' }),
        g('move-practice', 'Practice mode', 'Staff', 'Make it obvious when a till or screen is practice, not real money.', ['Clear practice marker', 'Practice sales kept separate'], { source: 'Release 2 piece 3' }),
        g('move-switch', 'Switch-over checklist', 'Owner', 'Everything that must be true before turning Citrus Lime off, then the first week on Wheelhouse alone.', ['Checklist', 'Trading-week tracker'], { source: 'Release 2 finish line' }),
      ] },
    ],
  },
  {
    id: 'j10', name: 'Opening the shop and checking in', who: 'Staff and Manager',
    rows: [
      { label: 'Morning', screens: [
        g('open-start', 'Till start-up', 'Staff', 'What a registered till shows when it opens.', ['Site and till code', 'Connected, or offline with sales waiting', 'Last updated'], { source: 'Offline spec §5' }),
        g('open-checkin', 'Staff check-in with PIN', 'Staff', 'Each person checks in once a day; works offline.', ['Pick your name', 'Enter PIN', 'Who is already in'], { source: 'Offline spec §4 · plan 3' }),
        g('open-float', 'Opening float', 'Staff', 'Count the cash in the drawer at the start of the day.', ['Count by coin and note', 'Expected vs counted'], { source: 'TILL-15' }),
        g('open-tills', 'Tills overview', 'Manager', 'Every till: when it last synced and how many sales it is holding.', ['One row per till, by site', 'Offline tills highlighted'], { source: 'Offline spec §8 · plan 3 (data built)' }),
        d('desk'),
      ] },
    ],
  },
  {
    id: 'j11', name: 'Selling at the till', who: 'Staff',
    rows: [
      { label: 'A sale', screens: [
        o('till-sale', 'Sale screen', 'Staff', 'Ring up a sale fast.', ['Search or scan', 'Basket with quantities and prices', 'Who is serving (checked-in staff)', 'Customer'], { today: 'The old till has search, basket, price changes, discount and cashier pills, but no product grid.', source: 'Release 2 piece 3 · TILL-01..04' }),
        g('till-variant', 'Choose size and colour', 'Staff', 'Pick the exact item when a product comes in sizes and colours.', ['Grid of sizes and colours', 'Stock for each'], { source: 'INV-06' }),
        g('till-serial', 'Record a serial number', 'Staff', 'Capture the frame number when a bike is sold.', ['Scan or type serial'], { source: 'INV-07' }),
        o('till-customer', 'Find or add a customer', 'Staff', 'Attach a customer to the sale; works offline.', ['Search', 'Add new (possible duplicates flagged later)'], { today: 'The old till has a type-ahead customer picker with “new customer”.', source: 'Offline spec §3 · TILL-16' }),
        g('till-discount', 'Discount with a reason', 'Staff', 'Discount a line or the whole sale; a manager PIN if staff are not allowed.', ['Amount or percent', 'Reason', 'Manager PIN when needed'], { today: 'The old till has a £ discount with no reason or permission check.', source: 'TILL-04 · ACC-04' }),
      ] },
      { label: 'Taking payment', screens: [
        o('till-pay', 'Take payment', 'Staff', 'Cash with change, card, or split.', ['Cash and change due', 'Card (typed into the card machine)', 'Split between methods'], { today: 'The old tender screen is marked as a placeholder in its own code.', source: 'TILL-05..07' }),
        g('till-card', 'Card machine in progress', 'Staff', 'Only if Wheelhouse ever sends the amount to the card machine itself. Optional.', ['Waiting for card', 'Approved or declined'], { source: 'Offline spec §11 · PAY-03' }),
        g('till-account', 'Account sale and loyalty', 'Staff', 'Put a sale on a customer’s account, and add or spend points.', ['Account balance and limit', 'Points'], { source: 'Release 2 piece 4' }),
        g('till-giftcard', 'Gift card and store credit', 'Staff', 'Sell, top up and spend gift cards or credit.', ['Card number', 'Balance'], { source: 'TILL-18 · TILL-19' }),
        g('till-deposit', 'Deposit or part payment', 'Staff', 'Take part of the money now.', ['Amount now', 'Balance left'], { source: 'TILL-17' }),
        o('till-receipt', 'Receipt', 'Staff', 'Print, email or text the receipt.', ['Print', 'Email or text', 'Receipt number like B1-1042'], { today: 'The old receipt window’s Print button appears to print a blank page.', source: 'TILL-12 · TILL-13' }),
      ] },
      { label: 'Other till jobs', screens: [
        g('till-park', 'Park and resume a sale', 'Staff', 'Hold a basket while serving someone else.', ['Parked sales list', 'Resume'], { source: 'TILL-08' }),
        g('till-void', 'Void a sale', 'Staff', 'Cancel a sale that should not stand, with a reason.', ['Reason', 'Manager PIN when needed'], { source: 'TILL-10' }),
        o('till-find', 'Find a past sale', 'Staff', 'Look up any sale by receipt number, customer or date.', ['Search by receipt number', 'Date range'], { today: 'The old sales history only filters Today or All time.', source: 'CUS-03' }),
        g('till-refund', 'Refund, return or exchange', 'Staff', 'Take items back and give money or credit.', ['Find the original sale', 'Choose items', 'Refund method'], { source: 'TILL-09 · TILL-11' }),
        g('till-job', 'Pay for a workshop job', 'Staff', 'Take payment for a finished job at the Wheelhouse till (replaces the Lightspeed handoff).', ['Agreed work and parts', 'Add products', 'Take payment'], { source: 'JOB-18 · Release 2 piece 4' }),
        g('till-collect', 'Hand over a click and collect order', 'Staff', 'Give an online order to the customer.', ['Find order', 'Check items', 'Mark collected'], { source: 'ECOM-04' }),
      ] },
      { label: 'When the internet drops', screens: [
        g('till-offline', 'Offline banner', 'Staff', 'Calm notice that sales are being saved on this till; more prominent after four hours.', ['Sales waiting count', 'Prices may be out of date (after four hours)'], { source: 'Offline spec §3 · plan 3' }),
        g('till-needs-net', 'Needs the internet', 'Staff', 'What refunds, job payments, product edits and reports show while offline.', ['Why it cannot be done now', 'It will work when the connection is back'], { source: 'Offline spec §3' }),
        g('till-no-signout', 'Can’t sign out yet', 'Staff', 'Stop the till being signed out or cleared while sales are waiting to send.', ['Sales waiting', 'Try again when connected'], { source: 'Offline spec §8' }),
        g('till-failed', 'Sales that didn’t send', 'Manager', 'Sales the server could not store, kept on the till, with the reason.', ['Each sale and reason', 'Fix or re-enter'], { source: 'Offline plan 1 walk (“failed” results)' }),
      ] },
    ],
  },
  {
    // Workshop day redesign, approved by Jack 29 Sep (decision 69): the Soft
    // sand build of diary.mjs (build-diary.mjs --theme sand), desktop + tablet
    // + phone. Rows and screen order match diary.mjs ROWS; build.mjs checks.
    id: 'j12', name: 'Workshop day', who: 'Staff and Mechanic',
    rows: [
      { label: 'The diary', screens: [
        sd('diary', 'Diary', 'Staff'),
        sd('diary-mechanic', 'Diary · a mechanic’s view', 'Mechanic'),
        sd('waiting-open', 'Pending request selected', 'Staff'),
        sd('diary-day', 'Day view', 'Staff'),
        sd('diary-settings', 'Diary settings', 'Manager'),
        sd('change-selected', 'Change request selected', 'Staff'),
        sd('diary-context-menu', 'Diary · right-click a job', 'Staff'),
        sd('job-quick-overview', 'Diary · job overview (quick look)', 'Staff'),
        sd('settings-accessibility', 'Settings · Accessibility', 'Manager'),
        sd('diary-stack-hover', 'Diary · stacked jobs fanned out on hover', 'Staff'),
        sd('diary-stack-open', 'Diary · choose a job from a stack', 'Staff'),
        sd('diary-hover-summary', 'Diary · hover a job for its summary', 'Staff'),
      ] },
      { label: 'Requests, as a pop-up', screens: [
        sd('request-new', 'Booking request', 'Staff'),
        sd('request-decline', 'Decline a booking request', 'Staff'),
        sd('request-change', 'Change request', 'Staff'),
        sd('request-cancel', 'Cancelled booking', 'Staff'),
      ] },
      { label: 'New job from an empty slot', screens: [
        sd('new-job-pick', 'New job · choose a free time', 'Staff'),
        sd('new-job', 'New job', 'Staff'),
        sd('new-job-day', 'New job (from the day view)', 'Staff'),
      ] },
      { label: 'The job — one page, no tabs', screens: [
        sd('job-overview', 'Job · expected', 'Staff'),
        sd('job-book-in', 'Job · booked in, tag printed', 'Staff'),
        sd('job-quote', 'Job · quote', 'Staff'),
        sd('job-mechanic', 'Job · in the workshop (mechanic)', 'Mechanic'),
        sd('job-waiting-parts', 'Job · waiting for parts', 'Staff'),
        sd('job-finished', 'Job · finished', 'Staff'),
        sd('job-collection', 'Job · collection', 'Staff'),
        sd('job-checklist', 'Job · full service checklist', 'Mechanic'),
      ] },
      { label: 'Customer account', screens: [sd('customer', 'Customer account', 'Staff')] },
      { label: 'Overview page', screens: [sd('overview', 'Workshop overview', 'Staff')] },
    ],
  },
  {
    id: 'j13', name: 'Receiving stock and purchase orders', who: 'Staff and Manager',
    rows: [
      { label: 'Suppliers', screens: [
        o('po-suppliers', 'Suppliers', 'Manager', 'Each supplier and its product feed.', ['Supplier details', 'Feed status and last sync'], { today: 'The old app lists suppliers with “Sync now”; the only feed type is sample data.', source: 'PUR-01' }),
        o('po-feed', 'Supplier catalogue', 'Staff', 'Browse Madison, ZyroFisher and Raleigh products with live price and stock, and add them.', ['Search the feed', 'Cost, price, supplier stock', 'Add to stock or to an order'], { today: 'The old app has a review queue of feed items to import or ignore.', source: 'Release 2 piece 5 · INV-10' }),
      ] },
      { label: 'Orders', screens: [
        o('po-list', 'Purchase orders', 'Staff', 'Every order and where it has got to.', ['Draft, sent, part received, received'], { today: 'The old app has a list with a status filter.', source: 'PUR-02' }),
        o('po-edit', 'Draft a purchase order', 'Staff', 'Build an order to a supplier.', ['Supplier', 'Lines with quantity and cost'], { today: 'The old app has a draft form.', source: 'PUR-02' }),
        g('po-send', 'Send the order', 'Staff', 'Email or submit the order to the supplier.', ['Preview', 'Send'], { source: 'PUR-05' }),
        g('po-suggest', 'Reorder suggestions', 'Manager', '“You usually sell 10 of these in spring, you have 2.”', ['Suggested quantities', 'Add to an order'], { source: 'Release 2 piece 9 · REP-02' }),
      ] },
      { label: 'Delivery', screens: [
        o('po-receive', 'Receive a delivery', 'Staff', 'Book in what arrived, including part deliveries.', ['Quantities received per line', 'Serial numbers for bikes'], { today: 'The old app has a receive window without serial numbers.', source: 'PUR-03 · PUR-04 · INV-07' }),
        g('po-invoice', 'Check the supplier invoice', 'Manager', 'Match the invoice to what was ordered and received.', ['Differences in price or quantity'], { source: 'PUR-07' }),
        o('po-labels', 'Print labels', 'Staff', 'Barcode and shelf labels for what came in.', ['Label size', 'Printer', 'Quantities'], { today: 'The old app prints product barcode stickers.', source: 'INV-08 · HW-02' }),
      ] },
    ],
  },
  {
    id: 'j14', name: 'Stock take and stock control', who: 'Staff and Manager',
    rows: [
      { label: 'Products', screens: [
        o('stock-list', 'Stock list', 'Staff', 'Every product with price, cost, margin and stock.', ['Search and filter', 'Stock by site'], { today: 'The old “Stockroom” tab has search, filters and bulk label printing.', source: 'INV-01' }),
        o('stock-product', 'Product page', 'Staff', 'Everything about one product.', ['Photos and description', 'Price, cost, VAT', 'Stock by site', 'Stock history'], { today: 'The old product page has no photo or stock history.', source: 'INV-04' }),
        g('stock-variants', 'Sizes and colours', 'Manager', 'Set up a product’s sizes and colours, each with its own stock and barcode.', ['Size and colour grid'], { source: 'INV-06 · Release 2 rule 3' }),
        g('stock-serials', 'Serial numbers', 'Staff', 'Every bike by frame number: in stock, sold, to whom.', ['Search by serial', 'History'], { source: 'INV-07' }),
        g('stock-pricing', 'Price rules', 'Manager', 'Reprice many products at once.', ['Margin rules', 'Bulk change with preview'], { source: 'INV-11' }),
      ] },
      { label: 'Across sites', screens: [
        g('stock-sites', 'Stock by site', 'Manager', 'How many of each product at each shop.', ['Per-site columns'], { source: 'INV-12' }),
        g('stock-transfer', 'Transfer between sites', 'Staff', 'Send stock from one shop to another.', ['Send', 'In transit', 'Receive'], { source: 'Release 2 piece 2' }),
      ] },
      { label: 'Stock take', screens: [
        g('take-start', 'Start a stock take', 'Manager', 'Choose what to count.', ['Whole shop, a section or a category'], { source: 'INV-05' }),
        g('take-count', 'Count', 'Staff', 'Scan or type counts, ideally on a phone.', ['Scan to count', 'Running total'], { source: 'INV-05' }),
        g('take-diff', 'Differences', 'Manager', 'What the count found against what the system expected.', ['Over and under, with value'], { source: 'INV-05 · piece 2 (compare with Citrus Lime)' }),
        g('take-post', 'Apply the count', 'Manager', 'Correct stock to the count, with a record of the change.', ['Summary', 'Apply'], { source: 'INV-05' }),
      ] },
      { label: 'Corrections', screens: [
        o('stock-adjust', 'Adjust stock', 'Staff', 'Correct one product’s stock with a reason.', ['New quantity', 'Reason'], { today: 'The old app has an adjust window.', source: 'INV-03' }),
        g('stock-check', 'Check these (below zero)', 'Manager', 'Products sold below zero, so someone can count them.', ['One line per product', 'Mark resolved'], { source: 'Offline spec §5 (data built)' }),
      ] },
    ],
  },
  {
    id: 'j15', name: 'Customer service', who: 'Staff and Manager',
    rows: [
      { label: 'Customers', screens: [
        d('customers'), d('customer-record'), d('duplicates'),
        g('cust-history', 'One history per customer', 'Staff', 'Sales and workshop jobs together for each customer.', ['Timeline of sales and jobs', 'Bikes'], { today: 'The old customer page shows bikes and texts, but not jobs or quotes.', source: 'CUS-03 · CUS-04 · piece 4' }),
        o('cust-groups', 'Customer groups', 'Manager', 'Groups that get a discount, such as club members.', ['Group name and discount'], { today: 'The old app has a groups table.', source: 'CUS-02' }),
      ] },
      { label: 'Loyalty and accounts', screens: [
        g('cust-loyalty', 'Loyalty points', 'Staff', 'See and adjust a customer’s points.', ['Balance', 'History', 'Adjust with reason'], { source: 'Release 2 piece 4' }),
        g('cust-account', 'Credit account', 'Manager', 'Limit, statement and payments on account.', ['Limit', 'Statement', 'Take a payment', 'Over the limit'], { source: 'Release 2 piece 4 · offline default 3' }),
        g('cust-consent', 'Marketing permission', 'Staff', 'Whether a customer agreed to marketing, and when.', ['Permission and date'], { source: 'CUS-06' }),
        g('cust-privacy', 'Privacy requests', 'Manager', 'Handle a request for a copy of, or deletion of, a customer’s data.', ['Request', 'Export', 'Delete'], { source: 'LEG-09' }),
      ] },
    ],
  },
  {
    id: 'j16', name: 'End-of-day cash-up', who: 'Staff and Manager',
    rows: [
      { label: 'Closing', screens: [
        g('eod-synced', 'All tills sent their sales', 'Manager', 'Check every till has sent its sales before cashing up.', ['Tills with sales waiting'], { source: 'Offline spec §8' }),
        g('eod-attention', 'Needs attention', 'Manager', 'Sales the server recorded but flagged.', ['Unknown product or customer', 'Payments that don’t add up', 'Reused receipt number'], { source: 'Offline plan 1 (data built)' }),
        g('eod-count', 'Cash count', 'Staff', 'Count each till’s cash.', ['Expected, counted, difference'], { source: 'TILL-14 · TILL-15' }),
        g('eod-banking', 'Paid-outs and banking', 'Manager', 'Cash taken out during the day and cash to bank.', ['Paid-outs with reasons', 'To bank'], { source: 'TILL-14' }),
        g('eod-card', 'Card totals check', 'Staff', 'Compare card sales with the card machine’s own total.', ['Wheelhouse card total', 'Card machine total', 'Difference'], { source: 'Implied: the card machine is standalone' }),
        g('eod-z', 'End-of-day report', 'Manager', 'The day’s summary, printed or saved.', ['Sales by payment type', 'VAT', 'Refunds and voids'], { source: 'TILL-14' }),
      ] },
    ],
  },
  {
    id: 'j17', name: 'Reports and accounts', who: 'Manager and Owner',
    rows: [
      { label: 'Reports', screens: [
        o('rep-today', 'Today', 'Manager', 'How today is going.', ['Takings', 'Low stock', 'Top sellers', 'Workshop today'], { today: 'The old dashboard shows takings, low stock and top sellers, and nothing from the workshop.', source: 'REP-01..03' }),
        g('rep-sales', 'Sales report', 'Manager', 'Sales for any date range, by site, category or staff.', ['Date range', 'Breakdowns', 'Export'], { source: 'REP-04' }),
        g('rep-margin', 'Margin and stock value', 'Manager', 'Profit and what stock is worth.', ['Margin by category', 'Stock value'], { source: 'Release 2 piece 6' }),
        g('rep-vat', 'VAT summary', 'Owner', 'Figures for the VAT return.', ['Output VAT by rate'], { source: 'REP-05' }),
        g('rep-workshop', 'Workshop report', 'Manager', 'Jobs done, time, and how full the workshop was.', ['Throughput', 'Utilisation'], { source: 'REP-06..08' }),
        g('rep-customers', 'Returning customers', 'Manager', 'How many customers come back.', ['Retention over time'], { source: 'REP-10' }),
      ] },
      { label: 'Accounts software', screens: [
        g('acc-connect', 'Connect Xero or QuickBooks', 'Owner', 'Link the shop’s accounts software.', ['Choose Xero or QuickBooks', 'Connect'], { source: 'Release 2 piece 6' }),
        g('acc-map', 'Match accounts', 'Owner', 'Which account each kind of sale and payment goes to.', ['Account for each category and payment type'], { source: 'Release 2 piece 6' }),
        g('acc-log', 'Sent to accounts', 'Owner', 'What was sent and anything that failed.', ['Daily postings', 'Errors to fix'], { source: 'Release 2 piece 6' }),
      ] },
    ],
  },
  {
    id: 'j18', name: 'Website management', who: 'Manager',
    rows: [
      { label: 'Design the website', screens: [
        o('site-settings', 'Website settings', 'Manager', 'Turn the website on, and set its name, logo and pictures.', ['On or off', 'Logo, hero image, tagline'], { today: 'The old settings panel has five colour choices, logo and hero image.', source: 'Release 2 piece 7' }),
        g('site-theme', 'Theme editor', 'Manager', 'Deep customisation within the theme system: layout, sections, colours, fonts, images.', ['Sections to add and reorder', 'Colours and fonts', 'Live preview'], { source: 'Release 2 rule 6 · Jack’s main complaint about Citrus Lime' }),
        g('site-pages', 'Pages', 'Manager', 'About, contact and other pages.', ['Page list', 'Edit a page'], { source: 'Implied by Release 2 piece 7' }),
        g('site-publish', 'Preview and publish', 'Manager', 'See changes before customers do.', ['Preview', 'Publish'], { source: 'Implied by Release 2 piece 7' }),
        g('site-domain', 'Own web address', 'Owner', 'Use the shop’s own domain name.', ['Domain', 'Connection check'], { source: 'ECOM-03' }),
        o('site-shopify', 'Shopify connection (to retire)', 'Manager', 'Release 2 replaces Shopify with Wheelhouse’s own website.', [], { today: 'The old app connects to Shopify for the website basket.', source: 'Release 2 decision: website built into Wheelhouse' }),
      ] },
      { label: 'Online orders', screens: [
        g('site-payments', 'Online payments setup', 'Owner', 'Connect a payment provider for online sales.', ['Provider', 'Test payment'], { source: 'PAY-05' }),
        g('site-orders', 'Online orders', 'Staff', 'Every online order and its status.', ['New, picking, ready, collected or sent'], { source: 'ECOM-04' }),
        g('site-collect', 'Click and collect queue', 'Staff', 'Pick orders and tell customers they are ready.', ['To pick', 'Ready: notify customer'], { source: 'ECOM-04' }),
        g('site-refund', 'Refund an online order', 'Manager', 'Give money back for an online order.', ['Items', 'Refund to card'], { source: 'PAY-06' }),
      ] },
    ],
  },
  {
    id: 'j19', name: 'Multiple sites', who: 'Owner and Manager',
    rows: [
      { label: 'Across sites', screens: [
        g('multi-switch', 'Site switcher', 'Staff', 'Which shop you are working in, on every staff screen.', ['Current site', 'Switch site'], { source: 'Release 2 rule 3 · ACC-09' }),
        g('multi-reports', 'Reports and cash-up by site', 'Manager', 'Every report and cash-up for one site or all of them.', ['Site filter'], { source: 'ACC-09' }),
        g('multi-tills', 'Tills across sites', 'Manager', 'All tills at all sites, from anywhere.', ['By site: last sync, sales waiting'], { source: 'Offline spec §8' }),
      ] },
    ],
  },
  {
    id: 'j20', name: 'Management oversight', who: 'Owner',
    rows: [
      { label: 'Oversight', screens: [
        g('ops-audit', 'Activity log', 'Owner', 'Who changed a price, voided a sale or edited a job.', ['Who, what, when', 'Filter by person or kind'], { source: 'ACC-08' }),
        g('ops-devices', 'Signed-in devices', 'Owner', 'See where people are signed in and sign a device out.', ['Devices and tills', 'Sign out'], { source: 'ACC-07' }),
        g('ops-feedback', 'Send feedback', 'Staff', 'Tell us what is wrong or missing, from inside Wheelhouse.', ['Message', 'Screenshot'], { source: 'FD-06' }),
      ] },
    ],
  },
  {
    id: 'j21', name: 'Lightspeed shops (Release 1)', who: 'Manager and Staff',
    rows: [
      { label: 'Connection and handoff', screens: [d('connect'), d('connect-proof'), d('pos'), d('pos-done'), d('pos-unknown')] },
    ],
  },
];
