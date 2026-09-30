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
export const sd = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'diary' });
// sa(id, title, role) = an agreed journey A screen (app-map.mjs, Soft sand);
// build.mjs reads its boards (whatever sizes it has) from out-app-map-sand/.
export const sa = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'app-map' });
// sb(id, title, role) = an agreed journey B screen (signin.mjs, Soft sand).
export const sb = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'signin' });
// sc(id, title, role) = an agreed journey 11 screen (till.mjs, Soft sand).
export const sc = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'till' });
// sd16(id, title, role) = an agreed journey 16 screen (cashup.mjs, Soft sand).
export const sd16 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'cashup' });
// sd8(id, title, role) = an agreed journey 8 screen (setup.mjs, Soft sand).
export const sd8 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'setup' });

export const journeys = [
  {
    id: 'ja', num: 'A', name: 'App map and navigation', who: 'Everyone',
    rows: [
      { label: 'App map', screens: [sa('map', 'How Wheelhouse fits together', 'Everyone')] },
      { label: 'Staff app', screens: [
        sa('staff-app', 'Staff app: search on every page, your name opens Your settings', 'Staff'),
        sa('staff-app-mechanic', 'Staff app: a mechanic sees only the Workshop room', 'Mechanic'),
        sa('staff-app-menu', 'Staff app: phone menu open', 'Staff'),
      ] },
      { label: 'Till mode', screens: [
        sa('till-rail', 'Till: sidebar folded to the rail', 'Staff'),
        sa('till-rail-open', 'Till: rail unfolded', 'Staff'),
        sa('till-search', 'Till: one search finds products, customers and jobs', 'Staff'),
      ] },
      { label: 'Your settings', screens: [sa('your-settings', 'Your settings', 'Everyone')] },
      { label: 'Customer website', screens: [
        sa('site', 'Customer website: default theme', 'Customer'),
        sa('site-menu', 'Customer website: phone menu open', 'Customer'),
        sa('site-ocean', 'Customer website: a shop’s own theme', 'Customer'),
        sa('site-ocean-menu', 'Customer website: phone menu, shop’s own theme', 'Customer'),
      ] },
    ],
  },
  {
    id: 'jb', num: 'B', name: 'Signing in and access', who: 'Staff and customers',
    rows: [
      { label: 'Staff sign-in (WorkOS)', screens: [sb('workos-signin', 'Sign in (WorkOS’s page, approximate look)', 'Staff')] },
      { label: 'Staff access', screens: [
        sb('auth-site', 'Where are you working today?', 'Staff'),
        sb('auth-signedout', 'Signed out', 'Staff'),
        sb('auth-expired', 'Signed out after a while', 'Staff'),
        sb('auth-noaccess', 'Not part of your role', 'Staff'),
      ] },
      { label: 'Till', screens: [
        sb('till-setup', 'Set up this till', 'Manager'),
        sb('till-checkin', 'Till check-in: PIN only', 'Staff'),
        sb('till-pin-wrong', 'Till check-in: wrong PIN', 'Staff'),
        sb('pin-change', 'Your new till PIN', 'Staff'),
      ] },
      { label: 'Customers', screens: [
        sb('cust-signin', 'Sign in to your account', 'Customer'),
        sb('cust-code', 'Enter your code', 'Customer'),
        sb('cust-code-expired', 'Code expired', 'Customer'),
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
      { label: "First-run setup", screens: [
        sd8("fr-today", "Getting started: the owner’s checklist on Today", "Owner"),
        sd8("fr-step", "A step opened from the checklist", "Owner"),
        sd8("fr-done", "All set up: the checklist goes", "Owner"),
      ] },
      { label: "Till settings", screens: [
        sd8("set-list", "Settings on a phone: the list of areas", "Manager"),
        sd8("set-till-quick", "Till › Quick buttons: hover a button to edit or remove it", "Manager"),
        sd8("set-till-quick-add", "Add a quick button", "Manager"),
        sd8("set-till-quick-saved", "Saved as you go, with Undo", "Manager"),
        sd8("set-till-reasons", "Till › Reasons: a list for each kind", "Manager"),
        sd8("set-till-receipts", "Till › Receipts", "Manager"),
        sd8("set-till-printer", "Till › Printer and cash drawer", "Manager"),
        sd8("set-till-tills", "Till › Tills: as a Manager sees it", "Manager"),
        sd8("set-till-tills-owner", "Till › Tills: as the owner sees it", "Owner"),
        sd8("set-till-remove", "Removing a till asks first", "Owner"),
        sd8("set-till-empty", "A new shop: no quick buttons yet", "Owner"),
      ] },
      { label: "End of day and payment settings", screens: [
        sd8("set-eod", "End of day: float", "Manager"),
        sd8("set-eod-close", "End of day: Close the day at, or before, closing time", "Manager"),
        sd8("set-save-failed", "A change that couldn’t be saved", "Manager"),
        sd8("set-pay-ways", "Payments › Ways to pay: each on or off", "Manager"),
        sd8("set-pay-other", "Payments › Other ways to pay", "Manager"),
        sd8("set-pay-card", "Payments › Card machine", "Manager"),
      ] },
      { label: "Staff and roles", screens: [
        sd8("set-staff", "Staff and roles › People", "Manager"),
        sd8("set-staff-person", "One person: role, switches, till PIN", "Manager"),
        sd8("set-staff-person-all", "Give everything a Manager can do", "Manager"),
        sd8("set-staff-clear-pin", "Clear a forgotten PIN", "Manager"),
        sd8("set-staff-roles", "Staff and roles › What each role can do", "Manager"),
        sd8("set-staff-invite", "The owner invites someone", "Owner"),
      ] },
      { label: "Shop and sites", screens: [
        sd8("set-shop-details", "Shop and sites › Shop details", "Manager"),
        sd8("set-shop-hours", "Shop and sites › Opening hours", "Manager"),
      ] },
      { label: "Workshop settings", screens: [
        sd8("set-workshop-services", "Workshop › Services, by group", "Manager"),
        sd8("set-workshop-mechanics", "Workshop › Mechanics", "Manager"),
        sd8("set-workshop-diary", "Workshop › Diary blocks and storage slots (journey 12’s settings, moved here)", "Manager"),
      ] },
      { label: "Messages", screens: [
        sd8("set-msg-list", "Messages › Automatic messages: text, email or both", "Manager"),
        sd8("set-msg-edit", "Change a message’s wording, with a preview", "Manager"),
        sd8("set-msg-new", "Add your own automatic message", "Manager"),
      ] },
      { label: "Your data", screens: [
        sd8("set-data-export", "Your data › Download everything", "Manager"),
        sd8("set-data-history", "Your data › Settings changes", "Manager"),
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
      { label: "A sale", screens: [
        sc("till-sale", "Sale: quick buttons by group, basket on the right", "Staff"),
        sc("till-empty", "Empty basket", "Staff"),
        sc("till-noresults", "Search with no results", "Staff"),
        sc("till-line", "Change a line: price, discount with a reason, note, remove", "Staff"),
        sc("till-discount", "Discount the whole sale", "Staff"),
        sc("till-customer", "Add a customer: search, or add someone new", "Staff"),
        sc("till-variant", "Choose size and colour", "Staff"),
        sc("till-serial", "Record a frame number", "Staff"),
      ] },
      { label: "Taking payment", screens: [
        sc("till-pay", "Take payment: card is one tap", "Staff"),
        sc("till-pay-other", "Take payment: Other ways to pay opened", "Staff"),
        sc("till-card", "Card: the amount is on the card machine, waiting for the card", "Staff"),
        sc("till-card-declined", "Card declined", "Staff"),
        sc("till-pay-cash", "Cash: notes to tap, change worked out", "Staff"),
        sc("till-pay-split", "Split payment: part paid, the rest by card", "Staff"),
        sc("till-receipt", "Paid: receipt choices, closes by itself", "Staff"),
      ] },
      { label: "Other ways to pay", screens: [
        sc("till-giftcard", "Gift card or store credit", "Staff"),
        sc("till-account", "Put on account: pay later", "Staff"),
        sc("till-loyalty", "Store credit, earned by buying: shown with the customer in the basket", "Staff"),
        sc("till-deposit", "Take a deposit: part now, the rest later", "Staff"),
      ] },
      { label: "Other till jobs", screens: [
        sc("till-park", "Parked sales: resume", "Staff"),
        sc("till-find", "Past sales: scan the receipt, or today’s list", "Staff"),
        sc("till-sale-detail", "A past sale: refund, reprint, void", "Staff"),
        sc("till-refund", "Refund from the original sale: back to the card", "Staff"),
        sc("till-refund-cash", "Refund a cash sale: back in cash", "Staff"),
        sc("till-refund-noreceipt", "No receipt: store credit only", "Staff"),
        sc("till-void", "Void a sale: with a reason", "Staff"),
        sc("till-job", "Pay for a workshop job: bike collected when paid", "Staff"),
        sc("till-job-deposit", "Deposit on a workshop job: bike stays in", "Staff"),
        sc("till-job-balance", "Workshop job back for collection: deposit taken off, pay the rest", "Staff"),
        sc("till-collect", "Hand over a click and collect order", "Staff"),
      ] },
      { label: "When the internet drops", screens: [
        sc("till-offline", "Offline: keep selling, sales wait to send", "Staff"),
        sc("till-offline-long", "Offline for over four hours: the notice grows", "Staff"),
        sc("till-needs-net", "Needs the internet: refunds and a few others wait", "Staff"),
        sc("till-no-signout", "Can’t sign out while sales are waiting", "Staff"),
        sc("till-failed", "Sales that didn’t send: for a manager", "Manager"),
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
      { label: "Close the day", screens: [
        sd16("eod-entry", "Close the day appears in the till bar after closing time", "Manager"),
        sd16("eod-waiting", "Close the day: a till still has sales waiting", "Manager"),
        sd16("eod-attention", "Close the day: sales that need checking", "Manager"),
        sd16("eod-check", "Checking a flagged sale", "Manager"),
        sd16("eod-count", "Count the cash: note by note (blind)", "Staff"),
        sd16("eod-count-shown", "Count the cash: with the expected amount shown (shop setting)", "Staff"),
        sd16("eod-count-result", "Count the cash: the difference", "Staff"),
        sd16("eod-count-exact", "Count the cash: spot on", "Staff"),
        sd16("eod-banking", "Paid-outs and banking: leave the float, bank the rest", "Manager"),
        sd16("eod-banking-none", "Paid-outs and banking: nothing taken out today", "Manager"),
        sd16("eod-paidout", "Add a paid-out", "Manager"),
        sd16("eod-card", "Card sales don’t match the card machine", "Manager"),
        sd16("eod-finish", "Ready to close the day", "Manager"),
        sd16("eod-z", "Day closed: the end-of-day report", "Manager"),
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
