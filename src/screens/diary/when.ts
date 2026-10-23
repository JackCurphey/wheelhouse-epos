// Times as the shop says them, in London's time (the quote's "Sent Mon 5 Oct,
// 10:15"; Today's lines).
const part = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...o }).format(new Date(iso));

/** "10:15". */
export const clock = (iso: string) => part(iso, { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Mon 5 Oct, 10:15". */
export const when = (iso: string) => `${part(iso, { weekday: 'short' })} ${part(iso, { day: 'numeric' })} ${part(iso, { month: 'short' })}, ${clock(iso)}`;

/** The day in London's time, "2026-10-21", to tell today's times from earlier ones. */
export const londonDay = (iso: string) => part(iso, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
