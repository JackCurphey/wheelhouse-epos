// Telling staff when a booking message didn't go (Jack, 20 Oct,
// docs/decisions/2026-10-20-booking-messages.md answer 5; drawn as
// diary-no-message): the answer's reply names the message when the customer
// has no phone or email; a message switched off says nothing.
export type BookingMessageReply = { skipped: 'no_contact'; name: string } | undefined;

export function noMessageNote(reply: BookingMessageReply, customer: string | null | undefined): string | null {
  if (reply?.skipped !== 'no_contact') return null;
  return `“${reply.name}” didn’t go: ${customer || 'The customer'} has no phone number or email on file.`;
}
