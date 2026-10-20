// The pretend sender (Jack, 20 Oct: pretend for now): every channel's message
// is recorded in the outbox and nothing leaves the server. A real sender for a
// channel is added later behind the same interface, only with Jack's yes.
export async function send() {
  return { ok: true, providerId: 'pretend', pretend: true };
}
