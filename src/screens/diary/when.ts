// Times as the shop says them, in London's time (the quote's "Sent Mon 5 Oct,
// 10:15"; Today's lines).
const part = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...o }).format(new Date(iso));
// Three letters, as drawn and as the server's messages say them: en-GB's own
// short month is "Sept" for September.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10:15". */
export const clock = (iso: string) => part(iso, { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Mon 14 Sep": the day alone. */
export const shortDate = (iso: string) => `${part(iso, { weekday: 'short' })} ${part(iso, { day: 'numeric' })} ${MONTHS[Number(part(iso, { month: 'numeric' })) - 1]}`;

/** "Mon 5 Oct, 10:15". */
export const when = (iso: string) => `${shortDate(iso)}, ${clock(iso)}`;

/** The day in London's time, "2026-10-21", to tell today's times from earlier ones. */
export const londonDay = (iso: string) => part(iso, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
