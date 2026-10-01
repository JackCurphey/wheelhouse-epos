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
// sd15(id, title, role) = an agreed journey 15 screen (customer.mjs, Soft sand).
export const sd15 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'customer' });
// sd5(id, title, role) = an agreed journey 5 screen (collect.mjs, Soft sand).
export const sd5 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'collect' });
// sd9(id, title, role) = an agreed journey 9 screen (moving.mjs, Soft sand).
export const sd9 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'moving' });
// sd10(id, title, role) = an agreed journey 10 screen (opening.mjs, Soft sand).
export const sd10 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'opening' });
// sd13(id, title, role) = an agreed journey 13 screen (receiving.mjs, Soft sand).
export const sd13 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'receiving' });
// sd14(id, title, role) = an agreed journey 14 screen (stock.mjs, Soft sand).
export const sd14 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'stock' });
// sd3(id, title, role) = an agreed journey 3 screen (book.mjs, Soft sand).
export const sd3 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'book' });
// sd4(id, title, role) = an agreed journey 4 screen (quote.mjs, Soft sand).
export const sd4 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'quote' });

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
    id: 'j03', name: 'Book a repair', who: 'Customer, Staff and Manager',
    rows: [
      { label: "Booking", screens: [
        sd3("bk-service", "Book a repair: every service at once", "Customer"),
        sd3("bk-service-many", "A shop with many single jobs: search them", "Customer"),
        sd3("bk-bike", "Your bike, and what to look at", "Customer"),
        sd3("bk-bike-signed-in", "Signed in, in a shop that takes a deposit", "Customer"),
        sd3("bk-not-sure", "Not sure what’s wrong: tell us what you’ve noticed", "Customer"),
        sd3("bk-when", "When: Earliest, then a strip of days and times", "Customer"),
        sd3("bk-when-full", "A full day says why", "Customer"),
        sd3("bk-when-dropoff", "A shop that takes drop-off days: the window and the mechanic", "Customer"),
        sd3("bk-details", "Your details, and how to send updates", "Customer"),
        sd3("bk-details-deposit", "Pay the deposit and send", "Customer"),
      ] },
      { label: "Sending", screens: [
        sd3("bk-sending", "Sending", "Customer"),
        sd3("bk-card-failed", "The card didn’t go through", "Customer"),
        sd3("bk-not-sent", "Not sent yet — everything kept", "Customer"),
        sd3("bk-checking-payment", "The connection dropped after paying: checking, not paying again", "Customer"),
        sd3("bk-resume", "Coming back: carry on where you left off", "Customer"),
        sd3("bk-request", "Request received: waiting for the shop", "Customer"),
        sd3("bk-confirmed", "Confirmed straight away (the shop’s setting)", "Customer"),
      ] },
      { label: "Your booking", screens: [
        sd3("bk-bookings", "Signed in: Your bookings", "Customer"),
        sd3("bk-page-request", "The booking’s page while it’s still a request", "Customer"),
        sd3("bk-offered", "The shop suggests another time: accept, or cancel", "Customer"),
        sd3("bk-page", "The booking’s page, confirmed", "Customer"),
        sd3("bk-page-dropoff", "A drop-off booking, no deposit, the mechanic picked", "Customer"),
        sd3("bk-change", "Change the date, in place", "Customer"),
        sd3("bk-change-pending", "New date waiting for the shop", "Customer"),
        sd3("bk-change-declined", "The shop couldn’t do the new date", "Customer"),
      ] },
      { label: "Cancelling", screens: [
        sd3("bk-cancel", "Cancel: the deposit comes back", "Customer"),
        sd3("bk-cancel-late", "Cancel after the cut-off: the deposit is kept", "Customer"),
        sd3("bk-cancelled", "Cancelled, deposit refunded", "Customer"),
        sd3("bk-cancelled-late", "Cancelled after the cut-off, deposit kept", "Customer"),
        sd3("bk-declined", "The shop couldn’t fit it in", "Customer"),
        sd3("bk-expired", "The link, 30 days after the booked date", "Customer"),
        sd3("bk-unavailable", "Online booking unavailable", "Customer"),
      ] },
      { label: "The shop’s side", screens: [
        sd3("bk-staff-request", "The diary: a request with a deposit", "Staff"),
        sd3("bk-staff-decline", "Declining it refunds the deposit", "Staff"),
        sd3("bk-messages", "Settings › Front desk › Messages: the booking messages", "Manager"),
        sd3("bk-settings", "Settings › Workshop › Online booking", "Manager"),
        sd3("bk-settings-deposits", "Online booking, scrolled: deposits and terms", "Manager"),
      ] },
    ],
  },
  {
    id: 'j04', name: 'Drop off and approve the quote', who: 'Customer and Staff',
    rows: [
      { label: "While the bike is in", screens: [
        sd4("dq-in-shop", "The job’s page once the bike is in: where it is, when it’s ready", "Customer"),
        sd4("dq-waiting-part", "Waiting for a part", "Customer"),
        sd4("dq-ready", "Ready to collect (journey 5): the same page, at Ready", "Customer"),
      ] },
      { label: "The quote", screens: [
        sd4("dq-quote", "A quote to answer: ticked the way the mechanic recommends", "Customer"),
        sd4("dq-quote-photo", "A line’s photo, enlarged", "Customer"),
        sd4("dq-quote-untick", "Ticking the optional line: the total follows", "Customer"),
        sd4("dq-quote-decline", "Unticking the needed pair: what happens without it", "Customer"),
        sd4("dq-quote-deposit", "A quote after a deposit: still to pay", "Customer"),
        sd4("dq-quote-reminded", "After the reminder: when it was sent, and reminded", "Customer"),
        sd4("dq-quote-newer", "The quote has changed: earlier answers kept", "Customer"),
        sd4("dq-withdrawn", "The shop withdrew the quote", "Customer"),
      ] },
      { label: "Answered", screens: [
        sd4("dq-answered", "Answered: the work carries on", "Customer"),
        sd4("dq-answered-declined", "Answered no thanks to all of it", "Customer"),
        sd4("dq-answered-deposit", "Answered, with the deposit taken off", "Customer"),
        sd4("dq-answered-by-phone", "Answered by phone, recorded by the shop", "Customer"),
      ] },
      { label: "The shop’s side", screens: [
        sd4("dq-job-quote", "Job page: each new line Needed or Optional, its reason, a photo, what it goes with", "Staff"),
        sd4("dq-job-sent", "Sending the quote, with Undo for a minute", "Staff"),
        sd4("dq-today-no-answer", "Today: no answer to a quote", "Staff"),
        sd4("dq-record-answer", "Record their answer, from a phone call", "Staff"),
        sd4("dq-job-withdraw", "Withdraw the quote", "Staff"),
        sd4("dq-job-answered", "The job page once answered: approved and declined", "Staff"),
        sd4("dq-job-waiting", "The job page: waiting for a part (Workshop day)", "Staff"),
        sd4("dq-messages", "Settings › Front desk › Messages: the quote and its reminder", "Manager"),
      ] },
      { label: 'Also in this journey', screens: [d('customer-message'), d('preferences')] },
    ],
  },
  {
    id: 'j05', name: 'Collect the bike and pay', who: 'Customer',
    rows: [
      { label: "The customer’s link", screens: [
        sd5("cp-summary", "The “Bike ready” link: what we did, and Pay now", "Customer"),
        sd5("cp-summary-deposit", "The same link, after a deposit: only the rest to pay", "Customer"),
        sd5("cp-pay", "Pay online", "Customer"),
        sd5("cp-pay-failed", "Pay online: the card didn’t go through", "Customer"),
        sd5("cp-paid", "Paid — see you soon", "Customer"),
        sd5("cp-summary-paid", "The link opened again after paying", "Customer"),
        sd5("cp-summary-counter", "The link while it’s being paid at the counter", "Customer"),
        sd5("cp-summary-inshop", "The same link, for a shop without online payments", "Customer"),
        sd5("cp-expired", "The link, [n] days after collection", "Customer"),
      ] },
      { label: "At the counter", screens: [
        sd5("cp-ready-unpaid", "At the counter, not paid: Take payment", "Staff"),
        sd5("cp-ready-deposit", "At the counter, deposit paid: the rest to pay", "Staff"),
        sd5("cp-till", "The till: the job’s lines locked, collected when paid", "Staff"),
        sd5("cp-ready-paid", "At the counter, paid online: Hand over", "Staff"),
        sd5("cp-ready-ticks", "Hand over, with hand-back reminders switched on", "Staff"),
        sd5("cp-collected", "Collected, with Undo for a few minutes", "Staff"),
      ] },
      { label: "Not collected", screens: [
        sd5("cp-today-uncollected", "Today: a ready bike left too long", "Manager"),
      ] },
      { label: "Settings", screens: [
        sd5("cp-setting", "Settings › Workshop › Collection: reminder, flag, hand-back", "Manager"),
        sd5("cp-messages", "Settings › Front desk › Messages: “Bike still waiting”", "Manager"),
        sd5("cp-message-wording", "“Bike still waiting”: the wording", "Manager"),
      ] },
      { label: 'Also at collection', screens: [
        d('ready'),
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
        sd8("set-list", "Settings on a phone: the list of rooms", "Manager"),
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
      { label: "Bring your data", screens: [
        sd9("mv-start", "Bring your data: the files to drop in", "Owner"),
        sd9("mv-progress", "Bringing it across (starts by itself)", "Owner"),
        sd9("mv-progress-failed", "A file Wheelhouse couldn’t read", "Owner"),
        sd9("mv-summary", "Here’s what came across", "Owner"),
        sd9("mv-fix", "The few that need a look", "Owner"),
        sd9("mv-sorted", "Everything’s sorted", "Owner"),
      ] },
      { label: "Run alongside", screens: [
        sd9("mv-today-refresh", "Today: time to refresh from Citrus Lime", "Owner"),
        sd9("mv-alongside", "Run alongside: the weekly refresh", "Owner"),
        sd9("mv-change-day", "Change the refresh day", "Owner"),
        sd9("mv-both", "Changed in both: Citrus Lime’s kept", "Owner"),
        sd9("mv-check", "The weekly check: each figure checks itself", "Owner"),
        sd9("mv-check-result", "The weekly check: three match, one doesn’t", "Owner"),
      ] },
      { label: "Practice at the till", screens: [
        sd9("mv-practice-sale", "The till before switch-over: practice, not real money", "Staff"),
        sd9("mv-practice-card", "A practice card payment: try either outcome", "Staff"),
      ] },
      { label: "Switch over", screens: [
        sd9("mv-ready", "Switch over: the checklist, two still to do", "Owner"),
        sd9("mv-weeks", "Change how many weeks must match (2 by default)", "Owner"),
        sd9("mv-ready-all", "Switch over: everything ticked", "Owner"),
        sd9("mv-pick-day", "Pick switch-over day", "Owner"),
        sd9("mv-morning", "Switch-over morning: last refresh, then clear practice and go real", "Owner"),
        sd9("mv-go-real", "Clear practice sales and go real?", "Owner"),
        sd9("mv-week", "The first full week on Wheelhouse", "Owner"),
        sd9("mv-week-done", "A full week done: Citrus Lime can go", "Owner"),
      ] },
    ],
  },
  {
    id: 'j10', name: 'Opening the shop and checking in', who: 'Staff and Manager',
    rows: [
      { label: "Opening the till", screens: [
        sd10("op-float-check", "First in: a one-tap float check", "Staff"),
        sd10("op-float-count", "Count it: note by note", "Staff"),
        sd10("op-float-matched", "The count matches: the till is ready", "Staff"),
        sd10("op-float-short", "The float is short", "Staff"),
        sd10("op-float-over", "The float is over", "Staff"),
      ] },
      { label: "Office › Today", screens: [
        sd10("op-today", "Office › Today: the start of the day", "Manager"),
        sd10("op-today-short", "Today, with a short float to check", "Manager"),
        sd10("op-today-seen", "Today, after the short float is marked Seen", "Manager"),
        sd10("op-today-waiting", "Today, with sales waiting to send", "Manager"),
        sd10("op-today-unclosed", "Today, when yesterday wasn’t closed", "Manager"),
        sd10("op-close-yesterday", "“Close it”: yesterday’s close the day", "Manager"),
        sd10("op-today-two", "Today, with two things to deal with", "Manager"),
        sd10("op-today-staff", "Today, as Staff see it", "Staff"),
        sd10("op-today-late", "Today, when someone due in is late", "Manager"),
      ] },
      { label: 'Also at the start of the day', screens: [
        g('open-start', 'Till start-up', 'Staff', 'What a registered till shows when it opens.', ['Site and till code', 'Connected, or offline with sales waiting', 'Last updated'], { source: 'Offline spec §5' }),
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
      { label: "Receiving a delivery", screens: [
        sd13("rs-hub", "Stockroom › Deliveries and orders", "Manager"),
        sd13("rs-hub-empty", "Deliveries and orders, for a shop that orders on supplier websites", "Manager"),
        sd13("rs-hub-staff", "Deliveries and orders, as Staff see it", "Staff"),
        sd13("rs-receive", "Receive a delivery: scan each item", "Staff"),
        sd13("rs-add-product", "A barcode Wheelhouse doesn’t know: Add this product, with its measurements", "Staff"),
        sd13("rs-problem", "Something wrong with an item: damaged, wrong or missing", "Staff"),
        sd13("rs-frame", "A bike in the delivery: its frame number first", "Staff"),
        sd13("rs-frame-dup", "A frame number already in stock", "Staff"),
        sd13("rs-receive-marked", "Ready to book in: one item set aside, a bike with its frame numbers", "Staff"),
        sd13("rs-book-blocked", "Book in with an unknown barcode still on the list", "Staff"),
        sd13("rs-booked", "Delivery booked in: the waiting job flagged, what’s next", "Manager"),
        sd13("rs-labels", "Print labels: only what needs one", "Manager"),
      ] },
      { label: "The waiting job", screens: [
        sd13("rs-job-arrived", "The job: its part has arrived", "Staff"),
        sd13("rs-diary-arrived", "The diary: “Part arrived” on the job’s block", "Staff"),
        sd13("rs-overview-arrived", "Workshop Overview: “Part arrived” on the job’s row", "Staff"),
      ] },
      { label: "Checking the invoice", screens: [
        sd13("rs-delivery", "A booked-in delivery, waiting for its invoice", "Manager"),
        sd13("rs-invoice", "Add the invoice: its total against what was booked in", "Manager"),
        sd13("rs-invoice-checked", "The invoice matches: checked", "Manager"),
        sd13("rs-invoice-diff", "The invoice doesn’t match: the difference, to query", "Manager"),
        sd13("rs-invoice-queried", "Queried with the supplier", "Manager"),
        sd13("rs-invoice-accepted", "The difference accepted, with Undo", "Manager"),
        sd13("rs-delivery-staff", "A delivery, as Staff see it: no costs, no invoice", "Staff"),
        sd13("rs-invoice-setting", "Settings › Stockroom: the invoice check, on or off", "Manager"),
      ] },
      { label: "Ordering", screens: [
        sd13("rs-order", "A purchase order, built by hand", "Manager"),
        sd13("rs-order-ordered", "An order, partly delivered: receive against it, or close it", "Manager"),
        sd13("rs-restock", "Restock list: by supplier, a download for each basket", "Manager"),
        sd13("rs-today-restock", "Today: new on the restock list", "Manager"),
      ] },
      { label: 'Also in this journey', screens: [
        o('po-suppliers', 'Suppliers', 'Manager', 'Each supplier and its product feed.', ['Supplier details', 'Feed status and last sync'], { today: 'The old app lists suppliers with “Sync now”; the only feed type is sample data.', source: 'PUR-01' }),
        o('po-feed', 'Supplier catalogue', 'Staff', 'Browse Madison, ZyroFisher and Raleigh products with live price and stock, and add them.', ['Search the feed', 'Cost, price, supplier stock', 'Add to stock or to an order'], { today: 'The old app has a review queue of feed items to import or ignore.', source: 'Release 2 piece 5 · INV-10' }),
        g('po-send', 'Send the order', 'Staff', 'Email or submit the order to the supplier.', ['Preview', 'Send'], { source: 'PUR-05' }),
      ] },
    ],
  },
  {
    id: 'j14', name: 'Stock take and stock control', who: 'Staff and Manager',
    rows: [
      { label: "Finding stock", screens: [
        sd14("st-list", "Stockroom › Stock: search, filters, tick boxes, every product", "Manager"),
        sd14("st-list-staff", "Stock as Staff see it: no cost or margin", "Staff"),
        sd14("st-search-measure", "Searching by a measurement: “bearing 30 mm”", "Manager"),
        sd14("st-filter-bearings", "A category picked: bearings, its details as columns", "Manager"),
        sd14("st-filter-derailleurs", "A category picked: derailleurs, number of gears", "Manager"),
        sd14("st-search-size", "Searching a size: that size and colour", "Manager"),
        sd14("st-list-none", "Nothing matches the search", "Manager"),
        sd14("st-list-unknown", "A barcode Wheelhouse doesn’t know", "Manager"),
        sd14("st-list-new", "A new shop: no products yet", "Manager"),
      ] },
      { label: "Categories and their details", screens: [
        sd14("st-categories", "Settings › Stockroom › Categories: each with its own details", "Manager"),
        sd14("st-category-edit", "Editing a category: Derailleurs, its choices and units", "Manager"),
      ] },
      { label: "A product", screens: [
        sd14("st-product", "A product’s page: stock first, history with links", "Manager"),
        sd14("st-product-staff", "A product’s page as Staff see it", "Staff"),
        sd14("st-product-bike", "A bike’s page: each frame number, in stock or sold", "Manager"),
        sd14("st-product-sizes", "Sizes and colours: one product, a grid of stock", "Manager"),
      ] },
      { label: "Changing prices", screens: [
        sd14("st-list-ticked", "Ticked products: labels, send, change prices", "Manager"),
        sd14("st-prices", "Change prices: by a percentage, rounded, with a preview", "Manager"),
        sd14("st-prices-done", "Prices changed, with Undo", "Manager"),
      ] },
      { label: "Correcting stock", screens: [
        sd14("st-adjust", "Adjust stock: the change or the count after it, and a reason", "Staff"),
        sd14("st-today-adjust", "Today: a big adjustment, for the manager", "Manager"),
        sd14("st-setting-adjust", "Settings › Stockroom: when an adjustment shows on Today", "Manager"),
        sd14("st-today-below", "Today: products below zero, with Count them", "Manager"),
        sd14("tk-count-below", "Counting the products below zero: still to find", "Staff"),
      ] },
      { label: "Between shops", screens: [
        sd14("tr-sites", "A product’s stock at each shop, and on its way", "Manager"),
        sd14("tr-send", "Send to another shop", "Staff"),
        sd14("tr-incoming", "Deliveries and orders: on its way, in and out", "Staff"),
        sd14("tr-receive", "Receiving a transfer: one short", "Staff"),
        sd14("tr-today-short", "Today: a transfer arrived short", "Manager"),
      ] },
      { label: "Stock take", screens: [
        sd14("tk-hub", "Stockroom › Stock take: counts in progress and finished", "Manager"),
        sd14("tk-hub-staff", "Stock take as Staff see it: join a count", "Staff"),
        sd14("tk-start", "Start a count: an area, with areas used before", "Manager"),
        sd14("tk-start-category", "Start a count: a category", "Manager"),
        sd14("tk-count", "Counting, without the expected number; a recount asked", "Staff"),
        sd14("tk-diff", "Check the count: largest first, recount, not counted", "Manager"),
        sd14("tk-applied", "Count applied, with Undo", "Manager"),
      ] },
    ],
  },
  {
    id: 'j15', name: 'Customer service', who: 'Staff and Manager',
    rows: [
      { label: "Customers and the customer page", screens: [
        sd15("cs-list", "Customers: find someone, or add them", "Staff"),
        sd15("cs-page", "A customer’s page: details, bikes with warranty, one history", "Staff"),
        sd15("cs-page-over", "Over her account limit", "Staff"),
        sd15("cs-page-new", "A new customer: nothing in the history yet", "Staff"),
        sd15("cs-page-off", "A shop with customer accounts switched off (Payments › Ways to pay)", "Staff"),
        sd15("cs-sale", "A sale from her history: refunds start here", "Staff"),
        sd15("cs-credit", "Add or take away store credit, with a reason", "Staff"),
        sd15("cs-edit", "Edit her details", "Staff"),
        sd15("cs-add", "Add a customer: a person", "Staff"),
        sd15("cs-add-company", "Add a customer: a company or club", "Staff"),
      ] },
      { label: "Accounts (pay later)", screens: [
        sd15("cs-account", "Her account: balance, her limit, statement, pay it off", "Staff"),
        sd15("cs-transfer", "Record a bank transfer", "Staff"),
      ] },
      { label: "Customer groups", screens: [
        sd15("cs-groups", "Settings › Front desk › Payments › Customer groups", "Manager"),
      ] },
      { label: "Privacy requests", screens: [
        sd15("cs-privacy", "Privacy requests: dated, answered within a month", "Manager"),
        sd15("cs-privacy-delete", "Deleting someone’s details: sales stay, without their name", "Manager"),
        sd15("cs-privacy-blocked", "Can’t delete yet: money, credit or a bike still open", "Manager"),
      ] },
      { label: "Possible duplicates", screens: [
        sd15("cs-add-match", "Adding someone who’s already here", "Staff"),
        sd15("cs-page-dup", "A possible duplicate, flagged on the page", "Staff"),
        sd15("cs-merge", "The same person? Keep or merge", "Staff"),
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
