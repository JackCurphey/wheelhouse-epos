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
// sd7(id, title, role) = an agreed journey 7 screen (account.mjs, Soft sand).
export const sd7 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'account' });
// sd19(id, title, role) = an agreed journey 19 screen (sites.mjs, Soft sand).
export const sd19 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'sites' });
// sd17(id, title, role) = an agreed journey 17 screen (reports.mjs, Soft sand).
export const sd17 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'reports' });
// sd2(id, title, role) = an agreed journey 2 screen (online.mjs, Soft sand).
export const sd2 = (id, title, role) => ({ id, status: 'designed', title, role, sand: 'online' });

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
    id: 'j02', name: 'Buy online, or click and collect', who: 'Customer, Staff and Owner',
    rows: [
      { label: "Finding it", screens: [
        sd2("on-product", "A product: ready today at Bolton", "Customer"),
        sd2("on-product-added", "Added to the basket", "Customer"),
        sd2("on-product-two-shops", "Two shops: “Collecting from Bolton”, the item at the other shop", "Customer"),
        sd2("on-product-order-in", "An item the shop orders in", "Customer"),
        sd2("on-product-out", "Not in stock: ask the shop", "Customer"),
        sd2("on-product-out-other", "Not here, but in stock at the other shop", "Customer"),
        sd2("on-product-no-shop", "No shop chosen yet", "Customer"),
        sd2("on-choose-shop", "Which shop will you collect from? (one tap, asked once)", "Customer"),
        sd2("on-product-off", "Buying online switched off", "Customer"),
      ] },
      { label: "Basket and checkout", screens: [
        sd2("on-basket", "The basket", "Customer"),
        sd2("on-basket-changed", "Something in the basket changed", "Customer"),
        sd2("on-basket-empty", "An empty basket, with Undo", "Customer"),
        sd2("on-checkout", "Checkout: how you’ll get it, your details, pay — one page", "Customer"),
        sd2("on-checkout-errors", "Details to check", "Customer"),
        sd2("on-checkout-credit", "Signed in, store credit used", "Customer"),
        sd2("on-checkout-covered", "Store credit covers it all: Place order", "Customer"),
        sd2("on-checkout-gift-code", "A gift card code not recognised", "Customer"),
        sd2("on-checkout-gift", "A gift card used, and what’s left on it", "Customer"),
      ] },
      { label: "Paying", screens: [
        sd2("on-checkout-paying", "Paying — please don’t close this page", "Customer"),
        sd2("on-checkout-bank", "Your bank wants to check it’s you", "Customer"),
        sd2("on-checkout-declined", "Card declined: nothing taken", "Customer"),
        sd2("on-checkout-unsure", "Couldn’t confirm the payment: don’t pay again", "Customer"),
        sd2("on-checkout-sold-out", "Sold out just before paying: nothing taken", "Customer"),
        sd2("on-confirmed", "Order in: order number, what happens next, how you paid", "Customer"),
        sd2("on-save-details", "Save your details: the emailed code", "Customer"),
      ] },
      { label: "Your order", screens: [
        sd2("on-order", "The order’s page: getting it ready", "Customer"),
        sd2("on-order-moving", "On its way from the other shop", "Customer"),
        sd2("on-order-ready", "Ready to collect", "Customer"),
        sd2("on-order-collected", "Collected, with the receipt", "Customer"),
        sd2("on-order-cancel", "Cancel this order? (until it’s ready)", "Customer"),
        sd2("on-order-cancelled", "Cancelled and refunded the way it was paid", "Customer"),
        sd2("on-order-clash", "Cancel pressed just after it was marked ready", "Customer"),
        sd2("on-order-shop-cancelled", "Cancelled by the shop: not collected", "Customer"),
        sd2("on-order-cant-supply", "An item the shop couldn’t supply, refunded", "Customer"),
        sd2("on-email-ready", "The “ready to collect” email", "Customer"),
      ] },
      { label: "The shop’s side", screens: [
        sd2("on-orders", "Front desk › Online orders: to get ready, ready, collected", "Staff"),
        sd2("on-orders-ready", "Marked ready: the email waits a few seconds, with Undo", "Staff"),
        sd2("on-orders-arrived", "The item arrived from the other shop: Mark ready", "Staff"),
        sd2("on-orders-second", "At [Second site]: an item to send to Bolton", "Staff"),
        sd2("on-order-staff", "One order: items, how it was paid, the customer", "Staff"),
        sd2("on-order-staff-ready", "A ready order: Hand over, or not ready after all", "Staff"),
        sd2("on-not-ready", "Not ready after all: a sorry email", "Staff"),
        sd2("on-cant-supply", "Can’t supply an item: refund it, with a reason", "Staff"),
        sd2("on-cancel-refund", "Cancel and refund: the way it was paid, with a reason", "Manager"),
        sd2("on-hand-over", "Hand over: the till’s hand-over for the order", "Staff"),
        sd2("on-hand-over-refunded", "Hand over with one item refunded", "Staff"),
        sd2("on-today", "Today: new online orders", "Manager"),
        sd2("on-today-uncollected", "Today: an order not collected — Contacted or Open", "Manager"),
      ] },
      { label: "Settings", screens: [
        sd2("on-settings", "Settings › Online orders: buying online, what the website sells", "Owner"),
        sd2("on-settings-order-in", "Also things we order in: how long it takes", "Owner"),
        sd2("on-settings-start", "Turning on buying online: start with everything, or nothing", "Owner"),
        sd2("on-settings-show", "Showing products: switches on each category", "Owner"),
        sd2("on-settings-pay", "Paying online, and orders not collected", "Owner"),
        sd2("on-messages", "Settings › Messages: the online order messages", "Owner"),
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
    id: 'j07', name: 'Account, history and reminders', who: 'Customer and Staff',
    rows: [
      { label: "Your account", screens: [
        sd7("ac-account", "Your account: bikes, details and how we contact you; one history", "Customer"),
        sd7("ac-account-lower", "Further down: how we contact you, and your data", "Customer"),
        sd7("ac-account-repairs", "History showing repairs only", "Customer"),
        sd7("ac-account-new", "A new account, with nothing in it yet", "Customer"),
        sd7("ac-receipt", "A receipt, from the history", "Customer"),
        sd7("ac-receipt-sent", "The receipt emailed", "Customer"),
      ] },
      { label: "Talking to the shop", screens: [
        sd7("ac-job-note", "A job’s page: “Add a note for the shop”", "Customer"),
        sd7("ac-job-note-sent", "The note sent, waiting for a reply", "Customer"),
        sd7("ac-job-note-answered", "The shop’s reply, on the job’s page", "Customer"),
        sd7("ac-ask", "Ask the shop a question, from the account", "Customer"),
        sd7("ac-account-question-sent", "The question sent: in the history, waiting", "Customer"),
        sd7("ac-question", "The question and its answer", "Customer"),
        sd7("ac-account-asked", "The history once answered: the note and the question", "Customer"),
      ] },
      { label: "The shop’s side of messages", screens: [
        sd7("ac-inbox-list", "On a phone: the list first", "Staff"),
        sd7("ac-inbox", "Staff Messages: needs a reply, and the open conversation", "Staff"),
        sd7("ac-inbox-sent", "Reply sent the way Maya chose; reply again", "Staff"),
        sd7("ac-inbox-all", "All conversations, “Needs a reply” in words", "Staff"),
        sd7("ac-inbox-empty", "Nothing needs a reply", "Staff"),
        sd7("ac-reply-text", "The text Maya gets, linking back", "Staff"),
        sd7("ac-today", "Today: messages needing a reply, and a request to delete an account", "Manager"),
      ] },
      { label: "Service reminders", screens: [
        sd7("ac-book-remind", "Booking: “Remind me…”, unticked, with a review request", "Customer"),
        sd7("ac-collect-remind", "Ready to collect: the same tick", "Customer"),
        sd7("ac-services", "Settings › Workshop › Services: each service’s reminder", "Manager"),
        sd7("ac-service-edit", "A service’s reminder time", "Manager"),
        sd7("ac-messages", "Settings › Messages: service reminders and review requests", "Manager"),
        sd7("ac-reminder-wording", "The service reminder’s wording; “Stop these” always added", "Manager"),
        sd7("ac-reminder-landing", "The reminder’s link: booking, bike and service chosen, saying why", "Customer"),
      ] },
      { label: "Reviews and how we contact you", screens: [
        sd7("ac-review-first", "Review requests the first time: add a review page, then switch on", "Manager"),
        sd7("ac-review-setting", "Review requests: the review page, when, the wording", "Manager"),
        sd7("ac-contact", "How we contact you", "Customer"),
        sd7("ac-contact-changed", "A switch changed, and said so", "Customer"),
        sd7("ac-stopped", "“Stop these”: stopped in one click, no signing in", "Customer"),
        sd7("ac-stopped-on", "Turned back on", "Customer"),
      ] },
      { label: "Your data", screens: [
        sd7("ac-download", "Download a copy of your data: straight away", "Customer"),
        sd7("ac-download-failed", "The download didn’t start", "Customer"),
        sd7("ac-delete", "Ask us to delete your account: store credit will be lost", "Customer"),
        sd7("ac-delete-blocked", "Can’t delete yet: the bike is still with us", "Customer"),
        sd7("ac-delete-sent", "Deletion request sent", "Customer"),
        sd7("ac-account-delete-pending", "The request on the account, with Cancel my request", "Customer"),
        sd7("ac-account-delete-cancelled", "Request cancelled", "Customer"),
        sd7("ac-privacy-requests", "The shop’s Privacy requests: from the website, and what’s in the way", "Manager"),
        sd7("ac-customer-delete", "The staff customer page: the request, and what’s in the way", "Staff"),
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
    id: 'j17', name: 'Reports and accounts', who: 'Owner, Manager and Staff',
    rows: [
      { label: "Reports", screens: [
        sd17("rp-home", "Reports: the ready-made reports, and your own", "Owner"),
        sd17("rp-home-staff", "Reports for Staff with “Can see reports” (one shop, no costs)", "Staff"),
        sd17("rp-report-menu", "A saved report’s menu: rename, share, delete", "Owner"),
        sd17("rp-report-deleted", "A saved report deleted, with Undo", "Owner"),
        sd17("rp-your-settings", "Your settings › Accessibility (scrolled down): show graphs in reports", "Owner"),
      ] },
      { label: "Sales", screens: [
        sd17("rp-sales", "Sales: this week so far, against the same days last week", "Owner"),
        sd17("rp-sales-all", "Sales for all shops: shop by shop", "Owner"),
        sd17("rp-sales-year", "Sales over 12 months: a line, against the year before", "Owner"),
        sd17("rp-sales-empty", "Nothing sold yet, and nothing to compare with", "Owner"),
        sd17("rp-pick-dates", "Pick dates", "Owner"),
      ] },
      { label: "Your own reports", screens: [
        sd17("rp-change", "Change what’s shown: choices that don’t fit are greyed, with why", "Owner"),
        sd17("rp-changed", "The changed report, with Save as my report", "Owner"),
        sd17("rp-save", "Save as my report: Just me to start", "Owner"),
        sd17("rp-save-taken", "A name you’ve already used", "Owner"),
      ] },
      { label: "Takings and cash-ups", screens: [
        sd17("rp-takings", "Takings and cash-ups: each closed day opens from its row", "Owner"),
        sd17("rp-takings-all", "Takings and cash-ups for all shops", "Owner"),
        sd17("rp-day", "A closed day’s end-of-day report", "Owner"),
        sd17("rp-reopen", "Reopen a closed day: a reason first", "Owner"),
        sd17("rp-takings-reopened", "A reopened day, left out and said so", "Owner"),
      ] },
      { label: "VAT, margin, workshop and discounts", screens: [
        sd17("rp-vat", "VAT for your VAT quarter, against the quarter before", "Owner"),
        sd17("rp-vat-first", "When does your VAT quarter start? (asked once)", "Owner"),
        sd17("rp-vat-all", "VAT for all shops", "Owner"),
        sd17("rp-margin", "Margin and stock value", "Owner"),
        sd17("rp-workshop", "Workshop: jobs, takings, how full, turnaround, quotes", "Owner"),
        sd17("rp-discounts", "Discounts and refunds, with reasons and who gave them", "Owner"),
        sd17("rp-discounts-staff", "Discounts and refunds as Staff see them (without who)", "Staff"),
      ] },
      { label: "Accounts software and who sees what", screens: [
        sd17("rp-accounts-connect", "Settings › Your data › Accounts software: connect", "Owner"),
        sd17("rp-accounts-map", "Which Xero account each line goes to", "Owner"),
        sd17("rp-accounts-missing", "A category with no Xero account", "Owner"),
        sd17("rp-accounts-log", "What was sent: sent, not sent, waiting, not closed yet", "Owner"),
        sd17("rp-accounts-lost", "Xero disconnected: days wait to be sent", "Owner"),
        sd17("rp-accounts-disconnect", "Disconnect Xero", "Owner"),
        sd17("rp-today-accounts", "Today: Wednesday didn’t go to Xero", "Owner"),
        sd17("rp-person", "A person: “Can see reports” on, “Can see costs and margin” off", "Owner"),
      ] },
      { label: 'Still to design', screens: [
        g('rep-customers', 'Returning customers', 'Manager', 'How many customers come back.', ['Retention over time'], { source: 'REP-10' }),
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
      ] },
    ],
  },
  {
    id: 'j19', name: 'Multiple sites', who: 'Owner, Manager and Staff',
    rows: [
      { label: "Choosing a shop", screens: [
        sd19("ms-switch-open", "The shop switcher open: your shops, and “All shops” (owner)", "Owner"),
        sd19("ms-switched", "After switching: “Now working in [Second site]”", "Owner"),
        sd19("ms-today-all", "Today, all shops: a row per shop, one list of what needs you", "Owner"),
        sd19("ms-pick-shop", "“All shops” on the diary: choose one", "Owner"),
        sd19("ms-till-other", "A till sells for its own shop, whatever the menu says", "Staff"),
        sd19("ms-one-shop", "Someone with one shop: its name, no switcher (staff with two shops get their shops, no “All shops”)", "Staff"),
      ] },
      { label: "Prices and services by shop", screens: [
        sd19("ms-service-price", "A service: price for all shops, different at one, where it’s offered", "Owner"),
        sd19("ms-service-not-offered", "Not offered at one shop", "Owner"),
        sd19("ms-services-differs", "Services list at [Second site]: its price beside the all-shops one", "Owner"),
        sd19("ms-product-price", "A product’s price, different at one shop", "Owner"),
      ] },
      { label: "People and booking", screens: [
        sd19("ms-person", "A person: where they work, and workshop days at each shop", "Owner"),
        sd19("ms-book-shop", "Book a repair: “Which shop?” first, nothing chosen", "Customer"),
        sd19("ms-book-shop-chosen", "Came from Bolton’s page: the shop chosen, straight to the service", "Customer"),
        sd19("ms-book-shop-change", "Changing the shop: what it resets", "Customer"),
      ] },
      { label: "Jobs between shops", screens: [
        sd19("ms-job-other-shop", "Booking a job into the other shop’s workshop: it goes as a request", "Staff"),
        sd19("ms-request-from-shop", "At [Second site]: the request, from Bolton, to accept", "Mechanic"),
      ] },
      { label: "Adding a shop, and its tills", screens: [
        sd19("ms-sites", "Settings › Shop and sites: each shop (owner)", "Owner"),
        sd19("ms-sites-manager", "The same, as a manager sees it", "Manager"),
        sd19("ms-add-shop", "Add a shop: code suggested, hours copied", "Owner"),
        sd19("ms-add-shop-error", "A code another shop already uses", "Owner"),
        sd19("ms-today-new", "Today at a new shop: what to do next", "Owner"),
        sd19("ms-tills", "Settings › Till › Tills: every till, by shop", "Owner"),
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
